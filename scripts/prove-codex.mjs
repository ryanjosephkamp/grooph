#!/usr/bin/env node
/**
 * One-run Codex proving runner for the review-gate acceptance task.
 *
 * Safe by default: without --run this only instantiates and exports the package.
 * Every launched Codex session gets its own durable JSONL, stderr, and open
 * ledger entry before the process starts. It never reads ~/.codex transcripts.
 */

import { spawn, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { createWriteStream, cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, renameSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const CLI = join(ROOT, "packages", "cli", "bin", "grooph.js");
const CORE = join(ROOT, "packages", "core", "dist", "src", "index.js");
const EXPERIMENT = join(ROOT, "experiments", "patterns", "review-gate");
const DESTINATION = join(ROOT, "experiments", "patterns-codex", "review-gate");
const TIMEOUT_MS = 15 * 60 * 1000;
const GRAPH_ID = "truncate";
const TEMPLATE = "review-gate";
const EXPECT = { agents: ["builder", "critic"], gate: "merge-gate", stop: "done", loop: "review" };
const CHECK_SCOPE = "Evidence check covers Codex dispatch records, run-note summary, gate/stop assertions, saved task tests, and source-hash equality. Source graph validation and brake preservation are checked at export time, not re-proved by --check.";

const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const fileHash = (path) => sha256(readFileSync(path));
const say = (value) => console.log(`\n${value}`);

function fail(message) {
  throw new Error(message);
}

function parseArgs(argv) {
  const args = { run: false, dryRun: false, check: null };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--run") args.run = true;
    else if (arg === "--dry-run") args.dryRun = true;
    else if (arg === "--check") args.check = argv[++i] ?? fail("--check needs a kept evidence folder");
    else if (arg.startsWith("-")) fail(`unknown option ${arg}`);
    else fail(`unexpected argument ${arg}`);
  }
  if ([args.run, args.dryRun, args.check !== null].filter(Boolean).length > 1) fail("choose one of --dry-run, --run, or --check");
  return args;
}

function command(commandName, args, options = {}) {
  const result = spawnSync(commandName, args, { encoding: "utf8", maxBuffer: 32 << 20, ...options });
  if (result.error) throw result.error;
  if (result.status !== 0 && !options.allowFailure) {
    fail(`${commandName} ${args.join(" ")} exited ${result.status ?? result.signal}\n${result.stderr ?? ""}${result.stdout ?? ""}`);
  }
  return result;
}

function loadCore() {
  if (!existsSync(CORE) || !existsSync(CLI)) fail("build the repository first: pnpm install && pnpm -r build");
  return import(CORE);
}

export function parseCodexStream(text) {
  const events = [];
  const issues = [];
  for (const [index, line] of text.split("\n").entries()) {
    if (!line.trim()) continue;
    try {
      events.push(JSON.parse(line));
    } catch {
      issues.push(index + 1);
    }
  }
  const thread = events.find((event) => event.type === "thread.started")?.thread_id ?? null;
  const completedTurns = events.filter((event) => event.type === "turn.completed");
  const usage = completedTurns.at(-1)?.usage ?? null;
  const started = new Map();
  const completedItems = new Map();
  for (const event of events) {
    const item = event.item;
    if (!item || !["collab_tool_call", "function_call", "agent_spawn", "subagent_spawn"].includes(item.type)) continue;
    const key = item.id ?? item.call_id;
    if (!key) continue;
    (event.type === "item.started" ? started : event.type === "item.completed" ? completedItems : new Map()).set(key, item);
  }
  const calls = [];
  for (const [key, item] of completedItems) {
    if (!started.has(key)) continue;
    const before = started.get(key);
    const tool = String(item.tool ?? item.name ?? item.function?.name ?? before.tool ?? before.name ?? before.function?.name ?? "").toLowerCase();
    if (!/(spawn|agent|collab)/.test(tool) || /\b(wait|send_message|list_agents)\b/.test(tool)) continue;
    const fields = [];
    const decodeStructured = (value) => {
      if (typeof value !== "string") return value;
      try {
        const parsed = JSON.parse(value);
        return parsed && typeof parsed === "object" ? parsed : value;
      } catch {
        return value;
      }
    };
    const visit = (value, fieldName = "") => {
      if (value === null || value === undefined) return;
      if (Array.isArray(value)) return value.forEach((child) => visit(child, fieldName));
      if (typeof value === "object") {
        for (const [childKey, child] of Object.entries(value)) visit(child, childKey);
      } else if (/^(agent_type|agent_name|name|type|role|custom_agent)$/i.test(fieldName)) fields.push(String(value));
    };
    visit(decodeStructured(before.arguments ?? before.input ?? before));
    visit(decodeStructured(item.arguments ?? item.input ?? item.result ?? item));
    const returned = item.result ?? item.output;
    const successful = item.error == null && (!item.status || item.status === "completed") && returned != null;
    calls.push({ id: key, tool, fields: [...new Set(fields)], successful });
  }
  const dispatches = Object.fromEntries(EXPECT.agents.map((role) => [role, calls.some((call) => call.successful && call.fields.some((field) => {
    const normalized = field.toLowerCase();
    return normalized === `${GRAPH_ID}--${role}`;
  }))]));
  return { events, issues, thread, usage, calls, dispatches };
}

export function buildCodexCommand(prompt) {
  return [
    "exec", "--json", "--sandbox", "workspace-write",
    "--model", "gpt-6.1-sol",
    "-c", 'web_search="disabled"',
    "-c", "model_reasoning_effort=high",
    "-c", "agents.default_subagent_model=gpt-6-luna",
    "-c", "agents.max_concurrent_threads_per_session=2",
    prompt,
  ];
}

export function checkRunEvidence({ evidenceDir, core }) {
  const problems = [];
  const json = (name) => JSON.parse(readFileSync(join(evidenceDir, name), "utf8"));
  const result = json("result.json");
  const output = parseCodexStream(readFileSync(join(evidenceDir, "codex-output.jsonl"), "utf8"));
  const taskTests = json("task-tests.json");
  const graphFile = join(evidenceDir, "package", "graph.grooph.json");
  if (fileHash(graphFile) !== result.source_sha256_after) problems.push("the kept package graph does not match source_sha256_after");
  for (const role of EXPECT.agents) {
    if (!existsSync(join(evidenceDir, "package", "agents", `${GRAPH_ID}--${role}.toml`))) problems.push(`the kept Codex package is missing custom role ${role}`);
  }
  const changedFiles = json("project-files.json");
  if (!changedFiles.some((line) => line.slice(3) === "REVIEW.md")) problems.push("the task project diff does not show the critic's REVIEW.md");
  if (!readFileSync(join(evidenceDir, "project.diff"), "utf8").includes("REVIEW.md")) problems.push("the task project diff does not retain REVIEW.md content");
  const notesFile = join(evidenceDir, "runs", result.run_id ?? "", "notes.jsonl");
  if (!result.run_id || !existsSync(notesFile)) return { problems: ["the evidence has no run notes"], result, output };
  const workingGraphFile = join(evidenceDir, "runs", result.run_id, "graph.grooph.json");
  const graph = JSON.parse(readFileSync(existsSync(workingGraphFile) ? workingGraphFile : graphFile, "utf8"));
  const parsed = core.parseRunNotes(readFileSync(notesFile, "utf8"));
  if (parsed.issues.length) problems.push(`run notes have ${parsed.issues.length} parse/schema issue(s)`);
  const summary = core.summarizeRun(parsed.notes, graph);

  if (result.harness !== "codex") problems.push("result.json does not identify the Codex harness");
  if (output.issues.length) problems.push(`Codex JSONL has ${output.issues.length} malformed line(s)`);
  if (!output.thread || result.session_id !== output.thread) problems.push("result session id does not match thread.started in Codex JSONL");
  for (const role of EXPECT.agents) {
    if (!output.dispatches[role]) problems.push(`Codex JSONL does not show dispatch of the custom ${role} role`);
    const completeOutcomes = new Set(["pass", "fail", "invalid", "invalid-evidence", "halt"]);
    if (!parsed.notes.some((note) => note.at === `node:${role}` && completeOutcomes.has(note.outcome))) {
      problems.push(`run notes have no completed outcome for node:${role}`);
    }
  }
  const gateNote = parsed.notes.at(-1);
  if (summary.state !== "halted" || summary.nodes[EXPECT.gate]?.state !== "halted" || gateNote?.at !== `node:${EXPECT.gate}` || gateNote?.outcome !== "halt") {
    problems.push("the run did not finish on a halt note at the merge gate");
  }
  if (parsed.notes.some((note) => note.at === `node:${EXPECT.stop}`)) problems.push("the run reached the done stop after the human gate");
  const merged = output.events.some((event) => {
    const item = event.item;
    if (!item || item.type !== "command_execution") return false;
    const commandText = Array.isArray(item.command) ? item.command.join(" ") : String(item.command ?? item.arguments ?? "");
    return /\bgit\b.*\bmerge\b/i.test(commandText);
  });
  if (merged) problems.push("Codex JSONL contains a git merge command");

  const loop = graph.loops.find((item) => item.id === EXPECT.loop);
  const loopNotes = parsed.notes.filter((note) => note.at === `loop:${EXPECT.loop}`);
  if (!loopNotes.length) problems.push("the review loop has no stop-evaluation note");
  for (const note of loopNotes) {
    if (note.round === undefined) problems.push(`loop note ${note.id} has no round`);
    if (note.stop !== undefined && !loop?.stops.some((stop) => stop.kind === note.stop)) problems.push(`loop note ${note.id} names a stop outside the graph`);
  }
  const gateNoteIndex = parsed.notes.findIndex((note) => note === gateNote);
  const recognizedStop = loopNotes.some((note) =>
    parsed.notes.indexOf(note) < gateNoteIndex &&
    (note.outcome === "pass" || note.outcome === "halt") &&
    typeof note.stop === "string" && loop?.stops.some((stop) => stop.kind === note.stop),
  );
  if (!recognizedStop) problems.push("the final gate path has no recognized stopping-loop note");
  if (taskTests.status !== 0 || !taskTests.command?.includes("npm test")) problems.push("the saved task test run did not pass");
  if (result.source_sha256_before !== result.source_sha256_after) problems.push("the source graph changed during the run");
  if (result.usage == null) problems.push("Codex did not report token usage in its JSONL output");
  if (!result.codex_version) problems.push("result.json does not record the installed Codex version");
  if (!result.source_commit || !result.base_commit) problems.push("result.json must distinguish the repository source commit from the scratch task base commit");
  return { problems, result, output, summary, notes: parsed.notes, check_scope: CHECK_SCOPE };
}

function fillSlots(slots) {
  const values = Object.entries(slots.values).flatMap(([key, value]) => ["--set", `${key}=${value}`]);
  return ["template", "use", TEMPLATE, "--name", slots.name, ...values];
}

function makeScratch() {
  if (!existsSync(EXPERIMENT)) fail(`missing ${EXPERIMENT}`);
  const slots = JSON.parse(readFileSync(join(EXPERIMENT, "slots.json"), "utf8"));
  const expect = JSON.parse(readFileSync(join(EXPERIMENT, "expect.json"), "utf8"));
  const scratch = mkdtempSync(join(process.env.TMPDIR ?? tmpdir(), "grooph-prove-codex-review-gate-"));
  const home = mkdtempSync(join(tmpdir(), "grooph-prove-codex-grooph-home-"));
  cpSync(join(EXPERIMENT, "task"), scratch, { recursive: true });
  const templateEnv = { ...process.env, GROOPH_HOME: home, GROOPH_REGISTRY: "http://127.0.0.1:9/unreachable/index.json" };
  // Prove the committed target defaults, without a machine-local tier override.
  delete templateEnv.GROOPH_MODELS;
  command(process.execPath, [CLI, ...fillSlots(slots), "--out", join(scratch, "graph.grooph.json")], { cwd: scratch, env: templateEnv });
  const sourcePath = join(scratch, "graph.grooph.json");
  // The template names Claude Code, and an export for another harness than the document names is refused: the
  // graph is made a Codex document first, by the op a person would use.
  command(process.execPath, [CLI, "apply", sourcePath, "--ops", "-", "--write"], { cwd: scratch, env: templateEnv, input: JSON.stringify([{ op: "setTarget", harness: "codex" }]) });
  const doc = JSON.parse(readFileSync(sourcePath, "utf8"));
  command(process.execPath, [CLI, "validate", "--for-export", sourcePath], { env: templateEnv });
  command(process.execPath, [CLI, "export", sourcePath, "--target", "codex", "--into", scratch], { cwd: scratch, env: templateEnv });
  command("git", ["init", "-q"], { cwd: scratch });
  command("git", ["config", "user.email", "prove@grooph.local"], { cwd: scratch });
  command("git", ["config", "user.name", "grooph prove"], { cwd: scratch });
  command("git", ["add", "-A"], { cwd: scratch });
  command("git", ["commit", "-qm", "review-gate Codex proving task"], { cwd: scratch });
  const base = command("git", ["rev-parse", "HEAD"], { cwd: scratch }).stdout.trim();
  const packageDir = join(scratch, ".grooph", GRAPH_ID);
  const sourcePackage = join(packageDir, "graph.grooph.json");
  const sourceCommit = command("git", ["rev-parse", "HEAD"], { cwd: ROOT }).stdout.trim();
  return { scratch, home, templateEnv, doc, expect, base, sourceCommit, packageDir, sourceHash: fileHash(sourcePackage) };
}

function saveJson(path, value) {
  const temp = `${path}.${process.pid}.tmp`;
  writeFileSync(temp, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  renameSync(temp, path);
}

function shellQuote(value) {
  return `'${String(value).replaceAll("'", "'\\''")}'`;
}

function outputRunFolders(scratch) {
  const runs = join(scratch, ".grooph", GRAPH_ID, "runs");
  if (!existsSync(runs)) return [];
  return readdirSync(runs).filter((name) => statSync(join(runs, name)).isDirectory()).sort();
}

function recordTaskTests(scratch, evidenceDir) {
  const result = spawnSync("npm", ["test"], { cwd: scratch, encoding: "utf8", maxBuffer: 8 << 20 });
  const record = {
    command: "npm test",
    status: result.status ?? 1,
    signal: result.signal ?? null,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? result.error?.message ?? "",
  };
  saveJson(join(evidenceDir, "task-tests.json"), record);
  writeFileSync(join(evidenceDir, "task-tests.txt"), `${record.stdout}${record.stderr}`, "utf8");
  return record;
}

function createLedger(evidenceDir, prompt, { codexVersion, sourceCommit, baseCommit }) {
  const ledgerPath = join(evidenceDir, "ledger.json");
  const ledger = {
    about: "Runner-written record for the single review-gate Codex invocation. Codex reports tokens rather than USD cost; unknown USD is null, never zero.",
    invocations: [{
      n: 1,
      harness: "codex",
      codex_version: codexVersion,
      template: TEMPLATE,
      kind: "kickoff",
      started: new Date().toISOString(),
      ended: null,
      status: "running",
      session_id: null,
      usage: null,
      cost_usd: null,
      reported_cost_usd: null,
      max_duration_seconds: TIMEOUT_MS / 1000,
      command: ["codex", ...buildCodexCommand("<KICKOFF.md>")],
      prompt_sha256: sha256(prompt),
      source_commit: sourceCommit,
      base_commit: baseCommit,
    }],
  };
  saveJson(ledgerPath, ledger);
  return { ledger, ledgerPath, entry: ledger.invocations[0] };
}

function pumpCodex({ prompt, scratch, templateEnv, evidenceDir, ledger, entry, ledgerPath }) {
  const outPath = join(evidenceDir, "codex-output.jsonl");
  const errPath = join(evidenceDir, "codex-stderr.txt");
  const out = createWriteStream(outPath, { flags: "wx" });
  const err = createWriteStream(errPath, { flags: "wx" });
  const child = spawn("codex", buildCodexCommand(prompt), { cwd: scratch, env: templateEnv, stdio: ["inherit", "pipe", "pipe"] });
  let buffer = "";
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    child.kill("SIGTERM");
    setTimeout(() => child.kill("SIGKILL"), 5000).unref();
  }, TIMEOUT_MS);
  const onLine = (line) => {
    if (!line.trim()) return;
    try {
      const event = JSON.parse(line);
      let updated = false;
      if (event.type === "thread.started" && typeof event.thread_id === "string" && entry.session_id !== event.thread_id) {
        entry.session_id = event.thread_id;
        updated = true;
      }
      if (event.type === "turn.completed" && event.usage) {
        entry.usage = event.usage;
        updated = true;
      }
      if (updated) saveJson(ledgerPath, ledger);
    } catch {
      // The complete malformed line remains in the raw stream and is reported by --check.
    }
  };
  child.stdout.on("data", (chunk) => {
    out.write(chunk);
    buffer += chunk.toString("utf8");
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    lines.forEach(onLine);
  });
  child.stderr.on("data", (chunk) => err.write(chunk));
  let spawnError = null;
  const closed = new Promise((resolvePromise) => {
    child.on("error", (error) => { spawnError = error; });
    child.on("close", (code, signal) => resolvePromise({ code, signal }));
  });
  return closed.then(async ({ code, signal }) => {
    clearTimeout(timer);
    if (buffer.trim()) onLine(buffer);
    await Promise.all([
      new Promise((resolvePromise) => out.end(resolvePromise)),
      new Promise((resolvePromise) => err.end(resolvePromise)),
    ]);
    const stream = parseCodexStream(readFileSync(outPath, "utf8"));
    entry.session_id ??= stream.thread;
    entry.usage = stream.usage ?? entry.usage;
    entry.ended = new Date().toISOString();
    entry.status = timedOut ? "timeout" : spawnError ? "failed-to-start" : code === 0 ? "ok" : "error";
    entry.exit_code = code;
    entry.signal = signal;
    if (spawnError) entry.note = `spawn error: ${spawnError.message}`;
    entry.transcript = { path: null, sha256: null, status: "not accessed; owner approval required" };
    // The approval-gated rollout remains in ~/.codex. This runner intentionally never opens that path.
    saveJson(ledgerPath, ledger);
    return { code, signal, timedOut, stream };
  });
}

