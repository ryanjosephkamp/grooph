# Progress · summary-card · run 20260922-151855

**Goal.** Make the summary card rendered by `npm run render` from src/card.mjs match the reference card the deck already uses, piece by piece. Done when every piece in PIECES.md is ticked by its critic against the held-out reference, the whole has been compared once more, and the human releases it.

**Round.** pieces: 1 complete · next would be round 2 (piece 3 · Trend) · polish: 0 per piece so far
**Dispatch counters.** `polish`: 3 / 10 (piece 2's pass; restarts per piece) · `pieces`: 8 / 42

## Nodes

| node | status |
|---|---|
| `planner` | done — PIECES.md, 3 pieces |
| `decomposition-gate` | done — human approved |
| `owner` | done for pieces 1 and 2 |
| `capture-check` | pass (rounds 0, 1) |
| `critic` | pass (pieces 1 and 2) — both boxes ticked |
| `next-piece` | pass — piece 3 remains |
| `integrator` | pending |
| `final-critic` | pending |
| `release-gate` | pending |

## Pieces

- [x] Piece 1 · Card frame — passed at polish round 0; frame rect byte-identical to the reference
- [x] Piece 2 · Header — passed at polish round 0; all 14 header capture rows byte-identical to the reference
- [ ] Piece 3 · Trend — not started

## Waiting on

**Halted for the human.** The `pieces` loop's stop 2 — *human halt, asked every 2 rounds* — fired before round 2. Awaiting the human's word to continue with piece 3.

## Last stop check

`pieces` stops before round 2, in order: bar-passed **no** (piece 3 unticked) · human halt every 2 rounds **FIRED** (2 rounds elapsed) · max-iterations not reached (2 < 4) · budget not reached (8 < 42).

`polish` ended on stop 1 (bar passed) at round 0 for both pieces so far — no rework round was needed.

## Notes for the human

- `tests/card.test.mjs:20` asserts each stat label in the data's own casing (`Revenue`, `Orders`, `Avg order`), which conflicts with the upper-case tile labels the reference uses. The piece-2 owner satisfied both by carrying a non-rendered `data-label` attribute on the label `<text>`; the critic confirmed it is invisible in the capture and not a gap. If you would rather the test changed instead, that is outside every current owner scope.

## Amendments

None.
