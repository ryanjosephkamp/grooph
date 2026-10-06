/**
 * One paid run of "roles or information", study three's question 5
 * (experiments/comparisons/roles-or-information/README.md is its pre-registration). THIS SCRIPT CAN SPEND MONEY: it
 * starts a model session. It refuses to without `--spend` and `--go "<the driver's words>"`; `--next` says which run
 * is next in the pre-registered order, builds its folder, prints what would be started, and starts nothing.
 *
 *   node scripts/lib/roles-or-information-paid.mjs --next
 *   node scripts/lib/roles-or-information-paid.mjs --spend --go "<the driver's words>"     the next run, and only that one
 *   … --rerun <task>/<arm>-<n>     only for a run whose record is invalid, once, on the driver's word
 *   node scripts/lib/roles-or-information-paid.mjs --readings                              what the recorded scores are read as, so far
 *
 * NO RUN OF THIS QUESTION STARTS until the owner's decision on scoring is recorded. Scoring is study two's: it runs
 * the task's own `npm test` and the repository's held-out suite against the session's final tree, which runs the code
 * the session wrote, outside the sandbox and with this account's rights. The decision is kept in
 * experiments/comparisons/study-three-first-steps.json (scoring_outside_the_sandbox: decided_by, on, words), empty
 * until he gives it. Without it `--next` says so, and a paid run and a scoring are both refused.
 *
 *   node scripts/lib/roles-or-information-paid.mjs --score <task>/<arm>-<n>     score a run whose scorer failed; no session, no spend
 */

