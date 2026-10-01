# Handback 0026 · Operation maps

**Session:** Opus 5.5, driving and building (decision 0014) · **Branch:** `slice/0026-operation-maps` (stacked on `slice/0024-fresh-eyes-review`) · **Date:** 2026-09-30 · **Handoff:** the owner's brief, item 3

## Status

`done`. A second kind of document exists beside the graph, with an amendment, a schema, rules, a sample, a picture, a CLI and a view. The graph document did not change.

## What changed

- **`spec/AMENDMENTS.md`**: A-011. **`docs/operation-map.md`** (new, normative).
- **`packages/core`**
  - `src/types.ts`: `OperationMap`, `Lane`, `Session`, `Handoff`, `Carrier`.
  - `src/schema/map.ts` (new) and `schema/grooph-map-0.schema.json` (new, generated).
  - `src/map.ts` (new): `parseMap`, `validateMap`, `canonicalizeMap`, `mapShape`, `carrierText`.
  - `src/picture/svg.ts`, `src/picture/map-picture.ts` (new): `mapPicture`.
  - `src/share.ts`: a fourth envelope kind, `map`.
  - `test/map.test.ts` (new), `src/dev/write-golden.ts` (the sample's pictures).
- **`packages/cli`**: `commands/image.ts` (new); `validate`, `canonicalize`, `shape`, `share` take a map; `export` refuses one by name; `test/map.test.ts` (new).
- **`apps/web`**: `src/ui/map/MapView.tsx` (new); `OpenScreen` and `Library` route a map to it; `e2e/map.spec.ts` (new).
- **`fixtures/maps/`** (new): two valid maps, fourteen invalid across ten codes, the sample's pictures.
- **Docs**: `AGENTS.md`, `README.md`, `ARCHITECTURE.md`, `GLOSSARY.md`, `fixtures/README.md`, `PLAN.md`, `PROGRESS.md`.

## Verified, and how

| Claim | Command | Observed |
|---|---|---|
| Old graphs keep loading | `packages/core/test/map.test.ts`, "a map is not a graph…"; the whole existing suite | every valid graph fixture still parses as a graph and not as a map; the 282 tests that existed before still pass, with no golden package changed |
| Every map rule has a code and a fixture | `map.test.ts`, first test and the per-fixture tests | ten codes, fourteen failing maps, each reporting exactly its folder's code |
| A handoff with no carrier is refused by name | `grooph validate fixtures/maps/invalid/E_HANDOFF_NO_CARRIER/no-carrier.grooph-map.json` | `error  E_HANDOFF_NO_CARRIER  handoff "h-plan" ("planner" → "builder") names no carrier; say what moves the work across…`, exit 1 |
| The schema is generated and agrees with the parser | `map.test.ts`, schema test (Ajv 2020) | committed schema equals the generated one; Ajv and `parseMap` agree on all sixteen fixtures |
| The sample validates and draws | `grooph validate`, `grooph image … --theme light`; the picture read at 400 px in both themes | clean; 3 lanes, 7 sessions (18 counting families), 10 handoffs, 2 carried by a person |
| The picture reads on a phone | `e2e/map.spec.ts`, first test | as wide as a 400 px screen, smallest text at least 8.4 px, nothing scrolls sideways |
| The view | `e2e/map.spec.ts` | a session and a handoff open their details and lead to each other; a saved picture equals the golden file byte for byte; a file imports into the same view and stores nothing |
| A map is never compiled | `packages/cli/test/map.test.ts`, last test | `grooph export <map>` exits 1 saying a map is never compiled |
| Everything | `pnpm -r build && pnpm -r test && pnpm --filter @grooph/web test:e2e` | core 305, cli 66, web 54, browser 72: all pass |

## Decisions made

- **A separate document, not a new graph version.** `grooph: 0` is untouched; a map is `groophMap: 0` with its own schema file. That is the whole versioning story: nothing about a graph changed, so nothing about loading one could.
- **Nodes are sessions only.** A person is a carrier, not a node, as the brief has it. A handoff runs from session to session and says who or what carried it.
- **A fifth carrier kind, `session-message`**, beside the four the brief names. "The Operator starts and steers the lanes" is a handoff, and none of the four says how; the harness's own channel does.
- **`carrier` is optional in the schema and required by rule**, so its absence is `E_HANDOFF_NO_CARRIER` with a sentence, not `E_SCHEMA` with a path.
- **Rule errors do not block a link.** A graph with errors cannot be shared because it could not be exported. A map is never exported, and a map with a named error is exactly what the owner wants to look at.
- **The picture puts handoffs in the margin**, numbered, with the list below. Drawn between the cards they cross every lane and cover the words.
- **The picture is automatic.** No saved layout for a map in v0; a phone-width column needs none.
- **Three warnings that fit**: a carrier that cannot cross an account or a harness; a session nothing touches; a session that is handed work and hands nothing on.

## Deviations

None from the brief. One from the usual fixture layout: maps live under `fixtures/maps/` with their own test file, because `fixtures/valid` and `fixtures/invalid` are walked as graphs.

## Not verified, and assumed

- Not verified: the picture as a PNG. `grooph image` writes SVG only; PNG comes with the exports (slice 0025).
- Not verified: a map of more than about fifteen sessions. The margin widens by 13 units per overlapping handoff; a very tangled map will squeeze its cards.
- Assumed, and written in the sample's own `description`: that the research lanes are on the Operator's cloud account and hand work to each other through their repository; that Codex is prompted by hand and returns work on a branch; that the Operator reaches its lanes by session message. The owner corrects these.
- Assumed: generic names for the accounts ("Claude account A", "Claude account B"), since the repository is public.

## Risks and leftovers

- `W_CARRIER_CANNOT_CROSS` encodes what is true today (a session message stays in one harness and one account; a published page belongs to its account). If a harness bridges that, the rule wants a second look; it is a warning for that reason.
- Text width is estimated without a browser. It runs wide on purpose; an unusual font could still clip a long name by a character or two.
- Deferred, named in `docs/operation-map.md` §7: a saved layout, live state on a map, maps in the app's library, editing a map in the app.
