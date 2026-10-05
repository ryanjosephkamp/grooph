/**
 * The spiral and its lid (handoff 0096; D2 of the studio): each loop is a spiral, a round is one turn upward, and a
 * brake that counts rounds is a place on the way up. The lid stands where max iterations stops the loop: over the
 * last round it allows (rounds number from 0, so a cap of 5 is a lid over round 4). A person asked every so many
 * rounds is an amber ring after each of those rounds. A budget in dispatches is a dashed ring where it runs out if
 * every round is a full one; a round cut short costs less and one with a second dispatch more, so it is called a
 * reading. On a run's page the spiral is solid as far up as the run has been, with a bead for each dispatch in the
 * round it was in.
 *
 * As the studio's second reader held it, and this one's: the lid is never lit with its loop, since no cap fired by
 * being looked at; a run's edges are drawn in the round the run took them, and one it never took is faint; a round
 * is a loop's own, and a loop inside another starts its rounds afresh, which is why it is a spiral of its own beside
 * the outer one, and why two dispatches there can be at one place: they are set side by side, not one on the other.
 */
import type { Prim } from "./draw.js";
import type { Id, MEdge, MLoop, Model, Step, V } from "./model.js";
import { arch, by, card, circle, edgeLine, ground, hue, stationOf, stations, TAU, type Shown, type Stop, type View } from "./shapes.js";

const H = 54;

/**
 * Where a run is on each loop's spiral by a step, in rounds and parts of a round: where it is now, or was last, and
 * the farthest up it has been (a loop inside another starts afresh each time the outer one comes round, so the two
 * differ). A loop the run has not entered is not in the answer. A node that is not the loop's own (one of a loop
 * inside it, or one it shares with another loop) is at its stop there, in the round this loop was last in; the
 * loop's round goes on by one when the run comes back into it by one of its own ways back.
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
      const now = round[loop.id]! + Math.max(0, stationOf(stops, to)) / stops.length;
      out[loop.id] = { now, most: Math.max(now, out[loop.id]?.most ?? 0) };
    }
  }
  return out;
}

/** How many rounds tall a loop's spiral is: as tall as its lid; with no lid, two rounds over the highest the run was in. */
export const topOf = (m: Model, loop: MLoop): number => loop.cap ?? Math.max(m.run ? (m.run.most[loop.id] ?? -1) + 1 : 1, 1) + 2;

/**
 * A loop's brakes: every one in words, in the document's order, and where the ones that count rounds are on the way
 * up, in rounds: what the spiral draws and what is said under it. A brake with no place (a budget in minutes, a
 * person who is not asked by the round) is said to have none.
 */
export function brakes(loop: MLoop, top: number): { words: string[]; lid: number | null; asked: number[]; budget: number | null } {
  const lid = loop.cap;
  const every = loop.brakes.find((b) => b.kind === "human" && b.every !== null);
  // When a round ends the stops are looked at in the document's order and the first that fires wins: at the lid's
  // own round a person is asked only if their stop comes before the cap.
  const before = loop.brakes.findIndex((b) => b === every) < loop.brakes.findIndex((b) => b.kind === "max-iterations" && b.n === lid);
  const asked: number[] = [];
  if (every?.kind === "human" && every.every) for (let u = every.every; u <= top; u += every.every) if (lid === null || u < lid || (u === lid && before)) asked.push(u);
  const least = loop.dispatches !== null && loop.perRound ? loop.dispatches / loop.perRound : null;
  // Drawn only where it is within a round and a half of the top of the drawing, so that it can be read against it.
  const budget = least !== null && least <= top + 1.5 ? least : null;
  const words = loop.brakes.map((b) => {
    if (b.kind === "max-iterations") return `max iterations: ${b.n}${b.n === lid ? ` (the lid, over round ${b.n - 1})` : " (a looser cap: the lid stops the loop first)"}`;
    if (b.kind === "human") return b.every === null ? "human halt (no place on the way up)" : `a person is asked every ${b.every === 1 ? "round" : `${b.every} rounds`}${b !== every ? "" : asked.length ? ` (the amber ring${asked.length === 1 ? "" : "s"})` : " (not within the rounds drawn)"}`;
    if (b.measure !== "dispatches" || !loop.perRound) return `budget: ${b.limit} ${b.measure} (no place on the way up)`;
    const [full, more] = [Math.floor(b.limit / loop.perRound), b.limit % loop.perRound];
    return `budget: ${b.limit} dispatches, at most ${full} full round${full === 1 ? "" : "s"}${more ? ` and ${more} more` : ""}${b.limit !== loop.dispatches ? " (a looser budget)" : budget === null ? " (not drawn: above the rounds shown)" : " (the dashed ring, a reading)"}`;
  });
  if (lid === null) words.unshift("no lid: no cap on rounds");
  return { words, lid, asked, budget };
}

