# Round 0 changes

## What changed

- `src/interval.mjs`: added `mergeIntervals(intervals)`.
  - Validates input is an array and validates each interval with the
    existing `check` helper (reusing the same `TypeError` behavior as
    `overlaps`).
  - Copies each inner `[start, end]` pair before sorting (does not sort the
    caller's array in place, and does not mutate the caller's inner arrays
    either) so the input is left completely untouched.
  - Sorts by start then end, then does a single pass merging into the
    last accumulated interval whenever `start <= last.end + 1`, which
    naturally covers overlapping, touching, and adjacent-integer intervals
    (e.g. `[1, 2]` and `[3, 4]` -> `[1, 4]`), while leaving a real gap
    (e.g. `[1, 2]` and `[4, 5]`) unmerged.
- `README.md`: documented `mergeIntervals` next to `overlaps` in the code
  example and added a bullet under "Rules" describing sorting,
  non-mutation, and the touching/adjacent-merge behavior.

## Why

The task specified `mergeIntervals` in `tests/interval.test.mjs`, which was
failing because the function didn't exist yet. Implemented it to match the
spec exactly, including the input-immutability test and the bad-interval
`TypeError` test, and documented it per the task's requirement to add it
beside `overlaps` in the README.

## Test result

`npm test` — all 7 tests pass (0 failures).
