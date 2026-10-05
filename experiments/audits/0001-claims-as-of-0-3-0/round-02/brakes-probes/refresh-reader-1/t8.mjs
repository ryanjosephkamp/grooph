import { placed, newer, show, N, E, L, tpl, values, host, placeSubgrooph, agent, errs, refreshSubgrooph, validate, canonicalize, parseGraph } from "./h.mjs";
let r;
const noThen = () => placed({ after: "plan" });

// critic removed altogether
r = show("5j critic node removed; builder leads straight to the gate", placed(), newer((t) => {
  t.nodes = t.nodes.filter((n) => n.id !== "critic");
  t.edges = [ { id: "e-builder-merge-gate", from: "builder", to: "merge-gate" }, t.edges.find((e) => e.id === "e-merge-gate-done"), t.edges.find((e) => e.id === "e-merge-gate-reject") ];
  t.loops[0].members = ["builder", "merge-gate"]; t.loops[0].back = ["e-merge-gate-reject"];
}));
if (r) console.log("  nodes:", r.doc.nodes.map((n) => n.id));

// critic kept but cut out of the path by a field re-point (non-derived id)
r = show("5k e-critic-pass.from: critic -> builder, when always (critic no longer decides)", placed(), newer((t) => { const e = t.edges.find((e) => e.id === "e-critic-pass"); e.from = "builder"; e.when = "always"; }));
if (r) console.log("  edge:", JSON.stringify(E(r.doc, "review-e-critic-pass")));

// a tightening: a check inserted between the gate and the end
r = show("T1 tightening: a second gate inserted after the merge gate (then placement)", placed(), newer((t) => {
  t.nodes.push({ id: "release-gate", kind: "human-gate", name: "Release approval", prompt: "Release it?" });
  t.edges = t.edges.filter((e) => e.id !== "e-merge-gate-done");
  t.edges.push({ id: "e-merge-gate-release-gate", from: "merge-gate", to: "release-gate", when: "pass" }, { id: "e-release-gate-done", from: "release-gate", to: "done", when: "pass" });
}));
if (r) console.log("  ways into release:", r.doc.edges.filter((e) => e.to === "release").map((e) => `${e.id}(${e.from})`));
r = show("T2 tightening: a tests check inserted after the merge gate (then placement)", placed(), newer((t) => {
  t.nodes.push({ id: "smoke", kind: "check", name: "Smoke", check: { kind: "tests", run: "pnpm test", pass: "exit 0" } });
  t.edges = t.edges.filter((e) => e.id !== "e-merge-gate-done");
  t.edges.push({ id: "e-merge-gate-smoke", from: "merge-gate", to: "smoke", when: "pass" }, { id: "e-smoke-done", from: "smoke", to: "done", when: "pass" });
}));
if (r) console.log("  ways into release:", r.doc.edges.filter((e) => e.to === "release").map((e) => `${e.id}(${e.from})`));
{
  const t2 = newer((t) => {
    t.nodes.push({ id: "smoke", kind: "check", name: "Smoke", check: { kind: "tests", run: "pnpm test", pass: "exit 0" } });
    t.edges = t.edges.filter((e) => e.id !== "e-merge-gate-done");
    t.edges.push({ id: "e-merge-gate-smoke", from: "merge-gate", to: "smoke", when: "pass" }, { id: "e-smoke-done", from: "smoke", to: "done", when: "pass" });
  });
  r = show("T2 allowed by name", placed(), t2, { allow: ["edge:e-review-smoke-release"] });
  if (r) console.log("  ways into release:", r.doc.edges.filter((e) => e.to === "release").map((e) => `${e.id}(${e.from})`));
  // v3 after that: bypass now unflagged because release has an ungated way in
  r = show("T3 then v3 adds critic -> done; release now has an ungated way in", r.doc, newer((t) => {
    t.nodes.push({ id: "smoke", kind: "check", name: "Smoke", check: { kind: "tests", run: "pnpm test", pass: "exit 0" } });
    t.edges = t.edges.filter((e) => e.id !== "e-merge-gate-done");
    t.edges.push({ id: "e-merge-gate-smoke", from: "merge-gate", to: "smoke", when: "pass" }, { id: "e-smoke-done", from: "smoke", to: "done", when: "pass" });
    t.edges.push({ id: "e-critic-done", from: "critic", to: "done", when: { verdict: "trivial" } });
  }, 3));
}
// stop renamed / added, no --then placement
r = show("S1 no --then: success stop renamed done -> finished", noThen(), newer((t) => { t.nodes.find((n) => n.id === "done").id = "finished"; t.edges.find((e) => e.id === "e-merge-gate-done").to = "finished"; t.edges.find((e) => e.id === "e-merge-gate-done").id = "e-merge-gate-finished"; }));
if (r) console.log("  stops:", r.doc.nodes.filter((n) => n.kind === "stop").map((n) => n.id), "| edges from gate:", r.doc.edges.filter((e) => e.from === "review-merge-gate").map((e) => `${e.id}->${e.to}`));
// new stop when a person's own exit exists
{
  const h = noThen(); h.nodes.push(agent("audit", "synthesizer", "AUDIT.md", { irreversible: ["publish"] })); h.nodes.push({ id: "audit-ok", kind: "human-gate", name: "ok?", prompt: "ok?" });
  h.edges.push({ id: "e-review-merge-gate-audit-ok", from: "review-merge-gate", to: "audit-ok", when: "pass" }, { id: "e-audit-ok-audit", from: "audit-ok", to: "audit", when: "pass" });
  console.log("before:", errs(h));
  r = show("S2 no --then, person's exit gate->audit-ok; v2 adds a second success stop 'shipped' reached from critic", h, newer((t) => { t.nodes.push({ id: "shipped", kind: "stop", name: "Shipped", outcome: "success" }); t.edges.push({ id: "e-critic-shipped", from: "critic", to: "shipped", when: { verdict: "trivial" } }); }));
  if (r) console.log("  new edges:", r.doc.edges.filter((e) => e.from === "review-critic").map((e) => `${e.id}->${e.to}`));
}
