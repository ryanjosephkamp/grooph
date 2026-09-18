/**
 * Typed operations on the graph document — the one vocabulary every shell
 * uses to change it: the web canvas, `grooph apply`, and the MCP server later
 * (decision 0006, 0007).
 *
 * Every function is pure: document in, document out, nothing else touched.
 * Fields an operation does not name are carried through untouched, unknown
 * keys included. A document may be schema-invalid while it is being edited;
 * no operation invents content to satisfy the schema.
 *
 * These functions trust their arguments. `applyOps` is the checked entry point
 * for callers that send operations as data.
 */

import type {
  Bar,
  Edge,
  Graph,
  HarnessId,
  Id,
  Loop,
  Node,
  Policy,
  PolicyKind,
  PolicyScope,
  Stop,
  StopKind,
} from "../types.js";
import { allIds, followsName, slugify, uniqueId } from "./ids.js";

export type Position = { x: number; y: number };

export type NodeKind = Node["kind"];

/** How a node of each kind is labelled, and so what a new one is called ("Agent", "Agent 2", …). */
export const KIND_LABEL: Record<NodeKind, string> = {
  agent: "Agent",
  "human-gate": "Human gate",
  check: "Check",
  merge: "Merge",
  stop: "Stop",
};

/** Set an optional key, or remove it when the value is `undefined`. Never mutates. */
export function withField<T extends object, K extends keyof T>(obj: T, key: K, value: T[K] | undefined): T {
  const next = { ...obj };
  if (value === undefined) delete next[key];
  else next[key] = value;
  return next;
}

/** Optional text: blank means absent. */
export const optText = (value: string): string | undefined => (value.trim() === "" ? undefined : value);

/** Optional list: empty means absent. */
export const optList = <T>(value: T[]): T[] | undefined => (value.length === 0 ? undefined : value);

const round = (n: number): number => Math.round(n);

// ─── graph ────────────────────────────────────────────────────────────────

/**
 * A minimal document: the fields the schema requires, plus a goal and target
 * when given. `adaptation` is left out — its default applies at compile time.
 */
export function newGraph(options: { name: string; id?: Id; goal?: string; target?: HarnessId }): Graph {
  const doc: Graph = {
    grooph: 0,
    id: options.id ?? slugify(options.name, "graph"),
    name: options.name,
    version: 1,
    nodes: [],
    edges: [],
    loops: [],
  };
  if (options.goal !== undefined) doc.goal = options.goal;
  if (options.target !== undefined) doc.target = { harness: options.target };
  return doc;
}

export type GraphField = "name" | "goal" | "description" | "adaptation" | "lineage";

export function setGraphField<K extends GraphField>(doc: Graph, key: K, value: Graph[K] | undefined): Graph {
  return withField(doc, key, value);
}

export function setTarget(doc: Graph, harness: string | undefined): Graph {
  return withField(doc, "target", harness === undefined ? undefined : { ...doc.target, harness });
}

export function setConstraint(doc: Graph, key: "budget" | "time" | "other", value: string | undefined): Graph {
  const constraints = withField({ ...doc.constraints }, key, value);
  return withField(doc, "constraints", Object.keys(constraints).length === 0 ? undefined : constraints);
}

/**
 * Set the graph's name; its id follows the name while the id is still the one
 * the name implies (see `followsName`).
 */
export function setGraphName(doc: Graph, name: string): Graph {
  const next = { ...doc, name };
  if (!followsName(doc.id, doc.name)) return next;
  const taken = allIds(doc);
  taken.delete(doc.id);
  return { ...next, id: uniqueId(slugify(name, "graph"), taken) };
}

// ─── nodes ────────────────────────────────────────────────────────────────

/** The document a new node of `kind` starts as. Required fields the user must fill stay empty. */
export function newNode(kind: NodeKind, id: Id, name: string): Node {
  switch (kind) {
    case "agent":
      return { id, kind, name, role: "builder", brief: "", outputs: [] };
    case "human-gate":
      return { id, kind, name, prompt: "" };
    case "check":
      return { id, kind, name, check: { kind: "tests", pass: "" } };
    case "merge":
      return { id, kind, name, merges: [] };
    case "stop":
      return { id, kind, name };
  }
}

/**
 * Add a node. Without a name it is called after its kind ("Agent", "Agent 2");
 * without an id, the id is the name's slug, made unique. It gets a layout
 * entry only when the document already carries layout: a layout-free document
 * stays layout-free (amendment A-005).
 */
