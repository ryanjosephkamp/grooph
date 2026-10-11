/**
 * A session as it was seen, as a graph (decision 0032, point 3; spec/contract.md, "Watching"): who exists, who
 * started whom, what is running or finished, on which model, and how that changed over time. It is drawn from two
 * records and from nothing else: the lines grooph's hook wrote (`events.ts`), and, when they were read, what the
 * harness's own files say of each subagent. No prompt is changed by a word to make it, and no model is asked
 * anything.
 *
 * It is one pure function: no clock, no file, no network. Reading a harness's files is the command line's work
 * (`packages/cli/src/claude-files.ts` for Claude Code); what it hands over is a `HarnessAgent` each, which any
 * harness's reader can fill.
 *
 * How the two records are put together:
 *
 * - **The hook's lines are the timeline.** A run begins at its start line and ends at its stop line. Where the hook
 *   has no line for something the harness's files hold (an agent from before the hook was installed, a run that
 *   failed and fired no stop), the harness's own time is used: a run's first line, and its last.
 * - **Every node, run and edge says where it came from**: the hook, the harness's files, or both. That is said of
 *   the records as they were read, not of the moment: it does not change as the moment is stepped. So is which of
 *   the harness's runs a start line belongs to. Read while a session runs, the newest thing may be in one record
 *   and not yet in the other (a start line is written up to a few seconds after its run's first line, a stop line
 *   up to ten after its last): a difference listed then may be gone at the next reading.
 * - **Where the records disagree, both are kept.** A node shows the hook's word where the hook has one, and
 *   `differs` lists the disagreement with both values. Two parents are two edges.
 * - **An edge is a fact with two ends.** A child whose parent no record has named yet has no edge yet: a hook
 *   learns who started a foreground child only when that child ends, which is why an edge carries both when it
 *   happened and when it became known. A view may hang such a node where it likes; the graph does not guess.
 * - **Neither record says who resumed an agent.** A `resumed` edge runs from the one that started it, which is who
 *   was handed its id. In the 39 resumed runs in the records read for slice 0104, each followed a message from its
 *   starter.
 *
 * What a session says of its own plan (`plan` and `note` lines) is not drawn here: that is slice 0105's, set beside
 * this graph and never in it.
 */

import type { SessionEvent } from "./events.js";
import type { HarnessId } from "./types.js";

/** How a run ended, as a harness's files say. `ended`: it did, and the files do not say how. */
export type HarnessRunEnd = "completed" | "failed" | "killed" | "ended";

/** One run of a subagent, as the harness's own files hold it: its first start, or one time it was resumed. */
export type HarnessRun = {
  /** the time of the run's first line */
  first: string;
  /** the time of its last line so far; of a run still going, the latest thing it did */
  last: string;
  /** how it ended; absent while the files do not say it has */
  end?: HarnessRunEnd;
};

/**
 * One subagent as a harness's own files give it. Read on the person's machine when they look, and neither stored
 * nor sent. It holds ids, names and times: never a prompt, a reply, a tool's input or result, a path or a
 * description. In Claude Code's files these are `agentType`, `spawnDepth`, `parentAgentId`, `requestShape`, the
 * call's `model`, and the `message.model` of its replies.
 */
export type HarnessAgent = {
  id: string;
  type?: string;
  /** 1 for a subagent the main session started, 2 for one that subagent started */
  depth?: number;
  /** the subagent that started it; absent for one the main session started */
  parent?: string;
  shape?: "background" | "foreground";
  /** the model the call named, when it named one */
  modelAsked?: string;
  /** the model that answered */
  model?: string;
  runs: readonly HarnessRun[];
};

export type SeenOptions = {
  /** what the harness's own files say of this session's subagents, when they were read; absent, the graph is from the hook's lines alone */
  harness?: readonly HarnessAgent[];
  /** a moment: the graph as it stood then. Absent: after the last change. */
  at?: string;
};

export type SeenSource = "hook" | "harness" | "both";

export type SeenRun = {
  /** when it began; absent when the run was first seen at its stop (it began before the hook was installed) */
  from?: string;
  /** when it ended; absent while it is open */
  to?: string;
  /** how it ended, where the harness's files say */
  end?: HarnessRunEnd;
  /** no end is on record, and it is not running: its session ended, or the same agent began again */
  notSeenToFinish?: true;
  source: SeenSource;
};

