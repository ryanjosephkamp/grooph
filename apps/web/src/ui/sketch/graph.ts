/**
 * A graph and a drawing of it, each made from the other: what the Sketch view (`studio.ts`) draws when it opens on a
 * graph, and what it makes of the drawing when Make it a graph is pressed.
 *
 * **The graph drawn.** Each step is the shape grooph writes it as in Mermaid (`mermaid.ts` in core), where the canvas
 * puts it: a builder or a planner a box, a critic a diamond, any other agent an oval, a check a hexagon, a person's
 * gate a trapezoid, a merge a circle, a stop a double circle. Each edge is an arrow named with its condition; one that
 * would cross another shape goes round the side, as a hand would draw it. A box of steps (a group) is a box drawn
 * round them. Every stroke is marked with the step, edge, or box it stands for.
 *
 * **The drawing read.** mermaidify's reader reads the strokes, and what it reads is written as Mermaid and read by
 * grooph's own reader (`readMermaid`), so a shape means here what it means in pasted Mermaid. Then what a drawing
 * cannot say is carried over from the graph as it was. A shape drawn with a step's strokes is that step: it keeps its
 * brief, its model, its tools, and the rest, takes the drawing's name, and takes another kind only when its shape now
 * means another kind. A shape with no step's strokes is the step of the same name, if one is left; otherwise it is a
 * new step. An arrow between two steps that had an edge is that edge, and keeps its condition unless its name was
 * changed. A loop the arrows still make keeps its name and its stops; a box still drawn keeps what it was. What is no
 * longer drawn is no longer in the graph.
 */
import { allIds, isCriticFamily, isWriterFamily, parseGraph, slugify, uniqueId, type Edge, type Graph, type Group, type Id, type Loop, type Node, type Policy, type Stop } from "@grooph/core";
import { readMermaid } from "@grooph/core/mermaid-read";

import { shapeParts, type Part } from "./mermaidify/app/templates.ts";
import { bbox, densify, polyDist, type Box, type Point } from "./mermaidify/reader/geometry.ts";
import { escapeLabel, nodeText } from "./mermaidify/reader/mermaid.ts";
import type { Reading, ReadShape } from "./mermaidify/reader/recognize.ts";
import type { ShapeKind } from "./mermaidify/reader/shapes.ts";

/** What a stroke stands for in the graph. */
export type Mark = { node: Id } | { edge: Id } | { group: Id };
/** A stroke of the graph drawn: its points, the name of the shape or line it draws, and what it stands for. */
export type Drawn = Part & { mark: Mark };

/** The shapes a step is drawn as. */
export type StepShape = "rect" | "stadium" | "diamond" | "hexagon" | "trapezoid" | "circle" | "double";
/** The shape a step is drawn as: the one grooph writes it as in Mermaid. */
export function shapeOf(node: Node): StepShape {
  switch (node.kind) {
    case "agent":
      return isCriticFamily(node) ? "diamond" : isWriterFamily(node) ? "rect" : "stadium";
    case "check":
      return "hexagon";
    case "human-gate":
      return "trapezoid";
    case "merge":
      return "circle";
    case "stop":
      return "double";
  }
}

/**
 * What a shape makes of a step, as grooph's reader reads it (`mermaid-read.ts`): two shapes that make the same are
 * the same to a step drawn with one of them, so redrawing a box as a parallelogram leaves a builder a builder.
 */
const MEANS: Record<ShapeKind, string> = {
  rect: "agent",
  subroutine: "agent",
  "lean-right": "agent",
  "lean-left": "agent",
  "inv-trapezoid": "agent",
  triangle: "agent",
  "flip-triangle": "agent",
  stadium: "other agent",
  diamond: "critic",
  hexagon: "check",
  trapezoid: "human-gate",
  circle: "merge",
  double: "stop",
  bullseye: "stop",
  dot: "start",
};
const meaning = (node: Node): string => MEANS[shapeOf(node)];

/** The words a line is named with for an edge: its condition as grooph writes it in Mermaid, or its label. */
export function lineName(edge: Edge): string {
  const when = edge.when ?? "always";
  const said = [when === "always" ? "" : typeof when === "string" ? when : `verdict: ${when.verdict}`, edge.approval ? "approval" : ""].filter((s) => s !== "").join(", ");
  return said || edge.label || "";
}

