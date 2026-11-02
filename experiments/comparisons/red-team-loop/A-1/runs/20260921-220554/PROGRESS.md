# Run 20260921-220554 · harden-csv-line

**Goal.** Make `parseCsvLine` in src/csv.mjs honour every line of the contract in README.md for any string input: fields or a CsvError, nothing else, within a second for a 100 KB record. Keep tests/csv.test.mjs green and extend it. Done when a red team attacking `parseCsvLine` stops finding new failing traces.

## Outcome

**Ended: success** at stop node `done`, 2026-09-21T22:12:16Z. Loop `attack` bar "No new failing trace" met on its first pass (round 0). No loop stop fired.

## Position

- Loop `attack`: rounds finished 1 (round 0); dispatches 2 / 12
- Waiting on: nothing — run ended
- Last stop check (before deciding round 1): diminishing returns over 2 rounds — n/a after one round; max iterations 5 — at 0; budget 12 dispatches — at 2. None fired; the bar passed, so `e-red-team-pass` → `done` was taken instead of a new round.

## Nodes

| node | status | result |
|---|---|---|
| builder | done (round 0) | rewrote parser as single-pass index-based state machine implementing the whole README contract; tests/csv.test.mjs extended from 4 to 16 tests (one per contract line, ten 100 KB shapes under 1 s, 20 000-case seeded fuzz); `npm test` 16/16; CHANGES.md written |
| red-team | pass (round 0) | no reproducible failure: exhaustive differential fuzz of all 488,281 strings of length 0–8 over `" , \n \r a` plus 300,000 random strings against an independent reference parser, 0 mismatches; every non-string probe (incl. throwing Proxy, coercers) → TypeError; 26 adversarial 100 KB shapes worst case 8.7 ms; traces/ created, empty; ATTACK.md written |
| done | reached | success |

## Rounds

| round | builder | red-team | new failing traces | stop check |
|---|---|---|---|---|
| 0 | done | pass | 0 | none fired; bar passed |

## Artifacts

- src/csv.mjs, tests/csv.test.mjs — the change (uncommitted in the working tree)
- CHANGES.md — builder's round-0 summary
- ATTACK.md — red team's round-0 attack record
- traces/ — empty

## Left over

- The builder flagged one README ambiguity: a lone `\r` inside quotes is treated as a literal character (README says `\n` and `\r\n` are literal inside quotes and "every other character" is literal). The red team's reference parser read it the same way. If a bare `\r` inside quotes should instead be a CsvError, README.md needs the extra line — the run did not edit README.md.
- Changes are not committed.

## Amendments

(none — working copy identical to the source document)
