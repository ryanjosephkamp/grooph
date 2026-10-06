import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { parseGraphText, resolvePositions, type Graph } from "@grooph/core";
import { expect, test, type Page } from "@playwright/test";

import { canvasIsQuiet, closeSheet, importDocument, linkFor, node, repoRoot, reviewLoop, runBundle, sheet, viewIsStill } from "./support.js";
import { landed, namedStill, noteMoves, slowest } from "./support-moves.js";

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
const STAIRS = /\/assets\/space-[^/]*\.js$/;
/** The built-in templates whose cards still touch in Panes under an open details sheet, at two phones' sizes. */
const TIGHT_390: string[] = ["debate-then-build", "gauntlet-decomposed", "ownership-not-swarm", "patrol-pulse", "specialist-critic-bank", "tournament-then-judge"];
const MARGIN_360: string[] = ["heterogeneous-critic", "review-gate"];
const TIGHT_360: string[] = ["debate-then-build", "gauntlet-decomposed", "merge-queue", "ownership-not-swarm", "patrol-pulse", "spec-then-loop", "specialist-critic-bank", "tournament-then-judge"];
/** Whether the note that a view could not be fetched lies over any of the view's bar, its picture or its words. */
const noteIsClear = (page: Page) =>
  page.evaluate(() => {
    const note = document.querySelector(".graph-views-note")!.getBoundingClientRect();
    const view = document.querySelector(".graph-space > *")!.getBoundingClientRect();
    return note.height > 0 && view.height > 0 && note.bottom <= view.top;
  });
/** Where a card is on the screen, to the pixel: the stage has drawn it, and is drawing it nowhere else. */
const where = async (page: Page, id: string) => JSON.stringify(await page.locator(`.s3-card[data-node="${id}"]`).boundingBox().then((b) => (b ? [b.x, b.y, b.width, b.height].map(Math.round) : null)));

/** How high each card's middle is: a card with a name on two lines is taller than its neighbor, and as high. */
const tops = (list: ReturnType<typeof cards>) => list.evaluateAll((els) => els.map((el) => [(el as HTMLElement).dataset["id"] ?? (el as HTMLElement).dataset["node"]!, Math.round(el.getBoundingClientRect().top + el.getBoundingClientRect().height / 2)] as const));
/** The canvas's rows, top to bottom: the nodes at each height. */
const canvasRows = async (page: Page) => {
  const at = await tops(page.locator(".react-flow__node"));
  return [...new Set(at.map(([, top]) => top))].sort((a, b) => a - b).map((top) => at.filter(([, t]) => t === top).map(([id]) => id));
};
/**
 * The panes have the rows the canvas has: each row is under the one before it by more than the cards of either differ
 * among themselves. (A row seen from the side slopes a little, and a card on a nearer pane stands a little lower;
 * rows wrapped elsewhere would put two of the canvas's rows on one such slope, or split one over two heights.)
 */
async function panesHaveRows(page: Page, rows: string[][]): Promise<void> {
  const at = new Map(await tops(cards(page)));
  expect(at.size).toBe(rows.flat().length);
  const span = (row: string[]): [number, number] => [Math.min(...row.map((id) => at.get(id)!)), Math.max(...row.map((id) => at.get(id)!))];
  for (let n = 1; n < rows.length; n += 1) {
    const [above, under] = [span(rows[n - 1]!), span(rows[n]!)];
    expect(under[0] - above[1], `row ${n}`).toBeGreaterThan(1.5 * Math.max(above[1] - above[0], under[1] - under[0], 4));
  }
}

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
  await expect(kinds(page).getByRole("radio")).toHaveText(["Stairs", "Panes", "Spiral", "Rings"]);
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
  await expect(page.getByRole("button", { name: "Agent Builder" })).toHaveAttribute("aria-description", "in the loop Review");
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
  await expect(page.locator(".s3-note")).toHaveText("Every node is where the picture has it, one pane toward you for each loop or subgrooph around it; loops that only share a node are panes at one depth. An edge that changes depth is entering or leaving a loop or a subgrooph.");

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
  const across = async (list: ReturnType<typeof cards>) => (await list.evaluateAll((els) => els.map((el) => [(el as HTMLElement).dataset["id"] ?? (el as HTMLElement).dataset["node"]!, el.getBoundingClientRect().left] as const))).sort((a, b) => a[1] - b[1]);
  const tops = await page.locator(".react-flow__node").evaluateAll((els) => new Set(els.map((el) => Math.round(el.getBoundingClientRect().top))).size);
  expect(tops).toBe(1);
  const onCanvas = await across(page.locator(".react-flow__node"));
  await open(page);
  const onPanes = await across(cards(page));
  expect(onPanes.map(([id]) => id)).toEqual(onCanvas.map(([id]) => id));
  // Each card is to the right of the one before it by more than a hair: in a column they would share a left edge,
  // and be in this order only because the document is.
  for (let n = 1; n < onPanes.length; n += 1) expect(onPanes[n]![1] - onPanes[n - 1]![1], onPanes[n]![0]).toBeGreaterThan(20);
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
  // The sentences are the stairs' own, word for word: the two views speak alike.
  await expect(says(page)).toHaveText("All 5 steps are lit. Move the slider or press Play to follow a first pass, one edge at a time.");
  await expect(page.locator(".s3-card.is-dim, .s3-card.is-lit")).toHaveCount(0);
  // What goes along the edge is seen over the cards while it travels, and is put away when it is there: the lit
  // card is where the step is.
  await page.evaluate(() => {
    const token = document.querySelector<HTMLElement>(".s3-token")!;
    const seen: boolean[] = ((window as unknown as { tokenSeen: boolean[] }).tokenSeen = []);
    new MutationObserver(() => seen.push(!token.hidden && token.getBoundingClientRect().width > 0)).observe(token, { attributes: true });
  });
  await expect(page.locator(".s3-token")).toBeHidden();
  await page.getByRole("button", { name: "Next step" }).click();
  await expect(says(page)).toHaveText("Step 1 of 5: Builder to Critic");
  await expect.poll(() => page.evaluate(() => (window as unknown as { tokenSeen: boolean[] }).tokenSeen.includes(true))).toBe(true);
  await expect(page.locator(".s3-token")).toBeHidden();
  await expect(page.locator(".s3-card.is-lit")).toHaveText(["Builderbuilder · strong · high", "Criticcritic · strong · high"]);
  await expect(page.locator(".s3-card.is-dim")).toHaveCount(2);
  // The last step is a way back: one turn of the loop.
  await steps.fill("5");
  await expect(says(page)).toHaveText(/^Step 5 of 5: Merge approval to Builder · when fail · back into Review: another round, until .*max iterations: 4/);
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
  await expect(says(page)).toHaveText(/^The whole run: 6 dispatches, in rounds 0 and 1 of Sandwich\. Sandwich stopped on bar passed in round 1\./);
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

test("on a run's page the view has the room the stairs have: the page makes room under it, the slider and its sentence need no scrolling, and Picture gives the room back", async ({ page }) => {
  await page.goto(linkFor(runBundle("slice-0007-sandwich")));
  await expect(page.locator(".react-flow__node").first()).toBeVisible();
  await canvasIsQuiet(page);
  const stage = page.locator(".run-stage");
  const height = async () => Math.round((await stage.boundingBox())!.height);
  const short = await height();
  await open(page);
  expect(await height()).toBeGreaterThan(short + 100);
  expect((await page.locator(".s3-frame").boundingBox())!.height).toBeGreaterThan(240);
  // The frame may take the room of the view's own sentence, to be large enough to read, and no more: the slider
  // and what it says are in sight as the page stands.
  const sight = (await page.locator(".graph-space").boundingBox())!;
  for (const part of [".s3-frame", ".s3-steps", ".s3-says"]) {
    const box = (await page.locator(part).boundingBox())!;
    expect(box.y, part).toBeGreaterThanOrEqual(sight.y);
    expect(box.y + box.height, part).toBeLessThanOrEqual(sight.y + sight.height + 1);
  }
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
  // What each move carried its parts to: the panes' own cards, not the picture's nodes under them.
  expect(await landed(page)).toEqual(["stairs", "stage", "picture", "stage", "stairs"]);
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
    // The slider's steps are taken at once: nothing is seen to travel, and the lit cards are where the step is.
    await page.evaluate(() => {
      const token = document.querySelector<HTMLElement>(".s3-token")!;
      const seen: boolean[] = ((window as unknown as { tokenSeen: boolean[] }).tokenSeen = []);
      new MutationObserver(() => seen.push(!token.hidden)).observe(token, { attributes: true });
    });
    await page.getByRole("button", { name: "Next step" }).click();
    await expect(says(page)).toHaveText(/^Step 1 of 5: /);
    await expect(page.locator(".s3-card.is-lit")).toHaveCount(2);
    await page.getByRole("button", { name: "Next step" }).click();
    await expect(says(page)).toHaveText(/^Step 2 of 5: /);
    expect(await page.evaluate(() => (window as unknown as { tokenSeen: boolean[] }).tokenSeen.includes(true))).toBe(false);
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
  // The note has a place of its own: the stairs and their bar are under it, not behind it.
  expect(await noteIsClear(page)).toBe(true);
  // A press of the kind that is drawn puts the note away.
  await kind(page, "Stairs").click();
  await expect(page.locator(".graph-views-note")).toHaveCount(0);
  await expect(page.locator(".space-scene")).toBeVisible();
});

