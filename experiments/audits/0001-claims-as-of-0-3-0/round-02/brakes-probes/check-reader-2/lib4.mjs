export * from "../check-reader-1/lib3.mjs";
import { pool, tryIt } from "../check-reader-1/lib3.mjs";
const P = pool();
export const g = (name) => structuredClone(P.find((p) => p.file.endsWith(`/${name}.grooph.json`)).doc);
export const POOL = P;
export function run(title, name, change, allow = []) {
  const src = g(name);
  const r = tryIt(src, change, allow);
  console.log(`\n### ${title}  [${name}]${allow.length ? " allow=" + allow.join(",") : ""}`);
  if (!r) return console.log("  (not applicable)");
  if (!r.ok) return console.log("  NOT VALID: " + r.why);
  console.log(`  changes: ${r.changes.join(", ")}`);
  console.log(`  refused: ${r.refused.length === 0 ? "NONE   <<<<<< THROUGH" : ""}`);
  for (const l of r.refused) console.log("    - " + l.slice(0, 420));
  for (const l of r.tight) console.log("    + tightens " + l.slice(0, 200));
  if (r.check.notices.length) console.log("    note: " + r.check.notices.join(" | ").slice(0, 300));
  return r;
}
export const bar = () => ({ name: "Looks done", inspects: [{ kind: "file", ref: "CHANGES.md" }], acceptance: "CHANGES.md says the change is made." });
