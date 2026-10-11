/**
 * What Claude Code itself keeps beside a session, read for the graph of what was seen (`seen.ts` in core;
 * decision 0032, point 3). For one session id it says, of each subagent: its type, its depth, the subagent that
 * started it, whether it was asked for in the background or the foreground, the model its call named, the model
 * that answered, each run's first and last time, and how each run ended.
 *
 * **It keeps nothing else.** The files it opens hold everything a session read, wrote and said. From a subagent's
 * `agent-<id>.meta.json` it takes five fields and leaves the description and the worktree's path and branch where
 * they are; the tool-use id it reads only to find where a foreground call returned, and does not return. From a
 * transcript it takes each line's time, whether the line begins a run, the name
 * of the model on a reply, and whether a line carries the result of the call that started a foreground subagent.
 * From the main transcript it takes, of the harness's notice that a background subagent's run is over, the
 * subagent's id, one of three words for how it ended, and the time. No prompt, reply, tool input, tool result,
 * path or description is returned, logged or put in an error.
 *
 * What it returns is ids, times, a depth, one of two words for the shape, one of four for an ending, and three
 * names: a subagent's type, the model asked for and the model that answered. A name is kept only if it is shaped
 * like one (letters, digits and `. _ : @ / - [ ]`, no space, at most 100 characters). The type and the model asked
 * for are what the call that started the subagent named; that they are names of agents and models, and not words
 * a session made up, rests on the harness refusing a call that names neither.
 *
 * Its limits:
 *
 * - The main transcript does not say who wrote a line it queued: text typed while the session was busy is kept in
 *   the same shape as the harness's own notice. So a message that begins exactly as a notice does, names one of
 *   the session's subagents, and is typed after that subagent's last line would be read as its ending.
 * - A foreground subagent's run is taken to have ended when the call that started it returned: as completed unless
 *   the result is marked an error, which is read as ended with no more said.
 * - Which run an ending is of is a matter of time, as it is in `seen.ts`: a notice names the subagent and not the
 *   run. It is the earliest run with no ending that had written its last line within half a minute before, and
 *   otherwise the latest that had written its last line at all. Where a subagent has two runs that close it is a
 *   judgment; in the records its runs were never less than 130 s apart.
 * - A session whose id is in two project folders: each subagent is read whole from the first folder that holds
 *   any file of it. A line longer than 64 MB is passed over, and so is a first line that follows a byte-order mark.
 *
 * It reads on the machine it runs on, when it is asked, and writes nothing. Under `projects/` it follows no link
 * and opens nothing but plain files. The shapes are as Claude Code 2.1.271 to 2.1.295 wrote them
 * (`handoffs/0104-the-live-graph/RECORDS.md`); they are not a documented interface, and a file that is not in
 * that shape is passed over, never an error.
 */

