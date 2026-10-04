# Handback 0054 · The Operator's seventh answer: documents only

**Branch:** `slice/0054-operators-seventh-reply` · **Date:** 2026-10-04 · **By:** the operator-round session (Opus 5.5) · **Spend:** none

The Operator installed 0.2.5 on the other project's default branch. Three cloud lanes took it up by merging mid-session. A turn's start is now sent, and a tool call sent in passing once. No lane has yet had a turn longer than ten minutes.

## What changed

No code, and no version. Three things in the documents:

- **Corrected: how often the harness's own helper stops.** I had written that an untyped `subagent-stop` follows every turn's end. That is what one desktop session showed (19 of 19). The Operator counted 16 against 61 turn ends in its cloud lanes. The timing and the missing type, start and `Agent` line are what identify the lines; the count varies.
- **Recorded: a cloud turn can end twice.** The cloud's own check at a turn's end can send the session back to commit or push, and the turn ends again seconds later. grooph counts no turns, so nothing it shows is doubled.
- **Recorded: a lane may go on with the hook entries it started with.** One lane, after merging 0.2.5 mid-turn, recorded its tool calls and sent at its turn's end but did not send in passing. The Operator read that as a partial take-up. Everything the lane did is what 0.2.4's settings do, so I read it as no take-up of the changed settings at all. `docs/HANDBACK-operator.md` section 18 says how to tell from outside: whether the branch moves at the lane's next turn start.

## Considered and not done

- **Reading a tool call after a turn's end as the turn being open again.** It would make a lane read `working` during the few seconds between a cloud turn's two ends. A background hook's line can also land just after a real turn's end, and would then leave an idle session reading `working` for half an hour. The gain is seconds; the risk is a wrong state. Left as it is.
- **Recording which moment each push ran at** (a turn's start, its end, in passing), so `--status` could show a session still running older entries. The same is visible from outside in when the branch moves, and it only matters while hook settings are changing, which they have now stopped doing.

## Not verified

Everything about the cloud lanes is the Operator's report.
