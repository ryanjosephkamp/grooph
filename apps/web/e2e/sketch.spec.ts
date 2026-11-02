import { expect, test, type Page } from "@playwright/test";

/**
 * The Sketch view (src/ui/sketch/): Sketch, left of Picture and 3D over a graph, where the graph is drawn by hand and
 * the drawing made the graph. The strokes here are the mouse's; a pen and a finger reach the drawing as the same
 * pointer events.
 */

type P = [number, number];
/** A line drawn by hand, a point every few pixels. */
const line = (a: P, b: P): P[] => {
  const n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 4));
  return Array.from({ length: n + 1 }, (_, i): P => [a[0] + ((b[0] - a[0]) * i) / n, a[1] + ((b[1] - a[1]) * i) / n]);
};
const path = (...pts: P[]): P[] => pts.slice(1).flatMap((b, i) => line(pts[i]!, b).slice(i ? 1 : 0));
const box = (x: number, y: number, w: number, h: number): P[] => path([x, y], [x + w, y], [x + w, y + h], [x, y + h], [x, y + 4]);

const drawing = (page: Page) => page.getByLabel(/^Drawing area/);
const view = (page: Page, name: string) => page.getByRole("radiogroup", { name: "View of the graph" }).getByRole("radio", { name });
const go = (page: Page) => page.getByRole("button", { name: /^Make it a graph/ });
const said = (page: Page) => page.locator("#sk-read");
const steps = (page: Page) => page.locator("#sk-diagram [data-node]");

/** Draw one stroke on the drawing, at points measured from its top left corner. */
async function stroke(page: Page, pts: P[]): Promise<void> {
  const at = (await drawing(page).boundingBox())!;
  await page.mouse.move(at.x + pts[0]![0], at.y + pts[0]![1]);
  await page.mouse.down();
  for (const [x, y] of pts.slice(1)) await page.mouse.move(at.x + x, at.y + y);
  await page.mouse.up();
}

/** Two boxes, one over the other, and an arrow from the first to the second. */
async function twoSteps(page: Page): Promise<void> {
  await stroke(page, box(60, 40, 160, 70));
  await stroke(page, box(60, 220, 160, 70));
  await stroke(page, path([140, 116], [140, 214]));
  await stroke(page, path([132, 204], [140, 214], [148, 204]));
}

/** Sketch it on the front page: a new graph, opened on its drawing. */
async function newSketch(page: Page): Promise<void> {
  await page.goto("./");
  await page.getByRole("button", { name: /^Sketch it/ }).click();
  await expect(page).toHaveURL(/#\/g\/[^?]+\?sketch$/);
  await expect(drawing(page)).toBeVisible();
}

/** A graph made from the Review gate template: a builder, a critic, a person's gate, and a stop, with a loop. */
async function reviewGate(page: Page): Promise<void> {
  await page.goto("./#/templates/built-in/review-gate/use");
  await page.getByRole("button", { name: "Create graph" }).tap();
  await expect(page.locator(".react-flow__node")).toHaveCount(4);
}

test("Sketch it opens a new graph on its drawing, and boxes and an arrow drawn by hand make the graph, shown under the drawing, which stays", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await newSketch(page);
  await expect(view(page, "Sketch")).toHaveAttribute("aria-checked", "true");
  await twoSteps(page);
  await go(page).tap();
  await expect(said(page)).toContainText("Read 2 shapes (2 boxes) · 1 arrow. Made the graph: 2 new steps.");
  await expect(drawing(page)).toBeVisible();
  await expect(steps(page)).toHaveCount(2);
  await expect(page.locator("#sk-guesses")).toContainText("Node 1: a box, so an agent with the builder role");
  await expect(page.getByRole("button", { name: "Undo Make it a graph" })).toBeVisible();

  // The same graph on the canvas, and the drawing again when Sketch is chosen again, and after the page is loaded again.
  await view(page, "Picture").tap();
  await expect(page).not.toHaveURL(/\?sketch$/);
  await expect(page.locator(".react-flow__node")).toHaveCount(2);
  await expect(page.locator(".react-flow__edge")).toHaveCount(1);
  await expect(page.getByRole("toolbar", { name: "Canvas" })).toBeVisible();
  // The drawing, put away, is told of nothing more.
  await page.waitForTimeout(300);
  expect(errors).toEqual([]);
  await view(page, "Sketch").tap();
  await expect(page.getByRole("toolbar", { name: "Canvas" })).toBeHidden();
  await expect(said(page)).toContainText("Read 2 shapes");
  // Once the graph is saved, as it is a moment after each change.
  await expect(page.locator(".topbar")).not.toContainText("saving");
  await page.reload();
  await expect(said(page)).toContainText("Read 2 shapes");
  await expect(steps(page)).toHaveCount(2);
  await expect(page.getByRole("button", { name: "Clear the drawing" })).toBeEnabled();
});

