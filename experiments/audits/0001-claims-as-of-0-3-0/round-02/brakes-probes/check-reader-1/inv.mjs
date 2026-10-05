import { pool, whenOf } from "./lib3.mjs";
for (const { file, doc } of pool()) {
  const back = new Set(doc.loops.flatMap((l) => l.back));
  const k = (id) => { const n = doc.nodes.find((n) => n.id === id); return n.kind === "stop" ? `stop:${n.outcome ?? "success"}` : n.kind === "agent" ? `agent:${typeof n.role === "string" ? n.role : "custom"}` : n.kind; };
  console.log(`\n${file}  loops: ${doc.loops.map((l) => `${l.id}[${l.members.join(",")}] stops ${l.stops.map((s) => s.kind + (s.then ? "->" + s.then : "")).join("|")}${l.bar ? " BAR" : ""}`).join("; ")}`);
  for (const c of doc.nodes.filter((n) => n.kind === "check")) console.log(`  ${c.id} {${c.check.kind}: ${c.check.run ?? ""}} in: ${doc.edges.filter((e) => e.to === c.id).map((e) => e.from).join(",")}  out: ${doc.edges.filter((e) => e.from === c.id).map((e) => `${whenOf(e)}->${e.to}(${k(e.to)})${back.has(e.id) ? "*back" : ""}${e.approval ? " APPROVAL" : ""}`).join("  ")}`);
}
