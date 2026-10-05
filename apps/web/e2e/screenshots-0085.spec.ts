import { readFileSync } from "node:fs";
import { join } from "node:path";

import { parseGraphText, type Graph } from "@grooph/core";
import { expect, test } from "@playwright/test";

import { linkFor, node, repoRoot } from "./support.js";
import { desktop } from "./support-alive.js";

/**
 * Handoff 0085: a subgrooph on the canvas, closed and open, at a phone's width and at 1440, light and dark. Made
 * only on request, into the slice folder:
 *
 *   GROOPH_SHOTS=0085 GROOPH_E2E_PORT=4366 pnpm --filter @grooph/web exec playwright test e2e/screenshots-0085.spec.ts
 */
test.skip(process.env["GROOPH_SHOTS"] !== "0085", "screenshots are made on request (GROOPH_SHOTS=0085)");

const dir = join(repoRoot, "handoffs/0085-subgroophs/shots");
const boxed = (): Graph => parseGraphText(readFileSync(join(repoRoot, "fixtures/valid/subgrooph-in-a-graph.grooph.json"), "utf8")).doc!;

for (const size of ["phone", "desktop"] as const) {
  for (const scheme of ["light", "dark"] as const) {
    test.describe(`${size}, ${scheme}`, () => {
      test.use({ colorScheme: scheme, ...(size === "desktop" ? desktop : { deviceScaleFactor: 1.5 }) });
      test(`closed and open, ${size} ${scheme}`, async ({ page }) => {
        const shot = (name: string) => page.screenshot({ path: join(dir, `canvas-${name}-${size}-${scheme}.jpg`), type: "jpeg", quality: 60 });
        await page.goto(linkFor(boxed()));
        await expect(page.locator('[data-unit-id="review"]')).toBeVisible();
        await page.waitForTimeout(500);
        await shot("closed");
        await (size === "phone" ? node(page, "review").tap() : node(page, "review").click());
        await expect(page.locator('[data-unit-id="review"][data-open]')).toBeVisible();
        await page.waitForTimeout(500);
        await shot("open");
      });
    });
  }
}
