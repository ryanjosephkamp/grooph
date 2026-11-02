/**
 * Id derivation (graph-ir §1): ids are kebab-case and unique across every
 * id-bearing object in one document, the graph's own id included.
 */

import type { Graph, Id } from "../types.js";

/** A kebab-case id from free text: "Merge approval" → "merge-approval". */
export function slugify(text: string, fallback = "item"): string {
  const slug = text
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/^[^a-z]+/, "");
  return slug === "" ? fallback : slug;
}

/** `base`, or `base-2`, `base-3`, … — the first one not in `taken`. */
export function uniqueId(base: string, taken: ReadonlySet<string>): string {
  if (!taken.has(base)) return base;
  for (let n = 2; ; n++) {
    const candidate = `${base}-${n}`;
    if (!taken.has(candidate)) return candidate;
  }
}

/** Every id-bearing object in the document, the graph's own id included (graph-ir §1). */
export function allIds(doc: Graph): Set<Id> {
  const ids = new Set<Id>([doc.id]);
  for (const list of [doc.nodes, doc.edges, doc.loops, doc.groups, doc.policies, doc.notes]) {
    for (const item of list ?? []) ids.add(item.id);
  }
  return ids;
}

/**
 * An id "follows" its object's name while it is exactly the slug of that name,
 * or that slug with the numeric suffix `uniqueId` adds. Editing the id by hand
 * breaks the link.
 */
export function followsName(id: Id, name: string): boolean {
  const slug = slugify(name, "");
  if (slug === "") return true;
  return id === slug || new RegExp(`^${slug}-\\d+$`).test(id);
}
