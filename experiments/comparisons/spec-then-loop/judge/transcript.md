# Blind judge · spec-then-loop

Model `claude-fable-5-1`, no tools, fresh session, 2026-09-22T00:04:56.388Z; ledger invocation 40, $1.1167. The letters' mapping is in `mapping.json`, which the judge never saw.

## Prompt

You are a critic judging 9 candidate changes to one small Node project. Each candidate was produced by a different session working from the same task; you do not know how, and you should not guess. Judge only what the diff shows against the task and its acceptance material. You have no tools: read carefully and cite lines of the diff.

# The task

Add word wrapping to this project: a function that wraps text to a given width.

# Acceptance material the builder saw

### README.md

```
# textwrap

Small helpers for laying out plain text in a terminal.

```js
import { countWords } from "./src/count.mjs";

countWords("one two  three"); // 3
```
```

# Candidates (in random order, under random letters)

## Candidate R

```diff
diff --git a/ACCEPTANCE.md b/ACCEPTANCE.md
new file mode 100644
index 0000000..cf9f5b3
--- /dev/null
+++ b/ACCEPTANCE.md
@@ -0,0 +1,24 @@
+# Acceptance: word wrapping
+
+Each item is checkable by reading `src/wrap.mjs` / `tests/wrap.test.mjs` or by running `npm test`.
+
+1. `src/wrap.mjs` exports a named function `wrapText(text, width)` that returns a string.
+2. `wrapText` throws a `TypeError` if `text` is not a string, or if `width` is not a positive integer.
+3. Words (runs of non-whitespace, as in `countWords`) are never split; whole words move to the next line.
+4. No output line is longer than `width` characters, unless a single word is itself longer than `width`, in which case that word appears alone on its own line unsplit.
+5. Lines are joined with `\n`; the result has no trailing newline and no trailing spaces on any line.
+6. Words on the same line are separated by exactly one space; any input whitespace runs (spaces, tabs, newlines) collapse to a single separator.
+7. Existing newlines in the input do not force line breaks; the text is re-flowed as a single paragraph.
+8. Empty or whitespace-only input returns the empty string `""`.
+9. Wrapping is greedy: each line holds as many words as fit before moving on (e.g. `wrapText("the quick brown fox", 10)` returns `"the quick\nbrown fox"`).
+10. `tests/wrap.test.mjs` exists, uses `node:test` and `node:assert/strict`, and covers items 2–9 with at least one assertion each.
+11. `README.md` shows a `wrapText` usage example alongside the existing `countWords` one.
+12. `npm test` passes with all tests (including the existing `count.test.mjs`) green.
+
+## Out of scope
+
+- Preserving blank lines or paragraph breaks from the input.
+- Hyphenating or hard-splitting words longer than `width`.
+- Indentation, prefixes, justification, or alignment options.
+- Unicode display width (wide characters, combining marks, ANSI escapes); width is measured in JS string length.
+- A command-line interface or any change to `package.json`.
diff --git a/README.md b/README.md
index 0cac2e6..e661d5e 100644
--- a/README.md
+++ b/README.md
@@ -4,6 +4,14 @@ Small helpers for laying out plain text in a terminal.
 
 ```js
 import { countWords } from "./src/count.mjs";
+import { wrapText } from "./src/wrap.mjs";
 
 countWords("one two  three"); // 3
+
+wrapText("the quick brown fox", 10); // "the quick\nbrown fox"
 ```
+
+`wrapText(text, width)` re-flows `text` as a single paragraph so that no line
+is longer than `width` characters. Words are never split; a word longer than
+`width` is placed alone on its own line. Whitespace runs (including newlines)
+collapse to a single space, and empty or whitespace-only input returns `""`.
diff --git a/src/wrap.mjs b/src/wrap.mjs
new file mode 100644
index 0000000..a4e1778
--- /dev/null
+++ b/src/wrap.mjs
@@ -0,0 +1,38 @@
+/**
+ * Wraps `text` so that no line is longer than `width` characters, without
+ * splitting words (runs of characters that are not whitespace).
+ *
+ * The input is re-flowed as a single paragraph: every run of whitespace,
+ * including newlines, collapses to a single space. Wrapping is greedy: each
+ * line holds as many words as fit. A word longer than `width` is placed alone
+ * on its own line, unsplit. Lines are joined with `\n` and there is no
+ * trailing newline. Empty or whitespace-only input returns `""`.
+ *
+ * @param {string} text
+ * @param {number} width  positive integer
+ * @returns {string}
+ */
+export function wrapText(text, width) {
+  if (typeof text !== "string") throw new TypeError("wrapText: text must be a string");
+  if (!Number.isInteger(width) || width < 1) {
+    throw new TypeError("wrapText: width must be a positive integer");
+  }
+
+  const words = text.trim().split(/\s+/);
+  if (words[0] === "") return "";
+
+  const lines = [];
+  let line = "";
+  for (const word of words) {
+    if (line === "") {
+      line = word;
+    } else if (line.length + 1 + word.length <= width) {
+      line += " " + word;
+    } else {
+      lines.push(line);
+      line = word;
+    }
+  }
+  lines.push(line);
+  return lines.join("\n");
+}
diff --git a/tests/wrap.test.mjs b/tests/wrap.test.mjs
new file mode 100644
index 0000000..f8ac43f
--- /dev/null
+++ b/tests/wrap.test.mjs
@@ -0,0 +1,71 @@
+import assert from "node:assert/strict";
+import { test } from "node:test";
+
+import { wrapText } from "../src/wrap.mjs";
+
+// Item 2: argument validation.
+test("wrapText throws a TypeError for bad arguments", () => {
+  assert.throws(() => wrapText(42, 10), TypeError);
+  assert.throws(() => wrapText(null, 10), TypeError);
+  assert.throws(() => wrapText("text", 0), TypeError);
+  assert.throws(() => wrapText("text", -1), TypeError);
+  assert.throws(() => wrapText("text", 2.5), TypeError);
+  assert.throws(() => wrapText("text", "10"), TypeError);
+  assert.throws(() => wrapText("text", NaN), TypeError);
+  assert.throws(() => wrapText("text", Infinity), TypeError);
+});
+
+// Item 1 (returns a string) and item 3: words are never split.
+test("wrapText never splits words; whole words move to the next line", () => {
+  const result = wrapText("aaa bbb ccc", 7);
+  assert.equal(typeof result, "string");
+  assert.equal(result, "aaa bbb\nccc");
+  for (const line of result.split("\n")) {
+    for (const word of line.split(" ")) {
+      assert.ok(["aaa", "bbb", "ccc"].includes(word));
+    }
+  }
+});
+
+// Item 4: no line exceeds width, except an over-long word alone on its line.
+test("wrapText keeps lines within width; over-long words stand alone unsplit", () => {
+  const wrapped = wrapText("one two three four five six seven", 9);
+  for (const line of wrapped.split("\n")) assert.ok(line.length <= 9, line);
+
+  assert.equal(wrapText("a supercalifragilistic b", 5), "a\nsupercalifragilistic\nb");
+  assert.equal(wrapText("supercalifragilistic", 5), "supercalifragilistic");
+});
+
+// Item 5: joined with "\n", no trailing newline, no trailing spaces.
+test("wrapText joins with newline and leaves no trailing newline or spaces", () => {
+  const wrapped = wrapText("one two three", 3);
+  assert.equal(wrapped, "one\ntwo\nthree");
+  assert.ok(!wrapped.endsWith("\n"));
+  for (const line of wrapped.split("\n")) assert.equal(line, line.trimEnd());
+  assert.ok(!wrapText("trailing   ", 20).endsWith(" "));
+});
+
+// Item 6: whitespace runs collapse to a single space between words.
+test("wrapText collapses whitespace runs to a single space", () => {
+  assert.equal(wrapText("one   two\t\tthree\n\n four", 80), "one two three four");
+});
+
+// Item 7: input newlines do not force breaks; text is re-flowed.
+test("wrapText re-flows input newlines as a single paragraph", () => {
+  assert.equal(wrapText("one\ntwo\nthree", 80), "one two three");
+  assert.equal(wrapText("one\ntwo\nthree four", 9), "one two\nthree\nfour");
+});
+
+// Item 8: empty or whitespace-only input.
+test("wrapText returns the empty string for empty or whitespace-only input", () => {
+  assert.equal(wrapText("", 10), "");
+  assert.equal(wrapText("   \n\t ", 10), "");
+});
+
+// Item 9: greedy wrapping.
+test("wrapText wraps greedily", () => {
+  assert.equal(wrapText("the quick brown fox", 10), "the quick\nbrown fox");
+  assert.equal(wrapText("the quick brown fox", 9), "the quick\nbrown fox");
+  assert.equal(wrapText("the quick brown fox", 15), "the quick brown\nfox");
+  assert.equal(wrapText("the quick brown fox", 100), "the quick brown fox");
+});
```

## Candidate N

