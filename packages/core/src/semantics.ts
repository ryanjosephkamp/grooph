/**
 * Semantics shared by the validator and every compiler (graph-ir §1–§2).
 * Defaults live here once, so a package never disagrees with a rule.
 */

import type { GraphIndex } from "./graph-index.js";
import type { Adaptation, AgentNode, Bar, Edge, EdgeWhen, Graph, Id, Loop, Node, Policy, Role, Stop } from "./types.js";

/** graph-ir §1: critics are `critic`, `judge`, `red-team`. */
export const CRITIC_ROLES: readonly Role[] = ["critic", "judge", "red-team"];
/** graph-ir §1: writers are `builder`, `synthesizer`, `planner`. */
export const WRITER_ROLES: readonly Role[] = ["builder", "synthesizer", "planner"];

export const roleName = (node: AgentNode): string =>
  typeof node.role === "string" ? node.role : node.role.custom;

export const isCustomRole = (node: AgentNode): boolean => typeof node.role !== "string";

export const isCriticFamily = (node: Node): boolean =>
  node.kind === "agent" && !isCustomRole(node) && CRITIC_ROLES.includes(node.role as Role);

/** A custom role belongs to no family unless the node also sets `owns` (graph-ir §1). */
export const isWriterFamily = (node: Node): boolean => {
  if (node.kind !== "agent") return false;
  if (isCustomRole(node)) return (node.owns ?? []).length > 0;
  return WRITER_ROLES.includes(node.role as Role);
};

export const edgeWhen = (edge: Edge): EdgeWhen => edge.when ?? "always";

export const edgeWhenLabel = (edge: Edge): string => {
  const when = edgeWhen(edge);
  return typeof when === "string" ? when : `verdict ${when.verdict}`;
};

export const edgeIsolation = (edge: Edge): "fresh" | "shared" => edge.isolation ?? "fresh";

/**
 * graph-ir §1: `mode` is inferred when absent — "grind" if every back edge
 * starts at a check node, else "judgment".
 */
export function loopMode(index: GraphIndex, loop: Loop): "grind" | "judgment" {
  if (loop.mode) return loop.mode;
  const backEdges = (loop.back ?? []).map((id) => index.edges.get(id)).filter((e): e is Edge => !!e);
  if (backEdges.length === 0) return "grind";
  return backEdges.every((edge) => index.nodes.get(edge.from)?.kind === "check") ? "grind" : "judgment";
}

/**
 * graph-ir §3: an `answer-key` entry counts as inspectable only when
 * `answerKeyFrom` names a node in the graph.
 */
export function inspectableEvidence(index: GraphIndex, bar: Bar | undefined): Bar["inspects"] {
  if (!bar) return [];
  const answerKeyResolves = bar.answerKeyFrom !== undefined && index.nodes.has(bar.answerKeyFrom);
  return (bar.inspects ?? []).filter((entry) => entry.kind !== "answer-key" || answerKeyResolves);
}

export const hasInspectableBar = (index: GraphIndex, loop: Loop): boolean =>
  inspectableEvidence(index, loop.bar).length > 0;

/** Human-readable one-liner for a stop, used in issue messages and in LEAD.md. */
export function describeStop(stop: Stop): string {
  switch (stop.kind) {
    case "human":
      return stop.every === undefined ? "human halt" : `human halt, asked every ${stop.every} round(s)`;
    case "budget":
      return `budget: ${stop.limit} ${stop.measure}`;
    case "bar-passed":
      return "bar passed";
    case "diminishing-returns":
      return `diminishing returns over ${stop.rounds} round(s)${stop.metric ? ` on ${stop.metric}` : ""}${
        stop.threshold === undefined ? "" : ` (threshold ${stop.threshold})`
      }`;
    case "evidence-invalid":
      return `evidence invalid for ${stop.rounds} round(s)`;
    case "max-iterations":
      return `max iterations: ${stop.n}`;
    default: {
      const exhaustive: never = stop;
      return JSON.stringify(exhaustive);
    }
  }
}

/**
 * graph-ir §1: `then` names the node to continue at when the stop fires.
 * Defaults: `bar-passed` follows the loop's pass exit edges; every other stop
 * halts the run and reports to the human.
 */
