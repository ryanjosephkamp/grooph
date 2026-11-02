# Run 20260920-192538 · parse-duration

**Goal.** Add `parseDuration(text)` to src/duration.mjs, the inverse of `formatSeconds`, with tests in tests/duration.test.mjs and README docs. Done when every item in docs/REVIEW-CHECKLIST.md holds, `npm test` passes, and a human approves the merge.

**Loop `review`:** round 1 (finished) · dispatches 4 / 10 · max iterations 4 · stop fired: **bar passed** at round 1

## Nodes

| node | status |
|---|---|
| builder | round 0 done (strict grammar; npm test 14/14) · round 1 done (grammar relaxed per REVIEW.md; npm test 17/17) |
| critic | round 0: **fail** — item 6 unmet (8/41 held-out cases) · round 1: **pass** — all 6 items cited; npm test 17/17, held-out 41/41 |
| merge-gate | **halted — waiting for the human** (approve \| reject with feedback) |
| done | pending |

## Waiting

Human decision at `merge-gate`: the critic passed the change against the checklist. Merge it?
- approve → `e-merge-gate-done` → `done`
- reject with feedback → `e-merge-gate-reject` → `builder` (round 2)

Change under review (working tree, uncommitted): src/duration.mjs (new), tests/duration.test.mjs (new), README.md (modified), CHANGES.md (new, builder's round log), REVIEW.md (new, critic's round-1 review). Evidence in this folder: round0.diff, round0-npm-test.txt, round1.diff, round1-npm-test.txt.

## Last stop check

After round 1 (2026-09-20T19:33:32Z): 1 bar passed — **yes** (every checklist item cited with file:line, `npm test` exit 0) → took `e-critic-pass`. Stops 2 (max iterations 4) and 3 (budget 10) not reached.

## Amendments

None.
