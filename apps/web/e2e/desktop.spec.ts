import { readFileSync } from "node:fs";
import { join } from "node:path";

import { expect, test, type Locator, type Page } from "@playwright/test";

import { fixturePath, linkFor, node, repoRoot, reviewLoop, status } from "./support.js";

/**
 * Handoff 0061: the editor, the read-only viewer and a template's page on a
 * desktop. From 1100 px a graph opens at a size that can be read, the outline
 * is a rail on one side of the canvas and a node's details a panel on the
 * other, the top bar is one line, Escape closes a panel, and Tab and Enter
 * reach a node. The phone is the rest of the suite's business.
 */
test.use({ viewport: { width: 1440, height: 900 }, isMobile: false, hasTouch: false, deviceScaleFactor: 1 });

const smallGraph = join(repoRoot, "fixtures/invalid/E_CYCLE_NO_STOP/loop-without-stop.grooph.json");
const rail = (page: Page): Locator => page.getByRole("complementary", { name: "Outline" });
const panel = (page: Page): Locator => page.locator("aside.sheet:not(.sheet-rail)");
const zoom = (page: Page): Promise<number> => page.locator(".react-flow__viewport").evaluate((el) => new DOMMatrix(getComputedStyle(el).transform).a);
const box = async (l: Locator) => (await l.boundingBox())!;

async function importGraph(page: Page, path: string): Promise<void> {
  await page.goto("./");
  await page.locator('input[type="file"]').setInputFiles({ name: "graph.grooph.json", mimeType: "application/json", buffer: readFileSync(path) });
  await expect(status(page)).toBeVisible();
  await expect(page.locator(".react-flow__node").first()).toBeVisible();
  await page.waitForTimeout(400);
}

/** Interactive elements with no accessible name (as in landing.spec.ts), and focusable canvas nodes with none. */
async function unnamedControls(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const out: string[] = [];
    for (const el of Array.from(document.querySelectorAll<HTMLElement>("a[href], button, input, select, textarea, [role=button], [role=link], [tabindex='0']"))) {
      const labelled = el.getAttribute("aria-labelledby");
      const named =
        (el.getAttribute("aria-label") ?? "").trim() !== "" ||
        (labelled !== null && labelled.split(/\s+/).some((id) => (document.getElementById(id)?.textContent ?? "").trim() !== "")) ||
        (el.textContent ?? "").trim() !== "" ||
        ((el instanceof HTMLInputElement || el instanceof HTMLSelectElement || el instanceof HTMLTextAreaElement) && Array.from(el.labels ?? []).some((l) => (l.textContent ?? "").trim() !== "")) ||
        (el.getAttribute("title") ?? "").trim() !== "";
      if (!named) out.push(el.outerHTML.slice(0, 120));
    }
    return out;
  });
}

test("a small graph opens larger than life, a wide one fitted with air at its sides: never tiny in an empty page", async ({ page }) => {
  // Two nodes: life size would leave them small in the middle of the page.
  await importGraph(page, smallGraph);
  expect(await zoom(page)).toBeCloseTo(1.3, 2);
  expect((await box(node(page, "builder"))).width).toBeGreaterThan(250);

  // Four nodes in a row, from a link: fitted to the width, whole, between the legend and the bar.
  await page.goto(linkFor(reviewLoop()));
  await expect(node(page, "done")).toBeVisible();
  await page.waitForTimeout(400);
  const z = await zoom(page);
  expect(z).toBeGreaterThan(1.1);
  expect(z).toBeLessThanOrEqual(1.3);
  const stage = await box(page.locator(".stage"));
  for (const id of ["builder", "critic", "merge-gate", "done"]) {
    const b = await box(node(page, id));
    expect(b.x, `${id} has air on its left`).toBeGreaterThanOrEqual(stage.x + 48);
    expect(b.x + b.width, `${id} has air on its right`).toBeLessThanOrEqual(stage.x + stage.width - 48);
  }
  // The viewer's bar is an island under the graph, not a strip across the page.
  const bar = await box(page.getByRole("region", { name: "Save" }));
  expect(bar.width).toBeLessThan(640);
  expect(Math.abs(bar.x + bar.width / 2 - (stage.x + stage.width / 2))).toBeLessThan(2);
});

