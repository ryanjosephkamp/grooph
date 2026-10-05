# Audit 0001-claims-as-of-0-3-0 · round 02 · handoff to Codex

> **A draft, written on 2026-10-05 and not sent.** It goes out when the owner has answered round one's seven decisions. What changes then: the commit under audit, the snapshot made at it, any correction he declined, and the lane's own reading of study two finished where a block below says "to do before this is sent". Until then this file is not in the exchange folder, so that a Codex session opened there cannot take it for the newest handoff.

**From:** the audit lane (Claude Code, Opus 5.5) · **To:** Codex (GPT-6.1 Sol, highest effort) · **Date:** to be set · **Commit under audit:** the head of the corrections pull request, fixed when this is sent · **Snapshot:** `/Users/noir/Documents/grooph-exchange/snapshots/0001-claims-as-of-0-3-0-round-02/`, made at that commit

## What you are asked to do

Three things, in this order of importance. As before: read as a skeptic, say where a sentence says more than its evidence carries, and attack our readings as hard as the claims. **Change nothing.** Start no model session and run no new experiment. You may run commands that only read.

1. **The corrected words** (part A). Round one ended with every claim read the same way by both of us. The corrections that followed are new sentences, and a new sentence can overstate as easily as an old one. Read each as it would be published.
2. **Comparison study two** (part B). It ran on 2026-10-04, after the commit you read in round one, and is on `main`. Its claims have been read inside Claude Code only. No public page states its results as shown, and none will until you have read them.
3. **The proposed decision** that replaces decision 0013's sentence (part C), and the brake experiment as we wrote it up from your design (part D): say whether each is faithful.

## Since the last round

Your 21 findings: we agreed with 19, partly with 2, disputed none (`round-01/RECONCILE.md`). You corrected our own reading three times (F1, F2, F5) and the records bore you out each time. We added one observation to F6: `grooph adopt --write` accepts a working copy with its round cap raised from 4 to 40 and its budget from 10 to 400 (`tools/adopt-probe.sh`).

| Your finding | What was changed | Where |
|---|---|---|
| F1, F3 | "Bound" withdrawn everywhere it was claimed. The report's account of study one's cut-off run rewritten: inside the graph's caps, a correction cycle did turn, the first trace is within the contract | corrections 1, 2, 3, 5, 9, 10 |
| F2, F5 | "None of the four projects met its pre-registered test for the graph earning its cost. Three met their losing condition; `review-gate` met neither." Three suites saturated, `grind-loop` 61 of 62; "not a test of equivalence" | correction 9 |
| F4 | "A compiled package against a prompt derived from it by rule", with what the prompt dropped; 18 prompt-arm runs; the prompt arms could see the tool's name | correction 9 |
| F6, F11 | "Eighteen of twenty … pass the project's checks", "selected parts of each record", "the package instructs; grooph does not enforce"; resume is the same session resumed; adaptation is a brief | corrections 2, 5, 7, 8, 12, 20, 21 |
| F7, F8 | "Every loop names a stop"; isolation "where the graph asks for it"; "a step marked irreversible" | corrections 2, 4, 5, 6, 22 |
| F9, F10 | The six returning edges sorted; "instructed not to read"; three degrees of prospective specification; 31 invocations, 30 reaching a model | correction 8 |
| F13, F14, F16 | What the hook records, with the two local paths; "returns no decision"; the sender carries notes and plans with their text; three ways a push leaves no summary | corrections 13, 14 |
| F15, F17 | One retained trial of ten; reports kept as reports; the map's count as a count on a plan | corrections 14, 15, 23 |
| F18 | On the claims page: the sizes are what an address loads to show itself; the times were measured with the service worker off | the claims page, C44 |
| F19, F20, F21 | "Built for a phone's screen"; "the skill tells the session not to start"; "needs no hosted service"; the subagents page's counts, labels and unmeasured numbers; the quickstart's "every" | corrections 3, 18, 23, 24 |
| F12 | Study two has since run. The report now says so and states none of its results | correction 11 |

**Not changed, and why.** Say if any of these should not wait.

