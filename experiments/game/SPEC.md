# Arena: the game

One browser game, built in six hours from this page. It is written for whoever builds it. Read all of it before the first line of code: section 4 says what to build first, section 6 what to drop when time is short, and section 7 describes a small surface the game must keep for automated play.

## 1. The game in a paragraph

A shooter in a small open arena that you can play in first person or in third, switching between them whenever you like. You stand in a walled valley of ruins and rock under an open sky, with a rifle. Enemies come at you in waves. Clear every wave and the round is won; fall to zero health and it is lost. Then you play again. Think of the open ground and old stone of a fantasy role-playing game, the over-the-shoulder view and readable shapes of a battle royale, and the short rounds and exact shooting of a tactical shooter, at the size one afternoon allows.

## 2. What is fixed

- **It runs in a browser, with three.js.** No backend, no account, no server code. The built game is static files.
- **It starts with `npm install && npm run dev`**, and `npm run build` writes the static files into `dist/`. The files in `dist/` play when served from any folder of any static host.
- **The only thing the game loads at run time is its own files.** It asks no other host for anything: no script, font, model, picture or sound from a network address.
- **No asset is downloaded from anywhere.** Every model, texture, sound and font the game uses is made by code in this repository: three.js geometry, textures drawn on a canvas or in a shader, sound generated with the Web Audio API. If Blender is on the machine, a Blender script may make a model: the script is committed, its output is committed, and `ASSETS.md` says which script made which file. Nothing is fetched from a model site, a texture site, a sound library, a font service or another repository, and nothing is copied in from elsewhere on the machine. This is a rule, not a preference: the repository is public and its license must be clean.
- **Packages come from npm and are few.** `three` is the one run-time dependency. A bundler with a dev server (Vite is the plain choice) and `playwright`, with which the game is played by a script from its first milestone, are development dependencies, and so is whatever else you test with. A second run-time package needs a line in the README saying why, and a permissive license. Code that ships inside the `three` package (its controls and helpers) may be used; a model, texture or font that ships inside any package may not.
- **`ASSETS.md`** lists every file the game loads that is not source code, with the script and the command that made it. If the game loads none, it says so.
- **JavaScript or TypeScript**, as you choose. How the code is laid out is yours.
- **The license is MIT.** The file is already in the repository.

## 3. What is in the game

Sizes are in meters and three.js's own world: y is up.

**The arena.** One place, about 120 m across, closed on every side by wall or cliff so that a player can neither leave nor fall out. Open ground in the middle. Things to stand behind: rocks, broken walls, pillars. At least one raised place you can walk up to, so that height matters. A sky, a sun, distance that fades.

**The player.** Walks with W, A, S and D, sprints with Shift, jumps with Space, looks with the mouse. A click on the game takes the pointer; Escape gives it back and pauses. The player has 100 health, stands on the ground, and is stopped by walls, cover and the arena's edge.

**Two views.** First person, and third person over the shoulder with the player's body in view. V switches between them at any moment of play. In third person the camera does not pass through walls. In both, a shot goes where the crosshair points.

**The rifle.** The starting weapon. A click fires one shot that lands at once where the crosshair points (no travel time). A magazine of 12 to 30 rounds, a reserve, R to reload in a second or two. Holding the button may keep firing.

**Enemies.** They are visibly not the player and visibly alive: they move, they react when hit, they fall when defeated.

- *Chasers* run at the player and strike up close.
- *Shooters*, later, keep their distance and fire slow shots a player can see coming and step away from.
- *A heavy one*, later still, closes the last wave.

**A round.** The menu, then play, then won or lost. A round is a number of waves; each wave is a set of enemies; the next wave comes when the last enemy of this one falls. Clear the last wave and the round is won. Reach zero health and it is lost. Either way the screen says so with the score, and Enter or a click starts another round.

**What the screen shows.** Health, ammunition in the magazine and in reserve, the wave, the score, a crosshair. When a shot lands, something says so.

**Sound.** A shot, a hit, an enemy falling, the player hurt, steps, a round won and lost. All of it generated in code. M mutes it.

**Keys, all fixed:** W A S D to move, the mouse to look, Space to jump, Shift to sprint, the left button to fire, R to reload, V to switch view, 1 and 2 to pick a weapon, Enter to start or restart, Escape to pause, M to mute.

## 4. Milestones

Seven of them, in this order. **At the end of every milestone the game is playable**: it builds, it starts, and everything a player could do at the end of the milestone before can still be done. A milestone is not finished while that is untrue. Commit at the end of each one.

The times are where the clock should stand, not limits: they say how big each piece is meant to be. A game you can walk in, shoot in, win and lose exists by about hour two. Everything after that makes it better.

