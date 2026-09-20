Run the grooph graph `polish-revenue-chart` (Polish revenue chart) in this project. You are the lead.

Read `.grooph/polish-revenue-chart/LEAD.md` first and follow it. It is the brief for this run; this prompt is only the trigger.

**Goal.**

Polish the monthly revenue chart rendered by `npm run render` from src/chart.mjs until it reads like the report's reference chart: STYLE.md says what the chart should be, data/monthly.json is the data, and `npm run capture` produces what the critic judges. The reference itself is held by the critic outside this project and is not yours to read. Done when a frontier critic comparing captures against the report's reference chart at /private/var/folders/pv/m1k13gmn189d64ndtxdbzrjc0000gn/T/grooph-prove-taste-polish-iPZ28b.harness/held-out/reference.svg with what matters about it in /private/var/folders/pv/m1k13gmn189d64ndtxdbzrjc0000gn/T/grooph-prove-taste-polish-iPZ28b.harness/held-out/REFERENCE.md (the critic's yardstick; the owner works from STYLE.md and does not read it) finds no major gap, or when the human stops the polish.

**Before you touch anything:**

1. Read a run id from the clock (`date -u +%Y%m%d-%H%M%S`, the form `<yyyymmdd-hhmmss>`), create `.grooph/polish-revenue-chart/runs/<run-id>/`, and copy `.grooph/polish-revenue-chart/graph.grooph.json` into it: that copy is the run's working copy.
2. Write `PROGRESS.md` and start `notes.jsonl` there, as `LEAD.md` § "Run setup" and § "Progress and notes" describe. Append a note for every node run and every loop round — that file is the record of the run.
3. Start at `owner`.

**While you run:**

- Dispatch each agent node as its own subagent with the `Agent` tool: `polish-revenue-chart--owner`, `polish-revenue-chart--critic`. Do not do their work yourself, and do not grade work a critic node is there to grade.
- Give a fresh worker only its task, its declared inputs and the evidence its edge lists. Never paste a transcript into one.
- Run commands bare, from the project root, and tell each worker to do the same: under a narrow allowlist a compound form (`cd … && …`) or `git -C <path>` is refused, and every refusal costs a turn.
- Evaluate the loop stops before every round, in the order `LEAD.md` lists them, and record the round.
- At a human gate: append the halt note first, then ask, then end your turn (`LEAD.md` § "Human gates"). A run nobody answers ends there, and the same run id resumes it.
- When the work shows the graph is wrong, amend the working copy as `LEAD.md` § "Adapting the graph" says: visibly, with a note, and never loosening a brake. Never write the source document.

**When the run ends** — a stop fires, you reach a stop node, or no edge is left to take — append the final note, write the last `PROGRESS.md`, and reply with the run id, the number of rounds, which stop ended the run, and anything left over.
