/**
 * The Sketch view: a graph drawn by hand, and the drawing made a graph. It is mermaidify's Draw page (its `main.ts`,
 * from the release `mermaidify/SOURCE.json` names), brought over whole and changed only where a grooph graph asks:
 * its tools, its inks, its Add and More menus, choosing and moving strokes, Snap, names written on the drawing,
 * full screen, the keys, and the line under the drawing of what was read. Below the drawing, where mermaidify draws
 * its diagram, is the graph: its picture, what was guessed of each new step, the names, and the graph as Mermaid.
 *
 * **The drawing and the graph.** The view opens on the graph drawn (`graph.ts`), or on the drawing kept for it when
 * the graph has not changed since. Make it a graph reads the drawing and makes the graph what it says, carrying over
 * all a drawing cannot say; the editor keeps that as one change, which Undo in the graph's panel takes back. A name
 * typed after that, on the drawing or in Names, changes the graph as it is typed. A graph changed elsewhere (a step
 * added on the canvas, say) is drawn again when the view next has it, and Undo brings back the drawing it replaced.
 *
 * Each stroke is marked with the step, edge, or box it was drawn for (`graph.ts`), and the mark follows the stroke as
 * a name does in mermaidify: through a cut, an erase and its undo, and a shape erased and drawn again in its place. A
 * copy is a new step, and carries no mark.
 */
import { mermaid, type Graph, type Id } from "@grooph/core";

import { download } from "../../doc/exportPackage.js";
import { pictureName, pictureSvg, svgToPng } from "../../doc/keep.js";
import { themes, wanted } from "../../doc/look.js";
import { drawGraph, lineName, makeGraph, sameGraph, shapeOf, type Drawn, type Made, type Mark, type Marks } from "./graph.ts";
import { MARKUP } from "./markup.ts";
import { cut } from "./mermaidify/app/cut.ts";
import { fromFile, toFile, type DrawingFile } from "./mermaidify/app/drawing.ts";
import { createPad, type ChooseBy, type DrawnStroke, type NameTag, type Tool } from "./mermaidify/app/pad.ts";
import { boxOf, copyStrokes } from "./mermaidify/app/select.ts";
import { ADDABLE, TEMPLATES, shapeParts, type AddKind, type Part } from "./mermaidify/app/templates.ts";
import { snapChosen } from "./mermaidify/app/tidy.ts";
import { exampleStrokes } from "./mermaidify/example.ts";
import { halfway, inside, lineDist, type Point } from "./mermaidify/reader/geometry.ts";
import { recognize, type Reading, type ReadEdge, type ReadShape } from "./mermaidify/reader/recognize.ts";
import { TEMPLATES as OUTLINES, type ShapeKind } from "./mermaidify/reader/shapes.ts";
import { cleanArrow } from "./mermaidify/reader/snap.ts";

/** What the view is handed by the editor it is in. */
export interface StudioHost {
  /** Where the drawing of this graph is kept between visits: the graph's key in the library. */
  key: string;
  /** The graph as it is now. */
  doc(): Graph;
  /** Where the canvas puts each node, which the drawing of a graph keeps. */
  places(doc: Graph): Record<Id, { x: number; y: number }>;
  /** Make the graph this, as one change; `typing` when it follows a name being typed, which joins the change before. */
  apply(next: Graph, typing: boolean): void;
  /** Open a step's sheet: a tap on it in the picture. */
  open(id: Id): void;
  /** Open the Export panel. */
  exporting(): void;
}

export interface Studio {
  /** The graph changed: by this view, or elsewhere while it was open. */
  update(doc: Graph): void;
  /** Let go of everything outside the view's own markup. */
  destroy(): void;
}

const INKS = [
  { key: "ink", name: "Ink" },
  { key: "green", name: "Green" },
  { key: "blue", name: "Blue" },
  { key: "red", name: "Red" },
  { key: "amber", name: "Amber" },
];
const WORDS: Record<string, [string, string]> = {
  rect: ["box", "boxes"],
  subroutine: ["box in a box", "boxes in boxes"],
  stadium: ["oval", "ovals"],
  circle: ["circle", "circles"],
  double: ["double circle", "double circles"],
  diamond: ["diamond", "diamonds"],
  hexagon: ["hexagon", "hexagons"],
  trapezoid: ["trapezoid", "trapezoids"],
  "inv-trapezoid": ["trapezoid wide at the top", "trapezoids wide at the top"],
  "lean-right": ["parallelogram", "parallelograms"],
  "lean-left": ["parallelogram leaning left", "parallelograms leaning left"],
  triangle: ["triangle", "triangles"],
  "flip-triangle": ["triangle pointing down", "triangles pointing down"],
  dot: ["start dot", "start dots"],
  bullseye: ["end ring", "end rings"],
};
/** The shapes a step can be, in the order the shape menu lists them, each with what grooph makes of it. */
const SHAPES: [ShapeKind, string][] = [
  ["rect", "Agent: box"],
  ["stadium", "Researcher: oval"],
  ["diamond", "Critic: diamond"],
  ["hexagon", "Check: hexagon"],
  ["trapezoid", "Human gate: trapezoid"],
  ["circle", "Merge: circle"],
  ["double", "Stop: double circle"],
  ["subroutine", "Agent: box in a box"],
  ["lean-right", "Agent: parallelogram"],
  ["lean-left", "Agent: parallelogram, leaning left"],
  ["inv-trapezoid", "Agent: trapezoid, wide at the top"],
  ["triangle", "Agent: triangle"],
  ["flip-triangle", "Agent: triangle, pointing down"],
];
/** What the Add menu draws, as grooph names the step each shape makes. */
const STEPS: { kind: AddKind | "double"; label: string; w: number; h: number }[] = [
  { kind: "rect", label: "Agent", w: 150, h: 64 },
  { kind: "stadium", label: "Researcher", w: 150, h: 60 },
  { kind: "diamond", label: "Critic", w: 140, h: 104 },
  { kind: "hexagon", label: "Check", w: 150, h: 64 },
  { kind: "trapezoid", label: "Human gate", w: 170, h: 64 },
  { kind: "circle", label: "Merge", w: 84, h: 84 },
  { kind: "double", label: "Stop", w: 84, h: 84 },
];
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** The keys the drawing of each graph is kept under, newest last, and how many are kept. */
const KEPT = "groophSketch.v1", KEEP_AT_MOST = 16;
type Kept = { file: DrawingFile; marks: (Mark | null)[]; synced: string; unboxed: Id[] };
/** What a drawing shows of a graph: its steps' names and shapes, its edges, and its boxes. Briefs and the rest are not drawn. */
type Skeleton = { nodes: { id: Id; name: string; shape: string }[]; edges: { id: Id; from: Id; to: Id; name: string }[]; groups: { id: Id; name: string; members: Id[] }[] };
const skeleton = (doc: Graph): Skeleton => ({
  nodes: doc.nodes.map((n) => ({ id: n.id, name: n.name || n.id, shape: shapeOf(n) })),
  edges: doc.edges.map((e) => ({ id: e.id, from: e.from, to: e.to, name: lineName(e) })),
  groups: (doc.groups ?? []).map((g) => ({ id: g.id, name: g.name || g.id, members: g.members })),
});
const shown = (doc: Graph): string => JSON.stringify(skeleton(doc));
/**
 * Whether a graph shows what it showed before but for names and ids: a step renamed in its sheet, whose id follows its
 * name, or an edge given another condition. Then each old id's new one, by place; otherwise null, and the graph is
 * drawn again.
 */
function renamed(was: string, now: Skeleton): Map<Id, Id> | null {
  let before: Skeleton;
  try {
    before = JSON.parse(was) as Skeleton;
  } catch {
    return null;
  }
  if (!Array.isArray(before?.nodes) || !Array.isArray(before.edges) || !Array.isArray(before.groups)) return null;
  if (before.nodes.length !== now.nodes.length || before.edges.length !== now.edges.length || before.groups.length !== now.groups.length) return null;
  const ids = new Map<Id, Id>();
  for (const [i, n] of before.nodes.entries()) {
    if (n.shape !== now.nodes[i]!.shape) return null;
    ids.set(n.id, now.nodes[i]!.id);
  }
  for (const [i, g] of before.groups.entries()) ids.set(g.id, now.groups[i]!.id);
  for (const [i, e] of before.edges.entries()) {
    const a = now.edges[i]!;
    if (ids.get(e.from) !== a.from || ids.get(e.to) !== a.to) return null;
    ids.set(e.id, a.id);
  }
  for (const [i, g] of before.groups.entries()) if (JSON.stringify(g.members.map((m) => ids.get(m))) !== JSON.stringify(now.groups[i]!.members)) return null;
  return ids;
}

function loadKept(key: string): Kept | null {
  try {
    const raw = localStorage.getItem(`${KEPT}:${key}`);
    if (!raw) return null;
    const saved = JSON.parse(raw) as { file: unknown; marks?: unknown; synced?: unknown; unboxed?: unknown };
    const r = fromFile(saved.file);
    if (!r.ok) return null;
    const marks = Array.isArray(saved.marks) && saved.marks.length === r.file.strokes.length ? (saved.marks as (Mark | null)[]) : r.file.strokes.map(() => null);
    const unboxed = Array.isArray(saved.unboxed) ? (saved.unboxed as unknown[]).filter((id): id is Id => typeof id === "string") : [];
    return { file: r.file, marks, synced: typeof saved.synced === "string" ? saved.synced : "", unboxed };
  } catch {
    return null;
  }
}
function keepFor(key: string, kept: Kept | null): void {
  try {
    const order = (JSON.parse(localStorage.getItem(KEPT) ?? "[]") as string[]).filter((k) => typeof k === "string" && k !== key);
    if (kept) {
      localStorage.setItem(`${KEPT}:${key}`, JSON.stringify(kept));
      order.push(key);
    } else localStorage.removeItem(`${KEPT}:${key}`);
    while (order.length > KEEP_AT_MOST) localStorage.removeItem(`${KEPT}:${order.shift()}`);
    localStorage.setItem(KEPT, JSON.stringify(order));
  } catch {
    // Kept for this visit only, then: a browser that keeps nothing still draws.
  }
}

