# Evidence for judge · phase 1 · phases round 0

## Diff since the last phase boundary (commit eda0b94, the run's start)

`git status --short` at 2026-09-20T19:56:46Z:

```
?? CHANGES.md
?? src/
```

Both are new, untracked files: `src/tokenize.mjs` and `CHANGES.md`. No tracked file was modified (`git diff --stat HEAD` is empty). `tests/tokenize.test.mjs` is unchanged from the commit.

## `npm test` output (run bare from the project root, exit code 0)

```
> calc@0.1.0 test
> node --test tests/*.test.mjs

✔ numbers, operators and parentheses with positions (0.656083ms)
✔ whitespace of every kind is skipped and the empty text has no tokens (0.064792ms)
✔ a bad number and an unknown character are SyntaxErrors that name the index (0.265292ms)
✔ a non-string is a TypeError (0.049042ms)
ℹ tests 4
ℹ suites 0
ℹ pass 4
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 42.394375
```