/** The main session: the first node of every graph that has one. */
export type SeenSession = {
  id: string;
  kind: "session";
  harness: HarnessId;
  depth: 0;
  /**
   * working: a prompt is being answered or a subagent is running. waiting: the last reply ended. ended: the session
   * closed. not-yet-seen: the hook has written no line of it by this moment and no subagent is running (the
   * harness's files hold subagents from before the hook was installed), so nothing says which it is.
   */
  state: "working" | "waiting" | "ended" | "not-yet-seen";
  /** the first thing either record holds of it */
  started: string;
  ended?: string;
  model?: string;
};

export type SeenAgentState = "running" | "done" | "failed" | "stopped" | "not-seen-to-finish";

export type SeenAgent = {
  id: string;
  kind: "subagent";
  /** as the harness names it; absent while no record has said */
  type?: string;
  /** from the harness's files; from the hook's lines alone, only as far as they name each parent up to the session */
  depth?: number;
  /** of its last run. failed and stopped (the harness's `killed`) are known only from the harness's files. */
  state: SeenAgentState;
  shape?: "background" | "foreground";
  /** the model that answered, where a record says */
  model?: string;
  /** the model its call named, when it named one */
  modelAsked?: string;
  /** its first run, then each time it was resumed */
  runs: SeenRun[];
  source: SeenSource;
};

export type SeenNode = SeenSession | SeenAgent;

export type SeenEdge = {
  from: string;
  to: string;
  kind: "started" | "resumed";
  /** when it happened */
  at: string;
  /** when a record first said so */
  knownAt: string;
  source: SeenSource;
};

/** One place where the two records do not say the same. `run` is the index of a run in that agent's `runs`. */
export type SeenDifference =
  /** the harness's files hold it; the hook wrote no line of it */
  | { agent: string; what: "not-in-hook" }
  /** the hook saw it; the harness's files hold nothing of it */
  | { agent: string; what: "not-in-harness" }
  /** the harness's files hold the run; the hook wrote no line of it, though it saw the agent at another time */
  | { agent: string; what: "run-not-in-hook"; run: number }
  /** the hook wrote the run's stop line and no start line for it */
  | { agent: string; what: "no-start-line"; run: number }
  /** the hook wrote the run's start line; the harness's files say the run ended, and the hook wrote no stop line for it */
  | { agent: string; what: "no-stop-line"; run: number }
  /** the hook saw the run; the harness's files hold no run to match it */
  | { agent: string; what: "run-not-in-harness"; run: number }
  | { agent: string; what: "type" | "parent" | "model"; hook: string; harness: string };

export type SeenGraph = {
  groophSeen: 0;
  /** the moment this graph is of; empty when the hook wrote no line of the session */
  at: string;
  /** the session first, then each subagent in the order it was first seen */
  nodes: SeenNode[];
  edges: SeenEdge[];
  /** where the two records differ, among what exists at this moment; empty when the harness's files were not read */
  differs: SeenDifference[];
  /** every moment at which nodes, edges or states change, over the whole record: stepping `at` through them is the replay */
  moments: string[];
  /** what was read, whatever the moment */
  record: {
    hook: {
      /** the hook's lines for this session */
      lines: number;
      /** the last of them: how fresh the record is (`isQuiet` in `events.ts` reads it against a clock) */
      last?: string;
      /** stop lines with no type from ids never seen starting: the harness's own helpers, counted and not drawn */
      stopsNotDrawn: number;
    };
    /** absent when the harness's files were not read */
    harness?: { agents: number };
  };
};

/** A start line is written a moment after the run's first line; a start this much before a run's first line is still that run's. */
const START_SLACK_MS = 1000;

const ENDS: readonly string[] = ["completed", "failed", "killed", "ended"];

const ms = (t: unknown): number | undefined => {
  if (typeof t !== "string") return undefined;
  const n = Date.parse(t);
  return Number.isNaN(n) ? undefined : n;
};
const iso = (n: number): string => new Date(n).toISOString();
const text = (v: unknown): string | undefined => (typeof v === "string" && v !== "" ? v : undefined);

type Run = { from?: number; to?: number; end?: HarnessRunEnd; unseen?: true; /** the harness's run it is */ h?: number; /** opened by its parent's tool line; its own start line has not come */ awaiting?: true };
type Agent = { id: string; firstAt: number; runs: Run[]; hookType?: string; hookModel?: string; hookParents: string[]; depth?: number };
type Edge = { from: string; to: string; kind: "started" | "resumed"; at: number; knownAt: number; source: SeenSource };
type Held = { agent: HarnessAgent; runs: { first: number; last: number; end?: HarnessRunEnd }[]; /** which runs the hook wrote a start line for, and a stop line */ started: boolean[]; stopped: boolean[] };
type Fact = { t: number; rank: 1; i: number; kind: "line"; e: SessionEvent } | { t: number; rank: 0 | 2; i: number; kind: "begin" | "end"; agent: string; run: number };

