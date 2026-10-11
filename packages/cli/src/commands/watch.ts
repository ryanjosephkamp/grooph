import { existsSync, readFileSync, statSync } from "node:fs";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { networkInterfaces } from "node:os";
import { extname, join, resolve, sep } from "node:path";

import { isQuiet, parseMapText, sessionLine, type LiveView } from "@grooph/core";

import { EVENTS_DIR, ownSources, readLive, storeLine, type EventSource } from "../events-io.js";
import { readText } from "../io.js";
import { appDir } from "../paths.js";
import type { Output } from "../print.js";
import { LoadError, shown, type OpenUrl } from "../share-io.js";

export const WATCH_HELP = `grooph watch [--sessions] [--events <source>]... [--map <operation map>] [--port 4174] [--host 127.0.0.1] [--open]

Watch from a browser, on this machine or a phone on the same network. Serves the built
grooph app and one read-only endpoint, read again from disk on every request:

  the sessions  what the event hook has recorded (grooph hooks install): each session
                and its subagents as they start and stop, in Claude Code and in Codex

  --sessions    taken and not needed: the sessions are what watch serves
  --events <s>  more events to merge in, as often as wanted: a file, a folder of files,
                another project's folder, or git:<ref> for a branch that carries its
                .grooph/events/ (read from the watched project's repository, no checkout).
                name=<source> shows its sessions under that name. The project's own
                .grooph/events/ is always read; in a folder listed with grooph hooks watch,
                so is the record kept for it outside the project.
  --map <file>  an operation map to draw above the sessions, each of its sessions marked
                with what the hook has seen. Name each --events source for the map session
                it belongs to: --events operator=git:origin/operator.
  --port <n>    default 4174; 0 picks a free one
  --host <h>    default 127.0.0.1, this machine only. Another address (0.0.0.0 for every
                interface) lets anyone on that network read all of it while watch runs.
  --open        open the view in the default browser

It takes no folder: it serves the project it is started in, and --events adds another's.
It writes nothing, needs no credentials, and stops with Ctrl-C. It is a local viewer, not a
backend: the app it serves makes no request except to this server.`;

/** Where the app is served, as the production build expects (vite base `/grooph/`). */
export const APP_BASE = "/grooph/";
/** The endpoint: every session the event hook has recorded (docs/subagents.md §6). */
export const LIVE_ENDPOINT = `${APP_BASE}api/live.json`;
/** The route the app opens for the sessions. */
export const SESSIONS_ROUTE = "#/live";
/** Where a followed run is served, and the route the app opens for it (see `Follow`). */
export const ENDPOINT = `${APP_BASE}api/run.json`;
export const LIVE_ROUTE = "#/run?live";

/**
 * A run to serve beside the sessions. grooph's own command follows none: it reads no run folder, and its server
 * answers the run's endpoint with `NO_RUN`. The lab's `watch` gives one (lab/README.md); the app's run view, which
 * stays as a reader of what was recorded, is fed by it.
 */
export type Follow = {
  /** the folder the run is under: the events served are its project's */
  path: string;
  /** the run as its canonical bundle, read again on every request; throws a LoadError while there is none */
  bundle: () => string;
  /** the first line the command prints: what is followed and how it stands now */
  line: () => string;
};

/**
 * The built web app: `GROOPH_WEB_DIST` when it is set, else the copy the npm
 * package carries, else `apps/web/dist` in the clone this CLI runs from
 * (decision 0001's "same web bundle, served locally"). Undefined when there is none.
 */
