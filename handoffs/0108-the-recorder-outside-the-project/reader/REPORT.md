# Fresh reader's attack on slice 0108 (the recorder outside the project)

_The reader's own report, as it handed it back on 2026-10-11. It could not write this file itself (its harness refuses a report file from a subagent), so the lane that asked for the attack pasted its message here, unchanged but for this note. Everything else in this folder is the reader's: every script, every kept output (`out-*.txt`), and `table.md` (all 113 attack rows, made from the outputs by `make-table.mjs`). `run.sh` has the list of scripts and the environment variables. What the lane changed after reading it, and what the same scripts say of the changed build, is in [`../reader-after/`](../reader-after/README.md)._

No model session, no network call by any script, nothing installed, no source/test/doc edited, no git state touched. Every grooph run went through `lib.mjs`, which refuses to start unless `GROOPH_HOME`, `CLAUDE_CONFIG_DIR`, `CODEX_HOME` and `HOME` all resolve under a scratch folder it made.

## What was attacked

- **The build**: the worktree's `packages/cli/dist` as it stood 14:18 to 15:00 (head `d22f4358`): `hooks.js` sha256 `2ce2fd72936b`, `events-io.js` `b09a460f7b0c`, `hooks/grooph-event.mjs` `d2701dfd1a8e`. Unchanged while I ran; I worked from a byte copy.
- **The worktree was being edited under me.** `src/commands/hooks.ts` (14:26), `src/index.ts`, `test/hooks-user.test.ts` have uncommitted changes the build does not hold (a lock on the list, `watch` taking several folders, joined entries, CRLF). I did not rebuild the worktree. I compiled a copy of that working tree in scratch (`hooks.js` `23f02f47a29f`) only to see which findings it already answers: outputs named `*.uncommitted.txt`. Verdicts are for the built head unless said.
- **origin/main for promise 6**: `da6c3874`, by `git archive` into scratch, compiled there with `tsc` + `bundle-patterns.mjs`, dependencies linked from this worktree's `node_modules` (no install). The main clone's own `dist` is older than its head, so not used.
- **Machine**: MacBook Pro M3 Pro, 12 cores, macOS 26.3.1, APFS (case-insensitive), Node v26.10.0.

## In short

