// Shared helpers for the probes. Run from anywhere in the repository, after `pnpm -r build`.
// (Adapted for this folder: R is the repository, and what a probe writes goes to SCRATCH, outside it.)
import { readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
export const R = join(dirname(fileURLToPath(import.meta.url)), "../../../../../..");
export const SCRATCH = join(tmpdir(), "grooph-brakes-probes");
export const core = await import(join(R, "packages/core/dist/src/index.js"));

export const load = (rel) => {
  const parsed = core.parseGraphText(readFileSync(join(R, rel), "utf8"));
  if (!parsed.doc) throw new Error(`cannot parse ${rel}: ${JSON.stringify(parsed.issues)}`);
  return parsed.doc;
};
export const clone = (x) => structuredClone(x);
/** Round-trip through text as the CLI would read it: schema-checked. */
export const reparse = (doc) => core.parseGraphText(JSON.stringify(doc));
export const errorsOf = (doc) => core.validate(doc, { forExport: true }).filter((i) => i.severity === "error");

/**
 * The working copy = source changed by `change`. Returns what adoption + the check say with no allow.
 * { schemaOk, valid, refused: [names], reasons: [...], changes: [...], tight: [...] }
 */
export function attempt(source, change, allow = []) {
  const working = clone(source);
  change(working);
  const parsed = reparse(working);
  if (!parsed.doc) return { schemaOk: false, issues: parsed.issues };
  const adopted = core.adoptWorkingCopy(source, parsed.doc, { run: "probe" });
  if (!adopted.ok) return { schemaOk: true, valid: false, issues: adopted.issues.map((i) => `${i.code}: ${i.message}`) };
  const check = core.checkAdoption(source, adopted.doc, { allow });
  return {
    schemaOk: true,
    valid: true,
    doc: adopted.doc,
    warnings: core.validate(adopted.doc, { forExport: true }).filter((i) => i.severity !== "error").map((i) => i.code),
    changes: check.changes.map((c) => `${c.kind} ${c.name}`),
    refused: check.refused.map((c) => c.name),
    reasons: check.refused.map((c) => `${c.name}: ${c.loosens}`),
    tight: check.changes.filter((c) => c.tightens !== undefined).map((c) => `${c.name}: ${c.tightens}`),
    unknown: check.unknown,
  };
}
export const show = (title, r) => {
  console.log(`\n### ${title}`);
  if (!r.schemaOk) return console.log("  SCHEMA REJECTS:", JSON.stringify(r.issues).slice(0, 300));
  if (!r.valid) return console.log("  NOT VALID (refused earlier):", r.issues.join(" | ").slice(0, 400));
  console.log(`  changes: ${r.changes.join(", ") || "(none)"}`);
  console.log(`  refused: ${r.refused.length === 0 ? "NONE  <<<<<< adopted with no --allow" : ""}`);
  for (const line of r.reasons) console.log(`    - ${line}`);
  if (r.tight.length) { console.log("  tightens:"); for (const line of r.tight) console.log(`    + ${line}`); }
  if (r.warnings.length) console.log(`  warnings: ${[...new Set(r.warnings)].join(", ")}`);
};
export const N = (doc, id) => doc.nodes.find((n) => n.id === id);
export const E = (doc, id) => doc.edges.find((e) => e.id === id);
export const L = (doc, id) => doc.loops.find((l) => l.id === id);
export const agent = (id, role = "builder", extra = {}) => ({ id, kind: "agent", name: id, role, brief: `${id}: do the work.`, outputs: [`${id}.md`], allow: ["read-files", "write-outputs"], ...extra });
