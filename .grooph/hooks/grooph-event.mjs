#!/usr/bin/env node
/**
 * grooph's event hook (docs/subagents.md; amendment A-012).
 *
 * A harness runs this when a session or a subagent starts or stops, or a tool
 * call finishes. It reads the hook's JSON from standard input and appends ONE
 * line to <project>/.grooph/events/<session id>.jsonl. That is all it does:
 *
 *   - it prints nothing, to standard output or standard error. (Some hooks'
 *     output is fed back to the agent; this one has none to feed.)
 *   - it always exits 0, whatever goes wrong, so it never blocks or fails a step.
 *   - it keeps ids, names and times. It never writes a prompt, a tool's input
 *     or result, or anything an agent said.
 *   - it writes only inside the project it was installed in, and only for
 *     sessions working in that project.
 *   - it writes through no link. A harness runs a hook outside its sandbox, and
 *     a session can write in its project: where a link stands at .grooph, at
 *     .grooph/events or at a session's file, or that file has a second name (a
 *     hard link), nothing is written. `grooph hooks status` says when a link
 *     stands at either folder, and how many session files it will add nothing to.
 *   - it adds only to a file that is empty or already begins as one of its own.
 *
 * No dependencies; any Node from 18 on. `grooph hooks install` copies this
 * file to <project>/.grooph/hooks/ and points the harness at the copy.
 *
 *   node .grooph/hooks/grooph-event.mjs <harness>      harness: claude-code | codex
 */
