# Task

Add `layer(base, over)` in a new file, src/layer.mjs: it returns the settings you get by laying `over` on top of `base`. Where both hold a plain object under the same key, the two are layered key by key, at any depth; everywhere else the value from `over` wins, and a key only one of them has is kept. Both arguments must be plain objects, or it throws a TypeError. Tests go in tests/layer.test.mjs, and CHANGELOG.md gets a line.

# Acceptance material

`README.md`, `docs/REVIEW-CHECKLIST.md` and `CHANGELOG.md` in this project say what the result must satisfy. Read them before you start.

# Test command

`npm test`

Done when the task is done, everything the acceptance material asks for holds, and `npm test` passes. Work in this project folder, and end by saying what you changed.
