# The lab

grooph draws workflows and watches them. It no longer directs a session ([decision 0032](../docs/decisions/0032-grooph-draws-and-watches.md), [the contract](../spec/contract.md)). What did direct one is kept here: the compilers and the packages they write, brakes a run obeys, adoption, run folders, and the proving and comparison runners.

The lab builds and is tested with everything else in the repository. This folder is in nothing grooph publishes: the npm package is bundled from the product's command alone, and no workflow that deploys the site builds the lab. Nothing was deleted to make it, and it is meant to be used: for experiments larger and longer than the ones on record, in Claude Code and in Codex.

Where the lab is going, when slice 0103 is done: none of what directs a session is in the npm package or in the app. It is not there yet (see "Where the move stands"). The site is a separate matter: it still shows some of the lab's records and documents (`experiments/patterns/` and `experiments/comparisons/`, and the pages made from `docs/runs.md`, `docs/targets/claude-code.md`, `docs/comparisons.md` and `docs/claims.md`), and that stays as it is until the site is rewritten, by the owner's word.

This page is the lab's index: what is in it, where each thing lives, and how it is run.

## The command

`grooph-lab` does everything `grooph` does. A command that has left the product is handled here; every other command is handed to the product's own `run()` as it was typed, so its words and exit codes are the product's.

It is run from a clone and from nowhere else:

```bash
pnpm install && pnpm -r build
node lab/bin/grooph-lab.js --help
pnpm exec grooph-lab --help        # the same, from the repository's root
```

**Where the move stands.** The lab is being made by slice 0103 in six pull requests ([`handoffs/0103-the-lab/HANDOFF.md`](../handoffs/0103-the-lab/HANDOFF.md)). After the first, which added this package, nothing has left the product: `grooph-lab` hands every command on, and `grooph export`, `grooph adopt`, `grooph runs` and `grooph watch <run>` still answer too. The runners below already start `grooph-lab`, so they do not notice when those commands leave.

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

# The runners, in the mode that builds everything and starts nothing.
scripts/prove-pattern.sh <template> --dry-run
node scripts/prove-codex.mjs
scripts/compare.sh <project> <A|B|C|D> --dry-run
node scripts/lib/brake-run.mjs --check
node scripts/lib/compare-arms-ef.mjs --check
```

A run that calls a model spends money and is the owner's to start. Each runner's header says what it needs (a lead's model and effort, a tier map, a ledger that allows it), and every such run is recorded before its result is used (decision 0015).

## Where each thing lives

Code moves into this folder. Records, runner scripts, fixtures and the lab's documents stay at their paths, because a record's path is part of the record and several hundred files cite them.

| What | Where |
|---|---|
| The lab's command | `lab/bin/grooph-lab.js`, `lab/src/` |
| The compilers, tier maps, brakes, adoption, and the commands over them | still under `packages/core/src/` and `packages/cli/src/` until the slice's later pull requests move them here |
| The proving runners | `scripts/prove-pattern.sh`, `scripts/prove-codex.mjs`, `scripts/lib/prove-*.mjs`, `scripts/e2e-claude-code.sh` |
| The comparison runners | `scripts/compare.sh`, `scripts/lib/compare-*.mjs` |
| The brake experiment and study three | `scripts/lib/brake-*.mjs`, `scripts/lib/study-three-paid.mjs`, and the three `*-paid.mjs` probes beside them |
| The stand-in for a harness, which calls no model | `scripts/lib/fixtures/stand-in-harness.mjs` |
| Records: proving runs, comparisons, brakes, the game experiment, audits | `experiments/patterns/`, `experiments/patterns-codex/`, `experiments/comparisons/`, `experiments/brakes/`, `experiments/game/`, `experiments/audits/` |
| Golden packages, and recorded runs | `fixtures/golden/`, `fixtures/runs/` |
| Documents | `docs/runs.md`, `docs/targets/`, `docs/comparisons.md`, `docs/claims.md`; decisions 0008, 0009, 0011, 0012, 0029, 0030, and the part of 0025 about what a subgrooph's refresh refuses |

## Tests

`pnpm -r test` runs the lab's with the rest, and CI runs that on every pull request.

```bash
pnpm --filter @grooph/lab test
```

That is two sets:

- **`lab/test/`**: the command started as a program; export for both harnesses against `fixtures/golden/`, byte for byte; the frozen game experiment's package against its manifest (`experiments/game/setup/starting-contents.claude-code.sha256`); adoption; and the two proving runners' dry runs.
- **Every runner test**: `scripts/lib/*.test.mjs` and `scripts/prove-codex.test.mjs`. Five of these ran nowhere in CI before the lab had a test script: the tests of `compare-run`, `compare-prompt`, `compare-lead`, `compare-score` and `compare-projects`. One is not the lab's own: `watching-check-paid.test.mjs` tests the watching check's runner, which is built on these.

What the tests do not reach, measured with Node's own coverage over the lab's tests and every runner test:

- `scripts/lib/prove-pattern.mjs` beyond its dry run, and `scripts/prove-codex.mjs` beyond its dry run and the functions its own test calls: every path that would start a session, and each one's `--check` from the command line.
- `scripts/lib/prove-check.mjs`: loaded, and none of its functions run by a test. (CI's `node scripts/field-guide.mjs --check` does run it.) `prove-evidence.mjs` and `prove-ledger.mjs` are named by no test and are run in part, through the runners that import them.
- `scripts/lib/prove-summary.mjs`, `compare-seen.mjs` and `compare-summary.mjs`: never loaded.
- The command line of `scripts/compare.sh` (`--status`, `--derive`, `--judge`, `--next`, `--score`, a dry run, a paid run): `compare-run.test.mjs` tests the functions under it.
- `scripts/e2e-claude-code.sh` in any mode. Its dry run rewrites `~/.claude.json` (it grants a trust entry and takes it away), so it is run by hand only.
