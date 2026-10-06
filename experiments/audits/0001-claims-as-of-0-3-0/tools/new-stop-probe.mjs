// Audit 0001, round two, part E: a critic's verdict led to a stop that ends in success. Held when the stop was already
// in the graph; is it held when the stop is new? Reported by the house lane; this is the audit's own run. Pure: builds
// a small graph in memory and asks core's validate and checkAdoption. Writes nothing, calls no model.
//   cd <repository root, packages built> && node <this file>
import path from "node:path";
import { pathToFileURL } from "node:url";
const core = await import(pathToFileURL(path.join(process.cwd(), "packages/core/dist/src/index.js")).href);
const source = {
  grooph: 0, id: "new-stop-probe", name: "New stop probe", version: 1, goal: "Make the change and have it reviewed.", target: { harness: "claude-code" },
  nodes: [
    { id: "builder", kind: "agent", name: "Builder", role: "builder", brief: "Do the task.", outputs: ["the change"], allow: ["read-files", "edit-files", "run-tests"] },
    { id: "tests", kind: "check", name: "Tests", check: { kind: "tests", run: "npm test", pass: "exit code 0" } },
    { id: "critic", kind: "agent", name: "Critic", role: "critic", brief: "Judge the change against the checklist.", outputs: ["REVIEW.md"], allow: ["read-files", "write-outputs"], deny: ["edit-files"] },
    { id: "done", kind: "stop", name: "Done", outcome: "success" },
    { id: "failed", kind: "stop", name: "Failed", outcome: "halt" },
  ],
  edges: [
    { id: "e-builder-tests", from: "builder", to: "tests" },
    { id: "e-tests-pass", from: "tests", to: "critic", when: "pass", evidence: ["diff of the change", "docs/REVIEW-CHECKLIST.md"] },
    { id: "e-tests-fail", from: "tests", to: "failed", when: "fail" },
    { id: "e-critic-pass", from: "critic", to: "done", when: "pass" },
    { id: "e-critic-fail", from: "critic", to: "failed", when: "fail" },
  ],
  loops: [],
};
const errors = (doc) => { const v = core.validate(doc, { forExport: true }); const list = Array.isArray(v) ? v : (v.issues ?? []); return list.filter((i) => String(i.code).startsWith("E_")).map((i) => i.code); };
console.log("the source: builder -> tests; tests pass -> critic, fail -> failed (halt); critic pass -> done (success), fail -> failed. validator errors:", errors(source).join(", ") || "none");
const edge = (d, id) => d.edges.find((e) => e.id === id);
const shipped = { id: "shipped", kind: "stop", name: "Shipped", outcome: "success" };
const cases = {
  "the critic's failing edge led to the success stop the graph already has": (d) => { edge(d, "e-critic-fail").to = "done"; },
  "the critic's failing edge led to a NEW stop that ends in success (the stop it left keeps the tests' way in)": (d) => { d.nodes.push({ ...shipped }); edge(d, "e-critic-fail").to = "shipped"; },
  "an edge ADDED from the critic, on another verdict, to a NEW stop that ends in success": (d) => { d.nodes.push({ ...shipped }); d.edges.push({ id: "e-critic-minor", from: "critic", to: "shipped", when: { verdict: "minor" } }); },
};
for (const [name, change] of Object.entries(cases)) {
  const adopted = structuredClone(source); change(adopted);
  const check = core.checkAdoption(source, adopted);
  console.log(`\n== ${name}\n   validator errors: ${errors(adopted).join(", ") || "none"}\n   changes: ${check.changes.map((c) => c.name + (c.loosens ? `  [loosens: ${c.loosens}]` : "") + (c.tightens ? "  [tightens]" : "")).join(" | ") || "none"}\n   refused: ${check.refused.map((c) => c.name).join(", ") || "nothing"}`);
}
