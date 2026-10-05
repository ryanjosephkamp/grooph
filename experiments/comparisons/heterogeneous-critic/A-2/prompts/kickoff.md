Run the grooph graph `parse-page-ranges` (Parse page ranges) in this project. You are the lead.

Read `.grooph/parse-page-ranges/LEAD.md` first and follow it. It is the brief for this run; this prompt is only the trigger.

**Goal.**

Add `parseRanges(text, pageCount)` in a new file, src/parse-ranges.mjs: it reads what a person typed into the print dialog's page box, such as "1-3,5" or "7", and returns the page numbers to print as an array. Pages are numbered from 1 to `pageCount`; parts are separated by commas, and a part is one page or a range written first-last. A `text` that is not a string, or a `pageCount` that is not a positive integer, throws a TypeError; a text that cannot be read as pages of this document throws a RangeError. Tests go in tests/parse-ranges.test.mjs. Done when every item in docs/REVIEW-CHECKLIST.md and every case of the held-out suite /private/var/folders/pv/m1k13gmn189d64ndtxdbzrjc0000gn/T/wk/lj09vO/printkit-o5fCy3.harness/held-out/parse-ranges-cases.test.mjs (the suite is outside this project and settles what the task leaves open; the critic runs it from the project root with `node --test /private/var/folders/pv/m1k13gmn189d64ndtxdbzrjc0000gn/T/wk/lj09vO/printkit-o5fCy3.harness/held-out/parse-ranges-cases.test.mjs` and, for each case that fails, quotes the input and the expected result in REVIEW.md; it is the critic's alone, and the builder does not read or run it) is shown to hold, `npm test` passes, and a human approves the merge.

**Before you touch anything:**

1. Read a run id from the clock (`date -u +%Y%m%d-%H%M%S`, the form `<yyyymmdd-hhmmss>`), create `.grooph/parse-page-ranges/runs/<run-id>/`, and copy `.grooph/parse-page-ranges/graph.grooph.json` into it: that copy is the run's working copy.
2. Write `PROGRESS.md` and start `notes.jsonl` there, as `LEAD.md` § "Run setup" and § "Progress and notes" describe. Append a note for every node run and every loop round — that file is the record of the run.
3. Start at `builder`.

**While you run:**

- Dispatch each agent node as its own subagent with the `Agent` tool: `parse-page-ranges--builder`, `parse-page-ranges--critic`. Do not do their work yourself, and do not grade work a critic node is there to grade.
- Give a fresh worker only its task, its declared inputs and the evidence its edge lists. Never paste a transcript into one.
- Run commands bare, from the project root, and tell each worker to do the same: under a narrow allowlist a compound form (`cd … && …`) or `git -C <path>` is refused, and every refusal costs a turn.
- Evaluate the loop stops before every round, in the order `LEAD.md` lists them, and record the round.
- At a human gate: append the halt note first, then ask, then end your turn (`LEAD.md` § "Human gates"). A run nobody answers ends there, and the same run id resumes it.
- When the work shows the graph is wrong, amend the working copy as `LEAD.md` § "Adapting the graph" says: visibly, with a note, and never loosening a brake. Never write the source document.

**When the run ends** — a stop fires, you reach a stop node, or no edge is left to take — append the final note, write the last `PROGRESS.md`, and reply with the run id, the number of rounds, which stop ended the run, and anything left over.
