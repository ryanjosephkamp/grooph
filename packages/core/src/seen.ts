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
 * - **The hook's lines are the timeline.** A run begins at the first line the hook wrote of it (its start line, or
 *   the tool line that started it when that one was written first) and ends at its stop line. Where the hook has
 *   no line for something the harness's files hold, the harness's own time is used: a run's first line for a
 *   beginning the hook did not see, its last line for an end the hook wrote no stop for. An end the files hold
 *   from before the hook's start line was written (a run shorter than the hook is late) is drawn at that line.
 * - **Every node, run and edge says where it came from**: the hook, the harness's files, or both. That is said of
 *   the records as they were read, not of the moment: it does not change as the moment is stepped. So is which of
 *   the harness's runs a start or a stop line belongs to. Read while a session runs, the newest thing may be in one
 *   record and not yet in the other (a start line is written up to a few seconds after its run's first line, a
 *   stop line up to ten after its last): a difference listed then may be gone at the next reading.
 * - **Where the records disagree, both are kept.** A node shows the hook's word for a type or a model where the
 *   hook has one, and `differs` lists the disagreement with both values. Two parents are two edges. Depth is the
 *   harness's where its files give one, since a hook line carries none.
 * - **An edge is a fact with two ends.** A child whose parent no record has named yet has no edge yet: a hook
 *   learns who started a foreground child only when that child ends, which is why an edge carries both when it
 *   happened and when it became known. A view may hang such a node where it likes; the graph does not guess.
 * - **Neither record says who resumed an agent.** A `resumed` edge runs from the one that started it, which is who
 *   was handed its id. In the 39 resumed runs in the records read for slice 0104 on 2026-10-11, each followed a
 *   message from its starter.
 *
 * From the hook's lines alone a stop ends whichever run of that agent is open, as the list of sessions has always
 * read it. With the harness's files a stop ends the run it was written for: a stop written after the same agent
 * began again, or before its own start line, is still that run's.
 *
 * What a session says of its own plan (`plan` and `note` lines) is not drawn here: that is slice 0105's, set beside
 * this graph and never in it.
 */

import { QUIET_AFTER_SECONDS, type SessionEvent } from "./events.js";
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
  /**
   * A moment: the graph as it stood then. An ISO 8601 time with its zone (`2026-10-04T08:16:46.499Z`), as the
   * hook writes them and as `moments` lists them. Absent, or not such a time: after the last change.
   */
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
  /**
   * Of its last run. failed and stopped (the harness's `killed`) are known only from the harness's files.
   * not-seen-to-finish: no end is on record for it and it is not running, or it is known only as another's parent.
   */
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
  /** the moment this graph is of: the one given, or the last change; empty when there is neither */
  at: string;
  /** the session first, then each subagent in the order it was first seen */
  nodes: SeenNode[];
  edges: SeenEdge[];
  /** where the two records differ, among the nodes and runs that exist at this moment; empty when the harness's files were not read */
  differs: SeenDifference[];
  /** every moment at which nodes, edges or states change, over the whole record: stepping `at` through them is the replay */
  moments: string[];
  /** what was read, whatever the moment */
  record: {
    hook: {
      /** the hook's lines for this session */
      lines: number;
      /** the last of them: how fresh the record is (`seenQuiet` reads it against a clock) */
      last?: string;
      /** stop lines with no type from ids never seen starting: the harness's own helpers, counted and not drawn */
      stopsNotDrawn: number;
    };
    /** absent when the harness's files were not read. A subagent they hold with no run that can be dated is counted here, and drawn only if the hook saw it. */
    harness?: { agents: number };
  };
};

/** A hook's start line is written after its run's first line. One written this much before a run's first line is still taken as that run's. */
const START_SLACK_MS = 1000;
/**
 * How long after a run's first or last line the hook's line for it may be written and still be looked for among
 * the runs before the newest. In the records a start line came at most 2.5 s after, and a stop line at most 9.7 s.
 */
const NEAR_MS = 30_000;

const ENDS: readonly string[] = ["completed", "failed", "killed", "ended"];

/** A time with its zone, as the hook writes one. A time with no zone would mean a different moment on each machine. */
const MOMENT = /^\d{4}-\d\d-\d\dT\d\d:\d\d(:\d\d(\.\d+)?)?(Z|[+-]\d\d:?\d\d)$/;

