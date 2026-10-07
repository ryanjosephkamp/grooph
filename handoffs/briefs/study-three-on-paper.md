# Study three, on paper: where a graph should earn its cost, if it does anywhere

**Written on 2026-10-05 by the evidence lane, for the owner to say yes or no to. Nothing here has been run, no runner has been written, and no model session was started to write it.** It follows the owner's reading of study two: "perhaps graphs are most useful when coordinating many more subagents or agents than we've been using here, or they earn their keep for long autonomous runs?"

**The table and the recommendation under it are what is asked. The rest is each question in full.**

## What the first two studies leave open

In study two, on tasks of four dispatches, the package cost $1.38 a run and the same design as prose $0.87, and they scored the same. The whole difference is the package's lead: what it reads before it starts and the record it keeps ([`experiments/comparisons/derived/lead-cost.md`](../../experiments/comparisons/derived/lead-cost.md), in pull request 106 until it merges). In study one, as audit 0001 now reads its records, none of the four projects met its test for the graph earning its cost: three met their losing condition and `review-gate` met neither, and one correction cycle did turn, in a prose run. Two things were never tested in either study, because no run needed them:

- **What the record and the brakes are for.** No round cap and no budget is on record as firing, in any package run or in study two (audit 0001, finding F3). Every halted run that went on was continued by resuming the same session, never by a fresh one from the run folder (finding F11).
- **Size.** No comparison run had more than four dispatches or two kinds of subagent.

