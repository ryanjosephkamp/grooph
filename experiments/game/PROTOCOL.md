# Arena: the protocol

What keeps the game experiment fair, what is written down, and what its result will and will not mean. **Written on 2026-10-04, before any run. Nothing in this folder has been run: no session was started, no repository was made.**

The experiment: one browser game ([`SPEC.md`](SPEC.md)) built from one loop graph ([`arena.grooph.json`](arena.grooph.json)), once in Claude Code and once in Codex, each in its own public repository, six hours each. The owner asked to see what a loop graph does on something big and fun. This page is so that he can say yes knowing what he will get.

## 1. The two runs

Each run is one session in one harness: a lead and its subagents, as the graph draws them. They are called the **Claude Code run** and the **Codex run**. Nothing else is run: no prompt-only session, no second attempt.

## 2. What is the same in both

**The spec.** `SPEC.md` as it stands at one commit of grooph's repository, copied byte for byte into each game repository. Its checksum is in the record.

**The graph.** `arena.grooph.json` at the same commit, compiled once for each harness: `grooph export --target claude-code` and `grooph export --target codex`. The document is not edited between the two. If the Codex compiler needs the document to name its harness, that one line differs and the difference is in the record. Each package goes into its repository as the export wrote it.

**The machine.** The owner's Mac, for both. One run at a time, never the two together. The versions of the system, Node, npm, git, each harness and the browser the critics drive are in the record.

**What is on the machine.** Node, npm, git and Playwright's Chromium, installed before either clock starts. Blender is installed for both runs or for neither; which is the owner's answer (section 9) and is in the record.

**The starting contents of each repository.** A `LICENSE` (MIT), `SPEC.md`, the package, a `.gitignore` for `node_modules`, and a README of three lines saying what the repository is. No `package.json`, no code, no picture. The first commit of each holds exactly this.

**What a session may do without asking.** Read and write inside its own repository; run commands there (`npm`, `node`, `git` except `push`, the browser); reach the npm registry. Nothing else on the network, nothing outside its folder. Each harness says this in its own terms, and the terms used are in the record. Where the two cannot be given the same, the difference is written down before the run.

**The clock.** Six hours on the wall, from the note that records the owner's answer at the start gate.

- The graph's own brakes: no milestone is started after hour five, no round after 5 hours 15 minutes, and what is left is for the wrap-up and the final play. Every stop leads to the wrap-up; none halts the run.
- A wall behind them: at 6 hours 15 minutes a session still working is ended by the owner.
- **The result of a run is a commit, not a working tree**: the commit tagged `final` when the wrap-up finished, and otherwise the last commit at which the game builds and the critic's own checks (`playable/all.mjs`) pass, found by the scorer afterwards. Work that was under way when the clock stopped does not count for or against.

**The owner's answers, fixed now.** At the start gate: "start", within a minute of the question. At the end gate: "close". Nothing else is said to a session: no hint, no correction, no "go on". If a session stops and asks in the middle, it is given one line, the same in both runs, "Go on as the lead brief says. Nobody is here until the end.", and the stop is written down as an interruption with its time.

**Usage limits.** If a harness pauses a session because the account has used its allowance, the wall clock goes on, in both runs alike, and the pause is written down with its length. (The other way to do it, section 9: pay by use with a ceiling, so there is no allowance to run out.)

**The extension.** The owner has said he may give a couple of hours more if quality is not great, and that both would get the same. So: it is decided once, for both, after both six-hour results are scored and he has played both. If he extends, each run gets the same two hours as a second run of the same package in the same repository, under the same rules, with a wall at 2 hours 15 minutes. The six-hour results are recorded first and stay. An extension's result is written beside them, never over them.

**The order.** Which harness runs first is drawn by a coin and written down. The two runs start at about the same hour on two days.

## 3. The checks no builder sees

[`acceptance/`](acceptance/) holds about twenty things a player can do ([`LIST.md`](acceptance/LIST.md)), checked by a script where a machine can tell and by the owner where only a person can.

**How they are kept from the builders.**

