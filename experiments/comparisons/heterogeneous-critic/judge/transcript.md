# Blind judge · heterogeneous-critic

Model `claude-opus-5-5`, no tools, fresh session, 2026-10-04T22:10:45.387Z; ledger invocation 58, $0.3626. The letters' mapping is in `mapping.json`, which the judge never saw.

## Prompt

You are a critic judging 8 candidate changes to one small Node project. Each candidate was produced by a different session working from the same task; you do not know how, and you should not guess. Judge only what the diff shows against the task and its acceptance material. You have no tools: read carefully and cite lines of the diff.

# The task

Add `parseRanges(text, pageCount)` in a new file, src/parse-ranges.mjs: it reads what a person typed into the print dialog's page box, such as "1-3,5" or "7", and returns the page numbers to print as an array. Pages are numbered from 1 to `pageCount`; parts are separated by commas, and a part is one page or a range written first-last. A `text` that is not a string, or a `pageCount` that is not a positive integer, throws a TypeError; a text that cannot be read as pages of this document throws a RangeError. Tests go in tests/parse-ranges.test.mjs.

# Acceptance material the builder saw

### README.md

```
# printkit

Small helpers behind a print dialog.

```js
import { paperSize } from "./src/paper.mjs";

paperSize("A4");     // { width: 210, height: 297 }
paperSize("letter"); // { width: 215.9, height: 279.4 }
```

`paperSize(name)` gives the width and height of a paper size in millimeters,
portrait. It knows `A3`, `A4`, `A5`, `letter` and `legal`; the name is matched
without regard to letter case. An unknown name throws a `RangeError`; a name
that is not a string throws a `TypeError`.

The dialog also has a page box, where a person types which pages of the
document to print.
```

### docs/REVIEW-CHECKLIST.md

```
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
```

# Candidates (in random order, under random letters)

## Candidate J

```diff
diff --git a/README.md b/README.md
index c8aa9b8..5afa05a 100644
--- a/README.md
+++ b/README.md
@@ -16,3 +16,28 @@ that is not a string throws a `TypeError`.
 
 The dialog also has a page box, where a person types which pages of the
 document to print.
+
+```js
+import { parseRanges } from "./src/parse-ranges.mjs";
+
+parseRanges("1-3,5", 10); // [1, 2, 3, 5]
+parseRanges("7", 10);     // [7]
+```
+
+`parseRanges(text, pageCount)` reads what was typed in the page box and gives
+the page numbers to print, as an array. Pages are numbered from 1 to
+`pageCount`. Parts are separated by commas, and a part is one page or a range
+written first-last. Spaces around parts and dashes are ignored.
+
+- The result follows the order typed, so `"5,1-3"` is `[5, 1, 2, 3]`.
+- Repeats are kept, so `"2,2"` is `[2, 2]` and `"1-3,2"` is `[1, 2, 3, 2]`.
+- A range may run backwards: `"5-3"` is `[5, 4, 3]`.
+- A range may leave out one end: `"8-"` runs to the last page (`[8, 9, 10]` in
+  a document of 10 pages) and `"-3"` starts at page 1 (`[1, 2, 3]`).
+- Empty or blank text means every page: `parseRanges("", 3)` is `[1, 2, 3]`.
+
+A `text` that is not a string, or a `pageCount` that is not a positive integer,
+throws a `TypeError`. A text that cannot be read as pages of the document
+throws a `RangeError`: a page past the last one, a page `0`, a word, an empty
+part in text that is not blank (`"1,,3"`), a lone `"-"`, or any other part that
+is neither a page nor a range.
diff --git a/src/parse-ranges.mjs b/src/parse-ranges.mjs
new file mode 100644
index 0000000..8c02939
--- /dev/null
+++ b/src/parse-ranges.mjs
@@ -0,0 +1,65 @@
+const PAGE = /^[0-9]+$/;
+
+function unreadable(part, text) {
+  return new RangeError(`parseRanges: cannot read "${part}" in "${text}" as pages`);
+}
+
+function parsePage(token, part, text, pageCount) {
+  if (!PAGE.test(token)) throw unreadable(part, text);
+  const page = Number(token);
+  if (page < 1 || page > pageCount) {
+    throw new RangeError(
+      `parseRanges: page ${token} is outside the document (pages 1 to ${pageCount})`,
+    );
+  }
+  return page;
+}
+
+/**
+ * The page numbers to print, from what a person typed in the page box.
+ * Parts are separated by commas; a part is one page ("7") or a range written
+ * first-last ("1-3"). Spaces around parts and around the dash are ignored.
+ * The result follows the order typed and keeps repeats: "5,1-3" is
+ * [5, 1, 2, 3] and "2,2" is [2, 2]. A range may run backwards ("5-3" is
+ * [5, 4, 3]). A range may leave out one end: "8-" runs to the last page and
+ * "-3" starts at page 1. Empty or blank text means every page.
+ * @param {string} text for example "1-3,5"
+ * @param {number} pageCount pages in the document, a positive integer
+ */
+export function parseRanges(text, pageCount) {
+  if (typeof text !== "string") throw new TypeError("parseRanges: text must be a string");
+  if (!Number.isInteger(pageCount) || pageCount < 1) {
+    throw new TypeError("parseRanges: pageCount must be a positive integer");
+  }
+
+  const pages = [];
+  if (text.trim() === "") {
+    for (let page = 1; page <= pageCount; page++) pages.push(page);
+    return pages;
+  }
+
+  for (const raw of text.split(",")) {
+    const part = raw.trim();
+    const bounds = part.split("-").map((token) => token.trim());
+    if (bounds.length > 2) throw unreadable(part, text);
+
+    let first;
+    let last;
+    if (bounds.length === 1) {
+      first = last = parsePage(bounds[0], part, text, pageCount);
+    } else {
+      const [from, to] = bounds;
+      // A lone "-" has neither end, so it is not a range.
+      if (from === "" && to === "") throw unreadable(part, text);
+      first = from === "" ? 1 : parsePage(from, part, text, pageCount);
+      last = to === "" ? pageCount : parsePage(to, part, text, pageCount);
+    }
+
+    if (first <= last) {
+      for (let page = first; page <= last; page++) pages.push(page);
+    } else {
+      for (let page = first; page >= last; page--) pages.push(page);
+    }
+  }
+  return pages;
+}
diff --git a/tests/parse-ranges.test.mjs b/tests/parse-ranges.test.mjs
new file mode 100644
index 0000000..0477c2a
--- /dev/null
+++ b/tests/parse-ranges.test.mjs
@@ -0,0 +1,99 @@
+import assert from "node:assert/strict";
+import { test } from "node:test";
+
+import { parseRanges } from "../src/parse-ranges.mjs";
+
+test("parseRanges reads ranges and single pages", () => {
+  assert.deepEqual(parseRanges("1-3,5", 10), [1, 2, 3, 5]);
+  assert.deepEqual(parseRanges("7", 10), [7]);
+  assert.deepEqual(parseRanges("4-4", 10), [4]);
+  assert.deepEqual(parseRanges("1-10", 10), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
+});
+
+test("parseRanges ignores spaces around parts and dashes", () => {
+  assert.deepEqual(parseRanges(" 1 - 3 , 5 ", 10), [1, 2, 3, 5]);
+});
+
+test("parseRanges keeps the order typed", () => {
+  assert.deepEqual(parseRanges("5,1-3", 10), [5, 1, 2, 3]);
+  assert.deepEqual(parseRanges("3,1", 10), [3, 1]);
+  assert.deepEqual(parseRanges("10,4-5,1", 10), [10, 4, 5, 1]);
+});
+
+test("parseRanges keeps repeated pages", () => {
+  assert.deepEqual(parseRanges("2,2", 10), [2, 2]);
+  assert.deepEqual(parseRanges("1-3,2", 10), [1, 2, 3, 2]);
+  assert.deepEqual(parseRanges("1-2,1-2", 10), [1, 2, 1, 2]);
+});
+
+test("parseRanges reads a backward range from first down to last", () => {
+  assert.deepEqual(parseRanges("5-3", 10), [5, 4, 3]);
+  assert.deepEqual(parseRanges("10-8", 10), [10, 9, 8]);
+  assert.deepEqual(parseRanges("2-1", 10), [2, 1]);
+  assert.deepEqual(parseRanges("1,5-3", 10), [1, 5, 4, 3]);
+});
+
+test("parseRanges reads a range with one end left open", () => {
+  assert.deepEqual(parseRanges("8-", 10), [8, 9, 10]);
+  assert.deepEqual(parseRanges("-3", 10), [1, 2, 3]);
+  assert.deepEqual(parseRanges("10-", 10), [10]);
+  assert.deepEqual(parseRanges("-1", 10), [1]);
+  assert.deepEqual(parseRanges("1,8-", 10), [1, 8, 9, 10]);
+  assert.deepEqual(parseRanges(" 8 - ", 10), [8, 9, 10]);
+});
+
+test("parseRanges gives every page for empty or blank text", () => {
+  assert.deepEqual(parseRanges("", 10), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
+  assert.deepEqual(parseRanges("   ", 10), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
+  assert.deepEqual(parseRanges("", 1), [1]);
+});
+
+test("parseRanges refuses a text that is not a string", () => {
+  assert.throws(() => parseRanges(5, 10), TypeError);
+  assert.throws(() => parseRanges(undefined, 10), TypeError);
+  assert.throws(() => parseRanges(null, 10), TypeError);
+  assert.throws(() => parseRanges(["1"], 10), TypeError);
+});
+
+test("parseRanges refuses a pageCount that is not a positive integer", () => {
+  assert.throws(() => parseRanges("1", 0), TypeError);
+  assert.throws(() => parseRanges("1", -1), TypeError);
+  assert.throws(() => parseRanges("1", 2.5), TypeError);
+  assert.throws(() => parseRanges("1", "10"), TypeError);
+  assert.throws(() => parseRanges("1", NaN), TypeError);
+  assert.throws(() => parseRanges("1", Infinity), TypeError);
+  assert.throws(() => parseRanges("1", undefined), TypeError);
+});
+
+test("parseRanges checks the types before reading the text", () => {
+  assert.throws(() => parseRanges("abc", 0), TypeError);
+  assert.throws(() => parseRanges(5, "x"), TypeError);
+});
+
+test("parseRanges refuses pages outside the document", () => {
+  assert.throws(() => parseRanges("11", 10), RangeError);
+  assert.throws(() => parseRanges("0", 10), RangeError);
+  assert.throws(() => parseRanges("1-11", 10), RangeError);
+  assert.throws(() => parseRanges("0-3", 10), RangeError);
+  assert.throws(() => parseRanges("99999999999999999999", 10), RangeError);
+});
+
+test("parseRanges refuses words and parts that are neither a page nor a range", () => {
+  assert.throws(() => parseRanges("abc", 10), RangeError);
+  assert.throws(() => parseRanges("1,two", 10), RangeError);
+  assert.throws(() => parseRanges("1-2-3", 10), RangeError);
+  assert.throws(() => parseRanges("-", 10), RangeError);
+  assert.throws(() => parseRanges("-0", 10), RangeError);
+  assert.throws(() => parseRanges("11-", 10), RangeError);
+  assert.throws(() => parseRanges("-11", 10), RangeError);
+  assert.throws(() => parseRanges("2.5", 10), RangeError);
+  assert.throws(() => parseRanges("1 2", 10), RangeError);
+  assert.throws(() => parseRanges("+3", 10), RangeError);
+});
+
+test("parseRanges refuses empty parts in text that is not blank", () => {
+  assert.throws(() => parseRanges("1,", 10), RangeError);
+  assert.throws(() => parseRanges(",1", 10), RangeError);
+  assert.throws(() => parseRanges("1,,3", 10), RangeError);
+  assert.throws(() => parseRanges(",", 10), RangeError);
+});
```

