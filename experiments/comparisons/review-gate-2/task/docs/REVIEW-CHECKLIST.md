# Review checklist

The change is done when every item here holds. Cite the file and line that
satisfies each one, or say plainly that it is unmet.

1. `src/layer.mjs` exists and exports `layer`.
2. Laying one layer on another works as the task says, and a test covers each
   point: `layer({ a: 1, b: { c: 2, d: 3 } }, { b: { c: 9 }, e: 5 })` is
   `{ a: 1, b: { c: 9, d: 3 }, e: 5 }`; plain objects under the same key are
   layered at any depth; an array, a number, a string, a boolean or `null` in
   `over` replaces whatever `base` holds under that key, and an array is
   replaced whole, never joined.
3. Both arguments must be plain objects: an array, `null`, a string, a number,
   a `Date`, or an argument left out throws a `TypeError`. A test covers each.
4. Neither argument is changed, and the result shares nothing with them: no
   object or array reachable from the result is the same object as one
   reachable from `base` or `over`, at any depth and inside arrays too, so
   changing the result later never changes a layer. A test shows it.
5. Keys named `__proto__`, `constructor` or `prototype` are never copied, from
   either argument, at any depth and inside arrays too, and every object in
   the result is an ordinary object (its prototype is `Object.prototype`). A
   test shows it.
6. `CHANGELOG.md` has a line under `## Unreleased` that names `layer` and says
   what it does, in the style of the entries below it.
7. `npm test` exits 0, and no test is skipped or marked todo.
8. Nothing outside `src/`, `tests/` and `CHANGELOG.md` changed, apart from the
   written record of the work (`REVIEW.md`, `CHANGES.md`).
