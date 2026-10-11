# Handoff 0108 · The recorder outside the project

**Stage:** 25 · **Lane:** Opus 5.5 · **Effort:** high, either way (it writes in a person's own settings: a careless install is found on their machine, not in a test) · **Browser tests on port:** none (the command line only) · **Branch:** `slice/0108-the-recorder-outside-the-project` · **Drafted:** 2026-10-11 · **Confirmed by owner:** 2026-10-11, on the review desk (card q87: "A: user level, the folders I list"; card q86: one of the first four lanes)

## Objective

grooph's recorder is installed inside the project it watches: its own file, the settings that run it and the events it writes are all in the folder a session works in. The watching check showed what that costs: the recorder's files were shown to the session in sixteen of twenty-four watched runs, and eight final replies mention its events folder ([`experiments/watching/RESULTS.md`](../../experiments/watching/RESULTS.md)). And a hook that a harness runs outside its sandbox is itself a file a session can write to.

When this slice is done a person can install the recorder once, at the user's level, for the folders they name, and a watched folder then holds nothing of grooph. [`handoffs/briefs/recorder-outside-the-project.md`](../briefs/recorder-outside-the-project.md) is the page written for the owner's choice: read it as the design.

It is also what lets the owner watch his other projects without putting grooph's files in their repositories, and it is the arm the second look at watching (slice 0111) will test: "watched from outside the project".

## Success criteria

1. **`grooph hooks install --user`** puts the hook's file under grooph's own folder in the person's home, adds its entries to the harness's user-level settings (Claude Code's `settings.json` in `~/.claude` or in the folder `CLAUDE_CONFIG_DIR` names; Codex's `hooks.json` in `~/.codex` or in the folder `CODEX_HOME` names), leaves every other setting as it was, changes nothing when it cannot read a settings file, and is safe to run twice. `grooph hooks remove --user` undoes it and keeps the events. Each shown by a test in a scratch home.
2. **A list of watched folders**, empty at first: `grooph hooks watch <folder>` and `grooph hooks unwatch <folder>` change it, and `grooph hooks status` prints it with what is installed where. With the list empty the hook writes nothing for any session. A test fires the hook for a session in a listed folder, in a folder inside one, and in a folder outside every one, and checks which left a line.
3. **The events are outside the project**: under grooph's folder in the home, in a folder named for the listed folder, one file per session as today. After a watched session, `git status` in the project shows nothing new and no file of grooph's is in it (a test lists the project before and after).
4. **The three readers find them.** In a listed folder that has no events of its own, `grooph sessions`, `grooph watch --sessions` and `grooph hooks status` with no source read that folder's events from the user-level store, and say in one line where they read from.
5. **The hook's promises hold in both layouts**: one line, nothing printed, exit 0 whatever happens, nothing an agent said, and no write through a link, at any folder from grooph's home folder down. The existing hook tests run against both layouts (`packages/cli/test/hooks.test.ts`), and `node experiments/watching/free-checks/run.mjs` still reports every input silent.
6. **What it costs is measured and said.** An install at the user's level is run by every session on the machine, at every event, listed or not. Three medians, 300 calls each and interleaved, in the pull request's description: a call in the project layout; a call in the user-level layout for a listed folder; and a call for a folder that is not listed, which must do nothing but read the list and leave. Node starting and doing nothing is the fourth, for scale (`experiments/watching/free-checks/run.mjs` measures it). The hook starts no other process. The owner's standing condition is that nothing costs speed: this is the number he will ask for.
7. **The install in a project is unchanged**, byte for byte in what it writes for a project that uses it, and the repository's own installed copy is the shipped file (`hooks.test.ts`, the last test).

## Read first

1. `handoffs/0108-the-recorder-outside-the-project/HANDOFF.md` (this file)
2. `handoffs/briefs/recorder-outside-the-project.md`
3. `packages/cli/hooks/grooph-event.mjs` and `packages/cli/test/hooks.test.ts`, whole
4. `packages/cli/src/commands/hooks.ts` and `packages/cli/src/events-io.ts`
5. `docs/subagents.md` §5 and §6, and `spec/contract.md` ("Watching")
6. `AGENTS.md` and `handoffs/README.md`

## Allowed changes

`packages/cli/hooks/grooph-event.mjs` and its installed copy `.grooph/hooks/grooph-event.mjs`; `packages/cli/src/commands/hooks.ts`, `events-io.ts`, `watch.ts` (the sessions source only), `help.ts`, `index.ts`, `paths.ts`; `packages/cli/test/**`; `docs/subagents.md` (§5 and §6), `docs/releases.md` (the section "Not yet released"), `docs/cli.md` by its generator; `handoffs/0108-the-recorder-outside-the-project/**`.

## Forbidden changes

- **The owner's real settings.** Never run the new install against `~/.claude`, `~/.codex` or `~/.grooph` on this Mac, by a test or by hand. Every test and every trial uses a scratch home and scratch configuration folders, named through the environment. Installing on his machine is his to do, after he has read the result.
- `packages/core/**` (slice 0104 is working in `events.ts`), anything slice 0103 is moving (`export`, `adopt`, `runs`, `run-io.ts`, the run half of `watch.ts`, `mcp-author.ts`), `packages/cli/hooks/grooph-events-push.mjs`.
- **Three files are shared with slice 0103**, which has them while its second pull request is open: `packages/cli/src/index.ts`, `commands/help.ts` and `commands/watch.ts`. Keep what you need in them to the fewest lines, make it your last commit, and ask the driver before you do.
- `experiments/game/**`. Its frozen starting contents pin the hook's bytes, so once the hook changes on `main` its `make-repo.sh` stops at the manifest and says how to build from the freeze. That is expected; do not "repair" either side.
- `docs/privacy.md`: propose its sentence in the pull request's description. Its words are the owner's to approve.
- `experiments/**`, the version, `docs/PROGRESS.md`, `docs/PLAN.md`, `handoffs/DRIVER.md`.
- A dependency. A pushed branch rewritten. A merge.

## Spec constraints that apply here

- `spec/contract.md`: "The recorder cannot steer. grooph's hook appends one line and exits 0. It prints nothing, to either stream"; "It never adds to what a model reads or has to do"; "It never sends a person's documents or records anywhere they did not send them."
- Amendments A-012 to A-017 stand: what a line may hold does not change.
- No model session is started here: nothing is run or paid for in this push without the owner's word for it. Whether a session notices a recorder installed this way is slice 0111's to find out, and nothing in this slice's documents says it does not.

## Design already decided

- **The mode is said, not guessed.** The settings entry that runs the hook says which layout it is in; the hook does not work it out from where its file sits.
- **A listed folder covers what is inside it.** A worktree kept somewhere else is listed by its own path. The hook does not ask git anything: starting a process costs tens of milliseconds an event.
- **One environment variable names grooph's home folder** (default: a `.grooph` folder in the person's home), so tests and a clean profile can point it at a scratch folder. `GROOPH_EVENTS_DIR` keeps its meaning.
- **Sending events to another machine stays with installs in a project** in this slice. `grooph events push`, run where only a user-level record exists, says so in one line and sends nothing.
- **The default list is empty**: the owner chose option A. Do not build B (every session on the machine).
- It starts from the link fix, which is on `main` since 2026-10-11 (#190) and also added the section "Not yet released" to `docs/releases.md`. Read that pull request's description first: the hook now steps into its folders and holds them, and this slice must keep that in both layouts.

## Implementer's choices

The names of the list's file and of a project's folder in the store (readable, and no two listed folders may share one); how `status` lays out two layouts at once; how the readers choose when a project has both an install of its own and a listing; the words of every new line, each held to: would a person who has never seen grooph know what happened.

## How to verify

```bash
pnpm install --frozen-lockfile && pnpm -r build
cd packages/cli && node --test 'dist/test/*.test.js'
node scripts/cli-reference.mjs --check && node scripts/american-english.mjs --check
node experiments/watching/free-checks/run.mjs --times 200
node --test scripts/lib/watching-check-paid.test.mjs
```

## Handback must contain

The `TEMPLATE-HANDBACK.md` sections, plus: the layout as built (every path it writes, in a table); the timing of criterion 6; each new sentence a person reads; the sentence proposed for the privacy page; what a fresh reader tried against the install and the hook, with its scripts kept under the slice folder; and what was left for slice 0111 to try.

## Prompt to paste

```text
You are a lane of grooph: slice 0108, the recorder outside the project. Read handoffs/0108-the-recorder-outside-the-project/HANDOFF.md first, then the page it names in handoffs/briefs/, then AGENTS.md. Work in your own worktree on branch slice/0108-the-recorder-outside-the-project, a draft pull request at the first push. No browser tests. Never run the new install against the real ~/.claude, ~/.codex or ~/.grooph on this Mac: scratch folders only. Do not edit docs/PROGRESS.md, docs/PLAN.md or handoffs/DRIVER.md, start no model session, and merge nothing. Have a fresh reader attack it before you mark it ready; then send the driver the head with SendMessage and push nothing more to it. Finish with the grooph-handback skill.
```
