// How a run comes to end without a verdict's pass: the cases the pull request after #132 was asked to hold, and the
// three roads its own reader then found. A critic's verdict, or a check's, that comes to end in success on another
// answer than its pass; and, for the record of what is not held, a gate's answer that does.
//   node check-reader-4/ends.mjs                                   this repository alone
//   MAIN_ROOT=<a built checkout> node check-reader-4/ends.mjs      beside another build
import { join } from "node:path";
import { R } from "../adopt-reader-1/lib.mjs";
const HEAD_ROOT = process.env.HEAD_ROOT ?? R, MAIN_ROOT = process.env.MAIN_ROOT;
const H = await import(join(HEAD_ROOT, "packages/core/dist/src/index.js"));
const M = MAIN_ROOT ? await import(join(MAIN_ROOT, "packages/core/dist/src/index.js")) : undefined;
const agent = (id, role = "builder") => ({ id, kind: "agent", name: id, role, brief: `${id}: do the work.`, outputs: [`${id}.md`], allow: ["read-files", "write-outputs"] });
const graph = (id, nodes, edges, loops = []) => ({ grooph: 0, id, name: id, version: 1, goal: "Do the work and stop.", target: { harness: "claude-code" }, nodes, edges, loops });
const stop = (id, outcome) => ({ id, kind: "stop", name: id, ...(outcome ? { outcome } : {}) });
/** builder -> tests; pass -> done; fail -> report -> failed (a stop that halts). */
const checked = () => graph("checked",
  [agent("builder"), { id: "tests", kind: "check", name: "Tests", check: { kind: "tests", run: "npm test", pass: "exit code 0" } }, agent("report", "tester"), stop("done", "success"), stop("failed", "halt")],
  [{ id: "e-builder-tests", from: "builder", to: "tests" }, { id: "e-tests-pass", from: "tests", to: "done", when: "pass" }, { id: "e-tests-fail", from: "tests", to: "report", when: "fail" }, { id: "e-report-failed", from: "report", to: "failed" }]);
/** builder -> critic in a loop, no person; pass -> done; "hopeless" and "stuck" -> gave-up (halts); triage -> nothing-to-do. */
const critiqued = () => graph("critiqued",
  [agent("builder"), agent("critic", "critic"), agent("triage"), stop("done", "success"), stop("gave-up", "halt"), stop("nothing-to-do", "success")],
  [{ id: "e-builder-critic", from: "builder", to: "critic", evidence: ["the diff"] }, { id: "e-critic-pass", from: "critic", to: "done", when: "pass" }, { id: "e-critic-fail", from: "critic", to: "builder", when: "fail" },
    { id: "e-critic-hopeless", from: "critic", to: "gave-up", when: { verdict: "hopeless" } }, { id: "e-critic-stuck", from: "critic", to: "gave-up", when: { verdict: "stuck" } }, { id: "e-triage-nothing", from: "triage", to: "nothing-to-do" }],
  [{ id: "review", name: "Review", members: ["builder", "critic"], back: ["e-critic-fail"], mode: "judgment", bar: { name: "Good", inspects: [{ kind: "file", ref: "REVIEW.md" }], acceptance: "The critic finds nothing wrong." }, stops: [{ kind: "bar-passed" }, { kind: "max-iterations", n: 3 }] }]);
/** builder -> tests; pass -> gate; yes -> done; no -> stopped (halts), where the tests' failure leads too; triage -> nothing-to-do. */
const gated = () => graph("gated",
  [agent("builder"), { id: "tests", kind: "check", name: "Tests", check: { kind: "tests", run: "npm test", pass: "exit code 0" } }, { id: "gate", kind: "human-gate", name: "Gate", prompt: "Ship it?", options: ["yes", "no"] },
    agent("triage"), stop("done", "success"), stop("stopped", "halt"), stop("nothing-to-do", "success")],
  [{ id: "e-builder-tests", from: "builder", to: "tests" }, { id: "e-tests-pass", from: "tests", to: "gate", when: "pass" }, { id: "e-tests-fail", from: "tests", to: "stopped", when: "fail" },
    { id: "e-gate-yes", from: "gate", to: "done", when: { verdict: "yes" } }, { id: "e-gate-no", from: "gate", to: "stopped", when: { verdict: "no" } }, { id: "e-triage-nothing", from: "triage", to: "nothing-to-do" }]);
