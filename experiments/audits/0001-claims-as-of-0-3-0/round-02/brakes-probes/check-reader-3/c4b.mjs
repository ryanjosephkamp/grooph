import { run, g, bar, agent, loop, edge, node, tally } from "./lib5.mjs";
const RETRO = "retrospective-rewrite", GATED = "irreversible-after-a-stop-gated", WRAP = "wrap-up-after-the-cap";
run("C1h new-key budget then retro (same place, sooner)", RETRO, (w) => void loop(w, "grind").stops.unshift({ kind: "budget", measure: "dispatches", limit: 1, then: "retro" }));
run("C1i new-key budget then a new step that leads to done", RETRO, (w) => { w.nodes.push(agent("sum")); w.edges.push({ id: "e-sum-done", from: "sum", to: "done" }, { id: "e-retro-sum", from: "retro", to: "sum", when: { verdict: "more" } }); loop(w, "grind").stops.unshift({ kind: "budget", measure: "dispatches", limit: 1, then: "sum" }); });
run("C1j human stop then land (irreversible) ", GATED, (w) => void loop(w, "fix-cycle").stops.unshift({ kind: "human", every: 1, then: "land" }));
run("C1k budget dispatches then landed (past the gate)", GATED, (w) => void loop(w, "fix-cycle").stops.unshift({ kind: "budget", measure: "dispatches", limit: 1, then: "landed" }));
run("C1l budget dispatches then land (past the gate)", GATED, (w) => void loop(w, "fix-cycle").stops.unshift({ kind: "budget", measure: "dispatches", limit: 1, then: "land" }));
run("C3c new loop of new steps in front of builder, cap then done", RETRO, (w) => {
  w.nodes.push(agent("prep"), agent("prep2"));
  w.edges.push({ id: "e-prep-prep2", from: "prep", to: "prep2" }, { id: "e-prep2-prep", from: "prep2", to: "prep", when: { verdict: "again" } }, { id: "e-prep2-builder", from: "prep2", to: "builder", when: { verdict: "ready" } });
  w.loops.push({ id: "warm", name: "Warm up", members: ["prep", "prep2"], back: ["e-prep2-prep"], stops: [{ kind: "max-iterations", n: 1, then: "done" }] });
});
run("C3c' control on grind-loop", "grind-loop", (w) => {
  w.nodes.push(agent("prep"), agent("prep2"));
  w.edges.push({ id: "e-prep-prep2", from: "prep", to: "prep2" }, { id: "e-prep2-prep", from: "prep2", to: "prep", when: { verdict: "again" } }, { id: "e-prep2-builder", from: "prep2", to: "builder", when: { verdict: "ready" } });
  w.loops.push({ id: "warm", name: "Warm up", members: ["prep", "prep2"], back: ["e-prep2-prep"], stops: [{ kind: "max-iterations", n: 1, then: "done" }] });
});
run("C3d new loop builder<->scribe, cap then done", RETRO, (w) => {
  w.nodes.push(agent("scribe"));
  w.edges.push({ id: "e-builder-scribe", from: "builder", to: "scribe", when: { verdict: "note" } }, { id: "e-scribe-builder", from: "scribe", to: "builder" });
  w.loops.push({ id: "notes", name: "Notes", members: ["builder", "scribe"], back: ["e-scribe-builder"], stops: [{ kind: "max-iterations", n: 1, then: "done" }] });
});
run("C3f new loop over [tests] alone? self edge", RETRO, (w) => void w.loops.push({ id: "quick", name: "Quick", members: ["builder", "tests", "retro"], back: ["e-tests-fail"], stops: [{ kind: "budget", measure: "dispatches", limit: 2, then: "done" }] }));
run("C3g second loop, same round, gated: budget then landed", GATED, (w) => void w.loops.push({ id: "quick", name: "Quick", members: ["fixer", "suite"], back: ["e-suite-fail"], stops: [{ kind: "max-iterations", n: 1, then: "landed" }] }));
run("C3h second loop, same round, gated: cap then land-gate", GATED, (w) => void w.loops.push({ id: "quick", name: "Quick", members: ["fixer", "suite"], back: ["e-suite-fail"], stops: [{ kind: "max-iterations", n: 1, then: "land-gate" }] }));
run("C8 cap to a new halting stop that an edge leaves", "grind-loop", (w) => {
  w.nodes.push({ id: "gave-up", kind: "stop", name: "Gave up", outcome: "halt" }, agent("limbo"));
  w.edges.push({ id: "e-gave-up-limbo", from: "gave-up", to: "limbo" }, { id: "e-limbo-gave-up", from: "limbo", to: "gave-up", when: { verdict: "no" } }, { id: "e-limbo-done", from: "limbo", to: "done" });
  loop(w, "grind").stops[0].then = "gave-up";
});
run("C10b new step, member of grind, leads to done", RETRO, (w) => { w.nodes.push(agent("scribe")); w.edges.push({ id: "e-builder-scribe", from: "builder", to: "scribe", when: { verdict: "note" } }, { id: "e-scribe-done", from: "scribe", to: "done" }); loop(w, "grind").members.push("scribe"); });
run("C10d new pair only a new-key stop reaches, leads to done", RETRO, (w) => {
  w.nodes.push(agent("a1"), agent("a2"));
  w.edges.push({ id: "e-a1-a2", from: "a1", to: "a2" }, { id: "e-a2-a1", from: "a2", to: "a1", when: { verdict: "again" } }, { id: "e-a2-done", from: "a2", to: "done", when: { verdict: "ok" } });
  w.loops.push({ id: "aa", name: "AA", members: ["a1", "a2"], back: ["e-a2-a1"], stops: [{ kind: "max-iterations", n: 1 }] });
  loop(w, "grind").stops.push({ kind: "budget", measure: "turns", limit: 1, then: "a1" });
});
// wrap-up: the cap leads to wrap -> handed-over (halt). make handed-over succeed? or wrap lead to green
run("C12 wrap leads to green by a new edge (cap -> wrap already)", WRAP, (w) => void w.edges.push({ id: "e-wrap-green", from: "wrap", to: "green", when: { verdict: "fine" } }));
run("C12b handed-over made a success", WRAP, (w) => void (node(w, "handed-over").outcome = "success"));
run("C12c wrap-up: human stop then wrap; wrap->green", WRAP, (w) => { loop(w, "fix-cycle").stops.unshift({ kind: "human", every: 1, then: "wrap" }); });
tally();
