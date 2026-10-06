# Round two working notes

Audit date: 2026-10-06. These are audit notes and model-free probe receipts, not a new experimental run. The final interpretation is in [../HANDBACK.md](../HANDBACK.md).

## Scope and custody

- Authorized output root: `/Users/noir/Documents/grooph-exchange/codex/0001-claims-as-of-0-3-0/`.
- Snapshot read: `/Users/noir/Documents/grooph-exchange/snapshots/0001-claims-as-of-0-3-0-round-02/`.
- Snapshot HEAD: `faba78aeff36e9aca5c02c8e726086cbe10191f5`; remote: `https://github.com/ryanjosephkamp/grooph.git`.
- The expected untracked overlay is `experiments/comparisons/derived/lead-cost.{md,json}` and `scripts/lib/compare-lead{,.test}.mjs`, supplied at `980bcb6`.
- Every new script, scratch project, receipt and note was placed under this exchange folder. The actual grooph repository was not edited. No model session, paid call, new experiment, network publication or message to another lane was started.
- [snapshot-before.json](snapshot-before.json) records 3,960 file hashes. [snapshot-custody-final.json](snapshot-custody-final.json) reports the same 3,960 files, no changed/added/missing files, the same HEAD, and only the expected overlay in Git status. This comparison excludes `.git` metadata and `node_modules`; it is not a byte-custody claim for those excluded directories.

The exchange README and round-two handoff/template were read first. The first handback and reconciliation, repository audit protocol, decision 0024, progress/plan, specification/amendments and relevant graph, template, run, comparison, observation and export documents supplied context. Parts A–E were read and probed before reading the five requested guide chapters. No delegation or new agent was used.

## Main receipts

| Receipt | What it establishes |
|---|---|
| [stop-order-probe.mjs](stop-order-probe.mjs), [output](stop-order-probe.txt) | Both ordered-stop graphs validate; reversing equal-budget halt/continue stops is neutral to comparison; CLI writes without `--allow` |
| [counter-replay-probe.mjs](counter-replay-probe.mjs), [output](counter-replay-probe.txt) | A real model-free command prints an encoded marker without executing the check; synthetic digest plus otherwise conforming facts yields `met` |
| [entry-and-warning-probe.mjs](entry-and-warning-probe.mjs), [output](entry-and-warning-probe.txt) | Entry/nested/stop-`then` irreversible cases raise errors; no-cap loop retaining a budget has no warning; attempted bar-stop bypass is refused, not a hole |
| [metric-and-starts-probe.mjs](metric-and-starts-probe.mjs), [output](metric-and-starts-probe.txt) | Minimal incoming conditional refresh has no hold/error; Gauntlet's `then`-only integrator is a comparison start but not a graph-ir start |
| [adoption-refresh-cli-tests.txt](adoption-refresh-cli-tests.txt) | 98 selected tests pass; not a full 493/136-package rerun |
| [brake-count-tests.txt](brake-count-tests.txt) | 28 existing counter tests pass despite the additional replay counterexample |
| [brake-check.txt](brake-check.txt), [dry run](brake-dry-run.txt) | Both packages compile; frozen prose is current; five package budget substitutions and one prose-line change |
| [independent-study.json](independent-study.json), [source script](independent-study.py) | 24 run records, 96 source transcripts, raw usage grouping, registration comparisons |
| [preregistration-source-custody.json](preregistration-source-custody.json) | 31 registered task/held-out/expectation/slot files unchanged from last pre-run commit |
| [builder-declared-evidence.json](builder-declared-evidence.json) | All six A builder/owner files/source inputs name the held-out path; only three working copies remove that input |
| [round-zero-rescore.json](round-zero-rescore.json), [settings output](review-gate-2-round-zero.txt), [ranges output](heterogeneous-critic-round-zero.txt) | Two preserved first-pass trees independently score 44/55 and 52/70; exit 1 is the expected failing-suite result |
| [cost-totals.json](cost-totals.json) | $22.0312476 for study two, including judges; $41.116289 for the twenty selected latest proving runs |
| [lead-cost-check.txt](lead-cost-check.txt), [tests](lead-cost-tests.txt), [re-derivation](lead-cost-rederive.txt) | The overlay's generated tables and nine tests pass; re-derivation reads original A/B transcripts |
| [rates-fit.json](rates-fit.json) | Exact full-rank Opus fit; explicit rejection of the nonphysical/inexact Sonnet subset fit |
| [reader-output-comparison.json](reader-output-comparison.json), [progress](reader-progress.txt) | All 110 retained-reader outputs kept locally, with full diffs from historical receipts |

The two first-pass reconstructions copy only each task into `scratch/round-zero/`, then apply the retained round-0 patch(es) there. The held-out suites import the reconstructed project through the working directory. A first attempt used Node's default reporter, whose summary lines did not match the extraction regex; final receipts use `--test-reporter=tap` and the corrected summary JSON. Nothing about the scorer or source trees was changed.

