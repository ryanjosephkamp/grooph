# Run 20260922-050527 · Orders API patrol

**Goal.** Watch the orders API's log for faults users would feel: failed requests, retries that never succeed, resources running out. README.md says which lines are routine noise. One pulse is one run: it ends clean, or with new tickets in TICKETS.md for a human to prioritise. Nothing else changes.

**Round:** 0 (graph has no loops)

## Nodes

| node | status |
|---|---|
| scan | pass — 33 candidate signals (ERROR/WARN), saved to `scan-output.txt` |
| investigator | pass — verdict `finding`: 1 new fault (db pool exhaustion, 503s on /orders), 1 already covered by T-0007; FINDINGS.md written |
| ticket-writer | pass — filed T-0008; F-2 cross-referenced to T-0007; FILED.md written |
| prioritise | **halted — waiting for the human** (options: prioritised \| later) |
| clean | not taken |
| done | pending |

## Waiting

Human gate `prioritise`: this pulse filed T-0008 in TICKETS.md (see FILED.md) and changed nothing else. Answer `prioritised` or `later`; either routes to `done`. Resume with run id `20260922-050527`.

## Last stop check

None (no loops).

## Amendments

None — the working copy is identical to the source document.
