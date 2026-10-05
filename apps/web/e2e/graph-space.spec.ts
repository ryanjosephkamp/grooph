import { readFileSync } from "node:fs";
import { join } from "node:path";

import { parseGraphText, type Graph } from "@grooph/core";
import { expect, test, type Page } from "@playwright/test";

import { fixturePath, importDocument, linkFor, node, repoRoot, runBundle, sheet } from "./support.js";

/**
 * A loop graph in three dimensions (handoff 0092): the switch a map has, on every canvas. The scene, the slider and
 * the way it is turned are the map's own (map-space.spec.ts holds those); here is what is a graph's: its sheets, the
 * order of its slider, where the switch shows, and that the canvas under it is left as it was.
 */
const pattern = (id: string): Graph => parseGraphText(readFileSync(join(repoRoot, `patterns/${id}.grooph.json`), "utf8")).doc!;
const view = (page: Page, name: string) => page.getByRole("radiogroup", { name: "View of the graph" }).getByRole("radio", { name });
const slider = (page: Page) => page.getByRole("slider", { name: "Step, in the order a first pass takes them" });
const says = (page: Page) => page.locator(".space output");
const posed = (page: Page) => page.locator(".space-world").evaluate((el) => (el as HTMLElement).style.transform);

/** Choose 3D and wait until the scene is drawn and fitted. */
async function threeD(page: Page): Promise<void> {
  await view(page, "3D").click();
  await expect(page.locator(".space-scene")).toBeVisible();
  await expect.poll(() => posed(page)).toContain("scale3d(");
}

test("a template's page has the switch a map has; 3D draws each loop as a sheet, every node a card and every edge an arc, named and whole in its frame", async ({ page }) => {
  const doc = pattern("gauntlet-decomposed");
  await page.goto("./#/templates/built-in/gauntlet-decomposed");
  await expect(node(page, "planner")).toBeVisible();
  await expect(view(page, "Picture")).toHaveAttribute("aria-checked", "true");
  // The template's own details are open over the foot of a phone; out of the way for this.
  await page.getByRole("button", { name: "Close panel" }).click();
  await threeD(page);
  await expect(view(page, "3D")).toHaveAttribute("aria-checked", "true");

  const scene = page.locator(".space-scene");
  await expect(scene.locator("[data-node]")).toHaveCount(doc.nodes.length);
  await expect(scene.locator("[data-edge]")).toHaveCount(doc.edges.length);
  // Three sheets: what is in no loop, then the two loops; the inner loop holds its own three nodes.
  await expect(scene.locator(".space-sheet")).toHaveCount(3);
  await expect(page.locator(".space-label b")).toHaveText(["Outside any loop", "Polish a piece", "Pieces"]);
  await expect(scene).toHaveAttribute("aria-label", /^Gauntlet, decomposed in three dimensions: 3 sheets, 10 cards, 12 edges\./);

  // Every card is a button with a name, in the keyboard's reach; every arc has a name.
  const cards = await scene.locator("[data-node]").evaluateAll((els) => els.map((el) => [el.getAttribute("aria-label"), el.getAttribute("tabindex"), el.getAttribute("role")]));
  expect(cards.every(([name, tab, role]) => !!name && tab === "0" && role === "button")).toBe(true);
  expect(cards.map(([name]) => name)).toEqual(expect.arrayContaining(["Agent Planner", "Human gate Release", "Check Capture check", "Stop Done"]));
  const arcs = await scene.locator("[data-edge]").evaluateAll((els) => els.map((el) => el.getAttribute("aria-label")));
  expect(arcs.every((name) => /^Step \d+: .+ to .+/.test(name ?? ""))).toBe(true);

  // The starting view shows every card inside the frame.
  const frame = (await scene.boundingBox())!;
  for (const box of await scene.locator(".space-card").evaluateAll((els) => els.map((el) => el.getBoundingClientRect().toJSON()))) {
    expect(box.left).toBeGreaterThanOrEqual(frame.x - 1);
    expect(box.right).toBeLessThanOrEqual(frame.x + frame.width + 1);
    expect(box.top).toBeGreaterThanOrEqual(frame.y - 1);
    expect(box.bottom).toBeLessThanOrEqual(frame.y + frame.height + 1);
  }
  await expect(page.locator(".space-note")).toHaveText("The edges a first pass takes, in order, and then one turn of each loop. An order, not a clock: a graph records no times.");
});

