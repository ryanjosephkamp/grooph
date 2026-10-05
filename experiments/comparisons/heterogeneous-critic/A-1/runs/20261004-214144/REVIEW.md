# Review: parse-page-ranges, round 1

## Checklist (docs/REVIEW-CHECKLIST.md)

1. Holds. src/parse-ranges.mjs exists and exports `parseRanges` at src/parse-ranges.mjs:16.
2. Holds. `"1-3,5"` -> `[1, 2, 3, 5]` and `"7"` -> `[7]` in 10 pages, covered at tests/parse-ranges.test.mjs:7-8. The held-out "stated" cases for both pass.
3. Holds. A non-string text throws TypeError at src/parse-ranges.mjs:17 (tested at tests/parse-ranges.test.mjs:57-60). A bad pageCount (0, -1, 2.5, "10", plus NaN, Infinity, null, undefined) throws TypeError at src/parse-ranges.mjs:18-20 (tested at tests/parse-ranges.test.mjs:63-67). A page past the end or page 0 throws RangeError at src/parse-ranges.mjs:34-36 (tested at tests/parse-ranges.test.mjs:70-73). A word, or a part that is neither a page nor a range, throws RangeError at src/parse-ranges.mjs:32, :43 and :49 (tested at tests/parse-ranges.test.mjs:77, for example "abc", "1-2-3", "1;2" and "1.5").
4. Holds. README.md:20-39 documents `parseRanges` right after `paperSize` (README.md:5-15). The example is at README.md:23-24 and what throws is at README.md:35-39. The round-0 contradictions are gone: README.md:31-35 now describes typed order, repeats, backward ranges, open ends and an empty box, and all of these agree with the held-out suite.
5. Holds. I ran `npm test` myself: exit 0, with 14 tests, 14 passing, 0 failing, 0 skipped and 0 todo. This matches npm-test-round-1.txt.
6. Holds. `git status --porcelain --untracked-files=all` shows README.md (modified) and the new files src/parse-ranges.mjs and tests/parse-ranges.test.mjs. Everything else is run bookkeeping under .grooph/parse-page-ranges/runs/20261004-214144/. The working-tree files match diff-round-1-src.patch, diff-round-1-tests.patch and diff-round-1-tracked.patch.

## Held-out suite

Command, run from the project root: `node --test /private/var/folders/pv/m1k13gmn189d64ndtxdbzrjc0000gn/T/wk/73NiE9/printkit-yKxXUS.harness/held-out/parse-ranges-cases.test.mjs`
Result: exit 0, with 70 tests, 70 passing, 0 failing, 0 skipped and 0 todo. All groups pass: stated, careful, order, repeats, backward, spaces, open end, empty, zeros, plus "each call returns a new array".

Failing cases: none.

verdict: pass
