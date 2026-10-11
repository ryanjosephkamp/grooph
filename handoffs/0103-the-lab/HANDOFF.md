# Handoff 0103 · The lab: the directing side in a folder of its own

**Stage:** 25 · **Lane:** Opus 5.5 · **Effort:** extra high (high is the floor: below it a seam is cut in the wrong place and found four pull requests later) · **Browser tests on port:** 4367 · **Branches:** `slice/0103-lab-1-…` to `slice/0103-lab-6-…`, one per pull request, each from `main` · **Drafted:** 2026-10-11 · **Confirmed by owner:** the step, on 2026-10-11 in the driver's chat ("I'm fine with doing the lab after tomorrow's reset, but if you think we could or should do that before the reset, then that's fine as well"); the lines under "Design already decided" marked *his* wait for his word on the review desk

## Objective

[Decision 0032](../../docs/decisions/0032-grooph-draws-and-watches.md) made grooph a tool that draws workflows and watches them. What directs a session (the compilers and their packages, brakes a run obeys, adoption, run folders, the proving and comparison runners) is to be kept as a lab in the repository: **it keeps building and keeps its tests, it is not in the npm package, not in the app and not on the site, and nothing is deleted.** This slice makes that lab. It is the fourth step of the decision's order of work, and the site's rewrite (the seventh) waits on it.

When it is done there is a private workspace package at `lab/` with a command of its own, `grooph-lab`, that does everything `grooph` does today; the product's command, MCP server and app no longer offer a package, adoption or run folders; and the same bytes come out of the compilers as before.

**The owner's condition, in his words (2026-10-11):** "I am not changing my mind about the pivot, but I also don't want to throw away something that could actually be useful for longer, bigger, or more complex use cases." He means to run larger experiments with the old line later, in Claude Code and in Codex. So the lab is not an attic. After every pull request of this slice these must work from the repository, and CI must keep proving it:

```bash
pnpm install && pnpm -r build
node lab/bin/grooph-lab.js export <graph> --target claude-code --into <project> [--models …]
node lab/bin/grooph-lab.js export <graph> --target codex --into <project>
node lab/bin/grooph-lab.js adopt <project>/.grooph/<id>/runs/<run> [--allow …] [--write]
scripts/prove-pattern.sh <template> --dry-run
node scripts/prove-codex.mjs
experiments/game/setup/make-repo.sh --out <a scratch folder>
```

## Success criteria

1. **The lab's command is a superset.** `node lab/bin/grooph-lab.js <anything grooph 0.4.1 accepts>` gives what `grooph` gave at `main` before this slice. Shown by the lab's own tests (the CLI tests that leave the product run there) and by CI's golden-package step run through `grooph-lab`.
2. **The compilers' bytes do not change.** `fixtures/golden/**` is untouched and CI's "export matches the golden packages" step passes at every pull request. And the frozen game's package is the same before and after: export `experiments/game/arena.grooph.json` for `claude-code` with the models its README names into a scratch folder on `main` before pull request 1, again after each of pull requests 1, 2 and 5, and `diff -r` the two (say what it printed). `experiments/game/setup/make-repo.sh --out <scratch>` is run at the same moments and must print the same thing each time. It may stop at its frozen manifest on `main` already, since the event hook changed after the freeze (`starting-contents.claude-code.sha256` pins the hook's bytes): that refusal, naming the same files, is then the expected answer, and its own text says how the experiment is built from the freeze.
3. **The product offers none of it.** After pull requests 2 to 5: `grooph export`, `grooph adopt`, `grooph runs` and `grooph watch <run>` do nothing and exit non-zero, with one line that says the command is no longer part of grooph and where it went (version 0.4.1 on npm still has it; the repository keeps it as a lab), and no help page or did-you-mean names them; `grooph mcp`'s tool list has no `grooph_export`; the app has no package half in its Export panel, no Adopt and no "Apply to a copy"; `packages/core/src/index.ts` exports no compiler, no profile and no adoption. Each shown by a test that fails if the thing comes back.
4. **Nothing the tarball ships holds a lead's brief.** `scripts/pack-check.sh` gains a check that the bundle contains no text of `compile/*/lead.ts`, and passes.
5. **Nothing recorded stops being viewable.** A `*.grooph-run.json` file, a share link that carries a run, `#/open`, `#/embed` with its replay, `#/run/<key>` and a run already stored on a person's device all open as before. Shown by the existing browser tests for them, still passing, and one new one for a stored run opened after the change.
6. **Nothing is deleted.** For every pull request, `git diff --stat -M main...HEAD` shows moves and edits; every line of product code removed exists in `lab/` (say how you checked: the handback lists each file split and where each half went).
7. **`main` is green after each pull request**: every job, read line by line, and CI's own budget lines quoted in the description.
8. **Every sentence a model or a person reads that changed is listed** in its pull request's description, before and after, so the owner can read them without the diff: the MCP server's instructions and tool descriptions, `next:` lines, help text, the npm README, the chat skill, site pages.

