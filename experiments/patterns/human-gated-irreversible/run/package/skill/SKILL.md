---
name: release-notes-store
description: Start or resume a grooph run of the release-notes-store graph (Release notes-store). Invoked by the human, never on its own.
disable-model-invocation: true
argument-hint: [run-id to resume]
---

# Release notes-store

Read `.grooph/release-notes-store/LEAD.md` now and follow it. You are the lead for this run: dispatch the graph's nodes, follow its edges, count rounds, evaluate stops, and keep `.grooph/release-notes-store/runs/<run-id>/` current.

- No argument: start a new run and choose a run id.
- An argument: resume that run id — read its `PROGRESS.md`, continue where it stopped, keep appending to the same `notes.jsonl`.

The source graph document is `.grooph/release-notes-store/graph.grooph.json` and the mapping from graph to files is `.grooph/release-notes-store/MAPPING.md`; a run never edits either. The run follows its working copy, `.grooph/release-notes-store/runs/<run-id>/graph.grooph.json`, which changes only through amendments made as `LEAD.md` § "Adapting the graph" describes.
