#!/usr/bin/env node
// Round three, finding F1 (Codex): a new stop where a person is asked is named and not refused, "the person is the
// brake on it". With a large "every" the person is asked on few passes or on none. This adds "ask a person every 100
// rounds" ahead of a round cap that halts, of 1 and then of 100, and prints what the comparison says of each and on
// which passes anybody would be asked (docs/graph-ir.md §2). No model is started.
//   node person-every-hundred-probe.mjs <repository root, built>
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
const root = resolve(process.argv[2] ?? ".");
const core = await import(join(root, "packages/core/dist/src/index.js"));
console.log(`grooph at ${spawnSync("git", ["-C", root, "rev-parse", "--short=12", "HEAD"], { encoding: "utf8" }).stdout.trim()}`);
const graph = (stops) => ({
  grooph: 0, id: "hundred", name: "Hundred", version: 1, goal: "Work through a list.", target: { harness: "claude-code" },
  nodes: [
    { id: "worker", kind: "agent", name: "Worker", role: "builder", brief: "Do the next item.", outputs: ["out.txt"], allow: ["read-files", "edit-files"] },
    { id: "sorter", kind: "agent", name: "Sorter", role: "planner", brief: "Say whether items remain.", outputs: ["LEFT.md"], allow: ["read-files", "write-outputs"] },
    { id: "done", kind: "stop", name: "Done", outcome: "success" },
  ],
  edges: [{ id: "e-w-s", from: "worker", to: "sorter" }, { id: "e-more", from: "sorter", to: "worker", when: { verdict: "more" } }, { id: "e-fin", from: "sorter", to: "done", when: { verdict: "finished" } }],
  loops: [{ id: "list", name: "List", members: ["worker", "sorter"], back: ["e-more"], mode: "grind", stops }],
});
let unexpected = 0;
for (const [cap, then] of [[1, undefined], [100, undefined], [1, "done"], [100, "done"]]) {
  const source = graph([{ kind: "max-iterations", n: cap }]);
  const copy = graph([{ kind: "human", every: 100, ...(then ? { then } : {}) }, { kind: "max-iterations", n: cap }]);
  const problems = core.validate(copy).filter((i) => i.severity === "error");
  if (problems.length > 0) { console.log(`cap ${cap}: the copy does not validate: ${problems.map((p) => p.code).join(", ")}`); unexpected++; continue; }
  const adopted = core.adoptWorkingCopy(source, copy, { run: "r1" });
  if (!adopted.ok) { console.log(`cap ${cap}: adoption refused for another reason: ${adopted.message}`); unexpected++; continue; }
  const check = core.checkAdoption(source, adopted.doc);
  console.log(`\nA round cap of ${cap} that halts; the copy puts "ask a person every 100 rounds" ahead of it, ${then ? `leading on to "${then}"` : "naming no place it leads"}.`);
  console.log(check.refused.length === 0 ? "  not refused" : `  REFUSED: ${check.refused.map((r) => `${r.name}: ${r.loosens}`).join(" | ")}`);
  for (const c of check.changes) console.log(`  listed as ${c.name}, ${c.tightens !== undefined ? `with the words for a tightening (undoing it: ${c.tightens})` : c.unjudged !== undefined ? `as not judged (undoing it: ${c.unjudged})` : c.loosens !== undefined ? `as a loosening (${c.loosens})` : "with no word"}`);
  for (const n of check.notices ?? []) console.log(`  notice: ${typeof n === "string" ? n : JSON.stringify(n)}`.slice(0, 400));
  const asked = cap >= 100 ? [100] : [];
  console.log(`  by §2 the cap halts the run at the end of pass ${cap}; a person asked every 100 is asked at the end of pass 100, 200, ...; so in this loop a person is asked ${asked.length === 0 ? "on no pass" : `first at the end of pass ${asked[0]}, where their stop stands ahead of the cap`}.`);
  if (check.refused.length > 0) unexpected++;
}
if (unexpected > 0) { console.log("\nNot what round three found: read the lines above."); process.exit(1); }