/** A bead's color: green for a pass, amber for a fail, gray for anything else a dispatch reported. */
const beadFill = (outcome: string | null): string => (outcome === "pass" ? "ok" : outcome === "fail" ? "bad" : "ink-3");

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
    if (brake.lid !== null) prims.push({ t: "poly", pts: circle(c, t.r + 18, brake.lid * H), fill: "brake", fa: 0.24, stroke: "brake", w: 1.8, lift: 300 });
    // At the lid's own round too, where the person's stop is looked at before the cap: a ring inside the lid.
    for (const u of brake.asked) prims.push({ t: "line", pts: circle(c, t.r + (u === brake.lid ? 9 : 18), u * H), stroke: "k-gate", w: 2.2, lift: 320 });
    if (brake.budget !== null) prims.push({ t: "line", pts: circle(c, t.r + 18, brake.budget * H), stroke: "brake", w: 1.2, dash: [4, 4], alpha: 0.85 });
    const over = Math.max(top, brake.budget ?? 0);
    // The loop's name over its spiral, and on a run's page the round the run is in there, or was last in. Its
    // brakes are said in words under the view (`graph-stage.tsx`), where they are not written over anything.
    const where = !m.run ? "" : run === null ? "\nnot entered" : `\nround ${Math.floor(run.now)}${loop.cap ? `, lid over round ${loop.cap - 1}` : ""}`;
    prims.push({ t: "text", at: [c[0], over * H + 46, c[2]], text: `${loop.name}${where}`, align: "center", up: true, fill: color, size: 11, bold: true, max: Math.max(120, 2 * t.r + 30) });
    stops.forEach((stop, i) => {
      if (stop.node) {
        const p = on(t, i / k, 46);
        at[stop.node] = [p[0], p[1] - 30, p[2]];
        prims.push(card(by(m.nodes, stop.node), at[stop.node]!), { t: "line", pts: [on(t, i / k), on(t, i / k, 30)], stroke: color, w: 1, alpha: 0.7 });
      } else if (stop.loop) prims.push({ t: "text", at: on(t, i / k, 34), text: `${stop.loop.name}: the spiral beside`, align: "center", fill: hue(m, stop.loop.id), size: 10.5, bold: true, max: 96 });
      // A node this loop shares with another, which stands on the other's spiral: said here, and drawn there once.
      else if (stop.away) prims.push({ t: "text", at: on(t, i / k, 34), text: `${by(m.nodes, stop.away).name}: on ${by(m.loops, by(m.nodes, stop.away).loop!).name}`, align: "center", fill: "ink-3", size: 10.5, max: 96 });
    });
    // A run's dispatches so far, each a bead where it happened: the round it was in, and how it ended. A loop that
    // started afresh has been at a place before: the later bead is set beside the earlier, toward the middle.
    const there: Record<string, number> = {};
    m.run?.dispatches.forEach((d, n) => {
      const i = stops.findIndex((stop) => stop.node === d.node);
      if (i < 0 || d.round === null || (shown.dispatches !== undefined && n >= shown.dispatches)) return;
      const before = (there[`${d.round}:${i}`] = (there[`${d.round}:${i}`] ?? -1) + 1);
      prims.push({ t: "dot", at: on(t, d.round + i / k, -13 * before), r: 6, fill: beadFill(d.outcome), stroke: "card" });
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
  // The edges. A template's are drawn as they are in round 0. A run's are drawn where the run took them, between
  // the rounds it took them, as far as the slider has come; one it never took is faint, at round 0. An edge that is
  // the spiral itself, from one station on to the next, is not drawn twice: it is shown when a step is about it.
  // Any other edge between two of a loop's nodes (a fan out, a fan in) is drawn.
  const drawn = new Set<string>();
  const line = (e: MEdge, r0: number, r1: number, more: Partial<Extract<Prim, { t: "line" }>> = {}): void => {
    const key = `edge:${e.id}@${r0}>${r1}`;
    if (drawn.has(key)) return;
    drawn.add(key);
    const loop = e.back ? undefined : round(e);
    const t = loop && tower[loop.id];
    const onward = !!t && t.stops.findIndex((stop) => stop.node === e.to) === t.stops.findIndex((stop) => stop.node === e.from) + 1;
    prims.push(edgeLine(m, e, path(e.id, r0, r1), { key, ...(onward && loop ? { hide: !shown.lit?.has(key), stroke: hue(m, loop.id), w: 3.2 } : {}), ...more }));
  };
  for (const e of m.edges) {
    const took = shown.took.filter((x) => x.edge === e.id && (shown.k === 0 || x.step <= shown.k));
    if (!m.run) line(e, 0, e.back ? 1 : 0);
    else if (took.length) for (const x of took) line(e, x.r0, x.r1);
    else if (!shown.took.some((x) => x.edge === e.id)) line(e, 0, e.back ? 1 : 0, { alpha: 0.3 });
  }
  // A note about an edge is not a move along it: the edge is lit wherever it is drawn already, as taken or as never
  // taken. One the run has not come to by then is drawn as a never-taken one is, faint at round 0, and lit.
  if (shown.about) {
    const e = by(m.edges, shown.about.edge);
    if (!prims.some((p) => p.key?.startsWith(`edge:${e.id}@`))) line(e, 0, e.back ? 1 : 0, { alpha: 0.3 });
    for (const p of prims) if (p.key?.startsWith(`edge:${e.id}@`)) ((p.hide = false), shown.lit?.add(p.key));
  }
  // All of this but the cards is grown once the cards have landed.
  for (const p of prims) if (p.t !== "card") p.grow = true;
  return { prims, node: spot, path };
};
