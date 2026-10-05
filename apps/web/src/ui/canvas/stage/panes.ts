/**
 * Panes (handoff 0096; D3 of the studio): the picture as it is, with each loop and each box lifted toward the eye
 * on a pane of its own. A box is what the picture draws as one: a subgrooph. A group that was not placed from a
 * template is not drawn on the picture, and has no pane here; a node's card still says it is in it. Every node is
 * where the canvas has it, and as many panes forward as there are loops and boxes round it, one inside another. Face on it is the picture; turned, what is inside what, and which edges pass
 * from one pane to another: an edge that changes depth is entering or leaving a loop or a box.
 *
 * Two loops that share a node and are neither inside the other are two panes at the same depth, and the node is on
 * both: the panes show nesting, and that is not nesting.
 */
import type { Prim } from "./draw.js";
import type { Id, MGroup, MLoop, V } from "./model.js";
import { card, edgeLine, hue, lerp, type View } from "./shapes.js";

const STEP = 84;
/** How the canvas's places are scaled: across by enough that the cards of a row of the canvas's own layout (236 from
 *  one to the next, as many as four) are clear of each other from where the view starts, the far ones too, which
 *  stand closer for being far; and down by less. */
export const [ACROSS, DOWN] = [0.8, 0.4];

/** The boxes a node can be in, each with how many others are round it: a loop, a subgrooph. */
export function boxesOf(loops: MLoop[], groups: MGroup[]): { loop?: MLoop; group?: MGroup; name: string; sub: string; ids: Id[]; depth: number }[] {
  type Box = { loop?: MLoop; group?: MGroup; name: string; sub: string; ids: Id[]; depth: number };
  const boxes: Box[] = [...loops.map((loop) => ({ loop, name: loop.name, ids: loop.members, sub: "loop", depth: 0 })), ...groups.filter((group) => group.from).map((group) => ({ group, name: group.name, ids: group.nodes, sub: `subgrooph, from ${group.from}`, depth: 0 }))].filter((box) => box.ids.length > 0);
  // Up the document's own nesting: a loop inside a loop, a subgrooph inside one that holds it, through any group between.
  const up = <T extends { id: Id; inside: Id | null }>(list: T[], from: T, to: T): boolean => {
    for (let at = from.inside, n = 0; at && n <= list.length; at = list.find((x) => x.id === at)?.inside ?? null, n += 1) if (at === to.id) return true;
    return false;
  };
  const within = (inner: Box, outer: Box): boolean => inner.ids.every((id) => outer.ids.includes(id));
  // A loop is inside a group that has all of its nodes; a group inside a loop that has all of its nodes and more.
  const holds = (outer: Box, inner: Box): boolean =>
    outer !== inner && (outer.loop && inner.loop ? up(loops, inner.loop, outer.loop) : outer.group && inner.group ? up(groups, inner.group, outer.group) : outer.group ? within(inner, outer) : within(inner, outer) && outer.ids.length > inner.ids.length);
  for (const box of boxes) box.depth = boxes.filter((outer) => holds(outer, box)).length + 1;
  return boxes;
}

export const panes: View = (m) => {
  const prims: Prim[] = [];
  const at: Record<Id, V> = {};
  const boxes = boxesOf(m.loops, m.groups);
  const depth = (id: Id): number => Math.max(0, ...boxes.filter((box) => box.ids.includes(id)).map((box) => box.depth));
  for (const n of m.nodes) at[n.id] = [n.at[0] * ACROSS, -n.at[1] * DOWN, depth(n.id) * STEP];
  for (const n of m.nodes) prims.push(card(n, at[n.id]!, {}));
  const around = (ids: Id[], pad: number): [number, number, number, number] => {
    const pts = ids.map((id) => at[id]!);
    return [Math.min(...pts.map((p) => p[0])) - 58 - pad, Math.max(...pts.map((p) => p[0])) + 58 + pad, Math.min(...pts.map((p) => p[1])) - 22 - pad, Math.max(...pts.map((p) => p[1])) + 22 + pad];
  };
  // The picture's own plane, where the nodes in no loop and no box stay: what the panes are seen to be lifted from.
  const [gx0, gx1, gy0, gy1] = around(m.nodes.map((n) => n.id), 42);
  prims.push({ t: "poly", pts: [[gx0, gy0, -8], [gx1, gy0, -8], [gx1, gy1, -8], [gx0, gy1, -8]], fill: "floor", fa: 0.7, stroke: "line-strong", lift: -600 });
  prims.push({ t: "text", at: [gx0 + 4, gy1 + 10, -8], text: "the picture", fill: "ink-3", size: 10 });
  for (const box of boxes) {
    const [x0, x1, y0, y1] = around(box.ids, 8 + (4 - Math.min(4, box.depth)) * 9);
    const z = box.depth * STEP - 12;
    const color = box.loop ? hue(m, box.loop.id) : "ink-3";
    prims.push({ t: "poly", pts: [[x0, y0, z], [x1, y0, z], [x1, y1, z], [x0, y1, z]], fill: color, fa: box.loop ? 0.15 : 0.08, stroke: color, ...(box.loop ? { key: `loop:${box.loop.id}` } : { dash: [5, 4] }), w: 1.3, lift: box.depth * 30 - 80 });
    // A pane inside another says its name at its foot, clear of the outer one's.
    prims.push({ t: "text", at: [x0 + 4, box.depth % 2 ? y1 + 10 : y0 - 10, z], text: `${box.name} · ${box.sub}`, fill: color, size: 10.5, bold: true, max: 200 });
    // Its shadow on the picture: where the picture draws its outline.
    prims.push({ t: "line", pts: [[x0, y0, -8], [x1, y0, -8], [x1, y1, -8], [x0, y1, -8], [x0, y0, -8]], stroke: color, w: 1, dash: [2, 4], alpha: 0.6 });
  }
  const paths: Record<Id, V[]> = {};
  for (const e of m.edges) {
    const [p, q] = [at[e.from]!, at[e.to]!];
    // A way back bows out to the side, as it does on the flat picture.
    const bow = 70 + Math.abs(p[1] - q[1]) * 0.2;
    paths[e.id] = e.back ? Array.from({ length: 19 }, (_, n) => ((v: V): V => [v[0] + bow * 4 * (n / 18) * (1 - n / 18), v[1], v[2]])(lerp([p[0] + 50, p[1], p[2]], [q[0] + 50, q[1], q[2]], n / 18))) : [p, q];
    prims.push(edgeLine(m, e, paths[e.id]!, { inset: e.back ? [4, 8] : [20, 24] }));
  }
  return { prims, node: (id) => at[id]!, path: (e) => paths[e]! };
};
