import { existsSync, readFileSync, statSync } from "node:fs";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { networkInterfaces } from "node:os";
import { extname, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

import { canonicalizeRunBundle, runStateLine, sessionLine } from "@grooph/core";

import { EVENTS_DIR, readLive, type EventSource } from "../events-io.js";
import type { Output } from "../print.js";
import { isGraphDir, isRunDir, newestRun, readRun, type LoadedRun } from "../run-io.js";
import { LoadError, shown, type OpenUrl } from "../share-io.js";

export const WATCH_HELP = `grooph watch [<run dir> | <graph dir>] [--sessions] [--events <source>]... [--port 4174] [--host 127.0.0.1] [--open]

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
  --port <n>    default 4174; 0 picks a free one
  --host <h>    default 127.0.0.1, this machine only. Another address (0.0.0.0 for every
                interface) lets anyone on that network read all of it while watch runs.
  --open        open the view in the default browser

It writes nothing, needs no credentials, and stops with Ctrl-C. It is a local viewer, not a
backend: the app it serves makes no request except to this server. A run whose package's
subagents the hook has seen shows them running at once, before the lead has noted anything.`;

/** Where the app is served, as the production build expects (vite base `/grooph/`). */
export const APP_BASE = "/grooph/";
/** The one endpoint: the current run bundle. */
export const ENDPOINT = `${APP_BASE}api/run.json`;
/** The other endpoint: every session the event hook has recorded (docs/subagents.md §6). */
export const LIVE_ENDPOINT = `${APP_BASE}api/live.json`;
/** The route the app opens for a live run. */
export const LIVE_ROUTE = "#/run?live";
/** The route the app opens for the sessions. */
export const SESSIONS_ROUTE = "#/live";

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

/**
 * The built web app: `GROOPH_WEB_DIST` when it is set, else `apps/web/dist` in
 * the clone this CLI runs from (the CLI is linked from a clone; decision
 * 0001's "same web bundle, served locally"). Undefined when it is not built.
 */
export function findWebDist(env: NodeJS.ProcessEnv = process.env): string | undefined {
  const dir = resolve(env["GROOPH_WEB_DIST"] ?? fileURLToPath(new URL("../../../../../apps/web/dist/", import.meta.url)));
  return existsSync(join(dir, "index.html")) ? dir : undefined;
}

const TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".map": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".txt": "text/plain; charset=utf-8",
  ".webmanifest": "application/manifest+json",
  ".woff2": "font/woff2",
};

const LOOPBACK = new Set(["127.0.0.1", "localhost", "::1", "[::1]"]);
export const isLoopback = (host: string): boolean => LOOPBACK.has(host);

export type Watcher = { url: string; port: number; host: string; close: () => Promise<void> };

/**
 * Start the server. Every request reads from disk; nothing is cached and
 * nothing is written. Bound to loopback, it also refuses requests whose Host
 * is not this machine, so a web page cannot reach the run by DNS rebinding.
 */