test("when the stairs cannot be fetched and the panes are up, the row says so and the panes stay; from the picture, 3D then opens the panes", async ({ page }) => {
  await page.route(STAIRS, (route) => route.abort());
  await page.addInitScript(() => sessionStorage.getItem("groophSpace") ?? sessionStorage.setItem("groophSpace", "panes"));
  await page.goto("./#/templates/built-in/grind-loop");
  await canvasIsQuiet(page);
  await page.getByRole("button", { name: "Close panel" }).click();
  await view(page, "3D").click();
  await expect(page.locator(".s3-frame")).toBeVisible();
  await viewIsStill(page);
  await kind(page, "Stairs").click();
  // Under a view in three dimensions the note does not say that the picture is what is shown.
  await expect(page.locator(".graph-views-note")).toHaveText("That view could not be fetched. This one shows the same graph.");
  await expect(kind(page, "Panes")).toHaveAttribute("aria-checked", "true");
  await expect(page.locator(".s3-frame")).toBeVisible();
  await expect(page.locator(".space")).toHaveCount(0);
  expect(await noteIsClear(page)).toBe(true);
  // The kind that failed is not the one the visit remembers: from the picture, 3D opens the panes.
  expect(await page.evaluate(() => sessionStorage.getItem("groophSpace"))).toBe("panes");
  await view(page, "Picture").click();
  await expect(page.locator(".s3")).toHaveCount(0);
  await expect(page.locator(".graph-views-note")).toHaveCount(0);
  await viewIsStill(page);
  await view(page, "3D").click();
  await expect(page.locator(".s3-frame")).toBeVisible();
  await expect(kind(page, "Panes")).toHaveAttribute("aria-checked", "true");
});

test("when the stairs cannot be fetched from the picture, the page says so, and 3D then opens another kind", async ({ page }) => {
  await page.route(STAIRS, (route) => route.abort());
  await page.goto("./#/templates/built-in/grind-loop");
  await canvasIsQuiet(page);
  await page.getByRole("button", { name: "Close panel" }).click();
  await view(page, "3D").click();
  await expect(page.locator(".graph-views-note")).toHaveText("The view in three dimensions could not be fetched. The picture shows the same graph.");
  await expect(view(page, "Picture")).toHaveAttribute("aria-checked", "true");
  await expect(node(page, "builder")).toBeVisible();
  // The stairs are not asked for again as if nothing had happened: the panes can be reached.
  await view(page, "3D").click();
  await expect(page.locator(".s3-frame")).toBeVisible();
  await expect(kind(page, "Panes")).toHaveAttribute("aria-checked", "true");
  await expect(page.locator(".graph-views-note")).toHaveCount(0);
});

test("on a phone the panes wrap their rows where the canvas does, though the phone has been turned since; and a card says every loop and box round its node", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 780 });
  // A graph with more nodes in a rank than a phone's canvas puts side by side, and no layout of its own.
  await page.goto("./#/templates/built-in/specialist-critic-bank");
  await canvasIsQuiet(page);
  await page.getByRole("button", { name: "Close panel" }).click();
  // The canvas's rows: no more than two nodes in any, and more rows than a wide screen would have.
  const onCanvas = await canvasRows(page);
  expect(Math.max(...onCanvas.map((row) => row.length))).toBe(2);
  const wide = resolvePositions(pattern("specialist-critic-bank"), 4).positions;
  expect(onCanvas.length).toBeGreaterThan(new Set(Object.values(wide).map((at) => at.y)).size);
  // Turned on its side the window is wide enough for four to a row; the canvas keeps the rows it drew.
  await page.setViewportSize({ width: 780, height: 420 });
  expect(await canvasRows(page)).toEqual(onCanvas);
  await open(page);
  // And so do the panes.
  await panesHaveRows(page, onCanvas);
  await page.setViewportSize({ width: 390, height: 780 });

  // A node inside a loop, inside a subgrooph, inside a group: its card says all three, the nearest first.
  await page.goto(linkFor(parseGraphText(readFileSync(join(repoRoot, "fixtures/valid/subgrooph-in-a-graph.grooph.json"), "utf8")).doc!));
  await expect(page.locator(".react-flow__node").first()).toBeVisible();
  await canvasIsQuiet(page);
  await view(page, "3D").click();
  await expect(page.locator(".s3-frame")).toBeVisible();
  await expect(page.locator('.s3-card[data-node="review-builder"]')).toHaveAttribute("aria-description", "in the loop Review, in the subgrooph Review gate, in the group Review and release");
  await expect(page.locator('.s3-card[data-node="release"]')).toHaveAttribute("aria-description", "in the group Review and release");
  await expect(page.locator('.s3-card[data-node="plan"]')).not.toHaveAttribute("aria-description");
});

test("in the editor the canvas lays a changed document out for the window as it is then, and the panes wrap their rows with it", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 780 });
  // A document with more nodes in a rank than a phone puts side by side, and no layout of its own.
  await importDocument(page, "glyph-vocabulary.grooph.json", readFileSync(join(repoRoot, "fixtures/valid/glyph-vocabulary.grooph.json"), "utf8"));
  await expect(page.locator(".react-flow__node").first()).toBeVisible();
  await canvasIsQuiet(page);
  const narrow = await canvasRows(page);
  expect(Math.max(...narrow.map((row) => row.length))).toBe(2);
  // The window is made wider, and then the document is changed: the canvas lays it out again, more to a row.
  await page.setViewportSize({ width: 900, height: 700 });
  await page.locator(".react-flow__node").first().click();
  await sheet(page).getByLabel("Name", { exact: true }).fill("Renamed");
  await closeSheet(page);
  await expect.poll(async () => Math.max(...(await canvasRows(page)).map((row) => row.length))).toBeGreaterThan(2);
  const wider = await canvasRows(page);
  await open(page);
  await panesHaveRows(page, wider);
});

test("when neither piece can be fetched the page says only what is so, press after press, and the visit remembers no kind that was never drawn", async ({ page }) => {
  await page.route(STAIRS, (route) => route.abort());
  await page.route(STAGE, (route) => route.abort());
  await page.goto("./#/templates/built-in/grind-loop");
  await canvasIsQuiet(page);
  await page.getByRole("button", { name: "Close panel" }).click();
  const note = page.locator(".graph-views-note");
  for (const press of [1, 2, 3, 4]) {
    await view(page, "3D").click();
    // Never that the stairs show the graph: they could not be fetched either.
    await expect(note, `press ${press}`).toHaveText("The view in three dimensions could not be fetched. The picture shows the same graph.");
    await expect(view(page, "Picture")).toHaveAttribute("aria-checked", "true");
    expect(await page.evaluate(() => sessionStorage.getItem("groophSpace")), `press ${press}`).toBeNull();
    // A press of the picture, which is what is drawn, puts the note away.
    await view(page, "Picture").click();
    await expect(note).toHaveCount(0);
  }
  // The network is back: the next press draws a view, and that kind is what the visit remembers.
  await page.unroute(STAIRS);
  await page.unroute(STAGE);
  await view(page, "3D").click();
  await expect(page.locator(".space-scene, .s3-frame")).toBeVisible();
  const drawn = (await page.locator(".s3-frame").count()) ? "panes" : "stairs";
  await expect(kind(page, drawn === "panes" ? "Panes" : "Stairs")).toHaveAttribute("aria-checked", "true");
  expect(await page.evaluate(() => sessionStorage.getItem("groophSpace"))).toBe(drawn);
});

