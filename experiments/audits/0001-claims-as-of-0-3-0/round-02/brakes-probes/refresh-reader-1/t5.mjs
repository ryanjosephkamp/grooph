import { placed, newer, show, N, E, L, tpl, values, host, placeSubgrooph, agent, errs, refreshSubgrooph, validate } from "./h.mjs";
let r;
const ex = (t) => Object.fromEntries((t.template.slots ?? []).map((s) => [s.key, s.example]));

// 8g-clean: host gate before the box, entry node renamed, every edge re-made under derived ids => validates clean?
{
  const h = placed();
  h.nodes.push({ id: "go", kind: "human-gate", name: "Go?", prompt: "Start the build?" });
  h.edges = h.edges.filter((e) => e.id !== "e-plan-review-builder");
  h.edges.push({ id: "e-plan-go", from: "plan", to: "go" }, { id: "e-go-review-builder", from: "go", to: "review-builder", when: "pass" });
  console.log("before:", errs(h));
  r = show("8g-clean host gate before the box; builder renamed, edges re-made", h, newer((t) => {
    t.nodes.find((n) => n.id === "builder").id = "implementer";
    t.edges = [
      { id: "e-implementer-critic", from: "implementer", to: "critic", evidence: t.edges[0].evidence },
      { id: "e-critic-implementer", from: "critic", to: "implementer", when: "fail", evidence: ["REVIEW.md"] },
      { id: "e-critic-pass", from: "critic", to: "merge-gate", when: "pass" },
      { id: "e-merge-gate-done", from: "merge-gate", to: "done", when: "pass" },
      { id: "e-merge-gate-implementer", from: "merge-gate", to: "implementer", when: "fail", evidence: ["the human's feedback"] },
    ];
    t.loops[0].members = ["implementer", "critic", "merge-gate"]; t.loops[0].back = ["e-critic-implementer", "e-merge-gate-implementer"];
  }));
  if (r) console.log("  ways into implementer (non-back):", r.doc.edges.filter((e) => e.to === "review-implementer").map((e) => `${e.id}`), "| edges from host gate 'go':", r.doc.edges.filter((e) => e.from === "go").map((e) => e.id));
}

// 1f. spec-then-loop: gate leads into a loop member; add planner -> builder directly
{
  const stl = tpl("spec-then-loop");
  const h0 = host(); h0.nodes = h0.nodes.filter((n) => n.id !== "plan"); h0.edges = h0.edges.filter((e) => e.from !== "plan" && e.to !== "plan");
  const before = placeSubgrooph(h0, stl, { as: "spec", values: ex(stl), then: "release" }).doc;
  console.log("spec placed:", before.edges.map((e) => `${e.id}:${e.from}->${e.to}`), errs(before));
  r = show("1f spec-then-loop: add planner -> builder (around spec-gate)", before, newer((t) => { t.edges.push({ id: "e-planner-builder", from: "planner", to: "builder" }); }, 99, stl), { group: "spec" });
  if (r) console.log("  ways into spec-builder:", r.doc.edges.filter((e) => e.to === "spec-builder").map((e) => `${e.id}(${e.from})`));
  r = show("1f' spec-then-loop: gate dropped from the path: e-planner-spec-gate removed, planner -> builder added", before, newer((t) => { t.edges = t.edges.filter((e) => e.id !== "e-planner-spec-gate"); t.edges.push({ id: "e-planner-builder", from: "planner", to: "builder" }); }, 99, stl), { group: "spec" });
  if (r) console.log("  ways into spec-gate:", r.doc.edges.filter((e) => e.to === "spec-spec-gate").map((e) => e.id));
}

// 9. shape waits, a field that depends on it applies
r = show("9a gate removal held (shape waits) while stops.then -> a new node applies", placed(), newer((t) => {
  t.nodes = t.nodes.filter((n) => n.id !== "merge-gate");
  t.edges = t.edges.filter((e) => e.from !== "merge-gate" && e.to !== "merge-gate");
  t.loops[0].members = ["builder", "critic"]; t.loops[0].back = ["e-critic-fail"];
  t.nodes.push(agent("wrap", "synthesizer", "WRAP.md"));
  t.edges.push({ id: "e-wrap-done", from: "wrap", to: "done" });
  t.loops[0].stops = [{ kind: "bar-passed", then: "wrap" }, { kind: "max-iterations", n: 4 }, { kind: "budget", measure: "dispatches", limit: 10 }];
}));
if (r) console.log("  stops:", JSON.stringify(L(r.doc, "review-review").stops), "| has review-wrap:", !!N(r.doc, "review-wrap"));

r = show("9b stops held (cap raised), shape applies: node the held stop continues at is removed", (() => { const t0 = newer((t) => { t.nodes.push(agent("wrap", "synthesizer", "WRAP.md")); t.edges.push({ id: "e-wrap-done", from: "wrap", to: "done" }); t.loops[0].stops[1] = { kind: "max-iterations", n: 4, then: "wrap" }; }, 1); return placeSubgrooph(host(), t0, { as: "review", values, after: "plan", then: "release" }).doc; })(), newer((t) => { t.loops[0].stops[1] = { kind: "max-iterations", n: 9 }; }));
if (r) console.log("  stops:", JSON.stringify(L(r.doc, "review-review").stops), "| has review-wrap:", !!N(r.doc, "review-wrap"));

// 9c. policy scoped to a new node while the shape waits
r = show("9c shape held; policy scoped to a node that waits", placed(), newer((t) => {
  t.nodes = t.nodes.filter((n) => n.id !== "merge-gate"); t.edges = t.edges.filter((e) => e.from !== "merge-gate" && e.to !== "merge-gate");
  t.loops[0].members = ["builder", "critic"]; t.loops[0].back = ["e-critic-fail"];
  t.nodes.push(agent("wrap", "synthesizer", "WRAP.md")); t.edges.push({ id: "e-critic-wrap", from: "critic", to: "wrap", when: "pass" }, { id: "e-wrap-done", from: "wrap", to: "done" });
  t.policies.push({ id: "p-cap", kind: "concurrency-cap", scope: "node:wrap", params: { max: 1 } });
}));

// 9d. held approval on an edge; the edge 'to' re-pointed (field) applies => approval kept but on an edge that now leads elsewhere
{
  const h = placed({ after: "plan" }); E(h, "review-e-critic-pass").approval = true;
  r = show("9d person's approval on e-critic-pass held; same version re-points that edge to done", h, newer((t) => { t.edges.find((e) => e.id === "e-critic-pass").to = "done"; t.loops[0].members = ["builder", "critic"]; t.loops[0].back = ["e-critic-fail"]; }));
  if (r) console.log("  edge:", JSON.stringify(E(r.doc, "review-e-critic-pass")));
}
