import { run, g, bar, agent, loop, edge, node, tally } from "./lib5.mjs";
const RETRO = "retrospective-rewrite", GATED = "irreversible-after-a-stop-gated", WRAP = "wrap-up-after-the-cap";
// --- firing stops under a key the loop did not have
run("C1 budget of another measure, then done", RETRO, (w) => void loop(w, "grind").stops.unshift({ kind: "budget", measure: "dispatches", limit: 1, then: "done" }));
run("C1b budget tokens, then done", RETRO, (w) => void loop(w, "grind").stops.push({ kind: "budget", measure: "tokens", limit: 1, then: "done" }));
run("C2 human stop, then done", RETRO, (w) => void loop(w, "grind").stops.unshift({ kind: "human", every: 1, then: "done" }));
run("C1c same on grind-loop (control: expect held)", "grind-loop", (w) => void loop(w, "grind").stops.unshift({ kind: "budget", measure: "dispatches", limit: 1, then: "done" }));
run("C1d budget dispatches then land-gate (same place the cap leads)", GATED, (w) => void loop(w, "fix-cycle").stops.unshift({ kind: "budget", measure: "dispatches", limit: 1, then: "land-gate" }));
run("C1e budget dispatches then green", WRAP, (w) => void loop(w, "fix-cycle").stops.unshift({ kind: "budget", measure: "dispatches", limit: 1, then: "green" }));
run("C1f cap then done added beside the cap then retro (expect held)", RETRO, (w) => void loop(w, "grind").stops.unshift({ kind: "max-iterations", n: 1, then: "done" }));
run("C1g existing budget's then moved to done (expect held)", RETRO, (w) => void (loop(w, "grind").stops[1].then = "done"));
// --- a new loop with a firing stop
run("C3 second loop on the same round, cap 1 then done", RETRO, (w) => void w.loops.push({ id: "quick", name: "Quick", members: ["builder", "tests"], back: ["e-tests-fail"], stops: [{ kind: "max-iterations", n: 1, then: "done" }] }));
run("C3b control on grind-loop", "grind-loop", (w) => void w.loops.push({ id: "quick", name: "Quick", members: ["builder", "tests"], back: ["e-tests-fail"], stops: [{ kind: "max-iterations", n: 1, then: "done" }] }));
run("C3c new loop of new steps in front of builder, cap then done", RETRO, (w) => {
  w.nodes.push(agent("prep"), agent("prep2"));
  w.edges.push({ id: "e-prep-prep2", from: "prep", to: "prep2" }, { id: "e-prep2-prep", from: "prep2", to: "prep", when: { verdict: "again" } }, { id: "e-prep2-builder", from: "prep2", to: "builder", when: { verdict: "ready" } });
  w.loops.push({ id: "warm", name: "Warm up", members: ["prep", "prep2"], back: ["e-prep2-prep"], stops: [{ kind: "max-iterations", n: 1, then: "done" }] });
});
run("C3d new loop builder<->scribe, budget then done", RETRO, (w) => {
  w.nodes.push(agent("scribe"));
  w.edges.push({ id: "e-builder-scribe", from: "builder", to: "scribe", when: { verdict: "note" } }, { id: "e-scribe-builder", from: "scribe", to: "builder" });
  w.loops.push({ id: "notes", name: "Notes", members: ["builder", "scribe"], back: ["e-scribe-builder"], stops: [{ kind: "max-iterations", n: 1, then: "done" }] });
});
run("C3e new loop that also holds the scribe in grind", RETRO, (w) => {
  w.nodes.push(agent("scribe"));
  w.edges.push({ id: "e-builder-scribe", from: "builder", to: "scribe", when: { verdict: "note" } }, { id: "e-scribe-builder", from: "scribe", to: "builder" });
  loop(w, "grind").members.push("scribe"); loop(w, "grind").back.push("e-scribe-builder");
  w.loops.push({ id: "notes", name: "Notes", members: ["builder", "scribe"], back: ["e-scribe-builder"], stops: [{ kind: "max-iterations", n: 1, then: "done" }] });
});
// --- a halting stop that an edge leaves / first asking's "escalates"
run("C8 cap to a new halting stop that an edge leaves to done", "grind-loop", (w) => {
  w.nodes.push({ id: "gave-up", kind: "stop", name: "Gave up", outcome: "halt" }, agent("limbo"));
  w.edges.push({ id: "e-gave-up-limbo", from: "gave-up", to: "limbo" }, { id: "e-limbo-gave-up", from: "limbo", to: "gave-up", when: { verdict: "no" } }, { id: "e-limbo-done", from: "limbo", to: "done" });
  loop(w, "grind").stops[0].then = "gave-up";
});
run("C8b cap to a new halting stop, a member of a new loop whose stop leads to done", "grind-loop", (w) => {
  w.nodes.push({ id: "gave-up", kind: "stop", name: "Gave up", outcome: "halt" });
  loop(w, "grind").stops[0].then = "gave-up";
  loop(w, "grind").members.push("gave-up");
});
// --- stop kind changed so a way stops/starts firing
run("C9 cap then retro made diminishing-returns then retro", RETRO, (w) => void (loop(w, "grind").stops[0] = { kind: "diminishing-returns", rounds: 1, then: "retro" }));
run("C9b budget then retro made evidence-invalid then retro, cap kept", RETRO, (w) => void (loop(w, "grind").stops[1] = { kind: "evidence-invalid", rounds: 1, then: "retro" }));
run("C9c bar-passed then retro added (no bar)", RETRO, (w) => void loop(w, "grind").stops.push({ kind: "bar-passed", then: "retro" }));
// --- members changed so that a stop's way starts from somewhere new
run("C10 retro made a member of grind", RETRO, (w) => void loop(w, "grind").members.push("retro"));
run("C10b new step, member of grind, leads to done", RETRO, (w) => { w.nodes.push(agent("scribe")); w.edges.push({ id: "e-builder-scribe", from: "builder", to: "scribe", when: { verdict: "note" } }, { id: "e-scribe-done", from: "scribe", to: "done" }); loop(w, "grind").members.push("scribe"); });
run("C10c new step that only the cap reaches (in a 2-cycle), leads to done; new budget key leads to it", RETRO, (w) => {
  w.nodes.push(agent("a1"), agent("a2"));
  w.edges.push({ id: "e-a1-a2", from: "a1", to: "a2" }, { id: "e-a2-a1", from: "a2", to: "a1", when: { verdict: "again" } }, { id: "e-a2-done", from: "a2", to: "done", when: { verdict: "ok" } });
  w.loops.push({ id: "aa", name: "AA", members: ["a1", "a2"], back: ["e-a2-a1"], stops: [{ kind: "max-iterations", n: 1 }] });
  loop(w, "grind").stops.push({ kind: "budget", measure: "turns", limit: 1, then: "a1" });
});
// --- gauntlet: bar-passed already leads on
run("C11 owner straight to critic", "gauntlet-decomposed", (w) => void w.edges.push({ id: "e-owner-critic", from: "owner", to: "critic", evidence: ["x"] }));
run("C11b owner to next-piece", "gauntlet-decomposed", (w) => void w.edges.push({ id: "e-owner-next", from: "owner", to: "next-piece" }));
run("C11c critic gains a verdict to integrator (around next-piece)", "gauntlet-decomposed", (w) => void w.edges.push({ id: "e-critic-int", from: "critic", to: "integrator", when: { verdict: "enough" } }));
run("C11d polish gains diminishing-returns then integrator", "gauntlet-decomposed", (w) => void (loop(w, "polish").stops[1].then = "integrator"));
run("C11e polish bar-passed then next-piece -> then integrator", "gauntlet-decomposed", (w) => void (loop(w, "polish").stops[0].then = "integrator"));
tally();
