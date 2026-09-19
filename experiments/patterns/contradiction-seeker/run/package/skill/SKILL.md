---
name: slug-symbols
description: Start or resume a grooph run of the slug-symbols graph (Slug symbols). Invoked by the human, never on its own.
disable-model-invocation: true
argument-hint: [run-id to resume]
---

# Slug symbols

Read `.grooph/slug-symbols/LEAD.md` now and follow it. You are the lead for this run: dispatch the graph's nodes, follow its edges, count rounds, evaluate stops, and keep `.grooph/slug-symbols/runs/<run-id>/` current.

- No argument: start a new run and choose a run id.
- An argument: resume that run id — read its `PROGRESS.md`, continue where it stopped, keep appending to the same `notes.jsonl`.

The source graph document is `.grooph/slug-symbols/graph.grooph.json` and the mapping from graph to files is `.grooph/slug-symbols/MAPPING.md`; a run never edits either. The run follows its working copy, `.grooph/slug-symbols/runs/<run-id>/graph.grooph.json`, which changes only through amendments made as `LEAD.md` § "Adapting the graph" describes.
