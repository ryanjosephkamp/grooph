# Verification of the existing round-01 draft

User-facing date: 2026-10-04, America/New_York. The exchange README was read first, then the handoff. The pre-existing handback was copied to `HANDBACK-before.md` before editing; earlier notes were retained.

The snapshot is detached at `dbc7a281f977dddf7acc7948a0221e2aba93c5e4`. Nothing in the grooph repository was opened for editing. No new harness/model session, task execution, scoring/judging run, browser measurement, hook or sender trial was started.

Each of the following completed with exit 0; its captured stdout/stderr is beside this file:

- `node scripts/lib/prove-summary.mjs`
- `node scripts/lib/compare-summary.mjs --index`
- `node scripts/field-guide.mjs --check`
- `node scripts/rule-reference.mjs --check`
- `node scripts/perf-budget.mjs --check` (the explicitly allowed CLI startup budget check)
- `node round-01/tools/stops-fired.mjs` and `comparison-facts.mjs`, invoked by absolute path from the snapshot
- `node round-01/tools/prompt-arm-context.mjs`, the authorized local Claude context counter; no transcript bodies were copied
- `node round-01/notes/read-records.mjs`, the inspected read-only record checker
- `bash round-01/tools/validator-probes.sh <this directory>/probes`, invoked by absolute path; intentionally invalid P4/P6 return 1, and the enclosing script completes normally

The probes' documents and exported package are entirely under this notes directory. The export was not executed by a harness. They reproduce the handoff's declaration checks: bar-only stops can export; critic isolation needs its policy; irreversible protection needs its marker.

`cross-check-records.py` reads files and Git history only and writes `cross-checks.json` here. It recomputes paired costs and pre-run wording, B-1 dispatch/trace chronology, the merge's unchanged red-team loss threshold, three field-guide records against ledger rows, prospective-file commit order, and the decoded demo's equality to all twelve retained notes/source/working/progress. It executes no recorded reproducer.

The largest ledger `cost_usd` versus `reported_cost_usd` difference is $0.0000005 in each ledger, not a material unexplained cost. The kept proving costs sum to $44.993156; the summary footer's $44.98 sums rounded rows. The records support the $44.99 published total.

Source inspection adds qualifications to the draft: the checker does not reject an independently measured dispatch-budget overrun or verify all routing; contract can reasonably name an instructed protocol; context scans match strings rather than prove attention; during-turn publishing depends on tool events; study-two D is explicitly denied reviewer-only held-out material. The original 21 findings and complete C1–C52 table remain, with these refinements.

`snapshot-before.json` fingerprints 2,682 tracked and built files. `final-verification.json` verifies unchanged hashes and path sets, the unchanged HEAD, clean Git status, consecutive F1–F21, C1–C52 coverage and every required finding field. It does not pretend to checksum uninspected private state or all node_modules.
