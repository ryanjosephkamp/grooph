/**
 * The shell side of session events (docs/subagents.md): finding the files the
 * event hook writes, reading several into one live view, and installing the
 * hook into a project. Reading never writes; installing writes only the files
 * it names.
 */

import { execFileSync } from "node:child_process";
import { closeSync, existsSync, fstatSync, lstatSync, openSync, readFileSync, readSync, readdirSync, realpathSync, statSync } from "node:fs";
import { basename, dirname, isAbsolute, join, resolve, sep } from "node:path";

import { parseEvents, summarizeSessions, type LiveView, type SessionEvent } from "@grooph/core";

import { userPlaces } from "./paths.js";

/** Where the hook writes, under a project. */
export const EVENTS_DIR = join(".grooph", "events");

/**
 * Where events are read from, with the name its sessions are shown under: a
 * file or a folder of event files; or, as `ref`, a git ref whose tree holds
 * `.grooph/events/` (a lane's pushed branch: the repository is the carrier,
 * so nothing has to be checked out to read it).
 */
export type EventSource =
  | {
      name?: string;
      path: string;
      ref?: undefined;
      /**
       * This source stands behind the ones named before it: of a session one of those holds, it adds only what the
       * session itself said (a plan, a note), and nothing of what a hook saw. A project's own events folder is
       * read this way beside the record kept for it outside the project, which a session in the project cannot write.
       */
      behind?: true;
    }
  | { name?: string; ref: string; path?: undefined };

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

/** A file, or a link to one. A pipe or a folder under an event file's name is listed (status counts it) and never read: a pipe would hold the reader. */
const isFile = (path: string): boolean => {
  try {
    return statSync(path).isFile();
  } catch {
    return false;
  }
};

/** A file that is no link and has no second name. */
const isOwnFile = (path: string): boolean => {
  try {
    const is = lstatSync(path);
    return is.isFile() && is.nlink === 1;
  } catch {
    return false;
  }
};

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

// ─── The record outside the project (grooph hooks install --user) ─────────

/** A folder a person listed with `grooph hooks watch`, and the name its events are kept under in grooph's own folder. */
export type Listed = { path: string; events: string };

/** The name a listed folder's events are kept under. The hook holds the same rule (`NAME` in its file); a test holds the two together. */
export const STORE_NAME = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;

/** A folder's path with no link in it, in the letters its folders are really named in: what `grooph hooks watch` writes and what the hook compares with. */
export const exactPath = (path: string): string => {
  try {
    return realpathSync.native(path);
  } catch {
    return resolve(path);
  }
};

/** The same for a path that may not be there yet: asked of the nearest folder above it that is, with the rest put back on. */
export function exactNearest(path: string): string {
  const rest: string[] = [];
  for (let at = resolve(path); ; at = dirname(at)) {
    try {
      return join(realpathSync.native(at), ...rest);
    } catch {
      if (dirname(at) === at) return resolve(path);
      rest.unshift(basename(at));
    }
  }
}

/**
 * The list as the hook reads it: the entries it would use, in the file's order. `problem` says why a list that is
 * there could not be read, or how many of its entries the hook passes over; a list that is not there is an empty one.
 */
export function readList(file: string): { folders: Listed[]; problem?: string } {
  if (!existsSync(file)) return { folders: [] };
  try {
    const json: unknown = JSON.parse(readFileSync(file, "utf8"));
    const entries = typeof json === "object" && json !== null ? (json as { folders?: unknown }).folders : undefined;
    if (!Array.isArray(entries)) return { folders: [], problem: "it is not a list grooph wrote (no \"folders\")" };
    const folders = entries.flatMap((f: unknown): Listed[] => {
      const e = f as { path?: unknown; events?: unknown } | null;
      return typeof e?.path === "string" && isAbsolute(e.path) && typeof e.events === "string" && STORE_NAME.test(e.events) ? [{ path: resolve(e.path), events: e.events }] : [];
    });
    if (folders.length !== entries.length) return { folders, problem: `${entries.length - folders.length} of its ${entries.length} entries cannot be used (each needs a whole path and a plain folder name for its events)` };
    // Two folders under one name would have their sessions in one record. `grooph hooks watch` never writes that.
    const named = new Map<string, string>();
    for (const f of folders) {
      const other = named.get(f.events.toLowerCase());
      if (other !== undefined && other !== f.path) return { folders, problem: `two of its folders keep their events under one name (${f.events}), so their sessions are recorded together` };
      named.set(f.events.toLowerCase(), f.path);
    }
    return { folders };
  } catch (err) {
    return { folders: [], problem: (err as Error).message };
  }
}

/** The listed folder a folder is in: the innermost, where one listed folder holds another. The hook's own rule. */
export function listedFor(folders: Listed[], dir: string): Listed | undefined {
  const at = exactPath(dir);
  return folders.reduce<Listed | undefined>((best, f) => ((at === f.path || at.startsWith(f.path + sep)) && (best === undefined || f.path.length > best.path.length) ? f : best), undefined);
}

