# Audit 0001-claims-as-of-0-3-0 · round 03 · handoff to Codex

**From:** the audit lane (Claude Code, Opus 5.5) · **To:** Codex (GPT-6.1 Sol, highest effort) · **Date:** 2026-10-06 · **Commit under audit:** `c1ff8f7fd6a7a90602e883970ae1cf7962575893`, which is `main` as it stood at 21:30 ET that day, with its CI passing by the driver's check · **Snapshot:** `/Users/noir/Documents/grooph-exchange/snapshots/0001-claims-as-of-0-3-0-round-03/`

> **Sent on 2026-10-06.** This is the handoff as sent. The driver said cut when the repair (#172), the sentence in the graph document (#173), the guide at 0.4.1 (#171), the section "Not yet released" of the release notes (#174) and this handoff (#169) were on main; the snapshot is main at that moment. Nothing else merges to main until the handback is in.

## What you are asked to do

Three things. As before: read as a skeptic, say where a sentence says more than its evidence carries, and attack our readings as hard as the claims. **Change nothing** in the snapshot or the repository. Start no model session and run no new experiment. You may run commands that read, and commands that write only inside a scratch folder of your own; every probe named here starts no model. **Give each probe a new, empty folder as its scratch: each one deletes its scratch folder before it starts.** Never give one your notes folder.

1. **The beginner's guide, all of it** (part G): fourteen chapters and a glossary. It is proposed for the site. You read five chapters in round two; this is the other nine, and the five as corrected.
2. **The repair of the stops comparison** (part H): the fault you found as F1, which turned out wider than you found it. The house lane (the session that works on the validator and the comparison) has changed the comparison to repair it, from round two's record. Say whether the repair holds, and whether it now refuses what it should not.
3. **The comparison as `grooph export` makes it** (part I). It is new since your snapshot in round two, and no second harness has read it.

## Since the last round

**The owner answered every card on 2026-10-06** (review desk, q58 to q64), and then accepted the plan in the driver's chat ("I accept your plan here. Let's do it.").

| Card | His answer |
|---|---|
| q58, the gap in the brake check (F1) | Repair it before the pause. That repair is part H |
| q59, the budget experiment's counter (F2) | Repair the counter and add a dated note before any paid run. The note is on main; **the repair is not built** |
| q60, study two's sentence (F3) | Your sentence, with five words added ("given only the visible task"), and a dated note on decision 0029 |
| q61, "eighteen of twenty" (F8) | "The latest kept run of each of the twenty templates is counted", everywhere it stands |
| q62, the wording corrections | All of them |
| q63, two dated notes | As written: on the 0.4.0 release notes and on decision 0029 |
| q64, a third round | Now, and it reads all fourteen chapters of the guide |

**Round two's corrections are on main**, 2 to 17 of [`round-02/RECONCILE.md`](../round-02/RECONCILE.md), in pull requests #163 (the dated notes), #164 (the comparison write-up), #165 (the status sentence), #167 (the warning's words, the front page, who allows), #168 (the guide) and two commits on #106 (the cost page). Correction 1, the limit in `docs/runs.md`, was #161. All of them merged on 2026-10-06, and with them #170, the same dated note in study two's three per-project write-ups, which carried the words of correction 3 too.

**One part of correction 12 was not made**, and you proposed as much in F11: the descriptions of two templates (`red-team-loop`, `tournament-then-judge`) still say "sees only". A template's description is compiled into the lead's brief, so changing one is a new version of the template, which the pattern test pins and a kept run is labeled by. The driver's word, 2026-10-06: both are left until each template's next authorized version, since proving a changed template again is a paid run. Row C46 of `docs/claims.md` reads "everything else is hidden" from a node as an instruction; it does not name these two templates.

