/**
 * The paired-comparison runner (handoff 0016, criteria 1, 5 and 6; protocol
 * docs/comparisons.md). Entry point: scripts/compare.sh, which documents the usage.
 *
 * Three arms on one project, under identical conditions (§2):
 *
 *   A  the template's package, headless, as scripts/prove-pattern.sh runs a
 *      proving run: the same scratch build, settings, invocation, evidence copy
 *      and check (their functions are imported from prove-pattern.mjs);
 *   B  the derived prompt (compare-prompt.mjs) in one headless session, in the
 *      same scratch with the package removed;
 *   C  the derived prompt in a fresh headless session up to N times, N the
 *      loop's round cap, each iteration told to continue from the working tree;
 *      the loop ends early when the reply's last line says done and the test
 *      command passes.
 *
 * Every arm: `--model claude-opus-5 --effort high`, the proving allowlist plus
 * `Read` on the held-out folder, `--strict-mcp-config`, one dollar ceiling per
 * invocation from the comparisons ledger, an isolated scratch per run built from
 * the committed task folder. The scorer (compare-score.mjs) runs on the final
 * tree; the result, the diff, the harness output and (for A) the run record go
 * to experiments/comparisons/<project>/<arm>-<replicate>/.
 *
 * The blind judge (§6): one call to a frontier model with no tools, given the
 * task, the acceptance material the builder saw, and each run's deliverable
 * diff under a random letter in random order; the letters' mapping is written
 * beside the verdict and applied only by compare-summary.mjs.
 */

import { spawnSync } from "node:child_process";
import { closeSync, cpSync, existsSync, mkdirSync, mkdtempSync, openSync, readFileSync, readdirSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { checkRun } from "./prove-check.mjs";
import { digestTranscripts, projectDiff, readNotes, redactHome, runFolders, sessionTranscripts } from "./prove-evidence.mjs";
import { HELD_OUT_TOKEN, Refusal, assertFreshBundle, buildScratch, claudeSignedIn, cleanEnv, collect, fail, finishResult, run, say } from "./prove-pattern.mjs";
import { describe, gate, loadLedger, openRunEntry, saveLedger, settleEntry } from "./compare-ledger.mjs";
import { DONE_LINE, derive, iterationPrompt, loopScript, readPackage, roundCap, saysDone } from "./compare-prompt.mjs";
import { scoreTree } from "./compare-score.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const CLI = join(root, "packages", "cli", "bin", "grooph.js");
const CORE = join(root, "packages", "core", "dist", "src", "index.js");
export const COMPARISONS = join(root, "experiments", "comparisons");
const HOME = process.env.HOME ?? "";
const CLAUDE_DIR = process.env.CLAUDE_CONFIG_DIR ?? join(HOME, ".claude");
const RUN_TIMEOUT_MS = 60 * 60 * 1000;

/** Equal across arms (§2): the lead's model and effort, pinned on the command line so the record can say so. */
export const LEAD_MODEL = "claude-opus-5";
export const LEAD_EFFORT = "high";
/** The blind judge: a frontier model, no tools. */
export const JUDGE_MODEL = "claude-fable-5-1";
export const ARMS = ["A", "B", "C"];

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
  return { project, dir, template, slots, expect, fragment: false, heldOut, replicates: expect.replicates ?? 2, testCommand: slots.values["test-command"] };
}

/** The run folders a project has: { "A-1": path, … }. */
export function runDirs(projectDir) {
  const out = {};
  for (const name of readdirSync(projectDir)) {
    if (/^[ABC]-\d+$/.test(name) && existsSync(join(projectDir, name, "result.json"))) out[name] = join(projectDir, name);
  }
  return out;
}

