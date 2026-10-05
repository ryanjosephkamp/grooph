/**
 * The paid path of study three's first steps: what starts a model session from the comparison profile, bounds it,
 * records it and puts it on the ledger. THIS MODULE CAN SPEND MONEY. Nothing in it runs on import, and every script
 * that uses it has "paid" in its name and refuses to start a session without both `--spend` and `--go "<the driver's
 * words for this step>"`.
 *
 * One session, in order:
 *
 *   1. the gates, every one before anything is written anywhere: the two flags; no session of the game experiment
 *      open on this machine (they draw on one allowance), and a look that could not be made refuses; the profile
 *      made, signed in and clean (scripts/lib/compare-profile.mjs --check); the work folder holding this session's
 *      folder and nothing else; the harness found by its whole path; the comparisons ledger willing; the first
 *      steps' own ceiling not passed (experiments/comparisons/study-three-first-steps.json)
 *   2. the profile's settings written for this run, with the paths it closes, read back, and put back as they were
 *      when the call is over, whatever happened
 *   3. a ledger line opened before the call, with the session's id, which is chosen beforehand (decision 0015)
 *   4. the call, headless, in a process group of its own, its output written to a file as it comes. Two outer limits,
 *      the WATCHDOG, which is never a graph's brake and is recorded apart: dollars (the harness's own
 *      `--max-budget-usd`) and minutes (the whole group is ended, and killed if it does not go)
 *   5. the ledger line settled with what the harness reported. A harness that did not start spent nothing; a call
 *      whose cost is not known counts at its ceiling
 *   6. the record copied: the harness's output, the command without the prompt, the settings, the transcripts' digest
 *      (the transcripts stay on the machine, named with their checksums), what the session was given at its start,
 *      the project's change and its run folder. Nothing a session leaves stops the record being kept, and nothing
 *      of the account's (the home folder's path, an e-mail address) is left in it
 *
 * BEFORE THE CALL, a refusal throws `NotStarted` and nothing was spent: a caller may then take away the folder it
 * made. AFTER THE CALL HAS STARTED, nothing here throws and nothing is removed: what went wrong is in the record.
 *
 * What ended a run is one of three, and the runner says which: "the session" (it finished), "the watchdog" (a limit
 * of this module's), "the harness" (no result, or a result that is the harness's or the account's own error, or the
 * runner itself being stopped).
 */

