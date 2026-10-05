Run the grooph graph `layer-settings` (Layer settings) in this project. You are the lead.

Read `.grooph/layer-settings/LEAD.md` first and follow it. It is the brief for this run; this prompt is only the trigger.

**Goal.**

Add `layer(base, over)` in a new file, src/layer.mjs: it returns the settings you get by laying `over` on top of `base`. Where both hold a plain object under the same key, the two are layered key by key, at any depth; otherwise a value given in `over` replaces the one in `base`, and a key only one of them has is kept. Both arguments must be plain objects, or it throws a TypeError. Tests go in tests/layer.test.mjs, and CHANGELOG.md gets a line. Done when every item in docs/REVIEW-CHECKLIST.md and every case of the held-out suite /private/var/folders/pv/m1k13gmn189d64ndtxdbzrjc0000gn/T/wk/gPU8QC/settingskit-tdbO5o.harness/held-out/layer-cases.test.mjs (the suite is outside this project and settles what the task and the checklist leave open; the critic runs it from the project root with `node --test /private/var/folders/pv/m1k13gmn189d64ndtxdbzrjc0000gn/T/wk/gPU8QC/settingskit-tdbO5o.harness/held-out/layer-cases.test.mjs` and, for each case that fails, quotes the case and what it expected in REVIEW.md; it is the critic's alone, and the builder does not read or run it) is shown to hold, `npm test` passes, and a human approves the merge.

**Before you touch anything:**

1. Read a run id from the clock (`date -u +%Y%m%d-%H%M%S`, the form `<yyyymmdd-hhmmss>`), create `.grooph/layer-settings/runs/<run-id>/`, and copy `.grooph/layer-settings/graph.grooph.json` into it: that copy is the run's working copy.
2. Write `PROGRESS.md` and start `notes.jsonl` there, as `LEAD.md` § "Run setup" and § "Progress and notes" describe. Append a note for every node run and every loop round — that file is the record of the run.
3. Start at `builder`.

**While you run:**

- Dispatch each agent node as its own subagent with the `Agent` tool: `layer-settings--builder`, `layer-settings--critic`. Do not do their work yourself, and do not grade work a critic node is there to grade.
- Give a fresh worker only its task, its declared inputs and the evidence its edge lists. Never paste a transcript into one.
- Run commands bare, from the project root, and tell each worker to do the same: under a narrow allowlist a compound form (`cd … && …`) or `git -C <path>` is refused, and every refusal costs a turn.
- Evaluate the loop stops before every round, in the order `LEAD.md` lists them, and record the round.
- At a human gate: append the halt note first, then ask, then end your turn (`LEAD.md` § "Human gates"). A run nobody answers ends there, and the same run id resumes it.
- When the work shows the graph is wrong, amend the working copy as `LEAD.md` § "Adapting the graph" says: visibly, with a note, and never loosening a brake. Never write the source document.

**When the run ends** — a stop fires, you reach a stop node, or no edge is left to take — append the final note, write the last `PROGRESS.md`, and reply with the run id, the number of rounds, which stop ended the run, and anything left over.