export function startWatch(options: { target: WatchTarget; webDist: string; port: number; host: string; sessions?: boolean; events?: EventSource[] }): Promise<Watcher> {
  const dist = resolve(options.webDist);
  const root = projectRoot(options.target.path);
  const sources: EventSource[] = [{ path: root }, ...(options.events ?? [])];
  /** Where a visit to the bare address lands: the run when there is one, unless the sessions were asked for. */
  const home = (): string => {
    if (options.sessions) return SESSIONS_ROUTE;
    try {
      currentRun(options.target);
      return LIVE_ROUTE;
    } catch {
      return SESSIONS_ROUTE;
    }
  };
  let port = options.port;
  const allowedHost = (header: string | undefined): boolean => {
    if (!isLoopback(options.host)) return true;
    return header !== undefined && [`127.0.0.1:${port}`, `localhost:${port}`, `[::1]:${port}`].includes(header);
  };

  const send = (res: ServerResponse, status: number, type: string, body: string | Buffer, head: boolean, extra: Record<string, string> = {}) => {
    res.writeHead(status, { "Content-Type": type, "Content-Length": Buffer.byteLength(body), "X-Content-Type-Options": "nosniff", "Referrer-Policy": "no-referrer", ...extra });
    res.end(head ? undefined : body);
  };

  const handle = (req: IncomingMessage, res: ServerResponse): void => {
    const head = req.method === "HEAD";
    if (req.method !== "GET" && !head) return send(res, 405, "text/plain; charset=utf-8", "grooph watch is read-only\n", head, { Allow: "GET, HEAD" });
    if (!allowedHost(req.headers.host)) return send(res, 421, "text/plain; charset=utf-8", "grooph watch answers only to this machine's own address\n", head);
    const path = new URL(req.url ?? "/", "http://watch.invalid").pathname;

    if (path === "/" || path === "/grooph") {
      res.writeHead(302, { Location: `${APP_BASE}${home()}` });
      res.end();
      return;
    }
    if (path === LIVE_ENDPOINT) return send(res, 200, TYPES[".json"]!, `${JSON.stringify(readLive(sources, undefined, root))}\n`, head, { "Cache-Control": "no-store" });
    if (path === ENDPOINT) {
      try {
        const run = currentRun(options.target);
        return send(res, 200, TYPES[".json"]!, canonicalizeRunBundle(run.bundle), head, { "Cache-Control": "no-store" });
      } catch (err) {
        if (!(err instanceof LoadError)) throw err;
        return send(res, 404, TYPES[".json"]!, `${JSON.stringify({ error: err.message })}\n`, head, { "Cache-Control": "no-store" });
      }
    }
    if (!path.startsWith(APP_BASE)) return send(res, 404, "text/plain; charset=utf-8", "not found\n", head);

    let rel: string;
    try {
      rel = decodeURIComponent(path.slice(APP_BASE.length));
    } catch {
      return send(res, 400, "text/plain; charset=utf-8", "bad path\n", head);
    }
    let file = resolve(dist, rel === "" ? "index.html" : rel);
    if (file !== dist && !file.startsWith(dist + sep)) return send(res, 404, "text/plain; charset=utf-8", "not found\n", head);
    if (existsSync(file) && statSync(file).isDirectory()) file = join(file, "index.html");
    if (!existsSync(file)) return send(res, 404, "text/plain; charset=utf-8", "not found\n", head);
    return send(res, 200, TYPES[extname(file)] ?? "application/octet-stream", readFileSync(file), head, { "Cache-Control": "no-cache" });
  };

  const server = createServer((req, res) => {
    try {
      handle(req, res);
    } catch (err) {
      send(res, 500, "text/plain; charset=utf-8", `grooph watch: ${(err as Error).message}\n`, req.method === "HEAD");
    }
  });

  return new Promise((done, fail) => {
    server.once("error", fail);
    server.listen(options.port, options.host, () => {
      server.off("error", fail);
      const address = server.address();
      port = typeof address === "object" && address ? address.port : options.port;
      const shownHost = options.host === "0.0.0.0" || options.host === "::" ? "127.0.0.1" : options.host.includes(":") ? `[${options.host}]` : options.host;
      done({
        url: `http://${shownHost}:${port}${APP_BASE}${home()}`,
        port,
        host: options.host,
        close: () =>
          new Promise((closed) => {
            server.closeAllConnections();
            server.close(() => closed());
          }),
      });
    });
  });
}

/** The addresses a phone on the same network can use. */
export function lanUrls(host: string, port: number, route: string = LIVE_ROUTE): string[] {
  if (host !== "0.0.0.0" && host !== "::") return [`http://${host.includes(":") ? `[${host}]` : host}:${port}${APP_BASE}${route}`];
  return Object.values(networkInterfaces())
    .flat()
    .filter((i): i is NonNullable<typeof i> => !!i && i.family === "IPv4" && !i.internal)
    .map((i) => `http://${i.address}:${port}${APP_BASE}${route}`);
}

