/**
 * An operation map's other views, behind a door of their own: its lanes side by side (`mapWideWith`) and its
 * sequence (`mapSequenceWith`), docs/operation-map.md §4c and §4d.
 *
 * Core has three doors (decision 0021): `base.ts`, which the web app starts from; the compiler; and this. Nothing
 * `base.ts` reaches leads here, so the web app fetches this file only when it draws an operation map, and an address
 * that shows no map never carries it. Nothing here leads back either: the two views import only types and are
 * handed core's parts as their first argument (`map-kit.ts` says why), so fetching them moves nothing else. A test
 * holds both directions. In Node there is no door: `index.ts` binds the kit, and `mapWide(map)` and
 * `mapSequence(map)` are plain calls.
 */
export { mapWideWith } from "./map-wide.js";
export { mapSequenceWith } from "./map-sequence.js";