- **The hook held.** 212 static calls plus 300 at once in `--user`: always exit 0, nothing on either stream, one whole JSON line, nothing an agent said, nothing outside `<home>/events/<name>/`, no line outside every listed folder, nothing with the list empty/missing/malformed. One exception: `GROOPH_EVENTS_DIR` (finding 7).
- **Races: the user layout does the same as the project layout of this build.** Counts below.
- **Promise 5 held** (a listed git repo identical in every path, size and mtime, `git status --porcelain --ignored` empty, after 20 hook commands via `sh -c` and every reader). **Promise 6 held** (44 of 44 option-set × starting-settings cases byte-identical in what is written and printed against origin/main's build; the two hook files wrote the same lines over 68 project-layout calls).
- **What broke is around the hook**: 18 table rows marked broke, which are the 9 findings below.

## Findings that broke something, worst first

**1. `grooph hooks install` typed in `~` silently removes the user-level install, then every session hears an error.** `node 09-home-collision.mjs`. With defaults, a project install whose project is `~` and the user-level install share `~/.grooph/hooks/grooph-event.mjs` and `~/.claude/settings.json`.

```
entries in ~/.claude/settings.json before: 7 of the user's kind; after: 0 of the user's kind, 7 of a project's kind.
install's words name the user-level install: false.
A session in the listed project: before, 1 ran, 0 heard; after, 1 ran, 1 heard
 (exit 1: Error: Cannot find module '<project>/.grooph/hooks/grooph-event.mjs')
```

Other order (install in `~`, `install --user`, `remove --user`): `remove --user` deletes the hook file while 7 project-style entries in the same settings still run it; a session in `~` then gets `Cannot find module`. The stderr-at-every-event part exists on main too; new is that a working install is destroyed without a word. Still so in the uncommitted source.

**2. A session can hide or rewrite what the readers show of it, from inside its own listed project.** `node 05-readers.mjs`, row "a session makes .grooph/events/ in its own listed project". Where the project has a `.grooph/events/`, `ownSources` reads a session "once, from the project", by file name alone. A session can make that folder and read the names from `~/.grooph/events/<name>/`.

```
before: 2 sessions, sess-c1 with 5 subagents.
After: 1 session(s) shown; sess-c1 has 0 subagents and state "ended"; the other session is gone from the view.
The record outside is untouched (2 files), and grooph sessions still ends: "read from <home>/events/project-…/: the sessions of <project> are recorded there..."
```

Same door, marked limits (so in a project install too): a named pipe `x.jsonl` there hangs `grooph sessions`; `.grooph/events` as a link to another listed project's record shows that project's sessions as this one's.

**3. After a project install is removed, a session recorded by both is frozen in the readers.** Same script, row "then the project install is removed". `hooks remove` keeps the project's events; that stale file then hides the live one.

```
the record outside holds 7 lines of the session, the project's stale file 3.
grooph sessions shows 1 subagent(s) and says: "claude-code · working · 0 running, 1 done"; state: working.
```

The session had run a second subagent and ended. Anyone migrating from a project install hits this.

**4. `install --user` / `remove --user` take out entries that are not grooph's.** `node 02-settings.mjs`.

- `USER_ENTRY` matches any command ending `grooph-event.mjs" <harness> --user`: `node "/opt/tools/my-own-grooph-event.mjs" claude-code --user` and `echo "remember: grooph-event.mjs" claude-code --user` were removed by `install --user` (2 of 3 look-alikes; the project-style one was left). Still so in the uncommitted source.
- A person's own command joined into grooph's entry went with it, on re-install and on remove. **The uncommitted source fixes this.**
- Limit, the other way: grooph's entry rewritten by hand is not recognized in 4 of 9 spellings (single quotes, `|| true`, inside `sh -c`, a `#` comment): install adds a duplicate, remove leaves it and deletes the hook file it runs.

**5. Concurrent `watch`: one loses the other's folder.** `node 04-list.mjs`. Built head: 24 at once, all said "listed:" and exited 0, the list held **16 of 24**; 12 unwatch + 12 watch: 6 (3 on another run) of 12 unwatched still listed, 10 of 12 new kept. **The uncommitted source fixes this** (24 of 24; 0 and 12 of 12; no lock left after 120 killed `watch` commands). Not tried against that lock: a holder stopped for more than its ten seconds, or two commands taking over a stale lock together.

**6. A settings file left empty when install is killed, in the in-place fallback.** `node 08-kill.mjs --times 250`. Ordinary case: 0 broken of 500 kills on a 3 MB settings file (one `settings.json.<pid>.grooph-tmp` left per 250). Folder mode 555 with a writable file (same path as `EPERM`/`EBUSY`/`EXDEV`/`EROFS`, e.g. a settings file mounted alone): **2 emptied of 250, then 0 of 250** (0 of 120 on the uncommitted source). `docs/subagents.md` says "there whole or as it was" without this exception.

**7. `GROOPH_EVENTS_DIR` is still obeyed in `--user`.** `node 01-hook-user.mjs`. The handoff says it "keeps its meaning", so possibly intended; it is against the promise as put to me and the hook's header. With it set the hook wrote outside `<home>/events/`, made the folders on the way with mode 755, put two listed projects' sessions in one folder, and the readers did not see them; with a relative value and the hook started in the project it made `rel-events/` inside the watched project. A session in no listed folder still left nothing. Whether a session can set that variable for a harness's hooks (a project's `.claude/settings.json` `env`) is reasoned, not run.

**8. Two ways past the refusal.** `node 04-list.mjs`. (a) `watch <home>/events`, `<home>/hooks` and a listed folder's own record folder were all listed (3 of 3): the check only asks whether the folder holds grooph's. (b) Before grooph's folder exists, with `GROOPH_HOME` named through a link (anything under `/tmp` or `/var` on a Mac) or in other letters, `watch` of the folder that will hold it exits 0 and the list is then written inside the listed folder. Refused once the folder stands; the default `~/.grooph` is covered by the home check.

**9. Untrue sentences** (script in brackets):

