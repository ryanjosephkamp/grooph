# patrol-pulse · one proving run

_Pre-registered 2026-09-22, before the run; the sections after "Pre-registration" are written from the record afterwards._

**Credits:** u/croovies's "Lloyd" heartbeat orchestrator as written up by explainx.ai (2026-08-14, a secondary source): a standing checklist per pulse, a read-only investigator, findings to a durable ticket store, humans prioritise; Steve Yegge's Gas Town patrols: patrol agents that loop by design, here one pulse is one run.

## Pre-registration

**Task.** [`task/`](task/): `orders-api`, a small HTTP service with a routing table, a fixed connection pool and a webhook verifier, and yesterday's log ([`logs/app.log`](task/logs/app.log), 78 lines). The scan command (`grep -n -E ' (ERROR|WARN) ' logs/app.log`) lists 14 `ERROR` lines and 20 `WARN` lines. `README.md` says which lines are routine: slow `/reports` requests during the nightly export, cold-cache misses after a deploy, retries that succeeded, the deprecated header, expiring tokens, and a single failed health probe followed by `probe ok`. Two faults are genuine: the payment webhook signature mismatches (four dropped events across the day), which [`TICKETS.md`](task/TICKETS.md) already holds as **T-0007 (open)**, and the connection pool exhausting during the noon flash sale (four `503`s in five seconds), which no ticket holds.

**Why a first pass should not simply succeed.** A pulse has no loop; what can go wrong is judgment, and the fixture sets three traps. The investigator can ticket the noise (the nightly `/reports` slowness looks like T-0005, which is a different fault; the failed probe looks like an outage), can miss the pool exhaustion because it is a burst inside a busy minute, or can report the webhook mismatches as new. The writer can then file two tickets where one is due, or file the pool exhaustion under T-0005's title. The bet is the narrow outcome: **exactly one new ticket** (the pool exhaustion), **T-0007 referenced rather than refiled**, **nothing outside `TICKETS.md` changed**, and a **halt note at `prioritise`**.

**Expected probability that the bet pays in full:** about 0.6. The investigator is a strong-tier critic with the README's noise list as an input, so finding both faults is likely (0.85); the writer's dedupe against T-0007 is the brief's first sentence, and the ticket format is given (0.8 given the findings); a halt note at the gate has been reliable since slice 0010 (0.95). What `--check` asserts is in [`expect.json`](expect.json): `added` counts the `## T-` headings TICKETS.md gained (exactly one), `ownership` confines the writer to TICKETS.md, `reports` require the investigator's own FINDINGS.md and the writer's own FILED.md, `ending` requires the halt at `prioritise`.

**Shape.** `scan` check (`grep`; nothing printed ends the pulse `clean`) → `investigator` (strong critic, fresh, read-only: allow `read-files`, `run-commands`, `write-outputs`; deny `edit-files`; evidence: the scan output, TICKETS.md read-only, the repository read-only) → verdict `clean` → `clean` stop; verdict `finding` → `ticket-writer` (fast builder; owns TICKETS.md) → `prioritise` gate → `done`. No loop: one pulse is one run.

**Spend expected:** about $1.50 (two dispatches, no round). Ledger cap $75.00, $29.36 available before this run.
