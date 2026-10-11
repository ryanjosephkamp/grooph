// Reader of the protocol (slice 0111): prints, for each of the first check's 36 runs, the figures the second look's page cites (cost, turns, minutes, cache writes, subagents, recorded time), in the order they were run. Reads only; run from the repository root: node handoffs/0111-a-second-look-at-watching/reader-protocol/01-first-check-rows.mjs
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
const repo = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const base = join(repo, "experiments/watching");
const rows = [];
for (const block of ["sonnet", "opus", "haiku"]) for (const task of ["one", "four"]) for (const run of readdirSync(join(base, block, task)).sort()) {
  const f = join(base, block, task, run, "result.json");
  if (!existsSync(f)) continue;
  const r = JSON.parse(readFileSync(f, "utf8"));
  const s = r.measures.session;
  const sc = JSON.parse(readFileSync(join(base, block, task, run, "score.json"), "utf8"));
  rows.push({ run: r.run, n: r.ledger_n, recorded: r.recorded, cost: r.reported_cost_usd, turns: s.turns_as_the_harness_reports, messages: s.messages, min: s.minutes_by_the_runners_clock, wall_s: r.wall_s, secs: s.seconds_as_the_harness_reports,
    cw: s.tokens_as_the_harness_reports.cache_creation_input_tokens, cr: s.tokens_as_the_harness_reports.cache_read_input_tokens, out: s.tokens_as_the_harness_reports.output_tokens,
    cw_tr: s.tokens_in_its_transcript?.cache_creation_input_tokens, sub: r.measures.subagents.count, subs: r.measures.subagents, score: sc.packages.map((p) => `${p.package}:${p.passed}/${p.cases}`).join(" "), models: r.models, ended: r.ended_by });
}
rows.sort((a, b) => a.recorded.localeCompare(b.recorded));
for (const r of rows) console.log([r.run.padEnd(24), String(r.n).padStart(3), r.recorded, "$" + r.cost.toFixed(4), "turns", r.turns, "msgs", r.messages, "min", r.min, "wall_s", r.wall_s, "cw", r.cw, "cw_tr", r.cw_tr, "out", r.out, "sub", r.sub, r.score].join("  "));
if (process.argv.includes("--json")) console.log(JSON.stringify(rows, null, 1));
