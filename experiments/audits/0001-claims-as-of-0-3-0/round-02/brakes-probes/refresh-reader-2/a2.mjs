// H2: edge-level critic brakes evaded by an edge coming back under another id, or by an edge added beside it.
import { placed, newer, run, E } from "./h2.mjs";
const into = (doc, id) => doc.edges.filter((e) => e.to === id).map((e) => `${e.id}: from ${e.from} when ${JSON.stringify(e.when ?? "always")} evidence ${JSON.stringify(e.evidence ?? null)} isolation ${e.isolation ?? "fresh"}`);
const outOf = (doc, id) => doc.edges.filter((e) => e.from === id).map((e) => `${e.id}: -> ${e.to} when ${JSON.stringify(e.when ?? "always")}`);

// (a) the edge into the critic comes back under another id with NO evidence (isolation stays fresh)
const a = run("edge into the critic re-added under another id, no evidence", placed(), newer((t) => {
  const e = t.edges.find((x) => x.id === "e-builder-critic"); e.id = "to-critic"; delete e.evidence;
}));
console.log("into critic after:", into(a.doc, "review-critic"));

// (b) control: same edge, same id, evidence deleted -> held (the tested case)
run("control: evidence deleted on the same id", placed(), newer((t) => { delete t.edges.find((x) => x.id === "e-builder-critic").evidence; }));

// (c) the critic cut out of the way: its pass edge removed, a new edge builder -> gate added under another id
const c = run("critic's pass edge removed; builder leads to the gate itself", placed(), newer((t) => {
  t.edges = t.edges.filter((x) => x.id !== "e-critic-pass");
  t.edges.push({ id: "e-builder-merge-gate", from: "builder", to: "merge-gate" });
}));
console.log("into gate after:", into(c.doc, "review-merge-gate"), "out of critic:", outOf(c.doc, "review-critic"));

// (d) critic left in place, a way around it added
const d = run("an edge added beside the critic: builder -> gate", placed(), newer((t) => {
  t.edges.push({ id: "e-builder-merge-gate", from: "builder", to: "merge-gate" });
}));
console.log("into gate after:", into(d.doc, "review-merge-gate"));

// (e) control: the tested case, edge moved off the critic by `from`
run("control: e-critic-pass.from moved to builder", placed(), newer((t) => { Object.assign(t.edges.find((x) => x.id === "e-critic-pass"), { from: "builder", when: "always" }); }));

// (f) the critic's inbound edge kept but its `from` changed to the critic's own builder with a second, shared edge from another new node? isolation shared on a NEW node that becomes critic
const f = run("builder itself becomes the judge of its work: critic node removed-by-kind? no: critic role kept, builder->critic edge removed, critic gets edge from itself", placed(), newer((t) => {
  // a second critic 'critic2' with role critic added, sharing context; the old critic's pass edge is moved to critic2 by remove+add
  t.nodes.push({ ...structuredClone(t.nodes.find((n) => n.id === "critic")), id: "fast-check", name: "Fast check", role: "tester" });
  t.edges = t.edges.filter((x) => x.id !== "e-critic-pass" && x.id !== "e-builder-critic" && x.id !== "e-critic-fail");
  t.edges.push({ id: "e-builder-fast-check", from: "builder", to: "fast-check", isolation: "shared" }, { id: "e-fast-pass", from: "fast-check", to: "merge-gate", when: "pass" }, { id: "e-fast-fail", from: "fast-check", to: "builder", when: "fail" });
  t.loops[0].members = ["builder", "fast-check", "merge-gate"]; t.loops[0].back = ["e-fast-fail", "e-merge-gate-reject"];
}));
if (f) console.log("nodes:", f.doc.nodes.map((n) => `${n.id}(${n.role ?? n.kind})`), "edges:", f.doc.edges.map((e) => `${e.from}->${e.to}`));
