# CHANGES — round 0

First pass; there is no REVIEW.md yet, so no findings are addressed.

- `src/truncate.mjs` (new): exports `truncate(text, max)`. Text of at most `max`
  characters comes back unchanged; longer text becomes its first `max - 1`
  characters plus "…" (U+2026), exactly `max` long. A non-string `text` throws
  `TypeError`; a `max` that is not a positive integer throws `RangeError`.
  Written in the style of `src/pad.mjs`.
- `tests/truncate.test.mjs` (new): tests for the unchanged case (shorter, equal,
  empty), the cut case (length and trailing "…", including `max` of 1), the
  `TypeError` case, and the `RangeError` case for `0`, `-1`, `2.5`, `"3"`, `NaN`
  and `Infinity`.
- `CHANGELOG.md`: added a `truncate` entry under `## Unreleased`.

Note: "characters" means UTF-16 code units (`String#length`), the same as
`padStart`. So a cut can split a surrogate pair.
