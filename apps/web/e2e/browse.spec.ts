import { readFileSync } from "node:fs";
import { join } from "node:path";

import { expect, test } from "@playwright/test";

import { glyph, mermaid, parseGraphText } from "@grooph/core";

import { downloadText, fixturePath, importDocument, repoRoot, sheet } from "./support.js";

/**
 * Handoff 0015, criteria 3 and 4: browsing the template library (search,
 * filters, sort; the selection kept across navigation) and the glyph on the
 * list, the template page, the graph list and the compare cards, by touch at
 * phone size, plus the save and copy paths on the template page.
 */

const pattern = (id: string) => parseGraphText(readFileSync(join(repoRoot, "patterns", `${id}.grooph.json`), "utf8")).doc!;
/** Core's SVG as the DOM serialises it back (innerHTML closes every element), for a byte comparison. */
const asDom = (svg: string): string => svg.replace(/<(\w+)([^>]*?)\/>/g, "<$1$2></$1>");
const rows = (page: import("@playwright/test").Page) => page.locator(".template-row");
const ids = async (page: import("@playwright/test").Page): Promise<string[]> => rows(page).evaluateAll((els) => els.map((el) => el.getAttribute("data-template")!));

test("search narrows the list as you type, over title, summary, when-to-use and tags; Clear brings everything back", async ({ page }) => {
  await page.goto("./#/templates");
  await expect(page.locator(".browse-shown")).toHaveText("20 templates");
  const search = page.getByRole("searchbox", { name: "Search templates" });
  await search.fill("gate");
  await expect(page.locator(".browse-shown")).toHaveText("7 of 20");
  expect(await ids(page)).toEqual(["debate-then-build", "heterogeneous-critic", "human-gated-irreversible", "merge-queue", "patrol-pulse", "review-gate", "spec-then-loop"]);
  // A tag, then two terms that must both match.
  await search.fill("counterexample");
  expect(await ids(page)).toEqual(["contradiction-seeker"]);
  await search.fill("gate human");
  expect(await ids(page)).toEqual(["debate-then-build", "heterogeneous-critic", "human-gated-irreversible", "merge-queue", "patrol-pulse", "review-gate", "spec-then-loop"]);
  await search.fill("zzzz");
  await expect(page.locator(".browse-none")).toContainText("No template matches.");
  await expect(rows(page)).toHaveCount(0);
  await page.locator(".browse-none").getByRole("button", { name: "Clear the search and filters" }).tap();
  await expect(rows(page)).toHaveCount(20);
  await expect(search).toHaveValue("");
});

