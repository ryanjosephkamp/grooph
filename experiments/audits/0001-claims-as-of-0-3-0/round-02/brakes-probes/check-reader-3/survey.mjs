import { POOL } from "../check-reader-2/lib4.mjs";
const w = (e) => (typeof e.when === "object" ? e.when.verdict : (e.when ?? "always"));
for (const { file, doc } of POOL) {
  console.log(`\n== ${file}  adaptation=${doc.adaptation ?? "-"}`);
  console.log("  nodes: " + doc.nodes.map((n) => `${n.id}[${n.kind}${n.role ? ":" + n.role : ""}${n.outcome ? ":" + n.outcome : ""}${n.irreversible ? ":IRR" : ""}]`).join(" "));
  console.log("  edges: " + doc.edges.map((e) => `${e.id}(${e.from}>${e.to} ${w(e)}${e.approval ? " APPR" : ""}${e.evidence ? " ev" + e.evidence.length : ""})`).join(" "));
  for (const l of doc.loops) console.log(`  loop ${l.id} mode=${l.mode ?? "-"} members=[${l.members}] back=[${l.back}] bar=${l.bar ? "Y" : "n"} stops=${JSON.stringify(l.stops)}`);
}
