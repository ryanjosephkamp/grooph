/**
 * Session events (docs/subagents.md; amendment A-012): what a harness's hooks
 * saw, one JSON line per event, appended to a file by a hook that never
 * blocks and writes nothing the harness reads back. From those lines alone
 * this module says which sessions exist, which subagents each has started,
 * and which are still running. It reads; nothing here runs or steers anything.
 *
 * The shape is harness-neutral. Claude Code and Codex both tell a hook the
 * session id, and, for a subagent, its id and type; this is the common part.
 * No prompt, tool input, tool result or reply is ever in an event: the file
 * says that something ran, not what it said.
 */

import type { Graph, HarnessId, Id } from "./types.js";

export const EVENTS_VERSION = 1;

export type SessionEventKind =
  | "session-start"
  | "session-end"
  /** a prompt reached the main session: it is working */
  | "turn-start"
  /** the main session finished its reply: it is waiting */
  | "turn-end"
  | "subagent-start"
  | "subagent-stop"
  /** a tool call finished, in the main session or inside a subagent */
  | "tool";

export type SessionEvent = {
  v: typeof EVENTS_VERSION;
  /** when the hook ran, from its machine's clock, ISO 8601 */
  t: string;
  harness: HarnessId;
  event: SessionEventKind;
  /** the harness's own id for the session; a subagent's events carry its parent session's */
  session: string;
  /** the subagent: on its start and stop, and on a tool call made inside it */
  agent?: string;
  /** the subagent's type or role, as the harness names it */
  type?: string;
  /** the tool's name, on a `tool` event */
  tool?: string;
  /** the subagent a spawn tool call returned, where the harness says: ties a child to the agent that started it */
  spawned?: string;
  model?: string;
  /** the session's working directory */
  cwd?: string;
  /** where the harness keeps the subagent's transcript, on its stop; a path on that machine */
  transcript?: string;
};

const KINDS: readonly string[] = ["session-start", "session-end", "turn-start", "turn-end", "subagent-start", "subagent-stop", "tool"];

export type EventIssue = { line: number; message: string };

const text = (v: unknown): string | undefined => (typeof v === "string" && v !== "" ? v : undefined);

/**
 * Read an events file. Line-tolerant, like run notes: a line that is not an
 * event is an issue with its number, never a throw, because the file is
 * appended to while it is read and its last line may be half written.
 */
export function parseEvents(input: string): { events: SessionEvent[]; issues: EventIssue[] } {
  const events: SessionEvent[] = [];
  const issues: EventIssue[] = [];
  input.split("\n").forEach((raw, i) => {
    const line = raw.trim();
    if (line === "") return;
    let json: unknown;
    try {
      json = JSON.parse(line);
    } catch {
      issues.push({ line: i + 1, message: "not JSON" });
      return;
    }
    if (typeof json !== "object" || json === null || Array.isArray(json)) return void issues.push({ line: i + 1, message: "not an object" });
    const r = json as Record<string, unknown>;
    if (typeof r["v"] === "number" && r["v"] > EVENTS_VERSION) return void issues.push({ line: i + 1, message: `written by a newer grooph (events format ${r["v"]})` });
    const t = text(r["t"]);
    const session = text(r["session"]);
    const event = text(r["event"]);
    const harness = text(r["harness"]);
    if (!t || Number.isNaN(Date.parse(t))) return void issues.push({ line: i + 1, message: "no timestamp" });
    if (!session) return void issues.push({ line: i + 1, message: "no session id" });
    if (!event || !KINDS.includes(event)) return void issues.push({ line: i + 1, message: `unknown event ${JSON.stringify(r["event"])}` });
    const out: SessionEvent = { v: EVENTS_VERSION, t, harness: harness ?? "unknown", event: event as SessionEventKind, session };
    for (const key of ["agent", "type", "tool", "spawned", "model", "cwd", "transcript"] as const) {
      const value = text(r[key]);
      if (value !== undefined) out[key] = value;
    }
    events.push(out);
  });
  return { events, issues };
}

// ─── what is running ──────────────────────────────────────────────────────

export type LiveAgent = {
  id: string;
  /** its type or role; "subagent" when the harness did not say */
  type: string;
  /** the agent that started it, when the harness said; absent for one the main session started, or when unknown */
  parent?: string;
  state: "running" | "done";
  started: string;
  /** its last stop; a subagent that is resumed stops more than once */
  ended?: string;
  /** how many times it has stopped */
  stops: number;
  /** tool calls seen inside it */
  tools: number;
  lastTool?: string;
  /** the time of the last thing seen from it */
  lastAt: string;
  model?: string;
  transcript?: string;
};

export type LiveSession = {
  id: string;
  harness: HarnessId;
  /** the name this session's file was given when it was read: a lane, a machine, a project */
  source?: string;
  cwd?: string;
  model?: string;
  /** working: a prompt is being answered or a subagent is running. waiting: the last reply ended. ended: the session closed. */
  state: "working" | "waiting" | "ended";
  started: string;
  lastAt: string;
  ended?: string;
  /** tool calls seen in the main session itself */
  tools: number;
  lastTool?: string;
  agents: LiveAgent[];
};

/** Everything a live view shows, as one JSON value: what `grooph watch` serves and `grooph sessions --json` prints. */
export type LiveView = {
  groophLive: 0;
  /** when this was put together, from the reader's clock */
  at: string;
  sessions: LiveSession[];
  /** lines that could not be read, per source */
  issues?: { source: string; line: number; message: string }[];
};

/**
 * The sessions a list of events describes, each with its subagents in the
 * order they started. Events are taken in the order given (append order), and
 * may come from several files: sessions are told apart by harness and id.
 */
