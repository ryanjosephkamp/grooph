# Handback 0001 · Core, validator, Claude Code compiler, CLI

**Implementer:** Opus 5 · **Branch:** `slice/0001-core-compiler-cli` · **Last code commit:** `e93138f` (this handback is the commit after it, at the branch head) · **Date:** 2026-09-18

## Status

`done` — all six criteria are met. The headless acceptance run passed on 2026-09-18 after the owner signed the CLI in: the compiled package drove a fresh Claude Code session through two loop passes, a real critic rejection, a fix, a bar pass, and a clean halt at the human gate.

## What changed

**Workspace** (all `new`)

- `package.json`, `pnpm-workspace.yaml`, `pnpm-lock.yaml`, `.npmrc`, `tsconfig.base.json`
- `.github/workflows/ci.yml` — install, build, test on Node 22 and 24, then export-and-diff against the golden package and the two CLI checks

**`packages/core`** (all `new`)

- `src/types.ts` — graph-ir §1 transcribed; field order here is the canonical key order
- `src/schema/dsl.ts` — dependency-free schema combinators; each one yields validation with JSON Pointer paths, a JSON Schema fragment, and canonical key order
- `src/schema/graph.ts` — the document schema, declared once, with compile-time assertions that it and `types.ts` describe the same shape (mutual assignability; the build fails if they drift)
- `src/schema/write.ts`, `src/schema/path.ts`, `schema/grooph-0.schema.json` — the published schema, generated, never hand-edited
- `src/parse.ts`, `src/canonicalize.ts`, `src/issues.ts`, `src/graph-index.ts` (id index, adjacency, Tarjan SCCs, path-within-members), `src/semantics.ts` (role families, loop-mode inference, stop descriptions, entry nodes)
- `src/validate.ts` — the ten ★ rules, in graph-ir §3 table order
- `src/targets/index.ts` + `targets/claude-code.profile.json` — the profile as data
- `src/compile/index.ts` (`compile`, `tryCompile`, `CompileError`), `src/compile/markdown.ts`, `src/compile/claude-code/{context,lead,agents,mapping,kickoff,skill}.ts`
- `src/dev/write-golden.ts` — regenerates the golden package
- `test/{fixtures,schema,canonicalize,rules,compile}.test.ts` + `test/helpers.ts` — 50 tests

**`packages/cli`** (all `new`)

- `bin/grooph.js`, `src/index.ts` (arg parsing, usage, exit codes), `src/io.ts`, `src/print.ts`, `src/commands/{validate,canonicalize,export}.ts`
- `test/cli.test.ts` — 12 tests

**Fixtures**

- `new` `fixtures/invalid/<CODE>/…` for the nine ★ codes that had none: `E_SCHEMA`, `E_DUPLICATE_ID`, `E_DANGLING_REF`, `E_LOOP_BACK_EDGE`, `E_JUDGMENT_LOOP_NO_BAR`, `E_STOP_NOT_INSPECTABLE`, `E_NO_TARGET`, `E_NO_GOAL`, `W_DOC_TOO_LARGE`. Each reports exactly its own code and nothing else.
- `new` `fixtures/golden/claude-code/review-loop/` — seven files
- `fixtures/README.md` — gained a "How the fixtures are checked" section
- `fixtures/valid/review-loop.grooph.json` — **unchanged**; no inconsistency with graph-ir was found

**Scripts and docs**

- `new` `scripts/e2e-claude-code.sh`
- `docs/PROGRESS.md` — six lines appended to **In flight** only

## Verified, and how

Run cold: `node_modules` and both `dist` folders deleted first. Head commit `6803982`.