test("the top bar is one line: the way back says its name, the name and what is under it share a baseline", async ({ page }) => {
  await importGraph(page, fixturePath);
  const bar = page.locator("header.topbar");
  expect((await box(bar)).height).toBeLessThanOrEqual(58);
  const back = bar.getByRole("link", { name: "All graphs" });
  expect(await back.evaluate((el) => getComputedStyle(el, "::after").content)).toBe('"All graphs"');
  expect(await bar.getByRole("button", { name: "Outline" }).evaluate((el) => getComputedStyle(el, "::after").content)).toBe('"Outline"');
  const name = await box(bar.locator(".title-name"));
  const sub = await box(bar.locator(".title-sub"));
  expect(sub.x).toBeGreaterThan(name.x + name.width);
  expect(Math.abs(name.y + name.height - (sub.y + sub.height))).toBeLessThan(4);
  // In order, left to right, none over the next, the last inside the page.
  const boxes = await Promise.all([back, bar.locator(".title-btn"), bar.getByRole("button", { name: "Outline" }), status(page), bar.getByRole("button", { name: "Export", exact: true })].map(box));
  for (let i = 1; i < boxes.length; i++) expect(boxes[i]!.x).toBeGreaterThanOrEqual(boxes[i - 1]!.x + boxes[i - 1]!.width);
  expect(boxes.at(-1)!.x + boxes.at(-1)!.width).toBeLessThanOrEqual(1440);
});

test("a node's details are a panel beside the canvas and the outline a rail on its other side, both open at once", async ({ page }) => {
  await importGraph(page, fixturePath);
  await node(page, "critic").click();
  await expect(panel(page).getByRole("heading", { name: "Agent" })).toBeVisible();
  await page.waitForTimeout(400);
  let stage = await box(page.locator(".stage"));
  let side = await box(panel(page));
  expect(side.x).toBeGreaterThanOrEqual(stage.x + stage.width - 1); // beside, not over
  expect(side.height).toBeGreaterThan(800);
  // The toolbar is still there: a panel beside the canvas covers nothing.
  await expect(page.getByRole("toolbar", { name: "Canvas" })).toBeVisible();

  await page.getByRole("button", { name: "Outline" }).click();
  await expect(rail(page)).toBeVisible();
  await expect(panel(page).getByRole("heading", { name: "Agent" })).toBeVisible(); // the details stayed
  await page.waitForTimeout(400);
  stage = await box(page.locator(".stage"));
  side = await box(panel(page));
  const left = await box(rail(page));
  expect(left.x).toBe(0);
  expect(left.x + left.width).toBeLessThanOrEqual(stage.x + 1);
  expect(stage.x + stage.width).toBeLessThanOrEqual(side.x + 1);
  expect(stage.width).toBeGreaterThan(600);
  await expect(page.getByRole("button", { name: "Outline" })).toHaveAttribute("aria-pressed", "true");
  // The graph was fitted again to the room that is left: every node between the two.
  for (const id of ["builder", "critic", "merge-gate", "done"]) {
    const b = await box(node(page, id));
    expect(b.x, id).toBeGreaterThanOrEqual(left.x + left.width);
    expect(b.x + b.width, id).toBeLessThanOrEqual(side.x);
  }

  // The outline marks the node whose details are open, and a section's Edit opens another beside it.
  await expect(rail(page).locator('.outline-section[data-outline-id="critic"]')).toHaveClass(/is-current/);
  await expect(rail(page).locator('.outline-section[data-outline-id="critic"]')).toBeInViewport();
  await rail(page).locator('.outline-section[data-outline-id="builder"]').getByRole("button", { name: "Edit" }).click();
  await expect(panel(page).getByLabel("Name", { exact: true })).toHaveValue("Builder");
  await expect(rail(page)).toBeVisible();
  await expect(rail(page).locator('.outline-section[data-outline-id="builder"]')).toHaveClass(/is-current/);
});

