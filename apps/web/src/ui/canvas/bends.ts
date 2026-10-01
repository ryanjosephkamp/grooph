/**
 * How far each edge bows from the straight line between its nodes' centres,
 * in pixels at the middle of the curve (positive: to the right of the
 * direction of travel, in screen coordinates).
 *
 * - A loop's back edge always bows right, so the way round a loop reads the
 *   same everywhere.
 * - An edge whose straight line would cross another node bows far enough to
 *   clear it, on whichever side needs less.
 * - Edges that share a pair of nodes bow apart so none is drawn over another.
 *
 * And where each edge's label sits along its curve: at the middle, unless
 * that would put it on a node (a back edge across a fan-out lands on the
 * node between), in which case it slides along the curve to the nearest
 * clear point.
 */
import type { Graph, Id } from "@grooph/core";

export type Box = { x: number; y: number; w: number; h: number };

const MARGIN = 14;
const PAIR_STEP = 26;
const MAX_BEND = 420;

export function edgeBends(doc: Graph, boxes: Record<Id, Box>): Map<Id, number> {
  const back = new Set(doc.loops.flatMap((l) => l.back));
  const pairSeen = new Map<string, number>();
  const bends = new Map<Id, number>();

  for (const edge of doc.edges) {
    const a = boxes[edge.from];
    const b = boxes[edge.to];
    if (!a || !b || edge.from === edge.to) continue;
    const ca = { x: a.x + a.w / 2, y: a.y + a.h / 2 };
    const cb = { x: b.x + b.w / 2, y: b.y + b.h / 2 };
    const len = Math.hypot(cb.x - ca.x, cb.y - ca.y) || 1;
    const u = { x: (cb.x - ca.x) / len, y: (cb.y - ca.y) / len };
    const n = { x: -u.y, y: u.x }; // right-hand normal

    // For every node the straight line runs through: the bow each side needs to clear it.
    let needRight = 0;
    let needLeft = 0;
    let blocked = false;
    for (const [id, box] of Object.entries(boxes)) {
      if (id === edge.from || id === edge.to) continue;
      const corners = [
        [box.x - MARGIN, box.y - MARGIN],
        [box.x + box.w + MARGIN, box.y - MARGIN],
        [box.x - MARGIN, box.y + box.h + MARGIN],
        [box.x + box.w + MARGIN, box.y + box.h + MARGIN],
      ].map(([x, y]) => ({
        t: ((x! - ca.x) * u.x + (y! - ca.y) * u.y) / len, // position along the edge, 0…1
        d: (x! - ca.x) * n.x + (y! - ca.y) * n.y, // distance to the right of it
      }));
      const tMin = Math.min(...corners.map((c) => c.t));
      const tMax = Math.max(...corners.map((c) => c.t));
      const dMin = Math.min(...corners.map((c) => c.d));
      const dMax = Math.max(...corners.map((c) => c.d));
      if (tMax <= 0 || tMin >= 1 || dMin > 0 || dMax < 0) continue;
      blocked = true;
      // A quadratic curve bowing `bend` at its middle is 4t(1-t)·bend off the line at t.
      const t = Math.min(Math.max((tMin + tMax) / 2, 0.15), 0.85);
      const k = 4 * t * (1 - t);
      needRight = Math.max(needRight, dMax / k);
      needLeft = Math.max(needLeft, -dMin / k);
    }

    const pair = [edge.from, edge.to].sort().join("|");
    const rank = pairSeen.get(pair) ?? 0;
    pairSeen.set(pair, rank + 1);

    let bend = 0;
    if (back.has(edge.id)) bend = Math.max(Math.min(Math.max(len * 0.3, 48), 200), blocked ? needRight : 0);
    else if (blocked) bend = needRight <= needLeft ? needRight : -needLeft;
    if (rank > 0) bend += (bend < 0 ? -1 : 1) * rank * PAIR_STEP;
    bends.set(edge.id, Math.max(-MAX_BEND, Math.min(MAX_BEND, bend)));
  }
  return bends;
}

export type Pt = { x: number; y: number };
/** An edge as drawn: a straight line, or a quadratic curve through `control`. */
export type Curve = { start: Pt; end: Pt; control?: Pt };

const centre = (b: Box): Pt => ({ x: b.x + b.w / 2, y: b.y + b.h / 2 });

