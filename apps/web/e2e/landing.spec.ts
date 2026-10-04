import { readFileSync } from "node:fs";
import { join } from "node:path";
import { gzipSync } from "node:zlib";

import { expect, test, type Page } from "@playwright/test";

import { fixturePath, importDocument, repoRoot } from "./support.js";

/**
 * Handoff 0055: the front door. On an empty device `#/` is the front page; with
 * graphs it is the library, which links to the same page at `#/about`. On a
 * desktop the front page and the templates use the width.
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
      const labelled = el.getAttribute("aria-labelledby");
      const named =
        (el.getAttribute("aria-label") ?? "").trim() !== "" ||
        (labelled !== null && labelled.split(/\s+/).some((id) => (document.getElementById(id)?.textContent ?? "").trim() !== "")) ||
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
  await expect(page.getByRole("heading", { name: "grooph", level: 1 })).toBeVisible();
  await expect(page.locator(".land-headline")).toHaveText("Loop graphs for coding agents.");

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

test("the first load is at most 300 KB compressed", async ({ page }) => {
  const bodies: Promise<number>[] = [];
  page.on("response", (response) => {
    if (response.url().startsWith("data:")) return;
    bodies.push(response.body().then((body) => gzipSync(body).length, () => 0));
  });
  await page.goto("./");
  await expect(page.locator(".land-picture svg")).toBeVisible();
  const total = (await Promise.all(bodies)).reduce((a, b) => a + b, 0);
  expect(total).toBeLessThanOrEqual(300 * 1024);
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

  test("the front page uses the width: about 1,120 px, the graph beside the words", async ({ page }) => {
    await page.goto("./");
    const land = (await page.locator(".land").boundingBox())!;
    expect(land.width).toBeGreaterThan(1080);
    expect(land.width).toBeLessThanOrEqual(1120);
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
    await page.setContent(`<!doctype html><html><head><style>
      * { box-sizing: border-box; }
      body { margin: 0; width: 1200px; height: 630px; overflow: hidden; background: #f1f4f3; color: #1a201e;
        font-family: system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; }
      .wrap { display: grid; grid-template-columns: 1fr 470px; gap: 56px; height: 100%; padding: 0 0 0 80px; }
      .words { align-self: center; }
      .mark { font-size: 40px; font-weight: 760; letter-spacing: -0.03em; color: #1f5f4a; margin: 0 0 28px; }
      h1 { font-size: 68px; line-height: 1.03; letter-spacing: -0.035em; font-weight: 760; margin: 0 0 24px; }
      p { font-size: 25px; line-height: 1.4; color: #454c49; margin: 0; max-width: 520px; }
      .pic { margin-top: 56px; border: 1px solid #dce1df; border-radius: 18px 0 0 0; border-right: 0; overflow: hidden;
        box-shadow: 0 4px 24px rgb(0 0 0 / 0.08); background: #f1f4f3; }
      .pic svg { display: block; width: 100%; height: auto; }
    </style></head><body><div class="wrap"><div class="words"><div class="mark">grooph</div>
      <h1>Loop graphs for coding agents.</h1>
      <p>Draw the loop, check that it can end, and compile it into a package Claude Code runs.</p>
    </div><div class="pic">${svg.replace('class="grooph-picture"', 'class="grooph-picture" data-theme="light"')}</div></div></body></html>`);
    await page.screenshot({ path: join(repoRoot, "apps/web/public/og.png") });
  });
});