export function findWebDist(env: NodeJS.ProcessEnv = process.env): string | undefined {
  const given = env["GROOPH_WEB_DIST"];
  if (given === undefined) return appDir();
  const dir = resolve(given);
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
/** What the run's endpoint answers when no run is followed: the app's run view shows it as the reason there is nothing to show. */
export const NO_RUN = "grooph watch follows no run: it serves the sessions the event hook has seen";

/**
 * `root` is the folder watch was started in (or the folder a followed run is under), as it was given and not yet
 * walked up to its project: the project is found from it here, and a folder listed with `grooph hooks watch` is
 * looked up by that folder itself, where its record outside the project is kept.
 */
export function startWatch(options: { root: string; webDist: string; port: number; host: string; sessions?: boolean; events?: EventSource[]; map?: string; env?: NodeJS.ProcessEnv; follow?: Follow }): Promise<Watcher> {
  /** The sessions now, and the operation map they belong on when one was given: read again each time, so an edit to the map shows. */
  const liveNow = (): LiveView => {
    const view = readLive(sources(), undefined, root);
    if (options.map === undefined) return view;
    try {
      const parsed = parseMapText(readText(options.map));
      return parsed.map ? { ...view, map: parsed.map } : view;
    } catch {
      return view;
    }
  };
  const dist = resolve(options.webDist);
  const root = projectRoot(options.root);
  /** Looked up again each time: a listed folder's record is made by its first session, which may come after this starts. */
  const sources = (): EventSource[] => [...ownSources(root, options.env, options.root).sources, ...(options.events ?? [])];
  /** Where a visit to the bare address lands: the sessions, or a followed run when there is one and the sessions were not asked for. */
  const home = (): string => {
    if (options.follow === undefined || options.sessions) return SESSIONS_ROUTE;
    try {
      options.follow.bundle();
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
    if (path === LIVE_ENDPOINT) return send(res, 200, TYPES[".json"]!, `${JSON.stringify(liveNow())}\n`, head, { "Cache-Control": "no-store" });
    if (path === ENDPOINT) {
      try {
        if (options.follow === undefined) throw new LoadError(NO_RUN);
        return send(res, 200, TYPES[".json"]!, options.follow.bundle(), head, { "Cache-Control": "no-store" });
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
export function lanUrls(host: string, port: number, route: string = SESSIONS_ROUTE): string[] {
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

export type WatchEnv = { openUrl: OpenUrl; signal?: AbortSignal; env?: NodeJS.ProcessEnv; /** where the command is run from, when not the process's own folder */ cwd?: string };

/** `grooph watch [--events <source>]... [--map <operation map>] [--port 4174] [--host 127.0.0.1] [--open]` (docs/subagents.md §6). `follow` is the lab's: see `Follow`. */
export async function watchCommand(io: Output, flags: { port: number; host: string; open: boolean; sessions?: boolean; events?: EventSource[]; map?: string }, env: WatchEnv, follow?: Follow): Promise<number> {
  if (flags.map !== undefined) {
    const parsed = parseMapText(readText(flags.map));
    if (!parsed.map) {
      io.err(`grooph: --map ${flags.map} is not an operation map grooph can read (grooph validate ${flags.map} says why)`);
      return 1;
    }
  }
  // The folder watch was started in, or the one a followed run is under, as it is: a folder listed with
  // `grooph hooks watch` is found by that folder itself, and the project by walking up from it.
  const started = follow?.path ?? env.cwd ?? process.cwd();
  const root = projectRoot(started);
  const webDist = findWebDist(env.env);
  if (!webDist) {
    io.err("grooph: the web app is not built, so there is nothing to serve. Build it with pnpm --filter @grooph/web build (or set GROOPH_WEB_DIST to a built app)");
    return 1;
  }

  let watcher: Watcher;
  try {
    watcher = await startWatch({ root: started, webDist, port: flags.port, host: flags.host, ...(flags.sessions ? { sessions: true } : {}), ...(flags.events ? { events: flags.events } : {}), ...(flags.map !== undefined ? { map: flags.map } : {}), ...(env.env ? { env: env.env } : {}), ...(follow ? { follow } : {}) });
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

  if (follow) io.out(follow.line());
  const own = ownSources(root, env.env, started);
  const live = readLive([...own.sources, ...(flags.events ?? [])], undefined, root);
  const working = live.sessions.filter((s) => s.state === "working" && !isQuiet(s, live.at)).length;
  io.out(
    live.sessions.length === 0
      ? `sessions: none recorded under ${shown(own.store?.dir ?? join(root, EVENTS_DIR))}/ yet (grooph hooks install${own.store ? " --user" : ""} records them)`
      : `sessions: ${live.sessions.length} recorded, ${working} working${live.sessions.length === 1 ? ` (${sessionLine(live.sessions[0]!, live.at)})` : ""}`,
  );
  if (own.store) io.out(storeLine(own.store));
  if (own.problem !== undefined) io.err(own.problem);
  io.out(`open ${watcher.url}`);
  const route = watcher.url.slice(watcher.url.indexOf("#"));
  if (!isLoopback(flags.host)) {
    io.err("");
    io.err(`warning: listening on ${flags.host}, so anyone on this network can read ${follow ? "this run and these sessions" : "these sessions"} while watch runs; there is no password.`);
    for (const url of lanUrls(flags.host, watcher.port, route)) io.err(`from a phone on the same network: ${url}`);
  }
  io.out(`read-only: re-reads ${follow ? "the run folder and the events" : "the events"} on every request and writes nothing. Ctrl-C stops it.`);

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
