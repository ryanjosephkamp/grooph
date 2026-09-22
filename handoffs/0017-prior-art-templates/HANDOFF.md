# Handoff 0017 · Prior-art templates

**Stage:** 14 · **Implementer:** Opus 5 · **Effort:** `high` (floor `high`: four graph designs, four tasks that must defeat a first pass, four paid runs) · **Branch:** `slice/0017-prior-art-templates` · **Drafted:** 2026-09-22 · **Confirmed by owner:** pending · **Spend:** four proving runs plus retries under the proving ledger, whose cap is raised from $55.00 to **$75.00** on confirmation ($29.36 available; about $15 expected; per-invocation ceiling stays $9.00)

## Objective

Add the four templates decision 0010 adopted from prior art, each with credits, each proved by a headless run on a task designed so that a strong builder's first pass fails and the loop turns (decision 0012: a record whose loop never turns proves the forward path only). The shapes below are decided; wording inside briefs is the implementer's within Latitude (graph-ir §2).

## The four templates

Every one: `template.kind`, `title`, `summary`, `whenToUse`, `notFor`, `profile`, `slots` with examples, `tags`, `credits`, `demo` after its run; every loop has its real stop plus a `budget` in `dispatches` (sized by the docs/templates.md §5 rule) and a `max-iterations` of 5 or fewer; critics are fresh, have evidence, allow `write-outputs`, deny `edit-files`; no brief restates a brake value; validates clean for export once instantiated.

### 1. `ralph-loop` (graph) · credits: Geoffrey Huntley, https://ghuntley.com/ralph/, "one prompt piped into a fresh session per pass; one item of work per pass from a plan file; state on disk; the human as the brake, here replaced by stops"

`builder` (writer, fresh each round; inputs: `{{plan-file}}`, `{{agent-file}}` the operating notes it may append learnings to, the project) → `tests` check (`{{test-command}}`) → `plan-check` check (a command that exits 0 when `{{plan-file}}` has no unchecked item, e.g. `! grep -q '^- \[ \]' {{plan-file}}`) → `done`. Edges: builder → tests; tests fail → builder; tests pass → plan-check; plan-check fail → builder (the next item); plan-check pass → done. Brief: take the top unchecked item only, do that, run the tests, mark it done and commit on green (`run-commands` for `git commit`), append what you learned to the agent file; never weaken a test. Loop `ralph` (grind): `diminishing-returns` (the same failure twice), `max-iterations` 5, `budget` in `dispatches`. Profile low · fast · light.

### 2. `patrol-pulse` (graph) · credits: u/croovies's "Lloyd" as written up by explainx.ai (2026-08-14, secondary source, say so), https://www.explainx.ai/blog/claude-code-loop-orchestrator-heartbeat-ticket-memory-august-2026, "a standing checklist per pulse, a read-only investigator, findings to a durable ticket store, humans prioritise"; also Steve Yegge's Gas Town patrols, https://github.com/gastownhall/gastown, "patrol agents that loop by design; here one pulse is one run"

`scan` check (`{{scan-command}}`: the command that lists candidate signals, e.g. errors in a log) → `investigator` (critic-family role `critic`, read-only: allow `read-files`, `run-commands`, `write-outputs`; deny `edit-files`; inputs: the scan output, `{{ticket-store}}` read-only, the project; outputs `FINDINGS.md`, verdict `clean | finding`) → clean: `clean` stop node; finding: `ticket-writer` (writer; owns `{{ticket-store}}` only; brief: append one ticket per finding, cross-referencing existing tickets, never duplicating, never touching code) → `prioritise` human gate ("new tickets are waiting for you to prioritise; nothing was changed") → `done`. No loop: one pulse is one run; the target doc's scheduled-run section says how it recurs. Profile low · fast · standard. `notFor`: anything that should change code in the same run.

### 3. `gauntlet-decomposed` (graph) · credits: Matt Shumer's Gauntlet Loop and the Claude of Duty repository, https://github.com/mshumer/Claude-of-Duty, "decompose, then builder plus fresh critic per piece against a real reference, blind side by side; here bounded, and pieces run in sequence because the repository's own note says fan-out lost on coupled work"

