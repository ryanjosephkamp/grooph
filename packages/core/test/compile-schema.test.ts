import assert from "node:assert/strict";
import { join } from "node:path";
import { test } from "node:test";

import { CompileError, compile, parseGraphText, setTarget, tryCompile, type CompileTarget, type Graph } from "../src/index.js";
import { fixturesDir, read } from "./helpers.js";

/** The review loop as a document for the harness it is exported for: a document that names another is refused. */
const reviewLoop = (target: CompileTarget = "claude-code"): Graph => setTarget(parseGraphText(read(join(fixturesDir, "valid", "review-loop.grooph.json"))).doc!, target);

type IdField = "graph" | "node" | "edge" | "loop" | "policy" | "group";

const idPath: Record<IdField, string> = {
  graph: "/id",
  node: "/nodes/0/id",
  edge: "/edges/0/id",
  loop: "/loops/0/id",
  policy: "/policies/0/id",
  group: "/groups/0/id",
};

function withInvalidId(field: IdField, value: unknown, target: CompileTarget): Graph {
  const doc = structuredClone(reviewLoop(target)) as Graph & { policies?: Array<Record<string, unknown>> };
  let owner: Record<string, unknown>;
  switch (field) {
    case "graph":
      owner = doc as unknown as Record<string, unknown>;
      break;
    case "node":
      owner = doc.nodes[0] as unknown as Record<string, unknown>;
      break;
    case "edge":
      owner = doc.edges[0] as unknown as Record<string, unknown>;
      break;
    case "loop":
      owner = doc.loops[0] as unknown as Record<string, unknown>;
      break;
    case "policy":
      doc.policies = [{ id: "evidence-rule", kind: "evidence-required", scope: "graph" }];
      owner = doc.policies[0]!;
      break;
    case "group":
      doc.groups = [{ id: "agent-group", name: "Agent group", members: [doc.nodes[0]!.id] }];
      owner = doc.groups[0] as unknown as Record<string, unknown>;
      break;
  }
  if (value === undefined) delete owner.id;
  else owner.id = value;
  return doc;
}

const malformedIds: { name: string; value: unknown }[] = [
  { name: "path traversal", value: "../../../escape" },
  { name: "quotes", value: 'bad"id' },
  { name: "non-string", value: 42 },
  { name: "missing", value: undefined },
];

for (const target of ["claude-code", "codex"] as const satisfies readonly CompileTarget[]) {
  test(`compile rejects malformed IDs before emitting a ${target} package`, () => {
    for (const field of ["graph", "node", "edge", "loop", "policy", "group"] as const) {
      for (const bad of malformedIds) {
        const doc = withInvalidId(field, bad.value, target);
        assert.throws(
          () => compile(doc, target),
          (error: unknown) => {
            assert.ok(error instanceof CompileError, `${field} ${bad.name} should be a CompileError`);
            assert.ok(
              error.issues.some((issue) => issue.code === "E_SCHEMA" && issue.message.startsWith(idPath[field])),
              `${field} ${bad.name} should identify ${idPath[field]} in an E_SCHEMA issue`,
            );
            return true;
          },
        );
        const attempt = tryCompile(doc, target);
        assert.equal(attempt.ok, false, `${field} ${bad.name} should fail tryCompile`);
        if (!attempt.ok) {
          assert.ok(attempt.issues.some((issue) => issue.code === "E_SCHEMA" && issue.message.startsWith(idPath[field])));
        }
      }
    }
  });

  test(`compile accepts valid hyphenated IDs and preserves the ${target} package`, () => {
    const valid = reviewLoop(target);
    assert.deepEqual(compile(valid, target), compile(reviewLoop(target), target));
    assert.equal(tryCompile(valid, target).ok, true);
  });
}
