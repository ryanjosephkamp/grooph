import { run, placed, newer, tpl, N, E, L, agent, errCodes, host, placeSubgrooph, values } from "../refresh-reader-2/h2.mjs";
import { brakesLost } from "../../../../../../packages/core/dist/src/brakes.js";
import { reachedWithout } from "../../../../../../packages/core/dist/src/reach.js";
// a base template with a halt stop the critic's "invalid-evidence" verdict leads to
const base = tpl();
base.nodes.push({ id: "bail", kind: "stop", name: "Bail", outcome: "halt" });
base.edges.push({ id: "e-critic-bail", from: "critic", to: "bail", when: { verdict: "invalid-evidence" } });
for (const [label, opts] of [["then release", { after: "plan", then: "release" }], ["own stop", { after: "plan" }]]) {
  const before = placeSubgrooph(host(), base, { as: "review", values, ...opts }).doc;
  console.log(label, "errors before:", errCodes(before));
  const r = run(`P9b ${label}: the halt stop "bail" becomes a success stop`, before, newer((t) => { N(t, "bail").outcome = "success"; }, 2, base));
  if (r) console.log("brakesLost:", brakesLost(before, r.doc).map((l) => l.why), "| bail after:", JSON.stringify(r.doc.nodes.find((n) => n.id === "review-bail")), "| edges into it:", r.doc.edges.filter((e) => e.to === "review-bail" || (e.from === "review-critic" && e.to === "release")).map((e) => `${e.id}:${e.from}->${e.to}`));
}
// a policy that gains a key the schema does not know
const before = placed();
const r = run("P-policy: critic-isolation policy gains an unknown key, and a brief changes", before, newer((t) => { t.policies[0].note = "see docs"; N(t, "builder").brief += " Keep it small."; }));
