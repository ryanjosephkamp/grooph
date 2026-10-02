# Codex desktop live-view check, 2026-10-01

Slice 0032 checked one owner-opened chat (`01a0f5e4-e4bc-7120-8657-ad009213b886`) and its two trivial agents. The two check folders refer to that same chat. Both agents completed; the intended project's live view stayed empty. `events.jsonl` is deliberately empty in each folder because no hook-written file existed to copy; it is not a synthesized recording.

The chat ran in `/Users/noir/.codex/worktrees/7a29/grooph-codex`, a detached worktree. The requested slice worktree `/Users/noir/Documents/grooph-codex` was at the same baseline on `slice/0032-codex-live-check`, with seven Codex hook entries in its untracked `.codex/hooks.json`. All repository changes were made in that requested worktree. The pre-existing `.codex/` remains uncommitted.

The owner reported that he could not find grooph's hooks. Project trust and hook trust were not granted or changed by the implementer. No trust bypass was used. This does not prove that trusted project hooks fail in the intended folder.

`observations.json` preserves actual command output; `check.json` describes the observation's limits. `ledger.json` expressly marks transcript/model evidence incomplete. Permission was requested to read and copy only this chat's and its agents' rollout files into ignored `local/`; no answer had arrived at handback preparation, so none was accessed. Native Codex MCP attachment likewise remains untried pending the separate one-session permission request. There were no new command-started model sessions.

`node experiments/hooks/check.mjs 2026-10-01` can verify these record files, but its `0/0` transcript result cannot satisfy the transcript criterion. The historical all-days check was not run because it reads old `~/.codex` rollouts beyond the pending permission scope. No cost or billing amount was observed; the ledger omits the cost field, as existing Codex rows do. The checker prints its fixed subscription label and a Claude Code total; those are not a measured Codex dollar amount.

The Codex statement audit is `codex-statement-review.md`; exact changed passages are in `document-changes.json` and the handback. Build/test was not required because code did not change.

## Added at reconcile: five headless sessions

The driver session (Claude Code) read the handback and then answered what the desktop chat could not, with five short `codex exec` sessions on the same day. Each has its exec stream saved to a file as it ran, the hook's events where there were any, and a ledger row with its session id, tokens, and its rollout's path and checksum. The rollouts are copied to `local/`, which git ignores.

| Run | Folder | Question | Answer |
|---|---|---|---|
| `codex-3-exec-project-hooks-bypass` | Codex's folder (not in the owner's list of trusted folders) | With hook review skipped for the run, does the project's `.codex/hooks.json` load? | No. Nothing was recorded. |
| `codex-4-exec-project-hooks-trust-override` | the same | And with the folder marked trusted for that run only (`-c projects."…".trust_level`)? | No. |
| `codex-5-exec-trusted-project-bypass` | the main clone, which the owner's `~/.codex/config.toml` already lists as trusted | The same question in a trusted folder | **Yes.** The hook recorded the session's start, turn and end. |
| `codex-6-exec-trusted-project-no-bypass` | the same | Without skipping review, does a hook nobody has reviewed run? | No, and Codex printed nothing about it. |
| `codex-7-exec-mcp-plan-subagents` | the same | With grooph's MCP server attached for the run: plan, two subagents, running, note | **All worked.** Three tool calls returned; the hook recorded both subagents; `grooph sessions` showed the plan as 2 of 2 started with the note. |

For runs 5 to 7 the Codex entries were installed in the main clone with `grooph hooks install --harness codex` and removed afterwards; nothing under `~/.codex` was edited, and the MCP server was attached by a `-c` override that is not saved. `mcp-server-env.json` in run 7 is what a small wrapper saw before starting the server: Codex gave it no variable naming the session.

What this leaves unseen: a hook reviewed by the owner in `/hooks` and then running in an interactive chat, in the CLI or in the app.

## Added on the owner's word: the desktop chat's transcripts

Codex asked to copy its own chat's transcripts into the record and waited for an answer. The owner said yes on 2026-10-01. Four files are now in `local/codex-1-interactive-project-hooks/` (not in git), with their checksums in the ledger: the chat, its two subagents (`/root/readme_word`, `/root/hello_check`), and a fourth thread the app started itself, which its header calls `guardian` and which ran on `codex-auto-review`. Only the headers were read. They settle what the handback had to leave open: the chat was **Codex Desktop**, its header gives CLI version **0.159.2**, and the chat and both subagents ran on **gpt-6.1-sol at effort xhigh**, in `~/.codex/worktrees/7a29/grooph-codex`.

## The last piece: a reviewed hook in a desktop chat

After the hook file was committed (pull request #12), the owner opened the Codex CLI in the repository, saw grooph's six entries in `/hooks` and trusted them. He then opened a Codex Desktop chat on the same folder, run locally and not in a worktree, and asked for two subagents. **The hook recorded it**: the session, its turn, and both subagents with a start and a stop each. The record is [`codex-8-desktop-local-reviewed-hook/`](codex-8-desktop-local-reviewed-hook/); `check.json` says what was seen and what was not.

Two other things turned up in the same folder's events. A second session id began half a second after the chat, ran one turn and has no transcript file: a thread the app started for itself, which the hook cannot tell from a real session. And a lone session end from 27 seconds earlier, which fits the CLI session where the hooks were trusted. Neither was established beyond that.

Not seen then: the app's worktree mode, and a session's end from the app.

## And in worktree mode

The owner ran the same prompt once more with Worktree chosen. The app made its own copy at `~/.codex/worktrees/7a32/grooph`, at the commit that carries the hook file, and **the hook recorded the chat there too**, with both subagents ([`codex-9-desktop-worktree-reviewed-hook/`](codex-9-desktop-worktree-reviewed-hook/)). He reviewed nothing again: the review done once in the CLI, and the folder's trust, carried into the app's copy. The events are in that copy's own `.grooph/events/`, so they are read with `grooph sessions ~/.codex/worktrees/7a32/grooph`.

The app reported 1 min 46 s for this run against 11 s locally. The hook's own timestamps say where it went: 43 s before the turn began, 49 s more before the first subagent started, and 6 s per subagent against 1 to 2. The hook is the same in both runs and only appends a line, so it is not the cause; what the app was doing in those gaps was not established.

## Reported, not recorded here: the hook in a cloud session

The one place this session cannot watch is a cloud sandbox on the owner's other account. The Operator session ran the check there on 2026-10-01 and reported it; nothing of that run is in this folder or in the ledger, because it was not this session's to record.

As reported: on a throwaway branch of the other project's repository, never merged, the Operator installed the hook with grooph 0.2.0, committed the three files and ignored `.grooph/events/`. A fresh Claude Code cloud session (Sonnet 5.5) with that one repository started one `general-purpose` subagent, then ran `node .grooph/hooks/grooph-events-push.mjs` with no options. The events file held six lines: session start, turn start, the subagent's start and stop, the spawn tool, and a second turn start. The push went through at once to `grooph-events/<the lane's branch>`: one commit holding only `.grooph/events/`. `grooph sessions <name>=git:origin/grooph-events/<that branch>` read it from another machine. The session spent about $0.42, as the Operator reported it.

What it showed that the tests here could not: a cloud sandbox may push a branch other than the one a session works on; and a push is a snapshot, so what the session did after it (the end of its last turn, its own end) never left the sandbox.
