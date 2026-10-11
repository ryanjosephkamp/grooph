import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { accessSync, chmodSync, closeSync, constants, copyFileSync, existsSync, lstatSync, mkdirSync, openSync, readFileSync, readSync, realpathSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { pathToFileURL } from "node:url";

import { durationText, isQuiet, planLine, secondsBetween, sessionLine, type LiveAgent, type LiveSession } from "@grooph/core";

import { EVENTS_DIR, eventFiles, exactNearest, exactPath, lastPush, listedFor, ownSources, parseSource, readList, readLive, sourceExists, storeLine, type EventSource, type Listed, type PushRecord, type Store } from "../events-io.js";
import { writeText } from "../io.js";
import { shippedHook, userPlaces, type UserPlaces } from "../paths.js";
import { plural, type Output } from "../print.js";

export const HOOKS_HELP = `grooph hooks install | status | remove [--dir <project>] [--harness claude-code,codex] [--tools] [--local]
grooph hooks install | remove --user [--harness claude-code,codex] [--tools]
grooph hooks watch | unwatch <folder>...

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

Outside the project (--user): installed once for the machine, for the folders you list. A
watched project then holds nothing of grooph's: no hook, no settings entry, no events.

  install --user    copy the hook to ~/.grooph/hooks/grooph-event.mjs and add it to the
                    harness's own settings for every project: ~/.claude/settings.json for
                    Claude Code, ~/.codex/hooks.json for Codex. Safe to run again. Its entries
                    go into the file where it stands and every other character of it is left
                    as it was; a file it cannot read, or could not put back whole, is not changed.
  watch <folder>    list a folder. A session working in it, or in a folder inside it, is
                    recorded from then on. Until a folder is listed nothing is recorded.
                    A worktree or a copy kept in another place is another folder.
  unwatch <folder>  take a folder off the list; its events stay
  status            also prints the list, and what is installed outside the project
  remove --user     take the entries and the hook file out again; the list and the events stay

  The events go to ~/.grooph/events/<a name made from the folder's>/, one file per session.
  In a listed folder grooph sessions, grooph watch --sessions and grooph hooks status read
  them from there, and say so.
  Every session on the machine then starts the hook at each of its events, whatever folder
  it works in. For a folder that is not listed the hook reads the list and leaves.
  GROOPH_HOME names another folder than ~/.grooph, by its whole path. CLAUDE_CONFIG_DIR and
  CODEX_HOME name the harnesses' folders, as they do for the harnesses themselves.
  --push, --local and GROOPH_EVENTS_DIR are for an install in a project: grooph events push
  sends a project's own .grooph/events/ and nothing else.

The hook appends one line and exits 0. It prints nothing, never blocks, and records ids,
names and times: never a prompt, a tool's input or result, or a reply. It needs Node.
Codex runs a hook only after you have reviewed it (open /hooks in Codex once and trust it),
and a project's hooks only in a folder it trusts. In a project, commit .codex/hooks.json: the
Codex app works in its own copy of the repository, which holds only committed files.
What each harness tells a hook, with sources: docs/subagents.md.`;

export const SESSIONS_HELP = `grooph sessions [<source>...] [--json]

What the event hook has seen: each session, and under it each subagent with whether it is
running or done, for how long, and its last tool. With no source, ./.grooph/events/;
in a folder listed with grooph hooks watch, the record kept for it outside the project
(and both, where the folder has both: a session is shown once).

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
export const pushSource = (): string => shippedHook(PUSH);

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
export async function eventsCommand(io: Output, sub: string | undefined, args: string[], dir: string | undefined, env: NodeJS.ProcessEnv = process.env): Promise<number> {
  if (sub !== "push") {
    io.err(sub === undefined ? "grooph: events needs push (grooph events --help)" : `grooph: unknown events command "${sub}"; it is push`);
    return 1;
  }
  const project = resolve(dir ?? ".");
  // A push makes its commit from the project's own events folder. Where the only record is the one kept outside the
  // project, there is nothing here for it to send, and saying "no events yet" would be untrue.
  if (!existsSync(join(project, EVENTS_DIR))) {
    const { store } = ownSources(project, env);
    if (store !== undefined) {
      io.err(`grooph: the sessions of ${store.listed} are recorded outside the project, in ${tilde(store.dir)}${sep}, and grooph events push sends only a project's own ${EVENTS_DIR.split(sep).join("/")}/. Nothing was sent. To send events, install in the project as well: grooph hooks install --push`);
      return 1;
    }
  }
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
export const hookSource = (): string => shippedHook(MARK);

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
export function hookEntries(harness: Harness, tools: boolean, push?: { branch?: string }, command: string = COMMAND[harness]): Record<string, Entry[]> {
  const run = (async: boolean, timeout: number): Entry["hooks"] => [{ type: "command", command, ...(async ? { async: true } : {}), timeout }];
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

/** Whether an entry names one of grooph's two scripts at all, whoever wrote it. */
const namesOurs = (entry: unknown): boolean =>
  typeof entry === "object" && entry !== null && Array.isArray((entry as Entry).hooks) && (entry as Entry).hooks.some((h) => typeof h?.command === "string" && (h.command.includes(MARK) || h.command.includes(PUSH)));
/**
 * An entry of an install in a project. One that an install outside the project wrote is not: a person's home folder
 * read as a project has the harness's own user-level settings for its settings file, and what `--user` put there
 * is not a project's to replace or remove.
 */
const isOurs = (entry: unknown): boolean => namesOurs(entry) && !isUserEntry(entry);
const isPush = (entry: unknown): boolean =>
  typeof entry === "object" && entry !== null && Array.isArray((entry as Entry).hooks) && (entry as Entry).hooks.some((h) => typeof h?.command === "string" && h.command.includes(PUSH));

/** A settings object without grooph's entries; a hook entry that only held ours goes, and an emptied event goes with it. */
function withoutOurs(settings: Settings, ours: (entry: unknown) => boolean = isOurs): Settings {
  if (!settings.hooks || typeof settings.hooks !== "object") return settings;
  const hooks: Record<string, unknown[]> = {};
  for (const [event, list] of Object.entries(settings.hooks)) {
    const kept = Array.isArray(list) ? list.filter((entry) => !ours(entry)) : list;
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
const countNaming = (settings: Settings): number => Object.values(settings.hooks ?? {}).reduce((n, list) => n + (Array.isArray(list) ? list.filter(namesOurs).length : 0), 0);
const countPush = (settings: Settings): number => Object.values(settings.hooks ?? {}).reduce((n, list) => n + (Array.isArray(list) ? list.filter(isPush).length : 0), 0);

export type HooksFlags = { dir?: string; harness?: string; tools?: boolean; local?: boolean; push?: boolean; pushBranch?: string; /** the install outside the project */ user?: boolean; /** the folders `watch` and `unwatch` are given */ folders?: string[]; now?: () => Date; env?: Record<string, string | undefined>; cwd?: string };

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

/** Whether the event hook would append to this session file, by the hook's own rules (packages/cli/hooks/grooph-event.mjs): a plain file with one name, empty or beginning as its lines do. */
function hookWouldAddTo(file: string): boolean {
  try {
    const is = lstatSync(file);
    if (!is.isFile() || is.nlink !== 1) return false;
    if (is.size === 0) return true;
    const head = Buffer.alloc(OURS.length);
    const fd = openSync(file, "r");
    try {
      return readSync(fd, head, 0, head.length, 0) === head.length && head.toString() === OURS;
    } finally {
      closeSync(fd);
    }
  } catch {
    return false;
  }
}
/** How every line the hook has written begins. The hook's own copy of this is `OURS` in its file; a test holds the two together. */
export const OURS = '{"v":1,"t":"';

// ─── Outside the project: grooph hooks install --user, watch, unwatch ─────

/** What a user-level settings entry runs: the hook by its whole path, the harness, and the layout, said and not guessed. */
const userCommand = (hook: string, harness: Harness): string => `node "${sep === "\\" ? hook.split("\\").join("/") : hook}" ${harness} --user`;

/**
 * A command an install outside the project wrote, whatever folder that install kept the hook in: `node`, the hook's
 * file by its whole path in a folder named hooks, a harness, `--user`, and nothing else. A command that only looks
 * like one (another file whose name ends the same way, the same file run another way) is somebody's own, and is
 * never taken out.
 */
const USER_COMMAND = /^node "(.*[/\\]hooks[/\\]grooph-event\.mjs)" (?:claude-code|codex) --user$/;
const isUserCommand = (h: unknown): boolean => typeof (h as { command?: unknown } | null)?.command === "string" && USER_COMMAND.test((h as { command: string }).command);
const userCommands = (entry: unknown): string[] =>
  typeof entry === "object" && entry !== null && Array.isArray((entry as Entry).hooks) ? (entry as Entry).hooks.filter(isUserCommand).map((h) => h.command) : [];
const isUserEntry = (entry: unknown): boolean => userCommands(entry).length > 0;
const userEntries = (settings: Settings): unknown[] => Object.values(settings.hooks ?? {}).flatMap((list) => (Array.isArray(list) ? list.filter(isUserEntry) : []));
/** The hook file a user-level command of grooph's runs. */
const ranBy = (command: string): string | undefined => USER_COMMAND.exec(command)?.[1];
/** An entry that names grooph's hook and is not one `install --user` wrote: a project's kind copied here, or one changed by hand. Left alone, and said. */
const strangers = (settings: Settings): number => Object.values(settings.hooks ?? {}).reduce((n, list) => n + (Array.isArray(list) ? list.filter((entry) => namesOurs(entry) && !isUserEntry(entry)).length : 0), 0);

/**
 * A harness's user-level settings. Anything that cannot be read whole and understood is an error, and a caller
 * that meant to change the file then changes nothing: these are a person's own settings for every project they
 * have. With `toChange`, so is a file that could not be put back whole: one that is read-only, one with a second
 * name (replacing it would leave the other name with the old settings), one in a folder that takes no new file.
 */
function readUserSettings(path: string, toChange = false): { settings: Settings; text: string | undefined } {
  const is = lstatSync(path, { throwIfNoEntry: false });
  if (is === undefined) return { settings: {}, text: undefined };
  if (is.isSymbolicLink() && !existsSync(path)) throw new Error("it is a link to a file that is not there");
  const text = readFileSync(path, "utf8");
  const json: unknown = JSON.parse(text);
  if (typeof json !== "object" || json === null || Array.isArray(json)) throw new Error("it is not a JSON object");
  const hooks = (json as Settings).hooks as unknown;
  if (hooks !== undefined && (typeof hooks !== "object" || hooks === null || Array.isArray(hooks))) throw new Error('its "hooks" is not an object');
  for (const [event, list] of Object.entries(hooks ?? {})) if (!Array.isArray(list)) throw new Error(`its hooks for ${event} are not a list`);
  if (toChange) {
    const real = realpathSync(path);
    if (statSync(real).nlink > 1) throw new Error("it has a second name (a hard link), and replacing it whole would leave that other name with the settings as they were");
    try {
      accessSync(real, constants.W_OK);
    } catch {
      throw new Error("it is read-only");
    }
    try {
      accessSync(dirname(real), constants.W_OK);
    } catch {
      throw new Error("its folder takes no new file, so it cannot be replaced whole");
    }
  }
  return { settings: json as Settings, text };
}

/**
 * The settings with grooph's user-level entries taken out and, when `add` is given, put in again at the end of
 * each event's list. Everything else stays as it was and where it was: every other key, every other entry, an
 * event's list that was already empty, and the other commands of an entry that somebody joined ours into. An
 * entry or an event that held only ours goes with them.
 */
function userSettings(settings: Settings, add?: Record<string, Entry[]>): Settings {
  const hooks = new Map<string, unknown[]>();
  for (const [event, list] of Object.entries(settings.hooks ?? {})) {
    const kept = list.flatMap((entry): unknown[] => {
      if (!isUserEntry(entry)) return [entry];
      const others = (entry as Entry).hooks.filter((h) => !isUserCommand(h));
      return others.length > 0 ? [{ ...(entry as Entry), hooks: others }] : [];
    });
    if (!list.some(isUserEntry)) hooks.set(event, list);
    else if (kept.length > 0) hooks.set(event, kept);
  }
  for (const [event, entries] of Object.entries(add ?? {})) hooks.set(event, [...(hooks.get(event) ?? []), ...entries]);
  // "hooks" goes only when taking ours out is what emptied it.
  const gone = hooks.size === 0 && userEntries(settings).length > 0;
  const pairs: [string, unknown][] = Object.entries(settings).flatMap(([key, value]): [string, unknown][] => (key !== "hooks" ? [[key, value]] : gone ? [] : [[key, Object.fromEntries(hooks)]]));
  if (!Object.hasOwn(settings, "hooks") && hooks.size > 0) pairs.push(["hooks", Object.fromEntries(hooks)]);
  return Object.fromEntries(pairs) as Settings;
}

// A settings file is changed where it stands. It is not read into an object and written out again: that would lay
// the whole file out anew, round a number too large to hold, and drop a key written twice. Only the entries that
// are grooph's are taken out of the text or put into it, and every other character of the file is left as it was.

type Patch = { start: number; end: number; text: string };
/** A member of an object or an element of a list: where it begins (at its key, in an object), and its value. */
type Item = { key?: string; from: number; node: Shape };
type Shape = { kind: "object" | "array" | "other"; start: number; end: number; items: Item[] };

/** Where each value, member and element of a JSON text is. The text has already been parsed, so it is well formed. */
function shape(text: string): Shape {
  let i = 0;
  const space = (): void => {
    while (i < text.length && (text[i] === " " || text[i] === "\t" || text[i] === "\n" || text[i] === "\r")) i += 1;
  };
  const string = (): void => {
    i += 1;
    while (text[i] !== '"') i += text[i] === "\\" ? 2 : 1;
    i += 1;
  };
  const value = (): Shape => {
    const start = i;
    const opens = text[i];
    if (opens === '"') {
      string();
      return { kind: "other", start, end: i, items: [] };
    }
    if (opens !== "{" && opens !== "[") {
      // A number, true, false or null.
      while (i < text.length && !",]} \t\n\r".includes(text[i]!)) i += 1;
      return { kind: "other", start, end: i, items: [] };
    }
    const items: Item[] = [];
    i += 1;
    for (;;) {
      space();
      if (text[i] === "}" || text[i] === "]") break;
      const from = i;
      let key: string | undefined;
      if (opens === "{") {
        string();
        key = JSON.parse(text.slice(from, i)) as string;
        space();
        i += 1;
        space();
      }
      const node = value();
      items.push({ ...(key !== undefined ? { key } : {}), from, node });
      space();
      if (text[i] === ",") i += 1;
    }
    i += 1;
    return { kind: opens === "{" ? "object" : "array", start, end: i, items };
  };
  space();
  return value();
}

const patched = (text: string, patches: Patch[]): string => [...patches].sort((a, b) => b.start - a.start).reduce((t, p) => t.slice(0, p.start) + p.text + t.slice(p.end), text);

/** Take some members or elements out of an object or a list, each with the comma that went with it. */
function without(node: Shape, drop: (item: Item, at: number) => boolean): Patch[] {
  const dropped = node.items.map(drop);
  if (!dropped.includes(true)) return [];
  const lastKept = dropped.lastIndexOf(false);
  if (lastKept < 0) return [{ start: node.start + 1, end: node.end - 1, text: "" }];
  return node.items.flatMap((item, at): Patch[] => {
    if (!dropped[at]) return [];
    // Before the last that stays: up to where the next begins. After it: from where the one before ended.
    return at < lastKept ? [{ start: item.from, end: node.items[at + 1]!.from, text: "" }] : [{ start: node.items[at - 1]!.node.end, end: item.node.end, text: "" }];
  });
}

/** How a settings file is laid out: its line ending, and what it indents a member with (undefined for a file kept on one line). */
function layoutOf(text: string, root: Shape): { eol: string; unit: string | undefined; gap: string } {
  const eol = text.includes("\r\n") ? "\r\n" : "\n";
  const first = root.items[0];
  const lead = first !== undefined ? text.slice(root.start + 1, first.from) : "\n";
  const gap = /[:,] /.test(text) ? " " : "";
  if (!lead.includes("\n")) return { eol, unit: undefined, gap };
  const unit = lead.slice(lead.lastIndexOf("\n") + 1);
  return { eol, unit: unit === "" ? "  " : unit, gap };
}

/** The settings' text with grooph's user-level entries taken out, as `userSettings` takes them out of the object. */
function takenOut(text: string, settings: Settings): string {
  const root = shape(text);
  const members = root.items.filter((item) => item.key === "hooks");
  if (members.length === 0) return text;
  if (members.length > 1) throw new Error('it has "hooks" twice');
  const hooks = members[0]!.node;
  if (new Set(hooks.items.map((item) => item.key)).size !== hooks.items.length) throw new Error("its hooks name one event twice");
  const { eol, unit } = layoutOf(text, root);
  const patches: Patch[] = [];
  const emptied = new Set<Item>();
  for (const member of hooks.items) {
    const entries = (settings.hooks?.[member.key!] ?? []) as unknown[];
    if (!entries.some(isUserEntry)) continue;
    const others = entries.map((entry) => (isUserEntry(entry) ? (entry as Entry).hooks.filter((h) => !isUserCommand(h)) : undefined));
    const goes = (at: number): boolean => others[at] !== undefined && others[at]!.length === 0;
    if (entries.every((_, at) => goes(at))) {
      emptied.add(member);
      continue;
    }
    patches.push(...without(member.node, (_, at) => goes(at)));
    // An entry somebody joined ours into is written again without ours.
    member.node.items.forEach((item, at) => {
      if (others[at] === undefined || others[at]!.length === 0) return;
      const rest = { ...(entries[at] as Entry), hooks: others[at]! };
      patches.push({ start: item.node.start, end: item.node.end, text: unit === undefined ? JSON.stringify(rest) : JSON.stringify(rest, null, unit).split("\n").join(eol + unit.repeat(3)) });
    });
  }
  // Every event emptied: "hooks" itself goes, as it came.
  if (emptied.size > 0 && emptied.size === hooks.items.length) return patched(text, without(root, (item) => item.key === "hooks"));
  return patched(text, [...patches, ...without(hooks, (item) => emptied.has(item))]);
}

/** The settings' text with entries put in at the end of each event's list, the event and "hooks" itself made where they are missing. */
function putIn(text: string, add: Record<string, Entry[]>): string {
  const root = shape(text);
  const { eol, unit, gap } = layoutOf(text, root);
  const line = (depth: number): string => (unit === undefined ? gap : eol + unit.repeat(depth));
  const written = (value: unknown, depth: number): string => (unit === undefined ? JSON.stringify(value) : JSON.stringify(value, null, unit).split("\n").join(eol + unit.repeat(depth)));
  const member = (key: string, value: unknown, depth: number): string => `${JSON.stringify(key)}:${unit === undefined ? gap : " "}${written(value, depth)}`;
  /** After the last thing in an object or a list; or, in an empty one, as its only contents. */
  const into = (node: Shape, texts: string[], depth: number): Patch => {
    const last = node.items.at(-1);
    return last !== undefined
      ? { start: last.node.end, end: last.node.end, text: texts.map((t) => `,${line(depth)}${t}`).join("") }
      : { start: node.start + 1, end: node.end - 1, text: unit === undefined ? texts.join(`,${gap}`) : `${line(depth)}${texts.join(`,${line(depth)}`)}${line(depth - 1)}` };
  };
  const hooks = root.items.find((item) => item.key === "hooks")?.node;
  if (hooks === undefined) return patched(text, [into(root, [member("hooks", add, 1)], 1)]);
  const patches: Patch[] = [];
  const fresh: string[] = [];
  for (const [event, entries] of Object.entries(add)) {
    const list = hooks.items.find((item) => item.key === event)?.node;
    if (list === undefined) fresh.push(member(event, entries, 2));
    else patches.push(into(list, entries.map((entry) => written(entry, 3)), 3));
  }
  if (fresh.length > 0) patches.push(into(hooks, fresh, 2));
  return patched(text, patches);
}

/**
 * The text to write for settings changed from `settings` to `next`: a new file laid out plainly; an existing one
 * with only grooph's entries taken out of its text and put into it. What comes of that is read again and held to
 * `next`: text that does not say exactly what was meant is never written.
 */
function settingsText(was: string | undefined, settings: Settings, next: Settings, add?: Record<string, Entry[]>): string {
  if (was === undefined) return `${JSON.stringify(next, null, 2)}\n`;
  const out = takenOut(was, settings);
  const text = add !== undefined ? putIn(out, add) : out;
  if (JSON.stringify(JSON.parse(text)) !== JSON.stringify(next)) throw new Error("grooph could not change it and be sure of the result");
  return text;
}

/**
 * Put a file in place whole, or leave what was there: written beside itself and then renamed over, so a harness
 * reading its settings, or a hook being started, never meets half a file, and a command stopped part way leaves
 * the file as it was. There is no other way it is written: where the file cannot be replaced whole, it is not
 * changed. A file that is a link to one kept elsewhere stays a link, and the one it names is replaced; a file
 * keeps the permissions it had.
 */
function writeWhole(path: string, contents: string | Uint8Array, mode?: number): void {
  let target = path;
  let keep = mode;
  if (existsSync(path)) {
    target = realpathSync(path);
    keep = statSync(target).mode & 0o777;
  } else mkdirSync(dirname(path), { recursive: true });
  const beside = `${target}.${process.pid}.grooph-tmp`;
  try {
    writeFileSync(beside, contents, { flag: "wx", ...(keep !== undefined ? { mode: keep } : {}) });
    if (keep !== undefined) chmodSync(beside, keep);
    renameSync(beside, target);
  } catch (err) {
    rmSync(beside, { force: true });
    throw err;
  }
}

/** A path as a person reads it: `~` for their home folder. */
const tilde = (path: string): string => {
  const home = homedir();
  return path === home ? "~" : home !== "" && home !== sep && path.startsWith(home + sep) ? `~${path.slice(home.length)}` : path;
};
const within = (child: string, parent: string): boolean => child === parent || child.startsWith(parent.endsWith(sep) ? parent : parent + sep);

/**
 * The name a listed folder's events are kept under in grooph's own folder: the folder's own name, and a few
 * characters made from its whole path, so that two projects with one name do not share a record and a folder
 * listed again finds the record it left. Longer where a listed folder already has that name.
 */
export function storeName(path: string, others: Listed[]): string {
  const name = basename(path).replace(/[^A-Za-z0-9._-]+/g, "-").replace(/^[^A-Za-z0-9]+/, "").slice(0, 48) || "folder";
  const hash = createHash("sha256").update(path).digest("hex");
  for (const length of [8, 16, 32]) {
    const made = `${name}-${hash.slice(0, length)}`;
    if (!others.some((f) => f.path !== path && f.events.toLowerCase() === made.toLowerCase())) return made;
  }
  return `${name}-${hash}`;
}

/** Whether an install outside the project is in place: the hook's file, and an entry that runs it in some harness's settings. */
function userInstalled(places: UserPlaces): boolean {
  if (!existsSync(places.hook)) return false;
  return (["claude-code", "codex"] as Harness[]).some((harness) => {
    try {
      return userEntries(readUserSettings(places.settings[harness]).settings).length > 0;
    } catch {
      return false;
    }
  });
}

function installUser(io: Output, flags: HooksFlags, list: Harness[], places: UserPlaces): number {
  if (flags.push === true || flags.pushBranch !== undefined || flags.local === true || flags.dir !== undefined) {
    io.err("grooph: --dir, --local, --push and --push-branch are for an install in a project. With --user, install takes --harness and --tools. Nothing was changed.");
    return 1;
  }
  // The hook's path goes into a command a shell will run, between double quotes.
  if (/["$`\r\n\0]/.test(places.hook) || (sep !== "\\" && places.hook.includes("\\"))) {
    io.err(`grooph: ${places.home} has a character in its name that a shell reads as its own (a double quote, $, a backtick, a backslash or a line break), and the settings entry names the hook by its whole path. Name another folder with GROOPH_HOME. Nothing was changed.`);
    return 1;
  }
  const plans: { path: string; text: string | undefined; strangers: number }[] = [];
  for (const harness of list) {
    const path = places.settings[harness];
    try {
      const { settings, text } = readUserSettings(path, true);
      const add = hookEntries(harness, flags.tools === true, undefined, userCommand(places.hook, harness));
      const next = userSettings(settings, add);
      // Entries that are already as they would be written: the file is not touched.
      plans.push({ path, text: text !== undefined && JSON.stringify(next) === JSON.stringify(settings) ? undefined : settingsText(text, settings, next, add), strangers: strangers(settings) });
    } catch (err) {
      io.err(`grooph: cannot read ${tilde(path)}: ${(err as Error).message}. Nothing was changed.`);
      return 1;
    }
  }
  const shipped = readFileSync(hookSource());
  const written: string[] = [];
  let at = places.hook;
  try {
    if (existsSync(places.hook) && readFileSync(places.hook).equals(shipped)) io.out(`as it was: ${tilde(places.hook)}`);
    else {
      writeWhole(places.hook, shipped);
      written.push(places.hook);
      io.out(`wrote ${tilde(places.hook)}`);
    }
    for (const plan of plans) {
      at = plan.path;
      if (plan.text === undefined) io.out(`as it was: ${tilde(plan.path)}`);
      else {
        writeWhole(plan.path, plan.text);
        written.push(plan.path);
        io.out(`wrote ${tilde(plan.path)}`);
      }
    }
  } catch (err) {
    io.err(`grooph: could not write ${tilde(at)}: ${(err as Error).message}. ${written.length > 0 ? `Written before that: ${written.map(tilde).join(", ")}.` : "Nothing was changed."}`);
    return 1;
  }
  for (const plan of plans) {
    if (plan.strangers > 0) io.out(`${plural(plan.strangers, "entry", "entries")} in ${tilde(plan.path)} ${plan.strangers === 1 ? "names" : "name"} grooph's hook and ${plan.strangers === 1 ? "is" : "are"} not as this command writes them: left as ${plan.strangers === 1 ? "it is" : "they are"}. If ${plan.strangers === 1 ? "it runs" : "they run"} this hook too, an event is recorded twice.`);
  }
  const { folders, problem } = readList(places.list);
  io.out("");
  io.out(`From now on every ${list.join(" and ")} session on this machine runs the hook when a session or a subagent starts or stops${flags.tools ? ", and when a tool call finishes" : ""},`);
  io.out("whatever folder it works in. The hook records a session only when it works in a folder you have listed, or in a folder inside one:");
  io.out("  grooph hooks watch <folder>");
  if (problem !== undefined) io.out(`The list could not be read (${tilde(places.list)}: ${problem}), so nothing is recorded until it can.`);
  else if (folders.length === 0) io.out("No folder is listed yet, so nothing is recorded yet. For a session in any other folder the hook reads the list and leaves.");
  else io.out(`${plural(folders.length, "folder is", "folders are")} listed (grooph hooks status). For a session in any other folder the hook reads the list and leaves.`);
  io.out(`The events are kept in ${tilde(places.events)}${sep}, one folder for each listed folder: a watched project holds nothing of grooph's.`);
  io.out("The hook prints nothing and always exits 0: it records, it cannot steer. It needs node on the PATH.");
  io.out("A session that is already open takes up new hooks when its harness reads its settings again: most do at once, and not all.");
  if (list.includes("codex")) io.out("Codex runs a hook only after you have reviewed it: open /hooks in Codex once and trust it. If grooph sessions stays empty after a Codex session in a listed folder, that is what is missing. Codex does not say so.");
  io.out(`In a listed folder: grooph sessions   ·   grooph watch --sessions   ·   Undo: grooph hooks remove --user${flags.harness ? ` --harness ${flags.harness}` : ""}`);
  io.out("Sending events to another machine (grooph events push) is for an install in a project: it sends a project's own .grooph/events/ and nothing else.");
  return 0;
}

function removeUser(io: Output, flags: HooksFlags, list: Harness[], places: UserPlaces): number {
  if (flags.dir !== undefined || flags.local === true) {
    io.err("grooph: --dir and --local are for an install in a project. With --user, remove takes --harness. Nothing was changed.");
    return 1;
  }
  let failed = false;
  const elsewhere = new Set<string>();
  for (const harness of list) {
    const path = places.settings[harness];
    if (!existsSync(path)) continue;
    try {
      const { settings, text } = readUserSettings(path, true);
      const ours = userEntries(settings);
      if (ours.length === 0) continue;
      // Entries written while GROOPH_HOME named another folder are grooph's all the same, and go; the hook they ran is said.
      for (const command of ours.flatMap(userCommands)) {
        const ran = ranBy(command);
        if (ran !== undefined && resolve(ran) !== resolve(places.hook)) elsewhere.add(resolve(ran));
      }
      writeWhole(path, settingsText(text, settings, userSettings(settings)));
      io.out(`removed grooph's entries from ${tilde(path)}`);
    } catch (err) {
      io.err(`grooph: cannot read ${tilde(path)}: ${(err as Error).message}. Left as it is.`);
      failed = true;
    }
  }
  // The hook's file goes when no harness's settings name it any more: not an entry of this install's, and not one
  // somebody wrote or changed by hand, which would then be heard from at every event. A settings file that cannot
  // be read may still name it.
  const naming = (["claude-code", "codex"] as Harness[]).flatMap((harness) => {
    try {
      return countNaming(readUserSettings(places.settings[harness]).settings) > 0 ? [places.settings[harness]] : [];
    } catch {
      return [places.settings[harness]];
    }
  });
  if (naming.length === 0 && existsSync(places.hook)) {
    rmSync(places.hook);
    io.out(`removed ${tilde(places.hook)}`);
  } else if (existsSync(places.hook)) io.out(`kept ${tilde(places.hook)}: ${naming.map(tilde).join(" and ")} still ${naming.length === 1 ? "names" : "name"} it, or could not be read.`);
  for (const ran of elsewhere) io.out(`Those entries ran the hook at ${tilde(ran)}, in a folder GROOPH_HOME does not name now. That file is left where it is, with the list and the events beside it.`);
  io.out(`The list of folders (${tilde(places.list)}) and the events in ${tilde(places.events)}${sep} are kept.`);
  return failed ? 1 : 0;
}

/**
 * Hold the list while it is read, changed and written, so that two commands at once (an agent listing several
 * projects) do not each write a list without the other's folder. A folder beside the list is the lock: made by
 * one command at a time, and taken over when it is older than any command could be.
 */
function holdingList<T>(places: UserPlaces, fn: () => T): T {
  const lock = `${places.list}.lock`;
  mkdirSync(dirname(lock), { recursive: true });
  const wait = new Int32Array(new SharedArrayBuffer(4));
  for (let tries = 0; ; tries += 1) {
    try {
      mkdirSync(lock);
      break;
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== "EEXIST") throw err;
      const age = Date.now() - (lstatSync(lock, { throwIfNoEntry: false })?.mtimeMs ?? Date.now());
      if (age > 10_000 || tries > 200) rmSync(lock, { recursive: true, force: true });
      else Atomics.wait(wait, 0, 0, 25);
    }
  }
  try {
    return fn();
  } finally {
    rmSync(lock, { recursive: true, force: true });
  }
}

/** `grooph hooks watch <folder>...` and `grooph hooks unwatch <folder>...`: the list the hook reads at the user's level. */
function listCommand(io: Output, sub: "watch" | "unwatch", flags: HooksFlags, places: UserPlaces): number {
  if (flags.folders === undefined || flags.folders.length === 0) {
    io.err(`grooph: hooks ${sub} needs a folder. For the one you are in: grooph hooks ${sub} .`);
    return 1;
  }
  let worst = 0;
  for (const folder of flags.folders) worst = Math.max(worst, listOne(io, sub, folder, flags, places));
  return worst;
}

function listOne(io: Output, sub: "watch" | "unwatch", folder: string, flags: HooksFlags, places: UserPlaces): number {
  const full = resolve(flags.cwd ?? process.cwd(), folder);
  const { folders, problem } = readList(places.list);
  if (problem !== undefined) {
    io.err(`grooph: cannot use the list in ${tilde(places.list)}: ${problem}. Nothing was changed.`);
    return 1;
  }
  // The list is read again under the lock and changed as it then stands: what was read above is for the words and the refusals.
  const change = (to: (now: Listed[]) => Listed[]): Listed[] =>
    holdingList(places, () => {
      const now = readList(places.list);
      if (now.problem !== undefined) throw new Error(`cannot use the list in ${tilde(places.list)}: ${now.problem}. Nothing was changed.`);
      const next = to(now.folders);
      // The list names a person's projects: a new one is theirs alone to read.
      if (next !== now.folders) writeWhole(places.list, `${JSON.stringify({ groophWatched: 1, folders: next }, null, 2)}\n`, 0o600);
      return next;
    });
  const store = (f: Listed): string => `${tilde(join(places.events, f.events))}${sep}`;

  if (sub === "unwatch") {
    // A folder that has since been moved or deleted is taken off by the path it was listed under.
    const path = exactPath(full);
    const was = folders.find((f) => f.path === path || f.path === full);
    if (was === undefined) {
      io.out(`not on the list: ${path}. Nothing was changed.${folders.length > 0 ? ` Listed: ${folders.map((f) => f.path).join(", ")}` : ""}`);
      return 0;
    }
    const left = change((now) => (now.some((f) => f.path === was.path) ? now.filter((f) => f.path !== was.path) : now));
    io.out(`no longer listed: ${was.path}`);
    // A folder that holds it may be listed still.
    const outer = left.filter((f) => within(was.path, f.path)).sort((a, b) => b.path.length - a.path.length)[0];
    io.out(
      outer !== undefined
        ? `A session working there is still recorded, under ${outer.path}, which holds it and is listed. What was recorded under this one is kept: ${store(was)}`
        : `From its next event on, a session working there is not recorded. What was recorded is kept: ${store(was)}`,
    );
    return 0;
  }

  if (!existsSync(full) || !statSync(full).isDirectory()) {
    io.err(`grooph: ${folder} is not a folder. Nothing was changed.`);
    return 1;
  }
  const path = exactPath(full);
  // grooph's folder may not be there yet: where it will be is asked of the folders above it that are.
  const home = exactNearest(places.home);
  if (within(home, path)) {
    io.err(`grooph: ${path} holds grooph's own folder (${home}), where the record is kept, so a session working there could reach its own record. List the projects themselves. Nothing was changed.`);
    return 1;
  }
  if (within(path, home)) {
    io.err(`grooph: ${path} is in grooph's own folder (${home}), where the record is kept. List the projects themselves. Nothing was changed.`);
    return 1;
  }
  if (within(exactPath(homedir()), path)) {
    io.err(`grooph: ${path} holds your whole home folder: listing it would record nearly every session on this machine. List the projects you want recorded. Nothing was changed.`);
    return 1;
  }
  const already = folders.find((f) => f.path === path);
  const entry = change((now) => (now.some((f) => f.path === path) ? now : [...now, { path, events: storeName(path, now) }])).find((f) => f.path === path)!;
  io.out(`${already === undefined ? "listed" : "already listed"}: ${path}`);
  io.out(`A session working in it, or in a folder inside it, is recorded${already === undefined ? " from its next event on" : ""}, in ${store(entry)}`);
  for (const other of folders) {
    if (other.path === path) continue;
    if (within(path, other.path) || within(other.path, path)) {
      io.out(`${within(path, other.path) ? `It is inside ${other.path}` : `${other.path} is inside it`}, and both are listed. A session is recorded under the inner of the two that holds the folder it was started in, where its harness says which that is (Claude Code does), and otherwise the folder it is working in.`);
    }
  }
  io.out("A worktree or a copy kept in another place is another folder: list it by its own path.");
  if (!userInstalled(places)) io.out("Nothing runs the hook outside a project yet: grooph hooks install --user");
  if (existsSync(join(path, HOOK_REL))) io.out(`This folder also has an install of its own (${HOOK_REL.split(sep).join("/")}): its sessions are recorded in the project as well, until that one is removed (grooph hooks remove --dir ${folder}).`);
  return 0;
}

/** What `grooph hooks status` says of the install outside the project. Nothing, where there is none and no list. */
function userStatus(io: Output, places: UserPlaces, dir: string, eventsDir?: string): void {
  const read = (["claude-code", "codex"] as Harness[]).map((harness) => {
    const path = places.settings[harness];
    try {
      const settings = existsSync(path) ? readUserSettings(path).settings : {};
      return { harness, path, commands: userEntries(settings).flatMap(userCommands), strangers: strangers(settings) };
    } catch {
      return { harness, path, commands: undefined, strangers: 0 };
    }
  });
  let hookThere: boolean;
  try {
    hookThere = lstatSync(places.hook, { throwIfNoEntry: false }) !== undefined;
  } catch {
    // grooph's own folder cannot be looked into: said, and no error.
    io.out("");
    io.out(`outside the project (grooph hooks install --user): ${tilde(places.home)} could not be read`);
    return;
  }
  if (!hookThere && !existsSync(places.list) && read.every((r) => r.commands !== undefined && r.commands.length === 0)) return;

  io.out("");
  io.out(`outside the project (grooph hooks install --user), in ${tilde(places.home)}:`);
  io.out(`  ${hookThere ? "installed" : "not installed"}: ${tilde(places.hook)}`);
  for (const r of read) {
    if (r.commands === undefined) io.out(`  ${r.harness}: ${tilde(r.path)} could not be read`);
    else io.out(`  ${r.harness}: ${r.commands.length > 0 ? `${plural(r.commands.length, "hook entry", "hook entries")} in ${tilde(r.path)}` : `no entries in ${tilde(r.path)}`}`);
    // Entries written while GROOPH_HOME named another folder run that folder's hook, which reads that folder's list.
    const others = [...new Set((r.commands ?? []).flatMap((command) => {
      const ran = ranBy(command);
      return ran !== undefined && resolve(ran) !== resolve(places.hook) ? [resolve(ran)] : [];
    }))];
    for (const ran of others) io.out(`    they run the hook at ${tilde(ran)}: its list and its events are in that folder, not in this one (GROOPH_HOME names this one)`);
    if (r.strangers > 0) io.out(`    and ${plural(r.strangers, "entry", "entries")} there that ${r.strangers === 1 ? "names" : "name"} grooph's hook and ${r.strangers === 1 ? "is" : "are"} not as install --user writes them: grooph leaves ${r.strangers === 1 ? "it" : "them"} alone`);
  }
  if (hookThere) {
    let same = false;
    try {
      same = readFileSync(places.hook).equals(readFileSync(hookSource()));
    } catch {
      // Something there that cannot be read as a file is not this grooph's hook.
    }
    if (!same) io.out("  that hook is not this grooph's version: run grooph hooks install --user again (with the same options)");
    // The hook takes the folder its file is really in for grooph's own: reached through a link, it reads the list beside the file it leads to.
    try {
      if (exactPath(places.hook) !== join(exactPath(places.home), "hooks", MARK)) io.out(`  that hook is a link to ${tilde(exactPath(places.hook))}, or is reached through one: it reads the list in the folder its file is really in, and not this one`);
    } catch {
      // said above, if it could not be read
    }
  }
  const { folders, problem } = readList(places.list);
  if (problem !== undefined) io.out(`  the list (${tilde(places.list)}) ${folders.length > 0 ? "is read in part" : "could not be read, so nothing is recorded"}: ${problem}`);
  if (folders.length === 0) {
    if (problem === undefined) io.out("  no folder is listed, so nothing is recorded: grooph hooks watch <folder>");
  } else {
    io.out(`  ${plural(folders.length, "folder")} listed (grooph hooks watch <folder>, grooph hooks unwatch <folder>):`);
    for (const f of folders) {
      let count: string;
      try {
        const n = eventFiles(join(places.events, f.events)).length;
        count = n === 0 ? "no session recorded yet" : `${plural(n, "session file")} in ${tilde(join(places.events, f.events))}${sep}`;
      } catch {
        count = `${tilde(join(places.events, f.events))}${sep} could not be read`;
      }
      io.out(`    ${f.path}${existsSync(f.path) ? "" : " (no such folder now)"}: ${count}`);
    }
  }
  // The variable that moves a project's events is not the recorder's to obey out here: a hook that a harness runs
  // outside its sandbox does not take where it writes from something a session's environment can set.
  if (eventsDir !== undefined && eventsDir !== "") io.out(`  GROOPH_EVENTS_DIR is set (${eventsDir}): the recorder outside the project does not read it, and its events are in ${tilde(places.events)}${sep}`);
  const mine = listedFor(folders, dir);
  io.out(mine !== undefined ? `  this folder is ${mine.path === exactPath(dir) ? "listed" : `in ${mine.path}, which is listed`}: its sessions are recorded outside the project` : "  this folder is not listed: a session working here is not recorded by the hook outside the project");
}

/** What stands in the way of the hook in a listed folder's record, as `status` says it for a project's own: a link at a folder, and files it adds nothing to. */
function storeTrouble(io: Output, places: UserPlaces, store: Store, files: string[]): void {
  try {
    for (const at of [places.events, store.dir]) {
      const is = lstatSync(at, { throwIfNoEntry: false });
      if (is === undefined || is.isDirectory()) continue;
      io.out(`${tilde(at)} is ${is.isSymbolicLink() ? "a link, not a folder" : "not a folder"}: the hook records nothing while it is`);
      break;
    }
    const left = files.filter((file) => dirname(file) === store.dir && !hookWouldAddTo(file)).length;
    if (left > 0) io.out(`${plural(left, "session file")} the hook adds nothing to: each is a link, has a second name (a hard link), or does not begin as a file of the hook's lines does`);
  } catch {
    // A folder that cannot be looked into: the lines above already say what could be read.
  }
}

/** `grooph hooks install | status | remove`, in a project or (`--user`) outside it; `grooph hooks watch | unwatch <folder>`. */
export function hooksCommand(io: Output, sub: string | undefined, flags: HooksFlags = {}): number {
  const dir = resolve(flags.dir ?? ".");
  const list = harnesses(io, flags.harness);
  if (!list) return 1;
  const places = userPlaces((flags.env ?? process.env) as NodeJS.ProcessEnv);
  const outside = sub === "watch" || sub === "unwatch" || (flags.user === true && (sub === "install" || sub === "remove"));
  // The hook is named in a settings entry by its whole path, and the list must be one file from wherever a command is run.
  const named = (flags.env ?? process.env)["GROOPH_HOME"];
  if (outside && named !== undefined && named !== "" && !isAbsolute(named)) {
    io.err(`grooph: GROOPH_HOME is "${named}", which is not a whole path: it would name a different folder from every folder a command is run in. Nothing was changed.`);
    return 1;
  }
  if (sub === "watch" || sub === "unwatch") return listCommand(io, sub, flags, places);
  if (flags.user === true && sub === "install") return installUser(io, flags, list, places);
  if (flags.user === true && sub === "remove") return removeUser(io, flags, list, places);
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
    // A person's home folder, read as a project, has the harness's own user-level settings for its settings file.
    // Entries of a project's kind there would run in every session on the machine, and fail aloud in each project
    // with no hook of its own; and the hook's file there is the one an install outside the project keeps.
    for (const harness of list) {
      const path = settingsPath(dir, harness, flags.local === true);
      if (exactNearest(path) !== exactNearest(places.settings[harness])) continue;
      io.err(`grooph: ${shownPath(path)} in this folder is ${harness === "claude-code" ? "Claude Code" : "Codex"}'s own settings for every project on this machine, so this folder is no project to install in: the entries would run in every session, and fail in each project that has no hook of its own. To record from outside the projects: grooph hooks install --user. Nothing was changed.`);
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
          // Any entry that names the hook, an install outside the project's included: where this folder's settings are the harness's own, that one still runs this file.
          return existsSync(path) && countNaming(readSettings(path)) > 0;
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
    // The copy in a project is the one that runs: a project installed by another grooph keeps that grooph's hook until it is installed again.
    const differs = (copy: string, shipped: string): boolean => {
      try {
        return existsSync(copy) && readFileSync(copy, "utf8") !== readFileSync(shipped, "utf8");
      } catch {
        // Something by that name that cannot be read as a file is not this grooph's hook either.
        return true;
      }
    };
    if (differs(hookFile, hookSource())) io.out(`${HOOK_REL} is not this grooph's version: run grooph hooks install again (with the same options)`);
    if (differs(join(dir, PUSH_REL), pushSource())) io.out(`${PUSH_REL} is not this grooph's version: run grooph hooks install again (with the same options) and commit it`);
    // Where this folder is in a listed one, its sessions are recorded outside the project, and are counted there.
    let store: Store | undefined;
    try {
      store = ownSources(dir, (flags.env ?? process.env) as NodeJS.ProcessEnv).store;
    } catch {
      // A list that cannot be read is said below, with the rest of what is outside the project.
    }
    let files: string[] = [];
    if (store === undefined || lstatSync(join(dir, EVENTS_DIR), { throwIfNoEntry: false }) !== undefined) {
      try {
        files = eventFiles(dir);
        io.out(`${plural(files.length, "session file")} in ${EVENTS_DIR}/`);
      } catch {
        io.out(`${EVENTS_DIR.split(sep).join("/")}/ could not be read`);
      }
    }
    if (store !== undefined) {
      try {
        const kept = eventFiles(store.dir);
        io.out(`${plural(kept.length, "session file")} in ${tilde(store.dir)}${sep}, outside the project: ${store.listed === exactPath(dir) ? "this folder is listed" : `this folder is in ${store.listed}, which is listed`} (grooph hooks watch)`);
        files = [...files, ...kept];
      } catch {
        io.out(`${tilde(store.dir)}${sep} could not be read`);
      }
    }
    // The hook writes through no link and says nothing when it will not write: this is where a person hears of it.
    // (With GROOPH_EVENTS_DIR set the hook writes there, and what stands in the project's own folder is nothing to it.)
    if (!(flags.env ?? process.env)["GROOPH_EVENTS_DIR"]) {
      try {
        for (const rel of [dirname(EVENTS_DIR), EVENTS_DIR]) {
          const is = lstatSync(join(dir, rel), { throwIfNoEntry: false });
          if (is === undefined || is.isDirectory()) continue;
          io.out(`${rel.split(sep).join("/")} is ${is.isSymbolicLink() ? "a link, not a folder" : "not a folder"}: the hook records nothing while it is`);
          break;
        }
        // Among the files in the events folder itself: a link, a file with a second name, or a file that does not begin as the hook's lines do.
        const events = join(resolve(dir), EVENTS_DIR);
        const left = files.filter((file) => dirname(file) === events && !hookWouldAddTo(file)).length;
        if (left > 0) io.out(`${plural(left, "session file")} the hook adds nothing to: each is a link, has a second name (a hard link), or does not begin as a file of the hook's lines does`);
      } catch {
        // A folder that cannot be looked into: the lines above already say what could be read.
      }
      if (store !== undefined) storeTrouble(io, places, store, files);
    }
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
    if (session !== undefined && session !== "" && here && (existsSync(hookFile) || (store !== undefined && existsSync(places.hook)))) {
      const name = /^[A-Za-z0-9._-]{1,128}$/.test(session) ? session : Buffer.from(session).toString("hex").slice(0, 64);
      // Outside the project a session is recorded under the listed folder it was started in, which may be one that holds this one.
      const elsewhere = store === undefined ? [] : readList(places.list).folders.map((f) => join(places.events, f.events, `${name}.jsonl`)).filter((file) => existsSync(file));
      const own = files.find((file) => file.endsWith(`${sep}${name}.jsonl`)) ?? elsewhere[0];
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
    userStatus(io, places, dir, (flags.env ?? process.env)["GROOPH_EVENTS_DIR"]);
    return 0;
  }

  io.err(sub === undefined ? "grooph: hooks needs install, status, remove, watch or unwatch (grooph hooks --help)" : `grooph: unknown hooks command "${sub}"; it is install, status, remove, watch or unwatch`);
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

/**
 * A session as the pieces its lines are made of: its own line, its subagents as a tree (a child under the agent that
 * started it, where the harness said), and what its lead said through the MCP server. The command prints them as
 * they are; the MCP server puts each after a label of its own, as a JSON string, since every piece holds words that
 * another session chose (a subagent's type, a plan's title, a note).
 */
export function sessionParts(s: LiveSession, now: string): { head: string; agents: { depth: number; text: string }[]; plans: { title?: string; text: string }[]; notes: string[] } {
  const where = s.cwd ? ` · ${s.cwd.split("/").filter(Boolean).pop()}` : "";
  const quiet = isQuiet(s, now);
  const head = `${s.source ? `[${s.source}] ` : ""}${sessionLine(s, now)} · session ${short(s.id)}${where}${s.model ? ` · ${s.model}` : ""}`;
  const agents: { depth: number; text: string }[] = [];
  const ids = new Set(s.agents.map((a) => a.id));
  const walk = (parent: string | undefined, depth: number): void => {
    for (const a of s.agents) {
      const top = a.parent === undefined || !ids.has(a.parent);
      if (parent === undefined ? !top : a.parent !== parent) continue;
      agents.push({ depth, text: agentLine(a, now, quiet) });
      walk(a.id, depth + 1);
    }
  };
  walk(undefined, 0);
  return {
    head,
    agents,
    plans: (s.plans ?? []).map((plan) => ({ ...(plan.title ? { title: plan.title } : {}), text: planLine(plan, quiet) })),
    notes: (s.notes ?? []).map((note) => note.text),
  };
}

/** A session's lines as `grooph sessions` prints them. */
export function sessionLines(s: LiveSession, now: string): string[] {
  const parts = sessionParts(s, now);
  return [
    parts.head,
    ...parts.agents.map((a) => `${"  ".repeat(a.depth + 1)}${a.text}`),
    // What its lead said through the MCP server, beside what the hooks saw.
    ...parts.plans.map((plan) => `  plan${plan.title ? ` "${plan.title}"` : ""}: ${plan.text}`),
    ...parts.notes.map((note) => `  note: ${note}`),
  ];
}

/** `grooph sessions [<source>...] [--json]`. */
export function sessionsCommand(io: Output, args: string[], flags: { json?: boolean; env?: NodeJS.ProcessEnv; cwd?: string } = {}): number {
  // With no source: this folder's own events and, in a listed folder, the record kept for it outside the project.
  const own = args.length > 0 ? undefined : ownSources(flags.cwd ?? ".", flags.env);
  const sources: EventSource[] = own?.sources ?? args.map(parseSource);
  for (const source of own !== undefined ? [] : sources) {
    if (!sourceExists(source)) {
      io.err(source.ref !== undefined ? `grooph: no such git ref here: ${source.ref} (fetch it first, and run this inside the repository)` : `grooph: no such file or folder: ${source.path}`);
      return 1;
    }
  }
  const view = readLive(sources);
  // A list that cannot be read hides the record it names: said, so that an empty answer is not taken for no sessions.
  if (own?.problem !== undefined) io.err(own.problem);
  if (flags.json === true) {
    io.out(JSON.stringify(view, null, 2));
    // Beside the data, not in it.
    if (own?.store !== undefined) io.err(storeLine(own.store));
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
    if (own?.store !== undefined) io.out(`no sessions recorded for ${own.store.listed} yet, in ${sources.map((s) => (s.path === own.store!.dir ? `${tilde(s.path)}${sep}` : s.path)).join(" or in ")}. The event hook outside the project writes them, for a session working in that folder: grooph hooks status says whether it is installed`);
    else io.out(`no sessions recorded in ${sources.map((s) => s.path ?? `git:${s.ref}`).join(", ")}. The event hook writes them: grooph hooks install`);
    unsent();
    return 0;
  }
  view.sessions.forEach((s, i) => {
    if (i > 0) io.out("");
    for (const line of sessionLines(s, view.at)) io.out(line);
  });
  unsent();
  if (own?.store !== undefined) {
    io.out("");
    io.out(storeLine(own.store));
  }
  if (view.issues) io.err(`${plural(view.issues.length, "line")} could not be read (the first: ${view.issues[0]!.source} line ${view.issues[0]!.line}, ${view.issues[0]!.message})`);
  return 0;
}
