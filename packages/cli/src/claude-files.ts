/**
 * What Claude Code itself keeps beside a session, read for the graph of what was seen (`seen.ts` in core;
 * decision 0032, point 3). For one session id it says, of each subagent: its type, its depth, the subagent that
 * started it, whether it was asked for in the background or the foreground, the model its call named, the model
 * that answered, each run's first and last time, and how each run ended.
 *
 * **It keeps nothing else.** The files it opens hold everything a session read, wrote and said. From a subagent's
 * `agent-<id>.meta.json` it takes five fields and leaves the description, the tool-use id and the worktree's path
 * and branch where they are. From a transcript it takes each line's time, whether the line begins a run, the name
 * of the model on a reply, and whether a line carries the result of the call that started a foreground subagent.
 * From the main transcript it takes, of the harness's notice that a background subagent's run is over, the
 * subagent's id, one of three words for how it ended, and the time. No prompt, reply, tool input, tool result,
 * path or description is returned, logged or put in an error.
 *
 * It reads on the machine it runs on, when it is asked, and writes nothing. The shapes are as Claude Code 2.1.271
 * to 2.1.295 wrote them (`handoffs/0104-the-live-graph/RECORDS.md`); they are not a documented interface, and a
 * file that is not in that shape is passed over, never an error.
 */

import { closeSync, openSync, readFileSync, readSync, readdirSync, statSync } from "node:fs";
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

const ID = /^[A-Za-z0-9_-]{1,128}$/;
const SESSION = /^[A-Za-z0-9._-]{1,128}$/;
/** A name as a harness writes one: a type or a model. One line, no control characters, not long. */
const name = (v: unknown): string | undefined => (typeof v === "string" && v.length > 0 && v.length <= 200 && !/[\u0000-\u001f\u007f-\u009f]/.test(v) ? v : undefined);
const time = (v: unknown): string | undefined => {
  if (typeof v !== "string" || v.length > 40) return undefined;
  const n = Date.parse(v);
  return Number.isNaN(n) ? undefined : new Date(n).toISOString();
};
const isFile = (path: string): boolean => {
  try {
    return statSync(path).isFile();
  } catch {
    return false;
  }
};
const isDir = (path: string): boolean => {
  try {
    return statSync(path).isDirectory();
  } catch {
    return false;
  }
};

/** How the harness's notice that a background task is over begins: whose it was, then how it ended. */
const NOTICE = /^\s*<task-notification>\s*<task-id>([A-Za-z0-9_-]{1,128})<\/task-id>\s*(?:<tool-use-id>[^<]{0,300}<\/tool-use-id>\s*)?(?:<output-file>[^<]{0,4000}<\/output-file>\s*)?<status>(completed|failed|killed)<\/status>/;

/** A line longer than this is passed over unread: nothing this reader wants is that long. */
const LONGEST_LINE = 64_000_000;

