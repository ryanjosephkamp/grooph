# TRIAGE — search-user-files, round 0

Merged from REVIEW-CORRECTNESS.md, REVIEW-SECURITY.md, REVIEW-PERFORMANCE.md, REVIEW-TASTE.md
(all four read in full). Every finding below carries a file:line from its reviewer; none was
dropped for lack of evidence. Duplicates are collapsed to the highest severity any reviewer
showed, with the raising reviews named. Ranking only — no re-review, no fixes.

## Blocker

None.

## Major

M1. `within` containment is lexical only; a symlink under the root escapes it.
    `src/store.mjs:40-41` (compare via `startsWith`, no `realpathSync`); contract at
    `README.md:27-28` and JSDoc `src/store.mjs:23-24` say an escaping `within` is refused.
    Probe shown by both reviewers: `root/link -> ../outside`, `searchFiles(root, "needle",
    { within: "link" })` returns `["leak.txt"]`. Security adds that a symlinked *file* under
    the root is read too (`src/store.mjs:33` `statSync` follows links, `:28` reads). No symlink
    test at `tests/store.test.mjs:71-86`.
    Raised by: CORRECTNESS (major), SECURITY (minor). Kept at major: the code contradicts the
    documented contract. Fix: realpath both sides before comparing, or narrow README/JSDoc.

M2. Every search reads and decodes every file in full, synchronously, on every request.
    `src/store.mjs:28` `readFileSync(..., "utf8").includes(query)`; scale stated at
    `README.md:30-32` (thousands of multi-MB documents, call per request, no cache). O(total
    bytes) per request on the event loop, no early exit per file.
    Raised by: PERFORMANCE (major), SECURITY (minor, availability). Kept at major.

M3. `listFiles` reads every file in full to learn its size, after `fileNames` already stat'd it.
    `src/store.mjs:17` (`readFileSync(...).length`) plus `src/store.mjs:33` (`statSync` whose
    `Stats.size` is discarded). Diff touched this line, so it belongs to the change.
    Raised by: PERFORMANCE (major).

## Minor

m1. `query` is not validated; `String.prototype.includes` coerces non-strings.
    `src/store.mjs:28`; `within` gets a `typeof` guard at `src/store.mjs:38`, `query` does not.
    `undefined` searches for the text "undefined"; a RegExp throws a `TypeError` from inside
    `includes`. No non-string-query test in `tests/store.test.mjs`.
    Raised by: CORRECTNESS (minor), SECURITY (minor).

m2. Filesystem errors surface the server's absolute path.
    `src/store.mjs:28,33` (ENOENT / ERR_INVALID_ARG_VALUE messages carry `/var/.../root/...`),
    behaviour documented at `README.md:27-28`. HTTP layer is out of repo (`README.md:3-6`);
    if it forwards `error.message`, on-disk layout leaks.
    Raised by: SECURITY (minor).

m3. Untested / undocumented `within` edge cases.
    `within: ""` resolves to root (`src/store.mjs:40-41`), not documented at `README.md:23-29`;
    `within` naming a file throws `ENOTDIR` from `src/store.mjs:33`, README mentions only the
    non-existent case (`README.md:28-29`); absolute `within` inside root accepted
    (`src/store.mjs:40`), only the escaping absolute case is tested (`tests/store.test.mjs:77`).
    Raised by: CORRECTNESS (minor).

m4. Empty query still reads every file.
    `src/store.mjs:28`; `README.md:25` promises empty query matches all. A `query === ""`
    short-circuit to `fileNames(dir)` avoids the scan.
    Raised by: PERFORMANCE (minor).

m5. One `statSync` per directory entry.
    `src/store.mjs:33`; `readdirSync(dir, { withFileTypes: true })` answers `isFile()` without
    the extra syscalls. (Also the redundant stat that M3 builds on.)
    Raised by: PERFORMANCE (minor).

m6. `dir` is built two different ways in the ternary.
    `src/store.mjs:27` (`resolve(root)` vs `resolveWithin(root, within)`); rest of file uses
    `join(root, name)` bare at lines 6, 12, 17.
    Raised by: TASTE (minor).

m7. Inconsistent argument defensiveness across siblings.
    `src/store.mjs:38` type-checks `within`; `readUserFile` (line 5) and `writeUserFile`
    (line 10) validate nothing about `name`.
    Raised by: TASTE (minor). Overlaps m1 in spirit; kept separate because it is about
    `name`, not `query`.

m8. README example comment column misaligned.
    `README.md:15` vs the column used at `README.md:12-14`.
    Raised by: TASTE (minor).

m9. README leaks a Node implementation detail.
    `README.md:28` "throws like `readdirSync` would"; other bullets (`README.md:18-21`)
    describe behaviour without naming fs calls.
    Raised by: TASTE (minor).

m10. README bullet duplicates the JSDoc nearly verbatim.
    `README.md:22-28` vs `src/store.mjs:20-25`.
    Raised by: TASTE (minor).

m11. Test name is not a behaviour sentence.
    `tests/store.test.mjs:59` "search within a subfolder" vs the pattern at lines 28, 37, 45,
    52, 71, 81, 88.
    Raised by: TASTE (minor).

m12. Mixed relative-path conventions in tests.
    `tests/store.test.mjs:67` (`join("sub", "deeper")`) vs `tests/store.test.mjs:76`
    (hard-coded `"sub/../../outside"`).
    Raised by: TASTE (minor).

## Noted, not rated (pre-existing, outside the diff)

- `readUserFile` / `writeUserFile` (`src/store.mjs:6,12`) `join(root, name)` with no containment
  check while `README.md:4-6` says `name` comes from the request. SECURITY flagged as a
  follow-up candidate; the new `resolveWithin` helper is the natural guard. Not counted toward
  the verdict because it is not introduced by this change.

## Verified correct (for the lead's record)

- `..`, absolute, and sibling-prefix (`root2`) escapes refused at `src/store.mjs:41`; tests at
  `tests/store.test.mjs:71-86` (CORRECTNESS, SECURITY).
- Sorting, direct-children-only, case-sensitive substring, empty-query-matches-all at
  `src/store.mjs:26-34`; tests `tests/store.test.mjs:28-69` (CORRECTNESS).
- No new dependencies (`package.json:1-9`; imports only `node:fs`, `node:path` at
  `src/store.mjs:1-2`) (SECURITY).
- `npm test`: 10/10 pass, reported independently by three reviewers.

## Counts

blocker 0 / major 3 / minor 12

verdict: fail
