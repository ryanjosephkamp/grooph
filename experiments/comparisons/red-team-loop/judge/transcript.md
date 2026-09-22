# Blind judge · red-team-loop

Model `claude-fable-5-1`, no tools, fresh session, 2026-09-21T23:24:53.888Z; ledger invocation 21, $1.8965. The letters' mapping is in `mapping.json`, which the judge never saw.

## Prompt

You are a critic judging 6 candidate changes to one small Node project. Each candidate was produced by a different session working from the same task; you do not know how, and you should not guess. Judge only what the diff shows against the task and its acceptance material. You have no tools: read carefully and cite lines of the diff.

# The task

Make `parseCsvLine` in src/csv.mjs honour every line of the contract in README.md for any string input: fields or a CsvError, nothing else, within a second for a 100 KB record. Keep tests/csv.test.mjs green and extend it.

# Acceptance material the builder saw

### README.md

```
# csvline

`parseCsvLine(text)` parses one CSV record into its fields. It feeds an import
job that accepts files from outside, so the input is anything at all.

```js
import { parseCsvLine, CsvError } from "./src/csv.mjs";

parseCsvLine('a,b,c');                 // ["a", "b", "c"]
parseCsvLine('"x, y",z');              // ["x, y", "z"]
parseCsvLine('"say ""hi""",');         // ['say "hi"', ""]
```

## Contract

For every string `text`, `parseCsvLine` either returns the fields as an array
of strings, or throws `CsvError` (exported, a subclass of `Error`). It never
throws anything else, never hangs, and returns within a second for a record of
100 KB. Anything that is not a string throws a `TypeError`.

Fields:

- Fields are separated by `,`. The empty text is one empty field: `[""]`; `a,`
  is `["a", ""]`.
- A field may be wrapped in double quotes. Inside quotes, `""` is one `"`, and
  commas, `\n` and `\r\n` are literal characters of the field.
- After a closing quote, only a comma, the record terminator or the end of the
  text may follow; anything else is a `CsvError`. A quoted field that never
  closes is a `CsvError`.
- Outside quotes, a `"` anywhere is a `CsvError` (`a"b`, `a "b"`).
- Whitespace outside quotes is part of the field: `' a '` stays `" a "`.
- One record terminator (`\n` or `\r\n`) at the very end of the text is
  removed; any other unquoted `\r` or `\n` is a `CsvError`.
- Every other character, including tabs, control characters and any Unicode,
  is a literal character of its field.
