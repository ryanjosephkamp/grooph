# Handback 0069 · The front page loads without the canvas

**Branch:** `slice/0069-front-page-light` (on the integration branch) · **Date:** 2026-10-04 · **By:** the driver session (Opus 5.5) · **Spend:** none

The canvas library (React Flow and the d3 modules under it) is over half the app's script, and three screens never draw on it: the front page, the library and the template list. They loaded it anyway, before showing anything.

## What changed

- **The screens that draw on the canvas are one module** (`apps/web/src/ui/screens.ts`: the editor, the viewer for a link, a template and its form, a run, the live view), fetched when an address first needs one. `App.tsx` holds it behind a plain loader, not `lazy`.
- **`index.html` asks for it beside the app** when the address opens on one of those screens (`#/g/…`, `#/open?…`, `#/run…`, `#/live`, `#/templates/<source>/<id>`), so such an address loads what it loaded before, in the same round. `main.tsx` waits for it before the first render there, and nothing empty is ever shown.
- **Any other address fetches it once its first screen is up**, so the next screen opens at once, and the service worker keeps it. `main.tsx` asks for the app's files again through the worker once more after the screens arrive: without that, a first visit that saw only the front page could have gone offline without them.
- **A fetch that fails says so**, with "Try again" and a way back to the library, and is tried again the next time a screen needs it.
- **The budget weighs two addresses now** (`scripts/perf-budget.mjs`, `dist/routes.json`): the front page, and an address that draws on the canvas. The front page's budget came down from 285 to 195 KB.
- **`scripts/perf-loadtime.mjs` serves HTTP/2**, as GitHub Pages does, and takes `--at <address> --until <selector>` to time an address other than the front page.

## Measured

Gzip, in units of 1,024 bytes, and the middle of seven cold visits at 400 px (`scripts/perf-loadtime.mjs`, HTTP/2). "Main" is `c252d44`.

| | main | before this slice | after |
|---|---|---|---|
| The front page's first load | 267.9 KB | 278.0 KB | **184.3 KB** |
| An address that draws on the canvas | 267.9 KB | 278.0 KB | 279.8 KB |
| Front page, first heading, slow 4G (1.6 Mbps, 280 ms) | 2,124 ms | 2,114 ms | **1,644 ms** |
| Front page, first heading, fast 4G (9 Mbps, 85 ms) | 912 ms | 916 ms | 918 ms |
| A template's address, first node drawn, slow 4G | 2,123 ms | not measured | 2,125 ms |
| A template's address, first node drawn, fast 4G | 915 ms | not measured | 915 ms |

On the fast link the page is bound by its three rounds, not its bytes, so it does not move.

## What went wrong on the way

The first version put the screens behind React's `lazy` and a `Suspense` with an empty fallback. A template's address then showed its first node 500 ms later on the slow link (2,631 ms against 2,125), though every file had arrived at the same moment as before. React holds back content that resolves shortly after it has shown a fallback, so that fallbacks do not flicker. The loader in `App.tsx` and the wait in `main.tsx` replace it; the comment in `App.tsx` says why.

## Verified

- `apps/web/e2e/landing.spec.ts`: a new test reads the browser's own timing: on the front page the screens are asked for after the app's module has arrived; at a template's address, before the entry script has.
- `apps/web/e2e/offline.spec.ts`: a new test opens only the front page, waits for the worker to hold the screens, cuts the network, and opens a template. Both new tests passed twelve times in a row.
- The whole Playwright suite: 150 pass. Web unit tests: 58 pass. `node scripts/perf-budget.mjs --check`: inside every budget.

## Not verified

- On the live site: GitHub Pages' own timing, and Safari. `modulepreload` is in Safari since 17; an older one fetches the screens when the app asks, one round later, as any browser did before slice 0066.
- One of the seven slow-link visits to a template's address took 2,640 ms in one run of the timing, and none did in eight more visits. Not explained.
