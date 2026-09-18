/**
 * Typed operations on the graph document — the only way the app changes it.
 *
 * Every function is pure: document in, document out, nothing else touched, so
 * the canvas is a projection of the document and never a second source of
 * truth (spec §4.2, §6). Fields an operation does not name are carried through
 * untouched, unknown keys included. The vocabulary (`addNode`, `connect`,
 * `setStop`, …) is the one `docs/ARCHITECTURE.md` expects the MCP server to
 * expose in stage 5; these live in the web app until core grows them.
 */
import type { Bar, Edge, Graph, Id, Loop, Node, Stop, StopKind } from "@grooph/core";

import type { NodeKind } from "./catalog.js";
import { KIND_LABEL } from "./catalog.js";
import { slugify, uniqueId } from "./ids.js";

export type Position = { x: number; y: number };

/** Every id-bearing object in the document, the graph's own id included (graph-ir §1). */
export function allIds(doc: Graph): Set<Id> {
  const ids = new Set<Id>([doc.id]);
  for (const list of [doc.nodes, doc.edges, doc.loops, doc.groups, doc.policies, doc.notes]) {
    for (const item of list ?? []) ids.add(item.id);
  }
  return ids;
}

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

export function setGraphField<K extends "name" | "goal" | "description">(
  doc: Graph,
  key: K,
  value: Graph[K] | undefined,
): Graph {
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
 * Add a node. It gets a layout entry only when the document already carries
 * layout: a layout-free document stays layout-free (amendment A-005).
 */
export function addNode(doc: Graph, kind: NodeKind, at?: Position): { doc: Graph; id: Id } {
  const taken = allIds(doc);
  const label = KIND_LABEL[kind];
  const id = uniqueId(slugify(label), taken);
  const suffix = id.slice(slugify(label).length); // "" or "-2", "-3", …
  const name = suffix === "" ? label : `${label} ${suffix.slice(1)}`;
  let next: Graph = { ...doc, nodes: [...doc.nodes, newNode(kind, id, name)] };
  if (doc.layout && at) next = setPositions(next, { [id]: at });
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
 * An id "follows" its object's name while it is exactly the slug of that name,
 * or that slug with the numeric suffix `uniqueId` adds. Editing the id by hand
 * breaks the link.
 */
export function followsName(id: Id, name: string): boolean {
  const slug = slugify(name, "");
  if (slug === "") return true;
  return id === slug || new RegExp(`^${slug}-\\d+$`).test(id);
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

const edgeIdFor = (from: Id, to: Id): Id => `e-${from}-${to}`;

/** Connect two nodes. The new edge takes every default (`when: always`, `isolation: fresh`). */
export function connect(doc: Graph, from: Id, to: Id): { doc: Graph; id: Id } {
  const id = uniqueId(edgeIdFor(from, to), allIds(doc));
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

/** Add a loop over `members`. It starts with no back edge and no stop; the validator says what is missing. */
export function addLoop(doc: Graph, members: Id[] = []): { doc: Graph; id: Id } {
  const id = uniqueId("loop", allIds(doc));
  const name = id === "loop" ? "Loop" : `Loop ${id.slice("loop-".length)}`;
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

const toggle = (list: Id[], id: Id): Id[] => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);

/** Add or remove a member. Members keep document node order, so the loop reads the way the graph does. */
export function toggleLoopMember(doc: Graph, loopId: Id, nodeId: Id): Graph {
  const order = new Map(doc.nodes.map((n, i) => [n.id, i]));
  return updateLoop(doc, loopId, (loop) => ({
    ...loop,
    members: toggle(loop.members, nodeId).sort((a, b) => (order.get(a) ?? 1e9) - (order.get(b) ?? 1e9)),
  }));
}

export function toggleLoopBack(doc: Graph, loopId: Id, edgeId: Id): Graph {
  const order = new Map(doc.edges.map((e, i) => [e.id, i]));
  return updateLoop(doc, loopId, (loop) => ({
    ...loop,
    back: toggle(loop.back, edgeId).sort((a, b) => (order.get(a) ?? 1e9) - (order.get(b) ?? 1e9)),
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

export function addStop(doc: Graph, loopId: Id, kind: StopKind): Graph {
  return updateLoop(doc, loopId, (loop) => ({ ...loop, stops: [...loop.stops, newStop(kind)] }));
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
 * Rename a node, edge or loop id and every reference to it. Run notes are
 * history and keep the id they were written with. Edge ids that were derived
 * from a renamed node (`e-<from>-<to>`) are re-derived so they stay readable.
 */
export function renameId(doc: Graph, from: Id, to: Id): Graph {
  if (from === to) return doc;
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
  if (doc.policies) next.policies = doc.policies.map((p) => ({ ...p, scope: swapScope(p.scope) }));
  if (doc.groups) next.groups = doc.groups.map((g) => ({ ...g, members: g.members.map(swap) }));
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