## Candidate N

```diff
diff --git a/README.md b/README.md
index c8aa9b8..9b3b9c1 100644
--- a/README.md
+++ b/README.md
@@ -16,3 +16,23 @@ that is not a string throws a `TypeError`.
 
 The dialog also has a page box, where a person types which pages of the
 document to print.
+
+```js
+import { parseRanges } from "./src/parse-ranges.mjs";
+
+parseRanges("1-3,5", 10); // [1, 2, 3, 5]
+parseRanges("7", 10);     // [7]
+```
+
+`parseRanges(text, pageCount)` reads what was typed into the page box and gives
+the page numbers to print. Pages are numbered from 1 to `pageCount`. Parts are
+separated by commas, and a part is one page (`7`) or a range written
+first-last (`1-3`); spaces around parts and around the dash are ignored. The
+result is in ascending order with each page once, so `"5,1-3,2"` gives
+`[1, 2, 3, 5]`.
+
+A `text` that is not a string, or a `pageCount` that is not a positive integer
+(such as `0`, `2.5` or `"10"`), throws a `TypeError`. A text that cannot be read
+as pages of the document throws a `RangeError`: a page past `pageCount`, page
+`0`, a word, an empty text or empty part, a range that runs backwards (`3-1`),
+or any other part that is neither a page nor a range.
diff --git a/src/parse-ranges.mjs b/src/parse-ranges.mjs
new file mode 100644
index 0000000..6f57fa7
--- /dev/null
+++ b/src/parse-ranges.mjs
@@ -0,0 +1,43 @@
+const PAGE = /^\d+$/;
+const RANGE = /^(\d+)\s*-\s*(\d+)$/;
+
+/**
+ * The pages to print, from what a person typed into the page box.
+ * Parts are separated by commas; a part is one page ("7") or a range ("1-3").
+ * Spaces around parts and around the dash are ignored. The result is in
+ * ascending order, each page once.
+ * @param {string} text such as "1-3,5"
+ * @param {number} pageCount the number of pages in the document, numbered from 1
+ * @returns {number[]}
+ */
+export function parseRanges(text, pageCount) {
+  if (typeof text !== "string") throw new TypeError("parseRanges: text must be a string");
+  if (!Number.isInteger(pageCount) || pageCount < 1) {
+    throw new TypeError("parseRanges: pageCount must be a positive integer");
+  }
+
+  const page = (digits) => {
+    const n = Number(digits);
+    if (n < 1 || n > pageCount) {
+      throw new RangeError(`parseRanges: page ${digits} is not between 1 and ${pageCount}`);
+    }
+    return n;
+  };
+
+  const pages = new Set();
+  for (const raw of text.split(",")) {
+    const part = raw.trim();
+    let first, last;
+    if (PAGE.test(part)) {
+      first = last = page(part);
+    } else {
+      const match = RANGE.exec(part);
+      if (!match) throw new RangeError(`parseRanges: "${part}" is neither a page nor a range`);
+      first = page(match[1]);
+      last = page(match[2]);
+      if (first > last) throw new RangeError(`parseRanges: range "${part}" runs backwards`);
+    }
+    for (let n = first; n <= last; n++) pages.add(n);
+  }
+  return [...pages].sort((a, b) => a - b);
+}
diff --git a/tests/parse-ranges.test.mjs b/tests/parse-ranges.test.mjs
new file mode 100644
index 0000000..7eaff7b
--- /dev/null
+++ b/tests/parse-ranges.test.mjs
@@ -0,0 +1,58 @@
+import assert from "node:assert/strict";
+import { test } from "node:test";
+
+import { parseRanges } from "../src/parse-ranges.mjs";
+
+test("parseRanges reads pages and ranges", () => {
+  assert.deepEqual(parseRanges("1-3,5", 10), [1, 2, 3, 5]);
+  assert.deepEqual(parseRanges("7", 10), [7]);
+});
+
+test("parseRanges reaches both ends of the document", () => {
+  assert.deepEqual(parseRanges("1", 10), [1]);
+  assert.deepEqual(parseRanges("10", 10), [10]);
+  assert.deepEqual(parseRanges("1-10", 10), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
+  assert.deepEqual(parseRanges("4-4", 10), [4]);
+});
+
+test("parseRanges ignores spaces around parts and dashes", () => {
+  assert.deepEqual(parseRanges(" 1 - 3 , 5 ", 10), [1, 2, 3, 5]);
+});
+
+test("parseRanges gives each page once, in order", () => {
+  assert.deepEqual(parseRanges("5,1-3,2", 10), [1, 2, 3, 5]);
+});
+
+test("parseRanges wants text as a string", () => {
+  assert.throws(() => parseRanges(7, 10), TypeError);
+  assert.throws(() => parseRanges(undefined, 10), TypeError);
+  assert.throws(() => parseRanges(null, 10), TypeError);
+  assert.throws(() => parseRanges(["1"], 10), TypeError);
+});
+
+test("parseRanges wants pageCount as a positive integer", () => {
+  for (const pageCount of [0, -1, 2.5, "10", NaN, Infinity, undefined]) {
+    assert.throws(() => parseRanges("1", pageCount), TypeError, `pageCount ${String(pageCount)}`);
+  }
+});
+
+test("parseRanges refuses a page past the last one", () => {
+  assert.throws(() => parseRanges("11", 10), RangeError);
+  assert.throws(() => parseRanges("8-11", 10), RangeError);
+});
+
+test("parseRanges refuses page 0", () => {
+  assert.throws(() => parseRanges("0", 10), RangeError);
+  assert.throws(() => parseRanges("0-3", 10), RangeError);
+});
+
+test("parseRanges refuses a word", () => {
+  assert.throws(() => parseRanges("all", 10), RangeError);
+  assert.throws(() => parseRanges("1,two", 10), RangeError);
+});
+
+test("parseRanges refuses a part that is neither a page nor a range", () => {
+  for (const text of ["", " ", "1,,3", "1,", "1-", "-3", "1-2-3", "1.5", "-1", "+2", "3-1"]) {
+    assert.throws(() => parseRanges(text, 10), RangeError, JSON.stringify(text));
+  }
+});
```

## Candidate T

