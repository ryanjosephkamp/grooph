/**
 * The runs of the second look at watching, on work that calls for subagents. experiments/watching/second-look/README.md
 * is its protocol, written before anything was run: this script builds what that page says and nothing else. THIS
 * SCRIPT CAN SPEND MONEY: it starts model sessions. It refuses to without `--spend` and `--go "<the driver's words>"`;
 * `--dry-run` builds a run's folder, prints what would be started and what a paid run would be refused for as things
 * stand, takes the folder away again, and starts nothing.
 *
 *   node scripts/lib/watching-second-look-paid.mjs --status                              the ledger and the thirty-six runs, block by block
 *   node scripts/lib/watching-second-look-paid.mjs --dry-run                             the next run in the order
 *   node scripts/lib/watching-second-look-paid.mjs --dry-run --block sonnet              the next run of one block
 *   node scripts/lib/watching-second-look-paid.mjs --dry-run --run opus/six/outside-1    any one of the thirty-six
 *   node scripts/lib/watching-second-look-paid.mjs --dry-run --all [--block <name>]      every run still to come, of the look or of one block
 *   node scripts/lib/watching-second-look-paid.mjs --all --block <name> --spend --go "<the driver's words>"    every run of that block still to come,
 *                                                                                  one at a time, stopping at the first refusal or failed run
 *   … --all --block <name> --through-round 2 …     only the runs of its first two rounds (a block may be stopped at the end of a round)
 *   … --all --block <name> --without-outside …     its `plain` and `watched` runs, the `outside` ones left for later
 *   … --another-checkout …                         on purpose from another commit, or with another hook, than the runs already recorded
 *   … --next --block <name> --spend --go "<…>"     the next run of that block, and only that one
 *   … --rerun <block>/<task>/<arm>-<n> --spend --go "<…>"    only a run the harness ended, once, the reason written beside it
 *   node scripts/lib/watching-second-look-paid.mjs --score <block>/<task>/<arm>-<n>      score a run whose scorer failed; no session, no spend
 *   node scripts/lib/watching-second-look-paid.mjs --settle <n> --cost <usd|ceiling> --note "<what happened>"
 *                                                                                  settle a ledger line a stopped runner left running; no session
 *
 * Thirty-six runs, in two blocks: `opus`, then `sonnet`, each on one model for the session itself. A block is
 * eighteen: two tasks (`four`, `six`), three arms (`plain`, `watched`, `outside`), three rounds, the arms changing
 * places from round to round. A BLOCK IS STARTED BY NAME, by a person, and a block is refused while the block before
 * it has no whole round, or has a round begun and not finished.
 *
 * It is the first check's runner (watching-check-paid.mjs) made for other tasks and another third arm, and it keeps
 * that runner's safeguards by using them: a session is started from the comparison profile by the profile's own
 * runner (study-three-paid.mjs), so the gates, the watchdog, the record and the scrub are that module's; no run starts
 * unless the profile's first call is on record and says later runs may start; and NO RUN STARTS until the owner's
 * decision on scoring is recorded in this look's own ledger, for this look by name
 * (experiments/watching/second-look/ledger.json, scoring_outside_the_sandbox). The first check's decision is not read.
 *
 * The `outside` arm installs the recorder at the user's level of the clean profile and of nothing else. The owner's
 * own ~/.claude, ~/.codex and ~/.grooph are never named to the tool that installs it, and a run is refused if any
 * place it would name is one of them.
 *
 * Start a paid run from a terminal, not from a tool with a time limit of its own.
 */

