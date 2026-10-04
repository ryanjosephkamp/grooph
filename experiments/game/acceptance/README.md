# The checks no builder sees

About twenty things a player can do in the game of [`../SPEC.md`](../SPEC.md), checked after a run and never shown to it. [`LIST.md`](LIST.md) is the list: twenty-one a script can tell, five for the owner's own ten minutes.

**Nothing here has been run against a game. No game exists yet.**

## What is here

| | |
|---|---|
| [`LIST.md`](LIST.md) | the list |
| [`check.mjs`](check.mjs) | the twenty-one checks, with Playwright's browser: `node experiments/game/acceptance/check.mjs <address> [--headed]` |
| [`serve.mjs`](serve.mjs) | serves a folder of static files on this machine, for a game's `dist/` or for the stand-ins |
| [`stand-ins/`](stand-ins/) | two pages with the game's test surface and no game: one that works, one with every behavior off |
| [`prove.mjs`](prove.mjs) | runs the checks against the stand-ins and writes what they printed into `proof/` |
| [`proof/`](proof/) | the proof: `good.txt` (21 of 21 pass), `broken.txt` (21 of 21 fail), `one-at-a-time.txt` (each check fails when the behavior it looks for is off) |

## How a run is kept from them

- This folder is in grooph's repository and is never copied into a game's.
- Nothing a run is given names it. `SPEC.md` describes the test surface; it does not say what will be checked, and it does not mention this folder. The graph and its package do not either.
- A game's repository is cloned outside grooph's clone, the session is started in it, and its permissions stop at its own folder.
- After a run its transcript is searched for this folder's path and file names. A hit is written into the record and the run's results are reported as seen.

The stand-ins are not a start for the game and are never given to a builder: they are a flat drawing with the surface on it, there so that a check can be shown to pass and to fail.

## Running them

```bash
# against a build of the game, with a window so the frame rate is the graphics card's
node experiments/game/acceptance/serve.mjs <the game>/dist --port 4361 &
node experiments/game/acceptance/check.mjs http://127.0.0.1:4361/ --headed

# the proof, against the stand-ins (about fifteen minutes)
node experiments/game/acceptance/prove.mjs --port 4361
```

They use the browser Playwright installs for grooph's own web tests (`pnpm install`, then `pnpm --filter @grooph/web exec playwright install chromium`) and add no dependency. A request a page makes to another host is written down and refused, so nothing leaves the machine.

## What they do not check

The test round is one wave of three chasers. Waves, shooters, the heavy enemy, pickups, sound, how the arena looks, whether third person aims true: none of that is here. It is the critic's during the run and the owner's afterwards. A build could pass all twenty-one and be a poor game; a build that fails `start` is not a game yet.
