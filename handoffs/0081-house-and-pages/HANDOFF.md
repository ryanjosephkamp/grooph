# Handoff 0081 · The house in order, and the pages the site is missing

**Stage:** 24 · **Lane:** Opus 5.5 (the work is a checklist; Sonnet 5.5 would do) · **Effort:** high · **Browser tests on port:** 4366 · **Branch:** `slice/0081-house-and-pages`, and one branch per item where the item says so · **Drafted:** 2026-10-04 · **Confirmed by owner:** 2026-10-04, on the review desk ("do them all", "add them all")

## Objective

The owner said yes to four changes to how the repository is kept and to every page the site is missing. Each is small. Done separately, in small pull requests the driver can merge, they retire four standing complaints: "Chromium only", a version written in eight places, a progress page whose history is longer than its present, and megabytes of screenshots in git. And the site gains the reference pages a stranger looks for.

**Send each numbered item as its own pull request**, smallest first, so each can be merged as it lands (decision 0023). Tell the driver in your reply when one is up.

## The items

1. **The progress page's history in its own file.** Move the "Done" table of `docs/PROGRESS.md` to `docs/HISTORY.md`, newest first, with a link each way; `docs/PROGRESS.md` keeps Now, In flight, Waiting on the owner, Deferred and Known risks. `AGENTS.md` and the three project skills that name the Done table point at the new file. This is the one time a lane edits `docs/PROGRESS.md`: do it first and fast, and touch nothing in it but the move.
2. **A size rule for pictures.** `scripts/check-pictures.mjs --check` in CI: a picture added under `handoffs/`, `docs/` or `apps/web/public/` is at most 150 KB (a GIF for the README at most 1.5 MB). Pictures already in the repository are listed in a baseline file and left alone. `handoffs/README.md` says the rule: JPEG under 150 KB; before-and-after sets go on a published page, not into git.
3. **The version in one place.** `scripts/version.mjs --check` in CI fails when the eight places the version is written disagree (the root, core, CLI and web `package.json`, `packages/cli/src/index.ts`, `apps/web/src/doc/keep.ts`, `apps/web/e2e/keep.spec.ts`, `scripts/test-install-local.sh`), and `scripts/version.mjs <x.y.z>` writes all eight. Change no version. The agents lane is editing `packages/cli/package.json`: your script reads it and does not rewrite it in this slice.
4. **Safari and Firefox.** A small set of smoke tests (the front page, a template opened, a graph imported and its export panel, a map opened, the offline visit) run in WebKit and Firefox as well as Chromium, locally with one command and in CI as a job of its own. Keep the added CI time under four minutes with the browsers cached. Where a test cannot pass in a browser for a reason that is the browser's, say which and why in the test, do not delete it. What breaks is a finding: fix what is small, list the rest.
5. **The CLI, command by command.** `docs/cli.md`, generated from the help text by `scripts/cli-reference.mjs`, with `--check` in CI, as the rule reference is made. A page on the site.
6. **Pages that exist and are not on the site.** `docs/targets/claude-code.md`, `docs/comparisons.md`, `docs/GLOSSARY.md`, `docs/executive.md` and `docs/ARCHITECTURE.md` each get an entry in `scripts/site/pages.json`, and any link in them that the site's check refuses is fixed.
7. **New short pages.** `docs/privacy.md` (what the site and the app do not do: no account, no server, no cookies, no analytics, and where a graph lives; check each sentence against the code before writing it), `docs/releases.md` (each version, its date and what changed, from the tags and `docs/HISTORY.md`), `CONTRIBUTING.md` with a page on the site (how to send a template, a fix or a rule; the house rules: American English, a code and a fixture for every rule, the budget), and `docs/faq.md`.
   - **The FAQ makes no claim of value beyond decision 0013's wording**: "grooph is shown to bound and record autonomous work and to hold a design as a runtime contract; it is not shown to raise quality over the same instructions given as a prompt, on small tasks." Questions it must answer: is it a runtime; does it call a model; how is it different from an agent framework such as LangGraph; which harnesses; where do my graphs live; can I use it without Claude Code. Its pull request waits for the owner, and the audit lane reads it.

## Success criteria

Each item's pull request passes every job in CI, `node scripts/site-pages.mjs --check`, `node scripts/american-english.mjs --check` and `node scripts/perf-budget.mjs --check`, and says in its description what was run.

## Read first

1. `handoffs/0081-house-and-pages/HANDOFF.md` (this file)
2. `AGENTS.md`; `handoffs/README.md`, "Lanes" and "Small changes"; `docs/decisions/0023-who-merges-what.md`
3. `scripts/rule-reference.mjs` and `scripts/field-guide.mjs` (how a generated page with `--check` is made here), `scripts/site-pages.mjs` and `scripts/site/pages.json`, `.github/workflows/ci.yml`
4. `apps/web/playwright.config.ts`, `apps/web/e2e/` (the tests the smoke set is drawn from)
5. `docs/PROGRESS.md`, `docs/decisions/0013-value-as-of-study-one.md`, `docs/decisions/0001-local-first-static-platform.md`

## Allowed changes

The files each item names; `scripts/**` for the new checks; `.github/workflows/ci.yml` for their steps and the new job; `apps/web/playwright.config.ts` and new test files under `apps/web/e2e/`; in `scripts/site/pages.json` only your own entries; `handoffs/README.md` (the picture rule); `handoffs/0081-house-and-pages/**`.

## Forbidden changes

Any version number. `docs/PLAN.md`. `docs/PROGRESS.md` beyond item 1's move. The words of any existing claim. `apps/web/src/**` except a fix item 4 finds and that is under about twenty lines: anything bigger is a finding for the driver. `packages/**` except what `scripts/cli-reference.mjs` must read. `scripts/site/**` other than `pages.json` entries (the site lane holds it). A new runtime dependency.

## Spec constraints that apply here

Decision 0022: American English. Decision 0001: no backend, which the privacy page describes. Decision 0013: the ceiling on claims.

## Design already decided

The seven items, each a pull request of its own, in that order.

## Implementer's choices

Which tests make the smoke set. How the picture baseline is kept. The FAQ's questions beyond the six named.

## How to verify

```bash
pnpm -r build && pnpm -r test
GROOPH_E2E_PORT=4366 pnpm --filter @grooph/web test:e2e
node scripts/site-pages.mjs --check && node scripts/american-english.mjs --check && node scripts/perf-budget.mjs --check
```

## Handback must contain

The `TEMPLATE-HANDBACK.md` sections, plus: the seven pull requests and their state; what Safari and Firefox broke, fixed or listed; CI time before and after.

## Prompt to paste

```text
You are a lane of grooph: the house lane. Read handoffs/0081-house-and-pages/HANDOFF.md, then AGENTS.md and the files it lists. It is seven small items; send each as its own pull request, smallest first, and tell the driver when one is up. Browser tests on port 4366. Do not edit docs/PLAN.md, and docs/PROGRESS.md only for item 1's move. The driver session ("grooph opus operator") assigns and reviews your work and will message you; ask it, not me. Finish with the grooph-handback skill; you do not merge.
```
