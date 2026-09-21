# Phase review · Phase 2 · evaluator

Judged against `docs/PHASES.md:23-44` ("Phase 2 · evaluator", the three items
under "The judge checks" at `docs/PHASES.md:32-44`). Phase 1 was signed off in
the previous round; phase 2 is the last phase.

Evidence inspected: `.grooph/calc-in-phases/runs/20260921-044114/diff-phase2-round1.patch`,
`.grooph/calc-in-phases/runs/20260921-044114/test-output-phase2-round1.txt`,
`src/evaluate.mjs`, `tests/evaluate.test.mjs`, `CHANGES.md`, `docs/PHASES.md`,
the held-out suite, plus a fresh `npm test` and a fresh held-out run, both bare
from the project root. The on-disk `src/evaluate.mjs` (114 lines) and
`tests/evaluate.test.mjs` (73 lines) are identical to the versions in the diff
(`diff-phase2-round1.patch:46-160` and `:166-239`).

## Item 1 — the seven named cases hold and a test covers each (`docs/PHASES.md:34-36`)

| Case | Test covering it | Implementation |
| --- | --- | --- |
| `1 + 2 * 3` → `7` | `tests/evaluate.test.mjs:6-8` | `*`/`/` parsed under `+`/`-`: `src/evaluate.mjs:39-49` calls `parseMulDiv` (`:51-68`) for each operand |
| `(1 + 2) * 3` → `9` | `tests/evaluate.test.mjs:10-12` | `lparen` → recursive `parseAddSub` → `rparen`: `src/evaluate.mjs:102-110` |
| `2 ^ 3 ^ 2` → `512` | `tests/evaluate.test.mjs:14-16` | exponent parsed via `parseUnary`, which recurses back into `parsePower`, giving right-association: `src/evaluate.mjs:81-85` |
| `-2 ^ 2` → `-4` | `tests/evaluate.test.mjs:18-20` | unary minus wraps `parsePower`, so `^` binds first: `src/evaluate.mjs:70-76` |
| `10 / 4` → `2.5` | `tests/evaluate.test.mjs:22-24` | `left / right`: `src/evaluate.mjs:63` |
| `1 / 0` → `RangeError` | `tests/evaluate.test.mjs:26-28` | `if (right === 0) throw new RangeError(...)`: `src/evaluate.mjs:60-62` |
| `1 +` → `SyntaxError` | `tests/evaluate.test.mjs:30-32` | end of input where an operand is expected: `src/evaluate.mjs:93-95` |

All seven pass in the recorded test output
(`test-output-phase2-round1.txt:5-11`) and in my re-run. Met.

## Item 2 — `npm test` exits 0 with no test skipped or marked todo (`docs/PHASES.md:37`)

Recorded run: `test-output-phase2-round1.txt:25-31` — tests 20, pass 20,
fail 0, cancelled 0, skipped 0, todo 0. My fresh `npm test` from the project
root (script `node --test tests/*.test.mjs`) reproduced the same counts:
20 pass, 0 fail, 0 skipped, 0 todo, exit 0. Met.

## Item 3 — every case in the held-out suite passes (`docs/PHASES.md:38-44`)

Ran bare from the project root:

```
node --test /private/var/folders/pv/m1k13gmn189d64ndtxdbzrjc0000gn/T/grooph-prove-fresh-grind-rare-judge-dKz7KU.harness/held-out/evaluate-cases.test.mjs
```

Result: tests 43, pass 43, fail 0, cancelled 0, skipped 0, todo 0. The suite
imports `src/evaluate.mjs` by cwd (`evaluate-cases.test.mjs:8`), so the run
exercised the project's file as it stands.

Failing cases (input and expected result): **none.**

Coverage of what the entry left open, all passing:

- unary minus in odd places (`evaluate-cases.test.mjs:15-21`): `(-2) ^ 2` → 4,
  `2 ^ -1` → 0.5, `-2 ^ -2` → -0.25, `2 * -3` → -6, `3 - -2` → 5, `--1` → 1,
  `-(-3)` → 3 — handled by `src/evaluate.mjs:70-76` and `:83`.
- empty and doubled input (`evaluate-cases.test.mjs:37-38,42-45`): `""`,
  `"   "`, `1 2`, `2(3)`, `(3)2`, `()` → `SyntaxError` — `src/evaluate.mjs:19-22`
  (leftover tokens) and `:93-95`, `:113` (missing/wrong operand).
- what is not an operator (`evaluate-cases.test.mjs:40-41,48-51`): `+ 1`, `+1`,
  `1 * / 2`, `1e3`, `7 % 2`, `2 ** 3` → `SyntaxError` — stray `op` where an
  operand is expected hits `src/evaluate.mjs:113`; `e` and `%` are rejected
  by `tokenize` before parsing (`src/evaluate.mjs:14`).
- `0 / 0` and `1 / (2 - 2)` → `RangeError` (`evaluate-cases.test.mjs:53-54`)
  — `src/evaluate.mjs:60-62` checks the evaluated divisor, not the literal.
- `42` and `null` → `TypeError` (`evaluate-cases.test.mjs:55-56`) — raised by
  `tokenize` at `src/evaluate.mjs:14` and not caught.

Met.

## Notes (not findings)

- `CHANGES.md:10-40` describes the phase 2 work and matches the code: the
  precedence claims at `CHANGES.md:15-18` correspond to the grammar comment at
  `src/evaluate.mjs:3-11`; the "20/20 tests" claim at `CHANGES.md:40` matches
  the recorded output.
- The diff touches only `CHANGES.md`, `src/evaluate.mjs` and
  `tests/evaluate.test.mjs`; `src/tokenize.mjs` and `tests/tokenize.test.mjs`
  are unchanged since the phase 1 boundary, and the four tokenizer tests still
  pass (`test-output-phase2-round1.txt:21-24`).

## Verdict

All three items are met and phase 2 is the last phase.

verdict: pass
