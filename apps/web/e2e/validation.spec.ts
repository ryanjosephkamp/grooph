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

  // An empty graph names no harness and states no goal. It is a plan, and neither is an error of it (amendment
  // A-020): the list is clear, and what a package for a harness would still need is said under it, plainly.
  await expect(status(page)).toHaveText("Valid");
  await status(page).tap();
  await expect(s.locator(".all-clear")).toHaveText("No issues. The graph validates.");
  await expect(s.locator(".issue-code")).toHaveCount(0);
  const needs = s.getByRole("group", { name: "For a package" });
  await expect(needs.getByRole("listitem")).toHaveText([
    "A harness grooph has a compiler for: Claude Code or Codex. This graph names none, which is right for a plan.",
    "A goal: the lead's brief is built from it.",
  ]);
  await expect(s.getByRole("alert")).toHaveCount(0);

  // Giving one in the graph sheet takes it off the list as it is typed.
  await needs.getByRole("button", { name: "Open graph" }).tap();
  await field("Goal").fill("Prove the panel is live.");
  await expect(field("Target harness").locator("option").first()).toHaveText("None: this is a plan");
  await status(page).tap();
  await expect(s.getByRole("group", { name: "For a package" }).getByRole("listitem")).toHaveCount(1);
  await s.getByRole("group", { name: "For a package" }).getByRole("button", { name: "Open graph" }).tap();
  await field("Target harness").selectOption("claude-code");
  await expect(status(page)).toHaveText("Valid");
  await status(page).tap();
  await expect(s.locator(".all-clear")).toHaveText("No issues. The graph validates for export.");
  await expect(s.getByRole("group", { name: "For a package" })).toHaveCount(0);
  await closeSheet(page);

  // A new agent has no outputs yet: the schema says so, at the node.
  await toolbar(page).getByRole("button", { name: "Add" }).tap();
  await s.getByRole("button", { name: /^Agent/ }).tap();
  await field("Name").fill("Writer");
  await expect(status(page)).toHaveText("1 error");
  await expect(node(page, "writer").locator(".issue-dot-error")).toBeVisible();
  await field("Outputs").fill("DRAFT.md");

  // The stage-3 warnings arrive the same way, pointing at their objects: nothing
  // lets the writer write DRAFT.md yet, and no stop node ends the run.
  await expect(status(page)).toHaveText("2 warnings");
  await status(page).tap();
  await expect(s.locator(".issue-code")).toHaveText(["W_NO_TERMINAL", "W_OUTPUT_NOT_WRITABLE"]);
  await s.getByRole("button", { name: /W_OUTPUT_NOT_WRITABLE/ }).tap();
  await expect(node(page, "writer").locator(".gnode")).toHaveClass(/is-highlighted/);
  await s.getByRole("button", { name: "Open Writer" }).tap();
  await s.getByRole("group", { name: "Allow" }).getByRole("button", { name: "write-outputs", exact: true }).tap();
  await expect(status(page)).toHaveText("1 warning");

  // Two agents in a cycle with no loop around it.
  await toolbar(page).getByRole("button", { name: "Add" }).tap();
  await s.getByRole("button", { name: /^Agent/ }).tap();
  await field("Name").fill("Reader");
  await field("Outputs").fill("NOTES.md");
  await s.getByRole("group", { name: "Allow" }).getByRole("button", { name: "write-outputs", exact: true }).tap();
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
  // The writer is still highlighted from the warning tapped above; the reader never was.
  await expect(node(page, "reader").locator(".gnode")).not.toHaveClass(/is-highlighted/);
  await issue.tap();
  await expect(node(page, "writer").locator(".gnode")).toHaveClass(/is-highlighted/);
  await expect(node(page, "reader").locator(".gnode")).toHaveClass(/is-highlighted/);

  // Export refuses, naming the errors in the CLI's own line format.
  await page.getByRole("button", { name: "Export", exact: true }).tap();
  await expect(s.getByRole("alert")).toContainText("Cannot export for claude-code: fix these first.");
  await expect(s.getByRole("alert")).toContainText("1 validation error — E_CYCLE_NO_STOP");
  await expect(s.locator(".issue-lines")).toContainText(
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
  await expect(s.locator(".issue-code")).toHaveText(["E_JUDGMENT_LOOP_NO_BAR", "W_ONLY_MAX_ITERATIONS", "W_NO_TERMINAL"]);
  await s.getByRole("button", { name: /E_JUDGMENT_LOOP_NO_BAR/ }).tap();
  // A loop issue highlights its members and back edges.
  await expect(node(page, "writer").locator(".gnode")).toHaveClass(/is-highlighted/);
  await expect(page.locator(".gedge.is-highlighted")).toHaveCount(1);
});
