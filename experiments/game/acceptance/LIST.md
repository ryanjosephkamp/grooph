# What a player can do: the list

Twenty-six things, held out from every builder. Twenty-one a machine can tell (`check.mjs`, one check each, named by its id); five only a person can, and those are the owner's ten minutes with each build.

The checks open the page with `?test=1&seed=7`, use real keys and a real mouse, and read the game's test surface (`SPEC.md` section 7). In test mode a round is the test round: three chasers, one wave.

## A machine can tell

| | id | A player can | The check passes when |
|---|---|---|---|
| 1 | `opens` | open the page | no error is raised, no file of the page's own fails to load, and nothing is asked of another host |
| 2 | `drawn` | see something | the picture is not one flat color |
| 3 | `surface` | (be watched by a script) | `window.__game` has every field the spec describes, opens on the menu, and cannot be written to |
| 4 | `start` | start a round | Enter takes the menu to play, with health, ammunition and a running clock |
| 5 | `walk` | walk forward and back | a second of W moves a meter or more the way the view points; S the other way |
| 6 | `strafe` | step right and left | D moves to the right of the view, A to the left |
| 7 | `look` | look around with the mouse | the mouse moved right turns the view right; moved up, it looks up |
| 8 | `turn` | (be aimed by a script) | in test mode the arrow keys turn the view at about the speed the spec gives |
| 9 | `jump` | jump | Space lifts the player 0.3 m or more, and they land again |
| 10 | `world` | stay in the arena | twelve seconds of walking leaves the player inside it and on its ground |
| 11 | `view` | switch between first and third person | V changes the view; in third the camera is behind the player and farther away; V again brings it back |
| 12 | `fire` | fire | a click uses a round |
| 13 | `hit` | hit an enemy | a shot aimed at an enemy lowers its health |
| 14 | `defeat` | defeat an enemy | its health reaches zero, it is no longer alive, and the score rises |
| 15 | `reload` | reload | R fills the magazine from the reserve |
| 16 | `threat` | be in danger | an enemy reaches a player who stands still, and their health falls |
| 17 | `lose` | lose a round | health reaches zero and the round is lost |
| 18 | `again` | play again | Enter after a lost round starts another, at full health and no score |
| 19 | `win` | win a round | every enemy of the test round defeated, the round is won |
| 20 | `seed` | play the same round twice | the same seed puts the same enemies in the same places; another seed, others |
| 21 | `frames` | play without stutter | the game draws 30 pictures a second or more over eight seconds of a still scene, by its own count, and the browser's frames are not held up (run with a window, on the graphics card) |

Three of these are not things a player does: `surface`, `turn` and `seed` are what make the other eighteen checkable.

The protocol also asks of the repository itself, by `git` and by reading: that `npm ci && npm run build` works from a clean checkout and the checks above pass against the built files; that `ASSETS.md` accounts for every file the game loads that is not source code; and that no file of the game came from somewhere else.

## Only a person can tell

For the owner, ten minutes with each build, not knowing which is which (`PROTOCOL.md` section 3). A line or two each.

| | In ten minutes of play |
|---|---|
| 22 | **Both views are the same game.** In third person a shot lands where the crosshair points, the camera does not fight you, and switching in the middle of a fight costs you nothing. |
| 23 | **The arena is a place.** You know where you are, cover is worth standing behind, and the high ground is worth taking. |
| 24 | **You can hear it.** A shot, a hit, a step, an enemy falling, and none of it grates after five minutes. |
| 25 | **It is fair and you want another round.** What hurts you could be seen coming. A round takes a few minutes. |
| 26 | **It is its own.** Nothing looks or sounds as if it was taken from somewhere, and what the README says is in the game is in the game. |
