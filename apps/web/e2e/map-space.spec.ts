import { readFileSync } from "node:fs";
import { join } from "node:path";
import { deflateRawSync } from "node:zlib";

import { buildShareEnvelope, encodeSharePayload, parseMapText, type OperationMap } from "@grooph/core";
import { expect, test, type Page } from "@playwright/test";

import { repoRoot } from "./support.js";

/**
 * A map in three dimensions (handoff 0087): the third choice on the map screen's switch. The same document and
 * the same list beside it; drag, pinch and the keyboard turn it; a slider steps through the handoffs in the map's
 * order; and it is a piece of the app that nothing fetches until it is chosen.
 */
const LONG = (): OperationMap => parseMapText(readFileSync(join(repoRoot, "handoffs/briefs/plan-2026-10-04/build.grooph-map.json"), "utf8")).map!;
const SMALL = (): OperationMap => parseMapText(readFileSync(join(repoRoot, "fixtures/maps/valid/a-person-and-two-sessions.grooph-map.json"), "utf8")).map!;
const linkFor = (map: OperationMap): string => `./#/open?d=${encodeSharePayload(buildShareEnvelope(map), (bytes) => deflateRawSync(bytes, { level: 9 }))}`;
const sheet = (page: Page) => page.locator("aside.sheet");
const view = (page: Page, name: string) => page.getByRole("radio", { name });
const posed = (page: Page) => page.locator(".space-world").evaluate((el) => (el as HTMLElement).style.transform);
/** How far in the view has been moved: 1 at the starting view. */
const sized = async (page: Page): Promise<number> => Number(/scale\(([\d.]+)\)/.exec(await page.locator(".space-lens").evaluate((el) => (el as HTMLElement).style.transform))![1]);
/** A point of the page that a part of the scene is itself under: a card turned in space is not its bounding box. */
const pointOn = (page: Page, selector: string) =>
  page.locator(selector).evaluate((part) => {
    const box = part.getBoundingClientRect();
    for (let y = box.bottom - 4; y > box.top; y -= 4) for (let x = box.left + 4; x < box.right; x += 4) if (document.elementFromPoint(x, y)?.closest("[data-session], [data-person]") === part) return [x, y] as const;
    throw new Error("no point of the page is on that part");
  });
const slider = (page: Page) => page.getByRole("slider", { name: "Handoff, in the order the map lists them" });
const says = (page: Page) => page.locator(".space output");

/** Open a map and choose its view in three dimensions. */
async function open(page: Page, map: OperationMap = LONG()): Promise<void> {
  await page.goto(linkFor(map));
  await view(page, "3D").click();
  await expect(page.locator(".space-scene")).toBeVisible();
  await expect.poll(() => posed(page)).toContain("scale3d(");
}

/** Drag across the scene with one pointer, in steps, from its middle. */
async function drag(page: Page, dx: number, dy: number, steps = 8): Promise<void> {
  const box = (await page.locator(".space-scene").boundingBox())!;
  const [x, y] = [box.x + box.width / 2, box.y + box.height / 2];
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + dx, y + dy, { steps });
  await page.mouse.up();
}