test("a kind that fails after the reader has gone back to the picture is said there, and 3D then opens the stairs they had", async ({ page }) => {
  // The first request is held until the reader has left; it and every try after it (`piece.ts` asks again) fail.
  let fail = (): void => {};
  let held = false;
  await page.route(STAGE, async (route) => {
    if (!held) ((held = true), await new Promise<void>((done) => (fail = done)));
    await route.abort();
  });
  await page.goto("./#/templates/built-in/grind-loop");
  await canvasIsQuiet(page);
  await page.getByRole("button", { name: "Close panel" }).click();
  await view(page, "3D").click();
  await expect(page.locator(".space-scene")).toBeVisible();
  await viewIsStill(page);
  const asked = page.waitForRequest(STAGE);
  await kind(page, "Panes").click();
  await asked;
  await view(page, "Picture").click();
  await expect(page.locator(".space")).toHaveCount(0);
  await viewIsStill(page);
  fail();
  await expect(page.locator(".graph-views-note")).toHaveText("That view in three dimensions could not be fetched. The picture shows the same graph, and so do the stairs.");
  // The visit remembers the stairs, which were drawn, and 3D opens them: not the kind that could not be had.
  expect(await page.evaluate(() => sessionStorage.getItem("groophSpace"))).toBe("stairs");
  await view(page, "3D").click();
  await expect(page.locator(".space-scene")).toBeVisible();
  await expect(kind(page, "Stairs")).toHaveAttribute("aria-checked", "true");
  await expect(page.locator(".graph-views-note")).toHaveCount(0);
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
  // What the visit remembers is not changed by a fetch that failed: a reload would try the panes again.
  expect(await page.evaluate(() => sessionStorage.getItem("groophSpace"))).toBe("panes");
  // The next press is not the same failure again: it is the stairs, and the note has gone with the new choice.
  await view(page, "3D").click();
  await expect(page.locator(".space-scene")).toBeVisible();
  await expect(kind(page, "Stairs")).toHaveAttribute("aria-checked", "true");
  await expect(page.locator(".graph-views-note")).toHaveCount(0);
  // The stairs are drawn, and are now what the visit remembers.
  expect(await page.evaluate(() => sessionStorage.getItem("groophSpace"))).toBe("stairs");
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

/** Whether anything has been drawn on the stage's canvas: the cards are elements over it, and are not on it. */
const drawnOn = (page: Page) => page.locator(".s3-frame canvas").evaluate((el) => (el as HTMLCanvasElement).getContext("2d")!.getImageData(0, 0, (el as HTMLCanvasElement).width, (el as HTMLCanvasElement).height).data.some((v) => v !== 0));

test("the spiral: every node a card, the loops' brakes said in words under it, and all but the cards grown once the cards have landed", async ({ page }) => {
  const doc = pattern("gauntlet-decomposed");
  await page.goto("./#/templates/built-in/gauntlet-decomposed");
  await expect(node(page, "planner")).toBeVisible();
  await canvasIsQuiet(page);
  await page.getByRole("button", { name: "Close panel" }).click();
  await view(page, "3D").click();
  await expect(kinds(page)).toBeVisible();
  await viewIsStill(page);
  await expect(kind(page, "Spiral")).toHaveAttribute("aria-description", /a round is one turn upward/);
  // What the stage's canvas holds at the moment the view is put on the page, read there and then: a test that
  // looked from outside would look some time after, and the growing starts a third of a second on.
  await page.evaluate(() => {
    const log: boolean[] = ((window as unknown as { drawnAtFirst: boolean[] }).drawnAtFirst = []);
    new MutationObserver(() => {
      const canvas = document.querySelector<HTMLCanvasElement>(".s3-frame canvas");
      if (canvas && !canvas.dataset["seen"]) ((canvas.dataset["seen"] = "1"), log.push(canvas.width > 0 && canvas.getContext("2d")!.getImageData(0, 0, canvas.width, canvas.height).data.some((v) => v !== 0)));
    }).observe(document.body, { childList: true, subtree: true });
  });
  await kind(page, "Spiral").click();
  await expect(page.locator(".s3-frame")).toBeVisible();
  // When the view comes its cards are there and nothing else is: the spirals are grown after.
  expect(await page.evaluate(() => (window as unknown as { drawnAtFirst: boolean[] }).drawnAtFirst)).toEqual([false]);
  await expect(cards(page)).toHaveCount(doc.nodes.length);
  await viewIsStill(page);
  await expect.poll(() => drawnOn(page)).toBe(true);
  await expect(kind(page, "Spiral")).toHaveAttribute("aria-checked", "true");
  await expect(page.locator(".space")).toHaveCount(0);
  await expect(page.locator(".s3-frame")).toHaveAttribute("aria-label", /^Gauntlet, decomposed as a spiral for each loop: 10 cards, 12 edges, and the loops Polish a piece, Pieces\./);
  // A node in no loop is its name alone, and still a button that says what it is. (At a phone's width every card
  // is; where there is room one on a spiral is whole: the test of the phone's layout holds both.)
  await expect(page.getByRole("button", { name: "Agent Piece owner" })).toHaveText(/^Piece owner.+/);
  await expect(page.locator('.s3-card[data-node="planner"]')).toHaveClass(/is-small/);
  await expect(page.locator('.s3-card[data-node="planner"] span')).toBeHidden();
  await expect(page.getByRole("button", { name: "Agent Planner" })).toBeVisible();
  // The brakes, loop by loop, in words: the lid, the rounds a person is asked after, the budget as a reading.
  const key = page.getByRole("list", { name: "Each loop's brakes" }).getByRole("listitem");
  await expect(key).toHaveText([
    "Polish a piece max iterations: 3 (the lid, over round 2); budget: 10 dispatches, at most 3 full rounds and 1 more (the dashed ring, a reading)",
    "Pieces a person is asked every 2 rounds (the amber rings); max iterations: 4 (the lid, over round 3); budget: 42 dispatches, at most 10 full rounds and 2 more (not drawn: above the rounds shown)",
  ]);
  // The last of the words under the view can be scrolled clear of the bar at the page's foot: the room the page
  // keeps for that bar comes after them.
  await page.locator(".graph-space").evaluate((el) => el.scrollTo(0, el.scrollHeight));
  const [last, bar] = [(await page.locator(".s3-note").boundingBox())!, (await page.locator(".viewer-bar").boundingBox())!];
  expect(last.y + last.height).toBeLessThanOrEqual(bar.y);
  await page.locator(".graph-space").evaluate((el) => el.scrollTo(0, 0));
  // The cards are whole in the frame.
  const frame = (await page.locator(".s3-frame").boundingBox())!;
  for (const box of await cards(page).evaluateAll((els) => els.map((el) => el.getBoundingClientRect().toJSON() as { left: number; right: number; top: number; bottom: number }))) {
    expect(box.left).toBeGreaterThanOrEqual(frame.x - 1);
    expect(box.right).toBeLessThanOrEqual(frame.x + frame.width + 1);
    expect(box.top).toBeGreaterThanOrEqual(frame.y - 1);
    expect(box.bottom).toBeLessThanOrEqual(frame.y + frame.height + 1);
  }
  // A card opens its node, as on the canvas; the slider walks the first pass and lights what each step is about.
  await page.getByRole("button", { name: "Agent Piece critic" }).click();
  await expect(sheet(page).getByText("Piece critic").first()).toBeVisible();
  await page.getByRole("button", { name: "Close panel" }).click();
  await page.getByRole("button", { name: "Next step" }).click();
  await expect(says(page)).toHaveText(/^Step 1 of 12: Planner to /);
  await expect(page.locator(".s3-card.is-lit")).toHaveCount(2);
  // Back to the panes and to the picture: the same cards, and then the canvas's nodes.
  await kind(page, "Panes").click();
  await expect(page.locator('.s3[data-kind="panes"]')).toBeVisible();
  await expect(page.getByRole("list", { name: "Each loop's brakes" })).toHaveCount(0);
  await viewIsStill(page);
  await view(page, "Picture").click();
  await expect(page.locator(".s3")).toHaveCount(0);
  await expect(node(page, "planner")).toBeVisible();
});

test("the spiral on a run's page walks the run's notes, and a graph with no loop says there is no spiral to draw", async ({ page }) => {
  const run = runBundle("run-nested");
  await page.goto(linkFor(run));
  await expect(page.locator(".react-flow__node").first()).toBeVisible();
  await canvasIsQuiet(page);
  await open(page, "Spiral");
  await expect(page.getByRole("slider", { name: "Note, in the order the run wrote them" })).toHaveAttribute("max", String(run.notes.length));
  await expect(says(page)).toHaveText(/^The whole run: 7 dispatches, in rounds 0 and 1 of Grind; round 0 of Phases\. /);
  // The words under the view are each in a row of their own, however long: none is written over the next.
  const rows = await page.locator(".s3 > *").evaluateAll((els) => els.map((el) => [el.getBoundingClientRect().top, el.getBoundingClientRect().top + Math.max(el.scrollHeight, el.getBoundingClientRect().height)] as const));
  for (let n = 1; n < rows.length; n += 1) expect(rows[n]![0], `row ${n}`).toBeGreaterThanOrEqual(rows[n - 1]![1] - 0.5);
  await expect(page.getByRole("list", { name: "Each loop's brakes" }).getByRole("listitem")).toHaveText(["Grind max iterations: 5 (the lid, over round 4); budget: 20 minutes (no place on the way up)", "Phases max iterations: 5 (the lid, over round 4); budget: 60 turns (no place on the way up)"]);
  await page.getByRole("slider", { name: "Note, in the order the run wrote them" }).fill("10");
  await expect(says(page)).toHaveText("Note 10 of 13: Builder: pass · round 0");
  await expect(page.locator(".s3-card.is-lit")).toHaveAttribute("data-node", "builder");
  // A note about a loop lights nothing among the cards: the others step back.
  await page.getByRole("slider", { name: "Note, in the order the run wrote them" }).fill("9");
  await expect(says(page)).toHaveText(/^Note 9 of 13: Phases: /);
  await expect(page.locator(".s3-card.is-lit")).toHaveCount(0);

  // No loop: every node is a whole card on the ground, and the stage says why nothing turns.
  await page.goto("./#/templates/built-in/tournament-then-judge");
  await canvasIsQuiet(page);
  await page.getByRole("button", { name: "Close panel" }).click();
  await view(page, "3D").click();
  await expect(page.locator('.s3[data-kind="spiral"] .s3-frame')).toBeVisible();
  await expect(cards(page)).toHaveCount(pattern("tournament-then-judge").nodes.length);
  await expect(page.locator(".s3-card.is-small")).toHaveCount(0);
  await expect(page.getByRole("list", { name: "Each loop's brakes" })).toHaveCount(0);
});

test.describe("the spiral with reduced motion", () => {
  test.use({ reducedMotion: "reduce" });
  test("is drawn whole at once: nothing is grown", async ({ page }) => {
    await page.goto("./#/templates/built-in/review-gate");
    await canvasIsQuiet(page);
    await page.getByRole("button", { name: "Close panel" }).click();
    await view(page, "3D").click();
    await expect(kinds(page)).toBeVisible();
    await page.evaluate(() => {
      const log: boolean[] = ((window as unknown as { drawnAtFirst: boolean[] }).drawnAtFirst = []);
      new MutationObserver(() => {
        const canvas = document.querySelector<HTMLCanvasElement>(".s3-frame canvas");
        if (canvas && !canvas.dataset["seen"]) ((canvas.dataset["seen"] = "1"), log.push(canvas.width > 0 && canvas.getContext("2d")!.getImageData(0, 0, canvas.width, canvas.height).data.some((v) => v !== 0)));
      }).observe(document.body, { childList: true, subtree: true });
    });
    await kind(page, "Spiral").click();
    await expect(page.locator(".s3-frame")).toBeVisible();
    // Whole at the moment it is put on the page, and not only by the time a test looks.
    expect(await page.evaluate(() => (window as unknown as { drawnAtFirst: boolean[] }).drawnAtFirst)).toEqual([true]);
    expect(await drawnOn(page)).toBe(true);
  });
});

test("the picture becomes the spiral and the panes become the spiral: every node is seen to go to its card", async ({ page }) => {
  const moves = await noteMoves(page);
  await page.goto("./#/templates/built-in/review-gate");
  await canvasIsQuiet(page);
  await page.getByRole("button", { name: "Close panel" }).click();
  const whole = { pairs: 4, ended: true };
  await open(page, "Panes");
  const before = (await moves()).length;
  await kind(page, "Spiral").click();
  await expect(page.locator('.s3[data-kind="spiral"]')).toBeVisible();
  await viewIsStill(page);
  await view(page, "Picture").click();
  await expect(page.locator(".s3")).toHaveCount(0);
  await viewIsStill(page);
  await view(page, "3D").click();
  await expect(page.locator('.s3[data-kind="spiral"]')).toBeVisible();
  await viewIsStill(page);
  await expect.poll(async () => (await moves()).slice(before)).toEqual([whole, whole, whole]);
  expect([await namedStill(page), (await slowest(page)) < 2500]).toEqual([0, true]);
});

/** Each pair of cards whose boxes lie over each other at all, as the page has them now. */
const overlaps = (page: Page) =>
  cards(page).evaluateAll((els) => {
    const boxes = els.map((el) => [(el as HTMLElement).dataset["node"]!, el.getBoundingClientRect()] as const);
    return boxes.flatMap(([a, p], i) => boxes.slice(i + 1).flatMap(([b, q]) => (p.left < q.right && q.left < p.right && p.top < q.bottom && q.top < p.bottom ? [`${a} over ${b}`] : [])));
  });

test("on a phone no card of any built-in template lies over another in Panes at rest: the frame is as tall as its cards need, and the page scrolls to the last of the words", async ({ page }) => {
  test.setTimeout(180_000);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => sessionStorage.getItem("groophSpace") ?? sessionStorage.setItem("groophSpace", "panes"));
  const ids = readdirSync(join(repoRoot, "patterns")).filter((f) => f.endsWith(".grooph.json")).map((f) => f.replace(".grooph.json", ""));
  expect(ids.length).toBeGreaterThanOrEqual(20);
  const found: Record<string, string[]> = {};
  const taller: string[] = [];
  for (const id of ids) {
    await page.goto("about:blank");
    await page.goto(`./#/templates/built-in/${id}`);
    await canvasIsQuiet(page);
    await page.getByRole("button", { name: "Close panel" }).click();
    await view(page, "3D").click();
    await expect(page.locator(".s3-frame")).toBeVisible();
    await viewIsStill(page);
    await expect(cards(page)).toHaveCount(pattern(id).nodes.length);
    const hits = await overlaps(page);
    if (hits.length) found[id] = hits;
    const frame = (await page.locator(".s3-frame").boundingBox())!;
    // Never taller than four fifths of what scrolls it: the page is scrolled from outside the frame.
    const room = await page.locator(".graph-space").evaluate((el) => el.clientHeight);
    expect(frame.height, id).toBeLessThanOrEqual(Math.round(room * 0.8) + 1);
    const asked = await page.locator(".s3").evaluate((el) => (el as HTMLElement).style.getPropertyValue("--s3-tall"));
    if (asked) taller.push(id);
    // Every card is whole in its frame, and what is under the frame can be scrolled to.
    for (const box of await cards(page).evaluateAll((els) => els.map((el) => el.getBoundingClientRect().toJSON() as { top: number; bottom: number; left: number; right: number }))) {
      expect(box.left, id).toBeGreaterThanOrEqual(frame.x - 1);
      expect(box.right, id).toBeLessThanOrEqual(frame.x + frame.width + 1);
      expect(box.top, id).toBeGreaterThanOrEqual(frame.y - 1);
      expect(box.bottom, id).toBeLessThanOrEqual(frame.y + frame.height + 1);
    }
    // Scrolled to its end, the last of the words is clear of the bar at the page's foot, not under it.
    await page.locator(".graph-space").evaluate((el) => el.scrollTo(0, el.scrollHeight));
    const [last, bar] = [(await page.locator(".s3-note").boundingBox())!, (await page.locator(".viewer-bar").boundingBox())!];
    expect(last.y + last.height, id).toBeLessThanOrEqual(bar.y);
  }
  // Said by name, so that a template that still has cards over each other at the cap is known, not hidden.
  expect(found).toEqual({});
  // The tall ones are given the room, and the short ones are left as they were.
  expect(taller).toContain("gauntlet-decomposed");
  expect(taller).not.toContain("grind-loop");
});

test("a frame made taller for its cards does not break the move: the picture becomes the panes and back, and each card stays where the move left it", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const moves = await noteMoves(page);
  await page.goto("./#/templates/built-in/gauntlet-decomposed");
  await expect(node(page, "planner")).toBeVisible();
  await canvasIsQuiet(page);
  await page.getByRole("button", { name: "Close panel" }).click();
  await open(page);
  const tall = await page.locator(".s3").evaluate((el) => (el as HTMLElement).style.getPropertyValue("--s3-tall"));
  expect(Number.parseInt(tall, 10)).toBeGreaterThan(340);
  await view(page, "Picture").click();
  await expect(page.locator(".s3")).toHaveCount(0);
  await viewIsStill(page);
  const before = (await moves()).length;
  // The stage is here already, so this move is the move alone. Where each card is when the browser is told the
  // page has changed is where it is at rest: the frame was given its height before then, and nothing jumps after.
  await page.evaluate(() => {
    const log: string[] = ((window as unknown as { cardsAtFirst: string[] }).cardsAtFirst = []);
    new MutationObserver(() => {
      const first = document.querySelector<HTMLElement>(".s3-card");
      if (first && !first.dataset["seen"]) ((first.dataset["seen"] = "1"), log.push(JSON.stringify([...document.querySelectorAll<HTMLElement>(".s3-card")].map((el) => [el.dataset["node"], Math.round(el.getBoundingClientRect().left), Math.round(el.getBoundingClientRect().top)]))));
    }).observe(document.body, { childList: true, subtree: true });
  });
  await view(page, "3D").click();
  await expect(page.locator(".s3-frame")).toBeVisible();
  await viewIsStill(page);
  const atRest = JSON.stringify(await cards(page).evaluateAll((els) => els.map((el) => [(el as HTMLElement).dataset["node"], Math.round(el.getBoundingClientRect().left), Math.round(el.getBoundingClientRect().top)])));
  expect(await page.evaluate(() => (window as unknown as { cardsAtFirst: string[] }).cardsAtFirst)).toEqual([atRest]);
  expect(await overlaps(page)).toEqual([]);
  await view(page, "Picture").click();
  await expect(page.locator(".s3")).toHaveCount(0);
  await viewIsStill(page);
  for (const id of ["planner", "owner", "done"]) await expect(node(page, id)).toBeVisible();
  // Both moves were made and ended, each carrying the nodes that were wholly on the screen at both ends: to the
  // panes' cards, and back to the picture's nodes.
  expect((await landed(page)).slice(before)).toEqual(["stage", "picture"]);
  const made = (await moves()).slice(before);
  expect(made.map((m) => m.ended)).toEqual([true, true]);
  for (const m of made) expect(m.pairs).toBeGreaterThan(0);
  expect([await namedStill(page), (await slowest(page)) < 2500]).toEqual([0, true]);
});

