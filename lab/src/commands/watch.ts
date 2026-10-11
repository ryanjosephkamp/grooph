/**
 * `grooph watch <run dir | graph dir>` as it was through 0.4.1: the run's half of the command, moved here when it
 * left the product (slice 0103). The server and the sessions are the product's own (`@grooph/cli/commands/watch`);
 * what this adds is which run a folder means, read again on every request, handed to that server as what it follows.
 */

import { existsSync, statSync } from "node:fs";
import { resolve } from "node:path";

import { canonicalizeRunBundle, parseMapText, runStateLine } from "@grooph/core";

import { startWatch as serve, watchCommand as watch, type Follow, type WatchEnv, type Watcher } from "@grooph/cli/commands/watch";
import type { EventSource } from "@grooph/cli/events-io";
import { readText } from "@grooph/cli/io";
import type { Output } from "@grooph/cli/print";
import { LoadError, shown } from "@grooph/cli/share-io";

import { isGraphDir, isRunDir, newestRun, readRun, type LoadedRun } from "../run-io.js";

export const WATCH_HELP = `grooph watch [<run dir> | <graph dir>] [--sessions] [--events <source>]... [--map <operation map>] [--port 4174] [--host 127.0.0.1] [--open]

Watch from a browser, on this machine or a phone on the same network. Serves the built
grooph app and two read-only endpoints, read again from disk on every request:

  the run       its notes, working copy and progress, so the run view updates while the
                lead writes
  the sessions  what the event hook has recorded (grooph hooks install): each session
                and its subagents as they start and stop, in Claude Code and in Codex

  <run dir>     .grooph/<graph-id>/runs/<run-id>/: that run
  <graph dir>   .grooph/<graph-id>/: whichever of its runs is newest, followed as new ones start
  (nothing)     the newest run of any graph under ./.grooph/; if there is none, the sessions
  --sessions    open on the sessions even when there is a run
  --events <s>  more events to merge in, as often as wanted: a file, a folder of files,
                another project's folder, or git:<ref> for a branch that carries its
                .grooph/events/ (read from the watched project's repository, no checkout).
                name=<source> shows its sessions under that name. The project's own
                .grooph/events/ is always read.
  --map <file>  an operation map to draw above the sessions, each of its sessions marked
                with what the hook has seen. Name each --events source for the map session
                it belongs to: --events operator=git:origin/operator. Opens on the sessions.
  --port <n>    default 4174; 0 picks a free one
  --host <h>    default 127.0.0.1, this machine only. Another address (0.0.0.0 for every
                interface) lets anyone on that network read all of it while watch runs.
  --open        open the view in the default browser

It writes nothing, needs no credentials, and stops with Ctrl-C. It is a local viewer, not a
backend: the app it serves makes no request except to this server. A run whose package's
subagents the hook has seen shows them running at once, before the lead has noted anything.`;

export type WatchTarget = { kind: "run" | "graph" | "project"; path: string };

/** What the argument names: one run, a graph's runs, or a project's. */
export function watchTarget(arg: string | undefined, cwd = process.cwd()): WatchTarget {
  const path = resolve(cwd, arg ?? ".");
  if (!existsSync(path) || !statSync(path).isDirectory()) throw new LoadError(`${arg} is not a folder; watch takes a run folder or a graph folder under .grooph/`);
  if (isRunDir(path)) return { kind: "run", path };
  if (isGraphDir(path)) return { kind: "graph", path };
  return { kind: "project", path };
}

/** The run the target means right now. */
export const currentRun = (target: WatchTarget): LoadedRun => (target.kind === "run" ? readRun(target.path) : newestRun(target.path));

/** The target as what the product's server follows: its bundle on every request, and the line that says how it stands. */
export function follow(target: WatchTarget): Follow {
  const what = target.kind === "run" ? shown(target.path) : target.kind === "graph" ? `the newest run under ${shown(target.path)}/runs/` : `the newest run under ${shown(target.path)}`;
  return {
    path: target.path,
    bundle: () => canonicalizeRunBundle(currentRun(target).bundle),
    line: () => {
      try {
        const run = currentRun(target);
        return `watching ${what}${target.kind === "run" ? "" : ` (now ${run.runId})`}: ${runStateLine(run.summary)}`;
      } catch (err) {
        if (!(err instanceof LoadError)) throw err;
        return `watching ${what}: nothing to show yet (${err.message}); the view waits for it`;
      }
    },
  };
}

/** The server, following a target: what tests start without the command around it. */
export function startWatch(options: { target: WatchTarget; webDist: string; port: number; host: string; sessions?: boolean; events?: EventSource[]; map?: string }): Promise<Watcher> {
  const { target, ...rest } = options;
  return serve({ ...rest, root: target.path, follow: follow(target) });
}

/** `grooph watch [<run dir> | <graph dir>] [--port 4174] [--host 127.0.0.1] [--open]` (docs/runs.md §3). */
export async function watchCommand(io: Output, arg: string | undefined, flags: { port: number; host: string; open: boolean; sessions?: boolean; events?: EventSource[]; map?: string }, env: WatchEnv): Promise<number> {
  // A map that does not read is said before a folder that is not one, as it was: the product's command says it again, in the same words.
  if (flags.map !== undefined && !parseMapText(readText(flags.map)).map) {
    io.err(`grooph: --map ${flags.map} is not an operation map grooph can read (grooph validate ${flags.map} says why)`);
    return 1;
  }
  return watch(io, flags, env, follow(watchTarget(arg)));
}