test("Escape closes one panel at a time: the details, then the outline", async ({ page }) => {
  await importGraph(page, fixturePath);
  await page.getByRole("button", { name: "Outline" }).click();
  await node(page, "critic").click();
  await expect(panel(page)).toBeVisible();
  await expect(rail(page)).toBeVisible();
  // From inside a field too: the document already holds what was typed.
  await panel(page).getByLabel("Name", { exact: true }).fill("Reviewer");
  await page.keyboard.press("Escape");
  await expect(panel(page)).toHaveCount(0);
  await expect(rail(page)).toBeVisible();
  await expect(node(page, "reviewer")).toContainText("Reviewer"); // the id follows the name
  await page.keyboard.press("Escape");
  await expect(rail(page)).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Outline" })).toHaveAttribute("aria-pressed", "false");
});

test("the read-only viewer does the same, and refits the graph beside a panel that opens", async ({ page }) => {
  await page.goto(linkFor(reviewLoop()));
  await expect(node(page, "done")).toBeVisible();
  await page.waitForTimeout(400);
  await node(page, "critic").click();
  await expect(panel(page).getByRole("heading", { name: "Agent" })).toBeVisible();
  await page.waitForTimeout(400);
  const side = await box(panel(page));
  for (const id of ["builder", "critic", "merge-gate", "done"]) {
    const b = await box(node(page, id));
    expect(b.x + b.width, `${id} is clear of the panel`).toBeLessThanOrEqual(side.x);
  }
  await page.getByRole("button", { name: "Outline" }).click();
  await expect(rail(page).locator(".outline-section.is-current")).toContainText("Critic");
  await expect(panel(page)).toBeVisible();
  await expect(rail(page).getByRole("button", { name: "Edit" })).toHaveCount(0);
  await page.keyboard.press("Escape");
  await expect(panel(page)).toHaveCount(0);
  await page.keyboard.press("Escape");
  await expect(page.locator("aside.sheet")).toHaveCount(0);
});

test("a template's page: the graph at a size to read, what it is for beside it", async ({ page }) => {
  await page.goto("./#/templates/built-in/review-gate");
  await expect(node(page, "done")).toBeVisible();
  await page.waitForTimeout(400);
  expect(await zoom(page)).toBeGreaterThan(1.05);
  const stage = await box(page.locator(".stage"));
  const side = await box(panel(page));
  expect(side.x).toBeGreaterThanOrEqual(stage.x + stage.width - 1);
  await expect(panel(page).getByRole("link", { name: "Use this template" })).toBeVisible();
  await expect(page.locator("header.topbar").getByRole("link", { name: "All templates" })).toBeVisible();
  for (const id of ["builder", "critic", "merge-gate", "done"]) await expect(node(page, id)).toBeInViewport({ ratio: 0.99 });
});

test("the keyboard: Tab goes through the bar in order, reaches a node, and Enter opens it; every control has a name", async ({ page }) => {
  await importGraph(page, fixturePath);
  const focused = () => page.evaluate(() => document.activeElement?.getAttribute("aria-label") ?? document.activeElement?.textContent?.trim() ?? "");
  const seen: string[] = [];
  for (let i = 0; i < 5; i++) {
    await page.keyboard.press("Tab");
    seen.push(await focused());
  }
  expect(seen[0]).toBe("All graphs");
  expect(seen[1]).toContain("Review loop");
  expect(seen[2]).toBe("Outline");
  expect(seen[3]).toMatch(/^Validation:/);
  expect(seen[4]).toBe("Export");

  // On to the canvas: the storage notice's button, then the nodes by kind and name, then the edges by their labels.
  const canvas: string[] = [];
  for (let i = 0; i < 10; i++) {
    await page.keyboard.press("Tab");
    canvas.push(await focused());
  }
  expect(canvas).toEqual([
    "Got it",
    "Agent: Builder",
    "Agent: Critic",
    "Human gate: Merge approval",
    "Stop: Done",
    "Edge builder to critic, always",
    "Edge critic to builder, fail",
    "Edge critic to merge-gate, pass",
    "Edge merge-gate to done, pass",
    "Edge merge-gate to builder, fail",
  ]);
  // An edge is reached by its label, once: the line is not a stop of its own.
  expect(await page.locator(".react-flow__edge[tabindex]").count()).toBe(0);

  await node(page, "builder").focus();
  await page.keyboard.press("Enter");
  await expect(panel(page).getByLabel("Name", { exact: true })).toHaveValue("Builder");
  expect(await unnamedControls(page)).toEqual([]);

  await page.getByRole("button", { name: "Outline" }).click();
  await status(page).click();
  expect(await unnamedControls(page)).toEqual([]);
  // The viewer and a template's page have nodes of the same ids: wait for what only each of them has before acting on one.
  await page.goto(linkFor(reviewLoop()));
  await expect(page.getByRole("region", { name: "Save" })).toBeVisible();
  await expect(node(page, "critic")).toBeVisible(); // measured and shown: a node still hidden takes no focus
  await node(page, "critic").focus();
  await expect(node(page, "critic")).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(panel(page).getByRole("heading", { name: "Agent" })).toBeVisible();
  expect(await unnamedControls(page)).toEqual([]);
  await page.goto("./#/templates/built-in/review-gate");
  await expect(page.getByRole("region", { name: "Use" })).toBeVisible();
  await expect(node(page, "done")).toBeVisible();
  expect(await unnamedControls(page)).toEqual([]);
});

