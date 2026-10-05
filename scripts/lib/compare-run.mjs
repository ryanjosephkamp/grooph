/**
 * The paired-comparison runner (handoffs 0016 and 0019; protocol
 * docs/comparisons.md, version 2). Entry point: scripts/compare.sh, which documents the usage.
 *
 * Four arms on one project, under identical conditions (§2); study one (protocol
 * version 1) ran the first three:
 *
 *   A  the template's package, headless, as scripts/prove-pattern.sh runs a
 *      proving run: the same scratch build, settings, invocation, evidence copy
 *      and check (their functions are imported from prove-pattern.mjs);
 *   B  the derived prompt (compare-prompt.mjs) in one headless session, in the
 *      same scratch with the package removed;
 *   C  the derived prompt in a fresh headless session up to N times, N the
 *      loop's round cap, each iteration told to continue from the working tree;
 *      the loop ends early when the reply's last line says done and the test
 *      command passes;
 *   D  (version 2) the task, its acceptance material and the test command in
 *      one headless session: no roles, routing, loop or briefs. Its prompt is
 *      written from the task folder alone (compare-prompt.mjs `deriveD`), its
 *      scratch never held the package, and the held-out suite is named to
 *      nobody: no copy of it is anywhere near the run.
 *
 * What a session can learn of where it is (version 2). A session is shown its
 * working folder's path, its repository's user and its last commits, and it can
 * list the folder above its own. So a version-2 scratch is named after the
 * task's own package, sits alone in a folder of its own under the runner's work
 * root, and has one commit, "initial commit", by a neutral user; in B, C and D
 * that commit never held the package. The work root is the runner's alone:
 * every run starts with it empty and, once its evidence is in the repository,
 * leaves it empty, so no run can find another's tree or held-out copy beside
 * it. The scorer runs the held-out suite from the repository, never from a copy
 * a run could reach.
 *
 * Every arm: the lead's model and effort pinned on the command line, the
 * proving allowlist (plus `Read` on the held-out folder in A, B and C),
 * `--strict-mcp-config`, one dollar ceiling per invocation from the comparisons
 * ledger, an isolated scratch per run built from the committed task folder. The
 * scorer (compare-score.mjs) runs on the final tree; the result, the diff, the
 * harness output and (for A) the run record go to
 * experiments/comparisons/<project>/<arm>-<replicate>/. Wall time is the
 * runner's clock in every arm (`wall_s`).
 *
 * Models (PROTOCOLS below). Study one ran its lead on `claude-opus-5` and its
 * judge on `claude-fable-5-1`; it is finished, and the runner makes no new call
 * for a version-1 project. Version 2 runs lead and judge on `claude-opus-5-5`,
 * and every package is exported with a tier map (`GROOPH_MODELS`, slice 0079)
 * that the project pre-registers in expect.json `tier_map`, so no tier falls
 * back to the target's own. No call of this runner uses Fable: a tier map that
 * names it is refused, and a run that reports it is recorded and flagged.
 *
 * The blind judge (§6): one call with no tools, given the task, the acceptance
 * material the builder saw, and each run's deliverable diff (and, when the
 * project names one, the artifact the runner rendered from the run's final
 * tree) under a random letter in random order; the letters' mapping is written
 * beside the verdict and applied only by compare-summary.mjs.
 */

