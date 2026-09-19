# Handoff 0008 · Runs: notes back, adoption, and the monitor

**Stage:** 7 · **Implementer:** Opus 5 · **Effort:** `high` (floor `high`) · **Branch:** `slice/0008-runs` · **Drafted:** 2026-09-19 · **Confirmed by owner:** 2026-09-19 · **Runs in parallel with slice 0009** (paths do not overlap)

## Objective

Close the loop the spec opens in §11: after (or during) a run, the owner sees what happened on the graph itself, sees exactly what an adaptive lead changed and why, adopts or discards that, and can watch a run in progress from a browser. Three real run folders are already in the repo and on this machine to build against.

## Success criteria

1. **Green from a fresh clone.** `pnpm install --frozen-lockfile && pnpm -r build && pnpm -r test` and `pnpm --filter @grooph/web test:e2e` exit 0; CI green.
2. **Core** per `docs/runs.md` §2: `parseRunNotes`, `summarizeRun`, `diffGraphs`, `adoptWorkingCopy`, `buildRunBundle`, `parseRunBundle`, the bundle JSON Schema, and `kind: "run"` in the share envelope. Tested against the real record `.grooph/slice-0007-sandwich/runs/20260919-0057-66c8/` copied into `fixtures/runs/` (notes, working copy, source at the version it ran with), plus synthetic cases: a malformed line, a run with started notes and a node still running, a halted-at-gate run, nested loops, a working copy with export errors (adoption refused).
3. **`diffGraphs` on the real run** yields the three string changes of amendment n-0002 and nothing else, each as an op (`setConstraint`, `updateNode` ×2) with a readable line; replaying the ops on the source reproduces the working copy (layout and notes aside).
4. **Started notes.** Lead-brief §8 tells the lead to append a `"outcome":"started"` note at dispatch, as `docs/runs.md` §1 words it; goldens regenerated and read as documents; `docs/targets/claude-code.md` is driver-owned, so report the sentence you would add there.
5. **CLI** per §3: `runs list`, `runs show`, `runs bundle`, `share <run dir>`, `adopt`, `watch`. `adopt --write` on a copy of the real run produces version 2 identical in meaning to what the driver adopted by hand (`.grooph/graphs/slice-0007-sandwich.grooph.json` at `main`, description aside). `watch` binds to localhost by default, prints the LAN warning with `--host`, serves the built app and the endpoint, re-reads from disk per request, and is tested by starting it on a free port against a fixture run folder that the test appends to.
6. **Run view** per §4, with browser tests at 400×800: open the real run from a bundle file and from a link; node states, loop round and timeline render; tapping a note highlights its object; the change list shows three changes tied to n-0002; Adopt saves version 2 to the library and the source stays; Discard leaves everything as it was; "Apply to a copy" works for an op-list proposal and explains itself for a non-op patch (the real n-0008 patch is whatever the lead wrote; handle it honestly); Pin copies a note into `doc.notes`; a live test polls a stub endpoint whose run advances from started to passed.
7. **Motion and colour.** Running nodes pulse; under `prefers-reduced-motion` they show a static ring; every state has an icon or label besides colour; light and dark screenshots at phone width saved in the slice folder.
8. **Nothing phones home.** The app makes no request other than to its own origin, except the `watch` endpoint it was opened from; a test asserts it.

## Read first

1. `handoffs/0008-runs/HANDOFF.md` (this file)
2. `AGENTS.md`
3. `docs/runs.md` — normative for this slice
4. `docs/graph-ir.md` §2 (Working copy, Adaptation, Brakes) and §6 (RunNote); `docs/executive.md` §2 (share envelope, untrusted input)
5. The real records: `.grooph/slice-0007-sandwich/runs/20260919-0057-66c8/` and `handoffs/0007-web-templates/HANDBACK.md` § "The run"
6. `packages/core/README.md` (ops, proposals, share); `packages/core/src/share.ts`, `src/ops/`
7. `apps/web/src/ui/open/` (viewer, compare) and `ui/canvas/ViewCanvas.tsx` — the read-only canvas to extend
8. `docs/decisions/0001`, `0006`, `0008`
9. `handoffs/README.md`, `handoffs/TEMPLATE-HANDBACK.md`

## Allowed changes

- `packages/core/**`, `packages/cli/**`, `apps/web/**`
- `fixtures/runs/**` (new), `fixtures/golden/**` (regenerated)
- `.github/workflows/ci.yml` — only if a test step needs it
- root `package.json`, `pnpm-lock.yaml` — only if a dependency genuinely changes
- `docs/PROGRESS.md` — the **In flight** section only, under a "Slice 0008" heading
- `handoffs/0008-runs/**`

## Forbidden changes

- `patterns/**`, `scripts/**`, `experiments/**` — slice 0009 is working there right now
- `docs/**` other than PROGRESS In flight, `spec/**`, `AGENTS.md`, `.claude/**`, `plugins/**`, `.grooph/**` (read the run records; do not change them)
- Any model call or headless run; any hosted service; writing anywhere from `watch`; Claude Code hooks (deferred)

## Spec constraints that apply here

- §11: append-only notes and proposed diffs by default; nothing is applied to the graph without the human. A-008: a run changes only its working copy; adoption is the human's act.
- §5.7: notes attach to nodes, edges, bars, stops and the graph; they do not silently become the graph.
- §4.7: the document stays small; run data lives beside it.
- Links and bundles are untrusted input (`docs/executive.md` §2).

## Design already decided

`docs/runs.md` in full.

## Implementer's choices

How `watch` finds and serves the built app; polling mechanics; the run view's layout on a phone; how runs are stored beside graphs in IndexedDB; error copy.

## How to verify

```bash
pnpm install --frozen-lockfile && pnpm -r build && pnpm -r test
pnpm --filter @grooph/web test:e2e
pnpm exec grooph runs list
pnpm exec grooph runs show .grooph/slice-0007-sandwich/runs/20260919-0057-66c8
pnpm exec grooph adopt .grooph/slice-0007-sandwich/runs/20260919-0057-66c8
pnpm exec grooph watch .grooph/slice-0007-sandwich --open
```

Put the final working form of every command in the handback.

## Handback must contain

The `TEMPLATE-HANDBACK.md` sections, plus: the `diffGraphs` output for the real run; how the real n-0008 proposal patch was handled; the screenshots; the sentence for `docs/targets/claude-code.md`; every ambiguity in `docs/runs.md` with your reading.

## Prompt to paste

```text
You are the implementer for grooph slice 0008 (runs: notes back, adoption, and the monitor). The repo is /Users/noir/Documents/grooph, published at github.com/ryanjosephkamp/grooph.

1. Another session is working on slice 0009 at the same time, so work in your own git worktree: run `git fetch origin`, then `git worktree add ../grooph-0008 -b slice/0008-runs origin/main`, and do all your work in /Users/noir/Documents/grooph-0008 (run `pnpm install --frozen-lockfile && pnpm -r build` there first). Stay out of patterns/, scripts/ and experiments/.
2. Read handoffs/0008-runs/HANDOFF.md first, then the files in its "Read first" order. docs/runs.md is normative for this slice.
3. Work only inside the handoff's "Allowed changes". Commit often with `<area>: <what changed>` messages and push the branch.
4. Each time a success criterion is met, append one line to the "In flight" section of docs/PROGRESS.md under a "Slice 0008" heading (create it).
5. This slice makes no headless model runs.
6. When done, or if blocked, finish with the grooph-handback skill: the branch must be pushed and HANDBACK.md committed before you print the return prompt, which is the last block of your final reply.
```
