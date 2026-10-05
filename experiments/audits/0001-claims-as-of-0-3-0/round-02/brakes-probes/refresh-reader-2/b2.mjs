import { placed, newer, N, canonicalize, parseGraph, refreshSubgrooph } from "./h2.mjs";
const before3 = placed();
N(before3, "review-builder").irreversible = ["push to main"];
const r = refreshSubgrooph(before3, "review", newer((t) => {
  const i = t.nodes.findIndex((n) => n.id === "builder");
  t.nodes[i] = { id: "builder", kind: "check", name: "Builder", check: { kind: "command", run: "make", pass: "exit 0" } };
}));
const text = canonicalize(r.doc);
const parsed = parseGraph(JSON.parse(text));
console.log("in memory:", JSON.stringify(N(r.doc, "review-builder")));
console.log("as written:", JSON.stringify(JSON.parse(text).nodes.find((n) => n.id === "review-builder")));
console.log("parse issues:", parsed.issues);
console.log("held:", r.held.map((c) => c.name));