/** Each kind's size in the drawing, at 100%: as the shapes mermaidify's Add menu draws, so a name fits. */
const SIZE: Record<StepShape, [number, number]> = {
  rect: [150, 64],
  stadium: [150, 60],
  diamond: [140, 104],
  hexagon: [150, 64],
  trapezoid: [170, 64],
  circle: [84, 84],
  double: [84, 84],
};
/**
 * How far apart the canvas's places are drawn: a canvas node is 200 by 84 with room round it, a shape smaller. A graph
 * with boxes of steps is drawn wider apart, so a box drawn round a step clears the steps beside it.
 */
const SPREAD: Point = [0.85, 0.9];
const BOXED: Point = [1, 1.2];

/** An arrow along a path, its head at the last point: as mermaidify's templates draw one. */
function arrowPart(path: Point[], name: string): Part {
  const line = densify(path, 3), tip = line[line.length - 1]!, from = path[path.length - 2]!;
  const a = Math.atan2(tip[1] - from[1], tip[0] - from[0]), b = 14;
  const barb = (s: number): Point => [tip[0] - b * Math.cos(a + s), tip[1] - b * Math.sin(a + s)];
  return { pts: [...line, ...densify([tip, barb(0.5), tip, barb(-0.5)], 2).slice(1)], ...(name ? { name } : {}), line: true };
}

/** Where a straight line from a box's middle toward a point leaves the box, a little outside it. */
function edgePoint(b: Box, toward: Point, gap = 7): Point {
  const dx = toward[0] - b.cx, dy = toward[1] - b.cy;
  const t = Math.min(dx ? b.w / 2 / Math.abs(dx) : Infinity, dy ? b.h / 2 / Math.abs(dy) : Infinity);
  const n = Math.hypot(dx, dy) || 1;
  return [b.cx + dx * t + (dx / n) * gap, b.cy + dy * t + (dy / n) * gap];
}

/** Whether a straight piece of line passes through a box grown by `pad`. */
function crosses(a: Point, b: Point, box: Box, pad = 8): boolean {
  const x0 = box.x0 - pad, x1 = box.x1 + pad, y0 = box.y0 - pad, y1 = box.y1 + pad;
  // Clipped to the box, one axis at a time (Liang and Barsky).
  let t0 = 0, t1 = 1;
  const dx = b[0] - a[0], dy = b[1] - a[1];
  for (const [p, q] of [[-dx, a[0] - x0], [dx, x1 - a[0]], [-dy, a[1] - y0], [dy, y1 - a[1]]] as const) {
    if (p === 0) {
      if (q < 0) return false;
    } else {
      const r = q / p;
      if (p < 0) t0 = Math.max(t0, r);
      else t1 = Math.min(t1, r);
      if (t0 > t1) return false;
    }
  }
  return true;
}

/**
 * The graph as strokes. `at` is where the canvas puts each node (its top left corner, as `resolvePositions` gives it);
 * the drawing keeps that arrangement, a little closer together.
 */
