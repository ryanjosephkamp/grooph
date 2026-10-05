/**
 * What a run can reach without a decision. A human gate and an edge that needs approval are where a person decides
 * (amendment A-008's first two brakes), and a critic is where a verdict does; everything a run reaches only by
 * passing one is held behind it. Comparing that set before and after a change says whether the change opened a way
 * around the decision, however many steps the way takes: `brakes.ts` holds a refresh to it.
 *
 * Pure, and it reads the document only.
 */

import { isCriticFamily } from "./semantics.js";
import type { Edge, Graph, Id } from "./types.js";

/** One way a run can go from a node to another: along an edge, or by a loop's stop that names where it leads. */
export type Way = {
  from: Id;
  to: Id;
  /** a person decides before the run goes this way: the edge needs approval or leaves a human gate, or the stop is the one where a person is asked */
  person: boolean;
  /** the edge, when the way is one, and the condition it is taken on */
  edge?: Id;
  when?: string;
  /** the loop whose stop leads on (`then`), when the way is that */
  loop?: Id;
  /** the way is a brake firing into a stop that halts: a round cap, a budget or the stop where a person is asked. It ends the run, so it is no way around a critic. */
  escalates?: true;
  /** the way is a loop's bar being passed (`bar-passed` with a `then`): the verdict of the critics among the loop's members, who are named */
  verdictOf?: Id[];
};

/** An edge's condition as one word: `always`, `pass`, `fail`, or the verdict it names. */
export const whenOf = (edge: Edge): string => (typeof edge.when === "object" ? edge.when.verdict : (edge.when ?? "always"));

/** Every way of the graph: each edge, and each stop with a `then`, from every member of its loop. */
export function waysOf(doc: Graph): Way[] {
  const kind = new Map(doc.nodes.map((node) => [node.id, node.kind]));
  const halts = new Set(doc.nodes.filter((node) => node.kind === "stop" && node.outcome === "halt").map((node) => node.id));
  const critics = new Set(doc.nodes.filter(isCriticFamily).map((node) => node.id));
  const ways: Way[] = doc.edges.map((edge) => ({ from: edge.from, to: edge.to, person: edge.approval === true || kind.get(edge.from) === "human-gate", edge: edge.id, when: whenOf(edge) }));
  for (const loop of doc.loops) {
    for (const stop of loop.stops) {
      if (stop.then === undefined) continue;
      const escalates = (stop.kind === "max-iterations" || stop.kind === "budget" || stop.kind === "human") && halts.has(stop.then);
      const judges = stop.kind === "bar-passed" ? loop.members.filter((member) => critics.has(member)) : [];
      for (const member of loop.members) ways.push({ from: member, to: stop.then, person: stop.kind === "human", loop: loop.id, ...(escalates ? { escalates } : {}), ...(judges.length > 0 ? { verdictOf: judges } : {}) });
    }
  }
  return ways;
}

/**
 * A decision taken as never given: every person's at once; one human gate's, or one answer at it; one approval; one
 * critic's verdict, or one verdict of it.
 */
export type Closed = "every" | { gate: Id; when?: string } | { approval: Id } | { critic: Id; when?: string };

/** Whether a way is shut by that. An edge out of a gate is the gate's decision, and an edge out of a critic the critic's. */
export function shut(way: Way, closed: Closed): boolean {
  if (closed === "every") return way.person;
  if ("approval" in closed) return way.edge === closed.approval;
  if ("critic" in closed && way.escalates) return true;
  // The bar passed is the critic's "pass": shut with the critic, and with that verdict of it.
  if ("critic" in closed && way.verdictOf?.includes(closed.critic) && (closed.when === undefined || closed.when === "pass")) return true;
  const node = "gate" in closed ? closed.gate : closed.critic;
  return way.edge !== undefined && way.from === node && (closed.when === undefined || way.when === closed.when);
}