```diff
diff --git a/ACCEPTANCE.md b/ACCEPTANCE.md
new file mode 100644
index 0000000..e4a6ce3
--- /dev/null
+++ b/ACCEPTANCE.md
@@ -0,0 +1,42 @@
+# Acceptance: word wrap
+
+Each line is checkable by reading the code or running `npm test`. "Width" means
+`width` characters, counted with `String.prototype.length`.
+
+## Shape (check by reading code)
+
+1. `src/wrap.mjs` exports a named function `wrap(text, width)` as an ES module,
+   with a JSDoc block in the style of `src/count.mjs`.
+2. `wrap` returns a string: the wrapped lines joined with `"\n"`.
+3. `wrap` throws `TypeError` with a message prefixed `wrap: ` when `text` is not
+   a string, or when `width` is not a positive integer (`< 1`, non-integer, `NaN`).
+4. `tests/wrap.test.mjs` exists, uses `node:test` and `node:assert/strict`, imports
+   from `../src/wrap.mjs`, and covers every behaviour in the section below.
+5. `README.md` gains a short usage example for `wrap`, matching the existing
+   `countWords` example.
+
+## Behaviour (check by `npm test`)
+
+6. Text that already fits: `wrap("one two", 10)` is `"one two"`; `wrap("", 5)` is `""`.
+7. Breaks at whitespace, never mid-word, and no output line is longer than `width`
+   when every word fits: `wrap("the quick brown fox", 10)` is `"the quick\nbrown fox"`.
+8. A line exactly `width` long is not broken: `wrap("abc def", 7)` is `"abc def"`.
+9. Runs of spaces between words collapse to one space, and leading/trailing
+   whitespace is dropped: `wrap("  one   two  ", 10)` is `"one two"`.
+10. A word longer than `width` is split at `width` characters and the remainder
+    continues on the next line: `wrap("abcdefgh", 3)` is `"abc\ndef\ngh"`.
+11. Existing newlines in the input start a new paragraph: each `"\n"`-separated
+    segment is wrapped independently and the segments are rejoined with `"\n"`,
+    so `wrap("ab cd\nef gh", 5)` is `"ab cd\nef gh"` and blank lines are preserved
+    (`wrap("a\n\nb", 5)` is `"a\n\nb"`).
+12. No output line has leading or trailing spaces.
+13. `npm test` passes with all existing and new tests green.
+
+## Out of scope
+
+- Hyphenation, justification, indentation, or right-padding lines.
+- Display width of wide/combining characters, emoji, or ANSI escape codes; a
+  character is one unit of `length`.
+- Tabs as anything other than whitespace.
+- A CLI or default export; `wrap` is a named export only.
+- Changes to `src/count.mjs` or its tests.
diff --git a/README.md b/README.md
index 0cac2e6..8d1dae1 100644
--- a/README.md
+++ b/README.md
@@ -7,3 +7,9 @@ import { countWords } from "./src/count.mjs";
 
 countWords("one two  three"); // 3
 ```
+
+```js
+import { wrap } from "./src/wrap.mjs";
+
+wrap("the quick brown fox", 10); // "the quick\nbrown fox"
+```
diff --git a/src/wrap.mjs b/src/wrap.mjs
new file mode 100644
index 0000000..fc44a23
--- /dev/null
+++ b/src/wrap.mjs
@@ -0,0 +1,49 @@
+/**
+ * Wraps `text` so that no line is longer than `width` characters.
+ *
+ * Lines break at whitespace; runs of whitespace between words collapse to a
+ * single space, and leading/trailing whitespace is dropped. A word longer than
+ * `width` is split every `width` characters. Each `"\n"`-separated segment of
+ * the input is wrapped on its own, so existing newlines (and blank lines) are
+ * preserved.
+ *
+ * @param {string} text
+ * @param {number} width positive integer; characters counted by `length`
+ * @returns {string} the wrapped lines joined with `"\n"`
+ */
+export function wrap(text, width) {
+  if (typeof text !== "string") throw new TypeError("wrap: text must be a string");
+  if (!Number.isInteger(width) || width < 1) {
+    throw new TypeError("wrap: width must be a positive integer");
+  }
+  return text.split("\n").map((paragraph) => wrapParagraph(paragraph, width)).join("\n");
+}
+
+/**
+ * Wraps a single paragraph (no newlines) to `width`.
+ *
+ * @param {string} paragraph
+ * @param {number} width
+ * @returns {string}
+ */
+function wrapParagraph(paragraph, width) {
+  const words = paragraph.split(/\s+/).filter((word) => word !== "");
+  const lines = [];
+  let line = "";
+
+  for (let word of words) {
+    if (line !== "" && line.length + 1 + word.length <= width) {
+      line += " " + word;
+      continue;
+    }
+    if (line !== "") lines.push(line);
+    while (word.length > width) {
+      lines.push(word.slice(0, width));
+      word = word.slice(width);
+    }
+    line = word;
+  }
+  if (line !== "") lines.push(line);
+
+  return lines.join("\n");
+}
diff --git a/tests/wrap.test.mjs b/tests/wrap.test.mjs
new file mode 100644
index 0000000..5b0f02c
--- /dev/null
+++ b/tests/wrap.test.mjs
@@ -0,0 +1,75 @@
+import assert from "node:assert/strict";
+import { test } from "node:test";
+
+import { wrap } from "../src/wrap.mjs";
+
+test("wrap returns a string joined with newlines", () => {
+  const out = wrap("the quick brown fox", 10);
+  assert.equal(typeof out, "string");
+  assert.deepEqual(out.split("\n"), ["the quick", "brown fox"]);
+});
+
+test("wrap throws TypeError when text is not a string", () => {
+  for (const bad of [undefined, null, 42, ["a"], {}]) {
+    assert.throws(() => wrap(bad, 5), { name: "TypeError", message: /^wrap: / });
+  }
+});
+
+test("wrap throws TypeError when width is not a positive integer", () => {
+  for (const bad of [0, -1, 1.5, NaN, Infinity, "5", undefined, null]) {
+    assert.throws(() => wrap("abc", bad), { name: "TypeError", message: /^wrap: / });
+  }
+});
+
+test("wrap leaves text that already fits alone", () => {
+  assert.equal(wrap("one two", 10), "one two");
+  assert.equal(wrap("", 5), "");
+});
+
+test("wrap breaks at whitespace, never mid-word, within width", () => {
+  assert.equal(wrap("the quick brown fox", 10), "the quick\nbrown fox");
+  const out = wrap("the quick brown fox jumps over the lazy dog", 12);
+  for (const line of out.split("\n")) {
+    assert.ok(line.length <= 12, `line too long: ${JSON.stringify(line)}`);
+  }
+  assert.equal(out.split("\n").join(" "), "the quick brown fox jumps over the lazy dog");
+});
+
+test("wrap does not break a line exactly width long", () => {
+  assert.equal(wrap("abc def", 7), "abc def");
+  assert.equal(wrap("abc def ghi", 7), "abc def\nghi");
+});
+
+test("wrap collapses runs of whitespace and drops leading/trailing whitespace", () => {
+  assert.equal(wrap("  one   two  ", 10), "one two");
+  assert.equal(wrap("one\t\ttwo", 10), "one two");
+});
+
+test("wrap splits a word longer than width at width characters", () => {
+  assert.equal(wrap("abcdefgh", 3), "abc\ndef\ngh");
+  assert.equal(wrap("abcdef", 3), "abc\ndef");
+  assert.equal(wrap("a abcdefgh b", 3), "a\nabc\ndef\ngh\nb");
+});
+
+test("wrap treats existing newlines as paragraph breaks", () => {
+  assert.equal(wrap("ab cd\nef gh", 5), "ab cd\nef gh");
+  assert.equal(wrap("a\n\nb", 5), "a\n\nb");
+  assert.equal(wrap("one two three\nfour five", 9), "one two\nthree\nfour five");
+});
+
+test("wrap never emits lines with leading or trailing spaces", () => {
+  const inputs = [
+    "  the   quick brown  fox  ",
+    "abcdefgh  ij",
+    " a \n  b  \n\n c ",
+    "one two three four five six",
+  ];
+  for (const input of inputs) {
+    for (const w of [1, 3, 5, 8, 20]) {
+      for (const line of wrap(input, w).split("\n")) {
+        assert.equal(line, line.trim(), `bad line ${JSON.stringify(line)} for width ${w}`);
+        assert.ok(line.length <= w, `line too long ${JSON.stringify(line)} for width ${w}`);
+      }
+    }
+  }
+});
```

## Candidate T

```diff
diff --git a/ACCEPTANCE.md b/ACCEPTANCE.md
new file mode 100644
index 0000000..3b0b97d
--- /dev/null
+++ b/ACCEPTANCE.md
@@ -0,0 +1,32 @@
+# Acceptance: word wrapping
+
+Each item is checkable by reading the named file or by running `npm test`.
+
+## Interface
+
+1. `src/wrap.mjs` exists and exports a named function `wrap(text, width)` that returns a string, following the style of `src/count.mjs` (ESM, JSDoc comment).
+2. `wrap` throws a `TypeError` if `text` is not a string, or if `width` is not a positive integer.
+
+## Behaviour (each covered by a test in `tests/wrap.test.mjs`)
+
+3. Text that already fits: `wrap("hello world", 20)` returns `"hello world"` unchanged.
+4. Breaks at spaces so no output line exceeds `width`: `wrap("the quick brown fox", 10)` returns `"the quick\nbrown fox"`.
+5. Never splits a word that fits on a line; a line break is placed before the word, not inside it.
+6. A single word longer than `width` is placed on its own line, unbroken (it may exceed `width`); wrapping resumes normally after it.
+7. Runs of spaces and tabs between words collapse to a single space in the output; leading and trailing whitespace is dropped.
+8. Existing newlines in the input start a new paragraph: each paragraph is wrapped independently, and paragraphs are separated by a single `\n` in the output. A blank line between paragraphs is preserved as one blank line.
+9. Empty or whitespace-only input returns `""`.
+10. Output lines have no trailing spaces.
+
+## Project fit
+
+11. `tests/wrap.test.mjs` uses `node:test` and `node:assert/strict`, matching `tests/count.test.mjs`, and is picked up by the existing `npm test` script without changes to `package.json`.
+12. `README.md` gains a short `wrap` usage example alongside the existing `countWords` one.
+13. `npm test` passes with all existing and new tests green.
+
+## Out of scope
+
+- Hyphenation or breaking long words across lines.
+- Wide/CJK characters, combining marks, ANSI escape codes, or tab expansion; width is measured in JavaScript string length.
+- Indentation, prefixes, justification, or a CLI.
+- Changing `countWords`.
diff --git a/README.md b/README.md
index 0cac2e6..8d1dae1 100644
--- a/README.md
+++ b/README.md
@@ -7,3 +7,9 @@ import { countWords } from "./src/count.mjs";
 
 countWords("one two  three"); // 3
 ```
+
+```js
+import { wrap } from "./src/wrap.mjs";
+
+wrap("the quick brown fox", 10); // "the quick\nbrown fox"
+```
diff --git a/src/wrap.mjs b/src/wrap.mjs
new file mode 100644
index 0000000..7825dae
--- /dev/null
+++ b/src/wrap.mjs
@@ -0,0 +1,62 @@
+/**
+ * Wraps `text` so that no line exceeds `width` characters, breaking only at
+ * whitespace between words.
+ *
+ * Runs of spaces and tabs collapse to a single space, and leading and trailing
+ * whitespace is dropped. Newlines in the input separate paragraphs, which are
+ * wrapped independently; a blank line between paragraphs is kept as one blank
+ * line. A single word longer than `width` is placed on its own line, unbroken.
+ * Width is measured in JavaScript string length.
+ *
+ * @param {string} text
+ * @param {number} width  maximum characters per line; a positive integer
+ * @returns {string}
+ */
+export function wrap(text, width) {
+  if (typeof text !== "string") throw new TypeError("wrap: text must be a string");
+  if (!Number.isInteger(width) || width < 1) {
+    throw new TypeError("wrap: width must be a positive integer");
+  }
+
+  const out = [];
+  let blankPending = false;
+  for (const paragraph of text.split(/\r?\n/)) {
+    const trimmed = paragraph.trim();
+    if (trimmed === "") {
+      // Leading blank lines are dropped; interior ones collapse to a single
+      // blank line; trailing ones are never flushed.
+      if (out.length > 0) blankPending = true;
+      continue;
+    }
+    if (blankPending) {
+      out.push("");
+      blankPending = false;
+    }
+    out.push(wrapParagraph(trimmed, width));
+  }
+  return out.join("\n");
+}
+
+/**
+ * Greedily fills lines with words from a single, already-trimmed paragraph.
+ *
+ * @param {string} paragraph
+ * @param {number} width
+ * @returns {string}
+ */
+function wrapParagraph(paragraph, width) {
+  const lines = [];
+  let line = "";
+  for (const word of paragraph.split(/\s+/)) {
+    if (line === "") {
+      line = word;
+    } else if (line.length + 1 + word.length <= width) {
+      line += " " + word;
+    } else {
+      lines.push(line);
+      line = word;
+    }
+  }
+  lines.push(line);
+  return lines.join("\n");
+}
diff --git a/tests/wrap.test.mjs b/tests/wrap.test.mjs
new file mode 100644
index 0000000..2e56961
--- /dev/null
+++ b/tests/wrap.test.mjs
@@ -0,0 +1,110 @@
+import assert from "node:assert/strict";
+import { test } from "node:test";
+
+import { wrap } from "../src/wrap.mjs";
+
+test("wrap throws a TypeError for a non-string text", () => {
+  assert.throws(() => wrap(42, 10), TypeError);
+  assert.throws(() => wrap(null, 10), TypeError);
+  assert.throws(() => wrap(undefined, 10), TypeError);
+});
+
+test("wrap throws a TypeError for a width that is not a positive integer", () => {
+  assert.throws(() => wrap("hello", 0), TypeError);
+  assert.throws(() => wrap("hello", -1), TypeError);
+  assert.throws(() => wrap("hello", 2.5), TypeError);
+  assert.throws(() => wrap("hello", "10"), TypeError);
+  assert.throws(() => wrap("hello", NaN), TypeError);
+  assert.throws(() => wrap("hello", Infinity), TypeError);
+  assert.throws(() => wrap("hello"), TypeError);
+});
+
+test("wrap returns text that already fits unchanged", () => {
+  assert.equal(wrap("hello world", 20), "hello world");
+  assert.equal(wrap("hello world", 11), "hello world");
+});
+
+test("wrap breaks at spaces so no line exceeds the width", () => {
+  assert.equal(wrap("the quick brown fox", 10), "the quick\nbrown fox");
+
+  const text = "the quick brown fox jumps over the lazy dog";
+  for (const width of [5, 9, 12, 20]) {
+    for (const line of wrap(text, width).split("\n")) {
+      assert.ok(line.length <= width, `"${line}" exceeds width ${width}`);
+    }
+  }
+});
+
+test("wrap never splits a word that fits; the break goes before the word", () => {
+  // "hello " is 6 chars; "world" (5) does not fit in the remaining 4.
+  assert.equal(wrap("hello world", 10), "hello\nworld");
+  // A word that exactly fills the line stays whole.
+  assert.equal(wrap("abcde fghij", 5), "abcde\nfghij");
+  // The word "fox" would fit if split, but must instead move whole.
+  assert.equal(wrap("the quick brown fox", 12), "the quick\nbrown fox");
+});
+
+test("wrap places a word longer than the width on its own line, unbroken", () => {
+  assert.equal(wrap("supercalifragilistic", 5), "supercalifragilistic");
+  assert.equal(
+    wrap("a supercalifragilistic b c d", 5),
+    "a\nsupercalifragilistic\nb c d",
+  );
+  // Wrapping resumes normally after the long word.
+  assert.equal(
+    wrap("one two abcdefghijkl three four five", 9),
+    "one two\nabcdefghijkl\nthree\nfour five",
+  );
+});
+
+test("wrap collapses runs of spaces and tabs and drops leading/trailing whitespace", () => {
+  assert.equal(wrap("  hello   world  ", 20), "hello world");
+  assert.equal(wrap("\thello\t\tworld\t", 20), "hello world");
+  assert.equal(wrap("hello \t \t world", 20), "hello world");
+  assert.equal(wrap("  the   quick\tbrown   fox  ", 10), "the quick\nbrown fox");
+});
+
+test("wrap treats newlines as paragraph breaks and wraps each independently", () => {
+  assert.equal(wrap("one two\nthree four", 20), "one two\nthree four");
+  assert.equal(
+    wrap("the quick brown fox\njumps over the lazy dog", 10),
+    "the quick\nbrown fox\njumps over\nthe lazy\ndog",
+  );
+  // Words are never pulled across a paragraph boundary even if they'd fit.
+  assert.equal(wrap("a\nb", 10), "a\nb");
+});
+
+test("wrap preserves a blank line between paragraphs as one blank line", () => {
+  assert.equal(wrap("one two\n\nthree four", 20), "one two\n\nthree four");
+  assert.equal(wrap("a b c\n\nd e f", 3), "a b\nc\n\nd e\nf");
+  // A run of blank lines collapses to a single blank line.
+  assert.equal(wrap("one\n\n\n\ntwo", 20), "one\n\ntwo");
+  // Blank lines that only contain spaces or tabs still count as blank.
+  assert.equal(wrap("one\n \t \ntwo", 20), "one\n\ntwo");
+  // Leading and trailing blank lines are dropped.
+  assert.equal(wrap("\n\none\n\n", 20), "one");
+});
+
+test("wrap returns an empty string for empty or whitespace-only input", () => {
+  assert.equal(wrap("", 10), "");
+  assert.equal(wrap("   ", 10), "");
+  assert.equal(wrap("\t\t", 10), "");
+  assert.equal(wrap("\n\n", 10), "");
+  assert.equal(wrap(" \n\t\n ", 10), "");
+});
+
+test("wrap output lines have no trailing spaces", () => {
+  const inputs = [
+    "the quick brown fox jumps over the lazy dog ",
+    "  hello   world  \n\n  foo \t bar  ",
+    "a supercalifragilistic b",
+  ];
+  for (const input of inputs) {
+    for (const width of [1, 5, 10, 40]) {
+      for (const line of wrap(input, width).split("\n")) {
+        assert.equal(line, line.trimEnd(), `trailing space in "${line}"`);
+        assert.equal(line, line.trimStart(), `leading space in "${line}"`);
+      }
+    }
+  }
+});
```

