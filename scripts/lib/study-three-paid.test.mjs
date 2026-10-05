// Tests of the paid path that spend nothing: where a session would be started, a stand-in program is, which calls no
// model (scripts/lib/fixtures/stand-in-harness.mjs). The profile, the ledger and the records are all temporary.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import { recordFor, runBrake } from "./brake-run-paid.mjs";
import { layout, settingsFor } from "./compare-profile.mjs";
import { firstCall } from "./profile-first-call-paid.mjs";
import { expectation, resumePrompt, resumeStep } from "./resume-step-paid.mjs";
import { build as buildArm, expectation as rolesExpectation, nextRun, order, readings, runOne } from "./roles-or-information-paid.mjs";
import { endedBy, gameSessionsOpen, makeProject, refusals, resultsOfTranscript, runSession, spendFlags } from "./study-three-paid.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..", "..");
const STAND_IN = join(here, "fixtures", "stand-in-harness.mjs");
const built = existsSync(join(root, "packages", "cli", "dist"));
const MARK = JSON.parse(readFileSync(join(root, "experiments", "brakes", "budget", "expect.json"), "utf8")).check_line_begins;
const LINE = `${MARK}: this check fails every round, by design. Nothing in the project makes it pass.`;
const RUN = ".grooph/brake-budget/runs/20261005-000000";

/** A temporary home with a profile, an empty ledger and a place for records; the stand-in's plan goes in the profile. */
function place(plan) {
  const top = mkdtempSync(join(tmpdir(), "paid-"));
  const home = join(top, "home");
  const at = layout(home);
  for (const dir of [at.profile, at.shell, at.temp, at.cache, at.work]) mkdirSync(dir, { recursive: true });
  writeFileSync(join(at.profile, "stand-in-plan.json"), JSON.stringify(plan), "utf8");
  const ledgerPath = join(top, "ledger.json");
  writeFileSync(ledgerPath, JSON.stringify({ cap_usd: null, refuse_below_usd: 6, per_invocation_ceiling_usd: 9, tripwire: { notify_every_usd: 50, project_stop_usd: 60 }, invocations: [] }), "utf8");
  const common = { home, claude: STAND_IN, ledgerPath, profileCheck: () => [], gameOpen: [], go: "the driver said: run the small package run" };
  return { top, home, at, ledgerPath, recordRoot: join(top, "records"), common, ledger: () => JSON.parse(readFileSync(ledgerPath, "utf8")) };
}
const agent = (round) => ({ tool: "Agent", input: { subagent_type: "brake-budget--builder", description: `Builder round ${round}`, prompt: `Round ${round}` }, result: "verdict: done", appends: { "out/rounds.txt": `round ${round}\n` } });
const checkRun = { tool: "Bash", input: { command: "node check/fixed-fail.mjs" }, result: `Exit code 1\n${LINE}`, is_error: true };
const note = (line) => `${JSON.stringify(line)}\n`;
const notes = (stop = "budget") => ({ tool: "Bash", input: { command: `printf note >> ${RUN}/notes.jsonl` }, result: "", appends: { [`${RUN}/notes.jsonl`]: note({ id: "n-0001", at: "graph", text: "run started" }) + note({ id: "n-0002", at: "node:builder", outcome: "pass", round: 0 }) + note({ id: "n-0003", at: "node:check", outcome: "fail", round: 0 }) + note({ id: "n-0004", at: "loop:rounds", outcome: "halt", round: 0, stop }) } });
const count = (dir) => spawnSync(process.execPath, [join(here, "brake-count.mjs"), dir], { encoding: "utf8" });

test("a paid step needs both flags, and the driver's words are more than a word", () => {
  assert.deepEqual(spendFlags(["--spend", "--go", "the driver: run the first call"]), { ok: true, go: "the driver: run the first call", missing: [] });
  assert.equal(spendFlags(["--go", "the driver: run the first call"]).ok, false);
  assert.equal(spendFlags(["--spend"]).ok, false);
  assert.equal(spendFlags(["--spend", "--go"]).ok, false);
  assert.equal(spendFlags(["--spend", "--go", "--form"]).ok, false, "the next flag is not the driver's words");
  assert.equal(spendFlags(["--spend", "--go", "yes"]).ok, false, "a bare yes is not a record of who said what");
  assert.equal(spendFlags([]).missing.length, 2);
});

