/**
 * Core, whole: `base.ts`, the compiler, and an operation map's other views. See `base.ts` for why the compiler is a
 * file of its own, and `picture/map-views.ts` for why the views are. Here the views have their parts already.
 */
import { mapKit } from "./picture/map-kit.js";
import { mapSequenceWith, mapWideWith } from "./picture/map-views.js";
import type { MapPictureOptions, PictureOptions } from "./picture/svg.js";
import type { OperationMap } from "./types.js";

export * from "./base.js";
export { compile, tryCompile, CompileError, keptFolder } from "./compile/index.js";
export { mapSequenceWith, mapWideWith };

/** An operation map with its lanes side by side (docs/operation-map.md §4c). `width`, when given, is the room there is. */
export const mapWide = (map: OperationMap, options: MapPictureOptions = {}): string => mapWideWith(mapKit, map, options);
/** An operation map as a sequence (docs/operation-map.md §4d): a row for each handoff, in the map's order. */
export const mapSequence = (map: OperationMap, options: PictureOptions = {}): string => mapSequenceWith(mapKit, map, options);
