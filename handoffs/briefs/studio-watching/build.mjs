#!/usr/bin/env node
/**
 * Build the watching studio (slice 0109): one page of working drawings for the owner, six ways to draw a watched
 * session, each fed by the same three records.
 *
 *   node handoffs/briefs/studio-watching/build.mjs            write ../studio-watching.html
 *   node handoffs/briefs/studio-watching/build.mjs --check    exit 1 if it is stale
 *
 * The page is `page.html` with, put where it says: `page.css` (and in it the app's two typefaces, read from
 * `apps/web/public/assets/fonts/` and carried in the page, so that nothing is fetched); the samples
 * (`samples.json`, made by `handoffs/0109-a-studio-for-the-watched-graph/tools/make-samples.mjs` from real sessions,
 * shape only) and the made-up statements (`said-made-up.json`); one script: `core.js`, the six drawings, `boot.js`;
 * and in each drawing's stage a still of it, drawn here by that same code, for a viewer that runs no script.
 * Nothing here is in the product, and nothing here needs a package built.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..", "..", "..");
const read = (name) => readFileSync(join(here, name), "utf8");
const font = (file) => readFileSync(join(root, "apps/web/public/assets/fonts", file)).toString("base64");

const FONTS = `/* Atkinson Hyperlegible Next and Mono, the app's typefaces, as the site cuts them (SIL Open Font License 1.1:
   apps/web/public/assets/fonts/OFL-atkinson-hyperlegible-next.txt and -mono.txt). Carried in the page. */
@font-face { font-family: "Atkinson Hyperlegible Next"; src: url("data:font/woff2;base64,${font("atkinson-hyperlegible-next.v1.woff2")}") format("woff2"); font-weight: 400 800; font-style: normal; font-display: swap; }
@font-face { font-family: "Atkinson Hyperlegible Mono"; src: url("data:font/woff2;base64,${font("atkinson-hyperlegible-mono.v1.woff2")}") format("woff2"); font-weight: 400 700; font-style: normal; font-display: swap; }`;

const samples = JSON.parse(read("samples.json"));
const { what: _what, ...said } = JSON.parse(read("said-made-up.json"));
const data = { samples, said };
const script = ["core.js", "w1-tree.js", "w2-lanes.js", "w3-lines.js", "w4-ring.js", "w5-skyline.js", "w6-bursts.js", "boot.js"].map((name) => read(name).trimEnd()).join("\n\n");

// Each drawing is drawn once here, by the page's own code, as it stands when the page opens: a viewer that runs no
// script is left with that still and its words, and the script draws the same thing over it.
const still = new Function("window", `${["core.js", "w1-tree.js", "w2-lanes.js", "w3-lines.js", "w4-ring.js", "w5-skyline.js", "w6-bursts.js"].map((name) => read(name)).join("\n")}\nreturn { prepare, viewAt, opensAt, frame, sayMoment, aboutLine, DRAW, OPEN_ON };`)({ STUDIO_DATA: data });
const P = still.prepare(samples[still.OPEN_ON]);
const v = still.viewAt(P, still.opensAt(P), true);
const STILL_WIDTH = 343;
const bar = `<div class="deck">
      <div class="bar"><button type="button" data-do="play" aria-pressed="false">Play</button><button type="button" data-do="prev" aria-label="The moment before">‹</button><button type="button" data-do="next" aria-label="The next moment">›</button><input type="range" min="0" max="1" value="0" step="1" aria-label="Moment" /><button type="button" data-do="end" aria-label="The last moment">⇥</button></div>
      <output class="says" aria-live="polite">${still.sayMoment(P, v)}</output>
    </div>
    <output class="who"></output>`;

const page = read("page.html")
  .replace("/*CSS*/", () => read("page.css").trimEnd().replace("/*FONTS*/", () => FONTS))
  .replace(/<div class="stage"><\/div>\n(\s*)<!--BAR-->/g, (_, indent) => `<div class="stage"><!--STILL--></div>\n${indent}${bar}`)
  .replace(/<section class="view" data-view="(\w+)" data-name="([^"]+)"[^>]*>[\s\S]*?<!--STILL-->/g, (block, view, name) => block.replace("<!--STILL-->", () => still.frame(name, still.DRAW[view], P, v, STILL_WIDTH, { said: true, sel: null })))
  .replace("<small data-about></small>", () => `<small data-about>${still.aboutLine(P)}</small>`)
  .replace("/*DATA*/", () => JSON.stringify(data).replace(/</g, "\\u003c"))
  .replace("/*SCRIPT*/", () => script);
if (page.includes("<!--STILL-->") || page.includes("<!--BAR-->")) throw new Error("studio-watching: a drawing was left without its still");
const out = join(here, "..", "studio-watching.html");
if (process.argv.includes("--check")) {
  if (readFileSync(out, "utf8") !== page) {
    console.error("studio-watching: handoffs/briefs/studio-watching.html is not what its sources build. Run node handoffs/briefs/studio-watching/build.mjs");
    process.exit(1);
  }
  console.log("studio-watching: the page is what its sources build");
} else {
  writeFileSync(out, page);
  console.log(`studio-watching: wrote handoffs/briefs/studio-watching.html, ${Math.ceil(Buffer.byteLength(page) / 1024)} KB`);
}
