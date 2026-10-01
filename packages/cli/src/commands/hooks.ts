import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { durationText, secondsBetween, sessionLine, type LiveAgent, type LiveSession } from "@grooph/core";

import { EVENTS_DIR, eventFiles, parseSource, readLive, sourceExists, type EventSource } from "../events-io.js";
import { writeText } from "../io.js";
import { plural, type Output } from "../print.js";

export const HOOKS_HELP = `grooph hooks install | status | remove [--dir <project>] [--harness claude-code,codex] [--tools] [--local]

Record which subagents a session starts and stops, by a hook, into one file per session
under <project>/.grooph/events/. grooph watch and grooph sessions read those files.

  install   copy the hook to <project>/.grooph/hooks/grooph-event.mjs and add it to the
            harness's hook settings: .claude/settings.json for Claude Code,
            .codex/hooks.json for Codex. Safe to run again: it replaces its own entries
            and leaves every other setting as it was.
  status    say what is installed, and how many session files there are
  remove    take the entries and the hook file out again; the events stay

  --dir <project>   the project (default: the current folder)
  --harness <list>  claude-code (the default), codex, or both separated by a comma
  --tools           also record every finished tool call (its name only), so a subagent
                    shows its last tool. Without it, only the spawn tool is recorded.
  --local           Claude Code only: write .claude/settings.local.json (this machine)
                    instead of .claude/settings.json (shared with the repository)

The hook appends one line and exits 0. It prints nothing, never blocks, and records ids,
names and times: never a prompt, a tool's input or result, or a reply. It needs Node.
Codex runs a hook only after you have reviewed it: open /hooks in Codex once and trust it.
What each harness tells a hook, with sources: docs/subagents.md.`;

export const SESSIONS_HELP = `grooph sessions [<source>...] [--json]

What the event hook has seen: each session, and under it each subagent with whether it is
running or done, for how long, and its last tool. With no source, ./.grooph/events/.

  <source>   an events file, a folder of them, or a project folder (its .grooph/events/).
             git:<ref> reads .grooph/events/ from a git ref without checking it out:
             a lane that commits its events is read from its pushed branch, as
             git:origin/lane-a. Several sources merge into one list, in time order.
             name=<source> shows that source's sessions under a name: a lane, a machine.
  --json     the same as data: the live view grooph watch serves (docs/subagents.md)

Reads files; starts nothing, asks no harness anything, and writes nothing.`;

const MARK = "grooph-event.mjs";
const HOOK_REL = join(".grooph", "hooks", MARK);

/** The hook as this CLI ships it: packages/cli/hooks/grooph-event.mjs. */
export const hookSource = (): string => fileURLToPath(new URL("../../../hooks/grooph-event.mjs", import.meta.url));

type Harness = "claude-code" | "codex";
type Entry = { matcher?: string; hooks: { type: "command"; command: string; async?: boolean; timeout: number }[] };
type Settings = { hooks?: Record<string, unknown[]> } & Record<string, unknown>;

const COMMAND: Record<Harness, string> = {
  // Claude Code gives a hook the project's root.
  "claude-code": `node "$CLAUDE_PROJECT_DIR/${HOOK_REL.split("\\").join("/")}" claude-code`,
  // Codex runs a hook in the session's working directory, which may be a folder inside the project.
  codex: `node "$(git rev-parse --show-toplevel 2>/dev/null || pwd)/${HOOK_REL.split("\\").join("/")}" codex`,
};

/**
 * The entries grooph adds for one harness. The hooks that fire while work is
 * going on run in the background, so the harness never waits for them. The
 * two that fire as a session winds down, `Stop` and `SessionEnd`, are waited
 * for, with a few seconds' limit: a background hook started as a headless
 * session exits can be lost (observed in Claude Code 2.1.280: with `Stop` in
 * the background the last turn's end and the session's end were not recorded).
 */
export function hookEntries(harness: Harness, tools: boolean): Record<string, Entry[]> {
  const run = (async: boolean, timeout: number): Entry["hooks"] => [{ type: "command", command: COMMAND[harness], ...(async ? { async: true } : {}), timeout }];
  const entries: Record<string, Entry[]> = {
    SessionStart: [{ hooks: run(true, 10) }],
    SessionEnd: [{ hooks: run(false, 3) }],
    UserPromptSubmit: [{ hooks: run(true, 10) }],
    Stop: [{ hooks: run(false, 5) }],
    SubagentStart: [{ hooks: run(true, 10) }],
    SubagentStop: [{ hooks: run(true, 10) }],
  };
  // The spawn tool's result is the one place Claude Code says which agent started which.
  if (tools) entries["PostToolUse"] = [{ hooks: run(true, 10) }];
  else if (harness === "claude-code") entries["PostToolUse"] = [{ matcher: "Agent", hooks: run(true, 10) }];
  return entries;
}

const settingsPath = (dir: string, harness: Harness, local: boolean): string =>
  harness === "claude-code" ? join(dir, ".claude", local ? "settings.local.json" : "settings.json") : join(dir, ".codex", "hooks.json");

