/**
 * The pattern proving runner (handoff 0009, criteria 1–4). Entry point:
 * scripts/prove-pattern.sh, which documents the usage.
 */

import { spawnSync } from "node:child_process";
import { closeSync, cpSync, existsSync, mkdirSync, mkdtempSync, openSync, readFileSync, readdirSync, realpathSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { checkRun, printCheck } from "./prove-check.mjs";
import { digestTranscripts, projectDiff, readNotes, redactHome, runFolders, sessionTranscripts, sha256 } from "./prove-evidence.mjs";
import { describe, gate, loadLedger, openEntry, saveLedger, settleEntry } from "./prove-ledger.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const CLI = join(root, "packages", "cli", "bin", "grooph.js");
const CORE = join(root, "packages", "core", "dist", "src", "index.js");
const EXPERIMENTS = join(root, "experiments", "patterns");
const HOME = process.env.HOME ?? "";
const CLAUDE_DIR = process.env.CLAUDE_CONFIG_DIR ?? join(HOME, ".claude");
const RUN_TIMEOUT_MS = 60 * 60 * 1000;

/** The templates the runner may run: the sixteen built-in patterns (handoff 0009 named five; handoff 0011 the rest). */
const PROVABLE = [
  "grind-loop",
  "review-gate",
  "metric-sandwich",
  "spec-then-loop",
  "contradiction-seeker",
  "taste-polish",
  "dual-bar",
  "specialist-critic-bank",
  "heterogeneous-critic",
  "red-team-loop",
  "fresh-grind-rare-judge",
  "debate-then-build",
  "ownership-not-swarm",
  "tournament-then-judge",
  "retrospective-rewrite",
  "human-gated-irreversible",
];

/**
 * Held-out evidence (handoff 0011, criterion 2): cases a critic or judge holds and
 * the builder never sees. `experiments/patterns/<id>/held-out/` is copied beside
 * the scratch project, into `<scratch>.harness/held-out/`, never into the project
 * tree, and the token below in a slot value or a task file becomes that folder's
 * absolute path. The run's settings then allow `Read` under that folder (reads
 * outside the working directory otherwise prompt, and a headless prompt is a
 * denial); nothing else outside the project is readable by rule. Whether the
 * builder honours "not yours to read" is what the transcript digest records.
 */
const HELD_OUT_TOKEN = "<held-out>";
const TEXT_FILE = /\.(md|json|mjs|js|txt|cjs|ts)$/i;

/**
 * The permissions every run gets, passed with --settings so nothing outside the
 * scratch project is touched (review 0001, finding 11). Narrow on purpose, as in
 * scripts/e2e-claude-code.sh: compound commands match no prefix rule and are
 * refused, and each refusal is recorded. Added here: `date` (the lead stamps its
 * notes and reads its run id from the clock), `git show` and `git rev-parse` (a
 * critic reading the repository), and since slice 0010 `echo`, `cp` and `tr`:
 * the first batch's denials were all shell plumbing of this kind, a turn each.
 * Since slice 0012 `git add -N` (intent-to-add stages nothing: it only makes an
 * added file show in `git diff`, which is what the leads of the second batch
 * wanted from it, seven denials across two runs). `git add` in any other form
 * still matches no rule.
 */
const BASE_SETTINGS = {
  permissions: {
    allow: [
      "Bash(npm test)",
      "Bash(npm test:*)",
      "Bash(npm run:*)",
      "Bash(node:*)",
      "Bash(git diff:*)",
      "Bash(git add -N:*)",
      "Bash(git status:*)",
      "Bash(git log:*)",
      "Bash(git show:*)",
      "Bash(git rev-parse:*)",
      "Bash(grooph validate:*)",
      "Bash(ls:*)",
      "Bash(cat:*)",
      "Bash(head:*)",
      "Bash(tail:*)",
      "Bash(wc:*)",
      "Bash(grep:*)",
      "Bash(find:*)",
      "Bash(mkdir:*)",
      "Bash(date:*)",
      "Bash(echo:*)",
      "Bash(cp:*)",
      "Bash(tr:*)",
    ],
  },
};

/** The run's settings: the base allowlist, plus `Read` under the held-out folder when the template has one (both the given and the real path, since macOS puts $TMPDIR behind a symlink and an allow rule must match both). */
function settingsFor(heldOut) {
  if (!heldOut) return BASE_SETTINGS;
  const paths = [...new Set([heldOut.dir, heldOut.realDir])];
  return { permissions: { allow: [...BASE_SETTINGS.permissions.allow, ...paths.map((path) => `Read(/${path}/**)`)] } };
}

const say = (text) => console.log(`\n\x1b[1m${text}\x1b[0m`);
class Refusal extends Error {}
const fail = (text) => {
  throw new Refusal(text);
};

// ── arguments ────────────────────────────────────────────────────────────
function parseArgs(argv) {
  const args = { template: undefined, dryRun: false, check: undefined, retry: undefined, status: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--dry-run") args.dryRun = true;
    else if (arg === "--check") args.check = argv[++i] ?? fail("--check needs the evidence folder of a run");
    else if (arg === "--retry") args.retry = argv[++i] ?? fail('--retry needs the reason: --retry "sign-in expired"');
    else if (arg === "--status") args.status = true;
    else if (arg.startsWith("-")) fail(`unknown argument: ${arg}`);
    else if (!args.template) args.template = arg;
    else fail(`unexpected argument: ${arg}`);
  }
  return args;
}

// ── helpers ──────────────────────────────────────────────────────────────
function run(command, args, options = {}) {
  const out = spawnSync(command, args, { encoding: "utf8", maxBuffer: 64 << 20, ...options });
  if (out.error) throw out.error;
  if (out.status !== 0 && !options.allowFail) {
    fail(`${command} ${args.join(" ")} exited ${out.status}\n${out.stderr ?? ""}${out.stdout ?? ""}`);
  }
  return out;
}

/**
 * The run is a fresh headless session: it gets a small, explicit environment, so
 * nothing from whatever launched the runner (a desktop or IDE session's CLAUDE_*
 * and ANTHROPIC_* variables, a messaging socket, an effort override) reaches it.
 * The CLI signs in with its own stored credentials.
 */
function cleanEnv(path) {
  const env = {
    HOME,
    PATH: path,
    TMPDIR: process.env.TMPDIR ?? "/tmp",
    USER: process.env.USER ?? "",
    LOGNAME: process.env.LOGNAME ?? process.env.USER ?? "",
    LANG: process.env.LANG ?? "en_US.UTF-8",
    SHELL: process.env.SHELL ?? "/bin/sh",
    TERM: process.env.TERM ?? "dumb",
  };
  if (process.env.CLAUDE_CONFIG_DIR) env.CLAUDE_CONFIG_DIR = process.env.CLAUDE_CONFIG_DIR;
  return env;
}

function loadExperiment(template) {
  const dir = join(EXPERIMENTS, template);
  for (const need of ["task", "slots.json", "expect.json"]) {
    if (!existsSync(join(dir, need))) fail(`experiments/patterns/${template}/${need} is missing`);
  }
  const slots = JSON.parse(readFileSync(join(dir, "slots.json"), "utf8"));
  const expect = JSON.parse(readFileSync(join(dir, "expect.json"), "utf8"));
  if (typeof slots.name !== "string") fail(`${template}/slots.json needs a "name" for the graph`);
  // A whole-graph template: { name, values }. A fragment: { name, host: { template, values }, insert: { values, prefix? }, ops? } —
  // the host is instantiated, the fragment inserted with `grooph template insert`, and the ops (grooph op list) wire it in.
  const fragment = slots.host !== undefined;
  if (fragment) {
    if (typeof slots.host?.template !== "string" || typeof slots.host?.values !== "object") fail(`${template}/slots.json: "host" needs { "template": "<id>", "values": {…} }`);
    if (typeof slots.insert?.values !== "object") fail(`${template}/slots.json: "insert" needs { "values": {…} }`);
    if (slots.ops !== undefined && !Array.isArray(slots.ops)) fail(`${template}/slots.json: "ops" must be a grooph op list`);
  } else if (typeof slots.values !== "object") fail(`${template}/slots.json needs { "name": "<graph name>", "values": { "<slot>": "<value>" } }`);
  const heldOutDir = join(dir, "held-out");
  const heldOut = existsSync(heldOutDir) ? heldOutDir : null;
  return { dir, slots, expect, fragment, heldOut };
}

/** Every text file under `dir` (recursively) holding the held-out token gets the folder's path in its place. Returns the files touched. */
function substituteHeldOut(dir, path) {
  const touched = [];
  const walk = (at) => {
    for (const name of readdirSync(at)) {
      const full = join(at, name);
      if (statSync(full).isDirectory()) {
        if (name !== ".git" && name !== "node_modules") walk(full);
      } else if (TEXT_FILE.test(name)) {
        const text = readFileSync(full, "utf8");
        if (text.includes(HELD_OUT_TOKEN)) {
          writeFileSync(full, text.replaceAll(HELD_OUT_TOKEN, path), "utf8");
          touched.push(full.slice(dir.length + 1));
        }
      }
    }
  };
  walk(dir);
  return touched;
}

// ── the scratch project ──────────────────────────────────────────────────
function buildScratch(template, experiment) {
  const scratch = mkdtempSync(join(process.env.TMPDIR ?? tmpdir(), `grooph-prove-${template}-`));
  const harnessDir = `${scratch}.harness`;
  mkdirSync(harnessDir);
  cpSync(join(experiment.dir, "task"), scratch, { recursive: true });

  // Held-out evidence goes beside the project, never into it; the token in slot values and task files becomes its real path.
  let heldOut = null;
  let substituted = [];
  if (experiment.heldOut) {
    const dir = join(harnessDir, "held-out");
    cpSync(experiment.heldOut, dir, { recursive: true });
    const realDir = realpathSync(dir);
    const files = readdirSync(dir).filter((name) => statSync(join(dir, name)).isFile()).sort();
    heldOut = { dir, realDir, files: files.map((name) => ({ path: name, sha256: sha256(join(dir, name)) })) };
    substituted = substituteHeldOut(scratch, realDir);
  }
  const fill = (values) => Object.fromEntries(Object.entries(values).map(([key, value]) => [key, heldOut ? String(value).replaceAll(HELD_OUT_TOKEN, heldOut.realDir) : String(value)]));

  run("git", ["-C", scratch, "init", "-q"]);
  run("git", ["-C", scratch, "config", "user.email", "prove@grooph.local"]);
  run("git", ["-C", scratch, "config", "user.name", "grooph prove"]);

  // Only this branch's built-in library may answer: no user templates, no remote.
  const groophHome = mkdtempSync(join(tmpdir(), "grooph-prove-home-"));
  const templateEnv = { ...process.env, GROOPH_HOME: groophHome, GROOPH_REGISTRY: "http://127.0.0.1:9/unreachable/index.json" };
  const docPath = join(groophHome, "instantiated.grooph.json");
  const setsOf = (values) => Object.entries(values).flatMap(([key, value]) => ["--set", `${key}=${value}`]);
  const built = { steps: [] };
  const filledSlots = {};
  if (experiment.fragment) {
    // A fragment is proved inside a host: instantiate the host, insert the fragment, wire it with the ops.
    const { host, insert, ops } = experiment.slots;
    filledSlots.host = fill(host.values);
    filledSlots.insert = fill(insert.values);
    const used = run(process.execPath, [CLI, "template", "use", host.template, "--name", experiment.slots.name, ...setsOf(filledSlots.host), "--out", docPath], { cwd: scratch, env: templateEnv });
    if (!/built-in/.test(`${used.stdout}${used.stderr}`)) fail(`grooph template use did not resolve the host ${host.template} from the built-in library:\n${used.stdout}${used.stderr}`);
    built.steps.push(`grooph template use ${host.template}`);
    const inserted = run(process.execPath, [CLI, "template", "insert", template, "--into", docPath, ...setsOf(filledSlots.insert), ...(insert.prefix ? ["--prefix", insert.prefix] : []), "--write"], { cwd: scratch, env: templateEnv });
    if (!/built-in/.test(`${inserted.stdout}${inserted.stderr}`)) fail(`grooph template insert did not resolve ${template} from the built-in library:\n${inserted.stdout}${inserted.stderr}`);
    built.steps.push(`grooph template insert ${template}`);
    built.insertOutput = inserted.stdout;
    if (ops && ops.length > 0) {
      const opsPath = join(groophHome, "wire.ops.json");
      writeFileSync(opsPath, `${JSON.stringify(ops, null, 2)}\n`, "utf8");
      run(process.execPath, [CLI, "apply", docPath, "--ops", opsPath, "--write"], { env: templateEnv });
      built.steps.push(`grooph apply (${ops.length} ops: ${ops.map((op) => op.op).join(", ")})`);
    }
  } else {
    filledSlots.values = fill(experiment.slots.values);
    const used = run(process.execPath, [CLI, "template", "use", template, "--name", experiment.slots.name, ...setsOf(filledSlots.values), "--out", docPath], { cwd: scratch, env: templateEnv });
    if (!/built-in/.test(`${used.stdout}${used.stderr}`)) fail(`grooph template use did not resolve ${template} from the built-in library:\n${used.stdout}${used.stderr}`);
  }
  const doc = JSON.parse(readFileSync(docPath, "utf8"));
  if (experiment.fragment) built.fragmentVersion = JSON.parse(readFileSync(join(root, "patterns", `${template}.grooph.json`), "utf8")).version;
  run(process.execPath, [CLI, "validate", "--for-export", docPath], { env: templateEnv });
  const exported = run(process.execPath, [CLI, "export", docPath, "--target", "claude-code", "--into", scratch], { env: templateEnv });
  rmSync(groophHome, { recursive: true, force: true });

  run("git", ["-C", scratch, "add", "-A"]);
  run("git", ["-C", scratch, "commit", "-qm", `task and the grooph package for ${template}`]);
  const base = run("git", ["-C", scratch, "rev-parse", "HEAD"]).stdout.trim();
  const sourcePath = join(scratch, ".grooph", doc.id, "graph.grooph.json");
  return {
    scratch,
    harnessDir,
    graphId: doc.id,
    doc,
    base,
    sourceSha: sha256(sourcePath),
    exportOutput: exported.stdout,
    heldOut,
    substituted,
    slots: filledSlots,
    fragment: experiment.fragment ? { host: experiment.slots.host.template, steps: built.steps, insertOutput: built.insertOutput ?? "" } : null,
    fragmentVersion: built.fragmentVersion,
    settings: settingsFor(heldOut),
  };
}

/** The built-in pattern the CLI bundles must be this branch's, or the run measures a stale template. */
function assertFreshBundle(template) {
  const bundled = join(root, "packages", "cli", "dist", "patterns", `${template}.grooph.json`);
  const source = join(root, "patterns", `${template}.grooph.json`);
  if (!existsSync(bundled) || readFileSync(bundled, "utf8") !== readFileSync(source, "utf8")) {
    fail(`the CLI's bundled ${template} differs from patterns/${template}.grooph.json: run pnpm -r build first`);
  }
}

function claudeSignedIn() {
  const out = spawnSync("claude", ["auth", "status"], { encoding: "utf8", env: cleanEnv(process.env.PATH) });
  try {
    return JSON.parse(out.stdout).loggedIn === true;
  } catch {
    return false;
  }
}

// ── one model-calling invocation ─────────────────────────────────────────
function invoke({ ledger, template, kind, retry, scratch, harnessDir, binDir, prompt, resumeSession, suffix, note, settings }) {
  const decision = gate(ledger, { template, kind, retry });
  if (!decision.ok) fail(`the ledger refuses this ${kind}: ${decision.reason}`);
  const entry = openEntry(ledger, { template, kind, maxBudget: decision.maxBudget, retry, sessionId: resumeSession, note });
  saveLedger(ledger);
  console.log(`ledger: invocation ${entry.n} opened; $${decision.remaining.toFixed(2)} remains, this one is capped at $${decision.maxBudget.toFixed(2)}`);

  // The harness's own output goes beside the project, not into it: a run that sees an
  // unexplained file in its tree may report it, or a critic may judge it.
  const outPath = join(harnessDir, `claude-output${suffix}.json`);
  const errPath = join(harnessDir, `claude-stderr${suffix}.txt`);
  // --strict-mcp-config: only the MCP servers named on the command line (none), so the owner's own
  // connectors never reach a run (in the first batch a builder called one's instructions an injection).
  const settingsJson = JSON.stringify(settings);
  const args = ["-p", prompt, "--permission-mode", "acceptEdits", "--output-format", "json", "--settings", settingsJson, "--max-budget-usd", decision.maxBudget.toFixed(2), "--strict-mcp-config"];
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
  // A resumed session reports what this invocation spent, not the session's total (probe, ledger invocations 1-2).
  const cost = reported;
  settleEntry(entry, {
    status: output === null ? "failed" : output.is_error ? "error" : "ok",
    cost_usd: cost === null ? null : Math.round(cost * 1e6) / 1e6,
    reported_cost_usd: reported,
    session_id: output?.session_id ?? resumeSession ?? null,
    note: [note, output?.subtype && output.subtype !== "success" ? `result ${output.subtype}` : "", child.error ? `spawn: ${child.error.message}` : "", child.status ? `exit ${child.status}` : ""].filter(Boolean).join("; "),
  });
  saveLedger(ledger);
  console.log(`claude exit ${child.status ?? child.signal ?? "?"} after ${wall}s; reported cost ${reported === null ? "unknown" : `$${reported.toFixed(4)}`}`);
  console.log(describe(ledger));
  if (output === null) {
    const stderr = existsSync(errPath) ? readFileSync(errPath, "utf8").slice(0, 2000) : "";
    fail(`claude produced no JSON output${stderr ? `:\n${stderr}` : ""}`);
  }
  return { entry, output, wall, args: args.map((a) => (a === prompt ? "<prompt>" : a === settingsJson ? "<settings.json>" : a)), outFile: `claude-output${suffix}.json`, errFile: `claude-stderr${suffix}.txt` };
}

// ── evidence ─────────────────────────────────────────────────────────────
export function collect({ template, experiment, built, invocations, prompts, evidenceDir, harnessVersion }) {
  const { scratch, graphId } = built;
  mkdirSync(evidenceDir, { recursive: true });
  const runsDir = join(scratch, ".grooph", graphId, "runs");
  const folders = runFolders(runsDir);
  if (folders.length > 0) cpSync(runsDir, join(evidenceDir, "runs"), { recursive: true });

  const pkg = join(evidenceDir, "package");
  mkdirSync(join(pkg, "agents"), { recursive: true });
  mkdirSync(join(pkg, "skill"), { recursive: true });
  for (const file of ["LEAD.md", "KICKOFF.md", "MAPPING.md", "graph.grooph.json"]) cpSync(join(scratch, ".grooph", graphId, file), join(pkg, file));
  for (const name of readdirSync(join(scratch, ".claude", "agents")).filter((n) => n.startsWith(`${graphId}--`))) cpSync(join(scratch, ".claude", "agents", name), join(pkg, "agents", name));
  cpSync(join(scratch, ".claude", "skills", graphId, "SKILL.md"), join(pkg, "skill", "SKILL.md"));

  const { diff, files } = projectDiff(scratch, built.base, [`.grooph/${graphId}/runs`]);
  writeFileSync(join(evidenceDir, "project.diff"), diff, "utf8");

  for (const inv of invocations) {
    cpSync(join(built.harnessDir, inv.outFile), join(evidenceDir, inv.outFile));
    const errText = readFileSync(join(built.harnessDir, inv.errFile), "utf8");
    if (errText.trim()) writeFileSync(join(evidenceDir, inv.errFile), errText, "utf8");
  }
  writeFileSync(join(evidenceDir, "settings.json"), `${JSON.stringify(built.settings, null, 2)}\n`, "utf8");
  mkdirSync(join(evidenceDir, "prompts"), { recursive: true });
  for (const [name, text] of Object.entries(prompts)) writeFileSync(join(evidenceDir, "prompts", name), text, "utf8");
  cpSync(join(experiment.dir, "expect.json"), join(evidenceDir, "expect.json"));

  const sessions = [...new Set(invocations.map((inv) => inv.output.session_id).filter(Boolean))];
  const digest = sessions.flatMap((sid) => digestTranscripts(sessionTranscripts(CLAUDE_DIR, sid), scratch).map((entry) => ({ session: sid, ...entry })));
  writeFileSync(join(evidenceDir, "transcript-digest.json"), `${JSON.stringify(digest, null, 2)}\n`, "utf8");

  const runId = folders[0] ?? null;
  const notesAfter = invocations.map((inv) => inv.notesAfter);
  const models = {};
  for (const inv of invocations) {
    for (const [model, usage] of Object.entries(inv.output.modelUsage ?? {})) {
      models[model] ??= { cost_usd: 0, output_tokens: 0 };
      models[model].cost_usd += usage.costUSD ?? 0;
      models[model].output_tokens += usage.outputTokens ?? 0;
    }
  }
  const byAgent = {};
  for (const entry of digest) byAgent[entry.who] = [...new Set([...(byAgent[entry.who] ?? []), ...entry.models])];
  const denials = invocations.flatMap((inv) =>
    (inv.output.permission_denials ?? []).map((d) => ({ tool: d.tool_name, command: d.tool_input?.command ?? d.tool_input?.file_path ?? null })),
  );
  const sum = (key) => invocations.reduce((total, inv) => total + (inv.output[key] ?? 0), 0);
  const result = {
    template,
    template_version: built.fragment ? `${template}@${built.fragmentVersion ?? "?"}` : built.doc.lineage?.from ?? null,
    host: built.fragment ? { template: built.doc.lineage?.from ?? built.fragment.host, steps: built.fragment.steps } : undefined,
    slots: built.slots,
    held_out: built.heldOut ? { dir: built.heldOut.realDir, files: built.heldOut.files, substituted_in: built.substituted } : undefined,
    graph_id: graphId,
    run_id: runId,
    run_ids: folders,
    harness: "claude-code",
    harness_version: harnessVersion,
    models,
    models_by_agent: byAgent,
    cost_usd: Math.round(invocations.reduce((total, inv) => total + (inv.entry.cost_usd ?? 0), 0) * 1e6) / 1e6,
    harness_turns: sum("num_turns"),
    lead_turns: null,
    duration_s: Math.round(sum("duration_ms") / 1000),
    rounds: null,
    stop_fired: null,
    ending: null,
    subagents: {},
    permission_denials: denials,
    invocations: invocations.map((inv, i) => ({
      kind: inv.entry.kind,
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
      notes_after: notesAfter[i],
      command: ["claude", ...inv.args],
      output: inv.outFile,
    })),
    base_commit: built.base,
    source_sha256_before: built.sourceSha,
    project_files_changed: files,
    scratch: built.scratch,
    home_redactions: 0,
  };
  writeFileSync(join(evidenceDir, "result.json"), `${JSON.stringify(result, null, 2)}\n`, "utf8");
  return result;
}

export async function finishResult(evidenceDir, core, template) {
  const checked = await checkRun(evidenceDir, { core, template });
  const path = join(evidenceDir, "result.json");
  const result = JSON.parse(readFileSync(path, "utf8"));
  const { facts } = checked;
  Object.assign(result, {
    lead_turns: facts.lead_turns ?? null,
    rounds: { loop_passes: facts.loop_passes ?? 0, rounds_recorded: facts.rounds_recorded ?? 0, last_round: facts.last_round ?? null },
    stop_fired: facts.stop_fired ?? [],
    ending: facts.ending ?? [],
    subagents: facts.subagents ?? {},
    amendments: facts.amendments ?? [],
    proposals: facts.proposals ?? [],
    working_copy: facts.working_copy ?? null,
  });
  writeFileSync(path, `${JSON.stringify(result, null, 2)}\n`, "utf8");
  const redactions = redactHome(evidenceDir, HOME);
  const redacted = JSON.parse(readFileSync(path, "utf8"));
  redacted.home_redactions = redactions;
  writeFileSync(path, `${JSON.stringify(redacted, null, 2)}\n`, "utf8");
  return checked;
}

// ── main ─────────────────────────────────────────────────────────────────
async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.status) {
    console.log(describe(loadLedger()));
    return 0;
  }
  if (!args.template) fail("usage: scripts/prove-pattern.sh <template id> [--dry-run | --check <dir> | --retry <reason>] (see its header)");
  if (!existsSync(CORE) || !existsSync(join(root, "packages", "cli", "dist", "src", "index.js"))) fail("build the repo first: pnpm install && pnpm -r build");
  const core = await import(CORE);

  if (args.check) {
    const dir = resolve(args.check);
    say(`checking ${dir}`);
    const checked = await checkRun(dir, { core, template: args.template });
    printCheck(checked);
    say(checked.problems.length === 0 ? "PASS" : "FAIL");
    return checked.problems.length === 0 ? 0 : 1;
  }

  if (!PROVABLE.includes(args.template)) fail(`${args.template} is not one of the templates this slice may run: ${PROVABLE.join(", ")}`);
  const experiment = loadExperiment(args.template);
  const evidenceDir = join(experiment.dir, "run");
  assertFreshBundle(args.template);
  if (experiment.fragment) assertFreshBundle(experiment.slots.host.template);
  if (!args.dryRun) {
    if (existsSync(evidenceDir)) fail(`experiments/patterns/${args.template}/run already holds a run's evidence; it is never overwritten. To re-prove, move it aside first (run/ → run-1/) and pass --retry "<why>"`);
    if (spawnSync("claude", ["--version"], { encoding: "utf8" }).status !== 0) fail("claude is not on PATH; install Claude Code first");
    if (!claudeSignedIn()) fail("the claude CLI is not signed in, so a headless run would fail. Sign in with `claude auth login` and run this again.");
  }

  const ledger = loadLedger();
  say(`building the scratch project for ${args.template}`);
  const built = buildScratch(args.template, experiment);
  console.log(`scratch project: ${built.scratch}\ngraph: ${built.graphId} (${built.doc.lineage?.from}${built.fragment ? ` as host; ${built.fragment.steps.join("; ")}` : ""})\nbase commit: ${built.base}`);
  if (built.heldOut) console.log(`held-out: ${built.heldOut.realDir} (${built.heldOut.files.map((f) => f.path).join(", ")}); the token replaced in ${built.substituted.length > 0 ? built.substituted.join(", ") : "no task file"} and in the slot values; Read allowed there by rule`);

  // `grooph` on PATH for the run, so the lead can validate an amended working copy. Outside the scratch project.
  const binDir = mkdtempSync(join(tmpdir(), "grooph-prove-bin-"));
  writeFileSync(join(binDir, "grooph"), `#!/bin/sh\nexec "${process.execPath}" "${CLI}" "$@"\n`, { mode: 0o755 });

  try {
    const kickoff = readFileSync(join(built.scratch, ".grooph", built.graphId, "KICKOFF.md"), "utf8");
    const harnessVersion = spawnSync("claude", ["--version"], { encoding: "utf8" }).stdout?.trim() ?? null;

    if (args.dryRun) {
      say("dry run: everything but the model call");
      const files = run("git", ["-C", built.scratch, "ls-files"]).stdout.trim().split("\n");
      console.log(files.map((f) => `  ${f}`).join("\n"));
      run(join(binDir, "grooph"), ["validate", "--for-export", join(built.scratch, ".grooph", built.graphId, "graph.grooph.json")]);
      console.log("the exported source validates for export through the grooph shim");
      const decision = gate(ledger, { template: args.template, kind: "kickoff", retry: args.retry });
      console.log(describe(ledger));
      console.log(decision.ok ? `the ledger would allow a kickoff, capped at $${decision.maxBudget.toFixed(2)}` : `the ledger would refuse: ${decision.reason}`);
      console.log(`would run in ${built.scratch}:\n  claude -p "$(cat .grooph/${built.graphId}/KICKOFF.md)" --permission-mode acceptEdits --output-format json --settings '<${built.settings.permissions.allow.length} allow rules>' --max-budget-usd ${decision.ok ? decision.maxBudget.toFixed(2) : "–"} --strict-mcp-config`);
      if (built.fragment) console.log(built.fragment.insertOutput.trim().split("\n").map((line) => `  ${line}`).join("\n"));
      console.log(`slots as filled: ${JSON.stringify(built.slots)}`);
      if (experiment.expect.resume) console.log(`then, after a halt at ${experiment.expect.resume.gate}, once: claude -p "<scripted ${experiment.expect.resume.answer}>" --resume <session id> …`);
      console.log(`would copy the evidence into experiments/patterns/${args.template}/run/ and check it`);
      say("dry run done; the model was not called and the ledger is unchanged");
      return 0;
    }

    const notesPath = () => {
      const folders = runFolders(join(built.scratch, ".grooph", built.graphId, "runs"));
      return folders[0] ? join(built.scratch, ".grooph", built.graphId, "runs", folders[0], "notes.jsonl") : null;
    };
    const invocations = [];
    const prompts = { "kickoff.md": kickoff };

    say("running the package headless (this spends money)");
    const first = invoke({ ledger, template: args.template, kind: "kickoff", retry: args.retry, scratch: built.scratch, harnessDir: built.harnessDir, binDir, prompt: kickoff, suffix: "", note: args.retry ? `retry: ${args.retry}` : "", settings: built.settings });
    first.notesAfter = notesPath() ? readNotes(notesPath()).lines : 0;
    invocations.push(first);
    const runId = runFolders(join(built.scratch, ".grooph", built.graphId, "runs"))[0] ?? null;
    first.entry.run_id = runId;
    saveLedger(ledger);

    const resume = experiment.expect.resume;
    if (resume) {
      const notes = notesPath() ? readNotes(notesPath()).notes.filter(Boolean) : [];
      const last = notes[notes.length - 1];
      // The answer is given only to a run that reached the gate and went no further. Whether it also
      // wrote a halt note is for --check to judge (the review-gate lead asked in its reply instead).
      const reached = notes.some((note) => JSON.stringify(note).includes(resume.gate));
      const beyond = notes.filter((note) => /^node:/.test(note.at) && !(resume.before ?? []).includes(note.at.slice(5)) && note.at !== `node:${resume.gate}`);
      if (!runId || !reached || beyond.length > 0) {
        console.log(
          `the run did not stop at ${resume.gate}${beyond.length > 0 ? ` (it ran ${[...new Set(beyond.map((n) => n.at))].join(", ")} past it)` : ""}, so the scripted "${resume.answer}" is not given (last note: ${JSON.stringify(last ?? null)})`,
        );
      } else {
        const prompt = resume.prompt.replaceAll("{{run-id}}", runId).replaceAll("{{gate}}", resume.gate).replaceAll("{{answer}}", resume.answer);
        prompts["resume.md"] = prompt;
        say(`resuming run ${runId} once with the scripted answer "${resume.answer}" at ${resume.gate}`);
        const second = invoke({
          ledger,
          template: args.template,
          kind: "resume",
          scratch: built.scratch,
          harnessDir: built.harnessDir,
          binDir,
          prompt,
          resumeSession: first.output.session_id,
          suffix: "-2",
          note: `scripted answer "${resume.answer}" at ${resume.gate}`,
          settings: built.settings,
        });
        second.notesAfter = notesPath() ? readNotes(notesPath()).lines : 0;
        second.entry.run_id = runId;
        saveLedger(ledger);
        invocations.push(second);
      }
    }

    say(`copying the evidence into experiments/patterns/${args.template}/run/`);
    collect({ template: args.template, experiment, built, invocations, prompts, evidenceDir, harnessVersion });
    const checked = await finishResult(evidenceDir, core, args.template);
    printCheck(checked);
    say(checked.problems.length === 0 ? "PASS" : "FAIL (the evidence is kept either way)");
    console.log(`evidence  experiments/patterns/${args.template}/run/\nscratch   ${built.scratch}`);
    return checked.problems.length === 0 ? 0 : 1;
  } finally {
    rmSync(binDir, { recursive: true, force: true });
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main().then(
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
