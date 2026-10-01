/**
 * The shell side of session events (docs/subagents.md): finding the files the
 * event hook writes, reading several into one live view, and installing the
 * hook into a project. Reading never writes; installing writes only the files
 * it names.
 */

import { closeSync, existsSync, fstatSync, openSync, readSync, readdirSync, statSync } from "node:fs";
import { basename, join, resolve } from "node:path";

import { parseEvents, summarizeSessions, type LiveView, type SessionEvent } from "@grooph/core";

/** Where the hook writes, under a project. */
export const EVENTS_DIR = join(".grooph", "events");

/** A file or a folder of event files, with the name its sessions are shown under. */
export type EventSource = { name?: string; path: string };

/** `lane-a=path/to/events` names a source; a bare path is named after its project folder. */
export function parseSource(arg: string): EventSource {
  const eq = arg.indexOf("=");
  if (eq > 0 && !arg.slice(0, eq).includes("/") && !arg.slice(0, eq).includes("\\")) return { name: arg.slice(0, eq), path: arg.slice(eq + 1) };
  return { path: arg };
}

/** At most this much of one file is read, from its end: a live view needs the recent past, not a week of it. */
const TAIL_BYTES = 4_000_000;

function readTail(file: string): string {
  const fd = openSync(file, "r");
  try {
    const size = fstatSync(fd).size;
    const length = Math.min(size, TAIL_BYTES);
    const buffer = Buffer.alloc(length);
    readSync(fd, buffer, 0, length, size - length);
    const text = buffer.toString("utf8");
    // Cut mid-file: the first line is partial, so it goes.
    return size > length ? text.slice(text.indexOf("\n") + 1) : text;
  } finally {
    closeSync(fd);
  }
}

/** The event files a source names: the file itself, the `*.jsonl` in a folder, or a project's `.grooph/events/`. */
export function eventFiles(path: string): string[] {
  const full = resolve(path);
  if (!existsSync(full)) return [];
  if (!statSync(full).isDirectory()) return [full];
  const nested = join(full, EVENTS_DIR);
  const dir = existsSync(nested) && statSync(nested).isDirectory() ? nested : full;
  return readdirSync(dir)
    .filter((name) => name.endsWith(".jsonl"))
    .sort()
    .map((name) => join(dir, name));
}

/**
 * Several sources as one live view: every event read, tagged with its
 * source's name, put in time order, and summed up. Sessions from different
 * machines and harnesses sit side by side; nothing is assumed about how they
 * relate.
 */
export function readLive(sources: EventSource[], now: () => Date = () => new Date()): LiveView {
  const all: (SessionEvent & { source?: string })[] = [];
  const issues: NonNullable<LiveView["issues"]> = [];
  for (const source of sources) {
    for (const file of eventFiles(source.path)) {
      const parsed = parseEvents(readTail(file));
      for (const e of parsed.events) all.push(source.name !== undefined ? { ...e, source: source.name } : e);
      for (const issue of parsed.issues) issues.push({ source: basename(file), ...issue });
    }
  }
  // Each file is in the order it was written; across files the hooks' clocks are the only order there is.
  const ordered = all.map((e, i) => ({ e, i })).sort((a, b) => (a.e.t < b.e.t ? -1 : a.e.t > b.e.t ? 1 : a.i - b.i)).map((x) => x.e);
  return { groophLive: 0, at: now().toISOString(), sessions: summarizeSessions(ordered), ...(issues.length > 0 ? { issues } : {}) };
}
