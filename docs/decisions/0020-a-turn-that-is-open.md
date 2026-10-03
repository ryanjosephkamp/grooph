# 0020 · A turn that is open is sent as open

**Date:** 2026-10-03 · **Status:** accepted (the owner approved the merge, 2026-10-03) · **Deciders:** owner, driver, from the Operator's first day with the hooks on its lanes

## Context

The owner said yes to the lanes publishing their events, and the Operator put the hooks on the other project's default branch with 0.2.4. Four lanes and one runner sent 163 lines in two hours. Nothing was sent that should not have been, and no push failed. The Operator reported three things to weigh.

- **Subagents.** Lanes that "used a subagent" showed only a subagent-stop line, with no type, and `grooph sessions` read "no subagents yet".
- **Long turns.** A lane half an hour into a long turn read "last seen 32 min ago, waiting then".
- **One lane never recorded.** It had merged the hooks in mid-session, as three others did that recorded at once.

## Decision

1. **The stop lines are the harness's own helper, and the reader is right.**
   - Claude Code's documentation says `SubagentStop` also fires for agents it runs itself, such as the one behind prompt suggestions, with an empty type.
   - This session's own record shows it: 19 turn ends, and 19 untyped stops each 1.4 to 4.5 seconds after one, with no start, no `Agent` line and no transcript.
   - The seven subagents this session did start, all in the background, each left a start, an `Agent` line and a typed stop.
   - So no code changes. The documents now say what the lines are.
2. **A turn's start is sent, and a long turn is sent in passing.**
   - The push also runs at `UserPromptSubmit`, so a reader elsewhere sees `working` as soon as a turn opens.
   - It also runs on a recorded tool call when the last push was ten minutes ago or more. Ten minutes is well inside the half hour after which a silent session reads "last seen", so a lane at work does not read as gone.
   - The earlier advice, "install with `--tools` and a session at work is heard from all the time", was true on the session's own machine and false for a reader elsewhere. This makes it true there.
3. **Wait at a turn's start or end; give way in passing.**
   - A turn shorter than a push would otherwise have its end give way to the push its own start began, and its last lines would wait for the next turn.
   - So a turn's start or end waits for the push under way and then sends.
   - A push made in passing gives way, because the push under way carries the same lines.
4. **The throttle is the record's own time.**
   - The in-passing hook runs after every recorded tool call, so it must cost almost nothing when it has nothing to do: one process, one file's time read, and out.
   - A failed push also moves that time, so a remote that is down is tried every ten minutes, not after every tool call.
   - Once it holds the lock, an in-passing push looks at that time again: of several tool calls that end in the same moment, one pushes and the rest have nothing left to do.
5. **A sandbox can say what it has.**
   - `--status` on the push script needs no grooph. It says whether the settings hold the hooks, whether the event hook runs, whether this session has recorded a line, and how the last push went.
   - It cannot say why a harness did not take up hooks that arrived mid-session. It can say that this is what happened.
6. **Not changed: how a typed stop from an agent never seen starting is read.** If a session itself runs as an agent, the documentation says the helper's stops carry that agent's name, and grooph would then show one as a subagent. That is documented, not seen, and the fix would risk hiding real subagents whose start was missed. It is written down as a limit.

## Consequences

- Amendment A-017. Version 0.2.5.
- An install made by 0.2.4 keeps working and sends at a turn's end only. `grooph hooks status` says so and how to get the rest: install again with `--push` and commit.
- More commits on an events branch: one per turn start and end, and up to six an hour during a long turn.
- Still unknown: why one lane did not take up the hooks. The next such lane can be asked to run `--status`.
- Accepted, after an independent read: a turn's end that gives up after twenty seconds of waiting for a stuck push leaves no word of its own (the stuck push does); and two pushes that both find a lock over two minutes old can both take it, which git makes safe.