test("the third choice on the switch draws the map in three dimensions: every session and handoff, named, in the keyboard's reach, and whole in its frame", async ({ page }) => {
  const map = LONG();
  await open(page, map);
  await expect(view(page, "3D")).toHaveAttribute("aria-checked", "true");
  await expect(view(page, "Picture")).toHaveAttribute("aria-checked", "false");
  const scene = page.locator(".space-scene");
  await expect(scene.locator(".space-sheet")).toHaveCount(4);
  await expect(scene.locator("[data-session]")).toHaveCount(map.sessions.length);
  await expect(scene.locator("[data-person]")).toHaveCount(1);
  await expect(scene.locator("[data-handoff]")).toHaveCount(map.handoffs.length);

  // Every part has a name and can be reached by Tab; the scene itself says what it is and how to turn it.
  const parts = await scene.locator("[data-session], [data-person], [data-handoff]").evaluateAll((els) => els.map((el) => [el.getAttribute("aria-label"), el.getAttribute("tabindex"), el.getAttribute("role")]));
  expect(parts).toHaveLength(map.sessions.length + 1 + map.handoffs.length);
  expect(parts.every(([name, tab, role]) => !!name && tab === "0" && role === "button")).toBe(true);
  expect(parts.map(([name]) => name)).toEqual(expect.arrayContaining(["Session Driver", "Person Ryan", "Handoff 7: Ryan to Lane 5: Codex target"]));
  await expect(scene).toHaveAttribute("aria-label", /in three dimensions: 4 sheets, 10 cards, 19 handoffs\. Drag, or use the arrow keys, to turn it/);

  // The starting view shows every card inside the frame, and the page still scrolls only down.
  const frame = (await scene.boundingBox())!;
  for (const box of await scene.locator(".space-card").evaluateAll((els) => els.map((el) => el.getBoundingClientRect().toJSON()))) {
    expect(box.left).toBeGreaterThanOrEqual(frame.x - 1);
    expect(box.right).toBeLessThanOrEqual(frame.x + frame.width + 1);
    expect(box.top).toBeGreaterThanOrEqual(frame.y - 1);
    expect(box.bottom).toBeLessThanOrEqual(frame.y + frame.height + 1);
  }
  expect(await page.locator(".map-stage").evaluate((el) => el.scrollWidth - el.clientWidth)).toBe(0);

  // It says, as the sequence does, that its order is an order.
  await expect(says(page)).toHaveText("All 19 handoffs are lit. Move the slider or press Play to light them one at a time.");
  await expect(page.locator(".space-note")).toHaveText("The order the map lists its handoffs in. An order, not a clock: a map records no times.");

  // A card opens what the map says about its session, as in the flat views; so does an arc from the keyboard.
  const on = await pointOn(page, '.space [data-session="driver"]');
  await page.mouse.click(on[0], on[1]);
  await expect(sheet(page).getByRole("heading", { name: "Session" })).toBeVisible();
  await expect(scene.locator('[data-session="driver"]')).toHaveClass(/is-on/);
  await scene.locator(`[data-handoff="${map.handoffs[2]!.id}"]`).focus();
  await page.keyboard.press("Enter");
  await expect(sheet(page).getByRole("heading", { name: "Handoff 3" })).toBeVisible();
});

test("the slider steps through the handoffs in the map's order, by hand or played, and lights one with its two ends", async ({ page }) => {
  const map = LONG();
  await open(page, map);
  await slider(page).fill("7");
  await expect(says(page)).toHaveText(/^Handoff 7 of 19: Ryan to Lane 5: Codex target · carried by Ryan/);
  // The slider says where it is; the sentence under it, read out as it changes, says the rest.
  await expect(slider(page)).toHaveAttribute("aria-valuetext", "handoff 7 of 19");
  await expect(page.locator(".space-n").first()).toHaveAttribute("aria-hidden", "true");
  await expect(page.locator(".space-arc.is-lit")).toHaveCount(1);
  await expect(page.locator('.space-arc[data-arc="6"]')).toHaveClass(/is-lit/);
  await expect(page.locator(".space-arc.is-past")).toHaveCount(6);
  await expect(page.locator(".space-arc.is-ahead")).toHaveCount(12);
  await expect(page.locator(".space .is-end")).toHaveCount(2);
  await expect(page.locator(`.space [data-person="${map.handoffs[6]!.from}"]`)).toHaveClass(/is-end/);
  await expect(page.locator(`.space [data-session="${map.handoffs[6]!.to}"]`)).toHaveClass(/is-end/);
  // Those before it are behind it, those after it further.
  const seen = (k: number) => page.locator(`.space-arc[data-arc="${k}"]`).evaluate((el) => Number(getComputedStyle(el).opacity));
  await expect.poll(() => seen(0)).toBe(0.5);
  await expect.poll(() => seen(12)).toBeLessThan(0.2);
  expect(await seen(6)).toBe(1);

  await page.getByRole("button", { name: "Next handoff" }).click();
  await expect(says(page)).toHaveText(/^Handoff 8 of 19/);
  await page.getByRole("button", { name: "Previous handoff" }).click();
  await page.getByRole("button", { name: "Previous handoff" }).click();
  await expect(says(page)).toHaveText(/^Handoff 6 of 19/);
  // The slider is a slider: the arrow keys move it.
  await slider(page).focus();
  await page.keyboard.press("ArrowLeft");
  await expect(says(page)).toHaveText(/^Handoff 5 of 19/);
  // Stepping picks nothing on the map: no details open.
  await expect(sheet(page)).toHaveCount(0);

  // Played, it goes on by itself until it is paused.
  await page.getByRole("button", { name: "Play", exact: true }).click();
  await expect(page.getByRole("button", { name: "Pause" })).toBeVisible();
  await expect.poll(async () => Number(await slider(page).inputValue()), { timeout: 6000 }).toBeGreaterThan(5);
  await page.getByRole("button", { name: "Pause" }).click();
  const paused = await slider(page).inputValue();
  await page.waitForTimeout(2700);
  expect(await slider(page).inputValue()).toBe(paused);
  // Back at the start, all of them are lit alike.
  await slider(page).fill("0");
  await expect(page.locator(".space :is(.is-lit, .is-past, .is-ahead, .is-end)")).toHaveCount(0);
});

