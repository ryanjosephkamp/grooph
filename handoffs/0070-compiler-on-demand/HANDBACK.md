# Handback 0070 · The compiler loads when a person exports

**Branch:** `slice/0070-compiler-on-demand` (on the integration branch) · **Date:** 2026-10-04 · **By:** the driver session (Opus 5.5) · **Spend:** none

After slice 0069 an address that draws on the canvas loaded 283.8 KB, 16 KB more than `main`, and painted 84 ms later than `main` on a slow link. The compiler was 14.6 KB of every address's load, an embed's included, and is used only when a person opens the Export panel.

## What changed

- **Core has two doors.** `packages/core/src/base.ts` holds every export but the compiler; `index.ts` is `base.ts` and the compiler, so the CLI and everything else see what they saw. The app's alias for `@grooph/core` points at `base.ts`, and `@grooph/core/compile` at the compiler.
- **`apps/web/src/doc/exportPackage.ts` fetches the compiler** (`loadCompiler`). `attemptExport` refuses from the validator alone, as before and with the same list; for a graph that validates it answers once the compiler is here.
- **The Export panel** says "Preparing the package…" until then, and offers the graph's own file and the things to keep meanwhile. The editor asks for the compiler 1.2 s after it opens, so the panel seldom waits.
- **The page names the compiler** in a list the browser does nothing with, and the service worker keeps what a page names. So export works with no network after a visit that never opened the editor.
- **The build fails if it stops splitting** where `vite.config.ts` expects. My first attempt left the compiler where it was (the app still started from a file that imports it), the build's plugin found no chunk for it and quietly wrote a page with no lists at all, and the budget script then weighed only the entry script and passed at 68 KB. Both now stop with a message.
- Decision 0021 records the whole approach to what an address loads.

## Measured

| | `main` | before this slice | after |
|---|---|---|---|
| The front page's first load | 267.9 KB | 186.4 KB | **172.4 KB** |
| A template's address | 267.9 KB | 283.8 KB | **270.0 KB** |
| An embed | (none) | 139.2 KB | **125.1 KB** |
| Front page painted, slow 4G | 2,032 ms | 1,660 ms | **1,584 ms** |
| A template's address painted, slow 4G | 2,056 ms | 2,136 ms | **2,064 ms** |
| Front page painted, fast 4G | 512 ms | 452 ms | 436 ms |
| A template's address painted, fast 4G | 528 ms | 508 ms | 504 ms |

Budgets are now 180 KB for the front page, 276 for an address that draws on the canvas, 132 for an embed.

## Verified

- Core 344, CLI 118, web 59 unit tests. The web test for export now also checks the answer before the compiler has arrived.
- Playwright: 160 pass. New in `offline.spec.ts`: after a visit that saw only the front page, with no network, a graph is imported and its package downloads. New in `landing.spec.ts`: neither the front page nor a template's address fetches the compiler.
- Every check CI runs, run here: the golden packages, the pattern index, the field guide, the rule reference, the community index, the site pages, the budget, the first-run script, the install script.

## Not verified

- No independent read of this slice. It is small, and its risk is in the export path, which the byte-for-byte package tests cover.
- One of seven slow-link visits to a template's address painted about 240 ms late in two timing runs. `main` showed none. Not explained.
