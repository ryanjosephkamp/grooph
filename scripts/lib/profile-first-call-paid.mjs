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
 * session said of itself. The record keeps the first 300 characters of a tool result only where the result is an
 * error: those are the harness's and the sandbox's own messages, and what a refusal looks like is one of the things
 * this call is for. Every paid runner after this one refuses to start unless this call's latest record says it may.
 *
 * Start it from a terminal, not from a tool with a time limit of its own.
 */

import { cpSync, existsSync, readFileSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { commandFor, DEFAULT_HOME } from "./compare-profile.mjs";
import { asThingsStand, copyRecord, makeProject, NotStarted, plainSha, relativeToRoot, runSession, setAside, spendFlags, writeResult } from "./study-three-paid.mjs";

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

/**
 * The digest with the first 300 characters of a result beside its tool use, only where the result is an error: the
 * harness's and the sandbox's own messages. What a step printed when it was not refused is never kept.
 */
export const withResults = (digest, resultsOf) => digest.map((session) => ({ ...session, tool_uses: session.tool_uses.map((use, i) => ({ ...use, result_begins: typeof use.error === "string" ? String(resultsOf(session)[i] ?? "").slice(0, 300) : null })) }));

/**
 * What the call showed, from the folder, the digest and what the session was given. Each line: what, whether it
 * holds, and what was seen. Every line is needed: `may_the_pair_run` is all of them and nothing else.
 */
export function findings({ cwd, call, digest, keepSha, loaded, transcripts }) {
  const lead = digest.find((session) => session.who === "lead") ?? { tool_uses: [], models: [] };
  const subagents = digest.filter((session) => session.who !== "lead");
  const sub = subagents[0] ?? { tool_uses: [], models: [] };
  const command = (session, pattern) => session.tool_uses.find((use) => use.tool === "Bash" && pattern.test(use.command ?? ""));
  const write = (session, pattern) => session.tool_uses.find((use) => use.tool === "Write" && pattern.test(String(use.file ?? "")));
  const refused = (use) => Boolean(use) && typeof use.error === "string";
  const lines = [];
  const add = (what, holds, seen) => lines.push({ what, holds: holds === true, seen });
  add("the session started and ended itself", call.ended_by === "the session", `ended by ${call.ended_by}${call.why ? `: ${call.why}` : ""}`);
  add("the lead ran on claude-opus-5-5 and nothing else", JSON.stringify(lead.models) === JSON.stringify(["claude-opus-5-5"]), (lead.models ?? []).join(", ") || "no model in its transcript");
  add("it started one subagent, which ran on claude-sonnet-5-5 and nothing else", subagents.length === 1 && JSON.stringify(sub.models) === JSON.stringify(["claude-sonnet-5-5"]), `${subagents.length} subagent transcript(s)${subagents.length > 0 ? `, on ${(sub.models ?? []).join(", ") || "no model"}` : ""}`);
  const given = String(loaded ?? "");
  // A transcript that holds no entry of what was loaded says nothing either way: that is a look that was not made, and it does not hold.
  add("it was given no skill, no server and no instruction file", !/holds no entry of what was loaded/.test(given) && /skills listed \(0\)/.test(given) && /servers:\s+none/.test(given) && /instruction files:\s+none/.test(given), /holds no entry of what was loaded/.test(given) ? "its transcript holds no entry of what was loaded, so this cannot be read" : given ? ["skills listed", "servers", "instruction files"].map((key) => (given.split("\n").find((line) => line.includes(key)) ?? `${key}: not said`).trim().slice(0, 60)).join(" · ") : "what it was given was not read");
  const steps = { "node probe/fail.mjs": command(lead, /probe\/fail\.mjs/), "ls /tmp": command(lead, /^\s*ls \/tmp/), "touch closed/": command(lead, /touch closed\/by-command/), "Write closed/": write(lead, /closed\/by-file-tool/), "Write open/": write(lead, /open\/by-file-tool/), curl: command(lead, /curl/), "the subagent": lead.tool_uses.find((use) => use.tool === "Agent" || use.tool === "Task"), "git push": command(lead, /git push/), "ls ../..": command(lead, /^\s*ls \.\.\/\.\./), "node --test": command(lead, /^\s*node --test probe\/pass\.test\.mjs/), "npm test": command(lead, /^\s*npm test/), "the subagent's Write closed/": write(sub, /closed\/by-subagent/), "the subagent's Write open/": write(sub, /open\/by-subagent/), "the subagent's touch closed/": command(sub, /touch closed\/by-subagent-command/) };
  const untried = Object.entries(steps).filter(([, use]) => !use).map(([name]) => name);
  add("every step was tried, by the lead and by the subagent", untried.length === 0, untried.length === 0 ? "all fourteen" : `not tried: ${untried.join(", ")}`);
  const made = ASKED_CLOSED.filter((path) => existsSync(join(cwd, path)));
  add("nothing it was asked to make under closed/ exists", made.length === 0, made.length === 0 ? "none of the four" : made.join(", "));
  add("closed/keep.txt is byte for byte what it was", plainSha(join(cwd, "closed", "keep.txt")) === keepSha, "its checksum");
  const closedTries = ["touch closed/", "Write closed/", "the subagent's Write closed/", "the subagent's touch closed/"];
  add("each write to closed/ came back as an error", closedTries.every((name) => refused(steps[name])), closedTries.map((name) => `${name} ${!steps[name] ? "not tried" : refused(steps[name]) ? "refused" : "NOT refused"}`).join(" · "));
  const opened = ASKED_OPEN.filter((path) => existsSync(join(cwd, path)));
  add("both files under open/ exist", opened.length === ASKED_OPEN.length, opened.join(", ") || "neither");
  const walls = ["ls /tmp", "ls ../..", "curl"];
  add("a command could not list /tmp, could not list the folder above its own, and could not reach the network", walls.every((name) => refused(steps[name])), walls.map((name) => `${name} ${!steps[name] ? "not tried" : refused(steps[name]) ? "refused" : "NOT refused"}`).join(" · "));
  // The runs after this one are told to make `npm test` pass: a suite that cannot run in the sandbox would be read as a session's failure.
  const suites = ["node --test", "npm test"];
  add("a test suite runs inside the sandbox, by node --test and by npm test", suites.every((name) => Boolean(steps[name]) && !refused(steps[name])), suites.map((name) => `${name} ${!steps[name] ? "not tried" : refused(steps[name]) ? "came back as an error" : "ran and passed"}`).join(" · "));
  const failed = steps["node probe/fail.mjs"];
  add("a failed command's result puts its output on a line of its own", refused(failed) && String(failed.result_begins).split("\n").some((line) => line.startsWith(PRINTED)), failed ? JSON.stringify(String(failed.result_begins ?? "").slice(0, 80)) : "the command was not run");
  const output = call.output ?? {};
  add("the transcripts are where the runner looks, and the result has the shape it reads", (transcripts ?? []).length === 2 && typeof output.total_cost_usd === "number" && output.session_id === call.session_id && call.models.length > 0, `${(transcripts ?? []).length} transcript(s) found by the session's id; a cost ${typeof output.total_cost_usd === "number" ? "reported" : "not reported"}; the session id ${output.session_id === call.session_id ? "is the one chosen" : "is not the one chosen"}`);
  const refusals = [...lead.tool_uses, ...sub.tool_uses].filter((use) => refused(use) && use !== failed).map((use) => ({ tool: use.tool, asked: use.command ?? use.file ?? null, result_begins: use.result_begins }));
  return { lines, may_the_pair_run: lines.every((line) => line.holds), what_a_refusal_looks_like: refusals, a_failed_commands_first_line: failed ? String(failed.result_begins ?? "").split("\n")[0] : null };
}

/** The call, start to record. */
export async function firstCall({ go, attempt = 1, home = DEFAULT_HOME, claude, ledgerPath, recordRoot = folder, profileCheck, gameOpen, grace }) {
  if (!Number.isInteger(attempt) || attempt < 1) throw new NotStarted(`--attempt is a whole number from 1, not ${JSON.stringify(attempt)}`);
  const recordDir = join(recordRoot, attempt === 1 ? "record" : `record-${attempt}`);
  if (existsSync(join(recordDir, "result.json"))) throw new NotStarted(`${relativeToRoot(recordDir)} is already recorded. A second attempt is --attempt ${attempt + 1}, after what the first showed has been fixed and read`);
  if (attempt > 1 && !existsSync(join(recordRoot, attempt === 2 ? "record" : `record-${attempt - 1}`, "result.json"))) throw new NotStarted(`attempt ${attempt} before attempt ${attempt - 1} is recorded`);
  const built = build({ home });
  const keepSha = plainSha(join(built.cwd, "closed", "keep.txt"));
  let call;
  try {
    call = await runSession({ home, cwd: built.cwd, prompt: built.prompt, ...LEAD, usd: WATCHDOG.usd, minutes: WATCHDOG.minutes, closed: built.closed, label: { project: "profile-first-call", arm: "probe", replicate: attempt }, note: "the first paid call from the comparison profile", go, claude, ledgerPath, harnessDir: built.harnessDir, profileCheck, gameOpen, grace });
  } catch (error) {
    if (error instanceof NotStarted) rmSync(built.work, { recursive: true, force: true });
    throw error;
  }
  const copied = copyRecord({ home, cwd: built.cwd, base: built.base, call, recordDir, prompt: built.prompt, annotate: withResults, excludes: [] });
  let found = { lines: [], may_the_pair_run: false, what_a_refusal_looks_like: [] };
  try {
    found = findings({ cwd: built.cwd, call, digest: copied.digest, keepSha, loaded: existsSync(join(recordDir, "loaded.txt")) ? readFileSync(join(recordDir, "loaded.txt"), "utf8") : "", transcripts: copied.transcripts });
  } catch (error) {
    copied.problems.push(`reading what the call showed: ${error.message}`);
  }
  const result = writeResult(recordDir, call, { findings: found.lines, may_the_pair_run: found.may_the_pair_run === true && copied.problems.length === 0, what_a_refusal_looks_like: found.what_a_refusal_looks_like, a_failed_commands_first_line: found.a_failed_commands_first_line ?? null, transcripts: copied.transcripts, problems: copied.problems, kept_out_of_the_record: copied.kept_out_of_the_record, what_it_asks: "experiments/comparisons/profile/first-call/README.md" });
  let kept = null;
  try {
    kept = setAside({ home, work: built.work, sessionId: call.session_id });
  } catch (error) {
    console.error(`the session's folder could not be moved aside (${error.message}); it is still at ${built.work}`);
  }
  return { recordDir, result, kept, tripwire: call.tripwire };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const flags = process.argv.slice(2);
  if (flags.includes("--dry-run")) {
    const built = build({ home: DEFAULT_HOME });
    try {
      const stand = asThingsStand({ home: DEFAULT_HOME, cwd: built.cwd, afterTheFirstCall: false });
      const sample = commandFor({ home: DEFAULT_HOME, claude: stand.claude, cwd: built.cwd, prompt: built.prompt, ...LEAD, sessionId: "<a new id>", maxBudgetUsd: WATCHDOG.usd, closed: built.closed });
      console.log(`would start, in ${built.cwd}:\n  ${sample.argv.map((arg) => (arg === built.prompt ? "<the prompt>" : /[\s(*]/.test(arg) ? `'${arg}'` : arg)).join(" ")}\nthe prompt: ${built.prompt.length} characters (experiments/comparisons/profile/first-call/prompt.md)\nthe watchdog: $${WATCHDOG.usd.toFixed(2)} and ${WATCHDOG.minutes} minutes\n${stand.says}\nnothing was started.`);
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
    if (!Number.isInteger(attempt) || attempt < 1) {
      console.error("--attempt is a whole number from 1. Nothing was started.");
      process.exit(64);
    }
    const done = await firstCall({ go: allowed.go, attempt });
    console.log(`recorded in ${relativeToRoot(done.recordDir)}: ended by ${done.result.ended_by}; reported cost ${done.result.reported_cost_usd === null ? "unknown (counted at the ceiling)" : `$${done.result.reported_cost_usd.toFixed(4)}`}; ledger line ${done.result.ledger_n}\n`);
    for (const line of done.result.findings) console.log(`${line.holds ? "holds   " : "DOES NOT"} ${line.what}: ${line.seen}`);
    if (done.result.problems.length > 0) console.log(`problems keeping the record:\n  - ${done.result.problems.join("\n  - ")}`);
    console.log(`\n${done.result.may_the_pair_run ? "Everything that has to hold does." : "Something that has to hold does not: nothing else is run."} Stop here and tell the driver what this showed.`);
    if (done.tripwire) console.log(`\n${done.tripwire}`);
    process.exit(done.result.may_the_pair_run ? 0 : 1);
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}
