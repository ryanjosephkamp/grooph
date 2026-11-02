# Gaps · Piece 2 · Header: title, period and three stat tiles

Judged: captures/card.svg and captures/CAPTURE.md (rendered 2026-10-04T22:51:27.556Z,
sha256 d338e5077a07) against the reference's `header` group
(REFERENCE-CAPTURE.md:9-22, reference.svg:3-18) and points 1 to 5 of REFERENCE.md
(REFERENCE.md:11-23). The trend group (CAPTURE.md:23-34) is still a stub. It belongs
to Pieces 3 and 4 and is not judged here.

## Side by side, labels stripped, random order

- **Card A:** title and period at x=32. Tiles are 184×80 at x=32, 228 and 424 with
  gaps of 12, so the row spans 32→608. Inside each tile, the baselines are 114, 144
  and 160. The label is 10px, the value 28px/700 and the change line 11px/600.
- **Card B:** title and period at x=24. Tiles are 192×96 at x=24, 224 and 424 with
  gaps of 8, so the row spans 24→616. Inside each tile, the baselines are 108, 146
  and 166. The label is 11px, the value 28px/700 and the change line 12px/600.

(Card A is the current capture, CAPTURE.md:9-22. Card B is the reference,
REFERENCE-CAPTURE.md:9-24.)

**Card B is slightly better.** The two have the same structure: the same hierarchy,
the same compact values, the same signed changes, and a row that runs margin to
margin. B wins on breathing room inside the tiles and on legibility of the small
text. Its 96px tile leaves 14px under the change baseline (166→180), against
A's 10px (160→170). Its label and change line are each 1px larger. Neither
difference breaks a point of REFERENCE.md, and none is a gap a projector audience
would notice (REFERENCE.md:40-46).

## Acceptance check (PIECES.md:74-99)

- **Title and period:** met.
  - The title is at (32,54), 20px, weight 600, dark #111827 (CAPTURE.md:9).
  - The period is at (32,74), 12px, muted #6b7280, on the same margin (CAPTURE.md:10).
- **One row of three tiles in data order:** met. REVENUE, ORDERS, AVG ORDER (CAPTURE.md:12,16,20).
  - Each tile is a #f3f4f6 rounded rect with rx=8 (CAPTURE.md:11,15,19).
  - The row starts at 32 and ends at 424+184=608, which is 640−32. Both ends sit on the
    same margin as the title, so the row is symmetric.
  - The widths are equal (184), the heights are equal (80) and the gaps are equal (12).
- **Fixed baselines, the same in every tile:** met.
  - The label baselines are all y=114, the value baselines all y=144 (shared), and the
    change baselines all y=160 (CAPTURE.md:12-22).
  - Every line is inset 14 from its tile's left edge (46−32, 242−228, 438−424).
  - The label is upper-case, 10px, weight 600 and muted.
  - The value is 28px, weight 700 and dark, so it dominates.
  - The longest line, "▲ 15.8% vs prior period" at 11px, is roughly 135px wide inside
    170px of room. Nothing overlaps another line or the tile's edge.
- **Compact values:** met. `$1.42M`, `38.2k` and `$37.24` (CAPTURE.md:13,17,21) are
  identical to the reference (REFERENCE-CAPTURE.md:13,17,21). There are no raw
  integers and no cents.
- **Change signed by colour and mark:** met.
  - The two rises are ▲ in green #15803d (CAPTURE.md:14,22).
  - The fall is ▼ 3.1% in red #b91c1c (CAPTURE.md:18). It reads as a fall.
  - Each line gives the percentage to one decimal, then "vs prior period".
  - The only non-grey text fills are those two change colours (CAPTURE.md:4).
- **The frame from Piece 1 is not regressed:** met.
  - The top-level rect comes first, at 0.5/0.5, 639×359, rx=11.5, white, with a
    #e5e7eb hairline (CAPTURE.md:8). The header group comes before the trend group
    (card.svg:3-4).
  - The single font family is unchanged (card.svg:1). There is no filter, gradient or
    shadow.
- **`npm test` passes:** not visible in my evidence (captures and PIECES.md only).
  Nothing in the capture contradicts it. The lead should confirm it from the owner's
  report.

## Ranked gaps (none major)

1. **Minor: the tile's vertical rhythm is cramped at the bottom.**
   - Where it shows: the tiles are 80 tall (CAPTURE.md:11). The label baseline sits
     24 below the tile top, but the change baseline sits only 10 above the tile bottom
     (160 vs 170, CAPTURE.md:14). The reference has 96-tall tiles with 14 below the
     change line (REFERENCE-CAPTURE.md:11,14).
   - Closing it: make the tiles about 88–96 tall and move the value and change
     baselines down to match. In the reference, the offsets from the tile top are
     about +24, +62 and +82. The padding under the change line should then read close
     to the padding above the label.
2. **Minor: the small tile text is 1px under the reference.**
   - Where it shows: the labels are 10px and the change lines 11px (CAPTURE.md:12,14).
     The reference uses 11px and 12px (REFERENCE.md:14-16; REFERENCE-CAPTURE.md:12,14).
   - Closing it: use 11px labels and 12px change lines. This makes the signed change a
     little more legible at a distance. Check that the longest change line still fits
     the 184px tile.
3. **Minor: the space between the period line and the tile row is tight.**
   - Where it shows: the period baseline is at 74 and the tile top at 90, which is 16
     (CAPTURE.md:10-11). The reference leaves 24 (60→84, REFERENCE-CAPTURE.md:10-11).
   - Closing it: move the tile row down by about 8, which fits naturally with gap 1.
     This separates the title block from the stats more clearly.
4. **Note, not this piece's gap: the margin is 32 rather than 24.**
   - Where it shows: everything is placed at x=32 and the row ends at 608
     (CAPTURE.md:9-19). The reference uses 24/616 (REFERENCE.md:11-13).
   - The margin is shared geometry owned by Piece 1, which passed, and this piece may
     not change it (PIECES.md:59-60). The header correctly spans whatever margin it
     is given. The gap between tiles is 12 rather than 8, which is still a small
     equal gap (PIECES.md:80).

No gap above breaks any of points 1 to 5 of REFERENCE.md or anything in the list of
major gaps (REFERENCE.md:40-44).

verdict: pass
