// Tests of the paid path that spend nothing: where a session would be started, a stand-in program is, which calls no
// model (scripts/lib/fixtures/stand-in-harness.mjs). The profile, the ledger and the records are all temporary.
import assert from "node:assert/strict";
import { execFileSync, spawn, spawnSync } from "node:child_process";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { dirname, join, relative } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import { recordFor, runBrake } from "./brake-run-paid.mjs";
import { layout, settingsFor } from "./compare-profile.mjs";
import { firstCall } from "./profile-first-call-paid.mjs";
import { expectation, resumePrompt, resumeStep } from "./resume-step-paid.mjs";
import { build as buildArm, expectation as rolesExpectation, nextRun, NotScored, order, readings, runOne, scoreKept, SCORING_RUNS_WHAT_A_SESSION_WROTE } from "./roles-or-information-paid.mjs";
import { asOfToday, changeSince, copyPlain, endedBy, findHarness, firstCallAllows, firstStepsSpent, gameSessionsOpen, makeProject, NotStarted, plainLines, plainSha, refusals, resultsOfTranscript, runBounded, runSession, scrub, scrubRecord, spendFlags, writeResult } from "./study-three-paid.mjs";

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
  // The stand-in is started through a wrapper that names node whole: a session's own path is a clean one, and on a
  // machine where node is not in one of its folders (CI) the stand-in's first line would not find it.
  const harness = join(top, "stand-in-harness");
  writeFileSync(harness, `#!/bin/sh\nexec ${JSON.stringify(process.execPath)} ${JSON.stringify(STAND_IN)} "$@"\n`, { mode: 0o755 });
  // What a session is started with in a test: the stand-in, no real profile check, no game session, a short grace.
  const session = { home, claude: harness, ledgerPath, profileCheck: () => [], gameOpen: [], go: "the driver said: run the small package run", grace: 300 };
  const common = { ...session, firstCallGate: { ok: true, record: "record" } };
  return { top, home, at, harness, ledgerPath, recordRoot: join(top, "records"), session, common, ledger: () => JSON.parse(readFileSync(ledgerPath, "utf8")) };
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
  assert.equal(spendFlags(["--spend", "--go", "--budget-of-two"]).ok, false, "however long that flag is");
  assert.equal(spendFlags(["--spend", "--go", "yes"]).ok, false, "a bare yes is not a record of who said what");
  assert.equal(spendFlags([]).missing.length, 2);
});

test("what ended a run is the session, the watchdog or the harness, and only one of them", () => {
  const ok = { type: "result", subtype: "success", is_error: false };
  assert.deepEqual(endedBy({ child: { status: 0 }, output: ok }), { ended_by: "the session", which: null });
  assert.deepEqual(endedBy({ child: { timed_out: true, signal: "SIGKILL" }, output: null }), { ended_by: "the watchdog", which: "minutes" });
  assert.deepEqual(endedBy({ child: { timed_out: true, status: 0 }, output: ok }), { ended_by: "the watchdog", which: "minutes" }, "a result printed as it was being ended does not make it the session's ending");
  assert.deepEqual(endedBy({ child: { status: 1 }, output: { subtype: "error_max_budget_usd", is_error: true } }), { ended_by: "the watchdog", which: "dollars" });
  assert.equal(endedBy({ child: { status: 1 }, output: null }).ended_by, "the harness");
  assert.match(endedBy({ child: { status: 1 }, output: null }).why, /no result from the harness \(exit 1\)/);
  assert.match(endedBy({ child: { error: { code: "ENOENT", message: "spawn claude ENOENT" } }, output: null }).why, /did not start/);
  assert.equal(endedBy({ child: { signal: "SIGKILL" }, output: null }).ended_by, "the harness", "a process that died without the watchdog is the harness's");
  const stopped = endedBy({ child: { runner_stopped: "SIGTERM", signal: "SIGTERM" }, output: null });
  assert.equal(stopped.ended_by, "the harness");
  assert.match(stopped.why, /the runner itself was stopped \(SIGTERM\)/);
  const api = endedBy({ child: { status: 1 }, output: { subtype: "error_during_execution", is_error: true, api_error_status: 429 } });
  assert.equal(api.ended_by, "the harness");
  assert.match(api.why, /status 429/);
});

test("the harness is found by its whole path, or nothing is started", () => {
  const answers = (which, version = { status: 0, stdout: "2.1.289 (Claude Code)\n" }) => (program) => (program === "/bin/sh" ? which : version);
  assert.deepEqual(findHarness(answers({ status: 0, stdout: `${process.execPath}\n` })), { path: process.execPath, version: "2.1.289 (Claude Code)" });
  assert.throws(() => findHarness(answers({ status: 1, stdout: "" })), NotStarted);
  assert.throws(() => findHarness(answers({ status: 0, stdout: "claude\n" })), /was not found/, "a bare name is not a path");
  assert.throws(() => findHarness(answers({ status: 0, stdout: `${relative(process.cwd(), process.execPath)}\n` })), /was not found/, "nor is a path from this folder, though the file is there");
  assert.throws(() => findHarness(answers({ status: 1, stdout: `${process.execPath}\n` })), /was not found/, "a look that failed found nothing, whatever it printed");
  assert.throws(() => findHarness(answers({ status: 0, stdout: "/nowhere/claude\n" })), /was not found/);
  assert.throws(() => findHarness(answers({ status: 0, stdout: `${process.execPath}\n` }, { status: 1, stdout: "" })), /did not answer --version/);
  // On a machine that has the harness it is found whole; on one that has not (CI), the real look refuses.
  if (spawnSync("/bin/sh", ["-c", "command -v claude"], { encoding: "utf8" }).status === 0) {
    const real = findHarness();
    assert.ok(real.path.startsWith("/") && real.version.length > 0);
  } else assert.throws(() => findHarness(), NotStarted);
});