1. `unwatch <inner>`: "From its next event on, a session working there is not recorded." With the outer still listed, the next session was recorded under the outer [04].
2. `watch <inner>`: "a session here is recorded under this one, the inner of the two." A Claude Code session started in the outer goes to the outer record (`CLAUDE_PROJECT_DIR` first); `sessions` in the inner does not show it [01].
3. `hooks status` from a session started in the outer, standing in the inner: "this session (…): NOTHING recorded: the harness has not run the hooks in it." Its line is in the outer's record [05].
4. `watch --sessions`, listed folder, nothing recorded: "(grooph hooks install records them)". That installs in the project; `install --user` is meant [05].
5. `sessions` in a listed folder whose list cannot be read: "no sessions recorded in .. The event hook writes them: grooph hooks install", nothing about the list, while the record holds a session (3 of 3). `hooks status` does say it [05].
6. `sessions` ends "read from <store>: the sessions of … are recorded there" in findings 2 and 3, where what it showed came from the project's file.
7. Hook header and `docs/subagents.md`: "with nothing listed it leaves before it reads what it was sent." It reads all of stdin first (54 ms with 200 bytes, 99 ms with 100 MB) and with stdin left open waits for ever, list or no list [01].
8. Docs: "leaves every other key and every other entry as it was". Beyond finding 4: `1e400` and `-1e400` are written back as `null` (not rounding); `9007199254740993` → `…992`; a key written twice loses its first value; integer-like keys move to the front; one-line lists are spread out; `é`, `\/` rewritten; CRLF → LF (uncommitted source keeps CRLF) [02, `02b-numbers.mjs`]. Otherwise: values JavaScript can hold kept in 19 of 19 files, second install wrote nothing 19 of 19, install+remove gave back the same bytes 5 of 19 and same values 18 of 19 (`{"hooks":{}}` returns as `{}`).
9. Docs: "a settings file that is a link … stays a link": true for a symlink; a hard-linked settings file is split from its other name. A read-only (444) settings file is replaced all the same, mode kept, no word [02].
10. Help says `watch | unwatch <folder>`; given two, the built head lists the first silently, exit 0 [04]. Uncommitted source takes both.

## Race counts (`race.mjs`, `races-all.sh`, `races-hardlink-again.sh`; 8 hooks at a time)

Two attackers for the folder races: `node` (rename away, symlink, unlink, rename back) and `swap` (folder and link exchanged in one `renamex_np(RENAME_SWAP)` call via python3 ctypes, so the name is never missing).

| Race | Layout | Calls | Attacker rounds | Outside | #190 |
|---|---|---|---|---|---|
| a. link at `<home>/events/<name>`, node / swap | user | 2,000 / 2,000 | 76,839 / 154,000 | **0 / 0** | 0 of 2,000 |
| a. link at `<home>/events`, node / swap | user | 2,000 / 2,000 | 74,664 / 162,000 | **0 / 0** | 0 of 2,000 |
| b. second name, other contents | user | 4,000 twice | 83,476; 85,053 | **0; 0** | 0 of 4,000 twice |
| b. second name, begins as an events file | user | 4,000 twice | 94,116; 89,520 | **12; 11** | 1 to 3 |
| b. second name, empty file | user | 4,000 twice | 89,288; 87,392 | **9; 10** | 3 and 4 |
| c. named pipe | user | 600 | 38,464 | **0**, 0 bytes into the pipe | 0 of 600 |
| control: link at `.grooph/events`, node / swap | project | 2,000 / 2,000 | 70,259 / 174,000 | 0 / 0 | |
| control: second name, other / ours / empty | project | 4,000 twice each | ~80,000 each | 0; 0 / 11; 5 / 10; 21 | |
| control: pipe | project | 600 | 44,388 | 0 | |

32,600 user-layout and 28,600 project-layout calls: none hung, printed, or exited non-zero.

Plainly: **same as the project layout.** Folder races and pipe are 0, as in #190. The second name reaches an empty or look-alike file about 2 to 5 times per thousand under my attacker in both layouts, more often than #190 counted; since the project control shows the same, the difference is my attack, not the new layout. `docs/subagents.md` quotes #190's lower counts. In practice the user layout is better: a sandboxed session cannot make a second name in grooph's own folder at all. The `.grooph` swap was not run in the project control (the hook's own file is under it).

