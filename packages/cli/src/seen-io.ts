/**
 * The shell side of one session's graph (`seen.ts` in core; decision 0032, point 3): finding the session's lines
 * among the events a person points at, reading what its harness kept beside it, and drawing the two as one graph.
 * It reads; it writes nothing, starts nothing and sends nothing.
 */

import { readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";

import { parseEvents, seenGraph, type SeenGraph, type SessionEvent } from "@grooph/core";

import { findClaudeSession, readClaudeAgents, type ClaudeFilesOptions } from "./claude-files.js";
import { eventFiles, type EventSource } from "./events-io.js";
import type { Output } from "./print.js";

/** An events file larger than this is not read for a graph: a session's own file is a few hundred kilobytes after a week. */
const LARGEST_FILE = 256_000_000;

export type SeenRead = { graph: SeenGraph; session: string; harnessRead: boolean } | { error: string };

/**
 * One session as a graph, from the events in `sources` and, for a Claude Code session whose files are on this
 * machine, from those files. `session` is its id, or enough of the id's beginning or end to name one session.
 */
export function readSeen(sources: EventSource[], session: string, options: { at?: string; cwd?: string; claude?: ClaudeFilesOptions } = {}): SeenRead {
  if (options.at !== undefined && Number.isNaN(Date.parse(options.at))) return { error: `--at takes a time, such as 2026-10-04T08:16:46Z; got ${JSON.stringify(options.at)}` };
  if (sources.some((source) => source.ref !== undefined)) return { error: "a git ref is not read as a graph yet: point at the events folder itself" };
  // Each file's lines for each session it holds. A session two sources hold is read from the one that holds most of it.
  const held = new Map<string, SessionEvent[]>();
  for (const source of sources) {
    for (const file of eventFiles(resolve(options.cwd ?? process.cwd(), source.path!))) {
      let text: string;
      try {
        if (statSync(file).size > LARGEST_FILE) continue;
        text = readFileSync(file, "utf8");
      } catch {
        continue;
      }
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
  if (like.length === 0) return { error: `no session ${JSON.stringify(session)} among the events read (grooph sessions lists them, each with the end of its id)` };
  if (like.length > 1) return { error: `${JSON.stringify(session)} names ${like.length} sessions: ${like.map(([, events]) => events[0]!.session).join(", ")}` };
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
