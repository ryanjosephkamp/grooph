# Blind judge · review-gate-2

Model `claude-opus-5-5`, no tools, fresh session, 2026-10-04T21:41:21.042Z; ledger invocation 49, $0.5022. The letters' mapping is in `mapping.json`, which the judge never saw.

## Prompt

You are a critic judging 8 candidate changes to one small Node project. Each candidate was produced by a different session working from the same task; you do not know how, and you should not guess. Judge only what the diff shows against the task and its acceptance material. You have no tools: read carefully and cite lines of the diff.

# The task

Add `layer(base, over)` in a new file, src/layer.mjs: it returns the settings you get by laying `over` on top of `base`. Where both hold a plain object under the same key, the two are layered key by key, at any depth; otherwise a value given in `over` replaces the one in `base`, and a key only one of them has is kept. Both arguments must be plain objects, or it throws a TypeError. Tests go in tests/layer.test.mjs, and CHANGELOG.md gets a line.

# Acceptance material the builder saw

### README.md

```
# settingskit

Settings for a command-line tool, as plain data.

A tool's settings come in layers: the defaults it ships with, the user's
settings file, and the flags of one run. Each layer is a plain object, read
from JSON or TOML or built from the command line.

```js
import { getPath } from "./src/get.mjs";

const settings = { output: { color: "auto", width: 80 } };

getPath(settings, "output.color");     // "auto"
getPath(settings, "output.pager", ""); // "" (the fallback: no such setting)
```

`getPath(settings, path, fallback)` reads one setting by a dotted path. It
returns the fallback (`undefined` when none is given) if any step of the path
is missing. A `path` that is not a non-empty string throws a `TypeError`.
```

### docs/REVIEW-CHECKLIST.md

```
# Review checklist

The change is done when every item here holds. Cite the file and line that
satisfies each one, or say plainly that it is unmet.

1. `src/layer.mjs` exists and exports `layer`.
2. Laying one layer on another works as the task says, and a test covers each
   point: `layer({ a: 1, b: { c: 2, d: 3 } }, { b: { c: 9 }, e: 5 })` is
   `{ a: 1, b: { c: 9, d: 3 }, e: 5 }`; plain objects under the same key are
   layered at any depth; an array, a number, a string, a boolean or `null`
   given in `over` replaces whatever `base` holds under that key, and an array
   is replaced whole, never joined.
3. Both arguments must be plain objects: an array, `null`, a string, a number,
   a `Date`, or an argument left out throws a `TypeError`. A test covers each.
4. Neither argument is changed, and the result shares nothing with them: no
   object or array reachable from the result is the same object as one
   reachable from `base` or `over`, at any depth and inside arrays too, so
   changing the result later never changes a layer. A test shows it.
5. Keys named `__proto__`, `constructor` or `prototype` are never copied, from
   either argument, at any depth and inside arrays too, and every plain object
   in the result is an ordinary object (its prototype is `Object.prototype`).
   A test shows it.
6. `CHANGELOG.md` has a line under `## Unreleased` that names `layer` and says
   what it does, in the style of the entries below it.
7. `npm test` exits 0, and no test is skipped or marked todo.
8. Nothing outside `src/`, `tests/` and `CHANGELOG.md` changed, apart from the
   written record of the work (`REVIEW.md`, `CHANGES.md`).
```

### CHANGELOG.md

```
# Changelog

## Unreleased

## 0.4.0 — 2026-09-12

- Added a `fallback` argument to `getPath(settings, path, fallback)`: returned when the path is missing.

## 0.3.0 — 2026-08-21

- Added `getPath(settings, path)`: reads one setting by a dotted path such as `output.color`.
```

# Candidates (in random order, under random letters)

## Candidate H

```diff
diff --git a/CHANGELOG.md b/CHANGELOG.md
index 83e52ac..d8b4736 100644
--- a/CHANGELOG.md
+++ b/CHANGELOG.md
@@ -2,6 +2,8 @@
 
 ## Unreleased
 
+- Added `layer(base, over)`: lays one settings object on top of another, layering nested plain objects key by key and replacing any other value; neither argument is changed.
+
 ## 0.4.0 — 2026-09-12
 
 - Added a `fallback` argument to `getPath(settings, path, fallback)`: returned when the path is missing.
diff --git a/src/layer.mjs b/src/layer.mjs
new file mode 100644
index 0000000..71e143e
--- /dev/null
+++ b/src/layer.mjs
@@ -0,0 +1,74 @@
+const FORBIDDEN = new Set(["__proto__", "constructor", "prototype"]);
+
+function isPlainObject(value) {
+  if (value === null || typeof value !== "object") return false;
+  const proto = Object.getPrototypeOf(value);
+  return proto === Object.prototype || proto === null;
+}
+
+// Throws a TypeError for anything that is not a primitive, array, plain
+// object (including null-prototype) or Date, wherever it sits.
+function check(value, path) {
+  if (value === null || (typeof value !== "object" && typeof value !== "function")) return;
+  if (Array.isArray(value)) {
+    value.forEach((item, i) => check(item, `${path}[${i}]`));
+  } else if (isPlainObject(value)) {
+    for (const key of Object.keys(value)) {
+      if (!FORBIDDEN.has(key)) check(value[key], `${path}.${key}`);
+    }
+  } else if (!(value instanceof Date)) {
+    throw new TypeError(`layer: ${path} is not plain data`);
+  }
+}
+
+// Deep copy that shares nothing with the source, drops forbidden keys and
+// keys whose value is undefined. Input must already have passed `check`.
+function copy(value) {
+  if (Array.isArray(value)) return value.map(copy);
+  if (isPlainObject(value)) {
+    const out = {};
+    for (const key of Object.keys(value)) {
+      if (!FORBIDDEN.has(key) && value[key] !== undefined) out[key] = copy(value[key]);
+    }
+    return out;
+  }
+  if (value instanceof Date) return new Date(value.getTime());
+  return value;
+}
+
+function merge(base, over) {
+  const out = {};
+  for (const key of Object.keys(base)) {
+    if (FORBIDDEN.has(key) || base[key] === undefined) continue;
+    if (!Object.hasOwn(over, key) || over[key] === undefined) {
+      out[key] = copy(base[key]);
+    } else if (isPlainObject(base[key]) && isPlainObject(over[key])) {
+      out[key] = merge(base[key], over[key]);
+    } else {
+      out[key] = copy(over[key]);
+    }
+  }
+  for (const key of Object.keys(over)) {
+    if (FORBIDDEN.has(key) || over[key] === undefined) continue;
+    if (!Object.hasOwn(out, key)) out[key] = copy(over[key]);
+  }
+  return out;
+}
+
+/**
+ * Lays `over` on top of `base` and returns the combined settings.
+ * Plain objects under the same key are layered key by key at any depth;
+ * any other value in `over` replaces the one in `base`. A key whose value in
+ * `over` is undefined counts as not given. Neither argument is changed and
+ * the result shares no object or array with them. Values that are not plain
+ * data (functions, Map, Set, class instances, ...) throw a TypeError.
+ * @param {object} base
+ * @param {object} over
+ */
+export function layer(base, over) {
+  if (!isPlainObject(base)) throw new TypeError("layer: base must be a plain object");
+  if (!isPlainObject(over)) throw new TypeError("layer: over must be a plain object");
+  check(base, "base");
+  check(over, "over");
+  return merge(base, over);
+}
diff --git a/tests/layer.test.mjs b/tests/layer.test.mjs
new file mode 100644
index 0000000..95c0160
--- /dev/null
+++ b/tests/layer.test.mjs
@@ -0,0 +1,159 @@
+import assert from "node:assert/strict";
+import { test } from "node:test";
+
+import { layer } from "../src/layer.mjs";
+
+test("layer lays over on top of base, keeping keys only one has", () => {
+  assert.deepEqual(
+    layer({ a: 1, b: { c: 2, d: 3 } }, { b: { c: 9 }, e: 5 }),
+    { a: 1, b: { c: 9, d: 3 }, e: 5 },
+  );
+});
+
+test("layer layers plain objects at any depth", () => {
+  assert.deepEqual(
+    layer({ a: { b: { c: { d: 1, e: 2 } } } }, { a: { b: { c: { e: 3, f: 4 } } } }),
+    { a: { b: { c: { d: 1, e: 3, f: 4 } } } },
+  );
+});
+
+test("layer replaces with arrays, numbers, strings, booleans and null", () => {
+  const base = { k: { x: 1 } };
+  assert.deepEqual(layer(base, { k: [1, 2] }), { k: [1, 2] });
+  assert.deepEqual(layer(base, { k: 0 }), { k: 0 });
+  assert.deepEqual(layer(base, { k: "s" }), { k: "s" });
+  assert.deepEqual(layer(base, { k: false }), { k: false });
+  assert.deepEqual(layer(base, { k: null }), { k: null });
+  assert.deepEqual(layer({ k: 1 }, { k: { x: 1 } }), { k: { x: 1 } });
+  assert.deepEqual(layer({ k: null }, { k: { x: 1 } }), { k: { x: 1 } });
+});
+
+test("layer replaces an array whole, never joining", () => {
+  assert.deepEqual(layer({ k: [1, 2, 3] }, { k: [9] }), { k: [9] });
+  assert.deepEqual(layer({ k: { x: 1 } }, { k: [{ y: 1 }] }), { k: [{ y: 1 }] });
+  assert.deepEqual(layer({ k: [1, 2] }, { k: { x: 1 } }), { k: { x: 1 } });
+});
+
+test("layer refuses arguments that are not plain objects", () => {
+  const bad = [[], null, "s", 3, new Date(), undefined];
+  for (const value of bad) {
+    assert.throws(() => layer(value, {}), TypeError);
+    assert.throws(() => layer({}, value), TypeError);
+  }
+  assert.throws(() => layer(), TypeError);
+  assert.throws(() => layer({}), TypeError);
+  assert.throws(() => layer(undefined, {}), TypeError);
+});
+
+function reachable(value, seen = new Set()) {
+  if (value !== null && typeof value === "object" && !seen.has(value)) {
+    seen.add(value);
+    for (const key of Object.keys(value)) reachable(value[key], seen);
+  }
+  return seen;
+}
+
+test("layer leaves its arguments unchanged and shares nothing with them", () => {
+  const base = { a: { b: [{ n: 1 }, [2]] }, only: { deep: { x: 1 } }, d: new Date(0) };
+  const over = { a: { c: { z: 1 } }, list: [{ q: 1 }, [{ r: 2 }]], a2: { m: 1 } };
+  const baseBefore = structuredClone(base);
+  const overBefore = structuredClone(over);
+
+  const result = layer(base, over);
+  assert.deepEqual(base, baseBefore);
+  assert.deepEqual(over, overBefore);
+
+  const inputs = new Set([...reachable(base), ...reachable(over)]);
+  for (const object of reachable(result)) assert.ok(!inputs.has(object));
+
+  result.a.b[0].n = 99;
+  result.only.deep.x = 99;
+  result.list[1][0].r = 99;
+  result.a.c.z = 99;
+  assert.deepEqual(base, baseBefore);
+  assert.deepEqual(over, overBefore);
+});
+
+test("layer never copies __proto__, constructor or prototype", () => {
+  const evil = JSON.parse(
+    '{"__proto__":{"polluted":1},"constructor":{"x":1},"prototype":{"y":1},' +
+      '"ok":{"__proto__":{"deep":1},"constructor":2,"keep":1},' +
+      '"list":[{"__proto__":{"inArray":1},"constructor":1,"keep":2},[{"prototype":1,"keep":3}]]}',
+  );
+  for (const result of [layer(evil, {}), layer({}, evil), layer(evil, evil)]) {
+    assert.deepEqual(Object.keys(result).sort(), ["list", "ok"]);
+    assert.deepEqual(result.ok, { keep: 1 });
+    assert.deepEqual(result.list, [{ keep: 2 }, [{ keep: 3 }]]);
+    assert.equal({}.polluted, undefined);
+    assert.equal({}.deep, undefined);
+    assert.equal({}.inArray, undefined);
+    for (const object of reachable(result)) {
+      if (!Array.isArray(object)) assert.equal(Object.getPrototypeOf(object), Object.prototype);
+      for (const key of ["__proto__", "constructor", "prototype"]) {
+        assert.ok(!Object.hasOwn(object, key));
+      }
+    }
+  }
+});
+
+test("layer treats undefined in over as not given, at every depth", () => {
+  assert.deepEqual(layer({ verbose: true }, { verbose: undefined }), { verbose: true });
+
+  const base = { output: { color: "auto" } };
+  const kept = layer(base, { output: undefined });
+  assert.deepEqual(kept, { output: { color: "auto" } });
+  assert.notEqual(kept.output, base.output);
+
+  assert.deepEqual(
+    layer({ output: { color: "auto", width: 80 } }, { output: { color: undefined, width: 100 } }),
+    { output: { color: "auto", width: 100 } },
+  );
+
+  const added = layer({ a: 1 }, { pager: undefined });
+  assert.deepEqual(Object.keys(added), ["a"]);
+  assert.ok(!Object.hasOwn(added, "pager"));
+
+  assert.deepEqual(layer({}, { a: { b: undefined } }), { a: {} });
+});
+
+class Point {
+  constructor(x, y) {
+    this.x = x;
+    this.y = y;
+  }
+}
+
+test("layer throws a TypeError for values that are not plain data, wherever they sit", () => {
+  const fn = () => 1;
+  const cases = [
+    () => layer({}, { onChange: fn }),
+    () => layer({}, { lookup: new Map([["a", 1]]) }),
+    () => layer({}, { tags: new Set(["a"]) }),
+    () => layer({}, { origin: new Point(0, 0) }),
+    () => layer({}, { hooks: [fn] }),
+    () => layer({}, { hooks: [[{ deep: fn }]] }),
+    () => layer({ output: { format: (x) => x } }, {}),
+    () => layer({ output: { format: fn } }, { output: { format: "json" } }),
+    () => layer({ a: { b: 1 } }, { a: { b: new Point(1, 2) } }),
+    () => layer({ a: new Point(1, 2) }, { a: 1 }),
+    () => layer({}, { re: /x/ }),
+  ];
+  for (const run of cases) assert.throws(run, TypeError);
+});
+
+test("layer still accepts primitives, arrays, plain objects and Dates", () => {
+  const when = new Date(5);
+  const result = layer({ d: when, n: null }, { list: [1, "a", null, { k: when }] });
+  assert.deepEqual(result.d, when);
+  assert.notEqual(result.d, when);
+  assert.equal(result.n, null);
+  assert.deepEqual(result.list[3].k, when);
+});
+
+test("layer yields ordinary objects even from null-prototype input", () => {
+  const base = Object.assign(Object.create(null), { a: Object.assign(Object.create(null), { b: 1 }) });
+  const result = layer(base, { a: { c: 2 } });
+  assert.deepEqual(result, { a: { b: 1, c: 2 } });
+  assert.equal(Object.getPrototypeOf(result), Object.prototype);
+  assert.equal(Object.getPrototypeOf(result.a), Object.prototype);
+});
```

## Candidate J

```diff
diff --git a/CHANGELOG.md b/CHANGELOG.md
index 83e52ac..fa9aba5 100644
--- a/CHANGELOG.md
+++ b/CHANGELOG.md
@@ -2,6 +2,8 @@
 
 ## Unreleased
 
