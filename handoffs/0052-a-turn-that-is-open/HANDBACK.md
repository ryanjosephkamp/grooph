# Handback 0052 · A turn that is open is sent as open; the Operator's sixth answer; version 0.2.5

**Branch:** `slice/0052-a-turn-that-is-open` · **Date:** 2026-10-03 · **By:** the operator-round session (Opus 5.5) · **Spend:** none

The owner said yes to the lanes publishing their events, and the Operator put the hooks on the other project's default branch with 0.2.4. Four lanes and one runner sent 163 lines. The Operator read every one: nothing was sent that should not have been, and no push failed. It asked me to weigh three things:

- subagents in the lanes leave only a stop line;
- a lane in a long turn reads as idle;
- one lane that merged the hooks in mid-session never recorded.

## What changed

- **The push also runs at a turn's start.** A reader elsewhere now sees `working` as soon as a turn opens.
- **The push also runs in passing, at most every ten minutes.** It hangs on each finished tool call the event hook records: every one with `--tools`, only the one that starts a subagent without. `--every 600` makes the script do nothing unless the last push is that old. It reads one file's time and exits.
- **A push at a turn's start or end waits** up to twenty seconds for one under way, then sends. One made in passing gives way.
- **`--status` on the push script** says what a sandbox has, with no grooph in it. Asked from a session working in another folder, it says so and does not speak of that session. It prints:
  - which settings hold the hooks;
  - whether the event hook runs (tried once, into a scratch folder);
  - what this session has recorded;
  - how the last push went.

  `grooph hooks status` gains the "this session" line too.
- `grooph hooks status` says how many entries send, and tells a 0.2.4 install how to get the rest.
- **No code change for the subagent lines.** They are the harness's own helper, and the reader already leaves them out. The documents now say so, with Claude Code's documentation and this session's own record.
- **Version 0.2.5.** Amendment A-017, decision 0020. `docs/HANDBACK-operator.md` section 17 and sections 1, 2, 4, 7 and 11; `docs/subagents.md`.

## Verified

| Claim | How | Result |
|---|---|---|
| With `--push`, the same push command is on `UserPromptSubmit` and `Stop`, and on `PostToolUse` with `--every 600` under the event hook's own matcher; Codex without `--tools` has no in-passing entry; a 0.2.4 install is named as older and upgraded by installing again | `packages/cli/test/events-push.test.ts` | passes |
| A turn's start is sent, and read elsewhere the session is `working` | the same, real repositories and a bare remote | passes |
| In passing, nothing happens while the last push is fresh (no fetch, no commit, the record untouched); ten minutes on, the next tool call sends; the one after is quiet again | the same | passes |
| In passing a push gives way to one under way; at a turn's end it waits for it and then sends the turn's last lines | the same, with the lock held and released after 1.5 s | passes |
| `--status`: the entries, the hook run into a scratch folder with nothing added to the project, a session that has recorded and one that has not, the last push, a project with no settings; `grooph hooks status` says the same of the session it is run in | the same | passes |
| A subagent started in the background leaves a start, an `Agent` line and a typed stop; a stop with no type follows each turn's end and has no start and no transcript | this session's own event file ([record](../../experiments/hooks/2026-10-03/)) | 7 of 7; 19 of 20 within 4.5 s of one of 19 turn ends |
| A `UserPromptSubmit` command hook may run in the background; a background hook gets its input on standard input; its time limit is not enforced; settings edits are "normally" picked up; helper agents' stops have an empty type | Claude Code's hooks reference, read 2026-10-03 | documented |
| Nothing else moved | `pnpm -r test`, Playwright, the install check | see the pull request |

## Not verified

- The turn-start and in-passing pushes run by a harness. Everything above ran the script as a harness would, from a shell.
- Why one lane did not take up hooks that arrived mid-session.
- A session that itself runs as a named agent (see decision 0020, point 6).

## Decisions made here

See decision 0020. In short: wait at a turn's start or end and give way in passing; throttle on the record's own time, so a remote that is down is tried every ten minutes and not after every tool call; a fixed ten minutes with no option.

## Independent read

A fresh subagent read the change before it was pushed and drove it against local remotes. It found nothing serious: in every placement the hook printed nothing, exited 0, released its lock and ended inside 46 seconds. It found fifteen smaller points.

Fixed, with tests:

- `--status` told a session working in another project that it had recorded nothing here.
- `--status` could stop on a missing scratch folder or an events folder that is not one.
- `--status` printed a record's times as it found them.
- Several tool calls ending in the same moment each went as far as the lock; an in-passing push now looks again once it holds the lock.
- A record dated in the future silenced in-passing pushes.
- The throttled path left the harness writing into a closed pipe; the input is now read to its end.
- With no events folder, each tool call cost a process that waited a second and a half.
- Wording that called every hook push "at a turn's end", and that was wrong for Codex without `--tools`.
- An older test now waited twenty seconds for a lock.

Left as they are, and said:

- **A turn's end that gives up waiting leaves no word of its own.** That takes a push stuck for more than twenty seconds while it holds the lock. The stuck push says how it went, and the lines go with the next push.
- **Two pushes that both find a lock more than two minutes old can both take it.** This was read, and not reproduced in thirty rounds of twelve processes. Two pushes from one clone are safe in git's terms.