test("what ended a run is the session, the watchdog or the harness, and only one of them", () => {
  const ok = { type: "result", subtype: "success", is_error: false };
  assert.deepEqual(endedBy({ child: { status: 0 }, output: ok }), { ended_by: "the session", which: null });
  assert.deepEqual(endedBy({ child: { error: { code: "ETIMEDOUT" }, signal: "SIGTERM" }, output: null }), { ended_by: "the watchdog", which: "minutes" });
  assert.deepEqual(endedBy({ child: { status: 1 }, output: { subtype: "error_max_budget_usd", is_error: true } }), { ended_by: "the watchdog", which: "dollars" });
  assert.equal(endedBy({ child: { status: 1 }, output: null }).ended_by, "the harness");
  assert.match(endedBy({ child: { status: 1 }, output: null }).why, /no result from the harness \(exit 1\)/);
  assert.match(endedBy({ child: { error: { code: "ENOENT", message: "spawn claude ENOENT" } }, output: null }).why, /did not start/);
  assert.equal(endedBy({ child: { signal: "SIGKILL" }, output: null }).ended_by, "the harness", "a process that died without the watchdog is the harness's");
  const api = endedBy({ child: { status: 1 }, output: { subtype: "error_during_execution", is_error: true, api_error_status: 429 } });
  assert.equal(api.ended_by, "the harness");
  assert.match(api.why, /status 429/);
});

test("an open session of the game experiment is seen, and stops everything", () => {
  assert.deepEqual(gameSessionsOpen(() => ({ status: 1, stdout: "" })), []);
  assert.deepEqual(gameSessionsOpen(() => ({ status: 0, stdout: "4242 claude --model claude-opus-5-5 --name arena-claude-run\n" })), ["4242 claude --model claude-opus-5-5 --name arena-claude-run"]);
  const refused = refusals({ home: "/h", cwd: "/h/work/a/p", claude: "c", gameOpen: ["4242 …"], profileCheck: () => [] });
  assert.match(refused[0], /a session of the game experiment is open/);
  assert.deepEqual(refusals({ home: "/h", cwd: "/h/work/a/p", claude: "c", gameOpen: [], profileCheck: () => [] }), []);
  assert.match(refusals({ home: "/h", cwd: "/elsewhere/p", claude: "c", gameOpen: [], profileCheck: () => [] })[0], /is not under \/h\/work/);
  const profile = refusals({ home: "/h", cwd: "/h/work/a/p", claude: "c", gameOpen: [], profileCheck: () => [{ what: "the profile is signed in", ok: false, how: "not signed in" }, { what: "its work folder is empty", ok: false, how: "x" }, { what: "node is on a session's path", ok: true, how: "y" }] });
  assert.deepEqual(profile, ["the profile: the profile is signed in: not signed in"], "the work folder holds the session's own folder by then; everything else that fails refuses");
});