- The folder is in grooph's repository and nowhere else. It is never copied into a game repository.
- Nothing a session is given names it: not `SPEC.md`, not the graph, not the package. The spec describes the test surface the checks rest on; it does not say what will be checked.
- Each game repository is cloned in a folder of its own, outside grooph's clone, and the session is started there. Its permissions do not reach outside that folder.
- After each run the harness's transcript is searched for the acceptance folder's path and its file names. A hit is written down, and that run's check results are then reported as "seen by the builder", whatever they are.

An instruction alone is not the wall: in the pattern library's own records a builder told not to read a held-out file read it once (`experiments/patterns/ralph-loop/`), and a planner copied a held-out reference into the builder's instructions (`experiments/patterns/gauntlet-decomposed/`). Here no node of the graph is given the checks, so no node can pass them on.

**How they are run.** On each run's result commit, in a clean checkout: `npm ci`, `npm run build`, the files of `dist/` served on this machine, then `node experiments/game/acceptance/check.mjs <address> --headed`, three times. A check passes when it passes all three; one that passes some is reported as unsteady, with all three results.

**They can pass and they can fail.** Before any game existed the checks were run against two stand-in pages: one that satisfies the test surface, and one that does not. All 21 pass against the first and all 21 fail against the second. Then each behavior was turned off alone, and the check that looks for it failed for its own reason. The outputs are in [`acceptance/proof/`](acceptance/proof/).

**The owner's ten minutes.** The lines of `LIST.md` only a person can judge. So that he does not know which build he is playing, a coin decides which is served as "A" and which as "B"; he plays both, writes what he found, and only then reads which was which. The key is in the record.

## 4. What is written down, and where

Decision 0015: a run is recorded before its result is used. Each run has a folder, `experiments/game/runs/<harness>/`, made before its clock starts, and a row in `experiments/game/ledger.json`.

| What | Where it comes from |
|---|---|
| The setup: grooph's commit, the checksums of the spec and of the package, the harness and its version, which model each tier meant, the machine's versions, whether Blender was there, the permissions as given, who ran first | written before the start gate is answered |
| The session's id, and where its transcript is on the machine, with a checksum | the harness; the transcript stays on the machine |
| The run folder: `notes.jsonl`, `PROGRESS.md`, the working copy of the graph with any amendment the lead made | `.grooph/arena/runs/<id>/` in the game repository, copied here |
| When each session and subagent started and stopped | grooph's event hook, installed in the game repository before the run; it records ids, names and times and nothing they say |
| What it cost | what the harness reports, and how it was read; an estimate is called one |
| Every commit with its time | `git log` of the game repository |
| Every interruption, pause and wall, with its time | the owner, as it happens |
| The checks' three outputs, the owner's notes, the key to A and B | after the run |

The two game repositories are public and hold the game, the package and the run folder. This repository holds the rest.

## 5. The models

Tiers are named in the graph; models are named at export and in the record, never in the graph or the spec.

- **Claude Code.** `grooph export --models` says which model each tier means. The lead, the planner and both critics are `frontier`; the builder and the wrap-up are `strong`. Never Fable. Which models these are is the owner's answer (section 9).
- **Codex.** GPT-6.1 Sol leads and judges (`frontier`); GPT-6 Luna builds (`strong`). Never Astra.

The two runs do not use the same models and cannot. That is one reason the result compares nothing (section 6).

## 6. What the result can say, and what it cannot

Written before the runs, so that the result cannot move it.

**It is two accounts of what happened once.** For each harness, one time: how far down the list of milestones the run got; what a player can do in the build, by the same 21 checks and by the same person's ten minutes; what it cost and how long each milestone took; how the run went (rounds, back edges, which stops fired, what the lead amended); and whether the brakes held for six hours with nobody there: whether anything was asked in the middle, whether the clock's stops fired, and whether what was left at the end plays.

That last part is the kind of thing grooph is already shown to do on small tasks (decision 0013: it bounds and records autonomous work and holds a design as a runtime contract). One six-hour run in each harness would be the first account of it at this size. It is an account, not a rate: one run cannot say how often.

