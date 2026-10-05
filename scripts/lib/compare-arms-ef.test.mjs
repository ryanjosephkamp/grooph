import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import { deriveE, deriveF, heldOutSection, HOME, problems, reviewersFiles, slotsOfF, TASKS } from "./compare-arms-ef.mjs";
import { DESIGN_WORDS } from "./compare-prompt.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

test("the added section runs a suite and reads anything else, in the same words for every task, and names no role", () => {
  const one = heldOutSection(["layer-cases.test.mjs"]);
  assert.match(one, /^# Held-out material\n\n`<held-out>\/layer-cases\.test\.mjs` is a test suite kept outside this project\./);
  assert.match(one, /`node --test <held-out>\/layer-cases\.test\.mjs`, and make every case hold\. Do not change it\.\n$/);
  const two = heldOutSection(["REFERENCE.md", "reference.txt"]);
  assert.match(two, /`<held-out>\/REFERENCE\.md` and `<held-out>\/reference\.txt` are kept outside this project\. They say what the result is measured against\./);
  const mixed = heldOutSection(["a.test.mjs", "b.test.mjs", "notes.md"]);
  assert.match(mixed, /are test suites kept outside this project\. They settle/);
  assert.match(mixed, /`<held-out>\/notes\.md` is kept outside this project\. It says/);
  for (const text of [one, two, mixed]) assert.equal((text.match(DESIGN_WORDS) ?? []).length, 0, text);
});

test("a reviewer's files are the task's held-out folder less what was the scorer's alone", () => {
  assert.deepEqual(reviewersFiles("review-gate-2"), ["layer-cases.test.mjs"]);
  assert.deepEqual(reviewersFiles("heterogeneous-critic"), ["parse-ranges-cases.test.mjs"]);
  assert.deepEqual(reviewersFiles("taste-polish"), ["REFERENCE.md", "reference.txt"], "the properties suite is the scorer's alone");
});

for (const task of TASKS) {
  test(`${task}: arm E is arm D and one section; arm F's slots changed only the one that named held-out material`, () => {
    const e = deriveE(task);
    assert.deepEqual(problems(task, e, null), []);
    assert.equal(readFileSync(join(HOME, task, "prompt-E.md"), "utf8"), e.prompt, "the kept prompt is the derived one");
    const slots = slotsOfF(task);
    assert.equal(slots.changed.length, 1);
    assert.ok(String(slots.two.values[slots.changed[0]]).includes("<held-out>"));
    const kept = readFileSync(join(HOME, task, "prompt-F.md"), "utf8");
    assert.ok(!/held-out|held out/i.test(kept), "arm F's kept prompt names no held-out material");
    assert.ok(!/\/var\/folders|\/private\/|\/Users\//.test(kept), "and no path of the machine it was derived on");
    assert.match(kept, /claude-(?:opus|sonnet)-5-5/, "and names study two's models for its roles");
    assert.ok(!/fable|astra/i.test(kept));
  });
}

test("arm F's kept prompts are what the rule derives today", { skip: !existsSync(join(root, "packages", "cli", "dist")) }, () => {
  for (const task of TASKS) {
    const f = deriveF(task);
    assert.equal(readFileSync(join(HOME, task, "prompt-F.md"), "utf8"), f.prompt, task);
    assert.deepEqual(problems(task, deriveE(task), f), []);
  }
});
