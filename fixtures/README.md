# Fixtures

Test material for the validator and compilers. Layout is fixed by `docs/graph-ir.md`:

```
fixtures/
  valid/<name>.grooph.json            graphs that must validate with no errors
  valid/<name>.expect.json            optional sidecar: the warnings that graph raises, exactly
  invalid/<CODE>/<name>.grooph.json   graphs that must report that code
  invalid/<CODE>/<name>.expect.json   optional sidecar: every code that graph reports, exactly
  ops/<name>.ops.json                 op lists for `applyOps` / `grooph apply` (packages/core/README.md)
  golden/<harness>/<graph>/           expected compiler output, byte-for-byte
```

Every rule code in `docs/graph-ir.md` §3 has at least one failing fixture under `invalid/`. CI fails when a code has no fixture. Every fixture is stored in canonical form (graph-ir §7).

## How the fixtures are checked

`packages/core/test/fixtures.test.ts` walks this folder on every run:

- Every code in `IMPLEMENTED_CODES` (all of graph-ir §3; `PLANNED_CODES` is empty) must have a folder under `invalid/` with at least one document in it.
- Every folder name under `invalid/` must be a code that exists in graph-ir §3, so a typo cannot hide a fixture.
- Each document under `invalid/<CODE>/` is parsed, then validated as export would (`validate(doc, { forExport: true })`), and must report `<CODE>` — as an error for `E_…`, as a warning for `W_…`.
- Without a sidecar, an invalid fixture reports **exactly its own code** and nothing else, so a failure names one rule. The fixtures written since stage 3 are minimal in that way.
- With a sidecar, the fixture reports exactly the codes listed in the sidecar's `issues`, in the validator's output order. Sidecars exist where a fixture also earns other true issues: the slice-0001 fixtures predate the stage-3 warnings, and `W_UNREACHABLE_NODE` cannot fire alone (under graph-ir §2's entry rule an unreachable node always sits on an uncovered cycle or behind a dangling edge). The sidecar's `note` says why.
- Each document under `valid/` must match the schema, have no errors, and raise exactly the warnings its sidecar lists (none without one). The review loop's sidecar lists `W_HOMOGENEOUS_CRITICS`: builder and critic both run at tier `strong`, which is true and kept.
- A sidecar with no fixture beside it fails the walk.

Sidecar format:

```json
{ "issues": ["W_HOMOGENEOUS_CRITICS"], "note": "why these, in one sentence" }
```

`ops/review-loop.ops.json` rebuilds `valid/review-loop.grooph.json` from the document `grooph new --name "Review loop"` writes; `packages/core/test/apply.test.ts` checks that byte for byte.

`golden/<harness>/<graph>/` holds the files `compile()` emits, at the paths the target profile gives them, and is compared byte for byte. Regenerate it with `pnpm --filter @grooph/core run golden:write` and read the diff before committing: those files are the package a human reviews.
