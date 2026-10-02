# Handback 0044 · A stale record read honestly; sending at the end of a turn; version 0.2.1

**Branch:** `slice/0044-quiet-sessions` (stacked on 0043) · **Date:** 2026-10-01 · **By:** the operator-round session (Opus 5.5) · **Spend:** none

The Operator's cloud lane pushed its events in the middle of a turn. The end of that turn and the session's own end never left the sandbox, so the lane read "working" for good. It offered two ways out and left the choice here. Both are built, one always on and one only when asked for (amendment A-014, decision 0017).

## What changed

- **A session not heard from for half an hour is "last seen", not "working".** `isQuiet` in core; `sessionLine`, `mapLive` and `mapLiveLine` take the time the record was read. `grooph sessions` prints `last seen 3 h ago, working then · 1 not seen to finish, 1 done`; a map's card shows a grey ring and `last seen 3 h ago`; the app's live screen shows the same with no live dot. A session that ended is ended however long ago. The record itself is unchanged: `state` in the live view's JSON is what it was.
- **`grooph hooks install --push`** adds a second hook at the end of each turn that runs the push script in the background (`--push-branch <name>` to name the branch). In that mode the script waits a moment for the event hook's own line, prints nothing, always exits 0, and gives way to a push already under way (a lock folder beside the events, taken over after two minutes). Off unless asked for. `hooks status` says when it is on; `hooks remove` takes it out with the rest.
- **Version 0.2.1.**

## Verified

| Claim | How | Result |
|---|---|---|
| Fresh, a session is working; half an hour on it is last seen; ended is never quiet | `pnpm --filter @grooph/core test` | passes |
| The command line, the picture and the app say so | cli tests on a recording as recorded and moved to a minute ago; Playwright on the live screen read three hours later | pass |
| The turn-end push: silent, exit 0 whatever happens, one at a time, a dead lock taken over, never onto a branch of work, removed with the rest | `packages/cli/test/events-push.test.ts`, against real repositories | passes |
| A branch name cannot become a shell command | the same test: `--push-branch "x; rm -rf ~"` is refused and nothing changes | passes |

## An independent read

A subagent with no part in writing it reviewed the three commits and exercised the hook in scratch repositories. The turn-end push kept its promises of silence and exit 0 in every case it tried, and six runs at once left the branch sound. It also found seven things in the push and six in "last seen". Fixed, each with a test or a check:

- **git could ask for a password on a terminal nobody is at, and wait.** Unattended, git is now told never to ask.
- **No call had a time limit**, so a remote that never answers hung the hook, left git's helper running and left the lock in place. Every call to the remote has a limit, the whole run has a deadline, git is started in a process group that is stopped whole, and the lock is released when the harness stops the hook. Against a remote that never answers: 13.7 seconds, exit 0, nothing printed, no process left, no lock left.
- **A push that lost a race was never made again.** Two lanes on one branch, turns ending together: one was refused every time. It now looks again and goes on top, three tries. Tested by making the race happen with a hook on the remote.
- **`FETCH_HEAD` was rewritten every turn**, which a session that had just fetched something could trip over. The fetch now goes to a ref of grooph's own.
- **`--push-branch` accepted names that could never work** (`a..b`, `x.lock`, the branch checked out). They are refused at install, aloud.
- A lock with a time in the future wedged pushes until the clock caught up. Taken over now.
- **A plan's line still said "1 running"** in a session gone quiet; a family's card took its "last seen" from a member that had ended; a note from the lead did not count as hearing from the session; the offline page said "gone quiet" beside a picture saying "last seen 3 h ago"; the app's header and its cards used two clocks. All fixed.

Not changed, and said in the docs instead: with the default install a turn that runs past half an hour with no subagent writes nothing and reads "last seen"; `--tools` is the answer for lanes. And the turn-end hook runs in the background, so a run that exits the moment its turn ends may be gone before it finishes.

## Not verified

- **The turn-end push in a real harness session**, local or cloud. The script was run as a harness would run it; no harness ran it.
- Whether a cloud sandbox lets a background hook finish a push after the last turn of a session. If it kills the hook, the last turn is lost as before, and the reader's rule still holds.

## Decisions made here

- **Both, and the push opt-in.** The reader's rule is right whether or not anything is sent. The push uses a session's right to push, in someone else's repository, on every turn: that is asked for, not assumed.
- **No rate limit**, though the Operator suggested one. A push with nothing new makes no commit, and a limit would drop exactly the last turn, which is the one that matters.
- **The session's end is still not sent.** A hook that waits on the network as a session closes would slow or fail the close. After the last turn's push the session reads `waiting`, then `last seen`.
