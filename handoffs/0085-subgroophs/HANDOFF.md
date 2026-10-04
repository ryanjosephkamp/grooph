# Handoff 0085 · Subgroophs, built

**Stage:** 24 · **Lane:** Opus 5.5 · **Effort:** extra high · **Browser tests on port:** 4366 · **Branch:** `slice/0085-subgroophs` · **Drafted:** 2026-10-04 · **Confirmed by owner:** 2026-10-04, in the chat ("I approve PR #57": amendment A-018 and decision 0025)

## Objective

A **subgrooph** is a template placed inside a graph as a unit: a group that remembers which template and version it came from, drawn as one box that opens. Amendment A-018 and decision 0025 say what it is and is not. Build it.

It answers three needs: a long graph is hard to read; an agent composing a graph should place a proven template as a unit; a placed unit should be able to take its template's fixes.

**Decision 0025 is the design. Read it first, and build what it says and nothing more.** By value, not by reference: no node of kind `graph`, nothing resolved or inlined at compile time.

## What to make, in this order, each a pull request of its own

1. **The document and the rules.** `from`, `with` and `description` on a group (schema, types, the JSON Schema, `docs/graph-ir.md` §1 and §3, `docs/templates.md`). Three rules, each with a failing and a passing fixture and a row in the rule table and the generated rule reference: `E_GROUP_CYCLE`, `W_GROUP_OVERLAP`, `E_SECOND_LEAD`. Every template and fixture that validates today still validates.
2. **Placing and refreshing, in core and the CLI.** `grooph sub add <template> --as <id> [--after <node>] [--then <node>]`, `grooph sub list`, `grooph sub update` (shows what a newer version of the template would change; a change that loosens a brake in A-008's list is named first and is not applied unless asked for by name), `grooph sub extract <group>`. Pure functions in core beside `insertFragment`, which already copies a template in; the commands are thin.
3. **What a person sees.** The picture, the outline and the canvas draw a subgrooph as one box with its template's glyph, its name and how many nodes it holds; it opens in place. The lead's brief names it as a unit.
4. **The same four operations as MCP tools**, once #60 has merged (the agents lane's authoring tools); if it has not when you reach this, stop here and say so.
5. **The proof.** One built-in template rebuilt as two subgroophs placed in a graph, validated, exported, and compared with the flat original: the package's agent files are the same but for names. No model session: the recorded run is the driver's to arrange after the owner has seen items 1 to 3.

## Limits that matter

- **The budget.** A template's address is at about 275.9 of 276 KB. Item 3 may not raise a line of `scripts/perf-budget.json`. If drawing a closed box cannot fit, put what is new behind a door that only a document with a subgrooph opens, as slice 0080 did for the map's views, and say what you measured.
- **The phone's picture of a graph with no group is byte for byte what it is today.** Compare over every template at the widths slice 0080 used.
- **Golden packages change only for a document that has a group.** No built-in template has one, so none changes in items 1 and 2.
- The compiler's frontmatter writer was hardened in #63: a template id written into a group's `from` is held to the same pattern as a model's name, and nothing from `from` or `with` reaches an agent file's header unguarded.

## Read first

`docs/decisions/0025-subgroophs.md`; `spec/AMENDMENTS.md` A-018 and A-008; `AGENTS.md` and what it lists for a graph; `packages/core/src/template.ts` (`insertFragment`, `extractTemplate`), `packages/core/src/validate.ts` (how groups are read today); `handoffs/0080-other-views-of-a-map/HANDBACK.md` (the door, and the byte-for-byte comparison).

## Allowed changes

`packages/core/**`, `packages/cli/**`, `apps/web/src/**` and its tests, `fixtures/**`, `docs/graph-ir.md`, `docs/templates.md`, `docs/exports.md`, the generated references, `handoffs/0085-subgroophs/**`.

## Forbidden changes

`spec/**`. `patterns/**` in items 1 to 4 (item 5 adds one template only if the owner has said so; until then the proof lives under `fixtures/`). `scripts/perf-budget.json`. A new dependency. A version number. `docs/PLAN.md`, `docs/PROGRESS.md`.

## How to verify

```bash
pnpm -r build && pnpm -r test
GROOPH_E2E_PORT=4366 pnpm --filter @grooph/web test:e2e
node scripts/rule-reference.mjs --check && node scripts/cli-reference.mjs --check && node scripts/perf-budget.mjs --check
```

## Handback must contain

The `TEMPLATE-HANDBACK.md` sections, plus: each pull request and its state; the budget's lines before and after item 3; pictures of a graph with a closed and an open subgrooph at a phone's width and at 1440, light and dark; what `sub update` does with a change that loosens a brake, shown.

## Prompt to paste

```text
You are a lane of grooph. Read handoffs/0085-subgroophs/HANDOFF.md, then docs/decisions/0025-subgroophs.md, AGENTS.md and the files they list, and do the slice. Each numbered item is a pull request of its own, on a branch slice/0085-<item> cut from main, smallest first; tell the driver when one is up. Browser tests on port 4366. Do not edit docs/PLAN.md or docs/PROGRESS.md. The driver session ("grooph opus operator") assigns and reviews your work and will message you; ask it, not me. Finish with the grooph-handback skill; you do not merge.
```
