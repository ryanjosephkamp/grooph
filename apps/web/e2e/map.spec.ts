import { readFileSync } from "node:fs";
import { join } from "node:path";
import { deflateRawSync } from "node:zlib";

import { buildShareEnvelope, encodeSharePayload, parseMapText, type OperationMap } from "@grooph/core";
import { expect, test } from "@playwright/test";

import { repoRoot } from "./support.js";

/**
 * Operation maps (docs/operation-map.md; amendment A-011) in the app: a map
 * opens from a link or a file as its picture, read-only; a session and a
 * handoff open what the document says about them; the map's own rules are
 * behind the status. Nothing is stored and nothing can be exported or run.
 */
const mapsDir = join(repoRoot, "fixtures/maps");
const mapText = (path: string): string => readFileSync(join(mapsDir, path), "utf8");
const mapOf = (path: string): OperationMap => parseMapText(mapText(path)).map!;
const linkFor = (map: OperationMap): string => `./#/open?d=${encodeSharePayload(buildShareEnvelope(map), (bytes) => deflateRawSync(bytes, { level: 9 }))}`;
const SAMPLE = "valid/owner-operation-2026-09-30.grooph-map.json";
const sheet = (page: import("@playwright/test").Page) => page.locator("aside.sheet");

test("the sample map opens from a link as its picture: every session and handoff, readable on a phone without zooming", async ({ page }) => {
  const map = mapOf(SAMPLE);
  await page.goto(linkFor(map));
  await expect(page.locator(".title-name")).toHaveText("Ryan's operation, September 30, 2026");
  await expect(page.locator(".title-sub")).toContainText("operation map · read-only · as of 2026-09-30");
  await expect(page.getByRole("button", { name: "Validation: Valid" })).toBeVisible();

  const picture = page.locator(".map-picture svg");
  await expect(picture).toBeVisible();
  for (const s of map.sessions) await expect(page.locator(`[data-session="${s.id}"]`)).toHaveCount(1);
  for (const h of map.handoffs) await expect(page.locator(`[data-handoff-row="${h.id}"]`)).toHaveCount(1);

  // Laid out for a phone: the picture is as wide as the screen and its smallest words are about 10 px.
  const box = (await picture.boundingBox())!;
  expect(box.width).toBeGreaterThan(380);
  expect(box.width).toBeLessThanOrEqual(400);
  const smallest = await picture.evaluate((svg) => {
    const scale = svg.getBoundingClientRect().width / (svg as SVGSVGElement).viewBox.baseVal.width;
    return Math.min(...[...svg.querySelectorAll("text")].map((t) => Number(t.getAttribute("font-size")) * scale));
  });
  expect(smallest).toBeGreaterThanOrEqual(8.4);
  // Nothing scrolls sideways.
  expect(await page.locator(".map-stage").evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
});

test("a session and a handoff open what the map says about them, and lead to each other", async ({ page }) => {
  await page.goto(linkFor(mapOf(SAMPLE)));
  await page.locator('[data-session="operator"]').tap();
  await expect(sheet(page).getByRole("heading", { name: "Session" })).toBeVisible();
  await expect(sheet(page)).toContainText("Claude Code");
  await expect(sheet(page)).toContainText("Cloud, Claude account B (Claude Code cloud sandboxes, Claude account B)");
  await expect(page.locator('[data-session="operator"]')).toHaveClass(/is-on/);
  await expect(sheet(page).getByRole("list").first().getByRole("listitem")).toHaveCount(4); // what the Operator hands out

  await sheet(page).getByRole("button", { name: /Operator → grooph session/ }).tap();
  await expect(sheet(page).getByRole("heading", { name: "Handoff 7" })).toBeVisible();
  await expect(sheet(page)).toContainText("carried by Ryan");
  await expect(sheet(page)).toContainText("the brief for this round, pasted into a fresh session");
  await expect(page.locator('[data-handoff-row="h-brief-grooph"]')).toHaveClass(/is-on/);

  await sheet(page).getByRole("button", { name: "grooph session" }).tap();
  await expect(sheet(page)).toContainText("Opus 5.5");

  // The family says how many it stands for.
  await page.getByRole("button", { name: "Close panel" }).tap();
  await page.locator('[data-session="workers"]').tap();
  await expect(sheet(page)).toContainText("12 like sessions, drawn as one");

  // The title opens the map's own facts and the pictures to keep.
  await page.locator(".title-btn").tap();
  await expect(sheet(page)).toContainText("3 lanes · 7 sessions (18 counting families) · 10 handoffs, 2 carried by a person");
  const keep = sheet(page).getByRole("group", { name: "Keep a copy" });
  await keep.getByRole("radio", { name: "Dark" }).tap();
  const [file] = await Promise.all([page.waitForEvent("download"), keep.getByRole("button", { name: "Picture (SVG)" }).tap()]);
  expect(file.suggestedFilename()).toBe("ryans-operation-2026-09-30.dark.svg");
  const svg = readFileSync((await file.path())!, "utf8");
  expect(svg).toBe(readFileSync(join(mapsDir, "pictures/ryans-operation-2026-09-30.dark.svg"), "utf8"));

  // A map has an offline page too: the picture, every session and handoff in words, and the map itself.
  const [page2] = await Promise.all([page.waitForEvent("download"), keep.getByRole("button", { name: "Offline page (.html)" }).tap()]);
  expect(page2.suggestedFilename()).toBe("ryans-operation-2026-09-30.html");
  const html = readFileSync((await page2.path())!, "utf8");
  expect(html).toContain('data-picture="map"');
  expect(html).toContain('id="s-operator"');
});

test("a handoff with no carrier is drawn, listed as such, and named by the validator", async ({ page }) => {
  await page.goto(linkFor(mapOf("invalid/E_HANDOFF_NO_CARRIER/no-carrier.grooph-map.json")));
  await expect(page.locator('[data-handoff-row="h-plan"]')).toContainText("no carrier named");
  const status = page.getByRole("button", { name: "Validation: 1 error" });
  await status.tap();
  await expect(sheet(page)).toContainText("E_HANDOFF_NO_CARRIER");
  await expect(sheet(page)).toContainText('handoff "h-plan" ("planner" → "builder") names no carrier');
});

test("a map file imports from the library into the same view, and stores nothing", async ({ page }) => {
  await page.goto("./");
  await page.locator('input[type="file"]').setInputFiles({ name: "ops.grooph-map.json", mimeType: "application/json", buffer: Buffer.from(mapText(SAMPLE)) });
  await expect(page.locator(".title-sub")).toContainText("operation map");
  await expect(page.locator('[data-session="codex"]')).toHaveCount(1);
  await page.getByRole("link", { name: "All graphs" }).tap();
  await expect(page.getByRole("list", { name: "Graphs on this device" })).toHaveCount(0);

  // A map that is not one says why.
  await page.locator('input[type="file"]').setInputFiles({
    name: "broken.grooph-map.json",
    mimeType: "application/json",
    buffer: Buffer.from(mapText("invalid/E_SCHEMA/session-without-harness.grooph-map.json")),
  });
  await expect(page.getByRole("alert")).toContainText("It is an operation map grooph cannot read.");
  await expect(page.getByRole("alert")).toContainText("E_SCHEMA");
});

test("on a wide screen the picture keeps its phone width and the details sit beside it", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto(linkFor(mapOf(SAMPLE)));
  await page.locator('[data-session="grooph"]').click();
  const picture = (await page.locator(".map-picture svg").boundingBox())!;
  expect(picture.width).toBeLessThanOrEqual(560);
  const panel = (await sheet(page).boundingBox())!;
  expect(panel.x).toBeGreaterThan(picture.x + picture.width - 1);
});

