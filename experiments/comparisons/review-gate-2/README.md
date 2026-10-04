# review-gate · study two · the graph against a prompt, and against the task alone

A paired comparison of the `review-gate` template in study two (protocol [`docs/comparisons.md`](../../../docs/comparisons.md), version 2; handoff 0019), on a harder task than study one's. Study one's project is [`../review-gate/`](../review-gate/README.md): another task, three arms, other models. The two are not one table. Four arms here, two replicates each, scored by the same script, judged blind. Results will follow the pre-registration below; nothing above the "Runs" heading changes after the first run.

## Pre-registration

Written and committed before any run of this project (protocol §7; the same text is in [`expect.json`](expect.json) for the runner, the scorer and the summary).

**Task.** [`task/`](task/): `settingskit`, settings for a command-line tool as plain data. Add `layer(base, over)`, which lays one layer of settings on another: plain objects under the same key are layered key by key, and otherwise a value given in `over` replaces the one in `base`. The task text ([`slots.json`](slots.json)) says that much and that both arguments must be plain objects.

**Two items the task text does not state.** The checklist ([`docs/REVIEW-CHECKLIST.md`](task/docs/REVIEW-CHECKLIST.md)) holds eight items, and two of them are nowhere in the task text: item 4, the result shares nothing with either layer (no object or array reachable from it is one reachable from an argument, at any depth and inside arrays); and item 5, keys named `__proto__`, `constructor` or `prototype` are never copied, and every plain object in the result is an ordinary one. The checklist is in the task folder, so every arm can read it; whether a builder builds to it is part of what is measured.

**What both leave open, and how the held-out suite settles it.** [`held-out/layer-cases.test.mjs`](held-out/layer-cases.test.mjs) has 55 cases: 21 that the task and checklist items 1 to 3 state, 15 for the two checklist-only items (9 for item 4, 6 for item 5), and 19 in four groups, one for each point neither settles. Whether an object in a result is an ordinary one is counted only where it is the point: the other groups compare content.

| Open point | The suite's side | A reading just as fair |
|---|---|---|
| undefined | a key whose value in `over` is `undefined` counts as not given: `base`'s value stays, and a key only `over` has does not appear | `undefined` is a value given, and replaces |
| null prototype | an object with no prototype is a plain object, and comes back ordinary | a plain object is one whose prototype is `Object.prototype` |
| dates | a `Date` inside a layer is data: it is copied, as a new `Date` at the same time | a `Date` is refused like any value that is not a plain object or an array |
| not plain data | a function, a Map, a Set or an instance of a class is refused with a `TypeError`, wherever it sits | another error, or (against item 4) the value handed over as it is |

Two of these are narrower than "open". The task says a value *given* in `over` replaces; whether `undefined` is a value given is the open part. And checklist item 4 already rules out handing over a value that cannot be copied; what is open is what to do instead, and with which error.

**The design bet.** The template's mechanism is a critic in a fresh context that judges the change against a written checklist, item by item, and runs a held-out suite the builder never sees. The bet is that a first pass misses at least one of the six (two checklist-only items, four open points), the critic's failures send the builder back (`e-critic-fail`), and the run ends with more held-out passes than a session with no reviewer (arm D). Against the same design said in prose (arms B and C) the bet is narrower: that the package reaches the suite's passes at least as surely, at a cost the difference justifies.

**The measure that would show it.** Held-out passes out of 55, by group; whether a loop turned, and the held-out score before and after the turn, from each run's record; who read the suite (transcript digest); cost and wall time; the blind judgment.

**The expected chance of a round-0 pass: 0.03.** A builder passes at round 0 only by taking the suite's side on all four open points without seeing it and by meeting the two checklist-only items for every kind of value. Rough odds of 0.4 (undefined), 0.5 (null prototype), 0.4 (dates) and 0.3 (not plain data), which are not independent, give about 0.03. It is an estimate, made without running a model. What is measured without one: a plain first pass, the shortest honest reading of the task and the checklist ([`reference/first-pass/`](reference/first-pass/src/layer.mjs)), passes 36 of 55. It copies plain objects and arrays at every depth and skips the unsafe keys, so it meets items 4 and 5 for settings as they come out of JSON; it fails all 19 cases of the four open groups, which hold exactly the values it did not consider (an `undefined`, an object with no prototype, a `Date`, a function). A solution ([`reference/solution/`](reference/solution/src/layer.mjs)) passes 55 of 55, and the task as it ships passes none (`node --test scripts/lib/compare-projects.test.mjs`). Both files are one author's code, kept beside the task and never copied into a run. An independent read of the first version of this suite found that it counted a `Date` as stated when the checklist's own letter ruled a `Date` out, that the task text spoke against the suite on `undefined` rather than leaving it open, that one failure could fail five unrelated cases, and that the first pass leaned on the suite; the checklist, the task text, the suite and the first pass are corrected above, and the slice's handback says what was found.

