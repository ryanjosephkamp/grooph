# Handback 0083 · The service worker across a release

**Implementer:** Opus 5.5, the house lane (the session that did 0081; assigned by the driver) · **Branch:** `slice/0083-the-worker-across-a-release` · **Head commit:** the commit that adds this file, on top of `ee24af1` · **Date:** 2026-10-04

## Status

`done`. The tests exist and pass in Chromium, WebKit and Firefox. Two of the three questions were real faults and are fixed in `apps/web/public/sw.js`, each with tests that fail on `main`. One was not real on `main`, and a test now keeps it so. Three things found on the way are not this slice's to fix and are listed for the driver.

## For the owner: what a visitor of 0.3.0 sees when the new look (#58) is deployed

Run with the real builds: 0.3.0 from its tag as the version the visitor has, #58 at `844308d` as the one deployed.

A tab they left open keeps working as the old version, export included, until they reload it. The next time they open grooph with a network they get the new look, whole: nothing it asks for fails, and eleven new files arrive, about 355 KB. After that visit it opens with no network, a template opens on the canvas and a graph exports. Their browser then holds both versions, about 2 MB where it held 1 MB.

One soft spot is real, and it belongs to the worker 0.3.0 shipped, which answers that first visit and which nothing deployed now can change. If the visit happens while the deploy is still arriving at the host, or the connection drops before every new file has come, and they then lose their network, the front page opens and the canvas does not, until their next visit with a network. From the release after this slice ships, the worker keeps the old version until the new one is whole, and that cannot happen.

In Safari's engine that same half-arrived visit has a second effect, seen in CI and not caused by the worker: see "Found, and not this slice's to fix", 2.

## The three questions

### 1. Does a visitor with the old version get the new one cleanly? Mostly yes; one fault was real.

| Test (`apps/web/e2e/release.spec.ts`) | On `main` | On the branch |
|---|---|---|
| The tab that was open keeps working, even for what it had not fetched yet (an export, after the deploy) | passes | passes |
| The next visit shows the new version, whole, and nothing it asks for fails | passes | passes |
| After that visit, with no network, the new version opens, a template opens on the canvas and a graph exports | passes | passes |
| The old tab still works after another tab has taken the new version, with the network and without | passes | passes |
| A release that changes the worker too: the new worker takes over the open tab, and nothing breaks | passes | passes |
| **A visit that could not fetch all of the new version still leaves one that opens with no network** | **fails**: `expect(locator).toBeVisible() failed … .react-flow__node[data-id="builder"]`; the page shows "This screen could not be fetched" | passes |
| Once the rest of the new version arrives, the next visit takes it, and it opens with no network (two runs: the late file is the compiler; the late file is the canvas screens) | passes | passes |
| **The site answers with an error where the app was: the app opens from the copy the worker holds** | **fails**: the 503 is shown in place of the app | passes |

**The fault.** `main`'s worker kept a page as the one to open with no network the moment it arrived, and fetched its files afterwards. When one of them could not be had (a deploy still reaching the host, a visit cut short), the kept page was a new one without its files, while the whole older version sat unused in the cache. **The fix:** a page becomes the kept page once every hashed file it names is held. Until then the page kept before stays.

Every test in the first block runs twice: with this version's worker as the one the visitor has, and with the worker 0.3.0 shipped (`apps/web/e2e/fixtures/sw-0.3.0.js`, a copy of that one file). The second run of the bold test is **marked as expected to fail**, with the reason beside it: the first visit after a deploy is answered by the worker the visitor already has.

### 2. Does a first visit on a slow link leave everything it needs? Yes on `main`. Not real.

| Test | On `main` | On the branch |
|---|---|---|
| A first visit on a slow link, to the front page | passes | passes |
| …to a template on the canvas | passes | passes |
| …to the front page, by someone who imports and exports before the worker is in control | passes | passes |
| The page names every file the app can ask for under `assets/`, and every file it names is there | passes | passes |

The link is the one `perf-loadtime.mjs` calls slow 4G (1.6 Mbit a second, 280 ms each way), shared by every answer. Each test records what the tab was still waiting for at the moment the worker took control: **nothing, in 50 of 50 visits** (20 each of the first two, 10 of the third), and once each in WebKit and Firefox.

**Why it is not real on `main`.** The worker fetches for itself, when it installs, every file the page names, and it takes control only after that. The page's re-asking in `main.tsx` is a second net. A file is at risk only if the app loads it from code, the page does not name it, and it is still arriving at that moment: the site lane's fonts were such files until it named them. On `main` the only files the page does not name are the embed's two (see finding 1 below). The last test in the table holds the rest of the build to being named.