/** The alternation A1, B1, C1, A2, B2, C2 … (§5): the next run not yet on disk. */
export function nextRun(proj) {
  const have = runDirs(proj.dir);
  for (let r = 1; r <= proj.replicates; r += 1) {
    for (const arm of ARMS) if (!have[`${arm}-${r}`]) return { arm, replicate: r };
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
  const built = buildScratch(proj.template, proj, `grooph-compare-${proj.project}-${arm}-`);
  const pkg = readPackage(built.scratch);
  const derived = derive(pkg, { heldOut: built.heldOut?.realDir });
  const n = roundCap(pkg.doc);
  const kickoff = pkg.kickoff;
  if (arm !== "A") {
    run("git", ["-C", built.scratch, "rm", "-rq", ".grooph", ".claude"]);
    run("git", ["-C", built.scratch, "commit", "-qm", "remove the package: this arm runs on the derived prompt alone"]);
    built.base = run("git", ["-C", built.scratch, "rev-parse", "HEAD"]).stdout.trim();
    for (const left of [".grooph", ".claude"]) rmSync(join(built.scratch, left), { recursive: true, force: true });
  }
  return { ...built, pkg, prompt: derived.prompt, derivation: derived.report, n, kickoff };
}

/** The committed prompt (with the token) must be what the package derives today, or the run measures a stale prompt. */
function assertPromptCurrent(proj, built) {
  const committed = join(proj.dir, "prompt-B.md");
  if (!existsSync(committed)) fail(`${proj.project}/prompt-B.md is not committed: run scripts/compare.sh ${proj.project} --derive first`);
  const tokenised = built.heldOut ? built.prompt.replaceAll(built.heldOut.realDir, HELD_OUT_TOKEN) : built.prompt;
  if (readFileSync(committed, "utf8") !== tokenised) fail(`${proj.project}/prompt-B.md differs from the prompt the package derives now: re-run --derive and commit it before running`);
}

// ── one model-calling invocation ─────────────────────────────────────────
function invoke({ ledger, proj, arm, replicate, kind, iteration, retry, scratch, harnessDir, binDir, prompt, resumeSession, suffix, note, settings }) {
  const decision = gate(ledger, { project: proj.project, arm, replicate, kind: kind === "iteration" ? "iteration" : kind, retry });
  if (!decision.ok) fail(`the ledger refuses this ${kind}: ${decision.reason}`);
  const entry = openRunEntry(ledger, { project: proj.project, arm, replicate, kind, iteration, maxBudget: decision.maxBudget, retry, sessionId: resumeSession, note });
  saveLedger(ledger);
  console.log(`ledger: invocation ${entry.n} opened; $${decision.remaining.toFixed(2)} remains, this one is capped at $${decision.maxBudget.toFixed(2)}`);

  const outPath = join(harnessDir, `claude-output${suffix}.json`);
  const errPath = join(harnessDir, `claude-stderr${suffix}.txt`);
  const settingsJson = JSON.stringify(settings);
  const args = ["-p", prompt, "--permission-mode", "acceptEdits", "--output-format", "json", "--settings", settingsJson, "--max-budget-usd", decision.maxBudget.toFixed(2), "--strict-mcp-config", "--model", LEAD_MODEL, "--effort", LEAD_EFFORT];
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
  if (output === null) {
    const stderr = existsSync(errPath) ? readFileSync(errPath, "utf8").slice(0, 2000) : "";
    fail(`claude produced no JSON output${stderr ? `:\n${stderr}` : ""}`);
  }
  return { entry, output, wall, args: args.map((a) => (a === prompt ? "<prompt>" : a === settingsJson ? "<settings.json>" : a)), outFile: `claude-output${suffix}.json`, errFile: `claude-stderr${suffix}.txt` };
}

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
      if (uses.length > 0) touched[entry.who] = uses.length;
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
    held_out: built.heldOut ? { dir: built.heldOut.realDir, files: built.heldOut.files, substituted_in: built.substituted } : null,
    lead_model: LEAD_MODEL,
    lead_effort: LEAD_EFFORT,
    permission_allow_rules: built.settings.permissions.allow.length,
    strict_mcp_config: true,
    harness_version: harnessVersion,
    template: proj.template,
    template_version: built.doc.version ?? null,
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
  collect({ template: proj.template, experiment: proj, built, invocations, prompts, evidenceDir, harnessVersion });
  const checked = await finishResult(evidenceDir, core, proj.template);
  const result = JSON.parse(readFileSync(join(evidenceDir, "result.json"), "utf8"));
  const digest = JSON.parse(readFileSync(join(evidenceDir, "transcript-digest.json"), "utf8"));
  const measures = processMeasures(invocations, digest, built.heldOut?.realDir);
  Object.assign(result, {
    arm: "A",
    replicate: built.replicate,
    project: proj.project,
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

function runArmB({ proj, built, ledger, binDir, retry, evidenceDir, harnessVersion }) {
  say("arm B: running the derived prompt in one headless session (this spends money)");
  const inv = invoke({ ledger, proj, arm: "B", replicate: built.replicate, kind: "kickoff", retry, scratch: built.scratch, harnessDir: built.harnessDir, binDir, prompt: built.prompt, suffix: "", note: retry ? `retry: ${retry}` : "", settings: built.settings });
  say(`copying the evidence into ${evidenceDir.slice(root.length + 1)}/`);
  return collectPromptArm({ proj, built, arm: "B", invocations: [inv], prompts: { "prompt-B.md": built.prompt }, evidenceDir, harnessVersion, ending: endingOfB(inv) });
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
  for (let i = 1; i <= n; i += 1) {
    const prompt = iterationPrompt(built.prompt, i, n);
    prompts[`iteration-${i}.md`] = prompt;
    const inv = invoke({ ledger, proj, arm: "C", replicate: built.replicate, kind: i === 1 ? "kickoff" : "iteration", iteration: i, retry: i === 1 ? retry : undefined, scratch: built.scratch, harnessDir: built.harnessDir, binDir, prompt, suffix: `-${i}`, note: [i === 1 && retry ? `retry: ${retry}` : "", `iteration ${i} of ${n}`].filter(Boolean).join("; "), settings: built.settings });
    inv.saysDone = saysDone(inv.output.result);
    inv.testsAfter = testsPass(built.scratch, proj.testCommand);
    invocations.push(inv);
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

// ── scoring ──────────────────────────────────────────────────────────────
function scoreRun({ proj, built, evidenceDir, files, ending }) {
  say("scoring the final tree (identically for every arm)");
  const score = scoreTree({ tree: built.scratch, heldOutDir: built.heldOut?.realDir ?? null, testCommand: proj.testCommand, allowed: proj.expect.scope.allowed, protectedPaths: proj.expect.scope.protected ?? [], files, ending });
  if (built.heldOut) score.held_out.suite = built.heldOut.files;
  writeFileSync(join(evidenceDir, "score.json"), `${JSON.stringify(score, null, 2)}\n`, "utf8");
  console.log(`held-out ${score.held_out.ran ? `${score.held_out.passed}/${score.held_out.cases}` : `not run (${score.held_out.reason})`} · tests ${score.tests.pass ? "pass" : "fail"} · outside scope ${score.scope.outside.length}${score.scope.protected_changed.length > 0 ? ` · protected changed: ${score.scope.protected_changed.join(", ")}` : ""} · ending ${score.ending.kind} (${score.ending.reason})`);
  return score;
}

// ── the blind judge ──────────────────────────────────────────────────────

/** Letters for the candidates: never A, B or C (the arms' names), drawn at random, in random order. */
export function drawLetters(count, random = Math.random) {
  const pool = "DEFGHJKLMNPQRSTUVWXYZ".split("");
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

export function judgePrompt({ proj, taskFiles, candidates }) {
  const acceptance = taskFiles.map(({ path, text }) => `### ${path}\n\n\`\`\`\n${text.trimEnd()}\n\`\`\``).join("\n\n");
  const body = candidates.map(({ letter, diff }) => `## Candidate ${letter}\n\n\`\`\`diff\n${diff.trimEnd() || "(no change to the deliverable paths)"}\n\`\`\``).join("\n\n");
  const letters = candidates.map((c) => c.letter);
  return `You are a critic judging ${candidates.length} candidate changes to one small Node project. Each candidate was produced by a different session working from the same task; you do not know how, and you should not guess. Judge only what the diff shows against the task and its acceptance material. You have no tools: read carefully and cite lines of the diff.

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
  const planned = proj.replicates * ARMS.length;
  if (names.length < planned) console.log(`note: ${names.length} of the ${planned} planned runs exist; the judge sees what exists`);
  const judgeDir = join(proj.dir, "judge");
  if (existsSync(join(judgeDir, "verdict.json")) && !dryRun && !retry) fail(`${proj.project}/judge already holds a verdict; it is never overwritten (pass --retry "<why>" for the one retry, which moves it aside)`);

  const paths = proj.expect.judge?.files ?? proj.expect.scope.allowed;
  const taskFiles = (proj.expect.judge?.acceptance ?? []).map((path) => ({ path, text: readFileSync(join(proj.dir, "task", path), "utf8").replaceAll(HELD_OUT_TOKEN, "<a folder outside the project>") }));
  const order = shuffle(names);
  const letters = drawLetters(order.length);
  const candidates = order.map((name, i) => {
    const { text, redactions, files } = judgedDiff(readFileSync(join(dirs[name], "project.diff"), "utf8"), paths);
    return { letter: letters[i], run: name, diff: text, redactions, files };
  });
  const prompt = judgePrompt({ proj, taskFiles, candidates });
  const mapping = { about: "Which run each letter stood for. Written by the runner beside the verdict and read only by compare-summary.mjs; the judge never saw it.", letters: Object.fromEntries(candidates.map((c) => [c.letter, c.run])), order: candidates.map((c) => c.letter), files_judged: paths, redactions: Object.fromEntries(candidates.map((c) => [c.run, c.redactions])) };

  const decision = gate(ledger, { project: proj.project, arm: "judge", replicate: null, kind: "kickoff", retry });
  if (dryRun) {
    say("dry run: the judge's prompt");
    console.log(prompt.slice(0, 1500));
    console.log(`… (${prompt.length} characters, ${candidates.length} candidates: ${candidates.map((c) => `${c.letter}=${c.run} (${c.files.length} files, ${c.redactions} redactions)`).join(", ")})`);
    console.log(decision.ok ? `the ledger would allow the judge call, capped at $${decision.maxBudget.toFixed(2)}` : `the ledger would refuse: ${decision.reason}`);
    console.log(`would run: claude -p "<judge prompt>" --output-format json --model ${JUDGE_MODEL} --tools "" --max-budget-usd ${decision.ok ? decision.maxBudget.toFixed(2) : "–"} --strict-mcp-config`);
    say("dry run done; the model was not called and nothing was written");
    return 0;
  }
  if (!decision.ok) fail(`the ledger refuses the judge call: ${decision.reason}`);
  if (existsSync(judgeDir)) {
    const k = readdirSync(proj.dir).filter((n) => n.startsWith("judge-failed")).length + 1;
    renameSync(judgeDir, join(proj.dir, `judge-failed-${k}`));
  }
  mkdirSync(judgeDir, { recursive: true });
  const entry = openRunEntry(ledger, { project: proj.project, arm: "judge", replicate: null, kind: "kickoff", maxBudget: decision.maxBudget, retry, note: `blind judge over ${candidates.length} candidates` });
  saveLedger(ledger);
  console.log(`ledger: invocation ${entry.n} opened; $${decision.remaining.toFixed(2)} remains, this one is capped at $${decision.maxBudget.toFixed(2)}`);

  const cwd = mkdtempSync(join(tmpdir(), "grooph-compare-judge-"));
  const args = ["-p", prompt, "--output-format", "json", "--model", JUDGE_MODEL, "--tools", "", "--max-budget-usd", decision.maxBudget.toFixed(2), "--strict-mcp-config"];
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
  writeFileSync(join(judgeDir, "claude-output.json"), child.stdout ?? "", "utf8");
  if (child.stderr?.trim()) writeFileSync(join(judgeDir, "claude-stderr.txt"), child.stderr, "utf8");
  if (output === null) fail("the judge call produced no JSON output; its stderr is in judge/claude-stderr.txt");

  const reply = String(output.result ?? "");
  writeFileSync(join(judgeDir, "transcript.md"), `# Blind judge · ${proj.project}\n\nModel \`${JUDGE_MODEL}\`, no tools, fresh session, ${new Date().toISOString()}; ledger invocation ${entry.n}, $${(reported ?? 0).toFixed(4)}. The letters' mapping is in \`mapping.json\`, which the judge never saw.\n\n## Prompt\n\n${prompt}\n\n## Reply\n\n${reply}\n`, "utf8");
  const parsed = parseVerdict(reply);
  const verdict = { project: proj.project, model: JUDGE_MODEL, ledger_n: entry.n, cost_usd: reported, harness_turns: output.num_turns ?? null, wall_s: wall, candidates: candidates.map((c) => c.letter), parsed: parsed !== null, scores: parsed?.scores ?? null, ranking: parsed?.ranking ?? null, notes: parsed?.notes ?? null };
  writeFileSync(join(judgeDir, "verdict.json"), `${JSON.stringify(verdict, null, 2)}\n`, "utf8");
  writeFileSync(join(judgeDir, "mapping.json"), `${JSON.stringify(mapping, null, 2)}\n`, "utf8");
  redactHome(judgeDir, HOME);
  say(parsed ? "verdict recorded" : "the judge replied but its JSON block could not be parsed; transcript kept, verdict.json marks parsed: false");
  console.log(`judge/  transcript.md, verdict.json, mapping.json (ranking ${parsed?.ranking?.join(" > ") ?? "?"})`);
  return parsed ? 0 : 1;
}

// ── derive ───────────────────────────────────────────────────────────────
function writeDerivation(proj) {
  assertFreshBundle(proj.template);
  say(`deriving ${proj.project}/prompt-B.md and loop-C.sh from the package (protocol §3)`);
  const built = buildFor(proj, "B");
  const tokenised = built.heldOut ? built.prompt.replaceAll(built.heldOut.realDir, HELD_OUT_TOKEN) : built.prompt;
  writeFileSync(join(proj.dir, "prompt-B.md"), tokenised, "utf8");
  writeFileSync(join(proj.dir, "loop-C.sh"), loopScript({ project: proj.project, n: built.n, testCommand: proj.testCommand }), { mode: 0o755 });
  console.log(JSON.stringify(built.derivation, null, 2));
  console.log(`N for arm C: ${built.n}\nwrote experiments/comparisons/${proj.project}/prompt-B.md (${tokenised.length} characters) and loop-C.sh`);
  rmSync(built.scratch, { recursive: true, force: true });
  rmSync(built.harnessDir, { recursive: true, force: true });
  return 0;
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
      console.log(`${name.padEnd(16)} not runnable yet: ${error.message}`);
      continue;
    }
    const have = Object.keys(runDirs(proj.dir)).sort();
    const next = nextRun(proj);
    const judged = existsSync(join(proj.dir, "judge", "verdict.json"));
    console.log(`${name.padEnd(16)} runs ${have.length}/${proj.replicates * ARMS.length} [${have.join(" ")}]${next ? `  next ${next.arm}-${next.replicate}` : "  all runs done"}${judged ? "  judged" : ""}${existsSync(join(proj.dir, "prompt-B.md")) ? "" : "  (no prompt-B.md yet)"}`);
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
  if (!args.project) fail("usage: scripts/compare.sh <project> <A|B|C> [--replicate n] [--retry <why>] [--dry-run] | <project> --derive | <project> --judge [--dry-run] | <project> --next [--dry-run] | --score <run dir> [--write] | --status");
  if (!existsSync(CORE) || !existsSync(join(root, "packages", "cli", "dist", "src", "index.js"))) fail("build the repo first: pnpm install && pnpm -r build");
  const core = await import(CORE);
  const proj = loadProject(args.project);
  if (args.derive) return writeDerivation(proj);

  const ledger = loadLedger();
  if (args.judge) return runJudge({ proj, ledger, dryRun: args.dryRun, retry: args.retry });

  let { arm, replicate } = args;
  if (args.next) {
    const next = nextRun(proj);
    if (!next) fail(`${proj.project}: all ${proj.replicates * ARMS.length} planned runs exist`);
    ({ arm, replicate } = next);
    console.log(`next in the alternation: ${arm}-${replicate}`);
  }
  if (!arm) fail("name the arm: A, B or C (or --next)");
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
  console.log(`scratch project: ${built.scratch}\ngraph: ${built.graphId} (${proj.template} v${built.doc.version ?? "?"})\nbase commit: ${built.base}${arm !== "A" ? " (package removed)" : ""}`);
  if (built.heldOut) console.log(`held-out: ${built.heldOut.realDir} (${built.heldOut.files.map((f) => f.path).join(", ")}); the token replaced in ${built.substituted.length > 0 ? built.substituted.join(", ") : "no task file"}; Read allowed there by rule; named ${built.derivation.held_out_mentions?.prompt ?? 0} time(s) in the prompt, ${built.derivation.held_out_mentions?.package ?? 0} in the package`);
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
      const common = `--permission-mode acceptEdits --output-format json --settings '<${built.settings.permissions.allow.length} allow rules>' --max-budget-usd ${decision.ok ? decision.maxBudget.toFixed(2) : "–"} --strict-mcp-config --model ${LEAD_MODEL} --effort ${LEAD_EFFORT}`;
      if (arm === "A") {
        console.log(`would run in ${built.scratch}:\n  claude -p "$(cat .grooph/${built.graphId}/KICKOFF.md)" ${common}`);
        if (proj.expect.resume) console.log(`then, only after a halt at ${proj.expect.resume.gate}, once: claude -p "<scripted ${proj.expect.resume.answer}>" --resume <session id> …`);
      } else if (arm === "B") {
        console.log(`would run in ${built.scratch}:\n  claude -p "$(cat prompt-B.md)" ${common}`);
      } else {
        console.log(`would run in ${built.scratch}, for i in 1..${built.n}, each its own ledger line with its own ceiling:\n  claude -p "$(cat prompt-B.md)\\n\\nIteration $i of ${built.n}. Continue from the working tree as it is. Stop when your done check passes. ${DONE_LINE.slice(0, 60)}…" ${common}\n  stopping early when the reply's last line is \`done: yes\` and \`${proj.testCommand}\` exits 0`);
      }
      console.log(`prompt for this arm: ${arm === "A" ? "KICKOFF.md" : "prompt-B.md"} (${(arm === "A" ? built.kickoff : built.prompt).length} characters)${arm !== "A" ? "; matches the committed prompt-B.md" : ""}`);
      console.log(`would score the final tree against ${built.heldOut ? `${built.heldOut.files.length} held-out file(s)` : "no held-out suite"}, \`${proj.testCommand}\`, and the allowed paths ${proj.expect.scope.allowed.join(", ")}`);
      console.log(`would copy the evidence into experiments/comparisons/${proj.project}/${arm}-${replicate}/`);
      say("dry run done; the model was not called and the ledger is unchanged");
      return 0;
    }

    const context = { proj, built, ledger, binDir, retry: args.retry, evidenceDir, harnessVersion, core };
    const { result, files } = arm === "A" ? await runArmA(context) : arm === "B" ? runArmB(context) : runArmC(context);
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
    const next = nextRun(proj);
    console.log(next ? `next in the alternation: ${next.arm}-${next.replicate}` : "all planned runs exist; --judge is next");
    return 0;
  } finally {
    rmSync(binDir, { recursive: true, force: true });
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
