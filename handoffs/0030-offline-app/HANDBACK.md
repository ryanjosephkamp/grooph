# Handback 0030 · The installable offline app, and one more fix from the review

**Session:** Opus 5.5, driving and building (decision 0014) · **Branch:** `slice/0030-offline-app` (stacked on `slice/0029-live-map-handback`) · **Date:** 2026-09-30 · **Handoff:** the owner's brief, item 2 ("the installable offline app is a good follow-on if it's cheap") and item 1 (the ranked fixes)

## Status

`done`. It was cheap: one service worker file, a manifest, three icons, three lines of registration.

## What changed

- **`apps/web/public/`**: `sw.js`, `manifest.webmanifest`, `icon-192.png`, `icon-512.png`, `icon-maskable-512.png` (all new; the icons are the favicon drawn larger).
- **`apps/web/index.html`**, **`src/main.tsx`**: the manifest link, and the worker's registration in a built app only.
- **`apps/web/src/ui/canvas/OpeningView.tsx`**, `Canvas.tsx`, `Editor.tsx`, `editorContext.ts`: on a wide screen the view is chosen again for the room beside the panel, unless it was moved by hand.
- **`apps/web/playwright.config.ts`**: service workers are blocked in every spec but the offline one.
- **Tests**: `e2e/offline.spec.ts` (new), `e2e/layout.spec.ts`.
- **Docs**: `exports.md`, `review-2026-10.md`, `README.md`, `PLAN.md`, `PROGRESS.md`, `HANDBACK-operator.md` (the branch to use).

## Verified, and how

| Claim | How | Observed |
|---|---|---|
| Installable | `e2e/offline.spec.ts`, first test | a manifest with `display: standalone`, icons at 192 and 512 and a maskable one, each answering 200; a service worker in control of the page |
| Opens with no network | the second test: a graph imported online, then the network switched off, the address opened again | the library with that graph, the graph in the editor, its outline, and the templates, with no failed request; back online the page is fetched again |
| The refit | `e2e/layout.spec.ts`, wide-screen test | with a node's panel open at 1280 px every node is left of the panel; after a pan by hand the panel opens without changing the zoom; Fit puts the app back in charge |
| The other specs are unaffected | the whole suite | 85 browser tests pass |

## Decisions made

- **A hand-written worker, not a plugin.** Forty lines that can be read beat a build plugin for one page and two assets.
- **Network first for the page, cache first for hashed assets.** A new deploy is seen on the next visit with a network; offline falls back to what is there. Hashed files never change under their names.
- **Cached files are matched by address alone.** The preview server's `Vary` header hid a file cached at install from the page asking for it; found by the test.
- **`/api/` is never touched**, so `grooph watch` stays live.
- **The refit is for wide screens only**, and only for a view the app chose. A phone's sheet opens over the canvas, and the existing rule there (pan, never zoom) stands.

## Not verified, and assumed

- Not verified: installing on a real phone; Safari and Firefox; what a browser does with the cache after weeks. Chromium only.
- Assumed: that a cached copy of an older app is acceptable while offline. It is replaced on the next visit with a network.

## Risks and leftovers

- A service worker is sticky: a bug in one outlives a deploy until the new worker installs. This one calls `skipWaiting` and `clients.claim`, so a fixed version takes over on the next visit with a network.
- Still open from the review: back-edge labels over node names in the canvas, slivered glyphs in the templates list.
- Still open from stage 8: copy and paste, bulk spawn, groups.