export function summarizeSessions(events: readonly (SessionEvent & { source?: string })[]): LiveSession[] {
  const sessions = new Map<string, LiveSession>();
  const agents = new Map<string, LiveAgent>(); // by session key + agent id
  const turnOpen = new Map<string, boolean>();

  for (const e of events) {
    const key = `${e.harness}\u0000${e.session}`;
    let s = sessions.get(key);
    if (!s) {
      s = { id: e.session, harness: e.harness, state: "working", started: e.t, lastAt: e.t, tools: 0, agents: [] };
      if (e.source !== undefined) s.source = e.source;
      sessions.set(key, s);
      turnOpen.set(key, true);
    }
    if (e.t > s.lastAt) s.lastAt = e.t;
    if (e.cwd !== undefined && s.cwd === undefined && e.agent === undefined) s.cwd = e.cwd;
    if (e.model !== undefined && e.agent === undefined) s.model = e.model;

    const agent = (id: string): LiveAgent => {
      const k = `${key}\u0000${id}`;
      let a = agents.get(k);
      if (!a) {
        // A stop or a tool call from a subagent whose start was not seen (the hook was installed mid-session) still names it.
        a = { id, type: e.type ?? "subagent", state: "running", started: e.t, stops: 0, tools: 0, lastAt: e.t };
        agents.set(k, a);
        s!.agents.push(a);
      }
      if (e.type !== undefined && a.type === "subagent") a.type = e.type;
      if (e.model !== undefined) a.model = e.model;
      if (e.t > a.lastAt) a.lastAt = e.t;
      return a;
    };

    switch (e.event) {
      case "session-start":
        delete s.ended;
        break;
      case "session-end":
        s.ended = e.t;
        break;
      case "turn-start":
        turnOpen.set(key, true);
        delete s.ended;
        break;
      case "turn-end":
        turnOpen.set(key, false);
        break;
      case "subagent-start": {
        if (e.agent === undefined) break;
        const a = agent(e.agent);
        a.state = "running";
        delete a.ended;
        break;
      }
      case "subagent-stop": {
        if (e.agent === undefined) break;
        const a = agent(e.agent);
        a.state = "done";
        a.ended = e.t;
        a.stops += 1;
        if (e.transcript !== undefined) a.transcript = e.transcript;
        break;
      }
      case "tool": {
        if (e.agent !== undefined) {
          const a = agent(e.agent);
          a.tools += 1;
          if (e.tool !== undefined) a.lastTool = e.tool;
          // Work seen from a subagent after its stop means it was resumed.
          if (a.state === "done" && a.ended !== undefined && e.t > a.ended) a.state = "running";
        } else {
          s.tools += 1;
          if (e.tool !== undefined) s.lastTool = e.tool;
        }
        if (e.spawned !== undefined) {
          const child = agent(e.spawned);
          if (e.agent !== undefined && e.agent !== e.spawned) child.parent = e.agent;
        }
        break;
      }
    }
  }

  for (const [key, s] of sessions) {
    const running = s.agents.some((a) => a.state === "running");
    s.state = s.ended !== undefined && !running ? "ended" : running || turnOpen.get(key) ? "working" : "waiting";
  }
  return [...sessions.values()];
}

/** One line for a session: "claude-code · working · 2 running, 3 done". */
export function sessionLine(s: LiveSession): string {
  const running = s.agents.filter((a) => a.state === "running").length;
  const done = s.agents.length - running;
  const parts = [s.harness, s.state];
  if (s.agents.length === 0) parts.push("no subagents yet");
  else parts.push(`${running} running, ${done} done`);
  return parts.join(" · ");
}

/** Seconds between two ISO times, never negative. */
export const secondsBetween = (from: string, to: string): number => Math.max(0, Math.round((Date.parse(to) - Date.parse(from)) / 1000));

/** A duration as a person says it: "8 s", "3 min 20 s", "1 h 4 min". */
export function durationText(seconds: number): string {
  if (seconds < 60) return `${seconds} s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)} min${seconds % 60 ? ` ${seconds % 60} s` : ""}`;
  return `${Math.floor(seconds / 3600)} h${Math.floor((seconds % 3600) / 60) ? ` ${Math.floor((seconds % 3600) / 60)} min` : ""}`;
}

// ─── a run, seen through its hooks ────────────────────────────────────────

/** What the hooks saw of one graph node: how many of its subagents are running now, and how many have run. */
export type NodeLive = { running: number; runs: number; lastStarted?: string; lastEnded?: string };

/**
 * A graph's nodes as the hooks saw them. A package names each agent node's
 * subagent `<graph-id>--<node-id>` (docs/targets/claude-code.md), so a
 * subagent's type says which node it is. Events from before `since` (the
 * run's first note, say) are left out, so an earlier run of the same graph in
 * the same session does not light this one.
 */
export function nodesLive(sessions: readonly LiveSession[], graph: Graph, since?: string): Record<Id, NodeLive> {
  const prefix = `${graph.id}--`;
  const ids = new Set(graph.nodes.map((n) => n.id));
  const out: Record<Id, NodeLive> = {};
  for (const s of sessions) {
    for (const a of s.agents) {
      if (!a.type.startsWith(prefix)) continue;
      const id = a.type.slice(prefix.length);
      if (!ids.has(id)) continue;
      if (since !== undefined && a.started < since && (a.ended ?? a.lastAt) < since) continue;
      const n = (out[id] ??= { running: 0, runs: 0 });
      n.runs += 1;
      if (a.state === "running") n.running += 1;
      if (n.lastStarted === undefined || a.started > n.lastStarted) n.lastStarted = a.started;
      if (a.ended !== undefined && (n.lastEnded === undefined || a.ended > n.lastEnded)) n.lastEnded = a.ended;
    }
  }
  return out;
}
