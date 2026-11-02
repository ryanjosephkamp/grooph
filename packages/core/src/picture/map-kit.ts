/**
 * What an operation map's other views are handed when they are called: the parts every view of a map draws the same
 * way, and the picture's tools. It is part of core's first door (`base.ts` exports it as `mapKit`).
 *
 * The views do not import these themselves, because of how they are fetched. The web app loads them as a piece of
 * its own, only when a map is drawn (`map-views.ts`). A bundler puts what two pieces share into a file of its own,
 * and when the views imported the parts it cut the file the whole app loads in two, which cost every address 2.5 KB
 * compressed, the ones that draw no map included. A piece that imports nothing changes nothing else: so the views
 * import only types, and whoever calls them hands them this.
 *
 * It is a list and not a record so that it adds no names to the file every address loads: a record's keys are kept
 * as written. `map-kit-open.ts` gives the parts their names back, on the views' side; the two lists are one order.
 */
import { BADGE_R, M, PAD, SLOT, TRACK, TRACK_MIN, badgeHalf, carriedBy, drawn, handoffRow, heading, laneHead, numberBadge, numberRing, numberText, personCard, placeNumber, sessionCard, stroke, styleOf } from "./map-parts.js";
import { PICTURE_WIDTH, assignTracks, fmt, frame, inkFor, rect, text, textWidth, wrap } from "./svg.js";

// prettier-ignore
export const mapKit = [
  BADGE_R, M, PAD, SLOT, TRACK, TRACK_MIN, PICTURE_WIDTH,
  assignTracks, badgeHalf, carriedBy, drawn, fmt, frame, handoffRow, heading, inkFor, laneHead,
  numberBadge, numberRing, numberText, personCard, placeNumber, rect, sessionCard, stroke, styleOf, text, textWidth, wrap,
] as const;

export type MapKit = typeof mapKit;