test("a graph made from a template opens drawn, and a step renamed in Names keeps all else it was", async ({ page }) => {
  await reviewGate(page);
  await view(page, "Sketch").tap();
  await expect(said(page)).toContainText("Read 4 shapes (1 box, 1 diamond, 1 trapezoid, 1 double circle) · 5 arrows · 1 loop.");
  // Made from the drawing as it opened, the graph is as it was, and there is nothing to undo.
  await go(page).tap();
  await expect(said(page)).toContainText("Made the graph: 4 kept.");
  await expect(page.getByRole("button", { name: "Undo Make it a graph" })).toBeHidden();
  await page.getByLabel("Name for B, diamond").fill("Reviewer");
  await go(page).tap();
  await expect(said(page)).toContainText("Made the graph: 4 kept.");
  await expect(page.locator('#sk-diagram [data-node="critic"]')).toContainText("Reviewer");
  await expect(page.locator('#sk-diagram [data-node="critic"]')).toContainText("critic · strong · high");
  await expect(page.getByRole("button", { name: "Undo Make it a graph" })).toBeVisible();
  // Nothing was guessed: every step was the graph's already.
  await expect(page.locator("#sk-guesses")).toBeHidden();
});

test("a step renamed in its sheet keeps the drawing, which takes the new name, and Make it a graph keeps the step", async ({ page }) => {
  await reviewGate(page);
  await view(page, "Sketch").tap();
  await expect(said(page)).toContainText("Read 4 shapes");
  await page.locator('#sk-diagram [data-node="critic"]').tap();
  await page.getByRole("textbox", { name: "Name", exact: true }).fill("Reviewer");
  // Its id follows its name; the drawing is not drawn again, and its strokes stand for the renamed step.
  await expect(page.locator('#sk-diagram [data-node="reviewer"]')).toBeVisible();
  await expect(said(page)).not.toContainText("The graph changed");
  await expect(page.getByLabel("Name for B, diamond")).toHaveValue("Reviewer");
  await go(page).tap();
  await expect(said(page)).toContainText("Made the graph: 4 kept.");
  await expect(page.locator('#sk-diagram [data-node="reviewer"]')).toContainText("critic · strong · high");
});

test("a name typed after Make it a graph changes the graph as it is typed, and Undo Make it a graph takes the graph back while the drawing stays", async ({ page }) => {
  await newSketch(page);
  await twoSteps(page);
  await go(page).tap();
  await page.getByLabel("Name for A, box").fill("Plan");
  await expect(steps(page).first()).toContainText("Plan");
  await page.getByRole("button", { name: "Undo Make it a graph" }).tap();
  await expect(page.locator("#sk-diagram")).toContainText("The graph appears here after Make it a graph.");
  await expect(said(page)).toContainText("The graph is as it was before Make it a graph.");
  await expect(page.getByRole("button", { name: "Clear the drawing" })).toBeEnabled();
  // The editor's own Undo brings the graph the drawing made back.
  await view(page, "Picture").tap();
  await expect(page.locator(".react-flow__node")).toHaveCount(0);
  await page.getByRole("toolbar", { name: "Canvas" }).getByRole("button", { name: "Undo" }).tap();
  await expect(page.locator(".react-flow__node")).toHaveCount(2);
});

