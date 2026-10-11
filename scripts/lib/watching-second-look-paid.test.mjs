// Tests of the second look's runner that spend nothing: where a session would be started, a stand-in program is,
// which calls no model (scripts/lib/fixtures/stand-in-harness.mjs). The profile, the ledger, the records and every
// place an install is told of are temporary. Nothing here starts a model session, touches the real profile, or names
// the owner's own ~/.claude, ~/.codex or ~/.grooph to anything that writes.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { cpSync, existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import { layout, settingsFor } from "./compare-profile.mjs";
import { scoreHeldOut } from "./compare-score.mjs";
import { NotStarted } from "./study-three-paid.mjs";
import { CLI, promptFor as firstChecksPromptFor, SUBAGENTS_SENTENCE } from "./watching-check-paid.mjs";
import { agentByAgent, delegation, DIFFERENCES, EXPECTED, mostAtOnce, noticed, readSession } from "./watching-second-look-measures.mjs";
import {
  ARMS,
  BLOCKS,
  build,
  dryRun,
  eventsOf,
  groophHomeIn,
  heldUpBy,
  installOutside,
  launcherText,
  LEAD,
  LEDGER,
  nextRun,
  order,
  placesFor,
  promptFor,
  readLedger,
  recordOf,
  rehearse,
  ROUNDS,
  room,
  runAll,
  runOne,
  SENTENCE,
  settleLine,
  SHIPPED_HOOK,
  SIX_OPENS,
  stateOf,
  status,
  STOPS_AT_USD,
  TASKS,
  taskText,
  theOwnersOwn,
  USER_ENTRY,
  WATCHDOG,
  whatTheInstallLeft,
} from "./watching-second-look-paid.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..", "..");
const comparisons = join(root, "experiments", "comparisons");
const STAND_IN = join(here, "fixtures", "stand-in-harness.mjs");
const SCRIPT = join(here, "watching-second-look-paid.mjs");
const TABLES = join(root, "experiments", "watching", "second-look", "tables.mjs");
const built = existsSync(join(root, "packages", "cli", "dist"));
const page = readFileSync(join(root, "experiments", "watching", "second-look", "README.md"), "utf8");
const DECISION = { decided_by: "the owner", on: "2026-10-11", words: "a test's stand-in for his words" };
const notStarted = (pattern) => (error) => error instanceof NotStarted && pattern.test(error.message);
const REHEARSED = { ok: true, left: { entries: 3, at_events: ["SessionStart", "SubagentStart", "SubagentStop"], hook_sha256: "a-test's" }, said: "" };
/** Whether this checkout's own grooph installs the recorder outside a project yet: it does once slice 0108 is on main. */
const knowsUser = built && String(spawnSync(process.execPath, [CLI, "hooks", "install", "--help"], { encoding: "utf8" }).stdout).includes("--user");

/** Every file under a folder, by its path from it, `.git` left out. */
function filesUnder(dir, base = dir) {
  return readdirSync(dir)
    .sort()
    .flatMap((name) => (name === ".git" && dir === base ? [] : lstatSync(join(dir, name)).isDirectory() ? filesUnder(join(dir, name), base) : [join(dir, name).slice(base.length + 1)]));
}

/**
 * A stand-in for the tool that installs the recorder outside a project, as slice 0108's does it: the hook's file under
 * GROOPH_HOME, entries in CLAUDE_CONFIG_DIR/settings.json that run it with `--user`, and a list. `how` makes it do one
 * thing wrong, for the checks that have to catch it.
 */
function standInTool(dir, how = "") {
  const path = join(dir, `stand-in-grooph${how ? `-${how}` : ""}.mjs`);
  writeFileSync(
    path,
    `import { cpSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
const [a, b, c, ...rest] = process.argv.slice(2);
const how = ${JSON.stringify(how)};
const home = how === "in-the-folder" ? join(process.cwd(), ".grooph") : process.env.GROOPH_HOME;
const settingsAt = join(process.env.CLAUDE_CONFIG_DIR, "settings.json");
if (a === "hooks" && b === "install" && c === "--user") {
  if (how === "refuses") { console.error("grooph: Unknown option '--user'"); process.exit(1); }
  mkdirSync(join(home, "hooks"), { recursive: true });
  if (how === "another-hook") writeFileSync(join(home, "hooks", "grooph-event.mjs"), "// not the shipped hook\\n");
  else cpSync(${JSON.stringify(SHIPPED_HOOK)}, join(home, "hooks", "grooph-event.mjs"));
  const settings = JSON.parse(readFileSync(settingsAt, "utf8"));
  const entry = { hooks: [{ type: "command", command: \`node "\${join(home, "hooks", "grooph-event.mjs")}" claude-code --user\`, async: true, timeout: 10 }] };
  settings.hooks = { SessionStart: [entry], SubagentStart: [entry], SubagentStop: [entry] };
  if (how === "another-setting") settings.autoMemoryEnabled = true;
  writeFileSync(settingsAt, JSON.stringify(settings, null, 2) + "\\n");
  console.log("wrote the hook and its entries");
} else if (a === "hooks" && b === "watch") {
  writeFileSync(join(home, "watched.json"), JSON.stringify({ folders: [{ path: c, events: "packages" }] }));
  console.log("listed: " + c);
} else {
  console.error("not a command of the stand-in");
  process.exit(2);
}
`,
    "utf8",
  );
  return path;
}

/** A temporary home with a profile, a ledger of the repository's shape and a place for records; the stand-in's plan goes in the profile. */
function place(plan = { uses: [] }, { decided = true, lines = [] } = {}) {
  const top = realpathSync(mkdtempSync(join(tmpdir(), "second-look-")));
  const home = join(top, "home");
  const at = layout(home);
  for (const dir of [at.profile, at.shell, at.temp, at.cache, at.work]) mkdirSync(dir, { recursive: true });
  const setPlan = (next) => writeFileSync(join(at.profile, "stand-in-plan.json"), JSON.stringify(next), "utf8");
  setPlan(plan);
  const ledgerPath = join(top, "ledger.json");
  const kept = JSON.parse(readFileSync(LEDGER, "utf8"));
  writeFileSync(ledgerPath, JSON.stringify({ ...kept, invocations: lines, scoring_outside_the_sandbox: decided ? DECISION : { decided_by: null, on: null, words: null } }), "utf8");
  const harness = join(top, "stand-in-harness");
  writeFileSync(harness, `#!/bin/sh\nexec ${JSON.stringify(process.execPath)} ${JSON.stringify(STAND_IN)} "$@"\n`, { mode: 0o755 });
  const recordRoot = join(top, "records");
  const common = { home, claude: harness, ledgerPath, recordRoot, profileCheck: () => [], gameOpen: [], go: "the driver said: run the second look", grace: 300, firstCallGate: { ok: true, record: "record" }, cli: standInTool(top), rehearsal: () => REHEARSED };
  return { top, home, at, harness, ledgerPath, recordRoot, common, opus: { ...common, block: "opus" }, setPlan, ledger: () => JSON.parse(readFileSync(ledgerPath, "utf8")), seen: () => JSON.parse(readFileSync(join(at.profile, "command-seen-by-the-stand-in.json"), "utf8")), settingsSeen: () => JSON.parse(readFileSync(join(at.profile, "settings-seen-by-the-stand-in.json"), "utf8")) };
}
/** Records put in the order's way as already made: a run with a result is a run that is recorded. */
function inHand(recordRoot, runs, result = { ended_by: "the session" }) {
  for (const run of runs) {
    mkdirSync(join(recordRoot, run.name), { recursive: true });
    writeFileSync(join(recordRoot, run.name, "result.json"), JSON.stringify(result), "utf8");
  }
}
const blockOf = (block) => order().filter((run) => run.block === block);
/** A line of the hook's file, as the hook writes it. `<session>` stands for the session's id in a stand-in's plan. */
const line = (event, more = {}, t = "2026-10-05T00:00:00.000Z") => JSON.stringify({ v: 1, t, harness: "claude-code", event, session: "<session>", ...more });

// ── the protocol's own words ─────────────────────────────────────────────

test("the thirty-six runs: three rounds of six in each block, the arms changing places so that each goes first, second and last once", () => {
  assert.deepEqual(BLOCKS, ["opus", "sonnet"]);
  assert.deepEqual(ARMS, ["plain", "watched", "outside"]);
  // Each arm in each place exactly once: the rounds are a Latin square.
  for (let at = 0; at < 3; at += 1) assert.deepEqual(ROUNDS.map((arms) => arms[at]).sort(), [...ARMS].sort(), `place ${at + 1}`);
  for (const arms of ROUNDS) assert.deepEqual([...arms].sort(), [...ARMS].sort());
  // The page's own table, read from the page: each round's six runs in its words.
  const rows = [...page.matchAll(/^\| ([123]) \| (.+?) \|$/gm)].map((row) => [Number(row[1]), row[2].split(", ").map((part) => /^`(\w+)` (\w+)$/.exec(part).slice(1)).map(([task, arm]) => `${task}/${arm}`)]);
  assert.equal(rows.length, 3);
  for (const block of BLOCKS) {
    assert.equal(blockOf(block).length, 18, block);
    for (const [round, six] of rows) assert.deepEqual(blockOf(block).filter((run) => run.round === round).map((run) => `${run.task}/${run.arm}`), six, `${block}, round ${round}`);
  }
  assert.ok(page.includes("\nThirty-six runs. "));
  assert.deepEqual([order().length, new Set(order().map((run) => run.name)).size, new Set(order().map((run) => recordOf(run, "/records"))).size], [36, 36, 36]);
  assert.deepEqual([order()[0].name, order()[6].name, order()[12].name, order()[18].name, order()[35].name], ["opus/four/plain-1", "opus/four/watched-2", "opus/four/outside-3", "sonnet/four/plain-1", "sonnet/six/watched-3"]);
  assert.equal(recordOf(order()[5]), join(root, "experiments", "watching", "second-look", "opus", "six", "outside-1"));
  for (const run of order()) assert.deepEqual([run.replicate, run.name], [run.round, `${run.block}/${run.task}/${run.arm}-${run.round}`]);
});

