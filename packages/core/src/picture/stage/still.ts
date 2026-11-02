/**
 * A still of a document in three dimensions (`grooph image --view`): a graph as the stairs, Panes, the spiral, Rings
 * or Columns, and an operation map as the stairs. It is the view the app opens, drawn once as an SVG from where the
 * app's view starts: the same arithmetic places everything (`stairs.ts`, `panes.ts` and their fellows), and this
 * draws it as the app's stage does (`apps/web/src/ui/canvas/stage/draw.ts`) and as the browser draws the stairs
 * (`apps/web/src/ui/map/space.ts`), with no browser.
 *
 * Like the flat pictures it is a picture core draws: the frame, the palette and the marks a theme reads
 * (`data-card`, `data-edge`, `data-node`) are theirs, so `themed()` puts it in any of the six looks, and `light` or
 * `dark` write the colors in for a PNG. Pure and deterministic: the same document and options give the same bytes.
 *
 * Two widths: a window's, 800 units, and a phone's, 400, where the views stand things one under another as the
 * app does on a phone. The height follows from what is drawn. A view is drawn as large as the width allows, and
 * no larger than the app draws it at its natural size: a card is then 106 units wide, its name 11.5.
 */
import { DEFAULT_LAYOUT_BOX, resolvePositions } from "../../layout.js";
import type { Graph, Id, OperationMap } from "../../types.js";
import { mapKit } from "../map-kit.js";
import { numberBadge } from "../map-parts.js";
import { esc, fmt, frame, inkFor, PICTURE_WIDTH, text, textWidth, truncate, wrap, type Color, type Ink, type MapPictureOptions, type PictureTheme } from "../svg.js";
import { columns, COLUMNS_START } from "./columns.js";
import { graphScene, KINDS_3D } from "./graph-scene.js";
import { columnsAt, modelOf, stepsOf, under, type MNode } from "./model.js";
import { panes, PANES_START } from "./panes.js";
import type { Look, Prim, V } from "./prim.js";
import { rings, RINGS_START } from "./rings.js";
import * as shapes from "./shapes.js";
import type { View } from "./shapes.js";
import { brakes, spiral, SPIRAL_START, topOf } from "./spiral.js";
import { bow, CARD, layout, mapScene, scaled, START, sub, turned, unit, type Scene } from "./stairs.js";
import { extent, inset, outside } from "./trim.js";


/** The views a still can be drawn as, in the order the app offers them (`KINDS_3D`). An operation map has the first. */
export const STILL_VIEWS = KINDS_3D.map(([id]) => id);
export type StillView = (typeof KINDS_3D)[number][0];
export type StillOptions = {
  view: StillView;
  /** as a picture's: `auto` (the default) follows the viewer, `light` and `dark` write the colors in */
  theme?: PictureTheme;
  /** `wide` (the default) for a window, 800 units; `phone` for a phone's width, 400 */
  layout?: "wide" | "phone";
};
export type MapStillOptions = Omit<StillOptions, "view"> & Pick<MapPictureOptions, "live" | "at">;

const WIDE = 800;
/** The size a still is drawn at, at most: the app's own, at which a card's name is 11.5 units. */
const NATURAL = 1;

const num = (n: number, places = 3): string => {
  const r = Math.round(n * 10 ** places) / 10 ** places;
  return (Object.is(r, -0) ? 0 : r).toString();
};
const clamp = (v: number, a: number, b: number): number => Math.max(a, Math.min(b, v));
/** A point on the page: across, down, and how near (larger is nearer), with how large things are drawn there. */
type Seen = [number, number, number, number];

/** A still of a graph in one of its views in three dimensions. */
export function still(doc: Graph, opts: StillOptions): string {
  const W = opts.layout === "phone" ? PICTURE_WIDTH : WIDE;
  const [, name, says] = KINDS_3D.find(([id]) => id === opts.view) ?? KINDS_3D[0];
  const drawn = opts.view === "stairs" ? stairs(graphScene(doc, perRow(W), CARD), W, "edge") : stage(doc, opts.view, W);
  const title = doc.name || doc.id;
  return solid(framed(W, title, `${name}. ${says}`, `${title} as ${opts.view === "stairs" ? "the stairs" : KINDS[opts.view].as}`, opts.view === "stairs" ? "space" : opts.view, drawn), opts.theme ?? "auto");
}

/** A still of an operation map as the stairs, with what the hooks saw where `live` is given. */
export function mapStill(map: OperationMap, opts: MapStillOptions = {}): string {
  const W = opts.layout === "phone" ? PICTURE_WIDTH : WIDE;
  const scene = mapScene(mapKit, map, { per: perRow(W), ...(opts.live ? { live: opts.live } : {}), ...(opts.at ? { at: opts.at } : {}) });
  const title = map.name || map.id;
  return solid(framed(W, title, MAP_STAIRS, `${title} as the stairs`, "space", stairs(scene, W, "handoff")), opts.theme ?? "auto");
}

