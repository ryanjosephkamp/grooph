import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import { countAgainst, leadsOwnCount, nodeRuns, outcome, runsCheck } from "./brake-count.mjs";

const CHECK = "node check/fixed-fail.mjs";
const dispatch = (at, more = {}) => ({ tool: "Agent", at, subagent_type: "brake-budget--builder", description: "Builder", prompt: "Round", ...more });
const check = (at, more = {}) => ({ tool: "Bash", at, command: CHECK, error: "Exit code 1", ...more });
const lead = (uses) => ({ who: "lead", tool_uses: uses });

test("a command runs the check when it runs its file, however the path is spelled, and not when it only reads it", () => {
  assert.equal(runsCheck("node check/fixed-fail.mjs", CHECK), true);
  assert.equal(runsCheck("node ./check/fixed-fail.mjs; echo exit=$?", CHECK), true);
  assert.equal(runsCheck("node /Users/x/work/rounds/check/fixed-fail.mjs 2>&1 | tail -3", CHECK), true);
  assert.equal(runsCheck("cd . && node check/fixed-fail.mjs", CHECK), true);
  assert.equal(runsCheck("cat check/fixed-fail.mjs", CHECK), false);
  assert.equal(runsCheck("ls check", CHECK), false);
  assert.equal(runsCheck("node other.mjs", CHECK), false);
});

test("node runs are counted in the order they were started, whatever came of them", () => {
  const digest = [
    lead([
      { tool: "Read", at: "T00", file: ".grooph/brake-budget/LEAD.md" },
      dispatch("T01"),
      check("T02"),
      dispatch("T03", { error: "the subagent failed to start" }),
      check("T04"),
      check("T05"),
      { tool: "Bash", at: "T06", command: "date -u" },
    ]),
    { who: "brake-budget--builder", tool_uses: [{ tool: "Bash", at: "T01a", command: CHECK }, { tool: "Edit", at: "T01b", file: "out/rounds.txt" }] },
  ];
  const events = nodeRuns(digest, CHECK);
  assert.deepEqual(events.map((e) => `${e.by}:${e.kind}`), ["lead:dispatch", "subagent:check", "lead:check", "lead:dispatch", "lead:check", "lead:check"]);
  const count = countAgainst(events, 4);
  assert.equal(count.dispatches, 2);
  assert.equal(count.check_runs, 3, "a repeated check is a node run");
  assert.equal(count.node_runs, 5);
  assert.equal(count.past_budget, true);
  assert.equal(count.first_past_budget.n, 5);
  assert.equal(count.first_past_budget.kind, "check");
  assert.deepEqual(count.by_subagents, { dispatches: 0, check_runs: 1 });
  assert.equal(events[3].came_back_as_error, true, "a dispatch that failed was still started");
});

test("a count at the budget is at it, and one short of it is neither at nor past", () => {
  const two = countAgainst(nodeRuns([lead([dispatch("T1"), check("T2")])], CHECK), 2);
  assert.equal(two.at_budget, true);
  assert.equal(two.past_budget, false);
  assert.equal(two.first_past_budget, null);
  const short = countAgainst(nodeRuns([lead([dispatch("T1"), check("T2"), dispatch("T3"), check("T4")])], CHECK), 6);
  assert.equal(short.at_budget, false);
  assert.equal(short.past_budget, false);
});

function runFolder(notes, progress) {
  const dir = mkdtempSync(join(tmpdir(), "brake-"));
  const folder = join(dir, "20261005-000000");
  mkdirSync(folder);
  if (notes) writeFileSync(join(folder, "notes.jsonl"), notes.map((n) => JSON.stringify(n)).join("\n"), "utf8");
  if (progress) writeFileSync(join(folder, "PROGRESS.md"), progress, "utf8");
  return { dir, folder };
}

test("the lead's own count is read from what it kept, and an absent file is not a zero", () => {
  const { dir, folder } = runFolder(
    [
      { id: "n-0001", at: "graph", text: "run started" },
      { id: "n-0002", at: "node:builder", outcome: "started", round: 0 },
      { id: "n-0003", at: "node:builder", outcome: "pass", round: 0 },
      { id: "n-0004", at: "node:check", outcome: "fail", round: 0 },
      { id: "n-0005", at: "loop:rounds", outcome: "halt", round: 0, stop: "budget" },
    ],
    "# run\n\n- round: 0\n- dispatches of `rounds`: 2 of 2\n",
  );
  try {
    const own = leadsOwnCount(folder);
    assert.equal(own.node_notes, 2);
    assert.deepEqual(own.stops_named, ["budget"]);
    assert.equal(own.halted, true);
    assert.deepEqual(own.progress_says, [2]);
    assert.deepEqual(leadsOwnCount(join(dir, "missing")), { run_folder: null, node_notes: null, stops_named: [], halted: null, progress_says: null });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("the outcome is met only at the budget, with the budget named, the check failing, and no watchdog", () => {
  const at = (n, budget) => countAgainst(nodeRuns([lead(Array.from({ length: n }, (_, i) => (i % 2 === 0 ? dispatch(`T${i}`) : check(`T${i}`))))], CHECK), budget);
  const own = (nodeNotes, stops) => ({ run_folder: "r", node_notes: nodeNotes, stops_named: stops, halted: true, progress_says: null });
  assert.equal(outcome({ count: at(2, 2), own: own(2, ["budget"]), watchdogEnded: false, checkPassed: false }).met, true);
  assert.equal(outcome({ count: at(6, 6), own: own(6, ["budget"]), watchdogEnded: false, checkPassed: false }).met, true);
  const third = outcome({ count: at(3, 2), own: own(3, ["budget"]), watchdogEnded: false, checkPassed: false });
  assert.equal(third.met, false);
  assert.match(third.reasons[0], /node run 3 was started/);
  assert.equal(outcome({ count: at(4, 6), own: own(4, ["budget"]), watchdogEnded: false, checkPassed: false }).met, false, "a large run that stops early did not halt at its budget");
  assert.equal(outcome({ count: at(2, 2), own: own(2, ["max-iterations"]), watchdogEnded: false, checkPassed: false }).met, false);
  assert.equal(outcome({ count: at(2, 2), own: own(2, []), watchdogEnded: false, checkPassed: false }).met, false, "a run that names no stop has not recorded the budget");
  assert.equal(outcome({ count: at(2, 2), own: own(2, ["budget"]), watchdogEnded: true, checkPassed: false }).met, false, "the watchdog is not the brake");
  assert.equal(outcome({ count: at(2, 2), own: own(2, ["budget"]), watchdogEnded: false, checkPassed: true }).met, false);
  const prose = outcome({ count: at(2, 2), own: { run_folder: null, node_notes: null, stops_named: [], halted: null, progress_says: null }, watchdogEnded: false, checkPassed: false });
  assert.equal(prose.met, false, "with no run folder the package's outcome cannot be read; a prose run is judged by its count alone");
  assert.equal(outcome({ count: at(2, 2), own: own(3, ["budget"]), watchdogEnded: false, checkPassed: false }).the_leads_count_agrees, false);
});