test("motion is short, and none when the device asks for less", async ({ page }) => {
  await importGraph(page, fixturePath);
  await node(page, "critic").click();
  const motion = async () => ({
    panel: await panel(page).evaluate((el) => `${getComputedStyle(el).animationName} ${getComputedStyle(el).animationDuration}`),
    ring: await node(page, "critic").locator(".gnode").evaluate((el) => getComputedStyle(el).transitionDuration),
  });
  const moving = await motion();
  expect(moving.panel).toBe("sheet-in 0.18s");
  expect(moving.ring.split(", ").every((d) => Number.parseFloat(d) >= 0.15 && Number.parseFloat(d) <= 0.2)).toBe(true);

  await page.emulateMedia({ reducedMotion: "reduce" });
  const still = await motion();
  expect(still.panel).toBe("none 0s");
  expect(still.ring).toBe("0s");
});

test.describe("on the narrowest desktop", () => {
  test.use({ viewport: { width: 1100, height: 720 } });

  test("a graph that no longer fits between two panels stays readable, with the whole of it one click away", async ({ page }) => {
    await page.goto(linkFor(reviewLoop()));
    await expect(node(page, "done")).toBeVisible();
    await page.waitForTimeout(400);
    await expect(page.getByRole("button", { name: "Show all" })).toHaveCount(0); // it fits, so there is nothing to offer
    await page.getByRole("button", { name: "Outline" }).click();
    await node(page, "critic").click();
    await expect(panel(page)).toBeVisible();
    await page.waitForTimeout(400);
    // 1,000 px of graph in under 500: half size from its start, not a third of a size whole.
    expect(await zoom(page)).toBeCloseTo(0.5, 2);
    await page.getByRole("button", { name: "Show all" }).click();
    await page.waitForTimeout(400);
    const stage = await box(page.locator(".stage"));
    for (const id of ["builder", "done"]) {
      const b = await box(node(page, id));
      expect(b.x, id).toBeGreaterThanOrEqual(stage.x);
      expect(b.x + b.width, id).toBeLessThanOrEqual(stage.x + stage.width);
    }
  });
});

test.describe("between a phone and a desktop", () => {
  test.use({ viewport: { width: 1000, height: 800 } });

  test("the outline and a node's details are one panel at a time, as on a phone", async ({ page }) => {
    await importGraph(page, fixturePath);
    await page.getByRole("button", { name: "Outline" }).click();
    await expect(page.locator("aside.sheet")).toHaveCount(1);
    await expect(page.locator(".outline-section").first()).toBeVisible();
    // Beside the canvas there, so what floats on the canvas stays.
    await expect(page.getByRole("toolbar", { name: "Canvas" })).toBeVisible();
    await page.locator(".outline-section").nth(2).getByRole("button", { name: "Edit" }).click();
    await expect(page.locator("aside.sheet")).toHaveCount(1);
    await expect(page.locator("aside.sheet").getByRole("heading", { name: "Agent" })).toBeVisible();
  });
});