test("the sentence, the two models, the limits and the tasks are the page's, to the letter", () => {
  assert.ok(page.includes(`\n> ${SENTENCE}\n`), "the sentence every prompt ends its task with");
  assert.ok(page.includes(`The first check said "${SUBAGENTS_SENTENCE}"`), "and the first check's, which it takes the place of");
  assert.ok(page.includes("| `opus` | Claude Opus 5.5 (`claude-opus-5-5`) |"));
  assert.ok(page.includes("| `sonnet` | Claude Sonnet 5.5 (`claude-sonnet-5-5`) |"));
  assert.deepEqual(LEAD, { opus: { model: "claude-opus-5-5", effort: "high" }, sonnet: { model: "claude-sonnet-5-5", effort: "high" } });
  assert.deepEqual(Object.keys(LEAD), BLOCKS);
  for (const lead of Object.values(LEAD)) assert.ok(!/fable|astra/i.test(lead.model));
  // The limits: the page's table, and the same rows made from the runner's numbers, so that neither moves without the other.
  for (const block of BLOCKS) assert.ok(page.includes(`| \`${block}\` | $${WATCHDOG[block].four.usd.toFixed(2)}, ${WATCHDOG[block].four.minutes} minutes | $${WATCHDOG[block].six.usd.toFixed(2)}, ${WATCHDOG[block].six.minutes} minutes |`), block);
  assert.deepEqual(WATCHDOG, { opus: { four: { usd: 12, minutes: 40 }, six: { usd: 18, minutes: 60 } }, sonnet: { four: { usd: 5, minutes: 40 }, six: { usd: 8, minutes: 60 } } });
  assert.ok(page.includes("The whole look stops at **$200.00** on a ledger of its own"));
  assert.equal(STOPS_AT_USD, 200);
  const at = (block) => blockOf(block).reduce((sum, run) => sum + WATCHDOG[run.block][run.task].usd, 0);
  assert.deepEqual([at("opus"), at("sonnet")], [270, 117]);
  assert.ok(page.includes("the thirty-six runs would come to **$387.00**: $270.00 for the `opus` block (nine runs at $12.00 and nine at $18.00) and $117.00 for `sonnet` (nine at $5.00 and nine at $8.00)"));
  assert.ok(page.includes("At the minute limits a block would take fifteen hours"));
  assert.equal(blockOf("opus").reduce((sum, run) => sum + WATCHDOG.opus[run.task].minutes, 0), 15 * 60);
  // Each package is the task of the project the page names for it, under the name its own package.json gives it.
  for (const pkg of TASKS.six.packages) {
    assert.equal(JSON.parse(readFileSync(join(comparisons, pkg.project, "task", "package.json"), "utf8")).name, pkg.name);
    assert.ok(new RegExp(`\`${pkg.name}\`[^;\\n]{0,80}?comparisons/${pkg.project}/`).test(page), `${pkg.name} is ${pkg.project}'s task, by the page`);
  }
  assert.deepEqual(TASKS.four.packages.map((pkg) => pkg.folder), ["settingskit", "textwrap", "csvline", "semver-mini"]);
  assert.deepEqual(TASKS.six.packages.map((pkg) => pkg.folder), ["settingskit", "textwrap", "csvline", "semver-mini", "printkit", "textkit"]);
  assert.deepEqual(TASKS.six.packages.slice(0, 4), TASKS.four.packages, "`six` is those four and two more");
});

test("each unseen suite holds as many cases as the runner says, counted against the repository's own task folder", () => {
  // Only the repository's own code is run here: the suite against the task as its project keeps it, with no work in it.
  for (const pkg of TASKS.six.packages) {
    const tree = mkdtempSync(join(tmpdir(), "second-look-suite-"));
    try {
      cpSync(join(comparisons, pkg.project, "task"), tree, { recursive: true });
      const held = scoreHeldOut(tree, join(comparisons, pkg.project, "held-out"));
      assert.deepEqual([held.ran, held.cases], [true, pkg.cases], pkg.name);
    } finally {
      rmSync(tree, { recursive: true, force: true });
    }
  }
});

