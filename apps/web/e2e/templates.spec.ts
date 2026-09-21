import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { expect, test } from "@playwright/test";

import { canonicalize, extractTemplate, parseGraphText } from "@grooph/core";

import { closeSheet, downloadText, fixturePath, importDocument, node, repoRoot, sheet, status, toolbar } from "./support.js";

/**
 * Handoff 0007, criteria 2–5: the template library in the app, Use, Insert
 * and Save as template, by touch at phone size.
 */

const patternCount = readdirSync(join(repoRoot, "patterns")).filter((f) => f.endsWith(".grooph.json")).length;

test("the Templates screen lists the bundled patterns; one opens read-only with its slots", async ({ page }) => {
  // No network beyond the app itself: every template comes with the bundle.
  const requests: string[] = [];
  page.on("request", (r) => requests.push(r.url()));

  await page.goto("./");
  await page.getByRole("link", { name: "Templates" }).tap();
  await expect(page.getByRole("heading", { name: "Templates", level: 1 })).toBeVisible();

  const builtIn = page.getByRole("list", { name: "Built-in templates" }).locator(":scope > li");
  await expect(builtIn).toHaveCount(patternCount);
  const grind = page.locator('.template-row[data-template="grind-loop"]');
  await expect(grind).toContainText("Grind loop");
  await expect(grind).toContainText("Use when Done and good are the same");
  // A row is built to scan (slice 0015): the glyph, the title, when to use it, and the profile as meters with the words in their names.
  await expect(grind.locator(".template-glyph svg")).toBeVisible();
  await expect(grind.getByRole("list", { name: "Profile" }).getByRole("listitem")).toHaveCount(3);
  for (const [i, name] of ["Low cost", "Fast", "Light rigor"].entries()) {
    await expect(grind.getByRole("list", { name: "Profile" }).getByRole("listitem").nth(i)).toHaveAttribute("aria-label", name);
  }
  await expect(page.locator('.template-row[data-template="human-gated-irreversible"]')).toContainText("fragment");

  await grind.tap();
  await expect(page.locator(".title-sub")).toHaveText("built-in template · read-only");
  await expect(node(page, "builder")).toBeVisible();
  const about = sheet(page);
  await expect(about.getByRole("heading", { name: "Grind loop" })).toBeVisible();
  const slots = about.getByRole("list", { name: "Slots" }).getByRole("listitem");
  await expect(slots).toHaveCount(2);
  await expect(slots.first()).toContainText("What should be built or changed?");
  await expect(slots.first()).toContainText("{{task}}");
  await expect(slots.first()).toContainText("e.g. Add a slugify(text) function");
  // Read-only: nothing to type into, no editing toolbar, no export.
  await expect(about.locator("input, textarea, select")).toHaveCount(0);
  await expect(toolbar(page)).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Export", exact: true })).toHaveCount(0);
  // A pattern that owes no credit shows none (decision 0010).
  await expect(about.getByRole("list", { name: "Credits" })).toHaveCount(0);

  const origin = new URL(page.url()).origin;
  expect(requests.filter((url) => !url.startsWith(origin))).toEqual([]);
});

test("a credited template shows whose work it is inspired by, with the link (decision 0010)", async ({ page }) => {
  await page.goto("./#/templates/built-in/taste-polish");
  const about = sheet(page);
  await expect(about.getByRole("heading", { name: "Taste polish" })).toBeVisible();
  const credits = about.getByRole("list", { name: "Credits" }).getByRole("listitem");
  await expect(credits).toHaveCount(1);
  await expect(credits.first()).toHaveText(
    "Inspired by Matt Shumer's Gauntlet Loop (Claude of Duty): the bounded form of the Gauntlet: one owner, an isolated critic against a named reference, real stops",
  );
  await expect(credits.first().getByRole("link", { name: "Matt Shumer's Gauntlet Loop (Claude of Duty)" })).toHaveAttribute("href", "https://github.com/mshumer/Claude-of-Duty");
});