The replay probe is a unit-level attribution counterexample. Its output producer actually ran; the digest and otherwise conforming judge facts are synthetic. It is not a recording of an agent cheating, and it does not measure prevalence. The stop-order probe similarly establishes prescribed graph semantics and actual CLI adoption, not a live lead choosing success.

## The nine named probes

Each was run individually from the snapshot with output captured here. The repository's `run-all-probes.sh` was not run because it writes there. The three shell probes were given explicit exchange-local scratch folders.

| Probe | Result at the snapshot |
|---|---|
| [check-verdict](check-verdict-probe.txt) | Always-passing command, swapped check verdicts, and the named bypass are refused |
| [irreversible entry](irreversible-entry-probe.txt) | Both marked entry cases raise `E_IRREVERSIBLE_NO_GATE`; its last explanatory sentence is stale |
| [halt to success](halt-to-success-probe.txt) | The documented no-person case is still adopted |
| [new stop](new-stop-probe.txt) | Bypass to the known protected success stop is held; the new-success-stop cases are not |
| [gate and already reached](gate-and-reached-probe.txt) | Matches the handoff's held/unheld distinctions |
| [constraints](constraints-probe.txt) | Free-text graph budget, retry and concurrency are not held; loop-budget control is held |
| [CLI adoption](adopt-probe.txt) | Dry display exits 0 and reports refusal; writing exits 1, no target |
| [override follow-up](allow-by-name.txt) | Explicitly allowing `loop:review.stops` writes the loosened copy; the named shell probe itself does not exercise this case |
| [check through CLI](check-through-command.txt) | Both changed-check cases exit 1 and write nothing |
| [export door](export-door-probe.txt) | Direct export overwrites the package; adoption's refusal does not close that door |

## Eight-reader suite

The full retained suite ran to completion with its longer fuzzers, not just `quick`. [run-readers.sh](run-readers.sh) preserves the original probe locations/imports while redirecting output and `TMPDIR` into this exchange folder. `GROOPH_HOME` and optional Git locks are set conservatively as well. Its wrapper can remove/recreate its own `reader-probes/` output, never the snapshot's saved receipts. The printed `done` line says 110 files.

Fifty outputs exactly equal the historical saved files. Sixty differ. The complete machine-readable diffs are retained. Examples inspected: added irreversible-entry fixtures alter pools and seeded choices; new check-edge protection alters refusal counts/reasons; corrected “may” warning text differs; path formatting and elapsed-time text differ. Do not call the old output current or overwrite it. I did not prove the cause of every diff individually.

Some current summaries:

- Check enumeration: 6,512 tried; 3,209 valid; 55 through; its oracle reports zero holes with/without a person.
- CLI consistency: 374 valid copies, 219 refused and 155 written; 26 invalid. Zero CLI/core disagreement, zero files on refusal and zero dry-run writes.
- Refresh seeded scripts continue reporting known gate-answer and critic-route limitations; their “sound template” flag matters when interpreting a result.
- Through cases involving newly opened human decisions are not numerical-cap enforcement evidence.

The scripts' oracles, including those that call a path loose, are hypotheses to check against the graph contract. They are not assertions that every listed case is a new defect or that an unlisted one is safe. The separately authored equal-stop-order probe is the new successful adoption attack in this audit.

## Study two reconstruction

For each project, A and B tie on the registered held-out result in both replicates and B is cheaper in both. This satisfies every stated losing condition. C also matches that result; D's score is lower. Two code judges favor D's candidates. The disagreement is substantive: visible-task compliance and the hidden suites' additional choices are not the same measure.

Local registration chronology was checked against Git history and primary raw-transcript timestamps. The nine `expect.json`, `slots.json` and README pre-registration portions match `d6178de5`. The 31 additional source-file comparisons cover the registered task/held-out contents and expectation/slot files. Earlier corrections are before the first invocation. This does not independently establish remote push time or eliminate all differences between actual harness configurations.

Original transcripts of the registered runs were available on the machine. The inventory and context scan are scoped to those recorded session IDs; no unrelated Codex transcript or memory was accessed. The named-path scan reports 79 held-out accesses, all critics', and no grooph name in the 66 B/C/D transcripts. It cannot rule out aliases, indirect information or arbitrary loaded skills. The false “named to reviewer only” row is detected from standing package inputs, not from a demonstrated read of hidden content.

Only two first-pass trees are independently re-scored. The other first-pass measures remain reports/derivations. Taste has qualitative gap reports, not a numerical first-pass score. The current feedback cycles are useful observations without becoming a causal quality result.

## Independent cost accounting

Raw assistant events were deduplicated by message ID; cumulative usage fragments take maxima per token field before sums. This is a separate implementation of the lead component calculation, not a call into `compare-lead.mjs`.

