# Changes

## Round 0

No REVIEW.md this round; built from the task, docs/REVIEW-CHECKLIST.md and README.md.

- Added `src/truncate.mjs` exporting `truncate(text, max)`. Text of at most
  `max` characters comes back unchanged (including the boundary at exactly
  `max`); longer text is cut to `max - 1` characters plus "…" (U+2026), so the
  result is exactly `max` characters. With `max` of 1, long text becomes "…".
  Whitespace is not trimmed; the cut is purely positional so the length
  guarantee holds. A non-string `text` throws `TypeError`; a `max` that is not
  a positive integer (`0`, `-1`, `2.5`, `"3"`, `NaN`, `Infinity`, `null`,
  `undefined`) throws `RangeError`. Follows the style of `src/pad.mjs`.
- Added `tests/truncate.test.mjs` covering: short text unchanged, exact-`max`
  boundary, cut to exactly `max` ending in the single-character ellipsis (not
  three dots), `max` of 1, whitespace preserved, and every refused value above.
- Added a line under `## Unreleased` in `CHANGELOG.md` naming `truncate`.

Checklist items addressed: 1, 2, 3, 4, 5, 6. Item 7 (held-out suite) is the
critic's to run.

`npm test`: 11 tests, 11 pass, 0 fail, 0 skipped, 0 todo.
