# Fixtures

Test material for the validator and compilers. Layout is fixed by `docs/graph-ir.md`:

```
fixtures/
  valid/<name>.grooph.json          graphs that must validate clean (warnings allowed, listed in the sidecar)
  invalid/<CODE>/<name>.grooph.json graphs that must fail with exactly that code among their errors
  golden/<harness>/<graph>/         expected compiler output, byte-for-byte
```

Every rule code in `docs/graph-ir.md` has at least one failing fixture under `invalid/` and is exercised by at least one graph under `valid/`. CI fails when a code has no fixture.

## How the fixtures are checked

`packages/core/test/fixtures.test.ts` walks this folder on every run:

- Every code in `IMPLEMENTED_CODES` (the `★` set in `docs/graph-ir.md` §3) must have a folder under `invalid/` with at least one document in it. A new rule with no fixture fails the build.
- Every folder name under `invalid/` must be a code that exists in graph-ir §3, so a typo cannot hide a fixture.
- Each document under `invalid/<CODE>/` is parsed, then validated as export would (`validate(doc, { forExport: true })`), and must report `<CODE>` — as an error for `E_…`, as a warning for `W_…`. The fixtures here are deliberately minimal: each one reports exactly its own code and nothing else, so a failure names one rule.
- Each document under `valid/` must match the schema, validate with no errors, raise none of the implemented warnings, and — when it names a target harness — also validate clean for export.

`golden/<harness>/<graph>/` holds the files `compile()` emits, at the paths the target profile gives them, and is compared byte for byte. Regenerate it with `pnpm --filter @grooph/core run golden:write` and read the diff before committing: those files are the package a human reviews.
