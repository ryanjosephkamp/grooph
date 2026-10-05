/**
 * Columns (handoff 0096; D4 of the studio): every node stands where the picture has it, on the ground, as a column
 * with its card at its foot, beside it.
 * On a template an agent's column is taller for a higher model tier: frontier over strong over fast. That is the
 * order of what the document asks for, not a price: a profile may give two tiers one model (graph-ir section 4).
 * An agent with no tier is a short, faint column, marked as the session's default; a check, a gate or a stop is a
 * slab. On a run's page a column is one block for each dispatch at its node so far, as tall as the minutes it took by
 * the stamps on the notes (the first from its own start, each after from the end of the dispatch before it: a lead
 * writes the stamps, and the time between two ends is what they hold), in the round it was in, green for a pass,
 * amber for a fail and gray for anything else.
 */
import type { Prim } from "./draw.js";
import type { Id, Model, V } from "./model.js";
import { card, edgeLine, hue, lerp, type Shown, type View } from "./shapes.js";

/** How tall an agent's column is on a template, by its tier; one with none is not said to be any of them. */
export const TIER: Record<string, number> = { frontier: 104, strong: 68, fast: 34, unset: 16 };
/** How the canvas's places are scaled onto the ground: by enough that the cards of two columns as tall as each
 *  other, side by side or one behind the other in the canvas's own layout, are clear from where the view starts. */
const [ACROSS, BACK] = [0.76, 0.94];
/** How tall a minute is. */
export const MINUTE = 7.5;

const minutes = (n: number): string => `${Math.round(n * 100) / 100} min`;

/**
 * A run's dispatches so far, node by node in the order of their first: each block of a column in words, from the
 * ground up, and the column's whole height. What is said under the view, where the blocks' own words would be
 * written over each other.
 */
export function blocks(m: Model, shown: Shown): { id: Id; name: string; words: string[]; total: number }[] {
  const out: { id: Id; name: string; words: string[]; total: number }[] = [];
  m.run?.dispatches.forEach((d, k) => {
    if (shown.dispatches !== undefined && k >= shown.dispatches) return;
    const at = out.find((x) => x.id === d.node) ?? out[out.push({ id: d.node, name: m.nodes.find((n) => n.id === d.node)!.name, words: [], total: 0 }) - 1]!;
    at.words.push(`${d.round === null ? "" : `round ${d.round}, `}${minutes(d.minutes)}${d.outcome === "pass" || !d.outcome ? "" : `, ${d.outcome}`}`);
    at.total += d.minutes;
  });
  return out;
}

export const columns: View = (m, shown) => {
  const prims: Prim[] = [];
  const foot: Record<Id, V> = {};
  const box = (c: V, wide: number, deep: number, y0: number, y1: number, fill: string, more: { key?: string; alpha?: number } = {}): void => {
    const [x0, x1, z0, z1] = [c[0] - wide / 2, c[0] + wide / 2, c[2] - deep / 2, c[2] + deep / 2];
    const side = (pts: V[], fa: number): void => void prims.push({ t: "poly", pts, fill, fa, stroke: "card", w: 0.8, ...more });
    side([[x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0]], 0.5);
    side([[x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0]], 0.62);
    side([[x1, y0, z0], [x1, y0, z1], [x1, y1, z1], [x1, y1, z0]], 0.62);
    side([[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]], 0.8);
    side([[x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1]], 1);
  };
  for (const n of m.nodes) {
    const c = (foot[n.id] = [n.at[0] * ACROSS, 0, n.at[1] * BACK]);
    let top = 5;
    if (m.run) {
      box(c, 66, 42, 0, 4, "floor");
      top = 4;
      m.run.dispatches.forEach((d, k) => {
        if (d.node !== n.id || (shown.dispatches !== undefined && k >= shown.dispatches)) return;
        const tall = Math.max(3, d.minutes * MINUTE);
        box(c, 58, 36, top, top + tall, d.outcome === "pass" ? "ok" : d.outcome === "fail" ? "bad" : "ink-3", { key: `node:${n.id}` });
        top += tall + 2;
      });
      // How long the column's dispatches took in all, at its top, to the left and clear of the cards. Block by
      // block it is said under the view.
      const all = blocks(m, shown).find((x) => x.id === n.id);
      if (all) prims.push({ t: "text", at: [c[0] - 33, top, c[2] + 18], text: minutes(all.total), align: "right", size: 10, fill: "ink-2" });
    } else if (n.tier) {
      top = TIER[n.tier] ?? TIER["unset"]!;
      box(c, 58, 36, 0, top, "k-agent", { key: `node:${n.id}`, ...(n.tier === "unset" ? { alpha: 0.4 } : {}) });
      prims.push({ t: "text", at: [c[0] - 33, top / 2, c[2] + 18], text: n.tier === "unset" ? "session default" : n.tier, align: "right", size: 10, fill: "ink-2" });
    } else box(c, 58, 36, 0, 5, "floor", { key: `node:${n.id}` });
    // Its card is at its foot, to the right: the column is seen beside it, and no card is lifted onto another's.
    prims.push(card(n, [c[0] + 29, 0, c[2] + 18], { stand: true, side: true }));
  }
  // A loop is the ground its nodes stand on, with its name at the corner.
  for (const loop of m.loops) {
    const pts = loop.members.map((id) => foot[id]!);
    const more = loop.inside ? 0 : 12;
    const [x0, x1, z0, z1] = [Math.min(...pts.map((p) => p[0])) - 48 - more, Math.max(...pts.map((p) => p[0])) + 48 + more, Math.min(...pts.map((p) => p[2])) - 38 - more, Math.max(...pts.map((p) => p[2])) + 38 + more];
    prims.push({ t: "poly", pts: [[x0, -1, z0], [x1, -1, z0], [x1, -1, z1], [x0, -1, z1]], fill: hue(m, loop.id), fa: 0.14, stroke: hue(m, loop.id), key: `loop:${loop.id}`, lift: -600 });
    prims.push({ t: "text", at: [x0 - 4, 0, z1], text: loop.name, align: "right", fill: hue(m, loop.id), size: 10.5, bold: true });
  }
  // The edges run on the ground, from foot to foot, at the columns' left; a way back bows out, as on the picture. On
  // a run's page an edge the run has not taken by the note the slider is at is faint.
  const paths: Record<Id, V[]> = {};
  const side = (id: Id): V => [foot[id]![0] - 42, 1, foot[id]![2]];
  const taken = (id: Id): boolean => shown.took.some((x) => x.edge === id && (shown.k === 0 || x.step <= shown.k));
  m.edges.forEach((e, k) => {
    const [p, q] = [side(e.from), side(e.to)];
    // A second edge between the same two nodes bows out past the first: neither lies under the other.
    const twin = m.edges.slice(0, k).filter((x) => (x.from === e.from && x.to === e.to) || (x.from === e.to && x.to === e.from)).length;
    const bow = (e.back ? 34 + Math.abs(p[2] - q[2]) * 0.16 : 0) + 18 * twin;
    paths[e.id] = bow ? Array.from({ length: 19 }, (_, n) => ((v: V): V => [v[0] - bow * 4 * (n / 18) * (1 - n / 18), v[1], v[2]])(lerp(p, q, n / 18))) : [p, q];
    prims.push(edgeLine(m, e, paths[e.id]!, m.run && !taken(e.id) ? { alpha: 0.3 } : {}));
  });
  for (const p of prims) if (p.t !== "card") p.grow = true;
  return { prims, node: side, path: (e) => paths[e]! };
};
