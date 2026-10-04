/**
 * What the picture of a graph with subgroophs is handed when it is called (`graph-units.ts`): the plain picture, the
 * ranking, the glyph, and the picture's tools. `map-kit.ts` says why a view behind a door of its own is handed its
 * parts and does not import them, and why the kit is a list.
 *
 * `index.ts` binds it, for Node. The file the web app starts from does not export it: naming the glyph here would
 * put the glyph in the file an embed loads, which draws none (2.5 KB compressed, measured). A page that draws this
 * picture in a browser hands in the parts it has.
 */
import { glyph } from "../glyph.js";
import { layerNodes } from "../layout.js";
import { picture } from "./graph-picture.js";
import { rect, text, truncate } from "./svg.js";

export const unitsKit = [picture, layerNodes, glyph, rect, text, truncate] as const;

export type UnitsKit = typeof unitsKit;
