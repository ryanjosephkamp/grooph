# What grooph claims, and on what evidence

This page lists every claim grooph makes about itself: on the [README](../README.md), on the [front page](https://ryanjosephkamp.github.io/grooph/), in the pages of this site, in the [technical report](report/grooph-technical-report.md) and in the [blog draft](blog/2026-10-loop-graphs.md). Each has a number, the place it is made, the evidence for it, and where its audit stands.

A claim here is a sentence about what grooph does to the quality, cost, speed or safety of work, or about what an experiment or a measurement showed.

## How a claim is audited

A claim is read twice, by two different harnesses ([decision 0024](decisions/0024-lanes-the-desk-and-the-audit-loop.md)). A Claude Code session, the audit lane, reads each claim against its evidence and writes down what it believes. Codex then reads the same claims and evidence as a skeptic and writes what it found. The lane answers each finding: agree, partly, or disagree. The owner decides what is corrected. The rounds go on until neither side holds a finding that blocks a claim, and what is still disputed is written down with both positions.

Every round is kept: [`experiments/audits/`](../experiments/audits/README.md).

## Where this audit stands

**Audit 0001, round 1, open.** The lane has read all 52 claims and sent them to Codex. Codex has not answered yet. So every reading below is one side's, made before the second harness saw anything, and no correction has been made to any page. The reasons for each reading are in [the round's handoff](../experiments/audits/0001-claims-as-of-0-3-0/round-01/HANDOFF.md), under the same number.

A reading is one of three:

- **Carried.** The evidence supports the sentence as a careful reader would take it.
- **Other words.** The evidence supports something narrower, or supports it only under a condition the sentence does not give.
- **Not carried.** The evidence does not support the sentence as worded.

Of the 52: 20 carried, 24 other words, 6 not carried, and 2 that could not be checked in this round.

## What grooph is shown to do

