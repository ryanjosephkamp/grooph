#!/usr/bin/env node
/**
 * The tables of the watching check, made from its records and from nothing else.
 *
 *   node experiments/watching/tables.mjs            print the three tables as Markdown
 *   node experiments/watching/tables.mjs --check    exit 1 unless RESULTS.md holds exactly these tables
 *
 * One row for each run, in the protocol's order, one table for each block (README.md, "How it will be read").
 * Every value is read from a run's result.json and score.json. No model, no network.
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const BLOCKS = ["sonnet", "opus", "haiku"];
const TASKS = ["one", "four"];
const ARMS = ["plain", "watched", "invited"];

const read = (path) => JSON.parse(readFileSync(path, "utf8"));
const money = (usd) => (typeof usd === "number" ? `$${usd.toFixed(2)}` : "not reported");

function row(block, task, arm, n) {
  const dir = join(here, block, task, `${arm}-${n}`);
  const result = read(join(dir, "result.json"));
  const score = existsSync(join(dir, "score.json")) ? read(join(dir, "score.json")) : null;
  const m = result.measures ?? {};
  const subagents = m.subagents ?? {};
  const kinds = Object.entries(subagents.by_type ?? {}).map(([type, count]) => `${count} ${type}`).join(", ");
  const footprint = m.footprint ?? {};
  const hook = result.the_hooks_file_beside_the_transcripts;
  const said = m.the_two_tools ?? {};
  return [
    `\`${task}\``,
    arm,
    String(n),
    result.ended_by ?? "",
    money(m.session?.cost_usd_as_the_harness_reports),
    String(m.session?.turns_as_the_harness_reports ?? ""),
    String(m.session?.minutes_by_the_runners_clock ?? ""),
    subagents.count > 0 ? `${subagents.count} (${kinds})` : "0",
    score ? score.packages.map((pkg) => `${pkg.passed}/${pkg.cases}`).join(" · ") : "not scored",
    arm === "plain" ? "" : `${footprint.named_in_the_input?.calls ?? 0} / ${footprint.shown_in_the_result?.calls ?? 0}`,
    arm === "plain" ? "" : hook ? `${hook.subagent_starts_in_the_hooks_file} / ${hook.subagent_stops_in_the_hooks_file}` : "no file",
    arm === "invited" ? `${said.searches_for_a_tool ?? 0} / ${(said.calls?.grooph_plan ?? 0) + (said.calls?.grooph_note ?? 0)}` : "",
  ];
}

export function tables() {
  const head = ["Task", "Arm", "Run", "Ended by", "Cost", "Turns", "Minutes", "Subagents", "Unseen tests passed", "Calls naming / shown the hook's files", "Hook: subagent starts / stops", "Searches for / calls of the two tools"];
  const out = [];
  for (const block of BLOCKS) {
    const lead = read(join(here, block, "one", "plain-1", "result.json")).measures?.session?.models_that_answered ?? [];
    out.push(`### The \`${block}\` block (the session's own model answered as ${lead.map((model) => `\`${model}\``).join(", ") || "not recorded"})`, "");
    out.push(`| ${head.join(" | ")} |`, `|${head.map(() => "---").join("|")}|`);
    for (let n = 1; n <= 2; n += 1) for (const arm of ARMS) for (const task of TASKS) out.push(`| ${row(block, task, arm, n).join(" | ")} |`);
    out.push("");
  }
  return out.join("\n");
}

const text = tables();
if (process.argv.includes("--check")) {
  const page = existsSync(join(here, "RESULTS.md")) ? readFileSync(join(here, "RESULTS.md"), "utf8") : "";
  if (!page.includes(text.trim())) {
    console.error("experiments/watching/RESULTS.md does not hold the tables these records make: run node experiments/watching/tables.mjs and paste what it prints");
    process.exit(1);
  }
  console.log("watching tables: RESULTS.md holds the tables its records make");
} else process.stdout.write(`${text}\n`);
