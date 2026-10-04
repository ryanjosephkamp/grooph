import { readFileSync } from "node:fs";
import { join } from "node:path";
import { deflateRawSync } from "node:zlib";

import { buildShareEnvelope, encodeSharePayload, parseMapText } from "@grooph/core";
import { expect, test } from "@playwright/test";
import { strFromU8, unzipSync } from "fflate";

import { downloadBytes, fixturePath, goldenDir, importDocument, node, readTree, repoRoot, status } from "./support.js";

/**
 * Handoff 0081, item 4: the smoke set. Five visits a stranger makes, short enough to run in Safari's engine
 * (WebKit) and in Firefox as well as in Chromium:
 *
 *   GROOPH_BROWSERS=1 pnpm --filter @grooph/web test:e2e
 *
 * Each is drawn from a longer spec that runs in Chromium only (landing, templates, roundtrip, map, offline), and
 * checks what an engine could get wrong on its own: the page starts, the canvas measures and draws, a file goes in
 * and a package comes out byte for byte, a link decodes, and the service worker answers with no network.
 *
 * A test that cannot pass in one engine for a reason that is the engine's says which and why where it stands, and
 * stays in the file.
 */

// An uncaught error in the page fails the visit that raised it: syntax or an API one engine lacks shows here first.
let pageErrors: string[] = [];
test.beforeEach(({ page }) => {
  pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
});
test.afterEach(() => {
  expect(pageErrors, "uncaught errors in the page").toEqual([]);
});

test("the front page opens: the name, a drawn loop graph, the way in, nothing scrolling sideways", async ({ page }) => {
  const response = await page.goto("./");
  expect(response?.status()).toBe(200);
  await expect(page.getByRole("heading", { name: "grooph", level: 1 })).toBeVisible();

  // Core's picture, drawn in the page: four nodes with their words measured by this engine's own text layout.
  const picture = page.locator("svg.grooph-picture").first();
  await expect(picture).toBeVisible();
  expect(await picture.locator("[data-node]").count()).toBe(4);
  const box = (await picture.boundingBox())!;
  expect(box.width).toBeGreaterThan(200);
  expect(box.height).toBeGreaterThan(100);

  await expect(page.getByRole("button", { name: "New graph" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
});

test("a template opens from the list on the canvas, read-only, every node inside the screen", async ({ page }) => {
  await page.goto("./#/templates");
  await expect(page.getByRole("heading", { name: "Templates", level: 1 })).toBeVisible();
  const row = page.locator('.template-row[data-template="review-gate"]');
  await expect(row.locator(".template-glyph svg")).toBeVisible();

  await row.tap();
  await expect(page.locator(".title-sub")).toHaveText("built-in template · read-only");
  for (const id of ["builder", "critic", "merge-gate", "done"]) await expect(node(page, id)).toBeVisible();
  await expect(page.locator(".react-flow__edge")).toHaveCount(5);

  // The canvas fitted the graph to this screen: a node measured as zero, or laid out off it, shows here.
  const viewport = page.viewportSize()!;
  for (const id of ["builder", "critic", "merge-gate", "done"]) {
    const box = (await node(page, id).boundingBox())!;
    expect(box.width, id).toBeGreaterThan(20);
    expect(box.x, id).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width, id).toBeLessThanOrEqual(viewport.width);
    expect(box.y + box.height, id).toBeLessThanOrEqual(viewport.height);
  }
});

test("a graph is imported and its export panel gives the golden package, byte for byte", async ({ page }) => {
  await importDocument(page, "review-loop.grooph.json", readFileSync(fixturePath, "utf8"));
  await expect(status(page)).toHaveText("1 warning");
  await expect(node(page, "builder")).toBeVisible();

  await page.getByRole("button", { name: "Export", exact: true }).tap();
  const [zip] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "Download package (.zip)" }).tap(),
  ]);
  expect(zip.suggestedFilename()).toBe("review-loop-claude-code.zip");

  // The compiler ran in this engine: the same files as the CLI writes, to the byte.
  const files = Object.fromEntries(Object.entries(unzipSync(await downloadBytes(zip))).map(([path, bytes]) => [path, strFromU8(bytes)]));
  const golden = readTree(goldenDir);
  expect(Object.keys(files).sort()).toEqual(Object.keys(golden).sort());
  for (const path of Object.keys(golden)) expect(files[path], path).toBe(golden[path]);
});

test("an operation map opens from a link as its picture, every session and handoff drawn", async ({ page }) => {
  const map = parseMapText(readFileSync(join(repoRoot, "fixtures/maps/valid/owner-operation-2026-09-30.grooph-map.json"), "utf8")).map!;
  // The link `grooph share` makes: the document deflated into the address, inflated again by the page.
  await page.goto(`./#/open?d=${encodeSharePayload(buildShareEnvelope(map), (bytes) => deflateRawSync(bytes, { level: 9 }))}`);
  await expect(page.locator(".title-name")).toHaveText(map.name);
  await expect(page.getByRole("button", { name: "Validation: Valid" })).toBeVisible();

  const picture = page.locator(".map-picture svg");
  await expect(picture).toBeVisible();
  for (const session of map.sessions) await expect(page.locator(`[data-session="${session.id}"]`)).toHaveCount(1);
  for (const handoff of map.handoffs) await expect(page.locator(`[data-handoff-row="${handoff.id}"]`)).toHaveCount(1);
  expect((await picture.boundingBox())!.width).toBeGreaterThan(300);

  // A session opens what the map says about it.
  await page.locator('[data-session="operator"]').tap();
  await expect(page.locator("aside.sheet").getByRole("heading", { name: "Session" })).toBeVisible();
});

test.describe("with the service worker running", () => {
  // Every other spec blocks service workers so it tests the files as built; the offline visit needs the worker.
  test.use({ serviceWorkers: "allow" });

  test("the offline visit: after one visit with a network, the app and a template open with none", async ({ page, context }) => {
    await page.goto("./");
    await expect(page.getByRole("heading", { name: "grooph", level: 1 })).toBeVisible();
    await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
    // The worker has finished keeping what the page names, the screens that draw on the canvas among them.
    await expect
      .poll(() => page.evaluate(async () => (await (await caches.open("grooph-app-v1")).keys()).filter((r) => /\/assets\/screens-[^/]*\.js$/.test(r.url)).length))
      .toBe(1);

    await context.setOffline(true);

    // The address typed again with no network, then an address the first visit never asked for.
    await page.goto("./");
    await expect(page.getByRole("heading", { name: "grooph", level: 1 })).toBeVisible();
    await page.goto("./#/templates/built-in/review-gate");
    await page.reload();
    await expect(node(page, "builder")).toBeVisible();
    await expect(page.locator(".react-flow__edge")).toHaveCount(5);
  });
});
