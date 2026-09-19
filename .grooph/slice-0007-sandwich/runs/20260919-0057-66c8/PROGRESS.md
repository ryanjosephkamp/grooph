# Run 20260919-0057-66c8 · Slice 0007 sandwich

**Goal.** Implement grooph slice 0007 in apps/web: browse, use, insert and save-as templates in the app (built-ins bundled), plus editing polish: undo, storage persistence request, toolbar clear of the open sheet, rename warning for exported graphs. Done when `pnpm -r build && pnpm -r test && pnpm --filter @grooph/web test:e2e` passes and a critic finds nothing unmet in handoffs/0007-web-templates/HANDOFF.md.

**Branch.** `slice/0007-web-templates` · **Working copy.** `graph.grooph.json` in this folder (amended, see below)

## Position

- **Round:** 0 (no back edge taken yet)
- **Lead turns used:** ~7 of 80 (budget stop; a turn is one lead tool-use cycle, counted by hand)
- **Now:** dispatching `builder` (round 0)
- **Last stop check:** before round 0 — bar not passed; max-iterations 0/5; budget ~7/80 turns. None fired.

## Nodes

| node | status | last result |
|---|---|---|
| `builder` | pending | — |
| `checks` | pending | — |
| `critic` | pending | — |
| `done` | pending | — |

## Rounds

| round | builder | checks | critic |
|---|---|---|---|

## Amendments

1. **n-0002 · kickoff.** `constraints.other` said "Touch apps/web only", which contradicts the owner-confirmed handoff: criterion 10 needs `packages/core`, `packages/cli`, `fixtures/` and `patterns/*.expect.json`, so the bar could never pass. The constraint now names the handoff's allowed paths exactly, forbidden paths unchanged. Builder and critic outputs now name where `CHANGES.md` and `REVIEW.md` go (`round-<n>/` in this folder), so the critic's `REVIEW.md` never lands on the driver's `handoffs/0007-web-templates/REVIEW.md`. No brake touched. Ops: `amend-01.ops.json`.

## Proposals

None yet.

## Observations

- The graph's `description` says "at fifty turns" while its budget stop says 80. The run follows the stop (80); the description is stale text for the human to fix.