const ms = (t: unknown): number | undefined => {
  if (typeof t !== "string") return undefined;
  const n = Date.parse(t);
  return Number.isNaN(n) ? undefined : n;
};
const iso = (n: number): string => new Date(n).toISOString();
/** A name or an id as a harness writes one: not empty, not long, and nothing in it that is not shown (a control, a line break, a mark that reorders text). */
const UNSHOWN = /[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u2028-\u202e\u2060-\u206f\ufeff]/;
const name = (v: unknown, longest = 120): string | undefined => (typeof v === "string" && v !== "" && v.length <= longest && !UNSHOWN.test(v) ? v : undefined);

type Run = { from?: number; to?: number; end?: HarnessRunEnd; unseen?: true; /** the harness's run it is */ h?: number; /** opened by another's tool line; its own start line has not come */ awaiting?: true };
type Agent = { id: string; firstAt: number; runs: Run[]; byH: Map<number, Run>; hookType?: string; hookModel?: string; hookParents: string[]; depth?: number; /** who is known to have started it, and whom it started */ starters: string[]; children: string[] };
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
  const atGiven = typeof options.at === "string" && MOMENT.test(options.at) ? ms(options.at) : undefined;
  const drawn = (e: SessionEvent | null | undefined): e is SessionEvent => typeof e === "object" && e !== null && e.event !== "plan" && e.event !== "note" && ms(e.t) !== undefined && typeof e.session === "string";
  const first = events.find(drawn);
  const lines = first
    ? events
        .map((e, i) => ({ e, i, t: ms(e?.t) }))
        .filter((x): x is { e: SessionEvent; i: number; t: number } => drawn(x.e) && x.e.session === first.session && x.e.harness === first.harness)
        .sort((a, b) => a.t - b.t || a.i - b.i)
    : [];
  const record: SeenGraph["record"] = { hook: { lines: lines.length, ...(lines.length > 0 ? { last: iso(lines[lines.length - 1]!.t) } : {}), stopsNotDrawn: 0 }, ...(given ? { harness: { agents: 0 } } : {}) };
  if (!first) return { groophSeen: 0, at: atGiven !== undefined ? iso(atGiven) : "", nodes: [], edges: [], differs: [], moments: [], record };
  const sessionId = first.session;
  /** A subagent's id as a line or a file gives it: a name, and not the session's own. */
  const agentId = (v: unknown): string | undefined => {
    const id = name(v, 128);
    return id === sessionId ? undefined : id;
  };

  // ── the harness's files, and which of their runs the hook has a line for ──
  const harness = new Map<string, Held>();
  const held: readonly HarnessAgent[] = Array.isArray(options.harness) ? options.harness : [];
  for (const agent of held) {
    const id = agentId(agent?.id);
    if (id === undefined || harness.has(id)) continue;
    const runs = (Array.isArray(agent.runs) ? agent.runs : [])
      .flatMap((r) => {
        const from = ms(r?.first);
        if (from === undefined) return [];
        return [{ first: from, last: Math.max(from, ms(r.last) ?? from), ...(ENDS.includes(r.end as string) ? { end: r.end as HarnessRunEnd } : {}) }];
      })
      .sort((a, b) => a.first - b.first);
    harness.set(id, { agent, runs, started: runs.map(() => false), stopped: runs.map(() => false) });
  }
  if (record.harness) record.harness.agents = harness.size;
  /** The run a time falls in: the last one that had begun by then. */
  const slot = (h: Held, t: number): number => {
    let low = 0;
    let high = h.runs.length;
    while (low < high) {
      const mid = (low + high) >> 1;
      if (h.runs[mid]!.first <= t) low = mid + 1;
      else high = mid;
    }
    return low - 1;
  };
  /** Every id the hook's lines name in a way that is drawn. */
  const hookIds = new Set<string>();
  /** The harness's run each start line and each stop line is, by the line's place in `events`. */
  const startIs = new Map<number, number>();
  const stopIs = new Map<number, number>();
  /** Who the hook's lines say started each child. */
  const claims = new Map<string, Set<string>>();
  /** When each agent's stop lines were written. */
  const stopsOf = new Map<string, number[]>();
  for (const { e, t } of lines) if (e.event === "subagent-stop" && typeof e.agent === "string") (stopsOf.get(e.agent) ?? stopsOf.set(e.agent, []).get(e.agent)!).push(t);
  const stopsRead = new Map<string, number>();
  for (const { e, i, t } of lines) {
    const from = agentId(e.agent);
    const spawned = e.event === "tool" ? agentId(e.spawned) : undefined;
    const h = from === undefined ? undefined : harness.get(from);
    if (from !== undefined && e.event === "subagent-start") {
      hookIds.add(from);
      if (h) {
        // The earliest run that began a little before the line and has no start line yet: a second run can begin
        // before the first one's start line is written. Else the run that had last begun; or, where the hook's
        // clock ran a little ahead, the next.
        const k = slot(h, t);
        let is = -1;
        for (let j = k; j >= 0 && h.runs[j]!.first >= t - NEAR_MS; j -= 1) if (!h.started[j]) is = j;
        if (is < 0) is = k >= 0 && !h.started[k] ? k : k + 1 < h.runs.length && !h.started[k + 1] && h.runs[k + 1]!.first <= t + START_SLACK_MS ? k + 1 : -1;
        if (is >= 0) {
          h.started[is] = true;
          startIs.set(i, is);
        }
      }
    } else if (from !== undefined && e.event === "subagent-stop") {
      if (name(e.type) !== undefined || h) hookIds.add(from);
      if (h) {
        // The run that had just ended: one the files say is over, whose last line was written a little before this
        // one, and that has no stop line yet. A stop can be written after the same agent has begun again. Of two
        // such runs it is the earlier one's when a stop line is still to come for the later, and otherwise the
        // later one's (a run that failed fires no stop). Where there is no such run, the one that had last begun.
        const now = slot(h, t);
        const near: number[] = [];
        for (let k = now; k >= 0 && h.runs[k]!.last >= t - NEAR_MS; k -= 1) if (h.runs[k]!.end !== undefined && !h.stopped[k] && h.runs[k]!.last <= t + START_SLACK_MS) near.push(k);
        // How many of its stop lines, this one counted, are written within that little while from now.
        const mine = stopsOf.get(from)!;
        const here = stopsRead.get(from) ?? 0;
        stopsRead.set(from, here + 1);
        let still = 0;
        while (here + still < mine.length && mine[here + still]! <= t + NEAR_MS) still += 1;
        const is = near.length === 0 ? now : still >= near.length ? near[near.length - 1]! : near[0]!;
        if (is >= 0) {
          h.stopped[is] = true;
          stopIs.set(i, is);
        }
      }
    } else if (from !== undefined && e.event === "tool") hookIds.add(from);
    // A line from an agent whose id is not one says nothing of who started whom.
    if (spawned !== undefined && spawned !== from && (from !== undefined || e.agent === undefined)) {
      hookIds.add(spawned);
      (claims.get(spawned) ?? claims.set(spawned, new Set()).get(spawned)!).add(from ?? sessionId);
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
  // At one time: what began, then the hook's lines in the order written, then what ended.
  facts.sort((a, b) => a.t - b.t || a.rank - b.rank || a.i - b.i);

  // ── the graph, built one fact at a time ──
  const agents = new Map<string, Agent>();
  const edges: Edge[] = [];
  const edgeKeys = new Set<string>();
  const running = new Set<string>();
  /** Endings the files hold for runs not drawn yet: each is given to its run when the run is. */
  const pending = new Map<string, Set<number>>();
  let session: { started: number; ended?: number; model?: string; turnOpen?: boolean } | undefined;

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
    return agentId(h?.parent) ?? (h?.depth === 1 ? sessionId : undefined);
  };
  /** Whether both records are there to be compared for this agent. */
  const compared = (a: Agent): Held | undefined => (given && hookIds.has(a.id) ? harness.get(a.id) : undefined);
  const typeOf = (a: Agent): string | undefined => a.hookType ?? name(harness.get(a.id)?.agent.type);
  const modelOf = (a: Agent): string | undefined => a.hookModel ?? name(harness.get(a.id)?.agent.model);
  const depthOf = (a: Agent): number | undefined => {
    const depth = harness.get(a.id)?.agent.depth;
    return typeof depth === "number" && Number.isInteger(depth) && depth > 0 ? depth : a.depth;
  };
  /** How the two records differ on one agent, its runs apart. */
  const agentDiffers = (a: Agent): SeenDifference[] => {
    const h = compared(a);
    if (!h) return !given || harness.has(a.id) === hookIds.has(a.id) ? [] : [{ agent: a.id, what: hookIds.has(a.id) ? "not-in-harness" : "not-in-hook" }];
    const out: SeenDifference[] = [];
    const type = name(h.agent.type);
    if (a.hookType !== undefined && type !== undefined && a.hookType !== type) out.push({ agent: a.id, what: "type", hook: a.hookType, harness: type });
    const parent = harnessParent(a.id);
    if (parent !== undefined && a.hookParents.length > 0 && !a.hookParents.includes(parent)) out.push({ agent: a.id, what: "parent", hook: a.hookParents[0]!, harness: parent });
    const model = name(h.agent.model);
    if (a.hookModel !== undefined && model !== undefined && a.hookModel !== model) out.push({ agent: a.id, what: "model", hook: a.hookModel, harness: model });
    return out;
  };
  /** How the two records differ on one run. */
  const runDiffers = (a: Agent, r: Run): "run-not-in-hook" | "no-start-line" | "no-stop-line" | "run-not-in-harness" | undefined => {
    const h = compared(a);
    if (!h) return undefined;
    if (r.h === undefined) return "run-not-in-harness";
    if (!h.started[r.h]) return h.stopped[r.h] ? "no-start-line" : "run-not-in-hook";
    return h.runs[r.h]!.end !== undefined && r.to !== undefined && !h.stopped[r.h] ? "no-stop-line" : undefined;
  };
  const showRun = (a: Agent, r: Run): SeenRun => ({
    ...(r.from !== undefined ? { from: iso(r.from) } : {}),
    ...(r.to !== undefined ? { to: iso(r.to) } : {}),
    ...(r.end !== undefined ? { end: r.end } : {}),
    ...(r.unseen ? { notSeenToFinish: true as const } : {}),
    source: runSource(a, r),
  });
  const show = (a: Agent): SeenAgent => {
    const h = harness.get(a.id)?.agent;
    const type = typeOf(a);
    const depth = depthOf(a);
    const model = modelOf(a);
    const asked = name(h?.modelAsked);
    return {
      id: a.id,
      kind: "subagent",
      ...(type !== undefined ? { type } : {}),
      ...(depth !== undefined ? { depth } : {}),
      state: stateOf(a),
      ...(h?.shape === "background" || h?.shape === "foreground" ? { shape: h.shape } : {}),
      ...(model !== undefined ? { model } : {}),
      ...(asked !== undefined ? { modelAsked: asked } : {}),
      runs: a.runs.map((r) => showRun(a, r)),
      source: sourceOf(a.id),
    };
  };
  const sessionState = (): SeenSession["state"] => (session!.turnOpen === undefined && running.size === 0 ? "not-yet-seen" : session!.ended !== undefined && running.size === 0 ? "ended" : running.size > 0 || session!.turnOpen === true ? "working" : "waiting");
  const showSession = (): SeenSession => ({ id: sessionId, kind: "session", harness: first.harness, depth: 0, state: sessionState(), started: iso(session!.started), ...(session!.ended !== undefined ? { ended: iso(session!.ended) } : {}), ...(session!.model !== undefined ? { model: session!.model } : {}) });

  // What a moment changes is told by comparing, once its facts are all in, each thing they touched with how it
  // looked before: two lines in one millisecond that undo each other change nothing.
  let grew = false;
  const agentsBefore = new Map<Agent, string>();
  const runsBefore = new Map<Run, string>();
  const agentLook = (a: Agent): string => JSON.stringify([typeOf(a), depthOf(a), modelOf(a), agentDiffers(a)]);
  const runLook = (a: Agent, r: Run): string => JSON.stringify([showRun(a, r), runDiffers(a, r)]);
  const touch = (a: Agent, r?: Run): void => {
    if (!agentsBefore.has(a)) agentsBefore.set(a, agentLook(a));
    if (r !== undefined && !runsBefore.has(r)) runsBefore.set(r, runLook(a, r));
  };
  const owner = new Map<Run, Agent>();
  /** After a run of an agent changed: whether the agent is running now. */
  const settle = (a: Agent): void => void (stateOf(a) === "running" ? running.add(a.id) : running.delete(a.id));

  const edge = (x: Edge): void => {
    const key = `${x.kind}\u0000${x.from}\u0000${x.to}${x.kind === "resumed" ? `\u0000${x.at}` : ""}`;
    if (edgeKeys.has(key)) return;
    edgeKeys.add(key);
    edges.push(x);
    grew = true;
  };
  /** One more run of an agent that has run before: an edge from each one known to have started it. */
  const resumed = (a: Agent, r: Run, knownAt: number, from?: string): void => {
    if (r.from === undefined) return;
    for (const starter of from !== undefined ? [from] : a.starters) edge({ from: starter, to: a.id, kind: "resumed", at: r.from, knownAt: Math.max(knownAt, r.from), source: runSource(a, r) });
  };
  /** A depth learned from who started whom, handed down to those it started in turn. */
  const setDepth = (id: string, depth: number): void => {
    const todo: [string, number][] = [[id, depth]];
    while (todo.length > 0) {
      const [next, d] = todo.pop()!;
      const a = agents.get(next);
      if (!a || a.depth !== undefined) continue;
      touch(a);
      a.depth = d;
      for (const child of a.children) todo.push([child, d + 1]);
    }
  };
  const started = (from: string, child: Agent, at: number, knownAt: number, by: "hook" | "harness"): void => {
    if (from === child.id || child.starters.includes(from)) return;
    const source: SeenSource = by === "hook" ? (harnessParent(child.id) === from ? "both" : "hook") : claims.get(child.id)?.has(from) ? "both" : "harness";
    edge({ from, to: child.id, kind: "started", at, knownAt, source });
    child.starters.push(from);
    const parent = agents.get(from);
    if (parent) parent.children.push(child.id);
    const depth = from === sessionId ? 0 : parent?.depth;
    if (depth !== undefined) setDepth(child.id, depth + 1);
    child.runs.forEach((r, i) => {
      if (i > 0) resumed(child, r, knownAt, from);
    });
  };
  /** The agent of an id, made if it is new, at `t`. `began`: when its first run began, where that is known and is not `t`. */
  const agent = (id: string, t: number, began = t): Agent => {
    const known = agents.get(id);
    if (known) return known;
    const a: Agent = { id, firstAt: t, runs: [], byH: new Map(), hookParents: [], starters: [], children: [] };
    agents.set(id, a);
    grew = true;
    // The harness's files know who started it from its first moment; and who started that one, as far up as they say.
    let child = a;
    let at = began;
    for (;;) {
      const parent = harnessParent(child.id);
      if (parent === undefined || parent === child.id) break;
      const isNew = parent !== sessionId && !agents.has(parent);
      const above: Agent | undefined = isNew ? { id: parent, firstAt: t, runs: [], byH: new Map(), hookParents: [], starters: [], children: [] } : undefined;
      if (above) agents.set(parent, above);
      started(parent, child, at, t, "harness");
      if (!above) break;
      child = above;
      at = t;
    }
    return a;
  };
  /** A run is the harness's run `k`: the two are tied, and an ending the files hold from before now is given to it. */
  const bind = (a: Agent, r: Run, k: number, t: number): void => {
    touch(a, r);
    r.h = k;
    a.byH.set(k, r);
    if (r.to === undefined && pending.get(a.id)?.delete(k)) {
      r.to = Math.max(t, r.from ?? t);
      r.end = harness.get(a.id)!.runs[k]!.end!;
      delete r.unseen;
    }
    settle(a);
  };
  /** A new run of an agent. One left open before it has no end on record and is not running. */
  const open = (a: Agent, run: Run, t: number): Run => {
    const last = a.runs[a.runs.length - 1];
    if (last !== undefined && last.to === undefined && !last.unseen) {
      touch(a, last);
      last.unseen = true;
    }
    touch(a);
    a.runs.push(run);
    owner.set(run, a);
    grew = true;
    if (run.h !== undefined) bind(a, run, run.h, t);
    if (a.runs.length > 1) resumed(a, run, t);
    settle(a);
    return run;
  };
  const isOpen = (a: Agent): Run | undefined => {
    const last = a.runs[a.runs.length - 1];
    return last !== undefined && last.to === undefined ? last : undefined;
  };
  /** A run opened by another's tool line gets its own line: it is this run, and it is starting. */
  const arrive = (a: Agent, r: Run, k: number | undefined, t: number): void => {
    touch(a, r);
    delete r.awaiting;
    delete r.unseen;
    if (r.h === undefined && k !== undefined && !a.byH.has(k)) bind(a, r, k, t);
    settle(a);
  };

  const apply = (f: Fact): void => {
    session ??= { started: f.t };
    if (f.kind !== "line") {
      const h = harness.get(f.agent)!;
      if (f.kind === "begin") {
        const a = agent(f.agent, f.t);
        const last = isOpen(a);
        // Its parent's tool line came first and opened it: the same run.
        if (last?.awaiting && last.h === undefined) bind(a, last, f.run, f.t);
        else if (!a.byH.has(f.run)) open(a, { from: f.t, h: f.run }, f.t);
        return;
      }
      const a = agents.get(f.agent);
      const r = a?.byH.get(f.run);
      // The run is not drawn yet (its start line is written later than this): the ending waits for it.
      if (!a || !r) return void (pending.get(f.agent) ?? pending.set(f.agent, new Set()).get(f.agent)!).add(f.run);
      if (r.to !== undefined) return;
      touch(a, r);
      r.to = Math.max(f.t, r.from ?? f.t);
      r.end = h.runs[f.run]!.end!;
      delete r.unseen;
      settle(a);
      return;
    }
    const { e, t } = f;
    // The first line the hook wrote: until a turn's end says otherwise, something is being answered.
    session.turnOpen ??= true;
    const from = agentId(e.agent);
    const model = name(e.model);
    if (model !== undefined && e.agent === undefined) session.model = model;
    /** The agent a line is from, with what the line says of it. */
    const own = (id: string, began = t): Agent => {
      const a = agent(id, t, began);
      const type = name(e.type);
      touch(a);
      if (type !== undefined && a.hookType === undefined) a.hookType = type;
      if (model !== undefined) a.hookModel = model;
      return a;
    };
    switch (e.event) {
      case "session-start":
        delete session.ended;
        break;
      case "session-end":
        session.ended = t;
        // The session closed: a run with no stop on record was not seen to finish, and is not running.
        for (const id of [...running]) {
          const a = agents.get(id)!;
          const last = isOpen(a)!;
          touch(a, last);
          last.unseen = true;
          settle(a);
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
        if (from === undefined) break;
        const a = own(from);
        const k = startIs.get(f.i);
        const mine = k === undefined ? undefined : a.byH.get(k);
        const last = isOpen(a);
        if (mine !== undefined) {
          // Its run is drawn already: opened by its parent's tool line, or ended by a stop written before this line.
          if (mine.awaiting) arrive(a, mine, k, t);
        } else if (last?.awaiting) arrive(a, last, k, t);
        else open(a, { from: t, ...(k !== undefined ? { h: k } : {}) }, t);
        break;
      }
      case "subagent-stop": {
        if (from === undefined) break;
        // A stop with no type from an id never seen starting is the harness's own helper: counted, not drawn.
        if (name(e.type) === undefined && !agents.has(from) && !harness.has(from)) {
          record.hook.stopsNotDrawn += 1;
          break;
        }
        const k = stopIs.get(f.i);
        const h = harness.get(from);
        const a = own(from, k !== undefined ? h!.runs[k]!.first : t);
        // With the harness's files the stop is its own run's, where that run is open; otherwise it is the open run's.
        const mine = k === undefined ? undefined : a.byH.get(k);
        const ends = mine !== undefined && mine.to === undefined ? mine : isOpen(a);
        if (ends !== undefined) {
          touch(a, ends);
          ends.to = Math.max(t, ends.from ?? t);
          delete ends.unseen;
          delete ends.awaiting;
          const end = ends.h === undefined ? undefined : h?.runs[ends.h]?.end;
          if (end !== undefined) ends.end = end;
          settle(a);
        } else if (mine === undefined && k !== undefined) {
          // Its run is not drawn and its start line is still to be written: the run began when the harness's files say.
          const run = h!.runs[k]!;
          open(a, { from: run.first, to: Math.max(t, run.first), h: k, ...(run.end !== undefined ? { end: run.end } : {}) }, t);
        } else if (mine === undefined) open(a, { to: t }, t);
        // Otherwise its run has ended already, and a second stop of it adds nothing.
        break;
      }
      case "tool": {
        const spawned = agentId(e.spawned);
        /** The harness's run that a line written now and not yet tied to one would be, when its start line is still to come. */
        const coming = (a: Agent): number | undefined => {
          const h = harness.get(a.id);
          if (!h) return undefined;
          const k = slot(h, t);
          const is = k >= 0 ? k : h.runs.length > 0 && h.runs[0]!.first <= t + START_SLACK_MS ? 0 : -1;
          return is >= 0 && h.started[is] && !a.byH.has(is) ? is : undefined;
        };
        if (from !== undefined) {
          const a = own(from);
          const last = a.runs[a.runs.length - 1];
          // Work seen from a subagent with no run open means it ran again; from one not seen to finish, that it is running.
          // Its own start line may still be to come (the hooks are not written in order): that line is then this run's.
          if (last === undefined || (last.to !== undefined && t > last.to)) {
            const k = coming(a);
            open(a, { from: t, awaiting: true, ...(k !== undefined ? { h: k } : {}) }, t);
          } else if (last.unseen) {
            touch(a, last);
            delete last.unseen;
            settle(a);
          }
        }
        if (spawned !== undefined && spawned !== from && (from !== undefined || e.agent === undefined)) {
          // The child takes nothing from this line but that it exists and who started it: the line's type is its parent's.
          const child = agent(spawned, t);
          if (child.runs.length === 0) {
            const k = coming(child);
            open(child, { from: t, awaiting: true, ...(k !== undefined ? { h: k } : {}) }, t);
          }
          const parent = from ?? sessionId;
          if (!child.hookParents.includes(parent)) {
            touch(child);
            child.hookParents.push(parent);
          }
          started(parent, child, child.runs[0]?.from ?? child.firstAt, t, "hook");
        }
        break;
      }
    }
  };

  const snapshot = (): Pick<SeenGraph, "nodes" | "edges" | "differs"> => ({
    nodes: session ? [showSession(), ...[...agents.values()].map(show)] : [],
    edges: edges.map((x) => ({ from: x.from, to: x.to, kind: x.kind, at: iso(x.at), knownAt: iso(x.knownAt), source: x.source })),
    differs: [...agents.values()].flatMap((a) => [
      ...agentDiffers(a),
      ...a.runs.flatMap((r, run): SeenDifference[] => {
        const what = runDiffers(a, r);
        return what === undefined ? [] : [{ agent: a.id, what, run }];
      }),
    ]),
  });

  const moments: number[] = [];
  let cut: Pick<SeenGraph, "nodes" | "edges" | "differs"> | undefined;
  for (let i = 0; i < facts.length; ) {
    const t = facts[i]!.t;
    if (cut === undefined && atGiven !== undefined && t > atGiven) cut = snapshot();
    grew = false;
    agentsBefore.clear();
    runsBefore.clear();
    const was = session ? JSON.stringify(showSession()) : "";
    for (; i < facts.length && facts[i]!.t === t; i += 1) apply(facts[i]!);
    const changed = grew || JSON.stringify(showSession()) !== was || [...agentsBefore].some(([a, look]) => agentLook(a) !== look) || [...runsBefore].some(([r, look]) => runLook(owner.get(r)!, r) !== look);
    if (changed) moments.push(t);
  }
  cut ??= snapshot();
  const last = moments[moments.length - 1];
  return { groophSeen: 0, at: atGiven !== undefined ? iso(atGiven) : last !== undefined ? iso(last) : "", ...cut, moments: moments.map(iso), record };
}

/**
 * Whether the record has gone quiet by `now`: the session has not ended, and the hook wrote nothing of it for half
 * an hour (the rule `isQuiet` holds the list of sessions to). The graph has no clock; whoever holds one asks. A
 * view then says when the session was last seen, and that a subagent with no end on record was not seen to finish.
 */
export function seenQuiet(graph: Pick<SeenGraph, "nodes" | "record">, now: string): boolean {
  const session = graph.nodes[0];
  const last = ms(graph.record.hook.last);
  const at = ms(now);
  return session !== undefined && session.kind === "session" && session.state !== "ended" && last !== undefined && at !== undefined && at - last >= QUIET_AFTER_SECONDS * 1000;
}
