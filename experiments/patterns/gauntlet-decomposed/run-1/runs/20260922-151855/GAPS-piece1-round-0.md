# GAPS · Piece 1 · Card frame

Judged: `captures/card.svg` + `captures/CAPTURE.md` (rendered 2026-09-22T15:23:20Z, sha256 9981aae3c695, CAPTURE.md:3) against the reference's frame cut (PIECES.md:18–40).

## Side by side, labels stripped, random order

Two frames, A and B, each reduced to their first element and the `<svg>` line:

- A: `<rect x="0.5" y="0.5" width="639" height="359" rx="12" fill="#ffffff" stroke="#e5e7eb"/>` — first child of an `<svg … width="640" height="360" viewBox="0 0 640 360" font-family="Inter, Helvetica, Arial, sans-serif">`, followed by `<g id="header">` then `<g id="trend">`.
- B: `<rect x="0.5" y="0.5" width="639" height="359" rx="12" fill="#ffffff" stroke="#e5e7eb"/>` — first child of an `<svg … width="640" height="360" viewBox="0 0 640 360" font-family="Inter, Helvetica, Arial, sans-serif">`, followed by `<g id="header">` then `<g id="trend">`.

**Which is better:** neither — for this piece they are indistinguishable. A is the reference (reference.svg:1–2), B is the revision (captures/card.svg:1–2); the frame line is byte-identical and the capture rows are identical (`(top level) · rect x=0.5 y=0.5 w=639 h=359 rx=12 fill=#ffffff stroke=#e5e7eb`, REFERENCE-CAPTURE.md:8 vs CAPTURE.md:8). The white rounded panel with a 1px hairline border, inset half a pixel so the stroke stays crisp, is what REFERENCE.md:37–38 asks for ("a white card with a hairline rounded border") and the revision has it.

## Acceptance, item by item (PIECES.md:34–38)

| condition | evidence | result |
|---|---|---|
| First listed element is exactly the top-level rect (0.5, 0.5, 639 × 359, rx 12, fill `#ffffff`, stroke `#e5e7eb`) | CAPTURE.md:8 equals REFERENCE-CAPTURE.md:8 verbatim; card.svg:2 equals reference.svg:2 verbatim; no `stroke-width` attribute (card.svg:2) | met |
| It is the only top-level element | CAPTURE.md:9–25 are all `header ·` or `trend ·` rows; card.svg:3–4 are the two groups, card.svg:5 is `</svg>` | met |
| `<svg>` still declares 640 × 360, viewBox, font-family | card.svg:1 = `width="640" height="360" viewBox="0 0 640 360" font-family="Inter, Helvetica, Arial, sans-serif"`; CAPTURE.md:4 reports 640 × 360 | met |
| Groups `header` then `trend` follow in that order | card.svg:3 `<g id="header">`, card.svg:4 `<g id="trend">` | met |
| Document order: svg, rect, header, trend, `</svg>`, trailing newline; rect on its own line | card.svg:1–5, file ends with a newline (line 6 empty) | met |
| `npm test` passes | not in the evidence handed to me (no test output in captures/); I could not run it — lead's gate to confirm | unverified by critic |

## Ranked gaps (Piece 1 scope only)

None. No gap within the frame cut, major or minor.

Out of scope for this piece, noted only so the lead does not lose them: the header (CAPTURE.md:9–13: 10px margin, no fills, raw integers) and the trend (CAPTURE.md:14–25: 18px black bars at 10px pitch, no baseline, no labels) do not yet match REFERENCE-CAPTURE.md:9–49. Those belong to Piece 2 and Piece 3 and do not count against Piece 1 (PIECES.md:5: "Nothing in a later piece is needed to judge an earlier one").

## Verdict

verdict: pass