test("Use asks for a name and each slot, allows gaps, and opens the graph with E_UNFILLED_SLOT to find", async ({ page }) => {
  await page.goto("./#/templates/built-in/grind-loop");
  await sheet(page).getByRole("link", { name: "Use this template" }).tap();
  await expect(page.getByRole("heading", { name: "Grind loop", level: 1 })).toBeVisible();

  // The slot's ask is the label; its example is the placeholder.
  const task = page.getByLabel("What should be built or changed? One or two sentences a builder can act on.");
  await expect(task).toHaveAttribute("placeholder", /^Add a slugify\(text\) function/);
  await expect(page.getByLabel("Which command runs the tests?")).toHaveAttribute("placeholder", "pnpm test");

  await page.getByLabel("Graph name").fill("Slugify");
  await task.fill("Add slugify(text) to src/strings.ts.");
  await expect(page.getByRole("status")).toHaveText("1 slot left empty, to fill in the editor.");
  await page.getByRole("button", { name: "Create graph" }).tap();

  // The editor, on the new graph.
  await expect(page.locator(".title-name")).toHaveText("Slugify");
  await expect(status(page)).toHaveText("1 error");
  await status(page).tap();
  const issue = sheet(page).locator(".issue", { hasText: "E_UNFILLED_SLOT" });
  await expect(issue).toContainText("{{test-command}}");
  await issue.tap();
  await expect(node(page, "tests").locator(".gnode")).toHaveClass(/is-highlighted/);
  await expect(page.locator(".title-btn")).toHaveClass(/is-highlighted/);

  // It came from the template, and says so.
  await page.locator(".title-btn").tap();
  await expect(sheet(page)).toContainText("grind-loop@1");

  // Filling the slot clears the error.
  await sheet(page).getByLabel("Goal").fill("Add slugify(text) to src/strings.ts. Done when `pnpm test` passes.");
  await closeSheet(page);
  await node(page, "tests").tap();
  await sheet(page).getByLabel("Run", { exact: true }).fill("pnpm test");
  await expect(status(page)).toHaveText("Valid");
});

test("Use says so when the device will not save the graph, and the form stays usable", async ({ page }) => {
  await page.goto("./#/templates/built-in/grind-loop/use");
  await page.getByLabel("Graph name").fill("Slugify");
  await page.evaluate(() => {
    IDBObjectStore.prototype.put = () => {
      throw new DOMException("The quota has been exceeded.", "QuotaExceededError");
    };
  });
  await page.getByRole("button", { name: "Create graph" }).tap();
  await expect(page.getByText("Could not create the graph: The quota has been exceeded.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Create graph" })).toBeEnabled();
});

test("Ctrl+Z in the Insert form is the field's own, not the document's", async ({ page }) => {
  await importDocument(page, "review-loop.grooph.json", readFileSync(fixturePath, "utf8"));
  await page.locator(".title-btn").tap();
  await sheet(page).getByLabel("Name", { exact: true }).fill("Renamed");
  await closeSheet(page);
  await toolbar(page).getByRole("button", { name: "Add" }).tap();
  await sheet(page).getByRole("button", { name: /^Insert a template/ }).tap();
  await sheet(page).getByRole("button", { name: /^Human-gated irreversible step/ }).tap();
  const step = sheet(page).getByLabel("What is the irreversible step, in one sentence?");
  await step.pressSequentially("Merge", { delay: 20 });
  await page.keyboard.press("Control+z");
  await page.keyboard.press("Meta+z");
  await expect(page.locator(".title-name")).toHaveText("Renamed");
});

