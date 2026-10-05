# 6 · A run

[Start page](README.md) · previous: [the package](05-the-package.md) · next: [adopting a run](07-adopting-a-run.md)

A **run** is one time an agent session follows a package from start to finish, or to the point where it has to wait for you.

grooph does not do this part. You open the harness in your project and start the run yourself, by pasting the kickoff message or, in Claude Code, by typing the command the package installed (`/add-a-rounding-helper` for our example). From then on the harness's main session is the **lead**, and it works from `LEAD.md`.

**This guide started no agent.** Running one costs money and is not something a guide should do on your behalf. So this chapter does not show a run of the rounding example. It shows a real one that the project keeps: the **proving run** of the same `review-gate` template, recorded on 20 September 2026, on a very similar small task. There the task was to add a `truncate(text, max)` function, and the graph's id is `truncate`. Everything below is that record, read with grooph's own commands. To follow along, copy it into a scratch folder in the layout a project would have: `experiments/patterns/review-gate/run/package/graph.grooph.json` to `.grooph/truncate/graph.grooph.json`, and the folder `experiments/patterns/review-gate/run/runs/20260920-172408` to `.grooph/truncate/runs/`.

## What the lead is told to do

In order, from the lead brief:

1. **Set up.** Read the time from the clock to make a **run id** such as `20260920-172408`. Make a folder for the run. Copy the graph into it. That copy is the run's **working copy**.
2. **Start at the first node** and dispatch it as a subagent, handing it only its task, its inputs and its evidence.
3. **When a node reports**, read its verdict, write a note, and follow the matching edge.
4. **At the end of each pass through a loop**, check the loop's stops in order and write down which one applied.
5. **At a human gate**, write a note saying the run is halted, ask the question, and end the turn. Do not guess the answer.
6. **At the end**, write a final note and report.

## What a run leaves behind

Everything a run writes goes in one folder, the **run folder**:

```text
.grooph/<graph-id>/runs/<run-id>/
  PROGRESS.md          a page a person can read
  notes.jsonl          one note per line, in order
  graph.grooph.json    the run's working copy of the graph
  …                    anything else the lead saved: review files, test output
```

To see what runs a project has:

```bash
grooph runs list
```

```text
RUN               GRAPH      STATE    ROUNDS   STOP
20260920-172408   truncate   halted   0        bar passed
```

One run. It is **halted**, which means it is waiting, not that it failed. It went zero rounds past the first pass, and the stop that applied was "bar passed".

And one run in full:

```bash
grooph runs show .grooph/truncate/runs/20260920-172408
```

```text
Run 20260920-172408 · Truncate (truncate)
  halted · started 2026-09-20T17:24:16Z
  cost noted: 2 dispatches
  folder: .grooph/truncate/runs/20260920-172408

Nodes
  builder     passed   1 run · round 0 · last pass
  critic      passed   1 run · round 0 · last pass
  merge-gate  halted   1 run · round 0 · last halt
  done        pending

Loops
  review  round 0 · bar passed fired (n-0006)

What the run changed
  none: the working copy is the source (layout and notes aside)

Timeline
  n-0001  graph                   run started
  n-0002  node:builder            r0 · started · dispatching builder, round 0
  n-0003  node:builder            r0 · pass · builder round 0: added src/truncate.mjs, tests/truncate.test.mjs, CHANGELOG.md line, CHAN…
  n-0004  node:critic             r0 · started · dispatching critic, round 0
  n-0005  node:critic             r0 · pass · all 6 checklist items cited as satisfied with file and line; npm test 12/12, 0 skipped, 0…
  n-0006  loop:review             r0 · pass · round 0 finished; stops evaluated in order: bar-passed fires (every checklist item cited …
  n-0007  node:merge-gate         r0 · halt · human gate merge-gate reached: asking the human whether to merge the change the critic pa…
```

Read the timeline as a story. The run started. The builder was dispatched and finished. The critic was dispatched and passed the work. The lead checked the loop's stops and found the bar passed. It reached the human gate, wrote that it was halting, asked, and stopped. `done` is still pending because nobody has answered.

## The progress page

`PROGRESS.md` is the same story written for a person. Its top:

```text
- **Round (loop `review`):** 0
- **Dispatches (loop `review`):** 2 of 10
- **Waiting on:** the human, at `merge-gate` — halted, question asked.
```

"2 of 10" is the lead keeping count against the budget, as the brief told it to.

## A note

`notes.jsonl` holds one **run note** per line. A note is a small structured record. Here is the critic's, with nothing changed:

```json
{"id":"n-0005","run":"20260920-172408","at":"node:critic","started":"2026-09-20T17:25:57Z","ended":"2026-09-20T17:27:29Z","outcome":"pass","verdict":"pass","round":0,"evidence":["git diff of the uncommitted change","src/truncate.mjs","tests/truncate.test.mjs","CHANGELOG.md","docs/REVIEW-CHECKLIST.md","npm test output it ran itself"],"cost":{"measure":"dispatches","amount":1},"text":"all 6 checklist items cited as satisfied with file and line; npm test 12/12, 0 skipped, 0 todo; wrote REVIEW.md. Non-blocking: CHANGES.md cites a line one off."}
```

It says where it happened (`at`), when, how it came out (`outcome`, `verdict`), in which round, what was looked at (`evidence`), what it cost against the budget, and a sentence in words.

And the loop's note for the same pass, which records the stop:

```json
{"id":"n-0006","run":"20260920-172408","at":"loop:review","ended":"2026-09-20T17:27:29Z","outcome":"pass","round":0,"stop":"bar-passed","text":"round 0 finished; stops evaluated in order: bar-passed fires (every checklist item cited satisfied, npm test exit 0), so max-iterations 4 and budget 10 not reached; taking pass exit edge e-critic-pass to merge-gate"}
```

Besides these, a note can be an **amendment** (the lead changed its working copy, and why) or a **proposal** (the lead suggests a change for a person to accept or reject). Chapter 7 is about those.

## Waiting for a person, and carrying on

A run that reaches a gate ends its turn there. If you are sitting in the session, you answer and it continues. If the session was started by a script with nobody watching (a **headless** run), it simply ends at the halt note. To carry on, the same session is resumed and told the run id. It reads `PROGRESS.md`, sees where it stopped, and keeps writing to the same `notes.jsonl`.

## Four honest things about this record

**The loop did not turn.** The bar passed on the first pass. The critic agreed with the builder, so no work was sent back. This run shows the template's steps happening in order. It does not show a reviewer catching anything.

**The record is the lead's own account.** The notes and the progress page are written by the session that did the work. The project does check them against a second source, the harness's own log of which subagents ran, with a script called the proving check. That check looks at selected parts of a record. It does not re-judge the work.

**Sessions do not always do exactly what the package says.** An earlier run of this same template stopped at the gate and asked, but did not write the halt note the brief asks for, and the check failed it on that. The project kept that record too. Across the twenty kept proving records, eighteen pass the check and two do not, and some records leave out fields the package asks for.

**No brake had to hold here.** The run ended because the work passed and a person was asked. The round cap of 4 and the budget of 10 were never reached. That is true of every recorded run so far, and [chapter 13](13-what-the-experiments-found.md) says why it matters.

The reference for this chapter is [runs.md](../runs.md), and the write-up of this run is [experiments/patterns/review-gate](../../experiments/patterns/review-gate/README.md).
