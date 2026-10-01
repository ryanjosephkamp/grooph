# Handback 0027 · A live view of subagents, in Claude Code and in Codex

**Session:** Opus 5.5, driving and building (decision 0014) · **Branch:** `slice/0027-live-subagents` (stacked on `slice/0025-exports`) · **Date:** 2026-09-30 · **Handoff:** the owner's brief, item 4 (slices 0021 and 0023, widened to Codex)

## Status

`done` for what the brief asked: hooks that append one line and never block, `grooph watch` turning the file into a view that updates and merging several sessions' files, and `docs/subagents.md`. Two parts of the older slices are deliberately **not** in it: the lead writing fewer notes because a hook writes them (0021's brief change, which needs a proving run), and the `prose` target (0023's other half).

## What changed

- **`spec/AMENDMENTS.md`**: A-012. **`docs/subagents.md`** (new): the explanation the owner asked for, with every fact marked documented, seen or unknown.
- **`packages/cli/hooks/grooph-event.mjs`** (new): the hook. One file, no dependencies.
- **`packages/core/src/events.ts`** (new): `parseEvents`, `summarizeSessions`, `nodesLive`, `overlayRun`, the `LiveView` shape.
- **`packages/cli`**: `src/events-io.ts` (new: sources as files, folders, projects, `git:<ref>`); `commands/hooks.ts` (new: `hooks install | status | remove`, `sessions`); `commands/watch.ts` (`/grooph/api/live.json`, `--sessions`, `--events`).
- **`apps/web`**: `src/ui/live/LiveSessions.tsx` (new, `#/live`); the live run view lays hook-seen subagents over the run.
- **`fixtures/events/`** (new): two real recordings (one per harness, paths replaced) and one written by hand.
- **`handoffs/0027-live-subagents/experiments/`** (new): what each harness's hooks received, key by key.
- **Tests**: `core/test/events.test.ts`, `cli/test/hooks.test.ts` (new), `cli/test/runs.test.ts`, `web/e2e/live.spec.ts` (new).
- **Docs**: `runs.md` §6, `targets/claude-code.md`, `README.md`, `AGENTS.md`, `GLOSSARY.md`, `fixtures/README.md`, `PLAN.md`, `PROGRESS.md`.

## Verified, and how

| Claim | How | Observed |
|---|---|---|
| Claude Code tells a hook a subagent's id and type on start, stop and on tool calls inside it | one headless session with a hook that dumped its input (`experiments/claude-code-2.1.280.md`); and the hooks reference, read directly | as the documentation says; `SubagentStart` carried exactly `agent_id` and `agent_type` beyond the common fields |
| Codex does the same, and its hooks run under `codex exec` | one `codex exec` session with the same dump (`experiments/codex-0.159.2.md`) | yes; plus a background memory session that fired the same hooks from another folder |
| The real hook records a real session, with nesting | Claude Code, `grooph hooks install --tools` in a scratch project, a session whose subagent started its own subagent; then `grooph sessions` | three subagents, the `Explore` one under the `general-purpose` one that started it; session `ended` |
| The real hook records a real Codex session | the same hook entries passed to `codex exec` for one invocation | two subagents with model and tool names; nothing written under `~/.codex/memories` |
| The hook cannot steer | `cli/test/hooks.test.ts`: every run of it has empty standard output and error and exits 0, including on unreadable input, an unwritable folder and a session in another project | holds |
| The hook keeps nothing an agent said | the same test feeds it payloads full of marked text | none of the marked text is in the events file |
| Install leaves other settings alone and is undone by remove | the same test, on a settings file with its own hooks and permissions | byte-identical after install then remove; a second install changes nothing |
| `watch` serves the sessions, merges sources, re-reads on every request | `cli/test/runs.test.ts` | holds; `git:<ref>` reads a branch with nothing checked out |
| The screen follows a subagent from running to done | `web/e2e/live.spec.ts` against views built from the recordings | holds; the pulse respects reduced motion |
| A run's node lights from the hook before the lead notes it | `web/e2e/live.spec.ts`, last test | critic `pending` without events, `running` with them; the builder's outcome stays the lead's |
| Everything | `pnpm -r build && pnpm -r test && pnpm --filter @grooph/web test:e2e` | core 319, cli 77, web 54, browser 80: all pass |

## What the experiments cost

Four Claude Code sessions (`claude -p`, Sonnet and one Haiku): $0.15, $0.27, $0.02, $0.18, so **$0.62**. Five Codex sessions (`codex exec`, `gpt-6-luna`, low effort) on the ChatGPT sign-in, each under half a minute. No ledger was touched; these are not proving runs.

## Decisions made

- **Per-session files.** One file per session id, so files from many sessions and machines merge by listing them, with no locking.
- **The hook knows its project from where it sits.** It ignores a session working elsewhere. Codex's background memory session made this necessary.
- **`Stop` and `SessionEnd` are waited for; the rest run in the background.** In the background, the last events of a headless Claude Code session were lost.
- **A `tool` event is recorded after the call, name only.** The one thing kept from a tool result is the id of the subagent Claude Code's `Agent` tool started: it is the only place the harness says which agent started which.
- **The lead's brief is unchanged.** The hook is laid over the run view; the package does not ship it. Observation is added without touching what agents are told.
- **`git:<ref>` as a source.** The repositories are the only links between the owner's machines; a lane that commits its events is read from its branch.
- **Internal helper agents are left out.** Claude Code reports stops from its own helpers with an empty type; a stop with no type from an agent never seen starting is not shown.

## Deviations

- `--dangerously-bypass-hook-trust` was passed to `codex exec` for the five experiment runs, so that a hook I had just written could run without the interactive review. Nothing under `~/.codex` was edited. In normal use the owner reviews the hook in `/hooks`.
- The research subagent's Claude Code notes said tool events inside a subagent were not documented as carrying the agent's id. They are; I read the reference myself and the notes were dropped. Its Codex notes are kept under `research/`, marked as unchecked.

## Not verified, and assumed

- **Not verified: any cloud session.** The Claude Code documentation says a repository's `.claude/settings.json` hooks run in a cloud session with one repository; I did not start one. Codex cloud: unknown.
- **Not verified: a project-level `.codex/hooks.json` loading after trust.** My attempt to mark a scratch project trusted for one invocation did not load its hooks, and I did not edit `~/.codex/config.toml` to do it for good. The same entries, passed for one invocation, ran.
- **Not verified: a real grooph run with the hook installed.** The overlay is tested with events in the shape the hook writes and the naming rule the compiler uses; a proving run would cost a few dollars and waits for the owner's word.
- **Not verified: a long session.** Every recording is under a minute. The reader takes the last 4 MB of a file.
- Assumed: Node is on the path wherever the hook is installed.

## Risks and leftovers

- Both harnesses change their hooks between releases. `docs/subagents.md` says which version each fact was read or seen on.
- Hook clocks order events across files; two machines with clocks apart will interleave oddly.
- A lane's events reach another machine only when the lane commits and pushes them. The view is as live as the last push.
- Not built: a picture or an offline page of the sessions (a snapshot to send); live state drawn on an operation map; the MCP server (slice 0028).
