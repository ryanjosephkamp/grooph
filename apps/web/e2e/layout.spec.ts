import { readFileSync } from "node:fs";

import { expect, test, type Page } from "@playwright/test";

import { closeSheet, downloadText, fit, fixturePath, importDocument, linkFor, node, reviewLoop, runBundle, sheet } from "./support.js";

/**
 * Handoff 0002, criterion 8 (and amendment A-005): a document without `layout`
 * is laid out automatically on open, and the positions reach the document only
 * when the user moves something or saves explicitly.
 */
const layoutFree = (): string => {
  const { layout: _layout, ...rest } = JSON.parse(readFileSync(fixturePath, "utf8")) as Record<string, unknown>;
  return JSON.stringify(rest, null, 2);
};

async function downloadGraph(page: Page): Promise<Record<string, unknown>> {
  await page.getByRole("button", { name: "Export", exact: true }).tap();
  const [file] = await Promise.all([
    page.waitForEvent("download"),
    sheet(page).getByRole("button", { name: "Download graph (.grooph.json)" }).tap(),
  ]);
  const doc = JSON.parse(await downloadText(file)) as Record<string, unknown>;
  await closeSheet(page);
  return doc;
}

test("an agent-built graph without layout opens laid out, and stays layout-free until moved", async ({ page }) => {
  await importDocument(page, "agent-built.grooph.json", layoutFree());

  const boxes = await Promise.all(["builder", "critic", "merge-gate", "done"].map((id) => node(page, id).boundingBox()));
  expect(boxes.every(Boolean)).toBe(true);
  const ys = boxes.map((b) => b!.y);
  expect(ys).toEqual([...ys].sort((a, b) => a - b)); // top to bottom along the forward edges
  expect(new Set(ys).size).toBe(4);

  // Opening, selecting and looking write nothing.
  await node(page, "critic").tap();
  await closeSheet(page);
  expect("layout" in (await downloadGraph(page))).toBe(false);

  // A drag writes every position at once, so nothing jumps afterwards.
  const box = (await node(page, "done").boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 60, box.y + box.height / 2 + 40, { steps: 8 });
  await page.mouse.up();
  const moved = await downloadGraph(page);
  expect(Object.keys(moved["layout"] as object).sort()).toEqual(["builder", "critic", "done", "merge-gate"]);
});

test("Save layout writes the automatic positions on request", async ({ page }) => {
  await importDocument(page, "agent-built.grooph.json", layoutFree());
  await page.getByRole("button", { name: /^Review loop/ }).tap();
  await expect(sheet(page).getByText("Placed automatically.")).toBeVisible();
  await sheet(page).getByRole("button", { name: "Save layout" }).tap();
  await expect(sheet(page).getByText("Every node's position is saved in the document.")).toBeVisible();
  await closeSheet(page);
  const doc = await downloadGraph(page);
  const layout = doc["layout"] as Record<string, { x: number; y: number }>;
  expect(Object.keys(layout).sort()).toEqual(["builder", "critic", "done", "merge-gate"]);
  expect(layout["builder"]!.y).toBeLessThan(layout["critic"]!.y);
});

/**
 * Review 2026-10: a canvas never opens too small to read. The fixture's own
 * layout is about 1,000 px in a row, which fitted to a phone was a third of
 * full size; it opens at half size from its start, and the rest is one tap.
 */
test("a layout wider than the phone opens readable from its start; Fit, or Show all in a viewer, shows the whole of it", async ({ page }) => {
  await importDocument(page, "review-loop.grooph.json", readFileSync(fixturePath, "utf8"));
  await page.waitForTimeout(300);
  const builder = (await node(page, "builder").boundingBox())!;
  expect(builder.width).toBeGreaterThanOrEqual(99); // 200 px at 0.5
  await expect(node(page, "builder")).toBeInViewport({ ratio: 0.95 });
  await expect(node(page, "done")).not.toBeInViewport({ ratio: 0.95 });
  await fit(page);
  for (const id of ["builder", "critic", "merge-gate", "done"]) await expect(node(page, id)).toBeInViewport({ ratio: 0.95 });

  // A read-only viewer has no toolbar: the same two views are one control.
  await page.goto(linkFor(reviewLoop()));
  await expect(node(page, "builder")).toBeVisible();
  const showAll = page.getByRole("button", { name: "Show all" });
  await expect(showAll).toBeVisible();
  expect((await node(page, "builder").boundingBox())!.width).toBeGreaterThanOrEqual(99);
  await showAll.tap();
  await page.waitForTimeout(350);
  for (const id of ["builder", "critic", "merge-gate", "done"]) await expect(node(page, id)).toBeInViewport({ ratio: 0.95 });
  await page.getByRole("button", { name: "Readable size" }).tap();
  await page.waitForTimeout(350);
  expect((await node(page, "builder").boundingBox())!.width).toBeGreaterThanOrEqual(99);

  // A graph that fits at a readable size opens whole, and offers nothing.
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("./#/templates/built-in/grind-loop");
  await expect(page.locator(".react-flow__node").first()).toBeVisible();
  await page.waitForTimeout(300);
  await expect(page.getByRole("button", { name: "Show all" })).toHaveCount(0);
});

