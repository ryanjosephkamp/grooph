# Handback 0089 · The game experiment: the Claude Code arm made ready

**Implementer:** Opus 5.5 (the views lane) · **Branch:** `slice/0089-the-claude-code-arm-made-ready` · **Pull request:** the one that names this file, not merged · **Head commit:** the one that added this file (the prompt in the lane's last reply names it) · **Date:** 2026-10-04

## Status

`needs fix pass`, by one item the driver said could follow: **the scoring script is not in this pull request** (find the result commit; the checks three times with a window; its dry run against the stand-in pages). Everything the owner needs before and during the run is here and dry-run: the freeze, the starting contents, the clean profile, the record, the runbook.

**No model session was started. Nothing was pushed to the game's repository. Nothing was written outside grooph's clone** except dry runs inside this session's own scratch folder, which the system clears.

Three things to read first:

1. **Four lines of the profile are not known until the rehearsal** (below, "The clean profile"). If the rehearsal shows the critic cannot start a browser, or npm cannot install, that is a change to the profile and a second rehearsal.
2. **One line of the starting contents is mine and not the brief's:** `.gitignore` also ignores `.grooph/events/` (Deviations 1).
3. **Nothing looked wrong in the spec, the graph or the checks.** One thing about the lead's brief was met in the profile rather than reported as a fault: it asks at a gate "with `AskUserQuestion` when it is available", and in the only mode that never waits for an answer Claude Code refuses that tool. The profile takes the tool away, so the lead asks in plain text, as its brief says to when the tool is not there.

## The frozen commit and checksums

**`11070a7c5bbc7e77c1fc7e6304f7bf07f7d20a8c`**: `main` on 2026-10-04 at 21:02 Eastern, with #63, #71, #72 and #83 in. `experiments/game/FROZEN.md` has it, with the SHA-256 of all fourteen files; `experiments/game/setup/frozen.sha256` is the same list in the form `shasum -a 256 -c` checks.

| File | SHA-256 |
|---|---|
| `SPEC.md` | `43f4d7da1abb88301084f726976f196b7d458dd2bd4c8a81879f0f9eb7fffa55` |
| `arena.grooph.json` | `b3605be3d31d9a9f4163d09fabee3155850e2adf09da23cb42ee3bdf8847d3f0` |
| `acceptance/check.mjs` | `c60a2d4872a71d65b825fc0129692bcaf19e70af414dcae4403e4107ece3cdea` |
| `acceptance/LIST.md` | `09db36189d92e53eb84f4ee92d072f5a2241f1acbce6ef10d919b1c45bb7811c` |
| the other ten under `acceptance/` | in `FROZEN.md` |

The package was compiled by grooph's packages as of `4a6f91d7dc9a3e2fbdaab4f284d69a5872a30d81` (the last commit to change `packages/` before the frozen one), with `--models frontier=claude-opus-5-5,strong=claude-sonnet-5-5,fast=claude-sonnet-5-5`. The models are named in full, which the subagent `model` field is documented to take, so the package does not depend on what `opus` and `sonnet` mean on the day. The lead is the session, started with `--model claude-opus-5-5`.

`PROTOCOL.md` has its dated note as section 10: the order is the owner's choice, and what that costs.

## The tree `make-repo.sh` makes

Seventeen files, one commit. **Tree `3238a9052ce7765c79990029bbff6bccd88628bf`**; with the frozen commit's date and the name grooph's clone commits under, commit `8c4aceb29e1534cfdf5ffdebd7d77fe9befbcc17`.

```
.claude/agents/arena--builder.md        model: claude-sonnet-5-5
.claude/agents/arena--critic.md         model: claude-opus-5-5
.claude/agents/arena--final-play.md     model: claude-opus-5-5
.claude/agents/arena--planner.md        model: claude-opus-5-5
.claude/agents/arena--wrap-up.md        model: claude-sonnet-5-5
.claude/settings.json                   the event hook's entries, as `grooph hooks install` writes them
.claude/skills/arena/SKILL.md
.gitignore                              node_modules/ and .grooph/events/
.grooph/arena/KICKOFF.md                what the owner pastes
.grooph/arena/LEAD.md
.grooph/arena/MAPPING.md
.grooph/arena/graph.grooph.json
.grooph/hooks/grooph-event.mjs
.grooph/hooks/grooph-events-push.mjs
LICENSE                                 MIT, grooph's own text
README.md                               three lines
SPEC.md                                 byte for byte
```

No file in it names a path on this machine, grooph's repository address, or the checks.

## What changed

All under `experiments/game/`, and this folder.

- `FROZEN.md` (new); `PROTOCOL.md` (section 10 added, nothing above it touched); `README.md` (five rows).
- `RUNBOOK.md` (new): the owner's steps.
- `setup/make-repo.sh` (new): the starting contents, built outside the clone, one commit, the two push lines printed and not run. `setup/frozen.sha256`, `frozen.env`, `starting-contents.claude-code.sha256`: what it checks itself against.
- `setup/make-profile.sh`, `setup/profile/settings.json`, `setup/start-claude.sh`, `setup/PROFILE.md` (new): the clean profile.
- `setup/record.sh`, `setup/ledger.mjs`, `runs/README.md` (new): the record.

`SPEC.md`, `arena.grooph.json` and `acceptance/**` are untouched: `shasum -a 256 -c experiments/game/setup/frozen.sha256` passes, and `git diff 11070a7..HEAD --stat -- experiments/game/SPEC.md experiments/game/arena.grooph.json experiments/game/acceptance` is empty.

## The clean profile, line by line

`setup/PROFILE.md` is the full table: every line with what it is for and where it comes from. In short:

| | Documented | Seen on this Mac | Not known until the rehearsal |
|---|---|---|---|
| A configuration folder of its own (`CLAUDE_CONFIG_DIR`), so none of the account's instructions, skills, agents, plugins, servers or history | yes | a new folder is "Not signed in" and gets its own `.claude.json` | |
| No memory, no claude.ai connectors, no MCP server at all, no local settings file, no browser extension | yes, each | | |
| Never asks: `dontAsk`; subagents inherit it; the question tool taken away | yes | Claude Code's own check accepts the settings file, and rejects a deliberately wrong one | |
| The sandbox: writes only in its own folder and temp; reads closed to `/Users`; the npm registry and no other host; no retry outside it; `git push` denied | yes | | |
| npm's cache moved to a folder a session may write | that npm needs one, yes | | **that npm then installs** |
| The browser: Playwright's folder readable, `localhost` open, every system service lookup allowed | the three keys, yes | | **that Chromium then starts** |
| The `grooph` command off the path | | not on the path the session is given | **that the session's shell does not put it back** (the sign-in step checks, with one typed line) |
| The session's id and transcript place known beforehand | yes | | |
| The lead and five agents on the models the owner answered | yes | the package's files say so | **what the transcript then names** (`record.sh` prints it) |

It is a terminal session. The desktop app's sessions are given tools that read other sessions.

## What could not be made the same as it will be for Codex, as far as can be known now

- **The terms**: Codex's own words for a sandbox, an approval policy and a profile. Where the intent cannot be said the same, it is written down before that run.
- **Refuse or ask**: here a call outside the rules is refused and the session goes on. If Codex can only stop and ask, a session there could wait where this one would not.
- **`localhost` and system services**: whether Codex's sandbox opens exactly this far for a dev server and a browser.
- **The hook**: Codex runs a hook only after it is reviewed in `/hooks`; Claude Code runs the repository's once the folder is trusted.
- **The question tool**: Codex has none, so both runs ask at a gate in plain text, which is why the profile takes Claude Code's away.
- **The compiler's commit, the models and the date**: the Codex compiler does not exist at the frozen commit; the spec and the graph it reads are the frozen ones.

## Verified, and how

| The brief | What was run | Result |
|---|---|---|
| The freeze | `shasum -a 256 -c experiments/game/setup/frozen.sha256` | 14 of 14 `OK` |
| `make-repo.sh` twice gives the same tree | run into two scratch folders, then `diff -r` | the same tree and the same commit; no difference |
| It refuses what it should | a folder that exists; a folder inside the clone | refused, nothing written |
| The profile's settings parse | `make-profile.sh`, then `claude doctor` under that folder (it starts no session) | no "Invalid settings"; a deliberately wrong file is reported as invalid in three places, so the silence means something |
| The start is right without starting | `start-claude.sh rehearsal --print`, `run --print`, `sign-in --print` | the setup record and the command printed; `run` refuses because its folder is not made |
| The record after a session | `record.sh` against a made-up record, folder and transcript | copies the run folder and events, names the models, counts the checks' path in the transcript, lists a refusal; the made-up record was then removed |
| **The after-run script against the stand-in pages** | **not done: the script is not written** | |
| Repository checks | `node scripts/american-english.mjs --check`; `bash -n` on the four scripts | pass |

`pnpm -r build && pnpm -r test` and the browser suite were not run for this slice: it changes nothing under `packages/` or `apps/`.

## Decisions made

1. **The sandbox is the wall, and nothing asks.** `dontAsk` with sandboxed commands approved by the sandbox itself. A mode that prompts would stall a run nobody is watching.
2. **The profile's rules live in the profile, not in the game's repository**, so the starting contents stay exactly what the protocol lists.
3. **Models by full name**, in the package and for the lead.
4. **The first commit's author is the address grooph's clone commits with** (GitHub's no-reply address), not the machine's global one, which is a personal e-mail and would have been published.
5. **The first commit is reproducible**: the frozen commit's date, no signature. The same contents are the same commit.
6. **The push is a force push**, printed for the owner: the repository on GitHub holds a blank README in a commit of its own, and the protocol wants the first commit to be the starting contents and nothing else.
7. **`make-repo.sh` compiles with the clone as checked out and then checks every file against the freeze**, refusing on any difference and saying how to build from the frozen commit instead.
8. **The folders are `~/grooph-game/…`**, movable with `GROOPH_GAME_HOME`.
9. **A second start of the same name is refused** until the first one's record is moved aside, so no session goes unrecorded.
10. **`CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC` is not set**: it also turns off Claude Code's feature flags, an unknown I did not want in a six-hour run. Only the updater is off.

## Deviations

1. **`.gitignore` has `.grooph/events/` beside `node_modules/`.** The brief says a `.gitignore` for `node_modules`. The protocol's section 4 puts the hook's events in grooph's record, the hook's installer says to ignore them, and without the line the tree is never clean and `git add -A` commits them. It is one line in `make-repo.sh`; removing it changes the tree and `FROZEN.md`.
2. **The scoring script and its dry run are not here** (Status).
3. **`AskUserQuestion` is denied in the profile**, which changes how the lead asks at its two gates from what it would do in an everyday session. It is what the brief's own "otherwise in plain text" covers.
4. **The record's `setup.txt` is written by `start-claude.sh`**, at the start, not by a separate step: so that a session cannot be started unrecorded.

## The runbook's steps, in one list

1. Once: `git pull && pnpm install`; check the freeze (fourteen `OK`); install the browser (`npx -y playwright@latest install chromium`).
2. Once: `make-profile.sh`; `start-claude.sh sign-in`; in it `/login`, then `/status`, `/mcp`, `/memory` and one line that shows `grooph` is not on the path; `/exit`.
3. The rehearsal: `make-repo.sh --rehearsal` (the tree must be `3238a905…`); `caffeinate`; `start-claude.sh rehearsal`; trust the folder; paste the kickoff; answer `start`; watch twenty minutes for five things (it never asks; npm installed; the critic drove a browser and left a picture; commits appear; nothing is asked after the gate); Esc, `/cost`, `/exit`; `record.sh rehearsal`; send the output to the driver. **The run waits for the driver's reading.**
4. The push: `make-repo.sh`, then the two lines it prints.
5. The run: `caffeinate`; `start-claude.sh run`; trust; paste the kickoff; answer `start` within a minute and write the time (one line does it and prints the wall's time); leave it; the one line if it asks in the middle; what a usage-limit pause looks like and what to write; `close` at the end gate, or Esc at the wall; `/cost`, `/exit`; `record.sh run`; push the game.
6. If anything is not as written: stop and tell the driver.

## Risks and leftovers

1. **The profile has met no session.** The four unknowns above are the rehearsal's to settle.
   - **A lead cannot edit its own agent files here**, though its brief says to when an amendment changes a node's tools, and `MAPPING.md` says a node's model is changed there. Claude Code refuses any write under `.claude/` in every mode that does not skip all checks, whatever the rules allow (`permission-modes`, "Protected paths"). In this profile that is a refusal the lead is told of; in an everyday session it would be a prompt nobody answers. A lead can still amend its working copy and can name a model when it dispatches a node. It cannot change a node's tools. `setup/PROFILE.md` says so under its own heading. This is the package meeting the harness, not a fault in the spec, the graph or the checks, but the driver should decide whether it is acceptable for the run or wants a word in the protocol.
2. **The usage allowance.** The other lanes spend from the same weekly allowance. A run started with little left may spend much of its six hours paused; the runbook says what that looks like and what is written.
3. **`allowMachLookup: ["*"]` and `allowLocalBinding`** loosen the sandbox toward the system's services and this machine's `localhost`. Neither opens a file or a host. Nothing of grooph's should be serving a page during the run; the runbook says so.
4. **A command can still read outside `/Users`** (system files, `/opt/homebrew`, `/tmp`). The checks are under `/Users`.
5. **The browser's version.** A session installs whatever `playwright` npm serves that hour. If a new one is published between the owner's install line and the run, the session will want a browser it cannot download. The runbook's install line is run the same evening; the rehearsal shows it.
6. **`record.sh` reads transcripts by pattern.** Its counts are for a person to read, not a verdict: a session that names its own file `check.mjs` is not a session that saw the checks.
7. **What Claude Code reports as loaded at the start** is recorded only as far as the owner's four typed lines at sign-in and what `record.sh` reads from the transcript afterwards. A fuller list (every built-in skill and tool) is not captured.
8. **Next, in a second pull request:** `setup/score.sh` and its dry run against the stand-ins; the windowed Chromium it needs comes with the runbook's install line.

## After the handback: the scoring script

The one item the status above held back, in a second pull request stacked on the first.

- **`experiments/game/setup/score.mjs`** (new). For a session's record it finds the result commit as the protocol defines it (the commit tagged `final`; with no tag, the newest commit at which `npm ci` and `npm run build` succeed and `node playable/all.mjs` passes, looked for from the newest back and never the starting contents), builds it in a clean checkout under `~/grooph-game/scoring/`, serves its `dist/`, and runs `acceptance/check.mjs` three times with a window. It writes `after/result-commit.txt` (with every commit tried and how far each got), the three outputs, and `after/score.md`: pass (all three), unsteady (some, with all three results), fail (none). The ledger's row gets the result commit and the count.
- **Dry runs, with no model and no game** (`--no-window`, because the windowed Chromium is not on this Mac; the runbook has the owner install it):
  - `--stand-in good`: 21 of 21 pass all three. `--stand-in broken`: 21 of 21 fail all three.
  - A made-up repository of three commits (the starting contents; a build that plays, made of the stand-in page; a commit whose own play scripts fail): it tried the newest, found its play scripts failing, took the one before as the result, and the checks passed 21 of 21 three times. With that commit tagged `final` it took the tag.
  - The made-up record and ledger row were removed afterwards.
- **A fault found by the first dry run, in my own script:** it ran the checks in a way that blocked the very process serving the page, so the first run never finished. It now runs each beside the server. Nothing of `acceptance/` was touched.
- **The runbook** has a part 6 for it and one more install line; `runs/README.md` lists what it writes.
- **Not known until a real game:** how long three runs take at full patience (the stand-ins are run with the waits shortened, as `prove.mjs` runs them), and whether a build made by a session installs and builds in a clean checkout as it did for the session.

With this the brief's six items are all made and dry-run. **Status: `done`.**

## Prompt to paste into the driver session

```text
Handback for slice 0089 is at handoffs/0089-the-claude-code-arm-made-ready/HANDBACK.md on branch slice/0089-the-claude-code-arm-made-ready (its pull request names it). Status: needs fix pass, by one item you said could follow: the scoring script is not in it. No session was started and nothing was pushed to the game's repository. The frozen commit is 11070a7; the starting contents are tree 3238a9052ce7765c79990029bbff6bccd88628bf, seventeen files. Four lines of the clean profile are not known until the rehearsal (npm's cache, Chromium in the sandbox, the shell's path, the models the transcript names). One deviation to rule on: .gitignore also ignores .grooph/events/. Please reconcile with the grooph-reconcile skill.
```