/** What a map's stairs are, in a sentence, as each view of a graph has one (`KINDS_3D`). */
const MAP_STAIRS = "Stairs. Each lane is a sheet, the people's on top; each session is a card standing on its lane's sheet, and each handoff an arc from one card to another, numbered as the map lists them.";

/** A view, drawn: its markup, how tall it is, and the lines said under it. */
type Drawn = { body: string; h: number; key?: { name: string; color: Color; says: string }[] };

/**
 * The view with its words, as the picture has its title and caption: the document's name over it, what the view
 * is in a sentence, and under a spiral each loop's brakes in words, which the app says under its view too.
 */
function framed(W: number, name: string, says: string, title: string, kind: string, drawn: Drawn): string {
  const ink = inkFor("auto");
  const head: string[] = [];
  let y = 10;
  for (const line of wrap(name, W - 32, 17, 2, "bold")) {
    y += 17;
    head.push(text(16, y, line, { size: 17, fill: ink("ink"), weight: "bold" }));
    y += 4;
  }
  for (const line of wrap(says, W - 32, 11.5, 4)) {
    y += 14.5;
    head.push(text(16, y, line, { size: 11.5, fill: ink("ink-3") }));
  }
  const top = y + 8;
  const foot: string[] = [];
  let z = top + drawn.h;
  for (const { name: loop, color, says: words } of drawn.key ?? []) {
    // The loop's name in its color and bold: the first line is measured for that.
    const bold = textWidth(`${loop}:`, 11, "bold") - textWidth(`${loop}:`, 11);
    wrap(`${loop}: ${words}`, (k) => W - 32 - (k === 0 ? bold : 0), 11, 6).forEach((line, k) => {
      z += 15;
      foot.push(
        k === 0 && line.startsWith(`${loop}: `)
          ? `<text x="16" y="${fmt(z)}" font-size="11"><tspan font-weight="700" style="fill:${ink(color)}">${esc(loop)}:</tspan><tspan style="fill:${ink("ink-2")}"> ${esc(line.slice(loop.length + 2))}</tspan></text>`
          : text(16, z, line, { size: 11, fill: ink("ink-2") }),
      );
    });
    z += 4;
  }
  return frame(W, Math.ceil(z + (foot.length ? 12 : 0)), title, "auto", ink, `${head.join("")}<g transform="translate(0,${fmt(top)})">${drawn.body}</g>${foot.join("")}`, kind);
}

/** How many cards stand in a row of the stairs: the app's rule for the room it has (`ui/map/views.tsx`). */
const perRow = (width: number): number => (width < 640 ? 3 : width < 900 ? 4 : 6);

/** A picture drawn to follow the viewer, with its colors written in for `light` or `dark`, as `themed()` writes a theme's. */
function solid(svg: string, theme: PictureTheme): string {
  if (theme === "auto") return svg;
  const ink = inkFor(theme);
  return svg.replace(/<style>[^<]*<\/style>/, "").replace(/ style="[^"]*"/g, (attribute) => attribute.replace(/var\(--gp-([a-z0-9-]+)\)/g, (_, color: Color) => ink(color)));
}

// ─── Panes, the spiral, Rings and Columns ─────────────────────────────────

const KINDS: Record<Exclude<StillView, "stairs">, { view: View; start: Look; as: string }> = {
  panes: { view: panes, start: PANES_START, as: "panes" },
  spiral: { view: spiral, start: SPIRAL_START, as: "a spiral for each loop" },
  rings: { view: rings({ ...shapes, under }), start: RINGS_START, as: "a ring for each loop" },
  columns: { view: columns(shapes), start: COLUMNS_START, as: "columns" },
};

/** The stage's colors by the short names the views use: the app reads the same on its canvas (`draw.ts`). */
const TOKEN: Record<string, Color> = {
  ink: "ink",
  "ink-2": "ink-2",
  "ink-3": "ink-3",
  line: "line",
  "line-strong": "line-strong",
  card: "surface",
  ground: "bg",
  floor: "surface-2",
  accent: "accent",
  "accent-soft": "accent-soft",
  "loop-0": "loop-0",
  "loop-1": "loop-1",
  "loop-2": "loop-2",
  "loop-3": "loop-3",
  "k-agent": "accent",
  "k-check": "check",
  "k-gate": "gate",
  "k-stop": "stop",
  ok: "ok",
  bad: "warning",
  brake: "error",
};
/** A card's edge, by its node's kind, as the app's style sheet has it. */
const EDGE_OF: Record<MNode["kind"], Color> = { agent: "accent", check: "check", person: "gate", gate: "gate", stop: "stop" };

