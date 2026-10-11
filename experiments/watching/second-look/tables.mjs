#!/usr/bin/env node
/**
 * The tables of the second look at watching, made from its records and from nothing else.
 *
 *   node experiments/watching/second-look/tables.mjs            print the tables as Markdown, one for each block that has a record
 *   node experiments/watching/second-look/tables.mjs --check    exit 1 unless RESULTS.md holds exactly these tables;
 *                                                                while nothing has been run, exit 1 if a results page exists at all
 *
 * One row for each run, in the protocol's order (README.md, "Three rounds, in two blocks"). Every value is read from a
 * run's result.json and score.json. A run that was made once more is read from its rerun. No model, no network.
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const BLOCKS = ["opus", "sonnet"];
const TASKS = ["four", "six"];
const ROUNDS = [
  ["plain", "watched", "outside"],
  ["watched", "outside", "plain"],
  ["outside", "plain", "watched"],
];
export const HEAD = ["Round", "Task", "Arm", "Ended by", "Cost", "Minutes", "Turns", "Subagents", "Most at once", "Unseen tests passed", "Tokens put out", "Written to the cache", "In the project: calls naming / shown", "Outside it: calls naming / shown / refused", "Final reply names the recorder", "Hook beside the harness: starts / stops · differences"];

const read = (path) => JSON.parse(readFileSync(path, "utf8"));
const money = (usd) => (typeof usd === "number" ? `$${usd.toFixed(2)}` : "not reported");
const number = (value) => (typeof value === "number" ? value.toLocaleString("en-US") : "");

/** A run's record: its own, or its rerun's when the harness ended its own or its own was never written. Null when it has none. */
function recordOf(root, block, task, arm, round) {
  const own = join(root, block, task, `${arm}-${round}`);
  const kept = (dir) => (existsSync(join(dir, "result.json")) ? { result: read(join(dir, "result.json")), score: existsSync(join(dir, "score.json")) ? read(join(dir, "score.json")) : null } : null);
  const first = kept(own);
  const again = kept(`${own}-rerun`);
  return !first || first.result.ended_by === "the harness" ? (again ?? first) : first;
}

function row(root, block, task, arm, round) {
  const record = recordOf(root, block, task, arm, round);
  if (!record) return [String(round), `\`${task}\``, arm, "not run", ...HEAD.slice(4).map(() => "")];
  const { result, score } = record;
  const m = result.measures ?? {};
  const subagents = m.subagents ?? {};
  const kinds = Object.entries(subagents.by_type ?? {}).map(([type, count]) => `${count} ${type}`).join(", ");
  const inside = m.footprint ?? {};
  const outside = m.noticed ?? {};
  const reply = outside.the_final_reply ?? {};
  const each = result.the_hooks_file_agent_by_agent;
  const starts = each ? each.each.reduce((sum, agent) => sum + agent.runs.start_lines, 0) : null;
  const stops = each ? each.each.reduce((sum, agent) => sum + agent.runs.stop_lines, 0) : null;
  return [
    String(round),
    `\`${task}\``,
    arm,
    result.ended_by ?? "",
    money(m.session?.cost_usd_as_the_harness_reports),
    String(m.session?.minutes_by_the_runners_clock ?? ""),
    String(m.session?.turns_as_the_harness_reports ?? ""),
    subagents.count > 0 ? `${subagents.count} (${kinds})` : "0",
    String(m.delegation?.most_at_once ?? ""),
    score ? score.packages.map((pkg) => `${pkg.passed}/${pkg.cases}`).join(" · ") : "not scored",
    number(m.delegation?.tokens_put_out_with_its_subagents),
    number(m.delegation?.tokens_written_to_the_cache_with_its_subagents),
    `${inside.named_in_the_input?.calls ?? 0} / ${inside.shown_in_the_result?.calls ?? 0}`,
    `${outside.named_in_the_input?.calls ?? 0} / ${outside.shown_in_the_result?.calls ?? 0} / ${outside.named_in_the_input?.of_them_refused ?? 0}`,
    reply.read ? (reply.names_the_recorder ? "yes" : "no") : "not read",
    arm === "plain" ? "" : each ? (each.the_hooks_file.found ? `${starts} / ${stops} · ${each.differences.count}` : "no file") : "not compared",
  ];
}

/** The tables, one for each block that has at least one record; an empty string while nothing has been run. */
export function tables(root = here) {
  const out = [];
  for (const block of BLOCKS) {
    const runs = ROUNDS.flatMap((arms, at) => arms.flatMap((arm) => TASKS.map((task) => [task, arm, at + 1])));
    const first = runs.map(([task, arm, round]) => recordOf(root, block, task, arm, round)).find(Boolean);
    if (!first) continue;
    const lead = first.result.measures?.session?.models_that_answered ?? [];
    out.push(`### The \`${block}\` block (the session's own model answered as ${lead.map((model) => `\`${model}\``).join(", ") || "not recorded"})`, "");
    out.push(`| ${HEAD.join(" | ")} |`, `|${HEAD.map(() => "---").join("|")}|`);
    for (const [task, arm, round] of runs) out.push(`| ${row(root, block, task, arm, round).join(" | ")} |`);
    out.push("");
  }
  return out.join("\n");
}

/** What `--check` says: whether the results page holds the tables its records make, or, with no record, that there is no page. */
export function check(root = here) {
  const text = tables(root).trim();
  const page = existsSync(join(root, "RESULTS.md")) ? readFileSync(join(root, "RESULTS.md"), "utf8") : null;
  if (text === "") return page === null ? { ok: true, says: "second look's tables: nothing has been run, and there is no results page" } : { ok: false, says: "experiments/watching/second-look/RESULTS.md exists and no run has a record: a results page is written from records" };
  if (page === null || !page.includes(text)) return { ok: false, says: "experiments/watching/second-look/RESULTS.md does not hold the tables these records make: run node experiments/watching/second-look/tables.mjs and paste what it prints" };
  return { ok: true, says: "second look's tables: RESULTS.md holds the tables its records make" };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  if (process.argv.includes("--check")) {
    const checked = check();
    (checked.ok ? console.log : console.error)(checked.says);
    process.exit(checked.ok ? 0 : 1);
  }
  process.stdout.write(`${tables()}\n`);
}
