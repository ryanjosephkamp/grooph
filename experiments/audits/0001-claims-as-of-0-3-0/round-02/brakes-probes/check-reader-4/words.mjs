// The reader of the pull request after #132, on its last version: three things at the edges of its words.
//  1. A judge with no verdict written "pass" (a critic that says "approved" or "fail", "clean" or "finding"): a second
//     edge on the other word, to a new stop that ends in success, was adopted. Such a judge is asked of each word now.
//  2. Two decisions at once, NOT HELD and a stated limit: a critic's failing verdict leads to a gate, and only the
//     person's yes takes it to the end; a second edge on that verdict goes straight there. On the built-in patrol it
//     is the investigator's "finding" led to where its "clean" leads. For a check the same edge is held.
//  3. A check's id kept by a step of another kind while a new check takes its edges: the same swap as the id given
//     away. Its line shows what comes in, and nothing in that copy is called a tightening.
//   node check-reader-4/words.mjs                                   this repository alone
//   MAIN_ROOT=<a built checkout> node check-reader-4/words.mjs      beside another build
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { R } from "../adopt-reader-1/lib.mjs";
const roots = { ...(process.env.MAIN_ROOT ? { main: process.env.MAIN_ROOT } : {}), head: process.env.HEAD_ROOT ?? R };
const builds = {};
for (const [k, r] of Object.entries(roots)) builds[k] = await import(join(r, "packages/core/dist/src/index.js"));
const H = builds.head;
const inst = (id) => { const t = H.parseGraphText(readFileSync(join(roots.head, `patterns/${id}.grooph.json`), "utf8")).doc; return H.parseGraphText(JSON.stringify(H.instantiate(t, { name: t.name, values: Object.fromEntries((t.template.slots ?? []).map((s) => [s.key, s.example])) }))).doc; };
const builder = { id: "builder", kind: "agent", name: "Builder", role: "builder", brief: "Build it.", outputs: ["CHANGES.md"], allow: ["read-files", "edit-files"] };
const critic = { id: "judge", kind: "agent", name: "Critic", role: "critic", brief: "Judge it.", outputs: ["REVIEW.md"], allow: ["read-files", "write-outputs"] };
const tests = { id: "judge", kind: "check", name: "Tests", check: { kind: "command", run: "npm test", pass: "exit code 0" } };
const graph = (nodes, edges, loops = []) => H.parseGraphText(JSON.stringify({ grooph: 0, id: "words", name: "Words", version: 1, goal: "Build it and have it judged.", target: { harness: "claude-code" }, nodes, edges, loops })).doc;
/** A builder and a critic in a loop; the critic's good word leads to the end, its other word back. */
const looped = (good, bad) => graph(
  [builder, critic, { id: "done", kind: "stop", name: "Done", outcome: "success" }],
  [{ id: "e-b-j", from: "builder", to: "judge", evidence: ["the diff"] }, { id: "e-j-good", from: "judge", to: "done", when: good }, { id: "e-j-bad", from: "judge", to: "builder", when: bad, evidence: ["REVIEW.md"] }],
  [{ id: "review", name: "Review", members: ["builder", "judge"], back: ["e-j-bad"], mode: "judgment", bar: { name: "Bar", inspects: [{ kind: "file", ref: "REVIEW.md" }], acceptance: "Every item holds." }, stops: [{ kind: "bar-passed" }, { kind: "max-iterations", n: 3 }] }],
);
/** A judge whose failing verdict leads to a gate: only the person's yes takes it on to the end. */
const waived = (judge, good, bad) => graph(
  [builder, judge, { id: "waive", kind: "human-gate", name: "Waive", prompt: "It failed. Ship anyway?", options: ["approve", "reject"] }, { id: "done", kind: "stop", name: "Done", outcome: "success" }, { id: "stopped", kind: "stop", name: "Stopped", outcome: "halt" }],
  [{ id: "e-b-j", from: "builder", to: "judge", ...(judge.kind === "check" ? {} : { evidence: ["the diff"] }) }, { id: "e-j-good", from: "judge", to: "done", when: good }, { id: "e-j-bad", from: "judge", to: "waive", when: bad }, { id: "e-w-yes", from: "waive", to: "done", when: "pass" }, { id: "e-w-no", from: "waive", to: "stopped", when: "fail" }],
);
const fine = (when) => (w) => { w.nodes.push({ id: "fine", kind: "stop", name: "Fine", outcome: "success" }); w.edges.push({ id: "e-j-bad-too", from: "judge", to: "fine", when }); };
const straight = (when) => (w) => { w.edges.push({ id: "e-j-bad-too", from: "judge", to: "done", when }); };
const patrol = inst("patrol-pulse");
const grind = inst("grind-loop");
const cases = [
  ["1. a critic that says \"approved\" or \"fail\": a second edge on \"fail\", to a new stop that ends in success", looped({ verdict: "approved" }, "fail"), fine("fail")],
  ["1. a critic that says \"clean\" or \"finding\": a second edge on \"finding\", to a new stop that ends in success", looped({ verdict: "clean" }, { verdict: "finding" }), fine({ verdict: "finding" })],
  ["1. a critic that says \"pass\" or \"fail\", the same", looped("pass", "fail"), fine("fail")],
  ["2. NOT HELD, a stated limit. A critic's \"fail\" leads to a gate: a second edge on \"fail\", straight to the end", waived(critic, "pass", "fail"), straight("fail")],
  ["2. NOT HELD, a stated limit. The same for a critic with words of its own", waived(critic, { verdict: "clean" }, { verdict: "finding" }), straight({ verdict: "finding" })],
  ["2. NOT HELD, a stated limit. The built-in patrol: the investigator's \"finding\" led to where its \"clean\" leads", patrol, (w) => { w.edges.push({ id: "e-investigator-finding-clean", from: "investigator", to: "clean", when: { verdict: "finding" } }); }],
  ["2. held: the critic's \"fail\" edge itself led to the end, away from the gate", waived(critic, "pass", "fail"), (w) => { w.edges.find((e) => e.id === "e-j-bad").to = "done"; }],
  ["2. held: a check's \"fail\" leads to a gate, and a second edge on \"fail\" goes straight to the end", waived(tests, "pass", "fail"), straight("fail")],
  ["3. the id \"tests\" kept by a step of another kind, a new check \"test-suite\" that runs `true` taking its edges, a bar given to the loop", grind, (w) => {
    const old = w.nodes.find((n) => n.id === "tests");
    w.nodes.push({ ...structuredClone(old), id: "test-suite", check: { ...old.check, run: "true" } });
    for (const key of Object.keys(old)) delete old[key];
    Object.assign(old, { id: "tests", kind: "agent", name: "tests", role: "builder", brief: "tests: do the work.", outputs: ["tests.md"], allow: ["read-files", "write-outputs"] });
    for (const e of w.edges) Object.assign(e, { from: e.from === "tests" ? "test-suite" : e.from, to: e.to === "tests" ? "test-suite" : e.to });
    w.edges.push({ id: "e-tests-suite", from: "tests", to: "test-suite" });
    w.loops[0].members = [...w.loops[0].members, "test-suite"];
    w.loops[0].bar = { name: "Builder says so", inspects: [{ kind: "file", ref: "CHANGES.md" }], acceptance: "CHANGES.md says the change is made." };
  }],
];
for (const [what, source, change] of cases) {
  console.log(`\n${what}`);
  const w = structuredClone(source); change(w);
  for (const [k, C] of Object.entries(builds)) {
    const p = C.parseGraphText(JSON.stringify(w));
    const a = p.doc ? C.adoptWorkingCopy(source, p.doc, { run: "p" }) : { ok: false, issues: p.issues };
    if (!a.ok) { console.log(`   ${k}: not valid: ${a.issues.map((i) => `${i.code}: ${String(i.message).slice(0, 140)}`).join(" | ")}`); continue; }
    const c = C.checkAdoption(source, a.doc);
    console.log(`   ${k}: ${c.refused.length ? `REFUSED ${c.refused.map((r) => `${r.name} [${r.loosens.slice(0, 230)}]`).join(" | ")}` : "ADOPTED, nothing refused"}`);
    const said = (key, label) => { const list = c.changes.filter((x) => x[key] !== undefined && x.loosens === undefined); if (list.length) console.log(`      ${label}: ${list.map((x) => `${x.name} [${x[key].slice(0, 110)}]`).join(" | ")}`); };
    said("tightens", "called a tightening"); said("unjudged", "not judged");
  }
}
