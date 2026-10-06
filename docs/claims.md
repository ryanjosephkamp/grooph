# What grooph claims, and on what evidence

This page lists every claim grooph made about itself at version 0.3.0: on the [README](../README.md), on the [front page](https://ryanjosephkamp.github.io/grooph/), in the pages of this site, in the [technical report](report/grooph-technical-report.md) and in the [blog draft](blog/2026-10-loop-graphs.md). Each has a number, the place it is made, the evidence for it, and where its audit stands.

A claim here is a sentence about what grooph does to the quality, cost, speed or safety of work, or about what an experiment or a measurement showed.

## How a claim is audited

A claim is read twice, by two different harnesses ([decision 0024](decisions/0024-lanes-the-desk-and-the-audit-loop.md)). A Claude Code session, the audit lane, reads each claim against its evidence and writes down what it believes. Codex then reads the same claims and evidence as a skeptic and writes what it found. The lane answers each finding: agree, partly, or disagree. The owner decides what is corrected. The rounds go on until neither side holds a finding that blocks a claim, and what is still disputed is written down with both positions.

Every round is kept: [`experiments/audits/`](../experiments/audits/README.md).

## Where this audit stands

**Audit 0001, round 1: reconciled, and the two sides agree.** Codex returned 21 findings on the 52 claims. The lane agreed with 19 and partly with 2, and disputed none. Three of Codex's findings corrected the lane's own reading, and the records bore Codex out each time. So every claim below has one reading, held by both harnesses.

**The corrections came with this page.** Round 1 proposed 26 corrections, by number, in [its reconciliation](../experiments/audits/0001-claims-as-of-0-3-0/round-01/RECONCILE.md). Those the owner accepted were made in the same change that added this page, so where a claim below reads "other words" or "not carried", the page it stood on now says what the evidence carries. The quotations in the first column are the words as they stood at 0.3.0.

Four things still stand in their old words, each for a reason:

- **The blog draft**, which its author is rewriting by hand.
- **The comments at the top of the two hook scripts, and the `grooph hooks` help text** ("ids, names and times", C30). The hook's files are part of the frozen starting contents of an experiment in progress, and change after it.
- **"Sees only the traces" and "never sees the held-out cases"** (C46) in two long descriptions: the red-team loop template's, and one community graph's. A run reads a template's description, so changing one makes a new version of the template. They are named for round 2. (The same words in a row of the [templates page](templates.md) were corrected with the rest.)
- **Decision records and the write-ups of past experiments**, which are kept as they were written ([decision 0009](decisions/0009-proving-records-are-evidence.md)). What they got wrong is said in [decision 0029](decisions/0029-what-is-shown-as-of-the-first-audit.md).

A fifth was corrected a little after the rest, by a change of its own (pull request #108): the validator's printed sentence that a critic on another tier "tends to catch different mistakes", which now says "may", and four sentences in the built-in templates' descriptions (C49, C52). One of those reads "four reviewers and a judge are each a dispatch, every round", and not "are five dispatches a round" as the reconciliation proposed: a check in this repository refuses a count beside a brake's unit in a template's prose, and it is not relaxed for a correction.

A reading is one of three:

- **Carried.** The evidence supports the sentence as a careful reader would take it.
- **Other words.** The evidence supports something narrower, or supports it only under a condition the sentence does not give.
- **Not carried.** The evidence does not support the sentence as worded.

Of the 52: 12 carried, 33 other words, 7 not carried.

**What is not on this page yet.** A second paired comparison ran after 0.3.0 and is in the repository ([`experiments/comparisons/`](../experiments/comparisons/README.md)). Its claims have not been through an audit, and no page states them as shown. They are the subject of round 2.

## What grooph is shown to do

| # | Claim | Where | Evidence | The reading after round 1 | Audit |
|---|---|---|---|---|---|
| C1 | "grooph is shown to bound … autonomous work" | README, front page, blog draft, field guide, report | [The comparison's red-team project](../experiments/comparisons/red-team-loop/README.md); every run record | **Not carried.** Recorded runs halted at human gates, and one at a periodic human check-in. No record shows a round cap or a budget firing. The one prompt run that was cut off was inside the same caps the graph has | Round 1, agreed. An experiment is designed and not run |
| C2 | "… shown to … record autonomous work"; "Every run leaves a record." | README, front page, blog draft, field guide, report | [The proving records](../experiments/patterns/README.md) | **Other words.** Every recorded run left its notes; some records omit fields the package asks for (dispatch counts in 10 of 20). Halted runs were continued by resuming the same session | Round 1, agreed |
| C3 | "… and to hold a design as a runtime contract" | README, front page, blog draft, field guide, report | [The proving records](../experiments/patterns/README.md) and their check | **Other words.** 18 of 20 kept records pass the project's checks, which look at selected parts of each record. The package instructs the session; grooph does not enforce it while it runs | Round 1, agreed |
| C4 | "It is not shown to raise quality over the same instructions given as a prompt, on small tasks." | README, front page, blog draft, field guide, report | [The comparison](../experiments/comparisons/README.md) | **Carried.** No quality advantage was shown on four small tasks. That is not a test of equivalence: three of the four test suites were saturated, and replicates were two or three | Round 1, agreed |
| C5 | "Twenty templates have each been proven in a recorded run" | README; the other pages say "has a recorded run" | [The field guide](field-guide.md) | "Proven" is **not carried**: two of the twenty records fail their own check. "Has a recorded run" is carried | Round 1, agreed |

## The proving records

| # | Claim | Where | Evidence | The reading after round 1 | Audit |
|---|---|---|---|---|---|
| C6 | Each of the twenty tasks was "pre-registered before the run with the reason a first pass should fail" | Report | [The proving records](../experiments/patterns/README.md) and their commit history | **Not carried** as one claim for all twenty. Every task and its expected checks were committed before its run; the second batch also wrote down a design bet; the last four also a probability | Round 1, agreed |
| C7 | What each record holds, and a check that "re-asserts the outcome from the evidence" | Report | Any record under `experiments/patterns/` | **Other words.** The check reads the lead's own notes for several facts and the harness's transcripts for others; it is not a full reconstruction of the run | Round 1, agreed |
| C8 | "$57.51 over 31 model-calling invocations" | Report | [The proving ledger](../experiments/patterns/ledger.json) | **Other words.** 31 invocations, 30 of which reached a model | Round 1, agreed |
| C9 | Red records stay red; evidence is never edited | Report, blog draft | [Decision 0009](decisions/0009-proving-records-are-evidence.md); the commit history | **Carried**, for the history both sides inspected | Round 1, agreed |
| C10 | "Back edges fired in six templates once the tasks carried evidence held out from the builder." | Report | [The proving records](../experiments/patterns/README.md) | **Other words.** In two a critic sent work back on reference evidence the builder was told not to read. In two a check did. In two the loop was moving on to its next phase or piece | Round 1, agreed |
| C11 | The twenty "Proving run" blocks | [Field guide](field-guide.md) | Generated from the records | **Carried** | Round 1, agreed |

## The paired comparison

| # | Claim | Where | Evidence | The reading after round 1 | Audit |
|---|---|---|---|---|---|
| C12 | Four templates, three arms under equal conditions, 27 runs, $60.62 | README, front page, report, blog draft | [The comparison](../experiments/comparisons/README.md); [the protocol](comparisons.md) | **Other words.** The counts hold, read so: $60.62 is the whole study's cost over 40 invocations, of which the 27 runs cost $56.62 and the four judge calls $4.01. The loop arm ran one iteration every time. The package and the prompt differed in more than the record. The prompt arms could see the tool's name; a scan found no use of it | Round 1, agreed |
| C13 | The table of the four projects | Report | The comparison's records | **Carried** | Round 1, agreed |
| C14 | "The graph did not earn its cost in any of the four projects" | Report, blog draft | The comparison's four write-ups | **Other words.** No project met its pre-registered test for the graph earning its cost. Three met their losing condition; one met neither | Round 1, agreed |
| C15 | "In all 27 runs the prompt-arm lead dispatched the roles as separate subagents." | Report | The comparison's records | **Other words.** There are 18 prompt-arm runs, and in all 18 the lead dispatched subagents | Round 1, agreed |
| C16 | One prompt run went on to the $9.00 ceiling | Report, blog draft | [The red-team project](../experiments/comparisons/red-team-loop/README.md) | The numbers are **carried**. The run was inside the graph's caps; what the numbers show is C1 | Round 1, agreed |
| C17 | The study's stated limits, among them "no loop turned" | Report | [The comparison](../experiments/comparisons/README.md) | **Other words.** One correction cycle did turn, in a prompt run. Limits are missing: the loop arm ran once; three suites were saturated | Round 1, agreed |
| C18 | Study two is designed and has not run | Report, blog draft | [The comparison](../experiments/comparisons/README.md) | **Other words.** True at 0.3.0. It has since run; see above | Round 1, agreed |

## The validator and the compiler

| # | Claim | Where | Evidence | The reading after round 1 | Audit |
|---|---|---|---|---|---|
| C19 | "grooph checks that every loop can end" | README, front page, report, blog draft | [The rules](rules.md) | **Other words.** Every loop must name a stop. A loop with no cap and no budget draws a warning and still exports | Round 1, agreed |
| C20 | "The validator refuses … a critic that shares the builder's context" | Front page, README, report, blog draft | [The rules](rules.md) | **Other words.** Only where the graph asks for critic isolation. The templates with a critic do | Round 1, agreed |
| C21 | "The validator refuses … an irreversible step without a human gate" | Front page, report, blog draft | [The rules](rules.md); a probe of the validator on 2026-10-05, before the fix and after | **Other words.** Only a step the author marked irreversible. Found on 2026-10-05: a marked step that a run starts at was not refused when every edge back into it passed a person, though the run began there with nobody asked. No template, community graph or fixture that shipped had such a step. Fixed the same day (pull request #133): the rule now holds for a step the run starts at | Round 1, agreed. The finding and its fix are for round 2 |
| C22 | Thirty-five rules, each with a failing example | Report, blog draft | [The rules](rules.md) | **Carried** at 0.3.0. Rules were added after the audit's commit: on 2026-10-06 `docs/rules.md` holds 41 (30 for graphs, 11 for maps), each with a failing example | Round 1, agreed, for 0.3.0 |
| C23 | The built-in templates validate clean, and CI checks it | Report | The tests | **Carried** | Round 1, agreed |
| C24 | What `grooph explain` prints | Blog draft | The command | **Carried** | Round 1, agreed |
| C25 | "grooph never runs an agent, never calls a model"; "does not … host anything" | README, front page, report, blog draft | The code | **Other words.** It runs no agent, calls no model and needs no hosted service. One command serves a view on the user's own machine | Round 1, agreed |

## The app

| # | Claim | Where | Evidence | The reading after round 1 | Audit |
|---|---|---|---|---|---|
| C26 | "Graphs live in this browser on this device. Nothing is sent anywhere." | Front page, README, report, blog draft | The app's code | **Carried.** A share link or an embed carries the graph in the link itself | Round 1, agreed |
| C27 | "It works on a phone, needs no account, and opens offline once it has been opened online." | README | The browser tests | **Other words.** Tested at a phone's screen size and with the app cached, not on a physical phone | Round 1, agreed |
| C28 | "Here is one of the twenty recorded runs, as it happened." | Blog draft, front page | [The heterogeneous critic's record](../experiments/patterns/heterogeneous-critic/README.md) | **Carried.** It is a replay of the run's recorded notes | Round 1, agreed |
| C29 | "It does not start the run until you say so." | README | The design skill's text | **Other words.** The skill tells the session not to | Round 1, agreed |

## Observation

| # | Claim | Where | Evidence | The reading after round 1 | Audit |
|---|---|---|---|---|---|
| C30 | The hook "records ids, names and times, never content" | README, front page, report, blog draft, [subagents](subagents.md) | The hook's code and tests | **Other words.** Never content. On the machine it runs on, a line also holds the working folder's path and the path of a subagent's transcript | Round 1, agreed |
| C31 | "It prints nothing, exits 0 whatever happens … observation never steers." | Report, README | The hook's code and tests | **Other words.** The script returns no decision to the harness. Starting it can fail, and an agent can read what it wrote through grooph's own tool | Round 1, agreed |
| C32 | "The same hook runs in Claude Code and in Codex." | Report | [The hook records](../experiments/hooks/README.md) | **Other words.** In Codex it needs a trusted folder and a reviewed hook, and some events are missing | Round 1, agreed |
| C33 | A session silent for half an hour reads "last seen" | Report | The code and a test | **Carried** | Round 1, agreed |
| C34 | When the sender runs, and what it sends | Report | The sender's code and tests | **Other words.** The send during a turn needs a recorded tool call. A session's own notes and plans are sent too, with their text | Round 1, agreed |
| C35 | "A turn's end sends only its own session's files." | Report | The sender's code | **Other words.** Also files with a line since the session began, and files already on the branch | Round 1, agreed |
| C36 | "Every push now records how it went" | Report | The sender's code | **Other words.** With three exceptions in the code | Round 1, agreed |
| C37 | Ten pushes at once all arrived, "the last after 25 seconds on its tenth try" | Report | [The record of 2026-10-02](../experiments/hooks/README.md) | **Other words.** One retained trial: all ten arrived, the longest took 25 seconds, and the most tries was ten | Round 1, agreed |
| C38 | The first cloud trial sent nothing and said nothing | Report, blog draft | [Subagents](subagents.md), where it is labeled as reported | **Other words.** Reported by another project's session; no recording is kept here | Round 1, agreed |
| C39 | "five of them sent 163 lines … Every line was read before I left it on." | Blog draft | A report from another project's session | **Not carried** as worded. The reading was that session's, and reported | Round 1, agreed |
| C40 | "the count was 9 of 19" handoffs that wait on a person | Report, blog draft | The map of the plan | The number is carried. It is a count on a plan drawn before the work, **not** of what happened | Round 1, agreed |
| C41 | Hooks that arrive mid-session are "normally" picked up | Report | [Subagents](subagents.md) | **Other words.** By the harness's documentation, and in two reported trials: three sessions of four, then two of three | Round 1, agreed |

## Performance

| # | Claim | Where | Evidence | The reading after round 1 | Audit |
|---|---|---|---|---|---|
| C42 | "The embed's first load is 125 KB compressed" | [Exports](exports.md) | The size budget, which CI runs | **Carried** | Round 1, agreed |
| C43 | A waited-for hook costs "about 40 ms" | [Subagents](subagents.md) | None | **Not carried** as a measured number. No measurement is kept | Round 1, agreed. A measurement is named and not made |
| C44 | The front page's size and paint times | [Decision 0021](decisions/0021-what-an-address-loads.md) | The size budget; a timing script | **Other words.** The sizes are what an address loads to show itself; the app then fetches more so that it opens offline. The times were measured with that turned off, on one machine | Round 1, agreed |

## The other pages

| # | Claim | Where | Evidence | The reading after round 1 | Audit |
|---|---|---|---|---|---|
| C45 | A run "may tighten a brake and never loosen one" | Report, [graph document](graph-ir.md) | The lead's brief; the proving check; a probe of `grooph adopt`, at 0.3.0 and again on 2026-10-05; probes of a changed check and of `grooph export` that day | **Other words.** A rule the brief states; nothing checks it while a run goes on. At 0.3.0 nothing refused a loosened brake: a working copy with its round cap and budget raised was adopted. Since 2026-10-05 the `grooph adopt` command does not write such a copy until the change is asked for by name, and the web app's Adopt button, which makes the same comparison, does not save one at all. Since that evening the comparison also holds a check's command and where its verdicts lead ([amendment A-019](../spec/AMENDMENTS.md)). Its author says its list of brakes has not been shown complete. Since later that evening `grooph export` and the `grooph_export` tool make the same comparison over a package in place for the same graph id, while the graph it keeps matches its files, and do not write a change that may loosen a brake until it is asked for by name; a first export, a graph under a new id, and a hand that rewrites the kept graph with its files are not held ([runs](runs.md), "What adoption does not hold"). Until 2026-10-06 neither door held a loop's stops in two ways: a limit that halts, swapped with one that leads on; and a new leading-on limit of a kind the loop did not have, where no check or critic stands before the place it leads, which was printed as a tightening. Both were adopted and exported with nothing refused, still so in 0.4.0 (audit 0001, round two, finding F1). Since then a loop's stops are compared as a run fires them, and both are held by name at each door; what that still leaves (a stop on "bar passed" moved ahead of a limit that halts in a loop a critic judges, a stop where a person is asked, what a run does after a person has been asked) is in the same list. That change is newer than 0.4.0 and has not been read by a second harness. Described where the commands are documented; not shown | Round 1, agreed, for 0.3.0. The refusal, in the command and in the app, is newer and waits for round 2 |
| C46 | "everything else is hidden" from a node | [Graph document](graph-ir.md), field guide, [community](community.md), blog draft | [The proving records](../experiments/patterns/README.md) | **Other words.** An instruction, which failed once on record | Round 1, agreed |
| C47 | "the same run id resumes it" | [Graph document](graph-ir.md) | The proving records | **Other words.** As C2 | Round 1, agreed |
| C48 | A record with no ending line "is read as interrupted" | [Graph document](graph-ir.md) | The code | **Other words.** Flagged by the proving check; the monitor has no such state | Round 1, agreed |
| C49 | A critic on another tier "tends to catch different mistakes" | [Rules](rules.md) (printed by the validator), field guide, [subagents](subagents.md) | None in this repository | **Not carried** as a finding. A design belief, not measured here | Round 1, agreed |
| C50 | A graph is "small enough for a model to read and rewrite in one pass" | Report, blog draft, [rules](rules.md) | A size limit in the validator | **Other words.** A design target with a warning, not a measurement | Round 1, agreed |
| C51 | "One short line per dispatch; no other cost." | [Runs](runs.md) | The comparison | **Other words.** The package cost more turns than the prompt; how much of that is the record was not isolated | Round 1, agreed |
| C52 | Ten smaller sentences | [Subagents](subagents.md), [community](community.md), [quickstart](quickstart.md), field guide | Listed in the reconciliation | **Other words.** Wording, provenance and denominators | Round 1, agreed |
