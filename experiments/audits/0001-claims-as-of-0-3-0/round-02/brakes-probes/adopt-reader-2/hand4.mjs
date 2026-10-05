import { load, pat, attempt, show, N, E, L, agent, clone, core, errorsOf } from "./plib.mjs";
import { personLoosened } from "../adopt-reader-1/fuzz/oracle.mjs";
// Source: fixtures/valid/glyph-vocabulary with ONE decoration: approval on critic -> merge (merge is also reached from docs with nobody asked).
const base = load("fixtures/valid/glyph-vocabulary.grooph.json");
const src0 = clone(base); E(src0, "e-critic-merge").approval = true;
const src = core.parseGraphText(JSON.stringify(src0)).doc; console.log("decorated source valid:", errorsOf(src).length === 0);
const run = (title, change, s = src) => { const r = attempt(s, change); show(title, r); if (r.valid && r.refused.length === 0) console.log("  first reader's oracle, pairs that lost the person between them:", JSON.stringify(personLoosened(s, r.doc).slice(0, 6))); };
run("T1 twin in two hops through a new step: critic -> relay -> merge (pass)", (d) => { d.nodes.push(agent("relay")); d.edges.push({ id: "e-critic-relay", from: "critic", to: "relay", when: "pass" }, { id: "e-relay-merge", from: "relay", to: "merge" }); });
run("T2 the approved edge's from moved to docs; a new unapproved critic -> merge (pass)", (d) => { E(d, "e-critic-merge").from = "docs"; delete E(d, "e-critic-merge").when; d.edges.push({ id: "e-critic-merge-2", from: "critic", to: "merge", when: "pass" }); });
run("T3 twin by a stop: review's bar-passed gets then: merge (the bar passed IS the critic's pass)", (d) => { L(d, "review").stops[0].then = "merge"; });
run("T4 twin by a stop of another kind: diminishing-returns then: merge", (d) => { L(d, "review").stops.push({ kind: "diminishing-returns", rounds: 2, then: "merge" }); });
run("T5 twin by a human stop then: merge (a person, but not the approval)", (d) => { L(d, "review").stops.push({ kind: "human", every: 3, then: "merge" }); });
run("T6 twin to the node just after: critic -> gate (pass), skipping merge", (d) => { d.edges.push({ id: "e-critic-gate", from: "critic", to: "gate", when: "pass" }); });
run("T7 twin by grind's stop (tests is no critic): grind gets diminishing-returns then: merge", (d) => { L(d, "grind").stops.push({ kind: "diminishing-returns", rounds: 2, then: "merge" }); });
// On the undecorated fixture: around one answer of the gate, and the gate's approval edge.
run("G1 base: gate's 'fail' (-> halt) gains a second edge to ship without approval", (d) => { d.edges.push({ id: "e-gate-ship-2", from: "gate", to: "ship", when: "fail" }); }, base);
run("G2 base: a twin gate -> ship (pass) without approval beside the approved one", (d) => { d.edges.push({ id: "e-gate-ship-2", from: "gate", to: "ship", when: "pass" }); }, base);
run("G3 base: gate -> relay (pass, no approval) -> ship", (d) => { d.nodes.push(agent("relay")); d.edges.push({ id: "e-gate-relay", from: "gate", to: "relay", when: "pass" }, { id: "e-relay-ship", from: "relay", to: "ship" }); }, base);
