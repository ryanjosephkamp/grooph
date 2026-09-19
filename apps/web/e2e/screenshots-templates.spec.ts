import { readFileSync } from "node:fs";
import { join } from "node:path";

import { expect, test, type Page } from "@playwright/test";

import { closeSheet, csvSet, fit, fixturePath, importDocument, linkFor, node, repoRoot, sheet, toolbar } from "./support.js";

/**
 * Handoff 0007, criterion 11: phone screenshots of the new screens, light and
 * dark, into the slice folder. Made only on request:
 *
 *   GROOPH_SHOTS=1 pnpm --filter @grooph/web exec playwright test e2e/screenshots-templates.spec.ts
 */
const dir = join(repoRoot, "handoffs/0007-web-templates");
test.skip(!process.env["GROOPH_SHOTS"], "screenshots are made on request (GROOPH_SHOTS=1)");

/** The storage notice is shown once per device; these shots are of other screens, so it is marked seen. */
const noticeSeen = (page: Page) => page.addInitScript(() => localStorage.setItem("grooph.persistence", JSON.stringify({ result: "denied", seen: true })));
const shot = (page: Page, name: string) => page.screenshot({ path: join(dir, `${name}.png`) });

for (const scheme of ["light", "dark"] as const) {
  test.describe(`phone, ${scheme}`, () => {
    test.use({ colorScheme: scheme });

    test(`templates screen, ${scheme}`, async ({ page }) => {
      await noticeSeen(page);
      await page.goto("./#/templates");
      await expect(page.locator(".template-row").first()).toBeVisible();
      await shot(page, `templates-phone-${scheme}`);
    });

    test(`template viewer, ${scheme}`, async ({ page }) => {
      await noticeSeen(page);
      await page.goto("./#/templates/built-in/review-gate");
      await expect(node(page, "critic")).toBeVisible();
      await page.waitForTimeout(400);
      await shot(page, `template-view-phone-${scheme}`);
    });

    test(`use form, ${scheme}`, async ({ page }) => {
      await noticeSeen(page);
      await page.goto("./#/templates/built-in/review-gate/use");
      await page.getByLabel("Graph name").fill("CSV export, reviewed");
      await page.locator("textarea").first().fill("Add a CSV export of the orders table to the admin page.");
      await page.locator("textarea").first().blur();
      await shot(page, `use-form-phone-${scheme}`);
    });

    test(`undo toast, ${scheme}`, async ({ page }) => {
      await noticeSeen(page);
      await importDocument(page, "review-loop.grooph.json", readFileSync(fixturePath, "utf8"));
      await node(page, "critic").tap();
      await sheet(page).getByRole("button", { name: "Delete agent" }).tap();
      await expect(page.locator(".toast")).toBeVisible();
      await page.waitForTimeout(250);
      await shot(page, `undo-toast-phone-${scheme}`);
    });
  });
}

test.describe("phone, light: the other new screens", () => {
  test("insert: the id map", async ({ page }) => {
    await noticeSeen(page);
    await importDocument(page, "review-loop.grooph.json", readFileSync(fixturePath, "utf8"));
    await toolbar(page).getByRole("button", { name: "Add" }).tap();
    await shot(page, "add-menu-phone-light");
    await sheet(page).getByRole("button", { name: /^Insert a template/ }).tap();
    await shot(page, "insert-list-phone-light");
    await sheet(page).getByRole("button", { name: /^Human-gated irreversible step/ }).tap();
    await sheet(page).getByLabel("What is the irreversible step, in one sentence?").fill("Merge the change into main.");
    await sheet(page).getByLabel(/Which kind of irreversible action/).fill("merge");
    await sheet(page).getByRole("button", { name: "Insert fragment" }).tap();
    await page.waitForTimeout(500);
    await shot(page, "insert-idmap-phone-light");
  });

  test("save as template", async ({ page }) => {
    await noticeSeen(page);
    await importDocument(page, "review-loop.grooph.json", readFileSync(fixturePath, "utf8"));
    await page.locator(".title-btn").tap();
    await sheet(page).getByRole("button", { name: "Save as template…" }).tap();
    await sheet(page).getByLabel("Summary").fill("Builder, critic, then a human merges.");
    await page.getByRole("button", { name: "Expand panel" }).tap();
    await shot(page, "save-template-phone-light");
  });

  test("toolbar docked above the sheet, selection in view", async ({ page }) => {
    await noticeSeen(page);
    await importDocument(page, "review-loop.grooph.json", readFileSync(fixturePath, "utf8"));
    await fit(page);
    await node(page, "merge-gate").tap();
    await page.waitForTimeout(500);
    await shot(page, "toolbar-docked-phone-light");
  });

  test("rename warning", async ({ page }) => {
    await noticeSeen(page);
    await importDocument(page, "review-loop.grooph.json", readFileSync(fixturePath, "utf8"));
    await page.getByRole("button", { name: "Export", exact: true }).tap();
    const downloading = page.waitForEvent("download");
    await sheet(page).getByRole("button", { name: "Download package (.zip)" }).tap();
    await downloading;
    await closeSheet(page);
    await page.locator(".title-btn").tap();
    await sheet(page).getByLabel("Name", { exact: true }).fill("Review loop v2");
    await shot(page, "rename-warning-phone-light");
  });

  test("storage notice", async ({ page }) => {
    await page.addInitScript(() =>
      Object.defineProperty(navigator, "storage", { configurable: true, value: { persisted: async () => false, persist: async () => false } }),
    );
    await page.goto("./");
    await page.getByRole("button", { name: "New graph" }).tap();
    await expect(page.locator(".persist-notice")).toBeVisible();
    await shot(page, "storage-notice-phone-light");
  });

  test("compare view opens on the recommended card", async ({ page }) => {
    await noticeSeen(page);
    const set = csvSet();
    set.recommendation = { candidate: "reviewed", why: set.recommendation!.why };
    await page.goto(linkFor(set));
    await expect(page.locator(".pager-count")).toHaveText("Reviewed · 2 of 3");
    await page.waitForTimeout(400);
    await shot(page, "compare-recommended-phone-light");
  });
});
