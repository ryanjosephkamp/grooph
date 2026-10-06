# Audit 0001-claims-as-of-0-3-0 · round 02 · reconciliation

**By:** the audit lane (Claude Code, Opus 5.5) · **For:** the owner · **Date:** 2026-10-06 · **Handback:** [`HANDBACK.md`](HANDBACK.md) (Codex, GPT-6.1 Sol, written 2026-10-06; 16 findings), with its notes in [`notes/`](notes/)

The owner carried Codex's prompt back on 2026-10-06 at 11:20 ET. One carry out, one back, for this round.

Codex read snapshot `faba78aeff36e9aca5c02c8e726086cbe10191f5` and the cost page's four files at `980bcb6`. Since then grooph 0.4.0 was published and merged (tag `v0.4.0`, `e8055fa7`), so three pull requests Codex could not read are on main: #142 (a halting stop made a success), #127 (the Codex target) and #60 (export compares brakes). Every command below was run twice where a command settles the finding: at the snapshot, and at 0.4.0.

**What "at 0.4.0" means here.** The lane ran the source at tag `v0.4.0`, built on this Mac. It did not run the package from npm: fetching one is a download, and that needs the owner's own word in the lane's session, which a message from the driver is not. The registry's entry was read without a download ([`lane-notes/reconcile/npm-view-0.4.0.json`](lane-notes/reconcile/npm-view-0.4.0.json)): the published `grooph@0.4.0` names commit `04587958`, and the tag is that commit plus one merge that changes nothing under `packages/`, `patterns/`, `plans/` or the counter.

**This file was corrected by a fresh reader before it was final.** One reader with no context was asked to judge the lane's judgments ([`lane-notes/reconcile/fresh-reader/REPORT.md`](lane-notes/reconcile/fresh-reader/REPORT.md), with its probes). It refuted two things the lane had written: that a new stop put beside a halting one is always refused, and that a printed line can only add to the counter's count. Both are corrected below, and the lane ran each case again with probes of its own. Its seven smaller points are taken too.

## Where the two sides stand

Codex returned 16 findings. The lane **agrees with all 16** and disputes none. On F8 it agrees with a reservation, given in the table.

**Two findings are faults in what exists, not in words.** Both reproduce, and both turned out wider than Codex found them.

**F1, in the product, and still so in 0.4.0.** The check grooph makes when a changed graph is taken up, at `grooph adopt --write` and at `grooph export --into` over a package, does not hold a loop's stops in two ways.

