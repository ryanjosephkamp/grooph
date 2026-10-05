// Audit 0001, round two, part E: does the comparison of brakes see a change to a check that judges a loop?
// Pure: reads one built-in template, changes a copy in memory, asks core's checkAdoption. Writes nothing, calls no model.
//   cd <repository root, packages built> && node <this file>
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
const root = process.cwd();
const core = await import(pathToFileURL(path.join(root, "packages/core/dist/src/index.js")).href);
const source = JSON.parse(fs.readFileSync(path.join(root, "patterns/grind-loop.grooph.json"), "utf8"));
const show = (doc) => ({
  check: doc.nodes.filter((n) => n.kind === "check").map((n) => `${n.id}: run ${JSON.stringify(n.check.run)}, pass ${JSON.stringify(n.check.pass)}`),
  edges: doc.edges.filter((e) => doc.nodes.find((n) => n.id === e.from)?.kind === "check").map((e) => `${e.id}: ${e.from} -> ${e.to} when ${typeof e.when === "object" ? e.when.verdict : e.when}`),
  loop: doc.loops.map((l) => `${l.id}: members ${l.members.join(",")}; back ${l.back.join(",")}; stops ${JSON.stringify(l.stops)}`),
});
console.log("the template as it is:", JSON.stringify(show(source), null, 1));
const cases = {
  "the check's command replaced by one that always passes": (doc) => { for (const n of doc.nodes) if (n.kind === "check") n.check = { ...n.check, run: "true", pass: "exit code 0" }; },
  "the check's two verdicts swapped: fail leads on, pass leads back": (doc) => {
    for (const e of doc.edges) { if (doc.nodes.find((n) => n.id === e.from)?.kind !== "check") continue; e.when = e.when === "pass" ? "fail" : e.when === "fail" ? "pass" : e.when; }
  },
  "for comparison, the round cap raised": (doc) => { for (const l of doc.loops) for (const s of l.stops) if (s.kind === "max-iterations") s.n = s.n * 10; },
};
for (const [name, change] of Object.entries(cases)) {
  const adopted = structuredClone(source); change(adopted);
  const issues = core.validate(adopted);
  const list = Array.isArray(issues) ? issues : (issues.issues ?? issues.errors ?? []);
  const errors = list.filter((i) => (i.severity ?? (String(i.code).startsWith("E_") ? "error" : "warning")) === "error").map((i) => i.code);
  const check = core.checkAdoption(source, adopted);
  console.log(`\n== ${name}`);
  console.log("   validator errors:", errors.length ? errors.join(", ") : "none");
  console.log("   changes:", check.changes.map((c) => c.name + (c.loosens ? `  [loosens: ${c.loosens}]` : "") + (c.tightens ? `  [tightens: ${c.tightens}]` : "")).join(" | ") || "none");
  console.log("   refused:", check.refused.length ? check.refused.map((c) => c.name).join(", ") : "nothing");
  console.log("   notices:", check.notices.length ? check.notices.join(" / ") : "none");
}