export function addNode(
  doc: Graph,
  kind: NodeKind,
  options: { at?: Position; name?: string; id?: Id } = {},
): { doc: Graph; id: Id } {
  const taken = allIds(doc);
  const label = KIND_LABEL[kind];
  let id: Id;
  let name: string;
  if (options.name !== undefined) {
    name = options.name;
    id = options.id ?? uniqueId(slugify(name, slugify(label)), taken);
  } else {
    id = options.id ?? uniqueId(slugify(label), taken);
    const suffix = id.slice(slugify(label).length); // "" or "-2", "-3", …
    name = options.id !== undefined || suffix === "" ? label : `${label} ${suffix.slice(1)}`;
  }
  let next: Graph = { ...doc, nodes: [...doc.nodes, newNode(kind, id, name)] };
  if (doc.layout && options.at) next = setPositions(next, { [id]: options.at });
  return { doc: next, id };
}

export function updateNode(doc: Graph, id: Id, fn: (node: Node) => Node): Graph {
  return { ...doc, nodes: doc.nodes.map((node) => (node.id === id ? fn(node) : node)) };
}

/** Set a node's name; its id (and the ids of edges derived from it) follow while they still match. */
export function setNodeName(doc: Graph, id: Id, name: string): { doc: Graph; id: Id } {
  const node = doc.nodes.find((n) => n.id === id);
  if (!node) return { doc, id };
  let next = updateNode(doc, id, (n) => ({ ...n, name }));
  if (!followsName(id, node.name)) return { doc: next, id };
  const taken = allIds(next);
  taken.delete(id);
  const newId = uniqueId(slugify(name, slugify(KIND_LABEL[node.kind])), taken);
  if (newId === id) return { doc: next, id };
  next = renameId(next, id, newId);
  return { doc: next, id: newId };
}

/**
 * Remove a node and everything that can no longer stand without it: its edges
 * (and their back-edge entries), its loop memberships, stop `then` and
 * `answerKeyFrom` references, its layout entry, group memberships, and
 * policies scoped to it.
 */
export function removeNode(doc: Graph, id: Id): Graph {
  let next: Graph = doc;
  for (const edge of doc.edges) if (edge.from === id || edge.to === id) next = removeEdge(next, edge.id);
  next = {
    ...next,
    nodes: next.nodes.filter((n) => n.id !== id),
    loops: next.loops.map((loop) => {
      let l: Loop = { ...loop, members: loop.members.filter((m) => m !== id) };
      l = { ...l, stops: l.stops.map((stop) => (stop.then === id ? withField(stop, "then", undefined) : stop)) };
      if (l.bar?.answerKeyFrom === id) l = { ...l, bar: withField(l.bar, "answerKeyFrom", undefined) };
      return l;
    }),
  };
  if (next.layout && id in next.layout) {
    const { [id]: _removed, ...rest } = next.layout;
    next = { ...next, layout: rest };
  }
  if (next.groups) next = { ...next, groups: next.groups.map((g) => ({ ...g, members: g.members.filter((m) => m !== id) })) };
  return dropScopedPolicies(next, `node:${id}`);
}

// ─── edges ────────────────────────────────────────────────────────────────

/** The id an edge gets when none is given: `e-<from>-<to>`, made unique. */
export const edgeIdFor = (from: Id, to: Id): Id => `e-${from}-${to}`;

/** Connect two nodes. The new edge takes every default (`when: always`, `isolation: fresh`). */
export function connect(doc: Graph, from: Id, to: Id, options: { id?: Id } = {}): { doc: Graph; id: Id } {
  const id = options.id ?? uniqueId(edgeIdFor(from, to), allIds(doc));
  return { doc: { ...doc, edges: [...doc.edges, { id, from, to }] }, id };
}

export function updateEdge(doc: Graph, id: Id, fn: (edge: Edge) => Edge): Graph {
  return { ...doc, edges: doc.edges.map((edge) => (edge.id === id ? fn(edge) : edge)) };
}

/** Remove an edge, its back-edge entries in loops, and policies scoped to it. */
export function removeEdge(doc: Graph, id: Id): Graph {
  const next: Graph = {
    ...doc,
    edges: doc.edges.filter((e) => e.id !== id),
    loops: doc.loops.map((loop) => (loop.back.includes(id) ? { ...loop, back: loop.back.filter((b) => b !== id) } : loop)),
  };
  return dropScopedPolicies(next, `edge:${id}`);
}

// ─── loops ────────────────────────────────────────────────────────────────

/**
 * Add a loop over `members`. It starts with no back edge and no stop; the
 * validator says what is missing. Without a name it is "Loop", "Loop 2", …
 */
export function addLoop(
  doc: Graph,
  members: Id[] = [],
  options: { name?: string; id?: Id } = {},
): { doc: Graph; id: Id } {
  const taken = allIds(doc);
  let id: Id;
  let name: string;
  if (options.name !== undefined) {
    name = options.name;
    id = options.id ?? uniqueId(slugify(name, "loop"), taken);
  } else {
    id = options.id ?? uniqueId("loop", taken);
    name = options.id !== undefined || id === "loop" ? "Loop" : `Loop ${id.slice("loop-".length)}`;
  }
  const loop: Loop = { id, name, members, back: [], stops: [] };
  return { doc: { ...doc, loops: [...doc.loops, loop] }, id };
}

