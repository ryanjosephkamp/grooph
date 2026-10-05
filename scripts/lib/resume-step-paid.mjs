/**
 * The resume step: a halted run picked up by a fresh session from its folder
 * (experiments/comparisons/resume-by-a-fresh-session/README.md is its pre-registration). THIS SCRIPT CAN SPEND MONEY:
 * it starts one model session. It refuses to without `--spend` and `--go "<the driver's words>"`; `--dry-run` rebuilds
 * the halted run's folder, prints what would be started, and starts nothing.
 *
 *   node scripts/lib/resume-step-paid.mjs --dry-run
 *   node scripts/lib/resume-step-paid.mjs --spend --go "<the driver's words>" [--rerun]
 */

import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { commandFor, DEFAULT_HOME } from "./compare-profile.mjs";
import { rebuildTree } from "./compare-score.mjs";
import { asThingsStand, copyRecord, firstCallAllows, makeProject, NotStarted, plainSha, relativeToRoot, runSession, setAside, spendFlags, unknownFlags, writeResult } from "./study-three-paid.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const home0 = join(root, "experiments", "comparisons", "resume-by-a-fresh-session");
export const expectation = () => JSON.parse(readFileSync(join(home0, "expect.json"), "utf8"));

/** The prompt a fresh session is given: the package's kickoff as kept, then the one sentence. */
export function resumePrompt(expect, kickoff) {
  const sentence = expect.resume_sentence.replaceAll("{{run-id}}", expect.run_id).replaceAll("{{gate}}", expect.gate).replaceAll("{{answer}}", expect.answer);
  return `${kickoff.replace(/\n*$/, "\n")}\n${sentence}\n`;
}

/** Rebuild the halted run's project from its kept record, in a folder of its own under the profile's work folder. Starts nothing. */
export function build({ home, expect }) {
  const from = join(root, ...expect.from.split("/"));
  // Everything that is read is read before the session's folder is made: what fails after it would leave the folder behind.
  const name = JSON.parse(readFileSync(join(from, "..", "task", "package.json"), "utf8")).name;
  const prompt = resumePrompt(expect, readFileSync(join(from, "package", "KICKOFF.md"), "utf8"));
  const notesBefore = readFileSync(join(from, "runs", expect.run_id, "notes.jsonl"), "utf8");
  const sourceSha = plainSha(join(from, "package", "graph.grooph.json"));
  const { tree } = rebuildTree(from);
  try {
    const project = makeProject({
      home,
      name,
      fill: (cwd) => {
        for (const entry of readdirSync(tree)) if (entry !== ".git") cpSync(join(tree, entry), join(cwd, entry), { recursive: true });
        const graph = join(cwd, ".grooph", expect.graph_id);
        mkdirSync(graph, { recursive: true });
        for (const file of ["LEAD.md", "KICKOFF.md", "MAPPING.md", "graph.grooph.json"]) cpSync(join(from, "package", file), join(graph, file));
        cpSync(join(from, "package", "agents"), join(cwd, ".claude", "agents"), { recursive: true });
        if (existsSync(join(from, "package", "skill"))) cpSync(join(from, "package", "skill"), join(cwd, ".claude", "skills", expect.graph_id), { recursive: true });
        cpSync(join(from, "runs", expect.run_id), join(graph, "runs", expect.run_id), { recursive: true });
      },
    });
    return { ...project, prompt, notesBefore, sourceSha };
  } finally {
    rmSync(tree, { recursive: true, force: true });
  }
}

