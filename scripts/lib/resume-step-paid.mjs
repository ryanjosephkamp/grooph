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

import { sha256Of } from "./brake-count.mjs";
import { commandFor, DEFAULT_HOME } from "./compare-profile.mjs";
import { rebuildTree } from "./compare-score.mjs";
import { copyRecord, makeProject, relativeToRoot, runSession, setAside, spendFlags, writeResult } from "./study-three-paid.mjs";

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
  const { tree } = rebuildTree(from);
  try {
    const project = makeProject({
      home,
      name: JSON.parse(readFileSync(join(from, "..", "task", "package.json"), "utf8")).name,
      fill: (cwd) => {
        for (const name of readdirSync(tree)) if (name !== ".git") cpSync(join(tree, name), join(cwd, name), { recursive: true });
        const graph = join(cwd, ".grooph", expect.graph_id);
        mkdirSync(graph, { recursive: true });
        for (const name of ["LEAD.md", "KICKOFF.md", "MAPPING.md", "graph.grooph.json"]) cpSync(join(from, "package", name), join(graph, name));
        cpSync(join(from, "package", "agents"), join(cwd, ".claude", "agents"), { recursive: true });
        if (existsSync(join(from, "package", "skill"))) cpSync(join(from, "package", "skill"), join(cwd, ".claude", "skills", expect.graph_id), { recursive: true });
        cpSync(join(from, "runs", expect.run_id), join(graph, "runs", expect.run_id), { recursive: true });
      },
    });
    const graph = join(project.cwd, ".grooph", expect.graph_id);
    return { ...project, prompt: resumePrompt(expect, readFileSync(join(from, "package", "KICKOFF.md"), "utf8")), notesBefore: readFileSync(join(graph, "runs", expect.run_id, "notes.jsonl"), "utf8"), sourceSha: sha256Of(join(graph, "graph.grooph.json")) };
  } finally {
    rmSync(tree, { recursive: true, force: true });
  }
}