test("a template's page opens on a phone with its details sheet up: choosing a kind of 3D folds the sheet to its head, so no card lies over another; pulled up again, the frame stops at four fifths of what is left, and says so where cards touch", async ({ page }) => {
  test.setTimeout(240_000);
  await page.addInitScript(() => sessionStorage.getItem("groophSpace") ?? sessionStorage.setItem("groophSpace", "panes"));
  const ids = readdirSync(join(repoRoot, "patterns")).filter((f) => f.endsWith(".grooph.json")).map((f) => f.replace(".grooph.json", ""));
  const body = page.locator("aside.sheet .sheet-body");
  const tight = page.locator(".s3-bar .s3-tight");
  for (const [width, height] of [[390, 844], [360, 740]] as const) {
    await page.setViewportSize({ width, height });
    const touching: string[] = [];
    const told: string[] = [];
    for (const id of ids) {
      await page.goto("about:blank");
      await page.goto(`./#/templates/built-in/${id}`);
      await canvasIsQuiet(page);
      // The page opens with its details sheet over the lower half.
      await expect(body).toBeVisible();
      await view(page, "3D").click();
      await expect(page.locator(".s3-frame")).toBeVisible();
      await viewIsStill(page);
      // The sheet is down to its head, which is still there to be pressed; and the first sight has no card over another.
      await expect(body).toBeHidden();
      await expect(page.locator("aside.sheet .sheet-head")).toBeVisible();
      expect(await overlaps(page), `${id} at ${width}`).toEqual([]);
      await expect(tight).toBeHidden();
      // Pulled up again by its head: the frame has what is left, to four fifths of it.
      await page.locator("aside.sheet .sheet-title").click();
      await expect(body).toBeVisible();
      await expect.poll(async () => (await page.locator(".graph-space").evaluate((el) => el.clientHeight)) < 500).toBe(true);
      await page.waitForTimeout(80);
      const [frame, room] = [(await page.locator(".s3-frame").boundingBox())!.height, await page.locator(".graph-space").evaluate((el) => el.clientHeight)];
      expect(frame, id).toBeLessThanOrEqual(Math.max(180, Math.round(room * 0.8)) + 1);
      if ((await overlaps(page)).length) {
        touching.push(id);
        // What the frame had, for the log: which templates touch at the margin is the browser's text to say (a
        // card 52 px tall has its name on two lines).
        console.log(`touching at ${width}: ${id}, frame ${Math.round(frame)} of ${room}, cards ${(await cards(page).evaluateAll((els) => els.map((el) => `${(el as HTMLElement).offsetWidth}x${(el as HTMLElement).offsetHeight}`))).join(" ")}`);
      }
      if (await tight.isVisible()) told.push(id);
    }
    // Where cards touch under the sheet, the bar says so and what to do; and it says so nowhere else.
    expect(told, `at ${width}`).toEqual(touching);
    // Said by name: half a phone's screen is not room for these. Closing the sheet, or the fold, clears every one.
    // At the smaller size two more are at the margin, and touch in one browser's text and not in another's: both
    // have a node named "Merge approval", the widest name that fits one line of a card. Chromium on Linux puts
    // it on two (CI's log: that card 52 px tall among 38s, in the same 296 px of room), the card is a line
    // taller, and the 12 px these two have under the cap are not enough for it.
    const [always, may] = width === 390 ? [TIGHT_390, []] : [TIGHT_360, MARGIN_360];
    expect(touching.filter((id) => !may.includes(id)), `at ${width}`).toEqual(always);
  }
  // And the picture brings the sheet back as it was.
  await view(page, "Picture").click();
  await expect(page.locator(".s3")).toHaveCount(0);
  await expect(body).toBeVisible();
});

