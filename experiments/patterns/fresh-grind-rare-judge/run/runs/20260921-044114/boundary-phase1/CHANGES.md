# Changes

## Phase 1 · tokenizer

Added `src/tokenize.mjs` implementing `tokenize(text)`:

- Scans `text` left to right, producing `{ type, value, at }` tokens where
  `type` is one of `number`, `op`, `lparen`, `rparen` and `at` is the index
  of the token's first character.
- Recognizes integers and decimals (`1`, `2.5`); a `.` lacking a digit on
  either side throws a `SyntaxError` whose message names the index of the
  `.`.
- Recognizes operators `+ - * / ^` and parentheses `(` `)`; skips spaces,
  tabs and newlines; any other character throws a `SyntaxError` naming its
  index.
- Throws a `TypeError` if `text` is not a string.

`tests/tokenize.test.mjs` (pre-existing, not modified) passes: 4/4 tests,
`npm test` exits 0 with nothing skipped or todo.
