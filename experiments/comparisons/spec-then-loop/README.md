# spec-then-loop · the graph against a prompt

The first paired comparison of the `spec-then-loop` template (protocol [`docs/comparisons.md`](../../../docs/comparisons.md); handoff 0016). Three arms on one task, three replicates each, scored by the same script, judged blind. Results follow the pre-registration below; nothing above the "Runs" heading was changed after the first run.

## Pre-registration

Written and committed before any run of this project (protocol §7; the same text is in [`expect.json`](expect.json) for the scorer and the summary).

**Task.** [`task/`](task/): `textwrap`, the proving ground's task unchanged — a tiny package with `countWords`, and the deliberately thin ask ([`slots.json`](slots.json)): "Add word wrapping to this project: a function that wraps text to a given width." Name, file, long words, whitespace and newlines are all left open.

**The design bet.** `spec-then-loop`'s mechanism is an answer key written before any code by a frontier planner, approved by a human, then a builder and an isolated critic looping against it line by line. On a thin task the bet is that the answer key makes the corners explicit (long words, blank lines, edges) and the critic holds the builder to them, so arm A's wrap **satisfies more of the invariants any wrap must satisfy** and reads as more complete to a blind judge than a single session that specs and builds in one breath. Three replicates because the bet rests on the planner's and the critic's judgment.

**The measure that would show it.** Held-out invariants out of 88 ([`held-out/wrap-invariants.test.mjs`](held-out/wrap-invariants.test.mjs): an export found by name under `src/`, lines fit the width, words kept in order, no empty or space-edged line, a fitting text unchanged, and greedy fill — named apart in every case title, since a balanced wrap is a defensible design choice); the judge's score against the task; cost.

**What counts as the graph losing.** Arm B's held-out passes equal or exceed arm A's in at least two of three replicates at lower cost. The graph earns its cost only if A's held-out range lies above B's, or the judge ranks every A above every B with reasons that name the acceptance.

**The gate, and the one exception in this study.** `spec-gate` sits before the build loop. Under the handoff's rule (no scripted gate answers) and the protocol's restatement (a gate becomes "stop and report"), every arm would produce `ACCEPTANCE.md` and stop, and nothing below the gate could be compared. On 2026-09-21 the owner decided, in the implementer's session, that this project gives **exactly one scripted `approve` per run, in every arm, only after the run has halted at the gate**: arm A is resumed by run id as `scripts/prove-pattern.sh` resumed the proving run (`expect.json` › `resume`); arms B and C have their session resumed with the same answer once the tree shows the planning step done and nothing built (`ACCEPTANCE.md` present, `src/` and `tests/` untouched); later iterations of C are told that the answer was given. A run that never halts at the gate — that builds straight through, or stops elsewhere — gets no answer and is recorded as it ended. Every resume is its own ledger line, its prompt is kept under `prompts/`, and this paragraph is the label.

**Arms.** A: the package as `scripts/prove-pattern.sh spec-then-loop` runs it (planner on `fable`, builder and critic on `opus`, loop `build`: bar-passed, at most 4 rounds, 10 dispatches). B: [`prompt-B.md`](prompt-B.md), derived from that package by rule (§3), one session plus the resume above. C: the same prompt in up to N = 4 fresh sessions ([`loop-C.sh`](loop-C.sh)), the first resumed as above. Lead `claude-opus-5`, effort `high`, in every arm; the proving allowlist plus `Read` on the held-out folder; `--strict-mcp-config`; one ceiling per invocation from [`../ledger.json`](../ledger.json).

**Held-out.** The proving task had no held-out suite; this one checks only invariants, because the planner's `ACCEPTANCE.md` is the specification and differs per run. It is the scorer's only; no arm is told where it is. The digest records whether anything touched the folder.

**Replicates.** Three per arm, alternating A1 B1 C1 A2 B2 C2 A3 B3 C3. Three is a range, not a mean; the tables say so.

## Runs

_(filled after the runs by `scripts/lib/compare-summary.mjs spec-then-loop`)_

## The judge's reasons

_(after the judge call)_

## Did the graph earn its cost

_(the one required line, with the range that says so)_

## What this comparison cannot show

That the template beats a human, a named product (spec §15) or another model; with n = 3, a small difference at all; anything about a task whose specification is not the builder's own to write — and, because of the scripted approve, nothing about what a human would have said at the gate.
