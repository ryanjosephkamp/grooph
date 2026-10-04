import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { gzipSync } from "node:zlib";

import { buildRunBundle, canonicalizeRunBundle, parseGraphText, parseMapText, type Graph, type OperationMap, type ProposalSet, type RunBundle } from "@grooph/core";
import { expect, test, type Frame, type Page } from "@playwright/test";

import { embedCommand, resizeScript } from "../../../packages/cli/src/commands/embed.js";
import { csvSet, linkFor, repoRoot, reviewLoop } from "./support.js";

/**
 * Handoff 0056: a graph any page can show, and a run that plays. The embed is
 * `#/embed?d=<share payload>`, drawn from core's picture, in a frame of
 * someone else's page. Phone size with touch, as the rest of the suite; the
 * frame tests put the embed in an <iframe> of a host page at three widths.
 */

const embedFor = (doc: Graph | ProposalSet | RunBundle | OperationMap, options = ""): string => `${linkFor(doc as Graph).replace("#/open?", "#/embed?")}${options}`;

/** The proving run of the heterogeneous-critic template (experiments/patterns/): it fails round 0, passes its bar in round 1, and halts at the gate. */
function provingRun(): RunBundle {
  const dir = join(repoRoot, "experiments/patterns/heterogeneous-critic/run");
  const runDir = join(dir, "runs/20260920-192538");
  const graph = (path: string): Graph => parseGraphText(readFileSync(path, "utf8")).doc!;
  return buildRunBundle({
    source: graph(join(dir, "package/graph.grooph.json")),
    working: graph(join(runDir, "graph.grooph.json")),
    notesText: readFileSync(join(runDir, "notes.jsonl"), "utf8"),
  });
}
const PROVING_END = "Review stopped on bar passed in round 1. The run halted at Merge approval (a human gate).";

const sampleMap = (): OperationMap => parseMapText(readFileSync(join(repoRoot, "fixtures/maps/valid/two-sessions.grooph-map.json"), "utf8")).map!;

const nodeButton = (page: Page | Frame, kind: string, name: string) => page.getByRole("button", { name: new RegExp(`^${kind} ${name}\\b`) });
const brief = (page: Page | Frame) => page.getByRole("dialog");
const svgWidth = async (page: Page | Frame): Promise<number> => Number(await page.locator(".gx-canvas svg").getAttribute("width"));

/** A host page holding frames, as a blog would: the two lines `grooph embed` prints, or a frame with no script. */
async function host(page: Page, body: string): Promise<void> {
  await page.setContent(`<!doctype html><html><head><meta name="viewport" content="width=device-width"></head><body style="margin:0;background:#fbf7ef">${body}</body></html>`);
}

