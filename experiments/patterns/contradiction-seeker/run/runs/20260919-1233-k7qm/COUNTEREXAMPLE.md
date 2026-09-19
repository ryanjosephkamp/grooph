# COUNTEREXAMPLE — slug-symbols, round 0

**Verdict: pass.** I found no counterexample.

Code under test: `src/slugify.mjs` lines 12-27 (the diff in `diff-round0.patch` lines 15-28).
Evidence: `npm-test-round0-lead.txt` lines 5-15 show 7 tests passing and 0 failing.

## Attempts that did not find a counterexample

Each check tests four things: the output is `""` or matches `^[a-z0-9]+(-[a-z0-9]+)*$`, `length <= maxLength`, and `slugify(out,{maxLength}) === out`.

1. Random fuzzing: 300,000 random strings of 0-11 characters, built from a pool of `a Z 9 - space & @ % é ß İ ﬀ ﬃ ½ ² ǅ K(Kelvin) Å U+0301 ẞ ① – _ 𝐀 ı ſ Ω ª`, each run with maxLength values 1, 2, 3, 4, 5, 7, 10 and 48. Result: 0 violations.
2. Truncation in the middle of a word or after a hyphen: `"Fish & Chips"`, m=6 gives `"fish-a"`. `"100%"`, m=4 gives `"100"`. Both are idempotent.
3. `@` alone with m=2 gives `"at"`. `""` with m=1 gives `""`.
4. A lone surrogate, `"\uD800abc"` with m=3, gives `"abc"`.
5. `"İstanbul"` (lowercasing plus a combining dot) with m=3 gives `"ist"`.
6. A zero-width joiner, `"a‍b"` with m=5, gives `"a-b"`.
7. A 1,000,002-character input with m=1e9 gives a valid result and is idempotent.
8. I confirmed that the regex on line 16 contains the real characters U+0300 through U+036F (checked with `od -c`).
9. Structural argument:
   - After line 22, the slug contains only `[a-z0-9-]`. Runs of other characters are collapsed into one hyphen, so there are no double hyphens, and the ends are trimmed.
   - Line 26 takes a prefix of that slug, so it still has no double hyphens. It then trims hyphens from both ends again.
   - Given a valid slug, lines 15-22 return it unchanged, and the slice on line 26 does nothing because the length is already `<= maxLength`. So slugify is idempotent.

Reproduction command used for attempt 1 (run from the project root):

```
node --input-type=module -e 'import {slugify} from "./src/slugify.mjs"; /* fuzz loop as described above */'
```
