Run the grooph graph `parse-key-value` (Parse key-value) in this project. You are the lead.

Read `.grooph/parse-key-value/LEAD.md` first and follow it. It is the brief for this run; this prompt is only the trigger.

**Goal.**

Add `parseKeyValue(text)` to src/kv.mjs, the inverse of `renderKeyValue`: it turns `key=value` text into an object, skipping blank lines and lines whose first non-space character is `#`. Tests go in tests/kv.test.mjs and the README documents the function. Ship when this holds: `npm test` passes; `parseKeyValue` skips blank lines and `#` comment lines; a value may contain `=` (only the first `=` splits); `parseKeyValue(renderKeyValue(o))` gives back `o` for any object of plain string values without newlines; README.md documents `parseKeyValue` with one example. Aim toward: A new contributor can predict `parseKeyValue`'s result for any input from README.md alone, on the first try: every edge (whitespace around keys and values, a duplicate key, a quoted value, a line with no `=`, an empty key, a trailing comment on a value line, CRLF line endings) is decided, tested, and stated in the README in one sentence each.

**Before you touch anything:**

1. Read a run id from the clock (`date -u +%Y%m%d-%H%M%S`, the form `<yyyymmdd-hhmmss>`), create `.grooph/parse-key-value/runs/<run-id>/`, and copy `.grooph/parse-key-value/graph.grooph.json` into it: that copy is the run's working copy.
2. Write `PROGRESS.md` and start `notes.jsonl` there, as `LEAD.md` § "Run setup" and § "Progress and notes" describe. Append a note for every node run and every loop round — that file is the record of the run.
3. Start at `builder`.

**While you run:**

- Dispatch each agent node as its own subagent with the `Agent` tool: `parse-key-value--builder`, `parse-key-value--critic`. Do not do their work yourself, and do not grade work a critic node is there to grade.
- Give a fresh worker only its task, its declared inputs and the evidence its edge lists. Never paste a transcript into one.
- Run commands bare, from the project root, and tell each worker to do the same: under a narrow allowlist a compound form (`cd … && …`) or `git -C <path>` is refused, and every refusal costs a turn.
- Evaluate the loop stops before every round, in the order `LEAD.md` lists them, and record the round.
- At a human gate: append the halt note first, then ask, then end your turn (`LEAD.md` § "Human gates"). A run nobody answers ends there, and the same run id resumes it.
- When the work shows the graph is wrong, amend the working copy as `LEAD.md` § "Adapting the graph" says: visibly, with a note, and never loosening a brake. Never write the source document.

**When the run ends** — a stop fires, you reach a stop node, or no edge is left to take — append the final note, write the last `PROGRESS.md`, and reply with the run id, the number of rounds, which stop ended the run, and anything left over.
