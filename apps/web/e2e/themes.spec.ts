import { readFileSync } from "node:fs";
import { join } from "node:path";
import { deflateRawSync } from "node:zlib";

import { buildShareEnvelope, encodeSharePayload, offlinePage, parseMapText, picture, type OperationMap } from "@grooph/core";
import { PICTURE_THEMES, pictureLook } from "@grooph/core/themes";
import { expect, test, type Locator, type Page } from "@playwright/test";

import { downloadText, fixturePath, importDocument, linkFor, node, repoRoot, reviewLoop, sheet } from "./support.js";

/**
 * The picture's themes in the app (handoff 0086; docs/themes.md): six looks for the same picture. Paper is the
 * default and costs an address nothing; the other five are a piece fetched when one is chosen or named in an
 * address. The choice is offered in the header's theme menu and on the canvas, is kept in this browser, and is
 * separate from the site's look and from light and dark.
 */
const FIVE = PICTURE_THEMES.filter((name) => name !== "paper");
const map = (): OperationMap => parseMapText(readFileSync(join(repoRoot, "fixtures/maps/valid/owner-operation-2026-09-30.grooph-map.json"), "utf8")).map!;
const payload = (doc: Parameters<typeof buildShareEnvelope>[0]): string => encodeSharePayload(buildShareEnvelope(doc), (bytes) => deflateRawSync(bytes, { level: 9 }));

/** The requests a page makes for the themes' piece. */
function fetches(page: Page): string[] {
  const asked: string[] = [];
  page.on("request", (r) => (/\/assets\/themes-[^/]*\.js$/.test(new URL(r.url()).pathname) ? asked.push(r.url()) : undefined));
  return asked;
}

/** A theme chosen before the page loads, as a visit after the choice finds it. */
const keep = (page: Page, name: string) => page.addInitScript((value) => localStorage.setItem("groophPicture", value), name);

/** How far the widest line of words in a picture runs past its card, its pill or the picture's own edge, in units. */
const pastItsBox = (svg: Locator): Promise<{ over: number; words: string }> =>
  svg.evaluate((root) => {
    const W = (root as SVGSVGElement).viewBox.baseVal.width;
    let worst = { over: 0, words: "" };
    for (const t of root.querySelectorAll("text")) {
      const b = (t as SVGTextElement).getBBox();
      if (b.width === 0) continue;
      const card = t.closest("[data-node],[data-session],[data-person]")?.querySelector("rect[data-card]") as SVGRectElement | null;
      const before = t.previousElementSibling;
      let [lo, hi] = [1, W - 1];
      if (card) [lo, hi] = [card.getBBox().x + 1, card.getBBox().x + card.getBBox().width - 1];
      else if (before?.tagName === "rect" && t.getAttribute("text-anchor") === "middle") [lo, hi] = [(before as SVGRectElement).getBBox().x, (before as SVGRectElement).getBBox().x + (before as SVGRectElement).getBBox().width];
      else if (t.closest("[data-number]")) continue;
      const over = Math.max(lo - b.x, b.x + b.width - hi);
      if (over > worst.over) worst = { over: Math.round(over * 10) / 10, words: t.textContent ?? "" };
    }
    return worst;
  });

