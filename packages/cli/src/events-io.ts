/**
 * The shell side of session events (docs/subagents.md): finding the files the
 * event hook writes, reading several into one live view, and installing the
 * hook into a project. Reading never writes; installing writes only the files
 * it names.
 */

import { execFileSync } from "node:child_process";
import { closeSync, existsSync, fstatSync, openSync, readFileSync, readSync, readdirSync, statSync } from "node:fs";
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
 *
 * One session's file may be in two sources: a session that began with no
 * branch checked out sent its first lines to one events branch and, once it
 * started a branch, the whole file to another. A line two sources both hold is
 * one event, counted once, and the session is shown under the source that
 * holds the most of it (the first named, when they hold the same).
 */
export function readLive(sources: EventSource[], now: () => Date = () => new Date(), cwd = process.cwd()): LiveView {
  type Read = SessionEvent & { source?: string };
  const all: Read[] = [];
  const issues: NonNullable<LiveView["issues"]> = [];
  // How many times each line has been kept, and how much of each session each source holds.
  const kept = new Map<string, number>();
  const held = new Map<string, number[]>();
  sources.forEach((source, at) => {
    const files = source.ref !== undefined ? refFiles(source.ref, cwd) : eventFiles(resolve(cwd, source.path)).map((file) => ({ name: basename(file), text: readTail(file) }));
    const here = new Map<string, number>();
    for (const file of files) {
      const parsed = parseEvents(file.text);
      for (const e of parsed.events) {
        const session = `${e.harness}\u0000${e.session}`;
        const counts = held.get(session) ?? held.set(session, sources.map(() => 0)).get(session)!;
        counts[at]! += 1;
        // The same line twice in one source is two events (two tool calls in one millisecond); in two sources, one.
        const line = JSON.stringify(e);
        const n = (here.get(line) ?? 0) + 1;
        here.set(line, n);
        if (n <= (kept.get(line) ?? 0)) continue;
        kept.set(line, n);
        all.push(source.name !== undefined ? { ...e, source: source.name } : e);
      }
      for (const issue of parsed.issues) issues.push({ source: file.name, ...issue });
    }
  });
  // A session two sources hold belongs to the one that holds the most of it. Where they hold the same of it (what a
  // lead said through the MCP server under an id of its own is a line or two, copied whole to both), it goes with
  // the sessions it travelled with: to the source that won the sessions those same sources share.
  const key = (e: Read): string => `${e.harness}\u0000${e.session}`;
  const winner = new Map<string, number>();
  const level: [string, number[]][] = [];
  for (const [session, counts] of held) {
    if (counts.filter((n) => n > 0).length < 2) continue;
    const most = Math.max(...counts);
    const with_ = counts.flatMap((n, i) => (n === most ? [i] : []));
    if (with_.length === 1) winner.set(session, with_[0]!);
    else level.push([session, with_]);
  }
  const outright = [...winner];
  for (const [session, with_] of level) {
    const votes = with_.map((source) => outright.filter(([other, won]) => won === source && with_.every((i) => held.get(other)![i]! > 0)).length);
    winner.set(session, with_[votes.indexOf(Math.max(...votes))]!);
  }
  for (const e of all) {
    const won = winner.get(key(e));
    if (won === undefined) continue;
    const name = sources[won]!.name;
    if (name !== undefined) e.source = name;
    else delete e.source;
  }
  // Each file is in the order it was written; across files the hooks' clocks are the only order there is.
  const ordered = all.map((e, i) => ({ e, i })).sort((a, b) => (a.e.t < b.e.t ? -1 : a.e.t > b.e.t ? 1 : a.i - b.i)).map((x) => x.e);
  return { groophLive: 0, at: now().toISOString(), sessions: summarizeSessions(ordered), ...(issues.length > 0 ? { issues } : {}) };
}

/** How the last push of a project's events went, as the push script left it in `.grooph/events/.last-push.json`. */
export type PushRecord = {
  /** a push by the hook that began and has not said how it ended: under way, or stopped dead */
  started?: string;
  /** how the last push that ended went; absent when none has ended yet */
  last?: {
    at: string;
    ok: boolean;
    /** run by a person (`grooph events push`) or by the hook at a turn's end */
    by: "hand" | "hook";
    branch?: string;
    message: string;
    /** how many times it was made before it went through, when more than once: other sessions were sending to the same branch */
    tries?: number;
    /** whether another session's push was what made it go again */
    crowded?: boolean;
    /** when the failures now running began, and how many there have been */
    failedSince?: string;
    failures?: number;
  };
  /** the last time the remote was known to hold everything this clone had */
  arrived?: { at: string; branch: string; commit: string };
};

/** The record of the last push from the project at `dir` (or from the events folder itself), when there is one that can be read. */
export function lastPush(dir: string): PushRecord | undefined {
  try {
    const nested = join(resolve(dir), EVENTS_DIR, ".last-push.json");
    const file = existsSync(nested) ? nested : join(resolve(dir), ".last-push.json");
    // A record is a small plain file. Anything else by that name is not read.
    const is = statSync(file);
    if (!is.isFile() || is.size > 100_000) return undefined;
    const json: unknown = JSON.parse(readFileSync(file, "utf8"));
    if (typeof json !== "object" || json === null || Array.isArray(json)) return undefined;
    const r = json as Record<string, unknown>;
    const time = (v: unknown): v is string => typeof v === "string" && v.length < 40 && !Number.isNaN(Date.parse(v));
    // What is printed is one line of ordinary text, whatever the file holds: a remote's words can end up in it.
    const text = (v: unknown): string | undefined => (typeof v === "string" ? v.replace(/[\u0000-\u001f\u007f-\u009f]+/g, " ").slice(0, 400) : undefined);
    const count = (v: unknown): number | undefined => (typeof v === "number" && Number.isSafeInteger(v) && v > 0 && v < 1_000_000 ? v : undefined);
    const a = r["arrived"] as Record<string, unknown> | null | undefined;
    const record: PushRecord = {
      ...(time(r["started"]) ? { started: r["started"] } : {}),
      ...(time(r["at"]) && typeof r["ok"] === "boolean"
        ? {
            last: {
              at: r["at"],
              ok: r["ok"],
              by: r["by"] === "hook" ? ("hook" as const) : ("hand" as const),
              ...(text(r["branch"]) !== undefined ? { branch: text(r["branch"])! } : {}),
              message: text(r["message"]) ?? "",
              ...(count(r["tries"]) !== undefined ? { tries: count(r["tries"])! } : {}),
              ...(r["crowded"] === true ? { crowded: true } : {}),
              ...(time(r["failedSince"]) ? { failedSince: r["failedSince"] } : {}),
              ...(count(r["failures"]) !== undefined ? { failures: count(r["failures"])! } : {}),
            },
          }
        : {}),
      ...(a && typeof a === "object" && time(a["at"]) && text(a["branch"]) !== undefined && typeof a["commit"] === "string" && /^[0-9a-f]{7,64}$/.test(a["commit"]) ? { arrived: { at: a["at"], branch: text(a["branch"])!, commit: a["commit"] } } : {}),
    };
    return record.started !== undefined || record.last !== undefined ? record : undefined;
  } catch {
    return undefined;
  }
}
