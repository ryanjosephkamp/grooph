# CHANGES — round 0

## Added

- `src/wrap.mjs` — new module with named export `wrap(text, width)` returning a
  string. JSDoc comment follows the style of `src/count.mjs`.
  - Throws `TypeError` if `text` is not a string, or if `width` is not an
    integer `>= 1` (guards with `Number.isInteger`, so `2.5`, `NaN`,
    `Infinity` and `"10"` all throw).
  - Splits the trimmed input on `/\s+/`, so spaces, tabs and newlines are all
    separators and are not preserved.
  - Greedy fill: a word joins the current line when
    `line.length + 1 + word.length <= width`, otherwise it starts a new line.
    A word longer than `width` therefore lands alone on its own line and is
    never broken or hyphenated.
  - Returns `""` for empty or whitespace-only input; otherwise lines joined
    with `"\n"`, with no leading/trailing whitespace and no trailing newline.

- `tests/wrap.test.mjs` — 12 new tests using `node:test` and
  `node:assert/strict`, in the style of `tests/count.test.mjs`. Coverage maps
  to the acceptance behaviour lines: type/width validation (2), return type
  (1), whitespace-as-separator (6), greedy fill and the
  `wrap("the quick brown fox", 10) === "the quick\nbrown fox"` example (8),
  no line over `width` (7), over-long word alone and unbroken (7), no
  leading/trailing whitespace or trailing newline and `"\n"` join (9), empty
  and whitespace-only input (10), already-fits single line (11), plus a
  word-order/round-trip property check across several widths.

## Modified

- `README.md` — added a `wrap` usage example in a second fenced block
  alongside the existing `countWords` one.

## Unmodified

- `src/count.mjs`, `tests/count.test.mjs`, `package.json` — untouched, as
  acceptance line 5 requires. No CLI and no default export were added.

## Test result

`npm test` exits `0`: 13 tests, 13 pass, 0 fail (1 pre-existing `countWords`
test plus the 12 new `wrap` tests).

## Notes

No acceptance line appeared wrong or unimplementable; nothing was worked
around.
