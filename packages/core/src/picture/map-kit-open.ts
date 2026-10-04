/**
 * The kit's parts by name, for the views (`map-kit.ts` says why they are handed a kit, and why it is a list). This
 * file is on the views' side of the door: it imports only the kit's type.
 *
 * The order is `map-kit.ts`'s. Most parts differ in type, so one out of place does not compile; the three that do
 * not (two numbers that are equal, and the ring and the badge of a number) are caught by the committed pictures.
 */
import type { MapKit } from "./map-kit.js";

export function open(kit: MapKit) {
  // prettier-ignore
  const [
    BADGE_R, M, PAD, SLOT, TRACK, TRACK_MIN, PICTURE_WIDTH,
    assignTracks, badgeHalf, carriedBy, drawn, fmt, frame, handoffRow, heading, inkFor, laneHead,
    numberBadge, numberRing, numberText, personCard, placeNumber, rect, sessionCard, stroke, styleOf, text, textWidth, wrap,
  ] = kit;
  // prettier-ignore
  return {
    BADGE_R, M, PAD, SLOT, TRACK, TRACK_MIN, PICTURE_WIDTH,
    assignTracks, badgeHalf, carriedBy, drawn, fmt, frame, handoffRow, heading, inkFor, laneHead,
    numberBadge, numberRing, numberText, personCard, placeNumber, rect, sessionCard, stroke, styleOf, text, textWidth, wrap,
  };
}
