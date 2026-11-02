# CHANGES — round 0

- Added `src/wrap.mjs`: named export `wrap(text, width)` with a JSDoc header in the style of `src/count.mjs`. It throws `TypeError` for non-string `text` and `RangeError` unless `width` is an integer >= 1. It splits trimmed input on `/\s+/` and fills lines greedily (a word goes on the current line if `line.length + 1 + word.length <= width`, otherwise it starts a new line). A word longer than `width` sits alone, unbroken. Lines are joined with `"\n"` and there is no trailing newline. Empty or whitespace-only input returns `""`.
- Added `tests/wrap.test.mjs` (`node:test` + `node:assert/strict`), with one test per behaviour in ACCEPTANCE items 8–15. It includes each exact example and also covers the return shape (item 2) and both error types (items 3–4).
- `README.md`: added a `wrap` example after the existing `countWords` example.
- `src/count.mjs` and `tests/count.test.mjs` untouched.
- `npm test`: 13 tests, 13 pass, 0 fail.
