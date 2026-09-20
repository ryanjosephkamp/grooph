# Review checklist

The change is done when every item here holds. Cite the file and line that
satisfies each one, or say plainly that it is unmet.

1. `src/duration.mjs` exists and exports `parseDuration`.
2. The examples in the task hold and a test covers each: `"1h30m"` is `5400`,
   `"45s"` is `45`, `"500ms"` is `0.5`, and `parseDuration(formatSeconds(n))`
   gives back `n` for `5400`, `61`, `0.5` and `0`.
3. Units are `h`, `m`, `s`, `ms`, in that order, each at most once; a text that
   breaks that, or that has no unit, or that is not a duration at all, throws a
   `RangeError`; a non-string throws a `TypeError`; a test covers each.
4. `README.md` documents `parseDuration` beside `formatSeconds`, with an
   example, and says what throws.
5. `npm test` exits 0, and no test is skipped or marked todo.
6. Every case in the held-out suite passes. The suite is the file
   `<held-out>/duration-cases.test.mjs`, outside this project; it settles the
   points the task leaves open (whitespace, letter case, fractions, and the
   shapes that must be refused). The critic runs it from the project root with
   `node --test <held-out>/duration-cases.test.mjs` and, for any case that
   fails, quotes the input and the expected result in `REVIEW.md` so the builder
   can act on it. The suite belongs to the critic: the builder does not read or
   run it, and builds from the task, this checklist and the README.
