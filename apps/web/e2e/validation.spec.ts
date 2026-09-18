import { expect, test } from "@playwright/test";

import { closeSheet, node, sheet, status, toolbar } from "./support.js";

/**
 * Handoff 0002, criterion 5: the panel shows `validate(doc, { forExport: true })`
 * as the user edits; tapping an issue highlights the objects in its `at`;
 * export is refused with the error list, as the CLI refuses.
 */
test("validation is live, points at its objects, and blocks export", async ({ page }) => {
  const s = sheet(page);
  const field = (label: string) => s.getByLabel(label, { exact: true });

  await page.goto("./");
  await page.getByRole("button", { name: "New graph" }).tap();
  await field("Name").fill("Checks");

  // An empty graph: no target, no goal — the two export preconditions.
  await expect(status(page)).toHaveText("2 errors");
  await status(page).tap();
  await expect(s.locator(".issue-code")).toHaveText(["E_NO_TARGET", "E_NO_GOAL"]);

  // Fixing one in the graph sheet updates the count as it is typed.
  await s.getByRole("button", { name: "Open graph" }).first().tap();
  await field("Goal").fill("Prove the panel is live.");
  await expect(status(page)).toHaveText("1 error");
  await field("Target harness").selectOption("claude-code");
  await expect(status(page)).toHaveText("Valid");

  // A new agent has no outputs yet: the schema says so, at the node.
  await toolbar(page).getByRole("button", { name: "Add" }).tap();
  await s.getByRole("button", { name: /^Agent/ }).tap();
  await field("Name").fill("Writer");
  await expect(status(page)).toHaveText("1 error");
  await expect(node(page, "writer").locator(".issue-dot-error")).toBeVisible();
  await field("Outputs").fill("DRAFT.md");
  await expect(status(page)).toHaveText("Valid");

  // Two agents in a cycle with no loop around it.
  await toolbar(page).getByRole("button", { name: "Add" }).tap();
  await s.getByRole("button", { name: /^Agent/ }).tap();
  await field("Name").fill("Reader");
  await field("Outputs").fill("NOTES.md");
  for (const [from, to] of [
    ["writer", "reader"],
    ["reader", "writer"],
  ] as const) {
    await closeSheet(page);
    await toolbar(page).getByRole("button", { name: "Connect" }).tap();
    await node(page, from).tap();
    await node(page, to).tap();
  }
  await expect(status(page)).toHaveText("1 error");

  await status(page).tap();
  const issue = s.getByRole("button", { name: /E_CYCLE_NO_STOP/ });
  await expect(issue).toContainText("cycle with no stop: writer → reader");
  await expect(node(page, "writer").locator(".gnode")).not.toHaveClass(/is-highlighted/);
  await issue.tap();
  await expect(node(page, "writer").locator(".gnode")).toHaveClass(/is-highlighted/);
  await expect(node(page, "reader").locator(".gnode")).toHaveClass(/is-highlighted/);

  // Export refuses, naming the errors in the CLI's own line format.
  await page.getByRole("button", { name: "Export", exact: true }).tap();
  await expect(s.getByRole("alert")).toContainText("Cannot export for claude-code: fix these first.");
  await expect(s.getByRole("alert")).toContainText("1 validation error — E_CYCLE_NO_STOP");
  await expect(s.locator(".issue-lines")).toHaveText(
    "error  E_CYCLE_NO_STOP  cycle with no stop: writer → reader. Cover it with a loop that has at least one stop.  [at: writer, reader]",
  );
  await expect(s.getByRole("button", { name: "Download package (.zip)" })).toHaveCount(0);

  // A loop with a stop covers the cycle; the loop wants a bar until it has one.
  await closeSheet(page);
  await toolbar(page).getByRole("button", { name: "Loop" }).tap();
  await node(page, "writer").tap();
  await node(page, "reader").tap();
  await page.locator('.gedge-label[data-edge-id="e-reader-writer"]').tap();
  await page.getByRole("status").getByRole("button", { name: "Done" }).tap();
  await s.getByLabel("Stop kind to add").selectOption("max-iterations");
  await s.getByRole("button", { name: "Add stop" }).tap();
  await expect(status(page)).toHaveText("1 error");
  await status(page).tap();
  await expect(s.locator(".issue-code")).toHaveText(["E_JUDGMENT_LOOP_NO_BAR"]);
  await s.getByRole("button", { name: /E_JUDGMENT_LOOP_NO_BAR/ }).tap();
  // A loop issue highlights its members and back edges.
  await expect(node(page, "writer").locator(".gnode")).toHaveClass(/is-highlighted/);
  await expect(page.locator(".gedge.is-highlighted")).toHaveCount(1);
});