`apps/web/src/main.tsx` is unchanged.

### 3. Does the cache only grow? Yes. Real, and fixed.

Bytes are what the cache keeps (the files as served, not gzipped). One tab, one release after another, each made from the same build with every hashed file renamed.

| After | On `main` | On the branch |
|---|---|---|
| Release 1 | 13 files, 979 KB | 13 files, 979 KB |
| Release 2 | 22 files, 1,950 KB | 23 files, 1,953 KB |
| Release 3 | 31 files, 2,921 KB | 23 files, 1,953 KB |

The newest page names 9 hashed files, 971 KB. The same figures came back from WebKit and Firefox in CI.

A visitor who arrives with what 0.3.0's worker kept, three versions here: 3,893 KB on the day this worker ships (nothing is dropped that day), 1,953 KB after the release that follows.

| Test | On `main` | On the branch |
|---|---|---|
| After two and after three releases: the newest two, not every one there has been | **fails** | passes |
| A tab left open two releases back is never left without its files; when it is the visit itself, they go | **fails** (the second half) | passes |
| A tab left open keeps its files even when the tab that took the new version is closed before the worker has finished | passes (nothing is dropped) | passes |
| A file the page does not name, the embed's own, is still there after the next visit, and with no network | passes (nothing is dropped) | passes |
| A script that asks for the page's own address does not replace either page the worker keeps | **fails** | passes |
| A visitor who came with three versions kept by 0.3.0's worker | **fails** | passes |

**What the worker does now.** It keeps the page it holds and the page it held before that one. When a visit brings a page, and the page that visit made is the only window there is, it drops the older builds of the files those two pages name (`App-<another hash>.js`). A file the pages do not name at all is left.

**How I know it does not drop a file an open tab may still ask for.**

- A tab that is open is a window, and nothing is dropped while there is any window but the page the visit made. That is the visit's own page by its id (`resultingClientId`), not a count: with a count, a visiting tab closed early left the old tab as "the only window", and its files went. I found that by reading my own change, wrote the test, and checked that the test fails with the count put back.
- A tab cannot be two pages behind without other tabs having fetched the pages in between while it was open, and they were windows then. The second test in the table walks exactly that: two releases taken by other tabs, the first tab untouched, then exporting with no network.
- Where a browser does not say which page a visit made, nothing is dropped. WebKit and Firefox do say: the cache tests pass in both.
- A worker that installs never drops anything.
- **What is not covered**, and is said in the worker's header: a page that is no window. A browser may keep a page for the Back button, or show it again from its own stale copy. Such a page is safe while it is one of the two pages kept, and not once two releases have gone by. The reviewer reproduced one such sequence in Chromium (Back to an address with a query, after two releases taken in another tab, with the files gone from the browser's own cache too).

## An independent read

Before this handback a fresh subagent (Opus 5.5) read the worker's change with the instruction to break the property above, and reproduced what it could with scratch scripts in Chromium. It found **no sequence in which an open, listed tab loses a file**. It found these, all acted on in commit `452a493`:

| Found | Done |
|---|---|
| Tidying dropped every hashed file the pages do not name, and the embed's two are such files: the front page's recorded run stopped playing with no network. A regression against `main`. | Only older builds of named files are dropped. A test holds the embed's files through a visit that tidies; it fails with the old rule. |
| Two visits a moment apart with a deploy between them could each tidy the other's files (by reasoning). | One page is kept at a time, and tidying reads the pages the cache holds. |
| "Nothing is dropped without `resultingClientId`" was false when no window was listed. | It is true now. |
| A script that asks for `./` or for the key the page-before is kept under wrote a kept page. | It no longer does; a test holds it. |
| The header said a page kept for Back is at most one page old. | Corrected. |
| A page that names a file the build lacks is never whole. | The naming test holds every named file to being in the build. |

That change then made a reload in one tab tidy only by luck (the page being left is still a window for a moment), which showed as one flaky test. The worker now waits up to two seconds for the page the visit made before it looks at the windows (`1c4c09c`); 96 of 96 after that.

## What changed