| | By | At its end a player can |
|---|---|---|
| **M0 · A page** | 0:20 | open the page from `npm run dev` and see lit ground under a sky and a menu. `npm run build` writes `dist/`. The test surface (section 7) exists and says `menu`. The README says how to run it. |
| **M1 · Walk** | 1:00 | start a round, walk, sprint, jump and look around. Walls and a few blocks stop them. They cannot leave the arena or fall out of it. |
| **M2 · Shoot, win, lose** | 2:00 | fire the rifle and reload it. Chasers come, take hits, fall, and hurt on contact. Clearing them wins the round and zero health loses it. The screen shows health, ammunition and score. Enter plays again. Test mode (section 7) is complete. |
| **M3 · Two views** | 2:45 | press V and play in third person, with a body in view and a camera that stays out of the walls, and press V again. Shots land where the crosshair points in both. |
| **M4 · A place** | 3:45 | fight in an arena worth looking at: cover, a raised place, ruins and rock made in code, a sky, light and shadow, fading distance. Three waves, each harder. Health and ammunition lie around to pick up. |
| **M5 · Feel** | 4:45 | hear the game and feel a hit: generated sound, a hit marker, enemies that flinch, a flash at the muzzle, steps, bodies that move when they walk, a sign of where damage came from, a pause screen that lists the keys. |
| **M6 · Depth** | 5:30 | meet shooters and step out of the way of their shots, pick a second weapon with 2, face a heavy enemy in the last wave, see their best score kept between visits, and set the mouse's speed and the volume. |

The last half hour is not a milestone. It is for the README (how to run, the keys, what is in the game, what was cut), `ASSETS.md`, a final build, and one more play through.

## 5. What good looks like

- **It plays.** At 1280 × 720 on a laptop it holds 30 frames a second or more; 60 is the aim.
- **It reads.** A player can tell at a glance what is ground, what is cover, what is an enemy and where they are being hit from. Plain shapes with clear color beat detail that is hard to read.
- **It is fair.** An enemy that hurts you can be seen and heard coming. A round takes a few minutes.
- **It is one thing.** The second view, the sound and the later enemies belong to the same game as the first hour's.
- **It is honest about itself.** The README says what is there and what is not.

## 6. If time is short

Drop from the end, in this order, and say what was dropped in the README. Never drop anything in M0 to M3 or in section 7.

1. Settings and the kept best score (M6).
2. The heavy enemy (M6).
3. The second weapon (M6).
4. Shooters (M6).
5. Movement of bodies when they walk, and the sign of where damage came from (M5).
6. Pickups (M4).
7. Shadows, and the third wave's extra difficulty (M4).

A smaller game that works is better than a larger one that does not: a milestone done to half its list and playable counts for more than one done to all of it and broken.

## 7. The test surface

The game is played by scripts as well as by people, at the end of every milestone and after the six hours. For that it keeps one small, read-only surface and two flags. They are part of the game, they ship in the build, and they do not change how it plays for a person.

**`window.__game`** is an object that says where the game is. Reading it gives the state at that moment. Writing to it changes nothing.

```ts
window.__game: {
  surface: 1,                                   // the version of this description
  phase: "menu" | "playing" | "paused" | "won" | "lost",
  seed: number | null,                          // the seed in use, or null
  test: boolean,                                // whether test mode is on
  view: "first" | "third",
  player: {
    position: { x, y, z },                      // the player's feet
    forward: { x, y, z },                       // a unit vector: where the view points, in both views
    health: number, maxHealth: number,
    ammo: number,                               // rounds in the magazine of the weapon in hand
    reserve: number,                            // rounds not yet loaded
    grounded: boolean,
  },
  camera: { position: { x, y, z } },            // where the picture is taken from
  enemies: Array<{
    id: string, kind: string,                   // "chaser", "shooter", "heavy"
    position: { x, y, z },                      // the middle of its body: where a shot should land
    health: number, alive: boolean,
  }>,                                           // every enemy of the wave in play, fallen ones included
  score: number,
  wave: number, waves: number,                  // the wave in play, counted from 1, and how many the round has
  time: number,                                 // seconds of play in this round
  frames: number,                               // pictures drawn since the page opened
}
```

**`?seed=<whole number>`** in the address fixes everything the game draws by chance, so that the same seed starts the same round: the same enemies in the same places.

**`?test=1`** turns on test mode, which changes four things and nothing else:

1. **Keys and the mouse work without the pointer being taken.** A browser driven by a script cannot always take it.
2. **Enter starts a round from the menu** and starts another after a round is won or lost, with no click.
3. **The arrow keys turn the view**: left and right at 60 degrees a second, up and down at 30. Without the flag they do nothing.
4. **A round is the test round**: one wave of three chasers and nothing else. The seed places them 20 to 30 m from the player, within 45 degrees of where the player faces, with open ground between. They come at about 3 m a second. Each falls to three hits of the rifle or fewer. A chaser in contact takes between five seconds and thirty to bring a player from full health to zero. The player starts in first person, facing them, with a full magazine.

The page opens on the menu in either mode. Nothing in the surface may let a script do what a player could not: it reads, and the two flags make the game repeatable and reachable.

## 8. When it is finished

When the clock stops, the work stops, and the game is whatever the last playable commit holds. Finished well means: the seven milestones a player can walk through in order, a build in `dist/` that plays from a static host, a README a stranger can follow, an `ASSETS.md` that accounts for every file, and nothing in the repository that came from somewhere else.
