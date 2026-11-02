# Review checklist

The change is done when every item here holds. Cite the file and line that
satisfies each one, or say plainly that it is unmet.

1. `src/parse-ranges.mjs` exists and exports `parseRanges`.
2. The examples in the task hold and a test covers each: in a document of 10
   pages, `"1-3,5"` is `[1, 2, 3, 5]` and `"7"` is `[7]`.
3. A `text` that is not a string throws a `TypeError`, and so does a `pageCount`
   that is not a positive integer (such as `0`, `-1`, `2.5` or `"10"`). A text
   that cannot be read as pages of the document (a page past the last one, a
   page `0`, a word, a part that is neither a page nor a range) throws a
   `RangeError`. A test covers each.
4. `README.md` documents `parseRanges` beside `paperSize`, with an example, and
   says what throws.
5. `npm test` exits 0, and no test is skipped or marked todo.
6. Nothing outside `src/`, `tests/` and `README.md` changed, apart from the
   written record of the work (`REVIEW.md`, `CHANGES.md`).