/**
 * Where this comparison takes a run to start: at every node no edge leads into, a loop's back edge aside.
 *
 * That is wider than graph-ir §2, on purpose. Since #88 a node that only a loop's stop continues at (`then`) is no
 * entry node: the lead does not start it, and the package does not say to. Here it still counts as a start, as it
 * did when this comparison was read and attacked, so a newer version that leaves a step with nothing but a stop
 * leading to it is held ("a run would start there"). Too careful costs one `--allow`, and that is the side to err
 * on until this file and `brakes.ts` have been read by a second harness; whether the narrower rule is safe here is
 * the first thing that reading should rule on (slice 0085's handback).
 */
export function startsOf(doc: Graph): Id[] {
  const back = new Set(doc.loops.flatMap((loop) => loop.back));
  return doc.nodes.filter((node) => !doc.edges.some((edge) => edge.to === node.id && !back.has(edge.id))).map((node) => node.id);
}

/**
 * The nodes a run at one of `starts` can come to, along every way that `closed` does not shut, or along every way
 * when no decision is named. The starts are among them.
 */
export function reachedFrom(doc: Graph, starts: Iterable<Id>, closed?: Closed): Set<Id> {
  const known = new Set(doc.nodes.map((node) => node.id));
  const onward = new Map<Id, Id[]>();
  for (const way of waysOf(doc)) {
    if ((closed !== undefined && shut(way, closed)) || !known.has(way.from) || !known.has(way.to)) continue;
    (onward.get(way.from) ?? onward.set(way.from, []).get(way.from)!).push(way.to);
  }
  const reached = new Set<Id>(starts);
  const queue = [...reached];
  for (let id = queue.pop(); id !== undefined; id = queue.pop()) {
    for (const next of onward.get(id) ?? []) {
      if (reached.has(next)) continue;
      reached.add(next);
      queue.push(next);
    }
  }
  return reached;
}

/**
 * The nodes a run reaches without that decision: from the nodes it starts at (`startsOf`), along every way that is
 * not shut. A human gate is itself reached; what lies beyond it is not, by that way. What is missing from the set is
 * what the decision stands before.
 */
export const reachedWithout = (doc: Graph, closed: Closed): Set<Id> => reachedFrom(doc, startsOf(doc), closed);

/**
 * Each decision two versions of a graph share: every person at once, then each human gate, each approval and each
 * critic that is in both, and each answer that gate or critic gave in the first. A node may sit behind two gates in
 * a row, and a way around the second is a way around a person though the first still stands; and a gate whose
 * "reject" comes to lead where its "approve" led decides nothing. So each is asked on its own.
 */
export function decisionsShared(before: Graph, after: Graph): Closed[] {
  const now = new Map(after.nodes.map((node) => [node.id, node]));
  const approvals = new Set(after.edges.filter((edge) => edge.approval === true).map((edge) => edge.id));
  const answers = (id: Id): string[] => [...new Set(before.edges.filter((edge) => edge.from === id).map(whenOf))];
  // People first, the widest question first: a loss is said once, in the widest terms that are true of it.
  const closed: Closed[] = ["every"];
  for (const node of before.nodes) {
    if (node.kind === "human-gate" && now.get(node.id)?.kind === "human-gate") closed.push({ gate: node.id }, ...answers(node.id).map((when) => ({ gate: node.id, when })));
  }
  for (const edge of before.edges) if (edge.approval === true && approvals.has(edge.id)) closed.push({ approval: edge.id });
  for (const node of before.nodes) {
    const kept = now.get(node.id);
    if (isCriticFamily(node) && kept && isCriticFamily(kept)) closed.push({ critic: node.id }, ...answers(node.id).map((when) => ({ critic: node.id, when })));
  }
  return closed;
}

/** What a way no longer passes, in words: for the line a person reads. */
export function decisionName(closed: Closed): string {
  if (closed === "every") return "a person";
  if ("approval" in closed) return `the approval on "${closed.approval}"`;
  if ("gate" in closed) return closed.when === undefined ? `the human gate "${closed.gate}"` : `"${closed.when}" at the human gate "${closed.gate}"`;
  return closed.when === undefined ? `the critic "${closed.critic}"` : `"${closed.when}" from the critic "${closed.critic}"`;
}