/**
 * A card as the app's stage lays it out (`.s3-card` in `apps/web/src/ui/canvas/graph-stage.css`, which a test holds
 * these to): a border of one unit with four at the left in its kind's color, its corners rounded, padding round its
 * words; its name on up to two lines, and a line under it. A card that is its name alone is as wide as its name,
 * between the narrowest and the widest, with less padding, and keeps its line only for a person's step.
 */
export const S3_CARD = { width: 106, padding: [4, 6, 5, 9], edge: 4, radius: 7, name: [11.5, 1.25], line: [9.5, 1.3], small: { min: 56, max: 150, padding: 3 } } as const;
type Face = { w: number; h: number; names: string[]; line: string | null };
function faceOf(n: MNode, small: boolean): Face {
  const { width, padding: [top, right, bottom, left], edge, name: [size, leading], line: [lineSize, lineLeading] } = S3_CARD;
  const [nameH, lineH] = [size * leading, lineSize * lineLeading];
  // Across: the edge, the padding at the left and at the right, and the border at the right.
  const sides = edge + left + right + 1;
  if (small) {
    const { min, max, padding } = S3_CARD.small;
    const names = [truncate(n.name, max - sides, size, "bold")];
    const line = n.kind === "person" ? truncate(n.line, max - sides, lineSize) : null;
    return { w: clamp(Math.max(textWidth(names[0]!, size, "bold"), line ? textWidth(line, lineSize) : 0) + sides, min, max), h: 2 + 2 * padding + nameH + (line ? lineH : 0), names, line };
  }
  const names = wrap(n.name, width - sides, size, 2, "bold");
  return { w: width, h: 2 + top + bottom + names.length * nameH + lineH, names, line: truncate(n.line, width - sides, lineSize) };
}

