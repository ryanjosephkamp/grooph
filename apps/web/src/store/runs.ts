/**
 * Runs on the device (docs/runs.md §4), and the three things a run view may
 * write to the library, each only on the person's tap: an adopted version, a
 * copy with a proposal applied, and a note pinned to a graph.
 */
import { allIds, uniqueId, type Graph, type RunBundle, type RunNote } from "@grooph/core";

import { runKey } from "../doc/run.js";
import { openStore, type GraphRecord, type RunRecord } from "./db.js";
import { importGraph, listGraphs } from "./library.js";

export async function listRuns(): Promise<RunRecord[]> {
  return (await (await openStore()).runs.list()).sort((a, b) => b.savedAt - a.savedAt);
}

export async function getRun(key: string): Promise<RunRecord | undefined> {
  return (await openStore()).runs.get(key);
}

/** Keep a run on this device. The same run saved again replaces the older copy of it. */
export async function saveRun(bundle: RunBundle): Promise<{ record: RunRecord; replaced: boolean }> {
  const store = await openStore();
  const key = runKey(bundle);
  const replaced = (await store.runs.get(key)) !== undefined;
  const record: RunRecord = { key, graphId: bundle.working.id, run: bundle.run, bundle: structuredClone(bundle), savedAt: Date.now() };
  await store.runs.put(record);
  return { record, replaced };
}

export async function deleteRun(key: string): Promise<void> {
  await (await openStore()).runs.delete(key);
}

/** A new graph in the library: an adopted version, or a copy with a proposal applied. The source record is not touched. */
export async function saveVersion(doc: Graph): Promise<GraphRecord> {
  return importGraph(structuredClone(doc));
}

export type Pinned = { record: GraphRecord; created: boolean; already: boolean; id: string };

/**
 * Pin a note to its graph (spec §5.7): copied into `doc.notes` of the graph on
 * this device with the run's graph id, the most recently edited one when
 * there are several. When the device has none, the run's source is saved
 * with the note pinned. A note pinned before is not pinned twice; an id that
 * is taken in the graph gets a suffix.
 */
export async function pinNote(bundle: RunBundle, note: RunNote): Promise<Pinned> {
  const store = await openStore();
  const existing = (await listGraphs()).find((r) => r.doc.id === bundle.source.id);
  const doc = structuredClone(existing?.doc ?? bundle.source);
  const same = (doc.notes ?? []).find((n) => noteContent(n) === noteContent(note));
  if (same && existing) return { record: existing, created: false, already: true, id: same.id };
  const id = allIds(doc).has(note.id) ? uniqueId(note.id, allIds(doc)) : note.id;
  doc.notes = [...(doc.notes ?? []), { ...note, id }];
  if (existing) {
    const record = { ...existing, doc, updatedAt: Date.now() };
    await store.put(record);
    return { record, created: false, already: false, id };
  }
  return { record: await importGraph(doc), created: true, already: false, id };
}

/** A note without its id, keys sorted at every level: two pins of the same note compare equal. */
function noteContent(note: RunNote): string {
  const sorted = (value: unknown): unknown =>
    Array.isArray(value)
      ? value.map(sorted)
      : value !== null && typeof value === "object"
        ? Object.fromEntries(Object.keys(value).sort().map((k) => [k, sorted((value as Record<string, unknown>)[k])]))
        : value;
  const { id: _id, ...rest } = note;
  return JSON.stringify(sorted(rest));
}
