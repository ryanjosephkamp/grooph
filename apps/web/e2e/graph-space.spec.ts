import { readFileSync } from "node:fs";
import { join } from "node:path";

import { parseGraphText, type Graph } from "@grooph/core";
import { expect, test, type Page } from "@playwright/test";

import { fixturePath, importDocument, linkFor, node, repoRoot, runBundle, sheet, viewIsStill } from "./support.js";

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

/** Choose 3D and wait until the scene is drawn and fitted, and the move to it has ended. */
async function threeD(page: Page): Promise<void> {
  await view(page, "3D").click();
  await expect(page.locator(".space-scene")).toBeVisible();
  await expect.poll(() => posed(page)).toContain("scale3d(");
  await viewIsStill(page);
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
  await viewIsStill(page);
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

/** Hold the scene's piece on its way, as a slow connection does; `release` lets it through. Asked for again, it holds again. */
async function holdTheScene(page: Page): Promise<{ asked: Promise<unknown>; release: () => void }> {
  let release!: () => void;
  const held = new Promise<void>((resolve) => (release = resolve));
  await page.unroute(/\/assets\/space-[^/]*\.js$/);
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

/**
 * With reduced motion, or in a browser with no view transitions, the switch is what it was before the picture was
 * made to become the scene: one paint each way. The two tests of that are as they were written, run in that mode.
 */
test.describe("with reduced motion the switch is one paint each way", () => {
  test.use({ reducedMotion: "reduce" });

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

  test("and no move is started: with reduced motion, and in a browser that has no view transitions", async ({ page }) => {
    const moves = await noteMoves(page);
    await page.goto("./#/templates/built-in/review-gate");
    await page.getByRole("button", { name: "Close panel" }).click();
    await threeD(page);
    await view(page, "Picture").click();
    await expect(page.locator(".space")).toHaveCount(0);
    expect(await moves()).toEqual([]);

    // No view transitions at all, and motion allowed: the same one paint, and nothing is asked of what is not there.
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await page.addInitScript(() => Object.defineProperty(document, "startViewTransition", { value: undefined }));
    await page.reload();
    await expect(node(page, "builder")).toBeVisible();
    await page.getByRole("button", { name: "Close panel" }).click();
    const arrivals = await noteArrivals(page);
    await threeD(page);
    expect(await arrivals()).toEqual([{ styled: true, posed: true, named: true }]);
    await view(page, "Picture").click();
    await expect(page.locator(".space")).toHaveCount(0);
    await expect(node(page, "builder")).toBeVisible();
  });
});

/* ─── the picture becomes the scene (the owner's notes of 2026-10-05): each node is seen to go to its card ─── */

type Move = { pairs: number; ended: boolean };

/**
 * Note each view transition the page starts: how many of the graph's parts the browser is carrying from a place
 * before to a place after (it has a picture of each both ways), read when its pictures are ready, and whether it
 * has ended. Asked for before the page is opened. With `held`, each move is stopped where it starts, with the page
 * under the browser's picture of it, until `letGo` is called in the page. `slowest` is the longest any took, from
 * being asked for to its end, in milliseconds: a browser left waiting for a change holds the page for seconds.
 */
async function noteMoves(page: Page, held = false): Promise<() => Promise<Move[]>> {
  await page.addInitScript((hold) => {
    const real = document.startViewTransition?.bind(document);
    if (!real) return;
    const log: { pairs: number; ended: boolean }[] = [];
    const took: number[] = [];
    const its = (): Animation[] => document.getAnimations().filter((a) => (a.effect as KeyframeEffect | null)?.pseudoElement?.startsWith("::view-transition"));
    const pictures = (side: string): string[] =>
      its()
        .map((a) => (a.effect as KeyframeEffect).pseudoElement!)
        .filter((part) => part.startsWith(`::view-transition-${side}(gv`))
        .map((part) => part.slice(part.indexOf("(")));
    Object.assign(window, { __moves: log, __took: took, letGo: () => its().forEach((a) => a.finish()) });
    document.startViewTransition = (update?: unknown) => {
      const from = performance.now();
      const move = real(update as ViewTransitionUpdateCallback);
      const seen = { pairs: -1, ended: false };
      const at = log.push(seen) - 1;
      void move.ready.then(
        () => {
          if (hold) its().forEach((a) => a.pause());
          const after = new Set(pictures("new"));
          seen.pairs = new Set(pictures("old").filter((name) => after.has(name))).size;
        },
        () => (seen.pairs = 0),
      );
      void move.finished.then(() => ((seen.ended = true), (took[at] = performance.now() - from)));
      return move;
    };
  }, held);
  return () => page.evaluate(() => (window as unknown as { __moves?: Move[] }).__moves ?? []);
}
const slowest = (page: Page): Promise<number> => page.evaluate(() => Math.max(0, ...((window as unknown as { __took?: number[] }).__took ?? [])));

/** Where everything of the scene stands on the screen: its cards, sheets and arcs, and how its world is turned. */
const stands = (page: Page): Promise<string> =>
  page.evaluate(() =>
    JSON.stringify([
      document.querySelector<HTMLElement>(".space-world")!.style.transform,
      ...[...document.querySelectorAll(".space-card, .space-sheet, .space-arc")].map((el) => {
        const box = el.getBoundingClientRect();
        return [box.x, box.y, box.width, box.height].map(Math.round);
      }),
    ]),
  );
/** How many parts of the page still carry a name for the browser to move them by. */
const namedStill = (page: Page): Promise<number> => page.evaluate(() => [...document.querySelectorAll<HTMLElement>(".react-flow__node, .space-card")].filter((el) => el.style.getPropertyValue("view-transition-name")).length);

test("the picture becomes the scene and the scene the picture: nothing moves while the scene is fetched, then every node is seen to go to its card and back, and each ends as it is with no motion", async ({ page }) => {
  const moves = await noteMoves(page);
  // The scene with no motion at all, first: what the move must end on.
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("./#/templates/built-in/review-gate");
  await page.getByRole("button", { name: "Close panel" }).click();
  await threeD(page);
  const asItIs = await stands(page);
  expect(await moves()).toEqual([]);

  // Then a visit of its own, with motion.
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.reload();
  await expect(node(page, "builder")).toBeVisible();
  await expect(view(page, "3D")).toBeVisible();
  await page.getByRole("button", { name: "Close panel" }).click();
  const where = async () => JSON.stringify(await node(page, "builder").boundingBox());
  await expect.poll(async () => (await where()) === (await where())).toBe(true);
  const before = await where();
  const nodes = await page.locator(".react-flow__node").count();
  const legend = page.locator(".stage > .loop-legend");

  // The first press of a visit: the scene's piece is on its way, and nothing has moved or been named.
  const scene = await holdTheScene(page);
  await view(page, "3D").click();
  await scene.asked;
  await expect(view(page, "3D")).toHaveAttribute("aria-checked", "true");
  await expect(legend).toBeVisible();
  expect([await moves(), await namedStill(page)]).toEqual([[], 0]);

  // It comes: one move, of every node, and it ends on the scene as it is with no motion, with no name left on it.
  scene.release();
  await expect(page.locator(".space-scene")).toBeVisible();
  await expect.poll(moves).toEqual([{ pairs: nodes, ended: true }]);
  expect(await stands(page)).toBe(asItIs);
  expect(await namedStill(page)).toBe(0);
  await expect(legend).toBeHidden();
  const cards = await page.locator(".space [data-node]").evaluateAll((els) => els.map((el) => [el.getAttribute("aria-label"), el.getAttribute("role")]));
  expect(cards.length === nodes && cards.every(([name, role]) => !!name && role === "button")).toBe(true);

  // Back: every card is seen to go home, and the canvas is as it was.
  await view(page, "Picture").click();
  await expect(page.locator(".space")).toHaveCount(0);
  await expect.poll(moves).toEqual(Array(2).fill({ pairs: nodes, ended: true }));
  await expect(legend).toBeVisible();
  expect([await where(), await namedStill(page)]).toEqual([before, 0]);

  // And again, both ways: the names of the first time were taken off, so no part has two and every move is whole.
  await threeD(page);
  await view(page, "Picture").click();
  await expect(page.locator(".space")).toHaveCount(0);
  await expect.poll(moves).toEqual(Array(4).fill({ pairs: nodes, ended: true }));
  expect([await where(), await namedStill(page)]).toEqual([before, 0]);
});

test("a tap while the picture is becoming the scene does nothing and no harm, and the same tap works once the move has ended", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(String(error)));
  // Each move is stopped where it starts, so that "while" is not a matter of being quick.
  const moves = await noteMoves(page, true);
  const letGo = () => page.evaluate(() => (window as unknown as { letGo: () => void }).letGo());
  await page.goto("./#/templates/built-in/review-gate");
  await expect(node(page, "builder")).toBeVisible();
  await expect(view(page, "3D")).toBeVisible();
  await page.getByRole("button", { name: "Close panel" }).click();
  const nodes = await page.locator(".react-flow__node").count();
  const center = async (of: ReturnType<typeof view>) => {
    const box = (await of.boundingBox())!;
    return [box.x + box.width / 2, box.y + box.height / 2] as const;
  };
  const rests = async () => JSON.stringify(await node(page, "builder").boundingBox());
  await expect.poll(async () => (await rests()) === (await rests())).toBe(true);
  const picture = await center(view(page, "Picture"));
  const builder = await center(node(page, "builder"));

  await view(page, "3D").click();
  await expect.poll(moves).toEqual([{ pairs: nodes, ended: false }]);
  // On the way: the browser shows its picture of the page, and a finger on it reaches nothing under it.
  await page.touchscreen.tap(...picture);
  await page.touchscreen.tap(...builder);
  await expect(view(page, "3D")).toHaveAttribute("aria-checked", "true");
  await expect(page.locator(".space")).toHaveCount(1);
  await expect(sheet(page)).toHaveCount(0);
  expect(await moves()).toEqual([{ pairs: nodes, ended: false }]);

  // Ended: the page is the page again, and the tap on Picture that did nothing now starts the way back.
  await letGo();
  await expect.poll(moves).toEqual([{ pairs: nodes, ended: true }]);
  await viewIsStill(page);
  await page.touchscreen.tap(...picture);
  await expect.poll(moves).toEqual([
    { pairs: nodes, ended: true },
    { pairs: nodes, ended: false },
  ]);
  await letGo();
  await expect.poll(async () => (await moves()).every((move) => move.ended)).toBe(true);
  await expect(view(page, "Picture")).toHaveAttribute("aria-checked", "true");
  await expect(page.locator(".space")).toHaveCount(0);
  await viewIsStill(page);
  // And the canvas takes a finger again: the node opens what it opens.
  await page.touchscreen.tap(...builder);
  await expect(sheet(page).getByText("Builder").first()).toBeVisible();
  expect(errors).toEqual([]);
});

