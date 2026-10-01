# Handback 0037 · The Operator's answers; the corrected sample map; Codex in worktree mode

**Branch:** `slice/0037-operator-answers` (stacked on 0036) · **Date:** 2026-10-01 · **By:** the operator-round session (Opus 5.5) · **Spend:** none

The owner brought back the Operator's reply to `docs/HANDBACK-operator.md`: its answers to the nine questions, the real operation map, and six things wrong or missing in grooph 0.1.0. He had also run the Codex prompt once more in the app's worktree mode. This slice takes in the answers; slices 0038 to 0040 fix what the Operator found.

## What changed

- **The sample map is the Operator's.** `fixtures/maps/valid/owner-operation-2026-10-01.grooph-map.json`: three lanes, eight sessions (twenty-one counting families), eighteen handoffs, three that wait on a person. The first draft (seven sessions, ten handoffs, drawn from the brief with guesses) stays as a fixture: most tests were written against it, and the difference between the two is worth keeping.
- **`docs/HANDBACK-operator.md`**: what each answer changed (§8); the list of what the Operator found, with its state (§12); `CI=true pnpm install` for an install without a terminal (§2).
- **Codex in worktree mode is recorded** (`experiments/hooks/2026-10-01/codex-9-desktop-worktree-reviewed-hook/`): the app's own copy of the repository recorded the chat and both subagents with no further review. The owner's review and the folder's trust carry into the app's copies.

## Verified

| Claim | How | Result |
|---|---|---|
| The Operator's map is valid as sent | `grooph validate` on the file the owner attached | no issues; 3 by hand |
| The sample in the repository is valid and canonical | `pnpm --filter @grooph/core test` | passes, with a test of its shape |
| The worktree run was recorded | read `~/.codex/worktrees/7a32/grooph/.grooph/events/` | a session start, a turn, two subagents with start and stop |
| Where the worktree run's extra time went | the hook's timestamps and the transcript header | 43 s before the turn, 49 s before the first subagent, 6 s a subagent against 1 to 2; not in anything the hook does |
| The ledger | `node experiments/hooks/check.mjs` | every row matches its transcripts |

## Decisions made here

- **The public sample leaves out the product's details.** The Operator's file names internal branch names, routine times and what the product's pieces are. This repository is public, and the owner's brief said to keep the sample generic where a detail is not needed. The shape, the counts, the carriers and the tool names are the Operator's; nine strings were made generic. The Operator's own file and its answers stay with the owner, outside the repository.
- **The Operator's answers are summarised, not copied in**, for the same reason.

## Not verified

- What the Codex app was doing in the two gaps of the worktree run.
- The hook in a cloud session: the Operator has not tried it yet.
