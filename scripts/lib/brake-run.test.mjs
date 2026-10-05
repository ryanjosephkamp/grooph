import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import { compileBoth, differingLines, withoutBudget } from "./brake-run.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const expect = JSON.parse(readFileSync(join(root, "experiments", "brakes", "budget", "expect.json"), "utf8"));

test("two lines that state different budgets are the same line with the budget taken out, and no others are", () => {
  const same = (a, b) => withoutBudget(a) === withoutBudget(b);
  assert.ok(same("| 1 | budget: 2 dispatches | halt the run |", "| 1 | budget: 6 dispatches | halt the run |"));
  assert.ok(same("costs **2 dispatches**: `builder`, `check`. The budget of 2 covers 1 full round.", "costs **2 dispatches**: `builder`, `check`. The budget of 6 covers 3 full rounds."));
  assert.ok(same("`budget 2 dispatches`, `max-iterations n=20`", "`budget 6 dispatches`, `max-iterations n=20`"));
  assert.ok(same('          "limit": 2', '          "limit": 6'));
  assert.ok(same("at most 2 dispatches, at most 20 rounds", "at most 6 dispatches, at most 20 rounds"));
  assert.ok(!same("costs **2 dispatches**", "costs **3 dispatches**"), "what a round costs is not the budget");
  assert.ok(!same("| 2 | max iterations: 20 |", "| 2 | max iterations: 5 |"));
  assert.ok(!same("model: claude-sonnet-5-5", "model: claude-opus-5-5"));
});

test("the pre-registration and the graph agree", () => {
  const doc = JSON.parse(readFileSync(join(root, "experiments", "brakes", "budget", "brake.grooph.json"), "utf8"));
  const loop = doc.loops[0];
  assert.deepEqual(loop.members, expect.a_round_is);
  assert.equal(loop.stops.find((stop) => stop.kind === "budget").limit, expect.budgets.small);
  assert.equal(loop.stops.find((stop) => stop.kind === "budget").measure, "dispatches");
  assert.deepEqual(loop.stops.map((stop) => stop.kind), ["budget", "max-iterations"], "no other stop, and the budget is evaluated first");
  assert.ok(loop.stops.find((stop) => stop.kind === "max-iterations").n * expect.a_round_costs > expect.budgets.large, "the round cap cannot bind before the larger budget");
  assert.equal(doc.nodes.filter((node) => node.kind === "human-gate").length, 0);
  assert.equal(doc.nodes.find((node) => node.kind === "check").check.run, expect.check_run);
  assert.ok(!doc.nodes.find((node) => node.id === "builder").allow.includes("dispatch"), "the builder dispatches nobody");
  const ops = JSON.parse(readFileSync(join(root, "experiments", "brakes", "budget", "large.ops.json"), "utf8"));
  assert.equal(ops.length, 1);
  assert.equal(ops[0].stop.limit, expect.budgets.large);
  assert.match(doc.goal, /fails every round, by design/, "the lead is told the check never passes");
  assert.equal(readFileSync(join(root, "experiments", "brakes", "budget", "task", "out", "rounds.txt"), "utf8"), "", "the file the builder adds to starts empty");
  assert.match(JSON.stringify(expect), /never_used/);
  assert.ok(!/fable|astra/i.test(JSON.stringify({ lead: expect.lead, tiers: expect.tier_map })));
});

test("the two compiled packages differ in the budget and in nothing else", { skip: !existsSync(join(root, "packages", "cli", "dist")) }, () => {
  const work = mkdtempSync(join(tmpdir(), "brake-test-"));
  try {
    const built = compileBoth(work, expect);
    const lines = differingLines(built.small, built.large);
    assert.ok(lines.length > 0);
    for (const [name, n, a, b] of lines) assert.equal(withoutBudget(a), withoutBudget(b), `${name}:${n}`);
    assert.ok(lines.some(([name]) => name.endsWith("graph.grooph.json")));
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
});
