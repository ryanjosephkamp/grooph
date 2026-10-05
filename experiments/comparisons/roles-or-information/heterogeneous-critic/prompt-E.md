# Task

Add `parseRanges(text, pageCount)` in a new file, src/parse-ranges.mjs: it reads what a person typed into the print dialog's page box, such as "1-3,5" or "7", and returns the page numbers to print as an array. Pages are numbered from 1 to `pageCount`; parts are separated by commas, and a part is one page or a range written first-last. A `text` that is not a string, or a `pageCount` that is not a positive integer, throws a TypeError; a text that cannot be read as pages of this document throws a RangeError. Tests go in tests/parse-ranges.test.mjs.

# Acceptance material

`README.md` and `docs/REVIEW-CHECKLIST.md` in this project say what the result must satisfy. Read them before you start.

# Test command

`npm test`

Done when the task is done, everything the acceptance material asks for holds, and `npm test` passes. Work in this project folder, and end by saying what you changed.

# Held-out material

`<held-out>/parse-ranges-cases.test.mjs` is a test suite. It settles what the task and the acceptance material leave open. Run it from this project folder with `node --test <held-out>/parse-ranges-cases.test.mjs`, and make every case hold. Do not change it.
