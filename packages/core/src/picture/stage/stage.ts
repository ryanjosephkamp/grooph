/**
 * A graph's views in three dimensions, behind a door of their own: what every view is worked out
 * from (`model.ts`), the shapes they share (`shapes.ts`), and Panes and the spiral. Rings and Columns are behind
 * another (`more.ts`), and import only types: they are handed the shapes they draw with.
 *
 * The web app's stage (`apps/web/src/ui/canvas/graph-stage.tsx`) is a piece fetched when one of these views is
 * chosen, and comes through this door; nothing `base.ts` reaches leads here, so no other address carries it. In
 * Node there is no door: `index.ts` draws a still of any of them (`still.ts`).
 */
export * from "./model.js";
export * from "./shapes.js";
export * from "./panes.js";
export { brakes, spiral, SPIRAL_START, topOf } from "./spiral.js";
export { extent, inset, outside } from "./trim.js";
export type { Look, Prim } from "./prim.js";
