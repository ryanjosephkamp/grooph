import { readFileSync } from "node:fs";
import { join } from "node:path";
import { deflateRawSync } from "node:zlib";

import { buildRunBundle, buildShareEnvelope, encodeSharePayload, mapKit, mapPicture, offlineKit, parseGraphText, parseMapText, picture, type Graph, type OperationMap, type RunBundle } from "@grooph/core";
import { offlinePageWith } from "@grooph/core/offline";
import { mapSequenceWith, mapWideWith } from "@grooph/core/map-views";
import { PICTURE_THEMES, THEME_VALUES, themed, themedPage } from "@grooph/core/themes";
import { pictureWithUnits } from "@grooph/core/units";
import { expect, test, type Locator, type Page } from "@playwright/test";

import { unitsKit } from "../../../packages/core/src/picture/units-kit.js";
import { canvasIsQuiet, downloadText, fixturePath, importDocument, linkFor, node, repoRoot, requestsOut, reviewLoop, runBundle, sheet, visitIsOver } from "./support.js";

// The version the app writes into a page it saves, from the one place the app keeps it (scripts/version.mjs writes
// it there on a release). e2e/keep.spec.ts holds that place to the released version by its own literal.
import { APP_VERSION } from "../src/doc/keep.js";

/** The offline page as core makes it: the maker, handed core's parts, as the app calls it (it is a piece fetched on demand). */
const offlinePage = (doc: Graph, options: { version: string }): string => offlinePageWith(offlineKit, doc, options);

/**
 * The picture's themes in the app (handoff 0086; docs/themes.md): six looks for the same picture. Paper is the
 * default and costs an address nothing: the other five, the list of them and every way a screen takes a theme
 * are one piece, fetched when a theme was kept or is named in an address, or when a control that offers the themes
 * is pressed. The choice is offered in the header's theme menu, on the canvas and in Keep a copy, is kept in this
 * browser, and is separate from the site's look and from light and dark.
 */
const FIVE = PICTURE_THEMES.filter((name) => name !== "paper");
const mapAt = (name: string): OperationMap => parseMapText(readFileSync(join(repoRoot, "fixtures/maps/valid", `${name}.grooph-map.json`), "utf8")).map!;
const map = (): OperationMap => mapAt("owner-operation-2026-09-30");
const graphAt = (path: string): Graph => parseGraphText(readFileSync(join(repoRoot, path), "utf8")).doc!;
const rgb = (hex: string): string => `rgb(${[1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)).join(", ")})`;
const payload = (doc: Parameters<typeof buildShareEnvelope>[0]): string => encodeSharePayload(buildShareEnvelope(doc), (bytes) => deflateRawSync(bytes, { level: 9 }));

/** The proving run of the heterogeneous-critic template: it fails round 0, passes its bar in round 1, and halts at the gate. */
function provingRun(): RunBundle {
  const dir = join(repoRoot, "experiments/patterns/heterogeneous-critic/run");
  const graph = (path: string): Graph => parseGraphText(readFileSync(path, "utf8")).doc!;
  return buildRunBundle({
    source: graph(join(dir, "package/graph.grooph.json")),
    working: graph(join(dir, "runs/20260920-192538/graph.grooph.json")),
    notesText: readFileSync(join(dir, "runs/20260920-192538/notes.jsonl"), "utf8"),
  });
}

/** The requests a page makes for the themes' piece. */
function fetches(page: Page): string[] {
  const asked: string[] = [];
  page.on("request", (r) => (/\/assets\/themes-[^/]*\.js$/.test(new URL(r.url()).pathname) ? asked.push(r.url()) : undefined));
  return asked;
}

/** Whether two boxes on the page share no pixel. */
const apart = (a: { x: number; y: number; width: number; height: number }, b: typeof a): boolean => a.x + a.width <= b.x || b.x + b.width <= a.x || a.y + a.height <= b.y || b.y + b.height <= a.y;
/** A canvas's own last fetch is in before the page is left or loaded again (`canvasIsQuiet`), then the reload. */
const again = async (page: Page): Promise<void> => {
  await canvasIsQuiet(page);
  await page.reload();
};

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


/** The list of six the piece opens at a control: a menu named for what it chooses. */
const list = (scope: Page | Locator): Locator => scope.getByRole("menu", { name: "Picture theme" });
const colorsOf = (name: (typeof FIVE)[number]) => THEME_VALUES[name];
/** Whether anything in the page is in a theme. */
const dressed = (page: Page): Promise<number> => page.locator("[data-look]").count();

test("an address in Paper runs nothing of the themes; the header's menu has one entry for them, which fetches the six, draws the page's picture in the one chosen, and keeps the choice", async ({ page }) => {
  const asked = fetches(page);
  await page.goto("./");
  const hero = page.locator(".land-picture svg");
  await expect(hero).toBeVisible();
  const words = await hero.locator("text").allTextContents();
  const paper = await hero.evaluate((svg) => svg.outerHTML);
  // A template on the canvas: Paper too, and nothing asked for. The canvas offers the themes as a dot, and that is all.
  await page.goto("./#/templates");
  await page.locator(".template-row").first().tap();
  await expect(page.locator(".react-flow__node").first()).toBeVisible();
  await expect(page.locator("main.stage").getByRole("button", { name: "Picture theme" })).toBeVisible();
  await page.waitForTimeout(300);
  expect(asked).toEqual([]);
  expect(await dressed(page)).toBe(0);
  expect(await page.locator("style").evaluateAll((sheets) => sheets.filter((s) => (s.textContent ?? "").includes("data-look")).length)).toBe(0);

  await page.goto("./#/about");
  const header = page.locator("header.site-header");
  await header.getByRole("button", { name: "Theme: Grooph" }).tap();
  // The site's looks, as they were, and one entry more.
  await expect(header.getByRole("menuitemradio")).toHaveCount(2);
  const entry = header.getByRole("menuitem", { name: "Picture theme" });
  await expect(entry).toBeVisible();
  // The arrows reach it from the site's looks.
  await page.keyboard.press("End");
  await expect(entry).toBeFocused();
  await page.keyboard.press("Enter");
  // The piece is fetched, once, and its list of six takes the menu's place, on the one in effect.
  const six = list(header);
  await expect(six.getByRole("menuitemradio")).toHaveText(["Paper", "Blueprint", "Ink", "Phosphor", "Transit", "Chalk"]);
  await expect(header.getByRole("menu", { name: "Theme", exact: true })).toBeHidden();
  await expect(six.getByRole("menuitemradio", { name: "Paper" })).toBeFocused();
  await expect(six.getByRole("menuitemradio", { name: "Paper" })).toHaveAttribute("aria-checked", "true");
  expect(asked).toHaveLength(1);
  // Still Paper: fetching the themes changed nothing that was drawn.
  expect(await hero.evaluate((svg) => svg.outerHTML)).toBe(paper);
  await six.getByRole("menuitemradio", { name: "Blueprint" }).tap();
  await expect(hero).toHaveAttribute("data-look", "blueprint");
  await expect(six).toHaveCount(0);
  await expect(header.getByRole("button", { name: "Theme: Grooph" })).toBeFocused();
  expect(asked).toHaveLength(1);
  // The same words, in the same order: a theme changes how the picture looks, never what it says.
  expect(await hero.locator("text").allTextContents()).toEqual(words);
  // The ground is Blueprint's, drawn in the picture, and the site's look is another choice, untouched.
  expect(await hero.locator("rect").first().evaluate((r) => getComputedStyle(r).fill)).toBe(rgb(colorsOf("blueprint").light.bg));
  await expect(hero.locator("pattern")).toHaveCount(1);
  await expect(page.locator("html")).not.toHaveAttribute("data-theme", /.+/);

  // Kept in this browser: the next visit fetches the piece itself and draws the picture in the theme.
  await page.reload();
  await expect(hero).toHaveAttribute("data-look", "blueprint");
  await header.getByRole("button", { name: "Theme: Grooph" }).tap();
  // The entry says which theme is in effect, and the list opens on it. The arrows run through the six and around.
  await expect(entry).toHaveAttribute("data-now", "Blueprint");
  await entry.tap();
  await expect(six.getByRole("menuitemradio", { name: "Blueprint" })).toBeFocused();
  await page.keyboard.press("End");
  await expect(six.getByRole("menuitemradio", { name: "Chalk" })).toBeFocused();
  await page.keyboard.press("ArrowDown");
  await expect(six.getByRole("menuitemradio", { name: "Paper" })).toBeFocused();
  // Escape closes it and gives the keyboard back to the header's button; nothing was chosen.
  await page.keyboard.press("Escape");
  await expect(six).toHaveCount(0);
  await expect(header.getByRole("button", { name: "Theme: Grooph" })).toBeFocused();
  await expect(hero).toHaveAttribute("data-look", "blueprint");
  // The site's look and the pictures' theme work together: Meteor, and the picture is still Blueprint.
  await page.keyboard.press("Enter");
  await header.getByRole("menuitemradio", { name: "Meteor" }).tap();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "meteor");
  await expect(hero).toHaveAttribute("data-look", "blueprint");
  // Back to Paper: the picture is the very markup it was before there was a theme.
  await header.getByRole("button", { name: "Theme: Meteor" }).tap();
  await entry.tap();
  await six.getByRole("menuitemradio", { name: "Paper" }).tap();
  await expect(hero).not.toHaveAttribute("data-look", /.+/);
  expect(await hero.evaluate((svg) => svg.outerHTML)).toBe(paper);
  expect(await page.evaluate(() => localStorage.getItem("groophPicture"))).toBe("paper");
});

