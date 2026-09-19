# Handback 0008 · Runs: notes back, adoption, and the monitor

**Implementer:** Opus 5 (Claude Code) · **Branch:** `slice/0008-runs` · **Head commit:** `0ab0560` before this handback · **Date:** 2026-09-19

## Status

`done`. All eight criteria are met. A fresh clone is green and so is CI at `2f5bea5`, the last code commit; the commits after it change only docs.

## What changed

**Core** (`packages/core`)
- `src/runs.ts` (new): `parseRunNotes`, `summarizeRun`, `runStateLine`, `diffGraphs`, `explainChanges`, `isOpList`, `describePatch`, `adoptWorkingCopy`, `buildRunBundle`, `parseRunBundle`, `parseRunBundleText`, `isRunBundleLike`, `canonicalizeRunBundle`.
- `src/schema/run.ts` (new) and `schema/grooph-run-0.schema.json` (new, generated). Graphs and notes are named by `$ref` to the graph schema. `src/schema/graph.ts` now exports `runNoteSchema`, and `path.ts` and `write.ts` write the new schema.
- `src/types.ts`: `RunBundle`, `RunNoteIssue`.
- `src/share.ts`: the envelope gains `kind: "run"`. It is built and parsed as untrusted input. A working copy with errors is still shareable, because adoption is where the refusal happens.
- `src/compile/claude-code/lead.ts`: §8 asks for the started note, and the `outcome` line now mentions `started`.
- `test/runs.test.ts` (new, 24 tests). The README gains a Runs section, and `package.json` exports the new schema.

**Fixtures:** `fixtures/runs/` (new).
- The real record of run `20260919-0057-66c8`, with the source as the run started from it (version 1, from `9801ac8`).
- The driver's hand-adopted v2.
- Five synthetic runs: `run-malformed`, `run-live`, `run-gate`, `run-nested` and `run-broken`.
- A README.
- `fixtures/golden/claude-code/*/LEAD.md`, regenerated. Only the two §8 lines change.

**CLI** (`packages/cli`)
- `src/run-io.ts` (new): finds and reads run folders, and lists them newest first.
- `src/commands/runs.ts`, `adopt.ts` and `watch.ts` (new).
- `share.ts` and `share-io.ts` accept a run folder or a `*.grooph-run.json`. `index.ts` wires the new commands and their help, and adds `signal` and `env` to `CliEnv` for tests.
- `test/runs.test.ts` (new, 13 tests).

**Web** (`apps/web`)
- `src/ui/run/` (new): `RunView`, `RunTimeline`, `RunChanges`, `RunProposals`, `RunScreens` (`LiveRun`, `StoredRun`) and `StateIcon`.
- `src/doc/run.ts` (new): the run view's model, and "Apply to a copy". `src/store/runs.ts` (new): stores runs, saves adopted versions and copies, and pins notes.
- `src/store/db.ts`: IndexedDB version 3 adds a `runs` store beside `graphs` and `templates`.
- `ViewCanvas.tsx` and `GraphNode.tsx`: run states and highlights on the read-only canvas.
- `App.tsx` gains two routes, `#/run?live` and `#/run/<key>`. `OpenScreen.tsx` handles `kind: "run"`.
- `Library.tsx`: imports `.grooph-run.json` files and lists runs under their graph.
- `styles.css`: a new runs section.
- `e2e/runs.spec.ts` (new, 13 tests), `e2e/screenshots-runs.spec.ts` (new, only with `GROOPH_SHOTS=1`), additions to `e2e/support.ts`, and `test/run.test.ts` (new, 6 tests).
- `playwright.config.ts`: `GROOPH_E2E_PORT` (default 4173), so two worktrees can run e2e at the same time.

**Other files:** `handoffs/0008-runs/*.png` (12 screenshots) and `docs/PROGRESS.md` (the In flight lines only).

## Verified, and how

1. **Green from a fresh clone.** I cloned `slice/0008-runs` at `2f5bea5` into a scratch folder and ran `pnpm install --frozen-lockfile && pnpm -r build && pnpm -r test`. It exited 0: core 234, CLI 58, web unit 49. Then `GROOPH_E2E_PORT=4189 pnpm --filter @grooph/web test:e2e` gave 50 passed and 27 skipped (the screenshot specs). I re-ran both in the worktree at `0ab0560` with the same counts. CI run 35456182840 at `2f5bea5` is green: build (22), build (24) and web-e2e. The earlier red CI runs on this branch were intermediate commits. First, core added `kind: "run"` before the web handled it. Later, one core edit went uncommitted. The fresh clone caught that, and `2f5bea5` committed it.
2. **Core.** `packages/core/test/runs.test.ts` runs against `fixtures/runs/slice-0007-sandwich/` and the five synthetic runs, which cover a malformed line, a node still running, a halt at a gate, nested loops, and a working copy with `E_DANGLING_REF` whose adoption is refused. It also checks the published schema against the generated one and against ajv, and it round-trips `kind: "run"` links.
3. **`diffGraphs` on the real run** gives exactly three changes, with `exact: true`:
   ```
   Changed the graph's other limits (constraints.other) | setConstraint key=other
   Changed the outputs of Builder (builder)             | updateNode builder set=[outputs]
   Changed the outputs of Critic (critic)               | updateNode critic set=[outputs]
   ```
   `diff.ops` deep-equals the lead's own `amend-01.ops.json`. `applyOps(source, ops)` canonicalizes to the working copy, and `explainChanges` ties all three to n-0002 (asserted in `runs.test.ts`).
