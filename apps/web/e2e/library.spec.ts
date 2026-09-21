import { readFileSync } from "node:fs";

import { expect, test } from "@playwright/test";

import { fixturePath, importDocument, sheet, status } from "./support.js";

/** Handoff 0002, criterion 6: graphs persist on the device; list, create, open, rename, duplicate, delete, import. */
test("graphs persist across reloads and can be renamed, duplicated and deleted", async ({ page }) => {
  await importDocument(page, "review-loop.grooph.json", readFileSync(fixturePath, "utf8"));
  const url = page.url();

  // Reload the editor itself: the graph is still there.
  await page.reload();
  await expect(status(page)).toHaveText("1 warning");
  expect(page.url()).toBe(url);

  // A second graph, created and named in the app.
  await page.goto("./");
  await page.getByRole("button", { name: "New graph" }).tap();
  await sheet(page).getByLabel("Name", { exact: true }).fill("Scratch");
  await page.getByRole("link", { name: "All graphs" }).tap();

  const rows = page.getByRole("list", { name: "Graphs on this device" }).getByRole("listitem");
  await expect(rows).toHaveCount(2);
  await expect(rows.first()).toContainText("Scratch");

  // Rename.
  await page.getByRole("button", { name: "Actions for Review loop" }).tap();
  await page.getByRole("button", { name: "Rename" }).tap();
  await page.getByLabel("Graph name").fill("Review loop, mine");
  await page.getByRole("button", { name: "Save" }).tap();
  await expect(page.locator(".graph-name", { hasText: "Review loop, mine" })).toBeVisible();

  // Duplicate.
  await page.getByRole("button", { name: "Actions for Review loop, mine" }).tap();
  await page.getByRole("button", { name: "Duplicate" }).tap();
  await expect(rows).toHaveCount(3);
  await expect(page.locator(".graph-name", { hasText: "Review loop, mine (copy)" })).toBeVisible();

  // Delete asks once more.
  await page.getByRole("button", { name: "Actions for Scratch" }).tap();
  await page.getByRole("button", { name: "Delete", exact: true }).tap();
  await page.getByRole("button", { name: "Delete for good" }).tap();
  await expect(rows).toHaveCount(2);

  // All of it survives a reload.
  await page.reload();
  await expect(rows).toHaveCount(2);
  await expect(page.locator(".graph-name", { hasText: "Review loop, mine (copy)" })).toBeVisible();
  await expect(page.getByText("Scratch")).toHaveCount(0);

  // The copy opens, and is its own graph with its own id. (The rename moved the
  // original's id too: it still followed the name.)
  await page.locator(".graph-name", { hasText: "Review loop, mine (copy)" }).tap();
  await expect(status(page)).toHaveText("1 warning");
  await page.getByRole("button", { name: /^Review loop, mine \(copy\)/ }).tap();
  await expect(sheet(page).getByLabel("Id", { exact: true })).toHaveValue("review-loop-mine-copy");
});

test("a file that is not a graph document is refused with the reason", async ({ page }) => {
  await page.goto("./");
  await page.locator('input[type="file"]').setInputFiles({ name: "notes.json", mimeType: "application/json", buffer: Buffer.from("{ not json") });
  await expect(page.getByRole("alert")).toContainText("Could not import notes.json.");
  await expect(page.getByRole("alert")).toContainText("E_SCHEMA");
  await expect(page.getByRole("list", { name: "Graphs on this device" })).toHaveCount(0);
});