test("the header's entry pressed before the rest of the app has arrived is answered when it does", async ({ page }) => {
  // What listens for the press comes with the canvas's screens, a moment after the front page. Held back here.
  let arrive: () => void = () => undefined;
  const held = new Promise<void>((done) => (arrive = done));
  await page.route("**/assets/screens-*.js", async (route) => {
    await held;
    await route.continue();
  });
  await page.goto("./#/about");
  const header = page.locator("header.site-header");
  await header.getByRole("button", { name: "Theme: Grooph" }).tap();
  await header.getByRole("menuitem", { name: "Picture theme" }).tap();
  await page.waitForTimeout(300);
  await expect(list(header)).toHaveCount(0);
  arrive();
  await expect(list(header).getByRole("menuitemradio")).toHaveCount(6);
  await list(header).getByRole("menuitemradio", { name: "Chalk" }).tap();
  await expect(page.locator(".land-picture svg")).toHaveAttribute("data-look", "chalk");
});

test("on the canvas the themes are a dot in the stage's corner; the canvas takes the theme's values, and Paper is the canvas as it was", async ({ page }) => {
  const asked = fetches(page);
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

  const toggle = stage.getByRole("button", { name: /^Picture theme/ });
  await expect(toggle).toBeVisible();
  // It is a target a thumb can hit, inside the stage, in its top right corner: under the switch of the graph's
  // views, which has the corner itself, and clear of the loops' legend.
  await canvasIsQuiet(page);
  const views = page.getByRole("radiogroup", { name: "View of the graph" });
  const [box, room, legend, above] = [(await toggle.boundingBox())!, (await stage.boundingBox())!, (await page.locator(".loop-legend").boundingBox())!, (await views.boundingBox())!];
  expect(box.width).toBeGreaterThanOrEqual(36);
  expect(box.height).toBeGreaterThanOrEqual(44);
  expect(box.x + box.width).toBeLessThanOrEqual(room.x + room.width);
  expect(apart(box, legend), "the dot and the loops' legend").toBe(true);
  expect(apart(box, above), "the dot and the switch of the graph's views").toBe(true);
  expect(box.y).toBeGreaterThanOrEqual(above.y + above.height);
  expect(asked).toEqual([]);

  await toggle.tap();
  await expect(list(stage).getByRole("menuitemradio")).toHaveText(["Paper", "Blueprint", "Ink", "Phosphor", "Transit", "Chalk"]);
  expect(asked).toHaveLength(1);
  // The dot says its list is open, and a second press on it closes the list: it does not close and open again.
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
  await toggle.tap();
  await expect(list(stage)).toHaveCount(0);
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await page.waitForTimeout(200);
  await expect(list(stage)).toHaveCount(0);
  await toggle.tap();
  await list(stage).getByRole("menuitemradio", { name: "Ink" }).tap();
  await expect(stage).toHaveAttribute("data-look", "ink");
  await expect(list(stage)).toHaveCount(0);
  // The dot says the theme in its name, and has the keyboard again.
  await expect(stage.getByRole("button", { name: "Picture theme: Ink" })).toBeFocused();
  // Ink's values on the canvas: its corners, its serif face, capitals for a node's kind, one ink on white.
  const ink = await look(card);
  expect(ink).toMatchObject({ radius: "2px", ground: "rgb(255, 255, 255)", face: "Georgia", caps: "uppercase", edge: "1.1px" });
  // With one ink a gate is told by its heavier outline, here as in the picture.
  const outline = (id: string) => node(page, id).locator(".gnode").evaluate((n) => parseFloat(getComputedStyle(n).borderTopWidth));
  expect(await outline("merge-gate")).toBeGreaterThan((await outline("builder")) * 2);
  // The screen around the canvas keeps the site's look: only the canvas and the loops' legend take the theme.
  expect(await page.locator("header.topbar").evaluate((n) => getComputedStyle(n).fontFamily)).not.toContain("Georgia");

  // The keyboard: Enter opens the list on what is chosen, the arrows move, Enter chooses, Escape closes and gives focus back.
  await page.keyboard.press("Enter");
  await expect(list(stage).getByRole("menuitemradio", { name: "Ink" })).toBeFocused();
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
  await expect(stage).toHaveAttribute("data-look", "transit");
  expect(await look(card)).toMatchObject({ radius: "22px", caps: "uppercase", edge: "4.5px" });
  await page.keyboard.press("Enter");
  await expect(list(stage)).toHaveCount(1);
  await page.keyboard.press("Escape");
  await expect(list(stage)).toHaveCount(0);
  await expect(stage.getByRole("button", { name: "Picture theme: Transit" })).toBeFocused();
  // A press anywhere else closes it too.
  await page.keyboard.press("Enter");
  await expect(list(stage)).toHaveCount(1);
  await page.locator("header.topbar .title-name").tap();
  await expect(list(stage)).toHaveCount(0);
  await page.getByRole("button", { name: "Close panel" }).tap();

  // Paper again: the stage says nothing of a theme, and the canvas is drawn exactly as before.
  await stage.getByRole("button", { name: "Picture theme: Transit" }).tap();
  await list(stage).getByRole("menuitemradio", { name: "Paper" }).tap();
  await expect(stage).not.toHaveAttribute("data-look", /.+/);
  expect(await look(card)).toEqual(paper);
  expect(asked).toHaveLength(1);
});

