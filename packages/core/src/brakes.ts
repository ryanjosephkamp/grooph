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
 *   where one that leads on first leads; the bar's acceptance. And each edge that starts a round stays the loop's,
 *   each node the loop bounded stays among its members (or goes with nothing unbounded coming in to do its work),
 *   no step comes onto its rounds that a budget of dispatches does not count, and no way round its nodes comes in
 *   that its stops do not count: a loop around it, a second way back through a new step, a stop of its own that
 *   continues inside it.
 * - **Critics.** Each critic, what each node hands it and in what context, and what a run reaches or how it ends
 *   without its verdict; the policies that say so.
 *
 * Three readers were asked, one after another, to break this as a refresh, and two more as an adoption, and each
 * found what the one before had not: this list is what a brake has been found to be, not a proof that nothing is
 * missing from it.
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
};

const same = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b);
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

function brakesOf(doc: Graph, loops: readonly Loop[]): Map<string, Brake> {
  const nodes = new Map(doc.nodes.map((node) => [node.id, node]));
  const halts = (stop: Stop): boolean => {
    if (stop.then === undefined) return true;
    const target = nodes.get(stop.then);
    return target?.kind === "human-gate" || (target?.kind === "stop" && target.outcome === "halt");
  };
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

/** How the stops of the rounds an edge starts have loosened, from the loop that counted them to the loops that would. */
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

/** The loops' stops and bars, by the rounds they count. */
function loopLosses(before: Graph, after: Graph): Loss[] {
  const losses: Loss[] = [];
  const still = new Set(after.nodes.map((node) => node.id));
  const known = new Set(before.nodes.map((node) => node.id));
  const waysWas = waysOf(before);
  // The nodes of the graph as it would be that lie on a way round, by any way.
  const waysNow = waysOf(after);
  const round = new Set(after.nodes.filter((node) => [...reachedFrom(after, waysNow.filter((way) => way.from === node.id && way.to !== node.id).map((way) => way.to))].includes(node.id) || waysNow.some((way) => way.edge !== undefined && way.from === node.id && way.to === node.id)).map((node) => node.id));
  const edgeNow = new Map(after.edges.map((edge) => [edge.id, edge]));
  const loopNow = new Map(after.loops.map((loop) => [loop.id, loop]));
  const edgeWas = new Map(before.edges.map((edge) => [edge.id, edge]));
  for (const loop of before.loops) {
    const braked = loop.stops.some(isBrakeStop) || loop.bar !== undefined;
    if (!braked) continue;
    const kept = loopNow.get(loop.id);
    if (!kept) losses.push({ why: "removes a loop with its stops and its bar", at: [`loop:${loop.id}`] });
    // What the loop's stops lead on to: a change there can undo a stop as surely as a change to the stop.
    const targets = loop.stops.flatMap((stop) => (stop.then === undefined ? [] : [`node:${stop.then}.kind`, `node:${stop.then}.outcome`, `node:${stop.then}`]));
    const was = brakesOf(before, [loop]);
    // The loop under its own id, stop for stop: whatever became of the edges that started its rounds.
    if (kept) {
      for (const why of looser(was, brakesOf(after, [kept]))) losses.push({ why, at: [`loop:${loop.id}.stops`, ...targets] });
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
  return losses;
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
        if (lost.length > 0) losses.push({ why: `the gate would no longer offer ${quote(lost)}`, at: [`node:${node.id}.options`] });
      }
    }
    if (markers(node).length > 0) {
      const lost = markers(node).filter((marker) => !markers(kept).includes(marker));
      if (!kept) losses.push({ why: `removes a node marked irreversible (${markers(node).join(", ")}): what takes its place carries no such mark unless it is given one`, at: [`node:${node.id}`] });
      else if (lost.length > 0) losses.push({ why: `removes the irreversible marker ${quote(lost)}`, at: [`node:${node.id}.irreversible`, `node:${node.id}.kind`] });
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
      losses.push({ why: `"${whenOf(edge)}" at the human gate "${edge.from}" would lead nowhere`, at: [`edge:${edge.id}`, `edge:${edge.id}.from`, `edge:${edge.id}.when`, `node:${edge.to}`] });
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
  const replaced = new Set<Id>();
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
    const gone = before.nodes.filter((node) => !still.has(node.id) && !was.has(node.id) && !replaced.has(node.id));
    const come = after.nodes.filter((node) => !known.has(node.id) && reached.has(node.id));
    if (come.length > 0) {
      for (const node of gone) {
        replaced.add(node.id);
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
    const endWas = whole ? endsFrom(before, waysWas, closed) : new Set<Id>();
    const endNow = whole ? endsFrom(after, ways, closed) : new Set<Id>();
    const freed = new Set(after.nodes.filter((node) => node.kind !== "stop" && known.has(node.id) && !endWas.has(node.id) && endNow.has(node.id)).map((node) => node.id));
    for (const way of freed.size > 0 ? ways : []) {
      if (shut(way, closed) || !freed.has(way.from) || !endNow.has(way.to)) continue;
      const at = changeOf(way);
      // Said once for a change: where the way into a node has been named above, the way on from it is the same loss.
      if (at && ![...told].some((key) => key.endsWith(`\n${at.join(" ")}`))) say(`ends ${way.to}`, { why: `adds a way from "${way.from}" to end in success ${past}`, at });
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

/** Every brake `after` has lost or loosened that `before` had; empty when it has lost none. */
export function brakesLost(before: Graph, after: Graph): Loss[] {
  const seen = new Set<string>();
  const reach = reachLosses(before, after);
  const first = [...ownLosses(before, after), ...loopLosses(before, after), ...reach.losses];
  const named = new Set(first.flatMap((loss) => loss.at));
  const told = new Set<string>();
  // From every node: one reason for each set of changes, and only where none of them carries a reason already.
  const last = reach.later.filter((loss) => !loss.at.some((name) => named.has(name)) && !told.has(loss.at.join(" ")) && told.add(loss.at.join(" ")));
  return [...first, ...last].filter((loss) => {
    const key = `${loss.why}\n${loss.at.join(" ")}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
