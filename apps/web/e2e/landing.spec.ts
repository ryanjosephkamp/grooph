import { readFileSync } from "node:fs";
import { join } from "node:path";
import { gzipSync } from "node:zlib";

import { expect, test, type Page } from "@playwright/test";

import { fixturePath, importDocument, repoRoot, requestsOut, visitIsOver } from "./support.js";

/**
 * Handoff 0055: the front door. On an empty device `#/` is the front page; with
 * graphs it is the library, which links to the same page at `#/about`. On a
 * desktop the front page and the templates use the width.
 *
 * Handoff 0077: the page in the owner's style. A night header with the mark, the
 * menu and the theme switch, his footer, and fonts that are files of the site.
 */

const ASK = "/grooph-design a builder and a critic that loop until the checkout tests pass, and ask me before merging";

/** The page's top-level blocks, top to bottom, as the handoff orders them. */
async function blockOrder(page: Page): Promise<string[]> {
  const blocks = {
    headline: page.locator(".land-headline"),
    graph: page.locator(".land-picture svg.grooph-picture"),
    claims: page.getByRole("list", { name: "What grooph does" }),
    start: page.getByRole("heading", { name: "Two ways to start" }),
    templates: page.getByRole("list", { name: "Templates" }),
    honest: page.getByRole("heading", { name: "What is shown, and what is not" }),
    footer: page.locator(".land-foot"),
  };
  const ys: [string, number][] = [];
  for (const [name, locator] of Object.entries(blocks)) ys.push([name, (await locator.boundingBox())!.y]);
  return ys.sort((a, b) => a[1] - b[1]).map(([name]) => name);
}

/** Interactive elements with no accessible name: a label, aria-label, aria-labelledby, or text. */
async function unnamedControls(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const out: string[] = [];
    for (const el of Array.from(document.querySelectorAll<HTMLElement>("a[href], button, input, select, textarea, [role=button], [role=link]"))) {
      const labeled = el.getAttribute("aria-labeledby");
      const named =
        (el.getAttribute("aria-label") ?? "").trim() !== "" ||
        (labeled !== null && labeled.split(/\s+/).some((id) => (document.getElementById(id)?.textContent ?? "").trim() !== "")) ||
        (el.textContent ?? "").trim() !== "" ||
        (el instanceof HTMLInputElement && (el.labels?.length ?? 0) > 0 && Array.from(el.labels!).some((l) => (l.textContent ?? "").trim() !== "")) ||
        (el.getAttribute("title") ?? "").trim() !== "";
      if (!named) out.push(el.outerHTML.slice(0, 120));
    }
    return out;
  });
}

const sidewaysScroll = (page: Page): Promise<number> => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

test("an empty device opens on the front page, in the order the handoff gives", async ({ page }) => {
  await page.goto("./");
  // The headline is the page's heading, in two lines; the name is the mark's link in the header.
  await expect(page.getByRole("heading", { name: "Loop graphs for coding agents.", level: 1 })).toBeVisible();
  await expect(page.locator(".land-headline")).toHaveText("Loop graphs for coding agents.");
  await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
  await expect(page.locator(".site-header").getByRole("link", { name: "grooph", exact: true })).toBeVisible();

  // A real graph, drawn by core's picture from the review gate, its slots filled.
  const svg = page.locator(".land-picture svg.grooph-picture");
  await expect(svg).toBeVisible();
  await expect(svg.locator("title")).toHaveText("Add slugify, reviewed");
  expect(await svg.locator("[data-node]").count()).toBe(4);
  expect(await svg.innerHTML()).not.toContain("{{");

  await expect(page.getByRole("list", { name: "What grooph does" }).getByRole("listitem")).toHaveCount(3);
  await expect(page.getByRole("button", { name: "Copy the line for Claude Code" })).toBeVisible();
  await expect(page.getByText(ASK)).toBeVisible();
  await expect(page.getByRole("link", { name: "Open the review gate" })).toHaveAttribute("href", "#/templates/built-in/review-gate");

  const tiles = page.getByRole("list", { name: "Templates" }).getByRole("link");
  await expect(tiles).toHaveCount(6);
  for (const tile of await tiles.all()) await expect(tile.locator(".glyph svg")).toBeVisible();

  await expect(page.locator(".land-foot").getByRole("link", { name: "Source" })).toHaveAttribute("href", "https://github.com/ryanjosephkamp/grooph");
  // Handoff 0060: "Docs" opens the documents as pages on the site, not files on GitHub; "GitHub" still goes to the repository.
  // At this width the header's links are under Menu (handoff 0077).
  await page.getByRole("button", { name: "Menu" }).tap();
  const docs = page.locator(".land-nav").getByRole("link", { name: "Docs" });
  await expect(docs).toHaveAttribute("href", "/grooph/docs/");
  expect(await docs.evaluate((a: HTMLAnchorElement) => a.href)).toBe(new URL("docs/", page.url()).href);
  await expect(page.locator(".land-nav").getByRole("link", { name: "GitHub" })).toHaveAttribute("href", "https://github.com/ryanjosephkamp/grooph");

  expect(await blockOrder(page)).toEqual(["headline", "graph", "claims", "start", "templates", "honest", "footer"]);

  // The library's own controls are here too, and the empty line it always had.
  await expect(page.getByText("No graphs on this device yet.")).toBeVisible();
  await expect(page.getByRole("button", { name: "New graph" })).toBeVisible();
  await expect(page.locator('input[type="file"]')).toHaveCount(1);
});