test("presses while the scene is on its way: it is fetched once, moves once when it comes, and the page is never left waiting", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(String(error)));
  const moves = await noteMoves(page);
  let fetched = 0;
  page.on("request", (request) => void (/\/assets\/space-[^/]*\.js$/.test(new URL(request.url()).pathname) && (fetched += 1)));
  await page.goto("./#/templates/built-in/review-gate");
  await expect(node(page, "builder")).toBeVisible();
  await expect(view(page, "3D")).toBeVisible();
  await page.getByRole("button", { name: "Close panel" }).click();
  const nodes = await page.locator(".react-flow__node").count();

  // 3D, Picture and 3D again before the piece has come: the switch follows each press, and nothing moves.
  const scene = await holdTheScene(page);
  await view(page, "3D").click();
  await scene.asked;
  await view(page, "Picture").click();
  await expect(view(page, "Picture")).toHaveAttribute("aria-checked", "true");
  await view(page, "3D").click();
  await expect(view(page, "3D")).toHaveAttribute("aria-checked", "true");
  expect([await moves(), fetched]).toEqual([[], 1]);
  // It comes: one move, whole, and over in the time a move takes.
  scene.release();
  await expect(page.locator(".space-scene")).toBeVisible();
  await expect.poll(moves).toEqual([{ pairs: nodes, ended: true }]);
  expect(await slowest(page)).toBeLessThan(2500);
  await view(page, "Picture").click();
  await expect(page.locator(".space")).toHaveCount(0);
  await expect.poll(moves).toEqual(Array(2).fill({ pairs: nodes, ended: true }));

  // In a visit of its own: Picture asked for again before the piece has come. When it comes the page is the picture
  // already, and nothing moves; the next press of 3D has the piece and moves.
  await page.reload();
  await expect(node(page, "builder")).toBeVisible();
  await page.getByRole("button", { name: "Close panel" }).click();
  const second = await holdTheScene(page);
  const again = page.waitForResponse(/\/assets\/space-[^/]*\.js$/);
  await view(page, "3D").click();
  await second.asked;
  await view(page, "Picture").click();
  await expect(view(page, "Picture")).toHaveAttribute("aria-checked", "true");
  second.release();
  await (await again).finished();
  await expect(view(page, "Picture")).toHaveAttribute("aria-checked", "true");
  await expect(page.locator(".space")).toHaveCount(0);
  expect(await moves()).toEqual([]);
  await threeD(page);
  await expect.poll(moves).toEqual([{ pairs: nodes, ended: true }]);

  // And the reader gone to another screen before it has come: no move is made of a screen that never asked for one.
  await page.reload();
  await expect(node(page, "builder")).toBeVisible();
  const third = await holdTheScene(page);
  const late = page.waitForResponse(/\/assets\/space-[^/]*\.js$/);
  await view(page, "3D").click();
  await third.asked;
  await page.goto("./#/templates");
  await expect(page.getByRole("heading", { name: "Templates", level: 1 })).toBeVisible();
  third.release();
  await (await late).finished();
  await viewIsStill(page);
  expect(await moves()).toEqual([]);
  await page.locator('.template-row[data-template="review-gate"]').tap();
  await expect(node(page, "builder")).toBeVisible();
  expect(errors).toEqual([]);
});

