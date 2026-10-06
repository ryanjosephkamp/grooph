// Second reader's helpers. Reuses the first reader's lib (attempt/show) and adds pattern instantiation.
import { readFileSync } from "node:fs";
import { join } from "node:path";
export * from "../adopt-reader-1/lib.mjs";
import { R, core, errorsOf } from "../adopt-reader-1/lib.mjs";
export const pat = (name) => {
  const parsed = core.parseGraphText(readFileSync(join(R, "patterns", `${name}.grooph.json`), "utf8"));
  let d = parsed.doc;
  if (d.template) { const out = core.instantiate(d, { name: d.name, values: Object.fromEntries((d.template.slots ?? []).map((x) => [x.key, x.example])) }); d = out.doc ?? out; }
  if (errorsOf(d).length) throw new Error(`${name} not valid: ${JSON.stringify(errorsOf(d))}`);
  return core.parseGraphText(JSON.stringify(d)).doc;
};
export const copyNode = (doc, from, id) => ({ ...structuredClone(doc.nodes.find((n) => n.id === from)), id, name: id });
