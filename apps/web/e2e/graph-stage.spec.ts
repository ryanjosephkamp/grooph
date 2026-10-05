import { readFileSync } from "node:fs";
import { join } from "node:path";

import { parseGraphText, type Graph } from "@grooph/core";
import { expect, test, type Page } from "@playwright/test";

import { canvasIsQuiet, linkFor, node, repoRoot, reviewLoop, runBundle, sheet, viewIsStill } from "./support.js";
import { namedStill, noteMoves, slowest } from "./support-moves.js";

/**
 * A graph's other kinds of view in three dimensions (handoff 0096): the row that offers them, the stage that draws
 * them, and the first of them, Panes. The stairs and the move into them are graph-space.spec.ts's, left as written.
 */
const pattern = (id: string): Graph => parseGraphText(readFileSync(join(repoRoot, `patterns/${id}.grooph.json`), "utf8")).doc!;
const view = (page: Page, name: string) => page.getByRole("radiogroup", { name: "View of the graph" }).getByRole("radio", { name });
const kinds = (page: Page) => page.getByRole("radiogroup", { name: "Kind of view in three dimensions" });
const kind = (page: Page, name: string) => kinds(page).getByRole("radio", { name });
const cards = (page: Page) => page.locator(".s3-card");
const says = (page: Page) => page.locator(".s3-says");
const STAGE = /\/assets\/graph-stage-[^/]*\.js$/;
/** Where a card is on the screen, to the pixel: the stage has drawn it, and is drawing it nowhere else. */
const where = async (page: Page, id: string) => JSON.stringify(await page.locator(`.s3-card[data-node="${id}"]`).boundingBox().then((b) => (b ? [b.x, b.y, b.width, b.height].map(Math.round) : null)));

/** Choose 3D, then the kind, and wait until it is drawn and the move to it has ended. */
async function open(page: Page, name = "Panes"): Promise<void> {
  await view(page, "3D").click();
  await expect(kinds(page)).toBeVisible();
  await viewIsStill(page);
  await kind(page, name).click();
  await expect(page.locator(".s3-frame")).toBeVisible();
  await expect(kind(page, name)).toHaveAttribute("aria-checked", "true");
  await viewIsStill(page);
}

