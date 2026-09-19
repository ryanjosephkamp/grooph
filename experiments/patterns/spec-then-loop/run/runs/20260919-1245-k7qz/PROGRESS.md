# Progress · word-wrap · run 20260919-1245-k7qz

**Goal.** Add word wrapping to this project: a function that wraps text to a given width. Done when every line of an approved ACCEPTANCE.md is shown to hold and `npm test` passes.

**Status: ended. Outcome: success.** The run reached stop node `done` when loop `build`'s `bar-passed` stop fired.

**Round (loop `build`):** 0. No back edge was taken.

| node | status |
|---|---|
| `planner` | done. ACCEPTANCE.md written, 16 items |
| `spec-gate` | done. The human approved |
| `builder` | done (round 0). Added `src/wrap.mjs`, `tests/wrap.test.mjs` and a README example; CHANGES.md written |
| `critic` | done (round 0). The first pass returned `invalid-evidence` because item 1's reference file was missing. A fresh re-run with corrected evidence returned **pass**, with all 16 items cited |
| `done` | reached |

**Waiting on:** nothing.

**Last stop check (after pass 0), in order:**

1. `bar-passed`: **fired**. The critic passed every item and `npm test` exited 0 with 13 of 13 passing.
2. `max-iterations`: 0 of 4.
3. `budget`: 4 of 40 turns, counted as worker dispatches.
4. `evidence-invalid` (added by amendment): 1 of 2.

**Run artifacts (this folder):**

- ACCEPTANCE.md
- CHANGES.md
- REVIEW.md: the passing review
- REVIEW.round-0-invalid-evidence.md
- round-0.diff
- round-0.npm-test.txt
- round-0.ref-count.mjs

**Change left in the working tree (not committed):**

- `src/wrap.mjs` (new)
- `tests/wrap.test.mjs` (new)
- `README.md` (modified)

## Amendments

1. **Critic evidence, and a stop for invalid evidence** (note n-0009). Edge `e-builder-critic` now also passes the unchanged files that ACCEPTANCE.md names as a reference (`src/count.mjs`). Loop `build` gains an `evidence-invalid` stop at 2 rounds. Why: the round-0 critic couldn't check item 1, whose reference file wasn't in its evidence, and the graph had no bound on repeated `invalid-evidence` results. This tightens the graph and loosens no brake. The working copy validates with 0 errors and 1 warning, `W_HOMOGENEOUS_CRITICS`, which the source graph already had.

## Gaps noted, not amended

- The builder's agent file says its evidence is only REVIEW.md. That is narrower than LEAD §5, which allows inbound evidence plus declared inputs, including ACCEPTANCE.md. The builder read ACCEPTANCE.md and the repo sources and flagged the mismatch (note n-0006). Fixing it means regenerating the agent file from the graph, so it is left for the human.
