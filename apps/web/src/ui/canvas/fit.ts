import type { FitViewOptions } from "@xyflow/react";

/** Room, in CSS px, for what floats over a canvas. */
export type Pad = { top: number; bottom: number; x: number };

/**
 * Room for what floats over the canvas: the loop legend or mode banner on top,
 * the toolbar at the bottom. Nodes fitted into view land clear of both.
 */
export const EDITOR_PAD: Pad = { top: 72, bottom: 92, x: 20 };
/** The link and template viewers keep room for their bottom bar. */
export const VIEWER_PAD: Pad = { top: 64, bottom: 100, x: 20 };
/** The run view has no bar, and its canvas is shorter. */
export const RUN_PAD: Pad = { top: 56, bottom: 12, x: 12 };

export const fitOptions = (pad: Pad): FitViewOptions => ({ padding: { top: `${pad.top}px`, bottom: `${pad.bottom}px`, x: `${pad.x}px` }, maxZoom: 1 });

export const FIT: FitViewOptions = fitOptions(EDITOR_PAD);

/**
 * The smallest size a canvas opens at. Below about half size a node's name is
 * under 7 px on a phone and nothing can be read without a pinch (the
 * review-loop fixture's own layout opened at 0.33 on a 390 px screen, and an
 * eight-node template at 0.21 above its sheet: review 2026-10).
 */
export const READABLE_ZOOM = 0.5;

export type Rect = { x: number; y: number; width: number; height: number };
export type Viewport = { x: number; y: number; zoom: number };

/**
 * Where a canvas opens. When the whole graph fits at a readable size, that is
 * the view (`fits`, and the caller keeps the ordinary fit). Otherwise the
 * graph opens at `READABLE_ZOOM` with its start in view: the left edge when it
 * is too wide, the top when it is too tall, centred on the axis that fits.
 * The rest is a drag away, and the whole of it one tap (Fit, or Show all).
 */
export function openingViewport(bounds: Rect, stage: { width: number; height: number }, pad: Pad): Viewport & { fits: boolean } {
  const roomX = Math.max(1, stage.width - 2 * pad.x);
  const roomY = Math.max(1, stage.height - pad.top - pad.bottom);
  const fit = Math.min(roomX / Math.max(1, bounds.width), roomY / Math.max(1, bounds.height), 1);
  const zoom = Math.max(fit, READABLE_ZOOM);
  const along = (start: number, size: number, room: number, lead: number): number =>
    size * zoom > room ? lead - start * zoom : lead + (room - size * zoom) / 2 - start * zoom;
  return { x: along(bounds.x, bounds.width, roomX, pad.x), y: along(bounds.y, bounds.height, roomY, pad.top), zoom, fits: fit >= READABLE_ZOOM };
}