test("a share link may name a theme in its address: it is shown and not kept, a choice made there is, and an unknown name is today's picture", async ({ page }) => {
  const asked = fetches(page);
  await page.goto(`${linkFor(reviewLoop())}&theme=transit`);
  const stage = page.locator("main.stage");
  await expect(stage).toHaveAttribute("data-look", "transit");
  await expect(stage.getByRole("button", { name: "Picture theme: Transit" })).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem("groophPicture"))).toBeNull();
  // The theme is the address's: on to another screen of the app, with nothing kept, and it is Paper there.
  await page.goto("./#/templates/built-in/review-gate");
  await expect(page.locator(".title-name")).toHaveText("Review gate");
  await expect(stage).not.toHaveAttribute("data-look", /.+/);
  await page.goBack();
  await expect(stage).toHaveAttribute("data-look", "transit");
  // Choosing another takes the name out of the address, so the choice is not undone by the next load.
  await stage.getByRole("button", { name: "Picture theme: Transit" }).tap();
  await list(stage).getByRole("menuitemradio", { name: "Chalk" }).tap();
  await expect(stage).toHaveAttribute("data-look", "chalk");
  expect(page.url()).not.toContain("theme=");
  expect(page.url()).toContain("#/open?d=");
  expect(await page.evaluate(() => localStorage.getItem("groophPicture"))).toBe("chalk");
  await again(page);
  await expect(stage).toHaveAttribute("data-look", "chalk");
  expect(asked.length).toBeGreaterThan(0);

  // A name that is none of the six is Paper: not an error, and not this browser's own choice either, which is Chalk.
  await page.goto(`${linkFor(reviewLoop())}&theme=sepia`);
  await again(page);
  await expect(node(page, "builder")).toBeVisible();
  await expect(stage.getByRole("button", { name: "Picture theme: Paper" })).toBeVisible();
  await expect(stage).not.toHaveAttribute("data-look", /.+/);
  // With nothing kept, such an address fetches nothing of the themes at all.
  await page.evaluate(() => localStorage.removeItem("groophPicture"));
  asked.length = 0;
  await again(page);
  await expect(node(page, "builder")).toBeVisible();
  await page.waitForTimeout(300);
  expect(asked).toEqual([]);
  expect(await dressed(page)).toBe(0);
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
  const chalk = colorsOf("chalk");
  expect(await frame.evaluate((n) => getComputedStyle(n).backgroundColor)).toBe(rgb(chalk.dark.bg));
  expect(await page.getByRole("link", { name: /Open in grooph/ }).evaluate((n) => getComputedStyle(n).color)).toBe(rgb(chalk.dark.ink));
  // Chalk's wobble is in the picture, where its lines can find it.
  await expect(svg.locator("filter#gp-chalk")).toHaveCount(1);
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
  await page.waitForTimeout(300);
  await expect(svg).not.toHaveAttribute("data-look", /.+/);
  await expect(frame).not.toHaveAttribute("data-look", /.+/);
  expect(asked).toEqual([]);
});

test("while a run plays in Ink, which has one color, each state of a node is still told apart: in words on its card, and by dimming", async ({ page }) => {
  // With reduced motion a node is dimmed, or not, at once: nothing is read half-way through a fade.
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(`./#/embed?d=${payload(provingRun())}&theme=ink-light`);
  const svg = page.locator(".gx-canvas svg.grooph-picture");
  await expect(svg).toHaveAttribute("data-look", "ink");
  const slider = page.getByRole("slider", { name: "Replay position" });
  const steps = Number(await slider.getAttribute("max"));
  const seen = new Map<string, { words: string; dimmed: boolean; outline: string }>();
  for (let step = 0; step <= steps; step++) {
    await slider.fill(String(step));
    // Each step draws the picture's marks again; it is in Ink at every one.
    await expect(svg).toHaveAttribute("data-look", "ink");
    const nodes = await page.locator("g[data-node][data-state]").evaluateAll((all) =>
      all.map((g) => ({
        state: (g as SVGGElement).dataset["state"]!,
        words: g.querySelector(".gx-pill text")?.textContent ?? "",
        name: g.getAttribute("aria-label") ?? "",
        dimmed: Number(getComputedStyle(g).opacity) < 0.6,
        outline: getComputedStyle(g.querySelector("rect[data-card]")!).stroke,
      })),
    );
    for (const n of nodes) {
      // Not reached yet: dimmed, with no word. Reached: its state in a word on the card, and in its accessible name.
      if (n.state === "pending") expect(n).toMatchObject({ words: "", dimmed: true });
      else {
        expect(n.words.startsWith(n.state), `step ${step}: a ${n.state} node says "${n.words}"`).toBe(true);
        expect(n.name).toContain(n.state);
        expect(n.dimmed).toBe(false);
      }
      seen.set(n.state, n);
    }
  }
  // The run shows every state, and in Ink every one of them is outlined in the same ink: color says nothing here.
  expect([...seen.keys()].sort()).toEqual(["failed", "halted", "passed", "pending", "running"]);
  expect(new Set([...seen.values()].map((n) => n.outline))).toEqual(new Set(["rgb(0, 0, 0)"]));
});

test("Keep a copy offers the themes, and keeps the picture and the offline page in the one in effect, as core makes them", async ({ page }) => {
  await importDocument(page, "review-loop.grooph.json", readFileSync(fixturePath, "utf8"));
  await page.getByRole("button", { name: "Export", exact: true }).tap();
  const keepCopy = sheet(page).getByRole("group", { name: "Keep a copy" });
  await keepCopy.getByRole("button", { name: /^Picture theme/ }).tap();
  await list(keepCopy).getByRole("menuitemradio", { name: "Phosphor" }).tap();
  await expect(page.locator("main.stage")).toHaveAttribute("data-look", "phosphor");
  // The button says the theme after its name.
  await expect(keepCopy.locator("[data-pictures]")).toHaveAttribute("data-now", "Phosphor");

  let [file] = await Promise.all([page.waitForEvent("download"), keepCopy.getByRole("button", { name: "Picture (SVG)" }).tap()]);
  expect(file.suggestedFilename()).toBe("review-loop.phosphor-light.svg");
  expect(await downloadText(file)).toBe(themed(picture(reviewLoop()), "phosphor", "light"));
  [file] = await Promise.all([page.waitForEvent("download"), keepCopy.getByRole("button", { name: "Offline page (.html)" }).tap()]);
  expect(await downloadText(file)).toBe(themedPage(offlinePage(reviewLoop(), { version: APP_VERSION }), "phosphor"));
  // The browser draws the PNG from that SVG, with every rule of the theme.
  [file] = await Promise.all([page.waitForEvent("download"), keepCopy.getByRole("button", { name: "Picture (PNG)" }).tap()]);
  expect(file.suggestedFilename()).toBe("review-loop.phosphor-light.png");

  // Paper again, and the files are the ones kept before there were themes.
  await keepCopy.getByRole("button", { name: /^Picture theme/ }).tap();
  await list(keepCopy).getByRole("menuitemradio", { name: "Paper" }).tap();
  [file] = await Promise.all([page.waitForEvent("download"), keepCopy.getByRole("button", { name: "Picture (SVG)" }).tap()]);
  expect(file.suggestedFilename()).toBe("review-loop.light.svg");
  expect(await downloadText(file)).toBe(readFileSync(join(repoRoot, "fixtures/pictures/review-loop.light.svg"), "utf8"));
});

