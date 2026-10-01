# Handback 0038 · The picture fits its words, on any machine

**Branch:** `slice/0038-picture-fits` (stacked on 0037) · **Date:** 2026-10-01 · **By:** the operator-round session (Opus 5.5) · **Spend:** none

Two things the Operator found in 0.1.0: text clipped at the right edge of a picture drawn on Linux, with names cut short beside their badges; and a card whose role stopped at three lines though the card had room.

## What changed

- **Text is measured for the widest font a picture is likely to meet.** The measure assumed something like Arial. A Linux machine with nothing else draws `sans-serif` in DejaVu Sans, about a tenth wider (a fifth, in bold), so a line said to fit ran past its box. `textWidth` now uses a table of each character's advance, the wider of Verdana and Arial, with three per cent on top. On a Mac or a phone a line ends a little short; on Linux it fits.
- **A map's cards keep their width.** Each handoff has a track in the margin, and a map with one hub has a track per handoff: with eighteen, the cards were about 110 units wide of 400. The tracks now close up (from 13 units apart down to 6.5) so the cards keep at least 56% of the lane's inner width: about 200 units for that map.
- **Words wrap instead of being cut.** A session's name, a lane's name, a model and the lines of the handoff list go onto a second line. The harness and the model share a line when they fit, and have one each when they do not. A role has five lines, and as many more as fit when the card is tall because many arcs end on it.

## Verified

| Claim | How | Result |
|---|---|---|
| The measure is at least a wide font's real width, and at most 6% over | `pnpm --filter @grooph/core test`: eight strings against widths read from Verdana with a font tool | passes |
| The corrected sample keeps its words | the same suite: every card at least 56% of the lane; "Splashery lanes", "Cloud, account B", both model names whole; no line ending in an ellipsis; the Operator's role all there | passes |
| Seen in a wide font and a narrow one | the sample rendered with only Verdana loaded, and with only Arial, and looked at | nothing past its box in either; a graph picture checked the same way |
| Nothing else moved | `pnpm -r test`, Playwright | core 327, cli 83, web 58; 89 browser |

## Not verified

- A real Linux machine. The wide font was simulated on the Mac with Verdana, which is about as wide as DejaVu Sans. The Operator's next picture is the test.
- More than about twenty handoffs through one hub: the tracks stop closing at 6.5 units and the cards narrow again.

## Decisions made here

- **Measure wide rather than ship a font.** Bundling a font would make the PNG the same everywhere, and do nothing for the SVG a browser draws. Measuring for the widest font costs some slack on narrow ones and works for both.