test("a handoff picked in three dimensions is picked in the other views, and the slider goes to it; coming back keeps the view", async ({ page }) => {
  const map = LONG();
  const id = map.handoffs[2]!.id;
  await open(page, map);
  // Its number opens it, as its line does.
  await page.locator(`.space-n [data-number="${id}"]`).dispatchEvent("click");
  await expect(sheet(page).getByRole("heading", { name: "Handoff 3" })).toBeVisible();
  await expect(page.locator(`.space [data-handoff="${id}"]`)).toHaveClass(/is-on/);
  await expect(slider(page)).toHaveValue("3");
  await expect(says(page)).toHaveText(/^Handoff 3 of 19/);

  await page.locator(".space-scene").focus();
  await page.keyboard.press("ArrowRight");
  const turned = await posed(page);

  await view(page, "Sequence").click();
  await expect(page.locator(`.map-picture svg[data-picture="sequence"] [data-handoff="${id}"]`)).toHaveClass(/is-on/);
  await expect(page.locator(".space")).toHaveCount(0);
  await view(page, "3D").click();
  await expect(page.locator(`.space [data-handoff="${id}"]`)).toHaveClass(/is-on/);
  await expect(slider(page)).toHaveValue("3");
  expect(await posed(page)).toBe(turned);

  // The slider is the reader's once it has been moved: an open handoff does not take it back, not when its mark
  // is put on again in markup drawn anew, and not when another line of the list is pointed at.
  await slider(page).fill("9");
  await view(page, "Sequence").click();
  await view(page, "3D").click();
  await expect(page.locator(`.space [data-handoff="${id}"]`)).toHaveClass(/is-on/);
  await expect(slider(page)).toHaveValue("9");
  // The open arc keeps its wide target for a finger, and its line is heavier, as an open handoff's is in the picture.
  const arc = page.locator(`.space [data-handoff="${id}"]`);
  expect(await arc.locator(".space-hit").evaluate((el) => getComputedStyle(el).strokeWidth)).toBe("16px");
  expect(await arc.locator("path").first().evaluate((el) => getComputedStyle(el).strokeWidth)).toBe("3.4px");
  // The handoff the slider lights is heavier still, open or not.
  await slider(page).fill("3");
  expect(await arc.locator("path").first().evaluate((el) => getComputedStyle(el).strokeWidth)).toBe("3.8px");
  expect(await page.locator('.space-arc[data-arc="8"] path').first().evaluate((el) => getComputedStyle(el).strokeWidth)).not.toBe("3.8px");
});

test("on a phone, with details open under it, the scene and what was picked are still in view", async ({ page }) => {
  await open(page);
  const on = await pointOn(page, '.space [data-session="operator"]');
  await page.mouse.click(on[0], on[1]);
  await expect(sheet(page).getByRole("heading", { name: "Session" })).toBeVisible();
  const top = (await sheet(page).boundingBox())!.y;
  // The scene is no taller than the room left above the details, and is brought whole into it, refitted.
  await expect.poll(async () => ((await page.locator(".space-scene").boundingBox())!.y + (await page.locator(".space-scene").boundingBox())!.height)).toBeLessThanOrEqual(top + 1);
  const card = await page.locator('.space [data-session="operator"]').evaluate((el) => el.getBoundingClientRect().toJSON());
  expect(card.bottom).toBeLessThanOrEqual(top);
  expect(card.top).toBeGreaterThanOrEqual((await page.locator(".space-scene").boundingBox())!.y - 1);
  // Closed again, the scene takes its room back.
  await page.getByRole("button", { name: "Close panel" }).click();
  await expect.poll(async () => (await page.locator(".space-scene").boundingBox())!.height).toBeGreaterThan(400);
});

