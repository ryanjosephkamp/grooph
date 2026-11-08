# What the experiments found

Before grooph was a drawing tool, it compiled a diagram into a prompt package: files that tell a Claude Code session to run the diagram as drawn, with named subagents, stops, and a record of the run. These experiments asked whether that helped, and whether watching a session changes what it does. That work is now [the lab](lab.md), and experimental.

Every number below comes from the runs' own records, linked in each section. The records are kept with local paths, session ids, and email addresses replaced; the raw harness output (transcripts and their digests) is not kept, and the numbers were read from it when the records were made. Costs are what the harness reported, at list price. All the tasks were small (one function, or one rendered page), and each arm ran two or three times, so a difference of one test case or one rank is noise.

## In short

- **The package did not beat the same design written as a plain prompt.** In two paired comparisons, 51 runs on seven small tasks, the two scored the same on tests the builder never saw. The package cost up to twice as much in the first study, and in the second it cost more in every run and took 2 to 8 times as many turns.
- **A reviewer who holds evidence the builder can't see made the loop turn.** In the second study, on tasks built so a first pass fails, all 18 runs with such a reviewer failed the first pass and passed the second, in the package and in the prose alike. In the first study, whose tasks a first pass could finish, no package run's loop turned, and one prose run's did.
- **The watching hook made no difference in test scores.** In 36 runs, scores overlapped with and without it, and costs differed by a few cents in both directions. It is not invisible: 8 of the 24 watched or invited sessions mentioned its files.
- **No round cap or budget in a diagram is on record as stopping a run.**

## The template runs

Each of the twenty templates was run once, headless, in Claude Code, on a small task built for it. The latest kept run of each is counted: 20 runs, $41.12. A check of selected parts of each record (the named agents ran as their own subagents, the run ended where the diagram says, the notes are complete) passes for 18 of them; `gauntlet-decomposed` and `ralph-loop` fail it. Seven earlier runs are kept beside them, and six of those fail the check.

This shows that a session can follow a package's structure. It does not measure whether the work came out better.

Data: [`experiments/patterns/`](../experiments/patterns/README.md), with every model call in its [ledger](../experiments/patterns/ledger.json). The [field guide](field-guide.md) gives each template's run.

## Study one: the package against the same design as a prompt

Four templates (`grind-loop`, `review-gate`, `red-team-loop`, and `spec-then-loop`), one small task each, run three ways:

| Arm | What ran |
|---|---|
| A, the package | the template compiled for Claude Code |
| B, the prompt | one prompt in one session, rewritten from the package by rule: the same roles, order, and limits, with none of grooph's files or record |
| C, the prompt in a loop | prompt B given to a fresh session again, up to the template's round cap |

27 runs and four blind judgments cost $60.62: $56.62 for the runs and $4.01 for the judge. A script scored each run against held-out tests the builder was told not to read, and a judge that was not told which arm was which ranked the runs of each project.

- **Every arm reached the same held-out score within each project:** 61 of 62 for `grind-loop` (every run missed the same case), 41 of 41, 73 of 73, and 88 of 88.
- **The package cost about twice as much in `grind-loop`** ($0.60 to $0.66, against $0.31 to $0.34 for the prompt). In the other three the cost ranges overlapped. In `red-team-loop` the package was the cheapest arm, because one prompt run kept attacking past where the package stopped and hit the $9.00 ceiling set for each run.
- **The blind judge never ranked a package run first**, and ranked one last in three of the four projects.
- **None of the four projects met the test, written down before any run, for the package earning its cost.**

In the prompt arms the session still split the work among subagents, as the prose described. So this compared the package with the same design said in prose, not structure against no structure. In three of the four tasks every run got full marks, so those tests could not tell a better result from a worse one.

Data: [`experiments/comparisons/`](../experiments/comparisons/README.md), with every call in its [ledger](../experiments/comparisons/ledger.json).

## Study two: tasks built so a first pass fails

Three templates (`review-gate`, `heterogeneous-critic`, and `taste-polish`) on new tasks that leave points open for a held-out suite to settle, so that a reviewer holding that suite has something to send back. A fourth arm was added: **D, the task alone**, with no roles, loop, or briefs. The lead of every arm and the blind judge were Opus 5.5. In arms A to C the builders were Sonnet 5.5, and in two projects an Opus 5.5 critic checked them; arm D was one Opus 5.5 session. 24 runs and three blind judgments cost $22.03.

- **The prose matched the package at lower cost in every project:** 55 of 55 at $0.67 to $0.69 against $1.18 to $1.23; 70 of 70 at $1.03 to $1.05 against $1.29 to $1.60; and 24 of 24 at $0.88 to $0.89 against $1.42 to $1.58. Arm C did the same.
- **The package took 2 to 8 times as many harness turns:** 30 to 49, against 5 to 13 for the prompt arms.
- **The loop turned in all 18 runs with a reviewer**, 6 package runs and 12 prose runs: the first pass failed the held-out material and the second passed it, from 44 to 55, from 52 to 70, and in `taste-polish` from four major gaps to none. In the package runs each first pass is in the records. In the prose runs the records hold the dispatches in order (builder, critic, builder, critic) and the final tree; the first-pass counts come from transcripts that are not in the repository.
- **The task alone scored lower on the held-out tests** (51 of 55, 52 of 70, and 15 of 24) and cost a half to a sixth as much.
- **The blind judges of the two code projects ranked the task-alone outputs first.** Given only the visible task, they marked the others down for behavior the task did not ask for, which is what the held-out suites required.

What this shows is that a reviewer holding evidence the builder can't see moves the builder to that evidence in one round, in prose as in the package. It does not separate the effect of the structure from the effect of the extra evidence.

Data: the second half of [`experiments/comparisons/README.md`](../experiments/comparisons/README.md), and the [`review-gate-2`](../experiments/comparisons/review-gate-2/README.md), [`heterogeneous-critic`](../experiments/comparisons/heterogeneous-critic/README.md), and [`taste-polish`](../experiments/comparisons/taste-polish/README.md) folders.

## The watching check

Does installing grooph's event hook, or inviting a session to state its plan through grooph's tools, change what the session does? 36 headless runs on two small tasks, in three arms (plain, watched, and invited), on three models, cost $16.72.

- **Held-out scores overlapped** between the plain arm and each watched arm, on both tasks, on every model.
- **Costs differed by a few cents, in both directions.** With two runs an arm, that cannot be told from chance.
- **35 of the 36 sessions used no subagent.** The tasks were small enough to do directly, so this says little about sessions that delegate.
- **A session can see the hook's files when they are inside the project.** In 8 of the 24 watched or invited runs, the final reply mentioned them. No session changed them.
- **No invited session used the two tools.** The one invited session that used subagents did not call them either.

Data: [`experiments/watching/RESULTS.md`](../experiments/watching/RESULTS.md) and its [ledger](../experiments/watching/ledger.json).

## What was not tested

- **A stop that has to hold.** No round cap or budget is on record as firing in any package run. A budget experiment was designed and has not been run.
- **Anything larger** than one function or one rendered page, or a loop that needs more than one turn.
- **A package run in Codex.** The Codex compiler is tested against golden packages; no session has run one.
- **Two larger studies** were prepared and not finished: a browser game built from one diagram in each harness (prepared on paper, never run) and a second look at watching (its runner stopped itself after 5 of 18 planned runs, on a false alarm, and the study was then dropped; its records are not in this repository). Neither is analyzed here.
