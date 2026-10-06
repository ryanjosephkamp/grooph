# heterogeneous-critic · the graph against a prompt, and against the task alone

A paired comparison of the `heterogeneous-critic` template in study two (protocol [`docs/comparisons.md`](../../../docs/comparisons.md), version 2; handoff 0019). Four arms on one task, two replicates each, scored by the same script, judged blind. Results will follow the pre-registration below; nothing above the "Runs" heading changes after the first run.

## Pre-registration

Written and committed before any run of this project (protocol §7; the same text is in [`expect.json`](expect.json) for the runner, the scorer and the summary).

**Task.** [`task/`](task/): `printkit`, small helpers behind a print dialog. Add `parseRanges(text, pageCount)`, which reads what a person typed into the page box (`"1-3,5"`, `"7"`) and returns the pages to print. The task text ([`slots.json`](slots.json)) fixes the parts, the separators and what throws; a checklist ([`docs/REVIEW-CHECKLIST.md`](task/docs/REVIEW-CHECKLIST.md)) repeats that as six items. Neither says anything about the seven points below.

**What the task leaves open, and how the held-out suite settles it.** [`held-out/parse-ranges-cases.test.mjs`](held-out/parse-ranges-cases.test.mjs) has 70 cases: 29 that the task and the checklist state, 4 number forms any careful parser refuses (an exponent, a sign), and 37 in seven groups, one for each point the text leaves open. A group holds the cases its point decides, the refusals that follow from the suite's side of it included.

| Open point | The suite's side | A reading just as fair |
|---|---|---|
| order | pages come back in the order typed | an ascending list |
| repeats | a page typed twice comes back twice | each page once |
| backward | `5-3` is pages 5, 4, 3 | a range that runs backward is refused |
| spaces | spaces and tabs around a number, a comma or the hyphen are ignored; a space inside a number is not (`1 2` is not page 12) | only around a comma |
| open end | `8-` runs to the last page and `-3` from the first; a hyphen with neither end is refused | a range needs both ends |
| empty | an empty box means every page; an empty part between commas is still refused | an empty box is refused |
| zeros | `007` is page 7 | a number with a leading zero is refused |

**The design bet.** The template's mechanism is a critic on another tier, in a fresh context, that runs a held-out suite the builder never sees and returns each failing case in `REVIEW.md`. A first pass is expected to fail the suite; the bet is that the critic's failures send the builder back (`e-critic-fail`), the next round closes them, and the run ends with more held-out passes than a session with no reviewer (arm D). Against the same design said in prose (arms B and C) the bet is narrower: that the package reaches the suite's passes at least as surely, at a cost the difference justifies.

**The measure that would show it.** Held-out passes out of 68, by group; whether a loop turned, and the held-out score before and after the turn, from each run's record; who read the suite (transcript digest); cost and wall time; the blind judgment.

**The expected chance of a round-0 pass: 0.03.** A builder passes at round 0 only by taking the suite's side on all seven points without seeing it. Each side is defensible and so is its opposite. Rough odds of 0.7 (order), 0.7 (repeats), 0.3 (backward), 0.5 (spaces), 0.25 (open end), 0.2 (empty) and 0.7 (zeros), which are not independent (a builder who pictures a real print dialog gets several at once), give about 0.03; nearly all of it rides on the backward range, the open end and the empty box. It is an estimate, made without running a model. What is measured without one: a plain first pass, the shortest honest reading of the task and the checklist ([`reference/first-pass/`](reference/first-pass/src/parse-ranges.mjs)), passes 56 of 70. It fails 14 cases in four groups (backward, spaces, open end, empty) and passes the other three, because the shortest implementation happens to keep the typed order, keep repeats and read a leading zero as a number. A solution ([`reference/solution/`](reference/solution/src/parse-ranges.mjs)) passes 70 of 70, and the task as it ships passes none (`node --test scripts/lib/compare-projects.test.mjs`). Both files are one author's code, kept beside the task and never copied into a run. An independent read of the first version of this suite found four cases filed as careful that turned on an open point, one that did not test what it said, a row of the table that held two choices, and a first pass that took the side against the suite on every point; all are corrected above, and the slice's handback says what was found.