/** The seven things, read from the folder and the digest. Each: what, whether it holds, what was seen. */
export function resumed({ cwd, expect, call, digest, notesBefore, sourceSha, projectFilesChanged }) {
  const graph = join(cwd, ".grooph", expect.graph_id);
  const runs = existsSync(join(graph, "runs")) ? readdirSync(join(graph, "runs")).sort() : [];
  const notesPath = join(graph, "runs", expect.run_id, "notes.jsonl");
  const notesAfter = existsSync(notesPath) ? readFileSync(notesPath, "utf8") : "";
  const kept = notesAfter.startsWith(notesBefore.replace(/\n*$/, "\n")) || notesAfter.startsWith(notesBefore);
  const added = [];
  if (kept) {
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
  const atGate = added.filter((note) => note.at === `node:${expect.gate}` || /^edge:/.test(note.at ?? ""));
  const lines = [];
  const add = (what, holds, seen) => lines.push({ what, holds, seen });
  add("the session ended itself", call.ended_by === "the session", `ended by ${call.ended_by}${call.why ? `: ${call.why}` : ""}`);
  add("there is still one run folder, the one it was given", runs.length === 1 && runs[0] === expect.run_id, runs.join(", ") || "none");
  add("the notes it was given are the first lines of the notes it left, with at least one line after them", kept && added.length > 0, kept ? `${added.length} line(s) added` : "the first lines are not what it was given");
  add("no subagent was dispatched", dispatches === 0 && subagents === 0, `${dispatches} Agent call(s), ${subagents} subagent transcript(s)`);
  add("a new note stands at the gate or on its approval edge", atGate.length > 0, atGate.map((note) => note.at).join(", ") || "none");
  // The brief's ending is two lines: one that says the run is ending, and after it the graph's final note.
  const ending = added.findIndex((note) => note.outcome === "ending");
  add("a new note says the run is ending, and the last note is the graph's", ending >= 0 && ending < added.length - 1 && added.at(-1).at === "graph" && added.at(-1).outcome !== "ending", added.map((note) => `${note.at ?? "?"}${note.outcome ? `:${note.outcome}` : ""}`).join(", ") || "no line added");
  // Everything the session changed, less what is inside a run folder: the package's own files and the agent files count.
  const changed = (projectFilesChanged ?? []).filter((file) => !/\.grooph\/[^/]+\/runs\//.test(file));
  add("the source document is unchanged, and so is every file of the project outside the run folder", existsSync(join(graph, "graph.grooph.json")) && sha256Of(join(graph, "graph.grooph.json")) === sourceSha && changed.length === 0, changed.length === 0 ? "nothing changed" : changed.join(", "));
  const verdict = call.ended_by === "the harness" ? "invalid" : lines.every((line) => line.holds) ? "resumed" : "not resumed";
  return { verdict, lines, notes_added: added.length };
}

/** The step, start to record. */
export function resumeStep({ go, rerun = false, home = DEFAULT_HOME, claude, ledgerPath, recordRoot = home0, profileCheck, gameOpen }) {
  const expect = expectation();
  const first = join(recordRoot, "record");
  const recordDir = rerun ? join(recordRoot, "record-rerun") : first;
  if (!rerun && existsSync(join(first, "result.json"))) throw new Error(`not started: ${relativeToRoot(first)} is already recorded. Only an invalid run is made again, once, with --rerun and the driver's word`);
  if (rerun && (!existsSync(join(first, "result.json")) || JSON.parse(readFileSync(join(first, "result.json"), "utf8")).verdict !== "invalid")) throw new Error("not started: there is no invalid first record to run again");
  if (rerun && existsSync(join(recordDir, "result.json"))) throw new Error("not started: it was already run again once");
  const built = build({ home, expect });
  let call;
  try {
    call = runSession({ home, cwd: built.cwd, prompt: built.prompt, ...expect.lead, usd: expect.watchdog.usd_per_session, minutes: expect.watchdog.minutes_per_session, label: { project: "resume-by-a-fresh-session", arm: "A", replicate: rerun ? "1-rerun" : 1 }, note: `a fresh session resuming ${expect.from} at ${expect.gate}; the gate's answer is scripted`, go, claude, ledgerPath, harnessDir: built.harnessDir, profileCheck, gameOpen });
  } catch (error) {
    rmSync(built.work, { recursive: true, force: true });
    throw error;
  }
  const copied = copyRecord({ home, cwd: built.cwd, base: built.base, call, recordDir, prompt: built.prompt, graphId: expect.graph_id, excludes: [] });
  const found = resumed({ cwd: built.cwd, expect, call, digest: copied.digest, notesBefore: built.notesBefore, sourceSha: built.sourceSha, projectFilesChanged: call.project_files_changed });
  const result = writeResult(recordDir, call, { verdict: found.verdict, resumed_if: found.lines, notes_added: found.notes_added, from: expect.from, run_id: expect.run_id, the_gates_answer_is_scripted: true, transcripts: copied.transcripts, pre_registration: "experiments/comparisons/resume-by-a-fresh-session/README.md" });
  const kept = setAside({ home, work: built.work, sessionId: call.session_id });
  return { recordDir, result, kept, tripwire: call.tripwire };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const flags = process.argv.slice(2);
  const expect = expectation();
  if (flags.includes("--dry-run")) {
    const built = build({ home: DEFAULT_HOME, expect });
    try {
      const sample = commandFor({ home: DEFAULT_HOME, claude: "claude", cwd: built.cwd, prompt: built.prompt, ...expect.lead, sessionId: "<a new id>", maxBudgetUsd: expect.watchdog.usd_per_session });
      console.log(`would start, in ${built.cwd} (rebuilt from ${expect.from}: ${built.notesBefore.split("\n").filter(Boolean).length} notes, the last a halt at ${expect.gate}):\n  ${sample.argv.map((arg) => (arg === built.prompt ? "<the prompt>" : /[\s(*]/.test(arg) ? `'${arg}'` : arg)).join(" ")}\nthe prompt ends: ${JSON.stringify(built.prompt.trim().split("\n").at(-1))}\nthe watchdog: $${expect.watchdog.usd_per_session.toFixed(2)} and ${expect.watchdog.minutes_per_session} minutes\nnothing was started.`);
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
    const done = resumeStep({ go: allowed.go, rerun: flags.includes("--rerun") });
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
