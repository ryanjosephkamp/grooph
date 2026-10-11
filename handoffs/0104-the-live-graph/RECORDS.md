# What there is to draw a live session graph from: Claude Code's record, grooph's hook record, and how far they agree

Made on 2026-10-11 by a read-only researcher for the driver, from this project's own session records on the owner's Mac. It holds ids, counts, field names and times, and nothing a session read, wrote or said. Its scripts were in a session's scratch folder and are not kept. Where it and `HANDOFF.md` differ, the handoff wins.

Nothing was changed in any repository. Marks: **[seen]** = read in the files; **[inferred]** = my reading. No prompt, reply, tool input, tool result, path or description text was copied anywhere.

**Read:** 36 session transcripts, 137 subagent transcripts and 137 `agent-*.meta.json` files in the 12 folders under `~/.claude/projects/` whose names begin `-Users-noir-Documents-grooph`; the 21 files in `/Users/noir/Documents/grooph/.grooph/events/` (11 Claude Code sessions, 9 Codex, 1 `said-`); the watched run in the worktree. Harness versions named: 2.1.271, .275, .280, .284, .286, .288, .289, .293, .295 (subagents in all but .280). [seen]

## 1. The shape of Claude Code's own record

Layout [seen]: `<project>/<sessionId>.jsonl`; beside it `<sessionId>/subagents/agent-<agentId>.jsonl` and `agent-<agentId>.meta.json`. The folder is flat: a subagent's subagent sits in the same folder. Every agent id is 17 hex characters beginning `a`. Also there: `agent-<id>.prefix.json` (5 files, 2.1.293 on; cache diagnostics), `<sessionId>/tool-results/`, `custom-title.json`.

