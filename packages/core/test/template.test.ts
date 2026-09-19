/**
 * Template operations (docs/templates.md §2): instantiate, insertFragment,
 * extractTemplate, templateIndexEntry, findSlots.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import { canonicalize } from "../src/canonicalize.js";
import { parseGraph } from "../src/parse.js";
import {
  TemplateError,
  estimateProfile,
  extractTemplate,
  fillSlots,
  findSlots,
  insertFragment,
  instantiate,
  templateIndex,
  templateIndexEntry,
  type TemplateMeta,
} from "../src/template.js";
import type { Graph, Template } from "../src/types.js";
import { validate } from "../src/validate.js";

const block: Template = {
  kind: "graph",
  title: "Build and check",
  summary: "A builder works until the tests pass.",
  whenToUse: "Done and good are the same.",
  profile: { cost: "low", speed: "fast", rigor: "light" },
  slots: [
    { key: "task", ask: "What should be built?", example: "Add a slugify function." },
    { key: "test-command", ask: "Which command runs the tests?", example: "pnpm test" },
  ],
  tags: ["grind"],
};

/** A small template: builder ⇄ tests, then done, with a scoped policy and a layout. */
const template = (): Graph => ({
  grooph: 0,
  id: "build-and-check",
  name: "Build and check",
  version: 3,
  goal: "{{task}}",
  target: { harness: "claude-code" },
  template: structuredClone(block),
  description: "Builds {{task}} and runs {{test-command}}.",
  nodes: [
    {
      id: "builder",
      kind: "agent",
      name: "Builder",
      role: "builder",
      brief: "Do {{task}}. Run {{test-command}} before reporting.",
      outputs: ["the change"],
      allow: ["read-files", "edit-files", "run-tests"],
    },
    { id: "tests", kind: "check", name: "Tests", check: { kind: "tests", run: "{{test-command}}", pass: "exit code 0" } },
    { id: "done", kind: "stop", name: "Done", outcome: "success" },
  ],
  edges: [
    { id: "e-builder-tests", from: "builder", to: "tests" },
    { id: "e-tests-fail", from: "tests", to: "builder", when: "fail", evidence: ["test output"] },
    { id: "e-tests-pass", from: "tests", to: "done", when: "pass" },
  ],
  loops: [
    {
      id: "grind",
      name: "Grind",
      members: ["builder", "tests"],
      back: ["e-tests-fail"],
      stops: [
        { kind: "max-iterations", n: 5 },
        { kind: "budget", measure: "minutes", limit: 20 },
      ],
    },
  ],
  policies: [{ id: "p-evidence", kind: "evidence-required", scope: "loop:grind" }],
  layout: { builder: { x: 0, y: 0 }, done: { x: 400, y: 0 }, tests: { x: 200, y: 0 } },
});

const values = { task: "Add a slugify function.", "test-command": "pnpm test" };

test("findSlots names each key once, with the objects holding it in document order", () => {
  assert.deepEqual(findSlots(template()), [
    { key: "task", at: ["build-and-check", "builder"] },
    { key: "test-command", at: ["build-and-check", "builder", "tests"] },
  ]);
  const withNote: Graph = { ...template(), notes: [{ id: "n-1", run: "r", at: "graph", text: "{{not-a-slot}}" }] };
  assert.equal(findSlots(withNote).length, 2, "run notes and the template block hold no slots");
});

test("instantiate fills slots, drops the block, and records where the graph came from", () => {
  const doc = instantiate(template(), { name: "Slugify", values });
  assert.equal(doc.template, undefined);
  assert.equal(doc.id, "slugify");
  assert.equal(doc.name, "Slugify");
  assert.equal(doc.version, 1);
  assert.deepEqual(doc.lineage, { pattern: "build-and-check", from: "build-and-check@3" });
  assert.equal(doc.goal, "Add a slugify function.");
  assert.equal((doc.nodes[1] as { check: { run: string } }).check.run, "pnpm test");
  assert.deepEqual(findSlots(doc), []);
  assert.deepEqual(doc.layout, template().layout, "layout is kept");
  assert.deepEqual(validate(doc, { forExport: true }), []);
});

