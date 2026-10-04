/**
 * docs/agents.md is what an agent reads to use grooph, so what it shows has to be what
 * grooph does: its example document validates, its operation lists apply in order and use
 * every operation, its repair lines are the ones the tools print, and it names every tool.
 */

import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

import { IMPLEMENTED_CODES, OP_NAMES, applyOps, estimateShape, newGraph, parseGraph, shapeLine, validate, type Graph } from "@grooph/core";

import { FIXES } from "../src/fixes.js";
import { toolNames } from "../src/mcp.js";

const repoRoot = (() => {
  let dir = dirname(fileURLToPath(import.meta.url));
  for (let i = 0; i < 10; i += 1) {
    if (existsSync(join(dir, "pnpm-workspace.yaml"))) return dir;
    dir = dirname(dir);
  }
  throw new Error("workspace root not found");
})();

const page = readFileSync(join(repoRoot, "docs", "agents.md"), "utf8");
const blocks = [...page.matchAll(/^```json\n([\s\S]*?)\n```$/gm)].map((m) => JSON.parse(m[1]!) as unknown);

test("the page's example document is a graph that validates for export", () => {
  const docs = blocks.filter((b): b is Graph => typeof b === "object" && b !== null && !Array.isArray(b) && (b as { grooph?: unknown }).grooph === 0);
  assert.equal(docs.length, 1);
  const parsed = parseGraph(docs[0]);
  assert.ok(parsed.doc, JSON.stringify(parsed.issues));
  assert.deepEqual(validate(parsed.doc, { forExport: true }), []);
});

test("the page's operation lists apply in order, use every operation, and end at the graph the page describes", () => {
  const lists = blocks.filter((b): b is { op: string }[] => Array.isArray(b) && b.every((o) => typeof (o as { op?: unknown }).op === "string"));
  assert.ok(lists.length >= 6);
  let doc = newGraph({ name: "Checkout" });
  const used = new Set<string>();
  for (const ops of lists) {
    const result = applyOps(doc, ops);
    assert.ok(result.ok, result.ok ? "" : `${result.error.op} (ops[${result.error.index}]): ${result.error.message}`);
    doc = result.doc;
    for (const o of ops) used.add(o.op);
  }
  assert.deepEqual(OP_NAMES.filter((name) => !used.has(name)), [], "an operation the page gives no example of");
  assert.equal(doc.id, "checkout-fix");
  const checked = parseGraph(JSON.parse(JSON.stringify(doc)));
  assert.ok(checked.doc);
  assert.deepEqual(validate(checked.doc, { forExport: true }), []);
  assert.equal(shapeLine(estimateShape(checked.doc)), "3 agents · 1 check · 1 gate · 1 loop · up to 3 rounds · 16 dispatches");
  assert.match(page, /three agents, a check, a human gate and one loop of at most three rounds/);
});

test("the page gives, for every rule, the repair line the tools print", () => {
  for (const code of IMPLEMENTED_CODES) assert.ok(page.includes(`- \`${code}\` ${FIXES[code]}\n`), `${code}: the page's line is not the one in fixes.ts`);
  // And it lists no code grooph does not have.
  for (const [, code] of page.matchAll(/^- `([EW]_[A-Z_]+)` /gm)) assert.ok((IMPLEMENTED_CODES as readonly string[]).includes(code!), code);
});

test("the page names every authoring tool, and the three it leaves to another page", () => {
  for (const name of toolNames({ chat: true })) assert.ok(page.includes(`| \`${name}\` |`), `${name} is not in the page's table`);
  for (const name of toolNames().filter((n) => !toolNames({ chat: true }).includes(n))) assert.ok(page.includes(`\`${name}\``), name);
});
