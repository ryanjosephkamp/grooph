import type { RunBundle } from "@grooph/core";
import { expect, test, type Locator, type Page } from "@playwright/test";

import { bundleText, linkFor, noteItem, runBundle, runNode } from "./support.js";
import { desktop, httpsSite, sampleMap, sessionsView, stubSessions } from "./support-alive.js";

/**
 * Handoff 0062: the map, the live view and a run use a desktop's width and
 * show what is running at a glance. On a phone they are as they were, and
 * under reduced motion nothing moves and every state still has its words.
 */

const before = (el: Locator) =>
  el.evaluate((node) => {
    const s = getComputedStyle(node, "::before");
    return { content: s.content, fill: s.backgroundColor, border: s.borderTopStyle, animation: s.animationName, color: getComputedStyle(node).color };
  });
const CLEAR = "rgba(0, 0, 0, 0)";
const sideways = (page: Page): Promise<number> => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

/* ─── the map ────────────────────────────────────────────────────────────── */

test.describe("on a desktop", () => {
  test.use(desktop);

  test("the map's picture is drawn large, with every handoff listed beside it and what is picked shown there", async ({ page }) => {
    const map = sampleMap();
    await page.goto(linkFor(map as never));
    const frame = page.locator(".map-picture");
    const list = page.getByRole("complementary", { name: "Handoffs" });
    await expect(list.getByRole("listitem")).toHaveCount(map.handoffs.length);
    await expect(list.getByRole("listitem").first()).toContainText("Operator → Splashery lanes");

    // Large enough to read, and beside it, not under it.
    const box = (await frame.boundingBox())!;
    expect(box.width).toBeGreaterThan(760);
    expect((await list.boundingBox())!.x).toBeGreaterThanOrEqual(box.x + box.width);
    const smallest = await frame.locator("svg").evaluate((svg) => {
      const scale = svg.getBoundingClientRect().width / (svg as SVGSVGElement).viewBox.baseVal.width;
      return Math.min(...[...svg.querySelectorAll("text")].map((t) => Number(t.getAttribute("font-size")) * scale));
    });
    // Handoff 0080: the lanes are side by side, so three of them share the width one had. A unit is a pixel or a
    // little more, as on a phone: a two-digit number in its ring is 9 px, and the smallest words are 10 px.
    expect(smallest).toBeGreaterThanOrEqual(9);
    // The picture is core's, whole and unchanged; its frame ends where its lanes do, so the handoffs are not listed twice.
    for (const s of map.sessions) await expect(page.locator(`[data-session="${s.id}"]`)).toHaveCount(1);
    await expect(page.locator("[data-handoff-row]").first()).toBeHidden();
    expect((await frame.locator("svg").boundingBox())!.height).toBeGreaterThan(box.height + 200);
    expect(await sideways(page)).toBe(0);

    // A line of the list under the pointer picks its arc out of the others; opened, the handoff is beside the picture.
    const picked = map.handoffs[16]!;
    const arc = (i: number) => page.locator(`[data-handoff="${map.handoffs[i]!.id}"]`);
    const opacity = (i: number) => arc(i).evaluate((el) => getComputedStyle(el).opacity);
    await list.getByRole("listitem").nth(16).getByRole("button").hover();
    await expect(arc(16)).toHaveClass(/is-hot/);
    await expect.poll(() => opacity(0)).toBe("0.28");
    await list.getByRole("listitem").nth(16).getByRole("button").click();
    const sheet = page.locator("aside.sheet");
    await expect(sheet.getByRole("heading", { name: "Handoff 17" })).toBeVisible();
    await expect(page.locator(`[data-handoff="${picked.id}"]`)).toHaveClass(/is-on/);
    await expect.poll(() => opacity(0)).toBe("0.28");
    expect((await sheet.boundingBox())!.x).toBeGreaterThanOrEqual(box.x + box.width);
    // Every handoff is still at hand under the details, the open one marked, and the keyboard goes on from it.
    await expect(sheet.locator('.map-list [aria-current="true"]')).toHaveCount(1);
    await expect(sheet.locator('.map-list [aria-current="true"]')).toBeFocused();
    // Closing it leaves no arc picked out: the line that was under the pointer went with its list.
    await page.getByRole("button", { name: "Close panel" }).click();
    await expect(list).toBeVisible();
    await page.mouse.move(400, 400);
    await expect(page.locator(".map-picture .is-hot, .map-picture .is-on")).toHaveCount(0);
    await expect.poll(() => opacity(0)).toBe("1");

    // From the details, another handoff is one click away.
    await list.getByRole("listitem").nth(16).getByRole("button").click();
    await sheet.locator(".map-list").getByRole("listitem").first().getByRole("button").click();
    await expect(sheet.getByRole("heading", { name: "Handoff 1", exact: true })).toBeVisible();

    // A session on the picture opens there too; closing it brings the list back.
    await page.locator('[data-session="operator"]').click();
    await expect(sheet.getByRole("heading", { name: "Session" })).toBeVisible();
    await page.getByRole("button", { name: "Close panel" }).click();
    await expect(list).toBeVisible();
    await page.mouse.move(400, 400);
    await expect(page.locator(".map-picture .is-hot, .map-picture .is-on")).toHaveCount(0);
    await expect.poll(() => opacity(5)).toBe("1");
  });

  /* ─── the live view ──────────────────────────────────────────────────────── */

  test("sessions sit in a grid, and each state has its color, its mark and its words", async ({ page }) => {
    await stubSessions(page, sessionsView());
    await page.goto("./#/live");
    const cards = page.locator(".live-session");
    await expect(cards).toHaveCount(5);
    const [first, second] = [(await cards.nth(0).boundingBox())!, (await cards.nth(1).boundingBox())!];
    expect(second.y).toBe(first.y);
    expect(second.x).toBeGreaterThan(first.x + first.width);
    expect(await sideways(page)).toBe(0);

    const chip = (state: string) => page.locator(`.live-session .live-state-${state}`).first();
    await expect(chip("working")).toHaveText("Working");
    await expect(chip("waiting")).toHaveText("Waiting");
    await expect(chip("quiet")).toHaveText(/^Last seen 2 h 20 min ago$/);
    await expect(chip("ended")).toHaveText("Ended");
    const [working, waiting, quiet, ended] = [await before(chip("working")), await before(chip("waiting")), await before(chip("quiet")), await before(chip("ended"))];
    // The mark: a filled dot that pulses, a ring, a ring, a still dot.
    expect(working).toMatchObject({ content: '""', fill: working.color, animation: "live-sign" });
    expect(waiting).toMatchObject({ content: '""', fill: CLEAR, border: "solid", animation: "none" });
    expect(quiet).toMatchObject({ content: '""', fill: CLEAR, border: "solid", animation: "none" });
    expect(ended).toMatchObject({ content: '""', fill: ended.color, animation: "none" });
    // The color: working, waiting and over are three colors; gone quiet and ended share the gray of what is not at work.
    expect(new Set([working.color, waiting.color, ended.color]).size).toBe(3);
    expect(quiet.color).toBe(ended.color);
    // The card says it as well: the one at work stands out, the one in doubt is dashed.
    expect(await page.locator(".live-session.live-working").evaluate((el) => getComputedStyle(el).boxShadow)).not.toBe("none");
    expect(await page.locator(".live-session.live-quiet").evaluate((el) => getComputedStyle(el).borderTopStyle)).toBe("dashed");
    // And the page counts them, working first.
    await expect(page.getByLabel("Sessions by state").locator("span")).toHaveText(["1 working", "1 waiting", "1 gone quiet", "2 ended"]);

    // With motion reduced nothing pulses; the colors and the words are the same.
    await page.emulateMedia({ reducedMotion: "reduce" });
    expect((await before(chip("working"))).animation).toBe("none");
    expect((await before(chip("working"))).color).toBe(working.color);
    await expect(chip("working")).toHaveText("Working");
    expect(await page.locator(".live-agent.is-running .live-mark").evaluate((el) => getComputedStyle(el).animationName)).toBe("none");
  });
});