/** Where a folder's sessions are read from when it is listed: the folder in grooph's own folder, the listed folder it stands for, and the project's own events folder when that is read as well. */
export type Store = { dir: string; listed: string; beside?: string };

/**
 * What a command reads when it is given no source: the folder's own events, as before; and, where the folder is in
 * a listed one, the record kept for it outside the project.
 *
 *   - a folder that is not listed: its own `.grooph/events/`, or the event files in it. Unchanged.
 *   - a listed folder with no `.grooph/events/` of its own: the record outside the project, and nothing else.
 *   - a listed folder that has both: the record outside the project, and behind it the project's own folder. A
 *     session the record holds is read from the record: that is the one a session working in the project cannot
 *     write, and the one still being added to when an install in the project has been removed and its files
 *     left behind. Of such a session the project's folder adds only what the session itself said (a plan, a
 *     note, which `grooph mcp` writes there); a session the record does not hold is read from the project whole.
 *     A project's events folder that is a link, or is reached through one, is not read: it may lead to another
 *     folder's record.
 *
 * `from` is the folder that was asked about, when `dir` was found by walking up from it: the listing is looked up
 * for `from`, and a `dir` whose `.grooph` is grooph's own folder (a person's home) is no project, so `from` is read.
 * `problem` says why a list that is there could not be read: the record outside is then not found, and a reader says so.
 */
export function ownSources(dir: string, env: NodeJS.ProcessEnv = process.env, from: string = dir): { sources: EventSource[]; store?: Store; problem?: string } {
  const places = userPlaces(env);
  const project = exactPath(join(dir, ".grooph")) === exactPath(places.home) ? from : dir;
  const list = readList(places.list);
  const problem = list.problem !== undefined ? { problem: `the list of folders recorded outside their projects (${places.list}) could not be read whole: ${list.problem}` } : {};
  const listed = listedFor(list.folders, from);
  if (listed === undefined) return { sources: [{ path: project }], ...problem };
  const store: Store = { dir: join(places.events, listed.events), listed: listed.path };
  const nested = join(resolve(project), EVENTS_DIR);
  const folder = (path: string): boolean => {
    try {
      return lstatSync(path).isDirectory();
    } catch {
      return false;
    }
  };
  if (!(folder(dirname(nested)) && folder(nested))) return { sources: [{ path: store.dir }], store, ...problem };
  return { sources: [{ path: store.dir }, { path: nested, behind: true }], store: { ...store, beside: nested }, ...problem };
}

/** The one line a reader says when it read the record kept outside the project. */
export const storeLine = (store: Store): string =>
  store.beside === undefined
    ? `read from ${store.dir}${sep}: the sessions of ${store.listed} are recorded there, outside the project (grooph hooks status)`
    : `read from ${store.dir}${sep}, where the sessions of ${store.listed} are recorded outside the project, and from ${store.beside}${sep} for sessions that record does not hold and for what a session said (grooph hooks status)`;

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
    const behind = source.ref === undefined && source.behind === true;
    // A folder that stands behind a record is read for its own files only: a link there, or a second name for a
    // file kept elsewhere, may lead to another folder's record.
    const files = source.ref !== undefined ? refFiles(source.ref, cwd) : eventFiles(resolve(cwd, source.path)).filter(behind ? isOwnFile : isFile).map((file) => ({ name: basename(file), text: readTail(file) }));
    const here = new Map<string, number>();
    for (const file of files) {
      const parsed = parseEvents(file.text);
      for (const e of parsed.events) {
        const session = `${e.harness}\u0000${e.session}`;
        // Of a session a source named before this one holds, a source that stands behind adds only what was said.
        if (behind && e.event !== "plan" && e.event !== "note" && (held.get(session) ?? []).some((n, i) => i < at && n > 0)) continue;
        const counts = held.get(session) ?? held.set(session, sources.map(() => 0)).get(session)!;
        counts[at]! += 1;
        // The same line twice in one source is two events (two tool calls in one millisecond); in two sources, one.
        // Compared as it is sent: a copy pushed to a branch has a folder's name for its path and no transcript, and
        // is the same event as the line on the machine that sent it.
        const line = sameness(e);
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
  // the sessions it traveled with: to the source that won the sessions those same sources share.
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

/** An event as the push sends it, as text: the key two copies of one event share, wherever each was read. */
function sameness(e: SessionEvent): string {
  const { transcript: _path, ...rest } = e;
  const cwd = typeof rest.cwd === "string" ? (rest.cwd.split(/[\\/]+/).filter(Boolean).pop() ?? "") : undefined;
  return JSON.stringify(cwd === undefined ? rest : { ...rest, cwd });
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
  /** the last push that arrived: what it sent was then on the remote */
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
