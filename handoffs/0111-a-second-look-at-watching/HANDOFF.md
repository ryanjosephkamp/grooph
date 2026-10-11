# Handoff 0111 · A second look at watching, on work that calls for subagents

**Stage:** 25 · **Lane:** Opus 5.5 · **Effort:** extra high through the protocol and the tasks, then high for the runner (high is the floor: a check whose tasks again call for no subagent is paid for and says nothing) · **Browser tests on port:** none · **Branch:** `slice/0111-a-second-look-at-watching` · **Drafted:** 2026-10-11 · **Confirmed by owner:** 2026-10-11, on the review desk (card q86: one of the first four lanes; card q91, on scoring: "Yes, as for the first check"). Each block of runs is still his to start from a terminal

## Objective

The watching check ([`experiments/watching/`](../../experiments/watching/README.md), run on 2026-10-10) asked whether installing the recorder changes what a session does. Thirty-five of its thirty-six sessions used no subagent, so it says little about sessions that delegate, "which is what the product is for" ([`RESULTS.md`](../../experiments/watching/RESULTS.md)). It also found that a session can see a recorder installed inside its project, and did not try the remedy.

This slice prepares the second look and runs nothing: a protocol written before any run, tasks on which a session does start subagents, the arm the first check lacked (the recorder installed outside the project, slice 0108), the runner extended to them, and one command per block for the owner to paste. The owner wants the runs made before his weekly allowance resets on **Monday 2026-10-12 at 11:00 a.m. Eastern**, so the preparation has to be merged, and the outside install with it, by early that morning. If it is not, the protocol says which blocks are still worth running and which wait.

The questions, in order of weight: on work that is delegated, does a watched session behave differently from a plain one; is the hook's record true when there are many subagents (starts, stops, parents, types, against the harness's own files); and does a session notice a recorder that is installed outside its project.

## Success criteria