- `apps/web/public/sw.js`: 100 lines added, 14 removed. `hold()` says whether a page is whole; `keep()`, `tidy()`, `unhashed()`, `inTurn()` are new; a 5xx is answered with the copy held; a redirect or a 4xx is passed on as before.
- `apps/web/e2e/release.spec.ts` *new*: 26 tests.
- `apps/web/e2e/support-release.ts` *new*: releases made from one build, and the test's own site.
- `apps/web/e2e/fixtures/sw-0.3.0.js` *new*: the worker 0.3.0 shipped, byte for byte.
- `apps/web/playwright.config.ts`: `GROOPH_BROWSERS=1` also runs `release.spec.ts`, less its tests tagged `@chromium`.
- `docs/privacy.md`: one sentence, on what the worker keeps.
- `handoffs/0083-the-worker-across-a-release/HANDBACK.md` *new*.

Nothing else under `apps/web/src`, `index.html`, `vite.config.ts`, `packages/` or `scripts/perf-budget.json`. No dependency.

## Verified, and how

Run from cold on 2026-10-04 at `ee24af1`.

| Command | Observed |
|---|---|
| `pnpm -r build && pnpm -r test` | core 345, CLI 119, web 59, none failing |
| `GROOPH_E2E_PORT=4366 pnpm --filter @grooph/web test:e2e` | 192 passed, 107 skipped (the screenshot tests) |
| `… test:e2e release --repeat-each=4` | 96 passed |
| `… test:e2e release -g "slow link" --repeat-each=20` | 40 passed; arriving when the worker took control: nothing, 40 times |
| The same spec with `main`'s `sw.js` put in its place | 6 failed, 20 passed: the six in the tables above |
| `GROOPH_RELEASE_OLDER=<0.3.0's dist> GROOPH_RELEASE_NEWER=<#58's dist> … release -g "a new version is deployed"` | 7 passed, one of them the expected failure |
| The same, with this worker put into #58's build | 7 passed, the same one expected to fail |
| `node scripts/perf-budget.mjs --check` | exit 0, six lines ok, `perf-budget.json` is `main`'s |
| `node scripts/check-outside-addresses.mjs --check` | nothing is loaded from another host |
| `node scripts/perf-loadtime.mjs main=<main's dist> change=apps/web/dist` | fast 4G: 436 ms and 432 ms; slow 4G: 1,576 ms and 1,576 ms (ranges 1,572 to 1,780 and 1,564 to 1,792) |
| The built app against `main`'s | every hashed file and `index.html` are byte for byte the same; `sw.js` is 10.3 KB where it was 4.9 KB, and no first load fetches it before the page is up |
| CI at `ee24af1` | `build (22)`, `build (24)`, `web-e2e`, `web-browsers` all pass; `web-browsers`: 37 passed, 1 skipped |

**Success criteria.** The tests exist and pass on the branch, and each that covers a fix fails on `main`: met. The budget passes with no line raised and first load and paint are within noise: met. Every CI job passes: met.

**CI time.** `web-e2e` 3 min 3 s (2 min 17 s to 2 min 56 s before). `web-browsers` 1 min 45 s (1 min 12 s to 1 min 24 s before): its tests take 54 s where they took 18 s. The slow first visit is about 5 s in each engine, inside the brief's half minute; the rest is the release tests, which I chose to run in every engine because a worker's cache and windows are where engines differ.

**Not run locally:** WebKit and Firefox, as in 0081. They ran in CI, eight times, and the reviewer could not run them either.

## Found, and not this slice's to fix

1. **The page does not name the embed's two files** (`EmbedApp-*.js`, `EmbedApp-*.css`), and the app does ask for them: the front page's recorded run plays in a frame at `#/embed`. So the worker does not fetch them at install. On `main` and here: the run plays with no network only after it has been watched once with one, and a tab left open across a deploy cannot fetch them at all (the reviewer saw both answer 404). **It needs `apps/web/vite.config.ts`**: add `found.embed`'s files to the list the page carries for the worker (about 22 KB and 9 KB raw; the browser does nothing with that list, so no first load grows). Then take the exception out of the naming test in `release.spec.ts`.
2. **WebKit does not ask again for a script whose load failed once in the tab.** Seen in CI, with the request log in the test's diagnosis: after the canvas screens were refused once (the half-arrived deploy), the pages that followed in that tab never asked for them again, though the site had them and the worker held them, and the canvas said "This screen could not be fetched". Asking with `fetch()` and then importing worked. Answering the refusal as a failed fetch in place of a 503 changed nothing, so it is not the worker's to mend (tried in `452a493`, taken out in `ee24af1`). **It needs `apps/web/src/App.tsx`**, `loadScreens()`: it does not try again by design. I do not know how long WebKit remembers, or whether Safari on a phone does the same. The run that shows it is marked for WebKit in the test, with this account.
3. **An option that is the owner's.** The worker could answer every visit with the kept page until the new one is whole, and show the new version on the visit after. That closes the half-arrived window for good, online as well, in every engine. It also means a new version appears one visit later, which a person would notice.
4. **Each new file is fetched twice on the visit that brings a release**: once by the page, once by the worker for itself. So it was on `main`. The test's site forbids the browser's own cache; GitHub Pages lets a file be kept ten minutes, so on the live site the second is mostly answered from there. Not measured on the live site.
5. **#58's front page takes its poster from the documents** (`/grooph/docs/field-guide/poster.svg`), which the worker never keeps. With no network that picture is not there. I did not look at how the page shows that.
6. **GitHub Pages lets a browser keep the page itself for ten minutes**, so a deploy can take that long to show. Nothing to do with the worker; the tests forbid it so that what answers is the worker.

