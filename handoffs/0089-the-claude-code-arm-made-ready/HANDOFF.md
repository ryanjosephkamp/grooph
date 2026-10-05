# Handoff 0089 · The game experiment: the Claude Code arm made ready, and its rehearsal

**Stage:** 24 · **Lane:** Opus 5.5 · **Effort:** extra high · **Browser tests on port:** 4361 · **Branch:** `slice/0089-the-claude-code-arm-made-ready` · **Drafted:** 2026-10-04 · **Confirmed by owner:** 2026-10-04, on the review desk and in the chat: "Can we do the Claude Code game experiment first?", with his answers in `experiments/game/ANSWERS.md` (the sessions run on his subscriptions; a pause for a usage limit is written down)

## Objective

The owner wants the Claude Code run of the game experiment first, before the Codex target exists. `experiments/game/PROTOCOL.md` had the order drawn by a coin and both arms waiting on Codex. He has changed the order; nothing else about the protocol changes.

Make the Claude Code arm ready to run, so that all the owner has to do is paste a few lines and say "start", and so that the Codex arm, whenever it runs, is given exactly the same spec, graph and checks.

**This slice starts no six-hour run and pushes nothing to the game's repository.** It ends with everything staged and a runbook; the push, the rehearsal and the run each happen on the owner's word.

## What to make

1. **The freeze.** One commit of grooph's repository is the experiment's: record it, with the checksums of `SPEC.md`, `arena.grooph.json` and every file under `acceptance/`, in `experiments/game/FROZEN.md`. From here those files change only by a recorded amendment that both arms get. The Codex arm will be compiled from the same commit. Add to `PROTOCOL.md`, as a dated note and not a rewrite: the owner chose the order (Claude Code first), and what that costs (a flaw the first run shows cannot be fixed for the second without running the first again; so the rehearsal matters more).
2. **The starting contents, built and not pushed.** A script, `experiments/game/setup/make-repo.sh`, that makes a folder outside grooph's clone holding exactly what §2 of the protocol lists: `LICENSE` (MIT), `SPEC.md` byte for byte, the Claude Code package from `grooph export` with the tiers named as the owner answered (`frontier` Opus 5.5, `strong` Sonnet 5.5, `fast` Sonnet 5.5), the event hook's files as `grooph hooks install` writes them, a `.gitignore` for `node_modules`, a README of three lines. One commit. It prints, and does not run, the two commands that would push it to `https://github.com/ryanjosephkamp/grooph-game-experiment-claude` (the owner made that repository; it holds a blank README, which the first commit replaces). Compile with `main` as it is after #63 and #71: say which grooph commit compiled the package.
3. **The clean profile.** How a Claude Code session is started with none of the account's instructions, skills, plugins, connected servers, memory or session tools, the `grooph` command off its path, and permission to read and write inside its own folder, run `npm`, `node`, `git` (not `push`) and the browser there, and reach the npm registry and nothing else. Work out what Claude Code needs for that (a configuration folder of its own, a settings file, the flags), from its documentation, and say for each line whether it is documented or seen. It runs in a terminal, not in the desktop app: the app's sessions can read other sessions.
4. **The record.** The run's folder under `experiments/game/runs/`, what is copied into it and when, and the ledger row, as §4 of the protocol and decision 0015 say. A script that, after a run, finds the result commit and runs the acceptance checks three times in a browser with a window.
5. **`experiments/game/RUNBOOK.md`, for the owner**, in the order he will do things, each step a line he can paste and what he should see: sign in to the clean profile once; the rehearsal (twenty minutes, a scratch folder, the same package); what to look for; the push of the first commit; the day itself (§8); what to do if a session asks something in the middle; the wall at 6 hours 15 minutes.
6. **Dry runs of everything that needs no model**: `make-repo.sh` twice gives the same tree; the profile's settings parse; the after-run script works against the stand-in pages.

## Limits

- **No model session by command, and none in this slice at all.** The rehearsal is the owner's to start, from the runbook.
- **Nothing is pushed to the game's repository, and nothing is written outside grooph's clone except the folder `make-repo.sh` makes**, under a path it prints.
- `SPEC.md`, `arena.grooph.json` and `acceptance/**` are not edited. If you find a fault in one, write it in the handback and stop: an amendment before the freeze is the driver's and the owner's to decide.
- The other lanes are spending the same weekly allowance, and it resets on Monday at about 11 a.m. Eastern. Say in the runbook what a pause for a usage limit looks like and what is written down.

## Read first

`experiments/game/PROTOCOL.md`, `SPEC.md`, `ANSWERS.md`, `acceptance/README.md`; `docs/targets/claude-code.md`; `docs/subagents.md` (what a hook is given; the clean profile must still let the event hook write); `experiments/hooks/README.md` and decision 0015; `scripts/lib/compare-run.mjs` on `slice/0019-comparison-study-two` (how the evidence lane starts a session with no skills listed and the tool off the path).

## Allowed changes

`experiments/game/**` except the three frozen things; `handoffs/0089-the-claude-code-arm-made-ready/**`.

## Forbidden changes

`packages/**`, `apps/**`, `patterns/**`, `spec/**`, `docs/PLAN.md`, `docs/PROGRESS.md`. Any push or write to another repository. Any model session.

## Handback must contain

The `TEMPLATE-HANDBACK.md` sections, plus: the frozen commit and checksums; the tree `make-repo.sh` makes; each line of the clean profile marked documented or seen; what could not be made the same as it will be for Codex, as far as can be known now; the runbook's steps in one list for the driver to read to the owner.

## Prompt to paste

```text
You are a lane of grooph. Read handoffs/0089-the-claude-code-arm-made-ready/HANDOFF.md, then experiments/game/PROTOCOL.md and the files the brief lists, and do the slice on branch slice/0089-the-claude-code-arm-made-ready cut from main. It starts no model session and pushes nothing to the game's repository. Do not edit docs/PLAN.md or docs/PROGRESS.md. The driver session ("grooph opus operator") assigns and reviews your work and will message you; ask it, not me. Finish with the grooph-handback skill, open a pull request, and do not merge it.
```
