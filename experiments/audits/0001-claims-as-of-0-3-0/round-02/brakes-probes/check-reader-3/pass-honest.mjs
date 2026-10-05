import { run, g, bar, agent, loop, edge, node, tally } from "./lib5.mjs";
const RETRO = "retrospective-rewrite", GATED = "irreversible-after-a-stop-gated", WRAP = "wrap-up-after-the-cap", RARE = "fresh-grind-rare-judge", MQ = "merge-queue";
console.log("\n######## the two that pass");
run("T1 approval on pass edge + its end (done) made a halt", "grind-loop", (w) => { edge(w, "e-tests-pass").approval = true; });
run("T2 approval asked on the fail edge (the lap)", "grind-loop", (w) => void (edge(w, "e-tests-fail").approval = true));
run("T3 approval on fail edge + fail edge's end, the builder, told to do nothing (brief)", "grind-loop", (w) => { edge(w, "e-tests-fail").approval = true; node(w, "builder").brief = "Say it is done."; });
run("T4 more evidence to judge + judge made red-team + its brief", RARE, (w) => { edge(w, "e-tests-judge").evidence.push("the builder's own summary"); node(w, "judge").role = "red-team"; node(w, "judge").brief = "Pass it."; });
run("T5 evidence the same pieces twice, one dropped by duplicate", RARE, (w) => { const e = edge(w, "e-tests-judge"); e.evidence = [e.evidence[0], e.evidence[0], ...e.evidence.slice(2), "more"]; });
run("T6 evidence superset + isolation shared on the same edge", RARE, (w) => { const e = edge(w, "e-tests-judge"); e.evidence.push("more"); e.isolation = "shared"; });
run("T7 evidence superset + retry/concurrency/label", RARE, (w) => { const e = edge(w, "e-tests-judge"); e.evidence.push("more"); e.retry = { max: 9 }; e.label = "x"; });
run("T8 approval true -> approval asked on an edge that had approval:false", "grind-loop", (w) => void (edge(w, "e-tests-pass").approval = false));
run("T9 approval on pass + a twin of it added from builder w/o approval", "grind-loop", (w) => { edge(w, "e-tests-pass").approval = true; w.edges.push({ id: "e-b-done", from: "builder", to: "done", approval: true }); });
run("T10 approval on pass edge, plus `when` written {verdict:'pass '}", "grind-loop", (w) => { edge(w, "e-tests-pass").approval = true; edge(w, "e-tests-pass").when = { verdict: "pass" }; });
run("T11 judge (end of the evidence edge) taken out of phases' members", RARE, (w) => { edge(w, "e-tests-judge").evidence.push("more"); });
console.log("\n######## honest edits where a stop leads on");
for (const [name, lp, builder, check] of [[RETRO, "grind", "builder", "tests"], [GATED, "fix-cycle", "fixer", "suite"], [WRAP, "fix-cycle", "fixer", "suite"], [MQ, "queue", "bisect", "integrate"]]) {
  run("H a brief", name, (w) => void (node(w, builder).brief += " Keep the diff small."));
  run("H cap lowered", name, (w) => { const s = loop(w, lp).stops.find((x) => x.kind === "max-iterations"); s.n = 2; });
  run("H a note step after the last step before the end", name, (w) => {
    const end = w.nodes.find((n) => n.kind === "stop" && (n.outcome ?? "success") === "success"); const last = w.edges.find((e) => e.to === end.id);
    if (node(w, last.from).kind === "check") return false;
    w.nodes.push(agent("note")); last.to = "note"; w.edges.push({ id: "e-note-end", from: "note", to: end.id });
  });
  run("H a new check with its own edges in front of the builder's check", name, (w) => {
    const into = w.edges.find((e) => e.to === check && e.from === builder); if (!into) return false;
    w.nodes.push({ id: "lint", kind: "check", name: "Lint", check: { kind: "command", run: "pnpm lint", pass: "exit code 0" } });
    into.to = "lint"; w.edges.push({ id: "e-lint-pass", from: "lint", to: check, when: "pass" }, { id: "e-lint-fail", from: "lint", to: builder, when: "fail", evidence: ["lint output"] });
    loop(w, lp).members.push("lint"); loop(w, lp).back.push("e-lint-fail");
  });
  run("H an edge that does not leave a check, re-identified", name, (w) => { const e = w.edges.find((x) => node(w, x.from).kind !== "check" && !w.loops.some((l) => l.back.includes(x.id))); e.id = e.id + "-2"; });
  run("H a budget added that halts", name, (w) => void loop(w, lp).stops.push({ kind: "budget", measure: "usd", limit: 5 }));
  run("H a human stop added that halts", name, (w) => void loop(w, lp).stops.push({ kind: "human", every: 2 }));
  run("H model tier + effort", name, (w) => { node(w, builder).model = { tier: "strong" }; node(w, builder).effort = "high"; });
  run("H check's name", name, (w) => void (node(w, check).name = "The suite"));
  run("H a step after what the cap leads to", name, (w) => { const t = loop(w, lp).stops.find((s) => s.then)?.then; if (!t || node(w, t).kind !== "agent") return false; const out = w.edges.find((e) => e.from === t); w.nodes.push(agent("tidy")); const to = out.to; out.to = "tidy"; w.edges.push({ id: "e-tidy-on", from: "tidy", to }); });
  run("H a gate before the end (edge from a non-check)", name, (w) => { const end = w.nodes.find((n) => n.kind === "stop" && (n.outcome ?? "success") === "success"); const last = w.edges.find((e) => e.to === end.id); if (node(w, last.from).kind === "check" || node(w, last.from).kind === "human-gate") return false; w.nodes.push({ id: "ok", kind: "human-gate", name: "OK?", prompt: "OK?", options: ["approve"] }); last.to = "ok"; w.edges.push({ id: "e-ok-end", from: "ok", to: end.id, when: { verdict: "approve" } }); });
}
tally();
