import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { autoLayout, validate, type Graph, type Id } from "@grooph/core";
import { describe, expect, it } from "vitest";

import { drawGraph, makeGraph, type Drawn, type Marks } from "../src/ui/sketch/graph.js";
import { recognize, type Reading } from "../src/ui/sketch/mermaidify/reader/recognize.js";
import { cleanArrow } from "../src/ui/sketch/mermaidify/reader/snap.js";
import { bbox, densify, type Point } from "../src/ui/sketch/mermaidify/reader/geometry.js";

/** An arrow along a path, its head at the last point, as a hand draws one in a stroke. */
const arrowAlong = (path: Point[]): Drawn => {
  const line = densify(path, 3), tip = line[line.length - 1]!, from = path[path.length - 2]!;
  const a = Math.atan2(tip[1] - from[1], tip[0] - from[0]);
  const barb = (t: number): Point => [tip[0] - 14 * Math.cos(a + t), tip[1] - 14 * Math.sin(a + t)];
  return { pts: [...line, ...densify([tip, barb(0.5), tip, barb(-0.5)], 2).slice(1)], line: true, mark: { node: "" } };
};

/**
 * The Sketch view's two ways (src/ui/sketch/graph.ts): a graph drawn as shapes and arrows, and the drawing read back
 * by mermaidify's reader and made a graph again. Every built-in pattern, drawn and read with nothing changed, is the
 * pattern it was; and a drawing changed by hand changes the graph only where it was changed.
 */

/** Hundreds of drawings read in one test: a minute's room, as a shared runner reads more slowly than a laptop. */
const SLOW = 60_000;
const PATTERNS = join(__dirname, "../../../patterns");
const patterns = readdirSync(PATTERNS)
  .filter((f) => f.endsWith(".grooph.json"))
  .map((f) => JSON.parse(readFileSync(join(PATTERNS, f), "utf8")) as Graph);
/** Graphs with subgroophs, a box of steps that holds a loop among them: a box drawn round them is the group it was. */
const composed = ["fixtures/valid/subgrooph-in-a-graph.grooph.json", "fixtures/composed/debate-then-build-composed.grooph.json"].map(
  (f) => JSON.parse(readFileSync(join(__dirname, "../../..", f), "utf8")) as Graph,
);

/** A drawing as the Sketch view keeps it: each stroke with an id, its name, and its mark. */
const drawing = (doc: Graph, columns = 4) => drawGraph(doc, autoLayout(doc, columns));
const drawn = (doc: Graph, columns = 4): Drawn[] => drawing(doc, columns).parts;
/** A graph drawn, read back, and made a graph again with nothing changed. */
const again = (doc: Graph, columns = 4) => {
  const { parts, unboxed } = drawing(doc, columns);
  const m = read(parts);
  const { names, marks } = named(parts, m);
  return { m, made: makeGraph(m, names, marks, doc, unboxed) };
};

/** The names and marks of a reading's shapes, lines, and boxes, from the strokes they were read in. */
function named(parts: Drawn[], m: Reading): { names: Record<string, string>; marks: Marks } {
  const names: Record<string, string> = {};
  const marks: Marks = { nodes: {}, edges: {}, groups: {} };
  const first = <T>(strokes: number[], pick: (p: Drawn) => T | undefined): T | undefined => strokes.map((i) => pick(parts[i]!)).find((x) => x !== undefined);
  for (const n of m.nodes) {
    const name = first(n.strokes, (p) => (!p.line && "node" in p.mark ? p.name : undefined));
    if (name) names[n.id] = name;
    const id = first(n.strokes, (p) => ("node" in p.mark ? p.mark.node : undefined));
    if (id) marks.nodes[n.id] = id;
  }
  for (const g of m.groups) {
    const name = first(g.strokes, (p) => ("group" in p.mark ? p.name : undefined));
    if (name) names[g.id] = name;
    const id = first(g.strokes, (p) => ("group" in p.mark ? p.mark.group : undefined));
    if (id) marks.groups[g.id] = id;
  }
  for (const e of m.edges) {
    const name = first(e.strokes, (p) => (p.line ? p.name : undefined));
    if (name) names[e.id] = name;
    const id = first(e.strokes, (p) => ("edge" in p.mark ? p.mark.edge : undefined));
    if (id) marks.edges[e.id] = id;
  }
  return { names, marks };
}

const read = (parts: Drawn[]): Reading => recognize(parts.map((p) => ({ pts: p.pts, color: "ink" })));

