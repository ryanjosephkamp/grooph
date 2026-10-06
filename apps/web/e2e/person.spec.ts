import { mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { expect, test } from "@playwright/test";

import { closeSheet, fixturePath, importDocument, node, sheet, status, toolbar } from "./support.js";

/**
 * Slice 0100, the app's second part (amendment A-020): a step may be a person's. The inspector's switch, the
 * card that says whose step it is, and the plan templates, listed apart and fetched when they are asked for.
 */

/** Where the picture for the owner goes when it is asked for (`GROOPH_PLAN_PICTURES=<folder>`); CI writes none. */
const shots = process.env["GROOPH_PLAN_PICTURES"];

test("Done by: a person. The card says Person with the role alone, an agent's fields are put away, and Undo brings it all back", async ({ page }) => {
  await importDocument(page, "review-loop.grooph.json", readFileSync(fixturePath, "utf8"));
  const s = sheet(page);
  const card = node(page, "critic");
  await expect(card.locator(".gnode-kind")).toHaveText("Agent");
  await expect(card.locator(".gnode-sub")).toHaveText("critic · strong · high");
  await card.tap();
  const by = s.getByRole("radiogroup", { name: "Done by" });
  await expect(by.getByRole("radio", { name: "an agent" })).toHaveAttribute("aria-checked", "true");
  await expect(s.getByRole("radiogroup", { name: "Model tier" })).toBeVisible();
  await expect(s.getByRole("group", { name: "Allow" })).toBeVisible();

  await by.getByRole("radio", { name: "a person" }).tap();
  await expect(by.getByRole("radio", { name: "a person" })).toHaveAttribute("aria-checked", "true");
  // The card: whose step it is, in the mark a person's decision has, and the role alone.
  await expect(card.locator(".gnode-kind")).toHaveText("Person");
  await expect(card.locator(".kind-mark")).toHaveClass(/kind-human-gate/);
  // The word is in the gate's color, which the builder's card beside it is not.
  const color = (id: string) => node(page, id).locator(".gnode-kind").evaluate((el) => getComputedStyle(el).color);
  expect(await color("critic")).toBe(await color("merge-gate"));
  expect(await color("critic")).not.toBe(await color("builder"));
  await expect(card.locator(".gnode-sub")).toHaveText("critic");
  await expect(card).toHaveAttribute("aria-label", /^Person: Critic/);
  // What only an agent has is put away; what the step is and does stays.
  for (const name of ["Model tier", "Effort"]) await expect(s.getByRole("radiogroup", { name })).toHaveCount(0);
  for (const name of ["Allow", "Deny"]) await expect(s.getByRole("group", { name })).toHaveCount(0);
  await expect(s.getByLabel("Brief")).toBeVisible();
  await expect(s.getByLabel("Outputs")).toBeVisible();
  // The graph named a harness; with a person's step it is a plan, and the bar says so.
  await expect(page.locator("header.topbar")).toContainText("a plan");
  await expect(page.locator("header.topbar")).not.toContainText("claude-code");
  // The sheet calls the step what the card calls it.
  await expect(s.getByRole("heading", { name: "Person" })).toBeVisible();
  await expect(s.getByRole("button", { name: "Delete person" })).toBeVisible();
  await expect(s).toContainText("A person does this step. It has no model, effort or capabilities; a graph with a person's step is a plan, and no package is made of it yet.");
  // No error of the graph: the builder's work is still judged, by a person now.
  await expect(status(page)).not.toHaveText(/error/);
  if (shots) {
    mkdirSync(shots, { recursive: true });
    await by.evaluate((el) => el.parentElement!.scrollIntoView({ block: "start" }));
    await page.screenshot({ path: join(shots, "done-by-a-person.jpg"), type: "jpeg", quality: 70 });
    await closeSheet(page);
    await page.getByRole("button", { name: "Got it" }).tap();
    await page.waitForTimeout(500);
    await page.screenshot({ path: join(shots, "a-persons-card.jpg"), type: "jpeg", quality: 70 });
    await card.tap();
  }

  // What a package would need says so, in words, where the needs are said.
  await closeSheet(page);
  await status(page).tap();
  await expect(s.getByRole("group", { name: "For a package" })).toContainText("Every step an agent's: Critic is a person's, and grooph cannot yet hand a step to a person inside a harness.");
  await expect(s.locator(".issue-code")).not.toContainText(["E_PERSON_STEP_NOT_COMPILED"]);
  await closeSheet(page);

  // One edit, so one Undo: the step is an agent's again, on its tier and at its effort, with its capabilities.
  await toolbar(page).getByRole("button", { name: "Undo" }).tap();
  await expect(card.locator(".gnode-kind")).toHaveText("Agent");
  await expect(page.locator("header.topbar")).toContainText("claude-code");
  await expect(card.locator(".gnode-sub")).toHaveText("critic · strong · high");
  await card.tap();
  await expect(s.getByRole("radiogroup", { name: "Done by" }).getByRole("radio", { name: "an agent" })).toHaveAttribute("aria-checked", "true");
  await expect(s.getByRole("group", { name: "Allow" })).toBeVisible();
});

test("the plans are listed apart, under their own heading, fetched when they are asked for; one opens as a plan and becomes a graph of people's steps", async ({ page }) => {
  const asked: string[] = [];
  await page.route("**/assets/plan-templates-*.js*", (route) => {
    asked.push(route.request().url());
    return route.continue();
  });
  await page.goto("./#/templates");
  await expect(page.getByRole("heading", { name: "Built-in" })).toBeVisible();
  const plans = page.getByRole("region", { name: "Plans" });
  await expect(plans.getByRole("heading", { name: "Plans" })).toBeVisible();
  await expect(plans).toContainText("A plan: a graph a person follows. It has no recorded run, and no package for a harness is made of a graph with a person's step.");
  // Not one of the twenty, and not fetched until asked for.
  await expect(page.getByRole("list", { name: "Built-in templates" }).locator("a.template-row")).toHaveCount(20);
  await expect(page.getByRole("list", { name: "Plan templates" })).toHaveCount(0);
  expect(asked).toEqual([]);

  await plans.getByRole("button", { name: "Show the plans" }).tap();
  const rows = page.getByRole("list", { name: "Plan templates" }).locator("a.template-row");
  await expect(rows).toHaveCount(4);
  expect(asked.length).toBe(1);
  await expect(rows.locator(".template-title")).toHaveText([/^Literature review.*plan$/, /^Research study.*plan$/, /^Solo project.*plan$/, /^Team handoffs.*plan$/]);
  // A plan's profile was not measured, so no meters are drawn for it; the twenty keep theirs.
  await expect(page.getByRole("list", { name: "Plan templates" }).locator(".template-meters")).toHaveCount(0);
  await expect(page.getByRole("list", { name: "Built-in templates" }).locator(".template-meters")).toHaveCount(20);
  await expect(page.getByRole("list", { name: "Built-in templates" }).locator("a.template-row")).toHaveCount(20);
  if (shots) {
    mkdirSync(shots, { recursive: true });
    await plans.getByRole("heading", { name: "Plans" }).scrollIntoViewIfNeeded();
    await page.screenshot({ path: join(shots, "the-plans-listed-apart.jpg"), type: "jpeg", quality: 70 });
  }

  // One opens at an address of its own, as a plan, and says what a plan is and is not.
  await rows.filter({ hasText: "Solo project" }).tap();
  await expect(page).toHaveURL(/#\/templates\/plan\/solo-project$/);
  const s = sheet(page);
  await expect(s).toContainText("A plan: a graph a person follows. It has no recorded run");
  await expect(s.getByRole("list", { name: "Profile" })).toHaveCount(0);
  await expect(node(page, "make").locator(".gnode-kind")).toHaveText("Person");
  await expect(node(page, "make").locator(".gnode-sub")).toHaveText("builder");
  // Its step, read: a person's, with none of the rows that are an agent's ("Model: session default" would be false).
  await closeSheet(page);
  await node(page, "make").tap();
  await expect(s.getByRole("heading", { name: "Person" })).toBeVisible();
  await expect(s.locator(".readonly-row", { hasText: "Done by" })).toContainText("a person");
  await expect(s.locator(".readonly-row dt", { hasText: /^(Model|Effort|Allowed|Denied)$/ })).toHaveCount(0);
  await closeSheet(page);
  await page.locator("button.title-btn").tap();
  await s.getByRole("link", { name: "Use this template" }).tap();
  await page.getByLabel("Graph name").fill("My website");
  await page.getByLabel("What are you making? One or two sentences.").fill("A one-page website for my woodworking.");
  await page.getByLabel("Where will it be published? Finish the sentence: it is out at ...").fill("its own web address");
  await page.getByRole("button", { name: "Create graph" }).tap();
  // The graph it makes, its slots filled: people's steps on the canvas, no harness, and no error for either.
  await expect(node(page, "make").locator(".gnode-kind")).toHaveText("Person");
  await expect(node(page, "publish-gate").locator(".gnode-kind")).toHaveText("Human gate");
  await expect(status(page)).not.toHaveText(/error/);
  await expect(page.locator("header.topbar")).toContainText("a plan");
});

test("the plans refused: the list says so and tries again; a plan's own address says so too", async ({ page }) => {
  let refuse = true;
  await page.route("**/assets/plan-templates-*.js*", (route) => (refuse ? route.abort() : route.continue()));
  await page.goto("./#/templates");
  const plans = page.getByRole("region", { name: "Plans" });
  await plans.getByRole("button", { name: "Show the plans" }).tap();
  await expect(plans.getByRole("status")).toContainText("The plans could not be fetched. They need a connection the first time.");
  await expect(page.getByRole("list", { name: "Plan templates" })).toHaveCount(0);
  // The built-in templates are listed all the same.
  await expect(page.getByRole("list", { name: "Built-in templates" }).locator("a.template-row")).toHaveCount(20);

  await page.goto("./#/templates/plan/solo-project");
  await expect(page.locator(".notfound")).toContainText("The plans could not be fetched. They need a connection the first time.");

  refuse = false;
  await page.goto("./#/templates");
  await page.getByRole("region", { name: "Plans" }).getByRole("button", { name: "Show the plans" }).tap();
  await expect(page.getByRole("list", { name: "Plan templates" }).locator("a.template-row")).toHaveCount(4);
});
