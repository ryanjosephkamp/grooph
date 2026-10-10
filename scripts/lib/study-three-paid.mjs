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
 *      the project's change (read through a copy of the repository made before the session, never through the
 *      session's own) and its run folder. Nothing a session leaves stops the record being kept, and nothing
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
import { closeSync, cpSync, existsSync, lstatSync, mkdirSync, mkdtempSync, openSync, readFileSync, readdirSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { amendEntry, counted, gate, loadLedger, openRunEntry, saveLedger, totals, tripwireNotice, LEDGER_PATH } from "./compare-ledger.mjs";
import { check as checkProfile, commandFor, layout, settingsFor, TEMPLATE } from "./compare-profile.mjs";
import { digestTranscripts, sessionTranscripts } from "./prove-evidence.mjs";
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

/** The flags a script does not know. A paid script refuses them: a flag that is not understood is never passed over. */
export function unknownFlags(flags, { plain = [], valued = [] }) {
  const unknown = [];
  for (let i = 0; i < flags.length; i += 1) {
    if (valued.includes(flags[i])) i += 1;
    else if (!plain.includes(flags[i])) unknown.push(flags[i]);
  }
  return unknown;
}

/**
 * The sessions of the game experiment open on this machine: its start script names every session `arena-claude-<which>`
 * (or `arena-codex-<which>`), and that name is on the process's command line. The whole process list is read, so a
 * look that could not be made is told apart from a look that found nothing: if `ps` fails, or prints no process at
 * all, this throws, and nothing paid is started on a check that was not made.
 */
export function gameSessionsOpen(run = spawnSync) {
  // Every process, with its whole command line, in the spelling both macOS and Linux take.
  const listed = run("ps", ["-A", "-ww", "-o", "pid=,command="], { encoding: "utf8", maxBuffer: 16 << 20 });
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
  const version = run(path, ["--version"], { encoding: "utf8", timeout: 15_000 });
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
 * (interrupted, ended, or its terminal closed), it ends the group first. When the program is gone, whatever it left
 * running in its group is killed, however it ended. Resolves, never rejects: a program that could not be started is
 * in `error`.
 */
export function runBounded({ program, args, cwd, env, outPath, errPath, ms, grace = 5000 }) {
  return new Promise((done) => {
    const facts = { status: null, signal: null, error: null, timed_out: false, runner_stopped: null };
    // A program that could not be started at all is a fact like any other, not something thrown.
    let out, err, child;
    try {
      out = openSync(outPath, "w");
      err = openSync(errPath, "w");
      child = spawn(program, args, { cwd, env, stdio: ["ignore", out, err], detached: true });
    } catch (error) {
      for (const file of [out, err]) if (file !== undefined) closeSync(file);
      done({ ...facts, error });
      return;
    }
    const group = (signal) => {
      if (child.pid === undefined) return;
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
      // Told a second time while the session is being ended: the group is killed now, and the runner still records it.
      if (facts.runner_stopped) {
        group("SIGKILL");
        return;
      }
      facts.runner_stopped = signal;
      end();
    };
    // Interrupted, told to end, or its terminal closed: in each case the session is ended before the runner goes on to
    // record it. The handlers stay until the session is gone, so a second signal cannot end the runner first.
    const handlers = ["SIGINT", "SIGTERM", "SIGHUP"].map((signal) => [signal, stopped(signal)]);
    for (const [signal, handler] of handlers) process.on(signal, handler);
    let finished = false;
    const finish = (more) => {
      if (finished) return;
      finished = true;
      clearTimeout(limit);
      for (const [signal, handler] of handlers) process.removeListener(signal, handler);
      if (killer) clearTimeout(killer);
      // The session's own process is gone. Whatever it left running in its group goes now, however the session ended:
      // nothing of a session outlives it, to write into its folder after the record is copied.
      group("SIGKILL");
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
 *
 * `server` is for a run that attaches a server of its own (the watching check's third arm): `{ mcp, allowed, withheld }`,
 * handed to `commandFor` as they are. Without it the command is what it was before a run could name one.
 */
export async function runSession({ home, cwd, prompt, model, effort, usd, minutes, closed = [], label, note, go, claude, ledgerPath = LEDGER_PATH, harnessDir, gameOpen, profileCheck, plan, findProgram = findHarness, grace, server = null }) {
  const at = layout(home);
  let base, harness, ledger, ceiling, sessionId, command, entry, spentBefore;
  let settingsWritten = false;
  // Everything before the call. Whatever fails here, nothing was started: the settings go back if they were written,
  // and what is thrown is a `NotStarted`, whatever it was.
  try {
    if (!go) throw new NotStarted("no word from the driver for this step (--go)");
    plan ??= JSON.parse(readFileSync(FIRST_STEPS, "utf8"));
    base = `${JSON.stringify(settingsFor({ home }), null, 2)}\n`;
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
    command = commandFor({ home, claude: harness.path, cwd, prompt, model, effort, sessionId, maxBudgetUsd: ceiling, closed, ...(server ? { mcp: server.mcp, allowed: server.allowed ?? [], withheld: server.withheld ?? [] } : {}) });

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

/**
 * The same for a value that came from JSON or is on its way to it: every string in it, keys too. JSON is never
 * scrubbed as text: an address that follows an escape (a new line, a tab) would take the escape's letter with it, and
 * what was left would no longer be JSON.
 */
export function scrubValue(value, options) {
  const found = { addresses: 0, home_paths: 0 };
  const text = (string) => {
    const cleaned = scrub(string, options);
    found.addresses += cleaned.addresses;
    found.home_paths += cleaned.home_paths;
    return cleaned.text;
  };
  const walk = (part) => (typeof part === "string" ? text(part) : Array.isArray(part) ? part.map(walk) : part && typeof part === "object" ? Object.fromEntries(Object.entries(part).map(([key, inner]) => [text(key), walk(inner)])) : part);
  return { value: walk(value), ...found };
}

const MAX_FILE = 1 << 20;

/** One file's text, scrubbed in the way its kind allows: JSON by its values, lines of JSON line by line, anything else as text. */
function scrubFile(name, before, options) {
  const asJson = (text, write) => {
    const cleaned = scrubValue(JSON.parse(text), options);
    return { text: write(cleaned.value), addresses: cleaned.addresses, home_paths: cleaned.home_paths };
  };
  try {
    if (name.endsWith(".json")) return asJson(before, (value) => `${JSON.stringify(value, null, /^\s*[[{]\s*\n/.test(before) ? 2 : 0)}${before.endsWith("\n") ? "\n" : ""}`);
  } catch {}
  if (name.endsWith(".jsonl")) {
    const found = { addresses: 0, home_paths: 0 };
    const lines = before.split("\n").map((line) => {
      let cleaned;
      try {
        cleaned = line.trim() ? asJson(line, (value) => JSON.stringify(value)) : { text: line, addresses: 0, home_paths: 0 };
      } catch {
        cleaned = scrub(line, options);
      }
      found.addresses += cleaned.addresses;
      found.home_paths += cleaned.home_paths;
      return cleaned.text;
    });
    return { text: lines.join("\n"), ...found };
  }
  return scrub(before, options);
}

/**
 * Scrub every file under a record folder, each in the way its kind allows. A file with nothing to take out is left
 * byte for byte as it was. Returns what was taken out.
 */
export function scrubRecord(recordDir, options) {
  const found = { addresses: 0, home_paths: 0 };
  const walk = (dir) => {
    for (const name of readdirSync(dir)) {
      const full = join(dir, name);
      const stat = lstatSync(full);
      if (stat.isDirectory()) walk(full);
      else if (stat.isFile() && stat.size <= 8 * MAX_FILE) {
        const before = readFileSync(full, "utf8");
        const after = scrubFile(name, before, options);
        found.addresses += after.addresses;
        found.home_paths += after.home_paths;
        if (after.addresses + after.home_paths > 0) writeFileSync(full, after.text, "utf8");
      }
    }
  };
  walk(recordDir);
  return found;
}

/**
 * Copy a folder a session wrote, keeping only plain files of text and of a sane size: a link of either kind, a device,
 * a huge file or one that is not text is named and left. A record is text, and only text can be passed through the scrub.
 */
export function copyPlain(from, to) {
  const left = [];
  const walk = (src, dst) => {
    for (const name of readdirSync(src)) {
      const full = join(src, name);
      const stat = lstatSync(full);
      if (stat.isDirectory()) walk(full, join(dst, name));
      else if (stat.isFile() && stat.nlink > 1) left.push(`${relative(from, full)} (it has another name elsewhere: a hard link)`);
      else if (stat.isFile() && stat.size <= MAX_FILE) {
        const bytes = readFileSync(full);
        if (!Buffer.from(bytes.toString("utf8"), "utf8").equals(bytes)) {
          left.push(`${relative(from, full)} (not text)`);
          continue;
        }
        mkdirSync(dst, { recursive: true });
        writeFileSync(join(dst, name), bytes);
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
 * The project's change since its first commit, new files included, in the shape of prove-evidence.mjs `projectDiff`.
 * It is read through `gitDir`, a copy of the repository made before the session started and kept beside its folder,
 * where a session cannot write. The session's own `.git` is never used, and neither is the account's configuration:
 * nothing a session configured there (a filter, a monitor, a hook, a diff program) is run by the runner. No ignore
 * file is honored, so a session cannot hide what it added. `files` is the whole change only when `not_wholly_read` is
 * null: a file or a folder that could not be opened is named there, and a caller must not read "no change" from the rest.
 */
export function changeSince({ cwd, base, gitDir, excludes = [], addLimitMs = 120_000, maxBuffer = 64 << 20 }) {
  const temp = mkdtempSync(join(tmpdir(), "grooph-paid-index-"));
  const env = { PATH: process.env.PATH, HOME: process.env.HOME ?? "", GIT_CONFIG_GLOBAL: "/dev/null", GIT_CONFIG_NOSYSTEM: "1", GIT_TERMINAL_PROMPT: "0", GIT_INDEX_FILE: join(temp, "index") };
  const run = (args, more = {}) => spawnSync("git", ["--git-dir", gitDir, "--work-tree", cwd, ...args], { cwd, env, encoding: "utf8", maxBuffer, ...more });
  const git = (...args) => {
    const out = run(args);
    // An error with a clean exit is still a failure: output past the buffer can come back cut short from a program that ended well.
    if (out.status !== 0 || out.error) throw new Error(`git ${args[0]} failed: ${String(out.stderr ?? "").trim().slice(0, 300) || out.error?.message || `it exited ${out.status ?? out.signal}`}`);
    return out.stdout;
  };
  try {
    git("read-tree", base);
    // Every file, whatever an ignore file says: a session's own .gitignore, or the account's, hides nothing here. A
    // file that cannot be opened does not stop the rest being read; that it was not read is said. The read is whole
    // only when git ended well AND said nothing at all: a folder nobody may open is only a warning to it, and so is a
    // repository inside the project, whose files it does not read. One limit of time, so a huge file cannot stall the record.
    const added = run(["add", "-A", "-f", "--ignore-errors"], { timeout: addLimitMs });
    const said = [added.error?.code === "ETIMEDOUT" ? `git add did not end within ${Math.round(addLimitMs / 1000)} seconds` : added.error ? `git add: ${added.error.message}` : null, ...String(added.stderr ?? "").trim().split("\n").filter(Boolean).slice(0, 5)].filter(Boolean).join("; ").slice(0, 400);
    const notRead = added.status === 0 && said === "" ? null : said || `git add exited ${added.status ?? added.signal}`;
    const spec = [".", ...excludes.map((path) => `:(exclude)${path}`)];
    const diff = git("diff", "--cached", "--no-color", "--no-ext-diff", "--no-textconv", base, "--", ...spec);
    const stat = git("diff", "--cached", "--name-status", base, "--", ...spec);
    return { diff, files: stat.split("\n").filter(Boolean).map((line) => line.replace(/\t/g, " ")), not_wholly_read: notRead };
  } finally {
    rmSync(temp, { recursive: true, force: true });
  }
}

/** The list of changed files a record keeps: the first `max`, and how many more there were. A list that was cut is not the whole change. */
export function capFiles(files, max = 2000) {
  return { listed: files.slice(0, max), left_out: Math.max(0, files.length - max) };
}

/**
 * Copy a session's record into the repository's folder for it. Each part is tried on its own, so that nothing a
 * session left stops the rest being kept; what could not be kept is in `problems`. `annotate(digest, resultsOf)` lets
 * a caller add what its counter needs from the whole results. At the end nothing of the account's is left in it.
 */
export function copyRecord({ home, cwd, base, gitDir, call, recordDir, prompt, graphId, annotate = (digest) => digest, excludes = [".grooph", ".claude"] }) {
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
  if (base && gitDir) {
    attempt("the project's change", () => {
      const change = changeSince({ cwd, base, gitDir, excludes });
      writeFileSync(join(recordDir, "project.diff"), change.diff.length > 2 * MAX_FILE ? `${change.diff.slice(0, 2 * MAX_FILE)}\n… cut at ${2 * MAX_FILE} characters of ${change.diff.length}\n` : change.diff, "utf8");
      const kept = capFiles(change.files);
      call.project_files_changed = kept.listed;
      const short = [change.not_wholly_read, kept.left_out > 0 ? `${change.files.length} files changed, and only the first ${kept.listed.length} are listed` : null].filter(Boolean).join("; ");
      if (short) {
        call.project_change_not_wholly_read = short;
        problems.push(`the project's change was not wholly read: ${short}`);
      }
    });
  }
  const runs = graphId ? join(cwd, ".grooph", graphId, "runs") : null;
  const left = runs && existsSync(runs) ? attempt("the run folder", () => copyPlain(runs, join(recordDir, "runs")), []) : [];
  if (left.length > 0) problems.push(`left out of the run folder's copy: ${left.join(", ")}`);

  const named = attempt("the transcripts' checksums", () => transcripts.map((t) => ({ who: t.who, file: t.file, sha256: sha256(t.file), stays: "on this machine" })), []);
  const taken = attempt("taking the account's own out of the record", () => scrubRecord(recordDir, {}), { addresses: null, home_paths: null });
  return { digest: kept, transcripts: named, run_folders: attempt("the run folders' names", () => (runs && existsSync(runs) ? readdirSync(runs).sort() : []), []), left_out: left, problems, kept_out_of_the_record: taken };
}

/**
 * Write a run's `result.json`: the call's facts without the harness's whole output, and whatever the caller measured
 * after the session. Its values are scrubbed like the rest of the record, before they are made into JSON. Nothing is
 * thrown: if it cannot be written it is printed instead, and what comes back says so.
 */
export function writeResult(recordDir, call, facts) {
  let result = { ...facts };
  try {
    const { output, harness_dir: _harnessDir, ...kept } = call;
    result = scrubValue({ ...kept, result_tail: typeof output?.result === "string" ? output.result.slice(-600) : null, ...facts, recorded: new Date().toISOString() }).value;
    mkdirSync(recordDir, { recursive: true });
    writeFileSync(join(recordDir, "result.json"), `${JSON.stringify(result, null, 2)}\n`, "utf8");
  } catch (error) {
    // Nothing is thrown from here either: a result that cannot even be printed is said to be so.
    let shown = "(it could not be printed either)";
    try {
      shown = JSON.stringify(result, null, 2);
    } catch {}
    console.error(`result.json could not be written to ${recordDir} (${error.message}). It is printed here instead; keep it:\n${shown}`);
    result = { ...result, problems: [...(Array.isArray(result.problems) ? result.problems : []), `result.json could not be written: ${error.message}`] };
  }
  return result;
}

/**
 * A session's folder: a new one under the profile's work folder, which must be empty, holding one project with one
 * neutral commit. Beside it, where a session's commands and file tools cannot write, go the harness's output
 * (`harness/`) and a copy of the repository as it was made (`base.git`).
 */
export function makeProject({ home, name, fill }) {
  const at = layout(home);
  const there = existsSync(at.work) ? readdirSync(at.work) : [];
  if (there.length > 0) throw new NotStarted(`the profile's work folder is not empty (${there.join(", ")}): an earlier session's folder is still there. Move it aside before another is made`);
  const work = join(at.work, randomUUID().slice(0, 8));
  const cwd = join(work, name);
  try {
    mkdirSync(cwd, { recursive: true });
    fill(cwd);
    const git = (...args) => execFileSync("git", ["-C", cwd, ...args], { encoding: "utf8" });
    git("init", "-q");
    git("config", "user.email", "dev@localhost");
    git("config", "user.name", "dev");
    git("add", "-A");
    git("commit", "-qm", "initial commit");
    const base = git("rev-parse", "HEAD").trim();
    // The repository as the runner made it, kept beside the session's folder: the change is read through this copy afterwards.
    const gitDir = join(work, "base.git");
    cpSync(join(cwd, ".git"), gitDir, { recursive: true });
    return { work, cwd, base, gitDir, harnessDir: join(work, "harness") };
  } catch (error) {
    // Nothing was started: a folder that could not be made whole is taken away, so that it does not stand in the next one's way.
    rmSync(work, { recursive: true, force: true });
    throw new NotStarted(`the session's folder could not be made: ${error.message}`);
  }
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
 * One checksum of what a session is started with: the profile's settings as the repository has them, and the fixed
 * part of the command and the environment `commandFor` builds (the flags, the permission mode, the rule that closes a
 * path to the file tools, the session's own path, the pins on model names). The walls the first call tests are in both.
 */
export function profileFingerprint() {
  const fixed = commandFor({ home: "/h", claude: "/c", cwd: "/h/work/a/p", prompt: "<the prompt>", model: "<the model>", effort: "<the effort>", sessionId: "<the id>", maxBudgetUsd: 1, closed: ["/h/work/a/p/closed"], user: "u", userHome: "/u" });
  return createHash("sha256").update(readFileSync(TEMPLATE)).update(JSON.stringify([fixed.argv, fixed.env])).digest("hex");
}

/**
 * What the first call's record is held against: the harness's version today, and the profile as the repository has it
 * today. What a session showed under another version or another profile is not known to hold now.
 */
export function asOfToday(find = findHarness) {
  let version;
  try {
    version = find().version;
  } catch {
    version = "the harness was not found";
  }
  return { harness_version: version, profile_sha256: profileFingerprint() };
}

/** An attempt's number from its folder's name: `record` is the first, `record-N` the Nth from the second on. Anything else is no attempt's. */
const attemptOf = (name) => (name === "record" ? 1 : /^record-(?:[2-9]|[1-9]\d+)$/.test(name) ? Number(name.slice(7)) : null);

/**
 * Whether the first paid call's record says the runs after it may be made. The latest attempt is the one that counts,
 * and it is the latest folder, whether or not it holds a result: an attempt that was started and left no result is a
 * no. Its yes has to be borne out by the record it sits in (every line holds, nothing went wrong keeping it, the
 * session ended itself), and the record has to have been made with today's harness and today's profile. No record is
 * a no; a record that cannot be read is a no; a folder that is no attempt's is a no until a person has looked.
 */
export function firstCallAllows(folder = join(root, "experiments", "comparisons", "profile", "first-call"), today = asOfToday()) {
  const no = (why) => ({ ok: false, why });
  const names = existsSync(folder) ? readdirSync(folder).filter((name) => /^record/.test(name)) : [];
  if (names.length === 0) return no("the first paid call has no record: it is made first, and what it showed is read before anything else runs");
  const odd = names.filter((name) => attemptOf(name) === null);
  if (odd.length > 0) return no(`the first paid call's folder holds ${odd.join(", ")}, which is no attempt's record: a person looks at it before anything runs`);
  const latest = names.sort((a, b) => attemptOf(a) - attemptOf(b)).at(-1);
  let result;
  try {
    result = JSON.parse(readFileSync(join(folder, latest, "result.json"), "utf8"));
  } catch (error) {
    return no(`the first paid call's latest attempt (${latest}) has no result that can be read (${error.code ?? error.name}): it was started and not recorded, or its record is cut short`);
  }
  if (result?.may_the_pair_run !== true) return no(`the first paid call's latest record (${latest}) does not say the runs after it may be made`);
  const lines = Array.isArray(result.findings) ? result.findings : [];
  const against = [lines.length === 0 ? "it holds no findings" : null, lines.some((line) => line?.holds !== true) ? "a finding in it does not hold" : null, (result.problems ?? []).length > 0 ? "something went wrong keeping it" : null, result.ended_by !== "the session" ? `it was ended by ${result.ended_by ?? "nobody it names"}` : null].filter(Boolean);
  if (against.length > 0) return no(`the first paid call's latest record (${latest}) says yes and does not bear it out: ${against.join("; ")}`);
  const then = { harness_version: result.harness?.version ?? null, profile_sha256: result.profile_sha256 ?? null };
  const moved = Object.keys(today).filter((key) => then[key] !== today[key]);
  if (moved.length > 0) return no(`the first paid call's latest record (${latest}) was made with another ${moved.map((key) => (key === "harness_version" ? `version of the harness (${then[key] ?? "not recorded"}, and today ${today[key]})` : "state of the profile (its settings, or the command a session is started with)")).join(" and another ")}: what it showed is not known to hold now, so it is made again as the next attempt`);
  return { ok: true, record: latest };
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
