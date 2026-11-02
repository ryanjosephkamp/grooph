/**
 * Rings and Columns, behind a door beside the stage's (`stage.ts`): the web app fetches them in a
 * piece of their own when either is chosen (`apps/web/src/ui/canvas/graph-more.tsx`). Both import only types and
 * are handed the stage's shapes, so fetching them moves nothing else.
 */
export { rings, RINGS_START } from "./rings.js";
export { blocks, columns, COLUMNS_START, MINUTE, TIER } from "./columns.js";
