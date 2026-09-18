import { readFileSync } from "node:fs";

import { expect, test } from "@playwright/test";
import { strFromU8, unzipSync } from "fflate";

import { downloadBytes, downloadText, fixturePath, goldenDir, importDocument, readTree, status } from "./support.js";

/**
 * Handoff 0002, criterion 2: import the review-loop fixture through the app's
 * import control, export the Claude Code package from the app, and the files
 * equal the golden package byte for byte. The core runs unchanged in the browser.
 */
test("the review loop round-trips to the golden package byte for byte", async ({ page }) => {
  await importDocument(page, "review-loop.grooph.json", readFileSync(fixturePath, "utf8"));
  await expect(status(page)).toHaveText("Valid");

  await page.getByRole("button", { name: "Export", exact: true }).tap();
  const [zip] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "Download package (.zip)" }).tap(),
  ]);
  expect(zip.suggestedFilename()).toBe("review-loop-claude-code.zip");

  const files = Object.fromEntries(
    Object.entries(unzipSync(await downloadBytes(zip))).map(([path, bytes]) => [path, strFromU8(bytes)]),
  );
  const golden = readTree(goldenDir);
  expect(Object.keys(files).sort()).toEqual(Object.keys(golden).sort());
  for (const path of Object.keys(golden)) expect(files[path], path).toBe(golden[path]);

  // The graph download is the canonical form, which is the package's own copy.
  const [graph] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "Download graph (.grooph.json)" }).tap(),
  ]);
  expect(graph.suggestedFilename()).toBe("review-loop.grooph.json");
  expect(await downloadText(graph)).toBe(golden[".grooph/review-loop/graph.grooph.json"]);
});

test("the kickoff prompt is one tap from the export sheet", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await importDocument(page, "review-loop.grooph.json", readFileSync(fixturePath, "utf8"));
  await page.getByRole("button", { name: "Export", exact: true }).tap();
  await page.getByRole("button", { name: "Copy kickoff prompt" }).tap();
  await expect(page.getByRole("button", { name: "Kickoff copied" })).toBeVisible();
  const clipboard = await page.evaluate(() => navigator.clipboard.readText());
  expect(clipboard).toBe(readTree(goldenDir)[".grooph/review-loop/KICKOFF.md"]);
});

test("the app is served under the Pages base path", async ({ page }) => {
  const response = await page.goto("./");
  expect(response?.status()).toBe(200);
  const script = await page.locator('script[type="module"]').first().getAttribute("src");
  expect(script).toMatch(/^\/grooph\/assets\//);
  await expect(page.getByRole("heading", { name: "grooph" })).toBeVisible();
});
