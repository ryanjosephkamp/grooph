# Slice 0103 · the lane's notes, one section per pull request

Kept by the lane as it goes, for the driver after each pull request and for `HANDBACK.md` at the end. A figure here was read off a command's output at the head named beside it.

## Before anything changed: the baseline

Taken on `main` at `da6c3874`, built there (`pnpm install --frozen-lockfile && pnpm -r build`).

- **The frozen game's package.** `node packages/cli/bin/grooph.js export experiments/game/arena.grooph.json --target claude-code --into <scratch> --models frontier=claude-opus-5-5,strong=claude-sonnet-5-5,fast=claude-sonnet-5-5` exits 0, prints nothing to standard error, and writes **10 files**.
- **`experiments/game/setup/make-repo.sh --out <scratch>`** exits 1 at its frozen manifest on **one line**: `.grooph/hooks/grooph-event.mjs`, frozen `c28e9b2e…` against built `836cb61e…`. It names the compiler as `adadaf13…`. The other sixteen files it built are the frozen ones.
- **The runner tests**, all twelve files, the five CI does not run included: `node --test scripts/lib/*.test.mjs scripts/prove-codex.test.mjs` gives 169 tests, 169 pass, 0 fail. None was red on `main`.
- **The runners' modes that call no model** all exit 0: `scripts/prove-pattern.sh review-gate --dry-run`, `node scripts/prove-codex.mjs`, `node scripts/lib/brake-run.mjs --check`, `node scripts/lib/compare-arms-ef.mjs --check`.

## Pull request 1 · the lab's command as a pass-through

**What it adds.** `lab/`, a private workspace package (`@grooph/lab`, version `0.0.0`, so it is not a ninth place the version is written) with the command `grooph-lab`, which hands every command to the product's `run()`. Nothing left the product. Five runners start the lab's command instead of the product's: `scripts/lib/prove-pattern.mjs`, `scripts/prove-codex.mjs`, `scripts/lib/compare-run.mjs`, `scripts/lib/brake-run.mjs`, `scripts/e2e-claude-code.sh`. Each also asks that the lab is built where it already asked that the CLI is. (At the first head, `8d2c1c0f`, that was true of four: the reader found `brake-run.mjs` and, behind it, `compare-arms-ef.mjs` still asking for the CLI's build alone, with five tests in three files skipping on the same question. The commits after it add the lab's build to all five places. `prove-codex.mjs` asks only on its `--check` and evidence paths, as it did before this slice: its dry run meets an unbuilt lab as a module that is not found.)

**Not in it, on the driver's word (2026-10-11):** anything under `experiments/game/`. `make-repo.sh` still starts the product's command, which still has `export`. Its two lines (70, which builds what 71 runs, and 71) change in pull request 2.

**The shim a run finds as `grooph`.** `prove-pattern.mjs`, `compare-run.mjs` (arm A) and `e2e-claude-code.sh` put a `grooph` on a session's path so that a lead can check an amended working copy. It now starts the lab's command. A session in a lab run therefore finds what it found before this slice: every command, `export` included.

**What the lab's `test` script runs.** Its own tests under `lab/test/` (8 at the pull request's last head; 7 at its first), then every runner test (169): 177 in all. CI's two named steps that run six of those files and `prove-codex.test.mjs` are left as they are, so those seven files run twice in a job, about half a minute. Dropping the duplicate lines is a change to `ci.yml` that pull request 2 could carry, if the driver wants it.

**What was not run.** `scripts/e2e-claude-code.sh --dry-run` rewrites `~/.claude.json` (it grants a trust entry and takes it away), and other sessions on this Mac have that file open. The script was checked with `bash -n`. Two of its lines changed and a comment was added: the path its `export` and its shim start, and the preflight that asks whether the tools are built, which nothing has executed since.

### The placed package at the repository's root: what moving it would take

**What is there.** `.grooph/slice-0007-sandwich/` (14 files: `LEAD.md`, `KICKOFF.md`, `MAPPING.md`, `graph.grooph.json`, and one run, `runs/20260919-0057-66c8/`, 10 files), `.claude/agents/slice-0007-sandwich--builder.md` and `--critic.md`, and `.claude/skills/slice-0007-sandwich/SKILL.md`. It is the package slice 0007 was run from on 2026-09-19.

