# Run 20260920-190434 · line-diff

**Goal.** Implement `diffLines(before, after)` as README.md specifies, producing a minimal line edit script. The final implementation lives at src/diff.mjs; `npm test` checks every candidates/*/diff.mjs and src/diff.mjs against the same contract. Done when the finalist the judge picks is finished and `npm test` passes.

**Status:** ended — reached stop node `done` (outcome: success) at 2026-09-20T19:09:35Z.

**Round:** 0 (graph has no loops; no stop was evaluated).

## Nodes

| node | status |
|---|---|
| candidate-a | done 2026-09-20T19:05:56Z — Myers O(ND), forward trace + backward recovery |
| candidate-b | done 2026-09-20T19:06:15Z — Myers O((N+M)D), Int32Array frontier + backtrack |
| candidate-c | done 2026-09-20T19:06:15Z — Myers O(ND), trace + backtrack |
| filter | pass 2026-09-20T19:06:24Z — `npm test` 40/40; finalists a, b, c (output in `filter-output.txt`) |
| judge | pass 2026-09-20T19:08:22Z — PICK.md: winner candidates/b; borrow a's memory-cost statement; noted b's dead `max === 0` branch |
| finisher | pass 2026-09-20T19:09:35Z — src/diff.mjs from candidates/b, dead branch removed, space cost documented; CHANGES.md written |
| done | reached 2026-09-20T19:09:35Z |

## Outputs

- `src/diff.mjs` — the finished implementation
- `PICK.md` — the judge's pick and reasons
- `CHANGES.md` — the finisher's record of what changed from candidates/b
- `candidates/a/`, `candidates/b/`, `candidates/c/` — untouched drafts (with APPROACH.md each)

## Final check

`npm test` re-run by the lead after the finisher: 53 tests, 53 pass, 0 fail (candidates/a, b, c and src).

## Why the run ended

Edges followed once, in order: candidates → filter (pass) → judge (pass) → finisher → `done`. Stop node `done` reached with outcome success.

## Amendments

None. The working copy `graph.grooph.json` is identical to the source document.

## Leftovers

- New files are uncommitted (`candidates/`, `src/`, `PICK.md`, `CHANGES.md`, `.grooph/line-diff/runs/`). Whether to keep the candidate folders now that src/diff.mjs exists is a human call; the test suite keeps checking them while they remain.
