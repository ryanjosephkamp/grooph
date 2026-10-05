import { placed, newer, run, codes, placeSubgrooph, host, tpl, values, agent, reachedWithout, errCodes } from "./h2.mjs";
const out = (doc, id) => doc.edges.filter((e) => e.from === id).map((e) => `${e.id}: ${JSON.stringify(e.when ?? "always")} -> ${e.to}`);

// H1 variant: own stop kept; the reject edge re-pointed by `to`, same id.
const kept = placeSubgrooph(host(), tpl(), { as: "review", values, after: "plan" }).doc;
const a = run("H1c: own stop kept; the gate's reject edge re-pointed to the stop (same id, `to` only)", kept, newer((t) => { t.edges.find((e) => e.id === "e-merge-gate-reject").to = "done"; t.loops[0].back = ["e-critic-fail"]; }));
console.log("  out of the gate:", out(a.doc, "review-merge-gate"), "| issues:", codes(a.doc));

// critic's verdict no longer decides: its pass edge fires always, its fail edge is gone
const b = run("critic's pass edge made 'always', its fail edge removed", placed(), newer((t) => { t.edges.find((e) => e.id === "e-critic-pass").when = "always"; t.edges = t.edges.filter((e) => e.id !== "e-critic-fail"); t.loops[0].back = ["e-merge-gate-reject"]; }));
console.log("  out of the critic:", out(b.doc, "review-critic"), "| issues:", codes(b.doc));

// H5, with no marker on the second step (so the validator has nothing to say)
const v1 = newer((t) => {
  t.nodes.find((n) => n.id === "merge-gate").options = ["approve", "reject with feedback", "hotfix"];
  t.nodes.push(agent("tag", "builder", "TAG.md"), agent("hotfix", "builder", "HOTFIX.md", { brief: "Force-push the fix to main." }));
  t.edges.find((e) => e.id === "e-merge-gate-done").to = "tag";
  t.edges.push({ id: "e-tag-done", from: "tag", to: "done" }, { id: "e-merge-gate-hotfix", from: "merge-gate", to: "hotfix", when: { verdict: "hotfix" } }, { id: "e-hotfix-done", from: "hotfix", to: "done" });
}, 1);
const before = placeSubgrooph(host(), v1, { as: "review", values, after: "plan", then: "release" }).doc;
const v2 = newer((t) => { t.edges.push({ id: "e-critic-tag", from: "critic", to: "tag", when: { verdict: "trivial" } }, { id: "e-tag-hotfix", from: "tag", to: "hotfix", when: "fail" }); }, 2, v1);
const behind = (doc) => doc.nodes.map((n) => n.id).filter((id) => !reachedWithout(doc, "every").has(id));
console.log("\nH5 before: behind a person:", behind(before));
const r = run("H5 (no marker): --allow edge:e-review-critic-review-tag only", before, v2, { allow: ["edge:e-review-critic-review-tag"] });
console.log("  after: behind a person:", behind(r.doc), "| issues:", codes(r.doc));

// a person's own graph-wide critic-isolation policy beside the subgrooph's: same template, same version
const p = placed(); p.policies.push({ id: "my-isolation", kind: "critic-isolation", scope: "graph" });
run("unchanged template; the graph has its own identical graph-wide critic-isolation policy", p, tpl());
