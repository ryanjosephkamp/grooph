import { readFileSync } from "node:fs";

import { expect, test, type Page } from "@playwright/test";

import { closeSheet, downloadText, fixturePath, importDocument, node, sheet, toolbar } from "./support.js";

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
  await expect(toolbar(page).getByRole("button", { name: "Save layout" })).toBeVisible();
  await toolbar(page).getByRole("button", { name: "Save layout" }).tap();
  await expect(toolbar(page).getByRole("button", { name: "Save layout" })).toHaveCount(0);
  const doc = await downloadGraph(page);
  const layout = doc["layout"] as Record<string, { x: number; y: number }>;
  expect(Object.keys(layout).sort()).toEqual(["builder", "critic", "done", "merge-gate"]);
  expect(layout["builder"]!.y).toBeLessThan(layout["critic"]!.y);
});
