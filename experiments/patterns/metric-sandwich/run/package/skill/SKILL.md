---
name: pages-from-one
description: Start or resume a grooph run of the pages-from-one graph (Pages from one). Invoked by the human, never on its own.
disable-model-invocation: true
argument-hint: [run-id to resume]
---

# Pages from one

Read `.grooph/pages-from-one/LEAD.md` now and follow it. You are the lead for this run: dispatch the graph's nodes, follow its edges, count rounds, evaluate stops, and keep `.grooph/pages-from-one/runs/<run-id>/` current.

- No argument: start a new run and choose a run id.
- An argument: resume that run id — read its `PROGRESS.md`, continue where it stopped, keep appending to the same `notes.jsonl`.

The source graph document is `.grooph/pages-from-one/graph.grooph.json` and the mapping from graph to files is `.grooph/pages-from-one/MAPPING.md`; a run never edits either. The run follows its working copy, `.grooph/pages-from-one/runs/<run-id>/graph.grooph.json`, which changes only through amendments made as `LEAD.md` § "Adapting the graph" describes.
