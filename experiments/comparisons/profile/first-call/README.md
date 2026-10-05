# The first paid call

**Written on 2026-10-05, before the call. Nothing here has been run.** One short session from the comparison profile, to show what no check can show without a session, before anything else is run from that profile. It is paid, it is recorded like any run, and it is on the comparisons ledger. The runner stops after it: the driver is told what it showed. **Every paid runner after it refuses to start unless this call's latest record says it may.**

## What it asks

The session is given [`prompt.md`](prompt.md) and the folder [`task/`](task/). It is told plainly that this is a check of its environment, that some steps are expected to fail or be refused, and to do each once and go on. Eleven steps: a command that fails by design; `ls /tmp`; a command writing under `closed/`; the Write tool on `closed/` and on `open/`; `curl`; a subagent told to try the same two writes and one command; `git push`; `ls ../..`, the folder where every session's folder is made; and one passing test run twice, by `node --test` and by `npm test`.

## What has to hold before anything else is run

Each is read by the runner from the folder and the transcripts, never from the session's reply. All of them are needed: the script's `may_the_pair_run` is true when every line it prints holds and nothing went wrong keeping the record, and for no other reason. The script prints thirteen lines; rows 2 and 5 below are two lines each.

| | What has to hold | How it is read |
|---|---|---|
| 1 | The session started and ended itself | the harness's result |
| 2 | The lead ran on `claude-opus-5-5` and on nothing else, and its one subagent on `claude-sonnet-5-5` and on nothing else | the models in each transcript |
| 3 | It was given no skill, no server and no instruction file | what the session was given at its start, read from its transcript (`loaded.txt`). A transcript that holds no entry of what was loaded says nothing either way: that is a look that was not made, and it does not hold |
| 4 | Every step was tried, by the lead and by the subagent | each command and each write is in the digest. A file that is absent because nobody tried to make it shows nothing |
| 5 | None of the four files it was asked to make under `closed/` exists, and `closed/keep.txt` is byte for byte what it was | the folder |
| 6 | Each write to `closed/` came back as an error: both by the file tool, and both by a command | the digest |
| 7 | Both files under `open/` exist | the folder: the walls are around `closed/` and not around everything |
| 8 | A command could not list `/tmp`, could not list the folder above its own, and could not reach the network | each result is an error |
| 9 | A failed command's result puts the command's output on a line of its own | the result of the command that fails by design |
| 10 | A test suite runs inside the sandbox | `node --test` and `npm test` on one passing test each came back without an error. The runs after this one are told to make `npm test` pass; a suite that cannot run there would be read as a session's failure |
| 11 | The transcripts are where the runner looks for them, and the harness's result has the shape the runner reads | a transcript for the lead and one for the subagent were found by the session's id; the result holds a cost, a session id that is the one chosen, and the models used |

If any of these does not hold, nothing else is run. What is wrong is fixed in the profile or the runner, that fix is read, and this call is made again as a second attempt with its own record.

## What this call cannot show

- **What the watchdog's limit of minutes does to a real session.** It is tested against a stand-in that ignores being asked to end; a real session is ended that way only when one overruns.
- **Whether a script that opens a file itself could write under `closed/`.** The command tried here is `touch`.
- **That npm keeps to its own cache folder.** `npm test` is run once and has to pass; what npm read on the way is not looked at.
- **Anything about a session that is not asked.** This one is told what to try. A wall nobody leans on shows nothing.

## What is kept, and what is kept out

The record holds the first 300 characters of a result **only where the result is an error**: those are the harness's and the sandbox's own messages, and what a refusal looks like is one of the things this call is for. **Where a step that should have been refused was not, nothing it printed is kept**: a listing of `/tmp` or of another folder is not for the repository. Every file of the record is then passed through the same scrub as every other record of the paid path: the home folder's path becomes `~`, and an e-mail address is taken out. The harness tells a session the account's e-mail address at its start; `loaded.txt` would hold it otherwise.

## What it costs

A lead that makes about thirteen calls and a subagent that makes four. By study two's figures, between fifteen and forty cents. Its watchdog is $1.00 and ten minutes.

## How it is run

```bash
node scripts/lib/profile-first-call-paid.mjs --dry-run
node scripts/lib/profile-first-call-paid.mjs --spend --go "<the driver's words>"
```

From a terminal, not from a tool with a time limit of its own. The record goes to `record/` beside this page (`record-2/` for a second attempt).
