# 0009 · Proving records are evidence

**Date:** 2026-09-20 · **Status:** accepted · **Deciders:** owner (spend), driver

## Context

Stage 6 turns the template library's claims into recorded headless runs under `experiments/patterns/`. Two batches (slices 0009 and 0011) and two re-proving runs (slice 0010) have now been kept, and each raised the same questions: may a record be tidied after the fact, what happens when the check that reads records is found wrong mid-batch, and what a failing record means for the template it proves.

## Decision

- **Evidence is never edited.** Everything under `experiments/patterns/<id>/run*/` is what the harness and the lead wrote. A re-proof goes to `run/` with the earlier evidence moved unedited to `run-1/`, `run-2/`, and the write-up covers both.
- **The check may be corrected; the records may not.** `scripts/prove-pattern.sh --check` reads evidence and may gain or fix a heuristic at any time. Every kept record is re-checked after such a change, and a verdict that changes is reported in the handback.
- **A red record stays red.** A record that fails the check for a true reason (a stand-in agent, an ending the graph lacks) is published red with its write-up saying why. It turns green only through a fixed template or brief and a budgeted re-proof, never by loosening the check.
- **A lost bet is a result, not a failure.** A task designed to force a back edge that a builder beats at round 0 is recorded as such (`backEdge` is a finding, not a problem); an ending outside the template is a problem.
- **Held-out evidence is by instruction, not permission.** Cases a critic holds and a builder must not see live beside the project, readable by rule for the whole session; the run digest records who read them, and the check asserts it.
- **Spend is a ledger the runner keeps**, under an owner-set cap with a floor and a per-invocation ceiling; the ledger is written by the runner (and its CLI for probes), never by hand except to raise the cap, which is recorded in `cap_history`.

## Consequences

- Batch-two records for `fresh-grind-rare-judge` and `specialist-critic-bank` are published red. Their fixes are slice 0012's; re-proving them is a later spend decision.
- The proving runner is the acceptance test for lead-brief and template changes: a change is proved by a green re-proof, not by reading the brief.
- Write-ups link every claim to a file under `run/` (spec §13) and say what one run showed (spec §15).
