import { createHash } from "node:crypto";
import { cpSync, existsSync, mkdtempSync, readFileSync, readdirSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import type { AddressInfo, Socket } from "node:net";
import { tmpdir } from "node:os";
import { basename, extname, join, normalize, sep } from "node:path";
import { gzipSync } from "node:zlib";

import { expect, type BrowserContext, type Page } from "@playwright/test";

import { repoRoot, requestsOut } from "./support.js";

/**
 * Handoff 0083: what the tests of a release stand on.
 *
 * A **release** is a built app in a folder of its own. Two are made from the one build the suite already has, so no
 * build is committed and none is made twice: every hashed file under `assets/` is given a new name, every mention
 * of it is rewritten, and the page and each script are stamped with the release's name. Two releases then differ
 * as two real ones do, in the names of their hashed files, and a test can tell which one a page came from and
 * which one each script it ran came from. `GROOPH_RELEASE_OLDER` and `GROOPH_RELEASE_NEWER` point the same tests
 * at two builds made from two commits (their `dist` folders), which are stamped and not renamed.
 *
 * The site serves the app and not the documents (`/grooph/docs/`), which are pages of their own that the worker
 * never touches: a picture the app takes from them is not found here, and is not counted as a failure.
 *
 * A **site** is a server of the test's own, at an address the system picks, that serves one release at a time as
 * GitHub Pages serves the app: under `/grooph/`, gzipped, and what an older release named is gone once a newer one
 * is deployed. Nothing it sends may be kept by the browser's own cache (`no-store`), so whatever answers for a file
 * the site no longer has, or after the site is closed, is the service worker. It can be made slow, as one link all
 * its answers share, and it can be told to fail a file.
 */

export const builtApp = join(repoRoot, "apps/web/dist");
export const CACHE = "grooph-app-v1";
const BASE = "/grooph/";

export type Release = {
  name: string;
  dir: string;
  /** every file the page names, as the worker reads a page: paths under the site, `/grooph/assets/App-….js` */
  named: string[];
  /** every file under `assets/`, named by the page or not */
  assets: string[];
};

const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });

/** What the worker's `named()` finds in a page (apps/web/public/sw.js), as paths. */
export function namedBy(html: string): string[] {
  const found = [...html.matchAll(/(?:src|href)="([^"]+)"/g), ...html.matchAll(/"([^"]*\/assets\/[^"]+\.(?:js|css))"/g)].map((m) => m[1]!);
  return [...new Set(found)].map((path) => new URL(path, `http://site${BASE}`)).filter((u) => u.host === "site" && u.pathname.startsWith(BASE)).map((u) => u.pathname);
}

const made: string[] = [];
/** Remove every release folder this worker process made. */
export function removeReleases(): void {
  for (const dir of made.splice(0)) rmSync(dir, { recursive: true, force: true });
}

/**
 * A release named `name`, made from the built app (or from `from`, another build's `dist`).
 * `rename: false` keeps the hashed names as they are, for a build that is a real other release already.
 * `worker: "changed"` gives it a `sw.js` of different bytes, as a release that touched the worker has.
 * `worker: "0.3.0"` gives it the worker version 0.3.0 shipped (`fixtures/sw-0.3.0.js`, a copy of that one file):
 * every visitor there is has that worker, and it is that worker that meets the first release after it.
 */
