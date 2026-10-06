/**
 * What a plan's maker is handed when it is called (`plan.ts`): the parts of core it validates, outlines, draws and
 * writes a document with. `offline-kit.ts` and `picture/map-kit.ts` say why a piece the web app fetches on its own
 * is handed its parts and does not import them: with plain imports the plan's maker cut the file every address
 * loads into seven, and cost every first load 2.9 KB compressed (measured, slice 0100).
 *
 * A list and not a record, so that it adds no names to the file every address loads. `plan.ts` gives the parts
 * their names back, in this order: the canonical form, the outline, the outline as Markdown, the validator, and
 * the picture of a graph as SVG.
 *
 * The picture is whoever calls it's to choose. `index.ts`, for Node and the CLI, hands the picture that draws a
 * subgrooph as one box (`picture/graph-units.ts`). The web app hands the picture it draws everywhere else
 * (`picture/graph-picture.ts`), which for a graph with no subgrooph is the same bytes.
 */
import type { canonicalize } from "./canonicalize.js";
import type { outline, outlineMarkdown } from "./outline.js";
import type { Graph } from "./types.js";
import type { validate } from "./validate.js";

export type PlanKit = readonly [typeof canonicalize, typeof outline, typeof outlineMarkdown, typeof validate, (doc: Graph) => string];