test("Insert a fragment: the id map is shown once, and the new nodes are selected and in view", async ({ page }) => {
  await importDocument(page, "review-loop.grooph.json", readFileSync(fixturePath, "utf8"));
  await toolbar(page).getByRole("button", { name: "Add" }).tap();
  await sheet(page).getByRole("button", { name: /^Insert a template/ }).tap();
  await expect(sheet(page).getByRole("heading", { name: "Insert a template" })).toBeVisible();
  await sheet(page).getByRole("button", { name: /^Human-gated irreversible step/ }).tap();
  await sheet(page).getByLabel("What is the irreversible step, in one sentence?").fill("Merge the release branch into main.");
  await sheet(page).getByLabel(/Which kind of irreversible action/).fill("merge");
  await sheet(page).getByRole("button", { name: "Insert fragment" }).tap();

  const map = sheet(page).getByRole("list", { name: "Id map" });
  await expect(map).toContainText("gate → gate");
  await expect(map.locator(".is-renamed")).toContainText(["done → done-2"]);
  for (const id of ["gate", "act", "done-2"]) {
    await expect(node(page, id).locator(".gnode")).toHaveClass(/is-highlighted/);
    await expect(node(page, id)).toBeInViewport();
  }
  await expect(node(page, "builder").locator(".gnode")).not.toHaveClass(/is-highlighted/);

  // Shown once: Done closes it, and the next insert starts from the list.
  await sheet(page).getByRole("button", { name: "Done" }).tap();
  await expect(sheet(page)).toHaveCount(0);
  await toolbar(page).getByRole("button", { name: "Add" }).tap();
  await sheet(page).getByRole("button", { name: /^Insert a template/ }).tap();
  await expect(sheet(page).getByRole("list", { name: "Id map" })).toHaveCount(0);

  // A whole-graph template goes in as a subgraph.
  await sheet(page).getByRole("button", { name: /^Grind loop/ }).tap();
  await sheet(page).getByRole("button", { name: "Insert as a subgraph" }).tap();
  await expect(sheet(page).getByRole("list", { name: "Id map" })).toContainText("builder → builder-2");
  await expect(node(page, "builder-2")).toBeVisible();
  await expect(node(page, "tests")).toBeVisible();

  // One undo takes the whole insert back.
  await sheet(page).getByRole("button", { name: "Done" }).tap();
  await toolbar(page).getByRole("button", { name: "Undo" }).tap();
  await expect(node(page, "builder-2")).toHaveCount(0);
  await expect(node(page, "act")).toBeVisible();
});

test("Save as template: whole graph and selected nodes, into Yours; download, import, delete", async ({ page }) => {
  await importDocument(page, "review-loop.grooph.json", readFileSync(fixturePath, "utf8"));

  // Whole graph, from the Graph panel.
  await page.locator(".title-btn").tap();
  await sheet(page).getByRole("button", { name: "Save as template…" }).tap();
  const s = sheet(page);
  await expect(s.getByRole("heading", { name: "Save as template" })).toBeVisible();
  await expect(s.getByRole("radio", { name: "Whole graph" })).toHaveAttribute("aria-checked", "true");
  await expect(s.getByLabel("Template id")).toHaveValue("review-loop");
  // The estimate is shown for correction.
  await expect(s.getByText("Estimated from the graph. Correct it if it reads wrong.")).toBeVisible();
  await expect(s.getByRole("radiogroup", { name: "Rigor" }).getByRole("radio", { name: "standard" })).toHaveAttribute("aria-checked", "true");
  await expect(s.getByRole("button", { name: "Save to Yours" })).toBeDisabled();
  await s.getByLabel("Template id").fill("my-review");
  await s.getByLabel("Title").fill("My review loop");
  await s.getByLabel("Summary").fill("Builder, critic, then a human merges.");
  await s.getByLabel("When to use").fill("A change a person must approve before it merges.");
  await s.getByRole("radiogroup", { name: "Cost" }).getByRole("radio", { name: "high" }).tap();
  await expect(s.getByText("Corrected by you.")).toBeVisible();
  await s.getByRole("button", { name: "Save to Yours" }).tap();
  await expect(s).toContainText("Saved My review loop in Yours as my-review, version 1.");

  const downloading = page.waitForEvent("download");
  await s.getByRole("button", { name: "Download template (.grooph.json)" }).tap();
  const file = await downloading;
  expect(file.suggestedFilename()).toBe("my-review.grooph.json");
  const text = await downloadText(file);
  const saved = parseGraphText(text).doc!;
  expect(saved.template).toMatchObject({ kind: "graph", title: "My review loop", profile: { cost: "high", rigor: "standard" } });
  expect(saved.notes).toBeUndefined();

  // Selected nodes, as a fragment: the node last tapped comes preselected.
  await closeSheet(page);
  await node(page, "critic").tap();
  await page.locator(".title-btn").tap();
  await sheet(page).getByRole("button", { name: "Save as template…" }).tap();
  await expect(s.getByRole("radio", { name: "Selected nodes" })).toHaveAttribute("aria-checked", "true");
  const chips = s.getByRole("group", { name: /^Nodes/ });
  await expect(chips.getByRole("button", { name: "Critic" })).toHaveAttribute("aria-pressed", "true");
  await chips.getByRole("button", { name: "Builder" }).tap();
  // Builder and critic alone leave their loop behind: refused, as grooph template save refuses it, with its hint.
  const refusal = s.locator(".refusal");
  await expect(refusal).toContainText("Not saved: the template would carry these errors.");
  await expect(refusal).toContainText("E_CYCLE_NO_STOP");
  await expect(refusal).toContainText('loop "review-cycle" stayed behind: a loop comes along only with all its members; add merge-gate (Merge approval) to the selected nodes');
  await expect(s.getByRole("button", { name: "Save to Yours" })).toBeDisabled();
  // Bringing the gate along brings the loop, and the refusal goes.
  await chips.getByRole("button", { name: "Merge approval" }).tap();
  await expect(refusal).toHaveCount(0);
  await s.getByLabel("Template id").fill("build-and-review");
  await s.getByLabel("Title").fill("Build and review");
  await s.getByLabel("Summary").fill("A builder and its critic.");
  await s.getByLabel("When to use").fill("Any change worth a second reader.");
  await s.getByRole("button", { name: "Save to Yours" }).tap();
  await s.getByRole("link", { name: "Open in Templates" }).tap();
  await expect(page.locator(".title-sub")).toHaveText("your fragment · read-only");
  await expect(node(page, "builder")).toBeVisible();
  await expect(node(page, "merge-gate")).toBeVisible();
  await expect(node(page, "done")).toHaveCount(0);

  // Both are under "Yours".
  await page.getByRole("link", { name: "All templates" }).tap();
  const yours = page.getByRole("list", { name: "Your templates" }).locator(":scope > li");
  await expect(yours).toHaveCount(2);
  await expect(yours.filter({ hasText: "Build and review" })).toContainText("fragment");

  // Delete one.
  await page.locator('.template-row[data-template="my-review"]').tap();
  await sheet(page).getByRole("button", { name: "Delete template" }).tap();
  await sheet(page).getByRole("button", { name: "Delete for good" }).tap();
  await expect(page.getByRole("heading", { name: "Templates", level: 1 })).toBeVisible();
  await expect(yours).toHaveCount(1);

  // Importing the downloaded file offers it to Yours.
  await page.goto("./");
  await page.locator('input[type="file"]').setInputFiles({ name: "my-review.grooph.json", mimeType: "application/json", buffer: Buffer.from(text) });
  const offer = page.locator(".offer");
  await expect(offer).toContainText("my-review.grooph.json is a template: My review loop");
  await offer.getByRole("button", { name: "Add to Yours" }).tap();
  await expect(page.locator(".title-sub")).toHaveText("your template · read-only");
  await expect(sheet(page).getByRole("heading", { name: "My review loop" })).toBeVisible();

  // Again: it is there already, so the offer is to replace it, as a new version.
  await page.goto("./");
  await page.locator('input[type="file"]').setInputFiles({ name: "my-review.grooph.json", mimeType: "application/json", buffer: Buffer.from(text) });
  await offer.getByRole("button", { name: "Add to Yours" }).tap();
  await expect(offer).toContainText("Replacing it makes version 2");
  await offer.getByRole("button", { name: "Replace yours" }).tap();
  await expect(sheet(page)).toContainText("my-review@2");
});