**The lane was wrong three times in round two's reconciliation, and says so here because the first and the third bear on part H.** (The second is about the counter, which is not in this round.) Its first draft said that a new stop put beside a halting one is always refused; a fresh reader showed a case where it is adopted and called a tightening. It said a printed line can only add to the counter's count; the same reader showed a real check run that is not counted. And its first scan of the built-in templates reported nothing open because adoption was refusing every template for being a template. The record of all three is in `round-02/RECONCILE.md`, which is in your folder and in the snapshot, and in the snapshot at `experiments/audits/0001-claims-as-of-0-3-0/round-02/lane-notes/reconcile/fresh-reader/REPORT.md`.

**grooph 0.4.0 was published on 2026-10-06** (tag `v0.4.0`). It holds plans, a step that is a person's, export's comparison and the Codex target. Version 0.4.1 is being prepared with the repair of part H, and the version number is raised only at the release, after this round. So the snapshot calls itself 0.4.0.

## Part G · The beginner's guide

`docs/plain-english/`: a start page, fourteen chapters, a glossary and three pictures. It was written by the audit lane on 2026-10-05 for a reader who has never used an AI coding tool, and corrected by round two's correction 15. It was then brought up to version 0.4.1 in pull request #171: every command it shows was run again from a build of main, a short section on plans was added to chapter 4, and the sentences that the release and round two had made untrue were corrected. **The author did not read all fourteen chapters again sentence by sentence. That reading is this round's.**

It says of itself that it has not been audited and is not on the site. The words proposed for it once this round is reconciled are in pull request #168's description, copied into your folder as `round-03/sources/pull-request-168-description.md`. The site lane has prepared its pages in #166, which does not merge until then.

**What to attack.**

- **Every sentence about what grooph does to the quality, cost, speed or safety of work**, against `docs/claims.md`, decision 0029 with its dated clarifications, and the records under `experiments/`. The guide's rule for itself is that it claims nothing new.
- **Every command and what it is shown to print.** The start page says each was run in an empty folder. Run them at the snapshot; none starts a model. `python3 experiments/audits/0001-claims-as-of-0-3-0/tools/guide-commands.py <snapshot> <a new, empty scratch folder>` runs all of them in the guide's order and prints where an output differs from what the guide shows. It knows three things the chapters say in words (its head lists them), and it accepts shown output that is an excerpt: judge whether each excerpt is a fair one. It writes only in that scratch folder: among the guide's commands are `grooph adopt --write` and `grooph hooks install`, each in the scratch folder, and `grooph watch` on port 4369, which it stops after four seconds. **At the snapshot it reports two differences:** the guide says 0.4.1 in the two lines where a command prints the version (`grooph --help` and `grooph --version`), and the snapshot prints 0.4.0. Those two lines were set by hand to the version being released. The guide's start page says the output under each command is what was printed: say whether that sentence can stand beside two lines set by hand.
- **Every simplification a beginner would take literally.** In round two these were the costly ones: "empty context", "nothing in grooph watches". Look for their kin in chapters 2, 3, 4, 6 and 8 to 12.
- **The table in chapter 1, "What has force, and what is only an instruction".** It is the guide's central claim about the product, and each row is a claim.
- **Chapter 7's list of what the adoption check lets through**, against `docs/runs.md`, "What adoption does not hold", and against part H as it now stands.
- **Chapter 13's numbers**, against the ledgers: $41.12 for the twenty counted runs, 27 runs and $60.62 for the first comparison, the seven earlier runs.
- **The glossary**: each definition against the chapter that introduces the term and against `docs/GLOSSARY.md`.

**Where the author is least sure.**

- Chapters 6 and 7 do not run the guide's own example. They read kept records of the same templates on "very similar jobs", and a reader may take those for the example's own run.
- Chapter 11 on the hook and the sender: what a line holds, and what the sender carries beyond the hook's lines.
- Chapter 9, operation maps, is the chapter the author knew least.
- Chapter 12's list of commands is meant to be complete.
- The guide was written against 0.3.0 with that day's changes, and brought to 0.4.1 by running its commands again, not by reading every sentence again. Anything about plans, a person's step or `grooph export` comparing is newer than its first draft, and chapter 12 was found well behind (it said the MCP server had four tools; it has fourteen).
- The guide has always called a graph "a plan" in plain words. The product now has a narrower plan, which the guide calls "a plan for people". A beginner may not keep the two apart.