import { spawnSync } from "node:child_process";
import { closeSync, cpSync, existsSync, lstatSync, mkdirSync, mkdtempSync, openSync, readFileSync, readdirSync, realpathSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { checkRun } from "./prove-check.mjs";
import { digestTranscripts, projectDiff, readNotes, redactHome, runFolders, sessionTranscripts, sha256 } from "./prove-evidence.mjs";
import { ALIAS_ENV, BASE_SETTINGS, HELD_OUT_TOKEN, NEVER, Refusal, agentModels, assertFreshBundle, buildScratch, claudeSignedIn, cleanEnv, collect, fail, finishResult, neverUsed, run, say } from "./prove-pattern.mjs";
import { amendEntry, describe, gate, loadLedger, openRunEntry, reload, saveLedger, totals, tripwireNotice } from "./compare-ledger.mjs";
import { DONE_LINE, derive, deriveD, iterationPrompt, loopScript, readPackage, roundCap, saysDone } from "./compare-prompt.mjs";
import { scoreTree } from "./compare-score.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const CLI = join(root, "packages", "cli", "bin", "grooph.js");
const CORE = join(root, "packages", "core", "dist", "src", "index.js");
export const COMPARISONS = join(root, "experiments", "comparisons");
const HOME = process.env.HOME ?? "";
const CLAUDE_DIR = process.env.CLAUDE_CONFIG_DIR ?? join(HOME, ".claude");
const RUN_TIMEOUT_MS = 60 * 60 * 1000;

/**
 * What each protocol version fixes: its arms, and the models of the lead (equal across arms, §2, pinned on the
 * command line so the record can say so) and of the blind judge (no tools). Version 1 is study one as it ran; it is
 * closed, so its models are a record and are never called again. Version 2 is study two (handoff 0019).
 */
export const PROTOCOLS = {
  1: { study: 1, arms: ["A", "B", "C"], lead_model: "claude-opus-5", judge_model: "claude-fable-5-1", closed: true },
  2: { study: 2, arms: ["A", "B", "C", "D"], lead_model: "claude-opus-5-5", judge_model: "claude-opus-5-5", closed: false },
};
export const LEAD_EFFORT = "high";
/** Every arm any version has, for reading the command line and the run folders. */
export const ARMS = ["A", "B", "C", "D"];
export const TIERS = ["frontier", "strong", "fast"];
/** Never Fable, never Astra: not a lead, a subagent, a judge or a tier (the owner's rule, 2026-10-04). The pattern is the proving runner's. */
export { NEVER, neverUsed };

// ── the runner's work root (version 2) ───────────────────────────────────

/**
 * Where version-2 scratch projects are built: one folder under the temp directory that is the runner's alone, each run
 * in a folder of its own inside it. Its name says nothing of the tool or the study, because a session sees the path.
 * An empty TMPDIR is no temp directory, and the path is made absolute, so the root can never be a folder of the
 * repository or of wherever the command was run from.
 */
export const workRoot = () => join(resolve(process.env.TMPDIR || tmpdir()), "wk");
const WORK_MARK = ".keep";

/** What an earlier run left in the work root: the folders of runs that did not finish (a finished run removes its own). */
export function leftovers(root = workRoot()) {
  return existsSync(root) ? readdirSync(root).filter((name) => name !== WORK_MARK).map((name) => join(root, name)) : [];
}

/**
 * The run that holds the work root now, if one does: the mark carries the process id of the runner that opened it,
 * and a process that still answers is a run in progress, not a leftover. (A model call is one of this runner's own
 * child processes, so while the runner lives its run lives.)
 */
export function liveRun(root = workRoot()) {
  try {
    const pid = Number(JSON.parse(readFileSync(join(root, WORK_MARK), "utf8") || "{}").pid);
    if (!Number.isInteger(pid) || pid <= 0 || pid === process.pid) return null;
    process.kill(pid, 0);
    return pid;
  } catch (error) {
    return error?.code === "EPERM" ? -1 : null;
  }
}

/** The root is the runner's when it is a real folder (not a link to one) that the runner marked, or one with nothing in it yet. */
function assertOwnRoot(root) {
  if (!existsSync(root)) return;
  if (lstatSync(root).isSymbolicLink()) fail(`${root} is a link to another folder: the runner builds, and clears, only in a folder of its own`);
  if (!existsSync(join(root, WORK_MARK)) && readdirSync(root).length > 0) fail(`${root} exists, holds something, and is not the runner's (it has no ${WORK_MARK}): the runner builds only in a folder it made`);
}

const liveText = (pid) => `a run is in progress in the work root (${pid > 0 ? `runner process ${pid}` : "a runner this user may not signal"}): one run at a time, and nothing of a live run is cleared`;

/** A fresh folder for one run, in a work root that holds nothing else. */
function openWork() {
  const root = workRoot();
  if (/grooph|compar/i.test(root)) fail(`the work root ${root} would put the tool's or the study's name in every session's path: point TMPDIR elsewhere`);
  assertOwnRoot(root);
  const live = liveRun(root);
  if (live) fail(liveText(live));
  const left = leftovers(root);
  if (left.length > 0) fail(`the work root still holds ${left.length} folder(s) from a run that did not finish:\n${left.map((path) => `  ${path}`).join("\n")}\nA later run could read what is in them. What could be saved of a paid run is already in its project's folder as <arm>-<n>-failed-<k>/; look, then clear them with scripts/compare.sh --clear-work`);
  mkdirSync(root, { recursive: true });
  writeFileSync(join(root, WORK_MARK), `${JSON.stringify({ pid: process.pid })}\n`, "utf8");
  return mkdtempSync(join(root, "/"));
}

/** `--clear-work`: remove what unfinished runs left in the work root, and say what went. Only that folder, only when it is the runner's, and never under a run that is alive. */
function clearWork() {
  const root = workRoot();
  if (!existsSync(root)) return console.log(`${root} does not exist: nothing to clear`) ?? 0;
  assertOwnRoot(root);
  if (!existsSync(join(root, WORK_MARK))) return console.log(`${root} is empty: nothing to clear`) ?? 0;
  const live = liveRun(root);
  if (live) fail(`${liveText(live)}; nothing was removed`);
  const running = loadLedger().invocations.filter((entry) => entry.status === "running");
  if (running.length > 0) fail(`ledger invocation ${running.map((e) => e.n).join(", ")} is marked running: if that run is dead, settle its line first (compare-ledger.mjs settle), then clear; nothing was removed`);
  const left = leftovers(root);
  for (const path of left) {
    rmSync(path, { recursive: true, force: true });
    console.log(`removed ${path}`);
  }
  writeFileSync(join(root, WORK_MARK), "", "utf8");
  console.log(left.length === 0 ? `${root} was already empty` : `${root} is empty`);
  return 0;
}

// ── what a session's environment holds of the tool ───────────────────────

/** PATH without any folder that holds the tool's command: what arms B, C and D, and the judge, are given. */
export function pathWithoutTool(path = process.env.PATH ?? "") {
  return path.split(delimiter).filter((dir) => dir && !existsSync(join(dir, "grooph"))).join(delimiter);
}

/** Is the tool's command reachable on a PATH? Measured, for the record, from the very PATH a session is given. */
export const toolOnPath = (path) => path.split(delimiter).some((dir) => dir && existsSync(join(dir, "grooph")));

/** `claude` by its full path, found on the runner's own PATH: a session's PATH may no longer hold its folder. */
function claudeCommand() {
  for (const dir of (process.env.PATH ?? "").split(delimiter)) if (dir && existsSync(join(dir, "claude"))) return join(dir, "claude");
  return fail("claude is not on PATH; install Claude Code first");
}

/**
 * The environment of one session. In B, C and D, and for the judge, no folder on PATH holds the tool's command; in A
 * the run's own `tools` folder comes first. The aliases mean what the record says. TMPDIR is a folder of the run's
 * own, so `$TMPDIR` shows a session nothing of any other run.
 */
function sessionEnv({ arm, binDir, tmp }) {
  const bare = pathWithoutTool();
  const path = arm === "A" ? `${binDir}${delimiter}${bare}` : bare;
  return { env: cleanEnv(path, { ...ALIAS_ENV, ...(tmp ? { TMPDIR: tmp } : {}) }), path, tool_on_path: toolOnPath(path) };
}

/** True once a model has been called in this process: from then on a run's folder holds something worth keeping. */
let modelCalled = false;

// ── the tier map ─────────────────────────────────────────────────────────// ── the tier map ─────────────────────────────────────────────────────────

/** `frontier=a,strong=b,fast=c` → { frontier, strong, fast }; null when the text is empty. Throws on anything else. */
export function parseTierMap(text) {
  if (text === undefined || text === null || String(text).trim() === "") return null;
  const map = {};
  for (const part of String(text).split(",").map((p) => p.trim()).filter(Boolean)) {
    const at = part.indexOf("=");
    const tier = at < 0 ? part : part.slice(0, at).trim();
    const model = at < 0 ? "" : part.slice(at + 1).trim();
    if (!TIERS.includes(tier)) throw new Error(`"${tier}" is not a tier; the tiers are ${TIERS.join(", ")}`);
    if (!model) throw new Error(`the tier ${tier} needs a model name`);
    if (tier in map) throw new Error(`the tier ${tier} is named twice`);
    map[tier] = model;
  }
  return map;
}

export const tierMapText = (map) => TIERS.filter((tier) => map[tier] !== undefined).map((tier) => `${tier}=${map[tier]}`).join(",");

/**
 * The tier map a version-2 project runs under, and where it came from. The project's pre-registration names it
 * (expect.json `tier_map`); until it does, a dry run or a derivation may take one from GROOPH_MODELS so everything
 * up to the first paid run can be built, and a paid run is refused. The environment may repeat the pre-registered
 * map but not contradict it. Every tier is named, so none falls back to the target's own, and none is a model this
 * study never uses.
 */
export function resolveTierMap({ registered, envText, paid }) {
  let fromEnv;
  try {
    fromEnv = parseTierMap(envText);
  } catch (error) {
    return { error: `GROOPH_MODELS: ${error.message}` };
  }
  const check = (map, from) => {
    const missing = TIERS.filter((tier) => !map[tier]);
    if (missing.length > 0) return `${from} must name every tier, so none falls back to the target's own: ${missing.join(", ")} missing`;
    const never = TIERS.filter((tier) => NEVER.test(map[tier]));
    if (never.length > 0) return `${from} names a model this study never uses: ${never.map((tier) => `${tier}=${map[tier]}`).join(", ")}`;
    return null;
  };
  if (registered) {
    const bad = check(registered, "expect.json tier_map");
    if (bad) return { error: bad };
    if (fromEnv && tierMapText(fromEnv) !== tierMapText(registered)) return { error: `GROOPH_MODELS (${tierMapText(fromEnv)}) differs from the pre-registered tier map (${tierMapText(registered)}): unset it, or pre-register the change before any run` };
    return { map: registered, text: tierMapText(registered), source: "expect.json tier_map (pre-registered)", provisional: false };
  }
  if (paid) return { error: 'the tier map is not pre-registered: expect.json "tier_map" is null. Name it (frontier, strong, fast), re-run --derive, and commit both before the first paid run' };
  if (!fromEnv) return { error: 'the tier map is not pre-registered yet (expect.json "tier_map" is null): for a dry run or a derivation, pass one in the environment, GROOPH_MODELS=frontier=…,strong=…,fast=…' };
  const bad = check(fromEnv, "GROOPH_MODELS");
  if (bad) return { error: bad };
  return { map: fromEnv, text: tierMapText(fromEnv), source: "GROOPH_MODELS (provisional: the project has not pre-registered a tier map)", provisional: true };
}

// ── arguments ────────────────────────────────────────────────────────────
function parseArgs(argv) {
  const args = { project: undefined, arm: undefined, replicate: undefined, retry: undefined, dryRun: false, status: false, derive: false, judge: false, next: false, score: undefined, write: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--dry-run") args.dryRun = true;
    else if (arg === "--status") args.status = true;
    else if (arg === "--clear-work") args.clearWork = true;
    else if (arg === "--derive") args.derive = true;
    else if (arg === "--judge") args.judge = true;
    else if (arg === "--next") args.next = true;
    else if (arg === "--write") args.write = true;
    else if (arg === "--replicate") args.replicate = Number(argv[++i] ?? fail("--replicate needs a number"));
    else if (arg === "--retry") args.retry = argv[++i] ?? fail('--retry needs the reason: --retry "sign-in expired"');
    else if (arg === "--score") args.score = argv[++i] ?? fail("--score needs a run folder");
    else if (arg.startsWith("-")) fail(`unknown argument: ${arg}`);
    else if (!args.project) args.project = arg;
    else if (!args.arm && ARMS.includes(arg.toUpperCase())) args.arm = arg.toUpperCase();
    else fail(`unexpected argument: ${arg}`);
  }
  return args;
}

// ── the project ──────────────────────────────────────────────────────────
export function loadProject(project) {
  const dir = join(COMPARISONS, project);
  for (const need of ["task", "slots.json", "expect.json", "README.md"]) {
    if (!existsSync(join(dir, need))) fail(`experiments/comparisons/${project}/${need} is missing`);
  }
  const slots = JSON.parse(readFileSync(join(dir, "slots.json"), "utf8"));
  const expect = JSON.parse(readFileSync(join(dir, "expect.json"), "utf8"));
  const template = expect.template ?? project;
  if (typeof slots.name !== "string" || typeof slots.values !== "object") fail(`${project}/slots.json needs { "name", "values" }`);
  if (!expect.bet || !expect.loses_if) fail(`${project}/expect.json needs the pre-registration fields "bet" and "loses_if" (protocol §7) before any run`);
  if (!Array.isArray(expect.scope?.allowed)) fail(`${project}/expect.json needs "scope": { "allowed": [...] } for the scorer`);
  const readme = readFileSync(join(dir, "README.md"), "utf8");
  if (!/^## (Pre-registration|Pre-registered)/m.test(readme)) fail(`${project}/README.md needs a "## Pre-registration" section before any run (protocol §7)`);
  const heldOutDir = join(dir, "held-out");
  const heldOut = existsSync(heldOutDir) ? heldOutDir : null;
  const protocol = expect.protocol ?? 1;
  const version = PROTOCOLS[protocol] ?? fail(`${project}/expect.json names protocol ${protocol}; the runner knows ${Object.keys(PROTOCOLS).join(" and ")}`);
  const testCommand = expect.test_command ?? slots.values["test-command"];
  if (typeof testCommand !== "string" || testCommand.trim() === "") fail(`${project} names no test command: slots.json "test-command", or expect.json "test_command" when the template has no such slot`);
  const proj = { project, dir, template, slots, expect, fragment: false, heldOut, replicates: expect.replicates ?? 2, testCommand, protocol, study: version.study, arms: version.arms, leadModel: version.lead_model, judgeModel: version.judge_model, closed: version.closed, acceptance: expect.acceptance ?? expect.judge?.acceptance ?? [] };
  if (protocol >= 2) assertVersionTwo(proj);
  return proj;
}

/** What protocol version 2 asks of a project before any run (§4, §7), checked from its files. */
function assertVersionTwo(proj) {
  const { project, expect, slots, dir } = proj;
  const p = expect.round0_pass_probability;
  if (typeof p !== "number" || !(p >= 0 && p <= 1) || !expect.round0_why) fail(`${project}/expect.json needs "round0_pass_probability" (0 to 1) and "round0_why": the expected chance that a strong builder passes the held-out suite at round 0, and why the task should not (protocol §7)`);
  if (!proj.heldOut || readdirSync(proj.heldOut).filter((name) => name.endsWith(".test.mjs")).length === 0) fail(`${project} needs a held-out suite the scorer runs: held-out/*.test.mjs (protocol §4)`);
  if (!Array.isArray(expect.acceptance) || expect.acceptance.length === 0) fail(`${project}/expect.json needs "acceptance": the files of the task folder that say what the result must satisfy (arm D's prompt and the judge name them)`);
  for (const path of expect.acceptance) if (!existsSync(join(dir, "task", path))) fail(`${project}/expect.json "acceptance" names ${path}, which is not in task/`);
  if (!("tier_map" in expect)) fail(`${project}/expect.json needs the field "tier_map": { frontier, strong, fast }, or null until it is named (no paid run starts on null)`);
  if (expect.resume) fail(`${project}/expect.json names a scripted gate answer; protocol version 2 gives none`);
  for (const name of expect.held_out_scorer_only ?? []) if (!existsSync(join(proj.heldOut, name))) fail(`${project}/expect.json "held_out_scorer_only" names ${name}, which is not in held-out/`);
  if (expect.models && (expect.models.lead !== proj.leadModel || expect.models.judge !== proj.judgeModel || expect.models.lead_effort !== LEAD_EFFORT)) fail(`${project}/expect.json "models" (${JSON.stringify(expect.models)}) is not what protocol version ${proj.protocol} runs: lead ${proj.leadModel} at effort ${LEAD_EFFORT}, judge ${proj.judgeModel}`);
  // Task files never name the tool, and never the held-out folder: the tree is the same in every arm, and arm D is told nothing of the suite.
  const named = [];
  const walk = (at) => {
    for (const name of readdirSync(at, { withFileTypes: true })) {
      const full = join(at, name.name);
      if (name.isDirectory()) walk(full);
      else if (/\.(md|json|mjs|js|txt|cjs|ts|csv)$/i.test(name.name)) {
        const text = readFileSync(full, "utf8");
        if (text.includes(HELD_OUT_TOKEN) || /held-out/i.test(text)) named.push(`${full.slice(dir.length + 1)} (the held-out suite)`);
        if (/grooph/i.test(text)) named.push(`${full.slice(dir.length + 1)} (the tool)`);
      }
    }
  };
  walk(join(dir, "task"));
  if (named.length > 0) fail(`${project}: a task file names what protocol version 2 keeps out of the task folder: ${named.join(", ")}`);
  const task = String(slots.values.task ?? "");
  if (task.includes(HELD_OUT_TOKEN) || /grooph/i.test(task)) fail(`${project}/slots.json: the task text goes to every arm as written, so it names neither the held-out folder nor the tool`);
}

/** The run folders a project has: { "A-1": path, … }. */
export function runDirs(projectDir) {
  const out = {};
  for (const name of readdirSync(projectDir)) {
    if (/^[ABCD]-\d+$/.test(name) && existsSync(join(projectDir, name, "result.json"))) out[name] = join(projectDir, name);
  }
  return out;
}

/** The alternation over the project's arms (§5): A1 B1 C1 A2 B2 C2 in version 1, A1 B1 C1 D1 A2 B2 C2 D2 in version 2. The next run not yet on disk. */
export function nextRun(proj) {
  const have = runDirs(proj.dir);
  for (let r = 1; r <= proj.replicates; r += 1) {
    for (const arm of proj.arms ?? PROTOCOLS[1].arms) if (!have[`${arm}-${r}`]) return { arm, replicate: r };
  }
  return null;
}

// ── the scratch project per arm ──────────────────────────────────────────

/** Who made a version-2 scratch's one commit, and what it says: nothing of the tool, the study or the arm. */
const NEUTRAL_COMMIT = { name: "dev", email: "dev@localhost", message: "initial commit" };

/**
 * Build the scratch as the proving runner does (task, held-out beside it, the package exported, one commit), in a
 * folder of its own under the work root. Arm A runs on that. For B and C the prompt is derived from that very
 * package; for D it is written from the task folder. Then, for B, C and D, the package is taken out and the
 * repository is made again from what is left, so its one commit never held the package: a session is shown its
 * repository's last commits, and `git show` would otherwise hand it the whole design.
 *
 * The held-out folder beside the scratch is a copy for a reviewer to read. In D there is none. In A, B and C a file
 * that is the scorer's alone (expect.json `held_out_scorer_only`) is taken out of it. The scorer never uses the copy:
 * it runs the suite from the project's own held-out folder in the repository.
 */
function buildFor(proj, arm) {
  // The package is exported with the project's tier map: buildScratch hands the environment to `grooph export`.
  if (proj.tierMap) process.env.GROOPH_MODELS = proj.tierMap.text;
  const work = openWork();
  try {
    return buildIn(work, proj, arm);
  } catch (error) {
    // Nothing was run: a build that fails leaves nothing behind for a later run to find.
    rmSync(work, { recursive: true, force: true });
    throw error;
  }
}

function buildIn(work, proj, arm) {
  const built = buildScratch(proj.template, proj, join(work, `${JSON.parse(readFileSync(join(proj.dir, "task", "package.json"), "utf8")).name}-`), NEUTRAL_COMMIT);
  built.work = work;
  built.arm = arm;
  // A folder of the run's own for whatever a session writes to $TMPDIR, so that path shows it nothing of any other run.
  built.tmp = join(work, "tmp");
  mkdirSync(built.tmp);
  for (const path of [built.scratch, realpathSync(built.scratch)]) if (/grooph|compar/i.test(path)) fail(`${proj.project}: the scratch folder's path (${path}) names the tool or the study, and a session sees its path`);
  if (built.substituted.length > 0) fail(`${proj.project}: the held-out folder's path reached a task file (${built.substituted.join(", ")}); in protocol version 2 only a slot value names it`);
  if (proj.tierMap && !built.exportOutput.includes(`Named by GROOPH_MODELS`)) fail(`grooph export did not report the tier map it was given; is the CLI built from this branch (slice 0079)?`);
  // The package itself is read, whatever the map said: no agent file names a model this study never uses (a pin on a node would win over the map).
  built.agentModels = agentModels(built.scratch, built.graphId);
  const never = Object.entries(built.agentModels).filter(([, model]) => NEVER.test(model));
  if (never.length > 0) fail(`${proj.project}: the package would run ${never.map(([agent, model]) => `${agent.split("--").pop()} on ${model}`).join(", ")}, a model this study never uses`);
  const pkg = readPackage(built.scratch);
  const derived = derive(pkg, { heldOut: built.heldOut?.realDir });
  const n = roundCap(pkg.doc);
  const kickoff = pkg.kickoff;
  built.scoreDir = proj.heldOut;

  if (arm !== "A") {
    for (const gone of [".grooph", ".claude", ".git"]) rmSync(join(built.scratch, gone), { recursive: true, force: true });
    run("git", ["-C", built.scratch, "init", "-q"]);
    run("git", ["-C", built.scratch, "config", "user.email", NEUTRAL_COMMIT.email]);
    run("git", ["-C", built.scratch, "config", "user.name", NEUTRAL_COMMIT.name]);
    run("git", ["-C", built.scratch, "add", "-A"]);
    run("git", ["-C", built.scratch, "commit", "-qm", NEUTRAL_COMMIT.message]);
    built.base = run("git", ["-C", built.scratch, "rev-parse", "HEAD"]).stdout.trim();
  }
  const scorerOnly = (proj.expect.held_out_scorer_only ?? []).filter((name) => built.heldOut && existsSync(join(built.heldOut.dir, name)));
  if (arm !== "D") {
    for (const name of scorerOnly) rmSync(join(built.heldOut.dir, name));
    if (built.heldOut) built.heldOut = { ...built.heldOut, scorer_only: scorerOnly, files: built.heldOut.files.map((file) => ({ ...file, at_run: !scorerOnly.includes(file.path) })) };
    return { ...built, pkg, prompt: derived.prompt, derivation: derived.report, promptFile: "prompt-B.md", n, kickoff };
  }

  // Arm D: the held-out suite is named to nobody. The reviewer's copy is removed, no rule allows reading anything
  // outside the project, and the prompt is written from the task folder alone.
  const marks = [HELD_OUT_TOKEN, built.heldOut?.dir, built.heldOut?.realDir, "held-out"].filter(Boolean);
  if (built.heldOut) {
    rmSync(built.heldOut.dir, { recursive: true, force: true });
    built.heldOut = { ...built.heldOut, dir: null, realDir: null, named_to: "nobody", beside_scratch_during_run: false, scorer_only: scorerOnly, files: built.heldOut.files.map((file) => ({ ...file, at_run: false })) };
  }
  built.settings = BASE_SETTINGS;
  const d = deriveD({ task: proj.slots.values.task, testCommand: proj.testCommand, acceptance: proj.acceptance, heldOutMarks: marks });
  return { ...built, pkg, prompt: d.prompt, derivation: d.report, promptFile: "prompt-D.md", n: 1, kickoff };
}

/** The reviewer's copy of the held-out folder after a run: which of its files the run changed, added or removed. */
function heldOutChanges(built) {
  if (!built.heldOut?.dir) return [];
  const before = Object.fromEntries(built.heldOut.files.filter((file) => file.at_run !== false).map((file) => [file.path, file.sha256]));
  const now = existsSync(built.heldOut.dir) ? readdirSync(built.heldOut.dir).sort() : [];
  const changed = [];
  for (const name of new Set([...Object.keys(before), ...now])) {
    const path = join(built.heldOut.dir, name);
    if (!now.includes(name)) changed.push(`${name} (removed)`);
    else if (!(name in before)) changed.push(`${name} (added)`);
    else if (sha256(path) !== before[name]) changed.push(`${name} (changed)`);
  }
  return changed;
}

/** A run is over: its evidence is in the repository, or it never called a model. Its folder under the work root goes. */
function closeWork(built) {
  if (!built?.work || !built.work.startsWith(`${workRoot()}/`)) return;
  rmSync(built.work, { recursive: true, force: true });
  if (existsSync(join(workRoot(), WORK_MARK))) writeFileSync(join(workRoot(), WORK_MARK), "", "utf8");
}

/**
 * A run broke after a model was called. Before its folder is left for someone to look at (and, in the end, to clear),
 * what it holds that exists nowhere else is copied into the project as `<arm>-<n>-failed-<k>/`: the harness's output
 * and stderr, the diff of the tree against its base, and a line saying what happened. A partial evidence folder is
 * moved there too. A failed folder is not a run: the tables do not read it and a retry does not overwrite it.
 */
function salvage({ proj, built, arm, replicate, evidenceDir, error }) {
  try {
    const k = readdirSync(proj.dir).filter((n) => n.startsWith(`${arm}-${replicate}-failed`)).length + 1;
    const dest = join(proj.dir, `${arm}-${replicate}-failed-${k}`);
    if (existsSync(evidenceDir) && readdirSync(evidenceDir).length > 0) renameSync(evidenceDir, dest);
    else mkdirSync(dest, { recursive: true });
    for (const name of existsSync(built.harnessDir) ? readdirSync(built.harnessDir).filter((n) => /^claude-(output|stderr)/.test(n)) : []) {
      if (!existsSync(join(dest, name))) cpSync(join(built.harnessDir, name), join(dest, name));
    }
    if (!existsSync(join(dest, "project.diff"))) {
      try {
        writeFileSync(join(dest, "project.diff"), projectDiff(built.scratch, built.base, []).diff, "utf8");
      } catch {}
    }
    writeFileSync(join(dest, "UNFINISHED.json"), `${JSON.stringify({ project: proj.project, arm, replicate, at: new Date().toISOString(), why: String(error?.message ?? error ?? "the runner stopped before the evidence was whole"), kept_folder: built.work, note: "Saved by the runner when a run broke after a model call. Not a run: no result.json, no score. The ledger holds the invocation's line and its cost." }, null, 2)}\n`, "utf8");
    redactHome(dest, HOME);
    return dest;
  } catch (failure) {
    console.error(`could not save the broken run's files into the project: ${failure.message}`);
    return null;
  }
}

/** The prompt an arm's committed file should hold: the held-out path as its token, so the file is the same on every machine. */
const tokenized = (built) => (built.heldOut?.realDir && built.promptFile !== "prompt-D.md" ? built.prompt.replaceAll(built.heldOut.realDir, HELD_OUT_TOKEN) : built.prompt);

/** Arm D's prompt carries nothing of the design and names no held-out suite, or it is not arm D. */
function assertTaskOnly(proj, built) {
  const { design_words: words, held_out_named: named, mechanics_left: mechanics } = built.derivation;
  if (named.length > 0) fail(`${proj.project}: arm D's prompt names the held-out suite (${named.join(", ")}), which this arm is told nothing of`);
  if (words.length > 0) fail(`${proj.project}: arm D's prompt carries a word of the design (${words.join(", ")}); write the task text and the acceptance files' names without roles, routing or loops`);
  if (mechanics.length > 0) fail(`${proj.project}: arm D's prompt names a mechanic of the tool (${mechanics.join(", ")})`);
}

/** The committed prompt (with the token) must be what the package, or for D the task folder, derives today, or the run measures a stale prompt. */
function assertPromptCurrent(proj, built) {
  const committed = join(proj.dir, built.promptFile);
  if (!existsSync(committed)) fail(`${proj.project}/${built.promptFile} is not committed: run scripts/compare.sh ${proj.project} --derive first`);
  if (readFileSync(committed, "utf8") !== tokenized(built)) fail(`${proj.project}/${built.promptFile} differs from the prompt ${built.promptFile === "prompt-D.md" ? "the task folder" : "the package"} derives now${proj.tierMap ? ` under the tier map ${proj.tierMap.text}` : ""}: re-run --derive and commit it before running`);
}

// ── one model-calling invocation ─────────────────────────────────────────
function invoke({ ledger, proj, arm, replicate, kind, iteration, retry, scratch, harnessDir, binDir, tmp, prompt, resumeSession, suffix, note, settings }) {
  // The ledger is read from its file before every write, so what another process recorded meanwhile is kept.
  reload(ledger);
  const decision = gate(ledger, { project: proj.project, arm, replicate, kind: kind === "iteration" ? "iteration" : kind, retry });
  if (!decision.ok) fail(`the ledger refuses this ${kind}: ${decision.reason}`);
  const spentBefore = totals(ledger).spent;
  let entry = openRunEntry(ledger, { project: proj.project, arm, replicate, kind, iteration, maxBudget: decision.maxBudget, retry, sessionId: resumeSession, note });
  saveLedger(ledger);
  console.log(`ledger: invocation ${entry.n} opened; ${remainingText(decision.remaining)}, this one is capped at $${decision.maxBudget.toFixed(2)}`);

  const outPath = join(harnessDir, `claude-output${suffix}.json`);
  const errPath = join(harnessDir, `claude-stderr${suffix}.txt`);
  const settingsJson = JSON.stringify(settings);
  // --disable-slash-commands: no skill is listed to the session. The owner's machine has the tool's own design skill
  // installed for every project, and a session that is shown its name knows what it is part of.
  const args = ["-p", prompt, "--permission-mode", "acceptEdits", "--output-format", "json", "--settings", settingsJson, "--max-budget-usd", decision.maxBudget.toFixed(2), "--strict-mcp-config", "--disable-slash-commands", "--model", proj.leadModel, "--effort", LEAD_EFFORT];
  if (resumeSession) args.push("--resume", resumeSession);
  const out = openSync(outPath, "w");
  const err = openSync(errPath, "w");
  const started = Date.now();
  // The tool is on PATH only where the arm is the tool's own package (A). The aliases mean what the record says in every arm.
  const session = sessionEnv({ arm, binDir, tmp });
  modelCalled = true;
  const child = spawnSync(claudeCommand(), args, { cwd: scratch, env: session.env, stdio: ["ignore", out, err], timeout: RUN_TIMEOUT_MS });
  closeSync(out);
  closeSync(err);
  const wall = Math.round((Date.now() - started) / 1000);

  let output = null;
  try {
    output = JSON.parse(readFileSync(outPath, "utf8"));
  } catch {}
  const reported = typeof output?.total_cost_usd === "number" ? output.total_cost_usd : null;
  const never = neverUsed(output?.modelUsage);
  entry = amendEntry(ledger, entry, {
    ended: new Date().toISOString(),
    status: output === null ? "failed" : output.is_error ? "error" : "ok",
    cost_usd: reported === null ? null : Math.round(reported * 1e6) / 1e6,
    reported_cost_usd: reported,
    session_id: output?.session_id ?? resumeSession ?? null,
    note: [note, output?.subtype && output.subtype !== "success" ? `result ${output.subtype}` : "", child.error ? `spawn: ${child.error.message}` : "", child.status ? `exit ${child.status}` : ""].filter(Boolean).join("; "),
    // A model no run uses, reported by the harness: the line carries it, and the ledger lets nothing else start until someone answers for it.
    ...(never.length > 0 ? { never_used: never } : {}),
  });
  console.log(`claude exit ${child.status ?? child.signal ?? "?"} after ${wall}s; reported cost ${reported === null ? "unknown" : `$${reported.toFixed(4)}`}`);
  console.log(describe(ledger).split("\n")[0]);
  const notice = tripwireNotice(ledger, spentBefore);
  if (notice) console.log(`\n\x1b[33m${notice}\x1b[0m`);
  if (never.length > 0) console.log(`\n\x1b[31mNEVER\x1b[0m invocation ${entry.n} reported ${never.join(", ")}; the ledger now refuses every new call`);
  if (output === null) {
    const stderr = existsSync(errPath) ? readFileSync(errPath, "utf8").slice(0, 2000) : "";
    fail(`claude produced no JSON output${stderr ? `:\n${stderr}` : ""}`);
  }
  return { entry, output, wall, toolOnPath: session.tool_on_path, args: args.map((a) => (a === prompt ? "<prompt>" : a === settingsJson ? "<settings.json>" : a)), outFile: `claude-output${suffix}.json`, errFile: `claude-stderr${suffix}.txt` };
}

const remainingText = (remaining) => (Number.isFinite(remaining) ? `$${remaining.toFixed(2)} remains` : "no cap (the tripwires stand)");

// ── evidence common to every arm ─────────────────────────────────────────
function digestFor(invocations, scratch) {
  const sessions = [...new Set(invocations.map((inv) => inv.output.session_id).filter(Boolean))];
  return sessions.flatMap((sid) => digestTranscripts(sessionTranscripts(CLAUDE_DIR, sid), scratch).map((entry) => ({ session: sid, ...entry })));
}

/**
 * What a session reached for outside its own project, from the transcript digest: every absolute path that is not
 * under the scratch (the reviewer's held-out copy apart, which is counted on its own); every `..` used as a step of a
 * path, a bare `/`, `~`, and the variables and calls that name the home or the temp folder. Arm D is told nothing
 * lies outside; the other arms are told of one folder. Whatever any of them went looking for is listed here, by who,
 * so a write-up can say so instead of assuming. It is a list of what to read in the transcript, not a verdict: a
 * regular expression or a web address in a command can look like a path, and a path that was only named may not
 * have been opened. Nothing is cut silently: past 60 entries the list ends with how many more there were.
 */
export function reachedOutside(digest, scratch, heldOutDir) {
  const real = (() => {
    try {
      return realpathSync(scratch);
    } catch {
      return scratch;
    }
  })();
  const inside = [scratch, real, ...(heldOutDir ? [heldOutDir, heldOutDir.replace(/^\/private/, "")] : [])];
  const harmless = /^\/(dev|usr|bin|opt|etc|System|Library)(\/|$)/;
  const elsewhere = [
    [/(?<![\w.])\.\.(?![\w.])/, "climbs with .."],
    [/(?<![\w\/.~-])~(?=\/|\s|$|["'])/, "names the home folder (~)"],
    [/\$\{?(HOME|TMPDIR|OLDPWD)\b/, "names the home or the temp folder by variable"],
    [/\b(tmpdir|homedir)\s*\(|process\.env\.(HOME|TMPDIR)\b/, "asks node for the home or the temp folder"],
    [/(^|[\s;&|(])(cd|ls|find|du|tree)\s+(-\S+\s+)*\/(\s|$|[;&|)])/, "goes to the root folder"],
  ];
  const out = {};
  for (const entry of digest) {
    const found = new Set();
    for (const use of entry.tool_uses) {
      if (use.tool === "Agent" || use.tool === "Task") continue;
      const texts = [use.file, use.path, use.command, use.tool === "Glob" ? use.pattern : undefined].filter((t) => typeof t === "string");
      for (const text of texts) {
        for (const m of text.matchAll(/(?<![\w.~:\/-])\/(?:[\w.@+~-]+\/)*[\w.@+~-]+/g)) {
          const path = m[0];
          if (harmless.test(path) || inside.some((base) => path === base || path.startsWith(`${base}/`))) continue;
          // Listed only when its first step is a real folder of this machine: `/x/` in a regular expression is not one.
          if (!existsSync(`/${path.split("/")[1]}`)) continue;
          found.add(`${use.tool}: ${path}`);
        }
        for (const [pattern, what] of elsewhere) if (pattern.test(text)) found.add(`${use.tool}: ${what}: ${text.slice(0, 160)}`);
      }
    }
    if (found.size > 0) {
      const who = entry.who === "lead" || entry.who.includes("--") ? entry.who : `${entry.who} (${entry.description ?? entry.transcript})`;
      const all = [...new Set([...(out[who] ?? []), ...found])];
      out[who] = all.length > 60 ? [...all.slice(0, 60), `… and ${all.length - 60} more: read the transcript`] : all;
    }
  }
  return out;
}

/**
 * How many times the tool's name stands in a run's transcripts, the lead's and every sub-agent's. In arm A it is the
 * package's own name and is expected. In B, C and D, and for the judge, nothing given to the session names the tool,
 * so any count above zero means the harness or the machine told the session what the runner did not.
 */
export function toolNamed(sessionIds, claudeDir = CLAUDE_DIR) {
  let mentions = 0;
  let transcripts = 0;
  const where = [];
  for (const sid of new Set(sessionIds.filter(Boolean))) {
    for (const { file, who } of sessionTranscripts(claudeDir, sid)) {
      transcripts += 1;
      const count = (readFileSync(file, "utf8").match(/grooph/gi) ?? []).length;
      if (count > 0) where.push({ who, mentions: count });
      mentions += count;
    }
  }
  return { mentions, transcripts, where };
}

function processMeasures(invocations, digest, heldOutDir, scratch) {
  const models = {};
  // Who touched the held-out evidence (a read, a search or a command on the folder), as the proving check counts it.
  const touched = {};
  if (heldOutDir) {
    const marks = [heldOutDir, "/held-out/"];
    for (const entry of digest) {
      const uses = entry.tool_uses.filter((u) => !u.error && u.tool !== "Agent" && u.tool !== "Task" && marks.some((m) => `${u.file ?? ""}${u.path ?? ""}${u.command ?? ""}`.includes(m)));
      // A generic subagent ("claude", "general-purpose") is told apart by the description the lead gave it.
      const who = entry.who === "lead" || entry.who.includes("--") ? entry.who : `${entry.who} (${entry.description ?? entry.transcript})`;
      if (uses.length > 0) touched[who] = (touched[who] ?? 0) + uses.length;
    }
  }
  for (const inv of invocations) {
    for (const [model, usage] of Object.entries(inv.output.modelUsage ?? {})) {
      models[model] ??= { cost_usd: 0, output_tokens: 0 };
      models[model].cost_usd += usage.costUSD ?? 0;
      models[model].output_tokens += usage.outputTokens ?? 0;
    }
  }
  const byAgent = {};
  for (const entry of digest) byAgent[entry.who] = [...new Set([...(byAgent[entry.who] ?? []), ...entry.models])];
  const denials = invocations.flatMap((inv) => (inv.output.permission_denials ?? []).map((d) => ({ tool: d.tool_name, command: d.tool_input?.command ?? d.tool_input?.file_path ?? null })));
  const dispatches = digest.filter((e) => e.who === "lead").flatMap((e) => e.tool_uses.filter((u) => u.tool === "Agent" || u.tool === "Task")).map((u) => ({ subagent_type: u.subagent_type, description: u.description, model_asked: u.model ?? undefined }));
  const sum = (key) => invocations.reduce((total, inv) => total + (inv.output[key] ?? 0), 0);
  return {
    models,
    models_by_agent: byAgent,
    models_never_used: neverUsed(models, byAgent),
    cost_usd: Math.round(invocations.reduce((total, inv) => total + (inv.entry.cost_usd ?? 0), 0) * 1e6) / 1e6,
    harness_turns: sum("num_turns"),
    duration_s: Math.round(sum("duration_ms") / 1000),
    wall_s: invocations.reduce((total, inv) => total + inv.wall, 0),
    permission_denials: denials,
    subagents_dispatched: dispatches.length,
    dispatches,
    held_out_touched: heldOutDir ? touched : undefined,
    reached_outside_project: scratch ? reachedOutside(digest, scratch, heldOutDir) : undefined,
    tool_named_in_transcripts: toolNamed(invocations.map((inv) => inv.output.session_id)),
  };
}

function invocationRows(invocations) {
  return invocations.map((inv) => ({
    kind: inv.entry.kind,
    iteration: inv.entry.iteration ?? undefined,
    ledger_n: inv.entry.n,
    session_id: inv.output.session_id ?? null,
    result: inv.output.subtype ?? null,
    is_error: inv.output.is_error ?? null,
    cost_usd: inv.entry.cost_usd,
    reported_cost_usd: inv.entry.reported_cost_usd,
    max_budget_usd: inv.entry.max_budget_usd,
    harness_turns: inv.output.num_turns ?? null,
    duration_s: Math.round((inv.output.duration_ms ?? 0) / 1000),
    wall_s: inv.wall,
    says_done: inv.saysDone ?? undefined,
    tests_after: inv.testsAfter ?? undefined,
    gate: inv.gate ?? undefined,
    command: ["claude", ...inv.args],
    output: inv.outFile,
    reply_tail: String(inv.output.result ?? "").slice(-600),
  }));
}

/** The conditions §2 says are equal, written into every result.json. */
function conditions(proj, built, harnessVersion) {
  return {
    task: `experiments/comparisons/${proj.project}/task`,
    test_command: proj.testCommand,
    held_out: built.heldOut ? { dir: built.heldOut.realDir, files: built.heldOut.files, substituted_in: built.substituted, named_to: built.heldOut.named_to ?? "a reviewer, as the template names it to its critic", beside_scratch_during_run: built.heldOut.beside_scratch_during_run ?? true, scorer_only: built.heldOut.scorer_only ?? [], scored_from: `experiments/comparisons/${proj.project}/held-out (the repository's, never the copy beside the scratch)` } : null,
    protocol: proj.protocol,
    study: proj.study,
    lead_model: proj.leadModel,
    lead_effort: LEAD_EFFORT,
    judge_model: proj.judgeModel,
    tier_map: proj.tierMap ? { ...proj.tierMap.map, said_as: `GROOPH_MODELS=${proj.tierMap.text}`, source: proj.tierMap.source } : null,
    agent_models: built.agentModels ?? null,
    aliases: ALIAS_ENV,
    // What the session could see of where it was: its repository's user and one commit; whether the tool's command was
    // on the PATH it was given (looked for on that very PATH, not assumed); that no skill was listed to it.
    repository: { user: NEUTRAL_COMMIT.name, commits: [NEUTRAL_COMMIT.message], holds_the_package: built.arm === "A" },
    tool_on_path: sessionEnv({ arm: built.arm, binDir: join(built.work, "tools"), tmp: built.tmp }).tool_on_path,
    skills_listed: "none (--disable-slash-commands)",
    session_tmpdir: "a folder of the run's own",
    permission_allow_rules: built.settings.permissions.allow.length,
    strict_mcp_config: true,
    harness_version: harnessVersion,
    template: proj.template,
    // Version 1 recorded the instantiated document's own version here; version 2 records the template's (`<id>@<n>`).
    template_version: proj.protocol >= 2 ? (built.doc.lineage?.from ?? null) : (built.doc.version ?? null),
    graph_id: built.graphId,
    scratch: built.scratch,
  };
}

function copyOutputs(invocations, built, evidenceDir) {
  for (const inv of invocations) {
    cpSync(join(built.harnessDir, inv.outFile), join(evidenceDir, inv.outFile));
    const errText = readFileSync(join(built.harnessDir, inv.errFile), "utf8");
    if (errText.trim()) writeFileSync(join(evidenceDir, inv.errFile), errText, "utf8");
  }
}

// ── the ending of a run, per arm ─────────────────────────────────────────
function endingOfA(invocations, facts) {
  const errored = invocations.find((inv) => inv.output.subtype && inv.output.subtype !== "success");
  if (errored) return { kind: "cut-off", reason: `harness result ${errored.output.subtype}` };
  const named = facts?.ending ?? [];
  if (named.length > 0) return { kind: "clean", reason: named.join(", ") };
  return { kind: "cut-off", reason: "the final note names no stop, stop node or halt at a gate" };
}

function endingOfB(inv) {
  if (inv.output.subtype && inv.output.subtype !== "success") return { kind: "cut-off", reason: `harness result ${inv.output.subtype}` };
  return { kind: "clean", reason: "the session ended by itself" };
}

function endingOfC(invocations, n) {
  const errored = invocations.find((inv) => inv.output.subtype && inv.output.subtype !== "success");
  if (errored) return { kind: "cut-off", reason: `harness result ${errored.output.subtype} at iteration ${errored.entry.iteration}` };
  const last = invocations[invocations.length - 1];
  if (last.saysDone && last.testsAfter) return { kind: "clean", reason: `iteration ${last.entry.iteration} of ${n} said done and the tests passed` };
  if (last.saysDone) return { kind: "clean", reason: `iteration ${last.entry.iteration} of ${n} said done (tests did not pass, so the loop had run out)` };
  return { kind: "cut-off", reason: `iteration limit: ${invocations.length} of ${n} iterations, none said done` };
}

// ── arms ─────────────────────────────────────────────────────────────────
async function runArmA({ proj, built, ledger, binDir, retry, evidenceDir, harnessVersion, core }) {
  const invocations = [];
  const prompts = { "kickoff.md": built.kickoff };
  const notesPath = () => {
    const folders = runFolders(join(built.scratch, ".grooph", built.graphId, "runs"));
    return folders[0] ? join(built.scratch, ".grooph", built.graphId, "runs", folders[0], "notes.jsonl") : null;
  };
  say("arm A: running the package headless (this spends money)");
  const first = invoke({ ledger, proj, arm: "A", replicate: built.replicate, kind: "kickoff", retry, scratch: built.scratch, harnessDir: built.harnessDir, binDir, tmp: built.tmp, prompt: built.kickoff, suffix: "", note: retry ? `retry: ${retry}` : "", settings: built.settings });
  first.notesAfter = notesPath() ? readNotes(notesPath()).lines : 0;
  invocations.push(first);
  const runId = runFolders(join(built.scratch, ".grooph", built.graphId, "runs"))[0] ?? null;
  first.entry = amendEntry(ledger, first.entry, { run_id: runId });

  // A scripted gate answer is given only when the project's expect.json names one (none does unless the owner decided so), and only to a run that halted at that gate.
  const resume = proj.expect.resume;
  if (resume) {
    const notes = notesPath() ? readNotes(notesPath()).notes.filter(Boolean) : [];
    const reached = notes.some((note) => JSON.stringify(note).includes(resume.gate));
    const beyond = notes.filter((note) => /^node:/.test(note.at) && !(resume.before ?? []).includes(note.at.slice(5)) && note.at !== `node:${resume.gate}`);
    if (!runId || !reached || beyond.length > 0) console.log(`the run did not stop at ${resume.gate}, so the scripted "${resume.answer}" is not given`);
    else {
      const prompt = resume.prompt.replaceAll("{{run-id}}", runId).replaceAll("{{gate}}", resume.gate).replaceAll("{{answer}}", resume.answer);
      prompts["resume.md"] = prompt;
      say(`resuming run ${runId} once with the scripted answer "${resume.answer}" at ${resume.gate}`);
      const second = invoke({ ledger, proj, arm: "A", replicate: built.replicate, kind: "resume", scratch: built.scratch, harnessDir: built.harnessDir, binDir, tmp: built.tmp, prompt, resumeSession: first.output.session_id, suffix: "-2", note: `scripted answer "${resume.answer}" at ${resume.gate}`, settings: built.settings });
      second.notesAfter = notesPath() ? readNotes(notesPath()).lines : 0;
      second.entry = amendEntry(ledger, second.entry, { run_id: runId });
      invocations.push(second);
    }
  }

  say(`copying the evidence into ${evidenceDir.slice(root.length + 1)}/`);
  // The proving runner's evidence copy and check, unchanged: runs/, package/, project.diff, digest, result.json.
  collect({ template: proj.template, experiment: proj, built, invocations, prompts, evidenceDir, harnessVersion, lead: { model: proj.leadModel, effort: LEAD_EFFORT } });
  const checked = await finishResult(evidenceDir, core, proj.template);
  const result = JSON.parse(readFileSync(join(evidenceDir, "result.json"), "utf8"));
  const digest = JSON.parse(readFileSync(join(evidenceDir, "transcript-digest.json"), "utf8"));
  const measures = processMeasures(invocations, digest, built.heldOut?.realDir, built.scratch);
  Object.assign(result, {
    arm: "A",
    replicate: built.replicate,
    project: proj.project,
    wall_s: measures.wall_s,
    conditions: conditions(proj, built, harnessVersion),
    process: { ...measures, record: { rounds: result.rounds, stop_fired: result.stop_fired, ending: result.ending, back_edges: checked.facts.back_edges ?? null, dispatch_count: checked.facts.dispatch_count ?? null, amendments: result.amendments, halt_notes: checked.facts.halt_notes ?? [] } },
    check: { problems: checked.problems, findings: checked.findings },
    invocations: invocationRows(invocations),
    ending_kind: endingOfA(invocations, checked.facts),
  });
  writeFileSync(join(evidenceDir, "result.json"), `${JSON.stringify(result, null, 2)}\n`, "utf8");
  return { result, files: result.project_files_changed };
}

function collectPromptArm({ proj, built, arm, invocations, prompts, evidenceDir, harnessVersion, ending }) {
  mkdirSync(evidenceDir, { recursive: true });
  const { diff, files } = projectDiff(built.scratch, built.base, []);
  writeFileSync(join(evidenceDir, "project.diff"), diff, "utf8");
  copyOutputs(invocations, built, evidenceDir);
  writeFileSync(join(evidenceDir, "settings.json"), `${JSON.stringify(built.settings, null, 2)}\n`, "utf8");
  mkdirSync(join(evidenceDir, "prompts"), { recursive: true });
  for (const [name, text] of Object.entries(prompts)) writeFileSync(join(evidenceDir, "prompts", name), text, "utf8");
  cpSync(join(proj.dir, "expect.json"), join(evidenceDir, "expect.json"));
  const digest = digestFor(invocations, built.scratch);
  writeFileSync(join(evidenceDir, "transcript-digest.json"), `${JSON.stringify(digest, null, 2)}\n`, "utf8");
  const measures = processMeasures(invocations, digest, built.heldOut?.realDir, built.scratch);
  const result = {
    template: proj.template,
    arm,
    replicate: built.replicate,
    project: proj.project,
    graph_id: built.graphId,
    harness: "claude-code",
    harness_version: harnessVersion,
    conditions: conditions(proj, built, harnessVersion),
    derivation: built.derivation,
    iterations_cap: arm === "C" ? built.n : undefined,
    models: measures.models,
    models_by_agent: measures.models_by_agent,
    cost_usd: measures.cost_usd,
    harness_turns: measures.harness_turns,
    duration_s: measures.duration_s,
    wall_s: measures.wall_s,
    process: measures,
    permission_denials: measures.permission_denials,
    invocations: invocationRows(invocations),
    base_commit: built.base,
    project_files_changed: files,
    scratch: built.scratch,
    ending_kind: ending,
    home_redactions: 0,
  };
  writeFileSync(join(evidenceDir, "result.json"), `${JSON.stringify(result, null, 2)}\n`, "utf8");
  const redactions = redactHome(evidenceDir, HOME);
  result.home_redactions = redactions;
  writeFileSync(join(evidenceDir, "result.json"), `${JSON.stringify(result, null, 2)}\n`, "utf8");
  return { result, files };
}

/**
 * The one scripted gate answer a project may name (expect.json `resume`, owner-approved;
 * spec-then-loop only in this study), for a prompt arm: given only when the tree shows
 * the session stopped at the gate — every planning output present, nothing under src/
 * or tests/ changed. A session that built straight through, or stopped elsewhere, gets
 * no answer and is recorded as it ended.
 */
function haltedAtGate(built, resume) {
  const { files } = projectDiff(built.scratch, built.base, []);
  const changed = files.map((line) => line.trim().split(/\s+/).pop());
  const outputs = resume.planning_outputs ?? [];
  const present = outputs.filter((path) => existsSync(join(built.scratch, path)));
  const built_ = changed.filter((path) => path.startsWith("src/") || path.startsWith("tests/"));
  const halted = outputs.length > 0 && present.length === outputs.length && built_.length === 0;
  return { halted, changed, planning_outputs_present: present, built: built_ };
}

function resumePromptArm({ proj, built, arm, first, ledger, binDir, suffix, prompts }) {
  const resume = proj.expect.resume;
  if (!resume?.prompt_arm) return null;
  const gate = haltedAtGate(built, resume);
  first.gate = { ...gate, resumed: false };
  if (!gate.halted) {
    console.log(`the session did not stop at ${resume.gate} (changed: ${gate.changed.join(", ") || "nothing"}), so the scripted "${resume.answer}" is not given`);
    return null;
  }
  const prompt = resume.prompt_arm.replaceAll("{{gate}}", resume.gate).replaceAll("{{answer}}", resume.answer);
  prompts[`resume${suffix}.md`] = prompt;
  say(`resuming the session once with the scripted answer "${resume.answer}" at ${resume.gate} (owner-approved exception, see the project README)`);
  const second = invoke({ ledger, proj, arm, replicate: built.replicate, kind: "resume", iteration: first.entry.iteration ?? undefined, scratch: built.scratch, harnessDir: built.harnessDir, binDir, tmp: built.tmp, prompt, resumeSession: first.output.session_id, suffix: `${suffix}-resume`, note: `scripted answer "${resume.answer}" at ${resume.gate}`, settings: built.settings });
  first.gate.resumed = true;
  second.gate = { answer: resume.answer, gate: resume.gate };
  return second;
}

function runArmB({ proj, built, ledger, binDir, retry, evidenceDir, harnessVersion }) {
  say("arm B: running the derived prompt in one headless session (this spends money)");
  const prompts = { "prompt-B.md": built.prompt };
  const inv = invoke({ ledger, proj, arm: "B", replicate: built.replicate, kind: "kickoff", retry, scratch: built.scratch, harnessDir: built.harnessDir, binDir, tmp: built.tmp, prompt: built.prompt, suffix: "", note: retry ? `retry: ${retry}` : "", settings: built.settings });
  const invocations = [inv];
  const resumed = resumePromptArm({ proj, built, arm: "B", first: inv, ledger, binDir, suffix: "", prompts });
  if (resumed) invocations.push(resumed);
  say(`copying the evidence into ${evidenceDir.slice(root.length + 1)}/`);
  return collectPromptArm({ proj, built, arm: "B", invocations, prompts, evidenceDir, harnessVersion, ending: endingOfB(invocations[invocations.length - 1]) });
}

/** Arm D (protocol version 2): the task, its acceptance material and the test command, one session, nothing of the design. */
function runArmD({ proj, built, ledger, binDir, retry, evidenceDir, harnessVersion }) {
  say("arm D: running the task alone in one headless session (this spends money)");
  const prompts = { "prompt-D.md": built.prompt };
  const inv = invoke({ ledger, proj, arm: "D", replicate: built.replicate, kind: "kickoff", retry, scratch: built.scratch, harnessDir: built.harnessDir, binDir, tmp: built.tmp, prompt: built.prompt, suffix: "", note: retry ? `retry: ${retry}` : "", settings: built.settings });
  say(`copying the evidence into ${evidenceDir.slice(root.length + 1)}/`);
  return collectPromptArm({ proj, built, arm: "D", invocations: [inv], prompts, evidenceDir, harnessVersion, ending: endingOfB(inv) });
}

function testsPass(scratch, testCommand) {
  const [command, ...args] = testCommand.split(/\s+/);
  const out = spawnSync(command, args, { cwd: scratch, encoding: "utf8", env: { PATH: process.env.PATH, HOME, TMPDIR: process.env.TMPDIR ?? "/tmp", CI: "1" }, timeout: 5 * 60 * 1000 });
  return out.status === 0;
}

function runArmC({ proj, built, ledger, binDir, retry, evidenceDir, harnessVersion }) {
  const n = built.n;
  say(`arm C: the derived prompt in up to ${n} fresh headless sessions (this spends money)`);
  const invocations = [];
  const prompts = { "prompt-B.md": built.prompt };
  let gateNote = null;
  for (let i = 1; i <= n; i += 1) {
    const prompt = iterationPrompt(built.prompt, i, n, gateNote);
    prompts[`iteration-${i}.md`] = prompt;
    let inv = invoke({ ledger, proj, arm: "C", replicate: built.replicate, kind: i === 1 ? "kickoff" : "iteration", iteration: i, retry: i === 1 ? retry : undefined, scratch: built.scratch, harnessDir: built.harnessDir, binDir, tmp: built.tmp, prompt, suffix: `-${i}`, note: [i === 1 && retry ? `retry: ${retry}` : "", `iteration ${i} of ${n}`].filter(Boolean).join("; "), settings: built.settings });
    invocations.push(inv);
    // The scripted gate answer, when the project names one and this iteration halted at the gate; later iterations are told.
    if (!gateNote && proj.expect.resume?.prompt_arm) {
      const resumed = resumePromptArm({ proj, built, arm: "C", first: inv, ledger, binDir, suffix: `-${i}`, prompts });
      if (resumed) {
        invocations.push(resumed);
        inv = resumed;
        gateNote = (proj.expect.resume.iteration_note ?? "At `{{gate}}` the human already answered: {{answer}}.").replaceAll("{{gate}}", proj.expect.resume.gate).replaceAll("{{answer}}", proj.expect.resume.answer);
      }
    }
    inv.saysDone = saysDone(inv.output.result);
    inv.testsAfter = testsPass(built.scratch, proj.testCommand);
    console.log(`iteration ${i}: says done ${inv.saysDone ? "yes" : "no"}; tests ${inv.testsAfter ? "pass" : "fail"}`);
    if (inv.output.subtype && inv.output.subtype !== "success") {
      console.log(`iteration ${i} ended with ${inv.output.subtype}; the loop stops here`);
      break;
    }
    if ((inv.entry.never_used ?? []).length > 0) {
      console.log(`iteration ${i} reported a model no run uses; the loop stops here and its evidence is kept`);
      break;
    }
    if (inv.saysDone && inv.testsAfter) break;
  }
  say(`copying the evidence into ${evidenceDir.slice(root.length + 1)}/`);
  return collectPromptArm({ proj, built, arm: "C", invocations, prompts, evidenceDir, harnessVersion, ending: endingOfC(invocations, n) });
}

// ── the artifact a judge reads ───────────────────────────────────────────

/**
 * A project whose deliverable is something rendered (a report, a chart) names it in expect.json
 * `judge.artifact: { command, path }`. The runner renders it from the run's final tree, by the same command for
 * every arm and after the diff is taken, and keeps it in the run folder as `artifact/<name>`; the judge reads that
 * file beside the diff. A command that fails is recorded as such and the judge is told there is no artifact.
 */
function renderArtifact({ proj, built, evidenceDir }) {
  const spec = proj.expect.judge?.artifact;
  if (!spec) return null;
  const [command, ...args] = spec.command.split(/\s+/);
  const out = spawnSync(command, args, { cwd: built.scratch, encoding: "utf8", env: { PATH: process.env.PATH, HOME, TMPDIR: process.env.TMPDIR ?? "/tmp", CI: "1" }, timeout: 5 * 60 * 1000 });
  const source = join(built.scratch, spec.path);
  const record = { command: spec.command, path: spec.path, exit: out.status, rendered: out.status === 0 && existsSync(source) };
  mkdirSync(join(evidenceDir, "artifact"), { recursive: true });
  if (record.rendered) {
    record.file = `artifact/${spec.path.split("/").pop()}`;
    cpSync(source, join(evidenceDir, record.file));
  } else record.output_tail = `${out.stdout ?? ""}${out.stderr ?? ""}`.slice(-1500);
  writeFileSync(join(evidenceDir, "artifact", "render.json"), `${JSON.stringify(record, null, 2)}\n`, "utf8");
  console.log(record.rendered ? `artifact rendered by \`${spec.command}\`: ${record.file}` : `the artifact could not be rendered (\`${spec.command}\` exit ${out.status}); recorded`);
  return record;
}

// ── scoring ──────────────────────────────────────────────────────────────
function scoreRun({ proj, built, evidenceDir, files, ending }) {
  say("scoring the final tree (identically for every arm)");
  const score = scoreTree({ tree: built.scratch, heldOutDir: built.scoreDir ?? null, testCommand: proj.testCommand, allowed: proj.expect.scope.allowed, protectedPaths: proj.expect.scope.protected ?? [], files, ending, expectedCases: proj.expect.held_out_cases });
  if (built.heldOut) {
    score.held_out.suite = built.heldOut.files;
    score.held_out.scored_from = `experiments/comparisons/${proj.project}/held-out`;
    // The reviewer's copy beside the scratch was the run's to read; the scorer did not use it. What the run did to it is recorded.
    score.held_out.reviewers_copy_changed = heldOutChanges(built);
  }
  writeFileSync(join(evidenceDir, "score.json"), `${JSON.stringify(score, null, 2)}\n`, "utf8");
  console.log(`held-out ${score.held_out.ran ? `${score.held_out.passed}/${score.held_out.cases}${score.held_out.loaded === false ? " (the suite could not load the work)" : ""}` : `not run (${score.held_out.reason})`} · tests ${score.tests.pass ? "pass" : "fail"} · outside scope ${score.scope.outside.length}${score.scope.protected_changed.length > 0 ? ` · protected changed: ${score.scope.protected_changed.join(", ")}` : ""} · ending ${score.ending.kind} (${score.ending.reason})`);
  return score;
}

// ── the blind judge ──────────────────────────────────────────────────────

/** Letters for the candidates: never A, B, C or D (the arms' names), drawn at random, in random order. */
export function drawLetters(count, random = Math.random) {
  const pool = "EFGHJKLMNPQRSTUVWXYZ".split("");
  for (let i = pool.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, count);
}

export function shuffle(list, random = Math.random) {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** The part of a run's diff the judge sees: the deliverable paths only, with the tool's name redacted. */
export function judgedDiff(diff, paths) {
  const chunks = diff.split(/^(?=diff --git )/m).filter(Boolean);
  const inside = (file) => paths.some((rule) => (rule.endsWith("/") ? file.startsWith(rule) : file === rule));
  const kept = chunks.filter((chunk) => {
    const m = chunk.match(/^diff --git a\/(\S+) b\/(\S+)/);
    return m && (inside(m[1]) || inside(m[2]));
  });
  let redactions = 0;
  const text = kept.join("").replace(/grooph/gi, () => {
    redactions += 1;
    return "[tool]";
  });
  return { text, redactions, files: kept.map((c) => c.match(/^diff --git a\/(\S+)/)[1]) };
}

/**
 * The judge's prompt. Study one's six- and nine-candidate prompts came from this function and read the same today.
 * A project that names a rendered artifact (study two's `taste-polish`) adds, under each candidate's diff, what the
 * runner rendered from that candidate's final tree, and two sentences saying what it is.
 */
export function judgePrompt({ proj, taskFiles, candidates }) {
  const acceptance = taskFiles.map(({ path, text }) => `### ${path}\n\n\`\`\`\n${text.trimEnd()}\n\`\`\``).join("\n\n");
  const artifact = proj.expect?.judge?.artifact;
  const rendered = (c) => (!artifact ? "" : `\n\n### What candidate ${c.letter} renders\n\n${c.artifact === null || c.artifact === undefined ? "(the render command failed on this candidate's tree: there is nothing to show)" : `\`\`\`text\n${c.artifact.replace(/\n+$/, "")}\n\`\`\``}`);
  const body = candidates.map((c) => `## Candidate ${c.letter}\n\n\`\`\`diff\n${c.diff.trimEnd() || "(no change to the deliverable paths)"}\n\`\`\`${rendered(c)}`).join("\n\n");
  const letters = candidates.map((c) => c.letter);
  const shown = artifact ? ` Under each diff is what that candidate renders: the output of \`${artifact.command}\` on its final tree (\`${artifact.path}\`), produced the same way for every candidate. The rendered output is the deliverable; the diff says how it is made.` : "";
  return `You are a critic judging ${candidates.length} candidate changes to one small Node project. Each candidate was produced by a different session working from the same task; you do not know how, and you should not guess. Judge only what the diff shows against the task and its acceptance material.${shown} You have no tools: read carefully and cite lines of the diff.

# The task

${proj.slots.values.task.trim()}

# Acceptance material the builder saw

${acceptance}

# Candidates (in random order, under random letters)

${body}

# What to do

For each candidate, score it from 1 to 5 against the task and the acceptance material (5: every requirement clearly met with tests that would catch a regression; 3: the main behaviour is right but a requirement is unmet, untested or fragile; 1: does not do the task), with two or three sentences of reasons that cite the diff. Then rank all candidates from best to worst; ties are allowed only when you can say why two are indistinguishable. Judge the deliverable, not its volume: more lines are not more credit.

End your reply with exactly one fenced JSON block of this shape, and nothing after it:

\`\`\`json
{
  "scores": { ${letters.map((l) => `"${l}": { "score": <1-5>, "reasons": "<two or three sentences>" }`).join(", ")} },
  "ranking": [${letters.map((l) => `"${l}"`).join(", ")}],
  "notes": "<anything that applied to several candidates, in at most three sentences>"
}
\`\`\`
`;
}

function parseVerdict(reply) {
  const blocks = [...String(reply ?? "").matchAll(/```json\s*\n([\s\S]*?)\n```/g)];
  if (blocks.length === 0) return null;
  try {
    return JSON.parse(blocks[blocks.length - 1][1]);
  } catch {
    return null;
  }
}

function runJudge({ proj, ledger, dryRun, retry }) {
  const dirs = runDirs(proj.dir);
  const names = Object.keys(dirs).sort();
  if (names.length === 0) fail(`${proj.project} has no run to judge`);
  const planned = proj.replicates * proj.arms.length;
  if (names.length < planned) console.log(`note: ${names.length} of the ${planned} planned runs exist; the judge sees what exists`);
  const judgeDir = join(proj.dir, "judge");
  if (existsSync(join(judgeDir, "verdict.json")) && !dryRun && !retry) fail(`${proj.project}/judge already holds a verdict; it is never overwritten (pass --retry "<why>" for the one retry, which moves it aside)`);

  const paths = proj.expect.judge?.files ?? proj.expect.scope.allowed;
  const taskFiles = proj.acceptance.map((path) => ({ path, text: readFileSync(join(proj.dir, "task", path), "utf8").replaceAll(HELD_OUT_TOKEN, "<a folder outside the project>") }));
  const order = shuffle(names);
  const letters = drawLetters(order.length);
  const candidates = order.map((name, i) => {
    const { text, redactions, files } = judgedDiff(readFileSync(join(dirs[name], "project.diff"), "utf8"), paths);
    // The rendered artifact, when the project names one: what the runner kept in the run folder, the tool's name redacted as in the diff.
    let artifact;
    if (proj.expect.judge?.artifact) {
      const kept = join(dirs[name], "artifact", proj.expect.judge.artifact.path.split("/").pop());
      artifact = existsSync(kept) ? readFileSync(kept, "utf8").replace(/grooph/gi, "[tool]") : null;
    }
    return { letter: letters[i], run: name, diff: text, redactions, files, artifact };
  });
  const prompt = judgePrompt({ proj, taskFiles, candidates });
  const mapping = { about: "Which run each letter stood for. Written by the runner beside the verdict and read only by compare-summary.mjs; the judge never saw it.", letters: Object.fromEntries(candidates.map((c) => [c.letter, c.run])), order: candidates.map((c) => c.letter), files_judged: paths, redactions: Object.fromEntries(candidates.map((c) => [c.run, c.redactions])) };

  reload(ledger);
  const decision = gate(ledger, { project: proj.project, arm: "judge", replicate: null, kind: "kickoff", retry });
  if (dryRun) {
    say("dry run: the judge's prompt");
    console.log(prompt.slice(0, 1500));
    console.log(`… (${prompt.length} characters, ${candidates.length} candidates: ${candidates.map((c) => `${c.letter}=${c.run} (${c.files.length} files, ${c.redactions} redactions)`).join(", ")})`);
    console.log(decision.ok ? `the ledger would allow the judge call, capped at $${decision.maxBudget.toFixed(2)}` : `the ledger would refuse: ${decision.reason}`);
    console.log(`would run: claude -p "<judge prompt>" --output-format json --model ${proj.judgeModel} --tools "" --max-budget-usd ${decision.ok ? decision.maxBudget.toFixed(2) : "–"} --strict-mcp-config --disable-slash-commands`);
    say("dry run done; the model was not called and nothing was written");
    return 0;
  }
  if (!decision.ok) fail(`the ledger refuses the judge call: ${decision.reason}`);
  if (existsSync(judgeDir)) {
    const k = readdirSync(proj.dir).filter((n) => n.startsWith("judge-failed")).length + 1;
    renameSync(judgeDir, join(proj.dir, `judge-failed-${k}`));
  }
  mkdirSync(judgeDir, { recursive: true });
  const spentBefore = totals(ledger).spent;
  let entry = openRunEntry(ledger, { project: proj.project, arm: "judge", replicate: null, kind: "kickoff", maxBudget: decision.maxBudget, retry, note: `blind judge over ${candidates.length} candidates` });
  saveLedger(ledger);
  console.log(`ledger: invocation ${entry.n} opened; ${remainingText(decision.remaining)}, this one is capped at $${decision.maxBudget.toFixed(2)}`);

  // The judge's working folder is empty and its name says nothing: a session is shown the path it runs in.
  const cwd = mkdtempSync(join(tmpdir(), "j-"));
  const args = ["-p", prompt, "--output-format", "json", "--model", proj.judgeModel, "--tools", "", "--max-budget-usd", decision.maxBudget.toFixed(2), "--strict-mcp-config", "--disable-slash-commands"];
  const started = Date.now();
  const judgeSession = sessionEnv({ arm: "judge", tmp: cwd });
  modelCalled = true;
  const child = spawnSync(claudeCommand(), args, { cwd, env: judgeSession.env, encoding: "utf8", maxBuffer: 64 << 20, timeout: 30 * 60 * 1000 });
  const wall = Math.round((Date.now() - started) / 1000);
  rmSync(cwd, { recursive: true, force: true });
  let output = null;
  try {
    output = JSON.parse(child.stdout);
  } catch {}
  const reported = typeof output?.total_cost_usd === "number" ? output.total_cost_usd : null;
  const judgeNever = neverUsed(output?.modelUsage);
  entry = amendEntry(ledger, entry, { ended: new Date().toISOString(), status: output === null ? "failed" : output.is_error ? "error" : "ok", cost_usd: reported === null ? null : Math.round(reported * 1e6) / 1e6, reported_cost_usd: reported, session_id: output?.session_id ?? null, note: [entry.note, output?.subtype && output.subtype !== "success" ? `result ${output.subtype}` : "", child.status ? `exit ${child.status}` : ""].filter(Boolean).join("; "), ...(judgeNever.length > 0 ? { never_used: judgeNever } : {}) });
  console.log(`claude exit ${child.status ?? child.signal ?? "?"} after ${wall}s; reported cost ${reported === null ? "unknown" : `$${reported.toFixed(4)}`}`);
  const notice = tripwireNotice(ledger, spentBefore);
  if (notice) console.log(`\n\x1b[33m${notice}\x1b[0m`);
  writeFileSync(join(judgeDir, "claude-output.json"), child.stdout ?? "", "utf8");
  if (child.stderr?.trim()) writeFileSync(join(judgeDir, "claude-stderr.txt"), child.stderr, "utf8");
  if (output === null) fail("the judge call produced no JSON output; its stderr is in judge/claude-stderr.txt");

  const reply = String(output.result ?? "");
  writeFileSync(join(judgeDir, "transcript.md"), `# Blind judge · ${proj.project}\n\nModel \`${proj.judgeModel}\`, no tools, fresh session, ${new Date().toISOString()}; ledger invocation ${entry.n}, $${(reported ?? 0).toFixed(4)}. The letters' mapping is in \`mapping.json\`, which the judge never saw.\n\n## Prompt\n\n${prompt}\n\n## Reply\n\n${reply}\n`, "utf8");
  const parsed = parseVerdict(reply);
  const reportedModels = Object.keys(output.modelUsage ?? {});
  const verdict = { project: proj.project, protocol: proj.protocol, study: proj.study, model: proj.judgeModel, models_reported: reportedModels, models_never_used: neverUsed(output.modelUsage), tool_on_path: judgeSession.tool_on_path, skills_listed: "none (--disable-slash-commands)", tool_named_in_transcript: toolNamed([output.session_id]).mentions, ledger_n: entry.n, cost_usd: reported, harness_turns: output.num_turns ?? null, wall_s: wall, candidates: candidates.map((c) => c.letter), parsed: parsed !== null, scores: parsed?.scores ?? null, ranking: parsed?.ranking ?? null, notes: parsed?.notes ?? null };
  writeFileSync(join(judgeDir, "verdict.json"), `${JSON.stringify(verdict, null, 2)}\n`, "utf8");
  writeFileSync(join(judgeDir, "mapping.json"), `${JSON.stringify(mapping, null, 2)}\n`, "utf8");
  redactHome(judgeDir, HOME);
  say(parsed ? "verdict recorded" : "the judge replied but its JSON block could not be parsed; transcript kept, verdict.json marks parsed: false");
  console.log(`judge/  transcript.md, verdict.json, mapping.json (ranking ${parsed?.ranking?.join(" > ") ?? "?"})`);
  if (verdict.models_never_used.length > 0) return flagNever(verdict.models_never_used, `${proj.project}/judge`);
  return parsed ? 0 : 1;
}

// ── derive ───────────────────────────────────────────────────────────────
function writeDerivation(proj) {
  assertFreshBundle(proj.template);
  say(`deriving ${proj.project}/prompt-B.md and loop-C.sh from the package (protocol §3)${proj.tierMap ? `, exported under ${proj.tierMap.text}` : ""}`);
  const built = buildFor(proj, "B");
  try {
    const text = tokenized(built);
    writeFileSync(join(proj.dir, "prompt-B.md"), text, "utf8");
    writeFileSync(join(proj.dir, "loop-C.sh"), loopScript({ project: proj.project, n: built.n, testCommand: proj.testCommand, model: proj.leadModel, effort: LEAD_EFFORT }), { mode: 0o755 });
    console.log(JSON.stringify(built.derivation, null, 2));
    console.log(`N for arm C: ${built.n}\nwrote experiments/comparisons/${proj.project}/prompt-B.md (${text.length} characters) and loop-C.sh`);
    if (proj.tierMap?.provisional) console.log(`note: this prompt names the models of a provisional tier map (${proj.tierMap.text}); it is derived again, and committed again, when the project pre-registers its map`);
  } finally {
    closeWork(built);
  }
  if (proj.arms.includes("D")) {
    say(`writing ${proj.project}/prompt-D.md from the task folder alone (protocol §1, arm D)`);
    const d = buildFor(proj, "D");
    try {
      assertTaskOnly(proj, d);
      writeFileSync(join(proj.dir, "prompt-D.md"), d.prompt, "utf8");
      console.log(JSON.stringify(d.derivation, null, 2));
      console.log(`wrote experiments/comparisons/${proj.project}/prompt-D.md (${d.prompt.length} characters)`);
    } finally {
      closeWork(d);
    }
  }
  return 0;
}

/** A model this study never uses was reported by a run: the evidence is kept, and nothing else starts until the driver knows. */
function flagNever(models, where) {
  console.error(`\n\x1b[31mNEVER\x1b[0m ${where} reported ${models.join(", ")}, a model this study never uses. The run's evidence is kept as it is. Stop here and tell the driver before any other run.`);
  return 3;
}

// ── status ───────────────────────────────────────────────────────────────
function status() {
  const ledger = loadLedger();
  console.log(describe(ledger));
  const left = leftovers();
  const live = liveRun();
  if (live) console.log(`\n${liveText(live)}:\n${left.map((path) => `  ${path}`).join("\n")}`);
  else if (left.length > 0) console.log(`\nthe work root holds ${left.length} folder(s) from a run that did not finish; no run starts until they are looked at and cleared (--clear-work):\n${left.map((path) => `  ${path}`).join("\n")}`);
  if (!existsSync(COMPARISONS)) return 0;
  const projects = readdirSync(COMPARISONS).filter((name) => existsSync(join(COMPARISONS, name, "expect.json"))).sort();
  console.log("");
  for (const name of projects) {
    let proj;
    try {
      proj = loadProject(name);
    } catch (error) {
      console.log(`${name.padEnd(22)} not runnable yet: ${error.message}`);
      continue;
    }
    const have = Object.keys(runDirs(proj.dir)).sort();
    const next = nextRun(proj);
    const judged = existsSync(join(proj.dir, "judge", "verdict.json"));
    const missing = ["prompt-B.md", ...(proj.arms.includes("D") ? ["prompt-D.md"] : [])].filter((file) => !existsSync(join(proj.dir, file)));
    const map = proj.protocol >= 2 ? `  tier map ${proj.expect.tier_map ? tierMapText(proj.expect.tier_map) : "not named yet (no paid run starts)"}` : "";
    console.log(`${name.padEnd(22)} study ${proj.study}  runs ${have.length}/${proj.replicates * proj.arms.length} [${have.join(" ")}]${next ? `  next ${next.arm}-${next.replicate}` : "  all runs done"}${judged ? "  judged" : ""}${missing.length > 0 ? `  (no ${missing.join(", ")} yet)` : ""}${map}`);
  }
  return 0;
}

// ── main ─────────────────────────────────────────────────────────────────
async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.status) return status();
  if (args.clearWork) return clearWork();
  if (args.score) {
    const out = spawnSync(process.execPath, [join(root, "scripts", "lib", "compare-score.mjs"), resolve(args.score), ...(args.write ? ["--write"] : [])], { stdio: "inherit" });
    return out.status ?? 1;
  }
  if (!args.project) fail("usage: scripts/compare.sh <project> <A|B|C|D> [--replicate n] [--retry <why>] [--dry-run] | <project> --derive | <project> --judge [--dry-run] | <project> --next [--dry-run] | --score <run dir> [--write] | --status");
  if (!existsSync(CORE) || !existsSync(join(root, "packages", "cli", "dist", "src", "index.js"))) fail("build the repo first: pnpm install && pnpm -r build");
  const core = await import(CORE);
  const proj = loadProject(args.project);
  // Study one is finished and ran on models no call of this runner uses now: its folders are read (--status, --score, the summary), never run.
  if (proj.closed) fail(`${proj.project} is a project of study ${proj.study} (protocol version ${proj.protocol}), which is finished: its records stand as they are, and the runner makes no new call, derivation or judgment for it. Read it with --status, --score <run dir> or scripts/lib/compare-summary.mjs`);
  if (NEVER.test(proj.leadModel) || NEVER.test(proj.judgeModel)) fail(`protocol version ${proj.protocol} names a model this study never uses`);
  if (proj.protocol >= 2) {
    const paid = !args.dryRun && !args.derive;
    const resolved = resolveTierMap({ registered: proj.expect.tier_map, envText: process.env.GROOPH_MODELS, paid });
    if (resolved.error) fail(`${proj.project}: ${resolved.error}`);
    proj.tierMap = resolved;
    console.log(`tier map: ${resolved.text} · ${resolved.source} · lead ${proj.leadModel} at effort ${LEAD_EFFORT} · judge ${proj.judgeModel}`);
  }
  if (args.derive) return writeDerivation(proj);

  const ledger = loadLedger();
  if (args.judge) return runJudge({ proj, ledger, dryRun: args.dryRun, retry: args.retry });

  let { arm, replicate } = args;
  if (args.next) {
    const next = nextRun(proj);
    if (!next) fail(`${proj.project}: all ${proj.replicates * proj.arms.length} planned runs exist`);
    ({ arm, replicate } = next);
    console.log(`next in the alternation: ${arm}-${replicate}`);
  }
  if (!arm) fail(`name the arm: ${proj.arms.join(", ")} (or --next)`);
  if (!proj.arms.includes(arm)) fail(`${proj.project} runs under protocol version ${proj.protocol}, whose arms are ${proj.arms.join(", ")}; it has no arm ${arm}`);
  if (!replicate) {
    const have = runDirs(proj.dir);
    replicate = 1;
    while (have[`${arm}-${replicate}`]) replicate += 1;
  }
  if (!Number.isInteger(replicate) || replicate < 1 || replicate > proj.replicates) fail(`${proj.project} pre-registers ${proj.replicates} replicates per arm; ${arm}-${replicate} is not one of them`);
  const evidenceDir = join(proj.dir, `${arm}-${replicate}`);
  // Any file in the run's folder is evidence, a result.json or not (a copy that broke half-way still holds the harness's output).
  const holdsEvidence = existsSync(evidenceDir) && readdirSync(evidenceDir).length > 0;
  assertFreshBundle(proj.template);
  if (!args.dryRun) {
    if (holdsEvidence && !args.retry) fail(`${evidenceDir.slice(root.length + 1)} already holds a run's evidence; it is never overwritten. A failure outside the prompt or package may be retried once with --retry "<why>", which moves the evidence to ${arm}-${replicate}-failed-<k>/`);
    if (spawnSync("claude", ["--version"], { encoding: "utf8" }).status !== 0) fail("claude is not on PATH; install Claude Code first");
    if (!claudeSignedIn()) fail("the claude CLI is not signed in, so a headless run would fail. Sign in with `claude auth login` and run this again.");
    // The ledger is asked now, before anything is built or moved: a refusal must leave the earlier evidence where it is.
    const first = gate(ledger, { project: proj.project, arm, replicate, kind: "kickoff", retry: args.retry });
    if (!first.ok) fail(`the ledger refuses this run: ${first.reason}`);
  }

  say(`building the scratch project for ${proj.project}, arm ${arm}, replicate ${replicate}`);
  const built = buildFor(proj, arm);
  // From here a run either finishes with its evidence in the repository, or, once a model has been called, leaves its
  // folder under the work root for someone to look at. Before any call there is nothing in it worth keeping.
  let finished = false;
  let broke = null;
  try {
    built.replicate = replicate;
    console.log(`scratch project: ${built.scratch}\ngraph: ${built.graphId} (from ${built.doc.lineage?.from ?? `${proj.template} v${built.doc.version ?? "?"}`})\nbase commit: ${built.base}${arm !== "A" ? " (one commit, which never held the package)" : ""}`);
    if (built.heldOut && arm === "D") console.log(`held-out: named to nobody. No copy of it is near the scratch, no task file, rule or line of the prompt points at it, and the scorer runs it from the repository afterwards (${built.heldOut.files.map((f) => f.path).join(", ")})`);
    else if (built.heldOut) console.log(`${built.heldOut.scorer_only?.length > 0 ? `the scorer's alone, taken out of the reviewer's copy: ${built.heldOut.scorer_only.join(", ")}\n` : ""}held-out, the reviewer's copy: ${built.heldOut.realDir} (${built.heldOut.files.filter((f) => f.at_run !== false).map((f) => f.path).join(", ")}); Read allowed there by rule; named ${built.derivation.held_out_mentions?.prompt ?? 0} time(s) in the prompt, ${built.derivation.held_out_mentions?.package ?? 0} in the package; the scorer runs the suite from the repository`);
    if (arm === "D") assertTaskOnly(proj, built);
    if (arm !== "A") assertPromptCurrent(proj, built);

    // The tool on PATH, for arm A only (its lead validates an amended working copy with it); the folder sits beside
    // the scratch. The other arms get neither the folder nor the entry on PATH.
    const binDir = join(built.work, "tools");
    if (arm === "A") {
      mkdirSync(binDir);
      writeFileSync(join(binDir, "grooph"), `#!/bin/sh\nexec "${process.execPath}" "${CLI}" "$@"\n`, { mode: 0o755 });
    }
    const harnessVersion = spawnSync("claude", ["--version"], { encoding: "utf8" }).stdout?.trim() ?? null;
    if (args.dryRun) {
      say("dry run: everything but the model call");
      const files = run("git", ["-C", built.scratch, "ls-files"]).stdout.trim().split("\n");
      console.log(files.map((f) => `  ${f}`).join("\n"));
      console.log(`repository as the session would see it: user ${run("git", ["-C", built.scratch, "config", "user.name"]).stdout.trim()}; commits: ${run("git", ["-C", built.scratch, "log", "--format=%s"]).stdout.trim().split("\n").join(" | ")}`);
      console.log(`beside the scratch: ${readdirSync(built.work).sort().join(", ")}`);
      const decision = gate(ledger, { project: proj.project, arm, replicate, kind: "kickoff", retry: args.retry });
      console.log(describe(ledger).split("\n")[0]);
      console.log(decision.ok ? `the ledger would allow the kickoff, capped at $${decision.maxBudget.toFixed(2)}` : `the ledger would refuse: ${decision.reason}`);
      const common = `--permission-mode acceptEdits --output-format json --settings '<${built.settings.permissions.allow.length} allow rules>' --max-budget-usd ${decision.ok ? decision.maxBudget.toFixed(2) : "–"} --strict-mcp-config --model ${proj.leadModel} --effort ${LEAD_EFFORT}`;
      if (proj.tierMap) console.log(built.exportOutput.split("\n").filter((line) => /^tiers in this package|^note:/.test(line)).join("\n"));
      console.log(`agents, by the model each agent file of the package names: ${Object.entries(built.agentModels).map(([agent, model]) => `${agent.split("--").pop()} ${model}`).join(", ")}${arm === "A" ? "" : " (this arm is given the same models in its prompt's briefs, and no agent file)"}`);
      console.log(`aliases during the run: ${Object.entries(ALIAS_ENV).map(([key, model]) => `${key.replace("ANTHROPIC_DEFAULT_", "").replace("_MODEL", "").toLowerCase()} → ${model}`).join(", ")}`);
      console.log(`the tool's command on the session's PATH: ${sessionEnv({ arm, binDir, tmp: built.tmp }).tool_on_path ? "yes" : "no"}; skills listed to the session: none (--disable-slash-commands); the session's TMPDIR: ${built.tmp}`);
      if (arm === "A") console.log(`would run in ${built.scratch}:\n  claude -p "$(cat .grooph/${built.graphId}/KICKOFF.md)" ${common}`);
      else if (arm === "B") console.log(`would run in ${built.scratch}:\n  claude -p "$(cat prompt-B.md)" ${common}`);
      else if (arm === "D") console.log(`would run in ${built.scratch}:\n  claude -p "$(cat prompt-D.md)" ${common}`);
      else console.log(`would run in ${built.scratch}, for i in 1..${built.n}, each its own ledger line with its own ceiling:\n  claude -p "$(cat prompt-B.md)\\n\\nIteration $i of ${built.n}. Continue from the working tree as it is. Stop when your done check passes. ${DONE_LINE.slice(0, 60)}…" ${common}\n  stopping early when the reply's last line is \`done: yes\` and \`${proj.testCommand}\` exits 0`);
      console.log(`prompt for this arm: ${arm === "A" ? "KICKOFF.md" : built.promptFile} (${(arm === "A" ? built.kickoff : built.prompt).length} characters)${arm !== "A" ? `; matches the committed ${built.promptFile}` : ""}`);
      if (proj.expect.judge?.artifact) console.log(`would render the artifact for the judge from the final tree: \`${proj.expect.judge.artifact.command}\` → ${proj.expect.judge.artifact.path}`);
      console.log(`would score the final tree against the repository's held-out suite (${proj.expect.held_out_cases} cases), \`${proj.testCommand}\`, and the allowed paths ${proj.expect.scope.allowed.join(", ")}`);
      console.log(`would copy the evidence into experiments/comparisons/${proj.project}/${arm}-${replicate}/, then remove ${built.work}`);
      say("dry run done; the model was not called and the ledger is unchanged");
      finished = true;
      return 0;
    }

    // The one retry: the earlier evidence is moved aside only now, when the ledger has agreed and the run is about to start.
    if (holdsEvidence) {
      const k = readdirSync(proj.dir).filter((n) => n.startsWith(`${arm}-${replicate}-failed`)).length + 1;
      renameSync(evidenceDir, join(proj.dir, `${arm}-${replicate}-failed-${k}`));
      console.log(`moved the earlier evidence to ${arm}-${replicate}-failed-${k}/`);
    }
    const context = { proj, built, ledger, binDir, retry: args.retry, evidenceDir, harnessVersion, core };
    const { result, files } = arm === "A" ? await runArmA(context) : arm === "B" ? runArmB(context) : arm === "C" ? runArmC(context) : runArmD(context);
    renderArtifact({ proj, built, evidenceDir });
    const score = scoreRun({ proj, built, evidenceDir, files, ending: result.ending_kind });
    const redactions = redactHome(evidenceDir, HOME);
    if (redactions > 0) {
      const path = join(evidenceDir, "result.json");
      const r = JSON.parse(readFileSync(path, "utf8"));
      r.home_redactions = (r.home_redactions ?? 0) + redactions;
      writeFileSync(path, `${JSON.stringify(r, null, 2)}\n`, "utf8");
    }
    say(`run ${arm}-${replicate} recorded`);
    console.log(`evidence  experiments/comparisons/${proj.project}/${arm}-${replicate}/\ncost      $${(result.cost_usd ?? 0).toFixed(4)} · turns ${result.harness_turns} · ending ${score.ending.kind}`);
    console.log(`models    ${Object.keys(result.models ?? {}).join(", ") || "none reported"}`);
    const outside = result.process?.reached_outside_project ?? {};
    if (Object.keys(outside).length > 0) console.log(`reached outside its project: ${Object.entries(outside).map(([who, what]) => `${who} ×${what.length}`).join(", ")} (result.json process.reached_outside_project)`);
    const named = result.process?.tool_named_in_transcripts;
    if (arm !== "A" && named?.mentions > 0) console.log(`\n\x1b[31mTOLD\x1b[0m the tool's name stands ${named.mentions} time(s) in this run's transcripts (${named.where.map((w) => `${w.who} ×${w.mentions}`).join(", ")}). Nothing the runner gave this arm names it: find what did before the next run, and tell the driver.`);
    // The evidence is whole: result.json and score.json are in the repository, so the run's folder may go.
    finished = existsSync(join(evidenceDir, "result.json")) && existsSync(join(evidenceDir, "score.json"));
    const never = result.process?.models_never_used ?? [];
    if (never.length > 0) return flagNever(never, `${proj.project}/${arm}-${replicate}`);
    const next = nextRun(proj);
    console.log(next ? `next in the alternation: ${next.arm}-${next.replicate}` : "all planned runs exist; --judge is next");
    return 0;
  } catch (error) {
    broke = error;
    throw error;
  } finally {
    // Before any model call there is nothing in the folder worth keeping. After one, a run that is not whole saves what
    // it can into the project and leaves its folder for someone to look at.
    if (finished || !modelCalled) closeWork(built);
    else {
      const saved = salvage({ proj, built, arm, replicate, evidenceDir, error: broke });
      console.error(`\nthis run did not finish${saved ? `; what it left is saved in ${saved.slice(root.length + 1)}/` : ""}. Its folder is kept for you to look at: ${built.work}\nNo other run starts until it is cleared (scripts/compare.sh --clear-work).`);
    }
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().then(
    (code) => process.exit(code),
    (err) => {
      if (err instanceof Refusal) {
        console.error(`\n\x1b[31mREFUSED\x1b[0m ${err.message}`);
        process.exit(1);
      }
      console.error(err);
      process.exit(2);
    },
  );
}