/** The project a watched folder belongs to: the nearest folder at or above it that holds `.grooph/`, else the folder itself. */
export function projectRoot(path: string): string {
  let dir = resolve(path);
  for (let i = 0; i < 8; i++) {
    if (existsSync(join(dir, ".grooph"))) return dir;
    const up = resolve(dir, "..");
    if (up === dir) break;
    dir = up;
  }
  return resolve(path);
}

export type WatchEnv = { openUrl: OpenUrl; signal?: AbortSignal; env?: NodeJS.ProcessEnv };

/** `grooph watch [<run dir> | <graph dir>] [--port 4174] [--host 127.0.0.1] [--open]` (docs/runs.md §3). */
export async function watchCommand(io: Output, arg: string | undefined, flags: { port: number; host: string; open: boolean; sessions?: boolean; events?: EventSource[] }, env: WatchEnv): Promise<number> {
  const target = watchTarget(arg);
  const webDist = findWebDist(env.env);
  if (!webDist) {
    io.err("grooph: the web app is not built, so there is nothing to serve. Build it with pnpm --filter @grooph/web build (or set GROOPH_WEB_DIST to a built app)");
    return 1;
  }

  let watcher: Watcher;
  try {
    watcher = await startWatch({ target, webDist, port: flags.port, host: flags.host, ...(flags.sessions ? { sessions: true } : {}), ...(flags.events ? { events: flags.events } : {}) });
  } catch (err) {
    const error = err as NodeJS.ErrnoException;
    if (error.code === "EADDRINUSE") {
      io.err(`grooph: port ${flags.port} is in use; pass --port <another>, or --port 0 for any free one`);
      return 1;
    }
    if (error.code === "EADDRNOTAVAIL" || error.code === "ENOTFOUND") {
      io.err(`grooph: cannot listen on ${flags.host}: this machine has no such address`);
      return 1;
    }
    throw err;
  }

  const what = target.kind === "run" ? shown(target.path) : target.kind === "graph" ? `the newest run under ${shown(target.path)}/runs/` : `the newest run under ${shown(target.path)}`;
  try {
    const run = currentRun(target);
    io.out(`watching ${what}${target.kind === "run" ? "" : ` (now ${run.runId})`}: ${runStateLine(run.summary)}`);
  } catch (err) {
    if (!(err instanceof LoadError)) throw err;
    io.out(`watching ${what}: nothing to show yet (${err.message}); the view waits for it`);
  }
  const live = readLive([{ path: projectRoot(target.path) }, ...(flags.events ?? [])], undefined, projectRoot(target.path));
  const working = live.sessions.filter((s) => s.state === "working").length;
  io.out(
    live.sessions.length === 0
      ? `sessions: none recorded under ${shown(join(projectRoot(target.path), EVENTS_DIR))}/ yet (grooph hooks install records them)`
      : `sessions: ${live.sessions.length} recorded, ${working} working${live.sessions.length === 1 ? ` (${sessionLine(live.sessions[0]!)})` : ""}`,
  );
  io.out(`open ${watcher.url}`);
  const route = watcher.url.slice(watcher.url.indexOf("#"));
  if (!isLoopback(flags.host)) {
    io.err("");
    io.err(`warning: listening on ${flags.host}, so anyone on this network can read this run and these sessions while watch runs; there is no password.`);
    for (const url of lanUrls(flags.host, watcher.port, route)) io.err(`from a phone on the same network: ${url}`);
  }
  io.out("read-only: re-reads the run folder and the events on every request and writes nothing. Ctrl-C stops it.");

  if (flags.open) {
    try {
      await env.openUrl(watcher.url);
    } catch (err) {
      io.err(`could not open a browser (${(err as Error).message}); open the address above by hand`);
    }
  }

  await new Promise<void>((stop) => {
    const finish = () => {
      process.off("SIGINT", finish);
      process.off("SIGTERM", finish);
      stop();
    };
    process.once("SIGINT", finish);
    process.once("SIGTERM", finish);
    if (env.signal) {
      if (env.signal.aborted) finish();
      else env.signal.addEventListener("abort", finish, { once: true });
    }
  });
  await watcher.close();
  io.out("stopped");
  return 0;
}