test("the frame's height is worked out again when its room changes, whichever came first; where the page was scrolled to is kept; and no error is raised on the way", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => void (message.type() === "error" && errors.push(message.text())));
  // An observer that changes what it watches is told so by an error event on the window, which is listened for
  // there: whether or not the browser also hands it to the test as a page error.
  await page.addInitScript(() => {
    const seen: string[] = ((window as unknown as { errorsSeen: string[] }).errorsSeen = []);
    window.addEventListener("error", (event) => seen.push(event.message));
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => sessionStorage.getItem("groophSpace") ?? sessionStorage.setItem("groophSpace", "panes"));
  await page.goto("./#/templates/built-in/review-gate");
  await canvasIsQuiet(page);
  await page.getByRole("button", { name: "Close panel" }).click();
  await view(page, "3D").click();
  await expect(page.locator(".s3-frame")).toBeVisible();
  await viewIsStill(page);
  const asked = () => page.locator(".s3").evaluate((el) => (el as HTMLElement).style.getPropertyValue("--s3-tall"));
  const tall = async () => Math.round((await page.locator(".s3-frame").boundingBox())!.height);
  // All the room: the review gate's four cards are clear.
  expect(await overlaps(page)).toEqual([]);
  const whole = await tall();
  // A card's sheet takes the lower half: the frame would fall to its floor, where the cards touch. It is given
  // what they need instead, and they are clear.
  await page.getByRole("button", { name: "Agent Critic" }).click();
  await expect(sheet(page).locator(".sheet-body")).toBeVisible();
  await expect.poll(tall).toBeLessThan(whole);
  await expect.poll(() => overlaps(page)).toEqual([]);
  const half = await tall();
  expect(half).toBeGreaterThan(180);
  expect(await asked()).not.toBe("");
  // The sheet first and Panes after gives the same height as Panes first and the sheet after.
  await view(page, "Picture").click();
  await expect(page.locator(".s3")).toHaveCount(0);
  await viewIsStill(page);
  await view(page, "3D").click();
  await expect(page.locator(".s3-frame")).toBeVisible();
  await viewIsStill(page);
  await page.locator("aside.sheet .sheet-title").click();
  await expect(sheet(page).locator(".sheet-body")).toBeVisible();
  await expect.poll(async () => Math.abs((await tall()) - half)).toBeLessThanOrEqual(1);
  // And with the sheet closed the frame has all the room again.
  await page.getByRole("button", { name: "Close panel" }).click();
  await expect.poll(tall).toBe(whole);

  // A tall graph, scrolled part of the way; then the window is made a little narrower, and the height is worked out
  // again. The page is where it was scrolled to.
  await page.goto("./#/templates/built-in/gauntlet-decomposed");
  await canvasIsQuiet(page);
  await page.getByRole("button", { name: "Close panel" }).click();
  await view(page, "3D").click();
  await expect(page.locator(".s3-frame")).toBeVisible();
  await viewIsStill(page);
  const before = await asked();
  expect(before).not.toBe("");
  const scroller = page.locator(".graph-space");
  await scroller.evaluate((el) => el.scrollTo(0, 60));
  expect(await scroller.evaluate((el) => el.scrollTop)).toBe(60);
  await page.setViewportSize({ width: 376, height: 844 });
  await expect.poll(async () => (await page.locator(".s3-frame").boundingBox())!.width).toBeLessThan(360);
  await expect.poll(asked).not.toBe("");
  await page.waitForTimeout(150);
  expect(await scroller.evaluate((el) => el.scrollTop)).toBe(60);
  expect(await overlaps(page)).toEqual([]);
  expect(errors).toEqual([]);
  expect(await page.evaluate(() => (window as unknown as { errorsSeen: string[] }).errorsSeen)).toEqual([]);
});

