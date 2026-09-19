import { writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { canonicalizeProposals } from "@grooph/core";
import { expect, test, type Page } from "@playwright/test";

import { csvSet, linkFor, node, pager, reviewLoop, sheet, status } from "./support.js";

/**
 * Handoff 0006, criteria 5 and 6: links open read-only, a proposal set opens
 * the comparison, nothing is stored until Save, and a bad link says what is
 * wrong. Phone size with touch, as the rest of the suite.
 */

const LINE = 'I pick "Reviewed" (reviewed) from csv-export.';

/**
 * A finger drag across the cards: CDP touch events, so the browser scrolls and snaps as it
 * would under a thumb. One move per frame, so the speed is a thumb's, not a teleport's.
 */
async function swipe(page: Page, from: { x: number; y: number }, to: { x: number; y: number }): Promise<void> {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [from] });
  const steps = 14;
  for (let i = 1; i <= steps; i++) {
    const x = from.x + ((to.x - from.x) * i) / steps;
    const y = from.y + ((to.y - from.y) * i) / steps;
    await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x, y }] });
    await page.waitForTimeout(16);
  }
  await page.waitForTimeout(16);
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await cdp.detach();
}

const card = (page: Page, id: string) => page.locator(`.ccard[data-candidate="${id}"]`);

async function inView(page: Page, id: string): Promise<boolean> {
  const box = await card(page, id).boundingBox();
  return box !== null && box.x >= 0 && box.x + box.width <= 400;
}

test("a graph link opens read-only, stores nothing, and Save makes it an editable graph", async ({ page }) => {
  const doc = reviewLoop();
  doc.notes = [{ id: "n-0001", run: "r1", at: "graph", text: "run started" }];
  await page.goto(linkFor(doc));

  await expect(page.getByRole("button", { name: /^Review loop/ })).toContainText("from a link · read-only");
  await expect(status(page)).toHaveText("1 warning");
  await expect(node(page, "critic")).toBeVisible();
  await expect(page.getByRole("button", { name: "Export", exact: true })).toHaveCount(0);
  await expect(page.getByRole("toolbar", { name: "Canvas" })).toHaveCount(0);

  // Details are read, not edited.
  await node(page, "critic").tap();
  await expect(sheet(page)).toContainText("Compare the diff and test output against the checklist.");
  await expect(sheet(page).locator("input, textarea, select")).toHaveCount(0);
  await page.getByRole("button", { name: "Close panel" }).tap();

  // Nothing is on the device yet.
  await page.getByRole("link", { name: "All graphs" }).tap();
  await expect(page.getByText("No graphs on this device yet.")).toBeVisible();
  await page.goBack();

  await page.getByRole("button", { name: "Save to this device" }).tap();
  await expect(page.getByRole("status")).toContainText("Saved to this device.");
  await page.getByRole("link", { name: "Open it to edit" }).tap();
  await expect(page.getByRole("button", { name: "Export", exact: true })).toBeVisible();
  await expect(page.getByRole("toolbar", { name: "Canvas" })).toBeVisible();
  await expect(page.getByRole("button", { name: /^Review loop/ })).toContainText("saved");
});

test("a three-candidate link opens the comparison with each card's facts above the fold", async ({ page }) => {
  await page.goto(linkFor(csvSet()));
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("CSV export for the orders list");
  await expect(page.getByRole("region", { name: "Brief" })).toContainText("A small Express app");
  await expect(page.locator(".ccard")).toHaveCount(3);

  const lean = card(page, "lean");
  const bar = (await page.locator(".compare-bar").boundingBox())!;
  const facts = [
    lean.getByRole("heading", { name: "Lean" }),
    lean.getByText("Recommended", { exact: true }),
    lean.getByText("The behaviour is fully testable"),
    lean.getByRole("list", { name: "Profile" }),
    lean.getByText("1 agent · 1 check · 1 loop · up to 5 rounds · 30 minutes"),
    lean.getByText(/^The route is small and the behaviour is fully checkable/),
  ];
  for (const fact of facts) {
    await expect(fact).toBeVisible();
    const box = (await fact.boundingBox())!;
    expect(box.x + box.width, "inside the card, not cut at the side").toBeLessThanOrEqual(400);
    expect(box.y, "starts above the action bar, with no scrolling").toBeLessThan(bar.y);
  }
  // The rationale's first sentence clears the bar, not just its first line.
  const rationale = (await lean.locator(".ccard-rationale").boundingBox())!;
  expect(rationale.y + 3 * 22).toBeLessThan(bar.y);

  await expect(lean.getByRole("list", { name: "Profile" }).getByRole("listitem")).toHaveText(["Low cost", "Fast", "Light rigor"]);
  await expect(card(page, "reviewed").locator(".ccard-status")).toContainText("1 warning");
  await expect(card(page, "reviewed").locator(".cons li")).toHaveCount(2);
  await expect(lean.locator(".mini .react-flow__node")).toHaveCount(3);
  // Nothing is stored by opening.
  await page.goto("./");
  await expect(page.getByText("No graphs on this device yet.")).toBeVisible();
});

