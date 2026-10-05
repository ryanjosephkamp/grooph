import { readFileSync } from "node:fs";
for (const f of process.argv.slice(2)) {
  const d = JSON.parse(readFileSync(f, "utf8"));
  console.log(`\n== ${f}  adaptation=${d.adaptation ?? "-"} slots=${(d.slots??[]).map(s=>s.id??s.name).join(",")}`);
  for (const n of d.nodes) console.log(`  N ${n.id} [${n.kind}${n.role ? ":" + n.role : ""}${n.outcome ? ":" + n.outcome : ""}${n.irreversible ? " IRR" : ""}${n.options ? " opts=" + n.options.join("|") : ""}]`);
  for (const e of d.edges) console.log(`  E ${e.id}: ${e.from} -> ${e.to}${e.when ? " when=" + JSON.stringify(e.when) : ""}${e.approval ? " APPROVAL" : ""}${e.isolation ? " iso=" + e.isolation : ""}`);
  for (const l of d.loops) console.log(`  L ${l.id} members=${l.members.join(",")} back=${l.back.join(",")} bar=${l.bar ? "y" : "n"} stops=${JSON.stringify(l.stops)}`);
  for (const p of d.policies ?? []) console.log(`  P ${p.id} ${p.kind}`);
}