export function updateLoop(doc: Graph, id: Id, fn: (loop: Loop) => Loop): Graph {
  return { ...doc, loops: doc.loops.map((loop) => (loop.id === id ? fn(loop) : loop)) };
}

export function setLoopName(doc: Graph, id: Id, name: string): { doc: Graph; id: Id } {
  const loop = doc.loops.find((l) => l.id === id);
  if (!loop) return { doc, id };
  const next = updateLoop(doc, id, (l) => ({ ...l, name }));
  if (!followsName(id, loop.name)) return { doc: next, id };
  const taken = allIds(next);
  taken.delete(id);
  const newId = uniqueId(slugify(name, "loop"), taken);
  return newId === id ? { doc: next, id } : { doc: renameId(next, id, newId), id: newId };
}

export function removeLoop(doc: Graph, id: Id): Graph {
  return dropScopedPolicies({ ...doc, loops: doc.loops.filter((l) => l.id !== id) }, `loop:${id}`);
}

/** Toggle membership of `id` in `list`, or set it when `on` is given. */
const toggle = (list: Id[], id: Id, on?: boolean): Id[] => {
  const present = list.includes(id);
  const want = on ?? !present;
  if (want === present) return list;
  return want ? [...list, id] : list.filter((x) => x !== id);
};

/**
 * Add or remove a member (`on` forces one or the other; without it, toggle).
 * Members keep document node order, so the loop reads the way the graph does.
 */
export function toggleLoopMember(doc: Graph, loopId: Id, nodeId: Id, on?: boolean): Graph {
  const order = new Map(doc.nodes.map((n, i) => [n.id, i]));
  return updateLoop(doc, loopId, (loop) => ({
    ...loop,
    members: toggle(loop.members, nodeId, on).sort((a, b) => (order.get(a) ?? 1e9) - (order.get(b) ?? 1e9)),
  }));
}

/** Add or remove a back edge (`on` forces one or the other). Back edges keep document edge order. */
export function toggleLoopBack(doc: Graph, loopId: Id, edgeId: Id, on?: boolean): Graph {
  const order = new Map(doc.edges.map((e, i) => [e.id, i]));
  return updateLoop(doc, loopId, (loop) => ({
    ...loop,
    back: toggle(loop.back, edgeId, on).sort((a, b) => (order.get(a) ?? 1e9) - (order.get(b) ?? 1e9)),
  }));
}

export function setBar(doc: Graph, loopId: Id, bar: Bar | undefined): Graph {
  return updateLoop(doc, loopId, (loop) => withField(loop, "bar", bar));
}

/** A fresh stop of `kind`, keeping `then` from `previous` when there is one. Numbers start at bounded defaults. */
export function newStop(kind: StopKind, previous?: Stop): Stop {
  const then = previous?.then === undefined ? {} : { then: previous.then };
  switch (kind) {
    case "human":
      return { kind, ...then };
    case "budget":
      return { kind, measure: "turns", limit: 40, ...then };
    case "bar-passed":
      return { kind, ...then };
    case "diminishing-returns":
      return { kind, rounds: 2, ...then };
    case "evidence-invalid":
      return { kind, rounds: 2, ...then };
    case "max-iterations":
      return { kind, n: 4, ...then };
  }
}

/** Append a stop of `kind` with its bounded defaults, overridden by `fields`. */
export function addStop(doc: Graph, loopId: Id, kind: StopKind, fields: Partial<Stop> = {}): Graph {
  const stop = { ...newStop(kind), ...fields, kind } as Stop;
  return updateLoop(doc, loopId, (loop) => ({ ...loop, stops: [...loop.stops, stop] }));
}

export function setStop(doc: Graph, loopId: Id, index: number, stop: Stop): Graph {
  return updateLoop(doc, loopId, (loop) => ({ ...loop, stops: loop.stops.map((s, i) => (i === index ? stop : s)) }));
}

export function removeStop(doc: Graph, loopId: Id, index: number): Graph {
  return updateLoop(doc, loopId, (loop) => ({ ...loop, stops: loop.stops.filter((_, i) => i !== index) }));
}

/** Stops are evaluated in document order and the first that fires wins (graph-ir §2), so order is editable. */
export function moveStop(doc: Graph, loopId: Id, index: number, delta: -1 | 1): Graph {
  return updateLoop(doc, loopId, (loop) => {
    const target = index + delta;
    if (target < 0 || target >= loop.stops.length) return loop;
    const stops = [...loop.stops];
    [stops[index], stops[target]] = [stops[target]!, stops[index]!];
    return { ...loop, stops };
  });
}

