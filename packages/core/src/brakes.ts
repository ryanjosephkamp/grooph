/**
 * The brakes of a graph (amendment A-008's list), compared between two versions of it: what the second has lost or
 * loosened that the first had. `refreshSubgrooph` holds a template's newer version to this, on the graph as it would
 * be written and not change by change: a brake is a fact about the whole graph, and it can be lost by an edge added
 * as well as by a field changed, under a new id as well as under the old one.
 *
 * What is compared:
 *
 * - **A person on the way.** Each human gate, the answers it offers and what each answer leads to; each approval;
 *   and what a run reaches without a person's decision, without one gate's, without one answer at it, without one
 *   approval (`reach.ts`). A step that was behind a person and goes, while a step comes in that is not, is one too:
 *   it may be the same step under another name.
 * - **An irreversible marker** on each node that carries one, and a marked node that comes in before any person.
 * - **A loop's stops and bar, by the rounds they count.** For each back edge, among the loops that list it: the
 *   tightest round cap, budget and "ask a person"; the tightest of each that halts the run or asks a person (one
 *   that leads on to another node ends the loop and halts nothing); where one that only leads on leads; and the
 *   bar's acceptance.
 * - **Critic isolation.** Each critic, the evidence it is handed and the contexts it is handed in, and what a run
 *   reaches without its verdict; the policies that say so.
 *
 * Pure. Each loss names the changes it may be laid at, as `refreshSubgrooph` names a change: `node:<id>`,
 * `edge:<id>.<field>`, `loop:<id>.stops`.
 */

import { indexGraph } from "./graph-index.js";
import { decisionName, decisionsShared, reachedWithout, shut, waysOf, whenOf, type Closed } from "./reach.js";
import { edgeIsolation, entryNodeIds, isCriticFamily } from "./semantics.js";
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
 * halts the run or asks a person (`halt`), and where the ones that do neither lead (`leads`). A stop with a `then`
 * ends the loop and leads on; it halts only if it leads to a human gate or to a stop that halts.
 */
type Brake = { name: string; unit: string; any?: number; halt?: number; leads: Set<Id> };

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
      else brake.leads.add(stop.then!);
    }
  }
  return brakes;
}

/** How the stops of the rounds an edge starts have loosened, from the loop that counted them to the loops that would. */
function looser(was: Map<string, Brake>, now: Map<string, Brake>): string[] {
  const said: string[] = [];
  for (const [key, brake] of was) {
    const next = now.get(key);
    const asked = key === "human";
    if (next?.any === undefined) said.push(asked ? "removes the stop where a person is asked" : `removes ${brake.name} (${brake.any}${brake.unit})`);
    else if (next.any > brake.any!) said.push(asked ? `a person would be asked every ${next.any} rounds, not every ${brake.any}` : `raises ${brake.name} from ${brake.any} to ${next.any}${brake.unit}`);
    else if (brake.halt !== undefined && next.halt === undefined) said.push(`${brake.name} (${brake.halt}${brake.unit}) would no longer halt the run`);
    else if (brake.halt !== undefined && next.halt! > brake.halt) said.push(`${brake.name} that halts the run would rise from ${brake.halt} to ${next.halt}${brake.unit}`);
    // A brake that only ever led on: where it leads is what it does.
    else if (brake.halt === undefined && next.halt === undefined) {
      const fresh = [...next.leads].filter((id) => !brake.leads.has(id));
      if (fresh.length > 0) said.push(`${brake.name} would lead on to ${quote(fresh)}, not to ${quote([...brake.leads])}`);
    }
  }
  return said;
}

