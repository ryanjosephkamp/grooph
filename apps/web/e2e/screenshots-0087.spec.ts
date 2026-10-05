import { readFileSync } from "node:fs";
import { join } from "node:path";

import { parseMapText, type OperationMap } from "@grooph/core";
import { expect, test, type Page } from "@playwright/test";

import { linkFor, repoRoot } from "./support.js";
import { desktop, mapNamed } from "./support-alive.js";

/**
 * Handoff 0087: the map screen's view in three dimensions, at phone and desktop size, light and dark. Made only
 * on request, into the slice folder:
 *
 *   GROOPH_SHOTS=0087 GROOPH_E2E_PORT=4365 pnpm --filter @grooph/web exec playwright test e2e/screenshots-0087.spec.ts
 */
test.skip(process.env["GROOPH_SHOTS"] !== "0087", "screenshots are made on request (GROOPH_SHOTS=0087)");

const dir = join(repoRoot, "handoffs/0087-a-map-in-three-dimensions/shots");
const long = (): OperationMap => parseMapText(readFileSync(join(repoRoot, "handoffs/briefs/plan-2026-10-04/build.grooph-map.json"), "utf8")).map!;
const MAPS: [string, () => OperationMap][] = [
  ["long", long],
  ["eight", () => mapNamed("owner-operation-2026-10-01-with-ryan.grooph-map.json")],
  ["small", () => mapNamed("a-person-and-two-sessions.grooph-map.json")],
];

for (const size of ["phone", "desktop"] as const) {
  for (const scheme of ["light", "dark"] as const) {
    test.describe(`${size}, ${scheme}`, () => {
      test.use({ colorScheme: scheme, ...(size === "desktop" ? desktop : { deviceScaleFactor: 1.5 }) });
      const shot = (page: Page, name: string) => page.screenshot({ path: join(dir, `space-${name}-${size}-${scheme}.jpg`), type: "jpeg", quality: 60 });

      for (const [name, map] of MAPS) {
        test(`${name} ${size} ${scheme}`, async ({ page }) => {
          await page.goto(linkFor(map() as never));
          await page.getByRole("radio", { name: "3D" }).click();
          await expect(page.locator(".space-scene")).toBeVisible();
          await page.waitForTimeout(400);
          await shot(page, name);
          if (name === "long" && scheme === "light") {
            // The slider at its seventh handoff, and the view turned by the keyboard.
            await page.getByRole("slider").fill("7");
            await page.waitForTimeout(300);
            await shot(page, `${name}-step`);
            await page.locator(".space-scene").focus();
            for (let k = 0; k < 6; k++) await page.keyboard.press("ArrowRight");
            for (let k = 0; k < 5; k++) await page.keyboard.press("ArrowDown");
            await page.waitForTimeout(300);
            await shot(page, `${name}-turned`);
          }
        });
      }
    });
  }
}

/**
 * How fast the long map turns: the view is dragged along a figure for three seconds and the frames are counted by
 * the browser's own clock. At a desk's size, at a phone's, and at a phone's with the processor held to a quarter
 * of its speed (the nearest this Mac comes to a phone). Printed, for the handback.
 */
for (const [name, use, slow] of [
  ["desk 1440x900", desktop, 1],
  ["phone 390x844 @3x", { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3 }, 1],
  ["phone 390x844 @3x, processor at a quarter", { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3 }, 4],
  ["phone 390x844 @3x, processor at a sixth", { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3 }, 6],
] as const) {
  test.describe(`frames, ${name}`, () => {
    test.use(use);
    test(`frames ${name}`, async ({ page }) => {
      await page.goto(linkFor(long() as never));
      await page.getByRole("radio", { name: "3D" }).click();
      await expect(page.locator(".space-scene")).toBeVisible();
      await page.waitForTimeout(500);
      if (slow > 1) await (await page.context().newCDPSession(page)).send("Emulation.setCPUThrottlingRate", { rate: slow });
      const seen = await page.locator(".space-scene").evaluate(async (scene) => {
        const at = scene.getBoundingClientRect();
        const [cx, cy] = [at.x + at.width / 2, at.y + at.height / 2];
        const send = (type: string, x: number, y: number) => scene.dispatchEvent(new PointerEvent(type, { pointerId: 7, pointerType: "mouse", clientX: x, clientY: y, bubbles: true }));
        send("pointerdown", cx, cy);
        const times: number[] = [];
        await new Promise<void>((done) => {
          const step = (t: number): void => {
            times.push(t);
            const k = times.length;
            send("pointermove", cx + 140 * Math.sin(k / 18), cy + 70 * Math.sin(k / 29));
            if (t - times[0]! < 3000) requestAnimationFrame(step);
            else done();
          };
          requestAnimationFrame(step);
        });
        send("pointerup", cx, cy);
        const gaps = times.slice(1).map((t, k) => t - times[k]!).sort((a, b) => a - b);
        return { frames: gaps.length, perSecond: Math.round((1000 * gaps.length) / (times[times.length - 1]! - times[0]!)), slowestGapMs: Math.round(gaps[gaps.length - 1]!), ninetyFifthGapMs: Math.round(gaps[Math.floor(gaps.length * 0.95)]!), told: !document.querySelector<HTMLElement>(".space-flat")!.hidden };
      });
      console.log(`FRAMES ${name}: ${JSON.stringify(seen)}`);
    });
  });
}
