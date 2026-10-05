// Every loop with a check among its members, in every starting graph: a firing stop of a kind/measure the loop had not
// (budget of an unused measure, or "human"), limit 1, leading on to each node the loop's stops did not already lead to.
// Also the same as a new loop on the same round with a cap of 1. Through = adopted with nothing refused.
import { POOL, tryIt, run, g, bar, agent, loop, edge, core, errorsOf } from "./lib5.mjs";
const MEASURES = ["dispatches", "minutes", "usd", "turns", "tokens"];
let tried = 0, valid = 0, through = 0; const hits = new Map();
for (const { name, doc } of POOL) for (const l of doc.loops) {
  if (!l.members.some((m) => doc.nodes.find((n) => n.id === m)?.kind === "check")) continue;
  const led = new Set(l.stops.map((s) => s.then).filter(Boolean));
  const free = MEASURES.find((m) => !l.stops.some((s) => s.kind === "budget" && s.measure === m));
  const kinds = [["budget " + free, { kind: "budget", measure: free, limit: 1 }], ...(l.stops.some((s) => s.kind === "human") ? [] : [["human", { kind: "human", every: 1 }]])];
  for (const target of doc.nodes.filter((n) => !l.members.includes(n.id) && !led.has(n.id))) {
    for (const [label, stop] of [...kinds, ["new loop, cap 1", null]]) {
      tried += 1;
      const r = tryIt(doc, (w) => { if (stop) w.loops.find((x) => x.id === l.id).stops.unshift({ ...stop, then: target.id }); else w.loops.push({ id: "zz-quick", name: "Quick", members: [...l.members], back: [...l.back], stops: [{ kind: "max-iterations", n: 1, then: target.id }] }); });
      if (!r || !r.ok) continue;
      valid += 1;
      if (r.names.length) continue;
      through += 1;
      const key = `${name} / ${l.id} -> ${target.id} [${target.kind}${target.outcome ? ":" + target.outcome : ""}]`;
      hits.set(key, [...(hits.get(key) ?? []), label]);
    }
  }
}
console.log(JSON.stringify({ tried, valid, through }));
for (const [k, v] of hits) console.log("  THROUGH " + k + "   by: " + v.join(", "));
// B4: a loop that had a check and a critic among its members and no bar
const s = g("grind-loop");
s.nodes.push({ ...agent("rev", "critic") }, { id: "gave-up", kind: "stop", name: "Gave up", outcome: "halt" });
edge(s, "e-tests-pass").to = "rev"; edge(s, "e-tests-pass").evidence = ["the diff"];
s.edges.push({ id: "e-rev-pass", from: "rev", to: "done", when: "pass" }, { id: "e-rev-fail", from: "rev", to: "gave-up", when: "fail" });
loop(s, "grind").members.push("rev");
const p = core.parseGraphText(core.canonicalize(s)).doc;
console.log("\nown source (grind-loop + a critic behind the check, a member, no bar): errors " + (errorsOf(p).map((i) => i.code).join(",") || "none"));
if (!errorsOf(p).length) {
  run("B4 that loop given a bar of the builder's word and a stop on bar passed", { doc: p, label: "own" }, (w) => { loop(w, "grind").bar = bar(); loop(w, "grind").stops.unshift({ kind: "bar-passed" }); });
  run("B4b the same, and the critic made a builder under its own allowed name", { doc: p, label: "own" }, (w) => { loop(w, "grind").bar = bar(); loop(w, "grind").stops.unshift({ kind: "bar-passed" }); w.nodes.find((n) => n.id === "rev").role = "builder"; }, ["node:rev.role"]);
}