**It is not a comparison of harnesses.** One run each, with different models, on different days. A difference between the two builds could be the harness, the model, the day, or luck, and one run cannot tell them apart. To compare harnesses would take at least three runs in each, in alternating order, with the measures named beforehand, scored blind, and either the same model in both or enough different tasks that one model's luck does not decide it.

**It is not evidence that a loop graph beats a prompt.** No session here is given a prompt in place of the graph. To be that evidence it would need the arms of [`docs/comparisons.md`](../../docs/comparisons.md) on this task in one harness: the package, the same design as prose, that prose in a loop, and the task alone, at least twice each. That is eight six-hour runs or more.

**It says nothing about** a larger game, a different kind of game, or whether six hours is the right size. And the checks play the test round of the spec's section 7: three chasers, one wave. What the full rounds are like is the owner's ten minutes and nothing else.

**What would count against the graph**, named now: a question asked in the middle; a session still building at the wall; a result commit that does not build or does not start; a builder that read the held-out checks; an asset in the repository that no script in it made. Any of these is reported in the first lines of the write-up.

**The sentence the result is reported with.** "Run once in each harness, from one spec and one graph, in six hours each: the Claude Code run reached milestone *n* and passes *x* of 21 held-out checks; the Codex run reached milestone *m* and passes *y*. This is what happened once, not a comparison of the two, and not evidence about graphs against prompts." A sentence about what grooph does to quality, cost, speed or safety goes through the audit first (decision 0024).

## 7. What must exist before it can run

1. **The Codex target** (slice 0076): `grooph export --target codex` writes a package from `arena.grooph.json`, and one template has been run from such a package.
2. **Two public repositories**, made by the owner, each holding the starting contents of section 2 and nothing else.
3. **The owner's yes**, with his answers to section 9.
4. **The machine made ready**: Playwright's Chromium installed, the event hook installed in each repository, each repository cloned outside grooph's clone, the record folders and the ledger made.
5. **A rehearsal, if he allows it** (section 9): the first twenty minutes of the graph in a scratch folder in each harness, to see that the package starts, that the critic can drive a browser, and that nothing asks for permission. A session that stops at minute three to ask whether it may run `npm install` spends six hours waiting.

## 8. The day

1. Write the setup into the run's folder. Check that the repository holds the starting contents and nothing else.
2. Open a session of the harness in the game repository's folder and paste the kickoff the export printed.
3. The session writes its halt note and asks at the start gate. Answer "start" within a minute. Write the time.
4. Leave it. Write down anything that happens: an interruption and its one-line answer, a pause, the wall.
5. At the end gate read `FINAL.md` and answer "close". If the wall came first, end the session and write that it did.
6. Copy the record (section 4). Find the result commit. Run the checks three times. Save the outputs.
7. After both runs: the owner's ten minutes on A and B, his notes, then the key.
8. Write up both runs with the sentence of section 6. Decide the extension, once, for both.

## 9. What the owner is asked to decide

| | The question | Proposed |
|---|---|---|
| 1 | **Which models the tiers mean in Claude Code.** | `frontier` = Opus 5.5 (lead, planner, both critics), `strong` = Sonnet 5.5 (builder, wrap-up): the same split as Sol and Luna in Codex. The other choice is Opus 5.5 for both, which builds with the stronger model and leaves the critic judging its own kind. |
| 2 | **How the sessions are paid for.** | Whichever way has no allowance to run out in six hours. If that is not possible, the pause rule of section 2 stands. |
| 3 | **Blender on the machine, or not.** | Not: it is one more thing to differ, and three.js geometry is enough for this game. |
| 4 | **A twenty-minute rehearsal in each harness first.** | Yes. It is two short model sessions, recorded like any other, and it is the cheapest way not to lose six hours to a permission prompt. |
| 5 | **The extension rule of section 2**: decided once for both, after both are scored. | Yes. |
| 6 | **The repositories' names**, and whether the run folder (notes and progress) is public with the game. | The run folder public: it is the record, and it holds nothing private. |
| 7 | **The dates.** | After slice 0076 has merged and one template has run in Codex. |
