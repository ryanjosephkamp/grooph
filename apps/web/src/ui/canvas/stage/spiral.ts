/**
 * The spiral and its lid (handoff 0096; D2 of the studio): each loop is a spiral, a round is one turn upward, and a
 * brake is a place on the way up. The lid is the round at which max iterations stops the loop; a person asked every
 * so many rounds is an amber ring at each of those rounds; a budget in dispatches is a dashed ring where it would
 * run out if every round cost what a full round costs at the least, and is called a reading. On a run's page the
 * spiral is solid as far as the run came, with a bead for each dispatch in the round it was in.
 *
 * As the studio's second reader held it: the lid is never lit with its loop, since no cap fired by being looked at;
 * a run's edges are drawn in the round the run took them, and one it never took is faint; a round is a loop's own,
 * and a loop inside another starts its rounds afresh, which is why it is a spiral of its own beside the outer one.
 */
import type { Prim } from "./draw.js";
import type { Id, MEdge, MLoop, Model, Step, V } from "./model.js";
import { arch, by, card, circle, edgeLine, ground, hue, stations, TAU, type Shown, type Stop, type View } from "./shapes.js";

const H = 54;

/**
 * Where a run is on each loop's spiral by a step, in rounds and parts of a round: where it is now, or was last, and
 * the farthest up it has been (a loop inside another starts afresh each time the outer one comes round, so the two
 * differ). A loop the run has not entered is not in the answer. A node of a loop inside this one is at that loop's
 * stop; the outer loop's round goes on by one when the run comes back into it by one of its own ways back.
 */
export function reach(m: Model, steps: Step[], k: number): Record<Id, { now: number; most: number }> {
  const [out, round]: [Record<Id, { now: number; most: number }>, Record<Id, number>] = [{}, {}];
  for (const step of steps.slice(1, k + 1)) {
    const to = step.to;
    if (!to) continue;
    const edge = step.edge && !step.about ? m.edges.find((e) => e.id === step.edge) : undefined;
    for (const loop of m.loops) {
      if (!loop.members.includes(to)) continue;
      if (loop.own.includes(to)) round[loop.id] = step.r1 ?? 0;
      else round[loop.id] = (round[loop.id] ?? 0) + (edge?.back === loop.id ? 1 : 0);
      const stops = stations(m, loop);
      const now = round[loop.id]! + Math.max(0, stops.findIndex((s) => s.node === to || s.loop?.members.includes(to))) / stops.length;
      out[loop.id] = { now, most: Math.max(now, out[loop.id]?.most ?? 0) };
    }
  }
  return out;
}

/** How many rounds tall a loop's spiral is: as tall as its lid; with no lid, two rounds over what the whole run took. */
export const topOf = (m: Model, loop: MLoop): number => loop.cap ?? Math.max(m.run ? (m.run.rounds[loop.id] ?? -1) + 1 : 1, 1) + 2;

/** A loop's brakes in words, and where each is on the way up, in rounds: what the spiral draws and what is said under it. */
export function brakes(loop: MLoop, top: number): { words: string[]; lid: number | null; asked: number[]; budget: number | null } {
  const words: string[] = [loop.cap ? `max iterations: ${loop.cap} (the lid)` : "no lid: no cap on rounds"];
  const asked: number[] = [];
  if (loop.human) {
    for (let u = loop.human; u <= top; u += loop.human) asked.push(u);
    words.push(`a person is asked every ${loop.human === 1 ? "round" : `${loop.human} rounds`} (the amber ring${asked.length === 1 ? "" : "s"})`);
  }
  let budget: number | null = null;
  if (loop.budget?.measure === "dispatches" && loop.perRound) {
    const [full, more] = [Math.floor(loop.budget.limit / loop.perRound), loop.budget.limit % loop.perRound];
    // Drawn only where it is near enough the lid to be read against it.
    if (loop.budget.limit / loop.perRound <= top + 1.5) budget = loop.budget.limit / loop.perRound;
    words.push(`budget: ${loop.budget.limit} dispatches, at most ${full} full round${full === 1 ? "" : "s"}${more ? ` and ${more} more` : ""} (${budget === null ? "above the lid, not drawn" : "the dashed ring, a reading"})`);
  } else if (loop.budget) words.push(`budget: ${loop.budget.limit} ${loop.budget.measure}`);
  return { words, lid: loop.cap, asked, budget };
}

