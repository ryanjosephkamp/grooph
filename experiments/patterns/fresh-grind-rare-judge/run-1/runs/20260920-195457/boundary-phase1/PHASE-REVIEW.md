# Phase review · Phase 1 · tokenizer

Judged against `docs/PHASES.md:6-21`. Evidence: `.grooph/calc-in-phases/runs/20260920-195457/evidence-phase1.md` (diff and `npm test` output), `src/tokenize.mjs`, `tests/tokenize.test.mjs`, `package.json`.

## Item by item

1. Token shape `{ type, value, at }`, `at` = index of first character; `type` in `number | op | lparen | rparen` — MET.
   - `src/tokenize.mjs:22` lparen, `:28` rparen, `:34` op, `:66-70` number, each with `at` set to the scan index at the token's first character (`i` or `start`, `src/tokenize.mjs:40`).
   - No other `type` string is emitted anywhere in `src/tokenize.mjs:1-79`.
   - Verified by `tests/tokenize.test.mjs:7-24` (positions 0..12 across all four types).

2. Numbers: integers and decimals with digits on both sides of the point; a bare `.` is a `SyntaxError` naming the index — MET.
   - Integer digits scanned at `src/tokenize.mjs:43-45`; fractional digits at `:56-59`; value produced with `Number(text.slice(start, end))` at `:68`.
   - `hasDigitBefore` / `hasDigitAfter` at `src/tokenize.mjs:49-50`; either missing throws `SyntaxError` with `dotAt` in the message at `:52-54`.
   - Trace: `"2."` -> `dotAt = 1`, no digit after -> message names index 1. `".5"` -> branch entered at `:39`, `end === start` so `hasDigitBefore` is false -> message names index 0. `"1.2.3"` -> `1.2` emitted, then second `.` at index 3 has no digit before -> names index 3.
   - Verified by `tests/tokenize.test.mjs:12-24` (`2.5`) and `:33-34` (`2.`, `.5`).

3. Operators `+ - * / ^` and parentheses; spaces, tabs, newlines skipped; any other character is a `SyntaxError` naming its index — MET.
   - Operator set at `src/tokenize.mjs:1`, matched at `:33-37`; parentheses at `:21-31`.
   - Whitespace skip at `src/tokenize.mjs:16-19` (space, tab, `\n`, and additionally `\r`).
   - Fallthrough `SyntaxError` with index `i` at `src/tokenize.mjs:75`.
   - Verified by `tests/tokenize.test.mjs:28-29` (whitespace, empty input) and `:35-36` (`x` at 4, `%` at 2).

4. Non-string is a `TypeError` — MET.
   - `src/tokenize.mjs:6-8`.
   - Verified by `tests/tokenize.test.mjs:39-41`.

5. `npm test` exits 0 with no test skipped or marked todo — MET.
   - Script `node --test tests/*.test.mjs` at `package.json:7`.
   - Evidence `.grooph/calc-in-phases/runs/20260920-195457/evidence-phase1.md:14` records exit code 0; `:24-30` records `tests 4`, `pass 4`, `fail 0`, `skipped 0`, `todo 0`.
   - `tests/tokenize.test.mjs` is unchanged from commit `eda0b94` per `evidence-phase1.md:12`, so the pre-existing spec was not weakened.

## Observations (not blocking)

- `src/tokenize.mjs:16` also skips `\r`. `docs/PHASES.md:18` lists spaces, tabs and newlines; treating CR as part of a newline is a reasonable reading and no test contradicts it. Phase 2's held-out suite may settle this; noting it so it is not a surprise.
- `src/tokenize.mjs:62-64` (`end === start` guard) is unreachable: entering the branch at `:39` requires a digit (so `end > start`) or a `.` (which throws at `:52-54` because `hasDigitBefore` is false). Harmless dead code.
- `CHANGES.md:3-21` accurately describes the change and states Phase 2 is not started.

## Verdict

All five Phase 1 items are met; Phase 2 · evaluator remains.

verdict: next-phase
