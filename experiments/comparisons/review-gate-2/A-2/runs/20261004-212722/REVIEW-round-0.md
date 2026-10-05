# Review, round 0

1. met: src/layer.mjs:52 exports `layer`.
2. met: behaviour in src/layer.mjs:35-41 and 25-31 (merge); tests in tests/layer.test.mjs:21 (example), :25 (any depth), :36 (array/number/string/boolean/null replace), :47 (array replaced whole).
3. met: src/layer.mjs:53-54 throws TypeError; tests/layer.test.mjs:54-62 cover array, null, string, number, Date, undefined, missing argument.
4. met: copy() in src/layer.mjs:10-31 deep-copies objects, arrays and Dates; tests/layer.test.mjs:64 (inputs unchanged, frozen) and :74 (nothing shared, inside arrays too).
5. met: UNSAFE filter at src/layer.mjs:1, :19, :36; result built from `{}` so ordinary; test at tests/layer.test.mjs:89 (including inside arrays) and :119.
6. met: CHANGELOG.md:5 under `## Unreleased` names `layer(base, over)` and says what it does, same style as line 9.
7. met: `npm test` run by me exits 0, 13 tests, 0 skipped, 0 todo; no skip/todo in tests/layer.test.mjs.
8. met: git status shows only CHANGELOG.md modified, plus src/layer.mjs, tests/layer.test.mjs and the run record under .grooph/.

Held-out suite: 55 cases, 44 pass, 11 fail (all checklist items hold, but the suite settles what the task leaves open and the change misses two of those points).

Failing held-out cases:
- "undefined: undefined in over leaves base's value" — `layer({ verbose: true }, { verbose: undefined })` expected `{ verbose: true }`, got `{ verbose: undefined }`. Cause: src/layer.mjs:38 assigns `over[key]` even when undefined.
- "undefined: undefined in over leaves base's object, copied" — `layer({ output: { color: "auto" } }, { output: undefined })` expected base's object kept (as a copy), got `output: undefined`.
- "undefined: undefined deeper in over leaves base's value there" — `{ output: { color: "auto", width: 80 } }` over `{ output: { color: undefined, width: 100 } }` expected `{ color: "auto", width: 100 }`.
- "undefined: a key only over has, with undefined, does not appear" — `layer({ a: 1 }, { pager: undefined })` expected keys `["a"]`; `pager` appears.
- "not plain data: a function in over throws a TypeError" — `layer({}, { onChange: () => 1 })` expected TypeError, no throw (src/layer.mjs:42-49 returns the value as is).
- "not plain data: a Map in over throws a TypeError" — `{ lookup: new Map(...) }` expected TypeError; it is structuredClone'd instead (src/layer.mjs:42-47).
- "not plain data: a Set in over throws a TypeError" — `{ tags: new Set(["a"]) }` expected TypeError; no throw.
- "not plain data: an instance of a class in over throws a TypeError" — `{ origin: new Point(0, 0) }` expected TypeError; no throw.
- "not plain data: a function inside an array throws a TypeError" — `{ hooks: [() => 1] }` expected TypeError; no throw.
- "not plain data: a function deep in base throws a TypeError" — `{ output: { format: (x) => x } }` as base expected TypeError; no throw.
- "not plain data: an instance of a class deep in over throws a TypeError" — `{ a: { b: new Point(1, 2) } }` expected TypeError; no throw.

Fix to route to the builder: in src/layer.mjs, skip keys whose `over` value is undefined (treated as not given), and in copy() accept only primitives, arrays, plain/null-prototype objects and Date (copied as `new Date(value.getTime())`), throwing TypeError for functions, Map, Set, class instances and anything else, at any depth and in both arguments; add tests for both.

verdict: fail
