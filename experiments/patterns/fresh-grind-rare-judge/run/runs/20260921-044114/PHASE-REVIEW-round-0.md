# Phase review: Phase 1 · tokenizer

Judged against `docs/PHASES.md:6-21`. Evidence: `diff-phase1-round0.patch`,
`test-output-phase1-round0.txt`, the repository as left, and a fresh `npm test`
run from the project root (4 pass, 0 fail, 0 skipped, 0 todo, exit 0).

## Item 1 — token shape `{ type, value, at }`, types `number`/`op`/`lparen`/`rparen`

Met.

- `src/tokenize.mjs:20` — `{ type: "lparen", value: "(", at: i }`
- `src/tokenize.mjs:26` — `{ type: "rparen", value: ")", at: i }`
- `src/tokenize.mjs:32` — `{ type: "op", value: ch, at: i }`
- `src/tokenize.mjs:67` — `{ type: "number", value: Number(raw), at: start }`, with `start` captured at `src/tokenize.mjs:38` as the index of the first character.
- No other `type` value is produced anywhere in `src/tokenize.mjs:1-80`.
- Positions verified by `tests/tokenize.test.mjs:7-24` (e.g. `2.5` at 1, `^` at 7, `2` at 12).

## Item 2 — integers and decimals with digits on both sides; bad `.` is a SyntaxError naming the index

Met.

- `src/tokenize.mjs:44-47` — consumes the integer digits.
- `src/tokenize.mjs:49-57` — on `.`, consumes the fractional digits.
- `src/tokenize.mjs:59-63` — throws `SyntaxError` with `unexpected character at index ${dotIndex}` when either side lacks a digit; `dotIndex` is the `.`'s own index (`src/tokenize.mjs:51`).
- `tests/tokenize.test.mjs:33-34` — `"2."` names index 1, `".5"` names index 0.
- Probed beyond the tests: `"."` → index 0, `"1..2"` → index 1, `"1.2.3"` → index 3, `"3.14"` → `{ number, 3.14, at 0 }`.

## Item 3 — operators `+ - * / ^`, parentheses, whitespace skipped, anything else is a SyntaxError naming its index

Met.

- `src/tokenize.mjs:1` — `OPERATORS = new Set(["+", "-", "*", "/", "^"])`, matched at `src/tokenize.mjs:31`.
- `src/tokenize.mjs:19` and `:25` — parentheses.
- `src/tokenize.mjs:14-17` — space, tab and newline are skipped.
- `src/tokenize.mjs:72` — fall-through `throw new SyntaxError(\`unexpected character at index ${i}\`)`.
- `tests/tokenize.test.mjs:28` — `" \t1\n+\t2 "` yields `[1, "+", 2]`; `tests/tokenize.test.mjs:35-36` — `x` at 4 and `%` at 2 are SyntaxErrors naming the index.

## Item 4 — a non-string is a TypeError

Met.

- `src/tokenize.mjs:4-6` — `if (typeof text !== "string") throw new TypeError(...)`, before any scanning.
- `tests/tokenize.test.mjs:39-41` — `tokenize(12)` throws `TypeError`.

## Item 5 — `npm test` exits 0 with nothing skipped or todo

Met.

- `package.json:7` — `"test": "node --test tests/*.test.mjs"`.
- `.grooph/calc-in-phases/runs/20260921-044114/test-output-phase1-round0.txt:9-15` — tests 4, pass 4, fail 0, cancelled 0, skipped 0, todo 0.
- Re-run by the judge from the project root: identical counts, exit code 0.

## Notes (not acceptance items)

- `src/tokenize.mjs:41` (`sawDot`) and `src/tokenize.mjs:53` (`afterDotStart`) are assigned but never read. Dead locals; harmless.
- `CHANGES.md:97-111` describes the phase accurately and states the test file was not modified, which the diff confirms (only `src/tokenize.mjs` and `CHANGES.md` are added).

## Verdict

Phase 1 is done; Phase 2 (evaluator) remains.

verdict: next-phase
