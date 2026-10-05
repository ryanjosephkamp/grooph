# Review: parseRanges, round 0

## Checklist (docs/REVIEW-CHECKLIST.md)

1. Holds. `src/parse-ranges.mjs:11` exports `function parseRanges(text, pageCount)`.
2. Holds. `tests/parse-ranges.test.mjs:7` checks `"1-3,5"` gives `[1, 2, 3, 5]` and `tests/parse-ranges.test.mjs:8` checks `"7"` gives `[7]` (both with pageCount 10).
3. Holds. TypeError for non-string text is at `src/parse-ranges.mjs:12` and tested at `tests/parse-ranges.test.mjs:22-25`. TypeError for a bad pageCount (0, -1, 2.5, "10", NaN, Infinity, undefined, null) is at `src/parse-ranges.mjs:13-15` and tested at `tests/parse-ranges.test.mjs:29-30`. RangeError for a page past the last one is at `src/parse-ranges.mjs:24` and tested at `tests/parse-ranges.test.mjs:35-36`. Page 0 is at `src/parse-ranges.mjs:24` and tested at `tests/parse-ranges.test.mjs:40-41`. A word or a part that is neither a page nor a range is at `src/parse-ranges.mjs:20-21` and tested at `tests/parse-ranges.test.mjs:45`.
4. Holds as written. `README.md:20-25` gives an example right after the `paperSize` section (`README.md:5-15`), and `README.md:33-36` says what throws. However, `README.md:31` and `README.md:35-36` document behaviour that the held-out suite rejects (see below).
5. Holds. `npm test` exits 0 with 12 tests passing and 0 failed, 0 skipped and 0 todo (run by the critic).
6. Holds. `git status` shows only `README.md`, `src/parse-ranges.mjs`, `tests/parse-ranges.test.mjs` and `CHANGES.md` (the `.grooph/` run bookkeeping is excluded).

## Held-out suite

Command: `node --test .../held-out/parse-ranges-cases.test.mjs` from the project root. It exits 1: 70 cases, 52 pass and 18 fail. All "stated", "careful", "spaces" and "zeros" cases pass, and so does every refusal case. The failing cases are below.

order (pages come back in the order typed). Cause: the Set and sort at `src/parse-ranges.mjs:17,31`.
- `parseRanges("5,1-3", 10)` should be `[5, 1, 2, 3]` (got `[1, 2, 3, 5]`)
- `parseRanges("3,1", 10)` should be `[3, 1]` (got `[1, 3]`)
- `parseRanges("10,4-5,1", 10)` should be `[10, 4, 5, 1]` (got `[1, 4, 5, 10]`)

repeats (a page typed twice comes back twice). Cause: the Set at `src/parse-ranges.mjs:17,29`.
- `parseRanges("2,2", 10)` should be `[2, 2]` (got `[2]`)
- `parseRanges("1-3,2", 10)` should be `[1, 2, 3, 2]` (got `[1, 2, 3]`)
- `parseRanges("1-2,1-2", 10)` should be `[1, 2, 1, 2]` (got `[1, 2]`)

backward (a range typed last-first runs backward). Cause: `first > last` throws at `src/parse-ranges.mjs:24`.
- `parseRanges("5-3", 10)` should be `[5, 4, 3]` (threw RangeError)
- `parseRanges("10-8", 10)` should be `[10, 9, 8]` (threw RangeError)
- `parseRanges("2-1", 10)` should be `[2, 1]` (threw RangeError)
- `parseRanges("1,5-3", 10)` should be `[1, 5, 4, 3]` (threw RangeError)

open end (a range may leave out its first page, meaning from page 1, or its last, meaning to the last page, but not both). Cause: the regex at `src/parse-ranges.mjs:20` requires both ends.
- `parseRanges("8-", 10)` should be `[8, 9, 10]` (threw RangeError)
- `parseRanges("-3", 10)` should be `[1, 2, 3]` (threw RangeError)
- `parseRanges("10-", 10)` should be `[10]` (threw RangeError)
- `parseRanges("-1", 10)` should be `[1]` (threw RangeError)
- `parseRanges("1,8-", 10)` should be `[1, 8, 9, 10]` (threw RangeError)

empty (an empty box means every page, while an empty part between commas is still refused). Cause: an empty or blank text reaches the regex at `src/parse-ranges.mjs:20-21`.
- `parseRanges("", 10)` should be `[1, 2, 3, 4, 5, 6, 7, 8, 9, 10]` (threw RangeError)
- `parseRanges("   ", 10)` should be `[1, 2, 3, 4, 5, 6, 7, 8, 9, 10]` (threw RangeError)
- `parseRanges("", 1)` should be `[1]` (threw RangeError)

## What else must change along with src/

- `tests/parse-ranges.test.mjs:17-19` expects sorted, deduplicated output, which conflicts with order and repeats.
- `tests/parse-ranges.test.mjs:45` expects `"1-"`, `"-3"`, `"-1"`, `""` and `"  "` to throw, which conflicts with open end and empty. `"1-"` and `"-1"` should give `[1, …, 10]` and `[1]`.
- `tests/parse-ranges.test.mjs:50-52` expects `"5-3"` to throw, which conflicts with backward.
- `README.md:31` ("each page once, in ascending order") and `README.md:35-36` ("an empty part", "a range written last-first") document the rejected choices. `README.md:30` should also mention open ends and the empty box.
- `CHANGES.md:9-11` records the same choices, so it needs updating.

verdict: fail
