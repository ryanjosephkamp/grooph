#!/usr/bin/env node
/**
 * How long a first visit takes to show its first heading, on a throttled link, for one or more builds of the app.
 *
 *   node scripts/perf-loadtime.mjs <name>=<path to a built apps/web/dist> [<name>=<path> ...]
 *
 * Bytes are not the whole of speed: a build can weigh the same and still show later, if it fetches in more rounds.
 * This serves each build as GitHub Pages does (gzip, a short cache life), opens it seven times with nothing cached
 * on a fast and on a slow mobile link, and prints the middle time for each. Compare a change against main:
 *
 *   node scripts/perf-loadtime.mjs main=../grooph-main/apps/web/dist change=apps/web/dist
 *
 * It needs the browser Playwright installs for the app's own tests.
 */
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
const web = resolve(dirname(fileURLToPath(import.meta.url)), "..", "apps", "web");
const { chromium } = createRequire(resolve(web, "package.json"))("@playwright/test");
import { createServer } from "node:http";
import { existsSync, readFileSync, statSync } from "node:fs";
import { extname, join } from "node:path";
import { gzipSync } from "node:zlib";
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png", ".webmanifest": "application/manifest+json" };
const serve = (dist, port) =>
  new Promise((done) => {
    const cache = new Map();
    const server = createServer((req, res) => {
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
const builds = process.argv.slice(2).map((a) => [a.slice(0, a.indexOf("=")), resolve(a.slice(a.indexOf("=") + 1))]);
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
      const context = await browser.newContext({ viewport: { width: 400, height: 800 }, serviceWorkers: "block" });
      const page = await context.newPage();
      const cdp = await context.newCDPSession(page);
      await cdp.send("Network.enable");
      await cdp.send("Network.emulateNetworkConditions", { offline: false, ...conditions });
      const began = Date.now();
      await page.goto(`http://127.0.0.1:${port}/grooph/`, { waitUntil: "commit" });
      await page.waitForSelector("h1", { state: "visible", timeout: 60000 });
      times.push(Date.now() - began);
      await context.close();
    }
    times.sort((a, b) => a - b);
    (out[link] ??= {})[name] = { median: times[3], least: times[0], most: times[6] };
  }
  server.close();
  port += 1;
}
await browser.close();
console.log(JSON.stringify(out, null, 2));
