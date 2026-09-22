# Run 20260921-224918 · harden-csv-line

**Goal.** Make `parseCsvLine` in src/csv.mjs honour every line of the contract in README.md for any string input: fields or a CsvError, nothing else, within a second for a 100 KB record. Keep tests/csv.test.mjs green and extend it. Done when a red team attacking `parseCsvLine` in src/csv.mjs, against the contract in README.md stops finding new failing traces.

**Status.** ended — stop node `done` reached (outcome success), 2026-09-21T22:58:44Z

## Loop `attack`

- rounds completed: 1 (round 0 only; no back edge taken)
- dispatches: 2 / 12 (builder r0, red-team r0)
- bar "No new failing trace": **met** on round 0 — `traces/` empty, `npm test` 19 pass / 0 fail
- last stop check: none of the three stops reached (diminishing returns: n/a with one round; max iterations 5: at 0; budget 12: at 2). Bar passed and `red-team` returned `pass`, so `e-red-team-pass` → `done`.

## Nodes

| node | status | rounds run |
|---|---|---|
| builder | done — r0: rewrote `parseCsvLine` as a linear single-pass state machine enforcing every README rule; tests/csv.test.mjs extended to 19 tests (one per contract rule, exhaustive short-input sweep, 100 KB timing across twelve shapes, 6 MB scaling); CHANGES.md written | 0 |
| red-team | done — r0, verdict **pass**: differential fuzz vs a README-derived reference parser (488k exhaustive strings to length 8, 300k random exotic-alphabet strings, 4k structured records), 20 non-string inputs, 20 adversarial shapes at 100 KB / 1 MB / 10 MB (worst 100 KB: 3.6 ms). No failing trace; ATTACK.md written; traces/ created empty | 0 |
| done | reached | — |

## How the run ended

`red-team` returned `pass` on round 0; edge `e-red-team-pass` led to the stop node `done` (success). No loop stop fired.

## Artifacts left in the project

- src/csv.mjs (modified), tests/csv.test.mjs (modified)
- CHANGES.md, ATTACK.md, traces/ (empty) — new, uncommitted
- Nothing committed.

## Amendments

- none — the working copy `graph.grooph.json` in this folder is identical to the source document.

## Notes for the human

- Builder flagged one interpretation call: a lone `\r` *inside* quotes is a literal character (README: "every other character … is a literal"); a lone `\r` *outside* quotes, including at the very end of the text, is a `CsvError`. The red team's reference parser read the README the same way and found no divergence.
- The red team ran its harnesses inline via `node -e` (sandbox blocked writes outside the project); generators are described in ATTACK.md, not saved as scripts.