import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { cpSync, existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, realpathSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { amendEntry, counted, loadLedger, saveLedger, settleEntry } from "./compare-ledger.mjs";
import { check as checkProfile, commandFor, DEFAULT_HOME, layout, settingsFor } from "./compare-profile.mjs";
import { scoreHeldOut, withExpected } from "./compare-score.mjs";
import { scoringDecided } from "./roles-or-information-paid.mjs";
import { asThingsStand, copyPlain, copyRecord, findHarness, firstCallAllows, makeProject, NotStarted, relativeToRoot, runSession, scrubValue, setAside, spendFlags, unknownFlags, writeResult } from "./study-three-paid.mjs";
import { CLI, CLOSED_IN_A_WATCHED_ARM, folderLine, FOUR_OPENS, hookBesideTranscripts, installHook, LEFT_TO_THE_HARNESS, measure, namesOnly, NotScored, SCORING_RUNS_WHAT_A_SESSION_WROTE, shortNamesIn, taskAlone, taskText as firstChecksTaskText, waitsForAPerson, withoutWhatDeniedCallsAsked } from "./watching-check-paid.mjs";
import { agentByAgent, delegation, noticed, readSession } from "./watching-second-look-measures.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const comparisons = join(root, "experiments", "comparisons");
export const HOME = join(root, "experiments", "watching", "second-look");
export const LEDGER = join(HOME, "ledger.json");
const PAGE = "experiments/watching/second-look/README.md";
const SCRIPT = "scripts/lib/watching-second-look-paid.mjs";
/**
 * The hook a checkout ships, by where its tool is (packages/cli/bin/grooph.js): what an install by that tool has to
 * have left. A tool that is in no checkout (a test's stand-in) is held to this checkout's.
 */
export const SHIPPED_HOOK = join(root, "packages", "cli", "hooks", "grooph-event.mjs");
export const shippedHookOf = (cli = CLI) => (existsSync(join(dirname(cli), "..", "hooks", "grooph-event.mjs")) ? join(dirname(cli), "..", "hooks", "grooph-event.mjs") : SHIPPED_HOOK);

// ── the protocol's own words and numbers ─────────────────────────────────

/** The sentence every arm's prompt ends its task with, to the letter (the protocol, "Three ways of running one task"). */
export const SENTENCE = "Use subagents for the parts of this that can be done side by side.";
/** The two blocks, in their order, and the session's own model in each, at high effort (the protocol, "Three rounds, in two blocks"). */
export const BLOCKS = ["opus", "sonnet"];
export const LEAD = {
  opus: { model: "claude-opus-5-5", effort: "high" },
  sonnet: { model: "claude-sonnet-5-5", effort: "high" },
};
export const ARMS = ["plain", "watched", "outside"];
/**
 * The arms' places in each block's three rounds, as the block makes them (the protocol, "Three rounds, in two
 * blocks"). In each block every arm goes first once, second once and last once. The second block's rounds are the
 * first's in a mirror: its first run is another arm's, each arm follows each other arm once across the two blocks, and
 * with the `outside` arm left out the two that remain still change places from round to round, the other way about
 * in each block.
 */
export const ROUNDS = {
  opus: [
    ["plain", "watched", "outside"],
    ["watched", "outside", "plain"],
    ["outside", "plain", "watched"],
  ],
  sonnet: [
    ["watched", "plain", "outside"],
    ["plain", "outside", "watched"],
    ["outside", "watched", "plain"],
  ],
};
export const roundsOf = (block) => ROUNDS[block];
const ROUND_COUNT = 3;
/**
 * The runner's watchdog for one run, which no session is told of, and where the whole look stops (the protocol,
 * "Limits"). The minutes go by the task and are the same in every block; the dollars go by the block.
 */
export const WATCHDOG = {
  opus: { four: { usd: 12, minutes: 40 }, six: { usd: 18, minutes: 60 } },
  sonnet: { four: { usd: 5, minutes: 40 }, six: { usd: 8, minutes: 60 } },
};
export const STOPS_AT_USD = 200;

/**
 * The two tasks, made of tasks the repository already holds, each package as its own project keeps it. `four` is the
 * first check's wide task; `six` is those four and two more. `cases` is how many cases the project's unseen suite
 * holds; a test runs each suite against the repository's own task folder and holds these numbers to it.
 */
const FOUR = [
  { name: "settingskit", folder: "settingskit", project: "review-gate-2", cases: 55 },
  { name: "textwrap", folder: "textwrap", project: "spec-then-loop", cases: 88 },
  { name: "csvline", folder: "csvline", project: "red-team-loop", cases: 73 },
  { name: "semver-mini", folder: "semver-mini", project: "grind-loop", cases: 62 },
];
export const TASKS = {
  four: { repository: "packages", packages: FOUR },
  six: { repository: "packages", packages: [...FOUR, { name: "printkit", folder: "printkit", project: "heterogeneous-critic", cases: 70 }, { name: "textkit", folder: "textkit", project: "review-gate", cases: 41 }] },
};

/** Where grooph's own folder is for a run of the `outside` arm: under the profile's home, outside the session's folder and what it may read or write. */
export const groophHomeIn = (home = DEFAULT_HOME) => join(home, "home", ".grooph");
/** The entry an install outside the project writes: the hook's file, the harness, `--user` (slice 0108). */
export const USER_ENTRY = /grooph-event\.mjs"? +claude-code +--user\s*$/;

const SCORING = { what: SCORING_RUNS_WHAT_A_SESSION_WROTE, where: "experiments/watching/second-look/ledger.json" };

// ── the order ────────────────────────────────────────────────────────────

/**
 * The thirty-six: in each block three rounds of six, the arms in that round's places, each arm's `four` before its
 * `six`. A run's name carries its block and its round in that block: `opus/six/outside-2`.
 */
export function order() {
  const runs = [];
  for (const block of BLOCKS) roundsOf(block).forEach((arms, at) => arms.forEach((arm) => Object.keys(TASKS).forEach((task) => runs.push({ block, task, arm, replicate: at + 1, round: at + 1, name: `${block}/${task}/${arm}-${at + 1}` }))));
  return runs;
}

/** Where a run's record is kept: its block's folder, its task's under that, and its own under that. */
export const recordOf = (run, recordRoot = HOME) => join(recordRoot, run.block, run.task, `${run.arm}-${run.replicate}`);

/** A run has a record: its own, or its rerun's when its own was never written and it was then run once more. */
const recorded = (run, recordRoot) => existsSync(join(recordOf(run, recordRoot), "result.json")) || existsSync(join(`${recordOf(run, recordRoot)}-rerun`, "result.json"));

/**
 * The first run of the order that has no record yet, or null: of the whole look, or of one block. `withoutOutside`
 * leaves the `outside` arm's runs out, and `throughRound` the runs of a later round.
 */
export const nextRun = (recordRoot = HOME, block = null, { withoutOutside = false, throughRound = null } = {}) =>
  order().find((run) => (block === null || run.block === block) && !(withoutOutside && run.arm === "outside") && (throughRound === null || run.round <= throughRound) && !recorded(run, recordRoot)) ?? null;

/**
 * What holds a block up, or null: the block before it having no whole round, or a round begun and not finished (the
 * protocol, "Three rounds, in two blocks"). A run of the `outside` arm is not needed for a round to be whole: a block
 * may be made without that arm while the recorder cannot be installed outside a project. A run the harness ended has
 * a record and holds nothing up: it waits for its one rerun.
 */
export function heldUpBy(block, recordRoot = HOME) {
  for (const earlier of BLOCKS.slice(0, Math.max(0, BLOCKS.indexOf(block)))) {
    const needed = order().filter((run) => run.block === earlier && run.arm !== "outside");
    const rounds = roundsOf(earlier).map((_, at) => needed.filter((run) => run.round === at + 1));
    const whole = rounds.filter((runs) => runs.every((run) => recorded(run, recordRoot)));
    const begun = rounds.filter((runs) => runs.some((run) => recorded(run, recordRoot)) && !runs.every((run) => recorded(run, recordRoot)));
    const why = begun.length > 0 ? `has a round begun and not finished (${begun.flatMap((runs) => runs.filter((run) => !recorded(run, recordRoot)).map((run) => run.name)).join(", ")} with no record)` : whole.length === 0 ? "has no whole round" : null;
    if (why) return { block: earlier, why: `the \`${block}\` block is not started while the \`${earlier}\` block, which comes before it, ${why}: a block is started by a person, and the driver reads its records before the next is started (${PAGE}, "Three rounds, in two blocks")` };
  }
  return null;
}

const SAY_WHICH_BLOCK = `say which block: ${BLOCKS.map((block) => `--block ${block}`).join(" or ")}. A block is started by name, by a person, in that order (${PAGE}, "Three rounds, in two blocks")`;

/** Where one run stands, from its record: its own, or its one rerun when the harness ended its own or its own was never written. */
export function stateOf(run, recordRoot = HOME) {
  const first = recordOf(run, recordRoot);
  const read = (dir) => (existsSync(join(dir, "result.json")) ? { result: JSON.parse(readFileSync(join(dir, "result.json"), "utf8")), score: existsSync(join(dir, "score.json")) ? JSON.parse(readFileSync(join(dir, "score.json"), "utf8")) : null } : null);
  const own = read(first);
  const again = read(`${first}-rerun`);
  if (!own && !again) return { state: "not recorded" };
  const used = !own || own.result.ended_by === "the harness" ? again : own;
  if (!used) return { state: "ended by the harness, and not yet run again", why: own.result.why ?? null };
  if (used.result.ended_by === "the harness") return { state: own ? "not obtained: the harness ended it both times" : "not obtained: never recorded the first time, and the harness ended it the second" };
  return {
    state: used.result.not_watched ? "recorded, and NOT WATCHED (no hook's file): no run of its arm" : used.score ? "recorded and scored" : "recorded, not scored",
    from: used === own ? "its own record" : "its rerun",
    ended_by: used.result.ended_by,
    counted_usd: used.result.counted_usd ?? null,
    subagents: used.result.measures?.subagents?.count ?? null,
    passed: used.score ? used.score.packages.map((pkg) => `${pkg.package} ${pkg.ran ? `${pkg.passed}/${pkg.cases}` : "not run"}`) : null,
  };
}

/**
 * How a block's sessions took the tasks' bet, from its records: how many started any subagent, and which arm of which
 * task has runs and none that did. `fails` is the protocol's own test, made of the runs that have a record: fewer
 * than five in six of them, or an arm of a task with no run that delegated ("What would show the bet was wrong").
 */
export function theBet(block, recordRoot = HOME) {
  const runs = order().filter((run) => run.block === block).map((run) => ({ ...run, ...stateOf(run, recordRoot) })).filter((run) => Number.isInteger(run.subagents));
  const delegated = runs.filter((run) => run.subagents > 0);
  const none = Object.keys(TASKS).flatMap((task) => ARMS.filter((arm) => runs.some((run) => run.task === task && run.arm === arm) && !delegated.some((run) => run.task === task && run.arm === arm)).map((arm) => `\`${task}\` ${arm}`));
  return { recorded: runs.length, delegated: delegated.length, arms_with_no_run_that_delegated: none, fails: runs.length === 0 ? null : delegated.length * 6 < runs.length * 5 || none.length > 0 };
}

// ── the ledger ───────────────────────────────────────────────────────────

/**
 * The second look's own ledger: the cap, each run's ceiling, the owner's decision on scoring, and a line for every
 * session. A ledger that is not there, cannot be read, or states other limits than the protocol's is a refusal.
 */
export function readLedger(path = LEDGER) {
  let ledger;
  try {
    ledger = JSON.parse(readFileSync(path, "utf8"));
  } catch (error) {
    throw new NotStarted(`the second look's ledger could not be read (${relativeToRoot(path)}: ${error.code ?? error.message}). It holds the cap, each run's ceiling and the owner's decision on scoring, and nothing runs without it`);
  }
  const wrong = [];
  if (!ledger || typeof ledger !== "object" || !Array.isArray(ledger.invocations)) wrong.push("it holds no list of invocations");
  if (ledger?.cap_usd !== STOPS_AT_USD) wrong.push(`its cap is ${JSON.stringify(ledger?.cap_usd)}, and the protocol's is ${STOPS_AT_USD}`);
  for (const [block, tasks] of Object.entries(WATCHDOG)) for (const [task, limit] of Object.entries(tasks)) if (ledger?.watchdog?.[block]?.[task]?.usd !== limit.usd || ledger?.watchdog?.[block]?.[task]?.minutes !== limit.minutes) wrong.push(`its limits for a run of \`${task}\` in the \`${block}\` block are ${JSON.stringify(ledger?.watchdog?.[block]?.[task] ?? null)}, and the protocol's are $${limit.usd.toFixed(2)} and ${limit.minutes} minutes`);
  // The two numbers the paid path itself reads from a ledger: the most one session may be given, and the least that must be left.
  const ceilings = Object.values(WATCHDOG).flatMap((tasks) => Object.values(tasks).map((limit) => limit.usd));
  const [least, most] = [Math.min(...ceilings), Math.max(...ceilings)];
  if (ledger?.per_invocation_ceiling_usd !== most) wrong.push(`the most it gives one session is ${JSON.stringify(ledger?.per_invocation_ceiling_usd ?? null)}, and the protocol's largest ceiling is ${most}`);
  if (ledger?.refuse_below_usd !== least) wrong.push(`it refuses below ${JSON.stringify(ledger?.refuse_below_usd ?? null)}, and the protocol's smallest ceiling is ${least}`);
  for (const entry of Array.isArray(ledger?.invocations) ? ledger.invocations : []) if (!(Number.isFinite(counted(entry)) && counted(entry) >= 0)) wrong.push(`its line ${JSON.stringify(entry?.n ?? null)} counts as no amount (a cost of ${JSON.stringify(entry?.cost_usd ?? null)} under a ceiling of ${JSON.stringify(entry?.max_budget_usd ?? null)})`);
  if (wrong.length > 0) throw new NotStarted(`the second look's ledger (${relativeToRoot(path)}) is not what the protocol says: ${wrong.join("; ")}. The limits are the protocol's (${PAGE}, "Limits"); after the first run nothing there changes without a dated note`);
  return ledger;
}

const micro = (usd) => Math.round(usd * 1e6) / 1e6;

/** Whether the ledger has room for one more run at its ceiling: a settled run counts at its reported cost, one not yet settled at its ceiling. */
export function room(ledger, usd) {
  const spent = micro(ledger.invocations.reduce((sum, entry) => sum + counted(entry), 0));
  const left = micro(ledger.cap_usd - spent);
  if (left >= usd) return { ok: true, spent, left };
  return { ok: false, spent, left, why: `the second look has counted $${spent.toFixed(2)} on its ledger, and this run may cost up to $${usd.toFixed(2)}: together past the $${ledger.cap_usd.toFixed(2)} at which the whole look stops (${PAGE}, "Limits"; a cost that is not yet settled counts at its ceiling). Past that is the owner's word` };
}

/** Settle by hand a line the runner left marked as running: it was stopped before it could. Starts nothing. */
export function settleLine({ n, cost, note, ledgerPath = LEDGER }) {
  if (cost !== null && !(Number.isFinite(cost) && cost >= 0)) throw new NotStarted("--cost is what the harness reported, in dollars, or the word ceiling when that is not known");
  if (typeof note !== "string" || note.trim().length < 8) throw new NotStarted('--note says what happened and where the cost was read: "<a sentence>"');
  const ledger = readLedger(ledgerPath);
  const line = ledger.invocations.find((entry) => entry.n === n);
  if (!line || line.status !== "running") throw new NotStarted(`${JSON.stringify(n)} is not a line of the second look's ledger still marked running`);
  settleEntry(line, { status: "failed", cost_usd: cost, reported_cost_usd: cost, note: [line.note, `settled by hand: ${note.trim()}`].filter(Boolean).join("; ") });
  saveLedger(ledger, ledgerPath);
  return line;
}

/** A refusal of the paid path that names the comparisons ledger's own commands, said for this ledger. */
const forThisLedger = (message) =>
  /compare-ledger\.mjs|still marked running/.test(message)
    ? `${message}\n  This look has a ledger of its own (experiments/watching/second-look/ledger.json), and compare-ledger.mjs opens the comparisons ledger and not it. A line left running is settled with: node ${SCRIPT} --settle <n> --cost <usd|ceiling> --note "<what happened>". Any other answer is written into that file by hand, with who decided it and when.`
    : message;

// ── the prompts ──────────────────────────────────────────────────────────

/** What the wider task opens with: the first check's paragraph for four packages, with the number changed and nothing else. */
export const SIX_OPENS = FOUR_OPENS.replaceAll("four", "six");

/** A task's text, before the sentence every arm ends with. `four` is the first check's wide task, to the letter. */
export function taskText(task) {
  if (task === "four") return firstChecksTaskText("four");
  if (task !== "six") throw new NotStarted(`${JSON.stringify(task)} is not a task of the second look`);
  return `${[SIX_OPENS, ...TASKS.six.packages.flatMap((pkg) => [folderLine(pkg.folder), taskAlone(pkg.project).prompt.trimEnd()])].join("\n\n")}\n`;
}

/** The prompt of one run: the task, then the sentence. The same in every arm, to the letter. */
export const promptFor = ({ task }) => `${taskText(task).replace(/\n*$/, "\n")}\n${SENTENCE}\n`;

// ── the recorder outside the project ─────────────────────────────────────

const toolEnv = () => ({ PATH: process.env.PATH ?? "", HOME: process.env.HOME ?? "" });
const inside = (path, base) => resolve(path) === resolve(base) || resolve(path).startsWith(`${resolve(base)}/`);

/** The owner's own places a recorder at the user's level would be kept in. Nothing here is ever installed into one. */
export const theOwnersOwn = (userHome = homedir()) => [join(userHome, ".claude"), join(userHome, ".codex"), join(userHome, ".grooph")];

/**
 * The three places an install outside the project is told of, each one named and none left to a default: left to
 * themselves they are the owner's own. A place that is one of his, or inside one, is a refusal.
 */
export function placesFor({ groophHome, configDir, userHome = homedir() }) {
  const places = { GROOPH_HOME: resolve(groophHome), CLAUDE_CONFIG_DIR: resolve(configDir), CODEX_HOME: join(dirname(resolve(groophHome)), ".codex-is-not-used") };
  for (const [name, path] of Object.entries(places)) for (const own of theOwnersOwn(userHome)) if (inside(path, own)) throw new NotStarted(`${name} would be ${path}, which is the owner's own ${own}: the recorder is installed at the user's level of the clean profile and of nothing else`);
  return places;
}

/** `grooph hooks install --user`, then `grooph hooks watch <folder>`, by a checkout's own tool, with every place named. Returns what the tool printed. */
export function installOutside({ cli = CLI, node = process.execPath, groophHome, configDir, folder, cwd }) {
  const env = { ...toolEnv(), ...placesFor({ groophHome, configDir }) };
  const said = [];
  for (const args of [["hooks", "install", "--user", "--harness", "claude-code"], ["hooks", "watch", folder]]) {
    const out = spawnSync(node, [cli, ...args], { cwd, encoding: "utf8", env, timeout: 30_000 });
    said.push(`$ grooph ${args.join(" ")}\n${out.stdout ?? ""}${out.stderr ?? ""}`);
    if (out.status !== 0) throw new Error(`grooph ${args.slice(0, 3).join(" ")} exited ${out.status ?? out.signal ?? out.error?.message}: ${String(out.stderr ?? "").trim().split("\n")[0].slice(0, 300)}`);
  }
  return said.join("\n");
}

/** Every command a settings file's hooks run, with the event each is run at. */
function hookCommands(settings) {
  const found = [];
  for (const [event, list] of Object.entries(settings?.hooks ?? {})) for (const entry of Array.isArray(list) ? list : []) for (const hook of Array.isArray(entry?.hooks) ? entry.hooks : []) if (typeof hook?.command === "string") found.push({ event, command: hook.command });
  return found;
}

/**
 * What an install outside the project left, held against what the protocol says it leaves: the hook this checkout
 * ships, in grooph's own folder; entries in the user-level settings that run that file with `--user`; and every other
 * setting as it was. Throws with what does not hold.
 */
export function whatTheInstallLeft({ groophHome, configDir, settingsBefore, shipped = SHIPPED_HOOK }) {
  const hook = join(groophHome, "hooks", "grooph-event.mjs");
  if (!existsSync(hook) || !lstatSync(hook).isFile()) throw new Error(`no hook was left at ${hook}`);
  if (readFileSync(hook, "utf8") !== readFileSync(shipped, "utf8")) throw new Error(`${hook} is not the hook this checkout ships`);
  const settings = JSON.parse(readFileSync(join(configDir, "settings.json"), "utf8"));
  const commands = hookCommands(settings);
  const ours = commands.filter((entry) => USER_ENTRY.test(entry.command) && entry.command.includes(hook));
  if (ours.length === 0) throw new Error(`the user-level settings hold no entry that runs ${hook} with --user`);
  if (ours.length !== commands.length) throw new Error(`the user-level settings hold ${commands.length - ours.length} hook(s) that are not the recorder's`);
  const { hooks: _hooks, ...rest } = settings;
  const { hooks: _before, ...before } = settingsBefore;
  if (JSON.stringify(rest) !== JSON.stringify(before)) throw new Error("the install changed a setting that is not a hook");
  return { hook_file: hook, hook_sha256: createHash("sha256").update(readFileSync(hook)).digest("hex"), entries: ours.length, at_events: [...new Set(ours.map((entry) => entry.event))].sort(), commands: [...new Set(ours.map((entry) => entry.command))], every_other_setting_as_it_was: true };
}

/** Every file under a folder, by its path from that folder. */
function filesUnder(dir, base = dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).sort().flatMap((name) => {
    const full = join(dir, name);
    return lstatSync(full).isDirectory() ? filesUnder(full, base) : [full.slice(base.length + 1)];
  });
}

