# Handoff protocol

Sessions have no shared memory. Everything a worker needs to start, and everything the driver needs to reconcile, travels as files in this folder plus one pasted prompt.

## Layout

```
handoffs/
  README.md                      this protocol
  TEMPLATE-HANDOFF.md            driver → implementer
  TEMPLATE-HANDBACK.md           implementer → driver
  NNNN-<slug>/
    HANDOFF.md                   written by the driver before the session starts
    HANDBACK.md                  written by the implementer at the end
    REVIEW.md                    written by the driver after reconciling
```

`NNNN` is the slice number from `docs/PLAN.md`. A fix pass on the same slice appends to the same folder as `HANDBACK-2.md`, `REVIEW-2.md`.

## Lifecycle

1. **Driver drafts** `HANDOFF.md` from the template, on `main`, and commits it. The owner confirms the slice. No worker session starts before both.
2. **Owner pastes** the prompt block from `HANDOFF.md` into a fresh implementer session opened in this repo.
3. **Implementer** reads `HANDOFF.md`, then the listed files, works on branch `slice/NNNN-<slug>`, appends short status lines to the **In flight** entry in `docs/PROGRESS.md`, commits often, and finishes with `HANDBACK.md` (the `grooph-handback` skill writes it).
4. **Owner pastes** the handback's return prompt into the driver session.
5. **Driver reconciles**: reads the handback and the diff, writes `REVIEW.md` with a verdict (`proceed` · `fix pass` · `split`), merges or requests the fix pass, updates `PLAN.md`, `PROGRESS.md` and any decision records, commits and pushes.

## Rules for both sides

- The handoff's **allowed / forbidden changes** are a boundary, not a suggestion. Anything outside it goes in the handback's **Deviations** or **Leftovers**, not into the tree.
- Verification claims name the command and the observed result. "Tests pass" without the command is not a verification.
- Decisions the implementer made inside the boundary are recorded in the handback, with reasons; the driver promotes durable ones to `docs/decisions/`.
- A blocked slice ends early with an honest handback rather than a workaround outside the boundary.
