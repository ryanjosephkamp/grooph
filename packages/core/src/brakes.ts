/**
 * The brakes of a graph (amendment A-008's list), compared between two versions of it: what the second has lost or
 * loosened that the first had. `refreshSubgrooph` holds a template's newer version to this, on the graph as it would
 * be written and not change by change: a brake is a fact about the whole graph, and it can be lost by an edge added
 * as well as by a field changed, under a new id as well as under the old one.
 *
 * What is compared:
 *
 * - **A person on the way.** Each human gate, the answers it offers and that each still leads somewhere; each
 *   approval, and no second edge beside it that needs none; and what a run reaches without a person's decision,
 *   without one gate's, without one answer at it, without one approval (`reach.ts`), from the start and from every
 *   other node, with from where it can come to end in success without it. A step that was
 *   behind a person and goes, while a step comes in that is not, is one too: it may be the same step under another
 *   name.
 * - **An irreversible marker** on each node that carries one, and a marked node that comes in before any person.
 * - **A loop's stops and bar, and the rounds they count.** Under the loop's id: the tightest round cap, budget and
 *   "ask a person"; the tightest of each that halts the run (one that leads on ends the loop and halts nothing);
 *   where one that leads on first leads; the bar's acceptance. And the stops as a run fires them, at the end of a
 *   pass, in document order (`leadsOnFirst`): no stop that leads on, of any kind, old or new, comes to fire where a
 *   cap, a budget or a stop where a person is asked would have halted, on that pass or an earlier one; nor does one
 *   in a second loop put on the loop's back edge. And each edge that starts a round stays the loop's,
 *   each node the loop bounded stays among its members (or goes with nothing unbounded coming in to do its work),
 *   no step comes onto its rounds that a budget of dispatches does not count, and no way round its nodes comes in
 *   that its stops do not count: a loop around it, a second way back through a new step, a stop of its own that
 *   continues inside it.
 * - **Critics.** Each critic, what each node hands it and in what context, and what a run reaches or how it ends
 *   without its verdict; the policies that say so.
 * - **Checks** (amendment A-019). Each check, its definition, every edge that leaves it, and what a run reaches or
 *   how it ends without its verdict, as for a critic. Any change to the definition is a loss: a program cannot tell
 *   which way it goes. So is any change to an edge that leaves it, but for the two that can only tighten: an
 *   approval newly asked on the edge, and more evidence handed along it to a critic the graph had there. Its verdict
 *   is asked a second time without the brakes that already fired into where they led, so that a cap which already
 *   leads on to what the pass led to does not hide a new way there. And a loop that a check judges, with no critic among the members it
 *   had, is given no bar and no "bar passed" stop, nor is a new loop around a check: either is a way out that does
 *   not pass the check.
 *
 * Three readers were asked, one after another, to break this as a refresh, two more as an adoption, and three more
 * on a check, and each found what the one before had not: this list is what a brake has been found to be, not a proof that nothing is
 * missing from it. A second harness then found that a loop's stops were read by their sizes and not in the order a
 * run fires them, and a fresh reader of that finding, that a kind of stop the loop did not have was not read at all
 * (audit 0001, round two).
 *
 * Pure. Each loss names the changes it may be laid at, as `refreshSubgrooph` names a change: `node:<id>`,
 * `edge:<id>.<field>`, `loop:<id>.stops`.
 */

import { decisionName, decisionsShared, reachedFrom, reachedWithout, shut, startsOf, waysOf, whenOf, type Closed, type Way } from "./reach.js";
import { edgeIsolation, isCriticFamily } from "./semantics.js";
import type { Edge, Graph, Id, Loop, Node, Stop } from "./types.js";

export type Loss = {
  /** one line a person reads */
  why: string;
  /** the changes that may have done it, most likely first; when none of them is a change that was made, any change may have */
  at: string[];
  /** held whichever way the change goes (an edge that leaves a check): no sign that undoing it would loosen anything */
  either?: true;
  /**
   * A check goes, removed or made another kind of node, while a check the graph has not comes in: it may be one
   * check under two ids, so the arrival is no sign of a tightening. Holds the line without what comes in, which is
   * what it says read the other way round (there the check that went would be told as the one coming in).
   */
  swap?: string;
  /**
   * Read the other way round, as what undoing a change would lose, this speaks of something the change brings in
   * that lets a run or a person do what it could not before: an answer a gate did not give, a step marked
   * irreversible that the graph did not have. Undoing it would take that away, and it tightens nothing. So too
   * every line laid at a loop's stops where the change brings in a stop that leads on, changes one or puts one
   * ahead (`leadsBroughtIn`): whatever else the change does to those stops, it is not called a tightening.
   */
  gain?: true;
};

const same = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b);

/**
 * Whether a reason is already among those a change carries, which are kept as one line joined by "; ". Asked of the
 * line and not of its pieces: a reason can itself hold "; " (a command quoted in it: `npm test; true`).
 */
export const saidOf = (reasons: string | undefined, why: string): boolean =>
  reasons !== undefined && (reasons === why || reasons.startsWith(`${why}; `) || reasons.endsWith(`; ${why}`) || reasons.includes(`; ${why}; `));
const quote = (list: readonly string[]): string => list.map((item) => `"${item}"`).join(", ");
const markers = (node: Node | undefined): string[] => (node?.kind === "agent" ? (node.irreversible ?? []) : []);

/** The stops that end a run or ask a person, whatever the work looks like: the ones amendment A-008 lists. */
export const isBrakeStop = (stop: Stop): boolean => stop.kind === "max-iterations" || stop.kind === "budget" || stop.kind === "human";

/**
 * The brake stops of the loops that count a round, kind by kind: the tightest of each (`any`), the tightest that
 * halts the run or asks a person (`halt`), the tightest that does neither (`lead`) and where those lead (`leads`). A stop with a `then`
 * ends the loop and leads on; it halts only if it leads to a human gate or to a stop that halts.
 */
type Brake = { name: string; unit: string; any?: number; halt?: number; lead?: number; leads: Set<Id> };

/** Whether a stop of this document halts the run or asks a person: it names no `then`, or one that is a human gate or a stop that halts. */
function haltsIn(doc: Graph): (stop: Stop) => boolean {
  const nodes = new Map(doc.nodes.map((node) => [node.id, node]));
  return (stop) => {
    if (stop.then === undefined) return true;
    const target = nodes.get(stop.then);
    return target?.kind === "human-gate" || (target?.kind === "stop" && target.outcome === "halt");
  };
}

function brakesOf(doc: Graph, loops: readonly Loop[]): Map<string, Brake> {
  const halts = haltsIn(doc);
  const brakes = new Map<string, Brake>();
  const least = (now: number | undefined, next: number): number => (now === undefined ? next : Math.min(now, next));
  for (const loop of loops) {
    for (const stop of loop.stops) {
      const [key, name, unit, size] =
        stop.kind === "max-iterations"
          ? ["cap", "the round cap", "", stop.n]
          : stop.kind === "budget"
            ? [`budget ${stop.measure}`, "the budget", ` ${stop.measure}`, stop.limit]
            : stop.kind === "human"
              ? ["human", "the stop where a person is asked", "", stop.every ?? 1]
              : [undefined, "", "", 0];
      if (key === undefined) continue;
      const brake = brakes.get(key) ?? brakes.set(key, { name, unit, leads: new Set() }).get(key)!;
      brake.any = least(brake.any, size);
      if (halts(stop)) brake.halt = least(brake.halt, size);
      else {
        brake.lead = least(brake.lead, size);
        brake.leads.add(stop.then!);
      }
    }
  }
  return brakes;
}

/** How the stops of the rounds an edge starts have loosened, from the loop that counted them to the loops that would, kind by kind and by their sizes. */
function looser(was: Map<string, Brake>, now: Map<string, Brake>): string[] {
  const said: string[] = [];
  /** Whether a stop of this kind that leads on fires no later than the one that halts, or there is none that halts. */
  const first = (brake: Brake): boolean => brake.lead !== undefined && (brake.halt === undefined || brake.lead <= brake.halt);
  for (const [key, brake] of was) {
    const next = now.get(key);
    const asked = key === "human";
    if (next?.any === undefined) said.push(asked ? "removes the stop where a person is asked" : `removes ${brake.name} (${brake.any}${brake.unit})`);
    else if (next.any > brake.any!) said.push(asked ? `a person would be asked every ${next.any} rounds, not every ${brake.any}` : `raises ${brake.name} from ${brake.any} to ${next.any}${brake.unit}`);
    else if (brake.halt !== undefined && next.halt === undefined) said.push(`${brake.name} (${brake.halt}${brake.unit}) would no longer halt the run`);
    else if (brake.halt !== undefined && next.halt! > brake.halt) said.push(`${brake.name} that halts the run would rise from ${brake.halt} to ${next.halt}${brake.unit}`);
    // One that leads on, set to fire no later than the one that halts: which of the two a run obeys is then the
    // lead's reading ("the first that fires wins", and at the same count the first in the list is the first).
    else if (brake.halt !== undefined && !first(brake) && first(next)) {
      said.push(`${asked ? "a stop that asks a person" : brake.name} of ${next.lead}${brake.unit} that leads on to ${quote([...next.leads])} would fire ${next.lead! < next.halt! ? "before" : "as soon as"} the one of ${next.halt}${brake.unit} that halts the run`);
    }
    // A brake that leads on first: where it leads is what it does.
    else if (first(next)) {
      const fresh = [...next.leads].filter((id) => !brake.leads.has(id));
      if (fresh.length > 0) said.push(`${brake.name} would lead on to ${quote(fresh)}${brake.leads.size > 0 ? `, not to ${quote([...brake.leads])}` : ""}`);
    }
  }
  return said;
}

