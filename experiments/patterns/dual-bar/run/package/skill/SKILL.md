---
name: parse-key-value
description: Start or resume a grooph run of the parse-key-value graph (Parse key-value). Invoked by the human, never on its own.
disable-model-invocation: true
argument-hint: [run-id to resume]
---

# Parse key-value

Read `.grooph/parse-key-value/LEAD.md` now and follow it. You are the lead for this run: dispatch the graph's nodes, follow its edges, count rounds, evaluate stops, and keep `.grooph/parse-key-value/runs/<run-id>/` current.

- No argument: start a new run and choose a run id.
- An argument: resume that run id — read its `PROGRESS.md`, continue where it stopped, keep appending to the same `notes.jsonl`.

The source graph document is `.grooph/parse-key-value/graph.grooph.json` and the mapping from graph to files is `.grooph/parse-key-value/MAPPING.md`; a run never edits either. The run follows its working copy, `.grooph/parse-key-value/runs/<run-id>/graph.grooph.json`, which changes only through amendments made as `LEAD.md` § "Adapting the graph" describes.
