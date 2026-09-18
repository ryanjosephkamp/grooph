import { describe, expect, it } from "vitest";

import type { Graph } from "@grooph/core";

import { autoLayout, resolvePositions } from "../src/doc/layout.js";
import { reviewLoop } from "./helpers.js";

const withoutLayout = (): Graph => {
  const { layout: _layout, ...rest } = reviewLoop();
  return rest as Graph;
};

describe("automatic layout (A-005)", () => {
  it("places every node, top to bottom along the forward edges", () => {
    const positions = autoLayout(withoutLayout());
    expect(Object.keys(positions).sort()).toEqual(["builder", "critic", "done", "merge-gate"]);
    const y = (id: string) => positions[id]!.y;
    expect(y("builder")).toBeLessThan(y("critic"));
    expect(y("critic")).toBeLessThan(y("merge-gate"));
    expect(y("merge-gate")).toBeLessThan(y("done"));
  });

  it("does not touch the document", () => {
    const doc = withoutLayout();
    const before = JSON.stringify(doc);
    resolvePositions(doc);
    expect(JSON.stringify(doc)).toBe(before);
    expect(doc.layout).toBeUndefined();
  });

  it("uses the document's layout where there is one", () => {
    const { positions, unplaced } = resolvePositions(reviewLoop());
    expect(unplaced).toEqual([]);
    expect(positions["critic"]).toEqual({ x: 380, y: 160 });
  });

  it("puts nodes missing from a partial layout below the placed ones", () => {
    const doc = reviewLoop();
    const { done: _done, ...layout } = doc.layout!;
    const { positions, unplaced } = resolvePositions({ ...doc, layout });
    expect(unplaced).toEqual(["done"]);
    expect(positions["done"]!.y).toBeGreaterThan(160);
  });

  it("survives a cycle no loop covers", () => {
    const doc = withoutLayout();
    const positions = autoLayout({ ...doc, loops: [] });
    expect(Object.keys(positions)).toHaveLength(4);
    const distinct = new Set(Object.values(positions).map((p) => `${p.x},${p.y}`));
    expect(distinct.size).toBe(4);
  });

  it("wraps a wide row so a phone shows it at a legible zoom", () => {
    const doc = withoutLayout();
    const unconnected = { ...doc, edges: [], loops: [] };
    const narrow = autoLayout(unconnected, 2);
    expect(new Set(Object.values(narrow).map((p) => p.y)).size).toBe(2); // two rows of two
    const wide = autoLayout(unconnected, 4);
    expect(new Set(Object.values(wide).map((p) => p.y)).size).toBe(1);
  });
});
