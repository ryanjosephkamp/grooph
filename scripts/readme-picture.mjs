#!/usr/bin/env node
/**
 * The README's moving picture (handoff 0077): the review gate's recorded run, replayed step by step, as a GIF, and its
 * last step as a still PNG for a reader who asks for less motion.
 *
 *   node scripts/readme-picture.mjs [--run <a proving run's folder>] [--port <n>] [--check]
 *
 * It needs the built app and CLI (`pnpm -r build`), the browser Playwright installs for the app's tests, and `ffmpeg`.
 * It serves apps/web/dist on a port of this machine, asks the CLI for the run's embed address (`grooph embed`, the same
 * frame anyone can put on a page, docs/exports.md "Embedding"), opens it, and takes one picture per step of the replay:
 * step 0 is the graph before the run, and each later step is one of the lead's notes. Nothing is drawn for the picture
 * that the embed does not draw for a reader.
 *
 * The run is experiments/patterns/review-gate/run, the template's proving run of 20 September 2026: the builder, the
 * critic's pass, the loop's stop, and the halt at the merge gate. A proving run is kept as `package/` and `runs/<id>/`
 * side by side; a copy is laid out the way a project holds it (the run two levels below its graph) for the CLI to
 * read. Each step shows for 1.3 s and the last for 4 s, and the GIF loops. `--check` only says whether the two files are there and the GIF is
 * under its limit; the pictures are made on request and committed, like the link-preview image.
 */
