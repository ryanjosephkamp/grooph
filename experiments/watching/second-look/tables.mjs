#!/usr/bin/env node
/**
 * The tables of the second look at watching, made from its records and from nothing else.
 *
 *   node experiments/watching/second-look/tables.mjs            print the tables as Markdown, one for each block that has a record
 *   node experiments/watching/second-look/tables.mjs --check    exit 1 unless RESULTS.md holds exactly these tables;
 *                                                                while nothing has been run, exit 1 if a results page exists at all
 *
 * One row for each run, in the protocol's order (README.md, "Three rounds, in two blocks"). Every value is read from a
 * run's result.json and score.json. A run that was made once more is read from its rerun. The row of the run recorded
 * first in its block says so, and a run made from another checkout than that one is named under the table. No model,
 * no network.
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
/** A block's own three rounds: the first block takes them as they stand, the second starts from the second. */
const roundsOf = (block) => ROUNDS.map((_, at) => ROUNDS[(at + BLOCKS.indexOf(block)) % ROUNDS.length]);
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

function row(record, task, arm, round, first) {
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
    record === first ? `${round}, the block's first run` : String(round),
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
    const runs = roundsOf(block).flatMap((arms, at) => arms.flatMap((arm) => TASKS.map((task) => [task, arm, at + 1])));
    const records = runs.map(([task, arm, round]) => recordOf(root, block, task, arm, round));
    const made = records.filter(Boolean);
    if (made.length === 0) continue;
    // The block's first run is the one recorded first: whatever a block's first run pays, it is this row's.
    const first = made.reduce((earliest, record) => (String(record.result.recorded ?? "") < String(earliest.result.recorded ?? "") ? record : earliest));
    const lead = first.result.measures?.session?.models_that_answered ?? [];
    out.push(`### The \`${block}\` block (the session's own model answered as ${lead.map((model) => `\`${model}\``).join(", ") || "not recorded"})`, "");
    out.push(`| ${HEAD.join(" | ")} |`, `|${HEAD.map(() => "---").join("|")}|`);
    runs.forEach(([task, arm, round], at) => out.push(`| ${row(records[at], task, arm, round, first).join(" | ")} |`));
    out.push("");
    // One checkout for both blocks: a run made from another commit, or with another hook, than the block's first is named.
    const from = (record) => record.result.given?.the_runners_checkout ?? {};
    const others = runs.filter((_, at) => records[at] && (from(records[at]).commit !== from(first).commit || from(records[at]).hook_sha256 !== from(first).hook_sha256)).map(([task, arm, round]) => `\`${task}\` ${arm} ${round}`);
    if (others.length > 0) out.push(`Made from another checkout than the block's first run (another commit, or another hook's file): ${others.join(", ")}.`, "");
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
