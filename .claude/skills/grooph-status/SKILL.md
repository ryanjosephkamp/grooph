---
name: grooph-status
description: Driver-side. Build the owner's status report for grooph as a published page from repository files only, with every figure sourced and every unknown said. Use when the owner asks for a status report, progress report, "where are we", what has been done, what the results or findings are, or whether there is evidence for grooph's effectiveness, speed or cost.
---

# grooph-status

The owner reads on a phone and cannot see tool calls. The report is how they audit the work, so it is built from files, not memory, and it says plainly what has not been done.

## Steps

1. **Gather from the repository only.** Read `docs/PROGRESS.md`, `docs/PLAN.md`, the latest `handoffs/NNNN-*/REVIEW.md` and `HANDBACK.md`, `experiments/patterns/README.md`, and run:
   ```bash
   scripts/prove-pattern.sh --status
   node scripts/lib/prove-summary.mjs
   git log --oneline | wc -l
   ```
   Re-run `pnpm -r test` when the test counts are to be stated. A figure that has no file or command behind it is not stated.
2. **Write the page** to `handoffs/briefs/status-<yyyy-mm-dd>.html` (never a scratchpad: `AGENTS.md` § Conventions). Sections, at minimum, in this order:
   - **Who ran what**: which sessions made the runs and which made the report; what the reporting session verified itself; what nobody has done.
   - **At a glance**: the handful of figures that matter, each with its source path.
   - **What grooph can do today**, with the live URLs.
   - **What has been done**, dated, from the Done table and the slice ledger.
   - **What a proving run records and where**: the audit map (ledger, `result.json`, `notes.jsonl`, `PROGRESS.md`, the working copy, digest, diff, package, write-up) and the commands that re-derive the tables.
   - **Results**: the per-template table from `prove-summary.mjs`, a chart only when the data warrants one (load the `dataviz` skill first), the batch comparison.
   - **Findings**, each pointing at the write-up or handback it comes from.
   - **Effectiveness, speed, cost**: three separate answers. Effectiveness against alternatives is "unknown" until a paired run exists; speed is measured but uncompared; cost is the ledger. Say what each figure is and is not.
   - **The immediate next step and why**, then **on the horizon**, then **known risks**.
3. **Honesty rules.** Distinguish records kept in the repository from figures only summarised in a handback. A record that fails its check is shown red, not omitted. A design bet that did not pay is a result. Rounded figures say "about". Nothing is described as done that is only drafted.
4. **Add what this report needs** beyond the minimum: anything the owner asked for by name; a decision that is waiting on them, with the recommended answer; a change since the last report; a figure whose trend now matters (spend against cap, back-edge rate, denial counts).
5. **Publish** with the Artifact tool from that file, then record the URL in the table in `handoffs/briefs/README.md`, and commit both: `docs: status report <date>`.
6. **Reply** with the link and three lines: the state, the next step, what waits on the owner.

Done when the page is on `main`, its URL is in the briefs table, and the owner has the link.
