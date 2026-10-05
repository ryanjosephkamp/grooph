import { placed, newer, run, N, codes, canonicalize } from "./h2.mjs";
// The critic becomes a check node under the same id: only its role is held; the kind and the rest apply.
const r = run("the critic becomes a check that runs the tests (same id)", placed(), newer((t) => {
  const i = t.nodes.findIndex((n) => n.id === "critic");
  t.nodes[i] = { id: "critic", kind: "check", name: "Critic", check: { kind: "tests", run: "pnpm test", pass: "exit 0" } };
}));
console.log("  written node:", JSON.stringify(JSON.parse(canonicalize(r.doc)).nodes.find((n) => n.id === "review-critic")), "\n  issues:", codes(r.doc));
// and the same for a human gate -> control (held as a whole)
run("control: the gate becomes a check (same id)", placed(), newer((t) => {
  const i = t.nodes.findIndex((n) => n.id === "merge-gate");
  t.nodes[i] = { id: "merge-gate", kind: "check", name: "Merge", check: { kind: "tests", run: "pnpm test", pass: "exit 0" } };
}));
