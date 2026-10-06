// The driver's reader of the check kind (#132): a stop that halts, made to end in success, where a check's verdict, a
// critic's or a round cap leads to it. As the reader wrote it, but for where the two builds are: it asked a build of
// main and a build of the head side by side (MAIN_ROOT, HEAD_ROOT). Here the head is this repository, and main's
// answer is printed only when MAIN_ROOT names another built checkout to ask.
//   node check-reader-4/halt.mjs                                   this repository alone
//   MAIN_ROOT=<a built checkout> node check-reader-4/halt.mjs      beside another build
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { R } from "../adopt-reader-1/lib.mjs";
const HEAD_ROOT = process.env.HEAD_ROOT ?? R, MAIN_ROOT = process.env.MAIN_ROOT;
const H = await import(join(HEAD_ROOT, "packages/core/dist/src/index.js"));
const M = MAIN_ROOT ? await import(join(MAIN_ROOT, "packages/core/dist/src/index.js")) : undefined;
const inst = (id) => { const t = H.parseGraphText(readFileSync(join(HEAD_ROOT, `patterns/${id}.grooph.json`), "utf8")).doc; return H.instantiate(t, { name: t.name, values: Object.fromEntries(t.template.slots.map((s) => [s.key, s.example])) }); };
const both = (what, source, change) => {
  const p0 = H.parseGraphText(JSON.stringify(source)); if (!p0.doc || H.validate(p0.doc, { forExport: true }).some((i) => i.severity === "error")) { console.log(`${what}: the source is not valid: ${JSON.stringify((p0.issues ?? H.validate(p0.doc, { forExport: true }).filter((i) => i.severity === "error")).map((i) => i.code + " " + i.message).slice(0, 2))}`); return; }
  const w = structuredClone(p0.doc); change(w);
  const a = H.adoptWorkingCopy(p0.doc, H.parseGraphText(JSON.stringify(w)).doc, { run: "p" });
  if (!a.ok) { console.log(`${what}: not valid: ${a.issues.map((i) => i.code).join(", ")}`); return; }
  const say = (C) => { const c = C.checkAdoption(p0.doc, a.doc); return c.refused.length ? `REFUSED ${c.refused.map((r) => `${r.name} [${r.loosens.slice(0, 150)}]`).join(" | ")}` : `ADOPTED, nothing refused${c.changes.some((x) => x.tightens) ? " (something said to tighten)" : ""}`; };
  console.log(`\n${what}${M ? `\n   main: ${say(M)}` : ""}\n   head: ${say(H)}`);
};
// 1. a check's third verdict leads to a stop that halts; the stop made to end in success
{ const s = inst("grind-loop"); s.nodes.push({ id: "gave-up", kind: "stop", name: "Gave up", outcome: "halt" }); s.edges.push({ id: "e-tests-broken", from: "tests", to: "gave-up", when: { verdict: "broken" } });
  both("grind-loop + a stop that halts on the check's verdict \"broken\": that stop made to end in success", s, (w) => { w.nodes.find((n) => n.id === "gave-up").outcome = "success"; }); }
// 1b. the check's FAIL leads to the halting stop (no loop at all): builder -> tests; pass -> done; fail -> failed(halt)
{ const s = inst("grind-loop"); s.loops = []; s.nodes.push({ id: "failed", kind: "stop", name: "Failed", outcome: "halt" }); s.edges.find((e) => e.id === "e-tests-fail").to = "failed"; delete s.edges.find((e) => e.id === "e-tests-fail").evidence;
  both("no loop: tests fail -> a stop that halts, pass -> done: the halting stop made to end in success (failing tests end in success)", s, (w) => { w.nodes.find((n) => n.id === "failed").outcome = "success"; });
  both("the same graph: the halting stop made an agent that leads to done", s, (w) => { const i = w.nodes.findIndex((n) => n.id === "failed"); w.nodes[i] = { id: "failed", kind: "agent", name: "Failed", role: "builder", brief: "Note it.", outputs: ["N.md"], allow: ["read-files", "write-outputs"] }; w.edges.push({ id: "e-failed-done", from: "failed", to: "done" }); }); }
// 2. a critic with no person in the graph: its verdict leads to a stop that halts; made to end in success
for (const id of ["contradiction-seeker", "red-team-loop", "dual-bar"]) { const s = inst(id); const critic = s.nodes.find((n) => ["critic", "judge", "red-team"].includes(n.role)); s.nodes.push({ id: "gave-up", kind: "stop", name: "Gave up", outcome: "halt" }); s.edges.push({ id: "e-critic-broken", from: critic.id, to: "gave-up", when: { verdict: "invalid-evidence" } });
  both(`${id} (a critic, no person) + a stop that halts on the critic's verdict: that stop made to end in success`, s, (w) => { w.nodes.find((n) => n.id === "gave-up").outcome = "success"; }); }
// 3. a loop's cap leads on to a stop that halts (escalates); that stop made to end in success: with a check, with a critic
{ const s = inst("grind-loop"); s.nodes.push({ id: "gave-up", kind: "stop", name: "Gave up", outcome: "halt" }); s.loops[0].stops[0].then = "gave-up";
  both("grind-loop, its round cap leading on to a stop that halts: that stop made to end in success", s, (w) => { w.nodes.find((n) => n.id === "gave-up").outcome = "success"; }); }
