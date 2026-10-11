# After the first reader: its scripts, run again by the lane

The fresh reader's report is [`../reader/REPORT.md`](../reader/REPORT.md). The lane answered it in commit `42367856` (and two lines in `946a18c1`), then ran the reader's own scripts, unchanged, against that build on the same Mac (2026-10-11; `hooks.js` `8ca5893e7c22`, later `96f16a908dce` after a change to help text only; `grooph-event.mjs` `332b2e1dbe1f`). The outputs are beside this page. The scripts were written against the build the reader attacked, so a row's own verdict is sometimes about what that build did: read the line, not only its mark.

| Script | Rows marked broke, before | After | What is left |
|---|---|---|---|
| `01-hook-user.mjs` | 2 | 0 | `GROOPH_EVENTS_DIR` is not read outside the project |
| `02-settings.mjs` | 4 | 2 | (a) `{"hooks": {}}` comes back from install and remove as `{}`: kept, and said in `docs/subagents.md`. (b) "Codex's hooks.json cannot be written": the row expected the first file to be written and the failure said; the build now refuses before anything is written ("it is read-only. Nothing was changed."), which is the better end |
| `02b-numbers.mjs` | (7 values changed) | 0 changed | `1e400`, `-1e400`, a 19-digit id, a long decimal, `-0` and a key written twice are in the file as they were |
| `03-paths.mjs` | 0 | 0, then it stops | 21 names installed, ran under three shells and were removed, 8 refused, as before. The script then stops with an error at its relative-`GROOPH_HOME` case: that name is now refused, so the settings file the script goes on to read was never written |
| `04-list.mjs` | 6 | 0 | |
| `05-readers.mjs` | 3 | 0 | |
| `06-clean-project.mjs` | 0 | 0 | |
| `07-project-layout.mjs` | 0 | 0 | 44 of 44 cases byte for byte against `origin/main` (`da6c3874`) built from source by the reader; 68 of 68 project-layout hook calls wrote the same lines |
| `08-kill.mjs --times 250` | 2 emptied of 250 where the folder takes no new file | 0 of 250 (refused: 250 as they were) | limits: 2 of 250 killed installs left a `settings.json.<pid>.grooph-tmp` beside the settings; 1 of 250 killed `watch` commands left its lock, and the next `watch` then took 4.9 s and worked |
| `09-home-collision.mjs` | 2 | 0 | |

## The races, again (`out-races.txt`)

Eight hooks at a time; "outside" is lines or files anywhere but the record.

| Race | Layout | Calls | Outside |
|---|---|---|---|
| a folder swapped for a link, at the listed folder's own, attacker `node` / `swap` | outside the project | 2,000 / 2,000 | 0 / 0 |
| the same at `<grooph's folder>/events` | outside the project | 2,000 / 2,000 | 0 / 0 |
| a second name for a file with other contents | outside the project | 4,000 | 0 |
| a second name for a file that begins as an events file does | outside the project | 4,000 | 17 |
| a second name for an empty file | outside the project | 4,000 | 12 |
| a pipe at the session's file | outside the project | 600 | 0, and 0 bytes into the pipe |
| a folder swapped for a link at `.grooph/events`, `node` / `swap` | in a project | 2,000 / 2,000 | 0 / 0 |
| a second name: other contents / begins as an events file / empty | in a project | 4,000 each | 0 / 8 / 13 |
| a pipe | in a project | 600 | 0 |

No call hung, printed or exited non-zero. The script's own warning in that file ("the build changed while this ran") is the lane's rebuild after a change to help text; the hook's file did not change during the run.

What was not answered by a change, and why, is in the handback beside this folder.
