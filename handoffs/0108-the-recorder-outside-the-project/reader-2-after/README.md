# After the second reader: both readers' scripts, run again by the lane

The second reader's report is [`../reader-2/REPORT.md`](../reader-2/REPORT.md). The lane answered it, then ran both readers' scripts, unchanged, against the build that came of it, on the same Mac (2026-10-11; `hooks.js` `0c22565e5253`, `events-io.js` `cafc5778c08d`, `grooph-event.mjs` `332b2e1dbe1f`). The outputs are beside this page. A row's own mark is the script's, written against the build its reader attacked: read the line, not only the mark.

Three files here are from the build one step earlier (`hooks.js` `f15af4fd20f3`, the same but for the lock, which the settings editor does not use): the four fuzz outputs, and `out-15-list.before-the-lock-fix.txt`, which is how the lane found that its first rewrite of the lock lost a folder in 2 of 10 rounds of fifty commands at once. `out-15-list.txt`, `.run2` and `.run3` are the three runs after that was repaired.

## The second reader's findings

| Finding | Before | After | What is left |
|---|---|---|---|
| 1. `install --user` run again is refused | 5 of 5 cases, and the same command twice | 0: `10-reinstall.mjs` 8 held; fuzz, 0 refusals in 12,000 runs of each seed, and "install run again left every file as it was" 1,200 of 1,200 per seed | |
| 2. commands that are not grooph's are taken out | 6 of 10 look-alikes | 1 of 10 | `node "/opt/tools/hooks/grooph-event.mjs" claude-code --user`: exactly what an install with `GROOPH_HOME=/opt/tools` writes, so it is taken for one. Said in `docs/subagents.md` |
| 3. a session forges what the readers show of a session the record holds | state, subagents, model and folder all changed; a pipe held 3 of 4 readers; a link showed another project's sessions | none of the three (`13-readers.mjs`, 6 held) | by design it can still add a note or a plan (what a session says), and a session under a new id |
| 4. entries left running a hook file that is gone | 3 orders of commands; 105 of 150 with install and remove at once | 0 of 150; the three orders keep the hook's file (`12-entries.mjs`, `18-misc.mjs`) | |
| 5. the lock is no lock after five seconds | a folder lost in 3 of 5 rounds behind a left lock; in 5 of 5 behind a stopped holder | 0 of 30 rounds in three runs of `15-list.mjs` (1,500 commands at once, 480 behind a left lock) | the script's stopped-holder row looks for the old lock, a folder, and so does not land its stop: the lane's own test holds a lock from a live process and has the waiter refuse after ten seconds. Not tried: a holder whose process number the system gives to another process |
| 6. exceptions to "every other character" not stated | | joined entries now keep every character of the other command (0 in the fuzz); the three that remain are stated: an empty `hooks`, an event's empty list, `{ }` | |
| 7. `remove --user` refuses where a person may need it | 6 of 8 conditions | 6 of 8 still: it refuses what it could not put back whole, keeps the hook's file, and now says "cannot change" and why | the lane kept the refusal: the other way to write is the one that emptied a file when killed |
| 8. a file that is not UTF-8 is changed | 2 of 2 | refused, nothing written | |

Smaller: a file left by a stopped command under the next command's process number no longer meets it (each has a name of its own); such files are still never cleared or mentioned. A value nested 6,000 deep is still refused with the system's own words. A project's `remove` in a home folder still writes that settings file the way a project's settings always were written.

## The fuzz, again (`out-11-fuzz-*.txt`; `model.mjs` is the reader's own, and imports nothing of grooph's)

Three seeds of 400 cases: 4,400 runs of grooph and 1,650 files checked after an install in each. In all three: 0 files that did not parse, 0 where anything of the person's outside `hooks` changed, 0 where an entry of theirs changed, 0 where grooph's entries were wrong or doubled, 0 refusals, and a second identical install left every file as it was. What remove did not give back to the letter, all of kinds now stated: a `hooks` that was there and empty (131, 131 and 126 base cases); an event's list that was there and empty (94, 87 and 85, counted again where an earlier install's entries were in the file, and as "an event that should be there is not" where the list had been filled by `--tools` and that option was then dropped); an empty object written with space in it (1 to 2 a seed).

## The first reader's scripts once more (`out-r1-*.txt`)

01: 28 held. 02: 26 held, and the two rows its README already explains. 04: 16 held. 05: 11 held. 06 and 09 held.