Study three asks five questions. Each puts the package (arm A) beside the same design as prose (arm B, derived by the protocol's rule, never written by hand), and each says before any run what would count as yes and as no.

| | Question | Sessions | Spend | Runner clock | Needs building first |
|---|---|---|---|---|---|
| 1 | A brake that binds | 4, then 6 | under $4, then about $5 | under an hour | the audit's design as a slice |
| 2 | A halted run picked up by a fresh session | 1, then 16 | about $0.50, then $20 to $35 | minutes, then about 2 hours | for the second step, a stop-and-resume mode and one task |
| 3 | Many more dispatches | 9 | $45 to $50 | about 4 hours | one task, a design check for arm B, the lighter package |
| 4 | A long run with nobody there | 1 | six hours of the weekly allowance | six hours | an amendment to the game experiment's protocol |
| 5 | Roles or information | 12 | about $9 | about an hour | two derived prompts for each of study two's tasks |

**My recommendation: the first step of 1 and of 2, and 5, now. They are small. The audit asks for the first two, and the third answers its finding F12. Then the cheapest cut anyone has named, a sentence in the lead brief (its own section below). Then 3. Decide 4 after the game run's own record has been read.** Questions 1 and 2 test the two things a package claims that prose lacks. If prose does both as well, cutting the record's cost is beside the point. Question 5 says what study two's one positive result was made of.

The comparisons ledger stands at $82.66. Everything in 1, 2, 3 and 5 would take it to about $180, past the $100 and $150 marks at which the driver is told. The estimates are from study two's cost per dispatch.

## 1. A brake that binds

**The design exists and I take it as it is:** `experiments/audits/0001-claims-as-of-0-3-0/designs/a-brake-that-binds.md` (on the audit lane's branch, `slice/0075-audit-claims-as-of-0-3-0`, until it merges), Codex's, adopted by the audit lane with the game experiment's clean profile and a record of what each session was given. One graph compiled twice, with a dispatch budget of two and of six. A task that never passes, and both leads told so. The outcome is a pair: the small run halts at two with the check still failing, and the large run goes past two and halts at six. Dispatches are counted from the transcript, not from the lead's own notes.

I had drafted two tasks of my own that hid an unreachable item from the builder. Its first criterion rules that out, rightly, and I have dropped them.

**What I take from it without change.**

- **It is the first case of study three, not a study of its own.** A longer study that hopes a brake fires along the way may see none, as both comparisons did.
- **The count is the harness's.** Dispatches and check runs are counted from the tool events in the transcript and set beside the lead's own count. Today's proving check compares the lead's count with the lead's notes and never with the budget (finding F6), so the counter is new work.
- **The watchdog is not the brake.** If the outer limit on dollars or minutes ends a run, the budget has not passed, and the write-up never calls that a graph's stop.
- **A clean start.** The game experiment's profile, and a record afterwards of what each session was given.
- **What it cannot show is in the pre-registration:** no rate, no dollar or minute budget, no round cap, no order between two stops.

**Where I would change it, and why.**

1. **Run the same budgets as prose in the same batch, not afterwards.** This is the one place I argue with it. The design keeps prose as a later case of its own, one run at the small budget. I would run it the same day, at both budgets: two more sessions of the same size, from the same clean profile. The design itself says this is "the only way to say anything about a package against a prompt", which is the owner's question. It needs the large budget for the same reason the package does: to show the session would have gone on. Run later, the prose pair would be run by someone who knows how the package pair came out, on another day's harness. The package pair alone still decides whether a budget binds. The prose pair stays its own case, reported beside it, with its outcome written first: **yes** for the package if prose overruns either budget; **no** if both forms halt at both.
2. **Add one case to what comes after: a budget that falls inside a round** (five, where a round costs two). Two and six both land on a round's edge. The lead brief evaluates its stops "before every round" and states a budget in whole rounds, and the one disagreement on record between a brief and its check is over how dispatches are counted (the `gauntlet-decomposed` re-proof). Criterion 3 fixes on paper what the boundary means. Only an odd budget tests it.
3. **Add a second case: a budget that binds on work one round from passing.** The design's task is one the lead knows will never pass. The harder case is a lead that has just been told what to fix. Study two's three tasks are built for it: in all 18 runs with a reviewer the first review failed and the second passed. The same three tasks with a budget of two, as package and as prose, once each: six sessions, about $5. **Yes:** the package halts after the failing review in three of three and the prose sends a third subagent in at least two. **No:** the prose halts in three of three.
4. **Read the lead's cost from both package runs** with the lead-cost script. It costs nothing, and it is a second measure of calls per dispatch, this time from a clean profile.

## 2. A halted run picked up by a fresh session

**Why.** The record's stated purpose is that a run id resumes a run. The prose arm keeps nothing to resume from but the working tree.

**First, the smallest form, which the audit also asks for: one short session.** Take a kept run that halted at its gate, for example `review-gate-2/A-1`. Rebuild its project from the record: the task, the kept diff, the package and the run folder. Start a fresh session from a configuration folder that does not hold the first session's history, give it the run id and the answer "approve". Every resume on record is the same harness session resumed and told the run id. This is the case the package is written for, and it has never been recorded.

- **Passes if** it makes no second run folder, appends to the same notes and does not rewrite them, dispatches no builder and no reviewer again, takes the gate's edge and writes the ending.
- **Fails if** any of those is otherwise.
- **Cost:** a lead's setup and a few calls, about $0.50 by the lead-cost page. **Who:** the evidence lane, since the runner and the record are its; when is the driver's to say.
- **One thing for the owner:** the gate's answer is scripted and would be labeled so. Study two allowed no scripted answer. Here the answer is the test's input.

**Then, only if that passes, the comparison.** Three pieces, each with a builder and a reviewer and held-out cases built so a first pass fails: about twelve dispatches if nothing is interrupted. The runner ends the first session without warning at a fixed point and starts a second in the same folder.

- Arm A's second session is told to resume the run id.
- Arm B's second session is given the same prose with the sentence the protocol's loop arm already uses: continue from the working tree as it is.
- Two stop points (after a builder finishes; after a reviewer fails a piece), twice each: eight runs of two sessions.

**Measured, from the two sessions' digests.** Work redone: dispatches in the second session for a piece that had already passed. Work skipped: a piece never reviewed. Total dispatches across both sessions against the loop's budget. The held-out score at the end. The cost of both sessions together.

**Yes:** in every run A redoes no piece that had passed, B redoes at least one or skips a review, and A's two sessions together cost no more than B's. **No:** B's redone work is within one dispatch of A's and the scores are the same. Then the working tree was record enough.

## 3. Many more dispatches

**Why.** The owner's first guess. Nothing past four dispatches has been observed. By arithmetic on study two's twelve runs of four dispatches, the package would be about 45% above the prose at twenty, against about 60% as run, and from each project's runs alone anywhere from 30% to 64%. The arithmetic assumes that what fell before the first dispatch is paid once and that what fell in a cycle is paid again at each dispatch, and no slope could be fitted to check either. This measures it, and asks whether a prose lead still holds a design of this size.

**Task.** Six independent pieces of one small library, each with a builder, a fresh reviewer and held-out cases; at most two pieces at once; then an integrator and a final reviewer. Fourteen dispatches if nothing fails and about twenty if each piece turns once.

**Arms.** A, B, and **A-light: the package with its record cut** (slice 0021's hook-written notes, and whatever else of the lead's bookkeeping has been cut by then). Three runs each.

**Measured.** Whether the design was kept, read mechanically from the digest: every piece built, every piece reviewed by a subagent that had not built it, held-out cases read only by reviewers, the integrator after the last piece, never more than two at once. The held-out score for each piece. The cost, with the lead's share by the same script as study two's.

**Yes:** B breaks the design or ends below A on held-out cases in at least two of three runs, and A does not. **No:** both keep the design and score alike. Then the answer is the measured premium, and whether it fell or rose from 60%. For A-light the plan's own test for stage 16 stands: the lead's turns fall by half with the record intact. By the count in the lead-cost page, hooks alone will not reach it.

**The ceiling.** By the same arithmetic an A run here costs about $6. That is inside the $9.00 a session may spend, but not by much, and the project would end near $50 against the $60 at which a project stops and asks.

## 4. A long run with nobody there, at its cheapest

**The game experiment is already this, once.** It is one six-hour run in Claude Code from a package, with a budget of 110 dispatches. Its own protocol says what one run can show: whether the brakes held for six hours, what was built, what it cost.

**Before any second run, at no cost:** the lead-cost script can read the game run's transcript once it exists. That gives the first measured cost of a package's lead at about a hundred dispatches. Today there is only arithmetic, and at that length it stops being a guide: it carries the lead's context to about 465 thousand tokens and has no compaction, and what the harness does with a context of that size is not known here. The game run's transcript would also show whether the lead's context was compacted, and what it went on from.

**What a second six-hour run would add, with the same spec and the design given as prose:**

- the same 21 held-out checks and the owner's ten minutes on a second build, blind;
- whether a prose lead keeps the design for six hours: every milestone reviewed before the next is started, no milestone begun after hour five, no more than 110 dispatches, nothing asked in the middle;
- both leads' cost at this length, measured.

**What it would still not show.** A rate: with one run each, a difference could be luck, and the game's protocol already says evidence about graphs against prompts needs each arm at least twice. Anything about the task with no design at all. And it would not be blind to order: the package ran first, so the prose would have to be derived by rule from the frozen package, with what counts against it written down, before the package run's result is scored. The protocol's first section says nothing else is run, so a prose run is an amendment to it, and the owner's.

**Yes, for one run each, can only be a named failure:** one build breaks something on the protocol's own list (a question in the middle, still building at the wall, a result that does not start, more than 110 dispatches) and the other does not. Anything short of that is two accounts.

## 5. Roles or information

**Why.** In both comparisons the reviewer held evidence the builder had not seen. So a design ended above the task alone on the held-out suites, and nobody can say whether the roles did it or the information did (audit 0001, finding F12). Two arms on study two's own three tasks can say, with the same suites as the scorer.

- **Information without roles (arm E):** the task alone, as arm D, with the held-out material named to the one session.
- **Roles without information (arm F):** arm B's prose with the held-out material removed and never named. A reviewer in a fresh context, holding nothing the builder lacks.

Twice each on three tasks: twelve runs, about $9 (E at about arm D's cost, F at arm B's).

**The information did it** if E matches arms A, B and C (55 of 55, 70 of 70, 24 of 24) and F stays where D ended (51, 52, 15). **The roles did some of it** if F ends above D in both runs of at least two tasks. Either way it is known before question 3 spends more on a design with reviewers in it.

## Who is given what

The table the audit asks every comparison to carry (finding F12), written before any run.

| Question | The lead, arm A | The lead, arm B | Builders | Reviewers and checks | What differs between the arms |
|---|---|---|---|---|---|
| 1, the pair | the package with its budget; told the task will not pass | the same, as prose | the task: make a small artifact | a read-only check that fails every round | the form only. Nobody holds anything another lacks |
| 1, one round from passing | study two's package, with a budget of two | study two's prose, with the same budget | the task and its checklist | the held-out material, which the builder does not have | the form only |
| 2 | first session as study two's; the second is given the run id, and the run folder is in the project | first session as study two's; the second is given the same prose and the working tree | the task for their piece | the held-out cases for their piece | **what the second session is given: the record, or only the tree.** Neither has the first session's history |
| 3 | the package (A); the lighter package (A-light) | the prose | the brief for their piece | the held-out cases for their piece | the form, and in A-light who writes the record |
| 4 | the game's package | prose derived from it by rule | the spec | the spec, and the build to play | the form. No session in either is given the 21 checks |
| 5 | none: arm E is one session with the task and the held-out material | arm F: study two's prose with no held-out material | in F, the task | in F, nothing the builder lacks | **who holds the information**, with the roles removed (E) or kept (F) |

One limit, known now: the clean profile closes the file tools to anything outside the session's folder. Material for a reviewer alone then has to sit inside the folder, where a builder is kept from it by instruction and not by the harness, as in study two. I have not found a setting that walls it from one subagent and not another.

## Three measurements that need no design

Both sides of audit 0001 name them. None is run here.

| | What | How | Cost | Who |
|---|---|---|---|---|
| a | **How long the event hook takes.** `docs/subagents.md` says "about 40 ms" and nothing measured it | Run the installed hook a few hundred times with a recorded event as its input, cold and warm; report the middle and the slowest tenth, on this Mac and in CI | no model session, no spend, a quarter of an hour | the lane that holds the hook; the evidence lane can if none does |
| b | **What a first visit to the front page fetches with the service worker on.** The published paint times were taken with it blocked, and the published size is what the address loads to show itself, before the worker fetches the rest | The timing script's own browser with the worker allowed and a fresh profile: every request and its size until the worker is idle, in CI, since budget figures are CI's | no model session, no spend, one CI job | the site lane |
| c | **A fresh session resuming a halted run by its run id** | Question 2's first step, above | one short model session, about $0.50 | the evidence lane, when the driver says |

## The cheapest cut named so far: what the lead reads before it starts

**What it is.** The largest single item in the package's extra cost is the reading before the first dispatch, and nothing tells the lead to read the graph document or the agent files. Six of six leads read both agent files and five read the graph. The cut is a sentence in the lead brief: what you need is here; the agent files are the subagents' and the graph is the record's; read them only to amend.

**What it would save, by my count** (Table 10 of the lead-cost page): **$0.088 a run** at four dispatches, from $0.036 to $0.105 by run, which is 17% of the difference to prose. That is more than hook-written notes would remove ($0.054). About two thirds of it is the files written to the cache, once. The rest is every later call reading 6,700 tokens fewer. It is arithmetic: it removes reading from runs that did read.

**What could go wrong.**

- **Routing: no run shows it.** The brief's own tables carry the nodes, the edges, the loops and the stops. The one lead that did not read the graph document dispatched builder, reviewer, builder, reviewer, as the five that did. That is one run.
- **Isolation: here reading did matter.** In three of the six runs the lead saw, in the agent file, that the builder's declared inputs named the reviewer's held-out material, and amended it out. A lead told not to read would not have seen it. In these runs the scores were the same either way, and the fault came from how I filled the template's slot. But it is the kind of catch an adaptive lead is for. **A validator warning for a reviewer's artifact named in a builder's inputs would make the same catch at compile time**, with a code and a fixture like every other rule.
- **Declared inputs.** The brief asks the dispatch prompt to carry a node's declared inputs, and those are written only in the files the sentence would close. The brief has to list them, or say that the agent file already gives the node its inputs.
- **Amendments.** A lead cannot amend a working copy it has not read. The sentence has to leave that open.

**Where it sits: cut first, then test. Not an arm.** Three reasons.

1. **Its effect needs no comparison to see.** Unlike the hooks, nothing here depends on how a lead behaves afterwards: the tokens are either read or not, and the digest shows which. Its proving run only has to show the package still drives the session as designed and that the lead did not read the files.
2. **Mixed into the A-light arm it would hide the hooks' own effect.** With the brief changed first, question 3's arms stay clean: A is the package with the new brief, A-light adds hook-written notes, B is the prose.
3. **Questions 1, 2 and 5 should run before it, on the compiler as it is.** The brake design forbids changing the compiler or the brief for its test, and the resume step uses a kept run's own package.

So the order is: questions 1, 2 and 5 on today's compiler; then this change, with the validator warning and a proving run, after the game experiment's first commits are pushed; then question 3.

## Where slice 0021's measurement belongs

**As an arm of question 3, not as a run before the study.** By the count in the lead-cost page, hook-written notes remove about a sixth of the lead's turns and a tenth of the difference to prose: about three calls and $0.05 a run at four dispatches. Across study two's six package runs the lead's cost ran from $0.64 to $1.06. One proving re-run of a four-dispatch template cannot tell $0.05 from that spread. At twenty dispatches, three runs an arm, it can. Building the slice costs no model session and can go on while questions 1 and 2 run. Those two do not wait on it: they ask what the record buys, not what it costs.

## What has to be built first, with no spend

The brake design as a numbered slice, with the prose pair. Before question 3, the brief's sentence about what the lead reads, with its validator warning and a proving run. The comparison runner started from the clean profile (it was written for a session in a terminal; I have not checked that a headless session starts from it). A stop-and-resume mode in the comparison runner. The two derived prompts of question 5. The two new tasks (three pieces; six pieces), each with its pre-registration and an independent reader of its held-out material, as in study two. A check that reads the design facts from a prose run's digest. The lighter package.

## What all five together still cannot say

One harness and two models. Tasks designed to make the question bite, by one author. Two or three runs an arm at most, so ranges and never rates. Nothing about work a person steers as it goes.