/** A stop in the words of a line a person reads. */
function stopName(stop: Stop): string {
  const ONE: Record<string, string> = { dispatches: "dispatch", minutes: "minute", turns: "turn", tokens: "token", rounds: "round" };
  const count = (n: number, many: string): string => `${n} ${n === 1 ? (ONE[many] ?? many) : many}`;
  switch (stop.kind) {
    case "max-iterations":
      return `the round cap of ${stop.n}`;
    case "budget":
      return `the budget of ${count(stop.limit, stop.measure)}`;
    case "human":
      return (stop.every ?? 1) === 1 ? "the stop where a person is asked" : `the stop where a person is asked every ${count(stop.every!, "rounds")}`;
    case "diminishing-returns":
      return `the stop on diminishing returns over ${count(stop.rounds, "rounds")}`;
    case "evidence-invalid":
      return `the stop on evidence invalid for ${count(stop.rounds, "rounds")}`;
    default:
      return 'the stop on "bar passed"';
  }
}

/** The number a stop is set to, and the kind it is one of: two stops of one kind count the same thing. */
const stopSize = (stop: Stop): number | undefined => (stop.kind === "max-iterations" ? stop.n : stop.kind === "budget" ? stop.limit : stop.kind === "human" ? (stop.every ?? 1) : stop.kind === "bar-passed" ? undefined : stop.rounds);
const stopKind = (stop: Stop): string => (stop.kind === "budget" ? `budget ${stop.measure}` : stop.kind === "diminishing-returns" ? `${stop.kind} ${JSON.stringify([stop.metric ?? null, stop.threshold ?? null])}` : stop.kind);

/**
 * Whether a stop of a loop leads on with nobody asked and no verdict given: a round cap, a budget, a stop on
 * diminishing returns or on invalid evidence, with a `then` that is no human gate and no stop that halts. A stop
 * where a person is asked is that person's, wherever it continues. "Bar passed" is the verdict of the loop's
 * critics, and what it leads to is held by what a run reaches around a critic (`reach.ts`); it is nobody's verdict
 * where no critic the loop had is among its members still (`judged`), and is then a stop like the others, also
 * where it names no `then` and the run follows the loop's pass edges.
 */
const leadsOnIn = (halts: (stop: Stop) => boolean, judged: boolean) => (stop: Stop): boolean => {
  if (stop.kind === "human") return false;
  if (stop.kind === "bar-passed") return !judged && (stop.then === undefined || !halts(stop));
  return stop.then !== undefined && !halts(stop);
};

/**
 * What is known of when a stop is due, pass by pass (the first pass through a loop is pass 1):
 *
 * - `cap`: a round cap of n is due on pass n and on every pass after it, and on none before;
 * - `person`: a stop where a person is asked every n rounds. Asked every round, it is due on every pass. Otherwise it
 *   is due on no pass before the nth, and from there it is taken to be due or not on any pass: that it comes round
 *   every nth pass exactly is not reckoned with, which is the careful side. Two things of it are: a person asked
 *   every 2 rounds is asked on every pass on which one asked every 4 is, and so for every number that divides
 *   another; and the asking a stop is said to come before, or to take away, is one on pass n, 2n or 3n;
 * - `counted`: the rest. A budget (`lasting`) is due once what it measures has reached its limit and stays due. What a
 *   pass spends is not known, so it may come due on any pass, or on none; of two budgets of one measure the smaller is
 *   due whenever the larger is. A stop on diminishing returns or on invalid evidence over n rounds is not due before
 *   pass n and may come and go from there; of two that count the same thing the one over fewer rounds is due whenever
 *   the other is. "Bar passed" may be due on any pass, and every such stop with it.
 */
type Timing = { sort: "cap"; from: number } | { sort: "person"; every: number } | { sort: "counted"; key: string; size: number; from: number; lasting: boolean };

function timingOf(stop: Stop): Timing {
  const whole = (size: number): number => (Number.isFinite(size) ? Math.max(1, Math.ceil(size)) : 1);
  switch (stop.kind) {
    case "max-iterations":
      return { sort: "cap", from: whole(stop.n) };
    case "human":
      return { sort: "person", every: whole(stop.every ?? 1) };
    case "budget":
      return { sort: "counted", key: `budget ${stop.measure}`, size: stop.limit, from: 1, lasting: true };
    case "diminishing-returns":
      return { sort: "counted", key: `no progress ${JSON.stringify([stop.metric ?? null, stop.threshold ?? null])}`, size: stop.rounds, from: whole(stop.rounds), lasting: false };
    case "evidence-invalid":
      return { sort: "counted", key: "invalid evidence", size: stop.rounds, from: whole(stop.rounds), lasting: false };
    default:
      return { sort: "counted", key: "bar passed", size: 0, from: 1, lasting: false };
  }
}

/** A loop's stops in the order they are tried, with what `leadsOnFirst` asks of each place in the list. */
type Tried = {
  timing: Timing[];
  /** by place: whether a person who is asked on every pass stands ahead of it, so that nothing from there on is ever obeyed */
  always: boolean[];
  /** by place: the first pass on which a round cap ahead of it is due */
  capAhead: number[];
  /** the first pass on which a round cap is due with no person ahead of it who could be asked by then: the run is over by that pass */
  over: number;
  /** the place of the first stop where a person is asked every n rounds, by n */
  person: Map<number, number>;
  /** the place of the first stop where a person is asked every m rounds, for an m that divides n: that person is asked on every pass one asked every n is */
  divides(every: number): number;
  /** by place: the smallest size among the stops ahead of it that count the same thing (`Timing.key`) */
  least(key: string): number[];
};

function tried(stops: readonly Stop[]): Tried {
  const timing = stops.map(timingOf);
  const always: boolean[] = [];
  const capAhead: number[] = [];
  const person = new Map<number, number>();
  let [sure, cap, soonest, over] = [false, Infinity, Infinity, Infinity];
  timing.forEach((mine, at) => {
    always.push(sure);
    capAhead.push(cap);
    if (mine.sort === "person") {
      if (!person.has(mine.every)) person.set(mine.every, at);
      sure ||= mine.every === 1;
      soonest = Math.min(soonest, mine.every);
    } else if (mine.sort === "cap") {
      cap = Math.min(cap, mine.from);
      if (soonest > mine.from) over = Math.min(over, mine.from);
    }
  });
  const kept = new Map<string, number[]>();
  const least = (key: string): number[] => {
    let sizes = kept.get(key);
    if (!sizes) {
      let size = Infinity;
      sizes = timing.map((mine) => {
        const ahead = size;
        if (mine.sort === "counted" && mine.key === key) size = Math.min(size, mine.size);
        return ahead;
      });
      kept.set(key, sizes);
    }
    return sizes;
  };
  const dividing = new Map<number, number>();
  const divides = (every: number): number => {
    let place = dividing.get(every);
    if (place === undefined) {
      place = Infinity;
      for (const [other, at] of person) if (every % other === 0) place = Math.min(place, at);
      dividing.set(every, place);
    }
    return place;
  };
  return { timing, always, capAhead, over, person, divides, least };
}

/**
 * What a run would do at a loop's stops, asked of two versions of the loop at once (graph-ir §2: stops are evaluated
 * at the end of every pass, in document order, and the first that fires wins). Is there a run in which the second
 * version leads on, by a stop of `leadsOn`, on a pass on which the first version would have halted or asked a person
 * (a stop of `held`), or on an earlier one? One answer for each such stop of the second version, by its place in the
 * list, with a stop of the first that it would come before (`before`: on an earlier pass; otherwise only on the same
 * pass, where it stands ahead in the list).
 *
 * A stop where a person is asked ends nothing: in either version the run is taken to go on from it, as if the
 * person had said so, and the stops are tried again at the end of the next pass. On the pass it fires it is still
 * the first that fires, and nothing behind it in the list is obeyed on that pass. So a person's stop in the second
 * version excuses nothing that fires on a later pass; and each time the first version would have asked is a time
 * the second may not lead on before.
 *
 * What is known of when a stop is due is `Timing`. Whatever is not known is taken to be possible: two kinds that
 * cannot be compared with certainty can both come due on one pass, and either can come due first. That is the
 * careful side, and it costs an honest change one `--allow` (a round cap that leads on, lowered while it stands
 * ahead of a budget that halts).
 *
 * The work is one walk of the first version's stops for each stop of the second that leads on: no pass is tried in
 * turn, so a loop of some hundreds of stops, or a cap of a million rounds, costs no more than its length squared.
 * Each version is first summed up by place (`tried`). A run can then be said to exist from a few numbers:
 *
 * - the second version can obey its stop on any pass from the first on which that stop can be due to the last before
 *   a round cap ahead of it is due, or before the run is over (`Tried.over`), with none of its kind and no larger
 *   ahead of it, and no person ahead of it who is asked on every pass;
 * - the first version can obey its stop on the like passes;
 * - on one and the same pass, the two must not ask opposite things of what is counted or of a person: what stands
 *   ahead of either stop is not due there, and a stop is due there with every smaller one of its kind;
 * - on an earlier pass, the first version has to go on past it: each of its stops that is then due (a round cap
 *   come due, a stop that counts what the leading one counts and is no larger) needs a person ahead of it who is
 *   asked on that pass, and who is not one the second version needs unasked there.
 */
type Wins = {
  /** the place of the stop that leads on, in the second version's list, and of the stop it would come before, in the first's */
  at: number;
  from: number;
  lead: Stop;
  halt: Stop;
  before: boolean;
  /** where it is before a person's stop: whether that person has been asked by then, on an earlier pass, and has said go on */
  again?: boolean;
};

