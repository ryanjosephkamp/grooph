# Run 20260919-0057-66c8 · Slice 0007 sandwich

**Goal.** Implement grooph slice 0007 in apps/web: browse, use, insert and save-as templates in the app (built-ins bundled), plus editing polish: undo, storage persistence request, toolbar clear of the open sheet, rename warning for exported graphs. Done when `pnpm -r build && pnpm -r test && pnpm --filter @grooph/web test:e2e` passes and a critic finds nothing unmet in handoffs/0007-web-templates/HANDOFF.md.

**Branch.** `slice/0007-web-templates` · **Working copy.** `graph.grooph.json` in this folder (amended, see below)

## Position

- **Round:** 1 (e-critic-fail taken after pass 0)
- **Lead turns used:** ~27 of 80 (budget stop; a turn is one lead tool-use cycle, counted by hand)
- **Now:** `critic` running (round 1) on head 83509ab
- **Last stop check:** before round 1 — bar not passed; max-iterations 1/5; budget ~22/80 turns. None fired.

## Nodes

| node | status | last result |
|---|---|---|
| `builder` | done | round 1: 44 px floor on `.btn-small`, three non-blocking findings settled (4e39a0a, 83509ab) |
| `checks` | pass | round 1: exit 0 at 83509ab (`round-1/check-output.txt`) |
| `critic` | running | round 1 dispatched (round 0: fail on criterion 11) |
| `done` | pending | — |

## Rounds

| round | builder | checks | critic |
|---|---|---|---|
| 0 | done (6 commits) | pass | fail: criterion 11, one touch target |
| 1 | done (2 commits) | pass | running |

## Amendments

1. **n-0002 · kickoff.** `constraints.other` said "Touch apps/web only", which contradicts the owner-confirmed handoff: criterion 10 needs `packages/core`, `packages/cli`, `fixtures/` and `patterns/*.expect.json`, so the bar could never pass. The constraint now names the handoff's allowed paths exactly, forbidden paths unchanged. Builder and critic outputs now name where `CHANGES.md` and `REVIEW.md` go (`round-<n>/` in this folder), so the critic's `REVIEW.md` never lands on the driver's `handoffs/0007-web-templates/REVIEW.md`. No brake touched. Ops: `amend-01.ops.json`.

## Proposals

1. **n-0008 · critic evidence.** Round 0 left three points unjudgeable from a diff alone (CLI `template add` accepting the app's download, the Export panel's "Download graph" action, graph-ir §3 wording). Proposal: let the critic also read, read-only at the head commit, the files the diff touches or calls into. Widening a critic's evidence touches critic isolation, so it is for the human, not an amendment.

## Observations

- CI green at 36ccf81 (run 35423741584): criterion 1.
- The critic's evidence diff is written to `round-<n>/change.diff` and left untracked (reproducible as `git diff -U12 origin/main..<head> -- . ':(exclude).grooph/**' ':(exclude)*.png'`).

- The graph's `description` says "at fifty turns" while its budget stop says 80. The run follows the stop (80); the description is stale text for the human to fix.
