// Two successive versions: a step behind the gate is dropped (v2), then comes back under the SAME id in front of the gate (v3).
import { placeSubgrooph, host, values, newer, run, agent, codes, reachedWithout } from "./h2.mjs";
const behind = (doc) => doc.nodes.map((n) => n.id).filter((id) => !reachedWithout(doc, "every").has(id));
const v1 = newer((t) => {
  t.nodes.push(agent("tag", "builder", "TAG.md", { brief: "Tag the merged commit and push the tag." }));
  t.edges.find((e) => e.id === "e-merge-gate-done").to = "tag";
  t.edges.push({ id: "e-tag-done", from: "tag", to: "done" });
}, 1);
const before = placeSubgrooph(host(), v1, { as: "review", values, after: "plan", then: "release" }).doc;
console.log("v1: behind a person:", behind(before));
const v2 = newer(() => undefined, 2); // the shipped review gate again: no tag step
const s2 = run("v2: the tag step is dropped", before, v2);
console.log("  behind a person:", behind(s2.doc));
const v3 = newer((t) => {
  t.nodes.push(agent("tag", "builder", "TAG.md", { brief: "Tag the merged commit and push the tag." }));
  t.edges.push({ id: "e-critic-tag", from: "critic", to: "tag", when: "pass" });
}, 3);
const s3 = run("v3: the tag step is back, same id, reached from the critic", s2.doc, v3);
console.log("  behind a person:", behind(s3.doc), "| into review-tag:", s3.doc.edges.filter((e) => e.to === "review-tag").map((e) => e.from), "| issues:", codes(s3.doc));
// control: v1 -> v3 in one step
run("control: v1 -> v3 in one step", before, v3);
