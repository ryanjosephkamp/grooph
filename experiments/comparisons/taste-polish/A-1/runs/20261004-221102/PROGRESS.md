# Progress · polish-usage-statement · run 20261004-221102

**Goal.** Polish the monthly usage statement that `npm run render` writes from src/statement.mjs until it reads like the billing team's statement (work from STYLE.md; data/usage.json is the data; `npm run capture` produces what is judged). Done when a frontier critic comparing captures against the held-out reference finds no major gap, or when the human stops the polish.

**Status: ended at `done` (success).** Ended 2026-10-04T22:16:50Z.

- Round: 1 (round 0 plus one back edge)
- Dispatches (`polish`): 6 / 16

| node | status |
|---|---|
| owner | done (rounds 0, 1) |
| capture-check | pass (round 0, sha256 f62c43e4cca8; round 1, sha256 3cd529c434b2) |
| critic | fail (round 0); pass (round 1) |
| done | reached |

| round | major gaps | minor gaps | verdict | report |
|---|---|---|---|---|
| 0 | 4 | 1 | fail | GAPS-round-0.md |
| 1 | 0 | 2 | pass | GAPS-round-1.md |

**Waiting on:** nothing.

**Last stop check (after round 1):** stop 1, bar-passed, fired. The critic passed and the capture was current (22:15:39Z, sha256 3cd529c434b2) and readable. The run took `e-critic-pass` to `done`.

**Why it ended.** The bar "Match the reference" passed in round 1. The critic found no major gap and every capture was current and readable.

**Left over (minor, from GAPS-round-1.md).**
- The credits block has no heading. "Credits" appears only as the subtotal label (captures/statement.txt:17-20).
- The credits subtotal and the double rules crowd the area around the total (captures/statement.txt:20-24).

## Amendments

- **n-0002 · owner inputs and owns.** The held-out reference is out of the owner's inputs and STYLE.md is in; owner `owns` is now src/statement.mjs, captures/, out/, CHANGES.md. Why: the goal says the owner does not read the reference, and the builder had no owned files. This tightens isolation. Validated clean with `grooph validate --for-export`.
- **n-0003 · proposal (not made).** Regenerate `.claude/agents/polish-usage-statement--owner.md` from the amended graph. This session wasn't allowed to edit that file, so each owner dispatch prompt carried the restriction instead.