/** The hook's file for one session under grooph's own folder, wherever under `events/` the install keeps it. */
export function eventsOf(groophHome, sessionId) {
  const events = join(groophHome, "events");
  const found = filesUnder(events).filter((path) => path.split("/").at(-1) === `${sessionId}.jsonl`);
  return found.length === 1 ? join(events, found[0]) : null;
}

/**
 * A rehearsal of the install, in a scratch folder, with no session: the two commands, what they left, and the hook
 * fired by hand as the settings entry would run it, once for a session in the listed folder and once for a session
 * somewhere else. It holds when the first leaves one line under grooph's own folder, the second leaves none, and the
 * project holds nothing. This is what says a checkout can make the `outside` arm at all.
 */
export function rehearse({ cli = CLI, node = process.execPath, home = DEFAULT_HOME } = {}) {
  const scratch = realpathSync(mkdtempSync(join(tmpdir(), "second-look-rehearsal-")));
  try {
    const [groophHome, configDir, project, elsewhere] = [join(scratch, "home", ".grooph"), join(scratch, "profile"), join(scratch, "work", "project"), join(scratch, "work", "elsewhere")];
    for (const dir of [configDir, project, elsewhere]) mkdirSync(dir, { recursive: true });
    const before = settingsFor({ home });
    const repositorys = `${JSON.stringify(before, null, 2)}\n`;
    writeFileSync(join(configDir, "settings.json"), repositorys, "utf8");
    const heldBefore = readFileSync(join(configDir, "settings.json"), "utf8") === repositorys && hookCommands(JSON.parse(repositorys)).length === 0;
    if (!existsSync(join(dirname(cli), "..", "dist")) && cli === CLI) return { ok: false, why: "this checkout's grooph is not built: run pnpm -r build first" };
    let said;
    try {
      said = installOutside({ cli, node, groophHome, configDir, folder: project, cwd: scratch });
    } catch (error) {
      return { ok: false, why: `this checkout's grooph did not install the recorder outside a project (${error.message}). That install is slice 0108's: until it is on main and built here, a block is started with --without-outside` };
    }
    let left;
    try {
      left = whatTheInstallLeft({ groophHome, configDir, settingsBefore: before, shipped: shippedHookOf(cli) });
    } catch (error) {
      return { ok: false, why: `the install outside the project did not leave what the protocol says it leaves: ${error.message}` };
    }
    // The hook, run as the entry runs it, with what the harness would send for a session's start.
    const fire = (folder, session) => spawnSync("/bin/sh", ["-c", left.commands[0]], { input: JSON.stringify({ hook_event_name: "SessionStart", session_id: session, cwd: folder }), encoding: "utf8", env: { ...toolEnv(), CLAUDE_PROJECT_DIR: folder }, timeout: 15_000 });
    const here = fire(project, "rehearsal-in-the-listed-folder");
    const there = fire(elsewhere, "rehearsal-somewhere-else");
    const wrong = [];
    for (const [what, out] of [["in the listed folder", here], ["somewhere else", there]]) if (out.status !== 0 || `${out.stdout}${out.stderr}` !== "") wrong.push(`fired for a session ${what}, the hook exited ${out.status ?? out.signal} and printed ${JSON.stringify(`${out.stdout}${out.stderr}`.slice(0, 120))}`);
    if (eventsOf(groophHome, "rehearsal-in-the-listed-folder") === null) wrong.push("a session in the listed folder left no line under grooph's own folder");
    if (eventsOf(groophHome, "rehearsal-somewhere-else") !== null) wrong.push("a session in a folder that is not listed left a line");
    if (filesUnder(project).length > 0) wrong.push(`the project holds ${filesUnder(project).join(", ")}`);
    if (wrong.length > 0) return { ok: false, why: `the install outside the project did not behave as the protocol says: ${wrong.join("; ")}` };
    // A scratch copy of the profile's settings, three times: the repository's before; the repository's and exactly
    // what the install wrote, after it (whatTheInstallLeft throws above unless they are that); and the repository's
    // again once they are written back, as the profile's own runner writes them after every session. This shows what
    // the install does to a copy. The profile itself is looked at three times in the record of every run of the arm.
    writeFileSync(join(configDir, "settings.json"), repositorys, "utf8");
    const settings = [
      { when: "before the install", holds: heldBefore, they_are: "the repository's, with no hook" },
      { when: "after the install", holds: left.every_other_setting_as_it_was === true && left.entries > 0, they_are: `the repository's, and ${left.entries} entries that run the recorder; every other setting as it was` },
      { when: "written back", holds: readFileSync(join(configDir, "settings.json"), "utf8") === repositorys, they_are: "the repository's again" },
    ];
    if (settings.some((view) => !view.holds)) return { ok: false, why: `in the rehearsal the scratch copy of the profile's settings ${settings.find((view) => !view.holds).when} was not ${settings.find((view) => !view.holds).they_are}` };
    return { ok: true, left: { entries: left.entries, at_events: left.at_events, hook_sha256: left.hook_sha256, a_scratch_copy_of_the_profiles_settings: settings }, said };
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
}

const sh = (text) => `'${String(text).replaceAll("'", `'\\''`)}'`;

/** The file the launcher leaves the moment before it becomes the harness: with no such file, no session was started. */
export const STARTED = "the-launcher-started-the-harness";

/**
 * The program the profile's runner starts in the harness's place for a run of the `outside` arm, and for the session
 * only: the profile's check asks the harness itself for its version, its help text and whether it is signed in. That
 * runner writes the profile's settings itself just before it starts the harness, so an install made any earlier would
 * be written over. The launcher installs the recorder at the user's level of the profile, lists the session's folder,
 * keeps a copy of the settings the session will find, and becomes the harness: the same process, in the same process
 * group, with the arguments and the environment it was given, to the letter. If the install or the listing fails it
 * starts nothing. Asked anything but to start a session, it does nothing and says so.
 *
 * It and what it leaves (what the two commands printed, the copy of the settings, the file that says a session was
 * started) are kept in `dir`, the folder that holds grooph's own folder for the run: never beside the session's
 * folder, where the folder above the session's would hold them in this arm and in no other.
 */
export function launcherText({ harness, node, cli, groophHome, configDir, folder, dir }) {
  const places = Object.entries(placesFor({ groophHome, configDir })).map(([name, path]) => `${name}=${sh(path)}`).join(" ");
  const grooph = `${places} ${sh(node)} ${sh(cli)}`;
  return `#!/bin/sh
# Written by ${SCRIPT} for one run of the \`outside\` arm (${PAGE}).
session=
for arg in "$@"; do
  if [ "$arg" = "--session-id" ]; then session=1; fi
done
if [ -z "$session" ]; then
  echo "this is the launcher of one run of the second look's outside arm: it starts that session and answers nothing else" >&2
  exit 64
fi
(
  cd ${sh(dir)} &&
  ${grooph} hooks install --user --harness claude-code &&
  ${grooph} hooks watch ${sh(folder)}
) >${sh(join(dir, "outside-install.txt"))} 2>&1 || exit 70
cp ${sh(join(configDir, "settings.json"))} ${sh(join(dir, "settings-with-the-recorder.json"))} || exit 70
: >${sh(join(dir, STARTED))} || exit 70
exec ${sh(harness)} "$@"
`;
}

/** How many entries of a recorder outside the project the owner's own settings hold, and whether his own grooph folder holds a hook: read, never written. */
export function theOwnersOwnAsFound(userHome = homedir()) {
  let entries = null;
  try {
    entries = hookCommands(JSON.parse(readFileSync(join(userHome, ".claude", "settings.json"), "utf8"))).filter((entry) => USER_ENTRY.test(entry.command)).length;
  } catch {}
  return { entries_of_a_recorder_in_his_own_settings: entries, a_hook_in_his_own_grooph_folder: existsSync(join(userHome, ".grooph", "hooks", "grooph-event.mjs")) };
}

// ── the three arms ───────────────────────────────────────────────────────

/**
 * Build one run's folder and prompt. Starts nothing, and installs nothing outside the session's folder.
 *
 *   plain     the task's packages, byte for byte, and nothing of grooph
 *   watched   as plain, and `grooph hooks install` run in the folder before its one commit, with no other flag
 *   outside   as plain, to the byte; and a launcher beside the session's folder that installs the recorder at the
 *             user's level of the profile when the session is started
 */
export function build({ run, home = DEFAULT_HOME, node = process.execPath, cli = CLI, harness = null }) {
  const task = TASKS[run.task];
  // Everything that is read or checked comes before the session's folder is made: what fails after it would leave the folder behind.
  const prompt = promptFor(run);
  if (run.arm === "watched" && !existsSync(join(root, "packages", "cli", "dist"))) throw new NotStarted("this checkout's grooph is not built, and the watched arm installs its hook: run pnpm -r build first");
  const groophHome = groophHomeIn(home);
  if (run.arm === "outside") {
    placesFor({ groophHome, configDir: layout(home).profile });
    if (existsSync(dirname(groophHome))) throw new NotStarted(`${dirname(groophHome)} is still there: it is grooph's own folder from an earlier run of the outside arm, and the next run starts with none. Move it aside before another is made`);
  }
  let installed = [];
  const project = makeProject({
    home,
    name: task.repository,
    fill: (cwd) => {
      for (const pkg of task.packages) cpSync(join(comparisons, pkg.project, "task"), join(cwd, pkg.folder), { recursive: true });
      if (run.arm === "watched") installed = installHook(cwd);
    },
  });
  const closed = run.arm === "watched" ? CLOSED_IN_A_WATCHED_ARM.map((path) => join(project.cwd, path)) : [];
  let outside = null;
  if (run.arm === "outside") {
    const dir = dirname(groophHome);
    try {
      mkdirSync(dir, { recursive: true });
      const path = join(dir, "launch-outside.sh");
      const text = launcherText({ harness: harness ?? "<the harness>", node, cli, groophHome, configDir: layout(home).profile, folder: project.cwd, dir });
      writeFileSync(path, text, { mode: 0o755 });
      outside = { launcher: path, text, grooph_home: groophHome, dir };
    } catch (error) {
      rmSync(project.work, { recursive: true, force: true });
      rmSync(dir, { recursive: true, force: true });
      throw new NotStarted(`the launcher of the outside arm could not be written: ${error.message}`);
    }
  }
  return { ...project, prompt, closed, installed, outside };
}

