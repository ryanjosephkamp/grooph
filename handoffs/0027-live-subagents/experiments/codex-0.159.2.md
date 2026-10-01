# Codex CLI 0.159.2, observed 2026-09-30 (UTC 2026-10-01T01:26)

One non-interactive session (`codex exec … -m gpt-6-luna -c model_reasoning_effort="low" -s read-only --json`, 23 s, on the ChatGPT sign-in) in a scratch folder. Eight command hooks were passed for this one invocation with `-c hooks.<Event>=[…]` and `--dangerously-bypass-hook-trust` (nothing under `~/.codex` was changed); each hook appended its stdin to a file. The session was asked to spawn two subagents. Below: every hook call in the order it was written. Values are shown only for ids (last six characters), names and models; prompts, tool inputs and replies are left out.

Two sessions appear. `…dd92f2` is the one that was asked for. `…a647b3` was not: its working directory is `~/.codex/memories`, its model is `gpt-5.6-terra`, and it spawned a subagent of its own on `gpt-6.1-sol`. It is Codex writing its memories in the background (this machine has `features.memories` on), and **it fired the same hooks**. A hook that is passed at user level sees it; a hook has to check `cwd` to tell the two apart.

 1. **SessionStart** {"session_id": "\u2026a647b3", "source": "startup", "model": "gpt-5.6-terra", "permission_mode": "bypassPermissions"}
    keys: `session_id, transcript_path, cwd, model, permission_mode, source`
 2. **UserPromptSubmit** {"session_id": "\u2026a647b3", "turn_id": "\u20262625b7", "model": "gpt-5.6-terra", "permission_mode": "bypassPermissions"}
    keys: `session_id, turn_id, transcript_path, cwd, model, permission_mode, prompt`
 3. **SessionStart** {"session_id": "\u2026dd92f2", "source": "startup", "model": "gpt-6-luna", "permission_mode": "default"}
 4. **UserPromptSubmit** {"session_id": "\u2026dd92f2", "turn_id": "\u2026d4a53c", "model": "gpt-6-luna", "permission_mode": "default"}
 5. **PreToolUse** {"session_id": "\u2026dd92f2", "turn_id": "\u2026d4a53c", "tool_name": "collaborationspawn_agent", "model": "gpt-6-luna", "permission_mode": "default"}
    keys: `session_id, turn_id, transcript_path, cwd, model, permission_mode, tool_name, tool_input, tool_use_id`
 6. **PostToolUse** {"session_id": "\u2026dd92f2", "turn_id": "\u2026d4a53c", "tool_name": "collaborationspawn_agent", "model": "gpt-6-luna", "permission_mode": "default"}
    keys: `session_id, turn_id, transcript_path, cwd, model, permission_mode, tool_name, tool_input, tool_response, tool_use_id`
 7. **PreToolUse** {"session_id": "\u2026a647b3", "turn_id": "\u20262625b7", "tool_name": "Bash", "model": "gpt-5.6-terra", "permission_mode": "bypassPermissions"}
 8. **PostToolUse** {"session_id": "\u2026a647b3", "turn_id": "\u20262625b7", "tool_name": "Bash", "model": "gpt-5.6-terra", "permission_mode": "bypassPermissions"}
 9. **PreToolUse** {"session_id": "\u2026dd92f2", "turn_id": "\u2026d4a53c", "tool_name": "collaborationspawn_agent", "model": "gpt-6-luna", "permission_mode": "default"}
10. **PostToolUse** {"session_id": "\u2026dd92f2", "turn_id": "\u2026d4a53c", "tool_name": "collaborationspawn_agent", "model": "gpt-6-luna", "permission_mode": "default"}
11. **SubagentStart** {"session_id": "\u2026dd92f2", "turn_id": "\u20260638b7", "agent_id": "\u2026c8bf5c", "agent_type": "default", "model": "gpt-6-luna", "permission_mode": "default"}
    keys: `session_id, turn_id, transcript_path, cwd, model, permission_mode, agent_id, agent_type`
12. **PreToolUse** {"session_id": "\u2026dd92f2", "turn_id": "\u2026d4a53c", "tool_name": "collaborationwait_agent", "model": "gpt-6-luna", "permission_mode": "default"}
13. **PreToolUse** {"session_id": "\u2026a647b3", "turn_id": "\u20262625b7", "tool_name": "collaborationspawn_agent", "model": "gpt-5.6-terra", "permission_mode": "bypassPermissions"}
14. **PostToolUse** {"session_id": "\u2026a647b3", "turn_id": "\u20262625b7", "tool_name": "collaborationspawn_agent", "model": "gpt-5.6-terra", "permission_mode": "bypassPermissions"}
15. **SubagentStart** {"session_id": "\u2026dd92f2", "turn_id": "\u202643d8aa", "agent_id": "\u202691492d", "agent_type": "default", "model": "gpt-6-luna", "permission_mode": "default"}
16. **PreToolUse** {"session_id": "\u2026dd92f2", "turn_id": "\u20260638b7", "agent_id": "\u2026c8bf5c", "agent_type": "default", "tool_name": "Bash", "model": "gpt-6-luna", "permission_mode": "default"}
    keys: `session_id, turn_id, agent_id, agent_type, transcript_path, cwd, model, permission_mode, tool_name, tool_input, tool_use_id`
