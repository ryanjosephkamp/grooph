# Handback 0029 · The live map, and the handback to the Operator

**Session:** Opus 5.5, driving and building (decision 0014) · **Branch:** `slice/0029-live-map-handback` (stacked on `slice/0028-mcp`) · **Date:** 2026-09-30 · **Handoff:** the owner's brief, "The handback"

## Status

`done`. [`docs/HANDBACK-operator.md`](../../docs/HANDBACK-operator.md) is written, and the one piece it needed that did not exist, hook state drawn on an operation map, is built.

## What changed

- **`packages/core`**: `mapLive`, `mapLiveLine` (`events.ts`); `mapPicture(map, { live, at })`; `offlinePage(map, { live, at })`; `LiveView.map`.
- **`packages/cli`**: `grooph image` and `grooph page` take `--events <session id>=<source>` for a map; `grooph watch --map <file>`.
- **`apps/web`**: the sessions screen draws the map above the sessions when the server sends one.
- **Tests**: `core/test/map.test.ts`, `cli/test/keep.test.ts`, `cli/test/runs.test.ts`, `web/e2e/live.spec.ts`.
- **Docs**: `HANDBACK-operator.md` (new); `operation-map.md` §4b and §7; `subagents.md` §6; `AGENTS.md`; `PLAN.md`; `PROGRESS.md`.

## Verified, and how

| Claim | How | Observed |
|---|---|---|
| A source named for a map session marks that session and no other | `core/test/map.test.ts`, last test | three of seven sessions marked from three sources; the map document byte for byte unchanged |
| The CLI draws it, and refuses a source with no session to belong to | `cli/test/keep.test.ts`, last test; the PNG of the sample with three sources, looked at | working, ended and unmarked cards as expected; the refusal lists the map's session ids |
| `watch --map` sends the map with the sessions, re-read each time | `cli/test/runs.test.ts` | holds; a map that stops parsing is dropped and the sessions still served |
| The screen draws it | `web/e2e/live.spec.ts`, last test | the operator's card reads "working · 1 running, 1 done" |
| The handback's install recipe works from nothing | a fresh clone of this branch in a scratch folder: `pnpm install --frozen-lockfile && pnpm -r build`, then `--version`, `validate`, `image --out x.png`, `page`, `hooks install`, `sessions` | see the commit that follows this file; each command did what the page says |
| Everything | `pnpm -r build && pnpm -r test && pnpm --filter @grooph/web test:e2e` | core 323, cli 82, web 54, browser 82: all pass |

## Decisions made

- **The binding is a name on the command line, not a field in the map.** The map stays a description with no state, and A-011 stays as written. The cost is that a wrong name lights the wrong card; the handback says so.
- **Snapshots for the Operator, a server for the Mac.** A cloud session cannot be reached by a phone, so `image` and `page` take the events and write a file to send. `watch --map` is for a machine with a browser.
- **The handback is addressed to an agent**, with commands it can run and limits it can check, and says plainly that nothing was tried in a cloud session.

## Not verified, and assumed

- Not verified: any of it in a cloud session. The Operator is the first to try.
- Assumed: that lanes can be asked to commit `.grooph/events/`. If they cannot, the Operator sees only its own subagents.

## Risks and leftovers

- No tag yet: `v0.1.0` is cut when the six pull requests are merged.
- Open from the review: refit on a wide screen, back-edge labels over node names in the canvas, slivered glyphs.
- Not built this round: the installable offline app (stage 8); a saved layout for a map; the Codex compile target and study two, which wait for the owner's word.