/** Take away what `build` made, when nothing was started from it: the session's folder, and in the outside arm the launcher's. */
export function unbuild(built) {
  rmSync(built.work, { recursive: true, force: true });
  if (built.outside) rmSync(built.outside.dir, { recursive: true, force: true });
}

/** This checkout as a run found it: the commit it was at, the version of the tool in it, and the hook it ships. */
export function checkout() {
  const asked = (...args) => String(spawnSync("git", ["-C", root, ...args], { encoding: "utf8", env: { ...toolEnv(), GIT_CONFIG_GLOBAL: "/dev/null", GIT_CONFIG_NOSYSTEM: "1" } }).stdout ?? "").trim();
  let version = null;
  let hook = null;
  try {
    version = JSON.parse(readFileSync(join(root, "packages", "cli", "package.json"), "utf8")).version ?? null;
    hook = createHash("sha256").update(readFileSync(SHIPPED_HOOK)).digest("hex");
  } catch {}
  return { commit: asked("rev-parse", "HEAD") || null, files_changed_since_it: asked("status", "--porcelain").split("\n").filter(Boolean).length, grooph_version: version, hook_sha256: hook };
}

/**
 * Both blocks are run from one built checkout at one commit (the protocol, "Three rounds, in two blocks"): the
 * watched arm's hook is the checkout's own file. This is the first run already recorded that was made from another
 * commit, or with another hook, than `now`; or null. A record that does not say which checkout made it is passed over.
 */
export function madeFromAnother(now, recordRoot = HOME) {
  for (const run of order()) {
    for (const dir of [recordOf(run, recordRoot), `${recordOf(run, recordRoot)}-rerun`]) {
      let was;
      try {
        was = JSON.parse(readFileSync(join(dir, "result.json"), "utf8")).given?.the_runners_checkout;
      } catch {
        continue;
      }
      if (!was || typeof was.commit !== "string" || typeof was.hook_sha256 !== "string") continue;
      const what = [was.commit !== now.commit ? "another commit" : null, was.hook_sha256 !== now.hook_sha256 ? "another hook" : null].filter(Boolean);
      if (what.length > 0) return { run: run.name, what, its_commit: was.commit, its_hook_sha256: was.hook_sha256 };
    }
  }
  return null;
}

// ── the score ────────────────────────────────────────────────────────────

/** A folder of the session's own that is a real folder all the way down, never a link: only such a folder is read. */
function realFolder(base, ...parts) {
  let at = base;
  for (const part of [null, ...parts]) {
    if (part !== null) at = join(at, part);
    let stat;
    try {
      stat = lstatSync(at);
    } catch {
      return null;
    }
    if (!stat.isDirectory()) return null;
  }
  return at;
}

/**
 * How many of the unseen tests pass, for each package: the project's own suite, run from this repository's copy
 * against the package the session left. THIS RUNS CODE A SESSION WROTE, outside the sandbox: it is called only on the
 * owner's recorded decision. Only the unseen suite is run; a package's own test command is not.
 */
export function score({ run, cwd, call }) {
  const ending = call.ended_by === "the session" ? { kind: "clean", reason: "the session ended itself" } : { kind: "cut-off", reason: `ended by ${call.ended_by}${call.which ? ` (${call.which})` : ""}` };
  const packages = TASKS[run.task].packages.map((pkg) => {
    const tree = realFolder(cwd, pkg.folder);
    const from = `experiments/comparisons/${pkg.project}/held-out`;
    if (!tree) return { package: pkg.name, folder: pkg.folder, scored_from: from, ran: false, reason: "the package's folder is not there, or is not a folder", cases: pkg.cases, passed: 0, failed: pkg.cases, rate: 0 };
    return { package: pkg.name, folder: pkg.folder, scored_from: from, ...withExpected(scoreHeldOut(tree, join(comparisons, pkg.project, "held-out")), pkg.cases) };
  });
  return { scored_at: new Date().toISOString(), scorer: "scripts/lib/compare-score.mjs (scoreHeldOut): the project's unseen suite alone, from the repository's copy", ending, packages, passed: packages.reduce((sum, pkg) => sum + (pkg.passed ?? 0), 0), cases: packages.reduce((sum, pkg) => sum + pkg.cases, 0) };
}

const scoreLine = (scored) => scored.packages.map((pkg) => `${pkg.package} ${pkg.ran ? `${pkg.passed}/${pkg.cases}` : `not run (${pkg.reason})`}`).join(" · ");

// ── one run ──────────────────────────────────────────────────────────────

const short = (sha) => String(sha ?? "unknown").slice(0, 8);

/**
 * One run, start to record. Before the call, a refusal throws `NotStarted` and nothing was spent. After it, nothing
 * is thrown and nothing is removed. `rehearsal` is the rehearsal's own function, and is another only in a test.
 */
