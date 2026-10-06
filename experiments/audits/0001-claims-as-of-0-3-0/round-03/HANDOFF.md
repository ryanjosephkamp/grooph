# Audit 0001-claims-as-of-0-3-0 · round 03 · handoff to Codex

**From:** the audit lane (Claude Code, Opus 5.5) · **To:** Codex (GPT-6.1 Sol, highest effort) · **Date:** *to be filled when the snapshot is cut* · **Commit under audit:** *to be filled when the snapshot is cut* · **Snapshot:** `/Users/noir/Documents/grooph-exchange/snapshots/0001-claims-as-of-0-3-0-round-03/`

> **Draft, not yet sent.** Written on 2026-10-06, the day round two was reconciled. Three things in it wait for the cut and are marked *to be filled*: the commit, the repair's pull request with what its author says of it, and the list of what is in the snapshot. Nothing else is meant to change. The round is sent when the driver says the repair and round two's corrections are on main.

## What you are asked to do

Three things, and it is a short round. As before: read as a skeptic, say where a sentence says more than its evidence carries, and attack our readings as hard as the claims. **Change nothing.** Start no model session and run no new experiment. You may run commands that only read, and every probe named here starts no model.

1. **The beginner's guide, all of it** (part G): fourteen chapters and a glossary. The owner wants it on the site. You read five chapters in round two; this is the other nine, and the five as corrected.
2. **The repair of the stops comparison** (part H): the fault you found as F1, which turned out wider than you found it. The house lane has repaired it from round two's record. Say whether the repair holds, and whether it now refuses what it should not.
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

**One part of correction 12 was not made**, and you proposed as much in F11: the descriptions of two templates (`red-team-loop`, `tournament-then-judge`) still say "sees only". A template's description is compiled into the lead's brief, so changing one is a new version of the template, which the pattern test pins and a kept run is labeled by. The driver's word, 2026-10-06: both are left until each template's next authorized version, since proving a changed template again is a paid run. Row C46 of `docs/claims.md` reads the two as an instruction meanwhile.

**The lane was wrong three times in round two's reconciliation, and says so here because two of them are yours to check.** Its first draft said that a new stop put beside a halting one is always refused; a fresh reader showed a case where it is adopted and called a tightening. It said a printed line can only add to the counter's count; the same reader showed a real check run that is not counted. And its first scan of the built-in templates reported nothing open because adoption was refusing every template for being a template. The record of all three is in `round-02/RECONCILE.md` and `round-02/lane-notes/reconcile/fresh-reader/REPORT.md`.

**grooph 0.4.0 was published on 2026-10-06** (tag `v0.4.0`). It holds plans, a step that is a person's, export's comparison and the Codex target. *To be filled at the cut: the version at the snapshot.*

## Part G · The beginner's guide

`docs/plain-english/`: a start page, fourteen chapters, a glossary and three pictures. It was written by the audit lane on 2026-10-05 for a reader who has never used an AI coding tool, and corrected by round two's correction 15. It was then brought up to version 0.4.1 in pull request #171: every command it shows was run again from a build of main, a short section on plans was added to chapter 4, and the sentences that the release and round two had made untrue were corrected. **The author did not read all fourteen chapters again sentence by sentence. That reading is this round's.**

It says of itself that it has not been audited and is not on the site. The words proposed for it once this round is reconciled are in pull request #168's description. The site lane has prepared its pages in #166, which does not merge until then.

**What to attack.**

- **Every sentence about what grooph does to the quality, cost, speed or safety of work**, against `docs/claims.md`, decision 0029 with its dated clarifications, and the records under `experiments/`. The guide's rule for itself is that it claims nothing new.
- **Every command and what it is shown to print.** The start page says each was run in an empty folder. Run them at the snapshot; none starts a model. `experiments/audits/0001-claims-as-of-0-3-0/tools/guide-commands.py <snapshot> <a scratch folder of yours>` runs all of them in the guide's order and prints where an output differs from what the guide shows. It knows three things the chapters say in words (its head lists them), and it accepts shown output that is an excerpt: judge whether each excerpt is a fair one.
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

**The repair** is pull request #172, by the house lane. *What follows was drafted on 2026-10-06 from the driver's account of it at its second head, and is to be checked against `docs/runs.md` as merged when the snapshot is cut.*

A loop's stops are now compared as a run fires them.

**Held, by the name `loop:<id>.stops`:**

- a stop that leads on, old or new and of any kind, that could fire no later than a source stop that halts, or than one where a person is asked (with a `then` or without), and would win;
- "bar passed" put or added ahead, in a loop that no critic judges;
- a second loop on the back edge with a cap that leads on.

A person's stop in the copy excuses nothing that comes after it.

**The label.** "Tightens a brake" prints on no change that brings in or promotes a stop that leads on. Such a change is listed as not judged. *To be filled at the cut: the one sentence this changed in the command's output and in the app.*

**What it costs,** by the counts of the driver's reader: lowering a limit that leads on, beside one that halts, is not a tightening and is often refused (a budget in 558 of 747 random lists of stops, a cap in 293 of 507, a count of rounds without progress in 371 of 486, an "ask a person every n" lowered in 100 of 1,185). Among the built-in templates, 575 honest edits were tried and one was held: `debate-then-build`'s cap lowered from 2 to 1.

**Still not held, by the driver's ruling, and yours to judge by name:**

