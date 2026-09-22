# Run 20260921-235057 · Word wrap

**Goal.** Add word wrapping to this project: a function that wraps text to a given width. Done when every line of an approved ACCEPTANCE.md is shown to hold and `npm test` passes.

**Status:** ended — **success** (stop node `done` reached).

**Round (loop `build`):** 0 (one pass, no back edge taken) · **Dispatches (loop `build`):** 2 / 10

## Nodes

| node | status |
|---|---|
| `planner` | done — wrote `ACCEPTANCE.md` (13 lines + out of scope) |
| `spec-gate` | done — human answered **approve** |
| `builder` | done (round 0) — added `src/wrap.mjs`, `tests/wrap.test.mjs`, README example, `CHANGES.md`; `npm test` 11/11 |
| `critic` | done (round 0) — `REVIEW.md`: all 13 lines hold, verdict **pass** |
| `done` | reached — outcome success |

## Waiting on

Nothing. The run is over.

## Last stop check

Loop `build`, after round 0, in order: **#1 bar passed — fired** (critic verdict pass; `npm test` exits 0 with 11 pass / 0 fail). #2 max iterations (0 of 4) and #3 budget (2 of 10 dispatches) not reached. Took `e-critic-pass` → `done`.

## Why the run ended

Reached stop node `done` via `e-critic-pass` after the critic's `pass` verdict on round 0.

## Amendments

None — the working copy `graph.grooph.json` in this folder is identical to the source document.

## Left over

- The change is uncommitted in the working tree: `src/wrap.mjs`, `tests/wrap.test.mjs`, `README.md` (modified), plus the run artifacts `ACCEPTANCE.md`, `CHANGES.md`, `REVIEW.md` at the project root and this run folder.
- The builder noted one design choice ACCEPTANCE.md line 10 leaves open: an over-long word that follows other words on a line starts on a fresh line rather than filling the remaining slack (`wrap("a abcdefgh b", 3)` → `"a\nabc\ndef\ngh\nb"`). It is tested explicitly; change it if the other reading is wanted.
- Compile-time warning W_HOMOGENEOUS_CRITICS (critic on the same tier as the builder) stands as reported in LEAD.md.