export function drawGraph(doc: Graph, at: Readonly<Record<Id, { x: number; y: number }>>): { parts: Drawn[]; unboxed: Id[] } {
  const out: Drawn[] = [];
  const boxes = new Map<Id, Box>();
  for (const node of doc.nodes) {
    const p = at[node.id] ?? { x: 0, y: 0 };
    const kind = shapeOf(node);
    const [w, h] = SIZE[kind];
    const spread = doc.groups?.length ? BOXED : SPREAD;
    const cx = (p.x + 100) * spread[0], cy = (p.y + 42) * spread[1];
    const name = node.name || node.id;
    const parts = kind === "double" ? [...shapeParts("circle", cx, cy, w, h, name), ...shapeParts("circle", cx, cy, w * 0.72, h * 0.72)] : shapeParts(kind, cx, cy, w, h, name);
    for (const part of parts) out.push({ ...part, mark: { node: node.id } });
    boxes.set(node.id, bbox(parts.flatMap((part) => part.pts)));
  }

  // The boxes of steps, around their members and the boxes inside them; inner ones first, so an outer one holds them.
  const groups = doc.groups ?? [];
  const groupBox = new Map<Id, Box>();
  const around = (group: Group, seen: Set<Id>): Box | undefined => {
    if (groupBox.has(group.id)) return groupBox.get(group.id);
    if (seen.has(group.id)) return undefined;
    seen.add(group.id);
    const inner = group.members.flatMap((id) => {
      const b = boxes.get(id) ?? (groups.find((g) => g.id === id) ? around(groups.find((g) => g.id === id)!, seen) : undefined);
      return b ? [b] : [];
    });
    if (inner.length === 0) return undefined;
    // Room for the box's name over its steps. A box round one oval or circle is drawn wider than twice it: the reader
    // takes a shape centered round a round one, and not much wider, for its second outline (a double circle).
    const one = inner.length === 1 && group.members.length === 1 ? doc.nodes.find((n) => n.id === group.members[0]) : undefined;
    const pad = 30, wide = one && ["stadium", "circle", "double"].includes(shapeOf(one)) ? inner[0]!.w * 0.55 : pad;
    const x0 = Math.min(...inner.map((b) => b.x0)) - wide, x1 = Math.max(...inner.map((b) => b.x1)) + wide;
    const y0 = Math.min(...inner.map((b) => b.y0)) - pad - 22, y1 = Math.max(...inner.map((b) => b.y1)) + pad;
    const box: Box = { x0, x1, y0, y1, w: x1 - x0, h: y1 - y0, cx: (x0 + x1) / 2, cy: (y0 + y1) / 2 };
    groupBox.set(group.id, box);
    return box;
  };
  // A box is drawn only where it holds its own steps and nothing else: the canvas places steps without their boxes in
  // mind, and a box drawn round a step that is not its own, or across one, would be read as holding it. A box that
  // cannot be drawn, or holds one that cannot, is left out of the drawing and kept as it is (`unboxed`).
  const byId = new Map(groups.map((g) => [g.id, g]));
  const stepsOf = (g: Group, seen = new Set<Id>()): Set<Id> => {
    seen.add(g.id);
    return new Set(g.members.flatMap((m) => (byId.has(m) ? (seen.has(m) ? [] : [...stepsOf(byId.get(m)!, seen)]) : [m])));
  };
  const meets = (a: Box, b: Box): boolean => a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;
  const drawnBoxes = new Map<Id, Box>();
  const decided = new Map<Id, boolean>();
  const decide = (g: Group, seen = new Set<Id>()): boolean => {
    if (decided.has(g.id)) return decided.get(g.id)!;
    if (seen.has(g.id)) return false;
    seen.add(g.id);
    const inner = g.members.filter((m) => byId.has(m));
    const innerDrawn = inner.map((m) => decide(byId.get(m)!, seen)).every(Boolean);
    const box = around(g, new Set());
    let ok = innerDrawn && box !== undefined;
    if (ok) {
      const grown: Box = { ...box!, x0: box!.x0 - 8, x1: box!.x1 + 8, y0: box!.y0 - 8, y1: box!.y1 + 8 };
      const mine = stepsOf(g), within = new Set(inner.flatMap((m) => [m, ...[...descendants(m)]]));
      ok = [...boxes].every(([id, b]) => mine.has(id) || !meets(b, grown)) && [...drawnBoxes].every(([id, b]) => within.has(id) || !meets(b, grown));
    }
    decided.set(g.id, ok);
    if (ok) drawnBoxes.set(g.id, box!);
    return ok;
  };
  function descendants(id: Id, seen = new Set<Id>()): Set<Id> {
    const g = byId.get(id);
    if (!g || seen.has(id)) return seen;
    seen.add(id);
    for (const m of g.members) if (byId.has(m)) descendants(m, seen);
    return seen;
  }
  const unboxed: Id[] = [];
  for (const group of groups) if (!decide(group)) unboxed.push(group.id);
  for (const group of groups) {
    const box = drawnBoxes.get(group.id);
    if (!box) continue;
    for (const part of shapeParts("rect", box.cx, box.cy, box.w, box.h, group.name || group.id)) out.push({ ...part, mark: { group: group.id } });
  }

  // The edges. Two between the same two steps are drawn side by side; one that would cross a shape goes round.
  const all = [...boxes.values()];
  const pairs = new Map<string, Edge[]>();
  for (const edge of doc.edges) {
    if (!boxes.has(edge.from) || !boxes.has(edge.to)) continue;
    const key = [edge.from, edge.to].sort().join("\u0000");
    (pairs.get(key) ?? pairs.set(key, []).get(key)!).push(edge);
  }
  const lanes = { right: 0, left: 0 };
  // Whether anything stands beside a box, in its row, on one side: a line out that side would cross it.
  const besideIt = (b: Box, side: "right" | "left"): boolean =>
    all.some((o) => o !== b && o.y1 > b.y0 && o.y0 < b.y1 && (side === "right" ? o.x0 >= b.x1 - 1 : o.x1 <= b.x0 + 1));
  for (const edge of doc.edges) {
    const a = boxes.get(edge.from), b = boxes.get(edge.to);
    if (!a || !b) continue;
    const name = lineName(edge);
    if (edge.from === edge.to) {
      // A step that leads to itself: a small loop out of its right side and back.
      const x = a.x1 + 7, far = a.x1 + 44;
      parts(edge, arrowPart([[x, a.cy - 16], [far, a.cy - 16], [far, a.cy + 16], [x, a.cy + 16]], name));
      continue;
    }
    const twins = pairs.get([edge.from, edge.to].sort().join("\u0000"))!;
    const side = twins.length > 1 ? (twins.indexOf(edge) - (twins.length - 1) / 2) * 30 * (edge.from < edge.to ? 1 : -1) : 0;
    const dx = b.cx - a.cx, dy = b.cy - a.cy, n = Math.hypot(dx, dy) || 1, ox = (-dy / n) * side, oy = (dx / n) * side;
    const sa = { ...a, cx: a.cx + ox, cy: a.cy + oy }, sb = { ...b, cx: b.cx + ox, cy: b.cy + oy };
    const p0 = edgePoint(sa, [sb.cx, sb.cy]), p1 = edgePoint(sb, [sa.cx, sa.cy]);
    if (!all.some((o) => o !== a && o !== b && crosses(p0, p1, o))) {
      parts(edge, arrowPart([p0, p1], name));
      continue;
    }
    // Round the side: back up the right, forward down the left, unless something stands in the way on that side.
    const up = b.cy <= a.cy;
    const free = (s: "right" | "left"): boolean => !besideIt(a, s) && !besideIt(b, s);
    const goes: "right" | "left" | undefined = free(up ? "right" : "left") ? (up ? "right" : "left") : free(up ? "left" : "right") ? (up ? "left" : "right") : undefined;
    if (!goes) {
      parts(edge, arrowPart([p0, p1], name));
      continue;
    }
    const lo = Math.min(a.y0, b.y0), hi = Math.max(a.y1, b.y1);
    const span = all.filter((o) => o.y1 > lo && o.y0 < hi);
    const k = lanes[goes]++;
    const x = goes === "right" ? Math.max(...span.map((o) => o.x1)) + 34 + 24 * k : Math.min(...span.map((o) => o.x0)) - 34 - 24 * k;
    const ax = goes === "right" ? a.x1 + 7 : a.x0 - 7, bx = goes === "right" ? b.x1 + 7 : b.x0 - 7;
    parts(edge, arrowPart([[ax, a.cy], [x, a.cy], [x, b.cy], [bx, b.cy]], name));
  }
  return { parts: out, unboxed };

  function parts(edge: Edge, part: Part): void {
    out.push({ ...part, mark: { edge: edge.id } });
  }
}

