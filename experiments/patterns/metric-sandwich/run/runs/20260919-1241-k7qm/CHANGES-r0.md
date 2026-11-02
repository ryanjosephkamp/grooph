# Changes, round 0

- `src/paginate.mjs`: `paginate(items, pageSize, page)` now numbers pages from 1
  (`start = (page - 1) * pageSize`). The module comment and the doc comment now say
  pages count from 1.
- `src/paginate.mjs`: added `pageCount(total, pageSize)`, which returns
  `Math.ceil(total / pageSize)`: 0 for no items, and otherwise the number of the last
  page `paginate` fills.
- `src/paginate.mjs`: both functions throw a `RangeError` for input they cannot answer
  correctly: a `pageSize` that is not a positive integer (shared private helper
  `requirePageSize`), a `page` that is not an integer of at least 1, and a `total`
  that is not a non-negative integer.
- `tests/paginate.test.mjs`: moved the existing tests to 1-based pages, added a
  page-2 test, `pageCount` tests (even and uneven totals, 0 items), a test that
  `paginate(items, size, pageCount(total, size))` is the short last page and the next
  page is empty, and one test per refusal (each tries 0/negative/fractional/NaN/
  Infinity/string/undefined as applicable).
- `README.md`: the usage example and prose now use 1-based pages, show `pageCount`,
  and describe the `RangeError` refusals.

`npm run check`: lint clean, 11 of 11 tests pass.
