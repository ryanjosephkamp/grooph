#!/usr/bin/env node
/**
 * Take the studio's six pictures: one of each drawing, at a phone's width (375 px), as a JPEG beside the page.
 *
 *   node handoffs/0109-a-studio-for-the-watched-graph/tools/serve.mjs &
 *   node handoffs/0109-a-studio-for-the-watched-graph/tools/pictures.mjs
 *
 * Each is the drawing's own stage on the large session, at a moment that has something to show. Playwright is the
 * app's (`apps/web/node_modules/@playwright/test`); in a worktree that has no packages installed, name a clone
 * that has: GROOPH_PLAYWRIGHT_FROM=/path/to/clone.
 */
import { statSync } from "node:fs";
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
const page = await browser.newPage({ viewport: { width: 375, height: 3200 }, deviceScaleFactor: 2, colorScheme: "light", reducedMotion: "reduce" });
await page.goto("http://localhost:4370/");
await page.addStyleTag({ content: ".deck, .docs { position: static !important; }" });
for (const [id, name, kind, agent] of SHOTS) {
  await page.evaluate(([kind, agent]) => {
    const S = window.STUDIO;
    S.choose(S.READY.findIndex((p) => p.id === "large"));
    S.go(S.READY[S.state.s].moments.findIndex((m) => m.kind === kind && m.id === agent));
  }, [kind, agent]);
  // A drawing off the screen is drawn when it comes onto it: bring it on, and give it a moment.
  await page.locator(`#${id} .stage`).evaluate((el) => el.scrollIntoView({ block: "start" }));
  await page.waitForTimeout(300);
  const path = join(out, `${name}.jpg`);
  await page.locator(`#${id} .stage`).screenshot({ path, type: "jpeg", quality: 82 });
  console.log(`${name}.jpg ${Math.ceil(statSync(path).size / 1024)} KB`);
}
await browser.close();