test("a graph's embed is the graph read-only: no app header, no save bar, no navigation", async ({ page }) => {
  const doc = reviewLoop();
  await page.goto(embedFor(doc));

  await expect(page.locator(".gx-canvas svg text", { hasText: "Review loop" }).first()).toBeVisible();
  await expect(nodeButton(page, "Agent", "Critic")).toBeVisible();
  await expect(page.locator("header.topbar")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Save to this device" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "All graphs" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /^Validation:/ })).toHaveCount(0);

  // "Open in grooph" is the full app with the same payload, in a new tab.
  const open = page.getByRole("link", { name: "Open in grooph" });
  const payload = /d=([A-Za-z0-9_-]+)/.exec(embedFor(doc))![1]!;
  await expect(open).toHaveAttribute("href", new RegExp(`/grooph/#/open\\?d=${payload}$`));
  await expect(open).toHaveAttribute("target", "_blank");

  // Every control has a name.
  const unnamed = await page.$$eval(".gx button, .gx a, .gx input, .gx [role=button]", (els) =>
    els.filter((el) => !(el.getAttribute("aria-label") ?? el.textContent ?? "").trim()).map((el) => el.outerHTML.slice(0, 80)),
  );
  expect(unnamed).toEqual([]);
});

test("tap or Enter opens a node's brief, Escape and Close shut it, and focus comes back", async ({ page }) => {
  await page.goto(embedFor(reviewLoop()));

  await nodeButton(page, "Agent", "Critic").tap();
  await expect(brief(page)).toBeVisible();
  await expect(brief(page).getByRole("heading")).toHaveText("Critic");
  await expect(brief(page)).toContainText("Compare the diff and test output against the checklist.");
  await page.keyboard.press("Escape");
  await expect(brief(page)).toHaveCount(0);

  const builder = nodeButton(page, "Agent", "Builder");
  await builder.focus();
  await page.keyboard.press("Enter");
  await expect(brief(page).getByRole("heading")).toHaveText("Builder");
  await expect(page.getByRole("button", { name: "Close brief" })).toBeFocused();
  await page.getByRole("button", { name: "Close brief" }).click();
  await expect(brief(page)).toHaveCount(0);
  await expect(builder).toBeFocused();

  // A loop opens its bar and its stops.
  await page.getByRole("button", { name: /^Loop Build-review cycle/ }).tap();
  await expect(brief(page)).toContainText("Stops, in order");
});

test("an operation map embeds, and a tap on a session opens what the map says about it", async ({ page }) => {
  const map = sampleMap();
  await page.goto(embedFor(map));
  await expect(page.locator(".gx-canvas svg text", { hasText: map.name }).first()).toBeVisible();
  const first = map.sessions[0]!;
  await page.getByRole("button", { name: `Session ${first.name}` }).tap();
  await expect(brief(page).getByRole("heading")).toHaveText(first.name);
  await expect(brief(page)).toContainText(first.role);
});

test("a proposal set shows its recommended candidate", async ({ page }) => {
  const set = csvSet();
  await page.goto(embedFor(set));
  const chosen = set.candidates.find((c) => c.id === set.recommendation?.candidate)!;
  await expect(page.locator(".gx-canvas svg text", { hasText: (chosen.graph as Graph).name }).first()).toBeVisible();
});

for (const width of [320, 600, 1200]) {
  test(`in a frame ${width} px wide there is no scrollbar and no text is cut, with or without the script`, async ({ page, baseURL }) => {
    await page.setViewportSize({ width: width + 40, height: 900 });
    // The frame `grooph embed` prints, once with its script and once without: the height it prints is all a page without the script has.
    const file = join(mkdtempSync(join(tmpdir(), "grooph-embed-e2e-")), "proving.grooph-run.json");
    writeFileSync(file, canonicalizeRunBundle(provingRun()));
    const out: string[] = [];
    expect(embedCommand({ out: (t) => void out.push(t), err: () => undefined }, file, { base: baseURL! })).toBe(0);
    const frame = out[0]!.replace('width="100%"', `width="${width}"`).replace("width:100%;", "");
    await host(page, `${frame.replace("<iframe ", '<iframe id="sized" ')}${out[1]}${frame.replace("<iframe ", '<iframe id="fixed" ').replace(" data-grooph-embed", "")}`);

    const sized = page.frameLocator("#sized");
    await expect(sized.locator(".gx-canvas svg")).toBeVisible();
    // The script sized the frame to the height it asked for.
    await expect.poll(() => page.locator("#sized").evaluate((f: HTMLIFrameElement) => f.style.height)).toMatch(/^\d+px$/);

    for (const id of ["sized", "fixed"]) {
      const frame = (await (await page.$(`#${id}`))!.contentFrame())!;
      await expect(frame.locator(".gx-canvas svg")).toBeVisible();
      await page.waitForTimeout(150);
      const facts = await frame.evaluate(() => {
        const html = document.documentElement;
        const overflowing = [...document.querySelectorAll(".gx-bar, .gx-replay, .gx-replay-row, .gx-loops")].filter((el) => el.scrollWidth > el.clientWidth + 1).map((el) => el.className);
        const stage = document.querySelector(".gx-stage")!.getBoundingClientRect();
        const outside = [...document.querySelectorAll(".gx-canvas svg text")]
          .map((t) => t.getBoundingClientRect())
          .filter((r) => r.width > 0 && (r.left < stage.left - 0.5 || r.right > stage.right + 0.5 || r.top < stage.top - 0.5 || r.bottom > stage.bottom + 0.5)).length;
        const buttons = [...document.querySelectorAll(".gx-btn")].filter((b) => b.scrollWidth > b.clientWidth + 1).length;
        return { scrollX: html.scrollWidth - html.clientWidth, scrollY: html.scrollHeight - html.clientHeight, overflowing, outside, buttons };
      });
      expect(facts, `${id} frame at ${width}`).toEqual({ scrollX: 0, scrollY: 0, overflowing: [], outside: 0, buttons: 0 });
    }
  });
}

test("the script sizes only grooph frames, and the embed asks again when its bars change height", async ({ page, baseURL }) => {
  const src = `${baseURL}${embedFor(reviewLoop()).slice(2)}`;
  await host(page, `<iframe id="a" src="${src}" width="380" height="200" data-grooph-embed></iframe><iframe id="b" src="${src}" width="380" height="200"></iframe>${resizeScript(baseURL!)}`);
  await expect.poll(() => page.locator("#a").evaluate((f: HTMLIFrameElement) => f.style.height)).toMatch(/^\d+px$/);
  expect(await page.locator("#b").evaluate((f: HTMLIFrameElement) => f.style.height)).toBe("");
});

for (const scheme of ["light", "dark"] as const) {
  test.describe(`a reader in ${scheme} mode`, () => {
    test.use({ colorScheme: scheme });

    test("no theme follows the reader; ?theme= wins; the background is the page's own unless frame=1", async ({ page }) => {
      const card = () => page.locator("g[data-node] rect[data-card]").first().evaluate((r) => getComputedStyle(r).fill);
      const surface = { light: "rgb(253, 254, 254)", dark: "rgb(27, 32, 30)" };
      const other = scheme === "light" ? "dark" : "light";

      await page.goto(embedFor(reviewLoop()));
      await expect.poll(card).toBe(surface[scheme]);
      expect(await page.evaluate(() => getComputedStyle(document.body).backgroundColor)).toBe("rgba(0, 0, 0, 0)");
      expect(await page.locator(".gx-canvas svg > rect").first().evaluate((r) => getComputedStyle(r).fill)).toMatch(/^(transparent|rgba\(0, 0, 0, 0\))$/);

      await page.goto(embedFor(reviewLoop(), `&theme=${other}`));
      await page.reload();
      await expect.poll(card).toBe(surface[other]);

      await page.goto(embedFor(reviewLoop(), "&frame=1"));
      await page.reload();
      expect(await page.locator(".gx").evaluate((el) => getComputedStyle(el).backgroundColor)).not.toBe("rgba(0, 0, 0, 0)");
    });
  });
}

test("mouse: the buttons zoom, a drag pans, ctrl and the wheel zoom, Fit puts it back", async ({ page }) => {
  await page.goto(embedFor(reviewLoop()));
  const fit = page.getByRole("button", { name: "Fit the picture" });
  await expect(fit).toBeDisabled();
  const start = await svgWidth(page);

  await page.getByRole("button", { name: "Zoom in" }).click();
  expect(await svgWidth(page)).toBeCloseTo(start * 1.25, 0);
  await expect(fit).toBeEnabled();

  const before = await page.locator(".gx-canvas").evaluate((el) => el.style.transform);
  const box = (await page.locator(".gx-stage").boundingBox())!;
  await page.mouse.move(box.x + 200, box.y + 300);
  await page.mouse.down();
  await page.mouse.move(box.x + 120, box.y + 200, { steps: 6 });
  await page.mouse.up();
  expect(await page.locator(".gx-canvas").evaluate((el) => el.style.transform)).not.toBe(before);
  // A drag is not a tap: nothing opened.
  await expect(brief(page)).toHaveCount(0);

  await fit.click();
  expect(await svgWidth(page)).toBeCloseTo(start, 0);
  await page.keyboard.down("Control");
  await page.mouse.move(box.x + 200, box.y + 200);
  await page.mouse.wheel(0, -200);
  await page.keyboard.up("Control");
  expect(await svgWidth(page)).toBeGreaterThan(start * 1.5);
});

test("touch: two fingers pinch to zoom, one finger pans, a tap opens", async ({ page }) => {
  await page.goto(embedFor(reviewLoop()));
  const start = await svgWidth(page);
  const box = (await page.locator(".gx-stage").boundingBox())!;
  const cx = box.x + box.width / 2;
  const cy = box.y + 220;
  const cdp = await page.context().newCDPSession(page);
  const touch = async (type: "touchStart" | "touchMove" | "touchEnd", points: { x: number; y: number }[]) => cdp.send("Input.dispatchTouchEvent", { type, touchPoints: points.map((p, id) => ({ ...p, id })) });

  await touch("touchStart", [{ x: cx - 30, y: cy }, { x: cx + 30, y: cy }]);
  for (let i = 1; i <= 10; i++) await touch("touchMove", [{ x: cx - 30 - i * 9, y: cy }, { x: cx + 30 + i * 9, y: cy }]);
  await touch("touchEnd", []);
  expect(await svgWidth(page)).toBeGreaterThan(start * 1.8);

  const before = await page.locator(".gx-canvas").evaluate((el) => el.style.transform);
  await touch("touchStart", [{ x: cx, y: cy }]);
  for (let i = 1; i <= 8; i++) await touch("touchMove", [{ x: cx + i * 8, y: cy + i * 6 }]);
  await touch("touchEnd", []);
  expect(await page.locator(".gx-canvas").evaluate((el) => el.style.transform)).not.toBe(before);
  await expect(brief(page)).toHaveCount(0);
  await cdp.detach();

  await page.getByRole("button", { name: "Fit the picture" }).tap();
  await nodeButton(page, "Agent", "Builder").tap();
  await expect(brief(page).getByRole("heading")).toHaveText("Builder");
});

test("a proving run plays to its end: nodes light, the round ticks, and the end names the stop", async ({ page }) => {
  await page.goto(embedFor(provingRun(), "&play=1"));
  const caption = page.getByTestId("replay-caption");
  const chip = page.locator('[data-loop-chip="review"] .gx-round');
  const state = (id: string) => page.locator(`g[data-node="${id}"]`).getAttribute("data-state");

  // Autoplay starts from before the run; pause it to step by hand.
  await page.getByRole("button", { name: "Pause" }).click();
  await page.getByRole("slider", { name: "Replay position" }).fill("0");
  await expect(caption).toHaveText("Before the run");
  expect(await state("builder")).toBe("pending");
  await expect(chip).toHaveText("not entered");

  await page.getByRole("button", { name: "Next step" }).click();
  await page.getByRole("button", { name: "Next step" }).click();
  await expect(caption).toHaveText("Builder dispatched · round 0");
  expect(await state("builder")).toBe("running");
  await expect(nodeButton(page, "Agent", "Builder")).toHaveAccessibleName(/running/);
  await expect(chip).toHaveText("round 0");

  await page.getByRole("slider", { name: "Replay position" }).fill("5");
  expect(await state("critic")).toBe("failed");
  await page.getByRole("slider", { name: "Replay position" }).fill("8");
  await expect(chip).toHaveText("round 1");
  await page.getByRole("button", { name: "Previous step" }).click();
  await expect(caption).toHaveText(/^Builder dispatched · round 1$/);

  // Play from here to the end.
  await page.getByRole("button", { name: "Play", exact: true }).click();
  await expect(caption).toHaveText(PROVING_END, { timeout: 15_000 });
  await expect(chip).toHaveText("round 1 · bar passed");
  expect(await state("merge-gate")).toBe("halted");
  expect(await state("done")).toBe("pending");
  await expect(page.getByRole("button", { name: "Play the run from the start" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Next step" })).toBeDisabled();

  // At the end, a node's brief says what the run did there.
  await nodeButton(page, "Agent", "Builder").tap();
  await expect(brief(page)).toContainText("At this step: passed · round 1 · 2 dispatches");
});

test("a run opens at its end without play=1, and run= carries a run like d=", async ({ page }) => {
  await page.goto(embedFor(provingRun()).replace("embed?d=", "embed?run="));
  await expect(page.getByTestId("replay-caption")).toHaveText(PROVING_END);
  await expect(page.getByRole("button", { name: "Play the run from the start" })).toBeVisible();
});

test("grooph embed prints a frame whose page shows the graph's name", async ({ page, baseURL }) => {
  const out: string[] = [];
  const code = embedCommand({ out: (t) => void out.push(t), err: (t) => void out.push(`err: ${t}`) }, join(repoRoot, "fixtures/valid/review-loop.grooph.json"), { base: baseURL! });
  expect(code).toBe(0);
  expect(out).toHaveLength(2);
  await host(page, out.join("\n"));
  const frame = page.frameLocator("iframe[data-grooph-embed]");
  await expect(frame.locator(".gx-canvas svg text", { hasText: "Review loop" }).first()).toBeVisible();
  await expect.poll(() => page.locator("iframe").evaluate((f: HTMLIFrameElement) => f.style.height)).toMatch(/^\d+px$/);
});

test("the embed's first load is at most 200 KB compressed, and the app is not loaded", async ({ page, baseURL }) => {
  const loaded: { url: string; gzip: number }[] = [];
  page.on("response", async (res) => {
    if (!res.url().startsWith(baseURL!)) return;
    try {
      loaded.push({ url: res.url(), gzip: gzipSync(await res.body()).length });
    } catch {
      // a response with no body (a redirect) weighs nothing
    }
  });
  await page.goto(embedFor(provingRun()));
  await expect(page.locator(".gx-canvas svg")).toBeVisible();
  await page.waitForLoadState("networkidle");
  const total = loaded.reduce((n, r) => n + r.gzip, 0);
  test.info().annotations.push({ type: "embed first load", description: `${(total / 1024).toFixed(1)} KB gzipped: ${loaded.map((r) => `${r.url.replace(baseURL!, "")} ${(r.gzip / 1024).toFixed(1)}`).join(", ")}` });
  expect(loaded.some((r) => /\/assets\/App-/.test(r.url)), "the app's own chunk").toBe(false);
  expect(loaded.some((r) => /\/assets\/styles-/.test(r.url)), "the app's stylesheet").toBe(false);
  expect(total).toBeLessThanOrEqual(200 * 1024);
});

test("an embed address opened inside the app shows the embed, and the app's routes still work", async ({ page }) => {
  await page.goto("./");
  await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();
  const embed = embedFor(reviewLoop()).slice(1);
  await page.evaluate((hash) => (location.hash = hash), embed.slice(embed.indexOf("#")));
  await expect(nodeButton(page, "Agent", "Critic")).toBeVisible();
  await page.evaluate(() => (location.hash = "#/templates"));
  await expect(page.locator(".gx")).toHaveCount(0);
  await expect(page.getByRole("link", { name: /grind/i }).first()).toBeVisible();
});

test("a damaged payload says so inside the frame, and nothing else is drawn", async ({ page }) => {
  await page.goto("./#/embed?d=not-a-real-payload");
  await expect(page.getByRole("alert")).toContainText("This embed could not be drawn.");
  await expect(page.locator(".gx-canvas")).toHaveCount(0);
});

/**
 * Criterion 8's screenshots: the demo page at 400 and 1200 px, light and dark,
 * with its frames pointed at this build. Made only on request:
 *
 *   GROOPH_SHOTS=1 GROOPH_E2E_PORT=4320 pnpm --filter @grooph/web exec playwright test e2e/embed.spec.ts -g "demo page"
 */
for (const width of [400, 1200]) {
  for (const scheme of ["light", "dark"] as const) {
    test(`demo page at ${width} px, ${scheme}`, async ({ browser, baseURL }) => {
      test.skip(!process.env["GROOPH_SHOTS"], "screenshots are made on request (GROOPH_SHOTS=1)");
      const context = await browser.newContext({ viewport: { width, height: 900 }, colorScheme: scheme, deviceScaleFactor: 1 });
      const page = await context.newPage();
      await page.goto(`file://${join(repoRoot, "handoffs/0056-embed-and-replay/demo.html")}?local=${encodeURIComponent(baseURL!)}`);
      const frames = page.locator("iframe[data-grooph-embed]");
      await expect(frames).toHaveCount(2);
      for (let i = 0; i < 2; i++) {
        await frames.nth(i).scrollIntoViewIfNeeded();
        await expect(page.frameLocator("iframe[data-grooph-embed]").nth(i).locator(".gx-canvas svg")).toBeVisible();
      }
      // A tall viewport rather than a full-page capture, which leaves frames blank in headless Chromium.
      await page.setViewportSize({ width, height: await page.evaluate(() => document.documentElement.scrollHeight) });
      await page.waitForTimeout(800);
      await page.screenshot({ path: join(repoRoot, `handoffs/0056-embed-and-replay/demo-${width}-${scheme}.png`) });
      await context.close();
    });
  }
}
