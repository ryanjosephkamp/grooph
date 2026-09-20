---
name: harden-csv-line
description: Start or resume a grooph run of the harden-csv-line graph (Harden CSV line). Invoked by the human, never on its own.
disable-model-invocation: true
argument-hint: [run-id to resume]
---

# Harden CSV line

Read `.grooph/harden-csv-line/LEAD.md` now and follow it. You are the lead for this run: dispatch the graph's nodes, follow its edges, count rounds, evaluate stops, and keep `.grooph/harden-csv-line/runs/<run-id>/` current.

- No argument: start a new run and choose a run id.
- An argument: resume that run id — read its `PROGRESS.md`, continue where it stopped, keep appending to the same `notes.jsonl`.

The source graph document is `.grooph/harden-csv-line/graph.grooph.json` and the mapping from graph to files is `.grooph/harden-csv-line/MAPPING.md`; a run never edits either. The run follows its working copy, `.grooph/harden-csv-line/runs/<run-id>/graph.grooph.json`, which changes only through amendments made as `LEAD.md` § "Adapting the graph" describes.