test("the slider follows a first pass and then one turn of each loop, lighting each edge with its two ends", async ({ page }) => {
  await page.goto("./#/templates/built-in/review-gate");
  await expect(node(page, "builder")).toBeVisible();
  await page.getByRole("button", { name: "Close panel" }).click();
  await threeD(page);
  await expect(says(page)).toHaveText("All 5 steps are lit. Move the slider or press Play to follow a first pass, one edge at a time.");
  await slider(page).fill("1");
  await expect(says(page)).toHaveText("Step 1 of 5: Builder to Critic");
  await expect(slider(page)).toHaveAttribute("aria-valuetext", "step 1 of 5");
  await expect(page.locator(".space-arc.is-lit")).toHaveCount(1);
  await expect(page.locator('.space [data-node="builder"]')).toHaveClass(/is-end/);
  await expect(page.locator('.space [data-node="critic"]')).toHaveClass(/is-end/);
  await page.getByRole("button", { name: "Next edge" }).click();
  await expect(says(page)).toHaveText("Step 2 of 5: Critic to Merge approval · when pass");
  // The last two steps are the loop's turns: its back edges, dashed, in the loop's color.
  await slider(page).fill("4");
  await expect(says(page)).toHaveText(/^Step 4 of 5: Critic to Builder · when fail · back into Review: another round, until /);
  await expect(page.locator(".space-arc.is-past")).toHaveCount(3);
  const lit = page.locator(".space-arc.is-lit [data-edge] > path").first();
  expect(await lit.getAttribute("stroke-dasharray")).toBe("6 4");
  expect(await page.locator('.space [data-edge="e-builder-critic"] > path').first().getAttribute("stroke-dasharray")).toBeNull();
});

test("a link to a graph: a card opens what its node does on the canvas, and back on Picture the canvas is as it was", async ({ page }) => {
  const doc = parseGraphText(readFileSync(fixturePath, "utf8")).doc!;
  await page.goto(linkFor(doc));
  await expect(node(page, "builder")).toBeVisible();
  const where = async () => JSON.stringify(await node(page, "builder").boundingBox());
  await expect.poll(async () => (await where()) === (await where())).toBe(true);
  const before = await where();

  await threeD(page);
  // The canvas keeps its place under the view, and takes no tap through it.
  await page.locator('.space [data-node="critic"]').dispatchEvent("click");
  await expect(sheet(page).getByText("Critic").first()).toBeVisible();
  await page.getByRole("button", { name: "Close panel" }).click();
  // From the keyboard too.
  await page.locator('.space [data-node="merge-gate"]').focus();
  await page.keyboard.press("Enter");
  await expect(sheet(page).getByText("Merge approval").first()).toBeVisible();
  await page.getByRole("button", { name: "Close panel" }).click();

  await view(page, "Picture").click();
  await expect(page.locator(".space")).toHaveCount(0);
  await expect.poll(where).toBe(before);
  // The switch lies over the canvas and is not in its way: a node under the pointer is the node.
  const box = (await node(page, "builder").boundingBox())!;
  expect(await page.evaluate(([x, y]) => !!document.elementFromPoint(x!, y!)?.closest(".react-flow__node"), [box.x + box.width / 2, box.y + box.height / 2])).toBe(true);
  // Chosen again, it is where it was left.
  await threeD(page);
  await expect(page.locator(".space [data-node]")).toHaveCount(doc.nodes.length);
});

