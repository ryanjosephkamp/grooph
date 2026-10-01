# Review 0032 · The live view, checked from inside Codex

**Reviewer:** driver (the operator-round session, Opus 5.5) · **Date:** 2026-10-01 · **Branch reviewed:** `slice/0032-codex-live-check` at `ff65b9e` (work head `54bee68`) · **Verdict:** **proceed**, with the driver's own checks added and one step left for the owner

Codex handed back `blocked`, and said exactly why. It was right to. The fault was in the handoff, not in its work.

## What went wrong, and whose it was

The handoff told the owner to open Codex "in the folder `/Users/noir/Documents/grooph-codex`", where the driver had installed the hook entries in an untracked `.codex/hooks.json`. The Codex desktop app does not run a chat in the folder you point it at: it makes a git worktree of its own under `~/.codex/worktrees/` and works there. A worktree holds what git tracks. The hook file was not tracked, so it was not there, `/hooks` had nothing to show the owner, and nothing was recorded. **The driver's assumption, written into the handoff, was wrong.** Codex found the mismatch, refused to call it a hook failure, and did not work round it.

## Verified independently

| Claim in the handback | How it was checked | Result |
|---|---|---|
| The chat ran in `~/.codex/worktrees/7a29/grooph-codex`, detached at the baseline, with no Codex hook entries | `git worktree list`; `ls` of that folder | true: listed, detached at `1f9a8f2`, no `.codex/` |
| The intended folder had the seven entries and the hook script, with the checksums recorded | `shasum -a 256` on both files | both match `check.json` |
| No user-level hook exists that could have confused the result | `ls ~/.codex/hooks.json`; no `[hooks]` table in `~/.codex/config.toml` | none |
| Nothing under `~/.codex` was changed, no trust bypass used, nothing outside the allowed paths touched | `git diff --stat main...` against the handoff's lists | 16 files, all in `docs/subagents.md`, `docs/HANDBACK-operator.md`, the slice's In flight entry, `experiments/hooks/2026-10-01/**` and the handback |
| The record checks | `node experiments/hooks/check.mjs` | passes; the desktop chat's rows have no transcripts, as the ledger says |
| The documentation corrections | read against the saved copies of Codex's own pages and the 2026-09-30 records | accepted; three passages rewritten below after the new findings |

## What the driver ran, to answer what the desktop chat could not

Five `codex exec` sessions, one to a few turns each, recorded in `experiments/hooks/2026-10-01/` (rows `codex-3` to `codex-7`; streams saved as they ran, rollout checksums in the ledger). Nothing under `~/.codex` was edited. For three of them the Codex entries were installed in the main clone and removed afterwards.

| Criterion | Answer | Shown by |
|---|---|---|
| 1. Does a project's `.codex/hooks.json` load? | **Yes, in a folder the owner has trusted**, once the hook is reviewed or review is skipped for the run. Not in a folder that is not on his trusted list, and a one-run `-c` trust override does not count. An unreviewed hook is skipped without a word. | `codex-3`, `-4` (ignored), `codex-5` (loaded, session recorded), `codex-6` (skipped silently) |
| 2. Subagents are recorded | **Yes, from the project's own hook file**, in `codex exec`: two subagents, each with a start and a stop. Not seen in an interactive chat. | `codex-7` |
| 3. The MCP server from Codex | **Yes.** `grooph_plan`, `grooph_running` and `grooph_note` were called natively and returned; the live view showed the plan as 2 of 2 started with the note. Attached for one run by `-c`; nothing saved. | `codex-7` |
| 4. Review of the Codex half of `docs/subagents.md` | Done by Codex, statement by statement (`codex-statement-review.md`). Accepted. | the handback |
| 5. The record | Complete for the five headless sessions. For the owner's desktop chat it holds what Codex could see; its transcripts were not read, by Codex or by the driver. | `ledger.json` |
| 6. Build and tests | `pnpm -r build && pnpm -r test`: core 323, cli 83, web 54 | run at reconcile |

**Still not seen, by anyone:** a hook the owner reviewed in `/hooks`, then running in an interactive Codex chat. Everything else the slice asked is answered.

## What the check found out that nobody asked

- **The 2026-09-30 mystery is solved.** "A project-level `.codex/hooks.json` was not seen loading" was because that scratch folder was not one Codex trusted. The file format grooph writes is right.
- **Codex gives an MCP server no session id.** The plan is joined to the session that most recently started in the same folder. Two Codex sessions planning in one folder at the same moment could be crossed. Noted in `docs/subagents.md` §7; not fixed.
- **`grooph hooks remove --harness codex` leaves an empty `.codex/hooks.json` behind** when grooph's were the only entries. Harmless; noted, not fixed.

## Changes made at reconcile

- `docs/subagents.md`: the two kinds of trust Codex needs and what was seen of each; the desktop paragraph rewritten to say what happened and what to do (commit the file); §7 says the MCP tools work from Codex; the summary table's row answered. One inherited sentence corrected: without `--tools`, the spawn tool is recorded in Claude Code only.
- `docs/HANDBACK-operator.md`: the Codex setup line now starts with "commit the hook file", and the known limit says what is and is not seen.
- `grooph hooks install --harness codex` now prints the three things that leave `grooph sessions` empty without a word from Codex (review, a trusted folder, a committed file). The help says the same. One test line.
- `experiments/hooks/check.mjs`: the summary line counts sessions, not rows, and no longer prints a Claude Code dollar total for a day with no Claude Code session (Codex pointed out both in its handback).
- `experiments/hooks/2026-10-01/`: five run folders, ledger rows, the README's second half; `records-sha256.json` regenerated to cover them.

## Deviations

All four accepted. Working from the app's worktree was not Codex's choice; leaving transcripts unread and the MCP test unrun without the owner's answer was the handoff's own rule, kept.

## Decisions

- **For the Codex app, hook entries have to be committed.** Recorded in `docs/subagents.md`. Whether grooph's own repository carries `.codex/hooks.json` stays the owner's decision and is asked in `docs/PROGRESS.md`.
- **A handoff to Codex names what the owner will see, not a folder to open.** The Codex section of `handoffs/README.md` now says the app works in its own worktree, so anything Codex needs must be on the branch.

## For the owner

1. Say whether this pull request may be merged.
2. Say whether grooph's repository should carry the Codex hook entries (recommended: yes; it is what makes the next step possible in the app).
3. Then, once: open a Codex chat on grooph, type `/hooks`, review grooph's entries, start a new chat, ask for anything, and run `grooph sessions` in the folder Codex worked in. That is the one thing still unseen.
4. Codex asked to copy its own chat's transcript into the record. Yours to allow or not; the review does not depend on it.