test("a watchdog's limit of minutes ends the whole group, a stubborn child and its own child with it", async () => {
  const dir = mkdtempSync(join(tmpdir(), "bounded-"));
  try {
    const stubborn = `process.on("SIGTERM", () => {}); const { spawn } = require("node:child_process"); const c = spawn(process.execPath, ["-e", "process.on('SIGTERM', () => {}); setInterval(() => {}, 1000)"], { stdio: "ignore" }); require("node:fs").writeFileSync(${JSON.stringify(join(dir, "pids"))}, process.pid + " " + c.pid); setInterval(() => {}, 1000);`;
    const started = Date.now();
    const child = await runBounded({ program: process.execPath, args: ["-e", stubborn], cwd: dir, env: process.env, outPath: join(dir, "out"), errPath: join(dir, "err"), ms: 400, grace: 300 });
    assert.equal(child.timed_out, true);
    assert.ok(Date.now() - started < 5000, "it did not wait for a child that ignored being asked");
    await new Promise((later) => setTimeout(later, 200));
    for (const pid of readFileSync(join(dir, "pids"), "utf8").split(" ").map(Number)) assert.throws(() => process.kill(pid, 0), /ESRCH/, `process ${pid} is gone`);
    // A session that goes when it is asked does not leave behind a child of its own that would not.
    const leaver = `const { spawn } = require("node:child_process"); const c = spawn(process.execPath, ["-e", "process.on('SIGTERM', () => {}); setInterval(() => {}, 1000)"], { stdio: "ignore" }); require("node:fs").writeFileSync(${JSON.stringify(join(dir, "left"))}, String(c.pid)); setInterval(() => {}, 1000);`;
    const left = await runBounded({ program: process.execPath, args: ["-e", leaver], cwd: dir, env: process.env, outPath: join(dir, "out"), errPath: join(dir, "err"), ms: 400, grace: 5000 });
    assert.deepEqual([left.timed_out, left.signal], [true, "SIGTERM"]);
    await new Promise((later) => setTimeout(later, 200));
    assert.throws(() => process.kill(Number(readFileSync(join(dir, "left"), "utf8")), 0), /ESRCH/, "the child it left is gone at once, not after the grace");
    // Nor does one that ended by itself, with a child of its own still running.
    const early = `const { spawn } = require("node:child_process"); const c = spawn(process.execPath, ["-e", "setInterval(() => {}, 1000)"], { stdio: "ignore" }); require("node:fs").writeFileSync(${JSON.stringify(join(dir, "after"))}, String(c.pid)); c.unref(); process.exit(0);`;
    const over = await runBounded({ program: process.execPath, args: ["-e", early], cwd: dir, env: process.env, outPath: join(dir, "out"), errPath: join(dir, "err"), ms: 5000 });
    assert.deepEqual([over.status, over.timed_out], [0, false]);
    await new Promise((later) => setTimeout(later, 200));
    assert.throws(() => process.kill(Number(readFileSync(join(dir, "after"), "utf8")), 0), /ESRCH/, "nothing of a session outlives it");
    // A program that cannot even be given its output files is a fact, not something thrown.
    const nowhere = await runBounded({ program: process.execPath, args: ["-e", "0"], cwd: dir, env: process.env, outPath: join(dir, "no-such-folder", "out"), errPath: join(dir, "err"), ms: 5000 });
    assert.equal(nowhere.error.code, "ENOENT");
    const quick = await runBounded({ program: process.execPath, args: ["-e", "console.log('done')"], cwd: dir, env: process.env, outPath: join(dir, "out"), errPath: join(dir, "err"), ms: 5000 });
    assert.deepEqual([quick.status, quick.timed_out, readFileSync(join(dir, "out"), "utf8")], [0, false, "done\n"]);
    const missing = await runBounded({ program: join(dir, "no-such-program"), args: [], cwd: dir, env: process.env, outPath: join(dir, "out"), errPath: join(dir, "err"), ms: 5000 });
    assert.equal(missing.error.code, "ENOENT");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("a runner that is itself told to stop ends its session first, and says who ended it", async () => {
  const dir = mkdtempSync(join(tmpdir(), "stopped-"));
  try {
    const pidFile = join(dir, "session.pid");
    writeFileSync(join(dir, "runner.mjs"), `import { runBounded } from ${JSON.stringify(join(here, "study-three-paid.mjs"))};
const child = await runBounded({ program: process.execPath, args: ["-e", "process.on('SIGTERM', () => {}); require('node:fs').writeFileSync(process.argv[1], String(process.pid)); setInterval(() => {}, 1000)", ${JSON.stringify(pidFile)}], cwd: ${JSON.stringify(dir)}, env: process.env, outPath: ${JSON.stringify(join(dir, "out"))}, errPath: ${JSON.stringify(join(dir, "err"))}, ms: 60000, grace: 300 });
console.log(JSON.stringify(child));
`, "utf8");
    const runner = spawn(process.execPath, [join(dir, "runner.mjs")], { stdio: ["ignore", "pipe", "inherit"] });
    let printed = "";
    runner.stdout.on("data", (chunk) => (printed += chunk));
    const ended = new Promise((done) => runner.once("exit", done));
    for (let waited = 0; !existsSync(pidFile) && waited < 5000; waited += 50) await new Promise((later) => setTimeout(later, 50));
    const session = Number(readFileSync(pidFile, "utf8"));
    runner.kill("SIGTERM");
    await ended;
    const child = JSON.parse(printed);
    assert.deepEqual([child.runner_stopped, child.timed_out], ["SIGTERM", false]);
    assert.equal(endedBy({ child, output: null }).ended_by, "the harness", "a run the runner's own stopping ended is the harness's to answer for, and may be made again once");
    await new Promise((later) => setTimeout(later, 200));
    assert.throws(() => process.kill(session, 0), /ESRCH/, "the session did not outlive its runner");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("nothing of the account's is left in a record: the home folder's path and an e-mail address are taken out", () => {
  const cleaned = scrub(`the repository as it was told: {"userEmail":"The user's email address is someone@example.com."} in /Users/someone/grooph-compare/work`, { home: "/Users/someone" });
  assert.equal(cleaned.text, `the repository as it was told: {"userEmail":"The user's email address is <an address, kept out>."} in ~/grooph-compare/work`);
  assert.deepEqual([cleaned.addresses, cleaned.home_paths], [1, 1]);
  assert.equal(scrub("Co-Authored-By: Claude <noreply@anthropic.com>; user dev@localhost", { home: "/Users/someone" }).addresses, 0, "the harness's own trailer and the neutral commit's user are nobody's");
  assert.equal(scrub("npm i left-pad@1.3.0 @scope/name@2.0.0-beta.1 next@15.0.rc2 && git clone git@github.com:a/b.git", { home: "/Users/someone" }).addresses, 0, "a package and its version is not an address");
  assert.equal(scrub("Reply-To: First.Last+tag@mail.example.co.uk, and x@y.io.", { home: "/Users/someone" }).text, "Reply-To: <an address, kept out>, and <an address, kept out>.");
  const dir = mkdtempSync(join(tmpdir(), "scrub-"));
  try {
    mkdirSync(join(dir, "runs", "r"), { recursive: true });
    writeFileSync(join(dir, "loaded.txt"), "user a.person@example.org in /Users/someone/x\n", "utf8");
    writeFileSync(join(dir, "runs", "r", "notes.jsonl"), '{"text":"wrote to b@example.org"}\n', "utf8");
    assert.deepEqual(scrubRecord(dir, { home: "/Users/someone" }), { addresses: 2, home_paths: 1 });
    assert.ok(!/@example/.test(readFileSync(join(dir, "loaded.txt"), "utf8") + readFileSync(join(dir, "runs", "r", "notes.jsonl"), "utf8")));
    assert.deepEqual(scrubRecord(dir, { home: "/Users/someone" }), { addresses: 0, home_paths: 0 }, "a second pass finds nothing");
    // A run's result is written through the same scrub, without the harness's whole output or the runner's own folder.
    const call = { session_id: "s", why: `no result from the harness in ${homedir()}/grooph-compare/work`, output: { result: "I wrote to a.person@example.org" }, harness_dir: join(dir, "harness") };
    const written = writeResult(join(dir, "result"), call, { problems: [] });
    assert.deepEqual([written.why, written.result_tail, written.output, written.harness_dir], ["no result from the harness in ~/grooph-compare/work", "I wrote to <an address, kept out>", undefined, undefined]);
    assert.deepEqual(JSON.parse(readFileSync(join(dir, "result", "result.json"), "utf8")), written);
    // Where it cannot be written, nothing is thrown: the result comes back with that said in it.
    const unwritten = writeResult(join(dir, "loaded.txt", "under-a-file"), call, { problems: ["an earlier one"] });
    assert.deepEqual([unwritten.problems.length, unwritten.problems[0]], [2, "an earlier one"]);
    assert.match(unwritten.problems[1], /result\.json could not be written/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("what a session left is read only as plain files of a sane size", () => {
  const dir = mkdtempSync(join(tmpdir(), "plain-"));
  try {
    writeFileSync(join(dir, "rounds.txt"), "round 0\n\nround 1\n", "utf8");
    assert.deepEqual(plainLines(join(dir, "rounds.txt")), { lines: 2, why: null });
    assert.deepEqual(plainLines(join(dir, "absent.txt")), { lines: 0, why: "it is not there" });
    mkdirSync(join(dir, "folder.txt"));
    assert.deepEqual(plainLines(join(dir, "folder.txt")), { lines: null, why: "it is not a plain file" }, "a folder where a file should be gives no number, and stops nothing");
    symlinkSync(join(dir, "rounds.txt"), join(dir, "link.txt"));
    assert.equal(plainLines(join(dir, "link.txt")).lines, null, "a link is not followed");
    assert.equal(plainSha(join(dir, "link.txt")), "it is not a plain file of a sane size");
    assert.equal(plainSha(join(dir, "absent.txt")), "it is not there");
    assert.equal(plainSha(join(dir, "rounds.txt")).length, 64);
    mkdirSync(join(dir, "runs", "r"), { recursive: true });
    writeFileSync(join(dir, "runs", "r", "notes.jsonl"), "{}\n", "utf8");
    symlinkSync("/etc/hosts", join(dir, "runs", "r", "hosts"));
    writeFileSync(join(dir, "runs", "r", "huge.bin"), Buffer.alloc((1 << 20) + 1));
    writeFileSync(join(dir, "runs", "r", "picture.png"), Buffer.from([0x89, 0x50, 0x4e, 0x47, 0xff, 0xfe, 0x00]));
    const left = copyPlain(join(dir, "runs"), join(dir, "copy"));
    assert.deepEqual(readdirSync(join(dir, "copy", "r")), ["notes.jsonl"]);
    assert.deepEqual(left.sort(), ["r/hosts (not a plain file)", `r/huge.bin (${(1 << 20) + 1} bytes)`, "r/picture.png (not text)"]);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("the first call's record gates everything after it: no record is a no, and so is one made with another harness or other settings", () => {
  const dir = mkdtempSync(join(tmpdir(), "gate-"));
  const today = { harness_version: "2.1.289 (Claude Code)", profile_settings_sha256: "s".repeat(64) };
  const put = (name, may, more = {}) => {
    mkdirSync(join(dir, name), { recursive: true });
    writeFileSync(join(dir, name, "result.json"), JSON.stringify({ may_the_pair_run: may, harness: { path: "/x/claude", version: today.harness_version }, profile_settings_sha256: today.profile_settings_sha256, ...more }), "utf8");
  };
  try {
    assert.match(firstCallAllows(dir, today).why, /has no record/);
    put("record", false);
    assert.match(firstCallAllows(dir, today).why, /latest record \(record\) does not say/);
    put("record-2", true);
    assert.deepEqual(firstCallAllows(dir, today), { ok: true, record: "record-2" });
    put("record-3", false);
    assert.equal(firstCallAllows(dir, today).ok, false, "the latest attempt is the one that counts");
    put("record-10", true);
    assert.deepEqual(firstCallAllows(dir, today), { ok: true, record: "record-10" }, "by its number, not by how its name sorts");
    put("record-11", undefined);
    assert.equal(firstCallAllows(dir, today).ok, false, "a record that does not say is a no");
    // What a session showed under another version of the harness, or other settings, is not known to hold now.
    put("record-12", true);
    assert.match(firstCallAllows(dir, { ...today, harness_version: "2.2.0 (Claude Code)" }).why, /another version of the harness \(2\.1\.289 \(Claude Code\), and today 2\.2\.0 \(Claude Code\)\).*made again as the next attempt/);
    assert.match(firstCallAllows(dir, { ...today, profile_settings_sha256: "t".repeat(64) }).why, /another state of the profile's settings/);
    put("record-13", true, { harness: { path: "/x/claude" } });
    assert.match(firstCallAllows(dir, today).why, /not recorded, and today 2\.1\.289/, "a record that does not say which harness made it is a no");
    put("record-14", true, { profile_settings_sha256: undefined });
    assert.equal(firstCallAllows(dir, today).ok, false);
    // Today's own facts: the settings as the repository has them, and the harness as it is found; not found is never a match.
    const real = asOfToday(() => ({ path: "/x/claude", version: "9.9.9" }));
    assert.deepEqual([real.harness_version, real.profile_settings_sha256], ["9.9.9", plainSha(join(root, "experiments", "comparisons", "profile", "settings.json"))]);
    assert.equal(asOfToday(() => findHarness(() => ({ status: 1, stdout: "" }))).harness_version, "the harness was not found");
    assert.equal(typeof firstCallAllows().ok, "boolean", "with nothing named, the repository's own record and today's own facts are the ones read");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("an open session of the game experiment is seen, and stops everything", () => {
  const others = "  1 /sbin/launchd\n 77 node scripts/lib/brake-run-paid.mjs --form package\n";
  assert.deepEqual(gameSessionsOpen(() => ({ status: 0, stdout: others })), [], "a list of processes with no game session among them");
  assert.deepEqual(gameSessionsOpen(() => ({ status: 0, stdout: `${others}4242 claude --model claude-opus-5-5 --name arena-claude-run\n 4300 codex --name arena-codex-rehearsal\n` })), ["4242 claude --model claude-opus-5-5 --name arena-claude-run", "4300 codex --name arena-codex-rehearsal"]);
  assert.throws(() => gameSessionsOpen(() => ({ status: 1, stdout: "" })), /the process list could not be read \(ps exited 1/, "a look that failed is not a look that found nothing");
  assert.throws(() => gameSessionsOpen(() => ({ status: 0, stdout: "" })), /printed 0 line\(s\)/, "nor is a list with no process in it");
  assert.throws(() => gameSessionsOpen(() => ({ status: null, stdout: "", error: new Error("spawn ps ENOENT") })), /spawn ps ENOENT/);
  assert.throws(() => gameSessionsOpen(() => ({ status: 1, stdout: others })), /ps exited 1/, "a list from a ps that failed is not a whole list");
  assert.throws(() => gameSessionsOpen(() => ({ status: 0, stdout: others, error: new Error("the list was cut short") })), /the list was cut short/);
  assert.throws(() => gameSessionsOpen(() => ({ status: 2, stdout: "" })), NotStarted, "and it is a refusal before any call");
  assert.ok(Array.isArray(gameSessionsOpen()), "the real process list can be read on this machine");
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

const aProject = (p) => makeProject({ home: p.home, name: "rounds", fill: (cwd) => writeFileSync(join(cwd, "a.txt"), "a\n", "utf8") });
const notStarted = (pattern) => (error) => error instanceof NotStarted && pattern.test(error.message);

test("a session is refused before anything is written anywhere, and each refusal says nothing was started", async () => {
  const p = place({ uses: [] });
  try {
    const project = aProject(p);
    const ask = (more) => runSession({ ...p.session, cwd: project.cwd, prompt: "go", model: "claude-opus-5-5", effort: "high", usd: 1, minutes: 1, label: { project: "x", arm: "a", replicate: 1 }, harnessDir: project.harnessDir, ...more });
    await assert.rejects(ask({ gameOpen: ["4242 claude --name arena-claude-run"] }), notStarted(/a session of the game experiment is open/));
    await assert.rejects(ask({ go: undefined }), notStarted(/no word from the driver/));
    await assert.rejects(ask({ profileCheck: () => [{ what: "the profile is signed in", ok: false, how: "not signed in" }] }), notStarted(/the profile is signed in/));
    // No path of the harness given, and none found: the runner looks for it itself, and refuses when it is not there.
    await assert.rejects(ask({ claude: undefined, findProgram: () => findHarness(() => ({ status: 1, stdout: "" })) }), notStarted(/the harness was not found/));
    await assert.rejects(ask({ model: "claude-fable-5-1" }), notStarted(/a model this project never uses/));
    await assert.rejects(ask({ closed: [join(p.top, "elsewhere")] }), notStarted(/a closed path must be inside the session's folder/));
    await assert.rejects(ask({ plan: { projects: ["x"], stop_usd: 0.5 } }), notStarted(/may cost up to \$1\.00: together past the \$0\.50 at which they stop/));
    mkdirSync(join(p.at.work, "an-earlier-session"));
    await assert.rejects(ask({}), notStarted(/holds more than this session's folder \(an-earlier-session\)/));
    assert.throws(() => makeProject({ home: p.home, name: "another", fill: () => {} }), notStarted(/work folder is not empty/), "and no second folder is made beside one that is still there");
    assert.deepEqual(p.ledger().invocations, [], "no line was opened for a call that was not made");
    assert.ok(!existsSync(project.harnessDir));
    assert.ok(!existsSync(join(p.at.profile, "settings.json")), "and the profile's settings were not written");
    assert.ok(existsSync(join(project.cwd, "a.txt")), "runSession itself removes nothing");
  } finally {
    rmSync(p.top, { recursive: true, force: true });
  }
});

test("a failure after the settings are written and before the call puts them back, and nothing was started", { skip: process.getuid?.() === 0 }, async () => {
  const p = place({ uses: [] });
  try {
    const project = aProject(p);
    const base = `${JSON.stringify(settingsFor({ home: p.home }), null, 2)}\n`;
    writeFileSync(join(p.at.profile, "settings.json"), base, "utf8");
    // The ledger can be read and its folder cannot be written: the new line cannot be saved, after the run's settings were.
    chmodSync(p.top, 0o555);
    try {
      await assert.rejects(runSession({ ...p.session, cwd: project.cwd, prompt: "go", model: "claude-opus-5-5", effort: "high", usd: 1, minutes: 1, closed: [join(project.cwd, "check")], label: { project: "x", arm: "a", replicate: 1 }, harnessDir: project.harnessDir }), (error) => error instanceof NotStarted);
    } finally {
      chmodSync(p.top, 0o755);
    }
    assert.equal(readFileSync(join(p.at.profile, "settings.json"), "utf8"), base, "the settings are the repository's again, not the run's");
    assert.deepEqual(p.ledger().invocations, []);
    assert.ok(!existsSync(join(p.at.profile, "settings-seen-by-the-stand-in.json")), "and the harness was never started");
  } finally {
    rmSync(p.top, { recursive: true, force: true });
  }
});

test("the project's change is read through the runner's own copy of the repository, never through the session's", () => {
  const p = place({});
  try {
    const project = aProject(p);
    assert.ok(existsSync(join(project.gitDir, "HEAD")) && project.gitDir.startsWith(`${project.work}/`) && !project.gitDir.startsWith(`${project.cwd}/`), "the copy is beside the session's folder, not in it");
    // What a session could do: change a file, add one, and set its own repository to run a program of its choosing.
    const ran = join(p.top, "ran-by-git.txt");
    writeFileSync(join(project.cwd, "a.txt"), "a\nb\n", "utf8");
    writeFileSync(join(project.cwd, "new.txt"), "n\n", "utf8");
    writeFileSync(join(project.cwd, ".gitattributes"), "*.txt filter=own\n", "utf8");
    execFileSync("git", ["-C", project.cwd, "config", "filter.own.clean", `sh -c 'touch "${ran}"; cat'`]);
    const change = changeSince({ cwd: project.cwd, base: project.base, gitDir: project.gitDir });
    assert.deepEqual(change.files.sort(), ["A .gitattributes", "A new.txt", "M a.txt"]);
    assert.match(change.diff, /^\+b$/m);
    assert.ok(!existsSync(ran), "nothing the session configured was run");
    assert.deepEqual(changeSince({ cwd: project.cwd, base: project.base, gitDir: project.gitDir, excludes: ["new.txt", ".gitattributes"] }).files, ["M a.txt"]);
    // So that this test can tell: the same change read through the session's own repository does run it.
    execFileSync("git", ["-C", project.cwd, "add", "-A"]);
    assert.ok(existsSync(ran));
    // And a session that took its repository away altogether changes nothing about what is read.
    rmSync(join(project.cwd, ".git"), { recursive: true, force: true });
    assert.deepEqual(changeSince({ cwd: project.cwd, base: project.base, gitDir: project.gitDir }).files.sort(), ["A .gitattributes", "A new.txt", "M a.txt"]);
  } finally {
    rmSync(p.top, { recursive: true, force: true });
  }
});

test("the harness is looked for when no path is given, and a session starts with the path that was found", async () => {
  const p = place({ uses: [], cost: 0.01 });
  try {
    const project = aProject(p);
    const call = await runSession({ ...p.session, claude: undefined, findProgram: () => ({ path: p.harness, version: "0.0.0 (stand-in harness)" }), cwd: project.cwd, prompt: "go", model: "claude-opus-5-5", effort: "high", usd: 20, minutes: 1, label: { project: "x", arm: "a", replicate: 1 }, harnessDir: project.harnessDir });
    assert.equal(call.ended_by, "the session");
    assert.equal(call.watchdog.usd, 9, "no call is given more than the ledger's ceiling for one invocation, whatever its runner asks");
    assert.equal(call.command[call.command.indexOf("--max-budget-usd") + 1], "9");
    assert.deepEqual(call.harness, { path: p.harness, version: "0.0.0 (stand-in harness)" });
    assert.equal(call.command[0], p.harness);
  } finally {
    rmSync(p.top, { recursive: true, force: true });
  }
});

test("what the first steps have cost is counted from the ledger, a call with no known cost at its ceiling", () => {
  const plan = { projects: ["brake-budget", "roles-or-information"], stop_usd: 20 };
  const ledger = { invocations: [{ project: "brake-budget", status: "ok", cost_usd: 0.5, max_budget_usd: 3 }, { project: "brake-budget", status: "failed", cost_usd: null, max_budget_usd: 3 }, { project: "roles-or-information/review-gate-2", status: "ok", cost_usd: 1.25, max_budget_usd: 2 }, { project: "review-gate-2", status: "ok", cost_usd: 7, max_budget_usd: 9 }, { project: "brake-budget-two", status: "ok", cost_usd: 5, max_budget_usd: 9 }] };
  assert.equal(firstStepsSpent(ledger, plan), 4.75, "its own projects and those under them; study two's lines and a project that only begins the same way are not its");
  const kept = JSON.parse(readFileSync(join(root, "experiments", "comparisons", "study-three-first-steps.json"), "utf8"));
  assert.deepEqual(kept.projects, ["profile-first-call", "brake-budget", "resume-by-a-fresh-session", "roles-or-information"]);
  assert.equal(kept.stop_usd, 20);
});

test("one call: its line is on the ledger before it runs and settled after; the settings are the run's while it runs and the repository's after", async () => {
  const p = place({ uses: [{ tool: "Bash", input: { command: "date -u" }, result: "now" }], cost: 0.0123 });
  try {
    const project = aProject(p);
    const closed = [join(project.cwd, "check")];
    const plan = (next) => writeFileSync(join(p.at.profile, "stand-in-plan.json"), JSON.stringify(next), "utf8");
    const ask = (more = {}) => runSession({ ...p.session, cwd: project.cwd, prompt: "go", model: "claude-opus-5-5", effort: "high", usd: 1, minutes: 1, closed, label: { project: "x", arm: "a", replicate: 1 }, note: "a test", harnessDir: project.harnessDir, ...more });
    const call = await ask();
    assert.equal(call.ended_by, "the session");
    assert.deepEqual(call.watchdog, { usd: 1, minutes: 1, fired: null, is_not_a_graphs_stop: true });
    assert.equal(call.reported_cost_usd, 0.0123);
    assert.deepEqual(call.problems_after_the_call, []);
    assert.ok(call.command.includes("<the prompt>") && !call.command.includes("go"), "the kept command does not hold the prompt");
    assert.ok(call.command.includes("--disallowedTools"));
    const [line] = p.ledger().invocations;
    assert.deepEqual([line.run, line.status, line.cost_usd, line.max_budget_usd, line.session_id], ["x/a-1", "ok", 0.0123, 1, call.session_id]);
    assert.match(line.note, /a test; the driver's go: the driver said: run the small package run; ended by the session/);
    const forTheRun = settingsFor({ home: p.home, closed });
    assert.deepEqual(forTheRun.sandbox.filesystem.denyWrite, closed);
    assert.deepEqual(JSON.parse(readFileSync(join(p.at.profile, "settings-seen-by-the-stand-in.json"), "utf8")), forTheRun, "while the session ran, the settings on the disk were this run's, with what it closes");
    assert.deepEqual(JSON.parse(readFileSync(join(project.harnessDir, "settings.json"), "utf8")), forTheRun, "and that is the copy the record keeps");
    assert.equal(readFileSync(join(p.at.profile, "settings.json"), "utf8"), `${JSON.stringify(settingsFor({ home: p.home }), null, 2)}\n`, "after it, they are the repository's again, so the next check of the profile finds them clean");
    await assert.rejects(ask(), notStarted(/the ledger refuses: x\/a-1 already has a kickoff/), "a run is made once");
    assert.equal(p.ledger().invocations.length, 1);

    plan({ hang_ms: 4000 });
    const slow = await ask({ label: { project: "x", arm: "a", replicate: 2 }, minutes: 0.01 });
    assert.deepEqual([slow.ended_by, slow.which, slow.watchdog.fired], ["the watchdog", "minutes", "minutes"]);
    assert.equal(slow.counted_usd, 1, "a call with no reported cost counts at its ceiling");
    assert.equal(p.ledger().invocations[1].cost_usd, null);
    assert.equal(readFileSync(join(p.at.profile, "settings.json"), "utf8"), `${JSON.stringify(settingsFor({ home: p.home }), null, 2)}\n`, "the settings go back after a run the watchdog ended too");

    plan({ subtype: "error_max_budget_usd", is_error: true, cost: 1 });
    assert.deepEqual([(await ask({ label: { project: "x", arm: "a", replicate: 3 } })).watchdog.fired], ["dollars"]);

    plan({ no_output: true, exit: 7 });
    const dead = await ask({ label: { project: "x", arm: "a", replicate: 4 } });
    assert.equal(dead.ended_by, "the harness");
    assert.deepEqual([p.ledger().invocations[3].status, p.ledger().invocations[3].cost_usd, dead.counted_usd], ["failed", null, 1], "a harness that started and said nothing counts at its ceiling");

    // What was printed can be read and is not a result: a list, a number, a sentence. It is no result at all.
    plan({ raw_output: '[{"type":"result","is_error":false}]' });
    const odd = await ask({ label: { project: "x", arm: "a", replicate: "4b" } });
    assert.deepEqual([odd.ended_by, odd.output, odd.counted_usd, p.ledger().invocations.at(-1).status], ["the harness", null, 1, "failed"]);

    const absent = await ask({ label: { project: "x", arm: "a", replicate: 5 }, claude: join(p.top, "no-such-harness") });
    assert.equal(absent.ended_by, "the harness");
    assert.match(absent.why, /the harness did not start/);
    assert.deepEqual([p.ledger().invocations.at(-1).status, p.ledger().invocations.at(-1).cost_usd, absent.counted_usd], ["failed", 0, 0], "a harness that could not be started spent nothing");
    assert.match(p.ledger().invocations.at(-1).note, /nothing was spent/);

    // A session whose own child ignores being asked to end: the minute limit ends the whole group, and kills what is left.
    plan({ children: true, hang_ms: 20000 });
    const began = Date.now();
    const stubborn = await ask({ label: { project: "x", arm: "a", replicate: 6 }, minutes: 0.02 });
    assert.deepEqual([stubborn.ended_by, stubborn.which], ["the watchdog", "minutes"]);
    assert.ok(Date.now() - began < 8000, "it did not wait out a process that would not go");
    await new Promise((later) => setTimeout(later, 200));
    assert.throws(() => process.kill(Number(readFileSync(join(p.at.profile, "child.pid"), "utf8")), 0), /ESRCH/, "the session's own child is gone with it");

    plan({ model: "claude-fable-5-1" });
    assert.deepEqual((await ask({ label: { project: "x", arm: "a", replicate: 7 } })).models_never_used, ["claude-fable-5-1"]);
    await assert.rejects(ask({ label: { project: "x", arm: "a", replicate: 8 } }), notStarted(/reported a model no run uses/), "and nothing starts after it until someone answers for it");
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

test("nothing after the first call starts until its record says it may: each runner refuses, and makes no folder", async () => {
  const p = place({ uses: [] });
  const no = { ok: false, why: "the first paid call has no record: it is made first" };
  try {
    await assert.rejects(runBrake({ ...p.common, firstCallGate: no, form: "package", budget: 2, recordRoot: p.recordRoot }), notStarted(/the first paid call has no record/));
    await assert.rejects(resumeStep({ ...p.common, firstCallGate: no, recordRoot: p.recordRoot }), notStarted(/the first paid call has no record/));
    await assert.rejects(runOne({ ...p.common, firstCallGate: no, recordRoot: p.recordRoot }), notStarted(/the first paid call has no record/));
    // With nothing injected, each reads the repository's own record of the first call. Until that record says yes
    // (there is none before the call is made), each refuses by it; this part says nothing once it does.
    if (!firstCallAllows().ok) {
      await assert.rejects(runBrake({ ...p.session, form: "package", budget: 2, recordRoot: p.recordRoot }), notStarted(/the first paid call/));
      await assert.rejects(resumeStep({ ...p.session, recordRoot: p.recordRoot }), notStarted(/the first paid call/));
      await assert.rejects(runOne({ ...p.session, recordRoot: p.recordRoot }), notStarted(/the first paid call/));
    }
    assert.deepEqual([readdirSync(p.at.work), p.ledger().invocations, existsSync(p.recordRoot)], [[], [], false]);
    // Allowed by the first call and refused at the gates, after its folder was made: each takes its folder away again.
    const open = ["4242 claude --name arena-claude-run"];
    const refused = notStarted(/a session of the game experiment is open/);
    if (built) await assert.rejects(runBrake({ ...p.common, gameOpen: open, form: "package", budget: 2, recordRoot: p.recordRoot }), refused);
    assert.deepEqual(readdirSync(p.at.work), []);
    await assert.rejects(resumeStep({ ...p.common, gameOpen: open, recordRoot: p.recordRoot }), refused);
    assert.deepEqual(readdirSync(p.at.work), []);
    await assert.rejects(runOne({ ...p.common, gameOpen: open, recordRoot: p.recordRoot }), refused);
    assert.deepEqual([readdirSync(p.at.work), p.ledger().invocations, existsSync(p.recordRoot)], [[], [], false]);
  } finally {
    rmSync(p.top, { recursive: true, force: true });
  }
});

test("a brake run from start to record, with a stand-in for the harness: built, started, recorded, measured, then counted", { skip: !built }, async () => {
  const p = place({ uses: [agent(0), checkRun, notes()], cost: 0.42 });
  try {
    const done = await runBrake({ ...p.common, form: "package", budget: 2, recordRoot: p.recordRoot });
    assert.equal(done.recordDir, join(p.recordRoot, "package-2"));
    const kept = readdirSync(done.recordDir).sort();
    for (const name of ["claude-output.json", "loaded.txt", "project.diff", "prompt.md", "result.json", "runs", "settings.json", "transcript-digest.json"]) assert.ok(kept.includes(name), name);
    const result = JSON.parse(readFileSync(join(done.recordDir, "result.json"), "utf8"));
    assert.deepEqual([result.form, result.budget, result.ended_by, result.final_check_exit, result.rounds_file_lines], ["package", 2, "the session", 1, 1]);
    assert.equal(result.check_file_sha256_after.length, 64);
    assert.deepEqual(result.problems, []);
    assert.equal(result.output, undefined, "the harness's whole output is in its own file, not in the result");
    assert.equal(result.transcripts.length, 2, "the lead's transcript and the builder's, named with their checksums");
    assert.ok(result.transcripts.every((t) => t.sha256.length === 64 && t.stays === "on this machine"));
    assert.deepEqual(result.run_folders, ["20261005-000000"]);
    // The stand-in told the session an address, as the harness does; none is left in the record.
    const loaded = readFileSync(join(done.recordDir, "loaded.txt"), "utf8");
    assert.match(loaded, /The user's email address is <an address, kept out>/);
    assert.equal(result.kept_out_of_the_record.addresses, 1);
    for (const name of kept.filter((entry) => entry !== "runs")) assert.ok(!readFileSync(join(done.recordDir, name), "utf8").includes("@example.com"), `${name} holds no address`);
    const digest = JSON.parse(readFileSync(join(done.recordDir, "transcript-digest.json"), "utf8"));
    assert.deepEqual(digest.find((s) => s.who === "lead").tool_uses.map((use) => use.check_lines), [undefined, 1, 0], "each command carries its count of the check's lines");
    assert.match(readFileSync(join(done.recordDir, "prompt.md"), "utf8"), /^Run the grooph graph `brake-budget`/);
    assert.match(readFileSync(join(done.recordDir, "project.diff"), "utf8"), /\+round 0/);
    assert.deepEqual(JSON.parse(readFileSync(join(done.recordDir, "settings.json"), "utf8")).sandbox.filesystem.denyWrite.map((path) => path.split("/").pop()), ["check"]);
    assert.deepEqual(JSON.parse(readFileSync(join(p.at.profile, "settings.json"), "utf8")).sandbox.filesystem.denyWrite, [], "the profile itself closes nothing of a run's once the run is over");
    const [line] = p.ledger().invocations;
    assert.deepEqual([line.run, line.status, line.cost_usd, line.max_budget_usd], ["brake-budget/package-2", "ok", 0.42, 3]);
    assert.deepEqual([readdirSync(p.at.work), readdirSync(p.at.temp)], [[], []], "the session's folder and its temp files were moved out of the next run's way");
    assert.ok(existsSync(join(done.kept, "work", "rounds", "out", "rounds.txt")), "and nothing was deleted");
    assert.deepEqual(readdirSync(join(done.kept, "t")), [`left-by-${result.session_id}.tmp`], "what it left in the temp folder is beside it");
    const judged = count(done.recordDir);
    assert.equal(judged.status, 0, judged.stdout + judged.stderr);
    assert.match(judged.stdout, /package run · budget 2 · from the record: 1 subagent\(s\) dispatched and 1 line\(s\) of the check's/);
    await assert.rejects(runBrake({ ...p.common, form: "package", budget: 2, recordRoot: p.recordRoot }), notStarted(/already recorded/));
    assert.equal(p.ledger().invocations.length, 1, "a refused run opens no line");
    assert.deepEqual(readdirSync(p.at.work), [], "and leaves no folder behind");
  } finally {
    rmSync(p.top, { recursive: true, force: true });
  }
});

test("a brake run that went past its budget, one the harness ended, and a prose run, each recorded and judged as what it was", { skip: !built }, async () => {
  const p = place({ uses: [agent(0), checkRun, agent(1), notes()], cost: 0.5 });
  try {
    const over = await runBrake({ ...p.common, form: "package", budget: 2, recordRoot: p.recordRoot });
    assert.equal(count(over.recordDir).status, 1);
    assert.match(count(over.recordDir).stdout, /node run 3 was started \(dispatch\)/);

    writeFileSync(join(p.at.profile, "stand-in-plan.json"), JSON.stringify({ no_output: true }), "utf8");
    const dead = await runBrake({ ...p.common, form: "package", budget: 6, recordRoot: p.recordRoot });
    assert.equal(dead.result.ended_by, "the harness");
    assert.equal(count(dead.recordDir).status, 2);
    assert.match(count(dead.recordDir).stdout, /outcome: invalid/);
    assert.equal(p.ledger().invocations[1].cost_usd, null, "what it cost is not known, so it counts at its ceiling");
    writeFileSync(join(p.at.profile, "stand-in-plan.json"), JSON.stringify({ uses: [agent(0), checkRun, agent(1), checkRun, agent(2), checkRun, notes()] }), "utf8");
    const again = await runBrake({ ...p.common, form: "package", budget: 6, rerun: true, recordRoot: p.recordRoot });
    assert.equal(again.recordDir, join(p.recordRoot, "package-6-rerun"));
    assert.equal(again.result.rerun_of.endsWith("package-6"), true);
    assert.equal(count(again.recordDir).status, 0, count(again.recordDir).stdout);
    assert.equal(p.ledger().invocations[2].run, "brake-budget/package-6-rerun");

    writeFileSync(join(p.at.profile, "stand-in-plan.json"), JSON.stringify({ uses: [{ ...agent(0), input: { description: "Builder", prompt: "Round 0" } }, checkRun, { ...agent(1), input: { description: "Builder", prompt: "Round 1" } }, checkRun] }), "utf8");
    const prose = await runBrake({ ...p.common, form: "prose", budget: 2, recordRoot: p.recordRoot });
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

test("whatever a session left, its record is kept: a check it replaced is not run, a folder where a file was stops nothing, and nothing is removed after a call", { skip: !built }, async () => {
  // The session put a program of its own where the check was, and a folder where the builder's trace was.
  const trap = "import { writeFileSync } from 'node:fs';\nwriteFileSync(new URL('../executed-by-the-runner.txt', import.meta.url), 'x');\nprocess.exit(0);\n";
  const p = place({ uses: [agent(0), { tool: "Bash", input: { command: "true" }, result: "", writes: { "check/fixed-fail.mjs": trap }, mkdirs: ["out/rounds.txt"] }], cost: 0.3 });
  try {
    const done = await runBrake({ ...p.common, form: "prose", budget: 2, recordRoot: p.recordRoot });
    const there = join(done.kept, "work", "rounds");
    assert.equal(readFileSync(join(there, "check", "fixed-fail.mjs"), "utf8"), trap, "the session's file is kept as it left it");
    assert.ok(!existsSync(join(there, "executed-by-the-runner.txt")), "and was never run by the runner");
    assert.equal(done.result.final_check_exit, 1, "the check that was run is the repository's own");
    assert.match(done.result.final_check_is, /the repository's own check/);
    assert.equal(done.result.check_file_sha256_after.length, 64);
    assert.deepEqual([done.result.rounds_file_lines, done.result.rounds_file], [null, "it is not a plain file"]);
    assert.ok(existsSync(join(done.recordDir, "transcript-digest.json")) && existsSync(join(done.recordDir, "project.diff")));
    const judged = count(done.recordDir);
    assert.equal(judged.status, 2, judged.stdout);
    assert.match(judged.stdout, /outcome: not judged\n {2}- result\.json holds no rounds_file_lines/, "a trace that cannot be read is not judged, and is not a pass");

    // The check replaced and nothing else amiss: the judge reads the checksum, and the run does not pass.
    writeFileSync(join(p.at.profile, "stand-in-plan.json"), JSON.stringify({ uses: [agent(0), checkRun, { tool: "Bash", input: { command: "true" }, result: "", writes: { "check/fixed-fail.mjs": trap } }, agent(1), checkRun, notes()] }), "utf8");
    const swapped = await runBrake({ ...p.common, form: "package", budget: 6, recordRoot: p.recordRoot });
    assert.ok(!existsSync(join(swapped.kept, "work", "rounds", "executed-by-the-runner.txt")));
    assert.notEqual(count(swapped.recordDir).status, 0);
    assert.match(count(swapped.recordDir).stdout, /the check's file was changed during the run/);

    // The ledger is gone by the time the call ends (here a folder stands where it was): the line cannot be settled.
    // Nothing is thrown, the record is kept with what went wrong in it, and the session's folder is moved aside, not removed.
    writeFileSync(join(p.at.profile, "stand-in-plan.json"), JSON.stringify({ uses: [agent(0), checkRun, agent(1), checkRun], mkdirs: [p.ledgerPath] }), "utf8");
    const lost = await runBrake({ ...p.common, form: "prose", budget: 6, recordRoot: p.recordRoot });
    assert.ok(lost.result.problems.some((line) => /the ledger line could not be settled/.test(line)), JSON.stringify(lost.result.problems));
    assert.equal(lost.result.ended_by, "the session");
    assert.ok(existsSync(join(lost.recordDir, "result.json")) && existsSync(join(lost.recordDir, "transcript-digest.json")));
    assert.ok(existsSync(join(lost.kept, "work", "rounds", "out", "rounds.txt")), "what the session made is still on the disk");
    assert.equal(lost.result.rounds_file_lines, 2);
    // And while the ledger cannot be read, nothing else starts: a refusal before any call, with no folder left behind.
    await assert.rejects(runBrake({ ...p.common, form: "prose", budget: 6, rerun: true, recordRoot: p.recordRoot }), (error) => error instanceof NotStarted);
    await assert.rejects(runBrake({ ...p.common, form: "package", budget: 2, recordRoot: p.recordRoot }), (error) => error instanceof NotStarted);
    assert.deepEqual(readdirSync(p.at.work), []);
    assert.equal(readFileSync(join(p.at.profile, "settings.json"), "utf8"), `${JSON.stringify(settingsFor({ home: p.home }), null, 2)}\n`, "and the profile's settings are the repository's");
  } finally {
    rmSync(p.top, { recursive: true, force: true });
  }
});

// ── the first paid call ──────────────────────────────────────────────────

const refusedText = "Permission to use this tool on that path has been denied.";
const probe = (more = {}) => ({
  uses: [
    { tool: "Bash", input: { command: "node probe/fail.mjs" }, result: more.oneLine ? "Exit code 3 PROBE-LINE one" : "Exit code 3\nPROBE-LINE one", is_error: true, ...(more.keepChanged ? { writes: { "closed/keep.txt": "changed\n" } } : {}) },
    more.tmpListed ? { tool: "Bash", input: { command: "ls /tmp" }, result: "a-file-of-the-accounts.txt" } : { tool: "Bash", input: { command: "ls /tmp" }, result: "ls: /tmp: Operation not permitted", is_error: true },
    { tool: "Bash", input: { command: "touch closed/by-command.txt" }, result: "touch: closed/by-command.txt: Operation not permitted", is_error: true },
    { tool: "Write", input: { file_path: "closed/by-file-tool.txt", content: "x" }, result: refusedText, is_error: true },
    { tool: "Write", input: { file_path: "open/by-file-tool.txt", content: "x" }, result: "ok", appends: { "open/by-file-tool.txt": "x" } },
    { tool: "Bash", input: { command: "curl -sS -m 5 https://example.com" }, result: "curl: (6) Could not resolve host", is_error: true },
    { tool: "Agent", input: { subagent_type: "general-purpose", description: "check", prompt: "…" }, result: "three lines", appends: { "open/by-subagent.txt": "x", ...(more.subagentWrote ? { "closed/by-subagent.txt": "x" } : {}) }, subagent_uses: [{ tool: "Write", input: { file_path: "closed/by-subagent.txt", content: "x" }, result: more.subagentWrote ? "ok" : refusedText, is_error: !more.subagentWrote }, { tool: "Write", input: { file_path: "open/by-subagent.txt", content: "x" }, result: "ok" }, { tool: "Bash", input: { command: "touch closed/by-subagent-command.txt" }, result: "Operation not permitted", is_error: true }] },
    { tool: "Bash", input: { command: "git push" }, result: "Permission to use Bash with command git push has been denied.", is_error: true },
    ...(more.withoutOneStep ? [] : [{ tool: "Bash", input: { command: "ls ../.." }, result: "ls: ../..: Operation not permitted", is_error: true }]),
    { tool: "Bash", input: { command: "node --test probe/pass.test.mjs" }, result: "✔ one and one are two\nℹ pass 1" },
    more.npmFails ? { tool: "Bash", input: { command: "npm test" }, result: "Exit code 1\nnpm error code EPERM\nnpm error syscall open", is_error: true } : { tool: "Bash", input: { command: "npm test" }, result: "> probe@0.0.0 test\n> node --test probe/pass.test.mjs\n\n✔ one and one are two" },
    more.wroteBeside ? { tool: "Bash", input: { command: "touch ../by-command.txt" }, result: "", appends: { "../by-command.txt": "" } } : { tool: "Bash", input: { command: "touch ../by-command.txt" }, result: "touch: ../by-command.txt: Operation not permitted", is_error: true },
    ...(more.withoutTheWriteBeside ? [] : [{ tool: "Write", input: { file_path: "../by-file-tool.txt", content: "x" }, result: refusedText, is_error: true, ...(more.madeBesideAnyway ? { appends: { "../by-file-tool.txt": "x" } } : {}) }]),
    ...(more.twoSubagents ? [{ tool: "Agent", input: { subagent_type: "general-purpose", description: "another", prompt: "…" }, result: "done" }] : []),
  ],
  cost: 0.2,
  ...(more.plan ?? {}),
});
const failing = (result) => result.findings.filter((line) => !line.holds).map((line) => line.what);

test("the first call, with a stand-in for the harness: what it showed is read from the folder and the transcripts, and says whether anything after it may run", async () => {
  const p = place(probe());
  const plan = (next) => writeFileSync(join(p.at.profile, "stand-in-plan.json"), JSON.stringify(next), "utf8");
  try {
    // The stand-in is started by its path, so its records name no version; they are held against that and today's settings.
    const today = { ...asOfToday(), harness_version: null };
    assert.equal(firstCallAllows(p.recordRoot, today).ok, false);
    const done = await firstCall({ ...p.session, recordRoot: p.recordRoot });
    const { result } = done;
    assert.deepEqual(failing(result), []);
    assert.equal(result.may_the_pair_run, true);
    assert.equal(result.findings.length, 14, "fourteen lines, and every one of them has to hold");
    assert.deepEqual(result.what_a_refusal_looks_like.map((r) => r.asked), ["ls /tmp", "touch closed/by-command.txt", "closed/by-file-tool.txt", "curl -sS -m 5 https://example.com", "git push", "ls ../..", "touch ../by-command.txt", "../by-file-tool.txt", "closed/by-subagent.txt", "touch closed/by-subagent-command.txt"]);
    assert.equal(result.what_a_refusal_looks_like[2].result_begins, refusedText);
    assert.deepEqual([p.ledger().invocations[0].run, p.ledger().invocations[0].max_budget_usd], ["profile-first-call/probe-1", 1]);
    assert.ok(existsSync(join(done.recordDir, "transcript-digest.json")));
    assert.ok(!/@example\.com/.test(readFileSync(join(done.recordDir, "loaded.txt"), "utf8")), "what the session was told of the account is not in the record");
    assert.deepEqual(firstCallAllows(p.recordRoot, today), { ok: true, record: "record" }, "and now the runs after it may be made");
    assert.equal(firstCallAllows(p.recordRoot).ok, false, "but not by today's real harness, which is not the one that made this record");
    await assert.rejects(firstCall({ ...p.session, recordRoot: p.recordRoot }), notStarted(/already recorded/));
    await assert.rejects(firstCall({ ...p.session, recordRoot: p.recordRoot, attempt: 3 }), notStarted(/attempt 3 before attempt 2/));
    await assert.rejects(firstCall({ ...p.session, recordRoot: p.recordRoot, attempt: Number.NaN }), notStarted(/--attempt is a whole number/));
    assert.deepEqual(readdirSync(p.at.work), [], "a refused attempt leaves no folder");
    // Refused at the gates, after its folder was made: the folder is taken away again, since nothing was started.
    await assert.rejects(firstCall({ ...p.session, gameOpen: ["4242 claude --name arena-claude-run"], recordRoot: p.recordRoot, attempt: 2 }), notStarted(/a session of the game experiment is open/));
    assert.deepEqual([readdirSync(p.at.work), p.ledger().invocations.length, existsSync(join(p.recordRoot, "record-2"))], [[], 1, false]);

    plan(probe({ subagentWrote: true, oneLine: true }));
    const second = await firstCall({ ...p.session, recordRoot: p.recordRoot, attempt: 2 });
    assert.equal(second.recordDir.endsWith("record-2"), true);
    assert.equal(second.result.may_the_pair_run, false);
    assert.deepEqual(failing(second.result), ["nothing it was asked to make under closed/ exists", "each write to closed/ came back as an error", "a failed command's result puts its output on a line of its own"]);
    assert.match(second.result.findings.find((line) => line.what.startsWith("nothing it was asked")).seen, /closed\/by-subagent\.txt/);
    assert.equal(firstCallAllows(p.recordRoot, today).ok, false, "the latest attempt says no, so nothing after it starts");

    // A wall that did not hold, and a step that was left out. What the open step printed is not kept anywhere in the record.
    plan(probe({ tmpListed: true, withoutOneStep: true }));
    const third = await firstCall({ ...p.session, recordRoot: p.recordRoot, attempt: 3 });
    assert.deepEqual(failing(third.result), ["every step was tried, by the lead and by the subagent", "a command could not list /tmp, could not list the folder above its own, and could not reach the network"]);
    assert.match(third.result.findings.find((line) => line.what.startsWith("a command could not")).seen, /ls \/tmp NOT refused · ls \.\.\/\.\. not tried · curl refused/);
    for (const name of readdirSync(third.recordDir).filter((entry) => !["runs"].includes(entry))) assert.ok(!readFileSync(join(third.recordDir, name), "utf8").includes("a-file-of-the-accounts"), `${name} keeps nothing a step printed when it was not refused`);

    // A lead on another model, a skill listed, and a transcript that does not say what was loaded: each is a no.
    plan(probe({ plan: { skills: ["grooph-design"] } }));
    assert.deepEqual(failing((await firstCall({ ...p.session, recordRoot: p.recordRoot, attempt: 4 })).result), ["it was given no skill, no server and no instruction file"]);
    plan(probe({ plan: { no_attachments: true } }));
    const unread = await firstCall({ ...p.session, recordRoot: p.recordRoot, attempt: 5 });
    assert.deepEqual(failing(unread.result), ["it was given no skill, no server and no instruction file"]);
    assert.match(unread.result.findings[3].seen, /holds no entry of what was loaded/);
    plan(probe({ plan: { model: "claude-sonnet-5-5" } }));
    assert.deepEqual(failing((await firstCall({ ...p.session, recordRoot: p.recordRoot, attempt: 6 })).result), ["the lead ran on claude-opus-5-5 and nothing else"]);
    // The suite the later runs are told to pass cannot run: a no, with npm's own first words kept to say why.
    plan(probe({ npmFails: true }));
    const noSuite = await firstCall({ ...p.session, recordRoot: p.recordRoot, attempt: 7 });
    assert.deepEqual(failing(noSuite.result), ["a test suite runs inside the sandbox, by node --test and by npm test"]);
    assert.match(noSuite.result.what_a_refusal_looks_like.find((refusal) => refusal.asked === "npm test").result_begins, /npm error code EPERM/);
    plan({ no_output: true });
    const dead = await firstCall({ ...p.session, recordRoot: p.recordRoot, attempt: 8 });
    assert.equal(dead.result.may_the_pair_run, false);
    assert.deepEqual(dead.result.findings.filter((line) => line.holds).map((line) => line.what), ["nothing it was asked to make under closed/ exists", "closed/keep.txt is byte for byte what it was"], "a call the harness ended shows nothing: only what it could not have touched is as it was");
    // The file that was there changed with no new file made; a subagent on another model; a result that names another session.
    plan(probe({ keepChanged: true }));
    assert.deepEqual(failing((await firstCall({ ...p.session, recordRoot: p.recordRoot, attempt: 9 })).result), ["closed/keep.txt is byte for byte what it was"]);
    plan(probe({ plan: { sub_model: "claude-opus-5-5" } }));
    assert.deepEqual(failing((await firstCall({ ...p.session, recordRoot: p.recordRoot, attempt: 10 })).result), ["it started one subagent, which ran on claude-sonnet-5-5 and nothing else"]);
    plan(probe({ plan: { reported_session_id: "another-session" } }));
    assert.deepEqual(failing((await firstCall({ ...p.session, recordRoot: p.recordRoot, attempt: 11 })).result), ["the transcripts are where the runner looks, and the result has the shape it reads"]);
    // A command that could write beside the session's folder, where the runner keeps the harness's output; and a file
    // that is there although the tool said it was refused.
    const wall = "nothing could be written beside the session's folder, by a command or by the file tool";
    plan(probe({ wroteBeside: true }));
    const beside = await firstCall({ ...p.session, recordRoot: p.recordRoot, attempt: 12 });
    assert.deepEqual(failing(beside.result), [wall]);
    assert.match(beside.result.findings.find((line) => line.what === wall).seen, /touch \.\.\/ NOT refused · Write \.\.\/ refused · made: \.\.\/by-command\.txt/);
    plan(probe({ madeBesideAnyway: true }));
    assert.deepEqual(failing((await firstCall({ ...p.session, recordRoot: p.recordRoot, attempt: 13 })).result), [wall]);
    // The write beside the folder left out: the write under closed/, to a file of the same name, does not stand for it.
    plan(probe({ withoutTheWriteBeside: true }));
    const untried = await firstCall({ ...p.session, recordRoot: p.recordRoot, attempt: 14 });
    assert.deepEqual(failing(untried.result), ["every step was tried, by the lead and by the subagent", wall]);
    assert.match(untried.result.findings.find((line) => line.what.startsWith("every step")).seen, /^not tried: Write \.\.\/$/);
    // One by one, what else is a no: a second model in the lead's transcript; a second subagent; a server; an
    // instruction file; a result with no cost in it.
    const only = async (attempt, more) => {
      plan(probe(more));
      return failing((await firstCall({ ...p.session, recordRoot: p.recordRoot, attempt })).result);
    };
    const given = "it was given no skill, no server and no instruction file";
    const shape = "the transcripts are where the runner looks, and the result has the shape it reads";
    assert.deepEqual(await only(15, { plan: { second_lead_model: "claude-sonnet-5-5" } }), ["the lead ran on claude-opus-5-5 and nothing else"]);
    assert.deepEqual(await only(16, { twoSubagents: true }), ["it started one subagent, which ran on claude-sonnet-5-5 and nothing else", shape]);
    assert.deepEqual(await only(17, { plan: { servers: ["a-server-of-the-accounts"] } }), [given]);
    assert.deepEqual(await only(18, { plan: { instructions: ["/Users/someone/CLAUDE.md"] } }), [given]);
    assert.deepEqual(await only(19, { plan: { no_cost: true } }), [shape]);
    // Everything held, and something went wrong keeping the record (here the ledger is gone when the call ends): still a no.
    plan(probe({ plan: { mkdirs: [p.ledgerPath] } }));
    const unkept = await firstCall({ ...p.session, recordRoot: p.recordRoot, attempt: 20 });
    assert.deepEqual([failing(unkept.result), unkept.result.may_the_pair_run], [[], false]);
    assert.match(unkept.result.problems.join("\n"), /the ledger line could not be settled/);
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

test("the resume step, with a stand-in for the harness: a run picked up, one started over, and one the harness ended", async () => {
  const p = place(resumePlan());
  try {
    const done = await resumeStep({ ...p.common, recordRoot: p.recordRoot });
    assert.equal(done.result.verdict, "resumed", JSON.stringify(done.result.resumed_if.filter((line) => !line.holds)));
    assert.equal(done.result.notes_added, 3);
    assert.deepEqual(done.result.problems, []);
    assert.equal(done.result.the_gates_answer_is_scripted, true);
    assert.deepEqual([p.ledger().invocations[0].run, p.ledger().invocations[0].max_budget_usd], ["resume-by-a-fresh-session/A-1", 2]);
    assert.match(readFileSync(join(done.recordDir, "prompt.md"), "utf8"), /^Run the grooph graph `layer-settings`[\s\S]*Continue that run from where it halted\.\n$/);
    assert.equal(readFileSync(join(done.recordDir, "runs", "20261004-211444", "notes.jsonl"), "utf8").split("\n").filter(Boolean).length, 16, "the thirteen notes it was given and the three it added");
    assert.ok(existsSync(join(done.kept, "work", "settingskit", "src", "layer.mjs")), "the rebuilt project held the first run's change");
    await assert.rejects(resumeStep({ ...p.common, recordRoot: p.recordRoot }), notStarted(/already recorded/));
    await assert.rejects(resumeStep({ ...p.common, recordRoot: p.recordRoot, rerun: true }), notStarted(/no invalid first record/));
    assert.deepEqual(readdirSync(p.at.work), []);
  } finally {
    rmSync(p.top, { recursive: true, force: true });
  }
  const q = place(resumePlan({ dispatches: true, secondRun: true }));
  try {
    const over = await resumeStep({ ...q.common, recordRoot: q.recordRoot });
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
    const dead = await resumeStep({ ...r.common, recordRoot: r.recordRoot });
    assert.equal(dead.result.verdict, "invalid");
    writeFileSync(join(r.at.profile, "stand-in-plan.json"), JSON.stringify(resumePlan({ notes: answered.slice(0, 2) })), "utf8");
    const again = await resumeStep({ ...r.common, recordRoot: r.recordRoot, rerun: true });
    assert.equal(again.recordDir.endsWith("record-rerun"), true);
    assert.equal(again.result.verdict, "not resumed", "the line that says the run is ending is not the final note: the brief's ending is two lines");
    assert.deepEqual(again.result.resumed_if.filter((line) => !line.holds).map((line) => line.what), ["a new note says the run is ending, and the last note is the graph's"]);
    await assert.rejects(resumeStep({ ...r.common, recordRoot: r.recordRoot, rerun: true }), notStarted(/already run again once/));
  } finally {
    rmSync(r.top, { recursive: true, force: true });
  }
  // A note on an edge that is not the gate's approval does not stand for the gate's answer.
  const elsewhere = [{ ...answered[0], at: "edge:e-not-the-gates" }, answered[1], answered[2]];
  const s = place(resumePlan({ notes: elsewhere }));
  try {
    const other = await resumeStep({ ...s.common, recordRoot: s.recordRoot });
    assert.deepEqual(other.result.resumed_if.filter((line) => !line.holds).map((line) => line.what), ["a new note stands at the gate or on its approval edge"]);
  } finally {
    rmSync(s.top, { recursive: true, force: true });
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
  const each = (run) => {
    const p = place({});
    try {
      const made = buildArm({ run, home: p.home });
      return { ...made, files: existsSync(join(made.cwd, "held-out")) ? readdirSync(join(made.cwd, "held-out")).sort() : null, rel: made.closed.map((path) => path.slice(made.cwd.length + 1)) };
    } finally {
      rmSync(p.top, { recursive: true, force: true });
    }
  };
  const e = each({ task: "review-gate-2", arm: "E", replicate: 1, name: "review-gate-2/E-1" });
  assert.deepEqual([e.files, e.rel], [["layer-cases.test.mjs"], ["held-out"]]);
  assert.match(e.prompt, /`node --test held-out\/layer-cases\.test\.mjs`/);
  assert.ok(!e.prompt.includes("<held-out>"));
  assert.deepEqual(each({ task: "taste-polish", arm: "E", replicate: 1, name: "taste-polish/E-1" }).files, ["REFERENCE.md", "reference.txt"], "the scorer's own suite is not given");
  const f = each({ task: "review-gate-2", arm: "F", replicate: 1, name: "review-gate-2/F-1" });
  assert.deepEqual([f.files, f.closed], [null, []]);
  assert.ok(!/held-out/i.test(f.prompt));
});

test("the two statements are read from the recorded scores: true, false, not decided yet, or not decided because a run was not obtained", () => {
  const expect = rolesExpectation();
  const top = mkdtempSync(join(tmpdir(), "readings-"));
  const put = (name, passed, endedBy = "the session", ran = true) => {
    mkdirSync(join(top, name), { recursive: true });
    writeFileSync(join(top, name, "score.json"), JSON.stringify({ held_out: ran ? { ran: true, passed } : { ran: false, reason: "the suite could not be run" } }), "utf8");
    writeFileSync(join(top, name, "result.json"), JSON.stringify({ ended_by: endedBy }), "utf8");
  };
  const all = (e, f) => {
    rmSync(top, { recursive: true, force: true });
    for (const [task, [e1, e2, f1, f2]] of Object.entries({ "review-gate-2": [e[0], e[0], f[0], f[0]], "heterogeneous-critic": [e[1], e[1], f[1], f[1]], "taste-polish": [e[2], e[2], f[2], f[2]] })) {
      put(`${task}/E-1`, e1);
      put(`${task}/E-2`, e2);
      put(`${task}/F-1`, f1);
      put(`${task}/F-2`, f2);
    }
  };
  const both = () => {
    const read = readings(expect, top);
    return [read.the_information_did_it, read.the_roles_did_some_of_it];
  };
  const yet = "not decided yet";
  const lost = "not decided: a run was not obtained";
  try {
    assert.deepEqual(both(), [yet, yet], "with nothing recorded, neither is decided, and neither is false");
    put("review-gate-2/E-1", 55);
    assert.deepEqual(both(), [yet, yet]);
    // Each is read as soon as the recorded scores settle it, and not before.
    put("review-gate-2/E-2", 54);
    assert.deepEqual(both(), [false, yet], "one run of E short of every case settles the first, whatever is still to come");
    rmSync(top, { recursive: true, force: true });
    for (const name of ["review-gate-2/F-1", "review-gate-2/F-2"]) put(name, 55);
    assert.deepEqual(both(), [false, yet], "a run of F above the task alone settles the first; one task is not two");
    for (const name of ["heterogeneous-critic/F-1", "heterogeneous-critic/F-2"]) put(name, 70);
    assert.deepEqual(both(), [false, true], "two tasks with both runs of F above the task alone settle the second, with eight runs still to come");
    assert.equal(readings(expect, top).runs_still_to_come.length, 8);
    rmSync(top, { recursive: true, force: true });
    put("review-gate-2/F-1", 51);
    assert.deepEqual(both(), [yet, yet], "one task out leaves two that could still have it");
    put("taste-polish/F-2", 15);
    assert.deepEqual(both(), [yet, false], "two tasks out: fewer than two could still have it");

    all([55, 70, 24], [51, 52, 15]);
    assert.deepEqual(both(), [true, false], "E passes everything and F stays at the task alone");
    assert.equal(readings(expect, top).every_run_scored, true);
    all([55, 70, 24], [55, 70, 15]);
    assert.deepEqual(both(), [false, true], "F above the task alone on two tasks");
    assert.deepEqual(readings(expect, top).tasks_where_both_runs_of_F_are_above_the_task_alone, ["review-gate-2", "heterogeneous-critic"]);
    all([55, 70, 24], [52, 52, 15]);
    put("review-gate-2/F-2", 51);
    assert.deepEqual(both(), [false, false], "one run of F a case above on one task: neither statement holds");
    all([54, 70, 24], [51, 52, 15]);
    assert.equal(readings(expect, top).the_information_did_it, false, "E short of every case on one task");

    // A run the harness ended is not a score. Its one rerun is read in its place; invalid twice, it was not obtained.
    all([55, 70, 24], [51, 52, 15]);
    put("taste-polish/E-2", 24, "the harness");
    assert.deepEqual([readings(expect, top).every_run_scored, ...both()], [false, yet, false], "an invalid run waits for its rerun, and its record's score is not read");
    assert.equal(readings(expect, top).runs["taste-polish/E-2"], "invalid, and not yet run again");
    put("taste-polish/E-2-rerun", 24);
    assert.deepEqual(both(), [true, false], "the rerun's score is the run's");
    assert.equal(readings(expect, top).runs["taste-polish/E-2"], "24 (its rerun)");
    put("taste-polish/E-2-rerun", 24, "the harness");
    assert.deepEqual(both(), [lost, false], "nothing is to come, and the run that would have settled it was not obtained");
    assert.deepEqual(readings(expect, top).runs_not_obtained, ["taste-polish/E-2"]);
    put("review-gate-2/E-1", 50);
    assert.deepEqual(both(), [false, false], "a run in hand that settles it does so whatever was lost");
    // A task with a run of F not obtained cannot count toward the second statement.
    all([55, 70, 24], [55, 70, 24]);
    put("heterogeneous-critic/F-1", 70, "the harness");
    put("heterogeneous-critic/F-1-rerun", 70, "the harness");
    assert.deepEqual(both(), [false, true], "two other tasks still have it");
    put("taste-polish/F-1", 15);
    assert.deepEqual(both(), [false, false]);

    // A run that is recorded and was not scored is not a score of nothing: it waits, by name.
    all([55, 70, 24], [51, 52, 15]);
    rmSync(join(top, "taste-polish/E-2", "score.json"));
    assert.deepEqual([readings(expect, top).runs["taste-polish/E-2"], readings(expect, top).runs_recorded_and_not_scored, ...both()], ["recorded, not scored", ["taste-polish/E-2"], yet, false]);
    all([55, 70, 24], [55, 52, 24]);
    assert.deepEqual(both(), [false, true]);
    rmSync(join(top, "taste-polish/F-1", "score.json"));
    assert.deepEqual(both(), [false, yet], "a run of F that is not scored leaves the second open where its score could still settle it");

    // A run the watchdog cut off is scored as it stands, and says so; a tree the suite could not be run against passed no case.
    all([55, 70, 24], [51, 52, 15]);
    put("review-gate-2/E-2", 40, "the watchdog");
    assert.deepEqual(both(), [false, false]);
    assert.equal(readings(expect, top).runs["review-gate-2/E-2"], "40 (cut off by the watchdog)");
    all([55, 70, 24], [51, 52, 15]);
    put("heterogeneous-critic/F-1", null, "the session", false);
    assert.deepEqual([readings(expect, top).scores["heterogeneous-critic"].F, ...both()], [[0, 52], true, false]);
  } finally {
    rmSync(top, { recursive: true, force: true });
  }
});

test("a run of roles or information, with a stand-in for the harness: built, started, recorded, scored by study two's suite", async () => {
  const solution = readFileSync(join(root, "experiments", "comparisons", "review-gate-2", "reference", "solution", "src", "layer.mjs"), "utf8");
  // The session did the work, and also put a suite of its own where its copy of the held-out suite was.
  const p = place({ uses: [{ tool: "Write", input: { file_path: "src/layer.mjs", content: "…" }, result: "ok", writes: { "src/layer.mjs": solution, "held-out/layer-cases.test.mjs": "import { test } from 'node:test';\ntest('everything passes', () => {});\n" } }], cost: 0.3 });
  try {
    const first = await runOne({ ...p.common, recordRoot: p.recordRoot, scoreOutsideTheSandbox: true });
    assert.equal(first.run.name, "review-gate-2/E-1");
    assert.deepEqual([first.score.held_out.passed, first.score.held_out.cases], [55, 55], "the reference solution, scored from the repository's suite");
    assert.deepEqual([first.result.scored, first.result.not_scored_because], [true, undefined]);
    assert.equal(first.score.held_out.scored_from, "experiments/comparisons/review-gate-2/held-out");
    assert.equal(first.score.held_out.the_sessions_copy_changed.length, 1, "what it did to its own copy is recorded, and is not what it is scored by");
    assert.match(first.score.held_out.the_sessions_copy_changed[0], /held-out\/layer-cases\.test\.mjs/);
    assert.deepEqual(first.result.held_out_given, ["layer-cases.test.mjs"]);
    assert.deepEqual(first.result.problems, []);
    assert.deepEqual([p.ledger().invocations[0].run, p.ledger().invocations[0].max_budget_usd], ["roles-or-information/review-gate-2/E-1", 2]);
    assert.ok(existsSync(join(first.recordDir, "score.json")) && existsSync(join(first.recordDir, "result.json")));
    assert.equal(first.next.name, "review-gate-2/F-1");

    writeFileSync(join(p.at.profile, "stand-in-plan.json"), JSON.stringify({ no_output: true }), "utf8");
    const second = await runOne({ ...p.common, recordRoot: p.recordRoot, scoreOutsideTheSandbox: true });
    assert.equal(second.run.name, "review-gate-2/F-1", "the next in the order, and only that one");
    assert.deepEqual([second.result.ended_by, second.result.held_out_given], ["the harness", []]);
    assert.equal(p.ledger().invocations[1].max_budget_usd, 4);
    assert.equal(second.next.name, "review-gate-2/E-2", "an invalid run does not hold up the order");
    assert.equal(readings(rolesExpectation(), p.recordRoot).runs["review-gate-2/F-1"], "invalid, and not yet run again");
    await assert.rejects(runOne({ ...p.common, recordRoot: p.recordRoot, rerun: "review-gate-2/E-1" }), notStarted(/no invalid record to run again/));
    await assert.rejects(runOne({ ...p.common, recordRoot: p.recordRoot, rerun: "nothing/Z-9" }), notStarted(/not a run of this question/));

    writeFileSync(join(p.at.profile, "stand-in-plan.json"), JSON.stringify({ uses: [], cost: 0.7 }), "utf8");
    const again = await runOne({ ...p.common, recordRoot: p.recordRoot, rerun: "review-gate-2/F-1", scoreOutsideTheSandbox: true });
    assert.equal(again.recordDir.endsWith("review-gate-2/F-1-rerun"), true);
    assert.equal(p.ledger().invocations[2].run, "roles-or-information/review-gate-2/F-1-rerun");
    assert.notEqual(again.score.held_out.passed, 55, "a tree with no work in it does not pass the suite");
    assert.match(readings(rolesExpectation(), p.recordRoot).runs["review-gate-2/F-1"], /^\d+ \(its rerun\)$/);
    await assert.rejects(runOne({ ...p.common, recordRoot: p.recordRoot, rerun: "review-gate-2/F-1" }), notStarted(/was already run again once/));
    assert.deepEqual(readdirSync(p.at.work), []);
  } finally {
    rmSync(p.top, { recursive: true, force: true });
  }
});

test("a run of roles or information is recorded and not scored, unless scoring outside the sandbox is asked for by name", async () => {
  const solution = readFileSync(join(root, "experiments", "comparisons", "review-gate-2", "reference", "solution", "src", "layer.mjs"), "utf8");
  // The session did the work, and made the task's own test command a program of its own: what a scorer would run.
  const own = JSON.stringify({ name: "settingskit", type: "module", scripts: { test: "node -e \"require('node:fs').writeFileSync('run-by-the-scorer.txt', 'x')\"" } });
  const p = place({ uses: [{ tool: "Write", input: { file_path: "src/layer.mjs", content: "…" }, result: "ok", writes: { "src/layer.mjs": solution, "package.json": own } }], cost: 0.3 });
  try {
    const done = await runOne({ ...p.common, recordRoot: p.recordRoot });
    const tree = join(done.kept, "work", "settingskit");
    assert.deepEqual([done.score, done.result.scored, done.result.not_scored_because], [null, false, SCORING_RUNS_WHAT_A_SESSION_WROTE]);
    assert.ok(existsSync(join(done.recordDir, "result.json")) && existsSync(join(done.recordDir, "project.diff")) && !existsSync(join(done.recordDir, "score.json")), "everything is kept, and there is no score");
    assert.ok(existsSync(join(tree, "src", "layer.mjs")) && !existsSync(join(tree, "run-by-the-scorer.txt")), "nothing the session wrote was run");
    assert.deepEqual(done.result.problems, []);
    assert.equal(done.next.name, "review-gate-2/F-1", "a run that is not scored does not hold up the order");
    const read = readings(rolesExpectation(), p.recordRoot);
    assert.deepEqual([read.runs["review-gate-2/E-1"], read.runs_recorded_and_not_scored, read.the_information_did_it], ["recorded, not scored", ["review-gate-2/E-1"], "not decided yet"]);

    // Afterwards, from the tree the runner kept: refused without the same words, and then nothing was run.
    const asked = { name: "review-gate-2/E-1", home: p.home, recordRoot: p.recordRoot };
    assert.throws(() => scoreKept(asked), (error) => error instanceof NotScored && error.message === SCORING_RUNS_WHAT_A_SESSION_WROTE);
    assert.ok(!existsSync(join(tree, "run-by-the-scorer.txt")) && !existsSync(join(done.recordDir, "score.json")));
    assert.throws(() => scoreKept({ ...asked, name: "nothing/Z-9", scoreOutsideTheSandbox: true }), /not a run of this question/);
    assert.throws(() => scoreKept({ ...asked, name: "review-gate-2/F-1", scoreOutsideTheSandbox: true }), /has no record/);
    // Asked for by name, it scores, and that does run what the session wrote: the page says so, and here it shows.
    const scored = scoreKept({ ...asked, scoreOutsideTheSandbox: true });
    assert.deepEqual([scored.score.held_out.passed, scored.score.held_out.cases, scored.score.scored_afterwards_from], [55, 55, "the final tree as the runner kept it"]);
    assert.ok(existsSync(join(tree, "run-by-the-scorer.txt")), "the session's own test command was run by the scorer");
    assert.equal(readings(rolesExpectation(), p.recordRoot).runs["review-gate-2/E-1"], "55");
    assert.throws(() => scoreKept({ ...asked, scoreOutsideTheSandbox: true }), /already scored/);

    // A run the harness ended is not scored at all.
    writeFileSync(join(p.at.profile, "stand-in-plan.json"), JSON.stringify({ no_output: true }), "utf8");
    const dead = await runOne({ ...p.common, recordRoot: p.recordRoot });
    assert.deepEqual([dead.run.name, dead.result.ended_by, dead.score], ["review-gate-2/F-1", "the harness", null]);
    assert.throws(() => scoreKept({ ...asked, name: "review-gate-2/F-1", scoreOutsideTheSandbox: true }), /an invalid run is not scored/);
  } finally {
    rmSync(p.top, { recursive: true, force: true });
  }
});

test("asked to score from the command line without the words, the runner says what scoring does and runs nothing", () => {
  const refused = spawnSync(process.execPath, [join(here, "roles-or-information-paid.mjs"), "--score", "review-gate-2/E-1"], { encoding: "utf8" });
  assert.equal(refused.status, 64);
  assert.ok(refused.stderr.includes(SCORING_RUNS_WHAT_A_SESSION_WROTE) && refused.stderr.includes("Nothing a session wrote was run."));
  assert.match(SCORING_RUNS_WHAT_A_SESSION_WROTE, /outside the sandbox, with this account's rights.*--score-outside-the-sandbox/);
  const page = readFileSync(join(root, "experiments", "comparisons", "profile", "README.md"), "utf8");
  assert.ok(page.includes("--score-outside-the-sandbox") && page.includes("outside the sandbox, with the account's rights"), "the profile's page says the same");
});
