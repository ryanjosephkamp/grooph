import { readFileSync } from "node:fs";

import { expect, test } from "@playwright/test";

import { fixturePath, importDocument } from "./support.js";

/**
 * Handoff 0078, the fourth read: a graph whose id is a folder grooph keeps under `.grooph/` is not exported, and the
 * app says so in the sentence the command line and the MCP tool say (it is the compiler's: `keptFolder` in core).
 */
test("Export refuses a graph whose id is a folder grooph keeps, in the compiler's own sentence, and exports it once the id is its own", async ({ page }) => {
  const doc = JSON.parse(readFileSync(fixturePath, "utf8")) as Record<string, unknown>;
  await importDocument(page, "templates.grooph.json", JSON.stringify({ ...doc, id: "templates" }));
  await page.getByRole("button", { name: "Export", exact: true }).tap();
  await expect(page.getByRole("alert")).toContainText('A graph with the id "templates" is not exported: its package would be placed in .grooph/templates/, the folder grooph keeps the project\'s templates in. Give the graph an id of its own, in the graph\'s panel, and export again.');
  await expect(page.getByRole("button", { name: "Download package (.zip)" })).toHaveCount(0);

  await importDocument(page, "mine.grooph.json", JSON.stringify({ ...doc, id: "templates-of-mine" }));
  await page.getByRole("button", { name: "Export", exact: true }).tap();
  await expect(page.getByRole("button", { name: "Download package (.zip)" })).toBeVisible();
});
