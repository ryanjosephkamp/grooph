// H5: allowing one named change lets through another loosening that was never named.
import { placeSubgrooph, host, values, tpl, newer, run, agent, codes, reachedWithout, errCodes } from "./h2.mjs";
// v1: the review gate, with two steps behind the gate: "tag" on approve, and "hotfix" (marked irreversible) on another answer.
const v1 = newer((t) => {
  t.nodes.find((n) => n.id === "merge-gate").options = ["approve", "reject with feedback", "hotfix"];
  t.nodes.push(agent("tag", "builder", "TAG.md"), agent("hotfix", "builder", "HOTFIX.md", { irreversible: ["force-push"] }));
  t.edges.find((e) => e.id === "e-merge-gate-done").to = "tag";
  t.edges.push({ id: "e-tag-done", from: "tag", to: "done" }, { id: "e-merge-gate-hotfix", from: "merge-gate", to: "hotfix", when: { verdict: "hotfix" } }, { id: "e-hotfix-done", from: "hotfix", to: "done" });
}, 1);
const before = placeSubgrooph(host(), v1, { as: "review", values, after: "plan", then: "release" }).doc;
console.log("before: errors", errCodes(before), "| not reached without a person:", before.nodes.map((n) => n.id).filter((id) => !reachedWithout(before, "every").has(id)));
// v2: the critic may send a trivial change straight to "tag"; and "tag" now leads to "hotfix".
const v2 = newer((t) => {
  t.edges.push({ id: "e-critic-tag", from: "critic", to: "tag", when: { verdict: "trivial" } }, { id: "e-tag-hotfix", from: "tag", to: "hotfix", when: "fail" });
}, 2, v1);
const r0 = run("no allow", before, v2);
const name = r0.held.find((c) => !c.waits).name;
const r1 = run(`allow only ${name}`, before, v2, { allow: [name] });
console.log("after: not reached without a person:", r1.doc.nodes.map((n) => n.id).filter((id) => !reachedWithout(r1.doc, "every").has(id)), "| new edges:", r1.doc.edges.filter((e) => !before.edges.some((b) => b.id === e.id)).map((e) => `${e.id}: ${e.from}->${e.to}`), "| issues:", codes(r1.doc));
// control: v2' adds only tag -> hotfix... nothing opened without the first; and v2'' adds critic -> hotfix directly
run("control: only the critic -> hotfix edge", before, newer((t) => { t.edges.push({ id: "e-critic-hotfix", from: "critic", to: "hotfix", when: { verdict: "trivial" } }); }, 2, v1));