test("a map with thirty sessions in one lane is fitted whole: no card and no sheet outside the frame", async ({ page }) => {
  const base = SMALL();
  await open(page, { ...base, sessions: Array.from({ length: 30 }, (_, k) => ({ ...base.sessions[0]!, id: `s-${k}`, name: `Session ${k}` })), handoffs: [] });
  const frame = (await page.locator(".space-scene").boundingBox())!;
  const boxes = await page.locator(".space-card, .space-sheet").evaluateAll((els) => els.map((el) => el.getBoundingClientRect().toJSON()));
  expect(boxes.length).toBe(33);
  for (const box of boxes) {
    expect(box.left).toBeGreaterThanOrEqual(frame.x);
    expect(box.right).toBeLessThanOrEqual(frame.x + frame.width);
    expect(box.top).toBeGreaterThanOrEqual(frame.y);
    expect(box.bottom).toBeLessThanOrEqual(frame.y + frame.height);
  }
  // With nothing to step through, the stepping is off and says so.
  await expect(slider(page)).toBeDisabled();
  await expect(page.getByRole("button", { name: "Play", exact: true })).toBeDisabled();
  await expect(says(page)).toHaveText("This map has no handoffs to step through.");
});

test("a drag turns it and is not a tap; pinch, the buttons and the keyboard move it; one tap returns to the starting view", async ({ page }) => {
  await open(page);
  const start = await posed(page);
  const size = await sized(page);
  expect(size).toBe(1);

  await drag(page, 90, 40);
  await expect.poll(() => posed(page)).not.toBe(start);
  // The drag ended on the map, and opened nothing.
  await expect(sheet(page)).toHaveCount(0);
  await page.getByRole("button", { name: "Starting view" }).click();
  await expect.poll(() => posed(page)).toBe(start);

  // It turns only so far: the cards face the front, and the view never goes behind them or under the sheets.
  await drag(page, 2000, -2000, 20);
  const far = await posed(page);
  expect(Number(/rotateY\(([-\d.]+)rad\)/.exec(far)![1])).toBeCloseTo(0.96, 5);
  expect(Number(/rotateX\(([-\d.]+)rad\)/.exec(far)![1])).toBeCloseTo(-0.1, 5);

  // The keyboard, with the scene in focus: arrows turn, plus and minus move in and out, 0 goes back.
  await page.locator(".space-scene").focus();
  await page.keyboard.press("0");
  await expect.poll(() => posed(page)).toBe(start);
  await page.keyboard.press("ArrowLeft");
  await expect.poll(() => posed(page)).not.toBe(start);
  await page.keyboard.press("+");
  await expect.poll(() => sized(page)).toBeGreaterThan(size);
  await page.keyboard.press("Home");
  await expect.poll(() => posed(page)).toBe(start);
  await expect.poll(() => sized(page)).toBe(1);
  // The arrows turn it the way a drag does: down looks from higher, as a drag down does.
  const tipped = () => posed(page).then((t) => Number(/rotateX\(([-\d.]+)rad\)/.exec(t)![1]));
  const level = await tipped();
  await page.keyboard.press("ArrowDown");
  await expect.poll(tipped).toBeLessThan(level);
  await page.keyboard.press("0");
  await expect.poll(() => posed(page)).toBe(start);
  // The browser's own keys are the browser's: its zoom and its way back are not taken.
  const taken = (key: { key: string; ctrlKey?: boolean; metaKey?: boolean; altKey?: boolean }) => page.locator(".space-scene").evaluate((el, i) => !el.dispatchEvent(new KeyboardEvent("keydown", { ...i, bubbles: true, cancelable: true })), key);
  expect(await taken({ key: "=", ctrlKey: true })).toBe(false);
  expect(await taken({ key: "0", metaKey: true })).toBe(false);
  expect(await taken({ key: "ArrowLeft", altKey: true })).toBe(false);
  expect(await posed(page)).toBe(start);
  expect(await taken({ key: "=" })).toBe(true);
  await page.keyboard.press("0");
  await expect.poll(() => sized(page)).toBe(1);

  // The buttons.
  await page.getByRole("button", { name: "Move in" }).click();
  await expect.poll(() => sized(page)).toBeCloseTo(size * 1.25, 3);
  await page.getByRole("button", { name: "Move out" }).click();
  await page.getByRole("button", { name: "Move out" }).click();
  await expect.poll(() => sized(page)).toBeCloseTo(size * 0.8, 3);
  await page.getByRole("button", { name: "Starting view" }).click();
  await expect.poll(() => posed(page)).toBe(start);
  await expect.poll(() => sized(page)).toBe(1);

  // Only a mouse's main button drags, and a mouse seen with no button down is not dragging: its release was missed.
  const box = (await page.locator(".space-scene").boundingBox())!;
  await page.mouse.move(box.x + 80, box.y + 120);
  await page.mouse.down({ button: "right" });
  await page.mouse.move(box.x + 180, box.y + 160, { steps: 5 });
  await page.mouse.up({ button: "right" });
  await page.locator(".space-scene").evaluate((el) => {
    const at = el.getBoundingClientRect();
    const send = (type: string, x: number, buttons: number) => el.dispatchEvent(new PointerEvent(type, { pointerId: 1, pointerType: "mouse", isPrimary: true, button: 0, buttons, clientX: at.x + x, clientY: at.y + 90, bubbles: true }));
    send("pointerdown", 100, 1);
    send("pointermove", 180, 0);
    send("pointermove", 260, 0);
  });
  await page.waitForTimeout(150);
  expect(await posed(page)).toBe(start);

  // A finger's drag ends with no click of its own: the next click, from a reader's tool with no press before it, is a click.
  await page.locator(".space-scene").evaluate((el) => {
    const at = el.getBoundingClientRect();
    const send = (type: string, x: number) => el.dispatchEvent(new PointerEvent(type, { pointerId: 21, pointerType: "touch", isPrimary: true, clientX: at.x + x, clientY: at.y + 90, bubbles: true }));
    send("pointerdown", 100);
    send("pointermove", 130);
    send("pointermove", 160);
    send("pointerup", 160);
  });
  await page.waitForTimeout(150);
  await page.locator('.space [data-session="driver"]').dispatchEvent("click");
  await expect(sheet(page).getByRole("heading", { name: "Session" })).toBeVisible();
  await page.getByRole("button", { name: "Close panel" }).click();
  await page.getByRole("button", { name: "Starting view" }).click();
  await expect.poll(() => posed(page)).toBe(start);

  // Two fingers moving apart move in.
  await page.locator(".space-scene").evaluate((el) => {
    const at = el.getBoundingClientRect();
    const send = (type: string, id: number, x: number) => el.dispatchEvent(new PointerEvent(type, { pointerId: id, pointerType: "touch", clientX: at.x + x, clientY: at.y + 100, bubbles: true }));
    send("pointerdown", 11, 100);
    send("pointerdown", 12, 160);
    send("pointermove", 12, 220);
    send("pointerup", 11, 100);
    send("pointerup", 12, 220);
  });
  await expect.poll(() => sized(page)).toBeCloseTo(size * 2, 3);
});

