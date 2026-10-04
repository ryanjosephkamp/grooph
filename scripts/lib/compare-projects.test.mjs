// The projects of study two, checked without a model (handoff 0019, criterion 2). Each version-2 project keeps, beside
// its task, a solution that passes its held-out suite and a careful first pass written without it. This file runs the
// study's own scorer on both: the suite can be passed, the task as it ships does not pass it, and the first pass fails
// it at the points the task leaves open. Run with: node --test scripts/lib/compare-projects.test.mjs
import assert from "node:assert/strict";
import { cpSync, existsSync, mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import { deriveD } from "./compare-prompt.mjs";
import { scoreHeldOut, scoreTests } from "./compare-score.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const comparisons = join(root, "experiments", "comparisons");
const readJson = (path) => JSON.parse(readFileSync(path, "utf8"));
const projects = readdirSync(comparisons).filter((name) => existsSync(join(comparisons, name, "expect.json")) && readJson(join(comparisons, name, "expect.json")).protocol === 2);

/** The task folder with one of the project's kept variants laid over it, scored as a run's final tree is. */
function scoreVariant(project, variant) {
  const dir = join(comparisons, project);
  const tree = mkdtempSync(join(tmpdir(), `grooph-compare-variant-${project}-`));
  try {
    cpSync(join(dir, "task"), tree, { recursive: true });
    if (variant) cpSync(join(dir, "reference", variant), tree, { recursive: true });
    const expect = readJson(join(dir, "expect.json"));
    const slots = readJson(join(dir, "slots.json"));
    return { held: scoreHeldOut(tree, join(dir, "held-out")), tests: scoreTests(tree, expect.test_command ?? slots.values["test-command"]) };
  } finally {
    rmSync(tree, { recursive: true, force: true });
  }
}

test("study two has its three projects", () => {
  assert.deepEqual(projects.sort(), ["heterogeneous-critic", "review-gate-2", "taste-polish"]);
});

for (const project of projects) {
  const dir = join(comparisons, project);
  const expect = readJson(join(dir, "expect.json"));
  const slots = readJson(join(dir, "slots.json"));

  test(`${project}: the kept solution passes every held-out case and the project's own tests`, () => {
    const { held, tests } = scoreVariant(project, "solution");
    assert.equal(held.ran, true, held.reason);
    assert.deepEqual(held.failing, []);
    assert.equal(held.passed, held.cases);
    assert.equal(held.cases, expect.held_out_cases, "expect.json says how many cases the suite has");
    assert.equal(tests.pass, true);
  });

  if (expect.judge?.artifact) {
    test(`${project}: the kept solution renders the held-out reference, byte for byte`, async () => {
      const { renderStatement } = await import(join(dir, "reference", "solution", "src", "statement.mjs"));
      const data = readJson(join(dir, "task", "data", "usage.json"));
      assert.equal(renderStatement(data), readFileSync(join(dir, "held-out", "reference.txt"), "utf8"));
    });
  }

  test(`${project}: the task as it ships does not pass the held-out suite, and every case is counted`, () => {
    const { held, tests } = scoreVariant(project, null);
    assert.equal(held.ran, true, held.reason);
    assert.equal(held.cases, expect.held_out_cases, "a suite that cannot find the work still reports each of its cases");
    assert.equal(held.passed, expect.bare_task_passes ?? 0);
    assert.equal(tests.pass, true, "the task folder's own tests pass before any work");
  });

  test(`${project}: a careful first pass, written without the suite, fails it at the open points`, () => {
    const { held, tests } = scoreVariant(project, "first-pass");
    assert.equal(held.ran, true, held.reason);
    assert.equal(tests.pass, true);
    assert.ok(held.passed < held.cases, "the first pass must not pass");
    assert.equal(held.passed, expect.first_pass.held_out_passes, `the first pass passes ${held.passed} of ${held.cases}; expect.json first_pass.held_out_passes says ${expect.first_pass.held_out_passes}`);
    // Every group the pre-registration calls open is failed at least once, and none it calls stated.
    const groups = new Set(held.failing.map((name) => name.split(":")[0]));
    for (const group of expect.first_pass.fails_in) assert.ok(groups.has(group), `the first pass fails nothing in "${group}"`);
    for (const group of groups) assert.ok(expect.first_pass.fails_in.includes(group), `the first pass fails a case in "${group}", which the pre-registration does not call open`);
  });

  test(`${project}: the task text and arm D's prompt carry no role, no held-out suite and no tool`, () => {
    const { prompt, report } = deriveD({ task: slots.values.task, testCommand: expect.test_command ?? slots.values["test-command"], acceptance: expect.acceptance, heldOutMarks: ["<held-out>", "held-out"] });
    assert.deepEqual(report.design_words, []);
    assert.deepEqual(report.held_out_named, []);
    assert.deepEqual(report.mechanics_left, []);
    assert.ok(!/grooph/i.test(prompt));
    if (existsSync(join(dir, "prompt-D.md"))) assert.equal(readFileSync(join(dir, "prompt-D.md"), "utf8"), prompt, "the committed prompt-D.md is what the task folder derives");
  });
}