- *A reordering* (Codex's finding). A loop holds a limit that halts and a limit that leads on, and both can come due on the same pass. The contract says the first in document order wins. Swap them, and at the count where the source halts, the copy goes on. Adopted and exported with nothing refused. It does not need two equal budgets: a cap of one round and a budget of that round's dispatches swap the same way. The fix that merged after the snapshot (#142) does not close it.
- *A new stop of a kind the loop did not have* (the fresh reader's finding; the lane had said the opposite). A loop holds only a budget that halts. A copy adds a round cap that leads on to the end, ahead of the budget or behind it. Where no check and no critic stands before the place the new stop leads, it is adopted with the line "tightens a brake, and is adopted with the rest", and exported with "none of the brakes it compares was removed or loosened". A stop on diminishing returns goes through the same way, with no label.
- *The cause*, as the reader read it and the lane confirmed: `looser` in `packages/core/src/brakes.ts` walks the kinds of stop the source had. A kind the copy adds is never asked about. For a kind both have, it reads each stop's size and where it leads, and not their order.
- *What is held.* A new leading-on stop of a kind and size the loop already has is refused ("would fire as soon as the one … that halts the run"). Any new leading-on stop is refused where a check or a critic stands before the place it leads ("a way that does not pass the check"). The lane's first four cases were all of that second sort, which is why it took the rule for wider than it is.
- *The built-in templates and the plan templates.* Each of the 24 documents was filled from its slots' own examples, and each of its 26 loops was asked two things at 0.4.0 (`tools/stops-in-built-ins-probe.mjs`). No loop holds a halting limit ahead of one that leads on, so no swap in them turns a halt into going on. And 1,306 new leading-on stops were tried: nine kinds of stop, leading on to each node of the graph in turn, put just ahead of the loop's first halting limit. 84 were not refused, and none of the 84 leads on, with nobody asked, to a place no stop of the loop already led: 69 are stops where a person is asked and the run goes on (the owner's earlier ruling: named, not refused), 8 lead to a human gate (the literature review plan's search loop, to its own gate), and 7 lead where a cap of `debate-then-build` already leads (a limit `docs/runs.md` already lists). That is what was tried; it is one stop added in one place at small sizes, not a proof.
- *The lane's first scan of the templates was wrong, for a reason it could not see.* It compared the templates as they are. Adoption refuses a template outright, and the probe counted that as the brake being held. The probe now fills each template first, and stops if adoption refuses a copy for any reason that is not a brake.

**F2, in the parked budget experiment's counter, which is unchanged.** The counter takes a line of the check's in a command's result as a run of the check, unless the command holds the line itself or is one of a list of commands that "only print". That fails both ways.

- *It counts what did not run* (Codex's finding). A command that decodes and prints the line is counted: one real node run reads as two at a budget of 2, four as six at a budget of 6, and the verdict is `met`.
- *It misses what did run* (the fresh reader's finding; the lane had said this could not happen). `awk` and `git` are on the "only print" list, and each can start a program (the reader ran both; the lane ran `awk`). The check started through `awk` really runs and is filed as "printed back", which no verdict reads: three real node runs at a budget of 2 read as two, eight at a budget of 6 read as six, and the verdict is `met`. A run past its budget can pass.
- A real check whose command also holds the line makes the run `not judged`. In the prose form, one replayed line turns dispatch, check, dispatch into `met` under the plain reading.

The counter is not in the npm package. It stands in the repository beside the paid runs, which stay parked, and nothing has been judged with it.

**The rest is wording, and the lane wrote much of the wording.** The guide's "empty context" and "nothing in grooph watches", its account of Gauntlet's failure, the handoff's own "no brake fired", "the same budgets as prose" and "it changed no result" were the lane's sentences or ones it passed on unchallenged. Codex is right about each.

Nothing in Codex's sixteen is disputed. What remains is the owner's: the words below, and when the two repairs are scheduled.

## What was run again

No model session was started and no experiment was run. Each probe reads and writes files only. Scripts are in [`../tools/`](../tools/); what each printed is in [`lane-notes/reconcile/`](lane-notes/reconcile/), once at the snapshot and once at 0.4.0.

| Finding | Probe and case | At the snapshot (0.3.0, `faba78ae`) | At 0.4.0 | In what a person can install today |
|---|---|---|---|---|
| F1 | `stop-order-probe.mjs`: two equal budgets swapped | adopted, exit 0, version 2 written, nothing refused | the same | **still so** |
| F1 | the same: a cap of 1 round and a budget of 2 dispatches swapped | adopted, exit 0 | the same | **still so** |
| F1 | the same, at `grooph export --into` over a package in place | exit 0 (export compared nothing then) | exit 0, "none of the brakes it compares was removed or loosened"; the package's brief now lists the leading-on stop first | **still so**, at the second door |
| F1 | the same, control: the halting budget raised from 2 to 4 | refused, exit 1, nothing written | refused at both doors | held |
| F1, wider | `stop-added-ahead-probe.mjs`: no check or critic before the end; a new cap of 1 round that leads on, ahead of the halting budget | adopted, exit 0, called a tightening | the same; export exit 0 | **still so**, at both doors |
| F1, wider | the same cap put behind the budget; a new diminishing-returns stop ahead | adopted, exit 0 | the same; export exit 0 | **still so** |
| F1, wider | control: a new budget of the same kind and size that leads on | refused | refused at both doors | held |
| F1, wider | a check stands before the end; a new cap that leads on | refused: "a way that does not pass the check" | refused at both doors | held |
| F1 | `stops-in-built-ins-probe.mjs`: every loop of the built-in templates and plans | 20 loops; none with a halting limit ahead of one that leads on; 883 new stops tried, 51 not refused, none of them led with nobody asked to a new place | 26 loops; none; 1,306 tried, 84 not refused, none of that sort | not exposed, as far as tried |
| F2 | `counter-replay-probe.mjs`: Codex's replay at budget 2; one real round and two replays at budget 6 | counted 2 for 1 real; 6 for 4 real; `met` | the same (the file is byte for byte the same) | not in the package |
| F2 | the same: the check started through `awk`, as a third node run at budget 2; twice more at budget 6 | counted 2 for 3 real; 6 for 8 real; `met` | the same | not in the package |
| F2 | the same: a dispatch past the budget, then a replay | `not met` | the same | not in the package |
| F2 | the same line printed by `cat`, or written out in the command | `not met`, `not judged` | the same | not in the package |
| F9 | `capless-loop-probe.mjs`: no cap, a budget of 100,000 dispatches | no warning | no warning | **still so** |
| F12 | the control above, with `--allow loop:work.stops` (Codex ran it: [`notes/allow-by-name.txt`](notes/allow-by-name.txt)) | written for whoever gives the name | not run again; `grooph export --help` now tells an agent to add `--allow` "only for the ones they said yes to" | **still so**: an instruction, not a lock |
| F12 | `grooph adopt --help`, on "a budget" | says "a budget" loosely | says "a loop's round cap and budget" and that the graph's own budget line is not compared | **closed** in 0.4.0 |
| F11 | the three surfaces, read on main | as Codex found | `Landing.tsx:63`, report line 29, and the two template descriptions are unchanged | **still so** |

## Finding by finding

| Finding | Claim | Codex says | We say | Why | Proposed correction | New experiment? |
|---|---|---|---|---|---|---|
| F1 | Part E; C45 | Reordering two stops that fire together turns a halt into a success, and adoption does not refuse it | **agree**, and it is wider | Reproduced at both commits and both doors. The contract is plain: stops are tried "in document order; the first that fires wins" (`graph-ir.md` §2), and the compiled brief prints them numbered. A new stop of a kind the loop lacked goes through too, as above | 1 (a limit, added by the lane in its own small pull request); a repair, proposed; 16 | no |
| F2 | Part D; the counter | A printed line counts as a run of the check | **agree**, and it fails both ways | "Counted from its own trace" says more than the counter does: the trace is a line of output, and neither its producer nor its absence is shown. The lane first wrote that the miscount only adds; the reader showed a real run that is not counted | 2 (a dated note and a repair, proposed) | no; the pair stays parked |
| F3 | S3; decision 0029 point 3 | "Ended above the task alone" must name the measure | **agree** | The scores are on the author's held-out suites. The two blind judges of the code projects, who were given what the builder saw and not the suite, ranked the task-alone outputs first. The lane's handoff carried both facts and still passed the sentence on | 3, 4 | no |
| F4 | S5, S7; the cost page | "Named to the reviewer only" is false of the builder's declared inputs | **agree**, and Codex's own sentence needs one more word | All six package builders' agent files list the held-out path under their inputs, say a builder may inspect its declared inputs, and also say not to read it. So "only reviewers were authorized" is not quite right either: the file grants and forbids | 5 | no |
| F5 | S7; C51 | The allocation does not price the cause | **agree** | The lead's difference ($0.524) is more than the whole difference ($0.516), so "all of it" is loose by its own tables. "Nothing tells the lead to read" overlooks that the brief asks a dispatch prompt to carry inputs written only in those files, which the page's own Table 10 says | 6 | no |
| F6 | S2 | A second pass is recorded in all 18; a measured improvement in two | **agree** | The write-up already says "how far that is shown and how far it is reported differs by arm". Its heading says more than that paragraph does | 7 | no |
| F7 | S4 | Human gates are brakes, and four fired | **agree** | By amendment A-008 a gate is a brake. Four package runs halted at their merge gates (`notes/stops-fired.txt`). "No brake fired" was the lane's heading for S4 | 8 | no |
| F8 | A1; decision 0029 | "Eighteen of twenty" counts the latest kept run of each | **agree**, with a reservation | The short sentence does not say which runs are counted, and seven earlier runs are kept, six failing. The reservation: the sentence is true as written and the field guide gives the rule beside it, so this is how much to say in one line and not an error. The lane recommends Codex's change all the same | 9 (the owner's choice) | no |
| F9 | A2, A4 | The warning needs "no budget" too | **agree** | Reproduced at both commits: a loop with no cap and a budget of any size draws no warning | 10 | no |
| F10 | A2; C47 | An answer does not resume a run by itself | **agree** | The recorded continuations resume the same session with the answer | 11 | no |
| F11 | C46, C50 | Three surfaces still promise more than is shown | **agree** | All three stand on main at 0.4.0 | 12 | no |
| F12 | Part E; C45 | Whoever runs the command can allow a change; coverage is selective | **agree** | The name is given by a flag. "The person asks" is the rule the brief states, not what the command can know. One part is closed in 0.4.0 (the help text on "a budget") | 13 | no |
| F13 | S8; Part D | The prose pair allows two workloads | **agree** | The pre-registration says so in its own bullet, under a heading that says "the same budgets" | 14 | no; a prospective choice |
| F14 | S9, S10; Part D | The brief's example contradicts a budget of 2 | **agree** | The pre-registration names the contradiction and then calls an overrun from it unlikely. That is a guess | 14 | no |
| F15 | Part F, chapters 1 and 13 | "Empty context" and "nothing watches" misteach | **agree** | `grooph watch`, the hook and the live view do watch. A fresh worker still has its own instructions and can read what it is allowed. Both sentences are the lane's | 15 | no |
| F16 | Part F, chapter 13 | Gauntlet halted where it was told to | **agree** | The counted run's record: `stop_fired: ["human"]`, three subagents ran, and the integrator, the final critic and the release gate were not reached. The guide's sentence repeats the checker's reason and hides that | 15 | no |

### Beside the sixteen

- **Decision 0029** is faithful (Codex, Part C). It needs dated clarifications, not rewriting; their words are correction 4 and correction 17.
- **The author's six questions on Part E.** Codex's answers are accepted as limits to keep naming, and most are already in `docs/runs.md`. One is new and small: where a node is reached only by a loop stop's `then`, the comparison treats it as a start and explains a refusal with "a run would start there", which is not true of it. That is a wrong reason on a right refusal; it goes to the house lane with F1's repair.
- **Four things Codex checked that the lane takes as it gave them.** The one `metric-sandwich` case shows "no loss detected", not "harmless", and the lane will use Codex's phrase. Sixty of the 110 saved outputs of the eight readers' scripts no longer match what the scripts print: they are records of their day, not current goldens, and are left. The registrations' order rests on local history and the runs' own start times; nothing here timestamps the push to the remote. The budget pair's two packages differ in five lines, each a statement of the budget, where the design says "one sentence": one manipulated variable, said five times.
- **Not read by a second harness, and not in this round:** the comparison as `grooph export` makes it (`packages/cli/src/commands/export.ts`, new since the snapshot) and the Codex target (#127). The lane probed export for F1 and nothing else of it.
- **Two of the lane's own tools.** `irreversible-entry-probe.mjs` ended on a sentence that pull request #133 made untrue; it is corrected in this pull request. `adopt-probe.sh` says it shows the override and does not run it; Codex ran it separately, and the tool is left as it was run.
- **Chapter 5's opening**, "An agent cannot run a plan written as JSON": correction 15.

## Proposed corrections, word for word

None of these is made on the lane's or the auditor's authority, but for correction 1, which the driver asked the lane to make as a limit added. Old words are as they stand on main at 0.4.0, or in pull request #106 for the cost page.

**1 · `docs/runs.md`, "What adoption does not hold" (F1). Added by the lane, in its own pull request.** One new item, the stops of a loop, saying both cases at both doors and that the output calls the wider case a tightening; and one clause in `docs/claims.md`, row C45.

**The repair, proposed and not built** (the house lane's; the owner's card q58 decides when): the comparison asks of a loop's stops what a run would do, not what sizes they have. For every stop that leads on in the copy, of any kind, old or new: can it fire no later than a stop that halted in the source, and does the copy put it ahead? If so it is a loosening by name (`loop:<id>.stops`), since a cap, a budget and a count of rounds without progress can come due on one pass. A kind the source did not have is asked about like any other. Its tests are the two swaps in `stop-order-probe.mjs`, the three open cases in `stop-added-ahead-probe.mjs`, and `debate-then-build` swapped the other way, which must stay a tightening. The label "tightens a brake" should not print on a stop that leads on.

**2 · `experiments/brakes/budget/README.md` (F2), a dated note; the pre-registration's text is not changed.**

> *Note, 2026-10-06, before any run:* the counter's count of check runs can be wrong in both directions (audit 0001, round two, F2; `experiments/audits/0001-claims-as-of-0-3-0/tools/counter-replay-probe.mjs`). A command can print the check's line without running the check (`node -e` decoding it), and it is counted. A command on the counter's list of those that "only print" can run the check (`awk` with `system`, a `git` alias), and it is not counted, so a run that went past its budget can read `met`. So "which no other program prints" is true of the task's own files and not of what a lead can write, and "counted from its own trace" says more than the counter does. Until the counter is repaired, no verdict of `met` supports anything: a person reads every command in the lead's record first.

**The repair, proposed and not built:** a line of the check's counts as a run only in the result of a command the counter can place as a plain run of the check's file (it already has `checkIn`). The line in any other command's result, and any command that names the check's file or could start a program and is not such a plain run, makes the run `not judged`, and a person reads that command. The "only print" list loses every program that can start another. Cases for its tests: the replay at budgets 2 and 6, the check through `awk` at budgets 2 and 6, a command that holds the line and runs the check, and the prose replay.

**3 · `experiments/comparisons/README.md`, line 100 (F3).**

- Old: "**The design, in all three of its forms, ended above no design in every project, by a range wholly above the other:**"
- New: "**On the author's held-out suites, the design in all three of its forms scored above the task alone in every project, in both replicates:**", and after the figures: "The two blind judges of the code projects, given only the visible task and the outputs, ranked the task-alone outputs higher. This did not separate the effect of the structure from the extra evidence a reviewer held."

The sentence to publish, if study two is published, is Codex's with five words added (in italics here):

> On three small tasks designed to need feedback, the package and both prose review arms scored higher than the task-only arm on the author's hidden suites or reference checks, in both replicates. The package and prose arms matched on those scores, and the package cost more than single-session prose. The code-project judges, *given only the visible task*, ranked task-only outputs higher. This did not isolate the effect of structure from the extra evidence.

**4 · `docs/decisions/0029-…`, point 3, a dated clarification (F3).**

> *Clarification, 2026-10-06, from the audit's second round (F3):* "ended above the task alone" means scored higher on the author's held-out suites and reference checks. The two blind judges of the code projects, given only the visible task, ranked the task-alone outputs higher. The text above is left as signed.

The same four words, "on the held-out suites", belong after "ended above the task alone" in `experiments/comparisons/roles-or-information/README.md` line 9, `handoffs/briefs/study-three-on-paper.md` line 102 and the comment at the head of `scripts/lib/compare-arms-ef.mjs`. The first is a pre-registration: a dated note there, not an edit.

**5 · the cost page, "Who was given what", the held-out row (F4; pull request #106).**

- Old: "Named to the reviewer only. A copy sits beside the project and the session's rules allow reading it, so a builder is kept from it by instruction and not by the harness."
- New: "Reviewers were told to read it. The package's builder files also list its path among the builder's inputs and tell the builder not to read it; three of the six leads took that line out of their working copy. A scan found no builder read that names the path. A copy sits beside the project and the session's rules allow reading it, so a builder is kept from it by instruction and not by the harness."

**6 · the cost page (F5; pull request #106).**

- Old: "**On the mean, all of it is the lead.**" New: "**On the mean, the difference is in the lead.**"
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
- New: "The latest kept run of each of the twenty templates is counted: eighteen pass the project's checks of selected parts and two are published red."

and, where there is room (the README, the field guide, the report): "Seven earlier runs are kept beside them; six of those fail their check."

**10 · the loop-length warning (F9).**

- `apps/web/src/ui/landing/Landing.tsx` line 135. Old: "The validator refuses a loop without one and warns when a loop has no cap." New: "The validator refuses a loop without one, and warns when a loop has no budget and either no cap or a cap above five rounds."
- `docs/report/grooph-technical-report.md` line 50. Old: "A loop with no cap draws a warning". New: "A loop with no budget draws a warning when it has no cap, or a cap above five rounds".

**11 · `Landing.tsx` line 144 (F10).**

- Old: "A halted run goes on when a person answers."
- New: "To go on, a halted run is resumed in the same session with the person's answer and its run id."

**12 · the three surfaces (F11).**

- `Landing.tsx` line 63. Old: "Works on a phone". New: "Built for a phone's screen".
- The report, line 29. Old: "small enough for a model to read and rewrite in one pass". New: "designed to be small: the validator warns above 24,000 characters in canonical form, not counting layout".
- `patterns/red-team-loop.grooph.json`, description. Old: "The builder sees only the traces, not the attacker's reasoning." New: "The builder is handed the traces and is told to read nothing else of the attacker's."
- `patterns/tournament-then-judge.grooph.json`, description. Old: "A frontier judge sees only those finalists". New: "A frontier judge is handed only those finalists".

The two descriptions are in templates: changing one raises its version and regenerates the index, so they are the house lane's to make.

**13 · who allows, and how far the comparison reaches (F12).**

- `docs/graph-ir.md` line 192. Old: "`grooph adopt` refuses a working copy that has loosened one until the person asks for that change by name". New: "`grooph adopt` refuses the changes its comparison flags until whoever runs the command asks for each by name (`--allow`). An agent can. The comparison does not flag everything (`runs.md` §5)".
- `docs/claims.md`, row C45. Old: "the comparison also holds a check's command and where its verdicts lead". New: "the comparison also holds a change to a check's command or pass rule and to the edges that leave it". And added: "The name can be given by whoever runs the command, an agent included; `grooph export` tells an agent to ask the person first, and the app offers no way to give it."
- `docs/templates.md` line 64. Old: "a brake cannot be shed by doing in two changes, or under a new id, what one change under the". New: "so that doing in two changes what one change would be refused for does not get past it by that alone. It does not see everything, a stop under a new id among the things it misses". The sentence's tail then needs the house lane's hand; the point is that "cannot be shed" goes, and that `runs.md` already lists "the same stop under another id" as adopted.

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
- `13-…` line 30. Old: "In one, a step that should have been its own subagent never ran as one." New: "`gauntlet-decomposed` halted where its plan told it to ask a person, before its last three steps. Its check fails all the same: several things it looks for assume those steps ran, and the record of one change the run made to its plan does not replay."
- `13-…` line 19. Old: "keep the whole record". New: "keep the record: the harness's output, the run folder and the cost".
- `05-the-package.md` line 5. Old: "An agent cannot run a plan written as JSON any more than a builder can pour concrete from a blueprint's file format. Something has to turn the plan into instructions in the form the harness expects." New: "A harness has its own form for instructions: agent files, a skill, a prompt to start from. Compiling writes the plan out in that form."
- `07-adopting-a-run.md` line 115, after "or where a new arrow goes around the check": "Not every such arrow is caught; the list below says which are not."
- `07-adopting-a-run.md`, in its list of what is still let through, a new item: "A loop's stops, in two ways: two limits swapped so that the one that sends the run on comes first, and a new limit of another kind that sends the run on. The program reads each limit's size and not their order, and it calls the second a tightening."
- `14-claims-and-the-audit.md`, where it says "If you ever find a sentence that says more than its row, the row is right": "A row is the project's reading at a date. Check it against its evidence and the version, as the audit does."

**16 · `docs/releases.md`, 0.4.0, a dated clarification under the two bullets on what export and adopt refuse (F1). Proposed; the notes of a published release are not edited.** Yes, one is needed: the second bullet says "a second harness has not yet read it", which is no longer so, and the first says "if a change may remove or loosen a brake … nothing is written", which a reader will take for more than the list in brackets.

> *Clarified, 2026-10-06, the day of the release.* A second harness has now read the comparison as it stood before this release (audit 0001, round two), and the audit found two things it does not hold in 0.4.0, at `grooph adopt` and at `grooph export` alike. Two limits of one loop, one that halts and one that leads on, can be swapped so that the run goes on where it would have halted. And a new limit of a kind the loop did not have, which leads on, is taken where no check or critic stands before the place it leads, and is printed as a tightening. Neither is refused. Both are in [runs](runs.md), under "What adoption does not hold". None of the built-in templates is open to either, as far as was tried.

**17 · `docs/decisions/0029-…`, two more dated clarifications. Proposed.**

Under point 6:

> *Clarification, 2026-10-06, from the audit's second round:* the sentence that the comparison "does not hold a check's command or where its verdicts lead" stopped being true that evening (pull request #132). A second harness has now read the comparison as it stood at `faba78ae`. It found the refusal real and its coverage incomplete (F1, F12), so what `grooph adopt` refuses stays described and is still claimed nowhere as shown.

Under point 1:

> *Clarification, 2026-10-06, from the audit's second round (F7, F8):* the twenty are the latest kept run of each template; seven earlier runs are kept, six of them failing. Human gates are brakes and did fire; what is not on record as firing is a round cap or a budget.

## For the review desk

The desk is the driver's to write. These are the decisions that are the owner's, in plain words. The gap in the brake check (F1) already has its card, q58, so there is none for it here.

**For q58's body, one line of what it must say:** the check misses two things at both doors, `grooph adopt` and `grooph export`: two limits of a loop swapped, and a new limit of another kind that sends the run on where no test or reviewer stands in its way, which grooph prints as a tightening; no built-in template or plan template is open to either as far as 1,306 tries show, and no run is known to have done it.

**Card A · The budget experiment's counter can be wrong both ways**

The parked experiment counts how often the test ran by looking for a line the test prints. A command that only prints that line is counted as a test run. And a test started in an unusual way is not counted at all. So a run that stopped early could be scored as reaching its budget, and a run that went past its budget could be scored as holding it. Nothing has been run with it.

- A. Repair the counter and add a dated note to the plan, before any paid run. **Recommended.**
- B. Keep the counter, and have a person read every command of every run before a result counts.
- C. Leave it; the experiment is parked.

**Card B · Study two: say what the scores are scores of**

Study two's headline says the designs "ended above" the task done alone. That is true on the tests the author wrote and kept hidden. Two blind judges, shown only the task and the code, preferred the task-alone results. Both facts belong in the sentence.

- A. Take the auditor's sentence, with five words added, as the one to publish, and add a dated note to decision 0029. **Recommended.**
- B. Keep study two unpublished for now.
- C. Other words of yours, which then need one more reading by the auditor.

**Card C · "Eighteen of twenty": say which runs are counted**

The count uses the newest kept run of each template. Seven older runs are also kept, and six of them fail. The short sentence does not say so; the field guide does.

- A. Change the first sentence to "The latest kept run of each of the twenty templates is counted", everywhere it stands, and add the older runs where there is room. **Recommended.**
- B. Leave the sentence, and add the rule only in the README and the field guide.
- C. Leave it all as it is.

**Card D · Accept the wording corrections as listed**

Corrections 5 to 8 and 10 to 15: the cost page, the comparison write-up, three lines on the front page, the report, two template descriptions, three sentences in the documents, a dated note on the budget plan, and fourteen sentences of the beginner's guide. Each says less than it did, and each is in the auditor's words or close to them.

- A. Accept them all. **Recommended.**
- B. Accept them all but the ones you name.
- C. Hold them.

**Card E · Two dated notes on what is already published**

The 0.4.0 release notes say a second reader has not yet read the brake check, and decision 0029 says the check does not cover a test command. Both stopped being true. Neither page is edited; each gets a dated note (corrections 16 and 17). The notes also say that the brake check stays "described, not shown": the second reader has now read it, and found it real and incomplete.

- A. Add the notes as written. **Recommended.**
- B. Add them with changes you name.
- C. Leave both pages as they are.

**Card F · A short third round, after the pause**

The auditor read five of the guide's fourteen chapters, and has not read how `grooph export` makes its comparison or the Codex target. Two repairs (q58 and Card A) do not exist yet.

- A. Keep the guide off the site through the pause. Afterward, one short round: the two repairs, export's comparison, and the nine chapters not yet read with the corrected five. **Recommended.** Study two needs no further reading if you take Card B, option A.
- B. Publish the guide after correction 15 with a line saying five of fourteen chapters were read by the second harness.
- C. No third round; close the audit when the corrections are made.

## Is a third round needed?

Not to settle Codex's sixteen: none is disputed. One is needed later, and it is short. Four things should not be published or relied on unread: a repair to the comparison (F1, with the wider case the lane's own reader found), a repair to the counter (F2, both directions), the comparison as `grooph export` makes it, which no second harness has read, and the nine guide chapters Codex did not read. The Codex target (#127) is a compile target and makes no claim that waits on this audit; it is named so that nobody thinks it was read.

### The prompt to carry, when the repairs exist

```text
Round three of audit 0001, and a short one. Read
/Users/noir/Documents/grooph-exchange/codex/0001-claims-as-of-0-3-0/round-03/HANDOFF.md
and the snapshot it names. Four things only.

1. The stops repair (round two, F1). Two cases must now be refused at grooph adopt and at
   grooph export: a halting stop and a leading-on stop swapped (equal budgets; a cap with a
   budget), and a NEW leading-on stop of a kind the loop did not have, ahead of or behind a
   halting one, where no check or critic stands before the place it leads. Run your own probe
   and the lane's (experiments/audits/0001-claims-as-of-0-3-0/tools/stop-order-probe.mjs,
   stop-added-ahead-probe.mjs, stops-in-built-ins-probe.mjs). Then attack the repair: three
   stops, a stop moved across a bar-passed stop, a stop moved between two loops over the same
   members, a reorder that only tightens (debate-then-build), and anything the new rule
   refuses that it should not. The label "tightens a brake" must not print on a stop that
   leads on.

2. The counter repair (round two, F2), in both directions. A line of the check's printed by a
   command that did not run the check must not yield met. A check started through awk or
   a git alias, or any other program on that list that can start another, must not go uncounted. Run your replay probe and the lane's
   counter-replay-probe.mjs, then look for a producer or a hidden run the new rule still
   accepts, in the package form and the prose form.

3. The comparison as grooph export makes it (packages/cli/src/commands/export.ts), which no
   second harness has read: when it compares, what it takes as the baseline, and each way the
   documents say it compares nothing.

4. The beginner's guide. Read the nine chapters you did not read in round two
   (2, 3, 4, 6, 8, 9, 10, 11, 12) and the corrected sentences in chapters 1, 5, 7, 13 and 14,
   against the product at the snapshot.

Change nothing in the snapshot or the repository. Start no model session and no experiment; the
paid runs stay parked. End with a handback in the template's form and a prompt to carry back.
```
