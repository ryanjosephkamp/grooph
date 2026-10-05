// What the package compiled from the adopted document tells the lead, for the holes. node R/probe/hand/h5-package.mjs
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { R, SCRATCH, core, load, attempt, show, E, L, clone } from "../lib.mjs";
const read = (name) => core.parseGraphText(readFileSync(join(SCRATCH, "adopt-reader-1/cli", name, ".grooph/graphs/plan-review-release.grooph.json"), "utf8")).doc;
for (const name of ["01-outer-loop", "03-earlier-stop-leads-on-budget-minutes-0", "04-approval-twin"]) {
  const out = core.compile(read(name), "claude-code");
  const files = out.files ?? out;
  const lead = (Array.isArray(files) ? files : Object.entries(files).map(([path, content]) => ({ path, content }))).find((f) => /LEAD/i.test(f.path));
  const text = lead.content ?? lead.text;
  console.log(`\n=== ${name}: ${lead.path}`);
  for (const line of text.split("\n")) if (/^### Loop|Stops, evaluated|^\| \d|nested loop|e-replan|e-critic-fail-again|review-e-critic-fail|restart/.test(line)) console.log("  " + line.slice(0, 330));
}

// the pure gate version of the twin: a person is asked before every further round; a new edge goes round without asking
const base = load("fixtures/valid/subgrooph-in-a-graph.grooph.json");
const src = clone(base); E(src, "review-e-critic-fail").to = "review-merge-gate"; delete E(src, "review-e-critic-fail").evidence; L(src, "review-review").back = ["review-e-merge-gate-reject"];
console.log("\nsource (critic's fail also goes to the gate) valid:", core.validate(src, { forExport: true }).filter((i) => i.severity === "error").map((i) => i.code).join(",") || "yes");
show("GT the gate stands on every return to the builder; a new edge critic --verdict minor--> builder, counted by the same loop", attempt(src, (w) => {
  w.edges.push({ id: "e-critic-minor", from: "review-critic", to: "review-builder", when: { verdict: "minor" }, evidence: ["REVIEW.md"] });
  L(w, "review-review").back.push("e-critic-minor");
}));