test.describe("with reduced motion", () => {
  test.use({ reducedMotion: "reduce" });

  test("nothing moves by itself: the view is still, the slider waits, and the starting view comes back at once", async ({ page }) => {
    await open(page);
    const start = await posed(page);
    await page.waitForTimeout(900);
    expect(await posed(page)).toBe(start);
    await expect(slider(page)).toHaveValue("0");
    expect(await page.locator(".space-arc").first().evaluate((el) => getComputedStyle(el).transitionDuration)).toBe("0s");
    // Play is there, and is the reader's to press.
    await expect(page.getByRole("button", { name: "Play", exact: true })).toBeVisible();
    await drag(page, 70, 30);
    await expect.poll(() => posed(page)).not.toBe(start);
    await page.getByRole("button", { name: "Starting view" }).click();
    expect(await posed(page)).toBe(start);
  });
});

test("a device that cannot draw it thirty times a second is told so, and offered the two flat views", async ({ page }) => {
  // Frames that come fifty milliseconds apart: twenty a second.
  await page.addInitScript(() => {
    window.requestAnimationFrame = (fn) => window.setTimeout(() => fn(performance.now()), 50);
    window.cancelAnimationFrame = (id) => window.clearTimeout(id);
  });
  await open(page);
  const note = page.locator(".space-flat");
  await expect(note).toBeHidden();
  // A slow drag, so that every frame finds the view moved.
  const box = (await page.locator(".space-scene").boundingBox())!;
  await page.mouse.move(box.x + 60, box.y + 200);
  await page.mouse.down();
  for (let k = 1; k <= 80; k++) {
    await page.mouse.move(box.x + 60 + k * 3, box.y + 200 + (k % 2));
    await page.waitForTimeout(12);
  }
  await page.mouse.up();
  await expect(note).toBeVisible();
  await expect(note).toHaveText(/drawing the map in three dimensions (1\d|2\d) times a second, fewer than 30: too slowly to turn it smoothly\. The picture and the sequence show the same map, flat\./);
  await expect(note).toHaveAttribute("role", "status");
  // It is still there to use; the note offers the others.
  await expect(page.locator(".space-scene")).toBeVisible();
  await note.getByRole("button", { name: "Sequence" }).click();
  await expect(page.locator('.map-picture svg[data-picture="sequence"]')).toBeVisible();
  await expect(view(page, "Sequence")).toHaveAttribute("aria-checked", "true");
  await expect(sheet(page)).toHaveCount(0);
});