test("no theme is fetched until one is chosen; the header's menu offers the six, draws the page's picture in the one chosen, and keeps the choice", async ({ page }) => {
  const asked = fetches(page);
  await page.goto("./");
  const hero = page.locator(".land-picture svg");
  await expect(hero).toBeVisible();
  await expect(hero).not.toHaveAttribute("data-look", /.+/);
  const words = await hero.locator("text").allTextContents();
  // A template on the canvas: Paper too, and nothing asked for.
  await page.goto("./#/templates");
  await page.locator(".template-row").first().tap();
  await expect(page.locator(".react-flow__node").first()).toBeVisible();
  await expect(page.locator("main.stage")).not.toHaveAttribute("data-look", /.+/);
  await page.waitForTimeout(300);
  expect(asked).toEqual([]);

  await page.goto("./#/about");
  const header = page.locator("header.site-header");
  await header.getByRole("button", { name: "Theme: Grooph" }).tap();
  // Two sets in the one menu: the site's look, as it was, and the pictures' theme.
  await expect(header.getByRole("group", { name: "Site" }).getByRole("menuitemradio")).toHaveCount(2);
  const pictures = header.getByRole("group", { name: "Pictures" });
  await expect(pictures.getByRole("menuitemradio")).toHaveText(["Paper", "Blueprint", "Ink", "Phosphor", "Transit", "Chalk"]);
  await expect(pictures.getByRole("menuitemradio", { name: "Paper" })).toHaveAttribute("aria-checked", "true");
  await pictures.getByRole("menuitemradio", { name: "Blueprint" }).tap();
  await expect(hero).toHaveAttribute("data-look", "blueprint");
  await expect(header.getByRole("menu")).toBeHidden();
  expect(asked).toHaveLength(1);
  // The same words, in the same order: a theme changes how the picture looks, never what it says.
  expect(await hero.locator("text").allTextContents()).toEqual(words);
  // The site's look is another choice, and was not touched.
  await expect(page.locator("html")).not.toHaveAttribute("data-theme", /.+/);

  // Kept in this browser: the next visit asks for the piece itself and draws the picture in the theme.
  await page.reload();
  await expect(hero).toHaveAttribute("data-look", "blueprint");
  await header.getByRole("button", { name: "Theme: Grooph" }).tap();
  await expect(pictures.getByRole("menuitemradio", { name: "Blueprint" })).toHaveAttribute("aria-checked", "true");
  // The keyboard reaches the pictures' set from the site's: the arrows run through both.
  await page.keyboard.press("End");
  await expect(pictures.getByRole("menuitemradio", { name: "Chalk" })).toBeFocused();
  await page.keyboard.press("ArrowDown");
  await expect(header.getByRole("menuitemradio", { name: "Grooph" })).toBeFocused();
  // The site's look and the pictures' theme work together: Meteor, and the picture is still Blueprint.
  await header.getByRole("menuitemradio", { name: "Meteor" }).tap();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "meteor");
  await expect(hero).toHaveAttribute("data-look", "blueprint");
  // Back to Paper: the picture carries nothing of a theme again.
  await header.getByRole("button", { name: "Theme: Meteor" }).tap();
  await pictures.getByRole("menuitemradio", { name: "Paper" }).tap();
  await expect(hero).not.toHaveAttribute("data-look", /.+/);
  expect(await page.evaluate(() => localStorage.getItem("groophPicture"))).toBe("paper");
});

test("on the canvas the switch sits in the stage's corner; the canvas takes the theme's values, and Paper is the canvas as it was", async ({ page }) => {
  await page.goto(linkFor(reviewLoop()));
  const stage = page.locator("main.stage");
  const card = node(page, "builder").locator(".gnode");
  await expect(card).toBeVisible();
  const look = (el: Locator) =>
    el.evaluate((n) => {
      const s = getComputedStyle(n);
      const kind = getComputedStyle(n.querySelector(".gnode-kind")!);
      return { radius: s.borderRadius, ground: s.backgroundColor, face: s.fontFamily.split(",")[0]!.replaceAll('"', ""), caps: kind.textTransform, edge: getComputedStyle(document.querySelector(".gedge-line")!).strokeWidth };
    });
  const paper = await look(card);
  expect(paper).toMatchObject({ radius: "10px", caps: "none" });

  const toggle = stage.getByRole("button", { name: "Picture theme: Paper" });
  await expect(toggle).toBeVisible();
  // It is a target a thumb can hit, inside the stage, in the corner the loops' legend keeps clear.
  const [box, room, legend] = [(await toggle.boundingBox())!, (await stage.boundingBox())!, (await page.locator(".loop-legend").boundingBox())!];
  expect(box.width).toBeGreaterThanOrEqual(36);
  expect(box.height).toBeGreaterThanOrEqual(44);
  expect(box.x + box.width).toBeLessThanOrEqual(room.x + room.width);
  expect(box.x).toBeGreaterThanOrEqual(legend.x + legend.width);
  // Closed, its list is not there to be seen or tapped.
  await expect(stage.getByRole("menu")).toBeHidden();

  await toggle.tap();
  await expect(stage.getByRole("menuitemradio")).toHaveText(["Paper", "Blueprint", "Ink", "Phosphor", "Transit", "Chalk"]);
  await stage.getByRole("menuitemradio", { name: "Ink" }).tap();
  await expect(stage).toHaveAttribute("data-look", "ink");
  await expect(stage.getByRole("menu")).toBeHidden();
  await expect(stage.getByRole("button", { name: "Picture theme: Ink" })).toBeFocused();
  // Ink's values on the canvas: its corners, its serif face, capitals for a node's kind, one ink on white.
  const ink = await look(card);
  expect(ink).toMatchObject({ radius: "2px", ground: "rgb(255, 255, 255)", face: "Georgia", caps: "uppercase", edge: "1.1px" });
  // With one ink a gate is told by its heavier outline, here as in the picture.
  const outline = (id: string) => node(page, id).locator(".gnode").evaluate((n) => parseFloat(getComputedStyle(n).borderTopWidth));
  expect(await outline("merge-gate")).toBeGreaterThan((await outline("builder")) * 2);
  // The screen around the canvas keeps the site's look: only the canvas and the loops' legend take the theme.
  expect(await page.locator("header.topbar").evaluate((n) => getComputedStyle(n).fontFamily)).not.toContain("Georgia");

  // The keyboard: the arrows open it on what is chosen and move, Enter chooses, Escape closes and gives focus back.
  await page.keyboard.press("ArrowDown");
  await expect(stage.getByRole("menuitemradio", { name: "Ink" })).toBeFocused();
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
  await expect(stage).toHaveAttribute("data-look", "transit");
  expect(await look(card)).toMatchObject({ radius: "22px", caps: "uppercase", edge: "4.5px" });
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Escape");
  await expect(stage.getByRole("menu")).toBeHidden();
  await expect(stage.getByRole("button", { name: "Picture theme: Transit" })).toBeFocused();

  // Paper again: the stage says nothing of a theme, and the canvas is drawn exactly as before.
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Home");
  await page.keyboard.press("Enter");
  await expect(stage).not.toHaveAttribute("data-look", /.+/);
  expect(await look(card)).toEqual(paper);
});

