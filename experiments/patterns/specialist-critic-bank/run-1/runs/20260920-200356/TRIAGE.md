# TRIAGE — round 1, `search-user-files`

Merged from REVIEW-CORRECTNESS.md, REVIEW-SECURITY.md, REVIEW-PERFORMANCE.md, REVIEW-TASTE.md. Every finding below carries the file and line its reviewer cited; duplicates are collapsed to the highest severity shown, with the raising reviews named. Nothing was dropped for lack of a citation: all four reviewers cited file and line for every rated finding.

## Blocker

None raised by any review.

## Major

1. **src/store.mjs:44, :58 — a search miss synchronously reads every byte of every file in the folder on the request thread.** (PERFORMANCE #1)
   `names.filter(fileContains)` loops `readSync` to EOF per non-matching file; with README.md:37-39 sizing the store at thousands of multi-megabyte documents called on every request with no cache, a miss is a multi-gigabyte blocking read and the process serves nothing else meanwhile. README.md:34-35 documents the full read but not the blocking. The reviewer flags this as possibly an accepted design ("build on the store's existing helpers"); the lead must make that acceptance explicit or route an async/streamed or indexed variant. Ranked major as shown.

## Minor

2. **src/store.mjs:43 — scan buffer and carry-over grow with request `query` length, uncapped.** (SECURITY #3, PERFORMANCE #2 — duplicate, merged)
   `Buffer.allocUnsafe(needle.length - 1 + CHUNK_BYTES)` scales with the request; no maximum query length in the store. Both reviewers recommend a cap. SECURITY confirms `allocUnsafe` is safe as used (every inspected byte is written first, lines 58/61/63).

3. **src/store.mjs:39 — `within ?? "."` accepts `null`, contradicting README.md:27 ("must be strings") and the TypeError at :83.** (CORRECTNESS #1)
   Probed: `within: null` silently searches the root. No test pins either behaviour.

4. **src/store.mjs:39, :85 — `within: ""` resolves to root and searches it; undocumented (README.md:23-29) and untested.** (CORRECTNESS #2; SECURITY lists the behaviour as correct under "Satisfied" — the gap is documentation/test, not correctness)

5. **src/store.mjs:29-30 — `listFiles` semantics changed beyond the task: symlinks to files are now skipped and dangling symlinks no longer throw.** (CORRECTNESS #3)
   Tested (tests/store.test.mjs:115-123) and documented (README.md:31-33), but an unrequested change to an existing export; lead to confirm intent.

6. **tests/store.test.mjs:53-60 — no test for a length-1 needle or a self-repeating needle prefix across the chunk boundary.** (CORRECTNESS #4)
   Reviewer probed and found both correct; cheap to pin.

7. **src/store.mjs:87, :40 — ENOENT/ENOTDIR messages embed the resolved absolute server path.** (SECURITY #1)
   If the HTTP layer (README.md:4-6) surfaces messages, callers learn filesystem layout. Rethrow naming only `sub`.

8. **src/store.mjs:93 — refusal message interpolates raw user `within`, including control characters.** (SECURITY #2)
   Log-injection / reflected text; `JSON.stringify(sub)` or truncate.

9. **src/store.mjs:72-74 then :54 — check-then-use gap between `Dirent.isFile()` and `openSync`; same window after `resolveWithin` (:89).** (SECURITY #4)
   Needs link creation inside the root, which nothing in the repo provides (`writeUserFile` :25 writes regular files). Mitigation: `O_NOFOLLOW` + `fstatSync(fd).isFile()`.

10. **src/store.mjs:44 — files shorter than `needle` are still opened and read.** (PERFORMANCE #3)
    Three syscalls per tiny file; reviewer notes a size check costs a stat, so net gain is small.

11. **src/store.mjs:92-93 — `isUnder`/`escapes` are `const` arrows after their user while every other helper is a JSDoc'd `function`; `escapes` reads as a predicate but builds an Error.** (TASTE #1)

12. **src/store.mjs:43 and :58 — buffer size contract split between `searchFiles` and `fileContains`; reading `buf.length - kept` would let the buffer describe itself.** (TASTE #2)

13. **src/store.mjs:58 — `const read = readSync(...)` names a byte count with a verb.** (TASTE #3)

14. **src/store.mjs:39, :82-83 — option is `within` at the boundary, `sub` inside `resolveWithin`, `within` again in the TypeError.** (TASTE #4)

15. **tests/store.test.mjs:55 — `const chunk = 1 << 20` restates `CHUNK_BYTES` by value; test silently stops hitting the boundary if the constant changes.** (TASTE #5)

16. **tests/store.test.mjs:129 — hand-written `"../root2"` hard-codes the `"root"` leaf chosen at line 9 where neighbours use `join(...)`.** (TASTE #6)

## Informational (not rated by its reviewer; not counted)

- src/store.mjs:18-26 — `readUserFile`/`writeUserFile` still use bare `join(root, name)` with no traversal check while README.md:4-6 says request names reach them. Pre-existing, outside the diff. (SECURITY, "Out of the diff")

## Verified by reviewers (no action)

Chunked scan arithmetic and boundary handling (src/store.mjs:53-68, tests/store.test.mjs:53-60); UTF-8 byte matching (tests :45-51); path traversal defence in `resolveWithin` (src/store.mjs:82-92, tests :95-130); symlink skipping (:73, tests :115-123); type checks (:38, :83); no new dependencies (package.json); `listFiles` now stats instead of reading (:30) and uses `withFileTypes` (:72-73). All four reviewers ran the suite: 16/16 pass.

verdict: fail
