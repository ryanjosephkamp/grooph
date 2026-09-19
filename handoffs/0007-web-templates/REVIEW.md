# Review 0007 · Templates in the app and editing polish

**Reviewer:** driver (Fable 5.1) · **Handback:** `HANDBACK.md` at `c6edf87` · **Date:** 2026-09-19 · **Route:** B (grooph run `20260919-0057-66c8`)

## Verdict

`fix pass` — two small gaps, both confirmed; everything else verified. The branch is not merged yet. Fix pass: `FIXPASS-1.md`.

## Verified independently

| Check | Command | Observed |
|---|---|---|
| Branch on GitHub, in sync, inside the boundary | fetch; rev-parse; name filter | identical heads (`c6edf87`); nothing outside the allowed paths |
| Cold build and tests | `pnpm install --frozen-lockfile && pnpm -r build && pnpm -r test` | core 210, cli 45, web 39, 0 failures |
| Browser suite | `pnpm --filter @grooph/web test:e2e` | 35 passed |
| CI | `gh run list --branch slice/0007-web-templates` | green |
| Run record | read `notes.jsonl` (15 lines) and diffed the working copy against the source | round 0 critic fail, round 1 critic pass, `bar-passed`, stop node `done`; one kickoff amendment (three string fields), one proposal; no brake touched; source untouched |
| Gap, criterion 11 | `grep` in `apps/web/src/styles.css` | `.chip { min-height: 40px }`; `.btn-small` is 44 px |
| Gap, criterion 5 | `SaveTemplatePanel.tsx` has no validation call; `grooph template save … --fragment --nodes builder,critic` on the review loop | the CLI refuses ("1 error … loop stayed behind"); the app stores the same fragment |

## What this run showed about grooph itself

1. **The kickoff amendment corrected the driver's design error.** The placed graph said "Touch apps/web only" while criterion 10 needs core, CLI and fixtures. The lead amended the constraint to the handoff's paths, with a reason, before dispatching anyone. That is adaptation doing the job it was added for. The skill now says: copy path limits from the project's own source of truth instead of paraphrasing them.
2. **The critic earned its cost.** Checks passed in both rounds. Round 0 the critic failed the change on a 33 px control and named three non-blocking undo defects; all four were fixed with tests in round 1, and the touch-target fix repaired four older buttons too.
3. **A diff-only critic has a blind spot, and the lead named it.** Both post-run gaps sit outside the diff (an old CSS class; behaviour the CLI has and the app lacks). Proposal n-0008 asks to let the critic read, read-only at the head commit, the files the diff touches or calls into. **Accepted in principle:** isolation is about not inheriting the builder's context and claims, not about hiding the repository. The `metric-sandwich` and `review-gate` patterns and the design skill should hand critics the head commit read-only plus the diff. Scheduled with the pattern proving ground, where it can be measured.
4. **The lead did not grade its own work** and appended progress lines only on critic verdicts. It also did not reopen a run that had reached its stop node; it reported the gaps in the handback instead. Correct on both counts.
5. **Turn accounting by hand** (about 31 of 80) remains approximate. Known; stage 7's hook-written events are the fix.
6. The graph's `description` still said "fifty turns" after the driver raised the budget to 80. Driver's slip at placement; descriptions that restate brake values go stale. The skill now says not to restate them.

## Deviations

Accepted: the kickoff amendment; commits that do not build one by one (the tip is the unit); reporting partly-unmet criteria instead of reopening the run.

## Decisions on the run's open items

- **Working copy:** adopt as version 2 of `slice-0007-sandwich` after the fix pass merges (the amended constraint is simply correct).
- **Proposal n-0008:** accepted in principle, as above.
