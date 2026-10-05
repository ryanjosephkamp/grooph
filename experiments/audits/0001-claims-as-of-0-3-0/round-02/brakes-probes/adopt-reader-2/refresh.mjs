// The same changes as a newer template version (refreshSubgrooph) and as an adoption of the graph that refresh would write.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { R, core, load, clone, E, L, N, agent, copyNode, errorsOf } from "./plib.mjs";
const raw = (name) => core.parseGraphText(readFileSync(join(R, "patterns", `${name}.grooph.json`), "utf8")).doc;
const fixture = load("fixtures/valid/subgrooph-in-a-graph.grooph.json");
const host = () => { const { policies, groups, ...rest } = clone(fixture); const own = (id) => !id.startsWith("review-"); return { ...rest, nodes: rest.nodes.filter((n) => own(n.id)), edges: rest.edges.filter((e) => own(e.from) && own(e.to)), loops: [] }; };
const exampleValues = (t) => Object.fromEntries((t.template.slots ?? []).map((x) => [x.key, x.example]));
const big = (id, members, back, extra = {}) => ({ id, name: id, members, back, stops: [{ kind: "max-iterations", n: 1000 }], ...extra });
const bar = { name: "Bar", inspects: [{ kind: "artifact", ref: "REVIEW.md" }], acceptance: "No open finding." };

function both(label, templateName, as, mutate) {
  const t = raw(templateName);
  const placedDoc = core.parseGraphText(core.canonicalize(core.placeSubgrooph(host(), t, { as, values: exampleValues(t), after: "plan", then: "release" }).doc)).doc;
  if (errorsOf(placedDoc).length) return console.log(`\n### ${label}\n  placed graph not valid: ${JSON.stringify(errorsOf(placedDoc)).slice(0, 300)}`);
  const newer = clone(t); mutate(newer); newer.version = (t.version ?? 1) + 1;
  const parsed = core.parseGraphText(JSON.stringify(newer));
  if (!parsed.doc) return console.log(`\n### ${label}\n  newer template fails the schema: ${JSON.stringify(parsed.issues).slice(0, 300)}`);
  let r; try { r = core.refreshSubgrooph(placedDoc, as, parsed.doc, {}); } catch (e) { return console.log(`\n### ${label}\n  refresh threw: ${e.message.slice(0, 300)}`); }
  const all = core.refreshSubgrooph(placedDoc, as, parsed.doc, { allow: r.changes.map((c) => c.name) });
  const errs = errorsOf(all.doc);
  console.log(`\n### ${label}`);
  console.log(`  refresh: ${r.changes.length} changes; held ${r.held.length === 0 ? "NONE  <<<<<< applied with nothing asked" : ""}`);
  for (const c of r.held) console.log(`    - ${c.name}: ${c.loosens ?? `(waits for ${c.waits})`}`.slice(0, 330));
  console.log(`  the graph with every change applied: ${errs.length === 0 ? "valid" : "NOT valid: " + errs.map((i) => i.code).join(",")}; written by plain refresh == that graph: ${core.canonicalize(r.doc) === core.canonicalize(all.doc)}`);
  if (errs.length === 0) {
    const adopted = core.adoptWorkingCopy(placedDoc, all.doc, { run: "probe" });
    if (!adopted.ok) return console.log(`  adoption: refused earlier: ${adopted.message}`);
    const check = core.checkAdoption(placedDoc, adopted.doc, {});
    console.log(`  adoption of the same graph: refused ${check.refused.length === 0 ? "NONE  <<<<<<" : ""}`);
    for (const c of check.refused) console.log(`    - ${c.name}: ${c.loosens}`.slice(0, 330));
  }
}

both("R0 control: review-gate cap 4 -> 40", "review-gate", "review", (t) => { L(t, "review").stops[1].n = 40; });
both("R1 review-gate: unlisted helper beside builder->critic (not a member)", "review-gate", "review", (t) => { t.nodes.push(agent("helper")); t.edges.push({ id: "e-b-helper", from: "builder", to: "helper" }, { id: "e-helper-critic", from: "helper", to: "critic", evidence: ["helper.md"] }); });
both("R2 review-gate: approval put on builder->critic, and critic -> redo -> builder under a new loop cap 1000 (person on every lap: stated limit)", "review-gate", "review", (t) => { E(t, "e-builder-critic").approval = true; t.nodes.push(agent("redo")); t.edges.push({ id: "e-critic-redo", from: "critic", to: "redo", when: { verdict: "redo" } }, { id: "e-redo-builder", from: "redo", to: "builder" }); t.loops.push(big("redo-loop", ["builder", "critic", "redo"], ["e-redo-builder"], { mode: "judgment", bar })); });
both("R2b the same WITHOUT the approval (must be held)", "review-gate", "review", (t) => { t.nodes.push(agent("redo")); t.edges.push({ id: "e-critic-redo", from: "critic", to: "redo", when: { verdict: "redo" } }, { id: "e-redo-builder", from: "redo", to: "builder" }); t.loops.push(big("redo-loop", ["builder", "critic", "redo"], ["e-redo-builder"], { mode: "judgment", bar })); });
both("R3 review-gate: new human stop every 1 then: builder, first (stated limit)", "review-gate", "review", (t) => { L(t, "review").stops.unshift({ kind: "human", every: 1, then: "builder" }); });
const husk = (t) => {
  const b2 = copyNode(t, "builder", "builder2"), t2 = copyNode(t, "tests", "tests2");
  t.nodes = t.nodes.filter((n) => n.id !== "builder"); t.nodes.push(agent("stub"), b2, t2);
  t.edges = t.edges.filter((e) => e.id !== "e-builder-tests");
  E(t, "e-plan-gate-builder").to = "builder2"; E(t, "e-tests-fail").to = "stub";
  t.edges.push({ id: "e-plan-gate-stub", from: "plan-gate", to: "stub", when: "pass" }, { id: "e-stub-tests", from: "stub", to: "tests" }, { id: "e-b2-t2", from: "builder2", to: "tests2" }, { id: "e-t2-fail", from: "tests2", to: "builder2", when: "fail" }, { id: "e-t2-pass", from: "tests2", to: "done", when: "pass" });
  L(t, "build").members = ["stub", "tests"];
  t.loops.push(big("build-2", ["builder2", "tests2"], ["e-t2-fail"]));
};
both("R4 debate-then-build: the husk on its build loop (builder replaced by builder2/tests2 under a new loop cap 1000; build keeps tests + a stub)", "debate-then-build", "dtb", husk);
both("R4c control: debate-then-build build loop cap 5 -> 1000", "debate-then-build", "dtb", (t) => { L(t, "build").stops[0].n = 1000; });
