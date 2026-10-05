# Progress · orders-api-patrol · run 20261004-225445

**Goal.** Watch the orders API's log for faults users would feel: failed requests, retries that never succeed, resources running out. README.md says which lines are routine noise. One pulse is one run: it ends clean, or with new tickets in TICKETS.md for a human to prioritize. Nothing else changes.

**Status: ended — halt at stop node `no-log`.** Not clean: the log was never read.

**Round:** 0 (the graph has no loops)

| node | status |
|---|---|
| `scan` | ran once: **invalid-evidence**, `logs/app.log: No such file or directory`, exit 2 |
| `log-present` *(added by amendment)* | ran once: **fail**, `test -s logs/app.log` exit 1 |
| `investigator` | not run |
| `ticket-writer` | not run |
| `prioritize` | not reached |
| `clean` | not reached, on purpose: a missing log is not an all-clear |
| `done` | not reached |
| `no-log` *(added by amendment)* | **reached**: the run ended here |

**Waiting on:** the human, to find out why `logs/app.log` is missing. It is not in the working tree and was never committed. Once it is in place, the next pulse is a new run.

**Last stop check:** none applies (no loops). The run ended because it reached a stop node.

**Dispatches:** 0 agent dispatches.

## Why the run ended

The scan command `grep -n -E ' (ERROR|WARN) ' logs/app.log` exited 2 because the file does not exist. The graph as compiled treats "nothing printed" as a fail, and a fail routes to `clean`. Following it literally would have reported a clean pulse for a log nobody read. No edge routed invalid-evidence, and the evidence could not be repaired without making up a log. So the working copy was amended (below), and the new precondition routed the run to `no-log`.

## Amendments

1. **n-0004.** Added the check node `log-present` (`test -s logs/app.log`) as the new entry, ahead of `scan`:
   - `e-log-present-scan` routes pass to `scan`.
   - `e-log-present-no-log` routes fail to the new stop node `no-log` (outcome `halt`).
   - Clarified the pass text of `scan`: exit 1 is the clean fail, and exit 2 is invalid-evidence.

   This only tightens the graph. No gate, approval, stop or critic isolation was loosened. Hand-edited in `runs/20261004-225445/graph.grooph.json`, and `grooph validate --for-export` reports no issues. The source document is untouched. Adopt or discard this copy.
