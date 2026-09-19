# metric-sandwich · one proving run

**Run** `20260919-1241-k7qm` · Claude Code 2.1.276 · lead and builder `claude-opus-5` (tier strong), critic `claude-fable-5-1` (tier frontier) · **$1.49** · 20 harness turns (the lead counted 16) · 182 s · evidence in [`run/`](run/)

## Task

[`task/`](task/): switch `paginate` from zero-based to one-based pages and add `pageCount` ([`slots.json`](slots.json)). The check is `npm run check`: a small lint (line length, `var`, `console.log`, a doc comment on every export) and the tests. The checklist ([`docs/REVIEW-CHECKLIST.md`](task/docs/REVIEW-CHECKLIST.md)) holds what the check cannot see: the module comment and the README still describing zero-based pages, a `pageSize` of 0 answered with `Infinity` instead of refused, and names. A minimal change passes the check with four of its five items open (tried before the run).

## Shape

`builder` → `checks` (`npm run check`, pass on exit 0) → `critic` (fresh; evidence: the diff, **the repository at the head commit, read-only** (new in this slice), the checklist) → `done`; a check failure or a critic fail goes back to the builder. One loop, two back edges: bar-passed, max-iterations 5, budget 50 turns.

## What happened

| round | node | result | record |
|---|---|---|---|
| 0 | builder | read the checklist on its first command; one-based pages, `pageCount`, `RangeError` refusals with tests, README and module comment updated | digest (`pages-from-one--builder`), `n-0002`, [`CHANGES-r0.md`](run/runs/20260919-1241-k7qm/CHANGES-r0.md), [`project.diff`](run/project.diff) |
| 0 | checks | the lead ran `npm run check`: lint clean, 11/11 tests | `n-0003` |
| 0 | critic | 5 of 5 items hold, each cited by line; verdict pass | `n-0005`, [`REVIEW-r0.md`](run/runs/20260919-1241-k7qm/REVIEW-r0.md) |
| 0 | loop | bar-passed fired | `n-0006` |
| — | done | success | `n-0007` |

**Stop:** bar-passed at round 0, then the stop node `done`. Working copy not amended.

## What the sandwich contributed

The order held: the critic was dispatched only after the check passed, was told so, and did not rerun it (it ran no command at all; digest). No back edge was taken, so the run does not show either failure path. As in `review-gate`, the builder read the checklist in the repository, so the items meant to stay open were closed before any judging.

On n-0008, the critic used the repository beyond the diff: it read `src/paginate.mjs` and `README.md` whole and searched the tree for "from 0", "page 0" and "zero-based" to show no stale wording remained outside the diff ([`REVIEW-r0.md`](run/runs/20260919-1241-k7qm/REVIEW-r0.md), item 1). A diff-only critic could not make that check. The lead recorded the wording gap in `n-0004`: "the edge says 'repository at the head commit' but the run does not commit, so the critic reads the working tree".

## What the lead did that the package did not intend

- **It named reports per round** (`REVIEW-r0.md`, `CHANGES-r0.md`), announced in `n-0001`. The runner's first check looked for `REVIEW.md` only and reported the critic's report missing; the check now accepts a round suffix.
- **Timestamps estimated.** `n-0003` has the check ending 16:43:15 and `n-0005` has the critic starting 16:43:05; the transcript has the check at 16:42:39 and the critic dispatched at 16:43:02.
- Run id suffix `k7qm` again. Four permission denials, all the lead's (`$(…)`, `tr`, `echo`, a heredoc).

## What I would change in the template

The same wording change as `review-gate`: "the repository as the change leaves it, read-only". And give the builder `{{checklist}}` as an input: a builder reads it anyway. The sandwich then keeps its point, since the check still screens before an expensive critic.
