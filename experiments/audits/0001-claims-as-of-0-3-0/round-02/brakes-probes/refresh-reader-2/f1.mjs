// False refusals: honest newer versions.
import { placed, newer, run, agent, codes, L, pattern, examples, placeSubgrooph, host } from "./h2.mjs";

run("F1: a NEW stop where a person is asked every 2 rounds, then back to the builder (none before)", placed(), newer((t) => { t.loops[0].stops.push({ kind: "human", every: 2, then: "builder" }); }));
run("F1b: a NEW human stop with no then", placed(), newer((t) => { t.loops[0].stops.push({ kind: "human", every: 2 }); }));
run("F2: a NEW budget in minutes (none before) that leads to a new wrap-up step; the dispatch budget and the cap stay", placed(), newer((t) => {
  t.nodes.push(agent("wrap", "builder", "WRAP.md")); t.edges.push({ id: "e-wrap-gate", from: "wrap", to: "merge-gate" });
  t.loops[0].stops.push({ kind: "budget", measure: "minutes", limit: 30, then: "wrap" });
}));
run("F2b: a second, LOWER round cap that leads back to the builder, the cap of 4 still halting", placed(), newer((t) => { t.loops[0].stops.push({ kind: "max-iterations", n: 2, then: "critic" }); }));
run("F3: a lint check inserted between builder and critic", placed(), newer((t) => {
  t.nodes.push({ id: "lint", kind: "check", name: "Lint", check: { kind: "command", run: "pnpm lint", pass: "exit 0" } });
  const e = t.edges.find((x) => x.id === "e-builder-critic"); e.id = "e-lint-critic"; e.from = "lint";
  t.edges.push({ id: "e-builder-lint", from: "builder", to: "lint" }, { id: "e-lint-fail", from: "lint", to: "builder", when: "fail" });
  t.loops[0].members = ["builder", "lint", "critic", "merge-gate"]; t.loops[0].back.push("e-lint-fail");
}));
run("F4: a smoke check inserted between the critic and the gate (critic's pass edge re-pointed by `to`)", placed(), newer((t) => {
  t.nodes.push({ id: "smoke", kind: "check", name: "Smoke", check: { kind: "command", run: "pnpm smoke", pass: "exit 0" } });
  t.edges.find((x) => x.id === "e-critic-pass").to = "smoke";
  t.edges.push({ id: "e-smoke-gate", from: "smoke", to: "merge-gate", when: "pass" }, { id: "e-smoke-fail", from: "smoke", to: "builder", when: "fail" });
  t.loops[0].members = ["builder", "critic", "smoke", "merge-gate"]; t.loops[0].back.push("e-smoke-fail");
}));
run("F5: a second critic added beside the first, both must pass before the gate", placed(), newer((t) => {
  t.nodes.push({ ...structuredClone(t.nodes.find((n) => n.id === "critic")), id: "security", name: "Security" });
  t.edges.push({ ...structuredClone(t.edges.find((e) => e.id === "e-builder-critic")), id: "e-builder-security", to: "security" }, { id: "e-security-fail", from: "security", to: "builder", when: "fail" }, { id: "e-security-pass", from: "security", to: "merge-gate", when: "pass" });
  t.loops[0].members.push("security"); t.loops[0].back.push("e-security-fail");
}));
run("F6: a new first step before the builder (a new entry)", placed(), newer((t) => {
  t.nodes.unshift(agent("triage", "planner", "TRIAGE.md")); t.edges.push({ id: "e-triage-builder", from: "triage", to: "builder" });
}));
// F7: host gate before the box + the same new first step
const gated = placed();
gated.nodes.push({ id: "go", kind: "human-gate", name: "Go", prompt: "Start the review?" });
gated.edges = gated.edges.filter((e) => e.id !== "e-plan-review-builder");
gated.edges.push({ id: "e-plan-go", from: "plan", to: "go" }, { id: "e-go-review-builder", from: "go", to: "review-builder", when: "pass" });
run("F7: the same new first step, where the graph has its own gate before the box", gated, newer((t) => {
  t.nodes.unshift(agent("triage", "planner", "TRIAGE.md")); t.edges.push({ id: "e-triage-builder", from: "triage", to: "builder" });
}));
run("F8: the gate gains an answer and an edge for it back to the builder", placed(), newer((t) => {
  t.nodes.find((n) => n.id === "merge-gate").options.push("needs more tests");
  t.edges.push({ id: "e-merge-gate-tests", from: "merge-gate", to: "builder", when: { verdict: "needs more tests" } }); t.loops[0].back.push("e-merge-gate-tests");
}));
run("F9: cap lowered 4 -> 3, budget lowered, acceptance untouched, brief reworded", placed(), newer((t) => { t.loops[0].stops[1].n = 3; t.loops[0].stops[2].limit = 8; t.nodes[0].brief += " Keep it small."; }));