| # | Criterion | Command | Observed |
|---|---|---|---|
| 1 | Clean build | fresh `git clone` of the branch into `$TMPDIR`, then `pnpm install --frozen-lockfile && pnpm -r build && pnpm -r test` | exit 0; 62 tests, 0 failures (core 50, cli 12) |
| 1 | CI green | `gh run list --branch slice/0001-core-compiler-cli` | runs `35299182138`, `35299329288`, `35299735087` — all `success`, Node 22 and 24 |
| 2 | Core API | `pnpm -r test` (core suite) | `parseGraph` / `validate` / `canonicalize` / `compile` exercised; canonical form proved deterministic and idempotent; committed `schema/grooph-0.schema.json` equals what the types generate, and ajv agrees with `parseGraph` on every fixture plus 16 mutations |
| 3 | Rules | `pnpm -r test` (`fixtures.test.ts`) | all ten ★ codes have a fixture; the walk fails if one does not; each invalid fixture reports its code with the right severity; `review-loop` clean with and without `forExport` |
| 4 | Golden package | `pnpm exec grooph export fixtures/valid/review-loop.grooph.json --target claude-code --into /tmp/grooph-pkg && diff -r /tmp/grooph-pkg fixtures/golden/claude-code/review-loop` | no output, exit 0 — identical. Also asserted byte for byte inside `compile.test.ts` |
| 5 | CLI | `pnpm exec grooph validate fixtures/valid/review-loop.grooph.json` | `no issues`, exit 0 |
| 5 | CLI | `pnpm exec grooph validate fixtures/invalid/E_CYCLE_NO_STOP/loop-without-stop.grooph.json` | `error  E_CYCLE_NO_STOP  cycle with no stop: builder → critic. …  [at: builder, critic]` then `1 error, 0 warnings`, exit 1 |
| 5 | CLI | `pnpm exec grooph canonicalize <file> [--write]` | canonical form on stdout; `--write` rewrites then reports `already canonical` on a second run |
| 5 | CLI | `pnpm exec grooph export … --into <dir>` on an invalid document | refuses, prints `cannot export` with the code list, writes nothing, exit 1 |
| 6 | Headless acceptance run | `./scripts/e2e-claude-code.sh` | **PASS.** Run `20260918-0042-k7qm`; every assertion in the script held. See below. |

The handoff's suggested form `pnpm --filter @grooph/cli exec grooph …` does not work: pnpm does not link a package's own bin into its own `node_modules/.bin`. The working forms are `pnpm exec grooph …` from the repo root (a root devDependency on `@grooph/cli` links the bin) or `node packages/cli/bin/grooph.js …`. CI uses the former.

### Acceptance run summary (criterion 6, PASS)

