/**
 * One paid run of "a brake that binds" (experiments/brakes/budget/README.md is its pre-registration). THIS SCRIPT CAN
 * SPEND MONEY: it starts a model session. It refuses to without `--spend` and `--go "<the driver's words>"`, and
 * without them `--dry-run` builds everything, prints what would be started, and starts nothing.
 *
 *   node scripts/lib/brake-run-paid.mjs --form package --budget 2 --dry-run
 *   node scripts/lib/brake-run-paid.mjs --form package --budget 2 --spend --go "<the driver's words>"
 *   … --form package --budget 6 · --form prose --budget 2 · --form prose --budget 6
 *   … --rerun    only for a run whose first record is "invalid", once, on the driver's word (README, an invalid run)
 *
 * A run: the task in a folder of its own under the comparison profile's work folder, with the package compiled for
 * that budget (or, for prose, nothing but the task and the derived prompt); `check/` closed to commands and to the
 * file tools; one headless session under the watchdog. It is refused unless the first paid call's record says the
 * runs after it may be made. After the session the record is copied first, into
 * experiments/brakes/budget/runs/<form>-<budget>/. Then the runner measures, and nothing of the session's is ever
 * executed by it: the checksum of the session's check file (a plain file's bytes, never what a link points at), the
 * lines of out/rounds.txt, and the repository's own check run once more. Only then is the record counted and judged,
 * by scripts/lib/brake-count.mjs. Whatever a session left, the record is kept.
 *
 * Start a paid run from a terminal, not from a tool with a time limit of its own: a runner that is stopped ends its
 * session with it, and that run is then the harness's to answer for.
 */

import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { addCheckLines } from "./brake-count.mjs";
import { compileBoth } from "./brake-run.mjs";
import { commandFor, DEFAULT_HOME } from "./compare-profile.mjs";
import { asThingsStand, copyRecord, firstCallAllows, makeProject, NotStarted, plainLines, plainSha, relativeToRoot, runSession, setAside, spendFlags, unknownFlags, writeResult } from "./study-three-paid.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const experiment = join(root, "experiments", "brakes", "budget");
export const FORMS = ["package", "prose"];

/** Where a run's record goes, and whether one is already there. A second record is only ever the one rerun of an invalid run. */
export function recordFor({ form, budget, rerun, recordRoot = join(experiment, "runs") }) {
  const first = join(recordRoot, `${form}-${budget}`);
  const second = `${first}-rerun`;
  if (!existsSync(join(first, "result.json"))) return rerun ? { refuse: `${form}-${budget} has no first record to run again` } : { dir: first };
  if (!rerun) return { refuse: `${relativeToRoot(first)} is already recorded. A run is made once; only an invalid run is made again, once, with --rerun and the driver's word` };
  if (existsSync(join(second, "result.json"))) return { refuse: `${form}-${budget} was already run again once` };
  if (JSON.parse(readFileSync(join(first, "result.json"), "utf8")).ended_by !== "the harness") return { refuse: `${form}-${budget}'s first record was not ended by the harness, so it is not invalid and is not run again` };
  return { dir: second, rerun_of: relativeToRoot(first) };
}

/** Build one run's folder and prompt. Starts nothing. */
export function build({ form, budget, home, expect }) {
  const name = Object.entries(expect.budgets).find(([, value]) => value === budget)?.[0];
  if (!FORMS.includes(form) || !name) throw new Error(`a run is --form ${FORMS.join("|")} and --budget ${Object.values(expect.budgets).join("|")}`);
  const compiled = mkdtempSync(join(tmpdir(), "brake-paid-"));
  try {
    const packages = compileBoth(compiled, expect);
    const graphId = JSON.parse(readFileSync(join(experiment, "brake.grooph.json"), "utf8")).id;
    // Everything that is read is read before the session's folder is made: what fails after it would leave the folder behind.
    const prompt = form === "package" ? readFileSync(join(packages[name], ".grooph", graphId, "KICKOFF.md"), "utf8") : readFileSync(join(experiment, `prompt-prose-${budget}.md`), "utf8");
    const checkPath = expect.check_run.split(/\s+/).pop();
    const project = makeProject({
      home,
      name: JSON.parse(readFileSync(join(experiment, "task", "package.json"), "utf8")).name,
      fill: (cwd) => {
        cpSync(join(experiment, "task"), cwd, { recursive: true });
        if (form === "package") for (const part of [".grooph", ".claude"]) cpSync(join(packages[name], part), join(cwd, part), { recursive: true });
      },
    });
    return { ...project, prompt, graphId: form === "package" ? graphId : null, closed: [join(project.cwd, dirname(checkPath))], checkFile: join(project.cwd, ...checkPath.split("/")) };
  } finally {
    rmSync(compiled, { recursive: true, force: true });
  }
}

