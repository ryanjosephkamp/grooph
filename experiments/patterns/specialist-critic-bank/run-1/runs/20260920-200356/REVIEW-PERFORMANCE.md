# Performance review — `searchFiles` (round 1)

Scope: work that grows badly with input, needless I/O, memory. Evidence: `DIFF.patch`, `src/store.mjs`, `tests/store.test.mjs`, `README.md` as the change leaves them. `node --test tests/store.test.mjs`: 16 pass, 0 fail.

## Findings

### Major

1. **`src/store.mjs:44`, `:58` — a search miss synchronously reads every byte of every file in the folder on the request thread.**
   `names.filter((name) => fileContains(...))` drives `readSync` in a loop until EOF for each file that does not match. README.md:37-39 sizes the workload at "thousands of documents of a few megabytes each" with the store called "on every request, with no cache": a miss is a multi-gigabyte sequential read, and because every call in the loop is synchronous the process handles nothing else until it finishes. The existing helpers are also synchronous (`readFileSync` at `:19`, `statSync` at `:30`), so this follows the module's style, but their cost is one file or one stat per entry; `searchFiles` is the first helper whose blocking time is proportional to the total bytes stored. The README documents the full read on a miss (README.md:34-35) but not the blocking. This may be an accepted design given "build on the store's existing helpers"; the lead should decide whether that acceptance is explicit. Without an index or an async/streamed variant, throughput of the page under concurrent searches is bounded by one scan at a time.

### Minor

2. **`src/store.mjs:43` — the scan buffer grows with the length of the request's `query`.**
   `Buffer.allocUnsafe(needle.length - 1 + CHUNK_BYTES)` sizes the buffer from `query`, which comes straight from the request (README.md:4-6). There is no upper bound on `query`, so a very long query allocates a correspondingly large buffer per call, and `fileContains` then keeps up to `needle.length - 1` bytes across chunks (`:62-63`), so the per-file working set is also query-proportional. For realistic queries this is a few bytes over 1 MiB; it only matters if the HTTP layer does not cap the search string. A cheap guard (reject or short-circuit queries longer than some limit) would make the memory bound independent of input.

3. **`src/store.mjs:44` — every file is opened and read even when it is shorter than `needle`.**
   `fileNames` (`:71-76`) drops the `Dirent` and no size is consulted, so a file smaller than the query still costs `openSync` + `readSync` + `closeSync` (`:54`, `:58`, `:66`) before `includes` fails. With thousands of small notes this is three syscalls per file that could be skipped by a size check, but the check would itself cost a `stat`, so the net gain is small. Noted for completeness; not worth changing on its own.

## Not findings (checked, sound)

- `src/store.mjs:53-68` — chunked read with a single reusable buffer, overlap of `needle.length - 1` bytes so straddling matches are seen, early return on first hit. Memory per file is O(CHUNK_BYTES + |needle|), not O(file size); total scan work is O(total bytes) with negligible re-scan of the overlap. `tests/store.test.mjs:53-60` covers the boundary case.
- `src/store.mjs:41` — empty query returns names without opening any file.
- `src/store.mjs:30` — `listFiles` now uses `statSync(...).size` instead of `readFileSync(...).length` (diff lines 69-71): removes a full read of every file per listing. Clear improvement over the base.
- `src/store.mjs:72-73` — `readdirSync(..., { withFileTypes: true })` + `isFile()` replaces a `statSync` per entry in the base `listFiles` filter: one syscall for the directory instead of N.
- `src/store.mjs:84`, `:87` — two `realpathSync` calls per search; constant, not input-proportional.
- `src/store.mjs:58` — `readSync` with `position: null` reads sequentially from the current offset; no seeking, no re-reads.

## Verdict

No blockers. One major (synchronous full-folder scan on the request path, consistent with the module but far costlier than its siblings) for the lead to route as a design decision; two minors.