**Run id** `20260918-0042-k7qm` · **rounds** 1 (two passes through the loop: round 0 and round 1) · **stop fired** `bar-passed`, then a halt at the `merge-gate` human gate · **lead turns** 33 (the harness's count) · **cost** $2.32 · **wall clock** 4m25s · **subagents** 4 spawned, 4 completed, 0 failed (`review-loop--builder` ×2, `review-loop--critic` ×2) · **model** `claude-opus-5`, which is tier `strong` resolved through the emitted frontmatter.

What the run did, from its own notes:

| note | at | round | outcome |
|---|---|---|---|
| n-0001 | `graph` | — | run started |
| n-0002 | `node:builder` | 0 | pass (`verdict: done`) |
| n-0003 | `node:critic` | 0 | **fail** (`verdict: fail`) — checklist item 4 unmet |
| n-0004 | `loop:review-cycle` | 0 | fail; stops evaluated, back edge `e-review-fail` taken |
| n-0005 | `node:builder` | 1 | pass — RangeError added |
| n-0006 | `node:critic` | 1 | **pass** — 6/6 items cited, `npm test` 7/7 |
| n-0007 | `loop:review-cycle` | 1 | pass; `bar-passed` fired → pass exit edge |
| n-0008 | `node:merge-gate` | 1 | halt — waiting for a human |
| n-0009 | `graph` | 1 | halt — run ended, stop named |

The parts worth reporting to the driver, because they are the answers this slice was sequenced first to get:

- **The loop did real work.** Round 0 failed on the one checklist item the task description does not spell out (an unreadable string must raise `RangeError`). The builder fixed exactly that in round 1. This was not a rubber stamp.
- **The critic behaved like a critic.** Its `REVIEW.md` cites a file and a line for all six items, and it re-ran `npm test` itself rather than trusting the builder's reported output — which is what its brief tells it to do. Its round-1 verdict line is the exact format the agent file prescribes.
- **Isolation held.** Each round dispatched a fresh subagent; the lead materialised the edge's evidence as files (`diff-r0-src.patch`, `test-output-r0.txt`, …) inside the run folder and pointed the fresh critic at those, rather than pasting a transcript. That is the intended reading of `isolation: fresh`, arrived at by the lead on its own; `docs/targets/claude-code.md` could name the pattern.
- **The gate was not simulated.** The lead stopped at `merge-gate`, wrote `outcome: "halt"` with the resume instruction, and reported that it waits for a human — exactly what `LEAD.md` §7 says to do in a non-interactive session, and what graph-ir §2 forbids it from faking.
- **The file contract holds.** All nine notes parse against the published `RunNote` schema, and the review-loop document with those notes attached still validates for export. Amendment A-007's "the package names the path and the line format" survived contact with a real run.
- **The run proposed graph edits and applied none.** Both proposals landed in `PROGRESS.md` and the notes, as graph-ir §6 requires.

**The one place the lead stepped outside the package's intent**, and it is the graph's fault rather than the compiler's: the critic node declares `REVIEW.md` in its `outputs` while denying `edit-files`, so the compiler correctly withheld `Write` — and the critic then could not write the file it is required to leave behind. The lead saved `REVIEW.md` from the critic's reply itself, and said so in a proposal note. That is the lead doing a worker's job, which §1 of its own brief tells it not to do. See the findings below: the fixture graph is self-contradictory, and no rule in graph-ir §3 catches it today.

Two smaller observations:

- **The lead's turn count and the harness's disagree.** The final note records `cost: {measure: "turns", amount: 25}`; the harness reported 33. `docs/targets/claude-code.md` says `turns` budgets are "enforced by the lead's own counting", and this is what that costs: a 40-turn budget is really "40 of whatever the lead counts". Worth a sentence in the target doc.
- **Eleven `Bash` calls were denied** by the scratch project's deliberately narrow allowlist, every one a compound command (`npm test > out.txt 2>&1; echo $?`, heredocs, `a && b`) that the prefix rules do not match. The run retried simpler forms each time and never fabricated a result — which is its own small piece of evidence. The script now carries a comment saying what to widen.

Reproduce with `./scripts/e2e-claude-code.sh`; it prints all of the above and keeps the scratch directory. **One of the two approved runs is still unused**: the 2026-09-17 invocation failed to authenticate in one turn at `total_cost_usd: 0` and never reached a model.

### The emitted lead brief

`fixtures/golden/claude-code/review-loop/.grooph/review-loop/LEAD.md`

The hardest thing to express was the evidence-and-isolation rule. Everything else in the brief is a fact the lead can check against a file — the goal, the node table, the routing conditions, the bar's refs, the stops and their order, where the progress log goes. Isolation is the opposite: it is a prohibition on being helpful. The lead is told not to paste a transcript into a fresh worker, to hand a critic only the artifacts its inbound edge lists, and not to re-read the diff itself and overrule the verdict — and nothing in the package can enforce any of that, because the one unit that could (a `Stop` hook, or a workflow script that does the routing) is deferred by `docs/targets/claude-code.md` § "Optional accelerators". So the rule appears three times in prose, at descending altitude: §1 as the lead's job description, §5 as the rule for every edge, and again in each critic's agent body with the `invalid-evidence` escape hatch. On the evidence of one run, prose was enough: the lead wrote the evidence to files and handed a fresh critic the paths, never pasted a transcript, and let the critic's verdict stand rather than re-reading the diff itself. One run is one data point, and it is the data point the package most needs more of.

## Decisions made

Package-level tool choices, one line each:

- **pnpm workspaces** — `AGENTS.md` prescribes it; two packages, no build orchestrator needed.
- **Plain `tsc`, no bundler** — the only consumers so far are Node; `apps/web` can bundle from source in slice 0002.
- **Zero runtime dependencies in `packages/core`** — it runs in the browser in slice 0002, so the schema layer is ~390 lines of hand-written combinators rather than zod or a runtime JSON Schema validator.
- **One schema declaration, three outputs** — `src/schema/graph.ts` produces the validator, the published JSON Schema and the canonical key order, so §1, §3 and §7 cannot drift apart; two type-level assertions fail the build if the schema and `types.ts` diverge.
- **ajv as a `devDependency` only** — it cross-checks the *generated* JSON Schema against the hand-written validator on every fixture and 16 mutations, so a generated schema that is merely well-formed but wrong gets caught.
- **`node:test`** — built in, zero dependencies, boring. Tests compile to `dist/test` and run as `node --test 'dist/test/*.test.js'`.
- **`node:util parseArgs` for the CLI** — three commands do not need commander or yargs; usage text is one string.
- **CLI bin linked at the workspace root** (root devDependency on `@grooph/cli`) so `pnpm exec grooph` works from the repo root.
- **`--json` on `grooph validate`** — one small addition beyond the handoff, because the MCP server in stage 5 and the e2e assertions both want the issue list as data.

Design decisions inside the boundary:

- **`compile` throws `CompileError` (carrying `issues`), with `tryCompile` as the non-throwing form.** The handoff allowed either; shells that prefer branching get one without a try/catch.
- **The schema accepts unknown keys.** graph-ir §7 says "unknown keys last, alphabetical", which only means something if unknown keys are legal. Canonicalize preserves them, sorted, after the known ones. Trade-off: a typo in an optional field name is silent rather than `E_SCHEMA`. If that is not wanted, stage 3 needs a code for it (there is none in §3 today).
- **`minItems: 1` on `outputs` only.** graph-ir comments "at least one" on `outputs`, `back`, `stops` and `inspects`, but `back`/`stops`/`inspects` emptiness is owned by `E_LOOP_BACK_EDGE`, `E_CYCLE_NO_STOP` and `E_JUDGMENT_LOOP_NO_BAR`. Constraining them in the schema would make those fixtures report `E_SCHEMA` instead of their own code. `outputs` has no rule, so the schema owns it.
- **Record-valued objects (`layout`, `policy.params`) get alphabetically sorted keys.** The types list no keys for them, so §7's order rule does not reach them; sorting is what makes the output deterministic.
- **A node with no `model`/`effort` gets no `model:`/`effort:` frontmatter**, and its agent body says it inherits the session default. Document first (§4.2): the compiler infers nothing the document did not say. The profile carries `defaultTier` if the driver later wants the other behaviour.
- **`disallowedTools` = tools(`deny`) − tools(`allow`).** A literal reading would have denied the critic `Read`, since `edit-files` maps to a set that includes it.
- **Only the ★ rules are implemented.** The other codes in §3 are listed in `PLANNED_CODES` and the fixture walk does not demand fixtures for them, so stage 3 can add each rule with its fixture and the walk starts enforcing it automatically.
- **Issue order is the §3 table order**, and `at` always names at least one object (asserted by a test), so a view can highlight without extra work.

## Deviations

- **Node ≥ 22, not ≥ 20.** `engines` and CI require 22 because the test script passes a glob to `node --test`. Nothing else in the tree needs it.
- **The handoff's verify invocation.** `pnpm --filter @grooph/cli exec grooph …` cannot work; the final form is `pnpm exec grooph …` from the repo root, recorded above and used in CI.
- **The acceptance script writes one key to `~/.claude.json`.** A fresh `$TMPDIR` project is untrusted, so Claude Code ignores the permission allowlist in its `.claude/settings.json` — which would leave the run's subagents without a shell and turn the acceptance test into a test of the sandbox. The script marks the directory it just created trusted (the remedy the harness's own message names), after copying the file into the scratch directory, checking the result is intact, and removing the key again on exit; `--no-trust` skips it. **The owner approved this** when asked. Two things the driver should know: that file is written by any running Claude Code app, so a read-modify-write can in principle lose a concurrent change; and `--settings '<json>'` on the `claude` command is the alternative, since the CLI documents `--settings` as still applying where an untrusted project's settings file does not. Using it would change the invocation in `docs/targets/claude-code.md`, so the script does not.
- **The scratch project carries a narrow `Bash(...)` allowlist** (test command, `node`, `git diff`/`status`/`log`, and read-only shell tools). Broad `Bash` would have been simpler; a command I did not predict will be denied in the run, which will show up in `permission_denials` in the saved `claude-output.json`.
- Nothing else. No forbidden file was touched: `git diff --name-status origin/main..HEAD` shows 66 additions and exactly two modifications, `docs/PROGRESS.md` (In flight only) and `fixtures/README.md`.

