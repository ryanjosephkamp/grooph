# Run 20260920-191614 · harden-csv-line

**Goal.** Make `parseCsvLine` in src/csv.mjs honour every line of the contract in README.md for any string input: fields or a CsvError, nothing else, within a second for a 100 KB record. Keep tests/csv.test.mjs green and extend it. Done when a red team attacking `parseCsvLine` in src/csv.mjs, against the contract in README.md stops finding new failing traces.

**Status.** ended · outcome **success** · stop node `done` reached via `e-red-team-pass` (started 2026-09-20T19:16:14Z, ended 2026-09-20T19:22:48Z)
**Loop `attack`.** rounds completed: 1 (round 0 only, no back edge taken) · dispatches 2/12 · max iterations 0/5 · diminishing returns: n/a

## Nodes

| node | status | last result |
|---|---|---|
| builder | done (round 0) | linear single-pass rewrite of parseCsvLine covering every README rule; tests/csv.test.mjs extended to 16 tests (one per rule, fuzz, 100 KB timing); CHANGES.md written; no traces to fix |
| red-team | done (round 0) | verdict **pass**: 397,656-input differential fuzz against a contract state machine, 14 adversarial 100 KB shapes (< 4 ms each), non-string/exception-shape probes — no reproducible violation; traces/ created empty |
| done | reached | run ends with outcome success |

## Waiting on

Nothing. The run has ended.

## Last stop check

Evaluated after round 0, before any further round, in order:
1. diminishing returns over 2 rounds on new failing traces — not applicable (no round history yet); did not fire
2. max iterations 5 — 0 back edges taken; did not fire
3. budget 12 dispatches — 2 used; did not fire

Bar "No new failing trace": **met** — the attack round found no failing trace (traces/ empty) and `npm test` is green (16 pass, 0 fail). Edge `e-red-team-pass` taken to `done`.

## Rounds

| round | builder | red-team | new failing traces | stop check |
|---|---|---|---|---|
| 0 | pass (contract implemented, 16/16 tests) | pass (no trace) | 0 | none fired; bar met → done |

## Amendments

None. The working copy `graph.grooph.json` in this folder is identical to the source document.

## Left over

- The working tree has uncommitted changes: `src/csv.mjs`, `tests/csv.test.mjs` (modified), `CHANGES.md` and the empty `traces/` directory (new). Nothing was committed.
- Contract ambiguities the builder resolved and the red team accepted (a lone `\r` inside quotes is literal; `"a"\r` is a CsvError; `a""` is a CsvError; Unicode line separators are literal) are recorded in CHANGES.md; README.md may want a line on the lone-`\r`-inside-quotes case.
