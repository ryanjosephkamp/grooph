// Which starting graphs are exportable as they are, and what brakes each has. node R/probe/fuzz/survey.mjs
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { R, core, errorsOf } from "../lib.mjs";
console.log(Object.keys(core).filter((k) => /instanti|template|fill|slot/i.test(k)).join(", "));
for (const dir of ["fixtures/valid", "patterns", "fixtures/composed"]) {
  for (const f of readdirSync(join(R, dir)).filter((f) => f.endsWith(".grooph.json"))) {
    const parsed = core.parseGraphText(readFileSync(join(R, dir, f), "utf8"));
    if (!parsed.doc) { console.log(dir, f, "UNPARSED"); continue; }
    let d = parsed.doc;
    let how = "as is";
    if (d.template) {
      try {
        const values = Object.fromEntries((d.template.slots ?? []).map((s) => [s.key, s.example]));
        const out = core.instantiate(d, { name: d.name, values });
        d = out.doc ?? out; how = "instantiated";
      } catch (e) { how = "inst failed: " + String(e.message).slice(0, 80); }
    }
    const errs = errorsOf(d);
    const gates = d.nodes.filter((n) => n.kind === "human-gate").length;
    const critics = d.nodes.filter((n) => core.isCriticFamily?.(n)).length;
    const marked = d.nodes.filter((n) => (n.irreversible ?? []).length).length;
    const appr = d.edges.filter((e) => e.approval).length;
    const stops = d.loops.map((l) => l.stops.map((s) => s.kind[0] + (s.then ? ">" : "")).join("")).join("|");
    console.log(`${dir}/${f}  [${how}] errs=${errs.map((e) => e.code).join(",") || "0"} nodes=${d.nodes.length} loops=${d.loops.length}(${stops}) gates=${gates} critics=${critics} marked=${marked} appr=${appr} adapt=${d.adaptation ?? "-"} pol=${(d.policies ?? []).map((p) => typeof p.kind === "string" ? p.kind : "custom").join(",")}`);
  }
}