```diff
diff --git a/README.md b/README.md
index c8aa9b8..934baae 100644
--- a/README.md
+++ b/README.md
@@ -16,3 +16,24 @@ that is not a string throws a `TypeError`.
 
 The dialog also has a page box, where a person types which pages of the
 document to print.
+
+```js
+import { parseRanges } from "./src/parse-ranges.mjs";
+
+parseRanges("1-3,5", 10); // [1, 2, 3, 5]
+parseRanges("7", 10);     // [7]
+```
+
+`parseRanges(text, pageCount)` reads what was typed in the page box and gives
+the page numbers to print, as an array. Pages are numbered from 1 to
+`pageCount`; parts are separated by commas, and a part is one page or a range
+written first-last. A range may be open at one end: `8-` runs to the last page
+and `-3` runs from the first. A range written backwards counts down (`5-3` is
+`[5, 4, 3]`). Spaces around parts and hyphens are ignored. Empty or blank text
+means every page. The pages come back in the order typed, and a page typed
+twice (or covered by two overlapping parts) appears twice.
+
+A `text` that is not a string, or a `pageCount` that is not a positive integer,
+throws a `TypeError`. A text that cannot be read as pages of the document
+throws a `RangeError`: a page past the last one, page `0`, a word, an empty
+part (as in `1,,3`), or any part that is neither a page nor a range.
diff --git a/src/parse-ranges.mjs b/src/parse-ranges.mjs
new file mode 100644
index 0000000..4e3b022
--- /dev/null
+++ b/src/parse-ranges.mjs
@@ -0,0 +1,49 @@
+const PAGE = /^[0-9]+$/;
+const RANGE = /^([0-9]*)\s*-\s*([0-9]*)$/;
+
+/**
+ * The pages to print, from what a person typed in the page box.
+ * Parts are separated by commas; a part is one page ("7") or a range written
+ * first-last ("1-3"). A range may be open at one end: "8-" runs to the last
+ * page and "-3" runs from the first. A range written backwards ("5-3") counts
+ * down. Spaces around parts and around the hyphen are ignored. Empty or blank
+ * text means every page.
+ * The result keeps the order as typed and keeps repeats.
+ * @param {string} text for example "1-3,5"
+ * @param {number} pageCount the pages in the document, a positive integer
+ * @returns {number[]} page numbers, from 1 to pageCount
+ */
+export function parseRanges(text, pageCount) {
+  if (typeof text !== "string") throw new TypeError("parseRanges: text must be a string");
+  if (!Number.isInteger(pageCount) || pageCount < 1) {
+    throw new TypeError("parseRanges: pageCount must be a positive integer");
+  }
+
+  const pages = [];
+  if (text.trim() === "") {
+    for (let page = 1; page <= pageCount; page++) pages.push(page);
+    return pages;
+  }
+
+  for (const raw of text.split(",")) {
+    const part = raw.trim();
+    let first;
+    let last;
+    if (PAGE.test(part)) {
+      first = last = Number(part);
+    } else {
+      const range = RANGE.exec(part);
+      if (!range || (range[1] === "" && range[2] === "")) {
+        throw new RangeError(`parseRanges: cannot read "${part}" as a page or a range`);
+      }
+      first = range[1] === "" ? 1 : Number(range[1]);
+      last = range[2] === "" ? pageCount : Number(range[2]);
+    }
+    if (Math.min(first, last) < 1 || Math.max(first, last) > pageCount) {
+      throw new RangeError(`parseRanges: "${part}" is outside pages 1 to ${pageCount}`);
+    }
+    const step = first <= last ? 1 : -1;
+    for (let page = first; page !== last + step; page += step) pages.push(page);
+  }
+  return pages;
+}
diff --git a/tests/parse-ranges.test.mjs b/tests/parse-ranges.test.mjs
new file mode 100644
index 0000000..ad24456
--- /dev/null
+++ b/tests/parse-ranges.test.mjs
@@ -0,0 +1,96 @@
+import assert from "node:assert/strict";
+import { test } from "node:test";
+
+import { parseRanges } from "../src/parse-ranges.mjs";
+
+test("parseRanges reads pages and ranges", () => {
+  assert.deepEqual(parseRanges("1-3,5", 10), [1, 2, 3, 5]);
+  assert.deepEqual(parseRanges("7", 10), [7]);
+  assert.deepEqual(parseRanges("4-4", 10), [4]);
+  assert.deepEqual(parseRanges("1-10", 10), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
+});
+
+test("parseRanges accepts the first and last page", () => {
+  assert.deepEqual(parseRanges("1", 1), [1]);
+  assert.deepEqual(parseRanges("10", 10), [10]);
+});
+
+test("parseRanges ignores spaces around parts and hyphens", () => {
+  assert.deepEqual(parseRanges(" 1 - 3 , 5 ", 10), [1, 2, 3, 5]);
+});
+
+test("parseRanges keeps the order as typed and keeps repeats", () => {
+  assert.deepEqual(parseRanges("5,1-3", 10), [5, 1, 2, 3]);
+  assert.deepEqual(parseRanges("3,1", 10), [3, 1]);
+  assert.deepEqual(parseRanges("10,4-5,1", 10), [10, 4, 5, 1]);
+  assert.deepEqual(parseRanges("2,2", 10), [2, 2]);
+  assert.deepEqual(parseRanges("1-3,2", 10), [1, 2, 3, 2]);
+  assert.deepEqual(parseRanges("1-2,1-2", 10), [1, 2, 1, 2]);
+});
+
+test("parseRanges counts down a backwards range", () => {
+  assert.deepEqual(parseRanges("5-3", 10), [5, 4, 3]);
+  assert.deepEqual(parseRanges("10-8", 10), [10, 9, 8]);
+  assert.deepEqual(parseRanges("2-1", 10), [2, 1]);
+  assert.deepEqual(parseRanges("1,5-3", 10), [1, 5, 4, 3]);
+  assert.throws(() => parseRanges("11-9", 10), RangeError);
+  assert.throws(() => parseRanges("2-0", 10), RangeError);
+});
+
+test("parseRanges runs an open-ended range to the last page or from the first", () => {
+  assert.deepEqual(parseRanges("8-", 10), [8, 9, 10]);
+  assert.deepEqual(parseRanges("-3", 10), [1, 2, 3]);
+  assert.deepEqual(parseRanges("10-", 10), [10]);
+  assert.deepEqual(parseRanges("-1", 10), [1]);
+  assert.deepEqual(parseRanges("1,8-", 10), [1, 8, 9, 10]);
+  assert.throws(() => parseRanges("11-", 10), RangeError);
+  assert.throws(() => parseRanges("-11", 10), RangeError);
+  assert.throws(() => parseRanges("0-", 10), RangeError);
+  assert.throws(() => parseRanges("-0", 10), RangeError);
+});
+
+test("parseRanges means every page for empty or blank text", () => {
+  assert.deepEqual(parseRanges("", 10), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
+  assert.deepEqual(parseRanges("   ", 10), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
+  assert.deepEqual(parseRanges("", 1), [1]);
+});
+
+test("parseRanges refuses a text that is not a string", () => {
+  assert.throws(() => parseRanges(7, 10), TypeError);
+  assert.throws(() => parseRanges(undefined, 10), TypeError);
+  assert.throws(() => parseRanges(null, 10), TypeError);
+  assert.throws(() => parseRanges(["1"], 10), TypeError);
+});
+
+test("parseRanges refuses a pageCount that is not a positive integer", () => {
+  for (const bad of [0, -1, 2.5, "10", NaN, Infinity, null, undefined]) {
+    assert.throws(() => parseRanges("1", bad), TypeError, String(bad));
+  }
+});
+
+test("parseRanges refuses a page past the last one", () => {
+  assert.throws(() => parseRanges("11", 10), RangeError);
+  assert.throws(() => parseRanges("8-11", 10), RangeError);
+  assert.throws(() => parseRanges("1,99", 10), RangeError);
+});
+
+test("parseRanges refuses page 0", () => {
+  assert.throws(() => parseRanges("0", 10), RangeError);
+  assert.throws(() => parseRanges("0-3", 10), RangeError);
+});
+
+test("parseRanges refuses words and parts that are not pages or ranges", () => {
+  for (const bad of ["abc", "-", "1-2-3", "--3", "1.5", "+1", "1 2", "all", "1-x"]) {
+    assert.throws(() => parseRanges(bad, 10), RangeError, bad);
+  }
+});
+
+test("parseRanges refuses empty parts", () => {
+  for (const bad of [",", "1,", ",1", "1,,3"]) {
+    assert.throws(() => parseRanges(bad, 10), RangeError, JSON.stringify(bad));
+  }
+});
+
+test("parseRanges throws a TypeError when both arguments are wrong", () => {
+  assert.throws(() => parseRanges(1, 0), TypeError);
+});
```

## Candidate Z