import { cpSync, existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { reviewersFiles } from "./compare-arms-ef.mjs";
import { commandFor, DEFAULT_HOME } from "./compare-profile.mjs";
import { scoreTree } from "./compare-score.mjs";
import { asThingsStand, copyRecord, FIRST_STEPS, firstCallAllows, makeProject, NotStarted, relativeToRoot, runSession, setAside, spendFlags, unknownFlags, writeResult } from "./study-three-paid.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const comparisons = join(root, "experiments", "comparisons");
const HOME = join(comparisons, "roles-or-information");
export const expectation = () => JSON.parse(readFileSync(join(HOME, "expect.json"), "utf8"));

/** What scoring does, said wherever it is refused. The profile's page (experiments/comparisons/profile/README.md) says the same. */
export const SCORING_RUNS_WHAT_A_SESSION_WROTE =
  "Scoring runs the task's own `npm test` and the repository's held-out suite against the session's final tree, and that runs the code the session wrote: outside the sandbox, with this account's rights. A session's commands run inside the sandbox; what it wrote does not when it is scored.";

/**
 * The owner's decision that what sessions wrote may be run outside the sandbox to score it, as it is recorded in the
 * first steps' file. Not recorded is a no: then no run of this question is started, since a run that cannot be scored
 * is not paid for.
 */
export function scoringDecided(plan) {
  const decision = plan?.scoring_outside_the_sandbox ?? {};
  const recorded = ["decided_by", "on", "words"].every((key) => typeof decision[key] === "string" && decision[key].trim() !== "");
  return recorded
    ? { ok: true, decision: { decided_by: decision.decided_by, on: decision.on, words: decision.words } }
    : { ok: false, why: `${SCORING_RUNS_WHAT_A_SESSION_WROTE} Whether that may be done is the owner's to decide, and no decision of his is recorded (experiments/comparisons/study-three-first-steps.json, scoring_outside_the_sandbox: decided_by, on, words). Until one is, no run of this question is started and none is scored.` };
}
const firstSteps = () => JSON.parse(readFileSync(FIRST_STEPS, "utf8"));

/** A refusal to score: nothing a session wrote was run. */
export class NotScored extends Error {}

/** Every run in the pre-registered order. */
export function order(expect) {
  const runs = [];
  for (const task of expect.tasks) for (let n = 1; n <= expect.replicates; n += 1) for (const arm of Object.keys(expect.arms)) runs.push({ task, arm, replicate: n, name: `${task}/${arm}-${n}` });
  return runs;
}

/** The first run of the order that has no record yet, or null when all are recorded. */
export const nextRun = (expect, recordRoot = HOME) => order(expect).find((run) => !existsSync(join(recordRoot, run.task, `${run.arm}-${run.replicate}`, "result.json"))) ?? null;

/** Build one run's folder and prompt. Starts nothing. */
export function build({ run, home }) {
  const task = join(comparisons, run.task);
  // Everything that is read or checked comes before the session's folder is made: what fails after it would leave the folder behind.
  const kept = readFileSync(join(HOME, run.task, `prompt-${run.arm}.md`), "utf8");
  if (run.arm === "F" && /held-out/i.test(kept)) throw new NotStarted(`${run.name}: arm F's prompt names held-out material`);
  const name = JSON.parse(readFileSync(join(task, "task", "package.json"), "utf8")).name;
  const given = run.arm === "E" ? reviewersFiles(run.task) : [];
  const project = makeProject({
    home,
    name,
    fill: (cwd) => {
      cpSync(join(task, "task"), cwd, { recursive: true });
      // Arm E is given what a reviewer was given, inside its own folder: the profile lets no file tool read outside it.
      for (const file of given) cpSync(join(task, "held-out", file), join(cwd, "held-out", file));
    },
  });
  return { ...project, prompt: kept.replaceAll("<held-out>", "held-out"), closed: run.arm === "E" ? [join(project.cwd, "held-out")] : [] };
}

/** Study two's scorer on the final tree, from the repository's own suite. */
export function score({ run, cwd, call }) {
  const task = join(comparisons, run.task);
  const two = JSON.parse(readFileSync(join(task, "expect.json"), "utf8"));
  const slots = JSON.parse(readFileSync(join(task, "slots.json"), "utf8"));
  const ending = call.ended_by === "the session" ? { kind: "clean", reason: "the session ended itself" } : { kind: "cut-off", reason: `ended by ${call.ended_by}${call.which ? ` (${call.which})` : ""}` };
  // The copy of the held-out material arm E was given is not its work: what it did to that copy is recorded apart, not scored as scope.
  // What the session changed, if it was read whole. A change that was not is not "nothing outside scope": the score says so.
  const read = Array.isArray(call.project_files_changed) && !call.project_change_not_wholly_read;
  const files = (call.project_files_changed ?? []).filter((file) => !/(^|\s)held-out\//.test(file));
  const scored = scoreTree({ tree: cwd, heldOutDir: join(task, "held-out"), testCommand: two.test_command ?? slots.values["test-command"], allowed: two.scope.allowed, protectedPaths: two.scope.protected ?? [], files, ending, expectedCases: two.held_out_cases });
  scored.held_out.scored_from = `experiments/comparisons/${run.task}/held-out`;
  scored.held_out.the_sessions_copy_changed = (call.project_files_changed ?? []).filter((file) => /(^|\s)held-out\//.test(file));
  if (!read) scored.scope.not_known = `the project's change was not ${Array.isArray(call.project_files_changed) ? "wholly " : ""}read${call.project_change_not_wholly_read ? ` (${call.project_change_not_wholly_read})` : ""}: what is outside scope is at least what is listed, and may be more`;
  return scored;
}

/**
 * The record a run's score is read from: its own, or its one rerun when its own was invalid (the harness ended it).
 * A run invalid both times was not obtained. A run the watchdog cut off is scored as it stands, as study two's
 * protocol scores a cut-off; a run whose suite could not be run against its tree passed no case.
 */
export function scoreOf(run, recordRoot = HOME) {
  const first = join(recordRoot, run.task, `${run.arm}-${run.replicate}`);
  const read = (dir) => (existsSync(join(dir, "result.json")) ? { result: JSON.parse(readFileSync(join(dir, "result.json"), "utf8")), score: existsSync(join(dir, "score.json")) ? JSON.parse(readFileSync(join(dir, "score.json"), "utf8")) : null } : null);
  const own = read(first);
  if (!own) return { state: "not recorded" };
  const used = own.result.ended_by === "the harness" ? read(`${first}-rerun`) : own;
  if (!used) return { state: "invalid, and not yet run again" };
  if (used.result.ended_by === "the harness") return { state: "not obtained: invalid both times" };
  // Recorded, and the scorer was not run on it (it runs what a session wrote, and is asked for by name): not a score of nothing.
  if (!used.score) return { state: "recorded, not scored" };
  const held = used.score.held_out;
  return { state: "scored", passed: held?.ran ? held.passed : 0, cut_off: used.result.ended_by === "the watchdog", from: used === own ? "its own record" : "its rerun" };
}

/**
 * What the recorded scores are read as, by the two pre-registered statements. Each is read as soon as the recorded
 * scores settle it either way, and not before: true, false, "not decided yet" while a run that could still settle it
 * is to come, or "not decided: a run was not obtained" when nothing is to come and a run invalid both times leaves it open.
 *
 *   the information did it      false at the first run of E short of every case, or run of F above the task alone;
 *                               true only when all the runs are scored and none of them is either
 *   the roles did some of it    true at two tasks with both runs of F above the task alone; false once fewer than two
 *                               tasks could still have that (a run of F at or under the task alone, or not obtained)
 */
export function readings(expect, recordRoot = HOME) {
  const runs = order(expect).map((run) => ({ ...run, ...scoreOf(run, recordRoot) }));
  const two = expect.from_study_two;
  const of = (task, arm) => runs.filter((run) => run.task === task && run.arm === arm);
  const scored = (list) => list.filter((run) => run.state === "scored");
  const scores = {};
  for (const run of scored(runs)) ((scores[run.task] ??= {})[run.arm] ??= []).push(run.passed);
  const lost = runs.filter((run) => run.state.startsWith("not obtained")).map((run) => run.name);
  const waiting = runs.filter((run) => run.state === "not recorded" || run.state.startsWith("invalid")).map((run) => run.name);
  const unscored = runs.filter((run) => run.state === "recorded, not scored").map((run) => run.name);
  const open = waiting.length > 0 || unscored.length > 0 ? "not decided yet" : "not decided: a run was not obtained";
  const complete = runs.every((run) => run.state === "scored");
  const refuted = expect.tasks.some((task) => scored(of(task, "E")).some((run) => run.passed < two[task].held_out_cases) || scored(of(task, "F")).some((run) => run.passed > two[task].the_task_alone));
  const fAbove = expect.tasks.filter((task) => scored(of(task, "F")).length === expect.replicates && of(task, "F").every((run) => run.passed > two[task].the_task_alone));
  const fOut = expect.tasks.filter((task) => of(task, "F").some((run) => run.state.startsWith("not obtained") || (run.state === "scored" && run.passed <= two[task].the_task_alone)));
  return {
    scores,
    runs: Object.fromEntries(runs.map((run) => [run.name, run.state === "scored" ? `${run.passed}${run.cut_off ? " (cut off by the watchdog)" : ""}${run.from === "its rerun" ? " (its rerun)" : ""}` : run.state])),
    every_run_scored: complete,
    the_information_did_it: refuted ? false : complete ? true : open,
    the_roles_did_some_of_it: fAbove.length >= 2 ? true : expect.tasks.length - fOut.length < 2 ? false : open,
    tasks_where_both_runs_of_F_are_above_the_task_alone: fAbove,
    runs_still_to_come: waiting,
    runs_recorded_and_not_scored: unscored,
    runs_not_obtained: lost,
  };
}

/** One run, start to record. */
export async function runOne({ go, rerun = null, plan, home = DEFAULT_HOME, claude, ledgerPath, recordRoot = HOME, profileCheck, gameOpen, firstCallGate = firstCallAllows(), grace }) {
  const expect = expectation();
  if (!firstCallGate.ok) throw new NotStarted(firstCallGate.why);
  // Before any folder is made: a run of this question is scored by running what the session wrote, outside the
  // sandbox. Without the owner's recorded decision on that, the whole run is refused, not only its scoring.
  let scoring;
  try {
    plan ??= firstSteps();
    scoring = scoringDecided(plan);
  } catch (error) {
    throw new NotStarted(`the first steps' file could not be read: ${error.message}`);
  }
  if (!scoring.ok) throw new NotStarted(scoring.why);
  let run = nextRun(expect, recordRoot);
  let recordDir = run ? join(recordRoot, run.task, `${run.arm}-${run.replicate}`) : null;
  if (rerun !== null) {
    run = order(expect).find((candidate) => candidate.name === rerun);
    if (!run) throw new NotStarted(`${JSON.stringify(rerun)} is not a run of this question: --rerun names one, such as review-gate-2/E-1`);
    const first = join(recordRoot, run.task, `${run.arm}-${run.replicate}`);
    if (!existsSync(join(first, "result.json")) || JSON.parse(readFileSync(join(first, "result.json"), "utf8")).ended_by !== "the harness") throw new NotStarted(`${rerun} has no invalid record to run again`);
    recordDir = `${first}-rerun`;
    if (existsSync(join(recordDir, "result.json"))) throw new NotStarted(`${rerun} was already run again once`);
  }
  if (!run) throw new NotStarted("every run of this question is recorded");
  const built = build({ run, home });
  const watchdog = expect.watchdog[run.arm];
  let call;
  try {
    call = await runSession({ home, cwd: built.cwd, prompt: built.prompt, ...expect.lead, usd: watchdog.usd_per_session, minutes: watchdog.minutes_per_session, closed: built.closed, label: { project: `roles-or-information/${run.task}`, arm: run.arm, replicate: rerun ? `${run.replicate}-rerun` : run.replicate }, note: `roles or information: ${expect.arms[run.arm].split(":")[0]}${rerun ? "; the one rerun of an invalid run" : ""}`, go, claude, ledgerPath, harnessDir: built.harnessDir, profileCheck, gameOpen, plan, grace });
  } catch (error) {
    if (error instanceof NotStarted) rmSync(built.work, { recursive: true, force: true });
    throw error;
  }
  const copied = copyRecord({ home, cwd: built.cwd, base: built.base, gitDir: built.gitDir, call, recordDir, prompt: built.prompt, excludes: [] });
  // The scorer runs what the session wrote, outside the sandbox: on the owner's recorded decision, which the record
  // names. A run the harness ended is not scored. If the scorer itself fails there is no score, which is not a score
  // of nothing: the run reads as recorded and not scored, and --score can be asked for it afterwards.
  let scored = null;
  if (call.ended_by !== "the harness") {
    try {
      scored = score({ run, cwd: built.cwd, call });
      writeFileSync(join(recordDir, "score.json"), `${JSON.stringify(scored, null, 2)}\n`, "utf8");
    } catch (error) {
      scored = null;
      copied.problems.push(`scoring: ${error.message}`);
    }
  }
  const result = writeResult(recordDir, call, { run: run.name, task: run.task, arm: run.arm, replicate: run.replicate, rerun_of: rerun ? run.name : null, scored: scored !== null, scored_outside_the_sandbox_on: scoring.decision, held_out_given: run.arm === "E" ? reviewersFiles(run.task) : [], transcripts: copied.transcripts, problems: copied.problems, kept_out_of_the_record: copied.kept_out_of_the_record, pre_registration: "experiments/comparisons/roles-or-information/README.md" });
  let kept = null;
  try {
    kept = setAside({ home, work: built.work, sessionId: call.session_id });
  } catch (error) {
    console.error(`the session's folder could not be moved aside (${error.message}); it is still at ${built.work}`);
  }
  return { run, recordDir, result, score: scored, kept, tripwire: call.tripwire, next: nextRun(expect, recordRoot) };
}

/**
 * Score a run that was recorded and not scored (its scorer failed), from its final tree where the runner moved it.
 * It starts no session and spends nothing; it runs what the session wrote, and refuses without the owner's recorded
 * decision, as a paid run does.
 */
export function scoreKept({ name, plan = firstSteps(), home = DEFAULT_HOME, recordRoot = HOME }) {
  const scoring = scoringDecided(plan);
  if (!scoring.ok) throw new NotScored(scoring.why);
  const again = String(name).endsWith("-rerun");
  const run = order(expectation()).find((candidate) => candidate.name === (again ? String(name).slice(0, -"-rerun".length) : name));
  if (!run) throw new NotScored(`${JSON.stringify(name)} is not a run of this question: --score names one, such as review-gate-2/E-1 or review-gate-2/E-1-rerun`);
  const recordDir = join(recordRoot, run.task, `${run.arm}-${run.replicate}${again ? "-rerun" : ""}`);
  if (!existsSync(join(recordDir, "result.json"))) throw new NotScored(`${name} has no record`);
  if (existsSync(join(recordDir, "score.json"))) throw new NotScored(`${name} is already scored`);
  const result = JSON.parse(readFileSync(join(recordDir, "result.json"), "utf8"));
  if (result.ended_by === "the harness") throw new NotScored(`${name} was ended by the harness: an invalid run is not scored`);
  const tree = join(home, "kept", String(result.session_id), "work", JSON.parse(readFileSync(join(comparisons, run.task, "task", "package.json"), "utf8")).name);
  if (!existsSync(tree)) throw new NotScored(`the final tree of ${name} is not where the runner moved it (${tree})`);
  const scored = score({ run, cwd: tree, call: result });
  scored.scored_afterwards_from = "the final tree as the runner kept it";
  writeFileSync(join(recordDir, "score.json"), `${JSON.stringify(scored, null, 2)}\n`, "utf8");
  return { run, recordDir, score: scored };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const flags = process.argv.slice(2);
  const expect = expectation();
  const unknown = unknownFlags(flags, { plain: ["--next", "--dry-run", "--spend", "--readings"], valued: ["--go", "--rerun", "--score"] });
  if (unknown.length > 0) {
    console.error(`${unknown.join(", ")}: not a flag of this script. Nothing was started.`);
    process.exit(64);
  }
  if (flags.includes("--score")) {
    const named = flags[flags.indexOf("--score") + 1];
    try {
      if (!named || named.startsWith("--")) throw new NotScored("--score names the run to score, such as review-gate-2/E-1");
      const done = scoreKept({ name: named });
      const held = done.score.held_out;
      console.log(`${named} scored in ${relativeToRoot(done.recordDir)}: held-out ${held.ran ? `${held.passed}/${held.cases}` : `not run (${held.reason})`} · tests ${done.score.tests.pass ? "pass" : "fail"} · outside scope ${done.score.scope.outside?.length ?? "?"}`);
      process.exit(0);
    } catch (error) {
      console.error(`${error.message}\nNothing a session wrote was run.`);
      process.exit(error instanceof NotScored ? 64 : 1);
    }
  }
  if (flags.includes("--readings")) {
    console.log(JSON.stringify(readings(expect), null, 2));
    process.exit(0);
  }
  if (flags.includes("--next") || flags.includes("--dry-run")) {
    const run = nextRun(expect);
    if (!run) {
      console.log("every run of this question is recorded");
      process.exit(0);
    }
    const built = build({ run, home: DEFAULT_HOME });
    try {
      const watchdog = expect.watchdog[run.arm];
      const stand = asThingsStand({ home: DEFAULT_HOME, cwd: built.cwd });
      const scoring = scoringDecided(firstSteps());
      if (!scoring.ok) {
        stand.refused.push(scoring.why);
        stand.says = `as things stand, a paid run would be refused:\n  - ${stand.refused.join("\n  - ")}`;
      }
      const sample = commandFor({ home: DEFAULT_HOME, claude: stand.claude, cwd: built.cwd, prompt: built.prompt, ...expect.lead, sessionId: "<a new id>", maxBudgetUsd: watchdog.usd_per_session, closed: built.closed });
      console.log(`next in the order: ${run.name}\nwould start, in ${built.cwd}:\n  ${sample.argv.map((arg) => (arg === built.prompt ? "<the prompt>" : /[\s(*]/.test(arg) ? `'${arg}'` : arg)).join(" ")}\nthe prompt: ${built.prompt.length} characters (${relativeToRoot(join(HOME, run.task, `prompt-${run.arm}.md`))}${run.arm === "E" ? ", with held-out/ inside the folder and closed to writing" : ""})\nthe watchdog: $${watchdog.usd_per_session.toFixed(2)} and ${watchdog.minutes_per_session} minutes\n${stand.says}\nnothing was started.`);
    } finally {
      rmSync(built.work, { recursive: true, force: true });
    }
    process.exit(0);
  }
  const allowed = spendFlags(flags);
  if (!allowed.ok) {
    console.error(`this script starts a paid model session, and will not without ${allowed.missing.join(" and ")}. Use --next to see what it would start.`);
    process.exit(64);
  }
  try {
    const named = flags.includes("--rerun") ? flags[flags.indexOf("--rerun") + 1] : null;
    if (flags.includes("--rerun") && (!named || named.startsWith("--"))) {
      console.error("--rerun names the run to make again, such as review-gate-2/E-1. Nothing was started.");
      process.exit(64);
    }
    const done = await runOne({ go: allowed.go, rerun: named });
    const held = done.score?.held_out;
    const scoreLine = held ? `held-out ${held.ran ? `${held.passed}/${held.cases}` : `not run (${held.reason})`} · tests ${done.score.tests.pass ? "pass" : "fail"} · outside scope ${done.score.scope.outside?.length ?? "?"}` : done.result.ended_by === "the harness" ? "not scored: the harness ended it" : `recorded and not scored: the scorer failed, and what went wrong is in the record. To score it from the tree the runner kept: node scripts/lib/roles-or-information-paid.mjs --score ${done.run.name}${named ? "-rerun" : ""}`;
    console.log(`${done.run.name} recorded in ${relativeToRoot(done.recordDir)}: ended by ${done.result.ended_by}; reported cost ${done.result.reported_cost_usd === null ? "unknown (counted at the ceiling)" : `$${done.result.reported_cost_usd.toFixed(4)}`}; ledger line ${done.result.ledger_n}\n${scoreLine}\nnext: ${done.next ? done.next.name : "none; every run is recorded"}`);
    if (done.tripwire) console.log(`\n${done.tripwire}`);
    process.exit(done.result.ended_by === "the harness" ? 2 : 0);
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}
