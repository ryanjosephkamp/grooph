# Handback 0043 · Three small things in the picture

**Branch:** `slice/0043-picture-small-things` (stacked on 0042) · **Date:** 2026-10-01 · **By:** the operator-round session (Opus 5.5) · **Spend:** none

The Operator's first picture on Linux since 0.2.0: nothing ran past its box or was cut short. It named three small things.

## What changed

- **A two-digit number has a wider ring.** 10 to 18 filled their circles edge to edge: a 14.4-unit circle around about 12.5 units of digits. A number of two digits is now in a pill wide enough for it, on its arc and at the head of its line in the list.
- **A number keeps clear of other arcs.** Badge 16 sat where handoff 17's line ran into a card, so it read as 17's. A number now avoids every other arc's level run where that run crosses its track, as well as other numbers, taking the nearest clear point to the middle of its upright; when the margin is too crowded for any, the point with the most room.
- **A card grows with its role**, a person's as a session's. A person's role was cut at eight lines and a session's at five. Both now run to twelve wrapped lines before anything is cut.

## Verified

| Claim | How | Result |
|---|---|---|
| For the three sample maps: every two-digit number has room for its digits; no number is within 9.5 units of another arc's line into a card where it crosses; no two numbers overlap | `pnpm --filter @grooph/core test`, reading every arc and badge back out of the SVG | passes |
| A long role is drawn whole in a person's card and a session's, and the card is as tall as its words | the same suite | passes |
| Looked at | both of the owner's maps redrawn | 16 sits on its own upright above 17's line; Ryan's role is whole |

## Not verified

- A real Linux machine, again: the Operator's next picture.
