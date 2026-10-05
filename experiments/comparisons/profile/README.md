# The clean profile for comparison sessions

How a session of study three would be started so that it loads nothing of the account's and can touch nothing but its own folder. **Nothing has been run with a model from it.** Its folders are made on the owner's Mac and he has signed it in.

## Parked on 2026-10-05

**Nothing here has been run. No model session has been started from this profile, and nothing has been paid.** Everything below was pre-registered, built, tested against a stand-in for the harness, and read; then the owner parked the experiments the same day ("npm yes, experiments parked, round two before the pause"). His yes to the three small steps, given earlier that day, is not withdrawn. It waits for him.

**Where things stand.** The profile's home is `~/grooph-compare` on the owner's Mac. Its folders are made, and he has signed it in. On 2026-10-05 the check held sixteen of sixteen, with the harness at 2.1.289.

**The order when work resumes.**

1. **The profile check**, which costs nothing: `node scripts/lib/compare-profile.mjs --check`. Sixteen lines, all of which have to hold.
2. **The first paid call**, from Terminal, by a person, on the owner's yes for it by name and the driver's words:

   ```bash
   node scripts/lib/profile-first-call-paid.mjs --spend --go "<the driver's words allowing this call>"
   ```

   At most $1.00 and ten minutes; fifteen to forty cents is expected. `--dry-run` in place of the two flags shows the command and what would refuse it, and starts nothing.
3. **Stop and read its record.** Nothing after it starts unless that record says it may.
4. **The brake pair and its prose pair**, the same day: four runs, at most $3.00 and twenty minutes each.
5. **The resume step:** one run, at most $2.00 and ten minutes.
6. **Roles or information:** twelve runs, at most $2.00 for a run of arm E and $4.00 for a run of arm F. Its scorer runs what a session wrote and does not start unless asked for by name.

All of these together stop at $20.00 on the comparisons ledger ([`study-three-first-steps.json`](../study-three-first-steps.json)); past that is the owner's word.

**Two things that will be different by then, and are handled.** The harness's version will be whatever is installed that day; each run's record keeps it, and the first call's record is held against it. And if the profile's settings have been changed, the same holds.

**Nothing in a pre-registration may be changed after the first call without a dated note on its page saying what changed and why.** Before it, a page may still be corrected. The one page that had already been merged when it was corrected, the brake experiment's, says what changed in a dated section.

It is the game experiment's profile made for headless comparison sessions. [`experiments/game/setup/PROFILE.md`](../../game/setup/PROFILE.md) says what each line is for and how it is known; this page says only what differs. It is a second profile in a home of its own (`~/grooph-compare`), so that nothing here reads or writes the game experiment's folders, and so that a session resumed "by a fresh session" finds no earlier session's history.

| | The game's profile | This one | Why |
|---|---|---|---|
| The session | a terminal session the owner starts and answers | headless: `-p`, the reply as JSON, a dollar ceiling for each session | a comparison run is started by the runner and nobody answers it |
| The network | the npm registry | none | the tasks install nothing |
| A browser | Playwright's, readable | none | no task drives one |
| The event hook | walled off from the session | none installed | no hook is part of these runs |
| Paths a session may not write | the hook's files | whatever a run names: a check's own files, for the brake experiment | so a check is read-only by a wall and not by an instruction. As in the game's profile there are two: the sandbox's `denyWrite` for commands, and `--disallowedTools` on the command line for the file tools. A builder with `Edit` and no shell meets only the second |
| Model aliases | not pinned | pinned as in study two | so no alias can reach a model this project never uses |
| Skills | the package's own | none (`--disable-slash-commands`) | as in study two: a prose arm must not be shown a skill's name |

## What can be checked with no session, and what it showed on 2026-10-05

`node scripts/lib/compare-profile.mjs --check` checks each line below and starts nothing.

- **The installed harness (2.1.289) takes every flag the command passes.** Thirteen flags, each found in its own help text.
- **A session's path holds `node` and `git` and not the `grooph` command.**
- **No instruction file sits in any folder above a session's, up to the root of the disk, and this Mac has no managed settings.**
- **The temp folder the settings close is the account's own**, asked of the system and not read from `TMPDIR`, which a shell may have set elsewhere.
- **A new configuration folder is not signed in.** Seen: `claude auth status` under a folder made for the test says so. The owner signs in to the real one once, in a terminal. Nothing can run until then.
- **The folders are not made.** `--make` makes them and writes the settings; it signs nothing in. I have not run it against the real home: making a folder in the owner's home is his to allow.

## What no check can show until one session is started

This is the first paid step, and it is not taken here. [`first-call/`](first-call/) says what that one short session is asked, what has to hold by its record before anything else is run, and what it still cannot show. What is not known until then:

- that a headless session starts under these settings at all, and reports the model it was asked for;
- that the sandbox is on for its commands, and that `node --test` and `npm test` run inside it with no network;
- that it lists no skill, no server and no subagent kind beyond the harness's own, read afterwards from its transcript;
- that a command cannot write a path the run closed, and cannot read `/tmp` or the account's temp folder;
- that the file tools refuse a path closed on the command line, for the session and for a subagent it starts;
- what a session is told when a call is refused in this mode;
- that npm, given its cache folder, does not look under `/Users`;
- what a refused call costs a headless session in this mode: a turn, or the run.

## What changes for the comparison runner

Study two's runner was built for its own five measures. From this profile four things are different, and each is work for the runner before a paid run:

