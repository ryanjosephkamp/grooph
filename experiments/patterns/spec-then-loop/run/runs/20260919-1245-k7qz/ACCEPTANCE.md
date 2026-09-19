# ACCEPTANCE — word wrap

Task: add a function that wraps text to a given width. Each line below is checkable by reading the code or running `npm test`. "Width" means number of characters (string length).

## Shape (check by reading code)

1. `src/wrap.mjs` exists and has a named export `wrap(text, width)`, with a JSDoc header in the style of `src/count.mjs`.
2. `wrap` returns a string; lines are joined with `"\n"`; no trailing newline.
3. `wrap` throws `TypeError` if `text` is not a string.
4. `wrap` throws `RangeError` if `width` is not an integer `>= 1`.
5. `tests/wrap.test.mjs` exists, uses `node:test` and `node:assert/strict`, and covers every behaviour in the next section.
6. `README.md` gains a short `wrap` example alongside the existing `countWords` one.
7. `src/count.mjs` and `tests/count.test.mjs` are unchanged.

## Behaviour (check by `npm test`; each should be an assertion)

8. Text that fits is returned unchanged: `wrap("one two", 10)` is `"one two"`.
9. Breaks happen only at whitespace, never inside a word: `wrap("one two three", 8)` is `"one two\nthree"`.
10. Every output line is at most `width` characters, except when a single word is longer than `width`; then that word sits alone on its own line, unbroken (no hyphenation, no splitting): `wrap("a verylongword b", 5)` is `"a\nverylongword\nb"`.
11. A word of exactly `width` characters fits on a line: `wrap("abcde fg", 5)` is `"abcde\nfg"`.
12. Runs of whitespace between words (spaces, tabs, newlines) collapse to a single space; input line breaks are not preserved: `wrap("one  two\nthree", 20)` is `"one two three"`.
13. Output lines have no leading or trailing whitespace; leading/trailing whitespace in the input is dropped: `wrap("  one two  ", 3)` is `"one\ntwo"`.
14. Empty or whitespace-only input returns `""`: `wrap("", 5)` and `wrap("   ", 5)` are both `""`.
15. Width `1` still works: `wrap("a b", 1)` is `"a\nb"`.

## Done

16. `npm test` exits 0 with the new tests included.

## Out of scope

- Preserving paragraph breaks or blank lines from the input.
- Hyphenating or splitting long words.
- Indentation, justification, or padding lines to `width`.
- Unicode display width (combining marks, wide characters, ANSI escapes); width is `string.length`.
- A CLI or a default export.
