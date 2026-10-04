import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { gzipSync } from "node:zlib";

import { expect, test, type Page } from "@playwright/test";

import { repoRoot } from "./support.js";

/**
 * Handoff 0060: the documents as pages on the site, beside the app, in the front page's look.
 *
 * The pages are rendered by `scripts/site-pages.mjs` into the built app's folder, the same call the deploy makes, and served
 * by the same preview as the app under `/grooph/docs/`. They are not part of the app's build, so this file renders them
 * itself, once. The tests run one after another so no two renders write the folder at once.
 */
test.describe.configure({ mode: "serial" });

const dist = join(repoRoot, "apps/web/dist");

/** Every rendered page, as a path under `docs/`: "" is the index. */
function renderedPages(): string[] {
  const out: string[] = [];
  const walk = (dir: string): void => {
    for (const name of readdirSync(dir).sort()) {
      const full = join(dir, name);
      if (statSync(full).isDirectory()) walk(full);
      else if (name === "index.html") out.push(relative(join(dist, "docs"), dir).split("\\").join("/"));
    }
  };
  walk(join(dist, "docs"));
  return out;
}
const docPath = (page: string): string => (page === "" ? "docs/" : `docs/${page}/`);

test.beforeAll(() => {
  execFileSync(process.execPath, [join(repoRoot, "scripts/site-pages.mjs"), "--out", dist], { cwd: repoRoot, stdio: "pipe" });
});

/** What the worker has stored for the app's own address (its scope), read from any page it controls. */
const cachedAppPage = (page: Page): Promise<string> =>
  page.evaluate(async () => {
    const scope = (await navigator.serviceWorker.getRegistration())?.scope;
    const hit = scope ? await (await caches.open("grooph-app-v1")).match(scope) : undefined;
    return hit ? await hit.text() : "";
  });

const sidewaysScroll = (page: Page): Promise<number> => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

test("the rendered set holds the index and the first set of documents", () => {
  const pages = renderedPages();
  expect(pages).toEqual(expect.arrayContaining(["", "quickstart", "rules", "graph-ir", "templates", "operation-map", "exports", "subagents", "runs"]));
});

test.describe("with the app installed (its service worker in control)", () => {
  test.use({ serviceWorkers: "allow" });

  /** Criterion 6: the worker answers navigations with the app's index; the documents must be outside that. */
  test("a document opens as a document, and opening one leaves the app's own page alone", async ({ page, context }) => {
    // First visit, online: the app installs its worker and caches its page.
    await page.goto("./");
    await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
    await expect.poll(() => cachedAppPage(page)).toContain('id="root"');
    await expect(page.locator(".land-headline")).toBeVisible();

    // The Docs link, from the front page's menu, lands on the documents' index.
    await page.getByRole("button", { name: "Menu" }).click();
    await page.locator(".land-nav").getByRole("link", { name: "Docs" }).click();
    await expect(page).toHaveURL(/\/grooph\/docs\/$/);
    await expect(page.getByRole("heading", { name: "Docs", level: 1 })).toBeVisible();
    await expect(page.locator("#root")).toHaveCount(0);

    // Straight to a document, as a search result would, with the worker in control of the page.
    for (const path of ["docs/quickstart/", "docs/rules/", "docs/rules/#e_schema"]) {
      await page.goto(path);
      await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();
      await expect(page.locator("main .doc")).toBeVisible();
      await expect(page.locator("#root")).toHaveCount(0);
      expect(await page.evaluate(() => navigator.serviceWorker.controller !== null), path).toBe(true);
    }
    await page.goto("docs/quickstart/");
    await expect(page.getByRole("heading", { name: "Quickstart", level: 1 })).toBeVisible();

    // Opening a document did not become the app's page: the worker's copy of the app's address is still the app's.
    // (Looked up by the worker's scope: "./" would mean the document's own folder from here.)
    const cached = await cachedAppPage(page);
    expect(cached).toContain('id="root"');
    expect(cached).not.toContain('class="doc"');

    // And with no network the app still opens as the app, and a document is not swapped for it.
    await context.setOffline(true);
    await page.goto("./");
    await expect(page.locator(".land-headline")).toBeVisible();
    await expect(page.goto("docs/quickstart/")).rejects.toThrow();
    await context.setOffline(false);

    // Back online the document is still a document, and the wordmark still leads to the app.
    await page.goto("docs/quickstart/");
    await page.getByRole("link", { name: "grooph", exact: true }).first().click();
    await expect(page).toHaveURL(/\/grooph\/$/);
    await expect(page.locator(".land-headline")).toBeVisible();
  });

  test("a file beside the app is not the app either: opening one leaves the app's page alone", async ({ page, context }) => {
    await page.goto("./");
    await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
    await expect.poll(() => cachedAppPage(page)).toContain('id="root"');
    // Only the app's own address is the app. Anything else beside it (patterns/, experiments/, an icon) is that file.
    const response = await page.goto("favicon.svg");
    expect(response?.headers()["content-type"]).toContain("svg");
    // Had the worker stored it as the app's page, the app would now open as that file.
    await context.setOffline(true);
    await page.goto("./");
    await expect(page.locator(".land-headline")).toBeVisible();
    await context.setOffline(false);
  });
});

