# Handoff 0002 · Minimal canvas

**Stage:** 2 · **Implementer:** Opus 5 · **Effort:** `high` (floor `high`) · **Branch:** `slice/0002-minimal-canvas` · **Drafted:** 2026-09-18 · **Confirmed by owner:** pending

## Objective

The first human view of the graph document: a web app the owner opens on an Android phone to draw a graph, edit its nodes, edges and loops, see validation live, keep graphs on the device, and export the Claude Code package. It is a projection of `packages/core`'s document and nothing more: no feature the core does not already express, no second source of truth. The slice ends when the review-loop graph can be rebuilt from scratch on the phone and exported, and the app is deployed from `main`.

## Success criteria

1. **Workspace still green.** `pnpm install --frozen-lockfile && pnpm -r build && pnpm -r test` exit 0 with `apps/web` in the workspace; `.github/workflows/ci.yml` also builds and tests the web app.
2. **Round trip in the browser.** An automated browser test at a 400×800 viewport imports `fixtures/valid/review-loop.grooph.json` through the app's import control, exports the Claude Code package from the app, and the produced files equal `fixtures/golden/claude-code/review-loop/` byte for byte (unzip and compare, or compare the in-memory file map). This proves the core runs unchanged in the browser.
3. **Authoring.** On the canvas the user can: add a node of kind `agent`, `human-gate`, `check` or `stop`; edit every field graph-ir §1 gives that kind (role or custom role, tier, effort, brief, inputs, outputs, allow, deny, owns; gate prompt and options; check kind/run/pass; stop outcome); draw an edge by touch (tap source, tap target) and edit `when`, `isolation`, `evidence`, `approval`; select members and back edges to create a loop and edit its `mode`, bar (`name`, `inspects`, `acceptance`, `aspiration`) and stops (every stop kind, with its fields); drag nodes and have positions saved in `layout`; delete any of these. Graph-level: `name`, `goal`, `target.harness`, `constraints`, `description`.
4. **From scratch on a phone.** The owner, on Android Chrome, rebuilds the review-loop graph (4 nodes, 5 edges, 1 loop with a bar and 3 stops) without a keyboard-only interaction and gets a clean validation panel and a successful package export. You verify the same flow yourself in a desktop browser at phone width and record how long it took.
5. **Validation live.** The panel shows `validate(doc, { forExport: true })` output as the user edits; tapping an issue highlights the objects in its `at`. Export is refused with the error list when errors exist, matching the CLI.
6. **Persistence and files.** Graphs persist on the device across reloads; the user can list, create, open, rename, duplicate and delete graphs. Import a `.grooph.json` file; download the current graph as canonical `.grooph.json`; download the package as a zip; copy the kickoff prompt with one tap.
7. **Deployed.** A workflow deploys `apps/web` to GitHub Pages from `main` (`https://ryanjosephkamp.github.io/grooph/`), and the slice branch's build has been verified to serve correctly under that base path. Enabling Pages with source "GitHub Actions" needs the owner's repo permission; `gh api -X POST repos/ryanjosephkamp/grooph/pages -f build_type=workflow` does it from the owner's logged-in `gh`, and if that is refused, say so in the handback and the owner flips it in Settings → Pages.
8. **Documents without layout render.** A graph lacking `layout` (what an agent will produce in stage 5) gets an automatic layout on open; the positions are written back to `layout` only when the user moves something or saves explicitly.

## Read first

1. `handoffs/0002-minimal-canvas/HANDOFF.md` (this file)
2. `AGENTS.md`
3. `docs/graph-ir.md` §1 (fields), §3 (issue shape), §7 (canonical form; `layout` last)
4. `packages/core/src/index.ts` and `src/types.ts` — the API you consume; do not fork it
5. `fixtures/valid/review-loop.grooph.json` — the graph the phone test rebuilds
6. `docs/ARCHITECTURE.md` and `docs/decisions/0001-local-first-static-platform.md`, `0005-core-tooling.md`
7. `spec/capability-spec.md` §4.2, §6, §7 and `spec/AMENDMENTS.md` A-005
8. `handoffs/README.md`, `handoffs/TEMPLATE-HANDBACK.md`, and `handoffs/0001-core-compiler-cli/HANDBACK.md` for the level of detail expected

## Allowed changes

