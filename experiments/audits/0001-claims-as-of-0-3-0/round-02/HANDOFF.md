# Audit 0001-claims-as-of-0-3-0 · round 02 · handoff to Codex

**From:** the audit lane (Claude Code, Opus 5.5) · **To:** Codex (GPT-6.1 Sol, highest effort) · **Date:** 2026-10-05 · **Commit under audit:** `faba78aeff36e9aca5c02c8e726086cbe10191f5`, which is `main` at `ed0f95b` (the merge of pull request #130) with the audit's own record on top: this handoff, the lane's probes and what they print, and two rows of the claims page. No code differs from `main` at `ed0f95b`. · **Snapshot:** `/Users/noir/Documents/grooph-exchange/snapshots/0001-claims-as-of-0-3-0-round-02/`, made at that commit, installed and built

## What you are asked to do

Five things, in this order of importance. As before: read as a skeptic, say where a sentence says more than its evidence carries, and attack our readings as hard as the claims. **Change nothing.** Start no model session and run no new experiment. You may run commands that only read.

1. **The corrected words** (part A). Round one ended with every claim read the same way by both of us. The corrections that followed are new sentences, and a new sentence can overstate as easily as an old one. Read each as it would be published.
2. **Comparison study two** (part B). It ran on 2026-10-04, after the commit you read in round one, and is on `main`. Its claims have been read inside Claude Code only. No public page states its results as shown, and none will until you have read them.
3. **The comparison of brakes** (part E): the code that refuses a loosened brake when a changed graph is taken up. It was written in answer to your finding F6 and extended three times in one day, and its author asks that the next reading be yours.
4. **Decision 0029**, which replaces decision 0013's sentence (part C), and the brake experiment as it was built from your design (part D): say whether each is faithful.
5. **A guide for beginners** (part F), last, and only when parts A to E have had their read.

## Since the last round

Your 21 findings: we agreed with 19, partly with 2, disputed none (`round-01/RECONCILE.md`). The owner accepted every correction that followed, on 2026-10-05, and they are on `main`. You corrected our own reading three times (F1, F2, F5) and the records bore you out each time. We added one observation to F6: at 0.3.0 `grooph adopt --write` accepted a working copy with its round cap raised from 4 to 40 and its budget from 10 to 400 (`tools/adopt-probe.sh`). That observation has since been answered in code, which is part E. Two later merges made four of the corrected sentences untrue within the hour, and they were corrected again (pull request #125): #117 put the same check on the web app's Adopt button, and #108 corrected the validator's printed sentence and four template sentences that the claims page still listed as standing. Decision 0029, signed twelve minutes after #117, carries a dated note under the bullet that says the app's button does not make the check.

| Your finding | What was changed | Where |
|---|---|---|
| F1, F3 | "Bound" withdrawn everywhere it was claimed. The report's account of study one's cut-off run rewritten: inside the graph's caps, a correction cycle did turn, the first trace is within the contract | corrections 1, 2, 3, 5, 9, 10 |
| F2, F5 | "None of the four projects met its pre-registered test for the graph earning its cost. Three met their losing condition; `review-gate` met neither." Three suites saturated, `grind-loop` 61 of 62; "not a test of equivalence" | correction 9 |
| F4 | "A compiled package against a prompt derived from it by rule", with what the prompt dropped; 18 prompt-arm runs; the prompt arms could see the tool's name | correction 9 |
| F6, F11 | "Eighteen of twenty … pass the project's checks", "selected parts of each record", "the package instructs; grooph does not enforce"; resume is the same session resumed; adaptation is a brief. Corrections 7 and 20 were changed again after #114, so as not to say that nothing refuses a loosened brake (part E) | corrections 2, 5, 7, 8, 12, 20, 21 |
| F7, F8 | "Every loop names a stop"; isolation "where the graph asks for it"; "a step marked irreversible" | corrections 2, 4, 5, 6, 22 |
| F9, F10 | The six returning edges sorted; "instructed not to read"; three degrees of prospective specification; 31 invocations, 30 reaching a model | correction 8 |
| F13, F14, F16 | What the hook records, with the two local paths; "returns no decision"; the sender carries notes and plans with their text; three ways a push leaves no summary | corrections 13, 14 |
| F15, F17 | One retained trial of ten; reports kept as reports; the map's count as a count on a plan | corrections 14, 15, 23 |
| F18 | On the claims page: the sizes are what an address loads to show itself; the times were measured with the service worker off | the claims page, C44 |
| F19, F20, F21 | "Built for a phone's screen"; "the skill tells the session not to start"; "needs no hosted service"; the subagents page's counts, labels and unmeasured numbers; the quickstart's "every" | corrections 3, 18, 23, 24 |
| F12 | Study two has since run. The report now says so and states none of its results | correction 11 |

**Not changed, and why.** Say if any of these should not wait.

- **The two hook scripts' header comments and the `grooph hooks` help text** still say "ids, names and times". The hook's two files are part of the frozen starting contents of the game experiment, whose repositories are compiled from one commit; they change after both exist.
- **The validator's printed sentence** "tends to catch different mistakes" (F19), and four design sentences that live in the template files, were corrected a little after the rest, by a change of their own (pull request #108): the validator now prints "may catch different mistakes". Read them with part A.
- **The blog draft**: the owner rewrites it by hand. Round one's reconciliation lists its sentences.
- **The old write-ups and decisions 0012 and 0013** stay as written. Their three wrong statements are corrected in decision 0029 (part C) and in a dated note at the head of the comparisons' index (pull request #123).
- **Decision 0021's table** is a decision record. Its qualification is on the claims page.
- **Two more places where "sees only" and "never sees" stand** (round one's C46), found after the reconciliation: the `description` of the `red-team-loop` template ("The builder sees only the traces") and the `description` of the community graph `hypothesis-ratchet` ("A proposer, which never sees the held-out cases"). A run reads a template's description, so changing one raises the template's version; that is the cost of correcting them. Say whether they should wait. (A third place, the `red-team-loop` row of `docs/templates.md`, cost nothing to correct and is in part A.)
- **One corrected sentence is not in the words round one proposed.** "Four reviewers and a judge are five dispatches a round" is on `main` as "are each a dispatch, every round": a check in the repository refuses a count beside a brake's unit in a template's prose.

## Part A · The corrected words

The whole diff is pull request #105, merged as `1574c53`: one commit for each correction, each named by its number. `git log --oneline 1574c53^1..1574c53^2 -- README.md apps/web docs scripts` in the snapshot lists them. The sentences that carry the most:

### A1 · The status line

- **Published at:** `README.md`, the Status paragraph; the front page says nearly the same (`apps/web/src/ui/landing/Landing.tsx`, the section "What is shown, and what is not").
- **Words:** "Each of the twenty templates has a recorded run: eighteen pass the project's checks and two are published red. In those runs a session stopped where its graph said, at a passed bar or at a human gate, and left a record of what it did. No round cap or budget is on record as firing, so it is not shown that one holds a run that would otherwise go on. In a paired comparison on four small tasks the package showed no quality advantage over a prompt derived from it."
- **Evidence:** as round one's C1 to C5; `node tools/stops-fired.mjs` on the snapshot, which now reads 42 run records and prints `{"bar-passed":26,"human":2}` and 20 halts at a node.
- **What we believe, and how sure we are:** Carried. The two points we are least sure of are below.
- **What we most want attacked:** (1) "a session stopped where its graph said" for all twenty: two kept records are red, and one of those ended at a human check-in that came before the graph's last nodes. Is "stopped where its graph said" true of a run the check fails? (2) "left a record of what it did": you said the record is the lead's account, checked in parts. Is "of what it did" too much?

### A2 · The front page's three claims

- **Words:** "**Every loop names its stop.** The validator refuses a loop without one and warns when a loop has no cap. Where a graph asks for it, it refuses a critic that shares the builder's context, and it refuses a step marked irreversible with no human gate before it." · "**The graph is the contract.** The package tells the session to run it as drawn: named subagents, stops in order, a halt at every human gate. grooph does not enforce it while it runs; eighteen of twenty recorded runs pass the checks of it, and two say why they do not." · "**Every run is asked for a record.** Notes, rounds and why it stopped, in a folder a monitor reads. A halted run goes on when a person answers."
- **What we believe:** Carried. We kept "contract" on your reading of the word in F6.
- **What we most want attacked:** "warns when a loop has no cap" (the warning is for no budget and no cap, or a cap above five: is the short form fair?). "A halted run goes on when a person answers" (every continuation on record was the runner resuming the session with a scripted or owner-approved answer).

### A3 · The report on study one

- **Published at:** `docs/report/grooph-technical-report.md`, section 5.2: the paragraphs Result, Why, Where the arms differed, Limits.
- **What we believe:** Carried; these are your sentences from F1, F2, F4 and F5 with ours.
- **What we most want attacked:** Anything we lost or added in joining them.

### A4 · The rest

The report's summary and its section on the hook and the sender; the field guide's "how to read it"; the graph document's page; the subagents page; the quickstart; the claims page itself (`docs/claims.md`), which now gives one reading for each of the 52 claims. Read what you have time for and say what you did not reach. Three of these sentences changed three times in one day as the code under them moved, and are the likeliest to be wrong: the claims page's row C45, the report's row for adaptation, and "Brakes are not adaptable" in `docs/graph-ir.md` §2.

### A5 · A fault found in one corrected sentence's rule, and fixed the same day: the irreversible rule and the start of a run

- **Words, as corrected and published:** "it refuses a step marked irreversible with no human gate before it" (the front page, correction 2).
- **What we found,** while a test reader of the plain-English guide asked why the start of a run does not count as a way in: a node marked irreversible that a run **starts at** was not refused once every edge back into it passed a person. On the built-in `review-gate`, with `irreversible: ["merge"]` on `builder` and `approval: true` on `e-critic-fail`, the validator had no error. The builder's only inbound edges are its loop's two back edges, so by graph-ir §2 it is an entry node, and the rule's own text counts "nothing leads to it" as reachable without a human decision. `round-02/lane-notes/irreversible-entry-probe.txt` is what the probe printed then.
- **What was done:** pull request #133 (`b6aa59d`), the same day: the rule holds for a step the run starts at, whatever leads back to it, with a failing and a passing fixture and no change to the rule's text. It is in your snapshot. At the snapshot the same probe prints the error for both cases, "is where the run starts: only a loop's back edge … leads to it" (`round-02/lane-notes/at-the-snapshot/irreversible-entry-probe.txt`). The claims page's row C21 carries the finding and the fix, dated.
- **What we most want attacked:** whether the fix is whole. Find another way to reach a marked node with nobody asked: through a stop's `then`, through a subgrooph's entry, through a loop nested in a loop, through a node that both starts the run and is led to by a gate.

## Part B · Comparison study two

Protocol version 2 (`docs/comparisons.md`). Three projects, four arms, two replicates: A the package, B the package said as prose by rule, C that prose in up to N fresh sessions, D the task alone. 24 runs and 3 judge calls, $22.03. Its own account is `handoffs/0019-comparison-study-two/HANDBACK.md`; the records are under `experiments/comparisons/{review-gate-2,heterogeneous-critic,taste-polish}/`.

**No sentence below is published.** They are the study's own statements, and the one candidate sentence at the end is what we would publish if they hold.

### S1 · "The graph did not earn its cost in any of the three projects"

- **Stated at:** the study's handback, "The two pre-registered questions", 1; each project's `README.md`, "Did the graph earn its cost".
- **Evidence:** each run's `score.json` and `result.json`; `node scripts/lib/compare-summary.mjs --index`; each project's `README.md`, "What counts as the graph losing".
- **What we believe, and how sure we are:** Carried, and checked the way your F2 taught us to: replicate by replicate. The losing condition in all three is "Arm B matches or beats arm A on held-out passes in both replicates at lower cost". By the records: `review-gate-2` A $1.1837 and $1.2302 against B $0.6665 and $0.6925, 55 of 55 in all four; `heterogeneous-critic` A $1.6001 and $1.2852 against B $1.0472 and $1.0299, 70 of 70; `taste-polish` A $1.5840 and $1.4208 against B $0.8907 and $0.8811, 24 of 24. Met in both replicates of all three.
- **What we most want attacked:** Whether anything in a pre-registration changed after a run. The study says they were edited "after they were first committed and before any run" and that the tasks and losing tests were pushed 2 hours 18 minutes before the first paid call, the tier map 10 seconds before.

### S2 · "A loop turned once in all 18 runs with a reviewer, and it changed the result every time"

- **Stated at:** the same section, 2.
- **Evidence:** for arm A, each run's notes and the critic's round-0 and round-1 reports under `A-<n>/runs/<id>/`; two kept round-0 diffs; for arms B and C, `derived/*.held-out-seen.json`, made after the runs from transcripts that are not in the repository.
- **What we believe, and how sure we are:** We read the six arm-A records ourselves on 2026-10-05. In each, the notes show the critic failing at round 0, the loop's line for round 0 as a fail, a builder and a critic again in round 1, and `bar-passed` at round 1; the two code projects then halt at the merge gate and `taste-polish` ends at its success stop. The round-0 state is each critic's own round-0 report: 44 of 55 in both `review-gate-2` runs, 52 of 70 in both `heterogeneous-critic` runs, four major gaps and no count in both `taste-polish` runs. The end is the scorer's: 55 of 55, 70 of 70, 24 of 24. So for arm A "turned once" is carried by the notes, and "changed the result" rests on a session's own count at round 0 against the scorer's at the end; we did not rebuild the two kept round-0 trees. The study itself says which part is shown and which is reported: shown by kept records in the six package runs (two round-0 trees re-scored to 44 of 55 and 52 of 70); reported in the twelve prompt-arm runs; and `taste-polish` has no round-0 count in any arm.
- **What we most want attacked:** "It changed the result every time" for the twelve runs where the round-0 count is derived and not kept. And whether a task "built so a first pass would fail", by one author, shows a loop's worth or only that the task did what it was built to do.

### S3 · "The design in all three forms ended above no design in every project"

- **Stated at:** the same section: 55 against 51 of 55, 70 against 52 of 70, 24 against 15 of 24, "for two to six times arm D's cost".
- **Evidence:** the same records; arm D's prompt, `prompt-D.md`, in each project.
- **What we believe, and how sure we are:** The numbers re-derive. What they show is what you named in F12 before the study ran: in A, B and C a reviewer holds evidence the builder has not seen, and in D nobody does. The study says so itself: "That is a reviewer's held-out evidence reaching a builder. It is the same in the package and in the prose." Arm D's one session also ran on a stronger model than arm A's builder.
- **What we most want attacked:** Whether any sentence can be published from S3 that does not read as "structure beats no structure". We think the honest one is about information: a reviewer with evidence the builder lacks, in either form.

### S4 · "No brake fired in any comparison run"

- **Evidence:** `node tools/stops-fired.mjs`; the study's handback.
- **What we believe:** Carried. It is why "bound" stays withdrawn, and why your brake experiment is still needed.

### S5 · What a session was told of where it was

- **Stated at:** the study's handback, "study two's five measures" and "What the five measures do not do".
- **What we believe, and how sure we are:** The study says the tool's name stands in none of the 66 transcripts of B, C and D; that no skill was listed to any session; and that builders in A, B and C were kept from the held-out copy by instruction, with no digest showing one reading it. We scanned the harness's own transcripts on 2026-10-05, a second route from the digests (`tools/study-two-context.mjs`, output in `round-02/lane-notes/study-two-context.txt`). All 24 runs were found, 96 transcripts, each run with the number its record gives. In the 66 of B, C and D no line holds the tool's name. Tools were pointed at the held-out folder's path 79 times, every time by a critic's session; never by a builder's or an owner's, and never by a lead's. Of the 36 builder dispatches in A, B and C, none names that folder's path in its prompt and 26 say the word "held-out". Three builder commands say the word and name no path; we read each, and each writes the builder's own account of what it fixed. What the scan does not test: whether any skill was listed (it looks only for the tool's own), a reach by a path that names neither the folder nor the word, and the study's count of three A leads that amended the builder's declared input.
- **What we most want attacked:** The four things it says its measures do not do, and whether "no digest shows it" is enough given what you found about the digest's parser in F6.

### S6 · Smaller statements

Arm C ran one iteration in all six of its runs. The blind judge ranked both D runs first and second in the two code projects, against the held-out suites. Two templates were run again (`gauntlet-decomposed`, whose check still fails, and `patrol-pulse`, which now passes), so the proving ledger stands at $62.68 over 35 invocations. `docs/comparisons.md` still names the earlier lead model and three replicates where two ran; the study lists both as deviations.

### S7 · Where the package's extra cost goes (a document to audit, not yet on `main`)

- **Stated at:** `experiments/comparisons/derived/lead-cost.md`, with `scripts/lib/compare-lead.mjs` and `lead-cost.json`. Pull request #106, branch `docs/study-two-cost-anatomy`, head `980bcb6` when this was drafted; the driver holds it unmerged until you have read it. Its four new files are laid over your snapshot from that head (`experiments/comparisons/derived/lead-cost.md` and `lead-cost.json`, `scripts/lib/compare-lead.mjs` and its test), and are the only files there that are not at the commit under audit. Its one other change, a line that adds that test to `scripts/compare.sh --test`, is not laid over: run `node --test scripts/lib/compare-lead.test.mjs`. In the snapshot `node scripts/lib/compare-lead.mjs --check` passes and the test's 9 cases pass. The page is headed "derived … not evidence of the runs … not audited", and says at its top that its dollar rates are inferred.
- **Its statements, as they stand at `980bcb6`:** (1) on the mean, all of the difference between the package and the prose is the lead: $0.838 a run against $0.314, with the subagents costing the same on the mean and not in each project; (2) that $0.524 is three parts of about the same size: reading the context back, adding to it, and output; (3) at four dispatches, about half of it falls before the first dispatch and at the reply, and half in the four cycles ($0.276, and $0.062 a cycle); (4) two items are most of it: reading the brief, the graph and the agent files ($0.241), and writing notes and the progress file ($0.222); (5) by arithmetic on twelve runs of four dispatches, about 45% above the prose at 20 dispatches, 30% to 64% by project, and "past that the arithmetic stops being a guide"; (6) the graph document and the agent files, which nothing tells the lead to read, cost $0.088 a run by its count.
- **Evidence:** the script reads the harness's transcripts of the twelve runs (arms A and B), which are on the Mac that ran them and not in the repository; `lead-cost.json` keeps the counts, with no prompt, reply or file content. `node scripts/lib/compare-lead.mjs --check` works anywhere; `--write` only on that Mac.
- **What we believe, and how sure we are:** The arithmetic re-derives. On 2026-10-05 the lane ran `--write` in a scratch checkout of the first head (`ef90ea5`) on that Mac: the page and the JSON came out byte for byte as committed, `--check` passed, and the script's tests pass. At `980bcb6` the same again: `--write` left the checkout unchanged, `--check` passed, 9 tests pass. And the table by file (its Table 10) by a second route of our own, `tools/cost-by-file-second-route.py`, which shares a call's newly cached tokens among the files it read by the characters each returned: the graph document 3,356 tokens and $0.043 a run (the page: 3,346 and $0.043), the agent files 3,393 and $0.042 (3,350 and $0.041), the lead brief 8,365 and $0.106 (8,345 and $0.106); five of the six leads read the graph document, as the page says. The two together come to $0.085 by our route against the page's $0.084, which it makes $0.088 with the calls that read nothing else; we did not recount those. The lane then asked for three of the first head's lines to be qualified, and at `980bcb6` they are: the projection now gives its spread by project and says it has no compaction; "paid again at every dispatch" became where the cost fell in runs of four dispatches; and the table of who was given what no longer says the arms differ "in nothing a builder or a reviewer is given" and cites your F4. So the page has been corrected once by its own side before you see it. Statements (1), (2) and (4) we read as carried descriptions of these twelve runs.
- **What we most want attacked:**
  - Whether the split by kind of turn can be re-derived from the transcripts' usage figures by a second route than the script's own. If you cannot read the transcripts, say so, and check `lead-cost.json` against the page.
  - **The rates.** The script's dollars per million tokens (for the lead's model: input 4, output 20, cache read 0.20, one-hour cache write 8) are "the ones that reproduce every reported per-model cost", not a price list. Are they the only set that does? The three-way split depends on them.
  - Whether the qualified lines are now right, or only quieter: statement (3) still divides the difference in two, and statement (5) still gives a number for 20 dispatches from runs of four.
  - Statement (6): our second route shares a call's tokens the same way the script does, by characters, so it checks the script's counting and not that way of sharing. Is there a better one? And is "nothing tells the lead to read" them true of the brief and the kickoff as compiled? The page itself notes the brief asks a dispatch prompt to carry a node's declared inputs, which are written only in those files.
  - Whether "all of it is the lead" holds by project and not only on the mean: the subagents' difference is −$0.008, +$0.055 and −$0.071.
  - Its section on what a planned change would remove ("about a sixth, not a half"): arithmetic on twelve runs about work not yet built.

### S8 · The derivation rule drops what a dispatch is

- **Where:** `docs/comparisons.md`, section 3, rule 3 ("the loop and its stops restated in one sentence of prose"), and `scripts/lib/compare-prompt.mjs`, which applies it; every `prompt-B.md` of both studies.
- **The fault, found by the lane building the brake experiment (pull request #112, slice 0095):** the package's lead brief says what a dispatch is: "A dispatch is one node run inside this loop's members — an agent you dispatch, or a check you run" (for example `experiments/comparisons/review-gate-2/A-1/package/LEAD.md:89`). The prose derived from it says only "at most N dispatches". We searched the `prompt-B.md` of all seven projects, which arms B and C were given: each names a budget where its graph has one, and none says a check run counts. A prose lead may fairly count agent dispatches only.
- **How far it reaches, by the graphs themselves:** six of the seven loops carry a budget in dispatches. In five of them every member is an agent or a human gate (`red-team-loop`, `review-gate`, `spec-then-loop`, `review-gate-2`, `heterogeneous-critic`), so the two readings count the same there, unless a halt at a gate is counted, which neither text settles. One loop has a check among its members and a budget in dispatches: `taste-polish` (`capture-check`; "at most 5 rounds, at most 16 dispatches"). `grind-loop`'s loop has a check too, and its budget is in minutes; its package carries no such definition.
- **What we believe, and how sure we are:** Sure of the fact. It changed no result of either study: no budget is on record as firing (S4), and in study two none came near under either reading. By the notes, the package runs of `review-gate-2` and `heterogeneous-critic` made four agent dispatches under a budget of 10, and those of `taste-polish` ran six of the loop's nodes under a budget of 16, four of them agents. Every B and C run has four subagent transcripts, two builders and two critics (`round-02/lane-notes/study-two-context.txt`). Study one's runs we have not counted this way. Round one's sentence that the cut-off prompt run was inside the graph's caps stands under either reading: that loop is two agents and no check (round one, F3: "after four dispatches in the second attack round", of twelve allowed). It bears on three things. On `taste-polish` in study two, where a prose lead under "at most 16 dispatches" had a looser budget than the package's lead, by one for every run of `capture-check`. On S7, whose script counts a dispatch as a call of the `Agent` tool and a check as a kind of its own (`scripts/lib/compare-lead.mjs:143`): its "four dispatches" are the prose's reading and not the package's, and for `taste-polish` the two differ. And on the brake experiment's prose control, whose pre-registration allows both readings and reports which a run took.
- **What we most want attacked:** Whether this is one more way the two arms of both studies were not the same design (round one, F4); whether any published sentence leans on the prose arm's budget being the graph's; and whether the rule should carry the definition from here on, which is the owner's to decide and would change every prompt derived after it.

### S9 · A package that contradicts itself about a small budget

- **Where:** `packages/core/src/compile/claude-code/lead.ts:497`. The lead brief gives an example note for a stop that fires, and its text is fixed: "<the stop> fired at round 3". For a budget of two dispatches that cannot happen. The brief states the budget in four places, by the building lane's count, and this one is wrong for a small budget.
- **What we believe:** A product fault, small, and left unchanged on purpose in the brake experiment, whose design changes only the budget and the one sentence that states it; its pre-registration names the example. It is listed for correction after the game experiment's first commits, since nothing under `packages/` changes before them.
- **What we most want attacked:** Whether a lead reading that example could take a budget of two for a round count, and so whether the brake experiment, as designed, tests the budget or the lead's reading of a contradictory brief.

### S10 · Two things a beginner's reader could not work out, and neither could we

Both came from two fresh readers of the plain-English guide (part F), told they knew nothing.

- **How a round cap is counted.** The lead brief says "max iterations: 4" beside "The first pass through the members is round 0" and "The budget of 10 covers 5 full rounds", and does not say whether the cap allows four passes or four returns. The project's own test sizes a dispatch budget as the members that run each pass times the cap (`packages/core/test/patterns.test.ts`), which is the four-pass reading, and one kept lead wrote "max-iterations 0<4" before round 0 (`experiments/patterns/spec-then-loop/run/`, note `n-0006`). Under that reading, with stops checked between passes, the example's budget of 10 cannot fire before its cap of 4. No record shows a cap applied, so no record settles it. This stands beside S9.
- **"Eighteen of twenty" counts the latest run of each template.** Seven earlier proving runs are kept beside the counted ones, in six templates, and by the field guide six of those seven failed their check (`fresh-grind-rare-judge`, `gauntlet-decomposed`, `patrol-pulse` twice with one pass, `review-gate`, `spec-then-loop`, `specialist-critic-bank`). The field guide says so template by template. The status line and decision 0029 say "eighteen pass the project's checks and two are published red" and do not.
- **What we most want attacked:** whether the status line is a fair sentence without the second point, given that round one read it and agreed; and whether "published red" is true of an earlier failed run that is kept in the repository, shown on its template's page, and not counted.

### The one sentence we would publish, if these hold

"In a second comparison, on three tasks built so that a first pass fails, a design with a reviewer who holds evidence the builder has not seen ended above the task alone in every project. Said as a package or as prose it scored the same, and the package cost more. No brake fired."

The owner first read the result as "only certain graphs appear to be worth that extra cost". The driver corrected that to him: no graph earned its cost over the same design said as prose; what ended above the task alone was the design. Hold any wording to that distinction.

## Part C · Decision 0029

`docs/decisions/0029-what-is-shown-as-of-the-first-audit.md`. The audit lane drafted it and the owner accepted it on 2026-10-05 with the corrections. It restates what is and is not shown, withdraws "bound" until a record shows a brake binding, holds study two until you have read it, corrects three statements of decisions 0012 and 0013 without editing them, and (its sixth point, added after #114) holds what `grooph adopt` refuses out of every claim until you have read part E. It carries two dated notes added after it was signed: one where it said the app's button does not make the comparison, which was untrue by twelve minutes when it was signed, and one for decision 0008's line "Budget and iteration stops, which it cannot loosen, bound that".

- **What we most want attacked:** Whether "What is shown" says more than round one agreed. Whether anything round one agreed is missing from "What is not shown".

## Part D · The brake experiment

`designs/a-brake-that-binds.md`: your design, with two additions (the game experiment's clean profile; a record of what each session was given). It has since been built, with no model session started: `experiments/brakes/budget/` holds the pre-registration and the arms (pull request #112), and the script that would start a paid run is written and starts nothing until it is told to spend (#122). Nothing has been run. The owner has parked the paid runs until after a pause.

- **What we most want attacked:** Whether the design was changed in the writing up or in the building, and whether the additions cost it anything. Two things the build turned up are in part B as S8 and S9: the prose control's budget does not say what a dispatch is, and the compiled brief's example note contradicts a budget of two.

## Part E · The comparison of brakes, and what is refused when a changed graph is taken up

Round one agreed that nothing in grooph refused a loosened brake (your F6, and our probe: a working copy with its cap raised from 4 to 40 and its budget from 10 to 400 was adopted). Four pull requests answered that on 2026-10-05, and all four are in your snapshot:

- **#114**: `grooph adopt --write` compares the document it would write with the source it would replace, by the comparison a subgrooph's refresh (`grooph sub update`) was already held to, and does not write while a change that loosens a brake has not been asked for by name with `--allow`.
- **#117**: the web app's Adopt button makes the same comparison, and saves nothing for a loosened copy. It offers no way to say yes, only the command to copy.
- **#132**: a check is a brake (amendment A-019, on the owner's answer to a question this audit raised). The comparison holds a check's definition, every edge that leaves it, its removal, and a new way to what its pass led to that does not pass it.
- **#135**: two sentences of the tool's own that said "cannot": the outline now prints "is told never to loosen a brake", and the design skill says the same.

This is the first thing outside the validator that refuses anything about a brake, so it is the first candidate for a sentence with "enforce" in it. The commands' own documentation describes it. No claims page states it as shown, and none will until you have read it.

- **The files:** `packages/core/src/brakes.ts` (the comparison), `reach.ts` (what a run reaches without a decision), `adoption.ts` (`checkAdoption`), `subgrooph.ts` (`refreshSubgrooph`), `packages/cli/src/commands/adopt.ts`, and in the app `apps/web/src/ui/run/brakes.tsx`. Tests: `packages/core/test/adoption.test.ts` and `subgrooph.test.ts`, `packages/cli/test/runs.test.ts`. Documents: `docs/runs.md` ("`grooph adopt` holds a working copy to the source's brakes" and, under it, "What adoption does not hold"), `docs/graph-ir.md` §2, `docs/templates.md` ("Refreshing"), `docs/cli.md`, and the row for A-019 in `spec/AMENDMENTS.md`.
- **The sentence we would publish, if it holds:** "`grooph adopt` and the app's Adopt button do not take a run's working copy that loosens a brake their comparison sees, until each such change is asked for by name; a subgrooph's refresh holds a newer template to the same comparison. Whoever runs the command can ask, a session included: the refusal prints the flag that passes. `grooph export` makes no such comparison, so a loosened graph exported over a package replaces it. The comparison has not been shown complete, and nothing checks a brake while a run goes on."
- **Evidence:**
  - **Our probes, at the commit of your snapshot.** `bash experiments/audits/0001-claims-as-of-0-3-0/tools/run-all-probes.sh` runs all nine and writes what each prints to `round-02/lane-notes/at-the-snapshot/`. The files beside that folder are what the same probes printed earlier that day, before the change that answered each. Run it yourself; it calls no model and writes only there and in a scratch folder.
  - **The tests,** run by the lane at that commit: the 29 of `adoption.test.ts`, the 493 of core and the 136 of the command-line package pass.
  - **The readers' scripts.** By its author's account, eight fresh readers inside Claude Code, one after another, were each asked to break the comparison by running code: three on a refresh, two on adoption, three on the check kind. Each found something the one before had not; each finding is closed and is a test. Their scripts and what they printed are in `round-02/brakes-probes/`, with `run-all.sh` (#121, #132). We have not run them ourselves. Run them.
- **What the probes print at the snapshot.**

  | Probe | Case | Earlier that day | At the snapshot |
  |---|---|---|---|
  | `adopt-probe.sh` | cap 4 to 40 and budget 10 to 400, through `grooph adopt --write` | written as version 2 (at 0.3.0) | refused, exit 1; written with `--allow` |
  | `check-verdict-probe.mjs` | a check's command made `true`; its two verdicts swapped; an edge added round the check | each adopted | each refused by name |
  | `check-through-command.sh` | the first two of those through the command, on the kept `grind-loop` record | exit 0, version 2 | exit 1, nothing written |
  | `halt-to-success-probe.mjs` | the stop a check's failure leads to, changed from a halt to success, no person in the graph | adopted | **adopted** |
  | `new-stop-probe.mjs` | a critic's failing edge led to the success stop the graph has, which only its pass reached | refused | refused |
  | | the same edge led to a NEW stop that ends in success; an edge added from the critic to one | adopted | **adopted** |
  | `gate-and-reached-probe.mjs` | a critic's failing edge led to a success stop a run already reaches another way | adopted | **adopted** |
  | | a gate's "no" led to the success stop only its "yes" reached | refused | refused |
  | | a gate's "no" led to a NEW stop that ends in success | adopted | **adopted** |
  | | the halting stop a gate's "no" leads to, made a success, where a check's failure also leads there | refused | refused |
  | `constraints-probe.mjs` | the graph's own `constraints.budget` raised; an edge's `retry`; an edge's `concurrency` | adopted | **adopted** |
  | `export-door-probe.sh` | a copy with its cap raised, exported over a package in place; a run's working copy exported after `adopt` refused it | placed, exit 0 | **placed, exit 0** |

  If your snapshot's `at-the-snapshot/` differs from this table, the files are right and the table is not.
- **What we believe, and how sure we are:** Sure of what the probes print. That the comparison refuses every loosening we do not believe, and its author does not claim: `brakes.ts` says at its head that its list "is what a brake has been found to be, not a proof that nothing is missing from it", and the table above has six rows in bold. We have read `adoption.ts`, `reach.ts` and `brakes.ts` whole as they stood after #114, as a reader and not as an attacker; we have not read the check kind's code line by line. Five limits belong in any sentence about it:
  - **It is a check at a door after a run.** Nothing checks a brake while a session runs: that is still the lead's brief.
  - **It is at three doors and not a fourth.** `grooph adopt`, the app's Adopt button and a subgrooph's refresh make it. The app's "Apply to a copy" for a proposal makes it too since #136, and says by name what the copy loosens; it tells and does not refuse. `grooph export` does not make it at all. The owner ruled on 2026-10-05 that the plain command will, before 0.4.0; at your snapshot it compares nothing.
  - **It is refused "unasked", not "without a person"** (the driver asks that this one stay in whatever is published). Whoever runs the command can pass `--allow`, and the refusal prints the flag to pass. A session that runs the command reads that line.
  - **A graph file is a file.** Nothing stops a hand, or a session, copying a working copy over its source.
  - **One name can carry more than it says.** `node:<id>.check` is one name for a check's whole definition, so a command made `true` rides on the name allowed for a reworded pass text. `edge:<id>.evidence` is one name whether evidence was added or swapped. A check given another id is held as a removal, and allowing that one name lets through whatever came with it. Said as limits in `docs/runs.md`. These three are from the driver's reader; we have not run them.
- **What is not held, and where each stands.**
  - *A stop that halts, made to end in success.* Adopted at the snapshot where a check's or a critic's verdict leads to it and no person stands before the end. The owner ruled on 2026-10-05 that any halting stop made a success is to be held, wherever it stands, which is wider than his earlier words ("a check's command and where its outcomes lead are brakes"). That is a draft follow-up to #132 and is not in your snapshot.
  - *A critic's verdict, or a gate's answer, led to a stop that ends in success.* Held when the stop was in the graph and only that verdict's pass, or that gate's other answer, reached it. Not held when the stop is new, nor when a run already reached it another way. The follow-up is said to hold these for a critic by asking how a run ends without a verdict's pass, and to state the gate's case as a limit. Check the words of that limit, when you see them, against the gate's rows in the table.
  - *The graph's own budget line, an edge's `retry` and `concurrency`.* Amendment A-008's list says "budget and max-iteration stops", which are a loop's, and graph-ir §1 calls `constraints` "free-text hints, surfaced in the lead brief". By the letter these are outside the list. The help of `grooph adopt` and of `grooph sub update` lists the brakes as "a round cap, a budget" and "a budget or a round cap", with no word that a loop's stop is meant. **Do they belong on the list?**
  - *A change of harness.* By the driver's reader of the Codex target (#127, not in your snapshot): a working copy whose target harness a run changed from `claude-code` to `codex` is adopted, listed and not held. The harness is not on A-008's list. The owner ruled on 2026-10-05 that it will be held, in a slice after the pause. We have not run this.
  - *The author's own list.* `docs/runs.md`, "What adoption does not hold", names eight, the export door among them, each run once before it was written.
- **One case to take as it is.** #132's description, "One refresh where main held a name for cause and this applies it": in 16,243 random refreshes there is one, on `metric-sandwich`, where the code before #132 held `edge:e-s-builder-s-checks.when`, the edge that leads into the check made conditional, and the code after it applies it. Its author reads the earlier hold as a bystander's and says the written graph has no new error and no loss by either build's comparison. It is the one case anyone has found of a name held for cause that the check kind lets through. Say whether that reading holds.
- **The questions its author asked before the check kind, in the author's order.** The full text is in `handoffs/0085-subgroophs/HANDBACK.md`, "For the audit of `brakes.ts`, in this order"; each is a question and not a finding.
  1. **Where does a run start, for the comparison?** Graph-ir §2 says a node that only a loop's stop continues at is no entry node. The comparison still starts a run at every node no edge leads into (`startsOf` in `reach.ts`). The case is on the built-in `gauntlet-decomposed`. Is the narrower rule safe there?
  2. **A gate's answer gains an edge to a node the run already reached without it.** Not held. Nothing is newly reached without the answer; what the answer means to the person giving it has changed.
  3. **A critic whose verdict edges are taken away, so that it leads nowhere.** Core returns it with nothing held; `sub update --write` does not write a graph that gains an error. Should core hold it?
  4. **A way round a loop that a person newly opens each time is not refused.** The loop's cap then counts the rounds between two of that person's decisions and not the run. The driver ruled that it stays open, since the person is the brake, and that it be said by a printed note. Press on the edges: a human stop with a huge `every`, a gate with one answer, an approval put on a lap only to exempt a way round.
  5. **A loop or a policy under another id, nothing else changed, is refused** as one removed. It errs on the safe side and costs an `--allow`. Is that the right price?
  6. **A loop emptied without removing anything is not held:** its old steps kept with their briefs and commands reduced to nothing, the work done by new steps under a second loop with a cap of 1000.
- **What we most want attacked:**
  - **Get a loosened working copy adopted with nothing refused and nothing asked for**, by a road that is not in the table or in the author's list. You may run the built command in the snapshot on copies in your own folder; write nowhere else. A ninth reader finding something is the expected result. What matters is its kind: one more case of a rule the file already has, or a kind of brake its list does not have.
  - **The two changes the check kind lets through unasked**: an approval newly asked on an edge that already left a check, and evidence added to what such an edge hands a critic with none taken away. The exception first written was wider ("whatever the comparison marks as a tightening"), was the audit lane's own wording, and when built it let failing tests end in success. Is the narrow one safe?
  - **The verb.** Is "refuses" right when the one refused is told the flag that passes? Is "until asked for by name" an honest account of what a person, and what a session, has to do, given that one name can carry more than it says?
  - **"Wherever it stands."** The owner has said yes to holding every halting stop made a success. Is a stop's outcome a brake, or a label?
  - **Whether the documents already say more than the tests carry**, in `docs/runs.md`, `docs/graph-ir.md` §2, the commands' help and the row for A-019; and whether any public sentence reads as if a loosened copy cannot reach a project, when what is true is that three named doors hold one. Decision 0008 still says "Budget and iteration stops, which it cannot loosen, bound that"; decision 0029 carries a dated note on it.
  - **The cost of the safe side.** An honest change now costs an `--allow` in common places: a gate put behind a check's pass, evidence added on a check's edge to a builder, a loop under another id. A check that refuses honest changes is one people learn to pass `--allow` to.
  - Whether the corrected sentences that name this refusal say too much: the claims page's row for C45, the report's row for adaptation and `docs/graph-ir.md` §2 (part A4), each changed three times that day as the code moved.

## Part F · A guide for beginners

**Parts A to E come first.** If you run short of room, stop here and say so: the guide must not cost the claims their read. It is long: `docs/plain-english/`, sixteen files, about 27,500 words, written by the audit lane at the owner's request (pull request #129). It is in your snapshot as it stands on `main`, with its follow-up (#141) and one more change made with this handoff: chapter 3's example of the irreversible rule, which prints differently since #133. It is not on the site and says at its top that it has not been audited and must be before any of it is published. It was written under one rule: it says nothing about what grooph is shown to do that decision 0029 and `docs/claims.md` do not say, in words a beginner can follow.

- **Evidence that it keeps the rule:** two fresh readers inside Claude Code, told they knew nothing and could read only the guide, wrote down what they came away believing. The first held six beliefs that were wrong or unsupported; each was corrected at its source. The second answered sixteen pointed questions and all sixteen matched the facts. Every `grooph` command it prints was run and its pasted output compared by script with the saved output.
- **What we most want attacked:** read chapters 1, 5, 7, 13 and 14 as a beginner would and say what a reader would come away believing that the records do not carry. A simpler sentence is where a qualification is most easily lost. In particular: chapter 1's table of what has force during a run; chapter 13's "What you can count on"; and chapter 7's account of the adoption check.

## What is in your snapshot, and what is not

In it, all merged on 2026-10-05 after the commit you read in round one: the corrections (#105, #108, #125, #130), decision 0029 and amendment A-019 (#118), adoption held to the brakes (#114) and in the app (#117), the check kind (#132), the tool's own words (#135), the notice on "Apply to a copy" (#136), the irreversible rule at the start of a run (#133), the readers' probes of the comparison (#121), the dated note on study one (#123), the brake experiment built and its paid path parked (#112, #122), and the plain-English guide (#129, #141).

Not in it, with each pull request's head as it stood when the snapshot was cut:

| Pull request | Head | What it is | Bears on |
|---|---|---|---|
| #142, a draft | `fec177b` | The follow-up to #132: a failing verdict that would end in success is held (a halting stop made a success, wherever it stands; a critic's verdict led to a new stop), and the line printed for a check under another id | Part E: the rows in bold for a halting stop and for a critic. The owner has said yes to its wide clause |
| #60 | `9add832` | grooph for agents: authoring tools over MCP, a package for npm, and `grooph export` making the comparison. Sent back by a reader for fixes | Part E: the export door stays open at your snapshot |
| #127 | `bb1b35a` | The Codex compile target, in its second fix pass | Part E: a change of harness |
| #128, with #138, #139 and #140 as drafts behind it | `adee9e0` | Other kinds of 3D for a graph | Nothing in this round |
| #54 | `c27b2ac` | A page of questions people ask | Nothing in this round; its sentences will need the audit before it is published |
| #106 | `980bcb6` | The cost page of study two | Part B, S7: its four new files are laid over your snapshot |
| #137 | `fe0fbf9` | The house lane's handback at the pause | The six questions of part E are from its earlier handback, which is in your snapshot |

## If your handback is finished while the project is paused

The owner means to pause work on grooph for a while after this round is sent. That changes nothing in what you are asked to do.

- Write your handback where round one's went: `round-02/HANDBACK.md` in this folder, with your notes in `round-02/notes/`. Write nowhere else and change nothing in the repository or the snapshot.
- Nothing in this folder reaches a page, the site or `main` by itself. No claim changes on a handback alone: study two's results stay off every page, and every sentence about adoption keeps "a brake its comparison sees", until the handback has been reconciled and the owner has decided the corrections, as in round one.
- End your reply, as before, with the prompt the owner should carry back. If nobody carries it, the handback stays on disk and the audit lane finds it there, as it did in round one.

## What we already know is weak

- Everything in round one's list still holds for study one.
- Study two: two replicates; one author for the tasks; round-0 counts for B and C derived from transcripts outside the repository; builders kept from held-out evidence by instruction; no brake fired; the judge and the suites disagree by construction.
- The corrections were written by the same lane that reconciled the round. Nobody else has read them.
- The comparison of brakes: every reader so far has found something in it, all of them inside Claude Code; and the one who is refused can ask.

## What to hand back

`round-02/HANDBACK.md`, from the template beside this file. Number findings F1, F2, … afresh. For part A name the correction by its number; for part B name the claim S1 to S10, for part E the question E1 to E7 or the limit it bears on, and for part F the chapter. Say what you checked and found sound, and what you could not check. End your reply with the prompt the owner should carry back.

## The prompt for Codex

The owner opens Codex on `/Users/noir/Documents/grooph-exchange/codex/0001-claims-as-of-0-3-0/` and pastes this.

```text
You are the auditor of grooph's claims, opened on /Users/noir/Documents/grooph-exchange/codex/0001-claims-as-of-0-3-0/. This is round two. Read /Users/noir/Documents/grooph-exchange/README.md, then round-02/HANDOFF.md in this folder, and do what it asks; round-01/ holds your first handback and the reconciliation. The repository to read is the snapshot at /Users/noir/Documents/grooph-exchange/snapshots/0001-claims-as-of-0-3-0-round-02/ (installed and built). Change nothing in the snapshot or in the grooph repository: write only inside this folder, and when you run a probe that needs a scratch folder, give it one inside this folder. Start no model session and run no new experiment; commands that only read, and the probes the handoff names, are fine. Be a skeptic and be fair: the corrected sentences are new and can overstate as the old ones did, study two has been read by nobody outside Claude Code, and the code that refuses a loosened brake was written and extended in one day. Parts A to E come first; part F, a long guide, is last. Write round-02/HANDBACK.md from round-02/TEMPLATE-AUDIT-HANDBACK.md, keep working notes in round-02/notes/, and end your reply with the prompt I should carry back to the audit lane.
```
