# Security review — `searchFiles` (round 1)

Scope: input handling, secrets, authentication/authorisation, dependencies.
Evidence: DIFF.patch, src/store.mjs, tests/store.test.mjs, README.md, package.json.
Tests: `node --test tests/*.test.mjs` — 16 pass.

## Findings

### Blocker

None.

### Major

None.

### Minor

1. **src/store.mjs:87, :40 — error text leaks the server's absolute path.**
   `realpathSync(target)` and `readdirSync(dir)` throw ENOENT/ENOTDIR whose
   message embeds the fully resolved on-disk path (e.g. `lstat '/srv/users/42/nope'`).
   README.md:4-6 says the HTTP layer passes request values straight in; if it
   surfaces error messages, a caller learns the store's filesystem layout.
   Recommend catching these in `resolveWithin` and rethrowing with a message
   that names only `sub`.

2. **src/store.mjs:93 — the refusal message reflects raw user input.**
   `escapes(sub)` interpolates the request-supplied `within` unchanged,
   including newlines or control characters, into an Error message that will
   likely reach logs or responses (log injection / reflected text). Minor
   because the value is not interpreted; still worth `JSON.stringify(sub)` or
   truncation.

3. **src/store.mjs:43 — unbounded, request-sized allocation.**
   `Buffer.allocUnsafe(needle.length - 1 + CHUNK_BYTES)` scales with the
   query; a multi-hundred-megabyte `query` triggers a matching allocation per
   request with no cap in the store (any cap would have to live in the HTTP
   layer, which README.md:4-6 says is elsewhere). Recommend a maximum query
   length. Note: `allocUnsafe` is safe as used — every byte examined by
   `buf.subarray(0, end)` (line 61) has been written first (`kept` bytes by
   the copy at line 63, `read` bytes by `readSync` at line 58), so no
   uninitialised memory is ever inspected.

4. **src/store.mjs:72-74 then :54 — check-then-use gap on entry type.**
   `fileNames` filters with `Dirent.isFile()`, then `fileContains` opens
   `join(dir, name)` later; a symlink or FIFO swapped in between would be
   followed/blocked. Exploitation needs the ability to create links inside
   the user's root, which nothing in this repository provides
   (`writeUserFile` writes regular files only, line 25), so minor.
   Mitigation if wanted: open with `O_RDONLY | O_NOFOLLOW` and `fstatSync(fd).isFile()`.
   The same window exists between `resolveWithin` (line 89) and use of `dir`.

## Satisfied

- **Path traversal via `within`** — src/store.mjs:82-92: root is realpath'd,
  `sub` is resolved against it, checked textually, realpath'd again, and
  re-checked with a `sep`-terminated prefix (blocks `..`, absolute paths,
  symlinked folders, and the `root2` sibling case). Covered by tests at
  tests/store.test.mjs:95-130. Root realpath also handles a root that is
  itself a symlink.
- **Symlinked files** — src/store.mjs:73 skips non-regular entries for both
  list and search; tests/store.test.mjs:115-123.
- **Type checks** — src/store.mjs:38 and :83 reject non-string `query` /
  `within`, so objects or arrays cannot reach `path.resolve` or
  `Buffer.from`.
- **Empty `within`** — `resolve(base, "")` yields `base`, accepted (correct).
- **Secrets** — none introduced.
- **Dependencies** — package.json declares none; only `node:` builtins are
  imported (src/store.mjs:1-12). Nothing to audit.

## Out of the diff (for the lead's awareness, not rated)

- `readUserFile`/`writeUserFile` (src/store.mjs:18-26) still use bare
  `join(root, name)` with no traversal or symlink check while the README
  (lines 4-6) says request-carried names reach them. Pre-existing, untouched
  by this change; `searchFiles` is now the only hardened entry point.
