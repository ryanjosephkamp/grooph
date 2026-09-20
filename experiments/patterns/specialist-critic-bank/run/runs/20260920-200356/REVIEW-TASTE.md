# REVIEW-TASTE — round 1, `search-user-files`

Scope: naming, structure, readability and fit with the surrounding code. Evidence: `DIFF.patch` plus `src/store.mjs`, `tests/store.test.mjs`, `README.md` as the change leaves them.

Overall: the change fits the file well. The new export sits beside the existing three with the same one-line-JSDoc voice, `listFiles` was folded onto the shared `fileNames` helper rather than duplicated, and each private helper does one thing with a comment that says why (the `needle.length - 1` carry-over is explained at `src/store.mjs:47-52`, not left for the reader to derive). The README entry matches the prose style of the entries above it. No blockers, no majors.

## Findings

### Minor

1. `src/store.mjs:92-93` — `isUnder` and `escapes` are one-line `const` arrows parked after the function that uses them, while every other helper in the file is a `function` declaration with a JSDoc line (`fileContains`, `fileNames`, `resolveWithin`). Two styles for the same kind of thing in a 93-line module. `escapes(sub)` also reads as a predicate ("does sub escape?") but builds an Error; a name like `escapeError(sub)` or inlining the `new Error(...)` at the two throw sites would say what it is.

2. `src/store.mjs:43` and `src/store.mjs:58` — the buffer contract is split across caller and callee: `searchFiles` sizes `buf` as `needle.length - 1 + CHUNK_BYTES`, and `fileContains` separately asks `readSync` for `CHUNK_BYTES` bytes at offset `kept`. The two only agree because both read the same module constant; reading `buf.length - kept` in `fileContains` would let the buffer describe itself and drop one half of the coupling the comment at lines 49-51 has to explain.

3. `src/store.mjs:58` — `const read = readSync(...)` names a byte count with a verb; alongside `kept` and `end` a noun (`got`, `bytesRead`) reads more evenly and avoids the eye pausing on `read === 0`.

4. `src/store.mjs:39` and `src/store.mjs:82` — the option is called `within` at the boundary, becomes `sub` inside `resolveWithin`, and the TypeError at line 83 talks about `within` again. Keeping one name through the helper (`within`) would spare the reader the rename.

5. `tests/store.test.mjs:55` — `const chunk = 1 << 20;` restates `CHUNK_BYTES` by value. If the constant changes, this test silently stops exercising the boundary. Either export the constant for tests or leave a comment tying the literal to `CHUNK_BYTES`.

6. `tests/store.test.mjs:129` — `"../root2"` is a hand-written path where every neighbouring test builds paths with `join(...)` (lines 99-101, 112), and it hard-codes the `"root"` leaf that `fresh()` chooses at line 9; `join("..", `${basename(root)}2`)` or reusing the `${root}2` expression from line 128 would keep the test self-consistent.

## Verdict

No blocker or major findings. The six minors above are polish; none should hold the change.
