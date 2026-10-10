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

import { commandFor, layout, PINS, settingsFor } from "./compare-profile.mjs";
import { DESIGN_WORDS, MECHANICS, deriveD } from "./compare-prompt.mjs";
import { scoreHeldOut } from "./compare-score.mjs";
import { scoringDecided } from "./roles-or-information-paid.mjs";
import { NotStarted, profileFingerprint } from "./study-three-paid.mjs";
import {
  ARMS,
  BLOCKS,
  build,
  CLI,
  CLOSED_IN_A_WATCHED_ARM,
  dryRun,
  folderLine,
  FOOTPRINT,
  FOUR_OPENS,
  heldUpBy,
  HOOK_FILES,
  hookBesideTranscripts,
  INVITATION,
  LEAD,
  LEDGER,
  LEFT_TO_THE_HARNESS,
  measure,
  namesOnly,
  nextRun,
  NotScored,
  OFFERED,
  order,
  promptFor,
  readLedger,
  recordOf,
  room,
  runAll,
  runOne,
  score,
  scoreKept,
  SCORING_RUNS_WHAT_A_SESSION_WROTE,
  serverOffers,
  sessionNode,
  settleLine,
  shortNamesIn,
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
  // `common` names no block, as a run made once more does not; `sonnet` is the same with the first block named.
  const common = { home, claude: harness, ledgerPath, recordRoot, profileCheck: () => [], gameOpen: [], go: "the driver said: run the watching check", grace: 300, firstCallGate: { ok: true, record: "record" } };
  return { top, home, at, harness, ledgerPath, recordRoot, common, sonnet: { ...common, block: "sonnet" }, setPlan, ledger: () => JSON.parse(readFileSync(ledgerPath, "utf8")), seen: () => JSON.parse(readFileSync(join(at.profile, "command-seen-by-the-stand-in.json"), "utf8")) };
}
const settled = (run, cost, more = {}) => ({ n: 1, run, project: run.split("/").slice(0, 3).join("/"), kind: "kickoff", status: "ok", cost_usd: cost, reported_cost_usd: cost, max_budget_usd: 6, started: "2026-10-09T00:00:00.000Z", ...more });
/** The twelve runs of one block, in their order. */
const blockOf = (block) => order().filter((run) => run.block === block);
/** Records put in the order's way as already made: a run with a result is a run that is recorded. */
function inHand(p, runs, result = { ended_by: "the session" }) {
  for (const run of runs) {
    mkdirSync(join(p.recordRoot, run.name), { recursive: true });
    writeFileSync(join(p.recordRoot, run.name, "result.json"), JSON.stringify(result), "utf8");
  }
}
/** The value after a flag in the command the stand-in was started with. */
const flagOf = (args, name) => args[args.indexOf(name) + 1];
/** What a record of this check says of the short names of a model: three pinned as the profile pins them, `haiku` left to the harness. */
const SHORT_NAMES = { pinned: { fable: "claude-opus-5-5", opus: "claude-opus-5-5", sonnet: "claude-sonnet-5-5" }, left_to_the_harness: ["haiku"], read_from: "the names of the variables the session was started with" };

// ── the protocol's own words ─────────────────────────────────────────────

test("the thirty-six runs: the twelve in the order the protocol gives, once for each block, each named with its block and recorded under it", () => {
  const twelve = ["one/plain-1", "four/plain-1", "one/watched-1", "four/watched-1", "one/invited-1", "four/invited-1", "one/plain-2", "four/plain-2", "one/watched-2", "four/watched-2", "one/invited-2", "four/invited-2"];
  // The blocks in the page's order, and the twelve whole in each before the next begins.
  assert.ok(page.includes("the order is `sonnet`, `opus`, `haiku`"));
  assert.deepEqual(BLOCKS, ["sonnet", "opus", "haiku"]);
  assert.deepEqual(
    order().map((run) => run.name),
    ["sonnet", "opus", "haiku"].flatMap((block) => twelve.map((name) => `${block}/${name}`)),
  );
  assert.ok(page.includes("\nThirty-six runs. "));
  assert.deepEqual([order().length, new Set(order().map((run) => run.name)).size], [36, 36]);
  assert.deepEqual([order()[0].name, order()[12].name, order()[17].name, order()[24].name, order()[35].name], ["sonnet/one/plain-1", "opus/one/plain-1", "opus/four/invited-1", "haiku/one/plain-1", "haiku/four/invited-2"]);
  // The page's own sentence, read from the page: the first six in its words, "then the same six again". In every block.
  const said = /in this order: (.+?); then the same six again\./.exec(page)[1];
  const six = said.split(", ").map((part) => /^`(\w+)` (\w+)$/.exec(part).slice(1)).map(([task, arm]) => `${task}/${arm}`);
  for (const block of BLOCKS) {
    assert.equal(blockOf(block).length, 12, block);
    assert.deepEqual(blockOf(block).slice(0, 6).map((run) => `${run.task}/${run.arm}`), six, block);
    assert.deepEqual(blockOf(block).slice(6).map((run) => `${run.task}/${run.arm}`), six, block);
    assert.deepEqual(blockOf(block).map((run) => run.replicate), [1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 2, 2], block);
  }
  // A run's record: experiments/watching/<block>/<task>/<arm>-<n>, which is its name under the check's own folder.
  assert.equal(recordOf(order()[17]), join(root, "experiments", "watching", "opus", "four", "invited-1"));
  for (const run of order()) assert.deepEqual([recordOf(run, "/records"), run.name], [`/records/${run.block}/${run.task}/${run.arm}-${run.replicate}`, `${run.block}/${run.task}/${run.arm}-${run.replicate}`]);
  assert.equal(new Set(order().map((run) => recordOf(run, "/records"))).size, 36, "no two runs share a folder");
  const top = mkdtempSync(join(tmpdir(), "watching-order-"));
  try {
    assert.equal(nextRun(top).name, "sonnet/one/plain-1");
    assert.deepEqual(BLOCKS.map((block) => nextRun(top, block).name), ["sonnet/one/plain-1", "opus/one/plain-1", "haiku/one/plain-1"], "the next run of a block is the first of that block with no record");
    for (const name of ["sonnet/one/plain-1", "sonnet/four/plain-1"]) {
      mkdirSync(join(top, name), { recursive: true });
      writeFileSync(join(top, name, "result.json"), JSON.stringify({ ended_by: name.includes("/four/") ? "the harness" : "the session", why: "no result from the harness (exit 1)" }), "utf8");
    }
    assert.equal(nextRun(top).name, "sonnet/one/watched-1", "a run the harness ended does not hold up the order: it waits for its one rerun");
    assert.deepEqual([nextRun(top, "sonnet").name, nextRun(top, "opus").name], ["sonnet/one/watched-1", "opus/one/plain-1"]);
    assert.deepEqual([stateOf(order()[0], top).state, stateOf(order()[1], top).state, stateOf(order()[2], top).state], ["recorded, not scored", "ended by the harness, and not yet run again", "not recorded"]);
    // A record kept where the check as first written kept it, with no block above it, is no run's record.
    mkdirSync(join(top, "one", "watched-1"), { recursive: true });
    writeFileSync(join(top, "one", "watched-1", "result.json"), JSON.stringify({ ended_by: "the session" }), "utf8");
    assert.equal(nextRun(top).name, "sonnet/one/watched-1");
  } finally {
    rmSync(top, { recursive: true, force: true });
  }
});

