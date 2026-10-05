# review-gate · Codex proving preparation

**Status: not run.** Slice 0076 prepared the package and a one-invocation runner on 2026-10-04. No Codex model session has been started for this proving task. This folder is preparation, not a proving result.

## Task and package

The runner uses the existing [`review-gate` task](../../patterns/review-gate/task/), [`slots.json`](../../patterns/review-gate/slots.json), and [`expect.json`](../../patterns/review-gate/expect.json) without changing them. It instantiates the bundled template, names Codex as the graph's harness (the template names Claude Code, and an export for a harness the document does not name is refused), validates it, exports the Codex package into a fresh temporary project, and retains the original graph in the package. The lead is GPT-6.1 Sol at high effort; both custom workers are GPT-6 Luna. The graph's iteration and dispatch stops remain unchanged. The harness has a 15-minute timeout and a two-worker concurrency cap.

`node scripts/prove-codex.mjs --dry-run` passed: the task instantiated, validation passed, and the export wrote the lead brief, kickoff, mapping, canonical graph and two custom-agent TOML files. The dry run calls no model, creates no `run/` record here, and does not open Codex home files. Runner tests use synthetic JSONL and notes; they do not establish native custom-agent loading, isolation, gate behavior, or resume behavior.

## Blocking boundary

The owner explicitly directed the review fix pass to start no model session. The [review](../../../handoffs/0076-codex-target/REVIEW.md) puts a fresh review of the fixed package before the proving invocation. The [handoff](../../../handoffs/0076-codex-target/HANDOFF.md) also forbids access to `~/.codex` without the owner's yes. A normal authenticated `codex exec` uses that home and writes session state; [decision 0015](../../../docs/decisions/0015-working-rules-for-the-operator-round.md) requires the actual session transcript's path and checksum. No proving invocation or runtime transcript access occurred. The exact proposed command and its external reads/writes are recorded in [`PROVING-COMMAND.md`](../../../handoffs/0076-codex-target/PROVING-COMMAND.md).

| Required run fact | Record |
|---|---|
| Model invocation | None |
| Codex session id | Not available; no session was started |
| grooph run id | Not available; no run was started |
| Reported token usage | Not available |
| Reported USD cost | Unknown; not zero and not estimated |
| Ending / gate halt | Not observed |
| Runtime transcript path / checksum | Not collected |

## Completing the first proving run

After the owner authorizes this one runtime invocation and its transcript receipt, build the repository and run from the slice checkout:

```sh
pnpm -r build
node scripts/prove-codex.mjs --run
```

The fixed runner proves the profile's defaults without a machine-local `GROOPH_MODELS` override. It keeps temporary grooph state in a separate `GROOPH_HOME`, inherited by the Codex invocation. It sets no approval policy and changes no saved Codex settings. Which approval policy then applies to the lead and to the workers is unknown until the run shows it; a refusal is not a native graph halt. The graph's gate behavior is still to be observed.

The runner opens `run/ledger.json` before spawning `codex exec`, streams stdout and stderr to `run/local/codex-output.jsonl` and `run/local/codex-stderr.txt`, which git ignores (they are the whole transcript of the session, and the repository is public; the ledger keeps their checksums, and a person reads them before either is moved to where git sees it), updates the session id and exact reported token usage, and preserves the package, task diff, run folder and test output. It refuses to overwrite an existing `run/`. Failure is retained as a result; do not delete the first record to retry. USD remains `null` unless the harness reports a cost.

The runner never reads `~/.codex`. Collect only the authorized session transcript's path and SHA-256 after the invocation, and add them to that invocation's ledger and result. Keep a transcript containing account details on the machine, as decision 0015 requires. Do not check it into Git. Rewrite this page around the actual record and update the target mapping's seen/unknown marks only to the extent the run establishes them.

```sh
node scripts/prove-codex.mjs --check experiments/patterns-codex/review-gate/run
```

The checker requires successful dispatch events naming both exact custom roles, completed node notes, loop-pass/stop notes, a final gate halt, no subsequent done-stop note, retained critic output, passing task tests, unchanged canonical source, and reported usage. This is a bounded consistency check. It does not prove per-file permissions, evidence secrecy, actual worker context exclusion, every adaptive brake, or ownership of each write. Missing dispatch fields in the CLI stream are missing evidence, not proof that no worker ran.

## A second template

`fix-until-green` has a byte-checked Codex golden package. Proving it needs its existing task and acceptance data wired into a separate Codex runner mode and a fresh evidence destination, plus owner authorization for the model invocation and transcript receipt. Check the check-node/test-command route, fail/back-edge behavior, stop order and final stop independently. A `review-gate` run cannot establish those behaviors or gate resume; resume requires a separate explicit human answer and the same grooph run id.