test("every page reads in the front page's colors, light and dark", async ({ page }) => {
  // Resolved by the browser to sRGB, so how a stylesheet writes a color does not matter: the app's build rewrites oklch() as
  // lab() and the pages keep it, and they are the same color to within a rounding step.
  const resolved = (p: Page) =>
    p.evaluate(() => {
      const probe = document.createElement("div");
      document.body.appendChild(probe);
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = 1;
      const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
      const out: Record<string, number[]> = {};
      for (const name of ["--bg", "--surface", "--surface-2", "--ink", "--ink-2", "--ink-3", "--line", "--line-strong", "--accent", "--accent-soft", "--focus", "--error", "--warning", "--night", "--night-ink", "--night-muted", "--bright"]) {
        probe.style.color = `var(${name})`;
        ctx.clearRect(0, 0, 1, 1);
        ctx.fillStyle = getComputedStyle(probe).color;
        ctx.fillRect(0, 0, 1, 1);
        out[name] = Array.from(ctx.getImageData(0, 0, 1, 1).data);
      }
      probe.style.borderTopLeftRadius = "var(--radius)";
      out["--radius"] = [parseFloat(getComputedStyle(probe).borderTopLeftRadius)];
      probe.remove();
      return out;
    });
  const backgrounds: Record<string, number[]> = {};
  for (const scheme of ["light", "dark"] as const) {
    await page.emulateMedia({ colorScheme: scheme });
    await page.goto("./");
    await expect(page.locator(".land-headline")).toBeVisible();
    const front = await resolved(page);
    await page.goto("docs/quickstart/");
    const doc = await resolved(page);
    for (const [name, channels] of Object.entries(front)) {
      doc[name]!.forEach((value, k) => expect(Math.abs(value - channels[k]!), `${scheme} ${name}`).toBeLessThanOrEqual(1));
    }
    expect(await page.evaluate(() => getComputedStyle(document.body).backgroundColor), scheme).not.toBe("rgba(0, 0, 0, 0)");
    backgrounds[scheme] = doc["--bg"]!;
  }
  expect(backgrounds["dark"]).not.toEqual(backgrounds["light"]);
});

test("the bar: the mark to the app, and links that go somewhere", async ({ page, request, baseURL }) => {
  await page.goto("docs/quickstart/");
  const wordmark = page.locator(".site-header .site-logo");
  expect(await wordmark.evaluate((a: HTMLAnchorElement) => new URL(a.href).pathname)).toBe("/grooph/");
  const nav = page.getByRole("navigation", { name: "grooph" });
  // At phone width the links are under Menu.
  await page.getByRole("button", { name: "Menu" }).click();
  await expect(nav.getByRole("link", { name: "Docs" })).toHaveAttribute("aria-current", "page");
  await expect(nav.getByRole("link", { name: "GitHub" })).toHaveAttribute("href", "https://github.com/ryanjosephkamp/grooph");
  // The field guide and the blog have a place on the bar once they have pages, and not before.
  const pages = renderedPages();
  await expect(nav.getByRole("link", { name: "Field guide" })).toHaveCount(pages.includes("field-guide") ? 1 : 0);
  await expect(nav.getByRole("link", { name: "Blog" })).toHaveCount(pages.some((p) => p.startsWith("blog/")) ? 1 : 0);
  // Each address on the bar that is ours answers.
  const hrefs = await nav.getByRole("link").evaluateAll((links) => links.map((a) => (a as HTMLAnchorElement).href));
  for (const href of hrefs) if (href.startsWith(baseURL!.replace(/grooph\/$/, ""))) expect((await request.get(href.split("#")[0]!)).status(), href).toBe(200);
});