test("a key pressed while it moves is taken: the view asked for last is the one the page ends on, whole, with no name left and no error", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(String(error)));
  const moves = await noteMoves(page, true);
  const letGo = () => page.evaluate(() => (window as unknown as { letGo: () => void }).letGo());
  await page.goto("./#/templates/built-in/review-gate");
  await expect(node(page, "builder")).toBeVisible();
  await expect(view(page, "3D")).toBeVisible();
  await page.getByRole("button", { name: "Close panel" }).click();
  const nodes = await page.locator(".react-flow__node").count();
  const where = async () => JSON.stringify(await node(page, "builder").boundingBox());
  await expect.poll(async () => (await where()) === (await where())).toBe(true);
  const before = await where();

  await view(page, "3D").click();
  await expect.poll(moves).toEqual([{ pairs: nodes, ended: false }]);
  // A finger reaches nothing while it moves; the keyboard does. Picture, from the keyboard, with the first move held.
  await view(page, "Picture").focus();
  await page.keyboard.press("Enter");
  // The browser gives the first move up for the second, which is whole: every card is seen to go home, though the
  // first move's end came between its being asked for and its being drawn.
  await expect.poll(async () => (await moves())[0]!.ended).toBe(true);
  await expect.poll(async () => (await moves())[1]).toEqual({ pairs: nodes, ended: false });
  await letGo();
  await expect.poll(async () => (await moves()).every((move) => move.ended)).toBe(true);
  await viewIsStill(page);
  await expect(view(page, "Picture")).toHaveAttribute("aria-checked", "true");
  await expect(page.locator(".space")).toHaveCount(0);
  expect([await where(), await namedStill(page), errors]).toEqual([before, 0, []]);

  // And the next press moves whole again: the names the two left were taken off.
  await view(page, "3D").click();
  await expect.poll(async () => (await moves())[2]).toEqual({ pairs: nodes, ended: false });
  await letGo();
  await expect.poll(async () => (await moves())[2]!.ended).toBe(true);
  expect([await namedStill(page), errors]).toEqual([0, []]);
});