test("on a phone the map and the sessions are one column, as they were", async ({ page }) => {
  await page.goto(linkFor(sampleMap() as never));
  await expect(page.locator(".map-picture svg")).toBeVisible();
  await expect(page.locator(".map-side")).toHaveCount(0);
  await expect(page.locator("[data-handoff-row]").first()).toBeVisible();
  expect((await page.locator(".map-picture svg").boundingBox())!.width).toBeLessThanOrEqual(400);

  await stubSessions(page, sessionsView());
  await page.goto("./#/live");
  const cards = page.locator(".live-session");
  await expect(cards).toHaveCount(5);
  expect((await cards.nth(1).boundingBox())!.x).toBe((await cards.nth(0).boundingBox())!.x);
  expect((await cards.nth(1).boundingBox())!.y).toBeGreaterThan((await cards.nth(0).boundingBox())!.y);
  expect(await sideways(page)).toBe(0);
});

test("on a site with no grooph watch the live view says what it is and what to run, asks for nothing and logs no error", async ({ page }) => {
  const errors: string[] = [];
  const asked: string[] = [];
  page.on("console", (m) => (m.type() === "error" ? errors.push(m.text()) : undefined));
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("request", (r) => (r.url().includes("/api/") ? asked.push(r.url()) : undefined));

  // The public site: https, static files, and a 404 for the sessions endpoint.
  const site = await httpsSite(page);
  await page.goto(`${site}#/live`);
  const none = page.locator(".live-none");
  await expect(none.getByRole("heading", { name: "Your sessions, as they work" })).toBeVisible();
  await expect(none).toContainText("This screen shows each session the event hook has recorded on your computer");
  await expect(page.getByRole("status").filter({ hasText: "There is no grooph watch here that serves sessions." })).toBeVisible();
  await expect(none.locator("code")).toHaveText("grooph watch --sessions");
  await expect(none.getByRole("button", { name: "Copy the command" })).toBeVisible();
  await expect(page.locator("header.topbar .status")).toHaveText("Not connected");
  // It does not keep asking a site that has nothing to answer with.
  await page.waitForTimeout(2_600);
  await expect(none).not.toContainText("Still asking");
  expect(asked).toEqual([]);
  expect(errors).toEqual([]);
  expect(await sideways(page)).toBe(0);
});

