# Handoff 0056 · Embed and replay: a graph any page can show, and a run that plays

**Stage:** 20 (pictures and sharing) · **Implementer:** Opus 5.5, effort high · **Branch:** `slice/0056-embed-and-replay` · **Drafted:** 2026-10-04 · **Confirmed by owner:** pending

## Objective

Anyone can put a live grooph graph in a web page with one line of HTML: a reader can pan it, zoom it and tap a node to read its brief, with no account and nothing to install. A recorded run can play on it, so a page can show a loop turning. The owner wants this in his blog post; it is also the demo on grooph's own front page.

## Success criteria

1. **`#/embed?…`** takes the same payload a share link carries (`#/open?…`). It shows the graph read-only with no app header, no save bar and no navigation. It works for a graph and for an operation map.
2. **It fits where it is put.**
   - Inside an `<iframe>` at 320, 600 and 1200 px wide there is no scrollbar and no clipped text.
   - `?theme=light`, `?theme=dark` and no theme (follows the reader's system) all work.
   - The background is the page's own (transparent) unless `?frame=1`.
   - It tells its parent its height with `postMessage`, so a six-line script can size the frame; without the script a fixed height still looks right.
3. **A reader can use it.**
   - Touch and mouse pan and zoom work.
   - Tap or Enter on a node opens its brief.
   - Escape closes the brief.
   - Every control has a name.
   - "Open in grooph" links to the full app with the same payload.
4. **`grooph embed <file> [--theme light|dark] [--height <px>]`** prints the `<iframe>` snippet and, on a second line, the resize script. A test opens the printed `src` and finds the graph's name on the page.
5. **Replay.** Given a run (a `.grooph-run.json`, as `#/embed?run=…` or opened in the app), there is a play button, a step button and a scrubber. Nodes light as the run reached them, a loop's round count ticks, and the end shows which stop ended the run. One of the proving runs under `experiments/patterns/` plays to its end in a test.
6. **Light.** The embed route's first load is at most 200 KB compressed. If the canvas library cannot meet that, draw the embed from core's `picture()` SVG and add pan, zoom and tap to it. Say which you chose and what it weighs.
7. **Nothing breaks.** `pnpm -r test`, Playwright and the install check pass; every existing route opens as before.
8. **Evidence.** `handoffs/0056-embed-and-replay/demo.html`: a plain page with two embeds, one static and one replay, that the owner can open from the file system. Screenshots at 400 and 1200 px.

## Read first

1. This file
2. `AGENTS.md`
3. `handoffs/briefs/plan-2026-10-04.md`: sections 1 and 3
4. `docs/executive.md` (share links), `docs/exports.md` (the picture, the offline page), `docs/runs.md` (run records and the monitor)
5. `apps/web/src/ui/open/`, `apps/web/src/ui/run/`, `packages/core/src/picture/`

## Allowed changes

`apps/web/src/ui/embed/**` (new), `apps/web/src/embed.css` (new), `apps/web/e2e/embed.spec.ts` and its fixtures (new), `packages/cli/src/commands/embed.ts` (new), `packages/cli/test/embed.test.ts` (new), `docs/exports.md` (one new section), `handoffs/0056-embed-and-replay/**`. In `apps/web/src/App.tsx`: one line in `parse()` and one render line for `#/embed`, nothing else. In `packages/core/src/**`: only a pure function that turns a run record into replay steps, with tests, if the app's run view has none you can reuse.

## Forbidden changes

- `apps/web/src/styles.css` (lane 0055 owns it: put your styles in `embed.css`).
- `packages/cli/src/index.ts` (lane 0057 owns it: export `embedCommand` and `EMBED_HELP` from your file, and the driver wires the command in when both lanes have landed).
- `packages/cli/hooks/**`.
- The share payload's format: an old link must open in the new app, and a new embed link must be an ordinary share payload.
- `spec/**`.

## Spec constraints that apply here

- Document first: the embed is a projection of the document it is given. It never edits and never stores.
- No LLM calls and no network beyond loading the app's own files. Nothing about the reader is sent anywhere.

## Design already decided

- One line of HTML is the product: `<iframe src="https://ryanjosephkamp.github.io/grooph/#/embed?…" …>`. A web component and an npm package are later.
- The payload rides in the URL fragment, so the host page's server never sees the graph.

## Implementer's choices

Canvas library or picture for the embed (criterion 6 decides), the replay's controls and timing, how a map is shown.

## How to verify

`pnpm -r build && pnpm -r test && GROOPH_E2E_PORT=4320 pnpm --filter @grooph/web test:e2e`, then open `handoffs/0056-embed-and-replay/demo.html` in a browser.

## Stop rules

Hand back when the criteria are met. Also stop and hand back with what is left if:
- you have worked about nine hours;
- the same check has failed three times;
- you need a file outside the allowed list;
- the owner says "save point": commit, push, write your exact next step in `HANDBACK.md`, stop.

If time runs short, criteria 1 to 4 are the slice. Replay may hand back as a second slice.

## Prompt to paste

```text
You are an implementer for grooph. Read handoffs/0056-embed-and-replay/HANDOFF.md first, then the files it lists. Stay inside its allowed changes. Work on branch slice/0056-embed-and-replay, commit often, push, open a pull request against main, and finish with the grooph-handback skill. Do not merge.
```
