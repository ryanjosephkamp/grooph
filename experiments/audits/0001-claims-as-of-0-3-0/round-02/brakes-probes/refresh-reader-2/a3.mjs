// H2': less evidence, validator-clean. H3: a cap's target stops halting. H4: the cycle moved out from under its cap.
import { placed, newer, run, L, N, tpl, agent, codes, pattern, examples, placeSubgrooph, host } from "./h2.mjs";

const a = run("H2': edge into the critic re-added under another id with one token piece of evidence", placed(), newer((t) => {
  const e = t.edges.find((x) => x.id === "e-builder-critic"); e.id = "to-critic"; e.evidence = ["CHANGES.md"];
}));
console.log("  ->", JSON.stringify(a.doc.edges.find((e) => e.to === "review-critic")), "| issues:", codes(a.doc));

// H3, in two versions. v2: the cap and the budget lead to a stop that halts (the tested, allowed case).
const v2 = newer((t) => {
  t.nodes.push({ id: "halted", kind: "stop", name: "Halted", outcome: "halt" });
  t.loops[0].stops[1] = { kind: "max-iterations", n: 4, then: "halted" };
  t.loops[0].stops[2] = { kind: "budget", measure: "dispatches", limit: 10, then: "halted" };
}, 2);
const s2 = run("H3 step 1 (v2): cap and budget lead to a halting stop", placed(), v2);
// v3: that stop becomes an agent that hands the work back to the builder.
const v3 = newer((t) => {
  const i = t.nodes.findIndex((n) => n.id === "halted");
  t.nodes[i] = agent("halted", "builder", "RETRY.md", { name: "Try again" });
  t.edges.push({ id: "e-halted-builder", from: "halted", to: "builder" });
}, 3, v2);
const s3 = run("H3 step 2 (v3): the halting stop becomes an agent that leads back to the builder", s2.doc, v3);
console.log("  stops:", JSON.stringify(L(s3.doc, "review-review").stops), "\n  review-halted is now:", N(s3.doc, "review-halted").kind, "| out:", s3.doc.edges.filter((e) => e.from === "review-halted").map((e) => e.to), "| issues:", codes(s3.doc));
// v3b: milder: the halting stop's outcome becomes success
const v3b = newer((t) => { t.nodes.find((n) => n.id === "halted").outcome = "success"; }, 3, v2);
const s3b = run("H3 step 2' (v3'): the halting stop's outcome becomes success", s2.doc, v3b);
console.log("  review-halted:", JSON.stringify(N(s3b.doc, "review-halted")), "| issues:", codes(s3b.doc));

// Same on a built-in that already leads its cap on: debate-then-build (debate: max-iterations -> judge)
const d = pattern("debate-then-build");
console.log("\ndebate-then-build loops:", JSON.stringify(d.loops.map((l) => ({ id: l.id, members: l.members, stops: l.stops }))));
const r = pattern("retrospective-rewrite");
console.log("retrospective-rewrite loops:", JSON.stringify(r.loops.map((l) => ({ id: l.id, members: l.members, stops: l.stops }))), "nodes:", r.nodes.map((n) => `${n.id}:${n.kind}`));