**What counts as the graph losing.** Arm B matches or beats arm A on held-out passes in both replicates at lower cost. The graph earns its cost only if A's held-out range lies above B's, or A reaches B's passes at lower cost in both replicates. The design itself (A, B and C alike) loses to no design when D's held-out range is not below theirs.

**Which brake is expected to fire: none.** The loop's stops are the bar, a cap of 4 rounds and a budget of 10 dispatches. The expected course in arm A is a fail at round 0 and a pass at round 1, or at round 2 when the fix for one point breaks a refusal that belongs to it (a lone hyphen, a stray comma), then the halt at `merge-gate`, at 4 or 6 dispatches. The cap or the budget fires only if the builder cannot close failing cases that the critic quotes to it in three more rounds; the estimate is 0.03. So this project can show a loop turning. It is not expected to show a cap or a budget bounding anything, and if neither fires the write-up says the project did not test that. The halt at the merge gate is the one stop expected in every A run; whether B and C, told so in one sentence, stop at the same point is recorded.

**What arm C is expected to do: one iteration.** The B prompt carries the whole loop, so a session that reaches the gate ends `done: yes` and the loop of sessions ends there, as all nine C runs of study one did. The estimate is 0.85. C is the protocol's arm and runs as written; a second iteration happens only when the first is cut off or says it is not done.

