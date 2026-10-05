import { pool } from "../check-reader-1/lib3.mjs";
const crit = (n) => n.kind === "agent" && ["critic", "judge", "red-team"].includes(n.role);
for (const { file, doc } of pool()) {
  const checks = doc.nodes.filter((n) => n.kind === "check").map((n) => n.id);
  const critics = doc.nodes.filter(crit).map((n) => n.id);
  const loops = doc.loops.map((l) => `${l.id}[${l.members.join(",")}] back=${l.back.join(",")} mode=${l.mode ?? "-"} bar=${l.bar ? "y" : "n"} stops=${l.stops.map((s) => s.kind + (s.then ? ">" + s.then : "")).join("|")}`);
  console.log(`\n== ${file}\n  checks: ${checks.join(", ")}  critics: ${critics.join(", ")}  stops: ${doc.nodes.filter((n) => n.kind === "stop").map((n) => n.id + ":" + (n.outcome ?? "success")).join(", ")}  gates: ${doc.nodes.filter((n) => n.kind === "human-gate").map((n) => n.id).join(",")}`);
  for (const l of loops) console.log("  loop " + l);
  for (const e of doc.edges) if (checks.includes(e.from) || checks.includes(e.to)) console.log(`  ${e.id}: ${e.from} -> ${e.to} ${typeof e.when === "object" ? e.when.verdict : e.when ?? ""}${e.approval ? " APPROVAL" : ""}${e.evidence ? " ev=" + JSON.stringify(e.evidence) : ""}`);
}