/** Each line of a file, as bytes, without holding the file in memory: a main transcript can be hundreds of megabytes. */
function eachLine(file: string, visit: (line: Buffer) => void): void {
  let fd: number;
  try {
    fd = openSync(file, "r");
  } catch {
    return;
  }
  try {
    const chunk = Buffer.allocUnsafe(1 << 20);
    let rest: Buffer[] = [];
    let held = 0;
    for (;;) {
      const n = readSync(fd, chunk, 0, chunk.length, null);
      if (n === 0) break;
      let from = 0;
      for (;;) {
        const end = chunk.subarray(0, n).indexOf(10, from);
        if (end === -1) break;
        if (held <= LONGEST_LINE) visit(rest.length > 0 ? Buffer.concat([...rest, chunk.subarray(from, end)]) : chunk.subarray(from, end));
        rest = [];
        held = 0;
        from = end + 1;
      }
      if (from < n) {
        held += n - from;
        // Past the limit the line's bytes are dropped as they come; only its length is kept, to know to pass it over.
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

/** The results a `user` line carries, as the ids of the calls they answer and whether each was an error. */
function results(line: Record<string, unknown>): { call: string; error: boolean }[] {
  const content = (line["message"] as { content?: unknown } | undefined)?.content;
  if (line["type"] !== "user" || !Array.isArray(content)) return [];
  return content.flatMap((block: unknown) => {
    const b = block as { type?: unknown; tool_use_id?: unknown; is_error?: unknown } | null;
    return b !== null && typeof b === "object" && b.type === "tool_result" && typeof b.tool_use_id === "string" ? [{ call: b.tool_use_id, error: b.is_error === true }] : [];
  });
}

type Found = { id: string; meta?: { type?: string; depth?: number; parent?: string; shape?: "background" | "foreground"; modelAsked?: string; call?: string }; runs: HarnessRun[]; model?: string };

/**
 * The folders that hold a session's files: each project folder with `<session>.jsonl` or `<session>/subagents/`
 * in it. A session with no such files is an empty answer.
 */
export function findClaudeSession(session: string, options: ClaudeFilesOptions = {}): { transcript?: string; subagents?: string }[] {
  if (!SESSION.test(session) || session === "." || session === "..") return [];
  const projects = claudeProjectsDir(options);
  let folders: string[];
  try {
    folders = readdirSync(projects).sort();
  } catch {
    return [];
  }
  const out: { transcript?: string; subagents?: string }[] = [];
  for (const folder of folders) {
    if (options.only !== undefined && !options.only(folder)) continue;
    const transcript = join(projects, folder, `${session}.jsonl`);
    const subagents = join(projects, folder, session, "subagents");
    const found = { ...(isFile(transcript) ? { transcript } : {}), ...(isDir(subagents) ? { subagents } : {}) };
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
    // What the harness wrote down as it started each one.
    for (const file of files) {
      const id = /^agent-([^.]+)\.meta\.json$/.exec(file)?.[1];
      if (id === undefined || !ID.test(id) || found.has(id)) continue;
      const agent: Found = { id, runs: [] };
      found.set(id, agent);
      try {
        const path = join(place.subagents, file);
        if (statSync(path).size > 1_000_000) continue;
        const meta = JSON.parse(readFileSync(path, "utf8")) as Record<string, unknown> | null;
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
    for (const file of files) {
      const id = /^agent-([^.]+)\.jsonl$/.exec(file)?.[1];
      if (id !== undefined && ID.test(id) && !found.has(id)) found.set(id, { id, runs: [] });
    }
  }

  /** A foreground subagent's run is over when the call that started it returns, in the transcript of whoever made it. */
  const waited = new Map<string, string>();
  for (const agent of found.values()) if (agent.meta?.shape === "foreground" && agent.meta.call !== undefined) waited.set(agent.meta.call, agent.id);
  const returned = (line: Record<string, unknown>): void => {
    const at = time(line["timestamp"]);
    if (at === undefined) return;
    for (const result of results(line)) {
      const agent = waited.get(result.call);
      // An error is an end, and the files do not say of what kind.
      if (agent !== undefined) endings.push({ agent, at, end: result.error ? "ended" : "completed" });
    }
  };

  for (const place of places) {
    if (place.subagents === undefined) continue;
    for (const agent of found.values()) {
      // One folder holds a subagent's transcript; were a second to, the first read stands.
      if (agent.runs.length > 0) continue;
      let run: HarnessRun | undefined;
      eachLine(join(place.subagents, `agent-${agent.id}.jsonl`), (bytes) => {
        const line = json(bytes);
        const at = time(line?.["timestamp"]);
        if (line === undefined || at === undefined) return;
        // A run begins with the transcript, and again at each message that resumed the subagent.
        const resumes = line["type"] === "user" && line["isMeta"] === true && (line["origin"] as { kind?: unknown } | undefined)?.kind === "coordinator";
        if (run === undefined || resumes) {
          run = { first: at, last: at };
          agent.runs.push(run);
        }
        if (at > run.last) run.last = at;
        if (line["type"] === "assistant") {
          const model = name((line["message"] as { model?: unknown } | undefined)?.model);
          // The harness writes a made-up name on a line it wrote itself (an error it reports as a reply).
          if (model !== undefined && !model.startsWith("<")) agent.model = model;
        }
        if (waited.size > 0) returned(line);
      });
    }
  }

  for (const place of places) {
    if (place.transcript === undefined || found.size === 0) continue;
    const calls = [...waited.keys()].map((call) => Buffer.from(call));
    const notice = Buffer.from("<task-notification>");
    eachLine(place.transcript, (bytes) => {
      // Most of a main transcript is nothing to do with a subagent's end: a line is parsed only if it could be.
      const noticed = bytes.includes(notice);
      if (!noticed && !calls.some((call) => bytes.includes(call))) return;
      const line = json(bytes);
      if (line === undefined) return;
      returned(line);
      const content = line["content"];
      if (!noticed || line["type"] !== "queue-operation" || line["operation"] !== "enqueue" || typeof content !== "string") return;
      // The notice's own first tags and nothing after them: the summary and the result are the subagent's words, and
      // may quote a notice themselves.
      const head = NOTICE.exec(content);
      const agent = head?.[1];
      const end = head?.[2] as HarnessRunEnd | undefined;
      const at = time(line["timestamp"]);
      if (agent !== undefined && end !== undefined && at !== undefined && found.has(agent)) endings.push({ agent, at, end });
    });
  }

  // Each ending belongs to the run that had last begun when it was written; a run keeps the first it is given.
  endings.sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : 0));
  for (const ending of endings) {
    const runs = found.get(ending.agent)!.runs;
    let run: HarnessRun | undefined;
    for (const r of runs) if (r.first <= ending.at) run = r;
    if (run !== undefined && run.end === undefined) run.end = ending.end;
  }

  return [...found.values()]
    .map(
      (agent): HarnessAgent => ({
        id: agent.id,
        ...(agent.meta?.type !== undefined ? { type: agent.meta.type } : {}),
        ...(agent.meta?.depth !== undefined ? { depth: agent.meta.depth } : {}),
        ...(agent.meta?.parent !== undefined ? { parent: agent.meta.parent } : {}),
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
