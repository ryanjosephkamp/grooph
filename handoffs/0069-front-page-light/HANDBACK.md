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

Gzip, in units of 1,024 bytes. Times are the browser's own first contentful paint, the middle of seven cold visits at 400 px over HTTP/2 (`scripts/perf-loadtime.mjs`). "Main" is `c252d44`; "after" is the integration branch with this slice and slice 0062.

| | main | after |
|---|---|---|
| The front page's first load | 267.9 KB | **186.4 KB** |
| An address that draws on the canvas | 267.9 KB | 283.8 KB |
| Front page, painted, slow 4G (1.6 Mbps, 280 ms each way) | 2,036 ms | **1,660 ms** |
| Front page, painted, fast 4G (9 Mbps, 85 ms each way) | 504 ms | 452 ms |
| A template's address, painted, slow 4G | 2,052 ms | 2,136 ms |
| A template's address, painted, fast 4G | 528 ms | 508 ms |

A template's address is 84 ms later than main on the slow link: it loads 16 KB more than main does, which is everything the push added to the screens it shows. Slice 0070 takes that back.

## What went wrong on the way

**The clock.** The timing script first asked the test driver to wait for the heading and read the wall clock. The driver looks again at widening intervals, the last of them half a second, so on the slow link every time landed on a grid 500 ms apart: a page that showed at 1,630 ms read as 1,644 or as 2,128, by chance. The script now has the page note the moment for itself and reads the browser's paint time. Two things said from the old clock are withdrawn:

- That `lazy` with a `Suspense` cost a template's address 500 ms. It read 2,631 against 2,125; with that clock, it may have cost anything from a few milliseconds up. The plain loader is kept because an address that opens on one of these screens never shows an empty fallback with it, not because of that number.
- The times in handbacks 0058 and 0066 ("2,114 against 2,117", "2,615 before the fix") are from the same clock. The change they supported, asking for the app's files in one round, is sound on its own terms; the sizes of the effect are not known.

**The order of the stylesheets.** Splitting the bundle left the order of the app's stylesheets to the bundler, which put a screen's own sheet before the shared one it builds on. The live view's grid lost to the older one-column rule; its own test caught it when the two slices met. The build now fixes the order: React Flow's base, the shared sheet, then the screens' own.

## What an independent read found

A fresh subagent read the commit. Fixed:

1. **"Try again" could be a dead button.** A browser may remember a failed module fetch for the life of the page. The button now loads the page again, and nothing retries behind it.
2. **A blank page between screens**, from the front page to a template before the module had landed. It says "Opening…" now.
3. **The failure text showed during a retry that would succeed.** There is no retry now.
4. **A visit cut short could leave the offline cache without the screens**: a returning visitor, a new deploy, the page stored and the visit over before the screens were fetched. The service worker now reads the files a page names, in its tags and in its first script's lists, and fetches any it does not hold: at install, and whenever a page arrives from the network. A test reloads with scripts off and watches the worker do it; with the fetch taken out, the test fails.
5. **Every file was asked for twice** through the worker after the first visit. Once now.

Left: addresses that are not routes (`#/run`, `#/templates/`) are hinted as if they drew on the canvas, which costs an early fetch and nothing else.

## Verified

- `apps/web/e2e/landing.spec.ts`: a new test reads the browser's own timing: on the front page the screens are asked for after the app's module has arrived; at a template's address, before the entry script has.
- `apps/web/e2e/offline.spec.ts`: two new tests. One opens only the front page, finds every file of the app in the worker's cache the moment the worker is in control, cuts the network, and opens a template. The other is the one in point 4 above.
- The whole Playwright suite: 159 pass. Web unit tests: 58 pass. `node scripts/perf-budget.mjs --check`: inside every budget.

## Not verified

- On the live site: GitHub Pages' own timing, and Safari. `modulepreload` is in Safari since 17; an older one fetches the screens when the app asks, one round later.
- The throttled link is Chrome's emulation, on this Mac.
