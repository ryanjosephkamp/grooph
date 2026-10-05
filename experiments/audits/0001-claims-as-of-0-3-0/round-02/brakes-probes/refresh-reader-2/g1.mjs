// A step behind a gate, brought back under another id in front of it.
import { placeSubgrooph, host, values, tpl, newer, run, agent, codes, reachedWithout, pattern, examples, N } from "./h2.mjs";
const behind = (doc) => doc.nodes.map((n) => n.id).filter((id) => !reachedWithout(doc, "every").has(id));

// (1) inside one subgrooph: the review gate with a "tag" step after the gate (unmarked).
const v1 = newer((t) => {
  t.nodes.push(agent("tag", "builder", "TAG.md", { brief: "Tag the merged commit and push the tag." }));
  t.edges.find((e) => e.id === "e-merge-gate-done").to = "tag";
  t.edges.push({ id: "e-tag-done", from: "tag", to: "done" });
}, 1);
const before = placeSubgrooph(host(), v1, { as: "review", values, after: "plan", then: "release" }).doc;
console.log("before: behind a person:", behind(before));
const v2 = newer((t) => {
  const tag = t.nodes.find((n) => n.id === "tag"); tag.id = "tagger";
  t.edges = t.edges.filter((e) => e.id !== "e-tag-done");
  t.edges.find((e) => e.id === "e-merge-gate-done").to = "done";
  t.edges.push({ id: "e-critic-tagger", from: "critic", to: "tagger", when: "pass" });
}, 2, v1);
const r = run("(1) 'tag' behind the gate comes back as 'tagger', reached from the critic", before, v2);
console.log("after: behind a person:", behind(r.doc), "| tagger:", JSON.stringify(N(r.doc, "review-tagger")?.brief), "| into tagger:", r.doc.edges.filter((e) => e.to === "review-tagger").map((e) => `${e.from} (${JSON.stringify(e.when)})`), "| issues:", codes(r.doc));

// (2) a built-in with no gate of its own, placed behind a gate of the graph's, one step upstream.
const grind = pattern("grind-loop");
const h = host();
h.nodes.push({ id: "go", kind: "human-gate", name: "Go", prompt: "Start the work?" }, agent("prep", "planner", "PREP.md"));
h.edges.push({ id: "e-plan-go", from: "plan", to: "go" }, { id: "e-go-prep", from: "go", to: "prep", when: "pass" });
const b2 = placeSubgrooph(h, grind, { as: "g", values: examples(grind), after: "prep" }).doc;
console.log("\n(2) before: nodes", b2.nodes.map((n) => n.id), "\n    behind a person:", behind(b2));
const ren = newer((t) => {
  const map = Object.fromEntries(t.nodes.map((n) => [n.id, `${n.id}2`]));
  for (const n of t.nodes) n.id = map[n.id];
  for (const e of t.edges) { e.from = map[e.from]; e.to = map[e.to]; e.id = `${e.id}-2`; }
  for (const l of t.loops) { l.members = l.members.map((m) => map[m]); l.back = l.back.map((b) => `${b}-2`); l.stops = l.stops.map((s) => (s.then ? { ...s, then: map[s.then] } : s)); if (l.bar?.answerKeyFrom) l.bar.answerKeyFrom = map[l.bar.answerKeyFrom]; }
}, 99, grind);
const r2 = run("(2) every node of the box renamed; the graph's gate is one step upstream of the box", b2, ren, { group: "g" });
console.log("    after: nodes", r2.doc.nodes.map((n) => n.id), "\n    behind a person:", behind(r2.doc), "| issues:", codes(r2.doc));

// (2b) control: gate directly before the box
const h3 = host();
h3.nodes.push({ id: "go", kind: "human-gate", name: "Go", prompt: "Start the work?" });
h3.edges.push({ id: "e-plan-go", from: "plan", to: "go" });
const b3 = placeSubgrooph(h3, grind, { as: "g", values: examples(grind), after: "go" }).doc;
run("(2b) control: the gate leads straight into the box", b3, ren, { group: "g" });
