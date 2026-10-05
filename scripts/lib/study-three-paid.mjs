/**
 * The paid path of study three's first steps: what starts a model session from the comparison profile, bounds it,
 * records it and puts it on the ledger. THIS MODULE CAN SPEND MONEY. Nothing in it runs on import, and every script
 * that uses it has "paid" in its name and refuses to start a session without both `--spend` and `--go "<the driver's
 * words for this step>"`.
 *
 * One session, in order:
 *
 *   1. the gates: the two flags; no session of the game experiment open on this machine (they draw on one allowance);
 *      the profile made, signed in and clean (scripts/lib/compare-profile.mjs --check); the session's folder under the
 *      profile's work folder; the comparisons ledger willing (experiments/comparisons/ledger.json)
 *   2. the profile's settings written for this run, with the paths it closes, and read back
 *   3. a ledger line opened before the call, with the session's id, which is chosen beforehand (decision 0015)
 *   4. the call, headless, its output written to a file as it comes. Two outer limits, the WATCHDOG, which is never a
 *      graph's brake and is recorded apart: dollars (the harness's own `--max-budget-usd`) and minutes (the process
 *      is ended)
 *   5. the ledger line settled with what the harness reported; the tripwire's notice printed if a mark was passed
 *   6. the record copied: the harness's output, the command without the prompt, the settings, the transcripts' digest
 *      (the transcripts stay on the machine, named with their checksums), what the session was given at its start,
 *      the project's change and its run folder
 *
 * What ended a run is one of three, and the runner says which: "the session" (it finished), "the watchdog" (a limit
 * of this module's), "the harness" (no result, or a result that is the harness's or the account's own error).
 */