4. **Started notes.** Lead-brief §8 has a new bullet (below), and the `outcome` line reads `pass | fail | halt | invalid-evidence; started on a dispatch line`. `pnpm --filter @grooph/core run golden:write` changed only those two lines in each LEAD.md, and I read both as documents. The sentence for the driver-owned target doc is at the end of this handback.
5. **CLI.**
   - `pnpm exec grooph runs list` prints `20260919-0057-66c8   slice-0007-sandwich   ended · pass   1   bar passed`.
   - `runs show <real run>` prints states, the loop, amendments, the proposal and the timeline of 15 notes.
   - `adopt --write` on a scratch copy of `fixtures/runs/slice-0007-sandwich` writes v2. Compared with `fixtures/runs/slice-0007-sandwich.adopted-by-hand.grooph.json` it is identical once `description` and `lineage.from` are removed (checked with `diff`, and in both the CLI and e2e tests).
   - `watch .grooph/slice-0007-sandwich --port 0` served the app (200) and `/grooph/api/run.json` (run `20260919-0057-66c8`, 15 notes), then exited 0 on SIGINT.
   - The watch tests start the server on a free port against a copy of `run-live`. They append notes and see them on the next request, and they check that nothing was written. They also check the 421 on a foreign Host, 405 on POST, 404 on path traversal, following the newest run in a graph folder, and the LAN warning with `--host 0.0.0.0`.
6. **Run view** (`e2e/runs.spec.ts`, 400×800 with touch). The real run opens from a link and from an imported bundle. It shows node states (`passed×2`), the loop's `round 1 · bar passed`, and 15 timeline notes. Tapping a note highlights its node, edge (n-0008) or loop (n-0012), and tapping a node finds its last note. The Changes tab lists three changes, each tied to n-0002.
   - Adopt adds v2 to the library, and the v1 record stays byte-identical.
   - Discard leaves the library identical.
   - Apply to a copy on n-0008 saves v2 with the edge's four evidence items. The run-gate JSON Patch proposal is explained and has no button.
   - Pin adds n-0006 to `doc.notes`, only once. With no graph on the device, it saves the source with the note pinned.
   - The live test serves a stub endpoint whose run goes from critic `running` to `passed` and `Ended · pass`, then checks that polling stops.
7. **Motion and colour.** A test reads the computed `::after` of a running node. Normally it is `animation-name: run-pulse` with a 2px border. Under `reducedMotion: "reduce"` it is `animation-name: none`, opacity 1, with the same 2px ring. Badges carry an SVG shape and a label for every state (passed, failed, pending, halted, running), and all five are asserted. Screenshots are below.
8. **Nothing phones home.** One test records every request across the library, two link run views and a live view. Every request goes to the app's own origin. The only request beyond the app's files is `<origin>/grooph/api/run.json`, and only in the live view.

The handoff's commands, in their working form:

```bash
pnpm install --frozen-lockfile && pnpm -r build && pnpm -r test
pnpm --filter @grooph/web test:e2e          # GROOPH_E2E_PORT=<port> when another worktree may hold 4173
pnpm exec grooph runs list
pnpm exec grooph runs show .grooph/slice-0007-sandwich/runs/20260919-0057-66c8
pnpm exec grooph adopt .grooph/slice-0007-sandwich/runs/20260919-0057-66c8
pnpm exec grooph watch .grooph/slice-0007-sandwich --open
GROOPH_SHOTS=1 pnpm --filter @grooph/web exec playwright test e2e/screenshots-runs.spec.ts
```

Two notes on those commands:
- **`adopt` in this repo:** the package's source is already version 2, because the driver copied the amendment into it. `adopt` therefore reports a description change that no amendment explains, and says `--write` would be refused because the run worked on version 1. That is correct. The three-change adoption is shown on the fixture copy, where the source is still version 1.
- **`--open`:** I ran `watch` without it, so that nothing opened on the owner's desktop. The flag goes through the same `openUrl` that `share --open` uses.