function leadsOnFirst(was: readonly Stop[], held: (stop: Stop) => boolean, now: readonly Stop[], leadsOn: (stop: Stop) => boolean): Wins[] {
  const [source, copy] = [tried(was), tried(now)];
  const caps = source.timing.flatMap((mine, at) => (mine.sort === "cap" ? [{ from: mine.from, at }] : [])).sort((a, b) => a.from - b.from);
  const found: Wins[] = [];
  now.forEach((lead, j) => {
    const mine = copy.timing[j]!;
    if (mine.sort === "person" || !leadsOn(lead) || copy.always[j]) return;
    // The passes on which the second version can obey this stop.
    const [first, last] = [mine.from, Math.min(copy.over, copy.capAhead[j]! - 1)];
    if (first > last || (mine.sort === "counted" && !(copy.least(mine.key)[j]! > mine.size))) return;
    // The people of the first version who can be asked on that pass: not one who is asked whenever a person ahead of
    // this stop in the second version is, since those are not asked there. By place, the soonest of them ahead of it.
    const asked: number[] = [];
    let soonest = Infinity;
    for (const theirs of source.timing) {
      asked.push(soonest);
      if (theirs.sort === "person" && !(copy.divides(theirs.every) < j)) soonest = Math.min(soonest, theirs.every);
    }
    // The first pass on which the second version can lead on while the first goes on: a stop of the first that is
    // due then, with this one or by a cap come due, has a person ahead of it who is asked on that pass.
    let early = first;
    if (mine.sort === "counted") {
      const due = source.timing.findIndex((theirs) => theirs.sort === "counted" && theirs.key === mine.key && theirs.size <= mine.size);
      if (due >= 0) early = Math.max(early, asked[due]!);
    }
    for (const cap of caps) if (cap.from <= early && early < asked[cap.at]!) early = asked[cap.at]!;
    let same: number | undefined;
    for (const [i, halt] of was.entries()) {
      const theirs = source.timing[i]!;
      // (A person is not the one asked where another, asked whenever they are, stands ahead of them.)
      if (!held(halt) || source.always[i] || (theirs.sort === "person" && source.divides(theirs.every) < i)) continue;
      // The passes on which the first version can obey that stop.
      const [from, until] = [theirs.sort === "person" ? theirs.every : theirs.from, Math.min(source.over, source.capAhead[i]! - 1)];
      if (from > until || (theirs.sort === "counted" && !(source.least(theirs.key)[i]! > theirs.size))) continue;
      // What a budget has reached it has reached on every later pass: one ahead of the stop the first version
      // obeys, and no larger than the one that leads on, would be due there.
      if (mine.sort === "counted" && mine.lasting && !(source.least(mine.key)[i]! > mine.size)) continue;
      // On one pass: a person the first version asks there is not one the second needs unasked (nor one asked
      // whenever such a person is); and neither stop has ahead of it, in the other version, one that is due
      // whenever it is.
      // (The stop the first version obeys, where it is a person's, is obeyed on a pass that is its number of
      // rounds, twice it, three times it: that much of a person's stop is reckoned with exactly.)
      const asks = (low: number, high: number): boolean => low <= high && (theirs.sort !== "person" || Math.ceil(low / theirs.every) * theirs.every <= high);
      const together =
        asks(Math.max(first, from), Math.min(last, until)) &&
        !(theirs.sort === "person" && copy.divides(theirs.every) < j) &&
        !(mine.sort === "counted" && !(source.least(mine.key)[i]! > mine.size)) &&
        !(theirs.sort === "counted" && !(copy.least(theirs.key)[j]! > theirs.size));
      if (Number.isFinite(early) && early <= last && asks(Math.max(from, early + 1), until)) {
        // (Of a person it is said as the asking it takes away on that very pass, where it can.)
        if (theirs.sort === "person" && together) found.push({ at: j, from: i, lead, halt, before: false });
        else found.push({ at: j, from: i, lead, halt, before: true, ...(theirs.sort === "person" ? { again: early >= theirs.every } : {}) });
        return;
      }
      if (together) same ??= i;
    }
    if (same !== undefined) found.push({ at: j, from: same, lead, halt: was[same]!, before: false });
  });
  return found;
}

/** A way by a name that is the same before and after: an edge's id, or a loop and where its stop leads. */
const wayName = (way: Way): string => way.edge ?? `${way.loop} → ${way.to}`;

/**
 * The ways round a loop's nodes that the loop does not count: each way of the graph that lies on a way round through
 * one of the loop's nodes without taking one of its own back edges, and each stop of the loop's own that continues
 * at one of its nodes. An outer loop that leads back in front of the loop is one, and so is a second way from its
 * critic to its builder through a new step, and a stop that leads back in: by each the loop is entered again, and
 * its counters start afresh (graph-ir §2, "Nested loops").
 *
 * With them, for each of the loop's nodes, what closes its ways round (`closers`): another loop, by one of its back
 * edges, or a stop that leads on. A node that gains one has a way round it did not have. A step put into a way round
 * that was there, an edge under another id, or one more back edge of a loop that already took the node round,
 * closes nothing new.
 *
 * `persons` names the ways a person opens (an approval, a gate's answer, the stop where a person is asked) that are
 * taken as part of the graph. One that is not named is left out: a way round that a person newly opens each time is
 * that person's to allow, round by round. One that was there already is no more of a brake on a new way round than
 * it was on the loop's own.
 */
type Rounds = { ways: Map<string, Way>; closers: Map<Id, Set<string>> };

function waysRoundUncounted(doc: Graph, loop: { id: Id; members: readonly Id[]; back: readonly Id[] }, persons: ReadonlySet<string>): Rounds {
  const counted = new Set(loop.back);
  const gates = new Set(doc.nodes.filter((node) => node.kind === "human-gate").map((node) => node.id));
  // (A stop is reckoned a way from every node of its loop, and so from the node it leads to: that is no way round.)
  const ways = waysOf(doc).filter((way) => way.from !== way.to && (way.edge === undefined || !counted.has(way.edge)) && (!way.person || persons.has(wayName(way))));
  const closes = (way: Way): string[] => (way.edge === undefined ? [wayName(way)] : doc.loops.filter((other) => other.id !== loop.id && other.back.includes(way.edge!)).map((other) => other.id));
  const walk = (starts: readonly Id[], step: (id: Id) => Id[]): Set<Id> => {
    const seen = new Set<Id>(starts);
    const queue = [...seen];
    for (let id = queue.pop(); id !== undefined; id = queue.pop()) for (const next of step(id)) if (!seen.has(next)) queue.push((seen.add(next), next));
    return seen;
  };
  // The loop's own stop that continues at one of its nodes: the loop goes on, whatever its count says. (At a human
  // gate a person decides at once, and what the gate then leads to is the gate's.)
  const own = ways.filter((way) => way.loop === loop.id && loop.members.includes(way.to) && !gates.has(way.to));
  const found = new Map<string, Way>(own.map((way) => [wayName(way), way]));
  const closers = new Map<Id, Set<string>>();
  for (const member of loop.members) {
    // From the member, and back to it: a way that starts in the first and ends in the second is on a way round it.
    const out = walk([member], (id) => ways.filter((way) => way.from === id).map((way) => way.to));
    const home = walk([member], (id) => ways.filter((way) => way.to === id).map((way) => way.from));
    const mine = new Set<string>(own.map(wayName));
    for (const way of ways) {
      if (!out.has(way.from) || !home.has(way.to)) continue;
      found.set(wayName(way), way);
      for (const closer of closes(way)) mine.add(closer);
    }
    closers.set(member, mine);
  }
  return { ways: found, closers };
}

/**
 * The loops' stops and bars, by the rounds they count. `fired` is what was found by asking what a run would do at a
 * loop's stops (`leadsOnFirst`): held like the rest, and kept apart because it is said beside whatever else a change
 * is held for, and never in its place.
 */
