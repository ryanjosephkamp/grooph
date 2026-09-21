/**
 * The glyph (slice 0015): a small SVG of a graph's shape with no words, so a
 * list row, a compare card, a write-up and the command line all draw the same
 * picture. Pure and deterministic: the same document gives byte-identical SVG.
 *
 * The vocabulary, using the distinctions the canvas already makes:
 *
 *   node                       shape
 *   agent, writer family       square            (builder, synthesizer, planner; a custom role with `owns`)
 *   agent, critic family       diamond           (critic, judge, red-team)
 *   agent, any other role      rounded square    (lead, tester, researcher, custom)
 *   check                      hexagon
 *   human gate                 octagon, drawn heavier in the gate colour
 *   merge                      circle
 *   stop                       filled dot        (a `halt` outcome in the warning colour)
 *   irreversible               a bar under the node
 *
 *   edge `when`                line
 *   always, pass               solid
 *   fail                       dashed, warning colour
 *   { verdict }                dotted, muted
 *   approval                   doubled, in the gate colour
 *   a loop's back edge         drawn returning, in a lane below (or beside) the nodes it spans
 *   a loop                     a dashed hull around its members, in the loop's colour
 *
 * Layout: the document's own `layout` when it has one (scaled to glyph size),
 * otherwise `layerNodes` laid out left to right, one column per rank, so an
 * entry reads at the left and a stop at the right, as the sketch in the
 * roadmap brief has it. Colours are CSS variables with the app's light-theme
 * values as fallbacks, so the glyph reads inline in either theme and on its
 * own as a file. A `<title>` carries the graph name for accessibility only.
 */

import { layerNodes, resolvePositions } from "./layout.js";
import { isCriticFamily, isWriterFamily } from "./semantics.js";
import type { Edge, Graph, Id, Loop, Node } from "./types.js";

export type GlyphOptions = {
  /** The `width` and `height` attributes as a multiple of the drawing's own size; the viewBox is unchanged. Default 1. */
  scale?: number;
};

// ─── the drawing language ─────────────────────────────────────────────────

type Shape = "square" | "rounded" | "diamond" | "hexagon" | "octagon" | "circle" | "dot";

const RANK_STEP = 60; // between rank columns
const ORDER_STEP = 44; // between nodes in one rank
const MIN_GAP = 40; // nearest two centres of a document's own layout, once scaled
const MAX_SIDE = 400; // a sprawling layout is scaled down to fit this
const MARGIN = 4;
const LANE_BASE = 14; // first back-edge lane, below the nodes it spans
const LANE_STEP = 8;
const HULL_PAD = 8;
const HULL_NEST = 6; // extra padding per loop nested inside

const COLOUR = {
  edge: "var(--edge, #5c6663)",
  muted: "var(--ink-3, #6b7370)",
  ink: "var(--ink, #2b302e)",
  surface: "var(--surface, #ffffff)",
  agentFill: "var(--accent-soft, #e3efe9)",
  agent: "var(--kind-agent, #1f5f4a)",
  gate: "var(--kind-human-gate, #b25e09)",
  check: "var(--kind-check, #2b5f9e)",
  merge: "var(--kind-merge, #6b4fa0)",
  warning: "var(--warning, #955500)",
  error: "var(--error, #b42318)",
  loops: ["var(--loop-0, #7a4cc2)", "var(--loop-1, #0f7c8c)", "var(--loop-2, #c2410c)", "var(--loop-3, #b5306e)"],
} as const;

const shapeOf = (node: Node): Shape => {
  switch (node.kind) {
    case "agent":
      return isCriticFamily(node) ? "diamond" : isWriterFamily(node) ? "square" : "rounded";
    case "check":
      return "hexagon";
    case "human-gate":
      return "octagon";
    case "merge":
      return "circle";
    case "stop":
      return "dot";
  }
};

/** How far from the centre the shape's border lies in the direction (dx, dy); an approximation for the round ones. */
function reach(shape: Shape, dx: number, dy: number): number {
  const len = Math.hypot(dx, dy) || 1;
  const c = Math.abs(dx / len);
  const s = Math.abs(dy / len);
  switch (shape) {
    case "square":
    case "rounded":
      return Math.min(11 / Math.max(c, s), 11 * Math.SQRT2 - 1);
    case "diamond":
      return 14 / (c + s);
    case "hexagon":
    case "octagon":
      return 13;
    case "circle":
      return 11;
    case "dot":
      return 6;
  }
}

