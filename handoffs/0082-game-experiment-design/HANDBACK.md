# Handback 0082 · One game, two harnesses: the experiment on paper

**Implementer:** Opus 5.5 (the site lane, after slice 0077) · **Branch:** `slice/0082-game-experiment-design` · **Head commit:** `7a7aa38` · **Date:** 2026-10-04

## Status

`done`. The four things and the page are written, the graph validates and exports, and the held-out checks are shown to pass and to fail, each for its own reason. **Nothing was run: no model session was started, no repository was made, no asset was downloaded.**

## What changed

All new. Nothing outside the allowed paths was touched.

**`experiments/game/`**
- `README.md`: what the folder is, and that nothing in it has been run.
- `SPEC.md`: the game, for whoever builds it. It names no model and no harness. What is fixed (three.js, `npm install && npm run dev`, static files, no backend, no asset from anywhere, `ASSETS.md`); what is in the game; seven milestones with the clock beside each and a playable build at the end of every one; what good looks like; what to drop when time is short, in order; the test surface.
- `arena.grooph.json`: the loop graph both sessions run.
- `PROTOCOL.md`: what is the same in both runs, the held-out checks and how a run is kept from them, what is recorded and where, the models, what the result can and cannot say, what must exist first, the day step by step, and eight questions for the owner.
- `acceptance/LIST.md`: twenty-six things a player can do: twenty-one a script can tell, five for the owner's ten minutes.
- `acceptance/check.mjs`: the twenty-one checks, with the Playwright the web app already has (reached through `apps/web`'s own package; no dependency added). One page a check, real keys and a real mouse, the game's test surface read to see what happened. A request to another host is written down and refused.
- `acceptance/serve.mjs`: a static server for a game's `dist/` or the stand-ins, on 127.0.0.1.
- `acceptance/stand-ins/`: `good.html`, `broken.html` and `stand-in.js`. A flat drawing with the test surface on it and no game behind it; `?break=<name>` turns one behavior off.
- `acceptance/prove.mjs` and `acceptance/proof/`: the proof and its three outputs.
- `acceptance/README.md`: what is there, how to run it, how a run is kept from it, what it does not check.

**`handoffs/briefs/`**
- `game-experiment.html`: the page for the owner, written for a phone, for the driver to publish. One file: the graph's picture is pasted into it.
- `game-experiment/arena.svg`: the picture, as `grooph image` wrote it (18 KB).

## The graph

![The arena graph, drawn by grooph image](../briefs/game-experiment/arena.svg)

`node packages/cli/bin/grooph.js validate --for-export experiments/game/arena.grooph.json` prints "no issues": **no error and no warning**, so there is none to explain. `grooph shape`: 6 agents, 3 checks, 2 gates, 2 loops, up to 48 rounds; 4 agents on `frontier`, 2 on `strong`.

- **One session.** A `lead` node carries the lead's own brief (keep the clock, ask no one in the middle); the planner, the builder, the critic, the wrap-up and the final play are its subagents. Tiers only.
- **Two gates, at the ends.** `start-gate` is the entry and is the spend gate: the clock starts with the answer. `end-gate` is where the owner reads `FINAL.md`. No loop has a `human` stop, and **every other stop has a `then`**: the clock and the dispatch cap lead to `wrap-up`, and a milestone that has failed three rounds leads to `next-milestone`, which hands the builder the same milestone again to build in its smallest form, which the critic may then pass with what `CUTS.md` records. Nothing in the graph halts to wait for a person.
- **Brakes.** Minutes: no milestone starts after 300, no round after 315 (wall clock from the run's first note, as the compiler's lead brief says). Dispatches: 16 a milestone, 110 in all. Rounds: 3 a milestone, 12 over the list.
- **A critic that plays.** `critic` is `frontier`, fresh on every dispatch, denied `edit-files`, and its evidence is the built game, the spec and the checklist, not the builder's account. Its brief is to play the build in a headless browser through the test surface and take pictures.
- **What keeps the build playable.** On a pass the critic writes what it just did as a script under `playable/`, which it owns, ticks the box, and commits and tags. After every builder round `build-check` runs `npm run build` (a failure goes back to the builder), and then `still-plays` runs `[ ! -f playable/all.mjs ] || node playable/all.mjs`: everything earlier milestones left behind. Its output goes to the critic either way, who decides whether the game lost something (the round fails, with that as its first gap) or one of its own scripts is stale (it mends it).
- **The end.** `wrap-up` returns the tree to its last playable state when it is not in one, writes the README and `ASSETS.md`, and tags `final`. `final-play`, a second fresh critic, plays the whole of it and writes `FINAL.md` for the end gate.
- No subgraph, no fan-out: one builder at a time. `adaptation` is the default, `adaptive`: a lead with nobody to ask for six hours needs to be able to mend the graph, and it may tighten a brake and never loosen one.

## Verified, and how

Run at `7a7aa38`, on port 4361.

1. **The graph validates and exports.** Met.
   - `pnpm -r build`: exit 0.
   - `node packages/cli/bin/grooph.js validate experiments/game/arena.grooph.json` and the same with `--for-export`: "no issues", exit 0. No error, no warning.
   - `GROOPH_MODELS=frontier=claude-opus-5-5,strong=claude-sonnet-5-5,fast=claude-sonnet-5-5 node packages/cli/bin/grooph.js export experiments/game/arena.grooph.json --target claude-code --into <a scratch folder>`: exit 0, "wrote 10 files" (five agent files, the skill, `KICKOFF.md`, `LEAD.md`, `MAPPING.md`, the graph), "tiers in this package: frontier → claude-opus-5-5, strong → claude-sonnet-5-5". Three agent files name Opus 5.5 and two name Sonnet 5.5; the lead is the session itself. Nothing was written into the repository's own `.claude/`. The same with `--models` gives the same package.
2. **The checks run, pass against the stand-in that should pass, and fail against the one that should fail.** Met. `node experiments/game/acceptance/prove.mjs --port 4361`: exit 0, "the checks pass against the stand-in that works, fail against the one that does not, and each catches the behavior it looks for." Both outputs are below.
3. **A person who has not seen the brief can read `SPEC.md` and know what to build, and `PROTOCOL.md` and know what the result will mean.** Tried, and the first answer was "not quite": a reader given `SPEC.md` alone, then the checks, the graph and the protocol, found sixteen places where a builder would have had to guess or where a check assumed what the spec did not say. Each is fixed (commit `7a7aa38` lists them). It was not read cold a second time after the fixes.
4. **The checks CI runs.** Met locally.
   - `node scripts/american-english.mjs --check`: nothing British in 526 files. `node scripts/check-pictures.mjs --check`: inside the size rule (the one picture added is a 18 KB SVG).
   - `pnpm -r test`: exit 0 (core 345, CLI 119, web 59). `GROOPH_E2E_PORT=4361 pnpm --filter @grooph/web test:e2e`: 166 passed, 107 skipped. `check-outside-addresses.mjs`, `site-pages.mjs`, `version.mjs`, `perf-budget.mjs`, each with `--check`: pass. The slice touches nothing they read.
   - WebKit and Firefox: not run here, as for slice 0077; the slice changes no file the smoke set loads.

## The two results of the checks against the stand-ins

Made by `node experiments/game/acceptance/prove.mjs`, before any game exists. The files are in `experiments/game/acceptance/proof/`.

**Against the stand-in that works** (`stand-ins/good.html`): 21 of 21 pass.

```text
# The checks against stand-ins/good.html: every one must pass.
# node experiments/game/acceptance/prove.mjs, 2026-10-04

pass  opens    The page opens: no error, no file of its own missing, nothing asked of another host
      no error, no failed request, no request to another host
pass  drawn    Something is drawn: the picture is not one flat color
      35 colors, the commonest covering 37.4%
pass  surface  The test surface is there and whole: window.__game, as SPEC.md §7 describes it
      every field as described; 3 enemies in the test round
pass  start    A round starts: from the menu to playing
      playing, health 100, ammunition 12, the clock running
pass  walk     W walks forward and S walks back
      W: 5 m forward in a second; S: 5 m back
pass  strafe   D steps right and A steps left
      D: 5 m right; A: 5 m left
pass  look     The mouse turns the view: right turns right, up looks up
      200 px right: 28.6 degrees right; 100 px up: forward.y 0 to 0.25
pass  turn     In test mode the arrow keys turn the view, so a script can aim
      right arrow, half a second: 31 degrees; up arrow: 15 degrees
pass  jump     Space jumps, and the player comes down again
      up at least 0.49 m, and down again
pass  world    The arena holds the player: a sprint in one direction ends at its edge, not outside it or under it
      a 45-second sprint ended 60 m from the start, at (0, 0, 60), never more than 0 m below it
pass  view     V switches between first and third person, and the camera moves with it
      first person: camera 1.7 m above the feet; third: 4.08 m from the eyes, behind; and back
pass  fire     A click fires, and a shot uses ammunition
      ammunition 12 to 11
pass  hit      A shot that lands lowers a target's health, and one aimed away does not
      aimed away: nothing; aimed: chaser-1 from health 100 to 66
pass  defeat   An enemy can be defeated, and the score says so
      1 defeated; score 0 to 100
pass  reload   R reloads from the reserve
      ammunition 9 to 12, reserve 48 to 45
pass  threat   An enemy reaches a player who stands still, and hurts
      health 100 to 90 after 6.4 s; the nearest enemy 1.5 m away
pass  lose     A round can be lost
      lost after 8.9 s, health 0
pass  again    After a round ends, Enter starts another
      a second round: health 100, score 0, 3 enemies
pass  win      A round can be won
      won after 3.5 s, health 100, score 300
pass  seed     The same seed starts the same round; another seed starts another
      seed 7 twice: within 0 m; seed 8: 27.3 m away
pass  frames   The picture keeps up: 30 frames a second or more on a still scene
      60 pictures a second; 19 browser frames in 20 took 16.7 ms or less (no window)

21 of 21 checks pass
```

**Against the stand-in with every behavior off** (`stand-ins/broken.html`): 21 of 21 fail. Most fail here because no round starts; the table after it shows each failing for its own reason.

```text
# The checks against stand-ins/broken.html, every behavior off: every one must fail.
# node experiments/game/acceptance/prove.mjs, 2026-10-04

FAIL  opens    The page opens: no error, no file of its own missing, nothing asked of another host
      the page asked another host: https://outside.example/telemetry; the page raised 1 error(s): uncaught: stand-in: an uncaught error, on purpose
FAIL  drawn    Something is drawn: the picture is not one flat color
      the picture is one flat color: 1 color(s), the commonest covering 100% of it
FAIL  surface  The test surface is there and whole: window.__game, as SPEC.md §7 describes it
      camera.position is not a vector
FAIL  start    A round starts: from the menu to playing
      Enter did not start a round: the phase is still "menu"
FAIL  walk     W walks forward and S walks back
      Enter did not start a round: the phase is still "menu"
FAIL  strafe   D steps right and A steps left
      Enter did not start a round: the phase is still "menu"
FAIL  look     The mouse turns the view: right turns right, up looks up
      Enter did not start a round: the phase is still "menu"
FAIL  turn     In test mode the arrow keys turn the view, so a script can aim
      Enter did not start a round: the phase is still "menu"
FAIL  jump     Space jumps, and the player comes down again
      Enter did not start a round: the phase is still "menu"
FAIL  world    The arena holds the player: a sprint in one direction ends at its edge, not outside it or under it
      Enter did not start a round: the phase is still "menu"
FAIL  view     V switches between first and third person, and the camera moves with it
      Enter did not start a round: the phase is still "menu"
FAIL  fire     A click fires, and a shot uses ammunition
      Enter did not start a round: the phase is still "menu"
FAIL  hit      A shot that lands lowers a target's health, and one aimed away does not
      Enter did not start a round: the phase is still "menu"
FAIL  defeat   An enemy can be defeated, and the score says so
      Enter did not start a round: the phase is still "menu"
FAIL  reload   R reloads from the reserve
      Enter did not start a round: the phase is still "menu"
FAIL  threat   An enemy reaches a player who stands still, and hurts
      Enter did not start a round: the phase is still "menu"
FAIL  lose     A round can be lost
      Enter did not start a round: the phase is still "menu"
FAIL  again    After a round ends, Enter starts another
      Enter did not start a round: the phase is still "menu"
FAIL  win      A round can be won
      Enter did not start a round: the phase is still "menu"
FAIL  seed     The same seed starts the same round; another seed starts another
      Enter did not start a round: the phase is still "menu"
FAIL  frames   The picture keeps up: 30 frames a second or more on a still scene
      Enter did not start a round: the phase is still "menu"

0 of 21 checks pass; failing: opens, drawn, surface, start, walk, strafe, look, turn, jump, world, view, fire, hit, defeat, reload, threat, lose, again, win, seed, frames
```

**One behavior off at a time** (`good.html?break=<name>`): all 25 caught.

| Turned off | Must fail | What the check said | Failed with it |
|---|---|---|---|
| `error` | `opens` | the page raised 1 error(s): uncaught: stand-in: an uncaught error, on purpose |  |
| `outside` | `opens` | the page asked another host: https://outside.example/telemetry |  |
| `blank` | `drawn` | the picture is one flat color: 1 color(s), the commonest covering 100% of it |  |
| `surface` | `surface` | camera.position is not a vector | view, hit, defeat, win |
| `start` | `start` | Enter did not start a round: the phase is still "menu" | surface, walk, strafe, look, turn, jump, world, view, fire, hit, defeat, reload, threat, lose, again, win, seed, frames |
| `move` | `walk`, `strafe` | holding W for a second moved the player 0 m | world |
| `strafe` | `strafe` | holding D for a second moved the player 5.08 m, not to the right of where the view points |  |
| `look` | `look` | moving the mouse 200 px right turned the view 0 degrees to the right |  |
| `turn` | `turn` | holding the right arrow for half a second turned the view 0 degrees right; 60 degrees a second is 30 | hit, defeat, win |
| `jump` | `jump` | Space did not lift the player 0.3 m within a second and a half |  |
| `fall` | `world` | the player fell 4773.9 m below where the round started | jump, hit, defeat, win |
| `wall` | `world` | the player ran 405.3 m from the start and was not stopped: the arena has no edge there |  |
| `view` | `view` | in third person the camera is 0 m from where the eyes are, and not behind the player |  |
| `ammo` | `fire` | a click left the ammunition at 12 | reload |
| `aimless` | `hit` | a shot fired away from every enemy lowered an enemy's health: clicks land wherever they point |  |
| `damage` | `hit` | aimed shots for 7.65 s lowered no enemy's health (the round is playing; ammunition 5) | defeat, win |
| `defeat` | `defeat` | no enemy was defeated in 15.3 s of aimed shots (the round is lost) | win |
| `reload` | `reload` | R left the ammunition at 9 |  |
| `chase` | `threat` | a player who stood still for 10.2 s was not hurt | lose, again |
| `ambient` | `threat` | the player was hurt with the nearest enemy 17.4 m away: something other than a chaser's strike did it |  |
| `lose` | `lose` | a player who stood still for 20.4 s did not lose: the round is playing, health 0 | again |
| `restart` | `again` | Enter after a lost round did not start another within ten seconds |  |
| `win` | `win` | 30.6 s of aimed shots did not win the test round: the round is playing, 0 enemies alive, health 100 |  |
| `slow` | `frames` | 8.5 pictures a second: the game drew 68 in 8 s; run with --headed for a real game, since a browser with no window… | defeat |
| `seed` | `seed` | two visits with seed 7 started 13 m apart |  |

The first run of this proof is why it is worth having: it showed that the frame-rate check passed a game drawing eight pictures a second, because it was timing the browser and not the game.

## What I would cut from the spec if six hours proves short, in order

This is section 6 of `SPEC.md`, so both builders have it. From the end:

1. Settings and the kept best score (M6).
2. The heavy enemy (M6).
3. The second weapon (M6).
4. Shooters (M6).
5. Movement of bodies when they walk, and the sign of where damage came from (M5).
6. Pickups (M4).
7. Shadows, and the third wave's extra difficulty (M4).

Never M0 to M3, and never the test surface. If the owner wants the spec itself smaller before the run, I would take M6 out whole and end at "Feel": a game with two views, an arena, three waves and sound is already the thing he described, and M6 is the milestone most likely to be half done at the wall.

## What the owner is asked to decide

The eight questions of `PROTOCOL.md` section 9, each with what I would say, and an answer to copy on the page:

1. Which models the tiers mean in Claude Code. *Opus 5.5 for `frontier`, Sonnet 5.5 for `strong`: the same split as Sol and Luna.*
2. How the sessions are paid for. *Whichever way has no allowance to run out in six hours.*
3. Blender on the machine, or not. *Not.*
4. A twenty-minute rehearsal in each harness first. *Yes.*
5. The extension: one decision for both, after both are scored. *Yes.*
6. The repositories' names, and whether the run folder is public with the game. *Public.*
7. When. *After slice 0076 has merged and one template has run in Codex.*
8. A run that ticks all seven milestones early: does it end, or polish until hour five? *It ends, as written. Six hours is a ceiling, and the extension is there if what came out is thin.*

## Decisions made

1. **The game is sized from the front.** Hour two holds a whole small game (walk, shoot, win, lose), and M3 to M6 each add one kind of thing. The spec names no commercial game: the owner's three are described by kind.
2. **The test surface reads and never acts.** A snapshot of the game as plain data, a seed, and a test mode that changes five named things. A script aims with the arrow keys test mode gives, in a loop that reads where the view points and where the enemy is: a browser driven by a script cannot always take the pointer, and this way nothing in the surface does what a player could not.
3. **The checks are one plain Node script**, not a suite under Playwright's own runner: a test file outside `apps/web` cannot find the package. The script reaches the browser through `apps/web`'s own install. No dependency was added.
4. **The stand-ins are a flat drawing, not three.js.** A three.js page would have meant a dependency or a download. Twenty-five behaviors can be turned off by name, one for each thing a check looks for.
5. **The graph is two nested loops, as `gauntlet-decomposed` is, with what its record and `ralph-loop`'s taught.** No `human` stop (that run halted mid-way on one). Nothing held out is given to any node, so no planner can copy it into a builder's instructions and no builder can be handed a path to it.
6. **No stop halts.** Every stop but `bar-passed` has a `then`. The default, halt and report, would leave a six-hour run waiting for a person.
7. **What keeps the build playable is the critic's own scripts.** Written only after it has seen the thing work, so a later failure is a regression or a stale script and nothing else. `still-plays` runs them after every build, and its failure goes to the critic, who owns them, not back to the builder, who may not touch them: a stale script cannot block the run.
8. **A milestone that fails three rounds may pass smaller**, with what `CUTS.md` records, in the spec's own order, and never anything in M0 to M3 or in the test surface.
9. **The clock is three numbers and a wall.** No milestone after 300 minutes, no round after 315, a builder at most 25 minutes at a time (the lead's brief), and the owner's wall at 6 h 15 min in the protocol. The result is a commit, not a working tree.
10. **Nothing is pushed by the graph.** Commits stay in the clone and publishing is the owner's act after he has read the result, so there is no irreversible node. The start gate is the spend gate.
11. **`adaptive`**, the default: a lead with nobody to ask needs to be able to mend the graph. It cannot loosen a brake, and every amendment is recorded.
12. **A clean profile, a rule for a wrong check, and an early finish that ends** are in the protocol; the last is put to the owner as question 8.
13. **A cold read before the handback.** One subagent of this session (Opus 5.5) read the spec as a builder would, then the spec against the checks, the graph and the protocol. It ran the validator and nothing else. It found sixteen things, the first eight of which would have cost a run or a check: all are fixed, and the list is in the commit message of `7a7aa38`.

## Deviations

- **Port 4361, not 4366.** The brief's header gives 4366; the driver's message assigning the slice said 4361, as for slice 0077.
- **The commands as they are today.** The brief's verification names `packages/cli/dist/index.js` and `--out`; the CLI is `packages/cli/bin/grooph.js`, and export takes `--target claude-code --into <dir>`. The brief said to check.
- **Twenty-six lines, not about twenty**: twenty-one for a script and five for the owner.
- **Three proof outputs, not two.** Besides the stand-in that works and the one that does not, each behavior was turned off alone.
- **A subagent read the work.** The brief forbids starting a model session by command and any run. No session was started by command and nothing of the experiment was run; a subagent of this session reviewed the documents, as one did for slice 0077. Said here so the driver can judge it.
- **The page holds its picture inline**, so it is one file to publish; the file `grooph image` wrote is beside it.

## Risks and leftovers

- **No game has met the checks.** They pass and fail as they should against the stand-ins, which were written by the same hand as the checks. A real three.js game may trip one for a reason neither shows. The protocol's rehearsal is the first real page they would meet, and its rule for a wrong check is there for this.
- **The checks have not run with a window.** The proof ran without one. With a window the browser asks for an icon by itself; the checks ignore that request, and that path is untested.
- **The clock inside a milestone is an instruction, not a brake.** Stops are read at the end of a pass. What keeps a builder from running long at hour five is the lead's brief (a hand-back time on every dispatch) and the builder's (hand back by it). The brake behind them is the owner's wall at 6 h 15 min.
- **The critic's brief is the longest in the graph** and carries the most rules: what to do when `still-plays` failed, when a cut milestone may pass, what to leave behind. It is the brief most likely to be read differently by two harnesses.
- **`MILESTONES.md`'s line form is an instruction to the planner.** `next-milestone` greps for `- [ ]` at the start of a line. A planner that writes a table ends the run after M0. The form is now in the planner's brief and outputs and in the critic's outputs.
- **A clean profile is named, not worked out.** How to start each harness with none of the account's instructions, skills, servers and session tools is for the rehearsal to settle.
- **The Codex half does not exist.** Whether this document exports for Codex unchanged is slice 0076's to show.
- **Nothing this long has been run from a grooph package.** The longest run in the write-ups took about sixteen minutes (957 s).
- **An early finish ends the run** (question 8). A run that ticks seven milestones by hour four stops there.
- **The proof takes about twenty minutes** and is not in CI. `prove.mjs` exits 1 when a check does not behave; it is run by hand when `check.mjs` changes.

## Prompt to paste into the driver session

```text
Handback for slice 0082 is at handoffs/0082-game-experiment-design/HANDBACK.md on branch slice/0082-game-experiment-design (head 7a7aa38). Status: done. Please reconcile with the grooph-reconcile skill.
```
