# Review checklist

The change is done when every item here holds. Cite the file and line that
satisfies each one, or say plainly that it is unmet.

1. `src/truncate.mjs` exists and exports `truncate`.
2. Text of at most `max` characters comes back unchanged, and longer text comes
   back exactly `max` characters long, ending in "…"; a test covers each case.
3. A `text` that is not a string throws a `TypeError`, and a `max` that is not a
   positive integer (such as `0`, `-1`, `2.5` or `"3"`) throws a `RangeError`; a
   test covers each.
4. `CHANGELOG.md` has a line under `## Unreleased` that names `truncate` and says
   what it does, in the style of the entries below it.
5. `npm test` exits 0, and no test is skipped or marked todo.
6. Nothing outside `src/`, `tests/` and `CHANGELOG.md` changed, apart from the
   review's own files (`REVIEW.md`, `CHANGES.md` and `.grooph/`).
