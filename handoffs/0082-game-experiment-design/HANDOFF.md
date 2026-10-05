# Handoff 0082 · One game, two harnesses: the experiment on paper

**Stage:** 24 · **Lane:** Opus 5.5 · **Effort:** extra high · **Browser tests on port:** 4366 · **Branch:** `slice/0082-game-experiment-design` · **Drafted:** 2026-10-04 · **Confirmed by owner:** 2026-10-04, on the review desk (the idea "Game experiment": pursue; the cards "The game: what kind?" and "The game: time limit and repositories")

## Objective

The owner wants to see what a loop graph does on something big and fun: one browser game built from one spec, once in Claude Code and once in Codex, each in its own public repository, six hours each. Before a minute of that is spent, the experiment has to exist on paper so he can read it and say yes: the spec both sessions are given, the graph both run, the checks no builder can see, and the rules that keep it fair.

**This slice writes those four things and a page for him to read. It runs nothing, spends nothing and creates no repository.**

His words, to design from:

- The game: "First-person + third-person (player can switch between views) in a small open shooter arena world. Think Skyrim + Fortnight + CSGO / Counter-Strike 2 hybrid."
- The setup: "Two public repositories, six hours each", and "I'm willing to extend the time limit by a couple of hours afterwards (to keep it fair, we would do the same for Claude Code and Codex), in case quality isn't great."
- Earlier, in his brief: a browser game; three.js; Blender named as a possible tool.

## What to make, under `experiments/game/`

1. **`SPEC.md`: the game.** The one document both sessions are given beside the package. Written for a builder; it names no model and no harness.
   - Sized so that a game you can walk in, shoot in and win or lose exists by about hour two, and every later milestone makes it better. The build is playable at the end of every milestone.
   - Fixed: it runs in a browser with three.js, starts with `npm install && npm run dev`, builds to static files, and has no backend.
   - **No asset is downloaded from anywhere.** Every model, texture and sound is made by code in the repository (three.js geometry, a Blender script if Blender is on the machine, generated audio), so a public repository's license is clean. Say so as a rule of the spec.
   - It fixes a small surface for automated play-testing (for example a read-only `window.__game` with the player's position, health, ammunition and view, the enemies' health, the score and the phase of a round, and a flag for a fixed seed), described as what it is. The held-out checks below rest on it.
2. **`arena.grooph.json`: the loop graph both sessions run.** It validates with no error, every warning is explained in your handback, and `grooph export` writes a Claude Code package from it.
   - One session: a lead and its subagents. Tiers are named, never models.
   - Brakes: a budget in minutes for the six hours, a cap on dispatches, a round cap on every loop.
   - **Nobody is needed in the middle.** At most two human gates, placed where the owner is certainly there: at the start and at the end. The graph must not wait on a person in between.
   - A critic that does not share the builder's context and plays the build: a headless browser, screenshots, the game's own test surface.
   - Something that keeps the build playable from one milestone to the next: what worked at the end of a milestone still works at the end of the next, and the graph says how that is checked.
   - No subgroophs: amendment A-018 is proposed and not built.
3. **`acceptance/`: the checks no builder sees.** About twenty things a player can do, as a list. Where a machine can tell, a Playwright check: the page opens with no error, something is drawn, a key moves the player, the view switches and the camera moves with it, a shot lowers a target's health, an enemy reaches the player, a round can be lost and can be won, the frame rate on a fixed scene. Where only a person can tell, a line for the owner's own ten minutes of play.
   - Say how a run keeps this folder from the builders. It lives in this repository, not in the game's.
   - **Prove the checks can fail and can pass** before any game exists: run them against two small stand-in pages you write, one that satisfies the surface and one that does not, and record both results. A check that passes against nothing is not a check.
4. **`PROTOCOL.md`: what keeps it fair, and what it can show.**
   - The same spec, the same graph compiled for each target, the same machine, the same starting contents in each repository, the same clock and what happens when it runs out, the same extension if there is one, the owner's answers at the gates fixed ahead of time.
   - What is recorded and where: the run folder, the events, the cost each harness reports, commits with their times (decision 0015: a run is recorded before its result is used).
   - The models. Claude Code: never Fable; the tiers are named at export with `--models`, and which models they mean is the owner's answer on the desk. Codex: GPT-6.1 Sol leads, GPT-6 Luna works. Never Astra.
   - **What the result can and cannot say**, written before the runs: one run in each harness is two accounts of what happened once. It is not a comparison of harnesses and it is not evidence that a loop graph beats a prompt. Say what it would take to be either.
   - What must exist before it can run: the Codex target (slice 0076), the two public repositories, the owner's yes.