+- Added `layer(base, over)`: lays one layer of settings on top of another, layering plain objects key by key at any depth.
+
 ## 0.4.0 — 2026-09-12
 
 - Added a `fallback` argument to `getPath(settings, path, fallback)`: returned when the path is missing.
diff --git a/src/layer.mjs b/src/layer.mjs
new file mode 100644
index 0000000..cd0e3fc
--- /dev/null
+++ b/src/layer.mjs
@@ -0,0 +1,78 @@
+// Keys that could reach or replace a prototype; never copied from a layer.
+const UNSAFE_KEYS = new Set(["__proto__", "constructor", "prototype"]);
+
+function isPlainObject(value) {
+  if (value === null || typeof value !== "object") return false;
+  const proto = Object.getPrototypeOf(value);
+  return proto === Object.prototype || proto === null;
+}
+
+function safeKeys(object) {
+  return Object.keys(object).filter((key) => !UNSAFE_KEYS.has(key));
+}
+
+/**
+ * Copies a setting value so the copy shares no object with the original.
+ * Plain objects, arrays and dates are copied; any other object throws.
+ * @param {*} value
+ * @param {Set<object>} seen objects on the current path, to refuse cycles
+ */
+function copy(value, seen) {
+  if (value === null || typeof value !== "object") {
+    if (typeof value === "function") throw new TypeError("layer: a setting cannot be a function");
+    return value;
+  }
+  if (value instanceof Date) return new Date(value.getTime());
+  if (!Array.isArray(value) && !isPlainObject(value)) {
+    throw new TypeError("layer: a setting must be plain data (object, array, date or primitive)");
+  }
+  if (seen.has(value)) throw new TypeError("layer: a layer cannot contain itself");
+  seen.add(value);
+  let result;
+  if (Array.isArray(value)) {
+    result = value.map((item) => copy(item, seen));
+  } else {
+    result = {};
+    for (const key of safeKeys(value)) result[key] = copy(value[key], seen);
+  }
+  seen.delete(value);
+  return result;
+}
+
+/**
+ * @param {Set<object>} baseSeen objects on the current path through `base`
+ * @param {Set<object>} overSeen objects on the current path through `over`
+ */
+function layerInto(base, over, baseSeen, overSeen) {
+  if (baseSeen.has(base) || overSeen.has(over)) throw new TypeError("layer: a layer cannot contain itself");
+  baseSeen.add(base);
+  overSeen.add(over);
+  const result = {};
+  for (const key of safeKeys(base)) {
+    if (!Object.hasOwn(over, key)) result[key] = copy(base[key], baseSeen);
+  }
+  for (const key of safeKeys(over)) {
+    const under = Object.hasOwn(base, key) ? base[key] : undefined;
+    result[key] = isPlainObject(under) && isPlainObject(over[key])
+      ? layerInto(under, over[key], baseSeen, overSeen)
+      : copy(over[key], overSeen);
+  }
+  baseSeen.delete(base);
+  overSeen.delete(over);
+  return result;
+}
+
+/**
+ * Lays one layer of settings on top of another. Plain objects under the same
+ * key are layered key by key, at any depth; any other value in `over`
+ * replaces the one in `base`. Neither layer is changed, and the result
+ * shares no object with them.
+ * @param {object} base
+ * @param {object} over
+ * @returns {object}
+ */
+export function layer(base, over) {
+  if (!isPlainObject(base)) throw new TypeError("layer: base must be a plain object");
+  if (!isPlainObject(over)) throw new TypeError("layer: over must be a plain object");
+  return layerInto(base, over, new Set(), new Set());
+}
diff --git a/tests/layer.test.mjs b/tests/layer.test.mjs
new file mode 100644
index 0000000..cceac1d
--- /dev/null
+++ b/tests/layer.test.mjs
@@ -0,0 +1,154 @@
+import assert from "node:assert/strict";
+import { test } from "node:test";
+
+import { layer } from "../src/layer.mjs";
+
+// Every object and array reachable from a value, including the value itself.
+function reachable(value, found = new Set()) {
+  if (value === null || typeof value !== "object" || found.has(value)) return found;
+  found.add(value);
+  for (const key of Object.keys(value)) reachable(value[key], found);
+  return found;
+}
+
+// Every plain object reachable from a value, by way of objects and arrays.
+function plainObjects(value) {
+  return [...reachable(value)].filter((object) => !Array.isArray(object));
+}
+
+test("layer lays over on top of base", () => {
+  assert.deepEqual(
+    layer({ a: 1, b: { c: 2, d: 3 } }, { b: { c: 9 }, e: 5 }),
+    { a: 1, b: { c: 9, d: 3 }, e: 5 },
+  );
+});
+
+test("layer keeps a key only one layer has", () => {
+  assert.deepEqual(layer({ a: 1 }, {}), { a: 1 });
+  assert.deepEqual(layer({}, { a: 1 }), { a: 1 });
+  assert.deepEqual(layer({}, {}), {});
+});
+
+test("layer layers plain objects under the same key at any depth", () => {
+  const base = { output: { style: { color: "auto", theme: { name: "dark", contrast: 1 } }, width: 80 } };
+  const over = { output: { style: { theme: { contrast: 2 }, bold: true } } };
+  assert.deepEqual(layer(base, over), {
+    output: { style: { color: "auto", theme: { name: "dark", contrast: 2 }, bold: true }, width: 80 },
+  });
+});
+
+test("layer lets a value in over replace whatever base holds", () => {
+  const base = { k: { deep: 1 } };
+  for (const value of [[1, 2], 0, 7, "", "text", true, false, null]) {
+    assert.deepEqual(layer(base, { k: value }), { k: value });
+    assert.deepEqual(layer({ k: 3 }, { k: value }), { k: value });
+  }
+  assert.deepEqual(layer({ k: "text" }, { k: { deep: 1 } }), { k: { deep: 1 } });
+  assert.deepEqual(layer({ k: [1] }, { k: { deep: 1 } }), { k: { deep: 1 } });
+  assert.deepEqual(layer({ k: null }, { k: { deep: 1 } }), { k: { deep: 1 } });
+});
+
+test("layer replaces an array whole and never joins it", () => {
+  assert.deepEqual(layer({ list: [1, 2, 3] }, { list: [9] }), { list: [9] });
+  assert.deepEqual(layer({ list: [{ a: 1 }] }, { list: [{ b: 2 }] }), { list: [{ b: 2 }] });
+  assert.deepEqual(layer({ list: [1, 2] }, { list: [] }), { list: [] });
+});
+
+test("layer refuses an argument that is not a plain object", () => {
+  for (const bad of [[], null, "text", 3, new Date(), undefined]) {
+    assert.throws(() => layer(bad, {}), TypeError);
+    assert.throws(() => layer({}, bad), TypeError);
+  }
+  assert.throws(() => layer(), TypeError);
+  assert.throws(() => layer({}), TypeError);
+});
+
+test("layer changes neither argument and shares nothing with them", () => {
+  const base = { a: { b: { c: 1 } }, list: [{ x: 1 }, [2, { y: 3 }]], only: { z: 1 }, when: new Date(0) };
+  const over = { a: { b: { d: 2 } }, list: [{ x: 9 }, [[{ w: 4 }]]], added: { q: [1] } };
+  const baseBefore = structuredClone(base);
+  const overBefore = structuredClone(over);
+
+  const result = layer(base, over);
+
+  assert.deepEqual(base, baseBefore);
+  assert.deepEqual(over, overBefore);
+
+  const fromLayers = new Set([...reachable(base), ...reachable(over)]);
+  for (const object of reachable(result)) assert.ok(!fromLayers.has(object));
+
+  result.a.b.c = 100;
+  result.list[1][0][0].w = 100;
+  result.only.z = 100;
+  result.added.q.push(2);
+  result.when.setTime(5);
+  assert.deepEqual(base, baseBefore);
+  assert.deepEqual(over, overBefore);
+});
+
+test("layer copies a key kept from base without sharing it", () => {
+  const base = { kept: { deep: [{ v: 1 }] } };
+  const result = layer(base, {});
+  assert.deepEqual(result, base);
+  assert.notEqual(result.kept, base.kept);
+  assert.notEqual(result.kept.deep, base.kept.deep);
+  assert.notEqual(result.kept.deep[0], base.kept.deep[0]);
+});
+
+test("layer never copies __proto__, constructor or prototype keys", () => {
+  const base = JSON.parse(`{
+    "__proto__": { "polluted": "base" },
+    "constructor": { "prototype": { "polluted": "base" } },
+    "prototype": 1,
+    "a": { "__proto__": { "polluted": "base" }, "keep": 1 },
+    "list": [{ "__proto__": { "polluted": "base" }, "constructor": 1, "keep": 2 }]
+  }`);
+  const over = JSON.parse(`{
+    "__proto__": { "polluted": "over" },
+    "constructor": { "polluted": "over" },
+    "prototype": { "polluted": "over" },
+    "a": { "constructor": { "polluted": "over" }, "prototype": 2, "b": { "__proto__": { "polluted": "over" } } },
+    "added": [[{ "prototype": 3, "__proto__": { "polluted": "over" } }]]
+  }`);
+
+  const result = layer(base, over);
+
+  assert.deepEqual(JSON.parse(JSON.stringify(result)), {
+    a: { keep: 1, b: {} },
+    list: [{ keep: 2 }],
+    added: [[{}]],
+  });
+  const unsafe = ["__proto__", "constructor", "prototype"];
+  for (const object of plainObjects(result)) {
+    assert.equal(Object.getPrototypeOf(object), Object.prototype);
+    for (const key of unsafe) assert.ok(!Object.hasOwn(object, key), `own key ${key}`);
+    assert.equal(object.polluted, undefined);
+  }
+  assert.equal({}.polluted, undefined);
+  assert.equal(Object.prototype.polluted, undefined);
+});
+
+test("layer gives ordinary objects for layers with a null prototype", () => {
+  const base = Object.assign(Object.create(null), { a: Object.assign(Object.create(null), { b: 1 }) });
+  const over = Object.assign(Object.create(null), { c: [Object.assign(Object.create(null), { d: 2 })] });
+  const result = layer(base, over);
+  assert.deepEqual(result, { a: { b: 1 }, c: [{ d: 2 }] });
+  for (const object of plainObjects(result)) assert.equal(Object.getPrototypeOf(object), Object.prototype);
+});
+
+test("layer refuses a layer that contains itself", () => {
+  const base = { a: {} };
+  base.a.self = base;
+  assert.throws(() => layer(base, {}), TypeError);
+  const list = [];
+  list.push(list);
+  assert.throws(() => layer({}, { list }), TypeError);
+});
+
+test("layer accepts the same object reached twice without a cycle", () => {
+  const shared = { v: 1 };
+  const result = layer({ a: shared, b: shared }, { c: shared });
+  assert.deepEqual(result, { a: { v: 1 }, b: { v: 1 }, c: { v: 1 } });
+  assert.notEqual(result.a, result.b);
+  assert.deepEqual(layer(shared, shared), { v: 1 });
+});
```

## Candidate W

```diff
diff --git a/CHANGELOG.md b/CHANGELOG.md
index 83e52ac..f48535f 100644
--- a/CHANGELOG.md
+++ b/CHANGELOG.md
@@ -2,6 +2,8 @@
 
 ## Unreleased
 
