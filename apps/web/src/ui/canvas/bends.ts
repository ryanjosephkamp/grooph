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