test("a browser that cannot stand one thing behind another is shown no scene, only where the flat views are", async ({ page }) => {
  await page.addInitScript(() => {
    const real = CSS.supports.bind(CSS);
    CSS.supports = ((...args: [string, string?]) => (args[0] === "transform-style" ? false : real(...(args as [string, string])))) as typeof CSS.supports;
  });
  await page.goto(linkFor(LONG()));
  await view(page, "3D").click();
  const note = page.locator(".space-flat");
  await expect(note).toHaveText(/This browser cannot draw the map in three dimensions\. The picture and the sequence show the same map, flat\./);
  await expect(page.locator(".space-scene")).toBeHidden();
  await expect(slider(page)).toBeHidden();
  await note.getByRole("button", { name: "Picture" }).click();
  await expect(page.locator('.map-picture svg[data-picture="map"]')).toBeVisible();
  await expect(view(page, "Picture")).toHaveAttribute("aria-checked", "true");
});

/* ─── behind a door (decision 0021): fetched when it is chosen, and held for a visit with no network ─── */

test("nothing fetches the view in three dimensions until it is chosen: not the front page, a template, or a map in either flat view", async ({ page }) => {
  const asked: string[] = [];
  page.on("request", (r) => (/\/assets\/space-[^/]*\.js$/.test(new URL(r.url()).pathname) ? asked.push(r.url()) : undefined));
  await page.goto("./");
  await expect(page.locator(".land-headline")).toBeVisible();
  await page.goto("./#/templates");
  await page.locator(".template-row").first().tap();
  await expect(page.locator(".react-flow__node").first()).toBeVisible();
  await page.goto(linkFor(SMALL()));
  await expect(page.locator('.map-picture svg[data-picture="map"]')).toBeVisible();
  await view(page, "Sequence").click();
  await expect(page.locator('.map-picture svg[data-picture="sequence"]')).toBeVisible();
  await page.waitForTimeout(300);
  expect(asked).toEqual([]);
  // No rule of its styles is on the page either.
  expect(await page.evaluate(() => [...document.querySelectorAll("style")].some((s) => s.textContent!.includes(".space-scene")))).toBe(false);

  await view(page, "3D").click();
  await expect(page.locator(".space-scene")).toBeVisible();
  expect(asked).toHaveLength(1);
  // Chosen again, it is not fetched again, and its styles are on the page once.
  await view(page, "Picture").click();
  await view(page, "3D").click();
  await expect(page.locator(".space-scene")).toBeVisible();
  expect(asked).toHaveLength(1);
  expect(await page.evaluate(() => [...document.querySelectorAll("style")].filter((s) => s.textContent!.includes(".space-scene {") || s.textContent!.includes(".space-scene{")).length)).toBe(1);
});

