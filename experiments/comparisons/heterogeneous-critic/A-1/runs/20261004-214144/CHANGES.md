# Changes, round 1

Addresses every failing group in REVIEW.md (round 0).

- src/parse-ranges.mjs: dropped the Set and sort, so pages come back in the
  order typed with repeats kept (findings: order, repeats).
- src/parse-ranges.mjs: a range typed last-first now runs backward instead of
  throwing (finding: backward).
- src/parse-ranges.mjs: a range may omit its first page (from 1) or its last
  (to pageCount); a lone "-" is still refused (finding: open end).
- src/parse-ranges.mjs: an empty or blank text returns every page; an empty
  part between commas ("1,,2", "1,") is still refused (finding: empty).
- tests/parse-ranges.test.mjs: replaced the sorted/de-duplicated test and
  removed "", " ", "1-", "-3", "-1", "5-3" from the refusals; added tests for
  order, repeats, backward, open ends, empty text, a fresh array per call, and
  more refusals ("-", ",", "11-", "-0"). (finding: project tests that
  contradicted the suite)
- README.md and the doc comment: rewritten to describe the new behaviour
  (finding: docs contradicting the suite; checklist item 4).
- Not changed: TypeError/RangeError refusals, spaces and zeros handling; they
  already passed.