import { execFileSync, spawnSync } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { closeSync, cpSync, existsSync, mkdirSync, openSync, readFileSync, readdirSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { amendEntry, gate, loadLedger, openRunEntry, saveLedger, totals, tripwireNotice, LEDGER_PATH } from "./compare-ledger.mjs";
import { check as checkProfile, commandFor, layout, settingsFor } from "./compare-profile.mjs";
import { digestTranscripts, projectDiff, sessionTranscripts } from "./prove-evidence.mjs";
import { neverUsed } from "./prove-pattern.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

// ── the gates ────────────────────────────────────────────────────────────

/** The two flags every paid step needs. Returns the driver's words, or says what is missing. */
export function spendFlags(flags) {
  const at = flags.indexOf("--go");
  const go = at >= 0 ? flags[at + 1] : undefined;
  const missing = [];
  if (!flags.includes("--spend")) missing.push("--spend");
  if (!go || go.startsWith("--") || go.trim().length < 8) missing.push('--go "<the driver\'s words allowing this step>"');
  return { ok: missing.length === 0, go: go ?? null, missing };
}

/** A session of the game experiment open on this machine: its start script names every session `arena-claude-<which>`. */
export function gameSessionsOpen(run = spawnSync) {
  const found = run("pgrep", ["-fl", "--", "--name arena-(claude|codex)-"], { encoding: "utf8" });
  return found.status === 0 ? found.stdout.split("\n").filter((line) => line.trim() && !line.includes("pgrep")) : [];
}

/** Everything that must hold before a call, as a list of what does not. Empty means go. */
export function refusals({ home, cwd, claude, gameOpen = gameSessionsOpen(), profileCheck = checkProfile }) {
  const out = [];
  if (gameOpen.length > 0) out.push(`a session of the game experiment is open (${gameOpen.length} process(es) named arena-…): nothing paid runs beside it`);
  for (const line of profileCheck({ home, claude })) {
    // The work folder holds the session's own folder by now, so its being empty is checked by the caller before it builds.
    if (!line.ok && line.what !== "its work folder is empty") out.push(`the profile: ${line.what}: ${line.how}`);
  }
  if (!resolve(cwd).startsWith(`${layout(home).work}/`)) out.push(`the session's folder ${cwd} is not under ${layout(home).work}`);
  return out;
}

// ── one call ─────────────────────────────────────────────────────────────

/** What ended a run, from the process and the harness's own result. `which` names the watchdog's limit when it fired. */
export function endedBy({ child, output }) {
  if (child.error?.code === "ETIMEDOUT") return { ended_by: "the watchdog", which: "minutes" };
  if (output && /max_budget/i.test(String(output.subtype ?? ""))) return { ended_by: "the watchdog", which: "dollars" };
  if (!output) return { ended_by: "the harness", which: null, why: child.error ? `the harness did not start: ${child.error.message}` : `no result from the harness (exit ${child.status})` };
  if (output.is_error === true) return { ended_by: "the harness", which: null, why: `the harness's result is its own error (${output.subtype ?? "no subtype"}${output.api_error_status ? `, status ${output.api_error_status}` : ""})` };
  return { ended_by: "the session", which: null };
}

/**
 * Start one session and settle it on the ledger. Throws before any call if a gate refuses. Returns the facts of the
 * call; the record is copied by `copyRecord`, by the caller, before anything is read from it.
 */
export function runSession({ home, cwd, prompt, model, effort, usd, minutes, closed = [], label, note, go, claude, ledgerPath = LEDGER_PATH, harnessDir, gameOpen, profileCheck }) {
  const refused = refusals({ home, cwd, claude, gameOpen, profileCheck });
  if (refused.length > 0) throw new Error(`not started:\n  - ${refused.join("\n  - ")}`);
  if (!go) throw new Error("not started: no word from the driver for this step (--go)");
  const at = layout(home);

  // The settings for this run, with what it closes to commands. Read back: what a session starts under is what is on the disk.
  const settings = `${JSON.stringify(settingsFor({ home, closed }), null, 2)}\n`;
  writeFileSync(join(at.profile, "settings.json"), settings, "utf8");
  if (readFileSync(join(at.profile, "settings.json"), "utf8") !== settings) throw new Error("not started: the profile's settings are not what was written");

  const ledger = loadLedger(ledgerPath);
  const decision = gate(ledger, { ...label, kind: "kickoff" });
  if (!decision.ok) throw new Error(`not started: the ledger refuses: ${decision.reason}`);
  const ceiling = Math.min(usd, decision.maxBudget);
  const sessionId = randomUUID();
  const { env, argv, transcript } = commandFor({ home, claude, cwd, prompt, model, effort, sessionId, maxBudgetUsd: ceiling, closed });
  const spentBefore = totals(ledger).spent;
  let entry = openRunEntry(ledger, { ...label, kind: "kickoff", maxBudget: ceiling, sessionId, note: [note, `the driver's go: ${go}`].filter(Boolean).join("; ") });
  saveLedger(ledger, ledgerPath);

  mkdirSync(harnessDir, { recursive: true });
  const outPath = join(harnessDir, "claude-output.json");
  const errPath = join(harnessDir, "claude-stderr.txt");
  const out = openSync(outPath, "w");
  const err = openSync(errPath, "w");
  const started = Date.now();
  const child = spawnSync(argv[0], argv.slice(1), { cwd, env, stdio: ["ignore", out, err], timeout: Math.round(minutes * 60_000) });
  closeSync(out);
  closeSync(err);
  const wall = Math.round((Date.now() - started) / 1000);
  let output = null;
  try {
    output = JSON.parse(readFileSync(outPath, "utf8"));
  } catch {}
  const ending = endedBy({ child, output });
  const reported = typeof output?.total_cost_usd === "number" ? output.total_cost_usd : null;
  const never = neverUsed(output?.modelUsage);
  entry = amendEntry(
    ledger,
    entry,
    {
      ended: new Date().toISOString(),
      status: output === null ? "failed" : output.is_error ? "error" : "ok",
      cost_usd: reported === null ? null : Math.round(reported * 1e6) / 1e6,
      reported_cost_usd: reported,
      note: [entry.note, `ended by ${ending.ended_by}${ending.which ? ` (${ending.which})` : ""}`, ending.why].filter(Boolean).join("; "),
      ...(never.length > 0 ? { never_used: never } : {}),
    },
    ledgerPath,
  );
  return {
    session_id: sessionId,
    transcript,
    ledger_n: entry.n,
    reported_cost_usd: reported,
    counted_usd: reported ?? ceiling,
    wall_s: wall,
    ...ending,
    watchdog: { usd: ceiling, minutes, fired: ending.ended_by === "the watchdog" ? ending.which : null, is_not_a_graphs_stop: true },
    models: Object.keys(output?.modelUsage ?? {}),
    models_never_used: never,
    harness_turns: output?.num_turns ?? null,
    exit: child.status ?? child.signal ?? null,
    command: argv.map((arg) => (arg === prompt ? "<the prompt>" : arg)),
    environment: Object.keys(env).sort(),
    tripwire: tripwireNotice(loadLedger(ledgerPath), spentBefore),
    output,
    harness_dir: harnessDir,
  };
}

// ── the record ───────────────────────────────────────────────────────────

const textOf = (content) => (Array.isArray(content) ? content.map((part) => part.text ?? "").join("\n") : String(content ?? ""));

/** The whole text of each tool result in one transcript, in the order of its tool uses: the order the digest lists them in. */
export function resultsOfTranscript(file) {
  const records = [];
  for (const line of readFileSync(file, "utf8").split("\n")) {
    if (!line.trim()) continue;
    try {
      records.push(JSON.parse(line));
    } catch {}
  }
  const results = new Map();
  for (const record of records) {
    if (record.type !== "user" || !Array.isArray(record.message?.content)) continue;
    for (const block of record.message.content) if (block.type === "tool_result") results.set(block.tool_use_id, textOf(block.content));
  }
  const out = [];
  for (const record of records) {
    if (record.type !== "assistant") continue;
    for (const block of Array.isArray(record.message?.content) ? record.message.content : []) if (block.type === "tool_use") out.push(results.get(block.id) ?? "");
  }
  return out;
}

const sha256 = (path) => createHash("sha256").update(readFileSync(path)).digest("hex");

/**
 * Copy a session's record into the repository's folder for it. `annotate(digest, resultsOf)` lets a caller add what
 * its counter needs to the digest from the whole results (the brake experiment's count of the check's lines); it gets
 * the digest and a function from a digest entry to that entry's results, and returns the digest to keep.
 */
export function copyRecord({ home, cwd, base, call, recordDir, prompt, graphId, annotate = (digest) => digest, excludes = [".grooph", ".claude"] }) {
  const at = layout(home);
  mkdirSync(recordDir, { recursive: true });
  for (const name of ["claude-output.json", "claude-stderr.txt"]) if (existsSync(join(call.harness_dir, name))) cpSync(join(call.harness_dir, name), join(recordDir, name));
  writeFileSync(join(recordDir, "prompt.md"), prompt, "utf8");
  cpSync(join(at.profile, "settings.json"), join(recordDir, "settings.json"));
  const transcripts = sessionTranscripts(at.profile, call.session_id);
  const digest = digestTranscripts(transcripts, cwd);
  const kept = annotate(digest, (session) => resultsOfTranscript(transcripts[digest.indexOf(session)].file));
  writeFileSync(join(recordDir, "transcript-digest.json"), `${JSON.stringify(kept, null, 2)}\n`, "utf8");
  // What the session was given at its start, read from its own transcript by the game experiment's script.
  if (transcripts.length > 0) {
    const loaded = spawnSync(process.execPath, [join(root, "experiments", "game", "setup", "loaded.mjs"), ...transcripts.map((t) => t.file)], { encoding: "utf8" });
    writeFileSync(join(recordDir, "loaded.txt"), loaded.stdout || `loaded.mjs printed nothing (exit ${loaded.status})\n${loaded.stderr}`, "utf8");
  }
  if (base) {
    const change = projectDiff(cwd, base, excludes);
    writeFileSync(join(recordDir, "project.diff"), change.diff, "utf8");
    call.project_files_changed = change.files;
  }
  const runs = graphId ? join(cwd, ".grooph", graphId, "runs") : null;
  if (runs && existsSync(runs)) cpSync(runs, join(recordDir, "runs"), { recursive: true });
  return {
    digest: kept,
    transcripts: transcripts.map((t) => ({ who: t.who, file: t.file, sha256: sha256(t.file), stays: "on this machine" })),
    run_folders: runs && existsSync(runs) ? readdirSync(runs).sort() : [],
  };
}

/** Write a run's `result.json`: the call's facts without the harness's whole output, and whatever the caller measured after the session. */
export function writeResult(recordDir, call, facts) {
  const { output, harness_dir: _harnessDir, ...kept } = call;
  const result = { ...kept, result_tail: typeof output?.result === "string" ? output.result.slice(-600) : null, ...facts, recorded: new Date().toISOString() };
  writeFileSync(join(recordDir, "result.json"), `${JSON.stringify(result, null, 2)}\n`, "utf8");
  return result;
}

/** A session's folder: a new one under the profile's work folder, holding one project with one neutral commit. */
export function makeProject({ home, name, fill }) {
  const at = layout(home);
  const work = join(at.work, randomUUID().slice(0, 8));
  const cwd = join(work, name);
  mkdirSync(cwd, { recursive: true });
  fill(cwd);
  const git = (...args) => execFileSync("git", ["-C", cwd, ...args], { encoding: "utf8" });
  git("init", "-q");
  git("config", "user.email", "dev@localhost");
  git("config", "user.name", "dev");
  git("add", "-A");
  git("commit", "-qm", "initial commit");
  return { work, cwd, base: git("rev-parse", "HEAD").trim(), harnessDir: join(work, "harness") };
}

/**
 * After a record is copied: move the session's folder and whatever it left in the profile's temp folder out of the
 * way, so the next session starts with both empty. Nothing is deleted; the record says where they went.
 */
export function setAside({ home, work, sessionId }) {
  const at = layout(home);
  const kept = join(home, "kept", sessionId);
  mkdirSync(join(kept, "t"), { recursive: true });
  renameSync(work, join(kept, "work"));
  for (const name of readdirSync(at.temp)) renameSync(join(at.temp, name), join(kept, "t", name));
  return kept;
}

export const relativeToRoot = (path) => relative(root, path);