export type WorkerOf = "same" | "changed" | "0.3.0";
export function makeRelease(name: string, options: { from?: string; rename?: boolean; worker?: WorkerOf; unstamped?: Set<string> } = {}): Release {
  const from = options.from ?? builtApp;
  if (!existsSync(join(from, "index.html"))) throw new Error(`no built app in ${from}: run pnpm --filter @grooph/web build first`);
  const dir = mkdtempSync(join(tmpdir(), `grooph-release-${name}-`));
  made.push(dir);
  // The app only: source maps are not served to a visitor's worker, and the documents are pages of their own.
  cpSync(from, dir, { recursive: true, filter: (source) => !source.endsWith(".map") && source !== join(from, "docs") });

  const text = (file: string): boolean => [".html", ".js", ".css", ".json", ".webmanifest"].includes(extname(file));
  if (options.rename !== false) {
    // Vite's hashed files: `App-ClXlJ-zx.js`. A name with a version of its own (`font.v1.woff2`) is not one, and stays.
    const renames = new Map<string, string>();
    for (const file of readdirSync(join(dir, "assets"))) {
      const hashed = /^(.+)-([A-Za-z0-9_-]{8})(\.(?:js|css))$/.exec(file);
      if (!hashed) continue;
      const hash = createHash("sha256").update(`${name}:${file}`).digest("base64url").slice(0, 8);
      renames.set(file, `${hashed[1]}-${hash}${hashed[3]}`);
    }
    if (renames.size === 0) throw new Error(`no hashed file under ${from}/assets: this is not a built app`);
    for (const file of walk(dir).filter(text)) {
      let body = readFileSync(file, "utf8");
      for (const [old, fresh] of renames) body = body.split(old).join(fresh);
      writeFileSync(file, body);
    }
    for (const [old, fresh] of renames) renameSync(join(dir, "assets", old), join(dir, "assets", fresh));
  }

  // The stamps: the page says which release it is, and so does every script as it runs.
  const index = join(dir, "index.html");
  const html = readFileSync(index, "utf8");
  if (!/<html\b/.test(html)) throw new Error(`${index} has no <html> to stamp`);
  writeFileSync(index, html.replace(/<html\b/, `<html data-release="${name}"`));
  // Not a file two real builds share under one name: a hashed name never changes its bytes, in a test either.
  for (const file of walk(join(dir, "assets")).filter((f) => f.endsWith(".js") && !options.unstamped?.has(basename(f)))) {
    writeFileSync(file, `${readFileSync(file, "utf8")}\n;(globalThis.__groophReleases??=[]).push(${JSON.stringify(name)});\n`);
  }
  if (options.worker === "changed") writeFileSync(join(dir, "sw.js"), `${readFileSync(join(dir, "sw.js"), "utf8")}\n// the worker as release ${name} ships it\n`);
  if (options.worker === "0.3.0") writeFileSync(join(dir, "sw.js"), readFileSync(join(repoRoot, "apps/web/e2e/fixtures/sw-0.3.0.js")));

  return {
    name,
    dir,
    named: namedBy(readFileSync(index, "utf8")),
    assets: walk(join(dir, "assets")).map((file) => `${BASE}assets/${file.slice(join(dir, "assets").length + 1).split(sep).join("/")}`),
  };
}

/**
 * The older and the newer release: two builds named in the environment, or two made from the one build here.
 * `olderWorker` is the worker the visitor already has; `newerWorker` the one the new release ships.
 */
export function twoReleases(options: { olderWorker?: WorkerOf; newerWorker?: WorkerOf } = {}): [Release, Release] {
  const older = process.env["GROOPH_RELEASE_OLDER"];
  const newer = process.env["GROOPH_RELEASE_NEWER"];
  // Two real builds each carry the worker they were built with: that is the pair under test. A file both have under
  // one name is the same file, as an unchanged chunk is from one release to the next, and is left as it is.
  if (older && newer) {
    const names = (dist: string): string[] => readdirSync(join(dist, "assets"));
    const shared = new Set(names(older).filter((name) => names(newer).includes(name)));
    return [makeRelease("older", { from: older, rename: false, unstamped: shared }), makeRelease("newer", { from: newer, rename: false, unstamped: shared })];
  }
  return [makeRelease("older", { worker: options.olderWorker ?? "same" }), makeRelease("newer", { worker: options.newerWorker ?? "same" })];
}

const TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".webmanifest": "application/manifest+json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".txt": "text/plain; charset=utf-8",
  ".woff2": "font/woff2",
};