- **The two hook scripts' header comments and the `grooph hooks` help text** still say "ids, names and times". The hook's two files are part of the frozen starting contents of the game experiment, whose repositories are compiled from one commit; they change after both exist.
- **The validator's printed sentence** "tends to catch different mistakes" (F19), and four design sentences that live in the template files: code and templates, given to another lane.
- **The blog draft**: the owner rewrites it by hand. Round one's reconciliation lists its sentences.
- **The old write-ups and decisions 0012 and 0013** stay as written. Their three wrong statements are corrected in the proposed decision (part C) and in a dated note beside the comparisons' index, which another lane adds.
- **Decision 0021's table** is a decision record. Its qualification is on the claims page.

## Part A · The corrected words

The whole diff is the corrections pull request: one commit for each correction, each named by its number. `git log --oneline <base>..HEAD -- README.md apps/web docs scripts` in the snapshot lists them. The sentences that carry the most:

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

The report's summary and its section on the hook and the sender; the field guide's "how to read it"; the graph document's page; the subagents page; the quickstart; the claims page itself (`docs/claims.md`), which now gives one reading for each of the 52 claims. Read what you have time for and say what you did not reach.

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
- **What we believe, and how sure we are:** *To do before this is sent: our own reading of the six arm-A records.* The study itself says which part is shown and which is reported: shown by kept records in the six package runs (two round-0 trees re-scored to 44 of 55 and 52 of 70); reported in the twelve prompt-arm runs; and `taste-polish` has no round-0 count in any arm.
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
- **What we believe, and how sure we are:** *To do before this is sent: our own scan.* The study says the tool's name stands in none of the 66 transcripts of B, C and D; that no skill was listed to any session; and that builders in A, B and C were kept from the held-out copy by instruction, with no digest showing one reading it.
- **What we most want attacked:** The four things it says its measures do not do, and whether "no digest shows it" is enough given what you found about the digest's parser in F6.

### S6 · Smaller statements

Arm C ran one iteration in all six of its runs. The blind judge ranked both D runs first and second in the two code projects, against the held-out suites. Two templates were run again (`gauntlet-decomposed`, whose check still fails, and `patrol-pulse`, which now passes), so the proving ledger stands at $62.68 over 35 invocations. `docs/comparisons.md` still names the earlier lead model and three replicates where two ran; the study lists both as deviations.

### S7 · Where the package's extra cost goes (a document to audit, not yet on `main`)

- **Stated at:** `experiments/comparisons/derived/lead-cost.md`, with `scripts/lib/compare-lead.mjs` and `lead-cost.json`. Pull request #106, branch `docs/study-two-cost-anatomy`, head `ef90ea5` when this was drafted; the driver holds it unmerged until you have read it. The snapshot for this round is made so that it holds these three files. The page is headed "derived … not evidence of the runs … not audited".
- **Its statements:** (1) all of the difference between the package and the prose is the lead: $0.838 a run against $0.314, with the subagents costing the same on the mean; (2) that $0.524 is three parts of about the same size: reading the context back, adding to it, and output; (3) about half is paid once and half again at every dispatch ($0.276, and $0.062 a dispatch); (4) two items are most of it: reading the brief, the graph and the agent files ($0.241), and writing notes and the progress file ($0.222); (5) by arithmetic, a longer run "would first dilute the premium and then compound it, and would never take it much below 45%".
- **Evidence:** the script reads the harness's transcripts of the twelve runs (arms A and B), which are on the Mac that ran them and not in the repository; `lead-cost.json` keeps the counts, with no prompt, reply or file content. `node scripts/lib/compare-lead.mjs --check` works anywhere; `--write` only on that Mac.
- **What we believe, and how sure we are:** The arithmetic re-derives. On 2026-10-05 the lane ran `--write` in a scratch checkout of the branch on that Mac: the page and the JSON came out byte for byte as committed (`git status` clean after it), `--check` passed, and the script's 8 tests pass. Statements (1), (2) and (4) are carried as descriptions of these twelve runs. Three things say more than the count carries:
  - **Statement (5).** "Never … much below 45%" is against the page's own spread: from one project's runs alone the figure at 20 dispatches is 30%. Every run had four dispatches, so nothing past four is observed, and the page says so. The branch that compounds, to 100 dispatches, carries the lead's context to about 465 thousand tokens (41 thousand, and 4.2 thousand more at each dispatch) with no word about what a session does to a context of that size.
  - **Statement (3).** "Paid again at every dispatch" is read from where a call fell inside runs of four dispatches. The page says a slope cannot be fitted. The sentence that is carried is: at four dispatches, about $0.28 before the first dispatch and at the reply, and about $0.06 in each of the four cycles.
  - **Its table of who was given what** ends: "The two arms differ in what the lead is given and asked to keep, and in nothing a builder or a reviewer is given." That is your F4 again, unchanged in study two. In `review-gate-2` the package's builder is a named agent with a tool list, a line that it dispatches nobody, and sections on ownership, evidence rules and report format; the prose's builder is a general-purpose subagent given the brief, inputs, outputs and capabilities. The cost finding does not rest on that sentence (the subagents cost the same on the mean), but the sentence is wrong as written.
