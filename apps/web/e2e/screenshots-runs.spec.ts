import { join } from "node:path";

import { canonicalize } from "@grooph/core";
import { expect, test, type Page } from "@playwright/test";

import { REAL_RUN, bundleText, linkFor, noteItem, repoRoot, runBundle, runTab } from "./support.js";

/**
 * Handoff 0008, criterion 7: the run view at phone width, light and dark, for
 * review. Made only on request, into the slice folder:
 *
 *   GROOPH_SHOTS=1 pnpm --filter @grooph/web exec playwright test e2e/screenshots-runs.spec.ts
 */
const dir = join(repoRoot, "handoffs/0008-runs");
test.skip(!process.env["GROOPH_SHOTS"], "screenshots are made on request (GROOPH_SHOTS=1)");

async function settle(page: Page): Promise<void> {
  await expect(page.locator(".run-badge").first()).toBeVisible();
  await page.waitForTimeout(500);
}

const live = () => runBundle("run-live");

for (const scheme of ["light", "dark"] as const) {
  test.describe(`phone, ${scheme}`, () => {
    test.use({ colorScheme: scheme });

    test(`run view, phone ${scheme}`, async ({ page }) => {
      const real = runBundle("slice-0007-sandwich");
      await page.goto(linkFor(real));
      await settle(page);
      await noteItem(page, "n-0006").locator(".tl-note").tap();
      await page.waitForTimeout(500);
      await page.screenshot({ path: join(dir, `run-timeline-phone-${scheme}.png`) });

      await runTab(page, "Changes").tap();
      await page.waitForTimeout(200);
      await page.screenshot({ path: join(dir, `run-changes-phone-${scheme}.png`) });

      await runTab(page, "Proposals").tap();
      await page.waitForTimeout(200);
      await page.screenshot({ path: join(dir, `run-proposals-phone-${scheme}.png`) });
    });

    test(`live run with a node running, phone ${scheme}`, async ({ page }) => {
      await page.emulateMedia({ reducedMotion: "reduce" });
      await page.route("**/grooph/api/run.json", (route) => route.fulfill({ status: 200, contentType: "application/json", body: bundleText(live()) }));
      await page.goto("./#/run?live");
      await settle(page);
      await page.screenshot({ path: join(dir, `run-live-phone-${scheme}.png`) });
    });
  });
}

test("halted at a gate, phone light", async ({ page }) => {
  await page.goto(linkFor(runBundle("run-gate")));
  await settle(page);
  await page.screenshot({ path: join(dir, "run-halted-phone-light.png") });
});

test("runs listed under their graph, phone light", async ({ page }) => {
  const real = runBundle("slice-0007-sandwich");
  await page.goto("./");
  await page.locator('input[type="file"]').setInputFiles({ name: "slice-0007-sandwich.grooph.json", mimeType: "application/json", buffer: Buffer.from(canonicalize(real.source)) });
  await expect(page.getByRole("button", { name: /^Validation:/ })).toBeVisible();
  await page.goto("./");
  await page.locator('input[type="file"]').setInputFiles({ name: `${REAL_RUN}.grooph-run.json`, mimeType: "application/json", buffer: Buffer.from(bundleText(real)) });
  await expect(page.locator(".title-sub")).toContainText("on this device");
  await page.goto("./");
  await expect(page.locator(".run-row")).toBeVisible();
  await page.screenshot({ path: join(dir, "run-library-phone-light.png") });
});

test("desktop, the run view side by side", async ({ browser, baseURL }) => {
  const page = await browser.newPage({ viewport: { width: 1280, height: 820 } });
  await page.goto(`${baseURL}${linkFor(runBundle("slice-0007-sandwich")).slice(2)}`);
  await settle(page);
  await runTab(page, "Changes").click();
  await page.waitForTimeout(300);
  await page.screenshot({ path: join(dir, "run-changes-desktop.png") });
  await page.close();
});
