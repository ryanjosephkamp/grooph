// Sanity of the oracle on cases with a known answer. node R/probe/fuzz/oracle-check.mjs
import { load, clone, E, L, agent } from "../lib.mjs";
import { worstDispatches, roundsLoosened, personLoosened } from "./oracle.mjs";
const base = load("fixtures/valid/subgrooph-in-a-graph.grooph.json");
const loop = (d) => L(d, "review-review");
console.log("source: builder", worstDispatches(base, "review-builder"), "critic", worstDispatches(base, "review-critic"));
const t = (name, f) => { const w = clone(base); f(w); console.log(name.padEnd(46), "rounds:", JSON.stringify(roundsLoosened(base, w)), "people:", personLoosened(base, w).join(" ")); };
t("nothing", () => {});
t("cap 4 -> 6 (budget 10 still binds?)", (w) => { loop(w).stops[1].n = 6; });
t("cap 4 -> 3", (w) => { loop(w).stops[1].n = 3; });
t("budget 10 -> 5", (w) => { loop(w).stops[2].limit = 5; });
t("cap removed", (w) => { loop(w).stops.splice(1, 1); });
t("cap and budget removed", (w) => { loop(w).stops.splice(1, 2); loop(w).stops.push({ kind: "diminishing-returns", rounds: 2 }); });
t("H1 outer loop critic->plan cap 1000", (w) => {
  w.edges.push({ id: "e-replan", from: "review-critic", to: "plan", when: { verdict: "replan" } });
  w.loops.push({ id: "replan", name: "Replan", members: ["plan", "review-builder", "review-critic", "review-merge-gate"], back: ["e-replan"], mode: "judgment", bar: clone(loop(w).bar), stops: [{ kind: "bar-passed" }, { kind: "max-iterations", n: 1000 }] });
});
t("H2 detour via fixer in loop 2", (w) => {
  w.nodes.push(agent("fixer"));
  w.edges.push({ id: "e-critic-fixer", from: "review-critic", to: "fixer", when: { verdict: "revise" } }, { id: "e-fixer-builder", from: "fixer", to: "review-builder" });
  w.loops.push({ id: "revise", name: "Revise", members: ["review-builder", "review-critic", "fixer"], back: ["e-fixer-builder"], mode: "judgment", bar: clone(loop(w).bar), stops: [{ kind: "bar-passed" }, { kind: "max-iterations", n: 1000 }] });
});
t("H5 budget tokens 0 then builder, before the cap", (w) => { loop(w).stops.splice(1, 0, { kind: "budget", measure: "tokens", limit: 0, then: "review-builder" }); });
t("H5' same, appended after the cap and budget", (w) => { loop(w).stops.push({ kind: "budget", measure: "tokens", limit: 0, then: "review-builder" }); });
t("edge plan->release (around the gate)", (w) => { w.edges.push({ id: "x", from: "plan", to: "release" }); });
t("honest: notes node after release", (w) => { w.nodes.push(agent("notes")); w.edges.push({ id: "x", from: "release", to: "notes" }); });
const a = clone(base); E(a, "review-e-critic-fail").approval = true;
const w = clone(a); w.edges.push({ id: "twin", from: "review-critic", to: "review-builder", when: "fail" }); loop(w).back.push("twin");
console.log("approval twin:".padEnd(46), "rounds:", JSON.stringify(roundsLoosened(a, w)), "people:", personLoosened(a, w).join(" "));