`planner` (writer, frontier; inputs: the task, `{{reference}}`, the project; outputs `PIECES.md`: the pieces along real seams, each with its owner scope, its reference cut and its acceptance) → `decomposition-gate` human gate (approve the pieces) → loop `pieces` (judgment; one piece per outer round; bar: every piece in `PIECES.md` marked done by the critic): `owner` (writer; inputs `PIECES.md`, the current piece; owns the piece's scope) → `capture-check` check (`{{capture-command}}`, refuses missing or unreadable captures) → `critic` (frontier, fresh; evidence: the captures, `{{reference}}`, `PIECES.md`, the repository read-only; brief: blind side-by-side against the reference cut, labels stripped, random order, say which is better and why, then the top gaps; verdict `pass` marks the piece done) → critic fail → owner (inner loop `polish`: `bar-passed`, `diminishing-returns` 2, `max-iterations` 3, `budget` dispatches); critic pass → `next-piece` check (a command that exits 0 when a piece remains unmarked in `PIECES.md`) → pass (a piece remains) → owner; fail (none remains) → `integrator` (writer; owns nothing new; brief: assemble, run `{{capture-command}}` for the whole) → `final-critic` (frontier, fresh; the whole against `{{reference}}`, blind) → `release-gate` human gate → `done`. Outer loop `pieces` stops: `bar-passed`, `max-iterations` 4, `budget` dispatches (sized for four pieces of up to three rounds each), `human` every 2 rounds. Profile high · slow · high. The brief never says "until it beats the reference".

### 4. `merge-queue` (fragment) · credits: Steve Yegge's Gas Town Refinery, https://github.com/gastownhall/gastown, "a merge queue that integrates a batch, bisects on failure and lands by a human's word"; also Bors, https://github.com/bors-ng/bors-ng, "batch then bisect"

`integrate` check (`{{integration-command}}`: build, lint, test on the batch) → fail → `bisect` (writer; brief: split the batch, find the change that fails, report it and leave the rest queued; owns `{{queue-file}}`) → integrate; pass → `land-gate` human gate → `land` (writer, `irreversible: true`, allow `run-commands`; brief: carry out `{{land-command}}` once) → `done`. Loop `queue` (grind): members integrate and bisect; `max-iterations` 4, `budget` dispatches. Inserted before an existing stop node as `human-gated-irreversible` is (see `experiments/patterns/human-gated-irreversible/slots.json` for the host recipe).

## Success criteria

1. **Four documents** under `patterns/`, index, README and glyphs regenerated; pattern tests extended: the new ids, their credits, `ralph-loop`'s plan-check command, `patrol-pulse`'s investigator denying `edit-files`, `gauntlet-decomposed`'s two loops nested with the outer bar on `PIECES.md`, `merge-queue` inserting into a grind-loop host.
2. **Four tasks that defeat a first pass**, each pre-registering (in the write-up's first section, committed before the run) why the first pass should fail and the expected round-0 pass probability:
   - `ralph-loop`: a plan file with four items where item 2's tests fail on a hidden interaction with item 1 (so at least one round returns) and item 4 depends on 3;
   - `patrol-pulse`: a log fixture with two genuine faults among routine noise and a ticket store that already holds one of them, so the investigator must find both, and the writer must dedupe one and file one; the bet is "one new ticket, no duplicate, no code touched";
   - `gauntlet-decomposed`: two pieces of a rendered artifact (an SVG or a text report) against a held-out reference the owner never sees, where piece 1's obvious rendering misses a property of the reference that only a side-by-side shows; the bet is at least one `e-critic-fail` and both pieces marked done;
   - `merge-queue`: a batch of three changes of which one breaks the integration command; the bet is that bisect names it and the run halts at `land-gate` with nothing landed.
3. **Four runs** through `scripts/prove-pattern.sh` (the runner's `PROVABLE` list gains the four; `gauntlet-decomposed` needs the held-out mechanism and a `--retry`-free first attempt; `merge-queue` runs inside its host like the irreversible fragment). Each record checked; a PASS expected; a FAIL is reported, not retried, unless the failure is outside the package. Every run is a ledger line under the raised cap. Report whether each loop turned and whether the `ending` line, the blind A/B and (for any node with `skills`) preloading appeared, since these are the first runs compiled from the 0014 brief.
4. **Write-ups** in the proving ground's form with the credits line and the required "did a back edge fire" section; the index gains four rows; `prove-summary.mjs` prints twenty rows.
5. **Still green** and CI green; the comparisons ledger untouched.

## Read first

1. `handoffs/0017-prior-art-templates/HANDOFF.md` (this file)
2. `AGENTS.md`
3. `docs/decisions/0010-prior-art-and-attribution.md`, `docs/decisions/0012-first-comparison.md`; `handoffs/briefs/prior-art-2026-09-21.html` (the analysis; a source file)
4. `docs/templates.md` §1 and §5; `docs/graph-ir.md` §1–§3; `docs/targets/claude-code.md` § "Running a package on a schedule"
5. `patterns/grind-loop.grooph.json`, `taste-polish.grooph.json`, `human-gated-irreversible.grooph.json`, `fresh-grind-rare-judge.grooph.json` (nested loops)
6. `experiments/patterns/README.md`, `experiments/patterns/human-gated-irreversible/` (a fragment in a host), `heterogeneous-critic/` (held-out); `scripts/lib/prove-pattern.mjs`, `prove-check.mjs`
7. `handoffs/README.md`, `handoffs/TEMPLATE-HANDBACK.md`

## Allowed changes

`patterns/**` (the four new documents; regenerated index, README, glyphs; no edit to the sixteen), `packages/core/test/patterns.test.ts` (and a compile test if a shape needs one), `scripts/lib/prove-pattern.mjs` (`PROVABLE`, and any host recipe support), `scripts/lib/prove-check.mjs` (only if a new template needs an assertion), `experiments/patterns/<new id>/**`, `experiments/patterns/README.md`, `experiments/patterns/ledger.json` (runner-written), `docs/PROGRESS.md` In flight under "Slice 0017", `handoffs/0017-prior-art-templates/**`.

## Forbidden changes

The sixteen existing pattern documents; `packages/**` source; `apps/**`; `experiments/comparisons/**`; existing proving evidence; `docs/**` other than PROGRESS In flight; `spec/**`, `AGENTS.md`, `.claude/**`, `plugins/**`, `.grooph/**`; hand edits to any ledger; a scripted gate answer; "until perfect" or any unbounded stop; spending past the cap.

## Spec constraints that apply here

§10 (Gauntlet-style isolation and named-bar comparison belong here; unbounded "keep going until the reference loses" does not); §13 (sequential ownership on coupled work; evidence gated); decision 0010 (credits say what was taken); decision 0009 (records are evidence); A-008.

## Design already decided

The four shapes, their credits, the task intents and bets, the cap.

## Implementer's choices

Brief wording; slot names beyond those given; the exact stop numbers within the §5 sizing rule; task content within the intents; run order (cheapest first).

## How to verify

```bash
pnpm -r build && pnpm -r test
node scripts/patterns-index.mjs --check && node scripts/check-brake-values.mjs
pnpm exec grooph shape patterns/gauntlet-decomposed.grooph.json
scripts/prove-pattern.sh ralph-loop --dry-run
scripts/prove-pattern.sh --status
node scripts/lib/prove-summary.mjs
```

## Handback must contain

The template sections, plus: the four shape lines; per run the proving-ground row and whether the loop turned; the ledger total; the `ending`, blind A/B and skills observations; anything in a design above that did not survive contact with a run, with the evidence.

## Prompt to paste

```text
You are the implementer for grooph slice 0017 (prior-art templates). The repo is /Users/noir/Documents/grooph, published at github.com/ryanjosephkamp/grooph.

1. Run `git fetch origin` and create branch slice/0017-prior-art-templates from origin/main (no other session is running; work in the main checkout). Check `claude auth status` before any paid run.
2. Read handoffs/0017-prior-art-templates/HANDOFF.md first, then the files in its "Read first" order.
3. Work only inside the handoff's "Allowed changes". Commit often with `<area>: <what changed>` messages and push the branch. Land the four documents, their tests, and each task's pre-registration before that template's run.
4. Spend: the proving ledger only, cap $75.00, ceiling $9.00 per invocation, one run per template plus the ledger's one retry for failures outside the package; never touch the comparisons ledger or edit evidence; no scripted gate answers.
5. Each time a success criterion is met, append one line to the "In flight" section of docs/PROGRESS.md under a "Slice 0017" heading (create it).
6. When done, or if blocked, finish with the grooph-handback skill: the branch must be pushed and HANDBACK.md committed before you print the return prompt, which is the last block of your final reply.
```
