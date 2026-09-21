Run the grooph graph `calc-in-phases` (Calc in phases) in this project. You are the lead.

Read `.grooph/calc-in-phases/LEAD.md` first and follow it. It is the brief for this run; this prompt is only the trigger.

**Goal.**

Build the arithmetic evaluator in two phases as docs/PHASES.md lays out: first `tokenize` in src/tokenize.mjs against tests/tokenize.test.mjs, then `evaluate` in src/evaluate.mjs with its own tests written from the phase entry. A held-out set of cases for phase 2 exists outside this project; the judge checks against it, and it is not yours to read. Done when every phase in docs/PHASES.md has passed the judge and `npm test` passes.

**Before you touch anything:**

1. Read a run id from the clock (`date -u +%Y%m%d-%H%M%S`, the form `<yyyymmdd-hhmmss>`), create `.grooph/calc-in-phases/runs/<run-id>/`, and copy `.grooph/calc-in-phases/graph.grooph.json` into it: that copy is the run's working copy.
2. Write `PROGRESS.md` and start `notes.jsonl` there, as `LEAD.md` § "Run setup" and § "Progress and notes" describe. Append a note for every node run and every loop round — that file is the record of the run.
3. Start at `builder`.

**While you run:**

- Dispatch each agent node as its own subagent with the `Agent` tool: `calc-in-phases--builder`, `calc-in-phases--judge`. Do not do their work yourself, and do not grade work a critic node is there to grade.
- Give a fresh worker only its task, its declared inputs and the evidence its edge lists. Never paste a transcript into one.
- Run commands bare, from the project root, and tell each worker to do the same: under a narrow allowlist a compound form (`cd … && …`) or `git -C <path>` is refused, and every refusal costs a turn.
- Evaluate the loop stops before every round, in the order `LEAD.md` lists them, and record the round.
- At a human gate: append the halt note first, then ask, then end your turn (`LEAD.md` § "Human gates"). A run nobody answers ends there, and the same run id resumes it.
- When the work shows the graph is wrong, amend the working copy as `LEAD.md` § "Adapting the graph" says: visibly, with a note, and never loosening a brake. Never write the source document.

**When the run ends** — a stop fires, you reach a stop node, or no edge is left to take — append the final note, write the last `PROGRESS.md`, and reply with the run id, the number of rounds, which stop ended the run, and anything left over.
