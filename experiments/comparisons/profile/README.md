# The clean profile for comparison sessions

How a session of study three would be started so that it loads nothing of the account's and can touch nothing but its own folder. **Nothing has been run with a model from it. The folders are not made on this Mac, and the profile is not signed in.**

It is the game experiment's profile made for headless comparison sessions. [`experiments/game/setup/PROFILE.md`](../../game/setup/PROFILE.md) says what each line is for and how it is known; this page says only what differs. It is a second profile in a home of its own (`~/grooph-compare`), so that nothing here reads or writes the game experiment's folders, and so that a session resumed "by a fresh session" finds no earlier session's history.

| | The game's profile | This one | Why |
|---|---|---|---|
| The session | a terminal session the owner starts and answers | headless: `-p`, the reply as JSON, a dollar ceiling for each session | a comparison run is started by the runner and nobody answers it |
| The network | the npm registry | none | the tasks install nothing |
| A browser | Playwright's, readable | none | no task drives one |
| The event hook | walled off from the session | none installed | no hook is part of these runs |
| Paths no command may write | the hook's files | whatever a run names: a check's own files, for the brake experiment | so a check is read-only by the sandbox and not by an instruction |
| Model aliases | not pinned | pinned as in study two | so no alias can reach a model this project never uses |
| Skills | the package's own | none (`--disable-slash-commands`) | as in study two: a prose arm must not be shown a skill's name |

## What can be checked with no session, and what it showed on 2026-10-05

`node scripts/lib/compare-profile.mjs --check` checks each line below and starts nothing.

- **The installed harness (2.1.289) takes every flag the command passes.** Twelve flags, each found in its own help text.
- **A session's path holds `node` and `git` and not the `grooph` command.**
- **No instruction file sits above a session's folder, and this Mac has no managed settings.**
- **A new configuration folder is not signed in.** Seen: `claude auth status` under a folder made for the test says so. The owner signs in to the real one once, in a terminal. Nothing can run until then.
- **The folders are not made.** `--make` makes them and writes the settings; it signs nothing in. I have not run it against the real home: making a folder in the owner's home is his to allow.

## What no check can show until one session is started

This is the first paid step, and it is not taken here. One call that asks for one word, at most about fifteen cents, recorded like any run:

- that a headless session starts under these settings at all, and reports the model it was asked for;
- that the sandbox is on for its commands, and that `node --test` and `npm test` run inside it with no network;
- that it lists no skill, no server and no subagent kind beyond the harness's own, read afterwards from its transcript;
- that a command cannot write a path the run closed, and cannot read `/tmp` or the account's temp folder;
- that npm, given its cache folder, does not look under `/Users`;
- what a refused call costs a headless session in this mode: a turn, or the run.

## What changes for the comparison runner

Study two's runner was built for its own five measures. From this profile four things are different, and each is work for the runner before a paid run:

1. **Material for a reviewer alone cannot sit outside the session's folder.** The file tools refuse any path outside it. Study two kept the held-out copy beside the project. Here it has to be inside, where a builder is kept from it by instruction, or not be given at all. The first three questions do not need it outside: the brake pair holds nothing back, the resume step dispatches no reviewer, and arm E gives the material to the one session.
2. **A session's folder is under the profile's home**, not under the account's temp folder, which the sandbox closes.
3. **The sandbox and the `dontAsk` mode stand in for study two's allowlist.** A command inside the sandbox needs no rule.
4. **The transcripts are under the profile's own `projects/` folder.** The digest and the lead-cost script already read `CLAUDE_CONFIG_DIR`, so they are pointed there.

## The files

- [`settings.json`](settings.json): the settings, with two placeholders the script fills (the npm cache folder and the account's temp folder).
- [`scripts/lib/compare-profile.mjs`](../../../scripts/lib/compare-profile.mjs): `--print` shows the folders, the settings and the command; `--make` makes the folders; `--check` is the check above.
