# Progress

The one file that says where grooph is right now. The driver rewrites it after every handback; implementers append to the **In flight** entry for their slice.

## Now

- **Stage:** 2 (vertical slice). Slice 0001 merged to `main`; slice 0002 (minimal canvas) is confirmed and waits for the owner to open the Opus 5 session. Slice 0003 (Astra review) is deferred with all Codex work.
- **Next action:** owner pastes the 0002 prompt into a fresh Opus 5 session.
- **Last coherent commit:** see `git log -1`.
- **What works today:** `pnpm exec grooph validate|canonicalize|export` on a graph document; the exported Claude Code package has driven one real headless run end to end (run `20260918-0042-k7qm`).

## In flight

### Slice 0002

Branch `slice/0002-minimal-canvas`, implementer Opus 5.

- 2026-09-18 · criterion 2 met: `pnpm --filter @grooph/web test:e2e` imports `review-loop.grooph.json` through the app at 400×800 with touch, exports from the app, and the unzipped package equals `fixtures/golden/claude-code/review-loop/` byte for byte (the graph download equals the package's canonical copy). Core is unchanged.
- 2026-09-18 · criterion 1 met: `pnpm install --frozen-lockfile && pnpm -r build && pnpm -r test` exits 0 with `apps/web` in the workspace (core 50, cli 12, web 39 tests); CI run `35375968063` green on Node 22 and 24 plus the new `web-e2e` job (Playwright, phone size).
- 2026-09-18 · criterion 3 met: `e2e/authoring.spec.ts` adds all four addable kinds by touch and sets every §1 field (agent, gate, check, stop; edge when/verdict/isolation/evidence/approval; loop members, back edges, mode, bar, every stop kind), then checks the downloaded document field for field; deletes cascade.
- 2026-09-18 · criterion 5 met: `e2e/validation.spec.ts` — the status chip and panel follow `validate(doc, { forExport: true })` keystroke by keystroke (schema issues first, as the CLI orders them); tapping an issue highlights its `at` (a loop expands to members and back edges); export refuses with the CLI's `formatIssue` lines and offers no package.
- 2026-09-18 · criterion 6 met: `e2e/library.spec.ts` + `roundtrip.spec.ts` — IndexedDB store survives reloads; list, create, open, rename, duplicate, delete (with a second tap to confirm); import refuses non-graphs with the reason; canonical `.grooph.json` download; package zip; kickoff copied in one tap (clipboard equals the golden `KICKOFF.md`).
- 2026-09-18 · criterion 8 met: `e2e/layout.spec.ts` — a layout-free review loop opens laid out top to bottom; the downloaded document has no `layout` until a node is dragged (then all four positions are written at once) or Save layout is tapped. Suite repeated ×3: 30/30.
- 2026-09-18 · criterion 7 met on the branch side: `.github/workflows/deploy.yml` builds `apps/web` with base `/grooph/` and deploys it to Pages from `main`; Pages enabled with source "GitHub Actions" (`gh api -X POST repos/ryanjosephkamp/grooph/pages -f build_type=workflow`, owner-approved; site `https://ryanjosephkamp.github.io/grooph/`). The branch build was served from a plain static server under `/grooph/` and loads with every asset under `/grooph/assets/`, no other request. The first deploy runs when the driver merges.
- 2026-09-18 · criterion 4, the implementer half: the review loop rebuilt from an empty graph at 400×800 by touch — automated (`e2e/authoring.spec.ts`, 58 taps, ~6 s) and driven by hand in a desktop browser at phone width against the Pages-style build (3 min 16 s, text entered by script). Six awkward spots found and fixed; the owner's Android Chrome run is still to do.

## Waiting on the owner

_(nothing — 0002 is confirmed; open the Opus session when ready)_

## Deferred until Codex is available

- Slice 0003, Astra's read-only harness-neutrality review (handoff already drafted). Latest sensible point: before stage 7.
- Stages 7–9 (Codex target, paired empirical runs, dual-harness nodes).

## Done

| Date | What |
|---|---|
| 2026-09-18 | Owner confirmed slice 0002; Codex-dependent work (0003, stages 7–9) deferred until the owner's Codex quota returns. |
| 2026-09-18 | Slice 0001 reconciled and merged: core (schema, validator, canonical form, Claude Code compiler), CLI, fixtures per ★ code, golden package, CI, headless acceptance run passed. Eight implementer findings folded into `graph-ir.md` and `targets/claude-code.md`; decision 0005 recorded. |
| 2026-09-17 | Owner confirmed slice 0001; MIT license added. |
| 2026-09-17 | Stage 1: graph document v0 designed (`graph-ir.md`), Claude Code target mapping (`targets/claude-code.md`), example fixtures. |
| 2026-09-17 | Stage 0: repo scaffolding, spec + amendments, living docs, handoff protocol, project skills. |
| 2026-09-17 | Phase A alignment: platform, executive location, phone-to-run path and slice order decided (see `PLAN.md`). |

## Known risks

- One acceptance run is one data point: a small graph, one harness version, one model. Fan-out, `shared` isolation, check nodes and larger graphs are unexercised until stage 8.
- The review-gate pattern currently depends on the lead filing the critic's `REVIEW.md` (critic lacks a write capability). Fixed by `write-outputs` in stage 3; do not copy the fixture into `patterns/` before then.
- Touch editing of edges on a phone canvas is fiddly. The outline view (stage 3) is the mitigation; the canvas stays for layout.
- Claude Code native units change between releases. `targets/claude-code.md` pins what was verified (2.1.268) and when.
- `turns` budgets bound the lead's own count, which ran 25 vs the harness's 33. Dollar budgets are advisory in Claude Code.
