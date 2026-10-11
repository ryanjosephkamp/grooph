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
import { NotStarted, runBounded } from "./study-three-paid.mjs";
import { CLI, promptFor as firstChecksPromptFor, SUBAGENTS_SENTENCE } from "./watching-check-paid.mjs";
import { agentByAgent, delegation, DIFFERENCES, EXPECTED, mostAtOnce, noticed, readSession } from "./watching-second-look-measures.mjs";
import {
  ARMS,
  BLOCKS,
  build,
  checkout,
  dryRun,
  eventsOf,
  groophHomeIn,
  heldUpBy,
  installOutside,
  launcherText,
  LEAD,
  LEDGER,
  madeFromAnother,
  nextRun,
  order,
  placesFor,
  promptFor,
  readLedger,
  recordOf,
  rehearse,
  ROUNDS,
  roundsOf,
  room,
  runAll,
  runOne,
  SENTENCE,
  settleLine,
  SHIPPED_HOOK,
  SIX_OPENS,
  STARTED,
  stateOf,
  status,
  STOPS_AT_USD,
  TASKS,
  taskText,
  theBet,
  theOwnersOwn,
  unbuild,
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
  // The stand-in is started through a wrapper that names node whole. Before it becomes the stand-in it writes down
  // which process it is and which process group it is in: the same process goes on as the stand-in.
  const harness = join(top, "stand-in-harness");
  writeFileSync(harness, `#!/bin/sh\necho "$$ $(ps -o pgid= -p $$ | tr -d ' ')" > ${JSON.stringify(join(top, "the-harness-was-this-process"))}\nexec ${JSON.stringify(process.execPath)} ${JSON.stringify(STAND_IN)} "$@"\n`, { mode: 0o755 });
  const recordRoot = join(top, "records");
  const common = { home, claude: harness, ledgerPath, recordRoot, profileCheck: () => [], gameOpen: [], go: "the driver said: run the second look", grace: 300, firstCallGate: { ok: true, record: "record" }, cli: standInTool(top), rehearsal: () => REHEARSED };
  return { top, home, at, harness, ledgerPath, recordRoot, common, opus: { ...common, block: "opus" }, setPlan, process: () => readFileSync(join(top, "the-harness-was-this-process"), "utf8").trim().split(" ").map(Number), ledger: () => JSON.parse(readFileSync(ledgerPath, "utf8")), seen: () => JSON.parse(readFileSync(join(at.profile, "command-seen-by-the-stand-in.json"), "utf8")), settingsSeen: () => JSON.parse(readFileSync(join(at.profile, "settings-seen-by-the-stand-in.json"), "utf8")) };
}
const sawAVariableOfGroophs = (p) => JSON.parse(readFileSync(join(p.at.profile, "command-seen-by-the-stand-in.json"), "utf8")).environment.some((name) => /CODEX_HOME|GROOPH/.test(name));
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

/** A stand-in's plan for one arm: a session that starts no subagent, and leaves the file the hook would have where that arm's hook writes it. */
const quietPlan = (arm) => ({ uses: [{ tool: "Bash", input: { command: "npm test" }, result: "ok", ...(arm === "plain" ? {} : { appends: { [arm === "watched" ? ".grooph/events/<session>.jsonl" : "../../../home/.grooph/events/packages/<session>.jsonl"]: `${line("session-start")}\n${line("session-end")}\n` } }) }] });

// ── the protocol's own words ─────────────────────────────────────────────

test("the thirty-six runs: three rounds of six in each block, each arm first, second and last once, and the second block's rounds the first's in a mirror", async () => {
  assert.deepEqual(BLOCKS, ["opus", "sonnet"]);
  assert.deepEqual(ARMS, ["plain", "watched", "outside"]);
  assert.deepEqual(Object.keys(ROUNDS), BLOCKS);
  // The page's own two tables, read from the page: each block's three rounds in its words.
  const rows = [...page.matchAll(/^\| ([123]) \| (.+?) \|$/gm)].map((row) => [Number(row[1]), row[2].split(", ").map((part) => /^`(\w+)` (\w+)$/.exec(part).slice(1)).map(([task, arm]) => `${task}/${arm}`)]);
  assert.deepEqual(rows.map(([round]) => round), [1, 2, 3, 1, 2, 3]);
  assert.ok(page.indexOf("The `opus` block:\n\n| Round |") < page.indexOf("The `sonnet` block:\n\n| Round |"));
  const pages = { opus: rows.slice(0, 3), sonnet: rows.slice(3) };
  for (const block of BLOCKS) {
    assert.equal(blockOf(block).length, 18, block);
    assert.deepEqual(roundsOf(block), ROUNDS[block]);
    for (const [round, six] of pages[block]) assert.deepEqual(blockOf(block).filter((run) => run.round === round).map((run) => `${run.task}/${run.arm}`), six, `${block}, round ${round}`);
    // Each arm in each place exactly once: a block's rounds are a Latin square.
    for (let place = 0; place < 3; place += 1) assert.deepEqual(ROUNDS[block].map((arms) => arms[place]).sort(), [...ARMS].sort(), `${block}, place ${place + 1}`);
    for (const arms of ROUNDS[block]) assert.deepEqual([...arms].sort(), [...ARMS].sort());
    for (const arm of ARMS) assert.deepEqual(blockOf(block).filter((run) => run.arm === arm && run.task === "four").map((run) => run.round).sort(), [1, 2, 3], `${block}: every arm has a run in every round`);
  }
  // The mirror: a block's first run is not the same arm's in both; across the two blocks each arm comes straight after each other arm once;
  // and with the outside arm left out the two that remain still change places, the other way about in each block.
  assert.deepEqual([blockOf("opus")[0].name, blockOf("sonnet")[0].name], ["opus/four/plain-1", "sonnet/four/watched-1"]);
  const follows = BLOCKS.flatMap((block) => ROUNDS[block].flatMap((arms) => [`${arms[0]} then ${arms[1]}`, `${arms[1]} then ${arms[2]}`])).sort();
  assert.deepEqual(follows, ARMS.flatMap((a) => ARMS.filter((b) => b !== a).flatMap((b) => [`${a} then ${b}`, `${a} then ${b}`])).sort(), "each arm comes straight after each other arm, in one block or the other");
  const across = BLOCKS.flatMap((block) => ROUNDS[block].map((arms) => arms.join(" ")));
  assert.equal(new Set(across).size, 6, "the six orders of three arms, each once across the two blocks");
  assert.ok(page.includes("Between them the two blocks hold all six orders of the three arms, each once"));
  const without = (block) => ROUNDS[block].map((arms) => arms.filter((arm) => arm !== "outside").map((arm) => arm[0]).join(""));
  assert.deepEqual([without("opus"), without("sonnet")], [["pw", "wp", "pw"], ["wp", "pw", "wp"]]);
  assert.ok(page.includes("plain first twice in `opus` and watched first twice in `sonnet`"));
  assert.ok(page.includes("\nThirty-six runs. "));
  assert.deepEqual([order().length, new Set(order().map((run) => run.name)).size, new Set(order().map((run) => recordOf(run, "/records"))).size], [36, 36, 36]);
  assert.deepEqual([order()[0].name, order()[6].name, order()[12].name, order()[18].name, order()[35].name], ["opus/four/plain-1", "opus/four/watched-2", "opus/four/outside-3", "sonnet/four/watched-1", "sonnet/six/plain-3"]);
  assert.equal(recordOf(order()[5]), join(root, "experiments", "watching", "second-look", "opus", "six", "outside-1"));
  for (const run of order()) assert.deepEqual([run.replicate, run.name], [run.round, `${run.block}/${run.task}/${run.arm}-${run.round}`]);
  // The tables' script keeps the same table of rounds, for a page made with no runner at hand.
  assert.deepEqual((await import(TABLES)).ROUNDS, ROUNDS);
});

