import { run, bar, E, L, N, agent } from "./lib4.mjs";
// A. an existing critic from elsewhere listed among the check-judged loop's members, then a bar and bar-passed
run("A1 judge added to build's members + bar + bar-passed(no then)", "debate-then-build", (w) => { const l = L(w, "build"); l.members.push("judge"); l.bar = bar(); l.stops.unshift({ kind: "bar-passed" }); });
run("A1b same, without adding the judge (control: should be held)", "debate-then-build", (w) => { const l = L(w, "build"); l.bar = bar(); l.stops.unshift({ kind: "bar-passed" }); });
run("A1c judge added to members only", "debate-then-build", (w) => { L(w, "build").members.push("judge"); });
run("A2 judge added to grind's members + bar + bar-passed", "fresh-grind-rare-judge", (w) => { const l = L(w, "grind"); l.members.push("judge"); l.bar = bar(); l.stops.unshift({ kind: "bar-passed" }); });
run("A3 critic added to grind + bar + bar-passed", "glyph-vocabulary", (w) => { const l = L(w, "grind"); l.members.push("critic"); l.bar = bar(); l.stops.unshift({ kind: "bar-passed" }); });
run("A4 new loop, same back edge, with the judge among members", "debate-then-build", (w) => { w.loops.push({ id: "build-2", name: "Build 2", members: ["builder", "tests", "judge"], back: ["e-tests-fail"], bar: bar(), stops: [{ kind: "bar-passed" }, { kind: "max-iterations", n: 3 }] }); });
// B. evidence replaced while the target is made a critic
run("B1 retro made critic, evidence on pass edge replaced", "retrospective-rewrite", (w) => { N(w, "retro").role = "critic"; E(w, "e-tests-retro").evidence = ["a one-line summary"]; });
run("B1b evidence replaced only (control)", "retrospective-rewrite", (w) => { E(w, "e-tests-retro").evidence = ["a one-line summary"]; });
run("B2 builder made critic, fail evidence replaced", "grind-loop", (w) => { N(w, "builder").role = "critic"; E(w, "e-tests-fail").evidence = ["nothing much"]; });
// D. edges out of a halting stop
run("D1 new cap leads to halt stop, halt stop leads to success", "wrap-up-after-the-cap", (w) => { w.edges.push({ id: "e-ho-green", from: "handed-over", to: "green" }); });
// E. edge into the check removed / conditional
run("E1 edge into check removed", "grind-loop", (w) => { w.edges = w.edges.filter((e) => e.id !== "e-builder-tests"); });
run("E2 edge into check conditional", "grind-loop", (w) => { E(w, "e-builder-tests").when = { verdict: "wants-tests" }; });
// F. mode
run("F1 mode judgment + bar on critic loop->grind", "metric-sandwich", (w) => { L(w, "sandwich").mode = "grind"; });
run("F2 grind loop mode judgment (needs bar)", "grind-loop", (w) => { L(w, "grind").mode = "judgment"; L(w, "grind").bar = bar(); });
// H. other stops with then
run("H1 diminishing-returns then done", "grind-loop", (w) => { L(w, "grind").stops.unshift({ kind: "diminishing-returns", rounds: 1, then: "done" }); });
run("H2 human stop then done", "grind-loop", (w) => { L(w, "grind").stops.unshift({ kind: "human", every: 1, then: "done" }); });
run("H3 cap now leads on to done", "grind-loop", (w) => { L(w, "grind").stops.find((s) => s.kind === "max-iterations").then = "done"; });
run("H4 bar-passed then:done made explicit on a loop with check+critic (honest?)", "metric-sandwich", (w) => { L(w, "sandwich").stops.find((s) => s.kind === "bar-passed").then = "done"; });
run("H5 evidence-invalid then done", "grind-loop", (w) => { L(w, "grind").stops.unshift({ kind: "evidence-invalid", rounds: 1, then: "done" }); });