test("behind https, a grooph watch that a proxy passes on is found and followed", async ({ page }) => {
  const site = await httpsSite(page, sessionsView());
  await page.goto(`${site}#/live`);
  await expect(page.locator(".live-session")).toHaveCount(5);
  await expect(page.locator(".live-none")).toHaveCount(0);
});

/* ─── a run ──────────────────────────────────────────────────────────────── */

const RUN = "20260919-1100-live";
const live = (extra: object[] = []): RunBundle => runBundle("run-live", { notes: (lines) => [...lines, ...extra.map((n) => JSON.stringify({ run: RUN, ...n }))] });
const FINISH = [
  { id: "n-0005", at: "node:critic", ended: "2026-09-19T11:12:00Z", outcome: "pass", verdict: "pass", round: 0 },
  { id: "n-0006", at: "loop:review-cycle", ended: "2026-09-19T11:12:00Z", outcome: "pass", round: 0, stop: "bar-passed" },
  { id: "n-0007", at: "node:merge-gate", ended: "2026-09-19T11:13:00Z", outcome: "pass", verdict: "approve", round: 0 },
  { id: "n-0008", at: "node:done", ended: "2026-09-19T11:13:00Z", outcome: "pass" },
  { id: "n-0009", at: "graph", ended: "2026-09-19T11:13:00Z", outcome: "pass", text: "run ended at done" },
];
const flag = (page: Page, id: string) => runNode(page, id).evaluate((el) => getComputedStyle(el, "::before").content);
const backEdge = (page: Page) => page.locator(".gedge.is-back .gedge-line").first().evaluate((el) => getComputedStyle(el).animationName);

test("a live run wears a live badge and the loop its running node is in glows; when it ends, both stop and it says where", async ({ page }) => {
  let ended = false;
  await page.route("**/grooph/api/run.json", (route) => route.fulfill({ status: 200, contentType: "application/json; charset=utf-8", body: bundleText(ended ? live(FINISH) : live()) }));
  await page.goto("./#/run?live");

  // The badge: the same words as before, shown as a badge with a dot that beats.
  await expect(page.locator(".title-sub")).toHaveText(`Run ${RUN} · live`);
  const badge = page.locator(".title-sub.is-live .run-from");
  await expect(badge).toHaveText("live");
  expect(await badge.evaluate((el) => getComputedStyle(el).textTransform)).toBe("uppercase");
  expect((await before(badge)).animation).toBe("run-beat");
  expect((await badge.boundingBox())!.x).toBeLessThan((await page.locator(".title-sub .mono").boundingBox())!.x);

  // The loop the critic runs in: its name says so, its members are ringed in its color, its way back flows.
  const stage = page.locator(".run-stage");
  const pill = page.locator('.loop-pill[data-loop-id="review-cycle"]');
  await expect(stage).toHaveClass(/is-glowing/);
  await expect(pill).toHaveText("Build-review cycleround 0· running");
  await expect(pill).toHaveClass(/is-on/);
  for (const id of ["builder", "critic", "merge-gate"]) await expect(runNode(page, id)).toHaveClass(/in-loop/);
  await expect(runNode(page, "done")).not.toHaveClass(/in-loop/);
  expect(await runNode(page, "builder").evaluate((el) => getComputedStyle(el).boxShadow)).toContain("20px");
  expect(await backEdge(page)).toBe("run-flow");
  await expect(runNode(page, "critic")).toHaveClass(/run-running/);
  await expect(page.locator(".run-end")).toHaveCount(0);

  // A picked note takes the canvas for itself; letting go gives it back to the loop.
  await noteItem(page, "n-0003").locator(".tl-note").tap();
  await expect(runNode(page, "builder")).toHaveClass(/is-highlighted/);
  await expect(stage).not.toHaveClass(/is-glowing/);
  await noteItem(page, "n-0003").locator(".tl-note").tap();
  await expect(stage).toHaveClass(/is-glowing/);

  // With motion reduced nothing moves; the ring, the badge and the words stay.
  await page.emulateMedia({ reducedMotion: "reduce" });
  expect(await backEdge(page)).toBe("none");
  expect((await before(badge)).animation).toBe("none");
  expect(await pill.locator(".loop-dot").evaluate((el) => getComputedStyle(el).animationName)).toBe("none");
  expect(await runNode(page, "critic").evaluate((el) => getComputedStyle(el, "::after").animationName)).toBe("none");
  await expect(pill).toContainText("running");
  await expect(badge).toBeVisible();
  await page.emulateMedia({ reducedMotion: "no-preference" });

  // The run ends: no badge, no glow, and where it ended is said above the facts and flagged on the graph.
  ended = true;
  await expect(page.locator(".run-end")).toContainText("Ended at Done", { timeout: 8_000 });
  await expect(page.locator(".run-end")).toContainText("Last loop stop: bar passed · Build-review cycle, round 0");
  await expect(page.locator(".title-sub")).not.toHaveClass(/is-live/);
  await expect(page.locator(".title-sub")).toHaveText(`Run ${RUN} · live`);
  await expect(stage).not.toHaveClass(/is-glowing/);
  expect(await flag(page, "done")).toBe('"ended here"');
});