+- Added `layer(base, over)`: lays `over` on top of `base` and returns a new object, layering plain objects key by key at any depth and replacing any other value (arrays whole); a key set to `undefined` in `over` counts as not given, and a value that is not plain data (function, Map, Set, class instance) throws a `TypeError`; neither argument is changed.
+
 ## 0.4.0 — 2026-09-12
 
 - Added a `fallback` argument to `getPath(settings, path, fallback)`: returned when the path is missing.
diff --git a/src/layer.mjs b/src/layer.mjs
new file mode 100644
index 0000000..3f94420
--- /dev/null
+++ b/src/layer.mjs
@@ -0,0 +1,72 @@
+const BLOCKED = new Set(["__proto__", "constructor", "prototype"]);
+
+// A plain object has Object.prototype or no prototype at all (Object.create(null), JSON.parse).
+function isPlain(value) {
+  if (value === null || typeof value !== "object") return false;
+  const proto = Object.getPrototypeOf(value);
+  return proto === Object.prototype || proto === null;
+}
+
+// Deep copy that shares nothing with `value`. Plain objects and arrays are rebuilt, Dates are
+// copied, blocked keys are dropped, and every rebuilt object is ordinary. Primitives are
+// returned as is. Anything else (functions, symbols, Maps, Sets, class instances, ...) is not
+// plain data and is refused with a TypeError, wherever it sits. With `skipUndefined`, an object
+// key whose value is undefined is treated as not given and left out.
+function copy(value, skipUndefined, path = new Set()) {
+  const isArray = Array.isArray(value);
+  if (value instanceof Date) return new Date(value.getTime());
+  if (!isArray && !isPlain(value)) {
+    if (typeof value === "function" || typeof value === "symbol" || (value !== null && typeof value === "object")) {
+      throw new TypeError("layer: only plain data is supported (no functions, symbols, Maps, Sets or class instances)");
+    }
+    return value;
+  }
+  if (path.has(value)) throw new TypeError("layer: circular structures are not supported");
+  path.add(value);
+  let out;
+  if (isArray) {
+    out = new Array(value.length);
+    for (let i = 0; i < value.length; i++) {
+      if (Object.hasOwn(value, i)) out[i] = copy(value[i], skipUndefined, path);
+    }
+  } else {
+    out = {};
+    for (const key of Object.keys(value)) {
+      if (BLOCKED.has(key)) continue;
+      if (skipUndefined && value[key] === undefined) continue;
+      out[key] = copy(value[key], skipUndefined, path);
+    }
+  }
+  path.delete(value);
+  return out;
+}
+
+// Both arguments are fresh copies here, so subtrees can be moved across without sharing.
+function merge(target, over) {
+  for (const key of Object.keys(over)) {
+    if (isPlain(over[key]) && Object.hasOwn(target, key) && isPlain(target[key])) {
+      merge(target[key], over[key]);
+    } else {
+      target[key] = over[key];
+    }
+  }
+}
+
+/**
+ * Lays `over` on top of `base` and returns the result as a new object.
+ * Plain objects under the same key are layered key by key, at any depth; any other value in
+ * `over` (arrays included, which are never joined) replaces the one in `base`; a key only one
+ * side has is kept. A key whose value in `over` is undefined counts as not given. A value that
+ * is not plain data (function, Map, Set, class instance, ...) anywhere in either argument throws
+ * a TypeError. Neither argument is changed and the result shares no object or array with
+ * them. Keys named __proto__, constructor and prototype are never copied.
+ * @param {object} base
+ * @param {object} over
+ */
+export function layer(base, over) {
+  if (!isPlain(base)) throw new TypeError("layer: base must be a plain object");
+  if (!isPlain(over)) throw new TypeError("layer: over must be a plain object");
+  const result = copy(base, false);
+  merge(result, copy(over, true));
+  return result;
+}
diff --git a/tests/layer.test.mjs b/tests/layer.test.mjs
new file mode 100644
index 0000000..512347e
--- /dev/null
+++ b/tests/layer.test.mjs
@@ -0,0 +1,192 @@
+import assert from "node:assert/strict";
+import { test } from "node:test";
+
+import { layer } from "../src/layer.mjs";
+
+// Every object and array reachable from `value`.
+function reachable(value, seen = new Set()) {
+  if (value !== null && typeof value === "object" && !seen.has(value)) {
+    seen.add(value);
+    for (const key of Reflect.ownKeys(value)) reachable(value[key], seen);
+  }
+  return seen;
+}
+
+test("layer lays over on top of base key by key", () => {
+  const result = layer({ a: 1, b: { c: 2, d: 3 } }, { b: { c: 9 }, e: 5 });
+  assert.deepEqual(result, { a: 1, b: { c: 9, d: 3 }, e: 5 });
+});
+
+test("layer layers plain objects at any depth", () => {
+  const base = { a: { b: { c: { d: 1, e: 2 }, f: 3 } } };
+  const over = { a: { b: { c: { e: 20, g: 30 } } } };
+  assert.deepEqual(layer(base, over), { a: { b: { c: { d: 1, e: 20, g: 30 }, f: 3 } } });
+});
+
+test("layer keeps keys only one side has", () => {
+  assert.deepEqual(layer({ a: 1 }, {}), { a: 1 });
+  assert.deepEqual(layer({}, { a: 1 }), { a: 1 });
+  assert.deepEqual(layer({}, {}), {});
+});
+
+test("layer replaces whatever base holds with an array, a number, a string, a boolean or null", () => {
+  const base = { k: { x: 1 } };
+  assert.deepEqual(layer(base, { k: [1, 2] }), { k: [1, 2] });
+  assert.deepEqual(layer(base, { k: 7 }), { k: 7 });
+  assert.deepEqual(layer(base, { k: "s" }), { k: "s" });
+  assert.deepEqual(layer(base, { k: false }), { k: false });
+  assert.deepEqual(layer(base, { k: null }), { k: null });
+});
+
+test("layer replaces an array whole and never joins it", () => {
+  assert.deepEqual(layer({ k: [1, 2, 3] }, { k: [4] }), { k: [4] });
+  assert.deepEqual(layer({ k: [1, 2, 3] }, { k: [] }), { k: [] });
+});
+
+test("layer lets a plain object in over replace a non-object in base", () => {
+  assert.deepEqual(layer({ k: 1 }, { k: { x: 1 } }), { k: { x: 1 } });
+  assert.deepEqual(layer({ k: [1] }, { k: { x: 1 } }), { k: { x: 1 } });
+  assert.deepEqual(layer({ k: null }, { k: { x: 1 } }), { k: { x: 1 } });
+});
+
+test("layer treats null-prototype objects as plain", () => {
+  const base = Object.assign(Object.create(null), { a: { b: 1, c: 2 } });
+  const over = Object.assign(Object.create(null), { a: Object.assign(Object.create(null), { b: 9 }) });
+  const result = layer(base, over);
+  assert.deepEqual(result, { a: { b: 9, c: 2 } });
+  assert.equal(Object.getPrototypeOf(result), Object.prototype);
+  assert.equal(Object.getPrototypeOf(result.a), Object.prototype);
+});
+
+test("layer requires both arguments to be plain objects", () => {
+  class Thing {}
+  const bad = [[], null, undefined, "str", 3, true, new Date(), new Map(), new Thing(), () => {}];
+  for (const value of bad) {
+    assert.throws(() => layer(value, {}), TypeError);
+    assert.throws(() => layer({}, value), TypeError);
+  }
+  assert.throws(() => layer(), TypeError);
+  assert.throws(() => layer({}), TypeError);
+  assert.throws(() => layer(undefined, {}), TypeError);
+});
+
+test("layer changes neither argument", () => {
+  const base = { a: { b: [1, { c: 2 }] }, d: 1 };
+  const over = { a: { b: [3], x: { y: 1 } }, e: [{ f: 1 }] };
+  const baseBefore = structuredClone(base);
+  const overBefore = structuredClone(over);
+  layer(base, over);
+  assert.deepEqual(base, baseBefore);
+  assert.deepEqual(over, overBefore);
+});
+
+test("layer shares no object or array with base or over", () => {
+  const base = { a: { b: [1, { c: 2 }], keep: { z: 1 } }, list: [[1], { q: 1 }] };
+  const over = { a: { x: { y: [{ w: 1 }] } }, list: [[2], { r: 2 }], fresh: { n: { m: 1 } } };
+  const result = layer(base, over);
+  const inputs = new Set([...reachable(base), ...reachable(over)]);
+  for (const object of reachable(result)) {
+    assert.equal(inputs.has(object), false);
+  }
+
+  // Changing the result later never changes a layer.
+  const baseBefore = structuredClone(base);
+  const overBefore = structuredClone(over);
+  result.a.b.push(99);
+  result.a.b[1].c = 99;
+  result.a.keep.z = 99;
+  result.a.x.y[0].w = 99;
+  result.list[0].push(99);
+  result.fresh.n.m = 99;
+  assert.deepEqual(base, baseBefore);
+  assert.deepEqual(over, overBefore);
+});
+
+test("layer copies a Date rather than sharing it", () => {
+  const when = new Date(0);
+  const result = layer({ when }, {});
+  assert.notEqual(result.when, when);
+  assert.equal(result.when.getTime(), 0);
+});
+
+test("layer never copies __proto__, constructor or prototype", () => {
+  const evil = JSON.parse(
+    '{"__proto__":{"polluted":1},"constructor":{"prototype":{"polluted":2}},"prototype":{"x":1},' +
+      '"ok":{"__proto__":{"polluted":3},"constructor":1,"keep":1},"list":[{"__proto__":{"polluted":4},"v":1}]}',
+  );
+  for (const [base, over] of [
+    [evil, {}],
+    [{}, evil],
+    [{ ok: { a: 1 } }, evil],
+    [evil, evil],
+  ]) {
+    const result = layer(base, over);
+    for (const object of reachable(result)) {
+      for (const key of ["__proto__", "constructor", "prototype"]) {
+        assert.equal(Object.hasOwn(object, key), false);
+      }
+      if (!Array.isArray(object)) assert.equal(Object.getPrototypeOf(object), Object.prototype);
+    }
+    assert.equal(Object.getPrototypeOf(result), Object.prototype);
+    assert.equal(result.polluted, undefined);
+    assert.equal(result.ok.polluted, undefined);
+    assert.equal(result.list[0].polluted, undefined);
+    assert.equal(result.list[0].v, 1);
+  }
+  assert.equal({}.polluted, undefined);
+  assert.equal(Object.prototype.polluted, undefined);
+});
+
+test("layer gives ordinary objects even when its inputs have none", () => {
+  const base = Object.create(null);
+  base.a = Object.create(null);
+  base.a.list = [Object.assign(Object.create(null), { v: 1 })];
+  const result = layer(base, {});
+  assert.equal(Object.getPrototypeOf(result), Object.prototype);
+  assert.equal(Object.getPrototypeOf(result.a), Object.prototype);
+  assert.equal(Object.getPrototypeOf(result.a.list[0]), Object.prototype);
+});
+
+test("layer treats an undefined value in over as not given", () => {
+  assert.deepEqual(layer({ verbose: true }, { verbose: undefined }), { verbose: true });
+
+  const base = { output: { color: "auto" } };
+  const kept = layer(base, { output: undefined });
+  assert.deepEqual(kept, { output: { color: "auto" } });
+  assert.notEqual(kept.output, base.output);
+
+  assert.deepEqual(
+    layer({ output: { color: "auto", width: 80 } }, { output: { color: undefined, width: 100 } }),
+    { output: { color: "auto", width: 100 } },
+  );
+
+  const added = layer({ a: 1 }, { pager: undefined });
+  assert.deepEqual(Object.keys(added), ["a"]);
+  assert.equal("pager" in added, false);
+
+  assert.deepEqual(layer({}, { a: { b: undefined } }), { a: {} });
+});
+
+test("layer refuses values that are not plain data, wherever they sit", () => {
+  class Point {
+    constructor(x, y) {
+      this.x = x;
+      this.y = y;
+    }
+  }
+  const bad = [() => 1, new Map([["a", 1]]), new Set(["a"]), new Point(0, 0), Symbol("s")];
+  for (const value of bad) {
+    assert.throws(() => layer({}, { v: value }), TypeError);
+    assert.throws(() => layer({ v: value }, {}), TypeError);
+    assert.throws(() => layer({}, { hooks: [value] }), TypeError);
+    assert.throws(() => layer({ a: { b: 1 } }, { a: { b: value } }), TypeError);
+    assert.throws(() => layer({ output: { format: value } }, {}), TypeError);
+  }
+});
+
+test("layer refuses circular structures", () => {
+  const loop = { a: 1 };
+  loop.self = loop;
+  assert.throws(() => layer(loop, {}), TypeError);
+  assert.throws(() => layer({}, loop), TypeError);
+});
```

## Candidate M

```diff
diff --git a/CHANGELOG.md b/CHANGELOG.md
index 83e52ac..795bd5d 100644
--- a/CHANGELOG.md
+++ b/CHANGELOG.md
@@ -2,6 +2,8 @@
 
 ## Unreleased
 
+- Added `layer(base, over)`: lays one layer of settings on top of another, layering plain objects key by key at any depth and letting any other value in `over` replace the one in `base`.
+
 ## 0.4.0 — 2026-09-12
 
 - Added a `fallback` argument to `getPath(settings, path, fallback)`: returned when the path is missing.
