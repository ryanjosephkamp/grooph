# REVIEW — word wrap, round 0

Judged against `.grooph/word-wrap/runs/20260920-172850/ACCEPTANCE.md` (lines 8–22).
Evidence: the change's file list (NEW `src/wrap.mjs`, NEW `tests/wrap.test.mjs`,
MODIFIED `README.md`), the repository read-only, and `npm test` re-run by me
(`node --test tests/*.test.mjs`, the script at `package.json:7`) — exit status 0,
13 pass / 0 fail. `git` is not runnable in this sandbox, so item 5 is judged from
the supplied file list, which is the diff evidence handed to me.

## Shape

1. HOLDS — `src/wrap.mjs:13` `export function wrap(text, width)`; JSDoc at
   `src/wrap.mjs:1-12` uses the same `/** summary … @param {string} text /
   @returns */` shape as `src/count.mjs:1-6`. Returns a string on both paths
   (`src/wrap.mjs:20` `""`, `src/wrap.mjs:36` `lines.join("\n")`); asserted by
   test "wrap returns a string" (`tests/wrap.test.mjs:22-24`).
2. HOLDS — `src/wrap.mjs:14` throws `TypeError` for non-string `text`;
   `src/wrap.mjs:15-17` throws `TypeError` unless `Number.isInteger(width) &&
   width >= 1`. Covered by tests `tests/wrap.test.mjs:6-10` (42, undefined,
   array) and `tests/wrap.test.mjs:12-20` (0, -3, 2.5, "10", NaN, Infinity
   throw; 1 does not).
3. HOLDS — `tests/wrap.test.mjs:1-2` imports `node:assert/strict` and
   `node:test`, identical to `tests/count.test.mjs:1-2`. Behaviours 6–11 each
   have a test: 6 at line 26, 7 at lines 37 and 46, 8 at line 31, 9 at lines 52
   and 59, 10 at line 64, 11 at line 70.
4. HOLDS — `README.md:11-15` adds a second fenced block
   `wrap("the quick brown fox", 10); // "the quick\nbrown fox"` beside the
   existing `countWords` block at `README.md:5-9`.
5. HOLDS — the supplied diff lists only `src/wrap.mjs`, `tests/wrap.test.mjs`
   and `README.md`; `src/count.mjs` (11 lines, `countWords` unchanged),
   `tests/count.test.mjs` (9 lines) and `package.json` (test script at line 7,
   no new deps or bin) are claimed and read as untouched, and the pre-existing
   test still passes.

## Behaviour

6. HOLDS — `src/wrap.mjs:19,22` trims then splits on `/\s+/`, so spaces, tabs
   and newlines are separators and are not preserved; words are rejoined with a
   single space at `src/wrap.mjs:28`. Test `tests/wrap.test.mjs:26-29`:
   `wrap("one  two\tthree\nfour", 40) === "one two three four"`.
7. HOLDS — a word is appended only when
   `line.length + 1 + word.length <= width` (`src/wrap.mjs:27`); otherwise it
   starts a new line (`src/wrap.mjs:30-31`), so a line can exceed `width` only
   when it is a single over-long word, and no code path slices inside a word.
   Tests `tests/wrap.test.mjs:37-44` (no line over width at 6 widths) and
   `tests/wrap.test.mjs:46-50` (`wrap("a extraordinarily b", 5) ===
   "a\nextraordinarily\nb"`).
8. HOLDS — the single forward pass at `src/wrap.mjs:26-33` fills greedily.
   Test `tests/wrap.test.mjs:32` asserts the acceptance example exactly:
   `wrap("the quick brown fox", 10) === "the quick\nbrown fox"`.
9. HOLDS — `src/wrap.mjs:36` joins with `"\n"`; input is trimmed at
   `src/wrap.mjs:19` and lines are built only from whitespace-free words, so
   there is no leading/trailing whitespace and no trailing newline. Tests
   `tests/wrap.test.mjs:52-57` and `tests/wrap.test.mjs:59-62` (no `"\n\n"`).
10. HOLDS — `src/wrap.mjs:19-20` returns `""` when the trimmed text is empty.
    Test `tests/wrap.test.mjs:64-68` (`""`, `"   "`, `"\t\n  \n"`).
11. HOLDS — when every word fits, the loop never pushes, so `lines` is the one
    accumulated line (`src/wrap.mjs:34`). Test `tests/wrap.test.mjs:70-74`:
    `wrap("  the   quick  ", 40) === "the quick"`.
12. HOLDS — I ran the `package.json:7` test command myself: 13 tests, 13 pass,
    0 fail, `exit status: 0`, matching
    `.grooph/word-wrap/runs/20260920-172850/npm-test-round-0.txt:19-28`.

Out-of-scope lines 26–30 are respected: no hyphenation or mid-word break
(`src/wrap.mjs:26-33`), no default export or CLI (`src/wrap.mjs:13` is the only
export), no `package.json` change.

verdict: pass
