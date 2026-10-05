/**
 * The picture of a graph that has subgroophs (amendment A-018, docs/exports.md): each one a box.
 *
 * Closed, a subgrooph is one card in the column: its name, the template and version it came from, how many nodes it
 * holds and which brakes are among them, and the glyph of what is inside. An edge that crossed its boundary starts
 * or ends at the card; what is wholly inside is not drawn. Open, its nodes are the cards they always were, kept
 * together in the column under the box's name, inside a frame. A subgrooph inside an open one is a box in its turn.
 * A plain group, one with no `from`, is not drawn: it never was.
 *
 * Behind a door of its own, like an operation map's other views (`map-views.ts`): the web app fetches this file
 * only for a graph that has a subgrooph, and the file it starts from does not reach it. It imports types, and
 * `groups.ts`, which is on this side of the door too; the picture and its tools are handed in (`units-kit.ts`). In
 * Node there is no door: `index.ts` binds the kit, and `picture(doc)` there is this.
 */

import { contentsOf } from "../groups.js";
import type { Graph, Group, Id, Node } from "../types.js";
import type { Face, PictureView } from "./graph-picture.js";
import type { Color, Ink, PictureOptions } from "./svg.js";
import type { UnitsKit } from "./units-kit.js";

export type UnitsOptions = PictureOptions & {
  /** the subgroophs drawn open, by group id, or "all". One inside a closed one stays out of sight. */
  open?: readonly Id[] | "all";
};

const GLYPH = 34; // the most a glyph is tall on a closed card
const HEAD = 24; // room above an open subgrooph's first card, for its name
const FOOT = 10; // and below its last
const STEP = 4; // a frame stands this far outside the frame within it

/** The glyph's colors are the app's variables; in a picture they are the picture's, so a dark file is dark throughout. */
const GLYPH_INK: Record<string, Color> = {
  edge: "ink-2",
  "ink-3": "ink-3",
  ink: "ink",
  surface: "surface",
  "accent-soft": "accent-soft",
  "kind-agent": "accent",
  "kind-human-gate": "gate",
  "kind-check": "check",
  "kind-merge": "merge",
  warning: "warning",
  error: "error",
  "loop-0": "loop-0",
  "loop-1": "loop-1",
  "loop-2": "loop-2",
  "loop-3": "loop-3",
};

const n1 = (n: number): string => (Math.round(n * 10) / 10).toString();
const count = (n: number, one: string): string[] => (n === 0 ? [] : [`${n} ${one}${n === 1 ? "" : "s"}`]);

