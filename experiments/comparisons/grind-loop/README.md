# grind-loop · the graph against a prompt

The first paired comparison of the `grind-loop` template (protocol [`docs/comparisons.md`](../../../docs/comparisons.md); handoff 0016). Three arms on one task, two replicates each, scored by the same script, judged blind. Results follow the pre-registration below; nothing above the "Runs" heading was changed after the first run.

## Pre-registration

Written and committed before any run of this project (protocol §7; the same text is in [`expect.json`](expect.json) for the scorer and the summary).

**Task.** [`task/`](task/): `compare(a, b)` in `src/semver.mjs` is a stub, and `tests/semver.test.mjs` holds ten failing tests of semver precedence. The ask ([`slots.json`](slots.json)) is the proving ground's, plus one sentence every arm gets: a held-out set of cases exists outside the project, is run against the result afterwards, and is not the builder's to read or run.

**The design bet.** `grind-loop`'s mechanism is a check node the lead runs itself, fresh, after a fast-tier builder reports. When the visible tests are the whole specification, that check confirms rather than catches (the proving run showed exactly that: one pass, $0.66), so the graph should do **no better** than one session on the held-out suite and should **cost more** (a lead plus a subagent against one session). This project is the study's floor: it measures what the structure costs when it has nothing to add.

**The measure that would show it.** Held-out passes out of 62 ([`held-out/semver-cases.test.mjs`](held-out/semver-cases.test.mjs): cases absent from the visible suite — numeric identifiers beyond 2^53, ASCII order of alphanumeric identifiers, field-count precedence, hyphen-only identifiers, twenty refused shapes, non-string arguments); the visible suite passing with `tests/semver.test.mjs` untouched (the scorer reports a change to that file); cost and harness turns.

**What counts as the graph losing.** Arm A's held-out passes are not above arm B's in either replicate while A costs more. The graph earns its cost only if A's held-out range lies wholly above B's.

**Arms.** A: the package as `scripts/prove-pattern.sh grind-loop` runs it (builder on `sonnet`, the lead runs `npm test`, loop `grind`: at most 5 rounds, 30 minutes). B: [`prompt-B.md`](prompt-B.md), derived from that package by rule (§3), one session. C: the same prompt in up to N = 5 fresh sessions ([`loop-C.sh`](loop-C.sh)). Lead `claude-opus-5`, effort `high`, in every arm; the proving allowlist plus `Read` on the held-out folder; `--strict-mcp-config`; one ceiling per invocation from [`../ledger.json`](../ledger.json).

**Held-out.** `grind-loop` has no reviewer node, so no arm is told where the suite is; the scorer runs it after the run against the final tree. The transcript digest records whether anything in any arm touched the folder.

**Replicates.** Two per arm, alternating A1 B1 C1 A2 B2 C2. Two is a range, not a mean; the tables say so.

## Runs

_(filled after the runs by `scripts/lib/compare-summary.mjs grind-loop`)_

## The judge's reasons

_(after the judge call)_

## Did the graph earn its cost

_(the one required line, with the range that says so)_

## What this comparison cannot show

That the template beats a human, a named product (spec §15) or another model; with n = 2, a small difference at all; anything about a task larger than ten tests on one function.
