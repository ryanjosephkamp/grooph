// Audit 0001, round two, part A: does the validator refuse a step marked irreversible that a run starts at?
// The corrected public sentence is "it refuses a step marked irreversible with no human gate before it".
// Pure: fills the built-in review-gate template in memory, marks its builder irreversible, and asks core's
// validate three ways. Writes nothing, calls no model.
//   cd <repository root, packages built> && node <this file>
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
const root = process.cwd();
const core = await import(pathToFileURL(path.join(root, "packages/core/dist/src/index.js")).href);
const template = JSON.parse(fs.readFileSync(path.join(root, "patterns/review-gate.grooph.json"), "utf8"));
const made = core.instantiate(template, { name: "Probe", values: { task: "a small change", "test-command": "npm test", checklist: "docs/REVIEW-CHECKLIST.md" } });
const graph = made.doc ?? made.graph ?? made;
const errors = (doc) => { const v = core.validate(doc); const list = Array.isArray(v) ? v : (v.issues ?? []); return list.filter((i) => String(i.code).startsWith("E_")).map((i) => `${i.code}: ${i.message}`); };
const builder = (doc) => doc.nodes.find((n) => n.id === "builder");
const edge = (doc, id) => doc.edges.find((e) => e.id === id);
console.log("the graph: builder -> critic -> merge-gate -> done; back edges into builder:", graph.loops[0].back.join(", "));
console.log("edges into builder:", graph.edges.filter((e) => e.to === "builder").map((e) => `${e.id} (from ${e.from}, kind: ${graph.nodes.find((n) => n.id === e.from).kind})`).join("; "));
console.log("entry nodes by graph-ir section 2 (no inbound edge that is not a loop's back edge):", graph.nodes.filter((n) => !graph.edges.some((e) => e.to === n.id && !graph.loops.some((l) => l.back.includes(e.id)))).map((n) => n.id).join(", "));
const cases = {
  "as the template gives it": () => {},
  "builder marked irreversible (merge)": (d) => { builder(d).irreversible = ["merge"]; },
  "builder marked irreversible, and approval: true on e-critic-fail, so every edge into it passes a person": (d) => { builder(d).irreversible = ["merge"]; edge(d, "e-critic-fail").approval = true; },
};
for (const [name, change] of Object.entries(cases)) {
  const doc = structuredClone(graph); change(doc);
  const found = errors(doc);
  console.log(`\n== ${name}\n   errors: ${found.length ? found.join(" | ") : "none"}`);
}
console.log("\nIn the last case the run still starts at the builder, with nobody asked, and no error is raised.");
