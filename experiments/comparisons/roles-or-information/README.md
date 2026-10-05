# Roles or information: two arms on study two's tasks

**Pre-registered on 2026-10-05, before any run. Nothing here has been run.** The owner said yes to this question the same day. It holds the two derived prompts for each of study two's three tasks, and what each result will be read as, written before any of them exists. The question is in [`handoffs/briefs/study-three-on-paper.md`](../../../handoffs/briefs/study-three-on-paper.md), question 5. The same facts are in [`expect.json`](expect.json) for the runner.

**Parked on 2026-10-05: not run.** The owner parked the experiments that day; his yes waits for him. The order when work resumes, and what each step may cost, is at the top of [the profile's page](../profile/README.md). Nothing here may be changed after the first paid call without a dated note saying what changed and why.

## Why

In both comparisons the reviewer held evidence the builder had not seen. So a design ended above the task alone, and nobody can say whether the roles did it or the information did (audit 0001, finding F12). These two arms take the two apart, on the same three tasks and with the same suites as the scorer.

| Arm | What the session is given | What it takes away |
|---|---|---|
| **E, information without roles** | The task alone, as study two's arm D, with the held-out material a reviewer was given named to the one session | the roles: no builder, no reviewer, no loop |
| **F, roles without information** | Study two's design as prose, as its arm B, with no held-out material anywhere | the information: a reviewer in a fresh context that holds nothing the builder lacks |

## How each prompt is made

Nobody writes either by hand. `node scripts/lib/compare-arms-ef.mjs --write` makes them, and `--check` confirms the kept ones are what the rule derives today.

- **Arm E** is arm D's kept prompt, byte for byte, with one section added at its end. The section names the held-out files a reviewer was given in study two (the task's `held-out/` folder, less what was the scorer's alone) and uses the same words for every task: a suite is run and every case made to hold; any other file is read and agreed with. It names no role, and it does not say where the files are.
- **Arm F** is the protocol's own derivation of arm B, from a package compiled with [`slots.F.json`](review-gate-2/slots.F.json) in place of study two's slots. Those are study two's slots with the one value that named the held-out material rewritten to name only what is inside the project. Every other value is the same, byte for byte, and the script refuses anything else.

| Task | Arm E names | Arm F's one changed slot | Now reads |
|---|---|---|---|
| [`review-gate-2`](review-gate-2/) | `layer-cases.test.mjs` | `checklist` | `docs/REVIEW-CHECKLIST.md` |
| [`heterogeneous-critic`](heterogeneous-critic/) | `parse-ranges-cases.test.mjs` | `checklist` | `docs/REVIEW-CHECKLIST.md` |
| [`taste-polish`](taste-polish/) | `REFERENCE.md`, `reference.txt` | `reference` | `STYLE.md`, the file the owner already works from |

## What to know before saying yes

- **On two of the three tasks, arm E is handed the scorer's own suite and told to pass it.** In `review-gate-2` and `heterogeneous-critic` the file a reviewer ran in study two is the file the scorer runs. So there "E matches A" can mean only this: a session given the answer key and told to satisfy it does so. That is a ceiling, and it would be a surprise if E fell short of it. It is not evidence that roles add nothing. **The arm that can say something on those two tasks is F:** whether a reviewer who holds nothing the builder lacks lifts the result above the task alone.
- **In `taste-polish` arm E is informative.** There the reviewer was given the reference statement and the notes on it, and the scorer's own suite was kept from every session. E is given the reference and not the suite.
- **Arm E is told more firmly than a reviewer was.** A reviewer was told to run the suite and report what failed. The one session of arm E is told to run it and make every case hold.
- **In `taste-polish`, arm F's reviewer is awkward.** The template has its reviewer compare the captures "side by side" against a reference. With no reference, the derived prose has it compare them against `STYLE.md`, in the template's own words. The words are the template's and are left as derived.
- **The task text is study two's, unchanged, in both arms.** In `taste-polish` it says the billing team's statement "is kept outside this project" and to work from `STYLE.md`. Arm F's prompt still carries that sentence: it names no path, and in arm F no folder exists for it to point at. Arm E carries it too and then names the statement, so its two sentences pull against each other. Both prompts are left that way: the task text goes to every arm as written.
- **Where the held-out material is.** Arm E's added section does not say. The token `<held-out>` becomes a real path when a run is built, and from the clean profile that path has to be inside the session's folder ([`../profile/README.md`](../profile/README.md)).
- **The scorer and its suites are study two's.** Nothing under `experiments/comparisons/review-gate-2/`, `heterogeneous-critic/` or `taste-polish/` is changed or copied.

## Pre-registration

**What is run.** Twelve sessions: on each of the three tasks, arm E twice and arm F twice, in the order E-1, F-1, E-2, F-2, task by task. A run is started only when every run before it is recorded. The lead is `claude-opus-5-5` at effort `high`; where arm F's prose names a model for a role, it is study two's tier map. Never Fable, never Astra.

**Where a session runs.** From the comparison profile ([`../profile/`](../profile/)), in a folder of its own. In arm E the held-out material is inside that folder, at `held-out/`, since the profile lets no file tool read outside it; it is closed to writing by the sandbox and by a rule on the command line. In arm F there is none.

**How a run is scored.** By study two's scorer and study two's suites, run from the repository's own `held-out/` folders against the final tree. Never from the copy a session was given.

**No run of this question starts until the owner has decided that it may be scored this way.** The scorer runs the task's own `npm test` and the held-out suite against the session's final tree, and that runs the code the session wrote: outside the sandbox, with the account's rights. Study two's runs were scored that way. A session's commands here run inside the sandbox; what it wrote does not when it is scored. His decision is kept in [`../study-three-first-steps.json`](../study-three-first-steps.json), under `scoring_outside_the_sandbox`: who decided, on what day, in what words. It is empty today, and while it is the runner refuses the whole run before it makes a folder, since a run that cannot be scored is not paid for. Each scored run's record names the decision it was scored on.

**What the scores will be read as.** Two statements, each of which either holds or does not. The numbers are study two's: with the design, 55 of 55, 70 of 70 and 24 of 24; with the task alone, 51, 52 and 15.

- **"The information did it"** holds when, in every task, both runs of E pass every held-out case and both runs of F pass no more than the task alone did.
- **"The roles did some of it"** holds when, in at least two tasks, both runs of F pass more held-out cases than the task alone did.
- **Otherwise neither is claimed**, and the scores are reported task by task.

**When each is read.** As soon as the recorded scores settle it either way, and not before. Until then the runner prints "not decided yet", never "false".

- "The information did it" is false at the first run of E short of every case, or run of F above the task alone. It is true only when all twelve runs are scored and none of them is either.
- "The roles did some of it" is true once two tasks each have both runs of F above the task alone, whatever is still to come. It is false once fewer than two tasks could still have that.

**What counts as a run's score.**

- **A run the harness or the account ended is not a score.** It is recorded, the driver is told, and it is made again once on the driver's word; the rerun's score is read in its place. Invalid both times, the run was not obtained: a task with a run of F not obtained cannot count toward the second statement, and the first is "not decided: a run was not obtained" unless a run in hand has already settled it.
- **A run the watchdog cut off is scored as it stands**, as study two's protocol scores a cut-off, and its score is marked so.
- **A final tree the suite was run against and gave no summary for passed no case**: it would not load, or it did not end. That is the session's.
- **A run with no score at all is not a score.** The scorer failed, or its file is not there: that is the runner's, not the session's. The run reads as "recorded, not scored", a statement that needs it is not decided yet, and it can be scored again from the tree the runner kept.

**Said beforehand.**

- Two runs an arm give a range, never a rate. A difference of a case or two between F and the task alone is inside what two runs can show, which is why the second statement asks for both runs on two tasks.
- Study two's numbers were made from the account's usual folder, under study two's five measures. These runs are made from the clean profile. The comparison with study two's task-alone arm is across that difference, and the write-up says so.

**The watchdog** is $2.00 and fifteen minutes for a session of arm E, and $4.00 and twenty minutes for one of arm F. It is never a brake of a graph.

**What it costs.** About $9: E at about what the task alone cost in study two ($0.25 to $0.42), F at about what the prose arm cost ($0.67 to $1.05).

```bash
node scripts/lib/roles-or-information-paid.mjs --next                       # which run is next, and what it would start
node scripts/lib/roles-or-information-paid.mjs --spend --go "<the driver's words>"   # the next run, and only that one
node scripts/lib/roles-or-information-paid.mjs --readings                   # what the recorded scores are read as, so far
node scripts/lib/roles-or-information-paid.mjs --score <task>/<arm>-<n>     # score a recorded run whose scorer failed, from the tree the runner kept; no session, no spend
```

A paid run is started from a terminal, and is refused unless the first paid call's record says the runs after it may be made ([`../profile/first-call/`](../profile/first-call/)).

Each run's record goes to `<task>/<arm>-<n>/` here, with its `score.json`.