test("two presses in one breath: the page ends on the view asked for last, and a move the browser gives up is nobody's error", async ({ page }) => {
  // Nothing here listens to the moves themselves: a move given up that nobody had read would be an error of the page's.
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(String(error)));
  await page.goto("./#/templates/built-in/review-gate");
  await expect(node(page, "builder")).toBeVisible();
  await expect(view(page, "3D")).toBeVisible();
  await page.getByRole("button", { name: "Close panel" }).click();
  const where = async () => JSON.stringify(await node(page, "builder").boundingBox());
  await expect.poll(async () => (await where()) === (await where())).toBe(true);
  const before = await where();
  // Two presses with nothing drawn between them, as taps kept waiting by a busy phone arrive.
  const press = (first: number, then: number) =>
    page.evaluate(
      ([a, b]) => {
        const radios = document.querySelectorAll<HTMLElement>('[role="radiogroup"][aria-label="View of the graph"] [role="radio"]');
        radios[a!]!.click();
        radios[b!]!.click();
      },
      [first, then],
    );
  await threeD(page);

  // Picture, then 3D: the first move is given up for the second, and the scene stays.
  await press(0, 1);
  await viewIsStill(page);
  await expect(view(page, "3D")).toHaveAttribute("aria-checked", "true");
  await expect(page.locator(".space-scene")).toBeVisible();
  expect(await namedStill(page)).toBe(0);
  // Picture, 3D, Picture.
  await press(0, 1);
  await view(page, "Picture").focus();
  await page.keyboard.press("Enter");
  await viewIsStill(page);
  await expect(view(page, "Picture")).toHaveAttribute("aria-checked", "true");
  await expect(page.locator(".space")).toHaveCount(0);
  // From the picture: 3D, then Picture. The page was the picture and is.
  await press(1, 0);
  await viewIsStill(page);
  await expect(view(page, "Picture")).toHaveAttribute("aria-checked", "true");
  await expect(page.locator(".space")).toHaveCount(0);
  expect([await where(), await namedStill(page), errors]).toEqual([before, 0, []]);
  // And a press after all that is a press: the scene comes.
  await threeD(page);
  expect(errors).toEqual([]);
});