function readSettings(path: string): Settings {
  if (!existsSync(path)) return {};
  const json: unknown = JSON.parse(readFileSync(path, "utf8"));
  if (typeof json !== "object" || json === null || Array.isArray(json)) throw new Error(`${path} is not a JSON object`);
  return json as Settings;
}

const isOurs = (entry: unknown): boolean =>
  typeof entry === "object" && entry !== null && Array.isArray((entry as Entry).hooks) && (entry as Entry).hooks.some((h) => typeof h?.command === "string" && h.command.includes(MARK));

/** A settings object without grooph's entries; a hook entry that only held ours goes, and an emptied event goes with it. */
function withoutOurs(settings: Settings): Settings {
  if (!settings.hooks || typeof settings.hooks !== "object") return settings;
  const hooks: Record<string, unknown[]> = {};
  for (const [event, list] of Object.entries(settings.hooks)) {
    const kept = Array.isArray(list) ? list.filter((entry) => !isOurs(entry)) : list;
    if (!Array.isArray(kept) || kept.length > 0) hooks[event] = kept as unknown[];
  }
  const { hooks: _old, ...rest } = settings;
  return Object.keys(hooks).length > 0 ? { ...rest, hooks } : rest;
}

function withOurs(settings: Settings, harness: Harness, tools: boolean): Settings {
  const clean = withoutOurs(settings);
  const hooks: Record<string, unknown[]> = { ...(clean.hooks ?? {}) };
  for (const [event, entries] of Object.entries(hookEntries(harness, tools))) hooks[event] = [...(hooks[event] ?? []), ...entries];
  return { ...clean, hooks };
}

const countOurs = (settings: Settings): number => Object.values(settings.hooks ?? {}).reduce((n, list) => n + (Array.isArray(list) ? list.filter(isOurs).length : 0), 0);

export type HooksFlags = { dir?: string; harness?: string; tools?: boolean; local?: boolean };

function harnesses(io: Output, flag: string | undefined): Harness[] | undefined {
  const asked = (flag ?? "claude-code").split(",").map((s) => s.trim()).filter((s) => s !== "");
  const bad = asked.filter((h) => h !== "claude-code" && h !== "codex");
  if (bad.length > 0 || asked.length === 0) {
    io.err(`grooph: --harness is claude-code, codex, or both separated by a comma; got "${flag}"`);
    return undefined;
  }
  return [...new Set(asked)] as Harness[];
}

/** `grooph hooks install | status | remove`. */
export function hooksCommand(io: Output, sub: string | undefined, flags: HooksFlags = {}): number {
  const dir = resolve(flags.dir ?? ".");
  const list = harnesses(io, flags.harness);
  if (!list) return 1;
  const hookFile = join(dir, HOOK_REL);
  const shownPath = (p: string): string => relative(dir, p) || ".";

  if (sub === "install") {
    if (!existsSync(dir)) {
      io.err(`grooph: ${dir} does not exist`);
      return 1;
    }
    const plans: { path: string; text: string }[] = [];
    for (const harness of list) {
      const path = settingsPath(dir, harness, flags.local === true);
      let settings: Settings;
      try {
        settings = readSettings(path);
      } catch (err) {
        io.err(`grooph: cannot read ${shownPath(path)}: ${(err as Error).message}. Nothing was changed.`);
        return 1;
      }
      plans.push({ path, text: `${JSON.stringify(withOurs(settings, harness, flags.tools === true), null, 2)}\n` });
    }
    mkdirSync(dirname(hookFile), { recursive: true });
    copyFileSync(hookSource(), hookFile);
    io.out(`wrote ${shownPath(hookFile)}`);
    for (const plan of plans) {
      writeText(plan.path, plan.text);
      io.out(`wrote ${shownPath(plan.path)}`);
    }
    io.out("");
    io.out(`From the next session on, ${list.join(" and ")} sessions in this project append to ${EVENTS_DIR}/<session id>.jsonl:`);
    io.out(`  one line when a session or a subagent starts or stops${flags.tools ? ", and one per finished tool call (the tool's name only)" : ""}.`);
    io.out("The hook prints nothing and always exits 0: it records, it cannot steer. It needs node on the PATH.");
    if (list.includes("codex")) io.out("Codex runs a hook only after you have reviewed it: open /hooks in Codex once and trust it.");
    io.out(`Watch: grooph watch --sessions   ·   List: grooph sessions   ·   Undo: grooph hooks remove${flags.harness ? ` --harness ${flags.harness}` : ""}`);
    io.out(`The events are a record of this machine's sessions. Commit ${EVENTS_DIR}/ to share them, or add it to .gitignore.`);
    return 0;
  }

  if (sub === "remove") {
    for (const harness of list) {
      for (const local of harness === "claude-code" ? [false, true] : [false]) {
        const path = settingsPath(dir, harness, local);
        if (!existsSync(path)) continue;
        let settings: Settings;
        try {
          settings = readSettings(path);
        } catch (err) {
          io.err(`grooph: cannot read ${shownPath(path)}: ${(err as Error).message}. Left as it is.`);
          continue;
        }
        if (countOurs(settings) === 0) continue;
        writeFileSync(path, `${JSON.stringify(withoutOurs(settings), null, 2)}\n`, "utf8");
        io.out(`removed grooph's entries from ${shownPath(path)}`);
      }
    }
    const stillUsed = (["claude-code", "codex"] as Harness[]).some((h) =>
      [false, true].some((local) => {
        const path = settingsPath(dir, h, local);
        try {
          return existsSync(path) && countOurs(readSettings(path)) > 0;
        } catch {
          return true;
        }
      }),
    );
    if (!stillUsed && existsSync(hookFile)) {
      rmSync(hookFile);
      io.out(`removed ${shownPath(hookFile)}`);
    }
    io.out(`The events in ${EVENTS_DIR}/ are kept.`);
    return 0;
  }

  if (sub === "status") {
    io.out(`${existsSync(hookFile) ? "installed" : "not installed"}: ${shownPath(hookFile)}`);
    for (const harness of ["claude-code", "codex"] as Harness[]) {
      for (const local of harness === "claude-code" ? [false, true] : [false]) {
        const path = settingsPath(dir, harness, local);
        let n = 0;
        try {
          n = existsSync(path) ? countOurs(readSettings(path)) : 0;
        } catch {
          io.out(`${harness}: ${shownPath(path)} could not be read`);
          continue;
        }
        if (n > 0 || !local) io.out(`${harness}: ${n > 0 ? `${plural(n, "hook entry", "hook entries")} in ${shownPath(path)}` : `no entries in ${shownPath(path)}`}`);
      }
    }
    const files = eventFiles(dir);
    io.out(`${plural(files.length, "session file")} in ${EVENTS_DIR}/`);
    return 0;
  }

  io.err(sub === undefined ? "grooph: hooks needs install, status or remove (grooph hooks --help)" : `grooph: unknown hooks command "${sub}"; it is install, status or remove`);
  return 1;
}

