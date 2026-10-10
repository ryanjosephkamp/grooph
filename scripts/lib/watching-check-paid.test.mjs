// Tests of the watching check's runner that spend nothing: where a session would be started, a stand-in program is,
// which calls no model (scripts/lib/fixtures/stand-in-harness.mjs). The profile, the ledger and the records are all
// temporary. Nothing here starts a model session, and nothing here touches the real profile.
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { cpSync, existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import { layout, settingsFor } from "./compare-profile.mjs";
import { DESIGN_WORDS, MECHANICS, deriveD } from "./compare-prompt.mjs";
import { scoreHeldOut } from "./compare-score.mjs";
import { scoringDecided } from "./roles-or-information-paid.mjs";
import { NotStarted, profileFingerprint } from "./study-three-paid.mjs";
import {
  ARMS,
  build,
  CLI,
  CLOSED_IN_A_WATCHED_ARM,
  dryRun,
  folderLine,
  FOOTPRINT,
  FOUR_OPENS,
  HOOK_FILES,
  hookBesideTranscripts,
  INVITATION,
  LEAD,
  LEDGER,
  measure,
  namesOnly,
  nextRun,
  NotScored,
  OFFERED,
  order,
  promptFor,
  readLedger,
  room,
  runAll,
  runOne,
  score,
  scoreKept,
  SCORING_RUNS_WHAT_A_SESSION_WROTE,
  serverOffers,
  sessionNode,
  stateOf,
  status,
  STOPS_AT_USD,
  SUBAGENTS_SENTENCE,
  taskAlone,
  TASKS,
  taskText,
  transcriptsOf,
  waitsForAPerson,
  WATCHDOG,
} from "./watching-check-paid.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..", "..");
const comparisons = join(root, "experiments", "comparisons");
const STAND_IN = join(here, "fixtures", "stand-in-harness.mjs");
const SCRIPT = join(here, "watching-check-paid.mjs");
const built = existsSync(join(root, "packages", "cli", "dist"));
const page = readFileSync(join(root, "experiments", "watching", "README.md"), "utf8");
const DECISION = { decided_by: "the owner", on: "2026-10-09", words: "a test's stand-in for his words" };
const sha = (path) => createHash("sha256").update(readFileSync(path)).digest("hex");
const notStarted = (pattern) => (error) => error instanceof NotStarted && pattern.test(error.message);

/** Every file under a folder, by its path from it, `.git` left out. */
function filesUnder(dir, base = dir) {
  return readdirSync(dir)
    .sort()
    .flatMap((name) => (name === ".git" && dir === base ? [] : lstatSync(join(dir, name)).isDirectory() ? filesUnder(join(dir, name), base) : [join(dir, name).slice(base.length + 1)]));
}

/** A temporary home with a profile, a ledger of the repository's shape and a place for records; the stand-in's plan goes in the profile. */
function place(plan = { uses: [] }, { decided = true, lines = [] } = {}) {
  const top = mkdtempSync(join(tmpdir(), "watching-"));
  const home = join(top, "home");
  const at = layout(home);
  for (const dir of [at.profile, at.shell, at.temp, at.cache, at.work]) mkdirSync(dir, { recursive: true });
  const setPlan = (next) => writeFileSync(join(at.profile, "stand-in-plan.json"), JSON.stringify(next), "utf8");
  setPlan(plan);
  const ledgerPath = join(top, "ledger.json");
  const kept = JSON.parse(readFileSync(LEDGER, "utf8"));
  writeFileSync(ledgerPath, JSON.stringify({ ...kept, invocations: lines, scoring_outside_the_sandbox: decided ? DECISION : { decided_by: null, on: null, words: null } }), "utf8");
  // The stand-in is started through a wrapper that names node whole: a session's own path is a clean one, and on a
  // machine where node is not in one of its folders (CI) the stand-in's first line would not find it.
  const harness = join(top, "stand-in-harness");
  writeFileSync(harness, `#!/bin/sh\nexec ${JSON.stringify(process.execPath)} ${JSON.stringify(STAND_IN)} "$@"\n`, { mode: 0o755 });
  const recordRoot = join(top, "records");
  // What a run is started with in a test: the stand-in, no real profile check, no game session, the first call's yes, a short grace.
  const common = { home, claude: harness, ledgerPath, recordRoot, profileCheck: () => [], gameOpen: [], go: "the driver said: run the watching check", grace: 300, firstCallGate: { ok: true, record: "record" } };
  return { top, home, at, harness, ledgerPath, recordRoot, common, setPlan, ledger: () => JSON.parse(readFileSync(ledgerPath, "utf8")), seen: () => JSON.parse(readFileSync(join(at.profile, "command-seen-by-the-stand-in.json"), "utf8")) };
}
const settled = (run, cost, more = {}) => ({ n: 1, run, project: run.split("/").slice(0, 2).join("/"), kind: "kickoff", status: "ok", cost_usd: cost, reported_cost_usd: cost, max_budget_usd: 6, started: "2026-10-09T00:00:00.000Z", ...more });

// ── the protocol's own words ─────────────────────────────────────────────

test("the twelve runs, in the order the protocol gives", () => {
  assert.deepEqual(
    order().map((run) => run.name),
    ["one/plain-1", "four/plain-1", "one/watched-1", "four/watched-1", "one/invited-1", "four/invited-1", "one/plain-2", "four/plain-2", "one/watched-2", "four/watched-2", "one/invited-2", "four/invited-2"],
  );
  // The page's own sentence, read from the page: the first six in its words, "then the same six again".
  const said = /in this order: (.+?); then the same six again\./.exec(page)[1];
  const six = said.split(", ").map((part) => /^`(\w+)` (\w+)$/.exec(part).slice(1)).map(([task, arm]) => `${task}/${arm}`);
  assert.deepEqual(order().slice(0, 6).map((run) => `${run.task}/${run.arm}`), six);
  assert.deepEqual(order().slice(6).map((run) => `${run.task}/${run.arm}`), six);
  assert.deepEqual([order().length, new Set(order().map((run) => run.name)).size], [12, 12]);
  const top = mkdtempSync(join(tmpdir(), "watching-order-"));
  try {
    assert.equal(nextRun(top).name, "one/plain-1");
    for (const name of ["one/plain-1", "four/plain-1"]) {
      mkdirSync(join(top, name), { recursive: true });
      writeFileSync(join(top, name, "result.json"), JSON.stringify({ ended_by: name.startsWith("four") ? "the harness" : "the session", why: "no result from the harness (exit 1)" }), "utf8");
    }
    assert.equal(nextRun(top).name, "one/watched-1", "a run the harness ended does not hold up the order: it waits for its one rerun");
    assert.deepEqual([stateOf(order()[0], top).state, stateOf(order()[1], top).state, stateOf(order()[2], top).state], ["recorded, not scored", "ended by the harness, and not yet run again", "not recorded"]);
  } finally {
    rmSync(top, { recursive: true, force: true });
  }
});

test("the two sentences, the model, the limits and the tasks are the page's, to the letter", () => {
  assert.ok(page.includes(`\n> ${SUBAGENTS_SENTENCE}\n`), "the sentence every prompt ends its task with");
  assert.ok(page.includes(`\n> ${INVITATION}\n`), "the invitation");
  assert.ok(page.includes("on Claude Sonnet 5.5 at high effort"));
  assert.deepEqual(LEAD, { model: "claude-sonnet-5-5", effort: "high" });
  assert.deepEqual(ARMS, ["plain", "watched", "invited"]);
  assert.ok(page.includes("A run of `one` stops at $2.00 or 15 minutes. A run of `four` stops at $6.00 or 40 minutes."));
  assert.deepEqual(WATCHDOG, { one: { usd: 2, minutes: 15 }, four: { usd: 6, minutes: 40 } });
  assert.ok(page.includes("The whole check stops at **$45.00** on a ledger of its own"));
  assert.equal(STOPS_AT_USD, 45);
  assert.ok(page.includes("`grooph_plan` and `grooph_note`, and every other tool of it withheld"));
  assert.deepEqual(OFFERED, ["grooph_plan", "grooph_note"]);
  assert.ok(page.includes("how many of the session's tool calls name `.grooph` or `.claude/settings.json`"));
  assert.deepEqual(FOOTPRINT, [".grooph", ".claude/settings.json"]);
  // Each package is the task of the project the page names for it, under the name its own package.json gives it.
  for (const pkg of [...TASKS.one.packages, ...TASKS.four.packages]) {
    assert.equal(JSON.parse(readFileSync(join(comparisons, pkg.project, "task", "package.json"), "utf8")).name, pkg.name);
    assert.ok(new RegExp(`\`${pkg.name}\`[^;\\n]{0,120}?comparisons/${pkg.project}/`).test(page), `${pkg.name} is ${pkg.project}'s task, by the page`);
  }
  assert.deepEqual(TASKS.four.packages.map((pkg) => pkg.folder), ["settingskit", "textwrap", "csvline", "semver-mini"]);
});

test("each unseen suite holds as many cases as the runner says, counted against the repository's own task folder", () => {
  // Only the repository's own code is run here: the suite against the task as its project keeps it, with no work in it.
  for (const pkg of [...TASKS.one.packages, ...TASKS.four.packages]) {
    const tree = mkdtempSync(join(tmpdir(), "watching-suite-"));
    try {
      cpSync(join(comparisons, pkg.project, "task"), tree, { recursive: true });
      const held = scoreHeldOut(tree, join(comparisons, pkg.project, "held-out"));
      assert.deepEqual([held.ran, held.cases], [true, pkg.cases], pkg.project);
      assert.ok(held.passed < pkg.cases, `${pkg.name}: a package with no work in it does not pass its suite`);
    } finally {
      rmSync(tree, { recursive: true, force: true });
    }
  }
});

// ── the prompts ──────────────────────────────────────────────────────────