## Part H · The repair of the stops comparison

**What round two found** (F1, as reconciled): at `grooph adopt --write` and at `grooph export --into` alike, the comparison did not hold a loop's stops in two ways.

- *Two limits swapped* (yours). A limit that halts and a limit that leads on, both able to come due on one pass, swapped so that the one that leads on comes first.
- *A new limit of another kind* (the lane's fresh reader's). A loop that holds only a halting budget gains a round cap, or a stop on diminishing returns, that leads on, ahead of the budget or behind it. Where no check and no critic stands before the place it leads, it was adopted under "tightens a brake" and exported with "none of the brakes it compares was removed or loosened".
- *The cause*: `looser` in `packages/core/src/brakes.ts` walked only the kinds of stop the source had, and read each stop's size and where it led, not their order.

**What the repair was asked to do** (`round-02/RECONCILE.md`, correction 1): ask of a loop's stops what a run would do. For every stop that leads on in the copy, of any kind, old or new: can it fire no later than a stop that halted in the source, and does the copy put it ahead? If so it is a loosening by name. The label "tightens a brake" does not print on a stop that leads on.

**The repair** is pull request #172, by the house lane, merged on 2026-10-06 as `9d001f05`. One sentence went into `docs/graph-ir.md` §2 beside it (#173): a cap of n fires at the end of the nth pass, and a person asked every N rounds at the end of the Nth, the 2Nth and the 3Nth. It went through three heads, each read by one fresh reader of the driver's. Its description is the author's own account, copied into your folder as `round-03/sources/pull-request-172-description.md`, and `docs/runs.md`, under "What adoption does not hold", in the item that begins "A loop's stops are compared as a run fires them", has the words of record. **What follows, down to "The three readings", is what its author and the documents say it does. None of it is the lane's finding, but for what the lane's own probes printed against the snapshot when it was cut**, which is in your folder as `round-03/lane-at-the-cut/`. Run the probes yourself.

The author says a loop's stops are now compared as a run fires them (`leadsOnFirst` in `packages/core/src/brakes.ts`, beside `looser`).

**Protected, in the source:** a round cap or a budget that halts (it names no `then`, or one that is a human gate or a stop that halts), and every stop where a person is asked, with a `then` or with none, each time it would ask.

**Asked about, in the copy:** a stop that leads on with nobody asked: a cap, a budget, or a stop on diminishing returns or invalid evidence, whose `then` is a step or a stop that does not halt; and "bar passed", in a loop where no critic the loop had is still among its members.

**The question it asks:** is there a run in which the source would have halted or asked a person on some pass, and the copy leads on by that stop, on that pass or an earlier one? If so the change is held by the loop's name (`loop:<id>.stops`), whether the stop is new, moved, lowered or as it was.

**Also held:** a stop that leads on, among the stops of a second loop put on the same back edge, which that loop did not hold before; and "bar passed" with a `then` in such a loop that is new, whoever is among its members.

**A person's stop.** It ends nothing: the run is taken to go on from it as if the person had said so. So a person's stop in the copy excuses nothing that fires on a later pass. A person asked every n rounds is reckoned on the exact passes n, 2n and 3n. Lowered to a number that divides n, or to every round, it is a tightening; lowered to a number that does not divide n, it is held.

**What the comparison does not know it takes to be possible**: a budget may come due on any pass, since what a pass spends is not known.

**The label.** "Tightens a brake" is said of no change to a loop's stops that brings in a stop that leads on, changes one, or puts one ahead of a stop it stood behind. Such a change is listed as not judged. A stop whose `then` is a stop that halts is a halting stop and keeps the word. The sentence this changed, in the command's output: "not judged: an answer a gate did not give, a step marked irreversible that the graph did not have, or a stop of a loop that leads on, where it is new, changed or put ahead, lets a person or a run do what it could not before. A change that brings one is named here and not called a tightening, whatever else it does:". The app's run page carries the same sentence (`apps/web/src/ui/run/brakes.tsx`).

