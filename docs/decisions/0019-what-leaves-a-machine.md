# 0019 · What leaves a machine

**Date:** 2026-10-03 · **Status:** proposed (waits for the owner's word on the merge) · **Deciders:** owner, driver, from the Operator's second trial of the turn-end push

## Context

The second trial worked. Two cloud sessions ran at once, one of them with no branch checked out, and every turn's push arrived within seconds. It also showed two things:

- **Leftover files are sent again.** The cloud environment kept git-ignored files from an earlier sandbox. Each fresh session sent an October 1 session's file as if it were its own.
- **The branches would be public.** The other project's repository is public, so its events branches would be too. The Operator would ask the owner first.

## Decision

1. **A turn's end sends what has to do with its session.** The harness tells a hook which session's turn ended. A file goes when:
   - it is that session's own file;
   - it has a line written since that session began, which covers what its lead said through the MCP server;
   - or the branch already holds it. An earlier session's end, which no push of its own carried, then still arrives.

   Told nothing it can use, the push sends every file, as by hand. A file left by a session that ran elsewhere, on a branch that never had it, is not this session's to send.
2. **Paths stay on the machine.** A folder is sent as its name, and a subagent transcript's path is not sent. Neither means anything on another machine. On a person's own computer, a path names the person. The branch's existing copy is put in the same form before the two are joined, so a copy sent by an older version still joins line for line.
3. **Only whole lines that are events go.** A line still being written waits for the next push; sent half-written, it would later be joined beside its finished self. Where a branch holds one event twice, once from an older version with its path, it is kept once.
4. **Whether to publish is the owner's.** grooph lists exactly what an events branch holds (`docs/HANDBACK-operator.md` section 16) and does not decide for him.

## Consequences

- Amendment A-016. Version 0.2.4.
- An independent read found that the first form of rule 1 (only files with a line since this session began) would have stranded an earlier session's last lines in its clone for good. The branch-already-holds-it clause is the fix.
- A file that never reached any branch, left by a session whose every push failed, is not sent by a later session's hook. `grooph events push` by hand sends it.
- Events sent by older versions keep their full paths in the branch's history, which no later commit rewrites.
