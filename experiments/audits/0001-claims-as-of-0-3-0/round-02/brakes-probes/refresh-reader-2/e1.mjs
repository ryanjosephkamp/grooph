// Outside the subgrooph: what a refresh does to the graph's own objects.
import { placed, newer, run, codes, canonicalize, agent, L, errCodes } from "./h2.mjs";
const renamed = () => newer((t) => {
  t.nodes.find((n) => n.id === "builder").id = "implementer";
  for (const e of t.edges) Object.assign(e, { from: e.from === "builder" ? "implementer" : e.from, to: e.to === "builder" ? "implementer" : e.to });
  t.edges.find((e) => e.id === "e-builder-critic").id = "e-implementer-critic";
  t.loops[0].members = ["implementer", "critic", "merge-gate"];
});
const diff = (a, b, skip = (id) => id.startsWith("review") || id.includes("review-")) => {
  const out = [];
  for (const key of ["nodes", "edges", "loops", "policies", "groups"]) {
    const A = new Map((a[key] ?? []).map((o) => [o.id, JSON.stringify(o)])), B = new Map((b[key] ?? []).map((o) => [o.id, JSON.stringify(o)]));
    for (const [id, s] of A) if (!skip(id) && B.get(id) !== s) out.push(`${key}:${id} ${B.has(id) ? "changed" : "removed"}`);
    for (const id of B.keys()) if (!skip(id) && !A.has(id)) out.push(`${key}:${id} added`);
  }
  for (const key of ["layout", "notes", "goal", "name", "version", "description", "target", "adaptation", "constraints", "lineage"]) if (JSON.stringify(a[key]) !== JSON.stringify(b[key])) out.push(`${key} changed`);
  return out;
};

// The graph has objects of its own that name the template's builder: a loop with a cap whose stop leads to it, a bar keyed from it, a policy scoped to it, a layout entry, a plain group.
const before = placed();
before.nodes.push({ id: "recheck", kind: "check", name: "Recheck", check: { kind: "command", run: "pnpm test", pass: "exit 0" } });
before.edges.push({ id: "e-release-recheck", from: "release", to: "recheck" }, { id: "e-recheck-release", from: "recheck", to: "release", when: "fail" });
before.loops.push({ id: "redo", name: "Redo", members: ["release", "recheck"], back: ["e-recheck-release"], mode: "judgment", bar: { name: "Bar", inspects: [{ kind: "answer-key", ref: "CHANGES.md" }], acceptance: "ok", answerKeyFrom: "review-builder" }, stops: [{ kind: "max-iterations", n: 2 }, { kind: "evidence-invalid", rounds: 1, then: "review-builder" }] });
before.policies.push({ id: "p-own", kind: "owner-per-artifact", scope: "node:review-builder" });
before.layout = { "review-builder": { x: 1, y: 2 }, plan: { x: 0, y: 0 } };
before.groups.push({ id: "mine", name: "Mine", members: ["plan"] });
console.log("before errors:", errCodes(before));
const r = run("the builder is renamed; the graph's own loop stop, bar key, policy and layout name it", before, renamed());
console.log("graph's own objects that differ:", diff(before, r.doc));
console.log("redo:", JSON.stringify(L(r.doc, "redo")).slice(0, 400));
console.log("policy p-own:", JSON.stringify(r.doc.policies.find((p) => p.id === "p-own")), "| layout:", JSON.stringify(r.doc.layout));
console.log("after issues:", codes(r.doc));

// A host loop that loses its only back edge: does the written graph still parse / validate?
const b2 = placed();
b2.nodes.push({ id: "recheck", kind: "check", name: "Recheck", check: { kind: "command", run: "pnpm test", pass: "exit 0" } });
b2.edges.push({ id: "e-release-recheck", from: "release", to: "recheck" }, { id: "e-recheck-review-builder", from: "recheck", to: "review-builder", when: "fail" });
b2.loops.push({ id: "redo", name: "Redo", members: ["review-builder", "review-critic", "review-merge-gate", "release", "recheck"], back: ["e-recheck-review-builder"], stops: [{ kind: "max-iterations", n: 2 }] });
console.log("\nbefore errors:", errCodes(b2));
const r2 = run("the test's own case: a host loop loses its only back edge", b2, renamed());
console.log("redo:", JSON.stringify(L(r2.doc, "redo")), "| after issues:", codes(r2.doc));
