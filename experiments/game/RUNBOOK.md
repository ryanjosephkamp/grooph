# The Claude Code run: what to do, in order

For the owner. Each step is a line to paste into Terminal (the app, not a terminal inside an editor or the Claude desktop app) and what you should then see. Where a line says **stop**, stop and tell the driver; do not improvise, because whatever is done for this run has to be done the same for Codex.

Nothing below has been run with a model. The rehearsal (part 3) is where the profile, the package and the browser meet a session for the first time; that is what it is for.

Three folders are made, all in `~/grooph-game`, outside grooph's clone: `profile-claude` (the clean profile), `rehearsal-claude` (a scratch copy of the starting contents) and `grooph-game-experiment-claude` (the game's repository).

## 1. Once: the scripts and the machine

```bash
cd ~/Documents/grooph && git pull && pnpm install
```

You should see `Already up to date` or a list of files, then `Done`. Every line below is run from this folder.

```bash
shasum -a 256 -c experiments/game/setup/frozen.sha256
```

Fourteen lines, each ending `OK`: the spec, the graph and the checks are what was frozen. Anything else: **stop**.

```bash
npm view playwright version && npx -y playwright@latest install chromium
```

A version number (1.63.0 on 2026-10-04), then either nothing more or a download of about 150 MB. This is the browser the critic drives; a session cannot fetch it for itself, because it may reach the npm registry and nothing else.

```bash
pnpm --filter @grooph/web exec playwright install chromium
```

The browser with a window that the checks are run in after the run (part 6). Nothing more, or one more download.

## 2. Once: the clean profile, and signing in to it

```bash
experiments/game/setup/make-profile.sh
```

Three lines naming `~/grooph-game/profile-claude`, its settings file and npm's cache.

```bash
experiments/game/setup/start-claude.sh sign-in
```

Claude Code opens in an empty folder, as if newly installed: it asks for a color theme and whether you trust the folder (yes). Then, inside it, type these one at a time:

```text
/login
```

The sign-in, in your browser. Use the subscription this run is to be paid from.

```text
/status
```

That account, and the model `claude-opus-5-5`.

```text
/mcp
```

No servers.

```text
/memory
```

No memory files.

```text
!command -v grooph || echo not-on-the-path
```

`not-on-the-path`.

```text
/exit
```

If `/mcp` lists a server, `/memory` lists a file, or the line before the last prints a path: **stop**. The profile is not clean.

## 3. The rehearsal: twenty minutes in a scratch folder

It is a model session, recorded like the run. It is yours to start.

```bash
experiments/game/setup/make-repo.sh --rehearsal
```

`made /Users/…/grooph-game/rehearsal-claude`, seventeen files, and `the tree:    3238a9052ce7765c79990029bbff6bccd88628bf`. A different tree, or a refusal: **stop**.

```bash
caffeinate -dims &
```

Nothing is printed. The Mac will not sleep until this terminal window is closed.

```bash
experiments/game/setup/start-claude.sh rehearsal
```

`the record: …/runs/claude-code/rehearsal/setup.txt`, then Claude Code opens in the scratch folder. Trust the folder: yes. Now open a **second** Terminal window and copy the kickoff:

```bash
pbcopy < ~/grooph-game/rehearsal-claude/.grooph/arena/KICKOFF.md
```

Paste it into the session (Cmd-V) and press Return. Within a minute or two the session asks at its start gate. Answer:

```text
start
```

Then leave it for twenty minutes and watch. In the second window you can look without touching the session:

```bash
git -C ~/grooph-game/rehearsal-claude log --oneline; ls ~/grooph-game/rehearsal-claude
```

**What to look for:**

- **It never asks permission.** It cannot: a call outside its rules is refused and it is told. A line saying a command or a read was denied is worth writing down; a session waiting on you for a yes is a fault in the profile, **stop**.
- **`npm install` worked**: a `node_modules` folder and a `package-lock.json` appear. If it says it cannot reach the registry or cannot write its cache, that is the profile: **stop**.
- **The critic drove a browser**: it says it played the page, and a picture (a `.png`) appears somewhere in the folder. If it says the browser could not start, or that it needs to download one: **stop**.
- **Commits appear** in `git log`, by the builder, with no push.
- **It asks you nothing** after the start gate.

At twenty minutes, in the session: press Esc, then type `/cost` and note what it prints, then `/exit`. Then:

```bash
experiments/game/setup/record.sh rehearsal
```

It copies the record and prints what it found: how many commits, which models answered (they should be `claude-opus-5-5` and `claude-sonnet-5-5` and no other), whether anything of the held-out checks appears in the transcript (every count should be 0), and what was refused. Send that output to the driver with what you saw. **The run does not start until the driver has read it.**

