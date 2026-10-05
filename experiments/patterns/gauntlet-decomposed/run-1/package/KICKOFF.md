Run the grooph graph `summary-card` (Summary card) in this project. You are the lead.

Read `.grooph/summary-card/LEAD.md` first and follow it. It is the brief for this run; this prompt is only the trigger.

**Goal.**

Make the summary card rendered by `npm run render` from src/card.mjs match the reference card the deck already uses, piece by piece: BRIEF.md says what the card should be, data/summary.json is the data, src/header.mjs and src/trend.mjs are the two parts src/card.mjs frames, and `npm run capture` produces what the critics judge. The reference itself is held outside this project for the planner and the critics; the owner and the integrator work from PIECES.md and do not read it. Done when every piece in PIECES.md is ticked by its critic against the deck's reference card at /private/var/folders/pv/m1k13gmn189d64ndtxdbzrjc0000gn/T/grooph-prove-gauntlet-decomposed-IdUcqa.harness/held-out/reference.svg, described element by element in /private/var/folders/pv/m1k13gmn189d64ndtxdbzrjc0000gn/T/grooph-prove-gauntlet-decomposed-IdUcqa.harness/held-out/REFERENCE-CAPTURE.md, with what matters about it in /private/var/folders/pv/m1k13gmn189d64ndtxdbzrjc0000gn/T/grooph-prove-gauntlet-decomposed-IdUcqa.harness/held-out/REFERENCE.md (the planner cuts from it and the critics judge against it; the owner and the integrator do not read it), the whole has been compared once more, and the human releases it.

**Before you touch anything:**

1. Read a run id from the clock (`date -u +%Y%m%d-%H%M%S`, the form `<yyyymmdd-hhmmss>`), create `.grooph/summary-card/runs/<run-id>/`, and copy `.grooph/summary-card/graph.grooph.json` into it: that copy is the run's working copy.
2. Write `PROGRESS.md` and start `notes.jsonl` there, as `LEAD.md` § "Run setup" and § "Progress and notes" describe. Append a note for every node run and every loop round — that file is the record of the run.
3. Start at `planner`.

**While you run:**

- Dispatch each agent node as its own subagent with the `Agent` tool: `summary-card--planner`, `summary-card--owner`, `summary-card--critic`, `summary-card--integrator`, `summary-card--final-critic`. Do not do their work yourself, and do not grade work a critic node is there to grade.
- Give a fresh worker only its task, its declared inputs and the evidence its edge lists. Never paste a transcript into one.
- Run commands bare, from the project root, and tell each worker to do the same: under a narrow allowlist a compound form (`cd … && …`) or `git -C <path>` is refused, and every refusal costs a turn.
- Evaluate the loop stops before every round, in the order `LEAD.md` lists them, and record the round.
- At a human gate: append the halt note first, then ask, then end your turn (`LEAD.md` § "Human gates"). A run nobody answers ends there, and the same run id resumes it.
- When the work shows the graph is wrong, amend the working copy as `LEAD.md` § "Adapting the graph" says: visibly, with a note, and never loosening a brake. Never write the source document.

**When the run ends** — a stop fires, you reach a stop node, or no edge is left to take — append the final note, write the last `PROGRESS.md`, and reply with the run id, the number of rounds, which stop ended the run, and anything left over.
