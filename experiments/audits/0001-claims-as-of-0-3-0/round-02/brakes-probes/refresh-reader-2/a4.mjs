// H4: the builder-critic cycle moved out from under its cap and budget (and its bar), with the old loop left standing.
import { placed, newer, run, L, codes } from "./h2.mjs";
const before = placed();
const show = (doc) => doc.loops.map((l) => `${l.id}: members ${l.members} back ${l.back} mode ${l.mode ?? "-"} bar ${l.bar ? JSON.stringify(l.bar.acceptance).slice(0, 40) : "none"} stops ${JSON.stringify(l.stops)}`);
console.log("before:", show(before));

// (a) the old loop keeps its id, cap, budget and bar, but holds only the gate's outer round; a new loop with a
// cap of 50 and no budget takes the builder-critic cycle.
const a = run("(a) inner cycle moved to a new loop, cap 50; old loop keeps its stops over the gate's round only", before, newer((t) => {
  t.loops[0].members = ["builder", "critic", "merge-gate"]; // unchanged
  t.loops[0].back = ["e-merge-gate-reject"];
  t.loops.push({ id: "inner", name: "Inner", members: ["builder", "critic"], back: ["e-critic-fail"], mode: "judgment", bar: { name: "Looks fine", inspects: [{ kind: "artifact", ref: "REVIEW.md" }], acceptance: "The critic has no strong objection." }, stops: [{ kind: "bar-passed" }, { kind: "max-iterations", n: 50 }] });
}));
console.log("after:", show(a.doc), "\nissues:", codes(a.doc));

// (b) the whole cycle handed to a new loop; the old loop id kept on a trivial pair
const b = run("(b) both back edges handed to a new loop with cap 500 and a weaker bar; old loop kept on a new trivial cycle", placed(), newer((t) => {
  t.nodes.push({ id: "lint", kind: "check", name: "Lint", check: { kind: "command", run: "pnpm lint", pass: "exit 0" } });
  t.nodes.push({ id: "fmt", kind: "check", name: "Format", check: { kind: "command", run: "pnpm fmt", pass: "exit 0" } });
  t.edges.push({ id: "e-builder-lint", from: "builder", to: "lint" }, { id: "e-lint-fmt", from: "lint", to: "fmt" }, { id: "e-fmt-lint", from: "fmt", to: "lint", when: "fail" });
  t.loops[0].members = ["lint", "fmt"]; t.loops[0].back = ["e-fmt-lint"];
  t.loops.push({ id: "work", name: "Work", members: ["builder", "critic", "merge-gate"], back: ["e-critic-fail", "e-merge-gate-reject"], mode: "judgment", bar: { name: "Looks fine", inspects: [{ kind: "artifact", ref: "REVIEW.md" }], acceptance: "The critic has no strong objection." }, stops: [{ kind: "bar-passed" }, { kind: "max-iterations", n: 500 }, { kind: "budget", measure: "dispatches", limit: 5000 }] });
}));
console.log("after:", show(b.doc), "\nissues:", codes(b.doc));

// (c) control: the same loosening on the same loop id is held
run("(c) control: cap raised and bar changed on the same loop id", placed(), newer((t) => { t.loops[0].stops[1] = { kind: "max-iterations", n: 500 }; t.loops[0].bar.acceptance = "The critic has no strong objection."; }));