## Candidate D

```diff
diff --git a/ACCEPTANCE.md b/ACCEPTANCE.md
new file mode 100644
index 0000000..74d7876
--- /dev/null
+++ b/ACCEPTANCE.md
@@ -0,0 +1,38 @@
+# Acceptance: word wrapping
+
+Add `wrap(text, width)` to the `textwrap` package. Each item below is checkable by reading the named file or by running `npm test`.
+
+## Shape
+
+1. `src/wrap.mjs` exists and does `export function wrap(text, width)`, with a JSDoc block (`@param`, `@returns`) in the style of `src/count.mjs`.
+2. `wrap` returns a single string; lines are joined with `"\n"`, with no trailing newline.
+3. `src/count.mjs` and `tests/count.test.mjs` are unchanged.
+
+## Behaviour
+
+4. Words are maximal runs of non-whitespace characters. Any whitespace in `text` (spaces, tabs, newlines) is only a separator; the output never contains it. Words on a line are separated by exactly one space, and no line has leading or trailing whitespace.
+5. Packing is greedy: each line holds as many words in order as fit, and a word moves to the next line only when adding it (plus its separating space) would make the line longer than `width`.
+6. Width is measured as `String.prototype.length` (UTF-16 code units). No output line is longer than `width`, except as in item 7.
+7. A single word longer than `width` is placed unbroken on a line of its own.
+8. Empty or whitespace-only `text` returns `""`.
+9. A `text` that is not a string throws `TypeError` with message `"wrap: text must be a string"`.
+10. A `width` that is not an integer `>= 1` throws `RangeError` with a message starting `"wrap: "`.
+
+## Tests and docs
+
+11. `tests/wrap.test.mjs` exists, uses `node:test` and `node:assert/strict` like `tests/count.test.mjs`, and covers items 4 to 10 with at least one assertion each. Concrete cases it must include:
+    - `wrap("the quick brown fox", 10)` returns `"the quick\nbrown fox"`
+    - `wrap("a  b\tc\nd", 3)` returns `"a b\nc d"`
+    - `wrap("abcdefgh xy", 5)` returns `"abcdefgh\nxy"`
+    - `wrap("aaa bbb", 3)` returns `"aaa\nbbb"` (a word exactly `width` long fits)
+    - `wrap("   ", 10)` returns `""`
+12. `npm test` passes with zero failures.
+13. `README.md` shows a `wrap` example alongside the existing `countWords` one.
+
+## Out of scope
+
+- Breaking or hyphenating words longer than `width`.
+- Preserving paragraph breaks, blank lines, or indentation from the input.
+- Tab expansion, ANSI escape sequences, and display width of wide or combining characters.
+- Options such as indent, prefix, or justification.
+- A CLI or any change to `package.json` beyond what is needed for tests to run (none expected).
diff --git a/README.md b/README.md
index 0cac2e6..74fd471 100644
--- a/README.md
+++ b/README.md
@@ -4,6 +4,9 @@ Small helpers for laying out plain text in a terminal.
 
 ```js
 import { countWords } from "./src/count.mjs";
+import { wrap } from "./src/wrap.mjs";
 
 countWords("one two  three"); // 3