function loopLosses(before: Graph, after: Graph): { losses: Loss[]; fired: Loss[] } {
  const losses: Loss[] = [];
  const fired: Loss[] = [];
  const still = new Set(after.nodes.map((node) => node.id));
  const known = new Set(before.nodes.map((node) => node.id));
  const waysWas = waysOf(before);
  // The nodes of the graph as it would be that lie on a way round, by any way.
  const waysNow = waysOf(after);
  const round = new Set(after.nodes.filter((node) => [...reachedFrom(after, waysNow.filter((way) => way.from === node.id && way.to !== node.id).map((way) => way.to))].includes(node.id) || waysNow.some((way) => way.edge !== undefined && way.from === node.id && way.to === node.id)).map((node) => node.id));
  const edgeNow = new Map(after.edges.map((edge) => [edge.id, edge]));
  const loopNow = new Map(after.loops.map((loop) => [loop.id, loop]));
  const loopWas = new Map(before.loops.map((loop) => [loop.id, loop]));
  const edgeWas = new Map(before.edges.map((edge) => [edge.id, edge]));
  // The critics the graph had that are critics still: whose verdict a stop on "bar passed" is.
  const critics = new Set(before.nodes.filter((node) => isCriticFamily(node) && after.nodes.some((other) => other.id === node.id && isCriticFamily(other))).map((node) => node.id));
  for (const loop of before.loops) {
    const braked = loop.stops.some(isBrakeStop) || loop.bar !== undefined;
    if (!braked) continue;
    const kept = loopNow.get(loop.id);
    if (!kept) losses.push({ why: "removes a loop with its stops and its bar", at: [`loop:${loop.id}`] });
    // What the loop's stops lead on to: a change there can undo a stop as surely as a change to the stop.
    const targets = [...new Set(loop.stops.flatMap((stop) => (stop.then === undefined ? [] : [`node:${stop.then}.kind`, `node:${stop.then}.outcome`, `node:${stop.then}`])))];
    const was = brakesOf(before, [loop]);
    // The loop under its own id, stop for stop: whatever became of the edges that started its rounds.
    if (kept) {
      for (const why of looser(was, brakesOf(after, [kept]))) losses.push({ why, at: [`loop:${loop.id}.stops`, ...targets] });
      // And stop by stop, as a run would fire them: a stop that leads on, of any kind, old or new, that would win
      // where one of the loop's stops halted or asked a person. One line for each, naming a stop it would come
      // before (on an earlier pass if there is one) and what became of it: a line about where a stop stands in the
      // list would have been as true before a number was lowered.
      const [haltsWas, haltsNow] = [haltsIn(before), haltsIn(after)];
      /** A round cap or a budget that halts; and every stop where a person is asked, wherever the run goes on from it. */
      const held = (stop: Stop): boolean => stop.kind === "human" || (isBrakeStop(stop) && haltsWas(stop));
      /** Whether a critic the loop had among its members is a critic among them still. */
      const judged = (now: Loop, old: Loop | undefined): boolean => now.members.some((member) => (old?.members.includes(member) ?? false) && critics.has(member));
      const halting = (halt: Stop): string => (halt.kind === "human" ? stopName(halt) : `${stopName(halt)} that halts the run`);
      // Each list by the text of its stops, once: where the loop had a stop, where it would have it last, and the
      // stops it had that are gone, by kind. (Looked up for each line below; a loop may hold hundreds of stops.)
      const text = (stop: Stop): string => JSON.stringify(stop);
      const [hadAt, keptAt] = [new Map<string, number>(), new Map<string, number>()];
      loop.stops.forEach((stop, at) => void (hadAt.has(text(stop)) || hadAt.set(text(stop), at)));
      kept.stops.forEach((stop, at) => void keptAt.set(text(stop), at));
      const gone = new Map<string, Stop[]>();
      for (const stop of loop.stops) if (!keptAt.has(text(stop))) (gone.get(stopKind(stop)) ?? gone.set(stopKind(stop), []).get(stopKind(stop))!).push(stop);
      // A person's stop of the loop's that is gone, and one that comes in beside it and continues at the same
      // place: the same stop, asked every other number of rounds.
      const asksNow = kept.stops.filter((stop): stop is Extract<Stop, { kind: "human" }> => stop.kind === "human" && !hadAt.has(text(stop)));
      const where = [`loop:${loop.id}.stops`, ...targets];
      for (const { at: place, from, lead, halt, before: sooner, again } of leadsOnFirst(loop.stops, held, kept.stops, leadsOnIn(haltsNow, judged(kept, loop)))) {
        const name = stopName(lead);
        const leading = lead.then === undefined ? `${name}, which follows the loop's pass edges,` : `${name} that leads on to "${lead.then}"`;
        // Which of the source's stops it would come before, and how. Of a person's stop: the asking it takes away
        // on that very pass; or that it fires before anybody has been asked; or between two askings, after the
        // person has said go on (a stop where a person is asked ends nothing).
        const fires = !sooner
          ? `on the same pass as ${halting(halt)}, where it would be the one obeyed`
          : halt.kind !== "human"
            ? `before ${halting(halt)}`
            : again
              ? `between two askings of ${stopName(halt)}, after the person has said go on`
              : `before ${stopName(halt)} first asks`;
        // What became of it, since where a stop stands in the list was as true before a number was lowered. The
        // loop had it as it is, behind the stop it would now come before, or with something beside it changed; or
        // had one of its kind that is gone, set to another number, or leading elsewhere or nowhere; or had none.
        const stood = hadAt.get(text(lead));
        const kin = gone.get(stopKind(lead)) ?? [];
        const sized = kin.find((stop) => stop.then === lead.then && stopSize(stop) !== stopSize(lead));
        const led = lead.then === undefined ? undefined : kin.find((stop) => stopSize(stop) === stopSize(lead) && stop.then !== lead.then);
        // The stop is as it was and a person is asked on other passes than they were: that is what changed, and on
        // the first pass they were asked on, nobody would be. (A pass, counted from one, and not a numbered round:
        // asked every 3 rounds is asked at the end of the third pass, which is round 2, `graph-ir.md` §2.)
        const every = halt.kind === "human" ? (halt.every ?? 1) : 1;
        const asks = stood !== undefined && halt.kind === "human" && !keptAt.has(text(halt)) ? asksNow.find((stop) => stop.then === halt.then && every % (stop.every ?? 1) !== 0) : undefined;
        const why =
          stood !== undefined
            ? asks
              ? `a person would be asked every ${asks.every ?? 1} rounds where it was every ${every}: on pass ${every} nobody would be asked, and ${leading} could fire on a pass where a person was asked`
              : !sooner && stood > from && (keptAt.get(text(halt)) ?? -1) > place
                ? `${leading} would be moved ahead of ${halting(halt)}, and could fire on the same pass`
                : `${leading} could fire ${fires}, as it could not before`
            : sized
              ? `${leading} would go from ${stopSize(sized)} to ${stopSize(lead)}, and could fire ${fires}`
              : led
                ? `${name} would lead on to "${lead.then}"${led.then === undefined ? "" : `, not to "${led.then}"`}${haltsWas(led) ? ", where it halted the run" : ""}${led === halt ? "" : `, and could fire ${fires}`}`
                : `${leading} would come into the loop, and could fire ${fires}`;
        fired.push({ why, at: where });
      }
      // The same of another loop that comes to count one of this loop's rounds (a second loop put on its back edge),
      // or that counted one and gains such a stop. How the stops of two loops fall on one pass is written nowhere,
      // so a stop of the other loop that leads on is taken to be able to fire first.
      const halt = loop.stops.find(held);
      for (const other of halt ? after.loops : []) {
        const shares = (one: Loop | undefined): boolean => one?.back.some((id) => loop.back.includes(id) || kept.back.includes(id)) ?? false;
        if (other.id === loop.id || !shares(other)) continue;
        const old = loopWas.get(other.id);
        const had = new Set(shares(old) ? old!.stops.map(text) : []);
        // "Bar passed" in a loop that is new: with no `then` the run follows the pass edges, which the verdict of
        // this loop's own critic takes already where that critic is among the new loop's members. With a `then` it
        // leads where the new loop says, on a bar of the new loop's own, and is a stop like the others.
        const leads = (stop: Stop): boolean => leadsOnIn(haltsNow, judged(other, stop.then === undefined ? (old ?? loop) : old))(stop);
        for (const lead of other.stops) {
          if (!leads(lead) || had.has(text(lead))) continue;
          const leading = `${stopName(lead)} among its stops, which ${lead.then === undefined ? "follows that loop's pass edges" : `leads on to "${lead.then}"`},`;
          fired.push({ why: `the loop "${other.id}" would count rounds that "${loop.id}" counts, and ${leading} could fire before ${halting(halt!)}`, at: old ? [`loop:${other.id}.stops`, `loop:${other.id}.back`] : [`loop:${other.id}`] });
        }
      }
      if (loop.bar && kept.bar?.acceptance !== loop.bar.acceptance) losses.push({ why: kept.bar ? "changes the bar's acceptance" : "removes the loop's bar", at: [`loop:${loop.id}.bar`] });
    }
    // And the rounds themselves, by the edge that starts each. A round the loop counted is the loop's: taken out of
    // it, it is counted against no stop of the loop's, whatever the loop that takes it up says of itself (two loops
    // with a cap of 4 each are 8 rounds, where one loop was 4).
    for (const id of loop.back) {
      const edge = edgeWas.get(id);
      if (!edge) continue;
      // The same round afterwards: the edge under its id, or another between the same two nodes.
      const round = edgeNow.has(id) ? [edgeNow.get(id)!] : after.edges.filter((other) => other.from === edge.from && other.to === edge.to);
      for (const next of round) {
        if (kept?.back.includes(next.id)) continue;
        const counting = after.loops.filter((other) => other.back.includes(next.id));
        losses.push({
          why: counting.length === 0 ? `the rounds that "${next.id}" starts would no longer be counted by any loop` : `the rounds that "${next.id}" starts would be counted by ${quote(counting.map((other) => other.id))}, not against the stops of "${loop.id}"`,
          at: [`loop:${loop.id}.back`, `loop:${loop.id}`, ...counting.flatMap((other) => [`loop:${other.id}`, `loop:${other.id}.back`])],
        });
      }
    }
    // A new way round between two nodes the loop bounds, counted by another loop: the same, by an edge that was not there.
    const bounded = new Set(loop.members);
    for (const other of after.loops) {
      if (other.id === loop.id) continue;
      const had = new Set(before.loops.find((old) => old.id === other.id)?.back ?? []);
      for (const id of other.back) {
        const edge = edgeNow.get(id);
        // (One the other loop listed already is no news, unless it has been moved to join two of this loop's nodes.)
        const was = edgeWas.get(id);
        if (!edge || (had.has(id) && was?.from === edge.from && was.to === edge.to) || kept?.back.includes(id) || !bounded.has(edge.from) || !bounded.has(edge.to)) continue;
        losses.push({ why: `a round between "${edge.from}" and "${edge.to}", which the loop "${loop.id}" bounds, would be counted by "${other.id}" and not against its stops`, at: [`loop:${other.id}`, `loop:${other.id}.back`, `edge:${id}`, `edge:${id}.from`, `edge:${id}.to`] });
      }
    }
    // The loop kept by name, with none of the nodes its stops bounded; or without one of them that is still in the
    // graph, whose work each round is then counted against no cap and no budget.
    const dropped = kept ? loop.members.filter((member) => still.has(member) && !kept.members.includes(member)) : [];
    if (kept && loop.members.length > 0 && !loop.members.some((member) => kept.members.includes(member))) {
      losses.push({ why: `the loop "${loop.id}" would keep its stops and bound none of the nodes it did`, at: [`loop:${loop.id}.members`, `loop:${loop.id}.back`] });
    } else if (dropped.length > 0) {
      losses.push({ why: `the loop "${loop.id}" would no longer bound ${quote(dropped)}, which ${dropped.length === 1 ? "is" : "are"} still in the graph`, at: [`loop:${loop.id}.members`] });
    }
    // A node the loop bounded is gone, and a node comes in that goes round and that the loop does not bound: the
    // loop may be left as a shell, with its work done under another name and another loop's stops.
    const gone = kept ? loop.members.filter((member) => !still.has(member)) : [];
    const come = gone.length > 0 ? after.nodes.filter((node) => !known.has(node.id) && !kept!.members.includes(node.id) && node.kind !== "stop" && round.has(node.id)).map((node) => node.id) : [];
    if (come.length > 0) {
      losses.push({ why: `removes ${quote(gone)}, which the loop "${loop.id}" bounded, while ${quote(come)} would come in on a round it does not count: it may be the same step under another name`, at: [...gone.map((id) => `node:${id}`), `loop:${loop.id}.members`] });
    }
    // A step that comes in on the loop's own rounds and is not among its members, where the loop has a budget of
    // dispatches: each round would dispatch it, and the budget would not count it.
    if (kept && kept.stops.some((stop) => stop.kind === "budget" && stop.measure === "dispatches")) {
      const others = new Set(after.loops.filter((other) => other.id !== loop.id).flatMap((other) => other.back));
      const own = waysNow.filter((way) => way.edge !== undefined && !others.has(way.edge));
      const step = (pick: (way: Way) => [Id, Id]) => (id: Id): Id[] => own.filter((way) => pick(way)[0] === id).map((way) => pick(way)[1]);
      const reach = (starts: readonly Id[], next: (id: Id) => Id[]): Set<Id> => {
        const seen = new Set<Id>(starts);
        const queue = [...seen];
        for (let id = queue.pop(); id !== undefined; id = queue.pop()) for (const to of next(id)) if (!seen.has(to)) queue.push((seen.add(to), to));
        return seen;
      };
      const out = reach(kept.members, step((way) => [way.from, way.to]));
      const home = reach(kept.members, step((way) => [way.to, way.from]));
      const unlisted = after.nodes.filter((node) => !known.has(node.id) && (node.kind === "agent" || node.kind === "check") && !kept.members.includes(node.id) && out.has(node.id) && home.has(node.id)).map((node) => node.id);
      if (unlisted.length > 0) losses.push({ why: `${quote(unlisted)} would work on the rounds of the loop "${loop.id}" and not be among its members: its budget of dispatches would not count ${unlisted.length === 1 ? "it" : "them"}`, at: [...unlisted.map((id) => `node:${id}`), `loop:${loop.id}.members`] });
    }
    // A way round the loop's nodes that its stops do not count, and that was not there: by an edge added or moved,
    // by a stop that leads back in, by a loop put around it.
    if (kept) {
      const persons = new Set(waysWas.filter((way) => way.person).map(wayName));
      const free = waysRoundUncounted(before, loop, persons);
      const bounded = [...new Set([...loop.members.filter((member) => still.has(member)), ...kept.members])];
      let named = 0;
      const round = waysRoundUncounted(after, { id: loop.id, members: bounded, back: kept.back }, persons);
      // One of the nodes the loop bounded has a way round it did not have: closed by another loop's back edge, or
      // by a stop, that did not close one for it before.
      const gained = loop.members.some((member) => [...(round.closers.get(member) ?? [])].some((closer) => !free.closers.get(member)?.has(closer)));
      // The ways on it that are new, or that join other nodes than they did.
      const moved = (way: Way): boolean => way.edge !== undefined && edgeWas.has(way.edge) && (edgeWas.get(way.edge)!.from !== way.from || edgeWas.get(way.edge)!.to !== way.to);
      const fresh = gained ? [...round.ways].filter(([name, way]) => !free.ways.has(name) || moved(way)) : [];
      for (const [, way] of fresh) {
        const old = way.edge === undefined ? undefined : edgeWas.get(way.edge);
        const counting = way.edge === undefined ? [] : after.loops.filter((other) => other.back.includes(way.edge!));
        const stopsWere = way.edge === undefined ? before.loops.find((other) => other.id === way.loop)?.stops : undefined;
        const at =
          way.edge === undefined
            ? same(stopsWere, loopNow.get(way.loop!)?.stops)
              ? []
              : [`loop:${way.loop}.stops`, `loop:${way.loop}`]
            : old === undefined
              ? [`edge:${way.edge}`]
              : (["from", "to", "when"] as const).filter((field) => !same(old[field], edgeNow.get(way.edge!)![field])).map((field) => `edge:${way.edge}.${field}`);
        // An edge or a stop that was there, unchanged, is on the new way round because another way closed it: that one is named.
        if (at.length === 0) continue;
        named += 1;
        losses.push({
          why:
            way.edge === undefined
              ? `a stop of the loop "${way.loop}" would lead back to "${way.to}": a way round the nodes of "${loop.id}" that its stops do not count`
              : `"${way.edge}" (${way.from} → ${way.to}) would make a way round the nodes of "${loop.id}" that its stops do not count${counting.length > 0 ? `: ${quote(counting.map((other) => other.id))} would count it, and each time round "${loop.id}" starts afresh` : ""}`,
          at: [...at, ...counting.flatMap((other) => [`loop:${other.id}`, `loop:${other.id}.back`])],
        });
      }
      if (gained && named === 0) losses.push({ why: `there would be a way round the nodes of "${loop.id}" that its stops do not count`, at: [`loop:${loop.id}.members`, `loop:${loop.id}.back`] });
    }
  }
  return { losses, fired };
}