test("each page: an h1, anchors on its headings, no image that fails, nothing scrolling sideways at 400 px", async ({ page, baseURL }) => {
  const failed: string[] = [];
  // Only what the site itself serves: an embed in a document may point at a host that is not up from here.
  const ours = (url: string) => new URL(url).origin === new URL(baseURL!).origin;
  page.on("requestfailed", (r) => {
    if (ours(r.url())) failed.push(r.url());
  });
  page.on("response", (r) => {
    if (r.status() >= 400 && ours(r.url())) failed.push(`${r.status()} ${r.url()}`);
  });
  for (const rendered of renderedPages()) {
    const path = docPath(rendered);
    await page.goto(path);
    expect(await page.getByRole("heading", { level: 1 }).count(), `${path} headings`).toBeGreaterThanOrEqual(1);
    expect(await sidewaysScroll(page), `${path} at 400 px`).toBeLessThanOrEqual(0);
    // Every h2 to h4 has a link to itself.
    const unanchored = await page.evaluate(() =>
      Array.from(document.querySelectorAll<HTMLElement>("main h2[id], main h3[id], main h4[id]"))
        .filter((h) => h.closest(".group") === null && h.querySelector(`a.anchor[href="#${h.id}"]`) === null)
        .map((h) => h.id),
    );
    expect(unanchored, `${path} headings without an anchor`).toEqual([]);
    // Every image in the column loads: all of them are fetched now, lazy or not, and none may come back empty.
    const broken = await page.evaluate(async () => {
      const images = Array.from(document.images);
      await Promise.all(
        images.map((img) => {
          img.loading = "eager";
          return img.complete ? undefined : new Promise<void>((done) => ["load", "error"].forEach((event) => img.addEventListener(event, () => done(), { once: true })));
        }),
      );
      return images.filter((img) => img.naturalWidth === 0).map((img) => img.getAttribute("src"));
    });
    expect(broken, `${path} images`).toEqual([]);
    // The skip link and the landmarks are there.
    await expect(page.locator("main#main")).toHaveCount(1);
  }
  expect(failed).toEqual([]);
});

test("tables and code blocks scroll inside the column; the page itself does not", async ({ page }) => {
  await page.goto("docs/graph-ir/");
  const wraps = page.locator(".table-wrap");
  expect(await wraps.count()).toBeGreaterThan(3);
  for (const wrap of await wraps.all()) {
    const box = (await wrap.boundingBox())!;
    expect(box.x + box.width).toBeLessThanOrEqual(400);
  }
  await page.goto("docs/rules/");
  const pre = page.locator(".code pre").first();
  expect(await pre.evaluate((el) => el.scrollWidth > el.clientWidth)).toBe(true);
  expect(await pre.evaluate((el) => getComputedStyle(el).overflowX)).toBe("auto");
  expect(await sidewaysScroll(page)).toBeLessThanOrEqual(0);
  // A scrollable region can be reached by keyboard.
  expect(await pre.getAttribute("tabindex")).toBe("0");
});

