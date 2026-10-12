#!/usr/bin/env node
/**
 * Build the watching studio's second page (slice 0109, round two): three of the first page's drawings in three
 * dimensions, and four new ones, each fed by the same three records.
 *
 *   node handoffs/briefs/studio-watching-2/build.mjs            write ../studio-watching-2.html
 *   node handoffs/briefs/studio-watching-2/build.mjs --check    exit 1 if it is stale
 *
 * It stands on the first page's own sources, read from `../studio-watching/` and not copied: its stylesheet (with
 * the app's two typefaces), `core.js` (a sample made ready, the session at one moment, the words for a moment, the
 * small things every drawing draws with), `boot.js` (the clock, the switches, the bars), the samples and the made-up
 * statements. What is this page's own is beside this file: `page.html`, `more.css`, `three.js` (what the drawings
 * in three dimensions share) and one file a drawing. The first page is not built or changed by this.
 *
 * In each drawing's stage is a still of it, drawn here by that same code, for a viewer that runs no script; and
 * under each, the drawing at the last moment of the large session: the end, as the one picture an export would hold.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..", "..", "..");
const read = (name) => readFileSync(join(here, name), "utf8");
const first = (name) => readFileSync(join(here, "..", "studio-watching", name), "utf8");
const font = (file) => readFileSync(join(root, "apps/web/public/assets/fonts", file)).toString("base64");

const FONTS = `/* Atkinson Hyperlegible Next and Mono, the app's typefaces, as the site cuts them (SIL Open Font License 1.1:
   apps/web/public/assets/fonts/OFL-atkinson-hyperlegible-next.txt and -mono.txt). Carried in the page. */
@font-face { font-family: "Atkinson Hyperlegible Next"; src: url("data:font/woff2;base64,${font("atkinson-hyperlegible-next.v1.woff2")}") format("woff2"); font-weight: 400 800; font-style: normal; font-display: swap; }
@font-face { font-family: "Atkinson Hyperlegible Mono"; src: url("data:font/woff2;base64,${font("atkinson-hyperlegible-mono.v1.woff2")}") format("woff2"); font-weight: 400 700; font-style: normal; font-display: swap; }`;

const DRAWINGS = ["three.js", "w2-road.js", "w4-helix.js", "w6-floors.js", "w7-card.js", "w8-arcs.js", "w9-rings.js", "w10-pulse.js"];
const samples = JSON.parse(first("samples.json"));
const { what: _what, ...said } = JSON.parse(first("said-made-up.json"));
const data = { samples, said };
const script = [first("core.js"), ...DRAWINGS.map(read), first("boot.js")].map((s) => s.trimEnd()).join("\n\n");

// Each drawing is drawn here by the page's own code: once as it stands when the page opens, for a viewer that
// runs no script, and once at the last moment, as the picture of the end.
const still = new Function("window", `${[first("core.js"), ...DRAWINGS.map(read)].join("\n")}\nreturn { prepare, viewAt, opensAt, frame, sayMoment, aboutLine, DRAW, OPEN_ON };`)({ STUDIO_DATA: data });
const P = still.prepare(samples[still.OPEN_ON]);
const open = still.viewAt(P, still.opensAt(P), true);
// The end is drawn without the made-up statements: it is the picture of what was seen.
const end = still.viewAt(P, P.moments.length - 1, false);
const STILL_WIDTH = 343;
const bar = `<div class="deck">
      <div class="bar"><button type="button" data-do="play" aria-pressed="false">Play</button><button type="button" data-do="prev" aria-label="The moment before">‹</button><button type="button" data-do="next" aria-label="The next moment">›</button><input type="range" min="0" max="1" value="0" step="1" aria-label="Moment" /><button type="button" data-do="end" aria-label="The last moment">⇥</button></div>
      <output class="says" aria-live="polite">${still.sayMoment(P, open)}</output>
    </div>
    <output class="who"></output>`;

const page = read("page.html")
  .replace("/*CSS*/", () => `${first("page.css").trimEnd().replace("/*FONTS*/", () => FONTS)}\n${read("more.css").trimEnd()}`)
  .replace(/<div class="stage"><\/div>\n(\s*)<!--BAR-->/g, (_, indent) => `<div class="stage"><!--STILL--></div>\n${indent}${bar}`)
  .replace(/<section class="view" data-view="(\w+)" data-name="([^"]+)"[^>]*>[\s\S]*?<\/section>/g, (block, view, name) =>
    block
      .replace("<!--STILL-->", () => still.frame(name, still.DRAW[view], P, open, STILL_WIDTH, { said: true, sel: null }))
      .replace("<!--END-->", () => still.frame(`${name}, at the end`, still.DRAW[view], P, end, STILL_WIDTH, { said: false, sel: null })),
  )
  .replace("<small data-about></small>", () => `<small data-about>${still.aboutLine(P)}</small>`)
  .replace("/*DATA*/", () => JSON.stringify(data).replace(/</g, "\\u003c"))
  .replace("/*SCRIPT*/", () => script);
for (const mark of ["<!--STILL-->", "<!--BAR-->", "<!--END-->"]) if (page.includes(mark)) throw new Error(`studio-watching-2: ${mark} was left in the page`);
const out = join(here, "..", "studio-watching-2.html");
if (process.argv.includes("--check")) {
  if (readFileSync(out, "utf8") !== page) {
    console.error("studio-watching-2: handoffs/briefs/studio-watching-2.html is not what its sources build. Run node handoffs/briefs/studio-watching-2/build.mjs");
    process.exit(1);
  }
  console.log("studio-watching-2: the page is what its sources build");
} else {
  writeFileSync(out, page);
  console.log(`studio-watching-2: wrote handoffs/briefs/studio-watching-2.html, ${Math.ceil(Buffer.byteLength(page) / 1024)} KB`);
}