test("a graph changed on the canvas is drawn again when Sketch is next chosen, and Undo brings back the drawing", async ({ page }) => {
  await newSketch(page);
  await twoSteps(page);
  await go(page).tap();
  await view(page, "Picture").tap();
  await page.getByRole("toolbar", { name: "Canvas" }).getByRole("button", { name: "Add" }).tap();
  await page.getByRole("button", { name: /^Agent/ }).first().tap();
  await expect(page.locator(".react-flow__node")).toHaveCount(3);
  await view(page, "Sketch").tap();
  await expect(said(page)).toContainText("The graph has changed since you last drew it");
  await expect(page.locator("#sk-diagram [data-node]")).toHaveCount(3);
  await page.getByRole("button", { name: "Undo", exact: true }).tap();
  await go(page).tap();
  // The drawing from before has two steps; made the graph again, it takes the one added on the canvas away.
  await expect(said(page)).toContainText("Read 2 shapes");
  await expect(said(page)).toContainText("1 taken away");
});

test("the Add menu adds a step, an arrow, and a template, chosen so they can be dragged into place", async ({ page }) => {
  await newSketch(page);
  await page.getByRole("button", { name: "Add a step, an arrow, or a template" }).tap();
  const menu = page.getByRole("menu", { name: "Add" });
  await expect(menu.getByRole("menuitem", { name: "Critic" })).toBeVisible();
  await expect(menu.getByRole("menuitem", { name: "Review gate" })).toBeVisible();
  // A state diagram is no graph, so mermaidify's state diagram templates are not offered.
  await expect(menu.getByRole("menuitem", { name: "A traffic light" })).toHaveCount(0);
  await menu.getByRole("menuitem", { name: "Review gate" }).tap();
  await expect(page.getByRole("toolbar", { name: "Chosen strokes" })).toBeVisible();
  await go(page).tap();
  await expect(said(page)).toContainText("Made the graph: 4 new steps.");
  await expect(page.locator("#sk-diagram")).toContainText("Merge approval");
});

test("a pen seen keeps fingers for moving the drawing, and Let fingers draw puts that away", async ({ page }) => {
  await newSketch(page);
  const at = (await drawing(page).boundingBox())!;
  await drawing(page).dispatchEvent("pointermove", { pointerType: "pen", pointerId: 7, buttons: 0, clientX: at.x + 50, clientY: at.y + 50, isPrimary: true });
  const chip = page.getByText("Pen draws; fingers move the drawing.");
  await expect(chip).toBeVisible();
  await page.getByRole("button", { name: "Let fingers draw" }).tap();
  await expect(chip).toBeHidden();
});

test("when the drawing can't be fetched, the view says so and the picture stays; with the connection back, Sketch opens it", async ({ page }) => {
  await page.route(/\/assets\/SketchView-[\w-]+\.js$/, (route) => route.abort());
  await page.goto("./");
  await page.getByRole("button", { name: /^Sketch it/ }).tap();
  await expect(page.getByRole("status").filter({ hasText: "The drawing could not be fetched" })).toBeVisible();
  await expect(view(page, "Picture")).toHaveAttribute("aria-checked", "true");
  await page.unroute(/\/assets\/SketchView-[\w-]+\.js$/);
  await view(page, "Sketch").tap();
  await expect(drawing(page)).toBeVisible();
});

for (const screen of [
  { width: 375, height: 812, what: "a phone upright" },
  { width: 320, height: 568, what: "a small phone upright" },
  { width: 740, height: 360, what: "a phone on its side" },
  { width: 568, height: 320, what: "a small phone on its side" },
]) {
  test.describe(`on ${screen.what} (${screen.width} by ${screen.height})`, () => {
    test.use({ viewport: { width: screen.width, height: screen.height } });

    test("the tools, the drawing, and Make it a graph are on the screen together, and nothing runs off its side", async ({ page }) => {
      await newSketch(page);
      // Upright, all at once; on its side, once the view is scrolled past the switch, as mermaidify's page is.
      await go(page).scrollIntoViewIfNeeded();
      await expect(go(page)).toBeInViewport({ ratio: 1 });
      await expect(page.getByRole("button", { name: "Add a step, an arrow, or a template" })).toBeInViewport({ ratio: 1 });
      const at = (await drawing(page).boundingBox())!;
      expect(at.height).toBeGreaterThan(140);
      if (screen.height > screen.width) expect(at.y + 60).toBeLessThan(screen.height);
      const wide = await page.locator(".graph-sketch").evaluate((el) => el.scrollWidth - el.clientWidth);
      expect(wide).toBeLessThanOrEqual(0);
      // Full screen gives the drawing the window, and leaves the line of what was read in sight.
      await page.getByRole("button", { name: "Full screen" }).tap();
      const full = (await drawing(page).boundingBox())!;
      expect(full.height).toBeGreaterThan(at.height);
      await expect(said(page)).toBeInViewport();
      await expect(go(page)).toBeInViewport({ ratio: 1 });
    });
  });
}

