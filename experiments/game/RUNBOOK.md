# The Claude Code run: what to do, in order

For the owner. Each step is a line to paste into Terminal (the app, not a terminal inside an editor or the Claude desktop app) and what you should then see. Where a line says **stop**, stop and tell the driver; do not improvise, because whatever is done for this run has to be done the same for Codex.

Nothing below has been run with a model. The rehearsal (part 3) is where the profile, the package and the browser meet a session for the first time; that is what it is for.

The folders are made in `~/grooph-game`, outside grooph's clone: `profile-claude` (the clean profile), `npm-cache-claude` and `t` (npm's cache and the session's temp folder, both empty at first), `rehearsal-claude` (a scratch copy of the starting contents) and `grooph-game-experiment-claude` (the game's repository). After the rehearsal its leftovers are moved to `~/grooph-game-kept`.

## 1. Once: the scripts and the machine

The scripts below are on `main` of grooph's repository once the driver has said the pull request that holds them is merged. Not before: until then `main` does not have them.

```bash
cd ~/Documents/grooph && git status -sb | head -3
```

The first line should be `## main...origin/main`, with nothing under it. If it names another branch, or lists files under it: **stop** and tell the driver. Do not switch branches or put the files aside yourself: another session may be working in this folder.

```bash
git pull --ff-only && pnpm install && ls experiments/game/setup/start-claude.sh experiments/game/setup/clear-rehearsal.sh
```

`Already up to date` or a list of files, then `Done`, then the two file names. `No such file`: the pull request is not merged yet, **stop**. Nothing needs building by hand: `make-repo.sh` builds the compiler itself, from what is checked out. Every line below is run from this folder.

If `make-repo.sh` later stops with "what was built is not what was frozen", something merged since the freeze changed what the compiler writes. It prints what to do; **stop** and tell the driver first.

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

Four lines naming `~/grooph-game/profile-claude`, its settings file, npm's cache and the session's own temp folder.

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
/usage
```

What is left of the account's weekly allowance and when it resets. Write it down for the driver: a run started when little is left ends at its first pause (part 5). Look now, not later: after the rehearsal has been cleared, opening this sign-in session again leaves files the run would refuse to start beside.

```text
/mcp
```

No servers.

```text
/memory
```

No memory files.

```text
/skills
```

None of yours: no `grooph-design`, nothing you have installed. (Claude Code's own built-in ones may be listed.)

```text
!command -v grooph || echo not-on-the-path
```

`not-on-the-path`, and no reply from Claude after it: the profile is set so that a line typed with `!` is run and not answered.

```text
/exit
```

If `/mcp` lists a server, `/memory` lists a file, `/skills` lists one of yours, the `!` line prints a path, or Claude answers it: **stop**. The profile is not clean.

Then, back in Terminal:

```bash
experiments/game/setup/make-profile.sh --check
```

`the profile at … is as it should be`. Anything else: **stop**. Signing in is the first time Claude Code itself writes into the profile, and this looks at what it wrote: no skill, no plugin, no server.

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

`the record: …/runs/claude-code/rehearsal/setup.txt`, then Claude Code opens in the scratch folder. Trust the folder: yes.

If instead it says that port 4361 is open or that something of the checks' folder is running: another session on this Mac is running the held-out checks, and a session's commands could reach what it serves. **Stop** and tell the driver; it starts when that has ended. Now open a **second** Terminal window and copy the kickoff:

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

It copies the record and prints what it found:

- how many commits, and which models answered (they should be `claude-opus-5-5` and `claude-sonnet-5-5` and no other);
- whether anything of the held-out checks, or of another session's temp folders, appears in the transcript (every count should be 0);
- which commands reached for a system service (every count should be 0);
- what the session was given at its start: the skills, the kinds of subagent, the servers, the instruction files. `arena` is the package's own skill; a line under `TO BE READ BY A PERSON` is a fault of the profile;
- whether the hook's files and the package under `.claude/` are as the first commit had them (they must be: `same`);
- what was refused.

Send that output to the driver with what you saw. **The run does not start until the driver has read it.**

When the driver has read it, and before the run:

```bash
experiments/game/setup/clear-rehearsal.sh
```

It moves what the rehearsal left (its folder, its transcript, the npm cache it filled, its temp files) to `~/grooph-game-kept/`, deletes nothing, and says where each went. The run starts with none of it, and the Codex run will start the same way. `start-claude.sh run` refuses until this is done.

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
echo "$(date -u +%FT%TZ) start answered; the wall is at $(date -u -v+6H -v+15M +%FT%TZ)" | tee -a ~/Documents/grooph/experiments/game/runs/claude-code/run/owner-notes.txt
```

