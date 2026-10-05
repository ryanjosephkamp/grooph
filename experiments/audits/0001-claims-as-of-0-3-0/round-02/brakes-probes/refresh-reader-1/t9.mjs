import { placed, newer, show, N, E, L, tpl, values, host, placeSubgrooph, agent, errs, refreshSubgrooph, validate, canonicalize, parseGraph } from "./h.mjs";
let r;
// K1: gate kind change held, its other fields apply
r = show("K1 merge-gate becomes an agent (kind held; the other fields?)", placed(), newer((t) => { const i = t.nodes.findIndex((n) => n.id === "merge-gate"); t.nodes[i] = agent("merge-gate", "builder", "MERGED.md", { name: "Merge", brief: "Merge the change." }); }));
if (r) { console.log("  node:", JSON.stringify(N(r.doc, "review-merge-gate"))); const s = parseGraph(JSON.parse(canonicalize(r.doc))); console.log("  schema issues:", s.issues.map((i) => `${i.code} ${i.message}`).slice(0, 4)); }

// P1: person wires their own critic between the template's critic and the gate by re-pointing the template's edge
{
  const h = placed();
  h.nodes.push(agent("security", "critic", "SECURITY.md"));
  E(h, "review-e-critic-pass").to = "security";
  h.edges.push({ id: "e-security-review-merge-gate", from: "security", to: "review-merge-gate", when: "pass" });
  h.groups[0].members.push("security");
  console.log("before:", errs(h));
  r = show("P1 person re-pointed the template's edge to their own node inside the box; refresh from the SAME version", h, tpl());
  if (r) console.log("  edges named review-e-critic-pass:", JSON.stringify(r.doc.edges.filter((e) => e.id === "review-e-critic-pass")));
}
// P2: person's own human gate wired the same way
{
  const h = placed();
  h.nodes.push({ id: "signoff", kind: "human-gate", name: "Sign-off", prompt: "Security sign-off?" });
  E(h, "review-e-critic-pass").to = "signoff";
  h.edges.push({ id: "e-signoff-review-merge-gate", from: "signoff", to: "review-merge-gate", when: "pass" });
  h.groups[0].members.push("signoff");
  r = show("P2 same with a person's gate; SAME version", h, tpl());
}
// P3: person tightened: approval on the template's exit edge + lowered cap + irreversible on builder; newer version changes only a brief
{
  const h = placed(); E(h, "e-review-merge-gate-release").approval = true; L(h, "review-review").stops[1].n = 2; N(h, "review-builder").irreversible = ["push"]; E(h, "e-plan-review-builder").approval = true;
  r = show("P3 person's tightenings vs a newer version that only rewords a brief", h, newer((t) => { t.nodes[0].brief += " z"; }));
  if (r) console.log("  cap:", L(r.doc, "review-review").stops[1].n, "| exit approval:", E(r.doc, "e-review-merge-gate-release").approval, "| irreversible:", N(r.doc, "review-builder").irreversible);
}
// P4: a person's stop added to the loop (human stop) — the template has none
{
  const h = placed(); L(h, "review-review").stops.push({ kind: "human", every: 2 }, { kind: "budget", measure: "minutes", limit: 30 });
  r = show("P4 person added a human stop and a minutes budget; SAME version", h, tpl());
}
// P5: person set adaptation fixed + their own no-live-graph-rewrite policy: untouched?
{
  const h = placed(); h.adaptation = "fixed"; h.policies.push({ id: "propose-only", kind: "no-live-graph-rewrite", scope: "graph" });
  r = show("P5 host adaptation/policy; v2 changes a brief", h, newer((t) => { t.nodes[0].brief += " z"; }));
  if (r) console.log("  adaptation:", r.doc.adaptation, "| policies:", r.doc.policies.map((p) => p.id));
}
