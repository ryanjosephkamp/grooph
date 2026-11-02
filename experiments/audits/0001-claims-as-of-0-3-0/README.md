# Audit 0001: every claim grooph published as of 0.3.0

Its subject is everything grooph said about itself in public as of version 0.3.0: the README, the front page, the pages the site renders, the technical report, and the blog draft. Nothing in them had been read by a second tool before.

- **Commit under audit:** `dbc7a281` (`main` on 2026-10-04), eleven commits after the tag `v0.3.0`. Those commits changed spelling in the audited files and no claim. It was chosen over the tag because it is what the site served.
- **Auditor:** Codex with GPT-6.1 Sol, reading a snapshot of the repository. The authors prepared each round and reconciled each report.
- **What was read:** 52 claims, each with an id, its exact words, where it stood, and the evidence ([`inventory.md`](inventory.md)).

## The rounds

| Round | Date | Findings | Outcome |
|---|---|---|---|
| 1 | reconciled 2026-10-05 | 21, none disputed | The authors accepted all seven of the decisions it raised, and the corrections went into the pages. |
| 2 | reconciled 2026-10-06 | 16, all agreed | Two were faults that reproduce and are wider than first found: one in the product (in 0.4.0), one in an experiment's counter. Both were repaired. |
| 3 | reconciled 2026-10-06 | 19, all agreed | No new way around the comparison of brakes that `grooph adopt` and `grooph export` hold a graph to, in a search the auditor calls bounded. Fourteen of the 19 concern the beginner's guide; all are about what is said, and all were corrected. |

Each round's folder holds the auditor's report ([`HANDBACK.md`](round-01/HANDBACK.md) in each) and the authors' reconciliation of it (`RECONCILE.md`): where the two stood, what was corrected, what stayed disputed.

## What stayed open

- The gaps the pages already list, the compiled brief's "before every round", and the unbounded reasons of the slow shape were retained, not repaired.
- Whether a new way around a limit should be held was left to the author.
- The readings on the claims page did not change: claim C45 stays described, not shown.

[`docs/claims.md`](../../../docs/claims.md) is the ledger of the claims and their readings after the audit.

## What is not here

The auditor's prompts, its probe scripts, and their printed output (about 340 files, with local paths) are not in the public repository. The reports and reconciliations quote what each probe showed. Where a document here names such a file, the file is not kept.
