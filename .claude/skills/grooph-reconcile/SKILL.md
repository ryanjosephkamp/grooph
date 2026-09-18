---
name: grooph-reconcile
description: Driver-side. Reconcile an implementer's handback for a grooph slice: verify independently, write handoffs/NNNN-<slug>/REVIEW.md with a verdict (proceed, fix pass, split), merge or request the fix pass, and bring PLAN, PROGRESS and decision records up to date. Use when the owner pastes a handback prompt.
---

# grooph-reconcile

You are the driver. A handback is a claim; the review is where it becomes fact.

## Steps

1. **Fetch and read.** `git fetch`, check out the slice branch, read `HANDBACK.md`, then `git diff main...slice/NNNN-<slug> --stat` and the changed files. Compare touched paths against the handoff's forbidden list first.
2. **Verify independently.** Run the handoff's verification commands yourself. Where the acceptance test needs a harness session (for example "a fresh Claude Code session runs the package"), run it with the harness in non-interactive mode if the handoff allows, or record that it is owner-run and must precede merge.
3. **Review the code** against the spec constraints and `docs/graph-ir.md` rules named in the handoff. Findings are concrete: file, line, what breaks, what to do.
4. **Write `REVIEW.md`** in the slice folder: verdict `proceed` · `fix pass` · `split`; findings; decisions from the handback to promote to `docs/decisions/` (write them); deviations accepted or rejected.
5. **Act on the verdict.**
   - `proceed`: merge into `main` with a merge commit `merge: slice NNNN <title>`, delete nothing, push.
   - `fix pass`: draft `FIXPASS-<n>.md` with the `grooph-handoff` skill (same folder), commit, present the prompt, stop.
   - `split`: update the slice ledger with the new slices, draft the first, present, stop.
6. **Update the living docs** in the same commit as the merge or the fix-pass draft: `docs/PLAN.md` ledger and stage status, `docs/PROGRESS.md` (Now, Done, Waiting on the owner, Known risks), `spec/AMENDMENTS.md` if the slice forced one.
7. **Report** to the owner in a few lines: verdict, what was verified and how, what changed in the plan, what waits on them.

Done when `REVIEW.md` is committed, the verdict has been acted on, the living docs match the tree, and `main` is pushed.
