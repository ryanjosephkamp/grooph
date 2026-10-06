import { expect, test } from "@playwright/test";

import { sheet } from "./support.js";

test("the harness picker exports a graph for Codex", async ({ page }) => {
  const s = sheet(page);
  const field = (label: string) => s.getByLabel(label, { exact: true });

  await page.goto("./");
  await page.getByRole("button", { name: "New graph" }).tap();
  await field("Name").fill("Codex graph");
  await field("Goal").fill("Exercise the Codex export target.");
  // Both targets by their titles, which is all the app's first load carries of a target (the profiles come with
  // the compiler, when a person exports).
  await expect(field("Target harness").locator("option")).toHaveText(["(choose)", "Claude Code", "Codex", "other…"]);
  await field("Target harness").selectOption("codex");
  await expect(field("Target harness")).toHaveValue("codex");

  await page.getByRole("button", { name: "Export", exact: true }).tap();
  await expect(s.getByText(/paste the kickoff prompt into a Codex session opened there/)).toBeVisible();
  await expect(s.getByRole("heading", { name: /files for codex/i })).toBeVisible();
});
