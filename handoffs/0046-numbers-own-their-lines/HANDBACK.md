# Handback 0046 · A number belongs to one line; the Operator's third answer; version 0.2.2

**Branch:** `slice/0046-numbers-own-their-lines` · **Date:** 2026-10-02 · **By:** the operator-round session (Opus 5.5) · **Spend:** none

The Operator built 0.2.1 and confirmed the three picture fixes and the "last seen" reading on its own test branch. It found one new thing, caused by one of those fixes: the wider ring of a two-digit number now covered the line on the next track, so ring 11 sat over the line 12 runs on, and it was harder to tell which line a number belongs to.

## What changed

- **A number stops its own line and no other.** The margin is drawn in three layers: the rings, then every line, then the numbers. An arc's own line stops at its ring and starts again beyond it. Every other line that runs behind a ring is drawn over it, unbroken. Before, a ring was painted over whatever was behind it, and a line broken by a ring reads as that ring's.
- **The ring of a two-digit number is as narrow as its digits allow** (about 17 units, from about 19.5), so it covers less of its neighbours' tracks.
- **Two numbers on neighbouring tracks keep clear ground between their rings**, so a pair does not read as one cluster.
- In the app, a ring and a number open their handoff, as the line does.
- **Version 0.2.2.** `docs/HANDBACK-operator.md` section 14: the third reply.

An arc too short to leave a gap (a session's handoff to itself) keeps its ring over its own line, as before.

## Verified

| Claim | How | Result |
|---|---|---|
| For the three sample maps: each arc's own line has a gap exactly at its ring; every ring is drawn before every line and every number after; a two-digit ring has room for its digits; numbers on neighbouring tracks are at least 19.9 units apart | `pnpm --filter @grooph/core test`, reading rings, lines and numbers back out of the SVG | passes |
| Looked at | the corrected sample's margin at three times size, in a wide font and a narrow one | 11 sits on its own dashed line with 10's and 12's lines running past its edges; 17 and 18, 14 and 15 likewise |
| Nothing else moved | `pnpm -r test`, Playwright, the install check | core 337, cli 90, web 58; 91 browser; passes at 0.2.2 |

## Not verified

- A real Linux machine: the Operator's next picture.
- The turn-end push in a real session. The Operator could not start a fresh cloud session on 2026-10-02 and will try it when it can.

## Decisions made here

- **Layers, not more room.** Giving each track room for a two-digit ring would take the width back from the cards, which is what 0.2.0 fixed. A ring that lets its neighbours' lines through costs nothing.
