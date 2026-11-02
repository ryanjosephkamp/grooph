# Phases

Work one phase at a time, never ahead. A phase is done when `npm test` passes
and the judge signs it off against the entry below, citing file and line.

## Phase 1 · tokenizer

Build `tokenize(text)` in `src/tokenize.mjs`. `tests/tokenize.test.mjs`
specifies it and fails today.

The judge checks:

1. Each token is `{ type, value, at }`, `at` being the index of its first
   character in `text`; `type` is `number`, `op`, `lparen` or `rparen`.
2. Numbers are integers and decimals with digits on both sides of the point
   (`1`, `2.5`); a `.` without a digit on each side is a `SyntaxError` whose
   message names the index.
3. Operators are `+ - * / ^`, plus parentheses; spaces, tabs and newlines are
   skipped; any other character is a `SyntaxError` naming its index.
4. A non-string is a `TypeError`.
5. `npm test` exits 0 with no test skipped or marked todo.

## Phase 2 · evaluator

Build `evaluate(text)` in `src/evaluate.mjs` on top of `tokenize`; it returns
a number. Precedence, tightest first: parentheses; `^` (right-associative);
unary minus; `*` and `/` (left-associative); `+` and `-` (left-associative).
So `-2 ^ 2` is `-4` and `2 ^ 3 ^ 2` is `512`. Division by zero is a
`RangeError`; a malformed expression is a `SyntaxError`. Write
`tests/evaluate.test.mjs` yourself from this entry.

The judge checks:

1. These hold and a test covers each: `1 + 2 * 3` → `7`, `(1 + 2) * 3` → `9`,
   `2 ^ 3 ^ 2` → `512`, `-2 ^ 2` → `-4`, `10 / 4` → `2.5`, `1 / 0` → `RangeError`,
   `1 +` → `SyntaxError`.
2. `npm test` exits 0 with no test skipped or marked todo.
3. Every case in the held-out suite passes. The suite is
   `<held-out>/evaluate-cases.test.mjs`, outside this project; it settles what
   this entry leaves open (unary minus in odd places, empty and doubled input,
   what is not an operator). The judge runs it from the project root with
   `node --test <held-out>/evaluate-cases.test.mjs` and quotes every failing
   case, input and expected result, in `PHASE-REVIEW.md`. The suite is the
   judge's: the builder does not read or run it, and builds from this entry.
