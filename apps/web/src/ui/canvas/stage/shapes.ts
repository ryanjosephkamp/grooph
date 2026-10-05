/** What every view of a graph in three dimensions draws alike (handoff 0096): a card, an edge, a curve. */
import type { Prim } from "./draw.js";
import { under, type Id, type MEdge, type MLoop, type MNode, type Model, type Step, type V } from "./model.js";

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
/** A stop on the way round: a node, a loop taken as one stop, or a node of this loop that stands on another loop's
 *  spiral or ring because the two loops share it and it is the other's (`own` in `model.ts`). */
export type Stop = { node?: Id; loop?: MLoop; away?: Id; first: number };
const firstOf = (m: Model): ((id: Id) => number) => {
  const rank = new Map(m.rows.flat().map((id, k) => [id, k]));
  return (id) => rank.get(id) ?? m.rows.flat().length;
};
/** The stations of a loop, in the order of a round: its own nodes, a loop inside it as one stop, and a node it shares with a loop that is not inside it, where that node is the other's. */
export function stations(m: Model, loop: MLoop): Stop[] {
  const first = firstOf(m);
  const inner = m.loops.filter((l) => l.inside === loop.id);
  const away = loop.members.filter((id) => !loop.own.includes(id) && !inner.some((l) => l.members.includes(id)));
  return [...loop.own.map((id) => ({ node: id, first: first(id) })), ...inner.map((l) => ({ loop: l, first: Math.min(...l.members.map(first)) })), ...away.map((id) => ({ away: id, first: first(id) }))].sort((a, b) => a.first - b.first);
}
/** Which of a loop's stations a node is at: its own, the stop of the loop inside that holds it, or where it is marked as standing elsewhere. */
export const stationOf = (stops: Stop[], id: Id): number => stops.findIndex((s) => s.node === id || s.away === id || !!s.loop?.members.includes(id));
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

/**
 * Where a run is in each loop by a step, in rounds and parts of a round: where it is now, or was last, and the
 * farthest it has been (a loop inside another starts afresh each time the outer one comes round, so the two differ).
 * A loop the run has not entered is not in the answer. A node that is not the loop's own (one of a loop inside it,
 * or one it shares with another loop) is at its stop there, in the round this loop was last in. A loop's round goes
 * on by one when the run comes back into it by one of its own ways back, and every loop inside it, at any depth, is
 * then at round 0 again.
 */
export function reach(m: Model, steps: Step[], k: number): Record<Id, { now: number; most: number }> {
  const [out, round]: [Record<Id, { now: number; most: number }>, Record<Id, number>] = [{}, {}];
  for (const step of steps.slice(1, k + 1)) {
    const to = step.to;
    if (!to) continue;
    const turned = step.edge && !step.about ? (m.edges.find((e) => e.id === step.edge)?.back ?? null) : null;
    if (turned) for (const loop of m.loops) if (under(m.loops, loop.id, turned)) round[loop.id] = 0;
    for (const loop of m.loops) {
      if (!loop.members.includes(to)) continue;
      if (loop.own.includes(to)) round[loop.id] = step.r1 ?? 0;
      else round[loop.id] = (round[loop.id] ?? 0) + (turned === loop.id ? 1 : 0);
      const stops = stations(m, loop);
      const now = round[loop.id]! + Math.max(0, stationOf(stops, to)) / stops.length;
      out[loop.id] = { now, most: Math.max(now, out[loop.id]?.most ?? 0) };
    }
  }
  return out;
}

/**
 * What a view is handed at a step of the slider: what the step lights, and for a run how far it has come by then.
 * An edge is lit by its name, and by its name with the rounds it is taken between, for a view that draws an edge
 * once each time it is taken. A note about the run as a whole lights nothing.
 */
export function shownAt(m: Model, steps: Step[], k: number): Shown {
  const step = steps[k]!;
  // Every edge taken to reach the step's node: the one the step follows, and any taken with it.
  const ways = (s: Step): { edge: Id; r0: number; r1: number }[] => (s.edge && !s.about ? [{ edge: s.edge, r0: s.r0 ?? 0 }, ...(s.also ?? [])].map((e) => ({ ...e, r1: s.r1 ?? 0 })) : []);
  const edges = step.about && step.edge ? [`edge:${step.edge}`] : ways(step).flatMap((e) => [`edge:${e.edge}`, `edge:${e.edge}@${e.r0}>${e.r1}`]);
  const about = [...(step.nodes ?? []).map((id) => `node:${id}`), ...edges, ...(step.loops ?? []).map((id) => `loop:${id}`)];
  const shown: Shown = { k, lit: about.length ? new Set(about) : null, took: m.run ? steps.flatMap((s, n) => ways(s).map((e) => ({ ...e, step: n }))) : [] };
  if (step.about && step.edge) shown.about = { edge: step.edge, r0: step.r0 ?? 0 };
  // A run is drawn as far as the note it is at; step 0 is all of it.
  if (m.run && k > 0) shown.dispatches = steps.slice(1, k + 1).filter((s) => s.dispatch !== undefined).length;
  if (m.run) shown.until = reach(m, steps, k || steps.length - 1);
  return shown;
}