diff --git a/src/layer.mjs b/src/layer.mjs
new file mode 100644
index 0000000..ad110b7
--- /dev/null
+++ b/src/layer.mjs
@@ -0,0 +1,76 @@
+// Keys that could reach or replace a prototype; never copied from a layer.
+const UNSAFE_KEYS = new Set(["__proto__", "constructor", "prototype"]);
+
+function isPlainObject(value) {
+  if (value === null || typeof value !== "object") return false;
+  const proto = Object.getPrototypeOf(value);
+  return proto === Object.prototype || proto === null;
+}
+
+/**
+ * Returns a copy of a setting value that shares no object with it.
+ * @param {*} value
+ * @param {Set<object>} seen the objects being copied above this one
+ */
+function copy(value, seen) {
+  if (value === null || (typeof value !== "object" && typeof value !== "function")) return value;
+  if (value instanceof Date) return new Date(value.getTime());
+  if (seen.has(value)) throw new TypeError("layer: settings must not contain themselves");
+  seen.add(value);
+  let out;
+  if (Array.isArray(value)) {
+    out = Array.from(value, (item) => copy(item, seen));
+  } else if (isPlainObject(value)) {
+    out = {};
+    for (const key of Object.keys(value)) {
+      if (!UNSAFE_KEYS.has(key)) out[key] = copy(value[key], seen);
+    }
+  } else {
+    throw new TypeError("layer: settings may hold only plain objects, arrays, dates and primitives");
+  }
+  seen.delete(value);
+  return out;
+}
+
+/**
+ * @param {object} base
+ * @param {object} over
+ * @param {Set<object>} baseSeen the objects of `base` being layered above this one
+ * @param {Set<object>} overSeen the objects of `over` being layered above this one
+ */
+function merge(base, over, baseSeen, overSeen) {
+  if (baseSeen.has(base) || overSeen.has(over)) throw new TypeError("layer: settings must not contain themselves");
+  baseSeen.add(base);
+  overSeen.add(over);
+  const out = {};
+  for (const key of Object.keys(base)) {
+    if (!UNSAFE_KEYS.has(key) && !Object.hasOwn(over, key)) out[key] = copy(base[key], baseSeen);
+  }
+  for (const key of Object.keys(over)) {
+    if (UNSAFE_KEYS.has(key)) continue;
+    const under = Object.hasOwn(base, key) ? base[key] : undefined;
+    const value = over[key];
+    out[key] = isPlainObject(under) && isPlainObject(value)
+      ? merge(under, value, baseSeen, overSeen)
+      : copy(value, overSeen);
+  }
+  baseSeen.delete(base);
+  overSeen.delete(over);
+  return out;
+}
+
+/**
+ * Lays one layer of settings on top of another, such as a user's settings
+ * file on the defaults. Where both hold a plain object under the same key,
+ * the two are layered key by key; otherwise a value in `over` replaces the
+ * one in `base`. The result is a new object that shares nothing with either
+ * layer, and keys named `__proto__`, `constructor` or `prototype` are dropped.
+ * @param {object} base
+ * @param {object} over
+ * @returns {object}
+ */
+export function layer(base, over) {
+  if (!isPlainObject(base)) throw new TypeError("layer: base must be a plain object");
+  if (!isPlainObject(over)) throw new TypeError("layer: over must be a plain object");
+  return merge(base, over, new Set(), new Set());
+}
diff --git a/tests/layer.test.mjs b/tests/layer.test.mjs
new file mode 100644
index 0000000..99479de
--- /dev/null
+++ b/tests/layer.test.mjs
@@ -0,0 +1,150 @@
+import assert from "node:assert/strict";
+import { test } from "node:test";
+
+import { layer } from "../src/layer.mjs";
+
+// Every object and array reachable from a value, itself included.
+function reachable(value, found = new Set()) {
+  if (value === null || typeof value !== "object" || found.has(value)) return found;
+  found.add(value);
+  for (const key of Object.keys(value)) reachable(value[key], found);
+  return found;
+}
+
+// Every plain object reachable from a value, checked to be ordinary.
+function assertOrdinary(value) {
+  for (const object of reachable(value)) {
+    if (Array.isArray(object) || object instanceof Date) continue;
+    assert.equal(Object.getPrototypeOf(object), Object.prototype);
+    for (const key of ["__proto__", "constructor", "prototype"]) assert.equal(Object.hasOwn(object, key), false, key);
+  }
+}
+
+test("layer lays over on top of base", () => {
+  assert.deepEqual(
+    layer({ a: 1, b: { c: 2, d: 3 } }, { b: { c: 9 }, e: 5 }),
+    { a: 1, b: { c: 9, d: 3 }, e: 5 },
+  );
+  assert.deepEqual(layer({}, {}), {});
+  assert.deepEqual(layer({ a: 1 }, {}), { a: 1 });
+  assert.deepEqual(layer({}, { a: 1 }), { a: 1 });
+});
+
+test("layer layers plain objects at any depth", () => {
+  const base = { a: { b: { c: { d: 1, e: 2 }, f: 3 }, g: 4 } };
+  const over = { a: { b: { c: { e: 20, h: 5 } }, i: 6 } };
+  assert.deepEqual(layer(base, over), { a: { b: { c: { d: 1, e: 20, h: 5 }, f: 3 }, g: 4, i: 6 } });
+});
+
+test("layer layers objects without a prototype as plain objects", () => {
+  const base = Object.assign(Object.create(null), { a: Object.assign(Object.create(null), { b: 1, c: 2 }) });
+  const over = { a: { c: 3 } };
+  const result = layer(base, over);
+  assert.deepEqual(result, { a: { b: 1, c: 3 } });
+  assertOrdinary(result);
+});
+
+test("layer lets any other value in over replace the one in base", () => {
+  const replacements = [[9], 7, "seven", false, true, null, 0, ""];
+  for (const value of replacements) {
+    assert.deepEqual(layer({ k: { deep: 1 } }, { k: value }), { k: value });
+    assert.deepEqual(layer({ k: 1 }, { k: value }), { k: value });
+    assert.deepEqual(layer({ k: [1, 2] }, { k: value }), { k: value });
+  }
+  assert.deepEqual(layer({ k: 1 }, { k: { deep: 1 } }), { k: { deep: 1 } });
+  assert.deepEqual(layer({ k: [1] }, { k: { deep: 1 } }), { k: { deep: 1 } });
+  assert.deepEqual(layer({ k: null }, { k: { deep: 1 } }), { k: { deep: 1 } });
+});
+
+test("layer replaces an array whole and never joins it", () => {
+  assert.deepEqual(layer({ k: [1, 2, 3] }, { k: [9] }), { k: [9] });
+  assert.deepEqual(layer({ k: [{ a: 1, b: 2 }] }, { k: [{ a: 9 }] }), { k: [{ a: 9 }] });
+  assert.deepEqual(layer({ k: [1, 2] }, { k: [] }), { k: [] });
+});
+
+test("layer copies dates rather than sharing them", () => {
+  const when = new Date("2026-01-01T00:00:00Z");
+  const result = layer({ a: when }, { b: { when } });
+  assert.deepEqual(result, { a: when, b: { when } });
+  assert.notEqual(result.a, when);
+  assert.notEqual(result.b.when, when);
+});
+
+test("layer refuses a base or over that is not a plain object", () => {
+  const notPlain = [[], null, "a", 1, new Date(), undefined, true, new Map(), () => {}];
+  for (const value of notPlain) {
+    assert.throws(() => layer(value, {}), TypeError);
+    assert.throws(() => layer({}, value), TypeError);
+  }
+  assert.throws(() => layer(), TypeError);
+  assert.throws(() => layer({}), TypeError);
+});
+
+test("layer refuses settings that hold something other than plain data", () => {
+  assert.throws(() => layer({ a: new Map() }, {}), TypeError);
+  assert.throws(() => layer({}, { a: [() => {}] }), TypeError);
+  const loop = { a: 1 };
+  loop.self = loop;
+  assert.throws(() => layer(loop, {}), TypeError);
+  assert.throws(() => layer({}, { b: [loop] }), TypeError);
+});
+
+test("layer accepts the same object in several places", () => {
+  const shared = { x: [1] };
+  assert.deepEqual(layer(shared, shared), { x: [1] });
+  assert.deepEqual(layer({ a: shared, b: shared }, { c: shared }), { a: { x: [1] }, b: { x: [1] }, c: { x: [1] } });
+  assert.deepEqual(layer({ a: { b: 1 } }, { a: { c: 2 }, d: { a: { b: 1 } } }).a, { b: 1, c: 2 });
+});
+
+test("layer changes neither layer and shares nothing with them", () => {
+  const base = { a: { b: [1, { c: 2 }], d: { e: [[3]] } }, only: { f: [{ g: 4 }] }, h: [5] };
+  const over = { a: { b: [{ c: 9 }], d: { i: { j: [6] } } }, more: [{ k: [7] }], h: { l: 8 } };
+  const baseBefore = structuredClone(base);
+  const overBefore = structuredClone(over);
+
+  const result = layer(base, over);
+
+  assert.deepEqual(base, baseBefore);
+  assert.deepEqual(over, overBefore);
+  const fromLayers = new Set([...reachable(base), ...reachable(over)]);
+  for (const object of reachable(result)) assert.equal(fromLayers.has(object), false);
+
+  result.a.b[0].c = 0;
+  result.a.d.e[0].push(0);
+  result.only.f[0].g = 0;
+  result.more[0].k.push(0);
+  result.a.d.i.j.push(0);
+  assert.deepEqual(base, baseBefore);
+  assert.deepEqual(over, overBefore);
+});
+
+test("layer never copies __proto__, constructor or prototype keys", () => {
+  const base = JSON.parse(`{
+    "__proto__": { "polluted": "base" },
+    "constructor": { "prototype": { "polluted": "base" } },
+    "prototype": 1,
+    "a": { "__proto__": { "polluted": "base" }, "keep": 1 },
+    "list": [{ "__proto__": { "polluted": "base" }, "constructor": 2, "keep": 1 }]
+  }`);
+  const over = JSON.parse(`{
+    "__proto__": { "polluted": "over" },
+    "constructor": { "polluted": "over" },
+    "a": { "prototype": { "polluted": "over" }, "constructor": 3, "more": 2 },
+    "b": { "deep": { "__proto__": { "polluted": "over" } } },
+    "list2": [[{ "prototype": 4, "keep": 2 }]]
+  }`);
+
+  const result = layer(base, over);
+
+  assert.deepEqual(result, {
+    a: { keep: 1, more: 2 },
+    list: [{ keep: 1 }],
+    b: { deep: {} },
+    list2: [[{ keep: 2 }]],
+  });
+  assertOrdinary(result);
+  assert.equal(result.polluted, undefined);
+  assert.equal(result.a.polluted, undefined);
+  assert.equal({}.polluted, undefined);
+  assert.equal(Object.prototype.polluted, undefined);
+});
```

## Candidate P

```diff
diff --git a/CHANGELOG.md b/CHANGELOG.md
index 83e52ac..536a694 100644
--- a/CHANGELOG.md
+++ b/CHANGELOG.md
@@ -2,6 +2,8 @@
 
 ## Unreleased
 
+- Added `layer(base, over)`: lays `over` on top of `base` and returns new settings, layering plain objects key by key at any depth and replacing everything else; an `undefined` in `over` counts as not given, and anything that is not plain data (functions, `Map`, `Set`, class instances) throws a `TypeError`.
+
 ## 0.4.0 — 2026-09-12
 
 - Added a `fallback` argument to `getPath(settings, path, fallback)`: returned when the path is missing.
