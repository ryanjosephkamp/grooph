// By hand: stops that lead on, set against the ones that halt. node R/probe/hand/h6-leads-on.mjs
import { load, attempt, show, N, E, L, agent, clone, core } from "../lib.mjs";
import { roundsLoosened } from "../fuzz/oracle.mjs";
const base = load("fixtures/valid/subgrooph-in-a-graph.grooph.json");
const loop = (d) => L(d, "review-review");
const go = (title, src, change) => { const r = attempt(src, change); show(title, r); if (r.valid) console.log("  my oracle (worst-case dispatches):", JSON.stringify(roundsLoosened(src, r.doc))); };

go("T1 a second cap of the SAME n (4) that leads on to the builder, placed before the cap that halts", base, (w) => { loop(w).stops.splice(1, 0, { kind: "max-iterations", n: 4, then: "review-builder" }); });
go("T2 the same, placed after it (the halting one comes first in document order)", base, (w) => { loop(w).stops.splice(2, 0, { kind: "max-iterations", n: 4, then: "review-builder" }); });
go("T3 a second cap of n 3 that leads on (lower: the comparison says it holds this)", base, (w) => { loop(w).stops.splice(1, 0, { kind: "max-iterations", n: 3, then: "review-builder" }); });
go("T4 a second dispatch budget of the same limit (10) that leads on, before the one that halts", base, (w) => { loop(w).stops.splice(1, 0, { kind: "budget", measure: "dispatches", limit: 10, then: "review-builder" }); });
go("T5 a human stop added FIRST that leads on to the builder (a person asked each round, then on: before the cap)", base, (w) => { loop(w).stops.splice(1, 0, { kind: "human", every: 1, then: "review-builder" }); });
go("T6 evidence-invalid rounds 1 then builder, first", base, (w) => { loop(w).stops.splice(1, 0, { kind: "evidence-invalid", rounds: 1, then: "review-builder" }); });
go("T7 bar-passed given then: review-builder (when the bar passes, go round again?)", base, (w) => { loop(w).stops[0].then = "review-builder"; });
go("T8 budget minutes 0 that leads on to plan (outside the loop, upstream)", base, (w) => { loop(w).stops.splice(1, 0, { kind: "budget", measure: "minutes", limit: 0, then: "plan" }); });
go("T9 budget minutes 0 that leads on to a NEW step which leads back to the builder", base, (w) => { w.nodes.push(agent("regroup", "tester")); w.edges.push({ id: "e-regroup-builder", from: "regroup", to: "review-builder" }); loop(w).stops.splice(1, 0, { kind: "budget", measure: "minutes", limit: 0, then: "regroup" }); });