**What it costs,** in `docs/runs.md`'s figures, from the driver's reader's script on 4,000 random lists of stops changed by one honest edit at a time: a limit that leads on, lowered by one, is held in 558 of 747 where it is a budget, 282 of 507 where it is a round cap, and 371 of 486 where it counts rounds without progress; "ask a person every n rounds", lowered by one, in 100 of 1,185. Among the built-in templates, of 575 honest edits to a loop's stops one is held: `debate-then-build`'s cap of two rounds, lowered to one.

**Still not held, each said in `docs/runs.md`, and yours to judge by name:**

- "bar passed" in a loop that a critic judges, moved ahead of a limit that halts, or new;
- a new stop where a person is asked: named, not refused; and what a run does after a person has answered;
- a halting stop on diminishing returns or on invalid evidence (neither is on amendment A-008's list of brakes);
- a stop that leads on, where the loop has no stop that halts;
- **and one class, which the documents list as not held. Whether it should be is with the owner on the review desk (q66), unanswered when this was sent.** Where only a limit stands before an end, with no check, critic or gate, a new way to that end that is no change to that loop's stops is adopted: a plain new edge from a step of the loop straight to the end; a new stop that leads on in a loop inside the one that holds the limit, and in a loop around it (a loop's stops are asked only against its own, and against those of a second loop on the same back edge); a new step on the loop's round with a loop of one node of its own and a cap of one that leads on. Two questions for you: do the documents say this truly, and would a plain reader call it a loosened brake?

**A slow shape,** by the third reading's own measurement (`REPORT-3`, under "Time"): 40 loops on one back edge with 40 stops each takes 14 seconds to compare, and writes 12 MB of reasons.

**The three readings, and who found what.** The reader's three reports are in your folder for this round, under `driver-reader/`, word for word as it handed them back: `REPORT-1-first-head-ab0df981.md`, `REPORT-2-second-head-e9e5a108.md` and `REPORT-3-third-head-2cc780bc.md`. Its scripts and what they printed are beside them: the first reading's at the folder's top, the second's in `p2/`, the third's in `p3/`. None of it is in the repository. Read the reports themselves; what follows is the lane's summary of them.

- *The first reading*, of the first head, could not break the rule the repair states, and found nothing held on main let through. It found what still got through, on main too: one added stop where a person is asked laundering the repaired case, a source that asks every round losing its askings to a cap that leads on, and a person's continuing stop unprotected; "bar passed" with no `then`, in a loop no critic judges, swapped ahead of a cap or new; and the roads where only a limit stands before the end (a plain new edge to the end, a leading stop in an inner loop, a loop of one node). It also found the time growing about as the fifth power of a loop's stops, a reason hidden behind an older line, two kinds still printed under "tightens a brake", the documents' list incomplete, and two weak tests. (The second loop on the back edge, and "bar passed" with a `then` in a loop no critic judges, were the house lane's own in that first head, not the reader's.)
- *The second reading*, of the second head, found one thing held at the first head and let through by the last commit: a new second loop on the back edge of a loop a critic judges, with a looser bar of its own and "bar passed" with a `then`. It found an honest change newly held that should not be: "ask a person every n" lowered to a number that divides n. It found no stop that leads on printed under "tightens a brake" in 457,999 changes, and the opposite error: a limit that halts through a `then`, lowered or moved first, printed as not judged. And it found `docs/runs.md` saying a nesting is held that is adopted, three lines about a person's stop that mislead, and time still cubic where every stop draws a line.
- *The third reading*, of the third head, found nothing let through that should be held and nothing untrue in the documents or the label, confirmed each of the six things the second reading had found, and left one point for a ruling: `docs/graph-ir.md` did not say on which passes a person asked every N rounds is asked, which #173's sentence now does. Its own measurement is the slow shape named above.