export function mountStudio(root: HTMLElement, host: StudioHost): Studio {
  root.classList.add("sk");
  root.innerHTML = MARKUP;
  /** The view has gone: the drawing surface may still be told of a size change, and an awaited picture may come. */
  let dead = false;
  const $ = <T extends HTMLElement = HTMLElement>(id: string) => root.querySelector<T>(`#sk-${id}`)!;
  // Listeners outside the view's own markup, let go when it goes.
  const offs: (() => void)[] = [];
  type Events = DocumentEventMap & WindowEventMap;
  const listen = <K extends keyof Events>(target: Document | Window, type: K, fn: (e: Events[K]) => void, options?: AddEventListenerOptions) => {
    target.addEventListener(type, fn as EventListener, options);
    offs.push(() => target.removeEventListener(type, fn as EventListener, options));
  };
  const timers: Record<string, ReturnType<typeof setTimeout>> = {};
  function debounce(key: string, f: () => void, ms: number) {
    clearTimeout(timers[key]);
    timers[key] = setTimeout(f, ms);
  }

  const state = {
    strokes: [] as DrawnStroke[],
    undo: [] as DrawnStroke[][],
    redo: [] as DrawnStroke[][],
    reading: null as Reading | null,
    /** The strokes changed since the last reading. */
    stale: false,
    labels: {} as Record<string, string>,
    tool: "draw" as Tool,
    color: "ink",
    /** The graph this view last made, or last drew: what a change from elsewhere is told by. */
    synced: "",
    /** What the last Make it a graph made, while the graph is still that. */
    made: null as (Made & { at: Graph; before: Graph; changed: boolean }) | null,
    /** The graph's boxes the drawing of it left out (`drawGraph`), which Make it a graph keeps as they are. */
    unboxed: [] as Id[],
  };

  // ─── the drawing ───────────────────────────────────────────────────────────
  const canvas = $<HTMLCanvasElement>("pad");
  /** What was cut or copied: the strokes, and the names and choices kept against them, by stroke id. */
  let clip: { strokes: DrawnStroke[]; kept: Map<number, unknown>[] } | null = null, pastes = 0;
  const selBar = $("sel-bar");
  const pad = createPad(canvas, {
    begin() {
      $("hint").hidden = true;
    },
    select() {
      placeSelBar();
    },
    edit(next) {
      commit(next);
      placeSelBar();
    },
    stroke(...added) {
      commit([...state.strokes, ...added]);
    },
    erase(ids) {
      const gone = new Set(ids);
      commit(state.strokes.filter((s) => !gone.has(s.id)));
    },
    cut(path, r) {
      const done = cut(state.strokes, path, r, pad.nextId);
      if (!done.pieces.size) return;
      // What is left of a stroke keeps its names, choices, and marks: a box cut free of its line is still its step.
      const kept = [...keptMaps(), ...markMaps()];
      for (const [was, now] of done.pieces) {
        cutInto.set(was, now);
        for (const id of now) cutFrom.set(id, was);
        for (const m of kept) if (m.has(was)) for (const id of now) m.set(id, m.get(was));
      }
      commit(done.strokes);
    },
    tap(p) {
      if (!state.strokes.length) return;
      // A shape first, then a line, and only then the box around them, so a line inside a box can be named too. A
      // tap on none of them puts away what was read, if it is showing.
      const at = (m: Reading) => shapeAt(p, "nodes", m) ?? lineAt(p, m) ?? shapeAt(p, "groups", m);
      const fresh = !!state.reading && !state.stale;
      if (!at(fresh ? state.reading! : reading())) {
        if (pad.overlaid) pad.setOverlay(null);
        return;
      }
      // What was read comes back, if it was put away, so the shape being named shows.
      if (!fresh) readDrawing();
      else if (!pad.overlaid) pad.setOverlay({ reading: state.reading!, labels: state.labels });
      const hit = at(state.reading!);
      if (hit && "kind" in hit && hit.kind === "dot") tell("A start dot is not a step: a run starts at the steps nothing leads to.");
      else if (hit) openNameEditor(hit);
    },
    empty() {
      if (pad.overlaid) pad.setOverlay(null);
    },
    penMode(on) {
      $("pen-chip").hidden = !on;
    },
    view(v) {
      if (dead) return;
      const zoom = $("zoom");
      zoom.hidden = Math.abs(v.scale - 1) < 0.01;
      zoom.textContent = Math.round(v.scale * 100) + "%";
      closeNameEditor(true);
      placeSelBar();
    },
  });

  function commit(next: DrawnStroke[]) {
    state.undo.push(state.strokes);
    if (state.undo.length > 200) state.undo.shift();
    state.redo = [];
    setStrokes(next);
  }
  function setStrokes(next: DrawnStroke[]) {
    state.strokes = next;
    pad.setStrokes(next);
    state.stale = true;
    $("go").dataset["stale"] = String(next.length > 0);
    $("hint").hidden = next.length > 0;
    $<HTMLButtonElement>("undo").disabled = !state.undo.length;
    $<HTMLButtonElement>("clear").disabled = !next.length;
    $<HTMLButtonElement>("redo").disabled = !state.redo.length;
    pad.setOverlay(null);
    closeNameEditor(true);
    placeSelBar();
    persist();
    debounce("names", showNameTags, 120);
  }
  function undo() {
    const prev = state.undo.pop();
    if (!prev) return;
    state.redo.push(state.strokes);
    setStrokes(prev);
  }
  function redo() {
    const next = state.redo.pop();
    if (!next) return;
    state.undo.push(state.strokes);
    setStrokes(next);
  }
  $("undo").addEventListener("click", undo);
  $("redo").addEventListener("click", redo);

  // The tools and the inks. The eraser takes whole strokes or only what it passes over, and the select tool chooses by
  // a box or by a lasso: a tool already in use, tapped again, opens its kinds, and each kind chosen is kept for next time.
  const toolButtons = Array.from(root.querySelectorAll<HTMLButtonElement>("button[data-tool]"));
  const ERASE_KEY = "groophSketch.eraser", CHOOSE_KEY = "groophSketch.select";
  let eraseKind: "whole" | "part" = "whole", chooseBy: ChooseBy = "box";
  try {
    if (localStorage.getItem(ERASE_KEY) === "part") eraseKind = "part";
    if (localStorage.getItem(CHOOSE_KEY) === "lasso") chooseBy = "lasso";
  } catch {
    // The first kinds, then.
  }
  pad.setChooseBy(chooseBy);
  /** The tool a toolbar button stands for: the eraser button is either eraser. */
  const toolOf = (b: HTMLButtonElement): Tool => (b.dataset["tool"] === "erase" && eraseKind === "part" ? "cut" : (b.dataset["tool"] as Tool));
  function setTool(t: Tool) {
    state.tool = t;
    pad.setTool(t);
    const on = t === "cut" ? "erase" : t;
    for (const b of toolButtons) b.setAttribute("aria-checked", String(b.dataset["tool"] === on));
    toolMenu.open(false);
    placeSelBar();
  }
  const TOOL_KINDS = {
    eraser: [
      ["whole", "Erase whole strokes", "A touch takes the whole stroke"],
      ["part", "Erase only what it passes over", "Cuts a line apart from its box"],
    ],
    select: [
      ["box", "Drag a box", "Takes every stroke the box reaches into"],
      ["lasso", "Draw a lasso", "Takes every stroke the loop reaches into"],
    ],
  } as const;
  const toolList = $("tool-menu");
  let toolFor: keyof typeof TOOL_KINDS = "eraser";
  const toolMenu = {
    list: toolList,
    open(on: boolean, focus = true) {
      toolList.hidden = !on;
      if (on && focus) toolList.querySelector<HTMLButtonElement>('[aria-checked="true"]')?.focus();
    },
    get isOpen() {
      return !toolList.hidden;
    },
  };
  /** Opens the kinds of the eraser or the select tool under its button. */
  function openToolMenu(which: keyof typeof TOOL_KINDS, button: HTMLButtonElement, focus: boolean) {
    toolFor = which;
    const now = which === "eraser" ? eraseKind : chooseBy;
    toolList.setAttribute("aria-label", which === "eraser" ? "Eraser" : "Select");
    toolList.innerHTML = TOOL_KINDS[which]
      .map(([k, label, note]) => `<li role="none"><button type="button" role="menuitemradio" aria-checked="${k === now}" data-kind="${k}">${label}<small>${note}</small></button></li>`)
      .join("");
    // Under its own button, within the bar.
    const bar = button.closest(".sk-tools")!.getBoundingClientRect(), at = button.getBoundingClientRect();
    toolList.style.left = narrow() ? "" : `${Math.max(0, at.left - bar.left)}px`;
    for (const m of menus) m.open(false);
    toolMenu.open(true, focus);
  }
  /** Whether the view is narrow enough that its toolbar takes two rows and its menus the bar's width. */
  const narrow = () => root.clientWidth < 720;
  function setToolKind(which: keyof typeof TOOL_KINDS, kind: string) {
    if (which === "eraser") {
      eraseKind = kind === "part" ? "part" : "whole";
      setTool(eraseKind === "part" ? "cut" : "erase");
    } else {
      chooseBy = kind === "lasso" ? "lasso" : "box";
      pad.setChooseBy(chooseBy);
      setTool("select");
    }
    try {
      localStorage.setItem(which === "eraser" ? ERASE_KEY : CHOOSE_KEY, kind);
    } catch {
      // Kept for this visit, then.
    }
  }
  for (const b of toolButtons)
    b.addEventListener("click", (e) => {
      const t = toolOf(b), which = b.dataset["options"] as keyof typeof TOOL_KINDS | undefined;
      // A press of the keyboard opens the kinds with the first one in focus; a tap just shows them.
      if (which && state.tool === t) {
        if (toolMenu.isOpen && toolFor === which) toolMenu.open(false);
        else openToolMenu(which, b, e.detail === 0);
      } else setTool(t);
    });
  toolList.addEventListener("click", (e) => {
    const k = (e.target as Element).closest<HTMLButtonElement>("[data-kind]")?.dataset["kind"];
    if (!k) return;
    setToolKind(toolFor, k);
    toolButtons.find((b) => b.dataset["options"] === toolFor)?.focus();
  });
  toolList.addEventListener("keydown", (e) => {
    const all = Array.from(toolList.querySelectorAll<HTMLButtonElement>("button")), at = all.indexOf(document.activeElement as HTMLButtonElement);
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      all[(at + (e.key === "ArrowDown" ? 1 : -1) + all.length) % all.length]!.focus();
    } else if (e.key === "Escape") {
      e.preventDefault();
      toolMenu.open(false);
      toolButtons.find((b) => b.dataset["options"] === toolFor)?.focus();
    } else if (e.key === "Tab") toolMenu.open(false);
  });

  // ─── choosing strokes: cut, copy, paste, duplicate, group, delete ─────────
  /** The names and choices kept against strokes, which a copy carries. */
  const keptMaps = () => [namedStrokes.shape, namedStrokes.line, shapedStrokes] as Map<number, unknown>[];
  /** What strokes stand for in the graph, which a copy does not carry: a copy of a step is another step. */
  const markMaps = () => [marked.node, marked.edge, marked.group] as Map<number, unknown>[];
  /** The bar of what can be done with the chosen strokes, above them, or below them when there is no room above. */
  function placeSelBar() {
    const k = state.tool === "select" ? pad.chosenBox() : null, chosen = k !== null;
    for (const b of selBar.querySelectorAll<HTMLButtonElement>("[data-sel]")) b.hidden = b.dataset["sel"] === "paste" ? !clip : !chosen;
    const grouped = chosen && groupOf(pad.chosen) !== undefined;
    const g = selBar.querySelector<HTMLButtonElement>('[data-sel="group"]')!;
    g.textContent = grouped ? "Ungroup" : "Group";
    g.setAttribute("aria-label", grouped ? "Ungroup the chosen strokes" : "Group the chosen strokes");
    selBar.hidden = state.tool !== "select" || (!chosen && !clip);
    if (selBar.hidden) return;
    const w = selBar.offsetWidth, h = selBar.offsetHeight, W = canvas.clientWidth, H = canvas.clientHeight;
    let x = W / 2 - w / 2, y = 8;
    if (k) {
      x = (k.x0 + k.x1) / 2 - w / 2;
      y = k.turn[1] - 16 - h >= 4 ? k.turn[1] - 16 - h : k.y1 + 14;
      if (y + h > H - 4) y = Math.max(4, Math.min(H - h - 4, k.y0 + 4));
    }
    selBar.style.left = canvas.offsetLeft + Math.max(4, Math.min(W - w - 4, x)) + "px";
    selBar.style.top = canvas.offsetTop + y + "px";
  }
  /** The group all the chosen strokes are in, if they are all in one. */
  function groupOf(ids: number[]): number | undefined {
    const gs = new Set(state.strokes.filter((s) => ids.includes(s.id)).map((s) => s.group));
    return gs.size === 1 ? [...gs][0] : undefined;
  }
  function copyChosen() {
    const ids = new Set(pad.chosen);
    if (!ids.size) return false;
    const strokes = state.strokes.filter((s) => ids.has(s.id));
    clip = { strokes, kept: keptMaps().map((m) => new Map(strokes.filter((s) => m.has(s.id)).map((s) => [s.id, m.get(s.id)]))) };
    pastes = 0;
    return true;
  }
  /** Adds copies of strokes, shifted, with the names and choices of the strokes they copy, and chooses them. */
  function addCopies(strokes: DrawnStroke[], kept: Map<number, unknown>[], dx: number, dy: number) {
    const { copies, from } = copyStrokes(strokes, new Set(strokes.map((s) => s.id)), dx, dy, pad.nextId, [...state.strokes, ...strokes]);
    const maps = keptMaps();
    for (const [id, was] of from) kept.forEach((k, i) => k.has(was) && maps[i]!.set(id, k.get(was)));
    commit([...state.strokes, ...copies]);
    pad.choose(copies.map((s) => s.id));
  }
  function deleteChosen() {
    const ids = new Set(pad.chosen);
    if (ids.size) commit(state.strokes.filter((s) => !ids.has(s.id)));
  }
  function pasteClip() {
    if (!clip) return;
    // Into the middle of the screen, each paste a little below and right of the last, so copies never hide each other.
    const b = boxOf(clip.strokes, new Set(clip.strokes.map((s) => s.id)))!, v = pad.view, size = pad.size, step = 24 / v.scale;
    const cx = -v.x / v.scale + size.w / 2 + pastes * step, cy = -v.y / v.scale + size.h / 2 + pastes * step;
    pastes++;
    addCopies(clip.strokes, clip.kept, cx - b.cx, cy - b.cy);
  }
  function selAct(act: string) {
    const ids = pad.chosen;
    if (act === "copy" && copyChosen()) tell("Copied. Paste puts a copy in the middle of the screen.");
    else if (act === "cut" && copyChosen()) {
      deleteChosen();
      tell("Cut. Paste puts it back in the middle of the screen.");
    } else if (act === "paste") pasteClip();
    else if (act === "duplicate" && ids.length) {
      const strokes = state.strokes.filter((s) => ids.includes(s.id)), step = 24 / pad.view.scale;
      addCopies(strokes, keptMaps().map((m) => new Map(strokes.filter((s) => m.has(s.id)).map((s) => [s.id, m.get(s.id)]))), step, step);
    } else if (act === "delete") deleteChosen();
    else if (act === "snap" && ids.length) {
      // The shapes as read, with any shape chosen from a shape's menu in place of the one read.
      const q = reading(), looks = carry(q).shapes;
      const m = { ...q, nodes: q.nodes.map((n) => (looks[n.id] ? { ...n, kind: looks[n.id]! } : n)) };
      const r = snapChosen(state.strokes, new Set(ids), m, pad.nextId);
      if (!r.shapes && !r.arrows) tell("Nothing here to snap: hold a shape or an arrow still as you draw it, or draw it closer to one grooph knows.");
      else {
        // A stroke that was a shape and its line is now two, and both keep its names, choices, and marks.
        const maps = [...keptMaps(), ...markMaps()];
        for (const [id, was] of r.from) for (const m of maps) if (m.has(was)) m.set(id, m.get(was));
        commit(r.strokes);
        const live = new Set(r.strokes.map((x) => x.id));
        pad.choose([...ids.filter((id) => live.has(id)), ...r.from.keys()]);
        const parts = [r.shapes && plural(r.shapes, "shape", "shapes"), r.arrows && plural(r.arrows, "arrow", "arrows")].filter(Boolean);
        tell(`Snapped ${parts.join(" and ")} clean. Undo brings back what was drawn.`);
      }
    } else if (act === "group" && ids.length) {
      const grouped = groupOf(ids) !== undefined, g = 1 + Math.max(0, ...state.strokes.map((s) => s.group ?? 0));
      commit(state.strokes.map((s): DrawnStroke => (ids.includes(s.id) ? (grouped ? { ...s, group: undefined } : { ...s, group: g }) : s)));
      tell(grouped ? "Ungrouped." : "Grouped: tapping any of these strokes chooses them all.");
    }
    placeSelBar();
  }
  selBar.addEventListener("click", (e) => {
    const act = (e.target as Element).closest<HTMLButtonElement>("[data-sel]")?.dataset["sel"];
    if (act) selAct(act);
  });
  const inks = $("inks");
  for (const ink of INKS) {
    const id = "sk-ink-" + ink.key;
    inks.insertAdjacentHTML(
      "beforeend",
      `<input type="radio" name="sk-ink" id="${id}" value="${ink.key}"${ink.key === "ink" ? " checked" : ""}><label for="${id}" title="${ink.name}"><span class="sr-only">${ink.name}</span><span class="sk-swatch" style="background:var(--draw-${ink.key})"></span></label>`,
    );
  }
  inks.addEventListener("change", (e) => {
    state.color = (e.target as HTMLInputElement).value;
    pad.setColor(state.color);
    setTool("draw");
  });
  $("fingers-draw").addEventListener("click", () => {
    pad.setPenMode(false);
    $("pen-chip").hidden = true;
  });
  $("zoom").addEventListener("click", () => pad.fitContent());

  // ─── reading ───────────────────────────────────────────────────────────────
  /** The strokes each shape and line of the current reading was drawn with, as stroke ids, by shape or line id. */
  let drawnWith = new Map<string, Set<number>>();
  /**
   * Strokes cut from others, both ways: a name or a choice made on what is left of a stroke reaches the stroke Undo
   * brings back, and one made after Undo reaches the pieces Redo brings back.
   */
  const cutFrom = new Map<number, number>(), cutInto = new Map<number, number[]>();
  function kin(sid: number): number[] {
    const out = new Set([sid]);
    for (let up = cutFrom.get(sid); up !== undefined && !out.has(up); up = cutFrom.get(up)) out.add(up);
    const down = [sid];
    while (down.length)
      for (const c of cutInto.get(down.pop()!) ?? [])
        if (!out.has(c)) {
          out.add(c);
          down.push(c);
        }
    return [...out];
  }
  /** The strokes a shape or a line was drawn with, and those cut from them or cut into them. */
  const strokesOf = (id: string) => [...(drawnWith.get(id) ?? [])].flatMap(kin);
  /** The ids of the current reading's lines. */
  let lineIds = new Set<string>();
  /**
   * Each name typed, kept against the strokes its shape or line was drawn with: the name follows those strokes through
   * new readings, through a clear and its undo, and wherever the letters change. Shapes' names and lines' names are
   * kept apart, as one stroke can draw a shape and the line that leaves it.
   */
  const namedStrokes = { shape: new Map<number, string>(), line: new Map<number, string>() };
  function remember(id: string, value: string) {
    const named = namedStrokes[lineIds.has(id) ? "line" : "shape"];
    for (const sid of strokesOf(id)) {
      if (value.trim()) named.set(sid, value);
      else named.delete(sid);
    }
  }
  /** Each shape chosen from a shape menu, kept against strokes the same way, so it outlasts the next reading. */
  const shapedStrokes = new Map<number, ShapeKind>();
  /** The shape each node was read as, before any choice, by shape id. */
  let readKinds = new Map<string, ShapeKind>();
  function rememberKind(id: string, kind: ShapeKind) {
    for (const sid of strokesOf(id)) {
      if (kind === readKinds.get(id)) shapedStrokes.delete(sid);
      else shapedStrokes.set(sid, kind);
    }
  }
  /** The step, edge, or box each stroke was drawn for, kept the same way: what the graph keeps of what was drawn. */
  const marked = { node: new Map<number, Id>(), edge: new Map<number, Id>(), group: new Map<number, Id>() };
  const holdsCenter = (a: ReadShape, b: ReadShape) => b.bb.cx > a.bb.x0 && b.bb.cx < a.bb.x1 && b.bb.cy > a.bb.y0 && b.bb.cy < a.bb.y1;

  interface Carried {
    /** The stroke ids each shape and line was drawn with, by shape or line id. */
    drawnWith: Map<string, Set<number>>;
    /** The names that carry over, by shape or line id. */
    labels: Record<string, string>;
    /** The shapes chosen from a shape menu that carry over, by node id. */
    shapes: Record<string, ShapeKind>;
    /** What each shape, line, and box stands for in the graph. */
    marks: Marks;
  }
  /**
   * What a new reading keeps from the one before it. A shape or line drawn with a named stroke keeps that name, and one
   * drawn with a stroke whose shape was chosen keeps that choice; one drawn with a stroke marked for a step, an edge, or
   * a box stands for it. A named shape whose strokes are all gone, erased and drawn again, passes its name and its mark
   * to a shape of the same sort in its place: each holds the other's center, and the nearest wins. A named line drawn
   * again passes its name to a new line between the same two shapes, never to one that was there before.
   */
  function carry(m: Reading): Carried {
    const before = state.reading, old = state.labels, oldWith = drawnWith;
    const withIds = new Map([...m.nodes, ...m.groups, ...m.edges].map((s) => [s.id, new Set(s.strokes.map((i) => state.strokes[i]?.id).filter((id): id is number => id !== undefined))]));
    const labels: Record<string, string> = {}, shapes: Record<string, ShapeKind> = {};
    const marks: Marks = { nodes: {}, edges: {}, groups: {} };
    const markOf = (ids: number[], from: Map<number, Id>) => ids.map((sid) => from.get(sid)).find((x) => x !== undefined);
    for (const n of [...m.nodes, ...m.groups, ...m.edges]) {
      const ids = [...withIds.get(n.id)!], isLine = m.edges.includes(n as ReadEdge), named = namedStrokes[isLine ? "line" : "shape"];
      const name = ids.map((sid) => named.get(sid)).find(Boolean);
      if (name) labels[n.id] = name;
      if (m.nodes.includes(n as ReadShape)) {
        const kind = ids.map((sid) => shapedStrokes.get(sid)).find(Boolean);
        if (kind) shapes[n.id] = kind;
        const id = markOf(ids, marked.node);
        if (id) marks.nodes[n.id] = id;
      } else if (isLine) {
        const id = markOf(ids, marked.edge);
        if (id) marks.edges[n.id] = id;
      } else {
        const id = markOf(ids, marked.group);
        if (id) marks.groups[n.id] = id;
      }
    }
    if (before) {
      const live = new Set(state.strokes.map((s) => s.id));
      const kinds: ["nodes", "groups"] = ["nodes", "groups"];
      for (const kind of kinds) {
        const gone = before[kind].filter((x) => old[x.id]?.trim() && ![...(oldWith.get(x.id) ?? [])].some((sid) => live.has(sid)));
        for (const n of m[kind]) {
          if (labels[n.id] || !gone.length) continue;
          const near = gone
            .filter((x) => holdsCenter(n, x) && holdsCenter(x, n))
            .sort((a, b) => Math.hypot(a.bb.cx - n.bb.cx, a.bb.cy - n.bb.cy) - Math.hypot(b.bb.cx - n.bb.cx, b.bb.cy - n.bb.cy))[0];
          if (!near) continue;
          labels[n.id] = old[near.id]!;
          gone.splice(gone.indexOf(near), 1);
          // Its step or its box goes with its name, unless another shape already stands for it.
          const was = kind === "nodes" ? lastMarks.nodes[near.id] : lastMarks.groups[near.id];
          const into = kind === "nodes" ? marks.nodes : marks.groups;
          if (was && !Object.values(into).includes(was)) into[n.id] = was;
        }
      }
      // A shape of this reading is the one before when it keeps any of that one's strokes.
      const now = (id: string) => {
        const was = oldWith.get(id) ?? new Set();
        return [...m.nodes, ...m.groups].find((s) => [...withIds.get(s.id)!].some((sid) => was.has(sid)))?.id;
      };
      const gone = before.edges.filter((x) => old[x.id]?.trim() && ![...(oldWith.get(x.id) ?? [])].some((sid) => live.has(sid)));
      const seen = new Set([...oldWith.values()].flatMap((ids) => [...ids]));
      for (const e of m.edges) {
        if (labels[e.id] || !gone.length || [...withIds.get(e.id)!].some((sid) => seen.has(sid))) continue;
        const was = gone.find((x) => {
          const a = now(x.from), b = now(x.to);
          return (a === e.from && b === e.to) || (a === e.to && b === e.from);
        });
        if (!was) continue;
        labels[e.id] = old[was.id]!;
        gone.splice(gone.indexOf(was), 1);
      }
    }
    return { drawnWith: withIds, labels, shapes, marks };
  }
  /** What the last reading's shapes, lines, and boxes stood for, for the next reading to carry. */
  let lastMarks: Marks = { nodes: {}, edges: {}, groups: {} };

  /** Reads the drawing, and shows what was read on it, in the line under it, and in Names. */
  function readDrawing(): Marks {
    const m = recognize(state.strokes, { diagram: "flowchart" }), { labels, shapes, marks, drawnWith: withIds } = carry(m);
    drawnWith = withIds;
    lineIds = new Set(m.edges.map((e) => e.id));
    readKinds = new Map(m.nodes.map((n) => [n.id, n.kind]));
    for (const n of m.nodes)
      if (shapes[n.id]) {
        n.kind = shapes[n.id]!;
        n.unsure = false;
      }
    state.reading = m;
    state.labels = labels;
    lastMarks = marks;
    for (const [id, value] of Object.entries(labels)) remember(id, value);
    state.stale = false;
    $("go").dataset["stale"] = "false";
    readLine(m);
    names();
    pad.setOverlay({ reading: m, labels });
    showNameTags();
    return marks;
  }
  /** A plain message on the line under the drawing. */
  function tell(text: string) {
    const span = document.createElement("span");
    span.textContent = text;
    $("read").replaceChildren(span);
  }
  function readLine(m: Reading, made?: Made) {
    const kinds: Record<string, number> = {};
    for (const n of m.nodes) kinds[n.kind] = (kinds[n.kind] || 0) + 1;
    const parts = Object.entries(kinds).map(([k, n]) => plural(n, ...WORDS[k]!));
    const arrows = m.edges.length, assumed = m.edges.filter((e) => e.assumed).length, unsure = m.nodes.filter((n) => n.unsure).length;
    const bits: string[] = [];
    const pointed = assumed ? `, ${assumed} with no head, so pointed the way ${assumed === 1 ? "it was" : "they were"} drawn` : "";
    bits.push(m.nodes.length ? `<strong>${plural(m.nodes.length, "shape", "shapes")}</strong> (${parts.join(", ")})` : "<strong>no shapes</strong>");
    if (m.groups.length) bits.push(plural(m.groups.length, "box", "boxes"));
    bits.push(plural(arrows, "arrow", "arrows") + pointed);
    if (m.loops) bits.push(`<strong>${plural(m.loops, "loop", "loops")}</strong>`);
    if (m.unused.length) bits.push(`${plural(m.unused.length, "mark", "marks")} left out, shaded on the drawing`);
    if (unsure) bits.push(`${plural(unsure, "shape", "shapes")} hard to read`);
    const said = made ? ` ${madeWords(made)}` : "";
    $("read").innerHTML = `<span>Read ${bits.join(" · ")}.${said}</span> <span class="sk-ms">${m.ms.toFixed(1)} ms</span> <a class="sk-to-result" href="#sk-result">See the graph</a>`;
  }
  /** What Make it a graph did to the graph, in a few words. */
  function madeWords(made: Made): string {
    const { added, kept, removed } = made.counts;
    const bits = [added && plural(added, "new step", "new steps"), kept && `${kept} kept`, removed && `${removed} taken away`].filter(Boolean);
    return `Made the graph${bits.length ? `: ${bits.join(", ")}` : ""}.`;
  }

  /**
   * Reads the drawing and makes the graph what it says. `again` when it follows a name typed or a shape chosen since the
   * last press: Undo Make it a graph then still takes the graph back to what it was before that press.
   */
  function makeIt(typing = false, again = false) {
    if (!state.strokes.length) {
      tell("Draw something first, or load the example from More.");
      return;
    }
    const marks = state.reading && !state.stale ? lastMarks : readDrawing();
    const m = state.reading!;
    const was = host.doc();
    const made = makeGraph(m, state.labels, marks, was, state.unboxed);
    if ("error" in made) {
      tell(made.error);
      return;
    }
    // A drawing with no step in it leaves a graph that has steps as it was.
    if (made.doc.nodes.length === 0 && was.nodes.length > 0) {
      tell("No step was read, so the graph is as it was.");
      return;
    }
    // What each shape, line, and box became is what its strokes stand for from now on.
    const mark = (ids: Record<string, Id>, list: (ReadShape | ReadEdge)[], into: Map<number, Id>) => {
      for (const x of list) {
        const id = ids[x.id];
        if (id === undefined) continue;
        for (const i of x.strokes) if (state.strokes[i]) into.set(state.strokes[i]!.id, id);
      }
    };
    mark(made.became.nodes, m.nodes, marked.node);
    mark(made.became.edges, m.edges, marked.edge);
    mark(made.became.groups, m.groups, marked.group);
    lastMarks = made.became;
    // A press that changes nothing leaves nothing to undo; names typed after it still follow.
    const changed = !sameGraph(made.doc, was);
    const series = again && state.made ? state.made : null;
    state.made = { ...made, at: changed ? made.doc : was, before: series ? series.before : was, changed: changed || !!series?.changed };
    state.synced = shown(made.doc);
    if (changed) host.apply(made.doc, typing);
    readLine(m, made);
    showGraph(made.doc, made);
    persist();
  }
  $("go").addEventListener("click", () => makeIt());
  /** Whether the outlines of what was read show on the drawing: a box under it, and the same switch in More. */
  function showOutlines(on: boolean) {
    pad.setShowOverlay(on);
    $<HTMLInputElement>("show-read").checked = on;
    root.querySelector('[data-act="outlines"]')!.setAttribute("aria-checked", String(on));
  }
  $<HTMLInputElement>("show-read").addEventListener("change", (e) => showOutlines((e.target as HTMLInputElement).checked));

  /** The smallest shape, or box, around a point. */
  function shapeAt(p: Point, which: "nodes" | "groups", m = state.reading): ReadShape | null {
    if (!m) return null;
    const area = (s: ReadShape) => s.bb.w * s.bb.h;
    return m[which].filter((s) => inside(p, s.poly)).sort((a, b) => area(a) - area(b))[0] ?? null;
  }
  /** The line nearest a point, within a fingertip's reach of it on the screen. */
  function lineAt(p: Point, m = state.reading): ReadEdge | null {
    const reach = 16 / pad.view.scale;
    if (!m) return null;
    let best: { e: ReadEdge; d: number } | null = null;
    for (const e of m.edges) {
      const d = lineDist(p, e.pts);
      if (d <= reach && (!best || d < best.d)) best = { e, d };
    }
    return best?.e ?? null;
  }

  // ─── names on the drawing ──────────────────────────────────────────────────
  const NAMES_KEY = "groophSketch.names";
  let namesOn = true;
  try {
    namesOn = localStorage.getItem(NAMES_KEY) !== "off";
  } catch {
    // Shown, then.
  }
  /**
   * The names typed for shapes and lines, placed on the drawing: from the reading when it is fresh, and otherwise from
   * the drawing read again quietly, so each name stays on its shape or line as more is drawn, moved, or erased.
   */
  function showNameTags() {
    if (pad.pressing) return debounce("names", showNameTags, 200);
    const named = state.strokes.some((s) => namedStrokes.shape.has(s.id) || namedStrokes.line.has(s.id));
    if (!named || !namesOn) return pad.setNames([]);
    const fresh = !!state.reading && !state.stale, m = fresh ? state.reading! : reading();
    const labels = fresh ? state.labels : carry(m).labels, tags: NameTag[] = [];
    const ids = (idx: number[]) => idx.flatMap((i) => (state.strokes[i] ? [state.strokes[i]!.id] : []));
    for (const s of [...m.nodes, ...m.groups]) {
      const text = labels[s.id]?.trim();
      if (!text || s.kind === "dot") continue;
      tags.push({ strokes: ids(s.strokes), at: [s.bb.cx, m.groups.includes(s) ? s.bb.y0 + 16 : s.bb.cy], text, w: s.bb.w, line: false });
    }
    for (const e of m.edges) {
      const text = labels[e.id]?.trim();
      if (text && e.pts.length > 1) tags.push({ strokes: ids(e.strokes), at: halfway(e.pts), text, w: 180, line: true });
    }
    pad.setNames(tags);
  }
  function setNamesOn(on: boolean) {
    namesOn = on;
    pad.setShowNames(on);
    $("more-list").querySelector('[data-act="names"]')!.setAttribute("aria-checked", String(on));
    try {
      if (on) localStorage.removeItem(NAMES_KEY);
      else localStorage.setItem(NAMES_KEY, "off");
    } catch {
      // Kept for this visit, then.
    }
    showNameTags();
  }

  // ─── names ─────────────────────────────────────────────────────────────────
  /** After a name or a shape is changed, the graph follows, once the reading it was made from is still the drawing's. */
  function follow(typing: boolean) {
    if (state.made && state.reading && !state.stale) debounce("make", () => makeIt(typing, true), typing ? 250 : 0);
  }
  function setName(id: string, value: string) {
    state.labels[id] = value;
    remember(id, value);
    if (state.reading && !state.stale) pad.setOverlay({ reading: state.reading, labels: state.labels });
    debounce("names", showNameTags, 60);
    const input = root.querySelector<HTMLInputElement>(`#sk-name-${id}`);
    if (input && input.value !== value) input.value = value;
    follow(true);
    persist();
  }
  /** Gives a node another shape: grooph makes the step it means, and the choice stays with the strokes it was drawn with. */
  function setKind(id: string, kind: ShapeKind) {
    const n = state.reading?.nodes.find((x) => x.id === id);
    if (!n || n.kind === kind) return;
    n.kind = kind;
    n.unsure = false;
    rememberKind(id, kind);
    root.querySelector(`#sk-name-${id}`)?.setAttribute("aria-label", `Name for ${id}, ${WORDS[kind]![0]}`);
    if (!state.stale) {
      pad.setOverlay({ reading: state.reading!, labels: state.labels });
      readLine(state.reading!);
    }
    follow(false);
    persist();
  }
  /** What the strokes of a shape stand for, in Names: the step's id once the graph has it. */
  const stepOf = (x: ReadShape) => lastMarks.nodes[x.id];
  function names() {
    const box = $("names"), m = state.reading;
    box.textContent = "";
    if (!m) return;
    for (const s of [...m.nodes, ...m.groups]) {
      if (s.kind === "dot") continue;
      const group = m.groups.includes(s), sort = group ? "box" : (WORDS[s.kind]?.[0] ?? "shape");
      const label = document.createElement("label"), tag = document.createElement("span"), input = document.createElement("input");
      tag.className = "sk-tag";
      tag.textContent = s.id;
      input.id = "sk-name-" + s.id;
      input.value = state.labels[s.id] ?? "";
      input.placeholder = s.label;
      input.autocomplete = "off";
      // Ctrl+Z typed here undoes the typing, not the graph (the editor's keys, Editor.tsx); so in every name field.
      input.dataset["ownUndo"] = "";
      input.setAttribute("aria-label", `Name for ${s.id}, ${sort}`);
      input.addEventListener("input", () => setName(s.id, input.value));
      label.append(tag, input);
      const row = document.createElement("div");
      row.className = "sk-name-row";
      row.append(label);
      if (!group) {
        const pick = document.createElement("select");
        pick.id = "sk-shape-" + s.id;
        pick.setAttribute("aria-label", `Shape for ${s.id}`);
        const list = s.kind === "bullseye" ? [["bullseye", "Stop: end ring"] as [ShapeKind, string], ...SHAPES] : SHAPES;
        for (const [k, name] of list) pick.add(new Option(name, k, false, k === s.kind));
        pick.addEventListener("change", () => setKind(s.id, pick.value as ShapeKind));
        row.append(pick);
        if (stepOf(s)) row.dataset["step"] = stepOf(s);
      } else {
        const note = document.createElement("span");
        note.className = "sk-shape-note";
        note.textContent = "Box of steps";
        row.append(note);
      }
      box.append(row);
    }
    for (const e of m.edges) {
      const label = document.createElement("label"), tag = document.createElement("span"), input = document.createElement("input");
      tag.className = "sk-tag sk-line-tag";
      tag.textContent = `${e.from}${e.both ? "↔" : "→"}${e.to}`;
      input.id = "sk-name-" + e.id;
      input.value = state.labels[e.id] ?? "";
      input.placeholder = "No name";
      input.autocomplete = "off";
      input.dataset["ownUndo"] = "";
      input.setAttribute("aria-label", `Name for the line from ${e.from} ${e.both ? "and" : "to"} ${e.to}`);
      input.addEventListener("input", () => setName(e.id, input.value));
      label.append(tag, input);
      const row = document.createElement("div");
      row.className = "sk-name-row";
      row.append(label);
      box.append(row);
    }
    if (!m.nodes.length && !m.groups.length) box.innerHTML = '<p class="sk-status">No shapes were read. Draw a closed shape, like a box or a circle.</p>';
  }

  // The name editor over the drawing.
  const editor = $<HTMLFormElement>("name-edit"), editorInput = $<HTMLInputElement>("name-input");
  let editing: ReadShape | ReadEdge | null = null;
  /** Opens the name box over a shape, or over the middle of a line. */
  function openNameEditor(s: ReadShape | ReadEdge) {
    closeNameEditor(true);
    editing = s;
    const line = "pts" in s && "from" in s, at = line ? halfway(s.pts) : ([s.bb.cx, s.bb.cy] as Point);
    const wrap = $("pad-wrap").getBoundingClientRect(), [x, y] = pad.toScreen(at);
    // Room to write a name with a pen, as well as to type one.
    const w = Math.min(wrap.width - 16, Math.max(200, line ? 0 : s.bb.w * pad.view.scale));
    editor.style.width = w + "px";
    editor.style.left = Math.max(8, Math.min(wrap.width - w - 8, x - w / 2)) + "px";
    editor.style.top = Math.max(8, Math.min(wrap.height - 52, y - 22)) + "px";
    $("name-label").textContent = line ? `Name for the line from ${s.from} ${s.both ? "and" : "to"} ${s.to}` : `Name for ${s.id}`;
    editorInput.value = state.labels[s.id] ?? "";
    editorInput.placeholder = line ? "Name this line" : s.label;
    editor.hidden = false;
    editorInput.focus({ preventScroll: true });
    editorInput.select();
  }
  function closeNameEditor(save: boolean) {
    if (!editing) return;
    if (save) setName(editing.id, editorInput.value);
    editing = null;
    editor.hidden = true;
  }
  editor.addEventListener("submit", (e) => {
    e.preventDefault();
    closeNameEditor(true);
  });
  editorInput.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      e.preventDefault();
      closeNameEditor(false);
      canvas.focus();
    }
  });
  editorInput.addEventListener("blur", () => closeNameEditor(true));
  // The drawing keeps focus from moving on a press, so the name being typed is kept here, before the press is handled.
  canvas.addEventListener("pointerdown", () => closeNameEditor(true), { capture: true });

  // ─── the graph ─────────────────────────────────────────────────────────────
  const code = $<HTMLTextAreaElement>("code"), diagram = $("diagram");
  /** The picture in the site's look, when one is chosen, and Paper's otherwise. */
  let shownSvg = "";
  let drawing = 0;
  async function showGraph(doc: Graph, made?: Made) {
    const mine = ++drawing;
    code.value = doc.nodes.length ? mermaid(doc) : "";
    const guesses = $("guesses");
    const said = made ? [...(made.left ? [made.left] : []), ...made.guesses] : [];
    guesses.replaceChildren(...said.map((g) => Object.assign(document.createElement("li"), { textContent: g })));
    guesses.hidden = said.length === 0;
    $("undo-make").hidden = !made || !state.made?.changed;
    if (!doc.nodes.length) {
      diagram.innerHTML = '<p class="sk-empty">The graph appears here after Make it a graph.</p>';
      shownSvg = "";
      saves();
      return;
    }
    let svg = pictureSvg(doc, "auto");
    try {
      if (document.querySelector("main.stage[data-look]") || wanted()) {
        const look = (await themes()).look();
        if (look) svg = look.picture(svg, matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
      }
    } catch {
      // Paper's, then: the same graph.
    }
    if (mine !== drawing || dead) return;
    diagram.innerHTML = svg;
    shownSvg = svg;
    saves();
  }
  // A tap on a step in the picture opens its sheet.
  diagram.addEventListener("click", (e) => {
    const node = (e.target as Element).closest<SVGElement>("[data-node]")?.dataset["node"];
    if (node) host.open(node);
  });
  function saves() {
    $<HTMLButtonElement>("save-svg").disabled = !shownSvg;
    $<HTMLButtonElement>("save-png").disabled = !shownSvg;
  }
  const say = (id: string, text: string) => {
    const el = $(id);
    el.textContent = text;
    debounce("say-" + id, () => (el.textContent = ""), 4000);
  };
  $("undo-make").addEventListener("click", () => {
    if (!state.made) return;
    // The graph as it was before the press, as one more change the editor's Undo takes back; and what the drawing is
    // set against, so the drawing is left as it is and its next Make it a graph makes the graph from it again.
    const before = state.made.before;
    state.made = null;
    state.synced = shown(before);
    host.apply(before, false);
    $("go").dataset["stale"] = "true";
    $("undo-make").hidden = true;
    $("guesses").hidden = true;
    tell("The graph is as it was before Make it a graph. The drawing is as you left it.");
  });
  $("save-svg").addEventListener("click", () => {
    const doc = host.doc();
    if (shownSvg) download(pictureName(doc, "light", "svg").replace(".light.", "."), shownSvg, "image/svg+xml");
  });
  $("save-png").addEventListener("click", async () => {
    const doc = host.doc();
    try {
      if (shownSvg) download(pictureName(doc, "light", "png").replace(".light.", "."), await svgToPng(shownSvg), "image/png");
    } catch {
      say("save-status", "The PNG could not be made here. Save SVG still works.");
    }
  });
  $("export").addEventListener("click", () => host.exporting());
  $("copy").addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(code.value);
      say("copy-status", "Copied.");
    } catch {
      code.focus();
      code.select();
      say("copy-status", "Copy was blocked here; the code is selected, so copy it by hand.");
    }
  });
  $("save-mmd").addEventListener("click", () => {
    if (code.value.trim()) download(`${host.doc().id || "graph"}.mmd`, code.value.trimEnd() + "\n", "text/plain");
  });

  // ─── the More menu ─────────────────────────────────────────────────────────
  type Menu = { list: HTMLElement; open(on: boolean, focus?: boolean): void; readonly isOpen: boolean };
  const menus: Menu[] = [toolMenu];
  /** A button that opens a menu under it: arrow keys move through the menu, and Escape, Tab, or a press elsewhere close it. */
  function menuOf(button: HTMLButtonElement, list: HTMLElement): Menu {
    const items = () => Array.from(list.querySelectorAll<HTMLButtonElement>("[role^=menuitem]"));
    const open = (on: boolean, focus = true) => {
      list.hidden = !on;
      button.setAttribute("aria-expanded", String(on));
      if (on && focus) items()[0]!.focus();
    };
    button.addEventListener("click", () => {
      for (const m of menus) if (m.list !== list) m.open(false);
      open(button.getAttribute("aria-expanded") !== "true", false);
    });
    button.addEventListener("keydown", (e) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        open(true);
      } else if (e.key === "Escape" && button.getAttribute("aria-expanded") === "true") {
        e.preventDefault();
        open(false);
      }
    });
    list.addEventListener("keydown", (e) => {
      const all = items(), at = all.indexOf(document.activeElement as HTMLButtonElement);
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        all[(at + (e.key === "ArrowDown" ? 1 : -1) + all.length) % all.length]!.focus();
      } else if (e.key === "Escape") {
        e.preventDefault();
        open(false);
        button.focus();
      } else if (e.key === "Tab") open(false);
    });
    const m = {
      list,
      open,
      get isOpen() {
        return button.getAttribute("aria-expanded") === "true";
      },
    };
    menus.push(m);
    return m;
  }
  const more = $<HTMLButtonElement>("more"), moreList = $("more-list"), moreMenu = menuOf(more, moreList);
  // A press anywhere but in a menu's own place, its button and its list, closes it: picking a tool closes Add and More.
  listen(document, "pointerdown", (e) => {
    for (const m of menus) if (!m.list.parentElement!.contains(e.target as Node)) m.open(false);
  });

  // ─── adding steps, arrows, and templates ──────────────────────────────────
  const add = $<HTMLButtonElement>("add"), addList = $("add-list");
  /** A small picture of a shape for the Add menu, from the same outline the reader matches it to. */
  function shapeIcon(kind: AddKind | "double"): string {
    const svg = (inner: string) => `<svg viewBox="0 0 28 20" aria-hidden="true">${inner}</svg>`;
    if (kind === "double") return svg('<circle cx="14" cy="10" r="7.5" /><circle cx="14" cy="10" r="4.6" />');
    if (kind === "circle") return svg('<circle cx="14" cy="10" r="7.5" />');
    if (kind === "stadium") return svg('<rect x="2.5" y="3.5" width="23" height="13" rx="6.5" />');
    if (kind === "dot" || kind === "bullseye") return svg('<circle cx="14" cy="10" r="4.5" class="sk-fill" />');
    const [w, h] = kind === "diamond" || kind === "triangle" ? [18, 15] : [23, 13], x0 = 14 - w / 2, y0 = 10 - h / 2;
    return svg(`<polygon points="${OUTLINES[kind].map(([u, v]) => `${(x0 + u * w).toFixed(1)},${(y0 + v * h).toFixed(1)}`).join(" ")}" />`);
  }
  /**
   * The arrows the Add menu offers, each as long as a box is wide: one way; both ways in one line, for two steps that
   * each lead to the other; and a pair side by side, one each way, so each can have its own name.
   */
  const ARROWS: { id: string; label: string; icon: string; parts(): Part[] }[] = [
    { id: "arrow", label: "Arrow", icon: "M3 10h21M19 6l5 4-5 4", parts: () => [{ pts: cleanArrow([0, 0], [140, 0], 1), line: true }] },
    { id: "both", label: "Two-way arrow", icon: "M4 10h20M9 6l-5 4 5 4M19 6l5 4-5 4", parts: () => [{ pts: cleanArrow([0, 0], [140, 0], 1, true), line: true }] },
    {
      id: "pair",
      label: "Arrows both ways",
      icon: "M3 7h21M20 4l4 3-4 3M25 13H4M8 10l-4 3 4 3",
      parts: () => [{ pts: cleanArrow([0, 0], [140, 0], 1), line: true }, { pts: cleanArrow([140, 30], [0, 30], 1), line: true }],
    },
  ];
  /** The templates: mermaidify's flowcharts and its agent workflows, which are grooph's patterns. A state diagram is no graph. */
  const templates = TEMPLATES.filter((t) => t.diagram === "flowchart");
  const templateGroups = [...new Set(templates.map((t) => t.group))];
  addList.innerHTML =
    `<p class="sk-menu-head" id="sk-add-shapes" role="presentation">Steps</p><div class="sk-add-shapes" role="group" aria-labelledby="sk-add-shapes">` +
    STEPS.map((a) => `<button type="button" role="menuitem" data-add="${a.kind}">${shapeIcon(a.kind)}<span>${a.label}</span></button>`).join("") +
    `</div><p class="sk-menu-head" id="sk-add-arrows" role="presentation">Arrows</p><div class="sk-add-shapes sk-add-arrows" role="group" aria-labelledby="sk-add-arrows">` +
    ARROWS.map((a) => `<button type="button" role="menuitem" data-arrow="${a.id}"><svg viewBox="0 0 28 20" aria-hidden="true"><path d="${a.icon}" /></svg><span>${a.label}</span></button>`).join("") +
    "</div>" +
    templateGroups
      .map(
        (g, i) =>
          `<p class="sk-menu-head" id="sk-add-templates-${i}" role="presentation">${g}</p><div class="sk-add-templates" role="group" aria-labelledby="sk-add-templates-${i}">` +
          templates
            .filter((t) => t.group === g)
            .map((t) => `<button type="button" role="menuitem" data-template="${t.id}"><span>${t.label}</span></button>`)
            .join("") +
          "</div>",
      )
      .join("");
  const addMenu = menuOf(add, addList);
  /**
   * Adds strokes in the middle of the screen, the size on screen they are at 100%, with the names they carry, and
   * chooses them, so they can be dragged into place at once.
   */
  function addParts(parts: Part[]) {
    const v = pad.view, all = parts.flatMap((p) => p.pts);
    const x0 = Math.min(...all.map((p) => p[0])), x1 = Math.max(...all.map((p) => p[0])), y0 = Math.min(...all.map((p) => p[1])), y1 = Math.max(...all.map((p) => p[1]));
    const bx = (x0 + x1) / 2, by = (y0 + y1) / 2;
    // A template wider or taller than the screen is drawn smaller to fit it, though never so small its shapes go unread.
    const fit = Math.max(0.6, Math.min(1, (0.9 * canvas.clientWidth) / (x1 - x0 || 1), (0.9 * canvas.clientHeight) / (y1 - y0 || 1)));
    const k = fit / v.scale;
    const cx = -v.x / v.scale + pad.size.w / 2, cy = -v.y / v.scale + pad.size.h / 2;
    const added = parts.map((p) => {
      const s: DrawnStroke = { id: pad.nextId(), color: state.color, pts: p.pts.map(([x, y]): Point => [cx + (x - bx) * k, cy + (y - by) * k]), by: "mouse", zoom: v.scale };
      if (p.name) namedStrokes[p.line ? "line" : "shape"].set(s.id, p.name);
      return s;
    });
    commit([...state.strokes, ...added]);
    setTool("select");
    pad.choose(added.map((s) => s.id));
  }
  addList.addEventListener("click", (e) => {
    const b = (e.target as Element).closest<HTMLButtonElement>("[data-add], [data-arrow], [data-template]");
    if (!b) return;
    addMenu.open(false);
    add.focus();
    if (b.dataset["arrow"]) {
      const a = ARROWS.find((x) => x.id === b.dataset["arrow"])!;
      addParts(a.parts());
      tell(`Added: ${a.label.toLowerCase()}. Drag it between two steps; the plus adds those too.`);
    } else if (b.dataset["add"]) {
      const a = STEPS.find((x) => x.kind === b.dataset["add"])!;
      addParts(a.kind === "double" ? [...shapeParts("circle", 0, 0, a.w, a.h), ...shapeParts("circle", 0, 0, a.w * 0.72, a.h * 0.72)] : shapeParts(a.kind, 0, 0, a.w, a.h));
      tell(`Added: ${a.label.toLowerCase()}. Drag it into place, or pick the pen to draw.`);
    } else {
      const t = templates.find((x) => x.id === b.dataset["template"])!;
      addParts(t.parts());
      tell(`Added: ${t.label.toLowerCase()}, chosen so you can drag it into place. Press Make it a graph to read it.`);
    }
  });

  moreList.addEventListener("click", (e) => {
    const act = (e.target as Element).closest<HTMLButtonElement>("[data-act]")?.dataset["act"];
    if (!act) return;
    moreMenu.open(false);
    more.focus();
    if (act === "example") loadExample();
    if (act === "redraw") drawTheGraph(host.doc(), "Drawn from the graph as it is. Undo brings back the drawing it replaced.");
    if (act === "fit") pad.fitContent();
    if (act === "snap") setSnap(!snapOn);
    if (act === "outlines") showOutlines(!$<HTMLInputElement>("show-read").checked);
    if (act === "names") setNamesOn(!namesOn);
    if (act === "save-drawing") saveDrawing();
    if (act === "open-drawing") $<HTMLInputElement>("open-file").click();
  });
  /** Forgets what the drawing was read as: nothing carries over by place into what is drawn next. */
  function forget() {
    state.reading = null;
    state.labels = {};
    state.made = null;
    // The boxes the drawing left out stay: what Clear takes away, its Undo brings back, and those boxes with it.
    lastMarks = { nodes: {}, edges: {}, groups: {} };
    names();
  }
  function clearAll() {
    if (!state.strokes.length) return;
    commit([]);
    // No reading to carry names by place from; names kept against the strokes come back with an undo.
    forget();
    tell("Cleared. Undo brings the drawing back.");
  }
  function loadExample() {
    const w = Math.max(320, Math.min(pad.size.w, 520));
    // A fresh start: nothing carries over from the drawing it replaces.
    forget();
    commit(exampleStrokes(w).map((s) => ({ id: pad.nextId(), color: s.color ?? "ink", pts: s.pts, by: "mouse" as const })));
    pad.resetView();
    pad.fitContent();
    readDrawing();
    tell("The example: a researcher, a builder, a critic that sends work back to it, and a stop. Press Make it a graph to make it the graph.");
  }
  $("hint-example").addEventListener("click", loadExample);
  $("clear").addEventListener("click", clearAll);
  function stamp() {
    const d = new Date(), two = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${two(d.getMonth() + 1)}-${two(d.getDate())}-${two(d.getHours())}${two(d.getMinutes())}`;
  }
  /** The drawing as mermaidify's file, which mermaidify opens too: its strokes, names, and shapes, and the graph as Mermaid. */
  function asFile(): DrawingFile {
    if (state.stale && state.strokes.length) readDrawing();
    const shapes: Record<string, ShapeKind> = {};
    for (const n of state.reading?.nodes ?? []) {
      const kind = [...(drawnWith.get(n.id) ?? [])].map((sid) => shapedStrokes.get(sid)).find(Boolean);
      if (kind) shapes[n.id] = kind;
    }
    return toFile(state.strokes, state.labels, code.value, false, shapes);
  }
  function saveDrawing() {
    if (!state.strokes.length) {
      tell("There is no drawing to save yet.");
      return;
    }
    download(`drawing-${stamp()}.json`, JSON.stringify(asFile()), "application/json");
  }
  $<HTMLInputElement>("open-file").addEventListener("change", async (e) => {
    const input = e.target as HTMLInputElement, f = input.files?.[0];
    input.value = "";
    if (!f) return;
    if (f.size > 5_000_000) {
      tell("That file is too large to be a drawing.");
      return;
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(await f.text());
    } catch {
      tell("That file is not a drawing: it is not JSON.");
      return;
    }
    const r = fromFile(parsed);
    if (!r.ok) {
      tell(r.error.replace("not a mermaidify drawing", "not a drawing grooph or mermaidify saved").replace("a newer version of mermaidify", "a newer version than this one opens"));
      return;
    }
    restore(r.file, r.file.strokes.map(() => null));
    tell(`Opened ${f.name}. Press Make it a graph to make it the graph.`);
  });

  /** Puts a drawing back: its strokes, their names, shapes, and marks. */
  function restore(file: DrawingFile, marks: (Mark | null)[]) {
    forget();
    const strokes = file.strokes.map((s): DrawnStroke => ({ id: pad.nextId(), color: s.color, pts: s.pts, by: s.by, ...(s.open ? { open: s.open } : {}), ...(s.zoom ? { zoom: s.zoom } : {}), ...(s.group ? { group: s.group } : {}) }));
    strokes.forEach((s, i) => {
      const mark = marks[i];
      if (!mark) return;
      if ("node" in mark) marked.node.set(s.id, mark.node);
      else if ("edge" in mark) marked.edge.set(s.id, mark.edge);
      else marked.group.set(s.id, mark.group);
    });
    commit(strokes);
    pad.fitContent();
    if (!strokes.length) return;
    readDrawing();
    for (const [k, v] of Object.entries(file.labels))
      if (drawnWith.has(k)) {
        state.labels[k] = v;
        remember(k, v);
      }
    for (const [k, v] of Object.entries(file.shapes ?? {})) {
      const n = state.reading!.nodes.find((x) => x.id === k);
      if (!n) continue;
      n.kind = v;
      n.unsure = false;
      rememberKind(k, v);
    }
    readLine(state.reading!);
    pad.setOverlay({ reading: state.reading!, labels: state.labels });
    names();
    showNameTags();
  }

  /** The graph drawn in place of the drawing, which Undo brings back; `say` is what the line under it says. */
  function drawTheGraph(doc: Graph, say?: string) {
    const { parts, unboxed } = drawGraph(doc, host.places(doc));
    forget();
    state.unboxed = unboxed;
    const strokes = parts.map((p: Drawn): DrawnStroke => {
      const s: DrawnStroke = { id: pad.nextId(), color: "ink", pts: p.pts, by: "mouse" };
      if (p.name) namedStrokes[p.line ? "line" : "shape"].set(s.id, p.name);
      if ("node" in p.mark) marked.node.set(s.id, p.mark.node);
      else if ("edge" in p.mark) marked.edge.set(s.id, p.mark.edge);
      else marked.group.set(s.id, p.mark.group);
      return s;
    });
    if (strokes.length || state.strokes.length) commit(strokes);
    pad.resetView();
    pad.fitContent();
    state.synced = shown(doc);
    if (strokes.length) {
      readDrawing();
      if (say) tell(say);
    }
    showGraph(doc);
    persist();
  }

  // ─── snapping and full screen ──────────────────────────────────────────────
  const SNAP_KEY = "groophSketch.snap";
  let snapOn = true;
  try {
    snapOn = localStorage.getItem(SNAP_KEY) !== "off";
  } catch {
    // On, then.
  }
  function setSnap(on: boolean) {
    snapOn = on;
    pad.setSnap(on);
    moreList.querySelector('[data-act="snap"]')!.setAttribute("aria-checked", String(on));
    try {
      if (on) localStorage.removeItem(SNAP_KEY);
      else localStorage.setItem(SNAP_KEY, "off");
    } catch {
      // Kept for this visit, then.
    }
  }
  setSnap(snapOn);
  setNamesOn(namesOn);

  /**
   * Full screen gives the drawing the whole window, with the tools above it and what was read below. Where the
   * browser allows it, the browser's own bars go too; leaving the browser's full screen leaves this one. What it
   * covers, the rest of the page, is out of reach of the keyboard and of screen readers while it is on.
   */
  const bar = root.querySelector<HTMLElement>(".sk-bar")!;
  const sized = new ResizeObserver(() => root.style.setProperty("--sk-toolbar", bar.offsetHeight + "px"));
  sized.observe(bar);
  offs.push(() => sized.disconnect());
  const full = $<HTMLButtonElement>("full");
  const isFull = () => root.classList.contains("is-full");
  let covered: HTMLElement[] = [];
  function setFull(on: boolean) {
    if (isFull() === on) return;
    root.classList.toggle("is-full", on);
    document.documentElement.classList.toggle("sk-full-page", on);
    full.setAttribute("aria-pressed", String(on));
    full.title = on ? "Leave full screen (F or Esc)" : "Full screen (F)";
    for (const el of covered) el.inert = false;
    covered = [];
    if (on) {
      // Everything on the page but the drawing's own section and what holds it.
      const keep = $("result").previousElementSibling as HTMLElement;
      for (let at: HTMLElement | null = keep; at && at !== document.body; at = at.parentElement)
        for (const sib of at.parentElement?.children ?? []) if (sib !== at && sib instanceof HTMLElement && !sib.inert) covered.push(sib);
      for (const el of covered) el.inert = true;
    }
    for (const m of menus) m.open(false);
    closeNameEditor(true);
    if (on && !document.fullscreenElement) document.documentElement.requestFullscreen?.({ navigationUI: "hide" }).catch(() => undefined);
    else if (!on && document.fullscreenElement) document.exitFullscreen().catch(() => undefined);
  }
  full.addEventListener("click", () => setFull(!isFull()));
  // The browser's full screen follows this one: leaving it leaves this one, and one that arrives after this one was
  // already left again is left too.
  listen(document, "fullscreenchange", () => {
    if (!document.fullscreenElement) setFull(false);
    else if (!isFull()) document.exitFullscreen().catch(() => undefined);
  });
  // From full screen, "See the graph" leaves it first, then goes to the graph once the page is back.
  $("read").addEventListener("click", (e) => {
    if (!(e.target as Element).closest(".sk-to-result")) return;
    e.preventDefault();
    const go = () => dead || $("result").scrollIntoView({ block: "start", behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
    if (!isFull()) return go();
    if (!document.fullscreenElement) {
      setFull(false);
      return go();
    }
    let done = false;
    const once = () => {
      if (done) return;
      done = true;
      requestAnimationFrame(go);
    };
    document.addEventListener("fullscreenchange", once, { once: true });
    setTimeout(once, 1000);
    setFull(false);
  });
  $("back").addEventListener("click", (e) => {
    e.preventDefault();
    $("pad-wrap").scrollIntoView({ block: "center" });
  });

  // ─── keeping the drawing for this graph ────────────────────────────────────
  let restoring = true, unkept = false;
  function persist() {
    if (restoring) return;
    unkept = true;
    debounce("keep", keepNow, 500);
  }
  function keepNow() {
    if (!unkept) return;
    // Reading the drawing again can take a moment on a big one, so it never runs while a stroke is being drawn, unless
    // the page is going away.
    if (pad.pressing && document.visibilityState === "visible") return debounce("keep", keepNow, 500);
    unkept = false;
    clearTimeout(timers["keep"]);
    if (!state.strokes.length) return keepFor(host.key, null);
    const marks = state.strokes.map((s): Mark | null => {
      const node = marked.node.get(s.id), edge = marked.edge.get(s.id), group = marked.group.get(s.id);
      return node !== undefined ? { node } : edge !== undefined ? { edge } : group !== undefined ? { group } : null;
    });
    keepFor(host.key, { file: asFile(), marks, synced: state.synced, unboxed: state.unboxed });
  }
  // A phone may close a tab it has put away, so the last change is kept as the page goes out of sight.
  listen(window, "pagehide", keepNow);
  listen(document, "visibilitychange", () => {
    if (document.visibilityState === "hidden") keepNow();
  });

  // ─── keys ──────────────────────────────────────────────────────────────────
  // Heard before the editor's own (on the window), which a key the drawing takes does not reach: Ctrl+Z undoes a
  // stroke here, not the graph's last change.
  listen(document, "keydown", (e) => {
    const target = e.target as HTMLElement;
    // Keys pressed in the graph's sheet, or anywhere outside the view, are the editor's.
    if (!root.contains(target) && target !== document.body) return;
    const typing = target.closest("input, textarea, select, [contenteditable]");
    const mod = e.metaKey || e.ctrlKey;
    const take = () => {
      e.preventDefault();
      e.stopPropagation();
    };
    if (mod && e.key === "Enter") {
      take();
      makeIt();
      return;
    }
    if (typing) return;
    // Escape closes an open menu first, then lets go of the chosen strokes, then puts away what was read, and only then
    // leaves full screen.
    if (e.key === "Escape" && e.defaultPrevented) return;
    if (e.key === "Escape" && menus.some((m) => m.isOpen)) {
      take();
      for (const m of menus) m.open(false);
    } else if (e.key === "Escape" && state.tool === "select" && pad.chosen.length) {
      take();
      pad.choose([]);
    } else if (e.key === "Escape" && pad.overlaid) {
      take();
      pad.setOverlay(null);
    } else if (e.key === "Escape" && isFull()) {
      take();
      setFull(false);
    } else if (e.key === " " && !mod && overPad) {
      // Space held with the pointer over the drawing moves it with a drag, as the hand does, even when a toolbar button
      // has the focus, which the key then does not press. Elsewhere Space scrolls the page and presses buttons as usual.
      take();
      spaceTaken = true;
      pad.setSpace(true);
    } else if (!mod && !e.altKey && e.key.toLowerCase() === "f") {
      if (!e.repeat) setFull(!isFull());
    } else if (mod && e.key.toLowerCase() === "z") {
      take();
      if (e.shiftKey) redo();
      else undo();
    } else if (mod && e.key.toLowerCase() === "y") {
      take();
      redo();
    } else if (state.tool === "select" && mod && (["c", "x", "d"].includes(e.key.toLowerCase()) ? pad.chosen.length > 0 : e.key.toLowerCase() === "v" && !!clip)) {
      take();
      selAct({ c: "copy", x: "cut", v: "paste", d: "duplicate" }[e.key.toLowerCase()]!);
    } else if (state.tool === "select" && (e.key === "Delete" || e.key === "Backspace") && pad.chosen.length) {
      take();
      selAct("delete");
    } else if (!mod && !e.altKey && e.key.toLowerCase() === "d") setTool("draw");
    // E is the eraser that takes whole strokes, and S, or C, the one that takes only what it passes over.
    else if (!mod && !e.altKey && e.key.toLowerCase() === "e") setToolKind("eraser", "whole");
    else if (!mod && !e.altKey && (e.key.toLowerCase() === "s" || e.key.toLowerCase() === "c")) setToolKind("eraser", "part");
    else if (!mod && !e.altKey && e.key.toLowerCase() === "v") setTool("select");
    else if (!mod && !e.altKey && e.key.toLowerCase() === "h") setTool("hand");
  });
  /** Whether the pointer is over the drawing, where Space moves it, and whether Space was taken for that. */
  let overPad = false, spaceTaken = false;
  canvas.addEventListener("pointermove", () => (overPad = true));
  canvas.addEventListener("pointerleave", () => (overPad = false));
  listen(document, "keyup", (e) => {
    if (e.key !== " ") return;
    pad.setSpace(false);
    // A button presses itself as Space comes up, so a Space that moved the drawing stops here.
    if (spaceTaken) e.preventDefault();
    spaceTaken = false;
  });
  // Space let go where the page could not hear it, as when the window lost focus, lets go of the hand.
  listen(window, "blur", () => {
    pad.setSpace(false);
    spaceTaken = false;
  });
  // The colors follow the site's look and the system's light or dark.
  const scheme = matchMedia("(prefers-color-scheme: dark)");
  const repaint = () => {
    pad.repaint();
    void showGraph(host.doc(), state.made && state.made.at === host.doc() ? state.made : undefined);
  };
  scheme.addEventListener("change", repaint);
  offs.push(() => scheme.removeEventListener("change", repaint));
  const looks = new MutationObserver(repaint);
  looks.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  offs.push(() => looks.disconnect());

  // ─── a reading quietly ─────────────────────────────────────────────────────
  let quiet: { strokes: DrawnStroke[]; m: Reading } | null = null;
  /** The drawing read as it stands, without showing it: once for each change. */
  function reading(): Reading {
    if (quiet?.strokes === state.strokes) return quiet.m;
    const m = recognize(state.strokes, { diagram: "flowchart" });
    quiet = { strokes: state.strokes, m };
    return m;
  }

  /** The drawing's marks and names brought to a graph that differs from `was` only in names and ids (`renamed`). */
  function relabel(was: string, doc: Graph): boolean {
    const now = skeleton(doc), ids = renamed(was, now);
    if (!ids) return false;
    for (const map of [marked.node, marked.edge, marked.group]) for (const [sid, id] of map) if (ids.has(id)) map.set(sid, ids.get(id)!);
    state.unboxed = state.unboxed.map((id) => ids.get(id) ?? id);
    const names = new Map<Id, string>([...now.nodes, ...now.groups].map((x) => [x.id, x.name]));
    for (const [sid, id] of marked.node) if (names.has(id)) namedStrokes.shape.set(sid, names.get(id)!);
    for (const [sid, id] of marked.group) if (names.has(id)) namedStrokes.shape.set(sid, names.get(id)!);
    const lines = new Map(now.edges.map((e) => [e.id, e.name]));
    for (const [sid, id] of marked.edge)
      if (lines.has(id)) {
        if (lines.get(id)) namedStrokes.line.set(sid, lines.get(id)!);
        else namedStrokes.line.delete(sid);
      }
    return true;
  }

  // ─── start ─────────────────────────────────────────────────────────────────
  // The drawing kept for this graph, while the graph is still what it shows; otherwise the graph drawn, with the
  // drawing kept before it a step back.
  const doc = host.doc();
  const kept = loadKept(host.key);
  if (kept && (kept.synced === shown(doc) || renamed(kept.synced, skeleton(doc)))) {
    // As it was left, or with steps renamed since: then its strokes take the new names and ids.
    restore(kept.file, kept.marks);
    state.unboxed = kept.unboxed;
    if (kept.synced !== shown(doc) && relabel(kept.synced, doc)) readDrawing();
    state.undo = [];
    $<HTMLButtonElement>("undo").disabled = true;
    showGraph(doc);
    if (state.reading) readLine(state.reading);
  } else if (doc.nodes.length) {
    if (kept && kept.file.strokes.length) {
      restore(kept.file, kept.marks);
      state.undo = [];
    }
    drawTheGraph(doc, kept && kept.file.strokes.length ? "The graph has changed since you last drew it, so this is the graph as it is now. Undo brings back your drawing." : undefined);
    if (!kept || !kept.file.strokes.length) {
      state.undo = [];
      $<HTMLButtonElement>("undo").disabled = true;
    }
  } else if (kept && kept.file.strokes.length) {
    restore(kept.file, kept.marks);
    state.unboxed = kept.unboxed;
    state.undo = [];
    $<HTMLButtonElement>("undo").disabled = true;
    showGraph(doc);
  } else showGraph(doc);
  // What the drawing is set against from here on: the graph as it opened, whichever way it was drawn.
  state.synced = shown(doc);
  restoring = false;

  return {
    update(next) {
      // What this view made, or a change that leaves what a drawing shows as it was: the drawing stands. A change made
      // elsewhere is the graph's own from then on, which Undo Make it a graph must not take back.
      if (state.made?.at === next) return;
      if (state.made) {
        state.made = null;
        $("undo-make").hidden = true;
        $("guesses").hidden = true;
      }
      const now = shown(next);
      if (now === state.synced) {
        void showGraph(next);
        return;
      }
      // Only names (and the ids that follow them) changed elsewhere: the drawing keeps its strokes, which stand for the
      // renamed steps and take their names, the strokes of drawings Undo brings back included.
      if (relabel(state.synced, next)) {
        state.synced = now;
        if (state.reading) readDrawing();
        void showGraph(next);
        persist();
        return;
      }
      state.made = null;
      drawTheGraph(next, "The graph changed, so this is the graph as it is now. Undo brings back the drawing before it.");
    },
    destroy() {
      keepNow();
      setFull(false);
      dead = true;
      for (const t of Object.values(timers)) clearTimeout(t);
      for (const off of offs) off();
      root.replaceChildren();
      root.classList.remove("sk", "is-full");
    },
  };
}
