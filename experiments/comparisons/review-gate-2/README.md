# review-gate · study two · the graph against a prompt, and against the task alone

A paired comparison of the `review-gate` template in study two (protocol [`docs/comparisons.md`](../../../docs/comparisons.md), version 2; handoff 0019), on a harder task than study one's. Study one's project is [`../review-gate/`](../review-gate/README.md): another task, three arms, other models. The two are not one table. Four arms here, two replicates each, scored by the same script, judged blind. Results will follow the pre-registration below; nothing above the "Runs" heading changes after the first run.

## Pre-registration

Written and committed before any run of this project (protocol §7; the same text is in [`expect.json`](expect.json) for the runner, the scorer and the summary).

**Task.** [`task/`](task/): `settingskit`, settings for a command-line tool as plain data. Add `layer(base, over)`, which lays one layer of settings on another: plain objects under the same key are layered key by key, and everywhere else the value from `over` wins. The task text ([`slots.json`](slots.json)) says that much and that both arguments must be plain objects.

**Two items the task text does not state.** The checklist ([`docs/REVIEW-CHECKLIST.md`](task/docs/REVIEW-CHECKLIST.md)) holds eight items, and two of them are nowhere in the task text: item 4, the result shares nothing with either layer (no object or array reachable from it is one reachable from an argument, at any depth and inside arrays); and item 5, keys named `__proto__`, `constructor` or `prototype` are never copied, and every object in the result is an ordinary one. The checklist is in the task folder, so every arm can read it; whether a builder builds to it is part of what is measured.

**What both leave open, and how the held-out suite settles it.** [`held-out/layer-cases.test.mjs`](held-out/layer-cases.test.mjs) has 55 cases: 21 that the task and checklist items 1 to 3 state, 17 for the two checklist-only items (11 for item 4, 6 for item 5), and 17 that turn on a point neither settles.

| Open point | The suite's side | A reading just as fair |
|---|---|---|
| undefined | a key whose value is `undefined` counts as not given, in either layer | the value from `over` wins, `undefined` included |
| null prototype | an object with no prototype is a plain object, and comes back ordinary | a plain object is one whose prototype is `Object.prototype` |
| not plain data | a function, a Map, a Set or an instance of a class is refused with a `TypeError`, wherever it sits | what cannot be copied is handed over as it is |

**The design bet.** The template's mechanism is a critic in a fresh context that judges the change against a written checklist, item by item, and runs a held-out suite the builder never sees. The bet is that a first pass misses at least one of the five (two checklist-only items, three open points), the critic's failures send the builder back (`e-critic-fail`), and the run ends with more held-out passes than a session with no reviewer (arm D). Against the same design said in prose (arms B and C) the bet is narrower: that the package reaches the suite's passes at least as surely, at a cost the difference justifies.

**The measure that would show it.** Held-out passes out of 55, by group; whether a loop turned, and the held-out score before and after the turn, from each run's record; who read the suite (transcript digest); cost and wall time; the blind judgment.

**The expected chance of a round-0 pass: 0.05.** A builder passes at round 0 only by taking the suite's side on all three open points without seeing it and by meeting the two checklist-only items to the letter. Rough odds of 0.5, 0.5 and 0.2 on the open points and 0.9 on the checklist items give about 0.05. It is an estimate, made without running a model. What is measured without one: a first pass that meets every checklist item as written ([`reference/first-pass/`](reference/first-pass/src/layer.mjs)) passes 38 of 55 and fails only in the three open groups, and a solution ([`reference/solution/`](reference/solution/src/layer.mjs)) passes 55 of 55 (`node --test scripts/lib/compare-projects.test.mjs`). Both are one author's code, kept beside the task and never copied into a run.

**What counts as the graph losing.** Arm B matches or beats arm A on held-out passes in both replicates at lower cost. The graph earns its cost only if A's held-out range lies above B's, or A reaches B's passes at lower cost in both replicates. The design itself (A, B and C alike) loses to no design when D's held-out range is not below theirs.

**Arms.** A: the package as `scripts/prove-pattern.sh` runs one (builder and critic both on tier `strong`; loop `review`: bar-passed, at most 4 rounds, 10 dispatches; then a halt at `merge-gate`, which is the run's ending: no answer is scripted). B: [`prompt-B.md`](prompt-B.md), derived from that package by rule (§3), one session, the gate restated as "stop and report when you reach this point; do not proceed past it". C: the same prompt in up to N = 4 fresh sessions ([`loop-C.sh`](loop-C.sh)). D: [`prompt-D.md`](prompt-D.md), written from the task folder alone: the task text, the names of `README.md`, `docs/REVIEW-CHECKLIST.md` and `CHANGELOG.md`, and `npm test`; no roles, routing, loop or briefs.

**Models.** The lead is `claude-opus-5-5` at effort `high` in every arm, and the blind judge is `claude-opus-5-5` with no tools. Sub-agents run on the model their tier means, and what a tier means is a named field of this pre-registration: `tier_map` in [`expect.json`](expect.json), handed to `grooph export` as `GROOPH_MODELS` for every package and so carried into the derived prompt. **The tier map is not named yet**; it is filled in, and `prompt-B.md` derived again under it, before the first run, and the runner starts no paid run while it is empty. No call uses Fable. Study one ran its leads on `claude-opus-5` with a `claude-fable-5-1` judge and the target's own tiers, so the two studies are not compared run for run.

**Held-out.** In A, B and C the suite is named once, in the `checklist` slot, exactly where the template hands its checklist to the critic: as the critic's to run and quote, and not the builder's to read. In A the critic is a separate sub-agent; in B and C whoever plays the critic is the same session or a sub-agent it chooses to dispatch. In D the suite is named to nobody: no task file, no line of the prompt and no permission rule points at it, and the folder is moved away from the scratch project for the length of the run. The transcript digest records who touched it. So D's score on the 17 open cases is how much of what the text leaves open a session guesses the suite's way, and its score on the 17 checklist-only cases is whether a session with no reviewer builds to a checklist it was pointed at.

**Replicates.** Two per arm, in the order A1 B1 C1 D1 A2 B2 C2 D2. Two is a range, not a mean; the tables say so. A run cut off at the $9.00 ceiling of an invocation is scored and judged, not retried.

**What this comparison cannot show.** That the template beats a human, a named product (spec §15) or another model; with n = 2, a small difference at all; anything about a task larger than one function and an eight-item checklist.
