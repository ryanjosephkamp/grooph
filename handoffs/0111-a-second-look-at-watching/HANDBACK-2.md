# Handback 0111, second pass · The folder check that stopped the Opus block

**Implementer:** Opus 5.5 (lane 0111) · **Branch:** `slice/0111-the-folder-check`, from `main` at `773952f9` · **Pull request:** a draft, for the owner's word · **Head commit:** sent to the driver by message · **Date:** 2026-10-12

## Status

`done`. One correction to the runner, with its tests, a dated note on the protocol's page, and the commands that bring it into the runs' checkout. **I started no run, changed nothing in the runs' checkout, and touched no record and no line of the ledger.** It merges only on the owner's word: it is the experiment's own machinery, changed between its fifth run and its sixth.

A fresh reader read it three times. The first read found three things wrong, one of them serious. The second found one more gap, older than this change, and two small ones. The third found that the runner's checksum does not cover every module the runner loads. The first two reads' findings are fixed here; the third's is answered with a check the driver runs, and said plainly ("The reader", below).

## What happened, checked at the source

I read the runs' checkout and the folders the runner kept; I wrote in neither.

- The five runs are recorded as the driver said, each ended by its session, by the runner `e70aa3a0`, with the hook `332b2e1d` and the built tool `938842ff`, at commit `348ee970`.
- The first outside run's record (`opus/four/outside-1`, session `a8a28d16`) has one problem: "the session's folder holds .claude, and in the outside arm the project holds nothing of grooph".
- In its kept folder `.claude` holds one thing: `.cc-writes`, an empty folder. No `.grooph`, no settings file, at the top or below it.
- The same empty folder is at the top of the other four kept folders, the two plain runs among them. The two watched runs' `.claude` holds it and the install's `settings.json`.
- **Below the top too.** In three of the five (both plain runs and the outside run) each package's folder holds an empty `.claude/.cc-writes` of its own. In the two watched runs none does. That is five runs, and I read nothing from it.
- **The first check had it too:** thirty of its thirty-six kept folders at the top, ten in each arm, every one empty; eight of them below the top as well, some in each arm. The six without are the six Sonnet runs of its wide task. All forty-one runs were under Claude Code 2.1.289. I do not know what makes the harness leave it.

## 1. The check, corrected

`inTheSessionsFolder(cwd)` in `scripts/lib/watching-second-look-paid.mjs` looks through the whole of a session's folder (not its `.git`, not any `node_modules`, through no link, and taking a name whatever its case) and sorts what it finds three ways, each by its path:

| | What it is | In the outside arm |
|---|---|---|
| **of an install** | a `.grooph`; `settings.json` or `settings.local.json` in a `.claude`; `hooks.json` in a `.codex` | a problem, in the words the runner already used |
| **the harness's own** | `.cc-writes` in a `.claude`, a folder, empty | recorded by its path, and no problem |
| **not known** | anything else in a `.claude`: another name; a `.claude` or a `.cc-writes` that is a file or a link; a `.cc-writes` with something in it (named, up to four); a `.codex` that is no folder; and a folder that cannot be read | a problem of its own kind, which stops the block for a person |

**Why this and not less.** The smallest change would have been to pass over `.claude` altogether. But a settings file there is exactly what an install in a project leaves, and it is what makes a harness run a hook: the arm's own claim is that the project holds none. **Why `.cc-writes` with something in it stops the block:** I know the folder only as empty, in forty-one kept folders. If it ever holds something I cannot say whose it is. **Why the whole folder:** the first version looked at the top alone, and the reader showed that a settings file in a package's folder passed as nothing. The harness leaves its own folder in packages' folders, so the check has to tell the two apart there as well. **Why a link is not followed:** the runner reads a session's folder as it is and trusts nothing in it. **Why any case:** this Mac's disk does not tell `.Claude` from `.claude`, and a harness would read either.

Run over all forty-one kept folders of both checks, reading only: nothing "not known" in any; an install's traces in every watched and invited run and in no plain or outside run.

The settings the runner writes are not touched, and nothing is deleted from a session's folder: the harness's folders are kept with the rest.