test("a link between two documents is a link between their pages; the others go to GitHub", async ({ page }) => {
  await page.goto("docs/quickstart/");
  const rules = page.locator("main a", { hasText: "rules.md" });
  expect(await rules.getAttribute("href")).toBe("../rules/");
  await rules.click();
  await expect(page).toHaveURL(/\/grooph\/docs\/rules\/$/);
  // A link to a fixture is the file on GitHub.
  const fixture = page.locator('main a[href*="/blob/main/fixtures/"]').first();
  expect(await fixture.getAttribute("href")).toMatch(/^https:\/\/github\.com\/ryanjosephkamp\/grooph\/blob\/main\/fixtures\/invalid\/E_SCHEMA\//);
});

test("a heading's anchor works: its link scrolls the heading into view and the address keeps the fragment", async ({ page }) => {
  await page.goto("docs/rules/");
  const anchor = page.locator("h3#e_loop_back_edge a.anchor");
  await anchor.focus();
  await expect(anchor).toHaveCSS("opacity", "1");
  await anchor.click();
  await expect(page).toHaveURL(/#e_loop_back_edge$/);
  await expect(page.locator("h3#e_loop_back_edge")).toBeInViewport();
});

test("Copy puts a code block's text on the clipboard and says so", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto("docs/quickstart/");
  const block = page.locator(".code").first();
  const text = (await block.locator("code").innerText()).replace(/\n$/, "");
  await block.getByRole("button", { name: "Copy this code" }).click();
  await expect(block.getByRole("button")).toHaveText("Copied");
  await expect(block.getByRole("status")).toHaveText("Copied");
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(text);
  expect(text).toContain("git clone https://github.com/ryanjosephkamp/grooph.git");
  await expect(block.getByRole("button")).toHaveText("Copy");
});

test.describe("with scripts off", () => {
  test.use({ javaScriptEnabled: false });

  test("a page reads the same, minus the Copy buttons", async ({ page }) => {
    await page.goto("docs/quickstart/");
    await expect(page.getByRole("heading", { name: "Quickstart", level: 1 })).toBeVisible();
    await expect(page.locator(".code").first()).toContainText("git clone https://github.com/ryanjosephkamp/grooph.git");
    await expect(page.locator(".code-bar")).toHaveCount(0);
    await expect(page.getByRole("button")).toHaveCount(0);
    // No Menu button to fold them under, so the header's links stand in the bar, wrapped, and the footer is whole.
    const nav = page.getByRole("navigation", { name: "grooph" });
    for (const name of ["Templates", "Docs", "Source"]) await expect(nav.getByRole("link", { name })).toBeVisible();
    await expect(page.locator("footer.site-footer").getByRole("link", { name: "Sponsor on GitHub" })).toBeVisible();
    expect(await sidewaysScroll(page)).toBeLessThanOrEqual(0);
  });
});

test("each page is light: at most 40 KB gzipped without its images, no framework, and no font from anywhere but the site", async () => {
  const sizes: string[] = [];
  for (const rendered of renderedPages()) {
    const html = readFileSync(join(dist, docPath(rendered), "index.html"));
    const kb = gzipSync(html).length / 1024;
    sizes.push(`${rendered || "(index)"} ${kb.toFixed(1)} KB`);
    expect(kb, rendered).toBeLessThanOrEqual(40);
    const text = html.toString("utf8");
    expect(text, rendered).not.toMatch(/<link[^>]+rel="stylesheet"/);
    // Handoff 0077: the fonts are files of the site, named relative to the page, and text shows before they arrive.
    const fonts = [...text.matchAll(/@font-face\{[^}]*\}/g)].map((m) => m[0]);
    expect(fonts.length, rendered).toBe(3);
    for (const face of fonts) expect(face, rendered).toMatch(/src:url\("(?:\.\.\/)+assets\/fonts\/[\w.-]+\.woff2"\) format\("woff2"\);.*font-display:swap/);
    expect(text, rendered).not.toMatch(/fonts\.googleapis|fonts\.gstatic|url\("?(?:https?:)?\/\//);
  }
  test.info().annotations.push({ type: "gzip sizes", description: sizes.join(", ") });
});

/** Handoff 0077: a document page is the front page's sibling: the same header, theme switch and footer. */
test("a document page carries the owner's footer and the theme switch, and keeps the look chosen on the front page", async ({ page, baseURL }) => {
  const asked: string[] = [];
  page.on("request", (r) => asked.push(r.url()));
  await page.goto("docs/quickstart/");
  const foot = page.locator("footer.site-footer");
  await expect(foot.locator(".site-made")).toHaveText("Made by Ryan Kamp");
  const social = foot.getByRole("list", { name: "Ryan Kamp online" }).getByRole("link");
  expect(await social.evaluateAll((links) => links.map((a) => a.getAttribute("href")))).toEqual([
    "https://ryanjosephkamp.github.io/",
    "https://github.com/ryanjosephkamp/",
    "https://www.linkedin.com/in/rjk1999",
    "https://x.com/ryanjosephkamp",
    "https://m.youtube.com/@RyanJosephKamp",
  ]);
  await expect(foot.getByRole("link", { name: "Ryan Kamp on YouTube" })).toBeVisible();
  await expect(foot.getByRole("link", { name: "Sponsor on GitHub" })).toHaveAttribute("href", "https://github.com/sponsors/ryanjosephkamp");
  await expect(foot.locator(".site-fine")).toContainText("This site uses no cookies, analytics or third-party requests.");
  await expect(foot.locator(".site-fine")).toContainText("Rendered from docs/quickstart.md");
  // The title stands in a night band; the font is the site's own file, and nothing is asked of another origin.
  await expect(page.locator(".page-hero").getByRole("heading", { name: "Quickstart", level: 1 })).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  expect(await page.evaluate(() => getComputedStyle(document.body).fontFamily)).toMatch(/^"?Atkinson Hyperlegible Next/);
  expect(await page.evaluate(() => Array.from(document.fonts).some((f) => f.status === "loaded" && f.family.includes("Atkinson Hyperlegible Next")))).toBe(true);
  const origin = new URL(baseURL!).origin;
  expect(asked.filter((url) => !url.startsWith("data:") && new URL(url).origin !== origin)).toEqual([]);

  // The theme switch, as on the front page, under the same key.
  const header = page.locator("header.site-header");
  const accent = () => page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--bright").trim());
  const green = await accent();
  await header.getByRole("button", { name: "Theme: Grooph" }).click();
  await header.getByRole("menuitemradio", { name: "Meteor" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "meteor");
  await expect(header.getByRole("button", { name: "Theme: Meteor" })).toBeFocused();
  expect(await accent()).not.toBe(green);
  await page.goto("./");
  await expect(page.locator(".land-headline")).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "meteor");
  await expect(page.locator("header.site-header").getByRole("button", { name: "Theme: Meteor" })).toBeVisible();
  await page.goto("docs/rules/");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "meteor");
  await page.locator("header.site-header").getByRole("button", { name: "Theme: Meteor" }).click();
  await page.keyboard.press("ArrowUp");
  await page.keyboard.press("Enter");
  await expect(page.locator("html")).not.toHaveAttribute("data-theme", /.+/);
  expect(await accent()).toBe(green);
});

test.describe("at desktop width", () => {
  test.use({ viewport: { width: 1440, height: 900 }, isMobile: false, hasTouch: false, deviceScaleFactor: 1 });

  test("the reading column is about 720 px, under the mark and the title, and the page does not scroll sideways", async ({ page }) => {
    await page.goto("docs/quickstart/");
    const column = (await page.locator("main .doc > p").first().boundingBox())!;
    expect(column.width).toBeGreaterThan(680);
    expect(column.width).toBeLessThanOrEqual(720);
    const mark = (await page.locator(".site-header .site-logo").boundingBox())!;
    const title = (await page.locator(".page-hero h1").boundingBox())!;
    expect(Math.abs(mark.x - title.x)).toBeLessThanOrEqual(2);
    expect(Math.abs(mark.x - column.x)).toBeLessThanOrEqual(2);
    expect(await sidewaysScroll(page)).toBeLessThanOrEqual(0);
    // The links are in the bar at this width, with no Menu button.
    await expect(page.getByRole("navigation", { name: "grooph" }).getByRole("link", { name: "Docs" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Menu" })).toBeHidden();
    await page.goto("docs/");
    expect(await sidewaysScroll(page)).toBeLessThanOrEqual(0);
    // A long document's contents list stands beside its column, open, and stays in view.
    await page.goto("docs/graph-ir/");
    const toc = page.locator("details.toc");
    await expect(toc).toHaveAttribute("open", "");
    const beside = (await toc.boundingBox())!;
    const text = (await page.locator("main .doc").boundingBox())!;
    expect(beside.x + beside.width).toBeLessThanOrEqual(text.x);
    expect(Math.abs(beside.x - mark.x)).toBeLessThanOrEqual(2);
    expect(await toc.evaluate((el) => getComputedStyle(el).position)).toBe("sticky");
    expect(await sidewaysScroll(page)).toBeLessThanOrEqual(0);
  });
});

/**
 * Criterion 7: the screenshots, made only on request, into the slice folder:
 *
 *   GROOPH_SHOTS=1 GROOPH_E2E_PORT=4331 pnpm --filter @grooph/web exec playwright test e2e/site-pages.spec.ts -g screenshots
 */
test.describe("screenshots", () => {
  test.skip(!process.env["GROOPH_SHOTS"], "screenshots are made on request (GROOPH_SHOTS=1)");
  const dir = join(repoRoot, "handoffs/0060-site-pages/shots");
  const sizes = { phone: { width: 400, height: 800 }, desktop: { width: 1440, height: 900 } } as const;
  const views: { name: string; path: string; at?: string }[] = [
    { name: "index", path: "docs/" },
    { name: "quickstart", path: "docs/quickstart/" },
    { name: "rules", path: "docs/rules/" },
    { name: "rules-entry", path: "docs/rules/", at: "#e_loop_back_edge" },
    { name: "graph-ir-top", path: "docs/graph-ir/" },
    { name: "graph-ir-tables", path: "docs/graph-ir/", at: "#3-validation-rules" },
  ];
  for (const [size, viewport] of Object.entries(sizes)) {
    for (const scheme of ["light", "dark"] as const) {
      test.describe(`${size}, ${scheme}`, () => {
        test.use({ viewport, colorScheme: scheme, ...(size === "desktop" ? { isMobile: false, hasTouch: false, deviceScaleFactor: 1 } : { deviceScaleFactor: 2 }) });
        test(`${size} ${scheme}`, async ({ page }) => {
          for (const view of views) {
            await page.goto(view.path + (view.at ?? ""));
            await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
            if (view.at) await page.evaluate((id) => document.getElementById(id.slice(1))?.scrollIntoView({ block: "start" }), view.at);
            await page.waitForTimeout(150);
            await page.screenshot({ path: join(dir, `${view.name}-${size}-${scheme}.png`) });
          }
        });
      });
    }
  }
});
