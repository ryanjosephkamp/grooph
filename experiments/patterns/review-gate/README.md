# review-gate · one proving run

**Run** `20260919-1236-k7q2` · Claude Code 2.1.276 · lead, builder and critic all `claude-opus-5` (tier strong) · **$1.45** · 27 harness turns (the lead counted 19) · 196 s · evidence in [`run-1/`](run-1/) (moved from `run/` when the template was re-proved after slice 0010, below) · **`--check` fails one assertion: no halt note at the gate** (below)

## Task

[`task/`](task/): add `truncate(text, max)` beside an existing `padStart`. The checklist ([`docs/REVIEW-CHECKLIST.md`](task/docs/REVIEW-CHECKLIST.md)) holds one requirement the task text ([`slots.json`](slots.json)) does not mention: a line for `truncate` under `## Unreleased` in `CHANGELOG.md`. The design bet was a first-round critic failure on that item, then a pass, then a halt at the merge gate.

## Shape

`builder` → `critic` (fresh; evidence: the diff, **the repository at the head commit, read-only** (new in this slice), the test output, the checklist) → `merge-gate` → `done`; a critic fail or a gate rejection goes back to the builder. Loop `review`: bar-passed, max-iterations 4, budget 40 turns.

## What happened

| round | node | result | record |
|---|---|---|---|
| 0 | builder | read the checklist on its first command, then wrote `truncate`, 4 tests and the `CHANGELOG.md` line | digest (`truncate--builder`), `n-0002`, [`CHANGES.md`](run-1/runs/20260919-1236-k7q2/CHANGES.md) |
| 0 | lead | **amended the working copy**: the checklist into the builder's inputs, and `owns` for both nodes | `n-0003` |
| 0 | critic | 6 of 6 items cited with file and line; ran `npm test`, `git status`, `git diff` itself; verdict pass | `n-0004`, [`REVIEW.md`](run-1/runs/20260919-1236-k7q2/REVIEW.md) |
| 0 | loop | bar-passed fired | `n-0005` |
| — | merge-gate | the lead asked in its final reply and stopped; `PROGRESS.md` says "waiting for the human" | `n-0006`, [`PROGRESS.md`](run-1/runs/20260919-1236-k7q2/PROGRESS.md), [`claude-output.json`](run-1/claude-output.json) |

**Stop:** bar-passed at round 0, then the gate. The run waits there in substance, but no note records a halt: the last note is `n-0006` at `edge:e-critic-pass` ("asking the human and waiting"). LEAD.md §7 says a session that cannot ask writes an `outcome: "halt"` note; this lead treated its reply as the question. That is what `--check` fails on.

## What the critic contributed

Here it confirmed rather than caught, because the hidden requirement never stayed hidden. The builder has `read-files` and read `docs/REVIEW-CHECKLIST.md` while exploring, and the lead's dispatch had already listed `CHANGELOG.md` among the files it may write (digest, the builder dispatch). On n-0008: the critic read `CHANGELOG.md`, `src/truncate.mjs` and the test file whole and ran `git status`/`git diff` (digest). The lead told it to treat the working tree as "the repository at the head commit", because the change was never committed; "head commit" did not fit an uncommitted change.

## What the lead did that the package did not intend

- **An amendment after the fact.** The builder ran with the checklist at 16:37 (transcript); the amendment adding it to the builder's inputs came at 16:38:46, after the builder reported the gap. It replays exactly onto the working copy, and no brake moved.
- **Timestamps estimated, not read.** `n-0002` says the builder ran 16:40–16:41; the transcript has it done by 16:38:09, and that note was written at 16:39.
- **It tried to open a branch** (`git checkout -b grooph/truncate-…`, denied); nothing in the package asks for one.
- Run id suffix `k7q2`, typed by hand after the random draw was refused. Seven permission denials ([`result.json`](run-1/result.json)): `tr`, `cp` and `git checkout`, which the allowlist does not name, and shell forms (`$(…)`, `$?`, `echo`, a heredoc).

## What I would change in the template

Put `{{checklist}}` in the builder's inputs: a builder reads the repository anyway, the 0004 run proposed it, and this lead amended it in. Say "the repository as the change leaves it, read-only" instead of "at the head commit". In the lead brief, one gate rule for both cases: write the halt note first, then ask.

## Re-proved after slice 0010

**Run** `20260920-172408` · the same task and slots on the hardened brief and template · **$1.36** · 22 harness turns · 257 s · evidence in [`run/`](run/) · **`--check` passes**

7 notes: 2 `started` lines, both node results with `cost: dispatches 1`, the loop pass with `"stop":"bar-passed"`, and the halt at `merge-gate` as the final note ([`notes.jsonl`](run/runs/20260920-172408/notes.jsonl)). The run id is the clock's, and every timestamp is in append order. The builder, now holding the checklist as an input, wrote the `CHANGELOG.md` line at once; the critic cited all six items and ran `npm test` itself; the lead wrote the halt note at `merge-gate` before asking, so `--check` passes. Two permission denials, both compound `&&` commands. No amendment: the checklist no longer has to be added by hand.