test("a share link may name a theme in its address: it is shown and not kept, a choice made there is, and an unknown name is today's picture", async ({ page }) => {
  const asked = fetches(page);
  await page.goto(`${linkFor(reviewLoop())}&theme=transit`);
  const stage = page.locator("main.stage");
  await expect(stage).toHaveAttribute("data-look", "transit");
  await expect(stage.getByRole("button", { name: "Picture theme: Transit" })).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem("groophPicture"))).toBeNull();
  // Choosing another takes the name out of the address, so the choice is not undone by the next load.
  await stage.getByRole("button", { name: "Picture theme: Transit" }).tap();
  await stage.getByRole("menuitemradio", { name: "Chalk" }).tap();
  await expect(stage).toHaveAttribute("data-look", "chalk");
  expect(page.url()).not.toContain("theme=");
  expect(page.url()).toContain("#/open?d=");
  expect(await page.evaluate(() => localStorage.getItem("groophPicture"))).toBe("chalk");
  await page.reload();
  await expect(stage).toHaveAttribute("data-look", "chalk");
  expect(asked.length).toBeGreaterThan(0);

  // A name that is none of the six is Paper: not an error, and not this browser's own choice either.
  asked.length = 0;
  await page.goto(`${linkFor(reviewLoop())}&theme=sepia`);
  await page.reload();
  await expect(node(page, "builder")).toBeVisible();
  await expect(stage).not.toHaveAttribute("data-look", /.+/);
  await expect(stage.getByRole("button", { name: "Picture theme: Paper" })).toBeVisible();
  await page.waitForTimeout(300);
  expect(asked).toEqual([]);
});