test("in the spiral, as a template's page first opens on a phone, no card of any built-in template lies over another: the spirals stand one under the other, and a card there is its name alone", async ({ page }) => {
  test.setTimeout(240_000);
  await page.addInitScript(() => sessionStorage.getItem("groophSpace") ?? sessionStorage.setItem("groophSpace", "spiral"));
  const ids = readdirSync(join(repoRoot, "patterns")).filter((f) => f.endsWith(".grooph.json")).map((f) => f.replace(".grooph.json", ""));
  for (const [width, height] of [[390, 844], [360, 740]] as const) {
    await page.setViewportSize({ width, height });
    const touching: Record<string, string[]> = {};
    for (const id of ids) {
      await page.goto("about:blank");
      await page.goto(`./#/templates/built-in/${id}`);
      await canvasIsQuiet(page);
      await view(page, "3D").click();
      await expect(page.locator('.s3[data-kind="spiral"] .s3-frame')).toBeVisible();
      await viewIsStill(page);
      await expect(cards(page)).toHaveCount(pattern(id).nodes.length);
      const hits = await overlaps(page);
      if (hits.length) touching[id] = hits;
      const [frame, room] = [(await page.locator(".s3-frame").boundingBox())!, await page.locator(".graph-space").evaluate((el) => el.clientHeight)];
      expect(frame.height, id).toBeGreaterThanOrEqual(329);
      expect(frame.height, id).toBeLessThanOrEqual(Math.round(room * 0.8) + 1);
      for (const box of await cards(page).evaluateAll((els) => els.map((el) => el.getBoundingClientRect().toJSON() as { top: number; bottom: number; left: number; right: number }))) {
        expect(box.left, id).toBeGreaterThanOrEqual(frame.x - 1);
        expect(box.right, id).toBeLessThanOrEqual(frame.x + frame.width + 1);
        expect(box.top, id).toBeGreaterThanOrEqual(frame.y - 1);
        expect(box.bottom, id).toBeLessThanOrEqual(frame.y + frame.height + 1);
      }
    }
    expect(touching, `at ${width}`).toEqual({});
  }
  // Gauntlet's two spirals: Pieces under Polish a piece, not beside it; and every card its name alone.
  await page.goto("about:blank");
  await page.goto("./#/templates/built-in/gauntlet-decomposed");
  await canvasIsQuiet(page);
  await view(page, "3D").click();
  await expect(page.locator(".s3-frame")).toBeVisible();
  await viewIsStill(page);
  const at = async (id: string) => (await page.locator(`.s3-card[data-node="${id}"]`).boundingBox())!;
  const [inner, outer] = [await at("critic"), await at("next-piece")];
  expect(outer.y).toBeGreaterThan(inner.y + 100);
  expect(Math.abs(outer.x - inner.x)).toBeLessThan(140);
  await expect(page.locator(".s3-card:not(.is-small)")).toHaveCount(0);
  // A card that is its name alone is as wide as its name: none is cut short.
  expect(await cards(page).evaluateAll((els) => els.filter((el) => el.querySelector("b")!.scrollWidth > el.querySelector("b")!.clientWidth + 1).map((el) => el.textContent))).toEqual([]);
  // A wide window whose frame is not: with a template's details beside the view the frame is a phone's width, and
  // it is the frame's width that says how the spirals stand. A graph with no loop is a column there, with room.
  await page.setViewportSize({ width: 1024, height: 768 });
  for (const id of ["gauntlet-decomposed", "tournament-then-judge"]) {
    await page.goto("about:blank");
    await page.goto(`./#/templates/built-in/${id}`);
    await canvasIsQuiet(page);
    await view(page, "3D").click();
    await expect(page.locator(".s3-frame")).toBeVisible();
    await viewIsStill(page);
    expect((await page.locator(".s3-frame").boundingBox())!.width, id).toBeLessThan(640);
    expect(await overlaps(page), id).toEqual([]);
    await expect(page.locator("[data-tight]"), id).toHaveCount(0);
    await expect(page.locator(".sheet-body"), id).toBeVisible();
  }
  expect(Math.abs((await at("candidate-a")).x - (await at("finisher")).x)).toBeLessThan(2);
  // Where there is room they stand side by side, and a card on a spiral is whole.
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("about:blank");
  await page.goto("./#/templates/built-in/gauntlet-decomposed");
  await canvasIsQuiet(page);
  await view(page, "3D").click();
  await expect(page.locator(".s3-frame")).toBeVisible();
  await viewIsStill(page);
  const [left, right] = [await at("critic"), await at("next-piece")];
  expect(right.x).toBeGreaterThan(left.x + 120);
  await expect(page.locator('.s3-card[data-node="critic"]')).not.toHaveClass(/is-small/);
  await expect(page.locator('.s3-card[data-node="planner"]')).toHaveClass(/is-small/);
  expect(await overlaps(page)).toEqual([]);
});

/** Record what the stage writes and where its arrowheads point: asked for before the page is opened. */
async function recordDrawing(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const said: { text: string; x: number; y: number; wide: number; tall: number }[] = [];
    const heads: [number, number][] = [];
    Object.assign(window, { drawn: { said, heads } });
    const ctx = CanvasRenderingContext2D.prototype;
    const [text, begin, move, line, fill, clear] = [ctx.fillText, ctx.beginPath, ctx.moveTo, ctx.lineTo, ctx.fill, ctx.clearRect];
    let path: [number, number][] = [];
    ctx.clearRect = function (...args) {
      // A new drawing: what was recorded was the last one's.
      said.length = heads.length = 0;
      return clear.apply(this, args);
    };
    ctx.fillText = function (words, x, y, ...rest) {
      said.push({ text: words, x, y, wide: this.measureText(words).width, tall: Number.parseFloat(/([\d.]+)px/.exec(this.font)?.[1] ?? "11") });
      return text.call(this, words, x, y, ...rest);
    };
    ctx.beginPath = function () {
      path = [];
      return begin.call(this);
    };
    ctx.moveTo = function (x, y) {
      path.push([x, y]);
      return move.call(this, x, y);
    };
    ctx.lineTo = function (x, y) {
      path.push([x, y]);
      return line.call(this, x, y);
    };
    ctx.fill = function (...args: unknown[]) {
      // An arrowhead is a path of three points, filled: its first is its tip.
      if (path.length === 3) heads.push(path[0]!);
      return (fill as (...a: unknown[]) => void).apply(this, args);
    };
  });
}

