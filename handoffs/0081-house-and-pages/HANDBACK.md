# Handback 0081 · The house in order, and the pages the site is missing

**Implementer:** Opus 5.5, the house lane (a session the owner started; assigned and run by the driver) · **Branch:** `slice/0081-house-and-pages` holds this file only; each item has a branch and a pull request of its own, listed below · **Head commit:** the commit that last changed this file (the first version merged with #55; this one is in #56) · **Date:** 2026-10-04

## Status

`done`. All seven items are up as eight pull requests. Six are merged. #52 was corrected after the driver's read (one bullet of the privacy page was not true as written; see below) and waits for the driver's merge. #54, the FAQ, waits for the owner and the audit lane.

## The seven items, the pull requests and their state

| Item | Pull request | Branch | State when this was written |
|---|---|---|---|
| 1. The progress page's history in its own file | [#48](https://github.com/ryanjosephkamp/grooph/pull/48) | `slice/0081-history` | merged, `78dfd16` |
| 2. A size rule for pictures | [#47](https://github.com/ryanjosephkamp/grooph/pull/47) | `slice/0081-pictures` | merged, `b8b7103` |
| 3. The version in one place | [#49](https://github.com/ryanjosephkamp/grooph/pull/49) | `slice/0081-version` | merged, `a2c03e1` |
| 4. Safari and Firefox | [#53](https://github.com/ryanjosephkamp/grooph/pull/53) | `slice/0081-browsers` | merged, `cad617b` |
| 5. The CLI, command by command | [#50](https://github.com/ryanjosephkamp/grooph/pull/50) | `slice/0081-cli-reference` | merged, `980a00d` |
| 6. Pages that exist and are not on the site | [#51](https://github.com/ryanjosephkamp/grooph/pull/51) | `slice/0081-site-pages` | merged, `e11f276` |
| 7. New short pages: privacy, releases, contributing | [#52](https://github.com/ryanjosephkamp/grooph/pull/52) | `slice/0081-short-pages`, head `9b24d11` | open, corrected, every CI job green on the corrected head; the driver merges it |
| 7. New short pages: the FAQ | [#54](https://github.com/ryanjosephkamp/grooph/pull/54) | `slice/0081-faq`, head `0529703` (the FAQ's own commit is `cce220c`; the head is a merge of the corrected #52), stacked on #52 | open, every CI job green, **waits for the owner and the audit lane**; the driver has recommended holding it until the audit converges |

Order sent: 2, 1, 3, 5, 6, 7, 4, 7 (FAQ). Item 2 went before item 1 because #45 was still open and edited `docs/PROGRESS.md`, as the driver said.

## Corrected after the driver's read: the privacy page

The brief said to check each sentence of the privacy page against the code before writing it. One bullet was checked against a summary sentence in `docs/subagents.md` and not against the hook, and it was wrong. The driver caught it on reading #52, and the audit lane found the same independently (its claim C30). Commit `9b24d11` on `slice/0081-short-pages` corrects it, from `packages/cli/hooks/grooph-event.mjs`, `packages/cli/hooks/grooph-events-push.mjs` and `packages/cli/src/mcp.ts` read in full.

| The page said | What the code does | The page now says |
|---|---|---|
| The hook's line holds "ids, names and times" | It also writes `cwd`, the working folder's path, on a main-session event (line 77) and `transcript`, the path of a subagent's transcript, on its stop (line 80) | ids, names, the time, and on the machine two paths, named |
| It never writes "a tool's input or result" | It keeps one fact from a tool's result: `spawned`, the id of the subagent the tool started (line 73) | never a prompt, a tool's input or anything an agent said; of a tool's result, that one id |
| Nothing about text in the events folder | `grooph mcp` writes `said-<session>.jsonl` beside the hook's files when a session calls `grooph_plan` or `grooph_note`: a plan's title, each planned subagent's purpose, a note, each cut to 600 characters, with the project's path | a bullet of its own, "What a session chooses to say" |
| The lines "go to a branch of your own repository" | The push takes every `*.jsonl` in the folder, so plans and notes go too; a folder is sent as its name and a transcript's path is dropped (`shortened()`); commits are made as `grooph` | all of that, and that on a public repository the branch is public |
| The tool "uses the network in one case" | `grooph events push` is a second: it runs `git fetch` and `git push` | two cases, both when you ask |

**The second row of what the push sends is the one the driver had not named**: free text. `docs/HANDBACK-operator.md` section 16 already lists it ("only if a lead uses grooph's own MCP server").

**The same loose phrase stands where this lane may not edit**: `README.md` line 62, `docs/GLOSSARY.md` line 35, `docs/subagents.md` line 150, `docs/HANDBACK-operator.md` line 151, the header comments of both hook files, and the `grooph hooks` help text, from which `docs/cli.md` line 437 is generated. None was written by this lane. They are for the audit's corrections pull request; when the help text changes, `node scripts/cli-reference.mjs` brings `docs/cli.md` with it.

The FAQ does not repeat the phrase, and its "Where do my graphs live?" answer is untouched by the correction. `slice/0081-faq` was brought up to date with the corrected #52 by a merge.

## What changed

**Item 1 (#48)**
- `docs/HISTORY.md` *new*: the Done table, 41 rows, moved byte for byte, with a link back.
- `docs/PROGRESS.md`: the `## Done` heading stays, with one line that links to the history. Nothing else touched.
- `AGENTS.md`: the convention line and the layout name the file.
- `.claude/skills/grooph-status/SKILL.md`, `grooph-reconcile/SKILL.md`, `grooph-handoff/SKILL.md`: point at `docs/HISTORY.md`.
- `scripts/american-english.mjs`: `docs/HISTORY.md` listed as internal record.

**Item 2 (#47)**
- `scripts/check-pictures.mjs` *new*, `scripts/check-pictures.test.mjs` *new* (7 tests), `scripts/pictures-baseline.json` *new* (92 pictures).
- `handoffs/README.md`: the rule, under "Rules for both sides".
- `.github/workflows/ci.yml`: one step in `build`.

**Item 3 (#49)**
- `scripts/version.mjs` *new*, `scripts/version.test.mjs` *new* (6 tests).
- `.github/workflows/ci.yml`: one step in `build`.

**Item 4 (#53)**
- `apps/web/e2e/smoke.spec.ts` *new*: five visits.
- `apps/web/playwright.config.ts`: `GROOPH_BROWSERS=1` runs the smoke set in `chromium`, `safari` (WebKit) and `firefox`.
- `.github/workflows/ci.yml`: a job of its own, `web-browsers`.

**Item 5 (#50)**
- `scripts/cli-reference.mjs` *new*, `docs/cli.md` *new* (generated, 23 commands).
- `scripts/site/pages.json`: one entry. `.github/workflows/ci.yml`: one step in `build`.

**Item 6 (#51)**
- `scripts/site/pages.json`: five entries (glossary, the Claude Code target, the executive path, comparisons, architecture).

**Item 7 (#52, #54)**
- `docs/privacy.md` *new*, `docs/releases.md` *new*, `CONTRIBUTING.md` *new*, `docs/faq.md` *new*.
- `scripts/site/pages.json`: a new group, "Project", with four entries.
- `scripts/american-english.mjs`: `CONTRIBUTING.md` joins the public-facing files.

No file under `packages/`, no file under `apps/web/src/`, no version, no dependency.

## Verified, and how

Run from cold on 2026-10-04 on `main` at `e11f276` with the three branches then open (`slice/0081-faq`, which carries `slice/0081-short-pages`, and `slice/0081-browsers`) merged in locally, so all seven items were under test together. The local merge was thrown away afterwards.

| Command | Observed |
|---|---|
| `pnpm -r build` | built |
| `pnpm -r test` | core 345 pass, CLI 119 pass, web 59 pass, none failing |
| `GROOPH_E2E_PORT=4366 pnpm --filter @grooph/web test:e2e` | 165 passed, 107 skipped (the screenshot tests), Chromium |
| `node scripts/site-pages.mjs --check` | ok. 22 pages and an index, links and anchors resolve, nothing unrendered; largest page 20.1 KB gzipped, index 5.4 KB |
| `node scripts/american-english.mjs --check` | nothing British in 522 public-facing files |
| `node scripts/perf-budget.mjs --check` | exit 0, all six lines ok |
| `node --test scripts/check-pictures.test.mjs scripts/version.test.mjs` | 13 pass |
| `node scripts/check-pictures.mjs --check` | 304 pictures, 34.8 MB; 92 from before the rule are over 150 KB and left alone |
| `node scripts/version.mjs --check` | the version is 0.3.0 in all 8 places |
| `node scripts/cli-reference.mjs --check` | docs/cli.md is current |
| `GROOPH_BROWSERS=1 GROOPH_E2E_PORT=4366 pnpm --filter @grooph/web test:e2e --project=chromium` | 5 passed |
| CI, job `web-browsers`, on #53's head | 10 passed: five in WebKit, five in Firefox |

**Success criterion: each item's pull request passes every job in CI and says in its description what was run.** Met for all eight, #47 to #54: `build (22)`, `build (24)`, `web-e2e`, and on #53 `web-browsers`, each read line by line with `gh pr checks`, on the push run and on the pull request run.

**Not run locally:** WebKit and Firefox. See Deviations, 3.

## What Safari and Firefox broke, fixed or listed

**In the app: nothing.** All five visits pass in WebKit and in Firefox, and no file under `apps/web/src` is changed. The five: the front page; a template opened from the list onto the canvas; a graph imported and its package exported, byte for byte against the golden one; an operation map from a link; the offline visit. Each also fails on an uncaught error in the page.

**In the test harness: two things, both written into the test where it stands.** Playwright's offline switch (`context.setOffline(true)`) cannot test a service worker outside Chromium.

- **WebKit**: a navigation fails inside the engine ("WebKit encountered an internal error") before the worker is asked. The error is the same with the worker in control and with it blocked. A route that aborts every request also takes the navigation before the worker does.
- **Firefox**: the switch does not stop a navigation to localhost. A page with the worker **blocked** still loaded, with status 200. The first version of the offline test therefore passed in Firefox and showed nothing about the worker.

**Fixed, in the test:** the offline visit serves the built app from a server of its own, with `no-store`, makes the first visit, closes the server, checks that a plain request is refused, and opens the app and a template again. That is real in all three engines. `apps/web/e2e/offline.spec.ts`, Chromium with the switch, is unchanged.

**Listed, not fixed:**
- WebKit on Linux is Safari's engine, not Safari. A real iPhone, the on-screen keyboard and a real finger are still untested.
- Five visits run in three engines; the other 160 tests run in Chromium alone.
- The first Known risk in `docs/PROGRESS.md` says "any browser but Chromium". It can be narrowed now. That file is the driver's.

## CI time, before and after

Read from the runs of #47 to #54.

| Job | Before | After |
|---|---|---|
| `build (22)`, `build (24)` | 44 s to 1 min 7 s | 43 s to 1 min 5 s, with three more steps (pictures, version, CLI reference) |
| `web-e2e` | 2 min 17 s to 2 min 38 s | 2 min 33 s to 2 min 56 s, with five more tests |
| `web-browsers` | none | 1 min 24 s with the browsers cached; 1 min 48 s to 1 min 50 s without |

The new job runs beside the others and ends before `web-e2e`, so a pull request waits no longer than it did. The brief's limit was four minutes added with the browsers cached. With the cache, 41 s of the job is installing the browsers' system libraries and 18 s is the tests.

The cache is per branch until one exists on `main`. #53's merge run on `main` makes it; a pull request opened before that takes the uncached time once.

## Decisions made

1. **The picture baseline holds only what breaks the rule, with sizes, and only tightens.** `--prune` drops an entry that is gone or now fits and lowers one that shrank; it never adds one. Letting another picture through is a line added by hand in a pull request. Reason: a baseline a script can widen is not a rule.
2. **The picture check reads what git would take** (`git ls-files --cached --others --exclude-standard`). Reason: it speaks before the commit, and ignores what `.gitignore` ignores.
3. **Both new checks fail when they have nothing to read**: no picture found, no baseline, a version line that cannot be found, no command in the overview. Reason: the lesson of the night of 2026-10-04, that a check which cannot find its input must fail.
4. **Video files count as pictures, at 150 KB.** There are none in the repository. Reason: a recording would otherwise walk around the GIF limit.
5. **`scripts/version.mjs` finds each place by the exact line around it and writes nothing unless it found all eight.** Reason: a release must never go out with seven of eight.
6. **The CLI reference leaves the version out of the page.** Reason: it would be a ninth place a release has to touch.
7. **`GROOPH_BROWSERS=1` selects the three engines; without it nothing changes.** Reason: `pnpm --filter @grooph/web test:e2e` must keep working in a clone that has only Chromium, and for the other lanes at work today.
8. **The smoke set is five tests in one file**, each drawn from a longer spec and trimmed to what an engine could get wrong on its own. The front page test uses structure (the heading, the drawn picture, the New graph button), not the landing page's class names, because the site lane is restyling that page now.
9. **Item 7 is two pull requests**: three pages, and the FAQ stacked on them. Reason: the FAQ waits for the audit lane; the other three should not wait with it.
10. **A new group on the docs index, "Project"**, for releases, contributing, privacy and the FAQ. The glossary went under Start; the other four existing documents under Reference.
11. **The releases page leaves out pull request numbers, test counts and measurements, and makes no promise about compatibility.** Reason: the record has the first two; a figure about speed is a claim; a promise is the owner's.
12. **The FAQ has fourteen questions**: the six named, and eight of the lane's choosing (what grooph is; whether it makes the work better; what it checks; whether an agent can build the graph; phone and offline; what an operation map is; what it costs; whether it is finished).

## Deviations

1. **`scripts/american-english.mjs` was edited twice** (#48: `docs/HISTORY.md` is internal record; #52: `CONTRIBUTING.md` is public-facing). The brief allows `scripts/**` "for the new checks"; this is an existing one. Without the first edit CI fails on two old British spellings in a moved row, and the rule is that the older record stays as written. Without the second a public page goes unchecked.
2. **`grooph-handoff`'s closing line** said "the ledger and progress rows are updated" and did not name the Done table. I added a parenthesis saying where a dated row goes. If "progress rows" meant the In flight table only, take the parenthesis out.
3. **WebKit and Firefox were run in CI, not on this Mac.** The brief says "locally with one command". The command exists and was run locally for Chromium. The two other browsers at this Playwright's revisions are not installed here (an older pair is), installing them is a download of two browser builds, and nobody had said yes to it. The owner can run `pnpm --filter @grooph/web exec playwright install webkit firefox` once and then the one command.
4. **A probe branch was pushed**: `slice/0081-browsers-probe`, one commit, never a pull request. It is how the two harness findings were made, in CI. It can be deleted.
5. **A port other than 4366.** The offline visit's own server listens on `127.0.0.1` at a port the system picks, for about a second. The driver's instruction was 4366 only. It cannot be 4173 or 4366, because the system gives out only free ports; it is said here because it is not what the instruction says.
6. **Item 6 edits no document.** The site's check refused no link, so there was nothing to fix. Two phrasings a reader will meet were left as they are, because existing wording is out of bounds: `docs/executive.md` opens "Normative for slice 0006", and `docs/ARCHITECTURE.md`'s diagram says `packages/mcp` and "(stage 5)" where the MCP server lives in `packages/cli` today.
7. **One branch per item** (`slice/0081-<item>`), as the driver's message said, where the brief's header names `slice/0081-house-and-pages`. This branch carries the handback.

## Risks and leftovers

- **The agents lane (`packages/cli/**`)**: now that #50 is in, a change to any command's help text or to the overview fails `build` until `pnpm -r build && node scripts/cli-reference.mjs` is run and `docs/cli.md` committed. The message says so. Tell that lane.
- **Every lane**: now that #47 is in, a picture over 150 KB added under `handoffs/`, `docs/` or `apps/web/public/` fails `build`. No pull request open at the time added one.
- **The privacy page is true of `main` today and nothing holds it there.** The site lane is changing the app (fonts, a footer). Self-hosted fonts keep the page true; a font or script from another address would not. A small check that fails CI when the app or the site's pages name an outside address to load would hold it. Not built: it is outside this brief.
- **Two sentences on the privacy page rest on something outside the code**: that GitHub, as the host, receives each request, and that grooph adds nothing to those requests. For the owner or the audit lane to read.
- **`README.md` line 47 says "Early, version 0.3.0."** It is a ninth place the version is written, in prose, in a file the site lane holds. `scripts/version.mjs` neither reads nor writes it. Add it as a place once that lane's README is in.
- **`docs/releases.md` needs a section at each release.** `scripts/version.mjs` prints a `next:` line after writing a version; it could name the releases page once #52 is in.
- **The FAQ says "The Codex target is planned"**, the README's sentence. The Codex lane (0076) changes both when its target lands.
- **The FAQ's LangGraph answer** is the one place a page describes someone else's product. It says what kind of thing it is and makes no comparison of worth. For the audit lane.
- **Three of the FAQ's answers repeat words the audit lane's first reading does not carry**, as the driver told the owner: "shown to bound and record autonomous work", "twenty templates, each proven in a recorded run", and "Every loop can end" said without its condition. They are the README's and the front page's words, taken as the brief's ceiling. This lane does not change them: the audit's corrections pull request carries the settled wording, for the FAQ with the rest.
- **The 92 pictures in the baseline are still in git**, 34.8 MB with the rest. The rule stops the growth; it removes nothing. Moving the before-and-after sets to a published page and deleting them is a removal a person might miss, so it is the owner's.
- **`plugins/grooph/.claude-plugin/plugin.json` says version `0.1.0`**: the plugin's own, left alone, not one of the eight.
- **No TODO is left in the tree.**

## Prompt to paste into the driver session

```text
Handback for slice 0081 is at handoffs/0081-house-and-pages/HANDBACK.md on branch slice/0081-house-and-pages (its first version merged with #55; the version brought up to date after the privacy correction is in #56). Status: done. Seven items in eight pull requests: #47, #48, #49, #50, #51 and #53 are merged; #52 (privacy, releases, contributing) is corrected as you asked (head 9b24d11) and green; #54 (the FAQ, stacked on #52, head 0529703) is green and waits for the owner and the audit lane. Please reconcile with the grooph-reconcile skill.
```
