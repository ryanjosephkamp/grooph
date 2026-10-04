# 0023 · Who merges what

**Date:** 2026-10-04 · **Status:** accepted (the owner's words, 2026-10-04) · **Deciders:** owner, driver · **Replaces:** point 3 of decision 0015 ("a merge waits for his word")

## Context

Since the operator round every merge to `main` has waited for the owner's "approved". That was right while the driver was new to the repository. It is now the slowest step: on 2026-10-04 one pull request held sixteen slices for a night. The owner wants several lanes at work at once, and said: "you can review the work accordingly and merge anything reasonable and leave bigger merges for me."

## Decision

1. **The driver merges a pull request without asking when all of these hold.**
   - CI is green on its head: every job, read line by line.
   - Someone other than its author has read it. For a lane's pull request that is the driver. For the driver's own, a fresh subagent, when it changes code.
   - It is one of: documents; tests; a fix with a test that fails without it; a change with no visible effect; or a slice the owner has already said yes to on the review desk, that stayed inside its handoff.
   - It is none of the things in point 2.
2. **These wait for the owner, always.**
   - A change to the product contract: the spec, an amendment, a decision record that changes a rule.
   - A new or changed claim about what grooph is shown to do, and anything that touches evidence.
   - Anything that spends: a model session started by command, a study, a proving run.
   - A new dependency, or a change of stack.
   - A change to what the compiler writes or to a template, beyond spelling: a package change goes through a proving run.
   - A release: a version, a tag, a publish to npm.
   - A new screen, a new command, a new document format, or a change a person would notice on the site without being told.
   - Anything outside this repository.
   - A removal a person would miss.
   - More than about 400 lines of hand-written code in one pull request.
3. **What waits is put on the review desk** with a recommendation, the pull request, and what the owner should look at. "Approved" there, or in the chat, is his word.
4. **Every merge made without asking is listed on the desk**, with its pull request and one line on why it qualified, so the owner can read what was done in his name and say when the line was drawn in the wrong place.
5. **After a merge** the driver watches CI on `main`. A red `main` is fixed or reverted before anything else is merged.
6. **Small changes need no handoff.** A change that qualifies under point 1 and fits in one sitting is a branch and a pull request whose description is the record. Handoffs and handbacks are for slices.
7. Merge commits, never squash or rebase. A pushed branch is never rewritten.

## Consequences

- `AGENTS.md` says "the driver merges what decision 0023 allows" where it said merges wait for the owner's word.
- The owner reads less and decides more: what reaches him is what changes the product, the claims, the spend or the contract.
- The line is a judgment. When in doubt the driver asks. The list on the desk is how a wrong judgment gets caught.