test("swipe between cards; the bar and pager follow the card in view", async ({ page }) => {
  await page.goto(linkFor(csvSet()));
  await expect(pager(page)).toHaveText("Lean · 1 of 3");
  expect(await inView(page, "lean")).toBe(true);

  await swipe(page, { x: 330, y: 560 }, { x: 40, y: 570 });
  await expect(pager(page)).toHaveText("Reviewed · 2 of 3");
  await expect.poll(() => inView(page, "reviewed")).toBe(true);
  await expect(page.getByRole("button", { name: "Choose Reviewed" })).toBeVisible();

  await swipe(page, { x: 330, y: 560 }, { x: 40, y: 570 });
  await expect(pager(page)).toHaveText("Rigorous · 3 of 3");

  await swipe(page, { x: 60, y: 560 }, { x: 360, y: 570 });
  await expect(pager(page)).toHaveText("Reviewed · 2 of 3");

  // The dots are the same thing for anyone who cannot swipe.
  await page.getByRole("button", { name: "Show Lean" }).tap();
  await expect(pager(page)).toHaveText("Lean · 1 of 3");
});

test("Choose copies the exact line for the chat", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto(linkFor(csvSet()));
  await page.getByRole("button", { name: "Show Reviewed" }).tap();
  await expect(pager(page)).toHaveText("Reviewed · 2 of 3");
  await page.getByRole("button", { name: "Choose Reviewed" }).tap();
  await expect(page.locator(".compare-bar").getByRole("status")).toContainText(`Copied. Paste it into the chat: ${LINE}`);
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(LINE);
});

test("Save stores the chosen graph, and it opens editable from the library", async ({ page }) => {
  await page.goto(linkFor(csvSet()));
  await page.getByRole("button", { name: "Show Rigorous" }).tap();
  await expect(pager(page)).toHaveText("Rigorous · 3 of 3");
  await page.locator(".compare-bar").getByRole("button", { name: "Save to this device" }).tap();
  await expect(page.locator(".compare-bar").getByRole("status")).toContainText("Saved to this device.");

  await page.goto("./");
  const rows = page.getByRole("list", { name: "Graphs on this device" }).getByRole("listitem");
  await expect(rows).toHaveCount(1);
  await expect(rows.first()).toContainText("CSV export rigorous");
  await rows.first().getByRole("button", { name: /^CSV export rigorous/ }).tap();

  // Editable: the editor's toolbar, and an edit that sticks.
  await expect(page.getByRole("toolbar", { name: "Canvas" })).toBeVisible();
  await node(page, "builder").tap();
  const name = sheet(page).getByLabel("Name", { exact: true });
  await name.fill("Builder, renamed");
  // The id follows the name while it is the name's slug (decision 0006).
  await expect(node(page, "builder-renamed")).toContainText("Builder, renamed");

  // Saving the same graph again from the link does not make a second copy.
  await page.goto(linkFor(csvSet()));
  await page.getByRole("button", { name: "Show Lean" }).tap();
  await page.locator(".compare-bar").getByRole("button", { name: "Save to this device" }).tap();
  await page.locator(".compare-bar").getByRole("link", { name: "Open saved copy" }).tap();
  await expect(page.getByRole("button", { name: /^CSV export lean/ })).toBeVisible();
  await page.goto("./");
  await expect(page.getByRole("list", { name: "Graphs on this device" }).getByRole("listitem")).toHaveCount(2);
});