test("an embed draws the theme its address names, with the theme's ground and bars; without one it is Paper, whatever this browser chose", async ({ page }) => {
  const asked = fetches(page);
  const d = payload(reviewLoop());
  await page.goto(`./#/embed?d=${d}&theme=chalk-dark`);
  const svg = page.locator(".gx-canvas svg.grooph-picture");
  await expect(svg).toHaveAttribute("data-look", "chalk");
  await expect(svg).toHaveAttribute("data-theme", "dark");
  expect(asked).toHaveLength(1);
  const frame = page.locator(".gx");
  await expect(frame).toHaveAttribute("data-look", "chalk");
  // A theme's words are colored for its own ground, so the frame brings that ground: Chalk's board, in dark.
  const chalk = pictureLook("chalk")!;
  const rgb = (hex: string) => `rgb(${[1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)).join(", ")})`;
  expect(await frame.evaluate((n) => getComputedStyle(n).backgroundColor)).toBe(rgb(chalk.dark.bg));
  expect(await page.getByRole("link", { name: /Open in grooph/ }).evaluate((n) => getComputedStyle(n).color)).toBe(rgb(chalk.dark.ink));
  // A node still opens its brief, by the same name as in Paper.
  await page.getByRole("button", { name: "Agent Builder" }).click();
  await expect(page.getByRole("heading", { name: "Builder" })).toBeVisible();

  // Light or dark alone is an embed's own, as before: no theme, nothing fetched.
  asked.length = 0;
  await page.goto(`./#/embed?d=${d}&theme=dark`);
  await page.reload();
  await expect(svg).toHaveAttribute("data-theme", "dark");
  await expect(svg).not.toHaveAttribute("data-look", /.+/);
  // Somebody else's page does not take this browser's choice.
  await page.evaluate(() => localStorage.setItem("groophPicture", "ink"));
  await page.goto(`./#/embed?d=${d}`);
  await page.reload();
  await expect(svg).toBeVisible();
  await expect(svg).not.toHaveAttribute("data-look", /.+/);
  await expect(frame).not.toHaveAttribute("data-look", /.+/);
  await page.waitForTimeout(300);
  expect(asked).toEqual([]);
});

test("Keep a copy keeps the picture and the offline page in the theme, as core draws them, and offers the choice", async ({ page }) => {
  await importDocument(page, "review-loop.grooph.json", readFileSync(fixturePath, "utf8"));
  await page.getByRole("button", { name: "Export", exact: true }).tap();
  const keepCopy = sheet(page).getByRole("group", { name: "Keep a copy" });
  const theme = keepCopy.getByLabel("Picture theme");
  await expect(theme).toHaveValue("paper");
  await theme.selectOption("phosphor");
  await expect(page.locator("main.stage")).toHaveAttribute("data-look", "phosphor");
  const look = pictureLook("phosphor")!;

  let [file] = await Promise.all([page.waitForEvent("download"), keepCopy.getByRole("button", { name: "Picture (SVG)" }).tap()]);
  expect(file.suggestedFilename()).toBe("review-loop.phosphor-light.svg");
  expect(await downloadText(file)).toBe(picture(reviewLoop(), { theme: "light", look }));
  [file] = await Promise.all([page.waitForEvent("download"), keepCopy.getByRole("button", { name: "Offline page (.html)" }).tap()]);
  expect(await downloadText(file)).toBe(offlinePage(reviewLoop(), { version: "0.3.0", look }));
  // The browser draws the PNG from that SVG, with every rule of the theme.
  [file] = await Promise.all([page.waitForEvent("download"), keepCopy.getByRole("button", { name: "Picture (PNG)" }).tap()]);
  expect(file.suggestedFilename()).toBe("review-loop.phosphor-light.png");

  // Paper again, and the files are the ones kept before there were themes.
  await theme.selectOption("paper");
  [file] = await Promise.all([page.waitForEvent("download"), keepCopy.getByRole("button", { name: "Picture (SVG)" }).tap()]);
  expect(file.suggestedFilename()).toBe("review-loop.light.svg");
  expect(await downloadText(file)).toBe(readFileSync(join(repoRoot, "fixtures/pictures/review-loop.light.svg"), "utf8"));
});

test("in every theme, with the site's own faces, no line of words runs past its card: the front page's picture and a map", async ({ browser }) => {
  for (const name of FIVE) {
    const context = await browser.newContext({ viewport: { width: 400, height: 800 }, serviceWorkers: "block" });
    const page = await context.newPage();
    await keep(page, name);
    await page.goto("./#/about");
    const hero = page.locator(".land-picture svg");
    await expect(hero).toHaveAttribute("data-look", name);
    await page.evaluate(() => document.fonts.ready);
    expect(await pastItsBox(hero), `${name}, the front page's picture`).toEqual({ over: 0, words: "" });

    await page.goto(`./#/open?d=${payload(map())}`);
    const picture = page.locator('.map-picture svg[data-picture="map"]');
    await expect(picture).toHaveAttribute("data-look", name);
    await page.evaluate(() => document.fonts.ready);
    expect(await pastItsBox(picture), `${name}, a map`).toEqual({ over: 0, words: "" });
    // Every session and handoff is there, under the name it has in Paper.
    await expect(page.locator("[data-session]")).toHaveCount(map().sessions.length);
    await expect(page.getByRole("button", { name: "Session Operator", exact: true })).toBeVisible();
    await context.close();
  }
});

