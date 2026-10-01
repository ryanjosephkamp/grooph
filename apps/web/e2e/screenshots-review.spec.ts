import { mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { expect, test, type Page } from "@playwright/test";

import { bundleText, csvSet, fixturePath, importDocument, linkFor, node, repoRoot, runBundle } from "./support.js";

/**
 * The fresh-eyes review (docs/review-2026-10.md): the main screens at the two
 * sizes the review names, a 390 px phone and a 1280 px computer, light and
 * dark. Made only on request, into GROOPH_SHOT_DIR (default:
 * apps/web/test-results/review-shots, which git ignores; the review keeps the
 * few it shows under docs/review-2026-10/):
 *
 *   GROOPH_SHOTS=1 pnpm --filter @grooph/web exec playwright test e2e/screenshots-review.spec.ts
 */
const dir = process.env["GROOPH_SHOT_DIR"] ?? join(repoRoot, "apps/web/test-results/review-shots");
test.skip(!process.env["GROOPH_SHOTS"], "screenshots are made on request (GROOPH_SHOTS=1)");
test.beforeAll(() => mkdirSync(dir, { recursive: true }));

const noticeSeen = (page: Page) => page.addInitScript(() => localStorage.setItem("grooph.persistence", JSON.stringify({ result: "denied", seen: true })));

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

test.describe("slice 0025, phone light", () => {
  test.use({ ...SIZES.phone, colorScheme: "light" });
  test("the outline and Keep a copy", async ({ page }) => {
    await noticeSeen(page);
    await importDocument(page, "review-loop.grooph.json", readFileSync(fixturePath, "utf8"));
    await page.getByRole("button", { name: "Outline" }).tap();
    await page.waitForTimeout(300);
    await page.screenshot({ path: join(dir, "outline-phone-light.png") });
    await page.getByRole("button", { name: "Export", exact: true }).tap();
    await page.getByRole("group", { name: "Keep a copy" }).scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);
    await page.screenshot({ path: join(dir, "keep-phone-light.png") });
  });
});

test.describe("slice 0027, phone", () => {
  for (const scheme of ["light", "dark"] as const) {
    test(`live sessions, ${scheme}`, async ({ browser }) => {
      const { parseEvents, summarizeSessions } = await import("@grooph/core");
      const events = ["claude-code-running.jsonl", "codex-two-subagents.jsonl", "claude-code-nested.jsonl"].flatMap((name, i) =>
        parseEvents(readFileSync(join(repoRoot, "fixtures/events", name), "utf8")).events.map((e) => ({ ...e, source: i === 1 ? "the Mac" : "cloud lanes" })),
      );
      const view = { groophLive: 0, at: "2026-10-01T02:01:10.000Z", sessions: summarizeSessions(events.sort((a, b) => (a.t < b.t ? -1 : 1))) };
      const context = await browser.newContext({ ...SIZES.phone, colorScheme: scheme, reducedMotion: "reduce" });
      const page = await context.newPage();
      await page.route("**/grooph/api/live.json", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(view) }));
      await page.goto("./#/live");
      await expect(page.locator(".live-session").first()).toBeVisible();
      await page.screenshot({ path: join(dir, `live-phone-${scheme}.png`), fullPage: false });
      await context.close();
    });
  }
});