17. **PostToolUse** {"session_id": "\u2026dd92f2", "turn_id": "\u20260638b7", "agent_id": "\u2026c8bf5c", "agent_type": "default", "tool_name": "Bash", "model": "gpt-6-luna", "permission_mode": "default"}
    keys: `session_id, turn_id, agent_id, agent_type, transcript_path, cwd, model, permission_mode, tool_name, tool_input, tool_response, tool_use_id`
18. **SubagentStart** {"session_id": "\u2026a647b3", "turn_id": "\u2026b2d94c", "agent_id": "\u2026fc3da9", "agent_type": "default", "model": "gpt-6.1-sol", "permission_mode": "bypassPermissions"}
19. **SubagentStop** {"session_id": "\u2026dd92f2", "turn_id": "\u20260638b7", "agent_id": "\u2026c8bf5c", "agent_type": "default", "model": "gpt-6-luna", "permission_mode": "default", "stop_hook_active": false}
    keys: `session_id, turn_id, transcript_path, agent_transcript_path, cwd, model, permission_mode, stop_hook_active, agent_id, agent_type, last_assistant_message`
20. **PreToolUse** {"session_id": "\u2026a647b3", "turn_id": "\u20262625b7", "tool_name": "Bash", "model": "gpt-5.6-terra", "permission_mode": "bypassPermissions"}
21. **PostToolUse** {"session_id": "\u2026a647b3", "turn_id": "\u20262625b7", "tool_name": "Bash", "model": "gpt-5.6-terra", "permission_mode": "bypassPermissions"}
22. **PostToolUse** {"session_id": "\u2026dd92f2", "turn_id": "\u2026d4a53c", "tool_name": "collaborationwait_agent", "model": "gpt-6-luna", "permission_mode": "default"}
23. **PreToolUse** {"session_id": "\u2026dd92f2", "turn_id": "\u202643d8aa", "agent_id": "\u202691492d", "agent_type": "default", "tool_name": "Bash", "model": "gpt-6-luna", "permission_mode": "default"}
24. **PostToolUse** {"session_id": "\u2026dd92f2", "turn_id": "\u202643d8aa", "agent_id": "\u202691492d", "agent_type": "default", "tool_name": "Bash", "model": "gpt-6-luna", "permission_mode": "default"}
25. **PreToolUse** {"session_id": "\u2026dd92f2", "turn_id": "\u2026d4a53c", "tool_name": "collaborationwait_agent", "model": "gpt-6-luna", "permission_mode": "default"}
26. **SubagentStop** {"session_id": "\u2026dd92f2", "turn_id": "\u202643d8aa", "agent_id": "\u202691492d", "agent_type": "default", "model": "gpt-6-luna", "permission_mode": "default", "stop_hook_active": false}
27. **PostToolUse** {"session_id": "\u2026dd92f2", "turn_id": "\u2026d4a53c", "tool_name": "collaborationwait_agent", "model": "gpt-6-luna", "permission_mode": "default"}
28. **PreToolUse** {"session_id": "\u2026a647b3", "turn_id": "\u2026b2d94c", "agent_id": "\u2026fc3da9", "agent_type": "default", "tool_name": "Bash", "model": "gpt-6.1-sol", "permission_mode": "bypassPermissions"}
29. **PostToolUse** {"session_id": "\u2026a647b3", "turn_id": "\u2026b2d94c", "agent_id": "\u2026fc3da9", "agent_type": "default", "tool_name": "Bash", "model": "gpt-6.1-sol", "permission_mode": "bypassPermissions"}
30. **Stop** {"session_id": "\u2026dd92f2", "turn_id": "\u2026d4a53c", "model": "gpt-6-luna", "permission_mode": "default", "stop_hook_active": false}
    keys: `session_id, turn_id, transcript_path, cwd, model, permission_mode, stop_hook_active, last_assistant_message`
31. **SessionEnd** {"session_id": "\u2026a647b3", "reason": "other"}
    keys: `session_id, transcript_path, cwd, reason`
32. **SessionEnd** {"session_id": "\u2026dd92f2", "reason": "other"}

## What was learned beyond the keys

- Hooks run in `codex exec`. The documentation does not say so in a sentence; this run shows it.
- `session_id` is the root session's id on every event, the subagents' included. `agent_id` is the subagent's own thread id.
- `agent_type` was `default` for both subagents, though the prompt asked for an explorer and a worker: the model called `spawn_agent` with a `task_name` and no role.
- The spawn tool appears to hooks as `collaborationspawn_agent`, the wait as `collaborationwait_agent`, a shell command as `Bash`. The spawn's `tool_input.message` is not readable text (it arrives encrypted); its `tool_response` is `{"task_name":"/root/explorer"}`.
- On `SubagentStart`, `transcript_path` is the **subagent's** rollout file. On `SubagentStop`, `transcript_path` is the **parent's** and `agent_transcript_path` is the subagent's.
- Tool events inside a subagent carry `agent_id` and `agent_type`; in the root session they do not.
- Every payload carries `model`. The memory session's `transcript_path` was `null`.
- Rollout files: `~/.codex/sessions/2026/09/30/rollout-<timestamp>-<thread id>.jsonl`, one per thread.
- The hook's environment held no `CODEX_*` variable that names the project; its working directory was the session's `cwd`.
- `codex exec` waits for standard input when it is not a terminal (`Reading additional input from stdin...`). The first attempt hung for five minutes for that reason and was killed; with `< /dev/null` the run took 23 seconds.
- With `--dangerously-bypass-hook-trust` Codex prints a warning item at the start of its event stream, once per hook source.
