# 13 · What the experiments found

[Start page](README.md) · previous: [the command line and the app](12-command-line-and-app.md) · next: [the claims page and the audit](14-claims-and-the-audit.md)

It is easy to build a tool and say it helps. This chapter is about what grooph has actually tested, what came out, and what did not. Much of it is "this is not shown". A beginner deciding whether to spend time on a tool is owed that more than anyone.

The findings here are the ones on two of the project's own pages: its [list of claims](../claims.md), and the [decision](../decisions/0029-what-is-shown-as-of-the-first-audit.md) that sums the list up. Figures not on them come from the ledgers and write-ups under `experiments/`, and the last section is the author's summary. The project's agreed summary, word for word, is this:

> Each of the twenty templates has a recorded run: eighteen pass the project's checks and two are published red. In those runs a session stopped where its graph said, at a passed bar or at a human gate, and left a record of what it did. No round cap or budget is on record as firing, so it is not shown that one holds a run that would otherwise go on. In a paired comparison on four small tasks the package showed no quality advantage over a prompt derived from it.

The rest of the chapter explains each part of it.

## Two kinds of experiment

grooph has run two kinds, and they ask different questions.

| | Asks | How |
|---|---|---|
| **Proving runs** | Does a package drive a session the way the graph was drawn? | Run each template once on a small task and keep the whole record |
| **Paired comparisons** | Does a graph produce better work than a prompt that says the same things? | Give the same task to a graph and to a plain prompt and compare the results |

Both kinds keep their evidence in the repository, under `experiments/`. One rule covers all of it: **a record is never edited afterward**, and a result that looks bad is published as it is.

## The proving runs

Each of the twenty templates has one counted run, on a small task, with nobody watching. The harness's output, the run folder and the cost were kept. The twenty counted runs cost $41.12 in all, so about two dollars each. Six templates have earlier runs as well, seven in all. Those records are kept too, beside the later ones, and are not among the twenty. Six of the seven failed the check. Chapter 4 says more.

Then a script, the **proving check**, looks at each record and asks a few fixed questions. Did the agents the graph names run as their own subagents? Did the run end where the graph said it would? Are the notes whole? It reads the lead's own notes for some of these and the harness's own log for others. It looks at selected parts of a record. It is not a full reconstruction of the run, and it does not judge whether the work was good.

**Eighteen of the twenty records pass. Two do not.** The two are `gauntlet-decomposed` and `ralph-loop`. In one, a step that should have been its own subagent never ran as one. In the other, a builder read evidence it had been told was not its to read. Both records are kept exactly as they ran, marked as failures, with the reasons. That is what "published red" means.

What these twenty records show:

- **A run stopped where its graph said.** Every one ended in one of three ways: its loop's standard was met, it reached a stop box, or it reached a human gate and waited. Across these records and the comparison's package runs, fourteen stops at a human gate are on record, and one at a periodic check-in with a person. Those are recorded cases, not a measured success rate. (These counts, and the "ten of the twenty" below, were made on the records as they stood at version 0.3.0. Two of the twenty counted runs have since been replaced by later ones.)
- **A run left a record.** Every one left its notes, its progress page and its working copy. Some records leave out things the package asks for. Ten of the twenty, for instance, did not write down their dispatch counts.
- **An independent reviewer was seen to catch something, in two templates, once each.** In each, the critic held reference material that the builder had been told not to read, judged the work against it, and sent the work back. (The builder did not cheat. The point is that the reviewer knew something the builder did not.)

What they do not show: that any template makes work *better*. One run of one small task is a demonstration that the steps happen. It is not a measurement of benefit. The project used to say each template had been "proven", and withdrew that word: two of the twenty records fail their own check, and one run shows the steps happening, not a benefit. The runs are still *called* proving runs. That is only their name.

## The first paired comparison

This is the experiment that asks the question a beginner most wants answered: **is a graph better than just writing the same plan as a prompt?**

It took four templates (`grind-loop`, `review-gate`, `red-team-loop`, `spec-then-loop`) and one small task for each. Every task was run three ways, called **arms**:

| Arm | What ran |
|---|---|
| **A, the graph** | The template's package, exactly as chapter 5 compiles it |
| **B, the prompt** | One ordinary prompt, made by rewriting the package as plain prose: the same roles, the same order, the same limits, with none of grooph's files or record-keeping |
| **C, the prompt in a loop** | That same prompt given to a fresh session again and again, up to the template's round cap. In every run it finished on the first go, so nothing looped |

Each arm was run two or three times. That made 27 runs. The whole study cost $60.62: $56.62 for the runs and about $4 for the judge. The results were scored by a script against **held-out** test cases, meaning tests the builder was told not to read, and also ranked by a judge: a separate AI session that was not told which arm was which.

Before any run, the write-up for each of the four tasks said what result would count as the graph winning and what would count as it losing. Writing that down in advance is called **pre-registration**. It stops anyone from deciding afterward that whatever happened was a success. The question each one set itself was whether the graph **earned its cost**: whether it did something better that was worth what it cost to run. Each write-up set its own conditions. For `review-gate`, for example, the losing condition was the plain prompt matching the graph's result every time for less money.

### What came out

- **No quality advantage was shown.** Within each task, every arm reached the same score on the held-out tests.
- **None of the four met its test for the graph earning its cost.** Three met the condition they had written down for the graph *losing*. The fourth, `review-gate`, met neither condition: the results matched, but the prompt was not cheaper every time.
- **The graph was not always the more expensive one.** In `grind-loop` the package cost about twice what the prompt did. In `red-team-loop` the costs overlapped, and the most expensive run of all was a prompt run.
- **The judge never ranked a graph run first.** It was asked once for each task.

