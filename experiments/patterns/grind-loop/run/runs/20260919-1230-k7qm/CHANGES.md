# Round 0 changes

## What changed

Implemented `compare(a, b)` in `src/semver.mjs`, which previously just
threw `Error("not implemented")`.

- Added a `parse(version)` helper that:
  - Throws `TypeError` when the argument is not a string.
  - Validates the string against a semver regex built from the official
    grammar (numeric identifiers with no leading zeros for
    major/minor/patch and numeric pre-release identifiers; alphanumeric
    identifiers may have leading zeros; build metadata identifiers are
    `[0-9a-zA-Z-]+`). Throws `RangeError` on no match.
  - Returns `{ major, minor, patch, prerelease }` with prerelease split
    into dot-separated identifiers (build metadata is discarded, since
    it never affects precedence per §11).
- Added a `compareIdentifiers(a, b)` helper implementing the §11
  pre-release identifier comparison rule: numeric identifiers compare
  numerically and always sort lower than alphanumeric identifiers,
  which compare lexically (ASCII).
- `compare` itself compares major, then minor, then patch numerically;
  if those tie, a version with no pre-release outranks one with a
  pre-release; otherwise pre-release identifiers are compared
  pairwise left-to-right per §11, and a version that runs out of
  identifiers first (all shared prefix identical) sorts lower.

## Why

The task is exactly "make `tests/semver.test.mjs` pass by implementing
`compare` without touching the tests." The above rules are a direct
transcription of semver.org §11's precedence algorithm, covering:
numeric comparison of major/minor/patch, pre-release vs. release
ordering, the identifier-by-identifier pre-release chain (including
numeric vs. alphanumeric ranking and the "longer set wins" tiebreak),
build metadata being ignored, and strict validation (no leading zeros
in numeric fields, empty string rejected, trailing space rejected,
leading zero allowed only in alphanumeric identifiers/build metadata,
etc.), plus type-checking for non-string arguments.

## Result

`npm test` passes: 10/10 tests pass, 0 failures.
