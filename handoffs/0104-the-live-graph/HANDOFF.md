# Handoff 0104 · The live graph of one session, part one: the record as a graph

**Stage:** 25 · **Lane:** Opus 5.5 · **Effort:** extra high (high is the floor: this is the shape every later view, the replay and Codex inherit) · **Browser tests on port:** none in part one (4369 when part two comes) · **Branch:** `slice/0104-the-record-as-a-graph` · **Drafted:** 2026-10-11 · **Confirmed by owner:** 2026-10-11, on the review desk (card q86: one of the first four lanes)

## Objective

The fifth step of [decision 0032](../../docs/decisions/0032-grooph-draws-and-watches.md): a graph of what a session's agents are doing, drawn from the harness's own record with the prompt not changed by a word. Who exists, who started whom, what is running or finished, on which model, and how that changed over time.

Today everything grooph shows of a watched session is a list (`grooph sessions`, the app's live screen). This part builds what a graph is drawn *from*, and no screen: one pure function in core that turns a session's record into a graph at a moment in time, a reader for what Claude Code itself keeps beside a session, fixtures made from real sessions with everything said taken out, and the faults in today's reading (two that the real records showed, one that the code shows). Part two, the screen, waits for the owner's pick among the studio's drawings (slice 0109) and for his word.

It is from the record alone. Nothing here asks a model for anything, adds a tool, or changes what a session is given.

## Success criteria

1. **One pure function** in a new file in `packages/core/src/`, exported from core: given a session's event lines, optionally what the harness's own files say of each agent, and optionally a moment, it returns the session as a graph at that moment: nodes (the session and each subagent, with type, depth, state, each run's start and end, model where known, background or foreground where known), edges (started, resumed, each with when it happened and when it became known), the list of moments at which the graph changes, and the places where the two records differ. No clock, no file, no network inside it. [`RECORDS.md`](RECORDS.md) §6 has a starting signature; improve on it.
2. **It works from the hook's lines alone**, with less: no model for a subagent, depth only as far as the `spawned` lines give it, and a parent that may arrive late. A test runs every fixture both ways and says what is lost without the harness's files.
3. **Stepping the moment through the list is a replay**: for each fixture, the graph at each moment is the graph at the one before plus that moment's change, and at the last moment equals the graph with no moment given. A test holds it.
4. **A reader for Claude Code's own files**, in `packages/cli/src/`, that for one session id returns each subagent's `agentType`, `spawnDepth`, `parentAgentId`, `requestShape`, the model asked for, the model that answered, each run's first and last time, and how it ended, as [`RECORDS.md`](RECORDS.md) §1 found them. **It keeps nothing else**: not a prompt, a reply, a tool's input or result, a path, or a description (a test feeds it a subagent folder full of text and checks that none of it is in what the reader returns). It honors `CLAUDE_CONFIG_DIR`, and a session with no such files is an empty answer and no error.
5. **One way to get the graph from the command line as JSON**, for one session, at the end or at a moment, so a person can check it and the studio and the screen can be fed. Its help says in a sentence where it read from. **This is the slice's last commit**: it needs lines in files two other lanes are in (below), so ask the driver before you make it.
6. **Fixtures from real sessions**, under `fixtures/seen/`, each three small files: the event lines, what the harness's files said, and the expected graph at chosen moments. Made by a script kept under this slice's folder, from this project's own records, per [`RECORDS.md`](RECORDS.md) §6: every prompt, reply, description, path and tool-use id removed; times shifted by a fixed amount; ids renumbered; only sessions whose agent types are the harness's own. The set covers: a session with a nested subagent, five running at once, a resumed agent, a foreground child whose parent is known only when it ends, a failed run, two subagents from before the hook was installed, and the watched run already committed (`experiments/watching/haiku/four/invited-1/`; the repository keeps only its digest, so what the harness's files said of its four subagents is read from that run's kept folder under `~/grooph-compare/kept/`, and from no other run's).
7. **Three things in today's reading are put right, each with a test that fails without it** ([`RECORDS.md`](RECORDS.md) §2 and §5). Seen in the records: a subagent whose run failed and left no stop line is shown running forever and holds its session at "working". Read in the code, not met in the records: a child first met through its parent's tool line keeps its parent's type after its own start line arrives. And one thing to count, not to change: stop lines with no type, from ids the session never showed starting (594 of them in the records), are left undrawn as they are today, and the graph says how many there were; a stop that names its type, from an agent that began before the hook was installed, is still named. `grooph sessions` on the shape of each of the first two prints the corrected line.
8. **Nothing a visitor loads grows**: `node scripts/perf-budget.mjs --check` passes with CI's figures quoted.

## Read first

1. `handoffs/0104-the-live-graph/HANDOFF.md` (this file)
2. [`RECORDS.md`](RECORDS.md) beside it: the shape of Claude Code's record as seen in 36 sessions and 137 subagents, how far the hook agrees with it, and what grooph draws today. A reader's report: verify a line before you lean on it.
3. `docs/decisions/0032-grooph-draws-and-watches.md` (point 3, and "Not decided here") and `spec/contract.md` ("Watching")
4. `docs/subagents.md` §2, §5, §6
5. `packages/core/src/events.ts`, `packages/cli/src/events-io.ts`, `fixtures/events/`
6. `AGENTS.md` and `handoffs/README.md`

## Allowed changes

A new file for the function in `packages/core/src/`, new test files for it, and one export line in core's `index.ts` (slice 0103 removes other lines of that file later: add yours and touch no other); `packages/core/src/events.ts` only for criterion 7; a new file for the reader in `packages/cli/src/` and a new test file for it; `fixtures/seen/**`; `handoffs/0104-the-live-graph/**` (the fixture script goes in `tools/`). For criterion 5, and only when the driver says they are free: the fewest lines in `packages/cli/src/commands/hooks.ts` (the sessions command; slice 0108 owns that file until it merges), `help.ts` and `index.ts` (shared with slice 0103), and `docs/cli.md` by its generator. The sentences this slice would add to `docs/subagents.md` and to the release notes go in the pull request's description: slice 0108 has those two files, and the driver adds yours after.

## Forbidden changes

- **The owner's records are read, never copied.** Read only folders under `~/.claude/projects/` whose names begin `-Users-noir-Documents-grooph`, and the events in the main clone's `.grooph/events/`; open no other project's folder. Nothing a session read, wrote or said goes into a fixture, a test, a note or the pull request. A fixture is reviewed line by line by the owner before it merges: keep each one small enough to read on a phone.
- `apps/web/**`: no screen in this part.
- The hook (`packages/cli/hooks/**`) and the install (slice 0108 is there); anything slice 0103 is moving (`export`, `adopt`, `runs`, `run-io.ts`, `mcp-author.ts`). In `events.ts`, leave `nodesLive` and `overlayRun` as they are: the run screen reads them. `packages/cli/test/hooks.test.ts` is slice 0108's: put your tests in files of your own.
- What a session says (`grooph_plan`, `grooph_note`): slice 0105. Leave room for it and build none of it.
- Codex's own files: slice 0107. The function's input is one any harness's reader can fill.
- A subagent's description, in any form but its absence: not its text and not its length ([`RECORDS.md`](RECORDS.md) §6 proposes keeping a length; do not). Reading it is a question for the privacy page and the owner's to approve (decision 0032, "Not decided here").
- `experiments/**`, the version, `docs/PROGRESS.md`, `docs/PLAN.md`, `handoffs/DRIVER.md`, `docs/privacy.md` (propose its sentence in the description). A dependency. A pushed branch rewritten. A merge.

## Spec constraints that apply here

- `spec/contract.md`, "Watching": "**Seen.** What a session's agents did, drawn from the harness's own record: who exists, who started whom, what is running or finished, on which model. The prompt is not changed by a word."
- The same page, "What may be claimed": "That the record is true … checked against a harness's own files before it is said." `differs` in the graph is that check made visible. Nothing in this slice's documents says the record *is* true: [`RECORDS.md`](RECORDS.md) is one reader's count, read by no second harness.
- No model session is started here: nothing is run or paid for in this push without the owner's word for it.

## Design already decided

- **Two sources, one graph, and it says which.** Every node and edge names where it came from: the hook, the harness's files, or both. Where they disagree the graph keeps both facts and lists the difference; it does not pick a winner silently.
- **Time is in the graph.** An edge carries when it happened and when it became known, since a foreground child's parent is known to the hook only when the child ends.
- **The harness's files are read on the person's machine when they look**, and what is read is neither stored nor sent. The reader is in the command line, not in core, and core stays free of the file system.
- **The watched graph has no name yet** (the decision leaves it open). Call it nothing in public text; internal names are yours.

## Implementer's choices

The function's name and exact types; how a "moment" is given and stepped; how a session that is still going is told from one that went quiet (today's rule is `isQuiet`); the command-line form of criterion 5; which real sessions make the fixtures, within criterion 6.

## How to verify

```bash
pnpm install --frozen-lockfile && pnpm -r build && pnpm -r test
node scripts/cli-reference.mjs --check && node scripts/perf-budget.mjs --check && node scripts/american-english.mjs --check
grep -r -n -i -E 'description|prompt' fixtures/seen/ ; echo "expected: nothing but field names you can account for"
```

## Handback must contain

The `TEMPLATE-HANDBACK.md` sections, plus: the function's signature and types as built, with one fixture's graph drawn in a few lines of text; for each fixture, which session it came from and exactly what the script kept; the count of agents, runs, parents and types that agree between the two records across every session you read, and each one that does not, by kind (the numbers [`RECORDS.md`](RECORDS.md) §2 gives, made again by your own script); where `RECORDS.md` was wrong; the sentence proposed for the privacy page; and what part two needs from the owner.

## Prompt to paste

```text
You are a lane of grooph: slice 0104, the live graph of one session, part one. Read handoffs/0104-the-live-graph/HANDOFF.md first, then RECORDS.md beside it, then AGENTS.md and the decision and contract it names. Work in your own worktree on branch slice/0104-the-record-as-a-graph, a draft pull request at the first push. No browser tests in this part. You may read this project's own session records on this Mac as the handoff says, and nothing of any other project; nothing a session read, wrote or said leaves those files. Do not edit docs/PROGRESS.md, docs/PLAN.md or handoffs/DRIVER.md, build no screen, start no model session, and merge nothing. Have a fresh reader read it before you mark it ready; then send the driver the head with SendMessage and push nothing more to it. Finish with the grooph-handback skill.
```
