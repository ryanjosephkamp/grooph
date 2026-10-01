<!-- Research notes gathered by a subagent on 2026-09-30 from OpenAI's documentation and the openai/codex repository. Model output, kept for what it says about the source code where the pages are silent. Checked only where docs/subagents.md cites it; treat the rest as leads, not facts. -->

Research report: Codex subagents and hooks (official sources only, fetched 2026-09-30)

Preliminary notes on sources
- Every `https://developers.openai.com/codex/...` URL now returns a 308 redirect to `https://learn.chatgpt.com/docs/...` (verified with curl for /codex/hooks, /codex/subagents, /codex/models, /codex/config-reference, /codex/noninteractive, /codex/cli/reference, /codex/app-server, /codex/cloud, /codex/changelog). I cite the landing URLs. Each page has a verbatim Markdown twin at `<url>.md`, which is what I read (not a model summary).
- Repo facts are from `openai/codex` `main` at commit 60947e2 (2026-09-30); latest release tag is `rust-v0.159.3` (2026-09-30).
- The hooks page itself warns: "The linked `main` branch schemas may include hook fields that are not in the current release. Use this page as the release behavior reference." (https://learn.chatgpt.com/docs/hooks)
- No instructions aimed at me were found in any fetched content.
- Raw copies are in the session scratchpad (will vanish): /private/tmp/claude-501/-Users-noir-Documents-grooph/3e9d2b43-91b3-40a4-9859-23f9fc76c901/scratchpad/codex/

## 1. Subagents

Enabling and config keys
- "Current Codex releases enable subagent workflows by default." [official docs] (https://learn.chatgpt.com/docs/agent-configuration/subagents)
- `[agents]` table keys, exactly as documented: `agents.enabled` (boolean, "Enable or disable multi-agent tools", default `true`), `agents.max_concurrent_threads_per_session` ("Cap concurrently open spawned-agent threads, excluding the primary"; "When you leave [it] unset, Codex chooses the default"), `agents.default_subagent_model`, `agents.default_subagent_reasoning_effort`, `agents.interrupt_message` (default `true`). [official docs] (https://learn.chatgpt.com/docs/agent-configuration/subagents)
- `agents.max_threads` is a "Legacy alias for `agents.max_concurrent_threads_per_session`". [official docs] (https://learn.chatgpt.com/docs/config-file/config-reference)
- Per-role declarations in config.toml: `agents.<name>.description` ("Role guidance shown to Codex when choosing and spawning that agent type") and `agents.<name>.config_file` ("Path to a TOML config layer for that role; relative paths resolve from the config file that declares the role"). "Scalar setting names are reserved and can't be used as custom role names." [official docs] (https://learn.chatgpt.com/docs/config-file/config-reference)
- `features.multi_agent`: "Enable multi-agent collaboration tools (`spawn_agent`, `send_input`, `resume_agent`, `wait_agent`, and `close_agent`) (stable; on by default)." Feature table: `multi_agent` default true, Stable. [official docs] (https://learn.chatgpt.com/docs/config-file/config-reference ; https://learn.chatgpt.com/docs/config-file/config-basic)
- `agents.max_depth` is NOT in the docs. It exists in source: `AgentsToml.max_depth: Option<i32>` with comment "Maximum nesting depth for V1 agent threads. Ignored by V2."; `DEFAULT_AGENT_MAX_DEPTH: i32 = 1`; `DEFAULT_AGENT_MAX_THREADS = Some(6)`; V2 default `max_concurrent_threads_per_session` = 4. [repo source] (https://github.com/openai/codex/blob/main/codex-rs/config/src/config_toml.rs ; https://github.com/openai/codex/blob/main/codex-rs/core/src/config/mod.rs)
- `agents.job_max_runtime_seconds`: source comment "Removed agent-job setting retained as a no-op for compatibility." Feature `enable_fanout` (SpawnCsv) is `Stage::Removed`. `spawn_agents_on_csv` appears nowhere in the docs. [repo source] (https://github.com/openai/codex/blob/main/codex-rs/config/src/config_toml.rs ; https://github.com/openai/codex/blob/main/codex-rs/features/src/lib.rs)
- A second backend exists in source: feature key `multi_agent_v2` (`Stage::Stable`, `default_enabled: false`); `agents.enabled` comment: "An enabled `features.multi_agent_v2` setting takes precedence." Version is resolved as override, then the model's own setting, then features. [repo source] (https://github.com/openai/codex/blob/main/codex-rs/features/src/lib.rs ; https://github.com/openai/codex/blob/main/codex-rs/core/src/config/mod.rs)

How the main agent spawns one
- Docs name the tools only in the config reference: `spawn_agent`, `send_input`, `resume_agent`, `wait_agent`, `close_agent`. There is no tool called `wait`. [official docs] (https://learn.chatgpt.com/docs/config-file/config-reference)
- Triggering: "Current local Codex releases spawn agents after a direct request or applicable project or skill instruction." (`AGENTS.md` or skill instructions can request delegation.) [official docs] (https://learn.chatgpt.com/docs/agent-configuration/subagents)
- Source, V1 (namespace `multi_agent_v1`): `spawn_agent` params `message`, `items`, `agent_type`, `fork_context`, `model`, `reasoning_effort`; plus `send_input` (`target`, `message`, `items`, `interrupt`), `resume_agent` (`id`), `wait_agent`, `close_agent` (`target`). V2: `spawn_agent` (required `task_name`, `message`; optional `agent_type`, `fork_turns`, `model`, `reasoning_effort`), `send_message`, `followup_task`, `wait_agent`, `list_agents`, `interrupt_agent`. [repo source] (https://github.com/openai/codex/blob/main/codex-rs/core/src/tools/handlers/multi_agents_spec.rs)
- In hooks, "`spawn_agent` also matches `Agent`" as a `PreToolUse`/`PostToolUse` matcher. [official docs] (https://learn.chatgpt.com/docs/hooks)

Context a subagent gets
- Model/effort: "If you don't configure a subagent model or `model_reasoning_effort`, the subagent inherits the parent agent's model and reasoning effort." Resolution order: explicit spawn value, then `[agents]` default, then parent's value; a custom agent file's `model`/`model_reasoning_effort` "takes precedence". [official docs] (https://learn.chatgpt.com/docs/agent-configuration/subagents)
- Sandbox/approvals: "Subagents inherit your current sandbox policy."; "Codex also reapplies the parent turn's live runtime overrides when it spawns a child ... even if the selected custom agent file sets different defaults." `sandbox_mode`, `mcp_servers`, `skills.config` "inherit from the parent when the custom agent file omits them." [official docs] (same URL)
- Conversation history: not described in docs. Source: V1 `fork_context` = "True forks the current thread history into the new agent; false or omitted starts with only the initial prompt."; V2 `fork_turns` = "Optional number of turns to fork. Defaults to `all`. Use `none`, `all`, or a positive integer string". [repo source] (https://github.com/openai/codex/blob/main/codex-rs/core/src/tools/handlers/multi_agents_spec.rs)

Nesting
- Subagents page says nothing about nesting or depth. The app-server doc implies descendants at multiple levels: `ancestorThreadId` filter = "spawned descendants of the given thread at any depth". [official docs] (https://learn.chatgpt.com/docs/app-server)
- Source: V1 refuses with "Agent depth limit reached. Solve the task yourself." when child depth exceeds `agent_max_depth` (default 1), and withholds the collab tools at that depth; V2 ignores `max_depth`. [repo source] (https://github.com/openai/codex/blob/main/codex-rs/core/src/tools/handlers/multi_agents/spawn.rs ; https://github.com/openai/codex/blob/main/codex-rs/core/src/tools/spec_plan.rs)

How results come back
- "Return **summaries** from subagents instead of raw intermediate output."; "When many agents are running, Codex waits until all requested results are available, then returns a consolidated response."; CLI: "The main thread collects the subagent results into its final response." `/agent` (also `/subagents`) switches between agent threads. [official docs] (https://learn.chatgpt.com/docs/agent-configuration/subagents ; https://learn.chatgpt.com/docs/developer-commands?surface=cli)
- Source, V1 `wait_agent`: "Wait for agents to reach a final status. Completed statuses may include the agent's final message. ... Once the agent reaches a final status, a notification message will be received containing the same completed status." `close_agent`: "Completed agents remain open and count toward the concurrency limit until closed." [repo source] (https://github.com/openai/codex/blob/main/codex-rs/core/src/tools/handlers/multi_agents_spec.rs)

Built-in and custom agents
- Built-in: `default` ("general-purpose fallback agent"), `worker` ("execution-focused agent for implementation and fixes"), `explorer` ("read-heavy codebase exploration agent"). A custom agent with the same name takes precedence. [official docs] (https://learn.chatgpt.com/docs/agent-configuration/subagents)
- Custom agents: "standalone TOML files under `~/.codex/agents/` for personal agents or `.codex/agents/` for project-scoped agents. Each file defines one custom agent." Required keys: `name`, `description`, `developer_instructions`. Optional: "other supported `config.toml` keys ... such as `model`, `model_reasoning_effort`, `sandbox_mode`, `mcp_servers`, and `skills.config`". "the `name` field is the source of truth" (not the filename). Example values used: `sandbox_mode = "read-only"` / `"workspace-write"`; efforts `low`, `medium`, `high`, `xhigh`, `max`, `ultra`. [official docs] (same URL)
- `nickname_candidates` is not in the current docs; it exists in source on `AgentRoleToml` ("Candidate nicknames for agents spawned with this role"). [repo source] (https://github.com/openai/codex/blob/main/codex-rs/config/src/config_toml.rs)

## 2. Hooks

Where configured, flag, trust
- Two forms "next to active config layers": `hooks.json`, or inline `[hooks]` tables in `config.toml`. "the four most useful locations": `~/.codex/hooks.json`, `~/.codex/config.toml`, `<repo>/.codex/hooks.json`, `<repo>/.codex/config.toml`. Plugins can bundle `hooks/hooks.json`. "If more than one hook source exists, Codex loads all matching hooks." [official docs] (https://learn.chatgpt.com/docs/hooks)
- Feature flag: "Hooks are enabled by default." Key is `[features] hooks`; "`codex_hooks` still works as a deprecated alias." [official docs] (https://learn.chatgpt.com/docs/hooks ; https://learn.chatgpt.com/docs/config-file/config-reference)
- Project trust: "Project-local hooks load only when the project `.codex/` layer is trusted." User-level hooks "remain independent of project trust." [official docs] (https://learn.chatgpt.com/docs/hooks ; https://learn.chatgpt.com/docs/config-file/config-advanced)
- Per-hook trust (applies to user-level hooks too): "Before a non-managed hook can run, Codex requires you to review and trust the exact hook definition. Codex records trust against the hook's current hash, so new or changed hooks are marked for review and skipped until trusted." Use `/hooks` in the CLI. `--dangerously-bypass-hook-trust` skips this for one invocation. [official docs] (https://learn.chatgpt.com/docs/hooks)

Event names (complete list in docs)
- `SessionStart`, `SessionEnd`, `SubagentStart`, `SubagentStop`, `PreToolUse`, `PermissionRequest`, `PostToolUse`, `PreCompact`, `PostCompact`, `UserPromptSubmit`, `Stop`, `Interrupt`. `Interrupt` and `SessionEnd` are marked "doesn't run for subagents". [official docs] (https://learn.chatgpt.com/docs/hooks)

Config shape
- `{"hooks": {"<Event>": [ {"matcher": "<regex>", "hooks": [ {"type": "command", "command": "...", "timeout": <seconds>, "statusMessage": "...", "async": true|false, "additionalContextLimit": <int>, "commandWindows": "..."} ] } ] } }`; optional top-level `description`. TOML equivalent: `[[hooks.<Event>]]` + `[[hooks.<Event>.hooks]]`. [official docs] (https://learn.chatgpt.com/docs/hooks)
- Handler types: "`command` and `mcp_tool` handlers are supported. `prompt` and `agent` handlers are parsed but skipped." [official docs] (same)
- `timeout`: seconds; default `600`; `SessionEnd` and `Interrupt` default `1`, max `3`. "Commands run with the session `cwd` as their working directory." [official docs] (same)
- `matcher`: regex; `"*"`, `""` or omitted matches all. For `SubagentStart`/`SubagentStop` it filters "subagent type" (`agent_type`); ignored for `UserPromptSubmit`, `Stop`, `Interrupt`. [official docs] (same)
- "Multiple matching command hooks for the same event are launched concurrently". [official docs] (same)

Stdin JSON, common fields (every command hook): `session_id` (string; "Current Codex session id. Subagent hooks use the parent session id."), `transcript_path` (string | null), `cwd`, `hook_event_name`, `model` ("Codex-specific extension. Active model slug"). `permission_mode` (`default`, `acceptEdits`, `plan`, `dontAsk`, `bypassPermissions`) is included on `SessionStart`, `PreToolUse`, `PermissionRequest`, `PostToolUse`, `UserPromptSubmit`, `SubagentStart`, `SubagentStop`, `Stop`, `Interrupt`. "the transcript format isn't a stable interface for hooks". [official docs] (https://learn.chatgpt.com/docs/hooks)

Per-event extra fields [official docs] (https://learn.chatgpt.com/docs/hooks)
- `SessionStart`: `source` (`startup`, `resume`, `clear`, `compact`).
- `SessionEnd`: `reason` (currently always `other`). Documented example has no `model`/`turn_id`.
- `SubagentStart`: `turn_id`, `agent_id` ("Identifier for the subagent"), `agent_type` ("Subagent type or profile"), `permission_mode`.
- `SubagentStop`: `turn_id`, `agent_id`, `agent_type`, `agent_transcript_path` (string | null, "Path to the subagent transcript file, if any"), `stop_hook_active` (boolean, "Whether this subagent was already continued"), `last_assistant_message` (string | null).
- `PreToolUse`: `turn_id`, `tool_name`, `tool_use_id`, `tool_input`.
- `PermissionRequest`: `turn_id`, `tool_name`, `tool_input` (may include `tool_input.description`).
- `PostToolUse`: `turn_id`, `tool_name`, `tool_use_id`, `tool_input`, `tool_response`.
- `PreCompact` / `PostCompact`: `turn_id`, `trigger` (`manual` | `auto`).
- `UserPromptSubmit`: `turn_id`, `prompt`.
- `Stop`: `turn_id`, `stop_hook_active`, `last_assistant_message`.
- `Interrupt`: `turn_id`, `permission_mode`.

SubagentStart / SubagentStop detail beyond the docs page
- Generated schemas (both `additionalProperties: false`). `subagent-start.command.input` required: `agent_id`, `agent_type`, `cwd`, `hook_event_name`, `model`, `permission_mode`, `session_id`, `transcript_path`, `turn_id`. `subagent-stop.command.input` required: those plus `agent_transcript_path`, `last_assistant_message`, `stop_hook_active`. No parent-thread-id, depth, nickname or prompt field exists in either. [repo source] (https://github.com/openai/codex/tree/main/codex-rs/hooks/schema/generated ; structs `SubagentStartCommandInput`, `SubagentStopCommandInput` in https://github.com/openai/codex/blob/main/codex-rs/hooks/src/schema.rs)
- `agent_id` is the child thread id (`sess.thread_id().to_string()`); `agent_type` is the spawn role, falling back to `DEFAULT_ROLE_NAME` = `"default"`. [repo source] (https://github.com/openai/codex/blob/main/codex-rs/core/src/hook_runtime.rs ; https://github.com/openai/codex/blob/main/codex-rs/core/src/agent/role.rs)
- `session_id` is the root session id shared by parent and subagents (PR #22268: "hook `session_id` matches the root-thread session across spawned subagents"). [changelog, rust-v0.131.0] (https://github.com/openai/codex/releases/tag/rust-v0.131.0 ; https://github.com/openai/codex/pull/22268)
- On `SubagentStop`, `transcript_path` is the parent thread's transcript and `agent_transcript_path` is the child's (PR #22873 text; code resolves the parent rollout via `parent_thread_id`). On `SubagentStart` the code passes the child session's own transcript path as `transcript_path`; the docs do not say which it is. [repo source] (https://github.com/openai/codex/pull/22873 ; https://github.com/openai/codex/blob/main/codex-rs/core/src/hook_runtime.rs)
- Timing/scope from the PRs: `SubagentStart` "runs once when Codex creates a thread-spawned subagent, before that child sends its first model request. Thread-spawned subagents use `SubagentStart` instead of the normal root-agent `SessionStart` hook." `SubagentStop` "runs when a thread-spawned subagent turn is about to finish" (so it is per turn, and can fire more than once for one subagent). "Internal/system subagents such as Review, Compact, MemoryConsolidation, and Other" run neither. [changelog, rust-v0.133.0: "#22782 Add SubagentStart hook", "#22873 Add SubagentStop hook"] (https://github.com/openai/codex/releases/tag/rust-v0.133.0 ; https://github.com/openai/codex/pull/22782 ; https://github.com/openai/codex/pull/22873)

Do tool events inside a subagent identify the subagent?
- Docs page: not documented (the `PreToolUse`/`PostToolUse` tables list no agent fields).
- Repo schema: `agent_id` and `agent_type` are OPTIONAL properties on `PreToolUse`, `PermissionRequest`, `PostToolUse`, `PreCompact`, `PostCompact`, `UserPromptSubmit` inputs (`#[serde(skip_serializing_if = "Option::is_none")]`); source comment: "Identifies a thread-spawned subagent when a normal hook runs inside it." PR #22882: "Root-agent hook inputs omit these fields." [repo source] (https://github.com/openai/codex/blob/main/codex-rs/hooks/src/schema.rs ; https://github.com/openai/codex/blob/main/codex-rs/hooks/src/events/common.rs)
- Release note: "Added richer extension and hook context, including ... subagent identity in hook inputs. (#22882, #23963)". [changelog, rust-v0.134.0] (https://github.com/openai/codex/releases/tag/rust-v0.134.0)

Other hook changelog facts
- Hooks reached general availability 2026-05-14. [changelog] (https://learn.chatgpt.com/docs/whats-new)
- "#37533 Support asynchronous command hooks" [changelog, rust-v0.148.0] (https://github.com/openai/codex/releases/tag/rust-v0.148.0); "New `Interrupt` hooks ..." [rust-v0.150.0] (https://github.com/openai/codex/releases/tag/rust-v0.150.0); "#33895 Add SessionEnd hooks for thread teardown" [rust-v0.145.0] (https://github.com/openai/codex/releases/tag/rust-v0.145.0)

## 3. Hook output, exit codes, failure, non-blocking

What output can do [official docs] (https://learn.chatgpt.com/docs/hooks)
- "Exit `0` with no output is treated as success and Codex continues."
- Common output fields: `continue` ("If `false`, marks that hook run as stopped"), `stopReason`, `systemMessage` ("Surfaced as a warning in the UI or event stream"), `suppressOutput` ("Parsed today but not yet implemented").
- `SubagentStart`: "Plain text on `stdout` is added as extra developer context for the subagent." JSON may return `hookSpecificOutput.additionalContext`. "`continue: false` is parsed for compatibility, but it doesn't stop the subagent from starting."
- `SubagentStop`: "expects JSON on `stdout` when it exits `0`. Plain text output is invalid for this event." `{"decision":"block","reason":...}` asks Codex "to continue the subagent flow"; "You can also use exit code `2` and write the continuation reason to `stderr`." `continue: false` takes precedence over continuation decisions.
- `PreToolUse`: can deny (`permissionDecision: "deny"`, legacy `decision: "block"`, or exit `2` + stderr), add `additionalContext`, or rewrite via `updatedInput`. `PostToolUse`: `decision: "block"` replaces the tool result with feedback; can't undo side effects. `UserPromptSubmit`: can block the prompt or add context. `Stop`: `decision: "block"` continues the turn with `reason` as a new prompt. `PermissionRequest`: allow/deny. `PreCompact`: `continue: false` stops before compacting. `SessionEnd`: "advisory, so their output won't steer Codex". `Interrupt`: "can't prevent the interruption or restart the turn".

Failure and timeout
- Docs give no single general rule for a command hook that exits non-zero (other than `2`) or times out. Specific statements: `SessionEnd`: "If a command times out or exits with an error, Codex reports it as a hook failure."; `PreToolUse` unsupported fields: "Codex marks that hook run as failed, reports the error, and continues the tool call."; MCP hooks: "Errors, missing servers, and unavailable tools don't block the operation." [official docs] (https://learn.chatgpt.com/docs/hooks)
- Source: any exit code other than `0` (or `2` where blocking is supported) sets `HookRunStatus::Failed` with "hook exited with code {exit_code}" and no block; timeout yields error "hook timed out after {}s", also `Failed`; exit `2` with empty stderr on `SubagentStop` is `Failed`, not a block. [repo source] (https://github.com/openai/codex/blob/main/codex-rs/hooks/src/events/stop.rs ; https://github.com/openai/codex/blob/main/codex-rs/hooks/src/engine/command_runner.rs)

Non-blocking
- "By default, Codex waits for a command hook to finish before continuing the operation that triggered it. Set `async` to `true` to run a command hook in the background while Codex continues." "Background hooks can't block, approve, rewrite, or otherwise control the operation that triggered them." [official docs] (https://learn.chatgpt.com/docs/hooks)
- Limits: "up to eight background hooks concurrently per session"; "When the session ends, Codex cancels unfinished background hooks and discards output that hasn't been delivered."; "`SessionEnd` hooks always run synchronously". Background hooks can still add `additionalContext` (delivered to the next model request) and `systemMessage`. [official docs] (same)

Bearing on "a command hook that only appends one line and exits 0 cannot change what the agents do"
- Supports: exit `0` with no output = success and continue; every control effect requires specific stdout JSON or exit `2` + stderr; `async: true` hooks cannot block or rewrite; `SubagentStart` cannot stop a subagent even with `continue: false`; failures are reported, not blocking (repo source).
- Undercuts / conditions: (a) it must write nothing to stdout — on `SubagentStart` plain stdout becomes developer context for the subagent, and on `SubagentStop` plain text is "invalid"; (b) a synchronous hook makes Codex wait (default timeout 600 s), so it can add delay; (c) exit `2` with stderr on `SubagentStop` continues the subagent; (d) the hook does not run at all until reviewed and trusted, and is re-held for review if its definition changes; (e) coverage gaps: internal subagents (Review, Compact, MemoryConsolidation) fire neither event, and docs say hooks do not "cover every internal subagent path" and "Some specialized tool paths can opt out of the default hook path" (https://learn.chatgpt.com/docs/hooks ; https://learn.chatgpt.com/docs/enterprise/cloud-local-access); (f) async hooks can be cancelled at session end, losing the line.

## 4. Transcripts / rollouts

- "Session transcripts: `$CODEX_HOME/sessions` (default: `~/.codex/sessions`)"; "Archived sessions: `$CODEX_HOME/archived_sessions`". [official docs] (https://learn.chatgpt.com/docs/reference/troubleshooting)
- `codex exec --ephemeral`: "when you don't want to persist session rollout files to disk". [official docs] (https://learn.chatgpt.com/docs/non-interactive-mode)
- The docs do not give the `YYYY/MM/DD/rollout-*.jsonl` layout. Source: path is `<codex_home>/sessions/YYYY/MM/DD/`, filename `rollout-<timestamp>-<thread_id>.jsonl` with timestamp `[year]-[month]-[day]T[hour]-[minute]-[second]` (after `thread/revert`: `rollout-<timestamp>-<thread_id>_<rollout_id>.jsonl`). [repo source] (https://github.com/openai/codex/blob/main/codex-rs/rollout/src/recorder.rs ; https://github.com/openai/codex/blob/main/codex-rs/rollout/src/rollout_file_name.rs)
- Subagent threads having their own file: implied in docs by `agent_transcript_path` on `SubagentStop`, and by app-server text ("spawned descendant thread logs"). In source each thread id gets its own rollout file via the path rule above. [official docs + repo source] (https://learn.chatgpt.com/docs/hooks ; https://learn.chatgpt.com/docs/app-server)
- Mapping child to parent, documented: app-server `thread/list` filters `parentThreadId` ("direct child threads of the given parent thread") and `ancestorThreadId`, both "experimental and requires `capabilities.experimentalApi = true`"; `sourceKinds` values include `subAgent`, `subAgentReview`, `subAgentCompact`, `subAgentThreadSpawn`, `subAgentOther`; item `collabToolCall` = `{id, tool, status, senderThreadId, receiverThreadId?, newThreadId?, prompt?, agentStatus?}`. [official docs] (https://learn.chatgpt.com/docs/app-server)
- Mapping child to parent, in the rollout file: `SessionMeta` fields `session_id` ("session_id is equal to the root thread's ID"), `id`, `parent_thread_id`, `source`, `agent_nickname`, `agent_role`, `agent_path`; `SubAgentSource::ThreadSpawn { parent_thread_id, depth, agent_path, agent_nickname, agent_role }`. [repo source] (https://github.com/openai/codex/blob/main/codex-rs/protocol/src/protocol.rs)
- Via hooks: `SubagentStop` gives parent transcript (`transcript_path`) and child transcript (`agent_transcript_path`) in one payload, plus shared `session_id` and child `agent_id`. [repo source / PR #22873] (https://github.com/openai/codex/pull/22873)

## 5. Hooks in `codex exec` and in cloud

- `codex exec`: no doc sentence says "hooks run in `codex exec`"; the non-interactive page does not mention lifecycle hooks at all. Indirect documented evidence: `--dangerously-bypass-hook-trust` is listed among the `codex exec` options ("Run enabled hooks without requiring persisted hook trust for this invocation. Intended only for automation that already vets hook sources."), and the hooks page says "For one-off automation that already vets hook sources outside Codex, pass `--dangerously-bypass-hook-trust`". [official docs] (https://learn.chatgpt.com/docs/developer-commands?surface=cli ; https://learn.chatgpt.com/docs/hooks)
- Source: the exec crate defines `bypass_hook_trust` as a global arg and handles `HookStarted`/`HookCompleted` notifications. [repo source] (https://github.com/openai/codex/blob/main/codex-rs/exec/src/cli.rs ; https://github.com/openai/codex/blob/main/codex-rs/exec/src/lib.rs)
- Related: `--ignore-user-config` = "Do not load `$CODEX_HOME/config.toml`." Whether it also skips `~/.codex/hooks.json` is not documented. Documented `--json` event types (`thread.started`, `turn.started`, `turn.completed`, `turn.failed`, `item.*`, `error`) include no hook event. Subagents in non-interactive flows: "an action that needs new approval fails and Codex surfaces the error back to the parent workflow." [official docs] (https://learn.chatgpt.com/docs/non-interactive-mode ; https://learn.chatgpt.com/docs/agent-configuration/subagents)
- Codex Cloud tasks: the Codex Cloud and cloud-environment pages do not mention hooks or `.codex/hooks.json`. [official docs, silent] (https://learn.chatgpt.com/docs/cloud ; https://learn.chatgpt.com/docs/environments/cloud-environments)
- Closest documented statements (about cloud orchestration in ChatGPT Work, not explicitly Codex Cloud tasks): "Command/shell, prompt, and agent handlers; hooks from local configuration, plugins, or local directories; environment-scoped hooks; and `SessionEnd` MCP hooks are not supported with cloud orchestration, even when tools execute locally. When both orchestration and execution are local, existing supported hooks continue to work in local-only Work and Codex threads." Only admin-managed `mcp_tool` hooks from Global `requirements.toml` run on the cloud orchestrator. [official docs] (https://learn.chatgpt.com/docs/hooks ; https://learn.chatgpt.com/docs/enterprise/cloud-local-access)

## 6. Model names (https://learn.chatgpt.com/docs/models) [official docs]

- Recommended: `gpt-6-astra` (Astra), `gpt-6.1-sol` (GPT-6.1 Sol, confirmed: "Use `gpt-6.1-sol`"), `gpt-6-luna` (GPT-6 Luna).
- Also named as available: GPT-6 Sol (`gpt-6-sol`); "GPT-5.6 Sol, GPT-5.6 Terra, and GPT-5.6 Luna remain available during the rollout" (no slugs given on the page).
- Other: `gpt-5.5` ("Retires from ChatGPT, ChatGPT Work, and Codex on October 14, 2026").
- Retired/deprecated per the page: `gpt-5.3-codex-spark` (retired 2026-09-14), `gpt-5.4` and `gpt-5.4-mini` (retired 2026-08-31), `gpt-5.2`, `gpt-5.3-codex`.
- Subagent guidance: "`gpt-6.1-sol`: Start here for demanding agents"; "`gpt-6-luna`: Use for fast, narrowly scoped agents". GPT-6 Luna "supports reasoning efforts up to **Max**, but not **Ultra**". (https://learn.chatgpt.com/docs/agent-configuration/subagents ; https://learn.chatgpt.com/docs/models)

## Not documented (in official docs; repo-only evidence noted where found)

- `agents.max_depth` (repo source only; "V1 ... Ignored by V2", default 1).
- Whether subagents can nest, and any depth limit (docs silent; repo source only).
- `spawn_agents_on_csv`, `agents.job_max_runtime_seconds` (absent from docs; removed/no-op in source), `nickname_candidates` (source only).
- A tool named `wait` (current name is `wait_agent`); the V2 tool set (`send_message`, `followup_task`, `list_agents`, `interrupt_agent`) and `features.multi_agent_v2` (source only).
- Parameters of `spawn_agent` and what conversation history a subagent receives (source only: `fork_context` / `fork_turns`).
- The default value of `agents.max_concurrent_threads_per_session` (docs: "Codex chooses the default"; source: 6 for V1, 4 for V2).
- `agent_id` / `agent_type` on tool, compact and prompt hook inputs fired inside a subagent (in repo schema and a release note; not on the hooks docs page).
- That `agent_id` equals the subagent's thread id, and that `agent_type` is `"default"` when no role is given (source/PR only).
- Which transcript `transcript_path` points to on `SubagentStart` and `SubagentStop` (source/PR only).
- Any parent-thread-id, depth, nickname or spawn-prompt field in `SubagentStart`/`SubagentStop` payloads (none exists in the schema).
- Whether `SubagentStop` fires once per subagent or once per subagent turn (PR text says per turn; docs silent).
- A general rule for command-hook non-zero exit codes other than `2`, and for timeouts (source only: marked failed, no block).
- Whether hook failure messages are visible to the model, and whether hook commands run inside the sandbox.
- The `sessions/YYYY/MM/DD/rollout-<timestamp>-<id>.jsonl` layout and the `SessionMeta` line format (source only; docs call the transcript format not stable).
- An explicit statement that hooks run in `codex exec`; whether `--ignore-user-config` also skips `~/.codex/hooks.json`.
- Whether hooks (any kind) or custom agents under `.codex/agents/` run in Codex Cloud tasks.
- Model slugs for GPT-5.6 Sol / Terra / Luna.
