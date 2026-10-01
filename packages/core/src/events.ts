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

import type { RunSummary } from "./runs.js";
import type { Graph, HarnessId, Id, OperationMap } from "./types.js";

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
  | "tool"
  /** said by a lead through grooph's MCP server, not seen by a hook: the subagents it means to start */
  | "plan"
  /** said by a lead through grooph's MCP server: a short note for whoever is watching */
  | "note";

/** One line of a declared plan: a kind of subagent, what it is for, and how many. */
export type PlannedAgent = { type: string; purpose?: string; count?: number };

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
  /** on a `plan`: its title; on a `note`: the note. The only text in an events folder, and only because a lead chose to say it. */
  text?: string;
  /** on a `plan`: the subagents the lead means to start */
  agents?: PlannedAgent[];
};

/** The longest a note or a plan's title may be; longer text is cut. A note is a line for a person, not a transcript. */
export const SAID_MAX = 600;

const KINDS: readonly string[] = ["session-start", "session-end", "turn-start", "turn-end", "subagent-start", "subagent-stop", "tool", "plan", "note"];

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
    // Text is read only on the two kinds a lead writes on purpose; a hook's line has nowhere to carry any.
    if (out.event === "plan" || out.event === "note") {
      const said = text(r["text"]);
      if (said !== undefined) out.text = said.slice(0, SAID_MAX);
      if (out.event === "plan" && Array.isArray(r["agents"])) {
        out.agents = (r["agents"] as unknown[]).slice(0, 50).flatMap((a): PlannedAgent[] => {
          if (typeof a !== "object" || a === null) return [];
          const type = text((a as Record<string, unknown>)["type"]);
          if (!type) return [];
          const purpose = text((a as Record<string, unknown>)["purpose"]);
          const count = (a as Record<string, unknown>)["count"];
          return [{ type: type.slice(0, 120), ...(purpose ? { purpose: purpose.slice(0, SAID_MAX) } : {}), ...(typeof count === "number" && Number.isInteger(count) && count > 1 && count <= 500 ? { count } : {}) }];
        });
      }
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

/** A plan a lead declared, with how much of it the hooks have seen happen. */
export type LivePlan = {
  t: string;
  title?: string;
  agents: (PlannedAgent & {
    /** subagents of this type the hooks saw start after the plan was declared */
    started: number;
    running: number;
  })[];
  /** subagents that started after the plan and are of no type it named */
  unplanned: string[];
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
  /** what its lead declared through the MCP server, newest last, each with what happened since */
  plans?: LivePlan[];
  /** what its lead noted through the MCP server */
  notes?: { t: string; text: string }[];
};

/** Everything a live view shows, as one JSON value: what `grooph watch` serves and `grooph sessions --json` prints. */
export type LiveView = {
  groophLive: 0;
  /** when this was put together, from the reader's clock */
  at: string;
  sessions: LiveSession[];
  /** lines that could not be read, per source */
  issues?: { source: string; line: number; message: string }[];
  /** the operation map these sessions belong on, when the reader was given one (`grooph watch --map`) */
  map?: OperationMap;
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
  const said: (SessionEvent & { source?: string })[] = [];

  for (const e of events) {
    // What a lead said is set beside what the hooks saw, once the sessions are known.
    if (e.event === "plan" || e.event === "note") {
      said.push(e);
      continue;
    }
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
        // A stop with no type from an agent never seen starting is the harness's own helper (Claude Code runs
        // internal agents for prompt suggestions and side questions, and reports their stops with an empty type).
        if (e.type === undefined && !agents.has(`${key}\u0000${e.agent}`)) break;
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

  // A plan or a note belongs to the session it names. The MCP server is not always told a session id, so one that
  // names no known session goes to the session of the same source that had most recently started when it was said.
  // Said with no session to belong to (no hook installed), it makes a session of its own, so it is still shown.
  const list = [...sessions.values()];
  for (const e of said) {
    let s = list.find((x) => x.id === e.session && x.harness === e.harness) ?? list.find((x) => x.id === e.session);
    if (!s) {
      const near = list.filter((x) => x.source === e.source && x.started <= e.t).sort((a, b) => (a.started < b.started ? 1 : -1));
      s = near[0];
    }
    if (!s) {
      s = { id: e.session, harness: e.harness, state: "waiting", started: e.t, lastAt: e.t, tools: 0, agents: [] };
      if (e.source !== undefined) s.source = e.source;
      if (e.cwd !== undefined) s.cwd = e.cwd;
      list.push(s);
    }
    if (e.event === "note") {
      if (e.text !== undefined) (s.notes ??= []).push({ t: e.t, text: e.text });
    } else {
      (s.plans ??= []).push({ t: e.t, ...(e.text !== undefined ? { title: e.text } : {}), agents: (e.agents ?? []).map((a) => ({ ...a, started: 0, running: 0 })), unplanned: [] });
    }
  }
  // Each plan against what started after it, up to the next plan: a lead that re-plans is judged on its latest plan.
  for (const s of list) {
    const plans = s.plans ?? [];
    plans.forEach((plan, i) => {
      const until = plans[i + 1]?.t;
      const since = s.agents.filter((a) => a.started >= plan.t && (until === undefined || a.started < until));
      for (const a of since) {
        const planned = plan.agents.find((p) => p.type === a.type);
        if (planned) {
          planned.started += 1;
          if (a.state === "running") planned.running += 1;
        } else if (!plan.unplanned.includes(a.type)) plan.unplanned.push(a.type);
      }
    });
  }
  return list;
}

/** One line for a plan's progress: "2 of 3 started, 1 running; not in the plan: Explore". */
export function planLine(plan: LivePlan): string {
  const wanted = plan.agents.reduce((n, a) => n + (a.count ?? 1), 0);
  const started = plan.agents.reduce((n, a) => n + Math.min(a.started, a.count ?? 1), 0);
  const running = plan.agents.reduce((n, a) => n + a.running, 0);
  const extra = plan.agents.filter((a) => a.started > (a.count ?? 1)).map((a) => `${a.started - (a.count ?? 1)} more ${a.type}`);
  const outside = [...extra, ...plan.unplanned];
  return `${started} of ${wanted} started${running > 0 ? `, ${running} running` : ""}${outside.length > 0 ? `; not in the plan: ${outside.join(", ")}` : ""}`;
}

/** One line for a session: "claude-code · working · 2 running, 3 done". */
/**
 * How long a session may say nothing before a view stops calling it "working". A record is as fresh as the last
 * line that reached the reader: a lane's events pushed mid-session never say that its turn ended or that it closed,
 * and a session whose machine went away never says so either. Past this, a view says when it was last seen.
 */
export const QUIET_AFTER_SECONDS = 30 * 60;

/** Whether a session that has not ended has gone quiet by `at`: nothing was heard from it for half an hour. */
export const isQuiet = (s: Pick<LiveSession, "state" | "lastAt">, at: string | undefined): boolean =>
  at !== undefined && s.state !== "ended" && secondsBetween(s.lastAt, at) >= QUIET_AFTER_SECONDS;

/**
 * One line for a session. With `at` (when the record was read), a session gone quiet is said to be "last seen",
 * with the state it was in then, and its unfinished subagents are "not seen to finish" rather than "running".
 */
export function sessionLine(s: LiveSession, at?: string): string {
  const running = s.agents.filter((a) => a.state === "running").length;
  const done = s.agents.length - running;
  const quiet = isQuiet(s, at);
  const parts = [s.harness, quiet ? `last seen ${durationText(secondsBetween(s.lastAt, at!))} ago, ${s.state} then` : s.state];
  if (s.agents.length === 0) parts.push("no subagents yet");
  else parts.push(quiet && running > 0 ? `${running} not seen to finish, ${done} done` : `${running} running, ${done} done`);
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

/**
 * A run's summary with what the hooks saw laid over it: a node whose
 * subagent is running now is `running`, whatever the lead has or has not
 * written yet. Nothing else changes: an outcome is the lead's to state, and a
 * hook cannot know one.
 */
export function overlayRun(summary: RunSummary, live: Record<Id, NodeLive>): RunSummary {
  const nodes = { ...summary.nodes };
  let changed = false;
  for (const [id, seen] of Object.entries(live)) {
    const node = nodes[id];
    if (!node || seen.running === 0 || node.state === "running") continue;
    nodes[id] = { ...node, state: "running", runs: Math.max(node.runs, seen.runs) };
    changed = true;
  }
  return changed ? { ...summary, nodes } : summary;
}

// ─── an operation map, seen through its sessions' hooks ───────────────────

/** What the hooks saw of one session on a map: every recorded session read under that map session's name, summed. */
export type MapSessionLive = {
  /** recorded sessions under this name */
  sessions: number;
  working: number;
  waiting: number;
  ended: number;
  agentsRunning: number;
  agentsDone: number;
  /** the last thing seen from any of them */
  lastAt: string;
  /** of those not ended, how many have gone quiet (`isQuiet`); they are not counted as working or waiting */
  quiet?: number;
};

/**
 * A map's sessions as the hooks saw them. The tie is the name a source was
 * read under: events read as `operator=<source>` belong to the map session
 * whose id is `operator` (docs/operation-map.md §4b). The map says who
 * exists; the events say who is at work. A session on the map with no source
 * of that name has no entry, and is drawn as the map alone would draw it.
 */
export function mapLive(sessions: readonly LiveSession[], map: OperationMap, at?: string): Record<Id, MapSessionLive> {
  const ids = new Set(map.sessions.map((s) => s.id));
  const out: Record<Id, MapSessionLive> = {};
  for (const s of sessions) {
    if (s.source === undefined || !ids.has(s.source)) continue;
    const m = (out[s.source] ??= { sessions: 0, working: 0, waiting: 0, ended: 0, agentsRunning: 0, agentsDone: 0, lastAt: s.lastAt });
    m.sessions += 1;
    const quiet = isQuiet(s, at);
    if (quiet) m.quiet = (m.quiet ?? 0) + 1;
    else m[s.state] += 1;
    for (const a of s.agents) {
      // A subagent a quiet session never reported as finished is not running, as far as anyone can tell.
      if (a.state === "running" && !quiet) m.agentsRunning += 1;
      else if (a.state !== "running") m.agentsDone += 1;
    }
    if (s.lastAt > m.lastAt) m.lastAt = s.lastAt;
  }
  return out;
}

/** One line for a map session's live state: "working · 3 subagents running, 5 done" or "2 of 12 working · …". */
export function mapLiveLine(live: MapSessionLive, at?: string): string {
  const quiet = live.quiet ?? 0;
  const of = (n: number, word: string): string => (live.sessions > 1 ? `${n} of ${live.sessions} ${word}` : word);
  const seen = at !== undefined ? `last seen ${durationText(secondsBetween(live.lastAt, at))} ago` : "gone quiet";
  const state = live.working > 0 ? of(live.working, "working") : live.waiting > 0 ? of(live.waiting, "waiting") : quiet > 0 ? seen : "ended";
  // Gone quiet, the line says only when it was last seen: a count of subagents from a stale record would read as news.
  const agents = live.agentsRunning + live.agentsDone === 0 || (quiet > 0 && live.working + live.waiting === 0) ? "" : ` · ${live.agentsRunning} running, ${live.agentsDone} done`;
  return `${state}${agents}`;
}
