# Contributing

grooph is a small open-source project with one owner. A loop graph, a fix or an idea for a rule is welcome, by pull request or as an issue. This page says how to send each, and the house rules a pull request is held to.

## Set up

Node 22 or later and pnpm.

```bash
git clone https://github.com/ryanjosephkamp/grooph.git && cd grooph
pnpm install && pnpm -r build && pnpm -r test
```

That is the same three commands CI runs first. The browser tests need Chromium once (`pnpm --filter @grooph/web exec playwright install chromium`), then `pnpm --filter @grooph/web test:e2e`.

## Send a loop graph or a template

It goes under `community/<your GitHub handle>/`, one document per file, and CI checks and draws it. Nothing in your document is ever run. [`community/README.md`](community/README.md) has the whole recipe, and the [gallery](docs/community.md) is where it appears.

```bash
grooph validate community/<handle>/<id>.grooph.json
grooph image community/<handle>/<id>.grooph.json --out picture.svg
```

Credit the work a shape comes from, with a link, and say what you took. The built-in library under `patterns/` is separate: a template enters it only with a recorded run that proves it, which the owner arranges.

No document yet? [Suggest a loop](https://github.com/ryanjosephkamp/grooph/issues/new?template=loop.yml).

## Send a fix

A branch and a pull request, small enough to read in one sitting.

- **A test that fails without the fix.** Core and the CLI use Node's test runner, the app uses Vitest and Playwright.
- **Say what you ran**, with the command and what it printed. "Tests pass" is not a verification.
- **Regenerate what is generated.** Some files are written by a script and CI fails when one is stale. The message names the command; they are `node scripts/patterns-index.mjs`, `node scripts/rule-reference.mjs`, `node scripts/cli-reference.mjs`, `node scripts/field-guide.mjs` and `node scripts/community-index.mjs`.
- **Commit messages** read `<area>: <what changed>`, like `core: add cycle detection`.

## Propose a rule

A validation rule is part of what grooph promises, so start with an issue that says what it would catch and shows a graph it should refuse. If the owner takes it, the pull request has all of these:

- **A stable code**: `E_…` for an error that blocks export, `W_…` for a warning.
- **A row in the rule table** of [`docs/graph-ir.md`](docs/graph-ir.md) §3, or of [`docs/operation-map.md`](docs/operation-map.md) §3 for a map.
- **A failing fixture** under `fixtures/invalid/<CODE>/` (maps: `fixtures/maps/invalid/<CODE>/`), and the passing fixtures still validating clean.
- **The [rule reference](docs/rules.md)** regenerated with `node scripts/rule-reference.mjs`.

Every template in `patterns/` must still validate clean under the new rule.

## House rules

CI holds every pull request to these.

- **American English** in everything a person reads: "color", "center", "labeled". `node scripts/american-english.mjs --check` finds the rest, and `--fix` corrects them.
- **A code and a fixture for every rule.** No rule without both.
- **The budget.** The app's first load and the command's start have limits in `scripts/perf-budget.json`, and `node scripts/perf-budget.mjs --check` fails a change that goes over. Raising a limit is a decision made in the pull request, with the reason.
- **Small pictures.** A picture under `docs/`, `handoffs/` or `apps/web/public/` is at most 150 KB (`node scripts/check-pictures.mjs --check`).
- **The document is the source of truth.** The canvas, the outline and every package are drawn from the graph document. A change that lets one of them hold something the document does not is the wrong change.
- **grooph never calls a model and never runs an agent.** The harness does. The event hook records and never steers.
- **No new dependency** without asking first.
- **The spec is frozen.** [`spec/capability-spec.md`](spec/capability-spec.md) changes only through an amendment, which is the owner's to accept.

## What happens to a pull request

Small and safe changes are merged soonest: documents, tests, a fix with a test. Anything that changes what grooph promises, what the compiler writes, what a visitor sees or what it depends on waits for the owner's own decision.

What you send is published under the repository's license, [MIT](LICENSE), like the rest.

Working on grooph with a coding agent? [`AGENTS.md`](AGENTS.md) is its way in.