test("Open full graph shows one candidate read-only, and back returns to the comparison", async ({ page }) => {
  await page.goto(linkFor(csvSet()));
  await card(page, "rigorous").getByRole("link", { name: "Open full graph" }).evaluate((a: HTMLAnchorElement) => a.click());
  await expect(page.getByRole("button", { name: /^CSV export rigorous/ })).toContainText("Rigorous · from CSV export for the orders list · read-only");
  await expect(node(page, "planner")).toBeVisible();
  await page.getByRole("navigation", { name: "Loops" }).getByRole("button", { name: "Build" }).tap();
  await expect(sheet(page)).toContainText("Every line of ACCEPTANCE.md is shown to hold");
  await page.getByRole("link", { name: "Back to the comparison" }).tap();
  await expect(page.locator(".ccard")).toHaveCount(3);
});

test("a damaged or foreign link says what is wrong and leads back to the library", async ({ page }) => {
  const good = linkFor(csvSet());
  for (const [link, message] of [
    [good.slice(0, Math.floor(good.length * 0.6)), /damaged/],
    [`${good.slice(0, 60)}*!${good.slice(62)}`, /characters a grooph link never has/],
    ["./#/open?d=", /nothing after d=/],
  ] as const) {
    await page.goto(link);
    await expect(page.getByRole("heading", { name: "This link could not be opened" })).toBeVisible();
    await expect(page.getByRole("alert")).toContainText(message);
    await expect(page.getByText("Nothing from it was stored on this device.")).toBeVisible();
  }
  await page.getByRole("link", { name: "Back to your graphs" }).tap();
  await expect(page.getByRole("heading", { name: "grooph" })).toBeVisible();
});

test("the self-contained file from grooph share --out imports into the same comparison", async ({ page }) => {
  const file = join(tmpdir(), `csv-export-${Date.now()}.grooph-proposals.json`);
  writeFileSync(file, canonicalizeProposals(csvSet()));
  await page.goto("./");
  await page.locator('input[type="file"]').setInputFiles(file);
  await expect(page.locator(".ccard")).toHaveCount(3);
  await expect(pager(page)).toHaveText("Lean · 1 of 3");
});

test.describe("at desktop width", () => {
  test.use({ viewport: { width: 1280, height: 900 }, isMobile: false, hasTouch: false });

  test("the cards stand side by side with their rows aligned", async ({ page }) => {
    await page.goto(linkFor(csvSet()));
    const boxes = await Promise.all(["lean", "reviewed", "rigorous"].map(async (id) => (await card(page, id).boundingBox())!));
    expect(new Set(boxes.map((b) => Math.round(b.y))).size, "one row of cards").toBe(1);
    expect(boxes[0]!.x).toBeLessThan(boxes[1]!.x);
    expect(boxes[1]!.x).toBeLessThan(boxes[2]!.x);
    expect(boxes[2]!.x + boxes[2]!.width).toBeLessThanOrEqual(1280);

    // Aligned rows: the same section starts at the same height in every card.
    for (const section of [".ccard-profile", ".ccard-shape", ".ccard-rationale", ".ccard-status", ".ccard-canvas", ".ccard-actions"]) {
      const ys = await Promise.all(["lean", "reviewed", "rigorous"].map(async (id) => Math.round((await card(page, id).locator(section).boundingBox())!.y)));
      expect(new Set(ys).size, `${section} aligned: ${ys.join(", ")}`).toBe(1);
    }

    await expect(page.locator(".compare-bar")).toBeHidden();
    await expect(card(page, "reviewed").getByRole("button", { name: "Choose Reviewed" })).toBeVisible();
  });
});

test("the compare view opens on the recommended candidate, in view (review 0006, finding 1)", async ({ page }) => {
  const set = csvSet();
  set.recommendation = { candidate: "rigorous", why: "Test: the recommendation is the last card." };
  await page.goto(linkFor(set));
  await expect(pager(page)).toHaveText("Rigorous · 3 of 3");
  await expect(card(page, "rigorous").locator(".badge")).toHaveText("Recommended");
  await expect.poll(() => inView(page, "rigorous")).toBe(true);
  expect(await inView(page, "lean")).toBe(false);
  // The sticky bar acts on the card in view.
  await expect(page.locator(".compare-bar").getByRole("button", { name: "Choose Rigorous" })).toBeVisible();
});
