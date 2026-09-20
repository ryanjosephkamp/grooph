# taste-polish · one proving run

_(run pending)_

## Task

[`task/`](task/): `revenue-chart`, an SVG bar chart rendered from twelve months of data by `src/chart.mjs`; the first version is crude (no title, raw numbers, month indices, black bars, no margins). `STYLE.md` says what the chart should be in words; `npm run capture` copies the SVG into `captures/` with a readable `CAPTURE.md` (elements, fills, every text with its position). The reference ([`held-out/reference.svg`](held-out/reference.svg)) and what matters about it ([`held-out/REFERENCE.md`](held-out/REFERENCE.md), six ranked points and what counts as major) are the critic's.

## Mechanism

Held-out evidence: the reference lives beside the scratch project, readable by rule, named through the `{{reference}}` slot, which the template gives to the owner as well as the critic; the task text and the slot value tell the owner it is not its to read. The design bet: the critic fails round 0 against the reference, `e-critic-fail` is taken, and the loop ends on the human check-in at round 2, on diminishing returns, or on the bar ([`expect.json`](expect.json)). The digest records whether the owner read the reference anyway.

## Shape

`owner` (strong, owns the artifact) → `capture-check` (evidence check: `npm run capture`) → `critic` (frontier, fresh; evidence: the captures and the reference) → `done` on pass; capture fail and critic fail → `owner`. Loop `polish`: bar-passed, diminishing-returns 2 (major gaps remaining), human every 2, max-iterations 5, budget 16 dispatches.
