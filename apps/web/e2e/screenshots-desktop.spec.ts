import { readFileSync } from "node:fs";
import { join } from "node:path";

import { expect, test, type Page } from "@playwright/test";

import { fixturePath, importDocument, linkFor, node, repoRoot, reviewLoop, sheet, status } from "./support.js";

/**
 * Handoff 0061, criteria 1 and 8: the editor, the viewer, the outline, the
 * issues panel, the export panel and a template's page, at phone and desktop
 * size, light and dark. Made only on request, into the slice folder:
 *
 *   GROOPH_SHOTS=1 GROOPH_SHOTS_TAG=after pnpm --filter @grooph/web exec playwright test e2e/screenshots-desktop.spec.ts
 *
 * `GROOPH_SHOTS_TAG` names the set (`before` or `after`); the files are
 * `<tag>-<screen>-<size>-<scheme>.png`.
 */
test.skip(!process.env["GROOPH_SHOTS"], "screenshots are made on request (GROOPH_SHOTS=1)");

const dir = join(repoRoot, "handoffs/0061-editor-on-a-desktop/shots");
const tag = process.env["GROOPH_SHOTS_TAG"] ?? "after";
const invalidPath = join(repoRoot, "fixtures/invalid/E_CYCLE_NO_STOP/loop-without-stop.grooph.json");
const sizes = { phone: { width: 400, height: 800 }, desktop: { width: 1440, height: 900 } } as const;

async function settle(page: Page): Promise<void> {
  await expect(page.locator(".react-flow__node").first()).toBeVisible();
  await page.waitForTimeout(600);
}

for (const [size, viewport] of Object.entries(sizes)) {
  for (const scheme of ["light", "dark"] as const) {
    test.describe(`${size}, ${scheme}`, () => {
      test.use({ viewport, colorScheme: scheme, ...(size === "desktop" ? { isMobile: false, hasTouch: false, deviceScaleFactor: 1 } : {}) });
      const shot = (page: Page, screen: string) => page.screenshot({ path: join(dir, `${tag}-${screen}-${size}-${scheme}.png`), scale: "css" });

      test(`a graph from a link, ${size} ${scheme}`, async ({ page }) => {
        await page.goto(linkFor(reviewLoop()));
        await settle(page);
        await shot(page, "link");
        await node(page, "critic").click();
        await expect(sheet(page)).toBeVisible();
        await page.waitForTimeout(400);
        await shot(page, "link-node");
      });

      test(`the editor, ${size} ${scheme}`, async ({ page }) => {
        await importDocument(page, "review-loop.grooph.json", readFileSync(fixturePath, "utf8"));
        await settle(page);
        await shot(page, "editor");
        await node(page, "critic").click();
        await expect(sheet(page)).toBeVisible();
        await page.waitForTimeout(400);
        await shot(page, "editor-node");
        await page.getByRole("button", { name: "Outline" }).click();
        await expect(page.locator(".outline")).toBeVisible();
        await page.waitForTimeout(400);
        await shot(page, "outline");
        await page.getByRole("button", { name: "Export", exact: true }).click();
        await expect(sheet(page).getByRole("button", { name: /Download package/ })).toBeVisible();
        await page.waitForTimeout(400);
        await shot(page, "export");
      });

      test(`the issues panel, ${size} ${scheme}`, async ({ page }) => {
        await importDocument(page, "loop-without-stop.grooph.json", readFileSync(invalidPath, "utf8"));
        await settle(page);
        await status(page).click();
        await expect(sheet(page).locator(".issue").first()).toBeVisible();
        await page.waitForTimeout(400);
        await shot(page, "issues");
      });

      test(`a template's page, ${size} ${scheme}`, async ({ page }) => {
        await page.goto("./#/templates/built-in/review-gate");
        await settle(page);
        await shot(page, "template");
      });
    });
  }
}