/** The loops' stops and bars, by the rounds they count. */
function loopLosses(before: Graph, after: Graph): Loss[] {
  const losses: Loss[] = [];
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
      const at = [`loop:${loop.id}.stops`, `loop:${loop.id}.bar`, ...targets];
      for (const why of looser(was, brakesOf(after, [kept]))) losses.push({ why, at });
      if (loop.bar && kept.bar?.acceptance !== loop.bar.acceptance) losses.push({ why: kept.bar ? "changes the bar's acceptance" : "removes the loop's bar", at });
    }
    // And the rounds themselves, by the edge that starts each: whichever loops count them afterwards.
    for (const id of loop.back) {
      const edge = edgeWas.get(id);
      if (!edge) continue;
      // The same round afterwards: the edge under its id, or another between the same two nodes.
      const round = edgeNow.has(id) ? [edgeNow.get(id)!] : after.edges.filter((other) => other.from === edge.from && other.to === edge.to);
      for (const next of round) {
        const counting = after.loops.filter((other) => other.back.includes(next.id));
        const at = [`loop:${loop.id}.stops`, `loop:${loop.id}.back`, `loop:${loop.id}.bar`, `loop:${loop.id}`, ...counting.flatMap((other) => [`loop:${other.id}`, `loop:${other.id}.stops`, `loop:${other.id}.bar`, `loop:${other.id}.back`]), ...targets];
        if (counting.length === 0) {
          losses.push({ why: `the rounds that "${next.id}" starts would no longer be counted by any loop`, at });
          continue;
        }
        for (const why of looser(was, brakesOf(after, counting))) losses.push({ why, at });
        if (loop.bar && !counting.some((other) => other.bar?.acceptance === loop.bar!.acceptance)) {
          losses.push({ why: counting.some((other) => other.bar) ? "changes the bar's acceptance" : "removes the loop's bar", at });
        }
      }
    }
    // The loop kept by name, with none of the nodes its stops bounded.
    if (kept && loop.members.length > 0 && !loop.members.some((member) => kept.members.includes(member))) {
      losses.push({ why: `the loop "${loop.id}" would keep its stops and bound none of the nodes it did`, at: [`loop:${loop.id}.members`, `loop:${loop.id}.back`] });
    }
  }
  return losses;
}

/** Gates, approvals, markers and critics, each by its own id; and what an answer or a verdict leads to. */
function ownLosses(before: Graph, after: Graph): Loss[] {
  const losses: Loss[] = [];
  const nodeNow = new Map(after.nodes.map((node) => [node.id, node]));
  const edgeNow = new Map(after.edges.map((edge) => [edge.id, edge]));
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
      // What the critic is handed, and how: over every edge into it, so that an edge under a new id is no way out.
      const into = (doc: Graph): Edge[] => doc.edges.filter((edge) => edge.to === node.id);
      const handed = new Set(into(after).flatMap((edge) => edge.evidence ?? []));
      const lost = [...new Set(into(before).flatMap((edge) => edge.evidence ?? []))].filter((piece) => !handed.has(piece));
      const ends = (edge: Edge): string[] => [`edge:${edge.id}.evidence`, `edge:${edge.id}.to`, `edge:${edge.id}`, `node:${edge.from}`];
      if (kept && lost.length > 0) losses.push({ why: `the critic would no longer be handed ${quote(lost)}`, at: [...into(before).flatMap(ends), ...into(after).flatMap(ends)] });
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
    }
    if (!kept || whenOf(kept) === whenOf(edge)) continue;
    const from = nodeWas.get(edge.from);
    if (edge.approval === true || from?.kind === "human-gate") losses.push({ why: "changes what a person's answer leads to", at: [`edge:${edge.id}.when`] });
    else if (from && isCriticFamily(from)) losses.push({ why: "changes what the critic's verdict leads to", at: [`edge:${edge.id}.when`] });
  }
  const policyNow = new Map((after.policies ?? []).map((policy) => [policy.id, policy]));
  for (const policy of before.policies ?? []) {
    const why = policy.kind === "critic-isolation" ? "removes critic isolation" : policy.kind === "no-self-grading" ? "lets a node grade its own work" : policy.kind === "no-live-graph-rewrite" ? "lets a run rewrite the graph where it could only propose" : undefined;
    const kept = policyNow.get(policy.id);
    if (why === undefined || (kept && same(kept, policy))) continue;
    losses.push({ why, at: kept ? (["kind", "scope", "params"] as const).filter((field) => !same(kept[field], policy[field])).map((field) => `policy:${policy.id}.${field}`) : [`policy:${policy.id}`] });
  }
  return losses;
}

