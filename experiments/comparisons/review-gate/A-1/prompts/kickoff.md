Run the grooph graph `truncate` (Truncate) in this project. You are the lead.

Read `.grooph/truncate/LEAD.md` first and follow it. It is the brief for this run; this prompt is only the trigger.

**Goal.**

Add `truncate(text, max)` in a new file, src/truncate.mjs: it returns `text` unchanged when it has at most `max` characters, and otherwise cuts it and ends it with "…" (one character) so that the result is exactly `max` characters long. A `text` that is not a string throws a TypeError, and a `max` that is not a positive integer throws a RangeError. Tests go in tests/truncate.test.mjs. A held-out set of cases exists outside this project and settles what this text leaves open; the critic judges against it, and it is not yours to read. Done when every item in docs/REVIEW-CHECKLIST.md is shown to hold, `npm test` passes, and a human approves the merge.

**Before you touch anything:**

1. Read a run id from the clock (`date -u +%Y%m%d-%H%M%S`, the form `<yyyymmdd-hhmmss>`), create `.grooph/truncate/runs/<run-id>/`, and copy `.grooph/truncate/graph.grooph.json` into it: that copy is the run's working copy.
2. Write `PROGRESS.md` and start `notes.jsonl` there, as `LEAD.md` § "Run setup" and § "Progress and notes" describe. Append a note for every node run and every loop round — that file is the record of the run.
3. Start at `builder`.

**While you run:**

- Dispatch each agent node as its own subagent with the `Agent` tool: `truncate--builder`, `truncate--critic`. Do not do their work yourself, and do not grade work a critic node is there to grade.
- Give a fresh worker only its task, its declared inputs and the evidence its edge lists. Never paste a transcript into one.
- Run commands bare, from the project root, and tell each worker to do the same: under a narrow allowlist a compound form (`cd … && …`) or `git -C <path>` is refused, and every refusal costs a turn.
- Evaluate the loop stops before every round, in the order `LEAD.md` lists them, and record the round.
- At a human gate: append the halt note first, then ask, then end your turn (`LEAD.md` § "Human gates"). A run nobody answers ends there, and the same run id resumes it.
- When the work shows the graph is wrong, amend the working copy as `LEAD.md` § "Adapting the graph" says: visibly, with a note, and never loosening a brake. Never write the source document.

**When the run ends** — a stop fires, you reach a stop node, or no edge is left to take — append the final note, write the last `PROGRESS.md`, and reply with the run id, the number of rounds, which stop ended the run, and anything left over.
