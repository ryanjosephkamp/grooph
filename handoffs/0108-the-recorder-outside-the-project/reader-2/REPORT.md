# Second reader's attack on the fix (slice 0108)

_The second reader's own report, as it handed it back on 2026-10-11. Like the first, it could not write this file itself, so the lane pasted its message here, unchanged but for this note. Everything else in this folder is the reader's: every script (`run.sh` lists them) and every kept output (`out-*.txt`). It attacked the lane's answer to the first reader ([`../reader/REPORT.md`](../reader/REPORT.md)). What the lane changed after reading this one, and what these scripts say of the changed build, is in [`../reader-2-after/`](../reader-2-after/README.md)._

Nothing outside `handoffs/0108-the-recorder-outside-the-project/reader-2/` was written; no source, test, doc or git state was touched; no model, no network. Every grooph run went through the first reader's `lib.mjs` (scratch folders only). `reader-2/run.sh` lists every script; kept outputs are `out-*.txt` beside them.

**What was attacked.** The build as it stood: `hooks.js 96f16a908dce · events-io.js 23d611fdf5b4 · grooph-event.mjs 332b2e1dbe1f`, from a byte copy pinned in scratch (`GROOPH_CLI`).

- **The head moved under me** to `e14f5b16` (two commits past `934f327b`). The build was not rebuilt.
- I compiled the head's source in memory and compared: `events-io`, `watch`, `index`, `paths` are what the build holds. `hooks.js` differs only by `e14f5b16`'s new status line about `GROOPH_EVENTS_DIR`.
- So `docs/subagents.md` at head says "`grooph hooks status` says so in one line when the variable is set", and the build as given does not (`17-hook.mjs`).

**In short.** The text editor never corrupted anything that was not grooph's: 0 in 4,075 files checked after an install, apart from entries grooph's command was joined into (finding 6) and bytes that are not UTF-8 (finding 8). What broke is that it refuses its own earlier work, takes commands that are not grooph's, and that the readers and the lock still have a way round.

## 1. Findings that broke something, worst first

**1. `install --user` run again is refused, after the first run worked.** `node 10-reinstall.mjs`, `node 18-misc.mjs`.

- It happens whenever grooph's entries are all that `hooks` holds and `hooks` is not the last key of the file.
- Cause: `takenOut` removes `hooks` whole, `putIn` adds it back at the end of the file, and the check against `next` (which keeps `hooks` in place) fails.
- A person meets it when a key is added after `hooks` and they then add `--tools`, drop it, or move `GROOPH_HOME` (5 of 5 such cases; 3 controls held).
- They also meet it with the same command twice in a row, no change at all: a file `{"hooks": {"Stop": []}, "model": "opus"}`, `install --user` exit 0, `install --user` again exit 1.
- The words are untrue as well: it read the file.

```
grooph: cannot read <S>/p1/claude/settings.json: grooph could not change it and be sure of the result. Nothing was changed.
```

- The file is left unchanged. The way out works: `remove --user`, then install (`hooks` then goes last).
- Fuzz counts are in section 3. Smallest input: `{"hooks":{},"a":1}`, then install, then install `--tools`.

**2. `install --user` and `remove --user` still take out commands that are not grooph's.** `node 12-entries.mjs`.

- `USER_COMMAND` is `^node "(.*[/\\]hooks[/\\]grooph-event\.mjs)" (claude-code|codex) --user$`, and `.*` crosses quotes.
- Install took out 6 of 10 look-alikes; `install` said it left 4 alone. Put in after an install, 2 of 2 went on `remove --user`, leaving `{}`.
- Taken, among others:
  - `node "/opt/tools/notify.js" && echo "/hooks/grooph-event.mjs" claude-code --user`
  - `node "/opt/a.js" ; rm -f "/tmp/x/hooks/grooph-event.mjs" claude-code --user`
  - `node "/opt/tools/wrap.mjs" "<home>/hooks/grooph-event.mjs" claude-code --user`
  - `node "--no-warnings" "<hook>" claude-code --user`
  - `node "/Users/a"b/hooks/grooph-event.mjs" claude-code --user` (a path install itself refuses to write)
- The first reader's two look-alikes, single quotes and the project kind are now left alone.

**3. A session can still forge what all three readers show of a session the record holds.** `node 13-readers.mjs`.

