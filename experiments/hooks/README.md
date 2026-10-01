# Hook and MCP experiments: the record

Every claim in [`docs/subagents.md`](../../docs/subagents.md) marked **[seen]** comes from a session that was really run. This folder is the proof: one folder per session, with what the harness printed and what the hook wrote, and a ledger a person can check against the harness's own transcripts.

## 2026-09-30: ten sessions on the owner's Mac

Five headless Claude Code sessions (`claude -p`, version 2.1.280) and five Codex sessions (`codex exec`, CLI 0.159.2). Each was a few turns and under a minute.

| Run | Harness, model | What it was for | Cost |
|---|---|---|---|
| [`cc-1-hook-dump`](2026-09-30/cc-1-hook-dump/) | Claude Code, `sonnet` (resolved to `claude-sonnet-5`) | dump what each of eight hooks receives; two subagents | $0.1508 |
| [`cc-2-real-hook-nested`](2026-09-30/cc-2-real-hook-nested/) | Claude Code, `sonnet` | the real hook; a subagent that starts its own. The session's end went unrecorded: the `Stop` hook ran in the background | $0.2683 |
| [`cc-3-stop-waited`](2026-09-30/cc-3-stop-waited/) | Claude Code, `haiku` | one word, to see that a waited-for `Stop` hook records the end | $0.0189 |
| [`cc-4-real-hook-nested-again`](2026-09-30/cc-4-real-hook-nested-again/) | Claude Code, `sonnet` | the nested run again, the end recorded. `fixtures/events/claude-code-nested.jsonl` is this recording | $0.1811 |
| [`cc-5-mcp-plan`](2026-09-30/cc-5-mcp-plan/) | Claude Code, `sonnet` | the MCP server attached: plan, two subagents, running, note. `fixtures/events/claude-code-planned.jsonl` is this recording | $0.2294 |
| [`codex-1-hook-dump`](2026-09-30/codex-1-hook-dump/) | Codex, `gpt-6-luna` low | dump what each of eight hooks receives; two subagents | subscription |
| [`codex-2-project-hooks-json`](2026-09-30/codex-2-project-hooks-json/) | Codex, `gpt-6-luna` low | the real hook from a project `.codex/hooks.json`: the session ran, the hooks did not load | subscription |
| [`codex-3-which-hooks-load`](2026-09-30/codex-3-which-hooks-load/) | Codex, `gpt-6-luna` low | one word: a hook passed on the command line ran, the project file's did not | subscription |
| [`codex-4-real-hook-declined`](2026-09-30/codex-4-real-hook-declined/) | Codex, `gpt-6-luna` low | the real hook recorded the session; the model declined to start subagents | subscription |
| [`codex-5-real-hook-subagents`](2026-09-30/codex-5-real-hook-subagents/) | Codex, `gpt-6-luna` low | a firmer prompt: two subagents recorded. `fixtures/events/codex-two-subagents.jsonl` is this recording | subscription |

**Claude Code total: $0.8485.** That number is not an estimate made here. It is the sum of `total_cost_usd`, which Claude Code prints at the end of each headless session and which is in each `result.json`. It is the list price of the tokens used; on a subscription it is usage, not a charge. Codex signs in with ChatGPT and prints tokens, not dollars; the tokens are in the ledger. A first Codex attempt hung waiting on standard input and was killed before any model call, so it has no row.

## What is in each folder

| File | From | Holds |
|---|---|---|
| `result.json` | Claude Code's `--output-format json` | session id, model, turns, duration, tokens, cost, the final reply |
| `exec-stream.jsonl` | Codex's `--json` | the session as Codex streamed it: thread id, each item, the token count |
| `events.jsonl`, `said.jsonl` | grooph's hook and MCP server | exactly what they wrote during that session |
| `hook-inputs.jsonl` (`cc-1`) | a hook that copied its input to a file | the raw JSON Claude Code handed each hook |
| `mcp.json` (`cc-5`) | written for the run | the MCP configuration passed with `--mcp-config` |

[`2026-09-30/ledger.json`](2026-09-30/ledger.json) lists every run with its command, session id, tokens, cost and files, and for each transcript the harness wrote, its path on the Mac, its size and its SHA-256.

## What is not in git, and where it is

The harnesses' own transcripts (every message, every tool call) are the fullest record. They are **not committed**: a Claude Code transcript carries the account's e-mail address, and a Codex rollout carries the owner's personal instructions. They are in two places on the Mac:

- where the harness wrote them: `~/.claude/projects/-private-tmp-…-scratchpad-exp-cc/` and `…-exp2/` (each session's `.jsonl`, with `subagents/` beside it), and `~/.codex/sessions/2026/09/30/rollout-2026-09-30T21-*.jsonl`;
- copied to `experiments/hooks/2026-09-30/local/<run>/`, which `.gitignore` keeps out of git. The raw Codex hook inputs are there too (`codex-1-hook-dump/hook-inputs.jsonl`): they include tool calls of Codex's own background memory session, so the committed summary is [`handoffs/0027-live-subagents/experiments/codex-0.159.2.md`](../../handoffs/0027-live-subagents/experiments/codex-0.159.2.md).

## Check it yourself

```bash
node experiments/hooks/check.mjs
```

For each run it confirms the committed files are present and that each transcript on this machine still has the checksum in the ledger. To read one:

```bash
less experiments/hooks/2026-09-30/local/cc-4-real-hook-nested-again/5aac1305-f22d-4cad-a6e7-810700aeb49e.jsonl
```

Each line is one message or tool call, as Claude Code stored it. The session ids in a `result.json`, in the hook's `events.jsonl` and in the transcript's file name are the same id, written by three different programs.

The three fixtures named above differ from their recordings only in paths (replaced with `/work/demo`); ids and times are untouched.

## The rule from here on

Every model session started by command for grooph (an experiment, a proving run, a check in Codex) is recorded before its result is used anywhere: a folder under `experiments/`, the harness's own output saved to a file as it runs (never read from the screen and summarised), a ledger row with the session id and cost, and the transcript's path and checksum. Decision [0015](../../docs/decisions/0015-working-rules-for-the-operator-round.md).
