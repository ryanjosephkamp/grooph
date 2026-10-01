/**
 * The shell side of session events (docs/subagents.md): finding the files the
 * event hook writes, reading several into one live view, and installing the
 * hook into a project. Reading never writes; installing writes only the files
 * it names.
 */

import { execFileSync } from "node:child_process";
import { closeSync, existsSync, fstatSync, openSync, readSync, readdirSync, statSync } from "node:fs";
import { basename, join, resolve, sep } from "node:path";

import { parseEvents, summarizeSessions, type LiveView, type SessionEvent } from "@grooph/core";

/** Where the hook writes, under a project. */
export const EVENTS_DIR = join(".grooph", "events");

/**
 * Where events are read from, with the name its sessions are shown under: a
 * file or a folder of event files; or, as `ref`, a git ref whose tree holds
 * `.grooph/events/` (a lane's pushed branch: the repository is the carrier,
 * so nothing has to be checked out to read it).
 */
export type EventSource = { name?: string; path: string; ref?: undefined } | { name?: string; ref: string; path?: undefined };

/** `lane-a=path/to/events` names a source; `git:<ref>` reads a ref; a bare path is shown without a name. */
export function parseSource(arg: string): EventSource {
  const eq = arg.indexOf("=");
  const named = eq > 0 && !arg.slice(0, eq).includes("/") && !arg.slice(0, eq).includes("\\") && !arg.slice(0, eq).includes(":");
  const name = named ? arg.slice(0, eq) : undefined;
  const where = named ? arg.slice(eq + 1) : arg;
  if (where.startsWith("git:")) return { ...(name !== undefined ? { name } : {}), ref: where.slice(4) };
  return { ...(name !== undefined ? { name } : {}), path: where };
}

/** Whether a source is there to read: the path exists, or the ref resolves in the repository at `cwd`. */
export function sourceExists(source: EventSource, cwd = process.cwd()): boolean {
  if (source.ref === undefined) return existsSync(resolve(cwd, source.path));
  return /^[A-Za-z0-9._\/@^~-]+$/.test(source.ref) && git(cwd, ["rev-parse", "--verify", "--quiet", `${source.ref}^{commit}`]) !== undefined;
}

function git(cwd: string, args: string[]): string | undefined {
  try {
    return execFileSync("git", ["-C", cwd, ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], maxBuffer: 64_000_000 });
  } catch {
    return undefined;
  }
}

/** The event files in a ref's tree, as `{ name, text }`; none when the ref has no `.grooph/events/`. */
function refFiles(ref: string, cwd: string): { name: string; text: string }[] {
  if (!/^[A-Za-z0-9._\/@^~-]+$/.test(ref)) return [];
  const dir = EVENTS_DIR.split(sep).join("/");
  const listed = git(cwd, ["ls-tree", "-r", "--name-only", ref, "--", dir]);
  if (listed === undefined) return [];
  return listed
    .split("\n")
    .filter((file) => file.endsWith(".jsonl"))
    .sort()
    .flatMap((file) => {
      const text = git(cwd, ["show", `${ref}:${file}`]);
      return text === undefined ? [] : [{ name: basename(file), text: text.length > TAIL_BYTES ? text.slice(text.indexOf("\n", text.length - TAIL_BYTES) + 1) : text }];
    });
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
export function readLive(sources: EventSource[], now: () => Date = () => new Date(), cwd = process.cwd()): LiveView {
  const all: (SessionEvent & { source?: string })[] = [];
  const issues: NonNullable<LiveView["issues"]> = [];
  for (const source of sources) {
    const files = source.ref !== undefined ? refFiles(source.ref, cwd) : eventFiles(resolve(cwd, source.path)).map((file) => ({ name: basename(file), text: readTail(file) }));
    for (const file of files) {
      const parsed = parseEvents(file.text);
      for (const e of parsed.events) all.push(source.name !== undefined ? { ...e, source: source.name } : e);
      for (const issue of parsed.issues) issues.push({ source: file.name, ...issue });
    }
  }
  // Each file is in the order it was written; across files the hooks' clocks are the only order there is.
  const ordered = all.map((e, i) => ({ e, i })).sort((a, b) => (a.e.t < b.e.t ? -1 : a.e.t > b.e.t ? 1 : a.i - b.i)).map((x) => x.e);
  return { groophLive: 0, at: now().toISOString(), sessions: summarizeSessions(ordered), ...(issues.length > 0 ? { issues } : {}) };
}
