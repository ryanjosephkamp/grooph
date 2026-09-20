# Review 0010 · Lead brief and template hardening

**Reviewer:** driver (Fable 5.1) · **Date:** 2026-09-20 · **Branch reviewed:** `slice/0010-hardening` at `79d1587` (work head `ecb94a2`) · **Verdict:** **proceed**

## Verified independently

Run in the main checkout on the slice branch, after `pnpm install --frozen-lockfile`.

| What | Result |
|---|---|
| `pnpm -r build && pnpm -r test` | build clean; core 242/242, CLI 58/58, web unit 49/49 |
| `pnpm --filter @grooph/web test:e2e` | 52 passed, 27 screenshot specs skipped |
| `node scripts/patterns-index.mjs --check`, `node scripts/check-brake-values.mjs` | both clean, 16 patterns |
| `grooph shape patterns/review-gate.grooph.json` | `2 agents · 1 gate · 1 loop · up to 4 rounds · 10 dispatches` |
| `grooph template use --help` | usage printed, exit 0 |
| `scripts/prove-pattern.sh review-gate --check experiments/patterns/review-gate/run` | PASS: clock run id, halt note at `merge-gate` as the final note, 9 timestamps in order, 2 denials |
| `scripts/prove-pattern.sh spec-then-loop --check experiments/patterns/spec-then-loop/run` | PASS: clock run id, halt at `spec-gate` before the ask, scripted approve, 17 timestamps in order, 14 denials |
| the same `--check` on both `run-1/` folders | FAIL on exactly the missing-halt-note problem they failed on in 0009: the kept evidence still reads as it did |
| `run-1/` against `main`'s `run/` for both templates | 21 and 27 files, byte-identical (`git diff --quiet main:run/… HEAD:run-1/…` on every file); no other proving record touched |
| forbidden paths | none touched: no `docs/` beyond PROGRESS In flight, no `spec/`, `AGENTS.md`, `.claude/`, `plugins/`, `.grooph/`; no rule code renamed |
| CI | green on every pushed commit of the branch, last at `79d1587` |
| ledger | $10.81 of $25.00 after invocations 9–11 ($3.80); $14.19 remains |

## Code review against the handoff and graph-ir

- **D1** (`agents.ts`): the evidence sentence is graph-ir §2's, writer and critic variants both read as documents in the review-loop golden; the critic's evidence-stop sentence is now conditional on a surrounding loop having an `evidence-invalid` stop, which is the same rule one level down and correct.
- **D2** (`lead.ts` §7, `kickoff.ts`): the one rule, halt note then ask then end the turn; no "cannot ask", "headless" or "non-interactive" wording remains in the brief or the kickoff. Both re-proving records show the halt note landing first.
- **D3, D4**: run id from `date -u`, `-2`/`-3` on collision, timestamps from the clock or omitted; one constant pair of example id and timestamp serves §3 and §8. Profile `runIdFormat` updated.
- **D5**: `dispatches` first in the enum in types, schema and the generated JSON schema; the brief says what a dispatch is, where the counter lives, and which measures are advisory; `mapping.ts` corrects the stale "no documented cost cap" line. Both leads counted dispatches unprompted, which is the point of the measure.
- **D6**: §5 carries the routing rule verbatim from graph-ir §2, the evidence stop only when a loop has one.
- **`stop` on loop notes**: `RunNote.stop` typed and in the schema; `firedStop` prefers it; the run view shows it (two browser tests).
- **D7 and carries**: `--help` short-circuits any `template` subcommand; `decodeKey` catches the malformed escape and lets the existing missing-item screens do the work. Both tested.
- **Templates**: eleven documents; `{{checklist}}` reaches the builders that judge against it; "the repository as the change leaves it, read-only" is input and inbound evidence for every assessing critic the handoff listed; the hunter gains `run-commands`; the contradiction-seeker description no longer claims the loop budget bounds the hunt. Budgets in `dispatches` sized by a stated rule (round-cap floor plus at most two), enforced by a pattern test.
- **Runner**: `--strict-mcp-config` on every invocation; `echo`, `cp`, `tr` allowed; the refusal on an existing `run/` says how to re-prove.

No finding blocks the merge. Three observations, none requiring a fix pass:

1. `firedStop` accepts any stop kind named by `stop`, including one the loop does not have. Harmless today (the view shows what the lead wrote); a later runner slice can have `--check` flag a `stop` that is not among the loop's stops.
2. The `--check` finding "the lead wrote outside the run folder: notes.jsonl" on the spec-then-loop record is a relative path from a `cd`-then-append command; the file is the run folder's. The check reports it, not judges it, so it stands as a finding.
3. `RunNote.stop` is a free string in the schema rather than the stop-kind enum. Deliberate leniency toward what leads write; fine.

## Deviations

| Deviation | Decision |
|---|---|
| The two write-ups under `experiments/patterns/` were edited (links retargeted to `run-1/`, a short re-proving section each) | **Accepted.** The rename the handoff asked for would otherwise have broken every link in them; the evidence itself is unedited. |
| `docs/templates.md` §5 left stale (`turns` or `minutes`) since `docs/` was out of scope | **Accepted**; reconciled in this merge commit (below). |
| `red-team-loop` needed no `run-commands` edit | Noted; correct. |

## Decisions promoted

None to `docs/decisions/`: `dispatches` and the gate rule were decided in graph-ir at reconcile 0009; this slice makes the code agree. The budget sizing rule (floor ≤ limit ≤ floor + 2) is a library convention and is recorded in `docs/templates.md` §5.

## Reconciled in the merge commit

- `docs/templates.md` §5: the budget rule (`dispatches` or `minutes`, with the sizing rule) and the two table rows that named turn budgets.
- `docs/targets/claude-code.md`: the lead-brief outline's run-setup line now says the id is read from the clock.
- `docs/executive.md`: the shape-line example uses a dispatch budget.
- `docs/PROGRESS.md`, `docs/PLAN.md`: state and ledger.

## Carried forward to slice 0011

- **Shell forms leads reach for are refused under the narrow allowlist** (`cd … && …`, `git -C <abs path>`): 2 and 14 refusals in the two runs, and in spec-then-loop the critic lost its diff. A `git:*` rule would admit `git checkout -b`. The cheap fix is one sentence in the kickoff and the mapping: run commands bare, from the project root; compound and `-C` forms are refused. Measure the denial count in batch two.
- **`--check` should compare a loop note's `cost: dispatches` with the number of `started` lines in that loop**, and flag a `stop` the loop does not have.
- **Task designs that force a second round** (review 0009): seven runs, no back edge taken. Batch two's tasks need a planted defect the critic can find or a checklist item the builder cannot see.
