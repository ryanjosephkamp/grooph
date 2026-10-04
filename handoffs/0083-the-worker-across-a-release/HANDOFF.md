# Handoff 0083 · The service worker across a release

**Stage:** 24 · **Lane:** Opus 5.5 · **Effort:** extra high · **Browser tests on port:** 4366 · **Branch:** `slice/0083-the-worker-across-a-release` · **Drafted:** 2026-10-04 · **Confirmed by owner:** 2026-10-04 in general terms (his standing condition that nothing costs speed or breaks the app; "do them all" on the stack card). It is tests, and a fix only where a test shows one is needed, so it falls under decision 0023.

## Objective

The front page promises that grooph "opens offline after a first visit". The tests show that for one build. Nobody has shown what a visitor who already has grooph sees on the day a new version is deployed, and that day is coming: the site's new look (#58) changes the page, adds fonts and renames every hashed file.

Three things have been said and never tested:

1. **A visitor with the old version gets the new one cleanly.** The page is fetched from the network first and names new hashed files; the worker keeps the old ones too. Nobody has watched an old worker meet a new deploy: with the old tab still open, on the next visit, and with no network after it.
2. **A first visit leaves everything it needs.** The site lane saw its offline test fail once: the page re-asks, when the worker takes control, for what it had finished fetching, and a file still arriving at that moment was missed (`apps/web/src/main.tsx`, lines 25 to 41). It worked around it for its fonts by naming them in the page. Whether the same holds on `main` for a script or a style sheet on a slow link is unknown.
3. **The cache only grows.** It has one name, `grooph-app-v1`, and nothing removes a hashed file a later page no longer names. After ten releases a visitor holds ten copies of the app.

**Find out which of these are real, with tests that fail when they are. Fix what is small. Report what is not.**

## What to make

1. **A test of a release**, in `apps/web/e2e/`, in the manner of `smoke.spec.ts`'s offline visit (a server of the test's own, so the network can be taken away for real): serve an older build, visit with the worker allowed, replace what the server serves with a newer build, and then show each of these or show that it fails:
   - the tab that was open keeps working, including something it had not fetched yet (an export, which fetches the compiler);
   - the next visit shows the new version, with no request that fails and no page made of two versions;
   - with the server closed after that visit, the new version opens, and a template opens on the canvas.
   The two builds must differ as two real releases do: in their hashed file names. How the older one is made is your choice; do not commit a build.
2. **A test of a first visit on a slow link**: the files still arriving when the worker takes control. Run it enough times to trust it, in Chromium, and once each in WebKit and Firefox through the `web-browsers` job if it can be put in the smoke set without adding more than half a minute.
3. **A measure of the cache after two and after three releases**: how many files and bytes it holds, against what the newest page names.
4. **Fixes, each with a test that fails without it**, where the tests above show a real fault and the fix is small: in `apps/web/public/sw.js` and `apps/web/src/main.tsx`. If the worker should drop files no page names any more, it must never drop one an open tab from the older version may still ask for; say how you know it does not.

## Success criteria

- The tests above exist, pass on your branch, and each one that covers a fix fails on `main`.
- `node scripts/perf-budget.mjs --check` passes with no line raised, and the front page's first load and time to paint are within noise of `main` (`node scripts/perf-loadtime.mjs`, the browser's own clock).
- Every CI job passes.

## Read first

1. This file, then `AGENTS.md`
2. `apps/web/public/sw.js` (its header says what it does with each kind of address), `apps/web/src/main.tsx`, `apps/web/vite.config.ts` (the `routes()` plugin and the lists it writes into the page), `docs/decisions/0021-what-an-address-loads.md`
3. `apps/web/e2e/offline.spec.ts`, `apps/web/e2e/smoke.spec.ts`, `apps/web/e2e/keep.spec.ts`
4. `handoffs/0077-site-in-the-owners-style/HANDBACK.md` on its branch, "Risks and leftovers": "A first visit and the worker's cache"

## Allowed changes

`apps/web/e2e/**`; `apps/web/public/sw.js`; `apps/web/src/main.tsx`; `apps/web/playwright.config.ts`; `.github/workflows/ci.yml` only if a test needs a step; `handoffs/0083-the-worker-across-a-release/**`.

## Forbidden changes

Anything else under `apps/web/src/`, `apps/web/index.html` and `apps/web/vite.config.ts` (the site lane and the views lane have open work in them: if a fix needs one of those files, stop and tell the driver what it needs). `packages/**`. `scripts/perf-budget.json`. A new dependency. `docs/PLAN.md`, `docs/PROGRESS.md`. A change a visitor sees, other than the app no longer breaking.

## Spec constraints that apply here

Decision 0001: no backend; the worker stores grooph's own files and sends nothing. Decision 0021: an address loads what it shows. The privacy page (`docs/privacy.md`) says what the worker keeps: if a fix changes that, the page changes in the same pull request.

## Design already decided

Tests first, then fixes. A fix that is not small is a finding, with the test that shows it marked as expected to fail and the reason beside it.

## Implementer's choices

How the older build is made. Where the slow link is emulated. Whether the cache should be pruned at all.

## How to verify

```bash
pnpm -r build && pnpm -r test
GROOPH_E2E_PORT=4366 pnpm --filter @grooph/web test:e2e
node scripts/perf-budget.mjs --check && node scripts/check-outside-addresses.mjs --check
```

## Handback must contain

The `TEMPLATE-HANDBACK.md` sections, plus: for each of the three questions, whether it was real, with the test's output on `main` and on the branch; the cache's size after two and three releases, before and after; what happens to a visitor of 0.3.0 when #58 is deployed, said in one paragraph the owner can read.

## Prompt to paste

```text
You are a lane of grooph. Read handoffs/0083-the-worker-across-a-release/HANDOFF.md, then AGENTS.md and the files it lists, and do the slice on branch slice/0083-the-worker-across-a-release. Tests first, then fixes only where a test shows a fault and the fix is small. Browser tests on port 4366. Do not edit docs/PLAN.md or docs/PROGRESS.md. The driver session ("grooph opus operator") assigns and reviews your work and will message you; ask it, not me. Finish with the grooph-handback skill, open a pull request, and do not merge it.
```
