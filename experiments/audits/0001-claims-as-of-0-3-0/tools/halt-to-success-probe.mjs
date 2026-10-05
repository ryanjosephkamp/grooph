// Audit 0001, round two, part E: a stop that a check's failing verdict leads to, changed from a halt to success.
// Reported by the driver's reader of pull request #132; this is the audit's own run of it. Pure: builds a small graph
// in memory (builder -> tests; pass -> done; fail -> failed, a stop that halts), changes one field of one stop node in
// a copy, and asks core's validate and checkAdoption. Writes nothing, calls no model.
//   cd <repository root, packages built> && node <this file>
import path from "node:path";
import { pathToFileURL } from "node:url";
const core = await import(pathToFileURL(path.join(process.cwd(), "packages/core/dist/src/index.js")).href);
const source = {
  grooph: 0, id: "halt-probe", name: "Halt probe", version: 1, goal: "Make the tests pass.", target: { harness: "claude-code" },
  nodes: [
    { id: "builder", kind: "agent", name: "Builder", role: "builder", brief: "Do the task.", outputs: ["the change"], allow: ["read-files", "edit-files", "run-tests"] },
    { id: "tests", kind: "check", name: "Tests", check: { kind: "tests", run: "npm test", pass: "exit code 0" } },
    { id: "done", kind: "stop", name: "Done", outcome: "success" },
    { id: "failed", kind: "stop", name: "Failed", outcome: "halt" },
  ],
  edges: [
    { id: "e-builder-tests", from: "builder", to: "tests" },
    { id: "e-tests-pass", from: "tests", to: "done", when: "pass" },
    { id: "e-tests-fail", from: "tests", to: "failed", when: "fail" },
  ],
  loops: [],
};
const errors = (doc) => { const v = core.validate(doc, { forExport: true }); const list = Array.isArray(v) ? v : (v.issues ?? []); return list.filter((i) => String(i.code).startsWith("E_")).map((i) => i.code); };
console.log("the source: builder -> tests; pass -> done (success); fail -> failed (halt). validator errors:", errors(source).join(", ") || "none");
const cases = {
  "the stop that failing tests lead to, changed from a halt to success": (d) => { d.nodes.find((n) => n.id === "failed").outcome = "success"; },
  "for comparison, the failing edge re-pointed at the success stop": (d) => { d.edges.find((e) => e.id === "e-tests-fail").to = "done"; },
};
for (const [name, change] of Object.entries(cases)) {
  const adopted = structuredClone(source); change(adopted);
  const check = core.checkAdoption(source, adopted);
  console.log(`\n== ${name}\n   validator errors: ${errors(adopted).join(", ") || "none"}\n   changes: ${check.changes.map((c) => c.name + (c.loosens ? `  [loosens: ${c.loosens}]` : "") + (c.tightens ? "  [tightens]" : "")).join(" | ") || "none"}\n   refused: ${check.refused.map((c) => c.name).join(", ") || "nothing"}`);
}