export function stopAction(stop: Stop): string {
  if (stop.then !== undefined) return `continue at node \`${stop.then}\``;
  return stop.kind === "bar-passed"
    ? "follow the loop's pass exit edges"
    : "halt the run and report to the human";
}

/**
 * The nodes a loop's stops lead out to: where a stop continues (`then`), unless that is one of the loop's own
 * members, which is the loop going round again as a back edge is.
 */
export function stopsLeadTo(loop: Loop): Id[] {
  const members = new Set(loop.members ?? []);
  return (loop.stops ?? []).flatMap((stop) => (stop.then !== undefined && !members.has(stop.then) ? [stop.then] : []));
}

/**
 * Entry nodes: nothing leads into them (graph-ir §2). A way in is an inbound edge that is not a loop's back edge, or
 * a stop of a loop the node is not in that continues there (`then`).
 */
export function entryNodeIds(index: GraphIndex): Id[] {
  const backEdgeIds = new Set<Id>();
  const continuedAt = new Set<Id>();
  for (const loop of index.doc.loops ?? []) {
    for (const id of loop.back ?? []) backEdgeIds.add(id);
    for (const id of stopsLeadTo(loop)) continuedAt.add(id);
  }
  const entries: Id[] = [];
  for (const node of index.doc.nodes ?? []) {
    const inbound = (index.incoming.get(node.id) ?? []).filter((edge) => !backEdgeIds.has(edge.id));
    if (inbound.length === 0 && !continuedAt.has(node.id)) entries.push(node.id);
  }
  return entries;
}

/** Loops a node belongs to, in document order. */
export function loopsOfNode(index: GraphIndex, nodeId: Id): Loop[] {
  return (index.doc.loops ?? []).filter((loop) => (loop.members ?? []).includes(nodeId));
}

/**
 * Every node reachable from `starts`: along any edge, back edges included, and from a loop's member to where the
 * loop's stops continue (`then`).
 */
export function reachableFrom(index: GraphIndex, starts: readonly Id[]): Set<Id> {
  const seen = new Set<Id>(starts.filter((id) => index.nodes.has(id)));
  const queue = [...seen];
  const loops = index.doc.loops ?? [];
  while (queue.length > 0) {
    const current = queue.shift()!;
    const onward = [
      ...(index.outgoing.get(current) ?? []).map((edge) => edge.to),
      ...loops.flatMap((loop) => ((loop.members ?? []).includes(current) ? stopsLeadTo(loop) : [])),
    ];
    for (const next of onward) {
      if (!index.nodes.has(next) || seen.has(next)) continue;
      seen.add(next);
      queue.push(next);
    }
  }
  return seen;
}

/**
 * Whether a policy's scope covers an edge: `graph` covers every edge,
 * `edge:<id>` that edge, `node:<id>` the edges that start or end at that node,
 * `loop:<id>` the edges that end at one of the loop's members.
 */
export function policyCoversEdge(index: GraphIndex, policy: Policy, edge: Edge): boolean {
  const scope = policy.scope;
  if (scope === "graph") return true;
  const separator = scope.indexOf(":");
  const kind = scope.slice(0, separator);
  const target = scope.slice(separator + 1);
  if (kind === "edge") return target === edge.id;
  if (kind === "node") return target === edge.from || target === edge.to;
  if (kind === "loop") return (index.loops.get(target)?.members ?? []).includes(edge.to);
  return false;
}

/** graph-ir §2: stricter levels first. */
const ADAPTATION_ORDER: readonly Adaptation[] = ["fixed", "propose", "adaptive"];

/**
 * The adaptation level a run follows (graph-ir §1–§2, A-008): the document's
 * `adaptation`, default `adaptive`; a graph-scoped `no-live-graph-rewrite`
 * policy means `propose`, and when both are present the stricter one wins.
 */
export function effectiveAdaptation(doc: Graph): Adaptation {
  const levels: Adaptation[] = [doc.adaptation ?? "adaptive"];
  if ((doc.policies ?? []).some((p) => p.kind === "no-live-graph-rewrite" && p.scope === "graph")) levels.push("propose");
  return ADAPTATION_ORDER.find((level) => levels.includes(level))!;
}