function stage(doc: Graph, view: Exclude<StillView, "stairs">, W: number): Drawn {
  const kind = KINDS[view];
  const narrow = W < 640;
  const model = modelOf(doc, resolvePositions(doc, columnsAt(W), DEFAULT_LAYOUT_BOX).positions, undefined, narrow);
  // Fitted on all a view places, as the app fits it (an edge it shows only when a step is about it included), and
  // drawn as it starts, without those.
  const placed = kind.view(model, shapes.shownAt(model, stepsOf(model), 0)).prims;
  const prims = placed.filter((p) => !p.hide);
  const ink = inkFor("auto");
  const faces = new Map(placed.flatMap((p) => (p.t === "card" ? [[p.id, faceOf(model.nodes.find((n) => n.id === p.id)!, !!p.small)] as const] : [])));
  if (!model.nodes.length) return { body: text(16, 24, "This graph has no nodes to draw.", { size: 12, fill: ink("ink-3") }), h: 40 };

  // Seen from where the app's view starts. Far things are a little smaller (`near`), as in the app.
  const { yaw, pitch } = kind.start;
  const points = (p: Prim): V[] => ("pts" in p ? p.pts : [p.at]);
  const all = placed.flatMap(points);
  const center = [0, 1, 2].map((k) => ((([lo, hi]) => (lo + hi) / 2)(extent(all.map((p) => p[k]!))))) as V;
  const turn = (p: V): V => {
    const [x, y, z] = [p[0] - center[0], p[1] - center[1], p[2] - center[2]];
    const [cy, sy, cp, sp] = [Math.cos(yaw), Math.sin(yaw), Math.cos(pitch), Math.sin(pitch)];
    const [x1, z1] = [x * cy + z * sy, -x * sy + z * cy];
    return [x1, y * cp - z1 * sp, y * sp + z1 * cp];
  };
  const near = (z: number, f: number): number => (f * 2600) / (2600 - z * f);
  // The room each thing takes round its point that does not shrink with the scene, as the app's fit counts it.
  const room = (p: Prim, s: number): [number, number, number, number] => {
    if (p.t === "card") {
      const face = faces.get(p.id)!;
      const half = (p.small ? face.w * s : 106) / 2 + 5;
      return p.side ? (p.small ? [8, half * 2, 14, 14] : [8, 128, 22, 22]) : p.stand ? [half, half, Math.max(60, face.h * 1.15 + 14), 8] : [58, 58, 24, 24];
    }
    if (p.t === "text") return [8, 8, p.up ? 16 * p.text.split("\n").length * 1.6 : 12, 12];
    return [3, 3, 3, 3];
  };
  const each = placed.flatMap((p) => points(p).map((q) => [turn(q), p] as const));
  const box = (f: number): [number, number, number, number] => {
    const at = each.map(([t, p]) => [t, near(t[2], f), room(p, clamp(near(t[2], f), 0.72, 1.15))] as const);
    return [extent(at.map(([t, k, r]) => t[0] * k - r[0]))[0], extent(at.map(([t, k, r]) => t[0] * k + r[1]))[1], extent(at.map(([t, k, r]) => -t[1] * k - r[2]))[0], extent(at.map(([t, k, r]) => -t[1] * k + r[3]))[1]];
  };
  // As large as the width allows, and no larger than the app's natural size.
  // And never so large that the nearest thing comes close to the eye: the app's frame has a height, which keeps a
  // deep scene small; a still's height is what it needs, so the nearest point is held to a third larger than the
  // middle, as the app has it.
  const nearest = Math.max(1, extent(each.map(([t]) => t[2]))[1]);
  let [lo, hi] = [Math.min(0.05, 650 / nearest), Math.min(NATURAL, 650 / nearest)];
  if (box(hi)[1] - box(hi)[0] <= W - 16) lo = hi;
  else
    for (let n = 0; n < 18; n += 1) {
      const f = (lo + hi) / 2;
      const [x0, x1] = box(f);
      if (x1 - x0 <= W - 16) lo = f;
      else hi = f;
    }
  const fitted = lo;
  const [x0, x1, y0, y1] = box(fitted);
  const H = Math.ceil(y1 - y0 + 16);
  const shift = [(x0 + x1) / 2 / fitted, -(y0 + y1) / 2 / fitted];
  const seen = (p: V): Seen => {
    const [x, y, z] = turn(p);
    const k = near(z, fitted);
    return [W / 2 + (x - shift[0]!) * k, H / 2 - (y - shift[1]!) * k, z, k];
  };
  const paint = (name: string): string => ink(TOKEN[name] ?? "ink-2");

  // In the order the app draws them: farthest first, a polygon under a line under a word at one depth.
  const items = prims
    .map((p) => {
      const pts = points(p).map(seen);
      return { p, pts, depth: pts.reduce((a, q) => a + q[2], 0) / pts.length + (p.t === "poly" ? -90 : p.t === "line" ? -20 : p.t === "dot" ? 4000 : p.t === "text" ? 60 : 0) + (p.lift ?? 0) };
    })
    .sort((a, b) => a.depth - b.depth);

  // The cards first, for where they are: an edge is drawn to the card it reaches, and a word stands where no card is.
  type Box = [number, number, number, number];
  const boxes = new Map<Id, Box>();
  const cards: string[] = [];
  for (const { p, pts } of items) {
    if (p.t !== "card") continue;
    const face = faces.get(p.id)!;
    const node = model.nodes.find((n) => n.id === p.id)!;
    const [x, y, , k] = pts[0]!;
    const s = clamp(k, 0.72, 1.15);
    const [cw, ch] = [face.w * s, face.h * s];
    const at: Box = [p.side ? x + 9 : x - cw / 2, p.stand && !p.side ? y - ch - 13 : y - ch / 2, cw, ch];
    boxes.set(p.id, at);
    cards.push(cardSvg(node, face, at, s, ink, !!p.small));
  }
  const said: Box[] = [];
  const over = (a: Box, b: Box): number => Math.max(0, Math.min(a[0] + a[2], b[0] + b[2]) - Math.max(a[0], b[0])) * Math.max(0, Math.min(a[1] + a[3], b[1] + b[3]) - Math.max(a[1], b[1]));
  const body: string[] = [];
  for (const { p, pts: at } of items) {
    if (p.t === "card") continue;
    const alpha = p.alpha ?? 1;
    const opacity = alpha < 1 ? ` opacity="${num(alpha, 2)}"` : "";
    const dash = "dash" in p && p.dash ? ` stroke-dasharray="${p.dash.join(" ")}"` : "";
    if (p.t === "poly") {
      const d = `M${at.map((q) => `${fmt(q[0])},${fmt(q[1])}`).join(" L")} Z`;
      const fill = p.fill ? `fill:${paint(p.fill)}` : "fill:none";
      body.push(`<path d="${d}"${p.fill && (p.fa ?? 1) < 1 ? ` fill-opacity="${num(p.fa!, 2)}"` : ""}${p.stroke ? ` stroke-width="${fmt(p.w ?? 1)}" stroke-linejoin="round"${dash}` : ""}${opacity} style="${fill}${p.stroke ? `;stroke:${paint(p.stroke)}` : ""}"/>`);
    } else if (p.t === "line") {
      let pts: number[][] = at;
      // Up to the edge of the card it leaves and of the card it reaches, where it runs through them.
      const [left, reached] = [p.from ? boxes.get(p.from) : undefined, p.to ? boxes.get(p.to) : undefined];
      const cut = [reached ? outside(pts, reached) : null, left ? outside([...pts].reverse(), left) : null];
      if (cut[0]) pts = cut[0];
      if (cut[1]) pts = outside([...pts].reverse(), left!)?.reverse() ?? pts;
      if (p.inset) pts = inset(pts, cut[1] ? 2 : p.inset[0], cut[0] ? 1 : p.inset[1]);
      const color = paint(p.stroke ?? "ink-2");
      const d = `M${pts.map((q) => `${fmt(q[0]!)},${fmt(q[1]!)}`).join(" L")}`;
      let head = "";
      if (p.arrow && pts.length > 1) {
        const [a, b] = [pts[pts.length - 2]!, pts[pts.length - 1]!];
        const ang = Math.atan2(b[1]! - a[1]!, b[0]! - a[0]!);
        head = `<path d="M${fmt(b[0]!)},${fmt(b[1]!)} L${fmt(b[0]! - 9 * Math.cos(ang - 0.42))},${fmt(b[1]! - 9 * Math.sin(ang - 0.42))} L${fmt(b[0]! - 9 * Math.cos(ang + 0.42))},${fmt(b[1]! - 9 * Math.sin(ang + 0.42))} z" style="fill:${color}"/>`;
      }
      const line = `<path d="${d}" fill="none" stroke-width="${fmt(p.w ?? 1.4)}" stroke-linecap="round" stroke-linejoin="round"${dash} style="stroke:${color}"/>${head}`;
      // An edge is marked as the picture marks one, so that a theme draws it as it draws the picture's.
      const edge = p.key?.startsWith("edge:") ? p.key.slice(5).replace(/@.*$/, "") : undefined;
      body.push(edge !== undefined ? `<g data-edge="${esc(edge)}"${opacity}>${line}</g>` : opacity || head ? `<g${opacity}>${line}</g>` : line);
    } else if (p.t === "dot") {
      body.push(`<circle cx="${fmt(at[0]![0])}" cy="${fmt(at[0]![1])}" r="${fmt(p.r ?? 5)}"${p.stroke ? ` stroke-width="${fmt(p.w ?? 2)}"` : ""}${opacity} style="fill:${p.fill ? paint(p.fill) : "none"}${p.stroke ? `;stroke:${paint(p.stroke)}` : ""}"/>`);
    } else {
      const size = p.size ?? 11;
      const weight = p.bold ? "bold" : "regular";
      // Words that would run past the frame are put on a line of their own, and a line is moved to stay in it.
      const roomy = Math.min(p.max ?? 220, W - 12);
      const lines = p.text.split("\n").flatMap((line, n) => wrap(line, roomy, size, 99, weight).map((words) => ({ words, head: n < (p.heads ?? 0) })));
      const widest = Math.max(...lines.map(({ words }) => textWidth(words, size, weight)));
      const tall = lines.length * (size + 3);
      // Where it stands: at its own place, or at the first of the others where no card and no word before it is
      // over it; if every one is covered, where the least of it is.
      const places = [{ at: at[0]!, align: p.align }, ...(p.or ?? []).map((o) => ({ at: seen(o.at), align: o.align }))].map((o) => {
        const x = clamp(o.at[0] - (o.align === "center" ? widest / 2 : o.align === "right" ? widest : 0), 4, Math.max(4, W - 4 - widest));
        const spot: Box = [x, o.at[1] - (p.up ? tall - (size + 3) / 2 : tall / 2), widest, tall];
        return { ...o, box: spot, under: [...boxes.values(), ...said].reduce((sum, b) => sum + over(spot, b), 0) };
      });
      const here = p.or ? (places.find((o) => o.under === 0) ?? [...places].sort((a, b) => a.under - b.under)[0]!) : places[0]!;
      if (p.or) said.push(here.box);
      const words = lines.map(({ words, head }, k) => {
        const wide = textWidth(words, size, weight);
        const left = clamp(here.at[0] - (here.align === "center" ? wide / 2 : here.align === "right" ? wide : 0), 4, Math.max(4, W - 4 - wide));
        // A block stands on its point and grows upward, or is centered on it. The point is the middle of a line.
        const y = here.at[1] + (p.up ? k - (lines.length - 1) : k - (lines.length - 1) / 2) * (size + 3) + size * 0.35;
        return halo(left, y, words, size, p.bold, paint(head && p.headFill ? p.headFill : (p.fill ?? "ink-2")), ink);
      });
      body.push(opacity ? `<g${opacity}>${words.join("")}</g>` : words.join(""));
    }
  }
  // Under a spiral, each loop's brakes in words: what the lid and the rings on the way up stand for.
  const key = view === "spiral" ? model.loops.map((loop, n) => ({ name: loop.name, color: `loop-${n % 4}` as Color, says: brakes(loop, topOf(model, loop)).words.join("; ") })) : [];
  return { body: body.join("") + cards.join(""), h: H, ...(key.length ? { key } : {}) };
}

