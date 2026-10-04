#!/usr/bin/env node
/**
 * What the app and the CLI weigh, against a budget: so polish never costs speed without someone deciding it should.
 *
 *   node scripts/perf-budget.mjs            print the numbers
 *   node scripts/perf-budget.mjs --check    the same, and exit 1 when a number is over its budget
 *
 * It reads the built app (apps/web/dist: run `pnpm -r build` first) and times the built CLI. Sizes are gzip, in units of 1,024 bytes,
 * which is what GitHub Pages sends. The app's first load is index.html, its scripts and its styles, at the front page;
 * an address that draws on the canvas (a graph, a template, a link, a run) loads the canvas screens as well; an embed's
 * is what an `#/embed` address loads, which is much less (the build lists the sets in dist/routes.json). Budgets are in
 * scripts/perf-budget.json; raising one is a decision, made in a pull request that says why.
 */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const dist = join(root, "apps", "web", "dist");
const budget = JSON.parse(readFileSync(join(root, "scripts", "perf-budget.json"), "utf8"));
const kb = (file) => gzipSync(readFileSync(file)).length / 1024;
const one = (n) => Math.round(n * 10) / 10;

if (!existsSync(join(dist, "index.html"))) {
  console.error("perf-budget: apps/web/dist/index.html is not there. Run pnpm -r build first.");
  process.exit(1);
}
/** The scripts and stylesheets a page names, as files in dist. */
const named = (page) => [...readFileSync(join(dist, page), "utf8").matchAll(/(?:src|href)="[^"]*?(assets\/[^"]+\.(?:js|css))"/g)].map((m) => m[1]);
const sum = (files) => files.reduce((n, f) => n + kb(join(dist, f)), 0);
const html = kb(join(dist, "index.html"));
// What each address loads. Since slice 0056 the entry chooses by the address, and the build writes the two sets
// to routes.json; before that, index.html named everything.
const routes = existsSync(join(dist, "routes.json")) ? JSON.parse(readFileSync(join(dist, "routes.json"), "utf8")) : undefined;
const first = named("index.html");
const appJs = routes ? [...routes.entry, ...routes.app.js] : first.filter((f) => f.endsWith(".js"));
const appCss = routes ? routes.app.css : first.filter((f) => f.endsWith(".css"));
const js = sum(appJs);
const css = sum(appCss);
const embed = routes ? sum([...routes.entry, ...routes.embed.js, ...routes.embed.css]) + html : undefined;
// Since slice 0069 the canvas screens are a set of their own, loaded by the addresses that draw on the canvas.
const canvasFiles = routes?.canvas ? [...routes.canvas.js, ...routes.canvas.css] : [];
const canvas = routes?.canvas ? js + css + html + sum(canvasFiles) : undefined;
const counted = new Set([...appJs, ...appCss, ...canvasFiles, ...(routes ? [...routes.embed.js, ...routes.embed.css] : [])]);
const others = readdirSync(join(dist, "assets")).filter((f) => /\.(js|css)$/.test(f) && !counted.has(`assets/${f}`));

// The CLI's cold start: the middle of five runs of the quickest command there is.
const bin = join(root, "packages", "cli", "bin", "grooph.js");
const times = [];
for (let i = 0; i < 5; i += 1) {
  const began = process.hrtime.bigint();
  execFileSync(process.execPath, [bin, "--version"], { stdio: "ignore" });
  times.push(Number(process.hrtime.bigint() - began) / 1e6);
}
const cli = times.sort((a, b) => a - b)[2];

const rows = [
  ["the app's first load (HTML, scripts and styles), gzip KB", one(js + css + html), budget.firstLoadKB],
  ["  of which scripts", one(js), budget.entryJsKB],
  ["  of which styles", one(css), budget.cssKB],
  ...(canvas !== undefined ? [["the first load of an address that draws on the canvas, gzip KB", one(canvas), budget.canvasLoadKB]] : []),
  ...(embed !== undefined ? [["an embed's first load, gzip KB", one(embed), budget.embedLoadKB]] : []),
  ["the CLI's cold start, ms (middle of five)", Math.round(cli), budget.cliColdMs],
];
let over = 0;
for (const [what, value, limit] of rows) {
  const bad = value > limit;
  if (bad) over += 1;
  console.log(`${bad ? "OVER " : "ok   "} ${String(value).padStart(7)} of ${String(limit).padStart(5)}  ${what}`);
}
for (const f of others) console.log(`      ${String(one(kb(join(dist, "assets", f)))).padStart(7)}            loaded later: ${f}`);
if (process.argv.includes("--check") && over > 0) {
  console.error(`perf-budget: ${over} over budget. Make it lighter, or raise the budget in scripts/perf-budget.json in a pull request that says why.`);
  process.exit(1);
}