/**
 * What the runner measures after the session, itself, without executing anything a session could have written: the
 * checksum of the session's check file, the builder's own trace, and the repository's own check, run from the
 * repository. A file that is not a plain file of a sane size gives no number, and the judge then does not judge.
 */
export function afterTheSession({ cwd, checkFile, expect }) {
  const [program, ...args] = expect.check_run.split(/\s+/);
  const own = spawnSync(program, args, { cwd: join(experiment, "task"), encoding: "utf8" });
  const rounds = plainLines(join(cwd, "out", "rounds.txt"));
  return {
    final_check_exit: own.status,
    final_check_is: "the repository's own check, run from the repository; with the checksum below it says the session's copy still fails",
    check_file_sha256_after: plainSha(checkFile),
    rounds_file_lines: rounds.lines,
    ...(rounds.why ? { rounds_file: rounds.why } : {}),
  };
}

/** One run, start to record. Everything that could be injected for a test is a parameter; the command line passes none of them. */
export async function runBrake({ form, budget, go, rerun = false, home = DEFAULT_HOME, claude, ledgerPath, recordRoot, profileCheck, gameOpen, firstCallGate = firstCallAllows(), grace }) {
  const expect = JSON.parse(readFileSync(join(experiment, "expect.json"), "utf8"));
  if (!firstCallGate.ok) throw new NotStarted(firstCallGate.why);
  const record = recordFor({ form, budget, rerun, recordRoot });
  if (record.refuse) throw new NotStarted(record.refuse);
  const built = build({ form, budget, home, expect });
  let call;
  try {
    call = await runSession({ home, cwd: built.cwd, prompt: built.prompt, model: expect.lead.model, effort: expect.lead.effort, usd: expect.watchdog.usd_per_session, minutes: expect.watchdog.minutes_per_session, closed: built.closed, label: { project: "brake-budget", arm: form, replicate: rerun ? `${budget}-rerun` : budget }, note: `a brake that binds: ${form}, budget ${budget}${rerun ? ", the one rerun of an invalid run" : ""}`, go, claude, ledgerPath, harnessDir: built.harnessDir, profileCheck, gameOpen, grace });
  } catch (error) {
    // Only when nothing was started is the folder made for it taken away again. After a call, nothing is removed, whatever threw.
    if (error instanceof NotStarted) rmSync(built.work, { recursive: true, force: true });
    throw error;
  }
  // The record first. Then the runner's own measures, each of which may fail without stopping the rest.
  const copied = copyRecord({ home, cwd: built.cwd, base: built.base, gitDir: built.gitDir, call, recordDir: record.dir, prompt: built.prompt, graphId: built.graphId, annotate: (digest, resultsOf) => addCheckLines(digest, resultsOf, expect.check_line_begins) });
  let measured = {};
  try {
    measured = afterTheSession({ cwd: built.cwd, checkFile: built.checkFile, expect });
  } catch (error) {
    copied.problems.push(`the runner's own measures: ${error.message}`);
  }
  const result = writeResult(record.dir, call, { form, budget, check_run: expect.check_run, ...measured, rerun_of: record.rerun_of ?? null, transcripts: copied.transcripts, run_folders: copied.run_folders, run_folder_files_left_out: copied.left_out, problems: copied.problems, kept_out_of_the_record: copied.kept_out_of_the_record, pre_registration: "experiments/brakes/budget/README.md" });
  let kept = null;
  try {
    kept = setAside({ home, work: built.work, sessionId: call.session_id });
  } catch (error) {
    console.error(`the session's folder could not be moved aside (${error.message}); it is still at ${built.work}, and the next run is refused until it is moved`);
  }
  return { recordDir: record.dir, result, kept, tripwire: call.tripwire };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const flags = process.argv.slice(2);
  const unknown = unknownFlags(flags, { plain: ["--dry-run", "--spend", "--rerun"], valued: ["--form", "--budget", "--go"] });
  if (unknown.length > 0) {
    console.error(`${unknown.join(", ")}: not a flag of this script. Nothing was started.`);
    process.exit(64);
  }
  const value = (name) => (flags.includes(name) ? flags[flags.indexOf(name) + 1] : undefined);
  const form = value("--form");
  const budget = Number(value("--budget"));
  const expect = JSON.parse(readFileSync(join(experiment, "expect.json"), "utf8"));
  if (!FORMS.includes(form) || !Object.values(expect.budgets).includes(budget)) {
    console.error(`a run is --form ${FORMS.join("|")} and --budget ${Object.values(expect.budgets).join("|")}. Nothing was started.`);
    process.exit(64);
  }
  if (flags.includes("--dry-run")) {
    const built = build({ form, budget, home: DEFAULT_HOME, expect });
    try {
      const stand = asThingsStand({ home: DEFAULT_HOME, cwd: built.cwd });
      const sample = commandFor({ home: DEFAULT_HOME, claude: stand.claude, cwd: built.cwd, prompt: built.prompt, model: expect.lead.model, effort: expect.lead.effort, sessionId: "<a new id>", maxBudgetUsd: expect.watchdog.usd_per_session, closed: built.closed });
      console.log(`would start, in ${built.cwd}:\n  ${sample.argv.map((arg) => (arg === built.prompt ? "<the prompt>" : /[\s(*]/.test(arg) ? `'${arg}'` : arg)).join(" ")}\nthe prompt: ${built.prompt.length} characters (${form === "package" ? "the package's kickoff" : `prompt-prose-${budget}.md`})\nthe watchdog: $${expect.watchdog.usd_per_session.toFixed(2)} and ${expect.watchdog.minutes_per_session} minutes\nthe record would go to ${relativeToRoot(recordFor({ form, budget }).dir ?? "(already recorded)")}\n${stand.says}\nnothing was started.`);
    } finally {
      rmSync(built.work, { recursive: true, force: true });
    }
    process.exit(0);
  }
  const allowed = spendFlags(flags);
  if (!allowed.ok) {
    console.error(`this script starts a paid model session, and will not without ${allowed.missing.join(" and ")}. Use --dry-run to see what it would start.`);
    process.exit(64);
  }
  try {
    const done = await runBrake({ form, budget, go: allowed.go, rerun: flags.includes("--rerun") });
    console.log(`recorded in ${relativeToRoot(done.recordDir)}: ended by ${done.result.ended_by}; reported cost ${done.result.reported_cost_usd === null ? "unknown (counted at the ceiling)" : `$${done.result.reported_cost_usd.toFixed(4)}`}; ledger line ${done.result.ledger_n}\nthe session's folder and temp files were moved to ${done.kept}${done.result.problems.length > 0 ? `\nproblems keeping the record:\n  - ${done.result.problems.join("\n  - ")}` : ""}`);
    if (done.tripwire) console.log(`\n${done.tripwire}`);
    const judged = spawnSync(process.execPath, [join(root, "scripts", "lib", "brake-count.mjs"), done.recordDir], { encoding: "utf8" });
    console.log(`\n${judged.stdout}${judged.stderr}`);
    process.exit(judged.status ?? 2);
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}