**Tests** (`scripts/lib/watching-second-look-paid.test.mjs`): one of the function over more than two dozen folders, each case the driver named among them, at the top and below it; and one of whole runs against the stand-in harness. With the harness's empty folders as the real run left them (the top and four packages) both outside runs of a round are made with no problem and the block goes on. With a settings file, with something in `.cc-writes`, with `.grooph`, and with a settings file in a package's folder, the block stops and the record says which.

## 2. The guard

**The exception is one file that names both runners:** `experiments/watching/second-look/the-corrected-runner.json` holds the earlier runner's whole checksum (`e70aa3a0…`), the corrected runner's whole checksum (`2b1aa420…`), and the reason. `madeFromAnother` passes a difference of runner only where the record's runner is the first **and** this checkout's runner is the second. Everything else is as it was: another hook, another build of the tool, another version, or any other runner on either side is refused unless `--another-checkout` says so by name.

- **Why a file and not a line of the runner.** The first version held the earlier checksum in the runner and nothing of the corrected one, so against the five records every runner passed, not this one alone. That was the reader's most serious finding. A script cannot hold its own checksum, so both are in a file beside the ledger, which is not one of the runner's six files.
- **Why not in the ledger.** The ledger in the runs' checkout has five lines that are not committed; a change to that file on `main` would have to be merged into them by hand.
- **Every later record says so:** `given.the_runners_checkout.runs_before_made_with_an_earlier_runner` names the runs and gives the reason. `--status` prints one line for it. The tables say which runner made which run, and say "the same thing" only of those two checksums: no record's own word is taken for it.
- **`--another-checkout` is not needed and should not be used** for the remaining runs: it would let a real difference of hook or tool pass under the same word.
- **A test pins it.** While the runner's five other files are what they were, this checkout's runner must be the corrected one to the last character. A later change to the runner's script fails that test until someone says it is another correction.
- **One more thing was tightened, which the reader found on its second read.** A checkout that cannot say what its hook, its built tool, its version or its runner is starts no run, and `--another-checkout` does not change that. Before, a thing with no checksum was not compared at all: with one unreadable file in the build, another build of the tool passed as the same. This is older than the correction and was on `main`. No recorded run was made that way: all five records name all four.

**How it is shown that a session is handed the same.**

1. **The whole difference between the two runners is one file's, and can be read:** 161 lines added and 9 changed in `scripts/lib/watching-second-look-paid.mjs`. They are the folder check and the reading of the exception (new functions), and inside `runOne`: the refusal above, before anything is made; one more field of the record; the folder check after the session; its three fields; and one sentence under problems. Then the lines of `--status` that say these things, and one of the dry run. None is in `build`, `launcherText`, `promptFor`, or the call that starts a session. The other five files of the runner have one checksum before and after (`7fe43bcf`), and the file above keeps it.
2. `experiments/watching/second-look/given-to-a-session.json` holds what a runner hands a session in each of the thirty-six runs: the prompt, the packages its folder is made of (a checksum of each task folder), what is closed to it, the minutes, the command, the environment, the profile's settings, and in the outside arm the launcher's whole text. It was made by the earlier runner, from an archive of `348ee970`. The six files of the runner in that archive are the ones the five records name by their checksum, and they and the six task folders are byte for byte those of the runs' checkout as it stands (compared file by file, reading only). With the corrected runner the same command prints the same file but for one line, the runner's own checksum.
3. A test holds the corrected runner to that file run by run, and shows the file is not blind: one more space at a prompt's end changes all thirty-six; another ceiling for one task of one block changes those nine; nothing closed to a watched session changes the twelve watched; another setting of the profile's changes all; one more line in the launcher changes the twelve outside.
4. **That file is put together from the pieces, so a second test ties it to a session really started.** In each arm a stand-in for the harness writes down what it was started with, and the test sets that beside what the file's maker says: every argument, the environment's variables by name and by value, the settings the profile held, the limits, and the launcher as it was kept.
5. `handoffs/0111-a-second-look-at-watching/the-recorded-runs-and-this-runner.mjs` sets the five real records beside the corrected runner: the prompt byte for byte, the command argument for argument, the names of the environment's variables, the limits, the settings the record kept, and for the outside run the launcher as the runner kept it. Each is the same in all five. Given a wrong profile folder it says which differ, so it is not blind either.

