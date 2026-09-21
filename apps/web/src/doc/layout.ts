/**
 * Automatic layout for documents without `layout` (amendment A-005): what an
 * agent-built graph looks like when it first opens. The algorithm lives in
 * core since slice 0015 (`autoLayout`, `resolvePositions`), so the glyph and
 * the canvas agree; this module keeps the app's node sizes and the phone rule.
 * Positions computed here are view state; they reach the document only when
 * the user moves a node or saves the layout.
 */
import { DEFAULT_LAYOUT_BOX, autoLayout as coreAutoLayout, resolvePositions as coreResolvePositions, type Graph, type Id, type LayoutBox, type Position } from "@grooph/core";

export type { LayoutBox } from "@grooph/core";

export const NODE_WIDTH = DEFAULT_LAYOUT_BOX.width;
export const NODE_HEIGHT = DEFAULT_LAYOUT_BOX.height;

/** The editor's node. */
export const FULL_BOX: LayoutBox = DEFAULT_LAYOUT_BOX;

/**
 * How many nodes sit side by side before a row wraps: two on a phone held
 * upright, four on anything wider. A row of unconnected nodes is otherwise one
 * long line a phone can only show zoomed out to illegibility.
 */
export function columnsForViewport(): number {
  return typeof window !== "undefined" && window.innerWidth < 640 ? 2 : 4;
}

/** A position for every node, whether or not the document carries one. */
export const autoLayout = (doc: Graph, columns = 4, box: LayoutBox = FULL_BOX): Record<Id, Position> => coreAutoLayout(doc, columns, box);

/**
 * The position of every node on the canvas: the document's layout where it
 * has one; otherwise automatic. Nodes missing from a partial layout are laid
 * out automatically and set below what is already placed, so nothing overlaps.
 */
export const resolvePositions = (doc: Graph, columns = columnsForViewport()): { positions: Record<Id, Position>; unplaced: Id[] } =>
  coreResolvePositions(doc, columns, FULL_BOX);
