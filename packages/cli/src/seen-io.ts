/**
 * The shell side of one session's graph (`seen.ts` in core; decision 0032, point 3): finding the session's lines
 * among the events a person points at, reading what its harness kept beside it, and drawing the two as one graph.
 * It reads; it writes nothing, starts nothing and sends nothing.
 *
 * A session is read from one file: the one, among those pointed at, that holds the most of its lines. The hook
 * writes one file a session, and a copy sent elsewhere part way through is a shorter one of the same.
 */

import { resolve } from "node:path";

import { parseEvents, seenGraph, type SeenGraph, type SessionEvent } from "@grooph/core";

import { findClaudeSession, readClaudeAgents, readPlainFile, type ClaudeFilesOptions } from "./claude-files.js";
import { eventFiles, type EventSource } from "./events-io.js";
import type { Output } from "./print.js";

/** An events file larger than this is not read for a graph: a session's own file is a few hundred kilobytes after a week. */
const LARGEST_FILE = 256_000_000;

const MOMENT = /^\d{4}-\d\d-\d\dT\d\d:\d\d(:\d\d(\.\d+)?)?(Z|[+-]\d\d:?\d\d)$/;
/** Words from a file or from the command line, as they are put in a message: quoted, on one line, and not long. */
const shown = (text: string): string => JSON.stringify(text.length > 80 ? `${text.slice(0, 80)}…` : text);

export type SeenRead = { graph: SeenGraph; session: string; harnessRead: boolean } | { error: string };

/**
 * One session as a graph, from the events in `sources` and, for a Claude Code session whose files are on this
 * machine, from those files. `session` is its id, or enough of the id's beginning or end to name one session.
 */
export function readSeen(sources: EventSource[], session: string, options: { at?: string; cwd?: string; claude?: ClaudeFilesOptions } = {}): SeenRead {
  // A time with no zone would be a different moment on each machine; one that is not a time would silently be the end.
  if (options.at !== undefined && (!MOMENT.test(options.at) || Number.isNaN(Date.parse(options.at)))) return { error: `--at takes a time with its zone, such as 2026-10-04T08:16:46Z; got ${shown(options.at)}` };
  if (sources.some((source) => source.ref !== undefined)) return { error: "a git ref is not read as a graph yet: point at the events folder itself" };
  // Each file's lines for each session it holds. A session two sources hold is read from the one that holds most of it.
  const held = new Map<string, SessionEvent[]>();
  for (const source of sources) {
    for (const file of eventFiles(resolve(options.cwd ?? process.cwd(), source.path!))) {
      // A plain file and no other: a link, a pipe or a device by an events file's name (in a checkout of someone
      // else's events, say) would be followed out of the folder, or never finish being read.
      const text = readPlainFile(file, LARGEST_FILE);
      if (text === undefined) continue;
      const here = new Map<string, SessionEvent[]>();
      for (const e of parseEvents(text).events) {
        if (e.event === "plan" || e.event === "note") continue;
        const key = `${e.harness}\u0000${e.session}`;
        (here.get(key) ?? here.set(key, []).get(key)!).push(e);
      }
      for (const [key, events] of here) if (events.length > (held.get(key)?.length ?? 0)) held.set(key, events);
    }
  }
  const named = [...held].filter(([key]) => key.slice(key.indexOf("\u0000") + 1) === session);
  const like = named.length > 0 || session.length < 4 ? named : [...held].filter(([key]) => {
    const id = key.slice(key.indexOf("\u0000") + 1);
    return id.startsWith(session) || id.endsWith(session);
  });
  if (like.length === 0) return { error: `no session ${shown(session)} among the events read (grooph sessions lists them, each with the end of its id)` };
  if (like.length > 1) return { error: `${shown(session)} names ${like.length} sessions: ${like.map(([, events]) => `${shown(events[0]!.session)} (${shown(events[0]!.harness)})`).join(", ")}` };
  const events = like[0]![1];
  const id = events[0]!.session;
  // Claude Code keeps a session's files on the machine it ran on. Where this machine has none of them, the graph is
  // from the hook's lines alone, and says so; where it has the session and no subagent of it, that is read too.
  const harness = events[0]!.harness === "claude-code" && findClaudeSession(id, options.claude).length > 0 ? readClaudeAgents(id, options.claude) : undefined;
  return { graph: seenGraph(events, { ...(harness !== undefined ? { harness } : {}), ...(options.at !== undefined ? { at: options.at } : {}) }), session: id, harnessRead: harness !== undefined };
}

/** `grooph sessions --graph <session> [--at <time>] [<source>...]`: the graph as JSON, on standard output. */
export function seenCommand(io: Output, sources: EventSource[], session: string, options: { at?: string; cwd?: string; claude?: ClaudeFilesOptions } = {}): number {
  const read = readSeen(sources, session, options);
  if ("error" in read) {
    io.err(`grooph: ${read.error}`);
    return 1;
  }
  io.out(JSON.stringify(read.graph, null, 2));
  return 0;
}
