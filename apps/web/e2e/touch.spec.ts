import { readFileSync } from "node:fs";

import { expect, test, type CDPSession, type Page } from "@playwright/test";

import { downloadText, fit, fixturePath, importDocument, linkFor, node, reviewLoop, sheet } from "./support.js";

/**
 * Review 2026-10: pinch and drag with fingers. Every other test taps; a tap
 * is one touch that does not move. These send the browser real multi-touch
 * input (Chromium's `Input.dispatchTouchEvent`, the events a finger makes),
 * so the canvas's gesture handling is exercised and not only its clicks.
 * It is still an emulated phone: a hand on glass remains the owner's check.
 */
type Point = { x: number; y: number };

const touch = (client: CDPSession, type: "touchStart" | "touchMove" | "touchEnd", points: Point[]) =>
  client.send("Input.dispatchTouchEvent", { type, touchPoints: points.map((p, id) => ({ x: Math.round(p.x), y: Math.round(p.y), id })) });

/** Move every finger from its start to its end in small steps, as a hand does. */
async function gesture(page: Page, from: Point[], to: Point[], steps = 12): Promise<void> {
  const client = await page.context().newCDPSession(page);
  await touch(client, "touchStart", from);
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    await touch(client, "touchMove", from.map((p, k) => ({ x: p.x + (to[k]!.x - p.x) * t, y: p.y + (to[k]!.y - p.y) * t })));
    await page.waitForTimeout(16);
  }
  await touch(client, "touchEnd", []);
  await client.detach();
  await page.waitForTimeout(150);
}

const zoom = (page: Page): Promise<number> =>
  page.locator(".react-flow__viewport").evaluate((el) => new DOMMatrixReadOnly(getComputedStyle(el).transform).a);

const centre = async (page: Page, id: string): Promise<Point> => {
  const box = (await node(page, id).boundingBox())!;
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
};

test("two fingers pinch the canvas in and out; one finger on the background pans it", async ({ page }) => {
  await importDocument(page, "review-loop.grooph.json", readFileSync(fixturePath, "utf8"));
  await page.waitForTimeout(300);
  const stage = (await page.locator(".stage").boundingBox())!;
  const mid = { x: stage.x + stage.width / 2, y: stage.y + stage.height * 0.75 }; // clear of the nodes
  const start = await zoom(page);

  // Spread: fingers 60 px apart move to 240 px apart.
  await gesture(page, [{ x: mid.x - 30, y: mid.y }, { x: mid.x + 30, y: mid.y }], [{ x: mid.x - 120, y: mid.y }, { x: mid.x + 120, y: mid.y }]);
  const spread = await zoom(page);
  expect(spread).toBeGreaterThan(start * 1.5);

  // Pinch back together, past where it began.
  await gesture(page, [{ x: mid.x - 150, y: mid.y }, { x: mid.x + 150, y: mid.y }], [{ x: mid.x - 25, y: mid.y }, { x: mid.x + 25, y: mid.y }]);
  expect(await zoom(page)).toBeLessThan(spread / 2);

  // One finger on the background drags the whole graph; nothing in the document moves.
  const before = await centre(page, "builder");
  await gesture(page, [mid], [{ x: mid.x + 90, y: mid.y - 40 }]);
  const after = await centre(page, "builder");
  expect(after.x - before.x).toBeGreaterThan(60);
  expect(after.y - before.y).toBeLessThan(-20);
  await expect(page.getByRole("toolbar", { name: "Canvas" }).getByRole("button", { name: "Undo" })).toBeDisabled();
});

test("one finger on a node drags it, the move is saved in the layout, and one undo takes it back", async ({ page }) => {
  await importDocument(page, "review-loop.grooph.json", readFileSync(fixturePath, "utf8"));
  await fit(page);
  const was = reviewLoop().layout!["critic"]!;
  const from = await centre(page, "critic");
  await gesture(page, [from], [{ x: from.x + 10, y: from.y + 120 }], 16);
  const to = await centre(page, "critic");
  expect(to.y - from.y).toBeGreaterThan(80);
  // A drag is not a tap: the node's sheet stays shut.
  await expect(sheet(page)).toHaveCount(0);

  await page.getByRole("button", { name: "Export", exact: true }).tap();
  const [file] = await Promise.all([page.waitForEvent("download"), sheet(page).getByRole("button", { name: "Download graph (.grooph.json)" }).tap()]);
  const moved = (JSON.parse(await downloadText(file)) as { layout: Record<string, Point> }).layout["critic"]!;
  expect(moved.y).toBeGreaterThan(was.y + 100); // 120 px on screen at less than full size
  await page.getByRole("button", { name: "Close panel" }).tap();

  await page.getByRole("toolbar", { name: "Canvas" }).getByRole("button", { name: "Undo" }).tap();
  await expect.poll(async () => Math.round((await centre(page, "critic")).y)).toBe(Math.round(from.y));
});

test("in a read-only viewer a finger pans and two pinch, and nothing can be dragged out of place", async ({ page }) => {
  await page.goto(linkFor(reviewLoop()));
  await expect(node(page, "builder")).toBeVisible();
  await page.waitForTimeout(300);
  const start = await zoom(page);
  const on = await centre(page, "builder");
  const critic = await centre(page, "critic");

  // A finger that starts on a node moves the picture, not the node.
  await gesture(page, [on], [{ x: on.x - 80, y: on.y + 30 }]);
  const builder = await centre(page, "builder");
  const criticAfter = await centre(page, "critic");
  expect(builder.x - on.x).toBeLessThan(-50);
  expect(Math.round(criticAfter.x - critic.x)).toBe(Math.round(builder.x - on.x));

  const stage = (await page.locator(".stage").boundingBox())!;
  const mid = { x: stage.x + stage.width / 2, y: stage.y + stage.height * 0.3 };
  await gesture(page, [{ x: mid.x - 100, y: mid.y }, { x: mid.x + 100, y: mid.y }], [{ x: mid.x - 30, y: mid.y }, { x: mid.x + 30, y: mid.y }]);
  expect(await zoom(page)).toBeLessThan(start * 0.7);
});