| # | Claim | Where | Evidence | The lane's reading | Audit |
|---|---|---|---|---|---|
| C1 | "grooph is shown to bound … autonomous work" | README, front page, blog draft, field guide, report | [The comparison's red-team project](../experiments/comparisons/red-team-loop/README.md); every run record | **Not carried.** No round cap or budget has fired in 33 recorded runs. The one prompt run that ran on was cut off by the runner's dollar ceiling, inside the same caps the graph has. What is observed: runs stopped at a passed bar or a human gate | Round 1, open |
| C2 | "… shown to … record autonomous work"; "Every run leaves a record." | README, front page, blog draft, field guide, report | [The proving records](../experiments/patterns/README.md) | **Other words.** Every recorded run left its notes. Dispatch counts were kept in 10 of 20. Each halted run that went on was the same session, resumed | Round 1, open |
| C3 | "… and to hold a design as a runtime contract" | README, front page, blog draft, field guide, report | [The proving records](../experiments/patterns/README.md) and their check | **Other words.** 18 of 20 kept records pass their check; 4 more pass on a second run. One run for each template | Round 1, open |
| C4 | "It is not shown to raise quality over the same instructions given as a prompt, on small tasks." | README, front page, blog draft, field guide, report | [The comparison](../experiments/comparisons/README.md) | **Carried** | Round 1, open |
| C5 | "Twenty templates have each been proven in a recorded run" | README; the other pages say "has a recorded run" | [The field guide](field-guide.md) | "Proven" is **not carried**: two of the twenty records fail their own check. "Has a recorded run" is carried | Round 1, open |

## The proving records

| # | Claim | Where | Evidence | The lane's reading | Audit |
|---|---|---|---|---|---|
| C6 | Each of the twenty tasks was "pre-registered before the run with the reason a first pass should fail" | Report | [The proving records](../experiments/patterns/README.md) and their commit history | **Not carried.** Four of twenty were. Eleven more had a design bet written down first. The first five had neither | Round 1, open |
| C7 | What each record holds | Report | Any record under `experiments/patterns/` | **Carried** | Round 1, open |
| C8 | "$57.51 over 31 model-calling invocations" | Report | [The proving ledger](../experiments/patterns/ledger.json) | **Other words.** 31 invocations; one failed at sign-in before any model call | Round 1, open |
| C9 | Red records stay red; evidence is never edited | Report, blog draft | [Decision 0009](decisions/0009-proving-records-are-evidence.md); the commit history | **Carried** | Round 1, open |
| C10 | "Back edges fired in six templates once the tasks carried evidence held out from the builder." | Report | [The proving records](../experiments/patterns/README.md) | **Other words.** In two a critic sent work back on held-out evidence. In two a check did. In two the loop was moving on to its next phase or piece | Round 1, open |
| C11 | The twenty "Proving run" blocks | [Field guide](field-guide.md) | Generated from the records | **Carried** | Round 1, open |

## The paired comparison

| # | Claim | Where | Evidence | The lane's reading | Audit |
|---|---|---|---|---|---|
| C12 | Four templates, three arms under equal conditions, 27 runs, $60.62 | README, front page, report, blog draft | [The comparison](../experiments/comparisons/README.md); [the protocol](comparisons.md) | **Other words.** The counts hold. The loop arm ran one iteration every time, so it was the prompt arm a second time. The prompt arms could see the tool's name and that a package had been removed; none used the tool | Round 1, open |
| C13 | The table of the four projects | Report | The comparison's records | **Carried** | Round 1, open |
| C14 | "The graph did not earn its cost in any of the four projects" | Report, blog draft | The comparison's four write-ups | **Carried** | Round 1, open |
| C15 | "In all 27 runs the prompt-arm lead dispatched the roles as separate subagents." | Report | The comparison's records | **Other words.** There are 18 prompt-arm runs, and all 18 did | Round 1, open |
| C16 | One prompt run went on to the $9.00 ceiling | Report, blog draft | [The red-team project](../experiments/comparisons/red-team-loop/README.md) | The numbers are **carried**. What they show is C1 | Round 1, open |
| C17 | The study's stated limits | Report | [The comparison](../experiments/comparisons/README.md) | **Other words.** Three limits are missing: the loop arm ran once, every arm was at the top of its test suite, and the prompt arms were not blind to the tool | Round 1, open |
| C18 | Study two is designed and has not run | Report, blog draft | [The protocol](comparisons.md) | **Carried** | Round 1, open |

## The validator and the compiler

| # | Claim | Where | Evidence | The lane's reading | Audit |
|---|---|---|---|---|---|
| C19 | "grooph checks that every loop can end" | README, front page, report, blog draft | [The rules](rules.md) | **Other words.** Every loop must name a stop. A loop with no cap and no budget draws a warning and still exports | Round 1, open |
| C20 | "The validator refuses … a critic that shares the builder's context" | Front page, README, report, blog draft | [The rules](rules.md) | **Other words.** Only where the graph asks for critic isolation. The templates with a critic do | Round 1, open |
| C21 | "The validator refuses … an irreversible step without a human gate" | Front page, report, blog draft | [The rules](rules.md) | **Other words.** Only a step the author marked irreversible | Round 1, open |
| C22 | Thirty-five rules, each with a failing example | Report, blog draft | [The rules](rules.md) | **Carried** | Round 1, open |
| C23 | The built-in templates validate clean, and CI checks it | Report | The tests | **Carried** | Round 1, open |
| C24 | What `grooph explain` prints | Blog draft | The command | **Carried** | Round 1, open |
| C25 | "grooph never runs an agent, never calls a model" | README, front page, report, blog draft | The code | **Carried** | Round 1, open |

## The app

| # | Claim | Where | Evidence | The lane's reading | Audit |
|---|---|---|---|---|---|
| C26 | "Graphs live in this browser on this device. Nothing is sent anywhere." | Front page, README, report, blog draft | The app's code | **Carried.** A share link or an embed carries the graph in the link itself | Round 1, open |
| C27 | "It works on a phone, needs no account, and opens offline once it has been opened online." | README | The browser tests | **Carried**, on the tests' word | Round 1, open |
| C28 | "Here is one of the twenty recorded runs, as it happened." | Blog draft, front page | [The heterogeneous critic's record](../experiments/patterns/heterogeneous-critic/README.md) | **Carried** | Round 1, open |
| C29 | "It does not start the run until you say so." | README | The design skill's text | **Carried**, as what the skill instructs | Round 1, open |

## Observation

| # | Claim | Where | Evidence | The lane's reading | Audit |
|---|---|---|---|---|---|
| C30 | The hook "records ids, names and times, never content" | README, front page, report, blog draft, [subagents](subagents.md) | The hook's code and tests | **Other words.** Never content. On the machine it runs on, a line also holds the working folder's path and the path of a subagent's transcript | Round 1, open |
| C31 | "It prints nothing, exits 0 whatever happens … observation never steers." | Report, README | The hook's code and tests | **Other words.** True of the script. The command fails when the file or Node is missing. A lead can read what the hook saw through grooph's own tool | Round 1, open |
| C32 | "The same hook runs in Claude Code and in Codex." | Report | [The hook records](../experiments/hooks/README.md) | **Other words.** In Codex it needs a trusted folder and a reviewed hook, and some events are missing | Round 1, open |
| C33 | A session silent for half an hour reads "last seen" | Report | The code and a test | **Carried** | Round 1, open |
| C34 | When the sender runs, and what it sends | Report | The sender's code and tests | **Other words.** The send during a turn needs a recorded tool call. A lead's own notes are sent too, text and all | Round 1, open |
| C35 | "A turn's end sends only its own session's files." | Report | The sender's code | **Other words.** Also files with a line since the session began, and files already on the branch | Round 1, open |
| C36 | "Every push now records how it went" | Report | The sender's code | **Other words.** With two exceptions in the code | Round 1, open |
| C37 | Ten pushes at once all arrived, the last after 25 seconds | Report | [The record of 2026-10-02](../experiments/hooks/README.md) | **Carried.** One run | Round 1, open |
| C38 | The first cloud trial sent nothing and said nothing | Report, blog draft | [Subagents](subagents.md), where it is labeled as reported | **Other words.** Reported by another project's session; no recording is kept here | Round 1, open |
| C39 | "five of them sent 163 lines … Every line was read before I left it on." | Blog draft | A report from another project's session | **Not carried** as worded. The reading was that session's, and reported | Round 1, open |
| C40 | "the count was 9 of 19" handoffs that wait on a person | Report, blog draft | The map of the plan | The number is carried. It is a count on a plan drawn before the work, **not** of what happened | Round 1, open |
| C41 | Hooks that arrive mid-session are normally picked up | Report | [Subagents](subagents.md) | **Carried**, on documentation and a report | Round 1, open |

## Performance

| # | Claim | Where | Evidence | The lane's reading | Audit |
|---|---|---|---|---|---|
| C42 | "The embed's first load is 125 KB compressed" | [Exports](exports.md) | The size budget, which CI runs | **Carried** | Round 1, open |
| C43 | A waited-for hook costs "about 40 ms" | [Subagents](subagents.md) | None found | **Could not be checked.** No record of the measurement was found | Round 1, open |
| C44 | The front page's size and paint times | [Decision 0021](decisions/0021-what-an-address-loads.md) | The size budget; a timing script | Sizes **carried**. Paint times were not measured again in this round | Round 1, open |

## The other pages

| # | Claim | Where | Evidence | The lane's reading | Audit |
|---|---|---|---|---|---|
| C45 | A run "may tighten a brake and never loosen one" | Report, [graph document](graph-ir.md) | The lead's brief; the proving check | **Other words.** A rule the brief states and the check looks for afterwards. Nothing refuses it | Round 1, open |
| C46 | "everything else is hidden" from a node | [Graph document](graph-ir.md), field guide, [community](community.md), blog draft | [The proving records](../experiments/patterns/README.md) | **Other words.** An instruction, which failed once on record | Round 1, open |
| C47 | "the same run id resumes it" | [Graph document](graph-ir.md) | The proving records | **Other words.** As C2 | Round 1, open |
| C48 | A record with no ending line "is read as interrupted" | [Graph document](graph-ir.md) | The code | **Other words.** By the proving check only | Round 1, open |
| C49 | A critic on another tier "tends to catch different mistakes" | [Rules](rules.md) (printed by the validator), field guide, [subagents](subagents.md) | None in this repository | **Not carried** as a finding. A design belief, not measured here | Round 1, open |
| C50 | A graph is "small enough for a model to read and rewrite in one pass" | Report, blog draft, [rules](rules.md) | A size limit in the validator | **Other words.** A design limit, not a measurement | Round 1, open |
| C51 | "One short line per dispatch; no other cost." | [Runs](runs.md) | The comparison | **Other words.** The record as a whole is the package's one measured cost | Round 1, open |
| C52 | Ten smaller sentences | [Subagents](subagents.md), [community](community.md), [quickstart](quickstart.md), field guide | Listed in the handoff | **Other words.** Wording fixes | Round 1, open |