test("the two sentences, the three models, the limits and the tasks are the page's, to the letter", () => {
  assert.ok(page.includes(`\n> ${SUBAGENTS_SENTENCE}\n`), "the sentence every prompt ends its task with");
  assert.ok(page.includes(`\n> ${INVITATION}\n`), "the invitation");
  // The three blocks and the model each one's session is asked for, from the page's own table: all at high effort.
  assert.ok(page.includes("Every session is headless (`claude -p`), at high effort, on one of three models (below)"));
  assert.ok(page.includes("| `sonnet` | Claude Sonnet 5.5 (`claude-sonnet-5-5`) |"));
  assert.ok(page.includes("| `opus` | Claude Opus 5.5 (`claude-opus-5-5`) |"));
  assert.ok(page.includes("| `haiku` | the harness's current Haiku, asked for by its short name |"));
  assert.deepEqual(LEAD, { sonnet: { model: "claude-sonnet-5-5", effort: "high" }, opus: { model: "claude-opus-5-5", effort: "high" }, haiku: { model: "haiku", effort: "high" } });
  assert.deepEqual(Object.keys(LEAD), BLOCKS);
  assert.deepEqual(page.match(/^\| `\w+` \|/gm).map((row) => /`(\w+)`/.exec(row)[1]), BLOCKS, "the table's rows are the blocks, in their order");
  assert.deepEqual(ARMS, ["plain", "watched", "invited"]);
  // The limits: the page's sentence, written out, and the same sentence made from the runner's numbers, so that neither moves without the other.
  const limits = "A run of `one` stops at 25 minutes and a run of `four` at 60, and at a dollar ceiling that goes by its block: $2.00 and $6.00 on `sonnet`, $5.00 and $15.00 on `opus`, $1.00 and $3.00 on `haiku`.";
  assert.ok(page.includes(limits));
  assert.equal(`A run of \`one\` stops at ${WATCHDOG.sonnet.one.minutes} minutes and a run of \`four\` at ${WATCHDOG.sonnet.four.minutes}, and at a dollar ceiling that goes by its block: ${BLOCKS.map((block) => `$${WATCHDOG[block].one.usd.toFixed(2)} and $${WATCHDOG[block].four.usd.toFixed(2)} on \`${block}\``).join(", ")}.`, limits);
  assert.deepEqual(WATCHDOG, {
    sonnet: { one: { usd: 2, minutes: 25 }, four: { usd: 6, minutes: 60 } },
    opus: { one: { usd: 5, minutes: 25 }, four: { usd: 15, minutes: 60 } },
    haiku: { one: { usd: 1, minutes: 25 }, four: { usd: 3, minutes: 60 } },
  });
  for (const block of BLOCKS) assert.deepEqual([WATCHDOG[block].one.minutes, WATCHDOG[block].four.minutes], [25, 60], `${block}: the minutes go by the task, the same in every block`);
  assert.ok(page.includes("The whole check stops at **$140.00** on a ledger of its own"));
  assert.equal(STOPS_AT_USD, 140);
  assert.ok(page.includes("The thirty-six ceilings add up to $192.00, more than the cap, on purpose"));
  assert.equal(order().reduce((sum, run) => sum + WATCHDOG[run.block][run.task].usd, 0), 192);
  // The one short name this check leaves to the harness, and the three the profile goes on pinning.
  assert.ok(page.includes("The profile pins what three short names mean (`opus` and `fable` to Opus 5.5, `sonnet` to Sonnet 5.5). For this check `haiku` is left to mean what the harness makes it mean"));
  assert.deepEqual(LEFT_TO_THE_HARNESS, ["haiku"]);
  assert.deepEqual(Object.fromEntries(Object.entries(PINS).filter(([short]) => !LEFT_TO_THE_HARNESS.includes(short))), { fable: "claude-opus-5-5", opus: "claude-opus-5-5", sonnet: "claude-sonnet-5-5" });
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

test("the watched arm's folder is the plain arm's and what grooph hooks install leaves, in the same one commit; the invited arm's folder is the watched arm's", { skip: !built }, async () => {
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
    // The whole of .grooph is closed to the session: the harness runs the hook outside the sandbox, and the hook makes
    // its events folder and appends to its file there with no check for a link.
    assert.deepEqual(CLOSED_IN_A_WATCHED_ARM, [".grooph"]);
    assert.deepEqual(watched.made.closed, [join(watched.cwd, ".grooph")]);
    for (const path of HOOK_FILES.filter((file) => file.startsWith(".grooph/"))) assert.ok(join(watched.cwd, path).startsWith(`${watched.made.closed[0]}/`), `${path} is inside what is closed`);
    assert.ok(join(watched.cwd, ".grooph", "events", "a-session.jsonl").startsWith(`${watched.made.closed[0]}/`), "and so is where the hook writes");
    assert.deepEqual([watched.made.server, watched.made.instructions], [null, null], "the watched arm attaches nothing");
    assert.equal(watched.made.prompt, plain.made.prompt);

    // The invited arm: the same files as the watched arm, to the byte. The server leaves nothing in the folder when it is asked what it offers.
    assert.deepEqual(invited.files, watched.files);
    assert.deepEqual(invited.tracked, watched.tracked);
    assert.deepEqual(invited.made.closed, [join(invited.cwd, ".grooph")]);
    assert.deepEqual(invited.made.server.mcp, { mcpServers: { grooph: { command: "/a/node", args: [CLI, "mcp", "--dir", invited.cwd] } } }, "this checkout's grooph mcp --dir <the session's folder>, and no other flag");
    assert.deepEqual(invited.made.server.allowed, ["mcp__grooph__grooph_plan", "mcp__grooph__grooph_note"]);
    // Every other tool the server lists is withheld, by its own list and not by one kept here.
    const offers = serverOffers(p.top);
    assert.deepEqual([...invited.made.server.allowed, ...invited.made.server.withheld].sort(), offers.tools.map((name) => `mcp__grooph__${name}`).sort(), "allowed and withheld are, together, every tool of the server");
    assert.ok(invited.made.server.withheld.includes("mcp__grooph__grooph_running") && invited.made.server.withheld.length === offers.tools.length - 2);
    assert.deepEqual(invited.made.instructions, offers.instructions);
    assert.ok(offers.instructions.characters > 0 && /^[0-9a-f]{64}$/.test(offers.instructions.sha256), "what the server says of itself to a harness is named in the record by its length and checksum");
    // The same, asked of the server's own code in this process and not of a process started for it.
    const { handle } = await import(join(root, "packages", "cli", "dist", "src", "mcp.js"));
    const said = (await handle({ jsonrpc: "2.0", id: 1, method: "initialize", params: {} }, { project: p.top, version: "0", harness: "claude-code", session: "s", now: () => new Date() })).result.instructions;
    assert.deepEqual(offers.instructions, { characters: said.length, sha256: createHash("sha256").update(said).digest("hex"), first_names_one_of_the_two_tools_at_character: Math.min(said.indexOf("grooph_plan"), said.indexOf("grooph_note")) }, "its length, its checksum, and where it first names one of the two tools");
    assert.ok(said.indexOf("grooph_plan") > 0 && said.indexOf("grooph_note") > 0, "the server's own instructions name both tools somewhere");
    assert.equal(invited.made.prompt, `${plain.made.prompt}\n${INVITATION}\n`);
    assert.deepEqual(readdirSync(p.at.work), [], "each folder was taken away again");
    // The server is started by node as a session's own path finds it: by its whole path where it is on that path, by its name where it is not.
    mkdirSync(join(p.top, "bin"));
    writeFileSync(join(p.top, "bin", "node"), "#!/bin/sh\n", { mode: 0o755 });
    assert.deepEqual([sessionNode(join(p.top, "bin")), sessionNode(join(p.top, "no-such-folder"))], [join(p.top, "bin", "node"), "node"]);
  } finally {
    rmSync(p.top, { recursive: true, force: true });
  }
});

// ── the ledger ───────────────────────────────────────────────────────────

test("the ledger as the repository keeps it: the protocol's cap and ceilings, read by the runner, and the decision on scoring", () => {
  const kept = readLedger();
  assert.equal(kept.cap_usd, 140);
  assert.deepEqual([kept.watchdog.sonnet, kept.watchdog.opus, kept.watchdog.haiku], [{ one: { usd: 2, minutes: 25 }, four: { usd: 6, minutes: 60 } }, { one: { usd: 5, minutes: 25 }, four: { usd: 15, minutes: 60 } }, { one: { usd: 1, minutes: 25 }, four: { usd: 3, minutes: 60 } }]);
  assert.deepEqual(Object.fromEntries(BLOCKS.map((block) => [block, kept.watchdog[block]])), WATCHDOG, "each block's limits, as the runner holds them");
  // The two numbers the paid path itself reads: the least that must be left is the smallest ceiling, the most one session is given the largest.
  assert.deepEqual([kept.refuse_below_usd, kept.per_invocation_ceiling_usd], [1, 15]);
  assert.ok(Array.isArray(kept.invocations));
  assert.deepEqual(Object.keys(kept.scoring_outside_the_sandbox), ["about", "decided_by", "on", "words"]);
  // This is the one line that has to change, on purpose and in the same commit, when the owner's decision is written down.
  assert.equal(scoringDecided(kept).ok, true, "the owner's decision of 2026-10-10 is recorded: yes");
  // A ledger that is not there, cannot be read, or states other limits than the protocol's is a refusal.
  const top = mkdtempSync(join(tmpdir(), "watching-ledger-"));
  try {
    const path = join(top, "ledger.json");
    assert.throws(() => readLedger(path), notStarted(/could not be read \(.*ENOENT\)/));
    writeFileSync(path, "{ not json", "utf8");
    assert.throws(() => readLedger(path), notStarted(/could not be read/));
    const inBlock = (block, task, limit) => ({ watchdog: { ...kept.watchdog, [block]: { ...kept.watchdog[block], [task]: limit } } });
    for (const [change, says] of [
      [{ cap_usd: 60 }, /its cap is 60, and the protocol's is 140/],
      [{ cap_usd: null }, /its cap is null/],
      // The check as first written, before any run: its cap, its minutes, and its limits by the task alone.
      [{ cap_usd: 45 }, /its cap is 45, and the protocol's is 140/],
      [inBlock("sonnet", "one", { usd: 2, minutes: 15 }), /its limits for a run of `one` in the `sonnet` block are \{"usd":2,"minutes":15\}, and the protocol's are \$2\.00 and 25 minutes/],
      [{ watchdog: { one: { usd: 2, minutes: 15 }, four: { usd: 6, minutes: 40 } } }, /its limits for a run of `one` in the `sonnet` block are null.*its limits for a run of `four` in the `haiku` block are null/],
      // One block's ceiling moved, a block given another's, a task gone from a block, a block gone.
      [inBlock("opus", "four", { usd: 20, minutes: 60 }), /its limits for a run of `four` in the `opus` block are \{"usd":20,"minutes":60\}, and the protocol's are \$15\.00 and 60 minutes/],
      [{ watchdog: { ...kept.watchdog, haiku: kept.watchdog.sonnet } }, /its limits for a run of `one` in the `haiku` block are \{"usd":2,"minutes":25\}, and the protocol's are \$1\.00 and 25 minutes; its limits for a run of `four` in the `haiku` block are \{"usd":6,"minutes":60\}, and the protocol's are \$3\.00 and 60 minutes/],
      [{ watchdog: { ...kept.watchdog, haiku: { one: kept.watchdog.haiku.one } } }, /its limits for a run of `four` in the `haiku` block are null/],
      [{ watchdog: { sonnet: kept.watchdog.sonnet, haiku: kept.watchdog.haiku } }, /its limits for a run of `one` in the `opus` block are null/],
      [{ invocations: null }, /it holds no list of invocations/],
      [{ per_invocation_ceiling_usd: 1 }, /the most it gives one session is 1, and the protocol's largest ceiling is 15/],
      [{ per_invocation_ceiling_usd: undefined }, /the most it gives one session is null/],
      [{ per_invocation_ceiling_usd: 6 }, /the most it gives one session is 6/],
      [{ per_invocation_ceiling_usd: 20 }, /the most it gives one session is 20/],
      [{ refuse_below_usd: 6 }, /it refuses below 6, and the protocol's smallest ceiling is 1/],
      [{ refuse_below_usd: 2 }, /it refuses below 2/],
      [{ refuse_below_usd: undefined }, /it refuses below null/],
      [{ invocations: [{ n: 1, status: "failed", cost_usd: null, max_budget_usd: null }] }, /its line 1 counts as no amount/],
      [{ invocations: [{ n: 2, status: "ok", cost_usd: -1, max_budget_usd: 2 }] }, /its line 2 counts as no amount/],
    ]) {
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
  const ledger = (lines) => ({ cap_usd: 140, invocations: lines });
  const done = (cost) => ({ status: "ok", cost_usd: cost, max_budget_usd: 15 });
  const open = (ceiling) => ({ status: "running", cost_usd: null, max_budget_usd: ceiling });
  const ceiling = (run) => WATCHDOG[run.block][run.task].usd;
  // The ceilings of the thirty-six add up to more than the cap. That is meant: the cap is what stops the check.
  assert.equal(order().reduce((sum, run) => sum + ceiling(run), 0), 192);
  assert.deepEqual(BLOCKS.map((block) => blockOf(block).reduce((sum, run) => sum + ceiling(run), 0)), [48, 120, 24], "six runs of each task in a block, at that block's two ceilings");
  assert.deepEqual([room(ledger([]), 15).ok, room(ledger([]), 15).left], [true, 140]);
  // Settled at what the harness reported, not at the ceiling it had: thirty-five cheap runs leave room for the thirty-sixth.
  assert.deepEqual([room(ledger(Array(35).fill(done(0.4))), 3).ok, Math.round(room(ledger(Array(35).fill(done(0.4))), 3).spent * 100) / 100], [true, 14]);
  // To the cent, for each of the six ceilings: room for exactly its ceiling is room; a cent less is not.
  assert.deepEqual([...new Set(order().map(ceiling))].sort((a, b) => a - b), [1, 2, 3, 5, 6, 15]);
  for (const usd of [1, 2, 3, 5, 6, 15]) {
    assert.equal(room(ledger([done(140 - usd)]), usd).ok, true, `$${usd}`);
    assert.equal(room(ledger([done(140 - usd + 0.01)]), usd).ok, false, `$${usd}, a cent short`);
  }
  assert.equal(room(ledger([done(125.01)]), 5).ok, true, "a run of `one` in the opus block still fits where a run of `four` does not");
  assert.equal(room(ledger([done(137.5)]), 1).ok, true, "and a run of `one` in the haiku block where no run of the opus block does");
  // An unsettled line counts at its ceiling, whatever it may turn out to have cost.
  assert.equal(room(ledger([done(120), open(15)]), 6).ok, false, "120 settled and 15 held for a run still open leave 5");
  assert.equal(room(ledger([done(119), open(15)]), 6).ok, true);
  assert.equal(room(ledger([done(120), { status: "failed", cost_usd: null, max_budget_usd: 15 }]), 6).ok, false, "a call that ended with no reported cost stays at its ceiling");
  assert.equal(room(ledger([done(120), { status: "failed", cost_usd: 0, max_budget_usd: 15 }]), 6).ok, true, "a harness that could not be started spent nothing");
  const refused = room(ledger([done(130.5)]), 15);
  assert.match(refused.why, /has counted \$130\.50 on its ledger, and this run may cost up to \$15\.00: together past the \$140\.00 at which the whole check stops/);
  // Were every run to cost its whole ceiling, the check would stop inside the opus block, at its tenth run: the
  // twenty-second of the thirty-six, with $133.00 counted and no room for the $15.00 it may cost.
  const atCeiling = [];
  const stopsAt = order().find((run) => !room(ledger(atCeiling), ceiling(run)).ok || (atCeiling.push(done(ceiling(run))), false));
  assert.deepEqual([stopsAt.name, atCeiling.length, room(ledger(atCeiling), 0).spent, room(ledger(atCeiling), ceiling(stopsAt)).left], ["opus/four/watched-2", 21, 133, 7]);

  // A paid run is refused by it before any folder is made, and no line is written; --status says so for the next run.
  const p = place({ uses: [], cost: 0.1 }, { lines: [settled("watching/sonnet/one/plain-1", 135.5)] });
  try {
    inHand(p, [order()[0]]);
    assert.equal(nextRun(p.recordRoot).name, "sonnet/four/plain-1");
    await assert.rejects(runOne(p.sonnet), notStarted(/has counted \$135\.50 on its ledger, and this run may cost up to \$6\.00: together past the \$140\.00 at which the whole check stops/));
    assert.deepEqual([readdirSync(p.at.work), p.ledger().invocations.length], [[], 1], "nothing was made and nothing was written");
    const said = status({ ledgerPath: p.ledgerPath, recordRoot: p.recordRoot });
    assert.match(said, /\$135\.50 counted of \$140\.00, in 1 line\(s\)/);
    assert.match(said, /next: sonnet\/four\/plain-1 \(started with --block sonnet\), which may cost up to \$6\.00\nTHE LEDGER HAS NO ROOM FOR IT, and it would be refused: the watching check has counted \$135\.50/);
    assert.match(status({ ledgerPath: p.ledgerPath, recordRoot: join(p.top, "no-records") }), /next: sonnet\/one\/plain-1 \(started with --block sonnet\), which may cost up to \$2\.00; the ledger has room for it \(\$4\.50 left\)/);
  } finally {
    rmSync(p.top, { recursive: true, force: true });
  }
  // The room a run needs is its own block's ceiling: with $10.00 left, a run of `four` in the opus block is refused
  // for want of $15.00, though a run of `four` in the sonnet block would have fitted.
  const q = place({ uses: [], cost: 0.1 }, { lines: [settled("watching/sonnet/one/plain-1", 130)] });
  try {
    inHand(q, [...blockOf("sonnet"), blockOf("opus")[0]]);
    assert.equal(nextRun(q.recordRoot, "opus").name, "opus/four/plain-1");
    await assert.rejects(runOne({ ...q.common, block: "opus" }), notStarted(/has counted \$130\.00 on its ledger, and this run may cost up to \$15\.00: together past the \$140\.00/));
    assert.deepEqual([readdirSync(q.at.work), q.ledger().invocations.length], [[], 1]);
    assert.match(status({ ledgerPath: q.ledgerPath, recordRoot: q.recordRoot }), /next: opus\/four\/plain-1 \(started with --block opus\), which may cost up to \$15\.00\nTHE LEDGER HAS NO ROOM FOR IT/);
    assert.equal(room(q.ledger(), WATCHDOG.sonnet.four.usd).ok, true);
  } finally {
    rmSync(q.top, { recursive: true, force: true });
  }
});

// ── the refusals ─────────────────────────────────────────────────────────

test("no run starts without the first call's yes, the owner's decision on scoring, the two flags, a ledger with the protocol's limits, and a profile that holds", async () => {
  const p = place({ uses: [], cost: 0.1 }, { decided: false });
  const nothingMade = (why) => assert.deepEqual([readdirSync(p.at.work), p.ledger().invocations, existsSync(p.recordRoot)], [[], [], false], why);
  try {
    // The first call's word comes first.
    await assert.rejects(runOne({ ...p.sonnet, firstCallGate: { ok: false, why: "the first paid call has no record" } }), notStarted(/the first paid call has no record/));
    // Then the decision on scoring: the whole run is refused, since a run that cannot be scored is not paid for.
    const sentence = (error) => error instanceof NotStarted && error.message.includes(SCORING_RUNS_WHAT_A_SESSION_WROTE) && /no decision of his is recorded \(experiments\/watching\/ledger\.json, scoring_outside_the_sandbox/.test(error.message);
    await assert.rejects(runOne(p.sonnet), sentence);
    assert.throws(() => scoreKept({ name: "sonnet/one/plain-1", ledger: p.ledger(), home: p.home, recordRoot: p.recordRoot }), (error) => error instanceof NotScored && error.message.includes(SCORING_RUNS_WHAT_A_SESSION_WROTE));
    nothingMade("refused before any folder is made");
    // A decision recorded for roles or information, in its own file, is not this check's: only the ledger's own fields are read.
    assert.match(SCORING_RUNS_WHAT_A_SESSION_WROTE, /runs the code the session wrote: outside the sandbox, with this account's rights/);
    const decided = { ...p.ledger(), scoring_outside_the_sandbox: DECISION };
    writeFileSync(p.ledgerPath, JSON.stringify(decided), "utf8");
    // The driver's words.
    await assert.rejects(runOne({ ...p.sonnet, go: undefined }), notStarted(/no word from the driver/));
    // The profile, a session of the game experiment, a work folder that is not empty.
    await assert.rejects(runOne({ ...p.sonnet, profileCheck: () => [{ what: "the profile is signed in", ok: false, how: "not signed in" }] }), notStarted(/the profile: the profile is signed in: not signed in/));
    await assert.rejects(runOne({ ...p.sonnet, gameOpen: ["123 claude --name arena-claude-a"] }), notStarted(/a session of the game experiment is open/));
    nothingMade("each of those took its folder away again");
    mkdirSync(join(p.at.work, "left-by-an-earlier-session"));
    await assert.rejects(runOne(p.sonnet), notStarted(/the profile's work folder is not empty/));
    rmSync(join(p.at.work, "left-by-an-earlier-session"), { recursive: true });
    // The ledger: another cap, the cap and limits of the check as first written, no ledger at all.
    writeFileSync(p.ledgerPath, JSON.stringify({ ...decided, cap_usd: 100 }), "utf8");
    await assert.rejects(runOne(p.sonnet), notStarted(/is not what the protocol says: its cap is 100/));
    writeFileSync(p.ledgerPath, JSON.stringify({ ...decided, cap_usd: 45, refuse_below_usd: 2, per_invocation_ceiling_usd: 6, watchdog: { one: { usd: 2, minutes: 15 }, four: { usd: 6, minutes: 40 } } }), "utf8");
    await assert.rejects(runOne(p.sonnet), notStarted(/is not what the protocol says: its cap is 45, and the protocol's is 140; its limits for a run of `one` in the `sonnet` block are null/));
    rmSync(p.ledgerPath);
    await assert.rejects(runOne(p.sonnet), notStarted(/ledger could not be read/));
    writeFileSync(p.ledgerPath, JSON.stringify(decided), "utf8");
    // A run is made once more only when the harness ended it, and only a run of the thirty-six, named with its block.
    await assert.rejects(runOne({ ...p.common, rerun: "sonnet/one/steered-1" }), notStarted(/not a run of the watching check/));
    await assert.rejects(runOne({ ...p.common, rerun: "one/plain-1" }), notStarted(/"one\/plain-1" is not a run of the watching check: --rerun names one, such as sonnet\/one\/plain-1/));
    await assert.rejects(runOne({ ...p.common, rerun: "sonnet/one/plain-1" }), notStarted(/has no record the harness ended/));
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
    [["--run", "sonnet/one/plain-1", ...words], /--run names a run for --dry-run only/],
    [["--rerun", ...words], /--rerun names a run, such as sonnet\/one\/plain-1\. Nothing was started\./],
    [["--score"], /--score names a run/],
    // A block is started by name: with both flags and no block, neither the next run nor every run to come is started.
    [["--next", ...words], /^say which block: --block sonnet, --block opus or --block haiku\. A block is started by name, by a person, in that order \(experiments\/watching\/README\.md, "Three models"\)\. Nothing was started\.$/m],
    [["--all", ...words], /^say which block: --block sonnet, --block opus or --block haiku\./],
    [["--next", "--block", "sonnet"], /will not without --spend and --go/],
    [["--next", "--block", "mini", ...words], /--block names a block of the check: sonnet, opus, haiku\. Nothing was started\./],
    [["--all", "--block", "claude-opus-5-5", ...words], /--block names a block of the check/],
    [["--all", "--block", ...words], /--block names a block of the check/],
    [["--dry-run", "--block", "all"], /--block names a block of the check/],
    // A run's name carries its block, so a block is named only where no run is.
    [["--rerun", "sonnet/one/plain-1", "--block", "sonnet", ...words], /--block does not go with --rerun: a run's name carries its block\. Nothing was started\./],
    [["--dry-run", "--run", "opus/four/invited-1", "--block", "opus"], /--block does not go with --run: a run's name carries its block/],
    // One thing at a time: a flag that belongs to another thing is refused, so a dry run of a scoring is never a scoring.
    [["--dry-run", "--score", "sonnet/one/plain-1"], /--score does not go with --dry-run\. Nothing was started, and nothing a session wrote was run\./],
    [["--score", "sonnet/one/plain-1", "--spend"], /--score does not go with --spend/],
    [["--score", "sonnet/one/plain-1", "--block", "sonnet"], /--score does not go with --block/],
    [["--status", "--all"], /--status does not go with --all/],
    [["--status", "--block", "opus"], /--status does not go with --block/],
    [["--dry-run", "--rerun", "sonnet/one/plain-1"], /--dry-run does not go with --rerun/],
    [["--next", ...words, "--cost", "1"], /a paid run does not go with --cost/],
    [["--settle", "1", "--cost", "1", "--note", "what happened here", "--all"], /--settle does not go with --all/],
    [["--settle", "1", "--note", "what happened here"], /--cost is what the harness reported, in dollars, or the word ceiling/],
  ]) {
    const out = ask(...flags);
    assert.deepEqual([out.status, says.test(out.stderr)], [64, true], `${flags.join(" ")}: ${out.stderr}`);
  }
  // As the repository stands, with no decision recorded, a scoring is refused and says what it would have run.
  if (!scoringDecided(readLedger()).ok) {
    const out = ask("--score", "sonnet/one/plain-1");
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
    assert.deepEqual([seen.the_hook_wrote_a_file_for_this_session, seen.files_in_its_folder, seen.files_of_what_was_said, seen.a_file_of_what_was_said_under_this_sessions_id, seen.lines, seen.lines_that_are_not_events], [true, 2, 1, true, 9, 2]);
    // What was said under an id of the server's own, when a harness hands it none, is counted and is not this session's by name.
    writeFileSync(join(events, "said-mcp-abc-123.jsonl"), `${line("note", { text: "a note" })}\n`, "utf8");
    rmSync(join(events, `said-${sid}.jsonl`));
    const other = hookBesideTranscripts({ eventsDir: events, sessionId: sid, subagentIds: [] });
    assert.deepEqual([other.files_of_what_was_said, other.a_file_of_what_was_said_under_this_sessions_id], [1, false]);
    // A folder left where the hook's file would be is not the hook's file, and stops nothing.
    mkdirSync(join(top, "odd", `${sid}.jsonl`), { recursive: true });
    writeFileSync(join(top, "odd", `${sid}.jsonl`, "x.txt"), "x", "utf8");
    const odd = hookBesideTranscripts({ eventsDir: join(top, "odd"), sessionId: sid, subagentIds: ["aaa"] });
    assert.deepEqual([odd.the_hook_wrote_a_file_for_this_session, odd.lines, odd.started_by_the_harness_with_no_start_line], [false, 0, 1]);
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
  const p = place({ uses: [] }, { decided: false, lines: [settled("watching/sonnet/one/plain-1", 139)] });
  try {
    const stand = () => ({ claude: p.harness, refused: ["the first paid call has no record"] });
    const text = dryRun({ run: order()[5], home: p.home, ledgerPath: p.ledgerPath, recordRoot: p.recordRoot, stand, node: "/a/node" });
    assert.match(text, /^sonnet\/four\/invited-1\nthe block: sonnet: the session itself on claude-sonnet-5-5 at high effort\n/);
    assert.match(text, /would start, in .*\/work\/[0-9a-f]{8}\/packages:\n {2}\S*stand-in-harness -p <the prompt> --model claude-sonnet-5-5 --effort high --output-format json --max-budget-usd 6 --permission-mode dontAsk --allowedTools 'Edit\(\/\*\*\)' mcp__grooph__grooph_plan mcp__grooph__grooph_note --strict-mcp-config --mcp-config '\{"mcpServers":\{"grooph":\{"command":"\/a\/node","args":\[".*\/packages\/cli\/bin\/grooph\.js","mcp","--dir",".*\/packages"\]\}\}\}' --setting-sources user,project --no-chrome --disable-slash-commands --session-id '<a new id>' --disallowedTools 'Edit\(\/\/.*\/packages\/\.grooph\)' 'Edit\(\/\/.*\/packages\/\.grooph\/\*\*\)' mcp__grooph__grooph_running /);
    assert.match(text, /; \.grooph is closed to the session's writing, whole: the harness runs the hook outside the sandbox, and the hook appends under that folder with no check for a link/);
    assert.ok(text.includes(promptFor(order()[5]).replace(/^/gm, "  | ")), "the prompt is shown whole");
    assert.match(text, /\nshort names of a model, in its environment: fable pinned to claude-opus-5-5, opus pinned to claude-opus-5-5, sonnet pinned to claude-sonnet-5-5; left to the harness: haiku\n/);
    assert.match(text, /the watchdog: \$6\.00 and 60 minutes; the ledger has counted \$139\.00 of \$140\.00/);
    assert.match(text, /a paid run would be refused:\n {2}- the first paid call has no record\n {2}- Scoring runs the repository's unseen suites .*\n {2}- the watching check has counted \$139\.00 on its ledger, and this run may cost up to \$6\.00/);
    assert.ok(!/is not started while/.test(text), "the first block waits for no other");
    assert.match(text, /its own instructions are \d+ characters and first name one of the two tools at character \d+; the harness hands a session the first 2,048 of them at its start, by its documentation/);
    assert.match(text, /nothing was started\.$/);
    assert.deepEqual([readdirSync(p.at.work), p.ledger().invocations.length, existsSync(p.recordRoot)], [[], 1, false], "the folder is gone, no line was written, no record was made");
    const plain = dryRun({ run: order()[0], home: p.home, ledgerPath: p.ledgerPath, recordRoot: p.recordRoot, stand: () => ({ claude: p.harness, refused: [] }) });
    assert.match(plain, /the arm: plain: nothing of grooph is in the folder/);
    assert.ok(!/--mcp-config|mcp__|--disallowedTools|grooph/i.test(plain.split("short names of a model")[0].split("would start")[1]), "the plain arm's command names no server, withholds nothing, closes nothing, and holds nothing of grooph");
    assert.deepEqual(readdirSync(p.at.work), []);
    // A run of a later block: its own model and ceilings, and what holds its block up, said with the runs that do.
    writeFileSync(p.ledgerPath, JSON.stringify({ ...p.ledger(), invocations: [], scoring_outside_the_sandbox: DECISION }), "utf8");
    const none = () => ({ claude: p.harness, refused: [] });
    const opus = dryRun({ run: order()[17], home: p.home, ledgerPath: p.ledgerPath, recordRoot: p.recordRoot, stand: none, node: "/a/node" });
    assert.match(opus, /^opus\/four\/invited-1\nthe block: opus: the session itself on claude-opus-5-5 at high effort\n/);
    assert.match(opus, /stand-in-harness -p <the prompt> --model claude-opus-5-5 --effort high --output-format json --max-budget-usd 15 /);
    assert.match(opus, /the watchdog: \$15\.00 and 60 minutes; the ledger has counted \$0\.00 of \$140\.00/);
    assert.match(opus, /a paid run would be refused:\n {2}- the `opus` block is not started while the `sonnet` block, which comes before it, has 12 runs with no record \(sonnet\/one\/plain-1, sonnet\/four\/plain-1, .*, sonnet\/four\/invited-2\): a block is started by a person, and the driver reads its records before the next is started \(experiments\/watching\/README\.md, "Three models"\)\nnothing was started\.$/);
    const haiku = dryRun({ run: order()[24], home: p.home, ledgerPath: p.ledgerPath, recordRoot: p.recordRoot, stand: none });
    assert.match(haiku, /^haiku\/one\/plain-1\nthe block: haiku: the session itself on haiku, asked for by its short name, at high effort\n/);
    assert.match(haiku, /stand-in-harness -p <the prompt> --model haiku --effort high --output-format json --max-budget-usd 1 /);
    assert.match(haiku, /the watchdog: \$1\.00 and 25 minutes; /);
    assert.match(haiku, /left to the harness: haiku\n/);
    assert.match(haiku, /- the `haiku` block is not started while the `sonnet` block, which comes before it, has 12 runs with no record/, "the first block that is short of a record is the one named");
    // With the block before it recorded, nothing holds a block up.
    inHand(p, blockOf("sonnet"));
    assert.match(dryRun({ run: order()[12], home: p.home, ledgerPath: p.ledgerPath, recordRoot: p.recordRoot, stand: none }), /\nas things stand, a paid run would pass the gates before the ledger's\nnothing was started\.$/);
    assert.match(dryRun({ run: order()[24], home: p.home, ledgerPath: p.ledgerPath, recordRoot: p.recordRoot, stand: none }), /- the `haiku` block is not started while the `opus` block, which comes before it, has 12 runs with no record/);
    assert.deepEqual([readdirSync(p.at.work), p.ledger().invocations.length], [[], 0]);
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
    const next = nextRun(p.recordRoot, "sonnet");
    if (next?.task === "four") inHand(p, [next]);
  };
  const record = (done, name) => JSON.parse(readFileSync(join(done.recordDir, name), "utf8"));
  try {
    // ── plain ──
    const plain = await runOne(p.sonnet);
    assert.equal(plain.run.name, "sonnet/one/plain-1");
    assert.equal(plain.recordDir, join(p.recordRoot, "sonnet", "one", "plain-1"), "a run's record is kept under its block and its task");
    assert.deepEqual([plain.result.run, plain.result.block, plain.result.task, plain.result.arm, plain.result.replicate], ["sonnet/one/plain-1", "sonnet", "one", "plain", 1]);
    assert.deepEqual([plain.result.ended_by, plain.result.problems, plain.result.scored, plain.result.scored_outside_the_sandbox_on], ["the session", [], true, DECISION]);
    assert.deepEqual(plain.score.packages.map((pkg) => [pkg.package, pkg.folder, pkg.passed, pkg.cases, pkg.scored_from]), [["printkit", ".", 70, 70, "experiments/comparisons/heterogeneous-critic/held-out"]], "the reference solution, scored from the repository's own suite");
    const { the_runners_checkout: checkedOut, ...givenPlain } = plain.result.given;
    assert.deepEqual(givenPlain, { the_sessions_model: { block: "sonnet", asked_for: "claude-sonnet-5-5", effort: "high" }, short_names_of_a_model: SHORT_NAMES, the_prompt_ends_with: [SUBAGENTS_SENTENCE], hook_installed: [], closed_to_the_session: [], server: null });
    assert.ok((checkedOut.commit === null || /^[0-9a-f]{40}$/.test(checkedOut.commit)) && Number.isInteger(checkedOut.files_changed_since_it), "the record says which commit of this repository made the run");
    assert.equal(checkedOut.grooph_version, JSON.parse(readFileSync(join(root, "packages", "cli", "package.json"), "utf8")).version);
    assert.equal(plain.result.the_hooks_file_beside_the_transcripts, null);
    assert.deepEqual([plain.result.measures.subagents.count, plain.result.measures.session.tool_calls, plain.result.measures.session.cost_usd_as_the_harness_reports, plain.result.measures.the_two_tools.either_called], [0, { Write: 1 }, 0.31, false]);
    assert.deepEqual(plain.result.measures.session.models_that_answered, ["claude-sonnet-5-5"], "the session's own model as it answered, by its transcript");
    assert.deepEqual([plain.result.measures.footprint.named_in_the_input.calls, plain.result.measures.footprint.shown_in_the_result.calls], [0, 0]);
    assert.deepEqual([plain.result.measures.given.tools_of_a_server_named_to_it, plain.result.measures.given.servers_whose_instructions_it_was_handed, plain.result.measures.given.instructions_it_was_handed], [[], [], []], "by the harness's own record, the plain arm was named no server's tool and handed no server's instructions");
    // What the stand-in was started with: the profile's command for this model and ceiling, and nothing of a server or a wall.
    let seen = p.seen();
    assert.deepEqual([flagOf(seen.args, "--model"), flagOf(seen.args, "--effort"), flagOf(seen.args, "--max-budget-usd"), flagOf(seen.args, "--allowedTools"), flagOf(seen.args, "--setting-sources")], ["claude-sonnet-5-5", "high", "2", "Edit(/**)", "user,project"]);
    assert.deepEqual(plain.result.watchdog, { usd: 2, minutes: 25, fired: null, is_not_a_graphs_stop: true }, "the first block's limits for a run of `one`");
    assert.equal(seen.args[1], promptFor(plain.run), "the prompt it was given is the run's");
    assert.ok(!seen.args.includes("--mcp-config") && !seen.args.includes("--disallowedTools"), "no server, nothing withheld, nothing closed");
    assert.ok(!seen.args.some((arg) => /grooph/i.test(arg)), "and no argument of the plain arm's command names grooph");
    assert.ok(!seen.environment.some((name) => /GROOPH/i.test(name)), "and nothing of grooph in its environment");
    // The session was started with three short names pinned and `haiku` left to the harness, and its record says so.
    assert.deepEqual(seen.environment.filter((name) => /^ANTHROPIC_DEFAULT_/.test(name)), ["ANTHROPIC_DEFAULT_FABLE_MODEL", "ANTHROPIC_DEFAULT_OPUS_MODEL", "ANTHROPIC_DEFAULT_SONNET_MODEL"]);
    assert.deepEqual(plain.result.environment.filter((name) => /^ANTHROPIC_DEFAULT_/.test(name)), ["ANTHROPIC_DEFAULT_FABLE_MODEL", "ANTHROPIC_DEFAULT_OPUS_MODEL", "ANTHROPIC_DEFAULT_SONNET_MODEL"]);
    assert.deepEqual(readdirSync(plain.recordDir).sort(), ["claude-output.json", "claude-stderr.txt", "loaded.txt", "project.diff", "prompt.md", "result.json", "score.json", "settings.json", "transcript-digest.json"]);
    assert.equal(readFileSync(join(plain.recordDir, "prompt.md"), "utf8"), promptFor(plain.run));
    assert.deepEqual(record(plain, "settings.json").sandbox.filesystem.denyWrite, []);
    assert.deepEqual(record(plain, "transcript-digest.json")[0].tool_uses, [{ tool: "Write", at: "2026-10-05T00:00:00.000Z", refused: false }], "the digest is names: not the file a call named");
    assert.match(readFileSync(join(plain.recordDir, "project.diff"), "utf8"), /src\/parse-ranges\.mjs/);
    const [line] = p.ledger().invocations;
    assert.deepEqual([line.run, line.project, line.status, line.cost_usd, line.max_budget_usd, line.session_id], ["watching/sonnet/one/plain-1", "watching/sonnet/one", "ok", 0.31, 2, plain.result.session_id]);
    assert.match(line.note, /the watching check: sonnet, one, plain; the driver's go: the driver said: run the watching check; ended by the session/);
    assert.deepEqual([readdirSync(p.at.work), existsSync(join(plain.kept, "work", "printkit", "src", "parse-ranges.mjs"))], [[], true], "the folder was moved aside, and the next starts with the work folder empty");
    assert.equal(waitsForAPerson(plain), null);
    assert.equal(stateOf(plain.run, p.recordRoot).state, "recorded and scored");
    skipFour();

    // ── watched ── The session started a subagent, ran git status, and the hook wrote its file as the harness would have had it.
    const hook = (event, more = {}) => `${JSON.stringify({ v: 1, t: "2026-10-09T10:00:00.000Z", harness: "claude-code", event, session: "<session>", ...more })}\n`;
    const agentUse = { tool: "Agent", input: { subagent_type: "general-purpose", description: "A DESCRIPTION", prompt: "SECRET-PROMPT", model: "haiku" }, result: "done", meta: { toolUseId: "<use>", spawnDepth: 1, requestShape: "background", model: "haiku" }, subagent_uses: [{ tool: "Edit", input: { file_path: "src/parse-ranges.mjs" }, result: "ok" }], writes: { ".grooph/events/<session>.jsonl": hook("session-start", { cwd: "/a/folder" }) + hook("subagent-start", { agent: "1", type: "general-purpose" }) + hook("tool", { tool: "Agent", spawned: "1" }) + hook("subagent-stop", { agent: "1", type: "general-purpose" }) + hook("turn-end") } };
    const looked = { tool: "Bash", input: { command: "git status --short" }, result: "?? .grooph/events/\n?? src/parse-ranges.mjs" };
    p.setPlan({ uses: [work, agentUse, looked], cost: 0.4, model: "claude-sonnet-5-5", sub_model: "claude-haiku-4-5-20251001", denials: [{ tool_name: "Bash", tool_use_id: "use-9", tool_input: { command: "A COMMAND THE HARNESS DENIED" } }] });
    const watched = await runOne(p.sonnet);
    assert.equal(watched.run.name, "sonnet/one/watched-1");
    assert.deepEqual([watched.result.ended_by, watched.result.problems, watched.score.packages[0].passed], ["the session", [], 70]);
    assert.deepEqual({ ...watched.result.given, the_runners_checkout: null }, { the_runners_checkout: null, the_sessions_model: { block: "sonnet", asked_for: "claude-sonnet-5-5", effort: "high" }, short_names_of_a_model: SHORT_NAMES, the_prompt_ends_with: [SUBAGENTS_SENTENCE], hook_installed: HOOK_FILES, closed_to_the_session: [".grooph"], server: null });
    seen = p.seen();
    assert.equal(seen.args[1], promptFor(plain.run), "the watched arm's prompt is the plain arm's, to the letter");
    assert.ok(!seen.args.includes("--mcp-config"));
    const closedAt = seen.args.indexOf("--disallowedTools");
    assert.deepEqual(seen.args.slice(closedAt + 1).map((rule) => rule.replace(/\/\/.*\/printkit\//, "//<the folder>/")), ["Edit(//<the folder>/.grooph)", "Edit(//<the folder>/.grooph/**)"], "the whole of .grooph is closed to the file tools, and nothing else is");
    assert.deepEqual(record(watched, "settings.json").sandbox.filesystem.denyWrite.map((path) => path.replace(/^.*\/printkit\//, "")), [".grooph"], "and to commands, in the settings the session ran under");
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
    // In no file of the record: not what a call asked, not what a subagent was handed, not what the harness says a denied call asked.
    for (const file of filesUnder(watched.recordDir)) for (const text of ["SECRET-PROMPT", "A DESCRIPTION", "git status", "A COMMAND THE HARNESS DENIED"]) assert.ok(!readFileSync(join(watched.recordDir, file), "utf8").includes(text), `${text} is not kept in ${file}`);
    const output = record(watched, "claude-output.json");
    assert.deepEqual(output.permission_denials, [{ tool_name: "Bash", tool_use_id: "use-9" }], "the record's copy of the harness's output names a denied call's tool, and not what it asked");
    assert.match(output.permission_denials_in_this_copy, /What the call asked is left out of the record/);
    assert.equal(output.result, "done", "the rest of the harness's output is as it was");
    assert.deepEqual(watched.result.measures.session.calls_the_harness_reports_it_denied, { Bash: 1 });
    assert.ok(readFileSync(join(watched.kept, "work", "harness", "claude-output.json"), "utf8").includes("A COMMAND THE HARNESS DENIED"), "the harness's own output is whole on the machine, where the runner moved it");
    assert.equal(p.ledger().invocations.at(-1).run, "watching/sonnet/one/watched-1");
    skipFour();

    // ── invited ── The session said what it intended through the two tools.
    const planned = { tool: "mcp__grooph__grooph_plan", input: { title: "Page ranges", agents: [{ type: "general-purpose", purpose: "the tests" }] }, result: "Plan recorded" };
    const noted = { tool: "mcp__grooph__grooph_note", input: { text: "One subagent for the tests." }, result: "Noted.", writes: { ".grooph/events/said-<session>.jsonl": hook("note", { text: "One subagent for the tests." }) } };
    p.setPlan({ uses: [planned, agentUse, noted, work], cost: 0.5, model: "claude-sonnet-5-5", servers: ["grooph"], deferred: ["mcp__grooph__grooph_plan", "mcp__grooph__grooph_note"] });
    const invited = await runOne({ ...p.sonnet, node: "/a/node" });
    assert.equal(invited.run.name, "sonnet/one/invited-1");
    assert.deepEqual([invited.result.ended_by, invited.result.problems, invited.score.packages[0].passed], ["the session", [], 70]);
    seen = p.seen();
    assert.equal(seen.args[1], `${promptFor(plain.run)}\n${INVITATION}\n`);
    const allowedAt = seen.args.indexOf("--allowedTools");
    assert.deepEqual(seen.args.slice(allowedAt + 1, allowedAt + 4), ["Edit(/**)", "mcp__grooph__grooph_plan", "mcp__grooph__grooph_note"], "the two tools are allowed, and nothing else is added");
    const server = JSON.parse(flagOf(seen.args, "--mcp-config"));
    assert.deepEqual(Object.keys(server.mcpServers), ["grooph"]);
    assert.deepEqual([server.mcpServers.grooph.command, server.mcpServers.grooph.args.slice(0, 3)], ["/a/node", [CLI, "mcp", "--dir"]]);
    assert.match(server.mcpServers.grooph.args[3], /\/work\/[0-9a-f]{8}\/printkit$/, "the server is given the session's own folder");
    const denied = seen.args.slice(seen.args.indexOf("--disallowedTools") + 1);
    const every = serverOffers(p.top).tools.map((name) => `mcp__grooph__${name}`);
    assert.deepEqual(denied.filter((rule) => rule.startsWith("mcp__")).sort(), every.filter((name) => !["mcp__grooph__grooph_plan", "mcp__grooph__grooph_note"].includes(name)).sort(), "every other tool of the server is withheld, by a bare name");
    assert.deepEqual(denied.filter((rule) => rule.startsWith("Edit(")).map((rule) => rule.replace(/\/\/.*\/printkit\//, "//<the folder>/")), ["Edit(//<the folder>/.grooph)", "Edit(//<the folder>/.grooph/**)"], "and .grooph is closed as in the watched arm");
    assert.deepEqual([invited.result.given.closed_to_the_session, record(invited, "settings.json").sandbox.filesystem.denyWrite.map((path) => path.replace(/^.*\/printkit\//, ""))], [[".grooph"], [".grooph"]]);
    assert.deepEqual([invited.result.given.server.tools_allowed, invited.result.given.server.tools_withheld.length, invited.result.given.the_prompt_ends_with], [["mcp__grooph__grooph_plan", "mcp__grooph__grooph_note"], every.length - 2, [SUBAGENTS_SENTENCE, INVITATION]]);
    assert.ok(invited.result.given.server.its_own_instructions.characters > 0);
    // Whether either tool was called, how many times, and what was said: kept, as the session's own statement.
    const two = invited.result.measures.the_two_tools;
    assert.deepEqual([two.either_called, two.calls, two.other_tools_of_a_server_called], [true, { grooph_plan: 1, grooph_note: 1 }, {}]);
    assert.deepEqual(two.said.map((said) => [said.tool, said.by, said.input]), [["grooph_plan", "the session", planned.input], ["grooph_note", "the session", noted.input]]);
    assert.deepEqual([invited.result.measures.given.tools_of_a_server_named_to_it, invited.result.measures.given.servers_whose_instructions_it_was_handed], [["mcp__grooph__grooph_note", "mcp__grooph__grooph_plan"], ["grooph"]]);
    assert.deepEqual(readdirSync(join(invited.recordDir, "events")).sort(), [`${invited.result.session_id}.jsonl`, `said-${invited.result.session_id}.jsonl`].sort());
    assert.deepEqual([invited.result.the_hooks_file_beside_the_transcripts.files_of_what_was_said, invited.result.the_hooks_file_beside_the_transcripts.a_file_of_what_was_said_under_this_sessions_id], [1, true]);
    assert.deepEqual(p.ledger().invocations.map((entry) => entry.run), ["watching/sonnet/one/plain-1", "watching/sonnet/one/watched-1", "watching/sonnet/one/invited-1"]);
    assert.deepEqual(p.seen().environment.filter((name) => /^ANTHROPIC_DEFAULT_/.test(name)), ["ANTHROPIC_DEFAULT_FABLE_MODEL", "ANTHROPIC_DEFAULT_OPUS_MODEL", "ANTHROPIC_DEFAULT_SONNET_MODEL"], "a server changes nothing of that");
    assert.deepEqual(readdirSync(p.at.work), []);
    skipFour();

    // ── a run the harness ended is recorded, not scored, and stops what comes after it; it is made once more, once ──
    p.setPlan({ no_output: true });
    const dead = await runOne(p.sonnet);
    assert.equal(dead.run.name, "sonnet/one/plain-2");
    assert.deepEqual([dead.result.ended_by, dead.score, dead.result.scored, existsSync(join(dead.recordDir, "score.json"))], ["the harness", null, false, false]);
    assert.equal(waitsForAPerson(dead), "the harness ended it");
    assert.equal(stateOf(dead.run, p.recordRoot).state, "ended by the harness, and not yet run again");
    assert.throws(() => scoreKept({ name: "sonnet/one/plain-2", ledger: p.ledger(), home: p.home, recordRoot: p.recordRoot }), /such a run is not scored/);
    await assert.rejects(runOne({ ...p.common, rerun: "sonnet/one/plain-1" }), notStarted(/has no record the harness ended/));
    // A run made once more is named whole, its block in its name: a block named beside it is refused, whichever it is.
    await assert.rejects(runOne({ ...p.sonnet, rerun: "sonnet/one/plain-2" }), notStarted(/--rerun names its run whole, its block in its name \(sonnet\/one\/plain-1\): --block does not go with it/));
    p.setPlan({ uses: [], cost: 0.2 });
    const again = await runOne({ ...p.common, rerun: "sonnet/one/plain-2" });
    assert.equal(again.recordDir, join(p.recordRoot, "sonnet", "one", "plain-2-rerun"));
    assert.deepEqual([again.result.rerun_of, again.result.block, again.result.ended_by], ["sonnet/one/plain-2", "sonnet", "the session"]);
    assert.match(again.result.rerun_because, /no result from the harness/, "the reason is written beside it");
    assert.match(p.ledger().invocations.at(-1).note, /the one rerun of a run the harness ended \(no result from the harness/);
    assert.equal(p.ledger().invocations.at(-1).run, "watching/sonnet/one/plain-2-rerun");
    assert.deepEqual([flagOf(p.seen().args, "--model"), flagOf(p.seen().args, "--max-budget-usd"), again.result.watchdog.minutes], ["claude-sonnet-5-5", "2", 25], "under its own block's model and limits");
    assert.ok(again.score.packages[0].passed < 70, "a folder with no work in it does not pass the suite");
    assert.deepEqual([stateOf(dead.run, p.recordRoot).state, stateOf(dead.run, p.recordRoot).from], ["recorded and scored", "its rerun"]);
    await assert.rejects(runOne({ ...p.common, rerun: "sonnet/one/plain-2" }), notStarted(/was already run once more/));

    // A score that is not there is not a score of nothing: it can be made again from the packages the runner kept.
    rmSync(join(again.recordDir, "score.json"));
    assert.equal(stateOf(dead.run, p.recordRoot).state, "recorded, not scored");
    const rescored = scoreKept({ name: "sonnet/one/plain-2-rerun", ledger: p.ledger(), home: p.home, recordRoot: p.recordRoot });
    assert.deepEqual([rescored.score.packages[0].passed, rescored.score.scored_afterwards_from, rescored.score.scored_outside_the_sandbox_on], [again.score.packages[0].passed, "the packages as the runner kept them", DECISION]);
    assert.equal(rescored.recordDir, again.recordDir);
    assert.throws(() => scoreKept({ name: "sonnet/one/plain-2-rerun", ledger: p.ledger(), home: p.home, recordRoot: p.recordRoot }), /already scored/);
    assert.throws(() => scoreKept({ name: "sonnet/nine/plain-1", ledger: p.ledger(), home: p.home, recordRoot: p.recordRoot }), /not a run of the watching check/);
    assert.throws(() => scoreKept({ name: "one/plain-2-rerun", ledger: p.ledger(), home: p.home, recordRoot: p.recordRoot }), /"one\/plain-2-rerun" is not a run of the watching check: --score names one, such as sonnet\/one\/plain-1 or sonnet\/one\/plain-1-rerun/, "a name with no block is no run's");
    assert.throws(() => scoreKept({ name: "sonnet/one/watched-2", ledger: p.ledger(), home: p.home, recordRoot: p.recordRoot }), /has no record/);
    assert.throws(() => scoreKept({ name: "opus/one/plain-1", ledger: p.ledger(), home: p.home, recordRoot: p.recordRoot }), /has no record/, "the same task and arm in another block is another run");
    const said = status({ ledgerPath: p.ledgerPath, recordRoot: p.recordRoot });
    assert.match(said, /\n {2}sonnet\/one\/plain-2 +recorded and scored: ended by the session \(its rerun\); printkit \d+\/70\n/);
    // The three blocks, each with its model, its limits and how far it is; the two after the first wait for it.
    assert.match(said, /\nthe thirty-six runs, in three blocks of twelve, in their order \(7 recorded\):\nthe sonnet block, the session itself on claude-sonnet-5-5 at high effort \(7 of 12 recorded; a run of `one` stops at \$2\.00 or 25 minutes, a run of `four` stops at \$6\.00 or 60 minutes\):\n/);
    assert.match(said, /\nthe opus block, the session itself on claude-opus-5-5 at high effort \(0 of 12 recorded; a run of `one` stops at \$5\.00 or 25 minutes, a run of `four` stops at \$15\.00 or 60 minutes\); not started while the sonnet block has 5 runs with no record:\n {2}opus\/one\/plain-1 +not recorded\n/);
    assert.match(said, /\nthe haiku block, the session itself on haiku at high effort \(0 of 12 recorded; a run of `one` stops at \$1\.00 or 25 minutes, a run of `four` stops at \$3\.00 or 60 minutes\); not started while the sonnet block has 5 runs with no record:\n/);
    assert.equal(said.split("\n").filter((line) => /^ {2}(sonnet|opus|haiku)\//.test(line)).length, 36, "a line for each of the thirty-six");
    assert.match(said, /\nnext: sonnet\/four\/plain-2 \(started with --block sonnet\), which may cost up to \$6\.00; the ledger has room for it/);
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
    inHand(p, [order()[0]]);
    const four = await runOne(p.sonnet);
    assert.equal(four.run.name, "sonnet/four/plain-1");
    assert.equal(four.recordDir, join(p.recordRoot, "sonnet", "four", "plain-1"));
    assert.deepEqual(four.result.problems, []);
    assert.deepEqual(four.score.packages.map((pkg) => [pkg.package, pkg.folder, pkg.scored_from]), TASKS.four.packages.map((pkg) => [pkg.name, pkg.folder, `experiments/comparisons/${pkg.project}/held-out`]));
    assert.deepEqual(four.score.packages.map((pkg) => pkg.cases), [55, 88, 73, 62]);
    assert.equal(four.score.packages[0].passed, 55, "the one package whose work was done passes its suite");
    assert.ok(four.score.packages.slice(1).every((pkg) => pkg.passed < pkg.cases), "and the three with no work in them do not");
    assert.ok(!existsSync(join(four.kept, "work", "packages", "settingskit", "run-by-the-scorer.txt")), "a package's own test command, which a session can make anything, is not run by the scorer");
    assert.deepEqual([p.ledger().invocations[0].run, p.ledger().invocations[0].max_budget_usd], ["watching/sonnet/four/plain-1", 6]);
    assert.equal(p.seen().args[p.seen().args.indexOf("--max-budget-usd") + 1], "6");
    assert.deepEqual([four.result.watchdog.usd, four.result.watchdog.minutes], [6, 60], "the first block's limits for a run of `four`");
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

test("every run of a block still to come, one at a time: it stops at the first run the harness ended and at the first refusal, starts nothing after either, and never goes on into the next block", { skip: !built }, async () => {
  // The last three of the first block's twelve, each in its turn, and then nothing of that block is left to start.
  const p = place({ uses: [], cost: 0.2 });
  try {
    inHand(p, blockOf("sonnet").slice(0, 9));
    const told = [];
    const all = await runAll({ ...p.sonnet, each: (done) => told.push(done.run.name) });
    assert.deepEqual([all.done.map((done) => done.run.name), all.stopped, told], [["sonnet/four/watched-2", "sonnet/one/invited-2", "sonnet/four/invited-2"], null, ["sonnet/four/watched-2", "sonnet/one/invited-2", "sonnet/four/invited-2"]]);
    assert.deepEqual(p.ledger().invocations.map((entry) => [entry.run, entry.max_budget_usd, entry.status]), [["watching/sonnet/four/watched-2", 6, "ok"], ["watching/sonnet/one/invited-2", 2, "ok"], ["watching/sonnet/four/invited-2", 6, "ok"]]);
    // The block is done and the check is not: the next block has every run still to come, and none of it was started.
    assert.deepEqual([nextRun(p.recordRoot, "sonnet"), nextRun(p.recordRoot).name, all.done.at(-1).next], [null, "opus/one/plain-1", null]);
    assert.deepEqual(await runAll(p.sonnet), { done: [], stopped: null }, "with every run of the block recorded there is nothing to start");
    await assert.rejects(runOne(p.sonnet), notStarted(/every run of the `sonnet` block is recorded/));
    assert.deepEqual([p.ledger().invocations.length, existsSync(join(p.recordRoot, "opus"))], [3, false]);
    // The next block, by its own name: its last two runs, under its own ceilings, and nothing of the block after it.
    inHand(p, blockOf("opus").slice(0, 10));
    const opus = await runAll({ ...p.common, block: "opus" });
    assert.deepEqual([opus.done.map((done) => done.run.name), opus.stopped], [["opus/one/invited-2", "opus/four/invited-2"], null]);
    assert.deepEqual(p.ledger().invocations.slice(3).map((entry) => [entry.run, entry.max_budget_usd, entry.status]), [["watching/opus/one/invited-2", 5, "ok"], ["watching/opus/four/invited-2", 15, "ok"]]);
    assert.deepEqual([nextRun(p.recordRoot, "opus"), nextRun(p.recordRoot).name, existsSync(join(p.recordRoot, "haiku"))], [null, "haiku/one/plain-1", false]);
  } finally {
    rmSync(p.top, { recursive: true, force: true });
  }
  // A run the harness ended stops it: the run after is not started.
  const q = place({ no_output: true });
  try {
    inHand(q, blockOf("sonnet").slice(0, 10));
    const all = await runAll(q.sonnet);
    assert.deepEqual([all.done.map((done) => done.run.name), all.stopped], [["sonnet/one/invited-2"], { after: "sonnet/one/invited-2", why: "the harness ended it", by_the_harness: true }]);
    assert.deepEqual([q.ledger().invocations.length, nextRun(q.recordRoot).name, readdirSync(q.at.work)], [1, "sonnet/four/invited-2", []], "one line, and the next run still to come");
  } finally {
    rmSync(q.top, { recursive: true, force: true });
  }
  // A refusal stops it: the ledger had room for the first of the two and has none for the second.
  const r = place({ uses: [], cost: 0.2 }, { lines: [settled("watching/sonnet/one/plain-1", 134.5)] });
  try {
    inHand(r, blockOf("sonnet").slice(0, 10));
    const told = [];
    await assert.rejects(runAll({ ...r.sonnet, each: (done) => told.push(done.run.name) }), notStarted(/has counted \$134\.70 on its ledger, and this run may cost up to \$6\.00: together past the \$140\.00/));
    assert.deepEqual([told, r.ledger().invocations.length, nextRun(r.recordRoot).name, readdirSync(r.at.work)], [["sonnet/one/invited-2"], 2, "sonnet/four/invited-2", []], "what was done before the refusal was said, and nothing was started after it");
  } finally {
    rmSync(r.top, { recursive: true, force: true });
  }
});

test("a block is started by name: none with no block named, none while a block before it has a run with no record, and each on its own model under its own ceilings", { skip: !built }, async () => {
  const p = place({ uses: [{ tool: "Bash", input: { command: "true" }, result: "" }], cost: 0.2, model: "claude-opus-5-5" });
  const nothingMade = (why) => assert.deepEqual([readdirSync(p.at.work), p.ledger().invocations, existsSync(p.recordRoot)], [[], [], false], why);
  const pins = (environment) => environment.filter((name) => /^ANTHROPIC_DEFAULT_/.test(name));
  try {
    // What was asked comes first: a paid run names its block, and a name that is no block's is none.
    await assert.rejects(runOne(p.common), notStarted(/no block was named: say which block: --block sonnet, --block opus or --block haiku\. A block is started by name, by a person, in that order/));
    await assert.rejects(runOne({ ...p.common, block: "mini" }), notStarted(/"mini" is not a block of the watching check: say which block/));
    await assert.rejects(runOne({ ...p.common, block: "claude-opus-5-5" }), notStarted(/is not a block of the watching check/));
    await assert.rejects(runAll(p.common), notStarted(/no block was named: say which block/));
    await assert.rejects(runAll({ ...p.common, block: "all" }), notStarted(/"all" is not a block of the watching check/));
    // Said whatever the gates hold: before the first call's word is looked at.
    await assert.rejects(runOne({ ...p.common, firstCallGate: { ok: false, why: "the first paid call has no record" } }), notStarted(/no block was named/));

    // With nothing recorded, the first block waits for no other, and the two after it wait for its twelve.
    assert.equal(heldUpBy("sonnet", p.recordRoot), null);
    assert.deepEqual([heldUpBy("opus", p.recordRoot).block, heldUpBy("opus", p.recordRoot).runs], ["sonnet", blockOf("sonnet").map((run) => run.name)]);
    assert.deepEqual([heldUpBy("haiku", p.recordRoot).block, heldUpBy("haiku", p.recordRoot).runs.length], ["sonnet", 12], "the first block that is short of a record is the one named");
    await assert.rejects(runOne({ ...p.common, block: "opus" }), notStarted(/the `opus` block is not started while the `sonnet` block, which comes before it, has 12 runs with no record \(sonnet\/one\/plain-1, sonnet\/four\/plain-1, .*, sonnet\/four\/invited-2\): a block is started by a person, and the driver reads its records before the next is started \(experiments\/watching\/README\.md, "Three models"\)/));
    await assert.rejects(runAll({ ...p.common, block: "opus" }), notStarted(/the `opus` block is not started while the `sonnet` block/));
    await assert.rejects(runOne({ ...p.common, block: "haiku" }), notStarted(/the `haiku` block is not started while the `sonnet` block, which comes before it, has 12 runs with no record/));
    await assert.rejects(runAll({ ...p.common, block: "haiku" }), notStarted(/the `haiku` block is not started while the `sonnet` block/));
    nothingMade("each was refused before any folder was made or any line written");

    // All but two of the first block recorded, then all but one: still held, and which runs is said.
    inHand(p, blockOf("sonnet").slice(0, 10));
    await assert.rejects(runOne({ ...p.common, block: "opus" }), notStarted(/while the `sonnet` block, which comes before it, has 2 runs with no record \(sonnet\/one\/invited-2, sonnet\/four\/invited-2\)/));
    inHand(p, [blockOf("sonnet")[10]]);
    await assert.rejects(runOne({ ...p.common, block: "opus" }), notStarted(/while the `sonnet` block, which comes before it, has a run with no record \(sonnet\/four\/invited-2\)/));
    await assert.rejects(runAll({ ...p.common, block: "haiku" }), notStarted(/while the `sonnet` block, which comes before it, has a run with no record \(sonnet\/four\/invited-2\)/));
    assert.deepEqual([readdirSync(p.at.work), p.ledger().invocations], [[], []]);
    // A run the harness ended has a record. It holds nothing up, in a block as in the order: it waits for its one rerun.
    inHand(p, [blockOf("sonnet")[11]], { ended_by: "the harness", why: "no result from the harness (exit 1)" });
    assert.deepEqual([heldUpBy("opus", p.recordRoot), stateOf(blockOf("sonnet")[11], p.recordRoot).state], [null, "ended by the harness, and not yet run again"]);
    // The third block now waits for the second, and for all of it.
    assert.deepEqual([heldUpBy("haiku", p.recordRoot).block, heldUpBy("haiku", p.recordRoot).runs.length], ["opus", 12]);
    await assert.rejects(runOne({ ...p.common, block: "haiku" }), notStarted(/the `haiku` block is not started while the `opus` block, which comes before it, has 12 runs with no record \(opus\/one\/plain-1, /));

    // ── the opus block ── Its session on Opus 5.5 at high effort, under $5.00 and 25 minutes for `one` and $15.00 and 60 for `four`.
    const opusOne = await runOne({ ...p.common, block: "opus" });
    assert.deepEqual([opusOne.run.name, opusOne.recordDir, opusOne.result.problems], ["opus/one/plain-1", join(p.recordRoot, "opus", "one", "plain-1"), []]);
    let seen = p.seen();
    assert.deepEqual([flagOf(seen.args, "--model"), flagOf(seen.args, "--effort"), flagOf(seen.args, "--max-budget-usd")], ["claude-opus-5-5", "high", "5"]);
    assert.deepEqual(pins(seen.environment), ["ANTHROPIC_DEFAULT_FABLE_MODEL", "ANTHROPIC_DEFAULT_OPUS_MODEL", "ANTHROPIC_DEFAULT_SONNET_MODEL"], "no pin on haiku, in this block as in every other");
    assert.deepEqual(opusOne.result.watchdog, { usd: 5, minutes: 25, fired: null, is_not_a_graphs_stop: true });
    assert.deepEqual([opusOne.result.block, opusOne.result.given.the_sessions_model, opusOne.result.given.short_names_of_a_model], ["opus", { block: "opus", asked_for: "claude-opus-5-5", effort: "high" }, SHORT_NAMES]);
    assert.deepEqual([p.ledger().invocations[0].run, p.ledger().invocations[0].project, p.ledger().invocations[0].max_budget_usd], ["watching/opus/one/plain-1", "watching/opus/one", 5]);
    assert.match(p.ledger().invocations[0].note, /^the watching check: opus, one, plain; the driver's go: /);
    assert.equal(opusOne.next.name, "opus/four/plain-1", "what comes next is the next of its own block");
    const opusFour = await runOne({ ...p.common, block: "opus" });
    seen = p.seen();
    assert.deepEqual([opusFour.run.name, flagOf(seen.args, "--model"), flagOf(seen.args, "--max-budget-usd"), opusFour.result.watchdog.usd, opusFour.result.watchdog.minutes, p.ledger().invocations[1].max_budget_usd, opusFour.result.problems], ["opus/four/plain-1", "claude-opus-5-5", "15", 15, 60, 15, []]);
    assert.equal(seen.args[1], promptFor({ task: "four", arm: "plain" }), "the prompt is the task's and the arm's, the same in every block");
    // The status shows the three blocks: the first done, the second begun, the third waiting for the second.
    const said = status({ ledgerPath: p.ledgerPath, recordRoot: p.recordRoot });
    assert.match(said, /\nthe sonnet block, the session itself on claude-sonnet-5-5 at high effort \(12 of 12 recorded; .*\):\n/);
    assert.match(said, /\n {2}sonnet\/four\/invited-2 +ended by the harness, and not yet run again \(no result from the harness \(exit 1\)\)\n/);
    assert.match(said, /\nthe opus block, the session itself on claude-opus-5-5 at high effort \(2 of 12 recorded; a run of `one` stops at \$5\.00 or 25 minutes, a run of `four` stops at \$15\.00 or 60 minutes\):\n {2}opus\/one\/plain-1 +recorded and scored: ended by the session; printkit \d+\/70\n/);
    assert.match(said, /\nthe haiku block, the session itself on haiku at high effort \(0 of 12 recorded; a run of `one` stops at \$1\.00 or 25 minutes, a run of `four` stops at \$3\.00 or 60 minutes\); not started while the opus block has 10 runs with no record:\n/);
    assert.match(said, /\nnext: opus\/one\/watched-1 \(started with --block opus\), which may cost up to \$5\.00; the ledger has room for it \(\$139\.60 left\)$/);

    // ── the haiku block ── Asked for by its short name, which nothing pins: the model that answered is kept beside it.
    inHand(p, blockOf("opus").slice(2));
    assert.equal(heldUpBy("haiku", p.recordRoot), null);
    p.setPlan({ uses: [{ tool: "Bash", input: { command: "true" }, result: "" }], cost: 0.05, model: "claude-haiku-as-the-harness-has-it" });
    const haikuOne = await runOne({ ...p.common, block: "haiku" });
    seen = p.seen();
    assert.deepEqual([haikuOne.run.name, haikuOne.recordDir, haikuOne.result.problems], ["haiku/one/plain-1", join(p.recordRoot, "haiku", "one", "plain-1"), []]);
    assert.deepEqual([flagOf(seen.args, "--model"), flagOf(seen.args, "--effort"), flagOf(seen.args, "--max-budget-usd")], ["haiku", "high", "1"]);
    assert.deepEqual(pins(seen.environment), ["ANTHROPIC_DEFAULT_FABLE_MODEL", "ANTHROPIC_DEFAULT_OPUS_MODEL", "ANTHROPIC_DEFAULT_SONNET_MODEL"]);
    assert.deepEqual(haikuOne.result.watchdog, { usd: 1, minutes: 25, fired: null, is_not_a_graphs_stop: true });
    assert.deepEqual([haikuOne.result.given.the_sessions_model, haikuOne.result.given.short_names_of_a_model], [{ block: "haiku", asked_for: "haiku", effort: "high" }, SHORT_NAMES]);
    assert.deepEqual([haikuOne.result.measures.session.models_that_answered, haikuOne.result.models], [["claude-haiku-as-the-harness-has-it"], ["claude-haiku-as-the-harness-has-it"]], "the name asked for and the model that answered are both in the record");
    const haikuFour = await runOne({ ...p.common, block: "haiku" });
    assert.deepEqual([haikuFour.run.name, flagOf(p.seen().args, "--model"), flagOf(p.seen().args, "--max-budget-usd"), haikuFour.result.watchdog.usd, haikuFour.result.watchdog.minutes], ["haiku/four/plain-1", "haiku", "3", 3, 60]);
    assert.deepEqual(p.ledger().invocations.map((entry) => [entry.run, entry.max_budget_usd]), [["watching/opus/one/plain-1", 5], ["watching/opus/four/plain-1", 15], ["watching/haiku/one/plain-1", 1], ["watching/haiku/four/plain-1", 3]]);
    assert.deepEqual(readdirSync(p.at.work), []);
  } finally {
    rmSync(p.top, { recursive: true, force: true });
  }
});

test("a session of the watching check is started with no pin on haiku and the other three as the profile pins them; called as the other runners call it, commandFor still pins all four", () => {
  const home = "/Users/someone/grooph-compare";
  const ask = (more = {}) => commandFor({ home, claude: "/Users/someone/.local/bin/claude", cwd: join(home, "work", "a1b2", "printkit"), prompt: "go", model: "haiku", effort: "high", sessionId: "11111111-2222-3333-4444-555555555555", maxBudgetUsd: 1, user: "someone", userHome: "/Users/someone", ...more });
  const usual = ask();
  const watching = ask({ unpinned: LEFT_TO_THE_HARNESS });
  // The default: the four pins, as every other runner's session has them.
  assert.deepEqual(Object.entries(usual.env).filter(([name]) => /^ANTHROPIC_DEFAULT_/.test(name)), [["ANTHROPIC_DEFAULT_FABLE_MODEL", "claude-opus-5-5"], ["ANTHROPIC_DEFAULT_OPUS_MODEL", "claude-opus-5-5"], ["ANTHROPIC_DEFAULT_SONNET_MODEL", "claude-sonnet-5-5"], ["ANTHROPIC_DEFAULT_HAIKU_MODEL", "claude-haiku-4-5-20251001"]]);
  assert.deepEqual(ask({ unpinned: [] }), usual, "naming nothing to leave to the harness is the same call");
  // This check's: that one variable is gone, and nothing else of the environment or the command is another.
  assert.ok(!("ANTHROPIC_DEFAULT_HAIKU_MODEL" in watching.env));
  assert.deepEqual(Object.entries(watching.env), Object.entries(usual.env).filter(([name]) => name !== "ANTHROPIC_DEFAULT_HAIKU_MODEL"), "every other variable, with its value, in its order");
  assert.deepEqual([watching.argv, watching.cwd, watching.transcript], [usual.argv, usual.cwd, usual.transcript]);
  assert.deepEqual([watching.env.ANTHROPIC_DEFAULT_FABLE_MODEL, watching.env.ANTHROPIC_DEFAULT_OPUS_MODEL, watching.env.ANTHROPIC_DEFAULT_SONNET_MODEL], ["claude-opus-5-5", "claude-opus-5-5", "claude-sonnet-5-5"]);
  // What a record says of it is read from the names of the variables a session was started with.
  assert.deepEqual(shortNamesIn(Object.keys(watching.env)), SHORT_NAMES);
  assert.deepEqual(shortNamesIn(Object.keys(usual.env)), { pinned: { fable: "claude-opus-5-5", opus: "claude-opus-5-5", sonnet: "claude-sonnet-5-5", haiku: "claude-haiku-4-5-20251001" }, left_to_the_harness: [], read_from: SHORT_NAMES.read_from });
  assert.deepEqual(shortNamesIn(undefined).left_to_the_harness, ["fable", "opus", "sonnet", "haiku"], "an environment that was not kept shows no pin, and a record of that would say so");
});

test("a subagent's transcript that repeats its parent's lines adds nothing twice: a call and a message are counted once, for the first transcript that holds them", () => {
  const top = mkdtempSync(join(tmpdir(), "watching-repeat-"));
  const sid = "22222222-3333-4444-5555-666666666666";
  try {
    const folder = join(top, "profile", "projects", "-a-folder");
    mkdirSync(join(folder, sid, "subagents"), { recursive: true });
    const says = (id, ...blocks) => JSON.stringify({ type: "assistant", timestamp: "2026-10-09T10:00:00.000Z", message: { id, model: "claude-sonnet-5-5", usage: { input_tokens: 5, output_tokens: 7 }, content: blocks } });
    const parent = [says("m1", { type: "tool_use", id: "p1", name: "mcp__grooph__grooph_plan", input: { agents: [{ type: "general-purpose" }] } }), says("m2", { type: "tool_use", id: "a1", name: "Agent", input: { subagent_type: "general-purpose", prompt: "go" } })];
    writeFileSync(join(folder, `${sid}.jsonl`), `${parent.join("\n")}\n`, "utf8");
    // The subagent carries on from the conversation: its transcript opens with its parent's two lines, then its own.
    writeFileSync(join(folder, sid, "subagents", "agent-fff.jsonl"), `${[...parent, says("f1", { type: "tool_use", id: "e1", name: "Edit", input: { file_path: "a.mjs" } })].join("\n")}\n`, "utf8");
    writeFileSync(join(folder, sid, "subagents", "agent-fff.meta.json"), JSON.stringify({ agentType: "general-purpose", toolUseId: "a1" }), "utf8");
    const m = measure({ profile: join(top, "profile"), sessionId: sid });
    assert.deepEqual([m.the_two_tools.calls, m.the_two_tools.said.length, m.the_two_tools.said[0].by], [{ grooph_plan: 1, grooph_note: 0 }, 1, "the session"], "said once, by the session");
    assert.deepEqual(m.session.tool_calls_with_its_subagents, { Agent: 1, Edit: 1, mcp__grooph__grooph_plan: 1 });
    assert.deepEqual([m.session.messages, m.session.tokens_in_its_transcript.output_tokens], [2, 14]);
    assert.deepEqual([m.subagents.each[0].tool_calls, m.subagents.each[0].messages, m.subagents.each[0].tokens.output_tokens], [{ Edit: 1 }, 1, 7], "the subagent's own is what only it holds");
    assert.deepEqual([m.subagents.each[0].depth, m.subagents.each[0].depth_from], [1, "the tool use that started it"], "and it was started by the session, not by itself");
    // Lines that carry no id at all are each their own: nothing is taken for a repeat that cannot be known to be one.
    const bare = (name) => JSON.stringify({ type: "assistant", message: { model: "claude-sonnet-5-5", content: [{ type: "tool_use", name, input: {} }] } });
    writeFileSync(join(folder, "bare.jsonl"), `${bare("Read")}\n${bare("Read")}\n`, "utf8");
    mkdirSync(join(folder, "bare", "subagents"), { recursive: true });
    writeFileSync(join(folder, "bare", "subagents", "agent-g.jsonl"), `${bare("Read")}\n`, "utf8");
    assert.deepEqual([measure({ profile: join(top, "profile"), sessionId: "bare" }).session.tool_calls_with_its_subagents, measure({ profile: join(top, "profile"), sessionId: "bare" }).session.messages], [{ Read: 3 }, 2]);
  } finally {
    rmSync(top, { recursive: true, force: true });
  }
});

test("what goes wrong after a session has started is in its record, whichever step it was, and stops the runs after it", { skip: !built }, async () => {
  // The last steps before the result are the ones a record could lose: here the measures themselves fail.
  const p = place({ uses: [], cost: 0.2 });
  try {
    const done = await runOne({ ...p.sonnet, measureWith: () => { throw new Error("the measures could not be read"); } });
    assert.deepEqual([done.result.measures, done.result.the_hooks_file_beside_the_transcripts, done.result.problems], [null, null, ["the measures: the measures could not be read"]]);
    assert.equal(waitsForAPerson(done), "its record has problems");
    assert.deepEqual(JSON.parse(readFileSync(join(done.recordDir, "result.json"), "utf8")).problems, ["the measures: the measures could not be read"], "and it is in the file, not only in what came back");
    assert.equal(done.result.scored, true, "the rest of the record is kept all the same");
    const all = await runAll({ ...p.sonnet, measureWith: () => { throw new Error("again"); } });
    assert.deepEqual([all.done.length, all.stopped], [1, { after: "sonnet/four/plain-1", why: "its record has problems", by_the_harness: false }], "the run after it is the last one started");
  } finally {
    rmSync(p.top, { recursive: true, force: true });
  }
  // A folder left where the hook's file would be: nothing is thrown, the hook's file is said not to be there.
  const q = place({ uses: [{ tool: "Bash", input: { command: "true" }, result: "", writes: { ".grooph/events/<session>.jsonl/x.txt": "x" } }], cost: 0.2 });
  try {
    inHand(q, order().slice(0, 2));
    const done = await runOne(q.sonnet);
    assert.equal(done.run.name, "sonnet/one/watched-1");
    assert.deepEqual([done.result.the_hooks_file_beside_the_transcripts.the_hook_wrote_a_file_for_this_session, done.result.problems], [false, []]);
  } finally {
    rmSync(q.top, { recursive: true, force: true });
  }
});

test("a total that is whole in every line and a hair over in arithmetic leaves the room it should, and the run starts under its own ceiling", { skip: !built }, async () => {
  // 124.2 + 3.94 + 5.86 is 134 in dollars and 134.00000000000003 in a sum of floating numbers.
  const lines = [124.2, 3.94, 5.86].map((cost, i) => ({ ...settled(`watching/x/y/z-${i}`, cost), n: i + 1 }));
  assert.ok(lines.reduce((sum, line) => sum + line.cost_usd, 0) > 134, "the sum this is about");
  assert.deepEqual([room({ cap_usd: 140, invocations: lines }, 6).ok, room({ cap_usd: 140, invocations: lines }, 6).left], [true, 6]);
  const p = place({ uses: [], cost: 0.2 }, { lines });
  try {
    inHand(p, [order()[0]]);
    const done = await runOne(p.sonnet);
    assert.deepEqual([done.run.name, done.result.watchdog.usd, p.ledger().invocations.at(-1).max_budget_usd, done.result.problems], ["sonnet/four/plain-1", 6, 6, []], "started, and with the protocol's ceiling for a run of four in its block");
    assert.equal(p.seen().args[p.seen().args.indexOf("--max-budget-usd") + 1], "6");
    // And a cent more counted would have refused it.
    assert.equal(room({ cap_usd: 140, invocations: [...lines, { cost_usd: 0.01, max_budget_usd: 2 }] }, 6).ok, false);
  } finally {
    rmSync(p.top, { recursive: true, force: true });
  }
});

test("a runner stopped between the ledger and the record leaves a line and no record: nothing starts over it, it is settled by hand, and the run is made once more", { skip: !built }, async () => {
  const left = { n: 1, run: "watching/sonnet/one/plain-1", project: "watching/sonnet/one", arm: "plain", replicate: 1, kind: "kickoff", status: "running", cost_usd: null, reported_cost_usd: null, max_budget_usd: 2, started: "2026-10-09T00:00:00.000Z", ended: null, note: "the watching check: sonnet, one, plain" };
  const p = place({ uses: [], cost: 0.2 }, { lines: [left] });
  try {
    assert.equal(nextRun(p.recordRoot).name, "sonnet/one/plain-1");
    await assert.rejects(runOne(p.sonnet), notStarted(/sonnet\/one\/plain-1 has a line on the ledger \(1\) and no record: the runner was stopped before it could write one\. Settle that line first \(--settle 1 /));
    await assert.rejects(runOne({ ...p.common, rerun: "sonnet/one/plain-1" }), notStarted(/its line on the ledger \(1\) is still marked running: settle that first/));
    assert.deepEqual([readdirSync(p.at.work), p.ledger().invocations.length], [[], 1], "nothing was made");
    // Settled by hand: what the harness reported where that can be read, or its ceiling.
    assert.throws(() => settleLine({ n: 7, cost: null, note: "the machine slept", ledgerPath: p.ledgerPath }), notStarted(/7 is not a line of the watching check's ledger still marked running/));
    assert.throws(() => settleLine({ n: 1, cost: Number("a lot"), note: "the machine slept", ledgerPath: p.ledgerPath }), notStarted(/--cost is what the harness reported/));
    assert.throws(() => settleLine({ n: 1, cost: -1, note: "the machine slept", ledgerPath: p.ledgerPath }), notStarted(/--cost is what the harness reported/));
    assert.throws(() => settleLine({ n: 1, cost: null, note: "ok", ledgerPath: p.ledgerPath }), notStarted(/--note says what happened/));
    const line = settleLine({ n: 1, cost: null, note: "the machine slept during the run; no output of the harness was kept", ledgerPath: p.ledgerPath });
    assert.deepEqual([line.status, line.cost_usd, p.ledger().invocations[0].status, p.ledger().spent_usd], ["failed", null, "failed", 2], "with no cost known it still counts at its ceiling");
    assert.match(p.ledger().invocations[0].note, /settled by hand: the machine slept/);
    assert.throws(() => settleLine({ n: 1, cost: 0.5, note: "a second time, with a cost", ledgerPath: p.ledgerPath }), notStarted(/not a line .* still marked running/), "a settled line is not settled again");
    // Still nothing in passing; once more by name.
    await assert.rejects(runOne(p.sonnet), notStarted(/has a line on the ledger \(1\) and no record.* Then it may be run once more.*--rerun sonnet\/one\/plain-1/));
    const again = await runOne({ ...p.common, rerun: "sonnet/one/plain-1" });
    assert.equal(again.recordDir, join(p.recordRoot, "sonnet", "one", "plain-1-rerun"));
    assert.match(again.result.rerun_because, /the runner was stopped before it recorded the run; its line on the ledger \(1\) says: .*settled by hand: the machine slept/);
    assert.deepEqual([p.ledger().invocations.map((entry) => entry.run), nextRun(p.recordRoot).name], [["watching/sonnet/one/plain-1", "watching/sonnet/one/plain-1-rerun"], "sonnet/four/plain-1"], "and the order goes on from the run after it");
    assert.deepEqual([stateOf(order()[0], p.recordRoot).state, stateOf(order()[0], p.recordRoot).from], ["recorded and scored", "its rerun"]);
    await assert.rejects(runOne({ ...p.common, rerun: "sonnet/one/plain-1" }), notStarted(/was already run once more/));
    // The command line does the same, and changes nothing when it is asked wrongly.
    const ask = (...flags) => spawnSync(process.execPath, [SCRIPT, ...flags], { encoding: "utf8" });
    const none = ask("--settle", "99", "--cost", "ceiling", "--note", "there is no such line here");
    assert.deepEqual([none.status, /is not a line of the watching check's ledger still marked running\nNothing was changed\./.test(none.stderr)], [64, true], none.stderr);
  } finally {
    rmSync(p.top, { recursive: true, force: true });
  }
  // A line of the ledger the paid path itself refuses over is said for this ledger, with the command that settles it.
  const q = place({ uses: [], cost: 0.2 }, { lines: [{ ...left, n: 1, run: "watching/sonnet/four/invited-2", project: "watching/sonnet/four", arm: "invited", replicate: 2 }] });
  try {
    await assert.rejects(runOne(q.sonnet), notStarted(/invocation 1 is still marked running.*\n {2}This check has a ledger of its own \(experiments\/watching\/ledger\.json\), and compare-ledger\.mjs opens the comparisons ledger and not it\. A line left running is settled with: node scripts\/lib\/watching-check-paid\.mjs --settle/));
    assert.deepEqual(readdirSync(q.at.work), []);
  } finally {
    rmSync(q.top, { recursive: true, force: true });
  }
});

test("called as the other runners call it, the profile's command is what it was: adding a server changed nothing for them", () => {
  // The first call's record is held against this checksum of the settings and the fixed part of the command. It is
  // the value it had before a run could name a server (computed on the branch's parent, 2026-10-09).
  assert.equal(profileFingerprint(), "0f740513e4dabd6b8939ffec6613a853455b10a5f6aac04a0dc699450982286e", "if the profile itself was changed on purpose, this line changes with it; a change to commandFor alone must not move it");
});
