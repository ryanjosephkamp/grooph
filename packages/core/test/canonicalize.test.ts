/** Canonical form, graph-ir §7. */

import assert from "node:assert/strict";
import { test } from "node:test";

import { canonicalize, canonicalizeWithoutLayout } from "../src/canonicalize.js";
import { parseGraphText } from "../src/parse.js";
import { validate } from "../src/validate.js";
import type { Graph } from "../src/types.js";
import { read, validFixtures } from "./helpers.js";

const load = (path: string): Graph => {
  const parsed = parseGraphText(read(path));
  assert.ok(parsed.doc, `fixture should parse: ${path}`);
  return parsed.doc;
};

const reviewLoop = (): Graph => load(validFixtures().find((f) => f.name.startsWith("review-loop"))!.path);

test("canonical form is two-space indented, LF, one trailing newline", () => {
  const text = canonicalize(reviewLoop());
  assert.ok(text.endsWith("}\n"), "ends with exactly one newline after the closing brace");
  assert.ok(!text.endsWith("\n\n"));
  assert.ok(!text.includes("\r"), "no CR anywhere");
  assert.match(text, /^\{\n {2}"grooph": 0,\n/, "two-space indent, document version first");
});

test("canonicalize is deterministic and idempotent", () => {
  const doc = reviewLoop();
  const once = canonicalize(doc);
  assert.equal(canonicalize(doc), once, "same input, same output");

  const reparsed = parseGraphText(once);
  assert.deepEqual(reparsed.issues, []);
  assert.equal(canonicalize(reparsed.doc!), once, "canonicalizing a canonical document changes nothing");
});

test("key order follows the types, with layout last", () => {
  const doc = reviewLoop();
  const canonical = JSON.parse(canonicalize(doc)) as Record<string, unknown>;
  assert.deepEqual(Object.keys(canonical), [
    "grooph",
    "id",
    "name",
    "version",
    "goal",
    "target",
    "constraints",
    "lineage",
    "description",
    "nodes",
    "edges",
    "loops",
    "policies",
    "layout",
  ]);

  const node = (canonical["nodes"] as Record<string, unknown>[])[0]!;
  assert.deepEqual(Object.keys(node), [
    "id",
    "name",
    "kind",
    "role",
    "model",
    "effort",
    "brief",
    "inputs",
    "outputs",
    "allow",
    "owns",
  ]);

  const loop = (canonical["loops"] as Record<string, unknown>[])[0]!;
  assert.deepEqual(Object.keys(loop), ["id", "name", "members", "back", "mode", "bar", "stops"]);
  assert.deepEqual(Object.keys(loop["bar"] as object), ["name", "inspects", "acceptance"]);
});

test("input key order does not change the output", () => {
  const doc = reviewLoop();
  const shuffled = JSON.parse(canonicalize(doc)) as Record<string, unknown>;
  const reversed: Record<string, unknown> = {};
  for (const key of Object.keys(shuffled).reverse()) reversed[key] = shuffled[key];
  assert.equal(canonicalize(reversed as unknown as Graph), canonicalize(doc));
});

test("unknown keys come last, alphabetically, and survive", () => {
  const doc = { ...reviewLoop(), zebra: 1, alpha: { b: 2, a: 1 } } as unknown as Graph;
  const canonical = JSON.parse(canonicalize(doc)) as Record<string, unknown>;
  const keys = Object.keys(canonical);
  assert.deepEqual(keys.slice(-2), ["alpha", "zebra"], "unknown keys last, alphabetical");
  assert.deepEqual(Object.keys(canonical["alpha"] as object), ["a", "b"], "inside an unknown value too");
});

test("layout keys are sorted, because map keys are data", () => {
  const doc = reviewLoop();
  const canonical = JSON.parse(canonicalize(doc)) as { layout: Record<string, unknown> };
  assert.deepEqual(Object.keys(canonical.layout), [...Object.keys(canonical.layout)].sort());
});

test("the size lint ignores layout (amendment A-005)", () => {
  const doc = reviewLoop();
  const withLayout: Graph = {
    ...doc,
    layout: Object.fromEntries(
      Array.from({ length: 2000 }, (_, i) => [`node-${i}`, { x: i, y: i, w: 120, h: 64 }]),
    ),
  };
  assert.ok(canonicalize(withLayout).length > 24_000, "the document with layout is over the budget");
  assert.ok(canonicalizeWithoutLayout(withLayout).length < 24_000);
  assert.deepEqual(validate(withLayout), [], "so the size warning does not fire");
});