```diff
diff --git a/README.md b/README.md
index c8aa9b8..15f02b3 100644
--- a/README.md
+++ b/README.md
@@ -16,3 +16,26 @@ that is not a string throws a `TypeError`.
 
 The dialog also has a page box, where a person types which pages of the
 document to print.
+
+```js
+import { parseRanges } from "./src/parse-ranges.mjs";
+
+parseRanges("1-3,5", 10); // [1, 2, 3, 5]
+parseRanges("7", 10);     // [7]
+```
+
+`parseRanges(text, pageCount)` reads what was typed in the page box and gives
+the page numbers to print as an array. Pages are numbered from 1 to
+`pageCount`; parts are separated by commas, and a part is one page (`7`) or a
+range written first-last (`1-3`). Spaces around parts and around the dash are
+ignored. Pages come back in the order typed, and a page typed twice comes back
+twice (`"2,2"` is `[2, 2]`). A range written last-first runs backward (`"5-3"`
+is `[5, 4, 3]`). A range may leave out its first page (`"-3"` is pages 1 to 3)
+or its last (`"8-"` is page 8 to the last page), but not both. An empty box
+(`""`, or only spaces) means every page.
+
+A `text` that is not a string, or a `pageCount` that is not a positive integer,
+throws a `TypeError`. A text that cannot be read as pages of the document (a
+page past the last one, page `0`, a word, an empty part between commas such as
+`"1,,2"`, a lone `-`, or a part that is neither a page nor a range) throws a
+`RangeError`.
diff --git a/src/parse-ranges.mjs b/src/parse-ranges.mjs
new file mode 100644
index 0000000..9bbb11c
--- /dev/null
+++ b/src/parse-ranges.mjs
@@ -0,0 +1,49 @@
+/**
+ * The page numbers to print, from what a person typed in the page box.
+ *
+ * Parts are separated by commas; a part is one page ("7") or a range written
+ * first-last ("1-3"). Spaces around parts and around the dash are ignored.
+ * Pages come back in the order typed, and a page typed twice comes back twice.
+ * A range written last-first ("5-3") runs backward. A range may leave out its
+ * first page ("-3", from page 1) or its last ("8-", to the last page), but not
+ * both. An empty (or blank) text means every page; an empty part between commas
+ * is refused.
+ * @param {string} text e.g. "1-3,5"
+ * @param {number} pageCount pages in the document, a positive integer
+ * @returns {number[]}
+ */
+export function parseRanges(text, pageCount) {
+  if (typeof text !== "string") throw new TypeError("parseRanges: text must be a string");
+  if (!Number.isInteger(pageCount) || pageCount < 1) {
+    throw new TypeError("parseRanges: pageCount must be a positive integer");
+  }
+
+  const pages = [];
+  const push = (first, last) => {
+    const step = first <= last ? 1 : -1;
+    for (let page = first; page !== last + step; page += step) pages.push(page);
+  };
+
+  if (text.trim() === "") {
+    push(1, pageCount);
+    return pages;
+  }
+
+  for (const raw of text.split(",")) {
+    const part = raw.trim();
+    const match = /^(\d+)?(?:\s*(-)\s*(\d+)?)?$/.exec(part);
+    if (!match || part === "" || part === "-") {
+      throw new RangeError(`parseRanges: cannot read "${part}" as a page or a range`);
+    }
+    const [, from, dash, to] = match;
+    const first = from === undefined ? 1 : Number(from);
+    let last;
+    if (dash === undefined) last = first;
+    else last = to === undefined ? pageCount : Number(to);
+    if (first < 1 || first > pageCount || last < 1 || last > pageCount) {
+      throw new RangeError(`parseRanges: "${part}" is not within pages 1 to ${pageCount}`);
+    }
+    push(first, last);
+  }
+  return pages;
+}
diff --git a/tests/parse-ranges.test.mjs b/tests/parse-ranges.test.mjs
new file mode 100644
index 0000000..a88bb40
--- /dev/null
+++ b/tests/parse-ranges.test.mjs
@@ -0,0 +1,84 @@
+import assert from "node:assert/strict";
+import { test } from "node:test";
+
+import { parseRanges } from "../src/parse-ranges.mjs";
+
+test("parseRanges reads ranges and single pages", () => {
+  assert.deepEqual(parseRanges("1-3,5", 10), [1, 2, 3, 5]);
+  assert.deepEqual(parseRanges("7", 10), [7]);
+  assert.deepEqual(parseRanges("4-4", 10), [4]);
+  assert.deepEqual(parseRanges("1-10", 10), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
+});
+
+test("parseRanges ignores spaces", () => {
+  assert.deepEqual(parseRanges(" 1 - 3 , 5 ", 10), [1, 2, 3, 5]);
+});
+
+test("parseRanges keeps the order typed", () => {
+  assert.deepEqual(parseRanges("5,1-3", 10), [5, 1, 2, 3]);
+  assert.deepEqual(parseRanges("3,1", 10), [3, 1]);
+  assert.deepEqual(parseRanges("10,4-5,1", 10), [10, 4, 5, 1]);
+});
+
+test("parseRanges repeats a page typed twice", () => {
+  assert.deepEqual(parseRanges("2,2", 10), [2, 2]);
+  assert.deepEqual(parseRanges("1-3,2", 10), [1, 2, 3, 2]);
+  assert.deepEqual(parseRanges("1-2,1-2", 10), [1, 2, 1, 2]);
+});
+
+test("parseRanges runs a range written last-first backward", () => {
+  assert.deepEqual(parseRanges("5-3", 10), [5, 4, 3]);
+  assert.deepEqual(parseRanges("10-8", 10), [10, 9, 8]);
+  assert.deepEqual(parseRanges("2-1", 10), [2, 1]);
+  assert.deepEqual(parseRanges("1,5-3", 10), [1, 5, 4, 3]);
+});
+
+test("parseRanges lets a range leave out one end", () => {
+  assert.deepEqual(parseRanges("8-", 10), [8, 9, 10]);
+  assert.deepEqual(parseRanges("-3", 10), [1, 2, 3]);
+  assert.deepEqual(parseRanges("10-", 10), [10]);
+  assert.deepEqual(parseRanges("-1", 10), [1]);
+  assert.deepEqual(parseRanges("1,8-", 10), [1, 8, 9, 10]);
+  assert.deepEqual(parseRanges(" 8 - ", 10), [8, 9, 10]);
+});
+
+test("parseRanges refuses a range with neither end, or an open end out of bounds", () => {
+  for (const bad of ["-", " - ", "1,-", "0-", "-0", "11-", "-11"]) {
+    assert.throws(() => parseRanges(bad, 10), RangeError, JSON.stringify(bad));
+  }
+});
+
+test("parseRanges reads an empty box as every page", () => {
+  assert.deepEqual(parseRanges("", 10), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
+  assert.deepEqual(parseRanges("   ", 10), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
+  assert.deepEqual(parseRanges("", 1), [1]);
+});
+
+test("parseRanges refuses a text that is not a string", () => {
+  assert.throws(() => parseRanges(7, 10), TypeError);
+  assert.throws(() => parseRanges(undefined, 10), TypeError);
+  assert.throws(() => parseRanges(null, 10), TypeError);
+  assert.throws(() => parseRanges(["1"], 10), TypeError);
+});
+
+test("parseRanges refuses a pageCount that is not a positive integer", () => {
+  for (const bad of [0, -1, 2.5, "10", NaN, Infinity, undefined, null]) {
+    assert.throws(() => parseRanges("1", bad), TypeError, String(bad));
+  }
+});
+
+test("parseRanges refuses a page past the last one", () => {
+  assert.throws(() => parseRanges("11", 10), RangeError);
+  assert.throws(() => parseRanges("8-11", 10), RangeError);
+});
+
+test("parseRanges refuses page 0", () => {
+  assert.throws(() => parseRanges("0", 10), RangeError);
+  assert.throws(() => parseRanges("0-3", 10), RangeError);
+});
+
+test("parseRanges refuses a word and parts that are neither page nor range", () => {
+  for (const bad of ["abc", "1-2-3", "1.5", "1,,2", "1,", ",1", ",", "1 2", "a-b"]) {
+    assert.throws(() => parseRanges(bad, 10), RangeError, JSON.stringify(bad));
+  }
+});
```

## Candidate U

