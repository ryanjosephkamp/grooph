import { rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { newGraph, type Graph } from "@grooph/core";
import { describe, expect, it } from "vitest";

// @ts-expect-error: a script of the repository's, in plain JavaScript, with no types.
import { DEST, drifted } from "../../../scripts/mermaidify.mjs";
import { exampleStrokes } from "../src/ui/sketch/mermaidify/example.js";
import type { DrawnStroke } from "../src/ui/sketch/mermaidify/app/pad.js";
import { recognize, type Reading } from "../src/ui/sketch/mermaidify/reader/recognize.js";
import { makeGraph } from "../src/ui/sketch/graph.js";

/**
 * The Sketch view (src/ui/sketch/): mermaidify's reader reads strokes drawn by hand, and grooph makes a graph of what
 * it read. These hold the two together, and the copy of mermaidify's files to its release; sketch-graph.test.ts
 * holds a graph drawn and read back.
 */

type P = [number, number];
/** A line drawn by hand: a point every few units, with a little wobble. */
const line = (a: P, b: P): P[] => {
  const n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 4));
  return Array.from({ length: n + 1 }, (_, i): P => [a[0] + ((b[0] - a[0]) * i) / n + Math.sin(i * 0.7) * 0.8, a[1] + ((b[1] - a[1]) * i) / n + Math.cos(i * 0.5) * 0.8]);
};
const path = (...pts: P[]): P[] => pts.slice(1).flatMap((b, i) => line(pts[i]!, b).slice(i ? 1 : 0));
const box = (x: number, y: number, w: number, h: number): P[] => path([x, y], [x + w, y], [x + w, y + h], [x, y + h], [x, y + 4]);
const strokes = (...drawn: P[][]): DrawnStroke[] => drawn.map((pts, id) => ({ id, color: "ink", pts, by: "mouse" }));

/** Two boxes, one over the other, and an arrow from the first to the second. */
const twoSteps = (): P[][] => [box(60, 60, 160, 80), box(60, 260, 160, 80), path([140, 146], [140, 254]), path([132, 244], [140, 254], [148, 244])];

const readSketch = (drawn: DrawnStroke[]): Reading => recognize(drawn, { diagram: "flowchart" });
const empty = (): Graph => newGraph({ name: "Sketch", id: "sketch" });
/** The graph a drawing makes of an empty graph, with names typed for its shapes and lines by the reading's ids. */
const made = (reading: Reading, names: Record<string, string> = {}): Graph => {
  const result = makeGraph(reading, names, { nodes: {}, edges: {}, groups: {} }, empty());
  if ("error" in result) throw new Error(result.error);
  return result.doc;
};

describe("Sketch", () => {
  it("draws with mermaidify's files exactly as its release has them", () => {
    expect(drifted()).toEqual([]);
  });

  it("calls a file put in beside the release's out, and passes over the computer's own dotfiles", () => {
    const extra = join(DEST, "reader", "extra.ts"), finder = join(DEST, ".DS_Store");
    try {
      writeFileSync(finder, "x");
      expect(drifted()).toEqual([]);
      writeFileSync(extra, "export {};\n");
      expect(drifted()).toEqual(["reader/extra.ts: not part of the release; delete it"]);
    } finally {
      rmSync(extra, { force: true });
      rmSync(finder, { force: true });
    }
  });

  it("makes the example a graph: an agent that looks things up, a builder and a critic in a loop, and a stop", () => {
    const doc = made(readSketch(strokes(...exampleStrokes(400).map((s) => s.pts))));
    expect(doc.name).toBe("Sketch");
    expect(doc.nodes.map((n) => [n.name, n.kind, n.kind === "agent" ? n.role : undefined])).toEqual([
      ["Node 1", "agent", "researcher"],
      ["Node 2", "agent", "builder"],
      ["Node 3", "agent", "critic"],
      ["Node 4", "stop", undefined],
    ]);
    expect(doc.edges).toHaveLength(4);
    expect(doc.loops.map((l) => l.members)).toEqual([["node-2", "node-3"]]);
  });

  it("reads boxes and an arrow drawn by hand, and leaves out a mark that is not a shape or a line", () => {
    const reading = readSketch(strokes(...twoSteps(), path([300, 400], [310, 380], [320, 400], [330, 380])));
    expect(reading.nodes.map((n) => n.kind)).toEqual(["rect", "rect"]);
    expect(reading.edges.map((e) => [e.from, e.to])).toEqual([["A", "B"]]);
    expect(reading.unused).toEqual([4]);
    const doc = made(reading, { A: "Plan", B: "Build" });
    expect(doc.nodes.map((n) => [n.id, n.name])).toEqual([["plan", "Plan"], ["build", "Build"]]);
    expect(doc.edges.map((e) => [e.from, e.to])).toEqual([["plan", "build"]]);
  });

  it("gives back a name as it was typed, whatever Mermaid would make of its quotes, codes, and tags, on a step and on a line", () => {
    const reading = readSketch(strokes(...twoSteps()));
    for (const name of ['Say "hi"', '"Ship it"', "'Twas the night", "Fix #42; then ship", "Sprint #3; review", "A<br>B", "`code`", '"', "''", "<br>", "#32;", "#0;", "a & b", "&lt;tag&gt;", "50% done: ok?"]) {
      const doc = made(reading, { A: name, L1: name });
      expect(doc.nodes[0]!.name, name).toBe(name);
      expect(doc.edges[0]!.label, name).toBe(name);
    }
  });

  it("gathers a name typed on several lines onto one", () => {
    expect(made(readSketch(strokes(...twoSteps())), { A: "  Ship   the\nfix " }).nodes[0]!.name).toBe("Ship the fix");
  });

  it("finds no shape in a drawing without one, and says so in place of a graph", () => {
    expect(readSketch(strokes(path([20, 20], [200, 40]))).nodes).toEqual([]);
    expect(makeGraph(readSketch([]), {}, { nodes: {}, edges: {}, groups: {} }, empty())).toEqual({ error: "No shapes were read. Draw a closed shape, like a box or a circle." });
  });
});
