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
 *
 * Since slice 0093 the front page's own picture is a file only the front page asks for: it is in the first load, which
 * is the front page's, and not in a canvas's. The built-in templates are a file the template screens ask for: an address
 * that lists or opens one loads it beside the app, and it is printed under "loaded later" with the other pieces.
 *
 * Since handoff 0077 the site's fonts are its own files, and they have a line of their own: the two a first visit to the
 * front page fetches (the upright face and the mono one; the italic is fetched by a page that has italics), as they are
 * sent, since woff2 is already compressed. They are asked for once the page is up, so they are not in the first load; the
 * last line is what a first visit to the front page fetches in all: the first load, those fonts and the footer's icons.
 * apps/web/e2e/landing.spec.ts checks that the front page asks for exactly these fonts.
 */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const dist = join(root, "apps", "web", "dist");
const budget = JSON.parse(readFileSync(join(root, "scripts", "perf-budget.json"), "utf8"));
const kb = (file) => gzipSync(readFileSync(file)).length / 1024;
// A figure is compared with its budget as it is, and printed to two places so a reader sees what was compared.
// It was once rounded to one place first, and a template's address at 276.04 read "ok 276 of 276".
const two = (n) => n.toFixed(2);

if (!existsSync(join(dist, "index.html"))) {
  console.error("perf-budget: apps/web/dist/index.html is not there. Run pnpm -r build first.");
  process.exit(1);
}
const sum = (files) => files.reduce((n, f) => n + kb(join(dist, f)), 0);
const html = kb(join(dist, "index.html"));
// What each address loads. Since slice 0056 the entry chooses by the address, and the build writes the sets to
// routes.json. A build without that file cannot be weighed: index.html names only the entry script.
if (!existsSync(join(dist, "routes.json"))) {
  console.error("perf-budget: apps/web/dist/routes.json is not there, so there is nothing to say what each address loads. The build should have written it (apps/web/vite.config.ts).");
  process.exit(1);
}
const routes = JSON.parse(readFileSync(join(dist, "routes.json"), "utf8"));
const appJs = [...routes.entry, ...routes.app.js];
const appCss = routes.app.css;
// Since slice 0093 the front page's picture and tiles are a piece that only the front page's address asks for,
// beside the app, in its first round. The first load is the front page's, so the piece is weighed in it; an
// address that draws on the canvas does not fetch it. A build that does not say which files it is would let the
// first load read lighter than the front page is, which is not a pass.
if (!Array.isArray(routes.front) || routes.front.length === 0) {
  console.error("perf-budget: apps/web/dist/routes.json does not say which files hold the front page's picture (front). The build should have listed them (apps/web/vite.config.ts).");
  process.exit(1);
}
const everywhere = sum(appJs);
const js = everywhere + sum(routes.front);
const css = sum(appCss);
const embed = sum([...routes.entry, ...routes.embed.js, ...routes.embed.css]) + html;
// Since slice 0069 the canvas screens are a set of their own, loaded by the addresses that draw on the canvas.
const canvasFiles = [...routes.canvas.js, ...routes.canvas.css];
const canvas = everywhere + css + html + sum(canvasFiles);
// Since slice 0087 a map's view in three dimensions is a piece of its own, fetched only when it is chosen. No
// address loads it, so it is in no line above; it has a line to itself. A build that does not say which files
// it is cannot be weighed, and a piece with no files weighs nothing, which is not a pass.
if (!Array.isArray(routes.space) || routes.space.length === 0) {
  console.error("perf-budget: apps/web/dist/routes.json does not say which files draw a map in three dimensions (space). The build should have listed them (apps/web/vite.config.ts).");
  process.exit(1);
}
const space = sum(routes.space);
// The fonts and the icons are files of public/, under names that carry a version, so they are named here and not found.
const FIRST_VISIT_FONTS = ["assets/fonts/atkinson-hyperlegible-next.v1.woff2", "assets/fonts/atkinson-hyperlegible-mono.v1.woff2"];
const ICONS = "assets/site-icons.v1.svg";
for (const f of [...FIRST_VISIT_FONTS, ICONS]) {
  if (!existsSync(join(dist, f))) {
    console.error(`perf-budget: apps/web/dist/${f} is not there. The front page asks for it (apps/web/src/styles.css, ui/landing/Chrome.tsx).`);
    process.exit(1);
  }
}
const sent = (file) => statSync(join(dist, file)).size / 1024;
const fonts = FIRST_VISIT_FONTS.reduce((n, f) => n + sent(f), 0);
const firstVisit = js + css + html + fonts + kb(join(dist, ICONS));
const counted = new Set([...appJs, ...routes.front, ...appCss, ...canvasFiles, ...routes.embed.js, ...routes.embed.css, ...routes.space]);
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
  ["the app's first load (HTML, scripts and styles), gzip KB", js + css + html, budget.firstLoadKB],
  ["  of which scripts", js, budget.entryJsKB],
  ["  of which styles", css, budget.cssKB],
  ["the fonts a first visit to the front page fetches, KB as sent", fonts, budget.fontsKB],
  ["a first visit to the front page in all (first load, fonts, icons), KB", firstVisit, budget.firstVisitKB],
  ["the first load of an address that draws on the canvas, gzip KB", canvas, budget.canvasLoadKB],
  ["an embed's first load, gzip KB", embed, budget.embedLoadKB],
  ["a map in three dimensions: what choosing it fetches, on no address's first load, gzip KB", space, budget.mapSpaceKB],
  ["the CLI's cold start, ms (middle of five)", cli, budget.cliColdMs],
];
let over = 0;
for (const [what, value, limit] of rows) {
  const bad = value > limit;
  if (bad) over += 1;
  console.log(`${bad ? "OVER " : "ok   "} ${two(value).padStart(7)} of ${String(limit).padStart(5)}  ${what}`);
}
for (const f of others) console.log(`      ${two(kb(join(dist, "assets", f))).padStart(7)}            loaded later: ${f}`);
for (const f of readdirSync(join(dist, "assets", "fonts")).filter((name) => name.endsWith(".woff2") && !FIRST_VISIT_FONTS.includes(`assets/fonts/${name}`))) {
  console.log(`      ${two(sent(`assets/fonts/${f}`)).padStart(7)}            a font fetched by a page that uses it: ${f}`);
}
if (process.argv.includes("--check") && over > 0) {
  console.error(`perf-budget: ${over} over budget. Make it lighter, or raise the budget in scripts/perf-budget.json in a pull request that says why.`);
  process.exit(1);
}
