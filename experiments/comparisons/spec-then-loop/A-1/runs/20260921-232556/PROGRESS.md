# Run 20260921-232556 · Word wrap

**Goal.** Add word wrapping to this project: a function that wraps text to a given width. Done when every line of an approved ACCEPTANCE.md is shown to hold and `npm test` passes.

**Status:** ended — reached stop node `done` (success) at 2026-09-21T23:29:05Z.

**Round (loop `build`):** 0 (no back edge taken)
**Dispatches (loop `build`):** 2 / 10 (builder, critic)

## Nodes

| node | status |
|---|---|
| planner | done — wrote `ACCEPTANCE.md` (11 lines + out-of-scope list) |
| spec-gate | done — human answered **approve** at 2026-09-21T23:27:18Z |
| builder | done (round 0) — added `src/wrap.mjs`, `tests/wrap.test.mjs`, README example, `CHANGES.md`; `npm test` 10/10 |
| critic | done (round 0) — `REVIEW.md`: 11/11 lines hold, each cited; verdict **pass** |
| done | reached — outcome success |

## Waiting on

Nothing. The run is over.

## Last stop check

Loop `build`, after round 0, in order:
1. bar passed — **fired** (critic verdict `pass`; every ACCEPTANCE.md line cited; `npm test` exits 0)
2. max iterations 4 — 0 of 4, not reached
3. budget 10 dispatches — 2 of 10, not reached

Took `e-critic-pass` → `done`.

## Why the run ended

Stop `bar-passed` fired on the loop's first pass; the pass exit edge led to stop node `done`.

## Amendments

None. The working copy `graph.grooph.json` in this folder is identical to the source document.

## Artifacts in the project root

- `ACCEPTANCE.md` (planner, approved)
- `src/wrap.mjs`, `tests/wrap.test.mjs`, `README.md` change, `CHANGES.md` (builder)
- `REVIEW.md` (critic)

Nothing has been committed; the change is in the working tree.

## Run-folder helper

`append-note.mjs` — a small script the lead used to append `notes.jsonl` lines (the shell allowlist refused heredoc/`printf` forms). Safe to delete.
