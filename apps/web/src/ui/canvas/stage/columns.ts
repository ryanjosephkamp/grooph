/**
 * Columns (handoff 0096; D4 of the studio): every node stands where the picture has it, on the ground, as a column
 * with its card at its foot, beside it.
 * On a template an agent's column is taller for a higher model tier: frontier over strong over fast. That is the
 * order of what the document asks for, not a price: a profile may give two tiers one model (graph-ir section 4).
 * An agent with no tier is a short, faint column, marked as the session's default; a check, a gate or a stop is a
 * slab. On a run's page a column is one block for each dispatch at its node so far, as tall as the minutes it took by
 * its own stamps, from its start to its end, green for a pass, amber for a fail and gray for anything else. A
 * dispatch whose stamps do not say how long it took is a faint slab with no height of its own, and is said to have
 * no time: none is made up. Blocks stand one on another with nothing between, and one is never thinner than a
 * line, so that two columns' heights compare their minutes.
 *
 * The edges run on the ground from column to column, each from the edge of its column's foot that faces the
 * other: to the side of the line between two nodes for a way back or a second edge between them (to the left of
 * one that runs back from the reader, toward the reader of one that runs across), and round any other column that
 * line would run through.
 */
import type { Prim } from "./draw.js";
import type { Id, Model, V } from "./model.js";
import type { Shown, View } from "./shapes.js";

/** What this view is drawn with, of the stage's own: handed to it, since it is a piece apart from the stage's and a
 *  thing both imported would be a third file for a browser to fetch. */
export type Tools = Pick<typeof import("./shapes.js"), "card" | "edgeLine" | "hue" | "lerp">;

/** How tall an agent's column is on a template, by its tier; one with none is not said to be any of them. */
export const TIER: Record<string, number> = { frontier: 104, strong: 68, fast: 34, unset: 16 };
/** How the canvas's places are scaled onto the ground: by enough that the cards of two columns as tall as each
 *  other, side by side or one behind the other in the canvas's own layout, are clear from where the view starts. */
const [ACROSS, BACK] = [0.76, 0.94];
/** How tall a minute is. */
export const MINUTE = 7.5;

/** To a tenth of a minute: the stamps are a lead's, some to the second and some to the minute. */
const minutes = (n: number): string => `${Math.round(n * 10) / 10} min`;

/**
 * A run's dispatches so far, node by node in the order of their first: each block of a column in words, from the
 * ground up, and the column's whole height. What is said under the view, where the blocks' own words would be
 * written over each other.
 */
export function blocks(m: Model, shown: Shown): { id: Id; name: string; words: string[]; total: string }[] {
  const out: { id: Id; name: string; words: string[]; total: string; sum: number; some: boolean; more: boolean }[] = [];
  m.run?.dispatches.forEach((d, k) => {
    if (shown.dispatches !== undefined && k >= shown.dispatches) return;
    const at = out.find((x) => x.id === d.node) ?? out[out.push({ id: d.node, name: m.nodes.find((n) => n.id === d.node)!.name, words: [], total: "", sum: 0, some: false, more: false }) - 1]!;
    // A round is its loop's: a node in a loop inside another is in a round of each.
    at.words.push(`${d.round === null ? "" : `${m.loops.find((l) => l.id === d.loop)?.name ?? ""} round ${d.round}, `}${d.minutes === null ? "no time" : minutes(d.minutes)}${d.outcome === "pass" || !d.outcome ? "" : `, ${d.outcome}`}`);
    // The column's minutes in all: those its stamps hold, each as it is said (so the list adds up to it), and said
    // to be more where a dispatch has none.
    at.sum += Math.round((d.minutes ?? 0) * 10) / 10;
    at.some ||= d.minutes !== null;
    at.more ||= d.minutes === null;
    at.total = at.more ? (at.some ? `${minutes(at.sum)} and more` : "no time") : minutes(at.sum);
  });
  return out;
}

