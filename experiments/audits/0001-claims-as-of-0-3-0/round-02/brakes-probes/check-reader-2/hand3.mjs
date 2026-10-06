import { run, bar, E, L, N, agent, g } from "./lib4.mjs";
const rr = g("retrospective-rewrite");
console.log("retrospective-rewrite:", rr.edges.map((e) => `${e.id}:${e.from}->${e.to}${e.when ? "(" + (e.when.verdict ?? e.when) + ")" : ""}`).join("  "), "| stops", JSON.stringify(rr.loops[0].stops));
// (i) a stop already leads on to what the pass led to
run("P1 builder -> NEW success stop on its own word; check untouched", "retrospective-rewrite", (w) => { w.nodes.push({ id: "done-too", kind: "stop", name: "Done too", outcome: "success" }); w.edges.push({ id: "e-builder-done-too", from: "builder", to: "done-too", when: { verdict: "good-enough" } }); });
run("P2 builder -> retro (what pass led to), always", "retrospective-rewrite", (w) => { w.edges.push({ id: "e-builder-retro", from: "builder", to: "retro" }); });
run("P3 builder -> done directly", "retrospective-rewrite", (w) => { w.edges.push({ id: "e-builder-done", from: "builder", to: "done", when: { verdict: "good-enough" } }); });
run("P4 a stop on no progress after 1 round leads on to retro", "retrospective-rewrite", (w) => { L(w, "grind").stops.unshift({ kind: "diminishing-returns", rounds: 1, then: "retro" }); });
run("P5 a stop on no progress leads on to done", "retrospective-rewrite", (w) => { L(w, "grind").stops.unshift({ kind: "diminishing-returns", rounds: 1, then: "done" }); });
run("P6 fixer -> NEW success stop", "wrap-up-after-the-cap", (w) => { w.nodes.push({ id: "done-too", kind: "stop", name: "Done too", outcome: "success" }); w.edges.push({ id: "e-fixer-done-too", from: "fixer", to: "done-too", when: { verdict: "good-enough" } }); });
run("P7 fixer -> land-gate around the suite", "irreversible-after-a-stop-gated", (w) => { w.edges.push({ id: "e-fixer-gate", from: "fixer", to: "land-gate" }); });
run("P8 control on grind-loop: builder -> NEW success stop", "grind-loop", (w) => { w.nodes.push({ id: "done-too", kind: "stop", name: "Done too", outcome: "success" }); w.edges.push({ id: "e-builder-done-too", from: "builder", to: "done-too", when: { verdict: "good-enough" } }); });
// (ii) a second loop over a loop that a check and a critic judge, with a bar of its own
run("Q1 new loop over sandwich's members and back edges, a looser bar, bar-passed", "metric-sandwich", (w) => { const l = L(w, "sandwich"); w.loops.push({ id: "sandwich-2", name: "S2", members: [...l.members], back: [...l.back], bar: bar(), stops: [{ kind: "bar-passed" }, { kind: "max-iterations", n: 2 }] }); });
run("Q2 same on taste-polish", "taste-polish", (w) => { const l = L(w, "polish"); w.loops.push({ id: "polish-2", name: "P2", members: [...l.members], back: [...l.back], bar: bar(), stops: [{ kind: "bar-passed" }, { kind: "max-iterations", n: 2 }] }); });
// --allow carrying
const two = (w) => { N(w, "tests").check.run = "true"; N(w, "plan-check").check.pass = "always"; };
run("R1 two checks changed, one allowed", "ralph-loop", two, ["node:tests.check"]);
const barstop = (w) => { const l = L(w, "grind"); l.bar = bar(); l.stops.unshift({ kind: "bar-passed", then: "done" }); };
run("R2 bar and stop, bar allowed", "grind-loop", barstop, ["loop:grind.bar"]);
run("R3 bar and stop, stops allowed", "grind-loop", barstop, ["loop:grind.stops"]);
run("R4 edge added (allowed) and another removed", "ralph-loop", (w) => { w.edges = w.edges.filter((e) => e.id !== "e-tests-plan-check"); w.edges.push({ id: "e-tests-done", from: "tests", to: "done", when: "pass" }); }, ["edge:e-tests-done"]);
run("R5 stops allowed for a lower cap, carries a raised budget? (same name)", "grind-loop", (w) => { const l = L(w, "grind"); l.stops.find((s) => s.kind === "max-iterations").n = 50; l.stops.unshift({ kind: "bar-passed", then: "done" }); }, ["loop:grind.stops"]);
run("R6 when allowed on the fail edge; to changed too", "grind-loop", (w) => { Object.assign(E(w, "e-tests-fail"), { when: { verdict: "x" }, to: "tests" }); }, ["edge:e-tests-fail.when"]);
// false refusals
run("S1 a label on the check's pass edge", "grind-loop", (w) => { E(w, "e-tests-pass").label = "green"; });
run("S2 when 'pass' written as {verdict:'pass'}", "grind-loop", (w) => { E(w, "e-tests-pass").when = { verdict: "pass" }; });
run("S3 the builder handed one more piece on failure", "grind-loop", (w) => { E(w, "e-tests-fail").evidence.push("the linter's output"); });
run("S4 retry on the fail edge", "grind-loop", (w) => { E(w, "e-tests-fail").retry = { max: 1 }; });
run("S5 a critic put after the check's pass in a new step (edge to moved)", "grind-loop", (w) => { w.nodes.push({ ...agent("review", "critic"), allow: ["read-files", "write-outputs"] }); E(w, "e-tests-pass").to = "review"; w.edges.push({ id: "e-review-done", from: "review", to: "done", when: "pass" }); });
run("S6 check's name and description changed", "grind-loop", (w) => { N(w, "tests").name = "Tests (unit)"; N(w, "tests").description = "The unit suite."; });
run("S7 a lint check added in front (the test's own case)", "grind-loop", (w) => { w.nodes.push({ id: "lint", kind: "check", name: "Lint", check: { kind: "command", run: "pnpm lint", pass: "exit code 0" } }); E(w, "e-builder-tests").from = "lint"; w.edges.push({ id: "e-builder-lint", from: "builder", to: "lint" }, { id: "e-lint-fail", from: "lint", to: "builder", when: "fail" }); L(w, "grind").members.push("lint"); L(w, "grind").back.push("e-lint-fail"); });
run("S8 a new judgment loop elsewhere, away from the check", "debate-then-build", (w) => { L(w, "debate").stops.push({ kind: "diminishing-returns", rounds: 2 }); });
run("S9 approval on the fail (back) edge", "grind-loop", (w) => { E(w, "e-tests-fail").approval = true; });
