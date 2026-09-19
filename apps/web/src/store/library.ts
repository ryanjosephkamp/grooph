/** The graph list: create, import, rename, duplicate, delete. */
import { allIds, canonicalize, newGraph, parseGraphText, setGraphName, uniqueId, type Graph, type Issue } from "@grooph/core";

import { newKey, openStore, type GraphRecord } from "./db.js";

export async function listGraphs(): Promise<GraphRecord[]> {
  const store = await openStore();
  return (await store.list()).sort((a, b) => b.updatedAt - a.updatedAt);
}

async function libraryIds(): Promise<Set<string>> {
  return new Set((await (await openStore()).list()).map((r) => r.doc.id));
}

async function save(doc: Graph): Promise<GraphRecord> {
  const now = Date.now();
  const record: GraphRecord = { key: newKey(), doc, createdAt: now, updatedAt: now };
  await (await openStore()).put(record);
  return record;
}

/** A new, empty graph. No target is chosen for the user (spec §7.4): export asks for one. */
export async function createGraph(): Promise<GraphRecord> {
  const id = uniqueId("untitled-graph", await libraryIds());
  const name = id === "untitled-graph" ? "Untitled graph" : `Untitled graph ${id.slice("untitled-graph-".length)}`;
  return save(newGraph({ name, id }));
}

export async function duplicateGraph(key: string): Promise<GraphRecord | undefined> {
  const source = await (await openStore()).get(key);
  if (!source) return undefined;
  const id = uniqueId(`${source.doc.id}-copy`, await libraryIds());
  return save({ ...structuredClone(source.doc), id, name: `${source.doc.name} (copy)` });
}

/** Rename a graph; its id follows the name as core's `setGraphName` decides, unless `keepId` pins it. */
export async function renameGraph(key: string, name: string, options: { keepId?: string } = {}): Promise<void> {
  const store = await openStore();
  const record = await store.get(key);
  if (!record) return;
  const doc = setGraphName(record.doc, name);
  await store.put({ ...record, doc: options.keepId !== undefined ? keepGraphId(doc, options.keepId) : doc, updatedAt: Date.now() });
}

/** Set the graph's id back to one it had, unless an object inside it has taken that id since. */
export function keepGraphId(doc: Graph, id: string): Graph {
  if (doc.id === id) return doc;
  const taken = allIds(doc);
  taken.delete(doc.id);
  return taken.has(id) ? doc : { ...doc, id };
}

export async function deleteGraph(key: string): Promise<void> {
  await (await openStore()).delete(key);
}

export type ReadResult = { doc: Graph; issues: Issue[] } | { doc?: undefined; issues: Issue[] };

/**
 * Read a `.grooph.json` file. A document that fails the schema is still
 * accepted when the editor can hold it (its `E_SCHEMA` issues then show in
 * the panel, as they would for a graph drawn here); anything else is refused.
 */
export function readGraphFile(text: string): ReadResult {
  const parsed = parseGraphText(text);
  if (parsed.doc) return { doc: parsed.doc, issues: [] };
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return { issues: parsed.issues };
  }
  return isEditable(json) ? { doc: json, issues: parsed.issues } : { issues: parsed.issues };
}

export async function importGraph(doc: Graph): Promise<GraphRecord> {
  return save(doc);
}

/**
 * Save a graph that arrived in a link (the only way a link reaches storage).
 * The same graph saved before is not saved twice: its record is returned.
 */
export async function saveFromLink(doc: Graph): Promise<{ record: GraphRecord; existed: boolean }> {
  const text = canonicalize(doc);
  const same = (await listGraphs()).find((r) => r.doc.id === doc.id && canonicalize(r.doc) === text);
  return same ? { record: same, existed: true } : { record: await save(structuredClone(doc)), existed: false };
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const objsWith = (v: unknown, keys: string[]): boolean =>
  Array.isArray(v) && v.every((item) => isObj(item) && keys.every((k) => typeof item[k] === "string"));

/** The minimum shape the editor relies on; the schema checks everything else. */
function isEditable(json: unknown): json is Graph {
  if (!isObj(json) || typeof json["id"] !== "string" || typeof json["name"] !== "string") return false;
  if (!objsWith(json["nodes"], ["id", "kind"]) || !objsWith(json["edges"], ["id", "from", "to"])) return false;
  if (!Array.isArray(json["loops"])) return false;
  return json["loops"].every(
    (l) => isObj(l) && typeof l["id"] === "string" && Array.isArray(l["members"]) && Array.isArray(l["back"]) && Array.isArray(l["stops"]),
  );
}

