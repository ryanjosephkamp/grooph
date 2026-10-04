import { readFileSync } from "node:fs";
import { join } from "node:path";

import { parseMapText, type OperationMap } from "@grooph/core";
import { expect, test, type Page } from "@playwright/test";

import { linkFor, repoRoot } from "./support.js";
import { desktop, mapNamed } from "./support-alive.js";

/**
 * Handoff 0080: the map screen with its two views, at phone and desktop size,
 * light and dark. Made only on request, into the slice folder:
 *
 *   GROOPH_SHOTS=0080 GROOPH_E2E_PORT=4365 pnpm --filter @grooph/web exec playwright test e2e/screenshots-0080.spec.ts
 */
test.skip(process.env["GROOPH_SHOTS"] !== "0080", "screenshots are made on request (GROOPH_SHOTS=0080)");

const dir = join(repoRoot, "handoffs/0080-other-views-of-a-map/shots");
const long = (): OperationMap => parseMapText(readFileSync(join(repoRoot, "handoffs/briefs/plan-2026-10-04/build.grooph-map.json"), "utf8")).map!;
const MAPS: [string, () => OperationMap][] = [
  ["long", long],
  ["eight", () => mapNamed("owner-operation-2026-10-01-with-ryan.grooph-map.json")],
  ["small", () => mapNamed("a-person-and-two-sessions.grooph-map.json")],
];

for (const size of ["phone", "desktop", "laptop"] as const) {
  for (const scheme of ["light", "dark"] as const) {
    test.describe(`${size}, ${scheme}`, () => {
      test.use({ colorScheme: scheme, ...(size === "desktop" ? desktop : size === "laptop" ? { ...desktop, viewport: { width: 1180, height: 800 } } : { deviceScaleFactor: 1.5 }) });
      const shot = (page: Page, name: string) => page.screenshot({ path: join(dir, `app-${name}-${size}-${scheme}.jpg`), type: "jpeg", quality: 62 });
      const press = (page: Page, selector: string) => (size === "phone" ? page.locator(selector).first().tap() : page.locator(selector).first().click());

      for (const [name, map] of MAPS) {
        test(`${name} ${size} ${scheme}`, async ({ page }) => {
          test.skip(size === "laptop" && (scheme === "dark" || name === "small"), "the narrowest wide screen is shot once");
          await page.goto(linkFor(map() as never));
          await expect(page.locator(".map-picture svg")).toBeVisible();
          await page.waitForTimeout(300);
          await shot(page, `${name}-picture`);
          await page.getByRole("radio", { name: "Sequence" }).click();
          await expect(page.locator('.map-picture svg[data-picture="sequence"]')).toBeVisible();
          await page.waitForTimeout(300);
          await shot(page, `${name}-sequence`);
          if (name === "long" && scheme === "light") {
            await press(page, '[data-handoff="h-pr-3"]');
            await page.waitForTimeout(500);
            await shot(page, `${name}-sequence-picked`);
            if (size !== "phone") {
              await page.getByRole("radio", { name: "Picture" }).click();
              await page.waitForTimeout(500);
              await shot(page, `${name}-picture-picked`);
            }
          }
        });
      }
    });
  }
}
