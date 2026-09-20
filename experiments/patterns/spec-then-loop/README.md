# spec-then-loop · one proving run

**Run** `20260919-1245-k7qz` · Claude Code 2.1.276 · lead, builder and critic `claude-opus-5` (tier strong), planner `claude-fable-5-1` (tier frontier) · **$2.33** in two invocations ($0.79 to the gate, $1.53 after it) · 45 harness turns (15 + 30; the lead counted 4) · 331 s · evidence in [`run-1/`](run-1/) (moved from `run/` when the template was re-proved after slice 0010, below) · **the gate approval was scripted** · **`--check` fails one assertion: no halt note at the gate** (below)

## Task

[`task/`](task/): a tiny package with `countWords`. The ask ([`slots.json`](slots.json)) is deliberately thin: "Add word wrapping to this project: a function that wraps text to a given width." Name, file, long words, whitespace and newlines are all left open for the planner.

## Shape

`planner` → `spec-gate` (human) → `builder` → `critic` (fresh; evidence: the diff, the test output, `ACCEPTANCE.md`) → `done`; a critic fail goes back to the builder. Loop `build`: bar-passed, max-iterations 4, budget 40 turns; the bar is the planner's `ACCEPTANCE.md` (`answerKeyFrom: planner`).

## What happened

| step | node | result | record |
|---|---|---|---|
| — | planner | 16 checkable items with examples, plus an out-of-scope list; flagged one call for the human (input newlines collapse, item 12) | `n-0002`, [`ACCEPTANCE.md`](run-1/runs/20260919-1245-k7qz/ACCEPTANCE.md) |
| — | spec-gate | the lead asked in its reply, surfacing item 12, and the session ended | `n-0003`, [`claude-output.json`](run-1/claude-output.json) |
| — | **scripted** | the runner resumed the same session once: "Answer at the gate `spec-gate` of run `20260919-1245-k7qz`: approve." | [`prompts/resume.md`](run-1/prompts/resume.md), `n-0004` |
| 0 | builder | `src/wrap.mjs`, 12 tests (13/13 with the existing one), a README example | `n-0006`, [`CHANGES.md`](run-1/runs/20260919-1245-k7qz/CHANGES.md) |
| 0 | critic | **invalid-evidence**: 15 of 16 items held; item 1 ("JSDoc in the style of `src/count.mjs`") names a file the diff does not show | `n-0008`, [`REVIEW.round-0-invalid-evidence.md`](run-1/runs/20260919-1245-k7qz/REVIEW.round-0-invalid-evidence.md) |
| 0 | lead | **amended**: the critic's evidence gains the unchanged files `ACCEPTANCE.md` names as a reference; the loop gains an `evidence-invalid` stop at 2 | `n-0009` |
| 0 | critic | fresh critic, same round: 16 of 16 hold, each cited; verdict pass | `n-0010`, [`REVIEW.md`](run-1/runs/20260919-1245-k7qz/REVIEW.md) |
| 0 | loop | bar-passed fired | `n-0011` |
| — | done | success | `n-0012` |

**Stop:** bar-passed at round 0, then the stop node `done`. The first invocation ended at the gate, but its last note is `n-0003` ("asked the human …; waiting"), with no `outcome: "halt"`. That is the same gap as in `review-gate`, and it is what `--check` fails on. The runner resumes a run that reached the gate and ran nothing past it, so the scripted answer was still given.

## What the planner contributed

The deliverable of the first phase is concrete and short enough to review: examples for each behaviour, the one real design choice named for the human, and scope cut explicitly ([`ACCEPTANCE.md`](run-1/runs/20260919-1245-k7qz/ACCEPTANCE.md)). It also caused the round's only failure: item 1 points at a file outside the diff, and this template's critic, unlike `review-gate`'s and `metric-sandwich`'s since this slice, has no repository access. The critic reported `invalid-evidence` instead of guessing, which is the evidence rule working.

## What the lead did that the package did not intend

- **It amended mid-loop and re-ran the critic in the same round**, without a back edge. No edge routes `invalid-evidence`, so it had to improvise. Both changes tighten; they replay exactly onto the working copy.
- **It counted "turns" as worker dispatches** (4 of 40, `n-0011`). Other leads in this batch counted their own turns (16, 19), and one counted 2.
- **Timestamps estimated**: `n-0004` puts the approval at 16:50:00 and `n-0006` the builder at 16:50:10; the transcript has the builder dispatched at 16:46:42.
- It wrote the approval note as "approved … as written (including item 12)"; the scripted answer said only "approve".
- Run id suffix `k7qz`, typed by hand. Ten permission denials: six by the lead, two by the builder and two by the critic, all compound or expanded shell forms, plus one `git -C … ` call.

## What I would change in the template

Give this critic the repository read-only too: answer keys cite existing files. Route `invalid-evidence` explicitly (an edge back to the lead's packaging step, or an `evidence-invalid` stop in the template). In the lead brief, one gate rule for both modes, as for `review-gate`.

## Re-proved after slice 0010

**Run** `20260920-172850` · the same task and slots on the hardened brief and template · **$2.44** · 35 harness turns · 412 s · evidence in [`run/`](run/) · **`--check` passes**

14 notes: 3 `started` lines, the halt at `spec-gate` (`n-0004`) before the ask, the scripted approval as `n-0005`, the loop pass with `"stop":"bar-passed"` and `cost: dispatches 2`, and the lead's own dispatch count in each dispatch line ("dispatch 1/10") ([`notes.jsonl`](run/runs/20260920-172850/notes.jsonl)). The run id is the clock's, and every timestamp is in append order. The critic, now with the repository read-only, checked all 12 acceptance lines against the files the answer key names and passed at round 0; no `invalid-evidence`, no mid-loop amendment. `git` was refused throughout (`git -C <path>` and `cd … &&` forms match no allow rule), so the lead served the critic a file list plus the repository instead of a diff and recorded that gap in `n-0009` and the critic in `n-0011`. Fourteen denials, all of that kind.