export const spiral: View = (m, shown) => {
  const prims: Prim[] = [];
  const at: Record<Id, V> = {};
  const tower: Record<Id, { c: V; r: number; stops: Stop[]; k: number }> = {};
  const R = (loop: MLoop): number => Math.max(64, stations(m, loop).length * 27);
  type Tower = (typeof tower)[Id];
  const on = (t: Tower, u: number, out = 0): V => [t.c[0] - (t.r + out) * Math.cos(TAU * u), u * H, t.c[2] + (t.r + out) * Math.sin(TAU * u)];
  const helix = (t: Tower, u0: number, u1: number): V[] => {
    const n = Math.max(1, Math.ceil(Math.abs(u1 - u0) * 36));
    return Array.from({ length: n + 1 }, (_, k) => on(t, u0 + ((u1 - u0) * k) / n));
  };
  function place(loop: MLoop, c: V): void {
    const stops = stations(m, loop);
    const k = Math.max(1, stops.length);
    const t = (tower[loop.id] = { c, r: R(loop), stops, k });
    const color = hue(m, loop.id);
    // How far up this spiral the run has been, and the round it is in now, or was last in. A template has its
    // first pass.
    const run = m.run ? (shown.until?.[loop.id] ?? null) : null;
    const came = m.run ? (run?.most ?? null) : (k - 1) / k;
    // As tall whatever the slider is at.
    const top = topOf(m, loop);
    prims.push({ t: "poly", pts: circle(c, t.r + 12, 0), fill: "floor", fa: 0.8, stroke: "line", lift: -400 });
    prims.push({ t: "line", pts: [[c[0], 0, c[2]], [c[0], top * H, c[2]]], stroke: "line-strong", w: 1 });
    // Every round the lid allows, faint; as far as the run came (for a template, its first pass), solid.
    prims.push({ t: "line", pts: helix(t, 0, top), stroke: color, w: 1.3, alpha: 0.5, dash: [3, 4] });
    if (came !== null && came > 0) prims.push({ t: "line", pts: helix(t, 0, Math.min(came, top)), stroke: color, w: 3.2, key: `loop:${loop.id}` });
    // The brakes, each where it is on the way up. The lid has no key: it is not lit when its loop is.
    const brake = brakes(loop, top);
    if (brake.lid) prims.push({ t: "poly", pts: circle(c, t.r + 18, brake.lid * H), fill: "brake", fa: 0.24, stroke: "brake", w: 1.8, lift: 300 });
    // At the lid's own round too, where the person is asked before the cap is looked at: a ring inside the lid.
    for (const u of brake.asked) prims.push({ t: "line", pts: circle(c, t.r + (u === brake.lid ? 9 : 18), u * H), stroke: "k-gate", w: 2.2, lift: 320 });
    if (brake.budget !== null) prims.push({ t: "line", pts: circle(c, t.r + 18, brake.budget * H), stroke: "brake", w: 1.2, dash: [4, 4], alpha: 0.85 });
    const over = Math.max(top, brake.budget ?? 0);
    // The loop's name over its spiral, and on a run's page the round the run is in there, or was last in. Its
    // brakes are said in words under the view (`graph-stage.tsx`), where they are not written over anything.
    const where = !m.run ? "" : run === null ? "\nnot entered" : `\nround ${Math.floor(run.now)}${loop.cap ? `, lid at ${loop.cap}` : ""}`;
    prims.push({ t: "text", at: [c[0], over * H + 46, c[2]], text: `${loop.name}${where}`, align: "center", up: true, fill: color, size: 11, bold: true, max: Math.max(120, 2 * t.r + 30) });
    stops.forEach((stop, i) => {
      if (stop.node) {
        const p = on(t, i / k, 46);
        at[stop.node] = [p[0], p[1] - 30, p[2]];
        prims.push(card(by(m.nodes, stop.node), at[stop.node]!), { t: "line", pts: [on(t, i / k), on(t, i / k, 30)], stroke: color, w: 1, alpha: 0.7 });
      } else if (stop.loop) prims.push({ t: "text", at: on(t, i / k, 34), text: `${stop.loop.name}: the spiral beside`, align: "center", fill: hue(m, stop.loop.id), size: 10.5, bold: true, max: 96 });
    });
    // A run's dispatches so far, each a bead where it happened: the round it was in, and whether it passed.
    m.run?.dispatches.forEach((d, n) => {
      const i = stops.findIndex((stop) => stop.node === d.node);
      if (i < 0 || d.round === null || (shown.dispatches !== undefined && n >= shown.dispatches)) return;
      prims.push({ t: "dot", at: on(t, d.round + i / k), r: 6, fill: d.outcome === "fail" ? "bad" : "ok", stroke: "card" });
    });
  }
  // The ground: what comes before the loops recedes behind the first spiral, the spirals stand side by side (one
  // inside another stands before it: its rounds start afresh each time the outer one comes round), and what comes
  // after them comes forward.
  const order: Stop[] = [];
  const nest = (loop: MLoop): void => (m.loops.filter((l) => l.inside === loop.id).forEach(nest), void order.push({ loop, first: 0 }));
  for (const item of ground(m)) item.loop ? nest(item.loop) : order.push(item);
  const firstLoop = order.findIndex((item) => item.loop);
  const lastLoop = order.length - 1 - [...order].reverse().findIndex((item) => item.loop);
  let x = 0;
  order.forEach((item, n) => {
    if (item.loop) {
      const r = R(item.loop) + 40;
      place(item.loop, [x + r, 0, 0]);
      x += 2 * r + 56;
    } else if (firstLoop < 0 || (n > firstLoop && n < lastLoop)) ((at[item.node!] = [x + 50, 0, 0]), (x += 130));
  });
  if (firstLoop >= 0) {
    // Far enough back, and far enough forward, to stand clear of the cards on the first and last spirals.
    order.slice(0, firstLoop).reverse().forEach((item, n) => (at[item.node!] = [-170 - n * 56, 0, -230 - n * 124]));
    order.slice(lastLoop + 1).forEach((item, n) => (at[item.node!] = [x - 6 + n * 20, 0, 130 + n * 124]));
  } else prims.push({ t: "text", at: [x / 2, 70, 0], text: "No loop in this graph: nothing goes round, and there is no spiral to draw.", align: "center", fill: "ink-3", size: 11, max: 220 });
  // What is in no loop stands on the ground, by its name alone where there is a loop: this view is of the loops.
  for (const item of order) if (item.node) prims.push(card(by(m.nodes, item.node), at[item.node]!, { stand: true, side: true, small: firstLoop >= 0 }), { t: "dot", at: at[item.node]!, r: 3, fill: "ink-2", lift: -3990 });
  // Where a node is in a given round: on its own loop's spiral, that many turns up.
  const spot = (id: Id, round = 0): V => {
    const loop = m.loops.find((l) => l.id === by(m.nodes, id).loop);
    const t = loop && tower[loop.id];
    const i = t ? t.stops.findIndex((stop) => stop.node === id) : -1;
    return t && i >= 0 ? on(t, round + i / t.k) : at[id]!;
  };
  const round = (e: MEdge): MLoop | undefined => m.loops.find((l) => l.own.includes(e.from) && l.own.includes(e.to));
  const path = (id: Id, r0 = 0, r1 = 0): V[] => {
    const e = by(m.edges, id);
    const loop = round(e);
    if (loop) {
      const t = tower[loop.id]!;
      const [i, j] = [t.stops.findIndex((stop) => stop.node === e.from), t.stops.findIndex((stop) => stop.node === e.to)];
      // Onward round the spiral when that is where the edge goes. A way back from the middle of a round still
      // arrives one turn up, by the short way across.
      if ((!e.back && j === i + 1) || (e.back && i === t.k - 1 && j === 0)) return helix(t, r0 + i / t.k, (e.back ? r0 + 1 : r1) + j / t.k);
      return arch(on(t, r0 + i / t.k), on(t, r1 + j / t.k), 26, 18);
    }
    // Between a loop and what is outside it, or between two loops: from where each is in its round. A way back
    // into a loop inside the one it belongs to arrives at that loop's first round: its rounds start afresh.
    const rise = (node: Id, r: number): number => (by(m.nodes, node).loop ? r : 0);
    return arch(spot(e.from, rise(e.from, r0)), spot(e.to, e.back ? 0 : rise(e.to, r1)), e.back ? 40 : 0, 18);
  };
  // The edges. A template's are drawn as they are in round 0. A run's are drawn where the run took them, in the
  // round it took them, as far as the slider has come; one it never took is faint, at round 0. An edge that is the
  // spiral itself is not drawn twice: it is shown when it is the one a step is about.
  const drawn = new Set<string>();
  const line = (e: MEdge, r0: number, r1: number, more: Partial<Extract<Prim, { t: "line" }>> = {}): void => {
    const key = `edge:${e.id}@${r0}`;
    if (drawn.has(key)) return;
    drawn.add(key);
    const loop = e.back ? undefined : round(e);
    prims.push(edgeLine(m, e, path(e.id, r0, r1), { key, ...(loop ? { hide: !shown.lit?.has(key), stroke: hue(m, loop.id), w: 3.2 } : {}), ...more }));
  };
  for (const e of m.edges) {
    const took = shown.took.filter((x) => x.edge === e.id && (shown.k === 0 || x.step <= shown.k));
    if (!m.run) line(e, 0, e.back ? 1 : 0);
    else if (took.length) for (const x of took) line(e, x.r0, x.r1);
    else if (!shown.took.some((x) => x.edge === e.id)) line(e, 0, e.back ? 1 : 0, { alpha: 0.3 });
  }
  // A note about an edge the run has not walked by then is shown where the run stood.
  if (shown.about) line(by(m.edges, shown.about.edge), shown.about.r0, shown.about.r0);
  // All of this but the cards is grown once the cards have landed.
  for (const p of prims) if (p.t !== "card") p.grow = true;
  return { prims, node: spot, path };
};