+
+wrap("the quick brown fox", 10); // "the quick\nbrown fox"
 ```
diff --git a/src/wrap.mjs b/src/wrap.mjs
new file mode 100644
index 0000000..9bf08b0
--- /dev/null
+++ b/src/wrap.mjs
@@ -0,0 +1,34 @@
+/**
+ * Wraps `text` to lines no longer than `width`, packing words greedily.
+ *
+ * Words are runs of characters that are not whitespace; any whitespace in
+ * `text` only separates words. Lines are joined with "\n" and hold as many
+ * words as fit. A single word longer than `width` is placed unbroken on a
+ * line of its own. Width is measured in UTF-16 code units.
+ *
+ * @param {string} text
+ * @param {number} width - integer, at least 1
+ * @returns {string}
+ */
+export function wrap(text, width) {
+  if (typeof text !== "string") throw new TypeError("wrap: text must be a string");
+  if (!Number.isInteger(width) || width < 1) {
+    throw new RangeError("wrap: width must be an integer >= 1");
+  }
+  const words = text.trim().split(/\s+/);
+  if (words[0] === "") return "";
+  const lines = [];
+  let line = "";
+  for (const word of words) {
+    if (line === "") {
+      line = word;
+    } else if (line.length + 1 + word.length <= width) {
+      line += " " + word;
+    } else {
+      lines.push(line);
+      line = word;
+    }
+  }
+  lines.push(line);
+  return lines.join("\n");
+}
diff --git a/tests/wrap.test.mjs b/tests/wrap.test.mjs
new file mode 100644
index 0000000..5992a85
--- /dev/null
+++ b/tests/wrap.test.mjs
@@ -0,0 +1,66 @@
+import assert from "node:assert/strict";
+import { test } from "node:test";
+
+import { wrap } from "../src/wrap.mjs";
+
+test("wrap collapses whitespace and separates words with one space", () => {
+  assert.equal(wrap("a  b\tc\nd", 3), "a b\nc d");
+  assert.equal(wrap("  one   two  ", 20), "one two");
+  for (const line of wrap("a  b\tc\nd\r\n e", 3).split("\n")) {
+    assert.equal(line, line.trim());
+    assert.equal(/\s\s/.test(line), false);
+  }
+});
+
+test("wrap packs words greedily", () => {
+  assert.equal(wrap("the quick brown fox", 10), "the quick\nbrown fox");
+  assert.equal(wrap("the quick brown fox", 9), "the quick\nbrown fox");
+  assert.equal(wrap("the quick brown fox", 8), "the\nquick\nbrown\nfox");
+  assert.equal(wrap("aaa bbb", 3), "aaa\nbbb");
+  assert.equal(wrap("aaa bbb", 7), "aaa bbb");
+  assert.equal(wrap("aaa bbb", 6), "aaa\nbbb");
+});
+
+test("wrap measures width in UTF-16 code units and never exceeds it", () => {
+  const out = wrap("one two three four five six seven", 9);
+  for (const line of out.split("\n")) assert.ok(line.length <= 9, line);
+  // "😀" is two code units, so "😀😀" (length 4) does not fit beside "ab" in 6.
+  assert.equal(wrap("ab 😀😀 c", 6), "ab\n😀😀 c");
+  assert.equal(wrap("ab 😀😀 c", 7), "ab 😀😀\nc");
+});
+
+test("wrap puts a word longer than width unbroken on its own line", () => {
+  assert.equal(wrap("abcdefgh xy", 5), "abcdefgh\nxy");
+  assert.equal(wrap("xy abcdefgh zz", 5), "xy\nabcdefgh\nzz");
+});
+
+test("wrap returns an empty string for empty or whitespace-only text", () => {
+  assert.equal(wrap("", 10), "");
+  assert.equal(wrap("   ", 10), "");
+  assert.equal(wrap(" \t\n ", 1), "");
+});
+
+test("wrap returns a single string with no trailing newline", () => {
+  const out = wrap("a b c", 1);
+  assert.equal(typeof out, "string");
+  assert.equal(out, "a\nb\nc");
+  assert.equal(out.endsWith("\n"), false);
+});
+
+test("wrap throws TypeError when text is not a string", () => {
+  for (const bad of [undefined, null, 42, ["a"], {}]) {
+    assert.throws(() => wrap(bad, 10), {
+      name: "TypeError",
+      message: "wrap: text must be a string",
+    });
+  }
+});
+
+test("wrap throws RangeError when width is not an integer >= 1", () => {
+  for (const bad of [0, -1, 1.5, NaN, Infinity, "10", undefined, null]) {
+    assert.throws(() => wrap("a b", bad), {
+      name: "RangeError",
+      message: /^wrap: /,
+    });
+  }
+});
```

## Candidate Y

```diff
diff --git a/ACCEPTANCE.md b/ACCEPTANCE.md
new file mode 100644
index 0000000..3027895
--- /dev/null
+++ b/ACCEPTANCE.md
@@ -0,0 +1,21 @@
+# Acceptance: word wrapping
+
+1. `src/wrap.mjs` exports a named function `wrapText(text, width)` that returns a string, with a JSDoc comment in the style of `src/count.mjs`.
+2. `wrapText` throws a `TypeError` if `text` is not a string, or if `width` is not a positive integer.
+3. Words are runs of non-whitespace characters; any whitespace between them (including newlines) is treated as a single separator, and leading/trailing whitespace is dropped.
+4. Words are packed greedily left to right: a word goes on the current line if the line (with a single joining space) would still be at most `width` characters, otherwise it starts a new line.
+5. Every output line is at most `width` characters long, except that a single word longer than `width` is placed unbroken on a line of its own.
+6. No output line starts or ends with a space, and words on a line are separated by exactly one space.
+7. Output lines are joined with `"\n"`, with no trailing newline.
+8. Empty or whitespace-only `text` returns `""`.
+9. `tests/wrap.test.mjs` exists, uses `node:test` and `node:assert/strict` like `tests/count.test.mjs`, and has at least one assertion for each of items 2 through 8.
+10. README.md documents `wrapText` with a short usage example alongside `countWords`.
+11. `npm test` passes with the new tests included; `countWords` and its test are unchanged.
+
+## Out of scope
+
+- Hyphenating or splitting words longer than `width`.
+- Preserving paragraph breaks, blank lines, or indentation from the input.
+- Justification, right-alignment, or centering.
+- Display-width handling for ANSI escape codes, tabs, or wide/combining Unicode characters (width is counted in JavaScript string length).
+- A CLI or any change to `package.json` beyond what is needed for tests to run (none expected).
diff --git a/README.md b/README.md
index 0cac2e6..09e3173 100644
--- a/README.md
+++ b/README.md
@@ -4,6 +4,17 @@ Small helpers for laying out plain text in a terminal.
 
 ```js
 import { countWords } from "./src/count.mjs";
+import { wrapText } from "./src/wrap.mjs";
 
 countWords("one two  three"); // 3
+
+wrapText("the quick brown fox jumps", 10);
+// "the quick\nbrown fox\njumps"
 ```
+
+`wrapText(text, width)` packs words greedily so that every line is at most
+`width` characters. Runs of whitespace (including newlines) collapse to a
+single space, and a word longer than `width` is placed unbroken on its own
+line. Lines are joined with `"\n"` with no trailing newline; empty or
+whitespace-only input returns `""`. It throws a `TypeError` if `text` is not
+a string or `width` is not a positive integer.
diff --git a/src/wrap.mjs b/src/wrap.mjs
new file mode 100644
index 0000000..06d29a1
--- /dev/null
+++ b/src/wrap.mjs
@@ -0,0 +1,36 @@
+/**
+ * Wraps `text` so that no line is longer than `width` characters, packing
+ * words greedily left to right. Words are runs of non-whitespace characters;
+ * any whitespace between them (including newlines) collapses to a single
+ * space, and leading/trailing whitespace is dropped. A single word longer
+ * than `width` is placed unbroken on a line of its own. Lines are joined
+ * with `"\n"` and there is no trailing newline.
+ *
+ * @param {string} text
+ * @param {number} width positive integer
+ * @returns {string}
+ */
+export function wrapText(text, width) {
+  if (typeof text !== "string") throw new TypeError("wrapText: text must be a string");
+  if (!Number.isInteger(width) || width < 1) {
+    throw new TypeError("wrapText: width must be a positive integer");
+  }
+
+  const words = text.trim().split(/\s+/);
+  if (words[0] === "") return "";
+
+  const lines = [];
+  let line = "";
+  for (const word of words) {
+    if (line === "") {
+      line = word;
+    } else if (line.length + 1 + word.length <= width) {
+      line += " " + word;
+    } else {
+      lines.push(line);
+      line = word;
+    }
+  }
+  lines.push(line);
+  return lines.join("\n");
+}
diff --git a/tests/wrap.test.mjs b/tests/wrap.test.mjs
new file mode 100644
index 0000000..ccc908d
--- /dev/null
+++ b/tests/wrap.test.mjs
@@ -0,0 +1,77 @@
+import assert from "node:assert/strict";
+import { test } from "node:test";
+
+import { wrapText } from "../src/wrap.mjs";
+
+// Item 2: argument validation
+test("wrapText throws TypeError for non-string text", () => {
+  assert.throws(() => wrapText(42, 10), TypeError);
+  assert.throws(() => wrapText(null, 10), TypeError);
+  assert.throws(() => wrapText(undefined, 10), TypeError);
+});
+
+test("wrapText throws TypeError for a width that is not a positive integer", () => {
+  assert.throws(() => wrapText("a b", 0), TypeError);
+  assert.throws(() => wrapText("a b", -1), TypeError);
+  assert.throws(() => wrapText("a b", 2.5), TypeError);
+  assert.throws(() => wrapText("a b", NaN), TypeError);
+  assert.throws(() => wrapText("a b", Infinity), TypeError);
+  assert.throws(() => wrapText("a b", "10"), TypeError);
+  assert.throws(() => wrapText("a b"), TypeError);
+});
+
+// Item 3: whitespace runs (including newlines) are a single separator; ends trimmed
+test("wrapText collapses whitespace runs and drops leading/trailing whitespace", () => {
+  assert.equal(wrapText("  one \t two\n\nthree  ", 20), "one two three");
+  assert.equal(wrapText("one\ntwo\r\nthree", 80), "one two three");
+});
+
+// Item 4: greedy packing left to right
+test("wrapText packs words greedily", () => {
+  assert.equal(wrapText("the quick brown fox jumps", 10), "the quick\nbrown fox\njumps");
+  // a word fits when the line with a joining space is exactly `width`
+  assert.equal(wrapText("ab cd", 5), "ab cd");
+  // one over width pushes the word to the next line
+  assert.equal(wrapText("ab cd", 4), "ab\ncd");
+});
+
+// Item 5: every line is at most `width`, except a lone over-long word
+test("wrapText keeps every line within width", () => {
+  const out = wrapText("lorem ipsum dolor sit amet consectetur adipiscing elit", 12);
+  for (const line of out.split("\n")) assert.ok(line.length <= 12, `"${line}" exceeds width`);
+});
+
+test("wrapText places a word longer than width unbroken on its own line", () => {
+  assert.equal(wrapText("a verylongword b", 5), "a\nverylongword\nb");
+  assert.equal(wrapText("verylongword", 3), "verylongword");
+  assert.equal(wrapText("aa verylongword", 3), "aa\nverylongword");
+});
+
+// Item 6: no leading/trailing spaces on a line; single spaces between words
+test("wrapText lines have no edge spaces and single spaces between words", () => {
+  const out = wrapText("  one   two    three   four  ", 9);
+  assert.equal(out, "one two\nthree\nfour");
+  for (const line of out.split("\n")) {
+    assert.ok(!line.startsWith(" "), `"${line}" starts with a space`);
+    assert.ok(!line.endsWith(" "), `"${line}" ends with a space`);
+    assert.ok(!line.includes("  "), `"${line}" contains a double space`);
+  }
+});
+
+// Item 7: lines joined with "\n", no trailing newline
+test("wrapText joins lines with \\n and has no trailing newline", () => {
+  const out = wrapText("one two three", 3);
+  assert.equal(out, "one\ntwo\nthree");
+  assert.ok(!out.endsWith("\n"));
+  assert.ok(!out.includes("\r"));
+});
+
+// Item 8: empty or whitespace-only input
+test("wrapText returns an empty string for empty or whitespace-only text", () => {
+  assert.equal(wrapText("", 10), "");
+  assert.equal(wrapText("   \n\t  ", 10), "");
+});
+
+test("wrapText returns a string", () => {
+  assert.equal(typeof wrapText("x", 1), "string");
+});
```

