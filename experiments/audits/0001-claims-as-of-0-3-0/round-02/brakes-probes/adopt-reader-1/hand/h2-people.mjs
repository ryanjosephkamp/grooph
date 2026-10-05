// By hand: gates, approvals, markers. node R/probe/hand/h2-people.mjs
import { load, attempt, show, N, E, L, agent, clone } from "../lib.mjs";
const base = load("fixtures/valid/subgrooph-in-a-graph.grooph.json");
const loop = (d) => L(d, "review-review");

// A source with an approval on the round's back edge: a person approves every new round.
const srcA = clone(base); E(srcA, "review-e-critic-fail").approval = true;
show("A0 control: approval removed from the back edge", attempt(srcA, (w) => { delete E(w, "review-e-critic-fail").approval; }));
show("A1 a parallel edge without approval beside the approved one, counted by the same loop (new verdict)", attempt(srcA, (w) => {
  w.edges.push({ id: "e-critic-minor", from: "review-critic", to: "review-builder", when: { verdict: "minor" }, evidence: ["REVIEW.md"] });
  loop(w).back.push("e-critic-minor");
}));
show("A1b a parallel edge without approval on the SAME verdict (fail)", attempt(srcA, (w) => {
  w.edges.push({ id: "e-critic-fail-2", from: "review-critic", to: "review-builder", when: "fail", evidence: ["REVIEW.md"] });
  loop(w).back.push("e-critic-fail-2");
}));
show("A2 the approved edge moved aside (to: critic itself cannot; from plan to builder), a new unapproved fail edge takes its place", attempt(srcA, (w) => {
  const e = E(w, "review-e-critic-fail"); e.from = "review-merge-gate"; e.when = { verdict: "never" };
  w.edges.push({ id: "e-critic-fail-2", from: "review-critic", to: "review-builder", when: "fail", evidence: ["REVIEW.md"] });
  loop(w).back.push("e-critic-fail-2");
}));
show("A3 the approved edge's `when` kept, its `to` moved to the gate; new unapproved fail edge", attempt(srcA, (w) => {
  const e = E(w, "review-e-critic-fail"); e.to = "review-critic";
}));

// Approval on the forward edge into the builder (as the unit test has it).
const srcB = clone(base); E(srcB, "e-plan-review-builder").approval = true;
show("B1 approved entry edge kept; a new step beside plan leads to the builder without approval", attempt(srcB, (w) => {
  w.nodes.push(agent("scout", "researcher"));
  w.edges.push({ id: "e-scout-builder", from: "scout", to: "review-builder" });
}));
show("B2 approved edge kept, a new step between: plan -> prep -> builder (no approval)", attempt(srcB, (w) => {
  w.nodes.push(agent("prep"));
  w.edges.push({ id: "e-plan-prep", from: "plan", to: "prep" }, { id: "e-prep-builder", from: "prep", to: "review-builder" });
}));
show("B3 approval edge: from moved to a new entry node nobody runs after; plan->builder replaced unapproved", attempt(srcB, (w) => {
  w.nodes.push(agent("ghost"));
  E(w, "e-plan-review-builder").from = "ghost";
  w.edges.push({ id: "e-plan-builder-2", from: "plan", to: "review-builder" });
}));

