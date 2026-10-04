# Mapping notes · Review loop

Codex profile verified against CLI `0.160.0` on 2026-10-04. The graph is the source of truth; re-exporting overwrites these generated files.

## Graph piece → file

| piece | file | meaning |
|---|---|---|
| source | `.grooph/review-loop/graph.grooph.json` | canonical graph; never written by a run |
| lead | `.grooph/review-loop/LEAD.md` | main session's brief, routing, loops, gates, adaptation and notes |
| kickoff | `.grooph/review-loop/KICKOFF.md` | paste this prompt into a fresh Codex session |
| mapping | `.grooph/review-loop/MAPPING.md` | this file |
| working copy | `.grooph/review-loop/runs/<run-id>/graph.grooph.json` | created at kickoff; adaptation: adaptive |
| progress | `.grooph/review-loop/runs/<run-id>/PROGRESS.md` | rewritten after every node and halt |
| notes | `.grooph/review-loop/runs/<run-id>/notes.jsonl` | append-only JSONL, unchanged run contract for grooph watch |
| `builder` | `.codex/agents/review-loop--builder.toml` | builder; model gpt-6.1-sol; effort high; sandbox workspace-write |
| `critic` | `.codex/agents/review-loop--critic.toml` | critic; model gpt-6.1-sol; effort high; sandbox workspace-write |

## Start or resume

Place the package in the project before starting Codex. Custom agent names are the agent_type values given to spawn_agent; use fork_turns: none on fresh edges. This kickoff explicitly requests subagents. No root AGENTS.md, shared config.toml, hooks, or skills are installed or overwritten.

```sh
codex exec --sandbox workspace-write -c approval_policy='"never"' -c web_search='"disabled"' -m 'gpt-6.1-sol' -c model_reasoning_effort='"high"' - < .grooph/review-loop/KICKOFF.md
```

The owner chooses startup settings, project trust and hook approvals. Do not bypass them. In an interactive session, paste KICKOFF.md. At a human gate the lead records outcome: halt before asking, then ends its turn. A headless run ends there. Resume with codex exec resume <session-id> and an explicit prompt naming the same grooph run id and the human's actual answer, or start a fresh session with that run id and answer. A session id is separate from the grooph run id. Silence never approves a gate.

## Hand-adjusting the package

# profile: frontier → gpt-6.1-sol, strong → gpt-6.1-sol, fast → gpt-6-luna

A node's TOML model and model_reasoning_effort are its tier or harness-specific pin and effort. A pin wins over export model overrides. Unset fields inherit subagent defaults; the lead's settings belong to the main session at startup. Both frontier and strong currently map to GPT-6.1 Sol; different tiers do not guarantee different underlying models. Model and effort availability depends on the account and client; halt on an unavailable selection.

sandbox_mode is read-only unless edit-files or write-outputs is allowed and not denied. Then it is workspace-write. approval_policy is never: a blocked action halts rather than escalating. web_search is disabled unless web is explicitly allowed and not denied. Parent live sandbox and approval overrides can supersede custom settings. There is no per-node native tool allowlist in this package: declared output paths, ownership, test-only commands, evidence limits and delegation limits are instructions, not filesystem or tool guarantees. read-files includes non-mutating shell reads where there is no native file-read tool; this does not grant general command execution. write-outputs can write its own named outputs while edit-files stays denied.

Node skills are explicitly requested in developer_instructions; Codex has no Claude-style skills preload field. The session must load applicable installed skills; a missing required skill halts the node. Custom capabilities are stated in the brief and require an available meaning and implementation.

Loops, edges, checks, gates, merge and stop nodes live in LEAD.md. Change stop numbers in the graph and re-export. During adaptive runs change only the run-local working copy with an amendment note. A changed or added custom-agent definition is used only after the harness confirms it is available; hot reload is unknown, so otherwise halt for a fresh session or record a proposal. Never loosen a brake or replace a critic with the lead.

## Limits and optional observation

dispatches and minutes are counted by the lead. usd, turns and tokens are advisory; Codex has no documented dollar-cap flag. A max-iterations backstop is never the acceptance bar. Concurrency and retry caps, stops and gates are lead instructions; grooph is a compiler, not a runtime or a hard budget controller.

grooph hooks install can separately add observation-only hooks; they need owner trust and review and this package neither installs nor depends on them. The lead still writes started and completed node notes and every loop pass, so grooph watch reads a Codex run without changes. Filesystem sandboxing does not provide evidence secrecy: fresh context means no inherited conversation, and the worker reads only its declared inputs and dispatched edge evidence.
