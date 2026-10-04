#!/usr/bin/env node
/**
 * How long a first visit takes to show its first heading, on a throttled link, for one or more builds of the app.
 *
 *   node scripts/perf-loadtime.mjs <name>=<path to a built apps/web/dist> [<name>=<path> ...]
 *
 * Bytes are not the whole of speed: a build can weigh the same and still show later, if it fetches in more rounds.
 * This serves each build as GitHub Pages does (gzip, a short cache life), opens it seven times with nothing cached
 * on a fast and on a slow mobile link, and prints the middle time for each. The times are the browser's own, from
 * the start of the navigation: `inPage` is when the heading was first in the document, `painted` is the browser's
 * first contentful paint. (Asking the test driver to wait for the heading reads up to half a second late: it looks
 * again at widening intervals.) Compare a change against main:
 *
 *   node scripts/perf-loadtime.mjs main=../grooph-main/apps/web/dist change=apps/web/dist
 *
 * The front page is what it opens. To time another address, say which and what to wait for:
 *
 *   node scripts/perf-loadtime.mjs --at '#/templates/built-in/review-gate' --until '.react-flow__node' main=… change=…
 *
 * GitHub Pages speaks HTTP/2, where every file of a round travels on one connection. So does this, when `openssl`
 * is there to make it a certificate for the run; without it the server speaks HTTP/1.1, where a browser opens at
 * most six connections and a seventh file waits its turn, which reads as a slower page than Pages would serve.
 *
 * It needs the browser Playwright installs for the app's own tests.
 */
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
const web = resolve(dirname(fileURLToPath(import.meta.url)), "..", "apps", "web");
const { chromium } = createRequire(resolve(web, "package.json"))("@playwright/test");
import { execFileSync } from "node:child_process";
import { createServer } from "node:http";
import { createSecureServer } from "node:http2";
import { existsSync, mkdtempSync, readFileSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { extname, join } from "node:path";
import { gzipSync } from "node:zlib";
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png", ".webmanifest": "application/manifest+json" };
/** A certificate for this run only, so the server can speak HTTP/2 as Pages does. */
const tls = (() => {
  try {
    const dir = mkdtempSync(join(tmpdir(), "grooph-perf-"));
    execFileSync("openssl", ["req", "-x509", "-newkey", "rsa:2048", "-nodes", "-days", "1", "-subj", "/CN=127.0.0.1", "-keyout", join(dir, "key.pem"), "-out", join(dir, "cert.pem")], { stdio: "ignore" });
    const pair = { key: readFileSync(join(dir, "key.pem")), cert: readFileSync(join(dir, "cert.pem")) };
    rmSync(dir, { recursive: true, force: true });
    return pair;
  } catch {
    return undefined;
  }
})();
const scheme = tls ? "https" : "http";
const serve = (dist, port) =>
  new Promise((done) => {
    const cache = new Map();
    const server = (tls ? (handler) => createSecureServer(tls, handler) : createServer)((req, res) => {
      let path = decodeURIComponent(new URL(req.url, "http://x").pathname).replace(/^\/grooph\//, "/");
      if (path === "/" || path === "") path = "/index.html";
      const file = join(dist, path);
      if (!existsSync(file) || statSync(file).isDirectory()) { res.writeHead(404); res.end(); return; }
      let body = cache.get(file);
      if (!body) { body = gzipSync(readFileSync(file)); cache.set(file, body); }
      res.writeHead(200, { "content-type": TYPES[extname(file)] ?? "application/octet-stream", "content-encoding": "gzip", "cache-control": "max-age=600" });
      res.end(body);
    });
    server.listen(port, "127.0.0.1", () => done(server));
  });
const args = process.argv.slice(2);
const option = (flag, fallback) => {
  if (!args.includes(flag)) return fallback;
  const value = args.splice(args.indexOf(flag), 2)[1];
  if (value === undefined) {
    console.error(`perf-loadtime: ${flag} needs a value`);
    process.exit(1);
  }
  return value;
};
const at = option("--at", "");
const until = option("--until", "h1");
const builds = args.map((a) => [a.slice(0, a.indexOf("=")), resolve(a.slice(a.indexOf("=") + 1))]);
if (builds.length === 0 || builds.some(([name, dist]) => !name || !existsSync(join(dist, "index.html")))) {
  console.error("perf-loadtime: give one or more <name>=<path to a built apps/web/dist>");
  process.exit(1);
}
const links = { "fast 4G (9 Mbps, 85 ms each way)": { latency: 85, downloadThroughput: (9 * 1e6) / 8, uploadThroughput: (9 * 1e6) / 8 }, "slow 4G (1.6 Mbps, 280 ms each way)": { latency: 280, downloadThroughput: (1.6 * 1e6) / 8, uploadThroughput: (0.75 * 1e6) / 8 } };
const browser = await chromium.launch();
let port = 4391;
const out = {};
for (const [name, dist] of builds) {
  const server = await serve(dist, port);
  for (const [link, conditions] of Object.entries(links)) {
    const times = [];
    for (let i = 0; i < 7; i += 1) {
      const context = await browser.newContext({ viewport: { width: 400, height: 800 }, serviceWorkers: "block", ignoreHTTPSErrors: true });
      const page = await context.newPage();
      const cdp = await context.newCDPSession(page);
      await cdp.send("Network.enable");
      await cdp.send("Network.emulateNetworkConditions", { offline: false, ...conditions });
      // The page notes for itself when the selector first matches; nothing here waits on the test driver's clock.
      await page.addInitScript((selector) => {
        const look = () => {
          if (window.__shown === undefined && document.querySelector(selector)) window.__shown = performance.now();
        };
        new MutationObserver(look).observe(document, { childList: true, subtree: true });
      }, until);
      await page.goto(`${scheme}://127.0.0.1:${port}/grooph/${at}`, { waitUntil: "commit" });
      await page.waitForFunction(() => window.__shown !== undefined && performance.getEntriesByName("first-contentful-paint").length > 0, undefined, { timeout: 60000 });
      times.push(await page.evaluate(() => ({ inPage: Math.round(window.__shown), painted: Math.round(performance.getEntriesByName("first-contentful-paint")[0].startTime) })));
      await context.close();
    }
    const middle = (key) => times.map((t) => t[key]).sort((a, b) => a - b);
    const [inPage, painted] = [middle("inPage"), middle("painted")];
    (out[link] ??= {})[name] = { inPage: inPage[3], painted: painted[3], paintedLeast: painted[0], paintedMost: painted[6] };
  }
  server.close();
  port += 1;
}
await browser.close();
console.log(JSON.stringify({ protocol: tls ? "HTTP/2" : "HTTP/1.1", address: `/grooph/${at}`, until, ...out }, null, 2));