/** Words with a rim of the ground round them, so that a line under them does not cut them: as the app writes them. */
const halo = (x: number, y: number, words: string, size: number, bold: boolean | undefined, fill: string, ink: Ink): string =>
  `<text x="${fmt(x)}" y="${fmt(y)}" font-size="${fmt(size)}"${bold ? ' font-weight="700"' : ""} stroke-width="3.5" stroke-linejoin="round" paint-order="stroke" style="fill:${fill};stroke:${ink("bg")};stroke-opacity:.9">${esc(words)}</text>`;

/** A node's card, where the stage puts it and as large: its name, its line, and its kind's color down its left. */
function cardSvg(n: MNode, face: Face, [x, y]: [number, number, number, number], s: number, ink: Ink, small: boolean): string {
  const { padding, edge, radius: r, name: [size, leading], line: [lineSize, lineLeading] } = S3_CARD;
  // A line's words sit on a baseline about a third of their size under the middle of the line.
  const [top, left, nameH, lineH] = [1 + (small ? S3_CARD.small.padding : padding[0]), edge + padding[3], size * leading, lineSize * lineLeading];
  const names = face.names.map((line, k) => text(left, top + (k + 0.5) * nameH + size * 0.35, line, { size, fill: ink("ink"), weight: "bold" }));
  const line = face.line === null ? "" : text(left, top + face.names.length * nameH + lineH / 2 + lineSize * 0.35, face.line, { size: lineSize, fill: ink("ink-3") });
  // The edge down its left is the card's own outline there, with its rounded corners: where the inner side of that
  // band meets the corner's curve.
  const [w, h] = [face.w, face.h];
  const meet = r - Math.sqrt(r * r - (r - edge) ** 2);
  return (
    `<g data-node="${esc(n.id)}" data-kind="${n.kind}" transform="translate(${fmt(x)},${fmt(y)}) scale(${num(s)})">` +
    `<rect data-card="" x="0.5" y="0.5" width="${fmt(w - 1)}" height="${fmt(h - 1)}" rx="${r}" stroke-width="1" style="fill:${ink("surface")};stroke:${ink("line-strong")}"/>` +
    `<path d="M${edge},${num(meet, 2)} A${r},${r} 0 0 0 0,${r} V${fmt(h - r)} A${r},${r} 0 0 0 ${edge},${num(h - meet, 2)} Z" style="fill:${ink(EDGE_OF[n.kind])}"/>` +
    // In a group of their own: a theme's rules for the picture's card lines are not for these.
    `<g>${names.join("")}${line}</g></g>`
  );
}

