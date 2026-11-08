# Contributing

grooph is a small open-source project. A diagram, a fix, or an idea for a rule is welcome, by pull request or as an issue. This page says how to send each, and what a pull request is held to.

To report a security problem, see [`SECURITY.md`](SECURITY.md) and do not open a public issue. The Obsidian plugin has its own repository, [grooph-obsidian](https://github.com/ryanjosephkamp/grooph-obsidian).

## Set up

Node 22 or later and pnpm.

```bash
git clone https://github.com/ryanjosephkamp/grooph.git && cd grooph
pnpm install && pnpm -r build && pnpm -r test
```

Those are the first three commands CI runs. The browser tests need Chromium once (`pnpm --filter @grooph/web exec playwright install chromium`), then `pnpm --filter @grooph/web test:e2e`.

## Send a diagram or a template

It goes under `community/<your GitHub handle>/`, one document per file, and CI checks it and draws it. Nothing in your document is ever run. [`community/README.md`](community/README.md) has the whole recipe, and the [gallery](docs/community.md) is where it appears.

```bash
grooph validate community/<handle>/<id>.grooph.json
grooph image community/<handle>/<id>.grooph.json --out picture.svg
```

Credit the work a shape comes from, with a link, and say what you took. The built-in library under `patterns/` is kept separately.

No document yet? [Suggest one](https://github.com/ryanjosephkamp/grooph/issues/new?template=loop.yml).

## Send a fix

A branch and a pull request, small enough to read in one sitting.

- **A test that fails without the fix.** Core and the command line use Node's test runner; the app uses Vitest and Playwright.
- **Say what you ran**, with the command and what it printed.
- **Regenerate what is generated.** Some pages are written by a script, and CI fails when one is stale. The message names the command: `node scripts/patterns-index.mjs`, `node scripts/rule-reference.mjs`, `node scripts/cli-reference.mjs`, `node scripts/field-guide.mjs`, or `node scripts/community-index.mjs`.
- **Commit messages** read `<area>: <what changed>`, like `core: add cycle detection`.

## Propose a rule

A rule is part of what grooph checks for everyone, so start with an issue that says what it would catch and shows a document it should flag. The pull request then has all of these:

- **A stable code**: `E_…` for an error, `W_…` for a warning.
- **A row in the rule table** of [`docs/graph-ir.md`](docs/graph-ir.md) §3, or of [`docs/operation-map.md`](docs/operation-map.md) §3 for a map.
- **A failing fixture** under `fixtures/invalid/<CODE>/` (for a map, `fixtures/maps/invalid/<CODE>/`), with every passing fixture still clean.
- **The [rule reference](docs/rules.md)** regenerated with `node scripts/rule-reference.mjs`.

Every template in `patterns/` must still validate clean under the new rule.

## What CI holds every pull request to

- **American English** in everything a person reads: "color", "center", "labeled". `node scripts/american-english.mjs --check` finds the rest, and `--fix` corrects them.
- **A code and a fixture for every rule.**
- **The budget.** The app's first load and the command's start have limits in `scripts/perf-budget.json`, and `node scripts/perf-budget.mjs --check` fails a change that goes over. Raising a limit is a decision made in the pull request, with the reason.
- **Small pictures.** A picture added under `docs/` or `apps/web/public/` is at most 150 KB (`node scripts/check-pictures.mjs --check`).
- **The document is the source of truth.** The canvas, the outline, and every picture are drawn from it. A change that lets one of them hold something the document does not is the wrong change.
- **grooph never calls a model and never runs an agent.** The event hook records and never steers.
- **No new dependency** without asking first, in an issue.

Changes to what grooph checks, what a visitor sees, or what it depends on are reviewed before they merge. What you send is published under the repository's license, [MIT](LICENSE).
