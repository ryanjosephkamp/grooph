# Fixtures

Test material for the validator and compilers. Layout is fixed by `docs/graph-ir.md`:

```
fixtures/
  valid/<name>.grooph.json            graphs that must validate with no errors
  valid/<name>.expect.json            optional sidecar: the warnings that graph raises, exactly
  invalid/<CODE>/<name>.grooph.json   graphs that must report that code
  invalid/<CODE>/<name>.expect.json   optional sidecar: every code that graph reports, exactly
  ops/<name>.ops.json                 op lists for `applyOps` / `grooph apply` (packages/core/README.md)
  proposals/valid/<set>/              proposal sets (docs/executive.md §1) that validate clean, with their { file } graphs beside them
  proposals/invalid/<CODE>/<name>.grooph-proposals.json   proposal sets that report exactly that code
  golden/<harness>/<graph>/           expected compiler output, byte-for-byte
  pictures/<graph-id>.<theme>.svg     three graphs as their pictures (docs/exports.md), light and dark, byte-for-byte; the one with a subgrooph also open (`.open.`)
  pages/<id>.html                     the offline page (docs/exports.md) of one graph and one map, whole, byte-for-byte
  composed/<id>.grooph.json           the proof that composing works: a built-in template cut into two templates, and the two placed as subgroophs
  events/<name>.jsonl                 session events as the hook writes them (docs/subagents.md); two are real recordings, see events/README.md
  maps/valid/<name>.grooph-map.json            operation maps (docs/operation-map.md) that validate clean
  maps/invalid/<CODE>/<name>.grooph-map.json   maps that report exactly that code
  maps/pictures/<map-id>.<theme>.svg           the pictures of four maps (the sample, its first draft, the sample with its owner drawn, the smallest map with a person), light and dark, byte-for-byte
```

Maps are checked by `packages/core/test/map.test.ts`, by the same rules as graphs: every code in `MAP_CODES` has a folder with at least one map in it, each invalid map reports exactly its folder's code, each valid map is clean and canonical, and the pictures are what `mapPicture` draws (regenerate with `pnpm --filter @grooph/core run golden:write`, and look at them).

`composed/` is made, not written: `packages/core/src/dev/composed.ts` cuts the built-in `debate-then-build` into `debate-to-a-plan` and `build-to-green` with `extractTemplate`, places each with `placeSubgrooph`, and joins them by the one edge that ran between the halves. `packages/core/test/composed.test.ts` holds the three files to that, and holds the package the composed graph compiles to (`golden/claude-code/debate-then-build-composed/`) against the flat original's: the agent files are the same but for names, and the lead's brief says the same lines and names the two units. Regenerate with `pnpm --filter @grooph/core run golden:write`.

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

`proposals/` follows the same rules for proposal sets, walked by `packages/core/test/proposals.test.ts`: every set rule has a folder under `proposals/invalid/`, each set there reports exactly its folder's code, every set is stored in canonical form, and every set under `proposals/valid/` validates clean both as written and with its `{ file }` candidates inlined. `proposals/valid/csv-export/` is the slice 0006 rehearsal set (three candidates from `grind-loop`, `review-gate` and `spec-then-loop`); the CLI and browser tests share it.
