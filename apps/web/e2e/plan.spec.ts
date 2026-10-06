import { mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { canonicalize, type Graph } from "@grooph/core";
import { expect, test } from "@playwright/test";
import { strFromU8, unzipSync } from "fflate";

import { planBundle } from "../../../packages/core/src/index.js";
import { closeSheet, downloadBytes, downloadText, importDocument, reviewLoop, sheet, status } from "./support.js";

/**
 * Slice 0100, amendment A-020: a graph is a plan first. The Export panel always offers the plan of a graph that
 * reads, errors or not, and says plainly what a package for a harness still needs; a missing harness or goal is not
 * an error of the graph; a harness grooph has no compiler for is said plainly, not in red.
 */

/** The review loop as a plan in error: no harness, no goal, and its loop's stops gone (a cycle nothing ends). */
const inError = (): Graph => {
  const doc = reviewLoop();
  delete doc.target;
  delete doc.goal;
  return { ...doc, loops: [] };
};
/** Where the pictures for the owner go when they are asked for (`GROOPH_PLAN_PICTURES=<folder>`, a name no other spec reads); CI writes none. */
const shots = process.env["GROOPH_PLAN_PICTURES"];

test("a plan in error is always offered: its three files one by one and together, and a package says what it still needs", async ({ page }) => {
  const doc = inError();
  const made = planBundle(doc);
  await importDocument(page, "review-loop.grooph.json", canonicalize(doc));
  // The cycle is an error of the graph itself; the missing harness and goal are not.
  await expect(status(page)).toHaveText("1 error");
  await page.getByRole("button", { name: "Export", exact: true }).tap();
  const s = sheet(page);
  const plan = s.getByRole("group", { name: "The plan" });
  await expect(plan.getByRole("button")).toHaveText(["The plan, all three (.zip)", "Plan (PLAN.md)", "Its picture (.svg)", "Download graph (.grooph.json)"]);
  await expect(plan).toContainText("PLAN.md lists 3 things to fix before a harness can run this. They do not stop the plan.");
  if (shots) {
    // The whole panel, at a phone's width, once it has come to rest: the plan first.
    mkdirSync(shots, { recursive: true });
    await s.getByRole("button", { name: "Expand panel" }).tap();
    await page.waitForTimeout(600);
    await page.screenshot({ path: join(shots, "export-panel-a-plan-in-error.jpg"), type: "jpeg", quality: 60 });
  }

  // One by one: each is, byte for byte, the file core's own plan holds for this document.
  let [file] = await Promise.all([page.waitForEvent("download"), plan.getByRole("button", { name: "Plan (PLAN.md)" }).tap()]);
  expect(file.suggestedFilename()).toBe("PLAN.md");
  expect(await downloadText(file)).toBe(made.files["PLAN.md"]);
  expect(made.files["PLAN.md"]).toContain("A coding harness cannot run this as it is.");
  [file] = await Promise.all([page.waitForEvent("download"), plan.getByRole("button", { name: "Its picture (.svg)" }).tap()]);
  expect(file.suggestedFilename()).toBe("review-loop.svg");
  expect(await downloadText(file)).toBe(made.files["review-loop.svg"]);
  [file] = await Promise.all([page.waitForEvent("download"), plan.getByRole("button", { name: "Download graph (.grooph.json)" }).tap()]);
  expect(file.suggestedFilename()).toBe("review-loop.grooph.json");
  expect(await downloadText(file)).toBe(made.files["review-loop.grooph.json"]);
  // And together: one zip with the three, at the names the plan gives them.
  [file] = await Promise.all([page.waitForEvent("download"), plan.getByRole("button", { name: "The plan, all three (.zip)" }).tap()]);
  expect(file.suggestedFilename()).toBe("review-loop-plan.zip");
  const zipped = unzipSync(await downloadBytes(file));
  expect(Object.fromEntries(Object.entries(zipped).map(([path, bytes]) => [path, strFromU8(bytes)]))).toEqual(made.files);

  // The page and the pictures are beside it, as they were.
  await expect(s.getByRole("group", { name: "Keep a copy" }).getByRole("button", { name: "Offline page (.html)" })).toBeVisible();

  // Under it, a package for a harness: what it still needs, plainly, and the graph's own error as an error.
  const pack = s.getByRole("group", { name: "A package for a harness" });
  await expect(pack.getByRole("listitem")).toHaveText([
    "A harness grooph has a compiler for: Claude Code or Codex. This graph names none, which is right for a plan.",
    "A goal: the lead's brief is built from it.",
    "A graph with no errors: this one has 1.",
  ]);
  await expect(pack.getByRole("alert")).toContainText("Cannot export for a harness: fix these first.");
  await expect(pack.getByRole("alert")).toContainText("1 validation error — E_CYCLE_NO_STOP");
  await expect(s.getByRole("button", { name: "Download package (.zip)" })).toHaveCount(0);
  if (shots) {
    // And what a package still needs, under it.
    await pack.getByRole("heading").evaluate((heading) => heading.scrollIntoView({ block: "start" }));
    await page.waitForTimeout(300);
    await page.screenshot({ path: join(shots, "export-panel-what-a-package-needs.jpg"), type: "jpeg", quality: 60 });
  }
});

test("a plan with nothing wrong shows no error anywhere: the list is clear, and a package's needs are not in red", async ({ page }) => {
  const doc = reviewLoop();
  delete doc.target;
  delete doc.goal;
  await importDocument(page, "review-loop.grooph.json", canonicalize(doc));
  await expect(status(page)).toHaveText("1 warning");
  await status(page).tap();
  const s = sheet(page);
  await expect(s.locator(".issue-code")).toHaveText(["W_HOMOGENEOUS_CRITICS"]);
  await expect(s.locator(".issue-summary")).toContainText("0 errors, 1 warning.");
  await expect(s.getByRole("group", { name: "For a package" }).getByRole("listitem")).toHaveCount(2);
  await closeSheet(page);
  await page.getByRole("button", { name: "Export", exact: true }).tap();
  // The plan says, in a line that is no alert, that its own file lists what a harness would need first.
  await expect(s.getByRole("group", { name: "The plan" })).toContainText("PLAN.md lists 2 things to fix before a harness can run this. They do not stop the plan.");
  const pack = s.getByRole("group", { name: "A package for a harness" });
  await expect(pack.getByRole("listitem")).toHaveCount(2);
  await expect(s.getByRole("alert")).toHaveCount(0);
  await expect(s.locator(".refusal")).toHaveCount(0);
  // The plan's own words say a harness could not run it yet, and that as a plan it is whole.
  const [file] = await Promise.all([page.waitForEvent("download"), s.getByRole("button", { name: "Plan (PLAN.md)" }).tap()]);
  expect(await downloadText(file)).toBe(planBundle(doc).files["PLAN.md"]);
  expect(await downloadText(file)).toContain("As a plan for people to read and follow it is whole.");
});

test("a harness grooph has no compiler for is said plainly where it is typed and where a package is asked for, and the plan still exports", async ({ page }) => {
  const s = sheet(page);
  const field = (label: string) => s.getByLabel(label, { exact: true });
  await page.goto("./");
  await page.getByRole("button", { name: "New graph" }).tap();
  await field("Name").fill("A plan of mine");
  await field("Goal").fill("Write the report.");
  await expect(field("Target harness").locator("option")).toHaveText(["None: this is a plan", "Claude Code", "Codex", "other…"]);
  await expect(s).toContainText("A plan needs no harness.");
  await field("Target harness").selectOption({ label: "other…" });
  await field("Harness id").fill("my-harness");
  await expect(s).toContainText('grooph has no compiler for "my-harness". The plan can still be kept; a package needs Claude Code or Codex.');
  // Not an error of the graph: the count does not move, and nothing in the sheet is an alert.
  await expect(status(page)).toHaveText("Valid");
  await expect(s.getByRole("alert")).toHaveCount(0);

  await page.getByRole("button", { name: "Export", exact: true }).tap();
  await expect(s.getByRole("group", { name: "The plan" }).getByRole("button", { name: "The plan, all three (.zip)" })).toBeVisible();
  const pack = s.getByRole("group", { name: "A package for a harness" });
  await expect(pack.getByRole("listitem")).toHaveText(['grooph has no compiler for "my-harness". It has one for Claude Code or Codex.']);
  await expect(s.getByRole("alert")).toHaveCount(0);
  await expect(s.locator(".refusal")).toHaveCount(0);
  // Said once in the panel: the sentence is nowhere else in it.
  await expect(s.getByText(/no compiler for "my-harness"/)).toHaveCount(1);

  // A harness grooph compiles for: the package is offered, under the same plan.
  await pack.getByRole("button", { name: "Open the graph's details" }).tap();
  await field("Target harness").selectOption("codex");
  await page.getByRole("button", { name: "Export", exact: true }).tap();
  await expect(s.getByRole("group", { name: "A package for a harness" }).getByRole("button", { name: "Download package (.zip)" })).toBeVisible();
  await expect(s.getByRole("group", { name: "The plan" }).getByRole("button", { name: "Plan (PLAN.md)" })).toBeVisible();
});

test("the Export panel is fetched when it is asked for: refused, the sheet says so, and Try again opens it", async ({ page }) => {
  let refuse = true;
  const asked: string[] = [];
  await page.route("**/assets/ExportPanel-*.js*", (route) => {
    asked.push(route.request().url());
    return refuse ? route.abort() : route.continue();
  });
  await importDocument(page, "review-loop.grooph.json", readFileSync(join(import.meta.dirname, "../../../fixtures/valid/review-loop.grooph.json"), "utf8"));
  await page.getByRole("button", { name: "Export", exact: true }).tap();
  const s = sheet(page);
  await expect(s.getByRole("alert")).toHaveText("The Export panel could not be fetched. It needs a connection the first time. Nothing of the graph is lost.Try again");
  expect(asked.length).toBeGreaterThan(0);
  await expect(s.getByRole("group", { name: "The plan" })).toHaveCount(0);
  refuse = false;
  await s.getByRole("button", { name: "Try again" }).tap();
  await expect(s.getByRole("group", { name: "The plan" })).toBeVisible();
  await expect(s.getByRole("group", { name: "A package for a harness" }).getByRole("button", { name: "Download package (.zip)" })).toBeVisible();
  await expect(s.getByRole("alert")).toHaveCount(0);
});
