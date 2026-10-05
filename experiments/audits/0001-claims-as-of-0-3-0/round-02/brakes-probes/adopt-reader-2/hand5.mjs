import { load, attempt, show, N, E, L, agent, clone, core, errorsOf } from "./plib.mjs";
import { personLoosened } from "../adopt-reader-1/fuzz/oracle.mjs";
// Source: glyph-vocabulary with approval on critic -> merge, and no success stop (the run ends when no edge is left: graph-ir §2 "Stop nodes").
const base = load("fixtures/valid/glyph-vocabulary.grooph.json");
const s0 = clone(base); E(s0, "e-critic-merge").approval = true; s0.nodes = s0.nodes.filter((n) => n.id !== "done"); s0.edges = s0.edges.filter((e) => e.id !== "e-ship-done");
const src = core.parseGraphText(JSON.stringify(s0)).doc; console.log("source (approval on critic->merge, no success stop) valid:", errorsOf(src).length === 0, "warnings:", [...new Set(core.validate(src, { forExport: true }).map((i) => i.code))].join(","));
const run = (title, change) => { const r = attempt(src, change); show(title, r); if (r.valid && r.refused.length === 0) console.log("  first reader's oracle, pairs that lost the person between them:", JSON.stringify(personLoosened(src, r.doc).slice(0, 8))); };
run("S1 review's bar-passed gets then: merge (beside the approved critic -> merge)", (d) => { L(d, "review").stops[0].then = "merge"; });
run("S2 a diminishing-returns stop then: merge", (d) => { L(d, "review").stops.push({ kind: "diminishing-returns", rounds: 2, then: "merge" }); });
run("S3 control: the same by an edge critic -> merge (pass), no approval", (d) => { d.edges.push({ id: "e-critic-merge-2", from: "critic", to: "merge", when: "pass" }); });
run("S4 a budget of another measure, limit 0, then: merge, first in the list", (d) => { L(d, "review").stops.unshift({ kind: "budget", measure: "tokens", limit: 0, then: "merge" }); });
