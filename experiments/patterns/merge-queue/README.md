# merge-queue · one proving run

**Run** `20260922-051355` · Claude Code 2.1.278 · lead `claude-opus-5`, host builder `claude-sonnet-5` (tier fast), bisector `claude-opus-5` (tier strong) · **$1.09** · 21 harness turns · 191 s · evidence in [`run/`](run/) · **`--check` passes** · **a back edge was taken** · **the bet paid**

_Pre-registered 2026-09-22 before the run (commit `experiments: merge-queue task …`, amended once before the run when the dry run showed the bisector compiled as an entry node: the loop's back edge became the bisector's return, `e-bisect-integrate`); the sections after "Pre-registration" are written from the record afterwards._

**Credits:** Steve Yegge's Gas Town Refinery: a merge queue that integrates a batch, bisects on failure and lands by a human's word; Bors: batch then bisect.

## Pre-registration

**Task.** [`task/`](task/): `textkit`, four small text helpers with a merge queue: three reviewed changes wait as patches under `queue/` ([`QUEUE.md`](task/QUEUE.md) lists them in landing order with status `queued`), `npm run integrate` applies the queued patches to a scratch copy of the tree and runs the tests there, `npm run land` applies them to the tree itself and writes `LANDED.txt`. The tree itself has one failing test (`formatMoney` drops the sign of a negative amount), which is the host `grind-loop`'s job. Of the three patches, `001` (slugify strips accents) and `003` (limit tolerates a negative n) are clean; **`002` (search ignores case) sorts results alphabetically and breaks the existing test "an exact title match comes first"**, so the three-patch batch fails integration and the two-patch batch without `002` passes.

The fragment is proved inside a host ([`slots.json`](slots.json)): `grind-loop` is instantiated, `merge-queue` is inserted with `grooph template insert`, and three ops route the tests' pass edge into `integrate` and drop the host's own stop node, so the graph reads `builder` → `tests` → `integrate`; integrate fail → `bisect` → integrate (loop `queue`); integrate pass → `land-gate` → `land` (`irreversible: merge`) → `done`.

