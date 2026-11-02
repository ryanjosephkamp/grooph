# Review: parse-page-ranges, round 0

## Checklist (docs/REVIEW-CHECKLIST.md)

1. Holds. src/parse-ranges.mjs exists and exports `parseRanges` at src/parse-ranges.mjs:12.
2. Holds. `"1-3,5"` -> `[1, 2, 3, 5]` and `"7"` -> `[7]` in 10 pages, covered at tests/parse-ranges.test.mjs:7-8. Held-out "stated" cases for both pass.
3. Holds as written. Non-string text throws TypeError at src/parse-ranges.mjs:13 (tests/parse-ranges.test.mjs:24-29). Bad pageCount (0, -1, 2.5, "10", plus NaN, Infinity, null, undefined) throws TypeError at src/parse-ranges.mjs:14-15 (tests/parse-ranges.test.mjs:31-35). Page past the end and page 0 throw RangeError at src/parse-ranges.mjs:23-24 (tests/parse-ranges.test.mjs:37-42). A word or a part that is neither a page nor a range throws RangeError at src/parse-ranges.mjs:19-20 and :33-34 (tests/parse-ranges.test.mjs:45). All held-out "stated" and "careful" refusals pass.
4. Holds as written. README.md:20-36 documents `parseRanges` beside `paperSize`, gives an example (README.md:23-24), and says what throws (README.md:32-36). But the behaviour it documents at README.md:31 ("ascending order, each once") and README.md:34-35 ("an empty text", "a range that runs backwards (`5-3`)") contradicts the held-out suite. It has to change along with the code.
5. Holds. I ran `npm test`: exit 0, tests 10, pass 10, fail 0, skipped 0, todo 0. This matches npm-test-round-0.txt.
6. Holds. `git status` shows only README.md (modified), src/parse-ranges.mjs and tests/parse-ranges.test.mjs (new), plus run bookkeeping under .grooph/.

## Held-out suite

Command, run from the project root: `node --test <harness>/held-out/parse-ranges-cases.test.mjs`
Result: exit 1. 70 tests, 52 pass, 18 fail. Every refusal case passes, and so do "each call returns a new array", all "spaces" and all "zeros" cases. Below are the failing cases (input -> expected), with the cause.

order (pages come back in the order typed). Cause: the Set and sort at src/parse-ranges.mjs:29,41,43.
- `parseRanges("5,1-3", 10)` -> expected `[5, 1, 2, 3]` (got `[1, 2, 3, 5]`)
- `parseRanges("3,1", 10)` -> expected `[3, 1]` (got `[1, 3]`)
- `parseRanges("10,4-5,1", 10)` -> expected `[10, 4, 5, 1]` (got `[1, 4, 5, 10]`)

repeats (a page typed twice comes back twice). Cause: the Set at src/parse-ranges.mjs:29,41,43.
- `parseRanges("2,2", 10)` -> expected `[2, 2]` (got `[2]`)
- `parseRanges("1-3,2", 10)` -> expected `[1, 2, 3, 2]` (got `[1, 2, 3]`)
- `parseRanges("1-2,1-2", 10)` -> expected `[1, 2, 1, 2]` (got `[1, 2]`)

backward (a range typed last-first runs backward). Cause: RangeError at src/parse-ranges.mjs:38-39.
- `parseRanges("5-3", 10)` -> expected `[5, 4, 3]` (threw RangeError)
- `parseRanges("10-8", 10)` -> expected `[10, 9, 8]` (threw RangeError)
- `parseRanges("2-1", 10)` -> expected `[2, 1]` (threw RangeError)
- `parseRanges("1,5-3", 10)` -> expected `[1, 5, 4, 3]` (threw RangeError)

open end (a range may leave out its first page or its last, but not both). Cause: the empty side fails PAGE at src/parse-ranges.mjs:19-20, reached from :36-37.
- `parseRanges("8-", 10)` -> expected `[8, 9, 10]` (threw RangeError)
- `parseRanges("-3", 10)` -> expected `[1, 2, 3]` (threw RangeError)
- `parseRanges("10-", 10)` -> expected `[10]` (threw RangeError)
- `parseRanges("-1", 10)` -> expected `[1]` (threw RangeError)
- `parseRanges("1,8-", 10)` -> expected `[1, 8, 9, 10]` (threw RangeError)

empty (an empty or blank box means every page; an empty part between commas is still refused). Cause: the empty part fails PAGE at src/parse-ranges.mjs:19-20, reached from :36.
- `parseRanges("", 10)` -> expected `[1, 2, 3, 4, 5, 6, 7, 8, 9, 10]` (threw RangeError)
- `parseRanges("   ", 10)` -> expected `[1, 2, 3, 4, 5, 6, 7, 8, 9, 10]` (threw RangeError)
- `parseRanges("", 1)` -> expected `[1]` (threw RangeError)

## Project tests and docs that contradict the held-out suite (to change alongside the code)

- tests/parse-ranges.test.mjs:19-22 asserts sorted, de-duplicated output (`"5,1-3,2-4"` -> `[1,2,3,4,5]`, `"3,3"` -> `[3]`). The suite expects typed order with repeats kept.
- tests/parse-ranges.test.mjs:45 expects RangeError for `""`, `" "`, `"1-"`, `"-3"`, `"-1"` and `"5-3"`. The suite expects these to succeed. The other entries on that line are refusals the suite agrees with.
- src/parse-ranges.mjs:7 (the doc comment) and README.md:31, :34-35 describe the same contrary behaviour.

verdict: fail