## Read first

1. `handoffs/0103-the-lab/HANDOFF.md` (this file)
2. [`INVENTORY.md`](INVENTORY.md) beside it: what moves by path, every edge that crosses the line with file and line, what guards the moving parts, and thirteen surprises. It is a reader's report, checked by nobody: verify a line before you lean on it, and say in the handback where it was wrong.
3. `docs/decisions/0032-grooph-draws-and-watches.md` and `spec/contract.md`
4. `AGENTS.md` and `handoffs/README.md`
5. `docs/graph-ir.md` §5 (the package contract) and `docs/runs.md`, for what the moving code is
6. `experiments/game/FROZEN.md` and `experiments/game/setup/make-repo.sh`, for what must not shift under the frozen experiment

## Allowed changes

- New: `lab/**` (the package, its command, its tests, its README, and `lab/web/**` for the app's parked half); the workspace files that admit it (`pnpm-workspace.yaml`, the root `package.json`, `pnpm-lock.yaml`).
- `packages/core/**`, `packages/cli/**`, `apps/web/**`, `plugins/**`: only what takes the directing side out or gives the lab a seam to stand on.
- `scripts/**` and `experiments/game/setup/make-repo.sh` with the code block in `experiments/game/README.md`: only the lines that name the command or the compiler's folder.
- `.github/workflows/ci.yml` and `deploy.yml`, `scripts/pack-check.sh`, `scripts/kit-check.sh`, `scripts/first-run.sh`: the steps that call what moved.
- Generated files, by their generators: `docs/cli.md` and whatever else a `--check` then asks for.
- `docs/quickstart.md`, `docs/agents.md`, `packages/cli/README.md`, `plugins/grooph-chat/**`: only the sentences that would otherwise promise a command that is gone, in the pull request that removes it.
- For pull request 6 only: the layout block and the banner of `AGENTS.md`; `fixtures/README.md` and `experiments/README.md`; and one line at the head of each document under `docs/` that describes the lab (`docs/runs.md`, `docs/targets/*.md`, `docs/comparisons.md`), saying that it does. Not a decision record, and not a page the site shows without the owner's word for that pull request.
- `handoffs/0103-the-lab/**`.

## Forbidden changes

- **No byte of what a compiler writes.** Not a word of a lead's brief, an agent file, a kickoff or a mapping note. The golden packages and the game's frozen starting contents are the proof.
- **`--for-export` stays on the product's `validate` and `apply`** in this slice. A lead's brief tells a lead to run them (`compile/claude-code/lead.ts`, `compile/codex/lead.ts`).
- **`fixtures/golden/**`, `fixtures/runs/**`, and every record under `experiments/**`** (run folders, ledgers, transcripts, results). They stay at their paths: over a hundred files under `experiments/` and twenty pattern documents cite those paths, and a record's path is part of the record.
- **The loop rules.** The decision makes them advice asked for by name; that is a slice of its own, after this one. Do not touch a rule's code, severity or fixture.
- **The watching side**: `packages/cli/hooks/**`, `grooph hooks`, `sessions`, `events`, `watch --sessions`, `watch --map`, the MCP tools `grooph_plan`, `grooph_note`, `grooph_running`, `experiments/watching/**`, `experiments/hooks/**`. Other lanes are working there: slice 0104 in `packages/core/src/events.ts` and a new file beside it, with one new export line in core's `index.ts`; slice 0108 in `packages/cli/src/commands/hooks.ts`, `events-io.ts` and `paths.ts`; slice 0111 in `scripts/lib/watching-check-paid.*`. Leave those files alone, and leave `nodesLive` and `overlayRun` in `events.ts` (the run screen that stays reads them).
- **Three files are shared and are yours only while pull request 2 is open**: `packages/cli/src/index.ts`, `commands/help.ts` and `commands/watch.ts`. Tell the driver when you open that pull request and when it merges; slice 0108 makes its few lines in them before or after, never during. `.github/workflows/ci.yml` is yours; slice 0111 adds no step to it.
- **The version**, `docs/PROGRESS.md`, `docs/PLAN.md`, `docs/HISTORY.md`, `handoffs/DRIVER.md`, any decision record, `spec/**`.
- **The site's rewrite.** The front page, the field guide, the questions page, the guide and the blog drafts say what they say until step seven. Change a sentence only where it names a command this slice removes, and list it.
- A new dependency. A pushed branch rewritten. A merge.

## Spec constraints that apply here

- `spec/contract.md`: "It never directs a session. Nothing it ships makes a model follow a graph." and "It never adds to what a model reads or has to do, unless the person asked for exactly that." Pull request 3 changes what a model reads from the MCP server; hold every changed sentence to those two lines.
- Decision 0032, "What stays, what moves, what changes" and "Not decided here": the lists this slice carries out.
- No model session is started by this slice: nothing is run or paid for in this push without the owner's word for it. Every runner is exercised with `--dry-run`, `--check` or the stand-in harness (`scripts/lib/fixtures/stand-in-harness.mjs`).
- Decision 0022: American English in everything public.

## Design already decided

**The driver's.**

- **One private workspace package at `lab/`**: `@grooph/lab`, `"private": true`, command `grooph-lab`. It handles what leaves the product and passes every other command to the product's own `run()`. It cannot reach npm: the published package is bundled from `packages/cli/dist/src/main.js` alone.
- **Code moves; records, runner scripts, fixtures and the lab's documents stay at their paths** and are named as the lab's in `lab/README.md`, which is the lab's index: what is in it, where each thing lives, and the commands above. The decision's "a lab in the repository" is that package plus that index.
- **Six pull requests, in this order**, since the command line and the app must stop importing before core's files can move. `INVENTORY.md` §5 has each one's files, checks and risks.
  1. The lab's command as a pass-through, and the runners pointed at it. Additive: nothing leaves the product. Run `make-repo.sh` once on `main` first, for the baseline of criterion 2. The lab's `test` script runs every `scripts/lib/*.test.mjs`; five of those are not in CI today, and if one is red on `main`, report it and leave it red and listed. Do not repair a runner here.
  2. The command line: `export`, `adopt`, `runs`, `watch <run>` leave the product.
  3. The MCP server: `grooph_export` leaves; `grooph_validate` no longer checks for export by default; the authoring tools' closing lines stop naming a package; the opening instruction about `grooph_plan` becomes an offer and not an instruction.
  4. The app: the package half of the Export panel, Adopt and "Apply to a copy" leave.
  5. Core: the files move to `lab/`, with the seam for a subgrooph's refresh.
  6. Labels and what is left: `lab/README.md` complete, a line at the head of each of the lab's documents, `AGENTS.md`'s layout. What the site stops publishing is in this pull request only as far as the owner has said (below).
- **A draft pull request at the first push of each, and a fresh reader before it is marked ready.** Then send the driver the head, and push nothing more to it.

**The owner's, proposed here and waiting for his word on the review desk.** Build to these; if he answers otherwise the driver tells you before the pull request it touches.

- **A recorded run stays something the product can show.** The share kind, the `*.grooph-run.json` file, `#/open`, `#/embed` with its replay, `#/run/<key>` and import all stay. Only reading a run *folder* goes to the lab (`grooph-lab runs bundle` makes the file).
- **The run screen stays as a reader.** Adopt and "Apply to a copy" leave it. Its live half stays in the app, fed only by `grooph-lab watch <run>`, so that a lab run can still be watched during the larger experiments he wants to keep possible.
- **`grooph sub update` lists and applies every change** in the product; what it refused is a hold the lab passes in (`refreshSubgrooph(…, { holds })`). A result with a new error is still not written: that is the checker.
- **The app's package half is parked under `lab/web/`**, type-checked, with its unit tests running. Its four browser specs are kept as files and not run. This is the one place "keeps its tests" is not fully met, and the handback says so.
- **The front page's recorded run, and the records the site publishes** (`deploy.yml` copies `experiments/patterns` and `experiments/comparisons` to the site) **stay as they are in this slice.** They are the site's, and the site is step seven.

## Implementer's choices

- How the lab is laid out inside `lab/`, and how its command hands a product command through.
- Which internal subpaths `packages/cli/package.json` exports to the lab, and how the MCP server is given one more tool.
- Whether pull requests 2 and 3 are one, and whether 4 is two. Smaller is better; a pull request the owner can read on a phone is the measure.
- Mixed test files: copy whole to the lab and trim in the product, or split. Say which, per file.
- **One thing to look into and propose, not do:** the repository itself holds a placed package (`.grooph/slice-0007-sandwich/`, two agent files under `.claude/agents/`, a skill under `.claude/skills/`), so every Claude Code session opened here is offered those agents and that skill. Find what reads them (a test, a fixture, a document) and say in the handback of pull request 1 what moving them under `lab/` would take. The owner decides.

## How to verify

Per pull request, from the worktree, and quoted in its description:

```bash
pnpm install --frozen-lockfile && pnpm -r build && pnpm -r test
GROOPH_E2E_PORT=4367 pnpm --filter @grooph/web exec playwright test        # pull requests 4 and 5; one file: playwright test e2e/<file>
node scripts/cli-reference.mjs --check && node scripts/site-pages.mjs --check
node scripts/perf-budget.mjs --check && scripts/pack-check.sh && scripts/kit-check.sh
node scripts/american-english.mjs --check
node lab/bin/grooph-lab.js export experiments/game/arena.grooph.json --target claude-code --into "$TMPDIR/arena-after" --models frontier=claude-opus-5-5,strong=claude-sonnet-5-5,fast=claude-sonnet-5-5 && diff -r "$TMPDIR/arena-before" "$TMPDIR/arena-after"
experiments/game/setup/make-repo.sh --out "$TMPDIR/game-after" > "$TMPDIR/make-repo-after.txt" 2>&1; diff "$TMPDIR/make-repo-before.txt" "$TMPDIR/make-repo-after.txt"
```

(Before pull request 1 the first of those two lines is run with `node packages/cli/bin/grooph.js`. Scratch folders only; `make-repo.sh` builds outside the clone and pushes nothing.)

Never run CI's steps wholesale: the browser tests' default port belongs to another project on this Mac. Never serve anything under `experiments/game/acceptance/` and never use port 4361.

## Handback must contain

The `TEMPLATE-HANDBACK.md` sections, written after the last pull request (a short note to the driver after each one before it), plus:

- For each pull request: its number and head, what left the product, where it went, and each changed sentence a model or a person reads.
- Every file that was split, and where each half is.
- Where `INVENTORY.md` was wrong.
- What "keeps its tests" does not cover in the lab as built.
- The runner tests that were red on `main` before you began, if any.
- What the placed package at the repository's root would take to move.

## Prompt to paste

```text
You are a lane of grooph: slice 0103, the lab. Read handoffs/0103-the-lab/HANDOFF.md first, then INVENTORY.md beside it, then AGENTS.md and the decision and contract it names. Work in your own worktree, one branch from main for each of the six pull requests (slice/0103-lab-1-…), a draft pull request at the first push of each. Browser tests on port 4367 (GROOPH_E2E_PORT). Do not edit docs/PROGRESS.md, docs/PLAN.md or handoffs/DRIVER.md, start no model session, and merge nothing. Before each pull request is marked ready, have a fresh reader read it; then send the driver its head with SendMessage and push nothing more to it. Begin with pull request 1, and finish the slice with the grooph-handback skill.
```