test("the prompts differ only as the protocol says: the same task and sentence in every arm, and the invitation after it in the third", () => {
  for (const task of ["one", "four"]) {
    const plain = promptFor({ task, arm: "plain" });
    assert.equal(promptFor({ task, arm: "watched" }), plain, "the watched arm's prompt is the plain arm's, to the letter");
    assert.equal(promptFor({ task, arm: "invited" }), `${plain}\n${INVITATION}\n`, "the invited arm's is that prompt and the invitation after it");
    assert.equal(plain, `${taskText(task)}\n${SUBAGENTS_SENTENCE}\n`, "the task, then the sentence");
    assert.ok(!/grooph/i.test(plain), "nothing of grooph is in the plain arm's prompt, or the watched arm's");
    assert.deepEqual(promptFor({ task, arm: "invited" }).match(/grooph\w*/gi), ["grooph_plan", "grooph_note"], "in the invited arm's, only the two tools the invitation names");
  }
  assert.throws(() => promptFor({ task: "one", arm: "steered" }), notStarted(/not an arm/));
  assert.throws(() => promptFor({ task: "nine", arm: "plain" }), notStarted(/not a task/));
});

test("the narrow task is worded as its project's task-alone prompt words it, and the wide one by the same rule, four times, each with its folder named", () => {
  const keptD = readFileSync(join(comparisons, "heterogeneous-critic", "prompt-D.md"), "utf8");
  assert.equal(taskText("one"), keptD);
  assert.equal(taskAlone("heterogeneous-critic").prompt, keptD, "and the kept prompt is what the rule derives today");
  // The wide task: what the rule derives for each project, whole, under a line that names its folder. Taking those away leaves this script's one paragraph and nothing else.
  let rest = taskText("four");
  for (const pkg of TASKS.four.packages) {
    const slots = JSON.parse(readFileSync(join(comparisons, pkg.project, "slots.json"), "utf8"));
    const expect = JSON.parse(readFileSync(join(comparisons, pkg.project, "expect.json"), "utf8"));
    const derived = deriveD({ task: slots.values.task, testCommand: expect.test_command ?? slots.values["test-command"], acceptance: expect.acceptance ?? expect.judge?.acceptance ?? [] }).prompt;
    assert.equal(taskAlone(pkg.project).prompt, derived);
    const block = `${folderLine(pkg.folder)}\n\n${derived.trimEnd()}`;
    assert.equal(rest.split(block).length, 2, `${pkg.folder}: its task, as the rule words it, is there once under its folder's name`);
    assert.ok(derived.includes(slots.values.task), "and the task's own text is in it as its project keeps it");
    rest = rest.replace(block, "");
  }
  assert.equal(rest.trim(), FOUR_OPENS, "the only words this script adds are its opening paragraph and the four lines that name a folder");
  const order = TASKS.four.packages.map((pkg) => taskText("four").indexOf(folderLine(pkg.folder)));
  assert.deepEqual(order, [...order].sort((a, b) => a - b), "one after another, in the page's order");
  // review-gate-2 keeps its own task-alone prompt, and the rule gives it back.
  assert.equal(taskAlone("review-gate-2").prompt, readFileSync(join(comparisons, "review-gate-2", "prompt-D.md"), "utf8"));
  // The words this script adds carry no role, routing or loop, and nothing of grooph's mechanics.
  for (const added of [FOUR_OPENS, ...TASKS.four.packages.map((pkg) => folderLine(pkg.folder))]) {
    assert.deepEqual(added.match(DESIGN_WORDS) ?? [], [], added);
    assert.ok(!new RegExp(MECHANICS.source, "i").test(added), added);
  }
  for (const pkg of [...TASKS.one.packages, ...TASKS.four.packages]) assert.deepEqual([taskAlone(pkg.project).report.design_words, taskAlone(pkg.project).report.mechanics_left], [[], []], pkg.project);
  // One task says of itself that cases exist which it is not shown. That is the task as its project keeps it, and it names no file.
  assert.deepEqual(TASKS.four.packages.filter((pkg) => taskAlone(pkg.project).report.held_out_named.length > 0).map((pkg) => pkg.name), ["semver-mini"]);
});

// ── the three arms' folders ──────────────────────────────────────────────

test("the plain arm's folder is the task's packages, byte for byte, in one commit by the neutral user, with no trace of grooph", () => {
  for (const task of ["one", "four"]) {
    const p = place();
    try {
      const run = { task, arm: "plain", replicate: 1, name: `${task}/plain-1` };
      const made = build({ run, home: p.home });
      assert.equal(made.cwd, join(made.work, TASKS[task].repository));
      assert.ok(made.cwd.startsWith(`${p.at.work}/`));
      const expected = TASKS[task].packages.flatMap((pkg) => filesUnder(join(comparisons, pkg.project, "task")).map((path) => ({ at: pkg.folder ? join(pkg.folder, path) : path, from: join(comparisons, pkg.project, "task", path) })));
      assert.deepEqual(filesUnder(made.cwd), expected.map((file) => file.at).sort(), "every file of every package, and no other file");
      for (const file of expected) assert.equal(sha(join(made.cwd, file.at)), sha(file.from), `${file.at} is byte for byte what its project keeps`);
      for (const path of filesUnder(made.cwd)) assert.ok(!/grooph/i.test(path) && !/grooph/i.test(readFileSync(join(made.cwd, path), "utf8")), `${path} holds nothing of grooph`);
      assert.ok(!existsSync(join(made.cwd, ".grooph")) && !existsSync(join(made.cwd, ".claude")));
      const git = (...args) => execFileSync("git", ["-C", made.cwd, ...args], { encoding: "utf8" }).trim();
      assert.equal(git("log", "--format=%an <%ae> %s"), "dev <dev@localhost> initial commit", "one commit, by the neutral user the other runners use");
      assert.equal(git("status", "--porcelain"), "", "and everything is in it");
      assert.deepEqual(git("ls-tree", "-r", "--name-only", "HEAD").split("\n").sort(), filesUnder(made.cwd));
      assert.deepEqual([made.closed, made.server, made.installed, made.instructions], [[], null, [], null], "nothing is closed, nothing attached, nothing installed");
      assert.equal(made.prompt, promptFor(run));
      if (task === "four") assert.deepEqual(readdirSync(made.cwd).filter((name) => name !== ".git").sort(), ["csvline", "semver-mini", "settingskit", "textwrap"], "four packages side by side, and nothing beside them");
    } finally {
      rmSync(p.top, { recursive: true, force: true });
    }
  }
});

test("the watched arm's folder is the plain arm's and what grooph hooks install leaves, in the same one commit; the invited arm's folder is the watched arm's", { skip: !built }, () => {
  const p = place();
  try {
    const folder = (arm) => {
      const made = build({ run: { task: "four", arm, replicate: 1, name: `four/${arm}-1` }, home: p.home, node: "/a/node" });
      const files = Object.fromEntries(filesUnder(made.cwd).map((path) => [path, sha(join(made.cwd, path))]));
      const tracked = execFileSync("git", ["-C", made.cwd, "ls-tree", "-r", "--name-only", "HEAD"], { encoding: "utf8" }).trim().split("\n").sort();
      const commits = execFileSync("git", ["-C", made.cwd, "log", "--format=%an <%ae> %s"], { encoding: "utf8" }).trim();
      const settings = existsSync(join(made.cwd, ".claude", "settings.json")) ? JSON.parse(readFileSync(join(made.cwd, ".claude", "settings.json"), "utf8")) : null;
      const cwd = made.cwd;
      rmSync(made.work, { recursive: true, force: true });
      return { made, files, tracked, commits, settings, cwd };
    };
    const plain = folder("plain");
    const watched = folder("watched");
    const invited = folder("invited");
    assert.deepEqual(Object.keys(watched.files).sort(), [...Object.keys(plain.files), ...HOOK_FILES].sort(), "the plain arm's files, and the three the install leaves");
    for (const path of Object.keys(plain.files)) assert.equal(watched.files[path], plain.files[path], `${path}: the packages are the same bytes with the hook installed`);
    assert.deepEqual(watched.made.installed, HOOK_FILES);
    assert.equal(watched.files[".grooph/hooks/grooph-event.mjs"], sha(join(root, "packages", "cli", "hooks", "grooph-event.mjs")), "the hook is the one this checkout ships");
    assert.deepEqual(watched.tracked, Object.keys(watched.files).sort(), "the installed files are in the commit");
    assert.equal(watched.commits, "dev <dev@localhost> initial commit", "and it is still one commit");
    // No other flag: the seven events, the spawn tool alone among tool calls, and nothing that sends anything anywhere.
    assert.deepEqual(Object.keys(watched.settings), ["hooks"]);
    assert.deepEqual(Object.keys(watched.settings.hooks).sort(), ["PostToolUse", "SessionEnd", "SessionStart", "Stop", "SubagentStart", "SubagentStop", "UserPromptSubmit"]);
    assert.equal(watched.settings.hooks.PostToolUse[0].matcher, "Agent");
    assert.ok(!JSON.stringify(watched.settings).includes("push"), "installed with no other flag: nothing is sent anywhere");
    // The hook's folder is closed to the session, as the game experiment's profile closes it: the harness runs the hook outside the sandbox.
    assert.deepEqual(CLOSED_IN_A_WATCHED_ARM, [join(".grooph", "hooks")]);
    assert.deepEqual(watched.made.closed, [join(watched.cwd, ".grooph", "hooks")]);
    assert.deepEqual([watched.made.server, watched.made.instructions], [null, null], "the watched arm attaches nothing");
    assert.equal(watched.made.prompt, plain.made.prompt);

    // The invited arm: the same files as the watched arm, to the byte. The server leaves nothing in the folder when it is asked what it offers.
    assert.deepEqual(invited.files, watched.files);
    assert.deepEqual(invited.tracked, watched.tracked);
    assert.deepEqual(invited.made.closed, [join(invited.cwd, ".grooph", "hooks")]);
    assert.deepEqual(invited.made.server.mcp, { mcpServers: { grooph: { command: "/a/node", args: [CLI, "mcp", "--dir", invited.cwd] } } }, "this checkout's grooph mcp --dir <the session's folder>, and no other flag");
    assert.deepEqual(invited.made.server.allowed, ["mcp__grooph__grooph_plan", "mcp__grooph__grooph_note"]);
    // Every other tool the server lists is withheld, by its own list and not by one kept here.
    const offers = serverOffers(p.top);
    assert.deepEqual([...invited.made.server.allowed, ...invited.made.server.withheld].sort(), offers.tools.map((name) => `mcp__grooph__${name}`).sort(), "allowed and withheld are, together, every tool of the server");
    assert.ok(invited.made.server.withheld.includes("mcp__grooph__grooph_running") && invited.made.server.withheld.length === offers.tools.length - 2);
    assert.deepEqual(invited.made.instructions, offers.instructions);
    assert.ok(offers.instructions.characters > 0 && /^[0-9a-f]{64}$/.test(offers.instructions.sha256), "what the server says of itself to a harness is named in the record by its length and checksum");
    assert.ok(offers.instructions.first_names_one_of_the_two_tools_at_character === null || Number.isInteger(offers.instructions.first_names_one_of_the_two_tools_at_character), "and by where it first names one of the two tools");
    assert.equal(invited.made.prompt, `${plain.made.prompt}\n${INVITATION}\n`);
    assert.deepEqual(readdirSync(p.at.work), [], "each folder was taken away again");
    assert.ok(sessionNode() === "node" || sessionNode().startsWith("/"), "the server is started by node as a session's own path finds it");
  } finally {
    rmSync(p.top, { recursive: true, force: true });
  }
});