/** What a graph is, as a drawing says it: its steps, its edges with their conditions, its loops, and its boxes. */
const shape = (doc: Graph) => ({
  nodes: doc.nodes.map((n) => `${n.id} ${n.kind} ${n.name}`).sort(),
  edges: doc.edges.map((e) => `${e.from}>${e.to} ${JSON.stringify(e.when ?? "always")}${e.approval ? " approval" : ""}`).sort(),
  loops: doc.loops.map((l) => `${[...l.members].sort().join(",")} back ${[...l.back].sort().join(",")}`).sort(),
  groups: (doc.groups ?? []).map((g) => `${g.id}: ${[...g.members].sort().join(",")}`).sort(),
});

describe("a graph drawn and read back", () => {
  for (const doc of [...patterns, ...composed])
    it(`is ${doc.id} again, every detail kept`, () => {
      const { m, made } = again(doc);
      expect(m.unused, "every stroke is read as part of a shape or a line").toEqual([]);
      if ("error" in made) throw new Error(made.error);
      expect(shape(made.doc)).toEqual(shape(doc));
      // Nothing the drawing does not say is lost: the steps, edges, and loops are the graph's own, field for field.
      expect(made.doc.nodes).toEqual(doc.nodes);
      expect(made.doc.loops.map((l) => l.stops)).toEqual(doc.loops.map((l) => l.stops));
      expect(made.counts).toEqual({ added: 0, kept: doc.nodes.length, removed: 0 });
      // Nothing changed, so it is the same document, to the order of its fields: the editor is handed no change.
      expect(JSON.stringify(made.doc)).toBe(JSON.stringify(doc));
    });

  it("keeps every edge of a step drawn in a box of its own: an arrow that ends on the box goes to the step in it", () => {
    for (const doc of patterns)
      for (const [step, columns] of doc.nodes.flatMap((n) => [[n, 4], [n, 2]] as const)) {
        const boxed: Graph = { ...doc, groups: [{ id: "a-box", name: "A box", members: [step.id] }] };
        const { made } = again(boxed, columns);
        if ("error" in made) throw new Error(`${doc.id}, ${step.id}: ${made.error}`);
        expect(JSON.stringify(made.doc), `${doc.id} with ${step.id} boxed, ${columns} to a row`).toBe(JSON.stringify(boxed));
      }
  }, SLOW);

  it("keeps a box round several steps as it was: drawn where it holds only its own steps, and left out of the drawing where it cannot", () => {
    let drawnBoxes = 0, cases = 0;
    for (const doc of patterns)
      for (const columns of [4, 2]) {
        const sets = [...doc.edges.map((e) => [e.from, e.to]), ...doc.loops.map((l) => l.members)].map((ids) => [...new Set(ids)]).filter((ids) => ids.length > 1);
        for (const members of sets) {
          cases++;
          const boxed: Graph = { ...doc, groups: [{ id: "a-box", name: "A box", members }] };
          const { parts, unboxed } = drawing(boxed, columns);
          if (!unboxed.length) drawnBoxes++;
          const m = read(parts);
          const { names, marks } = named(parts, m);
          const made = makeGraph(m, names, marks, boxed, unboxed);
          if ("error" in made) throw new Error(`${doc.id} ${members}: ${made.error}`);
          expect(JSON.stringify(made.doc), `${doc.id} with ${members.join(", ")} boxed, ${columns} to a row`).toBe(JSON.stringify(boxed));
        }
      }
    // Most such boxes are drawn: the test is of drawing them, not of leaving them out.
    expect(drawnBoxes).toBeGreaterThan(cases / 2);
  }, SLOW);

  it("reads the patterns laid out as a phone lays them out, two to a row", () => {
    for (const doc of [...patterns, ...composed]) {
      const { made } = again(doc, 2);
      if ("error" in made) throw new Error(`${doc.id}: ${made.error}`);
      expect(shape(made.doc), doc.id).toEqual(shape(doc));
    }
  }, SLOW);
});

