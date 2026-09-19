# Changes

## src/slugify.mjs

- Added three replacements before the general non-alphanumeric collapse:
  `&` -> ` and `, `@` -> ` at `, `%` -> ` percent `, so these symbols become
  words (e.g. "Fish & Chips" -> "fish-and-chips", "100% Cotton" ->
  "100-percent-cotton") instead of being silently dropped.
- Fixed a claim-breaking bug in the existing `maxLength` truncation:
  `slug.slice(0, maxLength)` could land right after a hyphen (e.g.
  "abc-def" truncated to 4 would naively be "abc-"), producing a slug that
  ends with a hyphen and that is *not* idempotent (re-slugifying "abc-"
  produces "abc", a different, shorter string). Added a second
  `.replace(/^-+|-+$/g, "")` after slicing to strip any hyphen exposed by
  the cut, and clamped `maxLength` to be non-negative for safety.

## tests/slugify.test.mjs

- Added a test for the three new symbol-to-word conversions (`&`, `@`, `%`).
- Added a regression test for the truncation-trailing-hyphen bug fixed above.
- Added a broader idempotency/charset/length property test that runs
  `slugify` over a range of tricky inputs (symbols-only strings, repeated
  hyphens, empty string, long strings, accents) and a range of small and
  large `maxLength` values, checking on every combination that the output:
  only contains `a-z0-9` and single hyphens, is at most `maxLength` long,
  and is a fixed point of `slugify` (re-slugifying it returns the same
  string). This covers the full claim, not just the new symbol cases.

No COUNTEREXAMPLE.md was present for this round (first round), so no
counterexample-derived test was added.