/**
 * The edges that close the cycles among `members` along `within`: a walk from the step the rest of the graph enters
 * them by (or the first), and each edge back to a step still on the walk.
 */
function closers(members: Id[], within: Edge[], all: Edge[]): Id[] {
  const inside = new Set(members);
  const out = new Map<Id, Edge[]>();
  for (const e of within) (out.get(e.from) ?? out.set(e.from, []).get(e.from)!).push(e);
  const entry = all.find((e) => !inside.has(e.from) && inside.has(e.to))?.to ?? members[0]!;
  const state = new Map<Id, "on" | "done">();
  const back: Id[] = [];
  const visit = (v: Id): void => {
    state.set(v, "on");
    for (const e of out.get(v) ?? []) {
      const at = state.get(e.to);
      if (at === "on") back.push(e.id);
      else if (!at) visit(e.to);
    }
    state.set(v, "done");
  };
  for (const v of [entry, ...members]) if (!state.has(v)) visit(v);
  return back;
}

/** Whether two graphs are the same document, whatever order their fields were written in. */
export function sameGraph(a: Graph, b: Graph): boolean {
  const canon = (x: unknown): unknown =>
    Array.isArray(x) ? x.map(canon) : x && typeof x === "object" ? Object.fromEntries(Object.keys(x).sort().map((k) => [k, canon((x as Record<string, unknown>)[k])])) : x;
  return JSON.stringify(canon(a)) === JSON.stringify(canon(b));
}