## 4. The push of the first commit

On your word, once the rehearsal is read.

```bash
experiments/game/setup/make-repo.sh
```

`made /Users/…/grooph-game/grooph-game-experiment-claude`, the same seventeen files, the same tree `3238a9052ce7765c79990029bbff6bccd88628bf`, and at the end two lines. Paste those two lines. The first names the repository on GitHub; the second replaces the blank README GitHub made it with, so that the repository's first commit holds the starting contents and nothing else. Afterwards https://github.com/ryanjosephkamp/grooph-game-experiment-claude shows seventeen files and one commit.

## 5. The run

Six hours at most, then a wall at 6 hours 15 minutes. Close anything of grooph's that is serving a page on this Mac first (`grooph watch`, a preview).

```bash
caffeinate -dims &
experiments/game/setup/start-claude.sh run
```

`the record: …/runs/claude-code/run/setup.txt`, then Claude Code opens in the game's folder. Trust the folder: yes. In the second window:

```bash
pbcopy < ~/grooph-game/grooph-game-experiment-claude/.grooph/arena/KICKOFF.md
```

Paste it into the session and press Return. When it asks at its start gate, answer within a minute:

```text
start
```

and, in the second window, write the time down. This is when the clock starts:

```bash
cd ~/Documents/grooph && echo "$(date -u +%FT%TZ) start answered; the wall is at $(date -u -v+6H -v+15M +%FT%TZ)" | tee -a experiments/game/runs/claude-code/run/owner-notes.txt
```

**Then leave it.** Say nothing to it: no hint, no correction, no "go on".

**If it stops and asks something in the middle**, paste exactly this, and nothing else:

```text
Go on as the lead brief says. Nobody is here until the end.
```

and write it down, with what it asked:

```bash
echo "$(date -u +%FT%TZ) interruption: it asked <what>; given the one line" >> experiments/game/runs/claude-code/run/owner-notes.txt
```

**If Claude Code says the account has reached its usage limit**, the session stops by itself and says when the limit resets. Do nothing: do not switch the account or the model. The clock goes on. Write down when it stopped and when it went on again:

```bash
echo "$(date -u +%FT%TZ) usage limit: paused" >> experiments/game/runs/claude-code/run/owner-notes.txt
echo "$(date -u +%FT%TZ) usage limit: went on again" >> experiments/game/runs/claude-code/run/owner-notes.txt
```

If it does not go on by itself once the limit has reset, give it the one line above and write that down as an interruption. (The other lanes spend from the same weekly allowance, which resets on Monday at about 11 a.m. Eastern. A run started when little of it is left may spend most of its six hours paused.)

**At the end gate** the session says it is done and asks. Read `FINAL.md` in the game's folder, then answer:

```text
close
```

**At the wall**, 6 hours 15 minutes after "start", if it is still working: press Esc, and write that the wall came:

```bash
echo "$(date -u +%FT%TZ) the wall: the session was ended still working" >> experiments/game/runs/claude-code/run/owner-notes.txt
```

Either way, before leaving the session type `/cost`, copy what it prints into `owner-notes.txt`, then `/exit`. Then:

```bash
experiments/game/setup/record.sh run
git -C ~/grooph-game/grooph-game-experiment-claude push origin main --tags
```

The first copies the record and prints what it found; the second puts the game on GitHub (a session cannot push). Send the first one's output to the driver.

## 6. After the run: the result commit and the checks

Not before the session has ended, and nothing it prints is shown to any session. It takes a few minutes for each commit it has to try, then about a quarter of an hour for the checks; three browser windows open and close by themselves, one after another. Leave the Mac alone while they do: the frame-rate check is watching.

```bash
node experiments/game/setup/score.mjs run
```

`the result commit: …` with how it was found (the commit tagged `final`, or with no such tag the newest commit that builds and whose own play scripts pass), then three lines `run 1: n of 21 pass`, and a last line with how many pass all three. The table is in `experiments/game/runs/claude-code/run/after/score.md`. If it says there is no result commit, that is a finding and not a fault of the script: send it to the driver as it is.

After the rehearsal the same line with `rehearsal` in place of `run` shows the checks a real three.js page for the first time (`PROTOCOL.md` §7, 5). What a twenty-minute build passes is not a result; it is a look at the checks.

## If something is not as written

**Stop**, leave the session as it is if one is open, and tell the driver what you saw. A start that failed before the start gate was answered costs nothing: the clock had not started. `start-claude.sh` will not start the same name twice without being told what became of the first, so that no session goes unrecorded.