**Arms.** A: the package as `scripts/prove-pattern.sh` runs one (builder on tier `strong`, critic on tier `frontier`; loop `review`: bar-passed, at most 4 rounds, 10 dispatches; then a halt at `merge-gate`, which is the run's ending: no answer is scripted). B: [`prompt-B.md`](prompt-B.md), derived from that package by rule (§3), one session, the gate restated as "stop and report when you reach this point; do not proceed past it". C: the same prompt in up to N = 4 fresh sessions ([`loop-C.sh`](loop-C.sh)). D: [`prompt-D.md`](prompt-D.md), written from the task folder alone: the task text, the names of `README.md` and `docs/REVIEW-CHECKLIST.md`, and `npm test`; no roles, routing, loop or briefs.

**Models.** The lead is `claude-opus-5-5` at effort `high` in every arm, and the blind judge is `claude-opus-5-5` with no tools. Sub-agents run on the model their tier means, and what a tier means is a named field of this pre-registration: `tier_map` in [`expect.json`](expect.json), handed to `grooph export` as `GROOPH_MODELS` for every package and so carried into the derived prompt. **The tier map, named by the owner on 2026-10-04 before any run: `frontier` is `claude-opus-5-5`, `strong` is `claude-sonnet-5-5`, `fast` is `claude-sonnet-5-5`.** No node of this project is on `fast`. So the builder runs on Sonnet 5.5 and the critic on Opus 5.5: the template's point, a critic on another tier than the builder it checks, stands. Arm D's one session is Opus 5.5, a stronger builder than arm A's, which counts against the graph on what a builder can guess and for it on nothing. `prompt-B.md` is derived under this map; the runner refuses a run under any other. No call uses Fable. Study one ran its leads on `claude-opus-5` with a `claude-fable-5-1` judge and the target's own tiers, so the two studies are not compared run for run.

**Held-out.** In A, B and C the suite is named once, in the `checklist` slot, exactly where the template hands its checklist to the critic: as the critic's to run and quote, and not the builder's to read. In A the critic is a separate sub-agent; in B and C whoever plays the critic is the same session or a sub-agent it chooses to dispatch. In D the suite is named to nobody: no task file, no line of the prompt and no permission rule points at it, and no copy of it is anywhere near the run (the reviewer's copy that sits beside the scratch in the other arms is not made, the scratch sits alone in a folder of its own, and its repository's one commit never held the package). In every arm the scorer runs the suite from this repository, not from a copy a run could have changed, and the record lists whatever a session reached for outside its own project. The transcript digest records who touched it. So D's held-out score is how much of what the text leaves open a session guesses the suite's way: it measures the design against no design, not the package against its prose.

**Replicates.** Two per arm, in the order A1 B1 C1 D1 A2 B2 C2 D2. Two is a range, not a mean; the tables say so. A run cut off at the $9.00 ceiling of an invocation is scored and judged, not retried.

**What this comparison cannot show.** That the template beats a human, a named product (spec §15) or another model; with n = 2, a small difference at all; anything about a task larger than one function. Whether a critic on another tier sees more than one on the builder's tier is not what this project tests: the held-out cases would be found by any critic that runs them.

## Runs

Claude Code 2.1.289 · lead `claude-opus-5-5`, effort `high`, in every arm · builder on `claude-sonnet-5-5` and critic on `claude-opus-5-5` in every run of A, B and C; arm D is its one session · 2026-10-04 · [`../ledger.json`](../ledger.json) invocations 50–58. Rows generated by `node scripts/lib/compare-summary.mjs heterogeneous-critic`; the judge's letters are mapped back through [`judge/mapping.json`](judge/mapping.json).

| Run | Held-out | Tests | Scope | Ending | Cost | Wall | Turns | Refusals | Sub-agents | Judge |
|---|---|---|---|---|---|---|---|---|---|---|
| **A-1** (round 1, back edge) | 70/70 | pass | clean | clean (halt at merge-gate) | $1.60 | 5m05s | 41 | 1 | 4 | 3/5, rank 7 |
| **A-2** (round 1, back edge) | 70/70 | pass | clean | clean (halt at merge-gate) | $1.29 | 4m10s | 30 | 0 | 4 | 3/5, rank 8 |
| **B-1** | 70/70 | pass | clean | clean (the session ended by itself) | $1.05 | 3m35s | 11 | 0 | 4 | 3/5, rank 5 |
| **B-2** | 70/70 | pass | clean | clean (the session ended by itself) | $1.03 | 4m10s | 12 | 1 | 4 | 3/5, rank 6 |
| **C-1** (1 iteration) | 70/70 | pass | clean | clean (iteration 1 of 4 said done and the tests passed) | $1.03 | 3m44s | 13 | 2 | 4 | 3/5, rank 4 |
| **C-2** (1 iteration) | 70/70 | pass | clean | clean (iteration 1 of 4 said done and the tests passed) | $1.09 | 4m01s | 13 | 2 | 4 | 3/5, rank 3 |
| **D-1** | 52/70 | pass | clean | clean (the session ended by itself) | $0.26 | 1m02s | 11 | 0 | 0 | 5/5, rank 1 |
| **D-2** | 52/70 | pass | clean | clean (the session ended by itself) | $0.26 | 0m52s | 13 | 1 | 0 | 4/5, rank 2 |

A: held-out 70/70, cost $1.29–$1.60 (n = 2) · B: held-out 70/70, cost $1.03–$1.05 (n = 2) · C: held-out 70/70, cost $1.03–$1.09 (n = 2) · D: held-out 52/70, cost $0.26 (n = 2)

**Models.** The harness reported `claude-opus-5-5` and `claude-sonnet-5-5` and nothing else, in every run and for the judge. The template's point held in all six runs with a reviewer: an Opus 5.5 critic over a Sonnet 5.5 builder. In A each agent ran on the model its agent file names. In B and C each lead dispatched generic sub-agents and asked for `sonnet` for the builder and `opus` for the critic, as the prose's briefs name them; none asked for another model.

**Who read the held-out suite.** In A the template's critic, and only the critic, in both runs (both pass the whole proving check). In every B and C run only the critic sub-agents touched the suite. In D nobody did. No session of any run reached for anything outside its own project (`process.reached_outside_project` is empty in all eight records). The tool's name stands in none of the transcripts of B, C and D, and its command was not on their PATH.

## Did a loop turn, and did the turn change the result

**Yes, in all six runs of A, B and C, and the turn took each from 52 to 70 of 70.** Each reviewer's own runs of the suite, read from the harness's transcripts ([`derived/`](derived/), made by `scripts/lib/compare-seen.mjs` after the runs). The harness keeps about ten thousand characters of a command's output, and a run of 70 cases with failures prints more, so a critic's first run of the suite is often cut before node's summary; where a critic ran it again with the dot reporter the count is whole. A's round-0 reports state it in words too ([`A-1/runs/20261004-214144/REVIEW-round-0.md`](A-1/runs/20261004-214144/REVIEW-round-0.md): "70 tests, 52 pass, 18 fail").

| Run | The suite at round 0, as the critic saw it | After the turn |
|---|---|---|
| A-1, A-2 | 52/70 | 70/70 |
| B-1 | 52/70, as two runs of 35 cases each (23 and 29 pass) after a first run whose output was cut | 70/70 |
| B-2 | 52/70 | 70/70 |
| C-1, C-2 | 52/70 | 70/70 |
| D-1, D-2 | nobody ran it; the scorer found 52/70 | |

**Every first pass landed in the same place, with a reviewer to come or without one.** The 18 cases that failed at round 0 in A are the 18 that D failed at the end: order (3), repeats (3), backward (4), open end (5), empty (3). Each builder, Sonnet 5.5 in A, B and C and Opus 5.5 in D, returned an ascending list without repeats, refused a backward range, a range with one end and an empty box, and took the suite's side on spaces and leading zeros. Then each critic quoted the failing cases, each builder changed its parser, and each second review passed: one traversal of `e-critic-fail` in A, `bar-passed` at round 1, 4 of 10 dispatches, the halt at `merge-gate`. In B the one session did the same four dispatches and stopped at the gate; in C the first session did the same and said `done: yes`, so the loop of sessions ended after one iteration, as pre-registered. No run needed a second turn: the refusals that belong to an open point (a lone hyphen, a stray comma) survived each round-1 fix.

**What the pre-registration got wrong.** The plain first pass kept beside the task keeps the typed order and repeats, on the reasoning that the shortest code pushes pages as it reads them, and passes 56 of 70. No model's first pass did that: all eight returned a sorted list without repeats and passed 52. The estimated odds of 0.7 for each of those two points were too high, and they were one author's guess, as the pre-registration says. The estimate that a round-0 pass was unlikely (0.03) was borne out: none of eight first passes passed.

**No cap and no budget fired**, as pre-registered: every run of A ended at 4 of 10 dispatches, round 1 of 4.

## The judge's reasons

One call, `claude-opus-5-5`, no tools, eight candidates under random letters ([`judge/transcript.md`](judge/transcript.md), [`judge/verdict.json`](judge/verdict.json), $0.36). It ranked the two D runs first and second (5/5 and 4/5) and gave each of the six others 3/5, for one reason: "Six candidates add the same untasked behaviour: open-ended ranges, empty text meaning every page, and backward ranges counting down. Each accepts input that the task and checklist item 3 say should throw a RangeError." That is the held-out suite's own content seen from the other side. The judge is given what the builder saw, not the suite, so it marks down as invented exactly what the suite requires and the critics asked for. As in `review-gate-2`, on a task built with hidden resolutions the judgment and the suite measure opposite things, and the judgment cannot be read as a ranking of quality.

1. **D-1** (letter N, 5/5): It accepts exactly a page (`PAGE`) or a first-last range (`RANGE`) and bounds-checks both ends in `page()`. A backward range throws a RangeError, and the final test loop covers "", "1,,3", "8-", "-3", "3-1", "+2" and "1.5". Every checklist example is tested, and the README gives an example, the values that throw and the ascending de-duplicated result.
2. **D-2** (letter M, 4/5): It is strict and matches the task, with tests for both examples, page 0, past-last, words and malformed parts, including "" and "3-1". The bounds check `first < 1 || last > pageCount` misses "11-10", which is only caught afterwards as a backward range, so correctness depends on the order of the checks. The JSDoc omits the throws and the text-type test leaves out arrays.
3. **C-2** (letter G, 3/5): It has the strongest tests in its group ("1e1", "0x1", "1--3", "1, ,2", a type check before parsing), `@throws` documentation and a `Number.isSafeInteger` check. The behaviour still goes beyond the spec: "8-", "-3" and "" are accepted and "5-3" counts down, where the task and checklist call for a RangeError.
4. **C-1** (letter U, 3/5): The `PART` regex and bounds check are correct, and the tests include "00", "1 0" and a 20-digit page. It has the same extensions as the others: open ends, blank text meaning every page, and backward ranges counting down. They are documented, but they replace the RangeError the task implies.
5. **B-1** (letter J, 3/5): The code is correct for what it chooses to do and well tested. It covers both examples, every TypeError value, page 0, past-last, words, "1-2-3" and huge numbers, and the README documents everything. However it accepts "8-", "-3" and "" (as every page) and counts "5-3" down, which the task did not ask for. Those are parts that are neither a page nor a first-last range, so they should throw a RangeError.
6. **B-2** (letter T, 3/5): Its single bounds check uses `Math.min`/`Math.max` and is sound, and the tests cover out-of-range open and backward parts as well as empty parts. It shares the invented behaviour: open-ended ranges, empty text meaning every page, and descending ranges, all documented and tested instead of throwing a RangeError.
7. **A-1** (letter H, 3/5): Its split-based parsing is correct and the tests pass by trace, but it explicitly accepts leading zeros ("02-03") on top of the open-end, empty-means-every-page and backward-range extensions. Its tests are packed into one loop, and the README merges the throws text into the behaviour paragraph.
8. **A-2** (letter Z, 3/5): The one-regex parse with explicit rejection of "" and "-" is correct, and the tests cover the examples, the types and the malformed parts. Its tests are the thinnest of the extended group. It also accepts "-3", "8-" and blank text (as every page), which the spec says should be rejected.

## Did the graph earn its cost

**No: the pre-registered losing condition was met.** Arm B matched arm A on held-out passes in both replicates (70 of 70) at lower cost: $1.05 and $1.03 against $1.60 and $1.29. C did the same at $1.03 and $1.09. The package's runs took 41 and 30 harness turns against 11 to 13 for the prompt arms; what that bought is the run record (the notes, the round-0 report and the per-round diffs kept in the run folder, the halt note at the gate), not a better `parseRanges`.

**The design, in all three of its forms, ended above no design: 70 of 70 against 52 of 70 in both replicates**, a range wholly above the other, for about four times D's cost in B and C ($1.03 to $1.09 against $0.26) and five to six times in A. The 18 cases are five open points every first pass resolved against the suite. That is the reviewer's held-out evidence reaching the builder, which is what the design is for; it is the same in the package and in the prose.

> *Note, 2026-10-06:* "ended above no design" means scored higher on the author's held-out suite or reference checks. The blind judges of the two code projects, given only the visible task, ranked the task-alone outputs higher, and the comparison did not separate the effect of the structure from the extra evidence a reviewer held (audit 0001, round two, finding F3; the owner's answer on the review desk, q60). The write-up above is left as written.

## What this comparison cannot show

Beyond what the pre-registration says: the 18 cases between D and the rest are cases no builder could know without the suite, so the difference shows that a reviewer who holds such cases moves the builder to them in one round, not that the reviewed code is better by any measure the builder was given; the blind judge, who was given only that, preferred D's. Whether a critic on another tier sees more than one on the builder's tier is not tested here: the critic's finding was the suite's output, which any critic that runs it reports, and `review-gate-2`, whose critic is on the builder's tier, turned its loop the same way.