## Decisions made

1. **Two releases are made from one build**, by renaming every hashed file and stamping the page and each script with the release's name. Reason: no build is committed and none is made twice; a test can tell which release a page and each script it ran came from, which is what "no page made of two versions" needs.
2. **Two real builds can be named in the environment** (`GROOPH_RELEASE_OLDER`, `GROOPH_RELEASE_NEWER`). Reason: the driver asked for #58 as the newer version. A file both builds share under one name is left unstamped: a hashed name never changes its bytes, in a test either.
3. **A copy of 0.3.0's worker is kept as a fixture.** Reason: every visitor there is has that worker, and CI's checkout has no tags to take it from.
4. **Keep two pages, not one.** Reason: the page before is what a page kept for the Back button, or a navigation that was given up, is on.
5. **Drop only older builds of files the kept pages name.** Reason: nothing says a file the pages do not name is old. The cost: such files are never dropped, which today is the embed's two, 31 KB a release for someone who watches the run.
6. **A 5xx is answered with the copy held; a redirect and a 4xx are passed on.** Reason: a redirect is how a site says it has moved, and answering it from the cache would hold visitors at the old address.
7. **Nothing is dropped on the day this worker arrives.** Reason: it has not seen a page replaced, so nothing says which files are old. The release after cleans up.
8. **The release tests wait for the visit to be over** before they take the network away (the worker holds the files and the page's own fetch of the canvas screens has come in). Reason: cutting that fetch off half-way is another event.
9. **A failing release test prints a diagnosis**: the page's and the scripts' release, the two pages the worker keeps, the cache, what the page shows, and every script and page the tab asked for in order. Reason: it is how the WebKit finding was made, with no WebKit on this Mac.
10. **One sentence of `docs/privacy.md`** now says the worker keeps the version you have and the one before it, and drops older ones.

## Deviations

1. **`docs/privacy.md` is not in the brief's allowed list.** Its "Spec constraints" say the page changes in the same pull request when a fix changes what the worker keeps, and this one does.
2. **A throwaway branch was pushed**: `slice/0083-probe`, one commit (`main`'s worker under the new tests, for WebKit). Never a pull request. It can be deleted, with `slice/0081-browsers-probe`.
3. **Eight pushes were made, most of them to get WebKit's and Firefox's answers from CI**, since neither runs here. Each is a commit that says what it was for.
4. **The reviewer was a subagent of this session.** Opus 5.5, read-only, with scratch files outside the repository.

## Risks and leftovers

- **On the day this worker ships, the old one answers the first visit.** The half-arrived fault is there once more for every visitor who has 0.3.0. A test says so and is marked as expected to fail.
- **A page that is no window is protected for one release, not two** (above). The reviewer's fix for the case it reproduced costs a request on every Back; I did not take it.
- **The worker waits up to two seconds after a visit** before tidying. It holds no answer back: the page has its response already.
- **The diagnosis and the stamps are test code**; none of it is in the app.
- **A decision record may be wanted**: decision 0021, point 4, says the worker keeps what a page names. It now also says when a page becomes the kept one and which files go. That is the driver's.
- No TODO is left in the tree.

## Prompt to paste into the driver session

```text
Handback for slice 0083 is at handoffs/0083-the-worker-across-a-release/HANDBACK.md on branch slice/0083-the-worker-across-a-release (its pull request names it). Status: done. Two of the three questions were real and are fixed in apps/web/public/sw.js with tests that fail on main: a new version was kept before its files, and the cache only grew. A slow first visit is fine on main. Three things need files this lane may not touch: the page does not name the embed's files (vite.config.ts), WebKit never asks again for a script that failed once (App.tsx), and one option that is the owner's. Please reconcile with the grooph-reconcile skill.
```
