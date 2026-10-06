import { load, pat, attempt, show, N, E, L, agent, copyNode, clone } from "./plib.mjs";
const wrap = load("fixtures/valid/wrap-up-after-the-cap.grooph.json");
const sub = load("fixtures/valid/subgrooph-in-a-graph.grooph.json");
const glyph = load("fixtures/valid/glyph-vocabulary.grooph.json");
const debate = pat("debate-then-build");
const gaunt = pat("gauntlet-decomposed");
const fgrj = pat("fresh-grind-rare-judge");
const big = (id, members, back, extra = {}) => ({ id, name: id, members, back, stops: [{ kind: "max-iterations", n: 1000 }], ...extra });

show("1 husk (wrap): fixer replaced by fixer2/suite2 under a new loop cap 1000; fix-cycle keeps suite + a stub", attempt(wrap, (d) => {
  const f2 = copyNode(d, "fixer", "fixer2"), s2 = copyNode(d, "suite", "suite2");
  d.nodes = d.nodes.filter((n) => n.id !== "fixer"); d.nodes.push(agent("stub"), f2, s2);
  d.edges = d.edges.filter((e) => e.id !== "e-fix-suite");
  E(d, "e-suite-fail").to = "stub";
  d.edges.push({ id: "e-stub-suite", from: "stub", to: "suite" }, { id: "e-fix2-suite2", from: "fixer2", to: "suite2" }, { id: "e-suite2-fail", from: "suite2", to: "fixer2", when: "fail" }, { id: "e-suite2-pass", from: "suite2", to: "green", when: "pass" });
  L(d, "fix-cycle").members = ["stub", "suite"];
  d.loops.push(big("fix-cycle-2", ["fixer2", "suite2"], ["e-suite2-fail"]));
}));

show("1b husk (wrap), smaller: same, but the old suite is left with a no-op stub and its own pass edge removed", attempt(wrap, (d) => {
  const f2 = copyNode(d, "fixer", "fixer2"), s2 = copyNode(d, "suite", "suite2");
  d.nodes = d.nodes.filter((n) => n.id !== "fixer"); d.nodes.push(agent("stub"), f2, s2);
  d.edges = d.edges.filter((e) => e.id !== "e-fix-suite");
  E(d, "e-suite-fail").to = "stub";
  E(d, "e-suite-pass").from = "suite2";
  d.edges.push({ id: "e-stub-suite", from: "stub", to: "suite" }, { id: "e-fix2-suite2", from: "fixer2", to: "suite2" }, { id: "e-suite2-fail", from: "suite2", to: "fixer2", when: "fail" });
  L(d, "fix-cycle").members = ["stub", "suite"];
  d.loops.push(big("fix-cycle-2", ["fixer2", "suite2"], ["e-suite2-fail"]));
}));

show("2 hollow (debate build loop): old builder/tests made no-ops by brief/command, real work in builder2/tests2 cap 1000", attempt(debate, (d) => {
  const b2 = copyNode(d, "builder", "builder2"), t2 = copyNode(d, "tests", "tests2");
  N(d, "builder").brief = "Report done; change nothing."; N(d, "tests").check.run = "true";
  d.nodes.push(b2, t2);
  d.edges.push({ id: "e-gate-b2", from: "plan-gate", to: "builder2", when: "pass" }, { id: "e-b2-t2", from: "builder2", to: "tests2" }, { id: "e-t2-fail", from: "tests2", to: "builder2", when: "fail" }, { id: "e-t2-pass", from: "tests2", to: "done", when: "pass" });
  d.loops.push(big("build-2", ["builder2", "tests2"], ["e-t2-fail"]));
}));

