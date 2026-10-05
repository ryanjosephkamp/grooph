import { run, g, bar, agent, loop, edge, node, tally, core, errorsOf } from "./lib5.mjs";
const DEB = "debate-then-build", RARE = "fresh-grind-rare-judge", SAND = "metric-sandwich";
// --- the check named among the members of a loop that had a critic and a bar
run("B1 builder+tests named among debate's members (a loop that had a critic and a bar)", DEB, (w) => void loop(w, "debate").members.push("builder", "tests"));
run("B1b and the fail edge among its back edges too", DEB, (w) => { loop(w, "debate").members.push("builder", "tests"); loop(w, "debate").back.push("e-tests-fail"); });
run("B1c tests alone named among debate's members", DEB, (w) => void loop(w, "debate").members.push("tests"));
run("B1d plan-gate, builder, tests named; debate's bar-passed given then done", DEB, (w) => { loop(w, "debate").members.push("plan-gate", "builder", "tests"); loop(w, "debate").stops[0].then = "done"; });
run("B1e debate's bar-passed given then: builder (no members change)", DEB, (w) => void (loop(w, "debate").stops[0].then = "builder"));
run("B1f debate's bar-passed given then: done", DEB, (w) => void (loop(w, "debate").stops[0].then = "done"));
// --- inner grind of rare-judge: phases had a critic. grind had none.
run("B2 phases' bar-passed then done (judge's verdict; around tests?)", RARE, (w) => void (loop(w, "phases").stops[0].then = "done"));
run("B2b grind given mode judgment + nothing", RARE, (w) => void (loop(w, "grind").mode = "judgment"));
run("B2c grind-loop: mode judgment and bar", "grind-loop", (w) => { loop(w, "grind").mode = "judgment"; loop(w, "grind").bar = bar(); });
run("B2d phases: mode grind", RARE, (w) => void (loop(w, "phases").mode = "grind"));
// --- critic leaves a loop that had one; bar rides
run("B3 sandwich: critic made a builder, bar's other fields changed", SAND, (w) => { node(w, "critic").role = "builder"; loop(w, "sandwich").bar.inspects = [{ kind: "file", ref: "CHANGES.md" }]; }, ["node:critic.role"]);
run("B3b sandwich: bar acceptance (control, held)", SAND, (w) => void (loop(w, "sandwich").bar.acceptance = "ok"));
// --- a source of my own: loop with a check AND a critic, no bar (grind mode) -> give a bar
const src = g(RARE); // grind [builder,tests]; phases [builder,tests,judge] bar=Y
{
  const s = structuredClone(src);
  // critic placed BEFORE the check in the inner loop: builder -> pre(critic) -> tests ; pre fail -> builder
  s.nodes.push({ ...agent("pre", "critic"), allow: ["read-files", "write-outputs"] });
  edge(s, "e-builder-tests").to = "pre";
  s.edges.push({ id: "e-pre-tests", from: "pre", to: "tests", when: "pass" }, { id: "e-pre-fail", from: "pre", to: "builder", when: "fail", evidence: ["notes"] });
  loop(s, "grind").members.push("pre"); loop(s, "phases").members.push("pre");
  const p = core.parseGraphText(core.canonicalize(s)).doc;
  console.log("\n(own source: grind holds builder, pre(critic), tests; errors:", errorsOf(p).map((i) => i.code + ":" + i.message.slice(0, 120)).join(" | ") || "none", ")");
  if (errorsOf(p).length === 0) {
    run("B4 own source: grind (check + a critic before it, no bar) given a bar and bar-passed", { doc: p, label: "rare-judge + critic before tests" }, (w) => { loop(w, "grind").bar = bar(); loop(w, "grind").stops.unshift({ kind: "bar-passed" }); });
    run("B4b ... and bar-passed then done", { doc: p, label: "rare-judge + critic before tests" }, (w) => { loop(w, "grind").bar = bar(); loop(w, "grind").stops.unshift({ kind: "bar-passed", then: "done" }); });
    run("B4c ... bar + critic removed from members", { doc: p, label: "rare-judge + critic before tests" }, (w) => { loop(w, "grind").bar = bar(); loop(w, "grind").stops.unshift({ kind: "bar-passed" }); loop(w, "grind").members = ["builder", "tests"]; });
  }
}
// --- had the stop and no bar / the bar and no stop (own sources on grind-loop)
for (const [label, prep] of [["grind-loop + bar-passed stop, no bar", (s) => void loop(s, "grind").stops.unshift({ kind: "bar-passed" })], ["grind-loop + bar, no bar-passed stop", (s) => void (loop(s, "grind").bar = bar())]]) {
  const s = g("grind-loop"); prep(s);
  const p = core.parseGraphText(core.canonicalize(s)).doc;
  console.log(`\n(own source: ${label}; errors: ${errorsOf(p).map((i) => i.code).join(",") || "none"})`);
  if (errorsOf(p).length) continue;
  run("B5 give the missing half", { doc: p, label }, (w) => { if (loop(w, "grind").bar) loop(w, "grind").stops.unshift({ kind: "bar-passed" }); else loop(w, "grind").bar = bar(); });
  run("B5b existing bar-passed given then: done", { doc: p, label }, (w) => { const st = loop(w, "grind").stops.find((x) => x.kind === "bar-passed"); if (!st) return false; st.then = "done"; });
  run("B5c bar's inspects/name/aspiration changed", { doc: p, label }, (w) => { const b = loop(w, "grind").bar; if (!b) return false; b.name = "Builder says so"; b.inspects = [{ kind: "checklist", ref: "the builder's own list" }]; b.aspiration = "x"; });
  run("B5d mode judgment", { doc: p, label }, (w) => void (loop(w, "grind").mode = "judgment"));
}
// --- loop re-identified with a bar; check moved between loops
run("B6 grind re-identified", "grind-loop", (w) => void (loop(w, "grind").id = "grind2"));
run("B7 ralph: tests moved to a new loop w/o bar", "ralph-loop", (w) => { loop(w, "ralph").members = ["builder", "plan-check"]; });
tally();
