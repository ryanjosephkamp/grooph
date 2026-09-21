/**
 * Automatic layout (A-005), now in core (slice 0015) so the glyph and the
 * canvas agree. The web app's own tests cover its wrapper.
 */

import assert from "node:assert/strict";
import { join } from "node:path";
import { test } from "node:test";

import { autoLayout, layerNodes, resolvePositions } from "../src/layout.js";
import { parseGraphText } from "../src/parse.js";
import type { Graph } from "../src/types.js";
import { fixturesDir, read, repoRoot } from "./helpers.js";

const reviewLoop = (): Graph => parseGraphText(read(join(fixturesDir, "valid", "review-loop.grooph.json"))).doc!;
const withoutLayout = (): Graph => {
  const { layout: _layout, ...rest } = reviewLoop();
  return rest as Graph;
};

test("layerNodes: entries first, then one rank per forward edge, back edges ignored", () => {
  assert.deepEqual(layerNodes(withoutLayout()), [["builder"], ["critic"], ["merge-gate"], ["done"]]);
  const bank = parseGraphText(read(join(repoRoot, "patterns", "specialist-critic-bank.grooph.json"))).doc!;
  const rows = layerNodes(bank);
  assert.deepEqual(rows[0], ["builder"]);
  assert.equal(rows[1]!.length, 4, "the four critics share a rank");
  assert.deepEqual(rows.slice(2), [["triage"], ["gate"], ["done"]]);
  assert.equal(rows.flat().length, bank.nodes.length, "every node once");
});

test("autoLayout places every node top to bottom along the forward edges, and is deterministic", () => {
  const positions = autoLayout(withoutLayout());
  assert.deepEqual(Object.keys(positions).sort(), ["builder", "critic", "done", "merge-gate"]);
  const y = (id: string) => positions[id]!.y;
  assert.ok(y("builder") < y("critic") && y("critic") < y("merge-gate") && y("merge-gate") < y("done"));
  assert.deepEqual(autoLayout(withoutLayout()), positions);
});

test("autoLayout does not touch the document", () => {
  const doc = withoutLayout();
  const before = JSON.stringify(doc);
  resolvePositions(doc);
  assert.equal(JSON.stringify(doc), before);
});

test("resolvePositions uses the document's layout, and sets unplaced nodes below the placed ones", () => {
  const { positions, unplaced } = resolvePositions(reviewLoop());
  assert.deepEqual(unplaced, []);
  assert.deepEqual(positions["critic"], { x: 380, y: 160 });

  const doc = reviewLoop();
  const { done: _done, ...layout } = doc.layout!;
  const partial = resolvePositions({ ...doc, layout });
  assert.deepEqual(partial.unplaced, ["done"]);
  assert.ok(partial.positions["done"]!.y > 160);
});

test("autoLayout survives a cycle no loop covers and wraps a wide row", () => {
  const doc = withoutLayout();
  const positions = autoLayout({ ...doc, loops: [] });
  assert.equal(new Set(Object.values(positions).map((p) => `${p.x},${p.y}`)).size, 4);
  const unconnected = { ...doc, edges: [], loops: [] };
  assert.equal(new Set(Object.values(autoLayout(unconnected, 2)).map((p) => p.y)).size, 2, "two rows of two");
  assert.equal(new Set(Object.values(autoLayout(unconnected, 4)).map((p) => p.y)).size, 1);
});
