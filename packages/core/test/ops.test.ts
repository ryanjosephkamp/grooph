/**
 * Typed document operations (moved from apps/web in slice 0004, decision 0006):
 * purity, id derivation, cascades, and the review loop built only with ops.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import { canonicalize } from "../src/canonicalize.js";
import {
  addLoop,
  addNode,
  addPolicy,
  addStop,
  allIds,
  connect,
  followsName,
  moveStop,
  newGraph,
  removeEdge,
  removeLoop,
  removeNode,
  removePolicy,
  removeStop,
  renameId,
  setConstraint,
  setGraphField,
  setGraphName,
  setNodeName,
  setPositions,
  setTarget,
  slugify,
  toggleLoopBack,
  toggleLoopMember,
  uniqueId,
} from "../src/ops/index.js";
import { parseGraphText } from "../src/parse.js";
import type { AgentNode, Graph } from "../src/types.js";
import { validate } from "../src/validate.js";
import { read, validFixtures } from "./helpers.js";

const empty = (): Graph => ({ grooph: 0, id: "g", name: "G", version: 1, nodes: [], edges: [], loops: [] });

const reviewLoop = (): Graph => {
  const parsed = parseGraphText(read(validFixtures().find((f) => f.name.startsWith("review-loop"))!.path));
  assert.ok(parsed.doc);
  return parsed.doc;
};

const errorsOf = (doc: Graph, forExport = false) =>
  validate(doc, { forExport }).filter((issue) => issue.severity === "error");

test("ids: slugs are kebab-case and unique ids count upward", () => {
  assert.equal(slugify("Merge approval"), "merge-approval");
  assert.equal(slugify("  Éclair / Review!  "), "eclair-review");
  assert.equal(slugify("42 things"), "things", "an id starts with a letter");
  assert.equal(slugify("!!!"), "item");
  assert.equal(slugify("!!!", "node"), "node");
  assert.equal(uniqueId("agent", new Set(["agent", "agent-2"])), "agent-3");
  assert.equal(uniqueId("agent", new Set()), "agent");
});

test("operations never mutate their input", () => {
  const doc = reviewLoop();
  const before = JSON.stringify(doc);
  removeNode(doc, "critic");
  renameId(doc, "builder", "maker");
  setNodeName(doc, "done", "Finished");
  setPositions(doc, { builder: { x: 1, y: 2 } });
  addPolicy(doc, { kind: "evidence-required", scope: "graph" });
  toggleLoopMember(doc, "review-cycle", "done", true);
  assert.equal(JSON.stringify(doc), before);
});

test("addNode names new nodes after their kind and keeps ids unique", () => {
  let doc = empty();
  const a = addNode(doc, "agent");
  doc = a.doc;
  const b = addNode(doc, "agent");
  doc = b.doc;
  const g = addNode(doc, "human-gate");
  assert.deepEqual([a.id, b.id, g.id], ["agent", "agent-2", "human-gate"]);
  assert.equal(b.doc.nodes[1]!.name, "Agent 2");
  assert.deepEqual(g.doc.nodes[2], { id: "human-gate", kind: "human-gate", name: "Human gate", prompt: "" });
});

test("addNode takes a name and an explicit id", () => {
  const named = addNode(empty(), "agent", { name: "Builder" });
  assert.equal(named.id, "builder");
  assert.equal(named.doc.nodes[0]!.name, "Builder");
  const explicit = addNode(named.doc, "stop", { name: "All done", id: "done" });
  assert.equal(explicit.id, "done");
  assert.equal(explicit.doc.nodes[1]!.name, "All done");
});

test("addNode keeps a layout-free document layout-free (A-005)", () => {
  const { doc } = addNode(empty(), "stop", { at: { x: 10, y: 20 } });
  assert.equal(doc.layout, undefined);
});

test("addNode places the node when the document already has layout", () => {
  const { doc, id } = addNode(reviewLoop(), "check", { at: { x: 10.4, y: 20.6 } });
  assert.deepEqual(doc.layout![id], { x: 10, y: 21 });
});

test("the id follows the name while they agree", () => {
  let doc = addNode(empty(), "agent").doc;
  doc = connect(addNode(doc, "stop").doc, "agent", "stop").doc;
  const renamed = setNodeName(doc, "agent", "Builder");
  assert.equal(renamed.id, "builder");
  assert.deepEqual(renamed.doc.edges[0], { id: "e-builder-stop", from: "builder", to: "stop" });
});

test("the id stops following once it was set by hand", () => {
  const doc = reviewLoop(); // "Merge approval" has id "merge-gate"
  assert.equal(followsName("merge-gate", "Merge approval"), false);
  const renamed = setNodeName(doc, "merge-gate", "Merge");
  assert.equal(renamed.id, "merge-gate");
  assert.equal(renamed.doc.nodes.find((n) => n.id === "merge-gate")!.name, "Merge");
});

test("a derived id never collides with an existing one", () => {
  const { doc: withAgent, id } = addNode(reviewLoop(), "agent");
  const renamed = setNodeName(withAgent, id, "Critic");
  assert.equal(renamed.id, "critic-2");
  assert.equal(new Set(renamed.doc.nodes.map((n) => n.id)).size, renamed.doc.nodes.length);
});

test("renameId renames every reference to a node", () => {
  const doc = renameId(reviewLoop(), "builder", "maker");
  assert.ok(doc.nodes.some((n) => n.id === "maker"));
  assert.equal(doc.edges.filter((e) => e.from === "maker" || e.to === "maker").length, 3);
  assert.deepEqual(doc.loops[0]!.members, ["maker", "critic", "merge-gate"]);
  assert.deepEqual(doc.layout!["maker"], { x: 80, y: 160 });
  assert.equal(doc.layout!["builder"], undefined);
  assert.deepEqual(errorsOf(doc, true), []);
});

test("renameId renames loop back edges and policy scopes with an edge", () => {
  const base: Graph = { ...reviewLoop(), policies: [{ id: "p", kind: "evidence-required", scope: "edge:e-review-fail" }] };
  const doc = renameId(base, "e-review-fail", "e-fail");
  assert.deepEqual(doc.loops[0]!.back, ["e-fail", "e-gate-reject"]);
  assert.equal(doc.policies![0]!.scope, "edge:e-fail");
});

test("renameId renames the graph's own id and a policy id", () => {
  const doc = renameId(renameId(reviewLoop(), "review-loop", "reviewed"), "p-critic-isolation", "p-isolate");
  assert.equal(doc.id, "reviewed");
  assert.deepEqual(doc.policies!.map((p) => p.id), ["p-isolate", "p-no-self-grading"]);
});

test("the graph id follows the graph name", () => {
  const doc = setGraphName({ ...empty(), id: "untitled-graph", name: "Untitled graph" }, "Review loop");
  assert.equal(doc.id, "review-loop");
});

test("removeNode cascades to edges, back-edge entries, memberships and layout", () => {
  const doc = removeNode(reviewLoop(), "merge-gate");
  assert.deepEqual(doc.nodes.map((n) => n.id), ["builder", "critic", "done"]);
  assert.deepEqual(doc.edges.map((e) => e.id), ["e-build-review", "e-review-fail"]);
  assert.deepEqual(doc.loops[0]!.members, ["builder", "critic"]);
  assert.deepEqual(doc.loops[0]!.back, ["e-review-fail"]);
  assert.ok(!Object.keys(doc.layout!).includes("merge-gate"));
  // the loop still stands on its own: builder ⇄ critic with a stop
  assert.deepEqual(errorsOf(doc), []);
});

test("removeNode clears stop `then` and `answerKeyFrom` references", () => {
  let doc = reviewLoop();
  doc = {
    ...doc,
    loops: [{ ...doc.loops[0]!, stops: [{ kind: "bar-passed", then: "done" }], bar: { ...doc.loops[0]!.bar!, answerKeyFrom: "done" } }],
  };
  doc = removeNode(doc, "done");
  assert.deepEqual(doc.loops[0]!.stops, [{ kind: "bar-passed" }]);
  assert.equal(doc.loops[0]!.bar!.answerKeyFrom, undefined);
});

test("removal drops policies scoped to what was removed, and nothing else", () => {
  let doc: Graph = {
    ...reviewLoop(),
    policies: [
      { id: "p-graph", kind: "critic-isolation", scope: "graph" },
      { id: "p-node", kind: "no-self-grading", scope: "node:critic" },
      { id: "p-loop", kind: "concurrency-cap", scope: "loop:review-cycle", params: { max: 2 } },
    ],
  };
  doc = removeNode(doc, "critic");
  assert.deepEqual(doc.policies!.map((p) => p.id), ["p-graph", "p-loop"]);
  doc = removeLoop(doc, "review-cycle");
  assert.deepEqual(doc.policies!.map((p) => p.id), ["p-graph"]);
});

test("removeEdge removes the edge from loop back lists", () => {
  const doc = removeEdge(reviewLoop(), "e-gate-reject");
  assert.deepEqual(doc.loops[0]!.back, ["e-review-fail"]);
});

test("loop members and back edges keep document order; `on` forces a state", () => {
  let doc: Graph = { ...reviewLoop(), loops: [] };
  const { doc: withLoop, id } = addLoop(doc, ["critic"]);
  doc = toggleLoopMember(withLoop, id, "merge-gate");
  doc = toggleLoopMember(doc, id, "builder");
  assert.deepEqual(doc.loops[0]!.members, ["builder", "critic", "merge-gate"]);
  doc = toggleLoopBack(doc, id, "e-gate-reject");
  doc = toggleLoopBack(doc, id, "e-review-fail");
  assert.deepEqual(doc.loops[0]!.back, ["e-review-fail", "e-gate-reject"]);
  doc = toggleLoopBack(doc, id, "e-review-fail");
  assert.deepEqual(doc.loops[0]!.back, ["e-gate-reject"]);
  assert.deepEqual(toggleLoopBack(doc, id, "e-gate-reject", true).loops[0]!.back, ["e-gate-reject"], "on: true is idempotent");
  assert.deepEqual(toggleLoopMember(doc, id, "done", false).loops[0]!.members, ["builder", "critic", "merge-gate"]);
});

test("stops are added with bounded defaults, reordered and removed", () => {
  let doc = addLoop(addNode(empty(), "agent").doc, ["agent"]).doc;
  doc = addStop(doc, "loop", "budget");
  doc = addStop(doc, "loop", "max-iterations");
  doc = addStop(doc, "loop", "max-iterations", { n: 3 });
  assert.deepEqual(doc.loops[0]!.stops, [
    { kind: "budget", measure: "dispatches", limit: 12 },
    { kind: "max-iterations", n: 4 },
    { kind: "max-iterations", n: 3 },
  ]);
  doc = moveStop(doc, "loop", 1, -1);
  assert.deepEqual(doc.loops[0]!.stops.map((s) => s.kind), ["max-iterations", "budget", "max-iterations"]);
  doc = removeStop(doc, "loop", 0);
  assert.deepEqual(doc.loops[0]!.stops.map((s) => s.kind), ["budget", "max-iterations"]);
});

test("empty optional objects are removed rather than left as husks", () => {
  let doc = setConstraint(empty(), "budget", "10 turns");
  assert.deepEqual(doc.constraints, { budget: "10 turns" });
  doc = setConstraint(doc, "budget", undefined);
  assert.ok(!("constraints" in doc));
  doc = setTarget(doc, "claude-code");
  assert.deepEqual(doc.target, { harness: "claude-code" });
  doc = setTarget(doc, undefined);
  assert.ok(!("target" in doc));
  const withPolicy = addPolicy(doc, { kind: "critic-isolation", scope: "graph" });
  assert.equal(withPolicy.id, "p-critic-isolation");
  assert.ok(!("policies" in removePolicy(withPolicy.doc, withPolicy.id)));
});

test("setGraphField sets and clears adaptation without inventing a default", () => {
  const doc = setGraphField(empty(), "adaptation", "fixed");
  assert.equal(doc.adaptation, "fixed");
  assert.ok(!("adaptation" in setGraphField(doc, "adaptation", undefined)));
  assert.ok(!("adaptation" in newGraph({ name: "Fresh" })), "the default is applied at compile time, not written");
});

test("setPositions writes whole pixels", () => {
  const doc = setPositions(empty(), { a: { x: 1.6, y: -2.2 } });
  assert.deepEqual(doc.layout, { a: { x: 2, y: -2 } });
});

test("newGraph is the minimal document, in canonical form", () => {
  const doc = newGraph({ name: "Scratch run", goal: "Try ops", target: "claude-code" });
  assert.equal(
    canonicalize(doc),
    `${JSON.stringify(
      { grooph: 0, id: "scratch-run", name: "Scratch run", version: 1, goal: "Try ops", target: { harness: "claude-code" }, nodes: [], edges: [], loops: [] },
      null,
      2,
    )}\n`,
  );
});

test("a graph built only with operations rebuilds the review loop's shape", () => {
  let doc: Graph = { ...empty(), id: "untitled-graph", name: "Untitled graph" };
  doc = setGraphName(doc, "Review loop");
  doc = { ...doc, goal: "Ship the change." };
  doc = setTarget(doc, "claude-code");
  const add = (kind: Parameters<typeof addNode>[1], name: string): string => {
    const added = addNode(doc, kind);
    const named = setNodeName(added.doc, added.id, name);
    doc = named.doc;
    return named.id;
  };
  const builder = add("agent", "Builder");
  const critic = add("agent", "Critic");
  const gate = add("human-gate", "Merge gate");
  add("stop", "Done");
  doc = {
    ...doc,
    nodes: doc.nodes.map((n) =>
      n.kind === "agent"
        ? ({ ...n, role: n.id === critic ? "critic" : "builder", brief: "…", outputs: ["out"] } as AgentNode)
        : n.kind === "human-gate"
          ? { ...n, prompt: "Merge?" }
          : n,
    ),
  };
  const edge = (from: string, to: string, when?: "pass" | "fail"): string => {
    const c = connect(doc, from, to);
    doc = when ? { ...c.doc, edges: c.doc.edges.map((e) => (e.id === c.id ? { ...e, when } : e)) } : c.doc;
    return c.id;
  };
  edge(builder, critic);
  const fail = edge(critic, builder, "fail");
  edge(critic, gate, "pass");
  edge(gate, "done", "pass");
  const reject = edge(gate, builder, "fail");
  const loop = addLoop(doc, [builder, critic, gate]);
  doc = toggleLoopBack(toggleLoopBack(loop.doc, loop.id, fail), loop.id, reject);
  doc = {
    ...doc,
    loops: doc.loops.map((l) => ({
      ...l,
      mode: "judgment",
      bar: { name: "Checklist", inspects: [{ kind: "checklist", ref: "CHECKLIST.md" }], acceptance: "All items met." },
    })),
  };
  doc = addStop(addStop(addStop(doc, loop.id, "bar-passed"), loop.id, "max-iterations"), loop.id, "budget");

  assert.equal(doc.id, "review-loop");
  assert.deepEqual([doc.nodes.length, doc.edges.length, doc.loops.length, doc.loops[0]!.stops.length], [4, 5, 1, 3]);
  assert.deepEqual(doc.edges.map((e) => e.id), [
    "e-builder-critic",
    "e-critic-builder",
    "e-critic-merge-gate",
    "e-merge-gate-done",
    "e-merge-gate-builder",
  ]);
  assert.deepEqual(errorsOf(doc, true), []);
  assert.equal(allIds(doc).size, 1 + 4 + 5 + 1);
  assert.doesNotThrow(() => canonicalize(doc));
});