test("a run that is over says where it ended and which stop fired, without the timeline", async ({ page }) => {
  // The real record: it ended at its stop node after the loop's bar passed in round 1.
  await page.goto(linkFor(runBundle("slice-0007-sandwich")));
  const end = page.locator(".run-end");
  await expect(end).toContainText("Ended at Done");
  await expect(end).toContainText("Last loop stop: bar passed · Sandwich, round 1");
  expect(await flag(page, "done")).toBe('"ended here"');
  expect(await flag(page, "critic")).toBe("none");
  // It leads to the note that says so.
  await end.tap();
  await expect(runNode(page, "done")).toHaveClass(/is-highlighted/);
  await expect(page.locator(".tl-item.is-on")).toHaveCount(1);
  expect(await sideways(page)).toBe(0);

  // A run halted at a gate says that instead.
  await page.goto(linkFor(runBundle("run-gate")));
  await expect(end).toContainText("Halted at Merge approval");
  await expect(end).toContainText("Last loop stop: bar passed · Build-review cycle, round 0");
  expect(await flag(page, "merge-gate")).toBe('"halted here"');
  expect(await flag(page, "done")).toBe("none");
  await expect(page.locator(".title-sub.is-live")).toHaveCount(0);
});

test("where a run ended is read from what its notes say last, not from the last node they name", async ({ page }) => {
  const end = page.locator(".run-end");
  // Many leads write no note at the stop node: the final note is at the run. The graph's one stop node is where it ended.
  await page.goto(linkFor(live(FINISH.filter((n) => n.at !== "node:done"))));
  await expect(end).toContainText("Ended at Done");
  expect(await flag(page, "done")).toBe('"ended here"');
  expect(await flag(page, "merge-gate")).toBe("none");

  // A run that halted at a gate, went on, and was then halted by its loop's stop: it halted in the loop, not at the gate it passed.
  const gate = (extra: object[]): RunBundle => runBundle("run-gate", { notes: (lines) => [...lines, ...extra.map((n) => JSON.stringify({ run: "20260919-1200-gate", ...n }))] });
  await page.goto(
    linkFor(
      gate([
        { id: "n-0010", at: "node:merge-gate", ended: "2026-09-19T12:20:00Z", outcome: "fail", verdict: "reject", round: 0 },
        { id: "n-0011", at: "node:builder", ended: "2026-09-19T12:30:00Z", outcome: "pass", round: 1 },
        { id: "n-0012", at: "loop:review-cycle", ended: "2026-09-19T12:30:00Z", outcome: "halt", round: 1, stop: "max-iterations" },
        { id: "n-0013", at: "graph", ended: "2026-09-19T12:30:01Z", outcome: "halt", text: "halted: the loop's limit is reached" },
      ]),
    ),
  );
  await expect(end).toContainText("Halted in loop Build-review cycle");
  await expect(end).toContainText("Last loop stop: max iterations · Build-review cycle, round 1");
  for (const id of ["builder", "critic", "merge-gate", "done"]) expect(await flag(page, id)).toBe("none");
});