These are another reader's evidence, as the lane's probes are: do not take their counts on trust. **Not all of its scripts can be run again from what you have.** `run-tools.sh`, `p2/batch.sh` and `p3/batch3.sh` name a worktree and a scratch folder on this Mac that are gone. `p2/fuzz2.mjs` and `p3/tri.mjs` compare builds of the first and second heads, and neither folder holds those builds. The scripts that take one build's root, `survey.mjs` among them, run against the snapshot. Say which you ran, and treat a count you could not reproduce as the reader's and not as shown.

**The question for you:** is anything a plain reader would call a loosened brake still adopted, through a loop's stops or around them? And do `docs/runs.md`, row C45 of `docs/claims.md`, and the section "Not yet released" at the head of `docs/releases.md` say exactly what is held and what is not? (There are no 0.4.1 release notes under that name until the release, which comes after this round.)

**What to run.** Each takes the snapshot's root, and each but the third a new, empty scratch folder of yours. The first two print the reason the comparison gives for each refusal. The third counts, and stops with an error if adoption turns a copy away for any reason that is not a brake.

- The lane's: `experiments/audits/0001-claims-as-of-0-3-0/tools/stop-order-probe.mjs`, `stop-added-ahead-probe.mjs` and `stops-in-built-ins-probe.mjs`. What they printed before the repair is in the snapshot at `experiments/audits/0001-claims-as-of-0-3-0/round-02/lane-notes/reconcile/`.
- The fresh reader's, in the snapshot: `experiments/audits/0001-claims-as-of-0-3-0/round-02/lane-notes/reconcile/fresh-reader/variants.mjs` to `variants4.mjs`. Each takes the root and a scratch folder, as the lane's do.
- Your own, from round two, in your folder: `round-02/notes/stop-order-probe.mjs`.

**What to attack.**

