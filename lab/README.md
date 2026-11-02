# The lab

grooph draws workflows. It does not direct a session ([how grooph is built](../docs/ARCHITECTURE.md), [the lab's page](../docs/lab.md)). What did direct one is kept here, as an experimental part: the compilers and the packages they write, brakes a run obeys, adoption of a run's working copy, and run folders.

The lab builds and is tested with everything else in the repository. This folder is in nothing grooph publishes: the npm package is bundled from the product's command alone, and no workflow that deploys the site builds the lab.

None of what directs a session is in the `grooph` command. The MCP tool `grooph_export` and the app's Export panel still offer a package, each marked experimental. The site does not show the lab's records or its reference pages (`docs/runs.md`, `docs/targets/`, and `docs/comparisons.md` stay in the repository, off the site).

## The command

`grooph-lab` does everything `grooph` does. A command that has left the product is handled here; every other command is handed to the product's own `run()` as it was typed, so its words and exit codes are the product's.

It is run from a clone and from nowhere else:

```bash
pnpm install && pnpm -r build
node lab/bin/grooph-lab.js --help
pnpm exec grooph-lab --help        # the same, from the repository's root
```

`export`, `adopt`, `runs`, `watch` with a run to follow, and `share` and `embed` of a run folder are the lab's. `grooph` answers the first four with one line that says where they went, and reads no run folder. `grooph-lab --help` and its pages for those commands are what `grooph` printed through 0.4.1, word for word, so they say `grooph export`: a run finds the lab's command under that name on its path.

Still in the product's code and not yet moved here: the MCP tool `grooph_export` and `packages/cli/src/commands/export.ts` that it stands on; the compilers, brakes, and adoption in `packages/core`.

## From the repository

None of these calls a model.

```bash
# A package for a harness, from a graph document.
node lab/bin/grooph-lab.js export <graph> --target claude-code --into <project> [--models frontier=…,strong=…,fast=…]
node lab/bin/grooph-lab.js export <graph> --target codex --into <project>     # the graph names Codex first: the setTarget op

# What a run did, and its working copy taken back as the next version of the graph.
node lab/bin/grooph-lab.js runs list <project>
node lab/bin/grooph-lab.js runs show <project>/.grooph/<id>/runs/<run>
node lab/bin/grooph-lab.js adopt <project>/.grooph/<id>/runs/<run> [--allow …] [--write]

# A run as one file the product's app, `grooph share` and `grooph embed` open; and a run followed live in a browser.
node lab/bin/grooph-lab.js runs bundle <project>/.grooph/<id>/runs/<run> --out run.grooph-run.json
node lab/bin/grooph-lab.js watch <project>/.grooph/<id>/runs/<run> [--port 4174]

# The experiments' tables and derived prompts, rebuilt from their records.
node experiments/watching/tables.mjs --check
node scripts/lib/compare-arms-ef.mjs --check
```

## Where each thing lives

| What | Where |
|---|---|
| The lab's command, and the pages it prints | `lab/bin/grooph-lab.js`, `lab/src/index.ts`, `lab/src/help.ts` |
| `adopt`, `runs`, and reading a run folder | `lab/src/commands/adopt.ts`, `lab/src/commands/runs.ts`, `lab/src/run-io.ts` |
| `watch` with a run to follow | `lab/src/commands/watch.ts`, on the product's own server |
| `export` | its case in `lab/src/index.ts`; the command itself is `packages/cli/src/commands/export.ts` |
| The compilers, tier maps, brakes, and adoption | `packages/core/src/` |
| The experiments' scorers and checkers | `scripts/lib/` (`compare-score`, `compare-summary`, `compare-arms-ef`, `prove-check`, `prove-summary`, and what they import) |
| Records: template runs, paired comparisons, the watching check, observed hook inputs, the audit of 0.3.0's claims | `experiments/` (its README says what each folder holds and what was left out) |
| Golden packages, and recorded runs | `fixtures/golden/`, `fixtures/runs/` |
| Documents | `docs/lab.md`, `docs/runs.md`, `docs/targets/`, `docs/comparisons.md`, and `docs/claims.md` |

## Tests

`pnpm -r test` runs the lab's with the rest, and CI runs that on every pull request.

```bash
pnpm --filter @grooph/lab test
```

That is two sets:

- **`lab/test/`**: the tests of `export`, `adopt`, `runs`, and `watch <run>`; the command started as a program; export for both harnesses against `fixtures/golden/`, byte for byte.
- **The scorers' tests**: `scripts/lib/*.test.mjs`.

The paid runners that produced the records (the proving, comparison, and watching runners) are not in this repository. They start paid sessions, so each record was made by a person starting a run; `experiments/README.md` says how.
