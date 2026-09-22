// The runner's pure parts (handoff 0016, criteria 1 and 6): the ledger's rules, the alternation,
// the judge's letters and the diff it sees. Run with: node --test scripts/lib/compare-run.test.mjs
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import { gate, loadLedger, openRunEntry, runLabel, settleEntry, totals } from "./compare-ledger.mjs";
import { ARMS, drawLetters, judgePrompt, judgedDiff, nextRun, runDirs, shuffle } from "./compare-run.mjs";

const fresh = () => loadLedger(join(tmpdir(), "no-such-ledger.json"));

test("a fresh ledger has the study's numbers and a cap history", () => {
  const ledger = fresh();
  assert.equal(ledger.cap_usd, 100);
  assert.equal(ledger.refuse_below_usd, 6);
  assert.equal(ledger.per_invocation_ceiling_usd, 9);
  assert.equal(ledger.cap_history.length, 1);
  assert.equal(ledger.cap_history[0].to_usd, 100);
  assert.deepEqual(totals(ledger), { spent: 0, remaining: 100 });
});

test("the gate: one kickoff per run, iterations and the judge apart, the floor and the ceiling", () => {
  const ledger = fresh();
  const a1 = { project: "p", arm: "A", replicate: 1 };
  let d = gate(ledger, { ...a1, kind: "kickoff" });
  assert.equal(d.ok, true);
  assert.equal(d.maxBudget, 9);
  const e = openRunEntry(ledger, { ...a1, kind: "kickoff", maxBudget: d.maxBudget });
  assert.equal(e.run, "p/A-1");
  d = gate(ledger, { ...a1, kind: "kickoff" });
  assert.equal(d.ok, false, "a running line blocks");
  settleEntry(e, { status: "ok", cost_usd: 2.5 });
  d = gate(ledger, { ...a1, kind: "kickoff" });
  assert.equal(d.ok, false, "no second kickoff of the same run");
  assert.match(d.reason, /already has a kickoff/);
  assert.equal(gate(ledger, { project: "p", arm: "A", replicate: 2, kind: "kickoff" }).ok, true, "the next replicate is its own run");
  assert.equal(gate(ledger, { project: "p", arm: "B", replicate: 1, kind: "kickoff" }).ok, true, "another arm is its own run");
  assert.equal(gate(ledger, { project: "p", arm: "C", replicate: 1, kind: "iteration" }).ok, true, "iterations are not kickoffs");
  assert.equal(gate(ledger, { project: "p", arm: "judge", replicate: null, kind: "kickoff" }).ok, true);
  assert.equal(runLabel({ project: "p", arm: "judge" }), "p/judge");
  // The retry: once, and only used up when it reached a model.
  d = gate(ledger, { ...a1, kind: "kickoff", retry: "network" });
  assert.equal(d.ok, true);
  const r = openRunEntry(ledger, { ...a1, kind: "kickoff", maxBudget: 9, retry: "network" });
  settleEntry(r, { status: "error", cost_usd: 0 });
  assert.equal(gate(ledger, { ...a1, kind: "kickoff", retry: "sign-in" }).ok, true, "a retry that reached no model is not used up");
  const r2 = openRunEntry(ledger, { ...a1, kind: "kickoff", maxBudget: 9, retry: "sign-in" });
  settleEntry(r2, { status: "ok", cost_usd: 1 });
  assert.equal(gate(ledger, { ...a1, kind: "kickoff", retry: "again" }).ok, false, "the one retry is used");
  assert.equal(gate(ledger, { project: "q", arm: "A", replicate: 1, kind: "kickoff", retry: "x" }).ok, false, "nothing to retry");
  // The floor and the ceiling.
  const spent = openRunEntry(ledger, { project: "p", arm: "B", replicate: 1, kind: "kickoff", maxBudget: 9 });
  settleEntry(spent, { status: "ok", cost_usd: 88 });
  d = gate(ledger, { project: "p", arm: "C", replicate: 1, kind: "kickoff" });
  assert.equal(d.ok, true);
  assert.equal(d.maxBudget, 8.5, "capped at what remains");
  const more = openRunEntry(ledger, { project: "p", arm: "C", replicate: 1, kind: "kickoff", maxBudget: 8.5 });
  settleEntry(more, { status: "ok", cost_usd: 3 });
  d = gate(ledger, { project: "p", arm: "C", replicate: 2, kind: "kickoff" });
  assert.equal(d.ok, false);
  assert.match(d.reason, /less than the \$6\.00/);
  // An unsettled cost counts at its ceiling.
  const unsettled = openRunEntry(ledger, { project: "p", arm: "A", replicate: 3, kind: "kickoff", maxBudget: 5 });
  settleEntry(unsettled, { status: "failed", cost_usd: null });
  assert.equal(totals(ledger).spent, 2.5 + 0 + 1 + 88 + 3 + 5);
});

