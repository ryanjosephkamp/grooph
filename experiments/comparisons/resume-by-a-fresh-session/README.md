# A halted run picked up by a fresh session

**Pre-registered on 2026-10-05, before any run. Nothing here has been run.** This is the first step of study three's second question (`handoffs/briefs/study-three-on-paper.md`), and the measurement both sides of audit 0001 name (finding F11): every resume on record is the same harness session resumed and told its run id. A fresh session picking a run up from its folder by its id, with the first session's history out of reach, is what the package is written for and has never been recorded.

**Parked on 2026-10-05: not run.** The owner parked the experiments that day; his yes waits for him. The order when work resumes, and what each step may cost, is at the top of [the profile's page](../profile/README.md). Nothing here may be changed after the first paid call without a dated note saying what changed and why.

## What is run

- **The run it starts from** is kept in the repository: [`review-gate-2/A-1`](../review-gate-2/A-1/), study two's first package run, which halted at its human gate with the note "halted at human gate merge-gate". Its project is rebuilt from the record: the task, the kept change, the package as it was compiled, and the run folder with its thirteen notes.
- **A fresh session** is started in that folder from the comparison profile ([`../profile/`](../profile/)). The profile's own history holds nothing of the first session, which ran under the account's usual folder; and from the profile a session cannot read outside its own folder.
- **What it is told** is the package's kickoff, as kept, and one sentence after it: "You are given a run id to resume: `20261004-211444`. Answer at the gate `merge-gate` of run `20261004-211444`: approve. Continue that run from where it halted." The second half is the proving ground's own resume sentence. The first half is the lead brief's own words for this case.
- **The answer at the gate is scripted, and labeled so.** Study two allowed no scripted answer. Here the answer is the test's input: there is no other way to see what a lead does after a gate is answered with nobody there.
- **The lead** is `claude-opus-5-5` at effort `high`. No node of the graph should run at all.

## What counts as resumed

All seven, read by the runner from the folder and the transcripts after the session, never from the session's reply.

1. The session ended itself.
2. There is still one run folder, the one it was given. It did not start a second run.
3. The notes it was given are the first lines of the notes it left, byte for byte, and there is at least one line after them. Appended, never rewritten.
4. No subagent was dispatched. Nothing was built or reviewed again.
5. A new note stands at the gate, or on its approval edge: the human's decision, as the brief asks.
6. A new note says the run is ending, and the last note is the graph's: the brief's ending, in its two lines.
7. The graph's source document is unchanged, and so is every file of the project outside the run folder.

**Not resumed:** any of the seven fails. Each failure is named. **Invalid, which is neither:** the harness or the account ended the run; it is recorded, the driver is told, and it is made again once on the driver's word, as in the brake experiment.

## What it can show, and what it cannot

**It can show** that a fresh session, given a run id and a gate's answer, continued one halted run from its folder without redoing it. Once.

**It cannot show** how often; that a run stopped anywhere but at a gate can be picked up (a gate's halt note says exactly where the run stands, which is the easiest place there is); that a session stopped without warning leaves a record a fresh one can use; or anything about the same design as prose, which keeps no record to resume from. Those are the second step of the question, and are not approved.

## What it costs

A lead that reads its brief, the progress file and the notes, writes three or four lines and replies: by study two's count of what a package lead costs before its first dispatch, about fifty cents. If it wrongly builds and reviews again, about a dollar more. Its watchdog is $2.00 and ten minutes, and is not a brake of the graph.

## How it is run

```bash
node scripts/lib/resume-step-paid.mjs --dry-run
node scripts/lib/resume-step-paid.mjs --spend --go "<the driver's words>"
```

Started from a terminal. It is refused unless the first paid call's latest record says the runs after it may be made ([`../profile/first-call/`](../profile/first-call/)). The record goes to `record/` beside this page.