test("the sentence, the two models, the limits and the tasks are the page's, to the letter", () => {
  assert.ok(page.includes(`\n> ${SENTENCE}\n`), "the sentence every prompt ends its task with");
  assert.ok(page.includes(`The first check said "${SUBAGENTS_SENTENCE}"`), "and the first check's, which it takes the place of");
  assert.ok(page.includes("| `opus` | Claude Opus 5.5 (`claude-opus-5-5`) |"));
  assert.ok(page.includes("| `sonnet` | Claude Sonnet 5.5 (`claude-sonnet-5-5`) |"));
  assert.deepEqual(LEAD, { opus: { model: "claude-opus-5-5", effort: "high" }, sonnet: { model: "claude-sonnet-5-5", effort: "high" } });
  assert.deepEqual(Object.keys(LEAD), BLOCKS);
  for (const lead of Object.values(LEAD)) assert.ok(!/fable|astra/i.test(lead.model));
  // THE LIMITS. They are a proposal until the first run, and the owner's answer to it changes one table: WATCHDOG and
  // STOPS_AT_USD in the runner, and these two lines, which are that table written out once more. Everything else here,
  // and in every other test, is made from the runner's numbers: the page's rows and sums, and the ledger's (the next
  // test but three). Until the page and the ledger say the same, those lines fail and say which.
  assert.deepEqual(WATCHDOG, { opus: { four: { usd: 12, minutes: 40 }, six: { usd: 18, minutes: 60 } }, sonnet: { four: { usd: 5, minutes: 40 }, six: { usd: 8, minutes: 60 } } });
  assert.equal(STOPS_AT_USD, 200);
  const usd = (amount) => `$${amount.toFixed(2)}`;
  for (const block of BLOCKS) assert.ok(page.includes(`| \`${block}\` | ${usd(WATCHDOG[block].four.usd)}, ${WATCHDOG[block].four.minutes} minutes | ${usd(WATCHDOG[block].six.usd)}, ${WATCHDOG[block].six.minutes} minutes |`), `the page's row for ${block}`);
  assert.ok(page.includes(`The whole look stops at **${usd(STOPS_AT_USD)}** on a ledger of its own`));
  const at = (block) => blockOf(block).reduce((sum, run) => sum + WATCHDOG[run.block][run.task].usd, 0);
  assert.ok(page.includes(`the thirty-six runs would come to **${usd(at("opus") + at("sonnet"))}**: ${usd(at("opus"))} for the \`opus\` block (nine runs at ${usd(WATCHDOG.opus.four.usd)} and nine at ${usd(WATCHDOG.opus.six.usd)}) and ${usd(at("sonnet"))} for \`sonnet\` (nine at ${usd(WATCHDOG.sonnet.four.usd)} and nine at ${usd(WATCHDOG.sonnet.six.usd)})`), "the page's sums are the ceilings' sums");
  assert.ok(at("opus") + at("sonnet") > STOPS_AT_USD, "the ceilings add up to more than the cap, on purpose");
  const hours = blockOf("opus").reduce((sum, run) => sum + WATCHDOG.opus[run.task].minutes, 0) / 60;
  assert.ok(page.includes(`At the minute limits a block would take ${{ 12: "twelve", 15: "fifteen", 18: "eighteen" }[hours] ?? hours} hours`), `${hours} hours at the minute limits`);
  for (const block of BLOCKS) assert.deepEqual([WATCHDOG[block].four.minutes, WATCHDOG[block].six.minutes], [WATCHDOG.opus.four.minutes, WATCHDOG.opus.six.minutes], `${block}: the minutes go by the task, the same in every block`);
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
    assert.deepEqual([nextRun(top).name, nextRun(top, "sonnet").name], ["opus/four/plain-1", "sonnet/four/watched-1"]);
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
  // The ledger's numbers are the runner's: its cap, each run's ceiling, and the least and the most of those.
  const ceilings = BLOCKS.flatMap((block) => [WATCHDOG[block].four.usd, WATCHDOG[block].six.usd]);
  assert.deepEqual([kept.cap_usd, kept.refuse_below_usd, kept.per_invocation_ceiling_usd], [STOPS_AT_USD, Math.min(...ceilings), Math.max(...ceilings)]);
  for (const block of BLOCKS) assert.deepEqual([kept.watchdog[block].four, kept.watchdog[block].six], [WATCHDOG[block].four, WATCHDOG[block].six], block);
  const ceilingsOf = (block) => blockOf(block).reduce((sum, run) => sum + WATCHDOG[block][run.task].usd, 0);
  assert.ok(kept.cap_is.includes(`add up to $${(ceilingsOf("opus") + ceilingsOf("sonnet")).toFixed(2)} ($${ceilingsOf("opus").toFixed(2)} in the opus block, $${ceilingsOf("sonnet").toFixed(2)} in the sonnet block) and the cap is $${STOPS_AT_USD.toFixed(2)}`), "the ledger's own sentence about its cap");
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
    const full = place({ uses: [] }, { lines: [{ n: 1, run: "second-look/x", project: "second-look/x", kind: "kickoff", status: "ok", cost_usd: STOPS_AT_USD - 10, reported_cost_usd: STOPS_AT_USD - 10, max_budget_usd: WATCHDOG.opus.six.usd, started: "2026-10-11T00:00:00.000Z" }] });
    try {
      assert.ok(WATCHDOG.opus.four.usd > 10, "the first run's ceiling is more than the room left");
      await assert.rejects(runOne(full.opus), (error) => error instanceof NotStarted && error.message.includes(`has counted $${(STOPS_AT_USD - 10).toFixed(2)} on its ledger, and this run may cost up to $${WATCHDOG.opus.four.usd.toFixed(2)}: together past the $${STOPS_AT_USD.toFixed(2)}`));
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
  const text = launcherText({ harness: "/bin/the harness", node: "/usr/bin/node", cli: "/repo/grooph.js", groophHome: "/scratch/home/.grooph", configDir: "/scratch/profile", folder: "/scratch/work/a/it's here", dir: "/scratch/home" });
  assert.equal(text.match(/GROOPH_HOME='\/scratch\/home\/\.grooph' CLAUDE_CONFIG_DIR='\/scratch\/profile' CODEX_HOME='\/scratch\/home\/\.codex-is-not-used' '\/usr\/bin\/node' '\/repo\/grooph\.js' hooks/g).length, 2);
  assert.ok(text.includes(`hooks install --user --harness claude-code &&`) && text.includes(`hooks watch '/scratch/work/a/it'\\''s here'`));
  // It starts a session and answers nothing else; the moment before it becomes the harness it leaves the file that says a session was started.
  assert.match(text, /if \[ -z "\$session" \]; then\n {2}echo "this is the launcher of one run of the second look's outside arm: it starts that session and answers nothing else" >&2\n {2}exit 64\nfi/);
  assert.equal(text.match(/exec /g).length, 1, "the harness is named once, to become it");
  assert.ok(text.trimEnd().endsWith(`: >'/scratch/home/${STARTED}' || exit 70\nexec '/bin/the harness' "$@"`));
  // What it leaves is kept with grooph's own folder for the run: nothing of it is written beside the session's folder.
  assert.ok(!text.includes("/scratch/work/a/harness") && text.includes(`>'/scratch/home/outside-install.txt' 2>&1 || exit 70`) && text.includes(`'/scratch/home/settings-with-the-recorder.json' || exit 70`));
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
      made[arm] = { files: filesUnder(builtRun.cwd), closed: builtRun.closed.map((path) => path.slice(builtRun.cwd.length + 1)), installed: builtRun.installed, outside: builtRun.outside, work: builtRun.work, beside: readdirSync(builtRun.work).sort(), withGroophs: builtRun.outside ? readdirSync(builtRun.outside.dir) : null };
      for (const pkg of TASKS.six.packages) for (const file of filesUnder(join(comparisons, pkg.project, "task"))) assert.equal(readFileSync(join(builtRun.cwd, pkg.folder, file), "utf8"), readFileSync(join(comparisons, pkg.project, "task", file), "utf8"), `${arm}: ${pkg.folder}/${file}`);
      unbuild(builtRun);
    }
    assert.deepEqual(made.outside.files, made.plain.files, "the outside arm's folder is the plain arm's");
    assert.ok(!made.plain.files.some((file) => file.startsWith(".grooph") || file.startsWith(".claude")));
    assert.deepEqual(made.watched.files.filter((file) => !made.plain.files.includes(file)), [".claude/settings.json", ".grooph/hooks/grooph-event.mjs", ".grooph/hooks/grooph-events-push.mjs"]);
    assert.deepEqual([made.plain.closed, made.watched.closed, made.outside.closed], [[], [".grooph"], []]);
    // The folder above the session's holds the same things in every arm: the launcher is kept with grooph's own folder
    // for the run, under the profile's home. Building installs nothing, and taking a build away leaves nothing.
    assert.deepEqual([made.plain.beside, made.watched.beside, made.outside.beside], [["base.git", "packages"], ["base.git", "packages"], ["base.git", "packages"]]);
    assert.deepEqual([made.outside.outside.grooph_home, made.outside.outside.dir, made.outside.withGroophs], [groophHomeIn(p.home), join(p.home, "home"), ["launch-outside.sh"]]);
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
    assert.deepEqual(p.ledger().invocations.map((entry) => [entry.run, entry.project, entry.arm, entry.replicate, entry.status, entry.cost_usd, entry.max_budget_usd]), [["second-look/opus/four/plain-1", "second-look/opus/four", "plain", 1, "ok", 0.5, WATCHDOG.opus.four.usd]]);
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
    // The profile's settings three times, and the profile's own check after the run, on every line.
    assert.deepEqual(there.the_profiles_settings.map((view) => [view.when, view.holds]), [["before the install", true], ["during the session", true], ["after it", true]]);
    assert.equal(there.the_profiles_settings[1].they_are, "the repository's, and 3 entries that run the recorder; every other setting as it was");
    assert.deepEqual(there.the_profile_afterwards, { checked_by: "scripts/lib/compare-profile.mjs --check, every line", holds: true, lines_that_do_not_hold: [] });
    // The harness was the very process the profile's runner started: the launcher became it, in a process group of its own.
    const [pid, group] = p.process();
    assert.ok(Number.isInteger(pid) && pid === group, `the harness ran as process ${pid} in group ${group}`);
    assert.ok(!sawAVariableOfGroophs(p));
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
    assert.ok(!existsSync(join(p.home, "home")) && existsSync(join(outside.kept, "home", ".grooph", "hooks", "grooph-event.mjs")) && existsSync(join(outside.kept, "home", "launch-outside.sh")));
    assert.deepEqual(readdirSync(join(outside.kept, "work")).sort(), ["base.git", "harness", "packages"], "beside the session's folder: what every arm has there");
    assert.ok(typeof there.seconds_the_launcher_took_before_the_harness === "number" && there.seconds_the_launcher_took_before_the_harness >= 0 && there.seconds_the_launcher_took_before_the_harness < 30);
    // The hook's file and the run's events are outside the session's folder, which holds nothing of grooph.
    assert.deepEqual(readdirSync(join(outside.kept, "work", "packages")).filter((name) => name.startsWith(".grooph") || name === ".claude"), []);
    assert.ok(existsSync(join(outside.kept, "home", ".grooph", "events", "packages", `${outsideResult.session_id}.jsonl`)));
    // Nothing of the account's is in a record: the home folder's path is taken out of every file.
    for (const dir of [plain.recordDir, watched.recordDir, outside.recordDir]) for (const file of filesUnder(dir)) assert.ok(!readFileSync(join(dir, file), "utf8").includes(homedir()), `${dir}/${file}`);
    assert.equal(p.ledger().invocations.length, 3);
    assert.match(status({ ledgerPath: p.ledgerPath, recordRoot: p.recordRoot }), /round 1 {2}opus\/four\/outside-1 {4}recorded and scored: ended by the session; 2 subagent\(s\)/);
  } finally {
    rmSync(p.top, { recursive: true, force: true });
  }
});

