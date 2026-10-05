/**
 * Core, whole: `base.ts`, the compiler, an operation map's other views, and a graph's picture with its subgroophs
 * as boxes. See `base.ts` for why the compiler is a file of its own, and `picture/map-views.ts` for why the views
 * are. Here the views have their parts already.
 */
import { pictureWithUnits, type UnitsOptions } from "./picture/graph-units.js";
import { unitsKit } from "./picture/units-kit.js";
import { mapKit } from "./picture/map-kit.js";
import { mapSequenceWith, mapWideWith } from "./picture/map-views.js";
import type { MapPictureOptions, PictureOptions } from "./picture/svg.js";
import type { Graph, OperationMap } from "./types.js";

export * from "./base.js";
export { compile, tryCompile, CompileError } from "./compile/index.js";
// Placing and refreshing a subgrooph, and what a group holds: not on the web app's way in (`groups.ts` says why).
export * from "./subgrooph.js";
// Adoption held to the graph's brakes: it brings the same comparison, and is not on the web app's way in either.
export * from "./adoption.js";
export { mapSequenceWith, mapWideWith, pictureWithUnits, unitsKit, type UnitsOptions };
export type { UnitsKit } from "./picture/units-kit.js";

/**
 * A graph's picture (docs/exports.md). A subgrooph is one box, closed unless `open` names it; a graph with none is
 * drawn as `base.ts`'s picture draws it, byte for byte.
 */
export const picture = (doc: Graph, options: UnitsOptions = {}): string => pictureWithUnits(unitsKit, doc, options);
// The picture's themes, a door of their own (`picture/themes.ts`): here they are simply there.
export { PICTURE_THEMES, THEME_VALUES, isPictureTheme, readTheme, themeParts, themed, themedPage, type PictureThemeName, type ThemeValues } from "./picture/themes.js";

/** An operation map with its lanes side by side (docs/operation-map.md §4c). `width`, when given, is the room there is. */
export const mapWide = (map: OperationMap, options: MapPictureOptions = {}): string => mapWideWith(mapKit, map, options);
/** An operation map as a sequence (docs/operation-map.md §4d): a row for each handoff, in the map's order. */
export const mapSequence = (map: OperationMap, options: PictureOptions = {}): string => mapSequenceWith(mapKit, map, options);
