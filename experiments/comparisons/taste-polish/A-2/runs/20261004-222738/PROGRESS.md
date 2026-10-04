# Progress · polish-usage-statement · run 20261004-222738

**Goal.** Polish the monthly usage statement that `npm run render` writes from src/statement.mjs until it reads like the billing team's statement (STYLE.md says what it should be; data/usage.json is the data; `npm run capture` produces what is judged). Done when the critic finds no major gap against the held-out reference, or the human stops the polish.

**Status: ended — success.** The bar-passed stop fired at round 1, and the run reached the stop node `done`.

- Rounds: 2 passes (round 0, round 1); one back edge taken (`e-critic-fail`)
- Dispatches of `polish`: 6 / 16
- Major gaps by round: r0 = 4 · r1 = 0
- Last stop check (after round 1): bar-passed **yes** → took `e-critic-pass`

| node | status |
|---|---|
| owner | ran twice (r0: rebuilt from STYLE.md; r1: closed all 5 ranked gaps) |
| capture-check | passed twice (r0 sha 5de9f33c585c; r1 sha c023b762ac0c, byte-identical to fresh render) |
| critic | r0 fail (4 major, 1 minor) · r1 pass (0 major, 2 minor) |
| done | reached |

Reports kept: `GAPS-round-0.md`, `GAPS-round-1.md`, `CHANGES.md` (round 1).

## Left over (minor, not blocking)

1. The footer note wraps in the middle of "Machine learning inference" (captures/statement.txt:23-24).
2. Credit labels are indented two spaces; the critic calls this an optional style choice.
3. The changes in `src/statement.mjs` and the `captures/` folder are not committed.

## Amendments

1. `owner` inputs: replaced the held-out reference with "STYLE.md and data/usage.json". The goal says the owner never reads the reference. Permissions refused the edit to `.claude/agents/polish-usage-statement--owner.md`, so both owner dispatch prompts said the reference was off-limits. **Proposal:** recompile the owner agent file from the working copy, or fix its Inputs in the source graph.