import { closeSync, constants, fstatSync, lstatSync, openSync, readFileSync, readSync, readdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

import type { HarnessAgent, HarnessRun, HarnessRunEnd } from "@grooph/core";

export type ClaudeFilesOptions = {
  /** where `CLAUDE_CONFIG_DIR` is read from; `process.env` when absent */
  env?: Record<string, string | undefined>;
  /** the home folder, for `~/.claude`; the person's own when absent */
  home?: string;
  /** look only in the project folders this says yes to, by the folder's name under `projects/` */
  only?: (folder: string) => boolean;
};

/** Where Claude Code keeps its sessions: `$CLAUDE_CONFIG_DIR/projects`, or `~/.claude/projects`. */
export function claudeProjectsDir(options: ClaudeFilesOptions = {}): string {
  const config = (options.env ?? process.env)["CLAUDE_CONFIG_DIR"];
  return join(config !== undefined && config !== "" ? config : join(options.home ?? homedir(), ".claude"), "projects");
}

const ID = /^[A-Za-z0-9_-]{1,64}$/;
const SESSION = /^[A-Za-z0-9._-]{1,128}$/;
/** A name as a harness writes one: a type (`general-purpose`, `plugin:agent`) or a model (`opus`, `claude-opus-5-5`). No space in it, so no sentence. */
const NAME = /^[A-Za-z0-9][A-Za-z0-9._:@/[\]-]{0,99}$/;
const name = (v: unknown): string | undefined => (typeof v === "string" && NAME.test(v) ? v : undefined);
/** A time as the harness writes one, given back in one form. */
const TIME = /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(\.\d{1,9})?(Z|[+-]\d\d:?\d\d)$/;
const time = (v: unknown): string | undefined => {
  if (typeof v !== "string" || !TIME.test(v)) return undefined;
  const n = Date.parse(v);
  return Number.isNaN(n) ? undefined : new Date(n).toISOString();
};
/** How the harness's notice that a background task is over begins: whose it was, then how it ended. */
const NOTICE = /^\s*<task-notification>\s*<task-id>([A-Za-z0-9_-]{1,64})<\/task-id>\s*(?:<tool-use-id>[^<]{0,300}<\/tool-use-id>\s*)?(?:<output-file>[^<]{0,4000}<\/output-file>\s*)?<status>(completed|failed|killed)<\/status>/;

const isPlainFile = (path: string): boolean => {
  try {
    return lstatSync(path).isFile();
  } catch {
    return false;
  }
};
const isPlainDir = (path: string): boolean => {
  try {
    return lstatSync(path).isDirectory();
  } catch {
    return false;
  }
};
/**
 * A plain file, opened to read: never a link (which could lead out of the folder), nor a pipe or a device (which
 * could hold a read for ever). The system is asked not to follow a link and not to wait, so that one put in the
 * file's place between the look and the opening is refused or does not hang it (where the system has no such
 * request to make, as on Windows, the look before and the look after are what holds).
 */
function openPlain(path: string): number | undefined {
  if (!isPlainFile(path)) return undefined;
  let fd: number | undefined;
  try {
    fd = openSync(path, constants.O_RDONLY | (constants.O_NONBLOCK ?? 0) | (constants.O_NOFOLLOW ?? 0));
    if (fstatSync(fd).isFile()) return fd;
  } catch {
    // Not there any more, or not ours to read: passed over.
  }
  if (fd !== undefined) closeSync(fd);
  return undefined;
}

/** A plain file's text, where it is one and is no larger than `largest` bytes; otherwise nothing. */
export function readPlainFile(path: string, largest: number): string | undefined {
  const fd = openPlain(path);
  if (fd === undefined) return undefined;
  try {
    return fstatSync(fd).size > largest ? undefined : readFileSync(fd, "utf8");
  } catch {
    return undefined;
  } finally {
    closeSync(fd);
  }
}

/** How long after a run's last line the harness's notice of its end may be written and still be looked for among the runs before the newest: 8.7 s at most, in the records. */
const NEAR_MS = 30_000;

/** A line longer than this is passed over unread: nothing this reader wants is that long. */
const LONGEST_LINE = 64_000_000;

/** Each line of a file, as bytes, without holding the file in memory: a main transcript can be hundreds of megabytes. */
function eachLine(file: string, visit: (line: Buffer) => void): void {
  const fd = openPlain(file);
  if (fd === undefined) return;
  try {
    const chunk = Buffer.allocUnsafe(1 << 20);
    let rest: Buffer[] = [];
    // The length of the line in hand so far; past the limit its bytes are dropped as they come.
    let held = 0;
    for (;;) {
      const n = readSync(fd, chunk, 0, chunk.length, null);
      if (n === 0) break;
      let from = 0;
      for (;;) {
        const end = chunk.subarray(0, n).indexOf(10, from);
        if (end === -1) break;
        if (held + (end - from) <= LONGEST_LINE) visit(rest.length > 0 ? Buffer.concat([...rest, chunk.subarray(from, end)]) : chunk.subarray(from, end));
        rest = [];
        held = 0;
        from = end + 1;
      }
      if (from < n) {
        held += n - from;
        if (held <= LONGEST_LINE) rest.push(Buffer.from(chunk.subarray(from, n)));
        else rest = [];
      }
    }
    if (held > 0 && held <= LONGEST_LINE) visit(Buffer.concat(rest));
  } catch {
    // A file that stops being readable part way: what was read stands.
  } finally {
    closeSync(fd);
  }
}

const json = (line: Buffer): Record<string, unknown> | undefined => {
  try {
    const value: unknown = JSON.parse(line.toString("utf8"));
    return typeof value === "object" && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : undefined;
  } catch {
    return undefined;
  }
};

/**
 * The results a `user` line carries: the id of the call each answers, and what it says of how the call went.
 * `launched`: the harness says the call only started its subagent, which runs on in the background.
 */
function results(line: Record<string, unknown>): { call: string; how: "returned" | "error" | "launched" }[] {
  const content = (line["message"] as { content?: unknown } | null | undefined)?.content;
  if (line["type"] !== "user" || !Array.isArray(content)) return [];
  const status = (line["toolUseResult"] as { status?: unknown } | null | undefined)?.status;
  return content.flatMap((block: unknown) => {
    const b = block as { type?: unknown; tool_use_id?: unknown; is_error?: unknown } | null;
    if (b === null || typeof b !== "object" || b.type !== "tool_result" || typeof b.tool_use_id !== "string") return [];
    return [{ call: b.tool_use_id, how: b.is_error === true ? ("error" as const) : status === "async_launched" ? ("launched" as const) : ("returned" as const) }];
  });
}

type Found = { id: string; /** the `subagents/` folder it was found in */ folder: string; meta?: { type?: string; depth?: number; parent?: string; shape?: "background" | "foreground"; modelAsked?: string; call?: string }; runs: HarnessRun[]; model?: string };

/**
 * The folders that hold a session's files: each project folder with `<session>.jsonl` or `<session>/subagents/`
 * in it. A session with no such files is an empty answer.
 */
export function findClaudeSession(session: string, options: ClaudeFilesOptions = {}): { transcript?: string; subagents?: string }[] {
  if (!SESSION.test(session) || session === "." || session === "..") return [];
  const projects = claudeProjectsDir(options);
  let folders: string[];
  try {
    // A project's folder is a folder: a link standing where one would be is not looked into.
    folders = readdirSync(projects, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort();
  } catch {
    return [];
  }
  const out: { transcript?: string; subagents?: string }[] = [];
  for (const folder of folders) {
    if (options.only !== undefined && !options.only(folder)) continue;
    const transcript = join(projects, folder, `${session}.jsonl`);
    const subagents = join(projects, folder, session, "subagents");
    const found = { ...(isPlainFile(transcript) ? { transcript } : {}), ...(isPlainDir(join(projects, folder, session)) && isPlainDir(subagents) ? { subagents } : {}) };
    if (found.transcript !== undefined || found.subagents !== undefined) out.push(found);
  }
  return out;
}

/**
 * Every subagent of one session, as Claude Code's own files give it. Empty when the session has no such files, or
 * none can be read; never an error.
 */
export function readClaudeAgents(session: string, options: ClaudeFilesOptions = {}): HarnessAgent[] {
  const found = new Map<string, Found>();
  const places = findClaudeSession(session, options);
  /** Run endings met on the way: a time, the subagent, and how. */
  const endings: { agent: string; at: string; end: HarnessRunEnd }[] = [];

  for (const place of places) {
    if (place.subagents === undefined) continue;
    let files: string[];
    try {
      files = readdirSync(place.subagents).sort();
    } catch {
      continue;
    }
    // What the harness wrote down as it started each one. A subagent is read from the first folder that holds it.
    for (const file of files) {
      const id = /^agent-([^.]+)\.(meta\.json|jsonl)$/.exec(file)?.[1];
      if (id !== undefined && ID.test(id) && !found.has(id)) found.set(id, { id, folder: place.subagents, runs: [] });
    }
    for (const agent of found.values()) {
      if (agent.folder !== place.subagents) continue;
      const text = readPlainFile(join(place.subagents, `agent-${agent.id}.meta.json`), 1_000_000);
      if (text === undefined) continue;
      try {
        const meta = JSON.parse(text) as Record<string, unknown> | null;
        if (typeof meta !== "object" || meta === null) continue;
        const depth = meta["spawnDepth"];
        const parent = meta["parentAgentId"];
        const shape = meta["requestShape"];
        const call = meta["toolUseId"];
        agent.meta = {
          ...(name(meta["agentType"]) !== undefined ? { type: name(meta["agentType"])! } : {}),
          ...(typeof depth === "number" && Number.isInteger(depth) && depth > 0 && depth < 100 ? { depth } : {}),
          ...(typeof parent === "string" && ID.test(parent) ? { parent } : {}),
          ...(shape === "background" || shape === "foreground" ? { shape } : {}),
          ...(name(meta["model"]) !== undefined ? { modelAsked: name(meta["model"])! } : {}),
          // Kept only while reading, to find where a foreground call returned. It is not in what is returned.
          ...(typeof call === "string" && call.length > 0 && call.length <= 200 ? { call } : {}),
        };
      } catch {
        // A meta file that is not JSON: the subagent is still one, with nothing said of it.
      }
    }
  }

  /** A foreground subagent's run is over when the call that started it returns, in the transcript of whoever made it. */
  const waited = new Map<string, string>();
  for (const agent of found.values()) if (agent.meta?.shape === "foreground" && agent.meta.call !== undefined) waited.set(agent.meta.call, agent.id);
  /** `folder`: the `subagents/` folder the line's transcript belongs with. A line ends only a subagent kept in that folder. */
  const returned = (line: Record<string, unknown>, folder: string | undefined): void => {
    const at = time(line["timestamp"]);
    if (at === undefined) return;
    for (const result of results(line)) {
      const agent = waited.get(result.call);
      // An error is an end, and the files do not say of what kind. A call that only launched its subagent ended nothing.
      if (agent !== undefined && found.get(agent)!.folder === folder && result.how !== "launched") endings.push({ agent, at, end: result.how === "error" ? "ended" : "completed" });
    }
  };

  for (const agent of found.values()) {
    let run: HarnessRun | undefined;
    eachLine(join(agent.folder, `agent-${agent.id}.jsonl`), (bytes) => {
      const line = json(bytes);
      const at = time(line?.["timestamp"]);
      if (line === undefined || at === undefined) return;
      // A run begins with the transcript, and again at each message that resumed the subagent.
      const resumes = line["type"] === "user" && line["isMeta"] === true && (line["origin"] as { kind?: unknown } | null | undefined)?.kind === "coordinator";
      if (run === undefined || resumes) {
        run = { first: at, last: at };
        agent.runs.push(run);
      }
      if (at > run.last) run.last = at;
      if (line["type"] === "assistant") {
        // The harness writes a made-up name (`<synthetic>`) on a line it wrote itself, which is not shaped like a name.
        const model = name((line["message"] as { model?: unknown } | null | undefined)?.model);
        if (model !== undefined) agent.model = model;
      }
      if (waited.size > 0) returned(line, agent.folder);
    });
  }

  for (const place of places) {
    if (place.transcript === undefined || found.size === 0) continue;
    const notice = Buffer.from("<task-notification>");
    const answers = Buffer.from('"tool_use_id":"');
    /** Whether a line answers one of the calls waited for: each id after the key that names one is looked up, the line read once. */
    const answersOne = (bytes: Buffer): boolean => {
      for (let at = bytes.indexOf(answers); at !== -1; at = bytes.indexOf(answers, at + 1)) {
        const from = at + answers.length;
        const to = bytes.indexOf(34, from);
        if (to !== -1 && to - from <= 200 && waited.has(bytes.toString("utf8", from, to))) return true;
      }
      return false;
    };
    eachLine(place.transcript, (bytes) => {
      // Most of a main transcript is nothing to do with a subagent's end: a line is parsed only if it could be.
      const noticed = bytes.includes(notice);
      if (!noticed && (waited.size === 0 || !answersOne(bytes))) return;
      const line = json(bytes);
      if (line === undefined) return;
      returned(line, place.subagents);
      const content = line["content"];
      if (!noticed || line["type"] !== "queue-operation" || line["operation"] !== "enqueue" || typeof content !== "string") return;
      // The notice's own first tags and nothing after them: the summary and the result are the subagent's words, and
      // may quote a notice themselves.
      const head = NOTICE.exec(content);
      const agent = head?.[1];
      const end = head?.[2] as HarnessRunEnd | undefined;
      const at = time(line["timestamp"]);
      if (agent !== undefined && end !== undefined && at !== undefined && found.get(agent)?.folder === place.subagents) endings.push({ agent, at, end });
    });
  }

  // An ending is given to a run that had written its last line by then and has no ending yet: a run that wrote a
  // line after it had not ended, whatever a line in the transcript says. A notice is written within seconds of its
  // run's last line, and can be written after the same subagent has begun again: so of the runs that wrote their
  // last line within half a minute before, the earliest; and where there is none such (a subagent stopped long
  // after its last line), the latest.
  endings.sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : 0));
  for (const ending of endings) {
    const at = Date.parse(ending.at);
    let near: HarnessRun | undefined;
    let latest: HarnessRun | undefined;
    for (const r of found.get(ending.agent)!.runs) {
      const last = Date.parse(r.last);
      if (r.end !== undefined || Date.parse(r.first) > at || last > at + 1000) continue;
      latest = r;
      if (near === undefined && at - last <= NEAR_MS) near = r;
    }
    const run = near ?? latest;
    if (run !== undefined) run.end = ending.end;
  }

  return [...found.values()]
    .map(
      (agent): HarnessAgent => ({
        id: agent.id,
        ...(agent.meta?.type !== undefined ? { type: agent.meta.type } : {}),
        ...(agent.meta?.depth !== undefined ? { depth: agent.meta.depth } : {}),
        // A parent is one of this session's subagents, or it is not kept.
        ...(agent.meta?.parent !== undefined && found.has(agent.meta.parent) && agent.meta.parent !== agent.id ? { parent: agent.meta.parent } : {}),
        ...(agent.meta?.shape !== undefined ? { shape: agent.meta.shape } : {}),
        ...(agent.meta?.modelAsked !== undefined ? { modelAsked: agent.meta.modelAsked } : {}),
        ...(agent.model !== undefined ? { model: agent.model } : {}),
        runs: agent.runs,
      }),
    )
    .sort((a, b) => {
      const x = a.runs[0]?.first ?? "";
      const y = b.runs[0]?.first ?? "";
      return x < y ? -1 : x > y ? 1 : a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
    });
}
