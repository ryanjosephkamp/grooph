import { execFileSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { durationText, isQuiet, planLine, secondsBetween, sessionLine, type LiveAgent, type LiveSession } from "@grooph/core";

import { EVENTS_DIR, eventFiles, lastPush, parseSource, readLive, sourceExists, type EventSource, type PushRecord } from "../events-io.js";
import { writeText } from "../io.js";
import { plural, type Output } from "../print.js";

export const HOOKS_HELP = `grooph hooks install | status | remove [--dir <project>] [--harness claude-code,codex] [--tools] [--local]

Record which subagents a session starts and stops, by a hook, into one file per session
under <project>/.grooph/events/. grooph watch and grooph sessions read those files.

  install   copy the hook to <project>/.grooph/hooks/grooph-event.mjs and add it to the
            harness's hook settings: .claude/settings.json for Claude Code,
            .codex/hooks.json for Codex. Safe to run again: it replaces its own entries
            and leaves every other setting as it was.
  status    say what is installed, how many session files there are, and how the last
            push of them went (a push made by the hook says nothing aloud: this is where
            one that failed is seen)
  remove    take the entries and the hook file out again; the events stay

  --dir <project>   the project (default: the current folder)
  --harness <list>  claude-code (the default), codex, or both separated by a comma
  --push            also send the events to their own branch, in the background (grooph events
                    push): at the start and the end of every turn, and during a long turn at
                    most every ten minutes. Off unless asked for: it uses the session's right
                    to push. The branch is grooph-events/<the branch checked out>, or
                    grooph-events-detached while none is. --push-branch <name> names one branch
                    for every session that reads these settings; many sessions may share it.
  --tools           also record every finished tool call (its name only), so a subagent
                    shows its last tool. Without it, Claude Code's spawn tool is the only one recorded.
  --local           Claude Code only: write .claude/settings.local.json (this machine)
                    instead of .claude/settings.json (shared with the repository)

The hook appends one line and exits 0. It prints nothing, never blocks, and records ids,
names and times: never a prompt, a tool's input or result, or a reply. It needs Node.
Codex runs a hook only after you have reviewed it (open /hooks in Codex once and trust it),
and only in a folder it trusts. Commit .codex/hooks.json: the Codex app works in its own copy
of the repository, which holds only committed files.
What each harness tells a hook, with sources: docs/subagents.md.`;

export const SESSIONS_HELP = `grooph sessions [<source>...] [--json]

What the event hook has seen: each session, and under it each subagent with whether it is
running or done, for how long, and its last tool. With no source, ./.grooph/events/.

  <source>   an events file, a folder of them, or a project folder (its .grooph/events/).
             git:<ref> reads .grooph/events/ from a git ref without checking it out:
             a lane that sends its events with grooph events push is read, after a
             fetch, as git:origin/grooph-events/<its branch>. Several sources merge
             into one list, in time order. A session two sources both hold is shown
             once, under the source that holds the most of it.
             name=<source> shows that source's sessions under a name: a lane, a machine.
  --json     the same as data: the live view grooph watch serves (docs/subagents.md)

Reads files; starts nothing, asks no harness anything, and writes nothing.`;

const MARK = "grooph-event.mjs";
const HOOK_REL = join(".grooph", "hooks", MARK);
const PUSH = "grooph-events-push.mjs";
const PUSH_REL = join(".grooph", "hooks", PUSH);

/** The script that sends events to a branch of their own, as this CLI ships it: packages/cli/hooks/grooph-events-push.mjs. */
export const pushSource = (): string => fileURLToPath(new URL(`../../../hooks/${PUSH}`, import.meta.url));

export const EVENTS_HELP = `grooph events push [--branch <name>] [--remote <name>] [--since <time> [--session <id>]] [--no-push] [--dir <project>]

Send this project's session events to a branch of their own, so another machine can
read them and no pull request ever carries them.

  --branch <name>   the branch to write. Default: grooph-events/<the branch checked out>,
                    and grooph-events-detached when no branch is checked out.
                    Give the whole name when a harness only lets a session push under a
                    prefix, for example --branch claude/grooph-events-lane-a
  --remote <name>   default: origin
  --no-push         make the commit and print its id; send nothing
  --since <time>    leave out event files whose last line is older than this, unless the
                    branch already holds them. The hook at a turn's end gives its own
                    session's first line, so files an earlier session left in the folder
                    do not go to a branch that never had them
  --session <id>    with --since: this session's own files go whatever their times say
  --dir <project>   default: the current directory

It makes one commit whose tree is .grooph/events/ and nothing else, on top of what that
branch already holds, and pushes it. It never touches the working tree, the index, HEAD
or the branch checked out. Event files already on the branch that this clone does not
have are kept, and a file both have is never made shorter, so many sessions may share
one. When another session sends first, this one looks again and goes on top of it.

What is sent is what the hook wrote, less two paths: a folder goes as its name, and the
path of a subagent's transcript is left out. Only whole lines that are events go. The files
here keep all.

It writes only to a branch that holds events and nothing else: a branch with any other
file on it, and the branch checked out here, are refused.

How the last push went is kept in .grooph/events/.last-push.json (never sent), and
grooph hooks status says it.

A session with no grooph installed runs the same code as a script that
grooph hooks install puts beside the hook:
  node .grooph/hooks/grooph-events-push.mjs

Read them elsewhere, after a fetch:
  grooph sessions lane-a=git:origin/grooph-events/<branch>`;

type PushModule = { main(argv: string[], project: string, out?: (line: string) => void, err?: (line: string) => void): number };

/** `grooph events push`: the shipped script, run in this process. */
export async function eventsCommand(io: Output, sub: string | undefined, args: string[], dir: string | undefined): Promise<number> {
  if (sub !== "push") {
    io.err(sub === undefined ? "grooph: events needs push (grooph events --help)" : `grooph: unknown events command "${sub}"; it is push`);
    return 1;
  }
  const project = resolve(dir ?? ".");
  // The hook at a turn's end runs the project's own copy. Two versions writing one branch can leave an event on it
  // twice, so a copy that is not this one is said, with the way to replace it.
  const copy = join(project, PUSH_REL);
  if (existsSync(copy) && readFileSync(copy, "utf8") !== readFileSync(pushSource(), "utf8")) {
    io.err(`grooph: ${PUSH_REL} here is not this grooph's version: the hook at a turn's end sends with that one. Run grooph hooks install again (with the same options) and commit it.`);
  }
  const mod = (await import(pathToFileURL(pushSource()).href)) as PushModule;
  return mod.main(args, project, (line) => io.out(line), (line) => io.err(line));
}

/** The hook as this CLI ships it: packages/cli/hooks/grooph-event.mjs. */
export const hookSource = (): string => fileURLToPath(new URL("../../../hooks/grooph-event.mjs", import.meta.url));

type Harness = "claude-code" | "codex";
type Entry = { matcher?: string; hooks: { type: "command"; command: string; async?: boolean; timeout: number }[] };
type Settings = { hooks?: Record<string, unknown[]> } & Record<string, unknown>;

/** How long a turn may run before its events are sent in passing: well inside the half hour after which a silent session reads "last seen". */
export const PUSH_EVERY_SECONDS = 600;

/** The push script as a hook: the same locations, the `--hook` flag, the branch when one was named, and `--every` for the one run in passing. */
const pushCommand = (harness: Harness, branch: string | undefined, every?: number): string => {
  const rel = PUSH_REL.split("\\").join("/");
  const at = harness === "claude-code" ? `"$CLAUDE_PROJECT_DIR/${rel}"` : `"$(git rev-parse --show-toplevel 2>/dev/null || pwd)/${rel}"`;
  return `node ${at} --hook${every ? ` --every ${every}` : ""}${branch ? ` --branch ${branch}` : ""}`;
};

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
 *
 * With `push` (asked for with --push; off otherwise), a second hook sends the events to their own branch, in the
 * background: at the end of each turn (a session cannot send what it writes as it stops, so without this a lane's
 * last turn never leaves its sandbox), at the start of each turn (so a reader elsewhere sees that a turn is open),
 * and, in passing on a finished tool call, when the last push was ten minutes ago or more (so a turn that runs
 * long is still heard from). It is a separate script from the event hook, which stays one appended line.
 */
export function hookEntries(harness: Harness, tools: boolean, push?: { branch?: string }): Record<string, Entry[]> {
  const run = (async: boolean, timeout: number): Entry["hooks"] => [{ type: "command", command: COMMAND[harness], ...(async ? { async: true } : {}), timeout }];
  const entries: Record<string, Entry[]> = {
    SessionStart: [{ hooks: run(true, 10) }],
    SessionEnd: [{ hooks: run(false, 3) }],
    UserPromptSubmit: [{ hooks: run(true, 10) }],
    Stop: [{ hooks: run(false, 5) }],
    SubagentStart: [{ hooks: run(true, 10) }],
    SubagentStop: [{ hooks: run(true, 10) }],
  };
  const send = (every?: number): Entry["hooks"] => [{ type: "command", command: pushCommand(harness, push?.branch, every), async: true, timeout: 60 }];
  if (push) {
    entries["Stop"]!.push({ hooks: send() });
    entries["UserPromptSubmit"]!.push({ hooks: send() });
  }
  // The spawn tool's result is the one place Claude Code says which agent started which.
  if (tools) entries["PostToolUse"] = [{ hooks: run(true, 10) }];
  else if (harness === "claude-code") entries["PostToolUse"] = [{ matcher: "Agent", hooks: run(true, 10) }];
  // In passing, on the tool calls that are recorded anyway: with --tools that is every one.
  if (push && entries["PostToolUse"]) entries["PostToolUse"].push({ ...(entries["PostToolUse"][0]!.matcher ? { matcher: entries["PostToolUse"][0]!.matcher } : {}), hooks: send(PUSH_EVERY_SECONDS) });
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
  typeof entry === "object" && entry !== null && Array.isArray((entry as Entry).hooks) && (entry as Entry).hooks.some((h) => typeof h?.command === "string" && (h.command.includes(MARK) || h.command.includes(PUSH)));
const isPush = (entry: unknown): boolean =>
  typeof entry === "object" && entry !== null && Array.isArray((entry as Entry).hooks) && (entry as Entry).hooks.some((h) => typeof h?.command === "string" && h.command.includes(PUSH));

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

function withOurs(settings: Settings, harness: Harness, tools: boolean, push?: { branch?: string }): Settings {
  const clean = withoutOurs(settings);
  const hooks: Record<string, unknown[]> = { ...(clean.hooks ?? {}) };
  for (const [event, entries] of Object.entries(hookEntries(harness, tools, push))) hooks[event] = [...(hooks[event] ?? []), ...entries];
  return { ...clean, hooks };
}

const countOurs = (settings: Settings): number => Object.values(settings.hooks ?? {}).reduce((n, list) => n + (Array.isArray(list) ? list.filter(isOurs).length : 0), 0);
const countPush = (settings: Settings): number => Object.values(settings.hooks ?? {}).reduce((n, list) => n + (Array.isArray(list) ? list.filter(isPush).length : 0), 0);

export type HooksFlags = { dir?: string; harness?: string; tools?: boolean; local?: boolean; push?: boolean; pushBranch?: string; now?: () => Date; env?: Record<string, string | undefined>; cwd?: string };

function harnesses(io: Output, flag: string | undefined): Harness[] | undefined {
  const asked = (flag ?? "claude-code").split(",").map((s) => s.trim()).filter((s) => s !== "");
  const bad = asked.filter((h) => h !== "claude-code" && h !== "codex");
  if (bad.length > 0 || asked.length === 0) {
    io.err(`grooph: --harness is claude-code, codex, or both separated by a comma; got "${flag}"`);
    return undefined;
  }
  return [...new Set(asked)] as Harness[];
}

const clock = (iso: string): string => `${iso.slice(0, 16).replace("T", " ")} UTC`;
const ago = (iso: string, now: string): string => (secondsBetween(iso, now) < 5 ? "just now" : `${durationText(secondsBetween(iso, now))} ago`);

/** A push ends itself within a minute (its own limit is forty-five seconds): one that began longer ago and has not said how it ended was stopped. */
const PUSH_LIMIT_SECONDS = 60;

/** Whether the record says the events here have not been seen elsewhere: the last push failed, or one began and never ended. */
export const pushTrouble = (r: PushRecord, now: string): boolean => r.last?.ok === false || (r.started !== undefined && secondsBetween(r.started, now) > PUSH_LIMIT_SECONDS);

/** How the last push went, in words. */
export function pushLines(r: PushRecord, now: string): string[] {
  const lines: string[] = [];
  const arrived = r.arrived ? `The last that arrived: ${clock(r.arrived.at)}, to ${r.arrived.branch}.` : "None has arrived from here.";
  const kept = `The events are still in ${EVENTS_DIR}/ and go with the next push that works.`;
  if (r.started !== undefined) {
    const cut = secondsBetween(r.started, now) > PUSH_LIMIT_SECONDS;
    lines.push(
      cut
        ? `a push began ${ago(r.started, now)} (${clock(r.started)}), by the hook, and NEVER FINISHED: it was stopped before it could say why (the sandbox was put to sleep, or the process was killed)`
        : `a push began ${ago(r.started, now)} (${clock(r.started)}), by the hook, and is under way`,
    );
    if (cut && r.last?.ok !== false) lines.push(`  ${arrived} ${kept}`);
  }
  const last = r.last;
  if (!last) return lines;
  const who = last.by === "hook" ? "by the hook" : "by hand";
  const before = r.started !== undefined ? "the one before: " : "last push: ";
  // What the push said of itself, up to its first full stop: where it sent how much, or that there was nothing new.
  if (last.ok) lines.push(`${before}${ago(last.at, now)} (${clock(last.at)}), ${who}: ${last.message.split(/\. (?=[A-Z])/)[0]!.replace(/\.$/, "") || "it went through"}${last.tries ? ` (on try ${last.tries}${last.crowded ? ": other sessions were sending to the same branch" : ""})` : ""}`);
  else {
    const run = (last.failures ?? 1) > 1 ? `${last.failures} in a row since ${clock(last.failedSince ?? last.at)}. ` : "";
    lines.push(`${r.started !== undefined ? "the one before" : "last push"} FAILED ${ago(last.at, now)} (${clock(last.at)}), ${who}${last.branch ? `, to ${last.branch}` : ""}: ${last.message || "no reason was recorded"}`, `  ${run}${arrived} ${kept}`);
  }
  return lines;
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
    // The branch goes into a command a shell will run: only what a branch name needs.
    if (flags.pushBranch !== undefined) {
      if (!/^[A-Za-z0-9][A-Za-z0-9._/-]*$/.test(flags.pushBranch)) {
        io.err(`grooph: --push-branch takes a plain branch name (letters, digits, ".", "_", "-", "/"); got "${flags.pushBranch}". Nothing was changed.`);
        return 1;
      }
      // And a name the push would refuse on every turn, silently, is refused here, aloud.
      const gitSays = (args: string[]): string | undefined => {
        try {
          return execFileSync("git", ["-C", dir, ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
        } catch {
          return undefined;
        }
      };
      if (gitSays(["check-ref-format", "--branch", flags.pushBranch]) === undefined && gitSays(["rev-parse", "--git-dir"]) !== undefined) {
        io.err(`grooph: "${flags.pushBranch}" is not a branch name git accepts. Nothing was changed.`);
        return 1;
      }
      if (gitSays(["symbolic-ref", "--quiet", "HEAD"]) === `refs/heads/${flags.pushBranch}`) {
        io.err(`grooph: "${flags.pushBranch}" is the branch checked out here: the events go to a branch of their own, never to a branch of work. Nothing was changed.`);
        return 1;
      }
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
      const push = flags.push === true || flags.pushBranch !== undefined ? { ...(flags.pushBranch !== undefined ? { branch: flags.pushBranch } : {}) } : undefined;
      plans.push({ path, text: `${JSON.stringify(withOurs(settings, harness, flags.tools === true, push), null, 2)}\n` });
    }
    mkdirSync(dirname(hookFile), { recursive: true });
    copyFileSync(hookSource(), hookFile);
    io.out(`wrote ${shownPath(hookFile)}`);
    copyFileSync(pushSource(), join(dir, PUSH_REL));
    io.out(`wrote ${shownPath(join(dir, PUSH_REL))}`);
    for (const plan of plans) {
      writeText(plan.path, plan.text);
      io.out(`wrote ${shownPath(plan.path)}`);
    }
    io.out("");
    io.out(`From the next session on, ${list.join(" and ")} sessions in this project append to ${EVENTS_DIR}/<session id>.jsonl:`);
    io.out(`  one line when a session or a subagent starts or stops${flags.tools ? ", and one per finished tool call (the tool's name only)" : ""}.`);
    io.out("The hook prints nothing and always exits 0: it records, it cannot steer. It needs node on the PATH.");
    if (list.includes("codex")) {
      // Slice 0032: each of these, when missing, left `grooph sessions` empty with no word from Codex.
      io.out("Codex runs a hook only after you have reviewed it: open /hooks in Codex once and trust it. The folder must also be one Codex trusts.");
      io.out("Commit .codex/hooks.json and .grooph/hooks/: the Codex app runs a chat in its own copy of the repository, which holds only committed files.");
      io.out("If grooph sessions stays empty after a Codex session, one of these is missing. Codex does not say which.");
    }
    io.out(`Watch: grooph watch --sessions   ·   List: grooph sessions   ·   Undo: grooph hooks remove${flags.harness ? ` --harness ${flags.harness}` : ""}`);
    io.out(`The events are a record of this machine's sessions: add ${EVENTS_DIR}/ to .gitignore. To let another machine read them,`);
    io.out(`send them to a branch of their own: grooph events push (or, with no grooph there, node ${PUSH_REL}).`);
    if (flags.push === true || flags.pushBranch !== undefined) {
      io.out(`With --push, that is done at the end of every turn, in the background, to ${flags.pushBranch ?? "grooph-events/<the branch checked out> (grooph-events-detached while none is)"}: a session`);
      io.out("cannot send what it writes as it stops, so this is how its last turn is seen elsewhere. It prints nothing, never asks for a");
      io.out("password and never fails a turn. A run that exits the moment its turn ends (claude -p) may be gone before it finishes.");
      io.out("It is also done at the start of every turn, so a reader elsewhere sees that a turn is open, and during a turn at most every");
      io.out(`ten minutes${flags.tools ? "" : " (without --tools: in Claude Code only when a subagent is started, in Codex not at all)"}, so a turn that runs long is still heard from.`);
      io.out("A push that fails says nothing aloud: grooph hooks status says how the last one went. In a sandbox with no grooph:");
      io.out(`  node ${PUSH_REL} --status`);
    } else {
      io.out("A session cannot send what it writes as it stops. To send at the end of every turn instead, install with --push.");
    }
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
    if (!stillUsed) {
      for (const file of [hookFile, join(dir, PUSH_REL)]) {
        if (!existsSync(file)) continue;
        rmSync(file);
        io.out(`removed ${shownPath(file)}`);
      }
    }
    io.out(`The events in ${EVENTS_DIR}/ are kept.`);
    return 0;
  }

  if (sub === "status") {
    io.out(`${existsSync(hookFile) ? "installed" : "not installed"}: ${shownPath(hookFile)}`);
    let anyPush = false;
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
        let pushing = 0;
        try {
          pushing = n > 0 ? countPush(readSettings(path)) : 0;
        } catch {
          // counted above
        }
        anyPush ||= pushing > 0;
        // One sending entry is an install by 0.2.4 or earlier: the end of a turn only. Two are a turn's start and
        // end, with no recorded tool call to send in passing on (Codex without --tools).
        const sends =
          pushing > 2
            ? `, ${pushing} of which send the events: at each turn's start and end, and during a long turn`
            : pushing === 2
              ? ", 2 of which send the events: at each turn's start and end"
              : pushing === 1
                ? ", one of which sends the events at the end of each turn (an older install: run grooph hooks install again with --push and the same options to send at a turn's start and during a long turn too)"
                : "";
        if (n > 0 || !local) io.out(`${harness}: ${n > 0 ? `${plural(n, "hook entry", "hook entries")} in ${shownPath(path)}${sends}` : `no entries in ${shownPath(path)}`}`);
      }
    }
    if (existsSync(join(dir, PUSH_REL)) && readFileSync(join(dir, PUSH_REL), "utf8") !== readFileSync(pushSource(), "utf8")) {
      io.out(`${PUSH_REL} is not this grooph's version: run grooph hooks install again (with the same options) and commit it`);
    }
    const files = eventFiles(dir);
    io.out(`${plural(files.length, "session file")} in ${EVENTS_DIR}/`);
    // Run from inside a session, the harness says which one: whether that session itself has recorded anything.
    // Only when that session is working in this project: asked about another project (--dir), "nothing recorded"
    // would be about the wrong session.
    const env = flags.env ?? process.env;
    const session = env["CLAUDE_CODE_SESSION_ID"] || env["CODEX_SESSION_ID"];
    const real = (path: string): string => {
      try {
        return realpathSync(path);
      } catch {
        return resolve(path);
      }
    };
    const from = real(flags.cwd ?? process.cwd());
    const here = from === real(dir) || from.startsWith(real(dir) + sep);
    if (session !== undefined && session !== "" && here && existsSync(hookFile)) {
      const name = /^[A-Za-z0-9._-]{1,128}$/.test(session) ? session : Buffer.from(session).toString("hex").slice(0, 64);
      const own = files.find((file) => file.endsWith(`${sep}${name}.jsonl`));
      const lines = own ? readFileSync(own, "utf8").split("\n").filter((line) => line.trim() !== "").length : 0;
      io.out(
        lines > 0
          ? `this session (${session}): ${plural(lines, "line")} recorded`
          : `this session (${session}): NOTHING recorded: the harness has not run the hooks in it. A session takes up its hooks when it starts; hooks that arrive later are taken up by most sessions and not by all.`,
      );
    }
    const pushed = lastPush(dir);
    if (pushed) for (const line of pushLines(pushed, (flags.now ?? (() => new Date()))().toISOString())) io.out(line);
    else if (anyPush) io.out("no push recorded yet: the first turn to start after this version was installed leaves one");
    return 0;
  }

  io.err(sub === undefined ? "grooph: hooks needs install, status or remove (grooph hooks --help)" : `grooph: unknown hooks command "${sub}"; it is install, status or remove`);
  return 1;
}

// ─── grooph sessions ──────────────────────────────────────────────────────

const short = (id: string): string => (id.length > 10 ? id.slice(-8) : id);

function agentLine(a: LiveAgent, now: string, quiet: boolean): string {
  const mark = a.state === "running" ? (quiet ? "?" : "●") : "✓";
  // In a session gone quiet, a subagent with no stop on record is not known to be running.
  const time =
    a.state === "running"
      ? quiet
        ? `not seen to finish, started ${durationText(secondsBetween(a.started, now))} ago`
        : `running ${durationText(secondsBetween(a.started, now))}`
      : `done in ${durationText(secondsBetween(a.started, a.ended ?? a.lastAt))}`;
  const tools = a.tools > 0 ? ` · ${plural(a.tools, "tool call")}${a.lastTool ? `, last ${a.lastTool}` : ""}` : "";
  return `${mark} ${a.type}  ${short(a.id)}  ${time}${a.stops > 1 ? ` · resumed ${a.stops - 1}×` : ""}${tools}${a.model ? ` · ${a.model}` : ""}`;
}

/** A session's subagents as an indented tree: a child under the agent that started it, where the harness said. */
export function sessionLines(s: LiveSession, now: string): string[] {
  const where = s.cwd ? ` · ${s.cwd.split("/").filter(Boolean).pop()}` : "";
  const quiet = isQuiet(s, now);
  const lines = [`${s.source ? `[${s.source}] ` : ""}${sessionLine(s, now)} · session ${short(s.id)}${where}${s.model ? ` · ${s.model}` : ""}`];
  const ids = new Set(s.agents.map((a) => a.id));
  const walk = (parent: string | undefined, depth: number): void => {
    for (const a of s.agents) {
      const top = a.parent === undefined || !ids.has(a.parent);
      if (parent === undefined ? !top : a.parent !== parent) continue;
      lines.push(`${"  ".repeat(depth + 1)}${agentLine(a, now, quiet)}`);
      walk(a.id, depth + 1);
    }
  };
  walk(undefined, 0);
  // What its lead said through the MCP server, beside what the hooks saw.
  for (const plan of s.plans ?? []) lines.push(`  plan${plan.title ? ` "${plan.title}"` : ""}: ${planLine(plan, quiet)}`);
  for (const note of s.notes ?? []) lines.push(`  note: ${note.text}`);
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
  // A project read where it is: if its last push failed, what is listed here has not been seen anywhere else.
  const unsent = (): void => {
    for (const source of sources) {
      const pushed = source.path !== undefined ? lastPush(source.path) : undefined;
      if (!pushed || !pushTrouble(pushed, view.at)) continue;
      io.out("");
      for (const line of pushLines(pushed, view.at)) io.out(`${source.name ? `[${source.name}] ` : ""}${line}`);
    }
  };
  if (view.sessions.length === 0) {
    io.out(`no sessions recorded in ${sources.map((s) => s.path ?? `git:${s.ref}`).join(", ")}. The event hook writes them: grooph hooks install`);
    unsent();
    return 0;
  }
  view.sessions.forEach((s, i) => {
    if (i > 0) io.out("");
    for (const line of sessionLines(s, view.at)) io.out(line);
  });
  unsent();
  if (view.issues) io.err(`${plural(view.issues.length, "line")} could not be read (the first: ${view.issues[0]!.source} line ${view.issues[0]!.line}, ${view.issues[0]!.message})`);
  return 0;
}
