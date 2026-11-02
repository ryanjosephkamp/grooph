# Summary card · what it should be

A 640 × 360 card for the monthly business review deck, one per store group,
read on a projector from the back of a room. It has two parts, framed by
`src/card.mjs`:

- **Header** (`src/header.mjs`): the group's name, the period, and three tiles
  for the headline numbers, each with its label, its value in a compact form a
  reader can say aloud (`$1.42M`, `38.2k`, `$37.24`), and the change against
  the previous period.
- **Trend** (`src/trend.mjs`): the twelve months of revenue as bars, in order,
  with the months named, scaled so the best month is obvious and called out.

Quiet and exact: one accent colour for the data, neutral greys for everything
else, a white card, generous margins, nothing touching the edge, nothing
overlapping. Values exact to `data/summary.json`.

```bash
npm run render     # out/card.svg
npm run capture    # captures/card.svg and captures/CAPTURE.md, the element-by-element account reviewers judge from
npm test           # well-formed, both groups present, every stat and month shown
```

The reference card the deck already uses is held by the reviewers, who compare
each capture against it piece by piece and rank the gaps that matter most.
