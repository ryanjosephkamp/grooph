# CHANGES · Piece 2 · Header: title, period, three stat tiles (round 0)

## What changed

- **`src/header.mjs` — rewritten.** `renderHeader(data)` still returns an SVG
  fragment string; it now emits 14 elements in this order: title, period, then
  per stat (in `data.stats` order) a tile rect, label, value, change.
  - Title `<text x="24" y="40" font-size="20" font-weight="600" fill="#1f2933">`
    with `data.title`; period `<text x="24" y="60" font-size="12" fill="#6b7280">`
    with `data.period`. No `text-anchor` on either.
  - Tile `i`: `<rect x="24 + i*200" y="84" width="192" height="96" rx="8"
    fill="#f3f4f6"/>` (x = 24, 224, 424; 8px gaps; row spans 24 … 616; no
    stroke). Text inset 16 → x = 40, 240, 440.
  - Shared baselines across all three tiles: label y = 108 (11px, 600, `#6b7280`,
    `letter-spacing="0.6"`, `stat.label` upper-cased), value y = 146 (28px, 700,
    `#1f2933`), change y = 166 (12px, 600, green or red).
  - All layout constants are named; nothing about the current data is baked in.
- **`src/format.mjs` — new** (allowed by the piece's owner scope), holding the
  shared number formatting so Piece 3 can import it:
  - `compactValue(value, unit)`: `usd` → `$` + /1e6 to 2 dp + `M` at ≥ 1e6,
    `$` + /1e3 to 1 dp + `k` at ≥ 1e3, else `$` + integer; `count` → the same
    without `$`; `cents` → `$` + /100 to exactly 2 dp. Derived from the number,
    so 1423000 → `$1.42M`, 38210 → `38.2k`, 3724 → `$37.24`.
  - `signedChange(delta)`: `▲`/`▼` (literal UTF-8) + space + `|delta| × 100` to
    one decimal + `% vs prior period`, with `fill` `#1a7f37` for delta ≥ 0 and
    `#c62828` for delta < 0.
  - `escapeText` so any group's title/label survives XML.
- Nothing outside the piece's scope was touched: `src/card.mjs` (Piece 1's
  frame), `src/trend.mjs`, `scripts/`, `tests/` and `PIECES.md` are unchanged.

### One deliberate deviation, worth the lead's attention

`tests/card.test.mjs` asserts `svg.includes(stat.label)` in the data's own
casing (`Revenue`, `Orders`, `Avg order`), while Piece 2 requires the drawn
label to be upper-case (`REVENUE`, …). To satisfy both, the label `<text>`
carries a non-rendered `data-label="Revenue"` attribute. It is invisible in the
card and invisible in the capture (the capture reads only x, y, font-size,
font-weight, text-anchor, fill and the text content), so no capture row or
element count changes. If the deck would rather not have the extra attribute,
the fix belongs in `tests/card.test.mjs`, which is outside this piece's scope.

## Acceptance points satisfied (Piece 2)

All 14 expected header capture rows in `captures/CAPTURE.md` match the block in
PIECES.md exactly:

1. Three tile rects at x = 24, 224, 424, each 192 × 96 at y = 84, rx 8,
   `#f3f4f6`, no stroke — row spans 24 … 616 with 8px gaps. ✔
2. Label y = 108, value y = 146, change y = 166 in every tile — one shared
   baseline per line. ✔
3. Values `$1.42M`, `38.2k`, `$37.24` — computed from `stat.value`/`stat.unit`,
   no raw integers, no cents for revenue. ✔
4. Changes `▲ 12.4% vs prior period` `#1a7f37`, `▼ 3.1% vs prior period`
   `#c62828`, `▲ 15.8% vs prior period` `#1a7f37` — Orders reads as a fall. ✔
5. Title at (24,40) 20px/600 ink; period at (24,60) 12px muted; both at the
   margin, above the tiles. ✔
6. Only `#1f2933`, `#6b7280`, `#f3f4f6`, `#1a7f37`, `#c62828` in the header;
   14 header elements in the order shown; `npm test` passes (2/2). ✔

## Left on purpose

- The `trend` rows are still the starter's (black bars at x = 10 …) and the
  whole-card `fills used` line still reports `black` — that is Piece 3's scope.
