# Changes

## Phase 1 · tokenizer

Added `tokenize(text)` in `src/tokenize.mjs`:

- Scans `text` left to right, producing tokens `{ type, value, at }` where
  `at` is the index of the token's first character.
- `type` is one of `number`, `op`, `lparen`, `rparen`.
- Numbers accept integers and decimals with a digit on both sides of the
  point; a `.` missing a digit on either side raises a `SyntaxError` whose
  message names the index of the `.`.
- Operators `+ - * / ^` and parentheses `( )` are recognized; space, tab,
  newline and carriage return are skipped; any other character raises a
  `SyntaxError` naming its index.
- A non-string argument raises a `TypeError`.

`tests/tokenize.test.mjs` (pre-existing) passes: `npm test` exits 0 with
4 tests passing, 0 failed, 0 skipped, 0 todo.

Phase 2 (evaluator) not started.
