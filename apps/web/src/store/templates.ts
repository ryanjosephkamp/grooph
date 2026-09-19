/** The person's own templates ("Yours"), on the device beside the graphs. */
import { canonicalize, type Graph } from "@grooph/core";

import { sortTemplates, templateRefusal } from "../doc/templates.js";
import { openStore, type TemplateRecord } from "./db.js";

export async function listUserTemplates(): Promise<Graph[]> {
  const store = await openStore();
  return sortTemplates((await store.templates.list()).map((r) => r.doc));
}

export async function getUserTemplate(id: string): Promise<Graph | undefined> {
  return (await (await openStore()).templates.get(id))?.doc;
}

/**
 * Save a template under its id. One with the same id is replaced only when
 * `replace` is set, and then the template's version goes up by one, as
 * `grooph template save --force` does; `lineage.from` names versions. A
 * template that carries errors is never kept (the screens refuse it first,
 * with the issues, as `grooph template save` and `add` do).
 */
export async function saveUserTemplate(doc: Graph, options: { replace?: boolean } = {}): Promise<{ saved: TemplateRecord; replaced: boolean } | { exists: Graph }> {
  if (!doc.template) throw new Error(`"${doc.id}" has no template block`);
  if (templateRefusal(doc)) throw new Error(`"${doc.id}" carries errors; Yours keeps only templates that validate`);
  const store = await openStore();
  const existing = await store.templates.get(doc.id);
  if (existing && !options.replace) return { exists: existing.doc };
  const version = existing ? Math.max(existing.doc.version, doc.version) + 1 : doc.version;
  const record: TemplateRecord = { id: doc.id, doc: { ...structuredClone(doc), version }, savedAt: Date.now() };
  await store.templates.put(record);
  return { saved: record, replaced: existing !== undefined };
}

export async function deleteUserTemplate(id: string): Promise<void> {
  await (await openStore()).templates.delete(id);
}

/** The file `grooph template add` takes: the template document in canonical form. */
export const templateFileName = (doc: Graph): string => `${doc.id}.grooph.json`;
export const templateFileText = (doc: Graph): string => canonicalize(doc);