test("instantiate leaves unfilled slots in place, where export refuses them", () => {
  const doc = instantiate(template(), { name: "Half done", values: { task: "Add a slugify function." } });
  assert.deepEqual(findSlots(doc).map((use) => use.key), ["test-command"]);
  assert.deepEqual([...new Set(validate(doc, { forExport: true }).map((i) => i.code))], ["E_UNFILLED_SLOT"]);
});

test("instantiate takes an explicit id, and never lets a derived id collide", () => {
  assert.equal(instantiate(template(), { name: "X", id: "my-graph", values }).id, "my-graph");
  assert.equal(instantiate(template(), { name: "Builder", values }).id, "builder-2", "the name's slug is a node id already");
});

test("instantiate refuses fragments, non-templates and values for slots that do not exist", () => {
  const fragment: Graph = { ...template(), template: { ...block, kind: "fragment" } };
  assert.throws(() => instantiate(fragment, { name: "X" }), (err: unknown) => err instanceof TemplateError && /fragment/.test(err.message));
  const { template: _t, ...plain } = template();
  assert.throws(() => instantiate(plain as Graph, { name: "X" }), /not a template/);
  assert.throws(() => instantiate(template(), { name: "X", values: { tsak: "x" } }), /no slot "tsak"; did you mean "task"\?/);
});

test("instantiate never mutates the template", () => {
  const source = template();
  const before = canonicalize(source);
  instantiate(source, { name: "Slugify", values });
  assert.equal(canonicalize(source), before);
});

const metaOf = (doc: Graph): TemplateMeta => {
  const t = doc.template!;
  return { id: doc.id, title: t.title, summary: t.summary, whenToUse: t.whenToUse, profile: t.profile, slots: t.slots, tags: t.tags };
};

test("instantiate then extract round-trips meaning", () => {
  const source = template();
  const graph = instantiate(source, { name: source.name, id: source.id });
  const back = extractTemplate(graph, { kind: "graph", meta: metaOf(source) });

  const strip = (doc: Graph): string => {
    const { lineage: _l, version: _v, ...rest } = doc;
    return canonicalize(rest as Graph);
  };
  assert.equal(strip(back), strip(source), "same nodes, edges, loops, policies, slots and text");
  assert.deepEqual(back.lineage, { pattern: "build-and-check", from: "build-and-check@1" });

  // And the filled route: a template made from a filled graph instantiates to the same graph.
  const filled = instantiate(source, { name: "Slugify", values });
  const saved = extractTemplate(filled, { kind: "graph", meta: { ...metaOf(source), id: "slugify-template", slots: [] } });
  assert.equal(saved.template?.slots, undefined, "a filled graph has no slots left");
  const again = instantiate(saved, { name: "Slugify" });
  assert.equal(strip(again), strip(filled));
});

test("extractTemplate drops run notes, and gives any leftover {{key}} a slot", () => {
  const doc: Graph = {
    ...instantiate(template(), { name: "Half", values: { task: "x" } }),
    notes: [{ id: "n-1", run: "r", at: "graph", text: "ran" }],
  };
  const saved = extractTemplate(doc, { kind: "graph", meta: { id: "half", title: "Half", summary: "s", whenToUse: "w" } });
  assert.equal(saved.notes, undefined);
  assert.deepEqual(saved.template?.slots, [{ key: "test-command", ask: "What should \"test-command\" be?", example: "test-command" }]);
  assert.deepEqual(saved.template?.profile, estimateProfile(doc));
  assert.ok(parseGraph(JSON.parse(canonicalize(saved))).doc, "the result matches the schema");
});