test("the row of kinds is there only while a view in three dimensions is up; Panes has every node as a card that is a button with its name, where the picture has it", async ({ page }) => {
  const doc = pattern("review-gate");
  await page.goto("./#/templates/built-in/review-gate");
  await expect(node(page, "builder")).toBeVisible();
  await canvasIsQuiet(page);
  await page.getByRole("button", { name: "Close panel" }).click();
  // On the picture there is the switch and no row.
  await expect(kinds(page)).toHaveCount(0);

  await view(page, "3D").click();
  await expect(page.locator(".space-scene")).toBeVisible();
  // The row says which kind this is, and offers the others, each with what it is.
  await expect(kinds(page).getByRole("radio")).toHaveText(["Stairs", "Panes"]);
  await expect(kind(page, "Stairs")).toHaveAttribute("aria-checked", "true");
  await expect(kind(page, "Panes")).toHaveAttribute("aria-description", /pane of its own/);
  await viewIsStill(page);

  await kind(page, "Panes").click();
  await expect(page.locator(".s3-frame")).toBeVisible();
  await viewIsStill(page);
  await expect(page.locator(".space")).toHaveCount(0);
  await expect(kind(page, "Panes")).toHaveAttribute("aria-checked", "true");
  await expect(view(page, "3D")).toHaveAttribute("aria-checked", "true");
  // Every node a card: a button, with the name the canvas gives its node, and what the canvas says under it.
  await expect(cards(page)).toHaveCount(doc.nodes.length);
  await expect(page.getByRole("button", { name: "Agent Builder" })).toHaveText("Builderbuilder · strong · high");
  await expect(page.getByRole("button", { name: "Human gate Merge approval" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Stop Done" })).toBeVisible();
  // Whole in the frame, and in the picture's order down the page.
  const frame = (await page.locator(".s3-frame").boundingBox())!;
  const boxes = await Promise.all(["builder", "critic", "merge-gate", "done"].map(async (id) => (await page.locator(`.s3-card[data-node="${id}"]`).boundingBox())!));
  for (const box of boxes) {
    expect(box.x).toBeGreaterThanOrEqual(frame.x);
    expect(box.x + box.width).toBeLessThanOrEqual(frame.x + frame.width);
    expect(box.y).toBeGreaterThanOrEqual(frame.y);
    expect(box.y + box.height).toBeLessThanOrEqual(frame.y + frame.height);
  }
  expect(boxes.map((b) => b.y)).toEqual([...boxes.map((b) => b.y)].sort((a, b) => a - b));
  // The three in the loop are one pane toward the reader, which from the starting view is to the left of what stays.
  expect(Math.max(...boxes.slice(0, 3).map((b) => b.x))).toBeLessThan(boxes[3]!.x);
  await expect(page.locator(".s3-frame")).toHaveAttribute("aria-label", /^Review gate as panes: 4 cards, 5 edges, and the loop Review\./);
  await expect(page.locator(".s3-note")).toHaveText(/as many panes toward you as there are loops and boxes round it/);

  // Back to the stairs by the row, and to the picture by the switch: the row goes with the view.
  await kind(page, "Stairs").click();
  await expect(page.locator(".space-scene")).toBeVisible();
  await expect(page.locator(".s3")).toHaveCount(0);
  await viewIsStill(page);
  await view(page, "Picture").click();
  await expect(page.locator(".space")).toHaveCount(0);
  await expect(kinds(page)).toHaveCount(0);
  await expect(node(page, "builder")).toBeVisible();
});

test("a card opens what its node does on the canvas; a drag turns the view and opens nothing; the keyboard turns it too", async ({ page }) => {
  await page.goto(linkFor(reviewLoop()));
  await expect(node(page, "builder")).toBeVisible();
  await canvasIsQuiet(page);
  // The review loop is a row on this canvas, and a row on the panes, in the same order: the layout is the canvas's
  // own, not a column of this view's. (A row seen from the side runs away from the reader, so it is told by its order.)
  const across = async (list: ReturnType<typeof cards>) => (await list.evaluateAll((els) => els.map((el) => [(el as HTMLElement).dataset["id"] ?? (el as HTMLElement).dataset["node"]!, el.getBoundingClientRect().left] as const))).sort((a, b) => a[1] - b[1]).map(([id]) => id);
  const tops = await page.locator(".react-flow__node").evaluateAll((els) => new Set(els.map((el) => Math.round(el.getBoundingClientRect().top))).size);
  expect(tops).toBe(1);
  const onCanvas = await across(page.locator(".react-flow__node"));
  await open(page);
  expect(await across(cards(page))).toEqual(onCanvas);
  const start = await where(page, "critic");

  await page.getByRole("button", { name: "Agent Critic" }).click();
  await expect(sheet(page).getByText("Critic").first()).toBeVisible();
  await page.getByRole("button", { name: "Close panel" }).click();
  // From the keyboard: the card is a button.
  await page.getByRole("button", { name: "Human gate Merge approval" }).focus();
  await page.keyboard.press("Enter");
  await expect(sheet(page).getByText("Merge approval").first()).toBeVisible();
  await page.getByRole("button", { name: "Close panel" }).click();

  // A drag that starts on a card turns the view: the card is somewhere else, and nothing was opened.
  const box = (await page.locator('.s3-card[data-node="builder"]').boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 90, box.y + box.height / 2 + 30, { steps: 6 });
  await page.mouse.up();
  await expect.poll(() => where(page, "critic")).not.toBe(start);
  await expect(sheet(page)).toHaveCount(0);
  // A key on a card after a drag is still a tap on it: the drag is over.
  await page.getByRole("button", { name: "Agent Builder" }).focus();
  await page.keyboard.press("Enter");
  await expect(sheet(page).getByText("Builder").first()).toBeVisible();
  await page.getByRole("button", { name: "Close panel" }).click();
  // The starting view again, by its button; then the arrow keys, with the frame in focus.
  await page.getByRole("button", { name: "Starting view" }).click();
  await expect.poll(() => where(page, "critic")).toBe(start);
  await page.locator(".s3-frame").focus();
  await page.keyboard.press("ArrowRight");
  await expect.poll(() => where(page, "critic")).not.toBe(start);
  await page.keyboard.press("Home");
  await expect.poll(() => where(page, "critic")).toBe(start);
  // In and out, by the buttons: the cards move apart and come back.
  await page.getByRole("button", { name: "Move in" }).click();
  await expect.poll(() => where(page, "critic")).not.toBe(start);
  await page.getByRole("button", { name: "Move out" }).click();
  await expect.poll(() => where(page, "critic")).toBe(start);
});

test("the slider walks a first pass, lighting each edge's two ends; on a run's page it walks the run's notes, and a note about the run picks nothing out", async ({ page }) => {
  await page.goto("./#/templates/built-in/review-gate");
  await canvasIsQuiet(page);
  await page.getByRole("button", { name: "Close panel" }).click();
  await open(page);
  const steps = page.getByRole("slider", { name: "Step, in the order a first pass takes them" });
  await expect(steps).toHaveAttribute("max", "5");
  await expect(says(page)).toHaveText(/^All 5 edges are lit\./);
  await expect(page.locator(".s3-card.is-dim, .s3-card.is-lit")).toHaveCount(0);
  await page.getByRole("button", { name: "Next step" }).click();
  await expect(says(page)).toHaveText("Step 1 of 5: Builder to Critic · always");
  await expect(page.locator(".s3-card.is-lit")).toHaveText(["Builderbuilder · strong · high", "Criticcritic · strong · high"]);
  await expect(page.locator(".s3-card.is-dim")).toHaveCount(2);
  // The last step is a way back: one turn of the loop.
  await steps.fill("5");
  await expect(says(page)).toHaveText("Step 5 of 5: Merge approval to Builder · fail · back into Review: another round");
  await page.getByRole("button", { name: "Previous step" }).click();
  await expect(says(page)).toHaveText(/^Step 4 of 5: /);

  // A recorded run: its own notes.
  const run = runBundle("slice-0007-sandwich");
  await page.goto(linkFor(run));
  await expect(page.locator(".react-flow__node").first()).toBeVisible();
  await canvasIsQuiet(page);
  // The kind is the tab's for the visit: 3D opens Panes again.
  await view(page, "3D").click();
  await expect(page.locator(".s3-frame")).toBeVisible();
  await viewIsStill(page);
  const notes = page.getByRole("slider", { name: "Note, in the order the run wrote them" });
  await expect(notes).toHaveAttribute("max", String(run.notes.length));
  await expect(says(page)).toHaveText(/^The whole run: 6 dispatches in rounds 0 and 1\. Sandwich stopped on bar passed in round 1\./);
  // Note 2 is about the run as a whole, an amendment: nothing is picked out, so nothing steps back.
  await notes.fill("2");
  await expect(says(page)).toHaveText(/^Note 2 of 15, an amendment: /);
  await expect(page.locator(".s3-card.is-dim, .s3-card.is-lit")).toHaveCount(0);
  // Note 6 is the critic's fail in round 0.
  await notes.fill("6");
  await expect(says(page)).toHaveText("Note 6 of 15: Critic: fail · round 0");
  await expect(page.locator(".s3-card.is-lit")).toHaveAttribute("data-node", "critic");
  // Note 8 is a proposal about an edge: its two ends are lit, and it is said not to be a move.
  await notes.fill("8");
  await expect(says(page)).toHaveText(/^Note 8 of 15, a proposal about the edge .+, not a move along it: /);
  await expect(page.locator(".s3-card.is-lit")).toHaveCount(2);
  await page.getByRole("button", { name: "Next note" }).click();
  await expect(says(page)).toHaveText("Note 9 of 15: Builder: pass (done) · round 1");
  // Play walks on from where it is, and Pause stops it there.
  await page.getByRole("button", { name: "Play" }).click();
  await expect(says(page)).toHaveText(/^Note 10 of 15: /);
  await page.getByRole("button", { name: "Pause" }).click();
  await expect(page.getByRole("button", { name: "Play" })).toBeVisible();
});

test("on a run's page the view has the room the stairs have: the page makes room under it, nothing of it needs scrolling, and Picture gives the room back", async ({ page }) => {
  await page.goto(linkFor(runBundle("slice-0007-sandwich")));
  await expect(page.locator(".react-flow__node").first()).toBeVisible();
  await canvasIsQuiet(page);
  const stage = page.locator(".run-stage");
  const height = async () => Math.round((await stage.boundingBox())!.height);
  const short = await height();
  await open(page);
  expect(await height()).toBeGreaterThan(short + 100);
  expect((await page.locator(".s3-frame").boundingBox())!.height).toBeGreaterThan(240);
  expect(await page.locator(".graph-space").evaluate((el) => el.scrollHeight - el.clientHeight)).toBeLessThanOrEqual(1);
  const foot = await stage.evaluate((el) => Math.round(el.getBoundingClientRect().bottom));
  expect(Math.round((await page.locator(".run-panel").boundingBox())!.y)).toBeGreaterThanOrEqual(foot - 1);
  await view(page, "Picture").click();
  await expect(page.locator(".s3")).toHaveCount(0);
  await expect.poll(height).toBe(short);
});

test("the picture becomes the panes, the stairs become the panes, and each back: every node is seen to go to its card, and nothing moves while the stage is fetched", async ({ page }) => {
  const moves = await noteMoves(page);
  let release!: () => void;
  const held = new Promise<void>((resolve) => (release = resolve));
  await page.route(STAGE, async (route) => {
    await held;
    await route.continue();
  });
  await page.goto("./#/templates/built-in/review-gate");
  await expect(node(page, "builder")).toBeVisible();
  await canvasIsQuiet(page);
  await page.getByRole("button", { name: "Close panel" }).click();
  const nodes = await page.locator(".react-flow__node").count();
  const whole = { pairs: nodes, ended: true };

  await view(page, "3D").click();
  await expect(page.locator(".space-scene")).toBeVisible();
  await expect.poll(moves).toEqual([whole]);
  // Panes pressed, with its piece on its way: the row has followed the press, and the stairs are still what is drawn.
  const asked = page.waitForRequest(STAGE);
  await kind(page, "Panes").click();
  await asked;
  await expect(kind(page, "Panes")).toHaveAttribute("aria-checked", "true");
  await expect(page.locator(".space-scene")).toBeVisible();
  await expect(page.locator(".s3")).toHaveCount(0);
  expect([await moves(), await namedStill(page)]).toEqual([[whole], 0]);

  // It comes: the stairs' cards are seen to go to the panes' cards.
  release();
  await expect(page.locator(".s3-frame")).toBeVisible();
  await expect.poll(moves).toEqual(Array(2).fill(whole));
  await expect(page.locator(".space")).toHaveCount(0);
  // To the picture, and each card goes home to its node; and 3D again opens the panes, straight from the picture.
  await view(page, "Picture").click();
  await expect(page.locator(".s3")).toHaveCount(0);
  await expect.poll(moves).toEqual(Array(3).fill(whole));
  await view(page, "3D").click();
  await expect(page.locator(".s3-frame")).toBeVisible();
  await expect.poll(moves).toEqual(Array(4).fill(whole));
  // And to the stairs by the row.
  await kind(page, "Stairs").click();
  await expect(page.locator(".space-scene")).toBeVisible();
  await expect.poll(moves).toEqual(Array(5).fill(whole));
  expect([await namedStill(page), (await slowest(page)) < 2500]).toEqual([0, true]);
});

test.describe("with reduced motion", () => {
  test.use({ reducedMotion: "reduce" });
  test("no move is started between any of the views, and each is drawn in one paint, its cards in their places", async ({ page }) => {
    const moves = await noteMoves(page);
    await page.goto("./#/templates/built-in/review-gate");
    await canvasIsQuiet(page);
    await page.getByRole("button", { name: "Close panel" }).click();
    // What the cards are like at the moment the stage is put on the page: told before the browser paints.
    await page.evaluate(() => {
      new MutationObserver(() => {
        const first = document.querySelector<HTMLElement>(".s3-card");
        const log = ((window as unknown as { __placed?: boolean[] }).__placed ??= []);
        if (first && !first.dataset["seen"]) ((first.dataset["seen"] = "1"), log.push([...document.querySelectorAll<HTMLElement>(".s3-card")].every((el) => el.style.transform.startsWith("translate("))));
      }).observe(document.body, { childList: true, subtree: true });
    });
    await open(page);
    expect(await page.evaluate(() => (window as unknown as { __placed?: boolean[] }).__placed)).toEqual([true]);
    await view(page, "Picture").click();
    await expect(page.locator(".s3")).toHaveCount(0);
    await view(page, "3D").click();
    await expect(page.locator(".s3-frame")).toBeVisible();
    expect(await moves()).toEqual([]);
    // The slider's steps are taken at once: what travels is where it is going.
    await page.getByRole("button", { name: "Next step" }).click();
    await expect(says(page)).toHaveText(/^Step 1 of 5: /);
  });
});

test("the kind chosen is the tab's for the visit: 3D opens it again, after a reload too; and the stage is fetched once, when one of its kinds is first chosen", async ({ page }) => {
  let fetched = 0;
  page.on("request", (request) => void (STAGE.test(new URL(request.url()).pathname) && (fetched += 1)));
  await page.goto("./#/templates/built-in/grind-loop");
  await canvasIsQuiet(page);
  await page.getByRole("button", { name: "Close panel" }).click();
  await view(page, "3D").click();
  await expect(page.locator(".space-scene")).toBeVisible();
  await viewIsStill(page);
  // The stairs are the map's piece: the stage has not been asked for.
  expect(fetched).toBe(0);
  await kind(page, "Panes").click();
  await expect(page.locator(".s3-frame")).toBeVisible();
  await viewIsStill(page);
  expect(fetched).toBe(1);
  await view(page, "Picture").click();
  await expect(page.locator(".s3")).toHaveCount(0);
  await viewIsStill(page);
  await view(page, "3D").click();
  await expect(page.locator(".s3-frame")).toBeVisible();
  await viewIsStill(page);
  expect(fetched).toBe(1);

  await page.reload();
  await canvasIsQuiet(page);
  await page.getByRole("button", { name: "Close panel" }).click();
  await view(page, "3D").click();
  await expect(page.locator(".s3-frame")).toBeVisible();
  await expect(kind(page, "Panes")).toHaveAttribute("aria-checked", "true");
  await expect(page.locator(".space")).toHaveCount(0);
});

test("when the stage cannot be fetched the row says so, and the stairs stay", async ({ page }) => {
  await page.route(STAGE, (route) => route.abort());
  await page.goto("./#/templates/built-in/grind-loop");
  await canvasIsQuiet(page);
  await page.getByRole("button", { name: "Close panel" }).click();
  await view(page, "3D").click();
  await expect(page.locator(".space-scene")).toBeVisible();
  await viewIsStill(page);
  await kind(page, "Panes").click();
  await expect(page.locator(".graph-views-note")).toHaveText("That view could not be fetched. This one shows the same graph.");
  await expect(kind(page, "Stairs")).toHaveAttribute("aria-checked", "true");
  await expect(page.locator(".space-scene")).toBeVisible();
  await expect(page.locator(".s3")).toHaveCount(0);
});

test("when the kind the visit remembers cannot be fetched from the picture, the page says so and 3D opens the stairs", async ({ page }) => {
  await page.addInitScript(() => sessionStorage.setItem("groophSpace", "panes"));
  await page.route(STAGE, (route) => route.abort());
  await page.goto("./#/templates/built-in/grind-loop");
  await canvasIsQuiet(page);
  await page.getByRole("button", { name: "Close panel" }).click();
  await view(page, "3D").click();
  await expect(page.locator(".graph-views-note")).toHaveText("That view in three dimensions could not be fetched. The picture shows the same graph, and so do the stairs.");
  await expect(view(page, "Picture")).toHaveAttribute("aria-checked", "true");
  await expect(node(page, "builder")).toBeVisible();
  // The next press is not the same failure again: it is the stairs, and the note has gone with the new choice.
  await view(page, "3D").click();
  await expect(page.locator(".space-scene")).toBeVisible();
  await expect(kind(page, "Stairs")).toHaveAttribute("aria-checked", "true");
  await expect(page.locator(".graph-views-note")).toHaveCount(0);
});

test("a kept picture theme leaves the panes in Paper, and the canvas is in the theme again after", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("groophPicture", "phosphor"));
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto(linkFor(reviewLoop()));
  const stage = page.locator("main.stage");
  await expect(stage).toHaveAttribute("data-look", "phosphor");
  await canvasIsQuiet(page);
  await expect(stage.locator(".look-dot")).toBeVisible();
  await open(page);
  // What holds a view in three dimensions is not dressed while it holds one, and the themes' dot steps aside.
  await expect(stage).not.toHaveAttribute("data-look", /.+/);
  await expect(stage.locator(".look-dot")).toBeHidden();
  // A card is the app's own surface with its own ink: light, with dark words, where Phosphor is the other way round.
  const [ground, ink] = await page.locator('.s3-card[data-node="builder"]').evaluate((el) => {
    const lum = (rgb: string): number => {
      const probe = document.createElement("canvas").getContext("2d")!;
      probe.fillStyle = rgb;
      probe.fillRect(0, 0, 1, 1);
      const [r, g, b] = probe.getImageData(0, 0, 1, 1).data;
      return (r! * 299 + g! * 587 + b! * 114) / 255000;
    };
    return [lum(getComputedStyle(el).backgroundColor), lum(getComputedStyle(el).color)];
  });
  expect(ground).toBeGreaterThan(0.85);
  expect(ink).toBeLessThan(0.35);
  await view(page, "Picture").click();
  await expect(page.locator(".s3")).toHaveCount(0);
  await expect(stage).toHaveAttribute("data-look", "phosphor");
  await expect(stage.locator(".look-dot")).toBeVisible();
});

test.describe("from 1100 px", () => {
  test.use({ viewport: { width: 1440, height: 900 }, isMobile: false, hasTouch: false, deviceScaleFactor: 1 });
  test("where there is room the panes are larger, whole in their frame, and a template's details stay beside the view", async ({ page }) => {
    const doc = pattern("gauntlet-decomposed");
    await page.goto("./#/templates/built-in/gauntlet-decomposed");
    await canvasIsQuiet(page);
    await open(page);
    await expect(cards(page)).toHaveCount(doc.nodes.length);
    const frame = (await page.locator(".s3-frame").boundingBox())!;
    for (const box of await cards(page).evaluateAll((els) => els.map((el) => el.getBoundingClientRect().toJSON()))) {
      expect(box.left).toBeGreaterThanOrEqual(frame.x);
      expect(box.right).toBeLessThanOrEqual(frame.x + frame.width);
      expect(box.top).toBeGreaterThanOrEqual(frame.y);
      expect(box.bottom).toBeLessThanOrEqual(frame.y + frame.height);
    }
    // The inner loop's nodes are two panes out, the outer loop's own one: further to the left the nearer they are.
    const x = async (id: string) => (await page.locator(`.s3-card[data-node="${id}"]`).boundingBox())!.x;
    expect(await x("owner")).toBeLessThan(await x("next-piece"));
    expect(await x("next-piece")).toBeLessThan(await x("planner"));
    await expect(sheet(page)).toBeVisible();
  });
});