**Screenshots** (`handoffs/0008-runs/`): the phone views at 400×800, in light and dark, are `run-timeline-phone-*`, `run-changes-phone-*`, `run-proposals-phone-*` and `run-live-phone-*` (critic running, with reduced motion so the ring holds still). The rest are `run-halted-phone-light`, `run-library-phone-light` and `run-changes-desktop`.

## Decisions made

- **Where adopt finds the source.** The CLI takes the package's `graph.grooph.json`, two levels above the run folder, because that is the document the lead copied at kickoff. It writes to `.grooph/graphs/<id>.grooph.json`. That default follows the target in `docs/runs.md` §3, and it is where `grooph pick` puts graphs.
  - `--write` is refused in two cases. The first is when the source's version is not the working copy's, which means the source moved on after the run started. The second is when the target holds anything other than the version the run started from.
  - Adopting the same run a second time is a no-op.
  - The app refuses to adopt when the versions differ, for the same reason.
- **The bundle carries parsed notes plus the unreadable lines**, not the raw `notes.jsonl` text, so that its JSON Schema can describe the notes. It also carries `PROGRESS.md`, which the run view shows as a Log tab. It carries no local paths.
- **Run state.**
  - A run is `ended` once a note at `graph` records a non-`started` outcome, and `halted` when that outcome is `halt`.
  - A `halt` at a node with nothing running also halts the run.
  - Node notes that come after a halt mean the run resumed.
  - A node that was started but never finished, in a run that has stopped, shows as `halted`.
- **Unreadable lines** are listed at the bottom of the timeline and in `runs show`. They never stop the view.
- **`explainChanges`** ties a change to an amendment by the amendment's op-list patch first, then by the object's id in its text. If there is exactly one amendment and it has no op list, it explains everything. An amendment with an op list explains only what its ops touch. That rule is what stops n-0002 from being credited with the driver's later description edit.
- **"Apply to a copy"** applies the ops to the working copy, which is what the lead proposed against. The result gets the source's id and name, version N+1 and `lineage.from`, and is saved as a new graph so the owner can inspect it. A patch that fails to apply shows `formatOpError`, and nothing is saved.
- **"Pin to graph"** targets the most recently edited graph on the device with the run's graph id. If there is none, it saves the run's source with the note pinned. A repeated pin is detected by content, and a note id already taken in that graph gets a suffix.
- **Storing runs.** IndexedDB version 3 adds a `runs` store, keyed `<graph-id>/<run-id>`. Saving the same run again replaces the stored copy. A stored run can be removed from its own view. Runs from a link or from `watch` are stored only when the owner taps Save. An imported file is stored at once, as graph imports are.
- **The `watch` shell.** It serves `apps/web/dist` from the clone the CLI runs from, or from `GROOPH_WEB_DIST` when that is set. There is no copy step and no build-order coupling, and a missing build gets a clear message. The app is served at `/grooph/`, because the production base path is baked into the build. The endpoint is `/grooph/api/run.json`, sent with `Cache-Control: no-store`, and `/` redirects to `#/run?live`.
  - Bound to loopback, it answers only to its own Host names (421 otherwise), which blocks DNS rebinding.
  - With no argument, it follows the newest run under `./.grooph/`.
- **The app's live route is `#/run?live`, with a fixed, same-origin endpoint path.** There is deliberately no URL parameter naming the endpoint, so a crafted link cannot make the app fetch from anywhere else (criterion 8). It polls every 2 s until the run ends, and keeps polling while it is halted or after errors.
- **Phone layout.** The canvas takes 42% of the height, with the loop legend showing each loop's round and the stop that fired. The panel underneath has the facts and origin, then tabs for Timeline, Changes, Proposals and Log. On wide screens the panel is a 440 px side column.
- **Colours.** Pending nodes get a dashed border rather than lowered opacity, so they are quiet without losing text contrast. Running nodes are accent-coloured with a pulsing ring. Passed, failed and halted use the ok, error and warning tokens.
- **`GROOPH_E2E_PORT`** in `playwright.config.ts`. With `reuseExistingServer`, a suite would otherwise run silently against whichever worktree's preview already held 4173.

## Deviations

- **`lineage.from` differs from the driver's hand adoption.** `docs/runs.md` §2 says `lineage.from = "<id>@<old version>"`, so I adopt as `slice-0007-sandwich@1`. The driver's v2 kept `metric-sandwich@1`. Criterion 5 reads "identical in meaning … description aside", so the tests compare with both `description` and `lineage.from` set aside, and assert each difference explicitly.
- **The handoff says three real run folders exist; I found one.** Only `.grooph/slice-0007-sandwich/runs/20260919-0057-66c8/` is in the repo or on this machine (searched `/Users/noir/Documents` and the scratch folders). The earlier acceptance runs left no run folder. The synthetic fixtures cover the other shapes.
- Otherwise, none. Every path I touched is inside the allowed changes. `patterns/`, `scripts/`, `experiments/`, `.grooph/` and `docs/` outside PROGRESS In flight are untouched.