export const columns = ({ card, edgeLine, hue, lerp }: Tools): View => (m, shown) => {
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
        const tall = Math.max(1, (d.minutes ?? 0) * MINUTE);
        box(c, 58, 36, top, top + tall, d.outcome === "pass" ? "ok" : d.outcome === "fail" ? "bad" : "ink-3", { key: `node:${n.id}`, ...(d.minutes === null ? { alpha: 0.4 } : {}) });
        top += tall;
      });
      // How long the column's dispatches took in all, at its top, to the left and clear of the cards. Block by
      // block it is said under the view.
      const all = blocks(m, shown).find((x) => x.id === n.id);
      if (all) prims.push({ t: "text", at: [c[0] - 33, top, c[2] + 18], text: all.total, align: "right", size: 10, fill: "ink-2", or: [{ at: [c[0], top + 12, c[2]], align: "center" }] });
    } else if (n.tier) {
      top = TIER[n.tier] ?? TIER["unset"]!;
      box(c, 58, 36, 0, top, "k-agent", { key: `node:${n.id}`, ...(n.tier === "unset" ? { alpha: 0.4 } : {}) });
      // Its tier in a word, at its left; or over its top, where another node's card is over that.
      prims.push({ t: "text", at: [c[0] - 33, top / 2, c[2] + 18], text: n.tier === "unset" ? "session default" : n.tier, align: "right", size: 10, fill: "ink-2", or: [{ at: [c[0], top + 12, c[2]], align: "center" }] });
    } else box(c, 58, 36, 0, 5, "floor", { key: `node:${n.id}` });
    // Its card is at its foot, to the right: the column is seen beside it, and no card is lifted onto another's.
    // (In a frame a phone's width it is its name alone, as in the other kinds: whole, it covers the ground to the
    // next column, and the edges on it.)
    prims.push(card(n, [c[0] + 29, 0, c[2] + 18], { stand: true, side: true, small: m.narrow }));
  }
  // A loop is the ground its nodes stand on, with its name at the corner.
  for (const loop of m.loops) {
    const pts = loop.members.map((id) => foot[id]!);
    const more = loop.inside ? 0 : 12;
    const [x0, x1, z0, z1] = [Math.min(...pts.map((p) => p[0])) - 48 - more, Math.max(...pts.map((p) => p[0])) + 48 + more, Math.min(...pts.map((p) => p[2])) - 38 - more, Math.max(...pts.map((p) => p[2])) + 38 + more];
    prims.push({ t: "poly", pts: [[x0, -1, z0], [x1, -1, z0], [x1, -1, z1], [x0, -1, z1]], fill: hue(m, loop.id), fa: 0.14, stroke: hue(m, loop.id), key: `loop:${loop.id}`, lift: -600 });
    // (Or at the near right corner, where a card or a tier's word is over the left one.)
    prims.push({ t: "text", at: [x0 - 4, 0, z1], text: loop.name, align: "right", fill: hue(m, loop.id), size: 10.5, bold: true, or: [{ at: [x1 + 4, 0, z1] }] });
  }
  // The edges run on the ground from column to column: each from the edge of its column's foot that faces the
  // other, so that none runs through its own. A way back bows out to the side of the line, and a second edge
  // between the same two nodes past the first: to the left of a line that runs back from the reader, toward the
  // reader of one that runs across. And an edge goes that way round any other column its straight line would run
  // through, by enough to be clear of it where it stands. On a run's page an edge the run has not taken by the
  // note the slider is at is faint.
  const paths: Record<Id, V[]> = {};
  const from = (a: V, b: V): V => {
    const [dx, dz] = [b[0] - a[0], b[2] - a[2]];
    const part = dx || dz ? Math.min(0.5, 35 / Math.abs(dx || 1e-9), 24 / Math.abs(dz || 1e-9)) : 0;
    return dx || dz ? [a[0] + dx * part, 1, a[2] + dz * part] : [a[0] - 35, 1, a[2]];
  };
  const taken = (id: Id): boolean => shown.took.some((x) => x.edge === id && (shown.k === 0 || x.step <= shown.k));
  m.edges.forEach((e, k) => {
    const [p, q] = [from(foot[e.from]!, foot[e.to]!), from(foot[e.to]!, foot[e.from]!)];
    const twin = m.edges.slice(0, k).filter((x) => (x.from === e.from && x.to === e.to) || (x.from === e.to && x.to === e.from)).length;
    const far = Math.hypot(q[0] - p[0], q[2] - p[2]);
    // The side: across the line, to the left; toward the reader where the line runs straight across; and to the
    // left for a node's own edge, which has no line.
    const [nx, nz] = far ? ((x: number, z: number): [number, number] => (x > 0 || (!x && z < 0) ? [-x, -z] : [x, z]))((p[2] - q[2]) / far, (q[0] - p[0]) / far) : [-1, 0];
    let bow = (e.back || !far ? 34 + far * 0.16 : 0) + 18 * twin;
    // (Three times over: going round one column can bring the edge to another.)
    for (const n of far ? [...m.nodes, ...m.nodes, ...m.nodes] : []) {
      if (n.id === e.from || n.id === e.to) continue;
      // How far along the line the column is, how far off it toward the side the edge goes to, and how far the
      // edge is out there as it stands.
      const [wx, wz] = [foot[n.id]![0] - p[0], foot[n.id]![2] - p[2]];
      const t = (wx * (q[0] - p[0]) + wz * (q[2] - p[2])) / (far * far);
      const off = wx * nx + wz * nz;
      if (t > 0.06 && t < 0.94 && Math.abs(off - bow * 4 * t * (1 - t)) < 44) bow = Math.max(bow, (44 + off) / Math.max(0.36, 4 * t * (1 - t)));
    }
    paths[e.id] = bow ? Array.from({ length: 19 }, (_, n) => ((v: V): V => [v[0] + nx * bow * 4 * (n / 18) * (1 - n / 18), v[1], v[2] + nz * bow * 4 * (n / 18) * (1 - n / 18)])(lerp(p, q, n / 18))) : [p, q];
    prims.push(edgeLine(m, e, paths[e.id]!, m.run && !taken(e.id) ? { alpha: 0.3 } : {}));
  });
  for (const p of prims) if (p.t !== "card") p.grow = true;
  return { prims, node: (id) => foot[id]!, path: (e) => paths[e]! };
};
