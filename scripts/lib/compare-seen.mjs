/**
 * What a run's reviewer saw each time it ran the held-out suite (handoff 0019, criterion 5: "did a loop turn, and did
 * the turn change the result"). The scorer runs the suite once, on the final tree. Whether a loop's turn changed the
 * result is in what the reviewer's own runs of the suite printed along the way: 44 of 55 at round 0, 55 of 55 at round 1.
 *
 * A run's record keeps the transcript digest, which lists each command but not what it printed. This script reads
 * the harness's own transcripts of the run's sessions (under ~/.claude/projects, where the harness keeps them), finds
 * every command that ran a file of the held-out folder, and reads the counts from its output. It writes what it
 * found to `<project>/derived/<run>.held-out-seen.json`: a derived file, made after the run and labeled so, beside
 * the evidence and never inside it. A transcript the harness no longer keeps yields `transcripts_found: 0`, and says so.
 *
 *   node scripts/lib/compare-seen.mjs <project> [--write]     every run of the project; --write keeps the files
 */

import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { parseTestSummary } from "./compare-score.mjs";
import { sessionTranscripts } from "./prove-evidence.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const comparisons = join(root, "experiments", "comparisons");
const CLAUDE_DIR = process.env.CLAUDE_CONFIG_DIR ?? join(process.env.HOME ?? "", ".claude");

const textOf = (content) => (Array.isArray(content) ? content.map((c) => c.text ?? "").join("\n") : String(content ?? ""));

/** Every run of the held-out suite in one transcript: the command, when, and the counts its output printed. */
export function suiteRuns(file) {
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
  const runs = [];
  for (const record of records) {
    if (record.type !== "assistant") continue;
    for (const block of Array.isArray(record.message?.content) ? record.message.content : []) {
      const command = block.type === "tool_use" && block.name === "Bash" ? block.input?.command : null;
      if (typeof command !== "string" || !/held-out\//.test(command) || !/--test\b/.test(command)) continue;
      const counts = parseTestSummary(results.get(block.id) ?? "");
      runs.push({ at: record.timestamp ?? null, command: command.replace(/\/\S*?\.harness\/held-out\//g, "<held-out>/"), tests: counts.tests, pass: counts.pass, fail: counts.fail === null ? null : (counts.fail ?? 0) + (counts.cancelled ?? 0) });
    }
  }
  return runs;
}

/** One run folder: who ran the suite, in order, and what each saw. */
export function seenByRun(runDir, claudeDir = CLAUDE_DIR) {
  const result = JSON.parse(readFileSync(join(runDir, "result.json"), "utf8"));
  const sessions = [...new Set((result.invocations ?? []).map((inv) => inv.session_id).filter(Boolean))];
  const seen = [];
  let transcripts = 0;
  for (const sid of sessions) {
    for (const { file, who, meta } of sessionTranscripts(claudeDir, sid)) {
      transcripts += 1;
      for (const run of suiteRuns(file)) seen.push({ who: who === "lead" || who.includes("--") ? who.split("--").pop() : `${who} (${meta.description ?? "no description"})`, ...run });
    }
  }
  seen.sort((a, b) => String(a.at).localeCompare(String(b.at)));
  return {
    about: "Derived after the run, not evidence of it: every time a session of this run ran a file of the held-out folder, and the counts that run printed, read from the harness's own transcripts by scripts/lib/compare-seen.mjs. The scorer's count on the final tree is in the run's score.json.",
    run: `${result.project}/${result.arm}-${result.replicate}`,
    sessions,
    transcripts_found: transcripts,
    suite_runs: seen,
  };
}

// ── CLI ──────────────────────────────────────────────────────────────────
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const [project, ...rest] = process.argv.slice(2);
  if (!project) {
    console.error("usage: compare-seen.mjs <project> [--write]");
    process.exit(64);
  }
  const dir = join(comparisons, project);
  const runs = readdirSync(dir).filter((n) => /^[ABCD]-\d+$/.test(n) && existsSync(join(dir, n, "result.json"))).sort();
  for (const name of runs) {
    const seen = seenByRun(join(dir, name));
    console.log(`${name}: ${seen.transcripts_found === 0 ? "no transcript found" : seen.suite_runs.length === 0 ? "nobody ran the suite" : seen.suite_runs.map((s) => `${s.who.replace(/ \(.*$/, "")} ${s.pass ?? "?"}/${s.tests ?? "?"}`).join(" → ")}`);
    if (rest.includes("--write")) {
      mkdirSync(join(dir, "derived"), { recursive: true });
      writeFileSync(join(dir, "derived", `${name}.held-out-seen.json`), `${JSON.stringify(seen, null, 2)}\n`, "utf8");
    }
  }
}
