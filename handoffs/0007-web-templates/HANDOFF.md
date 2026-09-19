# Handoff 0007 · Templates in the app and editing polish

**Stage:** 4 (second half) · **Implementer:** Opus 5 · **Effort:** `high` (floor `high`) · **Branch:** `slice/0007-web-templates` · **Drafted:** 2026-09-18 · **Confirmed by owner:** pending

## Objective

The owner's real use of the app is reviewing and tweaking graphs that agents built, and starting from templates. This slice brings the template library into the app and makes editing forgiving: undo, storage that the browser will not quietly evict, a toolbar that stays out of the way. It also lands three small items carried from review 0006.

This file is also the **checklist** the critic judges against when the slice is run through a grooph package (see "Two ways to run this slice").

## Success criteria

1. **Green from a fresh clone.** `pnpm install --frozen-lockfile && pnpm -r build && pnpm -r test` and `pnpm --filter @grooph/web test:e2e` exit 0; CI green.
2. **Template library in the app.** Built-in patterns are bundled at build time from `patterns/` (no network needed). A Templates screen, reachable from the library, lists them with title, when-to-use, not-for and profile chips; a template opens read-only in the viewer with its slots listed.
3. **Use a template.** "Use" asks for a graph name and each slot (`ask` as the label, `example` as the placeholder), allows leaving slots empty, creates the graph through core's `instantiate`, and opens it in the editor; unfilled slots show as `E_UNFILLED_SLOT` in the validation panel and tapping the issue highlights where they are.
4. **Insert a template** into the open graph through core's `insertFragment` (fragments and whole-graph templates), with the id map shown once and the inserted nodes selected and brought into view.
5. **Save as template.** From the Graph panel: whole graph, or "selected nodes" as a fragment, through core's `extractTemplate`; the form collects id, title, summary, when-to-use, and shows the estimated profile for correction. User templates persist on the device beside graphs, appear in the Templates screen under "Yours", can be deleted, and can be downloaded as `.grooph.json` (the same file the CLI's `template add` accepts). Importing a file that has a `template` block offers to add it to "Yours".
6. **Undo and redo** for every document edit in the editor (the document is immutable, so this is a bounded stack of documents, at least 50 deep), as toolbar buttons and as `Cmd/Ctrl+Z` and `Shift+Cmd/Ctrl+Z`; the stack survives closing and reopening the sheet, not a page reload. Deleting a node, edge or loop shows a brief "Deleted · Undo" toast.
7. **Storage persistence.** The app calls `navigator.storage.persist()` after the first save and shows, once and dismissibly, whether the browser granted it and what to do if not (download backups). No nagging.
8. **Toolbar and sheet.** While the bottom sheet is open the floating toolbar does not cover canvas content; selection stays visible above the sheet.
9. **Rename warning.** Renaming a graph whose id still follows its name, after that graph has been exported from this device at least once, warns that the package folder name will change and offers "keep the old id".
10. **Carried from review 0006.** The compare view opens on the recommended candidate (and scrolls its card into view); `W_HOMOGENEOUS_CRITICS` compares against nearest writers as graph-ir §3 now reads, with a fixture where a far-upstream writer no longer excuses the critic (`spec-then-loop`'s sidecar gains the warning; no tiers changed); `grooph validate` on a proposal set says so and points to `grooph share`.
11. **Phone quality.** Browser tests at 400×800 cover criteria 2–9; screenshots of the Templates screen, the Use form and the undo toast (light and dark) are saved in the slice folder. Touch targets ≥ 44 px, no hover-only affordance, text readable without zoom.

## Read first

1. `handoffs/0007-web-templates/HANDOFF.md` (this file)
2. `AGENTS.md`
3. `docs/templates.md` — the block, the operations, registries
4. `docs/graph-ir.md` §3 (`W_HOMOGENEOUS_CRITICS`, `E_UNFILLED_SLOT`, `E_IS_TEMPLATE`)
5. `docs/decisions/0006-web-tooling.md`, `0007-agents-are-the-primary-authors.md`
6. `apps/web/src/` — `App.tsx`, `ui/Library.tsx`, `ui/Editor.tsx`, `ui/open/`, `doc/store.ts`, `store/`; `apps/web/e2e/`
7. `packages/core/src/template.ts` and `packages/core/README.md` (Templates)
8. `handoffs/0002-minimal-canvas/REVIEW.md`, `handoffs/0006-executive-path/REVIEW.md`
9. `handoffs/README.md`, `handoffs/TEMPLATE-HANDBACK.md`

## Allowed changes

- `apps/web/**`
- `packages/core/**` and `packages/cli/**` — only for criterion 10
- `fixtures/**`, `patterns/*.expect.json` — only for criterion 10
- `.github/workflows/ci.yml` — only if a test step needs it
- root `package.json`, `pnpm-lock.yaml` — only if a dependency genuinely changes
- `docs/PROGRESS.md` — the **In flight** section only
- `handoffs/0007-web-templates/**` — the handback and screenshots
- `.grooph/**/runs/**` — run folders, when the slice is run through a grooph package

## Forbidden changes

- `docs/**` other than PROGRESS In flight, `spec/**`, `AGENTS.md`, `.claude/skills/**`, `plugins/grooph/skills/**` — driver-owned
- `patterns/*.grooph.json` (pattern content), `.grooph/graphs/**` and the placed package files (the run amends only its working copy)
- Remote template registries in the app, sync, accounts, any network request beyond loading the app; copy/paste, bulk spawn, groups, outline view, offline install (stage 8); run-note import and the monitor (stage 7)

## Spec constraints that apply here

- §10: users save and reuse a node, a subgraph, or a whole graph.
- §4.2 and §6: the app edits the one document through core operations; templates are documents.
- A-009: review, editing and reuse are the human surface; do not rebuild the editor to make blank-canvas authoring faster.
- Decision 0001: static, local-first, no backend.

## Design already decided

`docs/templates.md` for every template semantic; core's `instantiate`, `insertFragment`, `extractTemplate` are used as they are. Undo is a document stack, not an operation log.

## Implementer's choices

Screen layout and navigation for Templates; how bundling is done in Vite; toast and banner design; the undo stack bound; how "exported from this device" is remembered.

## How to verify

```bash
pnpm install --frozen-lockfile && pnpm -r build && pnpm -r test
pnpm --filter @grooph/web test:e2e
pnpm --filter @grooph/web build && pnpm --filter @grooph/web preview   # then open http://localhost:4173/grooph/ at phone width
```

## Handback must contain

The `TEMPLATE-HANDBACK.md` sections, plus the screenshots of criterion 11 and, when the slice was run through a grooph package, the run id, rounds, which stop fired, every amendment and proposal the lead recorded, and what the critic's verdicts caught that the tests did not.

## Two ways to run this slice

**A. Plain implementer session** (how slices 0001–0006 ran): paste the prompt below.

**B. Through grooph itself.** The driver designed three candidate workflows for this slice with the `grooph-design` skill (`.grooph/proposals/slice-0007/`); when the owner picks one, the driver places its package on `main` and gives a second prompt that starts the run with `/<graph-id>`. The lead session then dispatches the builder and critic subagents, this file is the critic's checklist, and the run ends at the package's stops. The handback protocol is unchanged: the lead writes `HANDBACK.md` and pushes.

## Prompt to paste (route A)

```text
You are the implementer for grooph slice 0007 (templates in the app and editing polish). The repo is /Users/noir/Documents/grooph, published at github.com/ryanjosephkamp/grooph.

1. Run `git fetch origin` and create branch slice/0007-web-templates from origin/main.
2. Read handoffs/0007-web-templates/HANDOFF.md first, then the files in its "Read first" order.
3. Work only inside the handoff's "Allowed changes". Commit often with `<area>: <what changed>` messages and push the branch.
4. Each time a success criterion is met, append one line to the "In flight" section of docs/PROGRESS.md under a "Slice 0007" heading (create it).
5. This slice makes no headless model runs.
6. When done, or if blocked, finish with the grooph-handback skill: the branch must be pushed and HANDBACK.md committed before you print the return prompt, which is the last block of your final reply.
```