test("pictures of different themes inline in one page each keep their own colors, in light and in dark, held to one or following the device", async ({ page }) => {
  // A picture's style is in the picture, and inline in a page a style reaches the whole page: a Paper picture's rule
  // for dark must not recolor a themed one beside it, whichever comes first, and no theme's rule may reach Paper.
  const doc = reviewLoop();
  const names = ["phosphor", "paper", "blueprint", "paper", "ink"];
  const rgb = (hex: string) => `rgb(${[1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)).join(", ")})`;
  const PAPER = { light: "#f1f4f3", dark: "#111514" };
  const ground = (name: string, form: "light" | "dark") => rgb(name === "paper" ? PAPER[form] : pictureLook(name)![form].bg);
  for (const held of [undefined, "light", "dark"] as const) {
    const svgs = names.map((name) => {
      const look = pictureLook(name);
      const svg = picture(doc, look ? { look } : {});
      return held ? svg.replace('class="grooph-picture"', `class="grooph-picture" data-theme="${held}"`) : svg;
    });
    await page.setContent(`<!doctype html><meta charset="utf-8"><body>${svgs.join("")}</body>`);
    for (const device of ["light", "dark"] as const) {
      await page.emulateMedia({ colorScheme: device });
      const form = held ?? device;
      const grounds = await page.locator("svg.grooph-picture").evaluateAll((all) => all.map((svg) => getComputedStyle(svg.querySelector("rect")!).fill));
      expect(grounds, `held to ${held ?? "nothing"}, on a ${device} device`).toEqual(names.map((name) => ground(name, form)));
      // And a card's outline is each theme's own weight: Paper's is untouched by its neighbors' rules.
      const outlines = await page.locator("svg.grooph-picture").evaluateAll((all) => all.map((svg) => getComputedStyle(svg.querySelector("rect[data-card]")!).strokeWidth));
      expect(outlines).toEqual(["1px", "1px", "1.2px", "1px", "0.8px"]);
    }
  }
});

test("with the themes not to be had, the choice is kept and every picture stays Paper", async ({ page }) => {
  await page.route("**/assets/themes-*.js", (route) => route.abort());
  await page.goto("./#/about");
  const header = page.locator("header.site-header");
  const hero = page.locator(".land-picture svg");
  await header.getByRole("button", { name: "Theme: Grooph" }).tap();
  await header.getByRole("menuitemradio", { name: "Ink" }).tap();
  await page.waitForTimeout(400);
  await expect(hero).toBeVisible();
  await expect(hero).not.toHaveAttribute("data-look", /.+/);
  await header.getByRole("button", { name: "Theme: Grooph" }).tap();
  await expect(header.getByRole("menuitemradio", { name: "Ink" })).toHaveAttribute("aria-checked", "true");
  // The canvas too: it opens, in Paper.
  await page.goto(linkFor(reviewLoop()));
  await expect(node(page, "builder")).toBeVisible();
  await expect(page.locator("main.stage")).not.toHaveAttribute("data-look", /.+/);
});

test.describe("with the service worker running", () => {
  test.use({ serviceWorkers: "allow" });

  test("a first visit in Paper asks for no theme itself, and afterwards a theme can be chosen with no network", async ({ page, context }) => {
    const asked = fetches(page);
    await page.goto("./");
    await expect(page.locator(".land-headline")).toBeVisible();
    await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
    // The page names the themes' file in a list the browser does nothing with; the worker reads it and keeps the file.
    await expect.poll(() => page.evaluate(async () => (await (await caches.open("grooph-app-v1")).keys()).filter((r) => /\/assets\/themes-[^/]*\.js$/.test(r.url)).length)).toBe(1);
    expect(asked).toEqual([]);

    await context.setOffline(true);
    const failed: string[] = [];
    page.on("requestfailed", (r) => failed.push(r.url()));
    const header = page.locator("header.site-header");
    await header.getByRole("button", { name: "Theme: Grooph" }).tap();
    await header.getByRole("menuitemradio", { name: "Transit" }).tap();
    await expect(page.locator(".land-picture svg")).toHaveAttribute("data-look", "transit");
    // And a graph opened from a link, still with no network, is on a canvas in the theme.
    await page.goto(linkFor(reviewLoop()));
    await expect(page.locator("main.stage")).toHaveAttribute("data-look", "transit");
    expect(failed).toEqual([]);
  });
});
