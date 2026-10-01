# Event fixtures

Session events as the event hook writes them (`docs/subagents.md` §5), one JSON line each.

| File | What it is |
|---|---|
| `claude-code-nested.jsonl` | A real Claude Code 2.1.280 session, recorded by the hook on 2026-09-30: the main session starts two `general-purpose` subagents, and one of them starts an `Explore` subagent of its own. Paths were replaced with `/work/demo`; nothing else was changed. |
| `codex-two-subagents.jsonl` | A real Codex CLI 0.159.2 session (`codex exec`, `gpt-6-luna`), recorded by the same hook: two subagents, both of type `default`. Paths replaced likewise. |
| `claude-code-running.jsonl` | Written by hand in the same shape: a run of the `review-loop` package caught mid-flight, the builder done and the critic still running. |
