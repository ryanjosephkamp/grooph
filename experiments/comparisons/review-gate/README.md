# review-gate · the graph against a prompt

The first paired comparison of the `review-gate` template (protocol [`docs/comparisons.md`](../../../docs/comparisons.md); handoff 0016). Three arms on one task, two replicates each, scored by the same script, judged blind. Results follow the pre-registration below; nothing above the "Runs" heading was changed after the first run.

## Pre-registration

Written and committed before any run of this project (protocol §7; the same text is in [`expect.json`](expect.json) for the scorer and the summary).

**Task.** [`task/`](task/): add `truncate(text, max)` beside an existing `padStart`, with a checklist ([`docs/REVIEW-CHECKLIST.md`](task/docs/REVIEW-CHECKLIST.md)) the critic judges against. The proving ground's task, with one item added to the checklist and one sentence to the ask, exactly as `heterogeneous-critic`'s batch-two task has them: item 7 names a held-out suite outside the project that the critic runs and the builder does not read; the ask says the suite exists and is not the builder's.

**The design bet.** `review-gate`'s mechanism is a critic in a fresh context that runs the held-out suite the builder never sees and returns the failures as `REVIEW.md`. The graph should reach a **higher held-out pass rate** than one session, because the single session judges its own work against a checklist whose seventh item it cannot run without reading a suite it was told is not its to read. The prompt arms say the same words; the bet is that isolation — a second context that may read the suite — is what the words cannot buy.

**The measure that would show it.** Held-out passes out of 41 ([`held-out/truncate-cases.test.mjs`](held-out/truncate-cases.test.mjs): the boundary at exactly `max`, `max` of 1, whitespace kept, the ellipsis as one character, twelve refused values of `max`, eight refused values of `text`); every checklist item, judged blind; whether the builder in any arm read the held-out suite (transcript digest); cost.

**What counts as the graph losing.** Arm B matches or beats arm A on held-out passes in both replicates at lower cost. The graph earns its cost only if A's held-out range lies above B's, or B reaches the same passes only by reading the held-out suite itself.

**Arms.** A: the package as `scripts/prove-pattern.sh review-gate` runs it (builder and critic on `opus`, loop `review`: bar-passed, at most 4 rounds, 10 dispatches, then a halt at `merge-gate`). B: [`prompt-B.md`](prompt-B.md), derived from that package by rule (§3), one session, the gate restated as "stop and report; do not merge". C: the same prompt in up to N = 4 fresh sessions ([`loop-C.sh`](loop-C.sh)). Lead `claude-opus-5`, effort `high`, in every arm; the proving allowlist plus `Read` on the held-out folder; `--strict-mcp-config`; one ceiling per invocation from [`../ledger.json`](../ledger.json).

**Held-out.** Named to every arm the same way: in checklist item 7, as the critic's to run and not the builder's to read. In A the critic is a separate subagent; in B and C whoever plays the critic is the same session or a subagent it chooses to dispatch. The digest records who touched the folder.

**Replicates.** Two per arm, alternating A1 B1 C1 A2 B2 C2. Two is a range, not a mean; the tables say so.

## Runs

_(filled after the runs by `scripts/lib/compare-summary.mjs review-gate`)_

## The judge's reasons

_(after the judge call)_

## Did the graph earn its cost

_(the one required line, with the range that says so)_

## What this comparison cannot show

That the template beats a human, a named product (spec §15) or another model; with n = 2, a small difference at all; anything about a task larger than one function and a seven-item checklist.
