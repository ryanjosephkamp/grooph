// Crashes and hangs on odd but schema-valid documents.
import { placed, newer, tpl, values, host, placeSubgrooph, refreshSubgrooph, listGroups, groupContents, parseGraph, canonicalize, TemplateError, schemaOk, pattern, examples, agent, extractGroup } from "./h2.mjs";
const attempt = (title, make, fn) => {
  let doc;
  try { doc = make(); } catch (e) { console.log(`${title}: SETUP THROWS ${e.constructor.name}: ${e.message}`); return; }
  const ok = schemaOk(doc);
  const t0 = Date.now();
  try {
    const r = fn(doc);
    console.log(`${title}: schema-valid=${ok === "ok"} -> ok in ${Date.now() - t0}ms`, r && r.changes ? `changes ${r.changes.length} held ${r.held.length} notes ${JSON.stringify(r.notes)} result schema ${JSON.stringify(schemaOk(r.doc))}` : JSON.stringify(r)?.slice(0, 200));
  } catch (e) {
    console.log(`${title}: schema-valid=${ok === "ok"} -> THROWS ${e instanceof TemplateError ? "TemplateError" : `**${e.constructor.name}**`}: ${String(e.message).slice(0, 220)}`);
  }
};
const v2 = () => newer((t) => { t.nodes[0].brief += " Keep it small."; t.edges.push({ id: "e-critic-done", from: "critic", to: "done", when: { verdict: "trivial" } }); });
const refresh = (doc, g = "review", t = v2()) => refreshSubgrooph(doc, g, t);

attempt("group with no members", () => { const d = placed(); d.groups[0].members = []; return d; }, refresh);
attempt("all its nodes deleted by hand (edges, loops left)", () => { const d = placed(); d.nodes = d.nodes.filter((n) => !n.id.startsWith("review-")); return d; }, refresh);
attempt("all its nodes, edges, loops, policies deleted by hand; group left", () => { const d = placed(); const own = (id) => id.startsWith("review-") || id.includes("review-"); d.nodes = d.nodes.filter((n) => !own(n.id)); d.edges = d.edges.filter((e) => !own(e.from) && !own(e.to)); d.loops = []; d.policies = []; d.groups[0].members = []; return d; }, refresh);
attempt("group cycle (review holds outer, outer holds review)", () => { const d = placed(); d.groups.push({ id: "outer", name: "Outer", members: ["review"] }); d.groups[0].members.push("outer"); return d; }, refresh);
attempt("group that holds itself", () => { const d = placed(); d.groups[0].members.push("review"); return d; }, refresh);
attempt("listGroups on a group cycle", () => { const d = placed(); d.groups.push({ id: "outer", name: "Outer", members: ["review"] }); d.groups[0].members.push("outer"); return d; }, (d) => listGroups(d).map((g) => `${g.id}:${g.nodes}/${g.groups}/${g.inside}`));
attempt("loop with no stops", () => { const d = placed(); d.loops[0].stops = []; return d; }, refresh);
attempt("loop with no members and no back", () => { const d = placed(); d.loops[0].members = []; d.loops[0].back = []; return d; }, refresh);
attempt("edge to a missing node", () => { const d = placed(); d.edges.push({ id: "e-x", from: "review-critic", to: "nowhere" }, { id: "e-y", from: "nowhere", to: "release" }); return d; }, refresh);
attempt("stop.then names a missing node", () => { const d = placed(); d.loops[0].stops.push({ kind: "bar-passed", then: "nowhere" }); return d; }, refresh);
attempt("group member names a missing node", () => { const d = placed(); d.groups[0].members.push("ghost"); return d; }, refresh);
attempt("group.with holds a key the template never had, and a value with {{…}} and an id", () => { const d = placed(); d.groups[0].with = { ...d.groups[0].with, task: "{{checklist}} review-merge-gate", extra: "x" }; return d; }, refresh);
attempt("no `with` at all", () => { const d = placed(); delete d.groups[0].with; return d; }, refresh);
attempt("two edges with the same id out of the gate", () => { const d = placed(); d.edges.push({ ...d.edges.find((e) => e.id === "e-review-merge-gate-release") }); return d; }, refresh);
attempt("duplicate node id", () => { const d = placed(); d.nodes.push({ ...d.nodes.find((n) => n.id === "review-critic") }); return d; }, refresh);
attempt("template with no nodes", () => placed(), (d) => refresh(d, "review", newer((t) => { t.nodes = []; t.edges = []; t.loops = []; t.policies = []; })));
attempt("template that is not a template (no template block)", () => placed(), (d) => refresh(d, "review", newer((t) => { delete t.template; })));
attempt("template whose edge names a missing node", () => placed(), (d) => refresh(d, "review", newer((t) => { t.edges.push({ id: "e-q", from: "critic", to: "ghost" }); })));
attempt("template whose loop stop names a missing node", () => placed(), (d) => refresh(d, "review", newer((t) => { t.loops[0].stops.push({ kind: "bar-passed", then: "ghost" }); })));
attempt("template with two success stops", () => placed(), (d) => refresh(d, "review", newer((t) => { t.nodes.push({ id: "done2", kind: "stop", name: "Done 2" }); t.edges.push({ id: "e-gate-done2", from: "merge-gate", to: "done2", when: { verdict: "approve" } }); })));
attempt("template with its own groups, nested", () => placed(), (d) => refresh(d, "review", newer((t) => { t.groups = [{ id: "inner", name: "Inner", members: ["builder", "critic"] }, { id: "outer", name: "Outer", members: ["inner", "merge-gate"] }]; })));
attempt("from without a version (hand-edited)", () => { const d = placed(); d.groups[0].from = "review-gate"; return d; }, refresh);
attempt("subgrooph nested in a plain group, and a subgrooph inside a subgrooph", () => { const d = placed(); const hg = pattern("human-gated-irreversible"); const d2 = placeSubgrooph(d, hg, { as: "ship", values: examples(hg), after: "release", then: "done" }).doc; d2.groups.find((g) => g.id === "review").members.push("ship"); return d2; }, refresh);
attempt("placing into a graph with a group cycle", () => { const d = host(); d.groups = [{ id: "a", name: "A", members: ["b"] }, { id: "b", name: "B", members: ["a"] }]; return d; }, (d) => { const r = placeSubgrooph(d, tpl(), { as: "review", values, after: "plan", then: "release" }); return { opens: r.opens, dropped: r.dropped }; });
attempt("placing with after === then", () => host(), (d) => { const r = placeSubgrooph(d, tpl(), { as: "review", values, after: "release", then: "release" }); return { opens: r.opens, connected: r.connected }; });
attempt("placing with then = a stop", () => host(), (d) => { const r = placeSubgrooph(d, tpl(), { as: "review", values, after: "plan", then: "done" }); return { opens: r.opens, connected: r.connected }; });
attempt("as = 64+ chars", () => host(), (d) => { const r = placeSubgrooph(d, tpl(), { as: "a".repeat(80), values }); return { members: r.group.members.length, schema: schemaOk(r.doc) }; });
attempt("extractGroup on an empty group", () => { const d = placed(); d.groups[0].members = []; return d; }, (d) => extractGroup(d, "review", { id: "x", title: "x", summary: "x", whenToUse: "x" }));