- Files under the same names as the record's are now ignored: held, 4 of 4 views.
- But `without` goes by file name, and sessions are keyed by the id inside each line. One file `notes.jsonl` in a `.grooph/events/` the session makes, with 7 lines carrying the recorded id, changed everything shown:

```
state "working" -> "ended"; subagents ["builder:running","critic:running","deployer:running"] -> ["formatter:done","builder:done","critic:done"];
model undefined -> a-model-it-is-not; folder <S>/b/project -> /somewhere/harmless. live.json shows the same forged view: true.
```

- `grooph sessions` still ends "read from <store>/, where the sessions … are recorded outside the project, and from …/.grooph/events/ for the sessions only that folder holds".
- It can also add a subagent that never ran and a note.
- A named pipe `x.jsonl` there still blinds 3 of 4 readers: `sessions`, `sessions --json`, and `watch --sessions`, which never came up. `hooks status` did not hang.
- `.grooph/events` as a link to another listed project's record still shows that project's session here, in `sessions` and in live.json.

**4. Entries left running a hook file that is gone ("Cannot find module" at every event).** `node 12-entries.mjs`, `node 18-misc.mjs`.

- The refusal of a project install in `~` holds with the defaults (14 of 14 refusal cases as expected; first reader's 09: 2 held). It does not cover these:
  - `CLAUDE_CONFIG_DIR` elsewhere (a second account), `install --user`, then `grooph hooks remove` typed in `~` without `--user`: prints "removed .grooph/hooks/grooph-event.mjs", 7 user-level entries stay, a session hears `exit 1: Error: Cannot find module`. Same with `CODEX_HOME` elsewhere and `--harness codex`.
  - `install --user`, then `grooph hooks install --local` in `~` (allowed), then `remove --user`: the hook goes, and `~/.claude/settings.local.json` entries fail.
  - `CLAUDE_CONFIG_DIR` elsewhere, `install --user`, `grooph hooks install` in `~` (allowed), `remove --user`: the same.
- `install --user --tools` and `remove --user` started at the same moment: 105 of 150 ended with entries in the settings and the hook's file gone (29 with both, 16 with neither, 0 unparseable). A person would not do this; two agents might.

**5. The list's lock is no lock once a waiter has waited five seconds.** `node 15-list.mjs --rounds 10`.

- After 200 tries a waiter removes the lock on every later try, without looking at its age.
- A lock left a moment ago, then 12 `watch` at once: a folder was lost in 3 of 5 rounds (5 of 60), while 60 of 60 said "listed:" and exited 0. Slowest command 6,150 ms.
- A holder stopped with SIGSTOP for 7 s, under the ten the code says it waits: the second went ahead after 6.4 to 6.6 s, and one of the two folders was missing in 5 of 5.
  - I made the list 2,500 folders long so the stop lands inside the hold; with a short list the hold is about a millisecond.
- A single waiter behind a left lock took 5,904 ms and worked.
- Held: 25 unwatch + 25 watch at once, 10 rounds, 500 commands — list exact every time, 0 unparseable reads, slowest 1,859 ms, no lock left. 20 watches of one folder: once, 10 of 10.
- Held: a lock 11 s old then 16 at once (0 lost of 160), and then 24 at once (0 lost of 1,440, `15b-stale-lock.mjs`). The look-then-remove window exists by reading; I did not hit it.

**6. "Every other character is left as it was" has exceptions the docs do not state.** Fuzz, section 3.

- `"Stop": []` (an empty list for an event grooph adds to) is gone after install then remove. With it alone, `hooks` goes too: `{"hooks":{"Stop":[]}}` comes back `{}`.
- With such a list, "a second run writes nothing" is false: the second identical install rewrote the file and moved `Stop` (`18-misc.mjs`: second wrote, third and fourth did not). Or it was refused, as in finding 1.
- An entry grooph's command was joined into is written again from the parsed object. Of somebody's own commands in it: `1e400` became `null`, `9007199254740993` was rounded, a key written twice lost its first value, `10.0` became `10`, escapes were respelled, integer-like keys moved to the front. The final check cannot see any of these.
- `{ }` comes back `{}`.
- A one-line file whose `hooks` held only grooph's is laid out afresh on re-install.
- `hooks` moves past the person's keys where JavaScript cannot see order (`{"hooks":{},"10":…}`).

**7. `remove --user` now refuses where a person may need it.** `node 14-writes.mjs`.

- After a good install, the command could not take grooph out in 6 of 8 conditions: file read-only, hard-linked, folder read-only, link into a read-only folder, link gone dangling (exit 0, nothing removed), file unreadable.
- The hook's file was kept every time, so no session errors. The reasons given are enough to act on.
- Four of them begin "cannot read" of a file it had just read.
- Install under the same conditions: 0 of 8 wrote anything when refusing.

**8. A settings file that is not UTF-8 is changed silently.** `node 19-odd-texts.mjs`.

- `{"name":"caf<E9>"}` (Latin-1): install exit 0, the byte is replaced, and remove does not give the file back. Same for a lone surrogate written as bytes.
- A byte-order mark, an event written twice and `hooks` written twice are refused with nothing written.

**Smaller.**

- A leftover `<file>.<pid>.grooph-tmp` under the pid the next command gets: that command fails once with `EEXIST`, removes a file it did not make, and works on the next run (12 of 12, for settings and for the list). The list's message is the raw system error.
- Leftovers under other pids are never read, cleared or mentioned (3 of 3 left).
- A value nested 6,000 deep is refused with "Maximum call stack size exceeded" (1,000 and 3,000 install).
- 17 MB of settings: install 600 ms, back to the letter.
- A project's `remove` in `~` over an old project-kind entry rewrites the harness's own settings the old way: `1e400` to `null`, CRLF to LF, tabs to spaces (`18-misc.mjs`).

## 2. The first reader's nine findings, by my own run

1. **Home collision: partly.** Defaults answered. Open through `CLAUDE_CONFIG_DIR` or `CODEX_HOME` elsewhere and through `--local` (finding 4).
2. **A session hides or rewrites the readers: partly.** Same-name files are ignored. Another name carrying the id, the pipe and the link all still work (finding 3).
3. **Frozen after a project install is removed: answered** for `sessions` and `watch` (2 subagents, ended). Not for `hooks status`, which says "this session (mine): 3 lines recorded" while the record holds 7.
4. **Takes out entries not grooph's: partly.** The first reader's cases are left and a joined command survives, though rewritten. 6 of 10 new look-alikes go (finding 2).
5. **Concurrent watch loses a folder: partly.** Ordinary case answered. Not behind a left lock or a stopped holder (finding 5).
6. **Settings emptied when killed: answered.** 800 kills of remove, both-harness install and remove, and install over an install (`16-kill.mjs`): 0 broken, 0 entries left running a missing hook, 0 hook files cut short, 6 tmp files left. The price is finding 7.
7. **`GROOPH_EVENTS_DIR` obeyed with `--user`: answered.** 5 of 5 values ignored; still obeyed in a project.
8. **Two ways past the refusal: answered.** First reader's 04 rows held; 8 of 8 more by links and other letters.
9. **Untrue sentences: 7 of 10 answered.** Still untrue: item 6 (the `sessions` last line, finding 3). Reworded only: item 7 (the hook still waits for its input to end, 3 s and counting) and item 8 (see finding 6). On item 5, the list's trouble is now on standard error, but standard output still says "The event hook writes them: grooph hooks install" (`20-list-words.mjs`).

## 3. Counts

**Settings fuzz** (`11-fuzz-settings.mjs` against `model.mjs`, a regex tokenizer and span tree that import nothing of grooph's):

| | Small set | Seeds 1 to 3 |
|---|---|---|
| Texts | 172 | 1,600 |
| Sequences | 516 | 3,600 |
| Runs of grooph | 1,796 | 12,204 |
| Sequences with nothing to say | 252 | 1,639 |

Over the three seeds:

- **Zero** in 4,075 files checked after an install: (1) does not parse; (2) a top-level member other than `hooks` changed; (3) an entry not joined with grooph's changed; (4) grooph's entries wrong or doubled. Zero refusals that changed a file, zero remove refusals.
- **(5) Second identical install:** left the file alone in 2,827 of 3,106; rewrote it in 242 base files (smallest `{"hooks":{"Stop":[]}}`); refused in 42.
- **Refused, "could not change it and be sure":** first install 7, install again 42, `--tools` switched 352, `GROOPH_HOME` moved 352. These are shares of generated texts, where `hooks` is often empty and not last; not a rate for real files.
- **(6) Remove did not give the bytes back, base sequence:** `hooks` there and empty (stated) 386; an event's empty list (not stated) 264; `{ }` 4.
- **Joined entries, base sequence** (the switch and moved sequences repeat each): tokens missing 4 + 3 + 0; `1e400` to `null` 2 + 3 + 2; long integer rounded 2 + 0 + 2; number respelled 2 + 6 + 5.

**Races** (`out-races.txt`, user layout, 8 hooks at a time; the first reader's two runs beside):

| Race | Calls | Mine | First reader |
|---|---|---|---|
| dir-name, swap | 2,000 | 0 outside | 0 |
| dir-name, node | 2,000 | 0 | 0 |
| second name, begins as events file | 4,000 | 17 | 12; 11 |
| second name, empty file | 4,000 | 15 | 9; 10 |
| second name, other contents | 4,000 | 0 | 0; 0 |
| pipe | 600 | 0, 0 bytes into the pipe | 0 |

16,600 calls: none hung, printed or exited non-zero. No regression.

**The first reader's scripts again** (`out-r1-*.txt`):

- 01: 28 held, 11 limits, 0 broke.
- 02: 26 held, 2 broke — the stated `{"hooks":{}}` case, and a row that expected a write where the build now refuses.
- 04: 16 held, 4 limits. 05: 9 held, 3 limits. 06: 1 held. 09: 2 held.
- 07: 44 of 44 byte for byte against origin/main `da6c3874`; 68 of 68 hook calls the same.
- 03 stops at its relative-`GROOPH_HOME` case, as the lane said.
- Note: 15 of the lane's `reader-after` outputs name build `8ca5893e7c22`, not the present one; its README says so.

## 4. Sentences that are untrue

1. Help and `docs/cli.md`: "Safe to run again." Refused on the second identical run (finding 1).
2. `docs/subagents.md`: "A second run writes nothing." It rewrote the file with `"Stop": []` present.
3. "an install followed by a remove gives the file back to the letter (one case does not…)". There are three more: an event's empty list, `{ }`, a non-UTF-8 byte.
4. "An entry is grooph's only if it is exactly what `install --user` writes… A command that only looks like one… [is] left alone". 6 of 10 were taken.
5. "every other character of the file is left as it was". Not for joined entries or non-UTF-8 bytes.
6. "a session that both hold is read once, from the record outside the project: that is the one a session working in the project cannot write". True by file name only.
7. "A project's `remove` there takes out a project's entries only." With `CLAUDE_CONFIG_DIR` or `CODEX_HOME` elsewhere it removes the user-level install's hook file.
8. "while any of them names the hook, `remove --user` keeps the hook's file". Only for entries in the two user-level files, not `~/.claude/settings.local.json`.
9. "cannot read <file>: it is read-only", "…it has a second name…", "…its folder takes no new file…", "…could not change it and be sure". The file was read; it could not be written.
10. `hooks status` in `~` over an old project install: ".grooph/hooks/grooph-event.mjs is not this grooph's version: run grooph hooks install again", which is refused there. The refusal says nothing of the entries already in the file.
11. `hooks status`: "this session (mine): 3 lines recorded" while the record holds 7.
12. `docs/subagents.md` at head: "`grooph hooks status` says so in one line when the variable is set". Not in the build given.

## 5. Reasoned, not run; could not try

**Reasoned, not run.**

- The stale-lock look-then-remove window (0 hits in 1,600 commands).
- Machine sleep during a held lock: both processes wake and the waiter sees it older than ten seconds.
- `readList` compares every pair of entries, so about 745 ms a command at 2,500 folders, in every reader.
- Whether Claude Code keeps key order or appends keys when it rewrites its settings, which decides how often finding 1 bites.
- Whether a harness reads a non-UTF-8 settings file at all.
- A harness writing its settings during an install (the docs admit this).

**Could not try.** Any real harness; Windows, Linux, a case-sensitive or network volume; disk full; a real pid reused by the system (I put the leftover under the pid after the command started).

**Machine.** MacBook Pro M3 Pro, 12 cores, macOS 26.3.1, APFS, Node v26.10.0.

**To run again.** `cd handoffs/0108-the-recorder-outside-the-project/reader-2 && ./run.sh <script>` (10, 11, 12 to 20, 15b), `./fuzz-all.sh`, `GROOPH_MAIN_CLI=… ./rerun-first-reader.sh`. `GROOPH_CLI` names another build. My pinned copy (`pin-r2`) is in the session scratchpad and will not outlive it.
