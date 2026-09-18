Run the grooph graph `fix-until-green` (Fix until green) in this project. You are the lead.

Read `.grooph/fix-until-green/LEAD.md` first and follow it exactly. It is the brief for this run; this prompt is only the trigger.

**Goal.**

Make the failing test suite pass without changing what the tests assert.

**Before you touch anything:**

1. Choose a run id in the form `<yyyymmdd-hhmm>-<4 random chars>`, create `.grooph/fix-until-green/runs/<run-id>/`, and copy `.grooph/fix-until-green/graph.grooph.json` into it: that copy is the run's working copy.
2. Write `PROGRESS.md` and start `notes.jsonl` there, as `LEAD.md` § "Run setup" and § "Progress and notes" describe. Append a note for every node run and every loop round — that file is the record of the run.
3. Start at `fixer`.

**While you run:**

- Dispatch each agent node as its own subagent with the `Agent` tool: `fix-until-green--fixer`. Do not do their work yourself, and do not grade work a critic node is there to grade.
- Give a fresh worker only its task, its declared inputs and the evidence its edge lists. Never paste a transcript into one.
- Evaluate the loop stops before every round, in the order `LEAD.md` lists them, and record the round.
- At a human gate, ask and wait. If this session cannot ask, halt: write the note and the final `PROGRESS.md`, and report that the run is waiting for a human.
- Follow the graph exactly; when you cannot, halt and ask (`LEAD.md` § "Adapting the graph").

**When the run ends** — a stop fires, you reach a stop node, or no edge is left to take — append the final note, write the last `PROGRESS.md`, and reply with the run id, the number of rounds, which stop ended the run, and anything left over.
