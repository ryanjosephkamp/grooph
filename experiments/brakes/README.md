# Brakes

Experiments that ask whether a brake written in a graph stops work that would otherwise have gone on. In every package run on record at 0.3.0, and in both comparison studies, the only stops that fired were a passed bar, a human gate and one periodic human check-in. No round cap and no budget is on record as firing (audit 0001, finding F3).

| Experiment | What it asks | State |
|---|---|---|
| [`budget/`](budget/) | Does a dispatch budget halt a session whose work is still failing, at the budget, where a larger budget lets the same session go on? | Pre-registered on 2026-10-05. **Nothing has been run.** |

The count of record in every experiment here is the harness's: node runs counted from the session's tool events by [`scripts/lib/brake-count.mjs`](../../scripts/lib/brake-count.mjs), set beside the lead's own count and never replaced by it.