test("the claims are decision 0013's and no more", async ({ page }) => {
  await page.goto("./");
  const honest = page.locator(".land-honest");
  await expect(honest).toContainText("grooph is shown to bound and record autonomous work and to hold a design as a runtime contract.");
  await expect(honest).toContainText("It is not shown to raise quality over the same instructions given as a prompt, on small tasks.");
  const text = (await page.locator(".land").innerText()).toLowerCase();
  for (const overclaim of ["better results", "smarter", "higher quality", "best", "10x", "faster agents"]) expect(text, overclaim).not.toContain(overclaim);
});

test("Copy puts the line for Claude Code on the clipboard and says so", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto("./");
  await page.getByRole("button", { name: "Copy the line for Claude Code" }).tap();
  await expect(page.locator(".copy-line").getByRole("status")).toHaveText("Copied. Paste it into Claude Code.");
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(ASK);
});

test("a template opens in one tap from the front page, and a tile opens its own", async ({ page }) => {
  await page.goto("./");
  await page.getByRole("link", { name: "Open the template" }).tap();
  await expect(page).toHaveURL(/#\/templates\/built-in\/review-gate$/);
  await expect(page.getByRole("link", { name: "Use this template" })).toBeVisible();
  await page.goBack();
  await page.getByRole("list", { name: "Templates" }).getByRole("link", { name: "Grind loop" }).tap();
  await expect(page).toHaveURL(/#\/templates\/built-in\/grind-loop$/);
});

test("with a graph on the device, #/ is the library, which links to the same page at #/about", async ({ page }) => {
  await importDocument(page, "review-loop.grooph.json", readFileSync(fixturePath, "utf8"));
  await page.goto("./");
  await expect(page.getByRole("list", { name: "Graphs on this device" })).toBeVisible();
  await expect(page.locator(".land")).toHaveCount(0);
  await page.getByRole("link", { name: "What is grooph?" }).tap();
  await expect(page).toHaveURL(/#\/about$/);
  await expect(page.locator(".land-headline")).toBeVisible();
  await expect(page.locator(".land-picture svg")).toBeVisible();
  // No second copy of the library's controls on the about page: one way back to them.
  await expect(page.locator('input[type="file"]')).toHaveCount(0);
  await page.getByRole("link", { name: "Your graphs" }).tap();
  await expect(page.getByRole("list", { name: "Graphs on this device" })).toBeVisible();
});

test("a file imported from the front page goes where it did from the library", async ({ page }) => {
  await page.goto("./");
  await page.locator('input[type="file"]').setInputFiles({ name: "notes.json", mimeType: "application/json", buffer: Buffer.from("{ not json") });
  await expect(page.getByRole("alert")).toContainText("Could not import notes.json.");
  await expect(page.getByRole("alert")).toBeInViewport();
  await page.locator('input[type="file"]').setInputFiles({ name: "review-loop.grooph.json", mimeType: "application/json", buffer: Buffer.from(readFileSync(fixturePath, "utf8")) });
  await expect(page.getByRole("button", { name: /^Validation:/ })).toBeVisible();
});

test("every control has a name and nothing scrolls sideways at 400 px", async ({ page }) => {
  for (const hash of ["./", "./#/about", "./#/templates"]) {
    await page.goto(hash);
    await expect(page.locator(".land, .templates").first()).toBeVisible();
    expect(await unnamedControls(page), hash).toEqual([]);
    expect(await sidewaysScroll(page), hash).toBeLessThanOrEqual(0);
  }
});

test("motion stops when the device asks for less", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("./");
  const tile = page.locator(".land-tile").first();
  await expect(tile).toBeVisible();
  expect(await tile.evaluate((el) => getComputedStyle(el).transitionDuration)).toBe("0s");
  await page.goto("./#/templates");
  expect(await page.locator(".template-row").first().evaluate((el) => getComputedStyle(el).transitionDuration)).toBe("0s");
});

test("the first load is at most 300 KB compressed, and the fonts are inside their own budget", async ({ page }) => {
  const bodies: Promise<number>[] = [];
  const fonts: Promise<number>[] = [];
  page.on("response", (response) => {
    if (response.url().startsWith("data:")) return;
    // Handoff 0077: the fonts have a line of their own in scripts/perf-budget.json, as they are sent (woff2 is compressed already).
    if (response.url().endsWith(".woff2")) fonts.push(response.body().then((body) => body.length, () => 0));
    else bodies.push(response.body().then((body) => gzipSync(body).length, () => 0));
  });
  await page.goto("./");
  await expect(page.locator(".land-picture svg")).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  const total = (await Promise.all(bodies)).reduce((a, b) => a + b, 0);
  expect(total).toBeLessThanOrEqual(300 * 1024);
  const budget = JSON.parse(readFileSync(join(repoRoot, "scripts/perf-budget.json"), "utf8")) as { fontsKB: number };
  const sent = (await Promise.all(fonts)).reduce((a, b) => a + b, 0);
  expect(sent).toBeGreaterThan(0);
  expect(sent).toBeLessThanOrEqual(budget.fontsKB * 1024);
});

test("the page carries a title, a description and link-preview tags with a 1200 × 630 image", async ({ page, request, baseURL }) => {
  await page.goto("./");
  await expect(page).toHaveTitle(/grooph/);
  const meta = (key: string) => page.locator(`meta[name="${key}"], meta[property="${key}"]`).first().getAttribute("content");
  expect(await meta("description")).toMatch(/loop graph/i);
  for (const key of ["og:title", "og:description", "og:url", "twitter:card", "twitter:title", "twitter:description"]) expect(await meta(key), key).toBeTruthy();
  const image = (await meta("og:image"))!;
  expect(image).toBe("https://ryanjosephkamp.github.io/grooph/og.png");
  expect(await meta("twitter:image")).toBe(image);
  const local = await request.get(new URL("og.png", baseURL).href);
  expect(local.status()).toBe(200);
  const png = await local.body();
  expect([png.readUInt32BE(16), png.readUInt32BE(20)]).toEqual([1200, 630]);
});

test.describe("at desktop width", () => {
  test.use({ viewport: { width: 1440, height: 900 }, isMobile: false, hasTouch: false, deviceScaleFactor: 1 });

  test("the front page uses the width: about 1,180 px, the graph beside the words", async ({ page }) => {
    await page.goto("./");
    // Bands the width of the window, each with a column of Link Meteor's width inside.
    const land = (await page.locator(".land-hero .site-wrap").boundingBox())!;
    expect(land.width).toBeGreaterThan(1140);
    expect(land.width).toBeLessThanOrEqual(1180);
    expect((await page.locator(".land-hero").boundingBox())!.width).toBe(1440);
    const text = (await page.locator(".land-hero-text").boundingBox())!;
    const figure = (await page.locator(".land-figure").boundingBox())!;
    expect(figure.x).toBeGreaterThan(text.x + text.width);
    // The three claims and the two ways to start stand side by side.
    const claims = await page.getByRole("list", { name: "What grooph does" }).getByRole("listitem").all();
    const tops = await Promise.all(claims.map(async (c) => (await c.boundingBox())!.y));
    expect(new Set(tops).size).toBe(1);
    expect(await sidewaysScroll(page)).toBeLessThanOrEqual(0);
  });

  test("the templates use the width, in rows of even height", async ({ page }) => {
    await page.goto("./#/templates");
    const list = page.getByRole("list", { name: "Built-in templates" });
    const width = (await list.boundingBox())!.width;
    expect(width).toBeGreaterThan(1000);
    const boxes = await Promise.all((await list.locator(".template-row").all()).map(async (row) => (await row.boundingBox())!));
    const rows = new Map<number, number[]>();
    for (const box of boxes) rows.set(Math.round(box.y), [...(rows.get(Math.round(box.y)) ?? []), Math.round(box.height)]);
    expect(rows.size).toBe(Math.ceil(boxes.length / 3));
    for (const [y, heights] of rows) expect(new Set(heights).size, `row at ${y}`).toBe(1);
  });

  test("the library with graphs uses the width too, and links to the front page", async ({ page }) => {
    await importDocument(page, "review-loop.grooph.json", readFileSync(fixturePath, "utf8"));
    await page.goto("./");
    expect((await page.locator(".library").boundingBox())!.width).toBeGreaterThan(1080);
    await expect(page.getByRole("link", { name: "What is grooph?" })).toBeVisible();
  });
});

/** Handoff 0077, criterion 1: the owner's footer, exactly. */
const OWNER = [
  ["Ryan Kamp’s website", "https://ryanjosephkamp.github.io/"],
  ["Ryan Kamp on GitHub", "https://github.com/ryanjosephkamp/"],
  ["Ryan Kamp on LinkedIn", "https://www.linkedin.com/in/rjk1999"],
  ["Ryan Kamp on X", "https://x.com/ryanjosephkamp"],
  ["Ryan Kamp on YouTube", "https://m.youtube.com/@RyanJosephKamp"],
] as const;

test("the footer is the owner's: who made it, his five links in his order, the sponsor button, the small print", async ({ page }) => {
  await page.goto("./");
  const foot = page.locator("footer.site-footer");
  await expect(foot.getByRole("link", { name: "Ryan Kamp", exact: true })).toHaveAttribute("href", "https://ryanjosephkamp.github.io/");
  await expect(foot.locator(".site-made")).toHaveText("Made by Ryan Kamp");
  const social = foot.getByRole("list", { name: "Ryan Kamp online" }).getByRole("link");
  await expect(social).toHaveCount(5);
  expect(await social.evaluateAll((links) => links.map((a) => [a.getAttribute("aria-label"), a.getAttribute("href")]))).toEqual(OWNER.map((pair) => [...pair]));
  for (const [name] of OWNER) await expect(foot.getByRole("link", { name, exact: true })).toBeVisible();
  await expect(foot.getByRole("link", { name: "Sponsor on GitHub" })).toHaveAttribute("href", "https://github.com/sponsors/ryanjosephkamp");
  const fine = foot.locator(".site-fine");
  await expect(fine).toContainText("Every feature is free; sponsorship is optional and never unlocks anything.");
  await expect(fine).toContainText("MIT license, © 2026 Ryan Kamp.");
  await expect(fine).toContainText("This site uses no cookies, analytics or third-party requests.");
  await expect(fine).toContainText("Fonts: Atkinson Hyperlegible Next and Mono, SIL Open Font License.");
  await expect(fine.getByRole("link", { name: "Credits" })).toHaveAttribute("href", "https://github.com/ryanjosephkamp/grooph#license-and-author");
  // The columns above it, with grooph's own links.
  await expect(foot.getByRole("heading", { name: "Use it" })).toBeVisible();
  await expect(foot.getByRole("heading", { name: "Help and contact" })).toBeVisible();
  await expect(foot.getByRole("link", { name: "Report a bug or suggest a feature" })).toHaveAttribute("href", "https://github.com/ryanjosephkamp/grooph/issues");
  await expect(foot.getByRole("link", { name: "Quickstart" })).toHaveAttribute("href", "/grooph/docs/quickstart/");
  // Each of the five is a target a thumb can hit.
  for (const link of await social.all()) {
    const box = (await link.boundingBox())!;
    expect(Math.min(box.width, box.height)).toBeGreaterThanOrEqual(44);
  }
});

test("the header folds its links under Menu on a phone, and the theme switch changes the look and keeps it", async ({ page }) => {
  await page.goto("./");
  const header = page.locator("header.site-header");
  const docs = header.getByRole("link", { name: "Docs" });
  const menu = header.getByRole("button", { name: "Menu" });
  await expect(docs).toBeHidden();
  await expect(menu).toHaveAttribute("aria-expanded", "false");
  await menu.tap();
  await expect(menu).toHaveAttribute("aria-expanded", "true");
  await expect(docs).toBeVisible();
  await expect(header.getByRole("link", { name: "Templates" })).toHaveAttribute("href", "#/templates");
  // Escape folds them away, and focus goes back to the button, not to nowhere.
  await docs.focus();
  await page.keyboard.press("Escape");
  await expect(docs).toBeHidden();
  await expect(menu).toBeFocused();

  // The theme switch: a menu button whose choice is the root's data-theme, kept in this browser.
  const accent = () => page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--bright").trim());
  const green = await accent();
  const theme = header.getByRole("button", { name: "Theme: Grooph" });
  await theme.tap();
  const choices = header.getByRole("menuitemradio");
  await expect(choices).toHaveCount(2);
  await expect(header.getByRole("menuitemradio", { name: "Grooph" })).toHaveAttribute("aria-checked", "true");
  await header.getByRole("menuitemradio", { name: "Meteor" }).tap();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "meteor");
  await expect(header.getByRole("button", { name: "Theme: Meteor" })).toBeFocused();
  await expect(header.getByRole("menu")).toBeHidden();
  expect(await accent()).not.toBe(green);
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "meteor");
  // The app's own screens take the look too: one set of variables for the site and the app.
  await page.goto("./#/templates");
  await expect(page.locator(".template-row").first()).toBeVisible();
  const meteor = await page.evaluate(() => {
    const root = getComputedStyle(document.documentElement);
    return { accent: root.getPropertyValue("--accent").trim(), bg: root.getPropertyValue("--bg").trim() };
  });
  expect(meteor.accent).not.toBe("#1f5f4a");
  // An embed is someone else's page: its address takes no theme, kept or not.
  await page.goto("./#/embed");
  await page.reload();
  await expect(page.locator("html")).not.toHaveAttribute("data-theme", /.+/);
  await page.goto("./");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "meteor");
  // The same choice on a document page is not this test's: e2e/site-pages.spec.ts renders them. Back to the page as it loads.
  await header.getByRole("button", { name: "Theme: Meteor" }).tap();
  await page.keyboard.press("ArrowUp");
  await page.keyboard.press("Enter");
  await expect(page.locator("html")).not.toHaveAttribute("data-theme", /.+/);
  expect(await accent()).toBe(green);
  // ?theme= wins, and an embed's address takes no theme.
  await page.goto("./?theme=meteor");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "meteor");
});

