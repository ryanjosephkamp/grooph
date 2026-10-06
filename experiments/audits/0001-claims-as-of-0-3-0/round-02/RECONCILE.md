# Audit 0001-claims-as-of-0-3-0 · round 02 · reconciliation

**By:** the audit lane (Claude Code, Opus 5.5) · **For:** the owner · **Date:** 2026-10-06 · **Handback:** [`HANDBACK.md`](HANDBACK.md) (Codex, GPT-6.1 Sol, written 2026-10-06; 16 findings), with its notes in [`notes/`](notes/)

> **Not final, and wrong in two places.** A fresh reader's report arrived after work stopped for the owner's absence ([`lane-notes/reconcile/fresh-reader/REPORT.md`](lane-notes/reconcile/fresh-reader/REPORT.md)), and it is not yet applied below. It refutes two things this file says. **(1) F1 is wider than stated here:** a *new* stop that leads on, of a kind the loop did not have, added ahead of a halting one, is adopted and exported with nothing refused where no check or critic stands before where it leads; "the source must already hold both stops" and Card 1's "it does notice a new limit being added" are false. **(2) F2 is two-sided:** a real run of the check started through `awk` is filed as printed back and not counted, so a run that went past its budget can read `met`; "it cannot hide a run that went past" is false, and F2 should read "agree", not "partly". Seven smaller points are in the report. Do not open a pull request from this file as it stands.

The owner carried Codex's prompt back on 2026-10-06 at 11:20 ET. One carry out, one back, for this round.

Codex read snapshot `faba78aeff36e9aca5c02c8e726086cbe10191f5` and the cost page's four files at `980bcb6`. Since then grooph 0.4.0 was published and merged (main `e8055fa7`, tag `v0.4.0`), so three pull requests Codex could not read are on main: #142 (a halting stop made a success), #127 (the Codex target) and #60 (export compares brakes). Every command below was run twice where a command settles the finding: at the snapshot, and at main.

**What "at 0.4.0" means here.** The lane ran the source at tag `v0.4.0`, built on this Mac. It did not run the package from npm: fetching one is a download, and that needs the owner's own word in the lane's session, which a message from the driver is not. The registry's entry was read without a download ([`lane-notes/reconcile/npm-view-0.4.0.json`](lane-notes/reconcile/npm-view-0.4.0.json)): the published `grooph@0.4.0` names commit `04587958`, and main is that commit plus one merge that changes nothing under `packages/`, `patterns/`, `plans/` or the counter. One command would close the gap: `npx -y grooph@0.4.0 --version` and the stop-order probe's two commands, in an empty folder.

## Where the two sides stand

Codex returned 16 findings. The lane **agrees with 14 and partly with 2** (F2 and F8); it disagrees with none. Where it partly agrees, it agrees with the finding and differs on how far it reaches.

**Two findings are faults in what exists, not in words.** Both reproduce:

