import { describe, expect, it } from "vitest";

import type { Graph } from "@grooph/core";

import { NODE_HEIGHT, NODE_WIDTH, autoLayout } from "../src/doc/layout.js";
import { edgeBends, type Box } from "../src/ui/canvas/bends.js";
import { reviewLoop } from "./helpers.js";

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