```

# Candidates (in random order, under random letters)

## Candidate D

```diff
diff --git a/src/csv.mjs b/src/csv.mjs
index d5d662e..e6d690d 100644
--- a/src/csv.mjs
+++ b/src/csv.mjs
@@ -6,29 +6,76 @@ export class CsvError extends Error {
 }
 
 /**
- * Parses one CSV record into its fields (README.md). Handles the plain and the
- * quoted case; the rest of the contract is not enforced yet.
+ * Parses one CSV record into its fields (README.md § Contract).
+ *
+ * For any string input this returns an array of strings or throws CsvError;
+ * non-string input throws TypeError. Single pass, index based, so a 100 KB
+ * record is well under a second and there is no way to hang.
+ *
  * @param {string} text
  * @returns {string[]}
  */
 export function parseCsvLine(text) {
-  if (typeof text !== "string") throw new TypeError("parseCsvLine: text must be a string");
+  if (typeof text !== "string") {
+    throw new TypeError("parseCsvLine: text must be a string");
+  }
+
+  // One record terminator (\n or \r\n) at the very end of the text is removed.
+  // Doing this up front is safe: a terminator inside an open quote would leave
+  // that quote unclosed either way, so the outcome is a CsvError regardless.
+  let end = text.length;
+  if (end >= 2 && text.charCodeAt(end - 2) === 13 && text.charCodeAt(end - 1) === 10) {
+    end -= 2;
+  } else if (end >= 1 && text.charCodeAt(end - 1) === 10) {
+    end -= 1;
+  }
+
   const fields = [];
-  let field = "";
-  let quoted = false;
-  let rest = text;
-  while (rest.length > 0) {
-    const ch = rest[0];
-    rest = rest.slice(1);
-    if (ch === '"') {
-      quoted = !quoted;
-    } else if (ch === "," && !quoted) {
-      fields.push(field);
-      field = "";
+  let i = 0;
+  for (;;) {
+    if (i < end && text[i] === '"') {
+      // Quoted field: everything up to the closing quote is literal, "" is ".
+      const parts = [];
+      let j = i + 1;
+      for (;;) {
+        const q = text.indexOf('"', j);
+        if (q === -1 || q >= end) {
+          throw new CsvError(`unclosed quoted field starting at offset ${i}`);
+        }
+        parts.push(text.slice(j, q));
+        if (q + 1 < end && text[q + 1] === '"') {
+          parts.push('"');
+          j = q + 2;
+          continue;
+        }
+        // q is the closing quote.
+        fields.push(parts.join(""));
+        const k = q + 1;
+        if (k === end) return fields;
+        if (text[k] === ",") {
+          i = k + 1;
+          break;
+        }
+        throw new CsvError(
+          `unexpected character ${JSON.stringify(text[k])} after closing quote at offset ${k}`,
+        );
+      }
     } else {
-      field += ch;
+      // Unquoted field: runs to the next comma or the end; no quotes or
+      // unquoted line breaks are allowed anywhere in it.
+      let j = i;
+      while (j < end) {
+        const c = text.charCodeAt(j);
+        if (c === 44) break; // ','
+        if (c === 34) throw new CsvError(`unexpected quote at offset ${j}`);
+        if (c === 10 || c === 13) {
+          throw new CsvError(`unquoted line break at offset ${j}`);
+        }
+        j += 1;
+      }
+      fields.push(text.slice(i, j));
+      if (j === end) return fields;
+      i = j + 1;
     }
   }
-  fields.push(field);
-  return fields;
 }
diff --git a/tests/csv.test.mjs b/tests/csv.test.mjs
index 816adc6..aed0717 100644
--- a/tests/csv.test.mjs
+++ b/tests/csv.test.mjs
@@ -1,8 +1,11 @@
 import assert from "node:assert/strict";
 import { test } from "node:test";
+import { performance } from "node:perf_hooks";
 
 import { CsvError, parseCsvLine } from "../src/csv.mjs";
 
+const csvError = (fn) => assert.throws(fn, CsvError);
+
 test("plain fields", () => {
   assert.deepEqual(parseCsvLine("a,b,c"), ["a", "b", "c"]);
   assert.deepEqual(parseCsvLine("a,"), ["a", ""]);
@@ -19,4 +22,218 @@ test("non-string input", () => {
 
 test("CsvError is an Error", () => {
   assert.ok(new CsvError("x") instanceof Error);
+  assert.equal(new CsvError("x").name, "CsvError");
+});
+
+// Contract: "Anything that is not a string throws a TypeError."
+test("contract: every non-string throws TypeError", () => {
+  for (const bad of [undefined, null, 0, 1, true, {}, [], ["a"], new String("a"), Symbol("s"), () => "a", 10n]) {
+    assert.throws(() => parseCsvLine(bad), TypeError);
+  }
+});
+
+// Contract: "Fields are separated by `,`. The empty text is one empty field:
+// `[""]`; `a,` is `["a", ""]`."
+test("contract: comma separation and empty fields", () => {
+  assert.deepEqual(parseCsvLine(","), ["", ""]);
+  assert.deepEqual(parseCsvLine(",,"), ["", "", ""]);
+  assert.deepEqual(parseCsvLine(",a"), ["", "a"]);
+  assert.deepEqual(parseCsvLine("a,,b"), ["a", "", "b"]);
+  assert.deepEqual(parseCsvLine('"",'), ["", ""]);
+  assert.deepEqual(parseCsvLine(',""'), ["", ""]);
+  assert.deepEqual(parseCsvLine('""'), [""]);
+});
+
+// Contract: "A field may be wrapped in double quotes. Inside quotes, `""` is
+// one `"`, and commas, `\n` and `\r\n` are literal characters of the field."
+test("contract: quoted fields, escaped quotes and literal line breaks", () => {
+  assert.deepEqual(parseCsvLine('"say ""hi""",'), ['say "hi"', ""]);
+  assert.deepEqual(parseCsvLine('""""'), ['"']);
+  assert.deepEqual(parseCsvLine('""""""'), ['""']);
+  assert.deepEqual(parseCsvLine('"a""b""c"'), ['a"b"c']);
+  assert.deepEqual(parseCsvLine('"a,b",c'), ["a,b", "c"]);
+  assert.deepEqual(parseCsvLine('"a\nb"'), ["a\nb"]);
+  assert.deepEqual(parseCsvLine('"a\r\nb",c'), ["a\r\nb", "c"]);
+  assert.deepEqual(parseCsvLine('"\n"'), ["\n"]);
+  assert.deepEqual(parseCsvLine('"\r\n"'), ["\r\n"]);
+  assert.deepEqual(parseCsvLine('"\r"'), ["\r"]);
+  assert.deepEqual(parseCsvLine('"a","b"'), ["a", "b"]);
+  // A quoted field followed by the record terminator keeps its content intact.
+  assert.deepEqual(parseCsvLine('"a\n"\n'), ["a\n"]);
+  assert.deepEqual(parseCsvLine('"a"""\n'), ['a"']);
+});
+
+// Contract: "After a closing quote, only a comma, the record terminator or the
+// end of the text may follow; anything else is a `CsvError`. A quoted field
+// that never closes is a `CsvError`."
+test("contract: what may follow a closing quote", () => {
+  assert.deepEqual(parseCsvLine('"a",b'), ["a", "b"]);
+  assert.deepEqual(parseCsvLine('"a"\n'), ["a"]);
+  assert.deepEqual(parseCsvLine('"a"\r\n'), ["a"]);
+  assert.deepEqual(parseCsvLine('"a"'), ["a"]);
+  assert.deepEqual(parseCsvLine('"a"""'), ['a"']);
+  csvError(() => parseCsvLine('"a"b'));
+  csvError(() => parseCsvLine('"a" '));
+  csvError(() => parseCsvLine('"a" ,b'));
+  csvError(() => parseCsvLine('"a"\r'));
+  csvError(() => parseCsvLine('"a"\n,b'));
+  csvError(() => parseCsvLine('"a"\n\n'));
+  csvError(() => parseCsvLine('"a""'));
+  csvError(() => parseCsvLine('"a"\n"'));
+  csvError(() => parseCsvLine('"a"\t'));
+});
+
+test("contract: unclosed quoted field is a CsvError", () => {
+  csvError(() => parseCsvLine('"'));
+  csvError(() => parseCsvLine('"a'));
+  csvError(() => parseCsvLine('a,"b'));
+  csvError(() => parseCsvLine('"a\n'));
+  csvError(() => parseCsvLine('"a\r\n'));
+  csvError(() => parseCsvLine('"a""'));
+  csvError(() => parseCsvLine('"""'));
+  csvError(() => parseCsvLine('"a,b'));
+});
+
+// Contract: "Outside quotes, a `"` anywhere is a `CsvError` (`a"b`, `a "b"`)."
+test("contract: quote outside quotes is a CsvError", () => {
+  csvError(() => parseCsvLine('a"b'));
+  csvError(() => parseCsvLine('a "b"'));
+  csvError(() => parseCsvLine('a"'));
+  csvError(() => parseCsvLine(' "a"'));
+  csvError(() => parseCsvLine('a,b"'));
+  csvError(() => parseCsvLine('a,b"c,d'));
+  csvError(() => parseCsvLine('\t"a"'));
+});
+
+// Contract: "Whitespace outside quotes is part of the field: `' a '` stays
+// `" a "`."
+test("contract: whitespace outside quotes is preserved", () => {
+  assert.deepEqual(parseCsvLine(" a "), [" a "]);
+  assert.deepEqual(parseCsvLine(" a , b "), [" a ", " b "]);
+  assert.deepEqual(parseCsvLine("\ta\t"), ["\ta\t"]);
+  assert.deepEqual(parseCsvLine(" "), [" "]);
+  assert.deepEqual(parseCsvLine(" , "), [" ", " "]);
+  assert.deepEqual(parseCsvLine('" a "'), [" a "]);
+});
+
+// Contract: "One record terminator (`\n` or `\r\n`) at the very end of the
+// text is removed; any other unquoted `\r` or `\n` is a `CsvError`."
+test("contract: trailing record terminator is removed", () => {
+  assert.deepEqual(parseCsvLine("a\n"), ["a"]);
+  assert.deepEqual(parseCsvLine("a\r\n"), ["a"]);
+  assert.deepEqual(parseCsvLine("a,b\n"), ["a", "b"]);
+  assert.deepEqual(parseCsvLine("a,\n"), ["a", ""]);
+  assert.deepEqual(parseCsvLine("a,\r\n"), ["a", ""]);
+  assert.deepEqual(parseCsvLine("\n"), [""]);
+  assert.deepEqual(parseCsvLine("\r\n"), [""]);
+  assert.deepEqual(parseCsvLine(",\n"), ["", ""]);
+});
+
+test("contract: any other unquoted CR or LF is a CsvError", () => {
+  csvError(() => parseCsvLine("a\r"));
+  csvError(() => parseCsvLine("\r"));
+  csvError(() => parseCsvLine("a\n\n"));
+  csvError(() => parseCsvLine("a\r\n\r\n"));
+  csvError(() => parseCsvLine("a\n\r\n"));
+  csvError(() => parseCsvLine("a\r\r\n"));
+  csvError(() => parseCsvLine("a\nb"));
+  csvError(() => parseCsvLine("a\rb"));
+  csvError(() => parseCsvLine("a\r\nb"));
+  csvError(() => parseCsvLine("\na"));
+  csvError(() => parseCsvLine("a\n,b"));
+  csvError(() => parseCsvLine("a,\nb"));
+  csvError(() => parseCsvLine("\n\r"));
+  csvError(() => parseCsvLine("a\n\r"));
+});
+
+// Contract: "Every other character, including tabs, control characters and
+// any Unicode, is a literal character of its field."
+test("contract: every other character is literal", () => {
+  assert.deepEqual(parseCsvLine("a\tb"), ["a\tb"]);
+  assert.deepEqual(parseCsvLine("\u0000,\u0001\u001f\u007f"), ["\u0000", "\u0001\u001f\u007f"]);
+  assert.deepEqual(parseCsvLine("\u000b\u000c"), ["\u000b\u000c"]);
+  assert.deepEqual(parseCsvLine("é,日本,🙂"), ["é", "日本", "🙂"]);
+  assert.deepEqual(parseCsvLine(" , ,\u0085"), [" ", " ", "\u0085"]);
+  assert.deepEqual(parseCsvLine("﻿a"), ["﻿a"]);
+  assert.deepEqual(parseCsvLine("\ud800,\udc00"), ["\ud800", "\udc00"]);
+  assert.deepEqual(parseCsvLine("'a';b"), ["'a';b"]);
+  assert.deepEqual(parseCsvLine("a\\,b"), ["a\\", "b"]);
+  assert.deepEqual(parseCsvLine('"\u0000\t🙂 "'), ["\u0000\t🙂 "]);
+});
+
+// Contract: "returns within a second for a record of 100 KB"
+test("contract: 100 KB records parse within a second", () => {
+  const KB100 = 100 * 1024;
+  const cases = [];
+
+  // Many small quoted fields with escaped quotes.
+  {
+    const unit = '"ab""cd",';
+    const s = unit.repeat(Math.ceil(KB100 / unit.length));
+    cases.push([s, (out) => out.length === Math.ceil(KB100 / unit.length) + 1]);
+  }
+  // One huge unquoted field.
+  cases.push(["x".repeat(KB100), (out) => out.length === 1 && out[0].length === KB100]);
+  // One huge quoted field.
+  cases.push(['"' + "x".repeat(KB100) + '"', (out) => out.length === 1 && out[0].length === KB100]);
+  // Nothing but escaped quotes.
+  cases.push(['"' + '""'.repeat(KB100 / 2) + '"', (out) => out.length === 1 && out[0] === '"'.repeat(KB100 / 2)]);
+  // Nothing but commas.
+  cases.push([",".repeat(KB100), (out) => out.length === KB100 + 1]);
+  // Line breaks inside quotes.
+  cases.push(['"' + "\r\n".repeat(KB100 / 2) + '"', (out) => out.length === 1]);
+  // Errors must be fast too.
+  cases.push(['"' + "x".repeat(KB100), null]);
+  cases.push(["x".repeat(KB100) + '"', null]);
+  cases.push(["x".repeat(KB100) + "\r", null]);
+  cases.push(['"' + '""'.repeat(KB100 / 2), null]);
+
+  for (const [input, check] of cases) {
+    const t0 = performance.now();
+    let result;
+    let error;
+    try {
+      result = parseCsvLine(input);
+    } catch (e) {
+      error = e;
+    }
+    const ms = performance.now() - t0;
+    assert.ok(ms < 1000, `took ${ms.toFixed(1)} ms for ${input.length} chars`);
+    if (check) {
+      assert.equal(error, undefined);
+      assert.ok(check(result), "unexpected result shape");
+    } else {
+      assert.ok(error instanceof CsvError, "expected a CsvError");
+    }
+  }
+});
+
+// Contract: "For every string `text`, `parseCsvLine` either returns the fields
+// as an array of strings, or throws `CsvError` ... It never throws anything
+// else, never hangs".
+test("contract: any string yields an array of strings or a CsvError", () => {
+  // Small deterministic LCG so failures are reproducible.
+  let seed = 0x2f6e2b1;
+  const rand = (n) => {
+    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
+    return seed % n;
+  };
+  const alphabet = ['"', ",", "\n", "\r", " ", "a", "\t", "\u0000", "🙂", "\ud800"];
+  for (let round = 0; round < 20000; round++) {
+    const len = rand(12);
+    let s = "";
+    for (let k = 0; k < len; k++) s += alphabet[rand(alphabet.length)];
+    let out;
+    try {
+      out = parseCsvLine(s);
+    } catch (e) {
+      assert.ok(e instanceof CsvError, `threw ${e?.constructor?.name} for ${JSON.stringify(s)}`);
+      continue;
+    }
+    assert.ok(Array.isArray(out), `not an array for ${JSON.stringify(s)}`);
+    assert.ok(out.length >= 1, `empty array for ${JSON.stringify(s)}`);
+    for (const f of out) {
+      assert.equal(typeof f, "string", `non-string field for ${JSON.stringify(s)}`);
+    }
+  }
 });
```

## Candidate S

```diff
diff --git a/src/csv.mjs b/src/csv.mjs
index d5d662e..b2ad327 100644
--- a/src/csv.mjs
+++ b/src/csv.mjs
@@ -5,30 +5,82 @@ export class CsvError extends Error {
   }
 }
 
+const QUOTE = 0x22; // "
+const COMMA = 0x2c; // ,
+const LF = 0x0a; // \n
+const CR = 0x0d; // \r
+
 /**
- * Parses one CSV record into its fields (README.md). Handles the plain and the
- * quoted case; the rest of the contract is not enforced yet.
+ * Parses one CSV record into its fields, per the contract in README.md.
+ *
+ * For any string input this returns an array of strings or throws CsvError;
+ * nothing else is ever thrown. Non-string input throws TypeError.
+ *
+ * The scan is index based and single pass (no recursion, no repeated
+ * slicing of the remainder), so a 100 KB record parses in linear time.
+ *
+ * Exactly one record terminator (`\n` or `\r\n`) at the very end of the text
+ * is removed before parsing. Everything else is then parsed literally, so an
+ * unterminated quote whose last character was that newline is still an
+ * unterminated quote, and a `\n` that sits inside a quoted field is kept.
+ *
  * @param {string} text
  * @returns {string[]}
  */
 export function parseCsvLine(text) {
-  if (typeof text !== "string") throw new TypeError("parseCsvLine: text must be a string");
+  if (typeof text !== "string") {
+    throw new TypeError("parseCsvLine: text must be a string");
+  }
+
+  // Strip one trailing record terminator: "\n" or "\r\n".
+  let end = text.length;
+  if (end > 0 && text.charCodeAt(end - 1) === LF) {
+    end -= 1;
+    if (end > 0 && text.charCodeAt(end - 1) === CR) end -= 1;
+  }
+
   const fields = [];
-  let field = "";
-  let quoted = false;
-  let rest = text;
-  while (rest.length > 0) {
-    const ch = rest[0];
-    rest = rest.slice(1);
-    if (ch === '"') {
-      quoted = !quoted;
-    } else if (ch === "," && !quoted) {
-      fields.push(field);
-      field = "";
+  let i = 0;
+
+  for (;;) {
+    if (i < end && text.charCodeAt(i) === QUOTE) {
+      // Quoted field. Collect runs between quotes; `""` is one literal `"`.
+      let j = i + 1;
+      let value = "";
+      for (;;) {
+        const q = text.indexOf('"', j);
+        if (q === -1 || q >= end) {
+          throw new CsvError("unterminated quoted field");
+        }
+        value += text.slice(j, q);
+        if (q + 1 < end && text.charCodeAt(q + 1) === QUOTE) {
+          value += '"';
+          j = q + 2;
+        } else {
+          j = q + 1;
+          break;
+        }
+      }
+      fields.push(value);
+      i = j;
+      if (i === end) return fields;
+      if (text.charCodeAt(i) !== COMMA) {
+        throw new CsvError("unexpected character after closing quote");
+      }
+      i += 1;
     } else {
-      field += ch;
+      // Unquoted field: runs to the next comma or the end of the text.
+      let j = i;
+      while (j < end) {
+        const c = text.charCodeAt(j);
+        if (c === COMMA) break;
+        if (c === QUOTE) throw new CsvError('unexpected " in unquoted field');
+        if (c === LF || c === CR) throw new CsvError("unexpected line break in record");
+        j += 1;
+      }
+      fields.push(text.slice(i, j));
+      if (j === end) return fields;
+      i = j + 1;
     }
   }
-  fields.push(field);
-  return fields;
 }
diff --git a/tests/csv.test.mjs b/tests/csv.test.mjs
index 816adc6..06ea517 100644
--- a/tests/csv.test.mjs
+++ b/tests/csv.test.mjs
@@ -3,20 +3,595 @@ import { test } from "node:test";
 
 import { CsvError, parseCsvLine } from "../src/csv.mjs";
 
+const csvError = (t) => assert.throws(() => parseCsvLine(t), CsvError);
+const typeError = (t) => assert.throws(() => parseCsvLine(t), TypeError);
+
+// ---------------------------------------------------------------------------
+// Examples from the README
+// ---------------------------------------------------------------------------
+
+test("README examples", () => {
+  assert.deepEqual(parseCsvLine("a,b,c"), ["a", "b", "c"]);
+  assert.deepEqual(parseCsvLine('"x, y",z'), ["x, y", "z"]);
+  assert.deepEqual(parseCsvLine('"say ""hi""",'), ['say "hi"', ""]);
+});
+
+// ---------------------------------------------------------------------------
+// Contract: fields are separated by `,`; empty text is [""]; `a,` is ["a",""]
+// ---------------------------------------------------------------------------
+
 test("plain fields", () => {
   assert.deepEqual(parseCsvLine("a,b,c"), ["a", "b", "c"]);
-  assert.deepEqual(parseCsvLine("a,"), ["a", ""]);
+  assert.deepEqual(parseCsvLine("abc"), ["abc"]);
+});
+
+test("empty text is one empty field", () => {
   assert.deepEqual(parseCsvLine(""), [""]);
 });
 
+test("trailing comma yields a trailing empty field", () => {
+  assert.deepEqual(parseCsvLine("a,"), ["a", ""]);
+});
+
+test("leading comma yields a leading empty field", () => {
+  assert.deepEqual(parseCsvLine(",a"), ["", "a"]);
+});
+
+test("only commas yield only empty fields", () => {
+  assert.deepEqual(parseCsvLine(","), ["", ""]);
+  assert.deepEqual(parseCsvLine(",,"), ["", "", ""]);
+  assert.deepEqual(parseCsvLine("a,,b"), ["a", "", "b"]);
+});
+
+// ---------------------------------------------------------------------------
+// Contract: quoted fields; `""` is one `"`; commas, \n and \r\n are literal
+// ---------------------------------------------------------------------------
+
+test("quoted field", () => {
+  assert.deepEqual(parseCsvLine('"a"'), ["a"]);
+  assert.deepEqual(parseCsvLine('"a","b"'), ["a", "b"]);
+  assert.deepEqual(parseCsvLine('"a",b,"c"'), ["a", "b", "c"]);
+});
+
 test("quoted fields keep commas", () => {
   assert.deepEqual(parseCsvLine('"x, y",z'), ["x, y", "z"]);
+  assert.deepEqual(parseCsvLine('","'), [","]);
+  assert.deepEqual(parseCsvLine('",",","'), [",", ","]);
+});
+
+test("doubled quote inside quotes is one quote", () => {
+  assert.deepEqual(parseCsvLine('"a""b"'), ['a"b']);
+  assert.deepEqual(parseCsvLine('""""'), ['"']);
+  assert.deepEqual(parseCsvLine('""""""'), ['""']);
+  assert.deepEqual(parseCsvLine('"""a"'), ['"a']);
+  assert.deepEqual(parseCsvLine('"a"""'), ['a"']);
+  assert.deepEqual(parseCsvLine('"""",""""'), ['"', '"']);
+});
+
+test("empty quoted field is an empty string", () => {
+  assert.deepEqual(parseCsvLine('""'), [""]);
+  assert.deepEqual(parseCsvLine('"",'), ["", ""]);
+  assert.deepEqual(parseCsvLine(',""'), ["", ""]);
+  assert.deepEqual(parseCsvLine('"",""'), ["", ""]);
+  assert.deepEqual(parseCsvLine('"",a,""'), ["", "a", ""]);
+});
+
+test("newline inside quotes is literal", () => {
+  assert.deepEqual(parseCsvLine('"a\nb"'), ["a\nb"]);
+  assert.deepEqual(parseCsvLine('"a\n"'), ["a\n"]);
+  assert.deepEqual(parseCsvLine('"\n"'), ["\n"]);
+  assert.deepEqual(parseCsvLine('"\n\n\n"'), ["\n\n\n"]);
+});
+
+test("CRLF inside quotes is literal", () => {
+  assert.deepEqual(parseCsvLine('"a\r\nb"'), ["a\r\nb"]);
+  assert.deepEqual(parseCsvLine('"a\r\n"'), ["a\r\n"]);
+  assert.deepEqual(parseCsvLine('"\r\n"'), ["\r\n"]);
+});
+
+test("bare CR inside quotes is literal", () => {
+  assert.deepEqual(parseCsvLine('"a\rb"'), ["a\rb"]);
+  assert.deepEqual(parseCsvLine('"\r"'), ["\r"]);
+});
+
+test("quoted field followed by a trailing terminator", () => {
+  assert.deepEqual(parseCsvLine('"a"\n'), ["a"]);
+  assert.deepEqual(parseCsvLine('"a"\r\n'), ["a"]);
+  assert.deepEqual(parseCsvLine('"a\n"\n'), ["a\n"]);
+  assert.deepEqual(parseCsvLine('"a\r\n"\r\n'), ["a\r\n"]);
+  assert.deepEqual(parseCsvLine('""\n'), [""]);
+});
+
+// ---------------------------------------------------------------------------
+// Contract: after a closing quote only `,`, the terminator or end may follow
+// ---------------------------------------------------------------------------
+
+test("stray character after closing quote is a CsvError", () => {
+  csvError('"a"b');
+  csvError('"a" ');
+  csvError('"a"\t');
+  csvError('"a" ,b');
+  csvError('"a"b,c');
+  csvError('x,"a"b');
+  csvError('"a""');
+  csvError('"a"""b');
+  csvError('"" ');
+  csvError('""x');
+  csvError('"a"\u0000');
+});
+
+test("closing quote followed by an unquoted newline is a CsvError", () => {
+  csvError('"a"\r');
+  csvError('"a"\n\n');
+  csvError('"a"\r\r\n');
+  csvError('"a"\n,b');
+  csvError('"a"\r\n,b');
+});
+
+test("unterminated quoted field is a CsvError", () => {
+  csvError('"');
+  csvError('"a');
+  csvError('"a,b');
+  csvError('a,"b');
+  csvError('"a""');
+  csvError('"""');
+  csvError('"a"",');
+  csvError('"a\n');
+  csvError('"a\r\n');
+  csvError('"\n');
+  csvError('"\r\n');
+  csvError('",');
+  csvError('"a,"b');
+});
+
+// ---------------------------------------------------------------------------
+// Contract: outside quotes a `"` anywhere is a CsvError
+// ---------------------------------------------------------------------------
+
+test("quote in the middle of an unquoted field is a CsvError", () => {
+  csvError('a"b');
+  csvError('a"');
+  csvError('a""');
+  csvError('a"b"');
+  csvError('a""b');
+  csvError('ab"');
+  csvError('a,b"c');
+  csvError('a,b"');
+});
+
+test("quote after leading whitespace is a CsvError", () => {
+  csvError('a "b"');
+  csvError(' "a"');
+  csvError(' "a",b');
+  csvError('a, "b"');
+  csvError('\t"a"');
+});
+
+// ---------------------------------------------------------------------------
+// Contract: whitespace outside quotes is part of the field
+// ---------------------------------------------------------------------------
+
+test("whitespace is preserved", () => {
+  assert.deepEqual(parseCsvLine(" a "), [" a "]);
+  assert.deepEqual(parseCsvLine(" "), [" "]);
+  assert.deepEqual(parseCsvLine("  "), ["  "]);
+  assert.deepEqual(parseCsvLine("a , b"), ["a ", " b"]);
+  assert.deepEqual(parseCsvLine(" , "), [" ", " "]);
+  assert.deepEqual(parseCsvLine("\ta\t"), ["\ta\t"]);
+  assert.deepEqual(parseCsvLine('" a "'), [" a "]);
+  assert.deepEqual(parseCsvLine(" a "), [" a "]);
+  assert.deepEqual(parseCsvLine("　"), ["　"]);
+});
+
+// ---------------------------------------------------------------------------
+// Contract: one terminator (\n or \r\n) at the very end is removed
+// ---------------------------------------------------------------------------
+
+test("one trailing LF is removed", () => {
+  assert.deepEqual(parseCsvLine("a\n"), ["a"]);
+  assert.deepEqual(parseCsvLine("a,b\n"), ["a", "b"]);
+  assert.deepEqual(parseCsvLine("a,\n"), ["a", ""]);
+  assert.deepEqual(parseCsvLine("\n"), [""]);
+});
+
+test("one trailing CRLF is removed", () => {
+  assert.deepEqual(parseCsvLine("a\r\n"), ["a"]);
+  assert.deepEqual(parseCsvLine("a,b\r\n"), ["a", "b"]);
+  assert.deepEqual(parseCsvLine("a,\r\n"), ["a", ""]);
+  assert.deepEqual(parseCsvLine("\r\n"), [""]);
+});
+
+test("bare trailing CR is a CsvError", () => {
+  csvError("\r");
+  csvError("a\r");
+  csvError("a,b\r");
+  csvError('"a"\r');
+});
+
+test("more than one trailing terminator is a CsvError", () => {
+  csvError("\n\n");
+  csvError("a\n\n");
+  csvError("\r\n\r\n");
+  csvError("a\r\n\r\n");
+  csvError("a\n\r\n");
+  csvError("a\r\n\n");
+  csvError("\r\r\n");
+  csvError("a\r\r\n");
+  csvError("a\n\r");
+});
+
+test("unquoted LF elsewhere is a CsvError", () => {
+  csvError("a\nb");
+  csvError("\na");
+  csvError("a,\nb");
+  csvError("a\n,b");
+  csvError("a\n,b\n");
+});
+
+test("unquoted CR elsewhere is a CsvError", () => {
+  csvError("a\rb");
+  csvError("\ra");
+  csvError("a\r\nb");
+  csvError("\r\na");
+  csvError("a,\rb");
+  csvError("a\r,b\n");
+});
+
+// ---------------------------------------------------------------------------
+// Contract: every other character is literal
+// ---------------------------------------------------------------------------
+
+test("tabs are literal", () => {
+  assert.deepEqual(parseCsvLine("a\tb"), ["a\tb"]);
+  assert.deepEqual(parseCsvLine("\t"), ["\t"]);
+  assert.deepEqual(parseCsvLine("\t,\t"), ["\t", "\t"]);
+});
+
+test("control characters are literal", () => {
+  assert.deepEqual(parseCsvLine("a\u0000b"), ["a\u0000b"]);
+  assert.deepEqual(parseCsvLine("\u0000"), ["\u0000"]);
+  assert.deepEqual(parseCsvLine("\u0000,\u0000"), ["\u0000", "\u0000"]);
+  assert.deepEqual(parseCsvLine("a\u0001\u001f\u007fb"), ["a\u0001\u001f\u007fb"]);
+  assert.deepEqual(parseCsvLine("\u000b\u000c"), ["\u000b\u000c"]); // VT, FF
+  assert.deepEqual(parseCsvLine("\u0085"), ["\u0085"]); // NEL is not a terminator
+  assert.deepEqual(parseCsvLine("  "), ["  "]); // LS/PS either
+  assert.deepEqual(parseCsvLine('"\u0000"'), ["\u0000"]);
+  assert.deepEqual(parseCsvLine("\u001b[0m"), ["\u001b[0m"]);
 });
 
-test("non-string input", () => {
-  assert.throws(() => parseCsvLine(null), TypeError);
+test("Unicode is literal", () => {
+  assert.deepEqual(parseCsvLine("héllo,wörld"), ["héllo", "wörld"]);
+  assert.deepEqual(parseCsvLine("日本,語"), ["日本", "語"]);
+  assert.deepEqual(parseCsvLine("﻿a"), ["﻿a"]); // BOM is kept
+  assert.deepEqual(parseCsvLine("“a”"), ["“a”"]); // curly quotes are not quotes
+  assert.deepEqual(parseCsvLine("a，b"), ["a，b"]); // fullwidth comma is not a separator
+  assert.deepEqual(parseCsvLine("é"), ["é"]); // combining mark
 });
 
+test("surrogate pairs are literal", () => {
+  assert.deepEqual(parseCsvLine("😀,🎉"), ["😀", "🎉"]);
+  assert.deepEqual(parseCsvLine('"😀,🎉"'), ["😀,🎉"]);
+  assert.deepEqual(parseCsvLine("😀"), ["😀"]);
+});
+
+test("lone surrogates are literal", () => {
+  assert.deepEqual(parseCsvLine("\ud83d"), ["\ud83d"]);
+  assert.deepEqual(parseCsvLine("\ude00"), ["\ude00"]);
+  assert.deepEqual(parseCsvLine("\ud83d,\ude00"), ["\ud83d", "\ude00"]);
+  assert.deepEqual(parseCsvLine('"\ud83d"'), ["\ud83d"]);
+  assert.deepEqual(parseCsvLine("a\ud83d\n"), ["a\ud83d"]);
+});
+
+// ---------------------------------------------------------------------------
+// Contract: non-string input throws TypeError
+// ---------------------------------------------------------------------------
+
+test("non-string input throws TypeError", () => {
+  typeError(null);
+  typeError(undefined);
+  typeError();
+  typeError(0);
+  typeError(1);
+  typeError(NaN);
+  typeError(true);
+  typeError(false);
+  typeError(Symbol("s"));
+  typeError(10n);
+  typeError({});
+  typeError([]);
+  typeError(["a,b"]);
+  typeError(() => "a,b");
+  typeError(new String("a,b"));
+  typeError(Object("a"));
+  typeError({ toString: () => "a,b" });
+  typeError({ [Symbol.toPrimitive]: () => "a,b" });
+  typeError(Buffer.from("a,b"));
+  typeError(new Uint8Array([97]));
+  typeError(new Date());
+  typeError(/a,b/);
+  typeError(Object.create(null));
+});
+
+test("TypeError on non-string is not a CsvError", () => {
+  assert.throws(() => parseCsvLine(42), (e) => e instanceof TypeError && !(e instanceof CsvError));
+});
+
+// ---------------------------------------------------------------------------
+// CsvError shape
+// ---------------------------------------------------------------------------
+
 test("CsvError is an Error", () => {
-  assert.ok(new CsvError("x") instanceof Error);
+  const e = new CsvError("x");
+  assert.ok(e instanceof Error);
+  assert.ok(e instanceof CsvError);
+  assert.equal(e.name, "CsvError");
+  assert.equal(e.message, "x");
+});
+
+test("thrown CsvError carries a message and a name", () => {
+  try {
+    parseCsvLine('"');
+    assert.fail("expected a throw");
+  } catch (e) {
+    assert.ok(e instanceof CsvError);
+    assert.equal(e.name, "CsvError");
+    assert.equal(typeof e.message, "string");
+    assert.ok(e.message.length > 0);
+  }
+});
+
+// ---------------------------------------------------------------------------
+// Result shape
+// ---------------------------------------------------------------------------
+
+test("result is a fresh array of primitive strings", () => {
+  const a = parseCsvLine("a,b");
+  const b = parseCsvLine("a,b");
+  assert.ok(Array.isArray(a));
+  assert.notEqual(a, b);
+  for (const f of a) assert.equal(typeof f, "string");
+});
+
+test("parser has no state between calls", () => {
+  csvError('"a');
+  assert.deepEqual(parseCsvLine("a,b"), ["a", "b"]);
+  csvError('a"');
+  assert.deepEqual(parseCsvLine('"a"'), ["a"]);
+});
+
+// ---------------------------------------------------------------------------
+// Performance: 100 KB records must return well within a second
+// ---------------------------------------------------------------------------
+
+const KB100 = 100 * 1024;
+
+function timed(fn) {
+  const t0 = performance.now();
+  const r = fn();
+  return { r, ms: performance.now() - t0 };
+}
+
+function assertFast(text, check) {
+  const { r, ms } = timed(() => {
+    try {
+      return { ok: parseCsvLine(text) };
+    } catch (e) {
+      return { err: e };
+    }
+  });
+  assert.ok(ms < 500, `took ${ms.toFixed(1)} ms`);
+  check(r);
+}
+
+test("perf: 100 KB single unquoted field", () => {
+  const text = "x".repeat(KB100);
+  assertFast(text, (r) => assert.deepEqual(r.ok, [text]));
+});
+
+test("perf: 100 KB of commas", () => {
+  const text = ",".repeat(KB100);
+  assertFast(text, (r) => {
+    assert.equal(r.ok.length, KB100 + 1);
+    assert.ok(r.ok.every((f) => f === ""));
+  });
+});
+
+test("perf: 100 KB of tiny fields", () => {
+  const text = "a,".repeat(KB100 / 2);
+  assertFast(text, (r) => {
+    assert.equal(r.ok.length, KB100 / 2 + 1);
+    assert.equal(r.ok[0], "a");
+    assert.equal(r.ok[r.ok.length - 1], "");
+  });
+});
+
+test("perf: 100 KB of quote characters (even count)", () => {
+  const text = '"'.repeat(KB100); // opens, then 51199 escaped pairs, then closes
+  assertFast(text, (r) => assert.deepEqual(r.ok, ['"'.repeat((KB100 - 2) / 2)]));
+});
+
+test("perf: 100 KB of quote characters (odd count)", () => {
+  const text = '"'.repeat(KB100 + 1);
+  assertFast(text, (r) => assert.ok(r.err instanceof CsvError));
+});
+
+test("perf: one huge quoted field", () => {
+  const inner = "y".repeat(KB100);
+  assertFast(`"${inner}"`, (r) => assert.deepEqual(r.ok, [inner]));
+});
+
+test("perf: huge quoted field full of escaped quotes", () => {
+  const n = Math.floor(KB100 / 3);
+  const text = '"' + 'a""'.repeat(n) + '"';
+  assertFast(text, (r) => assert.deepEqual(r.ok, ['a"'.repeat(n)]));
+});
+
+test("perf: many small quoted fields", () => {
+  const text = '"a",'.repeat(KB100 / 4);
+  assertFast(text, (r) => assert.equal(r.ok.length, KB100 / 4 + 1));
+});
+
+test("perf: many empty quoted fields", () => {
+  const n = Math.floor(KB100 / 3);
+  const text = '"",'.repeat(n);
+  assertFast(text, (r) => {
+    assert.equal(r.ok.length, n + 1);
+    assert.ok(r.ok.every((f) => f === ""));
+  });
+});
+
+test("perf: 100 KB unterminated quote", () => {
+  const text = '"' + "z".repeat(KB100);
+  assertFast(text, (r) => assert.ok(r.err instanceof CsvError));
+});
+
+test("perf: 100 KB with error at the very end", () => {
+  const text = "z".repeat(KB100) + '"';
+  assertFast(text, (r) => assert.ok(r.err instanceof CsvError));
+});
+
+test("perf: 100 KB of newlines inside quotes", () => {
+  const inner = "\n".repeat(KB100);
+  assertFast(`"${inner}"`, (r) => assert.deepEqual(r.ok, [inner]));
+});
+
+test("perf: 100 KB of CRLF inside quotes", () => {
+  const inner = "\r\n".repeat(KB100 / 2);
+  assertFast(`"${inner}"`, (r) => assert.deepEqual(r.ok, [inner]));
+});
+
+test("perf: 100 KB of unquoted newlines", () => {
+  assertFast("\n".repeat(KB100), (r) => assert.ok(r.err instanceof CsvError));
+});
+
+test("perf: 100 KB of surrogate pairs", () => {
+  const text = "😀".repeat(KB100 / 2);
+  assertFast(text, (r) => assert.deepEqual(r.ok, [text]));
+});
+
+test("perf: 1 MB record still returns quickly", () => {
+  const text = 'a,"b,c",d\n'.repeat(1024 * 100);
+  assertFast(text, (r) => assert.ok(r.err instanceof CsvError));
+  const one = "a,b,".repeat(256 * 1024);
+  assertFast(one, (r) => assert.equal(r.ok.length, 512 * 1024 + 1));
+});
+
+// ---------------------------------------------------------------------------
+// Differential fuzz: compare against an independent char-by-char reference
+// ---------------------------------------------------------------------------
+
+// A deliberately naive reference parser written from the README, state machine
+// style, so it shares no code or structure with the implementation.
+function referenceParse(text) {
+  let s = text;
+  if (s.endsWith("\r\n")) s = s.slice(0, -2);
+  else if (s.endsWith("\n")) s = s.slice(0, -1);
+
+  const fields = [];
+  let field = "";
+  let state = "start"; // start | unquoted | quoted | afterQuote
+  for (const ch of Array.from(s)) {
+    // iterate by UTF-16 code unit to match the implementation exactly
+    for (let k = 0; k < ch.length; k++) {
+      const c = ch[k];
+      switch (state) {
+        case "start":
+          if (c === '"') state = "quoted";
+          else if (c === ",") fields.push(field);
+          else if (c === "\n" || c === "\r") throw new CsvError("ref: newline");
+          else {
+            field += c;
+            state = "unquoted";
+          }
+          break;
+        case "unquoted":
+          if (c === '"') throw new CsvError("ref: quote");
+          else if (c === "\n" || c === "\r") throw new CsvError("ref: newline");
+          else if (c === ",") {
+            fields.push(field);
+            field = "";
+            state = "start";
+          } else field += c;
+          break;
+        case "quoted":
+          if (c === '"') state = "afterQuote";
+          else field += c;
+          break;
+        case "afterQuote":
+          if (c === '"') {
+            field += '"';
+            state = "quoted";
+          } else if (c === ",") {
+            fields.push(field);
+            field = "";
+            state = "start";
+          } else throw new CsvError("ref: after quote");
+          break;
+      }
+    }
+  }
+  if (state === "quoted") throw new CsvError("ref: unterminated");
+  fields.push(field);
+  return fields;
+}
+
+function outcome(fn, text) {
+  try {
+    return { ok: fn(text) };
+  } catch (e) {
+    if (e instanceof CsvError) return { err: "CsvError" };
+    throw e;
+  }
+}
+
+function makeRng(seed) {
+  let s = seed >>> 0;
+  return () => {
+    s = (s + 0x6d2b79f5) >>> 0;
+    let t = s;
+    t = Math.imul(t ^ (t >>> 15), t | 1);
+    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
+    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
+  };
+}
+
+const ALPHABET = ['"', ",", "\n", "\r", "a", "b", " ", "\t", "\u0000", "é", "😀", "\ud83d", "\ude00"];
+
+test("fuzz: implementation matches reference on random inputs", () => {
+  const rnd = makeRng(20260921);
+  for (let n = 0; n < 20000; n++) {
+    const len = Math.floor(rnd() * 12);
+    let text = "";
+    for (let k = 0; k < len; k++) text += ALPHABET[Math.floor(rnd() * ALPHABET.length)];
+    assert.deepEqual(outcome(parseCsvLine, text), outcome(referenceParse, text), JSON.stringify(text));
+  }
+});
+
+test("exhaustive: all strings up to length 6 over the core alphabet match the reference", () => {
+  const core = ['"', ",", "\n", "\r", "a"];
+  let count = 0;
+  const walk = (prefix, depth) => {
+    assert.deepEqual(outcome(parseCsvLine, prefix), outcome(referenceParse, prefix), JSON.stringify(prefix));
+    count++;
+    if (depth === 0) return;
+    for (const c of core) walk(prefix + c, depth - 1);
+  };
+  walk("", 6);
+  assert.equal(count, (5 ** 7 - 1) / 4); // 1 + 5 + 25 + ... + 5^6
+});
+
+test("fuzz: only string[] or CsvError ever comes out", () => {
+  const rnd = makeRng(7);
+  for (let n = 0; n < 5000; n++) {
+    const len = Math.floor(rnd() * 64);
+    let text = "";
+    for (let k = 0; k < len; k++) text += String.fromCharCode(Math.floor(rnd() * 0x10000));
+    try {
+      const r = parseCsvLine(text);
+      assert.ok(Array.isArray(r));
+      for (const f of r) assert.equal(typeof f, "string");
+    } catch (e) {
+      assert.ok(e instanceof CsvError, `threw ${e && e.constructor && e.constructor.name}`);
+    }
+  }
 });
```

## Candidate L

```diff
diff --git a/src/csv.mjs b/src/csv.mjs
index d5d662e..a1660d3 100644
--- a/src/csv.mjs
+++ b/src/csv.mjs
@@ -6,29 +6,83 @@ export class CsvError extends Error {
 }
 
 /**
- * Parses one CSV record into its fields (README.md). Handles the plain and the
- * quoted case; the rest of the contract is not enforced yet.
+ * Parses one CSV record into its fields (README.md).
+ *
+ * For every string input this returns an array of strings or throws CsvError;
+ * for anything that is not a string it throws TypeError. The scan is a single
+ * left-to-right pass over UTF-16 code units, so it is linear in the length of
+ * the text and has no recursion.
+ *
  * @param {string} text
  * @returns {string[]}
  */
 export function parseCsvLine(text) {
   if (typeof text !== "string") throw new TypeError("parseCsvLine: text must be a string");
+
+  // One record terminator (\n or \r\n) at the very end is removed. Any \r or
+  // \n that survives this and sits outside quotes is an error below.
+  let end = text.length;
+  if (end > 0 && text.charCodeAt(end - 1) === 0x0a) {
+    end -= 1;
+    if (end > 0 && text.charCodeAt(end - 1) === 0x0d) end -= 1;
+  }
+
   const fields = [];
   let field = "";
-  let quoted = false;
-  let rest = text;
-  while (rest.length > 0) {
-    const ch = rest[0];
-    rest = rest.slice(1);
-    if (ch === '"') {
-      quoted = !quoted;
-    } else if (ch === "," && !quoted) {
-      fields.push(field);
-      field = "";
+  let i = 0;
+
+  // Each iteration of the outer loop parses exactly one field and then either
+  // consumes the comma that follows it or reaches the end of the record.
+  for (;;) {
+    if (i < end && text.charCodeAt(i) === 0x22 /* " */) {
+      // Quoted field: everything up to the closing quote is literal, and "" is
+      // an escaped quote.
+      i += 1;
+      let start = i;
+      let closed = false;
+      while (i < end) {
+        const idx = text.indexOf('"', i);
+        if (idx === -1 || idx >= end) break;
+        field += text.slice(start, idx);
+        if (idx + 1 < end && text.charCodeAt(idx + 1) === 0x22) {
+          field += '"';
+          i = idx + 2;
+          start = i;
+        } else {
+          i = idx + 1;
+          closed = true;
+          break;
+        }
+      }
+      if (!closed) {
+        throw new CsvError(`unterminated quoted field starting at offset ${start - 1}`);
+      }
+      // After a closing quote only a comma or the end of the record may follow
+      // (the record terminator has already been stripped).
+      if (i < end && text.charCodeAt(i) !== 0x2c /* , */) {
+        throw new CsvError(`unexpected character after closing quote at offset ${i}`);
+      }
     } else {
-      field += ch;
+      // Unquoted field: runs to the next comma. Quotes, \r and \n are errors.
+      const start = i;
+      while (i < end) {
+        const c = text.charCodeAt(i);
+        if (c === 0x2c) break;
+        if (c === 0x22) throw new CsvError(`quote inside unquoted field at offset ${i}`);
+        if (c === 0x0a || c === 0x0d) {
+          throw new CsvError(`line break outside quotes at offset ${i}`);
+        }
+        i += 1;
+      }
+      field = text.slice(start, i);
     }
+
+    fields.push(field);
+    field = "";
+
+    if (i >= end) return fields;
+    // text[i] is a comma: consume it and parse the next field (which may be
+    // empty, e.g. "a," -> ["a", ""]).
+    i += 1;
   }
-  fields.push(field);
-  return fields;
 }
diff --git a/tests/csv.test.mjs b/tests/csv.test.mjs
index 816adc6..23971ef 100644
--- a/tests/csv.test.mjs
+++ b/tests/csv.test.mjs
@@ -3,20 +3,272 @@ import { test } from "node:test";
 
 import { CsvError, parseCsvLine } from "../src/csv.mjs";
 
-test("plain fields", () => {
+const csvError = (fn) => assert.throws(fn, CsvError);
+
+// --- README examples ---------------------------------------------------------
+
+test("README examples", () => {
   assert.deepEqual(parseCsvLine("a,b,c"), ["a", "b", "c"]);
-  assert.deepEqual(parseCsvLine("a,"), ["a", ""]);
+  assert.deepEqual(parseCsvLine('"x, y",z'), ["x, y", "z"]);
+  assert.deepEqual(parseCsvLine('"say ""hi""",'), ['say "hi"', ""]);
+});
+
+// --- Types ------------------------------------------------------------------
+
+test("anything that is not a string throws a TypeError", () => {
+  for (const bad of [null, undefined, 1, 0, NaN, true, {}, [], ["a,b"], new String("a,b"), Symbol("s"), () => "a", 10n]) {
+    assert.throws(() => parseCsvLine(bad), TypeError);
+  }
+});
+
+test("CsvError is an exported subclass of Error", () => {
+  const err = new CsvError("x");
+  assert.ok(err instanceof CsvError);
+  assert.ok(err instanceof Error);
+  assert.equal(err.name, "CsvError");
+  assert.equal(err.message, "x");
+});
+
+// --- Rule: fields are separated by `,`; empty text and trailing comma --------
+
+test("fields are separated by commas", () => {
+  assert.deepEqual(parseCsvLine("a,b,c"), ["a", "b", "c"]);
+  assert.deepEqual(parseCsvLine(","), ["", ""]);
+  assert.deepEqual(parseCsvLine(",,"), ["", "", ""]);
+  assert.deepEqual(parseCsvLine(",a"), ["", "a"]);
+  assert.deepEqual(parseCsvLine("a,,b"), ["a", "", "b"]);
+});
+
+test("the empty text is one empty field; `a,` is [a, empty]", () => {
   assert.deepEqual(parseCsvLine(""), [""]);
+  assert.deepEqual(parseCsvLine("a,"), ["a", ""]);
+  assert.deepEqual(parseCsvLine('"a",'), ["a", ""]);
 });
 
-test("quoted fields keep commas", () => {
-  assert.deepEqual(parseCsvLine('"x, y",z'), ["x, y", "z"]);
+// --- Rule: quoted fields ----------------------------------------------------
+
+test("a field may be wrapped in double quotes", () => {
+  assert.deepEqual(parseCsvLine('"a"'), ["a"]);
+  assert.deepEqual(parseCsvLine('""'), [""]);
+  assert.deepEqual(parseCsvLine('"",""'), ["", ""]);
+  assert.deepEqual(parseCsvLine('"a","b",c'), ["a", "b", "c"]);
+  assert.deepEqual(parseCsvLine('a,"b"'), ["a", "b"]);
+});
+
+test('inside quotes, "" is one "', () => {
+  assert.deepEqual(parseCsvLine('""""'), ['"']);
+  assert.deepEqual(parseCsvLine('""""""'), ['""']);
+  assert.deepEqual(parseCsvLine('"a""b"'), ['a"b']);
+  assert.deepEqual(parseCsvLine('"""a"""'), ['"a"']);
+  assert.deepEqual(parseCsvLine('"a""",b'), ['a"', "b"]);
+  assert.deepEqual(parseCsvLine('"""",b'), ['"', "b"]);
+});
+
+test("inside quotes, commas, \\n and \\r\\n are literal characters", () => {
+  assert.deepEqual(parseCsvLine('"a,b"'), ["a,b"]);
+  assert.deepEqual(parseCsvLine('","'), [","]);
+  assert.deepEqual(parseCsvLine('"a\nb"'), ["a\nb"]);
+  assert.deepEqual(parseCsvLine('"a\r\nb"'), ["a\r\nb"]);
+  assert.deepEqual(parseCsvLine('"\n"'), ["\n"]);
+  assert.deepEqual(parseCsvLine('"\r\n"'), ["\r\n"]);
+  assert.deepEqual(parseCsvLine('"a\n",b'), ["a\n", "b"]);
+  // A lone \r is "every other character" and so is literal inside quotes too.
+  assert.deepEqual(parseCsvLine('"a\rb"'), ["a\rb"]);
+  // A quoted field can end in a newline that is not the record terminator.
+  assert.deepEqual(parseCsvLine('"a\n"\n'), ["a\n"]);
+});
+
+// --- Rule: what may follow a closing quote ----------------------------------
+
+test("after a closing quote only a comma, the terminator or the end may follow", () => {
+  assert.deepEqual(parseCsvLine('"a",b'), ["a", "b"]);
+  assert.deepEqual(parseCsvLine('"a"\n'), ["a"]);
+  assert.deepEqual(parseCsvLine('"a"\r\n'), ["a"]);
+  assert.deepEqual(parseCsvLine('"a"'), ["a"]);
+  assert.deepEqual(parseCsvLine('"a","b"\n'), ["a", "b"]);
+
+  csvError(() => parseCsvLine('"a"b'));
+  csvError(() => parseCsvLine('"a" '));
+  csvError(() => parseCsvLine('"a" ,b'));
+  csvError(() => parseCsvLine('"a""b'));
+  csvError(() => parseCsvLine('"a"\r'));
+  csvError(() => parseCsvLine('"a"\n\n'));
+  csvError(() => parseCsvLine('"a"\nb'));
+  csvError(() => parseCsvLine('"a"\t'));
+  csvError(() => parseCsvLine('"a"x,b'));
+  csvError(() => parseCsvLine('"a" "b"'));
+});
+
+test("a quoted field that never closes is a CsvError", () => {
+  csvError(() => parseCsvLine('"'));
+  csvError(() => parseCsvLine('"a'));
+  csvError(() => parseCsvLine('"a,b'));
+  csvError(() => parseCsvLine('a,"b'));
+  csvError(() => parseCsvLine('"a""'));
+  csvError(() => parseCsvLine('"""'));
+  csvError(() => parseCsvLine('"a\n'));
+  csvError(() => parseCsvLine('"a\r\n'));
+  csvError(() => parseCsvLine('"a",'.repeat(3) + '"x'));
+});
+
+// --- Rule: quotes outside quotes -------------------------------------------
+
+test("outside quotes, a quote anywhere is a CsvError", () => {
+  csvError(() => parseCsvLine('a"b'));
+  csvError(() => parseCsvLine('a "b"'));
+  csvError(() => parseCsvLine('a"'));
+  csvError(() => parseCsvLine(' "a"'));
+  csvError(() => parseCsvLine('a,b"'));
+  csvError(() => parseCsvLine('a,b"c,d'));
+  csvError(() => parseCsvLine('a""'));
+  csvError(() => parseCsvLine('a"",b'));
+  csvError(() => parseCsvLine('\t"a"'));
+});
+
+// --- Rule: whitespace outside quotes ---------------------------------------
+
+test("whitespace outside quotes is part of the field", () => {
+  assert.deepEqual(parseCsvLine(" a "), [" a "]);
+  assert.deepEqual(parseCsvLine(" a , b "), [" a ", " b "]);
+  assert.deepEqual(parseCsvLine(" "), [" "]);
+  assert.deepEqual(parseCsvLine("\t"), ["\t"]);
+  assert.deepEqual(parseCsvLine("a\t,\tb"), ["a\t", "\tb"]);
+  assert.deepEqual(parseCsvLine(" a　"), [" a　"]);
+});
+
+// --- Rule: record terminator -----------------------------------------------
+
+test("one terminator (\\n or \\r\\n) at the very end is removed", () => {
+  assert.deepEqual(parseCsvLine("a,b\n"), ["a", "b"]);
+  assert.deepEqual(parseCsvLine("a,b\r\n"), ["a", "b"]);
+  assert.deepEqual(parseCsvLine("\n"), [""]);
+  assert.deepEqual(parseCsvLine("\r\n"), [""]);
+  assert.deepEqual(parseCsvLine("a,\n"), ["a", ""]);
+  assert.deepEqual(parseCsvLine("a,\r\n"), ["a", ""]);
+  assert.deepEqual(parseCsvLine(",\n"), ["", ""]);
+});
+
+test("any other unquoted \\r or \\n is a CsvError", () => {
+  csvError(() => parseCsvLine("\r"));
+  csvError(() => parseCsvLine("a\r"));
+  csvError(() => parseCsvLine("a\rb"));
+  csvError(() => parseCsvLine("a\nb"));
+  csvError(() => parseCsvLine("a\r\nb"));
+  csvError(() => parseCsvLine("\n\n"));
+  csvError(() => parseCsvLine("\r\n\r\n"));
+  csvError(() => parseCsvLine("a\n\r\n"));
+  csvError(() => parseCsvLine("a\r\r\n"));
+  csvError(() => parseCsvLine("\n\r"));
+  csvError(() => parseCsvLine("\r\r"));
+  csvError(() => parseCsvLine("\n\r\n"));
+  csvError(() => parseCsvLine("a\n,b"));
+  csvError(() => parseCsvLine("a,\nb"));
+});
+
+// --- Rule: every other character is literal --------------------------------
+
+test("tabs, control characters and any Unicode are literal characters", () => {
+  assert.deepEqual(parseCsvLine("a\tb"), ["a\tb"]);
+  assert.deepEqual(parseCsvLine("\0"), ["\0"]);
+  assert.deepEqual(parseCsvLine("a\x01\x1f\x7fb"), ["a\x01\x1f\x7fb"]);
+  assert.deepEqual(parseCsvLine("\v\f"), ["\v\f"]);
+  assert.deepEqual(parseCsvLine(" , "), [" ", " "]);
+  assert.deepEqual(parseCsvLine("\u0085"), ["\u0085"]);
+  assert.deepEqual(parseCsvLine("é,ß,漢字"), ["é", "ß", "漢字"]);
+  assert.deepEqual(parseCsvLine("😀,👍🏽"), ["😀", "👍🏽"]);
+  assert.deepEqual(parseCsvLine('"😀,\n",🦄'), ["😀,\n", "🦄"]);
+  // Lone surrogates and other odd code units pass through untouched.
+  assert.deepEqual(parseCsvLine("\ud800,\udfff"), ["\ud800", "\udfff"]);
+  assert.deepEqual(parseCsvLine("﻿a"), ["﻿a"]);
+  assert.deepEqual(parseCsvLine("￿￾"), ["￿￾"]);
+  // Other quote-like characters are not quotes.
+  assert.deepEqual(parseCsvLine("'a',“b”,‘c’,`d`"), ["'a'", "“b”", "‘c’", "`d`"]);
+  // Other separators are not separators.
+  assert.deepEqual(parseCsvLine("a;b\tc|d"), ["a;b\tc|d"]);
+});
+
+// --- Contract: fields or a CsvError, nothing else; within a second at 100 KB -
+
+function onlyFieldsOrCsvError(input) {
+  try {
+    const out = parseCsvLine(input);
+    assert.ok(Array.isArray(out), `expected array for ${JSON.stringify(input)}`);
+    assert.ok(out.length >= 1, `expected at least one field for ${JSON.stringify(input)}`);
+    for (const f of out) assert.equal(typeof f, "string");
+  } catch (err) {
+    if (err instanceof assert.AssertionError) throw err;
+    assert.ok(err instanceof CsvError, `threw ${err?.constructor?.name}: ${err?.message} for ${JSON.stringify(input)}`);
+  }
+}
+
+test("every string gives fields or a CsvError, nothing else (exhaustive short inputs)", () => {
+  const alphabet = ['a', ',', '"', "\n", "\r", " "];
+  let count = 0;
+  for (let len = 0; len <= 6; len += 1) {
+    const total = alphabet.length ** len;
+    for (let n = 0; n < total; n += 1) {
+      let s = "";
+      let m = n;
+      for (let k = 0; k < len; k += 1) {
+        s += alphabet[m % alphabet.length];
+        m = Math.floor(m / alphabet.length);
+      }
+      onlyFieldsOrCsvError(s);
+      count += 1;
+    }
+  }
+  assert.ok(count > 50000);
+});
+
+test("round trip: any array of strings survives quoting and parsing", () => {
+  const quote = (s) => `"${s.replace(/"/g, '""')}"`;
+  const samples = [
+    [""],
+    ["", ""],
+    ["a", "b,c", 'd"e', "f\ng", "h\r\ni", "\r", "\"", '""', "\n", " ", "😀", "\0"],
+    ['"""', ',,,', '"\n"', "\r\n\r\n", "a".repeat(1000)],
+  ];
+  for (const fields of samples) {
+    const line = fields.map(quote).join(",");
+    assert.deepEqual(parseCsvLine(line), fields);
+    assert.deepEqual(parseCsvLine(line + "\n"), fields);
+    assert.deepEqual(parseCsvLine(line + "\r\n"), fields);
+  }
 });
 
-test("non-string input", () => {
-  assert.throws(() => parseCsvLine(null), TypeError);
+test("returns within a second for a 100 KB record", () => {
+  const KB = 1024;
+  const cases = {
+    "many plain fields": Array(20 * KB).fill("abcd").join(",") + ",",
+    "one plain field": "x".repeat(100 * KB),
+    "one quoted field": '"' + "x".repeat(100 * KB) + '"',
+    "all commas": ",".repeat(100 * KB),
+    "many empty quoted fields": Array(34 * KB).fill('""').join(","),
+    "all escaped quotes": '"' + '""'.repeat(50 * KB) + '"',
+    "quoted with newlines": '"' + "a\r\n".repeat(34 * KB) + '"',
+    "unicode": "😀,".repeat(34 * KB),
+    "unterminated quote": '"' + "x".repeat(100 * KB),
+    "unterminated escaped quotes": '"' + '""'.repeat(50 * KB),
+    "late error": "x".repeat(100 * KB) + '"',
+    "late newline": "x".repeat(100 * KB) + "\n\n",
+  };
+  for (const [name, input] of Object.entries(cases)) {
+    assert.ok(input.length >= 100 * KB, `${name} is ${input.length} chars`);
+    const t0 = performance.now();
+    onlyFieldsOrCsvError(input);
+    const ms = performance.now() - t0;
+    assert.ok(ms < 1000, `${name} took ${ms.toFixed(0)} ms`);
+  }
 });
 
-test("CsvError is an Error", () => {
-  assert.ok(new CsvError("x") instanceof Error);
+test("scales linearly: a 10 MB record still returns promptly", () => {
+  const input = Array(1024 * 1024).fill('"a,b"').join(",") + "\r\n";
+  assert.ok(input.length > 6 * 1024 * 1024);
+  const t0 = performance.now();
+  const out = parseCsvLine(input);
+  const ms = performance.now() - t0;
+  assert.equal(out.length, 1024 * 1024);
+  assert.equal(out[0], "a,b");
+  assert.equal(out[out.length - 1], "a,b");
+  assert.ok(ms < 5000, `took ${ms.toFixed(0)} ms`);
 });
```

## Candidate E

```diff
diff --git a/src/csv.mjs b/src/csv.mjs
index d5d662e..5899f02 100644
--- a/src/csv.mjs
+++ b/src/csv.mjs
@@ -1,34 +1,96 @@
+/**
+ * Thrown for every malformed record. The only thing `parseCsvLine` throws for
+ * a string input.
+ */
 export class CsvError extends Error {
-  constructor(message) {
+  /**
+   * @param {string} message
+   * @param {number} position zero-based index into the text where the problem was found
+   */
+  constructor(message, position) {
     super(message);
     this.name = "CsvError";
+    this.position = position;
   }
 }
 
+const QUOTE = 0x22; // "
+const COMMA = 0x2c; // ,
+const LF = 0x0a; // \n
+const CR = 0x0d; // \r
+
 /**
- * Parses one CSV record into its fields (README.md). Handles the plain and the
- * quoted case; the rest of the contract is not enforced yet.
+ * Parses one CSV record into its fields, exactly as specified in README.md.
+ *
+ * For any string input this returns an array of strings or throws `CsvError`;
+ * nothing else is thrown and the scan is a single linear pass over the text.
+ * Anything that is not a primitive string throws a `TypeError`.
+ *
  * @param {string} text
  * @returns {string[]}
  */
 export function parseCsvLine(text) {
-  if (typeof text !== "string") throw new TypeError("parseCsvLine: text must be a string");
+  if (typeof text !== "string") {
+    throw new TypeError("parseCsvLine: text must be a string");
+  }
+
+  // One record terminator (`\n` or `\r\n`) at the very end is removed. A lone
+  // trailing `\r` is not a terminator and is left in place (it becomes an
+  // error below unless it is inside quotes, where it can never be at the end
+  // anyway because the closing quote would follow it).
+  let end = text.length;
+  if (end > 0 && text.charCodeAt(end - 1) === LF) {
+    end -= 1;
+    if (end > 0 && text.charCodeAt(end - 1) === CR) end -= 1;
+  }
+
   const fields = [];
-  let field = "";
-  let quoted = false;
-  let rest = text;
-  while (rest.length > 0) {
-    const ch = rest[0];
-    rest = rest.slice(1);
-    if (ch === '"') {
-      quoted = !quoted;
-    } else if (ch === "," && !quoted) {
+  let i = 0; // start of the current field
+
+  for (;;) {
+    if (i < end && text.charCodeAt(i) === QUOTE) {
+      // Quoted field. Collect runs between quotes; `""` is a literal quote.
+      let field = "";
+      let j = i + 1;
+      for (;;) {
+        const q = text.indexOf('"', j);
+        if (q === -1 || q >= end) {
+          throw new CsvError(`unterminated quoted field starting at ${i}`, i);
+        }
+        field += text.slice(j, q);
+        if (q + 1 < end && text.charCodeAt(q + 1) === QUOTE) {
+          field += '"';
+          j = q + 2;
+          continue;
+        }
+        j = q + 1; // just past the closing quote
+        break;
+      }
       fields.push(field);
-      field = "";
-    } else {
-      field += ch;
+      if (j === end) return fields;
+      if (text.charCodeAt(j) === COMMA) {
+        i = j + 1;
+        continue;
+      }
+      throw new CsvError(`unexpected character after closing quote at ${j}`, j);
+    }
+
+    // Unquoted field: everything up to the next comma or the end, but a `"`,
+    // `\r` or `\n` here is malformed.
+    let j = i;
+    while (j < end) {
+      const c = text.charCodeAt(j);
+      if (c === COMMA) break;
+      if (c === QUOTE) {
+        throw new CsvError(`unexpected quote in unquoted field at ${j}`, j);
+      }
+      if (c === LF || c === CR) {
+        throw new CsvError(`unexpected line break outside quotes at ${j}`, j);
+      }
+      j += 1;
     }
+    fields.push(text.slice(i, j));
+    if (j === end) return fields;
+    i = j + 1; // skip the comma
   }
-  fields.push(field);
-  return fields;
 }
diff --git a/tests/csv.test.mjs b/tests/csv.test.mjs
index 816adc6..3892fcf 100644
--- a/tests/csv.test.mjs
+++ b/tests/csv.test.mjs
@@ -3,20 +3,544 @@ import { test } from "node:test";
 
 import { CsvError, parseCsvLine } from "../src/csv.mjs";
 
-test("plain fields", () => {
+const csvError = (err) =>
+  err instanceof CsvError &&
+  err instanceof Error &&
+  err.name === "CsvError" &&
+  typeof err.message === "string" &&
+  err.message.length > 0 &&
+  Number.isInteger(err.position);
+
+// ---------------------------------------------------------------------------
+// README examples
+// ---------------------------------------------------------------------------
+
+test("README examples", () => {
   assert.deepEqual(parseCsvLine("a,b,c"), ["a", "b", "c"]);
-  assert.deepEqual(parseCsvLine("a,"), ["a", ""]);
+  assert.deepEqual(parseCsvLine('"x, y",z'), ["x, y", "z"]);
+  assert.deepEqual(parseCsvLine('"say ""hi""",'), ['say "hi"', ""]);
+});
+
+// ---------------------------------------------------------------------------
+// "Anything that is not a string throws a TypeError."
+// ---------------------------------------------------------------------------
+
+test("non-string input throws TypeError", () => {
+  const inputs = [
+    undefined,
+    null,
+    0,
+    1,
+    NaN,
+    true,
+    false,
+    Symbol("s"),
+    10n,
+    {},
+    [],
+    ["a,b"],
+    () => "a,b",
+    new String("a,b"), // String object is not a primitive string
+    { toString: () => "a,b" },
+    { [Symbol.toPrimitive]: () => "a,b" },
+    Object.create(null),
+    new Date(),
+    /a,b/,
+    Buffer.from("a,b"),
+    new Uint8Array([97]),
+    new Map(),
+    Promise.resolve("a"),
+  ];
+  for (const input of inputs) {
+    assert.throws(() => parseCsvLine(input), TypeError);
+    assert.throws(() => parseCsvLine(input), (e) => !(e instanceof CsvError));
+  }
+  assert.throws(() => parseCsvLine(), TypeError);
+});
+
+// ---------------------------------------------------------------------------
+// "throws CsvError (exported, a subclass of Error)"
+// ---------------------------------------------------------------------------
+
+test("CsvError is an exported Error subclass with name and position", () => {
+  const e = new CsvError("x", 3);
+  assert.ok(e instanceof Error);
+  assert.ok(e instanceof CsvError);
+  assert.equal(e.name, "CsvError");
+  assert.equal(e.message, "x");
+  assert.equal(e.position, 3);
+  assert.equal(Object.prototype.toString.call(e), "[object Error]");
+  assert.throws(() => parseCsvLine('a"b'), csvError);
+});
+
+// ---------------------------------------------------------------------------
+// "Fields are separated by `,`. The empty text is one empty field: [""];
+//  `a,` is ["a", ""]."
+// ---------------------------------------------------------------------------
+
+test("separators and empty fields", () => {
   assert.deepEqual(parseCsvLine(""), [""]);
+  assert.deepEqual(parseCsvLine("a,"), ["a", ""]);
+  assert.deepEqual(parseCsvLine(",a"), ["", "a"]);
+  assert.deepEqual(parseCsvLine(","), ["", ""]);
+  assert.deepEqual(parseCsvLine(",,"), ["", "", ""]);
+  assert.deepEqual(parseCsvLine("a,,b"), ["a", "", "b"]);
+  assert.deepEqual(parseCsvLine("a"), ["a"]);
+  assert.deepEqual(parseCsvLine(",".repeat(9)), Array(10).fill(""));
 });
 
-test("quoted fields keep commas", () => {
-  assert.deepEqual(parseCsvLine('"x, y",z'), ["x, y", "z"]);
+// ---------------------------------------------------------------------------
+// "A field may be wrapped in double quotes. Inside quotes, `""` is one `"`,
+//  and commas, `\n` and `\r\n` are literal characters of the field."
+// ---------------------------------------------------------------------------
+
+test("quoted fields", () => {
+  assert.deepEqual(parseCsvLine('"a"'), ["a"]);
+  assert.deepEqual(parseCsvLine('""'), [""]);
+  assert.deepEqual(parseCsvLine('"",""'), ["", ""]);
+  assert.deepEqual(parseCsvLine('"a","b"'), ["a", "b"]);
+  assert.deepEqual(parseCsvLine('"a",b,"c"'), ["a", "b", "c"]);
+  assert.deepEqual(parseCsvLine('a,"b",c'), ["a", "b", "c"]);
+  assert.deepEqual(parseCsvLine('"a",'), ["a", ""]);
+  assert.deepEqual(parseCsvLine(',"a"'), ["", "a"]);
+});
+
+test("escaped quotes inside quotes", () => {
+  assert.deepEqual(parseCsvLine('""""'), ['"']);
+  assert.deepEqual(parseCsvLine('""""""'), ['""']);
+  assert.deepEqual(parseCsvLine('"a""b"'), ['a"b']);
+  assert.deepEqual(parseCsvLine('"""a"""'), ['"a"']);
+  assert.deepEqual(parseCsvLine('"""",""""'), ['"', '"']);
+  assert.deepEqual(parseCsvLine('"a"""'), ['a"']);
+  assert.deepEqual(parseCsvLine('"""a"'), ['"a']);
+  assert.deepEqual(parseCsvLine('"a""",b'), ['a"', "b"]);
+  // an escaped quote right before the terminator
+  assert.deepEqual(parseCsvLine('"a"""\n'), ['a"']);
+  assert.deepEqual(parseCsvLine('"a"""\r\n'), ['a"']);
+});
+
+test("commas and line breaks inside quotes are literal", () => {
+  assert.deepEqual(parseCsvLine('"a,b"'), ["a,b"]);
+  assert.deepEqual(parseCsvLine('","'), [","]);
+  assert.deepEqual(parseCsvLine('",",","'), [",", ","]);
+  assert.deepEqual(parseCsvLine('"a\nb"'), ["a\nb"]);
+  assert.deepEqual(parseCsvLine('"a\r\nb"'), ["a\r\nb"]);
+  assert.deepEqual(parseCsvLine('"a\rb"'), ["a\rb"]);
+  assert.deepEqual(parseCsvLine('"\n"'), ["\n"]);
+  assert.deepEqual(parseCsvLine('"\r\n"'), ["\r\n"]);
+  assert.deepEqual(parseCsvLine('"\r"'), ["\r"]);
+  assert.deepEqual(parseCsvLine('"\n\n\n"'), ["\n\n\n"]);
+  assert.deepEqual(parseCsvLine('"a\n",b\n'), ["a\n", "b"]);
+  assert.deepEqual(parseCsvLine('"a\r\n"\r\n'), ["a\r\n"]);
+  assert.deepEqual(parseCsvLine('"a\n"\n'), ["a\n"]);
+  // quoted content ending in \r followed by the terminator
+  assert.deepEqual(parseCsvLine('"\r"\n'), ["\r"]);
+});
+
+// ---------------------------------------------------------------------------
+// "After a closing quote, only a comma, the record terminator or the end of
+//  the text may follow; anything else is a CsvError."
+// ---------------------------------------------------------------------------
+
+test("after a closing quote: comma, terminator or end only", () => {
+  assert.deepEqual(parseCsvLine('"a",b'), ["a", "b"]);
+  assert.deepEqual(parseCsvLine('"a"\n'), ["a"]);
+  assert.deepEqual(parseCsvLine('"a"\r\n'), ["a"]);
+  assert.deepEqual(parseCsvLine('"a"'), ["a"]);
+  assert.deepEqual(parseCsvLine('a,"b"\n'), ["a", "b"]);
+
+  for (const bad of [
+    '"a"b',
+    '"a" ',
+    '"a"\t',
+    '"a" ,b',
+    '"a"x,b',
+    '"a"\r', // lone CR is not a terminator
+    '"a"\n\n',
+    '"a"\nb',
+    '"a"\r\nb',
+    '"a"\n,',
+    '"a"\r\r\n',
+    '"a"\n\r\n',
+    '"a""b"c',
+    '"a"""b',
+    '"" ',
+    '""a',
+    '"",""x',
+    'a,"b" ',
+    'a,"b"c',
+    '"a" ', // non-breaking space is still "anything else"
+    '"a" ',
+    '"a"\u0085',
+    '"a"\0',
+  ]) {
+    assert.throws(() => parseCsvLine(bad), csvError, JSON.stringify(bad));
+  }
+});
+
+test("error position points at the offending character after a closing quote", () => {
+  assert.throws(() => parseCsvLine('"a"b'), (e) => csvError(e) && e.position === 3);
+  assert.throws(() => parseCsvLine('x,"a" '), (e) => csvError(e) && e.position === 5);
+});
+
+// ---------------------------------------------------------------------------
+// "A quoted field that never closes is a CsvError."
+// ---------------------------------------------------------------------------
+
+test("unterminated quoted field", () => {
+  for (const bad of [
+    '"',
+    '"a',
+    '"a,b',
+    'a,"b',
+    '"a""',
+    '"a""""',
+    '"""',
+    '"""""',
+    '"a\n',
+    '"a\r\n',
+    '"\n',
+    '"\r\n',
+    '"a",\n"b',
+    '"a","',
+    '"a",""",',
+    '"a\nb\nc',
+  ]) {
+    assert.throws(() => parseCsvLine(bad), csvError, JSON.stringify(bad));
+  }
+  assert.throws(() => parseCsvLine('a,"b'), (e) => csvError(e) && e.position === 2);
+});
+
+// ---------------------------------------------------------------------------
+// "Outside quotes, a `"` anywhere is a CsvError (`a"b`, `a "b"`)."
+// ---------------------------------------------------------------------------
+
+test("quote outside quotes", () => {
+  for (const bad of [
+    'a"b',
+    'a "b"',
+    'a"',
+    'a""',
+    'a"",b',
+    ' "a"',
+    '\t"a"',
+    'a,b"',
+    'a,b"c',
+    'a,"b",c"d',
+    'a"b"c',
+    'x,y" "',
+    'a"\n',
+    'a"\r\n',
+    ' ""',
+  ]) {
+    assert.throws(() => parseCsvLine(bad), csvError, JSON.stringify(bad));
+  }
+  assert.throws(() => parseCsvLine('a"b'), (e) => csvError(e) && e.position === 1);
+  assert.throws(() => parseCsvLine('a,bc"'), (e) => csvError(e) && e.position === 4);
+});
+
+// ---------------------------------------------------------------------------
+// "Whitespace outside quotes is part of the field: ' a ' stays ' a '."
+// ---------------------------------------------------------------------------
+
+test("whitespace outside quotes is kept", () => {
+  assert.deepEqual(parseCsvLine(" a "), [" a "]);
+  assert.deepEqual(parseCsvLine(" "), [" "]);
+  assert.deepEqual(parseCsvLine("   "), ["   "]);
+  assert.deepEqual(parseCsvLine(" , "), [" ", " "]);
+  assert.deepEqual(parseCsvLine("a , b"), ["a ", " b"]);
+  assert.deepEqual(parseCsvLine("\ta\t"), ["\ta\t"]);
+  assert.deepEqual(parseCsvLine("\t"), ["\t"]);
+  assert.deepEqual(parseCsvLine(" a "), [" a "]);
+  assert.deepEqual(parseCsvLine("\v\f"), ["\v\f"]);
+  assert.deepEqual(parseCsvLine('" a "'), [" a "]);
+  assert.deepEqual(parseCsvLine(" \n"), [" "]);
+  assert.deepEqual(parseCsvLine("a, \r\n"), ["a", " "]);
+});
+
+// ---------------------------------------------------------------------------
+// "One record terminator (`\n` or `\r\n`) at the very end of the text is
+//  removed; any other unquoted `\r` or `\n` is a CsvError."
+// ---------------------------------------------------------------------------
+
+test("one trailing record terminator is removed", () => {
+  assert.deepEqual(parseCsvLine("a\n"), ["a"]);
+  assert.deepEqual(parseCsvLine("a\r\n"), ["a"]);
+  assert.deepEqual(parseCsvLine("\n"), [""]);
+  assert.deepEqual(parseCsvLine("\r\n"), [""]);
+  assert.deepEqual(parseCsvLine("a,\n"), ["a", ""]);
+  assert.deepEqual(parseCsvLine("a,\r\n"), ["a", ""]);
+  assert.deepEqual(parseCsvLine(",\n"), ["", ""]);
+  assert.deepEqual(parseCsvLine("a,b,c\n"), ["a", "b", "c"]);
+  assert.deepEqual(parseCsvLine("a,b,c\r\n"), ["a", "b", "c"]);
+  assert.deepEqual(parseCsvLine('"a",b\r\n'), ["a", "b"]);
+});
+
+test("any other unquoted CR or LF is a CsvError", () => {
+  for (const bad of [
+    "\r",
+    "a\r",
+    "\r\r\n",
+    "a\r\r\n",
+    "\n\n",
+    "a\n\n",
+    "\r\n\r\n",
+    "a\r\n\r\n",
+    "\n\r\n",
+    "a\n\r\n",
+    "\r\n\n",
+    "a\r\n\n",
+    "\n\r", // terminator not at the very end; lone CR at end
+    "a\nb",
+    "a\rb",
+    "a\r\nb",
+    "a\n,b",
+    "a,\nb",
+    "a\r,b",
+    "\na",
+    "\r\na",
+    "\ra",
+    "a,b\rc",
+    "a\n\r",
+    '"a"\n"b"',
+    '"a",\nb',
+    "a\r\n,",
+  ]) {
+    assert.throws(() => parseCsvLine(bad), csvError, JSON.stringify(bad));
+  }
+  assert.throws(() => parseCsvLine("ab\ncd"), (e) => csvError(e) && e.position === 2);
+  assert.throws(() => parseCsvLine("ab\r"), (e) => csvError(e) && e.position === 2);
+});
+
+// ---------------------------------------------------------------------------
+// "Every other character, including tabs, control characters and any
+//  Unicode, is a literal character of its field."
+// ---------------------------------------------------------------------------
+
+test("every other character is literal", () => {
+  assert.deepEqual(parseCsvLine("a\tb,c"), ["a\tb", "c"]);
+  assert.deepEqual(parseCsvLine("\0"), ["\0"]);
+  assert.deepEqual(parseCsvLine("a\0b,\0"), ["a\0b", "\0"]);
+  assert.deepEqual(parseCsvLine("\x01\x02\x1f\x7f"), ["\x01\x02\x1f\x7f"]);
+  assert.deepEqual(parseCsvLine("\x1b[31mred\x1b[0m"), ["\x1b[31mred\x1b[0m"]);
+  assert.deepEqual(parseCsvLine("\v,\f,\b"), ["\v", "\f", "\b"]);
+  // Unicode line/paragraph separators, NEL, and other "line-ish" chars are not terminators
+  assert.deepEqual(parseCsvLine("a b"), ["a b"]);
+  assert.deepEqual(parseCsvLine("a b"), ["a b"]);
+  assert.deepEqual(parseCsvLine("a\u0085b"), ["a\u0085b"]);
+  assert.deepEqual(parseCsvLine(" "), [" "]);
+  // BOM is not stripped
+  assert.deepEqual(parseCsvLine("﻿a,b"), ["﻿a", "b"]);
+  // Other quote-like characters are ordinary
+  assert.deepEqual(parseCsvLine("'a',“b”,`c`,«d»,＂e"), [
+    "'a'",
+    "“b”",
+    "`c`",
+    "«d»",
+    "＂e",
+  ]);
+  // Other comma-like characters are ordinary
+  assert.deepEqual(parseCsvLine("a，b،c‚d"), ["a，b،c‚d"]);
+  // Non-BMP, combining marks, RTL, ZWJ sequences
+  assert.deepEqual(parseCsvLine("\u{1f600},é,אב,\u{1f468}‍\u{1f469}"), [
+    "\u{1f600}",
+    "é",
+    "אב",
+    "\u{1f468}‍\u{1f469}",
+  ]);
+  assert.deepEqual(parseCsvLine('"\u{1f600},\t\0"'), ["\u{1f600},\t\0"]);
+  // Lone surrogates survive untouched
+  assert.deepEqual(parseCsvLine("\ud800,\udfff"), ["\ud800", "\udfff"]);
+  assert.deepEqual(parseCsvLine('"\ud800"'), ["\ud800"]);
+  assert.deepEqual(parseCsvLine("\udc00\ud800"), ["\udc00\ud800"]);
+});
+
+// ---------------------------------------------------------------------------
+// Result shape: always a fresh array of primitive strings
+// ---------------------------------------------------------------------------
+
+test("returns a fresh array of primitive strings", () => {
+  const a = parseCsvLine("a,b");
+  const b = parseCsvLine("a,b");
+  assert.notEqual(a, b);
+  assert.ok(Array.isArray(a));
+  for (const f of a) assert.equal(typeof f, "string");
+  assert.equal(Object.getPrototypeOf(a), Array.prototype);
+});
+
+// ---------------------------------------------------------------------------
+// "never hangs, and returns within a second for a record of 100 KB"
+// ---------------------------------------------------------------------------
+
+function timed(fn) {
+  const t0 = performance.now();
+  const result = fn();
+  return { result, ms: performance.now() - t0 };
+}
+
+test("100 KB records parse well within a second", () => {
+  const KB100 = 100 * 1024;
+  const cases = [
+    { name: "single unquoted field", text: "x".repeat(KB100) },
+    { name: "single quoted field", text: '"' + "x".repeat(KB100 - 2) + '"' },
+    { name: "all commas", text: ",".repeat(KB100) },
+    { name: "many small fields", text: "ab,".repeat(KB100 / 3) },
+    { name: "many empty quoted fields", text: '"",'.repeat(KB100 / 3) },
+    { name: "all escaped quotes in one field", text: '"' + '""'.repeat((KB100 - 2) / 2) + '"' },
+    { name: "alternating escaped quotes", text: '"' + 'a""'.repeat((KB100 - 2) / 3) + '"' },
+    { name: "quoted newlines", text: '"' + "\r\n".repeat((KB100 - 2) / 2) + '"' },
+    { name: "many quoted fields with commas", text: '"a,b",'.repeat(KB100 / 6) },
+    { name: "unicode", text: "\u{1f600}é,".repeat(KB100 / 4) },
+    { name: "unterminated quote (error)", text: '"' + "x".repeat(KB100 - 1) },
+    { name: "unterminated all escapes (error)", text: '"'.repeat(KB100 + 1) },
+    { name: "quote at end (error)", text: "x".repeat(KB100 - 1) + '"' },
+    { name: "char after closing quote (error)", text: '"' + "x".repeat(KB100 - 3) + '"x' },
+    { name: "newline at start (error)", text: "\n" + "x".repeat(KB100 - 1) },
+    { name: "1 MB unquoted", text: "y,".repeat(512 * 1024) },
+  ];
+  for (const { name, text } of cases) {
+    const { ms } = timed(() => {
+      try {
+        const out = parseCsvLine(text);
+        assert.ok(Array.isArray(out), name);
+      } catch (e) {
+        assert.ok(e instanceof CsvError, `${name}: threw ${e && e.constructor && e.constructor.name}`);
+      }
+    });
+    assert.ok(ms < 1000, `${name}: took ${ms.toFixed(1)} ms`);
+  }
+});
+
+test("100 KB record: correct content, not just fast", () => {
+  const field = "x".repeat(50 * 1024);
+  assert.deepEqual(parseCsvLine(`${field},${field}\r\n`), [field, field]);
+  const n = 20 * 1024;
+  assert.deepEqual(parseCsvLine('"' + '""'.repeat(n) + '"'), ['"'.repeat(n)]);
+  const many = Array.from({ length: 30000 }, (_, k) => String(k));
+  assert.deepEqual(parseCsvLine(many.join(",") + "\n"), many);
 });
 
-test("non-string input", () => {
-  assert.throws(() => parseCsvLine(null), TypeError);
+// ---------------------------------------------------------------------------
+// Property tests: random inputs never throw anything but CsvError, and any
+// correctly serialized record round-trips.
+// ---------------------------------------------------------------------------
+
+function rng(seed) {
+  let s = seed >>> 0;
+  return () => {
+    s = (s * 1664525 + 1013904223) >>> 0;
+    return s / 0x100000000;
+  };
+}
+
+const ALPHABET = ['"', ",", "\n", "\r", "a", "b", " ", "\t", "\0", "é", " ", "\ud83d", "\ude00", "﻿"];
+
+function randomString(rand, maxLen) {
+  const len = Math.floor(rand() * (maxLen + 1));
+  let s = "";
+  for (let k = 0; k < len; k++) s += ALPHABET[Math.floor(rand() * ALPHABET.length)];
+  return s;
+}
+
+test("fuzz: any string yields string[] or CsvError, nothing else", () => {
+  const rand = rng(12345);
+  for (let n = 0; n < 20000; n++) {
+    const text = randomString(rand, 12);
+    let out;
+    try {
+      out = parseCsvLine(text);
+    } catch (e) {
+      assert.ok(csvError(e), `${JSON.stringify(text)} threw ${e}`);
+      assert.ok(e.position >= 0 && e.position <= text.length, `${JSON.stringify(text)} position ${e.position}`);
+      continue;
+    }
+    assert.ok(Array.isArray(out), JSON.stringify(text));
+    assert.ok(out.length >= 1, JSON.stringify(text));
+    for (const f of out) assert.equal(typeof f, "string", JSON.stringify(text));
+  }
+});
+
+function needsQuotes(field) {
+  return /["\r\n,]/.test(field);
+}
+
+function serialize(fields, { quoteAll, terminator }) {
+  return (
+    fields
+      .map((f) => (quoteAll || needsQuotes(f) ? '"' + f.replace(/"/g, '""') + '"' : f))
+      .join(",") + terminator
+  );
+}
+
+test("fuzz: serialized records round-trip exactly", () => {
+  const rand = rng(777);
+  for (let n = 0; n < 20000; n++) {
+    const count = 1 + Math.floor(rand() * 5);
+    const fields = Array.from({ length: count }, () => randomString(rand, 8));
+    const quoteAll = rand() < 0.5;
+    const terminator = ["", "\n", "\r\n"][Math.floor(rand() * 3)];
+    const text = serialize(fields, { quoteAll, terminator });
+    assert.deepEqual(parseCsvLine(text), fields, JSON.stringify(text));
+  }
 });
 
-test("CsvError is an Error", () => {
-  assert.ok(new CsvError("x") instanceof Error);
+test("fuzz: exhaustive over short strings of the special alphabet", () => {
+  // Every string up to length 5 over the characters that matter to the grammar.
+  const chars = ['"', ",", "\n", "\r", "a"];
+  const ref = (text) => {
+    // Independent reference implementation: char-by-char state machine.
+    let end = text.length;
+    if (text.endsWith("\r\n")) end -= 2;
+    else if (text.endsWith("\n")) end -= 1;
+    const body = text.slice(0, end);
+    const fields = [];
+    let field = "";
+    let state = "start"; // start | unquoted | quoted | afterQuote
+    for (const ch of body) {
+      if (state === "start") {
+        if (ch === '"') state = "quoted";
+        else if (ch === ",") fields.push(field);
+        else if (ch === "\n" || ch === "\r") return null;
+        else {
+          field += ch;
+          state = "unquoted";
+        }
+      } else if (state === "unquoted") {
+        if (ch === '"' || ch === "\n" || ch === "\r") return null;
+        if (ch === ",") {
+          fields.push(field);
+          field = "";
+          state = "start";
+        } else field += ch;
+      } else if (state === "quoted") {
+        if (ch === '"') state = "afterQuote";
+        else field += ch;
+      } else {
+        // afterQuote
+        if (ch === '"') {
+          field += '"';
+          state = "quoted";
+        } else if (ch === ",") {
+          fields.push(field);
+          field = "";
+          state = "start";
+        } else return null;
+      }
+    }
+    if (state === "quoted") return null;
+    fields.push(field);
+    return fields;
+  };
+  let strings = [""];
+  for (let len = 0; len <= 5; len++) {
+    for (const text of strings) {
+      const expected = ref(text);
+      if (expected === null) {
+        assert.throws(() => parseCsvLine(text), csvError, JSON.stringify(text));
+      } else {
+        assert.deepEqual(parseCsvLine(text), expected, JSON.stringify(text));
+      }
+    }
+    strings = strings.flatMap((s) => chars.map((c) => s + c));
+  }
 });
```

## Candidate G

```diff
diff --git a/src/csv.mjs b/src/csv.mjs
index d5d662e..eadf6bb 100644
--- a/src/csv.mjs
+++ b/src/csv.mjs
@@ -1,34 +1,95 @@
+/**
+ * Thrown for any input string that is not a valid CSV record (README.md).
+ * `index` is the 0-based offset in the input at which the problem was found.
+ */
 export class CsvError extends Error {
-  constructor(message) {
+  constructor(message, index) {
     super(message);
     this.name = "CsvError";
+    if (typeof index === "number") this.index = index;
   }
 }
 
+const QUOTE = 0x22; // "
+const COMMA = 0x2c; // ,
+const LF = 0x0a; // \n
+const CR = 0x0d; // \r
+
 /**
- * Parses one CSV record into its fields (README.md). Handles the plain and the
- * quoted case; the rest of the contract is not enforced yet.
+ * Parses one CSV record into its fields (README.md).
+ *
+ * For every string input this either returns an array of strings or throws a
+ * CsvError; anything that is not a string throws a TypeError. The scan is a
+ * single left-to-right pass with O(n) work, so a 100 KB record is parsed in
+ * well under a second regardless of its shape.
+ *
  * @param {string} text
  * @returns {string[]}
  */
 export function parseCsvLine(text) {
-  if (typeof text !== "string") throw new TypeError("parseCsvLine: text must be a string");
+  if (typeof text !== "string") {
+    throw new TypeError("parseCsvLine: text must be a string");
+  }
+
+  // One record terminator ("\n" or "\r\n") at the very end is removed. A lone
+  // trailing "\r" is not a terminator and is left for the scanner to reject.
+  let end = text.length;
+  if (end > 0 && text.charCodeAt(end - 1) === LF) {
+    end -= 1;
+    if (end > 0 && text.charCodeAt(end - 1) === CR) end -= 1;
+  }
+
   const fields = [];
-  let field = "";
-  let quoted = false;
-  let rest = text;
-  while (rest.length > 0) {
-    const ch = rest[0];
-    rest = rest.slice(1);
-    if (ch === '"') {
-      quoted = !quoted;
-    } else if (ch === "," && !quoted) {
-      fields.push(field);
-      field = "";
+  let i = 0;
+  for (;;) {
+    if (i < end && text.charCodeAt(i) === QUOTE) {
+      // Quoted field: starts with a quote at the very beginning of the field.
+      const open = i;
+      let segStart = i + 1;
+      let parts = null;
+      for (;;) {
+        let k = text.indexOf('"', segStart);
+        if (k === -1 || k >= end) {
+          throw new CsvError("unterminated quoted field", open);
+        }
+        if (k + 1 < end && text.charCodeAt(k + 1) === QUOTE) {
+          // "" inside quotes is one literal quote: keep the first, skip the second.
+          if (parts === null) parts = [];
+          parts.push(text.slice(segStart, k + 1));
+          segStart = k + 2;
+          continue;
+        }
+        // Closing quote.
+        const last = text.slice(segStart, k);
+        fields.push(parts === null ? last : parts.join("") + last);
+        i = k + 1;
+        break;
+      }
+      // After a closing quote only a comma or the end of the record may follow
+      // (the record terminator has already been stripped).
+      if (i === end) break;
+      if (text.charCodeAt(i) !== COMMA) {
+        throw new CsvError("unexpected character after closing quote", i);
+      }
+      i += 1; // skip the comma; next field starts here (possibly empty at end)
     } else {
-      field += ch;
+      // Unquoted field: runs to the next comma or the end of the record.
+      let j = i;
+      while (j < end) {
+        const c = text.charCodeAt(j);
+        if (c === COMMA) break;
+        if (c === QUOTE) {
+          throw new CsvError("quote inside unquoted field", j);
+        }
+        if (c === LF || c === CR) {
+          throw new CsvError("line break outside quotes", j);
+        }
+        j += 1;
+      }
+      fields.push(text.slice(i, j));
+      if (j === end) break;
+      i = j + 1; // skip the comma
     }
   }
-  fields.push(field);
   return fields;
 }
diff --git a/tests/csv.test.mjs b/tests/csv.test.mjs
index 816adc6..71f62eb 100644
--- a/tests/csv.test.mjs
+++ b/tests/csv.test.mjs
@@ -3,20 +3,605 @@ import { test } from "node:test";
 
 import { CsvError, parseCsvLine } from "../src/csv.mjs";
 
-test("plain fields", () => {
-  assert.deepEqual(parseCsvLine("a,b,c"), ["a", "b", "c"]);
-  assert.deepEqual(parseCsvLine("a,"), ["a", ""]);
-  assert.deepEqual(parseCsvLine(""), [""]);
+// Helpers ------------------------------------------------------------------
+
+function isCsvError(err) {
+  return err instanceof CsvError && err instanceof Error && err.name === "CsvError";
+}
+
+function assertCsvError(text) {
+  assert.throws(() => parseCsvLine(text), isCsvError, `expected CsvError for ${JSON.stringify(text)}`);
+}
+
+function assertFields(text, expected) {
+  const out = parseCsvLine(text);
+  assert.ok(Array.isArray(out), "result must be an array");
+  for (const f of out) assert.equal(typeof f, "string", "every field must be a string");
+  assert.deepEqual(out, expected, `for ${JSON.stringify(text)}`);
+}
+
+// README examples ----------------------------------------------------------
+
+test("README examples", () => {
+  assertFields("a,b,c", ["a", "b", "c"]);
+  assertFields('"x, y",z', ["x, y", "z"]);
+  assertFields('"say ""hi""",', ['say "hi"', ""]);
+});
+
+// Contract: exports ----------------------------------------------------------
+
+test("CsvError is an Error subclass named CsvError", () => {
+  const e = new CsvError("x");
+  assert.ok(e instanceof Error);
+  assert.ok(e instanceof CsvError);
+  assert.equal(e.name, "CsvError");
+  assert.equal(e.message, "x");
+  assert.ok(typeof e.stack === "string");
+});
+
+test("CsvError thrown by the parser carries an index", () => {
+  try {
+    parseCsvLine('ab"c');
+    assert.fail("should throw");
+  } catch (e) {
+    assert.ok(isCsvError(e));
+    assert.equal(e.index, 2);
+  }
+});
+
+// Contract: anything that is not a string throws a TypeError -----------------
+
+test("non-string input throws TypeError (never CsvError)", () => {
+  const bad = [
+    undefined,
+    null,
+    0,
+    1,
+    NaN,
+    true,
+    false,
+    {},
+    [],
+    ["a,b"],
+    { toString: () => "a,b" },
+    Symbol("x"),
+    10n,
+    () => "a",
+    new String("a,b"),
+    Buffer.from("a,b"),
+    new Uint8Array([97]),
+    new Date(),
+    /a,b/,
+    new Proxy({}, {}),
+    Object.create(null),
+  ];
+  for (const v of bad) {
+    assert.throws(
+      () => parseCsvLine(v),
+      (e) => e instanceof TypeError && !(e instanceof CsvError),
+      `expected TypeError for ${String(typeof v)}`,
+    );
+  }
+  assert.throws(() => parseCsvLine(), TypeError);
+});
+
+// Contract: fields are separated by "," ---------------------------------------
+
+test("fields are separated by commas", () => {
+  assertFields("a,b,c", ["a", "b", "c"]);
+  assertFields("a", ["a"]);
+  assertFields("abc,def", ["abc", "def"]);
+});
+
+test("empty text is one empty field", () => {
+  assertFields("", [""]);
+});
+
+test("trailing, leading and consecutive separators give empty fields", () => {
+  assertFields("a,", ["a", ""]);
+  assertFields(",a", ["", "a"]);
+  assertFields(",", ["", ""]);
+  assertFields(",,", ["", "", ""]);
+  assertFields(",,,", ["", "", "", ""]);
+  assertFields("a,,b", ["a", "", "b"]);
+  assertFields(",a,", ["", "a", ""]);
+  assertFields("a,b,", ["a", "b", ""]);
+});
+
+// Contract: quoted fields ------------------------------------------------------
+
+test("a field may be wrapped in double quotes", () => {
+  assertFields('"a"', ["a"]);
+  assertFields('"a","b"', ["a", "b"]);
+  assertFields('"a",b', ["a", "b"]);
+  assertFields('a,"b"', ["a", "b"]);
+  assertFields('""', [""]);
+  assertFields('"",""', ["", ""]);
+  assertFields('"",', ["", ""]);
+  assertFields(',""', ["", ""]);
+  assertFields('"",a,""', ["", "a", ""]);
+});
+
+test('inside quotes "" is one "', () => {
+  assertFields('""""', ['"']);
+  assertFields('""""""', ['""']);
+  assertFields('"a""b"', ['a"b']);
+  assertFields('"""a"""', ['"a"']);
+  assertFields('"""",""""', ['"', '"']);
+  assertFields('"a""","""b"', ['a"', '"b']);
+  assertFields('"""",a', ['"', "a"]);
+  assertFields('""""""""', ['"""']);
+});
+
+test("inside quotes commas are literal", () => {
+  assertFields('","', [","]);
+  assertFields('",,,"', [",,,"]);
+  assertFields('"a,b",c', ["a,b", "c"]);
+  assertFields('"a,b","c,d"', ["a,b", "c,d"]);
+  assertFields('",",","', [",", ","]);
+});
+
+test("inside quotes \\n and \\r\\n are literal", () => {
+  assertFields('"a\nb"', ["a\nb"]);
+  assertFields('"a\r\nb"', ["a\r\nb"]);
+  assertFields('"\n"', ["\n"]);
+  assertFields('"\r\n"', ["\r\n"]);
+  assertFields('"\n\n\n"', ["\n\n\n"]);
+  assertFields('"a\nb",c', ["a\nb", "c"]);
+  assertFields('"a\r\nb","c\nd"', ["a\r\nb", "c\nd"]);
+  assertFields('"\n",\n', ["\n", ""]);
+  assertFields('"\r\n"\r\n', ["\r\n"]);
+});
+
+test("inside quotes a lone \\r and other control characters are literal", () => {
+  assertFields('"a\rb"', ["a\rb"]);
+  assertFields('"\r"', ["\r"]);
+  assertFields('"\r\r"', ["\r\r"]);
+  assertFields('"\n\r"', ["\n\r"]);
+  assertFields('"\t\0\x1b"', ["\t\0\x1b"]);
+});
+
+test("after a closing quote only comma, terminator or end may follow", () => {
+  assertFields('"a"', ["a"]);
+  assertFields('"a",', ["a", ""]);
+  assertFields('"a"\n', ["a"]);
+  assertFields('"a"\r\n', ["a"]);
+  assertFields('"a",\n', ["a", ""]);
+  assertCsvError('"a"b');
+  assertCsvError('"a" ');
+  assertCsvError('"a" ,b');
+  assertCsvError('"a"\t');
+  assertCsvError('"a"\r'); // lone CR is not a terminator
+  assertCsvError('"a"\n\n');
+  assertCsvError('"a"\r\n\r\n');
+  assertCsvError('"a"\n,b');
+  assertCsvError('"a"\r\nb');
+  assertCsvError('"a""b');
+  assertCsvError('"a"" '); // "" then space then end: unterminated
+  assertCsvError('""a');
+  assertCsvError('"" ');
+  assertFields('"""a"', ['"a']); // "" then a: still inside the quotes
+  assertCsvError('"a" ');
+  assertCsvError('"a"﻿');
+  assertCsvError('"a"😀');
+  assertCsvError('"a" ');
+  assertCsvError('"a" ');
+  assertCsvError('"a"\u0085');
+});
+
+test("a quoted field that never closes is a CsvError", () => {
+  assertCsvError('"');
+  assertCsvError('"a');
+  assertCsvError('"a,b');
+  assertCsvError('a,"b');
+  assertCsvError('"""');
+  assertCsvError('"""""');
+  assertCsvError('"a""');
+  assertCsvError('"a\n');
+  assertCsvError('"a\r\n');
+  assertCsvError('"\n');
+  assertCsvError('"\r\n');
+  assertCsvError('"a",\"');
+  assertCsvError('"a","b');
+  assertCsvError('"a"\n"'); // terminator not at the very end
+  assertCsvError('",""');
+});
+
+// Contract: outside quotes a quote anywhere is a CsvError ---------------------
+
+test('outside quotes a " anywhere is a CsvError', () => {
+  assertCsvError('a"b');
+  assertCsvError('a "b"');
+  assertCsvError('a"');
+  assertCsvError('a""');
+  assertCsvError('a"b"');
+  assertCsvError(' "a"');
+  assertCsvError('a,b"');
+  assertCsvError('a,b"c');
+  assertCsvError('a,"b"c');
+  assertFields('a," b"', ["a", " b"]); // quote at field start is fine
+  assertCsvError('a, "b"');
+  assertCsvError('\t"a"');
+  assertCsvError('a""b');
+  assertCsvError('ab"');
+  assertCsvError(',a"');
+  assertCsvError('a"\n');
+  assertCsvError('a"\r\n');
+});
+
+// Contract: whitespace outside quotes is part of the field ----------------------
+
+test("whitespace outside quotes is part of the field", () => {
+  assertFields(" a ", [" a "]);
+  assertFields(" ", [" "]);
+  assertFields("  ", ["  "]);
+  assertFields(" a , b ", [" a ", " b "]);
+  assertFields("\ta\t", ["\ta\t"]);
+  assertFields("a ,b", ["a ", "b"]);
+  assertFields("a, b", ["a", " b"]);
+  assertFields(" ,", [" ", ""]);
+  assertFields(", ", ["", " "]);
+  assertFields(" a ", [" a "]);
+  assertFields("　", ["　"]);
+  assertFields("\f\v", ["\f\v"]);
+});
+
+// Contract: record terminator ------------------------------------------------------
+
+test("one terminator (\\n or \\r\\n) at the very end is removed", () => {
+  assertFields("a,b\n", ["a", "b"]);
+  assertFields("a,b\r\n", ["a", "b"]);
+  assertFields("a\n", ["a"]);
+  assertFields("a\r\n", ["a"]);
+  assertFields("a,\n", ["a", ""]);
+  assertFields("a,\r\n", ["a", ""]);
+  assertFields(",\n", ["", ""]);
+  assertFields("\n", [""]);
+  assertFields("\r\n", [""]);
+  assertFields(" \n", [" "]);
+  assertFields('"a"\n', ["a"]);
+  assertFields('"a"\r\n', ["a"]);
+  assertFields('"a\n"\n', ["a\n"]);
+});
+
+test("any other unquoted \\r or \\n is a CsvError", () => {
+  assertCsvError("\r");
+  assertCsvError("a\r");
+  assertCsvError("a,b\r");
+  assertCsvError("\n\r");
+  assertCsvError("\r\r");
+  assertCsvError("\r\r\n");
+  assertCsvError("a\r\r\n");
+  assertCsvError("\n\n");
+  assertCsvError("\r\n\r\n");
+  assertCsvError("\r\n\n");
+  assertCsvError("\n\r\n");
+  assertCsvError("a\nb");
+  assertCsvError("a\rb");
+  assertCsvError("a\r\nb");
+  assertCsvError("a\n,b");
+  assertCsvError("\na");
+  assertCsvError("\ra");
+  assertCsvError("\r\na");
+  assertCsvError("a,\nb");
+  assertCsvError("a\n\n");
+  assertCsvError("a\r\n\r\n");
+  assertCsvError("a\n\r");
+  assertCsvError('"a",\n\n');
+  assertCsvError('"a"\n\r\n');
+  assertCsvError("\n\r\n");
+  assertCsvError("\r\n\r");
+});
+
+// Contract: every other character is literal ------------------------------------
+
+test("tabs, control characters and unicode are literal", () => {
+  assertFields("\t", ["\t"]);
+  assertFields("a\tb,c", ["a\tb", "c"]);
+  assertFields("\0", ["\0"]);
+  assertFields("\x01\x02\x1f\x7f", ["\x01\x02\x1f\x7f"]);
+  assertFields("\b\f\v", ["\b\f\v"]);
+  assertFields("\x1b[0m", ["\x1b[0m"]);
+  assertFields("é,ß", ["é", "ß"]);
+  assertFields("日本語,中文", ["日本語", "中文"]);
+  assertFields("😀,👩‍👩‍👧", ["😀", "👩‍👩‍👧"]);
+  assertFields(" , ", [" ", " "]);
+  assertFields("\u0085", ["\u0085"]); // NEL is not a terminator
+  assertFields("﻿a", ["﻿a"]); // BOM is literal
+  assertFields("​", ["​"]);
+  assertFields("😀", ["😀"]);
+  assertFields("\ud800", ["\ud800"]); // lone high surrogate
+  assertFields("\udc00,\ud800", ["\udc00", "\ud800"]); // lone surrogates
+  assertFields("'a'", ["'a'"]); // single quotes are ordinary
+  assertFields("`a`", ["`a`"]);
+  assertFields("a;b", ["a;b"]);
+  assertFields("a\\,b", ["a\\", "b"]); // backslash is not an escape
+  assertFields('"a\\"', ["a\\"]); // backslash does not escape a quote
+  assertFields("，", ["，"]); // fullwidth comma is not a separator
+  assertFields("“a”", ["“a”"]); // curly quotes are literal
+  assertFields('"﻿\0 😀,\n"', ["﻿\0 😀,\n"]);
+});
+
+// Properties: result shape ---------------------------------------------------------
+
+test("results are fresh plain arrays of primitive strings", () => {
+  const a = parseCsvLine("a,b");
+  const b = parseCsvLine("a,b");
+  assert.notEqual(a, b);
+  assert.equal(Object.getPrototypeOf(a), Array.prototype);
+  for (const f of a) assert.equal(typeof f, "string");
+  a.push("mutated");
+  assert.deepEqual(parseCsvLine("a,b"), ["a", "b"]);
+});
+
+test("parser is stateless across calls, including after errors", () => {
+  assert.throws(() => parseCsvLine('"unterminated'), isCsvError);
+  assertFields("a,b", ["a", "b"]);
+  assert.throws(() => parseCsvLine('a"b'), isCsvError);
+  assertFields('"x, y",z', ["x, y", "z"]);
+  assert.throws(() => parseCsvLine(42), TypeError);
+  assertFields("", [""]);
 });
 
-test("quoted fields keep commas", () => {
-  assert.deepEqual(parseCsvLine('"x, y",z'), ["x, y", "z"]);
+test("field count is commas + 1 for plain records", () => {
+  for (let n = 0; n <= 20; n++) {
+    const text = ",".repeat(n);
+    assert.deepEqual(parseCsvLine(text), new Array(n + 1).fill(""));
+  }
 });
 
-test("non-string input", () => {
-  assert.throws(() => parseCsvLine(null), TypeError);
+// Performance ------------------------------------------------------------------------
+
+function timed(fn) {
+  const t0 = process.hrtime.bigint();
+  const out = fn();
+  const ms = Number(process.hrtime.bigint() - t0) / 1e6;
+  return { out, ms };
+}
+
+const SIZE = 100 * 1024;
+const LIMIT_MS = 1000;
+
+test("100 KB record: many short unquoted fields", () => {
+  const reps = Math.ceil(SIZE / 3);
+  const text = "ab,".repeat(reps);
+  const { out, ms } = timed(() => parseCsvLine(text));
+  assert.equal(out.length, reps + 1);
+  assert.equal(out[0], "ab");
+  assert.equal(out[out.length - 1], "");
+  assert.ok(ms < LIMIT_MS, `took ${ms}ms`);
 });
 
-test("CsvError is an Error", () => {
-  assert.ok(new CsvError("x") instanceof Error);
+test("100 KB record: one huge unquoted field", () => {
+  const text = "x".repeat(SIZE);
+  const { out, ms } = timed(() => parseCsvLine(text));
+  assert.deepEqual(out, [text]);
+  assert.ok(ms < LIMIT_MS, `took ${ms}ms`);
+});
+
+test("100 KB record: one huge quoted field", () => {
+  const inner = "y".repeat(SIZE - 2);
+  const { out, ms } = timed(() => parseCsvLine(`"${inner}"`));
+  assert.deepEqual(out, [inner]);
+  assert.ok(ms < LIMIT_MS, `took ${ms}ms`);
+});
+
+test("100 KB record: only commas", () => {
+  const text = ",".repeat(SIZE);
+  const { out, ms } = timed(() => parseCsvLine(text));
+  assert.equal(out.length, SIZE + 1);
+  assert.ok(out.every((f) => f === ""));
+  assert.ok(ms < LIMIT_MS, `took ${ms}ms`);
+});
+
+test("100 KB record: only escaped quotes inside one quoted field", () => {
+  // "  + ("")*n + "  -> one field of n quotes
+  const n = (SIZE - 2) / 2;
+  const text = '"' + '""'.repeat(n) + '"';
+  const { out, ms } = timed(() => parseCsvLine(text));
+  assert.equal(out.length, 1);
+  assert.equal(out[0].length, n);
+  assert.equal(out[0], '"'.repeat(n));
+  assert.ok(ms < LIMIT_MS, `took ${ms}ms`);
+});
+
+test("100 KB record: many empty quoted fields", () => {
+  const reps = Math.ceil(SIZE / 3);
+  const text = '"",'.repeat(reps);
+  const { out, ms } = timed(() => parseCsvLine(text));
+  assert.equal(out.length, reps + 1);
+  assert.ok(out.every((f) => f === ""));
+  assert.ok(ms < LIMIT_MS, `took ${ms}ms`);
+});
+
+test("100 KB record: many quoted fields with embedded newlines and commas", () => {
+  const unit = '"a,\r\n""b""",';
+  const reps = Math.ceil(SIZE / unit.length);
+  const text = unit.repeat(reps);
+  const { out, ms } = timed(() => parseCsvLine(text));
+  assert.equal(out.length, reps + 1);
+  assert.equal(out[0], 'a,\r\n"b"');
+  assert.equal(out[reps], "");
+  assert.ok(ms < LIMIT_MS, `took ${ms}ms`);
+});
+
+test("100 KB record: mixed unicode and control characters", () => {
+  const unit = "😀\t\0é,";
+  const reps = Math.ceil(SIZE / unit.length);
+  const { out, ms } = timed(() => parseCsvLine(unit.repeat(reps)));
+  assert.equal(out.length, reps + 1);
+  assert.equal(out[0], "😀\t\0é");
+  assert.ok(ms < LIMIT_MS, `took ${ms}ms`);
+});
+
+test("100 KB record: unterminated quote fails fast", () => {
+  const text = '"' + "z".repeat(SIZE - 1);
+  const { ms } = timed(() => assert.throws(() => parseCsvLine(text), isCsvError));
+  assert.ok(ms < LIMIT_MS, `took ${ms}ms`);
+});
+
+test("100 KB record: error at the very end fails within budget", () => {
+  const cases = [
+    "z".repeat(SIZE - 1) + '"',
+    "z".repeat(SIZE - 1) + "\r",
+    "z".repeat(SIZE - 2) + "\n\n",
+    '"' + "z".repeat(SIZE - 3) + '"x',
+    '"' + '""'.repeat((SIZE - 1) / 2), // odd quote count: unterminated
+    '"'.repeat(SIZE + 1),
+  ];
+  for (const text of cases) {
+    const { ms } = timed(() => assert.throws(() => parseCsvLine(text), isCsvError));
+    assert.ok(ms < LIMIT_MS, `took ${ms}ms`);
+  }
+});
+
+test("100 KB record: all quotes (even count) is one field of quotes", () => {
+  const text = '"'.repeat(SIZE); // " + ("")*(SIZE/2-1) + "
+  const { out, ms } = timed(() => parseCsvLine(text));
+  assert.deepEqual(out, ['"'.repeat(SIZE / 2 - 1)]);
+  assert.ok(ms < LIMIT_MS, `took ${ms}ms`);
+});
+
+test("1 MB record still parses in well under a second (linear time)", () => {
+  const reps = Math.ceil((1024 * 1024) / 9);
+  const text = '"a""b",c,'.repeat(reps);
+  const { out, ms } = timed(() => parseCsvLine(text));
+  assert.equal(out.length, reps * 2 + 1);
+  assert.equal(out[0], 'a"b');
+  assert.equal(out[1], "c");
+  assert.ok(ms < LIMIT_MS, `took ${ms}ms`);
+});
+
+// Differential fuzz against an independent oracle --------------------------------
+
+/**
+ * Reference implementation written as a plain per-character state machine,
+ * deliberately structured differently from src/csv.mjs. Returns
+ * { fields } or { error: true }.
+ */
+function oracle(text) {
+  let s = text;
+  if (s.endsWith("\r\n")) s = s.slice(0, -2);
+  else if (s.endsWith("\n")) s = s.slice(0, -1);
+
+  const fields = [];
+  let field = "";
+  let state = "start"; // start | plain | quoted | closed
+  for (let i = 0; i < s.length; i++) {
+    const c = s[i];
+    if (state === "start") {
+      if (c === '"') state = "quoted";
+      else if (c === ",") fields.push("");
+      else if (c === "\n" || c === "\r") return { error: true };
+      else {
+        field += c;
+        state = "plain";
+      }
+    } else if (state === "plain") {
+      if (c === ",") {
+        fields.push(field);
+        field = "";
+        state = "start";
+      } else if (c === '"' || c === "\n" || c === "\r") return { error: true };
+      else field += c;
+    } else if (state === "quoted") {
+      if (c === '"') {
+        if (s[i + 1] === '"') {
+          field += '"';
+          i++;
+        } else state = "closed";
+      } else field += c;
+    } else if (state === "closed") {
+      if (c === ",") {
+        fields.push(field);
+        field = "";
+        state = "start";
+      } else return { error: true };
+    }
+  }
+  if (state === "quoted") return { error: true };
+  fields.push(field);
+  return { fields };
+}
+
+function makeRng(seed) {
+  let s = seed >>> 0;
+  return () => {
+    s = (s + 0x6d2b79f5) >>> 0;
+    let t = s;
+    t = Math.imul(t ^ (t >>> 15), t | 1);
+    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
+    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
+  };
+}
+
+const FUZZ_ALPHABET = ['"', '"', ",", ",", "\n", "\r", " ", "a", "b", "\t", "é", "😀"];
+
+function randomText(rng, maxLen) {
+  const len = Math.floor(rng() * (maxLen + 1));
+  let out = "";
+  for (let i = 0; i < len; i++) out += FUZZ_ALPHABET[Math.floor(rng() * FUZZ_ALPHABET.length)];
+  return out;
+}
+
+test("fuzz: parser agrees with the oracle and only ever returns fields or CsvError", () => {
+  const rng = makeRng(20260921);
+  for (let n = 0; n < 20000; n++) {
+    const text = randomText(rng, 12);
+    const expected = oracle(text);
+    let actual;
+    try {
+      actual = { fields: parseCsvLine(text) };
+    } catch (e) {
+      assert.ok(isCsvError(e), `non-CsvError thrown for ${JSON.stringify(text)}: ${e}`);
+      actual = { error: true };
+    }
+    assert.deepEqual(actual, expected, `mismatch for ${JSON.stringify(text)}`);
+  }
+});
+
+test("exhaustive: every string up to length 6 over the CSV alphabet matches the oracle", () => {
+  const alphabet = ['"', ",", "\n", "\r", "a", " "];
+  const maxLen = 6;
+  let count = 0;
+  const walk = (prefix) => {
+    const expected = oracle(prefix);
+    let actual;
+    try {
+      actual = { fields: parseCsvLine(prefix) };
+    } catch (e) {
+      assert.ok(isCsvError(e), `non-CsvError thrown for ${JSON.stringify(prefix)}: ${e}`);
+      actual = { error: true };
+    }
+    assert.deepEqual(actual, expected, `mismatch for ${JSON.stringify(prefix)}`);
+    count++;
+    if (prefix.length < maxLen) for (const c of alphabet) walk(prefix + c);
+  };
+  walk("");
+  const k = alphabet.length;
+  assert.equal(count, (k ** (maxLen + 1) - 1) / (k - 1));
+});
+
+function encodeField(f) {
+  if (/[",\r\n]/.test(f)) return '"' + f.replaceAll('"', '""') + '"';
+  return f;
+}
+
+test("round-trip: encoded random fields parse back to themselves", () => {
+  const rng = makeRng(42);
+  const chars = ['"', ",", "\n", "\r", " ", "a", "z", "\t", "\0", "日", "😀", "﻿"];
+  for (let n = 0; n < 5000; n++) {
+    const count = 1 + Math.floor(rng() * 6);
+    const fields = [];
+    for (let i = 0; i < count; i++) {
+      const len = Math.floor(rng() * 6);
+      let f = "";
+      for (let j = 0; j < len; j++) f += chars[Math.floor(rng() * chars.length)];
+      fields.push(f);
+    }
+    const quoteAll = rng() < 0.3;
+    const text = fields.map((f) => (quoteAll ? '"' + f.replaceAll('"', '""') + '"' : encodeField(f))).join(",");
+    const terminator = ["", "\n", "\r\n"][Math.floor(rng() * 3)];
+    assert.deepEqual(parseCsvLine(text + terminator), fields, `for ${JSON.stringify(text + terminator)}`);
+  }
 });
```

## Candidate P

```diff
diff --git a/src/csv.mjs b/src/csv.mjs
index d5d662e..9a06dd8 100644
--- a/src/csv.mjs
+++ b/src/csv.mjs
@@ -1,34 +1,207 @@
 export class CsvError extends Error {
-  constructor(message) {
-    super(message);
+  /**
+   * @param {string} message
+   * @param {number} [index] code-unit offset in the input where parsing failed
+   * @param {unknown} [cause] underlying error, when the failure was not a
+   *   syntax error but a resource limit hit while building the result
+   */
+  constructor(message, index, cause) {
+    super(message, cause === undefined ? undefined : { cause });
     this.name = "CsvError";
+    if (index !== undefined) this.index = index;
   }
 }
 
 /**
- * Parses one CSV record into its fields (README.md). Handles the plain and the
- * quoted case; the rest of the contract is not enforced yet.
+ * Upper bound on the number of fields one record may have. A record with more
+ * fields than this is a CsvError.
+ *
+ * The result of parseCsvLine is one JS array, and a JS engine cannot grow an
+ * array without limit: V8 (node) throws a RangeError ("Invalid array length")
+ * on the push that would make an array longer than 2**27 = 134 217 728
+ * elements, whatever the heap size. Bounding the field count ourselves turns
+ * that engine limit into a CsvError, as the contract requires, and makes the
+ * behaviour deterministic across engines and versions. Any genuine record is
+ * orders of magnitude smaller (2**27 fields needs at least 128 MiB of commas).
+ */
+export const MAX_FIELDS = 2 ** 27;
+
+const QUOTE = 0x22; // "
+const COMMA = 0x2c; // ,
+const CR = 0x0d; // \r
+const LF = 0x0a; // \n
+
+// Parser states.
+const FIELD_START = 0; // at the start of a field, nothing consumed yet
+const UNQUOTED = 1; // inside an unquoted field
+const QUOTED = 2; // inside a quoted field
+const AFTER_QUOTE = 3; // just after the closing quote of a quoted field
+
+/**
+ * Parses one CSV record into its fields (see README.md for the contract).
+ *
+ * For any string input this returns an array of strings or throws CsvError;
+ * nothing else is ever thrown. Anything that is not a string throws a
+ * TypeError. The parser is a single linear pass over the text, so it runs in
+ * O(n) time and memory and never hangs. A record with more than MAX_FIELDS
+ * fields is a CsvError (see MAX_FIELDS).
+ *
  * @param {string} text
  * @returns {string[]}
  */
 export function parseCsvLine(text) {
-  if (typeof text !== "string") throw new TypeError("parseCsvLine: text must be a string");
+  return parseChecked(text, MAX_FIELDS);
+}
+
+/**
+ * Builds a parseCsvLine with a different field bound. Same contract as
+ * parseCsvLine; the bound only decides how many fields a record may have
+ * before it is rejected with a CsvError. Raising it above MAX_FIELDS does not
+ * help: the engine cannot build a larger array anyway.
+ *
+ * @param {{ maxFields?: number }} [options]
+ * @returns {(text: string) => string[]}
+ */
+export function createCsvLineParser({ maxFields = MAX_FIELDS } = {}) {
+  if (!Number.isSafeInteger(maxFields) || maxFields < 1) {
+    throw new TypeError("createCsvLineParser: maxFields must be a positive integer");
+  }
+  return (text) => parseChecked(text, maxFields);
+}
+
+function parseChecked(text, maxFields) {
+  if (typeof text !== "string") {
+    throw new TypeError("parseCsvLine: text must be a string");
+  }
+  try {
+    return parseRecord(text, maxFields);
+  } catch (e) {
+    if (e instanceof CsvError) throw e;
+    // parseRecord has no code path of its own that throws anything but
+    // CsvError; the only way to get here is an engine resource limit (for
+    // instance a RangeError from growing the result array on an engine whose
+    // limit is below maxFields). The contract says such input is a CsvError.
+    throw new CsvError(`Record could not be parsed: ${e && e.message ? e.message : String(e)}`, undefined, e);
+  }
+}
+
+/**
+ * The parser proper. Only ever throws CsvError by itself.
+ *
+ * @param {string} text
+ * @param {number} maxFields
+ * @returns {string[]}
+ */
+function parseRecord(text, maxFields) {
+  // One record terminator (\n or \r\n) at the very end of the text is removed.
+  // Doing this up front is equivalent to handling it in the state machine: a
+  // trailing newline can never close a quoted field, so it is either the record
+  // terminator or (inside an unclosed quote) part of an input that is an error
+  // regardless.
+  let end = text.length;
+  if (end > 0 && text.charCodeAt(end - 1) === LF) {
+    end -= 1;
+    if (end > 0 && text.charCodeAt(end - 1) === CR) end -= 1;
+  }
+
   const fields = [];
-  let field = "";
-  let quoted = false;
-  let rest = text;
-  while (rest.length > 0) {
-    const ch = rest[0];
-    rest = rest.slice(1);
-    if (ch === '"') {
-      quoted = !quoted;
-    } else if (ch === "," && !quoted) {
-      fields.push(field);
-      field = "";
-    } else {
-      field += ch;
+  let field = ""; // accumulated content of the current field (quoted fields)
+  let chunkStart = 0; // start of the pending literal run in `text`
+  let state = FIELD_START;
+
+  // Every comma outside quotes ends a field and starts another, so a comma
+  // after maxFields complete fields makes the record one field too long
+  // whatever follows. Checking right after each comma's push means the array
+  // never exceeds maxFields (and so never what the engine can hold), the error
+  // is reported at the offending comma, and the final push at `end` needs no
+  // check: at most maxFields - 1 fields are complete when it runs.
+  const tooManyFields = (i) =>
+    new CsvError(`Too many fields at position ${i}; a record may have at most ${maxFields} fields`, i);
+
+  for (let i = 0; i < end; i++) {
+    const c = text.charCodeAt(i);
+
+    switch (state) {
+      case FIELD_START:
+        if (c === COMMA) {
+          fields.push("");
+          if (fields.length === maxFields) throw tooManyFields(i);
+        } else if (c === QUOTE) {
+          state = QUOTED;
+          field = "";
+          chunkStart = i + 1;
+        } else if (c === CR || c === LF) {
+          throw new CsvError(
+            `Unquoted line break at position ${i}; only one record terminator at the end of the text is allowed`,
+            i,
+          );
+        } else {
+          state = UNQUOTED;
+          chunkStart = i;
+        }
+        break;
+
+      case UNQUOTED:
+        if (c === COMMA) {
+          fields.push(text.slice(chunkStart, i));
+          if (fields.length === maxFields) throw tooManyFields(i);
+          state = FIELD_START;
+        } else if (c === QUOTE) {
+          throw new CsvError(
+            `Unexpected quote at position ${i}; a quote may only appear inside a quoted field`,
+            i,
+          );
+        } else if (c === CR || c === LF) {
+          throw new CsvError(
+            `Unquoted line break at position ${i}; only one record terminator at the end of the text is allowed`,
+            i,
+          );
+        }
+        break;
+
+      case QUOTED:
+        if (c === QUOTE) {
+          field += text.slice(chunkStart, i);
+          if (i + 1 < end && text.charCodeAt(i + 1) === QUOTE) {
+            // "" inside quotes is one literal ".
+            field += '"';
+            i += 1;
+            chunkStart = i + 1;
+          } else {
+            state = AFTER_QUOTE;
+          }
+        }
+        break;
+
+      case AFTER_QUOTE:
+        if (c === COMMA) {
+          fields.push(field);
+          if (fields.length === maxFields) throw tooManyFields(i);
+          field = "";
+          state = FIELD_START;
+        } else {
+          throw new CsvError(
+            `Unexpected character after closing quote at position ${i}; only a comma, the record terminator or the end of the text may follow`,
+            i,
+          );
+        }
+        break;
     }
   }
-  fields.push(field);
+
+  if (state === QUOTED) throw new CsvError("Quoted field never closes", end);
+  switch (state) {
+    case FIELD_START:
+      // Covers the empty text ([""]) and a trailing comma ("a," -> ["a", ""]).
+      fields.push("");
+      break;
+    case UNQUOTED:
+      fields.push(text.slice(chunkStart, end));
+      break;
+    case AFTER_QUOTE:
+      fields.push(field);
+      break;
+  }
+
   return fields;
 }
diff --git a/tests/csv.test.mjs b/tests/csv.test.mjs
index 816adc6..a0f1355 100644
--- a/tests/csv.test.mjs
+++ b/tests/csv.test.mjs
@@ -1,22 +1,580 @@
 import assert from "node:assert/strict";
 import { test } from "node:test";
 
-import { CsvError, parseCsvLine } from "../src/csv.mjs";
+import { CsvError, MAX_FIELDS, createCsvLineParser, parseCsvLine } from "../src/csv.mjs";
 
-test("plain fields", () => {
+const csvError = (text) => assert.throws(() => parseCsvLine(text), CsvError, JSON.stringify(text));
+
+// ---------------------------------------------------------------------------
+// README examples
+
+test("README examples", () => {
   assert.deepEqual(parseCsvLine("a,b,c"), ["a", "b", "c"]);
-  assert.deepEqual(parseCsvLine("a,"), ["a", ""]);
+  assert.deepEqual(parseCsvLine('"x, y",z'), ["x, y", "z"]);
+  assert.deepEqual(parseCsvLine('"say ""hi""",'), ['say "hi"', ""]);
+});
+
+// ---------------------------------------------------------------------------
+// Anything that is not a string throws a TypeError.
+
+test("non-string input throws TypeError", () => {
+  const inputs = [
+    undefined,
+    null,
+    0,
+    1,
+    NaN,
+    true,
+    false,
+    {},
+    [],
+    ["a,b"],
+    Symbol("s"),
+    () => "a,b",
+    10n,
+    new String("a,b"),
+    Buffer.from("a,b"),
+    { toString: () => "a,b" },
+    { [Symbol.toPrimitive]: () => "a,b" },
+  ];
+  for (const input of inputs) {
+    assert.throws(() => parseCsvLine(input), TypeError, String(typeof input));
+    assert.throws(() => parseCsvLine(input), (e) => !(e instanceof CsvError));
+  }
+  assert.throws(() => parseCsvLine(), TypeError);
+});
+
+// ---------------------------------------------------------------------------
+// CsvError is exported and is a subclass of Error.
+
+test("CsvError is an Error", () => {
+  const e = new CsvError("x");
+  assert.ok(e instanceof Error);
+  assert.ok(e instanceof CsvError);
+  assert.equal(e.name, "CsvError");
+  assert.equal(e.message, "x");
+  let thrown;
+  try {
+    parseCsvLine('a"b');
+  } catch (err) {
+    thrown = err;
+  }
+  assert.ok(thrown instanceof CsvError);
+  assert.ok(thrown instanceof Error);
+  assert.equal(thrown.name, "CsvError");
+  assert.equal(typeof thrown.message, "string");
+  assert.equal(typeof thrown.index, "number");
+});
+
+// ---------------------------------------------------------------------------
+// Fields are separated by `,`. The empty text is one empty field; `a,` is
+// ["a", ""].
+
+test("comma separation and empty fields", () => {
   assert.deepEqual(parseCsvLine(""), [""]);
+  assert.deepEqual(parseCsvLine("a"), ["a"]);
+  assert.deepEqual(parseCsvLine("a,"), ["a", ""]);
+  assert.deepEqual(parseCsvLine(","), ["", ""]);
+  assert.deepEqual(parseCsvLine(",,"), ["", "", ""]);
+  assert.deepEqual(parseCsvLine(",a"), ["", "a"]);
+  assert.deepEqual(parseCsvLine("a,,b"), ["a", "", "b"]);
+  assert.deepEqual(parseCsvLine(",a,"), ["", "a", ""]);
+  assert.deepEqual(parseCsvLine("a,b,c,"), ["a", "b", "c", ""]);
 });
 
-test("quoted fields keep commas", () => {
-  assert.deepEqual(parseCsvLine('"x, y",z'), ["x, y", "z"]);
+// ---------------------------------------------------------------------------
+// A field may be wrapped in double quotes. Inside quotes, `""` is one `"`, and
+// commas, `\n` and `\r\n` are literal characters of the field.
+
+test("quoted fields", () => {
+  assert.deepEqual(parseCsvLine('""'), [""]);
+  assert.deepEqual(parseCsvLine('"a"'), ["a"]);
+  assert.deepEqual(parseCsvLine('"a","b"'), ["a", "b"]);
+  assert.deepEqual(parseCsvLine('"a",b'), ["a", "b"]);
+  assert.deepEqual(parseCsvLine('a,"b"'), ["a", "b"]);
+  assert.deepEqual(parseCsvLine('"",""'), ["", ""]);
+  assert.deepEqual(parseCsvLine('"",'), ["", ""]);
+  assert.deepEqual(parseCsvLine(',""'), ["", ""]);
+  assert.deepEqual(parseCsvLine('"a,b"'), ["a,b"]);
+  assert.deepEqual(parseCsvLine('","'), [","]);
+  assert.deepEqual(parseCsvLine('",",","'), [",", ","]);
 });
 
-test("non-string input", () => {
-  assert.throws(() => parseCsvLine(null), TypeError);
+test("escaped quotes inside quotes", () => {
+  assert.deepEqual(parseCsvLine('""""'), ['"']);
+  assert.deepEqual(parseCsvLine('""""""'), ['""']);
+  assert.deepEqual(parseCsvLine('"a""b"'), ['a"b']);
+  assert.deepEqual(parseCsvLine('"""a"""'), ['"a"']);
+  assert.deepEqual(parseCsvLine('"""",""""'), ['"', '"']);
+  assert.deepEqual(parseCsvLine('"a""",b'), ['a"', "b"]);
+  assert.deepEqual(parseCsvLine('"""a",b'), ['"a', "b"]);
+  assert.deepEqual(parseCsvLine('"a"""'), ['a"']);
+  assert.deepEqual(parseCsvLine('"""",'), ['"', ""]);
+  assert.deepEqual(parseCsvLine('"a"",""b"'), ['a","b']);
 });
 
-test("CsvError is an Error", () => {
-  assert.ok(new CsvError("x") instanceof Error);
+test("line breaks inside quotes are literal", () => {
+  assert.deepEqual(parseCsvLine('"a\nb"'), ["a\nb"]);
+  assert.deepEqual(parseCsvLine('"a\r\nb"'), ["a\r\nb"]);
+  assert.deepEqual(parseCsvLine('"a\rb"'), ["a\rb"]);
+  assert.deepEqual(parseCsvLine('"\n"'), ["\n"]);
+  assert.deepEqual(parseCsvLine('"\r\n"'), ["\r\n"]);
+  assert.deepEqual(parseCsvLine('"\r"'), ["\r"]);
+  assert.deepEqual(parseCsvLine('"\n\n\n"'), ["\n\n\n"]);
+  assert.deepEqual(parseCsvLine('"a\n",b'), ["a\n", "b"]);
+  assert.deepEqual(parseCsvLine('"a\n"\n'), ["a\n"]);
+  assert.deepEqual(parseCsvLine('"a\r\n"\r\n'), ["a\r\n"]);
+  assert.deepEqual(parseCsvLine('"a\n",b\r\n'), ["a\n", "b"]);
+});
+
+// ---------------------------------------------------------------------------
+// After a closing quote, only a comma, the record terminator or the end of the
+// text may follow; anything else is a CsvError. A quoted field that never
+// closes is a CsvError.
+
+test("only comma, terminator or end may follow a closing quote", () => {
+  assert.deepEqual(parseCsvLine('"a"'), ["a"]);
+  assert.deepEqual(parseCsvLine('"a",'), ["a", ""]);
+  assert.deepEqual(parseCsvLine('"a"\n'), ["a"]);
+  assert.deepEqual(parseCsvLine('"a"\r\n'), ["a"]);
+  csvError('"a"b');
+  csvError('"a" ');
+  csvError('"a" ,b');
+  csvError('"a"\t');
+  csvError('"a"\r');
+  csvError('"a"\n\n');
+  csvError('"a"\nb');
+  csvError('"a"\r\nb');
+  csvError('"a"\n,');
+  csvError('"a""');
+  assert.deepEqual(parseCsvLine('"a"" b"'), ['a" b']); // "" inside quotes is an escape, not a close
+  csvError('"a" ');
+  csvError('"a" ');
+  csvError('"a"x,b');
+  csvError('x,"a"b');
+});
+
+test("unclosed quoted field is a CsvError", () => {
+  csvError('"');
+  csvError('"a');
+  csvError('"a,b');
+  csvError('a,"b');
+  csvError('a,"');
+  csvError('"a""');
+  csvError('"""');
+  csvError('"a\n');
+  csvError('"a\r\n');
+  csvError('"a"",b');
+  csvError('"\n');
+  csvError('"a\nb\n');
+});
+
+// ---------------------------------------------------------------------------
+// Outside quotes, a `"` anywhere is a CsvError (`a"b`, `a "b"`).
+
+test("quote outside quotes is a CsvError", () => {
+  csvError('a"b');
+  csvError('a "b"');
+  csvError('a"');
+  csvError('a""');
+  csvError(' "a"');
+  csvError('a,b"');
+  csvError('a,b"c');
+  csvError('a, "b"');
+  csvError('a,b "c"');
+  assert.deepEqual(parseCsvLine('a," b"'), ["a", " b"]); // quoted second field is fine
+  csvError('ab"cd,e');
+  csvError('\t"a"');
+  csvError('a"b"c');
+  csvError('a""b');
+});
+
+// ---------------------------------------------------------------------------
+// Whitespace outside quotes is part of the field: ' a ' stays " a ".
+
+test("whitespace outside quotes is kept", () => {
+  assert.deepEqual(parseCsvLine(" a "), [" a "]);
+  assert.deepEqual(parseCsvLine(" "), [" "]);
+  assert.deepEqual(parseCsvLine("   "), ["   "]);
+  assert.deepEqual(parseCsvLine(" , "), [" ", " "]);
+  assert.deepEqual(parseCsvLine("a , b"), ["a ", " b"]);
+  assert.deepEqual(parseCsvLine("\ta\t"), ["\ta\t"]);
+  assert.deepEqual(parseCsvLine("\t,\t"), ["\t", "\t"]);
+  assert.deepEqual(parseCsvLine(" a "), [" a "]);
+  assert.deepEqual(parseCsvLine(" \n"), [" "]);
+  assert.deepEqual(parseCsvLine('" a "'), [" a "]);
+  assert.deepEqual(parseCsvLine('" a ", b '), [" a ", " b "]);
+});
+
+// ---------------------------------------------------------------------------
+// One record terminator (\n or \r\n) at the very end of the text is removed;
+// any other unquoted \r or \n is a CsvError.
+
+test("one trailing record terminator is removed", () => {
+  assert.deepEqual(parseCsvLine("a\n"), ["a"]);
+  assert.deepEqual(parseCsvLine("a\r\n"), ["a"]);
+  assert.deepEqual(parseCsvLine("a,b\n"), ["a", "b"]);
+  assert.deepEqual(parseCsvLine("a,b\r\n"), ["a", "b"]);
+  assert.deepEqual(parseCsvLine("a,\n"), ["a", ""]);
+  assert.deepEqual(parseCsvLine("a,\r\n"), ["a", ""]);
+  assert.deepEqual(parseCsvLine("\n"), [""]);
+  assert.deepEqual(parseCsvLine("\r\n"), [""]);
+  assert.deepEqual(parseCsvLine(",\n"), ["", ""]);
+  assert.deepEqual(parseCsvLine('"a"\n'), ["a"]);
+  assert.deepEqual(parseCsvLine('"a"\r\n'), ["a"]);
+  assert.deepEqual(parseCsvLine('"a",\r\n'), ["a", ""]);
+  assert.deepEqual(parseCsvLine('""\n'), [""]);
+});
+
+test("any other unquoted CR or LF is a CsvError", () => {
+  csvError("\r");
+  csvError("a\r");
+  csvError("a\rb");
+  csvError("a\nb");
+  csvError("a\r\nb");
+  csvError("\na");
+  csvError("\ra");
+  csvError("\r\na");
+  csvError("a\n\n");
+  csvError("a\r\n\r\n");
+  csvError("a\n\r\n");
+  csvError("a\r\n\n");
+  csvError("\n\n");
+  csvError("\r\r\n");
+  csvError("a\r\r\n");
+  csvError("a\n\r");
+  csvError("\n\r");
+  csvError("a,\nb");
+  csvError("a\n,b");
+  csvError("a,b\n,c");
+  csvError("a\rb\n");
+  csvError('a,"b"\n\n');
+  csvError('\n"a"');
+  csvError("\r\n\r\n");
+});
+
+// ---------------------------------------------------------------------------
+// Every other character, including tabs, control characters and any Unicode,
+// is a literal character of its field.
+
+test("all other characters are literal", () => {
+  assert.deepEqual(parseCsvLine("a\tb"), ["a\tb"]);
+  assert.deepEqual(parseCsvLine("\t"), ["\t"]);
+  assert.deepEqual(parseCsvLine("a\0b"), ["a\0b"]);
+  assert.deepEqual(parseCsvLine("\0"), ["\0"]);
+  assert.deepEqual(parseCsvLine("\x01\x02\x1f\x7f"), ["\x01\x02\x1f\x7f"]);
+  assert.deepEqual(parseCsvLine("a\vb\fc"), ["a\vb\fc"]);
+  assert.deepEqual(parseCsvLine("a\bb"), ["a\bb"]);
+  assert.deepEqual(parseCsvLine("\x1b[31mred\x1b[0m"), ["\x1b[31mred\x1b[0m"]);
+  assert.deepEqual(parseCsvLine("héllo,wörld"), ["héllo", "wörld"]);
+  assert.deepEqual(parseCsvLine("日本語,中文"), ["日本語", "中文"]);
+  assert.deepEqual(parseCsvLine("😀,👍🏽"), ["😀", "👍🏽"]);
+  assert.deepEqual(parseCsvLine("a​b"), ["a​b"]);
+  assert.deepEqual(parseCsvLine("﻿a"), ["﻿a"]);
+  assert.deepEqual(parseCsvLine(" , "), [" ", " "]);
+  assert.deepEqual(parseCsvLine("\u0085"), ["\u0085"]);
+  assert.deepEqual(parseCsvLine("\ud800"), ["\ud800"]);
+  assert.deepEqual(parseCsvLine("\udc00,\ud800"), ["\udc00", "\ud800"]);
+  assert.deepEqual(parseCsvLine("a\ud800,b"), ["a\ud800", "b"]);
+  assert.deepEqual(parseCsvLine("'a'"), ["'a'"]);
+  assert.deepEqual(parseCsvLine("`a`"), ["`a`"]);
+  assert.deepEqual(parseCsvLine(";|\\"), [";|\\"]);
+  assert.deepEqual(parseCsvLine("\\n,\\r\\n"), ["\\n", "\\r\\n"]);
+  assert.deepEqual(parseCsvLine('"a\tb"'), ["a\tb"]);
+  assert.deepEqual(parseCsvLine('"\0"'), ["\0"]);
+  assert.deepEqual(parseCsvLine('"😀"'), ["😀"]);
+  assert.deepEqual(parseCsvLine('"\ud800"'), ["\ud800"]);
+  assert.deepEqual(parseCsvLine('"﻿"'), ["﻿"]);
+  // Unicode quote look-alikes are not quotes.
+  assert.deepEqual(parseCsvLine("“a”"), ["“a”"]);
+  assert.deepEqual(parseCsvLine("＂a＂"), ["＂a＂"]);
+  // Full-width comma is not a separator.
+  assert.deepEqual(parseCsvLine("a，b"), ["a，b"]);
+});
+
+// ---------------------------------------------------------------------------
+// Returned value is always a fresh array of primitive strings.
+
+test("result is an array of strings", () => {
+  for (const text of ["", "a", "a,b", '"a"', '"a""b",c\n']) {
+    const out = parseCsvLine(text);
+    assert.ok(Array.isArray(out));
+    assert.ok(out.length >= 1);
+    for (const f of out) assert.equal(typeof f, "string");
+  }
+  assert.notEqual(parseCsvLine("a"), parseCsvLine("a"));
+});
+
+test("field count matches the number of unquoted commas plus one", () => {
+  assert.equal(parseCsvLine(",".repeat(1000)).length, 1001);
+  assert.deepEqual(parseCsvLine(",".repeat(3)), ["", "", "", ""]);
+  assert.equal(parseCsvLine('","'.repeat(1)).length, 1);
+});
+
+// ---------------------------------------------------------------------------
+// Never hangs; returns within a second for a record of 100 KB.
+
+function timed(text) {
+  const start = process.hrtime.bigint();
+  let result;
+  try {
+    result = parseCsvLine(text);
+  } catch (e) {
+    assert.ok(e instanceof CsvError, `unexpected throw: ${e}`);
+    result = e;
+  }
+  const ms = Number(process.hrtime.bigint() - start) / 1e6;
+  assert.ok(ms < 1000, `took ${ms.toFixed(1)} ms`);
+  return result;
+}
+
+const KB100 = 100 * 1024;
+
+test("100 KB records parse within a second", () => {
+  // One huge unquoted field.
+  assert.deepEqual(timed("x".repeat(KB100)), ["x".repeat(KB100)]);
+  // One huge quoted field.
+  assert.deepEqual(timed('"' + "x".repeat(KB100 - 2) + '"'), ["x".repeat(KB100 - 2)]);
+  // Only commas: many empty fields.
+  assert.equal(timed(",".repeat(KB100)).length, KB100 + 1);
+  // Many small fields.
+  const many = Array.from({ length: KB100 / 4 }, (_, i) => String(i % 10)).join(",,,");
+  assert.equal(timed(many).length, (KB100 / 4 - 1) * 3 + 1);
+  // Many small quoted fields.
+  const manyQuoted = '"a",'.repeat(KB100 / 4);
+  assert.equal(timed(manyQuoted).length, KB100 / 4 + 1);
+  // Quoted field made entirely of escaped quotes.
+  assert.deepEqual(timed('"' + '""'.repeat(KB100 / 2) + '"'), ['"'.repeat(KB100 / 2)]);
+  // Alternating escaped quotes and content.
+  assert.deepEqual(timed('"' + 'a""'.repeat(KB100 / 3) + '"'), ['a"'.repeat(KB100 / 3)]);
+  // Quoted field full of line breaks.
+  assert.deepEqual(timed('"' + "\r\n".repeat(KB100 / 2) + '"'), ["\r\n".repeat(KB100 / 2)]);
+  // Non-ASCII payload.
+  assert.deepEqual(timed("日".repeat(KB100)), ["日".repeat(KB100)]);
+  assert.deepEqual(timed("😀".repeat(KB100 / 2)), ["😀".repeat(KB100 / 2)]);
+  // Error found only at the very end.
+  assert.ok(timed("x".repeat(KB100) + '"') instanceof CsvError);
+  assert.ok(timed('"' + "x".repeat(KB100)) instanceof CsvError);
+  assert.ok(timed('"' + "x".repeat(KB100) + '"x') instanceof CsvError);
+  assert.ok(timed("x".repeat(KB100) + "\r") instanceof CsvError);
+  // Error at the very start of a long input.
+  assert.ok(timed('"' + "x".repeat(KB100) + "\n") instanceof CsvError);
+  assert.ok(timed("\n" + "x".repeat(KB100)) instanceof CsvError);
+  // Long run of quotes outside quotes / unbalanced.
+  assert.ok(timed('"'.repeat(KB100 + 1)) instanceof CsvError);
+  assert.deepEqual(timed('"'.repeat(KB100 + 2)), ['"'.repeat(KB100 / 2)]);
+  assert.ok(timed('a' + '"'.repeat(KB100)) instanceof CsvError);
+  // Long runs of whitespace and control characters.
+  assert.deepEqual(timed(" ".repeat(KB100)), [" ".repeat(KB100)]);
+  assert.deepEqual(timed("\0".repeat(KB100)), ["\0".repeat(KB100)]);
+  // 100 KB with the terminator.
+  assert.deepEqual(timed("x".repeat(KB100 - 2) + "\r\n"), ["x".repeat(KB100 - 2)]);
+});
+
+test("larger inputs still finish quickly", () => {
+  const MB = 1024 * 1024;
+  assert.equal(timed("a,".repeat(MB / 2)).length, MB / 2 + 1);
+  assert.equal(timed('"' + 'x""'.repeat(MB / 3) + '"').length, 1);
+});
+
+// ---------------------------------------------------------------------------
+// traces/range-error-on-many-fields.md: a record of 2**27 commas made
+// `fields.push` throw V8's RangeError ("Invalid array length") instead of a
+// CsvError. The fix bounds the field count at MAX_FIELDS (= 2**27, the largest
+// array V8 can grow by push) and throws CsvError before the engine limit is
+// hit. Reproducing the trace verbatim needs 128 MiB of input and ~3 GB of RAM,
+// so these tests drive the same code path through the injectable bound
+// (createCsvLineParser({ maxFields })) with small inputs; the trace command is
+// run by hand and recorded in CHANGES.md.
+
+test("MAX_FIELDS is the engine's array limit and is what parseCsvLine uses", () => {
+  assert.equal(MAX_FIELDS, 2 ** 27);
+  assert.ok(Number.isSafeInteger(MAX_FIELDS));
+  // Exactly MAX_FIELDS fields (2**27 - 1 commas) parses; one more comma is a
+  // CsvError. That is the trace's boundary: 2**27 - 1 commas returned fine,
+  // 2**27 commas threw RangeError. Checked here on the injected bound with the
+  // same arithmetic, and by hand with the real one (see CHANGES.md).
+  const parse = createCsvLineParser({ maxFields: 2 ** 4 });
+  assert.equal(parse(",".repeat(2 ** 4 - 1)).length, 2 ** 4);
+  assert.throws(() => parse(",".repeat(2 ** 4)), CsvError);
+});
+
+test("too many fields is a CsvError, not a RangeError (trace: range-error-on-many-fields)", () => {
+  const parse = createCsvLineParser({ maxFields: 3 });
+
+  // At most three fields: fine in every shape.
+  assert.deepEqual(parse(""), [""]);
+  assert.deepEqual(parse("a,b,c"), ["a", "b", "c"]);
+  assert.deepEqual(parse(",,"), ["", "", ""]);
+  assert.deepEqual(parse('"a","b","c"'), ["a", "b", "c"]);
+  assert.deepEqual(parse('"a",b,"c"\r\n'), ["a", "b", "c"]);
+  assert.deepEqual(parse("a,b,\n"), ["a", "b", ""]);
+
+  // A fourth field, however it is produced, is a CsvError and nothing else.
+  const tooMany = (text) => {
+    let thrown;
+    try {
+      parse(text);
+    } catch (e) {
+      thrown = e;
+    }
+    assert.ok(thrown instanceof CsvError, `${JSON.stringify(text)} threw ${thrown}`);
+    assert.ok(!(thrown instanceof RangeError), JSON.stringify(text));
+    assert.equal(thrown.name, "CsvError");
+    assert.equal(typeof thrown.index, "number");
+    assert.match(thrown.message, /Too many fields/);
+    return thrown;
+  };
+  tooMany(",,,"); // the trace's shape: only commas (FIELD_START branch)
+  tooMany("a,b,c,d"); // unquoted fields
+  tooMany("a,b,c,"); // trailing empty field
+  tooMany('"a","b","c","d"'); // quoted fields (AFTER_QUOTE branch)
+  tooMany('"a","b","c",'); // quoted then trailing empty
+  tooMany("a,b,c,d\n"); // with the record terminator
+  tooMany(",,,,,,,,,,"); // well past the bound
+  tooMany(",".repeat(10000));
+
+  // The error points at the comma (or the end) that would start the field past
+  // the bound, and the parser stops there rather than scanning on.
+  assert.equal(tooMany(",,,").index, 2);
+  assert.equal(tooMany("a,b,c,d").index, 5);
+  assert.equal(tooMany('"a","b","c","d"').index, 11);
+  assert.equal(tooMany(",".repeat(10000)).index, 2);
+
+  // Earlier syntax errors still win over the bound, and vice versa.
+  assert.throws(() => parse('a"b,c,d,e'), /Unexpected quote/);
+  assert.throws(() => parse('a,b,c,d,"e'), /Too many fields/);
+
+  // A bound of 1 still admits the single-field records the README lists.
+  const one = createCsvLineParser({ maxFields: 1 });
+  assert.deepEqual(one(""), [""]);
+  assert.deepEqual(one("a"), ["a"]);
+  assert.deepEqual(one('"a,b"'), ["a,b"]);
+  assert.deepEqual(one("a\n"), ["a"]);
+  assert.throws(() => one(","), CsvError);
+  assert.throws(() => one("a,"), CsvError);
+});
+
+test("createCsvLineParser defaults to MAX_FIELDS and rejects bad bounds", () => {
+  const parse = createCsvLineParser();
+  assert.deepEqual(parse("a,b"), ["a", "b"]);
+  assert.deepEqual(createCsvLineParser({})("a,b"), ["a", "b"]);
+  assert.equal(parse(",".repeat(KB100)).length, KB100 + 1);
+  assert.throws(() => parse(1), TypeError);
+  for (const bad of [0, -1, 1.5, NaN, Infinity, "3", null, 2 ** 53]) {
+    assert.throws(() => createCsvLineParser({ maxFields: bad }), TypeError, String(bad));
+  }
+});
+
+test("CsvError can carry a cause without an index", () => {
+  // Shape of the error the last-resort guard in parseCsvLine builds when the
+  // engine (not the parser) throws while the result is assembled. The guard
+  // itself cannot be provoked deterministically without exceeding a real
+  // engine limit, so only the error shape is checked here.
+  const cause = new RangeError("Invalid array length");
+  const e = new CsvError("Record could not be parsed: Invalid array length", undefined, cause);
+  assert.ok(e instanceof CsvError);
+  assert.ok(e instanceof Error);
+  assert.equal(e.cause, cause);
+  assert.equal("index" in e, false);
+  assert.equal("cause" in new CsvError("x", 1), false);
+});
+
+// ---------------------------------------------------------------------------
+// For every string, the result is an array of strings or a CsvError: nothing
+// else is ever thrown. A deterministic pseudo-random sweep over the alphabet
+// that matters plus a reference parser to confirm the fields.
+
+function referenceParse(text) {
+  // A straightforward, independent implementation of the README, used to
+  // cross-check the production parser on random inputs.
+  let body = text;
+  if (body.endsWith("\r\n")) body = body.slice(0, -2);
+  else if (body.endsWith("\n")) body = body.slice(0, -1);
+  const fields = [];
+  let i = 0;
+  for (;;) {
+    let field = "";
+    if (body[i] === '"') {
+      i++;
+      for (;;) {
+        if (i >= body.length) return null; // never closes
+        if (body[i] === '"') {
+          if (body[i + 1] === '"') {
+            field += '"';
+            i += 2;
+          } else {
+            i++;
+            break;
+          }
+        } else {
+          field += body[i++];
+        }
+      }
+      if (i < body.length && body[i] !== ",") return null; // junk after quote
+    } else {
+      while (i < body.length && body[i] !== ",") {
+        const ch = body[i];
+        if (ch === '"' || ch === "\r" || ch === "\n") return null;
+        field += ch;
+        i++;
+      }
+    }
+    fields.push(field);
+    if (i >= body.length) return fields;
+    i++; // skip comma
+  }
+}
+
+function makeRng(seed) {
+  let s = seed >>> 0;
+  return () => {
+    s = (s + 0x6d2b79f5) >>> 0;
+    let t = Math.imul(s ^ (s >>> 15), 1 | s);
+    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
+    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
+  };
+}
+
+test("random strings yield fields or CsvError, matching a reference parser", () => {
+  const alphabet = ['"', '"', '"', ",", ",", "\n", "\r", "a", "b", " ", "\t", "\0", "é", "😀", "\ud800"];
+  const rng = makeRng(20260921);
+  for (let n = 0; n < 20000; n++) {
+    const len = Math.floor(rng() * 12);
+    let text = "";
+    for (let k = 0; k < len; k++) text += alphabet[Math.floor(rng() * alphabet.length)];
+    let actual;
+    try {
+      actual = parseCsvLine(text);
+    } catch (e) {
+      assert.ok(e instanceof CsvError, `${JSON.stringify(text)} threw ${e}`);
+      actual = null;
+    }
+    if (actual !== null) {
+      assert.ok(Array.isArray(actual), JSON.stringify(text));
+      for (const f of actual) assert.equal(typeof f, "string", JSON.stringify(text));
+    }
+    assert.deepEqual(actual, referenceParse(text), JSON.stringify(text));
+  }
+});
+
+test("exhaustive short strings over the CSV alphabet", () => {
+  const alphabet = ['"', ",", "\n", "\r", "a", " "];
+  const maxLen = 6;
+  let count = 0;
+  const walk = (prefix, depth) => {
+    let actual;
+    try {
+      actual = parseCsvLine(prefix);
+    } catch (e) {
+      assert.ok(e instanceof CsvError, `${JSON.stringify(prefix)} threw ${e}`);
+      actual = null;
+    }
+    assert.deepEqual(actual, referenceParse(prefix), JSON.stringify(prefix));
+    count++;
+    if (depth === maxLen) return;
+    for (const ch of alphabet) walk(prefix + ch, depth + 1);
+  };
+  walk("", 0);
+  assert.ok(count > 50000);
 });
```

# What to do

For each candidate, score it from 1 to 5 against the task and the acceptance material (5: every requirement clearly met with tests that would catch a regression; 3: the main behaviour is right but a requirement is unmet, untested or fragile; 1: does not do the task), with two or three sentences of reasons that cite the diff. Then rank all candidates from best to worst; ties are allowed only when you can say why two are indistinguishable. Judge the deliverable, not its volume: more lines are not more credit.

End your reply with exactly one fenced JSON block of this shape, and nothing after it:

```json
{
  "scores": { "D": { "score": <1-5>, "reasons": "<two or three sentences>" }, "S": { "score": <1-5>, "reasons": "<two or three sentences>" }, "L": { "score": <1-5>, "reasons": "<two or three sentences>" }, "E": { "score": <1-5>, "reasons": "<two or three sentences>" }, "G": { "score": <1-5>, "reasons": "<two or three sentences>" }, "P": { "score": <1-5>, "reasons": "<two or three sentences>" } },
  "ranking": ["D", "S", "L", "E", "G", "P"],
  "notes": "<anything that applied to several candidates, in at most three sentences>"
}
```


## Reply

**Candidate D.** The parser is correct on every contract line: terminator stripped once up front, quoted fields scanned with `indexOf` and `parts.join`, closing-quote follow-up restricted to comma or end, unquoted quotes and line breaks rejected. Tests cover each README bullet with well-chosen edge cases such as `'"a"""\n'`, `'"a"\n"'`, lone surrogates and ten 100 KB shapes including error shapes, and the original tests are kept intact. The fuzz test only checks result shape rather than comparing to an oracle, so it is the weakest of the correct five on regression detection.

**Candidate S.** Same parser design with an `end` bound and `value +=` accumulation; all edge cases I traced (`"a""`, `"a"""`, empty text, trailing comma) behave correctly. Tests are strong: an independent state-machine reference, exhaustive comparison over all strings up to length 6 on the five grammar characters, a random full-UTF-16 fuzz for "nothing else is thrown", and per-shape perf cases. The 500 ms perf threshold is tighter than the contract needs, a minor flake risk.

**Candidate L.** Parser is correct; the `closed` flag handles `"`, `"a""` and `"a"""` properly, and post-quote validation is right. Tests cover every contract bullet, add a quoting round-trip check and a 10 MB linearity test. The exhaustive short-string test only asserts shape (no reference oracle), so a subtle field-content regression would rely on the hand-written cases alone.

**Candidate E.** Parser is correct and adds a backward-compatible `position` on `CsvError`. Tests are excellent: an independent reference over all strings to length 5, a 20 000-case serializer round-trip fuzz, position assertions, and sixteen 100 KB/1 MB shapes with a content-correctness check for large records. Nothing missing.

**Candidate G.** Parser is correct and neat (lazy `parts`, keeps the first of each `""`); adds an `index` on `CsvError`. Tests are the most rigorous: oracle-based fuzz, exhaustive length-6 over a six-character alphabet with a verified count, round-trip encoding, statelessness and mutation checks, and per-shape perf tests each with content assertions.

**Candidate P.** The state-machine parser itself is correct and tests are thorough with a reference parser and exhaustive sweep. But the deliverable widens scope: new public exports `MAX_FIELDS` and `createCsvLineParser`, a catch-all that rewraps any non-CsvError (which would mask parser bugs as CsvError), and test comments citing `traces/range-error-on-many-fields.md` and results "recorded in CHANGES.md" that are not in the diff or the acceptance material. That is unverified provenance and API surface the task did not ask for.

```json
{
  "scores": {
    "D": { "score": 5, "reasons": "Parser honours every contract line (up-front terminator strip, indexOf-based quoted scan, strict post-quote check, unquoted quote/line-break rejection) and traced edge cases like '\"a\"\"\"\\n' and '\"a\"\\n\"' are right. Tests cover each README bullet plus ten 100 KB shapes and keep the original tests. The fuzz test checks only result shape, not content against an oracle." },
    "S": { "score": 5, "reasons": "Correct single-pass parser with the same end-bound design. Tests add an independent reference parser, exhaustive comparison over all strings up to length 6, a random full-UTF-16 fuzz for 'nothing else thrown', and many perf shapes. The 500 ms perf threshold is stricter than needed and slightly flake-prone." },
    "L": { "score": 5, "reasons": "Correct parser; the closed flag handles '\"', '\"a\"\"' and '\"a\"\"\"' properly and post-quote validation is right. Tests cover every bullet, a quoting round-trip and a 10 MB linearity check. Exhaustive short-string test asserts shape only, so content regressions rely on hand-written cases." },
    "E": { "score": 5, "reasons": "Correct parser with a compatible position field on CsvError. Tests include an independent reference over all strings to length 5, a 20 000-case serializer round-trip fuzz, position assertions, and sixteen large-record shapes with a separate content-correctness test. Nothing unmet." },
    "G": { "score": 5, "reasons": "Correct parser with lazy parts accumulation and an index on CsvError. Tests are the most rigorous: oracle fuzz, exhaustive length-6 sweep with verified count, round-trip encoding, statelessness/mutation checks, and per-shape perf tests each asserting content." },
    "P": { "score": 4, "reasons": "The state-machine parser is correct and the oracle/exhaustive tests are strong. But it widens scope with new exports MAX_FIELDS and createCsvLineParser, a catch-all that rewraps any unexpected error as CsvError (masking bugs), and test comments citing a trace file and CHANGES.md that are absent from the diff and the acceptance material." }
  },
  "ranking": ["G", "E", "S", "L", "D", "P"],
  "notes": "All six use the same design: strip one trailing terminator first, then a linear index scan with a QUOTE/COMMA/CR/LF check, and all correctly treat a lone \\r inside quotes as literal. Five are functionally indistinguishable on the contract; ranking among them reflects whether tests compare against an independent reference (G, E, S) versus shape-only fuzzing (L, D). Only P addresses the theoretical 2**27-field RangeError, but at 128 MiB of input it is far outside the 100 KB contract and its handling adds unrequested API surface."
}
```
