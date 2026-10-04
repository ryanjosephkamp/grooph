# heterogeneous-critic · the graph against a prompt, and against the task alone

A paired comparison of the `heterogeneous-critic` template in study two (protocol [`docs/comparisons.md`](../../../docs/comparisons.md), version 2; handoff 0019). Four arms on one task, two replicates each, scored by the same script, judged blind. Results will follow the pre-registration below; nothing above the "Runs" heading changes after the first run.

## Pre-registration

Written and committed before any run of this project (protocol §7; the same text is in [`expect.json`](expect.json) for the runner, the scorer and the summary).

**Task.** [`task/`](task/): `printkit`, small helpers behind a print dialog. Add `parseRanges(text, pageCount)`, which reads what a person typed into the page box (`"1-3,5"`, `"7"`) and returns the pages to print. The task text ([`slots.json`](slots.json)) fixes the parts, the separators and what throws; a checklist ([`docs/REVIEW-CHECKLIST.md`](task/docs/REVIEW-CHECKLIST.md)) repeats that as six items. Neither says anything about the six points below.

**What the task leaves open, and how the held-out suite settles it.** [`held-out/parse-ranges-cases.test.mjs`](held-out/parse-ranges-cases.test.mjs) has 68 cases: 29 that the task and the checklist state, 9 that any careful parser gets right (an exponent, a sign, an empty part), and 30 in six groups, one for each point the text leaves open.

| Open point | The suite's side | A reading just as fair |
|---|---|---|
| order | pages come back in the order typed, and a page typed twice comes back twice | an ascending list without repeats |
| backward | `5-3` is pages 5, 4, 3 | a range that runs backward is refused |
| spaces | spaces and tabs around a number, a comma or the hyphen are ignored | only around a comma |
| open end | `8-` runs to the last page, `-3` from the first | a range needs both ends |
| empty | an empty box means every page | an empty box is refused |
| zeros | `007` is page 7 | a number with a leading zero is refused |

**The design bet.** The template's mechanism is a critic on another tier, in a fresh context, that runs a held-out suite the builder never sees and returns each failing case in `REVIEW.md`. A first pass is expected to fail the suite; the bet is that the critic's failures send the builder back (`e-critic-fail`), the next round closes them, and the run ends with more held-out passes than a session with no reviewer (arm D). Against the same design said in prose (arms B and C) the bet is narrower: that the package reaches the suite's passes at least as surely, at a cost the difference justifies.

**The measure that would show it.** Held-out passes out of 68, by group; whether a loop turned, and the held-out score before and after the turn, from each run's record; who read the suite (transcript digest); cost and wall time; the blind judgment.

**The expected chance of a round-0 pass: 0.03.** A builder passes at round 0 only by taking the suite's side on all six points without seeing it. Each side is defensible and so is its opposite; rough odds of 0.4, 0.3, 0.6, 0.3, 0.2 and 0.6, which are not independent (a builder who pictures a real print dialog gets several at once), give about 0.03. It is an estimate, made without running a model. What is measured without one: a cautious first pass written from the task and the checklist alone ([`reference/first-pass/`](reference/first-pass/src/parse-ranges.mjs)) passes 45 of 68, failing 23 of the 30 open cases and nothing else, and a solution ([`reference/solution/`](reference/solution/src/parse-ranges.mjs)) passes 68 of 68 (`node --test scripts/lib/compare-projects.test.mjs`). Both are one author's code, kept beside the task and never copied into a run.

**What counts as the graph losing.** Arm B matches or beats arm A on held-out passes in both replicates at lower cost. The graph earns its cost only if A's held-out range lies above B's, or A reaches B's passes at lower cost in both replicates. The design itself (A, B and C alike) loses to no design when D's held-out range is not below theirs.

**Arms.** A: the package as `scripts/prove-pattern.sh` runs one (builder on tier `strong`, critic on tier `frontier`; loop `review`: bar-passed, at most 4 rounds, 10 dispatches; then a halt at `merge-gate`, which is the run's ending: no answer is scripted). B: [`prompt-B.md`](prompt-B.md), derived from that package by rule (§3), one session, the gate restated as "stop and report when you reach this point; do not proceed past it". C: the same prompt in up to N = 4 fresh sessions ([`loop-C.sh`](loop-C.sh)). D: [`prompt-D.md`](prompt-D.md), written from the task folder alone: the task text, the names of `README.md` and `docs/REVIEW-CHECKLIST.md`, and `npm test`; no roles, routing, loop or briefs.

**Models.** The lead is `claude-opus-5-5` at effort `high` in every arm, and the blind judge is `claude-opus-5-5` with no tools. Sub-agents run on the model their tier means, and what a tier means is a named field of this pre-registration: `tier_map` in [`expect.json`](expect.json), handed to `grooph export` as `GROOPH_MODELS` for every package and so carried into the derived prompt. **The tier map is not named yet**; it is filled in, and `prompt-B.md` derived again under it, before the first run, and the runner starts no paid run while it is empty. No call uses Fable. Study one ran its leads on `claude-opus-5` with a `claude-fable-5-1` judge and the target's own tiers, so the two studies are not compared run for run.

**Held-out.** In A, B and C the suite is named once, in the `checklist` slot, exactly where the template hands its checklist to the critic: as the critic's to run and quote, and not the builder's to read. In A the critic is a separate sub-agent; in B and C whoever plays the critic is the same session or a sub-agent it chooses to dispatch. In D the suite is named to nobody: no task file, no line of the prompt and no permission rule points at it, and the folder is moved away from the scratch project for the length of the run. The transcript digest records who touched it. So D's held-out score is how much of what the text leaves open a session guesses the suite's way: it measures the design against no design, not the package against its prose.

**Replicates.** Two per arm, in the order A1 B1 C1 D1 A2 B2 C2 D2. Two is a range, not a mean; the tables say so. A run cut off at the $9.00 ceiling of an invocation is scored and judged, not retried.

**What this comparison cannot show.** That the template beats a human, a named product (spec §15) or another model; with n = 2, a small difference at all; anything about a task larger than one function. Whether a critic on another tier sees more than one on the builder's tier is not what this project tests: the held-out cases would be found by any critic that runs them.