**What counts as the graph losing.** Arm B matches or beats arm A on held-out passes in both replicates at lower cost. The graph earns its cost only if A's held-out range lies above B's, or A reaches B's passes at lower cost in both replicates. The design itself (A, B and C alike) loses to no design when D's held-out range is not below theirs.

**Which brake is expected to fire: none.** The loop's stops are the bar, a cap of 4 rounds and a budget of 10 dispatches. The expected course in arm A is a fail at round 0, a pass at round 1 and the halt at `merge-gate`, at 4 dispatches. The cap or the budget fires only if the builder cannot close failing cases that the critic quotes to it in three more rounds; the estimate is 0.03. So this project can show a loop turning. It is not expected to show a cap or a budget bounding anything, and if neither fires the write-up says the project did not test that. The halt at the merge gate is the one stop expected in every A run; whether B and C, told so in one sentence, stop at the same point is recorded.

**What arm C is expected to do: one iteration.** The B prompt carries the whole loop, so a session that reaches the gate ends `done: yes` and the loop of sessions ends there, as all nine C runs of study one did. The estimate is 0.85. C is the protocol's arm and runs as written; a second iteration happens only when the first is cut off or says it is not done.

**Arms.** A: the package as `scripts/prove-pattern.sh` runs one (builder and critic both on tier `strong`; loop `review`: bar-passed, at most 4 rounds, 10 dispatches; then a halt at `merge-gate`, which is the run's ending: no answer is scripted). B: [`prompt-B.md`](prompt-B.md), derived from that package by rule (§3), one session, the gate restated as "stop and report when you reach this point; do not proceed past it". C: the same prompt in up to N = 4 fresh sessions ([`loop-C.sh`](loop-C.sh)). D: [`prompt-D.md`](prompt-D.md), written from the task folder alone: the task text, the names of `README.md`, `docs/REVIEW-CHECKLIST.md` and `CHANGELOG.md`, and `npm test`; no roles, routing, loop or briefs.

**Models.** The lead is `claude-opus-5-5` at effort `high` in every arm, and the blind judge is `claude-opus-5-5` with no tools. Sub-agents run on the model their tier means, and what a tier means is a named field of this pre-registration: `tier_map` in [`expect.json`](expect.json), handed to `grooph export` as `GROOPH_MODELS` for every package and so carried into the derived prompt. **The tier map, named by the owner on 2026-10-04 before any run: `frontier` is `claude-opus-5-5`, `strong` is `claude-sonnet-5-5`, `fast` is `claude-sonnet-5-5`.** No node of this project is on `fast`. So the builder and the critic both run on Sonnet 5.5, as the template has them on one tier. Arm D's one session is Opus 5.5, a stronger builder than arm A's, which counts against the graph on what a builder can guess and for it on nothing. `prompt-B.md` is derived under this map; the runner refuses a run under any other. No call uses Fable. Study one ran its leads on `claude-opus-5` with a `claude-fable-5-1` judge and the target's own tiers, so the two studies are not compared run for run.

**Held-out.** In A, B and C the suite is named once, in the `checklist` slot, exactly where the template hands its checklist to the critic: as the critic's to run and quote, and not the builder's to read. In A the critic is a separate sub-agent; in B and C whoever plays the critic is the same session or a sub-agent it chooses to dispatch. In D the suite is named to nobody: no task file, no line of the prompt and no permission rule points at it, and no copy of it is anywhere near the run (the reviewer's copy that sits beside the scratch in the other arms is not made, the scratch sits alone in a folder of its own, and its repository's one commit never held the package). In every arm the scorer runs the suite from this repository, not from a copy a run could have changed, and the record lists whatever a session reached for outside its own project. The transcript digest records who touched it. So D's score on the 19 open cases is how much of what the text leaves open a session guesses the suite's way, and its score on the 15 checklist-only cases is whether a session with no reviewer builds to a checklist it was pointed at.

**Replicates.** Two per arm, in the order A1 B1 C1 D1 A2 B2 C2 D2. Two is a range, not a mean; the tables say so. A run cut off at the $9.00 ceiling of an invocation is scored and judged, not retried.

**What this comparison cannot show.** That the template beats a human, a named product (spec §15) or another model; with n = 2, a small difference at all; anything about a task larger than one function and an eight-item checklist.

## Runs

Claude Code 2.1.289 · lead `claude-opus-5-5`, effort `high`, in every arm · builder and critic on `claude-sonnet-5-5` in every run of A, B and C; arm D is its one session · 2026-10-04 · [`../ledger.json`](../ledger.json) invocations 41–49. Rows generated by `node scripts/lib/compare-summary.mjs review-gate-2`; the judge's letters are mapped back through [`judge/mapping.json`](judge/mapping.json).

| Run | Held-out | Tests | Scope | Ending | Cost | Wall | Turns | Refusals | Sub-agents | Judge |
|---|---|---|---|---|---|---|---|---|---|---|
| **A-1** (round 1, back edge) | 55/55 | pass | clean | clean (halt at merge-gate) | $1.18 | 4m26s | 36 | 2 | 4 | 4/5, rank 4 |
| **A-2** (round 1, back edge) | 55/55 | pass | clean | clean (halt at merge-gate) | $1.23 | 4m12s | 41 | 1 | 4 | 4/5, rank 5 |
| **B-1** | 55/55 | pass | clean | clean (the session ended by itself) | $0.67 | 2m49s | 7 | 0 | 4 | 4/5, rank 6 |
| **B-2** | 55/55 | pass | clean | clean (the session ended by itself) | $0.69 | 3m09s | 5 | 1 | 4 | 3/5, rank 8 |
| **C-1** (1 iteration) | 55/55 | pass | clean | clean (iteration 1 of 4 said done and the tests passed) | $0.64 | 3m11s | 5 | 1 | 4 | 4/5, rank 3 |
| **C-2** (1 iteration) | 55/55 | pass | clean | clean (iteration 1 of 4 said done and the tests passed) | $0.80 | 3m27s | 10 | 1 | 4 | 3/5, rank 7 |
| **D-1** | 51/55 | pass | clean | clean (the session ended by itself) | $0.33 | 1m14s | 10 | 0 | 0 | 5/5, rank 2 |
| **D-2** | 51/55 | pass | clean | clean (the session ended by itself) | $0.35 | 1m32s | 10 | 0 | 0 | 5/5, rank 1 |

A: held-out 55/55, cost $1.18–$1.23 (n = 2) · B: held-out 55/55, cost $0.67–$0.69 (n = 2) · C: held-out 55/55, cost $0.64–$0.80 (n = 2) · D: held-out 51/55, cost $0.33–$0.35 (n = 2)

**Models.** The harness reported `claude-opus-5-5` and `claude-sonnet-5-5` and nothing else, in every run and for the judge. In A the two agents ran on the model their agent file names; in B and C each lead dispatched four generic sub-agents and asked for `sonnet`, which the run's environment pins to `claude-sonnet-5-5`.

**Who read the held-out suite.** In A the template's critic, and only the critic, in both runs (the proving check's assertion passes: `heldOut.readers` critic, `notReaders` builder; both A runs pass the whole check). In every B and C run the lead dispatched a builder and a critic from the prose, and only the critic sub-agents touched the suite. In D nobody did: no copy of it was near the run. No session of any run reached for anything outside its own project (`process.reached_outside_project` is empty in all eight records). The tool's name stands in none of the transcripts of B, C and D (`process.tool_named_in_transcripts`: 0 in each), and its command was not on their PATH.