diff --git a/src/layer.mjs b/src/layer.mjs
new file mode 100644
index 0000000..0ff626a
--- /dev/null
+++ b/src/layer.mjs
@@ -0,0 +1,61 @@
+const UNSAFE = new Set(["__proto__", "constructor", "prototype"]);
+
+function isPlain(value) {
+  if (value === null || typeof value !== "object") return false;
+  const proto = Object.getPrototypeOf(value);
+  return proto === Object.prototype || proto === null;
+}
+
+// A deep copy that shares no object with the original and drops unsafe keys.
+// Only primitives, arrays, plain objects and Dates are accepted; anything else throws.
+// With `fromOver`, undefined values in plain objects count as not given and are left out.
+function copy(value, fromOver = false) {
+  if (Array.isArray(value)) {
+    const out = new Array(value.length);
+    for (let i = 0; i < value.length; i++) if (i in value) out[i] = copy(value[i], fromOver);
+    return out;
+  }
+  if (isPlain(value)) {
+    const out = {};
+    for (const key of Object.keys(value)) {
+      if (UNSAFE.has(key)) continue;
+      if (fromOver && value[key] === undefined) continue;
+      out[key] = copy(value[key], fromOver);
+    }
+    return out;
+  }
+  if (value instanceof Date && Object.getPrototypeOf(value) === Date.prototype) {
+    return new Date(value.getTime());
+  }
+  if (value !== null && (typeof value === "object" || typeof value === "function")) {
+    throw new TypeError("layer: settings must be plain data (no functions, Map, Set or class instances)");
+  }
+  return value;
+}
+
+function merge(base, over) {
+  const out = copy(base);
+  for (const key of Object.keys(over)) {
+    if (UNSAFE.has(key)) continue;
+    // undefined in over counts as not given.
+    if (over[key] === undefined) continue;
+    const mine = Object.hasOwn(base, key) ? base[key] : undefined;
+    out[key] = isPlain(mine) && isPlain(over[key]) ? merge(mine, over[key]) : copy(over[key], true);
+  }
+  return out;
+}
+
+/**
+ * Lays `over` on top of `base` and returns the new settings.
+ * Plain objects under the same key are layered key by key at any depth; any other
+ * value in `over` replaces the one in `base`; keys only one side has are kept.
+ * Neither argument is changed and the result shares no object with them.
+ * Keys named __proto__, constructor and prototype are never copied.
+ * @param {object} base
+ * @param {object} over
+ */
+export function layer(base, over) {
+  if (!isPlain(base)) throw new TypeError("layer: base must be a plain object");
+  if (!isPlain(over)) throw new TypeError("layer: over must be a plain object");
+  return merge(base, over);
+}
diff --git a/tests/layer.test.mjs b/tests/layer.test.mjs
new file mode 100644
index 0000000..cc7724e
--- /dev/null
+++ b/tests/layer.test.mjs
@@ -0,0 +1,169 @@
+import assert from "node:assert/strict";
+import { test } from "node:test";
+
+import { layer } from "../src/layer.mjs";
+
+// Every object and array reachable from a value, collected into a set.
+function reach(value, seen = new Set()) {
+  if (value !== null && typeof value === "object" && !seen.has(value)) {
+    seen.add(value);
+    for (const key of Reflect.ownKeys(value)) reach(value[key], seen);
+  }
+  return seen;
+}
+
+function plainEverywhere(value) {
+  for (const node of reach(value)) {
+    if (!Array.isArray(node)) assert.equal(Object.getPrototypeOf(node), Object.prototype);
+  }
+}
+
+test("layer lays over on top of base", () => {
+  assert.deepEqual(layer({ a: 1, b: { c: 2, d: 3 } }, { b: { c: 9 }, e: 5 }), { a: 1, b: { c: 9, d: 3 }, e: 5 });
+});
+
+test("layer layers plain objects at any depth", () => {
+  const base = { a: { b: { c: { d: 1, e: 2 }, f: 3 } } };
+  const over = { a: { b: { c: { d: 9 } } } };
+  assert.deepEqual(layer(base, over), { a: { b: { c: { d: 9, e: 2 }, f: 3 } } });
+});
+
+test("layer keeps keys only one side has", () => {
+  assert.deepEqual(layer({ a: 1 }, { b: 2 }), { a: 1, b: 2 });
+  assert.deepEqual(layer({}, {}), {});
+});
+
+test("layer replaces with arrays, numbers, strings, booleans and null", () => {
+  const base = { a: { x: 1 }, b: { x: 1 }, c: { x: 1 }, d: { x: 1 }, e: { x: 1 } };
+  const over = { a: [1], b: 7, c: "s", d: false, e: null };
+  assert.deepEqual(layer(base, over), over);
+  assert.deepEqual(layer({ a: 1, b: "x", c: true }, { a: { y: 1 }, b: { y: 2 }, c: { y: 3 } }), {
+    a: { y: 1 },
+    b: { y: 2 },
+    c: { y: 3 },
+  });
+});
+
+test("layer replaces an array whole and never joins", () => {
+  assert.deepEqual(layer({ a: [1, 2, 3] }, { a: [9] }), { a: [9] });
+  assert.deepEqual(layer({ a: [1, 2, 3] }, { a: [] }), { a: [] });
+  assert.deepEqual(layer({ a: { x: 1 } }, { a: [1] }), { a: [1] });
+  assert.deepEqual(layer({ a: [1] }, { a: { x: 1 } }), { a: { x: 1 } });
+});
+
+test("layer refuses arguments that are not plain objects", () => {
+  for (const bad of [[], null, "s", 3, new Date(), undefined]) {
+    assert.throws(() => layer(bad, {}), TypeError);
+    assert.throws(() => layer({}, bad), TypeError);
+  }
+  assert.throws(() => layer(), TypeError);
+  assert.throws(() => layer({}), TypeError);
+  assert.throws(() => layer(undefined, {}), TypeError);
+});
+
+test("layer changes neither argument", () => {
+  const base = Object.freeze({ a: Object.freeze({ b: 1, l: Object.freeze([1]) }) });
+  const over = Object.freeze({ a: Object.freeze({ c: 2 }), z: Object.freeze([{ q: 1 }]) });
+  const baseJson = JSON.stringify(base);
+  const overJson = JSON.stringify(over);
+  layer(base, over);
+  assert.equal(JSON.stringify(base), baseJson);
+  assert.equal(JSON.stringify(over), overJson);
+});
+
+test("layer result shares no object or array with base or over", () => {
+  const base = { a: { b: [1, { c: 2 }], d: { e: 1 } }, only: { x: [[1]] }, when: new Date(0) };
+  const over = { a: { d: { f: 2 } }, arr: [{ g: [{ h: 1 }] }], r: { s: { t: 1 } } };
+  const result = layer(base, over);
+  const inputs = new Set([...reach(base), ...reach(over)]);
+  for (const node of reach(result)) assert.ok(!inputs.has(node), "result shares an object with an input");
+
+  result.a.b[1].c = 99;
+  result.arr[0].g[0].h = 99;
+  result.r.s.t = 99;
+  assert.equal(base.a.b[1].c, 2);
+  assert.equal(over.arr[0].g[0].h, 1);
+  assert.equal(over.r.s.t, 1);
+});
+
+test("layer never copies __proto__, constructor or prototype", () => {
+  const evil = JSON.parse(
+    '{"__proto__":{"polluted":1},"constructor":{"x":1},"prototype":{"y":1},' +
+      '"ok":{"__proto__":{"deep":1},"constructor":1,"keep":1},' +
+      '"list":[{"__proto__":{"inArray":1},"constructor":2,"prototype":3,"keep":1}]}',
+  );
+  for (const [base, over] of [
+    [evil, {}],
+    [{}, evil],
+    [evil, evil],
+    [{ ok: { keep: 0 } }, evil],
+  ]) {
+    const result = layer(base, over);
+    for (const node of reach(result)) {
+      for (const key of ["__proto__", "constructor", "prototype"]) {
+        assert.ok(!Object.hasOwn(node, key), `copied ${key}`);
+      }
+    }
+    plainEverywhere(result);
+    assert.equal(Object.getPrototypeOf(result), Object.prototype);
+    assert.equal(result.polluted, undefined);
+    assert.equal(result.ok.deep, undefined);
+    assert.equal(result.ok.keep, 1);
+    assert.equal(result.list[0].keep, 1);
+  }
+  assert.equal({}.polluted, undefined);
+  assert.equal({}.deep, undefined);
+  assert.equal({}.inArray, undefined);
+});
+
+test("layer treats undefined in over as not given", () => {
+  assert.deepEqual(layer({ verbose: true }, { verbose: undefined }), { verbose: true });
+  const base = { output: { color: "auto" } };
+  const kept = layer(base, { output: undefined });
+  assert.deepEqual(kept, { output: { color: "auto" } });
+  assert.notEqual(kept.output, base.output);
+  assert.deepEqual(
+    layer({ output: { color: "auto", width: 80 } }, { output: { color: undefined, width: 100 } }),
+    { output: { color: "auto", width: 100 } },
+  );
+  assert.deepEqual(Object.keys(layer({ a: 1 }, { pager: undefined })), ["a"]);
+  assert.deepEqual(Object.keys(layer({}, { a: { b: undefined, c: 1 } }).a), ["c"]);
+});
+
+test("layer refuses values that are not plain data", () => {
+  class Point {
+    constructor(x, y) {
+      this.x = x;
+      this.y = y;
+    }
+  }
+  const bad = [() => 1, new Map([["a", 1]]), new Set(["a"]), new Point(0, 0), /x/, new Error("e")];
+  for (const value of bad) {
+    assert.throws(() => layer({}, { v: value }), TypeError);
+    assert.throws(() => layer({ v: value }, {}), TypeError);
+    assert.throws(() => layer({ v: 1 }, { v: value }), TypeError);
+    assert.throws(() => layer({ v: value }, { v: 1 }), TypeError);
+    assert.throws(() => layer({}, { a: { b: value } }), TypeError);
+    assert.throws(() => layer({ a: { b: value } }, {}), TypeError);
+    assert.throws(() => layer({ a: { b: 1 } }, { a: { c: [value] } }), TypeError);
+    assert.throws(() => layer({}, { hooks: [value] }), TypeError);
+  }
+});
+
+test("layer copies a Date as a new Date", () => {
+  const when = new Date(5);
+  const result = layer({ when }, {});
+  assert.ok(result.when instanceof Date);
+  assert.equal(result.when.getTime(), 5);
+  assert.notEqual(result.when, when);
+  const viaOver = layer({}, { list: [when] });
+  assert.equal(viaOver.list[0].getTime(), 5);
+  assert.notEqual(viaOver.list[0], when);
+});
+
+test("layer returns ordinary objects even from null-prototype inputs", () => {
+  const base = Object.assign(Object.create(null), { a: Object.assign(Object.create(null), { b: 1 }) });
+  const result = layer(base, { a: { c: 2 } });
+  assert.deepEqual(result, { a: { b: 1, c: 2 } });
+  plainEverywhere(result);
+});
```

## Candidate Q

```diff
diff --git a/CHANGELOG.md b/CHANGELOG.md
index 83e52ac..cb242df 100644
--- a/CHANGELOG.md
+++ b/CHANGELOG.md
@@ -2,6 +2,8 @@
 
 ## Unreleased
 
+- Added `layer(base, over)`: lays `over` on top of `base`, layering plain objects key by key at any depth and replacing any other value (arrays whole); neither argument is changed.
+
 ## 0.4.0 — 2026-09-12
 
 - Added a `fallback` argument to `getPath(settings, path, fallback)`: returned when the path is missing.
