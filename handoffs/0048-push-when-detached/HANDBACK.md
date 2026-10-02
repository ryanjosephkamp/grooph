# Handback 0048 · A push is never dropped without a sign; the Operator's fourth answer; version 0.2.3

**Branch:** `slice/0048-push-when-detached` · **Date:** 2026-10-02 · **By:** the operator-round session (Opus 5.5) · **Spend:** none (no model session was started)

The Operator tried the turn-end push (`grooph hooks install --push --tools`) in a fresh cloud session. Nothing arrived and nothing said why. It found the cause and reproduced it: a cloud session starts with no branch checked out, the push had no name for its branch and threw, and the hook swallowed the error by design. Its test runners always work on a bare commit, so they would never have sent anything. It asked for three things; all three are done, and the measurement turned up two more.

## What changed

- **With no branch checked out, the events go to `grooph-events-detached`.** By hand and as a hook alike. One fixed name that every such checkout shares.
- **The push leaves a record**: `.grooph/events/.last-push.json`, never sent and not an event. That a push began; then that it arrived (and on which try), or what git said, how many have failed in a row and since when, and when one last arrived. `grooph hooks status` says it. `grooph sessions`, run on a project, ends with it when the last push failed or one never finished.
- **A refused push goes again for as long as its time allows**, where it gave up after three tries. A refusal counts as a race only when the branch moved and the remote's own words did not decline it; any other stops after three. A fetch that fails is a failure, not "no such branch". A push that runs out of time says so, and says when other sessions were the reason.
- **A session held on two events branches is read as one.** Each line is counted once; the session is shown under the source that holds the most of it. Before, every event was counted twice (a subagent's stop doubled and read as "resumed 1×").
- **An events commit is made as `grooph <grooph@localhost>`**, not with the session's git identity.
- A password in a remote's address or a token in what git said is not kept in the record, and what is kept is one plain line.
- The push does not run the repository's own `pre-push` hook, works in a clone made without file contents, and names its branch from the branch HEAD is on, born or not.
- A link among the events is never followed, and a `.grooph/events` that is a link sends nothing. (Older than this change: a link a pull request added would have sent whatever it pointed at.)
- **Version 0.2.3.** Amendment A-015, decision 0018. `docs/HANDBACK-operator.md` section 15 and the corrected sections 4, 6, 7 and 11; `docs/subagents.md` section 6.

## Verified

| Claim | How | Result |
|---|---|---|
| A clone with HEAD detached, the committed `--push` hooks, a turn's end: the events arrive on `grooph-events-detached`, silently, exit 0, nothing in the clone touched; the commit is by `grooph` though the clone has another identity | `packages/cli/test/events-push.test.ts`, real repositories and a bare remote | passes |
| The same session then starts a branch: its whole file arrives on that branch's events branch; read from both branches, in either order, it is one session identical to reading the one branch | the same test | passes |
| A push that fails at a turn's end prints nothing, exits 0, and is on record with the reason, the count and the last arrival; `hooks status` and `sessions` say it; the next push that works clears it; the record is never on the events branch; `--json` is unchanged | the same file | passes |
| A push stopped dead leaves "began", reported as under way inside a minute and as never finished after | the same file | passes |
| A remote that declines every push is asked exactly three times; its reason is what is kept, as one plain line with no token in it; a password in a remote's address is not kept | the same file, with a counting `pre-receive` | passes |
| A race that really happens (the remote lets another clone in between this one's fetch and its push): the second try arrives, and the record says so | the same file | passes |
| An unborn branch, a branch with a tag of its name, a clone made without file contents, a repository with a failing `pre-push` hook, a record file that is garbage or a folder | the same file | passes |
| The time limit stops git and its helper under `sh` and under `dash` with no terminal, in 2.0 s for a 2 s limit, nothing left running; a call that ends in time keeps its output and exit code and leaves no timer | a scratch script run by hand | seen |
| A branch name git can never make (`grooph-events/fix/abc` beside `grooph-events/fix`) stops after three tries with git's reason; a real race against a remote called `access-denied.git`, on a branch called `issue-403`, goes on top | the same test file | passes |
| A link among the events, and an events folder that is a link: nothing behind them is sent | the same test file | passes |
| Ten sessions, one branch, started in the same instant with the command the installed settings hold, half of them detached: all ten arrive, one commit each, every file whole, each record says on which try | the same file | passes |
| The same against GitHub | `experiments/hooks/shared-branch.mjs --remote …`, on this repository, a branch deleted afterwards | 10 of 10, the last after 25.0 s on its tenth try (23.9 s and 24.6 s in the runs before the reviews' fixes) ([record](../../experiments/hooks/2026-10-02/)) |
| Past the ceiling the ones left over fail and say why | the same script, twelve sessions, 5 s a round | 8 arrived; 4 recorded `no time left after 8 tries: other sessions kept sending to … first` |
| Nothing else moved | `pnpm -r test`, Playwright, the install check | see the pull request |

## Not verified

- **The turn-end push run by a harness in a cloud session.** Everything above ran the script as a harness would, from a shell. Whether a cloud sandbox lets a background hook finish after a turn ends, and whether it may push `grooph-events-detached`, is the Operator's next trial.
- Sixteen sessions at one instant on GitHub. The ceiling is worked out from the measured 2.5 s a round. Twenty-six at once against a remote on the Mac all arrived.
- Windows.

## Decisions made here

- **One shared name, not one per session.** The Operator suggested the `--push-branch` name or one from the session id. A name per session never collides, but leaves a branch per session that a reader must discover before it can read. A shared branch needs a push to go again when beaten, which it now does, and that was measured.
- **The record is a file, not an event.** A new kind of event would travel with the next push and show everywhere, but the event file is the hook's (A-012: ids, names and times), and a failed push is a fact about a clone, not about a session.
- **The same fallback by hand as in the hook.** The Operator's reproduction showed the two behaving differently (exit 1 against silence); now both send to the shared branch, and the by-hand message says that is what happened.
- **`grooph`, not the session's identity, on an events commit.** Found by the measurement: GitHub refused ten pushes that carried the owner's private address. Nothing reached the remote.

## Surprises

- The first real-remote run failed completely, and the new record is how that was seen: each of the ten said `push declined due to email privacy restrictions`.
- An events branch starts no CI run: it holds no workflow file.

## Independent read

A fresh subagent read the change before it was pushed, built scenarios against local remotes, and reported nineteen points, none destructive. A second read of the parts rewritten for them found nine more, the worst a permanent refusal counted as a race (106 pushes in one turn's end). Decision 0018 lists both. All but three are fixed here. Left as they are, and said: a parse problem present in two sources is reported twice; worktrees of one repository that send to the *same* branch share one fetch ref (harmless: at worst one more try); there is no test of the out-of-time messages other than the measurement.