- "bar passed" in a loop that a critic judges;
- what a run does after a person has answered;
- a halting stop on diminishing returns or on invalid evidence (neither is on amendment A-008's list of brakes);
- a stop that leads on, where the loop has no stop that halts;
- **and one class, put to the owner on the review desk (q66).** Where only a limit stands before an end, with no check, critic or gate, a new way to that end that is not a change to that loop's stops is adopted: a plain new edge from the worker to the end; a leading-on stop in an inner loop while the outer loop holds the limit; a new step with a one-node loop and a cap of 1 that leads on to the end. The driver's recommendation is to leave it for after the pause and say it plainly. *To be filled at the cut: the owner's answer.* Unless he answers otherwise, it is given to you as a known limit, and the question is whether the documents say it truly.

**The repair has been read twice by one fresh reader, the driver's.** Its scripts and what they printed are in your folder for this round, under `driver-reader/`. They are another reader's evidence, as the lane's probes are: run them, and do not take their counts on trust.

**The question for you:** is anything a plain reader would call a loosened brake still adopted through a loop's stops? And do `docs/runs.md`, row C45 of `docs/claims.md` and the 0.4.1 release notes say exactly what is held and what is not?

**What to run.** Each takes the snapshot's root, and the first two a scratch folder of yours. The first two print the reason the comparison gives for each refusal. The third counts, and stops with an error if adoption turns a copy away for any reason that is not a brake.

- The lane's: `experiments/audits/0001-claims-as-of-0-3-0/tools/stop-order-probe.mjs`, `stop-added-ahead-probe.mjs` and `stops-in-built-ins-probe.mjs`. What they printed before the repair is in `round-02/lane-notes/reconcile/`.
- The fresh reader's: `round-02/lane-notes/reconcile/fresh-reader/variants.mjs` to `variants4.mjs`. Their paths point at a scratch folder that is gone; give them yours.
- Your own, from round two: `round-02/notes/stop-order-probe.mjs`.

**What to attack.**

- **The two cases themselves**, at both doors, and through the app's Adopt and a subgrooph's refresh, which make the same comparison (read, if you cannot operate the app).
- **Shapes neither of us tried**: three stops; a stop moved across a `bar-passed` stop; a stop moved between two loops over the same members; a stop's kind or measure changed in place; a `then` changed in place; a stop that leads on to a node inside the loop.
- **Refusals that should not be.** A reorder that only tightens (`debate-then-build`'s cap and budget swapped) must still be adopted. A rule that refuses every change to a loop's stops would pass every probe above and be useless: say what honest changes it now costs an `--allow`.
- **A stop where a person is asked that leads on.** The owner ruled in round two's day that this is named and not refused, since each lap is a person's decision. Sixty-nine of the 84 new stops that `stops-in-built-ins-probe.mjs` found unrefused were of this kind. Is that still what the code does, and is "each lap is a person's decision" true of a stop with a large `every`?
- **The reason on each refusal.** A probe whose good news is a refusal can pass for the wrong reason; the lane's did, twice. Where a copy is refused, say which rule refused it.

## Part I · The comparison as `grooph export` makes it

`packages/cli/src/commands/export.ts`, with the `grooph_export` tool of the MCP server, and what the documents say of them: `grooph export --help`, the last item of "What adoption does not hold" in `docs/runs.md`, the 0.4.0 release notes with their dated clarification, and row C45 of `docs/claims.md`.

**What the documents say.** Over a package already in place for the same graph id, the graph coming in is held to the brakes of the graph that package keeps, by the comparison adoption makes. A change that may remove or loosen a brake is listed, nothing is written, the exit code is 1, until it is asked for with `--allow`. A first export compares nothing. So does a graph under a new id, and so does an export where the kept graph cannot be read as that package's own, which then waits for `--uncompared`.

**What to attack.**

- **When it compares, and what it takes as the baseline.** The kept graph is a file in the project. What makes it "this package's own", and can a hand or a session make a loosened graph the baseline before the export?
- **Each way it compares nothing.** A first export, a new id, a kept graph that does not match its files, a package of two harnesses in one folder, `--uncompared`. For each: does the output say plainly that nothing was compared?
- **The last line.** The output ends with a line beginning `brakes:`. Is it true in every case you can reach, the ones in part H among them?
- **Who the refusal stops.** "A brake is removed or loosened only on a person's word" is printed to whoever ran the command. It is an instruction to an agent, not a lock; say whether any page reads as though it were one.
- **The route nobody listed.** Get a loosened graph placed over a package with exit 0 and a `brakes:` line that says nothing was loosened, by any way that is not in `docs/runs.md` already.

## Not in this round

- **The budget experiment's counter (F2).** It is not repaired. A dated note in `experiments/brakes/budget/README.md` says no verdict of `met` supports anything until it is. The paid runs stay parked.
- **Study two.** Settled by the owner's answer: your sentence with five words added.
- **The Codex target (#127)**, and anything that costs money.

## What is in your snapshot, and what is not

*To be filled when the snapshot is cut:* the commit and what it holds, what is laid over it if anything, and what was left out.

## What to hand back

A handback in the form of `TEMPLATE-AUDIT-HANDBACK.md`, beside this file in your folder: findings numbered from F1, each with the claim, the severity, what you read or ran, the problem, what would change your mind, and what you would publish instead. Then what you checked and found sound, what you could not check, and the prompt to carry back.

For the guide, a finding per sentence is too many. Group them by chapter, and say for each chapter whether it could go on the site once its findings are corrected.

## The prompt for Codex

*To be filled when the snapshot is cut.* It will name this file, in `/Users/noir/Documents/grooph-exchange/codex/0001-claims-as-of-0-3-0/round-03/`, and the snapshot above.
