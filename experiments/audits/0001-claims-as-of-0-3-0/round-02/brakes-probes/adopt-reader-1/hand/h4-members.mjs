// By hand: the loop's members and what the dispatch budget counts; a forward edge called a back edge. node R/probe/hand/h4-members.mjs
import { load, attempt, show, N, E, L, agent, clone, core } from "../lib.mjs";
import { roundsLoosened, worstDispatches } from "../fuzz/oracle.mjs";
const base = load("fixtures/valid/subgrooph-in-a-graph.grooph.json");
const loop = (d) => L(d, "review-review");

// A source whose round has three dispatched steps and a dispatch budget that binds before the cap:
// builder -> tests(check) -> critic; cap 6, budget 9 dispatches = 3 rounds.
const src = clone(base);
src.nodes.push({ id: "review-tests", kind: "check", name: "Tests", check: { kind: "tests", run: "pnpm test", pass: "exit 0" } });
E(src, "e-review-builder-review-critic").from = "review-tests";
src.edges.push({ id: "e-builder-tests", from: "review-builder", to: "review-tests" });
loop(src).members = ["review-builder", "review-tests", "review-critic", "review-merge-gate"];
loop(src).stops = [{ kind: "bar-passed" }, { kind: "max-iterations", n: 6 }, { kind: "budget", measure: "dispatches", limit: 9 }];
src.groups[0].members.push("review-tests");
console.log("source valid:", core.validate(src, { forExport: true }).filter((i) => i.severity === "error").length === 0, "worst builder dispatches:", worstDispatches(src, "review-builder"));

const r1 = attempt(src, (w) => {
  // the tests step taken out of the loop's members; a never-taken edge keeps "a path inside the members"
  loop(w).members = ["review-builder", "review-critic", "review-merge-gate"];
  w.edges.push({ id: "e-builder-critic-direct", from: "review-builder", to: "review-critic", when: { verdict: "never" }, evidence: ["diff of the change"] });
});
show("MB1 a dispatched step taken out of the loop's members (budget counts 2 a round, not 3)", r1);
if (r1.valid) console.log("  my oracle:", JSON.stringify(roundsLoosened(src, r1.doc)));

const r2 = attempt(src, (w) => {
  // a new heavy step on the round, never a member: budget does not count it
  w.nodes.push(agent("review-heavy", "tester"));
  w.edges.push({ id: "e-builder-heavy", from: "review-builder", to: "review-heavy" }, { id: "e-heavy-tests", from: "review-heavy", to: "review-tests" });
});
show("MB2 a new step on the round's path that is not made a member (work the budget does not count; new node: adaptive leads may add one)", r2);

show("MB3 the forward edge builder->critic called a back edge of the loop (critic becomes an entry node)", attempt(base, (w) => { loop(w).back.push("e-review-builder-review-critic"); }));
const r4 = attempt(base, (w) => { loop(w).back.push("review-e-critic-pass"); });
show("MB4 the edge critic->gate called a back edge (the gate becomes an entry node)", r4);
console.log("  entry nodes of base:", core.entryNodeIds(core.indexGraph(base)).join(","), "| after MB3:", (() => { const w = clone(base); loop(w).back.push("e-review-builder-review-critic"); return core.entryNodeIds(core.indexGraph(w)).join(","); })());