export async function runOne({ go, block = null, rerun = null, withoutOutside = false, throughRound = null, anotherCheckout = false, home = DEFAULT_HOME, claude, ledgerPath = LEDGER, recordRoot = HOME, profileCheck, gameOpen, firstCallGate = firstCallAllows(), grace, node = process.execPath, cli = CLI, rehearsal = rehearse, findProgram = findHarness }) {
  if (rerun === null && !BLOCKS.includes(block)) throw new NotStarted(`${block === null ? "no block was named" : `${JSON.stringify(block)} is not a block of the second look`}: ${SAY_WHICH_BLOCK}`);
  if (rerun !== null && block !== null) throw new NotStarted(`--rerun names its run whole, its block in its name (${BLOCKS[0]}/four/plain-1): --block does not go with it`);
  if (!firstCallGate.ok) throw new NotStarted(firstCallGate.why);
  const ledger = readLedger(ledgerPath);
  // Before any folder is made: a run is scored by running what the session wrote, outside the sandbox. Without the
  // owner's recorded decision on that, for this look by name, the whole run is refused, not only its scoring.
  const scoring = scoringDecided(ledger, SCORING);
  if (!scoring.ok) throw new NotStarted(scoring.why);
  let run = rerun === null ? nextRun(recordRoot, block, { withoutOutside, throughRound }) : null;
  let recordDir = run ? recordOf(run, recordRoot) : null;
  let because = null;
  if (rerun !== null) {
    run = order().find((candidate) => candidate.name === rerun);
    if (!run) throw new NotStarted(`${JSON.stringify(rerun)} is not a run of the second look: --rerun names one, such as ${BLOCKS[0]}/four/plain-1`);
    const first = recordOf(run, recordRoot);
    const kept = existsSync(join(first, "result.json")) ? JSON.parse(readFileSync(join(first, "result.json"), "utf8")) : null;
    const line = ledger.invocations.find((entry) => entry.run === `second-look/${run.name}`) ?? null;
    const neverRecorded = kept === null && line !== null && line.status !== "running";
    if (kept?.ended_by !== "the harness" && !neverRecorded) throw new NotStarted(`${rerun} has no record the harness ended${line?.status === "running" ? `, and its line on the ledger (${line.n}) is still marked running: settle that first` : ""}: a run is made once more only when it failed for a reason outside the session (the sign-in, the network, a usage limit)`);
    recordDir = `${first}-rerun`;
    if (existsSync(join(recordDir, "result.json"))) throw new NotStarted(`${rerun} was already run once more`);
    because = kept ? (kept.why ?? "the harness ended it, and its record says no more") : `the runner was stopped before it recorded the run; its line on the ledger (${line.n}) says: ${line.note || "nothing"}`;
  }
  if (!run) throw new NotStarted(`every run of the \`${block}\` block${throughRound !== null ? ` through round ${throughRound}` : ""}${withoutOutside ? ", the outside arm left out," : ""} is recorded`);
  const held = heldUpBy(run.block, recordRoot);
  if (held) throw new NotStarted(held.why);
  // A line on the ledger and no record: the runner was stopped between the two. Nothing is started over it in passing.
  const already = rerun === null ? ledger.invocations.find((entry) => entry.run === `second-look/${run.name}`) : null;
  if (already) throw new NotStarted(`${run.name} has a line on the ledger (${already.n}) and no record: the runner was stopped before it could write one. ${already.status === "running" ? `Settle that line first (--settle ${already.n} --cost <usd|ceiling> --note "<what happened>"), then` : "Then"} it may be run once more, as a failure outside the session: --rerun ${run.name}`);
  const watchdog = WATCHDOG[run.block][run.task];
  const has = room(ledger, watchdog.usd);
  if (!has.ok) throw new NotStarted(has.why);
  // One checkout for both blocks: the watched arm's hook is the checkout's own file. A run from another commit, or
  // with another hook, than a run already recorded is refused unless it was asked for by name; the record then says so.
  const now = checkout();
  const other = madeFromAnother(now, recordRoot);
  if (other && !anotherCheckout) throw new NotStarted(`this checkout is at commit ${short(now.commit)} with the hook ${short(now.hook_sha256)}, and ${other.run} was made from ${other.what.join(" and with ")} (commit ${short(other.its_commit)}, hook ${short(other.its_hook_sha256)}): both blocks are run from one built checkout at one commit (${PAGE}, "Three rounds, in two blocks"). To run from another on purpose, say so by name with --another-checkout: the record and the results page then say it`);
  // The outside arm: the install is rehearsed in a scratch folder before anything is made or spent, and the harness
  // is found now, because the launcher has to name it.
  let rehearsed = null;
  let real = null;
  let ownBefore = null;
  if (run.arm === "outside") {
    rehearsed = rehearsal({ cli, node, home });
    if (!rehearsed.ok) throw new NotStarted(`${run.name} is a run of the outside arm, and ${rehearsed.why}`);
    real = claude ? { path: claude, version: null } : findProgram();
    ownBefore = theOwnersOwnAsFound();
  }
  const built = build({ run, home, node, cli, harness: real?.path ?? null });
  // In the outside arm the launcher is the program started for the session and for nothing else: the profile's check
  // asks the harness itself, whatever program it is handed.
  const started = built.outside ? { findProgram: () => ({ path: built.outside.launcher, version: real.version }), profileCheck: (asked) => (profileCheck ?? checkProfile)({ ...asked, claude: real.path }) } : { claude, findProgram, profileCheck };
  let call;
  try {
    call = await runSession({ home, cwd: built.cwd, prompt: built.prompt, ...LEAD[run.block], usd: watchdog.usd, minutes: watchdog.minutes, closed: built.closed, unpinned: LEFT_TO_THE_HARNESS, label: { project: `second-look/${run.block}/${run.task}`, arm: run.arm, replicate: rerun ? `${run.replicate}-rerun` : run.replicate }, note: `the second look at watching: ${run.block}, ${run.task}, ${run.arm}, round ${run.round}${rerun ? `; the one rerun of a run the harness ended (${because})` : ""}`, go, ...started, ledgerPath, harnessDir: built.harnessDir, gameOpen, plan: { projects: ["second-look"], stop_usd: ledger.cap_usd + 1e-6 }, grace });
  } catch (error) {
    if (error instanceof NotStarted) {
      unbuild(built);
      throw new NotStarted(forThisLedger(error.message));
    }
    throw error;
  }
  // From here on nothing is thrown: each part of the record is kept on its own, and what could not be kept is named in it.
  let problems = [];
  const attempt = (what, work, otherwise) => {
    try {
      return work();
    } catch (error) {
      problems.push(`${what}: ${error.message}`);
      return otherwise;
    }
  };
  const theCheckout = { ...now, another_than_a_run_before: other ? { ...other, said_by: "--another-checkout" } : null };
  const profile = layout(home).profile;
  /** The session's folder, and grooph's own folder for the run, moved out of the next run's way. Null when they could not be. */
  const aside = () => {
    try {
      const kept = setAside({ home, work: built.work, sessionId: call.session_id });
      if (built.outside && existsSync(built.outside.dir)) renameSync(built.outside.dir, join(kept, "home"));
      return kept;
    } catch (error) {
      problems.push(`the session's folder${built.outside ? ", or grooph's own folder for the run," : ""} could not be moved aside (${error.message}): look in ${built.work}${built.outside ? ` and ${built.outside.dir}` : ""} before another run is made`);
      return null;
    }
  };

  // The outside arm, when the launcher never became the harness: the install or the listing failed, and no session
  // was started. That is no result. What happened is kept beside the run's own folder, its ledger line is settled at
  // nothing under another name, and the run itself still has no record: it can be started again once a person has looked.
  if (built.outside && !existsSync(join(built.outside.dir, STARTED))) {
    let at = `${recordDir}-not-started`;
    for (let n = 2; existsSync(at); n += 1) at = `${recordDir}-not-started-${n}`;
    const said = attempt("what the launcher printed", () => readFileSync(join(built.outside.dir, "outside-install.txt"), "utf8").trim().split("\n").at(-1) ?? "", "");
    const why = `the launcher could not install the recorder outside the project, or could not list the session's folder${said ? ` (${said.slice(0, 300)})` : ""}, so it started nothing: no session ran and nothing was spent`;
    problems.push(why);
    attempt("what the launcher left", () => (mkdirSync(at, { recursive: true }), existsSync(join(built.outside.dir, "outside-install.txt")) && cpSync(join(built.outside.dir, "outside-install.txt"), join(at, "outside-install.txt"))));
    const copied = copyRecord({ home, cwd: built.cwd, base: built.base, gitDir: built.gitDir, call, recordDir: at, prompt: built.prompt, annotate: namesOnly, excludes: [] });
    problems.push(...copied.problems.filter((problem) => !problems.includes(problem)));
    attempt("settling the ledger line of a session that was never started", () => {
      const onFile = loadLedger(ledgerPath);
      const line = onFile.invocations.find((entry) => entry.session_id === call.session_id);
      if (!line) throw new Error("its line is not on the ledger");
      amendEntry(onFile, line, { run: `${line.run}-not-started`, status: "failed", cost_usd: 0, reported_cost_usd: null, note: [line.note, why].filter(Boolean).join("; ") }, ledgerPath);
    });
    const kept = aside();
    const result = writeResult(at, call, { run: run.name, block: run.block, task: run.task, arm: run.arm, round: run.round, replicate: run.replicate, ended_by: "nobody: no session was started", not_started: why, counted_usd: 0, given: { the_runners_checkout: theCheckout, the_rehearsal_before_it: rehearsed.left }, measures: null, scored: false, problems, protocol: PAGE });
    return { run, recordDir: at, result, score: null, kept, notStarted: true, tripwire: "", next: nextRun(recordRoot, run.block, { withoutOutside, throughRound }) };
  }

  if (call.watchdog?.usd !== watchdog.usd) problems.push(`the session was given a ceiling of $${call.watchdog?.usd}, and the protocol's for a run of \`${run.task}\` in the \`${run.block}\` block is $${watchdog.usd.toFixed(2)}`);
  const leftToIt = shortNamesIn(call.environment).left_to_the_harness;
  if (JSON.stringify(leftToIt) !== JSON.stringify(LEFT_TO_THE_HARNESS)) problems.push(`the session was started with ${leftToIt.length === 0 ? "every short name of a model pinned" : `${leftToIt.join(", ")} left to the harness`}, and this look leaves ${LEFT_TO_THE_HARNESS.join(", ")} to it and no other`);
  // The hook's own file, kept before the record is scrubbed: plain files, never through a link. In the watched arm it
  // is in the session's folder; in the outside arm it is under grooph's own folder, wherever the install keeps it.
  const theirs = run.arm === "outside" ? attempt("finding the hook's file under grooph's own folder", () => eventsOf(built.outside.grooph_home, call.session_id), null) : null;
  const events = run.arm === "watched" ? realFolder(built.cwd, ".grooph", "events") : theirs ? dirname(theirs) : null;
  if (events) {
    const left = attempt("the hook's own files", () => (mkdirSync(recordDir, { recursive: true }), copyPlain(events, join(recordDir, "events"))), []);
    if (left.length > 0) problems.push(`left out of the copy of the hook's files: ${left.join(", ")}`);
  }
  // A watched session whose hook left no file was not watched: the recorder did not load, or wrote where this runner
  // does not look. That is said in the record, and it stops the runs after it until a person has looked.
  const notWatched = run.arm !== "plain" && call.ended_by !== "the harness" && !(events && existsSync(join(events, `${call.session_id}.jsonl`)));
  if (notWatched) problems.push(`the hook left no file for this session ${run.arm === "watched" ? "in the project's .grooph/events" : "under grooph's own folder for the run"}: the recorder did not load, or wrote somewhere this runner does not look, and this is no run of the ${run.arm} arm`);
  // The outside arm: what the launcher did before the session, the settings the session found, and the profile's
  // settings three times (the repository's before, the repository's and exactly the recorder's entries during, the
  // repository's again after).
  let outside = null;
  if (built.outside) {
    outside = attempt(
      "what the launcher left",
      () => {
        mkdirSync(recordDir, { recursive: true });
        for (const name of ["outside-install.txt", "settings-with-the-recorder.json"]) if (existsSync(join(built.outside.dir, name))) cpSync(join(built.outside.dir, name), join(recordDir, name));
        const repositorys = `${JSON.stringify(settingsFor({ home }), null, 2)}\n`;
        const before = readFileSync(join(built.harnessDir, "settings.json"), "utf8");
        const found = JSON.parse(readFileSync(join(built.outside.dir, "settings-with-the-recorder.json"), "utf8"));
        // What the launcher took before it became the harness: the runner's clock counts it in this arm's minutes.
        const took = (statSync(join(built.outside.dir, STARTED)).mtimeMs - statSync(join(built.outside.dir, "outside-install.txt")).birthtimeMs) / 1000;
        const commands = hookCommands(found);
        const entries = commands.filter((entry) => USER_ENTRY.test(entry.command) && entry.command.includes(built.outside.grooph_home));
        const { hooks: _hooks, ...rest } = found;
        const inTheFolder = [".grooph", ".claude"].filter((name) => existsSync(join(built.cwd, name)));
        const ownAfter = theOwnersOwnAsFound();
        return {
          installed_by: "grooph hooks install --user --harness claude-code, then grooph hooks watch <the session's folder>, run by the launcher when the session was started",
          entries_in_the_settings_the_session_found: entries.length,
          at_events: [...new Set(entries.map((entry) => entry.event))].sort(),
          seconds_the_launcher_took_before_the_harness: Number.isFinite(took) && took >= 0 ? Math.round(took * 100) / 100 : null,
          the_profiles_settings: [
            { when: "before the install", holds: before === repositorys, they_are: "the repository's" },
            { when: "during the session", holds: entries.length > 0 && entries.length === commands.length && JSON.stringify(rest) === JSON.stringify(JSON.parse(before)), they_are: `the repository's, and ${entries.length} entries that run the recorder; every other setting as it was` },
            { when: "after it", holds: readFileSync(join(profile, "settings.json"), "utf8") === repositorys, they_are: "the repository's again" },
          ],
          the_rehearsal_before_it: rehearsed.left,
          of_grooph_in_the_sessions_folder_afterwards: inTheFolder,
          the_hook_wrote_under_groophs_own_folder: theirs !== null,
          the_owners_own: { before: ownBefore, after: ownAfter, as_they_were: JSON.stringify(ownBefore) === JSON.stringify(ownAfter) },
        };
      },
      null,
    );
    if (outside && outside.entries_in_the_settings_the_session_found === 0) problems.push("the session was started with no entry of the recorder in its user-level settings: this is no run of the outside arm");
    for (const view of outside?.the_profiles_settings ?? []) if (!view.holds) problems.push(`the profile's settings ${view.when} were not ${view.they_are}`);
    if (outside && outside.of_grooph_in_the_sessions_folder_afterwards.length > 0) problems.push(`the session's folder holds ${outside.of_grooph_in_the_sessions_folder_afterwards.join(", ")}, and in the outside arm the project holds nothing of grooph`);
    if (outside && !outside.the_owners_own.as_they_were) problems.push("the owner's own settings or grooph folder are not as they were before the run: a person looks before anything else is started");
  }
  const copied = copyRecord({ home, cwd: built.cwd, base: built.base, gitDir: built.gitDir, call, recordDir, prompt: built.prompt, annotate: namesOnly, excludes: run.arm === "watched" ? [join(".grooph", "events")] : [] });
  copied.problems.push(...problems);
  problems = copied.problems;
  attempt("taking what denied calls asked out of the record's copy of the harness's output", () => withoutWhatDeniedCallsAsked(join(recordDir, "claude-output.json")));
  const measured = attempt(
    "the measures",
    () => {
      // The first check's own measures, unchanged, and without the two tools no arm of this look offers.
      const { the_two_tools: _none, ...first } = measure({ profile, sessionId: call.session_id, output: call.output, wallS: call.wall_s });
      const read = readSession(profile, call.session_id);
      return { ...first, delegation: delegation({ read, output: call.output }), noticed: noticed({ read, output: call.output, profileSettings: join(profile, "settings.json"), groophHome: groophHomeIn(home) }), read };
    },
    null,
  );
  const read = measured?.read ?? null;
  if (measured) delete measured.read;
  // The outside arm rests on a session of this profile being unable to read outside its own folder. A result that
  // shows one of the user-level places says it could: a person looks before another run is made on that premise.
  // A result that only echoes a path the call itself named (a refused read) shows the session nothing, and is not this.
  if (run.arm === "outside" && measured && measured.noticed.shown_in_the_result.of_them_showing_a_place_the_call_did_not_name > 0) problems.push(`${measured.noticed.shown_in_the_result.of_them_showing_a_place_the_call_did_not_name} tool result(s) of this session show a place the recorder is kept in outside the project that the call did not itself name (among: ${Object.keys(measured.noticed.shown_in_the_result.by_place).join(", ")}): the arm supposes a session cannot read there, and a person looks at this record before another run of the arm is made`);
  if (measured && measured.transcripts !== copied.transcripts.length) problems.push(`the measures read ${measured.transcripts} transcript(s) and the record names ${copied.transcripts.length}: a subagent's transcript is somewhere the record's list does not look`);
  const eventsFile = events ? join(recordDir, "events", `${call.session_id}.jsonl`) : null;
  const beside = run.arm === "plain" || !measured ? null : attempt("the hook's file beside the transcripts", () => hookBesideTranscripts({ eventsDir: events ? join(recordDir, "events") : null, sessionId: call.session_id, subagentIds: measured.subagents.ids }), null);
  const each = run.arm === "plain" || !read ? null : attempt("the hook's file beside the harness's files, agent by agent", () => agentByAgent({ read, eventsFile }), null);
  let scored = null;
  if (call.ended_by !== "the harness") {
    try {
      scored = scrubValue(score({ run, cwd: built.cwd, call })).value;
      writeFileSync(join(recordDir, "score.json"), `${JSON.stringify(scored, null, 2)}\n`, "utf8");
    } catch (error) {
      scored = null;
      problems.push(`scoring: ${error.message}`);
    }
  }
  // The folders go out of the next run's way before the result is written, so that what could not be moved is in it.
  const kept = aside();
  // After a run of the outside arm, which wrote in the profile's settings: the profile's own check, on every line.
  if (outside) {
    const lines = attempt("the profile's check after the run", () => (profileCheck ?? checkProfile)({ home, claude: real.path }).filter((line) => !line.ok).map((line) => `${line.what}: ${line.how}`), ["it could not be made"]);
    outside.the_profile_afterwards = { checked_by: "scripts/lib/compare-profile.mjs --check, every line", holds: lines.length === 0, lines_that_do_not_hold: lines };
    if (lines.length > 0) problems.push(`after the run the profile's own check does not hold on every line (${lines.join("; ")}): a person looks before anything else is started`);
  }
  const given = {
    the_runners_checkout: theCheckout,
    the_sessions_model: { block: run.block, asked_for: LEAD[run.block].model, effort: LEAD[run.block].effort },
    short_names_of_a_model: shortNamesIn(call.environment),
    the_prompt_ends_with: SENTENCE,
    hook_installed_in_the_project: built.installed,
    closed_to_the_session: built.closed.map((path) => path.slice(built.cwd.length + 1)),
    recorder_outside_the_project: outside,
  };
  const result = writeResult(recordDir, call, { run: run.name, block: run.block, task: run.task, arm: run.arm, round: run.round, replicate: run.replicate, rerun_of: rerun ? run.name : null, rerun_because: because, given, not_watched: notWatched ? "the hook left no file for this session: it is no run of its arm, and its values are not read with that arm's" : null, measures: measured, the_hooks_file_beside_the_transcripts: beside, the_hooks_file_agent_by_agent: each, scored: scored !== null, scored_outside_the_sandbox_on: scoring.decision, transcripts: copied.transcripts, problems, kept_out_of_the_record: copied.kept_out_of_the_record, protocol: PAGE });
  return { run, recordDir, result, score: scored, kept, tripwire: call.tripwire, next: nextRun(recordRoot, run.block, { withoutOutside, throughRound }) };
}