import { execFileSync, spawn, spawnSync } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { closeSync, cpSync, existsSync, lstatSync, mkdirSync, openSync, readFileSync, readdirSync, renameSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { amendEntry, counted, gate, loadLedger, openRunEntry, saveLedger, totals, tripwireNotice, LEDGER_PATH } from "./compare-ledger.mjs";
import { check as checkProfile, commandFor, layout, settingsFor } from "./compare-profile.mjs";
import { digestTranscripts, projectDiff, sessionTranscripts } from "./prove-evidence.mjs";
import { neverUsed } from "./prove-pattern.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
export const FIRST_STEPS = join(root, "experiments", "comparisons", "study-three-first-steps.json");

/** A refusal before any call: nothing was started and nothing was spent. */
export class NotStarted extends Error {
  constructor(message) {
    super(message.startsWith("not started") ? message : `not started: ${message}`);
    this.name = "NotStarted";
  }
}

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

/**
 * The sessions of the game experiment open on this machine: its start script names every session `arena-claude-<which>`
 * (or `arena-codex-<which>`), and that name is on the process's command line. The whole process list is read, so a
 * look that could not be made is told apart from a look that found nothing: if `ps` fails, or prints no process at
 * all, this throws, and nothing paid is started on a check that was not made.
 */
export function gameSessionsOpen(run = spawnSync) {
  const listed = run("ps", ["-axo", "pid=,command="], { encoding: "utf8", maxBuffer: 16 << 20 });
  const lines = String(listed.stdout ?? "").split("\n").filter((line) => line.trim() !== "");
  if (listed.error || listed.status !== 0 || lines.length === 0) {
    throw new NotStarted(`the process list could not be read (${listed.error?.message ?? `ps exited ${listed.status} and printed ${lines.length} line(s)`}), so it is not known whether a session of the game experiment is open. Nothing paid runs on a check that was not made`);
  }
  return lines.filter((line) => /--name arena-(?:claude|codex)-/.test(line)).map((line) => line.trim().slice(0, 160));
}

/**
 * The harness, by its whole path. A session's own path is a clean one that does not hold the harness's folder, so the
 * program is named whole, as the game's start script names it. It is looked for on the runner's path, must be a file
 * that is there, and its version is asked for before anything is spent.
 */
export function findHarness(run = spawnSync) {
  const found = run("/bin/sh", ["-c", "command -v claude"], { encoding: "utf8" });
  const path = String(found.stdout ?? "").trim().split("\n")[0];
  if (found.status !== 0 || !isAbsolute(path) || !existsSync(path)) throw new NotStarted(`the harness was not found on this shell's path (command -v claude gave ${JSON.stringify(path)})`);
  const version = run(path, ["--version"], { encoding: "utf8" });
  if (version.status !== 0 || !String(version.stdout ?? "").trim()) throw new NotStarted(`${path} did not answer --version`);
  return { path, version: version.stdout.trim() };
}

/** What the first steps have cost so far, by the ledger: every line of theirs at its reported cost, or at its ceiling when that is not known. */
export function firstStepsSpent(ledger, plan) {
  const mine = (project) => plan.projects.some((name) => project === name || String(project).startsWith(`${name}/`));
  return ledger.invocations.filter((entry) => mine(entry.project ?? entry.template)).reduce((sum, entry) => sum + counted(entry), 0);
}

/** Everything that must hold before a call, as a list of what does not. Empty means go. */
export function refusals({ home, cwd, claude, gameOpen = gameSessionsOpen(), profileCheck = checkProfile }) {
  const out = [];
  const at = layout(home);
  if (gameOpen.length > 0) out.push(`a session of the game experiment is open (${gameOpen.length} process(es) named arena-…): nothing paid runs beside it`);
  for (const line of profileCheck({ home, claude })) {
    // The work folder holds this session's own folder by now; that it holds nothing else is checked just below.
    if (!line.ok && line.what !== "its work folder is empty") out.push(`the profile: ${line.what}: ${line.how}`);
  }
  if (!resolve(cwd).startsWith(`${at.work}/`)) out.push(`the session's folder ${cwd} is not under ${at.work}`);
  else {
    const own = relative(at.work, resolve(cwd)).split("/")[0];
    const others = existsSync(at.work) ? readdirSync(at.work).filter((name) => name !== own) : [];
    if (others.length > 0) out.push(`the work folder holds more than this session's folder (${others.join(", ")}): an earlier session's files are where this one's commands could look`);
  }
  return out;
}

// ── one call ─────────────────────────────────────────────────────────────

/** What ended a run, from the process and the harness's own result. `which` names the watchdog's limit when it fired. */
export function endedBy({ child, output }) {
  if (child.timed_out) return { ended_by: "the watchdog", which: "minutes" };
  if (child.runner_stopped) return { ended_by: "the harness", which: null, why: `the runner itself was stopped (${child.runner_stopped}) and ended the session with it` };
  if (output && /max_budget/i.test(String(output.subtype ?? ""))) return { ended_by: "the watchdog", which: "dollars" };
  if (!output) return { ended_by: "the harness", which: null, why: child.error ? `the harness did not start: ${child.error.message}` : `no result from the harness (exit ${child.status ?? child.signal})` };
  if (output.is_error === true) return { ended_by: "the harness", which: null, why: `the harness's result is its own error (${output.subtype ?? "no subtype"}${output.api_error_status ? `, status ${output.api_error_status}` : ""})` };
  return { ended_by: "the session", which: null };
}

/**
 * Run a program in a process group of its own, with its output to two files, for at most `ms`. At the limit the
 * whole group is asked to end, and killed `grace` later if any of it is left. If the runner is itself told to stop
 * (interrupted, ended, or its terminal closed), it ends the group first. Resolves, never rejects.
 */
export function runBounded({ program, args, cwd, env, outPath, errPath, ms, grace = 5000 }) {
  return new Promise((done) => {
    const out = openSync(outPath, "w");
    const err = openSync(errPath, "w");
    const facts = { status: null, signal: null, error: null, timed_out: false, runner_stopped: null };
    const child = spawn(program, args, { cwd, env, stdio: ["ignore", out, err], detached: true });
    const group = (signal) => {
      try {
        process.kill(-child.pid, signal);
      } catch {}
    };
    let killer = null;
    const end = () => {
      group("SIGTERM");
      killer ??= setTimeout(() => group("SIGKILL"), grace);
    };
    const limit = setTimeout(() => {
      facts.timed_out = true;
      end();
    }, ms);
    const stopped = (signal) => () => {
      facts.runner_stopped = signal;
      end();
    };
    // Interrupted, told to end, or its terminal closed: in each case the session is ended before the runner goes on to record it.
    const handlers = ["SIGINT", "SIGTERM", "SIGHUP"].map((signal) => [signal, stopped(signal)]);
    for (const [signal, handler] of handlers) process.once(signal, handler);
    let finished = false;
    const finish = (more) => {
      if (finished) return;
      finished = true;
      clearTimeout(limit);
      for (const [signal, handler] of handlers) process.removeListener(signal, handler);
      // The leader is gone. Whatever of its group it left behind after a limit or a stop is killed now, not in five seconds.
      if (killer) clearTimeout(killer);
      if (facts.timed_out || facts.runner_stopped) group("SIGKILL");
      closeSync(out);
      closeSync(err);
      done({ ...facts, ...more });
    };
    child.once("error", (error) => finish({ error }));
    child.once("exit", (status, signal) => finish({ status, signal }));
  });
}

/**
 * Start one session and settle it on the ledger. Before the call, a refusal throws `NotStarted`. Once the call has
 * started nothing is thrown: what went wrong afterwards is in `problems_after_the_call`. The record is copied by
 * `copyRecord`, by the caller, before anything is read from it.
 */
export async function runSession({ home, cwd, prompt, model, effort, usd, minutes, closed = [], label, note, go, claude, ledgerPath = LEDGER_PATH, harnessDir, gameOpen, profileCheck, plan = JSON.parse(readFileSync(FIRST_STEPS, "utf8")), findProgram = findHarness, grace }) {
  const at = layout(home);
  const base = `${JSON.stringify(settingsFor({ home }), null, 2)}\n`;
  let harness, ledger, ceiling, sessionId, command, entry, spentBefore;
  let settingsWritten = false;
  // Everything before the call. Whatever fails here, nothing was started: the settings go back if they were written,
  // and what is thrown is a `NotStarted`, whatever it was.
  try {
    if (!go) throw new NotStarted("no word from the driver for this step (--go)");
    harness = claude ? { path: claude, version: null } : findProgram();
    const refused = refusals({ home, cwd, claude: harness.path, gameOpen, profileCheck });
    if (refused.length > 0) throw new NotStarted(`\n  - ${refused.join("\n  - ")}`);
    ledger = loadLedger(ledgerPath);
    const decision = gate(ledger, { ...label, kind: "kickoff" });
    if (!decision.ok) throw new NotStarted(`the ledger refuses: ${decision.reason}`);
    ceiling = Math.min(usd, decision.maxBudget);
    // The first steps' own ceiling: what they have cost, and this call at its worst, may not pass what was set for them.
    const spent = firstStepsSpent(ledger, plan);
    if (spent + ceiling > plan.stop_usd) throw new NotStarted(`the first steps have cost $${spent.toFixed(2)} on the ledger, and this call may cost up to $${ceiling.toFixed(2)}: together past the $${plan.stop_usd.toFixed(2)} at which they stop (experiments/comparisons/study-three-first-steps.json). Past that is the owner's word, recorded there`);
    sessionId = randomUUID();
    command = commandFor({ home, claude: harness.path, cwd, prompt, model, effort, sessionId, maxBudgetUsd: ceiling, closed });

    // From here on something is written. The settings for this run, with what it closes to commands, read back; a copy for the record.
    const settings = `${JSON.stringify(settingsFor({ home, closed }), null, 2)}\n`;
    mkdirSync(harnessDir, { recursive: true });
    settingsWritten = true;
    writeFileSync(join(at.profile, "settings.json"), settings, "utf8");
    if (readFileSync(join(at.profile, "settings.json"), "utf8") !== settings) throw new NotStarted("the profile's settings are not what was written");
    writeFileSync(join(harnessDir, "settings.json"), settings, "utf8");
    spentBefore = totals(ledger).spent;
    entry = openRunEntry(ledger, { ...label, kind: "kickoff", maxBudget: ceiling, sessionId, note: [note, `the driver's go: ${go}`].filter(Boolean).join("; ") });
    saveLedger(ledger, ledgerPath);
  } catch (error) {
    if (settingsWritten) {
      try {
        writeFileSync(join(at.profile, "settings.json"), base, "utf8");
      } catch {}
    }
    throw error instanceof NotStarted ? error : new NotStarted(error.message);
  }

  const outPath = join(harnessDir, "claude-output.json");
  const started = Date.now();
  const child = await runBounded({ program: command.argv[0], args: command.argv.slice(1), cwd, env: command.env, outPath, errPath: join(harnessDir, "claude-stderr.txt"), ms: Math.round(minutes * 60_000), grace });
  const wall = Math.round((Date.now() - started) / 1000);
  const problems = [];
  // The profile's settings go back to what the repository says, so the next check and the next run find them clean.
  try {
    writeFileSync(join(at.profile, "settings.json"), base, "utf8");
  } catch (error) {
    problems.push(`the profile's settings could not be put back: ${error.message}`);
  }
  // The harness's result is an object or it is nothing: whatever else the file holds is not read as one.
  let output = null;
  try {
    const parsed = JSON.parse(readFileSync(outPath, "utf8"));
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) output = parsed;
  } catch {}
  const ending = endedBy({ child, output });
  const reported = typeof output?.total_cost_usd === "number" ? output.total_cost_usd : null;
  // A harness that could not be started spent nothing; any other call with no reported cost counts at its ceiling.
  const neverRan = Boolean(child.error) && !output && !child.timed_out;
  const cost = reported !== null ? Math.round(reported * 1e6) / 1e6 : neverRan ? 0 : null;
  const never = neverUsed(output?.modelUsage);
  let ledgerLine = entry.n;
  try {
    entry = amendEntry(ledger, entry, { ended: new Date().toISOString(), status: output === null ? "failed" : output.is_error ? "error" : "ok", cost_usd: cost, reported_cost_usd: reported, note: [entry.note, `ended by ${ending.ended_by}${ending.which ? ` (${ending.which})` : ""}`, ending.why, neverRan ? "nothing was spent" : ""].filter(Boolean).join("; "), ...(never.length > 0 ? { never_used: never } : {}) }, ledgerPath);
    ledgerLine = entry.n;
  } catch (error) {
    problems.push(`the ledger line could not be settled: ${error.message}. It is still marked running; settle it by hand with the cost in this record`);
  }
  let tripwire = "";
  try {
    tripwire = tripwireNotice(loadLedger(ledgerPath), spentBefore);
  } catch {}
  return {
    session_id: sessionId,
    transcript: command.transcript,
    ledger_n: ledgerLine,
    reported_cost_usd: reported,
    counted_usd: cost ?? ceiling,
    wall_s: wall,
    ...ending,
    watchdog: { usd: ceiling, minutes, fired: ending.ended_by === "the watchdog" ? ending.which : null, is_not_a_graphs_stop: true },
    harness: harness.version ? harness : { path: harness.path },
    models: Object.keys(output?.modelUsage ?? {}),
    models_never_used: never,
    harness_turns: output?.num_turns ?? null,
    exit: child.status ?? child.signal ?? null,
    command: command.argv.map((arg) => (arg === prompt ? "<the prompt>" : arg)),
    environment: Object.keys(command.env).sort(),
    problems_after_the_call: problems,
    tripwire,
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
// An address ends in a name of letters, so a package and its version (`left-pad@1.3.0`) is not taken for one.
const ADDRESS = /[A-Za-z0-9._%+-]+@(?:[A-Za-z0-9-]+\.)+[A-Za-z]{2,}(?![A-Za-z0-9-])/g;
/** Addresses that are nobody's: the harness's own trailer and a host's name. The neutral commit's has no dot and is not matched at all. */
const NOBODYS = new Set(["noreply@anthropic.com", "git@github.com"]);

/** A text with nothing of the account's left in it: the home folder's path becomes `~`, and an e-mail address is taken out. */
export function scrub(text, { home = homedir() } = {}) {
  let addresses = 0;
  const parts = String(text).split(home);
  const cleaned = parts.join("~").replace(ADDRESS, (address) => {
    if (NOBODYS.has(address.toLowerCase())) return address;
    addresses += 1;
    return "<an address, kept out>";
  });
  return { text: cleaned, addresses, home_paths: parts.length - 1 };
}

const MAX_FILE = 1 << 20;

/** Scrub every plain text file under a record folder. Returns what was taken out. */
export function scrubRecord(recordDir, options) {
  const found = { addresses: 0, home_paths: 0 };
  const walk = (dir) => {
    for (const name of readdirSync(dir)) {
      const full = join(dir, name);
      const stat = lstatSync(full);
      if (stat.isDirectory()) walk(full);
      else if (stat.isFile() && stat.size <= 8 * MAX_FILE) {
        const before = readFileSync(full, "utf8");
        const after = scrub(before, options);
        found.addresses += after.addresses;
        found.home_paths += after.home_paths;
        if (after.text !== before) writeFileSync(full, after.text, "utf8");
      }
    }
  };
  walk(recordDir);
  return found;
}

/** Copy a folder a session wrote, keeping only plain files of a sane size: a link, a device or a huge file is named and left. */
export function copyPlain(from, to) {
  const left = [];
  const walk = (src, dst) => {
    for (const name of readdirSync(src)) {
      const full = join(src, name);
      const stat = lstatSync(full);
      if (stat.isDirectory()) walk(full, join(dst, name));
      else if (stat.isFile() && stat.size <= MAX_FILE) {
        mkdirSync(dst, { recursive: true });
        cpSync(full, join(dst, name));
      } else left.push(`${relative(from, full)} (${stat.isFile() ? `${stat.size} bytes` : "not a plain file"})`);
    }
  };
  walk(from, to);
  return left;
}

/** The lines of a file a session wrote, or null with the reason when it is not a plain file of a sane size. A file that is not there has none. */
export function plainLines(path) {
  let stat;
  try {
    stat = lstatSync(path);
  } catch {
    return { lines: 0, why: "it is not there" };
  }
  if (!stat.isFile() || stat.size > MAX_FILE) return { lines: null, why: stat.isFile() ? `it is ${stat.size} bytes` : "it is not a plain file" };
  return { lines: readFileSync(path, "utf8").split("\n").filter((line) => line.trim() !== "").length, why: null };
}

/** The checksum of a file a session could have replaced: only of a plain file of a sane size, never of what a link points at. */
export function plainSha(path) {
  let stat;
  try {
    stat = lstatSync(path);
  } catch {
    return "it is not there";
  }
  return stat.isFile() && stat.size <= MAX_FILE ? sha256(path) : "it is not a plain file of a sane size";
}

/**
 * Copy a session's record into the repository's folder for it. Each part is tried on its own, so that nothing a
 * session left stops the rest being kept; what could not be kept is in `problems`. `annotate(digest, resultsOf)` lets
 * a caller add what its counter needs from the whole results. At the end nothing of the account's is left in it.
 */
export function copyRecord({ home, cwd, base, call, recordDir, prompt, graphId, annotate = (digest) => digest, excludes = [".grooph", ".claude"] }) {
  const at = layout(home);
  const problems = [...(call.problems_after_the_call ?? [])];
  const attempt = (what, work, otherwise) => {
    try {
      return work();
    } catch (error) {
      problems.push(`${what}: ${error.message}`);
      return otherwise;
    }
  };
  attempt("the record's folder", () => mkdirSync(recordDir, { recursive: true }));
  for (const name of ["claude-output.json", "claude-stderr.txt", "settings.json"]) attempt(name, () => existsSync(join(call.harness_dir, name)) && cpSync(join(call.harness_dir, name), join(recordDir, name)));
  attempt("the prompt", () => writeFileSync(join(recordDir, "prompt.md"), prompt, "utf8"));
  const transcripts = attempt("the transcripts", () => sessionTranscripts(at.profile, call.session_id), []);
  const digest = attempt("the digest", () => digestTranscripts(transcripts, cwd), []);
  const kept = attempt("what the counter needs from the results", () => annotate(digest, (session) => resultsOfTranscript(transcripts[digest.indexOf(session)].file)), digest);
  attempt("the digest's file", () => writeFileSync(join(recordDir, "transcript-digest.json"), `${JSON.stringify(kept, null, 2)}\n`, "utf8"));
  // What the session was given at its start, read from its own transcript by the game experiment's script.
  if (transcripts.length > 0) {
    attempt("what the session was given", () => {
      const loaded = spawnSync(process.execPath, [join(root, "experiments", "game", "setup", "loaded.mjs"), ...transcripts.map((t) => t.file)], { encoding: "utf8" });
      writeFileSync(join(recordDir, "loaded.txt"), loaded.stdout || `loaded.mjs printed nothing (exit ${loaded.status})\n${loaded.stderr}`, "utf8");
    });
  }
  if (base) {
    attempt("the project's change", () => {
      const change = projectDiff(cwd, base, excludes);
      writeFileSync(join(recordDir, "project.diff"), change.diff.length > 2 * MAX_FILE ? `${change.diff.slice(0, 2 * MAX_FILE)}\n… cut at ${2 * MAX_FILE} characters of ${change.diff.length}\n` : change.diff, "utf8");
      call.project_files_changed = change.files;
    });
  }
  const runs = graphId ? join(cwd, ".grooph", graphId, "runs") : null;
  const left = runs && existsSync(runs) ? attempt("the run folder", () => copyPlain(runs, join(recordDir, "runs")), []) : [];
  if (left.length > 0) problems.push(`left out of the run folder's copy: ${left.join(", ")}`);
  const named = attempt("the transcripts' checksums", () => transcripts.map((t) => ({ who: t.who, file: t.file, sha256: sha256(t.file), stays: "on this machine" })), []);
  const taken = attempt("taking the account's own out of the record", () => scrubRecord(recordDir, {}), { addresses: null, home_paths: null });
  return { digest: kept, transcripts: named, run_folders: attempt("the run folders' names", () => (runs && existsSync(runs) ? readdirSync(runs).sort() : []), []), problems, kept_out_of_the_record: taken };
}

/**
 * Write a run's `result.json`: the call's facts without the harness's whole output, and whatever the caller measured
 * after the session. Scrubbed like the rest. If it cannot be written it is printed instead, and nothing is thrown.
 */
export function writeResult(recordDir, call, facts) {
  const { output, harness_dir: _harnessDir, ...kept } = call;
  const result = { ...kept, result_tail: typeof output?.result === "string" ? output.result.slice(-600) : null, ...facts, recorded: new Date().toISOString() };
  const text = scrub(`${JSON.stringify(result, null, 2)}\n`).text;
  try {
    mkdirSync(recordDir, { recursive: true });
    writeFileSync(join(recordDir, "result.json"), text, "utf8");
  } catch (error) {
    console.error(`result.json could not be written to ${recordDir} (${error.message}). It is printed here instead; keep it:\n${text}`);
    return { ...JSON.parse(text), problems: [...(facts.problems ?? []), `result.json could not be written: ${error.message}`] };
  }
  return JSON.parse(text);
}

/** A session's folder: a new one under the profile's work folder, which must be empty, holding one project with one neutral commit. */
export function makeProject({ home, name, fill }) {
  const at = layout(home);
  const there = existsSync(at.work) ? readdirSync(at.work) : [];
  if (there.length > 0) throw new NotStarted(`the profile's work folder is not empty (${there.join(", ")}): an earlier session's folder is still there. Move it aside before another is made`);
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
 * way, so the next session starts with both empty. Nothing is deleted; the record says where they went. The place
 * they go is closed to a later session's commands by the profile's settings.
 */
export function setAside({ home, work, sessionId }) {
  const at = layout(home);
  const kept = join(home, "kept", sessionId);
  mkdirSync(join(kept, "t"), { recursive: true });
  renameSync(work, join(kept, "work"));
  for (const name of readdirSync(at.temp)) renameSync(join(at.temp, name), join(kept, "t", name));
  return kept;
}

/**
 * Whether the first paid call's record says the runs after it may be made: the latest attempt that is recorded, and
 * its `may_the_pair_run`. No record is a no.
 */
export function firstCallAllows(folder = join(root, "experiments", "comparisons", "profile", "first-call")) {
  const records = existsSync(folder) ? readdirSync(folder).filter((name) => /^record(-\d+)?$/.test(name) && existsSync(join(folder, name, "result.json"))) : [];
  if (records.length === 0) return { ok: false, why: "the first paid call has no record: it is made first, and what it showed is read before anything else runs" };
  const latest = records.sort((a, b) => Number(a.split("-")[1] ?? 1) - Number(b.split("-")[1] ?? 1)).at(-1);
  const result = JSON.parse(readFileSync(join(folder, latest, "result.json"), "utf8"));
  return result.may_the_pair_run === true ? { ok: true, record: latest } : { ok: false, why: `the first paid call's latest record (${latest}) does not say the runs after it may be made` };
}

/**
 * For a dry run: the harness's path as a paid run would find it, and what a paid run from this folder would be
 * refused for as things stand, by the same gates (the ledger's own are read only when a call is asked for). Starts
 * nothing and writes nothing.
 */
export function asThingsStand({ home, cwd, afterTheFirstCall = true }) {
  const refused = [];
  let path = null;
  try {
    path = findHarness().path;
  } catch (error) {
    refused.push(error.message);
  }
  try {
    refused.push(...refusals({ home, cwd, claude: path ?? undefined }));
  } catch (error) {
    refused.push(error.message);
  }
  if (afterTheFirstCall) {
    const first = firstCallAllows();
    if (!first.ok) refused.push(first.why);
  }
  return { claude: path ?? "<the harness was not found>", refused, says: refused.length === 0 ? "as things stand, a paid run would pass the gates before the ledger's" : `as things stand, a paid run would be refused:\n  - ${refused.join("\n  - ")}` };
}

export const relativeToRoot = (path) => relative(root, path);
