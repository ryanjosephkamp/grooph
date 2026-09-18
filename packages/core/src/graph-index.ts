import type { AgentNode, Edge, Graph, Group, Id, Loop, Node, Policy, RunNote } from "./types.js";

export type IdOwnerKind = "graph" | "node" | "edge" | "loop" | "group" | "policy" | "note";

export type IdOwner = { kind: IdOwnerKind; id: Id; index: number };

export type GraphIndex = {
  doc: Graph;
  nodes: Map<Id, Node>;
  edges: Map<Id, Edge>;
  loops: Map<Id, Loop>;
  groups: Map<Id, Group>;
  policies: Map<Id, Policy>;
  notes: Map<Id, RunNote>;
  /** every id-bearing object in document order, for duplicate detection */
  owners: IdOwner[];
  /** document position of each node, so generated output stays ordered */
  nodeOrder: Map<Id, number>;
  outgoing: Map<Id, Edge[]>;
  incoming: Map<Id, Edge[]>;
};

const byId = <T extends { id: Id }>(items: readonly T[] | undefined): Map<Id, T> => {
  const map = new Map<Id, T>();
  for (const item of items ?? []) if (!map.has(item.id)) map.set(item.id, item);
  return map;
};

export function indexGraph(doc: Graph): GraphIndex {
  const nodes = doc.nodes ?? [];
  const edges = doc.edges ?? [];

  const owners: IdOwner[] = [];
  const collect = (kind: IdOwnerKind, items: readonly { id: Id }[] | undefined): void => {
    (items ?? []).forEach((item, index) => owners.push({ kind, id: item.id, index }));
  };
  // graph-ir §1: ids are unique across the graph itself, nodes, edges, loops, groups, policies, notes.
  collect("graph", [doc]);
  collect("node", nodes);
  collect("edge", edges);
  collect("loop", doc.loops);
  collect("group", doc.groups);
  collect("policy", doc.policies);
  collect("note", doc.notes);

  const nodeOrder = new Map<Id, number>();
  nodes.forEach((node, i) => {
    if (!nodeOrder.has(node.id)) nodeOrder.set(node.id, i);
  });

  const outgoing = new Map<Id, Edge[]>();
  const incoming = new Map<Id, Edge[]>();
  for (const edge of edges) {
    (outgoing.get(edge.from) ?? outgoing.set(edge.from, []).get(edge.from)!).push(edge);
    (incoming.get(edge.to) ?? incoming.set(edge.to, []).get(edge.to)!).push(edge);
  }

  return {
    doc,
    nodes: byId(nodes),
    edges: byId(edges),
    loops: byId(doc.loops),
    groups: byId(doc.groups),
    policies: byId(doc.policies),
    notes: byId(doc.notes),
    owners,
    nodeOrder,
    outgoing,
    incoming,
  };
}

export const isAgentNode = (node: Node | undefined): node is AgentNode => node?.kind === "agent";

/** Node ids in document order; used to keep issue and package output stable. */
export function sortNodeIds(index: GraphIndex, ids: Iterable<Id>): Id[] {
  return [...ids].sort((a, b) => (index.nodeOrder.get(a) ?? 0) - (index.nodeOrder.get(b) ?? 0));
}

/**
 * Strongly connected components with at least one internal edge, over the
 * given edge set. Tarjan's algorithm; components come back in document order.
 */
export function findCycles(index: GraphIndex, edges: readonly Edge[]): Id[][] {
  const nodeIds = [...index.nodes.keys()];
  const adjacency = new Map<Id, Id[]>();
  for (const id of nodeIds) adjacency.set(id, []);
  const selfLoops = new Set<Id>();
  for (const edge of edges) {
    if (!index.nodes.has(edge.from) || !index.nodes.has(edge.to)) continue;
    adjacency.get(edge.from)!.push(edge.to);
    if (edge.from === edge.to) selfLoops.add(edge.from);
  }

  let counter = 0;
  const indexOf = new Map<Id, number>();
  const lowLink = new Map<Id, number>();
  const onStack = new Set<Id>();
  const stack: Id[] = [];
  const components: Id[][] = [];

  const strongConnect = (v: Id): void => {
    indexOf.set(v, counter);
    lowLink.set(v, counter);
    counter += 1;
    stack.push(v);
    onStack.add(v);

    for (const w of adjacency.get(v) ?? []) {
      if (!indexOf.has(w)) {
        strongConnect(w);
        lowLink.set(v, Math.min(lowLink.get(v)!, lowLink.get(w)!));
      } else if (onStack.has(w)) {
        lowLink.set(v, Math.min(lowLink.get(v)!, indexOf.get(w)!));
      }
    }

    if (lowLink.get(v) === indexOf.get(v)) {
      const component: Id[] = [];
      for (;;) {
        const w = stack.pop()!;
        onStack.delete(w);
        component.push(w);
        if (w === v) break;
      }
      if (component.length > 1 || selfLoops.has(component[0]!)) {
        components.push(sortNodeIds(index, component));
      }
    }
  };

  for (const id of nodeIds) if (!indexOf.has(id)) strongConnect(id);

  return components.sort(
    (a, b) => (index.nodeOrder.get(a[0]!) ?? 0) - (index.nodeOrder.get(b[0]!) ?? 0),
  );
}

/** Is there a path from `from` to `to` using only edges whose endpoints are in `within`? */
export function hasPathWithin(
  index: GraphIndex,
  from: Id,
  to: Id,
  within: ReadonlySet<Id>,
  edges: readonly Edge[],
): boolean {
  if (!within.has(from) || !within.has(to)) return false;
  const seen = new Set<Id>([from]);
  const queue: Id[] = [from];
  while (queue.length > 0) {
    const current = queue.shift()!;
    if (current === to && seen.size > 0 && current !== from) return true;
    for (const edge of edges) {
      if (edge.from !== current) continue;
      if (!within.has(edge.to)) continue;
      if (edge.to === to) return true;
      if (seen.has(edge.to)) continue;
      seen.add(edge.to);
      queue.push(edge.to);
    }
  }
  return false;
}