diff --git a/src/layer.mjs b/src/layer.mjs
new file mode 100644
index 0000000..549ef3c
--- /dev/null
+++ b/src/layer.mjs
@@ -0,0 +1,73 @@
+const UNSAFE_KEYS = new Set(["__proto__", "constructor", "prototype"]);
+
+function isPlainObject(value) {
+  if (value === null || typeof value !== "object") return false;
+  const proto = Object.getPrototypeOf(value);
+  return proto === Object.prototype || proto === null;
+}
+
+// Throws a TypeError if anything reachable from `value` is not plain data:
+// primitives, null, dates, arrays and plain objects are fine; functions, maps,
+// sets, class instances and the like are not.
+function assertPlainData(value, where) {
+  if (value === null || (typeof value !== "object" && typeof value !== "function")) return;
+  if (Array.isArray(value)) {
+    for (const item of value) assertPlainData(item, where);
+  } else if (value instanceof Date) {
+    // plain data
+  } else if (isPlainObject(value)) {
+    for (const key of Object.keys(value)) assertPlainData(value[key], where);
+  } else {
+    throw new TypeError(`layer: ${where} holds a value that is not plain data`);
+  }
+}
+
+// Copies a value so that nothing reachable from the copy is shared with the
+// original. Plain objects and arrays are copied at any depth, dropping unsafe
+// keys; dates are copied; primitives are kept as is. When `fromOver` is set,
+// object keys holding `undefined` are left out (they count as not given).
+function copy(value, fromOver) {
+  if (Array.isArray(value)) return value.map((item) => copy(item, fromOver));
+  if (value instanceof Date) return new Date(value.getTime());
+  if (isPlainObject(value)) return layerObjects(fromOver ? {} : value, fromOver ? value : {});
+  return value;
+}
+
+function layerObjects(base, over) {
+  const out = {};
+  for (const key of Object.keys(base)) {
+    if (UNSAFE_KEYS.has(key)) continue;
+    out[key] = copy(base[key], false);
+  }
+  for (const key of Object.keys(over)) {
+    if (UNSAFE_KEYS.has(key)) continue;
+    const value = over[key];
+    if (value === undefined) continue;
+    if (Object.hasOwn(base, key) && isPlainObject(base[key]) && isPlainObject(value)) {
+      out[key] = layerObjects(base[key], value);
+    } else {
+      out[key] = copy(value, true);
+    }
+  }
+  return out;
+}
+
+/**
+ * Lays `over` on top of `base` and returns the combined settings.
+ * Plain objects under the same key are layered key by key, at any depth; any
+ * other value in `over` replaces the one in `base` (arrays are replaced whole).
+ * A key whose value in `over` is `undefined` counts as not given.
+ * Neither argument is changed and the result shares no object with them. Keys
+ * named `__proto__`, `constructor` or `prototype` are never copied. Both
+ * arguments must be plain objects holding only plain data (primitives, dates,
+ * arrays and plain objects, at any depth); anything else throws a TypeError.
+ * @param {object} base
+ * @param {object} over
+ */
+export function layer(base, over) {
+  if (!isPlainObject(base)) throw new TypeError("layer: base must be a plain object");
+  if (!isPlainObject(over)) throw new TypeError("layer: over must be a plain object");
+  assertPlainData(base, "base");
+  assertPlainData(over, "over");
+  return layerObjects(base, over);
+}
diff --git a/tests/layer.test.mjs b/tests/layer.test.mjs
new file mode 100644
index 0000000..7d9510d
--- /dev/null
+++ b/tests/layer.test.mjs
@@ -0,0 +1,184 @@
+import assert from "node:assert/strict";
+import { test } from "node:test";
+
+import { layer } from "../src/layer.mjs";
+
+test("layer lays over on top of base key by key", () => {
+  assert.deepEqual(
+    layer({ a: 1, b: { c: 2, d: 3 } }, { b: { c: 9 }, e: 5 }),
+    { a: 1, b: { c: 9, d: 3 }, e: 5 },
+  );
+});
+
+test("layer layers plain objects at any depth", () => {
+  const base = { a: { b: { c: { d: 1, e: 2 }, f: 3 } } };
+  const over = { a: { b: { c: { e: 9, g: 4 } } } };
+  assert.deepEqual(layer(base, over), { a: { b: { c: { d: 1, e: 9, g: 4 }, f: 3 } } });
+});
+
+test("layer keeps keys that only one side has", () => {
+  assert.deepEqual(layer({ a: 1 }, { b: 2 }), { a: 1, b: 2 });
+  assert.deepEqual(layer({}, {}), {});
+});
+
+test("layer replaces with arrays, numbers, strings, booleans and null", () => {
+  const base = { a: { x: 1 }, b: { x: 1 }, c: { x: 1 }, d: { x: 1 }, e: { x: 1 }, f: [1, 2, 3] };
+  const over = { a: [9], b: 7, c: "s", d: false, e: null, f: [4] };
+  assert.deepEqual(layer(base, over), { a: [9], b: 7, c: "s", d: false, e: null, f: [4] });
+});
+
+test("layer replaces an array whole and never joins it", () => {
+  assert.deepEqual(layer({ list: [1, 2, 3] }, { list: [4] }), { list: [4] });
+  assert.deepEqual(layer({ list: [1, 2, 3] }, { list: [] }), { list: [] });
+});
+
+test("layer lets a plain object in over replace a non-object in base", () => {
+  assert.deepEqual(layer({ a: 1, b: [1], c: null }, { a: { x: 1 }, b: { y: 2 }, c: { z: 3 } }), {
+    a: { x: 1 },
+    b: { y: 2 },
+    c: { z: 3 },
+  });
+});
+
+test("layer throws a TypeError unless both arguments are plain objects", () => {
+  const bad = [[], null, "text", 3, new Date(), undefined];
+  for (const value of bad) {
+    assert.throws(() => layer(value, {}), TypeError);
+    assert.throws(() => layer({}, value), TypeError);
+  }
+  assert.throws(() => layer(), TypeError);
+  assert.throws(() => layer({}), TypeError);
+  assert.throws(() => layer(undefined, {}), TypeError);
+});
+
+test("layer changes neither argument", () => {
+  const base = { a: { b: 1 }, list: [{ x: 1 }] };
+  const over = { a: { c: 2 }, other: [1, [2]] };
+  const baseBefore = structuredClone(base);
+  const overBefore = structuredClone(over);
+  layer(base, over);
+  assert.deepEqual(base, baseBefore);
+  assert.deepEqual(over, overBefore);
+});
+
+function collect(value, found = new Set()) {
+  if (value !== null && typeof value === "object") {
+    found.add(value);
+    for (const key of Object.keys(value)) collect(value[key], found);
+  }
+  return found;
+}
+
+test("layer shares no object or array with base or over", () => {
+  const base = {
+    a: { b: { c: 1 } },
+    list: [{ x: 1 }, [2, { y: 3 }]],
+    kept: { deep: [{ z: 1 }] },
+    when: new Date(0),
+  };
+  const over = {
+    a: { b: { d: 2 } },
+    list: [{ w: 1 }, [{ v: 2 }]],
+    fresh: { deep: [{ u: 1 }] },
+    list2: [[{ t: 1 }]],
+  };
+  const result = layer(base, over);
+  const inputs = new Set([...collect(base), ...collect(over)]);
+  for (const object of collect(result)) {
+    assert.equal(inputs.has(object), false);
+  }
+  assert.equal(result.when.getTime(), 0);
+
+  result.a.b.c = 99;
+  result.list[1].push("added");
+  result.kept.deep[0].z = 99;
+  result.fresh.deep[0].u = 99;
+  result.list2[0][0].t = 99;
+  assert.equal(base.a.b.c, 1);
+  assert.deepEqual(base.list[1], [2, { y: 3 }]);
+  assert.equal(base.kept.deep[0].z, 1);
+  assert.equal(over.fresh.deep[0].u, 1);
+  assert.equal(over.list2[0][0].t, 1);
+});
+
+test("layer never copies __proto__, constructor or prototype keys", () => {
+  const base = JSON.parse(
+    '{"__proto__":{"polluted":1},"constructor":{"x":1},"prototype":{"y":1},"ok":{"__proto__":{"deep":1},"v":1},"list":[{"__proto__":{"inArray":1},"k":1}]}',
+  );
+  const over = JSON.parse(
+    '{"__proto__":{"polluted":2},"constructor":{"x":2},"prototype":{"y":2},"ok":{"constructor":{"z":1},"prototype":1,"w":2},"list2":[[{"__proto__":{"inArray":2},"k":2}]]}',
+  );
+  const result = layer(base, over);
+
+  assert.deepEqual(result, { ok: { v: 1, w: 2 }, list: [{ k: 1 }], list2: [[{ k: 2 }]] });
+  for (const key of ["__proto__", "constructor", "prototype"]) {
+    assert.equal(Object.hasOwn(result, key), false);
+    assert.equal(Object.hasOwn(result.ok, key), false);
+  }
+  assert.equal(({}).polluted, undefined);
+  assert.equal(result.polluted, undefined);
+  assert.equal(result.list[0].inArray, undefined);
+
+  const plain = (value) => {
+    if (value !== null && typeof value === "object") {
+      if (!Array.isArray(value)) assert.equal(Object.getPrototypeOf(value), Object.prototype);
+      Object.values(value).forEach(plain);
+    }
+  };
+  plain(result);
+});
+
+test("layer returns an ordinary object even for null-prototype inputs", () => {
+  const base = Object.assign(Object.create(null), { a: Object.assign(Object.create(null), { b: 1 }) });
+  const result = layer(base, { a: { c: 2 } });
+  assert.deepEqual(result, { a: { b: 1, c: 2 } });
+  assert.equal(Object.getPrototypeOf(result), Object.prototype);
+  assert.equal(Object.getPrototypeOf(result.a), Object.prototype);
+});
+
+test("layer treats an undefined value in over as not given", () => {
+  assert.deepEqual(layer({ verbose: true }, { verbose: undefined }), { verbose: true });
+
+  const base = { output: { color: "auto" } };
+  const kept = layer(base, { output: undefined });
+  assert.deepEqual(kept, { output: { color: "auto" } });
+  assert.notEqual(kept.output, base.output);
+
+  assert.deepEqual(
+    layer({ output: { color: "auto", width: 80 } }, { output: { color: undefined, width: 100 } }),
+    { output: { color: "auto", width: 100 } },
+  );
+
+  const added = layer({ a: 1 }, { pager: undefined });
+  assert.deepEqual(Object.keys(added), ["a"]);
+  assert.equal(Object.hasOwn(added, "pager"), false);
+
+  const nested = layer({}, { o: { c: undefined, d: 1 }, list: [{ e: undefined, f: 2 }] });
+  assert.deepEqual(Object.keys(nested.o), ["d"]);
+  assert.deepEqual(Object.keys(nested.list[0]), ["f"]);
+});
+
+test("layer throws a TypeError for data that is not plain, wherever it sits", () => {
+  class Point {
+    constructor(x, y) {
+      this.x = x;
+      this.y = y;
+    }
+  }
+  const cases = [
+    () => layer({}, { onChange: () => 1 }),
+    () => layer({}, { lookup: new Map([["a", 1]]) }),
+    () => layer({}, { tags: new Set(["a"]) }),
+    () => layer({}, { origin: new Point(0, 0) }),
+    () => layer({}, { hooks: [() => 1] }),
+    () => layer({}, { hooks: [[{ f: () => 1 }]] }),
+    () => layer({ output: { format: (x) => x } }, {}),
+    () => layer({ output: { format: (x) => x } }, { output: { format: "json" } }),
+    () => layer({ a: { b: 1 } }, { a: { b: new Point(1, 2) } }),
+    () => layer({ a: new Point(1, 2) }, {}),
+    () => layer({}, { re: /x/ }),
+  ];
+  for (const run of cases) assert.throws(run, TypeError);
+  // Dates stay allowed.
+  assert.equal(layer({}, { when: new Date(5) }).when.getTime(), 5);
+});
```

## Candidate Y

```diff
diff --git a/CHANGELOG.md b/CHANGELOG.md
index 83e52ac..a290a45 100644
--- a/CHANGELOG.md
+++ b/CHANGELOG.md
@@ -2,6 +2,8 @@
 
 ## Unreleased
 
+- Added `layer(base, over)`: returns the settings from laying `over` on top of `base`, layering plain objects key by key at any depth and replacing any other value; neither argument is changed. A key that is `undefined` in `over` counts as not given, and functions, Maps, Sets and class instances throw a `TypeError`.
+
 ## 0.4.0 — 2026-09-12
 
 - Added a `fallback` argument to `getPath(settings, path, fallback)`: returned when the path is missing.