```diff
diff --git a/README.md b/README.md
index c8aa9b8..0642730 100644
--- a/README.md
+++ b/README.md
@@ -16,3 +16,27 @@ that is not a string throws a `TypeError`.
 
 The dialog also has a page box, where a person types which pages of the
 document to print.
+
+```js
+import { parseRanges } from "./src/parse-ranges.mjs";
+
+parseRanges("1-3,5", 10); // [1, 2, 3, 5]
+parseRanges("7", 10);     // [7]
+```
+
+`parseRanges(text, pageCount)` reads what was typed into the page box and
+returns the page numbers to print as an array. Pages are numbered from 1 to
+`pageCount`; parts are separated by commas, and a part is one page (`7`) or a
+range written first-last (`1-3`). Spaces around parts and around the dash are
+ignored. Pages come back in the order typed, and a page typed twice comes back
+twice (`"1-3,2"` is `[1, 2, 3, 2]`). A range typed last-first runs backward
+(`"5-3"` is `[5, 4, 3]`). A range may leave out an end: a missing first page
+means page 1 (`"-3"` is `[1, 2, 3]`) and a missing last page means the last
+page of the document (`"8-"` in 10 pages is `[8, 9, 10]`). An empty box (or one
+holding only spaces) means every page.
+
+A `text` that is not a string, or a `pageCount` that is not a positive integer,
+throws a `TypeError`. A text that cannot be read as pages of the document
+throws a `RangeError`: a page past the last one, page `0`, a word, an empty
+part (`"1,,2"`, `"1,"`, `",1"`), a lone `-`, or any part that is neither a page
+nor a range.
diff --git a/src/parse-ranges.mjs b/src/parse-ranges.mjs
new file mode 100644
index 0000000..4483043
--- /dev/null
+++ b/src/parse-ranges.mjs
@@ -0,0 +1,47 @@
+const PART = /^(\d*)\s*(?:(-)\s*(\d*))?$/;
+
+/**
+ * The pages to print, from what a person typed into the page box.
+ * Parts are separated by commas; a part is one page ("7") or a range written
+ * first-last ("1-3"). Spaces around parts and around the dash are ignored.
+ * A range may leave out its first page (page 1) or its last page (the last
+ * page of the document): "-3" is 1-3 and "8-" is 8 to the end. An empty box
+ * means every page.
+ * Pages come back in the order typed, and a page typed twice comes back twice.
+ * A range typed last-first runs backward ("5-3" is 5, 4, 3).
+ * @param {string} text e.g. "1-3,5"
+ * @param {number} pageCount pages in the document, a positive integer
+ * @returns {number[]}
+ */
+export function parseRanges(text, pageCount) {
+  if (typeof text !== "string") throw new TypeError("parseRanges: text must be a string");
+  if (!Number.isInteger(pageCount) || pageCount < 1) {
+    throw new TypeError("parseRanges: pageCount must be a positive integer");
+  }
+
+  const pages = [];
+  if (text.trim() === "") {
+    for (let page = 1; page <= pageCount; page++) pages.push(page);
+    return pages;
+  }
+
+  for (const raw of text.split(",")) {
+    const part = raw.trim();
+    const match = PART.exec(part);
+    // A bare "-" or an empty part says nothing about which pages.
+    if (!match || part === "" || part === "-") {
+      throw new RangeError(`parseRanges: "${part}" is not a page or a range`);
+    }
+
+    const [, from, dash, to] = match;
+    const first = from === "" ? 1 : Number(from);
+    const last = dash === undefined ? first : to === "" ? pageCount : Number(to);
+    if (first < 1 || last < 1 || first > pageCount || last > pageCount) {
+      throw new RangeError(`parseRanges: "${part}" is outside pages 1-${pageCount}`);
+    }
+
+    const step = first <= last ? 1 : -1;
+    for (let page = first; page !== last + step; page += step) pages.push(page);
+  }
+  return pages;
+}
diff --git a/tests/parse-ranges.test.mjs b/tests/parse-ranges.test.mjs
new file mode 100644
index 0000000..35c05ac
--- /dev/null
+++ b/tests/parse-ranges.test.mjs
@@ -0,0 +1,98 @@
+import assert from "node:assert/strict";
+import { test } from "node:test";
+
+import { parseRanges } from "../src/parse-ranges.mjs";
+
+test("parseRanges reads ranges and single pages", () => {
+  assert.deepEqual(parseRanges("1-3,5", 10), [1, 2, 3, 5]);
+  assert.deepEqual(parseRanges("7", 10), [7]);
+});
+
+test("parseRanges accepts the first and last page and one-page ranges", () => {
+  assert.deepEqual(parseRanges("1", 10), [1]);
+  assert.deepEqual(parseRanges("10", 10), [10]);
+  assert.deepEqual(parseRanges("1-10", 10), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
+  assert.deepEqual(parseRanges("4-4", 10), [4]);
+  assert.deepEqual(parseRanges("1", 1), [1]);
+});
+
+test("parseRanges ignores spaces around parts", () => {
+  assert.deepEqual(parseRanges(" 1 - 3 , 5 ", 10), [1, 2, 3, 5]);
+});
+
+test("parseRanges returns pages in the order typed", () => {
+  assert.deepEqual(parseRanges("5,1-3", 10), [5, 1, 2, 3]);
+  assert.deepEqual(parseRanges("3,1", 10), [3, 1]);
+  assert.deepEqual(parseRanges("10,4-5,1", 10), [10, 4, 5, 1]);
+});
+
+test("parseRanges returns a page typed twice twice", () => {
+  assert.deepEqual(parseRanges("2,2", 10), [2, 2]);
+  assert.deepEqual(parseRanges("1-3,2", 10), [1, 2, 3, 2]);
+  assert.deepEqual(parseRanges("1-2,1-2", 10), [1, 2, 1, 2]);
+});
+
+test("parseRanges runs a range typed last-first backward", () => {
+  assert.deepEqual(parseRanges("5-3", 10), [5, 4, 3]);
+  assert.deepEqual(parseRanges("10-8", 10), [10, 9, 8]);
+  assert.deepEqual(parseRanges("2-1", 10), [2, 1]);
+  assert.deepEqual(parseRanges("1,5-3", 10), [1, 5, 4, 3]);
+});
+
+test("parseRanges reads a missing first page as 1 and a missing last page as the last", () => {
+  assert.deepEqual(parseRanges("8-", 10), [8, 9, 10]);
+  assert.deepEqual(parseRanges("-3", 10), [1, 2, 3]);
+  assert.deepEqual(parseRanges("10-", 10), [10]);
+  assert.deepEqual(parseRanges("-1", 10), [1]);
+  assert.deepEqual(parseRanges("1,8-", 10), [1, 8, 9, 10]);
+});
+
+test("parseRanges reads an empty box as every page", () => {
+  assert.deepEqual(parseRanges("", 10), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
+  assert.deepEqual(parseRanges("   ", 10), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
+  assert.deepEqual(parseRanges("", 1), [1]);
+});
+
+test("parseRanges returns a new array each call", () => {
+  const first = parseRanges("1-2", 10);
+  first.push(99);
+  assert.deepEqual(parseRanges("1-2", 10), [1, 2]);
+  assert.notEqual(parseRanges("", 3), parseRanges("", 3));
+});
+
+test("parseRanges throws TypeError when text is not a string", () => {
+  for (const text of [undefined, null, 7, ["1"], {}]) {
+    assert.throws(() => parseRanges(text, 10), TypeError);
+  }
+});
+
+test("parseRanges throws TypeError when pageCount is not a positive integer", () => {
+  for (const count of [0, -1, 2.5, "10", NaN, Infinity, undefined, null]) {
+    assert.throws(() => parseRanges("1", count), TypeError);
+  }
+});
+
+test("parseRanges throws RangeError for a page past the last one", () => {
+  assert.throws(() => parseRanges("11", 10), RangeError);
+  assert.throws(() => parseRanges("1-11", 10), RangeError);
+  for (const text of ["12-8", "12-", "-12"]) {
+    assert.throws(() => parseRanges(text, 10), RangeError, text);
+  }
+  assert.throws(() => parseRanges("99999999999999999999", 10), RangeError);
+});
+
+test("parseRanges throws RangeError for page 0", () => {
+  assert.throws(() => parseRanges("0", 10), RangeError);
+  assert.throws(() => parseRanges("0-3", 10), RangeError);
+});
+
+test("parseRanges throws RangeError for a word", () => {
+  assert.throws(() => parseRanges("all", 10), RangeError);
+  assert.throws(() => parseRanges("1,two", 10), RangeError);
+});
+
+test("parseRanges throws RangeError for a part that is neither a page nor a range", () => {
+  for (const text of ["1,,2", "1,", ",1", ",", "-", "1-2-3", "1 2", "1 0", "00", "2.5", "+1", "1;2"]) {
+    assert.throws(() => parseRanges(text, 10), RangeError, JSON.stringify(text));
+  }
+});
```

## Candidate G