test("a filter combination: kind, a profile axis and a tag together; the count on the button; Clear", async ({ page }) => {
  await page.goto("./#/templates");
  const filters = page.getByRole("button", { name: /^Filters/ });
  await expect(filters).toHaveAttribute("aria-expanded", "false");
  await filters.tap();
  await expect(filters).toHaveAttribute("aria-expanded", "true");

  // High rigor: seven.
  await page.getByRole("group", { name: "Rigor" }).getByRole("button", { name: "High rigor" }).tap();
  await expect(page.locator(".browse-shown")).toHaveText("7 of 20");
  expect(await ids(page)).toEqual(["fresh-grind-rare-judge", "gauntlet-decomposed", "heterogeneous-critic", "red-team-loop", "spec-then-loop", "specialist-critic-bank", "taste-polish"]);
  // Two values on one axis widen it; a tag narrows across.
  await page.getByRole("group", { name: "Rigor" }).getByRole("button", { name: "Standard rigor" }).tap();
  await expect(page.locator(".browse-shown")).toHaveText("18 of 20");
  await page.getByRole("group", { name: "Tags" }).getByRole("button", { name: "human-gate", exact: true }).tap();
  expect(await ids(page)).toEqual(["debate-then-build", "heterogeneous-critic", "human-gated-irreversible", "merge-queue", "patrol-pulse", "review-gate", "spec-then-loop"]);
  await page.getByRole("group", { name: "Kind" }).getByRole("button", { name: "Fragment" }).tap();
  expect(await ids(page)).toEqual(["human-gated-irreversible", "merge-queue"]);
  await expect(filters).toHaveText("Filters4");
  await expect(filters.locator(".browse-count")).toHaveText("4");

  // The tag list shows the most used first; the rest on request.
  const tags = page.getByRole("group", { name: "Tags" });
  await expect(tags.getByRole("button", { name: "loop", exact: true })).toBeVisible();
  await expect(tags.getByRole("button", { name: "zero-to-one", exact: true })).toHaveCount(0);
  await tags.getByRole("button", { name: /^All \d+ tags$/ }).tap();
  await expect(tags.getByRole("button", { name: "zero-to-one", exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Clear", exact: true }).tap();
  await expect(rows(page)).toHaveCount(20);
  await expect(filters).toHaveText("Filters");
  // Cleared, the panel stays open.
  await expect(filters).toHaveAttribute("aria-expanded", "true");
});

test("sort by cost, speed, rigor or name", async ({ page }) => {
  await page.goto("./#/templates");
  const sort = page.getByRole("combobox", { name: "Sort by" });
  const first = async () => (await ids(page)).slice(0, 3);

  await sort.selectOption("cost");
  // Low cost first, then by title.
  expect(await first()).toEqual(["contradiction-seeker", "grind-loop", "human-gated-irreversible"]);
  const byCost = await ids(page);
  expect(byCost.slice(-2)).toEqual(["specialist-critic-bank", "taste-polish"]);

  await sort.selectOption("speed");
  expect(await first()).toEqual(["contradiction-seeker", "grind-loop", "human-gated-irreversible"]);
  expect((await ids(page)).at(-1)).toBe("taste-polish");

  await sort.selectOption("rigor");
  // High rigor first.
  expect(await first()).toEqual(["fresh-grind-rare-judge", "gauntlet-decomposed", "heterogeneous-critic"]);
  expect((await ids(page)).at(-1)).toBe("ralph-loop");

  await sort.selectOption("name");
  expect(await first()).toEqual(["contradiction-seeker", "debate-then-build", "dual-bar"]);
});

test("the selection survives opening a template and coming back, and a reload; storage that refuses does not break the page", async ({ page }) => {
  await page.goto("./#/templates");
  await page.getByRole("searchbox", { name: "Search templates" }).fill("review");
  await page.getByRole("button", { name: /^Filters/ }).tap();
  await page.getByRole("group", { name: "Cost" }).getByRole("button", { name: "Medium cost" }).tap();
  await page.getByRole("combobox", { name: "Sort by" }).selectOption("rigor");
  expect(await ids(page)).toEqual(["heterogeneous-critic", "dual-bar", "metric-sandwich", "review-gate"]);

  await page.locator('.template-row[data-template="review-gate"]').tap();
  await expect(page.locator(".title-sub")).toHaveText("built-in template · read-only");
  await page.getByRole("link", { name: "All templates" }).tap();
  await expect(page.getByRole("searchbox", { name: "Search templates" })).toHaveValue("review");
  await expect(page.getByRole("combobox", { name: "Sort by" })).toHaveValue("rigor");
  await expect(page.getByRole("button", { name: /^Filters/ })).toHaveAttribute("aria-expanded", "true");
  await expect(page.getByRole("group", { name: "Cost" }).getByRole("button", { name: "Medium cost" })).toHaveAttribute("aria-pressed", "true");
  expect(await ids(page)).toEqual(["heterogeneous-critic", "dual-bar", "metric-sandwich", "review-gate"]);

  await page.reload();
  expect(await ids(page)).toEqual(["heterogeneous-critic", "dual-bar", "metric-sandwich", "review-gate"]);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("grooph.templates.browse")!))).toMatchObject({ q: "review", cost: ["medium"], sort: "rigor" });

  // Storage refused (a private window, a locked-down browser): the page still works, the selection lasts for the visit.
  await page.addInitScript(() => {
    Object.defineProperty(window, "localStorage", {
      get() {
        throw new DOMException("denied", "SecurityError");
      },
    });
  });
  await page.reload();
  await expect(rows(page)).toHaveCount(20);
  await page.getByRole("searchbox", { name: "Search templates" }).fill("grind");
  await expect(page.locator(".browse-shown")).toHaveText("6 of 20");
});

