/**
 * The summary table across proving records (handoff 0011, criterion 6): one row
 * per template, every number re-derived from the kept evidence with the same
 * checks `--check` runs. Prints Markdown.
 *
 *   node scripts/lib/prove-summary.mjs                 every template with a run/
 *   node scripts/lib/prove-summary.mjs <id> <id> …     only these
 */

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { checkRun } from "./prove-check.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const experiments = join(root, "experiments", "patterns");
const core = await import(join(root, "packages", "core", "dist", "src", "index.js"));

const ids = process.argv.slice(2).length > 0 ? process.argv.slice(2) : readdirSync(experiments).filter((name) => existsSync(join(experiments, name, "run", "result.json"))).sort();

const rows = [];
for (const id of ids) {
  const dir = join(experiments, id, "run");
  const result = JSON.parse(readFileSync(join(dir, "result.json"), "utf8"));
  const { problems, facts } = await checkRun(dir, { core, template: id });
  const back = facts.back_edges?.taken ? `yes: ${[...new Set([...(facts.back_edges.mentioned ?? []), ...(facts.back_edges.edge_notes ?? []).map((at) => at.slice(5))])].join(", ") || "later round"}; caught by ${facts.back_edges.caught_by.join(", ") || "?"}` : "none";
  const counted = facts.dispatch_count ?? [];
  const accuracy = counted.length === 0 ? "no count kept" : Math.max(...counted.map((c) => c.off)) === 0 ? `exact (${counted.map((c) => c.recorded).join(", ")})` : `off by ${Math.max(...counted.map((c) => c.off))}`;
  const ending = (facts.ending ?? []).join(", ") || "none named";
  rows.push({
    id,
    run: result.run_id,
    rounds: facts.last_round === null || facts.last_round === undefined ? "–" : String(facts.last_round),
    back,
    ending,
    cost: `$${(result.cost_usd ?? 0).toFixed(2)}`,
    turns: result.harness_turns ?? "?",
    denials: facts.denials ?? 0,
    accuracy,
    check: problems.length === 0 ? "pass" : `**fail** (${problems.length})`,
  });
}

const total = rows.reduce((sum, row) => sum + Number(row.cost.slice(1)), 0);
// The first column carries the template's glyph (slice 0015): patterns/glyphs/<id>.svg, relative to experiments/patterns/.
const shape = (id) => `<img src="../../patterns/glyphs/${id}.svg" alt="" width="120"><br>[\`${id}\`](${id}/README.md)`;
console.log("| Template | Run | Last round | Back edge taken, caught by | Ending | Cost | Harness turns | Denials | Dispatch count | `--check` |");
console.log("|---|---|---|---|---|---|---|---|---|---|");
for (const row of rows) console.log(`| ${shape(row.id)} | \`${row.run}\` | ${row.rounds} | ${row.back} | ${row.ending} | ${row.cost} | ${row.turns} | ${row.denials} | ${row.accuracy} | ${row.check} |`);
console.log(`\n${rows.length} records, $${total.toFixed(2)} in all.`);