describe("a drawing changed by hand", () => {
  const grind = patterns.find((d) => d.id === "grind-loop")!;
  const byNode = (parts: Drawn[], id: Id): Drawn[] => parts.filter((p) => "node" in p.mark && p.mark.node === id);
  const make = (parts: Drawn[], rename: Record<string, string> = {}) => {
    const m = read(parts);
    const { names, marks } = named(parts, m);
    for (const [from, to] of Object.entries(rename)) for (const [k, v] of Object.entries(names)) if (v === from) names[k] = to;
    const made = makeGraph(m, names, marks, grind);
    if ("error" in made) throw new Error(made.error);
    return made;
  };

  it("renames a step and keeps the rest of it", () => {
    const step = grind.nodes[0]!;
    const made = make(drawn(grind), { [step.name]: "Writer" });
    const now = made.doc.nodes.find((n) => n.id === step.id)!;
    expect(now).toEqual({ ...step, name: "Writer" });
  });

  it("takes away a step that is erased, with its edges", () => {
    const parts = drawn(grind);
    const gone = grind.nodes.find((n) => n.kind === "stop")!;
    const edges = new Set(grind.edges.filter((e) => e.from === gone.id || e.to === gone.id).map((e) => e.id));
    const left = parts.filter((p) => !byNode(parts, gone.id).includes(p) && !("edge" in p.mark && edges.has(p.mark.edge)));
    const made = make(left);
    expect(made.doc.nodes.map((n) => n.id)).not.toContain(gone.id);
    expect(made.doc.edges.some((e) => e.from === gone.id || e.to === gone.id)).toBe(false);
    expect(made.counts.removed).toBe(1);
  });

  it("adds a step drawn beside the graph, named for its name, with what was guessed of it", () => {
    const parts = drawn(grind);
    const all = parts.flatMap((p) => p.pts);
    const right = Math.max(...all.map((p) => p[0])) + 120, top = Math.min(...all.map((p) => p[1]));
    const extra: Drawn = { pts: [[right, top], [right + 150, top], [right + 150, top + 64], [right, top + 64], [right, top + 2]], name: "Researcher", mark: { node: "" } };
    const m = read([...parts, extra]);
    const { names, marks } = named([...parts, extra], m);
    const shapeId = m.nodes.find((n) => n.strokes.includes(parts.length))!.id;
    names[shapeId] = "Look it up";
    delete marks.nodes[shapeId];
    const made = makeGraph(m, names, marks, grind);
    if ("error" in made) throw new Error(made.error);
    const added = made.doc.nodes.find((n) => n.name === "Look it up")!;
    expect(added).toMatchObject({ id: "look-it-up", kind: "agent", role: "builder" });
    expect(made.counts).toMatchObject({ added: 1, removed: 0 });
    expect(made.guesses.some((g) => g.startsWith("Look it up: "))).toBe(true);
    expect(made.guesses.some((g) => grind.nodes.some((n) => g.startsWith(`${n.name}: `)))).toBe(false);
  });

  it("keeps an edge's condition when its line is drawn again with no name", () => {
    const parts = drawn(grind);
    // Every line loses its mark and its name, as lines drawn again by hand would have neither.
    const plain = parts.map((p): Drawn => (p.line ? { pts: p.pts, line: true, mark: { node: "" } } : p));
    const m = read(plain);
    const { names, marks } = named(plain, m);
    const made = makeGraph(m, names, marks, grind);
    if ("error" in made) throw new Error(made.error);
    expect(shape(made.doc).edges).toEqual(shape(grind).edges);
  });

  it("puts a step drawn into a loop's cycle in that loop, which keeps its way back and its stops", () => {
    const parts = drawn(grind);
    const edge = (id: Id) => parts.filter((p) => "edge" in p.mark && p.mark.edge === id);
    const box = (id: Id) => bbox(byNode(parts, id).flatMap((p) => p.pts));
    const builder = box("builder"), tests = box("tests");
    // The arrow from the builder to the tests goes; a box to their left, and arrows through it, come.
    const x = builder.x0 - 260, y = (builder.cy + tests.cy) / 2;
    const lint: Drawn = { pts: [[x, y - 32], [x + 150, y - 32], [x + 150, y + 32], [x, y + 32], [x, y - 30]], name: "Lint", mark: { node: "" } };
    const into: Drawn = { pts: cleanArrow([builder.x0 - 7, builder.cy], [x + 75, y - 39], 1), line: true, mark: { node: "" } };
    const out: Drawn = { pts: cleanArrow([x + 75, y + 39], [tests.x0 - 7, tests.cy], 1), line: true, mark: { node: "" } };
    const left = [...parts.filter((p) => !edge("e-builder-tests").includes(p)), lint, into, out];
    const m = read(left);
    const { names, marks } = named(left, m);
    for (const n of m.nodes) if (n.strokes.includes(left.indexOf(lint))) delete marks.nodes[n.id];
    const made = makeGraph(m, names, marks, grind);
    if ("error" in made) throw new Error(made.error);
    expect(made.doc.loops).toHaveLength(1);
    expect([...made.doc.loops[0]!.members].sort()).toEqual(["builder", "lint", "tests"]);
    expect(made.doc.loops[0]!.stops).toEqual(grind.loops[0]!.stops);
    expect(made.doc.loops[0]!.back).toEqual(grind.loops[0]!.back);
    expect(validate(made.doc).filter((i) => i.code.startsWith("E_LOOP"))).toEqual([]);
  });

  it("makes a loop drawn round a loop a loop of its own, with its own way back, and leaves the loop inside as it was", () => {
    const parts = drawn(grind);
    const box = (id: Id) => bbox(byNode(parts, id).flatMap((p) => p.pts));
    const builder = box("builder"), tests = box("tests");
    const top = builder.y0 - 150, left = Math.min(builder.x0, tests.x0) - 90;
    const planner: Drawn = { pts: [[builder.x0, top], [builder.x1, top], [builder.x1, top + 64], [builder.x0, top + 64], [builder.x0, top + 2]], name: "Planner", mark: { node: "" } };
    const down: Drawn = { pts: cleanArrow([builder.cx, top + 71], [builder.cx, builder.y0 - 7], 1), line: true, mark: { node: "" } };
    const around = arrowAlong([[tests.x0 - 7, tests.cy], [left, tests.cy], [left, top + 32], [builder.x0 - 7, top + 32]]);
    const all = [...parts, planner, down, around];
    const m = read(all);
    const { names, marks } = named(all, m);
    for (const n of m.nodes) if (n.strokes.includes(all.indexOf(planner))) delete marks.nodes[n.id];
    const made = makeGraph(m, names, marks, grind);
    if ("error" in made) throw new Error(made.error);
    const inner = made.doc.loops.find((l) => l.id === grind.loops[0]!.id)!;
    expect(inner).toEqual(grind.loops[0]);
    const outer = made.doc.loops.find((l) => l !== inner)!;
    expect([...outer.members].sort()).toEqual(["builder", "planner", "tests"]);
    expect(outer.back).toHaveLength(1);
    expect(made.doc.edges.find((e) => e.id === outer.back[0])).toMatchObject({ from: "tests", to: "planner" });
    expect(made.guesses.some((g) => g.includes("so a loop with no stops"))).toBe(true);
    expect(validate(made.doc).filter((i) => i.code === "E_LOOP_BACK_EDGE")).toEqual([]);
  });

  it("leaves out, and says so, a line from a step to the edge of its own box", () => {
    const boxed: Graph = { ...grind, groups: [{ id: "a-box", name: "A box", members: ["done"] }] };
    const { parts, unboxed } = drawing(boxed);
    expect(unboxed).toEqual([]);
    const done = bbox(parts.filter((p) => "node" in p.mark && p.mark.node === "done").flatMap((p) => p.pts));
    const frame = bbox(parts.filter((p) => "group" in p.mark).flatMap((p) => p.pts));
    const out = { pts: cleanArrow([done.x1 + 7, done.cy], [frame.x1 + 2, done.cy], 1), line: true, mark: { node: "" } } satisfies Drawn;
    const all = [...parts, out];
    const m = read(all);
    const { names, marks } = named(all, m);
    const made = makeGraph(m, names, marks, boxed, unboxed);
    if ("error" in made) throw new Error(made.error);
    expect(made.doc.edges.some((e) => e.from === e.to)).toBe(false);
    expect(made.doc.edges).toEqual(boxed.edges);
    expect(made.left).toContain("A line that ends on a box with no other step in it was left out.");
  });

  it("lets go of a judge's answer key when the step it came from is erased, as the canvas does", () => {
    const spec = patterns.find((d) => d.id === "spec-then-loop")!;
    const parts = drawn(spec);
    const gone = new Set(spec.edges.filter((e) => e.from === "planner" || e.to === "planner").map((e) => e.id));
    const left = parts.filter((p) => !("node" in p.mark && p.mark.node === "planner") && !("edge" in p.mark && gone.has(p.mark.edge)));
    const m = read(left);
    const { names, marks } = named(left, m);
    const made = makeGraph(m, names, marks, spec);
    if ("error" in made) throw new Error(made.error);
    expect(made.doc.nodes.map((n) => n.id)).not.toContain("planner");
    expect(made.doc.loops.some((l) => l.bar?.answerKeyFrom !== undefined)).toBe(false);
    expect(validate(made.doc).filter((i) => i.code === "E_DANGLING_REF")).toEqual([]);
  });

  it("says why a drawing with no shape makes no graph", () => {
    const made = makeGraph(read([{ pts: [[0, 0], [100, 4], [200, 0]], mark: { node: "" } }]), {}, { nodes: {}, edges: {}, groups: {} }, grind);
    expect(made).toEqual({ error: "No shapes were read. Draw a closed shape, like a box or a circle." });
  });
});
