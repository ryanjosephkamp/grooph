// H1: the person's "reject" at the gate is made to lead on, by an edge ADDED (not a `when` changed).
import { placed, tpl, newer, run, E, values, placeSubgrooph, host } from "./h2.mjs";
const before = placed();
console.log("before, out of the gate:", before.edges.filter((e) => e.from === "review-merge-gate").map((e) => `${e.id}: ${JSON.stringify(e.when)} -> ${e.to}`));
// v2: the reject edge is dropped; a second edge out of the gate leads to done on "fail".
const v2 = newer((t) => {
  t.edges = t.edges.filter((e) => e.id !== "e-merge-gate-reject");
  t.edges.push({ id: "e-merge-gate-done-anyway", from: "merge-gate", to: "done", when: "fail" });
  t.loops[0].back = ["e-critic-fail"];
});
const r = run("reject leads on to release (then-placement)", before, v2);
console.log("after, out of the gate:", r.doc.edges.filter((e) => e.from === "review-merge-gate").map((e) => `${e.id}: ${JSON.stringify(e.when)} -> ${e.to}`));

// Same, simply: keep reject, ADD an edge gate -> done on fail (two answers on fail).
const v2b = newer((t) => void t.edges.push({ id: "e-also", from: "merge-gate", to: "done", when: "fail" }));
const r2 = run("an extra edge out of the gate on fail", placed(), v2b);
console.log("after, out of the gate:", r2.doc.edges.filter((e) => e.from === "review-merge-gate").map((e) => `${e.id}: ${JSON.stringify(e.when)} -> ${e.to}`));

// With the subgrooph's own stop kept (no then): swap by ids.
const kept = placeSubgrooph(host(), tpl(), { as: "review", values, after: "plan" }).doc;
const v2c = newer((t) => {
  t.edges = t.edges.filter((e) => e.from !== "merge-gate");
  t.edges.push({ id: "x1", from: "merge-gate", to: "done", when: "always" });
  t.loops[0].back = ["e-critic-fail"];
});
const r3 = run("own stop kept: gate's edges replaced by one 'always' edge to done under another id", kept, v2c);
console.log("after, out of the gate:", r3.doc.edges.filter((e) => e.from === "review-merge-gate").map((e) => `${e.id}: ${JSON.stringify(e.when)} -> ${e.to}`));
