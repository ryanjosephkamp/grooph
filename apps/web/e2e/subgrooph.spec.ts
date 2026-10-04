import { readFileSync } from "node:fs";
import { join } from "node:path";

import { parseGraphText, type Graph } from "@grooph/core";
import { expect, test, type Page } from "@playwright/test";

import { fixturePath, importDocument, linkFor, node, repoRoot } from "./support.js";
import { desktop } from "./support-alive.js";

/**
 * Handoff 0085, item 3: a subgrooph on the canvas is one box. Closed, it says what it holds; a tap opens it in
 * place, as a frame around its nodes, and nothing else on the canvas moves.
 *
 * The document is the fixture every other part of the slice uses: the built-in review gate placed between a
 * planner and a release step.
 */
const boxedPath = join(repoRoot, "fixtures/valid/subgrooph-in-a-graph.grooph.json");
const boxed = (): Graph => parseGraphText(readFileSync(boxedPath, "utf8")).doc!;
const box = (page: Page) => page.locator('[data-unit-id="review"]');
const INSIDE = ["review-builder", "review-critic", "review-merge-gate"];
const OUTSIDE = ["plan", "release", "done"];
/** Where a node is on the page, to the pixel. */
const place = async (page: Page, id: string) => {
  const at = (await node(page, id).boundingBox())!;
  return { x: Math.round(at.x), y: Math.round(at.y) };
};

test("a shared graph with a subgrooph: one closed box that says what it holds, and opens in place", async ({ page }) => {
  await page.goto(linkFor(boxed()));
  await expect(box(page)).toBeVisible();
  await expect(box(page)).toContainText("Subgrooph");
  await expect(box(page)).toContainText("Review gate");
  await expect(box(page)).toContainText("review-gate@1 · 3 nodes · 1 human gate · 1 loop");
  await expect(box(page).locator(".unit-glyph svg")).toBeVisible();
  for (const id of INSIDE) await expect(node(page, id)).toHaveCount(0);
  for (const id of OUTSIDE) await expect(node(page, id)).toBeVisible();
  // What crossed its edge reaches the box; what is inside is not drawn.
  await expect(page.locator(".react-flow__edge")).toHaveCount(3);
  await expect(node(page, "review")).toHaveAttribute("aria-label", /^Subgrooph: Review gate, 3 nodes, 1 human gate, 1 loop\. Closed: Enter opens it$/);

  await page.waitForTimeout(400);
  const before = Object.fromEntries(await Promise.all(OUTSIDE.map(async (id) => [id, await place(page, id)] as const)));
  const frame = (await node(page, "review").boundingBox())!;
  await box(page).tap();
  await expect(page.locator('[data-unit-id="review"][data-open]')).toBeVisible();
  for (const id of INSIDE) await expect(node(page, id)).toBeVisible();
  await expect(page.locator(".react-flow__edge")).toHaveCount(boxed().edges.length);
  // In place: the frame is where the box was, and no other node has moved.
  for (const id of OUTSIDE) expect(await place(page, id), id).toEqual(before[id]);
  const open = (await node(page, "review").boundingBox())!;
  expect([Math.round(open.x), Math.round(open.y), Math.round(open.width), Math.round(open.height)]).toEqual([Math.round(frame.x), Math.round(frame.y), Math.round(frame.width), Math.round(frame.height)]);
  // Its nodes are inside the frame.
  for (const id of INSIDE) {
    const at = (await node(page, id).boundingBox())!;
    expect(at.x >= open.x && at.y >= open.y && at.x + at.width <= open.x + open.width && at.y + at.height <= open.y + open.height, id).toBe(true);
  }
  // A node inside is a node: a tap opens its details, as it does for any other.
  await node(page, "review-critic").tap();
  await expect(page.locator("aside.sheet")).toContainText("Critic");
  await page.getByRole("button", { name: "Close panel" }).tap();

  // Closing is in place too. (The details panel moved the view to keep its node in sight: measure again.)
  await page.waitForTimeout(500);
  const opened = Object.fromEntries(await Promise.all([...OUTSIDE, "review"].map(async (id) => [id, await place(page, id)] as const)));
  await page.getByRole("button", { name: "Close Review gate" }).tap();
  await expect(box(page)).not.toHaveAttribute("data-open", "");
  for (const id of INSIDE) await expect(node(page, id)).toHaveCount(0);
  for (const id of [...OUTSIDE, "review"]) expect(await place(page, id), id).toEqual(opened[id]);
});

