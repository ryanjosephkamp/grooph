/**
 * What a run can reach without a person's decision. A human gate and an edge that needs approval are where a person
 * decides (amendment A-008's first two brakes); everything a run reaches only by passing one is held behind it.
 * Comparing that set before and after a change says whether the change opened a way around a person, however many
 * steps the way takes: `refreshSubgrooph` and `placeSubgrooph` hold or report a change by it.
 *
 * Pure, and it reads the document only.
 */

import { indexGraph } from "./graph-index.js";
import { entryNodeIds } from "./semantics.js";
import type { Graph, Id } from "./types.js";

/** One way a run can go from a node to another: along an edge, or by a loop's stop that names where it leads. */
export type Way = {
  from: Id;
  to: Id;
  /** a person decides before the run goes this way: the edge needs approval or leaves a human gate, or the stop is the one where a person is asked */
  person: boolean;
  /** the edge, when the way is one */
  edge?: Id;
  /** the loop whose stop leads on (`then`), when the way is that */
  loop?: Id;
};

/** Every way of the graph: each edge, and each stop with a `then`, from every member of its loop. */
export function waysOf(doc: Graph): Way[] {
  const kind = new Map(doc.nodes.map((node) => [node.id, node.kind]));
  const ways: Way[] = doc.edges.map((edge) => ({ from: edge.from, to: edge.to, person: edge.approval === true || kind.get(edge.from) === "human-gate", edge: edge.id }));
  for (const loop of doc.loops) {
    for (const stop of loop.stops) {
      if (stop.then === undefined) continue;
      for (const member of loop.members) ways.push({ from: member, to: stop.then, person: stop.kind === "human", loop: loop.id });
    }
  }
  return ways;
}

/** Where a person decides: every such place in the graph, one human gate, or one edge that needs approval. */
export type Closed = "every" | { gate: Id } | { approval: Id };

/** Whether a way is shut when a person's decision is taken as never given. An edge out of a gate is the gate's decision. */
export const shut = (way: Way, closed: Closed): boolean =>
  closed === "every" ? way.person : "gate" in closed ? way.edge !== undefined && way.from === closed.gate : way.edge === closed.approval;

/**
 * The nodes a run reaches without that decision: from the nodes it starts at (graph-ir §2), along every way that is
 * not shut. A human gate is itself reached; what lies beyond it is not, by that way. What is missing from the set is
 * what the decision stands before.
 */
export function reachedWithout(doc: Graph, closed: Closed): Set<Id> {
  const known = new Set(doc.nodes.map((node) => node.id));
  const onward = new Map<Id, Id[]>();
  for (const way of waysOf(doc)) {
    if (shut(way, closed) || !known.has(way.from) || !known.has(way.to)) continue;
    (onward.get(way.from) ?? onward.set(way.from, []).get(way.from)!).push(way.to);
  }
  const reached = new Set<Id>(entryNodeIds(indexGraph(doc)));
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
 * Each decision two versions of a graph share: every person at once, then each human gate and each approval that
 * is in both. A node may sit behind two gates in a row, and a way around the second is a way around a person though
 * the first still stands; so each is asked on its own.
 */
export function decisionsShared(before: Graph, after: Graph): Closed[] {
  const gates = new Set(after.nodes.filter((node) => node.kind === "human-gate").map((node) => node.id));
  const approvals = new Set(after.edges.filter((edge) => edge.approval === true).map((edge) => edge.id));
  return [
    "every",
    ...before.nodes.filter((node) => node.kind === "human-gate" && gates.has(node.id)).map((node) => ({ gate: node.id })),
    ...before.edges.filter((edge) => edge.approval === true && approvals.has(edge.id)).map((edge) => ({ approval: edge.id })),
  ];
}

/** What a way no longer passes, in words: for the line a person reads. */
export const decisionName = (closed: Closed): string => (closed === "every" ? "a person" : "gate" in closed ? `the human gate "${closed.gate}"` : `the approval on "${closed.approval}"`);