**What it does today.** Claude Code offers the two agents to every session opened in this repository: this lane's own list of agent types holds `slice-0007-sandwich--builder` and `slice-0007-sandwich--critic`. The skill is offered to the person only (`disable-model-invocation: true`). `handoffs/0104-the-live-graph/RECORDS.md:25` counts four subagents of those two types in this project's own sessions.

**What reads it.** One check, and nothing else that runs. `scripts/american-english.mjs` reads every tracked text file under `.claude/skills/`, so it reads the skill (one of its "806 public-facing files"); moved under `lab/`, the skill leaves that check, and the count becomes 805. No test, other script, generator or workflow opens any of the seventeen files: the tests read the copy under `fixtures/runs/slice-0007-sandwich/`, which `fixtures/runs/README.md:7-8` says was made from it. What names the paths is the record: `handoffs/0007-web-templates/` (the handoff's prompt at line 94, the handback, the fix pass), `handoffs/0008-runs/` (handoff and handback), `handoffs/0084-default-tiers/HANDBACK.md:78`, `handoffs/DRIVER.md:70`, a status page of 2026-09-20 under `handoffs/briefs/`, and that fixtures page. (`apps/web/e2e/runs.spec.ts:122`, an audit probe, and four graph and ops documents, `.grooph/graphs/slice-0007-sandwich.grooph.json` and three under `fixtures/runs/`, hold the path as text inside a graph or a scratch folder, and open nothing at the root.)

**What moving takes.** One commit of `git mv`, seventeen files, into a folder under `lab/`, for instance `lab/records/slice-0007-sandwich/`. No code changes and no test changes. One sentence in `fixtures/runs/README.md` and one line in `lab/README.md` say where it went; the handoffs of slices 0007 and 0008 are records of their day and would keep the old paths.

**One thing not tested, which decides the layout.** The point of moving is that a session opened here is offered no agent and no skill that grooph compiled, which is what the contract asks of grooph everywhere else. Claude Code lists skills from a `.claude/skills/` folder nested below the project's root; whether it also finds a nested `.claude/agents/` was not tried. So a move that keeps the folder's name (`lab/records/slice-0007-sandwich/.claude/…`) may not achieve that. The safe layout renames the two harness folders in the move (`claude/agents/`, `claude/skills/`), at the cost that the record is no longer a package a person can copy into a project as it is; the record would say so.

**What stays either way.** `.grooph/graphs/slice-0007-sandwich.grooph.json` and `.grooph/proposals/slice-0007/` are drawings, and no harness reads them. `.grooph/hooks/` and `.claude/settings.json` are the event hook, which is the watching side's.

**One thing to weigh.** With the folder gone from the root, `grooph-lab runs list .` there lists nothing, and the three commands `handoffs/0008-runs/HANDBACK.md:78-80` gives for that folder no longer work as written.

## Pull request 2 · the command line

**What left the product's command line:** `export`, `adopt`, `runs`, `watch <folder>`, and `share` and `embed` of a run folder. `grooph` answers the first three, asked for or asked about (`grooph help export`, `grooph export --help`), with one line and exit code 1; `grooph watch <folder>` with another. No help page, and no "did you mean", names them.

**`watch` takes no folder at all.** Through 0.4.1 a folder could also be a project's, and `grooph watch <project> --sessions` then served that project's sessions: undocumented, used by no script or document here, and a watching use. It is refused with the rest, because telling a project's folder from a run's is reading a run folder. `grooph watch --events <project>` adds another project's sessions, and the line for a folder says so.

**Every removed line is in `lab/`, but for ten sentences that are in neither place.** They were the product's own words about `export`, and they were reworded or dropped, not moved: the two lines of `help apply`; `help plan`'s sentence; the end of the plan's second sentence, in the command and in `PLAN.md`; the `next:` lines of `pick` and of `validate --for-export`; share's ", or grooph runs bundle"; "export refuses unfilled slots" in `template use` and `sub`; and the old refusal to write a kept graph. Criterion 6 is met for code and not for those words.

**Where each thing went.**

| From the product | To |
|---|---|
| The `export`, `runs` and `adopt` cases of `packages/cli/src/index.ts`, and the `watch`, `share` and `embed` cases as they were | `lab/src/index.ts`, with a copy of the dispatcher's usage line and its error handling for the lab's own commands |
| `EXPORT_HELP`, the tier lines, the overview and the list of commands as they were (`commands/help.ts`); `SHARE_HELP` and `EMBED_HELP` as they were | `lab/src/help.ts` |
| `commands/adopt.ts`, `commands/runs.ts`, `run-io.ts` | `lab/src/commands/adopt.ts`, `lab/src/commands/runs.ts`, `lab/src/run-io.ts` (moved whole) |
| `watchTarget`, `currentRun`, the run's line and `WATCH_HELP` as it was (`commands/watch.ts`) | `lab/src/commands/watch.ts` |

**Files split, and where each half is.**

- `packages/cli/src/commands/watch.ts`: the server, the sessions and the map stay; which run a folder means is the lab's (`lab/src/commands/watch.ts`). The product's `startWatch` and `watchCommand` take one optional argument, `follow`, that `grooph` never passes; the lab's `watch` passes it. So there is one server.
- `packages/cli/src/commands/share.ts` and `embed.ts`: each takes one optional argument, a document already read, that `grooph` never passes. The lab reads a run folder into a bundle and hands it over (`runIn` in `lab/src/index.ts`).
- `packages/cli/src/commands/help.ts`: what is said of the commands that stay, stays; the rest is `lab/src/help.ts`. `nearestCommand` takes a list, so the lab's "did you mean" still knows `export`.
- `packages/cli/src/commands/export.ts`: **not moved yet.** The MCP tool `grooph_export` (`mcp-author.ts:78`) imports fourteen names from it, and that tool leaves in pull request 3. Nothing in the product's command line reaches it. Two helpers changed hands on the way: `shellWord`, which `plan` uses, is in `reply.ts`; `NOT_JUDGED`, which `adopt`, `export` and the MCP tool say, is defined in `export.ts` until that file moves.

**The tests: split, each test living once.** No test file moved whole. A test that needs `export`, `adopt`, `runs`, `watch` with a folder, or `share` or `embed` of a run folder moved to `lab/test/` under its file's name and runs against the lab's command; the rest stayed. A test that mixed both was cut in two, or moved whole where its halves do not come apart.

| File (`packages/cli/test/`) | Moved to `lab/test/` | Stayed | Cut in two |
|---|---|---|---|
| `cli.test.ts` | 7 (the six of export, and validate of a run's working copy) | 17 | "bad invocations fail with usage" (export's three lines) |
| `export-brakes.test.ts` | 15 | 1, and a new half: no command of grooph's writes a kept graph, on a kept graph placed by hand | |
| `friction.test.ts` | 1 | 11 | the overview and every command's page; what comes next at a terminal |
| `map.test.ts` | 1 | 6 | |
| `plan.test.ts` | 1 | 11 | the kept graph and the package beside it; a person's step and export; a plan template and export |
| `runs.test.ts` | 23 (runs, adopt, share of a run folder, watch of a run) | 1, and two new halves: what `grooph watch` prints, and the sessions it serves | |
| `third-pass.test.ts` | 6, whole (four also call the MCP tool, through `@grooph/cli/mcp`) | 15 (every one that reaches export only through the tool) | |
| `template.test.ts`, `embed.test.ts` | | all | one each: export of a filled template; embed of a run folder |
| `share.test.ts` | | all, with the pick's `next:` line now asserted absent | |
| `codex-tiers.test.ts`, `mcp-author.test.ts`, `mcp.test.ts`, and eight more | | untouched: they call `exportCommand` or the tool, which move in pull request 3 | |

New: `packages/cli/test/gone.test.ts` (6 tests) is the product's side of criterion 3. In `lab/test/command.test.ts` the comparison with the product is kept for what is still the product's, and the product is shown to answer with its one line for what left.

Counts, built from clean: core 597 before and after; cli 242 to 197; the lab's own 8 to 70; 250 to 267 together. The 17 more: 6 in `gone.test.ts`, 8 lab halves of cut tests, 3 product halves. `packages/cli/test/runs.test.ts` now holds only `watch` tests and `export-brakes.test.ts` only the kept graph's; their names are left for pull request 3, which empties or renames them.

**What was compared with the command as it was.** A scratch build of `da6c3874` (the `main` this slice began from), this pull request's `grooph`, and this pull request's `grooph-lab`, each started as a program on the same fifty invocations and compared by exit code, standard output and standard error (the script is the lane's, `compare.mjs`; its output is in the pull request).

- `grooph-lab`: 48 of 50 the same. The two that differ are `help apply` and `help plan`, the product's own pages, which lost their sentences about `export`.
- `grooph`: 21 the same, among them every `share` and `embed` of a file (a graph, a proposal set, a run's bundle, an operation map, with flags and with errors: 13 invocations). The 29 that differ are the commands that left, their pages, the overview, a folder given to `share`, `embed` or `watch`, two usage lines, and `help apply` and `help plan`.
- `watch`, started and stopped in a project with no run, with a run, with `--sessions`, and on a run's own folder: `grooph-lab watch` prints what the old command printed in all five; `grooph watch` prints the sessions' lines without the run's, opens on the sessions, and refuses the folder.

**What this pull request changed outside the command line, in one sentence each.** The MCP tool `grooph_export_plan`'s reply and the `PLAN.md` it returns lost "grooph export writes its package for <harness>." (`mcp-author.ts:956` builds its line with the command's `forAHarness`), and so does the app's plan export (`apps/web/src/doc/plan.ts:17`, through core). The run's endpoint of the product's `watch` answers, as JSON, that no run is followed; the app's run view shows that as its reason.

**What the fresh reader found, at `5022e68e`.** No way for the product to reach export, adoption, a run folder or a followed run (500 invocations), and the lab's dispatcher the same as the old one on the six commands that moved. Wrong: the npm README and the agents' page each still said what `grooph export` does; the kept-graph refusal said "grooph does not write it" while the MCP tool does; the run's endpoint answered as plain text, which makes the app say there is no grooph watch; five reworded sentences were held by no test; and eight claims of the description. All fixed in `7130b18f`, which no reader but the lane has read.

**Left for others, seen on the way.** `README.md:28,31` (the repository's own quickstart ends in `grooph export`); `plugins/grooph/skills/grooph-design/SKILL.md:43` (the design skill's step 7 tells an agent to run `grooph export`; it works only through the MCP tool until pull request 3, and not at all after it, so that step should change no later than pull request 3); `docs/subagents.md:178` and `docs/HANDBACK-operator.md:249` (`grooph watch <run folder>` shows the run view); `packages/cli/scripts/npm-package.mjs:163` (the published package's description says it compiles).

**Why the handoff's order and not the MCP tool first.** With the tool first, each file would move once. The handoff fixes the order and keys the three shared files to pull request 2, and its order already implies `export.ts` stays while the tool does; so the order stands and one file waits.

**Where the lab's command is not, word for word, what `grooph` 0.4.1 was.** In what it does, it is a superset. In what it says, it hands the product's commands on as they are now, so it differs exactly where the product's own words changed. The six pages it answers itself (`export`, `adopt`, `runs`, `watch`, `share`, `embed`), the overview and the "did you mean" are as they were. The fresh reader tried 500 invocations against the build of `da6c3874` and found 27 that differ: `help apply` and `help plan` (6), the plan's second line (5), `template use` with a slot unfilled (3), `pick`, whose `next: grooph export …` line went to a pipe as well as a terminal (2), the kept-graph refusal (6), and five odd names (`help constructor`, `toString -h`) that the old command answered with a function's text and the lab calls unknown. Two of these were true of the lab and are no longer said by it: `pick`'s next step, and that `grooph export` writes a kept graph. In a lab run, where the lab's command is on the path as `grooph`, a lead that tries to write the kept graph is now told "No command of grooph's writes it", though `export` there does. Whether the lab should say the old words is the owner's to decide; it would take the lab answering `pick`, `plan`, `apply` and `template` itself.

## Where `INVENTORY.md` was wrong, so far

- §5, row 1 lists `experiments/game/setup/make-repo.sh:62-71` and the game's README for pull request 1. Lines 62 to 64 name the compiler's folder, which is still `packages/` until pull request 5; and the driver moved the script's change to pull request 2.
- §5, row 1, "the five untested-in-CI runner tests may already be red *(inferred)*": they are green.
- §5, row 2 misses `apps/web/e2e/adopt-brakes.spec.ts:360`, which starts the product's `adopt` as a program, so CI's browser job fails the moment `adopt` leaves the command line. Pull request 2 points that one line at the lab's command; pull request 4 parks the spec.
- §5 puts `scripts/kit-check.sh:47` and the chat skill's last step in pull request 3 (the MCP server). Both name the command line's `export`, which the skill's script loses in pull request 2, so they changed there.
- §4's row for the CLI reference names `docs/cli.md`'s opening sentence ("compiles") and not where it is written: `scripts/cli-reference.mjs:58`, the generator's own text.
- §2 edge 10 says the product's `watch` "serves sessions and map only". It does; and `--sessions`, which chose the sessions over a run, is still taken and now changes nothing, since decision 0032 lists `watch --sessions` among what stays and `scripts/pack-check.sh` starts it that way.
