# Evidence for judge · phase 2 · phases round 1

## Diff since the last phase boundary (phase 1 sign-off, 2026-09-20T19:58:01Z)

Compared against the phase-1 snapshot in `.grooph/calc-in-phases/runs/20260920-195457/boundary-phase1/` at 2026-09-20T19:59:56Z:

- `src/tokenize.mjs` — unchanged since phase 1 (`diff -u` empty).
- `tests/tokenize.test.mjs` — unchanged from the commit (`git diff --stat HEAD` empty).
- `src/evaluate.mjs` — **new**.
- `tests/evaluate.test.mjs` — **new**.
- `CHANGES.md` — phase 2 section appended (diff below).
- `PHASE-REVIEW.md` — the judge's phase-1 review, untouched by the builder.

```diff
--- boundary-phase1/CHANGES.md
+++ CHANGES.md
@@ -18,4 +18,38 @@
 `tests/tokenize.test.mjs` (pre-existing) passes: `npm test` exits 0 with
 4 tests passing, 0 failed, 0 skipped, 0 todo.
 
-Phase 2 (evaluator) not started.
+## Phase 2 · evaluator
+
+Added `evaluate(text)` in `src/evaluate.mjs`, a recursive-descent parser built
+on `tokenize`:
+
+- Grammar, tightest binding first: parentheses; `^` (right-associative,
+  parsed by recursing into the unary rule on its right-hand side so
+  `2 ^ 3 ^ 2` is `2 ^ (3 ^ 2)` = `512`); unary minus (`-` only — `+` is never
+  treated as a prefix operator); `*` and `/` (left-associative); `+` and `-`
+  (left-associative). Because `^` binds tighter than unary minus,
+  `-2 ^ 2` parses as `-(2 ^ 2)` = `-4`.
+- `/` throws a `RangeError` naming the operator's index whenever the
+  right-hand operand is `0` (this includes `0 / 0`), per the entry's
+  "division by zero is a `RangeError`" rule.
+- Any other malformed input — an empty or whitespace-only string, a
+  trailing operator (`1 +`), a leading or doubled binary operator that
+  isn't the unary `-` (`+ 1`, `1 + + 2`, `* 2`), two operands with no
+  operator between them (`1 2`), unmatched or empty parentheses
+  (`(1 + 2`, `1 + 2)`, `()`), or a dangling `^` (`2 ^`) — is a
+  `SyntaxError`. Errors thrown by `tokenize` itself (bad characters, bad
+  numbers, non-string input) surface unchanged through `evaluate`.
+- Doubled unary minus is accepted and composes normally: `- - 2` is `2`,
+  `- - - 2` is `-2`. This, together with the empty/doubled-input and
+  "what is not an operator" decisions above, are exactly the points the
+  entry leaves open for the held-out suite to settle; this is the reading
+  chosen and tested here.
+
+`tests/evaluate.test.mjs` (new, written from `docs/PHASES.md:23-37`) covers
+every case listed in the judge's checklist item 1, plus precedence/
+associativity, the unary-minus-vs-`^` interaction, division-by-zero
+variants, the malformed-input decisions above, and tokenizer errors passing
+through. `tests/tokenize.test.mjs` is untouched.
+
+`npm test` exits 0 with 11 tests passing (4 from phase 1, 7 from phase 2),
+0 failed, 0 skipped, 0 todo.
```

## `npm test` output (run bare from the project root, exit code 0)

```
> calc@0.1.0 test
> node --test tests/*.test.mjs

✔ the required cases from the phase 2 entry (0.637333ms)
✔ precedence and associativity (0.083791ms)
✔ unary minus binds tighter than * and / but looser than ^ (0.060542ms)
✔ division by zero is a RangeError, including 0 / 0 (0.441333ms)
✔ malformed expressions are SyntaxErrors (0.184084ms)
✔ tokenizer errors surface unchanged from evaluate (0.075459ms)
✔ whitespace-only and nested parentheses (0.057459ms)
✔ numbers, operators and parentheses with positions (0.676875ms)
✔ whitespace of every kind is skipped and the empty text has no tokens (0.073416ms)
✔ a bad number and an unknown character are SyntaxErrors that name the index (0.400166ms)
✔ a non-string is a TypeError (0.069834ms)
ℹ tests 11
ℹ suites 0
ℹ pass 11
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 44.82375
```
