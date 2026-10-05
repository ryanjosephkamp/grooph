import { run, placed, newer, N, E, L, agent, errCodes, validate } from "../refresh-reader-2/h2.mjs";
import { brakesLost } from "../../../../../../packages/core/dist/src/brakes.js";
const before = placed();
// P3b: the critic keeps its evidence strings, handed by a new node; the builder's work goes to another new node
const r = run("P3b the edge into the critic leaves a new node 'collector'; the builder leads to a new node 'ship'", before, newer((t) => {
  t.nodes.push(agent("collector", "researcher", "NOTES.md"), agent("ship", "builder", "SHIPPED.md"));
  E(t, "e-builder-critic").from = "collector";
  t.edges.push({ id: "e-builder-ship", from: "builder", to: "ship" });
}));
if (r) {
  console.log("brakesLost:", brakesLost(before, r.doc).map((l) => l.why));
  console.log("edges after:", r.doc.edges.map((e) => `${e.from}->${e.to}${e.when ? "[" + (e.when.verdict ?? e.when) + "]" : ""}`).join("  "));
  console.log("warnings after:", validate(r.doc).filter((i) => i.severity !== "error").map((i) => i.code));
}
