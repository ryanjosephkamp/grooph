/**
 * Rule behaviour the fixtures cannot show on their own: the cases inside a rule
 * (graph-ir §3) and the defaults the rules depend on (§1, §2).
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import { indexGraph } from "../src/graph-index.js";
import type { Issue } from "../src/issues.js";
import { loopMode } from "../src/semantics.js";
import type { Graph, Node } from "../src/types.js";
import { validate } from "../src/validate.js";

const codes = (issues: Issue[]): string[] => [...new Set(issues.map((issue) => issue.code))].sort();

const agent = (id: string, role: Node extends never ? never : string, extra: object = {}): Node =>
  ({
    id,
    kind: "agent",
    name: id,
    role,
    brief: `brief for ${id}`,
    outputs: [`${id} output`],
    ...extra,
  }) as Node;

const base = (over: Partial<Graph> = {}): Graph => ({
  grooph: 0,
  id: "g",
  name: "G",
  version: 1,
  goal: "Do the thing.",
  target: { harness: "claude-code" },
  nodes: [],
  edges: [],
  loops: [],
  ...over,
});

test("E_DUPLICATE_ID spans object kinds, not just lists", () => {
  const doc = base({
    nodes: [agent("worker", "builder"), { id: "done", kind: "stop", name: "Done" }],
    edges: [{ id: "worker", from: "worker", to: "done" }],
  });
  assert.deepEqual(codes(validate(doc)), ["E_DUPLICATE_ID"]);
});

test("E_DANGLING_REF covers stop `then` and `answerKeyFrom`", () => {
  const doc = base({
    nodes: [agent("builder", "builder"), agent("critic", "critic")],
    edges: [
      { id: "e-fwd", from: "builder", to: "critic" },
      { id: "e-back", from: "critic", to: "builder", when: "fail" },
    ],
    loops: [
      {
        id: "cycle",
        name: "Cycle",
        members: ["builder", "critic"],
        back: ["e-back"],
        bar: {
          name: "Answer key",
          inspects: [{ kind: "answer-key", ref: "spec" }],
          acceptance: "matches the key",
          answerKeyFrom: "ghost-node",
        },
        stops: [{ kind: "bar-passed", then: "also-missing" }],
      },
    ],
  });
  const issues = validate(doc);
  assert.deepEqual(codes(issues), ["E_DANGLING_REF", "E_JUDGMENT_LOOP_NO_BAR", "E_STOP_NOT_INSPECTABLE"]);
  assert.equal(issues.filter((i) => i.code === "E_DANGLING_REF").length, 2, "one per unknown reference");
});

test("an answer key counts as inspectable once its node exists", () => {
  const doc = base({
    nodes: [agent("speccer", "planner"), agent("builder", "builder"), agent("critic", "critic")],
    edges: [
      { id: "e-spec", from: "speccer", to: "builder" },
      { id: "e-fwd", from: "builder", to: "critic" },
      { id: "e-back", from: "critic", to: "builder", when: "fail" },
    ],
    loops: [
      {
        id: "cycle",
        name: "Cycle",
        members: ["builder", "critic"],
        back: ["e-back"],
        bar: {
          name: "Answer key",
          inspects: [{ kind: "answer-key", ref: "the spec" }],
          acceptance: "Every line of the spec is met.",
          answerKeyFrom: "speccer",
        },
        stops: [{ kind: "bar-passed" }],
      },
    ],
  });
  assert.deepEqual(validate(doc), []);
});

test("E_LOOP_BACK_EDGE fires when no path leads back inside the members", () => {
  const doc = base({
    nodes: [agent("a", "builder"), agent("b", "critic"), agent("c", "critic")],
    edges: [
      { id: "e-ab", from: "a", to: "b" },
      { id: "e-bc", from: "b", to: "c" },
      { id: "e-ca", from: "c", to: "a", when: "fail" },
    ],
    loops: [
      {
        id: "cycle",
        name: "Cycle",
        // `b` is left out, so nothing inside {a, c} leads from a back to c
        members: ["a", "c"],
        back: ["e-ca"],
        mode: "grind",
        stops: [{ kind: "max-iterations", n: 3 }],
      },
    ],
  });
  const issues = validate(doc);
  assert.deepEqual(codes(issues), ["E_LOOP_BACK_EDGE"]);
  assert.match(issues[0]!.message, /no path inside the loop's members/);
});

test("E_LOOP_BACK_EDGE fires on an empty back list", () => {
  const doc = base({
    nodes: [agent("a", "builder"), { id: "done", kind: "stop", name: "Done" }],
    edges: [{ id: "e-done", from: "a", to: "done" }],
    loops: [{ id: "cycle", name: "Cycle", members: ["a"], back: [], stops: [{ kind: "max-iterations", n: 2 }] }],
  });
  assert.deepEqual(codes(validate(doc)), ["E_LOOP_BACK_EDGE"]);
});

test("E_CYCLE_NO_STOP: a loop with no stop covers nothing", () => {
  const withStop = base({
    nodes: [agent("a", "builder"), agent("b", "critic")],
    edges: [
      { id: "e-ab", from: "a", to: "b" },
      { id: "e-ba", from: "b", to: "a", when: "fail" },
    ],
    loops: [
      {
        id: "cycle",
        name: "Cycle",
        members: ["a", "b"],
        back: ["e-ba"],
        bar: { name: "Checklist", inspects: [{ kind: "checklist", ref: "list.md" }], acceptance: "all items met" },
        stops: [{ kind: "max-iterations", n: 3 }],
      },
    ],
  });
  assert.deepEqual(validate(withStop), []);

  const withoutStop = structuredClone(withStop);
  withoutStop.loops[0]!.stops = [];
  assert.ok(codes(validate(withoutStop)).includes("E_CYCLE_NO_STOP"));
});

test("E_CYCLE_NO_STOP names the nodes of a self-loop too", () => {
  const doc = base({
    nodes: [agent("a", "builder")],
    edges: [{ id: "e-self", from: "a", to: "a" }],
  });
  const issues = validate(doc);
  assert.deepEqual(codes(issues), ["E_CYCLE_NO_STOP"]);
  assert.deepEqual(issues[0]!.at, ["a"]);
});

test("loop mode is inferred: grind when every back edge starts at a check node", () => {
  const doc = base({
    nodes: [
      agent("builder", "builder"),
      { id: "suite", kind: "check", name: "Suite", check: { kind: "tests", run: "npm test", pass: "exit 0" } },
    ],
    edges: [
      { id: "e-fwd", from: "builder", to: "suite" },
      { id: "e-back", from: "suite", to: "builder", when: "fail" },
    ],
    loops: [
      { id: "cycle", name: "Cycle", members: ["builder", "suite"], back: ["e-back"], stops: [{ kind: "max-iterations", n: 3 }] },
    ],
  });
  assert.equal(loopMode(indexGraph(doc), doc.loops[0]!), "grind");
  assert.deepEqual(validate(doc), [], "a grind loop needs no bar");

  const judgment = structuredClone(doc);
  judgment.edges.push({ id: "e-peer", from: "builder", to: "builder", when: "fail" });
  judgment.loops[0]!.back = ["e-back", "e-peer"];
  assert.equal(loopMode(indexGraph(judgment), judgment.loops[0]!), "judgment");
  assert.ok(codes(validate(judgment)).includes("E_JUDGMENT_LOOP_NO_BAR"));
});

test("a custom role is a writer only when it owns something", () => {
  const doc = base({
    nodes: [agent("weird", { custom: "vibe-checker" } as unknown as string, { owns: ["notes.md"] })],
  });
  assert.deepEqual(validate(doc), [], "no ★ rule depends on the family, but the document stays legal");
});

test("export-only rules fire only for export", () => {
  const doc = base({ goal: "  ", target: undefined, nodes: [agent("a", "builder")] });
  assert.deepEqual(validate(doc), [], "authoring a draft raises nothing");
  assert.deepEqual(codes(validate(doc, { forExport: true })), ["E_NO_GOAL", "E_NO_TARGET"]);
});

test("E_NO_TARGET fires for a harness with no profile", () => {
  const doc = base({ target: { harness: "codex" }, nodes: [agent("a", "builder")] });
  const issues = validate(doc, { forExport: true });
  assert.deepEqual(codes(issues), ["E_NO_TARGET"]);
  assert.match(issues[0]!.message, /no compile profile for target harness "codex"/);
});

test("every issue names the objects involved", () => {
  const doc = base({
    nodes: [agent("a", "builder")],
    edges: [{ id: "e-ghost", from: "a", to: "ghost" }],
  });
  for (const issue of validate(doc, { forExport: true })) {
    assert.ok(issue.at.length > 0, `${issue.code} should name at least one object`);
  }
});