test("importing a template that carries errors does not offer it to Yours", async ({ page }) => {
  // Fix pass 1 of slice 0007, criterion 1: the file grooph template add would refuse.
  const broken = extractTemplate(parseGraphText(readFileSync(fixturePath, "utf8")).doc!, {
    kind: "fragment",
    nodeIds: ["builder", "critic"],
    meta: { id: "build-and-review", title: "Build and review", summary: "A builder and its critic.", whenToUse: "Any change worth a second reader." },
  });
  await page.goto("./");
  await page.locator('input[type="file"]').setInputFiles({ name: "build-and-review.grooph.json", mimeType: "application/json", buffer: Buffer.from(canonicalize(broken)) });
  const offer = page.locator(".offer");
  await expect(offer).toContainText("build-and-review.grooph.json is a template: Build and review (a fragment).");
  await expect(offer).toContainText("It carries errors, so it cannot go into Yours");
  await expect(offer.locator(".issue-lines")).toContainText("E_CYCLE_NO_STOP");
  await expect(offer.getByRole("button", { name: "Add to Yours" })).toHaveCount(0);
  await expect(offer.getByRole("button", { name: "Replace yours" })).toHaveCount(0);
  await expect(offer.getByRole("button", { name: "Open it as a graph" })).toBeVisible();

  // Nothing reached Yours.
  await offer.getByRole("button", { name: "Cancel" }).tap();
  await page.getByRole("link", { name: "Templates" }).tap();
  await expect(page.getByRole("list", { name: "Your templates" })).toHaveCount(0);
});
