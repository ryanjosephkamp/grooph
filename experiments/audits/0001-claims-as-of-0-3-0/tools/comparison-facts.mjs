// Audit 0001, claims C13 to C17: per run of study one, its cost, time, invocations, subagents and turns;
// then the ledger's total. Reads experiments/comparisons. Calls no model, writes nothing.
//
//   cd <repository or snapshot root> && node <this file>
import { readFileSync, readdirSync } from "node:fs";

const base = "experiments/comparisons";
const projects = ["grind-loop", "red-team-loop", "review-gate", "spec-then-loop"];
let runs = 0, promptRuns = 0, promptRunsWithSubagents = 0, oneIterationC = 0, cRuns = 0, runCost = 0;
for (const project of projects) {
  const turns = { A: [], B: [], C: [] };
  for (const run of readdirSync(`${base}/${project}`).filter((d) => /^[ABC]-\d$/.test(d)).sort()) {
    runs++;
    const result = JSON.parse(readFileSync(`${base}/${project}/${run}/result.json`, "utf8"));
    const digest = JSON.parse(readFileSync(`${base}/${project}/${run}/transcript-digest.json`, "utf8"));
    const leads = digest.filter((s) => s.who === "lead");
    const subagents = digest.filter((s) => s.who !== "lead");
    const dispatches = leads.flatMap((l) => (l.tool_uses ?? []).filter((t) => t.tool === "Agent" || t.tool === "Task"));
    runCost += result.cost_usd;
    turns[result.arm].push(result.harness_turns);
    if (result.arm !== "A") { promptRuns++; if (dispatches.length > 0 && subagents.length > 0) promptRunsWithSubagents++; }
    if (result.arm === "C") { cRuns++; if (leads.length === 1) oneIterationC++; }
    console.log(`${project.padEnd(15)} ${run}  $${result.cost_usd.toFixed(2).padStart(5)}  ${String(result.duration_s).padStart(5)} s  invocations ${(result.invocations ?? []).length}  lead sessions ${leads.length}  subagent sessions ${subagents.length}  dispatches ${dispatches.length}  turns ${result.harness_turns}  | ${dispatches.map((t) => (t.description ?? "").slice(0, 26)).join(" ; ")}`);
  }
  const range = (a) => `${Math.min(...a)} to ${Math.max(...a)}`;
  console.log(`  harness turns: A ${range(turns.A)} · B ${range(turns.B)} · C ${range(turns.C)}\n`);
}
const ledger = JSON.parse(readFileSync(`${base}/ledger.json`, "utf8"));
const spent = ledger.invocations.reduce((sum, i) => sum + (i.cost_usd ?? 0), 0);
console.log(`${runs} runs, $${runCost.toFixed(2)} without judges. Ledger: ${ledger.invocations.length} invocations, $${spent.toFixed(2)}.`);
console.log(`Prompt-arm runs (B and C): ${promptRuns}; of those that dispatched at least one subagent: ${promptRunsWithSubagents}.`);
console.log(`Arm C runs: ${cRuns}; of those with one lead session, that is one iteration of the loop: ${oneIterationC}.`);