/** Which step, edge, or box the strokes of each shape, line, and box of a reading stand for, by the reading's ids. */
export type Marks = { nodes: Record<string, Id>; edges: Record<string, Id>; groups: Record<string, Id> };

export type Made = {
  doc: Graph;
  /** What was guessed of each new step and loop, one line each, in grooph's reader's words. */
  guesses: string[];
  /** What each shape, line, and box of the reading became. */
  became: Marks;
  /** Steps new to the graph, kept, and no longer drawn. */
  counts: { added: number; kept: number; removed: number };
  /** The drawing as Mermaid, as grooph's reader was handed it. */
  mermaid: string;
  /** A note on what the drawing holds that a graph has no place for. */
  left?: string;
};

/**
 * The graph a drawing makes, carried over from `old` as the head of this file says. `names` are the names typed for
 * shapes, lines, and boxes, by the reading's ids, and `marks` what their strokes stand for. `unboxed` are the boxes
 * `drawGraph` left out of the drawing: each is kept as it was, with the steps of it still drawn.
 */
export function makeGraph(reading: Reading, names: Readonly<Record<string, string>>, marks: Marks, old: Graph, unboxed: readonly Id[] = []): Made | { error: string } {
  // A start dot is no step: a run starts at the steps nothing leads to. An end ring is a stop.
  const dots = new Set(reading.nodes.filter((n) => n.kind === "dot").map((n) => n.id));
  const shapes = reading.nodes.filter((n) => !dots.has(n.id)).map((n): ReadShape => (n.kind === "bullseye" ? { ...n, kind: "double" } : n));
  if (shapes.length === 0) return { error: dots.size ? "Only a start dot was read. Draw the steps, like a box or a diamond, and the arrows between them." : "No shapes were read. Draw a closed shape, like a box or a circle." };
  // A line that ends on a box ends at the step in it nearest that end: a box is no step, and an arrow drawn into a
  // box of steps goes to one of them.
  const boxes = new Map(reading.groups.map((g) => [g.id, g]));
  const outline = new Map([...shapes, ...reading.groups].map((x) => [x.id, x.poly]));
  const holds = (g: string, s: ReadShape): boolean => {
    for (let at = s.parent; at !== null; at = boxes.get(at)?.parent ?? null) if (at === g) return true;
    return false;
  };
  const endOn = (line: Reading["edges"][number], id: string, other: string): Point => {
    const ends = [line.pts[0]!, line.pts[line.pts.length - 1]!];
    if (id === other) return id === line.from ? ends[0]! : ends[1]!;
    const near = (p: Point) => polyDist(p, outline.get(id) ?? []) - polyDist(p, outline.get(other) ?? []);
    return near(ends[0]!) <= near(ends[1]!) ? ends[0]! : ends[1]!;
  };
  // Not the step at the line's other end: a line from a step to the edge of its own box leads out of it, to nothing.
  const stepIn = (g: string, at: Point, other: string): string | undefined =>
    shapes.filter((s) => holds(g, s) && s.id !== other).sort((a, b) => polyDist(at, a.poly) - polyDist(at, b.poly))[0]?.id;
  let unended = 0;
  const lines = reading.edges
    .filter((e) => !dots.has(e.from) && !dots.has(e.to))
    .flatMap((e) => {
      const from = boxes.has(e.from) ? stepIn(e.from, endOn(e, e.from, e.to), e.to) : e.from;
      const to = boxes.has(e.to) ? stepIn(e.to, endOn(e, e.to, e.from), e.from) : e.to;
      if (from && to) return [{ ...e, from, to }];
      unended++;
      return [];
    });
  const typed = (id: string): string => names[id]?.replace(/\s+/g, " ").trim() ?? "";

  // Each shape's step: the one its strokes stand for, then the one of its name, then a new one.
  const before = new Map(old.nodes.map((n) => [n.id, n]));
  const step = new Map<string, Node>();
  const claimed = new Set<Id>();
  for (const s of shapes) {
    const id = marks.nodes[s.id];
    const was = id === undefined ? undefined : before.get(id);
    if (was && !claimed.has(was.id)) (step.set(s.id, was), claimed.add(was.id));
  }
  for (const s of shapes) {
    if (step.has(s.id) || !typed(s.id)) continue;
    const same = old.nodes.filter((n) => !claimed.has(n.id) && (n.name || n.id) === typed(s.id));
    if (same.length === 1) (step.set(s.id, same[0]!), claimed.add(same[0]!.id));
  }
  const nameOf = (s: ReadShape): string => typed(s.id) || (step.get(s.id)?.name ?? "") || s.label;
  const oldGroups = new Map((old.groups ?? []).map((g) => [g.id, g]));
  const groupName = (g: ReadShape): string => typed(g.id) || oldGroups.get(marks.groups[g.id] ?? "")?.name || g.label;

  // The drawing as Mermaid, by the reading's own ids, which grooph's reader makes lower case. Its boxes are made
  // groups below and not written: grooph's reader takes a box that holds a cycle for a loop, as its own export writes
  // one, and a box drawn round a subgrooph's steps holds its loop.
  const text = ["flowchart TD", ...shapes.map((s) => `  ${nodeText(s.id, s.kind, escapeLabel(nameOf(s)))}`)];
  // A line both ways is two edges; each written line remembers the line it came from.
  const written: { line: (typeof lines)[number]; from: string; to: string }[] = [];
  for (const e of lines)
    for (const [from, to] of e.both ? [[e.from, e.to], [e.to, e.from]] : [[e.from, e.to]]) {
      const said = typed(e.id);
      text.push(`  ${from} -->${said ? `|"${escapeLabel(said)}"|` : ""} ${to}`);
      written.push({ line: e, from: from!.toLowerCase(), to: to!.toLowerCase() });
    }
  const mermaid = text.join("\n");
  const read = readMermaid(mermaid, { name: "sketch read" });
  if (!read.ok) return { error: `grooph could not read the drawing: ${read.error}` };
  const fresh = read.doc;

  // The ids: a step keeps its own, and a new one is named for its name.
  const taken = allIds(old);
  const take = (base: string): Id => {
    const id = uniqueId(base, taken);
    taken.add(id);
    return id;
  };
  const became: Marks = { nodes: {}, edges: {}, groups: {} };
  const final = new Map<Id, Id>(); // the fresh document's id → the graph's
  const nodes: Node[] = [];
  // The names whose guesses are not said: of steps, loops, and boxes the graph had, which keep what they were.
  const quiet = new Set<string>();
  let added = 0;
  for (const s of shapes) {
    const made = fresh.nodes.find((n) => n.id === s.id.toLowerCase());
    if (!made) continue;
    const was = step.get(s.id);
    const name = nameOf(s);
    let node: Node;
    if (was && meaning(was) === MEANS[s.kind]) {
      node = { ...was, name };
      quiet.add(name);
    } else if (was && was.kind === "agent" && made.kind === "agent") node = { ...was, name, role: made.role };
    else if (was) node = { ...made, id: was.id, name } as Node;
    else {
      node = { ...made, id: take(slugify(name, "step")), name } as Node;
      added++;
    }
    final.set(made.id, node.id);
    became.nodes[s.id] = node.id;
    nodes.push(node);
  }

  // The graph's own order for what it had, then what is new in the drawing's.
  const rank = <T extends { id: Id }>(list: T[], was: readonly { id: Id }[]): T[] => {
    const at = new Map(was.map((x, i) => [x.id, i]));
    return list.map((x, i) => [x, at.get(x.id) ?? was.length + i] as const).sort((a, b) => a[1] - b[1]).map(([x]) => x);
  };

  // The edges: one between two steps that had one is that one, its condition kept unless its line was renamed.
  const oldEdges = old.edges.filter((e) => claimed.has(e.from) && claimed.has(e.to));
  const usedEdges = new Set<Id>();
  const usedLines = new Set<number>();
  const edgeIds = new Map<Id, Id>();
  const edges: Edge[] = [];
  for (const read of fresh.edges) {
    const from = final.get(read.from), to = final.get(read.to);
    if (!from || !to) continue;
    const k = written.findIndex((w, i) => !usedLines.has(i) && w.from === read.from && w.to === read.to);
    if (k >= 0) usedLines.add(k);
    const line = k >= 0 ? written[k]!.line : undefined;
    // A name that is no condition is the edge's label, as it was typed: Mermaid's reader takes its backticks for Markdown.
    const made: Edge = read.label !== undefined && line && typed(line.id) ? { ...read, label: typed(line.id) } : read;
    const marked = line ? marks.edges[line.id] : undefined;
    const candidates = oldEdges.filter((e) => !usedEdges.has(e.id) && e.from === from && e.to === to);
    const was = candidates.find((e) => e.id === marked) ?? candidates[0];
    let edge: Edge;
    if (was) {
      usedEdges.add(was.id);
      // A line drawn for the edge, or named since, says its condition; a line drawn anew with no name leaves it.
      const renamed = line !== undefined && (marked === was.id || typed(line.id) !== "") && typed(line.id) !== lineName(was);
      if (!renamed) edge = was;
      else {
        const { when: _when, approval: _approval, label: _label, ...rest } = was;
        edge = { ...rest, ...(made.when !== undefined ? { when: made.when } : {}), ...(made.approval ? { approval: true } : {}), ...(made.label !== undefined ? { label: made.label } : {}) };
      }
    } else edge = { ...made, id: take(`${from}-to-${to}`), from, to };
    edgeIds.set(read.id, edge.id);
    if (line && became.edges[line.id] === undefined) became.edges[line.id] = edge.id;
    edges.push(edge);
  }

  // The loops. One the graph had stays as it was while its steps and its ways back are all still drawn: a drawing
  // shows a cycle, not which loops it was cut into, so a loop inside another is kept so. A cycle no such loop holds is
  // a loop as grooph's reader makes it, with the name, stops, and bar of the loop it mostly is, if there was one.
  const edgeSet = new Set(edges.map((e) => e.id));
  const stepSet = new Set(nodes.map((n) => n.id));
  const loops: Loop[] = old.loops.filter((l) => l.back.every((id) => edgeSet.has(id)) && l.members.every((id) => stepSet.has(id)));
  const unkept = old.loops.filter((l) => !loops.includes(l));
  for (const l of loops) quiet.add(l.name);
  for (const made of fresh.loops) {
    const members = made.members.map((id) => final.get(id)).filter((id): id is Id => id !== undefined);
    const back = made.back.map((id) => edgeIds.get(id)).filter((id): id is Id => id !== undefined);
    if (members.length === 0 || back.length === 0) continue;
    const held = new Set(loops.filter((l) => l.members.some((m) => members.includes(m))).flatMap((l) => l.members));
    if (members.every((m) => held.has(m))) {
      quiet.add(made.name);
      continue;
    }
    // A cycle the kept loops' ways back already break is those loops with steps drawn into them: the steps join the
    // largest whose way back is in the cycle, which keeps its ways back and its stops. A cycle they do not break is a
    // loop of its own, round or beside them, its ways back the edges that close what is left.
    const inCycle = new Set(members);
    const keptBack = new Set(loops.flatMap((l) => l.back));
    const own = closers(members, edges.filter((e) => inCycle.has(e.from) && inCycle.has(e.to) && !keptBack.has(e.id)), edges);
    if (own.length === 0) {
      const inside = (id: Id): boolean => edges.some((e) => e.id === id && inCycle.has(e.from) && inCycle.has(e.to));
      const into = loops.filter((l) => l.back.some(inside)).sort((a, b) => b.members.length - a.members.length)[0];
      if (into) loops[loops.indexOf(into)] = { ...into, members: [...into.members, ...members.filter((m) => !into.members.includes(m))] };
      quiet.add(made.name);
      continue;
    }
    const overlap = (l: Loop): number => l.members.filter((m) => members.includes(m)).length / new Set([...l.members, ...members]).size;
    const best = unkept.filter((l) => overlap(l) >= 0.5).sort((x, y) => overlap(y) - overlap(x))[0];
    if (best) {
      unkept.splice(unkept.indexOf(best), 1);
      quiet.add(made.name);
      loops.push({ ...best, members, back: own });
    } else loops.push({ ...made, id: take(`${members[0]}-loop`), members, back: own });
  }

  // The boxes: one drawn with a box's strokes is that box, keeping its template and what else it was, with its
  // members as drawn (the steps and boxes it holds nearest), in the order it had them.
  const claimedGroups = new Set<Id>();
  const boxGuesses: string[] = [];
  const groupIds = new Map<string, Id>(); // the reading's box id → the graph's
  for (const g of reading.groups) {
    const marked = marks.groups[g.id];
    const was = marked !== undefined && !claimedGroups.has(marked) ? oldGroups.get(marked) : undefined;
    if (was) claimedGroups.add(was.id);
    groupIds.set(g.id, was ? was.id : take(slugify(groupName(g), "box")));
  }
  const stepIds = new Map(shapes.map((s) => [s.id, became.nodes[s.id]]));
  const groups: Group[] = reading.groups.flatMap((g) => {
    const id = groupIds.get(g.id)!;
    const held = [...shapes.filter((s) => s.parent === g.id).map((s) => stepIds.get(s.id)), ...reading.groups.filter((h) => h.parent === g.id).map((h) => groupIds.get(h.id))];
    const was = oldGroups.get(id);
    const order = new Map((was?.members ?? []).map((m, k) => [m, k]));
    const members = held.filter((m): m is Id => m !== undefined).map((m, k) => [m, order.get(m) ?? 1e6 + k] as const).sort((a, b) => a[1] - b[1]).map(([m]) => m);
    if (members.length === 0) return [];
    became.groups[g.id] = id;
    const name = groupName(g);
    if (!was) boxGuesses.push(`${name}: a box drawn round steps, so a group`);
    return [was ? { ...was, name, members } : { id, name, members }];
  });
  // The boxes left out of the drawing, kept as they were, holding what of them is still drawn.
  const carried = new Set((old.groups ?? []).filter((g) => unboxed.includes(g.id) && !claimedGroups.has(g.id)).map((g) => g.id));
  const stepsNow = new Set(nodes.map((n) => n.id));
  for (const g of old.groups ?? []) {
    if (!carried.has(g.id)) continue;
    const members = g.members.filter((m) => stepsNow.has(m) || carried.has(m) || claimedGroups.has(m));
    if (members.length) groups.push(members.length === g.members.length ? g : { ...g, members });
  }

  // What pointed at what is gone points at nothing: a policy on it goes, and a stop that went on to it stops there.
  const live = new Set<Id>([old.id, ...nodes.map((n) => n.id), ...edges.map((e) => e.id), ...loops.map((l) => l.id), ...groups.map((g) => g.id)]);
  const policies = (old.policies ?? []).filter((p: Policy) => p.scope === "graph" || live.has(p.scope.slice(p.scope.indexOf(":") + 1)));
  // A judge's answer key that came from a step no longer drawn comes from nowhere, as when the canvas removes the step.
  const barOf = (l: Loop): Loop => (l.bar?.answerKeyFrom !== undefined && !live.has(l.bar.answerKeyFrom) ? { ...l, bar: (({ answerKeyFrom: _gone, ...rest }) => rest)(l.bar) } : l);
  const stopsOf = (l: Loop): Stop[] => l.stops.map((s) => (s.then !== undefined && !live.has(s.then) ? (({ then: _then, ...rest }) => rest as Stop)(s) : s));
  const layout = old.layout ? Object.fromEntries(Object.entries(old.layout).filter(([id]) => live.has(id))) : undefined;

  // The graph's own fields, in its own order: a graph the drawing leaves as it was is the same document.
  const doc: Graph = { ...old, nodes: rank(nodes, old.nodes), edges: rank(edges, old.edges), loops: rank(loops, old.loops).map((l) => ({ ...barOf(l), stops: stopsOf(l) })) };
  if (policies.length) doc.policies = policies;
  else delete doc.policies;
  if (groups.length) doc.groups = rank(groups, old.groups ?? []);
  else delete doc.groups;
  if (layout && Object.keys(layout).length) doc.layout = layout;
  else delete doc.layout;
  const checked = parseGraph(doc);
  if (!checked.doc) return { error: `The drawing made a graph grooph cannot keep: ${checked.issues[0]?.message ?? "it does not match the schema"}` };

  // The guesses are of what is new: a step kept keeps what it was, and a loop kept its stops.
  // A stadium is Mermaid's word for the shape; here it was drawn, as an oval.
  const guesses = [...read.guesses.filter((g) => !quiet.has(g.slice(0, g.indexOf(": ")))).map((g) => g.replace(": a stadium, so ", ": an oval, so ")), ...boxGuesses];
  const left =
    [
      dots.size ? `${dots.size === 1 ? "The start dot is" : `${dots.size} start dots are`} not a step: a run starts at the steps nothing leads to.` : "",
      unended ? `${unended === 1 ? "A line that ends" : `${unended} lines that end`} on a box with no other step in it ${unended === 1 ? "was" : "were"} left out.` : "",
    ]
      .filter(Boolean)
      .join(" ") || undefined;
  return { doc, guesses, became, counts: { added, kept: claimed.size, removed: old.nodes.length - claimed.size }, mermaid, ...(left ? { left } : {}) };
}
