import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import type { Graph } from "@grooph/core";

import { NODE_HEIGHT, NODE_WIDTH, autoLayout } from "../src/doc/layout.js";
import { edgeBends, edgeCurve, edgeLabelSize, labelSize, labelSpots, pointAt, type Box } from "../src/ui/canvas/bends.js";
import { repoRoot, reviewLoop } from "./helpers.js";

const boxesFor = (doc: Graph, positions: Record<string, { x: number; y: number }>): Record<string, Box> =>
  Object.fromEntries(doc.nodes.map((n) => [n.id, { ...positions[n.id]!, w: NODE_WIDTH, h: NODE_HEIGHT }]));

describe("edge bends", () => {
  it("keeps unobstructed forward edges straight", () => {
    const doc = reviewLoop();
    const bends = edgeBends(doc, boxesFor(doc, doc.layout!));
    expect(bends.get("e-build-review")).toBe(0);
    expect(bends.get("e-gate-approve")).toBe(0);
  });

  it("bows back edges to the right, clearing the node in between", () => {
    const doc = reviewLoop();
    const bends = edgeBends(doc, boxesFor(doc, doc.layout!));
    // merge-gate → builder runs right to left past the critic; right of travel is up.
    const around = bends.get("e-gate-reject")!;
    expect(around).toBeGreaterThan(NODE_HEIGHT / 2 + 14);
    expect(bends.get("e-review-fail")).toBeGreaterThan(0);
  });

  it("routes an edge that would cross a node around it, before any loop exists", () => {
    const { layout: _layout, ...rest } = reviewLoop();
    const doc = { ...(rest as Graph), loops: [] };
    const positions = autoLayout(doc); // a vertical column: builder, critic, merge-gate, done
    const bends = edgeBends(doc, boxesFor(doc, positions));
    const bend = Math.abs(bends.get("e-gate-reject")!);
    // The critic sits on the straight line; the curve's middle must pass beyond its half-width.
    expect(bend).toBeGreaterThan(NODE_WIDTH / 2);
  });

  it("separates edges that share a pair of nodes", () => {
    const doc: Graph = {
      grooph: 0,
      id: "g",
      name: "G",
      version: 1,
      nodes: [
        { id: "a", kind: "stop", name: "A" },
        { id: "b", kind: "stop", name: "B" },
      ],
      edges: [
        { id: "e1", from: "a", to: "b" },
        { id: "e2", from: "a", to: "b", when: "fail" },
      ],
      loops: [],
    };
    const bends = edgeBends(doc, boxesFor(doc, { a: { x: 0, y: 0 }, b: { x: 400, y: 0 } }));
    expect(bends.get("e1")).toBe(0);
    expect(bends.get("e2")).not.toBe(0);
  });
});

describe("edge labels", () => {
  const pattern = (id: string): Graph => JSON.parse(readFileSync(join(repoRoot, "patterns", `${id}.grooph.json`), "utf8")) as Graph;
  const overlaps = (r: Box, o: Box) => r.x < o.x + o.w && r.x + r.w > o.x && r.y < o.y + o.h && r.y + r.h > o.y;
  const labelRect = (doc: Graph, boxes: Record<string, Box>, bends: Map<string, number>, id: string, t: number): Box => {
    const edge = doc.edges.find((e) => e.id === id)!;
    const p = pointAt(edgeCurve(boxes[edge.from]!, boxes[edge.to]!, bends.get(id) ?? 0), t);
    const size = edgeLabelSize(edge);
    return { x: p.x - size.w / 2, y: p.y - size.h / 2, w: size.w, h: size.h };
  };
  const covered = (doc: Graph, columns: number, spotsOf: (boxes: Record<string, Box>, bends: Map<string, number>) => Map<string, number>): string[] => {
    const boxes = boxesFor(doc, autoLayout(doc, columns));
    const bends = edgeBends(doc, boxes);
    const spots = spotsOf(boxes, bends);
    return doc.edges.filter((e) => e.from !== e.to && Object.values(boxes).some((b) => overlaps(labelRect(doc, boxes, bends, e.id, spots.get(e.id) ?? 0.5), b))).map((e) => e.id);
  };

  it("keeps a label in the middle of its edge when the middle is clear", () => {
    const doc = reviewLoop();
    const boxes = boxesFor(doc, doc.layout!);
    const spots = labelSpots(doc, boxes, edgeBends(doc, boxes));
    for (const edge of doc.edges) expect(spots.get(edge.id)).toBe(0.5);
  });

  it("moves a back edge's label off the node it would cover (the critic bank's `fail`, review item 12)", () => {
    const doc = pattern("specialist-critic-bank");
    for (const columns of [2, 4]) {
      // In the middle, at least one label sits on a node; placed, none does.
      expect(covered(doc, columns, () => new Map()).length, `columns ${columns}, labels in the middle`).toBeGreaterThan(0);
      expect(covered(doc, columns, (boxes, bends) => labelSpots(doc, boxes, bends)), `columns ${columns}, labels placed`).toEqual([]);
    }
  });

  it("measures a label as it is drawn: an approval on an always edge is a chip with both, and `approval: false` is no chip", () => {
    const edge = (extra: object) => ({ id: "e", from: "a", to: "b", ...extra }) as Graph["edges"][number];
    expect(edgeLabelSize(edge({}))).toEqual({ w: 14, h: 14 });
    expect(edgeLabelSize(edge({ approval: false }))).toEqual({ w: 14, h: 14 });
    expect(edgeLabelSize(edge({ approval: true }))).toEqual(labelSize("always", true));
    expect(edgeLabelSize(edge({ when: "fail" }))).toEqual(labelSize("fail", false));
    expect(edgeLabelSize(edge({ when: "fail", approval: false }))).toEqual(labelSize("fail", false));

    // An approval edge that passes a node: measured as the dot it would sit in the middle, over the node; measured as drawn, it moves.
    const doc = { ...reviewLoop(), loops: [], nodes: reviewLoop().nodes.slice(0, 3), edges: [] } as Graph;
    const [a, between, b] = doc.nodes.map((n) => n.id) as [string, string, string];
    doc.edges = [{ id: "e", from: a, to: b, approval: true }] as Graph["edges"];
    const boxes: Record<string, Box> = {
      [a]: { x: 0, y: 0, w: NODE_WIDTH, h: NODE_HEIGHT },
      [between]: { x: 0, y: 160, w: NODE_WIDTH, h: NODE_HEIGHT },
      [b]: { x: 280, y: 320, w: NODE_WIDTH, h: NODE_HEIGHT },
    };
    const bends = edgeBends(doc, boxes);
    const spot = labelSpots(doc, boxes, bends).get("e")!;
    expect(spot).not.toBe(0.5);
    expect(overlaps(labelRect(doc, boxes, bends, "e", 0.5), boxes[between]!)).toBe(true);
    expect(Object.values(boxes).some((box) => overlaps(labelRect(doc, boxes, bends, "e", spot), box))).toBe(false);
  });

  it("leaves no label on a node in any built-in template, in the phone's two columns and in four", () => {
    const ids = readdirSync(join(repoRoot, "patterns")).filter((f) => f.endsWith(".grooph.json")).map((f) => f.replace(".grooph.json", ""));
    expect(ids.length).toBeGreaterThanOrEqual(20);
    for (const id of ids) {
      const doc = pattern(id);
      for (const columns of [2, 4]) expect(covered(doc, columns, (boxes, bends) => labelSpots(doc, boxes, bends)), `${id}, ${columns} columns`).toEqual([]);
    }
  });
});