In plain terms: on these four small tasks, a plain prompt that said the same things scored the same as the package.

### What this does not mean

It would be just as wrong to overstate this result the other way.

- **It is not shown that the two are equal.** In three of the four tasks every run got full marks on the held-out tests, so the tests could not have told a better result from a worse one. In the fourth, every run missed the same single case of 62. A test everyone passes cannot rank anyone.
- **The tasks were small**, and each arm was run only two or three times.
- **The prompt-arm sessions could see grooph's name**, in their repository's history and in their list of skills. A scan of their transcripts found no use of either.
- **The two sides differed in more than one way.** The prompt kept the roles, the order, the loop and each brief. It left out each agent's tool list, its ownership and evidence rules, and the record. So the comparison cannot say which of those differences mattered.
- **In the prompt arms, the lead still split the work among subagents.** Told in prose that there was a builder and a reviewer, it started a builder and a reviewer. So this was never "a graph against one agent working alone". It was a graph against the same design described in a paragraph.

That last point is worth sitting with. What the comparison tested was the *package* against the *same plan written as prose*. It did not test whether having a plan helps.

## No cap or budget is on record as firing

This is the most important gap, and it is easy to miss. It is about two of the brakes, the round cap and the budget. Human gates are a different case: runs have stopped at those, as above.

A round cap and a budget are there for the bad day: the run that would otherwise go around forever. To know that a cap works, you need a run that *reaches* it while there is still work it wants to do, and then stops.

**No such run is on record.** When version 0.3.0 was published there were 33 recorded runs of a package: the twenty counted proving runs, four earlier ones, and the nine package runs of the comparison. In none of them is a round cap or a budget on record as firing. The twenty counted runs and the nine comparison runs ended earlier: at a passed standard, at a stop the graph names, or with a person asked. One of the four earlier runs ended another way: its lead halted with the loop still open, because the experiment's dollar ceiling would not cover another round. That ceiling is not a brake of the graph. By its own account, no cap or budget fired in the second comparison's runs either. The wording "on record" is deliberate: half of the proving records did not keep the lead's own count, so this is a statement about what the records show.

So it is **not shown that a cap or a budget holds a run that would otherwise go on.** That is why the project stopped saying that grooph "bounds" autonomous work. It may. Nothing recorded shows it.

One run in the first comparison was cut off before it finished. It was a *prompt* run, it was still inside the same caps its graph has, and what stopped it was the experiment's own dollar ceiling, set outside the session. It tells us nothing about a graph's brakes.

It does show that one limit with real force exists, and it is the harness's, not grooph's. Claude Code, started by a script, accepts a spending limit (`--max-budget-usd`). In the one recorded case it ended the session just past the limit: $9.02 against $9.00. If you need a hard limit on spending, that option has force and a graph's budget does not.

An experiment designed to produce exactly the missing record, a run that hits a small budget with work still to do, has been written down in advance. It has not been run, and the script that would start it is not yet in the project's main copy. It is in `experiments/brakes/budget/`.

## grooph enforces nothing while a session runs

Chapter 1's table said this, and it belongs in the list of what is not shown.

The validator checks a document. The package instructs a session. While a session is running, nothing in grooph watches it or can stop it. What force there is during a run is the harness's: each subagent's tool list and empty starting context, and a spending limit if you set one. The checks of grooph's that refuse anything afterward are made when a changed plan is taken up: adopting a run, in the command or in the app, and refreshing a subgrooph (chapters 7 and 8). They are new, narrow, and not yet audited, and `grooph export` makes no such check.

## The second comparison

A second comparison was run on 4 October 2026. It added a fourth arm, the task given alone with no plan at all, and used tasks built so that a first attempt would fail. Its records are in the repository under `experiments/comparisons/`.

**Its results are not repeated here.** They have been read by one AI system only, and the project's rule is that no page states them as shown until a second, independent one has read them. That reading is the next round of the audit in chapter 14. The rule is the same whichever way a result points, so do not read anything into the silence. If you want to see the records yourself, they are public, and its write-up says plainly what its author believes they show.

## What is not known at all

- What a correction is worth: how much a reviewer sending work back improves the result.
- What a brake is worth.
- Whether any of this changes on large tasks. Every task tested so far is small.

## So why would anyone use it?

A fair question, and the honest answer has two parts.

**What you can count on**, because it follows from how the tool is built and not from any experiment:

- the plan is **written down before anything runs**, in a form you can read, draw and send to someone;
- a short list of known mistakes is **checked for before anything runs** (chapter 3 says what the list misses);
- gates, approvals, irreversible markers and each loop's standard and limits are **drawn in the picture**, and every brake is written out in the outline;
- the instructions tell the lead to keep **a record** of which steps ran, in what order, and why the run ended. Every recorded run did leave one. Some are incomplete.

**What you cannot count on**, because it has been tested and not found, or not tested:

- that the result will be better than the same plan written as a prompt would give;
- that a cap will stop a run that wants to continue;
- that a session will do everything the package says. Eighteen of twenty records pass the project's check of selected parts. Two do not, and some of the eighteen still left things out.

If what you want is better output from an agent on a small task, nothing so far shows that grooph gives it: where it was tested, a prompt saying the same things scored the same. If what you want is to see the plan, check it and have a record, that is what grooph is.

The references for this chapter are [decision 0029](../decisions/0029-what-is-shown-as-of-the-first-audit.md), [claims.md](../claims.md), [comparisons.md](../comparisons.md) and the records under [`experiments/`](../../experiments/).
