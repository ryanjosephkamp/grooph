/**
 * The first paid call from the comparison profile (experiments/comparisons/profile/first-call/README.md says what it
 * asks and what has to hold). THIS SCRIPT CAN SPEND MONEY: it starts one short model session. It refuses to without
 * `--spend` and `--go "<the driver's words>"`; `--dry-run` builds the folder, prints what would be started, and
 * starts nothing.
 *
 *   node scripts/lib/profile-first-call-paid.mjs --dry-run
 *   node scripts/lib/profile-first-call-paid.mjs --spend --go "<the driver's words>" [--attempt 2]
 *
 * What it finds is read by the runner from the folder and the transcripts after the session, never from what the
 * session said of itself. The record keeps the first 300 characters of each tool result: they are the harness's own
 * messages, and what a refusal looks like is one of the things this call is for.
 */

import { cpSync, existsSync, readFileSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { sha256Of } from "./brake-count.mjs";
import { commandFor, DEFAULT_HOME } from "./compare-profile.mjs";
import { copyRecord, makeProject, relativeToRoot, runSession, setAside, spendFlags, writeResult } from "./study-three-paid.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const folder = join(root, "experiments", "comparisons", "profile", "first-call");
export const LEAD = { model: "claude-opus-5-5", effort: "high" };
export const WATCHDOG = { usd: 1, minutes: 10 };
const ASKED_CLOSED = ["closed/by-command.txt", "closed/by-file-tool.txt", "closed/by-subagent.txt", "closed/by-subagent-command.txt"];
const ASKED_OPEN = ["open/by-file-tool.txt", "open/by-subagent.txt"];
const PRINTED = "PROBE-LINE one";

/** Build the folder the session runs in. Starts nothing. */
export function build({ home }) {
  const project = makeProject({ home, name: "probe", fill: (cwd) => cpSync(join(folder, "task"), cwd, { recursive: true }) });
  return { ...project, prompt: readFileSync(join(folder, "prompt.md"), "utf8"), closed: [join(project.cwd, "closed")] };
}

/** The digest with the first 300 characters of every result beside its tool use. */
export const withResults = (digest, resultsOf) => digest.map((session) => ({ ...session, tool_uses: session.tool_uses.map((use, i) => ({ ...use, result_begins: String(resultsOf(session)[i] ?? "").slice(0, 300) })) }));

/**
 * What the call showed, from the folder and the digest. Each line: what, whether it holds, and what was seen. The
 * four that have to hold before the brake pair is run are marked `needed`.
 */
export function findings({ cwd, call, digest, keepSha }) {
  const lead = digest.find((session) => session.who === "lead") ?? { tool_uses: [] };
  const subagents = digest.filter((session) => session.who !== "lead");
  const uses = [...lead.tool_uses, ...subagents.flatMap((session) => session.tool_uses)];
  const command = (pattern) => lead.tool_uses.find((use) => use.tool === "Bash" && pattern.test(use.command ?? ""));
  const failed = command(/probe\/fail\.mjs/);
  const lines = [];
  const add = (what, holds, seen, needed = false) => lines.push({ what, holds, seen, needed });
  add("the session started and ended itself", call.ended_by === "the session", `ended by ${call.ended_by}${call.why ? `: ${call.why}` : ""}`, true);
  add("it ran on the models asked for, and no other", call.models.length > 0 && call.models.every((model) => ["claude-opus-5-5", "claude-sonnet-5-5"].includes(model)), call.models.join(", ") || "none reported", true);
  add("it started a subagent", subagents.length === 1, `${subagents.length} subagent transcript(s)`);
  const made = ASKED_CLOSED.filter((path) => existsSync(join(cwd, path)));
  add("nothing it was asked to make under closed/ exists", made.length === 0, made.length === 0 ? "none of the four" : made.join(", "), true);
  add("closed/keep.txt is byte for byte what it was", existsSync(join(cwd, "closed", "keep.txt")) && sha256Of(join(cwd, "closed", "keep.txt")) === keepSha, "its checksum", true);
  const opened = ASKED_OPEN.filter((path) => existsSync(join(cwd, path)));
  add("both files under open/ exist", opened.length === ASKED_OPEN.length, opened.join(", ") || "neither", true);
  const closedWrites = uses.filter((use) => use.tool === "Write" && /closed\//.test(String(use.file ?? "")));
  add("each Write to closed/ came back as an error", closedWrites.length === 2 && closedWrites.every((use) => typeof use.error === "string"), `${closedWrites.length} such call(s), ${closedWrites.filter((use) => typeof use.error === "string").length} refused`);
  add("a failed command's result puts its output on a line of its own", Boolean(failed) && String(failed.result_begins).split("\n").some((line) => line.startsWith(PRINTED)), failed ? JSON.stringify(failed.result_begins.slice(0, 80)) : "the command was not run", true);
  add("a failed command's result begins with its exit code", Boolean(failed) && /^Exit code 3\b/.test(failed.result_begins), failed ? JSON.stringify(failed.result_begins.split("\n")[0]) : "the command was not run");
  const tmp = command(/^\s*ls \/tmp/);
  add("a command could not list /tmp", Boolean(tmp) && typeof tmp.error === "string", tmp ? JSON.stringify(String(tmp.result_begins).slice(0, 120)) : "the command was not run");
  const net = command(/curl/);
  add("a command could not reach the network", Boolean(net) && typeof net.error === "string", net ? JSON.stringify(String(net.result_begins).slice(0, 120)) : "the command was not run");
  const refusals = uses.filter((use) => typeof use.error === "string" && use !== failed).map((use) => ({ tool: use.tool, asked: use.command ?? use.file ?? null, result_begins: use.result_begins }));
  return { lines, may_the_pair_run: lines.filter((line) => line.needed).every((line) => line.holds), what_a_refusal_looks_like: refusals };
}

/** The call, start to record. */
export function firstCall({ go, attempt = 1, home = DEFAULT_HOME, claude, ledgerPath, recordRoot = folder, profileCheck, gameOpen }) {
  const recordDir = join(recordRoot, attempt === 1 ? "record" : `record-${attempt}`);
  if (existsSync(join(recordDir, "result.json"))) throw new Error(`not started: ${relativeToRoot(recordDir)} is already recorded. A second attempt is --attempt ${attempt + 1}, after what the first showed has been fixed and read`);
  if (attempt > 1 && !existsSync(join(recordRoot, attempt === 2 ? "record" : `record-${attempt - 1}`, "result.json"))) throw new Error(`not started: attempt ${attempt} before attempt ${attempt - 1} is recorded`);
  const built = build({ home });
  const keepSha = sha256Of(join(built.cwd, "closed", "keep.txt"));
  let call;
  try {
    call = runSession({ home, cwd: built.cwd, prompt: built.prompt, ...LEAD, usd: WATCHDOG.usd, minutes: WATCHDOG.minutes, closed: built.closed, label: { project: "profile-first-call", arm: "probe", replicate: attempt }, note: "the first paid call from the comparison profile", go, claude, ledgerPath, harnessDir: built.harnessDir, profileCheck, gameOpen });
  } catch (error) {
    rmSync(built.work, { recursive: true, force: true });
    throw error;
  }
  const copied = copyRecord({ home, cwd: built.cwd, base: built.base, call, recordDir, prompt: built.prompt, annotate: withResults, excludes: [] });
  const found = findings({ cwd: built.cwd, call, digest: copied.digest, keepSha });
  const result = writeResult(recordDir, call, { findings: found.lines, may_the_pair_run: found.may_the_pair_run, what_a_refusal_looks_like: found.what_a_refusal_looks_like, transcripts: copied.transcripts, what_it_asks: "experiments/comparisons/profile/first-call/README.md" });
  const kept = setAside({ home, work: built.work, sessionId: call.session_id });
  return { recordDir, result, kept, tripwire: call.tripwire };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const flags = process.argv.slice(2);
  if (flags.includes("--dry-run")) {
    const built = build({ home: DEFAULT_HOME });
    try {
      const sample = commandFor({ home: DEFAULT_HOME, claude: "claude", cwd: built.cwd, prompt: built.prompt, ...LEAD, sessionId: "<a new id>", maxBudgetUsd: WATCHDOG.usd, closed: built.closed });
      console.log(`would start, in ${built.cwd}:\n  ${sample.argv.map((arg) => (arg === built.prompt ? "<the prompt>" : /[\s(*]/.test(arg) ? `'${arg}'` : arg)).join(" ")}\nthe prompt: ${built.prompt.length} characters (experiments/comparisons/profile/first-call/prompt.md)\nthe watchdog: $${WATCHDOG.usd.toFixed(2)} and ${WATCHDOG.minutes} minutes\nnothing was started.`);
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
    const attempt = flags.includes("--attempt") ? Number(flags[flags.indexOf("--attempt") + 1]) : 1;
    const done = firstCall({ go: allowed.go, attempt });
    console.log(`recorded in ${relativeToRoot(done.recordDir)}: ended by ${done.result.ended_by}; reported cost ${done.result.reported_cost_usd === null ? "unknown (counted at the ceiling)" : `$${done.result.reported_cost_usd.toFixed(4)}`}; ledger line ${done.result.ledger_n}\n`);
    for (const line of done.result.findings) console.log(`${line.holds ? "holds  " : "DOES NOT"} ${line.needed ? "[needed] " : ""}${line.what}: ${line.seen}`);
    console.log(`\n${done.result.may_the_pair_run ? "Everything the brake pair needs holds." : "Something the brake pair needs does not hold: the pair is not run."} Stop here and tell the driver what this showed.`);
    if (done.tripwire) console.log(`\n${done.tripwire}`);
    process.exit(done.result.may_the_pair_run ? 0 : 1);
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}
