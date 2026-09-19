import { join } from "node:path";

import { expect, test, type Page } from "@playwright/test";

import { csvSet, linkFor, repoRoot } from "./support.js";

/**
 * Handoff 0006, criterion 6: screenshots of the compare view for review.
 * Made only on request, into the slice folder:
 *
 *   GROOPH_SHOTS=1 pnpm --filter @grooph/web exec playwright test e2e/screenshots.spec.ts
 */
const dir = join(repoRoot, "handoffs/0006-executive-path");
test.skip(!process.env["GROOPH_SHOTS"], "screenshots are made on request (GROOPH_SHOTS=1)");

async function settle(page: Page): Promise<void> {
  await expect(page.locator(".ccard").first().locator(".mini .react-flow__node").first()).toBeVisible();
  await page.waitForTimeout(400);
}

for (const scheme of ["light", "dark"] as const) {
  test.describe(`phone, ${scheme}`, () => {
    test.use({ colorScheme: scheme });

    test(`compare view, phone ${scheme}`, async ({ page }) => {
      await page.goto(linkFor(csvSet()));
      await settle(page);
      await page.screenshot({ path: join(dir, `compare-phone-${scheme}.png`) });
      if (scheme === "light") {
        // The rest of the first card, and the second card after a swipe.
        await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
        await page.waitForTimeout(200);
        await page.screenshot({ path: join(dir, "compare-phone-light-lower.png") });
        await page.evaluate(() => window.scrollTo(0, 0));
        await page.getByRole("button", { name: "Show Reviewed" }).tap();
        await expect(page.locator(".pager-count")).toHaveText("Reviewed · 2 of 3");
        await page.waitForTimeout(500);
        await page.screenshot({ path: join(dir, "compare-phone-light-second.png") });
      }
    });
  });
}

test.describe("desktop", () => {
  test.use({ viewport: { width: 1280, height: 900 }, isMobile: false, hasTouch: false, deviceScaleFactor: 1 });

  test("compare view, desktop", async ({ page }) => {
    await page.goto(linkFor(csvSet()));
    await settle(page);
    await page.screenshot({ path: join(dir, "compare-desktop.png"), fullPage: true });
  });
});

test("a candidate's full graph, phone", async ({ page }) => {
  await page.goto(linkFor(csvSet()));
  await settle(page);
  await page.locator('.ccard[data-candidate="rigorous"]').getByRole("link", { name: "Open full graph" }).evaluate((a: HTMLAnchorElement) => a.click());
  await expect(page.locator('.react-flow__node[data-id="planner"]')).toBeVisible();
  await page.waitForTimeout(400);
  await page.screenshot({ path: join(dir, "full-graph-phone.png") });
});

test("a damaged link, phone", async ({ page }) => {
  const link = linkFor(csvSet());
  await page.goto(link.slice(0, Math.floor(link.length * 0.6)));
  await expect(page.getByRole("heading", { name: "This link could not be opened" })).toBeVisible();
  await page.screenshot({ path: join(dir, "damaged-link-phone.png") });
});
