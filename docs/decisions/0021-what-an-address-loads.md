# 0021 · An address loads what it shows, under a budget CI enforces

**Date:** 2026-10-04 · **Status:** accepted (the owner approved the merge, 2026-10-04; in 0.3.0) · **Deciders:** owner ("without hurting grooph's performance"), driver

## Context

The push of 2026-10-04 added a front page, a desktop layout, an embed, new map, live and run screens, and a set of document pages. The owner's one condition was that none of it cost speed. On `main` the app was one script: every address fetched the editor's canvas library and the compiler before it showed anything, and nothing measured what a change weighed.

## Decision

1. **A budget, checked in CI.** `scripts/perf-budget.mjs --check` weighs, gzipped, what the front page loads, what an address that draws on the canvas loads, what an embed loads, and times the CLI's cold start, against `scripts/perf-budget.json`. Raising a number is a decision made in a pull request that says why.
2. **An address loads what it shows.** The build makes five pieces: a small entry, the app (front page, library, template list), the screens that draw on the canvas, the compiler, and the embed. `index.html` tells the browser, before the entry runs, which pieces the address needs, so they arrive in one round.
   - The front page, the library and the template list load without the canvas library.
   - A graph, a template, a link, a run and the live view load the canvas screens beside the app, and wait for them before the first render, so nothing empty is shown.
   - The compiler is fetched when a person exports. The editor asks for it soon after it opens, so the Export panel seldom waits. A refusal is the validator's and never waits.
   - An embed loads neither the app nor the canvas.
3. **Core has two doors.** `packages/core/src/base.ts` is core without the compiler, and `index.ts` is that and the compiler. The app starts from `base.ts`. A bundler follows a file's imports whether or not their names are used, so the compiler had to be absent from the file the app starts from, not merely unused there.
4. **The service worker keeps what a page names.** It reads a page for the files in its tags and in its first script's lists, and fetches any it does not hold: at install, and whenever a page arrives from the network. The compiler is named in a list the browser does nothing with, for this reason. A first visit that saw only the front page can open a graph and export it with no network.
5. **The stylesheets load in a fixed order**: React Flow's base, the shared sheet, then the sheets screens keep beside their components. All of them load at every app address: they are 17 KB together, and one order on every screen is worth more than the 2 KB a split would save.
6. **Times are the browser's own.** `scripts/perf-loadtime.mjs` serves a build over HTTP/2 with gzip, throttles the link, and reports the browser's first contentful paint. It does not ask the test driver to wait for an element: that reads up to half a second late.
7. **The build fails if it stops splitting** where `vite.config.ts` expects, and the budget script fails without the build's list of routes. A page with no lists still works, and loads in more rounds than anyone measured.

## Measured

Gzip, in units of 1,024 bytes. Painted is first contentful paint, the middle of seven cold visits at 400 px. `main` is `c252d44`.

| | `main` | `integration/2026-10-04` |
|---|---|---|
| The front page's first load | 267.9 KB | 172.4 KB |
| A template's address | 267.9 KB | 270.0 KB |
| An embed | (none) | 125.1 KB |
| Front page painted, slow 4G (1.6 Mbps, 280 ms each way) | 2,032 ms | 1,584 ms |
| Front page painted, fast 4G (9 Mbps, 85 ms each way) | 512 ms | 436 ms |
| A template's address painted, slow 4G | 2,056 ms | 2,064 ms |
| A template's address painted, fast 4G | 528 ms | 504 ms |
| The CLI's cold start | 92 ms | 90 ms |

## Consequences

- A new screen that draws on the canvas goes in `apps/web/src/ui/screens.ts`. A new export of core goes in `base.ts` unless it needs the compiler.
- A new piece fetched on demand has to be named in the page (`vite.config.ts`, the `later` list), or a visit with no network will not have it.
- The budget has about 4% of room on each line. The next feature that needs more says so in its pull request.

## Not known

- GitHub Pages' own timing, and any browser but Chromium. The throttled link is Chrome's emulation on one Mac.
- In two timing runs, one of seven slow-link visits to a template's address painted about 240 ms late (2,300 ms). `main` showed none. Not explained.