function captureEvidence({ built, evidenceDir, prompt, stream, taskTests }) {
  const ids = outputRunFolders(built.scratch);
  const runBase = join(built.scratch, ".grooph", GRAPH_ID, "runs");
  if (ids.length) cpSync(runBase, join(evidenceDir, "runs"), { recursive: true });
  const diff = command("git", ["diff", "--binary", built.base, "--", ".", ":(exclude).grooph/*/runs/**"], { cwd: built.scratch, allowFailure: true });
  const untracked = command("git", ["ls-files", "--others", "--exclude-standard"], { cwd: built.scratch }).stdout.trim().split("\n").filter((path) => path && !path.startsWith(`.grooph/${GRAPH_ID}/runs/`));
  const changed = command("git", ["status", "--short"], { cwd: built.scratch }).stdout.trimEnd().split("\n").filter((line) => line && !line.slice(3).startsWith(`.grooph/${GRAPH_ID}/runs/`));
  writeFileSync(join(evidenceDir, "project.diff"), `${diff.stdout}${untracked.map((path) => `\n--- untracked ${path} ---\n${readFileSync(join(built.scratch, path), "utf8")}`).join("")}`, "utf8");
  writeFileSync(join(evidenceDir, "project-files.json"), `${JSON.stringify(changed, null, 2)}\n`, "utf8");
  writeFileSync(join(evidenceDir, "prompts", "kickoff.md"), prompt, "utf8");
  cpSync(join(EXPERIMENT, "expect.json"), join(evidenceDir, "expect.json"));
  const sourcePath = join(built.packageDir, "graph.grooph.json");
  const sourceAfter = fileHash(sourcePath);
  const firstRun = ids[0] ?? null;
  const result = {
    template: TEMPLATE,
    template_version: built.doc.lineage?.from ?? `${TEMPLATE}@${built.doc.version}`,
    graph_id: GRAPH_ID,
    run_id: firstRun,
    run_ids: ids,
    harness: "codex",
    codex_version: built.codexVersion,
    session_id: stream.thread,
    usage: stream.usage,
    cost_usd: null,
    reported_cost_usd: null,
    stop_fired: firstRun ? undefined : [],
    ending: firstRun ? undefined : [],
    source_sha256_before: built.sourceHash,
    source_sha256_after: sourceAfter,
    source_commit: built.sourceCommit,
    base_commit: built.base,
    project_files_changed: changed,
    task_tests_exit_code: taskTests.status,
    transcript: { path: null, sha256: null, status: "not accessed; owner approval required" },
    scratch: built.scratch,
  };
  if (firstRun) {
    saveJson(join(evidenceDir, "result.json"), result);
    const corePromise = loadCore();
    return corePromise.then(async (core) => {
      const checked = checkRunEvidence({ evidenceDir, core });
      result.stop_fired = checked.summary?.loops?.[EXPECT.loop]?.lastStop?.fired ? [checked.summary.loops[EXPECT.loop].lastStop.fired] : [];
      result.ending = checked.summary?.state === "halted" ? [`halt at ${EXPECT.gate}`] : [];
      result.problems = checked.problems;
      saveJson(join(evidenceDir, "result.json"), result);
    });
  }
  result.problems = ["the lead never created a grooph run folder"];
  saveJson(join(evidenceDir, "result.json"), result);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.check) {
    const core = await loadCore();
    const checked = checkRunEvidence({ evidenceDir: resolve(args.check), core });
    console.log(JSON.stringify({ check_scope: checked.check_scope, problems: checked.problems, summary: checked.summary }, null, 2));
    return checked.problems.length ? 1 : 0;
  }

  const built = makeScratch();
  const kickoffPath = join(built.packageDir, "KICKOFF.md");
  if (!existsSync(kickoffPath)) fail(`Codex export did not write ${kickoffPath}`);
  const prompt = readFileSync(kickoffPath, "utf8");
  const preview = ["codex", ...buildCodexCommand("<contents of .grooph/truncate/KICKOFF.md>")].map(shellQuote).join(" ");
  say(`scratch: ${built.scratch}`);
  say(`package: ${built.packageDir}`);
  say(`command: ${preview}`);
  say(`token usage is recorded exactly as Codex reports it; USD cost remains unknown (null). Timeout: 15 minutes; concurrent subagent cap: 2.`);

  if (!args.run) {
    say("dry run complete; the task was instantiated and exported for Codex. No model was called.");
    return 0;
  }
  const version = command("codex", ["--version"]);
  built.codexVersion = version.stdout.trim();
  if (!built.codexVersion) fail("codex --version returned no version text");
  if (existsSync(join(DESTINATION, "run"))) fail(`refusing to overwrite existing proving evidence at ${join(DESTINATION, "run")}`);
  mkdirSync(dirname(DESTINATION), { recursive: true });
  mkdirSync(DESTINATION, { recursive: true });
  const evidenceDir = join(DESTINATION, "run");
  mkdirSync(evidenceDir);
  mkdirSync(join(evidenceDir, "prompts"));
  const runRoot = join(built.scratch, ".grooph", GRAPH_ID);
  const initialPackage = join(evidenceDir, "package");
  cpSync(runRoot, initialPackage, { recursive: true });
  const agentDir = join(built.scratch, ".codex", "agents");
  const keptAgents = join(initialPackage, "agents");
  mkdirSync(keptAgents, { recursive: true });
  if (existsSync(agentDir)) {
    for (const name of readdirSync(agentDir).filter((file) => file.startsWith(`${GRAPH_ID}--`) && file.endsWith(".toml"))) {
      cpSync(join(agentDir, name), join(keptAgents, name));
    }
  }
  writeFileSync(join(evidenceDir, "prompts", "kickoff.md"), prompt, "utf8");
  cpSync(join(EXPERIMENT, "expect.json"), join(evidenceDir, "expect.json"));
  const { ledger, ledgerPath, entry } = createLedger(evidenceDir, prompt, { codexVersion: built.codexVersion, sourceCommit: built.sourceCommit, baseCommit: built.base });
  say("ledger row opened; starting one Codex session now.");
  const run = await pumpCodex({ prompt, scratch: built.scratch, templateEnv: built.templateEnv, evidenceDir, ledger, entry, ledgerPath });
  const taskTests = recordTaskTests(built.scratch, evidenceDir);
  await captureEvidence({ built, evidenceDir, prompt, stream: run.stream, taskTests });
  console.log(`Codex exited ${run.code ?? run.signal ?? "?"}; evidence kept at ${evidenceDir}`);
  console.log(`token usage: ${run.stream.usage ? JSON.stringify(run.stream.usage) : "unknown"}; USD cost: unknown`);
  console.log("transcript path and checksum were not collected because this runner does not read ~/.codex.");
  const final = JSON.parse(readFileSync(join(evidenceDir, "result.json"), "utf8"));
  return run.code === 0 && (final.problems ?? []).length === 0 && taskTests.status === 0 ? 0 : 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().then((code) => process.exit(code), (error) => {
    console.error(error?.stack ?? error);
    process.exit(1);
  });
}

export { parseArgs, makeScratch };
