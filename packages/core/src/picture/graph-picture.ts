/**
 * The picture of a graph: the whole of it with its words on it, laid out for
 * a phone, as one SVG. The glyph (`glyph.ts`) is the wordless shape for a
 * list row; the canvas is the place to edit; this is the picture to keep, to
 * send, and to read on a small screen without the app.
 *
 * One column, in rank order (`layerNodes`): every node is a card as wide as
 * the page allows, so its name and role are never cut to fit a grid. An edge
 * to the very next card is an arrow between the two. Every other forward edge
 * runs in the left margin, and every loop's back edge in the right, each on
 * its own track, so no line crosses a word. Nodes of one rank share a tinted
 * band: they are the same step, side by side in the graph, stacked here.
 * Below the cards, each loop with its bar and its stops in order: the brakes
 * are part of the picture.
 */

import { indexGraph } from "../graph-index.js";
import { layerNodes } from "../layout.js";
import { estimateShape, shapeLine } from "../proposals.js";
import { describeStop, loopMode, stopAction } from "../semantics.js";
import type { Edge, Graph, Id, Node } from "../types.js";
import { PICTURE_WIDTH, assignTracks, fmt, frame, inkFor, pill, rect, text, textWidth, truncate, wrap, type Color, type Ink, type PictureOptions } from "./svg.js";

const M = 12;
const CARD_PAD = 10;
const GAP = 30; // between cards: room for an arrow and its label
const TRACK = 13;
const TRACK_LEAD = 16;
const SLOT = 12;
const BAND = 6; // a rank's band, around its cards

const KIND: Record<Node["kind"], { label: string; color: Color }> = {
  agent: { label: "Agent", color: "accent" },
  "human-gate": { label: "Human gate", color: "gate" },
  check: { label: "Check", color: "check" },
  merge: { label: "Merge", color: "merge" },
  stop: { label: "Stop", color: "stop" },
};

/** The line under a node's name: what kind of thing it is, in the document's own words. */
function subline(node: Node): string {
  switch (node.kind) {
    case "agent": {
      const role = typeof node.role === "string" ? node.role : node.role.custom;
      return [role, node.model?.tier, node.effort].filter(Boolean).join(" · ");
    }
    case "human-gate":
      return node.options && node.options.length > 0 ? node.options.join(" / ") : node.prompt;
    case "check":
      return [node.check.kind, node.check.run].filter(Boolean).join(" · ");
    case "merge":
      return [node.strategy, node.merges.length > 0 ? `merges ${node.merges.join(", ")}` : undefined].filter(Boolean).join(" · ");
    case "stop":
      return node.outcome ?? "ends the run";
  }
}

/** What an edge is drawn saying: its condition, and that a person must approve it. */
function edgeLabel(edge: Edge): string {
  const when = edge.when ?? "always";
  const said = typeof when === "object" ? when.verdict : when === "always" ? (edge.label ?? "") : when;
  return [said, edge.approval ? "approval" : ""].filter((s) => s !== "").join(" · ");
}

function edgeStyle(edge: Edge, loop: number | undefined): { color: Color; dash?: string; width: number } {
  if (loop !== undefined) return { color: `loop-${loop % 4}` as Color, dash: "5 3", width: 1.6 };
  if (edge.approval) return { color: "gate", width: 2 };
  const when = edge.when ?? "always";
  if (when === "fail") return { color: "warning", dash: "5 3", width: 1.5 };
  if (typeof when === "object") return { color: "ink-3", dash: "1.5 3", width: 1.7 };
  return { color: "ink-2", width: 1.5 };
}

type Card = { node: Node; name: string[]; sub: string[]; extra: string; height: number; y: number; left: Id[]; right: Id[] };

/** A card that stands for more than a node, a closed subgrooph: what it says in place of a kind's label and line. */
export type Face = { label: string; color: Color; sub: string[]; extra: string; /** room kept at the card's foot */ room: number };

/**
 * What the picture is handed to draw subgroophs as boxes (`graph-units.ts`, fetched only for a graph that has one).
 * `doc` is then the graph with each closed subgrooph folded into one node. Without it nothing here is different:
 * the picture of a graph with no group is byte for byte what it was.
 */
