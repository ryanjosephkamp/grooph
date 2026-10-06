// The same holes as a newer version of the built-in grind-loop, placed as a subgrooph and refreshed.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { R, core, errorsOf } from "../adopt-reader-1/lib.mjs";
const tpl = () => core.parseGraphText(readFileSync(join(R, "patterns/grind-loop.grooph.json"), "utf8")).doc;
const host = () => ({ grooph: 0, id: "host", name: "Host", version: 1, goal: "Plan, grind, release.", target: { harness: "claude-code" },
  nodes: [{ id: "plan", kind: "agent", name: "Plan", role: "planner", brief: "Plan.", outputs: ["PLAN.md"], allow: ["read-files", "write-outputs"] }, { id: "release", kind: "agent", name: "Release", role: "builder", brief: "Release.", outputs: ["REL.md"], allow: ["read-files", "write-outputs"] }, { id: "end", kind: "stop", name: "End", outcome: "success" }],
  edges: [{ id: "e-release-end", from: "release", to: "end" }], loops: [] });
const values = { task: "Add slugify.", "test-command": "pnpm test" };
const placed = core.placeSubgrooph(host(), tpl(), { as: "g", values, after: "plan", then: "release" });
const before = core.parseGraphText(core.canonicalize(placed.doc)).doc;
console.log("placed valid:", errorsOf(before).length === 0, "| nodes:", before.nodes.map((n) => n.id).join(","), "| edges:", before.edges.map((e) => `${e.id}:${e.from}->${e.to}${e.when ? "(" + JSON.stringify(e.when) + ")" : ""}`).join(" "));
const cases = {
  "control: {{test-command}} || true in the template": (t) => { t.nodes.find((n) => n.id === "tests").check.run = "{{test-command}} || true"; },
  "A: pass edge becomes fail -> NEW success stop; pass by a new edge with approval": (t) => { t.nodes.push({ id: "zz-done", kind: "stop", name: "Done too", outcome: "success" }); Object.assign(t.edges.find((e) => e.id === "e-tests-pass"), { when: "fail", to: "zz-done" }); t.edges.push({ id: "zz-pass", from: "tests", to: "done", when: "pass", approval: true }); },
  "A3: tests -fail(approval)-> NEW success stop": (t) => { t.nodes.push({ id: "zz-done", kind: "stop", name: "Done too", outcome: "success" }); t.edges.push({ id: "zz-fail", from: "tests", to: "zz-done", when: "fail", approval: true }); },
  "B: a bar of the builder's word and bar-passed then done": (t) => { const l = t.loops[0]; l.bar = { name: "Builder says so", inspects: [{ kind: "file", ref: "CHANGES.md" }], acceptance: "CHANGES.md says the change is made." }; l.stops.unshift({ kind: "bar-passed", then: "done" }); },
};
for (const [name, change] of Object.entries(cases)) {
  const t = tpl(); change(t); t.version = 2;
  let r; try { r = core.refreshSubgrooph(before, "g", t); } catch (e) { console.log(`\n## ${name}\n  THROWS ${e.message.slice(0, 300)}`); continue; }
  const held = (r.refused ?? r.held ?? r.changes.filter((c) => c.held || c.refused || c.applied === false));
  console.log(`\n## ${name}\n  keys: ${Object.keys(r).join(",")}\n  changes: ${r.changes.map((c) => `${c.name}${c.applied === false ? "[held]" : ""}`).join(", ")}`);
  console.log(`  held: ${JSON.stringify(held).slice(0, 600)}`);
  const doc = core.parseGraphText(core.canonicalize(r.doc)).doc;
  console.log(`  result valid: ${errorsOf(doc).length === 0}; edges from g-tests: ${doc.edges.filter((e) => e.from === "g-tests").map((e) => `${e.id}:${JSON.stringify(e.when)}->${e.to}${e.approval ? " APPROVAL" : ""}`).join("  ")}; stops: ${JSON.stringify(doc.loops[0].stops)}; bar: ${doc.loops[0].bar?.acceptance ?? "-"}; check: ${doc.nodes.find((n) => n.id === "g-tests").check.run}`);
}
// The group's own value changed in the graph, then refreshed from the SAME template.
const w = structuredClone(before); const g = w.groups.find((x) => x.id === "g"); console.log("\ngroup:", JSON.stringify(g).slice(0, 300));
if (g.with) { g.with["test-command"] = "true"; const a = core.checkAdoption(before, core.adoptWorkingCopy(before, w, { run: "r" }).doc); console.log("adopt group.with changed: refused", a.refused.map((c) => c.name), "changes", a.changes.map((c) => c.name));
  const r = core.refreshSubgrooph(w, "g", tpl()); console.log("then refresh from the same template: changes", r.changes.map((c) => `${c.name}${c.applied === false ? "[held]" : ""}`).join(", "), "| refused:", JSON.stringify(r.refused ?? r.held ?? "").slice(0, 400), "| check now:", r.doc.nodes.find((n) => n.id === "g-tests").check.run); }
