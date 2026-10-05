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
 * file tools; one headless session under the watchdog; then, by the runner and never by the session: the check run
 * once more, the check file's checksum, the lines of out/rounds.txt. The record is copied into
 * experiments/brakes/budget/runs/<form>-<budget>/ and only then counted and judged, by scripts/lib/brake-count.mjs.
 */

import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { addCheckLines, sha256Of } from "./brake-count.mjs";
import { compileBoth } from "./brake-run.mjs";
import { commandFor, DEFAULT_HOME } from "./compare-profile.mjs";
import { copyRecord, makeProject, relativeToRoot, runSession, setAside, spendFlags, writeResult } from "./study-three-paid.mjs";

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
    const project = makeProject({
      home,
      name: JSON.parse(readFileSync(join(experiment, "task", "package.json"), "utf8")).name,
      fill: (cwd) => {
        cpSync(join(experiment, "task"), cwd, { recursive: true });
        if (form === "package") for (const part of [".grooph", ".claude"]) cpSync(join(packages[name], part), join(cwd, part), { recursive: true });
      },
    });
    const prompt = form === "package" ? readFileSync(join(packages[name], ".grooph", graphId, "KICKOFF.md"), "utf8") : readFileSync(join(experiment, `prompt-prose-${budget}.md`), "utf8");
    const checkFolder = dirname(expect.check_run.split(/\s+/).pop());
    return { ...project, prompt, graphId: form === "package" ? graphId : null, closed: [join(project.cwd, checkFolder)], checkFile: join(project.cwd, ...expect.check_run.split(/\s+/).pop().split("/")) };
  } finally {
    rmSync(compiled, { recursive: true, force: true });
  }
}

/** What the runner measures after the session, itself: the check once more, its file's checksum, the builder's own trace. */
export function afterTheSession({ cwd, checkFile, expect }) {
  const [program, ...args] = expect.check_run.split(/\s+/);
  const final = spawnSync(program, args, { cwd, encoding: "utf8" });
  const rounds = join(cwd, "out", "rounds.txt");
  return {
    final_check_exit: final.status,
    check_file_sha256_after: existsSync(checkFile) ? sha256Of(checkFile) : "the check's file is gone",
    rounds_file_lines: existsSync(rounds) ? readFileSync(rounds, "utf8").split("\n").filter((line) => line.trim() !== "").length : 0,
  };
}

/** One run, start to record. Everything that could be injected for a test is a parameter; the command line passes none of them. */
export function runBrake({ form, budget, go, rerun = false, home = DEFAULT_HOME, claude, ledgerPath, recordRoot, profileCheck, gameOpen }) {
  const expect = JSON.parse(readFileSync(join(experiment, "expect.json"), "utf8"));
  const record = recordFor({ form, budget, rerun, recordRoot });
  if (record.refuse) throw new Error(`not started: ${record.refuse}`);
  const built = build({ form, budget, home, expect });
  let call;
  try {
    call = runSession({ home, cwd: built.cwd, prompt: built.prompt, model: expect.lead.model, effort: expect.lead.effort, usd: expect.watchdog.usd_per_session, minutes: expect.watchdog.minutes_per_session, closed: built.closed, label: { project: "brake-budget", arm: form, replicate: rerun ? `${budget}-rerun` : budget }, note: `a brake that binds: ${form}, budget ${budget}${rerun ? ", the one rerun of an invalid run" : ""}`, go, claude, ledgerPath, harnessDir: built.harnessDir, profileCheck, gameOpen });
  } catch (error) {
    // Nothing was started: the folder made for it is taken away again, so the work folder is empty for the next try.
    rmSync(built.work, { recursive: true, force: true });
    throw error;
  }
  const measured = afterTheSession({ cwd: built.cwd, checkFile: built.checkFile, expect });
  const copied = copyRecord({ home, cwd: built.cwd, base: built.base, call, recordDir: record.dir, prompt: built.prompt, graphId: built.graphId, annotate: (digest, resultsOf) => addCheckLines(digest, resultsOf, expect.check_line_begins) });
  const result = writeResult(record.dir, call, { form, budget, check_run: expect.check_run, ...measured, rerun_of: record.rerun_of ?? null, transcripts: copied.transcripts, run_folders: copied.run_folders, pre_registration: "experiments/brakes/budget/README.md" });
  const kept = setAside({ home, work: built.work, sessionId: call.session_id });
  return { recordDir: record.dir, result, kept, tripwire: call.tripwire };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const flags = process.argv.slice(2);
  const value = (name) => (flags.includes(name) ? flags[flags.indexOf(name) + 1] : undefined);
  const form = value("--form");
  const budget = Number(value("--budget"));
  const expect = JSON.parse(readFileSync(join(experiment, "expect.json"), "utf8"));
  if (flags.includes("--dry-run")) {
    const built = build({ form, budget, home: DEFAULT_HOME, expect });
    try {
      const sample = commandFor({ home: DEFAULT_HOME, claude: "claude", cwd: built.cwd, prompt: built.prompt, model: expect.lead.model, effort: expect.lead.effort, sessionId: "<a new id>", maxBudgetUsd: expect.watchdog.usd_per_session, closed: built.closed });
      console.log(`would start, in ${built.cwd}:\n  ${sample.argv.map((arg) => (arg === built.prompt ? "<the prompt>" : /[\s(*]/.test(arg) ? `'${arg}'` : arg)).join(" ")}\nthe prompt: ${built.prompt.length} characters (${form === "package" ? "the package's kickoff" : `prompt-prose-${budget}.md`})\nthe watchdog: $${expect.watchdog.usd_per_session.toFixed(2)} and ${expect.watchdog.minutes_per_session} minutes\nthe record would go to ${relativeToRoot(recordFor({ form, budget }).dir ?? "(already recorded)")}\nnothing was started.`);
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
    const done = runBrake({ form, budget, go: allowed.go, rerun: flags.includes("--rerun") });
    console.log(`recorded in ${relativeToRoot(done.recordDir)}: ended by ${done.result.ended_by}; reported cost ${done.result.reported_cost_usd === null ? "unknown (counted at the ceiling)" : `$${done.result.reported_cost_usd.toFixed(4)}`}; ledger line ${done.result.ledger_n}\nthe session's folder and temp files were moved to ${done.kept}`);
    if (done.tripwire) console.log(`\n${done.tripwire}`);
    const judged = spawnSync(process.execPath, [join(root, "scripts", "lib", "brake-count.mjs"), done.recordDir], { encoding: "utf8" });
    console.log(`\n${judged.stdout}${judged.stderr}`);
    process.exit(judged.status ?? 2);
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}
