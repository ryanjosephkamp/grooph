# Sessions as they were seen

Each folder is a run of consecutive lines from one real session of this project, and what the harness's own files said of the subagents that began inside those lines. `packages/core/test/seen.test.ts` holds `seenGraph` (`packages/core/src/seen.ts`) to them.

| File | What it is |
|---|---|
| `events.jsonl` | The hook's lines, one event each, as `fixtures/events/` holds them. |
| `harness.json` | One entry a subagent, as the reader of Claude Code's own files returns it (`packages/cli/src/claude-files.ts`): its type, depth, the subagent that started it, background or foreground, the model its call named, the model that answered, and each run's first and last time and how it ended. |
| `expected.json` | The graph drawn from those two: every moment at which it changes, what was read, and the graph at a few chosen moments and at the end; then the same from the hook's lines alone. |

| Folder | What happens in it |
|---|---|
| `nested-and-resumed` | A session from its first line to its end. A subagent is first met through the tool line that started it, three milliseconds before its own start line. It starts a subagent of its own in the background, finishes, and is resumed once. Six stop lines carry no type and are counted, not drawn. |
| `five-at-once` | Five subagents running at once. One of them starts a child in the foreground, and the hook learns whose child it is only when the child ends, twelve minutes on; another starts a child in the background. The session's own start line comes again in the middle (the harness writes one when it compacts) and ends nothing. |
| `failed` | A subagent whose run failed. The harness fires no stop for it: the hook has its start and nothing more, and the harness's files say how it ended. |
| `before-the-hook` | The first lines the hook wrote of a session that had already run two subagents. The harness's files hold both; the hook has no line of either. |
| `watched-run` | The run of the watching check that is in `experiments/watching/haiku/four/invited-1/`: four subagents started in one turn. |

**What was changed.** Every id is renumbered in the order it first appears (`a01`, `a02`, and so on; the session is named for its folder). Every time is moved by one amount, so that each fixture begins at `2026-01-01T00:00:00.000Z`; the time between any two lines is as it was. The working folder is `/work/demo`. Where a transcript is kept is left out.

**What is not here.** Nothing a session read, wrote or said: the hook writes none of it, and the reader returns none of it. The types are the harness's own (`general-purpose`, `claude-code-guide`).

They are made by `handoffs/0104-the-live-graph/tools/make-fixtures.mjs`, which needs the records they came from. `node handoffs/0104-the-live-graph/tools/make-fixtures.mjs --expected` writes every `expected.json` again from the two files beside it, and needs nothing else: run it after a change to `seenGraph`, and read what changed.
