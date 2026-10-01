# Claude Code 2.1.280, observed 2026-09-30 (UTC 2026-10-01T01:20)

One headless session (`claude -p … --model sonnet`, $0.15, 7 s) in a scratch project whose `.claude/settings.json` ran a command hook on eight events; the hook appended its stdin to a file. The main session dispatched two subagents in one message: a custom agent (`probe-reader`, from `.claude/agents/`) and the built-in `general-purpose`. Below: every hook call in the order it was written, with the keys it received. Values are shown only for ids and names; prompts, tool inputs and replies are left out.

 1. **SessionStart** {"source": "startup"}
    keys: `session_id, transcript_path, cwd, source`
 2. **UserPromptSubmit** {"permission_mode": "acceptEdits"}
    keys: `session_id, transcript_path, cwd, prompt_id, permission_mode, prompt`
 3. **PreToolUse** {"tool_name": "Agent", "permission_mode": "acceptEdits"}
    keys: `session_id, transcript_path, cwd, prompt_id, permission_mode, effort, tool_name, tool_input, tool_use_id`
 4. **SubagentStart** {"agent_id": "a043f0a6f6c9270c8", "agent_type": "probe-reader"}
    keys: `session_id, transcript_path, cwd, prompt_id, agent_id, agent_type`
 5. **PreToolUse** {"tool_name": "Agent", "permission_mode": "acceptEdits"}
    keys: `session_id, transcript_path, cwd, prompt_id, permission_mode, effort, tool_name, tool_input, tool_use_id`
 6. **SubagentStart** {"agent_id": "a52dd83149b6f83b3", "agent_type": "general-purpose"}
    keys: `session_id, transcript_path, cwd, prompt_id, agent_id, agent_type`
 7. **PreToolUse** {"agent_id": "a043f0a6f6c9270c8", "agent_type": "probe-reader", "tool_name": "Read", "permission_mode": "acceptEdits"}
    keys: `session_id, transcript_path, cwd, prompt_id, permission_mode, agent_id, agent_type, tool_name, tool_input, tool_use_id`
 8. **PostToolUse** {"agent_id": "a043f0a6f6c9270c8", "agent_type": "probe-reader", "tool_name": "Read", "permission_mode": "acceptEdits"}
    keys: `session_id, transcript_path, cwd, prompt_id, permission_mode, agent_id, agent_type, tool_name, tool_input, tool_response, tool_use_id, duration_ms`
 9. **PreToolUse** {"agent_id": "a52dd83149b6f83b3", "agent_type": "general-purpose", "tool_name": "Bash", "permission_mode": "acceptEdits"}
    keys: `session_id, transcript_path, cwd, prompt_id, permission_mode, agent_id, agent_type, effort, tool_name, tool_input, tool_use_id`
10. **PostToolUse** {"agent_id": "a52dd83149b6f83b3", "agent_type": "general-purpose", "tool_name": "Bash", "permission_mode": "acceptEdits"}
    keys: `session_id, transcript_path, cwd, prompt_id, permission_mode, agent_id, agent_type, effort, tool_name, tool_input, tool_response, tool_use_id, duration_ms`
11. **SubagentStop** {"agent_id": "a043f0a6f6c9270c8", "agent_type": "probe-reader", "permission_mode": "acceptEdits", "stop_hook_active": false}
    keys: `session_id, transcript_path, cwd, prompt_id, permission_mode, agent_id, agent_type, stop_hook_active, agent_transcript_path, last_assistant_message, background_tasks, session_crons`
12. **PostToolUse** {"tool_name": "Agent", "permission_mode": "acceptEdits"}
    keys: `session_id, transcript_path, cwd, prompt_id, permission_mode, effort, tool_name, tool_input, tool_response, tool_use_id, duration_ms`
13. **SubagentStop** {"agent_id": "a52dd83149b6f83b3", "agent_type": "general-purpose", "permission_mode": "acceptEdits", "stop_hook_active": false}
    keys: `session_id, transcript_path, cwd, prompt_id, permission_mode, agent_id, agent_type, effort, stop_hook_active, agent_transcript_path, last_assistant_message, background_tasks, session_crons`
14. **PostToolUse** {"tool_name": "Agent", "permission_mode": "acceptEdits"}
    keys: `session_id, transcript_path, cwd, prompt_id, permission_mode, effort, tool_name, tool_input, tool_response, tool_use_id, duration_ms`
15. **Stop** {"permission_mode": "acceptEdits", "stop_hook_active": false}
    keys: `session_id, transcript_path, cwd, prompt_id, permission_mode, effort, stop_hook_active, last_assistant_message, background_tasks, session_crons`
16. **SessionEnd** {"reason": "other"}
    keys: `session_id, transcript_path, cwd, prompt_id, reason`

## What the hook's environment held

`CLAUDE_PROJECT_DIR` (the project root), `CLAUDE_CODE_SESSION_ID`, `CLAUDECODE=1`, `CLAUDE_CODE_ENTRYPOINT=sdk-cli`, `CLAUDE_PID`, and the hook's working directory was the project root.

## Where the transcripts were

```
~/.claude/projects/<project path with / as ->/<session id>.jsonl                      the main session
~/.claude/projects/<project path with / as ->/<session id>/subagents/agent-<agent id>.jsonl
~/.claude/projects/<project path with / as ->/<session id>/subagents/agent-<agent id>.meta.json
```

`agent_transcript_path` on `SubagentStop` was the `agent-<agent id>.jsonl` path; `transcript_path` on every event was the main session's file.