**Then leave it.** Say nothing to it: no hint, no correction, no "go on".

**If it stops and asks something in the middle**, paste exactly this, and nothing else:

```text
Go on as the lead brief says. Nobody is here until the end.
```

and write it down, with what it asked:

```bash
echo "$(date -u +%FT%TZ) interruption: it asked <what>; given the one line" >> ~/Documents/grooph/experiments/game/runs/claude-code/run/owner-notes.txt
```

**If Claude Code says the account has reached its usage limit**, the bottom of the session shows two lines: `Usage limit reached · limit resets <time>` and, when it will go on by itself, `Continuing automatically at <time> · esc to cancel`. The clock goes on either way (`PROTOCOL.md` sections 2 and 10). Do not press Esc, do not switch the account or the model, do not type `/usage-credits`. Write down when it stopped:

```bash
echo "$(date -u +%FT%TZ) usage limit: paused; it says: <the two lines>" >> ~/Documents/grooph/experiments/game/runs/claude-code/run/owner-notes.txt
```

Then one of three things, the same in both runs:

- **It goes on by itself at the reset** (`Usage limit reset · continuing automatically`). This is what a five-hour limit does. Do nothing but write the time:

  ```bash
  echo "$(date -u +%FT%TZ) usage limit: went on again by itself" >> ~/Documents/grooph/experiments/game/runs/claude-code/run/owner-notes.txt
  ```

- **It shows `Press enter to continue`**, or the reset time has passed by five minutes and nothing has moved: press Return once, and nothing else. If it is then at a prompt and still not working, paste the one line above. Either is written down as an interruption:

  ```bash
  echo "$(date -u +%FT%TZ) usage limit: did not go on by itself; given <Return | the one line>" >> ~/Documents/grooph/experiments/game/runs/claude-code/run/owner-notes.txt
  ```

- **The reset is after the wall, there is no `Continuing automatically` line, or it says `Automatic continue stopped after repeated usage-limit hits`.** The first two are what the weekly limit does: Claude Code does not wait for a reset more than a day away. The third is what it says after stopping at the limit three times running. Then the run is over where it stands. Leave the session as it is until the wall, in case it does go on; at the wall end it as below. The result is the last commit that builds, as for any run the wall ends.

(The other lanes spend from the same weekly allowance, which resets on Monday at about 11 a.m. Eastern. You wrote down what was left at the sign-in, in part 2; ask the driver whether it is enough before starting the run.)

**At the end gate** the session says it is done and asks. Read `FINAL.md` in the game's folder, then answer:

```text
close
```

**At the wall**, 6 hours 15 minutes after "start", if it is still working: press Esc, and write that the wall came:

```bash
echo "$(date -u +%FT%TZ) the wall: the session was ended still working" >> ~/Documents/grooph/experiments/game/runs/claude-code/run/owner-notes.txt
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

After the rehearsal the same line with `rehearsal` in place of `run` shows the checks a real three.js page for the first time (`PROTOCOL.md` §7, 5). What a twenty-minute build passes is not a result; it is a look at the checks. Its place is after `record.sh rehearsal` and **before** `clear-rehearsal.sh`, which moves the folder it reads; and it must have finished before the run is started.

**The checks are never run or served while a session of the experiment is open.** A session's commands can reach this machine's `localhost`, and the checks are served there while they run. `score.mjs` refuses to start while one is open, and `start-claude.sh` refuses to start a session while the checks' port is.

## If something is not as written

**Stop**, leave the session as it is if one is open, and tell the driver what you saw. A start that failed before the start gate was answered costs nothing: the clock had not started. `start-claude.sh` will not start the same name twice without being told what became of the first, so that no session goes unrecorded.