test("in every theme, with the site's own faces, no line of words runs past its card: the front page's picture, a map in its three views, and lines that fill their room", async ({ browser }) => {
  // A graph whose lines fill their room: a gate's question is two full lines of ordinary words, and a fixed-width
  // face sets such a line wider than the face it was laid out for.
  const full = reviewLoop();
  const gate = full.nodes.find((n) => n.kind === "human-gate")!;
  if (gate.kind === "human-gate") {
    delete gate.options;
    gate.prompt = "Write one line per item, citing the file and line that satisfies it or saying it is unmet; then list what is still left for the builder.";
  }
  const long = mapAt("owner-operation-2026-10-01-with-ryan");
  for (const name of FIVE) {
    const context = await browser.newContext({ viewport: { width: 400, height: 800 }, serviceWorkers: "block" });
    const page = await context.newPage();
    await keep(page, name);
    await page.goto("./#/about");
    const hero = page.locator(".land-picture svg");
    await expect(hero).toHaveAttribute("data-look", name);
    await page.evaluate(() => document.fonts.ready);
    expect(await pastItsBox(hero), `${name}, the front page's picture`).toEqual({ over: 0, words: "" });

    // More pictures, drawn by core in Paper and set into the same page, where the site's faces are: the piece
    // dresses them as it does anything a screen draws. The full lines, and the long map in its three views.
    const boxed = graphAt("fixtures/valid/subgrooph-in-a-graph.grooph.json");
    const more: [string, string][] = [
      ["a graph with full lines", picture(full)],
      ["a subgrooph, closed: one box", pictureWithUnits(unitsKit, boxed)],
      ["a subgrooph, open: a frame around its cards", pictureWithUnits(unitsKit, boxed, { open: "all" })],
      ["the long map, the phone's picture", mapPicture(long)],
      ["the long map, lanes side by side", mapWideWith(mapKit, long, {})],
      ["the long map, as a sequence", mapSequenceWith(mapKit, long, {})],
    ];
    await page.evaluate((svgs) => {
      const holder = document.createElement("div");
      holder.id = "more-pictures";
      holder.innerHTML = svgs.join("");
      document.body.append(holder);
    }, more.map(([, svg]) => svg));
    for (const [k, [what]] of more.entries()) {
      const drawn = page.locator("#more-pictures > svg").nth(k);
      await expect(drawn, `${name}, ${what}: drawn after the piece, and dressed as it arrived`).toHaveAttribute("data-look", name);
      await page.evaluate(() => document.fonts.ready);
      expect(await pastItsBox(drawn), `${name}, ${what}`).toEqual({ over: 0, words: "" });
    }

    await page.goto(`./#/open?d=${payload(map())}`);
    const shown = page.locator('.map-picture svg[data-picture="map"]');
    await expect(shown).toHaveAttribute("data-look", name);
    await page.evaluate(() => document.fonts.ready);
    expect(await pastItsBox(shown), `${name}, a map`).toEqual({ over: 0, words: "" });
    // Every session and handoff is there, under the name it has in Paper, and the map's other view is dressed too.
    await expect(page.locator(".map-picture [data-session]")).toHaveCount(map().sessions.length);
    await expect(page.locator(".map-picture").getByRole("button", { name: "Session Operator", exact: true })).toBeVisible();
    await page.getByRole("radio", { name: "Sequence" }).tap();
    await expect(page.locator('.map-picture svg[data-picture="sequence"]')).toHaveAttribute("data-look", name);
    await context.close();
  }
});

test("a map drawn again, when the screen turns wide and its lanes go side by side, is in the theme as it arrives", async ({ page }) => {
  await keep(page, "blueprint");
  await page.goto(`./#/open?d=${payload(map())}`);
  const shown = page.locator('.map-picture svg[data-picture="map"]');
  await expect(shown).toHaveAttribute("data-look", "blueprint");
  const narrow = (await shown.getAttribute("viewBox"))!;
  await page.setViewportSize({ width: 1440, height: 900 });
  // Another picture altogether: wider than it is tall, and drawn by a piece of its own.
  await expect.poll(() => shown.getAttribute("viewBox")).not.toBe(narrow);
  await expect(shown).toHaveAttribute("data-look", "blueprint");
  // With its grid behind it, once.
  await expect(shown.locator("[data-of-look]")).toHaveCount(1);
  await page.setViewportSize({ width: 400, height: 800 });
  await expect.poll(() => shown.getAttribute("viewBox")).toBe(narrow);
  await expect(shown).toHaveAttribute("data-look", "blueprint");
});

