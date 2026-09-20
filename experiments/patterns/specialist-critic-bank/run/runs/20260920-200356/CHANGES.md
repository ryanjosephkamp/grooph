# Changes — round 1

Addresses TRIAGE.md (round 0): all 3 majors fixed, 9 of 12 minors fixed, 3
minors left with reasons below.

## src/store.mjs

- **M1 (symlink escape).** `resolveWithin` now `realpathSync`s both the root
  and the requested subfolder and compares the real paths, after the existing
  lexical check (kept first so `..` and absolute escapes are refused without
  touching the disk, and a missing `within` still surfaces `ENOENT`). It
  returns the real path, so the search reads where the check looked.
  `fileNames` uses `readdirSync(dir, { withFileTypes: true })` and
  `Dirent.isFile()`, which does not follow links: a symlinked *file* under the
  root is neither read by `searchFiles` nor listed by `listFiles`. This is a
  small behaviour change to `listFiles` (symlinks were listed before); the
  store never creates links, and README now says both helpers skip them.
- **M2 (full read + decode per file).** New private `fileContains(path,
  needle, buf)` reads each file in 1 MiB chunks with `openSync`/`readSync`,
  matches on UTF-8 bytes with `Buffer.includes`, carries the last
  `needle.length - 1` bytes across chunk boundaries, and returns at the first
  hit. One buffer is allocated per search, not per file. Memory per request is
  now bounded (chunk + needle) instead of the largest document, no string is
  decoded, and matching files are read only as far as the match. A miss still
  reads the whole folder; that is inherent to substring search without an
  index. The store stays synchronous like its siblings; making it async would
  change the API shape of every helper and is a store-wide decision for the
  lead, not a fix for this change.
- **M3.** `listFiles` takes `size` from `statSync(...).size` instead of
  reading the file.
- **m1.** `query` must be a string (`TypeError` otherwise).
- **m4.** Empty query returns `fileNames(dir)` without opening any file.
- **m5.** No per-entry `statSync` in `fileNames` (see M1).
- **m6.** `dir` is built one way: `resolveWithin(root, within ?? ".")`.
- **m10.** JSDoc on `searchFiles` trimmed to one sentence; README carries the
  full contract.

## tests/store.test.mjs

Six new tests (16 total, all passing): multibyte query; a match that straddles
the 1 MiB read boundary (plus one ending exactly at the boundary and a miss
longer than a chunk); non-string query (`undefined`, RegExp) throws
`TypeError`; a symlinked subfolder pointing outside the root is refused
(`link` and `link/.`); symlinked files are skipped by both `searchFiles` and
`listFiles`; `within` naming a file throws `ENOTDIR`.

- **m11.** Renamed "search within a subfolder" to a behaviour sentence.
- **m12.** Relative `within` values in the escape test all use `join`.

## README.md

- `searchFiles` bullet rewritten: strings required for `query` and `within`;
  refusal covers `..`, absolute paths and symbolic links; missing or
  file-valued `within` throws (no `readdirSync` mention — **m9**, **m3**).
- New paragraph: both helpers look only at regular files (no descent, no
  symlinks); searches read in chunks and stop at the first match.

## Minors not taken

- **m2** (fs error messages carry the absolute path): comes from Node's own
  `ENOENT`/`ENOTDIR` errors, which the existing tests assert on by `code`. The
  HTTP layer (out of repo) decides what to forward. Left for the lead.
- **m7** (`readUserFile`/`writeUserFile` validate nothing about `name`):
  pre-existing, outside this change; flagged again below.
- **m8** (README comment column): the `within` example call is 47 characters,
  longer than the 40-column comment gutter; aligning would mean reflowing the
  whole block. Left as is.

## Notes for the lead (not changed)

- `readUserFile` / `writeUserFile` still `join(root, name)` with no
  containment check although `name` comes from the request. `resolveWithin`
  is the natural guard; a separate task.

`npm test`: 16 passing, 0 failing.
