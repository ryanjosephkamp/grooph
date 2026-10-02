# 0018 · A push is never dropped without a sign

**Date:** 2026-10-02 · **Status:** proposed (waits for the owner's word on the merge) · **Deciders:** owner, driver, from the Operator's trial of the turn-end push

## Context

Decision 0017 added a hook that sends the events at the end of every turn and made it silent: it prints nothing and always exits 0, so it can never fail a turn. The Operator tried it in a fresh cloud session on 2026-10-02. Nothing arrived, and nothing said why. The cause: a cloud session starts with no branch checked out, the push had no name to give its branch and threw, and the hook swallowed the error as designed. Three turns were lost without a trace. Its test runners always work on a bare commit, so they would never have sent anything.

The Operator also pointed out that a repository's hook settings are one file shared by every lane, so a branch named at install is one branch for about ten sessions, and asked whether that is safe.

## Decision

1. **With no branch checked out, the events go to `grooph-events-detached`.** One fixed name, shared by every such checkout, beside `grooph-events/` and not inside it: a branch called `detached/…` would otherwise never be able to send. A name made from the commit would change with every commit; a name made from the session id would make a branch per session, which a reader would have to discover before reading. Sharing is safe because each session writes a file of its own.
2. **The push leaves a record.** `.grooph/events/.last-push.json`: that a push began, then how it ended (arrived, on which try; or failed, with what git said, how many in a row and since when; and when one last arrived). `grooph hooks status` and `grooph sessions` say it. The hook is still silent towards the session; it is no longer traceless. A push that is stopped dead leaves only "began", and that is said too.
3. **Many sessions may share one events branch, and the answer is measured.** The remote takes one push at a time and only on top of what it holds, so when n sessions' turns end in the same moment one gets through per round and the rest look again and go on top. The hook now goes on for as long as its 45 seconds allow, where it gave up after three tries. On GitHub a round took about 2.5 seconds: ten at once all arrived, the last after 25 seconds. So about sixteen at one moment is the ceiling; past it the ones left over fail, say so in their record, and their lines go with their next turn.
4. **A session on two branches is one session.** A lane that starts detached and then starts its branch has its first lines on the shared branch and its whole file on its own. A reader given both counts each line once and shows the session under the source that holds the most of it.
5. **An events commit is made as `grooph`.** Found by the measurement itself: GitHub refused the first attempt because the commits carried the owner's private e-mail address. The events are ids, names of agents and times; the commit that carries them should not add a person.

6. **A refusal is a race only when the branch moved and the remote did not decline it.** Words alone mislead both ways: a branch name git can never make beside another (`grooph-events/fix/abc` next to `grooph-events/fix`) is refused in a race's words for ever, and a remote at `…/access-denied.git` would make every race look declined. So the branch is looked at again, and only the remote's own reason (its `remote:` lines and the reason in brackets, without addresses or branch names) can say "declined". A refusal that leaves the branch where it was counts towards three and stops.

## What an independent read found

A fresh subagent read the change before it was pushed and reproduced nineteen points, none destructive; a second read of the rewritten parts found nine more, the worst a permanent refusal counted as a race (106 pushes in one turn's end). All are fixed but three small ones, listed in handback 0048. From the first read: Fixed: the time limit relied on the shell's job control (wrong under `dash`, and absent in a sandbox with no terminal); the by-hand cap of twenty tries also applied to the hook; a failed fetch was taken for a missing branch; the repository's `pre-push` hook ran on every try; a blobless clone could not send to a shared branch; an unborn branch read as "no branch"; a branch with a tag of the same name was misnamed; a plan said through the MCP server went to the wrong session when read from two branches; the record trusted and printed whatever the file held. The ten-session test became four, with ten left to the measurement. From the second: the race rule above; the guard's timer outliving every call; out-of-time messages that blamed the wrong thing; a link among the events followed to whatever it pointed at (older than this change: a link a pull request adds would have sent its target).

## Consequences

- Amendment A-015. Version 0.2.3.
- One install line works for every lane from a shared settings file: `grooph hooks install --push --tools`, with no branch named.
- Still unseen: the turn-end push run by a harness in a cloud session. The Operator's next trial (two sessions at once, one with no branch) is the test, and this time a failure will say what it was.
- A failed push is recorded where it happened. A reader on another machine still sees only that nothing arrived; to learn why, someone has to look in that session's sandbox.