test("a run of the outside arm is refused before anything is made when the install cannot be rehearsed; and if the launcher cannot install, no session starts and the run is not a result", { skip: !built }, async () => {
  const p = place(quietPlan("outside"));
  try {
    inHand(p.recordRoot, order().slice(0, 4));
    await assert.rejects(runOne({ ...p.opus, rehearsal: () => ({ ok: false, why: "this checkout's grooph did not install the recorder outside a project (…). That install is slice 0108's: until it is on main and built here, a block is started with --without-outside" }) }), notStarted(/opus\/four\/outside-1 is a run of the outside arm, and this checkout's grooph did not install .* --without-outside/));
    assert.deepEqual([readdirSync(p.at.work), p.ledger().invocations.length], [[], 0]);
    // Without the outside arm the block goes on to round two's watched runs.
    assert.equal(nextRun(p.recordRoot, "opus", { withoutOutside: true }).name, "opus/four/watched-2");
    // A tool that fails when the launcher runs it, after a rehearsal that passed: the launcher starts nothing.
    const failed = await runAll({ ...p.opus, cli: standInTool(p.top, "refuses") });
    assert.deepEqual([failed.done.length, failed.stopped?.why], [1, "its record has problems"], "the block stops there, for a person");
    const not = failed.done[0];
    assert.deepEqual([not.run.name, not.notStarted, not.score, not.recordDir.endsWith("opus/four/outside-1-not-started")], ["opus/four/outside-1", true, null, true]);
    assert.ok(!existsSync(join(p.top, "the-harness-was-this-process")) && !existsSync(join(p.at.profile, "command-seen-by-the-stand-in.json")), "the harness was never started");
    assert.deepEqual([not.result.ended_by, not.result.counted_usd, not.result.scored], ["nobody: no session was started", 0, false]);
    assert.match(not.result.not_started, /the launcher could not install the recorder outside the project, or could not list the session's folder \(grooph: Unknown option '--user'\), so it started nothing: no session ran and nothing was spent/);
    assert.match(readFileSync(join(not.recordDir, "outside-install.txt"), "utf8"), /Unknown option '--user'/);
    // It is no result: the run has no record of its own, its ledger line is settled at nothing under another name, and nothing is left in the next run's way.
    assert.equal(stateOf(order()[4], p.recordRoot).state, "not recorded");
    assert.deepEqual(p.ledger().invocations.map((entry) => [entry.run, entry.status, entry.cost_usd]), [["second-look/opus/four/outside-1-not-started", "failed", 0]]);
    assert.equal(readFileSync(join(p.at.profile, "settings.json"), "utf8"), `${JSON.stringify(settingsFor({ home: p.home }), null, 2)}\n`);
    assert.deepEqual([readdirSync(p.at.work), existsSync(join(p.home, "home"))], [[], false]);
    // Once a person has looked, the same command starts the same run, and it is recorded as any other.
    const again = await runOne(p.opus);
    assert.deepEqual([again.run.name, again.notStarted, again.result.ended_by, again.result.problems], ["opus/four/outside-1", undefined, "the session", []]);
    assert.deepEqual(p.ledger().invocations.map((entry) => entry.run), ["second-look/opus/four/outside-1-not-started", "second-look/opus/four/outside-1"]);
    assert.equal(stateOf(order()[4], p.recordRoot).state, "recorded and scored");
  } finally {
    rmSync(p.top, { recursive: true, force: true });
  }
});

test("the launcher is the program started for the session and for nothing else: the profile's check asks the harness itself, and the launcher answers no other call", { skip: !built }, async () => {
  const p = place(quietPlan("outside"));
  try {
    inHand(p.recordRoot, order().slice(0, 4));
    // The profile's check is handed the program to ask: every time, before the run and after it, it is the harness.
    const asked = [];
    const done = await runOne({ ...p.opus, profileCheck: (given) => (asked.push(given.claude), []) });
    assert.deepEqual([done.run.name, done.result.problems], ["opus/four/outside-1", []]);
    assert.deepEqual(asked, [p.harness, p.harness], "once before the session, by the profile's runner, and once after it, by this one");
    // What was started for the session was the launcher, and it is named in the record's command.
    assert.ok(done.result.command[0].endsWith("/launch-outside.sh"));
    const launcher = join(done.kept, "home", "launch-outside.sh");
    // Asked for its version, its help text or whether it is signed in, the launcher is not the harness: it says so and does nothing.
    for (const args of [["--version"], ["--help"], ["auth", "status"], ["-p", "a prompt with no session named"]]) {
      const out = spawnSync(launcher, args, { encoding: "utf8", cwd: p.top });
      assert.deepEqual([out.status, out.stdout, /it starts that session and answers nothing else/.test(out.stderr)], [64, "", true], args.join(" "));
    }
    assert.ok(!existsSync(join(p.home, "home")), "and installs nothing");
    // A result of an outside session that shows a place the recorder is kept in, which the call did not name: the arm's
    // premise is that it cannot, so the record says it and the runs after it wait. A refused read that echoes its own path is not that.
    const shows = (result, refused = false) => ({ uses: [{ ...quietPlan("outside").uses[0], input: { command: `cat ${join(p.at.profile, "settings.json")}` }, result, is_error: refused }] });
    p.setPlan(shows(`cat: ${join(p.at.profile, "settings.json")}: Operation not permitted`, true));
    const refusedRead = await runOne(p.opus);
    assert.deepEqual([refusedRead.run.name, refusedRead.result.problems, refusedRead.result.measures.noticed.named_in_the_input.of_them_refused], ["opus/six/outside-1", [], 1]);
    inHand(p.recordRoot, order().filter((run) => run.block === "opus" && run.round === 2 && run.arm === "watched"));
    p.setPlan(shows('{ "hooks": { "SessionStart": [ { "hooks": [ { "command": "node grooph-event.mjs claude-code --user" } ] } ] } }'));
    const read = await runAll(p.opus);
    assert.deepEqual([read.done.map((one) => one.run.name), read.stopped?.why], [["opus/four/outside-2"], "its record has problems"]);
    assert.ok(read.done[0].result.problems.some((problem) => /1 tool result\(s\) of this session show a place the recorder is kept in outside the project that the call did not itself name \(among: the hook's file name\)/.test(problem)), read.done[0].result.problems.join("; "));
    // A profile that does not hold on every line after a run of the arm is in the record, and stops the runs after it.
    p.setPlan(quietPlan("outside"));
    let calls = 0;
    const after = await runAll({ ...p.opus, profileCheck: () => ((calls += 1) === 1 ? [] : [{ what: "its settings are the repository's", ok: false, how: "a test's stand-in" }]) });
    assert.deepEqual([after.done.map((one) => one.run.name), after.stopped?.why], [["opus/six/outside-2"], "its record has problems"]);
    assert.deepEqual(after.done[0].result.given.recorder_outside_the_project.the_profile_afterwards, { checked_by: "scripts/lib/compare-profile.mjs --check, every line", holds: false, lines_that_do_not_hold: ["its settings are the repository's: a test's stand-in"] });
  } finally {
    rmSync(p.top, { recursive: true, force: true });
  }
});

test("the launcher becomes the harness: when the watchdog ends the process group, the harness and what it left running go with it", { skip: !built }, async () => {
  const p = place({ hang_ms: 60_000, children: true });
  try {
    const run = order()[4];
    const made = build({ run, home: p.home, cli: p.common.cli, harness: p.harness });
    mkdirSync(made.harnessDir, { recursive: true });
    assert.ok(!existsSync(join(made.outside.dir, STARTED)));
    writeFileSync(join(p.at.profile, "settings.json"), `${JSON.stringify(settingsFor({ home: p.home }), null, 2)}\n`, "utf8");
    const began = Date.now();
    const child = await runBounded({ program: made.outside.launcher, args: ["-p", "the prompt", "--session-id", "a-session"], cwd: made.cwd, env: { PATH: process.env.PATH, CLAUDE_CONFIG_DIR: p.at.profile, TMPDIR: p.at.temp }, outPath: join(made.harnessDir, "out.json"), errPath: join(made.harnessDir, "err.txt"), ms: 6000, grace: 300 });
    // The limit is long enough for the launcher to have become the harness on a busy machine, and far short of the minute the stand-in would hang for.
    assert.deepEqual([child.timed_out, Date.now() - began < 40_000], [true, true], "the watchdog's limit ended it, long before the stand-in would have ended itself");
    assert.ok(existsSync(join(made.outside.dir, STARTED)), "the launcher had become the harness");
    const [pid, group] = p.process();
    assert.equal(pid, group, "the harness was the group's own first process");
    // The stand-in's child ignores being asked to end; it is in the same group, and is gone.
    const left = Number(readFileSync(join(p.at.profile, "child.pid"), "utf8"));
    const alive = (id) => {
      try {
        process.kill(id, 0);
        return true;
      } catch {
        return false;
      }
    };
    // A process that was killed may be listed for a moment more, until whoever took it over has collected it: it is
    // looked for until it is gone, for a few seconds at most.
    const gone = async (id) => {
      for (let tries = 0; tries < 100 && alive(id); tries += 1) await new Promise((later) => setTimeout(later, 50));
      return !alive(id);
    };
    assert.deepEqual([await gone(pid), await gone(left)], [true, true], "the harness and the child it left running are both gone");
    unbuild(made);
    assert.deepEqual([existsSync(made.work), existsSync(join(p.home, "home"))], [false, false]);
  } finally {
    rmSync(p.top, { recursive: true, force: true });
  }
});

test("both blocks are run from one checkout: a run from another commit, or with another hook, than a run already recorded is refused unless it is asked for by name, and then its record says so", { skip: !built }, async () => {
  const p = place(quietPlan("plain"));
  try {
    const now = checkout();
    assert.ok(/^[0-9a-f]{40}$/.test(now.commit) && /^[0-9a-f]{64}$/.test(now.hook_sha256));
    assert.equal(madeFromAnother(now, p.recordRoot), null);
    const first = await runOne(p.opus);
    assert.deepEqual([first.result.given.the_runners_checkout.commit, first.result.given.the_runners_checkout.hook_sha256, first.result.given.the_runners_checkout.another_than_a_run_before], [now.commit, now.hook_sha256, null]);
    assert.equal(madeFromAnother(now, p.recordRoot), null, "a run from this checkout is from no other");
    // A record made with another hook's file: as when a block was started before slice 0108 was merged, and the rest is made after it.
    const earlier = JSON.parse(readFileSync(join(first.recordDir, "result.json"), "utf8"));
    earlier.given.the_runners_checkout.hook_sha256 = "0".repeat(64);
    writeFileSync(join(first.recordDir, "result.json"), JSON.stringify(earlier), "utf8");
    assert.deepEqual(madeFromAnother(now, p.recordRoot), { run: "opus/four/plain-1", what: ["another hook"], its_commit: now.commit, its_hook_sha256: "0".repeat(64) });
    await assert.rejects(runOne(p.opus), notStarted(/opus\/four\/plain-1 was made from another hook .*both blocks are run from one built checkout at one commit.*say so by name with --another-checkout/s));
    assert.deepEqual([readdirSync(p.at.work), p.ledger().invocations.length], [[], 1], "refused before anything was made or opened");
    assert.match(status({ ledgerPath: p.ledgerPath, recordRoot: p.recordRoot }), /opus\/four\/plain-1 WAS MADE FROM ANOTHER HOOK/);
    const said = await runOne({ ...p.opus, anotherCheckout: true });
    assert.deepEqual([said.run.name, said.result.problems, said.result.given.the_runners_checkout.another_than_a_run_before], ["opus/six/plain-1", [], { run: "opus/four/plain-1", what: ["another hook"], its_commit: now.commit, its_hook_sha256: "0".repeat(64), said_by: "--another-checkout" }]);
    // And the tables name the run under its block's table.
    const { tables } = await import(TABLES);
    assert.match(tables(p.recordRoot), /\nMade from another checkout than the first run of the look \(another commit, or another hook's file\): `six` plain 1\.\n/);
    assert.ok(tables(p.recordRoot).includes(`The block's first run was made from commit \`${now.commit.slice(0, 8)}\`, with the hook's file \`00000000\`.`));
    // A record that does not say which checkout made it is passed over.
    inHand(p.recordRoot, [order()[2]]);
    assert.equal(madeFromAnother({ commit: earlier.given.the_runners_checkout.commit, hook_sha256: "0".repeat(64) }, p.recordRoot).run, "opus/six/plain-1");
  } finally {
    rmSync(p.top, { recursive: true, force: true });
  }
});

test("how a block's sessions took the tasks' bet, as the status says it: how many started a subagent, and whether the protocol's own test fails as the records stand", () => {
  const top = mkdtempSync(join(tmpdir(), "second-look-bet-"));
  try {
    const record = (run, subagents) => {
      mkdirSync(join(top, run.name), { recursive: true });
      writeFileSync(join(top, run.name, "result.json"), JSON.stringify({ ended_by: "the session", measures: { subagents: { count: subagents } } }), "utf8");
    };
    assert.ok(page.includes("If fewer than five in six of a block's sessions start any subagent (fifteen of eighteen), or if on either task some arm has no run that does"));
    assert.deepEqual(theBet("opus", top), { recorded: 0, delegated: 0, arms_with_no_run_that_delegated: [], fails: null });
    const opus = blockOf("opus");
    // One round, five of six: five in six is not fewer than five in six, but one arm of one task has no run that delegated.
    opus.slice(0, 6).forEach((run) => record(run, run.arm === "watched" && run.task === "six" ? 0 : 4));
    assert.deepEqual(theBet("opus", top), { recorded: 6, delegated: 5, arms_with_no_run_that_delegated: ["`six` watched"], fails: true });
    assert.match(status({ ledgerPath: LEDGER, recordRoot: top }), /sessions that started a subagent: 5 of 6 with a record; no run that did, so far, in `six` watched\n {2}AS THESE RECORDS STAND THE TASKS' BET FAILS ITS TEST/);
    // A whole block: fifteen of eighteen with every arm of every task delegating at least once passes; fourteen does not.
    opus.forEach((run, at) => record(run, at < 3 ? 0 : 6));
    assert.deepEqual([theBet("opus", top).delegated, theBet("opus", top).arms_with_no_run_that_delegated, theBet("opus", top).fails], [15, [], false]);
    assert.ok(!/BET FAILS/.test(status({ ledgerPath: LEDGER, recordRoot: top })));
    record(opus[3], 0);
    assert.deepEqual([theBet("opus", top).delegated, theBet("opus", top).fails], [14, true]);
    // Fifteen again, but one arm of one task never delegated: it fails by the second half of the test.
    opus.forEach((run) => record(run, run.arm === "outside" && run.task === "four" ? 0 : 6));
    assert.deepEqual([theBet("opus", top).delegated, theBet("opus", top).arms_with_no_run_that_delegated, theBet("opus", top).fails], [15, ["`four` outside"], true]);
    // A block of twelve, made without its outside arm: ten of twelve passes, nine does not.
    rmSync(join(top, "opus"), { recursive: true, force: true });
    opus.filter((run) => run.arm !== "outside").forEach((run, at) => record(run, at < 2 ? 0 : 5));
    assert.deepEqual([theBet("opus", top).recorded, theBet("opus", top).delegated, theBet("opus", top).fails], [12, 10, false]);
    record(opus.filter((run) => run.arm !== "outside")[2], 0);
    assert.deepEqual([theBet("opus", top).delegated, theBet("opus", top).fails], [9, true]);
  } finally {
    rmSync(top, { recursive: true, force: true });
  }
});

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
    assert.deepEqual(p.ledger().invocations.map((entry) => entry.max_budget_usd), [0, 1, 2].flatMap(() => [WATCHDOG.opus.four.usd, WATCHDOG.opus.six.usd]), "each run under its own task's ceiling");
    assert.deepEqual(readdirSync(p.recordRoot), ["opus"], "nothing of the next block was started");
    // With one whole round of opus in hand the sonnet block may be started, by name, on its own model under its own ceilings.
    p.setPlan(quietPlan("watched"));
    const sonnet = await runAll({ ...p.common, block: "sonnet", withoutOutside: true, throughRound: 1, each: before([]) });
    assert.deepEqual([sonnet.done.map((done) => done.run.name), sonnet.stopped], [["sonnet/four/watched-1", "sonnet/six/watched-1", "sonnet/four/plain-1", "sonnet/six/plain-1"], null]);
    // A watched session whose hook left no file was not watched: its record says so, and the runs after it wait for a person.
    p.setPlan(quietPlan("plain"));
    const unwatched = await runAll({ ...p.common, block: "sonnet", throughRound: 1 });
    assert.deepEqual([unwatched.done.map((done) => done.run.name), unwatched.stopped?.why], [["sonnet/four/outside-1"], "its record has problems"]);
    assert.ok(unwatched.done[0].result.problems.some((problem) => /the hook left no file for this session under grooph's own folder for the run: the recorder did not load/.test(problem)));
    // Its record is kept and says so: it is no run of its arm, and its values are not read with that arm's.
    assert.match(unwatched.done[0].result.not_watched, /the hook left no file for this session: it is no run of its arm/);
    assert.match(stateOf(unwatched.done[0].run, p.recordRoot).state, /^recorded, and NOT WATCHED/);
    assert.equal(sonnet.done[0].result.not_watched, null);
    const { tables: made, readings } = await import(TABLES);
    assert.ok(made(p.recordRoot).includes("| `four` | outside, NOT WATCHED: no hook's file |"));
    assert.deepEqual(readings(p.recordRoot, "sonnet").find((reading) => reading.a === "plain" && reading.b === "outside").tasks[0].b, [], "a session that was not watched is not among its arm's values");
    assert.deepEqual(p.ledger().invocations.slice(6).map((entry) => entry.max_budget_usd), [WATCHDOG.sonnet.four.usd, WATCHDOG.sonnet.six.usd, WATCHDOG.sonnet.four.usd, WATCHDOG.sonnet.six.usd, WATCHDOG.sonnet.four.usd]);
    const args = p.seen().args;
    assert.deepEqual([args[args.indexOf("--model") + 1], args[args.indexOf("--effort") + 1], args[args.indexOf("--max-budget-usd") + 1]], ["claude-sonnet-5-5", "high", String(WATCHDOG.sonnet.four.usd)]);
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
    assert.ok(said.outside.includes(`--max-budget-usd ${WATCHDOG.opus.six.usd} `));
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
    assert.deepEqual(seen.places, ["the profile's own settings file", "grooph's own folder for the run", "the hook's file name", "a variable of grooph's", "the launcher's own files"]);
    assert.deepEqual(seen.named_in_the_input, { calls: 3, by_tool: { Bash: 2, Read: 1 }, by_place: { "grooph's own folder for the run": 1, "the profile's own settings file": 2 }, of_them_refused: 2 });
    assert.deepEqual(seen.shown_in_the_result, { calls: 3, by_tool: { Bash: 3 }, by_place: { "a variable of grooph's": 1, "grooph's own folder for the run": 2, "the hook's file name": 1 }, of_them_showing_a_place_the_call_did_not_name: 3 });
    assert.deepEqual(seen.the_final_reply, { read: true, names_the_recorder: true, in_the_project: [".grooph"], outside_it: ["a variable of grooph's"], uses_the_word_hook: false });
    // Counts only: nothing a call said and nothing that came back is in what is kept.
    assert.ok(!JSON.stringify(seen).includes("cat ") && !JSON.stringify(seen).includes("Operation not permitted") && !JSON.stringify(seen).includes("left both alone"));
    assert.deepEqual(noticed({ read, output: { result: "I changed src/ in each package." }, profileSettings, groophHome }).the_final_reply, { read: true, names_the_recorder: false, in_the_project: [], outside_it: [], uses_the_word_hook: false });
    // A reply that speaks of a hook and names no place: counted apart, as the one word.
    assert.deepEqual(noticed({ read, output: { result: "Done. A Hook seems to run when a subagent starts; I left it alone, and unhooked nothing." }, profileSettings, groophHome }).the_final_reply, { read: true, names_the_recorder: false, in_the_project: [], outside_it: [], uses_the_word_hook: true });
    // The launcher's own files are among the places: a session that saw one has seen how the recorder was installed.
    session(profile, "U", { lead: [use("a", "Bash", { command: "ls .." }, 0), result("a", "launch-outside.sh", 0), use("b", "Bash", { command: "cat ../home/outside-install.txt" }, 1), result("b", "refused", 1, { refused: true })] });
    const saw = noticed({ read: readSession(profile, "U"), output: { result: "done" }, profileSettings, groophHome });
    assert.deepEqual([saw.named_in_the_input.by_place, saw.named_in_the_input.of_them_refused, saw.shown_in_the_result.by_place], [{ "the launcher's own files": 1 }, 1, { "the launcher's own files": 1 }]);
    // A refused read whose error only repeats the path it was given shows the session nothing new; a listing that turns a place up does.
    session(profile, "V", { lead: [use("a", "Bash", { command: `cat ${profileSettings}` }, 0), result("a", `cat: ${profileSettings}: Operation not permitted`, 0, { refused: true }), use("b", "Bash", { command: "ls -a .." }, 1), result("b", "launch-outside.sh", 1)] });
    const echoed = noticed({ read: readSession(profile, "V"), output: { result: "done" }, profileSettings, groophHome });
    assert.deepEqual([echoed.shown_in_the_result.calls, echoed.shown_in_the_result.of_them_showing_a_place_the_call_did_not_name, echoed.named_in_the_input.of_them_refused], [2, 1, 1]);
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
    assert.match(text, /^### The `opus` block \(the session's own model answered as `claude-opus-5-5`\)\n\nThe block's first run was made from commit `[0-9a-f]{8}`, with the hook's file `[0-9a-f]{8}`\.\n\n\| Round \| Task \| Arm \|/);
    const rows = text.split("\n").filter((row) => /^\| [123][ ,]/.test(row));
    assert.equal(rows.length, 18, "one row for each run of the block, made or not");
    // The minutes are the runner's clock, and a stand-in's run takes what the machine gives it: the cell is a number, whatever it is.
    assert.match(rows[0], /^\| 1, the block's first run \| `four` \| plain \| the session \| \$0\.25 \| \d+(\.\d+)? \| 2 \| 1 \(1 general-purpose\) \| 1 \| 0\/55 · 0\/88 · 38\/73 · 0\/62 \| 0 \| 0 \| 0 \/ 0 \| 0 \/ 0 \/ 0 \| no \| {2}\| {2}\|$/);
    assert.equal(rows[1], `| 1 | \`six\` | plain | not run | ${HEAD.slice(4).map(() => "").join(" | ")} |`);
    assert.equal(HEAD.length, rows[0].split(" | ").length, "a row has a cell for every column");
    assert.ok(!text.includes("`sonnet` block"), "a block with no record has no table");
    // The rule is applied under the table, and with one run in an arm nothing is read.
    assert.ok(text.includes("#### The `opus` block, read by the rule\n\n| Measure | Arms | `four` | `six` | By the rule |"));
    assert.ok(text.includes("| Cost, as the harness reports | plain, watched | plain $0.2500 · watched none: not read | plain none · watched none: not read | not read: `four` has 0 run(s) in an arm; `six` has 0 run(s) in an arm |"));
    assert.ok(!text.includes("Seen in both blocks"), "with one block there is nothing to see in both");
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

test("the rule of reading is applied by the script, not by eye: overlap and apart, equal values, an arm short of a run, a session not watched, and what is seen in both blocks", async () => {
  const { MEASURES, onATask, PAIRS, readings, seenInBoth, tables } = await import(TABLES);
  // The five measures and the three pairs are the page's: fifteen readings a block.
  assert.ok(page.includes("**Five measures are read by the rule**: unseen tests passed (the packages' sum), the cost the harness reports, minutes, how many subagents were started (by the transcripts), and the tokens the session and its subagents put out."));
  assert.deepEqual([MEASURES.length, PAIRS, MEASURES.length * PAIRS.length], [5, [["plain", "watched"], ["plain", "outside"], ["watched", "outside"]], 15]);
  assert.ok(page.includes("Five measures by three pairs of arms is fifteen readings a block"));
  // Two arms on one task: apart only when every value of one is above every value of the other. Equal values overlap.
  assert.deepEqual([onATask([3, 4, 5], [1, 2, 2.99]), onATask([1, 2, 3], [4, 5, 6]), onATask([1, 2, 3], [3, 4, 5]), onATask([2, 2, 2], [2, 2, 2]), onATask([1, 9], [4, 5, 6])], [{ read: true, apart: "above" }, { read: true, apart: "below" }, { read: true, apart: null }, { read: true, apart: null }, { read: true, apart: null }]);
  assert.deepEqual([onATask([1], [2, 3, 4]), onATask([1, 2], []), onATask([1.245, 1.3], [1.2509, 1.4])], [{ read: false, why: "1 run(s) in an arm" }, { read: false, why: "0 run(s) in an arm" }, { read: true, apart: null }]);
  assert.ok(page.includes("Equal values overlap.") && page.includes("With fewer than two values in either arm on a task, the pair is not read."));
  const top = mkdtempSync(join(tmpdir(), "second-look-readings-"));
  try {
    // Records made by hand: a cost for each run, by block, task, arm and round, and everything else the same.
    const record = (block, task, arm, round, cost, more = {}) => {
      const dir = join(top, block, task, `${arm}-${round}`);
      mkdirSync(dir, { recursive: true });
      writeFileSync(join(dir, "result.json"), JSON.stringify({ ended_by: "the session", recorded: `2026-10-12T0${round}:00:00.000Z`, given: { the_runners_checkout: { commit: "c".repeat(40), hook_sha256: "h".repeat(64) } }, measures: { session: { cost_usd_as_the_harness_reports: cost, minutes_by_the_runners_clock: 5, models_that_answered: [`claude-${block}-5-5`] }, subagents: { count: 4, by_type: { "general-purpose": 4 } }, delegation: { tokens_put_out_with_its_subagents: 1000, most_at_once: 4 } }, ...more }), "utf8");
      writeFileSync(join(dir, "score.json"), JSON.stringify({ packages: [{ package: "x", passed: 274, cases: 278 }] }), "utf8");
    };
    const costs = { plain: [1.0, 1.1, 1.2], watched: [1.3, 1.4, 1.5], outside: [1.15, 1.25, 1.6] };
    for (const block of ["opus", "sonnet"]) for (const task of ["four", "six"]) for (const arm of ARMS) costs[arm].forEach((cost, at) => record(block, task, arm, at + 1, task === "six" && arm === "watched" ? cost - 0.3 : cost));
    const cost = (block) => readings(top, block).filter((reading) => reading.measure.name === "Cost, as the harness reports");
    // On `four` watched lies wholly above plain; on `six` the two overlap. A difference on one task is a difference.
    assert.deepEqual(cost("opus").map((reading) => [`${reading.a}, ${reading.b}`, reading.says]), [["plain, watched", "a difference: on `four`, plain below watched"], ["plain, outside", "no difference seen"], ["watched, outside", "no difference seen"]]);
    // Every other measure is the same in every run: equal values overlap, and nothing is said to differ.
    assert.deepEqual([...new Set(readings(top, "opus").filter((reading) => reading.measure.name !== "Cost, as the harness reports").map((reading) => reading.says))], ["no difference seen"]);
    assert.equal(readings(top, "opus").length, 15);
    // The same pair, the same task, the same direction, the same measure, in both blocks.
    assert.deepEqual(seenInBoth(top), ["Cost, as the harness reports: on `four`, plain below watched"]);
    assert.ok(tables(top).includes("\n**Seen in both blocks:** Cost, as the harness reports: on `four`, plain below watched.\n"));
    assert.ok(tables(top).includes("| Cost, as the harness reports | plain, watched | plain $1.0000, $1.1000, $1.2000 · watched $1.3000, $1.4000, $1.5000: plain below | plain $1.0000, $1.1000, $1.2000 · watched $1.0000, $1.1000, $1.2000: overlap | a difference: on `four`, plain below watched |"));
    // In the other direction in the second block it is seen in each and not in both.
    costs.plain.forEach((value, at) => record("sonnet", "four", "plain", at + 1, value + 1));
    assert.deepEqual([cost("sonnet")[0].says, seenInBoth(top)], ["a difference: on `four`, plain above watched", []]);
    assert.ok(tables(top).includes("\n**Seen in both blocks:** nothing.\n"));
    // A run the harness ended, and a session that was not watched, are not among an arm's values: with one value left, the pair is not read.
    record("opus", "four", "watched", 1, 1.3, { ended_by: "the harness" });
    record("opus", "four", "watched", 2, 1.4, { not_watched: "the hook left no file for this session" });
    assert.equal(cost("opus")[0].says, "not read: `four` has 1 run(s) in an arm");
    assert.deepEqual(seenInBoth(top), []);
    // Runs made later from another checkout (the outside arm, once it could be installed) are rows, and are not read with the block's others.
    for (const task of ["four", "six"]) for (const round of [1, 2, 3]) record("sonnet", task, "outside", round, 9, { recorded: "2026-10-13T00:00:00.000Z", given: { the_runners_checkout: { commit: "d".repeat(40), hook_sha256: "i".repeat(64) } } });
    assert.deepEqual(cost("sonnet").slice(1).map((reading) => reading.says), ["not read: `four` has 0 run(s) in an arm; `six` has 0 run(s) in an arm", "not read: `four` has 0 run(s) in an arm; `six` has 0 run(s) in an arm"]);
    assert.ok(tables(top).includes("\nMade from another checkout than this block's own first run, and so published as rows and not read with the block's other runs: `four` outside 1, `six` outside 1, `four` outside 2, `six` outside 2, `four` outside 3, `six` outside 3.\n"));
    // A cost decided by less than a cent is decided by the record's own figure, not by the row's two decimals.
    record("opus", "six", "plain", 1, 1.2409);
    record("opus", "six", "plain", 2, 1.2449);
    record("opus", "six", "plain", 3, 1.245);
    for (const [at, value] of [1.2451, 1.2509, 1.3].entries()) record("opus", "six", "outside", at + 1, value);
    assert.equal(cost("opus")[1].says, "a difference: on `six`, plain below outside");
  } finally {
    rmSync(top, { recursive: true, force: true });
  }
});
