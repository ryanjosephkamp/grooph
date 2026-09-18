# Fixtures

Test material for the validator and compilers. Layout is fixed by `docs/graph-ir.md`:

```
fixtures/
  valid/<name>.grooph.json          graphs that must validate clean (warnings allowed, listed in the sidecar)
  invalid/<CODE>/<name>.grooph.json graphs that must fail with exactly that code among their errors
  golden/<harness>/<graph>/         expected compiler output, byte-for-byte
```

Every rule code in `docs/graph-ir.md` has at least one failing fixture under `invalid/` and is exercised by at least one graph under `valid/`. CI fails when a code has no fixture.