test("with a template's details over the foot of a phone, only the nodes in sight are seen to go: nothing crosses what it was behind", async ({ page }) => {
  const moves = await noteMoves(page);
  await page.goto("./#/templates/built-in/gauntlet-decomposed");
  await expect(node(page, "planner")).toBeVisible();
  await expect(view(page, "3D")).toBeVisible();
  const all = page.locator(".react-flow__node");
  const where = async () => JSON.stringify(await node(page, "planner").boundingBox());
  await expect.poll(async () => (await where()) === (await where())).toBe(true);
  // In sight: a node whose middle the stage holds. The stage ends where the details begin, and cuts the canvas there.
  const inSight = await all.evaluateAll((els) => {
    const room = document.querySelector("main.stage")!.getBoundingClientRect();
    return els.filter((el) => {
      const box = el.getBoundingClientRect();
      const y = box.y + box.height / 2;
      return y > room.top && y < room.bottom;
    }).length;
  });
  // The details begin where the stage ends, and no part of the stage is under them: what the stage holds is in sight.
  expect(await page.locator("aside.sheet").evaluate((el) => Math.round(el.getBoundingClientRect().top - document.querySelector("main.stage")!.getBoundingClientRect().bottom))).toBeGreaterThanOrEqual(-1);
  const nodes = await all.count();
  expect(inSight).toBeGreaterThan(0);
  expect(inSight).toBeLessThan(nodes);

  await threeD(page);
  await expect(page.locator(".space [data-node]")).toHaveCount(nodes);
  await expect.poll(moves).toEqual([{ pairs: inSight, ended: true }]);
  await view(page, "Picture").click();
  await expect(page.locator(".space")).toHaveCount(0);
  await expect.poll(moves).toEqual(Array(2).fill({ pairs: inSight, ended: true }));
  expect(await namedStill(page)).toBe(0);
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