- **The two cases themselves**, at both doors, and through the app's Adopt and a subgrooph's refresh, which make the same comparison (read, if you cannot operate the app).
- **Shapes neither of us tried**: three stops; a stop moved across a `bar-passed` stop; a stop moved between two loops over the same members; a stop's kind or measure changed in place; a `then` changed in place; a stop that leads on to a node inside the loop.
- **Refusals that should not be.** Take a reorder that only tightens (`debate-then-build`'s cap and budget swapped): say whether it is adopted, and whether it only tightens. A rule that refused every change to a loop's stops would pass every probe above: say what honest changes this one now costs an `--allow`.
- **A stop where a person is asked that leads on.** The owner ruled in round two's day that this is named and not refused, since each lap is a person's decision. At the snapshot, 69 of the 77 new stops that `stops-in-built-ins-probe.mjs` finds unrefused are of this kind, and the other 8 lead to a human gate. (Before the repair it was 69 of 84.) Is that still what the code does, and is "each lap is a person's decision" true of a stop with a large `every`?
- **The reason on each refusal.** A probe whose good news is a refusal can pass for the wrong reason; the lane's did, twice. Where a copy is refused, say which rule refused it.

## Part I · The comparison as `grooph export` makes it

`packages/cli/src/commands/export.ts`, with the `grooph_export` tool of the MCP server, and what the documents say of them: `grooph export --help`, the last item of "What adoption does not hold" in `docs/runs.md`, the 0.4.0 release notes with their dated clarification, the section "Not yet released" above them, and row C45 of `docs/claims.md`.

**What the documents say.** Over a package already in place for the same graph id, the graph coming in is held to the brakes of the graph that package keeps, by the comparison adoption makes. A change that may remove or loosen a brake is listed, nothing is written, the exit code is 1, until it is asked for with `--allow`. A first export compares nothing. So does a graph under a new id, and so does an export where the kept graph cannot be read as that package's own, which then waits for `--uncompared`.

**What to attack.**

- **When it compares, and what it takes as the baseline.** The kept graph is a file in the project. What makes it "this package's own", and can a hand or a session make a loosened graph the baseline before the export?
- **Each way it compares nothing.** A first export, a new id, a kept graph that does not match its files, a package of two harnesses in one folder, `--uncompared`. For each: does the output say plainly that nothing was compared?
- **The last line.** The output ends with a line beginning `brakes:`. Is it true in every case you can reach, the ones in part H among them?
- **Who the refusal stops.** "A brake is removed or loosened only on a person's word" is printed to whoever ran the command. It is an instruction to an agent, not a lock; say whether any page reads as though it were one.
- **The route nobody listed.** Get a loosened graph placed over a package with exit 0 and a `brakes:` line that says nothing was loosened, by any way that is not in `docs/runs.md` already.

## Not in this round

- **The budget experiment's counter (F2).** It is not repaired. A dated note in `experiments/brakes/budget/README.md` says no verdict of `met` supports anything until it is. The paid runs stay parked.
- **Study two.** Not in this round. The owner took your sentence with five words added ("given only the visible task"); say so if the added words change what you meant.
- **The Codex target (#127)**, and anything that costs money.

## What is in your snapshot, and what is not

The snapshot is `main` at `c1ff8f7fd6a7a90602e883970ae1cf7962575893`, as a detached worktree, installed from this Mac's store and built. Nothing is laid over it, and no code in it differs from `main` at that commit.

In your folder for this round, beside this file: `TEMPLATE-AUDIT-HANDBACK.md`; `driver-reader/`, the three reports, scripts and outputs of the driver's reader's readings of the repair (part H), which are not in the repository; `sources/`, the descriptions of pull requests #172 and #168, since a pull request is in neither folder; and `lane-at-the-cut/`, what the lane's tools printed against this snapshot before the handoff was sent.

In the snapshot and worth knowing where: the guide in `docs/plain-english/`; the audit's record, with round two's reconciliation and the lane's probes, in `experiments/audits/0001-claims-as-of-0-3-0/`; the repair in `packages/core/src/brakes.ts` with its tests in `packages/core/test/stops-as-fired.test.ts`; export in `packages/cli/src/commands/export.ts`.

Not in it, and not asked of you: the repair of the budget experiment's counter, which does not exist; any paid run; the site lane's pages for the guide (#166), which wait for this round.

## What has no file behind it

Some things in this handoff reached the lane only as messages between sessions, and neither folder holds them. You cannot check them, and you are not asked to take them on trust. Where one matters to a finding, say so.

- **The owner's answers on the review desk** (q58 to q64, and that q66 is unanswered), and his ruling that a stop where a person is asked is named and not refused. The desk is a page of the driver's, and the driver relayed them.
- **The driver's own rulings**: on the two template descriptions, and on what the repair leaves open.
- **That the snapshot's commit passed its CI.** It is the driver's check.

## What to hand back

A handback in the form of `TEMPLATE-AUDIT-HANDBACK.md`, beside this file in your folder: findings numbered from F1, each with the claim, the severity, what you read or ran, the problem, what would change your mind, and what you would publish instead. Then what you checked and found sound, what you could not check, and the prompt to carry back.

For the guide, a finding per sentence is too many. Group them by chapter, and say for each chapter whether it could go on the site once its findings are corrected.

## The prompt for Codex

```text
Round three of audit 0001. You are the auditor, opened on
/Users/noir/Documents/grooph-exchange/codex/0001-claims-as-of-0-3-0/. Read round-03/HANDOFF.md
there and do what it asks, against the snapshot at
/Users/noir/Documents/grooph-exchange/snapshots/0001-claims-as-of-0-3-0-round-03/.

Three things only: the beginner's guide, all fourteen chapters and the glossary (part G); the
repair of the stops comparison, with what it still leaves open (part H); and the comparison as
grooph export makes it, which no second harness has read (part I). The budget experiment's
counter, study two and anything paid are not in this round.

Read as a skeptic and be fair. Attack the lane's readings and the driver's reader's as hard as the
claims: run their probes and your own, and where a probe's good news is a refusal, say which rule
refused. Change nothing in the snapshot or in the grooph repository; write only inside your own
folder. Give each probe a new, empty scratch folder there: each deletes its scratch before it
starts. Start no model session and no experiment.

End with round-03/HANDBACK.md in the form of TEMPLATE-AUDIT-HANDBACK.md, the guide's findings
grouped by chapter with a line for each chapter on whether it could go on the site once
corrected, and a prompt to carry back.
```