test("a map in three dimensions is Paper in every theme, and whole; the flat views beside it are in the theme", async ({ page }) => {
  // The 3D view (handoff 0087) is built from the page's own elements, not drawn as one picture: no theme has rules
  // for it. It must not be half dressed, and going back to a flat view must find that view in the theme.
  await keep(page, "phosphor");
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto(`./#/open?d=${payload(map())}`);
  await expect(page.locator('.map-picture svg[data-picture="map"]')).toHaveAttribute("data-look", "phosphor");
  await page.getByRole("radio", { name: "3D" }).tap();
  const space = page.locator(".map-picture .space");
  await expect(space).toBeVisible();
  await expect(space).not.toHaveAttribute("data-look", /.+/);
  await expect(space.locator("[data-of-look]")).toHaveCount(0);
  // Paper's own colors, in light as the device is, and not the dark screen the flat picture has in this theme.
  const papers = /--gp-surface:(#[0-9a-f]+);[^}]*--gp-ink:(#[0-9a-f]+)/.exec(picture(reviewLoop()))!;
  const its = await space.locator(".space-card").first().evaluate((el) => [getComputedStyle(el).getPropertyValue("--gp-surface").trim(), getComputedStyle(el).getPropertyValue("--gp-ink").trim()]);
  expect(its).toEqual([papers[1], papers[2]]);
  await page.getByRole("radio", { name: "Picture" }).tap();
  await expect(page.locator('.map-picture svg[data-picture="map"]')).toHaveAttribute("data-look", "phosphor");
});

test("a graph in three dimensions is Paper in every theme, and whole; the dot steps aside there, and the canvas is in the theme again after", async ({ page }) => {
  // The 3D view of a loop graph (handoff 0092) is the map's, built from the page's own elements: no theme has rules
  // for it. It must not be half dressed inside a stage that is; and its own bar is where the dot would stand.
  await keep(page, "phosphor");
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto(linkFor(reviewLoop()));
  const stage = page.locator("main.stage");
  await expect(stage).toHaveAttribute("data-look", "phosphor");
  // The dot, by what it is and not by what it says: a name that changed must not read as a dot that hid.
  const dot = stage.locator("[data-pictures]");
  await expect(dot).toBeVisible();
  await expect(dot).toHaveAccessibleName("Picture theme: Phosphor");
  await canvasIsQuiet(page);
  await page.getByRole("radiogroup", { name: "View of the graph" }).getByRole("radio", { name: "3D" }).tap();
  const space = stage.locator(".graph-views .space");
  await expect(space).toBeVisible();
  // Nothing that holds the view says a theme while it is shown: not the stage, and not the frame around the scene.
  await expect(page.locator("main.stage[data-look], .map-picture[data-look]")).toHaveCount(0);
  await expect(space.locator("[data-of-look]")).toHaveCount(0);
  // Paper's own colors, in light as the device is: the cards, and the ground the whole view stands on.
  const papers = /--gp-bg:(#[0-9a-f]+);--gp-surface:(#[0-9a-f]+);[^}]*--gp-ink:(#[0-9a-f]+)/.exec(picture(reviewLoop()))!;
  const its = await space.locator(".space-card").first().evaluate((el) => [getComputedStyle(el).getPropertyValue("--gp-surface").trim(), getComputedStyle(el).getPropertyValue("--gp-ink").trim()]);
  expect(its).toEqual([papers[2], papers[3]]);
  // The words of its bar are dark on a light ground, as the site's are: not Phosphor's pale green.
  const bar = await space.locator(".space-bar span").first().evaluate((el) => {
    const lum = (rgb: string): number => {
      const probe = document.createElement("canvas").getContext("2d")!;
      probe.fillStyle = rgb;
      probe.fillRect(0, 0, 1, 1);
      const [r, g, b] = probe.getImageData(0, 0, 1, 1).data;
      return (0.2126 * r! + 0.7152 * g! + 0.0722 * b!) / 255;
    };
    let under: Element | null = el;
    let ground = "rgba(0, 0, 0, 0)";
    while (under && /rgba\(0, 0, 0, 0\)|transparent/.test(ground)) {
      ground = getComputedStyle(under).backgroundColor;
      under = under.parentElement;
    }
    return { words: lum(getComputedStyle(el).color), ground: lum(ground) };
  });
  expect(bar.words).toBeLessThan(0.5);
  expect(bar.ground).toBeGreaterThan(0.75);
  // The dot is not there: a theme changes nothing in this view.
  await expect(dot).toBeHidden();
  // Back to the picture: the canvas is in the theme again, and the dot is back under the switch, saying it.
  await page.getByRole("radiogroup", { name: "View of the graph" }).getByRole("radio", { name: "Picture" }).tap();
  await expect(stage).toHaveAttribute("data-look", "phosphor");
  await expect(dot).toBeVisible();
  await expect(dot).toHaveAccessibleName("Picture theme: Phosphor");
  const card = await node(page, "builder").locator(".gnode").evaluate((el) => getComputedStyle(el).borderRadius);
  expect(card).toBe(`${THEME_VALUES.phosphor.canvas.radius}px`);
});

test("turned to three dimensions with its list open, the dot's list is closed and not left open where nobody can see it", async ({ page }) => {
  await page.goto(linkFor(reviewLoop()));
  const stage = page.locator("main.stage");
  await canvasIsQuiet(page);
  const dot = stage.locator("[data-pictures]");
  await dot.tap();
  await expect(list(stage)).toBeVisible();
  // By the keyboard's way: no press on the page that would close the list for another reason.
  await page.getByRole("radiogroup", { name: "View of the graph" }).getByRole("radio", { name: "3D" }).dispatchEvent("click");
  await expect(stage.locator(".graph-views .space")).toBeVisible();
  await expect(list(stage)).toHaveCount(0);
  await expect(dot).toHaveAttribute("aria-expanded", "false");
});

test("when the view in three dimensions cannot be fetched, the switch says so and the dot is still there, clear of the words, and works", async ({ page }) => {
  await page.route("**/assets/space-*.js", (route) => route.abort());
  for (const width of [360, 400, 1280]) {
    await page.setViewportSize({ width, height: 800 });
    await page.goto("about:blank");
    await page.goto(linkFor(reviewLoop()));
    const stage = page.locator("main.stage");
    await canvasIsQuiet(page);
    await page.getByRole("radiogroup", { name: "View of the graph" }).getByRole("radio", { name: "3D" }).click();
    const note = stage.locator(".graph-views-note");
    await expect(note).toBeVisible({ timeout: 15000 });
    const dot = stage.locator("[data-pictures]");
    await expect(dot).toBeVisible();
    const [words, its, above] = [(await note.boundingBox())!, (await dot.boundingBox())!, (await page.getByRole("radiogroup", { name: "View of the graph" }).boundingBox())!];
    expect(apart(words, its), `at ${width} px, the dot and the words`).toBe(true);
    expect(apart(above, its), `at ${width} px, the dot and the switch`).toBe(true);
    // The words stay for as long as the screen does; the themes can still be reached while they do.
    await dot.click();
    await list(stage).getByRole("menuitemradio", { name: "Ink" }).click();
    await expect(stage).toHaveAttribute("data-look", "ink");
    await expect(note).toBeVisible();
    await stage.locator("[data-pictures]").click();
    await list(stage).getByRole("menuitemradio", { name: "Paper" }).click();
    await expect(stage).not.toHaveAttribute("data-look", /.+/);
    await canvasIsQuiet(page);
  }
});

test("the dot's list rises over a sheet that is open on the canvas: all six can be pressed, on a share link and in the editor", async ({ page }) => {
  // A node's panel covers the lower half of a phone's screen, and the toolbar stands over the canvas: the list is
  // longer than the room above them.
  const through = async (): Promise<void> => {
    const stage = page.locator("main.stage");
    await canvasIsQuiet(page);
    await node(page, "builder").tap();
    await expect(sheet(page)).toBeVisible();
    for (const [name, id] of [["Chalk", "chalk"], ["Transit", "transit"], ["Phosphor", "phosphor"], ["Ink", "ink"], ["Blueprint", "blueprint"]] as const) {
      await stage.locator("[data-pictures]").tap();
      // A tap lands only on what is on top at that place: one that a sheet or a toolbar covered would not be taken.
      await list(stage).getByRole("menuitemradio", { name }).tap();
      await expect(stage, name).toHaveAttribute("data-look", id);
      await expect(sheet(page)).toBeVisible();
    }
    await stage.locator("[data-pictures]").tap();
    await list(stage).getByRole("menuitemradio", { name: "Paper" }).tap();
    await expect(stage).not.toHaveAttribute("data-look", /.+/);
    // Closed, the dot is under the sheet's rank again, as everything on the canvas is.
    expect(await stage.locator(".look-dot").evaluate((el) => (el as HTMLElement).style.zIndex)).toBe("");
  };
  await page.goto(linkFor(reviewLoop()));
  await through();
  await canvasIsQuiet(page);
  await importDocument(page, "review-loop.grooph.json", readFileSync(fixturePath, "utf8"));
  await through();
});

// The 3D view as the browser computes it: every element of the view and of the frame that holds it, by what would
// show a theme if one reached it. Colors, lines and lettering; the slider, a native control, which takes
// `accent-color` and the color scheme from whatever holds it; and the variables the view's own rules read.
const whole = (page: Page): Promise<string[]> =>
  page.locator('[data-picture="space"]').evaluate((view) => {
    const names = ["color", "background-color", "border-top-color", "border-top-width", "outline-color", "fill", "stroke", "stroke-width", "accent-color", "color-scheme", "font-family", "font-size", "letter-spacing", "text-transform", "border-top-left-radius", "--accent", "--accent-soft", "--surface", "--ink", "--line"];
    const holder = view.parentElement!;
    return [holder, ...holder.querySelectorAll("*")].map((el) => {
      const computed = getComputedStyle(el);
      return `${el.tagName.toLowerCase()}.${el.getAttribute("class") ?? ""}  ${names.map((name) => computed.getPropertyValue(name)).join(" | ")}`;
    });
  });

for (const [what, address, flat] of [
  ["a graph", () => linkFor(reviewLoop()), "main.stage"],
  ["a map", () => `./#/open?d=${payload(map())}`, ".map-picture"],
] as const) {
  for (const scheme of ["light", "dark"] as const) {
    test(`the 3D view is Paper in all six themes, its slider and buttons with it: ${what}'s, element by element as the browser computes it, in ${scheme}`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: scheme });
      let paper: string[] | undefined;
      for (const name of PICTURE_THEMES) {
        await page.goto("about:blank");
        await page.goto(address());
        await page.evaluate((value) => localStorage.setItem("groophPicture", value), name);
        if (what === "a graph") await canvasIsQuiet(page);
        await page.reload();
        // The flat view first, in the theme: the theme is in effect before the view is turned.
        if (name === "paper") await expect(page.locator(flat)).not.toHaveAttribute("data-look", /.+/);
        else await expect(page.locator(flat)).toHaveAttribute("data-look", name);
        await page.getByRole("radio", { name: "3D" }).tap();
        await expect(page.locator(".space .space-card").first()).toBeVisible();
        // Nothing that holds the view says a theme while it is shown.
        await expect(page.locator("main.stage[data-look], .map-picture[data-look]")).toHaveCount(0);
        const now = await whole(page);
        if (name === "paper") paper = now;
        else expect(now, `${what} in ${name}, ${scheme}`).toEqual(paper);
        // And the flat view says it again after.
        await page.getByRole("radio", { name: "Picture" }).tap();
        if (name !== "paper") await expect(page.locator(flat)).toHaveAttribute("data-look", name);
        if (what === "a graph") await canvasIsQuiet(page);
      }
      // What was compared was something: the view has its cards, and its slider a color of its own in this scheme.
      expect(paper!.length).toBeGreaterThan(40);
      expect(paper!.find((line) => line.startsWith("input."))).toMatch(/ \| rgb\(\d+, \d+, \d+\) \| /);
    });
  }
}

