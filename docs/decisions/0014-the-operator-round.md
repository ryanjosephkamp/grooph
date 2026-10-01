# 0014 · The operator round: one session drives and builds; a map of sessions beside the graph

**Date:** 2026-09-30 · **Status:** accepted · **Deciders:** owner (the brief), driver

## Context

After a week's pause the owner restarted grooph with a brief ([`handoffs/briefs/operator-round-2026-09-30.md`](../../handoffs/briefs/operator-round-2026-09-30.md)). His work has grown past one session and its subagents: a long-lived Operator session in the cloud that starts and steers about a dozen cloud lanes, test runners and scheduled routines; a second project with its own lanes; Codex on the Mac; this account and this Mac. The repositories are the only links between them, plus the owner carrying prompts. He wants grooph to show that, wants pictures he can keep, and wants to watch subagents as they run. He likes the web app as it is.

Study one's finding stands (decision 0013): the graph earned its keep as a brake and a record, not as better output. This round builds on the record side.

## Decision

1. **One session drives and builds this round.** The owner's brief is the handoff. Slices 0024 to 0028 are each a branch `slice/NNNN-<slug>` and a pull request against `main`, with a `HANDBACK.md` in the slice folder saying what was verified, what was not, and what was assumed. There is no second session to write a `REVIEW.md`: the owner's review of the pull request is the review. The handoff protocol in `handoffs/README.md` is unchanged for work that goes to a separate implementer.
2. **The order changes.** Hook-written notes (slice 0021) and the live run view (the second half of slice 0023) move ahead of comparison study two and are widened to Codex, as slice 0027. The workflow-script target (0022) and the `prose` target (the first half of 0023) stay where they were. Study two (0019) and the Codex compile target (stage 9) wait for the owner's word, as does anything that starts many sessions.
3. **A graph stays one session and its subagents.** The lead is the main session and every other agent node is a subagent (`docs/graph-ir.md` §1 and §2). What spans sessions, harnesses, accounts and machines is a second kind of document, the **operation map**, which is drawn and validated and never compiled. It enters the contract through an amendment before any code.
4. **Observation never steers.** A hook that records a subagent starting or stopping appends one line to a file and exits; it writes nothing the harness reads back. What a hook can and cannot see in each harness is written down with its source, documented or observed, in `docs/subagents.md`.
5. **Small experiments are in scope; batches are not.** Finding out what a hook receives costs one or two short sessions and is done without asking. A study, a proving batch or anything with a ledger is asked for first.

## Consequences

- Stages 19 to 22 and slices 0024 to 0028 in `docs/PLAN.md`.
- `docs/HANDBACK-operator.md` closes the round: the version, how to install and run, the operation-map format with the sample, how to run the live view in each harness, and the known limits, for the Operator on the owner's other account.
- The README says what exists and what is planned.
