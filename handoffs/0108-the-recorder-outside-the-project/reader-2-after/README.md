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

Three seeds of 400 cases, 4,400 runs of grooph each, and 1,650, 1,566 and 1,584 files checked after an install; the small set, 1,892 runs and 516 files. In every one of the four: no refusal, and "install run again left every file as it was" in every sequence (1,200 of 1,200 in each seed, 516 of 516 in the small set). The script names no file that did not parse, none where an entry of the person's changed and none where grooph's entries were wrong or doubled. The kinds it does name, with its own counts over the three sequences of each seed (seeds 1, 2, 3):

| Kind, in the script's words | Seeds 1, 2, 3 | What it is |
|---|---|---|
| (6) hooks was there and empty | 393, 393, 378 | stated: it goes with the entries that filled it |
| (6) an event grooph adds to was there with an empty list, and is gone | 282, 262, 256; and 42, 39, 30 more where an earlier install's entries were in the file | now stated |
| (3) an event that should be there is not | 4, 3, 4 | the same thing by another road: the empty list was filled by `--tools`, and that option was then dropped |
| (6) the file was an empty object with space in it, and (2) hooks was missing and the file changed in more than one place | 3, 3, 6 each | one case under two names: `{ }` has its space replaced when `hooks` goes in, and comes back `{}`. Now stated |

The small set shows the same kinds and no other (132, 96, 36 and 12).

## The first reader's scripts once more (`out-r1-*.txt`)

01: 28 held. 02: 26 held, and the two rows its README already explains. 04: 16 held. 05: 11 held. 06 and 09 held.

## The second reader's re-check, and what came of it

The second reader was then asked to attack the lane's answer to its own report, briefly. It could not write a file of its own, and its report came back as a message. What follows is that report shortened by the lane: the findings, the counts and the things reasoned are the reader's, in its words where they are kept; what was cut is detail of each case, which its three scripts print (`../reader-2/out-21-*.txt`, `out-22-sequences.txt`, `out-23-behind.txt`).

> Three things still broke: a session's note changes the state shown for a recorded session, a link to a single file still shows another project's session, and removing for one of two accounts deletes the hook the other still runs. The lock held under every real load I gave it, the settings editor held in every case, and my model agrees with the fuzz rerun.
>
> Build attacked: `hooks.js 0c22565e5253 · events-io.js cafc5778c08d · grooph-event.mjs 332b2e1dbe1f`. New scripts are `21-lock.mjs`, `22-sequences.mjs`, `23-behind.mjs`.
>
> 1. **A note in the project still changes the state shown for a session the record holds.** A recorded session silent for two hours with a subagent running; then one `note` line in the project's events folder. Before: `last seen 2 h 3 min ago, working then · 1 not seen to finish`. After: `working · 1 running`, and the note. The note is presented as a note, so as something said, but it resets the session's last-heard time. Held: the hook's kinds of event carrying the recorded id changed nothing in 6 of 6 tries. Limit: the same lines under another harness name, the id in other letters or with a space leave the recorded session unchanged, but add five more sessions.
> 2. **Another project's session is still shown here through a link to one file** (and through a hard link to it): `isFile` follows links.
> 3. **Two accounts, one grooph folder: `remove --user` for one deletes the hook the other still runs.** `stillNaming` knows only the folder `CLAUDE_CONFIG_DIR` names at that moment.
> 4. **A command can still wait forever on the lock.** Four of 12 things at `grooph.lock` were still running after 15 s: a file nobody may read, a link to nothing, a link to a folder, a named pipe. Limit: a lock naming a pid that is alive and is not grooph makes every command exit 1 after 10.2 s until the file is removed by hand; the message says to remove it.
> 5. `USER_COMMAND` still takes one look-alike, the one the docs now state.
>
> Lock: 25 unwatch + 25 watch at once, 10 rounds: list exact 10 of 10, slowest 1,403 ms, 0 locks left. A dead holder's lock, then 24 watch at once, 30 rounds: 0 folders lost of 720. Watch killed 150 times: list never broken. A holder stopped while holding: the second exits 1 after 10,197 ms with the message, the first then finishes, no loss. Five kinds of command at once, 40 rounds: 0 hook-gone states, 0 of 200 non-zero exits. I did not lose or double a folder.
>
> Fuzz, seed 1 on this build: 0 refusals (before the fix, 258); a second identical install wrote nothing in 1,200 of 1,200; 0 failures of checks (1), (2) and (4), 0 joined-entry kinds. What is left is the three stated remove exceptions. One more thing, 4 times: an install that switches options drops a person's `"PostToolUse": []`; the docs state this for remove only.
>
> Sequences: joined entries, 0 wrong of 36 (grooph's command first, middle and last; two of grooph's with one or two of somebody's; one line, spaced, tabs with CRLF), somebody's command kept byte for byte. Install, a change by hand, install: 0 wrong of 48.
>
> Reasoned, not run: two waiters taking a dead holder's lock in the same microseconds (0 hits in 720 commands); a reused pid; machine sleep while a lock is held; Windows (`linkSync`, `process.kill(pid, 0)`).

What the lane did with it, in the head commit (`hooks.js` `2b3b714a155c`, `events-io.js` `244ea15957bd`, the hook unchanged), and the same scripts on that build (`out-21-lock.txt`, `out-22-sequences.txt`, `out-23-behind.txt`, and `12`, `13`, `18` again):

- **2, repaired**: a project's events folder that stands behind a record is read for its own files only (no link, no second name). The script's row now holds: a link to the file, a second name, the folder as a link, none shows the other project's session.
- **3, repaired**: grooph's folder keeps a note of every settings file an install was made into (`installed.json`), and `remove --user` keeps the hook while any of them names it. The script's row holds: "kept ~/.grooph/hooks/grooph-event.mjs: ~/.claude-second-account/settings.json still names it".
- **4, repaired**: something by the lock's name that is no file is cleared at once, and a file that cannot be read is waited for ten seconds like one that is held. "never ended: 0 of 12".
- **1, left and said** in `docs/subagents.md`: a note counts as the session being heard from, wherever it is written; that is `packages/core`'s reading of a note, which this slice may not change.
- The switched-options case is now stated for install too.
- New limit seen in the rerun: a `watch` killed at a random moment left a file named `grooph.lock.<process>.<token>` beside the lock 2 times in 150.

Nobody but the lane has read that last change.
