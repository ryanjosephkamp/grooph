import { mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { expect, test, type Page } from "@playwright/test";

import { REAL_RUN, bundleText, csvSet, fixturePath, importDocument, linkFor, node, repoRoot, runBundle } from "./support.js";

/**
 * The fresh-eyes review (docs/review-2026-10.md): the main screens at the two
 * sizes the review names, a 390 px phone and a 1280 px computer, light and
 * dark. Made only on request, into GROOPH_SHOT_DIR (default: the review's
 * folder under docs/):
 *
 *   GROOPH_SHOTS=1 pnpm --filter @grooph/web exec playwright test e2e/screenshots-review.spec.ts
 */
const dir = process.env["GROOPH_SHOT_DIR"] ?? join(repoRoot, "docs/review-2026-10");
test.skip(!process.env["GROOPH_SHOTS"], "screenshots are made on request (GROOPH_SHOTS=1)");
test.beforeAll(() => mkdirSync(dir, { recursive: true }));

const noticeSeen = (page: Page) => page.addInitScript(() => localStorage.setItem("grooph.persistence", JSON.stringify({ result: "denied", seen: true })));
const pattern = (id: string) => readFileSync(join(repoRoot, "patterns", `${id}.grooph.json`), "utf8");

const SIZES = {
  phone: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 },
  desktop: { viewport: { width: 1280, height: 800 }, isMobile: false, hasTouch: false, deviceScaleFactor: 1 },
} as const;

for (const [size, use] of Object.entries(SIZES)) {
  for (const scheme of ["light", "dark"] as const) {
    test.describe(`${size}, ${scheme}`, () => {
      test.use({ ...use, colorScheme: scheme });
      const shot = (page: Page, name: string) => page.screenshot({ path: join(dir, `${name}-${size}-${scheme}.png`) });
      const press = (page: Page, target: ReturnType<Page["locator"]>) => (size === "phone" ? target.tap() : target.click());

      test("library, editor and a node's sheet", async ({ page }) => {
        await noticeSeen(page);
        await importDocument(page, "review-loop.grooph.json", readFileSync(fixturePath, "utf8"));
        await page.waitForTimeout(500);
        await shot(page, "editor");
        await press(page, node(page, "critic"));
        await page.waitForTimeout(400);
        await shot(page, "editor-node");
        await page.goto("./");
        await expect(page.locator(".graph-name").first()).toBeVisible();
        await shot(page, "library");
      });

      test("a wide template in the editor", async ({ page }) => {
        await noticeSeen(page);
        await page.goto("./#/templates/built-in/specialist-critic-bank");
        await expect(page.locator(".react-flow__node").first()).toBeVisible();
        await page.waitForTimeout(500);
        await shot(page, "template-wide");
      });

      test("templates", async ({ page }) => {
        await noticeSeen(page);
        await page.goto("./#/templates");
        await expect(page.locator(".template-row").first()).toBeVisible();
        await shot(page, "templates");
      });

      test("compare view", async ({ page }) => {
        await page.goto(linkFor(csvSet()));
        await expect(page.locator(".ccard").first().locator(".ccard-glyph svg")).toBeVisible();
        await page.waitForTimeout(400);
        await shot(page, "compare");
      });

      test("run view", async ({ page }) => {
        await page.goto(linkFor(runBundle("slice-0007-sandwich")));
        await expect(page.locator(".run-badge").first()).toBeVisible();
        await page.waitForTimeout(500);
        await shot(page, "run");
      });

      test("live run", async ({ page }) => {
        await page.emulateMedia({ reducedMotion: "reduce" });
        await page.route("**/grooph/api/run.json", (route) => route.fulfill({ status: 200, contentType: "application/json", body: bundleText(runBundle("run-live")) }));
        await page.goto("./#/run?live");
        await expect(page.locator(".run-badge").first()).toBeVisible();
        await page.waitForTimeout(500);
        await shot(page, "run-live");
      });
    });
  }
}

void REAL_RUN;
void pattern;