1. **Material for a reviewer alone cannot sit outside the session's folder.** The file tools refuse any path outside it. Study two kept the held-out copy beside the project. Here it has to be inside, where a builder is kept from it by instruction, or not be given at all. The first three questions do not need it outside: the brake pair holds nothing back, the resume step dispatches no reviewer, and arm E gives the material to the one session.
2. **A session's folder is under the profile's home**, not under the account's temp folder, which the sandbox closes.
3. **The sandbox and the `dontAsk` mode stand in for study two's allowlist.** A command inside the sandbox needs no rule.
4. **The transcripts are under the profile's own `projects/` folder.** The digest and the lead-cost script already read `CLAUDE_CONFIG_DIR`, so they are pointed there.

## The paid path

[`scripts/lib/study-three-paid.mjs`](../../../scripts/lib/study-three-paid.mjs) is what starts a session from this profile, and the only thing that does. Four scripts use it, each with "paid" in its name, each refusing without `--spend` and `--go "<the driver's words>"`: the first call ([`first-call/`](first-call/)), the brake runs, the resume step and the runs of roles or information. **The three after the first call refuse to start unless the first call's latest record says they may, and was made with today's version of the harness and today's settings.**

In order, for every session:

1. **The gates, all of them before anything is written anywhere.**
   - The two flags.
   - No session of the game experiment open on this machine, since they draw on one allowance. The whole process list is read; a look that could not be made refuses.
   - This profile made, clean and signed in, and its work folder holding this session's folder and nothing else.
   - The harness found by its whole path. A session's own path does not hold the harness's folder, so the program is named whole.
   - The comparisons ledger willing.
   - The first steps' own ceiling not passed. The ledger has no cap of its own, so [`../study-three-first-steps.json`](../study-three-first-steps.json) holds what the owner approved and where these steps stop: what they have cost on the ledger, with this call at its ceiling, may not pass it.
2. **The settings for the run** written to the profile, with the paths the run closes, and read back. **They are put back when the call is over**, whatever happened, so the next check of the profile finds them as the repository has them.
3. **A ledger line opened before the call**, with the session's id, which is chosen beforehand.
4. **The call**, in a process group of its own, under a watchdog of dollars and minutes that is recorded apart and is never a graph's brake. At the limit of minutes the whole group is asked to end, and killed five seconds later if any of it is left. A runner that is itself interrupted, ended, or has its terminal closed ends its session first. When the session's own process is gone, whatever it left running in its group is killed, however it ended.
5. **The ledger line settled** with what the harness reported. A harness that could not be started spent nothing; any other call with no reported cost counts at its ceiling.
6. **The record copied** before anything is read from it or measured: the harness's output, the prompt, the settings, the digest of the transcripts, what the session was given at its start, the project's change, and the text files of its run folder. The transcripts stay on the machine and are named with their checksums.
7. **The session's folder and its temp files moved aside**, under `~/grooph-compare/kept/`, so the next session starts with both empty. Nothing is deleted. That folder and the profile's transcripts are closed to a later session's commands.

**Before the call, a refusal means nothing was started and nothing was spent**: the settings are as they were and the folder made for the session is taken away again. **Once a call has started, nothing is thrown and nothing is removed**, whatever a session left: each part of the record is kept on its own, what could not be kept is named in the record, and a ledger line that could not be settled stays marked as running, which refuses every later call until a person has settled it.

**A runner executes nothing a session wrote, with one exception that is said here.** A file a session could have replaced is read only if it is a plain file of a sane size, never through a link. A check is run from the repository's own copy. The project's change is read through a copy of the repository made before the session started and kept beside its folder, never through the session's own `.git`, so nothing a session configured there is run.

**The exception is the scorer of roles or information.** It is study two's: it runs the task's own `npm test` and the repository's held-out suite against the session's final tree, and that runs the code the session wrote. It does so outside the sandbox, with the account's rights, as it did in study two. A session's commands run inside the sandbox; what it wrote is run outside it when it is scored. Nothing here closes that. **So it is not done unless it is asked for by name.** The runner of roles or information records a run and does not score it; the scorer starts only with `--score-outside-the-sandbox`, given with the paid run or afterwards (`--score <run> --score-outside-the-sandbox`, which scores from the tree the runner kept and starts no session). Without it the runner prints what scoring does and runs nothing a session wrote.

**Nothing of the account's is left in a record.** The harness tells every session the account's e-mail address at its start, and paths under the home folder are in every command. Each file of a record is passed through one scrub before it is kept: the home folder's path becomes `~`, and an e-mail address is taken out. A file of a run folder that is not text is named and left out, since only text can be passed through it.

**A paid run is started from a terminal, by a person.** A tool with a time limit of its own would stop the runner in the middle of a call. A dry run (`--dry-run`, or `--next` for roles or information) makes a session's folder under the work folder, prints the command with the harness's real path and what a paid run would be refused for as things stand, and takes the folder away again. It starts nothing.

Its tests run all of this against a stand-in for the harness that calls no model ([`scripts/lib/fixtures/stand-in-harness.mjs`](../../../scripts/lib/fixtures/stand-in-harness.mjs)): `node --test scripts/lib/study-three-paid.test.mjs`.

## The files

- [`settings.json`](settings.json): the settings, with four placeholders the script fills: the npm cache folder, the account's temp folder, and the two folders closed to a session's commands, where earlier sessions' folders are moved to and where transcripts are kept.
- [`scripts/lib/compare-profile.mjs`](../../../scripts/lib/compare-profile.mjs): `--print` shows the folders, the settings and the command; `--make` makes the folders; `--check` is the check above. `--home` names another home for the profile and needs a folder after it. Before each run the runner writes the profile's settings with that run's closed paths.