/** What a run comes to reach around a decision it had to pass (`reach.ts`). */
function reachLosses(before: Graph, after: Graph): Loss[] {
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
  const starts = new Set(entryNodeIds(indexGraph(after)));
  const backWas = new Set(before.loops.flatMap((loop) => loop.back));
  const ways = waysOf(after);
  const waysWas = waysOf(before);
  const replaced = new Set<Id>();
  // A way around a gate is a way around a person, and is said once: as the widest decision it goes around. A way
  // around a critic is another matter, and is said as well.
  const told = new Set<string>();
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

    const opened = new Set(after.nodes.filter((node) => known.has(node.id) && !was.has(node.id) && reached.has(node.id)).map((node) => node.id));
    if (opened.size === 0) continue;
    const found = told.size;
    // Every node newly reached is reached by a way that is new, or that the decision no longer shuts. Each such
    // way is named, also one that starts at a node newly reached itself: allowing the first must not let in the second.
    for (const way of ways) {
      if (shut(way, closed) || !reached.has(way.from) || !opened.has(way.to)) continue;
      if (way.edge !== undefined) {
        const old = edgeWas.get(way.edge);
        const now = edgeNow.get(way.edge)!;
        if (!old) tell(closed, way.to, { why: `adds a way into "${way.to}" ${past}`, at: [`edge:${way.edge}`] });
        else {
          const fields = (["from", "to", "approval", "when"] as const).filter((field) => !same(old[field], now[field]));
          // The same edge, unchanged, that the decision shut before: the node it leaves decides no longer.
          const wasShut = waysWas.some((other) => other.edge === way.edge && shut(other, closed));
          if (fields.length > 0) tell(closed, way.to, { why: `opens a way into "${way.to}" ${past}`, at: fields.map((field) => `edge:${way.edge}.${field}`) });
          else if (wasShut) tell(closed, way.to, { why: `opens a way into "${way.to}" ${past}`, at: [`node:${way.from}.kind`, `node:${way.from}.role`] });
        }
      } else {
        const old = loopWas.get(way.loop!);
        const now = loopNow.get(way.loop!)!;
        const why = `a stop of the loop would lead on to "${way.to}", a way ${past}`;
        if (!old) tell(closed, way.to, { why, at: [`loop:${way.loop}`] });
        else {
          const fields = (["stops", "members"] as const).filter((field) => !same(old[field], now[field]));
          if (fields.length > 0) tell(closed, way.to, { why, at: fields.map((field) => `loop:${way.loop}.${field}`) });
        }
      }
    }
    // A node newly reached because nothing leads to it any more: a run starts there.
    for (const id of opened) {
      if (!starts.has(id)) continue;
      const why = `nothing would lead to "${id}", so a run would start there, where every way to it passed ${decisionName(closed)}`;
      for (const edge of before.edges) {
        if (edge.to !== id || backWas.has(edge.id)) continue;
        const now = edgeNow.get(edge.id);
        if (now && now.to !== id) tell(closed, `start ${id}`, { why, at: [`edge:${edge.id}.to`] });
        else if (now) tell(closed, `start ${id}`, { why, at: after.loops.filter((loop) => loop.back.includes(edge.id)).flatMap((loop) => [`loop:${loop.id}.back`, `loop:${loop.id}`]) });
        // Gone: with the node it came from, or by a change of its own.
        else tell(closed, `start ${id}`, { why, at: [still.has(edge.from) ? `edge:${edge.id}` : `node:${edge.from}`] });
      }
    }
    // Nothing new was named: either each way was told for a wider decision, or no change can be named at all.
    if (told.size === found && ![...opened].some((id) => [...told].some((key) => key.split("\n")[1] === id || key.split("\n")[1] === `start ${id}`))) {
      losses.push({ why: `a run would reach ${quote([...opened])} by a way ${past}`, at: [] });
    }
  }
  return losses;
}

/** Every brake `after` has lost or loosened that `before` had; empty when it has lost none. */
export function brakesLost(before: Graph, after: Graph): Loss[] {
  const seen = new Set<string>();
  return [...ownLosses(before, after), ...loopLosses(before, after), ...reachLosses(before, after)].filter((loss) => {
    const key = `${loss.why}\n${loss.at.join(" ")}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