test("when the view cannot be fetched the switch says so and goes back to the flat view it had", async ({ page }) => {
  await page.route("**/assets/space-*.js", (route) => route.abort());
  await page.goto(linkFor(LONG()));
  await view(page, "Sequence").click();
  await view(page, "3D").click();
  await expect(page.getByRole("status")).toHaveText("The view in three dimensions could not be fetched. The picture and the sequence show the same map.");
  await expect(view(page, "Sequence")).toHaveAttribute("aria-checked", "true");
  await expect(page.locator('.map-picture svg[data-picture="sequence"]')).toBeVisible();
  await expect(page.locator(".space")).toHaveCount(0);
});

test("when the view fails to come after another view was chosen, the switch stays on the view that is drawn", async ({ page }) => {
  await page.route("**/assets/space-*.js", async (route) => {
    await new Promise((done) => setTimeout(done, 700));
    await route.abort();
  });
  await page.goto(linkFor(LONG()));
  await view(page, "3D").click();
  await view(page, "Sequence").click();
  await expect(page.getByRole("status")).toHaveText(/could not be fetched/);
  await expect(view(page, "Sequence")).toHaveAttribute("aria-checked", "true");
  await expect(view(page, "Picture")).toHaveAttribute("aria-checked", "false");
  await expect(page.locator('.map-picture svg[data-picture="sequence"]')).toBeVisible();
});

test("the view is asked for like the app's other pieces: it comes though its load fails until its file is fetched, and pressing 3D after a failure is a new try", async ({ page }) => {
  // A browser does not ask twice for a script that failed (`src/piece.ts`). First, WebKit's fault as it was seen,
  // made to happen here: the script's load fails until its file has been asked for with fetch.
  const asked = { scripts: 0, fetches: 0 };
  await page.route(/\/assets\/space-[^/]*\.js$/, (route) => {
    if (route.request().resourceType() === "fetch") {
      asked.fetches += 1;
      return route.continue();
    }
    asked.scripts += 1;
    return asked.fetches > 0 ? route.continue() : route.abort();
  });
  await page.goto(linkFor(LONG()));
  await view(page, "3D").click();
  await expect(page.locator(".space-scene")).toBeVisible();
  expect(asked.fetches).toBe(1);
  expect(asked.scripts).toBeGreaterThanOrEqual(2);
  await page.unroute(/\/assets\/space-[^/]*\.js$/);

  // Then no connection at all for it, in a page of its own: the switch says so. With the connection back, pressing
  // 3D again asks again, in the same page, and the note goes.
  await page.goto("./");
  await page.route(/\/assets\/space-[^/]*\.js$/, (route) => route.abort());
  await page.goto(linkFor(LONG()));
  await page.evaluate(() => ((window as unknown as { sameTab: boolean }).sameTab = true));
  await view(page, "3D").click();
  await expect(page.getByRole("status")).toHaveText(/could not be fetched/);
  await expect(view(page, "Picture")).toHaveAttribute("aria-checked", "true");
  await page.unroute(/\/assets\/space-[^/]*\.js$/);
  await view(page, "3D").click();
  await expect(page.locator(".space-scene")).toBeVisible();
  await expect(view(page, "3D")).toHaveAttribute("aria-checked", "true");
  await expect(page.getByText(/could not be fetched/)).toHaveCount(0);
  expect(await page.evaluate(() => (window as unknown as { sameTab?: boolean }).sameTab)).toBe(true);
});

test.describe("with the service worker running", () => {
  test.use({ serviceWorkers: "allow" });

  test("a first visit that saw only the front page opens a map in three dimensions with no network", async ({ page, context }) => {
    await page.goto("./");
    await expect(page.locator(".land-headline")).toBeVisible();
    await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
    await expect.poll(() => page.evaluate(async () => (await (await caches.open("grooph-app-v1")).keys()).filter((r) => /\/assets\/space-[^/]*\.js$/.test(r.url)).length)).toBe(1);

    await context.setOffline(true);
    const failed: string[] = [];
    page.on("requestfailed", (r) => failed.push(r.url()));
    await open(page);
    await expect(page.locator(".space [data-handoff]")).toHaveCount(19);
    expect(failed).toEqual([]);
  });
});

