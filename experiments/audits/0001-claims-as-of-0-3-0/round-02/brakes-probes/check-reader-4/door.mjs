// The reader of the export door (#60), which prints core's own labels: what is called a tightening that brings
// something in, and what is adopted with no label at all. On the review-gate template, plain and with the tests as
// a check between the builder and the critic. Before this was asked, a new step told to publish, marked
// irreversible and put behind the gate's yes, and a gate given the answer "skip", were both printed under
// "tightens a brake"; they are named now and not called that. The rest prints what adoption does not hold, as
// docs/runs.md lists it: an answer led on to a new step, a step's effort, inputs and outputs, evidence on an edge
// that neither leads into a critic nor leaves a check, the goal.
//   node check-reader-4/door.mjs                                   this repository alone
//   MAIN_ROOT=<a built checkout> node check-reader-4/door.mjs      beside another build
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { R } from "../adopt-reader-1/lib.mjs";
const roots = { ...(process.env.MAIN_ROOT ? { main: process.env.MAIN_ROOT } : {}), head: process.env.HEAD_ROOT ?? R };
const builds = {};
for (const [k, r] of Object.entries(roots)) builds[k] = await import(join(r, "packages/core/dist/src/index.js"));
const H = builds.head;
const clone = (x) => structuredClone(x);
const errs = (C, doc) => C.validate(doc, { forExport: true }).filter((i) => i.severity === "error");
const inst = (id) => { const t = H.parseGraphText(readFileSync(join(roots.head, `patterns/${id}.grooph.json`), "utf8")).doc; return H.parseGraphText(JSON.stringify(H.instantiate(t, { name: t.name, values: Object.fromEntries((t.template.slots ?? []).map((s) => [s.key, s.example])) }))).doc; };

const plain = inst("review-gate");
// The same graph with the tests as a check between the builder and the critic.
const withCheck = (() => {
  const d = clone(plain);
  const old = d.edges.find((e) => e.id === "e-builder-critic");
  d.nodes.splice(1, 0, { id: "tests", kind: "check", name: "Tests", check: { kind: "command", run: "pnpm test", pass: "exit code 0" } });
  d.edges = d.edges.filter((e) => e.id !== "e-builder-critic");
  d.edges.unshift({ id: "e-builder-tests", from: "builder", to: "tests" }, { id: "e-tests-critic", from: "tests", to: "critic", when: "pass", evidence: old.evidence }, { id: "e-tests-fail", from: "tests", to: "builder", when: "fail", evidence: ["the test output"] });
  const loop = d.loops[0]; loop.members = ["builder", "tests", "critic", "merge-gate"]; loop.back = [...loop.back, "e-tests-fail"];
  const p = H.parseGraphText(JSON.stringify(d));
  if (!p.doc) throw new Error("with a check: schema " + JSON.stringify(p.issues).slice(0, 400));
  const e = errs(H, p.doc); if (e.length) throw new Error("with a check: " + e.map((i) => `${i.code} ${i.message}`).join(" | "));
  return p.doc;
})();
const agent = (id, brief, extra = {}) => ({ id, kind: "agent", name: id, role: "builder", model: { tier: "strong" }, effort: "medium", brief, inputs: ["the approved change"], outputs: [`${id.toUpperCase()}.md: what was done`], allow: ["read-files", "run-commands", "write-outputs"], ...extra });
const edge = (d, id) => d.edges.find((e) => e.id === id);
const node = (d, id) => d.nodes.find((n) => n.id === id);

