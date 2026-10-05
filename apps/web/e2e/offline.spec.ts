import { readFileSync } from "node:fs";

import { expect, test } from "@playwright/test";

import { canvasIsQuiet, fixturePath, node, requestsOut, visitIsOver } from "./support.js";

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
  const out = requestsOut(page);
  await page.goto("./");
  await page.locator('input[type="file"]').setInputFiles({ name: "review-loop.grooph.json", mimeType: "application/json", buffer: Buffer.from(readFileSync(fixturePath, "utf8")) });
  await expect(node(page, "builder")).toBeVisible();
  // The visit is over before the network goes: every file the page names is held, whole (`visitIsOver`).
  await visitIsOver(page, out);
  await page.waitForTimeout(400); // the document's save

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
  await canvasIsQuiet(page);
  await page.getByRole("button", { name: "Outline" }).tap();
  await expect(page.locator(".outline-section").first()).toContainText("Review loop");

  // The built-in templates are a piece of the app the page names, so the worker holds them and they are there too.
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
  // Slice 0069: the front page loads without the screens that draw on the canvas. The worker keeps them all the same:
  // it reads their names from the page when it installs, before it takes control, whether or not the page has asked.
  const out = requestsOut(page);
  await page.goto("./");
  await expect(page.locator(".land-headline")).toBeVisible();
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
  const held = await page.evaluate(async () => (await (await caches.open("grooph-app-v1")).keys()).map((r) => new URL(r.url).pathname.split("/").pop()!));
  for (const file of [/^index-.*\.js$/, /^App-.*\.js$/, /^share-.*\.js$/, /^screens-.*\.js$/, /^styles-.*\.css$/, /^base-.*\.css$/]) {
    expect(held.filter((name) => file.test(name)), String(file)).toHaveLength(1);
  }
  // And the visit is over before the network goes: every file the page names, whole (`visitIsOver`).
  await visitIsOver(page, out);

  await context.setOffline(true);
  const failed: string[] = [];
  page.on("requestfailed", (r) => failed.push(r.url()));
  // The address differs only after the #, so the template is drawn before the reload: wait for all it fetches, then
  // load it from nothing. The switch between its views is a file of its own, and it too is there with no network.
  await page.goto("./#/templates/built-in/review-gate");
  await canvasIsQuiet(page);
  await page.reload();
  await expect(page.locator(".react-flow__node").first()).toBeVisible();
  await canvasIsQuiet(page);
  expect(failed).toEqual([]);
});

test("a page that names files the worker does not hold has them fetched, though the page never asks", async ({ page, context }) => {
  // What a new deploy looks like to a returning visitor: the page arrives, and its files are not in the cache.
  await page.goto("./");
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
  const held = () => page.evaluate(async () => (await (await caches.open("grooph-app-v1")).keys()).filter((r) => /\/assets\/(screens|App)-[^/]*\.js$/.test(r.url)).length);
  await expect.poll(held).toBe(2);
  await page.evaluate(async () => {
    const cache = await caches.open("grooph-app-v1");
    for (const r of await cache.keys()) if (/\/assets\/(screens|App)-[^/]*\.js$/.test(r.url)) await cache.delete(r);
  });
  expect(await held()).toBe(0);

  // The next visit runs no script at all, as one that ends before the app has started: only the worker can fetch them.
  const cdp = await context.newCDPSession(page);
  await cdp.send("Emulation.setScriptExecutionDisabled", { value: true });
  await page.reload();
  await expect(page.locator("#root")).toBeEmpty();
  await expect.poll(held).toBe(2);
});

test("the exporter is kept too: after a visit that saw only the front page, a graph exports with no network", async ({ page, context }) => {
  // Slice 0070: the compiler is fetched when a person exports. No address asks for it, but the page names it,
  // and the worker keeps what a page names.
  const out = requestsOut(page);
  await page.goto("./");
  await expect(page.locator(".land-headline")).toBeVisible();
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
  expect(await page.evaluate(() => performance.getEntriesByType("resource").some((e) => /\/assets\/compile-/.test(e.name)))).toBe(false);
  // The visit is over before the network goes: every file the page names is held, whole (`visitIsOver`).
  await visitIsOver(page, out);

  await context.setOffline(true);
  await page.reload();
  await page.locator('input[type="file"]').setInputFiles({ name: "review-loop.grooph.json", mimeType: "application/json", buffer: Buffer.from(readFileSync(fixturePath, "utf8")) });
  await expect(node(page, "builder")).toBeVisible();
  await page.getByRole("button", { name: "Export", exact: true }).tap();
  const [zip] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Download package (.zip)" }).tap()]);
  expect(zip.suggestedFilename()).toBe("review-loop-claude-code.zip");
});