5. **A page for the owner**, source at `handoffs/briefs/game-experiment.html`: the game in a paragraph, the graph drawn (use `grooph image`), the milestones, the checks, the rules, what it can show, and what he is asked to decide. He reads on a phone. The driver publishes it; you do not.

## Success criteria

- `grooph validate experiments/game/arena.grooph.json` reports no error, and `grooph export` with `--models` naming Opus 5.5 and Sonnet 5.5 writes a package (into a scratch folder, not into the repository's own `.claude/`).
- The acceptance checks run, pass against the stand-in that should pass and fail against the one that should fail, and both outputs are in the handback.
- A person who has not seen this brief can read `SPEC.md` and know what to build, and read `PROTOCOL.md` and know what the result will and will not mean.
- `node scripts/american-english.mjs --check`, `node scripts/check-pictures.mjs --check` and every CI job pass.

## Read first

1. This file, then `AGENTS.md` and what it lists for a graph: `docs/graph-ir.md`, `docs/templates.md`, `docs/targets/claude-code.md`
2. `docs/comparisons.md` and `docs/decisions/0013-value-as-of-study-one.md` (what a result here may claim), `docs/decisions/0015-*` (recording a run)
3. `patterns/gauntlet-decomposed.grooph.json`, `patterns/ralph-loop.grooph.json`, `patterns/review-gate.grooph.json` and their write-ups under `experiments/patterns/` (two of them are the records that fail their check: read why)
4. `handoffs/0076-codex-target/HANDOFF.md` (what the Codex arm will run on)
5. `apps/web/e2e/smoke.spec.ts` (how a test here serves a built page from a server of its own)

## Allowed changes

`experiments/game/**`; `handoffs/0082-game-experiment-design/**`; `handoffs/briefs/game-experiment.html` and a folder of pictures beside it, each 150 KB or less.

## Forbidden changes

`packages/**`, `apps/**`, `patterns/**`, `spec/**`, `docs/PLAN.md`, `docs/PROGRESS.md`. A new dependency in the repository's own packages (the acceptance checks use the Playwright the web app already has). **Creating a repository. Starting any model session by command** (`claude -p`, `codex exec`): no run of any kind. Downloading any asset. Naming the owner's other projects.

## Spec constraints that apply here

A graph is one session (convention; A-011). Human is the brake: spend and publish are gated (decision 0008). Every run recorded (decision 0015). American English (decision 0022). Latitude over procedure: the graph's briefs state purpose, limits and outputs, not steps.

## Design already decided

By the owner: the kind of game, two public repositories, six hours each with any extension given to both, a browser game. By the driver: no downloaded assets; a test surface in the spec and checks held out in this repository; at most two gates, none in the middle; nothing is run in this slice.

## Implementer's choices

The milestones and what is in each. The graph's shape. The list of checks. How the clock's end is handled. Whether the two stand-in pages are plain HTML or small three.js scenes.

## How to verify

```bash
pnpm -r build
node packages/cli/dist/index.js validate experiments/game/arena.grooph.json
GROOPH_MODELS=frontier=claude-opus-5-5,strong=claude-sonnet-5-5,fast=claude-sonnet-5-5 node packages/cli/dist/index.js export experiments/game/arena.grooph.json --out "$TMPDIR/game-package"
node scripts/american-english.mjs --check && node scripts/check-pictures.mjs --check
```

Check `grooph export --help` for the flags as they are today; the lines above say what must be true, not the exact spelling.

## Handback must contain

The `TEMPLATE-HANDBACK.md` sections, plus: the graph's picture and every warning explained; the two results of the acceptance checks against the stand-ins; what you would cut from the spec if six hours proves short, in order; what the owner is asked to decide.

## Prompt to paste

```text
You are a lane of grooph. Read handoffs/0082-game-experiment-design/HANDOFF.md, then AGENTS.md and the files it lists, and do the slice on branch slice/0082-game-experiment-design. It designs an experiment and runs nothing: no model session by command, no repository created, no asset downloaded. Browser tests on port 4366. Do not edit docs/PLAN.md or docs/PROGRESS.md. The driver session ("grooph opus operator") assigns and reviews your work and will message you; ask it, not me. Finish with the grooph-handback skill, open a pull request, and do not merge it.
```