## Candidate K

```diff
diff --git a/ACCEPTANCE.md b/ACCEPTANCE.md
new file mode 100644
index 0000000..985727a
--- /dev/null
+++ b/ACCEPTANCE.md
@@ -0,0 +1,33 @@
+# Acceptance: word wrapping
+
+Add `wrap(text, width)` that reflows plain text so no line is longer than `width`, breaking only at whitespace where possible. Follows the conventions of `src/count.mjs`.
+
+## Layout and conventions (check by reading code)
+
+1. `src/wrap.mjs` exports a named function `wrap(text, width)` with a JSDoc comment, matching `src/count.mjs`.
+2. `tests/wrap.test.mjs` exists and uses `node:test` and `node:assert/strict`, matching `tests/count.test.mjs`.
+3. `README.md` gains a short `wrap` example alongside the `countWords` one.
+4. No new dependencies are added to `package.json`.
+
+## Behaviour (each has at least one assertion in `tests/wrap.test.mjs`)
+
+5. Returns a string; lines are joined with `"\n"`.
+6. Text that already fits (`text.length <= width`, no newlines) is returned unchanged.
+7. Breaks at whitespace: `wrap("the quick brown fox", 10)` gives `"the quick\nbrown fox"`.
+8. No output line exceeds `width` unless it is a single word longer than `width`.
+9. A single word longer than `width` is placed on its own line, unbroken (words are never split).
+10. Runs of spaces between words collapse to a single space; leading and trailing whitespace is dropped from each output line.
+11. Existing newlines in the input are honoured as paragraph breaks: each newline-separated segment is wrapped independently and the segments are rejoined with `"\n"`. An empty segment (blank line) is preserved as an empty line.
+12. `wrap("", 10)` returns `""`; whitespace-only input returns `""`.
+13. Throws `TypeError` when `text` is not a string, or when `width` is not a positive integer.
+
+## Done
+
+14. `npm test` passes with the new test file included and the existing `count` test still passing.
+
+## Out of scope
+
+- Hyphenating or splitting long words.
+- Tabs, ANSI escape codes, or East Asian / full-width character widths (all characters count as width 1).
+- Indentation, justification, or a default `width` (it is required).
+- A CLI.
diff --git a/README.md b/README.md
index 0cac2e6..8d1dae1 100644
--- a/README.md
+++ b/README.md
@@ -7,3 +7,9 @@ import { countWords } from "./src/count.mjs";
 
 countWords("one two  three"); // 3
 ```
+
+```js
+import { wrap } from "./src/wrap.mjs";
+
+wrap("the quick brown fox", 10); // "the quick\nbrown fox"
+```
diff --git a/src/wrap.mjs b/src/wrap.mjs
new file mode 100644
index 0000000..c9c2dce
--- /dev/null
+++ b/src/wrap.mjs
@@ -0,0 +1,51 @@
+/**
+ * Wraps `text` so that no line is longer than `width`, breaking only at
+ * whitespace. Words are never split: a single word longer than `width` is
+ * placed on its own line, unbroken.
+ *
+ * Runs of whitespace between words collapse to a single space and no output
+ * line has leading or trailing whitespace. Existing newlines are paragraph
+ * breaks: each newline-separated segment is wrapped independently and the
+ * segments are rejoined with "\n", so blank lines are preserved. Input that
+ * is empty or whitespace-only returns "".
+ *
+ * @param {string} text
+ * @param {number} width positive integer; every character counts as width 1
+ * @returns {string}
+ */
+export function wrap(text, width) {
+  if (typeof text !== "string") throw new TypeError("wrap: text must be a string");
+  if (!Number.isInteger(width) || width < 1) {
+    throw new TypeError("wrap: width must be a positive integer");
+  }
+  if (text.trim() === "") return "";
+  return text
+    .split("\n")
+    .map((segment) => wrapSegment(segment, width))
+    .join("\n");
+}
+
+/**
+ * Wraps one newline-free segment of text.
+ *
+ * @param {string} segment
+ * @param {number} width
+ * @returns {string}
+ */
+function wrapSegment(segment, width) {
+  const words = segment.split(/\s+/).filter((word) => word !== "");
+  const lines = [];
+  let line = "";
+  for (const word of words) {
+    if (line === "") {
+      line = word;
+    } else if (line.length + 1 + word.length <= width) {
+      line += " " + word;
+    } else {
+      lines.push(line);
+      line = word;
+    }
+  }
+  if (line !== "") lines.push(line);
+  return lines.join("\n");
+}
diff --git a/tests/wrap.test.mjs b/tests/wrap.test.mjs
new file mode 100644
index 0000000..6274143
--- /dev/null
+++ b/tests/wrap.test.mjs
@@ -0,0 +1,86 @@
+import assert from "node:assert/strict";
+import { test } from "node:test";
+
+import { wrap } from "../src/wrap.mjs";
+
+// 5. Returns a string; lines are joined with "\n".
+test("wrap returns a string with lines joined by \\n", () => {
+  const out = wrap("aaa bbb ccc", 7);
+  assert.equal(typeof out, "string");
+  assert.equal(out, "aaa bbb\nccc");
+  assert.deepEqual(out.split("\n"), ["aaa bbb", "ccc"]);
+});
+
+// 6. Text that already fits (text.length <= width, no newlines) is returned
+//    unchanged. Read together with item 10: this holds for text that is
+//    already normalised (single spaces, no leading/trailing whitespace).
+test("wrap returns text that already fits unchanged", () => {
+  assert.equal(wrap("the quick brown fox", 19), "the quick brown fox");
+  assert.equal(wrap("the quick brown fox", 80), "the quick brown fox");
+  assert.equal(wrap("hello", 5), "hello");
+  assert.equal(wrap("a", 1), "a");
+});
+
+// 7. Breaks at whitespace.
+test("wrap breaks at whitespace", () => {
+  assert.equal(wrap("the quick brown fox", 10), "the quick\nbrown fox");
+  assert.equal(wrap("the quick brown fox", 9), "the quick\nbrown fox");
+  assert.equal(wrap("the quick brown fox", 5), "the\nquick\nbrown\nfox");
+});
+
+// 8. No output line exceeds width unless it is a single word longer than width.
+test("wrap never produces a line longer than width except for a lone long word", () => {
+  const text = "lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor";
+  for (const width of [1, 3, 7, 12, 20, 33, 80]) {
+    for (const line of wrap(text, width).split("\n")) {
+      if (line.length > width) {
+        assert.ok(!line.includes(" "), `line "${line}" exceeds ${width} but is not a single word`);
+      }
+    }
+  }
+  for (const line of wrap("aaa bb c dddd ee f", 6).split("\n")) {
+    assert.ok(line.length <= 6, `"${line}" exceeds width`);
+  }
+});
+
+// 9. A single word longer than width is placed on its own line, unbroken.
+test("wrap puts an over-long word on its own line without splitting it", () => {
+  assert.equal(wrap("supercalifragilistic", 5), "supercalifragilistic");
+  assert.equal(wrap("a supercalifragilistic b", 5), "a\nsupercalifragilistic\nb");
+  assert.equal(wrap("ab supercalifragilistic", 3), "ab\nsupercalifragilistic");
+  assert.equal(wrap("supercalifragilistic ab", 3), "supercalifragilistic\nab");
+});
+
+// 10. Runs of spaces collapse to one; leading/trailing whitespace dropped per line.
+test("wrap collapses runs of spaces and trims each output line", () => {
+  assert.equal(wrap("the   quick  brown fox", 10), "the quick\nbrown fox");
+  assert.equal(wrap("  the quick brown fox  ", 10), "the quick\nbrown fox");
+  assert.equal(wrap("  a  b  ", 80), "a b");
+  assert.equal(wrap("  a  \n  b  ", 80), "a\nb");
+});
+
+// 11. Existing newlines are paragraph breaks; blank lines are preserved.
+test("wrap honours existing newlines as paragraph breaks", () => {
+  assert.equal(wrap("the quick brown fox\njumps over", 10), "the quick\nbrown fox\njumps over");
+  assert.equal(wrap("ab cd\n\nef gh", 80), "ab cd\n\nef gh");
+  assert.equal(wrap("ab\n\n\ncd", 80), "ab\n\n\ncd");
+  assert.equal(wrap("one two three\nfour five six", 8), "one two\nthree\nfour\nfive six");
+});
+
+// 12. Empty and whitespace-only input return "".
+test("wrap returns empty string for empty or whitespace-only input", () => {
+  assert.equal(wrap("", 10), "");
+  assert.equal(wrap("   ", 10), "");
+  assert.equal(wrap(" \t ", 10), "");
+  assert.equal(wrap("\n\n", 10), "");
+});
+
+// 13. Throws TypeError for bad arguments.
+test("wrap throws TypeError on invalid arguments", () => {
+  for (const text of [undefined, null, 42, ["a"], { text: "a" }]) {
+    assert.throws(() => wrap(text, 10), TypeError);
+  }
+  for (const width of [undefined, null, 0, -1, 1.5, "10", NaN, Infinity]) {
+    assert.throws(() => wrap("some text", width), TypeError);
+  }
+});
```

## Candidate Q

```diff
diff --git a/ACCEPTANCE.md b/ACCEPTANCE.md
new file mode 100644
index 0000000..cbe929d
--- /dev/null
+++ b/ACCEPTANCE.md
@@ -0,0 +1,29 @@
+# Acceptance: word wrap
+
+Task: add a function that wraps text to a given width, in the style of `src/count.mjs`.
+
+## Acceptance lines
+
+Each line is checkable by reading the named file or by running `npm test`.
+
+1. `src/wrap.mjs` exists and exports a named function `wrapText(text, width)` (ESM, JSDoc header like `countWords`).
+2. `wrapText` returns a string; lines are joined with `"\n"`, with no trailing newline.
+3. Every output line is at most `width` characters long, except a single word longer than `width`, which is placed on its own line unbroken.
+4. Words are kept whole: a break only ever happens at whitespace, never inside a word.
+5. Words are packed greedily: a word goes on the current line if it fits (`line.length + 1 + word.length <= width`), otherwise it starts a new line.
+6. Runs of whitespace in the input (spaces, tabs, newlines) collapse to a single space between words; leading and trailing whitespace is dropped.
+7. Empty input or whitespace-only input returns `""`.
+8. `wrapText` throws a `TypeError` if `text` is not a string, or if `width` is not a positive integer (matching the `countWords` guard style).
+9. `tests/wrap.test.mjs` exists, uses `node:test` and `node:assert/strict`, and covers lines 2 to 8 above with at least one assertion each.
+10. `README.md` shows a `wrapText` usage example alongside the existing `countWords` one.
+11. `npm test` passes with zero failures.
+
+## Out of scope
+
+- Preserving existing paragraph breaks or blank lines in the input (all whitespace collapses).
+- Hyphenating or splitting long words.
+- Indentation, prefixes, justification, or alignment.
+- Unicode width (East Asian wide characters, combining marks, grapheme clusters); length is `String.prototype.length`.
+- ANSI escape sequences.
+- A CLI or a default width.
+- Changes to `src/count.mjs` or `tests/count.test.mjs`.
diff --git a/README.md b/README.md
index 0cac2e6..3e02645 100644
--- a/README.md
+++ b/README.md
@@ -4,6 +4,10 @@ Small helpers for laying out plain text in a terminal.
 
 ```js
 import { countWords } from "./src/count.mjs";
+import { wrapText } from "./src/wrap.mjs";
 
 countWords("one two  three"); // 3
+
+wrapText("the quick brown fox jumps over the lazy dog", 10);
+// "the quick\nbrown fox\njumps over\nthe lazy\ndog"
 ```