test("every rule of every theme finds something to style in a real picture, in a browser", async ({ page }) => {
  // The rules are written for hooks the drawing code writes: a card's mark, an edge's dash, a label's size. A hook
  // that the code no longer writes would leave its rule selecting nothing, and the theme would quietly lose a part.
  const long = mapAt("owner-operation-2026-10-01-with-ryan");
  for (const name of FIVE) {
    const svgs = [
      picture(reviewLoop()),
      picture(graphAt("fixtures/valid/glyph-vocabulary.grooph.json")),
      picture(graphAt("patterns/specialist-critic-bank.grooph.json")),
      // the one template with an edge on a verdict that is no loop's: the dotted edge
      picture(graphAt("patterns/patrol-pulse.grooph.json")),
      mapPicture(long),
      mapWideWith(mapKit, long, {}),
      mapSequenceWith(mapKit, long, {}),
    ].map((svg) => themed(svg, name));
    await page.setContent(`<!doctype html><meta charset="utf-8"><body>${svgs.join("")}</body>`);
    const read = await page.evaluate(() => {
      const idle: string[] = [];
      let rules = 0;
      const walk = (all: CSSRuleList): void => {
        for (const rule of all) {
          if (rule instanceof CSSStyleRule) {
            // A selector that holds a picture to light or dark is for a page that does so; none here does.
            for (const selector of rule.selectorText.split(/,(?![^(]*\))/).map((x) => x.trim())) {
              if (selector.includes("[data-theme=")) continue;
              rules++;
              if (!document.querySelector(selector)) idle.push(selector);
            }
          } else if ("cssRules" in rule) walk((rule as CSSGroupingRule).cssRules);
        }
      };
      // The first picture's style holds the theme's rules; the others hold the same ones.
      walk((document.querySelector("svg style") as SVGStyleElement).sheet!.cssRules);
      return { idle, rules };
    });
    expect(read.rules, name).toBeGreaterThan(8);
    expect(read.idle, `${name}: rules that select nothing in any picture`).toEqual([]);
  }
});

test("the app's own marks are seen on a theme: Phosphor on a light device, Transit's cards, and Ink, which has one color", async ({ page }) => {
  // Phosphor is dark whatever the device: a picked line of the list is filled with Phosphor's own ground, not the
  // site's pale one, and a picked card is outlined in Phosphor's green, heavier than a card is.
  await page.emulateMedia({ colorScheme: "light" });
  await keep(page, "phosphor");
  const small = mapAt("a-person-and-two-sessions");
  await page.goto(`./#/open?d=${payload(small)}`);
  const phosphor = colorsOf("phosphor").light;
  await expect(page.locator(".map-picture")).toHaveAttribute("data-look", "phosphor");
  await page.locator('[data-handoff-row="h-done"]').tap();
  const row = page.locator('[data-handoff-row="h-done"] > rect[data-row]');
  await expect.poll(() => row.evaluate((r) => getComputedStyle(r).fill)).toBe(rgb(phosphor["surface-2"]));
  await page.getByRole("button", { name: "Close panel" }).tap();
  await page.locator('[data-session="lead"]').tap();
  const card = page.locator('[data-session="lead"] > rect[data-card]');
  await expect.poll(() => card.evaluate((r) => getComputedStyle(r).stroke)).toBe(rgb(phosphor.ok));
  expect(await card.evaluate((r) => parseFloat(getComputedStyle(r).strokeWidth))).toBeGreaterThan(2);

  // An empty canvas's words are over the theme's ground, so they are in the theme's ink.
  await page.goto("./");
  await page.getByRole("button", { name: "New graph" }).tap();
  await expect(page.locator("main.stage")).toHaveAttribute("data-look", "phosphor");
  await page.getByRole("button", { name: "Close panel" }).tap();
  expect(await page.locator(".empty-canvas p").first().evaluate((n) => getComputedStyle(n).color)).toBe(rgb(phosphor.ink));

  // Transit outlines its cards in the color its accent is. The keyboard's place in an embed is an outline's color
  // and weight, so there it is Transit's green, and heavier than a card.
  const transit = colorsOf("transit").light;
  expect(transit.accent).toBe(transit["line-strong"]);
  await page.goto(`./#/embed?d=${payload(reviewLoop())}&theme=transit-light`);
  const builder = page.getByRole("button", { name: "Agent Builder" });
  await expect(page.locator(".gx")).toHaveAttribute("data-look", "transit");
  const plain = await page.locator('g[data-node="critic"] rect[data-card]').evaluate((r) => ({ stroke: getComputedStyle(r).stroke, width: parseFloat(getComputedStyle(r).strokeWidth) }));
  expect(plain).toEqual({ stroke: rgb(transit["line-strong"]), width: 2.6 });
  // By the keyboard: a script's own focus() is not the keyboard's place, and is not marked.
  for (let i = 0; i < 12 && !(await builder.evaluate((n) => n === document.activeElement)); i++) await page.keyboard.press("Tab");
  await expect(builder).toBeFocused();
  const focused = await page.locator('g[data-node="builder"] rect[data-card]').evaluate((r) => ({ stroke: getComputedStyle(r).stroke, width: parseFloat(getComputedStyle(r).strokeWidth) }));
  expect(focused.stroke).toBe(rgb(transit.ok));
  expect(focused.width).toBeGreaterThan(plain.width);

  // Ink has one color, so on the canvas the marks the app tells apart by color keep the site's: a warning's dot is
  // amber and a selected node's ring is green, as in Paper, and neither is Ink's black.
  await page.goto(linkFor(reviewLoop()));
  const stage = page.locator("main.stage");
  await stage.getByRole("button", { name: /^Picture theme/ }).tap();
  await list(stage).getByRole("menuitemradio", { name: "Ink" }).tap();
  await expect(stage).toHaveAttribute("data-look", "ink");
  const marks = async () => ({
    dot: await page.locator(".issue-dot-warning").first().evaluate((n) => getComputedStyle(n).backgroundColor),
    ring: await node(page, "builder").locator(".gnode").evaluate((n) => getComputedStyle(n).outlineColor),
    kind: await node(page, "builder").locator(".gnode-kind").evaluate((n) => getComputedStyle(n).color),
  });
  await node(page, "builder").tap();
  await expect(node(page, "builder").locator(".gnode")).toHaveClass(/is-selected/);
  await page.waitForTimeout(250);
  const ink = await marks();
  expect(ink.kind).toBe("rgb(0, 0, 0)");
  expect(ink.dot).not.toBe("rgb(0, 0, 0)");
  expect(ink.ring).not.toBe("rgb(0, 0, 0)");
  // They are Paper's own.
  await stage.getByRole("button", { name: "Picture theme: Ink" }).tap();
  await list(stage).getByRole("menuitemradio", { name: "Paper" }).tap();
  await expect(stage).not.toHaveAttribute("data-look", /.+/);
  await expect(node(page, "builder").locator(".gnode")).toHaveClass(/is-selected/);
  await page.waitForTimeout(250);
  const paper = await marks();
  expect(paper.kind).not.toBe("rgb(0, 0, 0)");
  expect({ dot: ink.dot, ring: ink.ring }).toEqual({ dot: paper.dot, ring: paper.ring });
});