/** Gates, approvals, markers and critics, each by its own id; and what an answer or a verdict leads to. */
function ownLosses(before: Graph, after: Graph): Loss[] {
  const losses: Loss[] = [];
  const nodeNow = new Map(after.nodes.map((node) => [node.id, node]));
  const edgeNow = new Map(after.edges.map((edge) => [edge.id, edge]));
  const edgeWas = new Map(before.edges.map((edge) => [edge.id, edge]));
  const nodeWas = new Map(before.nodes.map((node) => [node.id, node]));
  for (const node of before.nodes) {
    const kept = nodeNow.get(node.id);
    if (node.kind === "human-gate") {
      if (!kept) losses.push({ why: "removes a human gate", at: [`node:${node.id}`] });
      else if (kept.kind !== "human-gate") losses.push({ why: "a human gate becomes another kind of node", at: [`node:${node.id}.kind`] });
      else {
        const lost = (node.options ?? []).filter((option) => !(kept.options ?? []).includes(option));
        if (lost.length > 0) losses.push({ why: `the gate would no longer offer ${quote(lost)}`, at: [`node:${node.id}.options`], gain: true });
      }
    }
    if (markers(node).length > 0) {
      const lost = markers(node).filter((marker) => !markers(kept).includes(marker));
      if (!kept) losses.push({ why: `removes a node marked irreversible (${markers(node).join(", ")}): what takes its place carries no such mark unless it is given one`, at: [`node:${node.id}`], gain: true });
      else if (lost.length > 0) losses.push({ why: `removes the irreversible marker ${quote(lost)}`, at: [`node:${node.id}.irreversible`, `node:${node.id}.kind`] });
    }
    // A check (amendment A-019): the node, its kind, and its definition. A program cannot tell a stricter command
    // from a looser one, so any change to what it runs or what counts as a pass is one a person is asked about.
    // A stop that halts, made to end in success (the dated clause of amendment A-019): what led there to stop the
    // run, a failing verdict, a cap, an answer, would now end it well. Held wherever the stop stands.
    if (node.kind === "stop" && node.outcome === "halt" && kept?.kind === "stop" && succeeds(kept)) {
      losses.push({ why: `the stop "${node.id}" would end in success where it halted: what led there to stop the run would now end it well`, at: [`node:${node.id}.outcome`] });
    }
    if (node.kind === "check") {
      // Removed, or made another kind of node, while a check the graph has not comes in: it may be this check under
      // another id, and the name that allows it then allows whatever was done to the check on the way. The line shows
      // what comes in, and says so. (The id kept by a step of another kind, with a new check taking its edges, is the
      // same swap as the id given away: a reader got that one printed with the arrival as a tightening.)
      const come = after.nodes.filter((other): other is Extract<Node, { kind: "check" }> => other.kind === "check" && nodeWas.get(other.id)?.kind !== "check");
      const shown = come
        .map((other) => `"${other.id}": ${other.check.run === undefined ? `of kind "${other.check.kind}"` : `runs ${JSON.stringify(other.check.run)}`}, passes on ${JSON.stringify(other.check.pass)}${other.check.threshold === undefined ? "" : `, threshold ${other.check.threshold}`}`)
        .join(", and ");
      const arrival = `while ${come.length === 1 ? "a check" : "checks"} the graph has not ${come.length === 1 ? "comes" : "come"} in (${shown}): if that is this check under another id, allowing this`;
      if (!kept && come.length > 0) {
        losses.push({ why: `removes a check, ${arrival} name allows every change made to it and every way round it`, at: [`node:${node.id}`], swap: "removes a check" });
      } else if (!kept) losses.push({ why: "removes a check", at: [`node:${node.id}`] });
      else if (kept.kind !== "check" && come.length > 0) {
        losses.push({ why: `a check becomes another kind of node, ${arrival} change allows every change made to it and every way round it`, at: [`node:${node.id}.kind`, `node:${node.id}.check`], swap: "a check becomes another kind of node" });
      } else if (kept.kind !== "check") losses.push({ why: "a check becomes another kind of node", at: [`node:${node.id}.kind`, `node:${node.id}.check`] });
      else {
        // Key by key, so that the order they are written in is no change, and a key the schema does not know is named.
        const [was, now] = [node.check as Record<string, unknown>, kept.check as Record<string, unknown>];
        const parts = [...new Set([...Object.keys(was), ...Object.keys(now)])].filter((part) => !same(was[part], now[part]));
        if (parts.length > 0) losses.push({ why: `changes the check's definition (${parts.join(", ")}): what it runs and what counts as a pass may be tightened and not loosened, and a program cannot tell which this is`, at: [`node:${node.id}.check`] });
      }
    }
    if (isCriticFamily(node)) {
      if (!kept) losses.push({ why: "removes a critic", at: [`node:${node.id}`] });
      else if (!isCriticFamily(kept)) losses.push({ why: kept.kind === "agent" ? "a critic is given another role" : "a critic becomes another kind of node", at: [`node:${node.id}.role`, `node:${node.id}.kind`] });
      // What the critic is handed, and how. By the node that hands it: over every edge from that node into the
      // critic, so that an edge under a new id is no way out, and what one node handed is not made up for by another.
      const into = (doc: Graph): Edge[] => doc.edges.filter((edge) => edge.to === node.id);
      const edgeIds = new Set(before.edges.map((edge) => edge.id));
      for (const edge of kept ? into(before) : []) {
        // Where what this edge handed is handed now: on the edge itself, if it still leads from that node to the
        // critic; otherwise on the edges that are new, from the same node or from a new step that node leads to.
        const own = edgeNow.get(edge.id);
        const stepped = new Set(after.edges.filter((other) => other.from === edge.from && !nodeWas.has(other.to)).map((other) => other.to));
        const carriers = own && own.from === edge.from && own.to === node.id ? [own] : into(after).filter((other) => !edgeIds.has(other.id) && (!nodeNow.has(edge.from) || other.from === edge.from || stepped.has(other.from)));
        const handed = new Set(carriers.flatMap((other) => other.evidence ?? []));
        const lost = (edge.evidence ?? []).filter((piece) => !handed.has(piece));
        if (lost.length > 0) losses.push({ why: `the critic would no longer be handed ${quote(lost)} by "${edge.from}"`, at: [`edge:${edge.id}.evidence`, `edge:${edge.id}.to`, `edge:${edge.id}.from`, `edge:${edge.id}`, `node:${edge.from}`] });
      }
      for (const edge of into(after)) {
        const old = before.edges.find((other) => other.id === edge.id);
        if (edgeIsolation(edge) === "shared" && !(old && old.to === node.id && edgeIsolation(old) === "shared")) {
          losses.push({ why: "the critic would share its builder's context", at: [`edge:${edge.id}.isolation`, `edge:${edge.id}.to`, `edge:${edge.id}`] });
        }
      }
    }
  }
  for (const edge of before.edges) {
    const kept = edgeNow.get(edge.id);
    if (edge.approval === true) {
      if (!kept) losses.push({ why: "removes an edge that needs a person's approval", at: [`edge:${edge.id}`, `node:${edge.from}`, `node:${edge.to}`] });
      else if (kept.approval !== true) losses.push({ why: "removes a person's approval from the edge", at: [`edge:${edge.id}.approval`] });
      // A second edge between the same two nodes that needs none: the run goes the same way with nobody asked. (What
      // a run reaches cannot show it where another road leads to the same node.)
      for (const twin of kept ? after.edges : []) {
        if (twin.id === edge.id || twin.from !== kept!.from || twin.to !== kept!.to || twin.approval === true) continue;
        const old = edgeWas.get(twin.id);
        const moved = old === undefined ? [`edge:${twin.id}`] : (["from", "to", "approval"] as const).filter((field) => !same(old[field], twin[field])).map((field) => `edge:${twin.id}.${field}`);
        if (moved.length > 0) losses.push({ why: `"${twin.id}" would lead from "${twin.from}" to "${twin.to}" beside "${edge.id}", which needs a person's approval, and need none`, at: moved });
      }
    }
    const from = nodeWas.get(edge.from);
    // An answer the gate gave that no edge takes any more.
    if (from?.kind === "human-gate" && nodeNow.get(edge.from)?.kind === "human-gate" && !after.edges.some((other) => other.from === edge.from && whenOf(other) === whenOf(edge))) {
      // Laid at the edge, or at the node it led to when it goes with that node.
      losses.push({ why: `"${whenOf(edge)}" at the human gate "${edge.from}" would lead nowhere`, at: [`edge:${edge.id}`, `edge:${edge.id}.from`, `edge:${edge.id}.when`, `node:${edge.to}`], gain: true });
    }
    if (!kept || whenOf(kept) === whenOf(edge)) continue;
    if (edge.approval === true || from?.kind === "human-gate") losses.push({ why: "changes what a person's answer leads to", at: [`edge:${edge.id}.when`] });
    else if (from && isCriticFamily(from)) losses.push({ why: "changes what the critic's verdict leads to", at: [`edge:${edge.id}.when`] });
  }
  const policyNow = new Map((after.policies ?? []).map((policy) => [policy.id, policy]));
  for (const policy of before.policies ?? []) {
    const why = policy.kind === "critic-isolation" ? "removes critic isolation" : policy.kind === "no-self-grading" ? "lets a node grade its own work" : policy.kind === "no-live-graph-rewrite" ? "lets a run rewrite the graph where it could only propose" : undefined;
    const kept = policyNow.get(policy.id);
    const changed = kept ? (["kind", "scope", "params"] as const).filter((field) => !same(kept[field], policy[field])) : [];
    if (why === undefined || (kept && changed.length === 0)) continue;
    losses.push({ why, at: kept ? changed.map((field) => `policy:${policy.id}.${field}`) : [`policy:${policy.id}`] });
  }
  return losses;
}

