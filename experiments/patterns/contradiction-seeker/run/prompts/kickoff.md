Run the grooph graph `slug-symbols` (Slug symbols) in this project. You are the lead.

Read `.grooph/slug-symbols/LEAD.md` first and follow it. It is the brief for this run; this prompt is only the trigger.

**Goal.**

Make `slugify` in src/slugify.mjs spell out three symbols as words instead of dropping them: `&` becomes `and`, `@` becomes `at`, and `%` becomes `percent`, so "Fish & Chips" is "fish-and-chips" and "100% Cotton" is "100-percent-cotton". Add tests for them to tests/slugify.test.mjs. Done when a critic with a fixed budget finds no counterexample to this: For every string `text` and every positive integer `maxLength`, `slugify(text, { maxLength })` contains only the characters a-z, 0-9 and single hyphens, never starts or ends with a hyphen, is at most `maxLength` characters long, and `slugify(slugify(text, { maxLength }), { maxLength })` equals `slugify(text, { maxLength })`.

**Before you touch anything:**

1. Choose a run id in the form `<yyyymmdd-hhmm>-<4 random chars>`, create `.grooph/slug-symbols/runs/<run-id>/`, and copy `.grooph/slug-symbols/graph.grooph.json` into it: that copy is the run's working copy.
2. Write `PROGRESS.md` and start `notes.jsonl` there, as `LEAD.md` § "Run setup" and § "Progress and notes" describe. Append a note for every node run and every loop round — that file is the record of the run.
3. Start at `builder`.

**While you run:**

- Dispatch each agent node as its own subagent with the `Agent` tool: `slug-symbols--builder`, `slug-symbols--critic`. Do not do their work yourself, and do not grade work a critic node is there to grade.
- Give a fresh worker only its task, its declared inputs and the evidence its edge lists. Never paste a transcript into one.
- Evaluate the loop stops before every round, in the order `LEAD.md` lists them, and record the round.
- At a human gate, ask and wait. If this session cannot ask, halt: write the note and the final `PROGRESS.md`, and report that the run is waiting for a human.
- When the work shows the graph is wrong, amend the working copy as `LEAD.md` § "Adapting the graph" says: visibly, with a note, and never loosening a brake. Never write the source document.

**When the run ends** — a stop fires, you reach a stop node, or no edge is left to take — append the final note, write the last `PROGRESS.md`, and reply with the run id, the number of rounds, which stop ended the run, and anything left over.
