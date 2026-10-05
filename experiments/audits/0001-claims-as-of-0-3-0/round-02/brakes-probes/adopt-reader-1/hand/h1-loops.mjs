// By hand: the loop roads. node R/probe/hand/h1-loops.mjs
import { load, attempt, show, N, E, L, agent } from "../lib.mjs";
const src = load("fixtures/valid/subgrooph-in-a-graph.grooph.json");
const loop = (d) => L(d, "review-review");

show("control: cap 4 -> 40", attempt(src, (w) => { loop(w).stops[1].n = 40; }));

show("H1 outer loop around the capped loop, no new node: critic --verdict replan--> plan, counted by a new loop with cap 1000", attempt(src, (w) => {
  w.edges.push({ id: "e-replan", from: "review-critic", to: "plan", when: { verdict: "replan" } });
  w.loops.push({ id: "replan", name: "Replan", members: ["plan", "review-builder", "review-critic"], back: ["e-replan"], mode: "judgment", bar: structuredClone(loop(w).bar), stops: [{ kind: "bar-passed" }, { kind: "max-iterations", n: 1000 }] });
}));

show("H1b outer loop from the release step back to plan (after the gate), cap 1000, budget 100000 dispatches", attempt(src, (w) => {
  w.edges.push({ id: "e-again", from: "release", to: "plan", when: "fail" });
  w.loops.push({ id: "again", name: "Again", members: ["plan", "review-builder", "review-critic", "review-merge-gate", "release"], back: ["e-again"], mode: "judgment", bar: structuredClone(loop(w).bar), stops: [{ kind: "bar-passed" }, { kind: "max-iterations", n: 1000 }, { kind: "budget", measure: "dispatches", limit: 100000 }] });
}));

show("H2 a second way round through a new step, counted by a second loop: critic --verdict revise--> fixer --> builder", attempt(src, (w) => {
  w.nodes.push(agent("fixer"));
  w.edges.push({ id: "e-critic-fixer", from: "review-critic", to: "fixer", when: { verdict: "revise" } });
  w.edges.push({ id: "e-fixer-builder", from: "fixer", to: "review-builder", evidence: ["REVIEW.md"] });
  w.loops.push({ id: "revise", name: "Revise", members: ["review-builder", "review-critic", "fixer"], back: ["e-fixer-builder"], mode: "judgment", bar: structuredClone(loop(w).bar), stops: [{ kind: "bar-passed" }, { kind: "max-iterations", n: 1000 }] });
}));

show("H2b same, but the back edge of the second loop is critic->fixer (from is bounded, to is not)", attempt(src, (w) => {
  w.nodes.push(agent("fixer"));
  w.edges.push({ id: "e-critic-fixer", from: "review-critic", to: "fixer", when: { verdict: "revise" } });
  w.edges.push({ id: "e-fixer-builder", from: "fixer", to: "review-builder", evidence: ["REVIEW.md"] });
  w.loops.push({ id: "revise", name: "Revise", members: ["review-builder", "review-critic", "fixer"], back: ["e-critic-fixer"], mode: "judgment", bar: structuredClone(loop(w).bar), stops: [{ kind: "bar-passed" }, { kind: "max-iterations", n: 1000 }] });
}));

show("H3 the loop kept, its back edges kept by id but re-pointed through a new node pair; real round moved to a new loop", attempt(src, (w) => {
  // old loop now bounds builder + two new idle nodes; the real round is counted by 'real'
  w.nodes.push(agent("idle-a"), agent("idle-b"));
  w.edges.push({ id: "e-builder-idle-a", from: "review-builder", to: "idle-a" }, { id: "e-idle-a-idle-b", from: "idle-a", to: "idle-b" });
  E(w, "review-e-critic-fail").from = "idle-b"; E(w, "review-e-critic-fail").to = "idle-a"; delete E(w, "review-e-critic-fail").when;
  E(w, "review-e-merge-gate-reject").from = "idle-b"; E(w, "review-e-merge-gate-reject").to = "idle-a"; delete E(w, "review-e-merge-gate-reject").when;
  loop(w).members = ["review-builder", "idle-a", "idle-b"];
  w.nodes.push(agent("relay"));
  w.edges.push({ id: "e-critic-relay", from: "review-critic", to: "relay", when: "fail" }, { id: "e-relay-builder", from: "relay", to: "review-builder", evidence: ["REVIEW.md"] });
  w.loops.push({ id: "real", name: "Real", members: ["review-builder", "review-critic", "relay"], back: ["e-relay-builder"], mode: "judgment", bar: structuredClone(loop(w).bar), stops: [{ kind: "bar-passed" }, { kind: "max-iterations", n: 1000 }] });
}));

show("H4 budget measure changed: dispatches 10 -> tokens 1e12", attempt(src, (w) => { loop(w).stops[2] = { kind: "budget", measure: "tokens", limit: 1e12 }; }));
show("H5 a second budget of another measure that leads on to a member (fires first, goes round again)", attempt(src, (w) => { loop(w).stops.splice(1, 0, { kind: "budget", measure: "tokens", limit: 0, then: "review-builder" }); }));
show("H5b an 'evidence-invalid' stop placed first that leads on to done... (other stops: stated limit, but ends in success)", attempt(src, (w) => { loop(w).stops.unshift({ kind: "evidence-invalid", rounds: 1, then: "done" }); }));
show("H5c diminishing-returns placed first that leads on to release", attempt(src, (w) => { loop(w).stops.unshift({ kind: "diminishing-returns", rounds: 1, then: "release" }); }));
show("H6 stops reordered only (bar-passed last)", attempt(src, (w) => { loop(w).stops.push(loop(w).stops.shift()); }));
show("H7 cap given then: merge gate", attempt(src, (w) => { loop(w).stops[1].then = "review-merge-gate"; }));
show("H8 cap given then: a new halting stop node", attempt(src, (w) => { w.nodes.push({ id: "halted", kind: "stop", name: "Halted", outcome: "halt" }); loop(w).stops[1].then = "halted"; }));
show("H9 cap 4 with then: new halting stop... then that stop given outcome success in the same change", attempt(src, (w) => { w.nodes.push({ id: "halted", kind: "stop", name: "Halted", outcome: "success" }); loop(w).stops[1].then = "halted"; }));
show("H10 limit as a fraction above (10 -> 10.5)", attempt(src, (w) => { loop(w).stops[2].limit = 10.5; }));
show("H11 mode judgment -> grind with the bar kept (stated limit: mode)", attempt(src, (w) => { loop(w).mode = "grind"; }));
show("H12 bar-passed stop removed (stated limit: other stops)", attempt(src, (w) => { loop(w).stops.shift(); }));
show("H13 bar: inspects pointed elsewhere, answer key added (stated limits)", attempt(src, (w) => { loop(w).bar.inspects = [{ kind: "file", ref: "README.md" }]; }));
show("H14 bar acceptance weakened", attempt(src, (w) => { loop(w).bar.acceptance = "Looks fine."; }));
show("H15 bar acceptance: only trailing whitespace", attempt(src, (w) => { loop(w).bar.acceptance += " "; }));
show("H16 loop members: the gate dropped from members and its reject edge dropped from back, into no loop -> must fail validation", attempt(src, (w) => { loop(w).members = ["review-builder", "review-critic"]; loop(w).back = ["review-e-critic-fail"]; }));
show("H17 loop emptied of its critic: back edge from gate only", attempt(src, (w) => { loop(w).back = ["review-e-merge-gate-reject"]; }));
