# REVIEW — word wrap, round 0

Evidence: ACCEPTANCE.md, round-0.diff, round-0.npm-test.txt; `npm test` also run by the critic (13/13 pass, exit 0).

1. CANNOT VERIFY. The named export `wrap(text, width)` is present (round-0.diff:30) and it has a JSDoc header with a description, `@param` and `@returns` (round-0.diff:21-29). The item also requires that header to be "in the style of `src/count.mjs`". The contents of `src/count.mjs` are not in the evidence: round-0.diff has no hunk for that file because it is unchanged, so the comparison cannot be made.
2. HOLDS. The output is joined with `"\n"` and nothing is appended (round-0.diff:46). The test at round-0.diff:104-109 asserts it is a string with no trailing newline.
3. HOLDS. round-0.diff:31. The test at round-0.diff:111-115 covers 42, null and undefined.
4. HOLDS. round-0.diff:32. The test at round-0.diff:117-121 covers 0, -1, 1.5, NaN, Infinity, "5" and undefined.
5. HOLDS. The test file imports `node:assert/strict` and `node:test` (round-0.diff:54-55). Items 8-15 are covered at round-0.diff:59-61, 63-65, 67-77, 79-81, 83-86, 88-93, 95-98 and 100-102.
6. HOLDS. README gains a `wrap` example right after the `countWords` block (round-0.diff:9-14).
7. HOLDS. round-0.diff changes only README.md, src/wrap.mjs and tests/wrap.test.mjs. It has no hunk for src/count.mjs or tests/count.test.mjs.
8. HOLDS. Assertion at round-0.diff:60; passing test at round-0.npm-test.txt:6.
9. HOLDS. Assertion at round-0.diff:64; passing test at round-0.npm-test.txt:7.
10. HOLDS. Assertions at round-0.diff:68 and 75; passing tests at round-0.npm-test.txt:8-9. The logic is at round-0.diff:38-43: the word is never split.
11. HOLDS. Assertion at round-0.diff:80 (the check is `<=` at round-0.diff:38); passing test at round-0.npm-test.txt:10.
12. HOLDS. Assertions at round-0.diff:84-85 (`split(/\s+/)` at round-0.diff:33); passing test at round-0.npm-test.txt:11.
13. HOLDS. Assertions at round-0.diff:89-92 (`trim()` at round-0.diff:33); passing test at round-0.npm-test.txt:12.
14. HOLDS. Assertions at round-0.diff:96-97 (the check is at round-0.diff:34); passing test at round-0.npm-test.txt:13.
15. HOLDS. Assertion at round-0.diff:101; passing test at round-0.npm-test.txt:14.
16. HOLDS. round-0.npm-test.txt:18-21 shows 13 tests, 13 pass and 0 fail, including the 12 wrap tests. The critic's own `npm test` run matched and exited 0.

verdict: invalid-evidence (item 1 needs the contents of src/count.mjs, and the evidence does not include them)