/**
 * Every run of one block still to come, one at a time, in the order: the whole block, or its first rounds, or
 * without its outside arm. It stops at the first refusal, which is thrown as any refusal is, and at the first run that
 * waits for a person. It never goes on into the next block.
 */
export async function runAll({ each = () => {}, ...options }) {
  if (!BLOCKS.includes(options.block)) throw new NotStarted(`${options.block == null ? "no block was named" : `${JSON.stringify(options.block)} is not a block of the second look`}: ${SAY_WHICH_BLOCK}`);
  const which = { withoutOutside: options.withoutOutside ?? false, throughRound: options.throughRound ?? null };
  const done = [];
  for (let next = nextRun(options.recordRoot, options.block, which); next; next = nextRun(options.recordRoot, options.block, which)) {
    const one = await runOne(options);
    done.push(one);
    each(one);
    const waits = waitsForAPerson(one);
    if (waits) return { done, stopped: { after: one.run.name, why: waits, by_the_harness: one.result.ended_by === "the harness" } };
  }
  return { done, stopped: null };
}

function readLedgerForScoring() {
  try {
    return readLedger();
  } catch (error) {
    throw new NotScored(error.message.replace(/^not started: /, ""));
  }
}

/** Score a run that was recorded and not scored, from the packages where the runner moved them. No session, no spend; it runs what the session wrote, on the owner's recorded decision. */
export function scoreKept({ name, ledger, home = DEFAULT_HOME, recordRoot = HOME }) {
  const scoring = scoringDecided(ledger ?? readLedgerForScoring(), SCORING);
  if (!scoring.ok) throw new NotScored(scoring.why);
  const again = String(name).endsWith("-rerun");
  const run = order().find((candidate) => candidate.name === (again ? String(name).slice(0, -"-rerun".length) : name));
  if (!run) throw new NotScored(`${JSON.stringify(name)} is not a run of the second look: --score names one, such as ${BLOCKS[0]}/four/plain-1 or ${BLOCKS[0]}/four/plain-1-rerun`);
  const recordDir = `${recordOf(run, recordRoot)}${again ? "-rerun" : ""}`;
  if (!existsSync(join(recordDir, "result.json"))) throw new NotScored(`${name} has no record`);
  if (existsSync(join(recordDir, "score.json"))) throw new NotScored(`${name} is already scored`);
  const result = JSON.parse(readFileSync(join(recordDir, "result.json"), "utf8"));
  if (result.ended_by === "the harness") throw new NotScored(`${name} was ended by the harness: such a run is not scored`);
  const tree = join(home, "kept", String(result.session_id), "work", TASKS[run.task].repository);
  if (!realFolder(tree)) throw new NotScored(`the packages of ${name} are not where the runner moved them (${tree})`);
  const scored = scrubValue({ ...score({ run, cwd: tree, call: result }), scored_afterwards_from: "the packages as the runner kept them", scored_outside_the_sandbox_on: scoring.decision }).value;
  writeFileSync(join(recordDir, "score.json"), `${JSON.stringify(scored, null, 2)}\n`, "utf8");
  return { run, recordDir, score: scored };
}