export type PictureView = {
  /** the column and, for each row, room to leave above it: an open subgrooph's nodes are kept together, under its name */
  ranks: Id[][];
  gaps: number[];
  faces: ReadonlyMap<Id, Face>;
  /** the graph before folding: what the caption counts */
  whole: Graph;
  /** what goes under the cards and what goes over them, given where each card is */
  draw: (cards: ReadonlyMap<Id, { y: number; height: number }>, x: number, width: number, ink: Ink) => [under: string, over: string];
};

/**
 * A graph as one SVG with its words on it. Nodes carry `data-node`, edges
 * `data-edge` and loops `data-loop`, so a page holding the picture inline can
 * make them tappable. Edges and loops that point at nothing are left out: the
 * validator names them.
 */
export function picture(doc: Graph, options: PictureOptions = {}, view?: PictureView): string {
  const theme = options.theme ?? "auto";
  const W = options.width ?? PICTURE_WIDTH;
  const ink = inkFor(theme);
  const index = indexGraph(doc);
  const nodes = new Map<Id, Node>(doc.nodes.map((n) => [n.id, n]));

  // The column: rank by rank, and inside a rank the order that crosses least.
  const ranks = view?.ranks ?? layerNodes(doc);
  const column: Id[] = ranks.flat();
  const at = new Map<Id, number>(column.map((id, i) => [id, i]));
  const rankOf = new Map<Id, number>();
  ranks.forEach((row, r) => row.forEach((id) => rankOf.set(id, r)));

  const backLoop = new Map<Id, number>(); // back edge → the first loop it returns in
  doc.loops.forEach((loop, i) => {
    for (const id of loop.back) if (!backLoop.has(id)) backLoop.set(id, i);
  });
  const edges = doc.edges.filter((e) => nodes.has(e.from) && nodes.has(e.to));
  type Route = "next" | "left" | "right";
  const route = (e: Edge): Route => (backLoop.has(e.id) || e.from === e.to ? "right" : at.get(e.to) === at.get(e.from)! + 1 ? "next" : "left");

  // Each end of a margin edge takes a slot on its card's side: ends going up first, so the arcs leave without crossing.
  const sideSlots = (side: "left" | "right"): Map<Id, { edge: Id; end: "from" | "to" }[]> => {
    const slots = new Map<Id, { edge: Id; end: "from" | "to"; other: number; n: number }[]>();
    edges.forEach((e, n) => {
      if (route(e) !== side) return;
      (slots.get(e.from) ?? slots.set(e.from, []).get(e.from)!).push({ edge: e.id, end: "from", other: at.get(e.to)!, n });
      (slots.get(e.to) ?? slots.set(e.to, []).get(e.to)!).push({ edge: e.id, end: "to", other: at.get(e.from)!, n });
    });
    for (const [id, list] of slots) {
      const here = at.get(id)!;
      const zone = (s: { other: number }): number => (s.other < here ? 0 : s.other === here ? 1 : 2);
      list.sort((a, b) => zone(a) - zone(b) || (zone(a) === 0 ? b.other - a.other : a.other - b.other) || a.n - b.n || (a.end === "from" ? -1 : 1));
    }
    return slots;
  };
  const slots = { left: sideSlots("left"), right: sideSlots("right") };
  const slotIndex = (side: "left" | "right", id: Id, edge: Id, end: "from" | "to"): number => slots[side].get(id)!.findIndex((s) => s.edge === edge && s.end === end);
  const tracksFor = (side: "left" | "right") => {
    const list = edges.filter((e) => route(e) === side);
    const where = (id: Id, e: Edge, end: "from" | "to"): number => at.get(id)! * 1000 + slotIndex(side, id, e.id, end);
    const { tracks, count } = assignTracks(list.map((e) => ({ from: where(e.from, e, "from"), to: where(e.to, e, "to") })));
    return { list, tracks, margin: list.length === 0 ? 0 : TRACK_LEAD + (count - 1) * TRACK + 12 };
  };
  const left = tracksFor("left");
  const right = tracksFor("right");

  const banded = ranks.some((row) => row.length > 1);
  const cardX = M + left.margin + (banded ? BAND : 0);
  const cardW = W - 2 * M - left.margin - right.margin - (banded ? 2 * BAND : 0);
  const textW = cardW - 2 * CARD_PAD;
  const loopsOf = (id: Id): number[] => doc.loops.map((l, i) => (l.members.includes(id) ? i : -1)).filter((i) => i >= 0);

  const body: string[] = [];
  let y = M + 6;

  // Title, what the graph is at a glance, and its goal.
  for (const line of wrap(doc.name || doc.id, W - 2 * M, 17, 2, "bold")) {
    y += 17;
    body.push(text(M, y, line, { size: 17, fill: ink("ink"), weight: "bold" }));
    y += 4;
  }
  const caption = [doc.target?.harness, doc.nodes.length > 0 ? shapeLine(estimateShape(view?.whole ?? doc)) : "no nodes yet"].filter(Boolean).join(" · ");
  for (const line of wrap(caption, W - 2 * M, 11, 2)) {
    y += 13;
    body.push(text(M, y, line, { size: 11, fill: ink("ink-3") }));
  }
  if (doc.goal) {
    y += 5;
    for (const line of wrap(doc.goal, W - 2 * M, 11.5, 3)) {
      y += 14.5;
      body.push(text(M, y, line, { size: 11.5, fill: ink("ink-2") }));
    }
  }
  y += 14;

  // Measure the cards, then set them down the page.
  const cards = new Map<Id, Card>();
  for (const id of column) {
    const node = nodes.get(id)!;
    const name = wrap(node.name || node.id, textW, 13.5, 2, "bold");
    const face = view?.faces.get(id);
    const sub = face ? face.sub.flatMap((line) => wrap(line, textW, 10.5, 2)) : subline(node) ? wrap(subline(node), textW, 10.5, 2) : [];
    const extra = face ? face.extra : node.kind === "agent" && (node.irreversible ?? []).length > 0 ? `irreversible: ${node.irreversible!.join(", ")}` : "";
    const content = CARD_PAD + 10 + 4 + name.length * 15.5 + sub.length * 13 + (extra ? 14 : 0) + CARD_PAD - 3 + (face?.room ?? 0);
    const l = (slots.left.get(id) ?? []).map((s) => s.edge);
    const r = (slots.right.get(id) ?? []).map((s) => s.edge);
    cards.set(id, { node, name, sub, extra, height: Math.max(content, (Math.max(l.length, r.length) + 1) * SLOT + 2), y: 0, left: l, right: r });
  }
  const bands: string[] = [];
  ranks.forEach((row, r) => {
    y += view?.gaps[r] ?? 0;
    const top = y;
    row.forEach((id, i) => {
      const card = cards.get(id)!;
      card.y = y + (row.length > 1 && i === 0 ? 16 : 0);
      y = card.y + card.height + (i < row.length - 1 ? 8 : 0);
    });
    if (row.length > 1) {
      bands.push(
        rect(cardX - BAND, top - BAND + 2, cardW + 2 * BAND, y - top + 2 * BAND - 2, { fill: ink("surface-2"), stroke: ink("line"), rx: 12 }) +
          text(cardX + 2, top + 9, `${row.length} side by side`, { size: 9.5, fill: ink("ink-3"), weight: "bold" }),
      );
    }
    if (r < ranks.length - 1) y += GAP;
  });
  body.push(...bands);
  const drawn = view?.draw(cards, cardX, cardW, ink);
  if (drawn) body.push(drawn[0]);

  // Edges to the very next card: an arrow down the middle, or two side by side.
  const labels: string[] = [];
  const nextEdges = edges.filter((e) => route(e) === "next");
  for (const e of nextEdges) {
    const from = cards.get(e.from)!;
    const to = cards.get(e.to)!;
    const twins = nextEdges.filter((o) => o.from === e.from && o.to === e.to);
    const x = cardX + cardW / 2 + (twins.indexOf(e) - (twins.length - 1) / 2) * 64;
    const y1 = from.y + from.height;
    const y2 = to.y;
    const style = edgeStyle(e, undefined);
    const color = ink(style.color);
    body.push(
      `<g data-edge="${e.id}"><path d="M${fmt(x)},${fmt(y1)} V${fmt(y2 - 5.5)}" fill="none" stroke-width="${fmt(style.width)}" stroke-linecap="round"${style.dash ? ` stroke-dasharray="${style.dash}"` : ""} style="stroke:${color}"/>` +
        `<path d="M${fmt(x)},${fmt(y2 - 0.5)} l-3.6,-6.5 h7.2 z" style="fill:${color}"/></g>`,
    );
    const said = edgeLabel(e);
    if (said) {
      const w = textWidth(said, 9.5, "bold") + 10.5;
      labels.push(pill(x - w / 2, (y1 + y2) / 2 + 3.2, said, { size: 9.5, fill: ink("bg"), ink: color, stroke: color }).svg);
    }
  }

  // Edges in the margins: out of a card's side, along a track, into the other card's side.
  const drawMargin = (side: "left" | "right", set: { list: Edge[]; tracks: number[] }): void => {
    const sign = side === "right" ? 1 : -1;
    const edgeX = side === "right" ? cardX + cardW : cardX;
    const placed: { x: number; y: number; w: number }[] = [];
    const slotY = (id: Id, edge: Id, end: "from" | "to"): number => {
      const card = cards.get(id)!;
      const list = slots[side].get(id)!;
      return card.y + card.height / 2 + (slotIndex(side, id, edge, end) - (list.length - 1) / 2) * SLOT;
    };
    set.list.forEach((e, i) => {
      const style = edgeStyle(e, backLoop.get(e.id));
      const color = ink(style.color);
      const y1 = slotY(e.from, e.id, "from");
      const y2 = slotY(e.to, e.id, "to");
      const x = edgeX + sign * (TRACK_LEAD + set.tracks[i]! * TRACK);
      const r = Math.min(6, Math.abs(y2 - y1) / 2);
      const dir = y2 >= y1 ? 1 : -1;
      const d = `M${fmt(edgeX)},${fmt(y1)} H${fmt(x - sign * r)} Q${fmt(x)},${fmt(y1)} ${fmt(x)},${fmt(y1 + dir * r)} V${fmt(y2 - dir * r)} Q${fmt(x)},${fmt(y2)} ${fmt(x - sign * r)},${fmt(y2)} H${fmt(edgeX + sign * 5.5)}`;
      body.push(
        `<g data-edge="${e.id}"><path d="${d}" fill="none" stroke-width="${fmt(style.width)}" stroke-linecap="round"${style.dash ? ` stroke-dasharray="${style.dash}"` : ""} style="stroke:${color}"/>` +
          `<circle cx="${fmt(edgeX)}" cy="${fmt(y1)}" r="2.2" style="fill:${color}"/>` +
          `<path d="M${fmt(edgeX + sign * 0.5)},${fmt(y2)} l${fmt(sign * 6.5)},-3.6 v7.2 z" style="fill:${color}"/></g>`,
      );
      const said = edgeLabel(e);
      if (!said) return;
      // The label rides the upright, turned to read along it when it is longer than the track is wide.
      const w = textWidth(said, 9, "bold") + 9;
      const lo = Math.min(y1, y2) + w / 2 + 2;
      const hi = Math.max(y1, y2) - w / 2 - 2;
      const clear = (cy: number): boolean => placed.every((p) => Math.abs(p.x - x) > 14 || Math.abs(p.y - cy) > (p.w + w) / 2 + 2);
      let cy = (y1 + y2) / 2;
      for (let step = 1; !clear(cy) && step < 60; step++) {
        const tryAt = (y1 + y2) / 2 + (step % 2 === 1 ? 1 : -1) * Math.ceil(step / 2) * 7;
        if (tryAt >= lo && tryAt <= hi && clear(tryAt)) cy = tryAt;
      }
      placed.push({ x, y: cy, w });
      labels.push(
        `<g transform="rotate(-90 ${fmt(x)} ${fmt(cy)})">` +
          rect(x - w / 2, cy - 6.5, w, 13, { fill: ink("bg"), stroke: color, rx: 6.5 }) +
          text(x, cy + 3.2, said, { size: 9, fill: color, weight: "bold", anchor: "middle" }) +
          `</g>`,
      );
    });
  };
  drawMargin("left", left);
  drawMargin("right", right);

  // The cards, over the lines.
  for (const id of column) {
    const card = cards.get(id)!;
    const { node } = card;
    const kind = view?.faces.get(id) ?? KIND[node.kind];
    const g: string[] = [];
    const gate = node.kind === "human-gate";
    g.push(rect(cardX, card.y, cardW, card.height, { fill: ink("surface"), stroke: ink(gate ? "gate" : "line-strong"), rx: node.kind === "stop" ? 16 : 9, width: gate ? 1.8 : 1, mark: "card" }));
    let ty = card.y + CARD_PAD + 8;
    g.push(`<circle cx="${fmt(cardX + CARD_PAD + 3.5)}" cy="${fmt(ty - 3.4)}" r="3.5" style="fill:${ink(kind.color)}"/>`);
    g.push(text(cardX + CARD_PAD + 11, ty, kind.label, { size: 9.5, fill: ink(kind.color), weight: "bold" }));
    loopsOf(id).forEach((loop, k) => {
      g.push(`<circle cx="${fmt(cardX + cardW - CARD_PAD - 3.5 - k * 10)}" cy="${fmt(ty - 3.4)}" r="3.5" style="fill:${ink(`loop-${loop % 4}` as Color)}"/>`);
    });
    ty += 4;
    for (const line of card.name) {
      ty += 15.5;
      g.push(text(cardX + CARD_PAD, ty, line, { size: 13.5, fill: ink("ink"), weight: "bold" }));
    }
    for (const line of card.sub) {
      ty += 13;
      g.push(text(cardX + CARD_PAD, ty, line, { size: 10.5, fill: ink("ink-2") }));
    }
    if (card.extra) {
      ty += 14;
      g.push(text(cardX + CARD_PAD, ty, truncate(card.extra, textW, 10, "bold"), { size: 10, fill: ink("gate"), weight: "bold" }));
    }
    body.push(`<g data-${kind === KIND[node.kind] ? "node" : "group"}="${id}">${g.join("")}</g>`);
  }
  if (drawn) body.push(drawn[1]);
  body.push(...labels);
  y += 14;

  // The loops: what each compares against, and how it stops.
  if (doc.loops.length > 0) {
    y += 4;
    body.push(text(M, y + 11, doc.loops.length === 1 ? "Loop" : "Loops", { size: 12.5, fill: ink("ink"), weight: "bold" }));
    y += 20;
    const listX = M + 16;
    const listW = W - M - listX;
    const nameOf = (id: Id): string => nodes.get(id)?.name || id;
    doc.loops.forEach((loop, i) => {
      const color = ink(`loop-${i % 4}` as Color);
      const row: string[] = [];
      y += 12;
      row.push(`<circle cx="${fmt(M + 5)}" cy="${fmt(y - 4)}" r="4.5" style="fill:${color}"/>`);
      row.push(text(listX, y, truncate(loop.name || loop.id, listW, 12, "bold"), { size: 12, fill: ink("ink"), weight: "bold" }));
      const para = (content: string, lines: number, fill: Color = "ink-2"): void => {
        for (const line of wrap(content, listW, 11, lines)) {
          y += 13.5;
          row.push(text(listX, y, line, { size: 11, fill: ink(fill) }));
        }
      };
      para(`${loopMode(index, loop)} loop · ${loop.members.map(nameOf).join(", ")}`, 2, "ink-3");
      if (loop.bar) para(`Bar: ${loop.bar.name}. ${loop.bar.acceptance}`, 3);
      loop.stops.forEach((stop, k) => para(`${k + 1}. ${describeStop(stop)}: ${stopAction(stop).replace(/`/g, "")}`, 2));
      y += 12;
      body.push(`<g data-loop="${loop.id}">${row.join("")}</g>`);
    });
  }

  return frame(W, y + M - 6, doc.name || doc.id, theme, ink, body.join(""), "graph");
}