| Component, mean A less B | Dollars |
|---|---:|
| Lead total | 0.5241740667 |
| Input and cache read | 0.1789820667 |
| Cache addition | 0.1830320000 |
| Output | 0.1621600000 |
| Subagents | -0.0079041500 |
| Whole run | 0.5162699167 |

The Opus token/cost coefficient matrix has rank five and the exact solved coefficients are approximately `[4, 20, 0.2, 8, 5]`; maximum residual is about `2.22e-16` dollars. Uniqueness is conditional on the exact linear model and the saved precision. It does not independently certify a vendor price list.

Sonnet has no one-hour cache-writing observations. Two reported rows do not exactly fit the candidate schedule; the page acknowledges the small discrepancy. A preliminary solve of a four-equation subset produced a negative input coefficient and an inexact residual on the remaining rows. That fit was rejected, and `rates-fit.json` explicitly marks it nonphysical and invalid. It is not an alternative price schedule or evidence against the exact Opus lead split.

Allocating file costs by returned characters is still an estimate. Repeating the same sharing rule in another script checks counting, not the assumption. Cache-read accounting includes the standing context on later calls; it does not establish that deleting an initial file would remove the whole allocated later cost while leaving all work unchanged. The 20/100-dispatch table and proposed hook/workflow removals are arithmetic with stated assumptions, not observed savings.

## Corrections and decision coverage

| Round-one correction | Round-two reading |
|---|---|
| 1, 3, 5, 8, 12 | Central withdrawal stands; clarify latest-run selection and lead-authored partial records |
| 2, 6 | Fix the missing budget condition in the warning and explicit same-session continuation; the entry-rule repair raises the error in tested cases |
| 4 | Naming a stop, rather than proving termination, is the right description |
| 7, 20 | New refusal is real and selective; requester is any invoker, not necessarily a person; runtime instruction remains unenforced |
| 9, 10 | Corrected study-one section is substantially sound, including the cycle/cutoff and losing-test distinctions |
| 11 | Holding study-two results pending this audit is appropriate; proposed new wording still needs reconciliation |
| 13–15 | Scoped hook data, sender omissions, one retained concurrency trial, plan counts and reported observations are materially better descriptions; no fresh hook/network experiment run here |
| 16 | Service-worker-off timing and initial-load qualifications should travel with any reused number; no fresh timing/native test |
| 17 | “May” is a design possibility, not an asserted measured diversity effect |
| 18 | README corrected; landing badge still makes the stronger phone claim |
| 19 | Claims registry is useful; not an infallible or automatically current authority |
| 21 | Removing “no other cost” is correct; recording's marginal cost still not isolated |
| 22 | Descriptions still imply exclusion rather than instruction; versioning cost does not support the guarantee |
| 23 | Corrected provenance/count labels read fairly; do not generalize observed client/build behavior to all harnesses |
| 24 | “Most” quantifiers and scoped CI triggers are improvements |
| 25 | Owner's blog draft not approved for publication here |
| 26 | Keep old evidence/decisions; dated corrections and pointers are the proper treatment |

This is targeted review of changed prose and high-risk claims. It is not a repeat of all 52 original evidentiary investigations or all observed hook/platform behavior. Decision 0029 faithfully withdraws the old “bound” statement and corrects the historical comparison interpretations. Its outdated app and check-code sentences need dated clarifications, not silent rewriting. Its stronger reuse of “design ended above task alone” requires the measure/conditioning qualification.

## Guide coverage and limits

Chapters 1, 5, 7, 13 and 14 were read in full, last. The start page and relevant cross-references were also read. Other chapters were not read in full, and every command was not independently repeated. Existing command-validation receipts are author evidence, not this auditor's observed run of the complete guide.

The force table is valuable after replacing literal “empty” with a scoped fresh-context statement and separating observation from control. Chapter 7's explicit agent override, export and file-copy limits are fair; its broad “new arrow around a check” wording needs the selective coverage and known new-stop qualification. Chapter 13 fairly says later that the twenty are selected runs, but its headline and explanation of Gauntlet need the refinements in F8/F16. Its correct $41.12 total was independently checked. Chapter 14's process and historical agreement stand; a registry reading should remain subject to evidence and version checks.

## Verification limits and next step

No native app/phone/Safari session, actual budget-binding model run, profile first paid call or unmerged follow-up was tested. The full paid-path stand-in suite was not run: some command-line dry paths use the default profile home outside this exchange folder. The safe package compiler, prompt check and counter tests were run with scratch redirected here. No result should be inferred from the parked run's status or the dry-run script's stale “paid runs not built” message.

The handback's sixteen findings are proposals for reconciliation, not permission to publish, merge, spend or change frozen treatment. Preserve this audit's receipts and the source snapshot. Reconciliation should decide whether a further independent reading is needed after the exact corrections and code counterexamples are answered.