/** The same critic, with nothing else that reaches a stop that ends in success: only its pass does. */
const onlyPass = () => { const g = critiqued(); g.nodes = g.nodes.filter((n) => n.id !== "triage" && n.id !== "nothing-to-do"); g.edges = g.edges.filter((e) => e.id !== "e-triage-nothing"); return g; };
const edge = (w, id) => w.edges.find((e) => e.id === id);
function both(what, make, change) {
  const p0 = H.parseGraphText(JSON.stringify(make()));
  const bad = p0.doc ? H.validate(p0.doc, { forExport: true }).filter((i) => i.severity === "error") : p0.issues;
  if (bad.length) return console.log(`\n${what}\n   the source is not valid: ${bad.map((i) => i.code).join(", ")}`);
  const w = structuredClone(p0.doc); change(w);
  const a = H.adoptWorkingCopy(p0.doc, H.parseGraphText(JSON.stringify(w)).doc, { run: "p" });
  if (!a.ok) return console.log(`\n${what}\n   not valid: ${a.issues.map((i) => i.code).join(", ")}`);
  const say = (C) => { const c = C.checkAdoption(p0.doc, a.doc); return c.refused.length ? `REFUSED ${c.refused.map((r) => `${r.name} [${r.loosens.slice(0, 170)}]`).join(" | ")}` : "ADOPTED, nothing refused"; };
  console.log(`\n${what}${M ? `\n   main: ${say(M)}` : ""}\n   head: ${say(H)}`);
}
both("a critic, no person: another verdict's edge ADDED, to a stop that ends in success that the run adds", critiqued, (w) => { w.nodes.push(stop("done-too", "success")); w.edges.push({ id: "e-critic-meh", from: "critic", to: "done-too", when: { verdict: "meh" } }); });
both("a critic, no person: a verdict's edge LED to such a stop, while the stop it left keeps another way in", critiqued, (w) => { w.nodes.push(stop("done-too", "success")); edge(w, "e-critic-hopeless").to = "done-too"; });
both("a critic, no person: a verdict's edge led to a stop that ends in success that the graph HAD and reaches without the critic", critiqued, (w) => { edge(w, "e-critic-hopeless").to = "nothing-to-do"; });
both("a check: the step its failure leads to, made a stop that ends in success (its edge on, and the stop that halted, dropped)", checked, (w) => { w.nodes[w.nodes.findIndex((n) => n.id === "report")] = stop("report"); w.edges = w.edges.filter((e) => e.id !== "e-report-failed"); w.nodes = w.nodes.filter((n) => n.id !== "failed"); });
both("a critic, no person: a verdict's edge led to the stop that ends in success that only its PASS reached", onlyPass, (w) => { edge(w, "e-critic-hopeless").to = "done"; });
// A gate's answers, as the audit lane ran them. What a run reaches is asked of each answer; how a run ends, of the gate as a whole.
both("a gate: its \"no\" led to the stop that ends in success that only its \"yes\" reached", gated, (w) => { edge(w, "e-gate-no").to = "done"; });
both("a gate: the stop that halts that its \"no\" leads to, made to end in success (the tests' failure leads there too, with nobody asked)", gated, (w) => { w.nodes.find((n) => n.id === "stopped").outcome = "success"; });
both("NOT HELD, a stated limit. A gate: its \"no\" led to a stop that ends in success that the run ADDS", gated, (w) => { w.nodes.push(stop("closed")); edge(w, "e-gate-no").to = "closed"; });
both("NOT HELD, a stated limit. A gate: its \"no\" led to a stop that ends in success that the graph had and a run already reached another way", gated, (w) => { edge(w, "e-gate-no").to = "nothing-to-do"; });