const succeeds = (node: Node): boolean => node.kind === "stop" && (node.outcome ?? "success") === "success";

/** The nodes from which a run can come to a stop that ends in success without a decision: back from those stops, along every way not shut. */
function endsFrom(doc: Graph, ways: readonly Way[], closed: Closed): Set<Id> {
  const back = new Map<Id, Id[]>();
  for (const way of ways) if (!shut(way, closed)) (back.get(way.to) ?? back.set(way.to, []).get(way.to)!).push(way.from);
  const can = new Set(doc.nodes.filter(succeeds).map((node) => node.id));
  const queue = [...can];
  for (let id = queue.pop(); id !== undefined; id = queue.pop()) {
    for (const from of back.get(id) ?? []) {
      if (can.has(from)) continue;
      can.add(from);
      queue.push(from);
    }
  }
  return can;
}

/**
 * What a run comes to reach, and how it comes to end, around a decision it had to pass (`reach.ts`). `later` is what
 * was found by asking from every node and not only from the start: said only for a change that carries no reason
 * from anything else, since the same change is often named more exactly there.
 */
function reachLosses(before: Graph, after: Graph): { losses: Loss[]; later: Loss[] } {
  const losses: Loss[] = [];
  const known = new Set(before.nodes.map((node) => node.id));
  const still = new Set(after.nodes.map((node) => node.id));
  const free = reachedWithout(after, "every");
  for (const node of after.nodes) {
    if (!known.has(node.id) && markers(node).length > 0 && free.has(node.id)) losses.push({ why: "adds an irreversible step that a run reaches without a person", at: [`node:${node.id}`] });
  }
  const edgeWas = new Map(before.edges.map((edge) => [edge.id, edge]));
  const edgeNow = new Map(after.edges.map((edge) => [edge.id, edge]));
  const loopWas = new Map(before.loops.map((loop) => [loop.id, loop]));
  const loopNow = new Map(after.loops.map((loop) => [loop.id, loop]));
  const starts = new Set(startsOf(after));
  const backWas = new Set(before.loops.flatMap((loop) => loop.back));
  const ways = waysOf(after);
  const waysWas = waysOf(before);
  const replaced = new Set<string>();
  // A way around a gate is a way around a person, and is said once: as the widest decision it goes around. A way
  // around a critic is another matter, and is said as well.
  const told = new Set<string>();
  /** Where a run at a node could come to before, by any way: what a decision can be said to stand between. */
  const could = new Map<Id, Set<Id>>();
  const couldReach = (id: Id): Set<Id> => could.get(id) ?? could.set(id, reachedFrom(before, [id])).get(id)!;
  /** What is found from every node (below), said after the rest and only for a change that carries no reason yet. */
  const later: [Closed, Id, Loss][] = [];
  const tell = (closed: Closed, about: Id, loss: Loss): void => {
    const key = `${closed !== "every" && "critic" in closed ? closed.critic : ""}\n${about}\n${loss.at.join(" ")}`;
    if (told.has(key)) return;
    told.add(key);
    losses.push(loss);
  };
  for (const closed of decisionsShared(before, after)) {
    const was = reachedWithout(before, closed);
    const reached = reachedWithout(after, closed);
    const past = `that does not pass ${decisionName(closed)}`;

    // A step that was behind the decision goes, and a step comes in that is not behind it: it may be the same step.
    // (Said once for a node under the people's decisions, and once under each critic's or check's: a step that was
    // behind a critic and a check names both.)
    const whose = `${closed !== "every" && "critic" in closed ? closed.critic : ""}\n`;
    const gone = before.nodes.filter((node) => !still.has(node.id) && !was.has(node.id) && !replaced.has(whose + node.id));
    const come = after.nodes.filter((node) => !known.has(node.id) && reached.has(node.id));
    if (come.length > 0) {
      for (const node of gone) {
        replaced.add(whose + node.id);
        losses.push({ why: `removes "${node.id}", which a run reached only by passing ${decisionName(closed)}, while ${quote(come.map((n) => n.id))} would come in with no such need: it may be the same step under another name`, at: [`node:${node.id}`] });
      }
    }

    let named = 0;
    /**
     * The changes a way of the after graph may be laid at, if it is new or the decision no longer shuts it: an edge
     * added or moved, a stop that leads on, a node that decides no longer. Undefined for a way that was there, open.
     */
    const changeOf = (way: Way): string[] | undefined => {
      if (way.edge !== undefined) {
        const old = edgeWas.get(way.edge);
        if (!old) return [`edge:${way.edge}`];
        const fields = (["from", "to", "approval", "when"] as const).filter((field) => !same(old[field], edgeNow.get(way.edge!)![field]));
        if (fields.length > 0) return fields.map((field) => `edge:${way.edge}.${field}`);
        // The same edge, unchanged, that the decision shut before: the node it leaves decides no longer.
        return waysWas.some((other) => other.edge === way.edge && shut(other, closed)) ? [`node:${way.from}.kind`, `node:${way.from}.role`] : undefined;
      }
      const old = loopWas.get(way.loop!);
      if (!old) return [`loop:${way.loop}`];
      const fields = (["stops", "members"] as const).filter((field) => !same(old[field], loopNow.get(way.loop!)![field]));
      return fields.length > 0 ? fields.map((field) => `loop:${way.loop}.${field}`) : undefined;
    };
    const say = (about: Id, loss: Loss): void => {
      named += 1;
      tell(closed, about, loss);
    };

    // Forwards: what a run comes to reach. Every node newly reached is reached by a way that is new, or that the
    // decision no longer shuts. Each such way is named, also one that starts at a node newly reached itself:
    // allowing the first must not let in the second.
    const opened = new Set(after.nodes.filter((node) => known.has(node.id) && !was.has(node.id) && reached.has(node.id)).map((node) => node.id));
    for (const way of opened.size > 0 ? ways : []) {
      if (shut(way, closed) || !reached.has(way.from) || !opened.has(way.to)) continue;
      const at = changeOf(way);
      if (!at) continue;
      if (way.edge === undefined) say(way.to, { why: `a stop of the loop would lead on to "${way.to}", a way ${past}`, at });
      else say(way.to, { why: `${edgeWas.has(way.edge) ? "opens" : "adds"} a way into "${way.to}" ${past}`, at });
    }
    // From anywhere, and not only from the start: a node that a run standing at another could come to only by the
    // decision, and can without it afterwards. The node may be one a run reaches anyway by another road, so that
    // nothing above is newly reached: a second edge beside the one that needs approval; an edge from a critic back to
    // its builder, where every way back had passed the gate.
    // (Asked of a whole decision, as the way a run ends is below: another answer at the same gate is the same
    // person's, and a new one that leads where "reject" led has gone around nobody.)
    const whole = closed === "every" || !("when" in closed) || closed.when === undefined;
    // (Not from the gate or the critic that decides: a stop is reckoned a way from every node of its loop, and
    // from there it would look like a way round the node's own answer.)
    const decides = closed === "every" ? undefined : "gate" in closed ? closed.gate : "critic" in closed ? closed.critic : undefined;
    for (const from of whole ? after.nodes : []) {
      if (!known.has(from.id) || from.id === decides) continue;
      const without = reachedFrom(before, [from.id], closed);
      const now = reachedFrom(after, [from.id], closed);
      const around = new Set([...now].filter((id) => known.has(id) && !without.has(id) && couldReach(from.id).has(id)));
      // Kept for last: where the same change has been named for a reason above, under any decision, that is the one said.
      for (const way of around.size > 0 ? ways : []) {
        if (way.from === way.to || shut(way, closed) || !now.has(way.from) || !around.has(way.to)) continue;
        const at = changeOf(way);
        if (!at) continue;
        const why = way.edge === undefined ? `a stop of the loop would lead on from "${way.from}" to "${way.to}", a way ${past}` : `${edgeWas.has(way.edge) ? "opens" : "adds"} a way from "${way.from}" to "${way.to}" ${past}`;
        later.push([closed, way.to, { why, at }]);
      }
    }

    // A node newly reached because nothing leads to it any more: a run starts there.
    for (const id of opened) {
      if (!starts.has(id)) continue;
      const why = `nothing would lead to "${id}", so a run would start there, where every way to it passed ${decisionName(closed)}`;
      for (const edge of before.edges) {
        if (edge.to !== id || backWas.has(edge.id)) continue;
        const now = edgeNow.get(edge.id);
        if (now && now.to !== id) say(`start ${id}`, { why, at: [`edge:${edge.id}.to`] });
        else if (now) say(`start ${id}`, { why, at: after.loops.filter((loop) => loop.back.includes(edge.id)).flatMap((loop) => [`loop:${loop.id}.back`, `loop:${loop.id}`]) });
        // Gone: with the node it came from, or by a change of its own.
        else say(`start ${id}`, { why, at: [still.has(edge.from) ? `edge:${edge.id}` : `node:${edge.from}`] });
      }
    }

    // Backwards: how a run comes to end. A node from which a run could end in success only by the decision, and can
    // without it afterwards, has a way to a good end around the decision: by a stop that is new, by a stop that
    // comes to end in success, or by an edge to either. No node need be newly reached for that.
    // (Asked of a whole decision, not of one answer: a run that ends well by a gate's "approve" has not gone around
    // its "reject".)
    // And asked of one answer where that answer is a verdict's "pass", a critic's or a check's: a run that comes to
    // end in success on another verdict has not passed. (Under the whole verdict every edge the judge has is shut,
    // so a failing verdict led to a stop that ends in success, one the run adds, one the graph had, or a step made
    // one, showed nothing.) A gate's answers are all the person's, and are not asked one by one.
    // A judge with no verdict written "pass" and more than one word of its own (a critic that says "clean" or
    // "finding") is asked of each word it has: a program cannot tell which of them is the good one.
    const words = typeof closed === "object" && "critic" in closed && closed.when !== undefined ? new Set(before.edges.filter((edge) => edge.from === closed.critic).map(whenOf)) : new Set<string>();
    const worded = words.size > 1 && !words.has("pass");
    const ends = whole || worded || (typeof closed === "object" && "critic" in closed && closed.when === "pass");
    const endWas = ends ? endsFrom(before, waysWas, closed) : new Set<Id>();
    const endNow = ends ? endsFrom(after, ways, closed) : new Set<Id>();
    const freed = new Set(after.nodes.filter((node) => node.kind !== "stop" && known.has(node.id) && !endWas.has(node.id) && endNow.has(node.id)).map((node) => node.id));
    for (const way of freed.size > 0 ? ways : []) {
      if (shut(way, closed) || !freed.has(way.from) || !endNow.has(way.to)) continue;
      const at = changeOf(way);
      // Said once for a change under one decision: where the way into a node has been named above, the way on from
      // it is the same loss. Another decision's reason at the same change is its own, and is said as well: a way that
      // goes round a check and a critic names both.
      const mine = `${closed !== "every" && "critic" in closed ? closed.critic : ""}\n`;
      if (at && ![...told].some((key) => key.startsWith(mine) && key.endsWith(`\n${at.join(" ")}`))) say(`ends ${way.to}`, { why: `adds a way from "${way.from}" to end in success ${past}`, at });
      else if (at) named += 1;
    }
    const succeededWas = new Set(before.nodes.filter(succeeds).map((node) => node.id));
    for (const node of freed.size > 0 ? after.nodes : []) {
      if (succeeds(node) && known.has(node.id) && !succeededWas.has(node.id) && endNow.has(node.id)) say(`ends ${node.id}`, { why: `a run could end in success at "${node.id}", a way ${past}`, at: [`node:${node.id}.outcome`, `node:${node.id}.kind`] });
    }

    // Something opened and no change could be named for it: any change may be the one.
    if (named === 0 && (opened.size > 0 || freed.size > 0)) {
      losses.push({ why: opened.size > 0 ? `a run would reach ${quote([...opened])} by a way ${past}` : `a run could end in success from ${quote([...freed])} by a way ${past}`, at: [] });
    }
  }
  return { losses, later: later.map(([, , loss]) => loss) };
}

