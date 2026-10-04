import { readFileSync } from "node:fs";
import { join } from "node:path";
import { deflateRawSync } from "node:zlib";

import { buildShareEnvelope, encodeSharePayload, parseMapText } from "@grooph/core";
import { expect, test, type Page } from "@playwright/test";

import { edgeLabel, fixturePath, importDocument, linkFor, node, repoRoot, reviewLoop, runBundle, sheet, status, toolbar } from "./support.js";

/**
 * Handoff 0061, criteria 1 and 8: the editor, the viewer, the outline, the
 * issues panel, the export panel and a template's page, at phone and desktop
 * size, light and dark. Made only on request, into the slice folder:
 *
 *   GROOPH_SHOTS=1 GROOPH_SHOTS_TAG=after pnpm --filter @grooph/web exec playwright test e2e/screenshots-desktop.spec.ts
 *
 * `GROOPH_SHOTS_TAG` names the set (`before` or `after`); the files are
 * `<tag>-<screen>-<size>-<scheme>.png`. `GROOPH_SHOTS_DIR` sends them
 * somewhere else, and `GROOPH_SHOTS_EXTRA=1` adds the other panels and the
 * screens that share the top bar (a map, a run), on a desktop only: they are
 * for looking at, and the slice folder does not keep them.
 */
test.skip(!process.env["GROOPH_SHOTS"], "screenshots are made on request (GROOPH_SHOTS=1)");

const dir = process.env["GROOPH_SHOTS_DIR"] ?? join(repoRoot, "handoffs/0061-editor-on-a-desktop/shots");
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
      const shot = async (page: Page, screen: string) => {
        await page.waitForTimeout(450);
        await page.screenshot({ path: join(dir, `${tag}-${screen}-${size}-${scheme}.png`), scale: "css" });
      };

      test(`a graph from a link, ${size} ${scheme}`, async ({ page }) => {
        await page.goto(linkFor(reviewLoop()));
        await settle(page);
        await shot(page, "link");
        await node(page, "critic").click();
        await expect(sheet(page)).toBeVisible();
        await shot(page, "link-node");
      });

      test(`the editor, ${size} ${scheme}`, async ({ page }) => {
        await importDocument(page, "review-loop.grooph.json", readFileSync(fixturePath, "utf8"));
        await settle(page);
        await shot(page, "editor");
        await node(page, "critic").click();
        await expect(sheet(page)).toBeVisible();
        await shot(page, "editor-node");
        const outline = page.getByRole("button", { name: "Outline" });
        await outline.click();
        await expect(page.locator(".outline")).toBeVisible();
        await shot(page, "outline");
        // On a desktop the outline stays open beside whatever else is: close it, so the export panel is seen as it was before.
        if ((await outline.getAttribute("aria-pressed")) === "true") await outline.click();
        await page.getByRole("button", { name: "Export", exact: true }).click();
        await expect(sheet(page).getByRole("button", { name: /Download package/ })).toBeVisible();
        await shot(page, "export");
      });

      test(`the issues panel, ${size} ${scheme}`, async ({ page }) => {
        await importDocument(page, "loop-without-stop.grooph.json", readFileSync(invalidPath, "utf8"));
        await settle(page);
        await status(page).click();
        await expect(sheet(page).locator(".issue").first()).toBeVisible();
        await shot(page, "issues");
      });

      test(`a template's page, ${size} ${scheme}`, async ({ page }) => {
        await page.goto("./#/templates/built-in/review-gate");
        await settle(page);
        await shot(page, "template");
      });

      test(`the other panels and the screens that share the top bar, ${size} ${scheme}`, async ({ page }) => {
        test.skip(!process.env["GROOPH_SHOTS_EXTRA"] || (size === "phone" && scheme === "dark"), "extra screens are made on request (GROOPH_SHOTS_EXTRA=1)");
        await importDocument(page, "review-loop.grooph.json", readFileSync(fixturePath, "utf8"));
        await settle(page);
        await page.locator(".title-btn").click();
        await shot(page, "x-graph");
        await page.getByRole("button", { name: "Build-review cycle" }).first().click();
        await shot(page, "x-loop");
        await edgeLabel(page, "e-review-pass").click();
        await shot(page, "x-edge");
        await toolbar(page).getByRole("button", { name: "Add" }).click();
        await shot(page, "x-add");
        await sheet(page).getByRole("button", { name: /Insert a template/ }).click();
        await shot(page, "x-insert");
        await page.getByRole("button", { name: "Close panel" }).click();
        await toolbar(page).getByRole("button", { name: "Connect" }).click();
        await shot(page, "x-connect");
        await page.getByRole("button", { name: "Cancel" }).click();

        await page.goto("./#/templates/built-in/tournament-then-judge");
        await settle(page);
        await page.getByRole("button", { name: "Outline" }).click();
        await shot(page, "x-template-large");

        await page.goto(linkFor(runBundle("slice-0007-sandwich")));
        await settle(page);
        await shot(page, "x-run");

        const map = parseMapText(readFileSync(join(repoRoot, "fixtures/maps/valid/owner-operation-2026-09-30.grooph-map.json"), "utf8")).map!;
        await page.goto(`./#/open?d=${encodeSharePayload(buildShareEnvelope(map), (bytes) => deflateRawSync(bytes, { level: 9 }))}`);
        await expect(page.locator(".map-picture svg")).toBeVisible();
        await page.locator('[data-session="operator"]').click();
        await shot(page, "x-map");
      });
    });
  }
}