/** The seven things, read from the folder and the digest. Each: what, whether it holds, what was seen. */
export function resumed({ cwd, expect, call, digest, notesBefore, sourceSha, projectFilesChanged, notWhollyRead = null }) {
  const graph = join(cwd, ".grooph", expect.graph_id);
  const runs = existsSync(join(graph, "runs")) ? readdirSync(join(graph, "runs")).sort() : [];
  const notesPath = join(graph, "runs", expect.run_id, "notes.jsonl");
  const notesAfter = plainSha(notesPath).length === 64 ? readFileSync(notesPath, "utf8") : "";
  const prefix = notesAfter.startsWith(notesBefore.replace(/\n*$/, "\n")) || notesAfter.startsWith(notesBefore);
  const added = [];
  if (prefix) {
    for (const line of notesAfter.slice(notesBefore.length).split("\n")) {
      if (!line.trim()) continue;
      try {
        added.push(JSON.parse(line));
      } catch {
        added.push({ broken: true });
      }
    }
  }
  const lead = digest.find((session) => session.who === "lead") ?? { tool_uses: [] };
  const dispatches = lead.tool_uses.filter((use) => use.tool === "Agent" || use.tool === "Task").length;
  const subagents = digest.filter((session) => session.who !== "lead").length;
  // The gate itself, or the edge its approval takes: by the kept graph, not any edge at all.
  const kept = JSON.parse(readFileSync(join(root, ...expect.from.split("/"), "package", "graph.grooph.json"), "utf8"));
  const approval = kept.edges.filter((edge) => edge.from === expect.gate && edge.when === "pass").map((edge) => `edge:${edge.id}`);
  const atGate = added.filter((note) => note.at === `node:${expect.gate}` || approval.includes(note.at));
  const lines = [];
  const add = (what, holds, seen) => lines.push({ what, holds, seen });
  add("the session ended itself", call.ended_by === "the session", `ended by ${call.ended_by}${call.why ? `: ${call.why}` : ""}`);
  add("there is still one run folder, the one it was given", runs.length === 1 && runs[0] === expect.run_id, runs.join(", ") || "none");
  add("the notes it was given are the first lines of the notes it left, with at least one line after them", prefix && added.length > 0, prefix ? `${added.length} line(s) added` : "the first lines are not what it was given");
  add("no subagent was dispatched", dispatches === 0 && subagents === 0, `${dispatches} Agent call(s), ${subagents} subagent transcript(s)`);
  add("a new note stands at the gate or on its approval edge", atGate.length > 0, atGate.map((note) => note.at).join(", ") || "none");
  // The brief's ending is two lines: one that says the run is ending, and after it the graph's final note.
  const ending = added.findIndex((note) => note.outcome === "ending");
  add("a new note says the run is ending, and the last note is the graph's", ending >= 0 && ending < added.length - 1 && added.at(-1).at === "graph" && added.at(-1).outcome !== "ending", added.map((note) => `${note.at ?? "?"}${note.outcome ? `:${note.outcome}` : ""}`).join(", ") || "no line added");
  // Everything the session changed, less what is inside a run folder: the package's own files and the agent files count.
  // A change that was not read, or not wholly, is not "nothing changed": the line holds only on a whole read that shows none.
  const read = Array.isArray(projectFilesChanged) && !notWhollyRead;
  const changed = (Array.isArray(projectFilesChanged) ? projectFilesChanged : []).filter((file) => !/\.grooph\/[^/]+\/runs\//.test(file));
  add("the source document is unchanged, and so is every file of the project outside the run folder", read && plainSha(join(graph, "graph.grooph.json")) === sourceSha && changed.length === 0, !read ? `the project's change was not ${Array.isArray(projectFilesChanged) ? "wholly " : ""}read, so this is not known${notWhollyRead ? ` (${notWhollyRead})` : ""}${changed.length > 0 ? `; of what was read: ${changed.join(", ")}` : ""}` : changed.length === 0 ? "nothing changed" : changed.join(", "));
  const verdict = call.ended_by === "the harness" ? "invalid" : lines.every((line) => line.holds) ? "resumed" : "not resumed";
  return { verdict, lines, notes_added: added.length };
}

/** The step, start to record. */
export async function resumeStep({ go, rerun = false, home = DEFAULT_HOME, claude, ledgerPath, recordRoot = home0, profileCheck, gameOpen, firstCallGate = firstCallAllows(), grace }) {
  const expect = expectation();
  if (!firstCallGate.ok) throw new NotStarted(firstCallGate.why);
  const first = join(recordRoot, "record");
  const recordDir = rerun ? join(recordRoot, "record-rerun") : first;
  if (!rerun && existsSync(join(first, "result.json"))) throw new NotStarted(`${relativeToRoot(first)} is already recorded. Only an invalid run is made again, once, with --rerun and the driver's word`);
  if (rerun && (!existsSync(join(first, "result.json")) || JSON.parse(readFileSync(join(first, "result.json"), "utf8")).verdict !== "invalid")) throw new NotStarted("there is no invalid first record to run again");
  if (rerun && existsSync(join(recordDir, "result.json"))) throw new NotStarted("it was already run again once");
  const built = build({ home, expect });
  let call;
  try {
    call = await runSession({ home, cwd: built.cwd, prompt: built.prompt, ...expect.lead, usd: expect.watchdog.usd_per_session, minutes: expect.watchdog.minutes_per_session, label: { project: "resume-by-a-fresh-session", arm: "A", replicate: rerun ? "1-rerun" : 1 }, note: `a fresh session resuming ${expect.from} at ${expect.gate}; the gate's answer is scripted`, go, claude, ledgerPath, harnessDir: built.harnessDir, profileCheck, gameOpen, grace });
  } catch (error) {
    if (error instanceof NotStarted) rmSync(built.work, { recursive: true, force: true });
    throw error;
  }
  const copied = copyRecord({ home, cwd: built.cwd, base: built.base, gitDir: built.gitDir, call, recordDir, prompt: built.prompt, graphId: expect.graph_id, excludes: [] });
  let found = { verdict: call.ended_by === "the harness" ? "invalid" : "not resumed", lines: [], notes_added: null };
  try {
    found = resumed({ cwd: built.cwd, expect, call, digest: copied.digest, notesBefore: built.notesBefore, sourceSha: built.sourceSha, projectFilesChanged: call.project_files_changed, notWhollyRead: call.project_change_not_wholly_read ?? null });
  } catch (error) {
    copied.problems.push(`reading whether it resumed: ${error.message}`);
  }
  const result = writeResult(recordDir, call, { verdict: found.verdict, resumed_if: found.lines, notes_added: found.notes_added, from: expect.from, run_id: expect.run_id, the_gates_answer_is_scripted: true, transcripts: copied.transcripts, problems: copied.problems, kept_out_of_the_record: copied.kept_out_of_the_record, pre_registration: "experiments/comparisons/resume-by-a-fresh-session/README.md" });
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
  const unknown = unknownFlags(flags, { plain: ["--dry-run", "--spend", "--rerun"], valued: ["--go"] });
  if (unknown.length > 0) {
    console.error(`${unknown.join(", ")}: not a flag of this script. Nothing was started.`);
    process.exit(64);
  }
  const expect = expectation();
  if (flags.includes("--dry-run")) {
    const built = build({ home: DEFAULT_HOME, expect });
    try {
      const stand = asThingsStand({ home: DEFAULT_HOME, cwd: built.cwd });
      const sample = commandFor({ home: DEFAULT_HOME, claude: stand.claude, cwd: built.cwd, prompt: built.prompt, ...expect.lead, sessionId: "<a new id>", maxBudgetUsd: expect.watchdog.usd_per_session });
      console.log(`would start, in ${built.cwd} (rebuilt from ${expect.from}: ${built.notesBefore.split("\n").filter(Boolean).length} notes, the last a halt at ${expect.gate}):\n  ${sample.argv.map((arg) => (arg === built.prompt ? "<the prompt>" : /[\s(*]/.test(arg) ? `'${arg}'` : arg)).join(" ")}\nthe prompt ends: ${JSON.stringify(built.prompt.trim().split("\n").at(-1))}\nthe watchdog: $${expect.watchdog.usd_per_session.toFixed(2)} and ${expect.watchdog.minutes_per_session} minutes\n${stand.says}\nnothing was started.`);
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
    const done = await resumeStep({ go: allowed.go, rerun: flags.includes("--rerun") });
    console.log(`recorded in ${relativeToRoot(done.recordDir)}: ended by ${done.result.ended_by}; reported cost ${done.result.reported_cost_usd === null ? "unknown (counted at the ceiling)" : `$${done.result.reported_cost_usd.toFixed(4)}`}; ledger line ${done.result.ledger_n}\n`);
    for (const line of done.result.resumed_if) console.log(`${line.holds ? "holds  " : "DOES NOT"} ${line.what}: ${line.seen}`);
    console.log(`\noutcome: ${done.result.verdict}`);
    if (done.tripwire) console.log(`\n${done.tripwire}`);
    process.exit(done.result.verdict === "resumed" ? 0 : done.result.verdict === "invalid" ? 2 : 1);
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}
