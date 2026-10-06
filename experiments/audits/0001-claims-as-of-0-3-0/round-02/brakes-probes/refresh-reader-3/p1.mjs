import { run, placed, newer, N, E, L, agent, errCodes } from "../refresh-reader-2/h2.mjs";
import { brakesLost } from "../../../../../../packages/core/dist/src/brakes.js";
const before = placed();
console.log("placed edges:", before.edges.map((e) => `${e.id}: ${e.from}->${e.to} ${JSON.stringify(e.when ?? "")}`));
console.log("placed loops:", JSON.stringify(before.loops.map((l) => ({ id: l.id, members: l.members, back: l.back, stops: l.stops }))));
console.log("placed policies:", JSON.stringify(before.policies), "errors:", errCodes(before));
const after = (title, change, opts) => {
  const r = run(title, before, newer(change), opts);
  if (r) console.log("brakesLost(before, result):", brakesLost(before, r.doc).map((l) => l.why));
  return r;
};
// P1: a second back edge between the same two nodes, counted only by a new, looser loop
let r = after("P1 parallel back edge critic->builder in a new loop capped at 100", (t) => {
  t.edges.push({ id: "e-critic-retry", from: "critic", to: "builder", when: { verdict: "needs-work" }, evidence: ["REVIEW.md"] });
  t.loops.push({ id: "retry", name: "Retry", members: ["builder", "critic"], back: ["e-critic-retry"], stops: [{ kind: "max-iterations", n: 100 }] });
});
if (r) console.log("loops after:", JSON.stringify(r.doc.loops.map((l) => ({ id: l.id, back: l.back, stops: l.stops }))));
// P2: a non-halting cap below the halting one
r = after("P2 adds max-iterations n=1 then builder beside n=4", (t) => { L(t, "review").stops.push({ kind: "max-iterations", n: 1, then: "builder" }); });
if (r) console.log("stops after:", JSON.stringify(r.doc.loops[0].stops));
r = after("P2b adds budget dispatches limit=1 then builder beside limit=10", (t) => { L(t, "review").stops.push({ kind: "budget", measure: "dispatches", limit: 1, then: "builder" }); });
if (r) console.log("stops after:", JSON.stringify(r.doc.loops[0].stops));
// P3: the critic's evidence moved off the builder's edge onto another edge into the critic
r = after("P3 evidence moved from builder->critic to a new gate->critic edge", (t) => {
  const e = E(t, "e-builder-critic");
  const moved = e.evidence.slice(0, 3);
  e.evidence = e.evidence.slice(3);
  t.edges.push({ id: "e-merge-gate-recheck", from: "merge-gate", to: "critic", when: { verdict: "recheck" }, evidence: moved });
  L(t, "review").back.push("e-merge-gate-recheck");
});
if (r) console.log("into critic after:", JSON.stringify(r.doc.edges.filter((e) => e.to === "review-critic").map((e) => ({ id: e.id, from: e.from, evidence: e.evidence }))));
