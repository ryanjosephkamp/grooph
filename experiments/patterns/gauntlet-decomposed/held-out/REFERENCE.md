# The reference card, and what matters about it

`reference.svg` beside this file is the card the deck already uses;
`REFERENCE-CAPTURE.md` describes it element by element in the same form the
project's `npm run capture` uses for a revision, so the two can be set side by
side. The critics compare each capture against the piece's cut of the
reference and, at the end, the whole. What matters, most first:

## Header (title, period, three tiles)

1. **The three tiles span the card's inner width.** Left edge at the margin
   (24), right edge at the margin (616), equal widths (192) with a small gap
   (8): the header reads as one row that lines up with the trend below it.
2. **Inside a tile, three lines on fixed baselines**: a small upper-case muted
   label (11px), a large bold value (28px) on one shared baseline across the
   three tiles, and a 12px change line under it. The value dominates.
3. **The change is signed by colour and mark**: green with ▲ for a rise, red
   with ▼ for a fall, then the percentage to one decimal and "vs prior period".
   Orders fell (▼ 3.1%) and must read as a fall at a glance.
4. **Values in a compact spoken form**: `$1.42M`, `38.2k`, `$37.24`; never the
   raw integers, never cents for revenue.
5. **Hierarchy above the tiles**: a 20px semi-bold title at the top left, a 12px
   muted period line under it, both at the margin.

## Trend (twelve months)

6. **A small upper-case muted section label** ("REVENUE BY MONTH") above the
   bars, at the margin, in the same style as the tile labels.
7. **Bars fill the inner width**: twelve bars of equal width from margin to
   margin, a gap of roughly two fifths of a bar, sitting on one light baseline
   line at the margin's width; rounded tops.
8. **The best month stands out**: its bar is a darker shade of the one accent
   colour and its value is called out above it in the compact form (`$142.3k`,
   December). Every other bar is the accent colour.
9. **Months named under their bars**, 10px muted, centred, in order.
10. **One accent colour** (a blue) for the data, neutral greys for text and
    lines, a white card with a hairline rounded border; no legend, no
    gradients, no shadow, no gridlines.

A **major** gap is one a projector audience notices from the back of the room:
tiles that do not span the width or are unequal, values not on a shared
baseline, a change not coloured by sign, raw numbers, a missing title or
period, bars that do not fill the width or touch each other, the best month
not called out, months unnamed, a second data colour, or a wrong value. The
exact greys, the font family, a pixel here or there, and the letter-spacing
of labels are not gaps unless they break one of the ten points above.
