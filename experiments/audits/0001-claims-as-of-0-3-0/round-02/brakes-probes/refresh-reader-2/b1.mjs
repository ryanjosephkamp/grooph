// The partial result: what is written when some changes are held.
import { placed, newer, run, L, N, E, codes, agent } from "./h2.mjs";

// P1: the critic's role change is held; the edge into it is judged as if the role had changed, and applies.
const p1 = run("P1: critic becomes a 'reviewer' (held) and its inbound edge shares context with no evidence (applied)", placed(), newer((t) => {
  t.nodes.find((n) => n.id === "critic").role = { custom: "reviewer" };
  const e = t.edges.find((x) => x.id === "e-builder-critic"); e.isolation = "shared"; delete e.evidence;
}));
console.log("  critic role:", JSON.stringify(N(p1.doc, "review-critic").role), "| edge into it:", JSON.stringify(E(p1.doc, "e-review-builder-review-critic")), "| issues:", codes(p1.doc));

// P1b: validator-clean variant (the isolation policy would catch shared): evidence cut to one piece only.
const p1b = run("P1b: same, evidence cut to one piece, isolation left fresh", placed(), newer((t) => {
  t.nodes.find((n) => n.id === "critic").role = { custom: "reviewer" };
  t.edges.find((x) => x.id === "e-builder-critic").evidence = ["CHANGES.md"];
}));
console.log("  critic role:", JSON.stringify(N(p1b.doc, "review-critic").role), "| edge into it:", JSON.stringify(E(p1b.doc, "e-review-builder-review-critic")), "| issues:", codes(p1b.doc));

// P2: a cap is made to lead to a node that WOULD be a human gate; the kind change waits on another refused change.
const v1 = newer((t) => {
  t.nodes.push(agent("triage", "builder", "TRIAGE.md"));
  t.edges.push({ id: "e-triage-builder", from: "triage", to: "builder" });
}, 1);
const { placeSubgrooph, host, values } = await import("./h2.mjs");
const base = placeSubgrooph(host(), v1, { as: "review", values, after: "plan", then: "release" }).doc;
const v2 = newer((t) => {
  const i = t.nodes.findIndex((n) => n.id === "triage");
  t.nodes[i] = { id: "triage", kind: "human-gate", name: "Triage", prompt: "The cap was hit. Go on?" };
  t.loops[0].stops[1] = { kind: "max-iterations", n: 4, then: "triage" };
  // an unrelated change to the shape that loosens, and is refused
  t.edges.push({ id: "e-critic-done", from: "critic", to: "done", when: { verdict: "trivial" } });
}, 2, v1);
const p2 = run("P2: cap -> 'triage' (to be a gate); the kind change waits on another refusal; the cap's change applies", base, v2);
console.log("  triage is:", N(p2.doc, "review-triage").kind, "| stops:", JSON.stringify(L(p2.doc, "review-review").stops), "| issues:", codes(p2.doc));

// P3: a field of the old kind held on a node whose kind change applies
const before3 = placed();
N(before3, "review-builder").irreversible = ["push to main"];
const p3 = run("P3: a marked agent becomes a check; the marker is held, the kind applies", before3, newer((t) => {
  const i = t.nodes.findIndex((n) => n.id === "builder");
  t.nodes[i] = { id: "builder", kind: "check", name: "Builder", check: { kind: "command", run: "make", pass: "exit 0" } };
}));
console.log("  node:", JSON.stringify(N(p3.doc, "review-builder")));

// P4: `from` held, `when` applied
const p4 = run("P4: e-critic-pass moved to the builder with when always: from is held, when applies", placed(), newer((t) => { Object.assign(t.edges.find((x) => x.id === "e-critic-pass"), { from: "builder", when: "always" }); }));
console.log("  edge:", JSON.stringify(E(p4.doc, "review-e-critic-pass")), "(was when pass)");
