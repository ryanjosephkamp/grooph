# Review: word wrap, round 0

1. holds — src/wrap.mjs:11 `export function wrap(text, width)`; returns `lines.join("\n")` (src/wrap.mjs:31) or `""` (src/wrap.mjs:17), both strings; tests/wrap.test.mjs:20 asserts `typeof out === "string"`.
2. holds — src/wrap.mjs:1-10 JSDoc has description, `@param {string} text`, `@param {number} width`, `@returns {string}`, same shape as src/count.mjs:1-6.
3. holds — src/wrap.mjs:12 throws `TypeError("wrap: text must be a string")`; src/wrap.mjs:13-15 `!Number.isInteger(width) || width < 1` throws `TypeError("wrap: width must be a positive integer")`, which rejects `0`, `-1`, `1.5`, `NaN`, `"10"`; tests/wrap.test.mjs:6-16 assert name `TypeError` and message `/^wrap:/` for all listed bad values.
4. holds — src/wrap.mjs:31 joins with `"\n"`; src/wrap.mjs:23 only appends a word when `line.length + 1 + word.length <= width`, so no joined line exceeds `width`; an over-long word is never split (src/wrap.mjs:20, :27 place a whole word as the line); tests/wrap.test.mjs:18-28 check the length bound and the unbroken long word.
5. holds — src/wrap.mjs:16 `text.trim().split(/\s+/)` is the same tokenising as src/count.mjs:9; src/wrap.mjs:24 joins with exactly `" "`; tests/wrap.test.mjs:30-33 cover spaces, tabs, `\n`, `\r\n`.
6. holds — src/wrap.mjs:23-24 keeps all words on one line when they fit; tests/wrap.test.mjs:35-37 `wrap("a b", 10) === "a b"`.
7. holds — src/wrap.mjs:16 trims input, src/wrap.mjs:31 `join("\n")` adds no trailing newline; tests/wrap.test.mjs:39-42 `wrap("  a b  ", 10) === "a b"` and `wrap("\n a b \n", 1) === "a\nb"`.
8. holds — src/wrap.mjs:17 returns `""` when the trimmed split yields `[""]`; tests/wrap.test.mjs:44-48 cover `""`, `"   "`, `"\n\t "`.
9. holds — src/wrap.mjs:21-28 packs each word onto the current line until the next would not fit; tests/wrap.test.mjs:50-52 `wrap("the quick brown fox", 10) === "the quick\nbrown fox"`.
10. holds — src/wrap.mjs:23 uses `<= width` (inclusive); tests/wrap.test.mjs:54-57 `wrap("ab cd", 5) === "ab cd"` and `wrap("ab cd", 4) === "ab\ncd"`.
11. holds — tests/wrap.test.mjs:1-2 import `node:assert/strict` and `node:test` exactly as tests/count.test.mjs:1-2; items 3-10 are covered at tests/wrap.test.mjs:6-16 (3), :18-28 (4), :30-33 (5), :35-37 (6), :39-42 (7), :44-48 (8), :50-52 (9), :54-57 (10).
12. holds — ran `npm test` myself: 11 tests, 11 pass, 0 fail, including `countWords counts runs of non-whitespace`; lead capture .grooph/word-wrap/runs/20260921-233822/npm-test-round-0.txt:16-19 and :24 show `tests 11`, `fail 0`, `exit: 0`.
13. holds — README.md:11-15 adds a fenced `js` block with `import { wrap } from "./src/wrap.mjs";` and a one-line call with a `//` result comment, the same form as the `countWords` block at README.md:5-9.

verdict: pass
