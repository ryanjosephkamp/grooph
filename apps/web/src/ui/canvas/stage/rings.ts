/**
 * Rings (handoff 0096; D1 of the studio): each loop is a ring lying flat, with its own nodes standing round it in
 * the order of a first pass, the first of them at the far side. A loop inside another is a ring of its own standing
 * on the outer one, where its nodes would be: the outer round passes through it. What is in no loop stands in a line
 * on the ground, in the order of a first pass, by its name alone where there is a loop (this view is of the loops),
 * and the rings lie along that line where the graph comes to them.
 *
 * An edge from one station to the next is the ring itself, drawn along it; a loop's own way back from its last
 * station to its first is the rest of the ring, which is what closes it. Any other edge is drawn across: a way back
 * that cuts the round short as an arch, a fan out as a line; and an edge that would run through a node it has
 * nothing to do with goes round it. Two edges between the same two nodes are drawn apart. A ring has no height for
 * rounds: on a run's page it says the round the run is in, and an edge the run has not taken by the note the slider
 * is at is faint.
 */
import type { Prim } from "./draw.js";
import { under, type Id, type MLoop, type V } from "./model.js";
import { arch, by, card, circle, edgeLine, ground, hue, stations, TAU, type Stop, type View } from "./shapes.js";

export const rings: View = (m, shown) => {
  const prims: Prim[] = [];
  const at: Record<Id, V> = {};
  const ring: Record<Id, { c: V; r: number; stops: Stop[] }> = {};
  const paths: Record<Id, V[]> = {};
  // A ring is large enough for its stations, larger than any ring that stands on it, and, where two or more stand on
  // it, large enough that they stand clear of each other.
  const R = (loop: MLoop): number => {
    const on = m.loops.filter((l) => l.inside === loop.id).map(R);
    const k = stations(m, loop).length;
    return Math.max(loop.inside ? 60 : 84, k * (loop.inside ? 30 : 40), ...on.map((r) => r + 30), on.length > 1 ? (Math.max(...on) + 20) / Math.sin(Math.PI / k) : 0);
  };
  // How far a ring and all that stands on it reach from its middle.
  const reach = (loop: MLoop): number => R(loop) + Math.max(0, ...m.loops.filter((l) => l.inside === loop.id).map(reach));
  // A station's place on its ring: the first at the far side, and on round to the right.
  const where = (c: V, r: number, i: number, k: number): V => [c[0] + r * Math.sin((TAU * i) / k), c[1], c[2] - r * Math.cos((TAU * i) / k)];
  function place(loop: MLoop, c: V): void {
    const stops = stations(m, loop);
    const r = R(loop);
    ring[loop.id] = { c, r, stops };
    const color = hue(m, loop.id);
    prims.push({ t: "poly", pts: [...circle(c, r + 15, c[1], 48), ...circle(c, r - 15, c[1], 48).reverse()], fill: color, fa: 0.2, key: `loop:${loop.id}` });
    // Its name outside it, at the near left, where no card stands (a card stands over its station, and the near
    // station's is over the middle of a small ring); and on a run's page the round the run is in there, or was last in.
    const run = m.run ? (shown.until?.[loop.id] ?? null) : undefined;
    prims.push({ t: "text", at: [c[0] - (r + 24) * 0.65, c[1], c[2] + (r + 24) * 0.76], text: `${loop.name}${run === undefined ? "" : run === null ? "\nnot entered" : `\nround ${Math.floor(run.now)}`}`, align: "right", bold: true, fill: color, size: 10.5, max: 110 });
    stops.forEach((stop, i) => {
      const p = where(c, r, i, stops.length);
      // (In a frame a phone's width a card is its name alone, as in the spiral: three whole cards cover a small ring.)
      if (stop.node) ((at[stop.node] = p), prims.push(card(by(m.nodes, stop.node), p, { stand: true, small: m.narrow })));
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
      // Room for the ring and for every ring that stands on it, and for the card of its first station, which
      // stands over where the node before the ring would otherwise be: no node on the ground is inside a ring.
      const r = reach(item.loop) + 6;
      z += z ? 56 : 0;
      place(item.loop, [0, 0, z + r]);
      z += 2 * r + 58;
    }
  }
  // Where an edge runs. Between two stations of a ring, to the next: along the ring. A loop's own way back from its
  // last station to its first: the rest of the ring (all of it, for a loop of one node). Anything else is drawn
  // across, a way back as an arch; and it goes round each node it would otherwise run through, on the ground or on
  // a ring, so that it does not read as a chain through them. A second edge between the same two nodes is drawn
  // apart from the first: outside it on the ring, or higher.
  const station = (stops: Stop[], id: Id): number => stops.findIndex((stop) => stop.node === id || (!!stop.loop && (by(m.nodes, id).loop === stop.loop.id || under(m.loops, by(m.nodes, id).loop ?? "", stop.loop.id))));
  const taken = (id: Id): boolean => shown.took.some((x) => x.edge === id && (shown.k === 0 || x.step <= shown.k));
  // How far aside an edge from p to q goes to be clear of what a straight line would run through, seen from above
  // (an edge that rises to a ring on a ring runs over what stands under it): each node other than its ends, by the
  // room its card takes (a card on a ring stands over its node, to both sides; one on the ground is to the right).
  // The foot of a ring that stands on another is under that ring's first node, so an edge along the ground goes
  // round it with the node. The bow is widest at its middle, so a thing nearer an end asks for more of it, to be
  // as clear where it stands.
  const need = (o: V, p: V, q: V, clear: number): number => {
    const [dx, dz, wx, wz] = [q[0] - p[0], q[2] - p[2], o[0] - p[0], o[2] - p[2]];
    const t = Math.max(0, Math.min(1, (wx * dx + wz * dz) / (dx * dx + dz * dz || 1)));
    // (By as much more as the thing is off the line: it may be on the side the edge goes to.)
    const off = Math.hypot(wx - dx * t, wz - dz * t);
    return off < 24 ? (clear + off) / Math.max(0.36, 4 * t * (1 - t)) : 0;
  };
  const passes = (e: { from: Id; to: Id }, p: V, q: V): number =>
    m.nodes.reduce((sum, n) => sum + (n.id !== e.from && n.id !== e.to ? need(at[n.id]!, p, q, n.loop && !m.narrow ? 62 : 34) : 0), 0);
  m.edges.forEach((e, n) => {
    const [p, q] = [at[e.from]!, at[e.to]!];
    const twin = m.edges.slice(0, n).filter((x) => x.from === e.from && x.to === e.to).length;
    const loop = m.loops.filter((l) => l.members.includes(e.from) && l.members.includes(e.to)).sort((x, y) => x.members.length - y.members.length)[0];
    let pts: V[] | undefined;
    if (loop) {
      const { c, r, stops } = ring[loop.id]!;
      const [i, j, k] = [station(stops, e.from), station(stops, e.to), stops.length];
      const arc = (from: number, to: number): V[] => Array.from({ length: 25 }, (_, n) => where(c, r + 16 * twin, from + ((to - from) * n) / 24, k));
      if (i >= 0 && j >= 0 && !e.back && j === i + 1) pts = arc(i, j);
      else if (i >= 0 && j >= 0 && e.back === loop.id && i === k - 1 && j === 0) pts = arc(i, k);
      // A station that is a ring of its own is entered and left at the node, up on that ring.
      if (pts) pts = [...(stops[i]!.loop || twin ? [p] : []), ...pts, ...(stops[j % k]!.loop || twin ? [q] : [])];
    }
    // A node's own edge to itself, where it is not the whole ring: a small round beside the node, away from its
    // ring's middle, or to the left of the line on the ground.
    if (!pts && e.from === e.to) {
      const o = loop ? ring[loop.id]!.c : [p[0] + 1, 0, p[2]];
      const d = (26 + 8 * twin) / (Math.hypot(p[0] - o[0], p[2] - o[2]) || 1);
      const c: V = [p[0] + (p[0] - o[0]) * d, p[1], p[2] + (p[2] - o[2]) * d];
      const a = Math.atan2(p[2] - c[2], p[0] - c[0]);
      pts = circle(c, 26 + 8 * twin, p[1], 24, a, a + TAU);
    }
    // Round what it would run through: out to the side on the ground, to the left whichever way it runs, where
    // no card on the ground stands (that is to a node's right). Up, it would run behind the node's card.
    const [aside, far] = [passes(e, p, q), Math.hypot(q[0] - p[0], q[2] - p[2]) || 1];
    const [ux, uz] = [(q[2] - p[2]) / far, (q[0] - p[0]) / far].map((u) => (q[2] < p[2] ? -u : u)) as [number, number];
    paths[e.id] = pts ?? arch(p, q, (e.back ? 54 : 0) + 22 * twin, 18).map((v, n): V => [v[0] - ux * aside * 4 * (n / 18) * (1 - n / 18), v[1], v[2] + uz * aside * 4 * (n / 18) * (1 - n / 18)]);
    // On a run's page an edge the run has not taken by this note is faint.
    prims.push(edgeLine(m, e, paths[e.id]!, m.run && !taken(e.id) ? { alpha: 0.3 } : {}));
  });
  for (const p of prims) if (p.t !== "card") p.grow = true;
  return { prims, node: (id) => at[id]!, path: (e) => paths[e]! };
};