**Why a first pass should fail.** The bar of the `queue` loop is the integration command on the whole batch, and the batch as queued cannot pass it: `002` breaks a test that `001` and `003` do not touch. So round 0 of the queue loop fails by construction (probability of a round-0 pass: **0**, unless the bisector or the host builder edits a patch, which both briefs forbid). What is uncertain is the bisector: it may hold the right change without bisecting (the failing test's name points at `search`, and the brief asks it to split and run), hold more than one change, edit a patch or the source to make the batch pass (forbidden: "fix nothing"), or hold `002` and also re-queue nothing. The bet: **the batch fails at round 0 and `e-integrate-fail` sends it to the bisector, the back edge `e-bisect-integrate` returns it to the check once, `BISECT.md` names `queue/002-search-case.patch`, `QUEUE.md` shows exactly one `held` row and it is 002, the two-patch batch integrates green at round 1, and the run halts at `land-gate` with `land` never dispatched and `LANDED.txt` absent.**

**Expected probability that the bet pays in full:** about 0.7. The round-0 failure is certain; holding exactly 002 is likely for a strong-tier builder given a two-line failure that names the test (0.85); the halt at the gate with a halt note has been reliable since slice 0010 (0.95); the residual risk is the bisector "fixing" the patch or the lead re-running integration itself without the bisector. What `--check` asserts is in [`expect.json`](expect.json): `backEdge`, `added` (exactly one `held` row, for 002), `pick` (BISECT.md names 002), `ownership` (the bisector wrote only QUEUE.md and its report), `notRun: land`, `absent: LANDED.txt, LANDING.md`, `ending: halt at land-gate`.

**Shape.** Host `grind-loop`: `builder` (fast) → `tests` check; fail → builder (loop `grind`: max-iterations 5, budget 30 minutes). Fragment: `integrate` check (`npm run integrate`) → fail → `bisect` (strong builder; owns QUEUE.md) → integrate (the back edge, so the bisector is never an entry node); pass → `land-gate` ("Land it now? It cannot be taken back.") → `land` (strong; `irreversible: merge`; runs `npm run land` once) → `done`. Loop `queue` (grind): max-iterations 4, budget 9 dispatches.

**Spend expected:** about $2.00 (a builder round, two integrations, one bisector dispatch). Ledger cap $75.00, $28.05 available before this run.

## What happened

| round | node | result | record |
|---|---|---|---|
| grind 0 | builder | one `Edit` to `src/format.mjs` (a `sign` prefix), `npm test` 7/7, `CHANGES.md`; "nothing under `queue/` or `QUEUE.md` was touched" | `n-0003`, [`project.diff`](run/project.diff) |
| grind 0 | tests | `npm test`: exit 0, 7 pass, 0 skipped; `e-tests-pass` taken to `integrate` | `n-0005`, `n-0006` |
| queue 0 | integrate | the lead ran `npm run integrate`: three patches applied, **9 pass, 1 fail** (`tests/search.test.mjs:19`, "an exact title match comes first"); output saved as `integrate-round0.txt` in the run folder; `e-integrate-fail` taken | `n-0008` |
| queue 0 | bisect | read the integration output and `QUEUE.md`, then **bisected by editing statuses and re-integrating four times**: 001 alone (green), 002 alone (the same failure), 003 alone (green), 001 + 003 (green); held 002 with the failure in the note, left 001 and 003 queued in order, wrote `BISECT.md` with the table and "002 reproduces the failure by itself, and the batch without it is green, so 002 is the change at fault and not an interaction"; "nothing under `queue/`, `src/` or `tests/` was changed; no fix was attempted" | `n-0010`, [`BISECT.md`](run/project.diff) |
| queue 0 | loop | fail; stops checked (1/4 rounds, 2/9 dispatches); **`e-bisect-integrate` taken** | `n-0011` |
| queue 1 | integrate | `npm run integrate`: two patches applied (001, 003), 9 pass, 0 fail; `e-integrate-land-gate` taken | `n-0013`, `n-0014` |
| — | land-gate | **halt note first** (`n-0015`, `outcome: halt`, evidence: QUEUE.md's statuses, BISECT.md, the round-1 output), `PROGRESS.md`, the question, the turn ended | [`PROGRESS.md`](run/runs/20260922-051355/PROGRESS.md) |

**Ending:** the halt at `land-gate`. `land` never ran (no dispatch, no transcript); `LANDED.txt` and `LANDING.md` do not exist. The bisector wrote only `QUEUE.md` and `BISECT.md` (the `ownership` assertion), `QUEUE.md` gained exactly one `held` row and it is 002 (the `added` assertion), and `BISECT.md` names 002 (the `pick` assertion). Dispatch counts exact on both loop notes (2, then 3: the lead counted the integration check as a dispatch, as the brief defines one). No amendment, no proposal, one denial (the lead's first note-append, a `$(date)` inside an `echo`).

## Did a back edge fire, and what caught it

**Yes: `e-bisect-integrate`, once.** The integration check caught it at round 0, as the task made certain: the batch as queued cannot pass. What the record adds is the bisector's method, which was a real bisection rather than a guess from the test's name, and its restraint: it held one change, edited one file, and fixed nothing, so the round-1 integration measured the batch the queue would land and not a repaired one. The bet paid in full, at the probability pre-registered for its uncertain part.

## What the fragment contributed

Inserted into `grind-loop` with `grooph template insert` plus three ops ([`slots.json`](slots.json)) and validated for export (`E_IRREVERSIBLE_NO_GATE` satisfied by construction: the only way into `land` is the gate). The lead ran the host's loop and the queue's loop as two loops with their own counters, saved each integration's output in the run folder, and halted with the batch's state in the note. The dry run before the run found a real defect in the first draft of the fragment: with `e-integrate-fail` as the loop's back edge the bisector had no other inbound edge and compiled as an entry node beside the host's builder; the back edge is now the bisector's return (`e-bisect-integrate`), so the bisector runs only after a failed integration.

## What the lead did that the package did not intend

- Nothing of substance. One denial (the first `echo` with a command substitution; it wrote the note by hand after). The final note is at `node:land-gate`, not at `graph`, as in every gate halt on record, and there is no `ending` line before it (right by LEAD.md §11: a halt is not a final note at `graph`).
- The bisector edited `QUEUE.md` five times (four bisection states and the final one); only the final state is in `project.diff`, and `BISECT.md` carries the table of the four. The lead's `integrate-round0.txt` and `integrate-round1.txt` in the run folder are the check's outputs verbatim.

## What I would change in the template

Nothing in the fragment after the back-edge fix. In the task: the failure line names `search`, so a bisector could have guessed; a batch whose failure appears only when two changes meet would make the bisection necessary rather than diligent, and would be the harder proof for a second run.
