import { run, bar, E, L, N, agent, g, core, errorsOf } from "./lib4.mjs";
// halt stop reached only by an escalating cap, with an edge out of it to success
run("D2 cap leads to NEW halt stop; halt stop has an edge to done", "grind-loop", (w) => { w.nodes.push({ id: "gave-up", kind: "stop", name: "Gave up", outcome: "halt" }); L(w, "grind").stops.find((s) => s.kind === "max-iterations").then = "gave-up"; w.edges.push({ id: "e-gave-up-done", from: "gave-up", to: "done" }); });
run("D3 same with cap lowered to 1", "grind-loop", (w) => { w.nodes.push({ id: "gave-up", kind: "stop", name: "Gave up", outcome: "halt" }); Object.assign(L(w, "grind").stops.find((s) => s.kind === "max-iterations"), { n: 1, then: "gave-up" }); w.edges.push({ id: "e-gave-up-done", from: "gave-up", to: "done" }); });
run("D4 a new tighter cap of 1 that leads to a new halt stop with an edge to done (old cap kept)", "grind-loop", (w) => { w.nodes.push({ id: "gave-up", kind: "stop", name: "Gave up", outcome: "halt" }); L(w, "grind").stops.unshift({ kind: "max-iterations", n: 1, then: "gave-up" }); w.edges.push({ id: "e-gave-up-done", from: "gave-up", to: "done" }); });
// cap that already leads on, lowered
run("G1 cap that leads on to what the pass led to, lowered to 1", "retrospective-rewrite", (w) => { L(w, "grind").stops.find((s) => s.kind === "max-iterations").n = 1; });
run("G2 cap that leads on to the gate, lowered to 1", "irreversible-after-a-stop-gated", (w) => { L(w, "fix-cycle").stops.find((s) => s.kind === "max-iterations").n = 1; });
// B variants
run("B3 control: fail evidence replaced only", "grind-loop", (w) => { E(w, "e-tests-fail").evidence = ["nothing much"]; });
run("B4 builder made critic only", "grind-loop", (w) => { N(w, "builder").role = "critic"; });
run("B5 pass edge to a NEW critic? (edge moved) evidence", "grind-loop", (w) => { E(w, "e-tests-pass").evidence = ["x"]; });
// A variants: critic from elsewhere, the stop with then
run("A5 judge added + bar + bar-passed then done", "debate-then-build", (w) => { const l = L(w, "build"); l.members.push("judge"); l.bar = bar(); l.stops.unshift({ kind: "bar-passed", then: "done" }); });
run("A6 judge added + bar only (no bar-passed)", "debate-then-build", (w) => { const l = L(w, "build"); l.members.push("judge"); l.bar = bar(); });
run("A7 judge added + mode judgment + bar", "debate-then-build", (w) => { const l = L(w, "build"); l.members.push("judge"); l.bar = bar(); l.mode = "judgment"; l.stops.unshift({ kind: "bar-passed" }); });
// a critic-less check loop in a graph whose only critic is behind it
run("A8 investigator added to a new loop? n/a", "patrol-pulse", (w) => false);
// new loop that holds only the builder and a self edge
run("J1 new loop [builder,tests] same back, bar, bar-passed, NO critic (control)", "grind-loop", (w) => { w.loops.push({ id: "g2", name: "G2", members: ["builder", "tests"], back: ["e-tests-fail"], bar: bar(), stops: [{ kind: "bar-passed" }, { kind: "max-iterations", n: 3 }] }); });
run("J2 new loop [builder] with a self edge, bar, bar-passed (no then)", "grind-loop", (w) => { w.edges.push({ id: "e-self", from: "builder", to: "builder", when: { verdict: "again" } }); w.loops.push({ id: "g2", name: "G2", members: ["builder"], back: ["e-self"], bar: bar(), stops: [{ kind: "bar-passed" }, { kind: "max-iterations", n: 3 }] }); });
run("J3 new loop [builder, NEW critic] bar-passed (no then); critic pass -> tests", "grind-loop", (w) => { w.nodes.push({ ...agent("stamp", "critic"), allow: ["read-files"] }); w.edges.push({ id: "e-b-stamp", from: "builder", to: "stamp" }, { id: "e-stamp-fail", from: "stamp", to: "builder", when: "fail" }, { id: "e-stamp-pass", from: "stamp", to: "tests", when: "pass" }); w.edges = w.edges.filter((e) => e.id !== "e-builder-tests"); w.loops.push({ id: "g2", name: "G2", members: ["builder", "stamp"], back: ["e-stamp-fail"], bar: bar(), stops: [{ kind: "bar-passed" }, { kind: "max-iterations", n: 3 }] }); });
// check taken out of loop members
run("K1 check removed from loop members + bar etc", "grind-loop", (w) => { const l = L(w, "grind"); l.members = ["builder"]; });
// a human gate between
run("M1 honest: human gate between pass and done", "grind-loop", (w) => { w.nodes.push({ id: "ok", kind: "human-gate", name: "OK?", prompt: "Ship?", options: ["approve", "reject"] }); E(w, "e-tests-pass").to = "ok"; w.edges.push({ id: "e-ok-done", from: "ok", to: "done", when: { verdict: "approve" } }, { id: "e-ok-back", from: "ok", to: "builder", when: { verdict: "reject" } }); });