diff --git a/src/wrap.mjs b/src/wrap.mjs
new file mode 100644
index 0000000..e770df0
--- /dev/null
+++ b/src/wrap.mjs
@@ -0,0 +1,33 @@
+/**
+ * Wraps `text` to lines of at most `width` characters, breaking only at
+ * whitespace. Words are packed greedily; a single word longer than `width`
+ * is placed on its own line unbroken. Runs of whitespace collapse to one
+ * space and leading/trailing whitespace is dropped. Lines are joined with
+ * "\n" with no trailing newline.
+ *
+ * @param {string} text
+ * @param {number} width
+ * @returns {string}
+ */
+export function wrapText(text, width) {
+  if (typeof text !== "string") throw new TypeError("wrapText: text must be a string");
+  if (!Number.isInteger(width) || width < 1) {
+    throw new TypeError("wrapText: width must be a positive integer");
+  }
+  const words = text.trim().split(/\s+/);
+  if (words[0] === "") return "";
+
+  const lines = [];
+  let line = words[0];
+  for (let i = 1; i < words.length; i++) {
+    const word = words[i];
+    if (line.length + 1 + word.length <= width) {
+      line += " " + word;
+    } else {
+      lines.push(line);
+      line = word;
+    }
+  }
+  lines.push(line);
+  return lines.join("\n");
+}
diff --git a/tests/wrap.test.mjs b/tests/wrap.test.mjs
new file mode 100644
index 0000000..29dc195
--- /dev/null
+++ b/tests/wrap.test.mjs
@@ -0,0 +1,68 @@
+import assert from "node:assert/strict";
+import { test } from "node:test";
+
+import { wrapText } from "../src/wrap.mjs";
+
+// Line 2: returns a string; lines joined with "\n", no trailing newline.
+test("wrapText returns a string joined with \\n and no trailing newline", () => {
+  const out = wrapText("one two three", 7);
+  assert.equal(typeof out, "string");
+  assert.equal(out, "one two\nthree");
+  assert.ok(!out.endsWith("\n"));
+});
+
+// Line 3: every line is at most width, except a single over-long word.
+test("wrapText keeps every line within width", () => {
+  const out = wrapText("the quick brown fox jumps over the lazy dog", 10);
+  for (const line of out.split("\n")) assert.ok(line.length <= 10, line);
+  assert.equal(out, "the quick\nbrown fox\njumps over\nthe lazy\ndog");
+});
+
+test("wrapText places a word longer than width on its own line unbroken", () => {
+  assert.equal(wrapText("a supercalifragilistic b", 5), "a\nsupercalifragilistic\nb");
+  assert.equal(wrapText("supercalifragilistic", 5), "supercalifragilistic");
+});
+
+// Line 4: breaks only at whitespace, never inside a word.
+test("wrapText never breaks inside a word", () => {
+  const out = wrapText("alpha beta gamma delta", 6);
+  assert.equal(out, "alpha\nbeta\ngamma\ndelta");
+  assert.deepEqual(out.split(/\s+/), ["alpha", "beta", "gamma", "delta"]);
+});
+
+// Line 5: greedy packing with the exact fit rule.
+test("wrapText packs words greedily", () => {
+  // "ab cd" is exactly 5 chars: fits at width 5, not at width 4.
+  assert.equal(wrapText("ab cd ef", 5), "ab cd\nef");
+  assert.equal(wrapText("ab cd ef", 4), "ab\ncd\nef");
+  assert.equal(wrapText("aaa bb c dddd", 6), "aaa bb\nc dddd");
+});
+
+// Line 6: whitespace runs collapse; leading/trailing whitespace dropped.
+test("wrapText collapses whitespace runs and trims the ends", () => {
+  assert.equal(wrapText("  one \t two\n\nthree  ", 80), "one two three");
+  assert.equal(wrapText("one\n\n\ntwo", 3), "one\ntwo");
+});
+
+// Line 7: empty or whitespace-only input returns "".
+test("wrapText returns an empty string for empty or whitespace-only input", () => {
+  assert.equal(wrapText("", 10), "");
+  assert.equal(wrapText("   \n\t ", 10), "");
+});
+
+// Line 8: TypeError guards.
+test("wrapText throws a TypeError for a non-string text", () => {
+  assert.throws(() => wrapText(42, 10), TypeError);
+  assert.throws(() => wrapText(null, 10), TypeError);
+  assert.throws(() => wrapText(undefined, 10), TypeError);
+});
+
+test("wrapText throws a TypeError for a non-positive-integer width", () => {
+  assert.throws(() => wrapText("one two", 0), TypeError);
+  assert.throws(() => wrapText("one two", -1), TypeError);
+  assert.throws(() => wrapText("one two", 2.5), TypeError);
+  assert.throws(() => wrapText("one two", "10"), TypeError);
+  assert.throws(() => wrapText("one two", NaN), TypeError);
+  assert.throws(() => wrapText("one two", Infinity), TypeError);
+  assert.throws(() => wrapText("one two"), TypeError);
+});
```

## Candidate H

```diff
diff --git a/ACCEPTANCE.md b/ACCEPTANCE.md
new file mode 100644
index 0000000..13869f1
--- /dev/null
+++ b/ACCEPTANCE.md
@@ -0,0 +1,34 @@
+# Acceptance: word wrapping
+
+Add `wrap(text, width)` that wraps plain text to a given column width. Done when every item below holds and `npm test` passes.
+
+## Shape (check by reading code)
+
+1. `src/wrap.mjs` exports a named function `wrap(text, width)` that returns a string. It has a JSDoc block like `src/count.mjs`.
+2. `wrap` throws a `TypeError` whose message starts with `wrap:` when `text` is not a string, or when `width` is not a positive integer.
+3. `tests/wrap.test.mjs` exists, uses `node:test` and `node:assert/strict`, and covers every behaviour in the next section. `npm test` passes with the new file included.
+4. README.md gains a short `wrap` example alongside the `countWords` one.
+
+## Behaviour (each has a test)
+
+5. Words are runs of non-whitespace; output lines are words joined by single spaces. Every output line is at most `width` characters long when this is possible.
+   `wrap("the quick brown fox", 10)` → `"the quick\nbrown fox"`
+6. Input whitespace is normalised: runs of spaces, tabs and newlines between words collapse to one space, and leading/trailing whitespace is dropped.
+   `wrap("  a   b\n\tc  ", 80)` → `"a b c"`
+7. A word longer than `width` is placed on its own line unbroken (it is not split), and wrapping continues normally after it.
+   `wrap("a verylongword b", 5)` → `"a\nverylongword\nb"`
+8. A line is never ended with trailing spaces and never begins with a leading space.
+9. Text that already fits is returned as a single line with no trailing newline.
+   `wrap("short", 10)` → `"short"`
+10. Empty or whitespace-only input returns `""`.
+11. Blank lines in the input (two or more consecutive newlines) separate paragraphs: each paragraph is wrapped independently and paragraphs are joined by exactly one empty line (`"\n\n"`).
+    `wrap("a b\n\nc d", 80)` → `"a b\n\nc d"`
+12. A width of `1` still works: each word lands on its own line.
+
+## Out of scope
+
+- Hyphenating or splitting long words.
+- Indentation, prefixes, or right/centre justification.
+- Unicode display width (each UTF-16 code unit counts as one column); ANSI escape codes.
+- Preserving single newlines inside a paragraph (they are treated as spaces, per item 6).
+- A CLI or any change to `countWords`.
diff --git a/README.md b/README.md
index 0cac2e6..8d1dae1 100644
--- a/README.md
+++ b/README.md
@@ -7,3 +7,9 @@ import { countWords } from "./src/count.mjs";
 
 countWords("one two  three"); // 3
 ```
+
+```js
+import { wrap } from "./src/wrap.mjs";
+
+wrap("the quick brown fox", 10); // "the quick\nbrown fox"
+```
diff --git a/src/wrap.mjs b/src/wrap.mjs
new file mode 100644
index 0000000..5215bf8
--- /dev/null
+++ b/src/wrap.mjs
@@ -0,0 +1,43 @@
+/**
+ * Wraps `text` to lines of at most `width` characters.
+ *
+ * Words are runs of non-whitespace and are joined by single spaces. Runs of
+ * whitespace collapse to one space and leading/trailing whitespace is dropped.
+ * A word longer than `width` is placed on its own line unbroken. Blank lines
+ * (two or more consecutive newlines) separate paragraphs, which are wrapped
+ * independently and joined by exactly one empty line.
+ *
+ * @param {string} text
+ * @param {number} width positive integer column width
+ * @returns {string}
+ */
+export function wrap(text, width) {
+  if (typeof text !== "string") throw new TypeError("wrap: text must be a string");
+  if (!Number.isInteger(width) || width < 1) {
+    throw new TypeError("wrap: width must be a positive integer");
+  }
+  return text
+    .split(/\n[ \t]*\n\s*/)
+    .map((paragraph) => wrapParagraph(paragraph, width))
+    .filter((paragraph) => paragraph !== "")
+    .join("\n\n");
+}
+
+function wrapParagraph(paragraph, width) {
+  const words = paragraph.trim().split(/\s+/);
+  if (words[0] === "") return "";
+  const lines = [];
+  let line = "";
+  for (const word of words) {
+    if (line === "") {
+      line = word;
+    } else if (line.length + 1 + word.length <= width) {
+      line += " " + word;
+    } else {
+      lines.push(line);
+      line = word;
+    }
+  }
+  lines.push(line);
+  return lines.join("\n");
+}
diff --git a/tests/wrap.test.mjs b/tests/wrap.test.mjs
new file mode 100644
index 0000000..e3a79bf
--- /dev/null
+++ b/tests/wrap.test.mjs
@@ -0,0 +1,63 @@
+import assert from "node:assert/strict";
+import { test } from "node:test";
+
+import { wrap } from "../src/wrap.mjs";
+
+test("wrap throws a TypeError prefixed with wrap: for bad arguments", () => {
+  for (const text of [42, null, undefined, ["a"]]) {
+    assert.throws(() => wrap(text, 10), { name: "TypeError", message: /^wrap:/ });
+  }
+  for (const width of [0, -1, 1.5, "10", NaN, Infinity, undefined]) {
+    assert.throws(() => wrap("a b", width), { name: "TypeError", message: /^wrap:/ });
+  }
+});
+
+test("wrap joins words with single spaces and keeps lines within width", () => {
+  assert.equal(wrap("the quick brown fox", 10), "the quick\nbrown fox");
+  const out = wrap("one two three four five six seven eight nine ten", 12);
+  for (const line of out.split("\n")) assert.ok(line.length <= 12, `line too long: ${line}`);
+  assert.equal(out, "one two\nthree four\nfive six\nseven eight\nnine ten");
+});
+
+test("wrap normalises whitespace between words and trims the ends", () => {
+  assert.equal(wrap("  a   b\n\tc  ", 80), "a b c");
+  assert.equal(wrap("a\nb\nc", 80), "a b c");
+});
+
+test("wrap leaves a word longer than width unbroken on its own line", () => {
+  assert.equal(wrap("a verylongword b", 5), "a\nverylongword\nb");
+  assert.equal(wrap("verylongword", 5), "verylongword");
+  assert.equal(wrap("aa bb verylongword cc dd", 5), "aa bb\nverylongword\ncc dd");
+});
+
+test("wrap never leaves leading or trailing spaces on a line", () => {
+  const out = wrap("  the   quick brown\tfox jumps   over the lazy dog  ", 7);
+  for (const line of out.split("\n")) {
+    assert.notEqual(line, "");
+    assert.equal(line, line.trim());
+  }
+});
+
+test("wrap returns text that already fits as a single line", () => {
+  assert.equal(wrap("short", 10), "short");
+  assert.equal(wrap("exactly ten", 11), "exactly ten");
+  assert.ok(!wrap("short", 10).includes("\n"));
+});
+
+test("wrap returns an empty string for empty or whitespace-only input", () => {
+  assert.equal(wrap("", 10), "");
+  assert.equal(wrap("   ", 10), "");
+  assert.equal(wrap("\n\n\t\n", 10), "");
+});
+
+test("wrap treats blank lines as paragraph breaks and wraps each paragraph", () => {
+  assert.equal(wrap("a b\n\nc d", 80), "a b\n\nc d");
+  assert.equal(wrap("a b\n\n\n\nc d", 80), "a b\n\nc d");
+  assert.equal(wrap("the quick brown fox\n\njumps over the dog", 10), "the quick\nbrown fox\n\njumps over\nthe dog");
+  assert.equal(wrap("\n\na b\n\n", 80), "a b");
+});
+
+test("wrap with width 1 puts every word on its own line", () => {
+  assert.equal(wrap("a b c", 1), "a\nb\nc");
+  assert.equal(wrap("ab cd", 1), "ab\ncd");
+});
```

