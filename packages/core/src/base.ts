/**
 * Core without the compiler, without an operation map's other views, and without the views of a subgrooph. The web
 * app starts from this file. It fetches the compiler when a person exports (slice 0070), the map's views when a map
 * is drawn (slice 0080, `picture/map-views.ts`), and a subgrooph's when a graph has one (slice 0085,
 * `picture/graph-units.ts`); everything else starts from `index.ts`, which is all four. Decision 0021 was written
 * when there were two doors.
 *
 * A bundler follows a file's imports whether or not their names are used, so the compiler has to be absent from
 * the file the app starts from, not merely unused there. A new export goes here unless it needs the compiler, or
 * is something only one kind of address shows: that is a door of its own.
 */
export * from "./types.js";
export * from "./issues.js";
export { parseGraph, parseGraphText, type ParseResult } from "./parse.js";
export { canonicalize, canonicalizeWithoutLayout } from "./canonicalize.js";
export { validate, DOC_SIZE_LIMIT, type ValidateOptions } from "./validate.js";
export type { CompileOptions, CompileResult, CompileTarget } from "./compile/index.js";
export { graphSchema, graphJsonSchema, SCHEMA_ID } from "./schema/graph.js";
export { indexGraph, type GraphIndex } from "./graph-index.js";
export * from "./semantics.js";
// The targets by name. Their profiles are the compiler's and come with it (`targets/names.ts` says why).
export { KNOWN_TARGETS, hasProfile, targetTitle } from "./targets/names.js";
export type { TargetProfile } from "./targets/index.js";
export * from "./ops/index.js";
export * from "./template.js";
export { closest, didYouMean } from "./suggest.js";
export * from "./proposals.js";
export * from "./share.js";
export { proposalSetSchema, proposalsJsonSchema, PROPOSALS_SCHEMA_ID } from "./schema/proposals.js";
export * from "./runs.js";
export * from "./replay.js";
export { autoLayout, layerNodes, resolvePositions, DEFAULT_LAYOUT_BOX, type LayoutBox } from "./layout.js";
export { glyph, type GlyphOptions } from "./glyph.js";
export { mermaid } from "./mermaid.js";
export { runBundleSchema, runJsonSchema, RUN_SCHEMA_ID } from "./schema/run.js";
export * from "./map.js";
export { mapSchema, mapJsonSchema, MAP_SCHEMA_ID } from "./schema/map.js";
export { mapPicture, handoffNumbers, CARRIER_STYLE } from "./picture/map-picture.js";
export { mapKit, type MapKit } from "./picture/map-kit.js";
export { picture, type Face, type PictureView } from "./picture/graph-picture.js";
export { PICTURE_WIDTH, type MapPictureOptions, type PictureOptions, type PictureTheme } from "./picture/svg.js";
export * from "./outline.js";
export { offlinePage, type OfflinePageOptions } from "./offline.js";
export * from "./events.js";