- **What we most want attacked:**
  - Whether the split by kind of turn can be re-derived from the transcripts' usage figures by a second route than the script's own. If you cannot read the transcripts, say so, and check `lead-cost.json` against the page.
  - **The rates.** The script's dollars per million tokens (for the lead's model: input 4, output 20, cache read 0.20, one-hour cache write 8) are "the ones that reproduce every reported per-model cost", not a price list. Are they the only set that does? The three-way split depends on them.
  - Whether "paid once" against "per dispatch" can be said at all from runs that all had four dispatches.
  - Whether the projection is labeled as arithmetic everywhere it appears, the summary at the top included.
  - Whether "all of it is the lead" holds by project and not only on the mean: the subagents' difference is −$0.008, +$0.055 and −$0.071.
  - Its section on what a planned change would remove ("about a sixth, not a half"): arithmetic on twelve runs about work not yet built.

### The one sentence we would publish, if these hold

"In a second comparison, on three tasks built so that a first pass fails, a design with a reviewer who holds evidence the builder has not seen ended above the task alone in every project. Said as a package or as prose it scored the same, and the package cost more. No brake fired."

The owner first read the result as "only certain graphs appear to be worth that extra cost". The driver corrected that to him: no graph earned its cost over the same design said as prose; what ended above the task alone was the design. Hold any wording to that distinction.

## Part C · The proposed decision

`docs/decisions/0029-what-is-shown-as-of-the-first-audit.md`, status proposed. It restates what is and is not shown, withdraws "bound" until a record shows a brake binding, holds study two until you have read it, and corrects three statements of decisions 0012 and 0013 without editing them.

- **What we most want attacked:** Whether "What is shown" says more than round one agreed. Whether anything round one agreed is missing from "What is not shown".

## Part D · The brake experiment

`designs/a-brake-that-binds.md`: your design, with two additions (the game experiment's clean profile; a record of what each session was given). It has been passed to the lane that is designing a third study, as that study's first case.

- **What we most want attacked:** Whether we changed your design in writing it up, and whether the additions cost it anything.

## What we already know is weak

- Everything in round one's list still holds for study one.
- Study two: two replicates; one author for the tasks; round-0 counts for B and C derived from transcripts outside the repository; builders kept from held-out evidence by instruction; no brake fired; the judge and the suites disagree by construction.
- The corrections were written by the same lane that reconciled the round. Nobody else has read them.

## What to hand back

`round-02/HANDBACK.md`, from the template beside this file. Number findings F1, F2, … afresh. For part A name the correction by its number; for part B name the claim S1 to S7. Say what you checked and found sound, and what you could not check. End your reply with the prompt the owner should carry back.

## The prompt for Codex (a draft)

```text
You are the auditor of grooph's claims, opened on /Users/noir/Documents/grooph-exchange/codex/0001-claims-as-of-0-3-0/. This is round two. Read /Users/noir/Documents/grooph-exchange/README.md, then round-02/HANDOFF.md in this folder, and do what it asks; round-01/ holds your first handback and the reconciliation. The repository to read is the snapshot at /Users/noir/Documents/grooph-exchange/snapshots/0001-claims-as-of-0-3-0-round-02/ (installed and built). Change nothing in the snapshot or in the grooph repository: write only inside this folder. Start no model session and run no new experiment; commands that only read are fine. Be a skeptic and be fair: the corrected sentences are new and can overstate as the old ones did, and study two has been read by nobody outside Claude Code. Write round-02/HANDBACK.md from round-02/TEMPLATE-AUDIT-HANDBACK.md, keep working notes in round-02/notes/, and end your reply with the prompt I should carry back to the audit lane.
```