test("the fonts are files of the site, and the front page asks no other origin for anything", async ({ page, baseURL }) => {
  const asked: string[] = [];
  page.on("request", (request) => asked.push(request.url()));
  await page.goto("./");
  await expect(page.locator(".land-headline")).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  const faces = await page.evaluate(() => Array.from(document.fonts, (f) => ({ family: f.family.replace(/"/g, ""), status: f.status, display: f.display })));
  expect(faces.filter((f) => f.status === "loaded").map((f) => f.family).sort()).toEqual(["Atkinson Hyperlegible Mono", "Atkinson Hyperlegible Next"]);
  for (const face of faces) expect(face.display, face.family).toBe("swap");
  expect(await page.locator(".land-headline").evaluate((el) => getComputedStyle(el).fontFamily)).toMatch(/^"?Atkinson Hyperlegible Next/);
  expect(await page.locator(".copy-line-text").evaluate((el) => getComputedStyle(el).fontFamily)).toMatch(/^"?Atkinson Hyperlegible Mono/);
  const fonts = asked.filter((url) => url.endsWith(".woff2")).map((url) => new URL(url).pathname);
  expect(fonts.sort()).toEqual(["/grooph/assets/fonts/atkinson-hyperlegible-mono.v1.woff2", "/grooph/assets/fonts/atkinson-hyperlegible-next.v1.woff2"]);
  // Nothing from anywhere else: no font service, no analytics, no picture from another host.
  const origin = new URL(baseURL!).origin;
  expect(asked.filter((url) => !url.startsWith("data:") && new URL(url).origin !== origin)).toEqual([]);
  // The licenses are beside the fonts.
  for (const name of ["OFL-atkinson-hyperlegible-next.txt", "OFL-atkinson-hyperlegible-mono.txt"]) {
    const license = await page.request.get(`assets/fonts/${name}`);
    expect(license.status(), name).toBe(200);
    expect(await license.text()).toContain("SIL OPEN FONT LICENSE Version 1.1");
  }
  // The app's own screens take the same fonts: the site and the app are one thing.
  await page.goto("./#/templates");
  await expect(page.locator(".template-row").first()).toBeVisible();
  expect(await page.evaluate(() => getComputedStyle(document.body).fontFamily)).toMatch(/^"?Atkinson Hyperlegible Next/);
});

test.describe("with the app installed (its service worker in control)", () => {
  test.use({ serviceWorkers: "allow" });

  test("a first visit keeps the fonts and the footer's icons, so the front page looks the same with no network", async ({ page, context }) => {
    const out = requestsOut(page);
    await page.goto("./");
    await expect(page.locator(".land-headline")).toBeVisible();
    // The visit is over before the network goes: every file the page names is held, whole (`visitIsOver`).
    await visitIsOver(page, out);
    const held = () => page.evaluate(async () => (await (await caches.open("grooph-app-v1")).keys()).map((r) => new URL(r.url).pathname.replace("/grooph/", "")));
    // The page names them, so the worker holds them when it installs, whether or not the page had finished fetching them
    // by then; the italic face too, which the front page never asks for and a document or a graph's notes may.
    const kept = ["assets/fonts/atkinson-hyperlegible-next.v1.woff2", "assets/fonts/atkinson-hyperlegible-next-italic.v1.woff2", "assets/fonts/atkinson-hyperlegible-mono.v1.woff2", "assets/site-icons.v1.svg"];
    await expect
      .poll(async () => {
        const files = await held();
        return kept.filter((file) => !files.includes(file));
      })
      .toEqual([]);

    await context.setOffline(true);
    const failed: string[] = [];
    page.on("requestfailed", (r) => failed.push(r.url()));
    await page.goto("./");
    await expect(page.locator(".land-headline")).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    expect(await page.evaluate(() => Array.from(document.fonts).filter((f) => f.status === "loaded").map((f) => f.family.replace(/"/g, "")).sort())).toEqual(["Atkinson Hyperlegible Mono", "Atkinson Hyperlegible Next"]);
    // The poster is a file of the documents, which the app's worker leaves alone: its card stands without the picture,
    // and no picture on the page is a broken one. Nothing of the app's own failed.
    await page.locator(".land-poster").scrollIntoViewIfNeeded();
    await expect(page.locator(".land-poster img")).toHaveCount(0);
    expect(await page.evaluate(() => Array.from(document.images).filter((img) => img.complete && img.naturalWidth === 0).length)).toBe(0);
    expect(failed.filter((url) => !url.includes("/docs/"))).toEqual([]);
    await context.setOffline(false);
  });
});

/** The poster is a file of the documents, which this suite's build may or may not have rendered yet: each test says what the address answers. */
const POSTER_ADDRESS = "**/docs/field-guide/poster.svg";

test("the poster of the shapes is a picture that opens it", async ({ page }) => {
  await page.route(POSTER_ADDRESS, (route) => route.fulfill({ contentType: "image/svg+xml", body: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 1778"><rect width="1200" height="1778" fill="#f1f4f3"/></svg>' }));
  await page.goto("./");
  const poster = page.locator(".land-poster");
  const picture = poster.getByRole("link", { name: "Open the poster of the twenty loop shapes" });
  await expect(picture).toHaveAttribute("href", "/grooph/docs/field-guide/poster.svg");
  await expect(picture.locator("img")).toHaveAttribute("src", "/grooph/docs/field-guide/poster.svg");
  await expect(picture.locator("img")).toHaveAttribute("loading", "lazy");
  await expect(picture.locator("img")).toHaveAttribute("alt", /twenty loop shapes/);
  await poster.scrollIntoViewIfNeeded();
  await expect.poll(() => picture.locator("img").evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0);
  await expect(poster.getByRole("link", { name: "a poster of the shapes" })).toHaveAttribute("href", "/grooph/docs/field-guide/poster.svg");
});

test("when the poster cannot be fetched, its card stands without a picture and keeps its links", async ({ page }) => {
  // With no network the documents' files are not there: the app's worker keeps the app, not the pages beside it.
  await page.route(POSTER_ADDRESS, (route) => route.abort());
  await page.goto("./");
  const poster = page.locator(".land-poster");
  await poster.scrollIntoViewIfNeeded();
  await expect(poster.locator("img")).toHaveCount(0);
  await expect(poster.getByRole("heading", { name: "Twenty shapes on one page" })).toBeVisible();
  await expect(poster.getByRole("link", { name: "the field guide" })).toBeVisible();
  await expect(poster.getByRole("link", { name: "a poster of the shapes" })).toBeVisible();
});

/**
 * Criterion 7: the screenshots, made only on request, into the slice folder:
 *
 *   GROOPH_SHOTS=1 pnpm --filter @grooph/web exec playwright test e2e/landing.spec.ts -g screenshots
 */
test.describe("screenshots", () => {
  test.skip(!process.env["GROOPH_SHOTS"], "screenshots are made on request (GROOPH_SHOTS=1)");
  const dir = join(repoRoot, "handoffs/0055-front-door/shots");
  const sizes = { phone: { width: 400, height: 800 }, desktop: { width: 1440, height: 900 } } as const;
  for (const [size, viewport] of Object.entries(sizes)) {
    for (const scheme of ["light", "dark"] as const) {
      test.describe(`${size}, ${scheme}`, () => {
        test.use({ viewport, colorScheme: scheme, ...(size === "desktop" ? { isMobile: false, hasTouch: false, deviceScaleFactor: 1 } : {}) });
        test(`${size} ${scheme}`, async ({ page }) => {
          await page.goto("./");
          await expect(page.locator(".land-picture svg")).toBeVisible();
          await page.screenshot({ path: join(dir, `front-${size}-${scheme}.png`) });
          await page.screenshot({ path: join(dir, `front-${size}-${scheme}-full.png`), fullPage: true });
          await page.goto("./#/templates");
          await expect(page.locator(".template-row").first()).toBeVisible();
          await page.waitForTimeout(200);
          await page.screenshot({ path: join(dir, `templates-${size}-${scheme}.png`) });
          await page.goto("./#/templates/built-in/review-gate");
          await expect(page.locator(".react-flow__node").first()).toBeVisible();
          await page.waitForTimeout(500);
          await page.screenshot({ path: join(dir, `template-${size}-${scheme}.png`) });
        });
      });
    }
  }
});

/**
 * Criterion 5: the link-preview image, 1200 × 630, made only on request from
 * the same picture the front page draws (light, so it reads on any feed):
 *
 *   GROOPH_OG=1 pnpm --filter @grooph/web exec playwright test e2e/landing.spec.ts -g "preview image"
 */
test.describe("link-preview image", () => {
  test.skip(!process.env["GROOPH_OG"], "the image is made on request (GROOPH_OG=1)");
  test.use({ viewport: { width: 1200, height: 630 }, isMobile: false, hasTouch: false, deviceScaleFactor: 1, colorScheme: "light" });

  test("preview image", async ({ page }) => {
    await page.goto("./");
    const svg = await page.locator(".land-picture").innerHTML();
    // Since handoff 0077 the card is the front page's hero in small: the night, the mark, the two-line headline, the site's own font.
    await page.setContent(`<!doctype html><html><head><style>
      @font-face { font-family: "Atkinson Hyperlegible Next"; src: url("/grooph/assets/fonts/atkinson-hyperlegible-next.v1.woff2") format("woff2"); font-weight: 400 800; }
      * { box-sizing: border-box; }
      body { position: relative; margin: 0; width: 1200px; height: 630px; overflow: hidden; background: #061a14; color: #edf4f0;
        font-family: "Atkinson Hyperlegible Next", system-ui, sans-serif; -webkit-font-smoothing: antialiased; }
      body::before { content: ""; position: absolute; right: -160px; top: -320px; width: 900px; height: 900px;
        background: radial-gradient(closest-side, #64eab726, transparent 70%); }
      .wrap { position: relative; display: grid; grid-template-columns: 1fr 450px; gap: 56px; height: 100%; padding: 0 0 0 80px; }
      .words { align-self: center; }
      .mark { display: flex; align-items: center; gap: 14px; margin: 0 0 30px; font-size: 34px; font-weight: 750; letter-spacing: -0.01em; }
      .mark svg { width: 52px; height: 52px; }
      .mark rect { fill: #2d423b; }
      .mark circle { fill: #64eab7; }
      .mark path { fill: none; stroke: #64eab7; stroke-width: 1.6; }
      h1 { margin: 0 0 26px; font-size: 62px; line-height: 0.98; letter-spacing: -0.035em; font-weight: 800; white-space: nowrap; }
      h1 span { display: block; color: #64eab7; }
      p { margin: 0; max-width: 540px; color: #acbcb4; font-size: 25px; line-height: 1.4; }
      .pic { margin-top: 56px; border-radius: 18px 0 0 0; overflow: hidden; box-shadow: 0 24px 60px -20px #000c; background: #f1f4f3; }
      .pic svg { display: block; width: 100%; height: auto; }
    </style></head><body><div class="wrap"><div class="words">
      <div class="mark"><svg viewBox="0 0 32 32"><rect width="32" height="32" rx="8.5"/><path d="M13.5 12.5 19 21M18.5 12.5 13 21M14 11h4"/><circle cx="10" cy="11" r="4"/><circle cx="22" cy="11" r="4"/><circle cx="16" cy="23" r="4"/></svg>grooph</div>
      <h1>Loop graphs <span>for coding agents.</span></h1>
      <p>Draw the loop, check that it can end, and compile it into a package Claude Code runs.</p>
    </div><div class="pic">${svg.replace('class="grooph-picture"', 'class="grooph-picture" data-theme="light"')}</div></div></body></html>`);
    await page.evaluate(() => document.fonts.load('800 62px "Atkinson Hyperlegible Next"'));
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: join(repoRoot, "apps/web/public/og.png") });
  });
});

test("the front page plays a recorded run when asked, in the picture's place, and fetches nothing of it before", async ({ page }) => {
  const asked: string[] = [];
  page.on("request", (request) => asked.push(new URL(request.url()).pathname));
  await page.goto("./");
  const picture = page.getByRole("img", { name: /The review gate template as a graph/ });
  await expect(picture).toBeVisible();
  // Before the button is pressed: no run, and none of the embed's own files.
  expect(asked.some((path) => path.endsWith("/demo/run.txt") || /EmbedApp-/.test(path))).toBe(false);

  await page.getByRole("button", { name: "Watch a recorded run" }).click();
  const frame = page.frameLocator("iframe.land-run-frame");
  // The replay's own controls are there: the scrubber, and the run's graph drawn above it.
  await expect(frame.getByRole("slider")).toBeVisible();
  await expect(frame.locator("svg [data-node]").first()).toBeVisible();
  await expect(picture).toBeHidden();
  expect(asked.some((path) => path.endsWith("/demo/run.txt"))).toBe(true);

  // And back.
  await page.getByRole("button", { name: "Back to the picture" }).click();
  await expect(picture).toBeVisible();
  await expect(page.locator("iframe.land-run-frame")).toHaveCount(0);

  // The front page names the guide and the pages beside the app.
  await expect(page.getByRole("link", { name: "the field guide" })).toHaveAttribute("href", /\/docs\/field-guide\/$/);
  await expect(page.getByRole("link", { name: "installed" })).toHaveAttribute("href", /\/docs\/quickstart\/$/);
  await expect(page.getByRole("heading", { name: "More than a drawing" })).toBeVisible();
});

test("the front page loads without the canvas screens and fetches them once it is up; a template's address asks for them at once", async ({ page }) => {
  // Slice 0069: index.html names what an address needs before the entry script runs.
  // When the screens were asked for, against when the app's own module had arrived. The page asks for both in one
  // breath when the address needs the screens, so they are asked for before the app's module can have come back;
  // otherwise the app asks for them itself, once it has run.
  const asked = () =>
    page.evaluate(() => {
      const entries = performance.getEntriesByType("resource") as PerformanceResourceTiming[];
      const one = (pattern: RegExp) => entries.find((e) => pattern.test(e.name))!;
      return { screens: one(/\/assets\/screens-[^/]*\.js/).startTime, app: one(/\/assets\/App-[^/]*\.js/).responseEnd };
    });
  const arrived = () => page.waitForFunction(() => performance.getEntriesByType("resource").some((e) => /\/assets\/screens-[^/]*\.js/.test(e.name)));

  await page.goto("./");
  await expect(page.locator(".land-headline")).toBeVisible();
  // Fetched after the app itself is here, so the next screen opens at once and the first one did not wait.
  await arrived();
  const front = await asked();
  expect(front.screens).toBeGreaterThan(front.app);

  await page.goto("./#/templates/built-in/review-gate");
  await page.reload();
  await expect(page.locator(".react-flow__node").first()).toBeVisible();
  await arrived();
  const template = await asked();
  expect(template.screens).toBeLessThan(template.app);
  // Slice 0070: neither address fetches the compiler. The editor does, once it is up, and the Export panel if it is first.
  expect(await page.evaluate(() => performance.getEntriesByType("resource").filter((e) => /\/assets\/compile-/.test(e.name)).length)).toBe(0);
});
