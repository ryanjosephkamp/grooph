// Audit 0001, round two, part E: three cases beside new-stop-probe.mjs, to say exactly what is and is not held.
// (a) a critic's failing edge led to an existing success stop that the run ALSO reaches without the critic;
// (b) a gate's "no" led to an existing success stop reached before only by its "yes", and to a new one; and the
// halting stop its "no" leads to, made a success. In each graph the halting stop keeps a second way in, so that
// nothing is held merely because a stop was left with no way in. Pure; writes nothing, calls no model.
//   cd <repository root, packages built> && node <this file>
import path from "node:path"; import { pathToFileURL } from "node:url";
const core = await import(pathToFileURL(path.join(process.cwd(), "packages/core/dist/src/index.js")).href);
const agent = (id, role, extra = {}) => ({ id, kind: "agent", name: id, role, brief: "Do the work.", outputs: ["its output"], allow: ["read-files", "write-outputs"], ...extra });
const errors = (doc) => { const v = core.validate(doc, { forExport: true }); return (Array.isArray(v) ? v : v.issues ?? []).filter((i) => String(i.code).startsWith("E_")).map((i) => i.code); };
const report = (name, source, change) => { const adopted = structuredClone(source); change(adopted); const c = core.checkAdoption(source, adopted);
  console.log(`\n== ${name}\n   validator errors: ${errors(adopted).join(", ") || "none"}\n   changes: ${c.changes.map((x) => x.name + (x.loosens ? `  [loosens: ${x.loosens}]` : "")).join(" | ")}\n   refused: ${c.refused.map((x) => x.name).join(", ") || "nothing"}`); };
const base = { grooph: 0, version: 1, goal: "Make the change.", target: { harness: "claude-code" }, loops: [] };
// (a) done is reached two ways: by the critic's pass, and by a second branch that does not pass the critic
const a = { ...base, id: "reached-anyway", name: "Reached anyway",
  nodes: [agent("builder", "builder", { allow: ["read-files", "edit-files"] }), { id: "tests", kind: "check", name: "Tests", check: { kind: "tests", run: "npm test", pass: "exit code 0" } }, agent("critic", "critic", { deny: ["edit-files"] }), agent("notes", "researcher"), { id: "done", kind: "stop", name: "Done", outcome: "success" }, { id: "failed", kind: "stop", name: "Failed", outcome: "halt" }],
  edges: [{ id: "e-builder-tests", from: "builder", to: "tests" }, { id: "e-tests-pass", from: "tests", to: "critic", when: "pass", evidence: ["diff of the change"] }, { id: "e-tests-fail", from: "tests", to: "failed", when: "fail" }, { id: "e-builder-notes", from: "builder", to: "notes" }, { id: "e-notes-done", from: "notes", to: "done" }, { id: "e-critic-pass", from: "critic", to: "done", when: "pass" }, { id: "e-critic-fail", from: "critic", to: "failed", when: "fail" }] };
console.log("(a) source errors:", errors(a).join(", ") || "none");
report("(a) the critic's failing edge led to the success stop, which the run also reaches without the critic", a, (d) => { d.edges.find((e) => e.id === "e-critic-fail").to = "done"; });
// (b) a human gate: yes -> done, no -> failed (halt)
const b = { ...base, id: "gate-answers", name: "Gate answers",
  nodes: [agent("builder", "builder", { allow: ["read-files", "edit-files"] }), { id: "tests", kind: "check", name: "Tests", check: { kind: "tests", run: "npm test", pass: "exit code 0" } }, { id: "gate", kind: "human-gate", name: "Approve?", prompt: "Ship it?", options: ["approve", "reject"] }, { id: "done", kind: "stop", name: "Done", outcome: "success" }, { id: "failed", kind: "stop", name: "Failed", outcome: "halt" }],
  edges: [{ id: "e-builder-tests", from: "builder", to: "tests" }, { id: "e-tests-pass", from: "tests", to: "gate", when: "pass" }, { id: "e-tests-fail", from: "tests", to: "failed", when: "fail" }, { id: "e-gate-yes", from: "gate", to: "done", when: "pass" }, { id: "e-gate-no", from: "gate", to: "failed", when: "fail" }] };
console.log("\n(b) source errors:", errors(b).join(", ") || "none");
report("(b1) the gate's \"no\" led to the success stop the graph had, reached before only by its \"yes\"", b, (d) => { d.edges.find((e) => e.id === "e-gate-no").to = "done"; });
report("(b2) the gate's \"no\" led to a NEW stop that ends in success", b, (d) => { d.nodes.push({ id: "shipped", kind: "stop", name: "Shipped", outcome: "success" }); d.edges.find((e) => e.id === "e-gate-no").to = "shipped"; });
report("(b3) the halting stop the gate's \"no\" leads to, made a success", b, (d) => { d.nodes.find((n) => n.id === "failed").outcome = "success"; });
