# Handback 0031 · The evidence, the working rules, and what the kit asked for

**Branch:** `slice/0031-evidence-and-policies` (stacked on 0030) · **Date:** 2026-09-30 · **By:** the operator-round session (Opus 5.5) · **Spend:** none

## What this slice is

The owner's second message of 2026-09-30: he asked whether the experiments were really run and what they cost, asked for records he can check, set how merging and gate pages work, asked for Codex handoffs, and attached the kit the Operator wrote. This slice answers with files.

## What changed

- **`experiments/hooks/`**: a record of the ten sessions run for slices 0027 and 0028 (five Claude Code, five Codex): each session's printed result, the hook's events, a `ledger.json` with session ids, tokens, cost and each transcript's path and SHA-256, and `check.mjs`, which checks the ledger against the transcripts on the machine. Transcripts are copied to a `local/` folder that `.gitignore` keeps out of git.
- **What a person carries by hand is said** (the kit: flag "anything that depends on you relaying by hand"). `mapShape().byHand`; `grooph validate <map>` lists each such handoff after the issues, and `--json` carries the list; `grooph_validate` returns it; the app shows it in the map's details. It is not a warning: a map that admits it is a true map and still validates clean (`docs/operation-map.md` §3).
- **A session's graph link opens** (the kit: "a node can open its own loop graph"). In the app, a session whose `graph` is a web link shows "Open its graph".
- **`docs/HANDBACK-operator.md`**: nine questions for the Operator (§8), where the evidence is (§9), how to answer (§10); the branch to use is now this one.
- **Decision 0015**: the working rules. **`handoffs/README.md`**: Codex as an implementer. **`handoffs/0032-codex-live-check/HANDOFF.md`**: the first Codex slice, drafted, waiting on the owner.

## Verified

| Claim | Command | Result |
|---|---|---|
| The ledger matches the transcripts on this Mac | `node experiments/hooks/check.mjs` | 10 sessions, 36 of 36 transcripts match; Claude Code reported $0.8485 in all |
| The three event fixtures are those recordings | a script comparing each fixture with its run's `events.jsonl` (and `said.jsonl`) | identical apart from paths |
| No e-mail address, key or token in the committed record | `grep` over `experiments/hooks/` outside `local/` | none; `/Users/noir` appears in paths, as it already does in `AGENTS.md` |
| Core, CLI, web | `pnpm -r build && pnpm -r test` | core 323, cli 82, web 54 pass |
| The map in a browser | `npx playwright test e2e/map.spec.ts` | 6 pass, one new (the by-hand list; a graph link opens the graph) |

## Not verified

- The Codex exec stream of `codex-5-real-hook-subagents` was read in the session and not saved to a file; that run's record is the hook's events and Codex's rollout files. The rule in decision 0015 exists so this does not happen again.
- That the owner can start sessions on the Mac from his phone (Remote Control's server mode) is from Claude Code's documentation; it was not tried.
- Nothing in slice 0032 has been run. The worktree is prepared; the check needs the owner in Codex.

## Decisions made here

- **A flag, not a warning, for hand-carried handoffs.** A warning on every `person` carrier would make the owner's own map, and any honest map, never validate clean, and would bury real warnings. So it is said beside the issues and never counted among them.
- **The kit itself is not committed.** It names the owner's other projects in more detail than the brief already in the repository. Its ideas are in; its text stays where he keeps it.
- **Transcripts stay out of git**, with checksums in.

## Leftovers

- grooph's own hook is not installed in this repository. Installing it (`grooph hooks install`, commit `.claude/settings.json`) would let the owner watch this session's subagents with `grooph watch --sessions`. It changes what runs in every session opened here, so it waits for his yes.
- The sample map still holds its guesses until the Operator answers §8.
