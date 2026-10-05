/** What every view of a graph in three dimensions draws alike (handoff 0096): a card, an edge, a curve. */
import type { Prim } from "./draw.js";
import type { Id, MEdge, MLoop, MNode, Model, V } from "./model.js";

/** What a view is asked to draw: the step the slider is at, and how far a run has come by it. */
export type Shown = {
  /** the slider's place; 0 is the whole thing at once */
  k: number;
  lit: Set<string> | null;
  /** a run's dispatches so far; undefined at step 0, where all of them are shown */
  dispatches?: number;
  /** each loop a run has entered: where it is in it now, or was last, and the farthest up it has been, in rounds */
  until?: Record<Id, { now: number; most: number }>;
  /** the edges a run took, each with the rounds it was taken between and the step it was taken at */
  took: { edge: Id; r0: number; r1: number; step: number }[];
  /** a note about an edge, which is not a move along it: the edge and the round the run stood in */
  about?: { edge: Id; r0: number };
};
/** A view, built: its things, and where a node is and an edge runs, for what travels along them. */
export type Built = { prims: Prim[]; node(id: Id, round?: number): V; path(edge: Id, r0?: number, r1?: number): V[] };
export type View = (m: Model, shown: Shown) => Built;

export const TAU = Math.PI * 2;
export const lerp = (a: V, b: V, t: number): V => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
export const by = <T extends { id: Id }>(list: T[], id: Id): T => list.find((x) => x.id === id)!;
/** A loop's color: the canvas's own, by the loop's place in the document. */
export const hue = (m: Model, loop: Id): string => `loop-${m.loops.findIndex((l) => l.id === loop) % 4}`;
export const card = (n: MNode, at: V, more: { stand?: boolean; side?: boolean; small?: boolean } = { stand: true }): Prim => ({ t: "card", at, id: n.id, key: `node:${n.id}`, ...more });
/** A circle lying flat at a height, or an arc of one. */
export const circle = (c: V, r: number, y: number, n = 40, from = 0, to = TAU): V[] => Array.from({ length: n + 1 }, (_, k) => [c[0] + r * Math.cos(from + ((to - from) * k) / n), y, c[2] + r * Math.sin(from + ((to - from) * k) / n)]);
/** A stop on the way round: a node, or a loop taken as one stop. */
export type Stop = { node?: Id; loop?: MLoop; first: number };
const firstOf = (m: Model): ((id: Id) => number) => {
  const rank = new Map(m.rows.flat().map((id, k) => [id, k]));
  return (id) => rank.get(id) ?? m.rows.flat().length;
};
/** The stations of a loop, in the order of a round: its own nodes, and a loop inside it as one stop. */
export function stations(m: Model, loop: MLoop): Stop[] {
  const first = firstOf(m);
  return [...loop.own.map((id) => ({ node: id, first: first(id) })), ...m.loops.filter((l) => l.inside === loop.id).map((l) => ({ loop: l, first: Math.min(...l.members.map(first)) }))].sort((a, b) => a.first - b.first);
}
/** The top of the graph, in the order of a first pass: the nodes in no loop, and the loops in no other. */
export function ground(m: Model): Stop[] {
  const first = firstOf(m);
  return [...m.nodes.filter((n) => !n.loop).map((n) => ({ node: n.id, first: first(n.id) })), ...m.loops.filter((l) => !l.inside).map((l) => ({ loop: l, first: Math.min(...l.members.map(first)) }))].sort((a, b) => a.first - b.first);
}
/** A curve from a to b, lifted in the middle: an edge that leaves the ground to get where it is going. */
export const arch = (a: V, b: V, lift: number, n = 16): V[] =>
  Array.from({ length: n + 1 }, (_, k) => {
    const p = lerp(a, b, k / n);
    return [p[0], p[1] + lift * 4 * (k / n) * (1 - k / n), p[2]];
  });
/** An edge: solid and gray when it goes on, dashed in its loop's color when it is a way back into that loop. */
export const edgeLine = (m: Model, e: MEdge, pts: V[], more: Partial<Extract<Prim, { t: "line" }>> = {}): Prim => ({ t: "line", pts, stroke: e.back ? hue(m, e.back) : "ink-2", ...(e.back ? { dash: [6, 4] } : {}), w: e.back ? 1.8 : 1.4, arrow: true, key: `edge:${e.id}`, inset: [2, 1], ...more });
/** The point so far along a line, from 0 to 1. */
export const along = (pts: V[], t: number): V => {
  const at = Math.max(0, Math.min(1, t)) * (pts.length - 1);
  const k = Math.min(pts.length - 2, Math.floor(at));
  return pts.length < 2 ? pts[0]! : lerp(pts[k]!, pts[k + 1]!, at - k);
};
