# Handback 0056 · Embed and replay: a graph any page can show, and a run that plays

**Implementer:** Opus 5.5 (Claude Code, effort high) · **Branch:** `slice/0056-embed-and-replay` · **Head commit:** `618c74b` (code; this handback commits on top) · **Date:** 2026-10-04 · **Pull request:** [#35](https://github.com/ryanjosephkamp/grooph/pull/35)

## Status

`done`: all eight criteria are met, and two files outside the allowed list changed, both named under Deviations (one with the owner's approval in session).

## What changed

**core**
- `packages/core/src/replay.ts` (new): `replaySteps(notes, graph)` returns `{ steps, end }`. Step 0 is the graph before the run. Step k is `summarizeRun` over the first k notes, with the note, its focus (node, loop, edge or graph) and a one-line caption. `end` gives each entered loop's fired stop, the node where the run ended or halted, and a sentence. Also `STOP_KIND_WORDS`.
- `packages/core/src/index.ts`: one export line.
- `packages/core/test/replay.test.ts` (new): 7 tests. They use the heterogeneous-critic proving run and the `run-gate` and `run-nested` fixtures.

**web**
- `apps/web/src/ui/embed/` (new):
  - `EmbedApp.tsx`: the embed as a page.
  - `Embed.tsx`: chooses what to draw, sizes the picture to the frame, posts the height.
  - `Stage.tsx`: pan, pinch, wheel, tap and keyboard over core's SVG.
  - `decorate.ts`: names nodes, loops, sessions and handoffs for touch, keyboard and screen readers, and draws a run's state as `data-state` plus pills in words.
  - `Brief.tsx`: the brief panel.
  - `Replay.tsx`: play, previous and next step, scrubber, caption, loop chips.
  - `link.ts`: parses `#/embed?…` and builds the "Open in grooph" address.
- `apps/web/src/embed.css` (new): all rules scoped to `.gx…` or `html.gx-page`.
- `apps/web/src/main.tsx`: `#/embed` loads only `EmbedApp`; every other address loads the app, as before (see Deviations).
- `apps/web/src/App.tsx`: the `#/embed` route.
- `apps/web/e2e/embed.spec.ts` (new): 19 tests, plus 4 screenshot tests that run only with `GROOPH_SHOTS=1`.

**cli**
- `packages/cli/src/commands/embed.ts` (new): `embedCommand`, `EMBED_HELP`, `embedSrc`, `resizeScript`. Not wired into `index.ts` (lane 0057 owns it).
- `packages/cli/test/embed.test.ts` (new): 8 tests.

**docs and evidence**
- `docs/exports.md`: one new section, "Embedding: a graph in any page, and a run that plays".
- `handoffs/0056-embed-and-replay/`:
  - `demo.html`: two embeds, pasted exactly as `grooph embed` printed them.
  - `heterogeneous-critic.grooph-run.json`: the proving run as a bundle, for the demo.
  - `demo-{400,1200}-{light,dark}.png`: screenshots.

## Verified, and how

Command: `pnpm -r build && pnpm -r test && GROOPH_E2E_PORT=4320 pnpm --filter @grooph/web test:e2e`, run from cold at `618c74b`. Exit 0: core 344, web 58 and cli 108 tests pass; Playwright 111 passed, 66 skipped (screenshot specs that run on request). `scripts/test-install-local.sh` also passes.

1. **`#/embed`**: met.
   - It takes the `#/open` payload unchanged, as the e2e test asserts with the "Open in grooph" href.
   - There is no top bar, no Save, no "All graphs" link and no validation button.
   - It is tested for a graph, an operation map, a proposal set (its recommended candidate) and a run.
2. **Fits where it is put**: met.
   - In frames 320, 600 and 1200 px wide, with the resize script and without it: no page scroll in either direction, no bar or button overflowing, and no picture text outside the stage. The frame without the script uses the height `grooph embed` printed.
   - Themes: tested with the reader in light and dark mode, both with no theme and with the other theme forced (`?theme=`).
   - The body and the picture's background are transparent; with `frame=1` the root is opaque.
   - The script sizes only `iframe[data-grooph-embed]`, and only from the app's origin. The CLI test checks this by running the printed script in a VM.
3. **A reader can use it**: met.
   - Mouse: zoom buttons, drag, ctrl+wheel, Fit.
   - Touch: CDP pinch and one-finger pan; a tap opens a brief, a drag does not.
   - Keyboard: Enter on a focused node opens its brief, and Escape or Close shut it with focus returned.
   - Every control is checked for a name.
   - "Open in grooph" opens `…/grooph/#/open?d=<same payload>` in a new tab.
4. **`grooph embed`**: met.
   - It prints the `<iframe>`, then the script on a second line.
   - An e2e test calls `embedCommand` with `--base` set to the test server, sets the two lines as a page, and finds "Review loop" inside the frame. The frame's height is set by the script.
   - The CLI tests cover options, run folders and bundles, maps, and refusals (rule errors, bad `--height`, bad `--base`, missing file).
5. **Replay**: met. The proving run `experiments/patterns/heterogeneous-critic/run/runs/20260920-192538` plays to its end in e2e, and the test checks each stage:
   - the builder goes running, then passed;
   - the critic fails in round 0;
   - the loop chip goes "not entered", "round 0", "round 1", then "round 1 · bar passed";
   - the merge gate is halted and Done stays pending;
   - the end reads "Review stopped on bar passed in round 1. The run halted at Merge approval (a human gate).";
   - at the end, a node's brief shows "At this step: passed · round 1 · 2 dispatches".
   - `run=` works like `d=`.
6. **Light**: met.
   - **I chose core's `picture()` SVG, not React Flow.** The first load is **137.8 KB gzipped**:
     - the HTML page: 0.4;
     - the entry chunk (React): 67.6;
     - the embed chunk (with core): 67.2;
     - the embed stylesheet: 2.5.
   - The e2e test measures each response, fails above 200 KB, and asserts that neither the `App` chunk nor `styles.css` is fetched.
7. **Nothing breaks**: met. The full suite and the install check pass, and the offline test passes again (see Risks).
8. **Evidence**: met.
   - `demo.html` opens from the file system. Until the slice is deployed, its frames point at the published app, so for now open it with `?local`, with a local preview running.
   - The screenshots at 400 and 1200 px, light and dark, were made by `GROOPH_SHOTS=1 GROOPH_E2E_PORT=4320 pnpm --filter @grooph/web exec playwright test e2e/embed.spec.ts -g "demo page"`.

## Decisions made

- **The picture, not the canvas library.** It makes criterion 6 easy (137.8 KB), and the embed draws exactly what `grooph image` and the offline page draw. Pan, zoom and tap are about 280 lines in `Stage.tsx`.
- **Scaling the SVG through its own `width` and `height`, not a CSS `scale()`.** Under a CSS scale, headless Chromium drew the picture's text at scale 1 while its shapes scaled, so labels slid off their cards. This was seen at 1200 px and fixed in `ae3301a`.
- **Picture width follows the frame.** It is 300 to 600 units at up to 1.25 px per unit, so a wide frame gets wider cards rather than a poster.
- **Fixed-height frames shrink the picture to fit**, down to 55% of the width-fitted size, then let the reader drag. The CLI's default `--height` is the picture's height at 400 units plus the bars, so a frame without the script fits at phone and tablet widths.
- **Host-page scrolling wins while the whole picture is in view.** At that point `touch-action: pan-y` is set and a plain wheel passes through. Once zoomed in, the picture takes the gestures.
- **A run opens at its end unless `play=1`.** A static reader sees the result and the end sentence, and Play restarts from the beginning. Under reduced motion, `play=1` does not play and the run opens at its end.
- **`d=` is canonical; `run=` is accepted** because the brief names it. Both carry an ordinary share payload.
- **A proposal set embeds as one candidate** (`&c=`, else the recommended one, else the first). A side-by-side comparison does not fit a frame.
- **Replay steps live in core** as a pure function with tests. The app's run view had nothing to reuse, and web unit tests would have needed `apps/web/test/`, which is outside the list.
- **The frame `grooph embed` prints carries `referrerpolicy="no-referrer"`** and no `sandbox` attribute. A sandbox without `allow-same-origin` would make the app's module scripts cross-origin.
- **An independent read before the PR** (a fresh subagent, per the owner's standing preference) found no regression or security problem, plus one minor focus bug and five small risks. Fixed in `618c74b`:
  - the brief returns focus to the node it shows;
  - a drag starts from the view after a focus pan;
  - React Flow's stylesheet loads before the app's on the dev server too;
  - `play=1` under reduced motion opens at the end;
  - the height is posted again for host scripts that load late;
  - `Object.hasOwn` for a note's `stop`.

## Deviations

- **`apps/web/src/main.tsx` is outside the allowed list.** The owner approved it in session, when asked whether the embed could load without the whole app, which no allowed file could do (the app was one 261 KB chunk). It now does two things:
  - it imports `EmbedApp` for `#/embed`, and the app and its CSS for every other address;
  - once the service worker takes control, it fetches the page's `/assets/` again through it. Without this the offline test failed: the worker caches at install only what `index.html` names, and the app's chunks now load from code.
- **`apps/web/src/App.tsx` has four lines, not two:** the import, the `Route` union member, the parse line and the render line. TypeScript needs the first two for the other two.
- **`apps/web/src/ui/run/`** (the run view) is untouched, so a run "opened in the app" has no Replay button yet. The same replay opens at `#/embed?d=<run payload>`, inside or outside the app. A button in `RunView` linking there is a one-line follow-up in a file this slice could not touch.

## Risks and leftovers

- **The app's own first load is a little heavier and one round trip later.** Before: 261 KB of JS in one chunk. Now: entry 69.8 + App 134.3 + the chunk shared with the embed 69.7 = about 274 KB gzipped (Vite's figures), plus a dynamic import after the entry. The JS is spread over three chunks, so lane 0055's measure of the app's first load should be taken after this merges.
- **The service worker's warm-up runs only on `controllerchange`.** After a shift-reload with a worker installed, chunks new to that visit are cached only on the next normal visit. `public/sw.js` belongs to lane 0055; caching the chunks at install from a build manifest would be the thorough fix.
- **Wiring:** `grooph embed` is not reachable from the command line until the driver adds it to `packages/cli/src/index.ts` with `EMBED_HELP`. Suggested flags for `parseArgs`: `--theme`, `--height`, `--frame`, `--play`, `--base`.
- **The demo needs the deploy.** Until this merges and Pages deploys, `demo.html`'s frames load the published app, which falls back to the library. With `?local` (or `?local=<base>`) they load a local preview instead.
- **The CLI's default height uses a fixed replay-bar height (124 px).** On a narrow frame with several loops the chips wrap, so without the script such a frame can be slightly short, and the picture shrinks a little to fit.
- **`replaySteps` summarizes every prefix (O(n²)).** That is trivial for real runs (12 to 60 notes). A crafted payload near the share size cap could be slow, but nothing worse.
- **Not tried:** Safari, Firefox, a real phone, and screen-reader order inside the SVG. All browser tests are Chromium.
- **Merge order:** lane 0055 also adds one route line to `App.tsx`; the conflict should be trivial.

## Prompt to paste into the driver session

```text
Handback for slice 0056 is at handoffs/0056-embed-and-replay/HANDBACK.md on branch slice/0056-embed-and-replay (head 618c74b; pull request #35). Status: done. Please reconcile with the grooph-reconcile skill.
```
