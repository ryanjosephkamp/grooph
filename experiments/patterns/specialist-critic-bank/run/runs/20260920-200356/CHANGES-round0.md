# Changes — round 0

## src/store.mjs

- Added `searchFiles(root, query, { within } = {})`: returns, sorted, the names
  of the files directly under `root` (or under `root/within`) whose UTF-8 text
  contains `query` (case-sensitive `String.prototype.includes`; empty query
  matches every file). Does not recurse.
- Added private `resolveWithin(root, sub)`: resolves `within` against the
  root and throws if the result is not the root itself or a path under it
  (`base + sep` prefix check, so a sibling like `root2` is refused too). Also
  rejects a non-string `within` with a `TypeError`. The store had no path
  validation before; `within` comes straight from the request, so this is the
  one place a traversal check was needed for the new function.
- Added private `fileNames(dir)`: sorted names of the regular files directly
  under `dir`. `listFiles` now uses it; its output is unchanged.

## tests/store.test.mjs

Eight new tests: basic match and sort, no-match returns `[]`, case-sensitive
substring semantics, empty query, no descent into subfolders, `within` (single
level, nested via `join`, and `"."` meaning the root), traversal refusal
(`../outside`, `sub/../../outside`, an absolute path, a non-string, and a
sibling folder whose name starts with the root's), and a missing subfolder
raising `ENOENT`.

## README.md

Documented `searchFiles` in the example block and the helper list, including
the substring/case rules, the no-recursion behaviour, and the refusal of a
`within` that escapes the root.

## Notes for the lead (not changed)

- `readUserFile` and `writeUserFile` still `join(root, name)` with no
  traversal check; `name` also comes from the request. Out of scope for this
  task but the same `resolveWithin` helper could guard them.
- `listFiles` still reads each whole file to get its size (`readFileSync(...).length`);
  `statSync(...).size` would avoid that on the "thousands of multi-megabyte
  documents" case the README describes. Left as-is to keep the change scoped.
- `searchFiles` reads every file in the folder on each call, which is inherent
  to a substring search with no index; the README's "no cache in front"
  remark suggests the HTTP layer may want to think about that.

`npm test`: 10 passing, 0 failing.
