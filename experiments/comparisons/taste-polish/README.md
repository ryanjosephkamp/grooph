# taste-polish · the graph against a prompt, and against the task alone

A paired comparison of the `taste-polish` template in study two (protocol [`docs/comparisons.md`](../../../docs/comparisons.md), version 2; handoff 0019). Four arms on one task, two replicates each, scored by the same script, judged blind. Results will follow the pre-registration below; nothing above the "Runs" heading changes after the first run.

## Pre-registration

Written and committed before any run of this project (protocol §7; the same text is in [`expect.json`](expect.json) for the runner, the scorer and the summary).

**Task.** [`task/`](task/): `usage-statement`, which renders the monthly usage statement emailed to a customer as plain text. The first version is crude: one line per item, amounts in raw cents, no columns. [`STYLE.md`](task/STYLE.md) says in words what the statement should be (a heading, aligned columns, dollars and cents, credits and the total set apart, 72 columns, plain characters, exact numbers); `npm run capture` writes the statement and a readable account of it into `captures/`. The statement the billing team already sends is the reference, and it is not in the task folder.

**What only the reference shows.** [`held-out/reference.txt`](held-out/reference.txt) is that statement, for the same data, and [`held-out/REFERENCE.md`](held-out/REFERENCE.md) says what matters about it, most first, and what counts as a major gap. Seven of its properties are nowhere in the style brief:

| Property | In the reference |
|---|---|
| structure | a line adds up the charges; then the credits; the total due is the last figure, under a rule |
| order | charges by amount, largest first (equal amounts by name); credits the same way |
| money | a comma between thousands; the currency named once, in the column heading; a credit in parentheses, its digits in line with the amounts above |
| no usage | a service with no usage is not a line of the table; a sentence at the foot counts and names them |
| share | a column gives each charge as a percentage of the charges, to one decimal |
| heading | the month by name; the customer first, the account number at the right of the same line |
| usage | the quantity, with a comma between thousands, beside its unit |

**The held-out suite.** [`held-out/statement-properties.test.mjs`](held-out/statement-properties.test.mjs) has 24 cases: 7 for what the style brief states, 17 for the seven properties above. It reads properties of the text the project's renderer returns for its own data, not a layout: column widths, the wording of headings and the length of rules are free.

**The design bet.** The template's mechanism is one owner who revises a rendered artifact and a critic in a fresh context who compares readable captures against a named reference and returns the gaps that matter most, bounded by rounds, a dispatch budget and a human check-in every two rounds. An owner working from the brief alone is expected to miss most of the seven; the bet is that the critic's side-by-side names them, `e-critic-fail` is taken, and the statement ends closer to the reference than one polished with no reviewer (arm D). Against the same design said in prose (arms B and C) the bet is narrower: that the package closes at least as many of the seven, at a cost the difference justifies.

**The measure that would show it.** Held-out passes out of 24, by group; whether a loop turned and how many gaps the critic named each round, from each run's record; who read the reference (transcript digest); cost and wall time; the blind judgment of the rendered statement.

**The expected chance of a round-0 pass: 0.01.** An owner passes at round 0 only by making all seven choices without the reference, and two of them are choices no brief suggests (the share column, the sentence at the foot). It is an estimate, made without running a model. What is measured without one: a first pass that meets the brief ([`reference/first-pass/`](reference/first-pass/src/statement.mjs)) passes 12 of 24 and fails in all seven groups; the task as it ships passes 6; and the renderer of the reference itself ([`reference/solution/`](reference/solution/src/statement.mjs)) passes 24 of 24 (`node --test scripts/lib/compare-projects.test.mjs`, which also holds that renderer to `reference.txt` byte for byte). All are one author's code, kept beside the task and never copied into a run.

**What counts as the graph losing.** Arm B matches or beats arm A on held-out passes in both replicates at lower cost. The graph earns its cost only if A's held-out range lies above B's, or A reaches B's passes at lower cost in both replicates. The design itself (A, B and C alike) loses to no design when D's held-out range is not below theirs.

**Arms.** A: the package as `scripts/prove-pattern.sh` runs one (owner on tier `strong`, critic on tier `frontier`, a capture check between them; loop `polish`: bar-passed, diminishing returns over 2 rounds, a human check-in every 2 rounds, at most 5 rounds, 16 dispatches). The human check-in is an ending: no answer is scripted, so a run that reaches it halts there. B: [`prompt-B.md`](prompt-B.md), derived from that package by rule (§3), one session. C: the same prompt in up to N = 5 fresh sessions ([`loop-C.sh`](loop-C.sh)), ending early when a reply says done and `npm test` passes. D: [`prompt-D.md`](prompt-D.md), written from the task folder alone: the task text, the names of `README.md` and `STYLE.md`, and `npm test`; no roles, routing, loop or briefs.

**Models.** The lead is `claude-opus-5-5` at effort `high` in every arm, and the blind judge is `claude-opus-5-5` with no tools. Sub-agents run on the model their tier means, and what a tier means is a named field of this pre-registration: `tier_map` in [`expect.json`](expect.json), handed to `grooph export` as `GROOPH_MODELS` for every package and so carried into the derived prompt. **The tier map is not named yet**; it is filled in, and `prompt-B.md` derived again under it, before the first run, and the runner starts no paid run while it is empty. No call uses Fable. Study one ran its leads on `claude-opus-5` with a `claude-fable-5-1` judge and the target's own tiers, so the two studies are not compared run for run.

**Held-out.** In A, B and C the reference and its notes are named once, in the `reference` slot, exactly where the template hands its reference to the critic. The template lists that slot among the owner's inputs too, so the slot value says it is the critic's yardstick and not the owner's to read; the transcript digest records who read it. The suite the scorer runs is the scorer's alone: the template names its critic a reference, not a suite, so the suite is moved out of the folder before any run and nobody in any arm can read it. In D the reference is named to nobody: no task file, no line of the prompt and no permission rule points at it, and the whole folder is moved away from the scratch project for the length of the run. So D's score on the 17 reference cases is how many of those choices a session makes with no reference to look at.

**The judge.** Beside each run's diff of `src/` and `tests/`, the judge reads the statement itself: the runner renders it from the run's final tree with `npm run render`, the same way for every arm, and keeps it in the run folder. The judge is given what the builder saw (`README.md`, `STYLE.md`), not the reference.

**Replicates.** Two per arm, in the order A1 B1 C1 D1 A2 B2 C2 D2. Two is a range, not a mean; the tables say so. A run cut off at the $9.00 ceiling of an invocation is scored and judged, not retried.

**What this comparison cannot show.** That the template beats a human, a named product (spec §15) or another model; with n = 2, a small difference at all; anything about an artifact that cannot be read as text, or about taste where no reference exists. The suite counts properties of one reference: a statement that is better than the reference in a way the suite does not check scores no higher for it.
