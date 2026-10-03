# Handback 0050 · A turn's end sends its own session's files, and paths stay on the machine; the Operator's fifth answer; version 0.2.4

**Branch:** `slice/0050-send-only-this-session` · **Date:** 2026-10-03 · **By:** the operator-round session (Opus 5.5) · **Spend:** none

The Operator ran the second trial of the turn-end push with 0.2.3. Two cloud sessions ran at once, one with no branch checked out. Every turn's push arrived 2 to 5 seconds after the turn ended. Both sessions read `waiting` and, half an hour on, `last seen`. The session that started a branch mid-way showed once across both its branches.

The trial found one thing: both fresh sessions sent a file from a session of October 1. The cloud environment had kept it from an earlier sandbox. The Operator also asked the owner's leave before turning the push on, because the repository is public.

## What changed

- **At a turn's end, a file goes only if it has to do with this session.** The push reads the harness's hook input (standard input, until it is whole or for up to a second) to learn which session's turn ended. It then passes `--since <that session's first line>` and `--session <its id>`. A file goes when:
  - it is that session's own file, or the said-file its MCP server writes under the same id;
  - it has a line since that session began;
  - or the branch already holds it, so an earlier session's end and a subagent's late stop still arrive.

  A file left in a kept sandbox by a session that ran elsewhere does not go to a branch that never had it. Told no usable session, the push sends everything, as before. Both options also work by hand.
- **What leaves the machine carries a folder's name, not its path, and no transcript path.**
  - Each line is put in that form before it is sent; the files on the machine are unchanged.
  - The branch's existing copy is put in the same form before the two are joined, so a copy sent by 0.2.3 still joins line for line.
- **Only whole lines that are events are sent.** A line still being written waits for the next push. A line torn by a full disk is not sent.
- **Two versions writing one branch cannot leave an event on it twice.**
  - A line the branch holds twice (once with its path, once without) is kept once.
  - `grooph events push` and `grooph hooks status` say when the project's hook copy is not this version.
- **Read here and from the branch together, each event counts once.** The reader compares events in the form they are sent.
- "Sent N event files" now counts the files sent from here and says separately how many the branch holds.
- Messages say how many older files were left out.
- **Version 0.2.4.** Amendment A-016, decision 0019. `docs/HANDBACK-operator.md` section 16, with the full list of what an events branch holds; sections 1, 2, 4 and 7. `docs/subagents.md`: the cloud result, labelled reported.

## Verified

| Claim | How | Result |
|---|---|---|
| Told its session, the hook sends that session's file and a lead's note written during it, and leaves an October 1 session's file and an old note behind; its record says how many were left out | `packages/cli/test/events-push.test.ts`, real repositories and a bare remote | passes |
| An earlier session in the same clone that ended after its last push: the next session's push carries its end | the same | passes |
| A session whose clock stepped back (last line older than first): its own file still goes | the same | passes |
| A branch holding one event twice from two versions: the next push leaves it once; a torn line is not sent; local and branch read together count each event once | the same | passes |
| An out-of-date hook copy in the project is said by `events push` and by `hooks status` | the same | passes |
| Told a session with no file here, it sends everything; `--since` by hand does the same as the hook, and refuses a value that is not a time | the same | passes |
| A line with a user's home in its folder and a transcript path goes as the folder's name with no transcript; a half-written last line waits and goes when it is finished; a branch copy sent by an older version, with the full path, joins without a line twice; read elsewhere the session has its folder's name and its subagent once | the same | passes |
| Every earlier push test, with the fixtures' `/work/demo` now arriving as `demo` | the same | passes |
| Nothing else moved | `pnpm -r test`, Playwright, the install check | see the pull request |

## Not verified

- The new rule in a cloud session. Whether Claude Code gives an async hook its input on standard input there was not looked at directly. If it does not, the push sends everything, as 0.2.3 did, so nothing is lost either way.
- Codex's turn-end payload with `--push`: it carries `session_id` in its hook input, which is what the event hook already relies on, but the push has not been run by Codex.

## Decisions made here

- **Filter by time, not by name.** The rule could have been "send only the file named after this session". But a lead's notes through the MCP server go to a file named after an id the harness may not have given. A line written since the session began is what "this session's" means here.
- **Rewrite on the way out, not in the hook.** The event hook still writes what it wrote (A-012); the reader on the same machine can still use a full path. Only what leaves is smaller.
- **The publishing question is put, not answered.** grooph lists what a branch holds; the owner decides.

## Independent read

A fresh subagent read the change before it was pushed, with real scenarios against local remotes. Its worst finding was in the first version of the rule above. "Send only files with a line since this session began" meant an earlier session's last lines in the same clone were never sent: its end, a subagent's late stop, or a turn's end that missed its push. The remote would have shown that session as waiting for ever, and the record would have said all was well. Also found: two versions writing one branch could leave an event on it twice; reading the local folder beside the branch counted events twice; a clock step could leave a session's own file out; and smaller points about messages, help text and reading the hook input. All ten are fixed and tested here.