diff --git a/src/layer.mjs b/src/layer.mjs
new file mode 100644
index 0000000..b2a2a26
--- /dev/null
+++ b/src/layer.mjs
@@ -0,0 +1,61 @@
+const FORBIDDEN = new Set(["__proto__", "constructor", "prototype"]);
+
+function isPlain(value) {
+  if (value === null || typeof value !== "object") return false;
+  const proto = Object.getPrototypeOf(value);
+  return proto === Object.prototype || proto === null;
+}
+
+// Deep copy that shares nothing with the source and drops forbidden keys.
+function copy(value) {
+  if (Array.isArray(value)) return Array.from(value, copy);
+  if (isPlain(value)) {
+    const out = {};
+    for (const key of Object.keys(value)) {
+      if (!FORBIDDEN.has(key)) out[key] = copy(value[key]);
+    }
+    return out;
+  }
+  if (value instanceof Date && Object.getPrototypeOf(value) === Date.prototype) {
+    return new Date(value.getTime());
+  }
+  if (typeof value === "function" || (value !== null && typeof value === "object")) {
+    throw new TypeError("layer: settings must be plain data (no functions, Maps, Sets or class instances)");
+  }
+  return value;
+}
+
+function merge(base, over) {
+  const out = {};
+  for (const key of Object.keys(base)) {
+    if (!FORBIDDEN.has(key)) out[key] = copy(base[key]);
+  }
+  for (const key of Object.keys(over)) {
+    if (FORBIDDEN.has(key)) continue;
+    // A key whose value in `over` is undefined counts as not given.
+    if (over[key] === undefined) continue;
+    out[key] =
+      Object.hasOwn(base, key) && isPlain(base[key]) && isPlain(over[key])
+        ? merge(base[key], over[key])
+        : copy(over[key]);
+  }
+  return out;
+}
+
+/**
+ * Lays `over` on top of `base` and returns the combined settings.
+ * Plain objects under the same key are layered key by key at any depth;
+ * any other value in `over` replaces the one in `base`. Neither argument is
+ * changed and the result shares no object or array with them. Keys named
+ * `__proto__`, `constructor` or `prototype` are never copied. A key whose
+ * value in `over` is `undefined` counts as not given. Functions, Maps, Sets
+ * and class instances anywhere in either argument (also inside arrays) throw
+ * a TypeError; Dates are allowed and copied.
+ * @param {object} base
+ * @param {object} over
+ */
+export function layer(base, over) {
+  if (!isPlain(base)) throw new TypeError("layer: base must be a plain object");
+  if (!isPlain(over)) throw new TypeError("layer: over must be a plain object");
+  return merge(base, over);
+}
diff --git a/tests/layer.test.mjs b/tests/layer.test.mjs
new file mode 100644
index 0000000..ebcfb84
--- /dev/null
+++ b/tests/layer.test.mjs
@@ -0,0 +1,161 @@
+import assert from "node:assert/strict";
+import { test } from "node:test";
+
+import { layer } from "../src/layer.mjs";
+
+test("layer lays over on top of base key by key", () => {
+  assert.deepEqual(
+    layer({ a: 1, b: { c: 2, d: 3 } }, { b: { c: 9 }, e: 5 }),
+    { a: 1, b: { c: 9, d: 3 }, e: 5 },
+  );
+});
+
+test("layer layers plain objects at any depth", () => {
+  const base = { a: { b: { c: { d: 1, e: 2 } }, x: 1 } };
+  const over = { a: { b: { c: { e: 3, f: 4 } } } };
+  assert.deepEqual(layer(base, over), { a: { b: { c: { d: 1, e: 3, f: 4 } }, x: 1 } });
+});
+
+test("layer keeps keys only one side has", () => {
+  assert.deepEqual(layer({ a: 1 }, { b: 2 }), { a: 1, b: 2 });
+  assert.deepEqual(layer({}, {}), {});
+});
+
+test("layer replaces with arrays, numbers, strings, booleans and null", () => {
+  const base = { a: { x: 1 }, b: { x: 1 }, c: { x: 1 }, d: { x: 1 }, e: { x: 1 } };
+  const over = { a: [1], b: 2, c: "s", d: false, e: null };
+  assert.deepEqual(layer(base, over), over);
+});
+
+test("layer replaces a non-object in base with an object from over", () => {
+  assert.deepEqual(layer({ a: 1, b: [1] }, { a: { x: 1 }, b: { y: 2 } }), { a: { x: 1 }, b: { y: 2 } });
+});
+
+test("layer replaces an array whole and never joins it", () => {
+  assert.deepEqual(layer({ list: [1, 2, 3] }, { list: [4] }), { list: [4] });
+  assert.deepEqual(layer({ list: [1, 2, 3] }, { list: [] }), { list: [] });
+  assert.deepEqual(layer({ a: { list: [1, 2] } }, { a: { list: [3] } }), { a: { list: [3] } });
+});
+
+test("layer refuses arguments that are not plain objects", () => {
+  const bad = [[], null, "s", 3, new Date(), undefined];
+  for (const value of bad) {
+    assert.throws(() => layer(value, {}), TypeError);
+    assert.throws(() => layer({}, value), TypeError);
+  }
+  assert.throws(() => layer(), TypeError);
+  assert.throws(() => layer({}), TypeError);
+  assert.throws(() => layer(undefined, {}), TypeError);
+});
+
+test("layer changes neither argument", () => {
+  const base = { a: { b: 1 }, list: [{ n: 1 }] };
+  const over = { a: { c: 2 }, other: { z: [1] } };
+  const baseBefore = structuredClone(base);
+  const overBefore = structuredClone(over);
+  layer(base, over);
+  assert.deepEqual(base, baseBefore);
+  assert.deepEqual(over, overBefore);
+});
+
+function reachable(root, seen = new Set()) {
+  if (root !== null && typeof root === "object" && !seen.has(root)) {
+    seen.add(root);
+    for (const key of Object.keys(root)) reachable(root[key], seen);
+  }
+  return seen;
+}
+
+test("layer result shares no object or array with base or over", () => {
+  const base = { a: { b: { c: 1 } }, keep: { k: [{ deep: 1 }] }, list: [[1], { x: 1 }] };
+  const over = { a: { b: { d: 2 } }, added: { y: [{ z: 1 }] }, list2: [{ q: [1] }], list: [{ r: 1 }] };
+  const result = layer(base, over);
+  const inputs = new Set([...reachable(base), ...reachable(over)]);
+  for (const object of reachable(result)) {
+    assert.equal(inputs.has(object), false);
+  }
+  result.keep.k[0].deep = 99;
+  result.added.y.push(1);
+  result.a.b.c = 99;
+  assert.equal(base.keep.k[0].deep, 1);
+  assert.equal(over.added.y.length, 1);
+  assert.equal(base.a.b.c, 1);
+});
+
+test("layer never copies __proto__, constructor or prototype", () => {
+  const evil = JSON.parse(
+    '{"__proto__":{"polluted":1},"constructor":{"x":1},"prototype":{"y":1},' +
+      '"ok":{"__proto__":{"polluted":2},"constructor":1,"fine":1},' +
+      '"list":[{"__proto__":{"polluted":3},"prototype":1,"fine":2}]}',
+  );
+  for (const result of [layer(evil, {}), layer({}, evil), layer(evil, evil), layer({ ok: { a: 1 } }, evil)]) {
+    assert.equal(({}).polluted, undefined);
+    for (const object of reachable(result)) {
+      for (const name of ["__proto__", "constructor", "prototype"]) {
+        assert.equal(Object.hasOwn(object, name), false);
+      }
+      if (!Array.isArray(object)) assert.equal(Object.getPrototypeOf(object), Object.prototype);
+    }
+    assert.equal(result.ok.fine, 1);
+    assert.equal(result.list[0].fine, 2);
+  }
+});
+
+test("layer treats undefined in over as not given", () => {
+  assert.deepEqual(layer({ verbose: true }, { verbose: undefined }), { verbose: true });
+
+  const base = { output: { color: "auto" } };
+  const kept = layer(base, { output: undefined });
+  assert.deepEqual(kept, { output: { color: "auto" } });
+  assert.notEqual(kept.output, base.output);
+
+  assert.deepEqual(
+    layer({ output: { color: "auto", width: 80 } }, { output: { color: undefined, width: 100 } }),
+    { output: { color: "auto", width: 100 } },
+  );
+
+  const added = layer({ a: 1 }, { pager: undefined });
+  assert.deepEqual(Object.keys(added), ["a"]);
+  assert.equal(Object.hasOwn(added, "pager"), false);
+
+  const deepAdded = layer({ a: {} }, { a: { x: undefined } });
+  assert.equal(Object.hasOwn(deepAdded.a, "x"), false);
+});
+
+class Point {
+  constructor(x, y) {
+    this.x = x;
+    this.y = y;
+  }
+}
+
+test("layer throws a TypeError for functions, Maps, Sets and class instances", () => {
+  const bad = [() => 1, new Map([["a", 1]]), new Set(["a"]), new Point(0, 0)];
+  for (const value of bad) {
+    assert.throws(() => layer({}, { v: value }), TypeError);
+    assert.throws(() => layer({ v: value }, {}), TypeError);
+    assert.throws(() => layer({}, { a: { b: { v: value } } }), TypeError);
+    assert.throws(() => layer({ a: { b: { v: value } } }, {}), TypeError);
+    assert.throws(() => layer({ a: { b: 1 } }, { a: { b: value } }), TypeError);
+    assert.throws(() => layer({}, { list: [value] }), TypeError);
+    assert.throws(() => layer({}, { list: [[{ v: value }]] }), TypeError);
+    assert.throws(() => layer({ list: [value] }, {}), TypeError);
+  }
+});
+
+test("layer allows Dates and copies them", () => {
+  const when = new Date(0);
+  const result = layer({ list: [when] }, { when });
+  assert.ok(result.when instanceof Date);
+  assert.equal(result.when.getTime(), 0);
+  assert.notEqual(result.when, when);
+  assert.notEqual(result.list[0], when);
+});
+
+test("layer returns ordinary objects even for null-prototype inputs", () => {
+  const base = Object.assign(Object.create(null), { a: Object.assign(Object.create(null), { b: 1 }) });
+  const result = layer(base, { a: { c: 2 } });
+  assert.deepEqual(result, { a: { b: 1, c: 2 } });
+  assert.equal(Object.getPrototypeOf(result), Object.prototype);
+  assert.equal(Object.getPrototypeOf(result.a), Object.prototype);
+});
```

## Candidate X

```diff
diff --git a/CHANGELOG.md b/CHANGELOG.md
index 83e52ac..5d70594 100644
--- a/CHANGELOG.md
+++ b/CHANGELOG.md
@@ -2,6 +2,8 @@
 
 ## Unreleased
 
+- Added `layer(base, over)`: lays `over` on top of `base`, layering plain objects key by key at any depth and replacing any other value; returns a new object and never copies `__proto__`, `constructor` or `prototype` keys.
+
 ## 0.4.0 — 2026-09-12
 
 - Added a `fallback` argument to `getPath(settings, path, fallback)`: returned when the path is missing.
