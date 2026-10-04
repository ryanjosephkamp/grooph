# Audit 0001-claims-as-of-0-3-0 · round 01 · handoff to Codex

**From:** the audit lane (Claude Code, Opus 5.5) · **To:** Codex (GPT-6.1 Sol, highest effort) · **Date:** 2026-10-04 · **Commit under audit:** `dbc7a281f977dddf7acc7948a0221e2aba93c5e4` (`main`, version 0.3.0, what the site serves today; eleven commits after the tag `v0.3.0`, which changed spelling in the files below and no claim) · **Snapshot:** `/Users/noir/Documents/grooph-exchange/snapshots/0001-claims-as-of-0-3-0/`

## What you are asked to do

Read the claims below and the evidence behind them, as a skeptic. Say where a claim says more than its evidence carries, where the method would not survive a careful reader, and where an analysis is wrong. That includes our analysis: for each claim we say what we believe, and several times we say a published claim is not carried. Attack those readings as hard as the claims. Take notes as you go and write a handback. **Change nothing**: not the snapshot, not the repository. Start no model session and run no new experiment. You may run commands that only read.

Nothing grooph publishes has been read by a second harness before. This is the first audit.

**Order of importance.** Groups A, B and C are the claims of value and the evidence for them: spend most of the round there. Group D is what the validator is said to refuse. Groups E to H are narrower. If the round runs short, say which groups you did not reach.

## What grooph is, in five lines

1. A person or an agent writes one small JSON **graph document**: agents (builder, critic, …), checks, human gates, the edges between them, and loops with their **stops** (a bar passed, a round cap, a budget, a person).
2. A **validator** refuses some documents (`E_` rules) and warns about others (`W_` rules).
3. A **compiler** turns a valid document into a **prompt package** for Claude Code: a lead brief, one subagent file per agent, a skill, a kickoff note. A Claude Code session reads the package and runs the work. grooph itself runs no agent and calls no model.
4. The session writes a **run record** as it goes (`notes.jsonl`, `PROGRESS.md`, a working copy of the graph).
5. The evidence is twenty **proving records** (one kept headless run per template, `experiments/patterns/`) and one **paired comparison** of four templates against the same design given as a prompt (`experiments/comparisons/`).

## Commands that only read

Run from the snapshot root. None calls a model. The first three are the project's own; the last four are ours, written for this audit, and sit beside this file in `tools/`.

```bash
cd /Users/noir/Documents/grooph-exchange/snapshots/0001-claims-as-of-0-3-0
node scripts/lib/prove-summary.mjs                 # the proving table, from the records
node scripts/lib/compare-summary.mjs --index       # the comparison table, from the records
node scripts/field-guide.mjs --check               # re-runs the proving check on all twenty kept records
scripts/prove-pattern.sh <id> --check experiments/patterns/<id>/run    # one record's check, with its facts and problems
node scripts/rule-reference.mjs --check            # the rule reference against the fixtures
node scripts/perf-budget.mjs --check               # sizes of the built app, and the CLI's cold start

T=/Users/noir/Documents/grooph-exchange/codex/0001-claims-as-of-0-3-0/round-01/tools
node $T/stops-fired.mjs                            # every stop that fired and every halt, in all 33 run records
node $T/comparison-facts.mjs                       # per run of the comparison: cost, time, subagents, turns
bash $T/validator-probes.sh <a folder you may write in, for example round-01/notes/probes>   # what the validator refuses and what it lets through
node $T/prompt-arm-context.mjs                     # what named grooph to study one's prompt arms; reads ~/.claude/projects, see the last section
```

What they printed for us on 2026-10-04 is quoted under the claims they bear on.

## The claims

Fifty-two claims in eight groups, C1 to C52. A claim that is published in several places in nearly the same words is one claim, with each place listed. Line numbers are in the snapshot. "Carried" means the evidence supports the sentence as a careful reader would take it.

---

## Group A · What grooph is shown to do

The same sentence appears on the README, the front page, the blog draft and the field guide. It comes from decision 0013 (`docs/decisions/0013-value-as-of-study-one.md`), which the front page links to as "The evidence". We split it into its three positive parts and its negative part.

### C1 · "grooph is shown to bound … autonomous work"