import { execFileSync, spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const dist = join(root, "apps", "web", "dist");
const GIF = join(root, "docs", "assets", "readme-grooph.gif");
const STILL = join(root, "docs", "assets", "readme-grooph.png");
/** The handoff's limit for the GIF. */
const GIF_LIMIT_KB = 1500;
const WIDTH = 640;
const STEP_SECONDS = 1.3;
const LAST_SECONDS = 4;

const args = process.argv.slice(2);
const option = (flag, fallback) => (args.includes(flag) ? args[args.indexOf(flag) + 1] : fallback);
const kb = (file) => Math.round(statSync(file).size / 1024);

if (args.includes("--check")) {
  const missing = [GIF, STILL].filter((f) => !existsSync(f));
  if (missing.length > 0 || kb(GIF) > GIF_LIMIT_KB) {
    console.error(missing.length > 0 ? `readme-picture: ${missing.join(" and ")} not there. Run node scripts/readme-picture.mjs.` : `readme-picture: the GIF is ${kb(GIF)} KB, over ${GIF_LIMIT_KB} KB.`);
    process.exit(1);
  }
  console.log(`readme-picture: ok. The GIF is ${kb(GIF)} KB (limit ${GIF_LIMIT_KB} KB), the still ${kb(STILL)} KB.`);
  process.exit(0);
}

const proving = resolve(option("--run", join(root, "experiments", "patterns", "review-gate", "run")));
const runId = existsSync(join(proving, "runs")) ? readdirSync(join(proving, "runs"), { withFileTypes: true }).filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort()[0] : undefined;
if (!runId || !existsSync(join(proving, "package", "graph.grooph.json"))) {
  console.error(`readme-picture: ${proving} is not a proving run: it has no package/graph.grooph.json or no runs/<id>/.`);
  process.exit(1);
}
const port = Number(option("--port", "4393"));
if (!existsSync(join(dist, "index.html"))) {
  console.error("readme-picture: apps/web/dist/index.html is not there. Run pnpm -r build first.");
  process.exit(1);
}
if (spawnSync("ffmpeg", ["-version"], { stdio: "ignore" }).status !== 0) {
  console.error("readme-picture: ffmpeg is not on the PATH.");
  process.exit(1);
}

// The built app, as Pages serves it: under /grooph/.
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png", ".woff2": "font/woff2" };
const server = createServer((req, res) => {
  let path = decodeURIComponent(new URL(req.url, "http://x").pathname).replace(/^\/grooph\//, "/");
  if (path === "/") path = "/index.html";
  const file = join(dist, path);
  if (!existsSync(file) || statSync(file).isDirectory()) {
    res.writeHead(404);
    res.end();
    return;
  }
  res.writeHead(200, { "content-type": TYPES[extname(file)] ?? "application/octet-stream" });
  res.end(readFileSync(file));
});
await new Promise((done) => server.listen(port, "127.0.0.1", done));

const frames = mkdtempSync(join(tmpdir(), "grooph-readme-"));
let browser;
try {
  // The run as a project holds it: runs/<id>/ two levels below the graph it ran.
  const run = join(frames, "package", "runs", runId);
  cpSync(join(proving, "package", "graph.grooph.json"), join(frames, "package", "graph.grooph.json"));
  cpSync(join(proving, "runs", runId), run, { recursive: true });
  // The address `grooph embed` prints for the run, with the embed's own background, in the dark palette.
  const printed = execFileSync(process.execPath, [join(root, "packages", "cli", "bin", "grooph.js"), "embed", run, "--theme", "dark", "--frame", "--base", `http://127.0.0.1:${port}/grooph/`], { encoding: "utf8" });
  const address = /<iframe[^>]*\ssrc="([^"]+)"/.exec(printed)?.[1]?.replace(/&amp;/g, "&");
  if (!address) throw new Error(`grooph embed printed no frame for ${run}`);

  const { chromium } = createRequire(join(root, "apps", "web", "package.json"))("@playwright/test");
  browser = await chromium.launch();
  // Two device pixels to a CSS pixel, so the picture is sharp on a phone; the README shows it WIDTH wide.
  const page = await browser.newPage({ viewport: { width: WIDTH, height: 900 }, deviceScaleFactor: 2, colorScheme: "dark", reducedMotion: "reduce" });
  await page.goto(address);
  const previous = page.getByRole("button", { name: "Previous step" });
  const next = page.getByRole("button", { name: "Next step" });
  await next.waitFor();
  // A run opens at its end. The picture is as wide as the window and centered in the room above the replay's bar:
  // take the spare room away, so the window is the picture and its bars and no more. Then go back to the start.
  const spare = await page.evaluate(() => {
    const picture = document.querySelector("svg.grooph-picture").getBoundingClientRect();
    const bar = document.querySelector(".gx-replay").getBoundingClientRect();
    return Math.max(0, Math.floor(picture.top - 12 + (bar.top - picture.bottom - 12)));
  });
  await page.setViewportSize({ width: WIDTH, height: 900 - spare - ((900 - spare) % 2) });
  while (await previous.isEnabled()) await previous.click();
  let count = 0;
  const shoot = async () => {
    await page.waitForTimeout(120);
    await page.screenshot({ path: join(frames, `step-${String(count).padStart(3, "0")}.png`) });
    count += 1;
  };
  await shoot();
  while (await next.isEnabled()) {
    await next.click();
    await shoot();
  }
  // One palette for every frame, then the frames with it: sharper than a palette per frame, and smaller.
  const list = join(frames, "frames.txt");
  const names = Array.from({ length: count }, (_, i) => `step-${String(i).padStart(3, "0")}.png`);
  writeFileSync(list, `${names.map((name, i) => `file '${name}'\nduration ${i === count - 1 ? LAST_SECONDS : STEP_SECONDS}`).join("\n")}\nfile '${names[count - 1]}'\n`);
  const ffmpeg = (...rest) => execFileSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", ...rest], { cwd: frames, stdio: ["ignore", "ignore", "inherit"] });
  ffmpeg("-f", "concat", "-safe", "0", "-i", list, "-vf", "palettegen=max_colors=96:stats_mode=full", "palette.png");
  ffmpeg("-f", "concat", "-safe", "0", "-i", list, "-i", "palette.png", "-lavfi", "paletteuse=dither=none:diff_mode=rectangle", "-loop", "0", GIF);
  ffmpeg("-i", names[count - 1], "-i", "palette.png", "-lavfi", "paletteuse=dither=none", "-frames:v", "1", STILL);
  console.log(`readme-picture: ${count} steps of ${proving.slice(root.length + 1)}/runs/${runId}; the GIF is ${kb(GIF)} KB (limit ${GIF_LIMIT_KB} KB), drawn ${WIDTH * 2} px wide to show at ${WIDTH}, the still ${kb(STILL)} KB.`);
  if (kb(GIF) > GIF_LIMIT_KB) process.exitCode = 1;
} finally {
  await browser?.close();
  rmSync(frames, { recursive: true, force: true });
  server.close();
}
