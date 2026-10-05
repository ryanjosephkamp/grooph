/**
 * The front page's picture and its six tiles, as they were drawn when the app was built (`front.generated.ts`,
 * written by scripts/front-page.mjs and held to the code by test/front.test.ts).
 *
 * A piece of the app (slice 0093; decision 0021), asked for by `Landing.tsx`. The front page's address asks for it
 * beside the app, in the same round, and it is weighed in that address's first load (scripts/perf-budget.mjs). No
 * other address needs it: a graph, a share link and the template screens do not carry the front page's picture.
 */
export { HERO, HERO_SVG, TILES } from "./front.generated.js";
