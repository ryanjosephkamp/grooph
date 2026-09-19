# Runs: notes back, adoption, and the monitor

Normative for slice 0008. A run leaves a folder behind; this page says how grooph reads it, shows it, and lets the human adopt what the run learned. grooph still executes nothing and calls no model: everything here is reading files a harness wrote.

## 1. The run folder (what packages already write)

```
.grooph/<graph-id>/runs/<run-id>/
  PROGRESS.md            human-readable
  notes.jsonl            one RunNote per line (graph-ir §6), append-only
  graph.grooph.json      the run's working copy (graph-ir §2)
  …                      whatever the lead materialised: round-<n>/, evidence files, amend-*.ops.json
```

One addition to the package contract, so a monitor can show what is running and not only what finished: **the lead appends a note with `"outcome":"started"` when it dispatches a node** (`at: node:<id>`, `round` when inside a loop), and the usual note when the node completes. One short line per dispatch; no other cost. Lead-brief §8 says so; older runs simply have no started notes.

## 2. Core (pure)

| Function | Does |
|---|---|
| `parseRunNotes(text)` | Line-tolerant: returns `{ notes, issues }`; a malformed line is an issue with its line number, never a throw. |
| `summarizeRun(notes, graph)` | `RunSummary`: run id, state (`running` · `halted` · `ended`), outcome, started/ended, per node `{ state: pending · running · passed · failed · halted, runs, lastOutcome, lastVerdict, round }`, per loop `{ round, lastStop }`, amendments, proposals, cost totals per measure, and the ordered timeline. A node is `running` when its last note is `started`. |
| `diffGraphs(source, working)` | The change list between two documents as a grooph op list where ops can express it, plus a plain-language line per change; layout and notes ignored. |
| `adoptWorkingCopy(source, working, { run })` | The working copy as the next version: `version + 1`, source `id` and `name` kept, `lineage.from = "<id>@<old version>"`, run notes not copied. Refuses when the working copy has export errors. |
| `buildRunBundle({ source, working, notesText, progress? })` / `parseRunBundle` | A self-contained `*.grooph-run.json` (`{ groophRun: 0, … }`) for import and for share links (`kind: "run"` joins `docs/executive.md` §2; same untrusted-input rules). |

Run data lives **beside** the graph, not inside it: the document stays small (spec §4.7). "Pin to graph" copies a chosen note into `doc.notes`, which is what spec §5.7 means by notes attaching to nodes, edges and the graph.

## 3. CLI

```
grooph runs list [<dir>]                         runs under .grooph/*/runs/, newest first: id, graph, state, rounds, stop
grooph runs show <run dir> [--json]              the summary, amendments, proposals, timeline
grooph runs bundle <run dir> --out <file>        self-contained bundle
grooph share <run dir>                           a link that opens the run view (warns when long; bundle file is the fallback)
grooph adopt <run dir> [--into <graph file>] [--write]   show the diff; with --write, write the next version (default target .grooph/graphs/<id>.grooph.json)
grooph watch [<run dir> | <graph dir>] [--port 4174] [--host 127.0.0.1] [--open]
```

`watch` serves the built web app and one read-only JSON endpoint with the current bundle, re-read from disk on each request; with a graph dir it follows the newest run. It binds to `127.0.0.1` unless `--host` is given; with another host it prints that anyone on that network can read the run, and the URL to open from a phone. It writes nothing and needs no credentials. It is a local viewer, not a backend (decision 0001 anticipated it).

## 4. The run view (web)

`#/run` opens a bundle from a link, an imported file, or the `watch` endpoint (polled every two seconds while the run is not ended).

- **Canvas with state.** Pending nodes quiet, running nodes pulse (a static ring under `prefers-reduced-motion`), passed and failed take the semantic colours already in the tokens, halted amber. Loops show their round. State is shown by icon and label as well as colour.
- **Timeline.** Notes in order, newest first while live; tapping one highlights its object. Amendments and proposals are marked.
- **What the run changed.** The `diffGraphs` list between source and working copy, each line tied to the amendment note that explains it. **Adopt as version N+1** saves the adopted graph to the library (the source stays); **Discard** does nothing to the source and says so.
- **Proposals** are listed with their patch; "Apply to a copy" applies an op-list patch to a new version for the human to inspect. Nothing is applied automatically (spec §11).
- **Pin to graph** on any note.
- Runs imported into the app are stored beside graphs on the device and listed under the graph they belong to.

## 5. Details fixed by slice 0008

- The live endpoint is `/grooph/api/run.json` on the `watch` server, and the app's live route is `#/run?live` with that fixed same-origin path; no URL parameter names an endpoint, so a crafted link cannot make the app fetch elsewhere. A stored run opens at `#/run/<key>`.
- `adopt --write` is refused when the source's version differs from the version the run started from (the source moved on), or when the target already holds something else; adopting the same run twice is a no-op. `lineage.from` of an adopted version names the previous version of the same graph.
- The stop that fired is read from a loop note's `stop` field when present (graph-ir §6) and inferred from its text for older runs.
- The timeline is in append order; timestamps are shown, not trusted for ordering.

## 6. Out of scope here

Hook-written start/stop events and token accounting from the harness; a hosted monitor; notifications; editing a run. The monitor must never add instructions to a package beyond the one started note.