| Fact | Exact field | Seen |
|---|---|---|
| An agent exists | the two files; every line of its transcript has `agentId`, `sessionId` (the parent session's), `isSidechain: true`. In the starter: a `tool_use` block `name: "Agent"`, and on the result line `toolUseResult.agentId` | 137/137. A subagent's own result lines carry no `toolUseResult`, so a nested child is not named there |
| Who started it | meta `toolUseId` = the `id` of the `Agent` `tool_use` block in the starter's transcript; meta `parentAgentId` only when a subagent started it | 134/134 at depth 1 tie to the main transcript; 3/3 nested tie to the parent agent's transcript |
| Depth | meta `spawnDepth` | 1: 134, 2: 3; none deeper |
| Started | first line's `timestamp` in its transcript (a `type: "user"` line). The meta file is written then | meta mtime within 5 s of a run start, 137/137; both agents running during this read already had one |
| Resumed | a `user` line with `isMeta: true`, `origin.kind: "coordinator"` in its transcript | 38 lines |
| Stopped (background) | main transcript line `type: "queue-operation"`, `operation: "enqueue"`, whose `content` holds `<task-notification>` with `<task-id>` = the agent id and `<status>` | one per run, 169/169 (`completed` 168, `failed` 1), nested children's too; 0 to 8.7 s after the run's last line |
| Stopped (foreground) | the result line itself: `toolUseResult.status: "completed"`, with `totalDurationMs`, `totalTokens`, `totalToolUseCount` | 3 |
| Still running | **no field.** `toolUseResult.status: "async_launched"` with no later notification for that `<task-id>` | [inferred]. `attachment.type: "task_status"` (6 lines) and `system/turn_duration.pendingBackgroundAgentCount` (1 line) are too rare to use |
| Model asked for | meta `model` = the call's `input.model` (`opus` 81, `sonnet` 26) | absent on 30/137, where the call named none |
| Model that answered | `message.model` on its `assistant` lines = the starter's `toolUseResult.resolvedModel` | 137/137, one model each; 134/134 equal |
| `agentType` | meta `agentType` = `input.subagent_type` | general-purpose 127, claude-code-guide 5, slice-0007-sandwich--builder 2, slice-0007-sandwich--critic 2, Plan 1 |
| Description | meta `description` = `input.description` | 17 to 49 characters |
| Background | meta `requestShape` (`background` 133, `foreground` 4). `input.run_in_background` is present on only 60 calls (once as the string `"true"`) | 77 ran in the background with nothing asked |
| Worktree | meta `spawnedWithWorktree`, `worktreeBranch`, `worktreePath`; `inheritedWorktreePath` on nested | 17 |

Differences between versions [seen]: the meta keys `agentType, description, requestNonInteractive, requestShape, spawnDepth, toolUseId` are in every version; `model` first appears at 2.1.286, but no earlier call named a model, so that is not shown to be a version change [inferred]. `SubagentHandback` calls appear from 2.1.284 (0 of 7 agents before, 127 of 130 after). A headless run's JSON output also has `subagent_stats` (2.1.289, in `experiments/watching/haiku/four/invited-1/claude-output.json`). With no model named, the answer is not always the session's model: 3 `claude-code-guide` agents answered on `claude-haiku-4-5-20251001`, and one nested child on its parent's Sonnet.

## 2. Does the hook agree with the harness?

All 11 Claude Code sessions in the hook's folder have a transcript. [seen]

| | Transcripts | Hook | Matched by id |
|---|---|---|---|
| Subagents | 129 | 127 ids started, 124 ids stopped | 127 starts, 124 stops |
| Runs (first start plus resumes) | 167 | 165 start lines, 162 typed stop lines | run count equal for 127/127 agents |
| Parent link | 3 nested | 127 `spawned` lines, 3 naming a parent agent | 127/127 agree with meta |
| Type | | | 127/127 agree |
| Ids the transcripts do not know | | 0 typed | |

Timing [seen]: a start line is 0.06 to 2.48 s after the run's first transcript line (median 0.12); a stop line 0.04 to 9.66 s after its last (median 0.08).

| Session | Agent | Kind |
|---|---|---|
| 3e9d2b43 | a6ca0dfaba2020f18 (claude-code-guide) | no start, stop or `spawned` line: ran 2026-10-01T00:34:00Z to 00:38:28Z; the hook's first line for the session is 04:13:34Z |
| 3e9d2b43 | adcb433f871d1d758 (general-purpose) | the same: 00:34:00Z to 00:42:38Z |
| 3e9d2b43 | a0ab060e9ebf5b917 (general-purpose) | start, **no stop**: the harness's notification says `failed` at 2026-10-06T01:53:53Z |
| 0736bc47 | a262e2217aa30a16f (Plan), a2821d29201521553 (general-purpose) | start, no stop: still running when read (the second wrote this report) |
| 3e9d2b43 | a94e843c52f3ee422 (depth 2, foreground) | not a count mismatch: its `spawned` line, the only thing naming its parent, was written 732 s after its start, at its stop |

- **A foreground child's parent is known to the hook only when the child ends** [seen, 4 of 4]: the `Agent` tool's line is written when the call returns. For a background child it is within 0.34 s of the start.
- **594 stop lines carry no type**, 594 distinct ids, none with a transcript or meta file. Today's reader drops all of them. [seen]
- **The failed run has no stop line**, so today's reader leaves that agent running and the session `working`, never `ended`. [seen, by running `packages/core/src/events.ts` over the real files]

**Not matched, and why.** 25 transcript sessions have no hook file. 22 ended by 2026-09-22, before the hook's first line anywhere (2026-10-01), with 7 subagents. 3 ran on 2026-10-04 in sibling lane folders (1 subagent); their own events folders were outside what I may read. The 9 Codex files (4 subagents) have no counterpart here; Codex's rollouts were out of scope.

## 3. Richest sessions for fixtures

| Session | Dates (UTC) | Span | Subagents by type | By model that answered | Depth | Most at once | Also |
|---|---|---|---|---|---|---|---|
| 3e9d2b43-91b3-40a4-9859-23f9fc76c901 | 10-01 to 10-09 | 8 d 19 h 44 m | 58: general-purpose 56, claude-code-guide 2 | opus-5-5 36, sonnet-5-5 20, haiku-4-5 2 | 2 (two nested: one background, one foreground) | 5 | 12 resumes, 14 worktrees, 1 failed, 2 before the hook; longest run 1 h 6 m; 1,659 hook lines; 2.1.284 to .293 |
| 10ff70fe-372f-49cb-b190-c2c5e2553725 | 10-04 to 10-06 | 1 d 12 h 4 m | 13: general-purpose 12, claude-code-guide 1 | opus-5-5 12, haiku-4-5 1 | 1 | 3 | 23 resumes (one agent ran 8 times); 256 hook lines; 2.1.286 |
| 41f4817f-06d3-48e7-bb7a-9d5b8e7de82d | 10-04 to 10-06 | 1 d 22 h 38 m | 13: general-purpose | opus-5-5 11, sonnet-5-5 2 | 1 | 2 | the only 3 foreground runs at depth 1; 199 hook lines |
| a9e0c432-7fe5-4eb3-9878-a594b724e4a4 | 10-09 to 10-11 | 1 d 3 h 59 m | 5: general-purpose | opus-5-5 3, sonnet-5-5 2 | 2 (one nested, background) | 2 | 1 resume, 3 worktrees, the longest run of all (1 h 19 m); 88 hook lines; 2.1.293, .295 |
| 8636ef98-4c57-4312-9a58-279d2590405d (watched run, committed) | 10-10 | 2 m 44 s | 4: general-purpose | haiku-4-5 4 | 1 | 4 | headless 2.1.289; 24 hook lines; its transcripts are outside the repository and were not opened |

One window of the first is a fixture in itself: 2026-10-04T07:48Z to 09:10Z holds 8 agents, 5 at once, both nested children (the late-parent case among them), and 50 hook lines of which 6 are helper stops. [seen] Session a1bb75be (2026-09-19, 2.1.271, no hook file) is the only one with custom agent types.

## 4. What each record has that the other lacks

**Only the harness's files** [seen]: the model (0 of the hook's 327 typed Claude Code subagent lines carry one), the description, `spawnDepth`, the parent from the first moment, background or foreground, worktree, how a run ended, token and duration totals, every tool call inside a subagent (this project's hook was installed without `--tools`, so it holds only `Agent` calls), who resumed an agent, and everything from before the hook was installed.

**Only the hook's file** [seen]: an explicit stop event with its time; `session-start`, `session-end`, `turn-start`, `turn-end` (the transcripts have no session-end line); the working folder at each turn; Codex sessions; and a file small and free of content, so it can be sent to another machine.

**Neither**: a field saying an agent is running now.

## 5. What grooph draws today

| What | Where |
|---|---|
| Line format, parser | `packages/core/src/events.ts` 38–63, `parseEvents` 79–125 |
| Summary: sessions, each with a flat list of agents carrying `parent`, `state`, `stops`, `tools`, `model` | `summarizeSessions` 202–339; types 129–195 |
| One-line texts | `planLine` 345, `isQuiet` 363, `sessionLine` 370 |
| Lighting a declared graph's nodes, and a map's sessions | `nodesLive` 402, `overlayRun` 428, `mapLive` 466, `mapLiveLine` 489 |
| Reading files, folders, git refs; last 4 MB of each file | `packages/cli/src/events-io.ts`: `readLive` 108–165, `readTail` 68, `eventFiles` 84, `refFiles` 50 |
| `grooph sessions` | `packages/cli/src/commands/hooks.ts`: `agentLine` 483, `sessionParts` 502, `sessionLines` 526, `sessionsCommand` 538 |
| Server and MCP | `packages/cli/src/commands/watch.ts` 51 and 109 (`api/live.json`); `packages/cli/src/mcp.ts` 150 (`grooph_running`) |
| The app's live screen | `apps/web/src/ui/live/LiveSessions.tsx`: `AgentRow` 118, `PlanBlock` 156, `SessionCard` 184, `LiveMap` 239, `LiveSessions` 254 |

`grooph sessions` prints one head line per session (harness, state or "last seen … ago", counts running and done, last 8 of the id, folder, model), then one line per subagent indented two spaces per level (mark, type, short id, running or done time, resumes, tool calls, model), then `plan` and `note` lines; `--json` prints the `LiveView`. The app shows the same as cards: an indented list (`marginLeft: depth * 18`, line 135). [seen]

**It is all lists.** The only pictures are the operation map with counts on each session (`LiveMap`), and a declared graph's nodes lit when a subagent's type is `<graph-id>--<node-id>` (`apps/web/src/ui/run/RunScreens.tsx` 34, `RunView.tsx` 104), which belongs to the lab. No graph of what was seen exists. `fixtures/events/` holds four small recordings (three agents at most, 2.1.280, absolute `/work/demo` paths, no meta files). [seen]

One fault found in passing [inferred from the code, not hit in the data]: in `summarizeSessions` (226–239, 285–288) a child first met through its parent's `tool` line takes the parent's type, and its own start line does not correct it. 5 of 127 `tool` lines preceded the start line; none was nested.

## 6. Proposal

```ts
/** One subagent as the harness's own files give it. Read on the person's machine; never stored or sent. */
type HarnessAgent = { id: string; agentType?: string; spawnDepth?: number; parentAgentId?: string;
  requestShape?: "background" | "foreground"; modelAsked?: string; modelAnswered?: string;
  description?: string; worktree?: boolean;
  runs?: { from: string; to?: string; end?: "completed" | "failed" | "killed" }[] };

/** The session as a graph at one moment. `at` omitted: the end of the record. Stepping `at` through `moments` is the replay. */
function seenGraph(events: readonly SessionEvent[], harness?: readonly HarnessAgent[], at?: string): SeenGraph;

type SeenGraph = { groophSeen: 0; at: string; moments: string[];
  session: { id: string; harness: HarnessId; state: "working" | "waiting" | "ended" | "quiet"; started: string; ended?: string };
  nodes: { id: string; kind: "session" | "subagent"; type: string; depth: number;
    state: "running" | "done" | "failed" | "not-seen-to-finish"; runs: { from: string; to?: string }[];
    model?: string; shape?: "background" | "foreground"; source: "hook" | "harness" | "both" }[];
  edges: { from: string; to: string; kind: "started" | "resumed"; at: string; knownAt: string; source: "hook" | "harness" | "both" }[];
  differs: { agent: string; what: "no start line" | "no stop line" | "no harness file" | "type" | "parent" }[] };
```

`knownAt` is there for the late parent; `differs` for the five rows in section 2. With the hook's lines alone it must still work: no model, no depth beyond what `spawned` gives, and a parent that may arrive late.

**A committed fixture** would hold three files:
- `events.jsonl`: the hook's lines with `transcript` removed and `cwd` replaced by one made-up name, as `grooph events push` already sends them.
- `harness.json`: per agent, `agentType`, `spawnDepth`, `parentAgentId`, `requestShape`, `model`, plus three things taken from the transcripts: each run's first and last `timestamp`, the model that answered, and the notification's status.
- `expected.json`: the graph at two or three chosen moments.

Removed: every prompt and reply, `description` (kept as a length), `worktreePath`, `worktreeBranch`, `inheritedWorktreePath` (kept as a boolean), `toolUseId`. Ids may stay or be renumbered consistently. Two things are the owner's to decide: custom agent type names are words he chose, and timestamps show working hours (`packages/cli/test/fresh.ts` already shifts recordings in time).

Suggested set: a9e0c432 whole, the 2026-10-04 window of 3e9d2b43, the failed run, and the watched run already committed.