test("a transcript's results come back whole and in the order of its tool uses", () => {
  const dir = mkdtempSync(join(tmpdir(), "results-"));
  try {
    const use = (id, name) => JSON.stringify({ type: "assistant", message: { id: `m-${id}`, content: [{ type: "tool_use", id, name, input: {} }] } });
    const result = (id, content) => JSON.stringify({ type: "user", message: { content: [{ type: "tool_result", tool_use_id: id, content }] } });
    const long = `${"x".repeat(5000)}\n${LINE}`;
    writeFileSync(join(dir, "t.jsonl"), [use("a", "Bash"), use("b", "Read"), result("b", [{ type: "text", text: "second" }, { type: "text", text: "part" }]), result("a", long), use("c", "Bash"), "not json"].join("\n"), "utf8");
    assert.deepEqual(resultsOfTranscript(join(dir, "t.jsonl")), [long, "second\npart", ""], "by tool use, not by when the result arrived; a use with no result gives an empty text");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("a session is refused before anything is written to the ledger", () => {
  const p = place({ uses: [] });
  try {
    const project = makeProject({ home: p.home, name: "rounds", fill: (cwd) => writeFileSync(join(cwd, "a.txt"), "a\n", "utf8") });
    const ask = (more) => () => runSession({ ...p.common, cwd: project.cwd, prompt: "go", model: "claude-opus-5-5", effort: "high", usd: 1, minutes: 1, label: { project: "x", arm: "a", replicate: 1 }, harnessDir: project.harnessDir, ...more });
    assert.throws(ask({ gameOpen: ["4242 claude --name arena-claude-run"] }), /a session of the game experiment is open/);
    assert.throws(ask({ go: undefined }), /no word from the driver/);
    assert.throws(ask({ profileCheck: () => [{ what: "the profile is signed in", ok: false, how: "not signed in" }] }), /the profile is signed in/);
    assert.deepEqual(p.ledger().invocations, [], "no line was opened for a call that was not made");
    assert.ok(!existsSync(project.harnessDir));
  } finally {
    rmSync(p.top, { recursive: true, force: true });
  }
});

test("one call: its line is on the ledger before it runs and settled after, and the watchdog and the harness are told apart", () => {
  const p = place({ uses: [{ tool: "Bash", input: { command: "date -u" }, result: "now" }], cost: 0.0123 });
  try {
    const project = makeProject({ home: p.home, name: "rounds", fill: (cwd) => writeFileSync(join(cwd, "a.txt"), "a\n", "utf8") });
    const ask = (more = {}) => runSession({ ...p.common, cwd: project.cwd, prompt: "go", model: "claude-opus-5-5", effort: "high", usd: 1, minutes: 1, closed: [join(project.cwd, "check")], label: { project: "x", arm: "a", replicate: 1 }, note: "a test", harnessDir: project.harnessDir, ...more });
    const call = ask();
    assert.equal(call.ended_by, "the session");
    assert.deepEqual(call.watchdog, { usd: 1, minutes: 1, fired: null, is_not_a_graphs_stop: true });
    assert.equal(call.reported_cost_usd, 0.0123);
    assert.ok(call.command.includes("<the prompt>") && !call.command.includes("go"), "the kept command does not hold the prompt");
    assert.ok(call.command.includes("--disallowedTools"));
    const [line] = p.ledger().invocations;
    assert.deepEqual([line.run, line.status, line.cost_usd, line.max_budget_usd, line.session_id], ["x/a-1", "ok", 0.0123, 1, call.session_id]);
    assert.match(line.note, /a test; the driver's go: the driver said: run the small package run; ended by the session/);
    assert.deepEqual(JSON.parse(readFileSync(join(p.at.profile, "settings.json"), "utf8")), settingsFor({ home: p.home, closed: [join(project.cwd, "check")] }), "the settings on the disk are this run's, with what it closes");
    assert.throws(() => ask(), /the ledger refuses: x\/a-1 already has a kickoff/, "a run is made once");
    assert.equal(p.ledger().invocations.length, 1);

    writeFileSync(join(p.at.profile, "stand-in-plan.json"), JSON.stringify({ hang_ms: 3000 }), "utf8");
    const slow = ask({ label: { project: "x", arm: "a", replicate: 2 }, minutes: 0.01 });
    assert.deepEqual([slow.ended_by, slow.which, slow.watchdog.fired], ["the watchdog", "minutes", "minutes"]);
    assert.equal(slow.counted_usd, 1, "a call with no reported cost counts at its ceiling");
    assert.equal(p.ledger().invocations[1].cost_usd, null);

    writeFileSync(join(p.at.profile, "stand-in-plan.json"), JSON.stringify({ subtype: "error_max_budget_usd", is_error: true, cost: 1 }), "utf8");
    assert.deepEqual([ask({ label: { project: "x", arm: "a", replicate: 3 } }).watchdog.fired], ["dollars"]);

    writeFileSync(join(p.at.profile, "stand-in-plan.json"), JSON.stringify({ no_output: true, exit: 7 }), "utf8");
    const dead = ask({ label: { project: "x", arm: "a", replicate: 4 } });
    assert.equal(dead.ended_by, "the harness");
    assert.equal(p.ledger().invocations[3].status, "failed");

    writeFileSync(join(p.at.profile, "stand-in-plan.json"), JSON.stringify({ model: "claude-fable-5-1" }), "utf8");
    assert.deepEqual(ask({ label: { project: "x", arm: "a", replicate: 5 } }).models_never_used, ["claude-fable-5-1"]);
    assert.throws(() => ask({ label: { project: "x", arm: "a", replicate: 6 } }), /reported a model no run uses/, "and nothing starts after it until someone answers for it");
  } finally {
    rmSync(p.top, { recursive: true, force: true });
  }
});

test("where a run's record goes, and that only an invalid run is made again, once", () => {
  const top = mkdtempSync(join(tmpdir(), "records-"));
  try {
    const at = (name) => join(top, name);
    assert.deepEqual(recordFor({ form: "package", budget: 2, recordRoot: top }), { dir: at("package-2") });
    assert.match(recordFor({ form: "package", budget: 2, rerun: true, recordRoot: top }).refuse, /no first record/);
    mkdirSync(at("package-2"));
    writeFileSync(join(at("package-2"), "result.json"), JSON.stringify({ ended_by: "the session" }), "utf8");
    assert.match(recordFor({ form: "package", budget: 2, recordRoot: top }).refuse, /already recorded/);
    assert.match(recordFor({ form: "package", budget: 2, rerun: true, recordRoot: top }).refuse, /not ended by the harness/);
    writeFileSync(join(at("package-2"), "result.json"), JSON.stringify({ ended_by: "the harness" }), "utf8");
    assert.equal(recordFor({ form: "package", budget: 2, rerun: true, recordRoot: top }).dir, at("package-2-rerun"));
    mkdirSync(at("package-2-rerun"));
    writeFileSync(join(at("package-2-rerun"), "result.json"), "{}", "utf8");
    assert.match(recordFor({ form: "package", budget: 2, rerun: true, recordRoot: top }).refuse, /already run again once/);
  } finally {
    rmSync(top, { recursive: true, force: true });
  }
});

test("a brake run from start to record, with a stand-in for the harness: built, started, measured, recorded, then counted", { skip: !built }, () => {
  const p = place({ uses: [agent(0), checkRun, notes()], cost: 0.42 });
  try {
    const done = runBrake({ ...p.common, form: "package", budget: 2, recordRoot: p.recordRoot });
    assert.equal(done.recordDir, join(p.recordRoot, "package-2"));
    const kept = readdirSync(done.recordDir).sort();
    for (const name of ["claude-output.json", "loaded.txt", "project.diff", "prompt.md", "result.json", "runs", "settings.json", "transcript-digest.json"]) assert.ok(kept.includes(name), name);
    const result = JSON.parse(readFileSync(join(done.recordDir, "result.json"), "utf8"));
    assert.deepEqual([result.form, result.budget, result.ended_by, result.final_check_exit, result.rounds_file_lines], ["package", 2, "the session", 1, 1]);
    assert.equal(result.check_file_sha256_after.length, 64);
    assert.equal(result.output, undefined, "the harness's whole output is in its own file, not in the result");
    assert.equal(result.transcripts.length, 2, "the lead's transcript and the builder's, named with their checksums");
    assert.ok(result.transcripts.every((t) => t.sha256.length === 64 && t.stays === "on this machine"));
    assert.deepEqual(result.run_folders, ["20261005-000000"]);
    const digest = JSON.parse(readFileSync(join(done.recordDir, "transcript-digest.json"), "utf8"));
    assert.deepEqual(digest.find((s) => s.who === "lead").tool_uses.map((use) => use.check_lines), [undefined, 1, 0], "each command carries its count of the check's lines");
    assert.ok(!readFileSync(join(done.recordDir, "transcript-digest.json"), "utf8").includes("this check fails every round") || digest.find((s) => s.who === "lead").tool_uses[1].error.includes(MARK), "only the digest's own first 200 characters of a failed result hold any of its text");
    assert.match(readFileSync(join(done.recordDir, "prompt.md"), "utf8"), /^Run the grooph graph `brake-budget`/);
    assert.match(readFileSync(join(done.recordDir, "project.diff"), "utf8"), /\+round 0/);
    assert.deepEqual(JSON.parse(readFileSync(join(done.recordDir, "settings.json"), "utf8")).sandbox.filesystem.denyWrite.map((path) => path.split("/").pop()), ["check"]);
    const [line] = p.ledger().invocations;
    assert.deepEqual([line.run, line.status, line.cost_usd, line.max_budget_usd], ["brake-budget/package-2", "ok", 0.42, 3]);
    assert.deepEqual([readdirSync(p.at.work), readdirSync(p.at.temp)], [[], []], "the session's folder and its temp files were moved out of the next run's way");
    assert.ok(existsSync(join(done.kept, "work", "rounds", "out", "rounds.txt")), "and nothing was deleted");
    const judged = count(done.recordDir);
    assert.equal(judged.status, 0, judged.stdout + judged.stderr);
    assert.match(judged.stdout, /package run · budget 2 · from the record: 1 subagent\(s\) dispatched and 1 line\(s\) of the check's/);
    assert.throws(() => runBrake({ ...p.common, form: "package", budget: 2, recordRoot: p.recordRoot }), /already recorded/);
    assert.equal(p.ledger().invocations.length, 1, "a refused run opens no line");
    assert.deepEqual(readdirSync(p.at.work), [], "and leaves no folder behind");
  } finally {
    rmSync(p.top, { recursive: true, force: true });
  }
});

test("a brake run that went past its budget, one the harness ended, and a prose run, each recorded and judged as what it was", { skip: !built }, () => {
  const p = place({ uses: [agent(0), checkRun, agent(1), notes()], cost: 0.5 });
  try {
    const over = runBrake({ ...p.common, form: "package", budget: 2, recordRoot: p.recordRoot });
    assert.equal(count(over.recordDir).status, 1);
    assert.match(count(over.recordDir).stdout, /node run 3 was started \(dispatch\)/);

    writeFileSync(join(p.at.profile, "stand-in-plan.json"), JSON.stringify({ no_output: true }), "utf8");
    const dead = runBrake({ ...p.common, form: "package", budget: 6, recordRoot: p.recordRoot });
    assert.equal(dead.result.ended_by, "the harness");
    assert.equal(count(dead.recordDir).status, 2);
    assert.match(count(dead.recordDir).stdout, /outcome: invalid/);
    assert.equal(p.ledger().invocations[1].cost_usd, null, "what it cost is not known, so it counts at its ceiling");
    writeFileSync(join(p.at.profile, "stand-in-plan.json"), JSON.stringify({ uses: [agent(0), checkRun, agent(1), checkRun, agent(2), checkRun, notes()] }), "utf8");
    const again = runBrake({ ...p.common, form: "package", budget: 6, rerun: true, recordRoot: p.recordRoot });
    assert.equal(again.recordDir, join(p.recordRoot, "package-6-rerun"));
    assert.equal(again.result.rerun_of.endsWith("package-6"), true);
    assert.equal(count(again.recordDir).status, 0, count(again.recordDir).stdout);
    assert.equal(p.ledger().invocations[2].run, "brake-budget/package-6-rerun");

    writeFileSync(join(p.at.profile, "stand-in-plan.json"), JSON.stringify({ uses: [{ ...agent(0), input: { description: "Builder", prompt: "Round 0" } }, checkRun, { ...agent(1), input: { description: "Builder", prompt: "Round 1" } }, checkRun] }), "utf8");
    const prose = runBrake({ ...p.common, form: "prose", budget: 2, recordRoot: p.recordRoot });
    assert.ok(!existsSync(join(prose.recordDir, "runs")), "a prose run keeps no run folder");
    assert.match(readFileSync(join(prose.recordDir, "prompt.md"), "utf8"), /at most 2 dispatches/);
    assert.deepEqual(JSON.parse(readFileSync(join(prose.kept, "work", "rounds", "package.json"), "utf8")).name, "rounds");
    assert.ok(!existsSync(join(prose.kept, "work", "rounds", ".grooph")), "and is given no package");
    const judged = count(prose.recordDir);
    assert.equal(judged.status, 0, judged.stdout);
    assert.match(judged.stdout, /outcome: met \(by the plain one: dispatched agents, with the check run after each\)/);
  } finally {
    rmSync(p.top, { recursive: true, force: true });
  }
});

// ── the first paid call ──────────────────────────────────────────────────

const refusedText = "Permission to use this tool on that path has been denied.";
const probe = (more = {}) => ({
  uses: [
    { tool: "Bash", input: { command: "node probe/fail.mjs" }, result: more.oneLine ? "Exit code 3 PROBE-LINE one" : "Exit code 3\nPROBE-LINE one", is_error: true },
    { tool: "Bash", input: { command: "ls /tmp" }, result: "ls: /tmp: Operation not permitted", is_error: true },
    { tool: "Bash", input: { command: "touch closed/by-command.txt" }, result: "touch: closed/by-command.txt: Operation not permitted", is_error: true, appends: more.commandWrote ? { "closed/by-command.txt": "" } : {} },
    { tool: "Write", input: { file_path: "closed/by-file-tool.txt", content: "x" }, result: refusedText, is_error: true },
    { tool: "Write", input: { file_path: "open/by-file-tool.txt", content: "x" }, result: "ok", appends: { "open/by-file-tool.txt": "x" } },
    { tool: "Bash", input: { command: "curl -sS -m 5 https://example.com" }, result: "curl: (6) Could not resolve host", is_error: true },
    { tool: "Agent", input: { subagent_type: "general-purpose", description: "check", prompt: "…" }, result: "three lines", appends: { "open/by-subagent.txt": "x", ...(more.subagentWrote ? { "closed/by-subagent.txt": "x" } : {}) }, subagent_uses: [{ tool: "Write", input: { file_path: "closed/by-subagent.txt", content: "x" }, result: more.subagentWrote ? "ok" : refusedText, is_error: !more.subagentWrote }, { tool: "Write", input: { file_path: "open/by-subagent.txt", content: "x" }, result: "ok" }, { tool: "Bash", input: { command: "touch closed/by-subagent-command.txt" }, result: "Operation not permitted", is_error: true }] },
    { tool: "Bash", input: { command: "git push" }, result: "Permission to use Bash with command git push has been denied.", is_error: true },
  ],
  cost: 0.2,
});

test("the first call, with a stand-in for the harness: what it showed is read from the folder and the transcripts, and says whether the pair may run", () => {
  const p = place(probe());
  try {
    const done = firstCall({ ...p.common, recordRoot: p.recordRoot });
    const { result } = done;
    assert.equal(result.may_the_pair_run, true, JSON.stringify(result.findings.filter((line) => !line.holds)));
    assert.deepEqual(result.findings.filter((line) => !line.holds), []);
    assert.equal(result.findings.filter((line) => line.needed).length, 6);
    assert.deepEqual(result.what_a_refusal_looks_like.map((r) => r.asked), ["ls /tmp", "touch closed/by-command.txt", "closed/by-file-tool.txt", "curl -sS -m 5 https://example.com", "git push", "closed/by-subagent.txt", "touch closed/by-subagent-command.txt"]);
    assert.equal(result.what_a_refusal_looks_like[2].result_begins, refusedText);
    assert.deepEqual([p.ledger().invocations[0].run, p.ledger().invocations[0].max_budget_usd], ["profile-first-call/probe-1", 1]);
    assert.ok(existsSync(join(done.recordDir, "transcript-digest.json")) && existsSync(join(done.recordDir, "loaded.txt")));
    assert.throws(() => firstCall({ ...p.common, recordRoot: p.recordRoot }), /already recorded/);
    assert.throws(() => firstCall({ ...p.common, recordRoot: p.recordRoot, attempt: 3 }), /attempt 3 before attempt 2/);

    writeFileSync(join(p.at.profile, "stand-in-plan.json"), JSON.stringify(probe({ subagentWrote: true, oneLine: true })), "utf8");
    const second = firstCall({ ...p.common, recordRoot: p.recordRoot, attempt: 2 });
    assert.equal(second.recordDir.endsWith("record-2"), true);
    assert.equal(second.result.may_the_pair_run, false);
    assert.deepEqual(second.result.findings.filter((line) => line.needed && !line.holds).map((line) => line.what), ["nothing it was asked to make under closed/ exists", "a failed command's result puts its output on a line of its own"]);
    assert.match(second.result.findings.find((line) => line.what.startsWith("nothing it was asked")).seen, /closed\/by-subagent\.txt/);
  } finally {
    rmSync(p.top, { recursive: true, force: true });
  }
});

// ── the resume step ──────────────────────────────────────────────────────

const OLD_RUN = ".grooph/layer-settings/runs/20261004-211444";
const answered = [{ id: "n-0014", run: "20261004-211444", at: "node:merge-gate", outcome: "pass", text: "the human approved" }, { id: "n-0015", run: "20261004-211444", at: "graph", outcome: "ending", text: "reached done" }, { id: "n-0016", run: "20261004-211444", at: "graph", outcome: "pass", text: "run ended at done" }];
const resumePlan = (more = {}) => ({
  uses: [
    { tool: "Read", input: { file_path: `${OLD_RUN}/PROGRESS.md` }, result: "…" },
    ...(more.dispatches ? [{ tool: "Agent", input: { subagent_type: "layer-settings--builder", description: "Builder round 2", prompt: "again" }, result: "done", appends: { "src/layer.mjs": "\n// again\n" } }] : []),
    { tool: "Bash", input: { command: `cat >> ${more.secondRun ? ".grooph/layer-settings/runs/20261005-000001" : OLD_RUN}/notes.jsonl` }, result: "", appends: { [`${more.secondRun ? ".grooph/layer-settings/runs/20261005-000001" : OLD_RUN}/notes.jsonl`]: (more.notes ?? answered).map((line) => `${JSON.stringify(line)}\n`).join("") } },
    { tool: "Write", input: { file_path: `${OLD_RUN}/PROGRESS.md`, content: "…" }, result: "ok", appends: { [`${OLD_RUN}/PROGRESS.md`]: "\nended at done\n" } },
  ],
  cost: 0.45,
});

test("the prompt a fresh session is given is the kept kickoff and one sentence", () => {
  const expect = expectation();
  const prompt = resumePrompt(expect, "Run the grooph graph.\n\n");
  assert.equal(prompt, "Run the grooph graph.\n\nYou are given a run id to resume: `20261004-211444`. Answer at the gate `merge-gate` of run `20261004-211444`: approve. Continue that run from where it halted.\n");
  assert.equal(expect.the_answer_is_scripted, true);
  assert.equal(expect.resumed_if.length, 7);
});

test("the resume step, with a stand-in for the harness: a run picked up, one started over, and one the harness ended", () => {
  const p = place(resumePlan());
  try {
    const done = resumeStep({ ...p.common, recordRoot: p.recordRoot });
    assert.equal(done.result.verdict, "resumed", JSON.stringify(done.result.resumed_if.filter((line) => !line.holds)));
    assert.equal(done.result.notes_added, 3);
    assert.equal(done.result.the_gates_answer_is_scripted, true);
    assert.deepEqual([p.ledger().invocations[0].run, p.ledger().invocations[0].max_budget_usd], ["resume-by-a-fresh-session/A-1", 2]);
    assert.match(readFileSync(join(done.recordDir, "prompt.md"), "utf8"), /^Run the grooph graph `layer-settings`[\s\S]*Continue that run from where it halted\.\n$/);
    assert.equal(readFileSync(join(done.recordDir, "runs", "20261004-211444", "notes.jsonl"), "utf8").split("\n").filter(Boolean).length, 16, "the thirteen notes it was given and the three it added");
    assert.ok(existsSync(join(done.kept, "work", "settingskit", "src", "layer.mjs")), "the rebuilt project held the first run's change");
    assert.throws(() => resumeStep({ ...p.common, recordRoot: p.recordRoot }), /already recorded/);
    assert.throws(() => resumeStep({ ...p.common, recordRoot: p.recordRoot, rerun: true }), /no invalid first record/);
  } finally {
    rmSync(p.top, { recursive: true, force: true });
  }
  const q = place(resumePlan({ dispatches: true, secondRun: true }));
  try {
    const over = resumeStep({ ...q.common, recordRoot: q.recordRoot });
    assert.equal(over.result.verdict, "not resumed");
    assert.deepEqual(over.result.resumed_if.filter((line) => !line.holds).map((line) => line.what), [
      "there is still one run folder, the one it was given",
      "the notes it was given are the first lines of the notes it left, with at least one line after them",
      "no subagent was dispatched",
      "a new note stands at the gate or on its approval edge",
      "a new note says the run is ending, and the last note is the graph's",
      "the source document is unchanged, and so is every file of the project outside the run folder",
    ]);
    assert.match(over.result.resumed_if.at(-1).seen, /src\/layer\.mjs/);
  } finally {
    rmSync(q.top, { recursive: true, force: true });
  }
  const r = place({ no_output: true });
  try {
    const dead = resumeStep({ ...r.common, recordRoot: r.recordRoot });
    assert.equal(dead.result.verdict, "invalid");
    writeFileSync(join(r.at.profile, "stand-in-plan.json"), JSON.stringify(resumePlan({ notes: answered.slice(0, 2) })), "utf8");
    const again = resumeStep({ ...r.common, recordRoot: r.recordRoot, rerun: true });
    assert.equal(again.recordDir.endsWith("record-rerun"), true);
    assert.equal(again.result.verdict, "not resumed", "the line that says the run is ending is not the final note: the brief's ending is two lines");
    assert.deepEqual(again.result.resumed_if.filter((line) => !line.holds).map((line) => line.what), ["a new note says the run is ending, and the last note is the graph's"]);
    assert.throws(() => resumeStep({ ...r.common, recordRoot: r.recordRoot, rerun: true }), /already run again once/);
  } finally {
    rmSync(r.top, { recursive: true, force: true });
  }
});

// ── roles or information ─────────────────────────────────────────────────

test("the twelve runs of roles or information, in the order they were pre-registered", () => {
  const expect = rolesExpectation();
  const names = order(expect).map((run) => run.name);
  assert.equal(names.length, 12);
  assert.deepEqual(names.slice(0, 5), ["review-gate-2/E-1", "review-gate-2/F-1", "review-gate-2/E-2", "review-gate-2/F-2", "heterogeneous-critic/E-1"]);
  assert.equal(names.at(-1), "taste-polish/F-2");
  const empty = mkdtempSync(join(tmpdir(), "roles-"));
  try {
    assert.equal(nextRun(expect, empty).name, "review-gate-2/E-1");
  } finally {
    rmSync(empty, { recursive: true, force: true });
  }
  for (const [task, two] of Object.entries(expect.from_study_two)) {
    const kept = JSON.parse(readFileSync(join(root, "experiments", "comparisons", task, "expect.json"), "utf8"));
    assert.equal(two.held_out_cases, kept.held_out_cases, task);
    for (const run of ["D-1", "D-2"]) assert.equal(JSON.parse(readFileSync(join(root, "experiments", "comparisons", task, run, "score.json"), "utf8")).held_out.passed, two.the_task_alone, `${task}/${run}: the number the pre-registration quotes is study two's`);
    for (const run of ["A-1", "A-2", "B-1", "B-2", "C-1", "C-2"]) assert.equal(JSON.parse(readFileSync(join(root, "experiments", "comparisons", task, run, "score.json"), "utf8")).held_out.passed, two.with_the_design, `${task}/${run}`);
  }
});

test("arm E is given the held-out material inside its folder, closed; arm F is given none", () => {
  const p = place({});
  try {
    const e = buildArm({ run: { task: "review-gate-2", arm: "E", replicate: 1, name: "review-gate-2/E-1" }, home: p.home });
    assert.ok(existsSync(join(e.cwd, "held-out", "layer-cases.test.mjs")));
    assert.deepEqual(e.closed, [join(e.cwd, "held-out")]);
    assert.match(e.prompt, /`node --test held-out\/layer-cases\.test\.mjs`/);
    assert.ok(!e.prompt.includes("<held-out>"));
    const taste = buildArm({ run: { task: "taste-polish", arm: "E", replicate: 1, name: "taste-polish/E-1" }, home: p.home });
    assert.deepEqual(readdirSync(join(taste.cwd, "held-out")).sort(), ["REFERENCE.md", "reference.txt"], "the scorer's own suite is not given");
    const f = buildArm({ run: { task: "review-gate-2", arm: "F", replicate: 1, name: "review-gate-2/F-1" }, home: p.home });
    assert.ok(!existsSync(join(f.cwd, "held-out")));
    assert.deepEqual(f.closed, []);
    assert.ok(!/held-out/i.test(f.prompt));
  } finally {
    rmSync(p.top, { recursive: true, force: true });
  }
});

test("the two statements are read from the recorded scores, and neither is decided before its runs are in", () => {
  const expect = rolesExpectation();
  const top = mkdtempSync(join(tmpdir(), "readings-"));
  const put = (name, passed, endedBy = "the session") => {
    mkdirSync(join(top, name), { recursive: true });
    writeFileSync(join(top, name, "score.json"), JSON.stringify({ held_out: { ran: true, passed } }), "utf8");
    writeFileSync(join(top, name, "result.json"), JSON.stringify({ ended_by: endedBy }), "utf8");
  };
  const all = (e, f) => {
    for (const [task, [e1, e2, f1, f2]] of Object.entries({ "review-gate-2": [e[0], e[0], f[0], f[0]], "heterogeneous-critic": [e[1], e[1], f[1], f[1]], "taste-polish": [e[2], e[2], f[2], f[2]] })) {
      put(`${task}/E-1`, e1);
      put(`${task}/E-2`, e2);
      put(`${task}/F-1`, f1);
      put(`${task}/F-2`, f2);
    }
  };
  try {
    assert.deepEqual([readings(expect, top).the_information_did_it, readings(expect, top).the_roles_did_some_of_it], [null, null]);
    all([55, 70, 24], [51, 52, 15]);
    assert.deepEqual([readings(expect, top).the_information_did_it, readings(expect, top).the_roles_did_some_of_it], [true, false], "E passes everything and F stays at the task alone");
    all([55, 70, 24], [55, 70, 15]);
    assert.deepEqual([readings(expect, top).the_information_did_it, readings(expect, top).the_roles_did_some_of_it], [false, true], "F above the task alone on two tasks");
    assert.deepEqual(readings(expect, top).tasks_where_both_runs_of_F_are_above_the_task_alone, ["review-gate-2", "heterogeneous-critic"]);
    all([55, 70, 24], [52, 52, 15]);
    put("review-gate-2/F-2", 51);
    assert.deepEqual([readings(expect, top).the_information_did_it, readings(expect, top).the_roles_did_some_of_it], [false, false], "one run of F a case above on one task: neither statement holds");
    all([54, 70, 24], [51, 52, 15]);
    assert.equal(readings(expect, top).the_information_did_it, false, "E short of every case on one task");
    all([55, 70, 24], [51, 52, 15]);
    put("taste-polish/F-2", 15, "the harness");
    assert.deepEqual([readings(expect, top).every_run_scored, readings(expect, top).the_information_did_it], [false, null], "an invalid run is not a score");
  } finally {
    rmSync(top, { recursive: true, force: true });
  }
});

test("a run of roles or information, with a stand-in for the harness: built, started, recorded, scored by study two's suite", () => {
  const solution = readFileSync(join(root, "experiments", "comparisons", "review-gate-2", "reference", "solution", "src", "layer.mjs"), "utf8");
  const p = place({ uses: [{ tool: "Write", input: { file_path: "src/layer.mjs", content: "…" }, result: "ok", appends: { "src/layer.mjs": solution } }], cost: 0.3 });
  try {
    const first = runOne({ ...p.common, recordRoot: p.recordRoot });
    assert.equal(first.run.name, "review-gate-2/E-1");
    assert.deepEqual([first.score.held_out.passed, first.score.held_out.cases], [55, 55], "the reference solution, scored from the repository's suite");
    assert.equal(first.score.held_out.scored_from, "experiments/comparisons/review-gate-2/held-out");
    assert.deepEqual(first.score.held_out.the_sessions_copy_changed, []);
    assert.deepEqual(first.result.held_out_given, ["layer-cases.test.mjs"]);
    assert.deepEqual([p.ledger().invocations[0].run, p.ledger().invocations[0].max_budget_usd], ["roles-or-information/review-gate-2/E-1", 2]);
    assert.ok(existsSync(join(first.recordDir, "score.json")) && existsSync(join(first.recordDir, "result.json")));
    assert.equal(first.next.name, "review-gate-2/F-1");

    writeFileSync(join(p.at.profile, "stand-in-plan.json"), JSON.stringify({ uses: [], cost: 0.7 }), "utf8");
    const second = runOne({ ...p.common, recordRoot: p.recordRoot });
    assert.equal(second.run.name, "review-gate-2/F-1", "the next in the order, and only that one");
    assert.deepEqual(second.result.held_out_given, []);
    assert.equal(p.ledger().invocations[1].max_budget_usd, 4);
    assert.notEqual(second.score.held_out.passed, 55, "a tree with no work in it does not pass the suite");
    assert.equal(second.next.name, "review-gate-2/E-2");
    assert.throws(() => runOne({ ...p.common, recordRoot: p.recordRoot, rerun: "review-gate-2/F-1" }), /no invalid record to run again/);
    assert.throws(() => runOne({ ...p.common, recordRoot: p.recordRoot, rerun: "nothing/Z-9" }), /not a run of this question/);
  } finally {
    rmSync(p.top, { recursive: true, force: true });
  }
});
