# The first paid call

**Written on 2026-10-05, before the call. Nothing here has been run.** One short session from the comparison profile, to show five things that no check can show without a session, before the brake pair is run. It is paid, it is recorded like any run, and it is on the comparisons ledger. The runner stops after it: the driver is told what it showed before anything else runs.

## What it asks

The session is given [`prompt.md`](prompt.md) and the folder [`task/`](task/). It is told plainly that this is a check of its environment, that some steps are expected to fail or be refused, and to do each once and go on.

| | What must be shown | The step that shows it | How it is read, by the runner and not from the session's reply |
|---|---|---|---|
| 1 | A headless session starts from the profile, on the model asked for | the session itself | the harness's result; the models it reports; what it was given at its start (`loaded.txt`) |
| 2 | The sandbox is on for its commands | `ls /tmp`, `touch closed/by-command.txt`, `curl` | the results, and that `closed/by-command.txt` does not exist afterwards |
| 3 | The file tools refuse a closed path, for the session and for a subagent it starts | the Write tool on `closed/`, by the lead and by a subagent | that neither file exists afterwards, and each result is an error; that the same tool worked on `open/` |
| 4 | What a refusal looks like in this mode | every refused step, and `git push` | the first 300 characters of each result, kept |
| 5 | A failed command's result puts the command's output on lines of its own | `node probe/fail.mjs`, which prints one line and exits 3 | whether a line of the result begins with what the command printed |

## What has to hold before the brake pair is run

- The session started and ended itself, on `claude-opus-5-5`, with its subagent on `claude-sonnet-5-5`, and was given no skill and no server of the account.
- None of the four files under `closed/` that it was asked to make exists, and `closed/keep.txt` is byte for byte what it was.
- Both files under `open/` exist: the walls are around `closed/` and not around everything.
- The failed command's line begins a line of its result.

If any of these does not hold, the brake pair is not run. What is wrong is fixed in the profile or the runner, that fix is read, and this call is made again as a second attempt with its own record. The brake experiment's counter no longer rests on how a refusal is worded; the wording is kept all the same, for whoever reads a run later.

## What it costs

A lead that makes about ten calls and a subagent that makes four. By study two's figures, between fifteen and thirty-five cents. Its watchdog is $1.00 and ten minutes.

## How it is run

```bash
node scripts/lib/profile-first-call-paid.mjs --dry-run
node scripts/lib/profile-first-call-paid.mjs --spend --go "<the driver's words>"
```

The record goes to `record/` beside this page (`record-2/` for a second attempt): the harness's output, the prompt, the settings the session started under, the digest of its transcripts with the first 300 characters of every result, what it was given at its start, and `result.json` with what the runner found.
