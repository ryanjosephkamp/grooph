import { readFileSync } from "node:fs";

import { expect, test } from "@playwright/test";

import { fixturePath, node } from "./support.js";

/**
 * Stage 8, the installable offline app: once opened with a network, the app
 * opens with none, with the graphs kept on the device. Every other spec
 * blocks service workers so it tests the files as built; this one lets the
 * worker run.
 */
test.use({ serviceWorkers: "allow" });

test("the app is installable: a manifest with its icons, and a service worker in control", async ({ page, request, baseURL }) => {
  await page.goto("./");
  const href = await page.locator('link[rel="manifest"]').getAttribute("href");
  const manifestUrl = new URL(href!, baseURL).href;
  const manifest = (await (await request.get(manifestUrl)).json()) as { name: string; display: string; start_url: string; scope: string; icons: { src: string; sizes: string; purpose?: string }[] };
  expect(manifest).toMatchObject({ name: "grooph", display: "standalone", start_url: "./", scope: "./" });
  expect(manifest.icons.map((i) => i.sizes)).toEqual(expect.arrayContaining(["192x192", "512x512"]));
  expect(manifest.icons.some((i) => i.purpose === "maskable")).toBe(true);
  for (const icon of manifest.icons) {
    const res = await request.get(new URL(icon.src, manifestUrl).href);
    expect(res.status(), icon.src).toBe(200);
  }
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
  expect(await page.evaluate(() => navigator.serviceWorker.controller!.scriptURL)).toBe(new URL("sw.js", baseURL).href);
});

test("once opened with a network, it opens with none: the library, the templates, a graph kept on the device", async ({ page, context }) => {
  // First visit, online: import a graph, so there is something of the person's own to find again.
  await page.goto("./");
  await page.locator('input[type="file"]').setInputFiles({ name: "review-loop.grooph.json", mimeType: "application/json", buffer: Buffer.from(readFileSync(fixturePath, "utf8")) });
  await expect(node(page, "builder")).toBeVisible();
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
  await page.waitForTimeout(400); // the document's save, and the worker's cache

  await context.setOffline(true);
  const failed: string[] = [];
  page.on("requestfailed", (r) => failed.push(r.url()));

  // A cold start with no network: the address typed again.
  await page.goto("./");
  await expect(page.getByRole("button", { name: "New graph" })).toBeVisible();
  await expect(page.locator(".graph-name", { hasText: "Review loop" })).toBeVisible();

  // The graph opens and can be worked on.
  await page.locator(".graph-name", { hasText: "Review loop" }).tap();
  await expect(node(page, "critic")).toBeVisible();
  await page.getByRole("button", { name: "Outline" }).tap();
  await expect(page.locator(".outline-section").first()).toContainText("Review loop");

  // The built-in templates are part of the app, so they are there too.
  await page.goto("./#/templates");
  await expect(page.locator(".template-row").first()).toBeVisible();
  await page.reload();
  await expect(page.locator(".template-row").first()).toBeVisible();

  expect(failed).toEqual([]);

  // Back online, the page is fetched again, so a new deploy is picked up on the next visit.
  await context.setOffline(false);
  const [response] = await Promise.all([page.waitForResponse((r) => r.url().endsWith("/grooph/") && r.request().isNavigationRequest()), page.goto("./")]);
  expect(response.status()).toBe(200);
});

test("a first visit that saw only the front page still opens a template with no network", async ({ page, context }) => {
  // Slice 0069: the front page loads without the screens that draw on the canvas, fetches them once it is up, and the worker keeps them.
  await page.goto("./");
  await expect(page.locator(".land-headline")).toBeVisible();
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
  await page.waitForFunction(async () => (await (await caches.open("grooph-app-v1")).keys()).some((r) => /\/screens-[^/]*\.js/.test(r.url)));

  await context.setOffline(true);
  const failed: string[] = [];
  page.on("requestfailed", (r) => failed.push(r.url()));
  await page.goto("./#/templates/built-in/review-gate");
  await page.reload();
  await expect(page.locator(".react-flow__node").first()).toBeVisible();
  expect(failed).toEqual([]);
});