## Candidate J

```diff
diff --git a/ACCEPTANCE.md b/ACCEPTANCE.md
new file mode 100644
index 0000000..be4d5c0
--- /dev/null
+++ b/ACCEPTANCE.md
@@ -0,0 +1,51 @@
+# Acceptance: word wrap
+
+`wrap(text, width)` wraps plain text to a column width. Each item below is
+checkable by reading the code or by running `npm test`.
+
+## API
+
+1. `src/wrap.mjs` exports a named function `wrap(text, width)` that returns a
+   string (`String` in, `String` out; no arrays, no objects).
+2. `wrap` has a JSDoc block in the same style as `countWords` in
+   `src/count.mjs` (description, `@param`, `@returns`).
+3. `wrap` throws a `TypeError` whose message starts with `wrap:` when `text`
+   is not a string, or when `width` is not a positive integer (`0`, `-1`,
+   `1.5`, `NaN`, `"10"` all throw).
+
+## Behaviour
+
+4. Lines are joined with `"\n"`; no line in the output is longer than `width`
+   characters, except a single word longer than `width`, which is placed on
+   its own line unbroken (words are never split mid-word).
+5. Words are runs of non-whitespace, as in `countWords`. Any run of
+   whitespace in the input (spaces, tabs, newlines) is treated as one
+   separator; words on one output line are joined by exactly one space.
+6. Text that already fits returns as a single line: `wrap("a b", 10)` is
+   `"a b"`.
+7. Output has no leading or trailing whitespace and no trailing newline:
+   `wrap("  a b  ", 10)` is `"a b"`.
+8. Empty or whitespace-only input returns `""`.
+9. Wrapping is greedy: as many words as fit go on each line before breaking.
+   `wrap("the quick brown fox", 10)` is `"the quick\nbrown fox"`.
+10. A width boundary is inclusive: `wrap("ab cd", 5)` is `"ab cd"`;
+    `wrap("ab cd", 4)` is `"ab\ncd"`.
+
+## Tests and docs
+
+11. `tests/wrap.test.mjs` exists, uses `node:test` and `node:assert/strict`
+    like `tests/count.test.mjs`, and covers items 3 through 10 above.
+12. `npm test` exits 0 with the new tests included (the existing
+    `countWords` test still passes).
+13. `README.md` gains a short `wrap` example in the same form as the
+    existing `countWords` example.
+
+## Out of scope
+
+- Hyphenation or breaking long words at `width`.
+- Preserving existing paragraph breaks or blank lines in the input.
+- Indentation, prefixes, or justification.
+- Unicode width (combining marks, East Asian wide characters); width is
+  counted in UTF-16 code units via `String.prototype.length`.
+- ANSI escape sequences.
+- A CLI or a default export.
diff --git a/README.md b/README.md
index 0cac2e6..8d1dae1 100644
--- a/README.md
+++ b/README.md
@@ -7,3 +7,9 @@ import { countWords } from "./src/count.mjs";
 
 countWords("one two  three"); // 3
 ```