test.describe("from 1100 px", () => {
  test.use({ viewport: { width: 1440, height: 900 }, isMobile: false, hasTouch: false, deviceScaleFactor: 1 });

  test("the list beside it is the same list: a line picks its arc and moves the slider, and a lane's cards stand in one row", async ({ page }) => {
    const map = LONG();
    await open(page, map);
    const side = page.getByRole("complementary", { name: "Handoffs" });
    await expect(side.getByRole("button")).toHaveCount(19);
    // Six cards across where there is room: the Mac's lane is one row.
    const tops = await page.locator(".space-card").evaluateAll((els) => els.map((el) => (el as HTMLElement).style.transform));
    expect(new Set(tops.slice(1, 7).map((t) => /translate3d\([^,]+,[^,]+,([^)]+)\)/.exec(t)![1])).size).toBe(1);

    await side.getByRole("button").nth(4).hover();
    await expect(page.locator(`.space [data-handoff="${map.handoffs[4]!.id}"]`)).toHaveClass(/is-hot/);
    await side.getByRole("button").nth(4).click();
    await expect(sheet(page).getByRole("heading", { name: "Handoff 5" })).toBeVisible();
    await expect(page.locator(`.space [data-handoff="${map.handoffs[4]!.id}"]`)).toHaveClass(/is-on/);
    await expect(slider(page)).toHaveValue("5");
    // Opening the details narrowed the stage; the scene was fitted again and nothing scrolled inside its frame.
    expect(await page.locator(".space-scene").evaluate((el) => [el.scrollLeft, el.scrollTop])).toEqual([0, 0]);

    // The slider moved on by hand stays where it was put when a line of the list is pointed at, the open one included.
    for (let k = 0; k < 3; k++) await page.getByRole("button", { name: "Next handoff" }).click();
    await expect(slider(page)).toHaveValue("8");
    const lines = page.locator(".map-list .map-handoff-line");
    await lines.nth(4).hover();
    await lines.nth(1).hover();
    await expect(page.locator(`.space [data-handoff="${map.handoffs[1]!.id}"]`)).toHaveClass(/is-hot/);
    await expect(slider(page)).toHaveValue("8");
    // The line pointed at is the heavier, and in three dimensions it is the slider that dims: nothing is dimmed twice.
    expect(await page.locator(`.space [data-handoff="${map.handoffs[1]!.id}"] > path`).first().evaluate((el) => getComputedStyle(el).strokeWidth)).toBe("3.4px");
    expect(await page.locator(`.space [data-handoff="${map.handoffs[1]!.id}"]`).evaluate((el) => getComputedStyle(el).opacity)).toBe("1");
    expect(await page.locator('.space-arc[data-arc="1"]').evaluate((el) => getComputedStyle(el).opacity)).toBe("0.5");
  });

  test("a scene drawn again for a new room gives the keyboard back to the scene, the slider or the button that had it", async ({ page }) => {
    await open(page);
    const drawn = () => page.locator(".space").evaluate((el) => ((el as unknown as { seen?: number }).seen ??= Math.random()));
    for (const part of [".space-scene", ".space input", '.space [data-do="next"]']) {
      await page.setViewportSize({ width: 1440, height: 900 });
      await expect(page.locator(".space-card").first()).toBeVisible();
      const before = await drawn();
      await page.locator(part).focus();
      // A narrower room holds four cards in a row and not six: the scene is new markup.
      await page.setViewportSize({ width: 1150, height: 900 });
      await expect.poll(drawn).not.toBe(before);
      await expect(page.locator(part)).toBeFocused();
    }
  });

  test("the wheel scrolls the page until the scene has been picked, and then moves in and out", async ({ page }) => {
    await open(page);
    const start = await posed(page);
    const box = (await page.locator(".space-scene").boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.wheel(0, 120);
    await page.waitForTimeout(200);
    expect(await posed(page)).toBe(start);
    await page.locator(".space-scene").focus();
    await page.mouse.wheel(0, -240);
    await expect.poll(() => sized(page)).toBeGreaterThan(1);
  });
});
