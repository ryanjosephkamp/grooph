import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { glyph, instantiate, parseGraphText, picture, type Graph } from "@grooph/core";
import { expect, test, type Page } from "@playwright/test";

import { canvasIsQuiet, fixturePath, importDocument, linkFor, node, repoRoot, reviewLoop, sheet, toolbar } from "./support.js";

/**
 * Slice 0093: weight out of the first load. The twenty built-in templates were part of every address's first load
 * (23 KB compressed), to draw one picture and six glyphs on the front page. They are a piece of the app the
 * template screens fetch now, and the front page's picture and tiles are drawn when the app is built and carried
 * in a piece only the front page's address asks for. Nothing a person sees is to have changed: these hold what
 * each address asks for, that each screen still shows what it showed, and what is said when a piece cannot be had.
 */
const patterns = readdirSync(join(repoRoot, "patterns")).filter((name) => name.endsWith(".grooph.json"));
const pattern = (id: string): Graph => parseGraphText(readFileSync(join(repoRoot, "patterns", `${id}.grooph.json`), "utf8")).doc!;

/**
 * The pieces an address asks for beside the app: what its page has put in its head by the time the app's own script
 * is asked for, which is before any of the app has run. (Once it runs, the app asks for the rest itself, for the
 * next screen: read any later, the head would hold those too.) The app's script is held back while the head is read.
 */
async function asked(page: Page, address: string): Promise<{ front: boolean; templates: boolean; canvas: boolean }> {
  let reached: () => void = () => undefined;
  let release: () => void = () => undefined;
  let passed: () => void = () => undefined;
  const atTheApp = new Promise<void>((done) => (reached = done));
  const read = new Promise<void>((done) => (release = done));
  const onItsWay = new Promise<void>((done) => (passed = done));
  await page.route("**/assets/App-*.js", async (route) => {
    reached();
    await read;
    await route.continue();
    passed();
  });
  await page.goto(address, { waitUntil: "commit" });
  await atTheApp;
  const found = await page.evaluate(() => {
    const files = [...document.head.querySelectorAll<HTMLLinkElement>('link[rel="modulepreload"]')].map((link) => link.href);
    const has = (name: string): boolean => files.some((file) => new RegExp(`/assets/${name}-[\\w-]+\\.js$`).test(file));
    return { front: has("front"), templates: has("builtins"), canvas: has("screens"), app: has("App") };
  });
  release();
  await onItsWay;
  await page.unroute("**/assets/App-*.js");
  // The app itself is among them: the head was read where it was meant to be.
  expect(found.app, address).toBe(true);
  return { front: found.front, templates: found.templates, canvas: found.canvas };
}

/** Whether an element holds this markup, as a browser reads it. */
const holds = (page: Page, selector: string, markup: string): Promise<boolean> =>
  page.locator(selector).evaluate((el, html) => {
    const read = document.createElement("div");
    read.innerHTML = html;
    return el.innerHTML === read.innerHTML;
  }, markup);

test("each address asks, beside the app, for the pieces its first screen needs and for no other", async ({ page }) => {
  const cases: [string, string, { front: boolean; templates: boolean; canvas: boolean }, string][] = [
    ["the front page", "./", { front: true, templates: false, canvas: false }, ".land-picture svg"],
    ["#/about", "./#/about", { front: true, templates: false, canvas: false }, ".land-picture svg"],
    ["the template list", "./#/templates", { front: false, templates: true, canvas: false }, ".template-row"],
    ["a template", "./#/templates/built-in/review-gate", { front: false, templates: true, canvas: true }, ".react-flow__node"],
    ["a template's Use form", "./#/templates/built-in/review-gate/use", { front: false, templates: true, canvas: true }, "form, .use-form, .field"],
    ["a share link's graph", linkFor(reviewLoop()), { front: false, templates: false, canvas: true }, ".react-flow__node"],
  ];
  for (const [what, address, wanted, shown] of cases) {
    await page.goto("about:blank");
    expect(await asked(page, address), what).toEqual(wanted);
    await expect(page.locator(shown).first(), what).toBeVisible();
    if (wanted.canvas && shown === ".react-flow__node") await canvasIsQuiet(page);
  }
});

