# Progress · parse-page-ranges · run 20261004-214144

**Goal.** Add `parseRanges(text, pageCount)` in src/parse-ranges.mjs (page-box text such as "1-3,5" → array of page numbers; TypeError on bad argument types, RangeError on text that cannot be read as pages of the document), with tests in tests/parse-ranges.test.mjs. Done when docs/REVIEW-CHECKLIST.md and the held-out suite hold, `npm test` passes, and a human approves the merge.

**Round (loop `review`):** 1
**Dispatches (loop `review`):** 4 / 10
**Max iterations:** 4

| node | status |
|---|---|
| builder | done (rounds 0, 1) |
| critic | round 0: fail (held-out 52/70) · round 1: pass (checklist 6/6, npm test 14/14, held-out 70/70) |
| merge-gate | **halted — waiting for the human** |
| done | pending |

**Waiting on:** the human at `merge-gate`: "The critic passed the change against the checklist. Merge it?" (approve | reject with feedback).
**Last stop check (after round 1):** stop 1 bar passed → took `e-critic-pass` to `merge-gate`.

**Run-folder artifacts:** CHANGES.md, REVIEW.md (round 1, pass), REVIEW-round-0.md, diff-round-{0,1}-*.patch, npm-test-round-{0,1}.txt.

**The change (uncommitted in the working tree):** src/parse-ranges.mjs (new), tests/parse-ranges.test.mjs (new), README.md (entry beside paperSize).

## Amendments

None.
