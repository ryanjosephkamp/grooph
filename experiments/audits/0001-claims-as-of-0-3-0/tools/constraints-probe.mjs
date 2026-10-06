// Audit 0001, round two, part E: three things a working copy can raise that the comparison of brakes does not look at:
// the graph's own constraints.budget line, an edge's retry, and an edge's concurrency. Reported by another lane's
// reader; this is the audit's own run. Pure: fills the built-in review-gate in memory and asks core's checkAdoption.
//   cd <repository root, packages built> && node <this file>
import fs from "node:fs"; import path from "node:path"; import { pathToFileURL } from "node:url";
const root = process.cwd();
const core = await import(pathToFileURL(path.join(root, "packages/core/dist/src/index.js")).href);
const t = JSON.parse(fs.readFileSync(path.join(root, "patterns/review-gate.grooph.json"), "utf8"));
const m = core.instantiate(t, { name: "Probe", values: Object.fromEntries(t.template.slots.map((s) => [s.key, s.example])) });
const source = m.doc ?? m.graph ?? m;
source.constraints = { budget: "about 40 lead turns" };
source.edges.find((e) => e.id === "e-builder-critic").retry = { max: 1 };
source.edges.find((e) => e.id === "e-builder-critic").concurrency = { max: 1 };
const errors = (doc) => { const v = core.validate(doc, { forExport: true }); return (Array.isArray(v) ? v : v.issues ?? []).filter((i) => String(i.code).startsWith("E_")).map((i) => i.code); };
console.log("the source: review-gate, with constraints.budget \"about 40 lead turns\", and retry 1 and concurrency 1 on e-builder-critic. validator errors:", errors(source).join(", ") || "none");
const edge = (d) => d.edges.find((e) => e.id === "e-builder-critic");
const cases = {
  "the graph's own budget line raised: \"about 40 lead turns\" to \"about 4000 lead turns\"": (d) => { d.constraints.budget = "about 4000 lead turns"; },
  "an edge's retry raised from 1 to 50": (d) => { edge(d).retry = { max: 50 }; },
  "an edge's concurrency raised from 1 to 50": (d) => { edge(d).concurrency = { max: 50 }; },
  "for comparison, the loop's budget stop raised from 10 to 4000 dispatches": (d) => { for (const s of d.loops[0].stops) if (s.kind === "budget") s.limit = 4000; },
};
for (const [name, change] of Object.entries(cases)) {
  const adopted = structuredClone(source); change(adopted);
  const c = core.checkAdoption(source, adopted);
  console.log(`\n== ${name}\n   validator errors: ${errors(adopted).join(", ") || "none"}\n   changes: ${c.changes.map((x) => x.name + (x.loosens ? `  [loosens: ${x.loosens}]` : "")).join(" | ") || "none"}\n   refused: ${c.refused.map((x) => x.name).join(", ") || "nothing"}`);
}