## Limits worth saying (30 rows in `table.md`; the ones that matter)

- Free text is kept whole at any length in `agent_type`, `agent_id`, `tool_name`, `model`, `agent_transcript_path`, `session_id`, `cwd`. A 6,000,000-character subagent type made a 6 MB "short line" and that session then vanished from `grooph sessions` (the 4 MB tail).
- A session with no `CLAUDE_PROJECT_DIR` (Codex) working in `alpha/link-to-beta` is recorded in **beta's** record; one whose folder moves alpha → beta → unlisted leaves 2 lines, 1 line, none, and alpha's reader shows its subagent "running" for good.
- A pipe at `<home>/watched.json` hangs the hook (needs write access to grooph's folder).
- The hook file replaced by a link to a copy elsewhere records nothing, silently; `status` says "installed" and no version warning.
- A listed folder renamed in letter case only (`MyProject` → `myproject`) stops being recorded; `status` says "not listed"; `watch` again makes a second entry and record.
- A listed folder moved away and another made at its path: the new one inherits the old sessions. A folder listed by a path with a link in it, then deleted, cannot be unwatched by the typed path.
- A hand-written list where two folders share a record name: nothing says so. `watched.json` is mode 644 in a 755 folder; a record folder that already stands open is not tightened.
- Relative `GROOPH_HOME`: `watch` from another folder writes a second list the hook never reads (`status` does say so).
- Two session ids, one file: `a/b` and `612f62` (its hex); `CaseId` and `caseid` on this disk.

Held and worth knowing: 21 hostile `GROOPH_HOME` names (spaces, `'`, `;`, `&&`, `|`, `*`, `~`, `#`, `%`, `?`, unicode, ESC, leading `--eval`) installed, ran silently under `sh -c`, `bash -c` and `zsh -c`, recorded in their own record and were removed; 8 (`"`, `$`, backtick, backslash, CR, LF) refused with nothing written; 0 files named CANARY. 16 of 16 unreadable settings files left every file untouched. 136 listed folders got 136 distinct record names.

## Reasoned, not run

- Whether a session can set `GROOPH_EVENTS_DIR` or `NODE_OPTIONS` in the environment a harness gives hooks.
- Whether Claude Code or Codex closes a hook's stdin, and how either runs the command string (I used `sh`, `bash`, `zsh`).
- Whether a resumed session keeps its id (how often finding 3 bites).
- `storeName` collisions against record folders of folders no longer listed (it checks the current list only).
- xattrs/ACLs on a settings file are lost by write-beside-and-rename; a lost update if the harness writes its settings during `install --user`.
- `grooph events push` through a `.grooph/events` link to another project's record (the sender is outside this change).
- Project-layout `withoutOurs` builds its hooks object with plain assignment, so an event named `__proto__` there would be dropped; the user-level path kept `__proto__` keys in my run.

## Could not try

- Any real harness (forbidden): whether a user-level entry fires, in Codex whether the folder must be trusted.
- Windows, Linux, a case-sensitive volume, a network or read-only volume, another user's sandbox.
- A path longer than 1,024 characters (`ENAMETOOLONG` at 1,079; printed as `[NOT TRIED]` in 04).
- The built head's `watch --sessions` beyond what it prints (nothing asked the server anything).

## Running again

`cd …/reader && ./run.sh 01-hook-user.mjs` (and 02, 02b, 03, 04, 05, 06, 08, 09); `GROOPH_MAIN_CLI=<built origin/main bin/grooph.js> ./run.sh 07-project-layout.mjs`; `./races-all.sh out.txt`. Default target is the worktree's own build; `GROOPH_CLI` names another. The pinned copy, the uncommitted-source build and the origin/main build I used are under the session scratchpad (`pin-1418`, `wip-1426`, `main-da6c3874`) and will not outlive it; the header of `07-project-layout.mjs` says how the main one was made. Note that the scripts' kept outputs name those scratch paths as `<TMP>/…`.
