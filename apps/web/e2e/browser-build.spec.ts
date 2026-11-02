import { mapKit, mapPicture, parseMapText, picture, type OperationMap } from "@grooph/core";
import { mapWideWith } from "@grooph/core/map-views";
import { expect, test, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { repoRoot, reviewLoop } from "./support.js";

/**
 * grooph on a page (packages/cli/browser): a plain page that loads the one-global build with a <script> tag, as from
 * a CDN, draws graphs and maps inline, takes the phone layout below 640 pixels and the wide one from 680, shows an error
 * as text in the drawing's place, runs nothing a document says, and asks for nothing but the script.
 */
const SCRIPT = "https://cdn.example.test/npm/grooph/dist/browser/grooph.global.js";
const built = join(repoRoot, "packages/cli/dist/browser/grooph.global.js");
const map: OperationMap = parseMapText(readFileSync(join(repoRoot, "fixtures/maps/valid/a-small-studio.grooph-map.json"), "utf8")).map!;
const mapWide = (m: OperationMap): string => mapWideWith(mapKit, m);
/** JSON for inside a <script> element, as the docs say to write it: every "<" as \u003c, so nothing in it ends it early. */
const inScript = (doc: unknown): string => JSON.stringify(doc).replace(/</g, "\\u003c");

async function plainPage(page: Page, body: string): Promise<string[]> {
  const asked: string[] = [];
  page.on("request", (request) => asked.push(request.url()));
  await page.route(SCRIPT, (route) => route.fulfill({ contentType: "text/javascript", body: readFileSync(built, "utf8") }));
  await page.setContent(`<!doctype html><html><head><meta name="viewport" content="width=device-width"></head><body style="margin:0">${body}<script src="${SCRIPT}"></script><script>window.mounted = grooph.drawAll(); window.big = grooph.mount(document.getElementById("map"), ${inScript(map)});</script></body></html>`);
  return asked;
}

test("one script tag draws every grooph block on a plain page, shows a bad one's error as text, and fetches nothing else", async ({ page }) => {
  const hostile = { ...reviewLoop(), name: `<img src=x onerror="window.ran=1">`, goal: "</script><script>window.ran=2</script> <!--<script>" };
  const asked = await plainPage(
    page,
    `<pre class="grooph">${JSON.stringify(reviewLoop()).replace(/&/g, "&amp;").replace(/</g, "&lt;")}</pre>` +
      `<script type="application/grooph+json" data-view="panes">${inScript(hostile)}</script>` +
      `<pre class="grooph">{ this is not JSON</pre>` +
      `<script type="application/grooph+json">{"grooph": 0, "id": "x"}</script>` +
      `<div id="map"></div>`,
  );
  const drawn = page.locator("div.grooph > svg.grooph-picture");
  await expect(drawn).toHaveCount(2);
  expect(await drawn.nth(0).getAttribute("data-picture")).toBe("graph");
  expect(await drawn.nth(1).getAttribute("data-picture")).toBe("panes");
  // The first is core's own picture of the document, element for element.
  const expected = await page.evaluate((svg) => new XMLSerializer().serializeToString(new DOMParser().parseFromString(svg, "image/svg+xml").documentElement), picture(reviewLoop()));
  const got = await drawn.nth(0).evaluate((el) => {
    const copy = el.cloneNode(true) as Element;
    copy.removeAttribute("style");
    return new XMLSerializer().serializeToString(copy);
  });
  expect(got).toBe(expected);
  // The bad ones say why, as text, where a drawing would be.
  const errors = page.locator("div.grooph > p.grooph-error[role=alert]");
  await expect(errors).toHaveCount(2);
  await expect(errors.nth(0)).toHaveText(/^This is not JSON, so there is no grooph document in it: /);
  await expect(errors.nth(1)).toHaveText(/^This is not a graph grooph can draw: /);
  // A document's words never run: the hostile name and goal are text in the drawing.
  expect(await page.evaluate(() => (window as unknown as { ran?: number }).ran)).toBeUndefined();
  await expect(drawn.nth(1)).toContainText("<img src=x");
  // Nothing was asked for but the script: no font, no picture, no data.
  expect(asked.filter((url) => url !== "about:blank")).toEqual([SCRIPT]);
});

test("a mounted drawing takes the phone layout below 640 pixels and the wide one from 680, redraws when it changes, and update and destroy work", async ({ page }) => {
  await page.setViewportSize({ width: 1000, height: 800 });
  await plainPage(page, `<div id="map"></div>`);
  const svg = page.locator("#map > svg");
  await expect(svg).toHaveAttribute("width", /\d/);
  expect(await svg.getAttribute("width")).toBe(/width="([\d.]+)"/.exec(mapWide(map))![1]);
  const [phone, wide] = [/width="([\d.]+)"/.exec(mapPicture(map))![1], /width="([\d.]+)"/.exec(mapWide(map))![1]];
  await page.setViewportSize({ width: 375, height: 800 });
  await expect.poll(() => svg.getAttribute("width")).toBe(phone);
  // Between 640 and 680 a drawing keeps the layout it has, whichever it is.
  await page.setViewportSize({ width: 660, height: 800 });
  await page.waitForTimeout(100);
  expect(await svg.getAttribute("width")).toBe(phone);
  await page.setViewportSize({ width: 900, height: 800 });
  await expect.poll(() => svg.getAttribute("width")).toBe(wide);
  await page.setViewportSize({ width: 660, height: 800 });
  await page.waitForTimeout(100);
  expect(await svg.getAttribute("width")).toBe(wide);

  await page.evaluate((doc) => (window as unknown as { big: { update(d: unknown): void } }).big.update(doc), reviewLoop());
  await expect(page.locator("#map > svg")).toHaveAttribute("data-picture", "graph");
  await page.evaluate(() => (window as unknown as { big: { destroy(): void } }).big.destroy());
  await expect(page.locator("#map > *")).toHaveCount(0);
  // Destroyed, it no longer follows the width, and an update draws nothing.
  await page.setViewportSize({ width: 375, height: 800 });
  await page.evaluate((doc) => (window as unknown as { big: { update(d: unknown): void } }).big.update(doc), reviewLoop());
  await page.waitForTimeout(100);
  await expect(page.locator("#map > *")).toHaveCount(0);
});
