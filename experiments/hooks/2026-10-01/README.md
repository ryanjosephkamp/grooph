# Codex desktop live-view check, 2026-10-01

Slice 0032 checked one owner-opened chat (`01a0f5e4-e4bc-7120-8657-ad009213b886`) and its two trivial agents. The two check folders refer to that same chat. Both agents completed; the intended project's live view stayed empty. `events.jsonl` is deliberately empty in each folder because no hook-written file existed to copy; it is not a synthesized recording.

The chat ran in `/Users/noir/.codex/worktrees/7a29/grooph-codex`, a detached worktree. The requested slice worktree `/Users/noir/Documents/grooph-codex` was at the same baseline on `slice/0032-codex-live-check`, with seven Codex hook entries in its untracked `.codex/hooks.json`. All repository changes were made in that requested worktree. The pre-existing `.codex/` remains uncommitted.

The owner reported that he could not find grooph's hooks. Project trust and hook trust were not granted or changed by the implementer. No trust bypass was used. This does not prove that trusted project hooks fail in the intended folder.

`observations.json` preserves actual command output; `check.json` describes the observation's limits. `ledger.json` expressly marks transcript/model evidence incomplete. Permission was requested to read and copy only this chat's and its agents' rollout files into ignored `local/`; no answer had arrived at handback preparation, so none was accessed. Native Codex MCP attachment likewise remains untried pending the separate one-session permission request. There were no new command-started model sessions.

`node experiments/hooks/check.mjs 2026-10-01` can verify these record files, but its `0/0` transcript result cannot satisfy the transcript criterion. The historical all-days check was not run because it reads old `~/.codex` rollouts beyond the pending permission scope. No cost or billing amount was observed; the ledger omits the cost field, as existing Codex rows do. The checker prints its fixed subscription label and a Claude Code total; those are not a measured Codex dollar amount.

The Codex statement audit is `codex-statement-review.md`; exact changed passages are in `document-changes.json` and the handback. Build/test was not required because code did not change.
