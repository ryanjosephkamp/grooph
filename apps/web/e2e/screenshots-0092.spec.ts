import { join } from "node:path";

import { expect, test, type Page } from "@playwright/test";

import { linkFor, repoRoot, runBundle } from "./support.js";
import { desktop } from "./support-alive.js";

/**
 * Handoff 0092: a loop graph in three dimensions, on three built-in templates, at a phone's width and at 1440,
 * light and dark. Made only on request, into the slice folder:
 *
 *   GROOPH_SHOTS=0092 GROOPH_E2E_PORT=4365 pnpm --filter @grooph/web exec playwright test e2e/screenshots-0092.spec.ts
 */
test.skip(process.env["GROOPH_SHOTS"] !== "0092", "screenshots are made on request (GROOPH_SHOTS=0092)");

const dir = join(repoRoot, "handoffs/0092-a-graph-in-three-dimensions/shots");
const TEMPLATES = ["review-gate", "grind-loop", "gauntlet-decomposed"];

for (const size of ["phone", "desktop"] as const) {
  for (const scheme of ["light", "dark"] as const) {
    test.describe(`${size}, ${scheme}`, () => {
      test.use({ colorScheme: scheme, ...(size === "desktop" ? desktop : { deviceScaleFactor: 1.5 }) });
      const shot = (page: Page, name: string) => page.screenshot({ path: join(dir, `${name}-${size}-${scheme}.jpg`), type: "jpeg", quality: 60 });
      test(`a recorded run ${size} ${scheme}`, async ({ page }) => {
        await page.goto(linkFor(runBundle("slice-0007-sandwich")));
        await expect(page.locator(".react-flow__node").first()).toBeVisible();
        await page.getByRole("radio", { name: "3D" }).click();
        await expect(page.locator(".space-scene")).toBeVisible();
        await expect.poll(() => page.locator(".space-world").evaluate((el) => (el as HTMLElement).style.transform)).toContain("scale3d(");
        await page.waitForTimeout(300);
        await shot(page, "space-run");
      });
      for (const id of TEMPLATES) {
        test(`${id} ${size} ${scheme}`, async ({ page }) => {
          await page.goto(`./#/templates/built-in/${id}`);
          await page.getByRole("radio", { name: "3D" }).click();
          await expect(page.locator(".space-scene")).toBeVisible();
          await expect.poll(() => page.locator(".space-world").evaluate((el) => (el as HTMLElement).style.transform)).toContain("scale3d(");
          await page.waitForTimeout(300);
          await shot(page, `space-${id}`);
          if (id === "grind-loop" && scheme === "light") {
            const steps = Number(await page.getByRole("slider").getAttribute("max"));
            await page.getByRole("slider").fill(String(steps));
            await page.waitForTimeout(300);
            await shot(page, `space-${id}-last-step`);
          }
        });
      }
    });
  }
}
