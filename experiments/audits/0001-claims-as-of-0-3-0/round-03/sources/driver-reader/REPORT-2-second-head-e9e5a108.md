# The driver's fresh reader on pull request #172, at e9e5a108

One fresh reader (a Claude Code subagent, Opus 5.5, no context of the work, read-only) was asked by the driver to try to break the repair of the stops comparison. This is its report on the head `e9e5a1082797cc4a64e5c38cf47aed7a9543acd7`, as it handed it back on 2026-10-06, word for word. Paths inside it point at a session scratch folder; the same scripts and outputs are beside this file (the second reading's in `p2/`, the third's in `p3/`).

**#172 at e9e5a108: one thing held at ab0df981 is let through, by the last commit. The rest of the fix pass holds.** Scripts and outputs: `/private/tmp/claude-501/-Users-noir-Documents-grooph/3e9d2b43-91b3-40a4-9859-23f9fc76c901/scratchpad/read-0172/p2/`. Nothing tracked changed; my worktree of the first head is removed, so two-head scripts need one rebuilt.

## Held at the first head, let through now
A new second loop on the back edge of a critic-judged loop, with a looser bar of its own and `bar-passed then <node>`, was refused at `loop:again`. It is now adopted, exit 0 at adopt and export.
- `cases-two-loops.mjs` J1, J2, J4.
- `clone-builtins.mjs`: 12 cases on six built-in loops (contradiction-seeker, debate, dual-bar, red-team, spec-then-loop, research-study).
- Cause: `judged(other, old ?? loop)` in e9e5a108. It was meant to keep the no-`then` clone unheld (J3, adopted at both heads) and took the `then` form with it.
- The loop's own "bar passed" under a critic is unheld as before (K1 to K3).
- `docs/runs.md` and `docs/templates.md` still say such a second loop is held.

Sure: run at both heads.

## An honest change newly held that should not be
"Ask a person every n", lowered (`every-lowered.mjs`, 6,000 lists, against exact passes n, 2n, 3n):

| Lowered to | Held | Of those, a real run exists |
|---|---|---|
| A number that does not divide n | 893 of 2,917 | 835 |
| A divisor of n (4→2, 6→3) | 275 of 872 | 0 |
| Every round | 0 of 2,211 | n/a |

- The non-divisor case is right by the firing rule.
- The divisor case is not: the copy asks on every pass the source asked, and more.
- The reason misleads in both: "could fire before the stop where a person is asked every 4 rounds, as it could not before". It always could, on rounds 1 to 3, and the line never says the interval changed.

## The label
- **No leading-on stop under "tightens a brake":** 0 of 457,999 changes that bring one in or promote one (core), and 0 of 60 at adopt and at export (`label-cli.mjs`).
- **Plain tightenings with no `then`** keep the word; none lost it (`label2.mjs`).
- **Opposite error:** a limit that halts through a `then` (to a stop that halts, or a gate), lowered or moved first, is now "not judged", 4,474 of 4,474; the first head said "tightens". The sentence above that list says it "lets a person or a run do what it could not before", which is untrue of these. This follows your "wherever it leads" ruling; whether a lowered one counts as "brought in" is yours to rule.

## Words
- `docs/runs.md` says a new leading-on stop in the outer loop, the inner holding the limit, is held ("the other way round"). It is adopted, with a cap, a budget or a person inside (`cases-more.mjs` N1 to N3).
- The three roads are listed as not held.
- Row C45 no longer reads as complete.
- Reasons: I read 23 shapes (`reasons.json`). Twenty are true and enough, both lines are said, and "1 dispatch" is right. The three weak ones are person lines: the two above, and "before the stop where a person is asked every 2 rounds" for a cap of three, which means a later asking.
- Time: 160 stops 3 ms, 1,000 in 24 ms, as claimed. But it is cubic where every stop draws a line (`perf2.mjs`): 1,000 stops with a person between every two takes 27 s; 800 resized budgets take 64 s. The timing test's lists draw no line.

## Confirmed
- Q1, Q3, cases-a 8, 9, P1, P2, and "bar passed" with no `then` (4, 5, 7, 21, and new behind) are held.
- The new tests fail on the first head's files, 12 of 13; the thirteenth is unchanged behavior, not vacuous.
- The empty assertion is gone, and the model test is real.

## What I ran
- **Hand cases:** the 67, both heads: 0 let through, 12 newly held.
- **Earlier outputs:** all 115, both heads: 32 differ, in words and dropped "tightens" lines only.
- **Differential fuzz:** 793,137 single-loop pairs, both heads: none held at the first and adopted now.
- **Model fuzz:** 575,781 of those against my own model: all 82,597 real runs held, all 27,928 careful-only runs held.
- **The new line:** on the 35,605 pairs where I counted it, never said without a run by the careful reading.
- **Suites:** core 593, CLI 239, adopt-brakes spec 10 of 10 on port 4371.

The single-loop logic I could not break; the regression is in the two-loop clause.
