# The runs' records

One folder per harness, and in it one folder per session: `claude-code/rehearsal/`, `claude-code/run/`, and later `codex/…`. A session's folder is made **before** the session is started ([`../PROTOCOL.md`](../PROTOCOL.md) §4; decision 0015), with a row in [`../ledger.json`](../ledger.json).

| File | Written | By | What |
|---|---|---|---|
| `setup.txt` | before the session starts | `setup/start-claude.sh` | the session's id and where its transcript will be, the folder and its first commit, the spec's checksum, the freeze, the models, the harness's version, the machine, the browsers installed, whether Blender is there, the path the session is given, the command, who runs first |
| `profile-settings.json` | before the session starts | `setup/start-claude.sh` | the profile's settings file, as it was |
| `owner-notes.txt` | as it happens | the owner | when "start" was answered; anything asked in the middle and the one line given; a pause for a usage limit and its length; the wall; what `/cost` printed |
| `after/run-folder/` | after | `setup/record.sh` | `.grooph/arena/runs/<id>/` from the game's folder: `notes.jsonl`, `PROGRESS.md`, the working copy of the graph |
| `after/events/` | after | `setup/record.sh` | what the event hook wrote: ids, names and times |
| `after/commits.txt`, `tags.txt`, `uncommitted.txt` | after | `setup/record.sh` | every commit with its time; the tags; what was left uncommitted |
| `after/transcript.txt` | after | `setup/record.sh` | where the transcript is, its size and checksum. The transcript itself stays on the machine |
| `after/models.txt` | after | `setup/record.sh` | which models answered, as the transcripts name them |
| `after/held-out-checks-seen.txt` | after | `setup/record.sh` | whether the checks' path or file names appear in any transcript of the session |
| `after/refusals.txt` | after | `setup/record.sh` | what was refused: a permission, a host, a read |
| the checks' three outputs, the result commit | after | `setup/score.sh`, a later slice | |

Nothing has been run: no folder is here yet.
