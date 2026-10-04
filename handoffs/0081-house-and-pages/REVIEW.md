# Review 0081 · The house in order, and the pages the site is missing

**Reviewer:** driver (the session "grooph opus operator", Opus 5.5) · **Date:** 2026-10-04 · **Reviewed:** eight pull requests, #47 to #54, and the handback (#55) · **Verdict:** **proceed.** Seven of the eight are merged; the FAQ (#54) waits for the owner and for the audit.

The lane sent each item as a pull request of its own, small enough to read in one sitting, and said in each what it ran. That is what made it possible to merge six of them inside an hour without the owner.

## What was merged, and on what grounds

Every merge below was made by the driver under decision 0023: a slice the owner said yes to on the review desk ("do them all", "add them all"), read by someone other than its author, every CI job green on its head, CI green on `main` afterwards. Each is on the desk's list of merges made without asking.

| Pull request | What | Read how |
|---|---|---|
| #47 | A size rule for pictures (150 KB), with a baseline that can only tighten | the diff; the baseline is 92 pictures from before the rule, none added |
| #48 | The progress page's Done table moved to `docs/HISTORY.md` | the diff; the rows moved byte for byte |
| #49 | The version checked in eight places | the diff and its six tests |
| #50 | `docs/cli.md`, generated from the commands' own help | the generator and the page |
| #51 | Five existing documents as pages on the site | the five entries |
| #53 | Five smoke visits in WebKit and Firefox, and a CI job for them | the workflow, the configuration and the tests' structure; the job's result on the head (ten passed) |
| #52 | Privacy, releases and contributing pages | every sentence of the privacy page against the source; see below |
| #55 | The handback | read in full |

## One thing caught before it merged

The privacy page (#52) said the event hook's line holds "ids, names and times". The audit lane, working separately the same hour, had found that the local line also holds two paths: the working folder's, and where a subagent's transcript is kept (its claim C30). The driver confirmed it in `packages/cli/hooks/grooph-event.mjs` (lines 77 to 80), stopped a merge that was already queued, and asked the lane to correct the sentence.

The correction (`9b24d11`) says more than was asked: what a line holds field by field, the one fact kept from a tool's result, what `--tools` adds, the plan and the note a session may leave through `grooph mcp` and their 600-character limit, and what a push sends and leaves behind. The driver checked each against the source (`grooph-event.mjs`, `SAID_MAX` in `packages/core/src/events.ts`, the `grooph` author and the branch name in `grooph-events-push.mjs`) before merging.

The same understatement stands in amendment A-012's own words ("It holds ids, names and times"), which A-016 later corrects in passing. It is the audit lane's to carry.

## What the driver checked on the privacy page

| The page says | Checked in | Result |
|---|---|---|
| No script, style, font or picture from another address | every `http(s)://` in `apps/web/index.html`, `apps/web/src` and `apps/web/public`; the site pages' templates | none besides the project's own addresses and links a person follows |
| No cookies | `document.cookie` anywhere in the app or the site pages | not used |
| Two small notes in local storage | `localStorage` calls in `apps/web/src` | two keys: the browser's answer about keeping storage, and the templates page's search and filters |
| Nothing reads the clipboard | `clipboard.read` | not used |
| The live screens ask only the address the app was served from | every `fetch` in `apps/web/src` | all relative to the page's own base |
| The command-line tool reaches the network in two cases | `fetch` and `git` calls in `packages/cli/src` and the push script | the registry lookup, and `git` for the events push |
| `grooph watch` serves this machine only unless told otherwise | `packages/cli/src/commands/watch.ts` | default host `127.0.0.1` |

Two sentences rest on something outside the code, as the handback says: what GitHub, as the host, receives, and that grooph adds nothing to those requests.

## Run at reconcile

On `main` at `dc8a67c`, with all seven merged:

| Command | Observed |
|---|---|
| `node scripts/version.mjs --check` | the version is 0.3.0 in all 8 places |
| `node scripts/check-pictures.mjs --check` | 304 pictures, 34.8 MB; 92 from before the rule are over 150 KB and left alone |
| `node scripts/cli-reference.mjs --check` | `docs/cli.md` is current |
| `node scripts/american-english.mjs --check` | nothing British in 521 public-facing files |
| `node scripts/site-pages.mjs --check` | ok: 21 pages and an index, links and anchors resolve; largest page 20.1 KB gzipped |
| the rows #48 took out of the progress page, against the rows it put in `docs/HISTORY.md` | 43 lines out, the same 43 in |
| CI on `main` after each merge | green after each of the eight; the deploy after #53 also green |

`pnpm -r build && pnpm -r test` and the browser tests were not run again by the driver: CI ran them on every head and on `main` after every merge.

## The FAQ (#54)

Not merged. It states claims, so it is the owner's (decision 0023), and three of its answers repeat words the audit lane's first reading does not carry: "shown to bound and record autonomous work" (no cap or budget has fired in any recorded run), "twenty templates, each proven in a recorded run" (two records fail their check), and "Every loop can end" as an unconditional (a loop with a stop and no cap or budget validates with a warning). The lane wrote what its brief told it to: the brief quoted decision 0013's sentence as the ceiling. The driver recommended to the owner that the page wait until the audit's rounds converge.

## Deviations, accepted

All seven in the handback are accepted. Two are worth a line:

- **WebKit and Firefox ran in CI, not on the owner's Mac.** Right call: installing two browser builds on his machine was not something anyone had said yes to.
- **A probe branch** (`slice/0081-browsers-probe`) was pushed to find out what Playwright's offline switch does in each engine. It is not merged and can be deleted; a removal is the owner's to decide.

## Carried forward

- The agents, site, views and evidence lanes were told about the picture rule, the generated CLI reference, the version check and the new CI job, each as it bears on their work.
- **A check that the built app and the site's pages load nothing from another address** was the handback's own suggestion; the driver asked the lane for it as one more small pull request, because it is what keeps the privacy page true while the site lane changes the front page.
- `README.md` says "Early, version 0.3.0." in prose: a ninth place for `scripts/version.mjs`, once the site lane's README is merged.
- `docs/releases.md` needs a section at each release; `scripts/version.mjs` could name it in its `next:` line.
- The FAQ's "The Codex target is planned" changes when slice 0076 lands.
- 92 pictures from before the rule are still in the repository, 34.8 MB in all. The rule stops the growth; removing them is the owner's decision.
