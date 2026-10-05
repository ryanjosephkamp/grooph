/**
 * The front page's picture and its six tiles, drawn ahead of time (`front.generated.ts`, which
 * scripts/front-page.mjs writes and test/front.test.ts holds to what the code draws).
 *
 * A piece of the app (slice 0093; decision 0021), asked for by `Landing.tsx`. The front page's address asks for it
 * beside the app, in the same round, and it is weighed in that address's first load (scripts/perf-budget.mjs). No
 * other address needs it: a graph, a share link and the template screens do not carry the front page's picture.
 */
export { HERO_SVG, TILES } from "./front.generated.js";
