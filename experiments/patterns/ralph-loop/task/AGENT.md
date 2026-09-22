# Operating notes

Read this before taking a plan item; append what you learn at the end, one
line per lesson, so the next pass starts where you left off.

- The module is `src/text.mjs`, ES modules, no dependencies. Tests use
  `node:test` and `node:assert/strict`, one file per plan item under `tests/`.
- `npm test` runs every `tests/*.test.mjs`, including `tests/acceptance.test.mjs`,
  which runs the reviewer's held-out cases for every ticked item in `PLAN.md`.
- Commit on green with `git add -A && git commit -m "<item>: <what>"` — one
  commit per item, after ticking it in `PLAN.md`.
- Never weaken, skip or delete a test to get a pass; fix the code.

## Learned

