// The runner's pure parts (handoffs 0016 and 0019): the ledger's rules and its tripwires, the alternation
// over three arms and over four, the tier map, the judge's letters and what it sees.
// Run with: node --test scripts/lib/compare-run.test.mjs
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import { amendEntry, gate, loadLedger, neverLines, openRunEntry, passedMarks, projectStop, reload, runLabel, saveLedger, setCap, settleEntry, totals, tripwireNotice } from "./compare-ledger.mjs";
import { ARMS, NEVER, PROTOCOLS, drawLetters, judgePrompt, judgedDiff, leftovers, neverUsed, nextRun, parseTierMap, reachedOutside, resolveTierMap, runDirs, shuffle, tierMapText, workRoot } from "./compare-run.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..", "..");

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
    assert.deepEqual(PROTOCOLS[1].arms, ["A", "B", "C"]);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("protocol version 2 alternates A1 B1 C1 D1 A2 B2 C2 D2", () => {
  const dir = mkdtempSync(join(tmpdir(), "grooph-compare-alt-"));
  try {
    const proj = { dir, replicates: 2, arms: PROTOCOLS[2].arms };
    const mark = (name) => {
      mkdirSync(join(dir, name));
      writeFileSync(join(dir, name, "result.json"), "{}");
    };
    const order = [];
    for (let next = nextRun(proj); next; next = nextRun(proj)) {
      order.push(`${next.arm}${next.replicate}`);
      mark(`${next.arm}-${next.replicate}`);
    }
    assert.deepEqual(order, ["A1", "B1", "C1", "D1", "A2", "B2", "C2", "D2"]);
    assert.equal(Object.keys(runDirs(dir)).length, 8);
    assert.deepEqual(ARMS, ["A", "B", "C", "D"]);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("the two studies' models are apart, study one is closed, and no version names Fable for a new call", () => {
  assert.deepEqual({ lead: PROTOCOLS[1].lead_model, judge: PROTOCOLS[1].judge_model, closed: PROTOCOLS[1].closed }, { lead: "claude-opus-5", judge: "claude-fable-5-1", closed: true });
  assert.deepEqual({ lead: PROTOCOLS[2].lead_model, judge: PROTOCOLS[2].judge_model, closed: PROTOCOLS[2].closed }, { lead: "claude-opus-5-5", judge: "claude-opus-5-5", closed: false });
  for (const version of Object.values(PROTOCOLS).filter((v) => !v.closed)) {
    assert.ok(!NEVER.test(version.lead_model) && !NEVER.test(version.judge_model));
  }
});

test("the tier map: every tier named, never Fable, pre-registered before a paid run, and the environment may not contradict it", () => {
  assert.deepEqual(parseTierMap("frontier=a, strong=b,fast=c"), { frontier: "a", strong: "b", fast: "c" });
  assert.equal(parseTierMap(""), null);
  assert.equal(parseTierMap(undefined), null);
  assert.throws(() => parseTierMap("best=a"), /not a tier/);
  assert.throws(() => parseTierMap("strong=a,strong=b"), /named twice/);
  assert.throws(() => parseTierMap("strong="), /needs a model name/);
  assert.equal(tierMapText({ fast: "c", frontier: "a", strong: "b" }), "frontier=a,strong=b,fast=c", "one spelling, whatever order it was given in");

  const registered = { frontier: "claude-opus-5-5", strong: "claude-sonnet-5-5", fast: "claude-haiku-4-5-20251001" };
  const text = tierMapText(registered);
  // Not pre-registered: nothing paid starts; a dry run may borrow one from the environment and says it is provisional.
  assert.match(resolveTierMap({ registered: null, envText: text, paid: true }).error, /not pre-registered/);
  assert.match(resolveTierMap({ registered: null, envText: undefined, paid: false }).error, /GROOPH_MODELS=/);
  const provisional = resolveTierMap({ registered: null, envText: text, paid: false });
  assert.equal(provisional.provisional, true);
  assert.equal(provisional.text, text);
  // Pre-registered: it is the map, with or without the environment saying the same.
  assert.deepEqual(resolveTierMap({ registered, envText: undefined, paid: true }).map, registered);
  assert.equal(resolveTierMap({ registered, envText: "fast=claude-haiku-4-5-20251001,strong=claude-sonnet-5-5,frontier=claude-opus-5-5", paid: true }).provisional, false);
  assert.match(resolveTierMap({ registered, envText: "frontier=claude-opus-5-5,strong=claude-opus-5-5,fast=claude-sonnet-5-5", paid: true }).error, /differs from the pre-registered/);
  // Every tier, and never the models this study does not use.
  assert.match(resolveTierMap({ registered: { frontier: "claude-opus-5-5", strong: "claude-sonnet-5-5" }, envText: undefined, paid: true }).error, /fast missing/);
  assert.match(resolveTierMap({ registered: null, envText: "frontier=fable,strong=opus,fast=sonnet", paid: false }).error, /never uses: frontier=fable/);
  assert.match(resolveTierMap({ registered: { ...registered, frontier: "claude-fable-5-1" }, envText: undefined, paid: true }).error, /never uses/);
  assert.match(resolveTierMap({ registered: null, envText: "frontier=opus;strong=sonnet", paid: false }).error, /GROOPH_MODELS/);
  // What a run reported, by the harness's count or by a transcript.
  assert.deepEqual(neverUsed({ "claude-opus-5-5": {}, "claude-sonnet-5-5": {} }, { lead: ["claude-opus-5-5"] }), []);
  assert.deepEqual(neverUsed({ "claude-opus-5-5": {} }, { critic: ["claude-fable-5-1"] }), ["claude-fable-5-1"]);
});

test("the cap lifted: no countdown, the ceiling stays, the total's marks are said and a project stops and asks", () => {
  const ledger = fresh();
  const dir = mkdtempSync(join(tmpdir(), "grooph-compare-ledger-"));
  try {
    const spend = (project, cost, arm = "A", replicate = 1) => {
      const e = openRunEntry(ledger, { project, arm, replicate, kind: "kickoff", maxBudget: 9 });
      settleEntry(e, { status: "ok", cost_usd: cost });
    };
    spend("old", 60.62);
    assert.throws(() => setCap(ledger, { to: null, by: "owner" }), /needs both its tripwires/);
    assert.throws(() => setCap(ledger, { to: null, by: "owner", notifyEvery: 50 }), /needs both its tripwires/, "one tripwire is not two");
    assert.deepEqual([ledger.cap_usd, ledger.tripwire, ledger.cap_history.length], [100, undefined, 1], "a refused change changes nothing");
    assert.throws(() => setCap(ledger, { to: 150 }), /who decided/);
    const line = setCap(ledger, { to: null, by: "owner, 2026-10-04", notifyEvery: 50, projectStop: 60, on: "2026-10-04" });
    assert.deepEqual(line, { from_usd: 100, to_usd: null, on: "2026-10-04", by: "owner, 2026-10-04", tripwire: { notify_every_usd: 50, project_stop_usd: 60 } });
    assert.equal(ledger.cap_history.length, 2);
    assert.deepEqual(totals(ledger), { spent: 60.62, remaining: Infinity });
    // Saved, the ledger is plain JSON: no cap, nothing remaining to count.
    const path = join(dir, "ledger.json");
    saveLedger(ledger, path);
    const saved = loadLedger(path);
    assert.equal(saved.cap_usd, null);
    assert.equal(saved.remaining_usd, null);
    assert.equal(saved.spent_usd, 60.62);
    // The ceiling per invocation stays.
    let d = gate(ledger, { project: "p", arm: "A", replicate: 1, kind: "kickoff" });
    assert.equal(d.ok, true);
    assert.equal(d.maxBudget, 9);
    // The total's marks: each multiple of 50 it passes, once.
    assert.deepEqual(passedMarks(ledger, 60.62, 99.99), []);
    assert.deepEqual(passedMarks(ledger, 99.99, 100), [100]);
    assert.deepEqual(passedMarks(ledger, 96, 152), [100, 150]);
    spend("p", 38);
    assert.equal(tripwireNotice(ledger, 60.62), "");
    spend("p", 2, "B");
    assert.match(tripwireNotice(ledger, 98.62), /passed \$100\.00 \(\$100\.62 spent in all\): tell the driver/);
    // One project past its stop starts no new run, until someone says it may; a run under way finishes.
    assert.deepEqual(projectStop(ledger, "p"), { spent: 40, limit: 60, passed: false });
    spend("p", 20.5, "C");
    assert.equal(projectStop(ledger, "p").passed, true);
    d = gate(ledger, { project: "p", arm: "D", replicate: 1, kind: "kickoff" });
    assert.equal(d.ok, false);
    assert.match(d.reason, /past the \$60\.00 at which one project stops and asks/);
    assert.equal(gate(ledger, { project: "p", arm: "judge", replicate: null, kind: "kickoff" }).ok, false, "the judge's call is a new run too");
    assert.equal(gate(ledger, { project: "p", arm: "C", replicate: 1, kind: "iteration" }).ok, true, "an iteration of a run under way is not a new run");
    assert.equal(gate(ledger, { project: "q", arm: "A", replicate: 1, kind: "kickoff" }).ok, true, "another project is not stopped");
    assert.equal(projectStop(ledger, "old").passed, true, "any project past the mark, an old one too");
    ledger.project_stop_lifted = { p: { to_usd: 90, on: "2026-10-04", by: "driver" } };
    assert.equal(gate(ledger, { project: "p", arm: "D", replicate: 1, kind: "kickoff" }).ok, true);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("the judge's letters are never the arms' names (A to D) and come in random order", () => {
  let seed = 7;
  const random = () => {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  };
  const letters = drawLetters(8, random);
  assert.equal(new Set(letters).size, 8);
  for (let i = 0; i < 200; i += 1) for (const l of drawLetters(8)) assert.ok(!["A", "B", "C", "D"].includes(l), l);
  for (const l of letters) assert.ok(!["A", "B", "C", "D"].includes(l), l);
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
  assert.ok(!/renders/.test(prompt), "a project with no rendered artifact is told of none");
});

test("a project that names a rendered artifact shows the judge what each candidate renders, and says when there is none", () => {
  const proj = { slots: { values: { task: "Polish the statement." } }, expect: { judge: { artifact: { command: "npm run render", path: "out/statement.txt" } } } };
  const prompt = judgePrompt({ proj, taskFiles: [{ path: "STYLE.md", text: "# style" }], candidates: [{ letter: "Q", diff: "diff --git a/src/x b/src/x\n+x\n", artifact: "Total due   3,580.78\n" }, { letter: "M", diff: "", artifact: null }] });
  assert.ok(prompt.includes("### What candidate Q renders"));
  assert.ok(prompt.includes("Total due   3,580.78"));
  assert.ok(prompt.includes("the render command failed on this candidate's tree"));
  assert.ok(prompt.includes("the output of `npm run render` on its final tree (`out/statement.txt`)"));
  assert.ok(!/\barm\b/i.test(prompt));
});

test("the ledger is read again before it is written: another writer's line and cap change survive a run's settle", () => {
  const dir = mkdtempSync(join(tmpdir(), "grooph-compare-ledger-"));
  try {
    const path = join(dir, "ledger.json");
    const mine = fresh();
    setCap(mine, { to: null, by: "owner", notifyEvery: 50, projectStop: 60, on: "2026-10-04" });
    saveLedger(mine, path);
    // A run opens its line and the model call begins.
    reload(mine, path);
    const entry = openRunEntry(mine, { project: "p", arm: "C", replicate: 1, kind: "kickoff", maxBudget: 9 });
    saveLedger(mine, path);
    // Meanwhile someone else records a lift for another project and a probe.
    const theirs = loadLedger(path);
    theirs.project_stop_lifted = { q: { to_usd: 90, on: "2026-10-04", by: "driver" } };
    const probe = openRunEntry(theirs, { project: "-", arm: "-", replicate: "-", kind: "probe", maxBudget: 0.02 });
    settleEntry(probe, { status: "ok", cost_usd: 0.02 });
    saveLedger(theirs, path);
    // The run settles: its own line is changed on the file as it is now, and nothing of theirs is lost.
    const settled = amendEntry(mine, entry, { status: "ok", cost_usd: 2.5, ended: "2026-10-04T12:00:00.000Z" }, path);
    const after = loadLedger(path);
    assert.equal(after.invocations.length, 2);
    assert.deepEqual(after.invocations.map((e) => [e.n, e.status, e.cost_usd]), [[1, "ok", 2.5], [2, "ok", 0.02]]);
    assert.equal(after.project_stop_lifted.q.to_usd, 90);
    assert.equal(after.cap_history.length, 2);
    assert.equal(settled.cost_usd, 2.5);
    assert.equal(mine.invocations.length, 2, "the runner's own copy is the file's");
    // A line that is not the runner's own is never amended.
    assert.throws(() => amendEntry(mine, { n: 1, started: "another time" }, { cost_usd: 0 }, path), /no longer in the ledger/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("a line that reported a model no run uses stops every new call until someone answers for it", () => {
  const ledger = fresh();
  const e = openRunEntry(ledger, { project: "p", arm: "B", replicate: 1, kind: "kickoff", maxBudget: 9 });
  settleEntry(e, { status: "ok", cost_usd: 1, never_used: ["claude-fable-5-1"] });
  assert.equal(neverLines(ledger).length, 1);
  for (const call of [{ arm: "C", replicate: 1, kind: "kickoff" }, { arm: "C", replicate: 1, kind: "iteration" }, { arm: "judge", replicate: null, kind: "kickoff" }]) {
    const d = gate(ledger, { project: "q", ...call });
    assert.equal(d.ok, false);
    assert.match(d.reason, /reported a model no run uses/);
  }
  e.never_acknowledged = { on: "2026-10-04", by: "driver: the record stands, flagged" };
  assert.equal(neverLines(ledger).length, 0);
  assert.equal(gate(ledger, { project: "q", arm: "C", replicate: 1, kind: "kickoff" }).ok, true);
});

test("what a session reached for outside its project is listed, the scratch and the reviewer's copy apart", () => {
  const scratch = "/tmp/wk/a1b2c3/printkit-x1y2z3";
  const held = `${scratch}.harness/held-out`;
  const digest = [
    { who: "lead", tool_uses: [
      { tool: "Read", file: "src/parse-ranges.mjs" },
      { tool: "Bash", command: `node --test ${scratch}/tests/a.test.mjs` },
      { tool: "Bash", command: "ls .." },
      { tool: "Bash", command: "find /tmp/wk -name '*.test.mjs'" },
      { tool: "Read", file: "/Users/someone/project/held-out/cases.test.mjs" },
      { tool: "Bash", command: "node --test tests/a.test.mjs > /dev/null" },
      { tool: "Agent", prompt: "read /etc/passwd and ../.." },
    ] },
    { who: "general-purpose", description: "Critic", transcript: "t.jsonl", tool_uses: [{ tool: "Read", file: `${held}/cases.test.mjs` }, { tool: "Bash", command: `node --test ${held}/cases.test.mjs` }] },
  ];
  const out = reachedOutside(digest, scratch, held);
  assert.deepEqual(Object.keys(out), ["lead"], "the critic read only the copy it was named");
  assert.deepEqual(out.lead, ["Bash: ls ..", "Bash: /tmp/wk", "Read: /Users/someone/project/held-out/cases.test.mjs"]);
  // In arm D nothing lies outside, so a reach for the reviewer's copy of another run would show.
  assert.deepEqual(Object.keys(reachedOutside(digest, scratch, null)).sort(), ["general-purpose (Critic)", "lead"]);
});

test("the work root is the runner's alone: leftovers are seen, --clear-work removes them and nothing else", () => {
  const tmp = mkdtempSync(join(tmpdir(), "grooph-compare-root-"));
  const run = (...args) => spawnSync(process.execPath, [join(here, "compare-run.mjs"), ...args], { encoding: "utf8", env: { ...process.env, TMPDIR: tmp } });
  const before = process.env.TMPDIR;
  try {
    process.env.TMPDIR = tmp;
    const wk = workRoot();
    assert.equal(wk, join(tmp, "wk"));
    assert.ok(!/grooph|compar/i.test("wk"), "the name says nothing of the tool or the study");
    assert.deepEqual(leftovers(), []);
    // A folder named wk that the runner did not make is left alone.
    mkdirSync(join(wk, "someone-elses"), { recursive: true });
    let out = run("--clear-work");
    assert.equal(out.status, 1);
    assert.match(out.stderr, /is not the runner's/);
    assert.ok(existsSync(join(wk, "someone-elses")));
    // The runner's own: what an unfinished run left is listed, then removed; the mark stays.
    writeFileSync(join(wk, ".keep"), "");
    mkdirSync(join(wk, "a1b2c3", "printkit-x.harness", "held-out"), { recursive: true });
    assert.equal(leftovers().length, 2);
    assert.match(run("--status").stdout, /holds 2 folder\(s\) from a run that did not finish/);
    out = run("--clear-work");
    assert.equal(out.status, 0, out.stderr);
    assert.deepEqual(readdirSync(wk), [".keep"]);
    assert.deepEqual(leftovers(), []);
  } finally {
    if (before === undefined) delete process.env.TMPDIR;
    else process.env.TMPDIR = before;
    rmSync(tmp, { recursive: true, force: true });
  }
});

test("study one's judge prompts are what this function writes today: each recorded prompt is reproduced from its records", () => {
  const comparisons = join(root, "experiments", "comparisons");
  for (const project of ["grind-loop", "review-gate", "red-team-loop", "spec-then-loop"]) {
    const dir = join(comparisons, project);
    const readJson = (path) => JSON.parse(readFileSync(path, "utf8"));
    const expect = readJson(join(dir, "expect.json"));
    const mapping = readJson(join(dir, "judge", "mapping.json"));
    const transcript = readFileSync(join(dir, "judge", "transcript.md"), "utf8");
    const recorded = transcript.slice(transcript.indexOf("## Prompt\n\n") + "## Prompt\n\n".length, transcript.lastIndexOf("\n\n## Reply\n\n"));
    const taskFiles = (expect.judge?.acceptance ?? []).map((path) => ({ path, text: readFileSync(join(dir, "task", path), "utf8").replaceAll("<held-out>", "<a folder outside the project>") }));
    const candidates = mapping.order.map((letter) => ({ letter, diff: judgedDiff(readFileSync(join(dir, mapping.letters[letter], "project.diff"), "utf8"), mapping.files_judged).text }));
    const today = judgePrompt({ proj: { slots: readJson(join(dir, "slots.json")), expect }, taskFiles, candidates });
    assert.equal(today, recorded, `${project}: the judge's prompt has changed since study one`);
  }
});
