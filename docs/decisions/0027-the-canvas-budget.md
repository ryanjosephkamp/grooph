# 0027 · An address that draws on the canvas may load 280 KB, and the budget is compared to the byte

**Date:** 2026-10-04 · **Status:** accepted (the owner's choice, 2026-10-04, in the driver's session) · **Deciders:** owner

## Context

Decision 0021 set a budget CI enforces. Its line for an address that draws on the canvas was 276 KB, with 6 KB of room when it was set. On 2026-10-04 the site's new look (#58, the owner's request) used 5.2 KB of that room. The two new views of a map (#65) added 0.7 KB, behind a door that keeps the rest out, and a template's address came to 276.041 KB.

The check passed it. It rounded each figure to one decimal before comparing, printed "ok 276 of 276", and exited 0. The views lane saw the unrounded figure and raised nothing.

The owner was offered three ways: raise the line and make the check exact; keep 276 and make the shared code terser to win back 100 bytes; keep 276 with an exact check and decide case by case. He chose the first.

## Decision

1. **The canvas line is 280 KB.** No other line changes.
2. **Every line is compared on the unrounded figure** and printed to two decimals, with a test that a figure three bytes over fails.
3. **280 is the hard line.** What is new still goes behind a door: an address loads what it shows (decision 0021). A lane that would go over raises nothing and says what it measured; raising a line is the owner's decision, written in the pull request with the reason.

## Consequences

- At the time of writing a template's address is 276.04 of 280. The agents lane's paste reader takes it to 277.24, and the first piece of subgroophs adds about 0.5.
- The tightest lines are now the app's first load (179.33 of 180 with the paste reader) and styles (19.91 of 20: the next 90 bytes of CSS anywhere fail). The theme switch and the 3D view are briefed to cost nothing until they are chosen.
- Decision 0021's count of pieces is out of date (six pieces, three doors); `docs/exports.md` has the current count.