test("the map says what a person carries by hand, and a session's graph link opens that graph in the app", async ({ page }) => {
  const sample = mapOf(SAMPLE);
  const graph = JSON.parse(readFileSync(join(repoRoot, "fixtures/valid/review-loop.grooph.json"), "utf8")) as Parameters<typeof buildShareEnvelope>[0];
  await page.goto("./");
  const base = page.url().split("#")[0]!;
  const graphLink = `${base}#/open?d=${encodeSharePayload(buildShareEnvelope(graph), (bytes) => deflateRawSync(bytes, { level: 9 }))}`;
  const map: OperationMap = { ...sample, sessions: sample.sessions.map((s) => (s.id === "grooph" ? { ...s, graph: graphLink } : s)) };
  await page.goto(linkFor(map));

  await page.locator(".title-btn").tap();
  const byHand = page.getByTestId("map-by-hand").getByRole("listitem");
  await expect(byHand).toHaveCount(2);
  await expect(byHand.first()).toHaveText("operator → grooph: moves only when Ryan carries it");

  await page.locator('[data-session="grooph"]').tap();
  await page.getByTestId("map-graph-link").tap();
  await expect(page.locator(".title-name")).toHaveText("Review loop");
});

test("a person on the map opens what the map says about them, and a session that wakes itself says how (amendment A-013)", async ({ page }) => {
  const map = mapOf("valid/a-person-and-two-sessions.grooph-map.json");
  await page.goto(linkFor(map));
  await expect(page.locator(".title-sub")).toContainText("operation map · read-only");
  await expect(page.getByRole("button", { name: "Validation: Valid" })).toBeVisible();

  await page.locator('[data-person="owner"]').tap();
  await expect(sheet(page).getByRole("heading", { name: "Person" })).toBeVisible();
  await expect(sheet(page)).toContainText("Asks for the work and reads the result");
  await expect(sheet(page)).toContainText("A person is not a session");
  await expect(page.locator('[data-person="owner"]')).toHaveClass(/is-on/);
  // What starts with the person, and what reaches them: a notification.
  await expect(sheet(page).getByRole("button", { name: /The owner → Lead/ })).toBeVisible();
  await sheet(page).getByRole("button", { name: /Lead → The owner/ }).tap();
  await expect(sheet(page).getByRole("heading", { name: "Handoff 5" })).toBeVisible();
  await expect(sheet(page)).toContainText("notification, e-mail");
  // From a handoff, the person's name leads back to the person, and a session's to the session.
  await sheet(page).getByRole("button", { name: "The owner", exact: true }).tap();
  await expect(sheet(page).getByRole("heading", { name: "Person" })).toBeVisible();

  await page.locator('[data-session="lead"]').tap();
  await expect(sheet(page).getByRole("heading", { name: "Session" })).toBeVisible();
  await expect(sheet(page)).toContainText("Wakes itself");
  await expect(sheet(page)).toContainText("every hour");

  // The map's own summary names what waits on the person.
  await page.locator(".title-btn").tap();
  await expect(page.getByTestId("map-by-hand").getByRole("listitem")).toHaveText(["owner → lead: moves only when The owner does it"]);
});

test("a handoff's number and its ring open the handoff, as its line does", async ({ page }) => {
  const map = mapOf(SAMPLE);
  await page.goto(linkFor(map));
  const first = map.handoffs[0]!.id;
  // The number is drawn over the lines and the ring under them: each is the handoff.
  await page.locator(`[data-number="${first}"]`).tap();
  await expect(sheet(page).getByRole("heading", { name: "Handoff 1" })).toBeVisible();
  await page.locator(`[data-number="${first}"]`).tap();
  await expect(sheet(page)).toHaveCount(0);
  await page.locator(`[data-plate="${map.handoffs[1]!.id}"]`).tap({ position: { x: 1, y: 7 } });
  await expect(sheet(page).getByRole("heading", { name: "Handoff 2" })).toBeVisible();
});