// ─── the stairs ───────────────────────────────────────────────────────────

/**
 * The stairs as the browser draws them (`space.ts`): the world turned to where the view starts and seen through a
 * lens as deep as the app's (`perspective`, 1.7 times the width, at least 900), or, for a still taller than the
 * app's frame ever is, 1.7 times its own height, so that the top of a tall stack is seen from above as the app
 * shows it. A sheet, a card, a label or an arc is drawn where its own corners are seen, so it leans and shortens as
 * it does there.
 *
 * What is nearer is drawn later, as the browser sorts it. The sheets cut the world into levels: what is between
 * two sheets is drawn after the lower one and before the upper one, which lies over it at nearly three quarters
 * strength, as on the page. Inside a level the farthest thing comes first. An arc is drawn in short pieces, each
 * where it is, so a card covers the part of an arc that passes behind it.
 */
function stairs(made: Scene, W: number, link: string): Drawn {
  const ink = inkFor("auto");
  const { width, placed, arcs, box } = layout(made);
  const { yaw, pitch } = START;
  // The app's lens for its frame's width; and for a still taller than a frame, one as deep for its height, so that
  // the top of a tall stack is still seen from above.
  let lens = Math.max(900, W * 1.7);
  const center: V = [(box.min[0] + box.max[0]) / 2, (box.min[1] + box.max[1]) / 2, (box.min[2] + box.max[2]) / 2];
  // As large as the width allows, and no larger than the app's natural size: the box's corners, through the lens.
  const corners: V[] = [0, 1, 2, 3, 4, 5, 6, 7].map((k) => turned(sub([k & 1 ? box.max[0] : box.min[0], k & 2 ? box.max[1] : box.min[1], k & 4 ? box.max[2] : box.min[2]], center), yaw, pitch));
  const across = (size: number): number => Math.max(...corners.map((c) => Math.abs(c[0] * size * (lens / Math.max(1, lens - c[2] * size)))));
  const fitted = (): number => {
    let [lo, hi] = [0.02, NATURAL];
    if (across(hi) <= W / 2 - 14) return hi;
    for (let k = 0; k < 24; k += 1) {
      const mid = (lo + hi) / 2;
      if (across(mid) <= W / 2 - 14) lo = mid;
      else hi = mid;
    }
    return lo;
  };
  const tall = (size: number): number => (Math.max(...corners.map((c) => c[1])) - Math.min(...corners.map((c) => c[1]))) * size;
  // A deeper lens lets the size grow, and a larger still asks for a deeper lens again: until the lens covers it. The
  // size is never past the natural one, so this ends.
  let size = fitted();
  for (let n = 0; n < 24 && lens < 1.7 * tall(size) - 0.5; n += 1) {
    lens = 1.7 * tall(size);
    size = fitted();
  }
  const ys = corners.map((c) => c[1] * size * (lens / Math.max(1, lens - c[2] * size)));
  const H = Math.ceil(Math.max(...ys) - Math.min(...ys) + 28);
  const middle = 14 - Math.min(...ys);
  /** Where a point of the world is seen, how large things are drawn there, and how near it is. */
  const seen = (p: V): [number, number, number, number] => {
    const [x, y, z] = scaled(turned(sub(p, center), yaw, pitch), size);
    const k = lens / Math.max(1, lens - z);
    return [W / 2 + x * k, middle + y * k, k * size, z];
  };
  /** The flat thing at `o` whose across is `ex` and whose down is `ey`, as an SVG transform: exact at those three corners. */
  const plane = (o: V, ex: V, ey: V, w: number, h: number): string => {
    const [p, q, r] = [seen(o), seen([o[0] + ex[0] * w, o[1] + ex[1] * w, o[2] + ex[2] * w]), seen([o[0] + ey[0] * h, o[1] + ey[1] * h, o[2] + ey[2] * h])];
    return `matrix(${num((q[0] - p[0]) / w, 4)},${num((q[1] - p[1]) / w, 4)},${num((r[0] - p[0]) / h, 4)},${num((r[1] - p[1]) / h, 4)},${fmt(p[0])},${fmt(p[1])})`;
  };
  const path = (pts: V[]): string => `M${pts.map((p) => seen(p)).map((q) => `${fmt(q[0])},${fmt(q[1])}`).join(" L")}`;
  const [X, Y]: [V, V] = [
    [1, 0, 0],
    [0, 1, 0],
  ];
  // The level of a height: the sheet it is over (the first one as low as it or lower), or under them all.
  const floors = placed.map((p) => p.floor);
  const level = (y: number): number => ((k) => (k < 0 ? floors.length : k))(floors.findIndex((f) => f >= y));
  type Piece = { level: number; depth: number; svg: string };
  const pieces: Piece[] = [];
  const put = (at: V, svg: string, nearer = 0): void => void pieces.push({ level: level(at[1]), depth: seen(at)[3] + nearer, svg });

  const sheets = placed.map(({ sheet, floor, front, back, at: places }) => {
    // A sheet's outline, with the rounded corners the page gives it, lying flat.
    const r = 12;
    const round = (cx: number, cz: number, from: number): V[] => Array.from({ length: 7 }, (_, k) => [cx + r * Math.cos(from + (k * Math.PI) / 12), floor, cz + r * Math.sin(from + (k * Math.PI) / 12)]);
    const outline = [...round(width - r, back + r, -Math.PI / 2), ...round(width - r, front - r, 0), ...round(r, front - r, Math.PI / 2), ...round(r, back + r, Math.PI)];
    const k = seen([width / 2, floor, (front + back) / 2])[2];
    // Its label, standing under its front edge, on a line each: the name with where it is, and what it is.
    const name = truncate(sheet.name, width - 8, 12, "bold");
    const nameW = textWidth(name, 12, "bold");
    // Where it is, in its pill after the name, where the pill fits whole: the page cuts the line at the label's edge.
    const place = sheet.place && nameW + 6 + textWidth(sheet.place, 10.5) + 14 <= width - 8 ? sheet.place : "";
    const placeW = place ? textWidth(place, 10.5) + 14 : 0;
    const subline = truncate(`${sheet.sub}${sheet.items.length ? "" : made.none}`, width - 8, 10.5);
    put(
      [width / 2, floor + 19, front],
      `<g transform="${plane([0, floor + 3, front], X, Y, width, 32)}">` +
        text(4, 11.6, name, { size: 12, fill: ink("ink"), weight: "bold" }) +
        (place ? `<rect x="${fmt(4 + nameW + 6)}" y="1.6" width="${fmt(placeW)}" height="14" rx="7" stroke-width="1" style="fill:none;stroke:${ink("line-strong")}"/>${text(4 + nameW + 6 + 7, 11.6, place, { size: 10.5, fill: ink("ink-2") })}` : "") +
        text(4, 27.4, subline, { size: 10.5, fill: ink("ink-3") }) +
        `</g>`,
    );
    sheet.items.forEach((c, j) => {
      const at = places[j]!;
      put([at[0] + CARD / 2, at[1] + c.h / 2, at[2]], `<g transform="${plane(at, X, Y, CARD, c.h)}">${c.svg()}</g>`);
    });
    return `<path data-sheet="" d="${path(outline)} Z" fill-opacity="0.72" stroke-width="${fmt(1.2 * k)}" stroke-linejoin="round"${sheet.cls.includes("is-people") ? ` stroke-dasharray="${fmt(5 * k)} ${fmt(3 * k)}"` : ""} style="fill:${ink("surface-2")};stroke:${ink("line-strong")}"/>`;
  });

  // The arcs, each in the plane the app holds it in: through its two ends, bowed toward the side it is seen from.
  const HEAD = 9;
  arcs.forEach((arc, k) => {
    const style = made.links[k]!.style;
    const color = ink(style.color);
    const along = unit(sub(arc.b, arc.a));
    const side = bow(arc, yaw, pitch);
    const length = Math.max(1, Math.hypot(arc.b[0] - arc.a[0], arc.b[1] - arc.a[1], arc.b[2] - arc.a[2]));
    const tall = arc.lift + HEAD;
    const o: V = [arc.a[0] + side[0] * tall, arc.a[1] + side[1] * tall, arc.a[2] + side[2] * tall];
    // A point of the arc's own drawing, across and down, in the world.
    const world = (u: number, v: number): V => [o[0] + along[0] * u - side[0] * v, o[1] + along[1] * u - side[1] * v, o[2] + along[2] * u - side[2] * v];
    const [cx, cy] = [length / 2, tall - 2 * arc.lift];
    const slope = Math.atan2(tall - cy, length - cx);
    const [ex, ey] = [length - Math.cos(slope) * 5, tall - Math.sin(slope) * 5];
    const curve = Array.from({ length: 33 }, (_, n) => {
      const t = n / 32;
      return world(2 * t * (1 - t) * cx + t * t * ex, (1 - t) ** 2 * tall + 2 * t * (1 - t) * cy + t * t * ey);
    });
    const s = seen(world(length / 2, tall - arc.lift))[2];
    const dash = style.dash ? style.dash.split(" ").map((n) => Number(n) * s) : undefined;
    // In pieces of four steps, each carrying on the dashes where the last left them.
    const first = pieces.length;
    let gone = 0;
    for (let n = 0; n < 32; n += 4) {
      const run = curve.slice(n, n + 5);
      const flat = run.map(seen);
      const mid = run[2]!;
      put(
        mid,
        `<g data-${link}="${esc(arc.id)}"><path d="${path(run)}" fill="none" stroke-width="${fmt(style.width * s)}" stroke-linecap="round"${dash ? ` stroke-dasharray="${dash.map(fmt).join(" ")}" stroke-dashoffset="${fmt(gone)}"` : ""} style="stroke:${color}"/></g>`,
      );
      for (let m = 1; m < flat.length; m += 1) gone += Math.hypot(flat[m]![0] - flat[m - 1]![0], flat[m]![1] - flat[m - 1]![1]);
    }
    // Where it leaves its card, and its head where it reaches the other.
    const start = seen(world(0, tall));
    const tip = (u: number, v: number): V => world(length + u * Math.cos(slope) - v * Math.sin(slope), tall + u * Math.sin(slope) + v * Math.cos(slope));
    put(world(0, tall), `<g data-${link}="${esc(arc.id)}"><circle cx="${fmt(start[0])}" cy="${fmt(start[1])}" r="${fmt(2.4 * start[2])}" style="fill:${color}"/></g>`, 0.5);
    put(tip(-4, 0), `<g data-${link}="${esc(arc.id)}"><path d="${path([tip(0, 0), tip(-8, -3.8), tip(-8, 3.8)])} z" style="fill:${color}"/></g>`, 0.5);
    // Its number at its highest point, facing the reader, as large as things are drawn there, and over its own arc.
    const peak: V = [(arc.a[0] + arc.b[0]) / 2 + side[0] * arc.lift, (arc.a[1] + arc.b[1]) / 2 + side[1] * arc.lift, (arc.a[2] + arc.b[2]) / 2 + side[2] * arc.lift];
    const top = seen(peak);
    const own = pieces.slice(first).filter((p) => p.level === level(peak[1]));
    pieces.push({ level: level(peak[1]), depth: Math.max(top[3], ...own.map((p) => p.depth)) + 0.1, svg: `<g transform="translate(${fmt(top[0])},${fmt(top[1])}) scale(${num(top[2])})">${numberBadge(0, 0, String(arc.n), color, ink)}</g>` });
  });

  // From under the lowest sheet up: each sheet, then what stands over it, the farthest first.
  const body: string[] = [];
  for (let at = placed.length; at >= 0; at -= 1) {
    if (at < placed.length) body.push(sheets[at]!);
    body.push(
      ...pieces
        .filter((p) => p.level === at)
        .sort((a, b) => a.depth - b.depth)
        .map((p) => p.svg),
    );
  }
  return { body: body.join(""), h: H };
}