test.describe("on a computer's keyboard", () => {
  test.use({ viewport: { width: 1280, height: 800 }, isMobile: false, hasTouch: false, deviceScaleFactor: 1 });

  test("Ctrl+Z takes back a stroke, not the graph's last change, and F and Escape go into full screen and out", async ({ page }) => {
    await newSketch(page);
    await twoSteps(page);
    await page.keyboard.press("Control+Enter");
    await expect(said(page)).toContainText("Made the graph: 2 new steps.");
    await stroke(page, box(300, 40, 120, 60));
    await page.keyboard.press("Control+z");
    // The box is gone from the drawing; the graph still has its two steps.
    await expect(page.locator("#sk-go")).toHaveAttribute("data-stale", "true");
    await expect(steps(page)).toHaveCount(2);
    await view(page, "Picture").click();
    await expect(page.locator(".react-flow__node")).toHaveCount(2);
    await view(page, "Sketch").click();

    await page.locator("body").click({ position: { x: 5, y: 5 } });
    await page.keyboard.press("f");
    await expect(page.locator(".sk")).toHaveClass(/is-full/);
    await expect(page.locator(".topbar")).toHaveJSProperty("inert", true);
    // Escape puts away what was read first, as mermaidify's does, and then leaves full screen.
    await expect(drawing(page)).toHaveAttribute("data-read", "");
    await page.keyboard.press("Escape");
    await expect(drawing(page)).not.toHaveAttribute("data-read");
    await expect(page.locator(".sk")).toHaveClass(/is-full/);
    await page.keyboard.press("Escape");
    await expect(page.locator(".sk")).not.toHaveClass(/is-full/);
    await expect(page.locator(".topbar")).toHaveJSProperty("inert", false);
  });

  test("Ctrl+Z (Cmd+Z on a Mac) in a name field takes back what was typed there, and the field keeps the focus", async ({ page }) => {
    await newSketch(page);
    await twoSteps(page);
    await go(page).click();
    const field = page.getByLabel("Name for A, box");
    await field.click();
    await page.keyboard.type("Plan");
    await expect(steps(page).first()).toContainText("Plan");
    // Cmd on a Mac, Ctrl elsewhere: the browser's own undo of the typing.
    await page.keyboard.press("ControlOrMeta+z");
    await expect(field).toBeFocused();
    await expect(field).toHaveValue("");
    await expect(steps(page)).toHaveCount(2);
  });

  test("Space presses a button that has the focus, and moves the drawing only with the pointer over it", async ({ page }) => {
    await newSketch(page);
    await page.locator("#sk-hint-example").focus();
    await page.keyboard.press(" ");
    await expect(page.getByRole("button", { name: "Clear the drawing" })).toBeEnabled();

    // Over the drawing, Space held makes a drag move it, and draws nothing.
    const at = (await drawing(page).boundingBox())!;
    await page.mouse.move(at.x + 40, at.y + 40);
    await page.mouse.move(at.x + 50, at.y + 50);
    await page.keyboard.down(" ");
    await expect(drawing(page)).toHaveAttribute("data-space", "");
    await page.keyboard.up(" ");
    await expect(drawing(page)).not.toHaveAttribute("data-space");
    // Off the drawing, Space presses the button with the focus again.
    await page.mouse.move(at.x + at.width / 2, at.y - 60);
    await page.getByRole("button", { name: "Clear the drawing" }).focus();
    await page.keyboard.press(" ");
    await expect(page.getByRole("button", { name: "Clear the drawing" })).toBeDisabled();
  });
});