**What that does not cover, said plainly.**

- The tests would not catch every way a runner could hand a session something else. The reader made three that no test sees: a file written into the profile just before the session, a file's mode changed in the session's folder, a setting of the session's own repository. What holds those is 1 above, and that any runner but `2b1aa420` is refused when a run is asked for.
- **The runner's checksum is of six files, and the runner's script loads nine more modules that it does not cover** (`compare-arms-ef`, `compare-ledger`, `compare-prompt`, `compare-score`, `prove-check`, `prove-evidence`, `prove-ledger`, `prove-pattern`, `roles-or-information-paid`). That is as it was for the first five runs, and I did not widen the checksum in the middle of a look: the records already made hold the six-file one. The reader showed what it leaves open: with one value changed in `prove-pattern.mjs`, which every session's environment is made from, `--status` still named the runner `2b1aa420` and no difference. In all three places today those modules are byte for byte the same: the archive of `348ee970`, this branch, and the runs' checkout. **What I added instead is a check to run:** `given-to-a-session.json` now also keeps a checksum of each of the thirteen modules the runner's script loads, as they were at `348ee970`, and `node experiments/watching/second-look/given-to-a-session.mjs --check` sets a checkout beside the whole file. It is in section 5, to be run in the runs' checkout before the block goes on. It is a check a person runs, not a refusal the runner makes.
- The watched arm's install is made by the built tool, not by the runner: it is covered by the tool's checksum, which the runner compares, and not by the file above. The hook's file likewise.
- The comparison is of what is handed over, not of what the runner does afterward, which is what changed.

## 3. The words

The page changes only by dated note, and has one, at its end: "Changed after the first run", 2026-10-12. It says what stopped the block, what was found and in which kept folders, what was corrected, what else was tightened, that the first outside run's record keeps its one problem, how two runners are one look, how it is known a session is handed the same, and what that does not show. A test holds its heading and the two checksums it names.

**Every changed sentence a person reads** is in the pull request's description.

## 4. What else could misread `.claude/.cc-writes`

| Where | Does it? |
|---|---|
| The first check's two counts (`.grooph`, `.claude/settings.json`), which the second look keeps | No. A listing that shows `.claude` or `.claude/.cc-writes` matches neither name. |
| The second look's count of places outside the project | No. A test now shows a listing of the harness's folder, a call that names it and a reply that names it are in no count. |
| The watched arm's check that an install left exactly its three files (`installHook`, the first check's) | No. It is made when the folder is built, before any session. Nothing looks at a watched session's `.claude` afterward, and the two watched records have no problem. |
| The first check's runner | No. It never looked for `.claude` after a run. Its runs had the folder (thirty of thirty-six) and nothing was said of it. |
| The project's change (`project.diff`) | Not as it is: git does not show an empty folder. If the folder ever held a file, that file would be listed as changed, in any arm. |
| The profile's own check after an outside run | No. It looks at the profile, not at the session's folder. |
| Scoring | No. It runs the unseen suites in the packages' folders. |

**From reading the five real records with the tables script** (in a scratch copy; it had not been run on a real record before): it reads them without error. Three things the driver may want to know before reading results, none of them a fault of the runs:

- In `six` the plain run's counts of what was noticed are not zero (one call naming and three results showing `.grooph`). The page says why: `textkit`'s own checklist names `.grooph/`.
- The column "handed to the session, of kinds no plain run of the block was" shows `queued_command` for `six` watched. With one plain run a task so far, that column compares against very little.
- Turns were 5, 52, 10, 4 and 6: they are the session's own, as the page says.

## 5. Bringing it into the runs' checkout, with no rebuild

