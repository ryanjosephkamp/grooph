# Gaps · Piece 1 · Card frame

Judged against Piece 1's cut only (PIECES.md:32-37): the reference's single
top-level element, the card clause of point 10 (REFERENCE.md:36-38), the card's
overall size, its font family, and the order of the `header` and `trend` groups.
The header and trend contents belong to Pieces 2 to 4 and are not judged here.

## Side by side, labels stripped, random order

- **Card P**: `<svg width="640" height="360" viewBox="0 0 640 360" font-family="Inter, Helvetica, Arial, sans-serif">`,
  then a top-level `rect x=0.5 y=0.5 w=639 h=359 rx=12 fill=#ffffff stroke=#e5e7eb`,
  then `header`, then `trend`.
- **Card Q**: `<svg width="640" height="360" viewBox="0 0 640 360" font-family="Inter, Helvetica, Arial, sans-serif">`,
  then a top-level `rect x=0.5 y=0.5 w=639 h=359 rx=11.5 fill=#ffffff stroke=#e5e7eb stroke-width=1`,
  then `header`, then `trend`.

(P is the reference: reference.svg:1-2, REFERENCE-CAPTURE.md:8. Q is the
current revision: captures/card.svg:1-2, captures/CAPTURE.md:8.)

**Which is better and why.** For this cut the two cards are effectively the
same. They have the same size and viewBox, the same font stack, a white fill, the
same hairline neutral-grey stroke, the same half-pixel inset so the 1px stroke
is not clipped, and the same document order (card, then header, then trend). P
is better only by a hair: its corner radius is a whole 12 where Q's is 11.5. No
one in the room would see the difference. No shadow, gradient, filter or other
decoration appears in Q (captures/card.svg:1-5; the fills in captures/CAPTURE.md:4
are only #ffffff and black, and black belongs to the unbuilt trend).

## Ranked gaps (none major)

1. **Corner radius 11.5 instead of 12** (minor). Shows at captures/card.svg:2
   (`rx="11.5" ry="11.5"`) and captures/CAPTURE.md:8, against reference.svg:2 and
   REFERENCE-CAPTURE.md:8 (`rx=12`). Closing it: set the card's radius to 12. The
   corners still read as gently rounded, and REFERENCE.md:45-46 rules out "a
   pixel here or there" as a gap.
2. **Redundant attributes on the card rect** (cosmetic). captures/card.svg:2
   carries `ry` and `stroke-width="1"`, which equal the defaults the reference
   leaves implicit (reference.svg:2). There is no visual effect. Closing it is
   optional: drop them.

## Acceptance check (PIECES.md:39-50)

- White top-level background over the whole card, outside `header` and `trend`.
  Met: captures/card.svg:2 sits before captures/card.svg:3 (`<g id="header">`);
  captures/CAPTURE.md:8 is "(top level)" with 639 by 359 from 0.5.
- Hairline neutral-grey border, gently rounded, stroke not clipped. Met:
  `stroke="#e5e7eb" stroke-width="1"` with a 0.5 inset and `rx=11.5`
  (captures/card.svg:2).
- No shadow, gradient, filter or decoration. Met: there is no `<defs>`, `filter`
  or gradient anywhere in captures/card.svg:1-5.
- Declared size, viewBox and one sans-serif family kept; `header` before `trend`.
  Met: captures/card.svg:1, :3 and :4.
- The capture shows the new top-level element first. Met: captures/CAPTURE.md:8,
  rendered from src/card.mjs (captures/CAPTURE.md:3).
- Not verifiable from this evidence: two conditions cannot be seen in the
  captures. One is the outer margin and inner width being defined once in
  `src/layout.mjs` or exported from the frame. The other is `npm test` passing.
  The lead should confirm them from the owner's report or the test run. The header
  text and bars still start at x=10 (captures/card.svg:3-4). That is expected
  because Pieces 2 and 3 have not been built, so it is not a gap of this piece.

verdict: pass