test("the front page is drawn with its picture and its six tiles in it, as the code draws them, and does not wait for the templates", async ({ page }) => {
  // The templates are held back: the page must not need them, and must not ask before its first screen is up.
  let release: () => void = () => undefined;
  const held = new Promise<void>((done) => (release = done));
  const order: string[] = [];
  await page.route("**/assets/builtins-*.js", async (route) => {
    order.push("the templates were asked for");
    await held;
    await route.continue();
  });
  await page.goto("./");
  await expect(page.locator(".land-picture svg")).toBeVisible();
  order.push("the picture was there");
  // The picture: the review gate with its own examples in its slots, as the front page drew it when it drew it itself.
  const template = pattern("review-gate");
  const values = Object.fromEntries((template.template?.slots ?? []).map((slot) => [slot.key, slot.example ?? ""]).filter(([, v]) => v !== ""));
  values["task"] = "Add a slugify(text) function to src/strings.ts.";
  expect(await holds(page, ".land-picture", picture(instantiate(template, { name: "Add slugify, reviewed", values }), { theme: "auto" }))).toBe(true);
  // The tiles: each template's glyph and title, and a link to it.
  const ids = ["grind-loop", "spec-then-loop", "metric-sandwich", "heterogeneous-critic", "tournament-then-judge", "patrol-pulse"];
  const tiles = page.locator(".land-strip-list .land-tile");
  await expect(tiles).toHaveCount(ids.length);
  for (const [k, id] of ids.entries()) {
    const doc = pattern(id);
    await expect(tiles.nth(k).locator(".land-tile-title")).toHaveText(doc.template!.title);
    await expect(tiles.nth(k)).toHaveAttribute("href", `#/templates/built-in/${id}`);
    expect(await tiles.nth(k).locator(".glyph").evaluate((el, html) => {
      const read = document.createElement("div");
      read.innerHTML = html;
      return el.innerHTML === read.innerHTML;
    }, glyph(doc)), id).toBe(true);
  }
  // Asked for once the first screen is up, so the next screen finds them: after the picture, not before it.
  await expect.poll(() => order.includes("the templates were asked for")).toBe(true);
  // A tile pressed while they are still on their way: the screen says it is opening, then opens.
  await tiles.first().click();
  await expect(page.locator(".loading")).toHaveText("Opening…");
  release();
  await expect(page.locator(".react-flow__node").first()).toBeVisible();
  await expect(page.locator(".title-name")).toHaveText(pattern("grind-loop").template!.title);
  await canvasIsQuiet(page);
});

test("the template list holds every built-in template on a first visit, and a template opens from it and can be used", async ({ page }) => {
  await page.goto("./#/templates");
  await expect(page.locator(".template-row")).toHaveCount(patterns.length);
  expect(patterns.length).toBeGreaterThanOrEqual(20);
  await page.locator('.template-row[href="#/templates/built-in/review-gate"]').click();
  await expect(page.locator(".react-flow__node").first()).toBeVisible();
  await canvasIsQuiet(page);
  await page.getByRole("link", { name: "Use" }).click();
  await expect(page.getByRole("button", { name: "Create graph" })).toBeVisible();
  // A built-in template that is not there says so, as it did.
  await page.goto("./#/templates/built-in/no-such-template");
  await expect(page.locator(".notfound")).toContainText("This template is not on this device.");
});

