# 0017 · A stale record is read as stale; sending at a turn's end is asked for

**Date:** 2026-10-01 · **Status:** proposed (pull requests 0042 to 0044, waiting on the owner) · **Deciders:** driver, from the Operator's cloud run; the owner by merging

## Context

Decision 0016 put the events on a branch of their own and said the push is "a command a lane runs, not something the hook does: the hook's promise is one appended line and no network." Hours later the Operator ran it in a cloud lane and reported what that costs: the push is a snapshot. The lane pushed mid-turn; the end of the turn and the session's end stayed in the sandbox; the lane read "working" for good. A session cannot send what it writes as it stops.

## Decision

1. **The reader does not trust silence.** A session that has not ended and has said nothing for half an hour is shown as last seen, with the state it was in then. This is always on and changes no record.
2. **Decision 0016's rule stands for the event hook and is narrowed for the push.** The event hook still appends one line and reaches no network. A second hook may send the events at the end of every turn, in the background, **only when a project's owner installs it with `--push`**. It keeps the event hook's promises towards the session (no output, exit 0, nothing read back) and the push command's guard (only a branch that holds events and nothing else).
3. **Not rate-limited, and the session's end is not sent.** Reasons in handback 0044.
4. **What someone else saw is labelled as reported.** The cloud is the Operator's to watch. `docs/subagents.md` gains a fourth label beside documented, seen and unknown.

## Consequences

- Amendment A-014. Version 0.2.1.
- The Operator chooses whether its lanes send at each turn's end. The default costs nothing and reads honestly.
- The turn-end push has been run as a harness would run it and never by a harness. The first lane to install it is the test.