- **F1, in the product, and still so in 0.4.0.** Swapping two stops a loop already has, one that halts and one that leads on, turns a prescribed halt into a prescribed success. `grooph adopt --write` writes that copy with nothing refused, and `grooph export --into` places it over a package with the line "none of the brakes it compares was removed or loosened". The fix that merged after the snapshot (#142) does not close it.
- **F2, in the parked budget experiment's counter, which is unchanged.** A command that prints the check's line without running the check is counted as a run of the check, and the verdict is `met`. The counter is not in the npm package; it stands in the repository beside the paid runs, which stay parked.

**The lane found the edges of both, in both directions.**

- F1 is narrower than "the comparison loses stop order" suggests: a *new* stop that leads on, added ahead of or behind a halting one, is refused, at the snapshot and at 0.4.0. So a run cannot build the shape without a refusal; the source must already hold both stops. Of the 26 loops in the twenty built-in templates and four plan templates, one has limits that end in different ways (`debate-then-build`), and there the one that leads on is already first, so swapping them tightens.
- F1 is also wider than Codex's one case: it does not need two equal budgets. A cap of one round that halts and a budget of one round's dispatches that leads on fire on the same pass, and swapping them is adopted too.
- F2 runs one way only: a printed line can add to the count and never take from it. It turns a run that stopped short of its budget into `met` (shown at budgets 2 and 6). It cannot turn a run that went past its budget into `met`.

**The rest is wording, and the lane wrote much of the wording.** The guide's "empty context" and "nothing in grooph watches", its account of Gauntlet's failure, the handoff's own "no brake fired", "the same budgets as prose" and "it changed no result" were the lane's sentences or ones it passed on unchallenged. Codex is right about each.

Nothing remains disputed. What remains is the owner's: the words below, and when the two repairs are scheduled.

## What was run again

No model session was started and no experiment was run. Each probe reads and writes files only. Scripts are in [`../tools/`](../tools/); what each printed is in [`lane-notes/reconcile/`](lane-notes/reconcile/), once at the snapshot and once at main.

| Finding | Probe | At the snapshot (0.3.0, `faba78ae`) | At main (0.4.0, `e8055fa7`) | In what a person can install today |
|---|---|---|---|---|
| F1 | `stop-order-probe.mjs`: two equal budgets swapped | adopted, exit 0, version 2 written, nothing refused | the same | **still so** |
| F1 | the same, a cap of 1 round and a budget of 2 dispatches swapped | adopted, exit 0 | the same | **still so** |
| F1 | the same, at `grooph export --into` over a package in place | exit 0 (export compared nothing then) | exit 0, "none of the brakes it compares was removed or loosened"; the package's brief now lists the leading-on stop first | **still so**, at the second door |
| F1 | the same, control: the halting budget raised from 2 to 4 | refused, exit 1, nothing written | refused at both doors | held |
| beside F1 | `stop-added-ahead-probe.mjs`: a new leading-on stop added ahead of, or behind, a halting one; and on `grind-loop` | refused, exit 1 | refused, exit 1 | held |
| F2 | `counter-replay-probe.mjs`: Codex's replay at budget 2 | counted 2 for 1 real node run; `met` | the same (the file is byte for byte the same) | not in the package |
| F2 | the same, budget 6: one real round, two replayed lines | counted 6 for 4 real node runs; `met` | the same | not in the package |
| F2 | the same, three real node runs at budget 2, then a replay | `not met`: a replay does not hide going past | the same | not in the package |
| F2 | the same line printed by `cat`, or written out in the command | caught: `not met`, `not judged` | the same | not in the package |
| F9 | `capless-loop-probe.mjs`: no cap, a budget of 100,000 dispatches | no warning | no warning | **still so** |
| F12 | the control above, with `--allow loop:work.stops` (Codex ran it: [`notes/allow-by-name.txt`](notes/allow-by-name.txt)) | written for whoever gives the name | not run again; `grooph export --help` now tells an agent to add `--allow` "only for the ones they said yes to" | **still so**: an instruction, not a lock |
| F12 | `grooph adopt --help`, on "a budget" | says "a budget" loosely | says "a loop's round cap and budget" and that the graph's own budget line is not compared | **closed** in 0.4.0 |
| F11 | the three surfaces, read on main | as Codex found | `Landing.tsx:63`, report line 29, and the two template descriptions are unchanged | **still so** |

## Finding by finding

| Finding | Claim | Codex says | We say | Why | Proposed correction | New experiment? |
|---|---|---|---|---|---|---|
| F1 | Part E; C45 | Reordering two stops that fire together turns a halt into a success, and adoption does not refuse it | **agree** | Reproduced at both commits and at both doors. The contract is plain: stops are tried "in document order; the first that fires wins" (`graph-ir.md` §2), and the compiled brief prints them numbered. Narrower and wider than stated, as above | 1 (a limit, added by the lane in its own small pull request); a repair, proposed | no |
| F2 | Part D; the counter | A printed line counts as a run of the check | **partly** | Agree that "counted from its own trace" says more than the counter does: the trace is a line of output, and its producer is not shown. Differ on reach: the miscount only adds. It can make a run that stopped short read as at its budget. It cannot hide a run that went past, which is the failure the pair exists to catch | 2 (a dated note and a repair, proposed) | no; the pair stays parked |
| F3 | S3; decision 0029 point 3 | "Ended above the task alone" must name the measure | **agree** | The scores are on the author's held-out suites. The two blind judges of the code projects ranked the task-alone outputs first. The lane's handoff carried both facts and still passed the sentence on | 3, 4 | no |
| F4 | S5, S7; the cost page | "Named to the reviewer only" is false of the builder's declared inputs | **agree** | Codex's table checks: all six package builders' agent files name the held-out path, with the instruction not to read it; three leads took it out of the working copy | 5 | no |
| F5 | S7; C51 | The allocation does not price the cause | **agree** | The lead's difference ($0.524) is more than the whole difference ($0.516), so "all of it" is loose by its own tables. "Nothing tells the lead to read" overlooks that the brief asks a dispatch prompt to carry inputs written only in those files, which the page's own Table 10 says | 6 | no |
| F6 | S2 | A second pass is recorded in all 18; a measured improvement in two | **agree** | The write-up already says "how far that is shown and how far it is reported differs by arm". Its heading says more than that paragraph does | 7 | no |
| F7 | S4 | Human gates are brakes, and four fired | **agree** | By amendment A-008 a gate is a brake. Four package runs halted at their merge gates (`notes/stops-fired.txt`). "No brake fired" was the lane's heading for S4 | 8 | no |
| F8 | A1; decision 0029 | "Eighteen of twenty" counts the latest kept run of each | **partly** | Agree that the short sentence does not say which runs are counted, and that seven earlier runs are kept, six failing. Differ on weight: the sentence is true as written, the field guide and the guide's chapter 13 give the rule beside it, and it is the owner's signed sentence in six places. This is a choice of how much to say in one line, not an error | 9 (the owner's choice) | no |
| F9 | A2, A4 | The warning needs "no budget" too | **agree** | Reproduced at both commits: a loop with no cap and a budget of any size draws no warning | 10 | no |
| F10 | A2; C47 | An answer does not resume a run by itself | **agree** | The recorded continuations resume the same session with the answer | 11 | no |
| F11 | C46, C50 | Three surfaces still promise more than is shown | **agree** | All three stand on main at 0.4.0 | 12 | no |
| F12 | Part E; C45 | Whoever runs the command can allow a change; coverage is selective | **agree** | The name is given by a flag. "The person asks" is the rule the brief states, not what the command can know. One part is closed in 0.4.0 (the help text on "a budget") | 13 | no |
| F13 | S8; Part D | The prose pair allows two workloads | **agree** | The pre-registration says so in its own bullet, under a heading that says "the same budgets" | 14 | no; a prospective choice |
| F14 | S9, S10; Part D | The brief's example contradicts a budget of 2 | **agree** | The pre-registration names the contradiction and then calls an overrun from it unlikely. That is a guess | 14 | no |
| F15 | Part F, chapters 1 and 13 | "Empty context" and "nothing watches" misteach | **agree** | `grooph watch`, the hook and the live view do watch. A fresh worker still has its own instructions and can read what it is allowed. Both sentences are the lane's | 15 | no |
| F16 | Part F, chapter 13 | Gauntlet halted where it was told to | **agree** | The counted run's record: `stop_fired: ["human"]`, three subagents ran, the integrator and final critic were not reached. The guide's sentence repeats the checker's reason and hides that | 15 | no |

### Beside the sixteen

- **Decision 0029** is faithful (Codex, Part C). It needs dated clarifications, not rewriting: corrections 4 and 9 below, and one for its sentence that the comparison "does not hold a check's command", which stopped being true that evening (#132).
- **The author's six questions on Part E.** Codex's answers are accepted as limits to keep naming, and most are already in `docs/runs.md`. One is new and small: where a node is reached only by a loop stop's `then`, the comparison treats it as a start and explains a refusal with "a run would start there", which is not true of it. That is a wrong reason on a right refusal; it goes to the house lane with F1's repair.
- **Two of the lane's own tools.** `irreversible-entry-probe.mjs` ended on a sentence that pull request #133 made untrue; it is corrected in this pull request. `adopt-probe.sh` says it shows the override and does not run it; Codex ran it separately, and the tool is left as it was run.
- **Chapter 5's opening**, "An agent cannot run a plan written as JSON": correction 15.

## Proposed corrections, word for word

None of these is made on the lane's or the auditor's authority, but for correction 1, which the driver asked the lane to make as a limit added. Old words are as they stand on main at `e8055fa7`, or in pull request #106 for the cost page.

**1 · `docs/runs.md`, "What adoption does not hold" (F1). Added by the lane, in its own pull request.** A new item: the order of two stops a loop already has; and one clause in `docs/claims.md`, row C45.

**The repair, proposed and not built** (the house lane's, after the pause): the comparison keeps the order of a loop's stops wherever two of them end differently. A stop that leads on, found ahead of a stop that halts where the source had it behind, is a loosening by name (`loop:<id>.stops`), whatever the two measure, since a cap and a budget can fire on one pass. Its tests are the two swaps in `stop-order-probe.mjs`, and `debate-then-build` swapped the other way, which must stay a tightening.

**2 · `experiments/brakes/budget/README.md` (F2), a dated note; the pre-registration's text is not changed.**

> *Note, 2026-10-06, before any run:* the second harness showed that a command can print the check's line without running the check (`node -e` decoding it; a helper reading a log), and the counter counts it as a run (audit 0001, round two, F2; `experiments/audits/0001-claims-as-of-0-3-0/tools/counter-replay-probe.mjs`). So "which no other program prints" is true of the task's own files and not of what a lead can write. The miscount only adds: it can make a run that stopped short read as at its budget, and cannot hide a run that went past. Until the counter is repaired, a verdict of `met` is read by a person against the commands that printed each line before it supports anything.

**The repair, proposed and not built:** a line of the check's counts as a run only in the result of a command the counter can place as a run of the check's file (it already has `checkIn`). The line in any other command's result makes the run `not judged`, and a person reads that command. Two cases for its tests: the replay at budget 2, and one real round followed by replays at budget 6.

**3 · `experiments/comparisons/README.md`, line 100 (F3).**

- Old: "**The design, in all three of its forms, ended above no design in every project, by a range wholly above the other:**"
- New: "**On the author's held-out suites, the design in all three of its forms scored above the task alone in every project, in both replicates:**", and after the figures: "The two blind judges of the code projects ranked the task-alone outputs higher. This did not separate the effect of the structure from the extra evidence a reviewer held."

The sentence to publish, if study two is published, is Codex's:

> On three small tasks designed to need feedback, the package and both prose review arms scored higher than the task-only arm on the author's hidden suites or reference checks, in both replicates. The package and prose arms matched on those scores, and the package cost more than single-session prose. The code-project judges ranked task-only outputs higher. This did not isolate the effect of structure from the extra evidence.

**4 · `docs/decisions/0029-…`, point 3, a dated clarification (F3).**

> *Clarification, 2026-10-06, from the audit's second round (F3):* "ended above the task alone" means scored higher on the author's held-out suites and reference checks. The two blind judges of the code projects ranked the task-alone outputs higher. The text above is left as signed.

The same four words, "on the held-out suites", belong after "ended above the task alone" in `experiments/comparisons/roles-or-information/README.md` line 9, `handoffs/briefs/study-three-on-paper.md` line 102 and the comment at the head of `scripts/lib/compare-arms-ef.mjs`. The first is a pre-registration: a dated note there, not an edit.

**5 · the cost page, "Who was given what", the held-out row (F4; pull request #106).**

- Old: "Named to the reviewer only. A copy sits beside the project and the session's rules allow reading it, so a builder is kept from it by instruction and not by the harness."
- New: "Only reviewers were told they may read it. The package's builder files also name its path, with the instruction not to read it; three of the six leads took that line out of their working copy. A scan found no builder read that names the path. A copy sits beside the project and the session's rules allow reading it, so a builder is kept from it by instruction and not by the harness."

**6 · the cost page (F5; pull request #106).**

- Old: "**On the mean, all of it is the lead.**" New: "**On the mean, nearly all of it is in the lead.**"
- Old: "That +$0.524 is the whole difference". New: "That +$0.524 is a little more than the whole difference of +$0.516, since the subagents cost $0.008 less a run in A".
- Old: "and unasked the graph (8,400) and both agent files (6,700)". New: "and, without being told to in so many words, the graph (8,400) and both agent files (6,700); the brief asks a dispatch prompt to carry a node's declared inputs, which are written only there".
- Old: "The graph document and the agent files, which nothing tells the lead to read". New: "The graph document and the agent files, which the brief does not tell the lead to read in so many words".
- Old: "**It prices the record. It does not say what the record is worth.**" New: "**It sorts the lead's cost by what each call did, under the rules stated. It does not isolate what the record costs, and it does not say what the record is worth.**"

**7 · `experiments/comparisons/README.md`, line 98 (F6).**

- Old: "**Every loop turned, once, and the turn changed the result.**"
- New: "**All 18 runs with a reviewer record a second pass after first-pass gaps were reported. Two kept first-pass trees, scored again, are below their final results.**"

**8 · `experiments/comparisons/README.md`, line 104 (F7).**

- Old: "**No brake fired, and study two shows nothing about bounding.**"
- New: "**No round cap or budget is recorded as firing, and study two shows nothing about bounding. Four package runs halted at their human merge gates.**"

`handoffs/0019-comparison-study-two/HANDBACK.md` says the same and is a record: it is left, and this file is the pointer.

**9 · the status sentence (F8). The owner's choice; see the card.** If changed, the lane proposes the first sentence only:

- Old: "Each of the twenty templates has a recorded run: eighteen pass the project's checks and two are published red."
- New: "The latest kept run of each of the twenty templates is counted: eighteen pass the project's checks and two are published red."

and, where there is room (the README, the field guide, the report): "Seven earlier runs are kept beside them; six of those fail their check."

**10 · the loop-length warning (F9).**

- `apps/web/src/ui/landing/Landing.tsx` line 135. Old: "The validator refuses a loop without one and warns when a loop has no cap." New: "The validator refuses a loop without one, and warns when a loop has no budget and either no cap or a cap above five rounds."
- `docs/report/grooph-technical-report.md` line 50. Old: "A loop with no cap draws a warning". New: "A loop with no budget draws a warning when it has no cap, or a cap above five rounds".

**11 · `Landing.tsx` line 144 (F10).**

- Old: "A halted run goes on when a person answers."
- New: "To go on, a halted run is resumed in the same session with the person's answer."

**12 · the three surfaces (F11).**

- `Landing.tsx` line 63. Old: "Works on a phone". New: "Built for a phone's screen".
- The report, line 29. Old: "small enough for a model to read and rewrite in one pass". New: "designed to be small: the validator warns above 24,000 characters in canonical form, not counting layout".
- `patterns/red-team-loop.grooph.json`, description. Old: "The builder sees only the traces, not the attacker's reasoning." New: "The builder is handed the traces and is told to read nothing else of the attacker's."
- `patterns/tournament-then-judge.grooph.json`, description. Old: "A frontier judge sees only those finalists". New: "A frontier judge is handed only those finalists".

The two descriptions are in templates: changing one raises its version and regenerates the index, so they are the house lane's to make.

**13 · who allows, and how far the comparison reaches (F12).**

- `docs/graph-ir.md` line 192. Old: "`grooph adopt` refuses a working copy that has loosened one until the person asks for that change by name". New: "`grooph adopt` refuses a working copy that has loosened one until whoever runs the command asks for that change by name (`--allow`); an agent can, and is told to put it to the person first".
- `docs/claims.md`, row C45. Old: "the comparison also holds a check's command and where its verdicts lead". New: "the comparison also holds a change to a check's command or pass rule and to the edges that leave it". And added: "The name can be given by whoever runs the command, an agent included; the app offers no way to give it."
- `docs/templates.md` line 64. Old: "a brake cannot be shed by doing in two changes, or under a new id, what one change under the". New: "the comparison is not got round just by doing in two changes, or under a new id, what one change under the", with, at the paragraph's end: "It does not see everything: `runs.md`, 'What adoption does not hold', lists what it lets through."

**14 · `experiments/brakes/budget/README.md` (F13, F14), a dated note.**

> *Note, 2026-10-06, before any run:* two things this page says more firmly than it can (audit 0001, round two, F13 and F14). **The prose pair is not the same budget.** Its judge accepts N node runs, or N builder dispatches with a check after each, so a prose run at 2 may make four node runs and pass where a package run making four fails. It tests which reading a lead takes of the derived words. It cannot show that the package holds the same budget better. **The contradicting example is not known to be harmless.** "Three plain statements against one example" is a guess about what a lead will do. This pair tests the brief as compiled, example and all: an overrun is still a failed outcome whose cause is not isolated, and a pass shows a lead following the number despite the example, once.

In `round-02/HANDOFF.md`, S8, the lane wrote that the dropped definition "changed no result" because no budget fired. No budget is recorded as firing; whether a stated limit shaped a lead's choices is not known. The handoff is a record and is left; this is the correction.

**15 · the beginner's guide (F15, F16, and chapter 5).** The guide is on main and not on the site.

- `01-starting-from-nothing.md` line 42. Old: "with its own empty context". New: "with a context of its own: it does not get the first session's conversation, but it has its own standing instructions and can read the files it is allowed to".
- The same, line 46. Old: "A subagent knows only what it was handed." New: "A fresh subagent starts without the conversation that came before it."
- The same, line 132, the table row. Old: "A subagent starting with an empty context | The harness | Real. What it is then handed is up to the lead". New: "A fresh subagent starting without the lead's conversation | The harness | Real for a fresh worker in Claude Code. It still has its own instructions and can read what it is allowed to; what it is handed is up to the lead".
- `glossary.md` line 35. Old: "with its own empty context". New: "with a context of its own, which does not hold the first session's conversation". Line 55. Old: "starts with an empty context (`fresh`)". New: "starts without the earlier conversation (`fresh`)".
- `02-the-graph-document.md` line 109. Old: "the next worker starts with an empty context: its brief, its inputs, the evidence, and nothing more". New: "the next worker starts without the conversation so far: it is handed its brief, its inputs and the evidence, and is told to read nothing else".
- `13-what-the-experiments-found.md` line 97. Old: "While a session is running, nothing in grooph watches it or can stop it. What force there is during a run is the harness's: each subagent's tool list and empty starting context". New: "While a session is running, grooph can show what it records (the hook's events and the lead's notes, in the live view) and can stop nothing. What force there is during a run is the harness's: each subagent's tool list and, for a fresh worker, a start without the lead's conversation".
- `README.md` line 11. Old: "grooph's work ends when the instructions are written, and begins again when the agents are finished and you want to see what they did." New: "grooph's work on the plan ends when the instructions are written. While the agents work it can show you what they record, and afterward what they did. It controls none of it."
- `13-…` line 30. Old: "In one, a step that should have been its own subagent never ran as one." New: "`gauntlet-decomposed` halted where its plan told it to ask a person, before its last two steps. Its check fails all the same: several things it looks for assume those steps ran, and the record of one change the run made to its plan does not replay."
- `13-…` line 19. Old: "keep the whole record". New: "keep the record: the harness's output, the run folder and the cost".
- `05-the-package.md` line 5. Old: "An agent cannot run a plan written as JSON any more than a builder can pour concrete from a blueprint's file format. Something has to turn the plan into instructions in the form the harness expects." New: "A harness has its own form for instructions: agent files, a skill, a prompt to start from. Compiling writes the plan out in that form."
- `07-adopting-a-run.md` line 115, after "or where a new arrow goes around the check": "Not every such arrow is caught; the list below says which are not."
- `14-claims-and-the-audit.md`, where it says "If you ever find a sentence that says more than its row, the row is right": "A row is the project's reading at a date. Check it against its evidence and the version, as the audit does."

## For the review desk

The desk is the driver's to write. These are the decisions that are the owner's, in plain words.

**Card 1 · A gap in the brake check, found by the audit and still in 0.4.0**

A plan can have two limits on one loop: one that stops the run, and one that sends it on to the next step. If both come due together, the one written first wins. Swap the two and a run that should have stopped is told to carry on and finish. grooph's check for loosened brakes does not notice the swap, in `grooph adopt` or in `grooph export`. It does notice a new limit being added, so a run cannot set this up by itself: the plan has to hold both limits already. None of the twenty built-in templates is exposed. No run is known to have done it.

- A. List it as a known limit now, and fix it after the pause. **Recommended.** The limit is in a small pull request already.
- B. The same, and add a line to the 0.4.0 release notes too.
- C. Fix it before anything else.

**Card 2 · The budget experiment's counter can be fooled by a printed line**

The parked experiment counts how often the test ran by looking for a line the test prints. A command that only prints that line is counted as a test run. So a run that stopped early could be scored as having reached its budget. It cannot make a run that went past its budget look good. Nothing has been run with it.

- A. Repair the counter and add a dated note to the plan, before any paid run. **Recommended.**
- B. Keep the counter, and have a person read every passing result.
- C. Leave it; the experiment is parked.

**Card 3 · Study two: say what the scores are scores of**

Study two's headline says the designs "ended above" the task done alone. That is true on the tests the author wrote and kept hidden. Two blind judges, shown the code, preferred the task-alone results. Both facts belong in the sentence.

- A. Take the auditor's sentence as the one to publish, and add a dated note to decision 0029. **Recommended.**
- B. Keep study two unpublished for now.
- C. Other words of yours, which then need one more reading by the auditor.

**Card 4 · "Eighteen of twenty": say which runs are counted**

The count uses the newest kept run of each template. Seven older runs are also kept, and six of them fail. The short sentence does not say so; the field guide does.

- A. Change the first sentence to "The latest kept run of each of the twenty templates is counted", everywhere it stands, and add the older runs where there is room. **Recommended.**
- B. Leave the sentence, and add the rule only in the README and the field guide.
- C. Leave it all as it is.

**Card 5 · Accept the wording corrections as listed**

Corrections 5 to 8 and 10 to 15: the cost page, the comparison write-up, three lines on the front page, the report, two template descriptions, three sentences in the documents, a dated note on the budget plan, and thirteen sentences of the beginner's guide. Each says less than it did, and each is in the auditor's words or close to them.

- A. Accept them all. **Recommended.**
- B. Accept them all but the ones you name.
- C. Hold them.

**Card 6 · The beginner's guide and study two stay unpublished until a short third round**

The auditor read five of the guide's fourteen chapters. Two repairs (cards 1 and 2) do not exist yet.

- A. Keep both off the site through the pause. Afterward, one short round: the two repairs, the nine chapters not yet read, and the corrected five. **Recommended.**
- B. Publish the guide after correction 15 with a line saying five of fourteen chapters were read by the second harness.
- C. No third round; close the audit when the corrections are made.

## Is a third round needed?

Not to settle this one: nothing is disputed. One is needed later, and it is short. Three things should not be published or relied on unread: a repair to the comparison (F1), a repair to the counter (F2), and the nine guide chapters Codex did not read. If the owner takes the auditor's own sentence for study two, that sentence needs no further reading.

### The prompt to carry, when the repairs exist

```text
Round three of audit 0001, and a short one. Read
/Users/noir/Documents/grooph-exchange/codex/0001-claims-as-of-0-3-0/round-03/HANDOFF.md
and the snapshot it names. Three things only.

1. The stop-order repair (round two, F1). Run your own stop-order probe and the lane's
   (experiments/audits/0001-claims-as-of-0-3-0/tools/stop-order-probe.mjs and
   stop-added-ahead-probe.mjs) at the new snapshot. A swap of a halting stop and a leading-on
   stop must be refused at grooph adopt and at grooph export, for equal budgets and for a cap
   with a budget. Then attack the repair: three stops, a stop moved across a bar-passed stop, a
   reorder that only tightens (debate-then-build), and anything the new rule refuses that it
   should not.

2. The counter repair (round two, F2). Run your replay probe and the lane's
   counter-replay-probe.mjs. A line of the check's printed by a command that did not run the
   check must not yield met. Then look for a producer the new rule still accepts.

3. The beginner's guide. Read the nine chapters you did not read in round two
   (2, 3, 4, 6, 8, 9, 10, 11, 12) and the corrected sentences in chapters 1, 5, 7, 13 and 14,
   against the product at the snapshot.

Change nothing in the snapshot or the repository. Start no model session and no experiment; the
paid runs stay parked. End with a handback in the template's form and a prompt to carry back.
```