test("the alternation A1 B1 C1 A2 B2 C2 follows what is on disk", () => {
  const dir = mkdtempSync(join(tmpdir(), "grooph-compare-alt-"));
  try {
    const proj = { dir, replicates: 2 };
    const mark = (name) => {
      mkdirSync(join(dir, name));
      writeFileSync(join(dir, name, "result.json"), "{}");
    };
    assert.deepEqual(nextRun(proj), { arm: "A", replicate: 1 });
    mark("A-1");
    assert.deepEqual(nextRun(proj), { arm: "B", replicate: 1 });
    mark("B-1");
    mark("C-1");
    assert.deepEqual(nextRun(proj), { arm: "A", replicate: 2 });
    mark("A-2");
    mark("B-2");
    mkdirSync(join(dir, "C-2-failed-1"));
    assert.deepEqual(nextRun(proj), { arm: "C", replicate: 2 }, "a failed folder is not a run");
    mark("C-2");
    assert.equal(nextRun(proj), null);
    assert.deepEqual(Object.keys(runDirs(dir)).sort(), ["A-1", "A-2", "B-1", "B-2", "C-1", "C-2"]);
    assert.deepEqual(ARMS, ["A", "B", "C"]);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("the judge's letters are never the arms' names and come in random order", () => {
  let seed = 7;
  const random = () => {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  };
  const letters = drawLetters(6, random);
  assert.equal(new Set(letters).size, 6);
  for (const l of letters) assert.ok(!["A", "B", "C"].includes(l), l);
  const order = shuffle(["A-1", "B-1", "C-1", "A-2", "B-2", "C-2"], random);
  assert.deepEqual([...order].sort(), ["A-1", "A-2", "B-1", "B-2", "C-1", "C-2"]);
  assert.notDeepEqual(order, ["A-1", "B-1", "C-1", "A-2", "B-2", "C-2"]);
});

test("the judge sees only the deliverable paths, with the tool's name redacted", () => {
  const diff = [
    "diff --git a/src/x.mjs b/src/x.mjs\n--- a/src/x.mjs\n+++ b/src/x.mjs\n@@ -1 +1 @@\n-a\n+b // built by grooph\n",
    "diff --git a/REVIEW.md b/REVIEW.md\nnew file mode 100644\n--- /dev/null\n+++ b/REVIEW.md\n@@ -0,0 +1 @@\n+round 0 of the grooph graph\n",
    "diff --git a/tests/x.test.mjs b/tests/x.test.mjs\n--- a/tests/x.test.mjs\n+++ b/tests/x.test.mjs\n@@ -1 +1 @@\n-t\n+u\n",
  ].join("");
  const judged = judgedDiff(diff, ["src/", "tests/"]);
  assert.deepEqual(judged.files, ["src/x.mjs", "tests/x.test.mjs"]);
  assert.ok(!judged.text.includes("REVIEW.md"));
  assert.ok(!/grooph/i.test(judged.text));
  assert.equal(judged.redactions, 1);
  const prompt = judgePrompt({ proj: { slots: { values: { task: "Do the thing." } } }, taskFiles: [{ path: "README.md", text: "# contract" }], candidates: [{ letter: "Q", diff: judged.text }, { letter: "M", diff: "" }] });
  assert.ok(prompt.includes("## Candidate Q"));
  assert.ok(prompt.includes("## Candidate M"));
  assert.ok(prompt.includes("(no change to the deliverable paths)"));
  assert.ok(prompt.includes('"ranking": ["Q", "M"]'));
  assert.ok(!/\barm\b/i.test(prompt), "the prompt never says which arm");
});