- `apps/web/**` — new
- `pnpm-workspace.yaml`, root `package.json`, `pnpm-lock.yaml`, `tsconfig.base.json` — workspace additions only
- `.github/workflows/ci.yml` — add the web build and tests; `.github/workflows/deploy.yml` — new
- `packages/core/**` — **only** for browser compatibility of what already exists (a Node-only import, a build setting); no semantic change, no new export; every such edit listed under Deviations
- `docs/PROGRESS.md` — the **In flight** section only
- `handoffs/0002-minimal-canvas/HANDBACK.md` — at the end

## Forbidden changes

- `docs/graph-ir.md`, `docs/targets/**`, `docs/PLAN.md`, `docs/decisions/**`, `spec/**`, `AGENTS.md`, `.claude/skills/**` — driver-owned
- `packages/cli/**`, `fixtures/**` (the golden must stay byte-identical; if the browser output differs, the bug is in the web app or a browser-compat shim, not in the golden)
- Any authoring feature outside criterion 3: templates, bulk spawn, copy/paste, groups, outline view, share links, run notes, MCP, PWA/offline install. They are stages 3–6.
- Any model API call, any backend, any network request other than loading the app itself.

## Spec constraints that apply here

- §4.2 and §6: one document, the canvas is a view; every edit is an edit to the document, and the document must remain readable as text (no hidden view-only state that changes meaning). View-only state that does not change meaning (selected tab, collapsed panel) stays out of the document or in `layout`.
- §7.1–7.2 as scoped by criterion 3; the rest of §7 is stage 3.
- §12 via the core validator; the app adds no rules of its own.
- A-005: `layout` is separable; auto-layout never rewrites a document silently.
- Decision 0001: static, local-first, no backend, installable later.

## Design already decided

React + Vite + React Flow (decision 0001). Storage on the device (IndexedDB preferred; `localStorage` acceptable for v0 if you note the size ceiling). The app consumes `@grooph/core` from the workspace; the package files it writes come from `compile()` untouched. Base path `/grooph/` for Pages. Phone-first: the inspector is a bottom sheet at phone width, touch targets ≥ 44 px, pinch to zoom, tap-to-connect for edges, and no interaction that needs hover or a right-click.

## Implementer's choices

Layout algorithm (dagre, elkjs, or your own), state management, styling approach, zip library, browser test runner (Playwright at a mobile viewport is the natural fit for criterion 2), component structure, how the graph list is presented. If the `impeccable` skill is available in your session, use it for one UI pass before the handback; otherwise apply its spirit: hierarchy, spacing, legible defaults, no decoration.

## How to verify

```bash
pnpm install --frozen-lockfile && pnpm -r build && pnpm -r test
pnpm --filter @grooph/web test:e2e          # or whatever you name the browser test; put the final form in the handback
pnpm --filter @grooph/web build && npx serve apps/web/dist   # then open at 400px width; rebuild the review loop by hand
gh run list --branch slice/0002-minimal-canvas --limit 3    # CI green
```

## Handback must contain

The `TEMPLATE-HANDBACK.md` sections, plus:

- The phone-width from-scratch timing and every interaction you found awkward by touch (this feeds the stage-3 outline view).
- The exact list of core edits, if any, with why each was needed in the browser.
- Whether Pages was enabled and the deployed URL, or what the owner must click.
- A screenshot or two of the canvas and the inspector at phone width, saved under `handoffs/0002-minimal-canvas/`.

## Prompt to paste

```text
You are the implementer for grooph slice 0002 (minimal canvas). The repo is /Users/noir/Documents/grooph, published at github.com/ryanjosephkamp/grooph.

1. Run `git fetch origin` and create branch slice/0002-minimal-canvas from origin/main.
2. Read handoffs/0002-minimal-canvas/HANDOFF.md first, then the files in its "Read first" order. The core package is consumed as-is; the handoff says exactly when you may touch it.
3. Work only inside the handoff's "Allowed changes". Commit often with `<area>: <what changed>` messages and push the branch.
4. Each time a success criterion is met, append one line to the "In flight" section of docs/PROGRESS.md under a "Slice 0002" heading (create it).
5. When done, or if blocked, finish with the grooph-handback skill. The last block of your final reply must be the return prompt from HANDBACK.md.
```