test("extractTemplate refuses bad ids, unknown nodes and a node list without kind fragment", () => {
  const meta = { id: "x", title: "X", summary: "s", whenToUse: "w" };
  assert.throws(() => extractTemplate(template(), { kind: "graph", meta: { ...meta, id: "Not Kebab" } }), /kebab-case/);
  assert.throws(() => extractTemplate(template(), { kind: "graph", meta: { ...meta, id: "builder" } }), /already the id/);
  assert.throws(() => extractTemplate(template(), { kind: "fragment", nodeIds: ["buider"], meta }), /no node "buider".*did you mean "builder"/);
  assert.throws(() => extractTemplate(template(), { kind: "fragment", nodeIds: [], meta }), /at least one node/);
  assert.throws(() => extractTemplate(template(), { kind: "graph", nodeIds: ["builder"], meta }), /kind: "fragment"/);
});

test("a fragment keeps loops and scoped policies only when they sit fully inside", () => {
  const meta = { id: "piece", title: "Piece", summary: "s", whenToUse: "w" };
  const withGraphPolicy: Graph = {
    ...template(),
    policies: [
      { id: "p-evidence", kind: "evidence-required", scope: "loop:grind" },
      { id: "p-graph", kind: "critic-isolation", scope: "graph" },
      { id: "p-builder", kind: "owner-per-artifact", scope: "node:builder" },
      { id: "p-pass", kind: "evidence-required", scope: "edge:e-tests-pass" },
    ],
  };

  const whole = extractTemplate(withGraphPolicy, { kind: "fragment", nodeIds: ["builder", "tests"], meta });
  assert.deepEqual(whole.nodes.map((n) => n.id), ["builder", "tests"]);
  assert.deepEqual(whole.edges.map((e) => e.id), ["e-builder-tests", "e-tests-fail"], "only edges between chosen nodes");
  assert.deepEqual(whole.loops.map((l) => l.id), ["grind"], "members and back edge are inside");
  assert.deepEqual(whole.policies?.map((p) => p.id), ["p-evidence", "p-builder"], "graph scope and outside edges stay behind");
  for (const key of ["goal", "target", "layout", "description", "notes"] as const) assert.equal(whole[key], undefined, `${key} is stripped`);
  assert.equal(whole.template?.kind, "fragment");

  const half = extractTemplate(withGraphPolicy, { kind: "fragment", nodeIds: ["builder", "done"], meta });
  assert.deepEqual(half.loops, [], "a loop with a member outside does not come along");
  assert.deepEqual(half.policies?.map((p) => p.id), ["p-builder"], "nor does a policy scoped to it");
  assert.deepEqual(half.edges, []);
});

const host = (): Graph => ({
  grooph: 0,
  id: "host",
  name: "Host",
  version: 1,
  nodes: [
    { id: "builder", kind: "agent", name: "Builder", role: "builder", brief: "b", outputs: ["o"], allow: ["edit-files"] },
    { id: "done", kind: "stop", name: "Done" },
  ],
  edges: [{ id: "e-builder-done", from: "builder", to: "done" }],
  loops: [],
  policies: [{ id: "p-graph", kind: "critic-isolation", scope: "graph" }],
  layout: { builder: { x: 0, y: 0 }, done: { x: 100, y: 0 } },
});

test("insertFragment re-derives colliding ids, keeps references whole, and returns the id map", () => {
  const { doc, ids } = insertFragment(host(), template(), { values });
  assert.deepEqual(ids, {
    builder: "builder-2",
    tests: "tests",
    done: "done-2",
    "e-builder-tests": "e-builder-2-tests",
    "e-tests-fail": "e-tests-fail",
    "e-tests-pass": "e-tests-pass",
    grind: "grind",
    "p-evidence": "p-evidence",
  });
  assert.deepEqual(doc.nodes.map((n) => n.id), ["builder", "done", "builder-2", "tests", "done-2"]);
  const loop = doc.loops[0]!;
  assert.deepEqual(loop.members, ["builder-2", "tests"]);
  assert.deepEqual(loop.back, ["e-tests-fail"]);
  assert.deepEqual(doc.edges.find((e) => e.id === "e-tests-fail"), { id: "e-tests-fail", from: "tests", to: "builder-2", when: "fail", evidence: ["test output"] });
  assert.equal(doc.policies?.[1]?.scope, "loop:grind");
  assert.deepEqual(doc.layout, host().layout, "the template's layout is dropped");
  assert.equal(doc.goal, undefined, "graph-level fields are not carried");
  assert.equal((doc.nodes[2] as { brief: string }).brief, "Do Add a slugify function.. Run pnpm test before reporting.");
  assert.deepEqual(validate(doc).filter((i) => i.severity === "error"), []);
});

