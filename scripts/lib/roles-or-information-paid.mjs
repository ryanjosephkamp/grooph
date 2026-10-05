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
 */

import { cpSync, existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { reviewersFiles } from "./compare-arms-ef.mjs";
import { commandFor, DEFAULT_HOME } from "./compare-profile.mjs";
import { scoreTree } from "./compare-score.mjs";
import { copyRecord, makeProject, relativeToRoot, runSession, setAside, spendFlags, writeResult } from "./study-three-paid.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const comparisons = join(root, "experiments", "comparisons");
const HOME = join(comparisons, "roles-or-information");
export const expectation = () => JSON.parse(readFileSync(join(HOME, "expect.json"), "utf8"));

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
  const kept = readFileSync(join(HOME, run.task, `prompt-${run.arm}.md`), "utf8");
  const project = makeProject({
    home,
    name: JSON.parse(readFileSync(join(task, "task", "package.json"), "utf8")).name,
    fill: (cwd) => {
      cpSync(join(task, "task"), cwd, { recursive: true });
      // Arm E is given what a reviewer was given, inside its own folder: the profile lets no file tool read outside it.
      if (run.arm === "E") for (const name of reviewersFiles(run.task)) cpSync(join(task, "held-out", name), join(cwd, "held-out", name));
    },
  });
  if (run.arm === "F" && /held-out/i.test(kept)) throw new Error(`${run.name}: arm F's prompt names held-out material`);
  return { ...project, prompt: kept.replaceAll("<held-out>", "held-out"), closed: run.arm === "E" ? [join(project.cwd, "held-out")] : [] };
}

