export * from "../refresh-reader-1/h.mjs";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { root, parseGraphText, parseGraph, canonicalize, validate, refreshSubgrooph } from "../refresh-reader-1/h.mjs";
export { reachedWithout, waysOf } from "../../../../../../packages/core/dist/src/reach.js";
export { TemplateError } from "../../../../../../packages/core/dist/src/index.js";
export const pattern = (id) => parseGraphText(readFileSync(join(root, `patterns/${id}.grooph.json`), "utf8")).doc;
export const examples = (t) => Object.fromEntries((t.template.slots ?? []).map((s) => [s.key, s.example ?? "x"]));
export const codes = (doc) => validate(doc, { forExport: true }).map((i) => `${i.severity === "error" ? "ERR" : "warn"} ${i.code}`).sort();
export const errCodes = (doc) => validate(doc, { forExport: true }).filter((i) => i.severity === "error").map((i) => `${i.code}: ${i.message}`);
export const schemaOk = (doc) => { const p = parseGraph(JSON.parse(canonicalize(doc))); return p.doc ? "ok" : p.issues.map((i) => `${i.code ?? ""} ${i.path ?? ""} ${i.message}`).slice(0, 4); };
export function run(title, before, template, opts = {}) {
  console.log(`\n=== ${title}`);
  let r;
  try { r = refreshSubgrooph(before, opts.group ?? "review", template, opts.allow ? { allow: opts.allow } : {}); }
  catch (e) { console.log(`THROWS ${e.constructor.name}: ${e.message}`); return undefined; }
  const heldNames = new Set(r.held.map((c) => c.name));
  console.log("applied:", r.changes.filter((c) => !heldNames.has(c.name)).map((c) => `${c.name}${c.loosens ? ` [loosens: ${c.loosens}]` : ""}`));
  console.log("held:   ", r.held.map((c) => `${c.name}${c.waits ? ` (waits ${c.waits})` : ` [${c.loosens}]`}`));
  if (r.notes.length) console.log("notes:  ", r.notes);
  console.log("schema:", schemaOk(r.doc), "| errors before:", errCodes(before).map((s) => s.split(":")[0]), "after:", errCodes(r.doc));
  return r;
}