import { closeSync, constants, fstatSync, lstatSync, mkdirSync, openSync, readSync, realpathSync, statSync, writeSync } from "node:fs";
import { dirname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const EVENT = {
  SessionStart: "session-start",
  SessionEnd: "session-end",
  UserPromptSubmit: "turn-start",
  Stop: "turn-end",
  SubagentStart: "subagent-start",
  SubagentStop: "subagent-stop",
  PostToolUse: "tool",
};

/** How every line this hook has ever written begins, and so how every file of its lines does. */
const OURS = '{"v":1,"t":"';

const str = (v) => (typeof v === "string" && v !== "" ? v : undefined);
const real = (p) => {
  try {
    return realpathSync(p);
  } catch {
    return resolve(p);
  }
};
const inside = (child, parent) => child === parent || child.startsWith(parent + sep);
/** What stands at a path, a link there not followed; undefined when nothing does. */
const at = (p) => lstatSync(p, { throwIfNoEntry: false, bigint: true });
const same = (a, b) => a.ino === b.ino && a.dev === b.dev;

/**
 * Step into one folder, by its name in the folder this process stands in, making it where nothing stands.
 * False where a link, or anything else that is not a folder, stands there. The folder stood in afterward is
 * checked to be the one that was looked at: a link put there between the look and the step leads somewhere
 * else, and that shows. From then on the folder is held, whatever is done to its name.
 */
function into(part) {
  if (at(part) === undefined) {
    try {
      mkdirSync(part);
    } catch (e) {
      // A hook started at the same moment made it first.
      if (e?.code !== "EEXIST") throw e;
    }
  }
  const looked = at(part);
  if (looked?.isDirectory() !== true) return false;
  process.chdir(part);
  return same(looked, statSync(".", { bigint: true }));
}

/** Stand in the folder the events go in, made if it is missing. False where a link stands in its place, or on the way to it from the project. */
function inEventsFolder(project) {
  const named = str(process.env.GROOPH_EVENTS_DIR);
  if (named !== undefined) {
    // Whoever set the variable chose the folders above this one (on macOS /tmp is itself a link). The one they named must be a folder.
    // resolve() takes a slash off its end: with one, the system would look through a link there.
    const plain = resolve(named);
    if (at(plain) === undefined) mkdirSync(plain, { recursive: true });
    const looked = at(plain);
    if (looked?.isDirectory() !== true) return false;
    process.chdir(plain);
    return same(looked, statSync(".", { bigint: true }));
  }
  // From the project down, one folder at a time: making both at once would make them on the far side of a link.
  process.chdir(project);
  return into(".grooph") && into("events");
}

function main(input) {
  const harness = str(process.argv[2]) ?? "unknown";
  const payload = JSON.parse(input);
  // An own key only: "constructor" is on every object, and is no event.
  const event = Object.hasOwn(EVENT, payload.hook_event_name) ? EVENT[payload.hook_event_name] : undefined;
  const session = str(payload.session_id);
  if (!event || !session) return;

  // The project is where this file was installed: <project>/.grooph/hooks/grooph-event.mjs.
  // GROOPH_EVENTS_DIR moves the events only; the project test below still applies.
  const project = real(resolve(dirname(fileURLToPath(import.meta.url)), "..", ".."));
  const cwd = str(payload.cwd);
  const claudeProject = str(process.env.CLAUDE_PROJECT_DIR);
  const here = (claudeProject !== undefined && real(claudeProject) === project) || (cwd !== undefined && inside(real(cwd), project));
  // A session working somewhere else (Codex writing its memories in the background fires user-level hooks too) is not this project's.
  if (!here) return;

  const line = { v: 1, t: new Date().toISOString(), harness, event, session };
  const agent = str(payload.agent_id);
  if (agent) line.agent = agent;
  const type = str(payload.agent_type);
  if (type) line.type = type;
  if (event === "tool") {
    const tool = str(payload.tool_name);
    if (tool) line.tool = tool;
    // Claude Code's Agent tool returns the id of the subagent it started: the one fact kept from a tool result.
    const response = payload.tool_response;
    const spawned = response && typeof response === "object" ? str(response.agentId) : undefined;
    if (spawned && /^[A-Za-z0-9._-]{1,128}$/.test(spawned)) line.spawned = spawned;
  }
  const model = str(payload.model);
  if (model) line.model = model;
  if (cwd && !agent) line.cwd = cwd;
  if (event === "subagent-stop") {
    const transcript = str(payload.agent_transcript_path);
    if (transcript) line.transcript = transcript;
  }

  if (!inEventsFolder(project)) return;
  // By its name in the folder now stood in, which nothing done to that folder's name can lead away.
  const file = `${/^[A-Za-z0-9._-]{1,128}$/.test(session) ? session : Buffer.from(session).toString("hex").slice(0, 64)}.jsonl`;
  // The session's file is a file of its own, or is not there yet: not a link, and not a pipe that would hold this process.
  const is = at(file);
  if (is !== undefined && !is.isFile()) return;
  // O_NOFOLLOW (macOS, Linux) has the system refuse a link as it opens the file, whatever stood there a moment ago;
  // O_NONBLOCK keeps a pipe put there in that moment from holding this process.
  const fd = openSync(file, constants.O_RDWR | constants.O_APPEND | constants.O_CREAT | (constants.O_NOFOLLOW ?? 0) | (constants.O_NONBLOCK ?? 0), 0o666);
  try {
    const opened = fstatSync(fd, { bigint: true });
    // What was opened is what stands at that name now, and it has no other name. A file with a second name (a hard
    // link) may be someone else's file, and so may one whose second name was taken away a moment ago: neither gets a line.
    const named = at(file);
    if (!(opened.isFile() && named?.isFile() === true && named.nlink === 1n && same(named, opened))) return;
    // Those looks cannot be made in one instant, so a second name put on and taken off in a loop can slip between
    // them. What it then reaches must already begin as a file of these lines does: nothing else is ever added to.
    if (opened.size > 0n) {
      const head = Buffer.alloc(OURS.length);
      if (readSync(fd, head, 0, head.length, 0) !== head.length || head.toString() !== OURS) return;
    }
    // One short line, appended in one write: lines from hooks running at the same moment do not interleave.
    writeSync(fd, `${JSON.stringify(line)}\n`);
  } finally {
    closeSync(fd);
  }
}

let input = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => {
  input += chunk;
});
process.stdin.on("end", () => {
  try {
    main(input);
  } catch {
    // An observer that cannot write must not be heard from.
  }
  process.exit(0);
});
process.stdin.on("error", () => process.exit(0));
