/**
 * `applyOps`: ops as data, all or nothing, with errors that name the failing op.
 * The example ops file under fixtures/ops/ rebuilds the review-loop fixture
 * from the document `grooph new` writes.
 */

import assert from "node:assert/strict";
import { join } from "node:path";
import { test } from "node:test";

import { canonicalize } from "../src/canonicalize.js";
import { applyOps, formatOpError, newGraph, OP_ARGS, OP_NAMES, type ApplyResult } from "../src/ops/index.js";
import { parseGraphText } from "../src/parse.js";
import type { Graph } from "../src/types.js";
import { fixturesDir, read, validFixtures } from "./helpers.js";

const reviewLoop = (): Graph => {
  const parsed = parseGraphText(read(validFixtures().find((f) => f.name.startsWith("review-loop"))!.path));
  assert.ok(parsed.doc);
  return parsed.doc;
};

const exampleOps = (): unknown[] => JSON.parse(read(join(fixturesDir, "ops", "review-loop.ops.json"))) as unknown[];

const ok = (result: ApplyResult): Graph => {
  if (!result.ok) assert.fail(formatOpError(result.error));
  return result.doc;
};

const failure = (result: ApplyResult) => {
  assert.equal(result.ok, false, "expected the op list to fail");
  return (result as Extract<ApplyResult, { ok: false }>).error;
};

test("the example ops file builds the review-loop fixture from `grooph new`", () => {
  const start = newGraph({ name: "Review loop" });
  const result = applyOps(start, exampleOps());
  const doc = ok(result);
  assert.equal(canonicalize(doc), canonicalize(reviewLoop()), "byte for byte, in canonical form");
  assert.ok(result.ok);
  assert.deepEqual(result.ids.slice(6, 10), ["builder", "critic", "merge-gate", "done"], "ids created, per op");
  assert.equal(result.ids[0], null, "ops that create nothing report null");
});

test("ops are JSON: the list survives a round trip through text", () => {
  const ops = JSON.parse(JSON.stringify(exampleOps())) as unknown[];
  assert.equal(canonicalize(ok(applyOps(newGraph({ name: "Review loop" }), ops))), canonicalize(reviewLoop()));
});

test("applyOps never mutates its input and is all or nothing", () => {
  const doc = reviewLoop();
  const before = JSON.stringify(doc);
  const error = failure(
    applyOps(doc, [
      { op: "setNodeName", id: "builder", name: "Maker" },
      { op: "removeNode", id: "ghost" },
    ]),
  );
  assert.equal(error.index, 1);
  assert.equal(JSON.stringify(doc), before, "the input is untouched");
});

test("errors name the op, its position, and what is wrong", () => {
  const doc = reviewLoop();
  const cases: [unknown, RegExp][] = [
    [{ op: "updateNode", id: "critc", set: { effort: "low" } }, /^ops\[0\] updateNode: "id": no node "critc"; did you mean "critic"\?$/],
    [{ op: "addNod", kind: "agent" }, /unknown op "addNod"; did you mean "addNode"\?/],
    [{ op: "addNode", knd: "agent" }, /unknown argument "knd"; did you mean "kind"\?/],
    [{ op: "addNode", kind: "wizard" }, /"kind" must be one of agent \| human-gate \| check \| merge \| stop/],
    [{ op: "addNode", kind: "agent", id: "critic" }, /id "critic" is already used/],
    [{ op: "addNode", kind: "agent", id: "Not An Id" }, /must be a kebab-case id/],
    [{ op: "updateNode", id: "critic", set: { id: "judge" } }, /use renameId/],
    [{ op: "updateNode", id: "critic", set: { kind: "stop" } }, /cannot change "kind"/],
    [{ op: "connect", from: "builder", to: "nowhere" }, /"to": no node "nowhere"/],
    [{ op: "toggleLoopBack", loop: "review-cycle", edge: "e-nope" }, /no edge "e-nope"/],
    [{ op: "setStop", loop: "review-cycle", index: 7, stop: { kind: "bar-passed" } }, /stop index from 0 to 2/],
    [{ op: "setStop", loop: "review-cycle", index: 0, stop: { kind: "vibes" } }, /"stop.kind" must be one of/],
    [{ op: "moveStop", loop: "review-cycle", index: 0, delta: 2 }, /"delta" must be -1/],
    [{ op: "addPolicy", kind: "critic-isolation", scope: "everywhere" }, /"scope" must be graph/],
    [{ op: "setGraphField", key: "adaptation", value: "loose" }, /"value" must be one of adaptive \| propose \| fixed/],
    [{ op: "setPositions", positions: { ghost: { x: 1, y: 2 } } }, /no node "ghost"/],
    [{ op: "renameId", from: "builder", to: "critic" }, /already used/],
    [{ op: "renameId", from: "nobody", to: "someone" }, /no object has id "nobody"/],
    ["addNode", /an op must be an object/],
    [{ kind: "agent" }, /missing "op"/],
  ];
  for (const [op, pattern] of cases) {
    const error = failure(applyOps(doc, [op]));
    assert.match(formatOpError(error), pattern, JSON.stringify(op));
  }
});

test("a patch replaces fields shallowly and null removes one", () => {
  const doc = ok(
    applyOps(reviewLoop(), [
      { op: "updateNode", id: "critic", set: { effort: null, model: { tier: "frontier" } } },
      { op: "updateEdge", id: "e-review-pass", set: { approval: true, label: "ship it" } },
      { op: "updateLoop", id: "review-cycle", set: { mode: null } },
    ]),
  );
  const critic = doc.nodes.find((n) => n.id === "critic")!;
  assert.ok(!("effort" in critic));
  assert.deepEqual((critic as { model?: unknown }).model, { tier: "frontier" });
  assert.deepEqual(doc.edges.find((e) => e.id === "e-review-pass"), {
    id: "e-review-pass",
    from: "critic",
    to: "merge-gate",
    when: "pass",
    approval: true,
    label: "ship it",
  });
  assert.ok(!("mode" in doc.loops[0]!));
});

test("renames through ops follow references, and report the new id", () => {
  const result = applyOps(reviewLoop(), [
    { op: "setNodeName", id: "done", name: "Shipped" },
    { op: "renameId", from: "critic", to: "reviewer" },
  ]);
  const doc = ok(result);
  assert.ok(result.ok);
  assert.deepEqual(result.ids, ["shipped", "reviewer"]);
  assert.ok(doc.edges.some((e) => e.from === "reviewer" && e.to === "builder"));
  assert.ok(doc.edges.some((e) => e.to === "shipped"));
});

test("every op the vocabulary documents is dispatched", () => {
  // A missing case in the dispatcher would surface as "unknown op" for a known name.
  for (const name of OP_NAMES) {
    const result = applyOps(reviewLoop(), [{ op: name, "not-an-argument": true }]);
    const error = failure(result);
    assert.match(error.message, /unknown argument "not-an-argument"/, name);
    assert.ok(OP_ARGS[name].length > 0);
  }
});
