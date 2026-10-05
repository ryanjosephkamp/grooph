// Audit 0001, claims C1 and C3: which stops have fired, and which gates halted, in every package run on record.
// Reads every notes.jsonl under experiments/patterns and experiments/comparisons. Calls no model, writes nothing.
//
//   cd <repository or snapshot root> && node <this file>
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

function find(dir, name, out = []) {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) find(path, name, out);
    else if (entry === name) out.push(path);
  }
  return out;
}

const files = [...find("experiments/patterns", "notes.jsonl"), ...find("experiments/comparisons", "notes.jsonl")].sort();
const tally = {};
let gateHalts = 0;
for (const file of files) {
  const stops = [], halts = [], rounds = [];
  for (const line of readFileSync(file, "utf8").split("\n").filter(Boolean)) {
    let note;
    try { note = JSON.parse(line); } catch { continue; }
    if (note.stop) { stops.push(`${note.at} ${note.stop}`); tally[note.stop] = (tally[note.stop] ?? 0) + 1; }
    if (note.outcome === "halt") { halts.push(note.at); if (String(note.at).startsWith("node:")) gateHalts++; }
    if (typeof note.round === "number") rounds.push(note.round);
  }
  const record = file.replace(/\/runs\/.*$/, "").replace("experiments/", "");
  console.log(`${record.padEnd(40)} last round ${rounds.length ? Math.max(...rounds) : "-"} | stops fired: ${stops.join("; ") || "none named in a stop field"} | halts: ${halts.join(", ") || "none"}`);
}
console.log(`\n${files.length} run records. Stops named in a note's stop field, by kind: ${JSON.stringify(tally)}. Halts at a node: ${gateHalts}.`);
console.log("Kinds a loop may carry (docs/graph-ir.md, the Stop type): human, budget, bar-passed, diminishing-returns, evidence-invalid, max-iterations.");
