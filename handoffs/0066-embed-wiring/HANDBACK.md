# Handback 0066 · The embed wired in, at no cost to the app's speed

**Branch:** `slice/0066-embed-wiring` (on lanes 0055, 0056 and 0057 together) · **Date:** 2026-10-04 · **By:** the driver session (Opus 5.5) · **Spend:** none

Lane 0056 left two things for the driver, and merging the three lanes showed a third.

## What changed

- **`grooph embed` is a command.** `packages/cli/src/index.ts` dispatches it, the overview lists it under Share (40 lines, limit 45), and `grooph embed --help` prints its page. A test covers it, a wrong `--theme`, and a typo's suggestion.
- **The app does not carry the embed.** Lane 0056 split the bundle so an embed loads only its own part. But `App.tsx` imported the embed directly, so every visit to the app fetched the embed's code too. The app now fetches it only when a route asks for it.
- **The app's first visit takes as long as before.** After the split the entry was small and fetched the app's scripts and its two stylesheets by code, the stylesheets one after the other. On a slow link that showed the first heading half a second later than `main`. A build step (`apps/web/vite.config.ts`) now has the page name the app's scripts and styles before the entry runs, and writes `dist/routes.json`.
- **The budget weighs each route**, from `routes.json`. `scripts/perf-loadtime.mjs` times a first visit on a throttled link for any builds you give it.

## Measured

Time to the first heading, the middle of seven cold visits, served gzip:

| Link | `main` | lanes merged, before this | after this |
|---|---|---|---|
| Fast 4G (9 Mbps, 85 ms) | 906 ms | 912 ms | 916 ms |
| Slow 4G (1.6 Mbps, 280 ms) | 2,113 ms | 2,615 ms | 2,114 ms |

Weight, gzip:

| | `main` | after this | Budget |
|---|---|---|---|
| The app's first load | 267.9 KB | 275.1 KB | 285 |
| An embed's first load | (no embed) | 139.1 KB | 150 |
| The CLI's cold start | 92 ms | 94 ms | 250 |

The app is 7.2 KB heavier than `main` (2.7 percent): the front page accounts for about 3, and the split and the embed's shared code for about 4. It is not slower to its first heading on either link.

## A budget raised, and why

`entryJsKB` went from 262 to 266. The split costs about 4 KB of scripts on the app's route (chunk boundaries and the loader). In return an embed loads 139 KB instead of the whole app.

## Verified

`pnpm -r build && pnpm -r test`: core 344, cli 118, web 58. Playwright: 124 passed (the offline test, the embed's weight test and the front page's load test among them). `node scripts/perf-budget.mjs --check` passes.

## Not verified

The timings are on this Mac with Chrome's throttling, not on a phone on a real network.
