# Review 0002 · Minimal canvas

**Reviewer:** driver (Fable 5.1) · **Handback:** `HANDBACK.md` at `71bc67c` · **Date:** 2026-09-18

## Verdict

`proceed` — merged into `main` as `cfde583`.

## Verified independently

| Check | Command | Observed |
|---|---|---|
| Branch exists on GitHub | `git branch -r` after fetch | `origin/slice/0002-minimal-canvas` present (the first handback message arrived before the session had run; nothing was reconciled then) |
| Boundary | `git diff --name-only main...HEAD` filtered against the allowed list | no path outside it; `packages/core` has zero edits |
| Cold build and unit tests | `pnpm install --frozen-lockfile && pnpm -r build && pnpm -r test` | exit 0; core 50, cli 12, web 40 |
| Phone-size browser suite | `pnpm --filter @grooph/web test:e2e` | 10/10 at 400×800 with touch, including the byte-for-byte round trip against `fixtures/golden/claude-code/review-loop/` and the from-scratch rebuild (58 taps) |
| CI | `gh run list --branch slice/0002-minimal-canvas` | last three runs green, `web-e2e` job included |
| Pages setting | `gh api repos/ryanjosephkamp/grooph/pages` | `build_type: workflow`, `html_url: https://ryanjosephkamp.github.io/grooph/` |
| Screenshots | read `canvas-phone.png`, `inspector-phone.png` | legible at phone width; kinds distinguishable by shape and colour; loop membership and back edges visible |

Live deploy: see `docs/PROGRESS.md` for the result of the first `deploy.yml` run on `main`.

## Findings

1. **Typed document operations live in `apps/web/src/doc/ops.ts`.** Correct call under the handoff (no new core exports), and they are pure and tested. They must move into `packages/core` before stage 5 so the MCP server and the canvas share one vocabulary. Scheduled as the first item of stage 3.
2. **The floating toolbar overlaps canvas content while the bottom sheet is open** (visible in `inspector-phone.png`, where it covers the gate node). Cosmetic; stage 3 should hide or dock the toolbar when the sheet is up.
3. **No undo.** Deletes are immediate. The document is immutable, so an undo stack is cheap. Stage 3.
4. **No `navigator.storage.persist()`**, so Android may evict IndexedDB data under pressure. Belongs with the installable/offline work in stage 3; until then Export → download is the backup.
5. **Graph id follows its name**, which renames the package directory on re-export. By design and stated in the UI; worth a confirmation prompt when the graph has been exported before. Stage 3.
6. **The handoff's serve command was wrong** for a build with base `/grooph/`; `pnpm --filter @grooph/web preview` is the form. Second handoff in a row with a wrong verify command: future handoffs say "name the final command in the handback" instead of guessing one.
7. **Schema-invalid documents are held while editing** and the app never invents content to satisfy the schema. Agreed; this is the right reading of "document first".
8. **Real-finger pinch and drag are untested.** Only the owner's Android run can close this.

## Decisions promoted

To `docs/decisions/0006-web-tooling.md`: Vite + React + `@xyflow/react`, core consumed from source, hand-rolled IndexedDB store with in-memory fallback, own layered layout aware of back edges, vitest + Playwright at 400×800, hash routes, no state library, plain CSS with tokens, ids follow names with cascading renames, deletes cascade.

## Deviations

All accepted: the serve command, the three screenshots in the slice folder (the handoff asked for them), `impeccable` used without its interview step, the Pages setting change (owner-approved in that session).

## Carry-forward to stage 3

Move `ops.ts` into core · toolbar vs sheet overlap · undo · storage persistence request · export-aware rename warning · self-loop edges by tap · keyboard selection of canvas nodes · `write-outputs` in the capability picker once core has it · Chromium cache in CI · four unused locals in core.
