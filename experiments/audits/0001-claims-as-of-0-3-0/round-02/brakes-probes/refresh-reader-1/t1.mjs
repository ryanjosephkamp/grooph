import { placed, newer, show, N, E, L, tpl, values, host, placeSubgrooph, agent } from "./h.mjs";

// baseline
let r = show("baseline same version", placed(), tpl());

// 1a. edge `when` on the gate's exit: pass -> always (gate answer ignored)
r = show("1a gate exit when pass->always (then placement)", placed(), newer((t) => { t.edges.find((e) => e.id === "e-merge-gate-done").when = "always"; }));
console.log("  exit edge now:", JSON.stringify(E(r.doc, "e-review-merge-gate-release")));

// 1a'. the reject edge removed and exit 'always'
r = show("1a' gate exit: when removed entirely + reject edge when -> {verdict:never}", placed(), newer((t) => { delete t.edges.find((e) => e.id === "e-merge-gate-done").when; t.edges.find((e) => e.id === "e-merge-gate-reject").when = { verdict: "never" }; }));
console.log("  edges from gate:", JSON.stringify(r.doc.edges.filter((e) => e.from === "review-merge-gate")));

// 1b. non-derived edge id re-pointed by field: e-critic-pass to: merge-gate -> done; placed WITHOUT then (stop inside box)
const noThen = () => placed({ after: "plan" });
r = show("1b e-critic-pass re-pointed to done (no --then placement)", noThen(), newer((t) => { t.edges.find((e) => e.id === "e-critic-pass").to = "done"; }));
console.log("  edge:", JSON.stringify(E(r.doc, "review-e-critic-pass")), "| ways into gate:", r.doc.edges.filter((e) => e.to === "review-merge-gate").map((e) => e.id));

// 1b'. same with then placement
r = show("1b' e-critic-pass re-pointed to done (then placement)", placed(), newer((t) => { t.edges.find((e) => e.id === "e-critic-pass").to = "done"; }));

// 1c. remove the only way to the gate, nothing else
r = show("1c remove critic->gate edge only", placed(), newer((t) => { t.edges = t.edges.filter((e) => e.id !== "e-critic-pass"); }));

// 1d. gate out of loop members and back
r = show("1d gate out of loop members/back", placed(), newer((t) => { t.loops[0].members = ["builder", "critic"]; t.loops[0].back = ["e-critic-fail"]; }));

// 1e. back edges: drop e-critic-fail from back (rounds not counted)
r = show("1e drop e-critic-fail from back", placed(), newer((t) => { t.loops[0].back = ["e-merge-gate-reject"]; }));
console.log("  back:", L(r.doc, "review-review").back);

// 2. gate's own fields
r = show("2 gate prompt/options changed", placed(), newer((t) => { const g = t.nodes.find((n) => n.id === "merge-gate"); g.prompt = "Merging now. No answer is needed; reply only to object."; g.options = ["approve"]; }));
console.log("  gate:", JSON.stringify(N(r.doc, "review-merge-gate")));