test("a pane's name stands where no card is over it, and an edge's head is at the card it runs to, not under one: every built-in template, at two phones' sizes", async ({ page }) => {
  test.setTimeout(240_000);
  await recordDrawing(page);
  await page.addInitScript(() => sessionStorage.getItem("groophSpace") ?? sessionStorage.setItem("groophSpace", "panes"));
  const ids = readdirSync(join(repoRoot, "patterns")).filter((f) => f.endsWith(".grooph.json")).map((f) => f.replace(".grooph.json", ""));
  let names = 0;
  let heads = 0;
  for (const [width, height] of [[390, 844], [360, 740]] as const) {
    await page.setViewportSize({ width, height });
    for (const id of ids) {
      await page.goto("about:blank");
      await page.goto(`./#/templates/built-in/${id}`);
      await canvasIsQuiet(page);
      await page.getByRole("button", { name: "Close panel" }).click();
      await view(page, "3D").click();
      await expect(page.locator(".s3-frame")).toBeVisible();
      await viewIsStill(page);
      const found = await page.evaluate(() => {
        const frame = document.querySelector(".s3-frame canvas")!.getBoundingClientRect();
        const cards = [...document.querySelectorAll(".s3-card")].map((el) => el.getBoundingClientRect()).map((b) => [b.left - frame.left, b.top - frame.top, b.width, b.height] as const);
        const drawn = (window as unknown as { drawn: { said: { text: string; x: number; y: number; wide: number; tall: number }[]; heads: [number, number][] } }).drawn;
        const under = (x: number, y: number, w: number, h: number): number => cards.reduce((sum, c) => sum + Math.max(0, Math.min(x + w, c[0] + c[2]) - Math.max(x, c[0])) * Math.max(0, Math.min(y + h, c[1] + c[3]) - Math.max(y, c[1])), 0) / (w * h);
        return {
          // Each line of the words Panes draws (each pane's name, a long one on more lines than one, and "the
          // picture" over the picture's own pane), with the share of its box that lies under a card.
          names: drawn.said.map((s) => [s.text, Math.round(under(s.x, s.y - s.tall / 2, s.wide, s.tall) * 100)] as const),
          // Each arrowhead's tip, with whether it is more than two pixels inside a card.
          heads: drawn.heads.map(([x, y]) => cards.some((c) => x > c[0] + 2 && x < c[0] + c[2] - 2 && y > c[1] + 2 && y < c[1] + c[3] - 2)),
        };
      });
      for (const [text, share] of found.names) expect(share, `${id} at ${width}: "${text}"`).toBeLessThanOrEqual(10);
      expect(found.heads.filter(Boolean).length, `${id} at ${width}: arrowheads under a card`).toBe(0);
      expect(found.heads.length, `${id} at ${width}`).toBe(pattern(id).edges.length);
      names += found.names.length;
      heads += found.heads.length;
    }
  }
  // The check looked at something: the loops of twenty templates, twice, and every edge of each.
  expect(names).toBeGreaterThan(30);
  expect(heads).toBeGreaterThan(200);
});

test("on a phone the sheet that went down for a kind comes up again when the kind never comes, and when another panel is asked for; and where cards touch in a frame that is not held, the stage is the frame's height", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => sessionStorage.getItem("groophSpace") ?? sessionStorage.setItem("groophSpace", "panes"));
  const body = page.locator("aside.sheet .sheet-body");
  // The stage cannot be fetched: the picture stays, with the template's details as they were.
  await page.route(STAGE, (route) => route.abort());
  await page.goto("./#/templates/built-in/grind-loop");
  await canvasIsQuiet(page);
  await expect(body).toBeVisible();
  await view(page, "3D").click();
  await expect(page.locator(".graph-views-note")).toContainText("could not be fetched");
  await expect(body).toBeVisible();
  await page.unroute(STAGE);
  // The editor, a node's panel up, and Panes: the panel is down to its head, with no button to make it taller.
  await importDocument(page, "review-loop.grooph.json", readFileSync(join(repoRoot, "fixtures/valid/review-loop.grooph.json"), "utf8"));
  await expect(page.locator(".react-flow__node").first()).toBeVisible();
  await canvasIsQuiet(page);
  await page.locator(".react-flow__node").first().click();
  await expect(body).toBeVisible();
  await view(page, "3D").click();
  await expect(page.locator(".s3-frame")).toBeVisible();
  await viewIsStill(page);
  await expect(body).toBeHidden();
  await expect(page.locator("aside.sheet .sheet-toggle")).toBeHidden();
  // A press that asks for no panel leaves it down: here on the canvas's own toolbar, beside its buttons.
  await page.locator(".toolbar").click({ position: { x: 3, y: 3 } });
  await page.waitForTimeout(100);
  await expect(body).toBeHidden();
  // Another panel, asked for from the bar over the canvas: it comes up whole, with its button.
  await page.getByRole("button", { name: "Export", exact: true }).click();
  await expect(page.locator("aside.sheet")).toHaveAttribute("aria-label", /Export/);
  await expect(body).toBeVisible();
  await expect(page.locator("aside.sheet .sheet-toggle")).toBeVisible();
  // With the panel closed the frame has the page, and is asked for no height: this graph is one row of four, and
  // at this width its cards touch. The line that says so makes the bar over the frame taller; the stage is as
  // tall as the frame is with it.
  await closeSheet(page);
  await viewIsStill(page);
  await expect(page.locator(".s3-bar .s3-tight")).toBeVisible();
  await page.waitForTimeout(120);
  expect(await page.locator(".s3").evaluate((el) => (el as HTMLElement).style.getPropertyValue("--s3-tall"))).toBe("");
  const [has, shown] = await page.locator(".s3-frame canvas").evaluate((el) => [(el as HTMLCanvasElement).height, Math.round(el.getBoundingClientRect().height) * devicePixelRatio]);
  expect(has).toBe(shown);
});

test("a browser that gives no drawing surface: the switch is still there, the page says why and shows what it showed, and the visit does not remember the kind that never drew", async ({ page }) => {
  await page.addInitScript(() => {
    const real = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, kind: string, ...rest: unknown[]) {
      return kind === "2d" && this.closest(".s3-frame") ? null : (real as (...a: unknown[]) => unknown).call(this, kind, ...rest);
    } as typeof real;
  });
  await page.goto("./#/templates/built-in/review-gate");
  await expect(node(page, "builder")).toBeVisible();
  await canvasIsQuiet(page);
  await page.getByRole("button", { name: "Close panel" }).click();
  // From the stairs: the stairs stay, with a word of why.
  await view(page, "3D").click();
  await expect(page.locator(".space-scene")).toBeVisible();
  await viewIsStill(page);
  await kind(page, "Panes").click();
  await expect(page.locator(".graph-views-note")).toHaveText("That view cannot be drawn in this browser. This one shows the same graph.");
  await expect(page.locator(".space-scene")).toBeVisible();
  await expect(page.locator(".s3")).toHaveCount(0);
  await expect(kind(page, "Stairs")).toHaveAttribute("aria-checked", "true");
  await expect(view(page, "3D")).toHaveAttribute("aria-checked", "true");
  expect(await page.evaluate(() => sessionStorage.getItem("groophSpace"))).toBe("stairs");
  // From the picture, in a tab whose visit remembers the panes from before: the picture stays, the switch works,
  // and after a reload the tab is not sent to the same blank again.
  await view(page, "Picture").click();
  await expect(page.locator(".space")).toHaveCount(0);
  await viewIsStill(page);
  await page.evaluate(() => sessionStorage.setItem("groophSpace", "panes"));
  await page.reload();
  await canvasIsQuiet(page);
  await view(page, "3D").click();
  await expect(page.locator(".graph-views-note")).toHaveText("That view cannot be drawn in this browser. The picture shows the same graph.");
  // The template's details, which went down to their head for the panes, are up again with the picture.
  await expect(page.locator("aside.sheet .sheet-body")).toBeVisible();
  await expect(node(page, "builder")).toBeVisible();
  await expect(view(page, "Picture")).toHaveAttribute("aria-checked", "true");
  await expect(page.locator("#root")).not.toBeEmpty();
  // The next press of 3D opens the stairs, which can be drawn.
  await view(page, "3D").click();
  await expect(page.locator(".space-scene")).toBeVisible();
  expect(await page.evaluate(() => sessionStorage.getItem("groophSpace"))).toBe("stairs");
});

