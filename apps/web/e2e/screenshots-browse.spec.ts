import { join } from "node:path";

import { expect, test, type Page } from "@playwright/test";

import { csvSet, linkFor, repoRoot } from "./support.js";

/**
 * Handoff 0015: phone screenshots of the templates page (filters closed and
 * open), the template page with its glyph, and a compare card, light and
 * dark, into the slice folder. Made only on request:
 *
 *   GROOPH_SHOTS=1 pnpm --filter @grooph/web exec playwright test e2e/screenshots-browse.spec.ts
 */
const dir = join(repoRoot, "handoffs/0015-templates-browse-glyph");
test.skip(!process.env["GROOPH_SHOTS"], "screenshots are made on request (GROOPH_SHOTS=1)");

const noticeSeen = (page: Page) => page.addInitScript(() => localStorage.setItem("grooph.persistence", JSON.stringify({ result: "denied", seen: true })));
const shot = (page: Page, name: string) => page.screenshot({ path: join(dir, `${name}.png`) });

for (const scheme of ["light", "dark"] as const) {
  test.describe(`phone, ${scheme}`, () => {
    test.use({ colorScheme: scheme });

    test(`templates page, filters closed, ${scheme}`, async ({ page }) => {
      await noticeSeen(page);
      await page.goto("./#/templates");
      await expect(page.locator(".template-row").first().locator(".template-glyph svg")).toBeVisible();
      await shot(page, `templates-closed-phone-${scheme}`);
    });

    test(`templates page, filters open with a search and a filter, ${scheme}`, async ({ page }) => {
      await noticeSeen(page);
      await page.goto("./#/templates");
      await page.getByRole("searchbox", { name: "Search templates" }).fill("gate");
      await page.getByRole("button", { name: /^Filters/ }).tap();
      await page.getByRole("group", { name: "Rigor" }).getByRole("button", { name: "High rigor" }).tap();
      await expect(page.locator(".browse-shown")).toHaveText("2 of 20");
      await shot(page, `templates-open-phone-${scheme}`);
    });

    test(`template page with the glyph, ${scheme}`, async ({ page }) => {
      await noticeSeen(page);
      await page.goto("./#/templates/built-in/review-gate");
      await expect(page.locator(".glyph-large svg")).toBeVisible();
      await page.waitForTimeout(400);
      await shot(page, `template-page-phone-${scheme}`);
    });

    test(`compare card with the glyph, ${scheme}`, async ({ page }) => {
      await noticeSeen(page);
      await page.goto(linkFor(csvSet()));
      const glyph = page.locator(".ccard").first().locator(".ccard-glyph svg");
      await expect(glyph).toBeVisible();
      await glyph.scrollIntoViewIfNeeded();
      await page.waitForTimeout(300);
      await shot(page, `compare-card-phone-${scheme}`);
    });
  });
}
