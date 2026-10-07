# The driver's fresh reader on pull request #172, at 2cc780bc

One fresh reader (a Claude Code subagent, Opus 5.5, no context of the work, read-only) was asked by the driver to try to break the repair of the stops comparison. This is its report on the head `2cc780bcf2d976ae600ff1ee681e65133704fe8c`, as it handed it back on 2026-10-06, word for word. Paths inside it point at a session scratch folder; the same scripts and outputs are beside this file (the second reading's in `p2/`, the third's in `p3/`).

**#172 at 2cc780bc: all six hold, and 3(b) and 3(c) find nothing. By my reading this head merges, with one point for your ruling under 3(a).** Scripts and outputs: `/private/tmp/claude-501/-Users-noir-Documents-grooph/3e9d2b43-91b3-40a4-9859-23f9fc76c901/scratchpad/read-0172/p3/`. Nothing tracked changed; my two scratch worktrees are removed.

## Let through that should be held
None.

## Untrue in the documents or the label
None found.

**3(a), for your ruling:** `docs/graph-ir.md` does not say n, 2n, 3n. It says only "human halt; optionally asked every N rounds" (§1, the stop type's comment). §2 says nothing of which rounds, and numbers the first pass round 0. Exact reckoning is the plain reading, and the same count the comparison already uses for a cap of n, but it is a reading. One sentence in §2 would make it the contract's.

## Confirmed
1. **The regression.** J1, J2, J4 are refused again at core, adopt and export; J3 and K1 to K3 are adopted as at ab0df981. `clone-builtins.mjs`: 0 of 175 let through.
2. **Divisors** (`every-lowered.mjs`). To a divisor 0 of 872 held, to every round 0 of 2,211, all called a tightening. To a non-divisor 893 of 2,917 held, with a real run in 835.
3. **Exact reckoning** (`tri.mjs`, three builds, 329,828 fresh pairs).
   - (b) 437 pairs were held at e9e5a108 and are adopted now. None has a real run by exact passes with the run going on from every person's stop.
   - (c) No pair held at ab0df981 is adopted now, of any kind.
   - On the 117,651 pairs I modelled in full, all 21,037 real runs are held; 199 are still held with no run, the careful side that is left.
   - The reworded person lines read true.
4. **The label** (`label2.mjs`, against the first head). A `then` to a stop that halts keeps "tightens" (3,542 of 3,542). A `then` to a human gate is not judged (3,061). `label-cli3.mjs`: 0 wrong of 120 at adopt and at export. The sentence above the not-judged list is true of everything listed; its weakest fit is a limit that leads to a gate, lowered.
5. **`docs/runs.md`.** Both nestings, the three roads and the second-loop clause match the code. Its figures re-measure: 558, 282, 371, 100; 575 with one held; 1,306 with 77.
6. **Time.** 1,000 stops with a line each: 27 to 52 ms in three shapes. The timing test now asserts the lines. One shape of mine is still slow, and the same at e9e5a108: 40 loops on one back edge with 40 stops each takes 14 s and writes 12 MB of reasons.

Also run: core 595 and CLI 239 pass; the adopt-brakes spec 10 of 10 on port 4371. GitHub reports the pull request mergeable and clean.
