/**
 * The proof that composing works (decision 0025; handoff 0085, item 5). The built-in `debate-then-build` is cut into
 * two templates and put together again as two subgroophs (`src/dev/composed.ts`, files under `fixtures/composed/`).
 * What it compiles to is held against what the flat original compiles to: the agent files are the same but for
 * names, and the lead's brief says the same things and names the two units.
 */

import assert from "node:assert/strict";
import { existsSync, readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { test } from "node:test";

import { canonicalize } from "../src/canonicalize.js";
import { COMPOSED, composedProof, type Composed } from "../src/dev/composed.js";
import { compile, picture } from "../src/index.js";
import { parseGraph, parseGraphText } from "../src/parse.js";
import { refreshSubgrooph } from "../src/subgrooph.js";
import type { Graph } from "../src/types.js";
import { validate } from "../src/validate.js";
import { fixturesDir, read, repoRoot } from "./helpers.js";

const WRITE = "run `pnpm --filter @grooph/core run golden:write` and read what changed";
const template = (): Graph => parseGraphText(read(join(repoRoot, "patterns", `${COMPOSED.template}.grooph.json`))).doc!;
const proof = (): Composed => composedProof(template());
const committed = (id: string): Graph => parseGraphText(read(join(fixturesDir, "composed", `${id}.grooph.json`))).doc!;
/** A text of the composed package with every name put back to the flat original's: ids, longest first, and the graph's name. */
const renamed = (text: string, made: Composed): string =>
  Object.entries(made.names)
    .sort((a, b) => b[0].length - a[0].length)
    .reduce((now, [to, from]) => now.split(to).join(from), text)
    .split(made.graph.name)
    .join(made.flat.name);
const walk = (dir: string): string[] =>
  readdirSync(dir)
    .sort()
    .flatMap((name) => (statSync(join(dir, name)).isDirectory() ? walk(join(dir, name)) : [join(dir, name)]));

test("the files under fixtures/composed are what cutting the built-in in two and placing the halves gives", () => {
  const made = proof();
  for (const doc of [...made.parts, made.graph]) {
    const file = join(fixturesDir, "composed", `${doc.id}.grooph.json`);
    assert.ok(existsSync(file), `${file} is missing: ${WRITE}`);
    assert.equal(read(file), canonicalize(doc), `${file} is stale: ${WRITE}`);
  }
  // Two subgroophs, each its template's nodes under its own prefix, and the one edge that ran between the halves.
  assert.deepEqual(
    made.graph.groups!.map((group) => [group.id, group.from, group.members.length]),
    [
      ["debate", "debate-to-a-plan@1", 4],
      ["build", "build-to-green@1", 3],
    ],
  );
  assert.deepEqual(made.graph.edges.filter((edge) => edge.from.startsWith("debate-") !== edge.to.startsWith("debate-")).map((edge) => [edge.id, edge.when]), [["e-debate-plan-gate-build-builder", "pass"]]);
  assert.equal(made.graph.nodes.length, made.flat.nodes.length);
  assert.equal(made.graph.edges.length, made.flat.edges.length);
  assert.deepEqual(made.graph.policies, made.flat.policies, "what holds for the whole graph is the graph's, and is kept");
});

test("composed, it passes every rule the flat original passes, and each half is current with its template", () => {
  const made = proof();
  const issues = (doc: Graph): string[] => validate(parseGraph(JSON.parse(canonicalize(doc))).doc!, { forExport: true }).map((issue) => `${issue.severity} ${issue.code}`);
  assert.deepEqual(issues(made.graph), issues(made.flat));
  assert.deepEqual(issues(made.graph).filter((line) => line.startsWith("error")), []);
  made.graph.groups!.forEach((group, i) => assert.deepEqual(refreshSubgrooph(made.graph, group.id, made.parts[i]!).changes, [], `${group.id} differs from its own template`));
});

test("the composed package's agent files are the flat original's, but for names", () => {
  const made = proof();
  const flat = compile(made.flat, "claude-code").files;
  const composed = compile(committed(COMPOSED.id), "claude-code").files;
  const agents = (files: Record<string, string>): string[] => Object.keys(files).filter((path) => path.startsWith(".claude/agents/")).sort();
  assert.equal(agents(composed).length, 4);
  assert.deepEqual(agents(composed).map((path) => renamed(path, made)).sort(), agents(flat));
  for (const path of agents(composed)) assert.equal(renamed(composed[path]!, made), flat[renamed(path, made)], `${path} is not ${renamed(path, made)} under other names`);
  // And they do differ in names: the test above is not comparing a file with itself.
  assert.notEqual(composed[agents(composed)[0]!], flat[agents(flat)[0]!]);
});

test("the composed lead's brief says what the flat one says, and names the two units", () => {
  const made = proof();
  const flat = compile(made.flat, "claude-code").files[`.grooph/${made.flat.id}/LEAD.md`]!;
  const composed = compile(made.graph, "claude-code").files[`.grooph/${made.graph.id}/LEAD.md`]!;
  const start = composed.indexOf("### Units");
  const end = composed.indexOf("## 5. Edges");
  assert.ok(start > 0 && end > start, "the brief has no Units table");
  const units = composed.slice(start, end);
  assert.match(units, /\| Debate to a plan \| `debate` \| `debate-to-a-plan@1` \| `debate-planner-a`, `debate-planner-b`, `debate-judge`, `debate-plan-gate` \| nothing leads in \| `build-builder` \|/);
  assert.match(units, /\| Build to green \| `build` \| `build-to-green@1` \| `build-builder`, `build-tests`, `build-done` \| `build-builder` \| its own stop \|/);
  // Without that table and under the old names, it is the flat brief line for line; only the order of the rows that
  // list edges differs, since the edge between the halves was added last.
  const lines = (text: string): string[] => text.split("\n").filter((line) => line.trim() !== "").sort();
  assert.deepEqual(lines(renamed(composed.slice(0, start) + composed.slice(end), made)), lines(flat));
});

test("the composed package equals its golden package, byte for byte; and its picture is two boxes", () => {
  const goldenDir = join(fixturesDir, "golden", "claude-code", COMPOSED.id);
  assert.ok(existsSync(goldenDir), `the golden package is missing: ${WRITE}`);
  const result = compile(committed(COMPOSED.id), "claude-code");
  const golden = walk(goldenDir).map((path) => relative(goldenDir, path).split(sep).join("/"));
  assert.deepEqual(Object.keys(result.files).sort(), golden.sort(), `the same set of files: ${WRITE}`);
  for (const path of golden) assert.equal(result.files[path], read(join(goldenDir, path)), `${path} differs from the golden package: ${WRITE}`);
  const svg = picture(committed(COMPOSED.id), { theme: "light" });
  assert.deepEqual([...svg.matchAll(/<g data-(node|group)="([^"]+)">/g)].map((m) => `${m[1]}:${m[2]}`), ["group:debate", "group:build"]);
  assert.match(svg, />debate-to-a-plan@1 · 4 nodes · 1 human gate · 1 loop<\/text>/);
});