/**
 * What is no loss and is still to be said: a way round a loop's nodes that its stops do not count, opened each time
 * by a person who was not asked there before (a new answer at a gate, an approval newly needed, a stop where a
 * person is asked that continues inside). The person is the brake on it, so nothing is held; but the loop's cap and
 * budget then count the rounds between two of that person's decisions, and no longer the run. One line for each
 * such loop, naming where the person is asked.
 */
export function roundsLeftToAPerson(before: Graph, after: Graph): string[] {
  const notes: string[] = [];
  const persons = new Set(waysOf(before).filter((way) => way.person).map(wayName));
  const every = new Set(waysOf(after).filter((way) => way.person).map(wayName));
  const still = new Set(after.nodes.map((node) => node.id));
  const gates = new Set(after.nodes.filter((node) => node.kind === "human-gate").map((node) => node.id));
  for (const loop of before.loops) {
    const kept = after.loops.find((other) => other.id === loop.id);
    if (!kept || !(loop.stops.some(isBrakeStop) || loop.bar !== undefined)) continue;
    const bounded = { id: loop.id, members: [...new Set([...loop.members.filter((member) => still.has(member)), ...kept.members])], back: kept.back };
    const free = waysRoundUncounted(before, loop, persons);
    // With every way a person opens taken as part of the graph: the ways round that are there only by one newly opened.
    const opened = [...waysRoundUncounted(after, bounded, every).ways].filter(([name, way]) => way.person && !persons.has(name) && !free.ways.has(name));
    if (opened.length === 0) continue;
    const by = [...new Set(opened.map(([, way]) => (way.edge === undefined ? `the stop where a person is asked, which continues at "${way.to}"` : gates.has(way.from) ? `"${way.when}" at the human gate "${way.from}" (${way.edge})` : `the approval asked on "${way.edge}"`)))];
    const counts = [...brakesOf(after, [kept])].filter(([key]) => key !== "human").map(([, brake]) => `${brake.name} (${brake.halt ?? brake.any}${brake.unit})`);
    notes.push(
      `the loop "${loop.id}": ${counts.length > 0 ? counts.join(" and ") : "its stops"} would count the rounds between two of a person's decisions, and no longer the whole run. A way round its nodes that they do not count is opened each time by ${by.join(", and by ")}`,
    );
  }
  return notes;
}

/**
 * The edges that leave a check, changed, added or removed (amendment A-019): where a check's verdicts lead is a brake,
 * and a program cannot tell which way a change to it goes. One loss for each name, so that each can be judged, and
 * asked for, by itself.
 */