/** A graph's picture with its subgroophs as boxes; the plain picture when it has none. */
export function pictureWithUnits(kit: UnitsKit, doc: Graph, options: UnitsOptions = {}): string {
  const [picture, layerNodes, glyph, rect, text, truncate] = kit;
  const { open: asked, ...plain } = options;
  const units = (doc.groups ?? []).filter((group) => group.from !== undefined);
  if (units.length === 0) return picture(doc, plain);

  const inside = new Map<Id, Set<Id>>();
  const depth = new Map<Id, number>(units.map((unit) => [unit.id, 0]));
  for (const unit of units) {
    const contents = contentsOf(doc, unit.id)!;
    inside.set(unit.id, new Set(contents.nodes));
    for (const inner of contents.groups) if (depth.has(inner)) depth.set(inner, depth.get(inner)! + 1);
  }
  /** the subgroophs that hold a node, outermost first */
  const chain = (id: Id): Group[] => units.filter((unit) => inside.get(unit.id)!.has(id)).sort((a, b) => depth.get(a.id)! - depth.get(b.id)!);
  const isOpen = (unit: Group): boolean => asked === "all" || (asked ?? []).includes(unit.id);
  /** the card a node is drawn on: its own, or the outermost closed subgrooph that holds it */
  const stands = (id: Id): Id => chain(id).find((unit) => !isOpen(unit))?.id ?? id;
  const byId = new Map(units.map((unit) => [unit.id, unit]));

  // The graph as it is drawn: each closed subgrooph one node, the edges that cross its boundary led to that node,
  // and what is wholly inside it left out.
  const seen = new Set<Id>();
  const nodes: Node[] = [];
  for (const node of doc.nodes) {
    const id = stands(node.id);
    if (seen.has(id)) continue;
    seen.add(id);
    nodes.push(id === node.id ? node : { id, kind: "merge", name: byId.get(id)!.name, merges: [] });
  }
  const edges = doc.edges.flatMap((edge) => {
    const from = stands(edge.from);
    const to = stands(edge.to);
    return from === to && edge.from !== edge.to ? [] : [{ ...edge, from, to }];
  });
  const kept = new Set(edges.map((edge) => edge.id));
  const loops = doc.loops.flatMap((loop) => {
    const members = [...new Set(loop.members.map(stands))];
    return members.length === 1 && byId.has(members[0]!) ? [] : [{ ...loop, members, back: loop.back.filter((id) => kept.has(id)) }];
  });
  const { groups: _groups, layout: _layout, ...rest } = doc;
  const folded: Graph = { ...rest, nodes, edges, loops };

  // The column. Ranked with every subgrooph closed, so that each has one place; then each open one is replaced, in
  // that place, by its own nodes in their own order.
  const at = (id: Id, level: number): Id => chain(id)[level]?.id ?? id;
  const ranked = (ids: Id[], within: (id: Id) => boolean, level: number): Id[][] =>
    layerNodes({
      ...folded,
      nodes: [...new Set(ids.map((id) => at(id, level)))].map((id) => ({ id }) as Node),
      edges: doc.edges.filter((edge) => within(edge.from) && within(edge.to)).map((edge) => ({ ...edge, from: at(edge.from, level), to: at(edge.to, level) })),
      loops: doc.loops,
    });
  const all = doc.nodes.map((node) => node.id);
  const rows = ranked(all, () => true, 0);
  const opened: Group[] = [];
  const expand = (unit: Group, level: number): void => {
    const row = rows.findIndex((ids) => ids.includes(unit.id));
    if (row < 0 || !isOpen(unit)) return;
    const within = inside.get(unit.id)!;
    const held = all.filter((id) => within.has(id));
    const others = rows[row]!.filter((id) => id !== unit.id);
    rows.splice(row, 1, ...(others.length > 0 ? [others] : []), ...ranked(held, (id) => within.has(id), level + 1));
    opened.push(unit);
    for (const inner of new Set(held.map((id) => chain(id)[level + 1]).filter((u): u is Group => u !== undefined))) expand(inner, level + 1);
  };
  for (const outer of new Set(all.map((id) => chain(id)[0]).filter((u): u is Group => u !== undefined))) expand(outer, 0);

  /** the rows an open subgrooph's cards are in: the first and the last */
  const span = (unit: Group): [number, number] => {
    const cards = new Set([...inside.get(unit.id)!].map(stands));
    const held = rows.flatMap((row, r) => (row.some((id) => cards.has(id)) ? [r] : []));
    return [held[0]!, held[held.length - 1]!];
  };
  const gaps = rows.map(() => 0);
  for (const unit of opened) {
    const [first, last] = span(unit);
    gaps[first]! += HEAD;
    if (last + 1 < rows.length) gaps[last + 1]! += FOOT;
  }

  // A closed subgrooph's card: what it came from, what it holds, the brakes among that, and the glyph of it.
  const marks = new Map<Id, { svg: string; width: number; height: number }>();
  const faces = new Map<Id, Face>();
  for (const unit of units) {
    if (!seen.has(unit.id)) continue;
    const contents = contentsOf(doc, unit.id)!;
    const held = doc.nodes.filter((node) => inside.get(unit.id)!.has(node.id));
    const drawn = /^<svg[^>]*viewBox="([^"]+)" width="([\d.]+)" height="([\d.]+)"[^>]*>\s*<title>[^<]*<\/title>/.exec(
      glyph({ ...rest, nodes: held, edges: doc.edges.filter((edge) => contents.edges.includes(edge.id)), loops: doc.loops.filter((loop) => contents.loops.includes(loop.id)) }),
    );
    const scale = drawn ? Math.min(1, GLYPH / Number(drawn[3]), 200 / Number(drawn[2])) : 0;
    // The glyph's own frame, kept as a drawing inside this one: its box, and what its root said about lines.
    if (drawn) {
      marks.set(unit.id, {
        svg: `viewBox="${drawn[1]}" fill="none" stroke-linecap="round" stroke-linejoin="round">${drawn.input.slice(drawn[0].length).trim()}`,
        width: Number(drawn[2]) * scale,
        height: Number(drawn[3]) * scale,
      });
    }
    const irreversible = held.flatMap((node) => (node.kind === "agent" ? (node.irreversible ?? []) : []));
    faces.set(unit.id, {
      label: "Subgrooph",
      color: "ink-2",
      sub: [
        [unit.from!, ...count(held.length, "node"), ...count(held.filter((node) => node.kind === "human-gate").length, "human gate"), ...count(contents.loops.length, "loop")].join(" · "),
        ...(unit.description ? [unit.description] : []),
      ],
      extra: irreversible.length > 0 ? `irreversible inside: ${irreversible.join(", ")}` : "",
      room: drawn ? Number(drawn[3]) * scale + 6 : 0,
    });
  }

  const draw: PictureView["draw"] = (cards, x, width, ink: Ink) => {
    const under: string[] = [];
    const over: string[] = [];
    for (const [id, mark] of marks) {
      const card = cards.get(id);
      if (!card) continue;
      // A second card behind the first: this one holds more than it shows.
      under.push(rect(x + 4, card.y + 4, width, card.height, { fill: ink("surface-2"), stroke: ink("line-strong"), rx: 9 }));
      const colored = mark.svg.replace(/var\(--([a-z0-9-]+), #[0-9a-f]+\)/g, (_all, name: string) => ink(GLYPH_INK[name] ?? "ink-2"));
      over.push(`<svg x="${n1(x + 10)}" y="${n1(card.y + card.height - mark.height - 8)}" width="${n1(mark.width)}" height="${n1(mark.height)}" ${colored}`);
    }
    // An open subgrooph: a frame around its cards and its name above the first. One that holds another open one
    // stands a step further out and leaves that one's name its room. Outermost first, so the inner is drawn over.
    for (const unit of opened) {
      const [first, last] = span(unit);
      const within = opened.filter((other) => other !== unit && depth.get(other.id)! > depth.get(unit.id)! && [...inside.get(other.id)!].every((id) => inside.get(unit.id)!.has(id)));
      const out = 5 + STEP * Math.max(0, ...within.map((other) => depth.get(other.id)! - depth.get(unit.id)!));
      const top = Math.min(...rows[first]!.map((id) => cards.get(id)!.y)) - HEAD * (within.filter((other) => span(other)[0] === first).length + 1) + 4;
      const bottom = Math.max(...rows[last]!.map((id) => cards.get(id)!.y + cards.get(id)!.height)) + 4 + STEP * within.filter((other) => span(other)[1] === last).length;
      under.push(
        `<g data-group="${unit.id}" data-open="">` +
          rect(x - out, top, width + 2 * out, bottom - top, { stroke: ink("line-strong"), rx: 12, dash: "5 4" }) +
          // Its name on one side of the arrow that comes down the middle, and where it came from on the other.
          text(x - out + 8, top + 13, truncate(unit.name, width / 2 - 34, 9.5, "bold"), { size: 9.5, fill: ink("ink-3"), weight: "bold" }) +
          text(x + width + out - 8, top + 13, truncate(unit.from!, width / 2 - 34, 9.5), { size: 9.5, fill: ink("ink-3"), anchor: "end" }) +
          `</g>`,
      );
    }
    return [under.join(""), over.join("")];
  };

  return picture(folded, plain, { ranks: rows, gaps, faces, whole: doc, draw });
}