// ─── policies ─────────────────────────────────────────────────────────────

/** Add a policy. Without an id it is `p-<kind>`, made unique. */
export function addPolicy(
  doc: Graph,
  policy: { kind: PolicyKind; scope: PolicyScope; params?: Policy["params"]; id?: Id },
): { doc: Graph; id: Id } {
  const kindName = typeof policy.kind === "string" ? policy.kind : policy.kind.custom;
  const id = policy.id ?? uniqueId(`p-${slugify(kindName, "policy")}`, allIds(doc));
  const added: Policy = { id, kind: policy.kind, scope: policy.scope };
  if (policy.params !== undefined) added.params = policy.params;
  return { doc: { ...doc, policies: [...(doc.policies ?? []), added] }, id };
}

/** Remove a policy; an emptied list is removed too, rather than left as a husk. */
export function removePolicy(doc: Graph, id: Id): Graph {
  if (!doc.policies) return doc;
  return withField(doc, "policies", optList(doc.policies.filter((p) => p.id !== id)));
}

// ─── layout ───────────────────────────────────────────────────────────────

/** Write positions into `layout`, rounded to whole pixels so diffs stay quiet. */
export function setPositions(doc: Graph, positions: Record<Id, Position>): Graph {
  const layout = { ...doc.layout };
  for (const [id, pos] of Object.entries(positions)) {
    layout[id] = { ...layout[id], x: round(pos.x), y: round(pos.y) };
  }
  return { ...doc, layout };
}

// ─── ids ──────────────────────────────────────────────────────────────────

/**
 * Rename an id and every reference to it: the graph's own id, or a node, edge,
 * loop, group or policy id. Run notes are history and keep the id they were
 * written with. Edge ids that were derived from a renamed node
 * (`e-<from>-<to>`) are re-derived so they stay readable.
 */
export function renameId(doc: Graph, from: Id, to: Id): Graph {
  if (from === to) return doc;
  if (doc.id === from) return { ...doc, id: to };
  const swap = (id: Id): Id => (id === from ? to : id);
  const swapScope = <S extends string>(scope: S): S => {
    const colon = scope.indexOf(":");
    return (colon > 0 && scope.slice(colon + 1) === from ? `${scope.slice(0, colon)}:${to}` : scope) as S;
  };

  const isNode = doc.nodes.some((n) => n.id === from);
  let next: Graph = {
    ...doc,
    nodes: doc.nodes.map((n) => (n.id === from ? { ...n, id: to } : n)),
    edges: doc.edges.map((e) => {
      const edge = { ...e, id: swap(e.id), from: swap(e.from), to: swap(e.to) };
      return e.id === from || e.from === from || e.to === from ? edge : e;
    }),
    loops: doc.loops.map((loop) => {
      const l: Loop = {
        ...loop,
        id: swap(loop.id),
        members: loop.members.map(swap),
        back: loop.back.map(swap),
        stops: loop.stops.map((s) => (s.then === from ? { ...s, then: to } : s)),
      };
      if (l.bar?.answerKeyFrom === from) l.bar = { ...l.bar, answerKeyFrom: to };
      return l;
    }),
  };
  if (doc.policies) next.policies = doc.policies.map((p) => ({ ...p, id: swap(p.id), scope: swapScope(p.scope) }));
  if (doc.groups) next.groups = doc.groups.map((g) => ({ ...g, id: swap(g.id), members: g.members.map(swap) }));
  if (doc.layout && from in doc.layout) {
    const layout: NonNullable<Graph["layout"]> = {};
    for (const [key, value] of Object.entries(doc.layout)) layout[swap(key)] = value;
    next.layout = layout;
  }

  if (isNode) {
    for (const edge of next.edges) {
      if (edge.from !== to && edge.to !== to) continue;
      const oldFrom = edge.from === to ? from : edge.from;
      const oldTo = edge.to === to ? from : edge.to;
      const derived = edgeIdFor(oldFrom, oldTo);
      if (edge.id !== derived && !new RegExp(`^${derived}-\\d+$`).test(edge.id)) continue;
      const taken = allIds(next);
      taken.delete(edge.id);
      const fresh = uniqueId(edgeIdFor(edge.from, edge.to), taken);
      if (fresh !== edge.id) next = renameId(next, edge.id, fresh);
    }
  }
  return next;
}

function dropScopedPolicies(doc: Graph, scope: string): Graph {
  if (!doc.policies?.some((p) => p.scope === scope)) return doc;
  return { ...doc, policies: doc.policies.filter((p) => p.scope !== scope) };
}