/** Where the ray from the box's centre towards `toward` leaves the box, pushed out by `gap`. */
function border(b: Box, toward: Pt, gap: number): Pt {
  const c = centre(b);
  const dx = toward.x - c.x;
  const dy = toward.y - c.y;
  if (dx === 0 && dy === 0) return c;
  const t = Math.min(dx === 0 ? Infinity : b.w / 2 / Math.abs(dx), dy === 0 ? Infinity : b.h / 2 / Math.abs(dy));
  const len = Math.hypot(dx, dy);
  return { x: c.x + dx * t + (dx / len) * gap, y: c.y + dy * t + (dy / len) * gap };
}

/** Edges float between node borders, straight or as a quadratic curve bowing `bend` pixels at its middle. */
export function edgeCurve(a: Box, b: Box, bend: number): Curve {
  const ca = centre(a);
  const cb = centre(b);
  if (bend === 0) return { start: border(a, cb, 2), end: border(b, ca, 4) };
  const dist = Math.hypot(cb.x - ca.x, cb.y - ca.y) || 1;
  // right-hand normal in screen coordinates (y grows downward)
  const nx = -(cb.y - ca.y) / dist;
  const ny = (cb.x - ca.x) / dist;
  const control = { x: (ca.x + cb.x) / 2 + nx * bend * 2, y: (ca.y + cb.y) / 2 + ny * bend * 2 };
  return { start: border(a, control, 2), end: border(b, control, 4), control };
}

/** The point a fraction `t` of the way along the curve (0 at its start, 1 at its end). */
export function pointAt({ start, end, control }: Curve, t: number): Pt {
  if (!control) return { x: start.x + (end.x - start.x) * t, y: start.y + (end.y - start.y) * t };
  const u = 1 - t;
  return { x: u * u * start.x + 2 * u * t * control.x + t * t * end.x, y: u * u * start.y + 2 * u * t * control.y + t * t * end.y };
}

const LABEL_HEIGHT = 28;
const LABEL_CLEAR = 4;
/** The label chip's size, estimated from its words: 12 px text at weight 650 in a 28 px chip with 10 px of padding each side. */
export function labelSize(text: string, approval: boolean): { w: number; h: number } {
  if (text === "" && !approval) return { w: 14, h: 14 };
  return { w: 22 + text.length * 6.9 + (approval ? 66 : 0), h: LABEL_HEIGHT };
}

/** The words an edge's label shows: its condition, or nothing for an edge that is always taken. */
export function edgeLabelText(edge: Graph["edges"][number]): string {
  const when = edge.when ?? "always";
  return typeof when === "string" ? when : `verdict: ${when.verdict || "…"}`;
}

/**
 * Where along its curve each edge's label sits, as a fraction (0.5 is the middle). The middle is kept
 * whenever it is clear. A label that would cover a node, or a label already placed, tries the nearest
 * points either side, out to 0.15 and 0.85; one with no clear point stays in the middle.
 */
export function labelSpots(doc: Graph, boxes: Record<Id, Box>, bends: Map<Id, number>): Map<Id, number> {
  const spots = new Map<Id, number>();
  const placed: Box[] = [];
  const nodes = Object.values(boxes);
  const hits = (r: Box, others: Box[], pad: number) =>
    others.some((o) => r.x < o.x + o.w + pad && r.x + r.w > o.x - pad && r.y < o.y + o.h + pad && r.y + r.h > o.y - pad);
  const steps = [0.5, 0.42, 0.58, 0.34, 0.66, 0.26, 0.74, 0.2, 0.8, 0.15, 0.85];

  for (const edge of doc.edges) {
    const a = boxes[edge.from];
    const b = boxes[edge.to];
    if (!a || !b || edge.from === edge.to) continue;
    const curve = edgeCurve(a, b, bends.get(edge.id) ?? 0);
    const text = edgeLabelText(edge);
    const size = labelSize(text === "always" ? "" : text, edge.approval !== undefined);
    const rectAt = (t: number): Box => {
      const p = pointAt(curve, t);
      return { x: p.x - size.w / 2, y: p.y - size.h / 2, w: size.w, h: size.h };
    };
    const clearOfNodes = steps.filter((t) => !hits(rectAt(t), nodes, LABEL_CLEAR));
    const t = clearOfNodes.find((s) => !hits(rectAt(s), placed, 2)) ?? clearOfNodes[0] ?? 0.5;
    spots.set(edge.id, t);
    placed.push(rectAt(t));
  }
  return spots;
}
