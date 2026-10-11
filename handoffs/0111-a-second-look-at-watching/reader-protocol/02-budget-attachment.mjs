// Reader of the protocol (slice 0111): is a session told of its dollar ceiling? Reads one first-check transcript in the clean profile (read only) and prints, for each attachment of type budget_usd, its field names and numeric values, and nothing a session read, wrote or said. node handoffs/0111-a-second-look-at-watching/reader-protocol/02-budget-attachment.mjs [run]
import { readFileSync, existsSync } from "node:fs";
import { homedir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
const repo = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const run = process.argv[2] ?? "sonnet/one/plain-1";
const r = JSON.parse(readFileSync(join(repo, "experiments/watching", run, "result.json"), "utf8"));
const file = r.transcript.replace(/^~/, homedir());
console.log(run, "ceiling", r.watchdog.usd, "reported cost", r.reported_cost_usd, "entries", JSON.stringify(r.measures.given.entries_of_what_it_was_given));
if (!existsSync(file)) { console.log("transcript not on this machine:", r.transcript); process.exit(0); }
const types = {};
for (const line of readFileSync(file, "utf8").split("\n")) {
  if (!line.trim()) continue;
  let rec; try { rec = JSON.parse(line); } catch { continue; }
  if (rec?.type !== "attachment" || !rec.attachment) continue;
  const a = rec.attachment;
  types[a.type] = (types[a.type] ?? 0) + 1;
  if (a.type === "budget_usd" || a.type === "total_tokens_reminder") console.log(a.type, JSON.stringify(Object.fromEntries(Object.entries(a).map(([k, v]) => [k, typeof v === "number" || typeof v === "boolean" ? v : typeof v === "string" ? `<string of ${v.length}>` : `<${typeof v}>`]))));
}
console.log("attachment types:", JSON.stringify(types));
// And how the harness says it rendered the first two of them (the line's own `rendered` and `renderedRole`): the harness's words about the budget, with any home path as ~.
{
  let shown = 0;
  for (const line of readFileSync(file, "utf8").split("\n")) {
    if (!line.trim()) continue;
    let rec; try { rec = JSON.parse(line); } catch { continue; }
    if (rec?.type !== "attachment" || rec.attachment?.type !== "budget_usd" || shown++ >= 2) continue;
    const rendered = typeof rec.rendered === "string" ? rec.rendered : JSON.stringify(rec.rendered ?? null);
    console.log("renderedRole:", JSON.stringify(rec.renderedRole ?? null), "| rendered:", rendered.replaceAll(homedir(), "~").slice(0, 400));
  }
}