test("insertFragment with a prefix prefixes every id; derived edge ids follow their nodes", () => {
  const { doc, ids } = insertFragment(host(), template(), { values, prefix: "check" });
  assert.equal(ids["builder"], "check-builder");
  assert.equal(ids["e-builder-tests"], "e-check-builder-check-tests");
  assert.equal(ids["e-tests-fail"], "check-e-tests-fail");
  assert.equal(ids["grind"], "check-grind");
  assert.deepEqual(doc.loops[0]!.back, ["check-e-tests-fail"]);
  assert.throws(() => insertFragment(host(), template(), { prefix: "9x" }), /kebab-case/);
});

test("insertFragment carries a graph-scoped policy only when the host lacks it, and fills nothing it was not given", () => {
  const withGraphPolicies: Graph = {
    ...template(),
    policies: [
      { id: "p-graph", kind: "critic-isolation", scope: "graph" },
      { id: "p-self", kind: "no-self-grading", scope: "graph" },
    ],
  };
  const { doc, ids } = insertFragment(host(), withGraphPolicies);
  assert.deepEqual(doc.policies?.map((p) => p.id), ["p-graph", "p-self"]);
  assert.equal(ids["p-graph"], undefined, "the host already isolates critics");
  assert.deepEqual(findSlots(doc).map((u) => u.key), ["task", "test-command"]);
  assert.throws(() => insertFragment(host(), template(), { values: { nope: "x" } }), /no slot "nope"/);
});

test("fillSlots touches text only, not the template block or run notes", () => {
  const doc: Graph = { ...template(), notes: [{ id: "n-1", run: "r", at: "graph", text: "{{task}}" }] };
  const filled = fillSlots(doc, { task: "T" });
  assert.equal(filled.goal, "T");
  assert.equal(filled.notes?.[0]?.text, "{{task}}");
  assert.deepEqual(filled.template, doc.template);
});

test("templateIndexEntry is the index row, keys in docs/templates.md §3 order", () => {
  const entry = templateIndexEntry(template());
  assert.deepEqual(Object.keys(entry), ["id", "version", "kind", "title", "summary", "whenToUse", "profile", "tags", "slots", "file"]);
  assert.deepEqual(entry, {
    id: "build-and-check",
    version: 3,
    kind: "graph",
    title: "Build and check",
    summary: "A builder works until the tests pass.",
    whenToUse: "Done and good are the same.",
    profile: { cost: "low", speed: "fast", rigor: "light" },
    tags: ["grind"],
    slots: ["task", "test-command"],
    file: "build-and-check.grooph.json",
  });
  assert.throws(() => templateIndexEntry(host()), /not a template/);
  const index = templateIndex([{ ...entry, id: "zeta" }, entry]);
  assert.deepEqual(index.templates.map((t) => t.id), ["build-and-check", "zeta"]);
  assert.equal(index.grooph, 0);
});

test("the template block round-trips through the schema and sits after lineage in canonical form", () => {
  const text = canonicalize(template());
  assert.ok(parseGraph(JSON.parse(text)).doc);
  const keys = Object.keys(JSON.parse(text) as object);
  assert.deepEqual(keys.slice(keys.indexOf("target"), keys.indexOf("description") + 1), ["target", "template", "description"]);
  const bad = parseGraph({ ...template(), template: { ...block, profile: { cost: "cheap", speed: "fast", rigor: "light" } } });
  assert.deepEqual(bad.issues.map((i) => i.code), ["E_SCHEMA"]);
  assert.match(bad.issues[0]!.message, /^\/template\/profile\/cost: expected one of low \| medium \| high/);
});