+
+```js
+import { wrap } from "./src/wrap.mjs";
+
+wrap("the quick brown fox", 10); // "the quick\nbrown fox"
+```
diff --git a/src/wrap.mjs b/src/wrap.mjs
new file mode 100644
index 0000000..13fd11c
--- /dev/null
+++ b/src/wrap.mjs
@@ -0,0 +1,32 @@
+/**
+ * Wraps `text` to lines no longer than `width` characters, breaking only
+ * between words (runs of non-whitespace). Words are packed greedily and
+ * joined by one space; a single word longer than `width` is placed on its
+ * own line unbroken. Lines are joined with "\n".
+ *
+ * @param {string} text
+ * @param {number} width
+ * @returns {string}
+ */
+export function wrap(text, width) {
+  if (typeof text !== "string") throw new TypeError("wrap: text must be a string");
+  if (!Number.isInteger(width) || width < 1) {
+    throw new TypeError("wrap: width must be a positive integer");
+  }
+  const words = text.trim().split(/\s+/);
+  if (words[0] === "") return "";
+
+  const lines = [];
+  let line = words[0];
+  for (let i = 1; i < words.length; i++) {
+    const word = words[i];
+    if (line.length + 1 + word.length <= width) {
+      line += " " + word;
+    } else {
+      lines.push(line);
+      line = word;
+    }
+  }
+  lines.push(line);
+  return lines.join("\n");
+}
diff --git a/tests/wrap.test.mjs b/tests/wrap.test.mjs
new file mode 100644
index 0000000..995cd59
--- /dev/null
+++ b/tests/wrap.test.mjs
@@ -0,0 +1,57 @@
+import assert from "node:assert/strict";
+import { test } from "node:test";
+
+import { wrap } from "../src/wrap.mjs";
+
+test("wrap throws a TypeError when text is not a string", () => {
+  for (const bad of [undefined, null, 42, ["a"], { text: "a" }]) {
+    assert.throws(() => wrap(bad, 10), { name: "TypeError", message: /^wrap:/ });
+  }
+});
+
+test("wrap throws a TypeError when width is not a positive integer", () => {
+  for (const bad of [0, -1, 1.5, NaN, "10", undefined, Infinity]) {
+    assert.throws(() => wrap("a b", bad), { name: "TypeError", message: /^wrap:/ });
+  }
+});
+
+test("wrap returns a string joined with newlines, no line longer than width", () => {
+  const out = wrap("one two three four five six seven", 9);
+  assert.equal(typeof out, "string");
+  for (const line of out.split("\n")) assert.ok(line.length <= 9, `"${line}" exceeds width`);
+  assert.equal(out, "one two\nthree\nfour five\nsix seven");
+});
+
+test("wrap places a word longer than width on its own line unbroken", () => {
+  assert.equal(wrap("a supercalifragilistic b", 5), "a\nsupercalifragilistic\nb");
+  assert.equal(wrap("supercalifragilistic", 5), "supercalifragilistic");
+});
+
+test("wrap treats any run of whitespace as one separator", () => {
+  assert.equal(wrap("a  b\tc\nd\r\n e", 20), "a b c d e");
+  assert.equal(wrap("a  b\tc\nd", 3), "a b\nc d");
+});
+
+test("wrap returns text that already fits as a single line", () => {
+  assert.equal(wrap("a b", 10), "a b");
+});
+
+test("wrap has no leading or trailing whitespace and no trailing newline", () => {
+  assert.equal(wrap("  a b  ", 10), "a b");
+  assert.equal(wrap("\n a b \n", 1), "a\nb");
+});
+
+test("wrap returns an empty string for empty or whitespace-only input", () => {
+  assert.equal(wrap("", 10), "");
+  assert.equal(wrap("   ", 10), "");
+  assert.equal(wrap("\n\t ", 10), "");
+});
+
+test("wrap is greedy", () => {
+  assert.equal(wrap("the quick brown fox", 10), "the quick\nbrown fox");
+});
+
+test("wrap treats the width boundary as inclusive", () => {
+  assert.equal(wrap("ab cd", 5), "ab cd");
+  assert.equal(wrap("ab cd", 4), "ab\ncd");
+});
```

# What to do

For each candidate, score it from 1 to 5 against the task and the acceptance material (5: every requirement clearly met with tests that would catch a regression; 3: the main behaviour is right but a requirement is unmet, untested or fragile; 1: does not do the task), with two or three sentences of reasons that cite the diff. Then rank all candidates from best to worst; ties are allowed only when you can say why two are indistinguishable. Judge the deliverable, not its volume: more lines are not more credit.

End your reply with exactly one fenced JSON block of this shape, and nothing after it:

```json
{
  "scores": { "R": { "score": <1-5>, "reasons": "<two or three sentences>" }, "N": { "score": <1-5>, "reasons": "<two or three sentences>" }, "T": { "score": <1-5>, "reasons": "<two or three sentences>" }, "D": { "score": <1-5>, "reasons": "<two or three sentences>" }, "Y": { "score": <1-5>, "reasons": "<two or three sentences>" }, "K": { "score": <1-5>, "reasons": "<two or three sentences>" }, "Q": { "score": <1-5>, "reasons": "<two or three sentences>" }, "H": { "score": <1-5>, "reasons": "<two or three sentences>" }, "J": { "score": <1-5>, "reasons": "<two or three sentences>" } },
  "ranking": ["R", "N", "T", "D", "Y", "K", "Q", "H", "J"],
  "notes": "<anything that applied to several candidates, in at most three sentences>"
}
```


## Reply

Here is my assessment of the nine candidates. All nine implement a greedy word-packer with the same argument guards, and I traced every test assertion against its implementation; I found no failing test in any candidate. The differences are in how newlines are treated, whether long words are split, and how much a regression would be caught.

**Candidate T** wraps each newline-separated paragraph independently, collapses runs of blank lines to one, and drops leading and trailing blanks (`src/wrap.mjs` lines 21 to 36). The tests are the most exhaustive of the set: loops over widths checking line length, blank lines containing only tabs, and leading and trailing empty lines (`tests/wrap.test.mjs` lines 78 to 110).

**Candidate H** treats only blank lines as paragraph breaks and collapses single newlines to spaces (`src/wrap.mjs` lines 19 to 23). The paragraph regex is checked with runs of four newlines and with leading and trailing blank lines (`tests/wrap.test.mjs` lines 54 to 59), and a width-1 case guards the degenerate path.

**Candidate D** is the single-paragraph design with a RangeError for a bad width instead of TypeError (`src/wrap.mjs` line 16). Its tests are tight: exact error messages, an explicit UTF-16 code unit case with emoji (`tests/wrap.test.mjs` lines 24 to 29), and the exact-fit boundary at widths 6 and 7.

**Candidate R**, **Candidate Y**, **Candidate Q**, and **Candidate J** share the same single-paragraph implementation. R and Y add explanatory README prose; all four cover validation, the over-long word, whitespace collapse, the exact-fit boundary, and empty input. Q and J are nearly indistinguishable, with Q's tests slightly broader on greedy packing.

**Candidate K** preserves every input newline literally, so `"ab\n\n\ncd"` keeps three newlines (`tests/wrap.test.mjs` line 66) and an input ending in a newline emits a trailing newline, which sits oddly beside trimming every line. Its own acceptance item 6 contradicts item 10, which the test comment concedes (`tests/wrap.test.mjs` lines 14 to 16).

**Candidate N** hard-splits words longer than the width (`src/wrap.mjs` lines 41 to 44), which is a defensible choice but diverges from what "word wrapping" usually means. It also passes newline-only input through unchanged, so `wrap("\n\n", 5)` returns two newlines rather than an empty string, which is untested.

```json
{
  "scores": {
    "R": { "score": 5, "reasons": "Single-paragraph greedy wrap in src/wrap.mjs lines 21 to 37 is correct, and the README gains both an example and a prose description. Tests cover every acceptance item with concrete expected strings, including the exact-fit boundary at widths 9, 10 and 15 and whitespace-only input." },
    "N": { "score": 4, "reasons": "Correct greedy packing with newline-preserving paragraphs, and tests that loop over widths to check no line exceeds width or carries edge spaces. However it hard-splits long words (src/wrap.mjs lines 41 to 44), which departs from the conventional meaning of word wrapping, and newline-only input returns newlines rather than an empty string, which is neither specified nor tested." },
    "T": { "score": 5, "reasons": "Paragraph-aware wrapping that collapses blank-line runs and drops leading and trailing blanks (src/wrap.mjs lines 21 to 36) is correct and terminal-friendly. The tests are the most exhaustive: width loops, blank lines containing only whitespace, and the long-word-then-resume case at tests/wrap.test.mjs lines 47 to 58." },
    "D": { "score": 5, "reasons": "Same correct single-paragraph algorithm with a RangeError for width (src/wrap.mjs line 16), and README updated. Tests assert exact error messages, verify UTF-16 measurement with emoji (tests/wrap.test.mjs lines 24 to 29), and probe the exact-fit boundary at adjacent widths." },
    "Y": { "score": 5, "reasons": "Identical algorithm to R with a README example and prose. Tests are labelled per acceptance item and include the boundary case at widths 4 and 5, edge-space checks per line, and a CRLF input, so a regression in trimming or packing would be caught." },
    "K": { "score": 4, "reasons": "Greedy packing is correct and newline paragraphs are supported, but every input newline is preserved verbatim so a trailing newline or run of blank lines passes through (tests/wrap.test.mjs line 66), inconsistent with trimming every line. Its acceptance item 6 is contradicted by item 10, which the test comment at lines 14 to 16 acknowledges." },
    "Q": { "score": 5, "reasons": "Correct single-paragraph implementation seeded from the first word (src/wrap.mjs lines 20 to 30) with a longer README example. Tests cover the inclusive boundary at widths 4 and 5, a never-split-inside-a-word check, collapsed newline runs, and all invalid width forms." },
    "H": { "score": 5, "reasons": "Blank-line paragraphs are preserved while single newlines collapse (src/wrap.mjs lines 19 to 23), a sensible middle ground, and the regex is verified against four consecutive newlines and leading and trailing blanks (tests/wrap.test.mjs lines 54 to 59). Width 1 and edge-space checks round out solid regression coverage." },
    "J": { "score": 5, "reasons": "Same correct implementation as Q, README example added. Tests include an exact multi-line expectation at width 9, the inclusive boundary at widths 4 and 5, and CRLF collapse; coverage is adequate but a little thinner than Q on greedy packing." }
  },
  "ranking": ["T", "H", "D", "R", "Y", "Q", "J", "K", "N"],
  "notes": "All nine share the same greedy line-packing loop and the same guards, and no test in any candidate fails against its implementation. The ranking among the five single-paragraph candidates rests on test depth and README quality; Q and J are close to indistinguishable. K and N lose a point for literal newline passthrough, and N additionally for splitting words mid-word."
}
```