// ── the ledger ───────────────────────────────────────────────────────────

test("the ledger as the repository keeps it: the protocol's cap and ceilings, read by the runner, and the decision on scoring", () => {
  const kept = readLedger();
  assert.deepEqual([kept.cap_usd, kept.watchdog.one, kept.watchdog.four], [45, { usd: 2, minutes: 15 }, { usd: 6, minutes: 40 }]);
  assert.ok(Array.isArray(kept.invocations));
  assert.deepEqual(Object.keys(kept.scoring_outside_the_sandbox), ["about", "decided_by", "on", "words"]);
  // This is the one line that has to change, on purpose and in the same commit, when the owner's decision is written down.
  assert.equal(scoringDecided(kept).ok, false, "written on 2026-10-09 with no decision recorded");
  // A ledger that is not there, cannot be read, or states other limits than the protocol's is a refusal.
  const top = mkdtempSync(join(tmpdir(), "watching-ledger-"));
  try {
    const path = join(top, "ledger.json");
    assert.throws(() => readLedger(path), notStarted(/could not be read \(.*ENOENT\)/));
    writeFileSync(path, "{ not json", "utf8");
    assert.throws(() => readLedger(path), notStarted(/could not be read/));
    for (const [change, says] of [[{ cap_usd: 60 }, /its cap is 60, and the protocol's is 45/], [{ cap_usd: null }, /its cap is null/], [{ watchdog: { ...kept.watchdog, four: { usd: 9, minutes: 40 } } }, /its limits for a run of `four` are \{"usd":9,"minutes":40\}/], [{ watchdog: { one: kept.watchdog.one } }, /its limits for a run of `four` are null/], [{ invocations: null }, /it holds no list of invocations/]]) {
      writeFileSync(path, JSON.stringify({ ...kept, ...change }), "utf8");
      assert.throws(() => readLedger(path), notStarted(says), JSON.stringify(change));
    }
    writeFileSync(path, JSON.stringify(kept), "utf8");
    assert.deepEqual(readLedger(path), kept);
  } finally {
    rmSync(top, { recursive: true, force: true });
  }
});

test("a run is not started unless the ledger has room for its ceiling: a settled run counts at its reported cost, an unsettled one at its ceiling", async () => {
  const ledger = (lines) => ({ cap_usd: 45, invocations: lines });
  const done = (cost) => ({ status: "ok", cost_usd: cost, max_budget_usd: 6 });
  const open = (ceiling) => ({ status: "running", cost_usd: null, max_budget_usd: ceiling });
  // The ceilings of the twelve add up to more than the cap. That is meant: the cap is what stops the check.
  assert.equal(order().reduce((sum, run) => sum + WATCHDOG[run.task].usd, 0), 48);
  assert.deepEqual([room(ledger([]), 6).ok, room(ledger([]), 6).left], [true, 45]);
  // Settled at what the harness reported, not at the ceiling it had: eleven cheap runs leave room for the twelfth.
  assert.deepEqual([room(ledger(Array(11).fill(done(0.4))), 6).ok, Math.round(room(ledger(Array(11).fill(done(0.4))), 6).spent * 100) / 100], [true, 4.4]);
  // To the cent, for each kind of run: room for exactly its ceiling is room; a cent less is not.
  assert.equal(room(ledger([done(39)]), 6).ok, true);
  assert.equal(room(ledger([done(39.01)]), 6).ok, false);
  assert.equal(room(ledger([done(39.01)]), 2).ok, true, "a run of `one` still fits where a run of `four` does not");
  assert.equal(room(ledger([done(43)]), 2).ok, true);
  assert.equal(room(ledger([done(43.01)]), 2).ok, false);
  // An unsettled line counts at its ceiling, whatever it may turn out to have cost.
  assert.equal(room(ledger([done(34), open(6)]), 6).ok, false, "34 settled and 6 held for a run still open leave 5");
  assert.equal(room(ledger([done(33), open(6)]), 6).ok, true);
  assert.equal(room(ledger([done(34), { status: "failed", cost_usd: null, max_budget_usd: 6 }]), 6).ok, false, "a call that ended with no reported cost stays at its ceiling");
  assert.equal(room(ledger([done(34), { status: "failed", cost_usd: 0, max_budget_usd: 6 }]), 6).ok, true, "a harness that could not be started spent nothing");
  const refused = room(ledger([done(41.5)]), 6);
  assert.match(refused.why, /has counted \$41\.50 on its ledger, and this run may cost up to \$6\.00: together past the \$45\.00 at which the whole check stops/);

  // A paid run is refused by it before any folder is made, and no line is written; --status says so for the next run.
  const p = place({ uses: [], cost: 0.1 }, { lines: [settled("watching/one/plain-1", 41.5)] });
  try {
    mkdirSync(join(p.recordRoot, "one", "plain-1"), { recursive: true });
    writeFileSync(join(p.recordRoot, "one", "plain-1", "result.json"), JSON.stringify({ ended_by: "the session" }), "utf8");
    assert.equal(nextRun(p.recordRoot).name, "four/plain-1");
    await assert.rejects(runOne(p.common), notStarted(/together past the \$45\.00 at which the whole check stops/));
    assert.deepEqual([readdirSync(p.at.work), p.ledger().invocations.length], [[], 1], "nothing was made and nothing was written");
    const said = status({ ledgerPath: p.ledgerPath, recordRoot: p.recordRoot });
    assert.match(said, /\$41\.50 counted of \$45\.00, in 1 line\(s\)/);
    assert.match(said, /next: four\/plain-1, which may cost up to \$6\.00\nTHE LEDGER HAS NO ROOM FOR IT, and it would be refused: the watching check has counted \$41\.50/);
    assert.match(status({ ledgerPath: p.ledgerPath, recordRoot: join(p.top, "no-records") }), /next: one\/plain-1, which may cost up to \$2\.00; the ledger has room for it \(\$3\.50 left\)/);
  } finally {
    rmSync(p.top, { recursive: true, force: true });
  }
});

// ── the refusals ─────────────────────────────────────────────────────────

test("no run starts without the first call's yes, the owner's decision on scoring, the two flags, a ledger with the protocol's limits, and a profile that holds", async () => {
  const p = place({ uses: [], cost: 0.1 }, { decided: false });
  const nothingMade = (why) => assert.deepEqual([readdirSync(p.at.work), p.ledger().invocations, existsSync(p.recordRoot)], [[], [], false], why);
  try {
    // The first call's word comes first.
    await assert.rejects(runOne({ ...p.common, firstCallGate: { ok: false, why: "the first paid call has no record" } }), notStarted(/the first paid call has no record/));
    // Then the decision on scoring: the whole run is refused, since a run that cannot be scored is not paid for.
    const sentence = (error) => error instanceof NotStarted && error.message.includes(SCORING_RUNS_WHAT_A_SESSION_WROTE) && /no decision of his is recorded \(experiments\/watching\/ledger\.json, scoring_outside_the_sandbox/.test(error.message);
    await assert.rejects(runOne(p.common), sentence);
    assert.throws(() => scoreKept({ name: "one/plain-1", ledger: p.ledger(), home: p.home, recordRoot: p.recordRoot }), (error) => error instanceof NotScored && error.message.includes(SCORING_RUNS_WHAT_A_SESSION_WROTE));
    nothingMade("refused before any folder is made");
    // A decision recorded for roles or information, in its own file, is not this check's: only the ledger's own fields are read.
    assert.match(SCORING_RUNS_WHAT_A_SESSION_WROTE, /runs the code the session wrote: outside the sandbox, with this account's rights/);
    const decided = { ...p.ledger(), scoring_outside_the_sandbox: DECISION };
    writeFileSync(p.ledgerPath, JSON.stringify(decided), "utf8");
    // The driver's words.
    await assert.rejects(runOne({ ...p.common, go: undefined }), notStarted(/no word from the driver/));
    // The profile, a session of the game experiment, a work folder that is not empty.
    await assert.rejects(runOne({ ...p.common, profileCheck: () => [{ what: "the profile is signed in", ok: false, how: "not signed in" }] }), notStarted(/the profile: the profile is signed in: not signed in/));
    await assert.rejects(runOne({ ...p.common, gameOpen: ["123 claude --name arena-claude-a"] }), notStarted(/a session of the game experiment is open/));
    nothingMade("each of those took its folder away again");
    mkdirSync(join(p.at.work, "left-by-an-earlier-session"));
    await assert.rejects(runOne(p.common), notStarted(/the profile's work folder is not empty/));
    rmSync(join(p.at.work, "left-by-an-earlier-session"), { recursive: true });
    // The ledger.
    writeFileSync(p.ledgerPath, JSON.stringify({ ...decided, cap_usd: 100 }), "utf8");
    await assert.rejects(runOne(p.common), notStarted(/is not what the protocol says: its cap is 100/));
    rmSync(p.ledgerPath);
    await assert.rejects(runOne(p.common), notStarted(/ledger could not be read/));
    writeFileSync(p.ledgerPath, JSON.stringify(decided), "utf8");
    // A run is made once more only when the harness ended it, and only a run of the twelve.
    await assert.rejects(runOne({ ...p.common, rerun: "one/steered-1" }), notStarted(/not a run of the watching check/));
    await assert.rejects(runOne({ ...p.common, rerun: "one/plain-1" }), notStarted(/has no record the harness ended/));
    assert.deepEqual([readdirSync(p.at.work), p.ledger().invocations], [[], []]);
  } finally {
    rmSync(p.top, { recursive: true, force: true });
  }
});

test("on the command line: a flag it does not know, a paid run without both flags or without saying which, and a run named outside a dry run are each refused", () => {
  const ask = (...flags) => spawnSync(process.execPath, [SCRIPT, ...flags], { encoding: "utf8" });
  const words = ["--spend", "--go", "the driver's words"];
  for (const [flags, says] of [
    [["--dryrun", ...words], /--dryrun: not a flag of this script\. Nothing was started\./],
    [["--next", "--spend", "--go", "the driver's words", "--score-outside-the-sandbox"], /--score-outside-the-sandbox: not a flag of this script/],
    [["--next"], /will not without --spend and --go/],
    [["--all", "--spend"], /will not without --go/],
    [["--next", "--go", "the driver's words"], /will not without --spend/],
    [words, /say which: --next .* None was given\. Nothing was started\./],
    [["--next", "--all", ...words], /More than one was given\. Nothing was started\./],
    [["--run", "one/plain-1", ...words], /--run names a run for --dry-run only/],
    [["--rerun", ...words], /--rerun names a run, such as one\/plain-1\. Nothing was started\./],
    [["--score"], /--score names a run/],
  ]) {
    const out = ask(...flags);
    assert.deepEqual([out.status, says.test(out.stderr)], [64, true], `${flags.join(" ")}: ${out.stderr}`);
  }
  // As the repository stands, with no decision recorded, a scoring is refused and says what it would have run.
  if (!scoringDecided(readLedger()).ok) {
    const out = ask("--score", "one/plain-1");
    assert.deepEqual([out.status, out.stderr.includes(SCORING_RUNS_WHAT_A_SESSION_WROTE), out.stderr.includes("Nothing a session wrote was run.")], [64, true, true]);
  }
});

// ── the measures ─────────────────────────────────────────────────────────

/** A session's transcripts as the harness keeps them, written by hand: what the measures are read from. */
function fixture(top, sessionId) {
  const profile = join(top, "profile");
  const folder = join(profile, "projects", "-a-session-s-folder");
  const subs = join(folder, sessionId, "subagents");
  mkdirSync(subs, { recursive: true });
  let n = 0;
  const at = () => `2026-10-09T10:00:${String((n += 1)).padStart(2, "0")}.000Z`;
  const says = (id, model, usage, ...blocks) => JSON.stringify({ type: "assistant", timestamp: at(), message: { id, model, usage, content: blocks } });
  const use = (id, name, input) => ({ type: "tool_use", id, name, input });
  const back = (id, text, refused = false) => JSON.stringify({ type: "user", timestamp: at(), message: { content: [{ type: "tool_result", tool_use_id: id, is_error: refused, content: [{ type: "text", text }] }] } });
  const given = (attachment) => JSON.stringify({ type: "attachment", attachment });
  const used = (input, output, read = 0, made = 0) => ({ input_tokens: input, output_tokens: output, cache_read_input_tokens: read, cache_creation_input_tokens: made });
  const sonnet = "claude-sonnet-5-5";
  const lead = [
    given({ type: "skill_listing", names: [] }),
    given({ type: "deferred_tools_delta", addedNames: ["Glob", "mcp__grooph__grooph_plan", "mcp__grooph__grooph_note"] }),
    given({ type: "mcp_instructions_delta", addedNames: ["grooph"], addedBlocks: ["x".repeat(2048)] }),
    // One message written as two lines, each with the message's use so far: counted once, at the larger.
    says("m1", sonnet, used(10, 5, 100, 50), { type: "text", text: "SOMETHING THE SESSION SAID" }),
    says("m1", sonnet, used(10, 40, 100, 50), use("t1", "ToolSearch", { query: "select:mcp__grooph__grooph_plan" })),
    back("t1", "loaded"),
    says("m2", sonnet, used(4, 20), use("t2", "mcp__grooph__grooph_plan", { title: "Four packages", agents: [{ type: "general-purpose", count: 2, purpose: "one for each half" }] })),
    back("t2", "Plan recorded"),
    says("m3", sonnet, used(4, 30), use("t3", "Agent", { subagent_type: "general-purpose", run_in_background: true, model: "haiku", description: "A DESCRIPTION", prompt: "SECRET-PROMPT" }), use("t4", "Agent", { subagent_type: "Explore", prompt: "SECRET-PROMPT" })),
    back("t3", "done"),
    back("t4", "done"),
    // Shown in a result and named in no input: what `git status` says of the hook's events file.
    says("m4", sonnet, used(2, 8), use("t5", "Bash", { command: "git status --short" })),
    back("t5", "?? .grooph/events/\n M src/layer.mjs"),
    // Named in an input, refused, and the refusal does not show it.
    says("m5", sonnet, used(2, 8), use("t6", "Bash", { command: "cat .claude/settings.json" })),
    back("t6", "REFUSED BY A WALL", true),
    // Named in an input and shown in what came back: in both counts.
    says("m6", sonnet, used(2, 8), use("t7", "Read", { file_path: "/a/session's/folder/.grooph/hooks/grooph-event.mjs" })),
    back("t7", "// .grooph/hooks/grooph-event.mjs\nTHE HOOK'S OWN TEXT"),
    says("m7", sonnet, used(2, 8), use("t8", "mcp__grooph__grooph_note", { text: "Two subagents, one for each half." })),
    back("t8", "Noted."),
    // A tool of the server that is withheld, called all the same: it is counted, and it is not one of the two.
    says("m8", sonnet, used(2, 8), use("t9", "mcp__grooph__grooph_running", {})),
    back("t9", "No such tool", true),
    "{ a line that is not JSON",
  ];
  writeFileSync(join(folder, `${sessionId}.jsonl`), `${lead.join("\n")}\n`, "utf8");
  const sub = (id, meta, lines) => {
    writeFileSync(join(subs, `agent-${id}.jsonl`), `${lines.join("\n")}\n`, "utf8");
    if (meta) writeFileSync(join(subs, `agent-${id}.meta.json`), JSON.stringify(meta), "utf8");
  };
  // Asked for by its short name, answered by the full id the profile pins that name to.
  sub("aaa", { agentType: "general-purpose", description: "A DESCRIPTION", toolUseId: "t3", spawnDepth: 1, requestShape: "background", model: "haiku" }, [says("a1", "claude-haiku-4-5-20251001", used(3, 9, 7), use("s1", "Edit", { file_path: "src/layer.mjs" }), use("s2", "Agent", { subagent_type: "Explore", prompt: "SECRET-PROMPT", model: "sonnet" })), back("s1", "ok"), back("s2", "done")]);
  // A version that keeps neither its depth nor how it was asked for beside it: the tool use that started it is read.
  sub("bbb", { agentType: "Explore", toolUseId: "t4" }, [says("b1", sonnet, used(1, 2), use("s3", "Read", { file_path: "README.md" })), back("s3", "text")]);
  // Started by a subagent, and kept in a folder of its own under the session's.
  mkdirSync(join(folder, sessionId, "subagents", "deeper"), { recursive: true });
  writeFileSync(join(subs, "deeper", "agent-ccc.jsonl"), `${says("c1", sonnet, used(1, 1))}\n`, "utf8");
  writeFileSync(join(subs, "deeper", "agent-ccc.meta.json"), JSON.stringify({ agentType: "Explore", toolUseId: "s2" }), "utf8");
  // No file beside it at all.
  sub("ddd", null, [says("d1", sonnet, used(1, 1))]);
  // Another session's transcript in the same folder is not this one's.
  writeFileSync(join(folder, "another-session.jsonl"), `${says("x", "claude-opus-5-5", used(9, 9), use("x1", "Bash", { command: "ls .grooph" }))}\n`, "utf8");
  return profile;
}

test("the measures, read from a session's transcripts as the harness keeps them: names and counts, and one text", () => {
  const top = mkdtempSync(join(tmpdir(), "watching-measures-"));
  const sid = "11111111-2222-3333-4444-555555555555";
  try {
    const profile = fixture(top, sid);
    assert.deepEqual(transcriptsOf(profile, sid).map((t) => [t.lead, t.agent]), [[true, null], [false, "aaa"], [false, "bbb"], [false, "ddd"], [false, "ccc"]]);
    assert.deepEqual(transcriptsOf(profile, "no-such-session"), []);
    const output = { num_turns: 9, duration_ms: 61400, total_cost_usd: 0.4321, usage: { input_tokens: 30, output_tokens: 140, cache_read_input_tokens: 100, cache_creation_input_tokens: 50, iterations: [{ a: 1 }] }, modelUsage: { "claude-sonnet-5-5": { inputTokens: 26, outputTokens: 130, cacheReadInputTokens: 100, cacheCreationInputTokens: 50, costUSD: 0.4 }, "claude-haiku-4-5-20251001": { inputTokens: 3, outputTokens: 9, cacheReadInputTokens: 7, cacheCreationInputTokens: 0, costUSD: 0.0321 } }, permission_denials: [{ tool_name: "Bash", tool_use_id: "t6", tool_input: { command: "A COMMAND THE HARNESS DENIED" } }], subagent_stats: { spawned: 4, requested: { background: 1, foreground: 0, unset: 3 }, max_depth: 2, by_type: { "general-purpose": 1, Explore: 2 } } };
    const m = measure({ profile, sessionId: sid, output, wallS: 75 });
    assert.deepEqual([m.transcripts, m.the_sessions_transcript_found], [5, true]);

    // The session: turns, tool calls by name, minutes, tokens and the cost the harness reports.
    assert.equal(m.session.turns_as_the_harness_reports, 9);
    assert.equal(m.session.messages, 8, "a message written as two lines is one message");
    assert.deepEqual(m.session.tool_calls, { Agent: 2, Bash: 2, Read: 1, ToolSearch: 1, mcp__grooph__grooph_note: 1, mcp__grooph__grooph_plan: 1, mcp__grooph__grooph_running: 1 });
    assert.deepEqual(m.session.tool_calls_with_its_subagents, { Agent: 3, Bash: 2, Edit: 1, Read: 2, ToolSearch: 1, mcp__grooph__grooph_note: 1, mcp__grooph__grooph_plan: 1, mcp__grooph__grooph_running: 1 });
    assert.deepEqual([m.session.tool_calls_that_came_back_as_errors, m.session.calls_the_harness_reports_it_denied], [{ Bash: 1, mcp__grooph__grooph_running: 1 }, { Bash: 1 }], "a refused call is counted by its tool's name");
    assert.deepEqual([m.session.minutes_by_the_runners_clock, m.session.seconds_as_the_harness_reports, m.session.cost_usd_as_the_harness_reports], [1.25, 61, 0.4321]);
    assert.deepEqual(m.session.tokens_as_the_harness_reports, { input_tokens: 30, output_tokens: 140, cache_creation_input_tokens: 50, cache_read_input_tokens: 100 });
    assert.deepEqual(m.session.tokens_by_model_as_the_harness_reports["claude-haiku-4-5-20251001"], { input: 3, output: 9, cache_read: 7, cache_creation: 0, cost_usd: 0.0321 });
    assert.deepEqual(m.session.tokens_in_its_transcript, { input_tokens: 28, output_tokens: 130, cache_creation_input_tokens: 50, cache_read_input_tokens: 100 }, "the first message counted once, at its larger use");

    // The subagents: how many, of which types, on which models, how deep, asked for in the foreground or the background.
    assert.equal(m.subagents.count, 4);
    assert.deepEqual(m.subagents.ids, ["aaa", "bbb", "ddd", "ccc"]);
    assert.deepEqual(m.subagents.by_type, { Explore: 2, "general-purpose": 1, "not said": 1 });
    assert.deepEqual(m.subagents.by_model_that_answered, { "claude-haiku-4-5-20251001": 1, "claude-sonnet-5-5": 3 });
    assert.deepEqual(m.subagents.by_model_asked_for, { haiku: 1, "none named": 2, sonnet: 1 });
    assert.deepEqual([m.subagents.deepest, m.subagents.asked_for], [2, { background: 1, "not said": 3 }]);
    assert.deepEqual(m.subagents.as_the_harness_counts, output.subagent_stats, "and the harness's own count of them is kept beside what the transcripts show");
    const [a, b, d, c] = m.subagents.each;
    // The short name that was asked for and the model that answered are two things, and both are kept.
    assert.deepEqual([a.type, a.model_asked_for, a.model_asked_for_from, a.models_that_answered], ["general-purpose", "haiku", "the file beside its transcript", ["claude-haiku-4-5-20251001"]]);
    assert.deepEqual([a.depth, a.depth_from, a.asked_for, a.asked_for_from], [1, "the file beside its transcript", "background", "the file beside its transcript"]);
    assert.deepEqual([a.messages, a.tool_calls, a.tokens], [1, { Agent: 1, Edit: 1 }, { input_tokens: 3, output_tokens: 9, cache_creation_input_tokens: 0, cache_read_input_tokens: 7 }]);
    assert.deepEqual([b.type, b.model_asked_for, b.models_that_answered, b.depth, b.depth_from, b.asked_for], ["Explore", null, ["claude-sonnet-5-5"], 1, "the tool use that started it", "not said"], "with nothing beside its transcript but what started it, that is read");
    assert.deepEqual([c.type, c.depth, c.depth_from, c.model_asked_for, c.model_asked_for_from], ["Explore", 2, "the tool use that started it", "sonnet", "the tool use that started it"], "a subagent a subagent started is one deeper");
    assert.deepEqual([d.type, d.depth, d.depth_from, d.asked_for, d.model_asked_for], ["not said", null, null, "not said", null], "what no file says is not guessed");

    // The footprint: two counts, kept apart. Named in what a call asked; shown in what came back.
    assert.deepEqual(m.footprint.named_in_the_input, { calls: 2, by_tool: { Bash: 1, Read: 1 }, of_them_refused: 1 });
    assert.deepEqual(m.footprint.shown_in_the_result, { calls: 2, by_tool: { Bash: 1, Read: 1 } }, "git status listing the hook's events file is one of them, though its input names nothing");
    assert.equal(m.footprint.in_both, 1);

    // What the harness put in front of the model, by name.
    assert.deepEqual(m.given.tools_of_a_server_named_to_it, ["mcp__grooph__grooph_note", "mcp__grooph__grooph_plan"]);
    assert.deepEqual(m.given.servers_whose_instructions_it_was_handed, ["grooph"]);
    assert.deepEqual(m.given.instructions_it_was_handed, [{ characters: 2048, of_the_two_tools_it_names: [] }], "how much of the server's own instructions reached it, and whether that names either tool");
    assert.deepEqual(m.given.entries_of_what_it_was_given, { deferred_tools_delta: 1, mcp_instructions_delta: 1, skill_listing: 1 });

    // The two tools: whether either was called, how many times, and what was said. That text is kept.
    assert.deepEqual([m.the_two_tools.either_called, m.the_two_tools.calls, m.the_two_tools.refused, m.the_two_tools.searches_for_a_tool], [true, { grooph_plan: 1, grooph_note: 1 }, 0, 1]);
    assert.deepEqual(m.the_two_tools.other_tools_of_a_server_called, { mcp__grooph__grooph_running: 1 });
    assert.deepEqual(m.the_two_tools.said.map((said) => [said.tool, said.by, said.refused]), [["grooph_plan", "the session", false], ["grooph_note", "the session", false]]);
    assert.deepEqual(m.the_two_tools.said[0].input, { title: "Four packages", agents: [{ type: "general-purpose", count: 2, purpose: "one for each half" }] });
    assert.deepEqual(m.the_two_tools.said[1].input, { text: "Two subagents, one for each half." });

    // Names and counts only: nothing a call said, nothing that came back, nothing a session said or handed a subagent.
    const whole = JSON.stringify(m);
    for (const text of ["SECRET-PROMPT", "A DESCRIPTION", "A COMMAND THE HARNESS DENIED", "git status", "cat .claude", "REFUSED BY A WALL", "THE HOOK'S OWN TEXT", "SOMETHING THE SESSION SAID", "src/layer.mjs", "select:"]) assert.ok(!whole.includes(text), `${text} is not kept`);

    // A session with no transcript, and one that used nothing: counted as what they are.
    const none = measure({ profile, sessionId: "no-such-session" });
    assert.deepEqual([none.transcripts, none.the_sessions_transcript_found, none.session.messages, none.subagents.count, none.subagents.deepest, none.the_two_tools.either_called, none.footprint.named_in_the_input.calls], [0, false, null, 0, null, false, 0]);
    assert.deepEqual(measure({ profile, sessionId: "another-session" }).footprint.named_in_the_input, { calls: 1, by_tool: { Bash: 1 }, of_them_refused: 0 });
  } finally {
    rmSync(top, { recursive: true, force: true });
  }
});

test("the hook's own file set beside the transcripts: a subagent with no start line, a start with no stop, a line for a subagent never started", () => {
  const top = mkdtempSync(join(tmpdir(), "watching-hook-"));
  const sid = "11111111-2222-3333-4444-555555555555";
  try {
    const events = join(top, "events");
    mkdirSync(events);
    const line = (event, more = {}) => JSON.stringify({ v: 1, t: "2026-10-09T10:00:00.000Z", harness: "claude-code", event, session: sid, ...more });
    writeFileSync(
      join(events, `${sid}.jsonl`),
      `${[
        line("session-start", { cwd: "/a/folder" }),
        line("turn-start"),
        line("subagent-start", { agent: "aaa", type: "general-purpose" }),
        line("tool", { tool: "Agent", spawned: "aaa" }),
        line("subagent-start", { agent: "bbb", type: "Explore" }),
        line("subagent-stop", { agent: "aaa", type: "general-purpose", transcript: "/a/path" }),
        // A stop the harness fires for a helper of its own: an agent and no type, and no transcript.
        line("subagent-stop", { agent: "zzz" }),
        // A start for a subagent no transcript knows.
        line("subagent-start", { agent: "qqq", type: "Explore" }),
        line("turn-end"),
        "{ cut short",
        "7",
      ].join("\n")}\n`,
      "utf8",
    );
    writeFileSync(join(events, `said-${sid}.jsonl`), `${line("note", { text: "a note" })}\n`, "utf8");
    const seen = hookBesideTranscripts({ eventsDir: events, sessionId: sid, subagentIds: ["aaa", "bbb", "ccc", "ddd"] });
    assert.deepEqual([seen.the_hook_wrote_a_file_for_this_session, seen.files_in_its_folder, seen.a_file_of_what_was_said, seen.lines, seen.lines_that_are_not_events], [true, 2, true, 9, 2]);
    assert.deepEqual(seen.by_event, { "session-start": 1, "subagent-start": 3, "subagent-stop": 2, tool: 1, "turn-end": 1, "turn-start": 1 });
    assert.deepEqual([seen.subagents_in_the_transcripts, seen.subagent_starts_in_the_hooks_file, seen.subagent_stops_in_the_hooks_file], [4, 3, 2]);
    assert.equal(seen.started_by_the_harness_with_no_start_line, 2, "ccc and ddd have a transcript and no start line");
    assert.equal(seen.starts_with_no_stop, 2, "bbb and qqq started, by the hook's file, and never stopped");
    assert.deepEqual(seen.lines_for_a_subagent_never_started, { subagents: 1, lines: 1 }, "qqq, which no transcript knows");
    assert.deepEqual([seen.lines_that_name_an_agent_and_no_type.agents, seen.lines_that_name_an_agent_and_no_type.lines], [1, 1], "the harness's own helper is counted apart, not as a subagent the session started");
    // A hook that wrote nothing: every subagent the harness started has no start line, and that is what is said.
    const silent = hookBesideTranscripts({ eventsDir: join(top, "no-such-folder"), sessionId: sid, subagentIds: ["aaa"] });
    assert.deepEqual([silent.the_hook_wrote_a_file_for_this_session, silent.lines, silent.started_by_the_harness_with_no_start_line, silent.starts_with_no_stop], [false, 0, 1, 0]);
    assert.equal(hookBesideTranscripts({ eventsDir: null, sessionId: sid, subagentIds: [] }).the_hook_wrote_a_file_for_this_session, false);
  } finally {
    rmSync(top, { recursive: true, force: true });
  }
});

test("the digest a record keeps is names: no command, no file, no prompt a subagent was handed", () => {
  const digest = [{ who: "lead", transcript: "s.jsonl", description: null, models: ["claude-sonnet-5-5"], started: "a", ended: "b", assistant_messages: 2, tool_uses: [{ tool: "Bash", at: "a", command: "cat secrets.txt > out.txt", writes: ["out.txt"] }, { tool: "Read", at: "a", file: "src/x.mjs", error: "File is closed" }, { tool: "Agent", at: "b", subagent_type: "Explore", model: "haiku", description: "A DESCRIPTION", prompt: "SECRET-PROMPT" }] }];
  assert.deepEqual(namesOnly(digest), [{ who: "lead", transcript: "s.jsonl", models: ["claude-sonnet-5-5"], started: "a", ended: "b", assistant_messages: 2, tool_uses: [{ tool: "Bash", at: "a", refused: false }, { tool: "Read", at: "a", refused: true }, { tool: "Agent", at: "b", refused: false, subagent_type: "Explore", model: "haiku" }] }]);
});

// ── a run, start to record, with a stand-in for the harness ──────────────

test("a dry run builds the folder, says what would be started and what would refuse it, and takes the folder away again", { skip: !built }, () => {
  const p = place({ uses: [] }, { decided: false, lines: [settled("watching/one/plain-1", 44)] });
  try {
    const stand = () => ({ claude: p.harness, refused: ["the first paid call has no record"] });
    const text = dryRun({ run: order()[5], home: p.home, ledgerPath: p.ledgerPath, stand, node: "/a/node" });
    assert.match(text, /^four\/invited-1\n/);
    assert.match(text, /would start, in .*\/work\/[0-9a-f]{8}\/packages:\n {2}\S*stand-in-harness -p <the prompt> --model claude-sonnet-5-5 --effort high --output-format json --max-budget-usd 6 --permission-mode dontAsk --allowedTools 'Edit\(\/\*\*\)' mcp__grooph__grooph_plan mcp__grooph__grooph_note --strict-mcp-config --mcp-config '\{"mcpServers":\{"grooph":\{"command":"\/a\/node","args":\[".*\/packages\/cli\/bin\/grooph\.js","mcp","--dir",".*\/packages"\]\}\}\}' --setting-sources user,project --no-chrome --disable-slash-commands --session-id '<a new id>' --disallowedTools 'Edit\(\/\/.*\/packages\/\.grooph\/hooks\)' 'Edit\(\/\/.*\/packages\/\.grooph\/hooks\/\*\*\)' mcp__grooph__grooph_running /);
    assert.ok(text.includes(promptFor(order()[5]).replace(/^/gm, "  | ")), "the prompt is shown whole");
    assert.match(text, /the watchdog: \$6\.00 and 40 minutes; the ledger has counted \$44\.00 of \$45\.00/);
    assert.match(text, /a paid run would be refused:\n {2}- the first paid call has no record\n {2}- Scoring runs the repository's unseen suites .*\n {2}- the watching check has counted \$44\.00 on its ledger, and this run may cost up to \$6\.00/);
    assert.match(text, /its own instructions are \d+ characters and first name one of the two tools at character \d+; the harness hands a session the first 2,048 of them at its start, by its documentation/);
    assert.match(text, /nothing was started\.$/);
    assert.deepEqual([readdirSync(p.at.work), p.ledger().invocations.length, existsSync(p.recordRoot)], [[], 1, false], "the folder is gone, no line was written, no record was made");
    const plain = dryRun({ run: order()[0], home: p.home, ledgerPath: p.ledgerPath, stand: () => ({ claude: p.harness, refused: [] }) });
    assert.match(plain, /the arm: plain: nothing of grooph is in the folder/);
    assert.ok(!/--mcp-config|mcp__|--disallowedTools|grooph/i.test(plain.split("the prompt,")[0].split("would start")[1]), "the plain arm's command names no server, withholds nothing, closes nothing, and holds nothing of grooph");
    assert.deepEqual(readdirSync(p.at.work), []);
  } finally {
    rmSync(p.top, { recursive: true, force: true });
  }
});

test("the three arms of one task, with a stand-in for the harness: built, started, recorded, measured, scored on the recorded decision", { skip: !built }, async () => {
  const solution = readFileSync(join(comparisons, "heterogeneous-critic", "reference", "solution", "src", "parse-ranges.mjs"), "utf8");
  const work = { tool: "Write", input: { file_path: "src/parse-ranges.mjs", content: "…" }, result: "ok", writes: { "src/parse-ranges.mjs": solution } };
  const p = place({ uses: [work], cost: 0.31, model: "claude-sonnet-5-5" });
  // Only `one` is run here: the order is the runner's, so the records of `four` are put in its way as already made.
  const skipFour = () => {
    const next = nextRun(p.recordRoot);
    if (next?.task !== "four") return;
    mkdirSync(join(p.recordRoot, next.task, `${next.arm}-${next.replicate}`), { recursive: true });
    writeFileSync(join(p.recordRoot, next.task, `${next.arm}-${next.replicate}`, "result.json"), JSON.stringify({ ended_by: "the session" }), "utf8");
  };
  const record = (done, name) => JSON.parse(readFileSync(join(done.recordDir, name), "utf8"));
  try {
    // ── plain ──
    const plain = await runOne(p.common);
    assert.equal(plain.run.name, "one/plain-1");
    assert.deepEqual([plain.result.ended_by, plain.result.problems, plain.result.scored, plain.result.scored_outside_the_sandbox_on], ["the session", [], true, DECISION]);
    assert.deepEqual(plain.score.packages.map((pkg) => [pkg.package, pkg.folder, pkg.passed, pkg.cases, pkg.scored_from]), [["printkit", ".", 70, 70, "experiments/comparisons/heterogeneous-critic/held-out"]], "the reference solution, scored from the repository's own suite");
    const { the_runners_checkout: checkedOut, ...givenPlain } = plain.result.given;
    assert.deepEqual(givenPlain, { the_prompt_ends_with: [SUBAGENTS_SENTENCE], hook_installed: [], closed_to_the_session: [], server: null });
    assert.ok((checkedOut.commit === null || /^[0-9a-f]{40}$/.test(checkedOut.commit)) && Number.isInteger(checkedOut.files_changed_since_it), "the record says which commit of this repository made the run");
    assert.equal(checkedOut.grooph_version, JSON.parse(readFileSync(join(root, "packages", "cli", "package.json"), "utf8")).version);
    assert.equal(plain.result.the_hooks_file_beside_the_transcripts, null);
    assert.deepEqual([plain.result.measures.subagents.count, plain.result.measures.session.tool_calls, plain.result.measures.session.cost_usd_as_the_harness_reports, plain.result.measures.the_two_tools.either_called], [0, { Write: 1 }, 0.31, false]);
    assert.deepEqual([plain.result.measures.footprint.named_in_the_input.calls, plain.result.measures.footprint.shown_in_the_result.calls], [0, 0]);
    assert.deepEqual([plain.result.measures.given.tools_of_a_server_named_to_it, plain.result.measures.given.servers_whose_instructions_it_was_handed, plain.result.measures.given.instructions_it_was_handed], [[], [], []], "by the harness's own record, the plain arm was named no server's tool and handed no server's instructions");
    // What the stand-in was started with: the profile's command for this model and ceiling, and nothing of a server or a wall.
    const flag = (args, name) => args[args.indexOf(name) + 1];
    let seen = p.seen();
    assert.deepEqual([flag(seen.args, "--model"), flag(seen.args, "--effort"), flag(seen.args, "--max-budget-usd"), flag(seen.args, "--allowedTools"), flag(seen.args, "--setting-sources")], ["claude-sonnet-5-5", "high", "2", "Edit(/**)", "user,project"]);
    assert.equal(seen.args[1], promptFor(plain.run), "the prompt it was given is the run's");
    assert.ok(!seen.args.includes("--mcp-config") && !seen.args.includes("--disallowedTools"), "no server, nothing withheld, nothing closed");
    assert.ok(!seen.args.some((arg) => /grooph/i.test(arg)), "and no argument of the plain arm's command names grooph");
    assert.ok(!seen.environment.some((name) => /GROOPH/i.test(name)), "and nothing of grooph in its environment");
    assert.deepEqual(readdirSync(plain.recordDir).sort(), ["claude-output.json", "claude-stderr.txt", "loaded.txt", "project.diff", "prompt.md", "result.json", "score.json", "settings.json", "transcript-digest.json"]);
    assert.equal(readFileSync(join(plain.recordDir, "prompt.md"), "utf8"), promptFor(plain.run));
    assert.deepEqual(record(plain, "settings.json").sandbox.filesystem.denyWrite, []);
    assert.deepEqual(record(plain, "transcript-digest.json")[0].tool_uses, [{ tool: "Write", at: "2026-10-05T00:00:00.000Z", refused: false }], "the digest is names: not the file a call named");
    assert.match(readFileSync(join(plain.recordDir, "project.diff"), "utf8"), /src\/parse-ranges\.mjs/);
    const [line] = p.ledger().invocations;
    assert.deepEqual([line.run, line.status, line.cost_usd, line.max_budget_usd, line.session_id], ["watching/one/plain-1", "ok", 0.31, 2, plain.result.session_id]);
    assert.match(line.note, /the watching check: one, plain; the driver's go: the driver said: run the watching check; ended by the session/);
    assert.deepEqual([readdirSync(p.at.work), existsSync(join(plain.kept, "work", "printkit", "src", "parse-ranges.mjs"))], [[], true], "the folder was moved aside, and the next starts with the work folder empty");
    assert.equal(waitsForAPerson(plain), null);
    assert.equal(stateOf(plain.run, p.recordRoot).state, "recorded and scored");
    skipFour();

    // ── watched ── The session started a subagent, ran git status, and the hook wrote its file as the harness would have had it.
    const hook = (event, more = {}) => `${JSON.stringify({ v: 1, t: "2026-10-09T10:00:00.000Z", harness: "claude-code", event, session: "<session>", ...more })}\n`;
    const agentUse = { tool: "Agent", input: { subagent_type: "general-purpose", description: "A DESCRIPTION", prompt: "SECRET-PROMPT", model: "haiku" }, result: "done", meta: { toolUseId: "<use>", spawnDepth: 1, requestShape: "background", model: "haiku" }, subagent_uses: [{ tool: "Edit", input: { file_path: "src/parse-ranges.mjs" }, result: "ok" }], writes: { ".grooph/events/<session>.jsonl": hook("session-start", { cwd: "/a/folder" }) + hook("subagent-start", { agent: "1", type: "general-purpose" }) + hook("tool", { tool: "Agent", spawned: "1" }) + hook("subagent-stop", { agent: "1", type: "general-purpose" }) + hook("turn-end") } };
    const looked = { tool: "Bash", input: { command: "git status --short" }, result: "?? .grooph/events/\n?? src/parse-ranges.mjs" };
    p.setPlan({ uses: [work, agentUse, looked], cost: 0.4, model: "claude-sonnet-5-5", sub_model: "claude-haiku-4-5-20251001" });
    const watched = await runOne(p.common);
    assert.equal(watched.run.name, "one/watched-1");
    assert.deepEqual([watched.result.ended_by, watched.result.problems, watched.score.packages[0].passed], ["the session", [], 70]);
    assert.deepEqual({ ...watched.result.given, the_runners_checkout: null }, { the_runners_checkout: null, the_prompt_ends_with: [SUBAGENTS_SENTENCE], hook_installed: HOOK_FILES, closed_to_the_session: [".grooph/hooks"], server: null });
    seen = p.seen();
    assert.equal(seen.args[1], promptFor(plain.run), "the watched arm's prompt is the plain arm's, to the letter");
    assert.ok(!seen.args.includes("--mcp-config"));
    const closedAt = seen.args.indexOf("--disallowedTools");
    assert.deepEqual(seen.args.slice(closedAt + 1).map((rule) => rule.replace(/\/\/.*\/printkit\//, "//<the folder>/")), ["Edit(//<the folder>/.grooph/hooks)", "Edit(//<the folder>/.grooph/hooks/**)"], "the hook's folder is closed to the file tools, and nothing else is");
    assert.deepEqual(record(watched, "settings.json").sandbox.filesystem.denyWrite.map((path) => path.replace(/^.*\/printkit\//, "")), [".grooph/hooks"], "and to commands, in the settings the session ran under");
    assert.deepEqual(JSON.parse(readFileSync(join(p.at.profile, "settings.json"), "utf8")), settingsFor({ home: p.home }), "which are the repository's again afterwards");
    // The hook's own file is kept, and set beside the transcripts.
    assert.deepEqual(readdirSync(join(watched.recordDir, "events")), [`${watched.result.session_id}.jsonl`]);
    const beside = watched.result.the_hooks_file_beside_the_transcripts;
    assert.deepEqual([beside.the_hook_wrote_a_file_for_this_session, beside.lines, beside.subagents_in_the_transcripts, beside.started_by_the_harness_with_no_start_line, beside.starts_with_no_stop, beside.lines_for_a_subagent_never_started], [true, 5, 1, 0, 0, { subagents: 0, lines: 0 }]);
    assert.ok(!readFileSync(join(watched.recordDir, "project.diff"), "utf8").includes(".grooph/events"), "the events are kept as their own files, not in the project's change");
    // The measures: the subagent's model as asked for and as it answered, and the two counts of the footprint.
    const sub = watched.result.measures.subagents;
    assert.deepEqual([sub.count, sub.by_type, sub.by_model_asked_for, sub.by_model_that_answered, sub.deepest, sub.asked_for], [1, { "general-purpose": 1 }, { haiku: 1 }, { "claude-haiku-4-5-20251001": 1 }, 1, { background: 1 }]);
    assert.deepEqual([sub.each[0].model_asked_for, sub.each[0].models_that_answered, sub.each[0].tool_calls], ["haiku", ["claude-haiku-4-5-20251001"], { Edit: 1 }]);
    assert.deepEqual([watched.result.measures.footprint.named_in_the_input.calls, watched.result.measures.footprint.shown_in_the_result], [0, { calls: 1, by_tool: { Bash: 1 } }], "git status showed the events file, and no call named it");
    const kept = readFileSync(join(watched.recordDir, "result.json"), "utf8") + readFileSync(join(watched.recordDir, "transcript-digest.json"), "utf8");
    for (const text of ["SECRET-PROMPT", "A DESCRIPTION", "git status"]) assert.ok(!kept.includes(text), `${text} is not kept in the result or the digest`);
    assert.equal(p.ledger().invocations.at(-1).run, "watching/one/watched-1");
    skipFour();

    // ── invited ── The session said what it intended through the two tools.
    const planned = { tool: "mcp__grooph__grooph_plan", input: { title: "Page ranges", agents: [{ type: "general-purpose", purpose: "the tests" }] }, result: "Plan recorded" };
    const noted = { tool: "mcp__grooph__grooph_note", input: { text: "One subagent for the tests." }, result: "Noted.", writes: { ".grooph/events/said-<session>.jsonl": hook("note", { text: "One subagent for the tests." }) } };
    p.setPlan({ uses: [planned, agentUse, noted, work], cost: 0.5, model: "claude-sonnet-5-5", servers: ["grooph"], deferred: ["mcp__grooph__grooph_plan", "mcp__grooph__grooph_note"] });
    const invited = await runOne({ ...p.common, node: "/a/node" });
    assert.equal(invited.run.name, "one/invited-1");
    assert.deepEqual([invited.result.ended_by, invited.result.problems, invited.score.packages[0].passed], ["the session", [], 70]);
    seen = p.seen();
    assert.equal(seen.args[1], `${promptFor(plain.run)}\n${INVITATION}\n`);
    const allowedAt = seen.args.indexOf("--allowedTools");
    assert.deepEqual(seen.args.slice(allowedAt + 1, allowedAt + 4), ["Edit(/**)", "mcp__grooph__grooph_plan", "mcp__grooph__grooph_note"], "the two tools are allowed, and nothing else is added");
    const server = JSON.parse(flag(seen.args, "--mcp-config"));
    assert.deepEqual(Object.keys(server.mcpServers), ["grooph"]);
    assert.deepEqual([server.mcpServers.grooph.command, server.mcpServers.grooph.args.slice(0, 3)], ["/a/node", [CLI, "mcp", "--dir"]]);
    assert.match(server.mcpServers.grooph.args[3], /\/work\/[0-9a-f]{8}\/printkit$/, "the server is given the session's own folder");
    const denied = seen.args.slice(seen.args.indexOf("--disallowedTools") + 1);
    const every = serverOffers(p.top).tools.map((name) => `mcp__grooph__${name}`);
    assert.deepEqual(denied.filter((rule) => rule.startsWith("mcp__")).sort(), every.filter((name) => !["mcp__grooph__grooph_plan", "mcp__grooph__grooph_note"].includes(name)).sort(), "every other tool of the server is withheld, by a bare name");
    assert.equal(denied.filter((rule) => rule.startsWith("Edit(")).length, 2, "and the hook's folder is closed as in the watched arm");
    assert.deepEqual([invited.result.given.server.tools_allowed, invited.result.given.server.tools_withheld.length, invited.result.given.the_prompt_ends_with], [["mcp__grooph__grooph_plan", "mcp__grooph__grooph_note"], every.length - 2, [SUBAGENTS_SENTENCE, INVITATION]]);
    assert.ok(invited.result.given.server.its_own_instructions.characters > 0);
    // Whether either tool was called, how many times, and what was said: kept, as the session's own statement.
    const two = invited.result.measures.the_two_tools;
    assert.deepEqual([two.either_called, two.calls, two.other_tools_of_a_server_called], [true, { grooph_plan: 1, grooph_note: 1 }, {}]);
    assert.deepEqual(two.said.map((said) => [said.tool, said.by, said.input]), [["grooph_plan", "the session", planned.input], ["grooph_note", "the session", noted.input]]);
    assert.deepEqual([invited.result.measures.given.tools_of_a_server_named_to_it, invited.result.measures.given.servers_whose_instructions_it_was_handed], [["mcp__grooph__grooph_note", "mcp__grooph__grooph_plan"], ["grooph"]]);
    assert.deepEqual(readdirSync(join(invited.recordDir, "events")).sort(), [`${invited.result.session_id}.jsonl`, `said-${invited.result.session_id}.jsonl`].sort());
    assert.equal(invited.result.the_hooks_file_beside_the_transcripts.a_file_of_what_was_said, true);
    assert.deepEqual(p.ledger().invocations.map((entry) => entry.run), ["watching/one/plain-1", "watching/one/watched-1", "watching/one/invited-1"]);
    assert.deepEqual(readdirSync(p.at.work), []);
    skipFour();

    // ── a run the harness ended is recorded, not scored, and stops what comes after it; it is made once more, once ──
    p.setPlan({ no_output: true });
    const dead = await runOne(p.common);
    assert.equal(dead.run.name, "one/plain-2");
    assert.deepEqual([dead.result.ended_by, dead.score, dead.result.scored, existsSync(join(dead.recordDir, "score.json"))], ["the harness", null, false, false]);
    assert.equal(waitsForAPerson(dead), "the harness ended it");
    assert.equal(stateOf(dead.run, p.recordRoot).state, "ended by the harness, and not yet run again");
    assert.throws(() => scoreKept({ name: "one/plain-2", ledger: p.ledger(), home: p.home, recordRoot: p.recordRoot }), /such a run is not scored/);
    await assert.rejects(runOne({ ...p.common, rerun: "one/plain-1" }), notStarted(/has no record the harness ended/));
    p.setPlan({ uses: [], cost: 0.2 });
    const again = await runOne({ ...p.common, rerun: "one/plain-2" });
    assert.ok(again.recordDir.endsWith(join("one", "plain-2-rerun")));
    assert.deepEqual([again.result.rerun_of, again.result.ended_by], ["one/plain-2", "the session"]);
    assert.match(again.result.rerun_because, /no result from the harness/, "the reason is written beside it");
    assert.match(p.ledger().invocations.at(-1).note, /the one rerun of a run the harness ended \(no result from the harness/);
    assert.equal(p.ledger().invocations.at(-1).run, "watching/one/plain-2-rerun");
    assert.ok(again.score.packages[0].passed < 70, "a folder with no work in it does not pass the suite");
    assert.deepEqual([stateOf(dead.run, p.recordRoot).state, stateOf(dead.run, p.recordRoot).from], ["recorded and scored", "its rerun"]);
    await assert.rejects(runOne({ ...p.common, rerun: "one/plain-2" }), notStarted(/was already run once more/));

    // A score that is not there is not a score of nothing: it can be made again from the packages the runner kept.
    rmSync(join(again.recordDir, "score.json"));
    assert.equal(stateOf(dead.run, p.recordRoot).state, "recorded, not scored");
    const rescored = scoreKept({ name: "one/plain-2-rerun", ledger: p.ledger(), home: p.home, recordRoot: p.recordRoot });
    assert.deepEqual([rescored.score.packages[0].passed, rescored.score.scored_afterwards_from, rescored.score.scored_outside_the_sandbox_on], [again.score.packages[0].passed, "the packages as the runner kept them", DECISION]);
    assert.throws(() => scoreKept({ name: "one/plain-2-rerun", ledger: p.ledger(), home: p.home, recordRoot: p.recordRoot }), /already scored/);
    assert.throws(() => scoreKept({ name: "nine/plain-1", ledger: p.ledger(), home: p.home, recordRoot: p.recordRoot }), /not a run of the watching check/);
    assert.throws(() => scoreKept({ name: "one/watched-2", ledger: p.ledger(), home: p.home, recordRoot: p.recordRoot }), /has no record/);
    assert.match(status({ ledgerPath: p.ledgerPath, recordRoot: p.recordRoot }), /one\/plain-2 +recorded and scored: ended by the session \(its rerun\); printkit \d+\/70/);
  } finally {
    rmSync(p.top, { recursive: true, force: true });
  }
});

test("the wide task, with a stand-in for the harness: four packages scored one by one, each by its own project's suite", { skip: !built }, async () => {
  const layer = readFileSync(join(comparisons, "review-gate-2", "reference", "solution", "src", "layer.mjs"), "utf8");
  // The session did one package's work, and made that package's own test command a program of its own. Only the
  // unseen suite is run: the package's own test command is not.
  const own = JSON.stringify({ name: "settingskit", type: "module", scripts: { test: "node -e \"require('node:fs').writeFileSync('run-by-the-scorer.txt', 'x')\"" } });
  const p = place({ uses: [{ tool: "Write", input: { file_path: "settingskit/src/layer.mjs" }, result: "ok", writes: { "settingskit/src/layer.mjs": layer, "settingskit/package.json": own } }], cost: 1.2, model: "claude-sonnet-5-5" });
  try {
    mkdirSync(join(p.recordRoot, "one", "plain-1"), { recursive: true });
    writeFileSync(join(p.recordRoot, "one", "plain-1", "result.json"), JSON.stringify({ ended_by: "the session" }), "utf8");
    const four = await runOne(p.common);
    assert.equal(four.run.name, "four/plain-1");
    assert.deepEqual(four.result.problems, []);
    assert.deepEqual(four.score.packages.map((pkg) => [pkg.package, pkg.folder, pkg.scored_from]), TASKS.four.packages.map((pkg) => [pkg.name, pkg.folder, `experiments/comparisons/${pkg.project}/held-out`]));
    assert.deepEqual(four.score.packages.map((pkg) => pkg.cases), [55, 88, 73, 62]);
    assert.equal(four.score.packages[0].passed, 55, "the one package whose work was done passes its suite");
    assert.ok(four.score.packages.slice(1).every((pkg) => pkg.passed < pkg.cases), "and the three with no work in them do not");
    assert.ok(!existsSync(join(four.kept, "work", "packages", "settingskit", "run-by-the-scorer.txt")), "a package's own test command, which a session can make anything, is not run by the scorer");
    assert.deepEqual([p.ledger().invocations[0].run, p.ledger().invocations[0].max_budget_usd], ["watching/four/plain-1", 6]);
    assert.equal(p.seen().args[p.seen().args.indexOf("--max-budget-usd") + 1], "6");
    assert.equal(p.seen().args[1], promptFor(four.run));

    // A package's folder that is gone, or is no longer a folder, is not run at all and passes nothing.
    const tree = mkdtempSync(join(tmpdir(), "watching-tree-"));
    try {
      for (const pkg of TASKS.four.packages.slice(0, 2)) cpSync(join(comparisons, pkg.project, "task"), join(tree, pkg.folder), { recursive: true });
      writeFileSync(join(tree, "csvline"), "a file where a folder was", "utf8");
      const partial = score({ run: { task: "four" }, cwd: tree, call: { ended_by: "the watchdog", which: "minutes" } });
      assert.deepEqual(partial.ending, { kind: "cut-off", reason: "ended by the watchdog (minutes)" }, "a run the watchdog cut off is scored as it stands, and marked");
      assert.deepEqual(partial.packages.map((pkg) => [pkg.package, pkg.ran, pkg.passed, pkg.cases]), [["settingskit", true, 0, 55], ["textwrap", true, 0, 88], ["csvline", false, 0, 73], ["semver-mini", false, 0, 62]]);
      assert.match(partial.packages[2].reason, /is not there, or is not a folder/);
    } finally {
      rmSync(tree, { recursive: true, force: true });
    }
  } finally {
    rmSync(p.top, { recursive: true, force: true });
  }
});

test("every run still to come, one at a time: it stops at the first run the harness ended and at the first refusal, and starts nothing after either", { skip: !built }, async () => {
  const inHand = (p, runs) => {
    for (const run of runs) {
      mkdirSync(join(p.recordRoot, run.name), { recursive: true });
      writeFileSync(join(p.recordRoot, run.name, "result.json"), JSON.stringify({ ended_by: "the session" }), "utf8");
    }
  };
  // The last three of the twelve, each in its turn, and then nothing is left to start.
  const p = place({ uses: [], cost: 0.2 });
  try {
    inHand(p, order().slice(0, 9));
    const told = [];
    const all = await runAll({ ...p.common, each: (done) => told.push(done.run.name) });
    assert.deepEqual([all.done.map((done) => done.run.name), all.stopped, told], [["four/watched-2", "one/invited-2", "four/invited-2"], null, ["four/watched-2", "one/invited-2", "four/invited-2"]]);
    assert.deepEqual(p.ledger().invocations.map((entry) => [entry.run, entry.max_budget_usd, entry.status]), [["watching/four/watched-2", 6, "ok"], ["watching/one/invited-2", 2, "ok"], ["watching/four/invited-2", 6, "ok"]]);
    assert.equal(nextRun(p.recordRoot), null);
    assert.deepEqual(await runAll(p.common), { done: [], stopped: null }, "with every run recorded there is nothing to start");
    await assert.rejects(runOne(p.common), notStarted(/every run of the watching check is recorded/));
    assert.equal(p.ledger().invocations.length, 3);
  } finally {
    rmSync(p.top, { recursive: true, force: true });
  }
  // A run the harness ended stops it: the run after is not started.
  const q = place({ no_output: true });
  try {
    inHand(q, order().slice(0, 10));
    const all = await runAll(q.common);
    assert.deepEqual([all.done.map((done) => done.run.name), all.stopped], [["one/invited-2"], { after: "one/invited-2", why: "the harness ended it", by_the_harness: true }]);
    assert.deepEqual([q.ledger().invocations.length, nextRun(q.recordRoot).name, readdirSync(q.at.work)], [1, "four/invited-2", []], "one line, and the next run still to come");
  } finally {
    rmSync(q.top, { recursive: true, force: true });
  }
  // A refusal stops it: the ledger had room for the first of the two and has none for the second.
  const r = place({ uses: [], cost: 0.2 }, { lines: [settled("watching/one/plain-1", 39.5)] });
  try {
    inHand(r, order().slice(0, 10));
    const told = [];
    await assert.rejects(runAll({ ...r.common, each: (done) => told.push(done.run.name) }), notStarted(/has counted \$39\.70 on its ledger, and this run may cost up to \$6\.00: together past the \$45\.00/));
    assert.deepEqual([told, r.ledger().invocations.length, nextRun(r.recordRoot).name, readdirSync(r.at.work)], [["one/invited-2"], 2, "four/invited-2", []], "what was done before the refusal was said, and nothing was started after it");
  } finally {
    rmSync(r.top, { recursive: true, force: true });
  }
});

test("called as the other runners call it, the profile's command is what it was: adding a server changed nothing for them", () => {
  // The first call's record is held against this checksum of the settings and the fixed part of the command. It is
  // the value it had before a run could name a server (computed on the branch's parent, 2026-10-09).
  assert.equal(profileFingerprint(), "0f740513e4dabd6b8939ffec6613a853455b10a5f6aac04a0dc699450982286e", "if the profile itself was changed on purpose, this line changes with it; a change to commandFor alone must not move it");
});
