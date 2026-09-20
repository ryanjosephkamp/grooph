# Correctness review — round 1, `searchFiles`

Evidence read: `DIFF.patch`, `src/store.mjs`, `tests/store.test.mjs`, `README.md`, `NPM-TEST.txt`. Ran `npm test` myself: 16/16 pass.

## Verified correct

- Chunked scan (`src/store.mjs:53-68`): buffer is sized `needle.length - 1 + CHUNK_BYTES`; `readSync` writes at offset `kept <= needle.length - 1` for at most `CHUNK_BYTES`, so it never overflows. Carrying `needle.length - 1` bytes forward is exactly enough to see any straddling match; the copy uses `buf.copy(buf, 0, end - kept, end)`, which is safe for overlapping ranges. Short reads are handled by looping until `read === 0`. Empty file returns false; empty query is short-circuited at `src/store.mjs:41` so `needle.length - 1` is never `-1`. Covered by `tests/store.test.mjs:53-60` (match starting 3 bytes before the boundary, match at the very end, miss past the boundary).
- Byte-level UTF-8 matching is equivalent to string substring matching because UTF-8 is self-synchronizing; covered at `tests/store.test.mjs:45-51`.
- `resolveWithin` (`src/store.mjs:82-90`) checks the lexical resolution and then the realpath against the realpath of `root`, with `isUnder` using `base + sep` so a sibling `root2` is refused (`tests/store.test.mjs:125-130`). Missing subfolder and file-as-subfolder throw with `ENOENT` / `ENOTDIR` (`tests/store.test.mjs:132-142`).
- Sorted output, direct-children-only, symlink skipping: all tested (`tests/store.test.mjs:28-35, 76-123`).

## Findings

### Minor

1. `src/store.mjs:39` — `within ?? "."` accepts `null` as well as `undefined`, so `searchFiles(root, q, { within: null })` silently searches the root (probed: returns `["a.txt"]`), while README.md:27 says `within` "must be strings" and `src/store.mjs:83` rejects every other non-string with a `TypeError`. Either treat `null` as a `TypeError` or document that `null`/`undefined` mean "the root". No test pins either behaviour.

2. `src/store.mjs:39`, `src/store.mjs:85` — `within: ""` resolves to the root and searches it (probed: returns `["a.txt"]`). That is a reasonable outcome but is neither documented (README.md:23-29) nor tested; a request that carries an empty subfolder string is a likely real input for "whatever the request carried".

3. `src/store.mjs:29-30` — `listFiles` changed behaviour beyond the task: it now skips symlinks to files (previously `statSync` followed them and listed them) and no longer throws on a dangling symlink (probed: a dangling link is silently omitted). The new behaviour is arguably better and is tested at `tests/store.test.mjs:115-123` and documented at README.md:31-33, but it is a semantic change to an existing exported helper that the task did not ask for; the lead should confirm it is intended.

4. `tests/store.test.mjs:53-60` — no test for a needle of length 1 (`needle.length - 1 === 0`, so `kept` is always 0 and the buffer is exactly `CHUNK_BYTES`) nor for a needle whose prefix repeats inside itself across a boundary (e.g. text `...abcab|cabd...` with query `abcabd`). I probed the latter within a single chunk and it matches, and the arithmetic makes both fine across a boundary, but they are the classic off-by-one cases for a carry-over scanner and are cheap to pin.

### No blockers or majors found.