// ── what would be started, and where things stand ────────────────────────

const quoted = (arg) => (/^[A-Za-z0-9_\/.,:=@%+-]+$/.test(arg) ? arg : `'${String(arg).replaceAll("'", `'\\''`)}'`);

/** A dry run of one run: its folder is built, what would be started is put into words, and the folder is taken away again. Starts nothing. */
export function dryRun({ run, home = DEFAULT_HOME, ledgerPath = LEDGER, recordRoot = HOME, stand = asThingsStand, node = process.execPath, cli = CLI, rehearsal = rehearse }) {
  const ledger = readLedger(ledgerPath);
  const watchdog = WATCHDOG[run.block][run.task];
  const lead = LEAD[run.block];
  const built = build({ run, home, node, cli });
  try {
    const things = stand({ home, cwd: built.cwd });
    const refused = [...things.refused];
    const scoring = scoringDecided(ledger, SCORING);
    if (!scoring.ok) refused.push(scoring.why);
    const held = heldUpBy(run.block, recordRoot);
    if (held) refused.push(held.why);
    const has = room(ledger, watchdog.usd);
    if (!has.ok) refused.push(has.why);
    const rehearsed = run.arm === "outside" ? rehearsal({ cli, node, home }) : null;
    if (rehearsed && !rehearsed.ok) refused.push(rehearsed.why);
    const now = checkout();
    const other = madeFromAnother(now, recordRoot);
    if (other) refused.push(`this checkout is at commit ${short(now.commit)} with the hook ${short(now.hook_sha256)}, and ${other.run} was made from ${other.what.join(" and with ")}: both blocks are run from one built checkout at one commit, unless --another-checkout says otherwise by name`);
    const sample = commandFor({ home, claude: built.outside ? built.outside.launcher : things.claude, cwd: built.cwd, prompt: built.prompt, ...lead, sessionId: "<a new id>", maxBudgetUsd: watchdog.usd, closed: built.closed, unpinned: LEFT_TO_THE_HARNESS });
    const names = shortNamesIn(Object.keys(sample.env));
    const tracked = spawnSync("git", ["--git-dir", built.gitDir, "ls-tree", "-r", "--name-only", built.base], { encoding: "utf8" }).stdout.split("\n").filter(Boolean);
    const arm =
      run.arm === "plain"
        ? "plain: nothing of grooph is in the folder, in the session's settings or on its path"
        : run.arm === "watched"
          ? `watched: grooph hooks install was run in the folder before its one commit, with no other flag (${built.installed.join(", ")}); ${built.closed.map((path) => path.slice(built.cwd.length + 1)).join(", ")} is closed to the session's writing, whole`
          : `outside: the folder holds nothing of grooph. The program started is a launcher, which installs the recorder at the user's level of the profile (grooph's own folder: ${built.outside.grooph_home}), lists the session's folder, and becomes the harness (${things.claude}):\n${built.outside.text.replaceAll("<the harness>", things.claude).replace(/^/gm, "  | ")}\n  the rehearsal of that install, in a scratch folder: ${rehearsed.ok ? `it left ${rehearsed.left.entries} entries, at ${rehearsed.left.at_events.join(", ")}${(rehearsed.left.a_scratch_copy_of_the_profiles_settings ?? []).map((view) => `\n    a scratch copy of the profile's settings, ${view.when}: ${view.holds ? "" : "NOT "}${view.they_are}`).join("")}` : "it did not hold (below)"}`;
    return [
      `${run.name}`,
      `the block: ${run.block}: the session itself on ${lead.model} at ${lead.effort} effort; round ${run.round} of ${ROUND_COUNT}`,
      `the arm: ${arm}`,
      `the folder, in its one commit: ${tracked.length} files (${tracked.slice(0, 12).join(", ")}${tracked.length > 12 ? ", …" : ""})`,
      `would start, in ${built.cwd}:\n  ${sample.argv.map((arg) => (arg === built.prompt ? "<the prompt>" : quoted(arg))).join(" ")}`,
      `short names of a model, in its environment: ${Object.entries(names.pinned).map(([short, model]) => `${short} pinned to ${model}`).join(", ") || "none pinned"}; left to the harness: ${names.left_to_the_harness.join(", ") || "none"}`,
      `the prompt, ${built.prompt.length} characters:\n${built.prompt.replace(/^/gm, "  | ")}`,
      `the watchdog: $${watchdog.usd.toFixed(2)} and ${watchdog.minutes} minutes; the ledger has counted $${has.spent.toFixed(2)} of $${ledger.cap_usd.toFixed(2)}`,
      refused.length === 0 ? "as things stand, a paid run would pass the gates before the ledger's" : `as things stand, a paid run would be refused:\n  - ${refused.join("\n  - ")}`,
      "nothing was started.",
    ].join("\n");
  } finally {
    unbuild(built);
  }
}

