/**
 * Rings (handoff 0096; D1 of the studio): each loop is a ring lying flat, with its own nodes standing round it in
 * the order of a round. A loop inside another is a ring of its own standing on the outer one, where its nodes would
 * be: the outer round passes through it. What is in no loop stands in a line on the ground, in the order of a first
 * pass, by its name alone where there is a loop (this view is of the loops), and the rings lie along that line where
 * the graph comes to them.
 *
 * An edge to the next station is the ring itself, drawn along it; the way back from the last station is the rest of
 * the ring, which is what closes it. Any other edge between a ring's nodes (a way back that cuts the round short, a
 * fan out) is an arch across. A ring has no height for rounds: on a run's page it says the round the run is in, and
 * an edge the run has not taken by the note the slider is at is faint.
 */
import type { Prim } from "./draw.js";
import type { Id, MLoop, V } from "./model.js";
import { arch, by, card, circle, edgeLine, ground, hue, stations, TAU, type Stop, type View } from "./shapes.js";

export const rings: View = (m, shown) => {
  const prims: Prim[] = [];
  const at: Record<Id, V> = {};
  const ring: Record<Id, { c: V; r: number; stops: Stop[] }> = {};
  const paths: Record<Id, V[]> = {};
  // A ring is large enough for its stations, and larger than any ring that stands on it.
  const R = (loop: MLoop): number => Math.max(loop.inside ? 60 : 84, stations(m, loop).length * (loop.inside ? 30 : 40), ...m.loops.filter((l) => l.inside === loop.id).map((l) => R(l) + 30));
  // A station's place on its ring: the first at the far side, where the way in arrives, and on round to the right.
  const where = (c: V, r: number, i: number, k: number): V => [c[0] + r * Math.sin((TAU * i) / k), c[1], c[2] - r * Math.cos((TAU * i) / k)];
  function place(loop: MLoop, c: V): void {
    const stops = stations(m, loop);
    const r = R(loop);
    ring[loop.id] = { c, r, stops };
    const color = hue(m, loop.id);
    prims.push({ t: "poly", pts: [...circle(c, r + 15, c[1], 48), ...circle(c, r - 15, c[1], 48).reverse()], fill: color, fa: 0.2, key: `loop:${loop.id}` });
    // Its name in the middle, and on a run's page the round the run is in there, or was last in.
    const run = m.run ? (shown.until?.[loop.id] ?? null) : undefined;
    prims.push({ t: "text", at: c, text: `${loop.name}${run === undefined ? "" : run === null ? "\nnot entered" : `\nround ${Math.floor(run.now)}`}`, align: "center", bold: true, fill: color, size: 10.5, max: r * 1.5 });
    stops.forEach((stop, i) => {
      const p = where(c, r, i, stops.length);
      if (stop.node) ((at[stop.node] = p), prims.push(card(by(m.nodes, stop.node), p)));
      else if (stop.loop) {
        // A loop inside this one: a ring of its own, standing on this ring where its nodes would be.
        const up: V = [p[0], p[1] + 64, p[2]];
        prims.push({ t: "line", pts: [p, up], stroke: hue(m, stop.loop.id), w: 1.2, dash: [2, 3] }, { t: "dot", at: p, r: 4, fill: hue(m, stop.loop.id), lift: -3990 });
        place(stop.loop, up);
      }
      // A node this loop shares with another, which stands on the other's ring: said here, and drawn there once.
      else if (stop.away) prims.push({ t: "text", at: p, text: `${by(m.nodes, stop.away).name}: on ${by(m.loops, by(m.nodes, stop.away).loop!).name}`, align: "center", fill: "ink-3", size: 10.5, max: 96 });
    });
  }
  const line = ground(m);
  let z = 0;
  for (const item of line) {
    if (item.node) ((at[item.node] = [0, 0, z]), prims.push(card(by(m.nodes, item.node), at[item.node]!, { stand: true, side: true, small: m.loops.length > 0 }), { t: "dot", at: at[item.node]!, r: 3, fill: "ink-2", lift: -3990 }), (z += 78));
    else if (item.loop) {
      // A ring of its own at the first station stands where the way in arrives: room for it. And room for the
      // card of the first station, which stands over where the node before the ring would otherwise be.
      const first = stations(m, item.loop)[0]?.loop;
      const r = R(item.loop) + 26;
      z += (first ? R(first) + 24 : 0) + (z ? 56 : 0);
      place(item.loop, [0, 0, z + r - 20]);
      z += 2 * r + 38;
    }
  }
  // Where an edge runs. Between two stations of a ring, to the next: along the ring. The way back from the last
  // station: the rest of the ring. Anything else: an arch, across the ring or over the ground; one from or to a node
  // on the ground rises over the ground nodes it passes, so that it does not read as a chain through them.
  const station = (stops: Stop[], id: Id): number => stops.findIndex((stop) => stop.node === id || !!stop.loop?.members.includes(id));
  const taken = (id: Id): boolean => shown.took.some((x) => x.edge === id && (shown.k === 0 || x.step <= shown.k));
  for (const e of m.edges) {
    const [p, q] = [at[e.from]!, at[e.to]!];
    const loop = m.loops.filter((l) => l.members.includes(e.from) && l.members.includes(e.to)).sort((x, y) => x.members.length - y.members.length)[0];
    let pts: V[] | undefined;
    if (loop) {
      const { c, r, stops } = ring[loop.id]!;
      const [i, j, k] = [station(stops, e.from), station(stops, e.to), stops.length];
      const arc = (from: number, to: number): V[] => Array.from({ length: 25 }, (_, n) => where(c, r, from + ((to - from) * n) / 24, k));
      if (i >= 0 && j >= 0 && i !== j && !e.back && j === i + 1) pts = arc(i, j);
      else if (i >= 0 && j >= 0 && i !== j && e.back === loop.id && i === k - 1 && j === 0) pts = arc(i, k);
      // A station that is a ring of its own is entered and left at the node, up on that ring.
      if (pts) pts = [...(stops[i]!.loop ? [p] : []), ...pts, ...(stops[j % k]!.loop ? [q] : [])];
    }
    // A node on a ring is where its outermost ring is in the line.
    const spot = (id: Id): number => line.findIndex((item) => item.node === id || !!item.loop?.members.includes(id));
    const [a, b] = [spot(e.from), spot(e.to)].sort((x, y) => x - y) as [number, number];
    const over = by(m.nodes, e.from).loop && by(m.nodes, e.to).loop ? 0 : 26 * line.slice(a + 1, b).filter((item) => item.node).length;
    paths[e.id] = pts ?? arch(p, q, e.back ? 54 : over, 18);
    // On a run's page an edge the run has not taken by this note is faint.
    prims.push(edgeLine(m, e, paths[e.id]!, m.run && !taken(e.id) ? { alpha: 0.3 } : {}));
  }
  for (const p of prims) if (p.t !== "card") p.grow = true;
  return { prims, node: (id) => at[id]!, path: (e) => paths[e]! };
};