const cases = [
  ["(a) a new edge from the builder to the critic that goes round the check, handing the critic evidence", withCheck, (w) => { w.edges.push({ id: "e-skip", from: "builder", to: "critic", evidence: ["diff of the change", "the builder's word that the tests pass"] }); }],
  ["(a2) the same edge with no evidence", withCheck, (w) => { w.edges.push({ id: "e-skip", from: "builder", to: "critic" }); }],
  ["(b) a new step marked irreversible (told to publish) put behind the gate: the gate's yes led to it, and it leads to done", plain, (w) => { w.nodes.push(agent("ship", "Run `npm publish`, once.", { irreversible: ["publishes the package to npm"] })); edge(w, "e-merge-gate-done").to = "ship"; w.edges.push({ id: "e-ship-done", from: "ship", to: "done" }); }],
  ["(b2) the same step with NO irreversible marker (the reader's retargeted answer: told to run npm publish)", plain, (w) => { w.nodes.push(agent("ship", "Run `npm publish`, once.")); edge(w, "e-merge-gate-done").to = "ship"; w.edges.push({ id: "e-ship-done", from: "ship", to: "done" }); }],
  ["(b3) the irreversible step put in FRONT of the gate (between the critic's pass and the gate)", plain, (w) => { w.nodes.push(agent("ship", "Run `npm publish`, once.", { irreversible: ["publishes the package to npm"] })); edge(w, "e-critic-pass").to = "ship"; w.edges.push({ id: "e-ship-gate", from: "ship", to: "merge-gate" }); }],
  ["(b4) the irreversible marker put on a step the graph HAS, behind no gate of its own in a round (the builder)", plain, (w) => { node(w, "builder").irreversible = ["publishes the package to npm"]; }],
  ["(c1) a gate given a new answer \"skip\", and no edge for it", plain, (w) => { node(w, "merge-gate").options.push("skip"); }],
  ["(c2) the new answer \"skip\" led to done, which its yes already reaches", plain, (w) => { node(w, "merge-gate").options.push("skip"); w.edges.push({ id: "e-gate-skip", from: "merge-gate", to: "done", when: { verdict: "skip" } }); }],
  ["(c3) the new answer \"skip\" led to a new step told to publish, which leads to done", plain, (w) => { node(w, "merge-gate").options.push("skip"); w.nodes.push(agent("ship", "Run `npm publish`, once.")); w.edges.push({ id: "e-gate-skip", from: "merge-gate", to: "ship", when: { verdict: "skip" } }, { id: "e-ship-done", from: "ship", to: "done" }); }],
  ["(c4) the new answer \"skip\" led to a new stop that ends in success", plain, (w) => { node(w, "merge-gate").options.push("skip"); w.nodes.push({ id: "skipped", kind: "stop", name: "Skipped", outcome: "success" }); w.edges.push({ id: "e-gate-skip", from: "merge-gate", to: "skipped", when: { verdict: "skip" } }); }],
  ["(d1) the builder's effort changed, high to low", plain, (w) => { node(w, "builder").effort = "low"; }],
  ["(d2) the critic's effort changed, high to low", plain, (w) => { node(w, "critic").effort = "low"; }],
  ["(e1) the critic's inputs replaced", plain, (w) => { node(w, "critic").inputs = ["the builder's summary of the change"]; }],
  ["(e2) the critic's outputs replaced", plain, (w) => { node(w, "critic").outputs = ["a thumbs up"]; }],
  ["(f1) evidence removed from an edge not into a critic (the critic's fail back to the builder)", plain, (w) => { delete edge(w, "e-critic-fail").evidence; }],
  ["(f2) evidence replaced on the gate's reject back to the builder", plain, (w) => { edge(w, "e-merge-gate-reject").evidence = ["nothing in particular"]; }],
  ["(f3) with a check: evidence removed from the check's fail back to the builder", withCheck, (w) => { delete edge(w, "e-tests-fail").evidence; }],
  ["(g) the goal's \"Done when\" rewritten", plain, (w) => { w.goal = w.goal.replace(/Done when.*$/s, "Done when the builder says it is done."); }],
];

for (const [what, source, change] of cases) {
  console.log(`\n## ${what}`);
  const w = clone(source); change(w);
  for (const [k, C] of Object.entries(builds)) {
    const p = C.parseGraphText(JSON.stringify(w));
    if (!p.doc) { console.log(`  ${k}: outside the schema: ${JSON.stringify(p.issues).slice(0, 200)}`); continue; }
    const a = C.adoptWorkingCopy(source, p.doc, { run: "p" });
    if (!a.ok) { console.log(`  ${k}: NOT VALID, not adoptable: ${a.issues.map((i) => `${i.code}: ${i.message.slice(0, 160)}`).join(" | ")}`); continue; }
    const c = C.checkAdoption(source, a.doc);
    const tight = c.changes.filter((x) => x.tightens !== undefined && x.loosens === undefined);
    const unj = c.changes.filter((x) => x.unjudged !== undefined && x.loosens === undefined);
    const other = c.changes.filter((x) => x.loosens === undefined && x.tightens === undefined && x.unjudged === undefined);
    console.log(`  ${k}: ${c.refused.length ? "REFUSED" : "ADOPTED, nothing refused"}; changes named: ${c.changes.length}`);
    for (const x of c.refused) console.log(`      loosens a brake   ${x.name}  ${x.loosens.slice(0, 330)}`);
    for (const x of tight) console.log(`      tightens a brake  ${x.name}  undoing it: ${x.tightens.slice(0, 260)}`);
    for (const x of unj) console.log(`      not judged        ${x.name}  undoing it: ${x.unjudged.slice(0, 200)}`);
    if (other.length) console.log(`      no label          ${other.map((x) => x.name).join(", ")}`);
    for (const n of c.notices) console.log(`      note: ${n.slice(0, 300)}`);
  }
}