test("with the templates not to be had, their screens say so and nothing else is held up; they are asked for again at the next screen", async ({ page }) => {
  let refused = true;
  await page.route("**/assets/builtins-*.js", (route) => (refused ? route.abort() : route.continue()));
  // The front page is whole, and a graph opens.
  await page.goto("./");
  await expect(page.locator(".land-picture svg")).toBeVisible();
  await expect(page.locator(".land-strip-list .land-tile")).toHaveCount(6);
  // The list cannot be drawn without them: said, with a way on.
  await page.goto("./#/templates");
  await expect(page.locator(".notfound")).toContainText("This screen could not be fetched. It needs a connection the first time.", { timeout: 15000 });
  await expect(page.getByRole("link", { name: "Back to the library" })).toBeVisible();
  // The editor's Insert panel lists what is on this device, and says what is missing.
  await importDocument(page, "review-loop.grooph.json", readFileSync(fixturePath, "utf8"));
  await expect(node(page, "builder")).toBeVisible();
  await canvasIsQuiet(page);
  await toolbar(page).getByRole("button", { name: "Add" }).tap();
  await sheet(page).getByRole("button", { name: /^Insert a template/ }).tap();
  await expect(sheet(page)).toContainText("The built-in templates could not be fetched.", { timeout: 15000 });
  await expect(sheet(page).locator(".insert-list li")).toHaveCount(0);
  // The connection is back: the next screen asks again, and has them.
  refused = false;
  await page.goto("./#/templates");
  await expect(page.locator(".template-row")).toHaveCount(patterns.length, { timeout: 15000 });
});

test("with the front page's own picture not to be had, the page stands without it and its tiles, and everything else on it works", async ({ page }) => {
  await page.route("**/assets/front-*.js", (route) => route.abort());
  await page.goto("./");
  await expect(page.locator(".land-headline")).toBeVisible();
  await expect(page.locator(".land-picture")).toBeVisible();
  await expect(page.locator(".land-picture svg")).toHaveCount(0);
  await expect(page.locator(".land-strip-list .land-tile")).toHaveCount(0);
  // The way to the template the picture is of does not wait for the picture.
  await page.getByRole("link", { name: "Open the template" }).click();
  await expect(page.locator(".react-flow__node").first()).toBeVisible();
  await canvasIsQuiet(page);
});

test("reached from a graph, the front page has its picture: the piece was fetched once the graph's screen was up", async ({ page }) => {
  const fetched: string[] = [];
  page.on("requestfinished", (request) => (/\/assets\/front-[\w-]+\.js$/.test(new URL(request.url()).pathname) ? fetched.push(request.url()) : undefined));
  await page.goto(linkFor(reviewLoop()));
  await expect(node(page, "builder")).toBeVisible();
  await canvasIsQuiet(page);
  await expect.poll(() => fetched.length).toBe(1);
  await page.evaluate(() => (location.hash = "#/about"));
  await expect(page.locator(".land-picture svg")).toBeVisible();
  await expect(page.locator(".land-strip-list .land-tile")).toHaveCount(6);
  expect(fetched).toHaveLength(1);
});

test.describe("with the service worker running", () => {
  test.use({ serviceWorkers: "allow" });

  test("a first visit to the front page leaves the templates and the page's picture with the worker: both open with no network", async ({ page, context }) => {
    await page.goto("./");
    await expect(page.locator(".land-picture svg")).toBeVisible();
    await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
    for (const piece of ["builtins", "front", "screens"]) {
      await expect.poll(() => page.evaluate(async (name) => (await (await caches.open("grooph-app-v1")).keys()).filter((r) => new RegExp(`/assets/${name}-[^/]*\\.js$`).test(r.url)).length, piece), piece).toBe(1);
    }
    await context.setOffline(true);
    const failed: string[] = [];
    page.on("requestfailed", (r) => failed.push(r.url()));
    await page.goto("./#/templates");
    await expect(page.locator(".template-row")).toHaveCount(patterns.length);
    await page.goto("./#/templates/built-in/metric-sandwich");
    await expect(page.locator(".react-flow__node").first()).toBeVisible();
    await canvasIsQuiet(page);
    await page.goto("./#/about");
    await page.reload();
    await expect(page.locator(".land-picture svg")).toBeVisible();
    await expect(page.locator(".land-strip-list .land-tile")).toHaveCount(6);
    // The poster of the twenty shapes is a file of the documents, which the worker does not keep: the front page
    // stands without it when there is no network, as it always has.
    expect(failed.filter((url) => !url.includes("/docs/"))).toEqual([]);
  });
});