## Risks and leftovers

- **`docs/targets/claude-code.md`** needs the sentence below (driver-owned).
- **`docs/runs.md` could record** the endpoint path, the `#/run?live` and `#/run/<key>` routes, and adopt's refusal rules.
- **The stop that fired is inferred from the loop note's text**, because `RunNote` has no structured stop field. The inference only runs when the outcome ends the loop, and the note's text is always shown beside it. A structured `stop` field on loop notes would remove the guess. That is a graph-ir decision for the driver.
- **Cost totals are summed per measure.** A lead that writes running totals would be double-counted. The real run has a single `turns` note.
- **The timeline is in append order, not timestamp order.** The real run's timestamps are inconsistent: n-0009 ends before it starts.
- **Wide graphs are small on a phone** in the 42%-height canvas (see the live screenshot). Pinch-zoom works. Real-device checks of the pulse and reduced motion are still the owner's to do.
- **`docs/PROGRESS.md` In flight** will conflict textually with slice 0009's entries at merge. Both only append.
- **Bundle size.** The web bundle is 750 KB (222 KB gzipped), under the 800 KB warning limit.
- **A malformed `%` escape** in a `#/run/<key>` hash throws in `decodeURIComponent`. The existing `#/g/<key>` route has the same exposure.

### Ambiguities in `docs/runs.md`, with my reading

1. **"Source" for the diff and for adoption.** I read it as the package's `.grooph/<id>/graph.grooph.json`. When its version differs from the working copy's, the source has moved on: I say so and refuse to write.
2. **"Run notes not copied."** The run's `notes.jsonl` stays beside the graph. The source's own pinned `doc.notes` carry over to the new version, and the working copy's `notes` field is dropped.
3. **`adoptWorkingCopy(..., { run })`.** The graph document has no field for a run id, so it is returned in the result and printed, and never written into the document (§4.7).
4. **Node state for outcomes the lead named itself** (graph-ir §6 leaves `outcome` open). I count them as finished, shown as `passed`, and the badge uses the lead's own word, such as "done".
5. **Rounds in nested loops.** A note's `round` belongs to the innermost loop around its node. Loop notes set their own loop's round, and the latest note wins, since inner rounds reset.
6. **`lastStop`.** It is the last pass note at the loop, meaning one with a round or an outcome. A proposal note at a loop does not replace it.
7. **"halted"** covers a `halt` outcome on the closing note, a node halt with nothing running, and a node started but never finished in a stopped run.
8. **"Newest first while live"** applies only while the live run is `running`. Otherwise the timeline is in append order.
9. **"Apply to a copy … to a new version."** It applies to the working copy, saved as version N+1 of the source.
10. **"Pin to graph"** targets the device's graph with that id. If there is none, it saves the source with the pin.
11. **`watch` with no argument** follows the newest run of any graph under `./.grooph/`.
12. **`share <run dir>`** also accepts a `*.grooph-run.json`, and `--out` writes the bundle.

### The real n-0008 proposal patch

The lead wrote a real grooph op list: `[{ "op": "updateEdge", "id": "e-checks-critic", "set": { "evidence": [4 items] } }]`.
- The run view shows it as `updateEdge e-checks-critic: evidence`, with the JSON behind a disclosure.
- "Apply to a copy" applies it to the working copy and saves version 2, which validates with no issues.
- The CLI reports `patch: 1 grooph op (updateEdge); grooph apply can replay it`.

The non-op case is exercised by `run-gate`'s JSON Patch proposal, which is explained ("index paths (JSON Patch), which grooph does not replay …") and has no apply button.

The amendment n-0002's own patch uses placeholder values (`"(see amend-01.ops.json)"`). That is why the change list comes from diffing the documents and never from replaying amendment patches.

### Sentence for `docs/targets/claude-code.md`

> When the lead dispatches a node it appends one short note first, `"outcome":"started"` with `at` = `node:<node-id>` (and `round` inside a loop), then the usual note when the node completes; `grooph watch` and the run view read these to show what is running now.

## Prompt to paste into the driver session

```text
Handback for slice 0008 is at handoffs/0008-runs/HANDBACK.md on branch slice/0008-runs (work head 0ab0560; the handback commit is on top). Status: done. All eight criteria met; fresh clone and CI green at 2f5bea5. For you: the started-note sentence for docs/targets/claude-code.md, lineage.from differs from your hand adoption by design (docs/runs.md §2), and only one real run folder exists, not three. Please reconcile with the grooph-reconcile skill.
```
