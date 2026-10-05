/** What every view of a graph in three dimensions draws alike (handoff 0096): a card, an edge, a curve. */
import type { Prim } from "./draw.js";
import type { Id, MEdge, MNode, Model, V } from "./model.js";

/** What a view is asked to draw: the step the slider is at, and how far a run has come by it. */
export type Shown = {
  /** the slider's place; 0 is the whole thing at once */
  k: number;
  lit: Set<string> | null;
  /** a run's dispatches so far; undefined at step 0, where all of them are shown */
  dispatches?: number;
  /** how far up each loop's spiral a run has come, in rounds */
  until?: Record<Id, number | undefined>;
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
export const card = (n: MNode, at: V, more: { stand?: boolean; side?: boolean } = { stand: true }): Prim => ({ t: "card", at, id: n.id, key: `node:${n.id}`, ...more });
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
