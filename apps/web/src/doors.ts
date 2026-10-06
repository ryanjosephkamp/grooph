/**
 * Which addresses need which piece of the app before their first screen is drawn (decision 0021; slice 0093).
 *
 * Read in two places that must agree: the script in the page's head, which asks for a piece beside the app before
 * any of the app has run (`vite.config.ts` writes these into it), and the app, which waits for the same piece
 * before it draws (`App.tsx`). If the two differed, an address would wait for a piece nobody had asked for, a
 * round later than it could have come; so both read these, and `test/doors.test.ts` holds them to the routes.
 *
 * Each is the source of a regular expression that is tried on `location.hash`.
 */

/**
 * The front page's own picture and tiles (`ui/landing/front.ts`): at `#/about`, and at every address that is the
 * library's, which is the front page on a device with no graphs yet. The library's is every address that is not
 * another screen's (`parse` in `App.tsx`), so this says what the other screens' are.
 */
export const FRONT = String.raw`^(?!#\/(?:run\?live$|live$|run\/[^?]+$|templates$|embed(?:\?|$)|templates\/(?:built-in|yours|plan)\/[^/?]+(?:\/use)?$|g\/[^/?]+(?:\?new)?$|open\?))`;

/** The built-in templates (`doc/builtins.ts`): the list, and a built-in template's view and its Use form. */
export const BUILT_INS = String.raw`^#\/templates(?:$|\/built-in\/[^/?]+(?:\/use)?$)`;
