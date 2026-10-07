# The driver's fresh reader on pull request #172, at ab0df981

One fresh reader (a Claude Code subagent, Opus 5.5, no context of the work, read-only) was asked by the driver to try to break the repair of the stops comparison. This is its report on the head `ab0df9817de70b083ab756567080a3e300187144`, as it handed it back on 2026-10-06, word for word. Paths inside it point at a session scratch folder; the same scripts and outputs are beside this file (the second reading's in `p2/`, the third's in `p3/`).

**#172 at ab0df981: I could not break the rule it states, and nothing held on main is let through.** What still gets through does so on main too. Scratch (scripts and what they printed): `/private/tmp/claude-501/-Users-noir-Documents-grooph/3e9d2b43-91b3-40a4-9859-23f9fc76c901/scratchpad/read-0172/`. The repository is untouched; my main worktree is removed.

## A loosening gets through
All at core, `adopt --write` and `export --into` (exit 0); items 2 to 4 also through `sub update` (`cases-sub.mjs`).

1. **One added stop launders the repaired case** (`cases-p.mjs` Q3, Q4). `[budget 9] → [cap 2 then done | budget 9]` is refused. Append `human every 1` and it is adopted and printed "tightens a brake". Pass 1 asks a person; on a yes, pass 2 ends in success ahead of the budget. Q1: a source that asks every round loses every later asking to a cap of two put first. This is the author's "after a person has been asked" limit, wider than its example. A plain reader would call it loosened. Sure at head; not run on main (its near twins, `cases-a.mjs` 29 to 31, are adopted there).
2. **"Bar passed" with no `then`, in a loop no critic judges** (`cases-a.mjs` 4, 5, 7). `[cap 2 | bar-passed] → [bar-passed | cap 2]`, or new ahead of the cap, is adopted with no word; main the same. The PR body's "Held only where no critic… is among the loop's members" is true only with a `then` (case 6). Sure.
3. **A source stop that asks a person and continues is unprotected** (cases 8, 9). `[human then wrap] → [cap 1 then wrap | human then wrap]`: nobody is asked. It is held only where `wrap` is reached solely by that stop (case 10). In no list. Sure.
4. **Other roads, where only the limit stands before the end.** A new leading-on stop in an inner loop while the outer loop holds the limit (11, 12; the PR names only the reverse). A new step on the round with a one-node loop and `cap 1 then done` (17). A plain new edge worker→done (3) is adopted too, so scope is yours to rule.

## The author's "still not held" list
Each item is as described (`cases-b.mjs`, 27 cases).
- **Loosened, to a plain reader:** the bar-passed swap, the person's continuing stop, after-a-person, inner/outer loops.
- **Not loosened:** the retrospective, the stops on rounds without progress.
- **`docs/runs.md`:** its list omits items 2 and 3 above, nested loops, and stops that lead to a human gate (only counted). "So is a second limit that leads to the judge" holds only ahead of the budget (6c is adopted).
- **`docs/claims.md` C45:** its parenthesis names three limits and reads as complete.
- **`docs/templates.md`:** nothing beyond the code.

## An honest change is held
- **Built-ins** (`honest.mjs`): 575 honest edits on 26 loops, one refused (debate's cap 2→1); main none. Each of the 24 against itself: 0 refused, `brakesLost(g, g)` empty. New halting stops: 364 of 364 adopted.
- **Outside the built-ins the price is higher than "15 of 138"** (`honest-random.mjs`, 4,000 lists). Lowering by one a limit that leads on beside one that halts:

| Limit lowered | Refused at head | On main | A real run exists (my model) | Only if a budget may fall on any pass |
|---|---|---|---|---|
| Budget | 558 of 747 | 0 | 408 | 150 |
| Cap | 233 of 507 | 32 | 164 | 44 |
| Rounds without progress | 354 of 486 | 0 | 335 | 19 |

- **Never refused:** a halting limit lowered (0 of 8,528), a new halting stop (0 of 20,000), a halting stop moved first (0 of 6,312).
- **The reason is readable but does not say what changed.** "Comes first in the loop's stops" was already true before the number was lowered.

## The label
Two kinds are still printed under "tightens a brake" on an adopted change:
- the person's stop that continues (the author's; 69 built-in cases, and Q3 above);
- **a new cap or budget whose `then` is a human gate**: 8 of 8 on `plans/literature-review`, and case 23, a new gate whose one answer leads to done, printed twice.

In 108,700 single insertions and reorderings there was no other kind; main printed 3,099 at one seed.

## Tests
- On main's two files all 8 new core tests fail (16 assertion errors, no import error), with the 2 changed core tests and the 2 new and 1 changed CLI tests.
- Main's versions on head: two fail (the A-019 names; a regex order) and the third change is additive. All three are justified.
- The PR body says "in place of"; the test asserts both lines.
- `checkAdoption(doc, clone).changes == []` passes whatever the code does.
- The built-ins test counts any refusal. I read all 1,229: each is at `loop:<id>.stops`, about the stop.

## Release
- **Conflict.** `git merge-tree` against origin/main ba55526c conflicts in `docs/claims.md` (row C45, the line #167 edited). The green checks are this head's; resolving makes a head nobody has read.
- **Time grows about n⁵ in one loop's stops** (`perf-one-loop.mjs`): 10 stops 10 ms, 40 0.3 s, 80 8.4 s, 120 63 s, 160 270 s; main 1 ms. The schema sets no limit, and this runs at every door and in the app. 200 loops of 10 stops: 9.8 s, main 9.6 s.
- **A reason is hidden.** Where an older line speaks of the same kind, the new one is dropped: `cap 1 then wrap` added to `[cap 3 then done | budget 3 then gate]` prints only "would lead on to "wrap", not to "done"".
- **Small:** "1 dispatches". American English passes. Malformed stops give E_SCHEMA at both commands, no trace.

## What I ran
- **Earlier probes:** the 13 audit tools and all 115 earlier-reader outputs on both builds. 32 differ, each a reason added, a label gone, or a copy newly held; the author's figures reproduce.
- **My fuzzer** (`fuzz-stops.mjs`, with `model.mjs`, my own model of §2): 346,240 valid pairs on three kinds of loop. 48,296 had a real run and 10,196 more had one only under any-pass budgets; every one was held at `loop:<id>.stops` for a reason about the stops. Main misses 847 of 2,891 at seed 1.
- **Consistency:** 60,000 unchanged lists beside another change gave 0 lines. 150 random pairs through core, adopt and export gave 0 disagreements.
- **Suites:** core 588 and CLI 238 pass; the adopt-brakes browser spec passed 10 of 10 on port 4371.
- **Not run:** web unit tests, the full browser suite, any model.