```diff
diff --git a/README.md b/README.md
index c8aa9b8..0b13a54 100644
--- a/README.md
+++ b/README.md
@@ -16,3 +16,28 @@ that is not a string throws a `TypeError`.
 
 The dialog also has a page box, where a person types which pages of the
 document to print.
+
+```js
+import { parseRanges } from "./src/parse-ranges.mjs";
+
+parseRanges("1-3,5", 10); // [1, 2, 3, 5]
+parseRanges("7", 10);     // [7]
+```
+
+`parseRanges(text, pageCount)` reads what was typed in the page box and gives
+the page numbers to print as an array. Pages are numbered from 1 to
+`pageCount`; parts are separated by commas, and a part is one page or a range
+written first-last. Spaces around parts and around the dash are ignored.
+
+- Pages come back in the order typed, and a page typed twice comes back twice:
+  `"5,1-3"` is `[5, 1, 2, 3]` and `"1-3,2"` is `[1, 2, 3, 2]`.
+- A range written last-first runs backward: `"5-3"` is `[5, 4, 3]`.
+- A range may leave out its first page (from page 1) or its last page (to the
+  last page): `"-3"` is `[1, 2, 3]` and `"8-"` is `[8, 9, 10]` in 10 pages.
+- Empty text (or only spaces) means every page.
+
+A `text` that is not a string, or a `pageCount` that is not a positive integer,
+throws a `TypeError`. A text that cannot be read as pages of the document
+throws a `RangeError`: a page past the last one, page 0, a word, an empty part
+(as in `"1,,2"` or `"1,"`), a lone `-`, or a part that is neither a page nor a
+range.
diff --git a/src/parse-ranges.mjs b/src/parse-ranges.mjs
new file mode 100644
index 0000000..ff905e9
--- /dev/null
+++ b/src/parse-ranges.mjs
@@ -0,0 +1,62 @@
+const PART = /^(?:([0-9]+)|([0-9]*)\s*-\s*([0-9]*))$/;
+
+/**
+ * The pages to print, from what a person typed in the page box.
+ *
+ * Parts are separated by commas; a part is one page ("7") or a range written
+ * first-last ("1-3"). Spaces around parts and around the dash are ignored.
+ * Pages are numbered from 1 to pageCount. The result lists pages in the order
+ * typed, and a page typed twice (or covered by two parts) comes back twice. A
+ * range written last-first ("5-3") runs backward ([5, 4, 3]). A range may leave
+ * out its first page (meaning page 1, as in "-3") or its last page (meaning
+ * pageCount, as in "8-"). Empty text, or text of only spaces, means every page.
+ *
+ * @param {string} text what was typed, such as "1-3,5"
+ * @param {number} pageCount the number of pages in the document (a positive integer)
+ * @returns {number[]}
+ * @throws {TypeError} text is not a string, or pageCount is not a positive integer
+ * @throws {RangeError} text cannot be read as pages of this document: it has
+ *   an empty part, a part that is neither a page nor a range (including a lone
+ *   "-"), or a page 0 or past pageCount
+ */
+export function parseRanges(text, pageCount) {
+  if (typeof text !== "string") throw new TypeError("parseRanges: text must be a string");
+  if (!Number.isSafeInteger(pageCount) || pageCount < 1) {
+    throw new TypeError("parseRanges: pageCount must be a positive integer");
+  }
+
+  const pages = [];
+  if (text.trim() === "") {
+    for (let page = 1; page <= pageCount; page++) pages.push(page);
+    return pages;
+  }
+
+  for (const raw of text.split(",")) {
+    const part = raw.trim();
+    const match = PART.exec(part);
+    // A lone "-" matches PART with both ends open; it names no pages.
+    const loneDash = match && match[1] === undefined && match[2] === "" && match[3] === "";
+    if (!match || loneDash) {
+      throw new RangeError(`parseRanges: cannot read "${part}" as a page or a range`);
+    }
+    let first;
+    let last;
+    if (match[1] !== undefined) {
+      first = last = Number(match[1]);
+    } else {
+      first = match[2] === "" ? 1 : Number(match[2]);
+      last = match[3] === "" ? pageCount : Number(match[3]);
+    }
+    if (first < 1 || last < 1 || first > pageCount || last > pageCount) {
+      throw new RangeError(
+        `parseRanges: "${part}" is outside the document's pages 1-${pageCount}`,
+      );
+    }
+    if (first <= last) {
+      for (let page = first; page <= last; page++) pages.push(page);
+    } else {
+      for (let page = first; page >= last; page--) pages.push(page);
+    }
+  }
+  return pages;
+}
diff --git a/tests/parse-ranges.test.mjs b/tests/parse-ranges.test.mjs
new file mode 100644
index 0000000..3dc090e
--- /dev/null
+++ b/tests/parse-ranges.test.mjs
@@ -0,0 +1,108 @@
+import assert from "node:assert/strict";
+import { test } from "node:test";
+
+import { parseRanges } from "../src/parse-ranges.mjs";
+
+test("parseRanges reads a list of pages and ranges", () => {
+  assert.deepEqual(parseRanges("1-3,5", 10), [1, 2, 3, 5]);
+});
+
+test("parseRanges reads a single page", () => {
+  assert.deepEqual(parseRanges("7", 10), [7]);
+});
+
+test("parseRanges accepts the first and last pages and a one-page range", () => {
+  assert.deepEqual(parseRanges("1,10", 10), [1, 10]);
+  assert.deepEqual(parseRanges("4-4", 10), [4]);
+  assert.deepEqual(parseRanges("1-10", 10), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
+  assert.deepEqual(parseRanges("1", 1), [1]);
+});
+
+test("parseRanges ignores spaces around parts and the dash", () => {
+  assert.deepEqual(parseRanges(" 1 - 3 , 5 ", 10), [1, 2, 3, 5]);
+});
+
+test("parseRanges lists pages in the order typed", () => {
+  assert.deepEqual(parseRanges("5,1-3", 10), [5, 1, 2, 3]);
+  assert.deepEqual(parseRanges("3,1", 10), [3, 1]);
+  assert.deepEqual(parseRanges("10,4-5,1", 10), [10, 4, 5, 1]);
+});
+
+test("parseRanges repeats a page typed twice", () => {
+  assert.deepEqual(parseRanges("2,2", 10), [2, 2]);
+  assert.deepEqual(parseRanges("1-3,2", 10), [1, 2, 3, 2]);
+  assert.deepEqual(parseRanges("1-2,1-2", 10), [1, 2, 1, 2]);
+});
+
+test("parseRanges runs a range written last-first backward", () => {
+  assert.deepEqual(parseRanges("5-3", 10), [5, 4, 3]);
+  assert.deepEqual(parseRanges("10-8", 10), [10, 9, 8]);
+  assert.deepEqual(parseRanges("2-1", 10), [2, 1]);
+  assert.deepEqual(parseRanges("1,5-3", 10), [1, 5, 4, 3]);
+});
+
+test("parseRanges lets a range leave out its first or last page", () => {
+  assert.deepEqual(parseRanges("8-", 10), [8, 9, 10]);
+  assert.deepEqual(parseRanges("-3", 10), [1, 2, 3]);
+  assert.deepEqual(parseRanges("10-", 10), [10]);
+  assert.deepEqual(parseRanges("-1", 10), [1]);
+  assert.deepEqual(parseRanges("1,8-", 10), [1, 8, 9, 10]);
+  assert.deepEqual(parseRanges(" 8 - ", 10), [8, 9, 10]);
+});
+
+test("parseRanges reads empty text as every page", () => {
+  assert.deepEqual(parseRanges("", 10), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
+  assert.deepEqual(parseRanges("   ", 10), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
+  assert.deepEqual(parseRanges("", 1), [1]);
+});
+
+test("parseRanges throws TypeError when text is not a string", () => {
+  for (const bad of [undefined, null, 7, ["1"], { toString: () => "1" }]) {
+    assert.throws(() => parseRanges(bad, 10), TypeError);
+  }
+});
+
+test("parseRanges throws TypeError when pageCount is not a positive integer", () => {
+  for (const bad of [0, -1, 2.5, "10", NaN, Infinity, null, undefined]) {
+    assert.throws(() => parseRanges("1", bad), TypeError);
+  }
+});
+
+test("parseRanges checks the types before reading the text", () => {
+  assert.throws(() => parseRanges("abc", 0), TypeError);
+  assert.throws(() => parseRanges(5, 0), TypeError);
+});
+
+test("parseRanges throws RangeError for a page past the last one", () => {
+  assert.throws(() => parseRanges("11", 10), RangeError);
+  assert.throws(() => parseRanges("1-11", 10), RangeError);
+  assert.throws(() => parseRanges("1,99999999999999999999", 10), RangeError);
+});
+
+test("parseRanges throws RangeError for page 0", () => {
+  assert.throws(() => parseRanges("0", 10), RangeError);
+  assert.throws(() => parseRanges("0-3", 10), RangeError);
+});
+
+test("parseRanges throws RangeError for a word", () => {
+  assert.throws(() => parseRanges("all", 10), RangeError);
+  assert.throws(() => parseRanges("1,two", 10), RangeError);
+});
+
+test("parseRanges throws RangeError for a part that is neither a page nor a range", () => {
+  for (const bad of ["-", " - ", "1-2-3", "1.5", "1 0", "+1", "1e1", "0x1", "1 2", "1;2", "1--3"]) {
+    assert.throws(() => parseRanges(bad, 10), RangeError, bad);
+  }
+});
+
+test("parseRanges throws RangeError for empty parts", () => {
+  for (const bad of [",", "1,", ",1", "1,,2", "1, ,2", "1,2,"]) {
+    assert.throws(() => parseRanges(bad, 10), RangeError, JSON.stringify(bad));
+  }
+});
+
+test("parseRanges throws RangeError for an open range outside the document", () => {
+  for (const bad of ["12-", "-12", "0-", "-0", "12-8", "00"]) {
+    assert.throws(() => parseRanges(bad, 10), RangeError, bad);
+  }
+});
```

## Candidate H

```diff
diff --git a/README.md b/README.md
index c8aa9b8..8e47815 100644
--- a/README.md
+++ b/README.md
@@ -16,3 +16,24 @@ that is not a string throws a `TypeError`.
 
 The dialog also has a page box, where a person types which pages of the
 document to print.
+
+```js
+import { parseRanges } from "./src/parse-ranges.mjs";
+
+parseRanges("1-3,5", 10); // [1, 2, 3, 5]
+parseRanges("7", 10);     // [7]
+```
+
+`parseRanges(text, pageCount)` reads what was typed in the page box and gives
+the page numbers to print as an array. Pages are numbered from 1 to
+`pageCount`; parts are separated by commas, and a part is one page (`7`) or a
+range written first-last (`1-3`). Spaces around parts and dashes are ignored.
+The pages come back in the order typed, and a page typed twice comes back
+twice (`"5,1-3"` is `[5, 1, 2, 3]`, `"2,2"` is `[2, 2]`). A range typed
+last-first runs backward (`"5-3"` is `[5, 4, 3]`). A range may leave out its
+first page (`"-3"` is `[1, 2, 3]`) or its last (`"8-"` runs to the last page),
+but not both. An empty or blank text means every page. A `text` that is not a
+string, or a `pageCount` that is not a positive integer, throws a `TypeError`.
+A text that cannot be read as pages of the document throws a `RangeError`: a
+page past the last one, page `0`, a word, an empty part between commas (`1,,2`,
+`1,`), a lone dash, or any part that is neither a page nor a range.
diff --git a/src/parse-ranges.mjs b/src/parse-ranges.mjs
new file mode 100644
index 0000000..7ad4e28
--- /dev/null
+++ b/src/parse-ranges.mjs
@@ -0,0 +1,57 @@
+const PAGE = /^\d+$/;
+
+/**
+ * The page numbers a person typed into the page box, as a list.
+ * Parts are separated by commas; a part is one page ("7") or a range written
+ * first-last ("1-3"). Spaces around parts and around the dash are ignored.
+ * Pages come back in the order typed and a page typed twice comes back twice.
+ * A range typed last-first ("5-3") runs backward. A range may leave out its
+ * first page ("-3", from page 1) or its last ("8-", to the last page), but not
+ * both. An empty or blank text means every page; an empty part between commas
+ * is refused.
+ * @param {string} text what was typed, such as "1-3,5"
+ * @param {number} pageCount how many pages the document has (a positive integer)
+ * @returns {number[]}
+ */
+export function parseRanges(text, pageCount) {
+  if (typeof text !== "string") throw new TypeError("parseRanges: text must be a string");
+  if (typeof pageCount !== "number" || !Number.isInteger(pageCount) || pageCount < 1) {
+    throw new TypeError("parseRanges: pageCount must be a positive integer");
+  }
+
+  const result = [];
+  if (text.trim() === "") {
+    for (let n = 1; n <= pageCount; n++) result.push(n);
+    return result;
+  }
+
+  const unreadable = (part) =>
+    new RangeError(`parseRanges: cannot read "${part}" as a page or a range`);
+
+  const page = (word, part) => {
+    if (!PAGE.test(word)) throw unreadable(part);
+    const n = Number(word);
+    if (n < 1 || n > pageCount) {
+      throw new RangeError(`parseRanges: page ${word} is not in a document of ${pageCount} pages`);
+    }
+    return n;
+  };
+
+  for (const raw of text.split(",")) {
+    const part = raw.trim();
+    const words = part.split("-").map((w) => w.trim());
+    if (words.length > 2) throw unreadable(part);
+    let first;
+    let last;
+    if (words.length === 1) {
+      first = last = page(words[0], part);
+    } else {
+      if (words[0] === "" && words[1] === "") throw unreadable(part);
+      first = words[0] === "" ? 1 : page(words[0], part);
+      last = words[1] === "" ? pageCount : page(words[1], part);
+    }
+    const step = first <= last ? 1 : -1;
+    for (let n = first; n !== last + step; n += step) result.push(n);
+  }
+  return result;
+}
diff --git a/tests/parse-ranges.test.mjs b/tests/parse-ranges.test.mjs
new file mode 100644
index 0000000..bc9a245
--- /dev/null
+++ b/tests/parse-ranges.test.mjs
@@ -0,0 +1,80 @@
+import assert from "node:assert/strict";
+import { test } from "node:test";
+
+import { parseRanges } from "../src/parse-ranges.mjs";
+
+test("parseRanges reads ranges and single pages", () => {
+  assert.deepEqual(parseRanges("1-3,5", 10), [1, 2, 3, 5]);
+  assert.deepEqual(parseRanges("7", 10), [7]);
+  assert.deepEqual(parseRanges("4-4", 10), [4]);
+  assert.deepEqual(parseRanges("1-10", 10), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
+  assert.deepEqual(parseRanges("1", 1), [1]);
+});
+
+test("parseRanges ignores spaces and leading zeros", () => {
+  assert.deepEqual(parseRanges(" 1 - 3 , 5 ", 10), [1, 2, 3, 5]);
+  assert.deepEqual(parseRanges("02-03", 10), [2, 3]);
+});
+
+test("parseRanges gives pages in the order typed, repeats kept", () => {
+  assert.deepEqual(parseRanges("5,1-3", 10), [5, 1, 2, 3]);
+  assert.deepEqual(parseRanges("3,1", 10), [3, 1]);
+  assert.deepEqual(parseRanges("10,4-5,1", 10), [10, 4, 5, 1]);
+  assert.deepEqual(parseRanges("2,2", 10), [2, 2]);
+  assert.deepEqual(parseRanges("1-3,2", 10), [1, 2, 3, 2]);
+  assert.deepEqual(parseRanges("1-2,1-2", 10), [1, 2, 1, 2]);
+});
+
+test("parseRanges runs a range typed last-first backward", () => {
+  assert.deepEqual(parseRanges("5-3", 10), [5, 4, 3]);
+  assert.deepEqual(parseRanges("10-8", 10), [10, 9, 8]);
+  assert.deepEqual(parseRanges("2-1", 10), [2, 1]);
+  assert.deepEqual(parseRanges("1,5-3", 10), [1, 5, 4, 3]);
+});
+
+test("parseRanges lets a range leave out its first or last page", () => {
+  assert.deepEqual(parseRanges("8-", 10), [8, 9, 10]);
+  assert.deepEqual(parseRanges("-3", 10), [1, 2, 3]);
+  assert.deepEqual(parseRanges("10-", 10), [10]);
+  assert.deepEqual(parseRanges("-1", 10), [1]);
+  assert.deepEqual(parseRanges("1,8-", 10), [1, 8, 9, 10]);
+  assert.deepEqual(parseRanges(" 8 - ", 10), [8, 9, 10]);
+});
+
+test("parseRanges reads an empty or blank text as every page", () => {
+  assert.deepEqual(parseRanges("", 10), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
+  assert.deepEqual(parseRanges("   ", 10), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
+  assert.deepEqual(parseRanges("", 1), [1]);
+});
+
+test("parseRanges returns a new array each call", () => {
+  const a = parseRanges("", 3);
+  a.push(99);
+  assert.deepEqual(parseRanges("", 3), [1, 2, 3]);
+});
+
+test("parseRanges refuses a text that is not a string", () => {
+  assert.throws(() => parseRanges(7, 10), TypeError);
+  assert.throws(() => parseRanges(undefined, 10), TypeError);
+  assert.throws(() => parseRanges(null, 10), TypeError);
+  assert.throws(() => parseRanges(["1"], 10), TypeError);
+});
+
+test("parseRanges refuses a pageCount that is not a positive integer", () => {
+  for (const bad of [0, -1, 2.5, "10", NaN, Infinity, null, undefined]) {
+    assert.throws(() => parseRanges("1", bad), TypeError, String(bad));
+  }
+});
+
+test("parseRanges refuses pages outside the document", () => {
+  assert.throws(() => parseRanges("11", 10), RangeError);
+  assert.throws(() => parseRanges("8-11", 10), RangeError);
+  assert.throws(() => parseRanges("0", 10), RangeError);
+  assert.throws(() => parseRanges("0-3", 10), RangeError);
+});
+
+test("parseRanges refuses what is not pages", () => {
+  for (const bad of ["abc", "1,,2", "1,", ",1", ",", "-", " - ", "1-2-3", "a-b", "1.5", "+1", "1 2", "1;2", "1,-", "11-", "-11", "-0", "0-"]) {
+    assert.throws(() => parseRanges(bad, 10), RangeError, JSON.stringify(bad));
+  }
+});
```

## Candidate M

```diff
diff --git a/README.md b/README.md
index c8aa9b8..44ff9b3 100644
--- a/README.md
+++ b/README.md
@@ -16,3 +16,20 @@ that is not a string throws a `TypeError`.
 
 The dialog also has a page box, where a person types which pages of the
 document to print.
+
+```js
+import { parseRanges } from "./src/parse-ranges.mjs";
+
+parseRanges("1-3,5", 10); // [1, 2, 3, 5]
+parseRanges("7", 10);     // [7]
+```
+
+`parseRanges(text, pageCount)` gives the pages to print, from what was typed
+into the page box, for a document whose pages are numbered 1 to `pageCount`.
+Parts are separated by commas; a part is one page, such as `7`, or a range
+written first-last, such as `1-3`. Spaces around pages are allowed. Each page
+is given once, in ascending order. A `text` that is not a string, or a
+`pageCount` that is not a positive integer, throws a `TypeError`. A text that
+cannot be read as pages of the document throws a `RangeError`: an empty text
+or part, a page past the last one, page `0`, a word, a range that runs
+backwards such as `3-1`, or any other part that is neither a page nor a range.
diff --git a/src/parse-ranges.mjs b/src/parse-ranges.mjs
new file mode 100644
index 0000000..2efeec0
--- /dev/null
+++ b/src/parse-ranges.mjs
@@ -0,0 +1,36 @@
+const PAGE = /^\d+$/;
+const RANGE = /^(\d+)\s*-\s*(\d+)$/;
+
+/**
+ * The pages to print, from what a person typed into the page box.
+ * Gives each page once, in ascending order.
+ * @param {string} text pages and ranges separated by commas, such as "1-3,5"
+ * @param {number} pageCount the number of pages in the document, a positive integer
+ */
+export function parseRanges(text, pageCount) {
+  if (typeof text !== "string") throw new TypeError("parseRanges: text must be a string");
+  if (!Number.isInteger(pageCount) || pageCount < 1) {
+    throw new TypeError("parseRanges: pageCount must be a positive integer");
+  }
+
+  const pages = new Set();
+  for (const raw of text.split(",")) {
+    const part = raw.trim();
+    let first, last;
+    const range = RANGE.exec(part);
+    if (range) {
+      first = Number(range[1]);
+      last = Number(range[2]);
+    } else if (PAGE.test(part)) {
+      first = last = Number(part);
+    } else {
+      throw new RangeError(`parseRanges: "${part}" is neither a page nor a range`);
+    }
+    if (first < 1 || last > pageCount) {
+      throw new RangeError(`parseRanges: "${part}" is outside pages 1-${pageCount}`);
+    }
+    if (first > last) throw new RangeError(`parseRanges: "${part}" runs backwards`);
+    for (let page = first; page <= last; page++) pages.add(page);
+  }
+  return [...pages].sort((a, b) => a - b);
+}
diff --git a/tests/parse-ranges.test.mjs b/tests/parse-ranges.test.mjs
new file mode 100644
index 0000000..7810079
--- /dev/null
+++ b/tests/parse-ranges.test.mjs
@@ -0,0 +1,57 @@
+import assert from "node:assert/strict";
+import { test } from "node:test";
+
+import { parseRanges } from "../src/parse-ranges.mjs";
+
+test("parseRanges reads pages and ranges", () => {
+  assert.deepEqual(parseRanges("1-3,5", 10), [1, 2, 3, 5]);
+  assert.deepEqual(parseRanges("7", 10), [7]);
+});
+
+test("parseRanges reaches the first and last page", () => {
+  assert.deepEqual(parseRanges("1", 10), [1]);
+  assert.deepEqual(parseRanges("10", 10), [10]);
+  assert.deepEqual(parseRanges("1-10", 10), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
+  assert.deepEqual(parseRanges("4-4", 10), [4]);
+});
+
+test("parseRanges allows spaces around pages", () => {
+  assert.deepEqual(parseRanges(" 1 - 3 , 5 ", 10), [1, 2, 3, 5]);
+});
+
+test("parseRanges gives each page once, in ascending order", () => {
+  assert.deepEqual(parseRanges("5,1-3,2", 10), [1, 2, 3, 5]);
+});
+
+test("parseRanges refuses a text that is not a string", () => {
+  assert.throws(() => parseRanges(7, 10), TypeError);
+  assert.throws(() => parseRanges(undefined, 10), TypeError);
+  assert.throws(() => parseRanges(null, 10), TypeError);
+});
+
+test("parseRanges refuses a pageCount that is not a positive integer", () => {
+  for (const pageCount of [0, -1, 2.5, "10", NaN, Infinity, undefined]) {
+    assert.throws(() => parseRanges("1", pageCount), TypeError, String(pageCount));
+  }
+});
+
+test("parseRanges refuses a page past the last one", () => {
+  assert.throws(() => parseRanges("11", 10), RangeError);
+  assert.throws(() => parseRanges("8-11", 10), RangeError);
+});
+
+test("parseRanges refuses page 0", () => {
+  assert.throws(() => parseRanges("0", 10), RangeError);
+  assert.throws(() => parseRanges("0-3", 10), RangeError);
+});
+
+test("parseRanges refuses a word", () => {
+  assert.throws(() => parseRanges("all", 10), RangeError);
+  assert.throws(() => parseRanges("1,two", 10), RangeError);
+});
+
+test("parseRanges refuses a part that is neither a page nor a range", () => {
+  for (const text of ["", "1,,3", "1,", "1-", "-3", "1-2-3", "1.5", "+2", "1e1", "0x2", "-1", "3-1"]) {
+    assert.throws(() => parseRanges(text, 10), RangeError, JSON.stringify(text));
+  }
+});
```

# What to do

For each candidate, score it from 1 to 5 against the task and the acceptance material (5: every requirement clearly met with tests that would catch a regression; 3: the main behaviour is right but a requirement is unmet, untested or fragile; 1: does not do the task), with two or three sentences of reasons that cite the diff. Then rank all candidates from best to worst; ties are allowed only when you can say why two are indistinguishable. Judge the deliverable, not its volume: more lines are not more credit.

End your reply with exactly one fenced JSON block of this shape, and nothing after it:

```json
{
  "scores": { "J": { "score": <1-5>, "reasons": "<two or three sentences>" }, "N": { "score": <1-5>, "reasons": "<two or three sentences>" }, "T": { "score": <1-5>, "reasons": "<two or three sentences>" }, "Z": { "score": <1-5>, "reasons": "<two or three sentences>" }, "U": { "score": <1-5>, "reasons": "<two or three sentences>" }, "G": { "score": <1-5>, "reasons": "<two or three sentences>" }, "H": { "score": <1-5>, "reasons": "<two or three sentences>" }, "M": { "score": <1-5>, "reasons": "<two or three sentences>" } },
  "ranking": ["J", "N", "T", "Z", "U", "G", "H", "M"],
  "notes": "<anything that applied to several candidates, in at most three sentences>"
}
```


## Reply

**N** and **M** follow the task as written. **J, T, Z, U, G** and **H** add behaviour that the task and the checklist say should throw a `RangeError`. Every diff I read stays within `src/`, `tests/` and `README.md` (checklist item 6). I traced each test against its implementation and found none that would fail, but I could not run `npm test` (item 5).

**Where six candidates go beyond the spec.** The task defines a part as "one page or a range written first-last". It says text that "cannot be read as pages of this document throws a RangeError", and checklist item 3 extends that to "a part that is neither a page nor a range". J, T, Z, U, G and H nonetheless:
- accept open-ended parts such as `"8-"` and `"-3"`;
- read `""` or blank text as every page;
- count a backward range like `"5-3"` downward.

They also document and test these choices, which locks in invented behaviour. Their code is otherwise correct and well tested, so I scored them 3.

**Candidate N (5).** It accepts exactly a page (`PAGE = /^\d+$/`) or a first-last range (`RANGE = /^(\d+)\s*-\s*(\d+)$/`). It bounds-checks each end in `page()` and throws a `RangeError` for a backward range. The final loop covers `""`, `"1,,3"`, `"8-"`, `"-3"`, `"3-1"`, `"+2"` and `"1.5"`. Item 2 is met in the first test and item 3 across the type and range tests. The README gives an example, the set of `pageCount` values that throw, and the de-duplicated ascending order.

**Candidate M (4).** Same model as N, with the same tests for both examples, page 0, past-last, a word, and malformed parts including `""` and `"3-1"`. Two weaknesses:
- The bounds check `first < 1 || last > pageCount` misses `"11-10"`. That input is only caught afterwards, as a backward range, so the bounds logic depends on the order of the checks.
- The JSDoc does not mention the throws, and the text-type test does not cover an array input.

**Candidate G (3, best of the extended six).** It has the strongest tests in the group: `"1e1"`, `"0x1"`, `"1--3"`, `"1, ,2"`, `"00"`, a type check that runs before parsing, and a `toString` object. It also has `@throws` docs and uses `Number.isSafeInteger`. It still accepts `"8-"`, `"-3"` and `""` (all pages), and counts `"5-3"` down, none of which the task asked for.

**Candidate U (3).** The `PART` regex is correct, and its tests include `"00"`, `"1 0"` and a 20-digit page. It carries the same open-end, empty-means-all and backward-range extensions.

**Candidate J (3).** Its split-on-dash parsing with `parsePage` is correct. It tests the type-check order and very large numbers. Same extensions as above.

**Candidate T (3).** Its single bounds check using `Math.min`/`Math.max` is sound, and it tests out-of-range open and backward parts. Same extensions; its tests are a little thinner than G, U and J.

**Candidate H (3).** It explicitly accepts leading zeros (`"02-03"`), which is an extra invented choice. Its tests are packed into one loop, and its README runs the throws text into the behaviour paragraph.

**Candidate Z (3).** Correct, but its tests are the thinnest of the extended group. Like the others it reads `""` as every page and accepts `"-3"`, which the spec says should be rejected.

```json
{
  "scores": {
    "J": { "score": 3, "reasons": "The code is correct for what it chooses to do and well tested. It covers both examples, every TypeError value, page 0, past-last, words, \"1-2-3\" and huge numbers, and the README documents everything. However it accepts \"8-\", \"-3\" and \"\" (as every page) and counts \"5-3\" down, which the task did not ask for. Those are parts that are neither a page nor a first-last range, so they should throw a RangeError." },
    "N": { "score": 5, "reasons": "It accepts exactly a page (`PAGE`) or a first-last range (`RANGE`) and bounds-checks both ends in `page()`. A backward range throws a RangeError, and the final test loop covers \"\", \"1,,3\", \"8-\", \"-3\", \"3-1\", \"+2\" and \"1.5\". Every checklist example is tested, and the README gives an example, the values that throw and the ascending de-duplicated result." },
    "T": { "score": 3, "reasons": "Its single bounds check uses `Math.min`/`Math.max` and is sound, and the tests cover out-of-range open and backward parts as well as empty parts. It shares the invented behaviour: open-ended ranges, empty text meaning every page, and descending ranges, all documented and tested instead of throwing a RangeError." },
    "Z": { "score": 3, "reasons": "The one-regex parse with explicit rejection of \"\" and \"-\" is correct, and the tests cover the examples, the types and the malformed parts. Its tests are the thinnest of the extended group. It also accepts \"-3\", \"8-\" and blank text (as every page), which the spec says should be rejected." },
    "U": { "score": 3, "reasons": "The `PART` regex and bounds check are correct, and the tests include \"00\", \"1 0\" and a 20-digit page. It has the same extensions as the others: open ends, blank text meaning every page, and backward ranges counting down. They are documented, but they replace the RangeError the task implies." },
    "G": { "score": 3, "reasons": "It has the strongest tests in its group (\"1e1\", \"0x1\", \"1--3\", \"1, ,2\", a type check before parsing), `@throws` documentation and a `Number.isSafeInteger` check. The behaviour still goes beyond the spec: \"8-\", \"-3\" and \"\" are accepted and \"5-3\" counts down, where the task and checklist call for a RangeError." },
    "H": { "score": 3, "reasons": "Its split-based parsing is correct and the tests pass by trace, but it explicitly accepts leading zeros (\"02-03\") on top of the open-end, empty-means-every-page and backward-range extensions. Its tests are packed into one loop, and the README merges the throws text into the behaviour paragraph." },
    "M": { "score": 4, "reasons": "It is strict and matches the task, with tests for both examples, page 0, past-last, words and malformed parts, including \"\" and \"3-1\". The bounds check `first < 1 || last > pageCount` misses \"11-10\", which is only caught afterwards as a backward range, so correctness depends on the order of the checks. The JSDoc omits the throws and the text-type test leaves out arrays." }
  },
  "ranking": ["N", "M", "G", "U", "J", "T", "H", "Z"],
  "notes": "Six candidates add the same untasked behaviour: open-ended ranges, empty text meaning every page, and backward ranges counting down. Each accepts input that the task and checklist item 3 say should throw a RangeError; among them, the order reflects test rigour and documentation, since their code is otherwise equivalent. Every diff I read stays within src/, tests/ and README.md, and I traced every test against its implementation without finding one that fails, but I could not run npm test."
}
```