**What the lead did that the package did not intend (A).** Three permission refusals across the two runs. In A-1 the lead amended its working copy before round 0: it took the held-out suite out of the builder's inputs and left the checklist file, a tightening the brief allows, recorded as an amendment note.

## Did a loop turn, and did the turn change the result

**Yes, in all six runs of A, B and C, and the turn took each from 44 to 55 of 55.** Each reviewer's own runs of the suite, read from the harness's transcripts ([`derived/`](derived/), made by `scripts/lib/compare-seen.mjs` after the runs; A's round-0 reports are also kept in each run record, [`A-1/runs/20261004-211444/REVIEW-round-0.md`](A-1/runs/20261004-211444/REVIEW-round-0.md)):

| Run | The critic's first run of the suite | Its second |
|---|---|---|
| A-1, A-2 | 44/55 | 55/55 |
| B-1, B-2 | 44/55 | 55/55 |
| C-1, C-2 | 44/55 | 55/55 |
| D-1, D-2 | nobody ran it; the scorer found 51/55 | |

The same 11 cases failed at round 0 in all six runs: the four `undefined` cases and the seven `not plain data` cases. Every Sonnet 5.5 builder took the suite's side on a null prototype and on dates, met both checklist-only items, and took the other side on `undefined` and on what to do with a value that cannot be copied. Each critic quoted the failing cases, each builder's `CHANGES.md` names the two groups it then fixed, and each second review passed. In A that was one traversal of `e-critic-fail`, `bar-passed` at round 1, 4 of 10 dispatches, and the halt at `merge-gate`. In B the one session did the same four dispatches and stopped at the gate. In C the first session did the same and said `done: yes`, so the loop of sessions ended after one iteration, as pre-registered.

Arm D's one Opus 5.5 session scored 51 in both replicates: it took the suite's side on three of the four open points (it refused a function, a Map, a Set and an instance of a class with a `TypeError` without being told to) and failed only the four `undefined` cases, both times.

**No cap and no budget fired**, as pre-registered: every run of A ended at 4 of 10 dispatches, round 1 of 4.

## The judge's reasons

One call, `claude-opus-5-5`, no tools, eight candidates under random letters ([`judge/transcript.md`](judge/transcript.md), [`judge/verdict.json`](judge/verdict.json), $0.50). It ranked the two D runs first and second (5/5 each) and gave the six others 3/5 or 4/5, and its reason is the held-out suite's own point seen from the other side: "Six of the eight (all but J and M) invent a rule that an undefined in over counts as not given, which the task does not state and which conflicts with 'a value given in over replaces'." The judge is given what the builder saw, not the suite. So it marks down, as unrequested, exactly the behavior the suite requires and the critics asked for; and it credits D for following the letter of a task whose open point D resolved the other way. On this project the judgment and the suite measure opposite things, and the judgment cannot be read as a ranking of quality.

1. **D-2** (letter M, 5/5): merge/copy implement the task exactly as written, with no invented undefined rule, plus cycle detection that still allows shared references. Tests hit every checklist item, including nested arrays for no-sharing (`result.more[0].k.push(0)`) and forbidden keys (`list2: [[{ keep: 2 }]]`). The CHANGELOG line is one sentence in the existing style and covers both layering and replacement.
2. **D-1** (letter J, 5/5): layerInto/copy follow the task literally, copy everything, reject non-plain data and cycles, and allow shared non-cyclic references. Tests cover every checklist point, including arrays in the no-sharing and forbidden-key tests and Date mutation (`result.when.setTime(5)`). The CHANGELOG line omits that other values replace, which is the only reason it sits just below M.
3. **C-1** (letter Q, 4/5): assertPlainData plus layerObjects is correct, keeps base keys holding undefined, and the tests are thorough, including nested arrays in the no-sharing and forbidden-key checks. It adds the unrequested rule that undefined in over counts as not given (`if (value === undefined) continue;`). Cyclic input overflows the stack instead of throwing a TypeError.
4. **A-1** (letter H, 4/5): The merge, deep copy and forbidden-key handling are correct, with thorough tests (the reachable-set check, evil as base, over and both). It adds an unrequested rule that undefined in over counts as not given. It also silently drops base keys whose value is undefined (`base[key] === undefined) continue`), which contradicts 'a key only one of them has is kept' and is untested.
5. **A-2** (letter P, 4/5): Copying base and then layering over is correct, validates non-plain data on both sides, and the frozen-input test is a good regression guard. It adds the unrequested rule that undefined in over counts as not given. Its CHANGELOG line is long and semicolon-chained, drifting from the terse existing style.
6. **B-1** (letter Y, 4/5): A simple copy-validating merge, correct on every checklist point, with tests for non-plain data inside nested arrays and for Date copies. It adds the unrequested undefined-as-not-given rule. Its CHANGELOG entry is two sentences, unlike the one-line entries below it.
7. **C-2** (letter W, 3/5): Copying both sides and then merging in place (`merge(result, copy(over, true))`) is correct, with cycle detection and strong tests. It adds the unrequested undefined-as-not-given rule. Its CHANGELOG entry is a paragraph-length run-on listing internals, so checklist item 6 (match the style of existing entries) is not met.
8. **B-2** (letter X, 3/5): The merge and the up-front plain-data check are correct, with thorough tests. copy drops every key holding undefined, base included. The test 'layer leaves out undefined values from base too' enshrines that, contradicting 'a key only one of them has is kept'.

## Did the graph earn its cost

**No: the pre-registered losing condition was met.** Arm B matched arm A on held-out passes in both replicates (55 of 55) at lower cost: $0.67 and $0.69 against $1.18 and $1.23. C did the same at $0.64 and $0.80. The package's runs took 36 and 41 harness turns against 5 to 10 for the prompt arms; what that bought is the run record (the notes, the round-0 report kept beside the round-1 report, the halt note at the gate, the amendment), not a better `layer`.

**The design, in all three of its forms, ended above no design: 55 of 55 against 51 of 55 in both replicates**, a range wholly above the other, for about twice D's cost in B and C ($0.64 to $0.80 against $0.33 and $0.35) and three and a half times in A. The four cases are the one open point the lone session resolved against the suite. That is the reviewer's held-out evidence reaching the builder, which is what the design is for; it is the same in the package and in the prose.

## What this comparison cannot show

Beyond what the pre-registration says: with n = 2 the difference of four cases between D and the rest rests on two runs that failed the same four cases. D's one session was Opus 5.5 and the builders of A, B and C were Sonnet 5.5, so the 51 at D against the 44 at round 0 elsewhere is two models' guesses as much as two designs. And the suite was built so a first pass would fail: what the runs show is that a reviewer holding cases the builder cannot see moves the builder to them in one round, in a package and in prose alike, on a task where such cases exist.
