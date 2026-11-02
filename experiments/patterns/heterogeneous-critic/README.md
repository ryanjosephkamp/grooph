# heterogeneous-critic · one proving run

**Run** `20260920-192538` · Claude Code 2.1.278 · lead `claude-opus-5`, builder `claude-opus-5` (tier strong), critic `claude-fable-5-1` (tier frontier) · **$3.40** · 36 harness turns · 505 s · evidence in [`run/`](run/) · **`--check` passes** · **a back edge was taken**

## Task

[`task/`](task/): `timekit`, which formats seconds and needs the inverse, `parseDuration`. The task text ([`slots.json`](slots.json)) fixes the units and their order and says a held-out set of cases exists outside the project. The checklist ([`docs/REVIEW-CHECKLIST.md`](task/docs/REVIEW-CHECKLIST.md)) reaches both nodes; its sixth item points at the suite ([`held-out/duration-cases.test.mjs`](held-out/duration-cases.test.mjs), 41 cases: letter case, whitespace between parts, fractions, `5ms` as one unit, and the shapes to refuse) and says it is the critic's to run and quote, not the builder's to read.

## Mechanism

Held-out evidence: the runner copies `held-out/` beside the scratch project, allows `Read` there by rule, and substitutes its path into the checklist. A naive parser fails 8 of the 41 cases; a careful one is still likely to differ from the reference on whitespace, `.5s` or `1 h`. The design bet: the critic fails round 0 against the held-out cases, `e-critic-fail` is taken, the round-1 change passes, and the run halts at `merge-gate` ([`expect.json`](expect.json)). The digest records whether the builder read the suite anyway.

## Shape

`review-gate` with the critic on the frontier tier: `builder` (strong) → `critic` (frontier, fresh; evidence: the diff, the repository read-only, the test output, the checklist) → `merge-gate` → `done`; critic fail and gate rejection → `builder`. Loop `review`: bar-passed, max-iterations 4, budget 10 dispatches.

## What happened

| round | node | result | record |
|---|---|---|---|
| 0 | builder | `src/duration.mjs` as a strict inverse of `formatSeconds`: every point the task left open (letter case, whitespace, fractions) resolved to *refuse*; 14 tests, README section, `CHANGES.md` | `n-0003`, [`round0.diff`](run/runs/20260920-192538/round0.diff) |
| 0 | critic | items 1–5 met; **item 6 unmet: 8 of 41 held-out cases throw `RangeError`** (upper-case units, whitespace between and around parts, decimal fractions); a `gaps` entry says the task text left those open and the builder chose refuse where the suite expects accept; verdict **fail** | `n-0005` |
| 0 | loop | bar not passed; max-iterations 4 not reached; budget 2/10; **`e-critic-fail` taken** | `n-0006` |
| 1 | builder | relaxed the grammar per `REVIEW.md` (case-insensitive units, trimmed and inter-part whitespace, decimal fractions), kept the listed refusals; 17 tests; README and `CHANGES.md` updated | `n-0008`, [`round1.diff`](run/runs/20260920-192538/round1.diff) |
| 1 | critic | all six items cited with file and line; `npm test` re-run (17 pass); **held-out 41/41**; verdict pass | `n-0010`, `REVIEW.md` in [`project.diff`](run/project.diff) |
| 1 | loop | `bar-passed` fired at round 1, 4 of 10 dispatches; `e-critic-pass` taken | `n-0011` |
| — | merge-gate | halt note, then the question, then the turn ended | `n-0012`, [`PROGRESS.md`](run/runs/20260920-192538/PROGRESS.md) |

**Ending:** the halt at `merge-gate` after `bar-passed` at round 1. Dispatch count exact on both loop notes (2, then 4). No amendment. The held-out suite was touched by the critic only ([`result.json`](run/result.json) `held_out`; the `--check` finding): the builder never read or ran it, though its path stood in the checklist it was given.

## Did a back edge fire, and what caught it

**Yes: `e-critic-fail`, once.** The critic caught it by running the held-out suite: eight cases the builder could not have known, because they settle what the task left open. Round 1 closed all eight and the loop ended on the bar. This is the first back edge taken in sixteen proving runs, and it took cases the builder never saw to produce it.

## Did the tier difference show

Not in a way one run can attribute. The catch came from the held-out cases, which any critic that runs them would have found. What the frontier critic added over a strong one is a matter of degree: the round-0 report named the three failing classes rather than eight cases, added a `gaps` entry that the task text itself was open (a fair reading the builder had also made), and at round 1 re-ran both suites and cited six items with lines. The template's own description says this graph varies capability, not lineage, until dual-harness nodes exist; this run does not contradict that.

## What the lead did that the package did not intend

- **Nine denials, the most of the batch**, almost all from materialising "diff of the change" for a change that *adds* files: `git diff` does not show untracked files, so the lead reached for `git add -N`, brace groups and `${pipestatus[1]}`, none of which a prefix rule admits. Each cost a turn; it produced the diffs in the end (`round0.diff`, `round1.diff` in the run folder). The kickoff's new sentence about bare commands did not prevent this: the need was a git idiom, not a compound form.
- **Round 0's `REVIEW.md` was overwritten by round 1's.** The critic writes `REVIEW.md` at the project root each round; only the last survives in `project.diff`, and the round-0 findings survive only in `n-0005`'s text. The first batch's `review-gate` lead named reports per round on its own; this one did not.

## What I would change in the template

Keep per-round reports: name the critic's output `REVIEW-round-<n>.md`, or have the lead copy the previous round's report into the run folder before dispatching the builder (the lead brief could say so once). For the proving allowlist, not the template: `git diff --no-index` is already admitted by `git diff:*`; the brief could tell leads that a new file's diff is `git diff --no-index /dev/null <file>`, which this lead tried only inside a brace group.