test("the words: a graph with no loop and no subgrooph says nothing is lifted, and one card is not \"1 cards\"", async ({ page }) => {
  await page.goto("./#/templates/built-in/tournament-then-judge");
  await canvasIsQuiet(page);
  await page.getByRole("button", { name: "Close panel" }).click();
  await open(page);
  await expect(page.locator(".s3-note")).toHaveText(/entering or leaving a loop or a subgrooph\. This graph has no loop and no subgrooph, so nothing is lifted\.$/);
  await expect(says(page)).toHaveText("All 6 steps are lit. Move the slider or press Play to follow a first pass, one edge at a time.");
  // One node, no edge.
  const one: Graph = { ...reviewLoop(), nodes: reviewLoop().nodes.slice(0, 1), edges: [], loops: [], layout: {} };
  await page.goto("about:blank");
  await page.goto(linkFor(one));
  await canvasIsQuiet(page);
  await view(page, "3D").click();
  await expect(page.locator(".s3-frame")).toHaveAttribute("aria-label", /: 1 card, 0 edges\./);
  await expect(says(page)).toHaveText("This graph has no edges to step through.");
});

test("rings: every node a card round its loop's ring or on the ground, no card over another on any built-in template at a phone's size, and all but the cards grown", async ({ page }) => {
  test.setTimeout(180_000);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => sessionStorage.getItem("groophSpace") ?? sessionStorage.setItem("groophSpace", "rings"));
  const ids = readdirSync(join(repoRoot, "patterns")).filter((f) => f.endsWith(".grooph.json")).map((f) => f.replace(".grooph.json", ""));
  const touching: Record<string, string[]> = {};
  for (const id of ids) {
    await page.goto("about:blank");
    await page.goto(`./#/templates/built-in/${id}`);
    await canvasIsQuiet(page);
    await page.getByRole("button", { name: "Close panel" }).click();
    await view(page, "3D").click();
    await expect(page.locator('.s3[data-kind="rings"] .s3-frame')).toBeVisible();
    await viewIsStill(page);
    await expect(cards(page)).toHaveCount(pattern(id).nodes.length);
    const hits = await overlaps(page);
    if (hits.length) touching[id] = hits;
    const [frame, room] = [(await page.locator(".s3-frame").boundingBox())!, await page.locator(".graph-space").evaluate((el) => el.clientHeight)];
    expect(frame.height, id).toBeLessThanOrEqual(Math.round(room * 0.8) + 1);
    for (const box of await cards(page).evaluateAll((els) => els.map((el) => el.getBoundingClientRect().toJSON() as { top: number; bottom: number; left: number; right: number }))) {
      expect(box.left, id).toBeGreaterThanOrEqual(frame.x - 1);
      expect(box.right, id).toBeLessThanOrEqual(frame.x + frame.width + 1);
      expect(box.top, id).toBeGreaterThanOrEqual(frame.y - 1);
      expect(box.bottom, id).toBeLessThanOrEqual(frame.y + frame.height + 1);
    }
  }
  expect(touching).toEqual({});

  // One of them, looked at: its frame's name, a card that opens its node, no list of brakes, and the slider.
  await page.goto("about:blank");
  await page.goto("./#/templates/built-in/gauntlet-decomposed");
  await canvasIsQuiet(page);
  await page.getByRole("button", { name: "Close panel" }).click();
  await page.evaluate(() => {
    const log: boolean[] = ((window as unknown as { drawnAtFirst: boolean[] }).drawnAtFirst = []);
    new MutationObserver(() => {
      const canvas = document.querySelector<HTMLCanvasElement>(".s3-frame canvas");
      if (canvas && !canvas.dataset["seen"]) ((canvas.dataset["seen"] = "1"), log.push(canvas.width > 0 && canvas.getContext("2d")!.getImageData(0, 0, canvas.width, canvas.height).data.some((v) => v !== 0)));
    }).observe(document.body, { childList: true, subtree: true });
  });
  await view(page, "3D").click();
  await expect(page.locator(".s3-frame")).toBeVisible();
  expect(await page.evaluate(() => (window as unknown as { drawnAtFirst: boolean[] }).drawnAtFirst)).toEqual([false]);
  await viewIsStill(page);
  await expect.poll(() => drawnOn(page)).toBe(true);
  await expect(kind(page, "Rings")).toHaveAttribute("aria-checked", "true");
  await expect(kind(page, "Rings")).toHaveAttribute("aria-description", /a ring standing on the outer one/);
  await expect(page.locator(".s3-frame")).toHaveAttribute("aria-label", /^Gauntlet, decomposed as a ring for each loop: 10 cards, 12 edges, and the loops Polish a piece, Pieces\./);
  await expect(page.getByRole("list", { name: "Each loop's brakes" })).toHaveCount(0);
  await expect(page.locator('.s3-card[data-node="planner"]')).toHaveClass(/is-small/);
  await expect(page.getByRole("button", { name: "Agent Piece owner" })).toHaveText(/^Piece owner.+/);
  await page.getByRole("button", { name: "Agent Piece critic" }).click();
  await expect(sheet(page).getByText("Piece critic").first()).toBeVisible();
  await page.getByRole("button", { name: "Close panel" }).click();
  await page.getByRole("button", { name: "Next step" }).click();
  await expect(says(page)).toHaveText(/^Step 1 of 12: Planner to /);
  await expect(page.locator(".s3-card.is-lit")).toHaveCount(2);
});

test("the picture becomes the rings and the spiral becomes the rings; on a run's page the rings walk the run's notes", async ({ page }) => {
  const moves = await noteMoves(page);
  await page.goto("./#/templates/built-in/review-gate");
  await canvasIsQuiet(page);
  await page.getByRole("button", { name: "Close panel" }).click();
  const whole = { pairs: 4, ended: true };
  await open(page, "Spiral");
  const before = (await moves()).length;
  await kind(page, "Rings").click();
  await expect(page.locator('.s3[data-kind="rings"]')).toBeVisible();
  await viewIsStill(page);
  await view(page, "Picture").click();
  await expect(page.locator(".s3")).toHaveCount(0);
  await viewIsStill(page);
  await view(page, "3D").click();
  await expect(page.locator('.s3[data-kind="rings"]')).toBeVisible();
  await viewIsStill(page);
  await expect.poll(async () => (await moves()).slice(before)).toEqual([whole, whole, whole]);
  expect([await namedStill(page), (await slowest(page)) < 2500]).toEqual([0, true]);

  const run = runBundle("run-nested");
  await page.goto(linkFor(run));
  await expect(page.locator(".react-flow__node").first()).toBeVisible();
  await canvasIsQuiet(page);
  await view(page, "3D").click();
  await expect(page.locator('.s3[data-kind="rings"] .s3-frame')).toBeVisible();
  await viewIsStill(page);
  // The round the run is in, loop by loop, in words under the rings, as far as the slider has come.
  const rounds = page.getByRole("list", { name: "The round the run is in, loop by loop" }).getByRole("listitem");
  await page.getByRole("slider", { name: "Note, in the order the run wrote them" }).fill("1");
  await expect(rounds).toHaveText(["Grind not entered", "Phases not entered"]);
  await page.getByRole("slider", { name: "Note, in the order the run wrote them" }).fill("6");
  await expect(rounds).toHaveText(["Grind round 1", "Phases round 0"]);
  await page.getByRole("slider", { name: "Note, in the order the run wrote them" }).fill("10");
  await expect(says(page)).toHaveText("Note 10 of 13: Builder: pass · round 0");
  await expect(rounds).toHaveText(["Grind round 0", "Phases round 1"]);
  await expect(page.locator(".s3-card.is-lit")).toHaveAttribute("data-node", "builder");
  // A template has no run, and no such list.
  await page.goto("./#/templates/built-in/review-gate");
  await canvasIsQuiet(page);
  await page.getByRole("button", { name: "Close panel" }).click();
  await view(page, "3D").click();
  await expect(page.locator('.s3[data-kind="rings"] .s3-frame')).toBeVisible();
  await expect(page.getByRole("list", { name: "The round the run is in, loop by loop" })).toHaveCount(0);
});
