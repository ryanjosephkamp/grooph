# GAPS · Piece 2 · Header: title, period, three stat tiles

Judged: `captures/card.svg` / `captures/CAPTURE.md` (rendered 2026-09-22T15:28:25Z, src/card.mjs sha256 8b62c5eda7e9) against the header cut of the deck's reference card (`REFERENCE-CAPTURE.md` lines 9–22, `REFERENCE.md` points 1–5). Only the `header` group counts here; the `trend` group is Piece 3's placeholder and is out of scope.

## Side by side, labels stripped, random order

Two header captures, A and B, 14 rows each:

- Title `Northwind Stores` at (24,40) 20px weight 600 `#1f2933`; period `12 months to August 2026` at (24,60) 12px `#6b7280` — A and B identical.
- Tile rects x = 24, 224, 424, y = 84, 192 × 96, rx 8, fill `#f3f4f6`, no stroke — A and B identical. Row spans 24 … 616 with 8px gaps.
- Labels `REVENUE` / `ORDERS` / `AVG ORDER` at (40|240|440,108) 11px weight 600 `#6b7280` — identical.
- Values `$1.42M` / `38.2k` / `$37.24` at (40|240|440,146) 28px weight 700 `#1f2933` — identical, one shared baseline.
- Changes `▲ 12.4% vs prior period` `#1a7f37` / `▼ 3.1% vs prior period` `#c62828` / `▲ 15.8% vs prior period` `#1a7f37` at (40|240|440,166) 12px weight 600 — identical; Orders reads as a fall.

**Which is better:** neither. With labels stripped the two header groups cannot be told apart: every one of the 14 rows in `captures/CAPTURE.md` lines 9–22 is byte-identical to `REFERENCE-CAPTURE.md` lines 9–22 (A was the revision, B the reference). The revision meets the reference on all five header points of `REFERENCE.md` (lines 11–23).

## Acceptance, item by item (PIECES.md lines 96–101)

| acceptance | evidence | result |
|---|---|---|
| Three tile rects at x = 24, 224, 424, 192 × 96 at y = 84, rx 8, `#f3f4f6` | `captures/CAPTURE.md` lines 11, 15, 19 | met |
| Label y=108 (11px, 600, muted, CAPS), value y=146 (28px, 700, ink), change y=166 (12px, 600), shared baselines | `captures/CAPTURE.md` lines 12–14, 16–18, 20–22 | met |
| Values `$1.42M`, `38.2k`, `$37.24` | `captures/CAPTURE.md` lines 13, 17, 21 | met |
| Changes with ▲/▼, one decimal, `#1a7f37` / `#c62828` / `#1a7f37` | `captures/CAPTURE.md` lines 14, 18, 22 | met |
| Title (24,40) 20px 600 ink; period (24,60) 12px muted | `captures/CAPTURE.md` lines 9–10 | met |
| Only header colours `#1f2933`, `#6b7280`, `#f3f4f6`, `#1a7f37`, `#c62828`; 14 elements in order | `captures/CAPTURE.md` lines 9–22 (14 rows; the only other fill, `black`, is in the `trend` rows 23–34, Piece 3) | met |
| `npm test` passes | not in this critic's evidence (no command access); the lead's capture check verified the capture is current | not verified here |

## Ranked gaps

None that I would call major or minor against the header cut.

Observation, not a gap: `captures/card.svg` line 3 carries a `data-label="Revenue"` / `"Orders"` / `"Avg order"` attribute on each tile label `<text>` that the reference (`reference.svg` lines 7, 11, 15) does not. It is invisible when rendered, does not appear in the capture rows, and `REFERENCE.md` line 45–46 does not count it. The owner may drop it for parity but it does not block.

Out of scope for this piece: the `trend` group (`captures/CAPTURE.md` lines 23–34) is still placeholder output (black 18px bars at x = 10 …, no label, no baseline, no month names). That is Piece 3.

## Verdict

verdict: pass
