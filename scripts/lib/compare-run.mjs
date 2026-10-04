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
 *      written from the task folder alone (compare-prompt.mjs `deriveD`), the
 *      package is removed, and the held-out suite is named to nobody: it is
 *      moved away from the scratch before the run and comes back only to score.
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
import { closeSync, cpSync, existsSync, mkdirSync, mkdtempSync, openSync, readFileSync, readdirSync, realpathSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { checkRun } from "./prove-check.mjs";
import { digestTranscripts, projectDiff, readNotes, redactHome, runFolders, sessionTranscripts } from "./prove-evidence.mjs";
import { BASE_SETTINGS, HELD_OUT_TOKEN, NEVER, Refusal, agentModels, assertFreshBundle, buildScratch, claudeSignedIn, cleanEnv, collect, fail, finishResult, neverUsed, run, say } from "./prove-pattern.mjs";
import { describe, gate, loadLedger, openRunEntry, saveLedger, settleEntry, totals, tripwireNotice } from "./compare-ledger.mjs";
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

// ── the tier map ─────────────────────────────────────────────────────────

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

/**
 * Build the scratch as the proving runner does (task, held-out beside it, the
 * package exported, one commit). For B and C, derive the prompt from that very
 * package, then remove the package and commit again: the arm starts from the
 * task alone, with the prompt carrying what the package said.
 */
function buildFor(proj, arm) {
  // The package is exported with the project's tier map: buildScratch hands the environment to `grooph export`.
  if (proj.tierMap) process.env.GROOPH_MODELS = proj.tierMap.text;
  // Version 2: the scratch folder is named after the task's own package, never after the tool, the study or the arm.
  // A session sees its working folder's path, and in A, B and C the held-out folder's path (it sits beside the
  // scratch) is in the prompt: a path that said "grooph-compare-…-B-" would tell a session what it is part of, and
  // would make the derivation drop every sentence that names the held-out folder as a mechanic of the tool.
  const prefix = proj.protocol >= 2 ? `${JSON.parse(readFileSync(join(proj.dir, "task", "package.json"), "utf8")).name}-` : `grooph-compare-${proj.project}-${arm}-`;
  if (proj.protocol >= 2 && /grooph|compare/i.test(prefix)) fail(`${proj.project}: the task's package name would put the tool's name in the scratch folder's path`);
  const built = buildScratch(proj.template, proj, prefix);
  if (proj.protocol >= 2 && built.substituted.length > 0) fail(`${proj.project}: the held-out folder's path reached a task file (${built.substituted.join(", ")}); in protocol version 2 only a slot value names it`);
  if (proj.tierMap && !built.exportOutput.includes(`Named by GROOPH_MODELS`)) fail(`grooph export did not report the tier map it was given; is the CLI built from this branch (slice 0079)?`);
  // The package itself is read, whatever the map said: no agent file names a model this study never uses (a pin on a node would win over the map).
  built.agentModels = agentModels(built.scratch, built.graphId);
  const never = Object.entries(built.agentModels).filter(([, model]) => NEVER.test(model));
  if (never.length > 0) fail(`${proj.project}: the package would run ${never.map(([agent, model]) => `${agent.split("--").pop()} on ${model}`).join(", ")}, a model this study never uses`);
  const pkg = readPackage(built.scratch);
  const derived = derive(pkg, { heldOut: built.heldOut?.realDir });
  const n = roundCap(pkg.doc);
  const kickoff = pkg.kickoff;
  if (arm !== "A") {
    run("git", ["-C", built.scratch, "rm", "-rq", ".grooph", ".claude"]);
    run("git", ["-C", built.scratch, "commit", "-qm", arm === "D" ? "remove the package: this arm runs on the task alone" : "remove the package: this arm runs on the derived prompt alone"]);
    built.base = run("git", ["-C", built.scratch, "rev-parse", "HEAD"]).stdout.trim();
    for (const left of [".grooph", ".claude"]) rmSync(join(built.scratch, left), { recursive: true, force: true });
  }
  // A file of the held-out folder that is the scorer's alone (expect.json `held_out_scorer_only`: a suite no reviewer
  // is named, as when the template names its critic a reference, not a suite) leaves the folder before the run.
  const scorerOnly = (proj.expect.held_out_scorer_only ?? []).filter((name) => built.heldOut && existsSync(join(built.heldOut.dir, name)));
  if (arm !== "D" && scorerOnly.length > 0) {
    built.scoreDir = mkdtempSync(join(tmpdir(), "grooph-compare-scorer-"));
    for (const name of scorerOnly) renameSync(join(built.heldOut.dir, name), join(built.scoreDir, name));
    built.heldOut = { ...built.heldOut, scorer_only: scorerOnly };
  }
  if (arm !== "D") return { ...built, pkg, prompt: derived.prompt, derivation: derived.report, promptFile: "prompt-B.md", n, kickoff };

  // Arm D: the held-out suite is named to nobody. It leaves the scratch's side for the length of the run (the scorer
  // gets it back by path), no rule allows reading it, and the prompt is written from the task folder alone.
  const marks = [HELD_OUT_TOKEN, built.heldOut?.dir, built.heldOut?.realDir, "held-out"].filter(Boolean);
  if (built.heldOut) {
    const away = mkdtempSync(join(tmpdir(), "grooph-compare-scorer-"));
    renameSync(built.heldOut.dir, join(away, "suite"));
    built.heldOut = { ...built.heldOut, dir: join(away, "suite"), realDir: realpathSync(join(away, "suite")), named_to: "nobody", beside_scratch_during_run: false, scorer_only: scorerOnly };
    built.scoreDir = built.heldOut.realDir;
    built.scoreDirParent = away;
  }
  built.settings = BASE_SETTINGS;
  const d = deriveD({ task: proj.slots.values.task, testCommand: proj.testCommand, acceptance: proj.acceptance, heldOutMarks: marks });
  return { ...built, pkg, prompt: d.prompt, derivation: d.report, promptFile: "prompt-D.md", n: 1, kickoff };
}

/** The prompt an arm's committed file should hold: the held-out path as its token, so the file is the same on every machine. */
const tokenized = (built) => (built.heldOut && built.promptFile !== "prompt-D.md" ? built.prompt.replaceAll(built.heldOut.realDir, HELD_OUT_TOKEN) : built.prompt);

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
function invoke({ ledger, proj, arm, replicate, kind, iteration, retry, scratch, harnessDir, binDir, prompt, resumeSession, suffix, note, settings }) {
  const decision = gate(ledger, { project: proj.project, arm, replicate, kind: kind === "iteration" ? "iteration" : kind, retry });
  if (!decision.ok) fail(`the ledger refuses this ${kind}: ${decision.reason}`);
  const spentBefore = totals(ledger).spent;
  const entry = openRunEntry(ledger, { project: proj.project, arm, replicate, kind, iteration, maxBudget: decision.maxBudget, retry, sessionId: resumeSession, note });
  saveLedger(ledger);
  console.log(`ledger: invocation ${entry.n} opened; ${remainingText(decision.remaining)}, this one is capped at $${decision.maxBudget.toFixed(2)}`);

  const outPath = join(harnessDir, `claude-output${suffix}.json`);
  const errPath = join(harnessDir, `claude-stderr${suffix}.txt`);
  const settingsJson = JSON.stringify(settings);
  const args = ["-p", prompt, "--permission-mode", "acceptEdits", "--output-format", "json", "--settings", settingsJson, "--max-budget-usd", decision.maxBudget.toFixed(2), "--strict-mcp-config", "--model", proj.leadModel, "--effort", LEAD_EFFORT];
  if (resumeSession) args.push("--resume", resumeSession);
  const out = openSync(outPath, "w");
  const err = openSync(errPath, "w");
  const started = Date.now();
  const child = spawnSync("claude", args, { cwd: scratch, env: cleanEnv(`${binDir}:${process.env.PATH}`), stdio: ["ignore", out, err], timeout: RUN_TIMEOUT_MS });
  closeSync(out);
  closeSync(err);
  const wall = Math.round((Date.now() - started) / 1000);

  let output = null;
  try {
    output = JSON.parse(readFileSync(outPath, "utf8"));
  } catch {}
  const reported = typeof output?.total_cost_usd === "number" ? output.total_cost_usd : null;
  settleEntry(entry, {
    status: output === null ? "failed" : output.is_error ? "error" : "ok",
    cost_usd: reported === null ? null : Math.round(reported * 1e6) / 1e6,
    reported_cost_usd: reported,
    session_id: output?.session_id ?? resumeSession ?? null,
    note: [note, output?.subtype && output.subtype !== "success" ? `result ${output.subtype}` : "", child.error ? `spawn: ${child.error.message}` : "", child.status ? `exit ${child.status}` : ""].filter(Boolean).join("; "),
  });
  saveLedger(ledger);
  console.log(`claude exit ${child.status ?? child.signal ?? "?"} after ${wall}s; reported cost ${reported === null ? "unknown" : `$${reported.toFixed(4)}`}`);
  console.log(describe(ledger).split("\n")[0]);
  const notice = tripwireNotice(ledger, spentBefore);
  if (notice) console.log(`\n\x1b[33m${notice}\x1b[0m`);
  if (output === null) {
    const stderr = existsSync(errPath) ? readFileSync(errPath, "utf8").slice(0, 2000) : "";
    fail(`claude produced no JSON output${stderr ? `:\n${stderr}` : ""}`);
  }
  return { entry, output, wall, args: args.map((a) => (a === prompt ? "<prompt>" : a === settingsJson ? "<settings.json>" : a)), outFile: `claude-output${suffix}.json`, errFile: `claude-stderr${suffix}.txt` };
}

const remainingText = (remaining) => (Number.isFinite(remaining) ? `$${remaining.toFixed(2)} remains` : "no cap (the tripwires stand)");

// ── evidence common to every arm ─────────────────────────────────────────
function digestFor(invocations, scratch) {
  const sessions = [...new Set(invocations.map((inv) => inv.output.session_id).filter(Boolean))];
  return sessions.flatMap((sid) => digestTranscripts(sessionTranscripts(CLAUDE_DIR, sid), scratch).map((entry) => ({ session: sid, ...entry })));
}

function processMeasures(invocations, digest, heldOutDir) {
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
  const dispatches = digest.filter((e) => e.who === "lead").flatMap((e) => e.tool_uses.filter((u) => u.tool === "Agent" || u.tool === "Task")).map((u) => ({ subagent_type: u.subagent_type, description: u.description }));
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
    held_out: built.heldOut ? { dir: built.heldOut.realDir, files: built.heldOut.files, substituted_in: built.substituted, named_to: built.heldOut.named_to ?? "a reviewer, as the template names it to its critic", beside_scratch_during_run: built.heldOut.beside_scratch_during_run ?? true, scorer_only: built.heldOut.scorer_only ?? [] } : null,
    protocol: proj.protocol,
    study: proj.study,
    lead_model: proj.leadModel,
    lead_effort: LEAD_EFFORT,
    judge_model: proj.judgeModel,
    tier_map: proj.tierMap ? { ...proj.tierMap.map, said_as: `GROOPH_MODELS=${proj.tierMap.text}`, source: proj.tierMap.source } : null,
    agent_models: built.agentModels ?? null,
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
  const first = invoke({ ledger, proj, arm: "A", replicate: built.replicate, kind: "kickoff", retry, scratch: built.scratch, harnessDir: built.harnessDir, binDir, prompt: built.kickoff, suffix: "", note: retry ? `retry: ${retry}` : "", settings: built.settings });
  first.notesAfter = notesPath() ? readNotes(notesPath()).lines : 0;
  invocations.push(first);
  const runId = runFolders(join(built.scratch, ".grooph", built.graphId, "runs"))[0] ?? null;
  first.entry.run_id = runId;
  saveLedger(ledger);

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
      const second = invoke({ ledger, proj, arm: "A", replicate: built.replicate, kind: "resume", scratch: built.scratch, harnessDir: built.harnessDir, binDir, prompt, resumeSession: first.output.session_id, suffix: "-2", note: `scripted answer "${resume.answer}" at ${resume.gate}`, settings: built.settings });
      second.notesAfter = notesPath() ? readNotes(notesPath()).lines : 0;
      second.entry.run_id = runId;
      saveLedger(ledger);
      invocations.push(second);
    }
  }

  say(`copying the evidence into ${evidenceDir.slice(root.length + 1)}/`);
  // The proving runner's evidence copy and check, unchanged: runs/, package/, project.diff, digest, result.json.
  collect({ template: proj.template, experiment: proj, built, invocations, prompts, evidenceDir, harnessVersion, lead: { model: proj.leadModel, effort: LEAD_EFFORT } });
  const checked = await finishResult(evidenceDir, core, proj.template);
  const result = JSON.parse(readFileSync(join(evidenceDir, "result.json"), "utf8"));
  const digest = JSON.parse(readFileSync(join(evidenceDir, "transcript-digest.json"), "utf8"));
  const measures = processMeasures(invocations, digest, built.heldOut?.realDir);
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
  const measures = processMeasures(invocations, digest, built.heldOut?.realDir);
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
  const second = invoke({ ledger, proj, arm, replicate: built.replicate, kind: "resume", iteration: first.entry.iteration ?? undefined, scratch: built.scratch, harnessDir: built.harnessDir, binDir, prompt, resumeSession: first.output.session_id, suffix: `${suffix}-resume`, note: `scripted answer "${resume.answer}" at ${resume.gate}`, settings: built.settings });
  first.gate.resumed = true;
  second.gate = { answer: resume.answer, gate: resume.gate };
  return second;
}