/** Study two's scorer on the final tree, from the repository's own suite. */
export function score({ run, cwd, call }) {
  const task = join(comparisons, run.task);
  const two = JSON.parse(readFileSync(join(task, "expect.json"), "utf8"));
  const slots = JSON.parse(readFileSync(join(task, "slots.json"), "utf8"));
  const ending = call.ended_by === "the session" ? { kind: "clean", reason: "the session ended itself" } : { kind: "cut-off", reason: `ended by ${call.ended_by}${call.which ? ` (${call.which})` : ""}` };
  // The copy of the held-out material arm E was given is not its work: what it did to that copy is recorded apart, not scored as scope.
  const files = (call.project_files_changed ?? []).filter((file) => !/(^|\s)held-out\//.test(file));
  const scored = scoreTree({ tree: cwd, heldOutDir: join(task, "held-out"), testCommand: two.test_command ?? slots.values["test-command"], allowed: two.scope.allowed, protectedPaths: two.scope.protected ?? [], files, ending, expectedCases: two.held_out_cases });
  scored.held_out.scored_from = `experiments/comparisons/${run.task}/held-out`;
  scored.held_out.the_sessions_copy_changed = (call.project_files_changed ?? []).filter((file) => /(^|\s)held-out\//.test(file));
  return scored;
}

/** What the recorded scores are read as, by the two pre-registered statements. A statement is undecided until every run it needs is recorded. */
export function readings(expect, recordRoot = HOME) {
  const scores = {};
  for (const run of order(expect)) {
    const path = join(recordRoot, run.task, `${run.arm}-${run.replicate}`, "score.json");
    const result = join(recordRoot, run.task, `${run.arm}-${run.replicate}`, "result.json");
    if (!existsSync(path) || !existsSync(result) || JSON.parse(readFileSync(result, "utf8")).ended_by !== "the session") continue;
    const held = JSON.parse(readFileSync(path, "utf8")).held_out;
    ((scores[run.task] ??= {})[run.arm] ??= []).push(held.ran ? held.passed : null);
  }
  const complete = expect.tasks.every((task) => ["E", "F"].every((arm) => (scores[task]?.[arm] ?? []).length === expect.replicates && scores[task][arm].every((n) => n !== null)));
  const two = expect.from_study_two;
  const fAbove = expect.tasks.filter((task) => (scores[task]?.F ?? []).length === expect.replicates && scores[task].F.every((n) => n !== null && n > two[task].the_task_alone));
  const information = complete ? expect.tasks.every((task) => scores[task].E.every((n) => n === two[task].held_out_cases) && scores[task].F.every((n) => n <= two[task].the_task_alone)) : null;
  return { scores, every_run_scored: complete, the_information_did_it: information, the_roles_did_some_of_it: complete ? fAbove.length >= 2 : fAbove.length >= 2 ? true : null, tasks_where_both_runs_of_F_are_above_the_task_alone: fAbove };
}

/** One run, start to record. */
export function runOne({ go, rerun = null, home = DEFAULT_HOME, claude, ledgerPath, recordRoot = HOME, profileCheck, gameOpen }) {
  const expect = expectation();
  let run = nextRun(expect, recordRoot);
  let recordDir = run ? join(recordRoot, run.task, `${run.arm}-${run.replicate}`) : null;
  if (rerun) {
    run = order(expect).find((candidate) => candidate.name === rerun);
    if (!run) throw new Error(`not started: ${rerun} is not a run of this question`);
    const first = join(recordRoot, run.task, `${run.arm}-${run.replicate}`);
    if (!existsSync(join(first, "result.json")) || JSON.parse(readFileSync(join(first, "result.json"), "utf8")).ended_by !== "the harness") throw new Error(`not started: ${rerun} has no invalid record to run again`);
    recordDir = `${first}-rerun`;
    if (existsSync(join(recordDir, "result.json"))) throw new Error(`not started: ${rerun} was already run again once`);
  }
  if (!run) throw new Error("not started: every run of this question is recorded");
  const built = build({ run, home });
  const watchdog = expect.watchdog[run.arm];
  let call;
  try {
    call = runSession({ home, cwd: built.cwd, prompt: built.prompt, ...expect.lead, usd: watchdog.usd_per_session, minutes: watchdog.minutes_per_session, closed: built.closed, label: { project: `roles-or-information/${run.task}`, arm: run.arm, replicate: rerun ? `${run.replicate}-rerun` : run.replicate }, note: `roles or information: ${expect.arms[run.arm].split(":")[0]}${rerun ? "; the one rerun of an invalid run" : ""}`, go, claude, ledgerPath, harnessDir: built.harnessDir, profileCheck, gameOpen });
  } catch (error) {
    rmSync(built.work, { recursive: true, force: true });
    throw error;
  }
  const copied = copyRecord({ home, cwd: built.cwd, base: built.base, call, recordDir, prompt: built.prompt, excludes: [] });
  const scored = score({ run, cwd: built.cwd, call });
  writeFileSync(join(recordDir, "score.json"), `${JSON.stringify(scored, null, 2)}\n`, "utf8");
  const result = writeResult(recordDir, call, { run: run.name, task: run.task, arm: run.arm, replicate: run.replicate, rerun_of: rerun ? run.name : null, held_out_given: run.arm === "E" ? reviewersFiles(run.task) : [], transcripts: copied.transcripts, pre_registration: "experiments/comparisons/roles-or-information/README.md" });
  const kept = setAside({ home, work: built.work, sessionId: call.session_id });
  return { run, recordDir, result, score: scored, kept, tripwire: call.tripwire, next: nextRun(expect, recordRoot) };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const flags = process.argv.slice(2);
  const expect = expectation();
  if (flags.includes("--readings")) {
    console.log(JSON.stringify(readings(expect), null, 2));
    process.exit(0);
  }
  if (flags.includes("--next")) {
    const run = nextRun(expect);
    if (!run) {
      console.log("every run of this question is recorded");
      process.exit(0);
    }
    const built = build({ run, home: DEFAULT_HOME });
    try {
      const watchdog = expect.watchdog[run.arm];
      const sample = commandFor({ home: DEFAULT_HOME, claude: "claude", cwd: built.cwd, prompt: built.prompt, ...expect.lead, sessionId: "<a new id>", maxBudgetUsd: watchdog.usd_per_session, closed: built.closed });
      console.log(`next in the order: ${run.name}\nwould start, in ${built.cwd}:\n  ${sample.argv.map((arg) => (arg === built.prompt ? "<the prompt>" : /[\s(*]/.test(arg) ? `'${arg}'` : arg)).join(" ")}\nthe prompt: ${built.prompt.length} characters (${relativeToRoot(join(HOME, run.task, `prompt-${run.arm}.md`))}${run.arm === "E" ? ", with held-out/ inside the folder and closed to writing" : ""})\nthe watchdog: $${watchdog.usd_per_session.toFixed(2)} and ${watchdog.minutes_per_session} minutes\nnothing was started.`);
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
    const done = runOne({ go: allowed.go, rerun: flags.includes("--rerun") ? flags[flags.indexOf("--rerun") + 1] : null });
    const held = done.score.held_out;
    console.log(`${done.run.name} recorded in ${relativeToRoot(done.recordDir)}: ended by ${done.result.ended_by}; reported cost ${done.result.reported_cost_usd === null ? "unknown (counted at the ceiling)" : `$${done.result.reported_cost_usd.toFixed(4)}`}; ledger line ${done.result.ledger_n}\nheld-out ${held.ran ? `${held.passed}/${held.cases}` : `not run (${held.reason})`} · tests ${done.score.tests.pass ? "pass" : "fail"} · outside scope ${done.score.scope.outside?.length ?? "?"}\nnext: ${done.next ? done.next.name : "none; every run is recorded"}`);
    if (done.tripwire) console.log(`\n${done.tripwire}`);
    process.exit(done.result.ended_by === "the harness" ? 2 : 0);
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}