function checkEdgeLosses(before: Graph, after: Graph): Loss[] {
  const losses: Loss[] = [];
  // Said on every such line, so that nobody who tightened one thinks they did something wrong.
  const either = "a program cannot tell which way this goes, so it is held either way, and an honest change (a gate put behind the check's pass, more evidence handed to a builder) costs one --allow too, the price of a rule a program can apply";
  const stays = new Set(before.nodes.filter((node) => node.kind === "check" && after.nodes.some((other) => other.id === node.id && other.kind === "check")).map((node) => node.id));
  const still = new Set(after.nodes.map((node) => node.id));
  const edgeWas = new Map(before.edges.map((edge) => [edge.id, edge]));
  const edgeNow = new Map(after.edges.map((edge) => [edge.id, edge]));
  for (const edge of before.edges) {
    if (!stays.has(edge.from)) continue;
    const kept = edgeNow.get(edge.id) as Record<string, unknown> | undefined;
    if (!kept) {
      losses.push({ why: `removes "${edge.id}", an edge that leaves the check "${edge.from}": ${either}`, at: [still.has(edge.to) ? `edge:${edge.id}` : `node:${edge.to}`], either: true });
      continue;
    }
    for (const field of new Set([...Object.keys(edge), ...Object.keys(kept)])) {
      // (`when: "pass"` and `when: { verdict: "pass" }` are one condition written two ways.)
      const changed = field === "when" ? whenOf(edge) !== whenOf(kept as Edge) : !same((edge as Record<string, unknown>)[field], kept[field]);
      if (field !== "id" && changed) losses.push({ why: `changes "${edge.id}", an edge that leaves the check "${edge.from}" (${field}): ${either}`, at: [`edge:${edge.id}.${field}`], either: true });
    }
  }
  for (const edge of after.edges) {
    if (!stays.has(edge.from)) continue;
    const old = edgeWas.get(edge.id);
    if (!old) losses.push({ why: `adds "${edge.id}", an edge that leaves the check "${edge.from}": ${either}`, at: [`edge:${edge.id}`], either: true });
    else if (old.from !== edge.from) losses.push({ why: `moves "${edge.id}" to leave the check "${edge.from}": ${either}`, at: [`edge:${edge.id}.from`], either: true });
  }
  return losses;
}

/**
 * A loop that a check judges, with no critic among its members, given a bar or a stop on "bar passed" (amendment
 * A-019, the way round a check): the lead is told to stop when the bar's words hold, and a stop on "bar passed"
 * follows the edges the check's pass takes or leads on by itself. Either is a way out of the loop that does not
 * pass the check. A critic the same change brings in does not make it one that does: it is no critic the graph had.
 */
function checkLoopLosses(before: Graph, after: Graph): Loss[] {
  const losses: Loss[] = [];
  const nodeWas = new Map(before.nodes.map((node) => [node.id, node]));
  const loopWas = new Map(before.loops.map((loop) => [loop.id, loop]));
  const passed = (loop: Loop | undefined): boolean => loop?.stops.some((stop) => stop.kind === "bar-passed") ?? false;
  for (const loop of after.loops) {
    const old = loopWas.get(loop.id);
    const was = (id: Id): Node | undefined => nodeWas.get(id);
    const checks = loop.members.filter((member) => was(member)?.kind === "check" && after.nodes.some((node) => node.id === member && node.kind === "check"));
    // Judged by a critic already: by one among the members the loop had, who is a critic still. A critic of the
    // graph's own named among the members now, of a kept loop or of a new one, is not that: it was never this
    // loop's. Nor is one the same change gives another role: allowing that would let the bar ride through unnamed.
    const critic = (id: Id): boolean => was(id) !== undefined && isCriticFamily(was(id)!) && after.nodes.some((node) => node.id === id && isCriticFamily(node));
    const had = old?.members.some(critic) ?? false;
    if (checks.length === 0 || had) continue;
    const judged = old ? `the loop "${loop.id}", which the check ${quote(checks)} judges with no critic` : `the new loop "${loop.id}", around the check ${quote(checks)}`;
    if (loop.bar !== undefined && old?.bar === undefined) losses.push({ why: `gives ${judged}, a bar of its own: the lead would stop on the bar's words, a way out that does not pass the check`, at: old ? [`loop:${loop.id}.bar`] : [`loop:${loop.id}`] });
    if (passed(loop) && !passed(old)) losses.push({ why: `adds a stop on "bar passed" to ${judged}: a way out that does not pass the check`, at: old ? [`loop:${loop.id}.stops`] : [`loop:${loop.id}`] });
  }
  return losses;
}

/**
 * The two changes to an edge that leaves a check that can only tighten (amendment A-019's exception), by the names
 * they would be held under: an approval newly asked on the edge; and evidence the comparison already counts, which
 * is more handed along an edge that led into a critic before and does still, with nothing that was handed taken away.
 * Told from the two documents and not by running the comparison backwards: a reader made the edge's target a critic
 * in the same change and replaced what it was handed, and backwards that read as a piece the critic would lose.
 */
function onlyTightens(before: Graph, after: Graph): Set<string> {
  const names = new Set<string>();
  const critic = (doc: Graph, id: Id): boolean => doc.nodes.some((node) => node.id === id && isCriticFamily(node));
  const edgeNow = new Map(after.edges.map((edge) => [edge.id, edge]));
  for (const edge of before.edges) {
    const kept = edgeNow.get(edge.id);
    if (!kept) continue;
    if (edge.approval !== true && kept.approval === true) names.add(`edge:${edge.id}.approval`);
    const [was, now] = [edge.evidence ?? [], kept.evidence ?? []];
    if (kept.to === edge.to && critic(before, edge.to) && critic(after, edge.to) && was.every((piece) => now.includes(piece))) names.add(`edge:${edge.id}.evidence`);
  }
  return names;
}

/**
 * The loops, by the name of their stops, in which the first of two versions has a stop that leads on which the
 * second has not (new, or set to another number or another place), or has behind a stop that it stands ahead of
 * here. A stop that leads on is one whose `then` is a node the run goes on from: a step, a human gate, on from a
 * person who was asked; and a stop on "bar passed". One whose `then` is a stop that halts ends the run there, as
 * one with no `then` does: it is a stop that halts, however it is written. Read with the first version as what a
 * change would write: the change brings in a stop that leads on, changes one or puts one ahead.
 */
function leadsBroughtIn(before: Graph, after: Graph): Set<string> {
  const names = new Set<string>();
  const ends = new Set(before.nodes.filter((node) => node.kind === "stop" && node.outcome === "halt").map((node) => node.id));
  const leads = (stop: Stop): boolean => stop.kind === "bar-passed" || (stop.then !== undefined && !ends.has(stop.then));
  for (const loop of before.loops) {
    const other = after.loops.find((one) => one.id === loop.id);
    if (!other) continue;
    // Where each stop stands in the other version: the first of a text with the first of that text, the second with
    // the second (a loop may hold the same stop twice).
    const places = new Map<string, number[]>();
    other.stops.forEach((stop, at) => void (places.get(JSON.stringify(stop)) ?? places.set(JSON.stringify(stop), []).get(JSON.stringify(stop))!).push(at));
    const known = new Set(places.keys());
    const stood = loop.stops.map((stop) => places.get(JSON.stringify(stop))?.shift());
    // From the end of the list: the earliest place, in the other version, of a stop that stands behind this one here.
    // (A stop written a second time, where the other version has it once, is the same stop again and nothing new.)
    let behind = Infinity;
    let brought = false;
    for (let at = loop.stops.length - 1; at >= 0; at -= 1) {
      const was = stood[at];
      brought ||= leads(loop.stops[at]!) && (was === undefined ? !known.has(JSON.stringify(loop.stops[at])) : was > behind);
      if (was !== undefined) behind = Math.min(behind, was);
    }
    if (brought) names.add(`loop:${loop.id}.stops`);
  }
  return names;
}

/** Every brake `after` has lost or loosened that `before` had; empty when it has lost none. */
export function brakesLost(before: Graph, after: Graph): Loss[] {
  const brought = leadsBroughtIn(before, after);
  return brought.size === 0 ? brakesCompared(before, after) : brakesCompared(before, after).map((loss) => (loss.at.some((name) => brought.has(name)) ? { ...loss, gain: true as const } : loss));
}

function brakesCompared(before: Graph, after: Graph): Loss[] {
  const made = [...comparison(before, after), ...checkLoopLosses(before, after)];
  // A change to an edge that leaves a check is held. The exception is narrower than "whatever the comparison would
  // call a tightening": the comparison names every change on a way it finds opened, which is the safe side when it
  // holds and the unsafe side when it lets through (a failure re-pointed at a second stop that ends in success, with
  // an approval asked beside it, read as a tightening). So only an approval newly asked and evidence that is
  // counted pass, and only where the comparison lays no loss at that name.
  const leaving = checkEdgeLosses(before, after);
  if (leaving.length === 0) return made;
  const loosens = new Set(made.flatMap((loss) => loss.at));
  const tightens = onlyTightens(before, after);
  return [...made, ...leaving.filter((loss) => !(tightens.has(loss.at[0]!) && !loosens.has(loss.at[0]!)))];
}

/** The comparison apart from the edges that leave a check, which are judged by running it both ways. */
function comparison(before: Graph, after: Graph): Loss[] {
  const seen = new Set<string>();
  const reach = reachLosses(before, after);
  const loops = loopLosses(before, after);
  const own = ownLosses(before, after);
  const first = [...own, ...loops.losses, ...reach.losses];
  const named = new Set(first.flatMap((loss) => loss.at));
  const told = new Set<string>();
  // From every node: one reason for each set of changes, and only where none of them carries a reason already.
  // (What a run would do at a loop's stops is no such reason: a way round that is laid at the loop's stops and at
  // another change beside them stays laid at both, as it was before stops were compared so.)
  const last = reach.later.filter((loss) => !loss.at.some((name) => named.has(name)) && !told.has(loss.at.join(" ")) && told.add(loss.at.join(" ")));
  return [...own, ...loops.losses, ...loops.fired, ...reach.losses, ...last].filter((loss) => {
    const key = `${loss.why}\n${loss.at.join(" ")}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
