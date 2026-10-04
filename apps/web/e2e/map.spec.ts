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

test("on a wide screen the picture is drawn large and the details sit beside it", async ({ page }) => {
  // Handoff 0062: from 1100 px the picture is no longer kept at a phone's width. Between 900 and 1100 px it still is.
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto(linkFor(mapOf(SAMPLE)));
  await page.locator('[data-session="grooph"]').click();
  const picture = (await page.locator(".map-picture svg").boundingBox())!;
  expect(picture.width).toBeGreaterThan(640);
  const panel = (await sheet(page).boundingBox())!;
  expect(panel.x).toBeGreaterThan(picture.x + picture.width - 1);

  // The picture is drawn again at the narrower width, so for a moment the old one is gone: ask until it has settled.
  await page.setViewportSize({ width: 1000, height: 800 });
  await expect.poll(async () => (await page.locator(".map-picture svg").boundingBox())?.width ?? Infinity).toBeLessThanOrEqual(560);
  await expect.poll(async () => (await sheet(page).boundingBox())?.x ?? 0).toBeGreaterThan(560);
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

/* ─── other views (handoff 0080): the lanes side by side, and the sequence ─── */

const LONG = (): OperationMap => parseMapText(readFileSync(join(repoRoot, "handoffs/briefs/plan-2026-10-04/build.grooph-map.json"), "utf8")).map!;
const lanesAcross = (page: import("@playwright/test").Page): Promise<number> =>
  page.locator(".map-picture svg").evaluate((svg) => new Set([...svg.querySelectorAll("[data-lane] > rect:first-child")].map((r) => r.getAttribute("x"))).size);
const sideways = (page: import("@playwright/test").Page, selector: string): Promise<number> => page.locator(selector).evaluate((el) => el.scrollWidth - el.clientWidth);

test("on a phone a switch turns the picture into a sequence, which scrolls sideways inside its own frame", async ({ page }) => {
  const map = LONG();
  await page.goto(linkFor(map));
  // The switch is a pair of radios, named as the app's other switches are; the picture is the phone's, its lanes stacked.
  const views = page.getByRole("radiogroup", { name: "View of the map" });
  await expect(views.getByRole("radio")).toHaveText(["Picture", "Sequence"]);
  await expect(views.getByRole("radio", { name: "Picture" })).toBeChecked();
  await expect(page.locator('.map-picture svg[data-picture="map"]')).toBeVisible();
  expect(await lanesAcross(page)).toBe(1);

  await views.getByRole("radio", { name: "Sequence" }).tap();
  await expect(views.getByRole("radio", { name: "Sequence" })).toBeChecked();
  const sequence = page.locator('.map-picture svg[data-picture="sequence"]');
  await expect(sequence).toBeVisible();
  await expect(page.locator(".map-picture [data-handoff]")).toHaveCount(map.handoffs.length);
  for (const s of map.sessions) await expect(page.locator(`[data-session="${s.id}"]`)).toHaveCount(1);
  await expect(sequence).toContainText("a map records no times.");
  // A unit is a pixel, so its words are a phone's; it is wider than the screen, and only its frame scrolls sideways.
  const box = (await sequence.boundingBox())!;
  expect(box.width).toBeGreaterThan(800);
  expect(await sequence.evaluate((svg) => svg.getBoundingClientRect().width / (svg as SVGSVGElement).viewBox.baseVal.width)).toBeCloseTo(1, 1);
  expect(await sideways(page, ".map-picture")).toBeGreaterThan(400);
  expect(await sideways(page, ".map-stage")).toBe(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBe(0);

  // A row is its handoff: it has a name and the keyboard reaches it; opened, it is marked, and the sheet says what the map does.
  const row = page.locator('[data-handoff="h-pr-3"]');
  await expect(row).toHaveAttribute("role", "button");
  await expect(row).toHaveAttribute("aria-label", "Handoff 11: Lane 3: no-friction toolkit to Driver");
  await row.focus();
  await page.keyboard.press("Enter");
  await expect(sheet(page).getByRole("heading", { name: "Handoff 11" })).toBeVisible();
  await expect(row).toHaveClass(/is-on/);
  // From the handoff, its sender; and a column's head opens that session too.
  await sheet(page).getByRole("button", { name: "Lane 3: no-friction toolkit" }).tap();
  await expect(sheet(page).getByRole("heading", { name: "Session" })).toBeVisible();
  await expect(page.locator('[data-session="toolkit"]')).toHaveClass(/is-on/);
  await page.getByRole("button", { name: "Close panel" }).tap();
  await page.locator('[data-person="ryan"]').tap();
  await expect(sheet(page).getByRole("heading", { name: "Person" })).toBeVisible();

  // Back to the picture: what was picked is still picked, on the picture's own card.
  await views.getByRole("radio", { name: "Picture" }).tap();
  await expect(page.locator('.map-picture svg[data-picture="map"]')).toBeVisible();
  await expect(page.locator('[data-person="ryan"]')).toHaveClass(/is-on/);
  expect(await sideways(page, ".map-picture")).toBe(0);
});

test.describe("from 1100 px", () => {
  test.use({ viewport: { width: 1440, height: 900 }, isMobile: false, hasTouch: false, deviceScaleFactor: 1 });

  test("the lanes are drawn side by side, and a handoff picked in either view is picked in the list beside it", async ({ page }) => {
    const map = LONG();
    await page.goto(linkFor(map));
    const picture = page.locator('.map-picture svg[data-picture="map"]');
    await expect(picture).toBeVisible();
    // Each lane is a column: as many places across as there are lanes, all starting on one line, and nothing scrolls sideways.
    expect(await lanesAcross(page)).toBe(map.lanes.length);
    expect(await picture.evaluate((svg) => new Set([...svg.querySelectorAll("[data-lane] > rect:first-child")].map((r) => r.getAttribute("y"))).size)).toBe(1);
    expect(await sideways(page, ".map-picture")).toBe(0);
    expect(await sideways(page, ".map-stage")).toBe(0);
    // The words are no smaller than on a phone.
    expect(await picture.evaluate((svg) => svg.getBoundingClientRect().width / (svg as SVGSVGElement).viewBox.baseVal.width)).toBeGreaterThanOrEqual(0.99);

    // Picked on the picture: open beside it, and marked in the list under its details.
    const list = page.locator("aside.sheet .map-list");
    await page.locator('[data-number="h-pr-3"]').click();
    await expect(sheet(page).getByRole("heading", { name: "Handoff 11" })).toBeVisible();
    await expect(list.locator('[aria-current="true"]')).toContainText("Lane 3: no-friction toolkit → Driver");
    await expect(page.locator('[data-handoff="h-pr-3"]')).toHaveClass(/is-on/);

    // The sequence shows the same handoff picked, on its row; the others do not step back, as a sequence has no tangle.
    const views = page.getByRole("radiogroup", { name: "View of the map" });
    await views.getByRole("radio", { name: "Sequence" }).click();
    const sequence = page.locator('.map-picture svg[data-picture="sequence"]');
    await expect(sequence).toBeVisible();
    await expect(page.locator('[data-handoff="h-pr-3"]')).toHaveClass(/is-on/);
    await expect(list.locator('[aria-current="true"]')).toContainText("Lane 3: no-friction toolkit → Driver");
    expect(await page.locator('[data-handoff="h-plan"]').evaluate((el) => getComputedStyle(el).opacity)).toBe("1");
    // It is seen whole beside the list: drawn a little smaller if it must be, never below 85%.
    expect(await sideways(page, ".map-picture")).toBe(0);
    expect(await sequence.evaluate((svg) => svg.getBoundingClientRect().width / (svg as SVGSVGElement).viewBox.baseVal.width)).toBeGreaterThanOrEqual(0.85);

    // Picked in the sequence: the list beside it follows.
    await page.locator('[data-handoff="h-events"]').click();
    await expect(sheet(page).getByRole("heading", { name: "Handoff 18" })).toBeVisible();
    await expect(list.locator('[aria-current="true"]')).toContainText("Operator → Driver");
    // And from the list: the row is marked.
    await list.getByRole("listitem").nth(1).getByRole("button").click();
    await expect(sheet(page).getByRole("heading", { name: "Handoff 2", exact: true })).toBeVisible();
    await expect(page.locator('[data-handoff="h-yes"]')).toHaveClass(/is-on/);
    await expect(page.locator('[data-handoff="h-events"]')).not.toHaveClass(/is-on/);

    // Below 1100 px the picture is the phone's again, its lanes stacked; the switch is still there.
    await views.getByRole("radio", { name: "Picture" }).click();
    await page.setViewportSize({ width: 1000, height: 800 });
    await expect.poll(() => lanesAcross(page)).toBe(1);
    await expect(views.getByRole("radio", { name: "Sequence" })).toBeVisible();
  });

  test("a picture drawn again for a new room gives the keyboard back to the part that had it", async ({ page }) => {
    // Five lanes and no handoffs: there is no list beside the picture, so opening a session narrows the stage, the
    // lanes no longer fit at their full width, and the picture is drawn again.
    const base = mapOf("valid/two-sessions.grooph-map.json");
    const lanes = [0, 1, 2, 3, 4].map((k) => ({ ...base.lanes[0]!, id: `lane-${k}`, name: `Lane ${k}` }));
    const sessions = lanes.map((lane, k) => ({ ...base.sessions[0]!, id: `session-${k}`, name: `Session ${k}`, lane: lane.id }));
    await page.goto(linkFor({ ...base, lanes, sessions, handoffs: [] }));
    const picture = page.locator('.map-picture svg[data-picture="map"]');
    const units = () => picture.evaluate((svg) => (svg as SVGSVGElement).viewBox.baseVal.width);
    const first = page.locator('[data-session="session-0"]');
    await expect(first).toBeVisible();
    const before = await units();
    await first.focus();
    await page.keyboard.press("Enter");
    await expect(sheet(page).getByRole("heading", { name: "Session" })).toBeVisible();
    await expect.poll(units).toBeLessThan(before);
    await expect(first).toBeFocused();
    // And Enter again, on the same part, closes what it opened.
    await page.keyboard.press("Enter");
    await expect(sheet(page)).toHaveCount(0);
  });

  test("a small map side by side is a small picture, and a map in a narrow room keeps every card whole", async ({ page }) => {
    await page.goto(linkFor(mapOf("valid/a-person-and-two-sessions.grooph-map.json")));
    const picture = page.locator('.map-picture svg[data-picture="map"]');
    await expect(picture).toBeVisible();
    // One lane is one column: the picture is not stretched to the room, only shown a little larger.
    const scale = () => picture.evaluate((svg) => svg.getBoundingClientRect().width / (svg as SVGSVGElement).viewBox.baseVal.width);
    expect(await scale()).toBeGreaterThan(1.2);
    expect(await scale()).toBeLessThanOrEqual(1.31);

    // 1100 px is the narrowest wide screen: the long map is drawn a little smaller there to fit, its cards no narrower than their least.
    await page.setViewportSize({ width: 1100, height: 800 });
    await page.goto(linkFor(LONG()));
    await expect(picture).toBeVisible();
    expect(await lanesAcross(page)).toBe(3);
    expect(await sideways(page, ".map-stage")).toBe(0);
    const cards = await picture.evaluate((svg) => [...svg.querySelectorAll("[data-session] > rect[data-card]")].map((r) => Number(r.getAttribute("width"))));
    expect(Math.min(...cards)).toBeGreaterThanOrEqual(150);
    expect(await scale()).toBeGreaterThanOrEqual(0.88);
    expect(await picture.evaluate((svg) => [...svg.querySelectorAll("text")].filter((t) => t.textContent!.endsWith("…")).length)).toBe(0);
  });
});

/* ─── the views are a piece of their own (decision 0021): fetched when a map is drawn, and held for a visit with no network ─── */

test("an address that shows no map does not fetch the map's views; a map does, once, and both views are there with the switch", async ({ page }) => {
  const views: string[] = [];
  page.on("request", (r) => (/\/assets\/views-[^/]*\.js$/.test(new URL(r.url()).pathname) ? views.push(r.url()) : undefined));
  // The front page, the template list and a template on the canvas: none of them draws a map.
  await page.goto("./");
  await expect(page.locator(".land-headline")).toBeVisible();
  await page.goto("./#/templates");
  await page.locator(".template-row").first().tap();
  await expect(page.locator(".react-flow__node").first()).toBeVisible();
  await page.waitForTimeout(300);
  expect(views).toEqual([]);

  // A map: the phone's picture is drawn at once, by what the address already had; the views arrive beside it.
  await page.goto(linkFor(mapOf(SAMPLE)));
  await expect(page.locator('.map-picture svg[data-picture="map"]')).toBeVisible();
  await expect(page.getByRole("radio", { name: "Sequence" })).toBeVisible();
  expect(views).toHaveLength(1);
  // Nothing moved when the switch arrived: its place was kept from the first paint.
  const top = (await page.locator(".map-picture").boundingBox())!.y;
  await page.getByRole("radio", { name: "Sequence" }).tap();
  await expect(page.locator('.map-picture svg[data-picture="sequence"]')).toBeVisible();
  expect((await page.locator(".map-picture").boundingBox())!.y).toBe(top);
  expect(views).toHaveLength(1);
});

test("with the views not to be had, a map still opens: the phone's picture, wider on a wide screen, and no switch", async ({ page }) => {
  await page.route("**/assets/views-*.js", (route) => route.abort());
  await page.goto(linkFor(mapOf(SAMPLE)));
  const picture = page.locator('.map-picture svg[data-picture="map"]');
  await expect(picture).toBeVisible();
  await expect(page.getByRole("radio")).toHaveCount(0);
  await page.locator('[data-session="operator"]').tap();
  await expect(sheet(page).getByRole("heading", { name: "Session" })).toBeVisible();
  await page.getByRole("button", { name: "Close panel" }).tap();

  await page.setViewportSize({ width: 1280, height: 800 });
  await expect.poll(async () => (await picture.boundingBox())?.width ?? 0).toBeGreaterThan(640);
  expect(await lanesAcross(page)).toBe(1);
  await expect(page.getByRole("complementary", { name: "Handoffs" })).toBeVisible();
});

test.describe("with the service worker running", () => {
  test.use({ serviceWorkers: "allow" });

  test("a first visit that saw only the front page opens a map in both views with no network", async ({ page, context }) => {
    // The page names the views' file in a list the browser does nothing with; the worker reads it as it installs.
    await page.goto("./");
    await expect(page.locator(".land-headline")).toBeVisible();
    await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
    await expect.poll(() => page.evaluate(async () => (await (await caches.open("grooph-app-v1")).keys()).filter((r) => /\/assets\/views-[^/]*\.js$/.test(r.url)).length)).toBe(1);

    await context.setOffline(true);
    const failed: string[] = [];
    page.on("requestfailed", (r) => failed.push(r.url()));
    await page.goto(linkFor(LONG()));
    await expect(page.locator('.map-picture svg[data-picture="map"]')).toBeVisible();
    await page.getByRole("radio", { name: "Sequence" }).tap();
    await expect(page.locator('.map-picture svg[data-picture="sequence"] [data-handoff]')).toHaveCount(19);
    // And on a wide screen the lanes are side by side, with no network still.
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.getByRole("radio", { name: "Picture" }).click();
    await expect.poll(() => lanesAcross(page)).toBe(3);
    expect(failed).toEqual([]);
  });
});