### Where the normative documents were ambiguous, and what I chose

1. **§7 key order for intersection types.** `AgentNode = NodeBase & { kind: "agent"; … }` — "the order the types above list them" can be read either way. I expanded the intersection left to right, so a node reads `id, name, description, coupled, kind, role, …`. It puts `kind` fifth, which looks odd in the golden `graph.grooph.json`; the alternative is to hoist the discriminant. Worth one line in graph-ir either way.
2. **§1 id uniqueness.** The parenthetical lists nodes, edges, loops, groups, policies and notes, and not the graph's own `id`, so `E_DUPLICATE_ID` follows that list literally: a node may share the document's id. Since the graph id is also the package directory name and the subagent prefix, the driver may want it in the set.
3. **§3 `E_NO_TARGET` says "no profile under `docs/targets/`".** Core cannot read `docs/` (it runs in a browser), so the authority is the profile registry in `packages/core/targets/*.profile.json`, which `docs/targets/claude-code.md` already mandates as the data location. Consequence: `docs/targets/<harness>.md` and the profile file must be added as a pair, and `target.harness: "codex"` fails `E_NO_TARGET` today. Suggest graph-ir point at the profile registry instead.
4. **§2 rounds versus the acceptance assertion.** A round is defined as one back-edge traversal, so a loop whose critic passes on the first pass has zero rounds — and would leave no `loop:<id>` note, which criterion 6 requires. `LEAD.md` therefore says the first pass through the members is round 0 and a loop note is appended per pass, carrying the round just finished and the stop evaluated. graph-ir could state this directly.
5. **§2 human gates in a non-interactive run.** "The lead asks and waits… does not simulate an answer" has no meaning headless, and the target doc's headless procedure does not say what to do. `LEAD.md` §7 tells the lead to treat the gate as the end of the run: note `outcome: "halt"` naming the gate, write the final `PROGRESS.md`, report that it waits for a human, and resume later with the same run id. For the review-loop graph this is the *expected* ending of a headless pass, so the acceptance assertion accepts it.
6. **`docs/targets/claude-code.md` § "Headless acceptance run" does not mention workspace trust.** As written, the procedure silently loses the project's permission allowlist in any fresh directory. It is worth a sentence there, with `--settings` named as the flag-based way in.
7. **The capability-to-tools table is one-directional.** It says `disallowedTools` comes from `deny` but not what to do when `deny` and `allow` map to overlapping tools; see the decision above.
8. **Nothing checks that a node can produce its own outputs.** Found by the acceptance run, not by reading: `fixtures/valid/review-loop.grooph.json` gives the critic `outputs: ["REVIEW.md …"]` and `deny: ["edit-files"]`, so the package correctly withholds `Write` from a node that is required to leave a file behind. The graph validates clean, because no rule in graph-ir §3 relates `outputs` to `allow`/`deny`. I did not touch the fixture: this is not an inconsistency with graph-ir's text — graph-ir simply has no rule for it — and inventing one is outside this handoff. It looks like a stage-3 rule (`E_OUTPUT_NOT_WRITABLE`, or a warning), and the fixture wants a matching fix once the rule exists. Until then the review-gate pattern quietly depends on the lead ghost-writing the critic's file.

