# Review 0008 · Runs: notes back, adoption, and the monitor

**Reviewer:** driver (Fable 5.1) · **Handback:** `HANDBACK.md` at `c96a168` · **Date:** 2026-09-19

## Verdict

`proceed` — merged into `main`.

## Verified independently

| Check | Command | Observed |
|---|---|---|
| Branch on GitHub; boundary | fetch; name filter against the allowed list | nothing outside; `patterns/`, `scripts/`, `experiments/` untouched |
| Cold build and tests (in the slice's worktree) | `pnpm install --frozen-lockfile && pnpm -r build && pnpm -r test` | core 234, cli 58, web 49, 0 failures |
| Browser suite | `pnpm --filter @grooph/web test:e2e` | 50 passed |
| CLI on the real run | `grooph runs list`; `grooph adopt <run>` | one run listed (`ended · pass · 1 round · bar passed`); `adopt` reports that the source is already version 2 and that `--write` would be refused, which is correct: the driver adopted by hand before this slice existed |
| Run view | read `run-live-phone-light.png` | running node ringed with a "running" badge, passed and pending labelled, loop round shown, timeline newest first, "not stored until you save" |
| Merged tree | build and tests on `main` after both merges | core 234, cli 58, web 49 |

## Findings

1. **The driver's handoff was wrong about "three real run folders".** The two acceptance runs lived in temp scratch folders; only the slice-0007 run is in the repo. The implementer built synthetic fixtures for the other shapes. The proving ground has since added five more real records.
2. **`lineage.from` on adoption** names the previous version of the same graph, as `docs/runs.md` says; the driver's hand adoption kept the template lineage. The doc stands; recorded in `docs/runs.md` §5.
3. **The stop that fired is inferred from note text.** `RunNote` gains `stop` on loop notes (graph-ir §6); the lead brief writes it from slice 0010 on.
4. **Timestamps in real notes are unreliable** (one note ends before it starts). graph-ir now says: from the clock or omitted. The timeline's append order is the right call.
5. `#/run/<key>` and `#/g/<key>` throw on a malformed `%` escape. Small; carried into 0010.
6. The started-note sentence is now in `docs/targets/claude-code.md`.

## Deviations

Both accepted (`lineage.from`; one real run folder).
