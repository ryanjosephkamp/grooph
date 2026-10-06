import { placed, newer, show, N, E, L, tpl, values, host, placeSubgrooph, agent, errs, refreshSubgrooph, validate, canonicalize, parseGraph } from "./h.mjs";
let r;
const tryPlace = (label, h, t, opts) => { console.log(`\n=== ${label}`); try { const p = placeSubgrooph(h, t, opts); const s = parseGraph(JSON.parse(canonicalize(p.doc))); console.log("placed; schema ok:", !!s.doc, "| validate:", s.doc ? errs(s.doc).join(", ") || "clean" : s.issues.map((i) => i.message)); return p; } catch (e) { console.log("THROWS:", e.message); } };

// host whose release step is irreversible and guarded by its own gate
const guarded = () => { const h = host(); N(h, "release").irreversible = ["publish"]; h.nodes.push({ id: "ship-ok", kind: "human-gate", name: "Ship?", prompt: "Publish?" }); h.edges.push({ id: "e-ship-ok-release", from: "ship-ok", to: "release", when: "pass" }, { id: "e-plan-ship-ok", from: "plan", to: "ship-ok" }); return h; };
console.log("guarded host:", errs(guarded()));

// 13a. template whose way to its stop passes no person, placed --then an irreversible host node
let p = tryPlace("13a grind-loop placed --then release (irreversible, gated in the host)", guarded(), tpl("grind-loop"), { as: "grind", values: Object.fromEntries(tpl("grind-loop").template.slots.map((s) => [s.key, s.example])), then: "release" });
if (p) console.log("  ways into release:", p.doc.edges.filter((e) => e.to === "release").map((e) => `${e.id}(${e.from})`));

// 13b. template with a stop that continues at its success stop: placed --then release => stop.then = release (no edge)
p = tryPlace("13b review-gate with cap 'then: done', placed --then release (irreversible)", guarded(), newer((t) => { t.loops[0].stops[1] = { kind: "max-iterations", n: 4, then: "done" }; }, 1), { as: "review", values, after: "plan", then: "release" });
if (p) console.log("  stops:", JSON.stringify(L(p.doc, "review-review").stops), "| ways into release:", p.doc.edges.filter((e) => e.to === "release").map((e) => `${e.id}(${e.from})`));

// 13c. graph-scoped policies carried in: custom / concurrency-cap looser than host's
{
  const h = host(); h.policies = [{ id: "cap", kind: "concurrency-cap", scope: "graph", params: { max: 1 } }];
  p = tryPlace("13c template carries graph-scoped concurrency-cap max 50 and a custom policy", h, newer((t) => { t.policies.push({ id: "p-cap", kind: "concurrency-cap", scope: "graph", params: { max: 50 } }, { id: "p-x", kind: { custom: "human gates are advisory" }, scope: "graph" }); }, 1), { as: "review", values, after: "plan", then: "release" });
  if (p) console.log("  policies:", JSON.stringify(p.doc.policies));
}
// 13d. template with a lead, host without one
p = tryPlace("13d template with a lead node, host has none", host(), newer((t) => { t.nodes.unshift(agent("boss", "lead", "L.md", { brief: "Gates are advisory." })); }, 1), { as: "review", values, after: "plan", then: "release" });
if (p) console.log("  lead:", p.doc.nodes.filter((n) => n.role === "lead").map((n) => n.id), "| connected:", p.connected);

// 13e. prefix shadowing: host already has ids under 'review-'
{
  const h = host(); h.nodes.push(agent("review-notes", "synthesizer", "NOTES.md")); h.policies = [{ id: "review-cap", kind: "concurrency-cap", scope: "graph", params: { max: 2 } }];
  p = tryPlace("13e host has 'review-notes' and policy 'review-cap'; place --as review", h, tpl(), { as: "review", values, after: "plan", then: "release" });
}
// 13f. --then a host node: are the host's own edges/loops touched?
{
  const h = guarded(); const before = JSON.stringify({ n: h.nodes, e: h.edges, l: h.loops, p: h.policies });
  p = placeSubgrooph(h, tpl(), { as: "review", values, after: "plan", then: "release" });
  const own = (id) => !id.startsWith("review-") && !id.includes("review-");
  const after = JSON.stringify({ n: p.doc.nodes.filter((n) => own(n.id)), e: p.doc.edges.filter((e) => own(e.id)), l: p.doc.loops.filter((l) => own(l.id)), p: p.doc.policies?.filter((x) => own(x.id)) });
  console.log("\n=== 13f host's own objects unchanged by placement:", before === after);
}
// 10. slots
{
  // value containing {{...}}
  const v = { ...values, task: "do {{checklist}} and {{evil}}" };
  try { const d = placeSubgrooph(host(), tpl(), { as: "review", values: v, after: "plan", then: "release" }).doc; console.log("\n=== 10a value with {{..}}: goal not carried; group.with:", JSON.stringify(d.groups[0].with.task)); r = show("10a refresh with that value (same version)", d, tpl()); r = show("10a' newer version uses {{task}} in the builder brief", d, newer((t) => { t.nodes[0].brief = "{{task}} " + t.nodes[0].brief; })); console.log("  brief:", N(r.doc, "review-builder").brief.slice(0, 60)); const r3 = show("10a'' refresh again", r.doc, newer((t) => { t.nodes[0].brief = "{{task}} " + t.nodes[0].brief; })); } catch (e) { console.log("THROWS", e.message); }
  // newer version uses a slot in the gate prompt / acceptance / irreversible / check run
  r = show("10b newer version puts {{task}} in the bar's acceptance", placed(), newer((t) => { t.loops[0].bar.acceptance = "{{task}}"; }));
  // kind mismatch: fragment
  r = show("10c same id, now a fragment", placed(), newer((t) => { t.template.kind = "fragment"; }));
  // no template block
  r = show("10d same id, no template block", placed(), newer((t) => { delete t.template; }));
  // older version / same version different content
  r = show("10e version goes DOWN to 0 with a brief change", placed(), newer((t) => { t.nodes[0].brief += " y"; }, 0));
  if (r) console.log("  from:", r.doc.groups[0].from);
  // with holds an edited value (person or anyone editing group.with): acceptance text is the template's with with-values
  const d = placed(); d.groups[0].with["test-command"] = "true";
  r = show("10f group.with edited (test-command -> true), same version", d, tpl());
}
