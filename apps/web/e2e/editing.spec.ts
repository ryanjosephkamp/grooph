import { readFileSync } from "node:fs";

import { expect, test, type Page } from "@playwright/test";

import { closeSheet, edgeLabel, fit, fixturePath, importDocument, node, sheet, status, toolbar } from "./support.js";

/**
 * Handoff 0007, criteria 6–9: undo and redo, storage persistence, the
 * toolbar beside the sheet, and the rename warning after an export.
 */

const open = (page: Page) => importDocument(page, "review-loop.grooph.json", readFileSync(fixturePath, "utf8"));
const undoButton = (page: Page) => toolbar(page).getByRole("button", { name: "Undo" });
const redoButton = (page: Page) => toolbar(page).getByRole("button", { name: "Redo" });
const toast = (page: Page) => page.locator(".toast");

test("deleting a node, an edge or a loop shows Deleted · Undo, and Undo brings it back", async ({ page }) => {
  await open(page);
  await expect(undoButton(page)).toBeDisabled();

  await node(page, "critic").tap();
  await sheet(page).getByRole("button", { name: "Delete agent" }).tap();
  await expect(node(page, "critic")).toHaveCount(0);
  await expect(toast(page)).toContainText("Deleted Critic");
  await toast(page).getByRole("button", { name: "Undo" }).tap();
  await expect(node(page, "critic")).toBeVisible();
  await expect(toast(page)).toHaveCount(0);
  await expect(status(page)).toHaveText("1 warning");

  await edgeLabel(page, "e-gate-reject").tap();
  await sheet(page).getByRole("button", { name: "Delete edge" }).tap();
  await expect(toast(page)).toContainText("Deleted edge merge-gate → builder");
  await toast(page).getByRole("button", { name: "Undo" }).tap();
  await expect(edgeLabel(page, "e-gate-reject")).toBeVisible();

  await page.locator(".loop-pill").first().tap();
  await sheet(page).getByRole("button", { name: "Delete loop" }).tap();
  await expect(toast(page)).toContainText("Deleted loop");
  await expect(page.locator(".loop-pill")).toHaveCount(0);
  await toast(page).getByRole("button", { name: "Undo" }).tap();
  await expect(page.locator(".loop-pill")).toHaveCount(1);

  // The toast leaves on its own after a moment.
  await node(page, "critic").tap();
  await sheet(page).getByRole("button", { name: "Delete agent" }).tap();
  await expect(toast(page)).toBeVisible();
  await expect(toast(page)).toHaveCount(0, { timeout: 8000 });
});

test("undo and redo from the toolbar and the keyboard; typing is one step; the stack outlives the sheet", async ({ page }) => {
  await open(page);
  await page.locator(".title-btn").tap();
  const s = sheet(page);
  const name = s.getByLabel("Name", { exact: true });
  const adaptation = s.getByRole("radiogroup", { name: "Adaptation" });
  // Step 1: typing a name, keystroke by keystroke. Step 2: a tap.
  await name.fill("Renamed");
  await name.pressSequentially(" graph", { delay: 40 });
  await adaptation.getByRole("radio", { name: "propose" }).tap();
  await expect(page.locator(".title-name")).toHaveText("Renamed graph");

  // Closing and reopening the sheet keeps the stack.
  await closeSheet(page);
  await expect(undoButton(page)).toBeEnabled();
  await page.locator(".title-btn").tap();
  await closeSheet(page);

  await undoButton(page).tap();
  await page.locator(".title-btn").tap();
  await expect(adaptation.getByRole("radio", { name: "adaptive" })).toHaveAttribute("aria-checked", "true");
  await expect(page.locator(".title-name")).toHaveText("Renamed graph");
  await undoButton(page).tap();
  await expect(page.locator(".title-name")).toHaveText("Review loop");
  await expect(s.getByLabel("Id")).toHaveValue("review-loop");
  await expect(undoButton(page)).toBeDisabled();
  await redoButton(page).tap();
  await redoButton(page).tap();
  await expect(page.locator(".title-name")).toHaveText("Renamed graph");
  await expect(adaptation.getByRole("radio", { name: "propose" })).toHaveAttribute("aria-checked", "true");
  await expect(redoButton(page)).toBeDisabled();

  // Keyboard: Ctrl+Z and Shift+Ctrl+Z, Cmd on a Mac; the focus may be in a text field.
  await name.focus();
  await page.keyboard.press("Control+z");
  await expect(adaptation.getByRole("radio", { name: "adaptive" })).toHaveAttribute("aria-checked", "true");
  await page.keyboard.press("Meta+z");
  await expect(page.locator(".title-name")).toHaveText("Review loop");
  await page.keyboard.press("Shift+Control+z");
  await expect(page.locator(".title-name")).toHaveText("Renamed graph");
  await page.keyboard.press("Shift+Meta+z");
  await expect(adaptation.getByRole("radio", { name: "propose" })).toHaveAttribute("aria-checked", "true");

  // Not across a reload.
  await expect(page.locator(".title-sub")).toHaveText(/· saved$/);
  await page.reload();
  await expect(page.locator(".title-name")).toHaveText("Renamed graph");
  await expect(undoButton(page)).toBeDisabled();
});

