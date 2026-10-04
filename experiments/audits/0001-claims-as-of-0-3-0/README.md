# Audit 0001 · every claim grooph publishes as of 0.3.0

The first audit under decision 0024. Its subject is everything grooph says about itself in public as of version 0.3.0: the README, the front page, the pages the site renders, the technical report and the blog draft. Nothing in them had been read by a second harness before.

- **Commit under audit:** `dbc7a281f977dddf7acc7948a0221e2aba93c5e4` (`main` on 2026-10-04). It is eleven commits after the tag `v0.3.0`; those commits changed spelling in the audited files and no claim. It was chosen over the tag because it is what the site serves, and corrections are made against it.
- **Snapshot:** `/Users/noir/Documents/grooph-exchange/snapshots/0001-claims-as-of-0-3-0/`, a detached worktree at that commit, installed and built.
- **Audit lane:** a Claude Code session on Opus 5.5 (slice 0075). **Auditor:** Codex with GPT-6.1 Sol, opened by the owner on `/Users/noir/Documents/grooph-exchange/codex/0001-claims-as-of-0-3-0/`.
- **State:** round 1 is out to Codex. Not ended.

## What is here

| File | What it is |
|---|---|
| [`inventory.md`](inventory.md) | Every claim, with an id, its exact words, where it stands, its evidence, and the lane's own reading before Codex saw anything |
| [`tools/`](tools/) | Three small scripts written for this audit. They read the records and call no model. Each says at its top how to run it |
| [`round-01/HANDOFF.md`](round-01/HANDOFF.md) | What the lane asked Codex to read and attack |
| `round-01/HANDBACK.md` | What Codex found (when it comes back) |
| `round-01/RECONCILE.md` | Where the two stood, what was corrected, what stayed disputed (after the handback) |

The public register of claims is [`docs/claims.md`](../../../docs/claims.md).

## The lane's reading, in short

Counted before Codex saw anything, and open to its attack. The inventory has the reasons.

- **The largest finding.** "grooph is shown to bound … autonomous work" is published on the README, the front page, the blog draft, the field guide and the report, and is not carried as worded. In 33 recorded package runs the only stops that fired were a passed bar (18 times) and a human check-in (once); no round cap or budget has fired on record. The comparison's one runaway prompt run was cut off by the runner's dollar ceiling while inside the same caps the graph has. What is observed is that runs stopped where the graph said, at a passed bar or a human gate.
- **Not carried as worded:** the README's "proven" (two of twenty records fail their own check); the report's "pre-registered before the run with the reason a first pass should fail" for all twenty (it holds for four); the blog's "Every line was read before I left it on"; the count of 9 handoffs in 19 presented as what happened (it is a count on a plan).
- **Carried with other words:** the contract claim (18 of 20, stops "in order" by the lead's own note); the record claim (dispatch counts in 10 of 20); "every loop can end", "a critic that shares the builder's context" and "an irreversible step" (each depends on something the author writes); "back edges fired in six templates" (two were corrections on held-out evidence); "ids, names and times" (the local file also holds two paths).
- **Carried:** the negative result of the comparison and every number in its table; that evidence is never edited; that grooph calls no model and sends no graph anywhere; the rule count; the sizes in the performance budget.

## How it ended

Not yet.
