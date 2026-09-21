# red-team-loop · the graph against a prompt

The first paired comparison of the `red-team-loop` template (protocol [`docs/comparisons.md`](../../../docs/comparisons.md); handoff 0016). Three arms on one task, two replicates each, scored by the same script, judged blind. Results follow the pre-registration below; nothing above the "Runs" heading was changed after the first run.

## Pre-registration

Written and committed before any run of this project (protocol §7; the same text is in [`expect.json`](expect.json) for the scorer and the summary).

**Task.** [`task/`](task/): `csvline`, the proving ground's task unchanged — one CSV record parser with a written contract in `README.md` and a first implementation that handles only the plain and quoted cases. The ask ([`slots.json`](slots.json)) is the proving ground's, word for word.

**The design bet.** `red-team-loop`'s mechanism is a frontier attacker in a fresh context that sees the running code and the contract, not the builder's reasoning; it should find the contract lines a strong builder's own tests miss, so arm A should reach the **highest held-out pass rate**. The proving run showed the other side: a strong builder given a precise forty-line contract left a frontier red team nothing to find. So the honest expectation is that A **matches** B on held-out at about twice the cost, and the bet pays only if a prompt-arm builder leaves a class of inputs unhandled that A's red team catches.

**The measure that would show it.** Held-out passes out of 73 ([`held-out/csv-cases.test.mjs`](held-out/csv-cases.test.mjs): every contract line applied to one input — 35 field cases, 20 `CsvError` cases, 8 non-string types — the eight 100 KB timing shapes, and a 7,000-input sweep that accepts nothing but fields or `CsvError`); traces written and back edges taken in A (its run record); cost.

**What counts as the graph losing.** Arm B's held-out passes equal or exceed arm A's in both replicates. The graph earns its cost only if A's held-out range lies above B's.

**Arms.** A: the package as `scripts/prove-pattern.sh red-team-loop` runs it (builder on `opus`, red team on `fable` owning `traces/`, loop `attack`: diminishing returns after 2 rounds, at most 5 rounds, 12 dispatches). B: [`prompt-B.md`](prompt-B.md), derived from that package by rule (§3), one session. C: the same prompt in up to N = 5 fresh sessions ([`loop-C.sh`](loop-C.sh)). Lead `claude-opus-5`, effort `high`, in every arm; the proving allowlist plus `Read` on the held-out folder; `--strict-mcp-config`; one ceiling per invocation from [`../ledger.json`](../ledger.json).

**Held-out.** The proving task had no held-out suite; this one is written from the README contract alone, for the scorer only. No arm is told where it is (the template's red team writes its own attacks, and handing it a suite would change the mechanism under test). The digest records whether anything touched the folder.

**Replicates.** Two per arm, alternating A1 B1 C1 A2 B2 C2. Two is a range, not a mean; the tables say so.

## Runs

_(filled after the runs by `scripts/lib/compare-summary.mjs red-team-loop`)_

## The judge's reasons

_(after the judge call)_

## Did the graph earn its cost

_(the one required line, with the range that says so)_

## What this comparison cannot show

That the template beats a human, a named product (spec §15) or another model; with n = 2, a small difference at all; anything about an attack surface larger than one function with a complete written contract — the proving write-up already says a surface the contract does not spell out is what the pattern needs.
