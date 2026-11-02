# Changes, round 1

Addresses the 11 failing held-out cases listed in REVIEW.md (round 0).

- src/layer.mjs: a key whose value in `over` is `undefined` is treated as not given, at any depth (merge skips it; copies of `over` subtrees drop it). Fixes the four "undefined:" cases. An `undefined` that is in `base` is left as it is.
- src/layer.mjs: copy() now accepts only primitives, arrays, plain / null-prototype objects and Date (copied with `new Date(value.getTime())`). Functions, Map, Set, class instances and any other object throw a TypeError, at any depth, inside arrays, and in both arguments (base is copied whole, so a bad value in base throws even when `over` replaces it). The structuredClone fallback is gone. Fixes the seven "not plain data:" cases.
- tests/layer.test.mjs: added tests for undefined-as-not-given, for refusing non-plain values (function, Map, Set, class instance, RegExp, Error; shallow, deep, in arrays, either argument), and for Date copying.
- CHANGELOG.md: the `layer` line now mentions both rules.

`npm test`: 16 tests, all pass, 0 skipped, 0 todo.