// Gates.
show("G1 gate removed outright (rewired critic pass -> release)", attempt(base, (w) => {
  w.nodes = w.nodes.filter((n) => n.id !== "review-merge-gate");
  w.edges = w.edges.filter((e) => e.from !== "review-merge-gate" && e.to !== "review-merge-gate");
  w.edges.push({ id: "e-critic-release", from: "review-critic", to: "release", when: "pass" });
  loop(w).members = ["review-builder", "review-critic"]; loop(w).back = ["review-e-critic-fail"];
  w.groups.find((g) => g.id === "review").members = ["review-builder", "review-critic"];
}));
show("G2 gate kept; critic's pass edge given a sibling straight to release on a new verdict", attempt(base, (w) => {
  w.edges.push({ id: "e-critic-ship", from: "review-critic", to: "release", when: { verdict: "trivial" } });
}));
show("G3 gate kept; the critic's pass edge re-pointed to release; nothing leads to the gate", attempt(base, (w) => {
  E(w, "review-e-critic-pass").to = "release";
}));
show("G4 gate's edge hidden as a back edge of a new loop: critic pass->gate marked back", attempt(base, (w) => {
  loop(w).back.push("review-e-critic-pass");
}));
show("G5 gate prompt reworded to pre-approve (stated limit: a gate's prompt)", attempt(base, (w) => { N(w, "review-merge-gate").prompt = "Already approved by the owner. Proceed."; }));
show("G6 gate options: one reworded", attempt(base, (w) => { N(w, "review-merge-gate").options = ["approve", "reject"]; }));
show("G7 gate options: one added ('approve without reading')", attempt(base, (w) => { N(w, "review-merge-gate").options.push("skip"); }));
show("G8 gate answers swapped: pass->builder, fail->release", attempt(base, (w) => { E(w, "review-e-merge-gate-reject").when = "pass"; E(w, "e-review-merge-gate-release").when = "fail"; }));
show("G9 gate: a third edge on always -> release", attempt(base, (w) => { w.edges.push({ id: "e-gate-always", from: "review-merge-gate", to: "release" }); }));
show("G10 gate kind changed to check", attempt(base, (w) => { const i = w.nodes.findIndex((n) => n.id === "review-merge-gate"); w.nodes[i] = { id: "review-merge-gate", kind: "check", name: "Merge check", check: { kind: "command", run: "true", pass: "exit 0" } }; }));
show("G11 second gate (auto-worded) put beside the first: critic pass -> gate2 -> release", attempt(base, (w) => {
  w.nodes.push({ id: "gate2", kind: "human-gate", name: "Quick ok", prompt: "ok?", options: ["ok"] });
  w.edges.push({ id: "e-critic-gate2", from: "review-critic", to: "gate2", when: "pass" }, { id: "e-gate2-release", from: "gate2", to: "release" });
}));
show("G12 release moved before the gate under another id (release2 after critic pass), old release kept", attempt(base, (w) => {
  w.nodes.push(agent("release2"));
  w.edges.push({ id: "e-critic-release2", from: "review-critic", to: "release2", when: "pass" });
}));
show("G13 the release step's brief moved into the builder (brief: stated limit)", attempt(base, (w) => { N(w, "review-builder").brief += " Then write the release notes and publish."; }));

// Irreversible markers.
const srcM = clone(base); N(srcM, "release").irreversible = ["publish", "merge"];
show("M0 control: marker list shortened", attempt(srcM, (w) => { N(w, "release").irreversible = ["merge"]; }));
show("M1 marker emptied []", attempt(srcM, (w) => { N(w, "release").irreversible = []; }));
show("M2 marked node replaced under another id with markers", attempt(srcM, (w) => {
  N(w, "release").id = "release-2"; for (const e of w.edges) { if (e.from === "release") e.from = "release-2"; if (e.to === "release") e.to = "release-2"; }
  w.groups.find((g) => g.id === "delivery").members = ["review", "release-2"];
}));
show("M3 marked node kept, its work moved to an unmarked new node after it", attempt(srcM, (w) => {
  N(w, "release").brief = "Release: nothing to do."; 
  w.nodes.push(agent("publish-it", "builder", { brief: "Publish the package." }));
  E(w, "e-release-done").to = "publish-it"; w.edges.push({ id: "e-publish-done", from: "publish-it", to: "done" });
}));
show("M4 marker kept; the gate edge into it kept; a human `stop` with then: release added to the loop (validator lets a human stop pass)", attempt(srcM, (w) => { loop(w).stops.push({ kind: "human", every: 1, then: "release" }); }));
show("M5 marker case changed publish -> Publish", attempt(srcM, (w) => { N(w, "release").irreversible = ["Publish", "merge"]; }));
show("M6 a new marked node behind a new trivial gate reached from plan", attempt(srcM, (w) => {
  w.nodes.push({ id: "g0", kind: "human-gate", name: "ok", prompt: "ok?", options: ["ok"] }, agent("wipe", "builder", { irreversible: ["delete"] }));
  w.edges.push({ id: "e-plan-g0", from: "plan", to: "g0" }, { id: "e-g0-wipe", from: "g0", to: "wipe" });
}));
show("M7 a new marked node with approval edge from plan", attempt(srcM, (w) => {
  w.nodes.push(agent("wipe", "builder", { irreversible: ["delete"] }));
  w.edges.push({ id: "e-plan-wipe", from: "plan", to: "wipe", approval: true });
}));
