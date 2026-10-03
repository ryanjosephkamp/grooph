# 2026-10-03: what a background subagent leaves, and the stop lines nobody started

No model session was started for this. It reads the event file of a session that was already running: the grooph operator-round session on the owner's Mac (the Claude desktop app, Claude Code 2.1.286), which has grooph's event hook installed and starts its subagents in the background.

The Operator had seen, in its cloud lanes, `subagent-stop` lines with an agent id and no type, with no start line and no `Agent` tool line beside them. It took them for subagents the lanes had started in the background. [`this-sessions-subagents.json`](this-sessions-subagents.json) is what this session's own file holds, with ids and times and no paths.

| | Count | Start line | `Agent` tool line | Stop line | Transcript on disk |
|---|---|---|---|---|---|
| Subagents the session started (all seven in the background, by their own records) | 7 | 7 | 7 | 7, each with its type | 7 |
| Stops with no type | 20 | 0 | 0 | 20 | 0 |

The session had 19 turn ends. Nineteen of the twenty untyped stops came 1.4 to 4.5 seconds after one, one each; the twentieth came during a turn.

**What it shows.** A subagent started in the background is recorded like one in the foreground. The untyped stops are not subagents: Claude Code's hooks reference says `SubagentStop` also fires for agents it runs itself (prompt suggestions are its example), with an empty type. One follows each turn's end here.

The event file itself stays on this machine (`.grooph/events/` is ignored). The JSON is made from it and from whether each agent's transcript file exists.
