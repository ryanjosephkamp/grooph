# 0005 · Core tooling choices from slice 0001

**Date:** 2026-09-18 · **Status:** accepted · **Deciders:** implementer (Opus 5, slice 0001), promoted by the driver at review

## Context

Slice 0001 left package-level tooling to the implementer. These choices shape every later slice, so they are recorded here rather than left in a handback.

## Decision

- **`packages/core` has zero runtime dependencies.** It runs in the browser in slice 0002; the schema layer is a small set of hand-written combinators rather than a schema library. `ajv` is a devDependency that cross-checks the generated JSON Schema against the validator on every fixture.
- **One schema declaration, three outputs.** `src/schema/graph.ts` yields the runtime validator, the published `schema/grooph-0.schema.json`, and the canonical key order; type-level assertions fail the build when `types.ts` and the schema drift. The published schema is generated, never hand-edited.
- **`node:test`, plain `tsc`, `node:util parseArgs`.** No test framework, bundler or CLI library until something needs one.
- **`compile` throws `CompileError` carrying `issues`; `tryCompile` is the non-throwing form.**
- **Node ≥ 22** (`node --test` glob support). CI runs 22 and 24.
- **The CLI bin is linked at the workspace root**, so `pnpm exec grooph …` from the repo root is the canonical invocation.

## Consequences

- `apps/web` imports core from source; a bundler enters the repo only with the web app.
- A future schema constraint the type system cannot express (patterns, `minItems`) is guarded only by tests; add a test with each such constraint.
- Rule codes that are not yet implemented are listed in `PLANNED_CODES`, and the fixture walk starts enforcing each one the moment it lands.
