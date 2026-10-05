import { placed, newer, show, N, E, L, tpl, values, host, placeSubgrooph, agent, errs } from "./h.mjs";
let r;
// 4a. bar inspects / name / aspiration / answerKeyFrom
r = show("4a bar.inspects replaced by a file the builder writes, name changed, acceptance same", placed(), newer((t) => { t.loops[0].bar.inspects = [{ kind: "artifact", ref: "CHANGES.md: the builder's own summary" }]; t.loops[0].bar.name = "Looks fine"; }));
console.log("  bar:", JSON.stringify(L(r.doc, "review-review").bar));
r = show("4b bar.answerKeyFrom -> builder (the builder writes the answer key)", placed(), newer((t) => { t.loops[0].bar.answerKeyFrom = "builder"; t.loops[0].bar.inspects = [{ kind: "answer-key", ref: "CHANGES.md" }]; }));
console.log("  bar:", JSON.stringify(L(r.doc, "review-review").bar));
// 4c. mode -> grind, bar kept
r = show("4c mode judgment->grind", placed(), newer((t) => { t.loops[0].mode = "grind"; }));
// 4d. v2: mode grind; v3: bar removed
r = show("4d mode grind + bar removed (one step)", placed(), newer((t) => { t.loops[0].mode = "grind"; delete t.loops[0].bar; t.loops[0].stops = t.loops[0].stops.filter((s) => s.kind !== "bar-passed"); }));
// 4e. acceptance whitespace / same text but slot swapped
r = show("4e acceptance: slot renamed so text now unfilled", placed(), newer((t) => { t.loops[0].bar.acceptance = t.loops[0].bar.acceptance.replace("{{test-command}}", "{{cmd}}"); }));
// 4f. loop replaced: removed and re-added under another id with looser stops
r = show("4f loop renamed with looser stops", placed(), newer((t) => { t.loops[0].id = "review2"; t.loops[0].stops = [{ kind: "bar-passed" }, { kind: "max-iterations", n: 400 }]; }));
console.log("  loops:", r.doc.loops.map((l) => `${l.id}:${JSON.stringify(l.stops)}`));

// 5a. critic role -> custom (no longer critic family)
r = show("5a critic.role -> {custom: reviewer}", placed(), newer((t) => { t.nodes.find((n) => n.id === "critic").role = { custom: "reviewer" }; }));
const afterRole = r.doc;
// 5a2. next version: shared isolation and no evidence on the edge into it
r = show("5a2 then v3: builder->critic shared, evidence gone (critic now custom role)", afterRole, newer((t) => { t.nodes.find((n) => n.id === "critic").role = { custom: "reviewer" }; const e = t.edges.find((e) => e.id === "e-builder-critic"); e.isolation = "shared"; delete e.evidence; }, 3));
console.log("  edge:", JSON.stringify(E(r.doc, "e-review-builder-review-critic")));
// 5a3. both in one version
r = show("5a3 one step: role custom + shared + no evidence", placed(), newer((t) => { t.nodes.find((n) => n.id === "critic").role = { custom: "reviewer" }; const e = t.edges.find((e) => e.id === "e-builder-critic"); e.isolation = "shared"; delete e.evidence; }));
// 5b. evidence reduced but not emptied
r = show("5b evidence reduced to the builder's summary", placed(), newer((t) => { t.edges.find((e) => e.id === "e-builder-critic").evidence = ["CHANGES.md: the builder's summary"]; }));
console.log("  edge:", JSON.stringify(E(r.doc, "e-review-builder-review-critic")));
// 5c. the edge into the critic replaced by one under another id (non-derived), shared
r = show("5c edge into critic replaced under a new id, shared, no evidence", placed(), newer((t) => { const e = t.edges.find((e) => e.id === "e-builder-critic"); e.id = "to-critic"; e.isolation = "shared"; delete e.evidence; }));
console.log("  edges into critic:", JSON.stringify(r.doc.edges.filter((e) => e.to === "review-critic")));
// 5c2. same + critic renamed to a custom role in same step so validator is quiet
r = show("5c2 critic replaced by a new node 'checker' (custom role), shared edge", placed(), newer((t) => {
  const c = t.nodes.find((n) => n.id === "critic"); c.id = "checker"; c.role = { custom: "checker" };
  for (const e of t.edges) { if (e.from === "critic") e.from = "checker"; if (e.to === "critic") e.to = "checker"; }
  const e = t.edges.find((e) => e.id === "e-builder-critic"); e.id = "e-builder-checker"; e.isolation = "shared"; delete e.evidence;
  t.loops[0].members = ["builder", "checker", "merge-gate"];
}));
console.log("  edges into checker:", JSON.stringify(r.doc.edges.filter((e) => e.to === "review-checker")));
// 5d. policy scope / params
r = show("5d critic-isolation scope graph -> node:builder", placed(), newer((t) => { t.policies[0].scope = "node:builder"; }));
r = show("5e critic-isolation gets params", placed(), newer((t) => { t.policies[0].params = { off: true }; }));
r = show("5f no-self-grading removed", placed(), newer((t) => { t.policies = t.policies.filter((p) => p.kind !== "no-self-grading"); }));
console.log("  policies:", r.doc.policies.map((p) => p.id));
r = show("5g critic-isolation policy id renamed (remove+add)", placed(), newer((t) => { t.policies[0].id = "p-iso"; t.policies[0].scope = "node:merge-gate"; }));
console.log("  policies:", JSON.stringify(r.doc.policies));
// 5h. critic inputs + allow widened, deny dropped
r = show("5h critic allow edit-files, deny dropped, inputs add builder's notes", placed(), newer((t) => { const c = t.nodes.find((n) => n.id === "critic"); c.allow.push("edit-files", "run-commands"); delete c.deny; c.inputs.push("CHANGES.md"); c.model = { tier: "fast" }; }));
// 5i. isolation shared on fail edge into builder, and on edge into gate
r = show("5i isolation shared on critic->builder", placed(), newer((t) => { t.edges.find((e) => e.id === "e-critic-fail").isolation = "shared"; }));
