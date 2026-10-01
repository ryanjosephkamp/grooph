# Handback 0028 · An MCP server: a plan beside what happened

**Session:** Opus 5.5, driving and building (decision 0014) · **Branch:** `slice/0028-mcp` (stacked on `slice/0027-live-subagents`) · **Date:** 2026-09-30 · **Handoff:** the owner's brief, item 5

## Status

`done` as a tool. Whether it makes a lead coordinate better is **not tested**, as the brief said to expect.

## What changed

- **`packages/cli/src/mcp.ts`** (new): the server. JSON-RPC 2.0 over standard input and output, one message per line, no dependency. Four tools: `grooph_plan`, `grooph_note`, `grooph_running`, `grooph_validate`. `grooph mcp` in `src/index.ts`.
- **`packages/core/src/events.ts`**: two event kinds a lead writes on purpose, `plan` and `note`; `LivePlan` (each planned kind against what started after it), `planLine`.
- **`packages/cli/src/commands/hooks.ts`**: `grooph sessions` prints a session's plan and notes.
- **`apps/web/src/ui/live/LiveSessions.tsx`**: the plan block and the notes on a session's card.
- **`fixtures/events/claude-code-planned.jsonl`** (new): the real session below.
- **Tests**: `cli/test/mcp.test.ts` (new), `core/test/events.test.ts`, `web/e2e/live.spec.ts`.
- **Docs**: `subagents.md` §7, `README.md`, `ARCHITECTURE.md`, `HANDOVER.md`, `AGENTS.md`, `PLAN.md`, `PROGRESS.md`.

## Verified, and how

| Claim | How | Observed |
|---|---|---|
| The protocol | `cli/test/mcp.test.ts`: initialize, the version asked for, a notification unanswered, `tools/list`, an unknown method, a line that is not JSON | as the protocol has it |
| As a process | the same test spawns `grooph mcp` and writes messages to it | one reply per request on standard output, nothing on standard error, exit 0 when input closes |
| The tools work in a real session | one Claude Code 2.1.280 session (`claude -p --mcp-config`, Sonnet, $0.23) told to plan, start two subagents, ask what is running, and leave a note | it called all four; the plan read "2 of 2 started" beside the two subagents the hook recorded; the note was shown |
| A plan lands on its session | the same run | the server's file was named with the session's own id: Claude Code passes `CLAUDE_CODE_SESSION_ID` to an MCP server |
| A plan is judged on what started after it | `core/test/events.test.ts` | more than planned, something unplanned, a re-plan, and a plan with no session all read true |
| The hook's files stay free of text | `mcp.test.ts`, `events.test.ts` | a plan or note is written only to `said-<session>.jsonl`; text on any other kind of line is dropped on read |
| Everything | `pnpm -r build && pnpm -r test && pnpm --filter @grooph/web test:e2e` | core 322, cli 81, web 54, browser 81: all pass |

## Decisions made

- **A command, not a package.** `grooph mcp` shares the CLI's install; a separate `packages/mcp` would be one more thing to link for four tools.
- **No SDK.** The stdio transport is a line of JSON each way. Writing it took less than a dependency would to keep current, and core's rule of no dependencies (decision 0005) extends naturally.
- **The tools record and report; none acts.** No tool starts a subagent, edits a graph or writes a run note. The server's own instructions say so to the model.
- **Plans and notes are events, in their own files.** One reader, one merge, `git:<ref>` carries them like the rest; and the hook's promise (no content) stays true of the hook's files.
- **A plan with no session still shows.** Without the hook installed, a declared plan makes a session of its own, so the tool is useful alone.

## Deviations

None from the brief. The README's older promise that a session could "build candidate graphs" through MCP is not what this is: the skill and the CLI do that, and the README now says what the server does.

## Not verified, and assumed

- **Not verified: that it helps.** One session, told step by step what to call, is a functional check. A real test would compare leads with and without the tools on tasks where the plan matters, and is a small study of its own.
- Not verified: the server from inside a Codex session (it was run as a process with `--harness codex`). Whether Codex gives an MCP server a session id is unknown; the fallback (the most recently started session) covers it.
- Assumed: that a lead will call `grooph_plan` unprompted when its instructions mention it. In the one session it was told to.

## Risks and leftovers

- A lead can declare a plan and then ignore it. The view shows that; nothing stops it. That is the design: observation does not steer.
- `grooph_note` is the one way free text reaches the events folder. It is capped at 600 characters.
