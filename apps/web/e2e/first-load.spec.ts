import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { glyph, instantiate, parseGraphText, picture, type Graph } from "@grooph/core";
import { expect, test, type Page } from "@playwright/test";

import { canvasIsQuiet, fixturePath, importDocument, linkFor, node, repoRoot, reviewLoop, sheet, toolbar } from "./support.js";

/**
 * Slice 0093: weight out of the first load. The twenty built-in templates were part of every address's first load
 * (23 KB compressed), to draw one picture and six glyphs on the front page. They are a piece of the app the
 * template screens fetch now, and the front page's picture and tiles are drawn ahead of time and carried in a
 * piece only the front page's address asks for. No settled screen is to have changed: these hold what each address
 * asks for, that each screen still shows what it showed, and what is said in the moment before a piece has come
 * and when it cannot be had.
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
    // One of a person's own templates does not need the built-in ones: here there is none, and that is said.
    ["a template of the person's own", "./#/templates/yours/mine", { front: false, templates: false, canvas: true }, ".notfound"],
    // An address that is no screen's is the library's, which is the front page on an empty device: it asks for the
    // front page's picture as `#/` does, and is not a round behind it.
    ["an address that is no screen's", "./#/nope", { front: true, templates: false, canvas: false }, ".land-picture svg"],
    ["#/about with a tail", "./#/about?x", { front: true, templates: false, canvas: false }, ".land-picture svg"],
    ["a run's address without its key", "./#/run", { front: true, templates: false, canvas: true }, ".land-picture svg"],
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
  let askedFor = 0;
  await page.route("**/assets/builtins-*.js", async (route) => {
    askedFor += 1;
    await held;
    await route.continue();
  });
  await page.goto("./");
  await expect(page.locator(".land-picture svg")).toBeVisible();
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
  // Asked for once the first screen is up, so the next screen finds them.
  await expect.poll(() => askedFor).toBe(1);
  // A tile pressed while they are still on their way: the screen says it is opening, then opens.
  await tiles.first().click();
  await expect(page.locator(".loading")).toHaveText("Opening…");
  release();
  await expect(page.locator(".react-flow__node").first()).toBeVisible();
  await expect(page.locator(".title-name")).toHaveText(pattern("grind-loop").template!.title);
  await canvasIsQuiet(page);
  // Not in the round the page's own files came in: the request began after everything the first screen needs had
  // arrived, the app and the page's picture, by the page's own clock. So it took nothing from them on the way.
  const times = await page.evaluate(() => {
    const entries = performance.getEntriesByType("resource") as PerformanceResourceTiming[];
    const of = (name: string): PerformanceResourceTiming | undefined => entries.find((entry) => new RegExp(`/assets/${name}-[\\w-]+\\.js$`).test(new URL(entry.name).pathname));
    return { app: of("App")?.responseEnd, front: of("front")?.responseEnd, templates: of("builtins")?.startTime };
  });
  expect(times.app).toBeGreaterThan(0);
  expect(times.front).toBeGreaterThan(0);
  expect(times.templates).toBeGreaterThanOrEqual(Math.max(times.app!, times.front!));
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
  await expect(page.locator(".land-headline")).toBeVisible({ timeout: 15000 });
  // No empty box with a picture's name on it, no caption for a picture that is not there, no empty list.
  await expect(page.locator(".land-picture")).toHaveCount(0);
  await expect(page.locator(".land-figure")).toHaveCount(0);
  await expect(page.getByText("drawn by grooph")).toHaveCount(0);
  await expect(page.locator(".land-strip-list")).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Loop shapes" })).toBeVisible();
  // The way to the template the picture is of does not wait for the picture.
  await page.getByRole("link", { name: "Open the template" }).click();
  await expect(page.locator(".react-flow__node").first()).toBeVisible();
  await canvasIsQuiet(page);
});

test("reached from another screen before its picture has come, the front page says it is opening and is never drawn in part", async ({ page }) => {
  let release: () => void = () => undefined;
  const held = new Promise<void>((done) => (release = done));
  await page.route("**/assets/front-*.js", async (route) => {
    await held;
    await route.continue();
  });
  // Every state the root is in from here on, noted by the page: a front page without its picture must not be one.
  await page.addInitScript(() => {
    const seen: string[] = [];
    (window as unknown as { seen: string[] }).seen = seen;
    const look = (): void => {
      const state = document.querySelector(".land") ? (document.querySelector(".land-picture svg") ? "the front page, whole" : "the front page, in part") : document.querySelector(".loading") ? "opening" : "another screen";
      if (seen[seen.length - 1] !== state) seen.push(state);
    };
    new MutationObserver(look).observe(document, { childList: true, subtree: true });
  });
  await page.goto("./#/templates");
  await expect(page.locator(".template-row").first()).toBeVisible();
  await page.evaluate(() => (location.hash = "#/about"));
  await expect(page.locator(".loading")).toHaveText("Opening…");
  release();
  await expect(page.locator(".land-picture svg")).toBeVisible();
  await expect(page.locator(".land-strip-list .land-tile")).toHaveCount(6);
  expect(await page.evaluate(() => (window as unknown as { seen: string[] }).seen)).toEqual(["another screen", "opening", "the front page, whole"]);
});

test("a proposal set may say a candidate is based on any word: one every object answers to draws like any other, with no credit", async ({ page }) => {
  // The compare view looks the word up in the built-in templates' credits. `constructor` blanked the screen.
  const failures: string[] = [];
  page.on("pageerror", (error) => failures.push(error.message));
  const dir = join(repoRoot, "fixtures/proposals/valid/csv-export");
  const set = JSON.parse(readFileSync(join(dir, "csv-export.grooph-proposals.json"), "utf8")) as { candidates: { graph: unknown; basedOn?: string }[] };
  for (const c of set.candidates) if (c.graph && typeof (c.graph as { file?: string }).file === "string") c.graph = JSON.parse(readFileSync(join(dir, (c.graph as { file: string }).file), "utf8"));
  const based = ["constructor", "gauntlet-decomposed", "__proto__"];
  set.candidates.forEach((c, k) => (c.basedOn = based[k]!));
  await page.goto(linkFor(set as never));
  const cards = page.locator(".ccard");
  await expect(cards).toHaveCount(3);
  await expect(cards.nth(0)).toContainText("from the constructor template");
  await expect(cards.nth(0).locator(".credits")).toHaveCount(0);
  // The one that is a template, and credits someone, says whom.
  await expect(cards.nth(1).locator(".credits")).toContainText("Matt Shumer");
  await expect(cards.nth(2).locator(".credits")).toHaveCount(0);
  expect(failures).toEqual([]);
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
    // Each address loaded afresh, so nothing is found in a page that had it already: the worker hands every file.
    await page.goto("./#/templates");
    await page.reload();
    await expect(page.locator(".template-row")).toHaveCount(patterns.length);
    await page.goto("./#/templates/built-in/metric-sandwich");
    await page.reload();
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
