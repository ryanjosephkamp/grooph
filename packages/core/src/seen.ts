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
 *   beginning the hook did not see, its last line for an end the hook wrote no stop for. And a run whose last
 *   line the files hold from before the hook's first line of it (a run shorter than the hook is late) is drawn,
 *   when that line comes, from the files' first line of it.
 * - **Every node, run and edge says where it came from**: the hook, the harness's files, or both. That is said of
 *   the records as they were read, not of the moment: it does not change as the moment is stepped (but for a run
 *   whose first line from the hook is dated before the files' own first line of it, which two clocks could do).
 *   A run is the hook's too when the hook wrote its start, its stop, or a tool line from inside it.
 *   Read while a session runs, the newest thing may be in one record and not yet in the other (a start line is
 *   written up to a few seconds after its run's first line, a stop line up to ten after its last): a difference
 *   listed then may be gone at the next reading.
 * - **Which run a line is of is a matter of time.** A start line is written a little after its run's first line and
 *   a stop line a little after its last. A line is taken for a run within half a minute of it. A stop line later
 *   than that is still the stop of the run that had last begun, where that run has no stop line nearer, and
 *   however much later: a subagent can wait on one command for as long as the command takes and write no line
 *   meanwhile, so no limit would be the right one. A stop is not taken for a run where the hook wrote a start
 *   line of its own in between (one that is no run of the files'): it is then that start's. In the records an agent's runs were never less than
 *   130 s apart, and then there is no choice to make. Where two runs of one agent are closer than half a minute
 *   it is a judgment, made the same way each time (`pair`): as many lines as can be given a run, in order, each
 *   as near its run as can be (for an agent with thousands of runs, a plainer rule). It can be wrong; nothing in
 *   either record would say so.
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
 * read it; and so it is where the files were read and hold no run of that agent that can be dated. With the
 * files' runs to go by, a line is of the run it is taken for: a stop written after the same agent began again, or
 * before its own start line, is still that run's (and a run stopped after the agent began again ends where the
 * files say it wrote its last line, so that an agent's runs do not overlap). A start or a stop line taken for none of them begins or ends
 * a run only where the files do not show otherwise (no run of theirs still writing, for a start; an open run with
 * no stop line of its own that had written its last line, for a stop). One that does neither is counted, as a
 * difference (`line-of-no-run`): a harness can fire a stop twice for one run when another hook sends the subagent
 * back to work. A tool line written late, after its run ended, is nothing new.
 *
 * A time is read only with its zone, as the hook writes it and as the reader of the harness's files gives it: a
 * line or a run dated without one would fall at a different moment on each machine, and is passed over. A start or
 * a stop line written twice, the same to the millisecond, is one line.
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
  /** the first moment either record puts anything of it in the graph */
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
  /** the hook wrote a line of the run (its stop, or a tool line from inside it) and no start line for it */
  | { agent: string; what: "no-start-line"; run: number }
  /** the hook wrote the run's start line; the harness's files say the run ended, and the hook wrote no stop line for it */
  | { agent: string; what: "no-stop-line"; run: number }
  /** the hook saw the run; the harness's files hold no run to match it */
  | { agent: string; what: "run-not-in-harness"; run: number }
  /** the hook wrote this many start or stop lines of it that are no run's: the harness's files hold its runs, and these fit none of them */
  | { agent: string; what: "line-of-no-run"; lines: number }
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
    /** absent when the harness's files were not read. A subagent they hold with no run that can be dated is counted here, and drawn only if the hook saw it or it is another's parent. */
    harness?: { agents: number };
  };
};

/** A hook's line is written after the line of its run it follows. One written this much before is still taken as that run's: two clocks, or two writers. */
const START_SLACK_MS = 1000;
/**
 * How long after a run's first line its start line may be written, or after its last line its stop line, and
 * still be taken as that run's. In the records a start line came at most 2.5 s after, and a stop line at most 9.7 s.
 */
const NEAR_MS = 30_000;

/**
 * Lines given to the runs they were written for, the order of both kept. As many lines as can each be given a run
 * that fits; and of such ways, the one that leaves the least time between each line and its run. `fits(i, k)`
 * says whether line `i` could be run `k`'s, `apart(i, k)` how far apart the two are. Returns each line's run, or -1.
 */
function pair(lines: number, runs: number, fits: (i: number, k: number) => boolean, apart: (i: number, k: number) => number): number[] {
  const out = new Array<number>(lines).fill(-1);
  if (lines === 0 || runs === 0) return out;
  // Too many to weigh every way (an agent with thousands of runs is not something a harness does): each line is
  // given the nearest run that fits and comes after the last one given.
  if (lines * runs > 4_000_000) {
    let next = 0;
    for (let i = 0; i < lines; i += 1) {
      let best = -1;
      for (let k = next; k < runs; k += 1) {
        if (!fits(i, k)) {
          if (best >= 0) break;
          continue;
        }
        if (best < 0 || apart(i, k) < apart(i, best)) best = k;
      }
      if (best >= 0) {
        out[i] = best;
        next = best + 1;
      }
    }
    return out;
  }
  // The best way to pair the first i lines with the first k runs, a row at a time; `how` remembers each choice.
  const width = runs + 1;
  const how = new Uint8Array((lines + 1) * width);
  let count = new Int32Array(width);
  let cost = new Float64Array(width);
  for (let i = 1; i <= lines; i += 1) {
    const counts = new Int32Array(width);
    const costs = new Float64Array(width);
    for (let k = 1; k <= runs; k += 1) {
      // Line i left without a run; or run k left without a line; or the two paired.
      let c = count[k]!;
      let w = cost[k]!;
      let h = 0;
      if (counts[k - 1]! > c || (counts[k - 1] === c && costs[k - 1]! < w)) {
        c = counts[k - 1]!;
        w = costs[k - 1]!;
        h = 1;
      }
      if (fits(i - 1, k - 1)) {
        const paired = count[k - 1]! + 1;
        const weighed = cost[k - 1]! + apart(i - 1, k - 1);
        // (Of two ways as good as each other, the one that leaves the later line out: of a line written twice, the first is the run's.)
        if (paired > c || (paired === c && weighed < w)) {
          c = paired;
          w = weighed;
          h = 2;
        }
      }
      counts[k] = c;
      costs[k] = w;
      how[i * width + k] = h;
    }
    count = counts;
    cost = costs;
  }
  for (let i = lines, k = runs; i > 0 && k > 0; ) {
    const h = how[i * width + k];
    if (h === 2) {
      out[i - 1] = k - 1;
      i -= 1;
      k -= 1;
    } else if (h === 1) k -= 1;
    else i -= 1;
  }
  return out;
}

const ENDS: readonly string[] = ["completed", "failed", "killed", "ended"];

/** A time with its zone, as the hook writes one. A time with no zone would mean a different moment on each machine. */
const MOMENT = /^\d{4}-\d\d-\d\dT\d\d:\d\d(:\d\d(\.\d+)?)?(Z|[+-]\d\d:?\d\d)$/;

/** A time, where it is one with its zone: on a line, in the harness's files, or given as a moment. Any other is not read as a time. */
const ms = (t: unknown): number | undefined => {
  if (typeof t !== "string" || !MOMENT.test(t)) return undefined;
  const n = Date.parse(t);
  return Number.isNaN(n) ? undefined : n;
};
const iso = (n: number): string => new Date(n).toISOString();
/** A name or an id as a harness writes one: not empty, not long, and nothing in it that is not shown (a control, a line break, a mark that reorders text). */
const UNSHOWN = /[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u2028-\u202e\u2060-\u206f\ufeff]/;
const name = (v: unknown, longest = 120): string | undefined => (typeof v === "string" && v !== "" && v.length <= longest && !UNSHOWN.test(v) ? v : undefined);

type Run = { from?: number; to?: number; end?: HarnessRunEnd; unseen?: true; /** the harness's run it is */ h?: number; /** opened by another's tool line; its own start line has not come */ awaiting?: true; /** a line of the hook's opened it or ended it */ hook?: true };
type Agent = { id: string; firstAt: number; runs: Run[]; byH: Map<number, Run>; hookType?: string; hookModel?: string; hookParents: string[]; depth?: number; /** who is known to have started it, and whom it started */ starters: string[]; children: string[]; /** start and stop lines of the hook's that were no run's */ loose: number };
type Edge = { from: string; to: string; kind: "started" | "resumed"; at: number; knownAt: number; source: SeenSource };
type Held = { agent: HarnessAgent; runs: { first: number; last: number; end?: HarnessRunEnd }[]; /** which runs the hook wrote a start line for, a stop line for, and a tool line from inside */ started: boolean[]; stopped: boolean[]; touched: boolean[] };
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
  const drawn = (e: SessionEvent | null | undefined): e is SessionEvent => typeof e === "object" && e !== null && e.event !== "plan" && e.event !== "note" && ms(e.t) !== undefined && typeof e.session === "string";
  const first = events.find(drawn);
  const read = first
    ? events
        .map((e, i) => ({ e, i, t: ms(e?.t) }))
        .filter((x): x is { e: SessionEvent; i: number; t: number } => drawn(x.e) && x.e.session === first.session && x.e.harness === first.harness)
        .sort((a, b) => a.t - b.t || a.i - b.i)
    : [];
  // A start or a stop line written twice, the same to the millisecond, is one line (a file read twice, or joined to a copy of itself).
  const once = new Set<string>();
  const lines = read.filter(({ e, t }) => {
    if (e.event !== "subagent-start" && e.event !== "subagent-stop") return true;
    const key = `${e.event}\u0000${String(e.agent)}\u0000${t}`;
    return !once.has(key) && once.add(key) !== undefined;
  });
  const record: SeenGraph["record"] = { hook: { lines: read.length, ...(read.length > 0 ? { last: iso(read[read.length - 1]!.t) } : {}), stopsNotDrawn: 0 }, ...(given ? { harness: { agents: 0 } } : {}) };
  // With no line of the hook's there is no session to name, and so none whose id a subagent could not have.
  const sessionId = first?.session;
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
    harness.set(id, { agent, runs, started: runs.map(() => false), stopped: runs.map(() => false), touched: runs.map(() => false) });
  }
  if (record.harness) record.harness.agents = harness.size;
  if (first === undefined || sessionId === undefined) return { groophSeen: 0, at: atGiven !== undefined ? iso(atGiven) : "", nodes: [], edges: [], differs: [], moments: [], record };
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
  /** Each agent's start lines and stop lines, in the order of their times: where in `events`, and when. */
  const startsOf = new Map<string, { i: number; t: number }[]>();
  const stopsOf = new Map<string, { i: number; t: number }[]>();
  for (const { e, i, t } of lines) {
    const from = agentId(e.agent);
    const spawned = e.event === "tool" ? agentId(e.spawned) : undefined;
    if (from !== undefined && e.event === "subagent-start") {
      hookIds.add(from);
      if (harness.has(from)) (startsOf.get(from) ?? startsOf.set(from, []).get(from)!).push({ i, t });
    } else if (from !== undefined && e.event === "subagent-stop") {
      if (name(e.type) !== undefined || harness.has(from)) hookIds.add(from);
      if (harness.has(from)) (stopsOf.get(from) ?? stopsOf.set(from, []).get(from)!).push({ i, t });
    } else if (from !== undefined && e.event === "tool") {
      hookIds.add(from);
      // A tool line from inside a run the files hold: the hook saw that run, whatever else it wrote of it.
      const h = harness.get(from);
      const k = h ? slot(h, t) : -1;
      if (h && k >= 0 && (t <= h.runs[k]!.last + START_SLACK_MS || (k === h.runs.length - 1 && h.runs[k]!.end === undefined))) h.touched[k] = true;
    }
    // A line from an agent whose id is not one says nothing of who started whom.
    if (spawned !== undefined && spawned !== from && (from !== undefined || e.agent === undefined)) {
      hookIds.add(spawned);
      (claims.get(spawned) ?? claims.set(spawned, new Set()).get(spawned)!).add(from ?? sessionId);
    }
  }
  // Which of the harness's runs each start line and each stop line was written for. A start line is written a
  // little after its run's first line, a stop line a little after its last. Where an agent's runs are further
  // apart than that little while (in the records the least gap was 130 s) there is one run a line can be, or none.
  // Where two are closer it is a judgment: as many lines as can each be given a run they could be, in order, and
  // of such ways the one that leaves the least time between each line and its run (`pair`).
  for (const [id, h] of harness) {
    const count = h.runs.length;
    const starts = startsOf.get(id) ?? [];
    pair(
      starts.length,
      count,
      (i, k) => starts[i]!.t >= h.runs[k]!.first - START_SLACK_MS && starts[i]!.t <= h.runs[k]!.first + NEAR_MS,
      (i, k) => Math.abs(starts[i]!.t - h.runs[k]!.first),
    ).forEach((k, i) => {
      if (k < 0) return;
      h.started[k] = true;
      startIs.set(starts[i]!.i, k);
    });
    const stops = stopsOf.get(id) ?? [];
    // The start lines that are no run of the files': each begins a run only the hook saw, and the stop that follows
    // one is that run's before it is an earlier one's.
    const loose = starts.filter((line) => !startIs.has(line.i)).map((line) => line.t);
    const beganBetween = (after: number, by: number): boolean => loose.some((t) => t > after && t <= by);
    // A stop line is written after its run's last line, within half a minute of it; and not where the hook wrote a
    // start line of its own between the two.
    const paired = pair(
      stops.length,
      count,
      (i, k) => stops[i]!.t >= h.runs[k]!.last - START_SLACK_MS && stops[i]!.t <= h.runs[k]!.last + NEAR_MS && !beganBetween(h.runs[k]!.last, stops[i]!.t),
      // A run that failed fires no stop (the one in the records did not): its stop line it is only if no other run fits.
      (i, k) => Math.abs(stops[i]!.t - h.runs[k]!.last) + (h.runs[k]!.end === "failed" ? NEAR_MS : 0),
    );
    paired.forEach((k, i) => {
      if (k < 0) return;
      h.stopped[k] = true;
      stopIs.set(stops[i]!.i, k);
    });
    // A stop line left over, later than that: it is the stop of the run that had last begun, where that run has no
    // stop line of its own, had written its last line, and the hook wrote no start line of its own since. However
    // much later: a subagent can wait on one command for as long as the command takes, write no line in that time,
    // and then be stopped, so no limit would be the right one.
    paired.forEach((tied, i) => {
      if (tied >= 0) return;
      const k = slot(h, stops[i]!.t);
      if (k < 0 || h.stopped[k] || h.runs[k]!.last > stops[i]!.t + START_SLACK_MS || beganBetween(h.runs[k]!.last, stops[i]!.t)) return;
      h.stopped[k] = true;
      stopIs.set(stops[i]!.i, k);
    });
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
  /** Stop lines that were no run's, of agents not drawn yet: how many, to be counted when each is. */
  const strays = new Map<string, number>();
  /** Endings the files hold for runs not drawn yet: each is given to its run when the run is. */
  const pending = new Map<string, Set<number>>();
  let session: { started: number; ended?: number; model?: string; turnOpen?: boolean } | undefined;

  const sourceOf = (id: string): SeenSource => (hookIds.has(id) ? (harness.has(id) ? "both" : "hook") : "harness");
  const runSource = (a: Agent, r: Run): SeenSource => {
    const h = r.h === undefined ? undefined : harness.get(a.id);
    return h === undefined ? "hook" : r.hook || h.started[r.h!] || h.stopped[r.h!] || h.touched[r.h!] ? "both" : "harness";
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
    if (a.loose > 0) out.push({ agent: a.id, what: "line-of-no-run", lines: a.loose });
    return out;
  };
  /** How the two records differ on one run. */
  const runDiffers = (a: Agent, r: Run): "run-not-in-hook" | "no-start-line" | "no-stop-line" | "run-not-in-harness" | undefined => {
    const h = compared(a);
    if (!h) return undefined;
    if (r.h === undefined) return "run-not-in-harness";
    if (!h.started[r.h]) return r.hook || h.stopped[r.h] || h.touched[r.h] ? "no-start-line" : "run-not-in-hook";
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
    const a: Agent = { id, firstAt: t, runs: [], byH: new Map(), hookParents: [], starters: [], children: [], loose: strays.get(id) ?? 0 };
    agents.set(id, a);
    grew = true;
    // The harness's files know who started it from its first moment; and who started that one, as far up as they say.
    let child = a;
    let at = began;
    for (;;) {
      const parent = harnessParent(child.id);
      if (parent === undefined || parent === child.id) break;
      const isNew = parent !== sessionId && !agents.has(parent);
      const above: Agent | undefined = isNew ? { id: parent, firstAt: t, runs: [], byH: new Map(), hookParents: [], starters: [], children: [], loose: 0 } : undefined;
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
  /** When a run the hook first writes of at `t` began: at `t`, or, where the files had its last line before that, when they say it did. */
  const began = (h: Held, k: number, t: number): number => {
    const run = h.runs[k]!;
    return (run.end !== undefined || k < h.runs.length - 1) && run.last < t ? Math.min(run.first, t) : t;
  };
  /** A start or a stop line that is no run's: it draws nothing, and is counted as a difference. */
  const passedOver = (a: Agent): void => {
    touch(a);
    a.loose += 1;
  };
  /**
   * A run ends at a line of the hook's: when the line was written, or, where the same agent had begun again by
   * then (the stop was written late), when the files say the run wrote its last line. An agent's runs do not overlap.
   */
  const close = (a: Agent, r: Run, t: number): void => {
    touch(a, r);
    const last = r.h === undefined || a.runs[a.runs.length - 1] === r ? undefined : harness.get(a.id)?.runs[r.h]?.last;
    r.to = Math.max(last === undefined ? t : Math.min(t, last), r.from ?? t);
    r.hook = true;
    delete r.unseen;
    delete r.awaiting;
    const end = r.h === undefined ? undefined : harness.get(a.id)?.runs[r.h]?.end;
    if (end !== undefined) r.end = end;
    settle(a);
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
    // An ending the files hold for a run that is not drawn yet (its start line is written later than this) waits
    // for the run, and is nothing in the graph until then.
    if (f.kind === "end" && agents.get(f.agent)?.byH.get(f.run) === undefined) return void (pending.get(f.agent) ?? pending.set(f.agent, new Set()).get(f.agent)!).add(f.run);
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
      const a = agents.get(f.agent)!;
      const r = a.byH.get(f.run)!;
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
        const k = startIs.get(f.i);
        const h = harness.get(from);
        const a = own(from, k !== undefined ? began(h!, k, t) : t);
        const mine = k === undefined ? undefined : a.byH.get(k);
        const last = isOpen(a);
        if (mine !== undefined) {
          // Its run is drawn already: opened by another's tool line, or ended by a stop written before this line.
          if (mine.awaiting) arrive(a, mine, k, t);
        } else if (last?.awaiting && last.h === undefined) arrive(a, last, k, t);
        else if (k !== undefined) {
          // The files said the run was over before this line was written, and the ending has waited for the run: it is drawn whole.
          const run = h!.runs[k]!;
          const over = pending.get(from)?.delete(k) === true;
          open(a, { from: began(h!, k, t), h: k, hook: true, ...(over ? { to: t, end: run.end! } : {}) }, t);
        } else if (last !== undefined && last.h !== undefined && t <= h!.runs[last.h]!.last + START_SLACK_MS) passedOver(a);
        // (Tied to none of the files' runs while they show the open run still writing: it begins no second run.)
        else open(a, { from: t, hook: true }, t);
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
        // Tied to none of the runs the files hold of an agent that is not drawn yet: it draws nothing now (an edge
        // would be dated before the agent's first run), and is counted as no run's when the agent is drawn.
        if (k === undefined && h !== undefined && h.runs.length > 0 && !agents.has(from)) {
          strays.set(from, (strays.get(from) ?? 0) + 1);
          break;
        }
        const a = own(from, k !== undefined ? Math.min(h!.runs[k]!.first, t) : t);
        if (k !== undefined) {
          // Tied to one of the harness's runs, it is that run's stop. A run not drawn yet (its start line is still to
          // be written) is drawn whole, from when the files say it began, and no other run is ended.
          const mine = a.byH.get(k);
          const run = h!.runs[k]!;
          if (mine === undefined) open(a, { from: Math.min(run.first, t), to: t, h: k, hook: true, ...(run.end !== undefined ? { end: run.end } : {}) }, t);
          else if (mine.to === undefined) close(a, mine, t);
          else passedOver(a);
          break;
        }
        // Tied to none of them. From the hook alone, or where the files hold no run of this agent, it ends the run
        // that is open, and with none open it is the stop of a run whose beginning was not seen. Where the files
        // hold the agent's runs it ends an open run that only the hook saw, or one of theirs that has no stop line
        // of its own and had written its last line by now; otherwise it is no run's.
        const last = isOpen(a);
        const alone = h === undefined || h.runs.length === 0;
        if (last !== undefined && (last.h === undefined || (!h!.stopped[last.h] && h!.runs[last.h]!.last <= t + START_SLACK_MS))) close(a, last, t);
        else if (alone) open(a, { to: t, hook: true }, t);
        else passedOver(a);
        break;
      }
      case "tool": {
        const spawned = agentId(e.spawned);
        /** The harness's run a line written now is of, where that run's start line is still to come and the run is not drawn: the earliest such that began a little before. */
        const coming = (id: string): number | undefined => {
          const h = harness.get(id);
          if (!h) return undefined;
          const drawn = agents.get(id)?.byH;
          let is: number | undefined;
          for (let k = slot(h, t + START_SLACK_MS); k >= 0 && h.runs[k]!.first >= t - NEAR_MS; k -= 1) if (h.started[k] && !drawn?.has(k)) is = k;
          return is;
        };
        /** When a run this line opens began. */
        const from0 = (id: string): number => {
          const k = coming(id);
          return k !== undefined ? began(harness.get(id)!, k, t) : t;
        };
        /** A run opened by this line, which is not its own start line: that line, if it comes, is then this run's. */
        const early = (a: Agent): void => {
          const k = coming(a.id);
          open(a, { from: from0(a.id), awaiting: true, hook: true, ...(k !== undefined ? { h: k } : {}) }, t);
        };
        if (from !== undefined) {
          const a = own(from, from0(from));
          const h = harness.get(a.id);
          const last = a.runs[a.runs.length - 1];
          if (h !== undefined && h.runs.length > 0) {
            // With the files' runs to go by, the line is of the run the files put it in. From inside the open run
            // (one not seen to finish is then running after all); or of a later run whose start line is still to
            // come; or a line written late, of a run that has ended, which is nothing new.
            if (last !== undefined && last.to === undefined && (last.h === undefined || last.h >= slot(h, t))) {
              if (last.unseen) {
                touch(a, last);
                delete last.unseen;
                settle(a);
              }
            } else if (coming(a.id) !== undefined) early(a);
          } else if (last === undefined || (last.to !== undefined && t > last.to)) {
            // From the hook alone, work seen from a subagent with no run open means it ran again.
            early(a);
          } else if (last.to === undefined && last.unseen) {
            touch(a, last);
            delete last.unseen;
            settle(a);
          }
        }
        if (spawned !== undefined && spawned !== from && (from !== undefined || e.agent === undefined)) {
          // The child takes nothing from this line but that it exists and who started it: the line's type is its parent's.
          const child = agent(spawned, t, from0(spawned));
          if (child.runs.length === 0) early(child);
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
    // An ending that only waits for its run leaves nothing drawn, and with nothing drawn before it there is no session yet.
    const changed = grew || (session ? JSON.stringify(showSession()) : "") !== was || [...agentsBefore].some(([a, look]) => agentLook(a) !== look) || [...runsBefore].some(([r, look]) => runLook(owner.get(r)!, r) !== look);
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
