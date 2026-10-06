/**
 * What the offline page's maker is handed when it is called (`offline.ts`): the parts of core it draws, lists and
 * writes a document with. It is part of core's first door (`base.ts` exports it as `offlineKit`).
 *
 * The maker does not import these itself, because of how it is fetched. The web app loads it as a piece of its own,
 * only when a person presses "Offline page" under Keep a copy. A bundler puts what two pieces share into a file of
 * its own, and when the maker imported these it cut the file every address loads in three, which gave back more
 * than half of what moving the maker had saved. A piece that imports nothing changes nothing else (`picture/map-kit.ts`
 * found the same for a map's views): so the maker imports only types, and whoever calls it hands it this.
 *
 * A list and not a record, so that it adds no names to the file every address loads. `offline.ts` gives the parts
 * their names back, in this order.
 *
 * What it does keep on every address: three functions the web app uses nowhere else (`mapOutline`, `validateMap`,
 * `mapLiveLine`), about 0.45 KB compressed, which a bundler would otherwise drop. They live in files every address
 * loads for other reasons, so the maker cannot own them without importing those files, which is the cut above.
 */
import { canonicalize } from "./canonicalize.js";
import { mapLiveLine } from "./events.js";
import { formatIssue } from "./issues.js";
import { canonicalizeMap, isMapLike, validateMap } from "./map.js";
import { mapOutline, outline } from "./outline.js";
import { picture } from "./picture/graph-picture.js";
import { mapPicture } from "./picture/map-picture.js";
import { esc } from "./picture/svg.js";
import { validate } from "./validate.js";

// prettier-ignore
export const offlineKit = [
  canonicalize, canonicalizeMap, esc, formatIssue, isMapLike, mapLiveLine, mapOutline, mapPicture, outline, picture, validate, validateMap,
] as const;

export type OfflineKit = typeof offlineKit;
