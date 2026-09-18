# 0006 · Web app tooling and editing semantics from slice 0002

**Date:** 2026-09-18 · **Status:** accepted · **Deciders:** implementer (Opus 5, slice 0002), promoted by the driver at review

## Context

Slice 0002 left everything below "React + Vite + React Flow" to the implementer. These choices shape stage 3 onward.

## Decision

**Tooling.** Vite 8, React 19, `@xyflow/react` 12. `@grooph/core` is consumed from source through a Vite alias and a tsconfig path (still a `workspace:*` dependency). `fflate` for zips. vitest for unit tests; Playwright at 400×800 with touch for browser tests, run against `vite build && vite preview` so every test runs under the `/grooph/` base path. Hash routes, so Pages needs no rewrites. No state library: the open document is one external store read with `useSyncExternalStore`. Plain CSS with tokens, light and dark following the system, system fonts, no network request beyond the app itself. A hand-rolled IndexedDB store with an in-memory fallback that tells the user graphs will not survive a reload. A small layered layout that leaves loop back edges out of the ranking.

**Editing semantics.**
- Every edit is a pure, typed operation on the document (`addNode`, `connect`, `setStop`, …). They live in `apps/web/src/doc/ops.ts` today and move into `packages/core` in stage 3 so the MCP server exposes the same vocabulary.
- An id follows its name while it is still that name's slug; renames update every reference. Editing the id by hand breaks the link.
- Deletes cascade to everything that cannot stand alone (edges, loop memberships, back-edge entries, stop `then`, `answerKeyFrom`, layout, group memberships, scoped policies).
- A document may be schema-invalid while being edited; the app shows the issue and never invents content to satisfy the schema.
- A layout-free document stays layout-free until a drag or an explicit "Save layout" (A-005).
- Fields the view cannot yet edit (policies, groups, lineage, run notes) are shown read-only and preserved untouched.

## Consequences

- The MCP server in stage 5 gets its operation set for free once `ops.ts` is in core.
- Browser tests are the acceptance surface for phone ergonomics; real-device behaviour (pinch, drag, on-screen keyboard) still needs the owner's run.