/** The extent a shape needs around its centre, bar included. */
const extent = (shape: Shape, bar: boolean): { x: number; top: number; bottom: number } => {
  const x = shape === "diamond" || shape === "hexagon" ? 14 : shape === "dot" ? 6 : shape === "octagon" ? 13 : 11;
  const y = shape === "diamond" ? 14 : shape === "dot" ? 6 : shape === "octagon" ? 13 : shape === "hexagon" ? 12 : 11;
  return { x: bar ? Math.max(x, 13) : x, top: y, bottom: bar ? 19 : y };
};

// ─── geometry helpers ─────────────────────────────────────────────────────

type Pt = { x: number; y: number };

/** One decimal, no trailing zero, no negative zero: small files that diff quietly. */
const fmt = (n: number): string => {
  const r = Math.round(n * 10) / 10;
  return (Object.is(r, -0) ? 0 : r).toString();
};
const pt = (p: Pt): string => `${fmt(p.x)},${fmt(p.y)}`;

const escape = (text: string): string => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

type Bounds = { minX: number; minY: number; maxX: number; maxY: number };
const bounds = (): Bounds => ({ minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity });
const grow = (b: Bounds, x: number, y: number, pad = 0): void => {
  b.minX = Math.min(b.minX, x - pad);
  b.minY = Math.min(b.minY, y - pad);
  b.maxX = Math.max(b.maxX, x + pad);
  b.maxY = Math.max(b.maxY, y + pad);
};

// ─── placement ────────────────────────────────────────────────────────────

type Placed = { centres: Record<Id, Pt>; vertical: boolean };

/** Node centres: from the document's layout, scaled to glyph spacing, or from the layered layout, left to right. */
function place(doc: Graph): Placed {
  const centres: Record<Id, Pt> = {};
  const hasLayout = doc.layout !== undefined && doc.nodes.some((n) => n.id in doc.layout!);
  if (!hasLayout) {
    const rows = layerNodes(doc);
    const tallest = Math.max(1, ...rows.map((row) => row.length));
    const mid = ((tallest - 1) * ORDER_STEP) / 2;
    rows.forEach((row, rank) => {
      const offset = mid - ((row.length - 1) * ORDER_STEP) / 2;
      row.forEach((id, i) => {
        centres[id] = { x: rank * RANK_STEP, y: offset + i * ORDER_STEP };
      });
    });
    return { centres, vertical: false };
  }

  // The document's own layout: box centres, then the nearest pair MIN_GAP apart, capped at MAX_SIDE across.
  const { positions } = resolvePositions(doc);
  const raw: Record<Id, Pt> = {};
  for (const node of doc.nodes) {
    const p = positions[node.id]!;
    const box = doc.layout![node.id];
    raw[node.id] = { x: p.x + (box?.w ?? 200) / 2, y: p.y + (box?.h ?? 84) / 2 };
  }
  const ids = doc.nodes.map((n) => n.id);
  let nearest = Infinity;
  for (let i = 0; i < ids.length; i++) {
    for (let j = i + 1; j < ids.length; j++) {
      const d = Math.hypot(raw[ids[i]!]!.x - raw[ids[j]!]!.x, raw[ids[i]!]!.y - raw[ids[j]!]!.y);
      if (d > 0) nearest = Math.min(nearest, d);
    }
  }
  const b = bounds();
  for (const id of ids) grow(b, raw[id]!.x, raw[id]!.y);
  const spanX = b.maxX - b.minX;
  const spanY = b.maxY - b.minY;
  let scale = nearest === Infinity ? 1 : MIN_GAP / nearest;
  if (spanX * scale > MAX_SIDE) scale = MAX_SIDE / spanX;
  if (spanY * scale > MAX_SIDE) scale = MAX_SIDE / spanY;
  for (const id of ids) centres[id] = { x: (raw[id]!.x - b.minX) * scale, y: (raw[id]!.y - b.minY) * scale };
  return { centres, vertical: spanY > spanX };
}

// ─── the glyph ────────────────────────────────────────────────────────────

/**
 * The glyph of a graph as an SVG string with no words (the graph's name is in
 * a `<title>` for screen readers). Deterministic: the same document gives the
 * same bytes. Nodes and edges that point at nothing are left out; a document
 * with no nodes gives an empty frame.
 */