After the owner's word and the merge, with `<commit>` the merge's commit on `main` (or this branch's head):

```bash
cd ~/Documents/grooph/.claude/worktrees/watching-runs
git fetch origin
git checkout <commit> -- scripts/lib/watching-second-look-paid.mjs scripts/lib/watching-second-look-paid.test.mjs experiments/watching/second-look/README.md experiments/watching/second-look/tables.mjs experiments/watching/second-look/given-to-a-session.json experiments/watching/second-look/given-to-a-session.mjs experiments/watching/second-look/the-corrected-runner.json handoffs/0111-a-second-look-at-watching/the-recorded-runs-and-this-runner.mjs
node scripts/lib/watching-second-look-paid.mjs --status
node experiments/watching/second-look/given-to-a-session.mjs --check
```

Eight files, none under `packages/`.

I rehearsed exactly these commands on a scratch copy of the runs' checkout: a clone at its commit, with its ledger, its five records, its built tool and its installed packages brought in by reading them. Before the commands that copy's `--status` named the hook `332b2e1d`, the tool `938842ff` and the runner `e70aa3a0`, as the runs' checkout does. Afterward it printed what it had printed before, but for two lines:

- `this checkout's hook is 332b2e1d, its built tool 938842ff and its runner 2b1aa420 (commit 348ee970, with 10 file(s) changed since it; grooph 0.4.1); no run already recorded was made with another`
- `5 run(s) already recorded (opus/four/plain-1, opus/six/plain-1, opus/four/watched-1, opus/six/watched-1, opus/four/outside-1) were made with the runner e70aa3a0, which is counted as handing a session the same as this one: …`

The ledger's lines (`$16.04 counted of $200.00, in 5 line(s)`), the list of the thirty-six runs, and the last line are as they were: `next: opus/six/outside-1 (started with --block opus), which may cost up to $15.00; the ledger has room for it ($183.96 left)`. The ledger and every file of the five records had the same checksums before and after.

The last command printed two lines and ended with 0:

- `given to a session: the runner 2b1aa420 hands a session what the runner e70aa3a0 did, in each of the 36 runs`
- `the modules the runner's script loads: each of the 13 is byte for byte what it was when the runner e70aa3a0 made its runs`

If either line says `NOT THE SAME` or `NOT WHAT THEY WERE`, stop: it names the runs or the modules. (That would mean a file under `scripts/lib` in the runs' checkout is no longer what it was at `348ee970`.)

With one line added to one of the lab's files in that copy, `--status` said `opus/four/plain-1 WAS MADE WITH ANOTHER RUNNER, so a run from here is refused unless --another-checkout says so by name`. Only `2b1aa420` passes.

**Three traps.**

- **Do not `git merge` or `git pull` there, and do not build.** `main` has changed `packages/cli/package.json` since `348ee970`, and that file is part of what the built tool's checksum is made of. A merge there fast-forwards without a word, the tool's checksum moves from `938842ff`, and every run after is refused as made with another build. If it happens: `git checkout 348ee970 -- packages/cli/package.json` puts `938842ff` back.
- **A wrong `<commit>`.** Look for two things in `--status`: the runner `2b1aa420`, and the line about the five runs. A commit from before this change leaves the runner `e70aa3a0` and no such line, and the block would stop on the same false alarm. A commit where any of the runner's six files has changed since is refused as another runner. Either way nothing is spent; check out the eight files again from the right one.
- **`node experiments/watching/tables.mjs --check` fails in the runs' checkout** while it holds records and no results page. That is its rule, and CI does not run there.

If the hook or the tool shows another checksum than `332b2e1d` and `938842ff`, stop: something else changed. The block then goes on with the command it was started with, and its next run is the one it stopped before, `opus/six/outside-1`.

## The reader

One fresh reader (a subagent with no part in writing this), three reads, each of a pinned copy of a commit. Its scripts are in `reader-folder-check/`, the later reads' in `second-read/` and `third-read/` there.

**First read, of the first version.**

1. *Serious.* The exception named only the earlier runner, so any runner passed against the five records, and the tables took a record's own word that two runners were one. **Fixed:** section 2.
2. The file of what a session is handed left out the profile's settings, and was put together from pieces without being tied to a session really started: a runner that closed nothing to a watched session passed its test. **Fixed:** the settings are in it, and the test of the three arms sets it beside a stand-in really started.
3. The check looked at the top of the folder only. **Fixed:** section 1.
4. The note said the folder was the harness's own as a fact. **Reworded:** it is taken for it, and the note says why.

**Second read, of the fixes.**

1. *A real gap, older than this change.* A checksum that could not be made was not compared: with a link that leads nowhere in the built tool, `--status` said `its built tool unknown` and "no run already recorded was made with another". **Fixed:** such a checkout starts no run.
2. Some changes to what a session is handed pass every test and are held only by the checksum. **Partly answered:** the test of the three arms now compares the environment's values and the limits; the rest is said plainly in section 2 and in the note.
3. The folder check matched names in their exact case and passed over a `.codex` that is a link. **Fixed.**
4. The tables said "All are read together" beside a sentence that could say otherwise. **Reworded.**
5. It confirmed the note's counts against the kept folders and the records, the commands of section 5 on a fresh copy made the way I made mine, and the three traps.

**Third read, a short one, of those fixes.** Each answer holds: the link that leads nowhere is now refused, with and without `--another-checkout`, and the refusal cannot fire on the runs' checkout as it is (its hook, tool, version and runner can all be told); names in any case and a linked `.codex` now stop the block, and the forty-one kept folders read as before; the tables' two sentences no longer contradict. One thing more, older than this change:

1. *The runner's checksum covers six files, and the modules those load are outside it.* **Answered with a check, not a refusal:** section 2, "What that does not cover", and the second command of section 5. The note says so.
2. Wording, left as it is: beside the new refusal `--status` still prints "no run already recorded was made with another" and the `next:` line, as it does beside the refusal for another runner.
3. By design, and still so: a `.codex` folder holding anything but `hooks.json` passes as nothing (this look installs for Claude Code only), as do `node_modules`, a `.git` below the top, and anything behind a link.

It did not check the whole suite in a git clone of the head (CI does that on the pull request) or what a Codex install leaves.

## Verified, and how

| What | How | Result |
|---|---|---|
| The second look's tests | `node --test scripts/lib/watching-second-look-paid.test.mjs` | 39 pass, none fails, none is skipped. `main` has 32; seven are new. |
| The tests are not blind | Eleven changes, each made in a scratch copy and never in the worktree (`handoffs/0111-a-second-look-at-watching/mutants-of-the-folder-check.sh`, which says what each is and which test it has to fail) | Each of the eleven fails the test meant for it. A scratch copy is no git checkout, so two tests that need a commit fail in every copy, the unchanged one too. (The first time, one of the eleven was not made, because the line it changes had changed; the script now says so instead of running the copy unchanged, and that one was run again.) |
| The check, on what the harness really left | The corrected `inTheSessionsFolder` over all forty-one kept folders of both checks, reading only | Nothing "not known" in any. An install's traces in each of the twenty-six watched and invited runs, and in none of the fifteen plain and outside runs. The harness's folder in thirty-five. |
| A session is handed the same, by the file | `node experiments/watching/second-look/given-to-a-session.mjs <an archive of 348ee970>` and the same with no folder named | The first prints the kept file byte for byte. The second differs from it in one line, `made_by_the_runner`. |
| The archive is what the runs were made from | `cmp` of the runner's six files and three more it imports, and `diff -r` of the six task folders, between the archive and the runs' checkout | Each the same. |
| The five real records | `node handoffs/0111-a-second-look-at-watching/the-recorded-runs-and-this-runner.mjs ~/Documents/grooph/.claude/worktrees/watching-runs` | `5 recorded run(s) compared with the runner 2b1aa420: none differs`. With a wrong profile folder named: `5 DIFFER`, and it says which things. |
| What a session is handed and the modules the runner loads, as a command | `node experiments/watching/second-look/given-to-a-session.mjs --check`, here, on the archive, and in the scratch copy of the runs' checkout | Two lines and 0 each time. In a scratch copy with a line added to `compare-score.mjs`: the second line names it, and 1. With the model `opus` is pinned to changed in `prove-pattern.mjs`: `NOT THE SAME in 36 of 36 runs`, both modules named, and 1. |
| The correction changed one of the runner's six files | One checksum of the other five, here and in the archive | `7fe43bcf` in both. |
| The commands of section 5 | Run on a scratch copy of the runs' checkout, at this head | As section 5 says. The ledger and the records' files have the same checksums before and after. |
| American English | `node scripts/american-english.mjs --check` | nothing British in 826 public-facing files |
| The first check's tables | `node experiments/watching/tables.mjs --check` | `RESULTS.md holds the tables its records make` |
| The second look's tables | `node experiments/watching/second-look/tables.mjs --check` | nothing has been run, and there is no results page |

**Not verified.** No real session was started with the corrected runner: that is the next run, and it is the owner's. Browser tests were not run, as the lane's prompt says. The whole of the lab's tests as CI runs them was left to CI on the pull request.

## Deviations

- **The exception is in a file beside the ledger, not in the ledger**, where the driver's "for instance" put it. The reason is above (2).
- **The check looks through the whole folder and knows a Codex install's file**, which is more than the driver's four cases. The reader showed the top alone was not enough, and the harness itself leaves its folder below the top.
- **One refusal was added that is not about the folder check:** a checkout that cannot say what it is made with starts no run. It only refuses more, never less, and it closes a way for another build of the tool to pass. It is one condition in `runOne` and can be taken out without touching the rest, but the runner's checksum and the file that names it would have to be made again.
- **I read the runs' checkout and the kept folders**, as the driver allowed, and ran the runner's `--status` and the tables script on scratch copies of them. No dry run was made: a dry run builds a folder in the real profile. One thing to say plainly: the first time I made `given-to-a-session.json` I pointed its maker at the runs' checkout itself, and the runner's `checkout()` asks git for that checkout's status, which may refresh git's own index file there. No file of the working tree, no record and no line of the ledger was written; the driver's own `--status` there does the same. The file is now made from an archive instead.

## Risks and leftovers

- **The harness's folder is taken for the harness's, not shown to be.** It is there in plain runs of both checks, where nothing of grooph's is installed. I do not know what makes Claude Code leave it, and six runs on the same version left none. If a later version leaves something else in a session's `.claude` (a `worktrees` folder for a subagent, say; no kept folder has one), the block stops for a person, which is the safe way to be wrong.
- **A `.cc-writes` that is not empty when a run ends stops the block.** I have seen it only empty, in forty-one folders. If the harness is ever ended by the watchdog while it writes there, that would be a stop for a person and not a fault of the run.
- **Any edit of the runner's script now fails a test** until `the-corrected-runner.json` is brought up to date. That is on purpose while the look is being run. When the look is over, that test can be let go.
- **Whoever edits `the-corrected-runner.json` to name another runner lets that runner pass.** That is what the file is. It is tracked, a test holds it to the checkout, and every record keeps the checksum of the runner that made it, so it would show.
- **If one of the lab's four files of the runner changes on `main`** (`watching-check-paid.mjs`, `study-three-paid.mjs`, `compare-profile.mjs`, the profile's `settings.json`), `main`'s runner becomes another and the exception is off there: one test then skips and says why. The runs' checkout is not touched by that, because it takes eight files by name and nothing else.
- **A new invocation goes on past a record with a problem.** Before the correction too: the runs' checkout's own `--status` already names `opus/six/outside-1` as next. The stop after a problem is the end of that invocation, not a hold.
- **Not in the tool's checksum:** the packages the tool is installed with (`node_modules`) and the node that runs it. The reader named this; it is as it was on `main`, and I did not change it.
- **What a Codex install leaves in a project was read from the tool's source** (`.codex/hooks.json` and `.grooph/hooks/`), not tried.
- **The first outside run's kept folder has a `.git` whose own folder was last changed at 02:00 on 2026-10-12**, two hours after its record was written. I ran no git command there. If that was the driver's look, there is nothing to do; I say it because a `git status` in a kept folder rewrites its index.
- **Where the harness leaves its folder differs by arm in these five runs** (in each package's folder in the plain and outside runs, in none in the watched runs). It is five runs and I read nothing from it; the results page should not either without the rest.

## Prompt to paste into the driver session

```text
Handback 2 for slice 0111 (the folder check that stopped the Opus block) is at handoffs/0111-a-second-look-at-watching/HANDBACK-2.md on branch slice/0111-the-folder-check. Status: done; nothing was run, and it merges only on the owner's word. Please reconcile with the grooph-reconcile skill.
```
