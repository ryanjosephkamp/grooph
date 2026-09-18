---
name: fix-until-green
description: Start or resume a grooph run of the fix-until-green graph (Fix until green). Invoked by the human, never on its own.
disable-model-invocation: true
argument-hint: [run-id to resume]
---

# Fix until green

Read `.grooph/fix-until-green/LEAD.md` now and follow it. You are the lead for this run: dispatch the graph's nodes, follow its edges, count rounds, evaluate stops, and keep `.grooph/fix-until-green/runs/<run-id>/` current.

- No argument: start a new run and choose a run id.
- An argument: resume that run id — read its `PROGRESS.md`, continue where it stopped, keep appending to the same `notes.jsonl`.

The source graph document is `.grooph/fix-until-green/graph.grooph.json` and the mapping from graph to files is `.grooph/fix-until-green/MAPPING.md`; a run never edits either. The run follows its working copy, `.grooph/fix-until-green/runs/<run-id>/graph.grooph.json`, which stays as it was copied.