export type Asked = { path: string; status: number; release: string };
export type Site = {
  url: string;
  /** Replace what is served with another release: what only the earlier one had is gone, as after a deploy. */
  deploy(release: Release): void;
  /** One link every answer shares: `latencyMs` before each answer starts, `bytesPerSecond` for all of them together. */
  slow(link: { latencyMs: number; bytesPerSecond: number } | undefined): void;
  /** Answer a path that matches with a 503 until told otherwise, as a host does while a deploy is still arriving. */
  failing(match: RegExp | undefined): void;
  /** Every request answered so far, in order. */
  asked: Asked[];
  stop(): Promise<void>;
};

export async function serveSite(first: Release): Promise<Site> {
  let release = first;
  let link: { latencyMs: number; bytesPerSecond: number } | undefined;
  let failing: RegExp | undefined;
  const asked: Asked[] = [];
  const sockets = new Set<Socket>();
  const gzipped = new Map<string, Buffer>();

  // The slow link: answers wait in line and are let through a slice at a time, so six at once are no faster than one.
  const waiting: { send: (chunk: Buffer) => boolean; body: Buffer; at: number; done: () => void }[] = [];
  const TICK = 40;
  const timer = setInterval(() => {
    if (!link || waiting.length === 0) return;
    let budget = Math.max(1, Math.floor((link.bytesPerSecond * TICK) / 1000));
    while (budget > 0 && waiting.length > 0) {
      const share = Math.max(1, Math.floor(budget / waiting.length));
      for (const answer of [...waiting]) {
        const chunk = answer.body.subarray(answer.at, answer.at + share);
        answer.at += chunk.length;
        budget -= chunk.length;
        const open = answer.send(chunk);
        if (!open || answer.at >= answer.body.length) {
          waiting.splice(waiting.indexOf(answer), 1);
          answer.done();
        }
        if (budget <= 0) break;
      }
    }
  }, TICK);

  const server = createServer((request, response) => {
    const path = decodeURIComponent(new URL(request.url ?? "/", "http://localhost").pathname);
    const serving = release;
    let file = normalize(join(serving.dir, path.replace(/^\/grooph\//, "")));
    if (path.endsWith("/")) file = join(file, "index.html");
    const answer = (status: number, headers: Record<string, string>, body: Buffer): void => {
      asked.push({ path, status, release: serving.name });
      const send = (): void => {
        if (response.destroyed) return;
        response.writeHead(status, { "cache-control": "no-store", ...headers });
        if (!link || body.length === 0) {
          response.end(body);
          return;
        }
        waiting.push({ send: (chunk) => !response.destroyed && (response.write(chunk), true), body, at: 0, done: () => response.end() });
      };
      if (link) setTimeout(send, link.latencyMs);
      else send();
    };
    if (failing?.test(path)) return answer(503, { "content-type": "text/plain" }, Buffer.from("the deploy is still arriving"));
    if (!path.startsWith(BASE) || !(file + sep).startsWith(serving.dir + sep) || !existsSync(file) || !statSync(file).isFile()) {
      return answer(404, { "content-type": "text/plain" }, Buffer.from("not here"));
    }
    const type = TYPES[extname(file)] ?? "application/octet-stream";
    const plain = readFileSync(file);
    const zip = /\bgzip\b/.test(String(request.headers["accept-encoding"] ?? "")) && /^(text\/|application\/(json|manifest\+json)|image\/svg)/.test(type);
    if (!zip) return answer(200, { "content-type": type }, plain);
    if (!gzipped.has(file)) gzipped.set(file, gzipSync(plain));
    return answer(200, { "content-type": type, "content-encoding": "gzip" }, gzipped.get(file)!);
  });
  server.on("connection", (socket) => {
    sockets.add(socket);
    socket.on("close", () => sockets.delete(socket));
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;
  return {
    url: `http://127.0.0.1:${port}${BASE}`,
    asked,
    deploy: (next) => {
      release = next;
    },
    slow: (next) => {
      link = next;
    },
    failing: (match) => {
      failing = match;
    },
    stop: () =>
      new Promise((resolve) => {
        clearInterval(timer);
        for (const socket of sockets) socket.destroy();
        server.close(() => resolve());
      }),
  };
}

/** What the worker's cache holds: each file's path, and the bytes of all of them as the cache keeps them. */
export async function held(page: Page): Promise<{ paths: string[]; bytes: number }> {
  return page.evaluate(async (name) => {
    const cache = await caches.open(name);
    const paths: string[] = [];
    let bytes = 0;
    for (const key of await cache.keys()) {
      const response = await cache.match(key);
      bytes += response ? (await response.blob()).size : 0;
      paths.push(new URL(key.url).pathname);
    }
    return { paths: paths.sort(), bytes };
  }, CACHE);
}

/** What each page of a visit has asked for and not had back yet (`requestsOut`), from the moment the page was made. */
const out = new WeakMap<Page, () => string[]>();
/** Watch every page a test's context makes, so that `settled` can tell when one has nothing still arriving. Before any page is. */
export function watchVisits(context: BrowserContext): void {
  const watch = (page: Page): void => void (out.has(page) || out.set(page, requestsOut(page)));
  context.pages().forEach(watch);
  context.on("page", watch);
}

/**
 * Wait for the visit to be over: the worker in control and holding every file the release's page names, and the
 * page itself with nothing still arriving. The page fetches pieces for itself once its first screen is up (the
 * canvas screens, and since slice 0093 the built-in templates), beside the worker's own fetch of the same files; a
 * test that takes the network away the moment the worker has its copy cuts the page's off half-way, which is
 * another event than "no network after a visit".
 *
 * The files are the ones this release's page names, and not the ones the page the worker has kept names
 * (`visitIsOver` in support.ts reads those): after a deploy the kept page is still the one before until every
 * file of the new one is here, and it is the new one's that these tests wait for.
 */
export async function settled(page: Page, release: Release): Promise<void> {
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
  await expect
    .poll(async () => {
      const { paths } = await held(page);
      return release.named.filter((path) => !paths.includes(path));
    }, { message: `the worker holds every file the ${release.name} page names`, timeout: 20_000 })
    .toEqual([]);
  // The page's own fetch of the canvas screens has come in. (Playwright's "network idle" never comes with a worker in control.)
  await page.waitForFunction(() => performance.getEntriesByType("resource").some((entry) => /\/assets\/screens-[^/]*\.js$/.test(entry.name)));
  // And so has everything else the page asked for, whatever it is called: the templates, and the next piece someone
  // adds. Back, and still back a moment later.
  const waiting = out.get(page);
  if (!waiting) throw new Error("settled() was given a page nobody watched: call watchVisits(context) before the page is made");
  await expect
    .poll(
      async () => {
        if (waiting().length > 0) return waiting();
        await page.waitForTimeout(300);
        return waiting();
      },
      { message: "requests the page has sent that have not come back", timeout: 20_000 },
    )
    .toEqual([]);
}

/** Which release the page in the tab is, by its own stamp, by the stamps of the scripts it ran, and by the files it asked for. */
export async function seen(page: Page): Promise<{ page: string | undefined; scripts: string[]; assets: string[] }> {
  return page.evaluate(() => ({
    page: document.documentElement.dataset["release"],
    scripts: [...new Set((globalThis as unknown as { __groophReleases?: string[] }).__groophReleases ?? [])].sort(),
    assets: [...new Set(performance.getEntriesByType("resource").map((entry) => new URL(entry.name).pathname).filter((path) => path.includes("/assets/")))].sort(),
  }));
}

/** The page in the tab is this release and nothing else: its stamp, every script it ran, every hashed file it asked for. */
export async function expectWhole(page: Page, release: Release): Promise<void> {
  const now = await seen(page);
  expect(now.page, "the page's own stamp").toBe(release.name);
  expect(now.scripts, "the releases whose scripts ran in the page").toEqual([release.name]);
  expect(now.assets.filter((path) => !release.assets.includes(path)), `files asked for that the ${release.name} release does not have`).toEqual([]);
}