test("the editor and a run's page have the switch too: 3D is for looking, and the picture is still the place to edit", async ({ page }) => {
  await importDocument(page, "review-loop.grooph.json", readFileSync(fixturePath, "utf8"));
  await expect(node(page, "builder")).toBeVisible();
  await threeD(page);
  await expect(page.locator(".space [data-node]")).toHaveCount(await page.locator(".react-flow__node").count());
  await view(page, "Picture").click();
  await expect(page.locator(".space")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Export", exact: true })).toBeVisible();

  // A recorded run: the same switch over its canvas.
  await page.goto(linkFor(runBundle("slice-0007-sandwich")));
  await expect(page.locator(".react-flow__node").first()).toBeVisible();
  const nodes = await page.locator(".react-flow__node").count();
  await threeD(page);
  await expect(page.locator(".space [data-node]")).toHaveCount(nodes);
});

test("a recorded run is replayed in three dimensions: the slider steps through the run's own notes, lighting what each is about", async ({ page }) => {
  const run = runBundle("slice-0007-sandwich");
  const about = (at: string): number => run.notes.findIndex((n) => n.at === at) + 1;
  await page.goto(linkFor(run));
  await expect(page.locator(".react-flow__node").first()).toBeVisible();
  await threeD(page);
  const notes = page.getByRole("slider", { name: "Note, in the order the run wrote them" });
  await expect(notes).toHaveAttribute("max", String(run.notes.length));
  await expect(says(page)).toHaveText(`Before the run: ${run.notes.length} notes to follow. Move the slider or press Play.`);
  // Under the slider: that these are the run's notes, and how the run ended.
  await expect(page.locator(".space-note")).toHaveText(/^The run's own notes, in the order it wrote them\. \S+/);

  // A note about a node lights its card, and dims nothing: the order is the run's, not the arcs'.
  await notes.fill(String(about("node:builder")));
  await expect(says(page)).toHaveText(new RegExp(`^Note ${about("node:builder")} of ${run.notes.length}: `));
  await expect(page.locator('.space [data-node="builder"]')).toHaveClass(/is-end/);
  await expect(page.locator(".space .is-end")).toHaveCount(1);
  await expect(page.locator(".space :is(.is-past, .is-ahead)")).toHaveCount(0);
  // A note about a loop lights the loop's sheet.
  await notes.fill(String(about("loop:sandwich")));
  await expect(page.locator('.space-sheet[data-loop="sandwich"]')).toHaveClass(/is-end/);
  await expect(page.locator('.space [data-node="builder"]')).not.toHaveClass(/is-end/);
  // A note about an edge lights its arc and the two cards it joins.
  await notes.fill(String(about("edge:e-checks-critic")));
  await expect(page.locator(".space-arc.is-lit [data-edge]")).toHaveAttribute("data-edge", "e-checks-critic");
  await expect(page.locator('.space [data-node="checks"]')).toHaveClass(/is-end/);
  await expect(page.locator('.space [data-node="critic"]')).toHaveClass(/is-end/);
  await expect(page.locator('.space-sheet[data-loop="sandwich"]')).not.toHaveClass(/is-end/);
  // The buttons step by notes.
  await page.getByRole("button", { name: "Next note" }).click();
  await expect(says(page)).toHaveText(new RegExp(`^Note ${about("edge:e-checks-critic") + 1} of ${run.notes.length}: `));

  // On a phone a run's canvas is short, for the timeline under it; in three dimensions it is given a screen's room.
  expect((await page.locator(".space-scene").boundingBox())!.height).toBeGreaterThan(280);
  await view(page, "Picture").click();
  await expect(page.locator(".space")).toHaveCount(0);
  await expect(page.locator(".react-flow__node").first()).toBeVisible();
});

/* ─── the switch itself: one paint, as a map's is (the owner's note of 2026-10-05) ─── */

type Arrival = { styled: boolean; posed: boolean; named: boolean };

/**
 * Note what each scene is like at the moment its markup is put on the page. The observer is the page's own: it is
 * told at the end of the turn that drew the scene, before the browser paints and before anything the app has put
 * off until the browser has had its chance to. A scene that is not styled, turned and named by then can be painted
 * raw, and on a phone it is.
 */
async function noteArrivals(page: Page): Promise<() => Promise<Arrival[]>> {
  await page.evaluate(() => {
    const seen = new WeakSet<Element>();
    const log: Arrival[] = ((window as unknown as { __arrived: Arrival[] }).__arrived = []);
    new MutationObserver(() => {
      const root = document.querySelector(".space");
      if (!root || seen.has(root)) return;
      seen.add(root);
      log.push({
        styled: getComputedStyle(root.querySelector(".space-scene")!).touchAction === "none",
        posed: root.querySelector<HTMLElement>(".space-world")!.style.transform.includes("scale3d("),
        named: [...root.querySelectorAll("[data-node]")].every((el) => el.hasAttribute("aria-label")),
      });
    }).observe(document.body, { childList: true, subtree: true });
  });
  return () => page.evaluate(() => (window as unknown as { __arrived: Arrival[] }).__arrived);
}

/** Hold the scene's piece on its way, as a slow connection does; `release` lets it through. */
async function holdTheScene(page: Page): Promise<{ asked: Promise<unknown>; release: () => void }> {
  let release!: () => void;
  const held = new Promise<void>((resolve) => (release = resolve));
  await page.route(/\/assets\/space-[^/]*\.js$/, async (route) => {
    await held;
    await route.continue();
  });
  return { asked: page.waitForRequest(/\/assets\/space-[^/]*\.js$/), release };
}

/**
 * A processor as slow as a phone's, by the given rate; 1 is the machine's own. The session that sets the rate is
 * kept for the rest of the test: a rate set through one is gone the moment it is closed.
 */
async function slowing(page: Page): Promise<(rate: number) => Promise<void>> {
  const cdp = await page.context().newCDPSession(page);
  return async (rate) => {
    await cdp.send("Emulation.setCPUThrottlingRate", { rate });
  };
}

test("the switch is one paint each way, as a map's is: the canvas is whole until the scene is there, the scene comes styled, turned and named, and Picture puts the canvas back", async ({ page }) => {
  await page.goto("./#/templates/built-in/review-gate");
  await expect(node(page, "builder")).toBeVisible();
  await expect(view(page, "3D")).toBeVisible();
  await page.getByRole("button", { name: "Close panel" }).click();
  const where = async () => JSON.stringify(await node(page, "builder").boundingBox());
  await expect.poll(async () => (await where()) === (await where())).toBe(true);
  const before = await where();
  const legend = page.locator(".stage > .loop-legend");
  await expect(legend).toBeVisible();

  // The first press of a visit, with the scene's piece still on its way: the switch has moved, and nothing else has.
  const arrivals = await noteArrivals(page);
  const scene = await holdTheScene(page);
  await view(page, "3D").click();
  await scene.asked;
  await expect(view(page, "3D")).toHaveAttribute("aria-checked", "true");
  await expect(legend).toBeVisible();
  await expect(page.locator(".space")).toHaveCount(0);
  expect(await where()).toBe(before);

  // It arrives on a slow device, and is whole in the turn that draws it: its styles, its starting view, its names.
  const slowed = await slowing(page);
  await slowed(6);
  scene.release();
  await expect(page.locator(".space-scene")).toBeVisible();
  await slowed(1);
  await expect.poll(() => posed(page)).toContain("scale3d(");
  expect(await arrivals()).toEqual([{ styled: true, posed: true, named: true }]);
  // With the scene the loops' names leave the canvas: they are on the sheets.
  await expect(legend).toBeHidden();

  // Back: the canvas is as it was, with its loops' names, in the same change.
  await view(page, "Picture").click();
  await expect(page.locator(".space")).toHaveCount(0);
  await expect(legend).toBeVisible();
  await expect.poll(where).toBe(before);

  // A later press, with the piece in hand, and back again.
  await slowed(6);
  await view(page, "3D").click();
  await expect(page.locator(".space-scene")).toBeVisible();
  await slowed(1);
  expect(await arrivals()).toEqual([
    { styled: true, posed: true, named: true },
    { styled: true, posed: true, named: true },
  ]);
  await view(page, "Picture").click();
  await expect(page.locator(".space")).toHaveCount(0);
  await expect.poll(where).toBe(before);
});

test("on a run's page the canvas keeps its size until the scene is there; in 3D the page makes room for it and does not lie under it, and Picture gives the room back", async ({ page }) => {
  await page.goto(linkFor(runBundle("slice-0007-sandwich")));
  await expect(page.locator(".react-flow__node").first()).toBeVisible();
  await expect(view(page, "3D")).toBeVisible();
  const stage = page.locator(".run-stage");
  const panel = page.locator(".run-panel");
  const height = async () => Math.round((await stage.boundingBox())!.height);
  const top = async () => Math.round((await panel.boundingBox())!.y);
  const [short, under] = [await height(), await top()];
  const bigger = page.getByRole("button", { name: "Bigger graph" });
  await expect(bigger).toBeVisible();

  // Pressed, with the piece on its way: the page has not moved.
  const scene = await holdTheScene(page);
  await view(page, "3D").click();
  await scene.asked;
  await expect(view(page, "3D")).toHaveAttribute("aria-checked", "true");
  await expect(bigger).toBeVisible();
  expect([await height(), await top()]).toEqual([short, under]);

  // With the scene the stage is given a screen's room, and what is under it moves down: nothing of the run's
  // summary is behind the scene.
  scene.release();
  await expect(page.locator(".space-scene")).toBeVisible();
  await expect.poll(() => posed(page)).toContain("scale3d(");
  expect(await height()).toBeGreaterThan(short + 100);
  const foot = await stage.evaluate((el) => Math.round(el.getBoundingClientRect().bottom));
  expect(await top()).toBeGreaterThanOrEqual(foot - 1);
  await expect(bigger).toBeHidden();
  // The scene has the room a viewer's bar would take at the foot, and its slider and words are read without scrolling.
  expect((await page.locator(".space-scene").boundingBox())!.height).toBeGreaterThan(300);
  expect(await page.locator(".graph-space").evaluate((el) => el.scrollHeight - el.clientHeight)).toBeLessThanOrEqual(1);

  await view(page, "Picture").click();
  await expect(page.locator(".space")).toHaveCount(0);
  await expect.poll(async () => [await height(), await top()]).toEqual([short, under]);
  await expect(bigger).toBeVisible();
});

/* ─── behind doors (decision 0021): the switch comes with a canvas, the scene when 3D is chosen ─── */

test("an address with no canvas fetches neither piece; a canvas fetches the switch, and only choosing 3D fetches the scene", async ({ page }) => {
  const asked = { views: 0, space: 0 };
  page.on("request", (r) => {
    const path = new URL(r.url()).pathname;
    if (/\/assets\/graph-views-[^/]*\.js$/.test(path)) asked.views += 1;
    if (/\/assets\/space-[^/]*\.js$/.test(path)) asked.space += 1;
  });
  await page.goto("./");
  await expect(page.locator(".land-headline")).toBeVisible();
  await page.goto("./#/templates");
  await expect(page.getByRole("heading", { name: "Templates", level: 1 })).toBeVisible();
  await page.waitForTimeout(300);
  expect(asked).toEqual({ views: 0, space: 0 });

  await page.goto("./#/templates/built-in/grind-loop");
  await expect(view(page, "3D")).toBeVisible();
  expect(asked).toEqual({ views: 1, space: 0 });
  await page.getByRole("button", { name: "Close panel" }).click();
  await threeD(page);
  expect(asked).toEqual({ views: 1, space: 1 });
  await view(page, "Picture").click();
  await threeD(page);
  expect(asked).toEqual({ views: 1, space: 1 });
});

test("the scene is asked for like the app's other pieces: it comes though its load fails until its file is fetched, and without it the switch says so", async ({ page }) => {
  let fetches = 0;
  await page.route(/\/assets\/space-[^/]*\.js$/, (route) => {
    if (route.request().resourceType() === "fetch") {
      fetches += 1;
      return route.continue();
    }
    return fetches > 0 ? route.continue() : route.abort();
  });
  await page.goto("./#/templates/built-in/grind-loop");
  await page.getByRole("button", { name: "Close panel" }).click();
  await threeD(page);
  expect(fetches).toBe(1);

  // No connection for it at all, in a page of its own: the switch says so and stays on the picture.
  await page.unroute(/\/assets\/space-[^/]*\.js$/);
  await page.goto("./");
  await page.route(/\/assets\/space-[^/]*\.js$/, (route) => route.abort());
  await page.goto("./#/templates/built-in/grind-loop");
  await page.getByRole("button", { name: "Close panel" }).click();
  await view(page, "3D").click();
  await expect(page.locator(".graph-views-note")).toHaveText("The view in three dimensions could not be fetched. The picture shows the same graph.");
  await expect(view(page, "Picture")).toHaveAttribute("aria-checked", "true");
  await expect(node(page, "builder")).toBeVisible();
});

test.describe("from 1100 px", () => {
  test.use({ viewport: { width: 1440, height: 900 }, isMobile: false, hasTouch: false, deviceScaleFactor: 1 });

  test("where there is room a sheet holds six cards in a row, and the template's details stay beside the view", async ({ page }) => {
    await page.goto("./#/templates/built-in/gauntlet-decomposed");
    await expect(node(page, "planner")).toBeVisible();
    await threeD(page);
    // The first sheet has six nodes of its own: one row.
    const depths = await page.locator(".space-card").evaluateAll((els) => els.slice(0, 6).map((el) => /translate3d\([^,]+,[^,]+,([^)]+)\)/.exec((el as HTMLElement).style.transform)![1]));
    expect(new Set(depths).size).toBe(1);
    await expect(sheet(page)).toBeVisible();
    await expect(page.getByRole("button", { name: "Starting view" })).toBeVisible();
  });
});
