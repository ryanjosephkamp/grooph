import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as core from "../../../../../../packages/core/dist/src/index.js";
export const { parseGraphText, parseGraph, canonicalize, placeSubgrooph, refreshSubgrooph, validate, listGroups, groupContents, extractGroup } = core;
export const root = join(dirname(fileURLToPath(import.meta.url)), "../../../../../..");
export const tpl = (name = "review-gate") => parseGraphText(readFileSync(join(root, `patterns/${name}.grooph.json`), "utf8")).doc;
export const values = { task: "the checkout flow", "test-command": "pnpm test", checklist: "docs/checklist.md" };
export const fixture = () => parseGraphText(readFileSync(join(root, "fixtures/valid/subgrooph-in-a-graph.grooph.json"), "utf8")).doc;
export const host = () => {
  const { policies, groups, ...rest } = fixture();
  const own = (id) => !id.startsWith("review-");
  return { ...rest, nodes: rest.nodes.filter((n) => own(n.id)), edges: rest.edges.filter((e) => own(e.from) && own(e.to)), loops: [] };
};
export const placed = (opts = { after: "plan", then: "release" }) => placeSubgrooph(host(), tpl(), { as: "review", values, ...opts }).doc;
export const newer = (change, version = 2, base = tpl()) => { const t = structuredClone(base); change(t); t.version = version; return t; };
export const agent = (id, role, output, extra = {}) => ({ id, kind: "agent", name: id, role, brief: `${id}: do the work.`, outputs: [output], allow: ["read-files", "write-outputs"], ...extra });
export const N = (doc, id) => doc.nodes.find((n) => n.id === id);
export const E = (doc, id) => doc.edges.find((e) => e.id === id);
export const L = (doc, id) => doc.loops.find((l) => l.id === id);
export const errs = (doc) => validate(doc, { forExport: true }).map((i) => `${i.severity === "error" ? "ERR" : "warn"} ${i.code}`);
export function show(title, before, template, opts = {}) {
  console.log(`\n=== ${title}`);
  let r;
  try { r = refreshSubgrooph(before, opts.group ?? "review", template, opts.allow ? { allow: opts.allow } : {}); }
  catch (e) { console.log("THROWS:", e.message); return undefined; }
  console.log("changes:", r.changes.map((c) => `${c.name}${c.loosens ? ` [LOOSENS: ${c.loosens}]` : ""}`));
  console.log("held:", r.held.map((c) => `${c.name}${c.waits ? ` (waits ${c.waits})` : ""}`));
  if (r.notes.length) console.log("notes:", r.notes);
  const schema = parseGraph(JSON.parse(canonicalize(r.doc)));
  console.log("schema ok:", !!schema.doc, "| validate:", schema.doc ? errs(schema.doc).join(", ") || "clean" : schema.issues.map((i) => i.message).slice(0, 3));
  return r;
}
