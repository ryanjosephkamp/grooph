// The scorer (handoff 0016, criterion 4): each measure on a fixture tree built here.
// Run with: node --test scripts/lib/compare-score.test.mjs
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, test } from "node:test";

import { failedCases, parseTestSummary, scoreHeldOut, scoreScope, scoreTests, scoreTree } from "./compare-score.mjs";

let tree;
let heldOut;

before(() => {
  tree = mkdtempSync(join(tmpdir(), "grooph-compare-score-fixture-"));
  heldOut = mkdtempSync(join(tmpdir(), "grooph-compare-score-heldout-"));
  mkdirSync(join(tree, "src"));
  mkdirSync(join(tree, "tests"));
  writeFileSync(join(tree, "package.json"), JSON.stringify({ name: "fixture", private: true, type: "module", scripts: { test: "node --test tests/*.test.mjs" } }));
  // The implementation gets the plain case right and the edge case wrong.
  writeFileSync(join(tree, "src", "add.mjs"), "export const add = (a, b) => (a === 0 ? b + 1 : a + b);\n");
  writeFileSync(
    join(tree, "tests", "add.test.mjs"),
    [
      'import assert from "node:assert/strict";',
      'import { test } from "node:test";',
      'import { add } from "../src/add.mjs";',
      'test("adds", () => assert.equal(add(1, 2), 3));',
      'test("later", { todo: true }, () => {});',
    ].join("\n"),
  );
  writeFileSync(
    join(heldOut, "add-cases.test.mjs"),
    [
      'import assert from "node:assert/strict";',
      'import { join } from "node:path";',
      'import { test } from "node:test";',
      'import { pathToFileURL } from "node:url";',
      'const { add } = await import(pathToFileURL(join(process.cwd(), "src", "add.mjs")).href);',
      'test("1 + 2", () => assert.equal(add(1, 2), 3));',
      'test("0 + 5", () => assert.equal(add(0, 5), 5));',
      'test("2 + 2", () => assert.equal(add(2, 2), 4));',
    ].join("\n"),
  );
});

after(() => {
  rmSync(tree, { recursive: true, force: true });
  rmSync(heldOut, { recursive: true, force: true });
});

test("held-out: cases, passed, failed, rate and the failing names", () => {
  const score = scoreHeldOut(tree, heldOut);
  assert.equal(score.ran, true);
  assert.equal(score.cases, 3);
  assert.equal(score.passed, 2);
  assert.equal(score.failed, 1);
  assert.equal(score.rate, 0.667);
  assert.deepEqual(score.failing, ["0 + 5"]);
});

test("held-out: no suite is scored as not run, never as zero", () => {
  const none = scoreHeldOut(tree, null);
  assert.equal(none.ran, false);
  assert.equal(none.passed, null);
  const empty = mkdtempSync(join(tmpdir(), "grooph-compare-score-empty-"));
  try {
    assert.equal(scoreHeldOut(tree, empty).ran, false);
  } finally {
    rmSync(empty, { recursive: true, force: true });
  }
});

test("tests: the project's command passes only when it exits 0 with nothing skipped or todo", () => {
  const score = scoreTests(tree, "npm test");
  assert.equal(score.exit, 0);
  assert.equal(score.tests, 2);
  assert.equal(score.passed, 1);
  assert.equal(score.todo, 1);
  assert.equal(score.pass, false, "a todo test is not a pass");
  writeFileSync(join(tree, "tests", "add.test.mjs"), 'import assert from "node:assert/strict";\nimport { test } from "node:test";\nimport { add } from "../src/add.mjs";\ntest("adds", () => assert.equal(add(1, 2), 3));\n');
  assert.equal(scoreTests(tree, "npm test").pass, true);
  writeFileSync(join(tree, "tests", "add.test.mjs"), 'import assert from "node:assert/strict";\nimport { test } from "node:test";\nimport { add } from "../src/add.mjs";\ntest("wrong", () => assert.equal(add(0, 1), 1));\n');
  const failing = scoreTests(tree, "npm test");
  assert.equal(failing.pass, false);
  assert.equal(failing.failed, 1);
  assert.deepEqual(failing.failing, ["wrong"]);
});

test("scope: files outside the allowed prefixes, with the package paths ignored for every arm", () => {
  const files = ["A src/add.mjs", "M tests/add.test.mjs", "A CHANGES.md", "A notes/scratch.md", "M package.json", "A .grooph/g/runs/x/notes.jsonl", "M .claude/agents/g--builder.md", "R100 old.md docs/new.md"];
  const score = scoreScope(files, ["src/", "tests/", "CHANGES.md"]);
  assert.deepEqual(score.outside, ["notes/scratch.md", "package.json", "docs/new.md"]);
  assert.deepEqual(score.changed.filter((p) => p.startsWith(".")), []);
  assert.deepEqual(scoreScope([], ["src/"]).outside, []);
  assert.deepEqual(scoreScope(["M tests/semver.test.mjs", "A src/x.mjs"], ["src/", "tests/"], ["tests/semver.test.mjs"]).protected_changed, ["tests/semver.test.mjs"]);
  assert.deepEqual(scoreScope(["A src/x.mjs"], ["src/"], ["tests/semver.test.mjs"]).protected_changed, []);
});

test("the summary parser reads both reporters", () => {
  assert.deepEqual(parseTestSummary("# tests 4\n# suites 0\n# pass 3\n# fail 1\n# cancelled 0\n# skipped 0\n# todo 0\n"), { tests: 4, pass: 3, fail: 1, cancelled: 0, skipped: 0, todo: 0 });
  assert.equal(parseTestSummary("ℹ tests 2\nℹ pass 2\nℹ fail 0\n").pass, 2);
  assert.equal(parseTestSummary("nothing").tests, null);
  assert.deepEqual(failedCases("ok 1 - fine\nnot ok 2 - broken case\n✖ other (3.2ms)\n"), ["broken case", "other"]);
});

test("scoreTree carries the ending the runner recorded", () => {
  const score = scoreTree({ tree, heldOutDir: null, testCommand: "npm test", allowed: ["src/"], files: ["A src/add.mjs"], ending: { kind: "cut-off", reason: "iteration limit" } });
  assert.deepEqual(score.ending, { kind: "cut-off", reason: "iteration limit" });
  assert.equal(score.held_out.ran, false);
  assert.deepEqual(score.scope.outside, []);
});