1. **`experiments/watching/second-look/README.md`**, the protocol, complete before any run and saying so: what is asked, the arms, the tasks, the models, what is measured and from which file, how it will be read (the first check's rule: "no difference seen" only where two arms overlap on both tasks within a block; never "no effect"), the limits, and what has to hold before the first run. It says in so many words what it cannot show with two runs an arm.
2. **Tasks on which a session delegates.** Two, each with a hidden suite as before, each wide enough that doing its parts side by side is the plain way to do it. The first check allowed subagents, said nothing more, and saw one session in thirty-six use them. So here **the task itself asks, in the same words in every arm**: use subagents for the parts that can be done side by side, and nothing about how many, which kind or in what order. That is a person's request, as the product is for a person who made one; it is the same in the plain arm, so no arm differs by it. Why each task should bring a session to delegate is argued in the protocol from the first check's records and from this project's own sessions ([`../0104-the-live-graph/RECORDS.md`](../0104-the-live-graph/RECORDS.md) §3), not from a trial run.
3. **Arms**: plain; watched, with the recorder in the project as 0.4.1 installs it; watched from outside the project, as slice 0108 installs it. The invitation to state a plan is left out: what the server hands a session does not reach it ([`RESULTS.md`](../../experiments/watching/RESULTS.md), question 2), and that is slice 0105's to repair first.
4. **The record's truth is measured, not assumed**: for every watched run the runner compares the hook's file with the harness's own files, agent by agent (start, each stop, parent, type), and writes each difference by kind into the run's result. A subagent whose run failed, and a foreground child whose parent is known only at its end, are expected and named ([`RECORDS.md`](../0104-the-live-graph/RECORDS.md) §2).
5. **Whether the recorder was noticed is measured as before** (calls that name its files, results that show them, the final reply), and for the outside arm also any call that reads under the user-level folders where it now lives.
6. **A ledger of its own** (`experiments/watching/second-look/ledger.json`), and in it the gate the first check had: the runner starts nothing until the owner's decision on scoring, outside the sandbox, code that a session wrote is recorded there for this check by name. The first check's decision is not read for this one. He answered on 2026-10-11 (card q91: "Yes, as for the first check"); the driver writes his decision into the ledger once you have made it, so leave the field empty and the test line that holds it marked, as the first check did.
7. **The runner** (`scripts/lib/watching-check-paid.mjs`, extended, or a file beside it) with the first check's safeguards intact: the clean profile, a dollar ceiling a run and a cap for the whole, a record folder and a ledger row before each session starts, `--status`, `--dry-run`, one `--rerun` for a run the harness ended, and `--spend --go "<the driver's words>"` before anything is paid. Its tests run against the stand-in harness and call no model.
8. **Blocks sized to be read**: one model a block, the owner starts each from a terminal with one command, and the driver reads every record of a block before the next. A proposal for models, ceilings and the cap, with what the whole would cost by list price if every run reached its ceiling, and the hours it takes.
9. `tables.mjs --check` for the second look, so that the results page's tables are made from the records. New tests go where CI already runs them (the step that names `watching-check-paid.test.mjs`); if a new test file needs naming there, that one line is the driver's to add, since slice 0103 has the workflow file.

## Read first

1. `handoffs/0111-a-second-look-at-watching/HANDOFF.md` (this file)
2. `experiments/watching/README.md` and `RESULTS.md`, whole, and one run's record folder (`experiments/watching/haiku/four/invited-1/`)
3. `scripts/lib/watching-check-paid.mjs` and its test; `scripts/lib/compare-profile.mjs`
4. `handoffs/0108-the-recorder-outside-the-project/HANDOFF.md` and the page it names: the arm you depend on, being built beside you
5. `handoffs/0104-the-live-graph/RECORDS.md` §1 and §2
6. `spec/contract.md` ("What may be claimed"), decisions 0015, 0024 and 0031, `AGENTS.md`, `handoffs/README.md`

## Allowed changes

`experiments/watching/second-look/**`; `scripts/lib/watching-check-paid.mjs` and its test, or new files beside them; `experiments/watching/tables.mjs` or a second one; `handoffs/0111-a-second-look-at-watching/**`.

## Forbidden changes

- **Starting a model session.** Not one, not a small one to see whether a task works. Every run is the owner's to start, from a terminal, on his word for that block.
- The first check's protocol, records, ledger and results (`experiments/watching/README.md`, `RESULTS.md`, `sonnet/`, `opus/`, `haiku/`, `ledger.json`): they are a finished record.
- `packages/**` (the recorder is slice 0108's; if the runner needs something from it, ask its lane through the driver), `apps/**`, the lab's runners other than by importing them as the first check does.
- Fable or Astra in any block. A claim, anywhere, about what watching does or does not do.
- `docs/PROGRESS.md`, `docs/PLAN.md`, `handoffs/DRIVER.md`. A pushed branch rewritten. A merge.

## Spec constraints that apply here

- Decision 0015: a run is recorded before its result is used.
- Decision 0024 and `spec/contract.md`: "That the record is true, and that watching does not interfere. Each is checked against a harness's own files before it is said."
- Decision 0031: no Fable. Opus 5.5 and Sonnet 5.5 are the blocks to plan for. Haiku only if the protocol gives a reason, and then by its full model name: in the first check the short name was answered by Haiku 4.5 ([`RESULTS.md`](../../experiments/watching/RESULTS.md), "What this cannot say").
- Decision 0032 left open "Whether any larger experiment is run", with the owner's word then that none would be before 2026-10-12 but the watching check. This is that check's second look, and he asked on 2026-10-11 for tests of our own to be run in Claude Code before the reset.

## Design already decided

- It is a second look under the first check's rules of reading, so that the two can be set side by side.
- The runs use the owner's subscription from the clean profile, as before; nothing is billed by key.
- If slice 0108 is not merged when the blocks are due, the plain and in-project arms may run without the outside arm, and the protocol says beforehand what is then left unanswered.

## Implementer's choices

The two tasks; how many runs an arm; which models; the ceilings and the cap; how a watched-from-outside session is given its user-level install inside the clean profile without touching the owner's real settings.

## How to verify

```bash
node --test scripts/lib/watching-check-paid.test.mjs <and any new test file>
node scripts/lib/watching-check-paid.mjs --status            # or the new runner: nothing run, what it would run
node <the runner> --all --block <a block> --dry-run
node experiments/watching/tables.mjs --check
node scripts/american-english.mjs --check
```

## Handback must contain

The `TEMPLATE-HANDBACK.md` sections, plus: the exact command for each block; the cost at the ceilings; why each task should bring a session to delegate, and what would show the bet was wrong after one block; what the protocol cannot answer; and anything the first check's records taught you that its results page does not say.

## Prompt to paste

```text
You are a lane of grooph: slice 0111, a second look at watching, on work that calls for subagents. Read handoffs/0111-a-second-look-at-watching/HANDOFF.md first, then experiments/watching/README.md and RESULTS.md whole, then AGENTS.md and the files the handoff names. Work in your own worktree on branch slice/0111-a-second-look-at-watching, a draft pull request at the first push. No browser tests. You start no model session of any kind: every run is the owner's to start. The runs are wanted before Monday 2026-10-12 at 11:00 a.m. Eastern, so send the driver the protocol's draft as soon as it can be read, before the runner is built. Do not edit docs/PROGRESS.md, docs/PLAN.md or handoffs/DRIVER.md, and merge nothing. Have a fresh reader read the protocol and the runner; then send the driver the head with SendMessage and push nothing more to it. Finish with the grooph-handback skill.
```