test("the undo stack is at least 50 steps deep", async ({ page }) => {
  await open(page);
  await node(page, "critic").tap();
  const tier = sheet(page).getByRole("radiogroup", { name: "Model tier" });
  // 60 taps, each its own step even in quick succession.
  for (let i = 0; i < 60; i++) await tier.getByRole("radio", { name: i % 2 === 0 ? "fast" : "frontier" }).tap();
  await expect(tier.getByRole("radio", { name: "frontier" })).toHaveAttribute("aria-checked", "true");
  for (let i = 0; i < 59; i++) await page.keyboard.press("Control+z");
  await expect(tier.getByRole("radio", { name: "fast" })).toHaveAttribute("aria-checked", "true");
  await page.keyboard.press("Control+z");
  await expect(tier.getByRole("radio", { name: "strong" })).toHaveAttribute("aria-checked", "true");
  await expect(undoButton(page)).toBeDisabled();
});

test.describe("storage persistence", () => {
  /** A browser that answers `persist()` with `granted`, counting the calls. */
  const answer = (page: Page, granted: boolean) =>
    page.addInitScript((granted) => {
      const w = window as unknown as { persistCalls: number };
      w.persistCalls = 0;
      Object.defineProperty(navigator, "storage", {
        configurable: true,
        value: {
          persisted: async () => false,
          persist: async () => {
            w.persistCalls++;
            return granted;
          },
          estimate: async () => ({}),
        },
      });
    }, granted);

  test("asked once after the first save; a refusal is explained once, then never again", async ({ page }) => {
    await answer(page, false);
    await page.goto("./");
    await expect(page.locator(".persist-notice")).toHaveCount(0);
    expect(await page.evaluate(() => (window as unknown as { persistCalls: number }).persistCalls)).toBe(0);

    await page.getByRole("button", { name: "New graph" }).tap();
    const notice = page.locator(".persist-notice");
    await expect(notice).toContainText("Storage not guaranteed");
    await expect(notice).toContainText("Download graph");
    await notice.getByRole("button", { name: "Got it" }).tap();
    await expect(notice).toHaveCount(0);

    // No nagging: more saves, a reload and another graph ask nothing and show nothing.
    await sheet(page).getByLabel("Name", { exact: true }).fill("Kept");
    await page.reload();
    await page.goto("./");
    await page.getByRole("button", { name: "New graph" }).tap();
    await expect(sheet(page).getByLabel("Name", { exact: true })).toBeFocused();
    await expect(notice).toHaveCount(0);
    expect(await page.evaluate(() => (window as unknown as { persistCalls: number }).persistCalls)).toBe(0);
  });

  test("a grant is reported once too", async ({ page }) => {
    await answer(page, true);
    await page.goto("./");
    await page.getByRole("button", { name: "New graph" }).tap();
    await expect(page.locator(".persist-notice")).toContainText("Storage kept");
    expect(await page.evaluate(() => (window as unknown as { persistCalls: number }).persistCalls)).toBe(1);
    await page.getByRole("link", { name: "All graphs" }).tap();
    // Still undismissed, so the library shows it too, until Got it.
    await page.locator(".persist-notice").getByRole("button", { name: "Got it" }).tap();
    await page.reload();
    await expect(page.locator(".persist-notice")).toHaveCount(0);
  });
});