// ─── grooph sessions ──────────────────────────────────────────────────────

const short = (id: string): string => (id.length > 10 ? id.slice(-8) : id);

function agentLine(a: LiveAgent, now: string): string {
  const mark = a.state === "running" ? "●" : "✓";
  const time = a.state === "running" ? `running ${durationText(secondsBetween(a.started, now))}` : `done in ${durationText(secondsBetween(a.started, a.ended ?? a.lastAt))}`;
  const tools = a.tools > 0 ? ` · ${plural(a.tools, "tool call")}${a.lastTool ? `, last ${a.lastTool}` : ""}` : "";
  return `${mark} ${a.type}  ${short(a.id)}  ${time}${a.stops > 1 ? ` · resumed ${a.stops - 1}×` : ""}${tools}${a.model ? ` · ${a.model}` : ""}`;
}

/** A session's subagents as an indented tree: a child under the agent that started it, where the harness said. */
export function sessionLines(s: LiveSession, now: string): string[] {
  const where = s.cwd ? ` · ${s.cwd.split("/").filter(Boolean).pop()}` : "";
  const lines = [`${s.source ? `[${s.source}] ` : ""}${sessionLine(s)} · session ${short(s.id)}${where}${s.model ? ` · ${s.model}` : ""}`];
  const ids = new Set(s.agents.map((a) => a.id));
  const walk = (parent: string | undefined, depth: number): void => {
    for (const a of s.agents) {
      const top = a.parent === undefined || !ids.has(a.parent);
      if (parent === undefined ? !top : a.parent !== parent) continue;
      lines.push(`${"  ".repeat(depth + 1)}${agentLine(a, now)}`);
      walk(a.id, depth + 1);
    }
  };
  walk(undefined, 0);
  return lines;
}

/** `grooph sessions [<source>...] [--json]`. */
export function sessionsCommand(io: Output, args: string[], flags: { json?: boolean } = {}): number {
  const sources: EventSource[] = args.length > 0 ? args.map(parseSource) : [{ path: "." }];
  for (const source of sources) {
    if (!sourceExists(source)) {
      io.err(source.ref !== undefined ? `grooph: no such git ref here: ${source.ref} (fetch it first, and run this inside the repository)` : `grooph: no such file or folder: ${source.path}`);
      return 1;
    }
  }
  const view = readLive(sources);
  if (flags.json === true) {
    io.out(JSON.stringify(view, null, 2));
    return 0;
  }
  if (view.sessions.length === 0) {
    io.out(`no sessions recorded in ${sources.map((s) => s.path ?? `git:${s.ref}`).join(", ")}. The event hook writes them: grooph hooks install`);
    return 0;
  }
  view.sessions.forEach((s, i) => {
    if (i > 0) io.out("");
    for (const line of sessionLines(s, view.at)) io.out(line);
  });
  if (view.issues) io.err(`${plural(view.issues.length, "line")} could not be read (the first: ${view.issues[0]!.source} line ${view.issues[0]!.line}, ${view.issues[0]!.message})`);
  return 0;
}
