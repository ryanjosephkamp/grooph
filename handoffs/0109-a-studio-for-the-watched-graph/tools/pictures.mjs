#!/usr/bin/env node
/**
 * Take the studio's six pictures: one of each drawing, at a phone's width (375 px) and a phone's density (three
 * device pixels to one), as a JPEG beside the page, each at the best quality that keeps it at 150 KB or less.
 *
 *   node handoffs/0109-a-studio-for-the-watched-graph/tools/serve.mjs &
 *   node handoffs/0109-a-studio-for-the-watched-graph/tools/pictures.mjs
 *
 * Each is the drawing's own stage on the large session, at a moment that has something to show. Playwright is the
 * app's (`apps/web/node_modules/@playwright/test`); in a worktree that has no packages installed, name a clone
 * that has: GROOPH_PLAYWRIGHT_FROM=/path/to/clone.
 */
import { writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const { chromium } = createRequire(join(process.env.GROOPH_PLAYWRIGHT_FROM ?? root, "apps/web/package.json"))("@playwright/test");
const out = join(root, "handoffs/briefs/studio-watching");
/** The large session: the moment a foreground child starts with five running, and the moment the busiest burst is at its fullest. */
const SHOTS = [
  ["w1", "w1-tree", "start", "a16"],
  ["w2", "w2-lanes", "start", "a16"],
  ["w3", "w3-lines", "start", "a47"],
  ["w4", "w4-ring", "start", "a16"],
  ["w5", "w5-skyline", "start", "a47"],
  ["w6", "w6-bursts", "start", "a47"],
];
const browser = await chromium.launch();
/** A phone's density first; a taller drawing that cannot be kept sharp at that weight is taken at two to one. */
const pages = [];
for (const density of [3, 2]) {
  const page = await browser.newPage({ viewport: { width: 375, height: 3200 }, deviceScaleFactor: density, colorScheme: "light", reducedMotion: "reduce" });
  await page.goto("http://localhost:4370/");
  await page.addStyleTag({ content: ".deck, .docs { position: static !important; }" });
  pages.push({ page, density });
}
for (const [id, name, kind, agent] of SHOTS) {
  let kept;
  for (const { page, density } of pages) {
    if (kept) break;
    await page.evaluate(([kind, agent]) => {
      const S = window.STUDIO;
      S.choose(S.READY.findIndex((p) => p.id === "large"));
      S.go(S.READY[S.state.s].moments.findIndex((m) => m.kind === kind && m.id === agent));
    }, [kind, agent]);
    // A drawing off the screen is drawn when it comes onto it: bring it on, and give it a moment.
    await page.locator(`#${id} .stage`).evaluate((el) => el.scrollIntoView({ block: "start" }));
    await page.waitForTimeout(300);
    // The best quality that fits, and never a poor one: a hairline is the first thing a JPEG smears.
    for (let quality = 95; quality >= 82 && !kept; quality -= 2) {
      const bytes = await page.locator(`#${id} .stage`).screenshot({ type: "jpeg", quality });
      if (bytes.length <= 148 * 1024) kept = { bytes, quality, density };
    }
  }
  if (!kept) throw new Error(`${name}: does not fit in 150 KB at quality 82 or better`);
  writeFileSync(join(out, `${name}.jpg`), kept.bytes);
  console.log(`${name}.jpg ${Math.ceil(kept.bytes.length / 1024)} KB, ${kept.density} device pixels to one, quality ${kept.quality}`);
}
await browser.close();
