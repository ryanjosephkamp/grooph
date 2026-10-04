---
name: grooph-handback
description: Implementer-side. Finish a grooph slice by re-running its verification, writing handoffs/NNNN-<slug>/HANDBACK.md, pushing the slice branch, and printing the prompt the owner pastes back into the driver session. Use at the end of a slice, or when a slice is blocked and must be returned early.
---

# grooph-handback

You are the implementer. The driver will see only the repo and your handback, so the handback must let them reconcile without asking you anything.

## Steps

1. **Settle the tree.** Every change committed on `slice/NNNN-<slug>`; `git status` clean. Uncommitted experiments are either committed or discarded, and discarded ones are mentioned under Leftovers if they carried a lesson.
2. **Re-verify from cold.** Run every command in the handoff's **How to verify** section now, not from memory. Record the exact command and observed result for each success criterion; an unmet criterion is written as unmet.
3. **Write `HANDBACK.md`** from `handoffs/TEMPLATE-HANDBACK.md`, next to the `HANDOFF.md` you worked from. Status is one of `done`, `needs fix pass`, `blocked`. Decisions carry reasons; deviations name the rule they departed from.
4. **Leave `docs/PROGRESS.md` and `docs/PLAN.md` alone.** With several lanes at work they are the driver's (`handoffs/README.md`, "Lanes"); the handback's first lines carry the status word and the head commit.
5. **Commit and push:** `handoffs: handback NNNN` on the slice branch. Confirm the push succeeded. Then **open a pull request** against `main` whose description names the handback, and do not merge it: the driver does, or puts it to the owner (decision 0023).
6. **Print the return prompt** from the handback's last section, verbatim, as the final thing in your reply.

Done when the branch is pushed with `HANDBACK.md` on it and the return prompt is the last block of your reply.
