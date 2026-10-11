# Handback 0111 · A second look at watching, on work that calls for subagents

**Implementer:** Opus 5.5 (lane 0111) · **Branch:** `slice/0111-a-second-look-at-watching` · **Pull request:** [#192](https://github.com/ryanjosephkamp/grooph/pull/192) · **Head commit:** the commit that adds this file, sent to the driver by message; the one before it is `8573bc88` · **Date:** 2026-10-11

## Status

`done`. The protocol, the two tasks, the three arms, the runner, its ledger and its tables are on the branch. **Nothing has been run: no model session was started, by me, by a reader or by any test.** Three things stand between this and the first run, none of them mine: the pull request merged; the owner's decision on scoring written into the new ledger by the driver; and, for the `outside` arm only, slice 0108 merged and built.

## What changed

**The protocol** (`new`)

- `experiments/watching/second-look/README.md`: what is asked, three arms, two tasks, three rounds in two blocks, what is measured and from which file, the rule of reading, what it cannot show, the limits with the owner's yes to them, what has to hold before the first run, and the commands.

**The runner** (all `new`, beside the first check's, which is not changed)

- `scripts/lib/watching-second-look-paid.mjs`: the order, the ledger's gates, the three arms, the launcher of the `outside` arm and its rehearsal, one run, a block, `--status`, `--dry-run`, `--rerun`, `--score`, `--settle`, `--not-obtained`.
- `scripts/lib/watching-second-look-measures.mjs`: what is read from the harness's files beyond the first check's measures: the delegation, what was noticed outside the project, and the hook's file set beside the harness's files agent by agent.
- `scripts/lib/watching-second-look-paid.test.mjs`: 32 tests against the stand-in harness. No model is called.
- `experiments/watching/second-look/ledger.json`: the cap, the four ceilings, no line, and `scoring_outside_the_sandbox` with its three fields empty.
- `experiments/watching/second-look/tables.mjs`: the results page's tables from the records, **and the rule of reading applied by the script**, with `--check`.

**Two small changes to files of the first check's, both allowed by the handoff**

- `scripts/lib/watching-check-paid.test.mjs`: three lines at the end bring in the new test file, so the step of CI that names this file runs both. **No line of the workflow has to change.** If the driver would rather name the new file in `ci.yml`, these three lines should go, or the new tests run twice.
- `experiments/watching/tables.mjs`: five lines, so that its `--check` (which CI already runs) also checks the second look's tables.

**Kept for the next reader**, under `handoffs/0111-a-second-look-at-watching/`

- `real-records.mjs`: the agent-by-agent comparison run over real records on this Mac (ids and counts only).
- `reader-protocol/` and `reader-runner/`: the two fresh readers' scripts. `reader-protocol/07-chances.mjs` is cited by the protocol.

## The exact command for each block

Each from a terminal, by the owner, in the one built checkout the driver makes for the runs. The words after `--go` are the driver's for that block.

```bash
# before anything: where things stand, and what would be started (neither starts a session)
node scripts/lib/watching-second-look-paid.mjs --status
node scripts/lib/watching-second-look-paid.mjs --all --block opus --dry-run

# block one
node scripts/lib/watching-second-look-paid.mjs --all --block opus --spend --go "<the driver's words for the opus block>"

# block two, after the driver has read the first block's records
node scripts/lib/watching-second-look-paid.mjs --all --block sonnet --spend --go "<the driver's words for the sonnet block>"
```

- If slice 0108 is not merged: add `--without-outside`. The block's twelve `plain` and `watched` runs are made and its six `outside` runs are left.
- To stop a block at the end of a round: add `--through-round 2` (or `1`).
- The runner stops by itself whenever a record says something went wrong, and says what. The same command goes on from where it stopped.
- **Nothing is pulled or rebuilt in that checkout between the first run and the last.** The runner refuses a run made with another hook's file, another build of the tool or another runner than a run already recorded, unless `--another-checkout` says so by name. It compares checksums, not the commit's name: committing a block's records changes nothing.
- **Ctrl-C** ends the session that is running; the runner then keeps that run's record and stops. The run reads as one the harness ended and may be made once more: `--rerun <block>/<task>/<arm>-<n>`.
- A run that was started twice and recorded neither time (the runner killed outright, both times): `--not-obtained <run> --note "<what happened>"`, so that its block can go on.

## The cost at the ceilings, and the hours

| | A run of `four` | A run of `six` | The block at its ceilings | The block at its minute limits |
|---|---|---|---|---|
| `opus` | $15.00, 60 minutes | $15.00, 60 minutes | $270.00 | 18 hours |
| `sonnet` | $6.00, 60 minutes | $6.00, 60 minutes | $108.00 | 18 hours |

**$378.00 for the thirty-six runs at their ceilings**, by list price, under a cap of $200.00 on the look's own ledger; thirty-six hours at the minute limits. Neither is an expectation. My guess at what it really costs is about $60 for `opus` and $25 for `sonnet`, from the first check's records (a run of `four` done alone cost $1.12 to $1.50 on Opus and $0.47 to $0.64 on Sonnet; I doubled that for delegating and took `six` at one and a half times `four`). One to two and a half hours a block is also a guess; nobody knows until the first runs are in.

**The owner approved these on 2026-10-11 at 3:15 p.m. Eastern** (card q95, as the driver relayed it: "Yes: 36 runs and the limits as proposed", the card then holding this table). They are one dollar figure for both tasks of a block, because the harness tells a session its ceiling, and the first check's own figures for `four`. The page says so where it gives the limits. Should they ever change, they are one table and its test: `WATCHDOG` and `STOPS_AT_USD` in `scripts/lib/watching-second-look-paid.mjs`, and the two lines under "THE LIMITS" in its test. The same test then fails until `ledger.json` (the four ceilings, the cap, `refuse_below_usd`, `per_invocation_ceiling_usd` and the sentence `cap_is`) and the page's table and sums under "Limits" say the same, and names each one that does not.

## Why each task should bring a session to delegate, and what would show the bet was wrong

It is a bet, argued from records and not from a trial run.

- **The sentence asks.** Every prompt ends "Use subagents for the parts of this that can be done side by side." The first check said "You may", and one session in thirty-six did.
- **`four`** is the first check's wide task to the letter up to that sentence. There, Sonnet and Opus did the four packages alone twelve times of twelve, in three to six minutes. The one session that split it started one `general-purpose` subagent a package, in the background. So where a model splits this task it splits it by package.
- **`six`** is those four with `printkit` and `textkit`, worded the same way. It is the widest task the repository can make without a reference no session is given.
- **This project's own sessions** (`RECORDS.md` §1 and §3): 134 of 137 subagents at depth one, 127 `general-purpose`, 133 in the background. That is the shape expected here.

**Wrong after one block if** fewer than five in six of its sessions start any subagent (fifteen of eighteen), or if on either task some arm has no run that does. `--status` makes that test of whatever part of the block has a record, and says so in capitals when it fails.

## Verified, and how

Run from cold on 2026-10-11 at `8573bc88`, on this Mac. No command below starts a model session.

| | Criterion | Command | Observed |
|---|---|---|---|
| 1 | The protocol, complete before any run, saying what it cannot show with two runs an arm | `node --test scripts/lib/watching-second-look-paid.test.mjs` | 32 pass, 0 fail (57 with the first check's own 25, in the one file CI names). The tests hold the page to the runner: the sentence, the two models, the limits and their sums, the tasks and their packages, both tables of rounds, the five measures. The page's status line reads "nothing has been run". "With two runs an arm" is under "What this cannot show", and the counting under "Why three rounds and not two". |
| 2 | Two tasks, each with a hidden suite, the same request in every arm | the same file, and `node scripts/lib/watching-second-look-paid.mjs --all --block opus --dry-run` | The prompt is one text for the three arms of a task; `four` is the first check's wide prompt up to the closing sentence; the six suites hold 55, 88, 73, 62, 70 and 41 cases against the repository's own task folders. The dry run prints eighteen runs for each block (`--block sonnet` too, its first `sonnet/four/watched-1`), each ending "nothing was started.", and leaves `~/grooph-compare/work` empty and no folder of grooph's under the profile's home. |
| 3 | Three arms; the invitation left out | the same file | `plain` and `outside` folders are the task's packages byte for byte; `watched` adds the three files `grooph hooks install` leaves; no arm attaches a server. Each arm run whole against the stand-in. |
| 4 | The record's truth, agent by agent, each difference by kind | the same file, and `node handoffs/0111-a-second-look-at-watching/real-records.mjs` | A made-up session of sixteen subagents gives every kind by name, and the three expected things apart. Over real records: the first check's run with subagents, 4 subagents and 0 differences; this project's own sessions, 144 subagents, with the differences `RECORDS.md` §2 counted by hand (the two from before the hook was installed, which have no start, stop or parent line) and its expected things (one failed run, four foreground children's late parents), and three subagents still running in sessions open as it ran. |
| 5 | Whether the recorder was noticed, and for the outside arm the user-level folders | the same file | Counts of calls naming and results showing each place, refusals, the final reply; ways of looking counted by what they name. A result of an `outside` session that shows a place stops that arm. |
| 6 | A ledger of its own, with the gate | `node scripts/lib/watching-second-look-paid.mjs --status` | "scoring outside the sandbox: no decision of the owner's is recorded for this look, so no run starts and none is scored". `$0.00 counted of $200.00, in 0 line(s)`. The test line that holds the three empty fields is marked "THE OWNER'S DECISION". |
| 7 | The runner, with the first check's safeguards | the same file; `--status`; `--dry-run` | Refusals before anything is made or opened: no first call, no decision, no block, no `--spend`/`--go`, no room, out of order, another hook or tool. A session is started by the lab's own `runSession`, unchanged. One `--rerun`. Every paid path was read and driven with the stand-in; **none was run with `--spend` from the command line.** |
| 8 | Blocks sized to be read, one command each, with the cost and the hours | this page, above | Eighteen runs a block, two blocks; $378.00 at the ceilings, thirty-six hours at the minute limits; `--status` lists each run with its ending, subagents and score. |
| 9 | `tables.mjs --check`, in CI's own step | `node experiments/watching/tables.mjs --check` | "watching tables: RESULTS.md holds the tables its records make" and "second look's tables: nothing has been run, and there is no results page". |

Also:

- `node --test scripts/lib/brake-count.test.mjs scripts/lib/brake-run.test.mjs scripts/lib/compare-arms-ef.test.mjs scripts/lib/compare-profile.test.mjs scripts/lib/study-three-paid.test.mjs scripts/lib/watching-check-paid.test.mjs` (the whole step of CI): 136 pass, 0 fail, run at `f56fbf20`. Its last file, which brings in this slice's tests, run again at `8573bc88`: 57 pass, 0 fail, 0 skipped; and the same with a temporary folder whose path holds the word "grooph".
- `node scripts/lib/watching-check-paid.mjs --status`: the first check as it was, "next: none; every run is recorded". Its page, records, ledger, results and runner are untouched.
- `node scripts/american-english.mjs --check`: "nothing British in 809 public-facing files". (`--all`, which also reads `experiments/` and `handoffs/`, finds nothing in this slice's files.)
- CI on the pull request: every job green at `12a177fa` (build on Node 22 and on 24, web-e2e, web-browsers), which was the head when the runner's reader finished. One earlier push, `fa4ea32a`, failed build (24): a test of mine looked once for a killed process that Linux had not yet collected (fixed in `476af79e`). The run for the head that carries this file is named in the message that reports the head. `main` moved fifteen commits while this was written (the lab's first pull request among them) and the branch merges with it cleanly; I did not merge it in.
- The whole `outside` path with slice 0108's working copy as the tool and the stand-in as the harness, in scratch folders: seven entries in the settings the stand-in found, the tool's own home empty, the profile's settings as they should be three times, the owner's files as they were, the launcher 0.92 seconds before the harness on a busy machine. `~/.grooph` does not exist on this Mac, before or after.

**Two fresh readers**, each a subagent with no part in the work, read the protocol and the runner and were asked to find what was wrong. Their reports are summarized in "Decisions made" where they changed something, and their scripts are kept. The protocol's reader made fourteen findings; the runner's reader fifteen, two of them serious (a paid session settled at $0, and an install able to reach the owner's own folders through a tool that ignored where it was told to write). All but what is listed under "Risks and leftovers" is fixed, each with a test.

## Decisions made

1. **Three rounds an arm, not two, with the arms changing places.** With two runs an arm, two arms that do not differ fail to overlap on a task one time in three by chance, so the first check's rule calls a "difference" that often. With three it is one in ten. And in the first check the plain arm always went first, and a run's place in the order was not free (below).
2. **The second block's rounds are the first's in a mirror.** The driver asked for the `sonnet` block to start from round 2 (rounds 2, 3, 1), so that a block's first run is not `four` plain in both. The protocol's reader showed that with the `outside` arm left out, that order still puts plain first in two rounds of three in both blocks. The mirror keeps what the driver asked for (the `sonnet` block's first run is `four` watched), and also: between them the two blocks hold all six orders of the three arms, and without the `outside` arm the two that remain alternate, the other way about in each block. **This departs from the driver's letter; see Deviations.**
3. **`opus` first.** If the clock allows one block, it should be the model the owner's sessions run on.
4. **No new hidden suite.** Both tasks are made of tasks the repository holds, unchanged. A new task written today would have been an untested instrument.
5. **A new runner beside the first, not the first one extended.** The first check's runner is its protocol in code and is finished. The new one imports everything of it that is not bound to its constants, and all of the lab's gates, so the safeguards are the same code.
6. **The `outside` arm is installed by a launcher.** The lab's `runSession` writes the profile's settings itself just before it starts the harness, so an install made earlier is written over, and those two lab files are closed to me. The runner hands it a small shell script as the program for the session. It holds the five things the driver asked of it, each with a test against the stand-in harness:
   - it is the program started for the session and for nothing else: the profile's check is handed the harness itself, and the launcher answers no other call (it exits 64);
   - it becomes the harness by a real `exec`: a test reads the harness's process id and process group and finds them equal, and another has the watchdog end the group and finds the harness and its child gone;
   - the harness gets the arguments and the environment `runSession` made, to the letter: a test compares them with the plain arm's, and no variable of grooph's is among them;
   - if the install or the listing fails, no session starts and the run is no result: what happened is kept in `<run>-not-started`, the ledger line is settled at $0 under another name, the run keeps no record of its own, and the block stops for a person;
   - the hook's file and the run's events are outside the session's folder and are copied into the record as the watched arm's are.
7. **The launcher's own files are kept with grooph's folder for the run, not beside the session's folder.** The reader pointed out that the folder directly above the session's would otherwise hold, in this arm alone, a script that spells out the install. Now that folder holds the same things in every arm.
8. **The install is rehearsed before anything is spent.** In a scratch folder, with no session: the two commands, what they left, and the hook fired by hand for a listed folder and for one that is not. A checkout that cannot do it refuses the `outside` arm and says to start the block with `--without-outside`.
9. **A session that was not watched stops the block, and is no run of its arm.** If a `watched` or `outside` session leaves no file of the hook's, its record is kept, marked, left out of its arm's values, and the runs after it wait for a person. This is stricter than the first check's runner.
10. **A result of an `outside` session that shows a place the recorder is kept in stops the runs of that arm.** The arm supposes a session of the clean profile cannot read there; no call has tried it.
11. **The rule of reading is applied by `tables.mjs`**, with equal values, rounding, an arm short of a run and which count of subagents all settled in the page and in code. The reader found six places where the rule as first written needed a judgment call.
12. **One reading added, said beforehand: "seen in both blocks"**, with five measures named as the ones the rule is applied to, and with the page saying what fifteen readings a block do to each reading.
13. **The rule for what holds the second block up is by round**: the block before it needs one whole round and no round begun and unfinished, and its `outside` runs do not count.
14. **One hook, one built tool and one runner for both blocks, compared by checksum.** The driver asked for a refusal when the commit or the hook's checksum differs from the block before. The runner's reader showed the commit's name is both too strict (committing the first block's records moves it) and too loose (a checkout with forty-one changed files and another build has the same commit). So the record keeps the commit, and what is compared is a checksum of the hook's file, of the built tool and of the runner. **This too departs from the driver's letter; see Deviations.**
15. **A session that ran is never recorded as "not started".** The first version read "not started" from the launcher's marker file alone, and the reader had three paid stand-in sessions settled at $0 by moving a folder. Now that reading is taken only when nothing shows a session: no result, no reported cost and no transcript.
16. **The tool that installs is given a home of its own, which has to stay empty**, in the rehearsal and in the launcher, and the guard on the owner's folders goes by which folder a path really is. The reader showed a tool that ignored the three variables writing in a stand-in owner's `~/.claude` and `~/.grooph`, and the guard passing a link to his home, another casing, and another name for the same volume.
17. **A signal does not end the runner while a run's record is being kept**, and a first copy of the result is written before scoring. The reader showed Ctrl-C after a session had ended discarding a finished, paid run.
18. **A run the harness ended holds the next block up until it has been run once more**, and a round with one `outside` run needs its other. The first version let four runs "ended by the harness" count as a whole round.
19. **How a subagent's run ended is read only from the harness's own words.** The reader got a subagent's last words into the record through a `<status>` tag inside the notice's text. Now the status is the one before any summary or result, and only a word from the harness's own list is kept.
20. **The count of what was noticed is of names, and says so.** It reads what a call asked as it was asked, counts more ways of looking, and the page says a look that names nothing (a search of the disk, a list of processes) is not in it.
21. **A recorded decision on scoring that begins as a no is read as a no.** The lab's gate asks only that three fields hold words.

## Deviations

1. **The `sonnet` block's order is not the driver's rounds 2, 3, 1.** It is the mirror of the `opus` block's (Decision 2). The driver agreed by message on 2026-10-11 ("take the mirror square"), before any run.
1a. **The one-checkout rule compares checksums and not the commit** (Decision 14). The driver asked for "commit or hook checksum". **The driver has not been asked about this one**: it came from the runner's reader after the driver's last message. It is stricter where it matters (another build of the tool, another runner) and does not trip when the first block's records are committed.
2. **The limits are not the ones I first proposed.** I proposed $12.00 and $18.00 on Opus, $5.00 and $8.00 on Sonnet, 40 and 60 minutes. After the reader's finding that a session is told its ceiling, the driver said yes to one figure a block (above).
3. **A third rule of reading beyond the first check's**, "seen in both blocks", and the rule's terms made exact. The handoff asks for the first check's rule; this keeps it and adds to it, said before any run.
4. **Two files of the first check's are touched**, both in the handoff's allowed list: three lines at the end of `scripts/lib/watching-check-paid.test.mjs`, five in `experiments/watching/tables.mjs`. Nothing else of the first check's is changed: not its page, its records, its ledger, its results or its runner.
5. **I read records outside the repository, read-only**: this project's own session transcripts under `~/.claude/projects/` and the first check's transcripts in the clean profile, to see that the agent-by-agent comparison reads the harness's files as they really are (`real-records.mjs`). It prints ids and counts only. The protocol's reader also read harness-written entries in five first-check transcripts. Nothing a session read, wrote or said was printed or kept.
6. **The readers and I used slice 0108's working copy as a tool**, read-only, with every place pointed at a scratch folder, to try the `outside` arm's whole path before that slice is merged. Nothing was written in its worktree.

## What the protocol cannot answer

- **Whether a session that can read `~/.grooph` would notice a recorder there.** The clean profile is meant to block every read outside the session's folder. So the `outside` arm can show whether anything else gives the recorder away and can count attempts to look; it cannot show what a session free to look would find. That needs a profile that lets a session read a stand-in home, which the driver has said is not for this look.
- **Whether the clean profile's walls hold with the recorder's entries added.** The first call tried two reads (`/tmp`, and the folder two above the session's) and neither of the places that matter here. The runner watches for a result that shows one, and stops.
- Anything small, anything about why, and that there is "no effect". "No difference seen" is the easy result: by the reader's simulation it would be said of a block about half the time if an arm really moved a measure by one standard deviation of its own runs.
- If only the `opus` block is run, nothing can be "seen in both blocks", and no reading carries weight.
- Delegation a session chooses unasked, and work too big for one session: here a person asked, and the work is small.
- A parent other than the session, a type other than `general-purpose`, a foreground child, a failed run, a resumed subagent: both tasks are flat, and the profile refuses the tool that resumes one. Each is counted if it happens.
- What a session would do with no budget in front of it (next section, 1).
- Another harness, another version, a session a person types into, a run of hours.

## What the first check's records taught me that its results page does not say

1. **The harness tells every session its dollar ceiling, in a reminder with each of the model's messages.** Every one of the thirty-six records counts those reminders (`measures.given.entries_of_what_it_was_given.budget_usd`, 4 to 58 a run), and in all thirty-six the count equals the count of the model's own messages (`measures.session.messages`). In the one transcript opened for it, `sonnet/one/plain-1`, a reminder reads "USD budget: $0.090342/$2; $1.909658 remaining". The first check's page says "no session is told of them". The figure differed by task and by block there, so it was part of what a session of each task was given. (Found by the protocol's reader; the count against messages is the driver's, and I checked it.)
2. **The plain arm always went first, and a run's place in the order was not free.** On Sonnet the first run of the block wrote 29,087 tokens to the cache against 10,721 to 12,785 for the five after it, and cost $0.20 against $0.11 to $0.14; on Haiku 32,932 against 14,180 to 19,536. On Opus the six narrow runs cost less one after another, from $0.35 to $0.21. The page sets the arms' costs side by side without this.
3. **"Turns" are the session's own.** The one run that delegated reports 5 turns for work its subagents did in 63 messages, so turns cannot be compared between a run that delegated and one that did not.
4. **The harness counts subagents itself**: `subagent_stats` in its printed result (`spawned`, `completed`, `failed`, `killed`, `refused` for depth, concurrency or budget). The second look sets that count beside the transcripts'.
5. **A headless session stays up after its first turn while background subagents run**, and is woken once for each that finishes: the hook's file has a turn's start and end after every stop.
6. **`csvline` passes 38 of its 73 unseen cases with no work done.** The other packages pass none. A score there starts at 38.
7. **Two of the scores hardly move.** Opus passed 274 of the 278 unseen tests of `four` six times of six, and `printkit` scored 52 of 70 in eleven of twelve runs on Sonnet and Opus. "No difference seen" on a measure that does not move says nothing.
8. **The first check's count of "stops" takes a stop line with no type for a stop.** It did not matter in its one run with subagents, which had none. In this project's own sessions there are 611 such lines, the harness's own helpers. The second look's comparison counts them apart.
9. **The first call tried fewer walls than its record's words suggest.** Its finding reads "could not list the folder above its own"; the command was `ls ../..`, the folder two above.
10. **The first check's test of a dry run failed wherever the temporary folder's path held the word "grooph"** (the driver passed this on from lane 0103's readers). Its last pattern matched the test's own folder. Fixed here in that file, which is in this slice's allowed list; both test files pass with such a folder.

## Risks and leftovers

**Not checked by anyone, because it takes a session:**

1. **Whether the real harness, headless in the clean profile, runs a hook from the profile's user-level settings.** The `outside` arm rests on it. The first check showed only that a hook in the project's settings runs. The first `outside` run will tell: if the hook leaves no file, the runner marks the run "not watched" and stops. The cost of finding out is that one run.
2. **Whether a session of the clean profile can read beside or above its folder.** The first call tried `/tmp` and the folder two above. If a result of an `outside` session shows a place the recorder is kept in, the runner stops that arm.
3. **The launcher in front of the real harness.** With stand-ins it holds what the driver asked (a real `exec`, the group kill, the arguments and environment to the letter). The real harness is a compiled program and was not started by it.

**Known limits of what is built:**

4. The rehearsal's passing branch, against this checkout's own tool, asserts nothing until slice 0108 is merged: today that tool refuses `--user`. I ran the rehearsal and the whole `outside` path against 0108's working copy (commit `e14f5b16` and its uncommitted changes at the time), in scratch folders: seven entries, the tool's home left empty, the settings as they should be three times, the owner's files as they were. **When 0108 is merged, run the tests again**: the test of this checkout's own tool then asserts the pass.
5. If slice 0108 changes what an install in a project leaves (its handoff says it does not), the `watched` arm refuses with the list of files it found: the first check's `installHook` holds an install to its three files.
6. The balance of the order is of three whole rounds with three arms. Two rounds, or a block without the `outside` arm, have less; the page says what.
7. The count of what was noticed is of names. `textkit`'s own checklist names `.grooph/`, so in `six` the plain arm's count is not zero by construction.
8. The stated chances (one in ten, one in five, one in a hundred) suppose values that do not tie and runs that can change places freely. The reader's simulation is the evidence for the rest.
9. Reading a "no" in the scoring decision is a test of its first word. A yes that begins "Not a problem" would be refused, and is then rewritten.
10. A `-not-started` record's ledger line is renamed and settled at $0 by this runner. That is the one place it changes a ledger line after the lab's code has settled it.
11. The new tests add about a minute and a half to the step of CI that runs the lab's tests. One of them (the watchdog ending the launcher's process group) waits six seconds by design; on this Mac at a load of 100 the file took five minutes once and passed.
12. `reader-runner/` holds scripts written against earlier commits of the branch. `run-all.sh <commit>` pins the commit it reads. Run against the final code (`sh run-all.sh f56fbf20`), what they still print as shown is accounted for: `a2` (the launcher's quoting) stops at a check the launcher did not have when it was written, since its stand-in tool leaves no hook, and the quoting is now tried end to end in this slice's own test, under a folder whose name a shell would trip on; `d1`, `e1` and `f1` call the measures and read the tables as they were (no session id, no profile home, the older sentence under a table, no `--not-obtained`), and each case is covered by a test here; and the last is the task's own file that names `.grooph/`, which is on the page.

**For the driver:**

13. Write the owner's decision of card q91 into `experiments/watching/second-look/ledger.json` (`scoring_outside_the_sandbox`: `decided_by`, `on`, `words`), and change the marked line in the test ("THE OWNER'S DECISION", which now holds three nulls). Begin the words as a yes.
14. `experiments/comparisons/profile/README.md` ("The exception is a scorer…") names the first check's ledger as where its decision is kept. The second look is one more scorer of the same kind with a ledger of its own, and that page does not say so. It is the lab's file.
15. The dated notes on the first check's pages (the order, the told ceiling) are the driver's to write and the owner's to approve. I touched nothing there.
16. A results page for the second look does not exist and must not until a run has a record: `tables.mjs --check` fails if one does. When there are records, `node experiments/watching/second-look/tables.mjs` prints the tables and the readings to paste.

## Prompt to paste into the driver session

```text
Handback for slice 0111 is at handoffs/0111-a-second-look-at-watching/HANDBACK.md on branch slice/0111-a-second-look-at-watching (pull request #192). Status: done; nothing was run. Please reconcile with the grooph-reconcile skill.
```