export function glyph(doc: Graph, options: GlyphOptions = {}): string {
  const scale = options.scale ?? 1;
  const nodes = new Map<Id, Node>(doc.nodes.map((n) => [n.id, n]));
  const shapes = new Map<Id, Shape>(doc.nodes.map((n) => [n.id, shapeOf(n)]));
  const barred = new Set<Id>(doc.nodes.filter((n) => n.kind === "agent" && (n.irreversible ?? []).length > 0).map((n) => n.id));
  const { centres, vertical } = place(doc);
  const edges = doc.edges.filter((e) => nodes.has(e.from) && nodes.has(e.to));
  const backOf = new Map<Id, number>(); // back edge → the loop it returns in (first, in document order)
  doc.loops.forEach((loop, i) => {
    for (const id of loop.back) if (!backOf.has(id)) backOf.set(id, i);
  });

  const box = bounds();
  const body: string[] = [];

  // The sweep for a back edge: below the row it spans, or beside it when the layout is portrait.
  const along = (p: Pt): number => (vertical ? p.y : p.x); // the axis the graph runs along
  const across = (p: Pt): number => (vertical ? p.x : p.y); // the axis the lanes are offset on
  const make = (a: number, c: number): Pt => (vertical ? { x: c, y: a } : { x: a, y: c });
  const outer = (id: Id): number => {
    // The far side of a node on the lane axis: its bottom, or its right edge in a portrait layout.
    const e = extent(shapes.get(id)!, barred.has(id));
    return across(centres[id]!) + (vertical ? e.x : e.bottom);
  };

  // Lanes: the back edges of small loops first, then by the span they cross, then document order.
  const lanes = new Map<Id, number>();
  const loopSize = (edgeId: Id): number => Math.min(...doc.loops.filter((l) => l.back.includes(edgeId)).map((l) => l.members.length));
  const span = (e: Edge): number => Math.abs(along(centres[e.from]!) - along(centres[e.to]!));
  edges
    .filter((e) => backOf.has(e.id))
    .map((e, i) => ({ e, i }))
    .sort((p, q) => loopSize(p.e.id) - loopSize(q.e.id) || span(p.e) - span(q.e) || p.i - q.i)
    .forEach(({ e }, lane) => lanes.set(e.id, lane));
  // Returns that leave or reach one node are spread along it, so two arrowheads never sit on one spot.
  const spread = (e: Edge, end: "from" | "to"): number => {
    const at = e[end];
    const sharing = edges.filter((o) => backOf.has(o.id) && o.from !== o.to && o[end] === at).sort((p, q) => lanes.get(p.id)! - lanes.get(q.id)!);
    const k = sharing.findIndex((o) => o.id === e.id);
    return (k - (sharing.length - 1) / 2) * 6;
  };

  /** The lane axis value a back edge's return runs at: below every node it passes over. */
  const laneAt = (e: Edge): number => {
    const lo = Math.min(along(centres[e.from]!), along(centres[e.to]!));
    const hi = Math.max(along(centres[e.from]!), along(centres[e.to]!));
    let base = -Infinity;
    for (const id of nodes.keys()) if (along(centres[id]!) >= lo - 1 && along(centres[id]!) <= hi + 1) base = Math.max(base, outer(id));
    return base + LANE_BASE + lanes.get(e.id)! * LANE_STEP;
  };

  // Loops: a dashed hull around the members, deep enough to hold the loop's own returns. Outer loops first, so inner hulls draw on top.
  const memberSets = doc.loops.map((l) => new Set(l.members.filter((m) => nodes.has(m))));
  const nested = (outerLoop: number, inner: number): boolean =>
    outerLoop !== inner && memberSets[inner]!.size > 0 && memberSets[inner]!.size < memberSets[outerLoop]!.size && [...memberSets[inner]!].every((m) => memberSets[outerLoop]!.has(m));
  const hulls = doc.loops
    .map((loop, i) => ({ loop, i, inside: doc.loops.filter((_, j) => nested(i, j)).length }))
    .filter(({ i }) => memberSets[i]!.size > 0)
    .sort((p, q) => q.inside - p.inside || p.i - q.i);
  for (const { loop, i, inside } of hulls) {
    const pad = HULL_PAD + inside * HULL_NEST;
    const h = bounds();
    for (const id of memberSets[i]!) {
      const c = centres[id]!;
      const e = extent(shapes.get(id)!, barred.has(id));
      grow(h, c.x - e.x, c.y - e.top);
      grow(h, c.x + e.x, c.y + e.bottom);
    }
    for (const e of edges) {
      if (!loop.back.includes(e.id) || !lanes.has(e.id)) continue;
      const lane = laneAt(e);
      if (vertical) h.maxX = Math.max(h.maxX, lane);
      else h.maxY = Math.max(h.maxY, lane);
    }
    const x = h.minX - pad;
    const y = h.minY - pad;
    const w = h.maxX - h.minX + 2 * pad;
    const ht = h.maxY - h.minY + 2 * pad;
    grow(box, x, y);
    grow(box, x + w, y + ht);
    body.push(
      `<rect x="${fmt(x)}" y="${fmt(y)}" width="${fmt(w)}" height="${fmt(ht)}" rx="10" stroke-width="1.3" stroke-dasharray="4 3" style="stroke:${COLOUR.loops[i % 4]}"/>`,
    );
  }

  // Edges. Parallel forward edges between one pair are spread a little so both show.
  const pairs = new Map<string, Id[]>();
  for (const e of edges) {
    if (backOf.has(e.id)) continue;
    const key = [e.from, e.to].sort().join(" ");
    pairs.set(key, [...(pairs.get(key) ?? []), e.id]);
  }
  for (const e of edges) {
    const when = e.when ?? "always";
    const colour = e.approval ? COLOUR.gate : when === "fail" ? COLOUR.warning : typeof when === "object" ? COLOUR.muted : COLOUR.edge;
    const dash = when === "fail" ? ' stroke-dasharray="5 3"' : typeof when === "object" ? ' stroke-dasharray="1.5 3.5"' : "";
    const a = centres[e.from]!;
    const b = centres[e.to]!;
    let path: string;
    let tip: Pt;
    let dir: Pt;
    let offset: Pt = { x: 0, y: 0 };

    if (backOf.has(e.id) && e.from !== e.to) {
      // Returning: out of the far side, along the lane, back in from the far side.
      const lane = laneAt(e);
      const ea = extent(shapes.get(e.from)!, barred.has(e.from));
      const eb = extent(shapes.get(e.to)!, barred.has(e.to));
      const from = along(a) + spread(e, "from");
      const to = along(b) + spread(e, "to");
      const start = make(from, across(a) + (vertical ? ea.x : ea.bottom) + 1);
      const end = make(to, across(b) + (vertical ? eb.x : eb.bottom) + 3);
      const c1 = make(from, lane);
      const c2 = make(to, lane);
      path = `M${pt(start)} C${pt(c1)} ${pt(c2)} ${pt(end)}`;
      grow(box, c1.x, c1.y, 1);
      grow(box, c2.x, c2.y, 1);
      tip = end;
      dir = vertical ? { x: -1, y: 0 } : { x: 0, y: -1 };
    } else if (e.from === e.to) {
      // A node's edge to itself: a small loop off its far side.
      const ea = extent(shapes.get(e.from)!, barred.has(e.from));
      const far = across(a) + (vertical ? ea.x : ea.bottom);
      const start = make(along(a) + 5, far + 1);
      const end = make(along(a) - 5, far + 3);
      const c1 = make(along(a) + 18, far + 20);
      const c2 = make(along(a) - 18, far + 20);
      path = `M${pt(start)} C${pt(c1)} ${pt(c2)} ${pt(end)}`;
      grow(box, c1.x, c1.y, 1);
      grow(box, c2.x, c2.y, 1);
      tip = end;
      dir = vertical ? { x: -1, y: 0 } : { x: 0, y: -1 };
    } else {
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const len = Math.hypot(dx, dy) || 1;
      const ux = dx / len;
      const uy = dy / len;
      const siblings = pairs.get([e.from, e.to].sort().join(" ")) ?? [e.id];
      if (siblings.length > 1) {
        const k = siblings.indexOf(e.id) - (siblings.length - 1) / 2;
        offset = { x: -uy * k * 5, y: ux * k * 5 };
      }
      const start = { x: a.x + ux * (reach(shapes.get(e.from)!, dx, dy) + 1) + offset.x, y: a.y + uy * (reach(shapes.get(e.from)!, dx, dy) + 1) + offset.y };
      const end = { x: b.x - ux * (reach(shapes.get(e.to)!, -dx, -dy) + 3) + offset.x, y: b.y - uy * (reach(shapes.get(e.to)!, -dx, -dy) + 3) + offset.y };
      path = `M${pt(start)} L${pt(end)}`;
      tip = end;
      dir = { x: ux, y: uy };
    }

    const line = `<path d="${path}" stroke-width="1.6"${dash} style="stroke:${colour}"/>`;
    if (e.approval) {
      // Doubled: the same path twice, a little either side of where it would run.
      const nx = -dir.y * 1.7;
      const ny = dir.x * 1.7;
      body.push(`<g transform="translate(${fmt(nx)} ${fmt(ny)})">${line}</g>`);
      body.push(`<g transform="translate(${fmt(-nx)} ${fmt(-ny)})">${line}</g>`);
    } else body.push(line);
    // The arrowhead, filled, at the tip.
    const size = 7;
    const px = -dir.y;
    const py = dir.x;
    const head = [
      tip,
      { x: tip.x - dir.x * size + px * size * 0.5, y: tip.y - dir.y * size + py * size * 0.5 },
      { x: tip.x - dir.x * size - px * size * 0.5, y: tip.y - dir.y * size - py * size * 0.5 },
    ];
    body.push(`<path d="M${head.map(pt).join(" L")} Z" style="fill:${colour}"/>`);
  }

  // Nodes, on top.
  for (const node of doc.nodes) {
    const c = centres[node.id]!;
    const shape = shapes.get(node.id)!;
    const e = extent(shape, barred.has(node.id));
    grow(box, c.x - e.x, c.y - e.top);
    grow(box, c.x + e.x, c.y + e.bottom);
    switch (shape) {
      case "square":
      case "rounded":
        body.push(
          `<rect x="${fmt(c.x - 11)}" y="${fmt(c.y - 11)}" width="22" height="22" rx="${shape === "square" ? 2 : 7}" stroke-width="1.8" style="fill:${COLOUR.agentFill};stroke:${COLOUR.agent}"/>`,
        );
        break;
      case "diamond":
        body.push(
          `<path d="M${pt({ x: c.x, y: c.y - 14 })} L${pt({ x: c.x + 14, y: c.y })} L${pt({ x: c.x, y: c.y + 14 })} L${pt({ x: c.x - 14, y: c.y })} Z" stroke-width="1.8" style="fill:${COLOUR.agentFill};stroke:${COLOUR.agent}"/>`,
        );
        break;
      case "hexagon":
        body.push(
          `<path d="M${pt({ x: c.x - 7, y: c.y - 12 })} L${pt({ x: c.x + 7, y: c.y - 12 })} L${pt({ x: c.x + 14, y: c.y })} L${pt({ x: c.x + 7, y: c.y + 12 })} L${pt({ x: c.x - 7, y: c.y + 12 })} L${pt({ x: c.x - 14, y: c.y })} Z" stroke-width="1.8" style="fill:${COLOUR.surface};stroke:${COLOUR.check}"/>`,
        );
        break;
      case "octagon": {
        const points: Pt[] = [];
        for (let k = 0; k < 8; k++) {
          const angle = ((22.5 + k * 45) * Math.PI) / 180;
          points.push({ x: c.x + 13 * Math.cos(angle), y: c.y + 13 * Math.sin(angle) });
        }
        body.push(`<path d="M${points.map(pt).join(" L")} Z" stroke-width="2.4" style="fill:${COLOUR.surface};stroke:${COLOUR.gate}"/>`);
        break;
      }
      case "circle":
        body.push(`<circle cx="${fmt(c.x)}" cy="${fmt(c.y)}" r="11" stroke-width="1.8" style="fill:${COLOUR.surface};stroke:${COLOUR.merge}"/>`);
        break;
      case "dot":
        body.push(`<circle cx="${fmt(c.x)}" cy="${fmt(c.y)}" r="6" style="fill:${node.kind === "stop" && node.outcome === "halt" ? COLOUR.warning : COLOUR.ink}"/>`);
        break;
    }
    if (barred.has(node.id)) {
      body.push(`<path d="M${pt({ x: c.x - 13, y: c.y + 17 })} L${pt({ x: c.x + 13, y: c.y + 17 })}" stroke-width="3" style="stroke:${COLOUR.error}"/>`);
    }
  }

  if (body.length === 0) grow(box, 0, 0, 12);
  const x = box.minX - MARGIN;
  const y = box.minY - MARGIN;
  const w = box.maxX - box.minX + 2 * MARGIN;
  const h = box.maxY - box.minY + 2 * MARGIN;
  const title = escape(doc.name || doc.id);
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${fmt(x)} ${fmt(y)} ${fmt(w)} ${fmt(h)}" width="${fmt(w * scale)}" height="${fmt(h * scale)}" role="img" fill="none" stroke-linecap="round" stroke-linejoin="round" class="grooph-glyph">`,
    `<title>${title}</title>`,
    ...body,
    `</svg>`,
  ].join("\n");
}