test.describe("with a keyboard", () => {
  test.use(desktop);
  test("Tab reaches the box and Enter opens it; its Close is a button", async ({ page }) => {
    await page.goto(linkFor(boxed()));
    await expect(box(page)).toBeVisible();
    await node(page, "review").focus();
    await page.keyboard.press("Enter");
    await expect(page.locator('[data-unit-id="review"][data-open]')).toBeVisible();
    const close = page.getByRole("button", { name: "Close Review gate" });
    await expect(close).toHaveAttribute("aria-expanded", "true");
    await close.focus();
    await page.keyboard.press("Enter");
    await expect(node(page, "review-builder")).toHaveCount(0);
  });

  test("in the editor a closed box moves with everything in it, and opens where it was put", async ({ page }) => {
    await importDocument(page, "boxed.grooph.json", readFileSync(boxedPath, "utf8"));
    await expect(box(page)).toBeVisible();
    await page.waitForTimeout(400);
    const plan = await place(page, "plan");
    const from = (await node(page, "review").boundingBox())!;
    await page.mouse.move(from.x + from.width / 2, from.y + 20);
    await page.mouse.down();
    await page.mouse.move(from.x + from.width / 2 + 60, from.y + 20 + 10, { steps: 6 });
    await page.mouse.move(from.x + from.width / 2 + 120, from.y + 20 + 30, { steps: 6 });
    await page.mouse.up();
    const to = (await node(page, "review").boundingBox())!;
    expect(Math.round(to.x - from.x)).toBeGreaterThan(60);
    expect(await place(page, "plan")).toEqual(plan);
    await box(page).click();
    await expect(page.locator('[data-unit-id="review"][data-open]')).toBeVisible();
    // The frame is where the box was dropped, and its nodes are in it.
    const open = (await node(page, "review").boundingBox())!;
    expect(Math.abs(open.x - to.x) < 2 && Math.abs(open.y - to.y) < 2).toBe(true);
    for (const id of INSIDE) {
      const at = (await node(page, id).boundingBox())!;
      expect(at.x >= open.x && at.x + at.width <= open.x + open.width, id).toBe(true);
    }
  });
});

test("the outline holds a subgrooph's nodes in one box, shut until it is opened", async ({ page }) => {
  await page.goto(linkFor(boxed()));
  await expect(box(page)).toBeVisible();
  await page.getByRole("button", { name: "Outline" }).tap();
  const unit = page.locator('details.outline-unit[data-outline-id="review"]');
  await expect(unit).toBeVisible();
  await expect(unit.locator("summary")).toContainText("Review gate");
  await expect(unit.locator("summary")).toContainText("3 nodes, placed from the template review-gate, version 1");
  // Shut: its nodes' sections are not in sight. The planner, which is in no box, is; and the box comes after it.
  const section = (id: string) => page.locator(`.outline-section[data-outline-id="${id}"]`);
  await expect(section("plan")).toBeVisible();
  await expect(section("review-critic")).toBeHidden();
  const order = await page.locator(".outline > [data-outline-id]").evaluateAll((els) => els.map((el) => el.getAttribute("data-outline-id")));
  expect(order.slice(0, 4)).toEqual(["plan-review-release", "plan", "review", "release"]);
  await unit.locator("summary").tap();
  for (const id of INSIDE) await expect(section(id)).toBeVisible();
  await expect(section("review")).toContainText("Filled with");
  await expect(section("review-critic")).toContainText("Part of");
});

test("a graph with no subgrooph fetches no box: the piece is asked for only when a document has one", async ({ page }) => {
  const scripts: string[] = [];
  page.on("request", (request) => {
    if (request.resourceType() === "script") scripts.push(new URL(request.url()).pathname);
  });
  await page.goto(linkFor(parseGraphText(readFileSync(fixturePath, "utf8")).doc!));
  await expect(node(page, "builder")).toBeVisible();
  await page.waitForTimeout(500);
  expect(scripts.filter((path) => /\/units-[^/]+\.js$/.test(path))).toEqual([]);
  const plain = scripts.length;

  await page.goto(linkFor(boxed()));
  await expect(box(page)).toBeVisible();
  expect(scripts.slice(plain).filter((path) => /\/units-[^/]+\.js$/.test(path)).length).toBe(1);
});
