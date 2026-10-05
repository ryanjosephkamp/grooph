# 0026 · What the service worker keeps across a release

**Date:** 2026-10-04 · **Status:** accepted by the driver under decision 0023 (a fix with tests, no visible effect), for the owner to overrule · **Deciders:** driver; the owner has one open option, below

## Context

The front page promises that grooph opens offline after a first visit. Decision 0021, point 4, says the worker keeps what a page names. Nobody had watched an old worker meet a new deploy. Slice 0083 did, with tests that serve one build and then another from a server of their own, and found:

1. **A fault.** A visit that could not fetch every new file (a deploy still arriving, a visit cut short) left a page that would not open its canvas offline, while the whole older version was still in the cache. The new page had replaced the old one before its files were held.
2. **Growth.** The cache had one name and nothing left it: 979 KB, 1,950 KB and 2,921 KB after one, two and three releases.
3. **Not a fault:** the race the site lane saw once. In 50 of 50 first visits on a slow link, and in WebKit and Firefox, nothing was still arriving when the worker took control.

## Decision

1. **A page becomes the one to open with no network only once every hashed file it names is held.** Until then the page kept before, whose files are all here, stays.
2. **The worker keeps the page it holds and the page before it, and drops older builds of the files those two name.** After three releases the cache holds two versions, 1,953 KB, not three.
3. **Nothing is dropped while any window but the visiting page exists**, when a worker installs, or where a browser does not say which page a visit made. A tab left open on an older version is a window. A file the pages do not name (the embed's own) is not known to be old and stays.
4. **A 5xx from the host is answered with the copy held.** A redirect or a "not found" is an answer and is passed on.

## What it does not cover

- **A page that is no window** (kept by a browser for the Back button, or shown again from its own stale copy) is safe for one release, not two.
- **The day this worker ships, the old one answers the first visit**, so 0.3.0's fault is there once more for every visitor who has 0.3.0. Nothing deployed now can change that.
- **The embed's files are not named by the page**, so a recorded run plays offline only once it has been watched with a network. On `main` before this slice too; it needs `vite.config.ts`.
- **WebKit never asks again for a script whose load failed once in a tab** (`loadScreens()` in `App.tsx`). The worker cannot undo it.
- **A first visit that loses a request.** A first visit has no page to fall back on, so its page is kept with whatever came. A file the worker could not fetch is then missing until the page itself asks for it with a network, or until the next visit that reaches one, which fetches it without the person doing anything. Until then the app opens, and the one screen that needs that file says so or goes without it. The worker fetched each named file once; since 2026-10-05 it tries a file that failed a second time, a second later, which mends one lost request and nothing longer (see Consequences).

## The owner's open option

Answer every visit with the kept version until the new one is whole, and show the new one on the visit after. It trades a slower arrival of each release for never showing a page whose files are still arriving. Not taken: today a visit with a network gets the new page at once, and only the offline copy waits.

## Consequences

- `apps/web/public/sw.js` only; the built app is otherwise byte for byte what it was. No budget line moves.
- `apps/web/e2e/release.spec.ts`: 26 tests, run in Chromium, WebKit and Firefox in CI. Six of them fail against the worker as it was.
- The privacy page says what is kept: the version you have and the one before it.
- **Later, 2026-10-05: a second try.** A named file whose fetch fails is tried once more a second later (`hold` in `sw.js`), then left as before. Point 1 is unchanged: a page still becomes the one to open with no network only once every hashed file it names is held, except on a first visit, where there is no other. Pages are still kept in the order they came, so a page that follows within that second is kept when the turn before it is over, up to a second later than it was; until then the page kept before is the offline copy. `release.spec.ts` gained a test in which the site loses one request for a piece no first screen asks for; it fails against the worker as it was.
- **Every later change that adds a file the app can ask for must name it in the page**, or the test that holds the build to that fails. The open pull requests that add files (the site's fonts, the views' piece, the agents lane's paste reader) meet that test when they merge `main`.
