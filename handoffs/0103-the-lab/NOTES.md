# Slice 0103 · the lane's notes, one section per pull request

Kept by the lane as it goes, for the driver after each pull request and for `HANDBACK.md` at the end. A figure here was read off a command's output at the head named beside it.

## Before anything changed: the baseline

Taken on `main` at `da6c3874`, built there (`pnpm install --frozen-lockfile && pnpm -r build`).

- **The frozen game's package.** `node packages/cli/bin/grooph.js export experiments/game/arena.grooph.json --target claude-code --into <scratch> --models frontier=claude-opus-5-5,strong=claude-sonnet-5-5,fast=claude-sonnet-5-5` exits 0, prints nothing to standard error, and writes **10 files**.
- **`experiments/game/setup/make-repo.sh --out <scratch>`** exits 1 at its frozen manifest on **one line**: `.grooph/hooks/grooph-event.mjs`, frozen `c28e9b2e…` against built `836cb61e…`. It names the compiler as `adadaf13…`. The other sixteen files it built are the frozen ones.
- **The runner tests**, all twelve files, the five CI does not run included: `node --test scripts/lib/*.test.mjs scripts/prove-codex.test.mjs` gives 169 tests, 169 pass, 0 fail. None was red on `main`.
- **The runners' modes that call no model** all exit 0: `scripts/prove-pattern.sh review-gate --dry-run`, `node scripts/prove-codex.mjs`, `node scripts/lib/brake-run.mjs --check`, `node scripts/lib/compare-arms-ef.mjs --check`.

## Pull request 1 · the lab's command as a pass-through

**What it adds.** `lab/`, a private workspace package (`@grooph/lab`, version `0.0.0`, so it is not a ninth place the version is written) with the command `grooph-lab`, which hands every command to the product's `run()`. Nothing left the product. Five runners start the lab's command instead of the product's: `scripts/lib/prove-pattern.mjs`, `scripts/prove-codex.mjs`, `scripts/lib/compare-run.mjs`, `scripts/lib/brake-run.mjs`, `scripts/e2e-claude-code.sh`. Each also asks that the lab is built where it already asked that the CLI is.

**Not in it, on the driver's word (2026-10-11):** anything under `experiments/game/`. `make-repo.sh` still starts the product's command, which still has `export`. Its two lines (70, which builds what 71 runs, and 71) change in pull request 2.

**The shim a run finds as `grooph`.** `prove-pattern.mjs`, `compare-run.mjs` (arm A) and `e2e-claude-code.sh` put a `grooph` on a session's path so that a lead can check an amended working copy. It now starts the lab's command. A session in a lab run therefore finds what it found before this slice: every command, `export` included.

**What the lab's `test` script runs.** Its own tests under `lab/test/` (7), then every runner test (169). CI's two named steps that run six of those files and `prove-codex.test.mjs` are left as they are, so those seven files run twice in a job, about half a minute. Dropping the duplicate lines is a change to `ci.yml` that pull request 2 could carry, if the driver wants it.

**What was not run.** `scripts/e2e-claude-code.sh --dry-run` rewrites `~/.claude.json` (it grants a trust entry and takes it away), and other sessions on this Mac have that file open. The script was checked with `bash -n`, and the one line of it that changed is the path its `export` and its shim start.

### The placed package at the repository's root: what moving it would take

**What is there.** `.grooph/slice-0007-sandwich/` (14 files: `LEAD.md`, `KICKOFF.md`, `MAPPING.md`, `graph.grooph.json`, and one run, `runs/20260919-0057-66c8/`, 10 files), `.claude/agents/slice-0007-sandwich--builder.md` and `--critic.md`, and `.claude/skills/slice-0007-sandwich/SKILL.md`. It is the package slice 0007 was run from on 2026-09-19.

**What it does today.** Claude Code offers the two agents to every session opened in this repository: this lane's own list of agent types holds `slice-0007-sandwich--builder` and `slice-0007-sandwich--critic`. The skill is offered to the person only (`disable-model-invocation: true`). `handoffs/0104-the-live-graph/RECORDS.md:25` counts four subagents of those two types in this project's own sessions.

**What reads it.** Nothing that runs. No test, script, generator or workflow opens any of those seventeen files: the tests read the copy under `fixtures/runs/slice-0007-sandwich/`, which `fixtures/runs/README.md:7-8` says was made from it. What names the paths is the record: `handoffs/0007-web-templates/` (the handoff's prompt at line 94, the handback, the fix pass), `handoffs/0008-runs/` (handoff and handback), `handoffs/0084-default-tiers/HANDBACK.md:78`, `handoffs/DRIVER.md:70`, a status page of 2026-09-20 under `handoffs/briefs/`, and that fixtures page. (`apps/web/e2e/runs.spec.ts:122` and an audit probe hold the path as text inside a graph or a scratch folder, and open nothing at the root.)

**What moving takes.** One commit of `git mv`, seventeen files, into a folder that keeps the package's own layout, for instance `lab/records/slice-0007-sandwich/.claude/…` and `…/.grooph/slice-0007-sandwich/…`, so that it is still a package a person could copy into a project. No code changes and no test changes. One sentence in `fixtures/runs/README.md` and one line in `lab/README.md` say where it went; the handoffs of slices 0007 and 0008 are records of their day and would keep the old paths. After it, a session opened here is offered no agent and no skill that grooph compiled, which is what the contract asks of grooph everywhere else.

**What stays either way.** `.grooph/graphs/slice-0007-sandwich.grooph.json` and `.grooph/proposals/slice-0007/` are drawings, and no harness reads them. `.grooph/hooks/` and `.claude/settings.json` are the event hook, which is the watching side's.

**One thing to weigh.** With the folder gone from the root, `grooph-lab runs list .` there lists nothing, and the three commands `handoffs/0008-runs/HANDBACK.md:78-80` gives for that folder no longer work as written.

## Where `INVENTORY.md` was wrong, so far

- §5, row 1 lists `experiments/game/setup/make-repo.sh:62-71` and the game's README for pull request 1. Lines 62 to 64 name the compiler's folder, which is still `packages/` until pull request 5; and the driver moved the script's change to pull request 2.
- §5, row 1, "the five untested-in-CI runner tests may already be red *(inferred)*": they are green.
