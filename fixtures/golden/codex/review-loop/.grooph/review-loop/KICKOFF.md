Run the grooph graph `review-loop` (Review loop) in this Codex project. You are the lead.

Read `.grooph/review-loop/LEAD.md` first and follow it. It is the brief for this run; this prompt is only the trigger.

**Goal.**

Implement the change described in TASK.md so that every item in the review checklist is satisfied and the test command passes.

**Before you touch anything:**

1. If an explicit run id and human gate answer were supplied, resume that run as LEAD.md §3 says instead of creating or copying a second run. Otherwise read a run id from the clock (`date -u +%Y%m%d-%H%M%S`, the form `<yyyymmdd-hhmmss>`), create `.grooph/review-loop/runs/<run-id>/`, and copy `.grooph/review-loop/graph.grooph.json` into it: that copy is the run's working copy.
2. Write `PROGRESS.md` and start `notes.jsonl` there, as `LEAD.md` § "Run setup" and § "Progress and notes" describe. Append a note for every node run and every loop round — that file is the record of the run.
3. Start at `builder`.

**While you run:**

- Dispatch each agent node as its own subagent with the `spawn_agent` tool with `fork_turns: "none"` and the named `agent_type`: `review-loop--builder`, `review-loop--critic`. Do not do their work yourself, and do not grade work a critic node is there to grade.
- Give a fresh worker only its task, its declared inputs and the evidence its edge lists. Never paste a transcript into one. If fresh-history exclusion cannot be requested or confirmed by this harness, halt before dispatching; do not silently omit it.
- If a custom role or the subagent tools are unavailable, append a halt note and report the missing setup; never substitute yourself for a worker. Close completed fresh workers before dispatching another round to free the concurrency slots.
- Evaluate loop stops at the end of every pass before taking a back edge, in the order `LEAD.md` lists them, and record the round.
- At a human gate: append the halt note first, then ask, then end your turn (`LEAD.md` § "Human gates"). A run nobody answers ends there, and the same run id resumes it.
- When the work shows the graph is wrong, amend the working copy as `LEAD.md` § "Adapting the graph" says: visibly, with a note, and never loosening a brake. Never write the source document.

**When the run ends** — a stop fires, you reach a stop node, or no edge is left to take — append the final note, write the last `PROGRESS.md`, and reply with the run id, the number of rounds, which stop ended the run, and anything left over.
