// Fifth reader's helpers (own copy of the idiom in third/fourth-reader-probe; nothing there is edited).
import { readdirSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
export const R = join(dirname(fileURLToPath(import.meta.url)), "../../../../../..");
export const SCRATCH = join(tmpdir(), "grooph-brakes-probes");
export const core = await import(join(R, "packages/core/dist/src/index.js"));
export const brakes = await import(join(R, "packages/core/dist/src/brakes.js"));
export const errorsOf = (doc) => core.validate(doc, { forExport: true }).filter((i) => i.severity === "error");
const empty = () => ({ grooph: 0, id: "host", name: "Host", version: 1, goal: "Hold a fragment.", target: { harness: "claude-code" }, nodes: [], edges: [], loops: [] });
export function pool(all = false) {
  const out = [];
  for (const dir of ["patterns", "fixtures/valid"]) for (const f of readdirSync(join(R, dir)).filter((f) => f.endsWith(".grooph.json"))) {
    const parsed = core.parseGraphText(readFileSync(join(R, dir, f), "utf8"));
    if (!parsed.doc) continue;
    let d = parsed.doc;
    try {
      if (d.template) {
        const values = Object.fromEntries((d.template.slots ?? []).map((x) => [x.key, x.example ?? "x"]));
        if (d.template.kind === "fragment") d = core.insertFragment(empty(), d, { values }).doc;
        else { const o = core.instantiate(d, { name: d.name, values }); d = o.doc ?? o; }
      }
      d = core.parseGraphText(core.canonicalize(d)).doc;
    } catch (e) { continue; }
    if (!d || errorsOf(d).length) continue;
    if (!all && !d.nodes.some((n) => n.kind === "check")) continue;
    out.push({ file: `${dir}/${f}`, name: f.replace(".grooph.json", ""), doc: d });
  }
  return out;
}
export const POOL = pool();
export const g = (name) => structuredClone(POOL.find((p) => p.name === name).doc);
export function tryIt(source, change, allow = []) {
  const working = structuredClone(source);
  if (change(working) === false) return undefined;
  const parsed = core.parseGraphText(JSON.stringify(working));
  if (!parsed.doc) return { ok: false, why: "schema: " + JSON.stringify(parsed.issues ?? "").slice(0, 300) };
  const adopted = core.adoptWorkingCopy(source, parsed.doc, { run: "probe" });
  if (!adopted.ok) return { ok: false, why: "invalid: " + adopted.issues.map((i) => i.code).join(",") };
  if (errorsOf(adopted.doc).length) return { ok: false, why: "invalid after: " + errorsOf(adopted.doc).map((i) => i.code).join(",") };
  const check = core.checkAdoption(source, adopted.doc, { allow });
  const warn = core.validate(adopted.doc, { forExport: true }).filter((i) => i.severity !== "error").map((i) => i.code);
  return { ok: true, doc: adopted.doc, check, warn, refused: check.refused.map((c) => `${c.name}: ${c.loosens}`), names: check.refused.map((c) => c.name), changes: check.changes.map((c) => c.name), tight: check.changes.filter((c) => c.tightens).map((c) => `${c.name}: ${c.tightens}`) };
}
export let THROUGH = 0, CASES = 0;
export function run(title, name, change, allow = []) {
  const src = typeof name === "string" ? g(name) : name.doc;
  const label = typeof name === "string" ? name : name.label;
  const r = tryIt(src, change, allow);
  console.log(`\n### ${title}  [${label}]${allow.length ? " allow=" + allow.join(",") : ""}`);
  if (!r) return console.log("  (not applicable)");
  if (!r.ok) return console.log("  NOT VALID: " + r.why);
  CASES += 1;
  if (r.refused.length === 0) THROUGH += 1;
  console.log(`  changes: ${r.changes.join(", ")}${r.warn.length ? "   warnings: " + [...new Set(r.warn)].join(",") : ""}`);
  console.log(`  refused: ${r.refused.length === 0 ? "NONE   <<<<<< THROUGH" : ""}`);
  for (const l of r.refused) console.log("    - " + l.slice(0, 380));
  for (const l of r.tight) console.log("    + tightens " + l.slice(0, 200));
  if (r.check.notices.length) console.log("    note: " + r.check.notices.join(" | ").slice(0, 300));
  return r;
}
export const bar = () => ({ name: "Looks done", inspects: [{ kind: "file", ref: "CHANGES.md" }], acceptance: "CHANGES.md says the change is made." });
export const agent = (id, role = "builder") => ({ id, kind: "agent", name: id, role, brief: "Write a note of what was done.", outputs: [`${id}.md`], allow: ["read-files", "write-outputs"] });
export const loop = (d, id) => d.loops.find((l) => l.id === id);
export const edge = (d, id) => d.edges.find((e) => e.id === id);
export const node = (d, id) => d.nodes.find((n) => n.id === id);
export const tally = () => console.log(`\n== ${CASES} valid cases, ${THROUGH} through`);
