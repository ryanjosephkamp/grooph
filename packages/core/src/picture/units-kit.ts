/**
 * What the picture of a graph with subgroophs is handed when it is called (`graph-units.ts`): the plain picture, the
 * ranking, the glyph, and the picture's tools. It is part of core's first door (`base.ts` exports it as `unitsKit`).
 *
 * `map-kit.ts` says why a view behind a door of its own is handed its parts and does not import them, and why the
 * kit is a list.
 */
import { glyph } from "../glyph.js";
import { layerNodes } from "../layout.js";
import { picture } from "./graph-picture.js";
import { rect, text, truncate } from "./svg.js";

export const unitsKit = [picture, layerNodes, glyph, rect, text, truncate] as const;

export type UnitsKit = typeof unitsKit;