test("with the sheet open the toolbar sits above it and covers no canvas; the selection stays in view", async ({ page }) => {
  await open(page);
  // Without a sheet, the toolbar floats over the foot of the canvas.
  await expect(toolbar(page)).toHaveCSS("position", "absolute");

  await page.locator(".persist-notice").getByRole("button", { name: "Got it" }).tap();
  for (const id of ["builder", "critic", "merge-gate", "done"]) {
    await closeSheet(page);
    await fit(page);
    await node(page, id).tap();
    await page.waitForTimeout(450);
    const pane = (await page.locator(".stage .react-flow").boundingBox())!;
    const bar = (await toolbar(page).boundingBox())!;
    const aside = (await sheet(page).boundingBox())!;
    const selected = (await node(page, id).boundingBox())!;
    expect(bar.y, "toolbar below the canvas").toBeGreaterThanOrEqual(pane.y + pane.height - 1);
    expect(bar.y + bar.height, "toolbar above the sheet").toBeLessThanOrEqual(aside.y + 1);
    expect(selected.y, `${id} below the top of the canvas`).toBeGreaterThanOrEqual(pane.y);
    expect(selected.y + selected.height, `${id} clear of the toolbar and the sheet`).toBeLessThanOrEqual(pane.y + pane.height);
    // Every tool is still a full touch target.
    for (const tool of await toolbar(page).getByRole("button").all()) expect((await tool.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  }
});

test("renaming a graph exported from this device warns that the package folder changes, and can keep the old id", async ({ page }) => {
  await open(page);

  // Before any export, a rename says nothing.
  await page.locator(".title-btn").tap();
  const name = sheet(page).getByLabel("Name", { exact: true });
  await name.fill("Review loop draft");
  await expect(sheet(page).getByLabel("Id")).toHaveValue("review-loop-draft");
  await expect(page.locator(".rename-warning")).toHaveCount(0);
  await name.fill("Review loop");
  await expect(page.locator(".title-sub")).toHaveText(/· saved$/);

  // Export (download the package), then rename.
  await page.getByRole("button", { name: "Export", exact: true }).tap();
  const downloading = page.waitForEvent("download");
  await sheet(page).getByRole("button", { name: "Download package (.zip)" }).tap();
  expect((await downloading).suggestedFilename()).toBe("review-loop-claude-code.zip");

  await page.locator(".title-btn").tap();
  await name.fill("Review loop v2");
  const warning = sheet(page).locator(".rename-warning");
  await expect(warning).toContainText(".grooph/review-loop/");
  await expect(warning).toContainText(".grooph/review-loop-v2/");
  await warning.getByRole("button", { name: "Keep the old id" }).tap();
  await expect(sheet(page).getByLabel("Id")).toHaveValue("review-loop");
  await expect(page.locator(".title-name")).toHaveText("Review loop v2");
  await expect(warning).toHaveCount(0);

  // It is remembered on the device: the list's rename warns too.
  await page.getByRole("link", { name: "All graphs" }).tap();
  await page.getByRole("button", { name: "Actions for Review loop v2" }).tap();
  await page.getByRole("button", { name: "Rename" }).tap();
  // The id no longer follows the name, so renaming leaves it alone and says nothing.
  await page.getByLabel("Graph name").fill("Something else");
  await expect(page.locator(".rename-warning")).toHaveCount(0);
  await page.getByRole("button", { name: "Save" }).tap();
  await expect(page.locator(".graph-meta").first()).toContainText("review-loop");
});

test("the list's rename warns after an export, and Keep the old id keeps it", async ({ page }) => {
  await open(page);
  await page.getByRole("button", { name: "Export", exact: true }).tap();
  const downloading = page.waitForEvent("download");
  await sheet(page).getByRole("button", { name: "Download package (.zip)" }).tap();
  await downloading;
  await page.getByRole("link", { name: "All graphs" }).tap();

  await page.getByRole("button", { name: "Actions for Review loop" }).tap();
  await page.getByRole("button", { name: "Rename" }).tap();
  await page.getByLabel("Graph name").fill("Review loop, mine");
  const warning = page.locator(".rename-warning");
  await expect(warning).toContainText(".grooph/review-loop-mine/");
  await warning.getByRole("button", { name: "Keep the old id" }).tap();
  await expect(page.getByText("Review loop, mine")).toBeVisible();
  await expect(page.locator(".graph-meta").first()).toContainText("review-loop ·");
});
