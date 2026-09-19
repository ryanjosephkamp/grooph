# Run 20260919-0057-66c8 · Slice 0007 sandwich

**Goal.** Implement grooph slice 0007 in apps/web: browse, use, insert and save-as templates in the app (built-ins bundled), plus editing polish: undo, storage persistence request, toolbar clear of the open sheet, rename warning for exported graphs. Done when `pnpm -r build && pnpm -r test && pnpm --filter @grooph/web test:e2e` passes and a critic finds nothing unmet in handoffs/0007-web-templates/HANDOFF.md.

**Branch.** `slice/0007-web-templates` · **Working copy.** `graph.grooph.json` in this folder (amended once, see below)

## Outcome

**Ended at stop node `done` (success).** Loop `sandwich`'s stop 1, **bar passed**, fired after round 1: the check exited 0 at 83509ab, CI was green at 926ce74, and the critic found no unmet item in the handoff.

- **Rounds:** 1 (two passes through the loop; one back edge taken, `e-critic-fail`)
- **Lead turns used:** ~31 of 80 (budget stop; a turn is one lead tool-use cycle, counted by hand)
- **Last stop check:** after round 1: stop 1 bar passed fired; max-iterations 1/5; budget ~31/80. The run took `e-critic-pass` to `done`.

## Nodes

| node | status | runs | last result |
|---|---|---|---|
| `builder` | done | 2 | round 0: criteria 1–11 implemented (daebea8..0b52a82); round 1: 44 px floor on `.btn-small`, three non-blocking findings settled (4e39a0a, 83509ab) |
| `checks` | pass | 2 | exit 0 at 0b52a82 and at 83509ab (`round-<n>/check-output.txt`) |
| `critic` | pass | 2 | round 0: fail, criterion 11 (storage notice "Got it" ~33 px); round 1: pass |
| `done` | reached | 1 | success |

## Rounds

| round | builder | checks | critic |
|---|---|---|---|
| 0 | done (6 commits) | pass | fail: criterion 11, one touch target under 44 px |
| 1 | done (2 commits) | pass | pass |

## Amendments

1. **n-0002 · kickoff.** `constraints.other` said "Touch apps/web only", which contradicts the owner-confirmed handoff: criterion 10 needs `packages/core`, `packages/cli`, `fixtures/` and `patterns/*.expect.json`, so the bar could never pass. The constraint now names the handoff's allowed paths exactly, forbidden paths unchanged. Builder and critic outputs now name where `CHANGES.md` and `REVIEW.md` go (`round-<n>/` in this folder), so the critic's `REVIEW.md` never lands on the driver's `handoffs/0007-web-templates/REVIEW.md`. No brake touched. Ops: `amend-01.ops.json`.

The working copy validates `--for-export` clean. Adopt it as version 2 of the graph or discard it: that is the human's call.

## Proposals

1. **n-0008 · critic evidence.** Round 0 left three points unjudgeable from a diff alone: the CLI's `template add` accepting the app's download, the Export panel's "Download graph" action, and the graph-ir §3 wording. Round 1 left the same kind (plus `.chip` and `.icon-btn` heights). The proposal is to let the critic also read, read-only at the head commit, the files the diff touches or calls into. Widening a critic's evidence touches critic isolation, so this is for the human, not an amendment.

## What the critic caught that the checks did not

- Round 0, blocking: the storage notice's only control, "Got it", was `btn btn-small`, about 33 CSS px tall on a phone, under criterion 11's 44 px floor. The fix raised `.btn-small` to 44 px, which also fixed four older small buttons, and an e2e now measures it.
- Round 0, non-blocking. The builder fixed all three in round 1, each with an e2e test:
  - window-level Cmd/Ctrl+Z undid the document while the person typed in the Insert and Save-as-template forms;
  - Use left Create graph disabled after an unexpected error;
  - list fields might make one undo step per keystroke. Fixing this also turned up blank-line typing that made empty undo steps.
- Round 1, observations only:
  - the id map has no own-undo guard;
  - number-field keystrokes are separate undo steps;
  - a focused list field's text can lag an undo until blur.

## Observations

- CI green at 36ccf81 (run 35423741584) and at 926ce74 (run 35424266093): criterion 1.
- The critic's evidence diffs were written to `round-<n>/` and deleted after the run. They are reproducible as `git diff -U12 origin/main..<head> -- . ':(exclude).grooph/**' ':(exclude)*.png'` with head 0b52a82 (round 0) and 83509ab (round 1), plus `0b52a82..83509ab` for round 1's delta.
- The graph's `description` says "at fifty turns" while its budget stop says 80. The run followed the stop; the description is stale text for the human to fix.
