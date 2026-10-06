import { run, placed, newer, N, E, L, agent, errCodes } from "../refresh-reader-2/h2.mjs";
import { brakesLost } from "../../../../../../packages/core/dist/src/brakes.js";
import { reachedWithout } from "../../../../../../packages/core/dist/src/reach.js";
const go = (title, before, change, opts) => {
  const r = run(title, before, newer(change), opts);
  if (r) console.log("brakesLost(before, result):", brakesLost(before, r.doc).map((l) => l.why), "| reached with no person:", [...reachedWithout(r.doc, "every")].join(" "));
  return r;
};
const withThen = placed();
const alone = placed({ after: "plan" });
console.log("alone nodes:", alone.nodes.map((n) => `${n.id}:${n.kind}${n.outcome ? "/" + n.outcome : ""}`).join(" "), "| edges:", alone.edges.map((e) => `${e.id}:${e.from}->${e.to}`).join(" "), "| errors:", errCodes(alone));
console.log("alone reached with no person:", [...reachedWithout(alone, "every")].join(" "));
// P1 clean: the looser loop given a bar so that it validates
go("P1' parallel back edge in a new loop, cap 100, with a bar", withThen, (t) => {
  t.edges.push({ id: "e-critic-retry", from: "critic", to: "builder", when: { verdict: "needs-work" }, evidence: ["REVIEW.md"] });
  t.loops.push({ id: "retry", name: "Retry", members: ["builder", "critic"], back: ["e-critic-retry"], bar: { name: "Any", inspects: [{ kind: "artifact", ref: "REVIEW.md" }], acceptance: "The critic says so." }, stops: [{ kind: "bar-passed" }, { kind: "max-iterations", n: 100 }] });
});
// P9: standalone placement, a second success stop straight from the builder
go("P9 alone: adds stop done2 (success) and edge builder->done2", alone, (t) => {
  t.nodes.push({ id: "done2", kind: "stop", name: "Done early", outcome: "success" });
  t.edges.push({ id: "e-builder-done2", from: "builder", to: "done2" });
});
// P8a: standalone placement, the critic's pass re-pointed to a new success stop: the gate is kept and nobody reaches it
go("P8a alone: critic pass re-pointed to a new success stop", alone, (t) => {
  t.nodes.push({ id: "done2", kind: "stop", name: "Done early", outcome: "success" });
  E(t, "e-critic-pass").to = "done2";
});
// P8b: placement with then: the critic's pass re-pointed to a new agent that ends the work; gate kept, orphaned
go("P8b then: critic pass re-pointed to a new agent 'ship'", withThen, (t) => {
  t.nodes.push(agent("ship", "builder", "SHIPPED.md", { brief: "Merge the change and publish it." }));
  E(t, "e-critic-pass").to = "ship";
});
// P8c: with then: a new agent after the builder, in parallel with the critic
go("P8c then: adds agent 'ship' fed straight by the builder", withThen, (t) => {
  t.nodes.push(agent("ship", "builder", "SHIPPED.md", { brief: "Merge the change and publish it." }));
  t.edges.push({ id: "e-builder-ship", from: "builder", to: "ship" });
});