diff --git a/src/layer.mjs b/src/layer.mjs
new file mode 100644
index 0000000..e5433b5
--- /dev/null
+++ b/src/layer.mjs
@@ -0,0 +1,80 @@
+const FORBIDDEN = new Set(["__proto__", "constructor", "prototype"]);
+
+function isPlainObject(value) {
+  if (value === null || typeof value !== "object") return false;
+  const proto = Object.getPrototypeOf(value);
+  return proto === Object.prototype || proto === null;
+}
+
+// Refuses anything that is not plain data: functions, Maps, Sets, class
+// instances and the like, anywhere (inside arrays too). Dates are data.
+// Forbidden keys are dropped later, so what sits under them is not checked.
+function assertPlainData(value, path) {
+  if (typeof value === "function") {
+    throw new TypeError(`layer: ${path} is a function, not plain data`);
+  }
+  if (value === null || typeof value !== "object") return;
+  if (Array.isArray(value)) {
+    value.forEach((item, i) => assertPlainData(item, `${path}[${i}]`));
+    return;
+  }
+  if (value instanceof Date) return;
+  if (!isPlainObject(value)) {
+    throw new TypeError(`layer: ${path} is not plain data`);
+  }
+  for (const key of Object.keys(value)) {
+    if (FORBIDDEN.has(key)) continue;
+    assertPlainData(value[key], `${path}.${key}`);
+  }
+}
+
+// Deep copy that shares no object or array with the source, drops forbidden
+// keys at every depth (inside arrays too) and yields ordinary objects.
+// Keys holding undefined count as not given and are left out.
+function copy(value) {
+  if (Array.isArray(value)) return Array.from(value, copy);
+  if (value instanceof Date) return new Date(value.getTime());
+  if (isPlainObject(value)) {
+    const out = {};
+    for (const key of Object.keys(value)) {
+      if (FORBIDDEN.has(key) || value[key] === undefined) continue;
+      out[key] = copy(value[key]);
+    }
+    return out;
+  }
+  return value;
+}
+
+function merge(base, over) {
+  const out = copy(base);
+  for (const key of Object.keys(over)) {
+    if (FORBIDDEN.has(key) || over[key] === undefined) continue;
+    if (Object.hasOwn(out, key) && isPlainObject(base[key]) && isPlainObject(over[key])) {
+      out[key] = merge(base[key], over[key]);
+    } else {
+      out[key] = copy(over[key]);
+    }
+  }
+  return out;
+}
+
+/**
+ * Lays `over` on top of `base` and returns the combined settings.
+ * Plain objects under the same key are layered key by key, at any depth;
+ * any other value in `over` replaces the one in `base`; keys only one side
+ * has are kept. Neither argument is changed and the result shares no object
+ * or array with them. Keys named __proto__, constructor and prototype are
+ * never copied. A key whose value is undefined counts as not given. A
+ * function, Map, Set or class instance anywhere in either argument throws a
+ * TypeError.
+ * @param {object} base
+ * @param {object} over
+ * @returns {object}
+ */
+export function layer(base, over) {
+  if (!isPlainObject(base)) throw new TypeError("layer: base must be a plain object");
+  if (!isPlainObject(over)) throw new TypeError("layer: over must be a plain object");
+  assertPlainData(base, "base");
+  assertPlainData(over, "over");
+  return merge(base, over);
+}
diff --git a/tests/layer.test.mjs b/tests/layer.test.mjs
new file mode 100644
index 0000000..f856f66
--- /dev/null
+++ b/tests/layer.test.mjs
@@ -0,0 +1,174 @@
+import assert from "node:assert/strict";
+import { test } from "node:test";
+
+import { layer } from "../src/layer.mjs";
+
+test("layer lays over on top of base, key by key", () => {
+  assert.deepEqual(
+    layer({ a: 1, b: { c: 2, d: 3 } }, { b: { c: 9 }, e: 5 }),
+    { a: 1, b: { c: 9, d: 3 }, e: 5 },
+  );
+});
+
+test("layer layers plain objects at any depth", () => {
+  const base = { a: { b: { c: { d: 1, e: 2 }, f: 3 } } };
+  const over = { a: { b: { c: { e: 20, g: 30 } } } };
+  assert.deepEqual(layer(base, over), { a: { b: { c: { d: 1, e: 20, g: 30 }, f: 3 } } });
+});
+
+test("layer keeps keys only one side has", () => {
+  assert.deepEqual(layer({ a: 1 }, {}), { a: 1 });
+  assert.deepEqual(layer({}, { a: 1 }), { a: 1 });
+  assert.deepEqual(layer({}, {}), {});
+});
+
+test("layer replaces with arrays, numbers, strings, booleans and null", () => {
+  const base = { a: { x: 1 }, b: { x: 1 }, c: { x: 1 }, d: { x: 1 }, e: { x: 1 } };
+  const over = { a: [1], b: 2, c: "s", d: false, e: null };
+  assert.deepEqual(layer(base, over), over);
+  assert.deepEqual(layer({ a: 1, b: "x", c: true, d: null }, { a: { y: 1 }, b: { y: 2 }, c: { y: 3 }, d: { y: 4 } }), {
+    a: { y: 1 }, b: { y: 2 }, c: { y: 3 }, d: { y: 4 },
+  });
+});
+
+test("layer replaces an array whole and never joins it", () => {
+  assert.deepEqual(layer({ list: [1, 2, 3] }, { list: [9] }), { list: [9] });
+  assert.deepEqual(layer({ list: [1, 2, 3] }, { list: [] }), { list: [] });
+  assert.deepEqual(layer({ list: { a: 1 } }, { list: [1] }), { list: [1] });
+  assert.deepEqual(layer({ list: [1] }, { list: { a: 1 } }), { list: { a: 1 } });
+});
+
+test("layer refuses arguments that are not plain objects", () => {
+  const ok = {};
+  for (const bad of [[], null, "str", 3, new Date(), undefined, true, () => {}]) {
+    assert.throws(() => layer(bad, ok), TypeError);
+    assert.throws(() => layer(ok, bad), TypeError);
+  }
+  assert.throws(() => layer(), TypeError);
+  assert.throws(() => layer(ok), TypeError);
+  assert.throws(() => layer(undefined, ok), TypeError);
+});
+
+test("layer changes neither argument", () => {
+  const base = { a: 1, b: { c: 2, list: [{ k: 1 }] } };
+  const over = { b: { c: 9, more: { z: 1 } }, e: [1, { q: 2 }] };
+  const baseCopy = structuredClone(base);
+  const overCopy = structuredClone(over);
+  layer(base, over);
+  assert.deepEqual(base, baseCopy);
+  assert.deepEqual(over, overCopy);
+});
+
+function collect(value, seen = new Set()) {
+  if (value !== null && typeof value === "object") {
+    seen.add(value);
+    for (const v of Object.values(value)) collect(v, seen);
+  }
+  return seen;
+}
+
+test("layer result shares no object or array with the arguments", () => {
+  const base = { a: { b: [1, { c: 1 }, [2, { d: 2 }]] }, keep: { deep: { deeper: [{ x: 1 }] } }, when: new Date(0) };
+  const over = { a: { n: { m: [{ o: 1 }] } }, arr: [[{ p: 1 }]], b: { z: 1 } };
+  const result = layer(base, over);
+  const inputs = new Set([...collect(base), ...collect(over)]);
+  for (const obj of collect(result)) assert.equal(inputs.has(obj), false);
+
+  // changing the result later never changes a layer
+  result.a.b[1].c = 99;
+  result.keep.deep.deeper.push(1);
+  result.arr[0][0].p = 99;
+  result.a.n.m[0].o = 99;
+  assert.equal(base.a.b[1].c, 1);
+  assert.equal(base.keep.deep.deeper.length, 1);
+  assert.equal(over.arr[0][0].p, 1);
+  assert.equal(over.a.n.m[0].o, 1);
+});
+
+test("layer never copies __proto__, constructor or prototype keys", () => {
+  const evilBase = JSON.parse(
+    '{"__proto__":{"polluted":1},"a":{"__proto__":{"polluted":2},"constructor":{"x":1},"ok":1},"list":[{"__proto__":{"polluted":3},"prototype":1,"ok":2}]}',
+  );
+  const evilOver = JSON.parse(
+    '{"__proto__":{"polluted":4},"constructor":{"prototype":{"polluted":5}},"a":{"prototype":{"y":1},"b":2},"list2":[[{"__proto__":{"polluted":6},"ok":3}]]}',
+  );
+  const result = layer(evilBase, evilOver);
+
+  assert.equal({}.polluted, undefined);
+  assert.deepEqual(result, { a: { ok: 1, b: 2 }, list: [{ ok: 2 }], list2: [[{ ok: 3 }]] });
+
+  const walk = (value) => {
+    if (value === null || typeof value !== "object") return;
+    if (Array.isArray(value)) return value.forEach(walk);
+    assert.equal(Object.getPrototypeOf(value), Object.prototype);
+    for (const key of ["__proto__", "constructor", "prototype"]) {
+      assert.equal(Object.hasOwn(value, key), false);
+    }
+    Object.values(value).forEach(walk);
+  };
+  walk(result);
+});
+
+test("layer returns ordinary objects even for prototype-less inputs", () => {
+  const base = Object.create(null);
+  base.a = Object.create(null);
+  base.a.x = 1;
+  const result = layer(base, { a: { y: 2 } });
+  assert.equal(Object.getPrototypeOf(result), Object.prototype);
+  assert.equal(Object.getPrototypeOf(result.a), Object.prototype);
+  assert.deepEqual(result, { a: { x: 1, y: 2 } });
+});
+
+test("layer treats an undefined value in over as not given", () => {
+  assert.deepEqual(layer({ verbose: true }, { verbose: undefined }), { verbose: true });
+  const kept = layer({ output: { color: "auto" } }, { output: undefined });
+  assert.deepEqual(kept, { output: { color: "auto" } });
+  assert.deepEqual(
+    layer({ output: { color: "auto", width: 80 } }, { output: { color: undefined, width: 100 } }),
+    { output: { color: "auto", width: 100 } },
+  );
+  const added = layer({ a: 1 }, { pager: undefined });
+  assert.deepEqual(Object.keys(added), ["a"]);
+  assert.equal(Object.hasOwn(added, "pager"), false);
+  assert.deepEqual(Object.keys(layer({ a: 1 }, { o: { x: undefined } }).o), []);
+});
+
+test("layer leaves out undefined values from base too", () => {
+  assert.deepEqual(Object.keys(layer({ a: undefined, b: 1 }, {})), ["b"]);
+  assert.deepEqual(Object.keys(layer({ a: { x: undefined } }, {}).a), []);
+});
+
+class Point {
+  constructor(x, y) {
+    this.x = x;
+    this.y = y;
+  }
+}
+
+test("layer refuses functions, Maps, Sets and class instances anywhere", () => {
+  const cases = {
+    "function in over": () => layer({}, { onChange: () => 1 }),
+    "Map in over": () => layer({}, { lookup: new Map([["a", 1]]) }),
+    "Set in over": () => layer({}, { tags: new Set(["a"]) }),
+    "class instance in over": () => layer({}, { origin: new Point(0, 0) }),
+    "function in array": () => layer({}, { hooks: [() => 1] }),
+    "function in nested array": () => layer({}, { hooks: [[{ f() {} }]] }),
+    "function deep in base": () => layer({ output: { format: (x) => x } }, {}),
+    "class instance deep in over": () => layer({ a: { b: 1 } }, { a: { b: new Point(1, 2) } }),
+    "class instance in base array": () => layer({ list: [new Point(1, 2)] }, {}),
+    "Map in base": () => layer({ m: new Map() }, {}),
+    "base value that over replaces": () => layer({ a: new Set() }, { a: 1 }),
+    "over value that replaces nothing": () => layer({ a: { b: 1 } }, { a: { c: () => 1 } }),
+  };
+  for (const [name, run] of Object.entries(cases)) {
+    assert.throws(run, TypeError, name);
+  }
+});
+
+test("layer still accepts Dates, null and plain data values", () => {
+  const when = new Date(5);
+  const result = layer({ a: null }, { when, list: [1, "x", null, { y: true }], n: Object.create(null) });
+  assert.equal(result.when.getTime(), 5);
+  assert.notEqual(result.when, when);
+  assert.equal(result.a, null);
+});
```

# What to do

For each candidate, score it from 1 to 5 against the task and the acceptance material (5: every requirement clearly met with tests that would catch a regression; 3: the main behaviour is right but a requirement is unmet, untested or fragile; 1: does not do the task), with two or three sentences of reasons that cite the diff. Then rank all candidates from best to worst; ties are allowed only when you can say why two are indistinguishable. Judge the deliverable, not its volume: more lines are not more credit.

End your reply with exactly one fenced JSON block of this shape, and nothing after it:

```json
{
  "scores": { "H": { "score": <1-5>, "reasons": "<two or three sentences>" }, "J": { "score": <1-5>, "reasons": "<two or three sentences>" }, "W": { "score": <1-5>, "reasons": "<two or three sentences>" }, "M": { "score": <1-5>, "reasons": "<two or three sentences>" }, "P": { "score": <1-5>, "reasons": "<two or three sentences>" }, "Q": { "score": <1-5>, "reasons": "<two or three sentences>" }, "Y": { "score": <1-5>, "reasons": "<two or three sentences>" }, "X": { "score": <1-5>, "reasons": "<two or three sentences>" } },
  "ranking": ["H", "J", "W", "M", "P", "Q", "Y", "X"],
  "notes": "<anything that applied to several candidates, in at most three sentences>"
}
```


## Reply

# Verdict on the eight `layer` candidates

All eight implement the core merge correctly. On my reading, every test file passes and nothing outside `src/`, `tests/` and `CHANGELOG.md` changed. I couldn't run anything, so this is based on reading the diffs only. What separates them is behaviour the task did not ask for, and how well the CHANGELOG line matches the style of the entries below it.

## Per-candidate notes

**M (5).**
- `merge` copies base-only keys and recurses only when both values are plain (`src/layer.mjs:42-53`).
- `copy` rejects non-plain data and cycles but deliberately allows shared, non-cyclic references (`seen.delete`).
- Tests cover every checklist point, including arrays in the no-sharing test (`result.more[0].k.push(0)`) and in the forbidden-key test (`list2: [[{ keep: 2 }]]`).
- It follows the task literally: an `undefined` in `over` is a value given, so it replaces.
- The CHANGELOG line is one sentence in the existing style and says both what layers and what replaces.

**J (5).**
- Essentially the same design as M (`layerInto`, plus a `copy` with path-scoped cycle sets).
- Tests are equally thorough: the `result.when.setTime(5)` mutation check, "copies a key kept from base without sharing it", and a forbidden-key test across both layers that checks the exact result shape.
- I rank it just below M only because its CHANGELOG line describes the layering but never says that other values replace.

**Q (4).**
- Correct and well tested.
- `assertPlainData` runs up front, and `copy` reuses `layerObjects` (`copy(value, fromOver)` at lines 28-32).
- It adds a rule the task never states: an `undefined` in `over` counts as not given (lines 44-45). That conflicts with "a value given in `over` replaces the one in `base`".
- Cyclic input overflows the stack rather than throwing a `TypeError`.

**H (4).**
- Thorough tests, including `reachable` over the result and the evil object passed as base, over, and both.
- Like Q, it treats an `undefined` in `over` as not given.
- It also silently drops base keys whose value is `undefined` (`if (FORBIDDEN.has(key) || base[key] === undefined) continue;`). That contradicts "a key only one of them has is kept", and no test covers it.

**P (4).**
- `merge` copies base first and then layers `over` on top. Freezing the inputs in "layer changes neither argument" is a nice regression guard.
- It has the same unrequested `undefined` rule.
- Its CHANGELOG line runs long, with clauses joined by semicolons, and drifts from the terse style of the existing entries.

**Y (4).**
- Simple and correct. `copy` validates everything it touches, so non-plain data is caught on both sides, and the tests check this inside nested arrays.
- It has the same `undefined` rule.
- Its CHANGELOG entry is two sentences, where every existing entry is one.

**W (3).**
- The code is sound: it copies both sides, then merges in place (`merge(result, copy(over, true))`). It has cycle detection and good tests.
- The CHANGELOG line is a paragraph-length run-on listing internals, so checklist item 6 ("in the style of the entries below it") is not met as written.

**X (3).**
- The merge is correct and the tests are thorough.
- `copy` drops every key whose value is `undefined`, base included. A test explicitly locks this in: "layer leaves out undefined values from base too" expects `["b"]` from `{ a: undefined, b: 1 }`.
- That enshrines behaviour that contradicts "a key only one of them has is kept".

## Ranking

M ≈ J > Q > H > P > Y > W > X

```json
{
  "scores": {
    "H": { "score": 4, "reasons": "The merge, deep copy and forbidden-key handling are correct, with thorough tests (the reachable-set check, evil as base, over and both). It adds an unrequested rule that undefined in over counts as not given. It also silently drops base keys whose value is undefined (`base[key] === undefined) continue`), which contradicts 'a key only one of them has is kept' and is untested." },
    "J": { "score": 5, "reasons": "layerInto/copy follow the task literally, copy everything, reject non-plain data and cycles, and allow shared non-cyclic references. Tests cover every checklist point, including arrays in the no-sharing and forbidden-key tests and Date mutation (`result.when.setTime(5)`). The CHANGELOG line omits that other values replace, which is the only reason it sits just below M." },
    "W": { "score": 3, "reasons": "Copying both sides and then merging in place (`merge(result, copy(over, true))`) is correct, with cycle detection and strong tests. It adds the unrequested undefined-as-not-given rule. Its CHANGELOG entry is a paragraph-length run-on listing internals, so checklist item 6 (match the style of existing entries) is not met." },
    "M": { "score": 5, "reasons": "merge/copy implement the task exactly as written, with no invented undefined rule, plus cycle detection that still allows shared references. Tests hit every checklist item, including nested arrays for no-sharing (`result.more[0].k.push(0)`) and forbidden keys (`list2: [[{ keep: 2 }]]`). The CHANGELOG line is one sentence in the existing style and covers both layering and replacement." },
    "P": { "score": 4, "reasons": "Copying base and then layering over is correct, validates non-plain data on both sides, and the frozen-input test is a good regression guard. It adds the unrequested rule that undefined in over counts as not given. Its CHANGELOG line is long and semicolon-chained, drifting from the terse existing style." },
    "Q": { "score": 4, "reasons": "assertPlainData plus layerObjects is correct, keeps base keys holding undefined, and the tests are thorough, including nested arrays in the no-sharing and forbidden-key checks. It adds the unrequested rule that undefined in over counts as not given (`if (value === undefined) continue;`). Cyclic input overflows the stack instead of throwing a TypeError." },
    "Y": { "score": 4, "reasons": "A simple copy-validating merge, correct on every checklist point, with tests for non-plain data inside nested arrays and for Date copies. It adds the unrequested undefined-as-not-given rule. Its CHANGELOG entry is two sentences, unlike the one-line entries below it." },
    "X": { "score": 3, "reasons": "The merge and the up-front plain-data check are correct, with thorough tests. copy drops every key holding undefined, base included. The test 'layer leaves out undefined values from base too' enshrines that, contradicting 'a key only one of them has is kept'." }
  },
  "ranking": ["M", "J", "Q", "H", "P", "Y", "W", "X"],
  "notes": "Every candidate also rejects non-plain values (functions, Map, Set, class instances) anywhere in the input; that is beyond the task but harmless for settings data. Six of the eight (all but J and M) invent a rule that an undefined in over counts as not given, which the task does not state and which conflicts with 'a value given in over replaces'. M and J are near-identical in design and test coverage and differ only in CHANGELOG wording."
}
```