## Risks and leftovers

- **The slice's stated risk is retired for one graph, once.** A compiled package drove a real session through a real rejection to a real stop. It is one run, of one small graph, on one harness version, with one model. It says nothing yet about a graph with fan-out, with `shared` isolation, with a check node, or with more than two agent nodes — the empirical stage exists for that, and `scripts/e2e-claude-code.sh` is the shape those runs can take.
- **The review-gate pattern has a hole the run exposed** (finding 8 above): a critic that must write `REVIEW.md` but is denied `edit-files`. Whatever the driver decides — a rule, a fixture fix, or a documented convention that critics report and the lead files — it should land before `patterns/` grows copies of this graph in stage 4.
- `actions/checkout@v4`, `actions/setup-node@v4` and `pnpm/action-setup@v4` raise a Node 20 deprecation annotation on GitHub's runners. Harmless today; a version bump is a one-line change I left alone rather than guess at.
- Non-★ rules from §3 are not implemented (stage 3, as the handoff says). `PLANNED_CODES` names them so the fixture walk can start enforcing them the moment each one lands.
- `fixtures/valid/review-loop.grooph.json` is byte-identical to what the driver wrote, so `grooph canonicalize` on it is not a no-op (key order differs). The canonical form of the same document is committed inside the golden package. If the driver would rather fixtures be canonical, that is a one-command change.
- `packages/core`'s entry point is `dist/src/index.js` rather than `dist/index.js`, because `targets/*.profile.json` lives outside `src/` (the target doc fixes its path) and so `rootDir` is the package root. Cosmetic, but it will show up in `apps/web`'s imports.
- The two type-level assertions in `src/schema/graph.ts` are the only thing keeping `types.ts` and the schema in step. They are strong for shape but blind to constraints: a `pattern` or `minItems` in the schema that the type cannot express is not checked by anything but a test.
- The scratch project's `Bash` allowlist does not match compound commands, which cost the run 11 denials and some retries. The script keeps the narrow list (with a comment saying what to widen) so the committed script is exactly the one that produced the evidence above.
- One of the two approved acceptance runs is unused. If the driver wants a second data point — the same graph with the gate removed, so the run reaches the `done` stop node instead of halting — it is available without new approval.
- `docs/PROGRESS.md` has seven new **In flight** lines; the driver rewrites that section at reconcile.

## Prompt to paste into the driver session

```text
Handback for slice 0001 is at handoffs/0001-core-compiler-cli/HANDBACK.md at the head of branch slice/0001-core-compiler-cli (last code commit e93138f). Status: done — all six criteria met, CI green, and the headless acceptance run passed (run 20260918-0042-k7qm: two loop passes, critic rejected round 0, bar-passed fired at round 1, clean halt at the human gate, 33 turns, $2.32). Please reconcile with the grooph-reconcile skill.
```