/**
 * The session a list of the hook's lines describes, as a graph at one moment. The lines are one session's, in the
 * order they were written (lines of another session, and what a lead said, are passed over). With no moment given
 * the graph is the one after the last change; given `moments[k]` it is the graph as it stood then, and each is the
 * one before with that moment's change added.
 */
export function seenGraph(events: readonly SessionEvent[], options: SeenOptions = {}): SeenGraph {
  const given = options.harness !== undefined;
  const atGiven = ms(options.at);
  const first = events.find((e) => e.event !== "plan" && e.event !== "note" && ms(e.t) !== undefined);
  const lines = first
    ? events
        .map((e, i) => ({ e, i, t: ms(e.t) }))
        .filter((x): x is { e: SessionEvent; i: number; t: number } => x.t !== undefined && x.e.session === first.session && x.e.harness === first.harness && x.e.event !== "plan" && x.e.event !== "note")
        .sort((a, b) => a.t - b.t || a.i - b.i)
    : [];
  const record: SeenGraph["record"] = { hook: { lines: lines.length, ...(lines.length > 0 ? { last: iso(lines[lines.length - 1]!.t) } : {}), stopsNotDrawn: 0 }, ...(given ? { harness: { agents: 0 } } : {}) };
  if (!first) return { groophSeen: 0, at: atGiven !== undefined ? iso(atGiven) : "", nodes: [], edges: [], differs: [], moments: [], record };
  const sessionId = first.session;

  // ── the harness's files, and which of their runs the hook has a line for ──
  const harness = new Map<string, Held>();
  for (const agent of options.harness ?? []) {
    if (text(agent?.id) === undefined || harness.has(agent.id)) continue;
    const runs = (Array.isArray(agent.runs) ? agent.runs : [])
      .flatMap((r) => {
        const from = ms(r?.first);
        if (from === undefined) return [];
        return [{ first: from, last: Math.max(from, ms(r.last) ?? from), ...(ENDS.includes(r.end as string) ? { end: r.end as HarnessRunEnd } : {}) }];
      })
      .sort((a, b) => a.first - b.first);
    harness.set(agent.id, { agent, runs, started: runs.map(() => false), stopped: runs.map(() => false) });
  }
  if (record.harness) record.harness.agents = harness.size;
  /** The run a time falls in: the last one that had begun by then. */
  const slot = (h: Held, t: number): number => {
    let k = -1;
    h.runs.forEach((r, i) => {
      if (r.first <= t) k = i;
    });
    return k;
  };
  /** Every id the hook's lines name in a way that is drawn. */
  const hookIds = new Set<string>();
  /** The harness's run each start line is, by the line's place in `events`. */
  const startIs = new Map<number, number>();
  /** Who the hook's lines say started each child. */
  const claims = new Map<string, Set<string>>();
  for (const { e, i, t } of lines) {
    if (e.agent === undefined) {
      if (e.event !== "tool" || e.spawned === undefined) continue;
    } else {
      const h = harness.get(e.agent);
      if (e.event === "subagent-start") {
        hookIds.add(e.agent);
        const k = h ? slot(h, t + START_SLACK_MS) : -1;
        if (h && k >= 0 && !h.started[k]) {
          h.started[k] = true;
          startIs.set(i, k);
        }
      } else if (e.event === "subagent-stop") {
        if (e.type !== undefined || h) hookIds.add(e.agent);
        const k = h ? slot(h, t) : -1;
        if (h && k >= 0) h.stopped[k] = true;
      } else if (e.event === "tool") hookIds.add(e.agent);
    }
    if (e.event === "tool" && e.spawned !== undefined && e.spawned !== e.agent) {
      hookIds.add(e.spawned);
      (claims.get(e.spawned) ?? claims.set(e.spawned, new Set()).get(e.spawned)!).add(e.agent ?? sessionId);
    }
  }

  // ── one timeline: the hook's lines, and what only the harness's files hold ──
  const facts: Fact[] = lines.map(({ e, i, t }) => ({ t, rank: 1, i, kind: "line", e }));
  for (const [id, h] of harness) {
    h.runs.forEach((r, k) => {
      if (!h.started[k]) facts.push({ t: r.first, rank: 0, i: k, kind: "begin", agent: id, run: k });
      if (r.end !== undefined && !h.stopped[k]) facts.push({ t: r.last, rank: 2, i: k, kind: "end", agent: id, run: k });
    });
  }
  facts.sort((a, b) => a.t - b.t || a.rank - b.rank || a.i - b.i);

  // ── the graph, built one fact at a time ──
  const agents = new Map<string, Agent>();
  const edges: Edge[] = [];
  let session: { started: number; ended?: number; model?: string; turnOpen?: boolean } | undefined;
  /** Each node's look before the fact in hand touched it. */
  let before = new Map<string, string>();

  const sourceOf = (id: string): SeenSource => (hookIds.has(id) ? (harness.has(id) ? "both" : "hook") : "harness");
  const runSource = (a: Agent, r: Run): SeenSource => {
    const h = r.h === undefined ? undefined : harness.get(a.id);
    return h === undefined ? "hook" : h.started[r.h!] || h.stopped[r.h!] ? "both" : "harness";
  };
  const stateOf = (a: Agent): SeenAgentState => {
    const last = a.runs[a.runs.length - 1];
    if (last === undefined || last.unseen) return "not-seen-to-finish";
    if (last.to === undefined) return "running";
    return last.end === "failed" ? "failed" : last.end === "killed" ? "stopped" : "done";
  };
  /** Who the harness's files say started it: the agent they name, or the session for one at depth 1. */
  const harnessParent = (id: string): string | undefined => {
    const h = harness.get(id)?.agent;
    return text(h?.parent) ?? (h?.depth === 1 ? sessionId : undefined);
  };
  const differsOf = (a: Agent): SeenDifference[] => {
    if (!given || !hookIds.has(a.id)) return given && harness.has(a.id) ? [{ agent: a.id, what: "not-in-hook" }] : [];
    const h = harness.get(a.id);
    if (!h) return [{ agent: a.id, what: "not-in-harness" }];
    const out: SeenDifference[] = [];
    const type = text(h.agent.type);
    if (a.hookType !== undefined && type !== undefined && a.hookType !== type) out.push({ agent: a.id, what: "type", hook: a.hookType, harness: type });
    const parent = harnessParent(a.id);
    if (parent !== undefined && a.hookParents.length > 0 && !a.hookParents.includes(parent)) out.push({ agent: a.id, what: "parent", hook: a.hookParents[0]!, harness: parent });
    const model = text(h.agent.model);
    if (a.hookModel !== undefined && model !== undefined && a.hookModel !== model) out.push({ agent: a.id, what: "model", hook: a.hookModel, harness: model });
    a.runs.forEach((r, run) => {
      if (r.h === undefined) return void out.push({ agent: a.id, what: "run-not-in-harness", run });
      if (!h.started[r.h]) out.push({ agent: a.id, what: h.stopped[r.h] ? "no-start-line" : "run-not-in-hook", run });
      else if (h.runs[r.h]!.end !== undefined && r.to !== undefined && !h.stopped[r.h]) out.push({ agent: a.id, what: "no-stop-line", run });
    });
    return out;
  };
  const show = (a: Agent): SeenAgent => {
    const h = harness.get(a.id)?.agent;
    const type = a.hookType ?? text(h?.type);
    const depth = typeof h?.depth === "number" && Number.isInteger(h.depth) && h.depth > 0 ? h.depth : a.depth;
    const model = a.hookModel ?? text(h?.model);
    const asked = text(h?.modelAsked);
    return {
      id: a.id,
      kind: "subagent",
      ...(type !== undefined ? { type } : {}),
      ...(depth !== undefined ? { depth } : {}),
      state: stateOf(a),
      ...(h?.shape === "background" || h?.shape === "foreground" ? { shape: h.shape } : {}),
      ...(model !== undefined ? { model } : {}),
      ...(asked !== undefined ? { modelAsked: asked } : {}),
      runs: a.runs.map((r) => ({
        ...(r.from !== undefined ? { from: iso(r.from) } : {}),
        ...(r.to !== undefined ? { to: iso(r.to) } : {}),
        ...(r.end !== undefined ? { end: r.end } : {}),
        ...(r.unseen ? { notSeenToFinish: true as const } : {}),
        source: runSource(a, r),
      })),
      source: sourceOf(a.id),
    };
  };
  const showSession = (): SeenSession => {
    const running = [...agents.values()].some((a) => stateOf(a) === "running");
    const state = session!.turnOpen === undefined && !running ? "not-yet-seen" : session!.ended !== undefined && !running ? "ended" : running || session!.turnOpen === true ? "working" : "waiting";
    return { id: sessionId, kind: "session", harness: first.harness, depth: 0, state, started: iso(session!.started), ...(session!.ended !== undefined ? { ended: iso(session!.ended) } : {}), ...(session!.model !== undefined ? { model: session!.model } : {}) };
  };
  const look = (a: Agent): string => JSON.stringify([show(a), differsOf(a)]);
  const touch = (id: string): void => {
    if (!before.has(id)) before.set(id, agents.has(id) ? look(agents.get(id)!) : "");
  };

  const setDepth = (id: string, depth: number): void => {
    const a = agents.get(id);
    if (!a || a.depth !== undefined) return;
    touch(id);
    a.depth = depth;
    for (const x of edges) if (x.kind === "started" && x.from === id) setDepth(x.to, depth + 1);
  };
  /** One more run of an agent that has run before: an edge from each one known to have started it. */
  const resumed = (a: Agent, r: Run, knownAt: number, from?: string): void => {
    if (r.from === undefined) return;
    for (const x of [...edges]) {
      if (x.kind !== "started" || x.to !== a.id || (from !== undefined && x.from !== from)) continue;
      if (!edges.some((y) => y.kind === "resumed" && y.from === x.from && y.to === a.id && y.at === r.from)) edges.push({ from: x.from, to: a.id, kind: "resumed", at: r.from, knownAt: Math.max(knownAt, r.from), source: runSource(a, r) });
    }
  };
  const started = (from: string, to: string, knownAt: number, by: "hook" | "harness"): void => {
    if (from === to || edges.some((x) => x.kind === "started" && x.from === from && x.to === to)) return;
    const child = agents.get(to)!;
    const source: SeenSource = by === "hook" ? (harnessParent(to) === from ? "both" : "hook") : claims.get(to)?.has(from) ? "both" : "harness";
    edges.push({ from, to, kind: "started", at: child.runs[0]?.from ?? child.firstAt, knownAt, source });
    const depth = from === sessionId ? 0 : agents.get(from)?.depth;
    if (depth !== undefined) setDepth(to, depth + 1);
    child.runs.forEach((r, i) => {
      if (i > 0) resumed(child, r, knownAt, from);
    });
  };
  const agent = (id: string, t: number): Agent => {
    touch(id);
    let a = agents.get(id);
    if (a) return a;
    a = { id, firstAt: t, runs: [], hookParents: [] };
    agents.set(id, a);
    // The harness's files know who started it from its first moment.
    const parent = harnessParent(id);
    if (parent !== undefined) {
      if (parent !== sessionId) agent(parent, t);
      started(parent, id, t, "harness");
    }
    return a;
  };
  /** A new run of an agent. One left open before it has no end on record and is not running. */
  const open = (a: Agent, run: Run): void => {
    const last = a.runs[a.runs.length - 1];
    if (last !== undefined && last.to === undefined) last.unseen = true;
    a.runs.push(run);
    if (a.runs.length > 1) resumed(a, run, run.from ?? 0);
  };
  const isOpen = (a: Agent): Run | undefined => {
    const last = a.runs[a.runs.length - 1];
    return last !== undefined && last.to === undefined ? last : undefined;
  };

  const apply = (f: Fact): void => {
    session ??= { started: f.t };
    if (f.kind !== "line") {
      if (f.kind === "begin") {
        const a = agent(f.agent, f.t);
        const last = isOpen(a);
        // Its parent's tool line came first and opened it: the same run.
        if (last?.awaiting && last.h === undefined) last.h = f.run;
        else open(a, { from: f.t, h: f.run });
        return;
      }
      const a = agents.get(f.agent);
      const r = a?.runs.find((x) => x.h === f.run);
      if (!a || !r || r.to !== undefined) return;
      touch(a.id);
      r.to = Math.max(f.t, r.from ?? f.t);
      r.end = harness.get(a.id)!.runs[f.run]!.end!;
      delete r.unseen;
      return;
    }
    const { e, t } = f;
    // The first line the hook wrote: until a turn's end says otherwise, something is being answered.
    session.turnOpen ??= true;
    if (e.model !== undefined && e.agent === undefined) session.model = e.model;
    /** The agent a line is from, with what the line says of it. */
    const own = (id: string): Agent => {
      const a = agent(id, t);
      if (e.type !== undefined && (a.hookType === undefined || e.event === "subagent-start")) a.hookType = e.type;
      if (e.model !== undefined) a.hookModel = e.model;
      return a;
    };
    switch (e.event) {
      case "session-start":
        delete session.ended;
        break;
      case "session-end":
        session.ended = t;
        // The session closed: a run with no stop on record was not seen to finish, and is not running.
        for (const a of agents.values()) {
          const last = isOpen(a);
          if (!last || last.unseen) continue;
          touch(a.id);
          last.unseen = true;
        }
        break;
      case "turn-start":
        session.turnOpen = true;
        delete session.ended;
        break;
      case "turn-end":
        session.turnOpen = false;
        break;
      case "subagent-start": {
        if (e.agent === undefined) break;
        const a = own(e.agent);
        const h = startIs.get(f.i);
        const last = isOpen(a);
        if (last?.awaiting) {
          delete last.awaiting;
          if (last.h === undefined && h !== undefined) last.h = h;
        } else open(a, { from: t, ...(h !== undefined ? { h } : {}) });
        break;
      }
      case "subagent-stop": {
        if (e.agent === undefined) break;
        // A stop with no type from an id never seen starting is the harness's own helper: counted, not drawn.
        if (e.type === undefined && !agents.has(e.agent) && !harness.has(e.agent)) break;
        const a = own(e.agent);
        const last = isOpen(a);
        if (last) {
          last.to = Math.max(t, last.from ?? t);
          delete last.unseen;
          delete last.awaiting;
          const end = last.h === undefined ? undefined : harness.get(a.id)?.runs[last.h]?.end;
          if (end !== undefined) last.end = end;
        } else a.runs.push({ to: t });
        break;
      }
      case "tool": {
        if (e.agent !== undefined) {
          const a = own(e.agent);
          const last = a.runs[a.runs.length - 1];
          // Work seen from a subagent with no run open means it ran again; from one not seen to finish, that it is running.
          if (last === undefined || (last.to !== undefined && t > last.to)) open(a, { from: t });
          else if (last.unseen) delete last.unseen;
        }
        if (e.spawned !== undefined && e.spawned !== e.agent) {
          // The child takes nothing from this line but that it exists and who started it: the line's type is its parent's.
          const child = agent(e.spawned, t);
          if (child.runs.length === 0) {
            // Which of the harness's runs it is can be said now, where the start line still to come is that run's.
            const h = harness.get(child.id);
            const k = h ? slot(h, t + START_SLACK_MS) : -1;
            open(child, { from: t, awaiting: true, ...(h && k >= 0 && h.started[k] ? { h: k } : {}) });
          }
          const parent = e.agent ?? sessionId;
          if (!child.hookParents.includes(parent)) child.hookParents.push(parent);
          started(parent, child.id, t, "hook");
        }
        break;
      }
    }
  };

  const snapshot = (): Pick<SeenGraph, "nodes" | "edges" | "differs"> => ({
    nodes: session ? [showSession(), ...[...agents.values()].map(show)] : [],
    edges: edges.map((x) => ({ from: x.from, to: x.to, kind: x.kind, at: iso(x.at), knownAt: iso(x.knownAt), source: x.source })),
    differs: [...agents.values()].flatMap(differsOf),
  });

  const moments: number[] = [];
  let cut: Pick<SeenGraph, "nodes" | "edges" | "differs"> | undefined;
  for (const f of facts) {
    if (cut === undefined && atGiven !== undefined && f.t > atGiven) cut = snapshot();
    before = new Map();
    const was = session ? JSON.stringify(showSession()) : "";
    const had = edges.length;
    apply(f);
    if (f.kind === "line" && f.e.event === "subagent-stop" && f.e.type === undefined && f.e.agent !== undefined && !agents.has(f.e.agent)) record.hook.stopsNotDrawn += 1;
    // Edges are only ever added; a node is compared with how it looked before this fact touched it.
    const changed = edges.length !== had || JSON.stringify(showSession()) !== was || [...before].some(([id, look0]) => look(agents.get(id)!) !== look0);
    if (changed && moments[moments.length - 1] !== f.t) moments.push(f.t);
  }
  cut ??= snapshot();
  const last = moments[moments.length - 1];
  return { groophSeen: 0, at: atGiven !== undefined ? iso(atGiven) : last !== undefined ? iso(last) : "", ...cut, moments: moments.map(iso), record };
}
