# Pattern proving ground

One recorded headless Claude Code run per template, on a small task designed so the template's point can show. Each folder holds the task (`task/`), the slot values (`slots.json`), what the check asserts (`expect.json`), the evidence (`run/`) and a one-screen write-up (`README.md`). A write-up says what happened in one run (spec §15); it does not claim the template beats anything.

`scripts/prove-pattern.sh <id>` makes a run; `--dry-run` does everything but the model call, and `--check <id>/run` re-asserts on the evidence. [`ledger.json`](ledger.json) records every model call and its cost.

## First batch (slice 0009, 2026-09-19)

Claude Code 2.1.276; the lead ran on `claude-opus-5` in every run.

| Template | Run | Passes | Stop fired | Ending | Cost | Harness turns | Amendments | Denials | `--check` |
|---|---|---|---|---|---|---|---|---|---|
| [`grind-loop`](grind-loop/README.md) | `20260919-1230-k7qm` | 1 | none (check passed) | stop node `done` | $0.66 | 16 | 0 | 3 | pass |
| [`contradiction-seeker`](contradiction-seeker/README.md) | `20260919-1233-k7qm` | 1 | bar-passed | stop node `done` | $1.06 | 18 | 0 | 8 | pass |
| [`review-gate`](review-gate/README.md) | `20260919-1236-k7q2` | 1 | bar-passed | waits at `merge-gate`, **no halt note** | $1.45 | 27 | 1 | 7 | **fail** (ending) |
| [`metric-sandwich`](metric-sandwich/README.md) | `20260919-1241-k7qm` | 1 | bar-passed | stop node `done` | $1.49 | 20 | 0 | 4 | pass |
| [`spec-then-loop`](spec-then-loop/README.md) | `20260919-1245-k7qz` | 1 (critic ran twice) | bar-passed | stop node `done`, after one **scripted** approve at `spec-gate` (no halt note there) | $2.33 | 45 | 1 | 10 | **fail** (first halt) |

**Spend:** $7.01 of the $25.00 cap: $6.99 on the five runs and $0.02 on a two-call harness probe that showed a resumed session reports only its own cost ([`ledger.json`](ledger.json), invocations 1–2).

## Re-proving after slice 0010 (2026-09-20)

The two gate templates again, on the hardened brief and templates, with `--retry "0010 hardening"`; the first batch's evidence moved to `run-1/` beside the new `run/`. Claude Code 2.1.276; lead on `claude-opus-5`; `--strict-mcp-config`, and `echo`, `cp`, `tr` allowed.

| Template | Run | Passes | Stop fired | Ending | Cost | Harness turns | Amendments | Denials | `--check` |
|---|---|---|---|---|---|---|---|---|---|
| [`review-gate`](review-gate/README.md#re-proved-after-slice-0010) | `20260920-172408` | 1 | bar-passed (`stop` on the loop note) | **halt note** at `merge-gate`, then the ask | $1.36 | 22 | 0 | 2 | pass |
| [`spec-then-loop`](spec-then-loop/README.md#re-proved-after-slice-0010) | `20260920-172850` | 1 | bar-passed (`stop` on the loop note) | **halt note** at `spec-gate`, scripted approve, then `done` | $2.44 | 35 | 0 | 14 | pass |

Both run ids are the clock's (`<yyyymmdd-hhmmss>`), both records carry `started` lines and clock timestamps in order, and both leads counted dispatches against the budget. The `spec-then-loop` critic, now with the repository read-only, passed the answer key at round 0 where the first run returned `invalid-evidence`. Still no back edge taken.

**Spend:** $3.80 for the three invocations ([`ledger.json`](ledger.json), invocations 9–11); $10.81 of the $25.00 cap in all.

## What the batch showed

- **No run needed a second round.** Every builder passed at its first attempt. In `review-gate` and `metric-sandwich` the builder read the checklist in the repository (it is not among their declared inputs), so the items meant to stay open were closed before judging. In `contradiction-seeker` the builder fixed the planted defect because the claim is one of its inputs. The critics confirmed; none caught.
- **The critics used the repository where they had it.** The `metric-sandwich` critic searched the whole tree for stale wording, a check a diff-only critic cannot make. The `spec-then-loop` critic, which has no repository access, returned `invalid-evidence` on an answer-key line that pointed at an unchanged file.
- **Both gate runs waited without a halt note.** Each lead asked in its final reply, where LEAD.md §7 wants an `outcome: "halt"` note in a session that cannot ask.
- **The record is weaker than the work.** Note timestamps were estimated (some out of order with the transcripts). The four leads with a turn budget counted turns differently: 2, 4 (worker dispatches), 16 and 19, against 18 to 45 harness turns. Run ids were typed by hand after the random draw was refused: `k7qm` in three of five runs, as in both earlier runs on record.