show("3 cap leads to an EXISTING gate whose existing answer leads back in (debate build: cap 5 then plan-gate)", attempt(debate, (d) => { L(d, "build").stops[0].then = "plan-gate"; }));
show("4 budget leads to the merge gate (sub)", attempt(sub, (d) => { L(d, "review-review").stops[2].then = "review-merge-gate"; }));
show("5 self edge on a member counted by a new loop cap 1000 (sub)", attempt(sub, (d) => { d.edges.push({ id: "e-again", from: "review-builder", to: "review-builder", when: { verdict: "again" } }); d.loops.push(big("again", ["review-builder"], ["e-again"])); }));
show("5b self edge on a check member counted by a new loop (wrap)", attempt(wrap, (d) => { d.edges.push({ id: "e-again", from: "suite", to: "suite", when: { verdict: "flaky" } }); d.loops.push(big("again", ["suite"], ["e-again"])); }));
show("5c self edge on a NON-member in front of the loop (sub: plan -> plan) cap 1000", attempt(sub, (d) => { d.edges.push({ id: "e-again", from: "plan", to: "plan", when: { verdict: "again" } }); d.loops.push(big("again", ["plan"], ["e-again"])); }));
show("6 edge whose id is a stop-way's name (debate: 'debate → judge')", attempt(debate, (d) => { d.edges.push({ id: "debate → judge", from: "judge", to: "planner-b", when: { verdict: "again" } }); d.loops.push(big("again", ["planner-b", "judge"], ["debate → judge"])); }));
show("7 glyph: grind's twin back edge on another verdict, counted by review", attempt(glyph, (d) => { d.edges.push({ id: "e-tests-flaky", from: "tests", to: "build", when: { verdict: "flaky" } }); L(d, "review").back.push("e-tests-flaky"); }));
show("8 glyph: e-critic-evidence moved from review.back to grind.back (grind gains critic as member)", attempt(glyph, (d) => { L(d, "review").back = ["e-critic-fail"]; L(d, "grind").back.push("e-critic-evidence"); L(d, "grind").members.push("critic"); }));
show("9 glyph: review's back edge ALSO put in grind.back, then review cap unchanged (no loosening expected: control)", attempt(glyph, (d) => { L(d, "grind").back.push("e-critic-fail"); L(d, "grind").members.push("critic"); }));
show("10 debate: second stop of another measure, then: judge (known residual)", attempt(debate, (d) => { L(d, "debate").stops.unshift({ kind: "budget", measure: "tokens", limit: 0, then: "judge" }); }));
show("11 wrap: new edge wrap -> fixer (cap leads to wrap; wrap now leads back): no edge cycle, no loop needed", attempt(wrap, (d) => { d.edges.push({ id: "e-wrap-fixer", from: "wrap", to: "fixer" }); }));
show("11b wrap: existing e-wrap-handed-over re-pointed to fixer", attempt(wrap, (d) => { E(d, "e-wrap-handed-over").to = "fixer"; }));
show("11c wrap: wrap -> NEW gate -> fixer (person newly opens; stated limit)", attempt(wrap, (d) => { d.nodes.push({ id: "again-gate", kind: "human-gate", name: "Again?", prompt: "Go again?", options: ["again"] }); d.edges.push({ id: "e-wrap-gate", from: "wrap", to: "again-gate" }, { id: "e-gate-fixer", from: "again-gate", to: "fixer", when: "pass" }); }));
show("11d wrap: wrap -> fixer with approval:true (stated limit)", attempt(wrap, (d) => { d.edges.push({ id: "e-wrap-fixer", from: "wrap", to: "fixer", approval: true }); }));
show("11e wrap: wrap -> relay (approval) and relay -> fixer; PLUS a non-approved wrap -> relay2 -> nothing (decoy)", attempt(wrap, (d) => { d.nodes.push(agent("relay")); d.edges.push({ id: "e-wrap-relay", from: "wrap", to: "relay", approval: true }, { id: "e-relay-fixer", from: "relay", to: "fixer" }); }));
show("12 wrap: leading cap's target `wrap` becomes a member of the loop (members grows; stop now continues inside)", attempt(wrap, (d) => { L(d, "fix-cycle").members.push("wrap"); d.edges.push({ id: "e-wrap-fixer", from: "wrap", to: "fixer", approval: true }); }));
show("12b wrap: `wrap` added to members only (no edge)", attempt(wrap, (d) => { L(d, "fix-cycle").members.push("wrap"); }));
show("13 gaunt: human stop every 2 gains then: decomposition-gate (existing gate upstream; stated limit?)", attempt(gaunt, (d) => { L(d, "pieces").stops[1].then = "decomposition-gate"; }));
show("13b gaunt: NEW human stop every 1000000 then: owner, first in the list", attempt(gaunt, (d) => { L(d, "polish").stops.unshift({ kind: "human", every: 1000000, then: "owner" }); }));
show("13c sub: NEW human stop every 5 then: review-builder placed first (cap 4 never asked?)", attempt(sub, (d) => { L(d, "review-review").stops.unshift({ kind: "human", every: 5, then: "review-builder" }); }));
show("14 sub: cap 4 then: NEW gate with one option -> builder (stated limit)", attempt(sub, (d) => { d.nodes.push({ id: "more-gate", kind: "human-gate", name: "More?", prompt: "More rounds?", options: ["more"] }); d.edges.push({ id: "e-more", from: "more-gate", to: "review-builder", when: "pass" }); L(d, "review-review").stops[1].then = "more-gate"; }));
