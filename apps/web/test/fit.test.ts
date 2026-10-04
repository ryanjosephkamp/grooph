import { describe, expect, test } from "vitest";

import { EDITOR_PAD, READABLE_ZOOM, RUN_PAD, openingViewport } from "../src/ui/canvas/fit.js";

const phone = { width: 390, height: 780 };

describe("the opening view (review 2026-10)", () => {
  test("a graph that fits at a readable size opens whole", () => {
    // Four nodes stacked: 200 wide, 404 tall.
    const view = openingViewport({ x: -100, y: 0, width: 200, height: 404 }, phone, EDITOR_PAD);
    expect(view.fits).toBe(true);
    expect(view.zoom).toBe(1);
  });

  test("a wide layout opens at half size from its left edge, centered on the axis that fits", () => {
    // The review-loop fixture's own layout: about 1,000 px in a row, which fitted is 0.35.
    const bounds = { x: 40, y: 200, width: 1000, height: 84 };
    const view = openingViewport(bounds, phone, EDITOR_PAD);
    expect(view.fits).toBe(false);
    expect(view.zoom).toBe(READABLE_ZOOM);
    // The left edge sits at the side padding; the row is centered between the legend and the toolbar.
    expect(bounds.x * view.zoom + view.x).toBe(EDITOR_PAD.x);
    const top = bounds.y * view.zoom + view.y;
    const room = phone.height - EDITOR_PAD.top - EDITOR_PAD.bottom;
    expect(top).toBe(EDITOR_PAD.top + (room - bounds.height * view.zoom) / 2);
  });

  test("a tall graph in a short canvas opens from its top", () => {
    // Eight rows in the run view's 42% canvas.
    const bounds = { x: -218, y: 0, width: 436, height: 1204 };
    const view = openingViewport(bounds, { width: 390, height: 330 }, RUN_PAD);
    expect(view.fits).toBe(false);
    expect(view.zoom).toBe(READABLE_ZOOM);
    expect(bounds.y * view.zoom + view.y).toBe(RUN_PAD.top);
    // 218 px of graph in 366 px of room: centered.
    expect(bounds.x * view.zoom + view.x).toBe(RUN_PAD.x + (366 - 218) / 2);
  });

  test("a graph a little too big still opens whole: the floor is for the unreadable, not the snug", () => {
    const view = openingViewport({ x: 0, y: 0, width: 600, height: 300 }, phone, EDITOR_PAD);
    expect(view.fits).toBe(true);
    expect(view.zoom).toBeCloseTo(350 / 600);
  });
});
