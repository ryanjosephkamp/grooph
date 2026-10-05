# 0028 · With the templates out of the first load, two limits come down to hold the gain

**Date:** 2026-10-05 · **Status:** accepted (the owner's choice on the review desk, 2026-10-05) · **Deciders:** owner

## Context

Decision 0021 set a budget CI enforces, and decision 0027 raised its line for an address that draws on the canvas to 280 KB. By the night of 2026-10-04 two lines were nearly full: the app's first load at 179.81 of 180 KB and the canvas line at 279.63 of 280. The next honest change anywhere in the app would have failed CI.

The owner was first asked whether to raise the lines. Before he answered, the site lane measured the first load file by file (slice 0093) and found the twenty built-in templates in it, as text, about 24 KB, read and checked by every address before anything was drawn. Pull request #102 moved them behind a door: a piece fetched by the screens that list or use templates, with the front page's picture and tiles made ahead of time and held to the templates by a test.

On CI, on `main` at `ab8a434`: the first load is 160.73 KB and an address that draws a graph or a share link is 258.14. A template's own address still fetches the templates, so #102 gave it a line of its own at the old canvas limit, 280, where it reads 279.12.

One path is slower, and the owner's standing condition is that nothing costs speed, so the merge was his: someone on a first visit over a slow phone link who presses Templates within about 0.7 seconds of the front page appearing waits up to 0.72 seconds for the list. Every measured address is otherwise level or faster by the browser's clock.

He was offered three ways: merge it and lower the two limits to hold the gain; merge it and leave the limits; or first ask for the templates in the first round at low priority, which trades part of the front page's gain for that wait. He chose the first.

## Decision

- The app's first load may weigh **164 KB** (was 180).
- An address that draws on the canvas may load **262 KB** (was 280).
- A template's own address keeps the line #102 gave it, **280 KB**.

The other lines of `scripts/perf-budget.json` are unchanged. Two of them, the scripts within the first load (162) and a first visit to the front page in all (224), are now looser than the first-load line lets them be reached; they were left because the owner was asked about two limits and answered about two.

## Consequences

- There are 3.27 KB of room on the first load and 3.86 on the canvas line. The 19 KB that were won cannot be spent again without the owner raising a line.
- The tight line is now a template's own address, with 0.88 KB of room: anything added to the canvas's screens counts there first.
- What is new still goes behind a door of its own, as decisions 0021 and 0027 say.
- Three further ways to take weight out are written into pull request #102 with their figures and were not started: the two stylesheets only a canvas uses, splitting the app's one sheet by screen, and core's one door.
- The slower path is known and accepted. If it is ever felt, the alternative above is still there.
