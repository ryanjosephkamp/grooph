/**
 * Core without the compiler. The web app starts from this file and fetches the compiler when a person exports
 * (slice 0070); everything else starts from `index.ts`, which is this and the compiler.
 *
 * A bundler follows a file's imports whether or not their names are used, so the compiler has to be absent from
 * the file the app starts from, not merely unused there. A new export goes here unless it needs the compiler.
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
export { KNOWN_TARGETS, getProfile, hasProfile, type TargetProfile } from "./targets/index.js";
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
export { picture } from "./picture/graph-picture.js";
export { PICTURE_WIDTH, type MapPictureOptions, type PictureOptions, type PictureTheme } from "./picture/svg.js";
export * from "./outline.js";
export { offlinePage, type OfflinePageOptions } from "./offline.js";
export * from "./events.js";
