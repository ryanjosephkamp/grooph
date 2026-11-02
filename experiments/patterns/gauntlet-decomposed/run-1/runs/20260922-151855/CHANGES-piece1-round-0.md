# CHANGES · Piece 1 · Card frame (round 0)

## What changed

`src/card.mjs` only. One element added to `renderCard(data)`, as the first child of
`<svg>`, on its own line, before `<g id="header">`:

```svg
<rect x="0.5" y="0.5" width="639" height="359" rx="12" fill="#ffffff" stroke="#e5e7eb"/>
```

It is emitted from `WIDTH - 1` / `HEIGHT - 1`, so it stays tied to the exported
canvas constants rather than being written twice. No `stroke-width` attribute
(the default 1 is what is wanted); the 0.5 inset keeps that 1px stroke crisp
inside the 640 × 360 canvas.

Nothing else was touched: `WIDTH`, `HEIGHT`, `renderCard(data)`, the `<svg …>`
opening line, the two groups and their order, the closing `</svg>` and the
trailing newline are all as they were. `src/header.mjs`, `src/trend.mjs`,
`scripts/`, `tests/` and `PIECES.md` are untouched.

## Acceptance points satisfied

- **First listed element is exactly the top-level rect, and the only top-level
  element.** `captures/CAPTURE.md` now opens its element list with
  `- (top level) · rect x=0.5 y=0.5 w=639 h=359 rx=12 fill=#ffffff stroke=#e5e7eb`,
  character for character the row the piece asks for. Every other element in the
  capture is inside `header` or `trend`.
- **`<svg>` still declares 640 × 360 with the viewBox and font-family; groups
  `header` then `trend`.** The opening line is unchanged and the capture reports
  `640 × 360`; document order is `<svg>`, frame rect, `header`, `trend`,
  `</svg>`, trailing newline.
- **`npm test` passes.** 2 tests, 2 pass, 0 fail.

## Gaps left on purpose

Piece 1 is round 0, so there is no ranked GAPS.md yet. The header and trend
content in the capture is still the placeholder output of `src/header.mjs` and
`src/trend.mjs` (wrong positions, sizes, `fill=black` bars, raw integers). That
is Piece 2's and Piece 3's scope, outside this piece's owner scope, and was
deliberately not changed.
