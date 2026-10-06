import { readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { canonicalize, offlineKit, outline, picture, type Graph } from "@grooph/core";
import { offlinePageWith } from "@grooph/core/offline";
import { expect, test } from "@playwright/test";

import { downloadBytes, downloadText, fixturePath, importDocument, linkFor, node, repoRoot, reviewLoop, sheet } from "./support.js";

/** The offline page as core makes it: the maker, handed core's parts, as the app calls it (it is a piece fetched on demand). */
const offlinePage = (doc: Graph, options: { version: string }): string => offlinePageWith(offlineKit, doc, options);
/** The review loop's page at the app's version: said once, where scripts/version.mjs reads it. */
const madeByCore = (): string => offlinePage(reviewLoop(), { version: "0.3.0" });

/**
 * Slice 0025: things to keep, and the outline. The picture as SVG and PNG in
 * light and dark, the one offline HTML file, and the whole graph to read top
 * to bottom, in the editor and in the read-only viewer.
 */
const open = (page: import("@playwright/test").Page) => importDocument(page, "review-loop.grooph.json", readFileSync(fixturePath, "utf8"));

test("Keep a copy: the picture as SVG is what core draws; as PNG it is 1,200 px wide; dark is a tap", async ({ page }) => {
  await open(page);
  await page.getByRole("button", { name: "Export", exact: true }).tap();
  const keep = sheet(page).getByRole("group", { name: "Keep a copy" });
  await expect(keep).toBeVisible();

  let [file] = await Promise.all([page.waitForEvent("download"), keep.getByRole("button", { name: "Picture (SVG)" }).tap()]);
  expect(file.suggestedFilename()).toBe("review-loop.light.svg");
  expect(await downloadText(file)).toBe(readFileSync(join(repoRoot, "fixtures/pictures/review-loop.light.svg"), "utf8"));

  await keep.getByRole("radio", { name: "Dark" }).tap();
  [file] = await Promise.all([page.waitForEvent("download"), keep.getByRole("button", { name: "Picture (SVG)" }).tap()]);
  expect(file.suggestedFilename()).toBe("review-loop.dark.svg");
  expect(await downloadText(file)).toBe(picture(reviewLoop(), { theme: "dark" }));

  [file] = await Promise.all([page.waitForEvent("download"), keep.getByRole("button", { name: "Picture (PNG)" }).tap()]);
  expect(file.suggestedFilename()).toBe("review-loop.dark.png");
  const png = Buffer.from(await downloadBytes(file));
  expect([...png.subarray(0, 4)]).toEqual([0x89, 0x50, 0x4e, 0x47]);
  expect(png.readUInt32BE(16)).toBe(1200);
  // It is the dark picture: the first pixel row is the dark background, so the file is not blank white.
  const height = Number(/viewBox="0 0 400 ([\d.]+)"/.exec(picture(reviewLoop(), { theme: "dark" }))![1]);
  expect(png.readUInt32BE(20)).toBe(Math.round(height * 3));
  expect(png.length).toBeGreaterThan(20_000);
});

test("the offline page downloads as one file, opens with the network off, and gives the document back", async ({ page, browser }) => {
  await open(page);
  await page.getByRole("button", { name: "Export", exact: true }).tap();
  const [file] = await Promise.all([page.waitForEvent("download"), sheet(page).getByRole("button", { name: "Offline page (.html)" }).tap()]);
  expect(file.suggestedFilename()).toBe("review-loop.html");
  const html = await downloadText(file);
  // The app and the CLI make the same page for the same document and version.
  expect(html).toBe(madeByCore());

  const path = join(tmpdir(), `grooph-offline-${Date.now()}.html`);
  writeFileSync(path, html);
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, offline: true, acceptDownloads: true });
  const offline = await context.newPage();
  const requests: string[] = [];
  const errors: string[] = [];
  offline.on("request", (r) => requests.push(r.url()));
  offline.on("pageerror", (e) => errors.push(e.message));
  offline.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  await offline.goto(`file://${path}`);
  await expect(offline.locator('.picture svg[data-picture="graph"]')).toBeVisible();
  // As wide as the phone, and nothing scrolls sideways.
  expect((await offline.locator(".picture svg").boundingBox())!.width).toBe(390);
  expect(await offline.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

  // A card leads to its full brief.
  await offline.locator('[data-node="critic"]').tap();
  await expect(offline.locator("#s-critic")).toBeInViewport();
  await expect(offline.locator("#s-critic")).toContainText("Compare the diff and test output against the checklist.");

  // Light and dark is a button, for the page and the picture together.
  await offline.locator("#theme").tap();
  await expect(offline.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(offline.locator(".picture svg")).toHaveAttribute("data-theme", "dark");

  // The document comes back out, byte for byte.
  const [saved] = await Promise.all([offline.waitForEvent("download"), offline.locator("#save").tap()]);
  expect(saved.suggestedFilename()).toBe("review-loop.grooph.json");
  expect(await downloadText(saved)).toBe(canonicalize(reviewLoop()));

  // One file was read, and nothing else was asked for.
  expect(requests).toEqual([`file://${path}`]);
  expect(errors).toEqual([]);
  await context.close();
});

test("when the offline page's maker cannot be fetched, the panel says so and no file comes; once it can, the next press makes the page", async ({ page }) => {
  // The maker is a piece of the app fetched at this press (slice 0093): it must fail where the person is looking.
  let refuse = true;
  const asked: string[] = [];
  await page.route("**/assets/offline-*.js*", (route) => {
    asked.push(route.request().url());
    return refuse ? route.abort() : route.continue();
  });
  await open(page);
  await page.getByRole("button", { name: "Export", exact: true }).tap();
  const keep = sheet(page).getByRole("group", { name: "Keep a copy" });
  // Opening the panel asks for nothing: the piece is fetched when the page is asked for, not before.
  expect(asked).toEqual([]);
  let downloads = 0;
  page.on("download", () => (downloads += 1));
  await keep.getByRole("button", { name: "Offline page (.html)" }).tap();
  await expect(keep.getByRole("alert")).toHaveText("The offline page could not be made: its maker could not be fetched. It needs a connection the first time. The pictures above are made without it.");
  await expect(keep.getByRole("alert")).toBeVisible();
  expect(asked.length).toBeGreaterThan(0);
  expect(downloads).toBe(0);
  // The button is not left busy by a fetch that failed.
  const offline = keep.getByRole("button", { name: "Offline page (.html)" });
  await expect(offline).toBeEnabled();
  await expect(offline).not.toHaveAttribute("aria-busy", "true");
  // The pictures need no piece: they are made as before. A picture that was made clears the notice, as it clears
  // any other of this panel's.
  const [svg] = await Promise.all([page.waitForEvent("download"), keep.getByRole("button", { name: "Picture (SVG)" }).tap()]);
  expect(svg.suggestedFilename()).toBe("review-loop.light.svg");
  await expect(keep.getByRole("alert")).toHaveCount(0);
  // Still refused: the notice is back at the next press, and still no page.
  await offline.tap();
  await expect(keep.getByRole("alert")).toHaveText(/The offline page could not be made: its maker could not be fetched\./);
  expect(downloads).toBe(1);

  // The connection is back: the same button, with nothing reloaded, makes the page, and the notice goes with it.
  refuse = false;
  const [file] = await Promise.all([page.waitForEvent("download"), offline.tap()]);
  expect(file.suggestedFilename()).toBe("review-loop.html");
  expect(await downloadText(file)).toBe(madeByCore());
  await expect(keep.getByRole("alert")).toHaveCount(0);
});

test("while the offline page's maker is on its way the button is busy and takes no second press", async ({ page }) => {
  let release: () => void = () => undefined;
  const held = new Promise<void>((go) => (release = go));
  await page.route("**/assets/offline-*.js*", async (route) => {
    await held;
    await route.continue();
  });
  await open(page);
  await page.getByRole("button", { name: "Export", exact: true }).tap();
  const keep = sheet(page).getByRole("group", { name: "Keep a copy" });
  const offline = keep.getByRole("button", { name: "Offline page (.html)" });
  let downloads = 0;
  page.on("download", () => (downloads += 1));
  await offline.tap();
  await expect(offline).toHaveAttribute("aria-busy", "true");
  await expect(offline).toBeDisabled();
  expect(downloads).toBe(0);
  const [file] = await Promise.all([page.waitForEvent("download"), Promise.resolve(release())]);
  expect(await downloadText(file)).toBe(madeByCore());
  await expect(offline).toBeEnabled();
  await expect(offline).not.toHaveAttribute("aria-busy", "true");
  expect(downloads).toBe(1);
});

test("the outline: the whole graph to read, at full height; in the editor a section opens its inspector", async ({ page }) => {
  await open(page);
  // The top bar still fits a phone: every control is on screen and none overlaps the next.
  const bar = page.locator("header.topbar");
  const boxes = await Promise.all(
    [bar.getByRole("link", { name: "All graphs" }), bar.locator(".title-btn"), bar.getByRole("button", { name: "Outline" }), bar.getByRole("button", { name: /^Validation:/ }), bar.getByRole("button", { name: "Export", exact: true })].map(
      async (l) => (await l.boundingBox())!,
    ),
  );
  for (let i = 1; i < boxes.length; i++) expect(boxes[i]!.x).toBeGreaterThanOrEqual(boxes[i - 1]!.x + boxes[i - 1]!.width - 0.5);
  expect(boxes.at(-1)!.x + boxes.at(-1)!.width).toBeLessThanOrEqual(400);
  expect(boxes[1]!.width).toBeGreaterThan(70); // the name keeps room

  await page.getByRole("button", { name: "Outline" }).tap();
  await expect(sheet(page).getByRole("heading", { name: "Outline" })).toBeVisible();
  const sections = sheet(page).locator(".outline-section");
  await expect(sections).toHaveCount(outline(reviewLoop()).length);
  await expect(sections.nth(2)).toContainText("Compare the diff and test output against the checklist.");
  await expect(sections.nth(2)).toContainText("on fail, to Builder (back edge: starts the next round");
  await expect(sheet(page)).toContainText("max iterations: 4: halt the run and report to the human");
  // Full height: the sheet covers the canvas.
  expect((await sheet(page).boundingBox())!.height).toBeGreaterThan(550);

  await sections.nth(2).getByRole("button", { name: "Edit" }).tap();
  await expect(sheet(page).getByRole("heading", { name: "Agent" })).toBeVisible();
  await expect(sheet(page).getByLabel("Name", { exact: true })).toHaveValue("Critic");

  // An edit shows in the outline at once: it is a view of the same document.
  await sheet(page).getByLabel("Name", { exact: true }).fill("Reviewer");
  await page.getByRole("button", { name: "Outline" }).tap();
  await expect(sheet(page).locator(".outline-section").nth(2).getByRole("heading")).toHaveText("Reviewer");
});

test("the read-only viewer has the outline and Keep a copy too, and no way to edit", async ({ page }) => {
  await page.goto(linkFor(reviewLoop()));
  await expect(node(page, "builder")).toBeVisible();
  await page.getByRole("button", { name: "Outline" }).tap();
  await expect(sheet(page).locator(".outline-section")).toHaveCount(outline(reviewLoop()).length);
  await expect(sheet(page).getByRole("button", { name: "Edit" })).toHaveCount(0);
  await page.getByRole("button", { name: "Outline" }).tap();
  await expect(sheet(page)).toHaveCount(0);

  await page.locator(".title-btn").tap();
  const [file] = await Promise.all([page.waitForEvent("download"), sheet(page).getByRole("button", { name: "Offline page (.html)" }).tap()]);
  expect(file.suggestedFilename()).toBe("review-loop.html");
});