test("the run view's canvas can take most of a phone screen, and give it back", async ({ page }) => {
  await page.goto(linkFor(runBundle("slice-0007-sandwich")));
  await expect(page.locator(".run-badge").first()).toBeVisible();
  const stage = page.locator(".run-stage");
  const before = (await stage.boundingBox())!.height;
  await page.getByRole("button", { name: "Bigger graph" }).tap();
  await expect.poll(async () => (await stage.boundingBox())!.height).toBeGreaterThan(before * 1.5);
  await page.getByRole("button", { name: "Smaller graph" }).tap();
  await expect.poll(async () => (await stage.boundingBox())!.height).toBe(before);
});

/**
 * Review 2026-10, item 14: on a wide screen the inspector opens beside the
 * canvas and takes a third of it. A view the app chose is chosen again for
 * the room left, so no node ends up under the panel; a view the person moved
 * is theirs and stays.
 */
test.describe("on a wide screen", () => {
  test.use({ viewport: { width: 1280, height: 800 }, isMobile: false, hasTouch: false, deviceScaleFactor: 1 });

  test("opening a node's panel refits the graph beside it, unless the view was moved by hand", async ({ page }) => {
    await page.goto("./");
    await page.locator('input[type="file"]').setInputFiles({ name: "review-loop.grooph.json", mimeType: "application/json", buffer: Buffer.from(readFileSync(fixturePath, "utf8")) });
    await expect(node(page, "done")).toBeVisible();
    await page.waitForTimeout(300);
    for (const id of ["builder", "critic", "merge-gate", "done"]) await expect(node(page, id)).toBeInViewport({ ratio: 0.95 });

    await node(page, "critic").click();
    await expect(sheet(page).getByRole("heading", { name: "Agent" })).toBeVisible();
    await page.waitForTimeout(400);
    const panel = (await sheet(page).boundingBox())!;
    for (const id of ["builder", "critic", "merge-gate", "done"]) {
      const box = (await node(page, id).boundingBox())!;
      expect(box.x + box.width, `${id} is clear of the panel`).toBeLessThanOrEqual(panel.x);
      expect(box.x).toBeGreaterThanOrEqual(0);
    }

    // Closed again, the graph takes the whole width back.
    await page.getByRole("button", { name: "Close panel" }).click();
    await page.waitForTimeout(400);
    const wide = (await node(page, "builder").boundingBox())!;

    // Pan by hand, then open the panel: the view the person chose is not touched.
    const stage = (await page.locator(".stage").boundingBox())!;
    await page.mouse.move(stage.x + 200, stage.y + 520);
    await page.mouse.down();
    await page.mouse.move(stage.x + 260, stage.y + 560, { steps: 6 });
    await page.mouse.up();
    const moved = (await node(page, "builder").boundingBox())!;
    expect(moved.x - wide.x).toBeGreaterThan(40);
    await node(page, "builder").click();
    await expect(sheet(page).getByRole("heading", { name: "Agent" })).toBeVisible();
    await page.waitForTimeout(400);
    const after = (await node(page, "builder").boundingBox())!;
    expect(Math.abs(after.width - moved.width)).toBeLessThan(0.5); // no zoom

    // Fit puts the app back in charge of the view.
    await toolbarFit(page);
    for (const id of ["builder", "critic", "merge-gate", "done"]) {
      const box = (await node(page, id).boundingBox())!;
      expect(box.x + box.width).toBeLessThanOrEqual((await sheet(page).boundingBox())!.x);
    }
  });
});

async function toolbarFit(page: import("@playwright/test").Page): Promise<void> {
  await page.getByRole("toolbar", { name: "Canvas" }).getByRole("button", { name: "Fit" }).click();
  await page.waitForTimeout(350);
}

/** Review item 12: an edge's label never sits on a node. The label of a back edge that crosses a fan-out slides along its curve. */
for (const [name, viewport] of [
  ["a phone", { width: 400, height: 800 }],
  ["a computer", { width: 1280, height: 800 }],
] as const) {
  test(`no edge label covers a node in the critic bank and the gauntlet, on ${name}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    for (const template of ["specialist-critic-bank", "gauntlet-decomposed"]) {
      await page.goto(`./#/templates/built-in/${template}`);
      await expect(page.locator(".react-flow__node").first()).toBeVisible();
      await expect(page.locator(".gedge-label").first()).toBeVisible();
      const covered = await page.evaluate(() => {
        const rect = (el: Element) => el.getBoundingClientRect();
        const nodes = [...document.querySelectorAll(".react-flow__node")].map(rect);
        return [...document.querySelectorAll(".gedge-label")]
          .filter((label) => {
            const l = rect(label);
            return nodes.some((n) => l.left < n.right - 1 && l.right > n.left + 1 && l.top < n.bottom - 1 && l.bottom > n.top + 1);
          })
          .map((label) => label.getAttribute("aria-label"));
      });
      expect(covered, `${template}: labels on a node`).toEqual([]);
    }
  });
}