function runArmB({ proj, built, ledger, binDir, retry, evidenceDir, harnessVersion }) {
  say("arm B: running the derived prompt in one headless session (this spends money)");
  const prompts = { "prompt-B.md": built.prompt };
  const inv = invoke({ ledger, proj, arm: "B", replicate: built.replicate, kind: "kickoff", retry, scratch: built.scratch, harnessDir: built.harnessDir, binDir, prompt: built.prompt, suffix: "", note: retry ? `retry: ${retry}` : "", settings: built.settings });
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
  const inv = invoke({ ledger, proj, arm: "D", replicate: built.replicate, kind: "kickoff", retry, scratch: built.scratch, harnessDir: built.harnessDir, binDir, prompt: built.prompt, suffix: "", note: retry ? `retry: ${retry}` : "", settings: built.settings });
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
    let inv = invoke({ ledger, proj, arm: "C", replicate: built.replicate, kind: i === 1 ? "kickoff" : "iteration", iteration: i, retry: i === 1 ? retry : undefined, scratch: built.scratch, harnessDir: built.harnessDir, binDir, prompt, suffix: `-${i}`, note: [i === 1 && retry ? `retry: ${retry}` : "", `iteration ${i} of ${n}`].filter(Boolean).join("; "), settings: built.settings });
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
  const score = scoreTree({ tree: built.scratch, heldOutDir: built.scoreDir ?? built.heldOut?.realDir ?? null, testCommand: proj.testCommand, allowed: proj.expect.scope.allowed, protectedPaths: proj.expect.scope.protected ?? [], files, ending });
  if (built.heldOut) score.held_out.suite = built.heldOut.files;
  writeFileSync(join(evidenceDir, "score.json"), `${JSON.stringify(score, null, 2)}\n`, "utf8");
  console.log(`held-out ${score.held_out.ran ? `${score.held_out.passed}/${score.held_out.cases}` : `not run (${score.held_out.reason})`} · tests ${score.tests.pass ? "pass" : "fail"} · outside scope ${score.scope.outside.length}${score.scope.protected_changed.length > 0 ? ` · protected changed: ${score.scope.protected_changed.join(", ")}` : ""} · ending ${score.ending.kind} (${score.ending.reason})`);
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

  const decision = gate(ledger, { project: proj.project, arm: "judge", replicate: null, kind: "kickoff", retry });
  if (dryRun) {
    say("dry run: the judge's prompt");
    console.log(prompt.slice(0, 1500));
    console.log(`… (${prompt.length} characters, ${candidates.length} candidates: ${candidates.map((c) => `${c.letter}=${c.run} (${c.files.length} files, ${c.redactions} redactions)`).join(", ")})`);
    console.log(decision.ok ? `the ledger would allow the judge call, capped at $${decision.maxBudget.toFixed(2)}` : `the ledger would refuse: ${decision.reason}`);
    console.log(`would run: claude -p "<judge prompt>" --output-format json --model ${proj.judgeModel} --tools "" --max-budget-usd ${decision.ok ? decision.maxBudget.toFixed(2) : "–"} --strict-mcp-config`);
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
  const entry = openRunEntry(ledger, { project: proj.project, arm: "judge", replicate: null, kind: "kickoff", maxBudget: decision.maxBudget, retry, note: `blind judge over ${candidates.length} candidates` });
  saveLedger(ledger);
  console.log(`ledger: invocation ${entry.n} opened; ${remainingText(decision.remaining)}, this one is capped at $${decision.maxBudget.toFixed(2)}`);

  const cwd = mkdtempSync(join(tmpdir(), "grooph-compare-judge-"));
  const args = ["-p", prompt, "--output-format", "json", "--model", proj.judgeModel, "--tools", "", "--max-budget-usd", decision.maxBudget.toFixed(2), "--strict-mcp-config"];
  const started = Date.now();
  const child = spawnSync("claude", args, { cwd, env: cleanEnv(process.env.PATH), encoding: "utf8", maxBuffer: 64 << 20, timeout: 30 * 60 * 1000 });
  const wall = Math.round((Date.now() - started) / 1000);
  rmSync(cwd, { recursive: true, force: true });
  let output = null;
  try {
    output = JSON.parse(child.stdout);
  } catch {}
  const reported = typeof output?.total_cost_usd === "number" ? output.total_cost_usd : null;
  settleEntry(entry, { status: output === null ? "failed" : output.is_error ? "error" : "ok", cost_usd: reported === null ? null : Math.round(reported * 1e6) / 1e6, reported_cost_usd: reported, session_id: output?.session_id ?? null, note: [entry.note, output?.subtype && output.subtype !== "success" ? `result ${output.subtype}` : "", child.status ? `exit ${child.status}` : ""].filter(Boolean).join("; ") });
  saveLedger(ledger);
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
  const verdict = { project: proj.project, protocol: proj.protocol, study: proj.study, model: proj.judgeModel, models_reported: reportedModels, models_never_used: neverUsed(output.modelUsage), ledger_n: entry.n, cost_usd: reported, harness_turns: output.num_turns ?? null, wall_s: wall, candidates: candidates.map((c) => c.letter), parsed: parsed !== null, scores: parsed?.scores ?? null, ranking: parsed?.ranking ?? null, notes: parsed?.notes ?? null };
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
  const text = tokenized(built);
  writeFileSync(join(proj.dir, "prompt-B.md"), text, "utf8");
  writeFileSync(join(proj.dir, "loop-C.sh"), loopScript({ project: proj.project, n: built.n, testCommand: proj.testCommand, model: proj.leadModel, effort: LEAD_EFFORT }), { mode: 0o755 });
  console.log(JSON.stringify(built.derivation, null, 2));
  console.log(`N for arm C: ${built.n}\nwrote experiments/comparisons/${proj.project}/prompt-B.md (${text.length} characters) and loop-C.sh`);
  if (proj.tierMap?.provisional) console.log(`note: this prompt names the models of a provisional tier map (${proj.tierMap.text}); it is derived again, and committed again, when the project pre-registers its map`);
  rmSync(built.scratch, { recursive: true, force: true });
  rmSync(built.harnessDir, { recursive: true, force: true });
  if (built.scoreDir) rmSync(built.scoreDir, { recursive: true, force: true });
  if (proj.arms.includes("D")) {
    say(`writing ${proj.project}/prompt-D.md from the task folder alone (protocol §1, arm D)`);
    const d = buildFor(proj, "D");
    assertTaskOnly(proj, d);
    writeFileSync(join(proj.dir, "prompt-D.md"), d.prompt, "utf8");
    console.log(JSON.stringify(d.derivation, null, 2));
    console.log(`wrote experiments/comparisons/${proj.project}/prompt-D.md (${d.prompt.length} characters)`);
    rmSync(d.scratch, { recursive: true, force: true });
    rmSync(d.harnessDir, { recursive: true, force: true });
    if (d.scoreDirParent) rmSync(d.scoreDirParent, { recursive: true, force: true });
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
  const evidenceDir = join(proj.dir, `${arm}-${replicate}`);
  assertFreshBundle(proj.template);
  if (!args.dryRun) {
    if (existsSync(join(evidenceDir, "result.json"))) {
      if (!args.retry) fail(`${evidenceDir.slice(root.length + 1)} already holds a run's evidence; it is never overwritten. A failure outside the prompt or package may be retried once with --retry "<why>", which moves the evidence to ${arm}-${replicate}-failed-<k>/`);
      const k = readdirSync(proj.dir).filter((n) => n.startsWith(`${arm}-${replicate}-failed`)).length + 1;
      renameSync(evidenceDir, join(proj.dir, `${arm}-${replicate}-failed-${k}`));
      console.log(`moved the earlier evidence to ${arm}-${replicate}-failed-${k}/`);
    }
    if (spawnSync("claude", ["--version"], { encoding: "utf8" }).status !== 0) fail("claude is not on PATH; install Claude Code first");
    if (!claudeSignedIn()) fail("the claude CLI is not signed in, so a headless run would fail. Sign in with `claude auth login` and run this again.");
  }

  say(`building the scratch project for ${proj.project}, arm ${arm}, replicate ${replicate}`);
  const built = buildFor(proj, arm);
  built.replicate = replicate;
  console.log(`scratch project: ${built.scratch}\ngraph: ${built.graphId} (from ${built.doc.lineage?.from ?? `${proj.template} v${built.doc.version ?? "?"}`})\nbase commit: ${built.base}${arm !== "A" ? " (package removed)" : ""}`);
  if (built.heldOut && arm === "D") console.log(`held-out: ${built.heldOut.realDir} (${built.heldOut.files.map((f) => f.path).join(", ")}); moved away from the scratch for the run and named to nobody: no task file, no rule and no line of the prompt points at it; the scorer runs it afterwards`);
  else if (built.heldOut) console.log(`${built.heldOut.scorer_only?.length > 0 ? `the scorer's alone, moved out of the held-out folder for the run: ${built.heldOut.scorer_only.join(", ")}\n` : ""}` + `held-out: ${built.heldOut.realDir} (${built.heldOut.files.map((f) => f.path).join(", ")}); the token replaced in ${built.substituted.length > 0 ? built.substituted.join(", ") : "no task file"}; Read allowed there by rule; named ${built.derivation.held_out_mentions?.prompt ?? 0} time(s) in the prompt, ${built.derivation.held_out_mentions?.package ?? 0} in the package`);
  if (arm === "D") assertTaskOnly(proj, built);
  if (arm !== "A") assertPromptCurrent(proj, built);

  const binDir = mkdtempSync(join(tmpdir(), "grooph-compare-bin-"));
  writeFileSync(join(binDir, "grooph"), `#!/bin/sh\nexec "${process.execPath}" "${CLI}" "$@"\n`, { mode: 0o755 });
  try {
    const harnessVersion = spawnSync("claude", ["--version"], { encoding: "utf8" }).stdout?.trim() ?? null;
    if (args.dryRun) {
      say("dry run: everything but the model call");
      const files = run("git", ["-C", built.scratch, "ls-files"]).stdout.trim().split("\n");
      console.log(files.map((f) => `  ${f}`).join("\n"));
      const decision = gate(ledger, { project: proj.project, arm, replicate, kind: "kickoff", retry: args.retry });
      console.log(describe(ledger).split("\n")[0]);
      console.log(decision.ok ? `the ledger would allow the kickoff, capped at $${decision.maxBudget.toFixed(2)}` : `the ledger would refuse: ${decision.reason}`);
      const common = `--permission-mode acceptEdits --output-format json --settings '<${built.settings.permissions.allow.length} allow rules>' --max-budget-usd ${decision.ok ? decision.maxBudget.toFixed(2) : "–"} --strict-mcp-config --model ${proj.leadModel} --effort ${LEAD_EFFORT}`;
      if (proj.tierMap) console.log(built.exportOutput.split("\n").filter((line) => /^tiers in this package|^note:/.test(line)).join("\n"));
      if (arm === "A") {
        console.log(`would run in ${built.scratch}:\n  claude -p "$(cat .grooph/${built.graphId}/KICKOFF.md)" ${common}`);
        if (proj.expect.resume) console.log(`then, only after a halt at ${proj.expect.resume.gate}, once: claude -p "<scripted ${proj.expect.resume.answer}>" --resume <session id> …`);
      } else if (arm === "B") {
        console.log(`would run in ${built.scratch}:\n  claude -p "$(cat prompt-B.md)" ${common}`);
        if (proj.expect.resume?.prompt_arm) console.log(`then, only if the tree shows a halt at ${proj.expect.resume.gate} (${(proj.expect.resume.planning_outputs ?? []).join(", ")} present, src/ and tests/ untouched), once: claude -p "<scripted ${proj.expect.resume.answer}>" --resume <session id> …`);
      } else if (arm === "D") {
        console.log(`would run in ${built.scratch}:\n  claude -p "$(cat prompt-D.md)" ${common}`);
      } else {
        console.log(`would run in ${built.scratch}, for i in 1..${built.n}, each its own ledger line with its own ceiling:\n  claude -p "$(cat prompt-B.md)\\n\\nIteration $i of ${built.n}. Continue from the working tree as it is. Stop when your done check passes. ${DONE_LINE.slice(0, 60)}…" ${common}\n  stopping early when the reply's last line is \`done: yes\` and \`${proj.testCommand}\` exits 0`);
        if (proj.expect.resume?.prompt_arm) console.log(`the iteration that halts at ${proj.expect.resume.gate} is resumed once with the scripted ${proj.expect.resume.answer}; later iterations are told it was given`);
      }
      console.log(`prompt for this arm: ${arm === "A" ? "KICKOFF.md" : built.promptFile} (${(arm === "A" ? built.kickoff : built.prompt).length} characters)${arm !== "A" ? `; matches the committed ${built.promptFile}` : ""}`);
      if (proj.expect.judge?.artifact) console.log(`would render the artifact for the judge from the final tree: \`${proj.expect.judge.artifact.command}\` → ${proj.expect.judge.artifact.path}`);
      console.log(`would score the final tree against ${built.heldOut ? `${built.heldOut.files.length} held-out file(s)` : "no held-out suite"}, \`${proj.testCommand}\`, and the allowed paths ${proj.expect.scope.allowed.join(", ")}`);
      console.log(`would copy the evidence into experiments/comparisons/${proj.project}/${arm}-${replicate}/`);
      say("dry run done; the model was not called and the ledger is unchanged");
      return 0;
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
    console.log(`evidence  experiments/comparisons/${proj.project}/${arm}-${replicate}/\nscratch   ${built.scratch}\ncost      $${(result.cost_usd ?? 0).toFixed(4)} · turns ${result.harness_turns} · ending ${score.ending.kind}`);
    console.log(`models    ${Object.keys(result.models ?? {}).join(", ") || "none reported"}`);
    const never = result.process?.models_never_used ?? [];
    if (never.length > 0) return flagNever(never, `${proj.project}/${arm}-${replicate}`);
    const next = nextRun(proj);
    console.log(next ? `next in the alternation: ${next.arm}-${next.replicate}` : "all planned runs exist; --judge is next");
    return 0;
  } finally {
    rmSync(binDir, { recursive: true, force: true });
    // What was moved away for the run (arm D's held-out folder; a suite that is the scorer's alone) has been scored, or the run did not happen.
    const moved = built.scoreDirParent ?? (built.scoreDir && built.scoreDir !== built.heldOut?.realDir ? built.scoreDir : null);
    if (moved) rmSync(moved, { recursive: true, force: true });
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