test("the prompt is the same in every arm; `four` is the first check's wide task to the letter up to the closing sentence, and `six` is worded the same way for six", () => {
  for (const task of Object.keys(TASKS)) assert.equal(new Set(ARMS.map((arm) => promptFor({ task, arm }))).size, 1, `${task}: no arm differs by its prompt`);
  const first = firstChecksPromptFor({ task: "four", arm: "plain" });
  assert.ok(first.endsWith(`\n${SUBAGENTS_SENTENCE}\n`));
  assert.equal(promptFor({ task: "four" }), `${first.slice(0, -`${SUBAGENTS_SENTENCE}\n`.length)}${SENTENCE}\n`);
  const six = promptFor({ task: "six" });
  assert.ok(six.startsWith(`${SIX_OPENS}\n\nThe package in the folder \`settingskit/\`:\n\n# Task\n`));
  assert.ok(SIX_OPENS.startsWith("This repository holds six packages side by side") && !/four/.test(SIX_OPENS));
  assert.ok(six.endsWith(`\n\n${SENTENCE}\n`));
  assert.deepEqual([...six.matchAll(/^The package in the folder `([^`]+)\/`:$/gm)].map((found) => found[1]), TASKS.six.packages.map((pkg) => pkg.folder));
  // The part of `six` before its fifth package is `four` with the one number changed.
  assert.equal(six.slice(0, six.indexOf("The package in the folder `printkit/`:")), taskText("four").replace("holds four packages", "holds six packages").replace("There are four tasks", "There are six tasks").replace(/\n$/, "\n\n"));
  // Nothing in a prompt says how many subagents, which kind, on which model or in what order.
  for (const word of ["general-purpose", "background", "foreground", "Explore", "opus", "sonnet", "haiku", "grooph"]) assert.ok(!six.includes(word), word);
  assert.throws(() => taskText("one"), notStarted(/not a task of the second look/));
});

// ── the order, and what holds a block up ─────────────────────────────────

test("the next run, a block made without its outside arm or through an early round, and what holds the second block up", () => {
  const top = mkdtempSync(join(tmpdir(), "second-look-order-"));
  try {
    assert.deepEqual([nextRun(top).name, nextRun(top, "sonnet").name], ["opus/four/plain-1", "sonnet/four/plain-1"]);
    assert.match(heldUpBy("sonnet", top).why, /the `opus` block, which comes before it, has no whole round/);
    assert.equal(heldUpBy("opus", top), null);
    const opus = blockOf("opus");
    // The first four in the order are round one's plain and watched runs.
    inHand(top, opus.slice(0, 3));
    assert.equal(nextRun(top, "opus").name, "opus/six/watched-1");
    assert.match(heldUpBy("sonnet", top).why, /has a round begun and not finished \(opus\/six\/watched-1 with no record\)/);
    inHand(top, opus.slice(3, 4));
    // Round one is whole without its outside arm: a block may be made without it, and the next may then start.
    assert.equal(heldUpBy("sonnet", top), null);
    assert.equal(nextRun(top, "opus").name, "opus/four/outside-1");
    assert.equal(nextRun(top, "opus", { withoutOutside: true }).name, "opus/four/watched-2");
    assert.equal(nextRun(top, "opus", { withoutOutside: true, throughRound: 1 }), null, "round one is done, the outside arm left out");
    assert.equal(nextRun(top, "opus", { throughRound: 1 }).name, "opus/four/outside-1");
    // Round two begun: the next block waits again until it is finished.
    inHand(top, [opus.find((run) => run.name === "opus/four/watched-2")]);
    assert.match(heldUpBy("sonnet", top).why, /a round begun and not finished \(opus\/six\/watched-2, opus\/four\/plain-2, opus\/six\/plain-2 with no record\)/);
    // A run the harness ended has a record and holds nothing up; it reads as waiting for its one rerun.
    inHand(top, opus.filter((run) => run.round === 2 && run.arm !== "outside" && run.name !== "opus/four/watched-2"), { ended_by: "the harness", why: "no result from the harness (exit 1)" });
    assert.equal(heldUpBy("sonnet", top), null);
    assert.equal(stateOf(opus.find((run) => run.name === "opus/six/plain-2"), top).state, "ended by the harness, and not yet run again");
    assert.equal(stateOf(opus[0], top).state, "recorded, not scored");
    assert.equal(stateOf(opus.at(-1), top).state, "not recorded");
  } finally {
    rmSync(top, { recursive: true, force: true });
  }
});

// ── the ledger and the gates ─────────────────────────────────────────────

test("the ledger as the repository keeps it: the protocol's cap and ceilings, no line, and the owner's decision on scoring not yet written in", () => {
  const kept = readLedger();
  assert.deepEqual([kept.cap_usd, kept.refuse_below_usd, kept.per_invocation_ceiling_usd], [200, 5, 18]);
  assert.deepEqual(Object.keys(kept.scoring_outside_the_sandbox), ["about", "decided_by", "on", "words"]);
  assert.match(kept.scoring_outside_the_sandbox.about, /for this look by name: the decision recorded for the first check, or for any other experiment, is not read here/);
  // THE OWNER'S DECISION. He gave it on 2026-10-11 (the review desk, card q91) and the driver writes it into the ledger.
  // Until then the three fields are empty and nothing starts. When the driver fills them, this line is the one that changes.
  assert.deepEqual([kept.scoring_outside_the_sandbox.decided_by, kept.scoring_outside_the_sandbox.on, kept.scoring_outside_the_sandbox.words], [null, null, null]);
  assert.ok(page.includes("The first check's decision is not read for this one."));
  assert.equal(kept.invocations.filter((entry) => entry.status === "running").length, 0);
  // A ledger that states other limits than the protocol's is a refusal, each number by name.
  const top = mkdtempSync(join(tmpdir(), "second-look-ledger-"));
  try {
    const path = join(top, "ledger.json");
    writeFileSync(path, JSON.stringify({ ...kept, cap_usd: 500, per_invocation_ceiling_usd: 50, watchdog: { ...kept.watchdog, opus: { ...kept.watchdog.opus, six: { usd: 40, minutes: 60 } } } }), "utf8");
    assert.throws(() => readLedger(path), notStarted(/its cap is 500, and the protocol's is 200.*run of `six` in the `opus` block.*the most it gives one session is 50, and the protocol's largest ceiling is 18/s));
    assert.throws(() => readLedger(join(top, "none.json")), notStarted(/the second look's ledger could not be read/));
    assert.deepEqual([room({ cap_usd: 200, invocations: [{ cost_usd: 185 }] }, 12).ok, room({ cap_usd: 200, invocations: [{ cost_usd: 185 }] }, 18).ok, room({ cap_usd: 200, invocations: [{ cost_usd: null, max_budget_usd: 18, status: "running" }, { cost_usd: 170 }] }, 18).ok], [true, false, false]);
  } finally {
    rmSync(top, { recursive: true, force: true });
  }
});

test("no run starts without the first call's yes, the owner's decision for this look, a block named, the driver's word, and room on the ledger", async () => {
  const p = place();
  try {
    await assert.rejects(runOne({ ...p.opus, firstCallGate: { ok: false, why: "the first paid call has no record" } }), notStarted(/the first paid call has no record/));
    await assert.rejects(runOne({ ...p.common }), notStarted(/no block was named: say which block: --block opus or --block sonnet/));
    await assert.rejects(runOne({ ...p.common, block: "haiku" }), notStarted(/"haiku" is not a block of the second look/));
    await assert.rejects(runOne({ ...p.common, block: "sonnet" }), notStarted(/the `sonnet` block is not started while the `opus` block, which comes before it, has no whole round/));
    await assert.rejects(runOne({ ...p.opus, go: "" }), notStarted(/no word from the driver/));
    const undecided = place({ uses: [] }, { decided: false });
    try {
      await assert.rejects(runOne(undecided.opus), notStarted(/no decision of his is recorded \(experiments\/watching\/second-look\/ledger\.json, scoring_outside_the_sandbox/));
      assert.deepEqual(readdirSync(undecided.at.work), [], "refused before any folder was made");
    } finally {
      rmSync(undecided.top, { recursive: true, force: true });
    }
    const full = place({ uses: [] }, { lines: [{ n: 1, run: "second-look/x", project: "second-look/x", kind: "kickoff", status: "ok", cost_usd: 190, reported_cost_usd: 190, max_budget_usd: 18, started: "2026-10-11T00:00:00.000Z" }] });
    try {
      await assert.rejects(runOne(full.opus), notStarted(/has counted \$190\.00 on its ledger, and this run may cost up to \$12\.00: together past the \$200\.00/));
    } finally {
      rmSync(full.top, { recursive: true, force: true });
    }
    assert.deepEqual([readdirSync(p.at.work), p.ledger().invocations.length, existsSync(p.recordRoot)], [[], 0, false], "nothing was made, opened or recorded by any refusal");
  } finally {
    rmSync(p.top, { recursive: true, force: true });
  }
});

test("on the command line: a paid run without both flags or a block, a flag it does not know, a round that is none, and flags that do not go together are each refused", () => {
  const run = (...args) => spawnSync(process.execPath, [SCRIPT, ...args], { encoding: "utf8" });
  const refused = (out, pattern) => assert.deepEqual([out.status, pattern.test(out.stderr)], [64, true], out.stderr);
  refused(run("--all", "--block", "opus"), /will not without --spend and --go/);
  refused(run("--all", "--block", "opus", "--spend"), /will not without --go/);
  refused(run("--all", "--spend", "--go", "the driver's words"), /say which block: --block opus or --block sonnet/);
  refused(run("--spend", "--go", "the driver's words", "--block", "opus"), /say which: --next .* --all .* or --rerun/);
  refused(run("--block", "haiku", "--dry-run"), /--block names a block of the look: opus, sonnet/);
  refused(run("--everything"), /--everything: not a flag of this script\. Nothing was started\./);
  refused(run("--all", "--block", "opus", "--through-round", "4", "--spend", "--go", "x"), /--through-round names a round, 1 to 3/);
  refused(run("--status", "--spend"), /--status does not go with --spend/);
  refused(run("--run", "opus/four/plain-1", "--spend", "--go", "the driver's words"), /--run names a run for --dry-run only/);
  refused(run("--rerun", "opus/four/plain-1", "--without-outside", "--spend", "--go", "x"), /do not go with --rerun/);
  refused(run("--score", "opus/four/plain-9"), /is not a run of the second look|no decision of his is recorded/);
});

// ── the recorder outside the project ─────────────────────────────────────

test("every place an install outside the project is told of is named, and none may be the owner's own", () => {
  const places = placesFor({ groophHome: "/scratch/home/.grooph", configDir: "/scratch/profile" });
  assert.deepEqual(places, { GROOPH_HOME: "/scratch/home/.grooph", CLAUDE_CONFIG_DIR: "/scratch/profile", CODEX_HOME: "/scratch/home/.codex-is-not-used" });
  assert.deepEqual(theOwnersOwn("/Users/someone"), ["/Users/someone/.claude", "/Users/someone/.codex", "/Users/someone/.grooph"]);
  for (const own of theOwnersOwn()) {
    assert.throws(() => placesFor({ groophHome: own, configDir: "/scratch/profile" }), notStarted(/which is the owner's own/), own);
    assert.throws(() => placesFor({ groophHome: "/scratch/home/.grooph", configDir: join(own, "inside") }), notStarted(/CLAUDE_CONFIG_DIR would be .* which is the owner's own/), own);
  }
  // Left to its default, grooph's own folder would be the owner's: the profile's own is under the profile's home.
  assert.equal(groophHomeIn("/h"), "/h/home/.grooph");
  assert.throws(() => placesFor({ groophHome: groophHomeIn(homedir()).replace("/home/.grooph", "/.grooph"), configDir: "/scratch/profile" }), notStarted(/GROOPH_HOME would be/));
  // The launcher names all three on each command, asks the harness nothing unless a session is being started, and becomes it.
  const text = launcherText({ harness: "/bin/the harness", node: "/usr/bin/node", cli: "/repo/grooph.js", groophHome: "/scratch/home/.grooph", configDir: "/scratch/profile", folder: "/scratch/work/a/it's here", harnessDir: "/scratch/work/a/harness" });
  assert.equal(text.match(/GROOPH_HOME='\/scratch\/home\/\.grooph' CLAUDE_CONFIG_DIR='\/scratch\/profile' CODEX_HOME='\/scratch\/home\/\.codex-is-not-used' '\/usr\/bin\/node' '\/repo\/grooph\.js' hooks/g).length, 2);
  assert.ok(text.includes(`hooks install --user --harness claude-code &&`) && text.includes(`hooks watch '/scratch/work/a/it'\\''s here'`));
  assert.ok(text.includes(`if [ -z "$session" ]; then exec '/bin/the harness' "$@"; fi`) && text.trimEnd().endsWith(`exec '/bin/the harness' "$@"`));
  assert.ok(USER_ENTRY.test('node "/h/home/.grooph/hooks/grooph-event.mjs" claude-code --user') && !USER_ENTRY.test('node "$CLAUDE_PROJECT_DIR/.grooph/hooks/grooph-event.mjs" claude-code'));
});

test("the rehearsal of the install: an install that is refused, that leaves another hook, that changes another setting, that lands in the folder, or whose hook records nothing does not pass", () => {
  const top = realpathSync(mkdtempSync(join(tmpdir(), "second-look-rehearse-")));
  try {
    const why = (how) => {
      const rehearsed = rehearse({ cli: standInTool(top, how), home: join(top, "home") });
      assert.equal(rehearsed.ok, false, how);
      return rehearsed.why;
    };
    assert.match(why("refuses"), /did not install the recorder outside a project \(grooph hooks install --user exited 1: grooph: Unknown option '--user'\)\. That install is slice 0108's: until it is on main and built here, a block is started with --without-outside/);
    assert.match(why("another-hook"), /did not leave what the protocol says it leaves: .*grooph-event\.mjs is not the hook this checkout ships/);
    assert.match(why("another-setting"), /the install changed a setting that is not a hook/);
    assert.match(why("in-the-folder"), /no hook was left at .*home\/\.grooph\/hooks\/grooph-event\.mjs/);
    // What the stand-in leaves is right in every file, and the hook it copies is this checkout's. Whether that passes
    // goes by the hook: before slice 0108 it records nothing for a session outside its own project, and that is caught.
    const whole = rehearse({ cli: standInTool(top), home: join(top, "home") });
    if (!knowsUser) assert.match(whole.why, /a session in the listed folder left no line under grooph's own folder/);
    assert.deepEqual(readdirSync(top).filter((name) => !name.startsWith("stand-in-grooph")), [], "a rehearsal leaves nothing behind");
  } finally {
    rmSync(top, { recursive: true, force: true });
  }
});

test("this checkout's own grooph: the rehearsal passes once it installs the recorder outside a project, and until then says whose that is", { skip: !built }, () => {
  const rehearsed = rehearse();
  if (knowsUser) {
    assert.equal(rehearsed.ok, true, rehearsed.why);
    assert.ok(rehearsed.left.entries >= 3 && ["SessionStart", "SubagentStart", "SubagentStop"].every((event) => rehearsed.left.at_events.includes(event)));
  } else {
    assert.match(rehearsed.why, /did not install the recorder outside a project .*That install is slice 0108's/);
  }
  assert.match(status({ rehearsed, firstCallGate: { ok: true, record: "record" } }), rehearsed.ok ? /the outside arm: this checkout's grooph installs the recorder outside a project/ : /the outside arm: cannot be made as things stand/);
});

test("what an install left is held to the protocol: the shipped hook, entries that run it with --user, and every other setting as it was", () => {
  const top = realpathSync(mkdtempSync(join(tmpdir(), "second-look-left-")));
  try {
    const [groophHome, configDir] = [join(top, "home", ".grooph"), join(top, "profile")];
    mkdirSync(configDir, { recursive: true });
    const before = settingsFor({ home: join(top, "home") });
    writeFileSync(join(configDir, "settings.json"), JSON.stringify(before), "utf8");
    const said = installOutside({ cli: standInTool(top), groophHome, configDir, folder: join(top, "work"), cwd: top });
    assert.match(said, /\$ grooph hooks install --user --harness claude-code\nwrote the hook and its entries\n\n?\$ grooph hooks watch /);
    const left = whatTheInstallLeft({ groophHome, configDir, settingsBefore: before });
    assert.deepEqual([left.entries, left.at_events, left.every_other_setting_as_it_was], [3, ["SessionStart", "SubagentStart", "SubagentStop"], true]);
    assert.deepEqual(left.commands, [`node "${join(groophHome, "hooks", "grooph-event.mjs")}" claude-code --user`]);
    // A hook of someone else's in the user-level settings is not passed over.
    const settings = JSON.parse(readFileSync(join(configDir, "settings.json"), "utf8"));
    settings.hooks.Stop = [{ hooks: [{ type: "command", command: "echo something else" }] }];
    writeFileSync(join(configDir, "settings.json"), JSON.stringify(settings), "utf8");
    assert.throws(() => whatTheInstallLeft({ groophHome, configDir, settingsBefore: before }), /hold 1 hook\(s\) that are not the recorder's/);
    assert.equal(eventsOf(groophHome, "no-such-session"), null);
  } finally {
    rmSync(top, { recursive: true, force: true });
  }
});

// ── the three arms ───────────────────────────────────────────────────────

test("the three arms' folders: plain and outside are the task's packages byte for byte with nothing of grooph, and watched adds what grooph hooks install leaves", { skip: !built }, () => {
  const p = place();
  try {
    const made = {};
    for (const arm of ARMS) {
      const builtRun = build({ run: { block: "opus", task: "six", arm, replicate: 1, round: 1, name: `opus/six/${arm}-1` }, home: p.home, cli: p.common.cli, harness: p.harness });
      made[arm] = { files: filesUnder(builtRun.cwd), closed: builtRun.closed.map((path) => path.slice(builtRun.cwd.length + 1)), installed: builtRun.installed, outside: builtRun.outside, work: builtRun.work, beside: readdirSync(builtRun.work).sort() };
      for (const pkg of TASKS.six.packages) for (const file of filesUnder(join(comparisons, pkg.project, "task"))) assert.equal(readFileSync(join(builtRun.cwd, pkg.folder, file), "utf8"), readFileSync(join(comparisons, pkg.project, "task", file), "utf8"), `${arm}: ${pkg.folder}/${file}`);
      rmSync(builtRun.work, { recursive: true, force: true });
    }
    assert.deepEqual(made.outside.files, made.plain.files, "the outside arm's folder is the plain arm's");
    assert.ok(!made.plain.files.some((file) => file.startsWith(".grooph") || file.startsWith(".claude")));
    assert.deepEqual(made.watched.files.filter((file) => !made.plain.files.includes(file)), [".claude/settings.json", ".grooph/hooks/grooph-event.mjs", ".grooph/hooks/grooph-events-push.mjs"]);
    assert.deepEqual([made.plain.closed, made.watched.closed, made.outside.closed], [[], [".grooph"], []]);
    // The launcher is beside the session's folder, not in it, and nothing is installed by building.
    assert.deepEqual([made.plain.beside, made.outside.beside], [["base.git", "packages"], ["base.git", "launch-outside.sh", "packages"]]);
    assert.equal(made.outside.outside.grooph_home, groophHomeIn(p.home));
    assert.ok(!existsSync(join(p.home, "home")) && !existsSync(join(p.at.profile, "settings.json")), "building installed nothing");
    // grooph's own folder from an earlier run of the arm, still there: the next is not made over it.
    mkdirSync(groophHomeIn(p.home), { recursive: true });
    assert.throws(() => build({ run: order()[4], home: p.home, cli: p.common.cli }), notStarted(/is still there: it is grooph's own folder from an earlier run of the outside arm/));
    assert.deepEqual(readdirSync(p.at.work), []);
  } finally {
    rmSync(p.top, { recursive: true, force: true });
  }
});

test("the three arms of one task, with a stand-in for the harness: built, started, recorded, measured agent by agent, scored on the recorded decision", { skip: !built }, async () => {
  const hookLines = [line("session-start"), line("subagent-start", { agent: "1", type: "general-purpose" }), line("tool", { tool: "Agent", spawned: "1" }), line("subagent-stop", { agent: "1", type: "general-purpose" }), line("subagent-start", { agent: "2", type: "general-purpose" }), line("tool", { tool: "Agent", spawned: "2" }), line("subagent-stop", { agent: "2", type: "general-purpose" }), line("subagent-stop", { agent: "helper" }), line("session-end")].join("\n");
  const agent = (more = {}) => ({ tool: "Agent", input: { subagent_type: "general-purpose", description: "A DESCRIPTION", prompt: "SECRET-PROMPT" }, result: "done", meta: { toolUseId: "<use>", spawnDepth: 1, requestShape: "background" }, ...more });
  const plan = (eventsAt) => ({ cost: 0.5, result: "FINAL-REPLY-TEXT", uses: [agent(), agent(eventsAt ? { appends: { [eventsAt]: `${hookLines}\n` } } : {}), { tool: "Bash", input: { command: "ls -la" }, result: eventsAt === ".grooph/events/<session>.jsonl" ? ".claude\n.grooph\ncsvline" : "csvline" }] });
  const p = place(plan(null));
  try {
    // plain
    const plain = await runOne(p.opus);
    assert.equal(plain.run.name, "opus/four/plain-1");
    const plainSeen = p.seen();
    const plainResult = JSON.parse(readFileSync(join(plain.recordDir, "result.json"), "utf8"));
    assert.deepEqual([plainResult.ended_by, plainResult.arm, plainResult.round, plainResult.problems, plainResult.scored], ["the session", "plain", 1, [], true]);
    assert.deepEqual([plainResult.measures.subagents.count, plainResult.measures.delegation.any, plainResult.measures.delegation.subagents_in_the_transcripts], [2, true, 2]);
    assert.equal(plainResult.the_hooks_file_agent_by_agent, null, "the plain arm has no hook's file to set beside anything");
    assert.equal(plainResult.measures.the_two_tools, undefined, "no arm of this look offers the two tools");
    assert.deepEqual(plainResult.given.the_prompt_ends_with, SENTENCE);
    assert.deepEqual([plainResult.given.hook_installed_in_the_project, plainResult.given.closed_to_the_session, plainResult.given.recorder_outside_the_project], [[], [], null]);
    assert.deepEqual(plainResult.scored_outside_the_sandbox_on, DECISION);
    const score = JSON.parse(readFileSync(join(plain.recordDir, "score.json"), "utf8"));
    assert.deepEqual(score.packages.map((pkg) => [pkg.package, pkg.cases]), TASKS.four.packages.map((pkg) => [pkg.name, pkg.cases]));
    // The stand-in wrote no code. What passes is what the packages pass as their projects keep them: csvline's 38 of 73, and nothing else.
    assert.deepEqual([score.cases, score.passed, score.packages.map((pkg) => pkg.passed)], [278, 38, [0, 0, 38, 0]]);
    assert.deepEqual(p.ledger().invocations.map((entry) => [entry.run, entry.project, entry.arm, entry.replicate, entry.status, entry.cost_usd, entry.max_budget_usd]), [["second-look/opus/four/plain-1", "second-look/opus/four", "plain", 1, "ok", 0.5, 12]]);
    // Nothing a call said is in the record.
    for (const file of filesUnder(plain.recordDir)) assert.ok(!readFileSync(join(plain.recordDir, file), "utf8").includes("SECRET-PROMPT") || file === "claude-output.json", file);
    assert.deepEqual(readdirSync(p.at.work), [], "the session's folder was moved aside");

    // `six` plain is next in the order; it is put in hand so that the watched arm comes up.
    inHand(p.recordRoot, [order()[1]]);
    p.setPlan(plan(".grooph/events/<session>.jsonl"));
    const watched = await runOne(p.opus);
    assert.equal(watched.run.name, "opus/four/watched-1");
    const watchedResult = JSON.parse(readFileSync(join(watched.recordDir, "result.json"), "utf8"));
    assert.deepEqual([watchedResult.problems, watchedResult.given.hook_installed_in_the_project, watchedResult.given.closed_to_the_session], [[], [".claude/settings.json", ".grooph/hooks/grooph-event.mjs", ".grooph/hooks/grooph-events-push.mjs"], [".grooph"]]);
    const each = watchedResult.the_hooks_file_agent_by_agent;
    assert.deepEqual([each.the_hooks_file.found, each.subagents_in_the_harnesss_files, each.differences.count, each.agrees], [true, 2, 0, true]);
    assert.deepEqual(each.each.map((one) => [one.agent, one.type.in_the_harnesss_files, one.type.in_the_hooks_lines, one.runs.start_lines, one.runs.stop_lines, one.started_by.in_the_harnesss_files, one.started_by.in_the_hooks_lines, one.asked_for]), [["1", "general-purpose", ["general-purpose"], 1, 1, "the session", "the session", "background"], ["2", "general-purpose", ["general-purpose"], 1, 1, "the session", "the session", "background"]]);
    assert.deepEqual(each.expected[EXPECTED.helpers], { agents: 1, lines: 1, read_as: "the harness's own helpers, which leave no transcript (docs/subagents.md §5)" });
    // The first check's own counts are kept beside it, as that check made them: its count of stops takes a helper's stop for one.
    assert.deepEqual([watchedResult.the_hooks_file_beside_the_transcripts.subagent_starts_in_the_hooks_file, watchedResult.the_hooks_file_beside_the_transcripts.subagent_stops_in_the_hooks_file, watchedResult.the_hooks_file_beside_the_transcripts.lines_that_name_an_agent_and_no_type.agents], [2, 3, 1]);
    assert.deepEqual([watchedResult.measures.footprint.shown_in_the_result.calls, watchedResult.measures.noticed.shown_in_the_result.calls], [1, 0], "a listing that shows .grooph is in the first check's count and not in the user-level one");
    assert.ok(existsSync(join(watched.recordDir, "events", `${watchedResult.session_id}.jsonl`)));
    // The settings a watched session ran under close .grooph to its commands; the profile's are put back afterwards.
    assert.equal(p.settingsSeen().sandbox.filesystem.denyWrite.length, 1);
    assert.equal(readFileSync(join(p.at.profile, "settings.json"), "utf8"), `${JSON.stringify(settingsFor({ home: p.home }), null, 2)}\n`);

    // outside: the events are under grooph's own folder, three folders up from the session's and one down.
    inHand(p.recordRoot, [order()[3]]);
    p.setPlan(plan("../../../home/.grooph/events/packages/<session>.jsonl"));
    const outside = await runOne(p.opus);
    assert.equal(outside.run.name, "opus/four/outside-1");
    const outsideResult = JSON.parse(readFileSync(join(outside.recordDir, "result.json"), "utf8"));
    assert.deepEqual(outsideResult.problems, []);
    const there = outsideResult.given.recorder_outside_the_project;
    assert.deepEqual([there.entries_in_the_settings_the_session_found, there.at_events, there.of_grooph_in_the_sessions_folder_afterwards, there.the_hook_wrote_under_groophs_own_folder, there.the_owners_own.as_they_were, there.the_rehearsal_before_it], [3, ["SessionStart", "SubagentStart", "SubagentStop"], [], true, true, REHEARSED.left]);
    assert.deepEqual([outsideResult.given.hook_installed_in_the_project, outsideResult.given.closed_to_the_session], [[], []]);
    // What the stand-in was started with: the plain arm's arguments and environment, to the letter but for the session's id.
    const outsideSeen = p.seen();
    const withoutId = (args) => args.filter((_, at) => args[at - 1] !== "--session-id");
    assert.deepEqual(withoutId(outsideSeen.args), withoutId(plainSeen.args), "the same command as the plain arm's");
    assert.deepEqual(outsideSeen.environment.filter((name) => name !== "__CF_USER_TEXT_ENCODING"), plainSeen.environment.filter((name) => name !== "__CF_USER_TEXT_ENCODING"), "the same environment: no variable names grooph's folder");
    assert.ok(!outsideSeen.environment.some((name) => /GROOPH/.test(name)));
    // And the settings it found: the profile's, with the recorder's entries at the user's level. Afterwards they are the repository's again.
    const found = p.settingsSeen();
    assert.deepEqual(Object.keys(found.hooks), ["SessionStart", "SubagentStart", "SubagentStop"]);
    assert.ok(found.hooks.SessionStart[0].hooks[0].command.includes(join(groophHomeIn(p.home), "hooks", "grooph-event.mjs")));
    assert.equal(readFileSync(join(p.at.profile, "settings.json"), "utf8"), `${JSON.stringify(settingsFor({ home: p.home }), null, 2)}\n`);
    assert.ok(existsSync(join(outside.recordDir, "settings-with-the-recorder.json")) && /listed: /.test(readFileSync(join(outside.recordDir, "outside-install.txt"), "utf8")));
    // The hook's file was found under grooph's own folder and set beside the harness's files as in the watched arm.
    assert.deepEqual([outsideResult.the_hooks_file_agent_by_agent.the_hooks_file.found, outsideResult.the_hooks_file_agent_by_agent.differences.count, outsideResult.the_hooks_file_agent_by_agent.each.length], [true, 0, 2]);
    assert.ok(existsSync(join(outside.recordDir, "events", `${outsideResult.session_id}.jsonl`)));
    // grooph's own folder went aside with the session's, so the next run of the arm starts with none.
    assert.ok(!existsSync(join(p.home, "home")) && existsSync(join(outside.kept, "home", ".grooph", "hooks", "grooph-event.mjs")) && existsSync(join(outside.kept, "work", "launch-outside.sh")));
    // Nothing of the account's is in a record: the home folder's path is taken out of every file.
    for (const dir of [plain.recordDir, watched.recordDir, outside.recordDir]) for (const file of filesUnder(dir)) assert.ok(!readFileSync(join(dir, file), "utf8").includes(homedir()), `${dir}/${file}`);
    assert.equal(p.ledger().invocations.length, 3);
    assert.match(status({ ledgerPath: p.ledgerPath, recordRoot: p.recordRoot }), /round 1 {2}opus\/four\/outside-1 {4}recorded and scored: ended by the session; 2 subagent\(s\)/);
  } finally {
    rmSync(p.top, { recursive: true, force: true });
  }
});

test("a run of the outside arm is refused before anything is made when the install cannot be rehearsed, and a launcher that could not install is in the record", { skip: !built }, async () => {
  const p = place({ uses: [] });
  try {
    inHand(p.recordRoot, order().slice(0, 4));
    await assert.rejects(runOne({ ...p.opus, rehearsal: () => ({ ok: false, why: "this checkout's grooph did not install the recorder outside a project (…). That install is slice 0108's: until it is on main and built here, a block is started with --without-outside" }) }), notStarted(/opus\/four\/outside-1 is a run of the outside arm, and this checkout's grooph did not install .* --without-outside/));
    assert.deepEqual([readdirSync(p.at.work), p.ledger().invocations.length], [[], 0]);
    // Without the outside arm the block goes on to round two's watched runs.
    assert.equal(nextRun(p.recordRoot, "opus", { withoutOutside: true }).name, "opus/four/watched-2");
    // A tool that fails when the launcher runs it, after a rehearsal that passed: the harness is never started, and the record says why.
    const failed = await runOne({ ...p.opus, cli: standInTool(p.top, "refuses") });
    assert.equal(failed.run.name, "opus/four/outside-1");
    assert.deepEqual([failed.result.ended_by, failed.result.exit, failed.score], ["the harness", 70, null]);
    assert.ok(failed.result.problems.some((problem) => /the session was started with no entry of the recorder in its user-level settings/.test(problem)), failed.result.problems.join("; "));
    assert.match(readFileSync(join(failed.recordDir, "outside-install.txt"), "utf8"), /Unknown option '--user'/);
    assert.equal(readFileSync(join(p.at.profile, "settings.json"), "utf8"), `${JSON.stringify(settingsFor({ home: p.home }), null, 2)}\n`);
    assert.equal(stateOf(order()[4], p.recordRoot).state, "ended by the harness, and not yet run again");
  } finally {
    rmSync(p.top, { recursive: true, force: true });
  }
});

/** A stand-in's plan for one arm: a session that starts no subagent, and leaves the file the hook would have where that arm's hook writes it. */
const quietPlan = (arm) => ({ uses: [{ tool: "Bash", input: { command: "npm test" }, result: "ok", ...(arm === "plain" ? {} : { appends: { [arm === "watched" ? ".grooph/events/<session>.jsonl" : "../../../home/.grooph/events/packages/<session>.jsonl"]: `${line("session-start")}\n${line("session-end")}\n` } }) }] });

test("every run of a block still to come, one at a time: through a round or without the outside arm, never into the next block, and stopping at a refusal", { skip: !built }, async () => {
  const p = place(quietPlan("plain"));
  try {
    const told = [];
    // The stand-in is told before each run where that run's arm keeps the hook's file.
    const before = (names) => (done) => (names.push(done.run.name), done.next && p.setPlan(quietPlan(done.next.arm)));
    const first = await runAll({ ...p.opus, withoutOutside: true, throughRound: 1, each: before(told) });
    assert.deepEqual([told, first.stopped], [["opus/four/plain-1", "opus/six/plain-1", "opus/four/watched-1", "opus/six/watched-1"], null]);
    await assert.rejects(runOne({ ...p.opus, withoutOutside: true, throughRound: 1 }), notStarted(/every run of the `opus` block through round 1, the outside arm left out, is recorded/));
    // Round one's outside runs, made afterwards into the same block.
    p.setPlan(quietPlan("outside"));
    const later = await runAll({ ...p.opus, throughRound: 1, each: () => {} });
    assert.deepEqual(later.done.map((done) => done.run.name), ["opus/four/outside-1", "opus/six/outside-1"]);
    assert.deepEqual(p.ledger().invocations.map((entry) => entry.max_budget_usd), [12, 18, 12, 18, 12, 18]);
    assert.deepEqual(readdirSync(p.recordRoot), ["opus"], "nothing of the next block was started");
    // With one whole round of opus in hand the sonnet block may be started, by name, on its own model under its own ceilings.
    p.setPlan(quietPlan("plain"));
    const sonnet = await runAll({ ...p.common, block: "sonnet", withoutOutside: true, throughRound: 1, each: before([]) });
    assert.deepEqual([sonnet.done.map((done) => done.run.name), sonnet.stopped], [["sonnet/four/plain-1", "sonnet/six/plain-1", "sonnet/four/watched-1", "sonnet/six/watched-1"], null]);
    // A watched session whose hook left no file was not watched: its record says so, and the runs after it wait for a person.
    p.setPlan(quietPlan("plain"));
    const unwatched = await runAll({ ...p.common, block: "sonnet", throughRound: 1 });
    assert.deepEqual([unwatched.done.map((done) => done.run.name), unwatched.stopped?.why], [["sonnet/four/outside-1"], "its record has problems"]);
    assert.ok(unwatched.done[0].result.problems.some((problem) => /the hook left no file for this session under grooph's own folder for the run: the recorder did not load/.test(problem)));
    assert.deepEqual(p.ledger().invocations.slice(6).map((entry) => entry.max_budget_usd), [5, 8, 5, 8, 5]);
    const args = p.seen().args;
    assert.deepEqual([args[args.indexOf("--model") + 1], args[args.indexOf("--effort") + 1], args[args.indexOf("--max-budget-usd") + 1]], ["claude-sonnet-5-5", "high", "5"]);
    await assert.rejects(runAll({ ...p.common }), notStarted(/no block was named/));
  } finally {
    rmSync(p.top, { recursive: true, force: true });
  }
});

test("a run the harness ended is made once more and no other is; a line left running is settled by hand first", { skip: !built }, async () => {
  const p = place({ no_output: true, exit: 1 });
  try {
    const ended = await runOne(p.opus);
    assert.deepEqual([ended.run.name, ended.result.ended_by, ended.score], ["opus/four/plain-1", "the harness", null]);
    p.setPlan({ uses: [] });
    await assert.rejects(runOne({ ...p.common, rerun: "opus/six/plain-1" }), notStarted(/opus\/six\/plain-1 has no record the harness ended/));
    await assert.rejects(runOne({ ...p.common, rerun: "opus/four/plain-1", block: "opus" }), notStarted(/--rerun names its run whole/));
    const again = await runOne({ ...p.common, rerun: "opus/four/plain-1" });
    assert.deepEqual([again.result.rerun_of, again.result.ended_by, again.recordDir.endsWith("plain-1-rerun")], ["opus/four/plain-1", "the session", true]);
    await assert.rejects(runOne({ ...p.common, rerun: "opus/four/plain-1" }), notStarted(/was already run once more/));
    assert.deepEqual(p.ledger().invocations.map((entry) => entry.run), ["second-look/opus/four/plain-1", "second-look/opus/four/plain-1-rerun"]);
    assert.equal(stateOf(order()[0], p.recordRoot).from, "its rerun");
    assert.throws(() => settleLine({ n: 1, cost: 0.2, note: "it is settled already", ledgerPath: p.ledgerPath }), notStarted(/not a line of the second look's ledger still marked running/));
    assert.throws(() => settleLine({ n: 1, cost: -1, note: "a cost below nothing", ledgerPath: p.ledgerPath }), notStarted(/--cost is what the harness reported/));
  } finally {
    rmSync(p.top, { recursive: true, force: true });
  }
});

test("a dry run builds each arm's folder, says what would be started and what would refuse it, and takes the folder away again", { skip: !built }, () => {
  const p = place({ uses: [] }, { decided: false });
  try {
    const stand = () => ({ claude: "/the/harness", refused: [] });
    const said = Object.fromEntries(ARMS.map((arm) => [arm, dryRun({ run: order().find((run) => run.name === `opus/six/${arm}-1`), home: p.home, ledgerPath: p.ledgerPath, recordRoot: p.recordRoot, stand, cli: p.common.cli, rehearsal: () => (arm === "outside" ? { ok: false, why: "the install could not be rehearsed" } : REHEARSED) })]));
    assert.match(said.plain, /^opus\/six\/plain-1\nthe block: opus: the session itself on claude-opus-5-5 at high effort; round 1 of 3\nthe arm: plain: nothing of grooph is in the folder/);
    assert.match(said.watched, /the arm: watched: grooph hooks install was run in the folder before its one commit.*\.grooph is closed to the session's writing, whole/);
    assert.match(said.outside, /the arm: outside: the folder holds nothing of grooph\. The program started is a launcher/);
    assert.match(said.outside, /\| exec '\/the\/harness' "\$@"/);
    assert.match(said.outside, /--max-budget-usd 18 /);
    for (const text of Object.values(said)) {
      assert.match(text, /as things stand, a paid run would be refused:\n {2}- Scoring runs the repository's unseen suites/);
      assert.ok(text.includes(`  | ${SENTENCE}`) && text.endsWith("nothing was started."));
    }
    assert.match(said.outside, /\n {2}- the install could not be rehearsed/);
    assert.deepEqual([readdirSync(p.at.work), p.ledger().invocations.length, existsSync(join(p.home, "home"))], [[], 0, false]);
  } finally {
    rmSync(p.top, { recursive: true, force: true });
  }
});

// ── the measures ─────────────────────────────────────────────────────────

/** A session's files as the harness keeps them, written by hand: the session's own transcript, and each subagent's with the file beside it. */
function session(profile, id, { lead = [], agents = {} }) {
  const folder = join(profile, "projects", "-a-folder");
  mkdirSync(join(folder, id, "subagents"), { recursive: true });
  writeFileSync(join(folder, `${id}.jsonl`), `${lead.map((entry) => JSON.stringify(entry)).join("\n")}\n`, "utf8");
  for (const [agent, { meta, lines }] of Object.entries(agents)) {
    writeFileSync(join(folder, id, "subagents", `agent-${agent}.jsonl`), `${lines.map((entry) => JSON.stringify(entry)).join("\n")}\n`, "utf8");
    writeFileSync(join(folder, id, "subagents", `agent-${agent}.meta.json`), JSON.stringify(meta), "utf8");
  }
}
const at = (seconds) => new Date(Date.parse("2026-10-11T12:00:00.000Z") + seconds * 1000).toISOString();
const use = (id, name, input, when) => ({ type: "assistant", timestamp: at(when), message: { id: `m-${id}`, model: "claude-opus-5-5", content: [{ type: "tool_use", id, name, input }] } });
const result = (id, text, when, more = {}) => ({ type: "user", timestamp: at(when), message: { content: [{ type: "tool_result", tool_use_id: id, is_error: more.refused === true, content: text }] }, ...(more.about ? { toolUseResult: more.about } : {}) });
const said = (when, text = "working") => ({ type: "assistant", timestamp: at(when), message: { id: `s-${when}-${text}`, model: "claude-sonnet-5-5", content: [{ type: "text", text }] } });
const notice = (agent, statusOf, when) => ({ type: "queue-operation", operation: "enqueue", timestamp: at(when), content: `<task-notification>\n<task-id>${agent}</task-id>\n<status>${statusOf}</status>\n<summary>…</summary>\n</task-notification>` });
const hook = (event, when, more = {}) => JSON.stringify({ v: 1, t: at(when), harness: "claude-code", event, session: "S", ...more });

test("the hook's file beside the harness's files, agent by agent: every kind of difference by its name, and the three things that are expected named apart", () => {
  const top = mkdtempSync(join(tmpdir(), "second-look-agents-"));
  try {
    const profile = join(top, "profile");
    const background = (toolUseId, more = {}) => ({ agentType: "general-purpose", toolUseId, spawnDepth: 1, requestShape: "background", ...more });
    session(profile, "S", {
      lead: [
        use("u-ok", "Agent", { subagent_type: "general-purpose" }, 0),
        result("u-ok", "started", 0, { about: { agentId: "aok", status: "async_launched" } }),
        use("u-nostart", "Agent", {}, 1),
        use("u-nostop", "Agent", {}, 2),
        use("u-failed", "Agent", {}, 3),
        use("u-type", "Agent", {}, 4),
        use("u-parent", "Agent", {}, 5),
        use("u-noparent", "Agent", {}, 6),
        use("u-twice", "Agent", {}, 7),
        use("u-fore", "Agent", {}, 8),
        result("u-fore", "done", 40, { about: { agentId: "afore", status: "completed" } }),
        use("u-running", "Agent", {}, 9),
        notice("aok", "completed", 30),
        notice("afailed", "failed", 31),
        notice("anostop", "completed", 32),
        notice("atwice", "completed", 33),
      ],
      agents: {
        aok: { meta: background("u-ok"), lines: [said(1), use("u-nested", "Agent", {}, 2), said(20)] },
        anostart: { meta: background("u-nostart"), lines: [said(2), said(21)] },
        anostop: { meta: background("u-nostop"), lines: [said(3), said(22)] },
        afailed: { meta: background("u-failed"), lines: [said(4), said(23)] },
        atype: { meta: background("u-type", { agentType: "Explore" }), lines: [said(5), said(24)] },
        aparent: { meta: background("u-parent"), lines: [said(6), said(25)] },
        anoparent: { meta: background("u-noparent"), lines: [said(7), said(26)] },
        // Still running when the session's files stop: the harness's files show no ending for it either.
        arunning: { meta: background("u-running"), lines: [said(10), said(45)] },
        // Carried on from once after it finished: two runs.
        atwice: { meta: background("u-twice"), lines: [said(8), said(20), { type: "user", isMeta: true, origin: { kind: "coordinator" }, timestamp: at(27), message: { content: "more" } }, said(28)] },
        // A foreground child of the session: the line that names who started it is written when the call returns.
        afore: { meta: { agentType: "general-purpose", toolUseId: "u-fore", spawnDepth: 1, requestShape: "foreground" }, lines: [said(9), said(39)] },
        // A subagent's own subagent, in the same flat folder: its parent is in the file beside it.
        anested: { meta: { agentType: "general-purpose", toolUseId: "u-nested", parentAgentId: "aok", spawnDepth: 2, requestShape: "background" }, lines: [said(3), said(12)] },
      },
    });
    const gp = { type: "general-purpose" };
    const events = join(top, "S.jsonl");
    writeFileSync(
      events,
      [
        hook("session-start", 0),
        hook("subagent-start", 1, { agent: "aok", ...gp }), hook("tool", 1, { tool: "Agent", spawned: "aok" }), hook("subagent-stop", 20, { agent: "aok", ...gp }),
        hook("tool", 2, { tool: "Agent", spawned: "anostart" }), hook("subagent-stop", 21, { agent: "anostart", ...gp }),
        hook("subagent-start", 3, { agent: "anostop", ...gp }), hook("tool", 3, { tool: "Agent", spawned: "anostop" }),
        hook("subagent-start", 4, { agent: "afailed", ...gp }), hook("tool", 4, { tool: "Agent", spawned: "afailed" }),
        hook("subagent-start", 5, { agent: "atype", ...gp }), hook("tool", 5, { tool: "Agent", spawned: "atype" }), hook("subagent-stop", 24, { agent: "atype", ...gp }),
        hook("subagent-start", 6, { agent: "aparent", ...gp }), hook("tool", 6, { tool: "Agent", spawned: "aparent", agent: "aok", ...gp }), hook("subagent-stop", 25, { agent: "aparent", ...gp }),
        hook("subagent-start", 7, { agent: "anoparent", ...gp }), hook("subagent-stop", 26, { agent: "anoparent", ...gp }),
        hook("subagent-start", 10, { agent: "arunning", ...gp }), hook("tool", 10, { tool: "Agent", spawned: "arunning" }),
        hook("subagent-start", 8, { agent: "atwice", ...gp }), hook("tool", 8, { tool: "Agent", spawned: "atwice" }), hook("subagent-stop", 20, { agent: "atwice", ...gp }), hook("subagent-stop", 28, { agent: "atwice", ...gp }), hook("subagent-stop", 29, { agent: "atwice", ...gp }),
        hook("subagent-start", 9, { agent: "afore", ...gp }), hook("subagent-stop", 39, { agent: "afore", ...gp }), hook("tool", 40, { tool: "Agent", spawned: "afore" }),
        hook("subagent-start", 3, { agent: "anested", ...gp }), hook("tool", 3, { tool: "Agent", spawned: "anested", agent: "aok", ...gp }), hook("subagent-stop", 12, { agent: "anested", ...gp }),
        hook("subagent-start", 10, { agent: "aghost", ...gp }),
        hook("subagent-stop", 11, { agent: "ahelper-1" }), hook("subagent-stop", 12, { agent: "ahelper-2" }),
        "not a line of JSON",
        hook("session-end", 50),
      ].join("\n"),
      "utf8",
    );
    const read = readSession(profile, "S");
    const each = agentByAgent({ read, eventsFile: events });
    assert.deepEqual([each.the_hooks_file.found, each.the_hooks_file.lines_that_are_not_events, each.subagents_in_the_harnesss_files, each.agrees], [true, 1, 11, false]);
    assert.deepEqual(each.differences.by_kind, {
      [DIFFERENCES.stranger]: ["aghost"],
      [DIFFERENCES.parent]: ["aparent"],
      [DIFFERENCES.type]: ["atype"],
      [DIFFERENCES.fewerStarts]: ["atwice"],
      [DIFFERENCES.fewerStops]: ["anostop"],
      [DIFFERENCES.moreStops]: ["atwice"],
      [DIFFERENCES.noParent]: ["anoparent"],
      [DIFFERENCES.noStart]: ["anostart"],
      [DIFFERENCES.notEnded]: ["arunning"],
    });
    assert.equal(each.differences.count, 9);
    assert.deepEqual(each.expected.by_kind, { [EXPECTED.lateParent]: ["afore"], [EXPECTED.failed]: ["afailed"] });
    assert.deepEqual(each.expected[EXPECTED.helpers], { agents: 2, lines: 2, read_as: "the harness's own helpers, which leave no transcript (docs/subagents.md §5)" });
    const of = (agent) => each.each.find((one) => one.agent === agent);
    assert.deepEqual([of("aok").differences, of("aok").expected, of("aok").started_by.known_to_the_hook, of("aok").runs.ended_as_the_harness_says], [[], [], "while it ran", ["completed"]]);
    assert.deepEqual([of("anested").differences, of("anested").started_by.in_the_harnesss_files, of("anested").started_by.in_the_hooks_lines, of("anested").started_by.read_from], [[], "aok", "aok", "the file beside its transcript"]);
    assert.deepEqual([of("afore").started_by.known_to_the_hook, of("afore").started_by.seconds_after_its_first_line, of("afore").asked_for, of("afore").runs.ended_as_the_harness_says], ["only at its end", 31, "foreground", ["completed"]]);
    assert.deepEqual([of("afailed").runs, of("afailed").differences], [{ in_the_harnesss_files: 1, ended_as_the_harness_says: ["failed"], start_lines: 1, stop_lines: 0 }, []]);
    assert.deepEqual([of("atwice").runs.in_the_harnesss_files, of("atwice").runs.start_lines, of("atwice").runs.stop_lines], [2, 1, 3]);
    assert.deepEqual(of("atype").type, { in_the_harnesss_files: "Explore", in_the_hooks_lines: ["general-purpose"] });
    assert.deepEqual(of("aparent").started_by, { in_the_harnesss_files: "the session", read_from: "the tool use that started it", in_the_hooks_lines: "aok", known_to_the_hook: "while it ran", seconds_after_its_first_line: 0 });
    // With no file of the hook's at all, nothing agrees and every subagent is a difference.
    const none = agentByAgent({ read, eventsFile: join(top, "none.jsonl") });
    assert.deepEqual([none.the_hooks_file.found, none.agrees, none.differences.by_kind[DIFFERENCES.noStart].length], [false, false, 11]);
    // And a session with no subagent and a hook's file with no subagent line agree, with nothing to compare.
    session(profile, "T", { lead: [said(0)] });
    writeFileSync(join(top, "T.jsonl"), [hook("session-start", 0), hook("session-end", 1)].join("\n"), "utf8");
    const quiet = agentByAgent({ read: readSession(profile, "T"), eventsFile: join(top, "T.jsonl") });
    assert.deepEqual([quiet.agrees, quiet.subagents_in_the_harnesss_files, quiet.differences.count, quiet.each], [true, 0, 0, []]);
    // How many were running at once: each from its first line to its last.
    assert.equal(delegation({ read, output: null }).most_at_once, 11, "from the tenth second to the twelfth all eleven were open");
    assert.equal(mostAtOnce([{ first: at(0), last: at(10) }, { first: at(10), last: at(20) }, { first: at(30), last: at(40) }, { first: null, last: null }]), 2, "two that touch were both there; one with no time is not counted");
    assert.equal(mostAtOnce([]), 0);
  } finally {
    rmSync(top, { recursive: true, force: true });
  }
});

test("whether the recorder was noticed, and the delegation, as counts: the user-level places in a call or a result, refusals, the final reply, and the harness's own count", () => {
  const top = mkdtempSync(join(tmpdir(), "second-look-noticed-"));
  try {
    const profile = join(top, "profile");
    const [profileSettings, groophHome] = ["/h/profile/settings.json", "/h/home/.grooph"];
    session(profile, "S", {
      lead: [
        use("a", "Bash", { command: "ls -la" }, 0), result("a", ".claude\n.grooph\nsrc", 0),
        use("b", "Bash", { command: `cat ${profileSettings}` }, 1), result("b", "Operation not permitted", 1, { refused: true }),
        use("c", "Bash", { command: "env" }, 2), result("c", "PATH=/usr/bin\nGROOPH_HOME=/somewhere", 2),
        use("d", "Read", { file_path: `${groophHome}/watched.json` }, 3), result("d", "refused", 3, { refused: true }),
        use("e", "Bash", { command: "cat $CLAUDE_CONFIG_DIR/settings.json" }, 4), result("e", 'node "/h/home/.grooph/hooks/grooph-event.mjs" claude-code --user', 4),
        use("f", "Agent", {}, 5),
        use("g", "Bash", { command: "npm test" }, 6), result("g", "ok", 6),
      ],
      agents: { a1: { meta: { agentType: "general-purpose", toolUseId: "f" }, lines: [use("s", "Bash", { command: "ls ~/.grooph-not-it" }, 5), result("s", `${groophHome}/events`, 6)] } },
    });
    const read = readSession(profile, "S");
    const seen = noticed({ read, output: { result: "I changed src/. I also saw .grooph/events and a GROOPH_HOME variable, and left both alone." }, profileSettings, groophHome });
    assert.deepEqual(seen.places, ["the profile's own settings file", "grooph's own folder for the run", "the hook's file name", "a variable of grooph's"]);
    assert.deepEqual(seen.named_in_the_input, { calls: 3, by_tool: { Bash: 2, Read: 1 }, by_place: { "grooph's own folder for the run": 1, "the profile's own settings file": 2 }, of_them_refused: 2 });
    assert.deepEqual(seen.shown_in_the_result, { calls: 3, by_tool: { Bash: 3 }, by_place: { "a variable of grooph's": 1, "grooph's own folder for the run": 2, "the hook's file name": 1 } });
    assert.deepEqual(seen.the_final_reply, { read: true, names_the_recorder: true, in_the_project: [".grooph"], outside_it: ["a variable of grooph's"] });
    // Counts only: nothing a call said and nothing that came back is in what is kept.
    assert.ok(!JSON.stringify(seen).includes("cat ") && !JSON.stringify(seen).includes("Operation not permitted") && !JSON.stringify(seen).includes("left both alone"));
    assert.deepEqual(noticed({ read, output: { result: "I changed src/ in each package." }, profileSettings, groophHome }).the_final_reply, { read: true, names_the_recorder: false, in_the_project: [], outside_it: [] });
    assert.deepEqual(noticed({ read, output: null, profileSettings, groophHome }).the_final_reply, { read: false, names_the_recorder: null });
    // A session that looked at nothing of the kind: every count is nothing.
    session(profile, "T", { lead: [use("a", "Bash", { command: "npm test" }, 0), result("a", "ok", 0)] });
    const quiet = noticed({ read: readSession(profile, "T"), output: { result: "done" }, profileSettings, groophHome });
    assert.deepEqual([quiet.named_in_the_input.calls, quiet.shown_in_the_result.calls, quiet.the_final_reply.names_the_recorder], [0, 0, false]);
    // The delegation: the harness's own count set beside the transcripts', and the tokens of the session and its subagents together.
    const output = { subagent_stats: { spawned: 1, completed: 1, failed: 0 }, usage: { output_tokens: 10 }, modelUsage: { "claude-opus-5-5": { outputTokens: 100, cacheCreationInputTokens: 2000 }, "claude-sonnet-5-5": { outputTokens: 900, cacheCreationInputTokens: 3000 } } };
    const handed = delegation({ read, output });
    assert.deepEqual([handed.any, handed.subagents_in_the_transcripts, handed.the_harness_counts_as_many_as_there_are_transcripts, handed.tokens_put_out_with_its_subagents, handed.tokens_written_to_the_cache_with_its_subagents], [true, 1, true, 1000, 5000]);
    assert.equal(delegation({ read, output: { subagent_stats: { spawned: 4 } } }).the_harness_counts_as_many_as_there_are_transcripts, false);
    assert.deepEqual([delegation({ read: readSession(profile, "T"), output: null }).any, delegation({ read: readSession(profile, "T"), output: null }).as_the_harness_counts], [false, null]);
  } finally {
    rmSync(top, { recursive: true, force: true });
  }
});

// ── the tables ───────────────────────────────────────────────────────────

test("the tables are made from the records: none and no results page while nothing is run, a row for each run once one is, and the page held to them", { skip: !built }, async () => {
  const { check, HEAD, tables } = await import(TABLES);
  // As the repository stands: nothing has been run, so there is no table and no results page.
  const stands = spawnSync(process.execPath, [TABLES, "--check"], { encoding: "utf8" });
  const recordedHere = order().some((run) => existsSync(join(recordOf(run), "result.json")));
  assert.equal(stands.status, 0, stands.stderr);
  if (!recordedHere) assert.match(stands.stdout, /nothing has been run, and there is no results page/);
  const p = place({ cost: 0.25, result: "done", uses: [{ tool: "Agent", input: { subagent_type: "general-purpose" }, meta: { toolUseId: "<use>", spawnDepth: 1, requestShape: "background" } }] });
  try {
    assert.deepEqual([tables(p.recordRoot), check(p.recordRoot).ok], ["", true]);
    await runOne(p.opus);
    const text = tables(p.recordRoot);
    assert.match(text, /^### The `opus` block \(the session's own model answered as `claude-opus-5-5`\)\n\n\| Round \| Task \| Arm \|/);
    const rows = text.split("\n").filter((row) => /^\| [123] \|/.test(row));
    assert.equal(rows.length, 18, "one row for each run of the block, made or not");
    assert.equal(rows[0], "| 1 | `four` | plain | the session | $0.25 | 0 | 2 | 1 (1 general-purpose) | 1 | 0/55 · 0/88 · 38/73 · 0/62 | 0 | 0 | 0 / 0 | 0 / 0 / 0 | no |  |");
    assert.equal(rows[1], `| 1 | \`six\` | plain | not run | ${HEAD.slice(4).map(() => "").join(" | ")} |`);
    assert.ok(!text.includes("`sonnet` block"), "a block with no record has no table");
    assert.deepEqual([check(p.recordRoot).ok, /does not hold the tables these records make/.test(check(p.recordRoot).says)], [false, true]);
    writeFileSync(join(p.recordRoot, "RESULTS.md"), `# What the runs showed\n\n${text}\n`, "utf8");
    assert.equal(check(p.recordRoot).ok, true);
    const empty = mkdtempSync(join(tmpdir(), "second-look-tables-"));
    writeFileSync(join(empty, "RESULTS.md"), "a page with no record under it", "utf8");
    assert.match(check(empty).says, /exists and no run has a record/);
    rmSync(empty, { recursive: true, force: true });
  } finally {
    rmSync(p.top, { recursive: true, force: true });
  }
});