- **Published at:**
  - `README.md:47` — "On that evidence, grooph is shown to bound and record autonomous work and to hold a design as a runtime contract."
  - `apps/web/src/ui/landing/Landing.tsx:183` (the front page, https://ryanjosephkamp.github.io/grooph/) — "In twenty proving runs and one paired comparison, grooph is shown to bound and record autonomous work and to hold a design as a runtime contract."
  - `docs/blog/2026-10-loop-graphs.md:78` — "grooph is shown to bound and record autonomous work, and to hold a design as a contract while it runs."
  - `docs/field-guide.md:42` — "As of study one the evidence shows that grooph bounds and records autonomous work and holds a design as a runtime contract"
  - `docs/report/grooph-technical-report.md:12` — "A package bounds the work. In the one comparison run so far, the only run that went past its bounds was a prompt-only run."
  - `docs/report/grooph-technical-report.md:101` — "Bounding is the one place structure showed."
  - `docs/blog/2026-10-loop-graphs.md:70` — "Where the arms differed, it was in stopping. One prompt run kept attacking its own work until it hit the $9.00 ceiling, at $9.02 and almost 25 minutes. Both graph runs of the same project stopped by the graph's own edge, for $2.63 and $3.57."
  - `docs/decisions/0013-value-as-of-study-one.md:12` — "Brakes. The only run in study one that went past its bounds was a prompt arm running to the dollar ceiling; both graph runs of that project stopped by their own edge at a third of the cost. Dispatch budgets, round caps and gates are the one place structure showed."
- **Evidence:** `experiments/comparisons/red-team-loop/README.md` ("The one cut-off"); `experiments/comparisons/red-team-loop/B-1/` (`result.json`, `claude-output.json`, `transcript-digest.json`, `project.diff`); `experiments/comparisons/red-team-loop/prompt-B.md:60` (the caps the prose arm was given); `A-1/` and `A-2/` with their `runs/*/notes.jsonl`; every `notes.jsonl` under `experiments/`; `tools/stops-fired.mjs`.
- **What we believe, and how sure we are:** **Not carried as worded.** We are sure of the facts and fairly sure of the reading.
  1. *No cap or budget has ever fired on record.* `stops-fired.mjs` reads all 33 run records (20 kept proving runs, 4 replaced ones, 9 arm-A runs of the comparison): "Stops named in a note's stop field, by kind: {"bar-passed":18,"human":1}". No `max-iterations`, no `budget`, no `diminishing-returns`. A text search of every note for a cap or a budget that fired finds none, and `prove-summary.mjs` names no ending but "stop node done", "stop bar-passed", "halt at <gate>" and one "stop human".
  2. *The comparison's one runaway did not pass a bound the graph has.* `red-team-loop` B-1 was cut off by the runner's $9.00 per-invocation ceiling (`claude-output.json`: `subtype: error_max_budget_usd`), which every arm ran under. It was in its second attack round, on its fourth dispatch. The prose it ran from carries the graph's own caps ("stop when 2 rounds in a row add no new failing traces, at most 5 rounds, at most 12 dispatches", `prompt-B.md:60`), and it was inside all of them. The graph's caps would not have stopped that trajectory either: $9.02 was spent in four dispatches.
  3. *Arm A did not stop by a brake.* Both A runs ended at round 0 because their red team found nothing, so the pass edge was taken. B-2, C-1 and C-2 of the same project ended the same way, by themselves, for $3.36, $3.60 and $4.59, against A's $2.63 and $3.57. What differed in B-1 is that its red team reported two traces outside the contract and the builder acted on them. That is one of four prompt-arm runs against none of two graph runs (none of three with the proving run): no inference.
  4. *What is observed:* every recorded run that reached a human gate halted there (14 halts at a gate node: 9 kept proving records, 5 arm-A runs), and one human check-in stop fired (`gauntlet-decomposed`, the outer loop's "human every 2"). Two first-batch runs waited at a gate without writing the halt note and were run again. On gates the arms of the comparison did not differ either: the prompt arms "stopped at the gate where the prose said to" (`experiments/comparisons/README.md`).
  So the evidence carries: "a run stopped where its graph said: at a passed bar, at a human gate, once at a human check-in". It does not carry that a package holds a run that would otherwise run on, and "the only run that went past its bounds was a prompt-only run" is wrong on its face: that run was inside its bounds.
- **Words we would publish instead:** "In its recorded runs a package stopped where its graph said: at a passed bar or at a human gate. No round cap or budget has yet had to fire, so it is not shown that they hold a run that would otherwise go on." And in the report, for line 12: "A package's runs stopped where the graph said. No cap or budget has yet fired on record. In the comparison one prompt-only run was cut off by the runner's dollar ceiling, inside the same caps the graph has; nothing in that run shows a brake."
- **What we most want attacked:** Whether we are too hard. Is "bound" fairly earned by the gates alone (14 of 14)? Did we misread B-1: is there anything in arm A's package, absent from `prompt-B.md`, that would have stopped that run sooner? Is there a recorded run we missed in which a cap, a budget or diminishing returns fired? One candidate we know of and do not count: `specialist-critic-bank/run-1`, whose lead halted at $5.51 of the runner's $6.00 ceiling "rather than start a round it could not finish" (`experiments/patterns/README.md`, "Two harness quirks"); that brake is the harness's, not the graph's, and the check marks the run red.

### C2 · "… shown to … record autonomous work"

- **Published at:**
  - the headline sentence, four places as in C1.
  - `Landing.tsx:98` — "Every run leaves a record. Notes, rounds, dispatch counts and why it stopped, in a folder a monitor reads and a run id resumes."
  - `docs/report/grooph-technical-report.md:13` — "A package leaves a record that a monitor reads and a run id resumes."
  - `docs/decisions/0013-value-as-of-study-one.md:13` — "The record and its cost. The run record (notes, progress, working copy, dispatch counts, the halt note) is what the package's extra cost buys: ten to fifteen lead turns per run in study one."
- **Evidence:** the run folders, `experiments/patterns/<id>/run/runs/<run id>/` and `experiments/comparisons/<project>/A-<n>/runs/<run id>/`; `scripts/lib/prove-check.mjs` (the run folder, the notes' schema, the working copy); `node scripts/lib/prove-summary.mjs` (the "Dispatch count" column); `experiments/patterns/README.md` ("The record is weaker than the work"); `tools/comparison-facts.mjs` (turns by arm); `docs/runs.md`.
- **What we believe, and how sure we are:** **Carried, with other words in three places.** All 33 run records hold notes, a progress file and a working copy, and the check asserts it. Three details say more than the records:
  - "dispatch counts" (front page): `prove-summary.mjs` prints "no count kept" for 10 of the 20 kept records.
  - "a run id resumes": a halted run was continued in the records of two templates (`spec-then-loop` twice, `gauntlet-decomposed` once) and in the three `spec-then-loop` arm-A runs. Each time the runner resumed the same harness session (`claude --resume <session>`, `scripts/lib/prove-pattern.mjs:323`) with a prompt that names the run id. A fresh session picking a run up from its folder by its id is what the package's skill is written for (`packages/core/src/compile/claude-code/skill.ts:30`) and is not on record.
  - "ten to fifteen lead turns": by project, arm A's turns less the prompt arms' range from 3 to 17 (`comparison-facts.mjs`: grind-loop A 13 to 16 against 3; red-team-loop 15 to 18 against 5 to 6; review-gate 14 to 24 against 9 to 11; spec-then-loop 25 to 27 against 10 to 13).
  The first batch's records were weak by the project's own account (timestamps estimated, run ids typed by hand).
- **Words we would publish instead:** front page: "Every run leaves a record. Notes, rounds and why it stopped, in a folder a monitor reads. A halted run goes on when a person answers."
- **What we most want attacked:** Whether a record written by the lead about itself is a record in the sense a reader would take. The check compares the notes against the harness's transcripts in places (who ran, who wrote what, dispatch counts); say whether that is enough to call it a record of what happened and not of what the lead said happened.

### C3 · "… and to hold a design as a runtime contract"

- **Published at:**
  - the headline sentence, four places as in C1.
  - `Landing.tsx:94` — "The graph is the contract. The package drives the session as drawn: named subagents, stops checked in order, and gates that halt before anything irreversible."
  - `docs/report/grooph-technical-report.md:11` — "A package holds a design as a runtime contract in Claude Code. Twenty of twenty templates have a recorded run."
  - `docs/report/grooph-technical-report.md:76` — "What the records show: the contract holds. Named agents ran as isolated subagents; stops were evaluated in order; every gate was a halt with nothing irreversible done."
  - `docs/decisions/0013-value-as-of-study-one.md:11` — "The contract. A package drives a Claude Code session as its graph says: named agents as isolated subagents, stops evaluated in order, every gate a halt with nothing irreversible done, a record a monitor reads and a run id resumes. Twenty of twenty templates, twenty records."
  - `docs/field-guide.md:40` — "it asks whether the package drove the session as its graph says (the named agents ran as their own subagents, the stops and gates fired as written, the record is whole)"
- **Evidence:** `scripts/lib/prove-check.mjs` (seventeen numbered assertions; read what each one reads); `node scripts/field-guide.mjs --check` ("20 templates, 18 checks passed, 2 failed"); `experiments/patterns/README.md`; each template's `README.md`, `expect.json` and `run/`.
- **What we believe, and how sure we are:** **Carried with other words.** Sure of the counts, less sure where the line between "followed its brief" and "contract" should fall.
  - *Eighteen of twenty, not twenty of twenty.* Two kept records fail the check: `ralph-loop` (its builder read a held-out file it was told not to) and `gauntlet-decomposed` (ten problems; its planner copied the reference into the plan, and its final critic never read the held-out reference). Four more templates pass on a second run after a first that failed (`review-gate`, `spec-then-loop`, `fresh-grind-rare-judge`, `specialist-critic-bank`): 24 runs reached a model for the 20 records (25 kickoffs in the ledger, one of which failed at sign-in).
  - *"Named agents ran as isolated subagents"*: asserted from the harness's transcripts (check 1). Carried for the 18.
  - *"Stops were evaluated in order"*: the evidence is the lead's own sentence in its loop notes ("stops checked in order: …"). The check does not assert order. In no run did two stops come due together, so order never decided anything.
  - *"Every gate was a halt"*: 9 of the 9 kept records whose template has a gate hold a halt note at it; the first runs of `review-gate` and `spec-then-loop` did not.
  - *"with nothing irreversible done"*: two templates have a node marked irreversible (`human-gated-irreversible`, `merge-queue`), and check 9 asserts it did not run. In the other seven there is nothing irreversible in the graph to do.
  - *"contract"*: what holds the session to the graph is a brief it follows. One instruction did not hold ("not yours to read", `ralph-loop`), and the project's own write-up says "the instruction is the only brake, and it is a soft one".
  - One run per template, on Claude Code 2.1.276 and 2.1.278, with one lead model.
- **Words we would publish instead:** report line 11: "In Claude Code a session followed its package as the graph says in 18 of the 20 kept records. The two that did not are published red." Front page: "The graph is the brief. The package tells the session to run it as drawn: named subagents, stops in order, a halt at every human gate. Eighteen of twenty recorded runs did so; two did not, and say why."
- **What we most want attacked:** Read `prove-check.mjs` and tell us what a "pass" does not cover. Can a run pass while departing from its graph in a way a reader of "contract" would care about? Is "contract" defensible at all for an instruction a model follows, with one run per template?

### C4 · "It is not shown to raise quality over the same instructions given as a prompt, on small tasks."

- **Published at:** `README.md:47`; `Landing.tsx:184`; `docs/blog/2026-10-loop-graphs.md:78`; `docs/field-guide.md:42` ("it does not show better quality than the same instructions given as a prompt, on small tasks a strong builder finishes in one pass"); `docs/report/grooph-technical-report.md:15` — "What is not shown: better output than the same design given as a prompt, on small tasks. In four of four projects it was not better"; `docs/report/grooph-technical-report.md:137` — "Not evidence of better output. Section 5.2 is the measurement, and it says no on small tasks."
- **Evidence:** `experiments/comparisons/README.md` and the four write-ups; `node scripts/lib/compare-summary.mjs --index`.
- **What we believe, and how sure we are:** **Carried.** Sure. One shade: "it says no" (report line 137) is a little stronger than the study allows. Every arm sat at the top of its held-out suite (61 of 62, 73 of 73, 41 of 41, 88 of 88), so the study could not have shown the graph ahead on that measure whatever was true. "Could not tell, and the judge's ranks leaned against the graph" is the exact reading.
- **What we most want attacked:** Whether the negative is itself overstated or understated. Does the evidence support "not shown", or the stronger "shown not to", or only "not tested"?

### C5 · Twenty templates, twenty recorded runs

- **Published at:**
  - `README.md:47` — "Twenty templates have each been proven in a recorded run, and one paired comparison has been made."
  - `Landing.tsx:117` — "Twenty templates, each with a recorded run of its own."
  - `Landing.tsx:146` — "All twenty, with what each one's recorded run showed"
  - `Landing.tsx:183` — "In twenty proving runs and one paired comparison"
  - `docs/report/grooph-technical-report.md:11` — "Twenty of twenty templates have a recorded run."
  - `docs/blog/2026-10-loop-graphs.md:64` — "Twenty templates, twenty recorded runs. Every template in the library has been run for real, at least once, on a small task built so its point could show, and the record is in the repository: what ran, which stop ended it, what it cost. Eighteen of the twenty pass their check today and two do not, and the two are published red with their reasons."
  - `docs/field-guide.md:44` — "Of the twenty recorded runs eighteen passed their check and two did not (`gauntlet-decomposed` and `ralph-loop`); the twenty kept runs cost $44.99 (the whole proving ledger, which also counts the runs since replaced and a few probes, stands at $57.51)."
- **Evidence:** `experiments/patterns/` (twenty folders, each with `run/`); `experiments/patterns/ledger.json`; `node scripts/field-guide.mjs --check`; `node scripts/lib/prove-summary.mjs`.
- **What we believe, and how sure we are:** The README's "proven" is **not carried**: two of the twenty fail their own check. The other six places are **carried**. Two small things: `prove-summary.mjs` prints "20 records, $44.98 in all" where the field guide prints $44.99 (the twenty `result.json` costs sum to $44.993); and "twenty proving runs" on the front page counts the kept ones, of 24 made.
- **Words we would publish instead:** README: "Each of the twenty templates has a recorded run: eighteen pass their check and two are published red. One paired comparison has been made."
- **What we most want attacked:** Whether "has a recorded run" still implies more than it should, given that the first five tasks all passed at the first attempt ("The critics confirmed; none caught", `experiments/patterns/README.md`) and that `human-gated-irreversible` ran as a fragment inside another template.

---

## Group B · The proving ground (technical report, section 5.1)

### C6 · "pre-registered before the run with the reason a first pass should fail"

- **Published at:** `docs/report/grooph-technical-report.md:74` — "Each of the twenty templates has a small task designed so the template's point can show, pre-registered before the run with the reason a first pass should fail, and one recorded headless run"
- **Evidence:** `experiments/patterns/README.md:3` ("since slice 0017 the task is pre-registered before the run"); the commit history of each template's `expect.json`, `README.md` and `run/result.json` (`git log --diff-filter=A --format='%h %cd' -- <path>` in the snapshot).
- **What we believe, and how sure we are:** **Not carried.** Sure. By the commit history: the four templates of slice 0017 (`ralph-loop`, `patrol-pulse`, `gauntlet-decomposed`, `merge-queue`) have a pre-registration, with a reason and a probability, committed before their run. The eleven of the second batch have a write-up skeleton with a "design bet", committed in `e5ca569` ("write-up skeletons with each task's design bet, before any run") before their runs. The first five have an `expect.json` before the run and no stated bet; their write-ups came with or after the evidence, and all five passed at the first attempt.
- **Words we would publish instead:** "Each of the twenty templates has one kept headless run on a small task. For the last four the task was pre-registered with the reason a first pass should fail. For eleven a design bet was written down before the run. The first five had neither, and all five passed at the first attempt."
- **What we most want attacked:** Whether the second batch's "design bet" deserves to be called pre-registration. Check one against its run.

### C7 · What a proving record holds

- **Published at:** `docs/report/grooph-technical-report.md:74` — "Each record holds the run id, the rounds, which stop fired, how the run ended, the cost as the harness reported it, and a `--check` that re-asserts the outcome from the evidence."
- **Evidence:** any `experiments/patterns/<id>/run/`; `scripts/prove-pattern.sh <id> --check …`.
- **What we believe, and how sure we are:** **Carried.** Fairly sure. "Which stop fired" is a field only from slice 0010 on; for earlier records the check reads it from the note's text.
- **What we most want attacked:** Whether the check "re-asserts the outcome from the evidence" or from the lead's own notes about the evidence.

### C8 · The proving ledger

- **Published at:** `docs/report/grooph-technical-report.md:74` — "The proving ledger stands at $57.51 over 31 model-calling invocations."
- **Evidence:** `experiments/patterns/ledger.json`.
- **What we believe, and how sure we are:** **Carried with other words.** Sure. The ledger holds 31 invocations summing to $57.5127 (3 probes, 25 kickoffs, 3 resumes). Invocation 24 failed at sign-in before any model call, at $0.00. So 30 called a model.
- **Words we would publish instead:** "$57.51 over 31 invocations, one of which failed at sign-in before any model call."
- **What we most want attacked:** Whether the costs are the harness's own figures throughout (`reported_cost_usd` against `cost_usd`), and whether any model call is missing from the ledger.

### C9 · Red records stay red; evidence is never edited

- **Published at:** `docs/report/grooph-technical-report.md:74` — "Records that came back red are published red, with the reason."; `docs/report/grooph-technical-report.md:158` — "Evidence is never edited by hand ([decision 0009]). A losing result is published as such."; `docs/blog/2026-10-loop-graphs.md:64` — "the two are published red with their reasons".
- **Evidence:** `docs/decisions/0009-proving-records-are-evidence.md`; the commit history of `experiments/patterns/*/run*` and `experiments/comparisons/*/[ABC]-*`.
- **What we believe, and how sure we are:** **Carried.** Fairly sure. `git log --diff-filter=M` over the evidence folders shows one commit that changed files in place, `9f30231`, the re-proof of `review-gate` and `spec-then-loop`; the old `run/` of each of the four replaced records is byte-identical to its `run-1/` (`git diff --stat <commit>^:…/run <commit>:…/run-1` prints nothing). No commit after `v0.1.0` touches either evidence folder.
- **What we most want attacked:** A second look at the history for an edit we missed, and whether any write-up softens a red result.

### C10 · "Back edges fired in six templates"

- **Published at:** `docs/report/grooph-technical-report.md:76` — "Back edges fired in six templates once the tasks carried evidence held out from the builder."; `docs/decisions/0013-value-as-of-study-one.md:14` — "Correction, when the critic holds something the builder cannot see. Back edges fired in six templates once tasks carried held-out evidence; a bisect found a bad change. A loop with nothing hidden from the builder does not turn."
- **Evidence:** `node scripts/lib/prove-summary.mjs` ("Back edge taken, caught by"); `scripts/prove-pattern.sh <id> --check experiments/patterns/<id>/run` for the six; each one's `expect.json` (`heldOut`) and write-up.
- **What we believe, and how sure we are:** **Carried with other words.** Sure of the breakdown. Six kept records show a back edge. They are not six corrections on held-out evidence:
  - `heterogeneous-critic`, `taste-polish`: the critic failed round 0 against evidence the builder never saw, and passed round 1. This is the claim.
  - `ralph-loop`: `e-tests-fail` once, on held-out acceptance cases; the builder then read the held-out file, and the record is red. Its three `e-plan-check-fail` turns are the loop taking the next plan item, by design.
  - `merge-queue`: an integration check failed "by construction" and a bisect found the patch. No held-out evidence (`expect.json` has none).
  - `fresh-grind-rare-judge`: the edge is `e-judge-next-phase`, the judge sending the builder on to the next phase. The write-up says the bet did not pay: `e-judge-fail` never fired.
  - `gauntlet-decomposed`: the edge is `e-next-piece-pass`, the outer loop taking the next piece; "caught by ?" in the table. `e-critic-fail` never fired, and the record is red.
  Each is one run, on a task built so that round 0 fails. It shows the mechanism works as wired. It is not a measure of what the correction is worth: there is no run without the loop to compare with.
- **Words we would publish instead:** "A critic sent work back on evidence the builder could not see in two templates (`heterogeneous-critic`, `taste-polish`), and a check did in two more (`ralph-loop`, `merge-queue`): one run each, on a task built to make it happen. In two others the edge that returned was the loop moving on to its next phase or piece."
- **What we most want attacked:** Our sorting of the six. And "A loop with nothing hidden from the builder does not turn": is that a finding, or only what happened in five first-batch runs?

### C11 · The field guide's twenty "Proving run" blocks

- **Published at:** `docs/field-guide.md`, one block per template (lines 81 to 861): the run id, the harness version, check passed or failed, the last round, the back edge, how it ended, the cost and its ledger line.
- **Evidence:** `scripts/field-guide.mjs` writes them from the records; `node scripts/field-guide.mjs --check` prints "docs/field-guide.md and docs/field-guide/ are current (20 templates, 18 checks passed, 2 failed)".
- **What we believe, and how sure we are:** **Carried**, by construction: the page is generated and the check passes. We read four blocks against their records by hand and found them right.
- **What we most want attacked:** Pick three blocks and check them against `result.json`, the notes and the ledger. Say whether "a back edge was taken" reads, in those blocks, as more than it is (see C10).

---

## Group C · The paired comparison (technical report, section 5.2; the blog draft)

### C12 · The design and its size

- **Published at:** `docs/report/grooph-technical-report.md:80` — "Four templates, one designed project each, three arms under equal conditions"; `:88` — "A held-out suite scored each run; one blind judge ranked all runs of a project. Twenty-seven runs, 40 invocations with judges, $60.62."; `README.md:47` and `Landing.tsx:183` — "one paired comparison"; `docs/blog/2026-10-loop-graphs.md:66` — "One paired comparison. Four templates. For each, three arms under the same conditions: the graph's package; the same design written out as one prompt; and that prompt in a plain retry loop. A held-out test suite scored each run, and a blind judge ranked them."
- **Evidence:** `docs/comparisons.md` (the protocol); `experiments/comparisons/README.md`; `experiments/comparisons/ledger.json`; each run's `result.json` (`conditions`); `scripts/lib/compare-run.mjs:524` to `:602` (what the judge was shown); `tools/comparison-facts.mjs`.
- **What we believe, and how sure we are:** **Carried, with one thing unsaid.** The counts re-derive: 27 runs, 40 ledger lines (31 kickoffs, 9 resumes), $60.62. The conditions recorded per run are equal within a project. The judge saw diffs of the deliverable paths only, under random letters, with the tool's name redacted. The thing unsaid: **arm C never looped.** `comparison-facts.mjs`: "Arm C runs: 9; of those with one lead session, that is one iteration of the loop: 9." Every C run was the B prompt once, with one sentence added. So the study had two arms in effect, and "that prompt in a plain retry loop" (blog) describes a loop that never retried.
- **Words we would publish instead:** add to the report's limits and to the blog: "The loop arm ran one iteration in every run, so it was the prompt arm a second time."
- **What we most want attacked:** "Equal conditions" and "blind". Is there a way the judge could tell arm A's diffs from the others (comments, file names, style the package induces)? Is one judge call per project, on one model, enough to report ranks at all? Does anything differ between arms that the protocol says is equal?

### C13 · The table

- **Published at:** `docs/report/grooph-technical-report.md:90` to `:95` (four rows: held-out passes in every arm, cost of A, cost of B, the judge's ranks of A).
- **Evidence:** `node scripts/lib/compare-summary.mjs --index`.
- **What we believe, and how sure we are:** **Carried.** Sure: every cell matches what the script prints from the records.
- **What we most want attacked:** Nothing in particular. Check a row.

### C14 · "The graph did not earn its cost in any of the four projects"

- **Published at:** `docs/report/grooph-technical-report.md:97` — "The graph did not earn its cost in any of the four projects, by each project's own pre-registered test. Every arm reached the same held-out score in every replicate. The judge never placed a graph run first."; `docs/blog/2026-10-loop-graphs.md:68` — "The graph did not win. On every project every arm reached the same held-out score. The judge never ranked a graph run first. On the simplest project the graph cost about twice what the prompt cost, for the same result. The prompt had kept the design (the roles, the routing, the loop) and a strong model followed it."
- **Evidence:** each project's `README.md` ("What counts as the graph losing", written before its runs) and `expect.json`; their commit history; `compare-summary.mjs`.
- **What we believe, and how sure we are:** **Carried.** Sure. The losing conditions were committed before each project's first run (`9d78b62` at 17:37 on 2026-09-21; the first runs from 17:47; `spec-then-loop`'s was revised in `673fcff` before its first run at 19:34). Arm A's best rank is 3 of 6. One caution on the judge: B and C were the same treatment (C12) and their ranks still differ by up to four places within a project, so a rank is noisy at this size, and "never first" should not be read as a measured preference.
- **What we most want attacked:** Whether a pre-registration changed after a run. We saw `expect.json` of `red-team-loop` change in the slice's merge (its `reports` key); say whether that touches the losing condition.

### C15 · "In all 27 runs the prompt-arm lead dispatched the roles as separate subagents"

- **Published at:** `docs/report/grooph-technical-report.md:99` — "The flattening rule removed grooph's mechanics and kept the design: the roles, the routing, the loop sentence, the gate sentence and every brief. In all 27 runs the prompt-arm lead dispatched the roles as separate subagents. The study compared a design with its record against the same design without one."
- **Evidence:** each B and C run's `transcript-digest.json`; `result.json` (`derivation.mechanics_left`); `scripts/lib/compare-prompt.mjs`; `tools/comparison-facts.mjs`.
- **What we believe, and how sure we are:** **Carried with other words.** Sure. There are 18 prompt-arm runs, not 27, and all 18 dispatched subagents: "Prompt-arm runs (B and C): 18; of those that dispatched at least one subagent: 18." The same slip is in `experiments/comparisons/README.md`, which is evidence and stays as written.
- **Words we would publish instead:** "In all 18 prompt-arm runs the lead dispatched the roles as separate subagents."
- **What we most want attacked:** Whether the derived prompt is a fair "same design in prose". It tells the session to "Dispatch each agent node as its own subagent with the `Agent` tool" (`prompt-B.md:13`). Is that still a prompt, or the package without its record? The project says the latter. Say whether the published sentences make that plain enough.

### C16 · The run that was cut off, as a fact

- **Published at:** `docs/report/grooph-technical-report.md:101` — "One prompt run went on to the $9.00 ceiling ($9.02, 24 minutes 51 seconds) while both graph runs of that project stopped by the graph's own edge."; the blog, line 70, as in C1.
- **Evidence:** as C1.
- **What we believe, and how sure we are:** The numbers are **carried**: $9.0219, 1,490 seconds, `error_max_budget_usd`; A at $2.63 and $3.57. "Stopped by the graph's own edge" is true and easy to misread: the edge was the pass edge at round 0. What it is evidence of is C1.
- **What we most want attacked:** See C1.

### C17 · The study's stated limits

- **Published at:** `docs/report/grooph-technical-report.md:103` — "Two replicates per arm (three for one project); one harness version; one model family; tasks a strong builder finishes in one pass, so no loop turned. It measured the structure's overhead and its bounding, not its correction."
- **Evidence:** `experiments/comparisons/README.md` ("What this study can and cannot show").
- **What we believe, and how sure we are:** **Carried, and incomplete.** It should also say that arm C ran once (C12) and that every arm was at the top of its held-out suite (C4). "And its bounding" falls with C1.
- **What we most want attacked:** Limits we have not listed.

### C18 · Study two

- **Published at:** `docs/report/grooph-technical-report.md:105` to `:107` — "Study two, designed and not yet run"; `docs/blog/2026-10-loop-graphs.md:80` — "A second study, on tasks built so a first pass fails and the loop has to turn, is designed and has not run yet."
- **Evidence:** `handoffs/0019-comparison-study-two/HANDOFF.md`; `docs/comparisons.md` (version 2); no study-two records under `experiments/comparisons/`.
- **What we believe, and how sure we are:** **Carried.** Sure.
- **What we most want attacked:** Read the design. Would it answer what study one could not? Would it give a brake a chance to fire (C1)? If not, say what the smallest design is that would.

---

## Group D · What the validator refuses, and what the compiler writes

### C19 · "every loop can end"

- **Published at:** `README.md:11` — "grooph checks that every loop can end and every critic can actually inspect something"; `Landing.tsx:66` — "grooph checks that every loop can end"; `Landing.tsx:90` — "Every loop can end. The validator refuses a loop without a stop, a critic that shares the builder's context, and an irreversible step without a human gate."; `docs/report/grooph-technical-report.md:7` — "A validator enforces loop hygiene: every loop can end, every critic can see something the builder did not, every irreversible step waits for a person."; `docs/blog/2026-10-loop-graphs.md:1` and `:7` — "make sure it can end", "it checks that the loop can end".
- **Evidence:** `docs/rules.md` (`E_CYCLE_NO_STOP`, `E_STOP_NOT_INSPECTABLE`, `W_LONG_LOOP_NO_BUDGET`, `W_ONLY_MAX_ITERATIONS`); `packages/core/src/validate/`; `tools/validator-probes.sh`.
- **What we believe, and how sure we are:** **Carried with other words.** Sure. "Refuses a loop without a stop" is exact. "Every loop can end" reads as more: the rule asks for one stop of any kind. Probe P2 keeps "the bar passed" as a loop's only stop, with no round cap and no budget: "p2-no-cap.grooph.json: 0 errors, 2 warnings", and `grooph export` writes the package. If that bar never passes, nothing in the graph ends the loop. A loop without a cap is a warning (`W_LONG_LOOP_NO_BUDGET`), not a refusal. All twenty built-in templates do carry a cap and a budget on every loop.
- **Words we would publish instead:** "grooph checks that every loop names what ends it" and, on the front page, "Every loop has a stop. The validator refuses a loop without one, and warns when a loop has no cap."
- **What we most want attacked:** Whether "can end" is fair as written. And the other way round: whether "names a stop" is still too much, since the stop is an instruction the session has to honor.

### C20 · "a critic that shares the builder's context"

- **Published at:** `Landing.tsx:90` (as in C19); `README.md:11` ("every critic can actually inspect something"); `docs/report/grooph-technical-report.md:7` and `:51` — "A critic must be able to disagree: A critic that shares the builder's context; evidence the critic cannot inspect"; `docs/blog/2026-10-loop-graphs.md:32` — "a critic that shares the builder's context, and so can only agree with it".
- **Evidence:** `docs/rules.md` (`E_CRITIC_NOT_ISOLATED`: "A `critic-isolation` policy is in scope and …"); `tools/validator-probes.sh`.
- **What we believe, and how sure we are:** **Carried with other words.** Sure. The refusal depends on a policy the document's author writes. Probe P3 removes the policy and hands the critic shared context: "p3-shared-no-policy.grooph.json: 0 errors". Probe P4 leaves the policy in: `E_CRITIC_NOT_ISOLATED`. Fourteen of the twenty templates carry the policy (the six without have no critic). The `grooph-design` skill, which is how an agent writes a graph from scratch, does not name the policy anywhere in its text (`plugins/grooph/skills/grooph-design/SKILL.md`), so such a graph carries it only if the agent thinks to add it.
- **Words we would publish instead:** "refuses … a critic that shares the builder's context, where the graph asks for isolation (the templates with a critic do)".
- **What we most want attacked:** Whether the rule's second clause ("an edge into a critic-family node comes from a writer node with no `evidence` list") refuses anything when no policy is in scope; our probe says no. And whether the claim fails where it matters most: a graph written from scratch.

### C21 · "an irreversible step without a human gate"

- **Published at:** `Landing.tsx:90`; `docs/report/grooph-technical-report.md:7` — "every irreversible step waits for a person"; `:53` — "A person before anything irreversible: A merge, a publish or a payment with no human gate before it"; `docs/blog/2026-10-loop-graphs.md:34` — "a step that cannot be undone (a merge, a publish, a payment) with no person in front of it".
- **Evidence:** `docs/rules.md` (`E_IRREVERSIBLE_NO_GATE`: "A node with non-empty `irreversible` …"); `tools/validator-probes.sh`.
- **What we believe, and how sure we are:** **Carried with other words.** Sure. The rule covers a node the author has marked. Probe P5 tells the builder, in its brief, to merge and publish, marks nothing and removes the gate: "p5-unmarked-merge.grooph.json: 0 errors". Probe P6 adds the mark: `E_IRREVERSIBLE_NO_GATE`. Two of the twenty templates mark a node irreversible.
- **Words we would publish instead:** "refuses … a step marked irreversible with no human gate before it".
- **What we most want attacked:** Whether the unmarked case is a hole a reader of "every irreversible step waits for a person" would be hurt by.

### C22 · Thirty-five rules

- **Published at:** `docs/report/grooph-technical-report.md:44` — "Thirty-five rules, 24 for graphs and 11 for maps, each with a stable code and a fixture that fires it"; `docs/blog/2026-10-loop-graphs.md:36` — "There are 35 rules in all, each with a failing example in the repository."
- **Evidence:** `docs/rules.md`; `node scripts/rule-reference.mjs --check` ("docs/rules.md is current").
- **What we believe, and how sure we are:** **Carried.** Sure: 24 and 11 headings, each with a fixture. Five codes are in both lists (`E_SCHEMA`, `E_DUPLICATE_ID`, `E_DANGLING_REF`, `W_UNKNOWN_KEY`, `W_DOC_TOO_LARGE`), so 35 rules are 30 distinct codes.
- **What we most want attacked:** Nothing in particular.

### C23 · The templates validate clean, and CI checks it

- **Published at:** `docs/report/grooph-technical-report.md:56` — "Patterns in the built-in library must validate clean, and CI checks that they do."
- **Evidence:** `packages/core/test/patterns.test.ts:94`; `.github/workflows/ci.yml`.
- **What we believe, and how sure we are:** **Carried**, where "clean" means no error and exactly the warnings a file beside each template lists. Some templates do carry a listed warning (`review-gate` warns `W_HOMOGENEOUS_CRITICS`).
- **What we most want attacked:** Nothing in particular.

### C24 · What `grooph explain` prints

- **Published at:** `docs/blog/2026-10-loop-graphs.md:40` to `:50` (a block of output for the review gate).
- **Evidence:** `node packages/cli/bin/grooph.js explain <the base document the probes write>`.
- **What we believe, and how sure we are:** **Carried.** Sure: the command prints the block word for word.
- **What we most want attacked:** Nothing.

### C25 · "grooph never runs an agent, never calls a model"

- **Published at:** `README.md:12`; `Landing.tsx:67` and `:184` — "It does not run agents, host anything, or call a model."; `docs/report/grooph-technical-report.md:7` and `:135`; `docs/blog/2026-10-loop-graphs.md:7`, `:54` and `:121`.
- **Evidence:** `packages/*/package.json` and `apps/web/package.json` (no model SDK); a search of `packages/core/src`, `packages/cli/src`, `packages/cli/hooks` and `apps/web/src` for network calls.
- **What we believe, and how sure we are:** **Carried.** Fairly sure. No dependency can call a model. The CLI's only outbound calls are a template registry the user names (`packages/cli/src/registry.ts:167`) and the optional event sender's `git push`.
- **What we most want attacked:** Anything in the repository that starts a harness or calls a model on a user's machine as part of the product (the proving and comparison runners do, and are the project's own tooling, not the product).

---

## Group E · The app and where a graph goes

### C26 · "keeps your graphs on your device"

- **Published at:** `README.md:12` — "keeps your graphs on your device"; `Landing.tsx:190` — "Graphs live in this browser on this device. Nothing is sent anywhere."; `docs/report/grooph-technical-report.md:136` — "The app is static files; graphs stay in the browser that opened them."; `docs/blog/2026-10-loop-graphs.md:115` — "keeps everything on your device".
- **Evidence:** `apps/web/src` (every `fetch(` call); `apps/web/index.html`; `apps/web/public/sw.js`.
- **What we believe, and how sure we are:** **Carried.** Fairly sure. Every `fetch` in the app is a GET to its own origin (its own files, the recorded demo, the local live view's endpoint). No script, font or image loads from another origin. One nuance worth a clause: a share link or an embed carries the whole graph in the link's fragment, so the graph goes wherever the person sends the link. And an embed posts its height to the page that frames it (`apps/web/src/ui/embed/Embed.tsx:53`), nothing else.
- **What we most want attacked:** A request we missed. Anything in the built app (`apps/web/dist`) that the source search would not show.

### C27 · "works on a phone, needs no account, and opens offline once it has been opened online"

- **Published at:** `README.md:14`.
- **Evidence:** `apps/web/e2e/offline.spec.ts` (five tests, among them "once opened with a network, it opens with none"); `apps/web/public/sw.js`; decision 0021, point 4.
- **What we believe, and how sure we are:** **Carried**, on the tests' word: we read them and did not run the browser suite. "Works on a phone" rests on the suite's phone-sized viewport and the owner's own use; no device was tested by a record we found.
- **What we most want attacked:** Whether the offline tests test what the sentence says.

### C28 · The recorded run that plays

- **Published at:** `docs/blog/2026-10-loop-graphs.md:72` — "Here is one of the twenty recorded runs, as it happened. Press play: the critic fails the first round, the builder goes again, the bar passes, and the run stops at the human gate before anything is merged."; the front page plays the same run (`apps/web/src/ui/landing/RunDemo.tsx`, `apps/web/public/demo/run.txt`).
- **Evidence:** `experiments/patterns/heterogeneous-critic/run/runs/20260920-192538/notes.jsonl`.
- **What we believe, and how sure we are:** **Carried.** The notes say exactly that: critic fails round 0, builder again, critic passes round 1, halt at `merge-gate`. The front page's file and the blog's frame hold the same payload. We did not decode the payload byte for byte against the notes.
- **What we most want attacked:** Whether "as it happened" holds: is what plays the record, or a tidied version of it?

### C29 · "It does not start the run until you say so"

- **Published at:** `README.md:39` — "The session proposes one to three validated graphs, from the templates or from scratch. It gives you a link that opens a side-by-side comparison on your phone, and it places the package you pick. It does not start the run until you say so."
- **Evidence:** `plugins/grooph/` (the `grooph-design` skill's text).
- **What we believe, and how sure we are:** **Carried as an instruction, not as an observation.** The skill tells the session not to start the run. No record shows a session obeying or not.
- **What we most want attacked:** Whether the skill's text says it plainly enough to publish the sentence.

---

## Group F · Observation: the event hook, the sender, the live view, operation maps

A second reader of ours went through this group against the code and the records; we checked its main points ourselves and they are quoted here as ours.

### C30 · What the hook records

- **Published at:** `README.md:62` — "The live view of subagents, from a hook that records ids, names and times, never content, and cannot steer"; `Landing.tsx:165` — "A hook records when each session and subagent starts and stops, and nothing they say. A screen shows it live."; `docs/report/grooph-technical-report.md:113` — "A hook appends one JSON line to a file per session when a session, a turn or a subagent starts or stops, and optionally when a tool call finishes. It records ids, names and times."; `docs/blog/2026-10-loop-graphs.md:84` — "grooph installs a hook in the harness that appends one line to a file when a session or a subagent starts or stops: an id, a name, a time. Never a prompt, a file name, or a reply."; `docs/subagents.md:150` — "It keeps ids, names and times. It never writes a prompt, a tool's input or result, or anything an agent said."
- **Evidence:** `packages/cli/hooks/grooph-event.mjs:62` to `:81`; `packages/cli/test/hooks.test.ts:132` to `:159`; kept lines in `experiments/hooks/2026-09-30/cc-4-real-hook-nested-again/events.jsonl`; `docs/subagents.md:143` to `:149` (the page's own table of fields).
- **What we believe, and how sure we are:** **Carried with other words.** Sure. "Never content" holds: the hook reads no prompt, no tool input or result, no reply, and a test feeds it payloads full of text and checks none reaches the file. "Ids, names and times" leaves two things out. On the machine it runs on, every main-session line holds `cwd`, the full path of the working folder (`grooph-event.mjs:77`), and a subagent's stop holds `transcript`, the full path of its transcript file (`:78` to `:81`). The kept lines show both. The blog's "Never … a file name" is wrong for that second field. `docs/subagents.md` lists both fields in its table and then says "ids, names and times" three lines later. What is sent to another machine is shortened (C34).
- **Words we would publish instead:** "It records ids, names and times, and on the machine it runs on the working folder's path and where a subagent's transcript is kept. It never records a prompt, a tool's input or output, or anything an agent said."
- **What we most want attacked:** Any other field, in either harness, that carries something a user would call content.

### C31 · "prints nothing, exits 0 whatever happens … observation never steers"

- **Published at:** `docs/report/grooph-technical-report.md:113` — "It prints nothing, exits 0 whatever happens, and returns nothing a harness reads: observation never steers."; `README.md:62` — "cannot steer".
- **Evidence:** `packages/cli/hooks/grooph-event.mjs:95` to `:104`; `packages/cli/test/hooks.test.ts:147`, `:175`, `:189`; `packages/cli/src/commands/hooks.ts:147` to `:152` (the installed command), `:172` to `:174` (the two entries that are waited for); `packages/cli/src/mcp.ts:109` (`grooph_running`).
- **What we believe, and how sure we are:** **Carried for the script, with three conditions.** The script has no print call, wraps its work in a `try`, and exits 0; tests cover bad input, an unknown event and an unwritable folder. The conditions: (1) the installed command is `node "<project>/…/grooph-event.mjs"`, so when that file or Node is missing the command exits 1 or 127 with text on stderr, before the script loads, and no test covers it; (2) two entries, the end of a turn and of a session, are waited for, so they can delay a step (C44); (3) grooph's own MCP tool `grooph_running` hands a lead that asks for it what the hook saw. The hook does not steer. What it wrote can be read by an agent through another door grooph ships.
- **What we most want attacked:** Whether condition 3 breaks "observation never steers" as a reader would take it, or is a separate, declared feature.

### C32 · "The same hook runs in Claude Code and in Codex."

- **Published at:** `docs/report/grooph-technical-report.md:113`.
- **Evidence:** `packages/cli/src/commands/hooks.ts:147` to `:152`; `experiments/hooks/2026-09-30/codex-5-real-hook-subagents/events.jsonl`; `experiments/hooks/2026-10-01/README.md`; `docs/subagents.md`.
- **What we believe, and how sure we are:** **Carried, with conditions the sentence does not give.** One file, the harness's name as its argument, and records of it running under `codex exec` and in the Codex desktop app. In Codex it needs a trusted folder and a reviewed hook (three recorded sessions wrote nothing, silently, without them); `spawned` is never present; a session's end from the desktop app was not seen; Codex in the cloud is unknown.
- **What we most want attacked:** You are Codex. Say what you know of your own hooks that these records get wrong.

### C33 · "a session silent for half an hour reads 'last seen', not 'working'"

- **Published at:** `docs/report/grooph-technical-report.md:115`.
- **Evidence:** `packages/core/src/events.ts:360` (`QUIET_AFTER_SECONDS = 30 * 60`); `packages/core/test/events.test.ts:56` to `:73`.
- **What we believe, and how sure we are:** **Carried**, for the text and the screens. `grooph sessions --json` still gives `state: "working"` for such a session.
- **What we most want attacked:** Nothing in particular.

### C34 · The sender: when it runs and what it sends

- **Published at:** `docs/report/grooph-technical-report.md:119` — "A second, optional hook sends the event files to a git branch that holds nothing else, so another machine can read them and no pull request carries them. It runs at a turn's start, at its end, and at most every ten minutes during a turn. Before it sends, it puts each line in a smaller form: a folder's name in place of its path, and no path to a transcript."
- **Evidence:** `packages/cli/src/commands/hooks.ts:138` (`PUSH_EVERY_SECONDS = 600`), `:179` to `:187`; `packages/cli/hooks/grooph-events-push.mjs:280` to `:301` (`shortened`), `:402`; `packages/cli/src/mcp.ts:48`; `packages/cli/test/events-push.test.ts`.
- **What we believe, and how sure we are:** **Carried, with one condition and one omission.** The condition: the send during a turn fires only when a tool call is recorded, so without `--tools` it happens in Claude Code only when a subagent starts, and in Codex not at all. The omission: a lead's notes written through the MCP server (`said-<session>.jsonl`) are sent with the events, text and all. That text is what the lead chose to write, and it is not "ids, names and times".
- **What we most want attacked:** Whether the notes file is a privacy hole a reader of section 6 would not expect.

### C35 · "A turn's end sends only its own session's files."

- **Published at:** `docs/report/grooph-technical-report.md:125`.
- **Evidence:** `packages/cli/hooks/grooph-events-push.mjs:398` to `:403`.
- **What we believe, and how sure we are:** **Carried with other words.** By the code a file goes when it is the session's own, or has a line since the session began, or is already on the branch; told no session, every file goes.
- **Words we would publish instead:** "A turn's end leaves out files an earlier session left behind."
- **What we most want attacked:** Nothing in particular.

### C36 · "Every push now records how it went in a file beside the events."

- **Published at:** `docs/report/grooph-technical-report.md:123`.
- **Evidence:** `packages/cli/hooks/grooph-events-push.mjs:313` to `:356`, `:701`, `:732`; `packages/cli/test/events-push.test.ts:488`.
- **What we believe, and how sure we are:** **Carried, with two exceptions** in the code: no record is written when there is no events folder, or when the push gives up waiting for another push's lock. The record is one file, replaced each time, and stays on the machine.
- **What we most want attacked:** Whether the lock case can lose a push without a sign, which is what the sentence says cannot happen.

### C37 · "Ten pushes started in the same instant … all arrived"

- **Published at:** `docs/report/grooph-technical-report.md:124` — "Ten pushes started in the same instant to one branch on GitHub all arrived, the last after 25 seconds on its tenth try".
- **Evidence:** `experiments/hooks/2026-10-02/shared-github.json` (`"sessions": 10, "arrived": 10`, `"last": 25.021`, tries from 1 to 10); `experiments/hooks/2026-10-02/README.md`.
- **What we believe, and how sure we are:** **Carried.** One run, the project's own, with no model. The record pairs "last" with "tenth try" by inference (times and tries are separate lists). It is the run that was kept: a first attempt in which all ten were refused for e-mail privacy was not kept.
- **What we most want attacked:** Whether one run of ten supports "many sessions can share one branch" (the heading of that paragraph).

### C38 · The first cloud trial

- **Published at:** `docs/report/grooph-technical-report.md:123` — "The first cloud trial sent nothing and said nothing: a cloud session starts with no branch checked out, the sender had no name for its branch, and silence hid the failure."; `docs/blog/2026-10-loop-graphs.md:98` — "The first time it ran in a cloud session, nothing arrived, and nothing said why. A cloud session starts with no branch checked out; the sender had no name for its branch, stopped, and stayed silent as designed. Three turns were lost without a sign."; `docs/report/grooph-technical-report.md:143` — "The turn-end sender has been seen working in Claude Code's cloud sessions by another session's report, not by this project's own records".
- **Evidence:** `docs/subagents.md:192` to `:193` (labeled "reported"); `docs/HANDBACK-operator.md:387`; `docs/decisions/0018-a-push-is-never-dropped-without-a-sign.md:7`; `git show v0.2.2:packages/cli/hooks/grooph-events-push.mjs`.
- **What we believe, and how sure we are:** **Carried as a report.** Another project's session saw it and told this one; no recording is in this repository, and line 143 of the report says so of the later success. The mechanism is in the code of that version. "Three turns" is in decision 0018 and amendment A-015 and not in the operator handback.
- **What we most want attacked:** Whether the blog may tell a reported event in the first person as something seen.

### C39 · "five of them sent 163 lines … Every line was read before I left it on."

- **Published at:** `docs/blog/2026-10-loop-graphs.md:102` — "Since then the cloud sessions on another project of mine publish their events this way. On the first day five of them sent 163 lines: ids, tool names, times and a folder's name, and nothing else. Every line was read before I left it on."
- **Evidence:** `docs/HANDBACK-operator.md:466` ("163 lines on five branches, every one read: only ids, the event, the time, the tool's name, and the folder's name"), labeled as the other session's report; `docs/decisions/0020-a-turn-that-is-open.md:7` ("Four lanes and one runner sent 163 lines in two hours").
- **What we believe, and how sure we are:** **Not carried as worded.** The numbers match the report. But no file here holds the lines; the reading was done by a model session on the other project, not by the owner; the owner's yes is recorded before the lines were sent, not after a reading of them; and a sent line also holds a format version, the harness's name, the event kind, and a model name and agent type where given.
- **Words we would publish instead:** "On the first day four lanes and a runner sent 163 lines. The session that runs that project read every one and reported ids, event kinds, tool names, times and a folder's name, and no path, command or text."
- **What we most want attacked:** Nothing more. The owner is rewriting this draft by hand; we report the sentence and leave the file alone.

### C40 · "the count was 9 of 19"

- **Published at:** `docs/report/grooph-technical-report.md:131` — "The validator counts how many handoffs move only when a person moves them. For the two-day push that produced this report the count was 9 of 19."; `docs/blog/2026-10-loop-graphs.md:86` to `:90` — "Here is the map of the two days in which the newest parts were built: one session driving, others building in parallel, and me." and "grooph's summary of that map is one line: *9 sessions, 19 handoffs, 9 of them waiting on a person.* That person was me. Nearly half of what moved in my own operation moved only when I carried it."
- **Evidence:** `handoffs/briefs/plan-2026-10-04/build.grooph-map.json`; `node packages/cli/bin/grooph.js validate handoffs/briefs/plan-2026-10-04/build.grooph-map.json` prints "3 lanes · 9 sessions (10 counting families) · 1 person · 19 handoffs, 9 waiting on a person"; `handoffs/briefs/plan-2026-10-04.md:3` ("Status: a plan. Nothing in it is started").
- **What we believe, and how sure we are:** The number is **carried**. What it is said to count is **not**. The map is the plan's, drawn before any lane started (committed 2026-10-03 22:57, with the plan). It holds lanes that did not run (study two, the Codex target). It counts handoffs drawn, not work that moved: seven of the nine are sessions the owner starts and two are things he carries. And by commit times the push ran from the evening of October 3 to the morning of October 4.
- **Words we would publish instead:** report: "In the plan drawn for the push that produced this report, 9 of 19 handoffs were ones only a person could move." Blog: "Nine of the nineteen handoffs I had drawn could move only when I moved them."
- **What we most want attacked:** Whether a count on a plan is worth publishing at all without the count of what happened.

### C41 · Hooks that arrive mid-session

- **Published at:** `docs/report/grooph-technical-report.md:144` — "A session takes up hooks when it starts. Hooks that arrive mid-session are normally picked up and sometimes are not."
- **Evidence:** `docs/subagents.md:198` (Claude Code's own documentation, and a report of three lanes of four, then two of three).
- **What we believe, and how sure we are:** **Carried**, for Claude Code, on documentation and a report. Not this project's observation; nothing is established for Codex.
- **What we most want attacked:** Nothing in particular.

---

## Group G · Performance

Two sentences on the site carry a measured number. The table they come from is in a decision record, which the site does not render; we include it because the front page's speed was a condition of the release.

### C42 · "The embed's first load is 125 KB compressed"

- **Published at:** `docs/exports.md:70` — "The embed's first load is 125 KB compressed (the entry with React, the embed's own chunk, core without the compiler, and its stylesheet), weighed by `scripts/perf-budget.mjs`, which fails above 132 KB, and by `apps/web/e2e/embed.spec.ts`."
- **Evidence:** `node scripts/perf-budget.mjs --check` on the snapshot's build prints "ok 125.1 of 132 an embed's first load, gzip KB"; `scripts/perf-budget.json`.
- **What we believe, and how sure we are:** **Carried.** Sure: it re-derives.
- **What we most want attacked:** Whether "first load" counts everything a browser fetches for an embed.

### C43 · "about 40 ms"

- **Published at:** `docs/subagents.md:126` — "A hook that is waited for delays the step it hangs on by as long as it runs: about 40 ms, the time Node takes to start."
- **Evidence:** labeled "[seen]" on the page; `experiments/hooks/`.
- **What we believe, and how sure we are:** **Plausible; we did not find the measurement.** The budget script times the whole CLI's cold start at 102 ms on the same machine today (decision 0021 gives 90 ms), and the hook is a smaller script.
- **What we most want attacked:** Find the record behind "about 40 ms", or say there is none.

### C44 · Decision 0021's table (in the repository, not on the site)

- **Published at:** `docs/decisions/0021-what-an-address-loads.md:27` to `:36`: the front page's first load 172.4 KB against 267.9 KB before; a template's address 270.0 KB; an embed 125.1 KB; the front page painted at 1,584 ms against 2,032 ms on a slow link and 436 ms against 512 ms on a fast one; the CLI's cold start 90 ms.
- **Evidence:** `node scripts/perf-budget.mjs --check` prints 172.4, 270 and 125.1 today, and 102 ms for the CLI. The paint times come from `scripts/perf-loadtime.mjs`, which needs a browser; we did not run it.
- **What we believe, and how sure we are:** The sizes are **carried** (they re-derive to the decimal). The CLI's start is **carried** as "about 0.1 s" (90 then, 102 today, a budget of 400). The paint times we **could not re-derive** in this round; the decision itself lists what they do not cover (one Mac, Chrome's emulated link, one unexplained late paint in seven).
- **What we most want attacked:** The method in `scripts/perf-loadtime.mjs`: is "the middle of seven cold visits" a fair figure, and is the comparison with the earlier commit like for like?

---

## Group H · The other pages the site renders

`scripts/site/pages.json` lists them: the quickstart, the rule reference, the graph document, templates, operation maps, exports, subagents, runs, the field guide and the community page. A second reader of ours swept them for claims; its full table is long, and most rows are backed (the generated pages are current, every "refuses" maps to an `E_` rule, the privacy statements match the code, the map counts match `grooph validate`). These are the ones that are not simply backed. We checked C45 to C48 and the first two points of C52 against the source ourselves; the rest stand on the sweep, so treat them as leads and say where they are wrong.

### C45 · "It may tighten a brake and never loosen one"

- **Published at:** `docs/report/grooph-technical-report.md:38` — "Whether the lead may amend a working copy of the graph during a run. It may tighten a brake and never loosen one"; `docs/graph-ir.md:171` — "**Brakes are not adaptable.** At every adaptation level the lead may not remove or loosen a human gate, an edge `approval`, an `irreversible` marker, a `budget` or `max-iterations` stop, a bar's `acceptance`, critic isolation, or the `adaptation` level itself."
- **Evidence:** `packages/core/src/compile/claude-code/lead.ts:730` (the brief's sentence); `scripts/lib/prove-check.mjs:454` (the proving check's "brake loosened"); a search of `packages/core/src` and `packages/cli/src` for `loosen`.
- **What we believe, and how sure we are:** **Carried as a rule, not as a guarantee.** The lead is told so in its brief, and the proving check looks for a loosened brake after the fact; none is on record. Nothing in the validator or in `adopt` refuses a working copy whose brake was loosened: the only matches for "loosen" in the product's code are the brief's own sentences.
- **What we most want attacked:** Whether `grooph run adopt` should be read as part of the guarantee, and whether it catches a loosened brake by another name.

### C46 · "everything else is hidden"

- **Published at:** `docs/graph-ir.md:91` — "artifacts the downstream node may inspect; everything else is hidden"; `docs/field-guide.md:65` — "the builder sees only the traces"; `docs/community.md:13` — "a judge scores it on held-out cases the proposer never sees"; `docs/blog/2026-10-loop-graphs.md:11` — "A critic, in a context of its own".
- **Evidence:** `experiments/patterns/README.md` ("Held-out evidence works by instruction, not by permission"; "'Not yours to read' held three times out of four and failed once"); `docs/field-guide.md:492` (`ralph-loop`, red).
- **What we believe, and how sure we are:** **Carried with other words.** A subagent does start in a context of its own, which is the harness's doing. What a node may read is an instruction; the files are on the same disk. The one recorded failure of the instruction is published.
- **Words we would publish instead:** "is told not to read" where a page says "never sees" or "hidden".
- **What we most want attacked:** Whether any page claims isolation of files as a property of the run.

### C47 · "the same run id resumes it"

- **Published at:** `docs/graph-ir.md:160` — "a run nobody answers (a headless session) simply ends on that halt note, and the same run id resumes it."
- **Evidence:** as C2.
- **What we believe, and how sure we are:** **Carried with other words**: see C2. Every resume on record is the same harness session, resumed.
- **What we most want attacked:** See C2.

### C48 · "is read as interrupted"

- **Published at:** `docs/graph-ir.md:276` — "A record whose final note has no `ending` line before it, or whose `ending` line has no final note after it, is read as interrupted."
- **Evidence:** `packages/core/src/runs.ts:79` (`RunState = "running" | "halted" | "ended"`); `scripts/lib/prove-check.mjs:340`.
- **What we believe, and how sure we are:** **Carried for the proving check only.** The monitor has no such state.
- **What we most want attacked:** Nothing in particular.

### C49 · A critic on another tier "tends to catch different mistakes"

- **Published at:** `docs/rules.md:189`, printed by the validator (`packages/core/src/validate.ts:431`) — "a critic on a different tier or pin tends to catch different mistakes"; `docs/field-guide.md:60` — "so it does not share the builder's blind spots"; `docs/field-guide.md:325` — "a same-model critic keeps approving the mistakes the builder makes"; `docs/subagents.md:70` — "a critic that starts fresh is worth more than one that was told what the builder thinks of its own work."
- **Evidence:** none in the repository. `experiments/patterns/heterogeneous-critic/` is one run with no same-tier control, and its loop turned on held-out evidence, not on the tier.
- **What we believe, and how sure we are:** **Not carried as findings.** They are design beliefs, some with support in published work outside this repository, none measured here. Decisions 0012 and 0013 say quality is not shown.
- **Words we would publish instead:** say them as beliefs: "may catch different mistakes"; "so it need not share the builder's blind spots".
- **What we most want attacked:** Whether a design belief stated in a template's description is a claim at all under decision 0024. We think it is when it says what happens to quality.

### C50 · "small enough for a model to read and rewrite in one pass"

- **Published at:** `docs/report/grooph-technical-report.md:29`; `docs/blog/2026-10-loop-graphs.md:24` — "A model can read it and rewrite it in one pass."; `docs/rules.md:293` and `:435` — "exceeds 24,000 characters (about six thousand tokens). This is the "rewrite in one pass" budget", "over the 24,000 a model rewrites in one pass".
- **Evidence:** `packages/core/src/validate.ts:34` (the limit); `spec/capability-spec.md:51` (the principle). No measurement.
- **What we believe, and how sure we are:** **Carried as a design limit, not as a measurement.** Agents in this project do rewrite these documents daily; nobody measured where one pass stops working, and "about six thousand tokens" is four characters to a token.
- **What we most want attacked:** Nothing in particular.

### C51 · "One short line per dispatch; no other cost."

- **Published at:** `docs/runs.md:15`.
- **Evidence:** decision 0013, point "The record and its cost"; `tools/comparison-facts.mjs`.
- **What we believe, and how sure we are:** **Carried with other words.** The sentence is about one kind of note. The record as a whole is the package's one measured cost: 3 to 17 more harness turns a run than the prompt arms (C2). "No other cost" was not measured.
- **What we most want attacked:** Nothing in particular.

### C52 · Smaller points, from the sweep

- `docs/subagents.md:101` — "19 turn ends and 19 of them": the record has 20 such stops, 19 after a turn's end and one during a turn (`experiments/hooks/2026-10-03/README.md:12`).
- `docs/subagents.md:192` — "about thirteen seconds", labeled "[tested against real repositories and a remote that never answers]": the source is one sentence in a handback (13.7 s); no test uses a remote that never answers and no output is kept.
- `docs/subagents.md:99` — Codex gives the model "on every hook": the cited record lists a session end's keys without `model`.
- `docs/subagents.md:198` — "for the seventy minutes it went on working": the figure is in no record.
- `docs/subagents.md:114`, `:50`, `:52`, `:58`, `:204` — labeled "seen" with no kept recording; `experiments/hooks/README.md` says every "seen" comes from a session that was really run and that the folder is the proof.
- `docs/subagents.md:194` — "about sixteen at one moment is the ceiling by that arithmetic": 45 seconds at 2.5 seconds a round is 18.
- `docs/subagents.md:127` — "grooph's is one readable file of about a hundred lines": true of the event hook (103 lines); the sender installed beside it is 954.
- `docs/community.md:3` — "nothing irreversible runs without a person": about a document, and about marked nodes only (C21).
- `docs/quickstart.md:24`, `:34`, `:45` — "Each command ends with a `next:` line" (not `grooph image`, and not when piped); "Every error says what to fix" (several name the fault only); "CI runs it on every push" (pushes to `main` and `slice/**`, and pull requests).
- `docs/field-guide.md:673` — "four reviewers and a judge cost four times a round": not measured.
- **What we believe:** each is a wording fix. None blocks a claim of value.
- **What we most want attacked:** Any of these that is worse than a wording fix.

---

## What we already know is weak

So you do not spend the round rediscovering it.

- **One run per template, two per arm.** No rate, no variance. Every table says "range, not mean".
- **The comparison's tasks were at the ceiling.** Every arm passed its held-out suite at round 0. No loop turned in 27 runs, and the loop arm ran once each time (C12).
- **One harness and one model family**: Claude Code 2.1.276 and 2.1.278, leads on `claude-opus-5`, with `claude-sonnet-5` and `claude-fable-5-1` under them. The project no longer uses the last of these; study two is being redrawn without it.
- **The proving check reads the lead's own notes** for several facts (the stop that fired, the ending, the order of stops), and the transcripts for others.
- **Held-out evidence and isolation are instructions**, not permissions (C46).
- **Everything about cloud sessions is a report** from another project's session, with no recording here (C38, C39).
- **The blog draft was written by a model in the owner's voice**, and the site renders it and the report though both are headed "draft … for Ryan to edit". Its first-person sentences ("I run a lot of coding agents. Some days a dozen at once, on two accounts", "They are the mistakes I kept making", "I would not have guessed that") are the owner's to vouch for. He is rewriting it by hand; we report its claims and do not touch the file.
- **No Codex target exists.** Every run on record is a Claude Code run.
- **Study two has not run** (C18).

## Since the last round

This is the first round.

## What to hand back

`round-01/HANDBACK.md` in this folder, from `TEMPLATE-AUDIT-HANDBACK.md` (a copy is beside this file). Number your findings F1, F2, … and name the claim each one bears on by its C-number. For a claim where we wrote "not carried" or "carried with other words", say whether you agree with our reading and with the words we would publish, and give your own words where you would publish something else. Say what you checked and found sound, and what you could not check. If you think an experiment is needed, the smallest one that would show a brake holding a run (C1) is the one we most want designed. Keep working notes in `round-01/notes/` if you want them kept. End your reply with the prompt the owner should carry back to the audit lane.

---

## Added on 2026-10-04, after this handoff was written and before Codex opened it

One more thing we know, found by another lane of this project (the one redrawing study two) and checked by us in the transcripts. It is not a published claim. It is a limit on what study one's prompt arms can be called, so it bears on **C12**, **C15** and **C17**, and through them on the words "the same instructions given as a prompt" in **C4**.

**Study one's prompt arms were not blind to the tool.** Every headless session of arms B and C was shown four things that named grooph or the experiment:

1. **The scratch repository's last two commits**, which the harness puts in a session's context when it starts: "remove the package: this arm runs on the derived prompt alone" and "task and the grooph package for <template>". The runner writes both (`scripts/lib/compare-run.mjs:133`; `scripts/lib/prove-pattern.mjs`, the commit in `buildScratch`). So a prompt-arm session was told, in words, that it was an arm, that a package had been removed, and that its prompt was derived.
2. **The git user's name**, "grooph prove", in the same context.
3. **The `grooph-design` skill**, listed by name with its description among the session's skills. The runner starts `claude` with the owner's own home folder (`cleanEnv` in `scripts/lib/prove-pattern.mjs`), where the skill is installed.
4. **The `grooph` command on PATH**: the runner puts a `grooph` shim first on PATH for every arm (`scripts/lib/compare-run.mjs:164`, `:743`).

The transcripts are on the Mac that ran the study, under `~/.claude/projects/*grooph-compare-*`, and are not in the repository or the snapshot. `tools/prompt-arm-context.mjs` counts over them and prints no transcript text. It printed, on 2026-10-04:

```text
Prompt arms (B and C): 18 runs.
  lead session shown the skill's name (grooph-design): 18
  lead session shown the commit "remove the package: this arm runs on the derived prompt alone": 18
  lead session shown the commit "task and the grooph package for …": 18
  lead session shown "Git user: grooph prove": 18
  runs whose subagents were shown the skill's name: 18; either commit: 18
  runs in which any session ran the grooph command: 0; used the Skill tool: 0
Graph arm (A): 9 runs.
  lead session shown the skill's name (grooph-design): 9
  lead session shown the commit "remove the package: this arm runs on the derived prompt alone": 0
  lead session shown the commit "task and the grooph package for …": 9
  lead session shown "Git user: grooph prove": 9
  runs whose subagents were shown the skill's name: 0; either commit: 9
  runs in which any session ran the grooph command: 0; used the Skill tool: 0
```

- **What we believe, and how sure we are:** Sure of the counts. No session used the skill or ran the command, and the study's numbers stand as recorded. What changes is the description: the prompt arms were not "a prompt" given to a session that knew nothing else. They were sessions told they were an arm of a comparison with a package removed, with the tool's skill listed and its command at hand. Whether that moved their behavior cannot be known from 18 runs with no arm that lacked it. It weakens "equal conditions" only in the sense that the arms differed in what they were told about themselves; it does not make arm A look better or worse in any way we can show.
- **Words we would publish instead:** add to the study's limits (report line 103, and the blog where it describes the arms): "The prompt arms were not blind to the tool: each session could see, in its repository's history and its list of skills, that a grooph package had been removed and that it was an arm of a comparison. None used the tool."
- **What we most want attacked:** Whether this is worse than a limit: whether a session told "this arm runs on the derived prompt alone" is still a fair stand-in for a person's prompt. And whether the graph arm's sessions were told anything that the prompt arms were not, beyond the package itself. You can check the runner's code in the snapshot; you may not be able to read the transcripts, and if so say that you could not.
