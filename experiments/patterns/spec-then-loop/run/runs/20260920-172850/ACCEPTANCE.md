# ACCEPTANCE — word wrap

Task: add a function that wraps text to a given width, in the `textwrap` package.
Each line below is checkable by reading the named file or by running `npm test`.

## Shape (check by reading code)

1. `src/wrap.mjs` exists and has a named export `wrap(text, width)` returning a string, with a JSDoc comment in the style of `src/count.mjs`.
2. `wrap` throws a `TypeError` if `text` is not a string, or if `width` is not an integer greater than or equal to 1.
3. `tests/wrap.test.mjs` exists, uses `node:test` and `node:assert/strict` like `tests/count.test.mjs`, and covers every behaviour in the next section.
4. `README.md` shows a `wrap` usage example alongside the existing `countWords` one.
5. No existing file changes behaviour: `src/count.mjs`, `tests/count.test.mjs`, and `package.json` are unmodified.

## Behaviour (check by `npm test`)

6. Words are runs of non-whitespace. Output lines are words joined by a single space; runs of spaces, tabs, and existing newlines in the input are treated as word separators (not preserved).
7. No output line is longer than `width` characters, except when a single word is itself longer than `width`, in which case that word appears alone on its own line, unbroken (no mid-word splitting, no hyphenation).
8. Wrapping is greedy: each line holds as many whole words as fit within `width` before breaking. E.g. `wrap("the quick brown fox", 10)` is `"the quick\nbrown fox"`.
9. Lines are joined with `"\n"`; the result has no leading or trailing whitespace and no trailing newline.
10. Empty or whitespace-only input returns `""`.
11. Text that already fits in `width` is returned as its words joined by single spaces, on one line.
12. `npm test` exits 0 with all tests (existing and new) passing.

## Out of scope

- Hyphenation or breaking inside long words.
- Preserving paragraph breaks, indentation, or multiple spaces from the input.
- Unicode display width (each JavaScript string code unit counts as one character; no East Asian wide or combining-character handling).
- ANSI escape sequences, tabs expanded to columns, or right/centre justification.
- A CLI, a default export, or any change to `package.json`.