/** The ledger and the thirty-six runs, block by block and round by round, in words. Starts nothing and builds nothing in the profile. */
export function status({ ledgerPath = LEDGER, recordRoot = HOME, firstCallGate, rehearsed } = {}) {
  const lines = [];
  let ledger = null;
  try {
    ledger = readLedger(ledgerPath);
    const has = room(ledger, 0);
    lines.push(`the ledger (${relativeToRoot(ledgerPath)}): $${has.spent.toFixed(2)} counted of $${ledger.cap_usd.toFixed(2)}, in ${ledger.invocations.length} line(s); a cost not yet settled counts at its ceiling`);
    for (const entry of ledger.invocations) lines.push(`  ${String(entry.n).padStart(2)}  ${String(entry.run).padEnd(40)} ${String(entry.status).padEnd(8)} ${typeof entry.cost_usd === "number" ? `$${entry.cost_usd.toFixed(4)}` : `unknown (counted $${entry.max_budget_usd})`}`);
    const scoring = scoringDecided(ledger, SCORING);
    lines.push(scoring.ok ? `scoring outside the sandbox: decided by ${scoring.decision.decided_by} on ${scoring.decision.on}` : "scoring outside the sandbox: no decision of the owner's is recorded for this look, so no run starts and none is scored");
  } catch (error) {
    lines.push(error.message);
  }
  if (firstCallGate) lines.push(firstCallGate.ok ? `the profile's first call: on record (${firstCallGate.record}), and says later runs may start` : `the profile's first call: ${firstCallGate.why}`);
  const now = checkout();
  const other = madeFromAnother(now, recordRoot);
  lines.push(`this checkout: commit ${short(now.commit)}, grooph ${now.grooph_version}, hook ${short(now.hook_sha256)}${other ? `; ${other.run} WAS MADE FROM ${other.what.join(" and with ").toUpperCase()} (commit ${short(other.its_commit)}, hook ${short(other.its_hook_sha256)}), so a run from here is refused unless --another-checkout says so by name` : "; no run already recorded was made from another"}`);
  if (rehearsed) lines.push(rehearsed.ok ? `the outside arm: this checkout's grooph installs the recorder outside a project, and a rehearsal in a scratch folder left what the protocol says (${rehearsed.left.entries} entries, at ${rehearsed.left.at_events.join(", ")})` : `the outside arm: cannot be made as things stand: ${rehearsed.why}`);
  const runs = order().map((run) => ({ ...run, ...stateOf(run, recordRoot) }));
  const isRecorded = (run) => run.state !== "not recorded";
  lines.push(`the thirty-six runs, in two blocks of eighteen, in their order (${runs.filter(isRecorded).length} recorded):`);
  for (const block of BLOCKS) {
    const its = runs.filter((run) => run.block === block);
    const held = heldUpBy(block, recordRoot);
    const limits = Object.entries(WATCHDOG[block]).map(([task, limit]) => `a run of \`${task}\` stops at $${limit.usd.toFixed(2)} or ${limit.minutes} minutes`).join(", ");
    lines.push(`the ${block} block, the session itself on ${LEAD[block].model} at ${LEAD[block].effort} effort (${its.filter(isRecorded).length} of ${its.length} recorded; ${limits})${held ? "; not started yet: the block before it has no whole round, or a round begun and not finished" : ""}:`);
    const bet = theBet(block, recordRoot);
    if (bet.recorded > 0) lines.push(`  sessions that started a subagent: ${bet.delegated} of ${bet.recorded} with a record${bet.arms_with_no_run_that_delegated.length > 0 ? `; no run that did, so far, in ${bet.arms_with_no_run_that_delegated.join(", ")}` : ""}${bet.fails === true ? `\n  AS THESE RECORDS STAND THE TASKS' BET FAILS ITS TEST (${PAGE}, "What would show the bet was wrong"): if that is how the block ends, the next block is not started on the page as it stands` : ""}`);
    for (const run of its) lines.push(`  round ${run.round}  ${run.name.padEnd(22)} ${run.state}${run.ended_by ? `: ended by ${run.ended_by}` : ""}${run.from === "its rerun" ? " (its rerun)" : ""}${Number.isInteger(run.subagents) ? `; ${run.subagents} subagent(s)` : ""}${run.passed ? `; ${run.passed.join(" · ")}` : ""}${run.why ? ` (${run.why})` : ""}`);
  }
  const next = nextRun(recordRoot);
  const has = next && ledger ? room(ledger, WATCHDOG[next.block][next.task].usd) : null;
  lines.push(`next: ${next ? `${next.name} (started with --block ${next.block}), which may cost up to $${WATCHDOG[next.block][next.task].usd.toFixed(2)}${has ? (has.ok ? `; the ledger has room for it ($${has.left.toFixed(2)} left)` : `\nTHE LEDGER HAS NO ROOM FOR IT, and it would be refused: ${has.why}`) : ""}` : "none; every run is recorded"}`);
  return lines.join("\n");
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const flags = process.argv.slice(2);
  const KNOWN = { plain: ["--status", "--dry-run", "--next", "--all", "--spend", "--without-outside", "--another-checkout"], valued: ["--go", "--block", "--run", "--rerun", "--score", "--settle", "--cost", "--note", "--through-round"] };
  const unknown = unknownFlags(flags, KNOWN);
  if (unknown.length > 0) {
    console.error(`${unknown.join(", ")}: not a flag of this script. Nothing was started.`);
    process.exit(64);
  }
  const valueOf = (flag) => (flags.includes(flag) ? flags[flags.indexOf(flag) + 1] : null);
  for (const flag of ["--run", "--rerun", "--score"]) {
    if (flags.includes(flag) && (!valueOf(flag) || valueOf(flag).startsWith("--"))) {
      console.error(`${flag} names a run, such as ${BLOCKS[0]}/four/plain-1. Nothing was started.`);
      process.exit(64);
    }
  }
  if (flags.includes("--block") && !BLOCKS.includes(valueOf("--block"))) {
    console.error(`--block names a block of the look: ${BLOCKS.join(", ")}. Nothing was started.`);
    process.exit(64);
  }
  const throughRound = flags.includes("--through-round") ? Number(valueOf("--through-round")) : null;
  if (throughRound !== null && !(Number.isInteger(throughRound) && throughRound >= 1 && throughRound <= ROUND_COUNT)) {
    console.error(`--through-round names a round, 1 to ${ROUND_COUNT}. Nothing was started.`);
    process.exit(64);
  }
  const withoutOutside = flags.includes("--without-outside");
  const anotherCheckout = flags.includes("--another-checkout");
  // One thing is asked for at a time. A flag that belongs to another thing is refused, never passed over.
  const asked = [...KNOWN.plain, ...KNOWN.valued].filter((flag) => flags.includes(flag));
  const only = (what, allowed) => {
    const beside = asked.filter((flag) => !allowed.includes(flag));
    if (beside.length === 0) return;
    console.error(`${what} does not go with ${beside.join(", ")}. Nothing was started, and nothing a session wrote was run.`);
    process.exit(64);
  };
  if (flags.includes("--status")) only("--status", ["--status"]);
  else if (flags.includes("--score")) only("--score", ["--score"]);
  else if (flags.includes("--settle")) only("--settle", ["--settle", "--cost", "--note"]);
  else if (flags.includes("--dry-run")) only("--dry-run", ["--dry-run", "--next", "--all", "--block", "--run", "--spend", "--go", "--without-outside", "--through-round", "--another-checkout"]);
  else only("a paid run", ["--next", "--all", "--block", "--rerun", "--spend", "--go", "--run", "--without-outside", "--through-round", "--another-checkout"]);
  for (const flag of ["--run", "--rerun"]) {
    if (flags.includes(flag) && (flags.includes("--block") || withoutOutside || throughRound !== null)) {
      console.error(`--block, --without-outside and --through-round do not go with ${flag}: a run's name carries its block, its arm and its round. Nothing was started.`);
      process.exit(64);
    }
  }
  if (flags.includes("--status")) {
    console.log(status({ firstCallGate: firstCallAllows(), rehearsed: rehearse() }));
    process.exit(0);
  }
  if (flags.includes("--settle")) {
    try {
      const said = valueOf("--cost");
      const line = settleLine({ n: Number(valueOf("--settle")), cost: said === "ceiling" ? null : said === null ? NaN : Number(said), note: valueOf("--note") });
      console.log(`line ${line.n} (${line.run}) is settled: ${typeof line.cost_usd === "number" ? `$${line.cost_usd.toFixed(4)}` : `no cost known, so it counts at its ceiling of $${line.max_budget_usd}`}. No session was started.`);
      process.exit(0);
    } catch (error) {
      console.error(`${error.message}\nNothing was changed.`);
      process.exit(64);
    }
  }
  if (flags.includes("--score")) {
    try {
      const done = scoreKept({ name: valueOf("--score") });
      console.log(`${valueOf("--score")} scored in ${relativeToRoot(done.recordDir)}: ${scoreLine(done.score)}`);
      process.exit(0);
    } catch (error) {
      console.error(`${error.message}\nNothing a session wrote was run.`);
      process.exit(error instanceof NotScored ? 64 : 1);
    }
  }
  if (flags.includes("--dry-run")) {
    try {
      const named = valueOf("--run");
      const block = valueOf("--block");
      const which = { withoutOutside, throughRound };
      const one = named ? order().find((run) => run.name === named) : nextRun(HOME, block, which);
      if (named && !one) throw new NotStarted(`${JSON.stringify(named)} is not a run of the second look: --run names one, such as ${BLOCKS[0]}/six/outside-1`);
      const runs = flags.includes("--all") ? order().filter((run) => (block === null || run.block === block) && !(withoutOutside && run.arm === "outside") && (throughRound === null || run.round <= throughRound) && stateOf(run).state === "not recorded") : one ? [one] : [];
      if (runs.length === 0) console.log(block ? `every run of the \`${block}\` block that was asked for is recorded` : "every run of the second look that was asked for is recorded");
      for (const run of runs) console.log(`${dryRun({ run })}\n`);
      process.exit(0);
    } catch (error) {
      console.error(`${error.message}\nNothing was started.`);
      process.exit(1);
    }
  }
  if (flags.includes("--run")) {
    console.error("--run names a run for --dry-run only: a paid run is the next of a block (--next --block <name>), every run of a block still to come (--all --block <name>), or the one rerun of a run the harness ended (--rerun). Nothing was started.");
    process.exit(64);
  }
  const allowed = spendFlags(flags);
  if (!allowed.ok) {
    console.error(`this script starts paid model sessions, and will not without ${allowed.missing.join(" and ")}. Use --dry-run to see what it would start.`);
    process.exit(64);
  }
  const which = ["--next", "--all", "--rerun"].filter((flag) => flags.includes(flag));
  if (which.length !== 1) {
    console.error(`say which: --next (the next run of a block), --all (every run of a block still to come) or --rerun <block>/<task>/<arm>-<n>. ${which.length === 0 ? "None" : "More than one"} was given. Nothing was started.`);
    process.exit(64);
  }
  const block = valueOf("--block");
  if (which[0] !== "--rerun" && block === null) {
    console.error(`${SAY_WHICH_BLOCK}. Nothing was started.`);
    process.exit(64);
  }
  const say = (done, again) => {
    if (done.notStarted) return console.log(`${done.run.name} WAS NOT STARTED, and has no record of its own: ${done.result.not_started}\nWhat happened is kept in ${relativeToRoot(done.recordDir)}. Once a person has looked, the same command starts it again.`);
    const cost = done.result.reported_cost_usd === null ? "unknown (counted at the ceiling)" : `$${done.result.reported_cost_usd.toFixed(4)}`;
    const scored = done.score ? scoreLine(done.score) : done.result.ended_by === "the harness" ? "not scored: the harness ended it" : `recorded and not scored: the scorer failed, and what went wrong is in the record. To score it from the packages the runner kept: node ${SCRIPT} --score ${done.run.name}${again ? "-rerun" : ""}`;
    const each = done.result.the_hooks_file_agent_by_agent;
    console.log(`${done.run.name}${again ? " (run once more)" : ""} recorded in ${relativeToRoot(done.recordDir)}: ended by ${done.result.ended_by}; reported cost ${cost}; ${done.result.measures?.subagents?.count ?? "an unknown number of"} subagent(s); ledger line ${done.result.ledger_n}\n${scored}${each ? `\nthe hook's file beside the harness's files: ${each.differences.count} difference(s) in ${each.subagents_in_the_harnesss_files} subagent(s)` : ""}`);
    if ((done.result.problems ?? []).length > 0) console.log(`problems keeping the record:\n  - ${done.result.problems.join("\n  - ")}`);
    if (done.tripwire) console.log(`\n${done.tripwire}`);
  };
  try {
    if (which[0] === "--all") {
      const all = await runAll({ go: allowed.go, block, withoutOutside, throughRound, anotherCheckout, each: (done) => (say(done, false), console.log("")) });
      if (all.stopped) {
        console.log(`stopped after ${all.stopped.after}: ${all.stopped.why}. Nothing more is started until a person has looked.${all.stopped.by_the_harness ? ` If it failed for a reason outside the session, it may be run once more: --rerun ${all.stopped.after}` : ""}`);
        process.exit(2);
      }
      const after = BLOCKS[BLOCKS.indexOf(block) + 1];
      console.log(`every run of the \`${block}\` block that was asked for is recorded. ${after ? `The \`${after}\` block is not gone on into: it is started by name, once the driver has read these records` : "It is the last of the two"}`);
      process.exit(0);
    }
    const done = await runOne({ go: allowed.go, block, rerun: valueOf("--rerun"), withoutOutside, throughRound, anotherCheckout });
    say(done, flags.includes("--rerun"));
    console.log(`next: ${done.next ? done.next.name : `none; every run of the \`${done.run.block}\` block that was asked for is recorded`}`);
    process.exit(waitsForAPerson(done) ? 2 : 0);
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}