test("the glyph on the list, the template page and the graph list at phone width: core's drawing, no words, in the theme", async ({ page }) => {
  await page.goto("./#/templates");
  const row = page.locator('.template-row[data-template="review-gate"]');
  const svg = row.locator(".template-glyph svg");
  await expect(svg).toBeVisible();
  const box = (await svg.boundingBox())!;
  expect(box.width).toBeGreaterThan(40);
  expect(box.height).toBeGreaterThan(20);
  expect(box.x + box.width).toBeLessThan(400);
  // Byte for byte what core draws.
  expect(await row.locator(".template-glyph").innerHTML()).toBe(asDom(glyph(pattern("review-gate"))));
  await expect(svg.locator("text")).toHaveCount(0);
  await expect(svg.locator("title")).toHaveText("Review gate");
  // The shapes: a square, a diamond, an octagon and a dot; the hull; both fail edges dashed.
  await expect(svg.locator("rect[width='22']")).toHaveCount(1);
  await expect(svg.locator("path[stroke-width='2.4']")).toHaveCount(1);
  await expect(svg.locator("circle[r='6']")).toHaveCount(1);
  await expect(svg.locator("rect[rx='10']")).toHaveCount(1);
  await expect(svg.locator("path[stroke-dasharray='5 3']")).toHaveCount(2);
  // In the theme: the hull's stroke resolves to the app's loop colour, not the fallback.
  const stroke = await svg.locator("rect[rx='10']").evaluate((el) => getComputedStyle(el).stroke);
  expect(stroke).not.toBe("none");
  expect(stroke).toMatch(/^rgb\(/);

  // The twenty rows fit the width and stack in one column on a phone.
  const boxes = await page.locator(".template-row").evaluateAll((els) => els.map((el) => el.getBoundingClientRect()));
  expect(boxes).toHaveLength(20);
  for (const b of boxes) expect(b.right).toBeLessThanOrEqual(400);
  expect(new Set(boxes.map((b) => Math.round(b.left))).size).toBe(1);

  // The template page: the glyph at the top of the About panel.
  await row.tap();
  const top = sheet(page).locator(".glyph-large svg");
  await expect(top).toBeVisible();
  expect(await sheet(page).locator(".glyph-large").innerHTML()).toBe(asDom(glyph(pattern("review-gate"))));
  const topBox = (await top.boundingBox())!;
  expect(topBox.width).toBeGreaterThan(200);

  // The graph list: a glyph beside each graph's name.
  await importDocument(page, "review-loop.grooph.json", readFileSync(fixturePath, "utf8"));
  await page.goto("./");
  const graphRow = page.locator(".graph-row").first();
  await expect(graphRow.locator(".graph-glyph svg")).toBeVisible();
  await expect(graphRow).toContainText("Review loop");
  expect(await graphRow.locator(".graph-glyph").innerHTML()).toBe(asDom(glyph(parseGraphText(readFileSync(fixturePath, "utf8")).doc!)));
});

test("Save glyph downloads the SVG; Copy Mermaid puts the one-way projection on the clipboard", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto("./#/templates/built-in/review-gate");
  const about = sheet(page);
  const downloading = page.waitForEvent("download");
  await about.getByRole("button", { name: "Save glyph" }).tap();
  const file = await downloading;
  expect(file.suggestedFilename()).toBe("review-gate.svg");
  expect(await downloadText(file)).toBe(`${glyph(pattern("review-gate"))}\n`);

  await about.getByRole("button", { name: "Copy Mermaid" }).tap();
  await expect(about.getByRole("status")).toContainText("Mermaid copied. It is a one-way picture");
  const text = await page.evaluate(() => navigator.clipboard.readText());
  expect(text).toBe(mermaid(pattern("review-gate")));
  expect(text).toMatch(/^%% grooph mermaid: a projection of Review gate \(review-gate@1\)\. One way only: it does not round-trip\./);
  expect(text).toContain("flowchart LR");
});
