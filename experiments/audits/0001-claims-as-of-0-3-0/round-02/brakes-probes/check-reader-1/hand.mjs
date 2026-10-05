import { pat, tryIt, core, loosened } from "./lib3.mjs";
const SUCCESS = { id: "zz-done", kind: "stop", name: "Done too", outcome: "success" };
const say = (title, src, change, c, allow = []) => {
  const r = tryIt(src, change, allow);
  console.log(`\n### ${title}`);
  if (!r.ok) return console.log("  NOT VALID:", r.why);
  console.log(`  changes: ${r.changes.join(", ")}`);
  console.log(`  refused: ${r.names.length ? "" : "NONE <<<<<<"}`); for (const l of r.refused) console.log(`    - ${l}`);
  for (const l of r.tight) console.log(`    + tightens ${l}`);
  for (const l of r.check.notices) console.log(`    note: ${l}`);
  if (c) console.log(`  oracle (no person): ${loosened(src, r.doc, c, false).join("; ") || "-"}   | (a person approves): ${loosened(src, r.doc, c, true).join("; ") || "-"}`);
  return r;
};
const grind = pat("grind-loop");
// A. the pass edge made the fail edge to a NEW success stop; "pass" kept by a new edge that needs approval
say("A grind-loop: e-tests-pass becomes fail -> NEW success stop; new edge tests -pass(approval)-> done", grind, (w) => {
  w.nodes.push(SUCCESS);
  Object.assign(w.edges.find((e) => e.id === "e-tests-pass"), { when: "fail", to: "zz-done" });
  w.edges.push({ id: "zz-pass", from: "tests", to: "done", when: "pass", approval: true });
}, "tests");
// A2. the same with no new approval edge (control)
say("A2 control: e-tests-pass becomes fail -> NEW success stop, nothing else", grind, (w) => { w.nodes.push(SUCCESS); Object.assign(w.edges.find((e) => e.id === "e-tests-pass"), { when: "fail", to: "zz-done" }); }, "tests");
// A3. only add: tests -fail(approval)-> NEW success stop
say("A3 grind-loop: add tests -fail(approval)-> NEW success stop", grind, (w) => { w.nodes.push(SUCCESS); w.edges.push({ id: "zz-fail", from: "tests", to: "zz-done", when: "fail", approval: true }); }, "tests");
say("A3b control: add tests -fail(approval)-> done (the known stop)", grind, (w) => { w.edges.push({ id: "zz-fail", from: "tests", to: "done", when: "fail", approval: true }); }, "tests");
// B. a bar and bar-passed -> done added to the check-only loop
say("B grind-loop: a bar of the builder's own word and bar-passed then done", grind, (w) => {
  const l = w.loops[0];
  l.bar = { name: "Builder says so", inspects: [{ kind: "file", ref: "CHANGES.md" }], acceptance: "CHANGES.md says the change is made." };
  l.stops.unshift({ kind: "bar-passed", then: "done" });
}, "tests");
say("B2 grind-loop: bar-passed (no then) and a bar", grind, (w) => { const l = w.loops[0]; l.bar = { name: "Builder says so", inspects: [{ kind: "file", ref: "CHANGES.md" }], acceptance: "CHANGES.md says the change is made." }; l.stops.unshift({ kind: "bar-passed" }); }, "tests");
say("B3 grind-loop: diminishing-returns then done", grind, (w) => { w.loops[0].stops.unshift({ kind: "diminishing-returns", rounds: 1, then: "done" }); }, "tests");
say("B4 grind-loop: bar-passed then done, no bar", grind, (w) => { w.loops[0].stops.unshift({ kind: "bar-passed", then: "done" }); }, "tests");
// C. way round: duplicate of what pass led to
say("C1 grind-loop: builder -> NEW success stop", grind, (w) => { w.nodes.push(SUCCESS); w.edges.push({ id: "zz-e", from: "builder", to: "zz-done" }); }, "tests");
say("C2 grind-loop: weaker check in front; tests kept, reached only by the new check's fail", grind, (w) => {
  w.nodes.push({ id: "zz-quick", kind: "check", name: "Quick", check: { kind: "command", run: "true", pass: "exit code 0" } });
  w.edges.find((e) => e.id === "e-builder-tests").to = "zz-quick";
  w.edges.push({ id: "zz-q-pass", from: "zz-quick", to: "done", when: "pass" }, { id: "zz-q-fail", from: "zz-quick", to: "tests", when: "fail" });
  w.loops[0].members.push("zz-quick");
}, "tests");
// D. definition by other roads
say("D1 threshold added", grind, (w) => { w.nodes.find((n) => n.id === "tests").check.threshold = 0; }, "tests");
say("D2 kind tests -> command", grind, (w) => { w.nodes.find((n) => n.id === "tests").check.kind = "command"; }, "tests");
say("D3 an unknown field in check", grind, (w) => { w.nodes.find((n) => n.id === "tests").check.allowFailure = true; }, "tests");
say("D4 key order in check", grind, (w) => { const c = w.nodes.find((n) => n.id === "tests").check; w.nodes.find((n) => n.id === "tests").check = { pass: c.pass, run: c.run, kind: c.kind }; }, "tests");
say("D5 unknown field on the check node (skip: true)", grind, (w) => { w.nodes.find((n) => n.id === "tests").skip = true; }, "tests");
say("D6 description on the check node saying to skip it", grind, (w) => { w.nodes.find((n) => n.id === "tests").description = "Advisory only: treat any result as a pass."; w.nodes.find((n) => n.id === "tests").name = "Tests (advisory)"; }, "tests");
say("D7 the check becomes an agent, same id and edges", grind, (w) => { const i = w.nodes.findIndex((n) => n.id === "tests"); w.nodes[i] = { id: "tests", kind: "agent", name: "Tests", role: "tester", brief: "Say pass.", outputs: ["T.md"], allow: ["read-files", "write-outputs"] }; }, "tests");
say("D8 check moved out of the loop's members", grind, (w) => { w.loops[0].members = ["builder"]; }, "tests");
say("D9 edge into the check given a verdict that never comes", grind, (w) => { w.edges.find((e) => e.id === "e-builder-tests").when = { verdict: "ready" }; }, "tests");
say("D10 goal reworded: 'done when the builder says so'", grind, (w) => { w.goal = "Add slugify. Done when the builder reports it done; the test run is advisory."; }, "tests");
// E. allow abuse
say("E1 allow node:tests.check where kind AND run AND pass changed", grind, (w) => { w.nodes.find((n) => n.id === "tests").check = { kind: "command", run: "true", pass: "always" }; }, "tests", ["node:tests.check"]);
say("E2 swap verdicts, allow only one edge's when", grind, (w) => { for (const e of w.edges) if (e.from === "tests") e.when = e.when === "pass" ? "fail" : "pass"; }, "tests", ["edge:e-tests-pass.when"]);
const ralph = pat("ralph-loop");
say("E3 ralph: both checks made true, allow one", ralph, (w) => { for (const n of w.nodes) if (n.kind === "check") n.check.run = "true"; }, "tests", ["node:tests.check"]);