test("on a run's view the dot is clear of the legend and of the views' switch, on a phone and on a wide screen; the front page's run and an embed's link keep the theme", async ({ page }) => {
  // A run's legend has long pills: a name, a round, a stop. It stops short of the switch, and the dot is under that.
  for (const width of [400, 1280]) {
    await page.setViewportSize({ width, height: 800 });
    await page.goto(linkFor(runBundle("slice-0007-sandwich")));
    const stage = page.locator("main.stage");
    const toggle = stage.getByRole("button", { name: /^Picture theme/ });
    await expect(toggle).toBeVisible();
    await canvasIsQuiet(page);
    const [menu, legend, above] = [(await toggle.boundingBox())!, (await stage.locator(".loop-legend").boundingBox())!, (await page.getByRole("radiogroup", { name: "View of the graph" }).boundingBox())!];
    expect(apart(menu, legend), `at ${width} px, the dot and the legend`).toBe(true);
    expect(apart(menu, above), `at ${width} px, the dot and the switch`).toBe(true);
    // At every width it is a dot alone.
    expect(menu.width).toBeLessThanOrEqual(48);
    await toggle.click();
    await list(stage).getByRole("menuitemradio", { name: "Blueprint" }).click();
    await expect(stage).toHaveAttribute("data-look", "blueprint");
    await stage.getByRole("button", { name: "Picture theme: Blueprint" }).click();
    await list(stage).getByRole("menuitemradio", { name: "Paper" }).click();
    await expect(stage).not.toHaveAttribute("data-look", /.+/);
  }

  // The front page's recorded run takes the picture's place. It is an embed in a frame, which takes its theme from
  // its address: the piece names the theme in effect there.
  await page.setViewportSize({ width: 400, height: 800 });
  await page.evaluate(() => localStorage.setItem("groophPicture", "blueprint"));
  await canvasIsQuiet(page);
  await page.goto("./#/about");
  await page.reload();
  await expect(page.locator(".land-picture svg")).toHaveAttribute("data-look", "blueprint");
  await page.getByRole("button", { name: "Watch a recorded run" }).click();
  await expect(page.locator("iframe.land-run-frame")).toHaveAttribute("src", /&theme=blueprint$/);
  await expect(page.frameLocator("iframe.land-run-frame").locator("svg.grooph-picture")).toHaveAttribute("data-look", "blueprint");
  // Paper chosen while it plays: the frame's address names no theme again, and the run is in Paper.
  const header = page.locator("header.site-header");
  await header.getByRole("button", { name: "Theme: Grooph" }).click();
  await header.getByRole("menuitem", { name: "Picture theme" }).click();
  await list(header).getByRole("menuitemradio", { name: "Paper" }).click();
  await expect(page.locator("iframe.land-run-frame")).not.toHaveAttribute("src", /theme=/);
  await expect(page.frameLocator("iframe.land-run-frame").locator("svg.grooph-picture")).not.toHaveAttribute("data-look", /.+/);

  // An embed's "Open in grooph" opens the same document in the theme the embed was drawn in.
  await page.goto(`./#/embed?d=${payload(reviewLoop())}&theme=chalk-dark`);
  await expect(page.getByRole("link", { name: /Open in grooph/ })).toHaveAttribute("href", /#\/open\?d=[^&]+&theme=chalk$/);
});

test("pictures of different themes inline in one page each keep their own colors, in light and in dark, held to one or following the device", async ({ page }) => {
  // A picture's style is in the picture, and inline in a page a style reaches the whole page: a Paper picture's rule
  // for dark must not recolor a themed one beside it, whichever comes first, and no theme's rule may reach Paper.
  const doc = reviewLoop();
  const names = ["phosphor", "paper", "blueprint", "paper", "ink"];
  const PAPER = { light: "#f1f4f3", dark: "#111514" };
  const ground = (name: string, form: "light" | "dark") => rgb(name === "paper" ? PAPER[form] : THEME_VALUES[name as (typeof FIVE)[number]][form].bg);
  for (const held of [undefined, "light", "dark"] as const) {
    const svgs = names.map((name) => {
      const svg = themed(picture(doc), name);
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

test("with the themes not to be had, a control says what it needs and every picture stays Paper; Keep a copy says so and makes Paper's files, and the theme's once it can be had", async ({ page }) => {
  let refuse = true;
  await page.route("**/assets/themes-*.js", (route) => (refuse ? route.abort() : route.continue()));
  await keep(page, "ink");
  await importDocument(page, "review-loop.grooph.json", readFileSync(fixturePath, "utf8"));
  const stage = page.locator("main.stage");
  // A theme was kept and cannot be fetched: the canvas opens, in Paper, and the dot says why it shows no list.
  await expect(node(page, "builder")).toBeVisible();
  await expect(stage).not.toHaveAttribute("data-look", /.+/);
  const dot = stage.getByRole("button", { name: "Picture theme" });
  await dot.tap();
  // In words, beside the control, where the list would have been: a phone has nothing to hover over.
  await expect(stage.getByRole("status")).toHaveText("The picture themes could not be fetched. They need a connection the first time.");
  await expect(stage.getByRole("status")).toBeVisible();
  await expect(list(stage)).toHaveCount(0);

  await page.getByRole("button", { name: "Export", exact: true }).tap();
  const keepCopy = sheet(page).getByRole("group", { name: "Keep a copy" });
  // The files are not held back for a theme that is not coming: they are Paper's, and that is said.
  const svg = keepCopy.getByRole("button", { name: "Picture (SVG)" });
  const [file] = await Promise.all([page.waitForEvent("download"), svg.tap()]);
  expect(file.suggestedFilename()).toBe("review-loop.light.svg");
  expect(await downloadText(file)).toBe(readFileSync(join(repoRoot, "fixtures/pictures/review-loop.light.svg"), "utf8"));
  await expect(keepCopy.getByRole("alert")).toContainText("The picture themes could not be fetched");
  // The offline page too: Paper's, and said.
  const [paperPage] = await Promise.all([page.waitForEvent("download"), keepCopy.getByRole("button", { name: "Offline page (.html)" }).tap()]);
  expect(await downloadText(paperPage)).toBe(offlinePage(reviewLoop(), { version: APP_VERSION }));
  await expect(keepCopy.getByRole("alert")).toContainText("The picture themes could not be fetched");

  // The network is back. A browser remembers a script that failed for as long as the page lives, and the app asks
  // again in a way it honors (`piece.ts`): a press on the control fetches the themes, and the kept one is in effect.
  refuse = false;
  await keepCopy.getByRole("button", { name: /^Picture theme/ }).tap();
  await expect(list(keepCopy).getByRole("menuitemradio", { name: "Ink" })).toHaveAttribute("aria-checked", "true");
  await expect(stage).toHaveAttribute("data-look", "ink");
  await page.keyboard.press("Escape");
  const [again] = await Promise.all([page.waitForEvent("download"), svg.tap()]);
  expect(again.suggestedFilename()).toBe("review-loop.ink-light.svg");
  await expect(keepCopy.getByRole("alert")).toHaveCount(0);
});

test("a theme is said to be missing only when one could not be fetched: a kept value that is no theme, Paper by name and a name that is none are simply Paper, and fetch nothing", async ({ page }) => {
  const asked = fetches(page);
  const stage = page.locator("main.stage");
  const paper = readFileSync(join(repoRoot, "fixtures/pictures/review-loop.light.svg"), "utf8");
  await page.emulateMedia({ colorScheme: "light" });
  // Keep a copy, with a kept value that is no theme, and with Paper kept by name: Paper's file, and nothing said.
  await importDocument(page, "review-loop.grooph.json", readFileSync(fixturePath, "utf8"));
  for (const kept of ["sepia", "paper", "ink-dark", ""]) {
    await page.evaluate((value) => localStorage.setItem("groophPicture", value), kept);
    await again(page);
    await expect(node(page, "builder")).toBeVisible();
    await page.getByRole("button", { name: "Export", exact: true }).tap();
    const keepCopy = sheet(page).getByRole("group", { name: "Keep a copy" });
    const [file] = await Promise.all([page.waitForEvent("download"), keepCopy.getByRole("button", { name: "Picture (SVG)" }).tap()]);
    expect(file.suggestedFilename(), kept).toBe("review-loop.light.svg");
    expect(await downloadText(file), kept).toBe(paper);
    const [offline] = await Promise.all([page.waitForEvent("download"), keepCopy.getByRole("button", { name: "Offline page (.html)" }).tap()]);
    expect(await downloadText(offline), kept).toBe(offlinePage(reviewLoop(), { version: APP_VERSION }));
    await expect(keepCopy.getByRole("alert"), kept).toHaveCount(0);
    await expect(stage).not.toHaveAttribute("data-look", /.+/);
  }
  expect(asked).toEqual([]);
  // A share link that names Paper, or a name that is none of the six: Paper, and nothing fetched.
  await page.evaluate(() => localStorage.removeItem("groophPicture"));
  for (const named of ["paper", "paper-dark", "sepia", "inklight", "ink-pink"]) {
    await canvasIsQuiet(page);
    await page.goto("about:blank");
    await page.goto(`${linkFor(reviewLoop())}&theme=${named}`);
    await expect(node(page, "builder")).toBeVisible();
    await expect(stage, named).not.toHaveAttribute("data-look", /.+/);
  }
  await page.waitForTimeout(300);
  expect(asked).toEqual([]);
  // A kept theme, and an address that names Paper over it: the themes are fetched, and the screen is Paper.
  await page.evaluate(() => localStorage.setItem("groophPicture", "chalk"));
  await canvasIsQuiet(page);
  await page.goto("about:blank");
  await page.goto(`${linkFor(reviewLoop())}&theme=paper`);
  await expect(node(page, "builder")).toBeVisible();
  await expect.poll(() => asked.length).toBeGreaterThan(0);
  await expect(stage).not.toHaveAttribute("data-look", /.+/);
  // And without the name, the kept one.
  await canvasIsQuiet(page);
  await page.goto("about:blank");
  await page.goto(linkFor(reviewLoop()));
  await expect(stage).toHaveAttribute("data-look", "chalk");
});

test("a screen that is to be drawn in a theme is not shown in Paper first, and does not wait long for a theme that is slow to come", async ({ page }) => {
  // Every frame in which the canvas or an embed's picture is there to be seen, noted with the theme it is in.
  await page.addInitScript(() => {
    const seen: string[] = [];
    (window as unknown as { seen: string[] }).seen = seen;
    const look = (): void => {
      const drawn = document.querySelector<HTMLElement>("main.stage:has(.react-flow__node), .gx:has(svg.grooph-picture)");
      if (drawn && getComputedStyle(drawn).visibility === "visible") seen.push(drawn.dataset["look"] ?? "paper");
      requestAnimationFrame(look);
    };
    requestAnimationFrame(look);
  });
  const seen = (): Promise<string[]> => page.evaluate(() => (window as unknown as { seen: string[] }).seen);
  // Phosphor is dark on any device: on a light one, a first frame in Paper would be a flash of white.
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto(`${linkFor(reviewLoop())}&theme=phosphor`);
  await expect(page.locator("main.stage")).toHaveAttribute("data-look", "phosphor");
  await page.waitForTimeout(250);
  expect((await seen()).length).toBeGreaterThan(5);
  expect(new Set(await seen())).toEqual(new Set(["phosphor"]));
  // An embed, the same.
  await canvasIsQuiet(page);
  await page.goto("about:blank");
  await page.goto(`./#/embed?d=${payload(reviewLoop())}&theme=phosphor`);
  await expect(page.locator(".gx")).toHaveAttribute("data-look", "phosphor");
  await page.waitForTimeout(250);
  expect(new Set(await seen())).toEqual(new Set(["phosphor"]));

  // A theme that takes three seconds to come: the canvas is up well before that, in Paper, and takes the theme when it arrives.
  await page.route("**/assets/themes-*.js", async (route) => {
    await new Promise((later) => setTimeout(later, 3000));
    await route.continue();
  });
  await page.goto("about:blank");
  const from = Date.now();
  await page.goto(`${linkFor(reviewLoop())}&theme=chalk`);
  // The rest of the screen is there at once, and the canvas within the moment it is held for.
  await expect(page.locator(".title-name")).toHaveText("Review loop");
  await expect(node(page, "builder")).toBeAttached();
  await expect(node(page, "builder")).toBeVisible();
  expect(Date.now() - from).toBeLessThan(2500);
  await expect(page.locator("main.stage")).not.toHaveAttribute("data-look", /.+/);
  await expect(page.locator("main.stage")).toHaveAttribute("data-look", "chalk", { timeout: 8000 });
  expect(new Set(await seen())).toEqual(new Set(["paper", "chalk"]));
});

test.describe("with the service worker running", () => {
  test.use({ serviceWorkers: "allow" });

  test("a first visit in Paper asks for no theme itself, and afterwards a theme can be chosen with no network", async ({ page, context }) => {
    const asked = fetches(page);
    const out = requestsOut(page);
    await page.goto("./");
    await expect(page.locator(".land-headline")).toBeVisible();
    // The visit is over: the worker holds every file the page names, whole (`visitIsOver`). The themes' file is one
    // of them: the page names it in a list the browser does nothing with, and the worker reads it and keeps the file.
    await visitIsOver(page, out);
    expect(await page.evaluate(async () => (await (await caches.open("grooph-app-v1")).keys()).filter((r) => /\/assets\/themes-[^/]*\.js$/.test(r.url)).length)).toBe(1);
    expect(asked).toEqual([]);

    await context.setOffline(true);
    const failed: string[] = [];
    page.on("requestfailed", (r) => failed.push(r.url()));
    const header = page.locator("header.site-header");
    await header.getByRole("button", { name: "Theme: Grooph" }).tap();
    await header.getByRole("menuitem", { name: "Picture theme" }).tap();
    await list(header).getByRole("menuitemradio", { name: "Transit" }).tap();
    await expect(page.locator(".land-picture svg")).toHaveAttribute("data-look", "transit");
    // And a graph opened from a link, still with no network, is on a canvas in the theme.
    await page.goto(linkFor(reviewLoop()));
    await expect(page.locator("main.stage")).toHaveAttribute("data-look", "transit");
    expect(failed).toEqual([]);
  });
});
