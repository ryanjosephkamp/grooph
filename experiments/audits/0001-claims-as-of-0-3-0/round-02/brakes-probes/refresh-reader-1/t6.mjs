import { placed, newer, show, N, E, L, tpl, values, host, placeSubgrooph, agent, errs, refreshSubgrooph, validate, canonicalize } from "./h.mjs";
let r;
const ex = (t) => Object.fromEntries((t.template.slots ?? []).map((s) => [s.key, s.example]));

// 12a. host's own policy whose id begins with the group's prefix; SAME template version
{
  const h = host();
  h.policies = [{ id: "review-cap", kind: "concurrency-cap", scope: "graph", params: { max: 2 } }, { id: "review-evidence", kind: "evidence-required", scope: "graph" }, { id: "review-propose-only", kind: "no-live-graph-rewrite", scope: "graph" }];
  let before; try { before = placeSubgrooph(h, tpl(), { as: "review", values, after: "plan", then: "release" }).doc; } catch (e) { console.log("place throws:", e.message); }
  if (before) { r = show("12a host policies named review-* (placed after they existed); refresh from the SAME version", before, tpl()); console.log("  policies after:", r.doc.policies.map((p) => p.id)); }
}
// 12b. two subgroophs, ids 'review-two' placed first then 'review'; refresh 'review' from the same version
{
  let d = placeSubgrooph(host(), tpl(), { as: "review-two", values, after: "plan", then: "release" }).doc;
  d = placeSubgrooph(d, tpl(), { as: "review", values, after: "release", then: "done" }).doc;
  console.log("policies:", d.policies.map((p) => p.id));
  r = show("12b refresh 'review' (same version) when 'review-two' holds the shared policies", d, tpl());
  console.log("  policies after:", r.doc.policies.map((p) => p.id));
  r = show("12b' refresh 'review-two' (same version)", d, tpl(), { group: "review-two" });
  // names that coincide across the two groups?
  const a = refreshSubgrooph(d, "review", newer((t) => { t.policies = []; })).changes.map((c) => c.name);
  const b = refreshSubgrooph(d, "review-two", newer((t) => { t.policies = []; })).changes.map((c) => c.name);
  console.log("  v2 with no policies. names in 'review':", a, "\n  names in 'review-two':", b, "\n  shared names:", a.filter((n) => b.includes(n)));
}
// 12c. person moved a host node into the template's loop (tightened cap); loop no longer 'all inside'
{
  const h = placed(); const loop = L(h, "review-review"); loop.members.push("plan"); loop.stops = [{ kind: "bar-passed" }, { kind: "max-iterations", n: 2 }, { kind: "budget", measure: "dispatches", limit: 6 }];
  r = show("12c template loop gained a host member (person's edit, cap 2); refresh from the SAME version", h, tpl());
  if (r) console.log("  loops:", r.doc.loops.map((l) => `${l.id} cap=${l.stops.find((s) => s.kind === "max-iterations")?.n} members=${l.members}`));
}
// 12d. person took a template node out of the box
{
  const h = placed(); h.groups[0].members = h.groups[0].members.filter((m) => m !== "review-merge-gate");
  r = show("12d gate dragged out of the box (person's edit); refresh from the SAME version", h, tpl());
  if (r) console.log("  nodes:", r.doc.nodes.map((n) => n.id), "\n  edges:", r.doc.edges.map((e) => e.id));
}
// 12e. person's node inside the box under an id with the prefix (a second critic, and a gate)
{
  const h = placed();
  h.nodes.push(agent("review-security", "critic", "SECURITY.md"), { id: "review-signoff", kind: "human-gate", name: "Sign-off", prompt: "OK?" });
  h.edges.push({ id: "e-review-critic-review-security", from: "review-critic", to: "review-security", when: "pass", evidence: ["diff"] }, { id: "e-review-security-review-signoff", from: "review-security", to: "review-signoff", when: "pass" });
  h.groups[0].members.push("review-security", "review-signoff");
  r = show("12e person's nodes inside the box named review-security / review-signoff; SAME version", h, tpl());
}
// 12f. host loop that includes template nodes; template removes one
{
  const h = placed();
  h.edges.push({ id: "e-release-plan", from: "release", to: "plan", when: "fail" });
  h.loops.push({ id: "outer", name: "Outer", members: ["plan", "review-builder", "review-critic", "review-merge-gate", "release"], back: ["e-release-plan"], mode: "grind", stops: [{ kind: "max-iterations", n: 2 }, { kind: "budget", measure: "dispatches", limit: 30 }] });
  console.log("12f before:", errs(h));
  r = show("12f host loop over the box; template renames critic (derived ids)", h, newer((t) => {
    t.nodes.find((n) => n.id === "critic").id = "checker";
    t.edges = [
      { id: "e-builder-checker", from: "builder", to: "checker", evidence: t.edges[0].evidence },
      { id: "e-checker-builder", from: "checker", to: "builder", when: "fail", evidence: ["REVIEW.md"] },
      { id: "e-checker-merge-gate", from: "checker", to: "merge-gate", when: "pass" },
      { id: "e-merge-gate-done", from: "merge-gate", to: "done", when: "pass" },
      { id: "e-merge-gate-reject", from: "merge-gate", to: "builder", when: "fail", evidence: ["the human's feedback"] },
    ];
    t.loops[0].members = ["builder", "checker", "merge-gate"]; t.loops[0].back = ["e-checker-builder", "e-merge-gate-reject"];
  }));
  if (r) console.log("  outer members:", L(r.doc, "outer").members, validate(r.doc).filter((i) => i.severity === "error").map((i) => i.message));
}
