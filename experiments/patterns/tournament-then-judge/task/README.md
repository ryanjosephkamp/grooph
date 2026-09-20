# linediff

A line diff for a small review tool.

```js
import { diffLines } from "./src/diff.mjs";

diffLines(["a", "b", "c"], ["a", "c", "d"]);
// [{ op: "=", line: "a" }, { op: "-", line: "b" }, { op: "=", line: "c" }, { op: "+", line: "d" }]
```

## Contract

- `diffLines(before, after)` takes two arrays of strings and returns an edit
  script: an array of `{ op, line }` with `op` one of `"="` (kept), `"-"`
  (removed from `before`) or `"+"` (added in `after`).
- Reading the script in order, the `=` and `-` lines are `before` and the `=`
  and `+` lines are `after`, each in its original order.
- The script is minimal: it has as few `-` and `+` entries as any script can
  (the longest common subsequence is kept).
- Empty inputs work: two empty arrays give `[]`; an empty `before` gives all
  `+`; an empty `after` gives all `-`. Identical inputs give all `=`.
- Anything that is not an array of strings throws a `TypeError`.

## Layout

The tests in `tests/` run the contract against every `candidates/*/diff.mjs`
they find, and against `src/diff.mjs` once it exists. Each candidate folder is
self-contained: its `diff.mjs` must not import from outside its own folder.
