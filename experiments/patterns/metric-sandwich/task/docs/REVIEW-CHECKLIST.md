# Review checklist

`npm run check` (lint and tests) has already passed when this checklist is used,
so none of it repeats what the check covers. Cite the file and line for each
finding, or say plainly that an item holds.

1. Every comment in `src/paginate.mjs`, the module comment at the top included,
   describes the code as it now is: nothing still says pages count from 0.
2. The usage example and the prose in `README.md` match the new page numbering.
3. Input the functions cannot answer correctly is refused with a `RangeError`
   instead of being answered wrongly: a `pageSize` that is not a positive integer
   (in both functions), a `page` that is not an integer of at least 1, and a
   `total` that is not a non-negative integer. A test covers each refusal.
4. `pageCount` agrees with `paginate`: `pageCount(0, size)` is 0, and for a total
   that does not divide evenly, page `pageCount(total, size)` is the last page
   `paginate` fills. A test shows it.
5. Names say what they hold: no single-letter or placeholder names outside loop
   indices, and nothing named like an index that holds a count, or the reverse.
