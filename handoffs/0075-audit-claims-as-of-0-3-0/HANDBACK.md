# Handback 0075 · The first audit: every claim grooph publishes as of 0.3.0

**Implementer:** Opus 5.5 (the audit lane) · **Branch:** `slice/0075-audit-claims-as-of-0-3-0` · **Head commit:** the commit that adds this file, on top of `f8930b1` · **Date:** 2026-10-05

## Status

`needs fix pass`. Round one is done, reconciled and converged, and its corrections are built in this pull request; the audit itself has not ended: it waits on the owner's seven answers, and a second round is drafted and not sent.

This is an interim handback, written because the driver asked for the corrections pull request now. A last one follows when the audit ends as decision 0024 says.

## What changed

**The audit's record** (`experiments/audits/0001-claims-as-of-0-3-0/`, all new)

- `README.md`: the subject, the commit, the state, and how round one came out.
- `inventory.md`: 52 claims, C1 to C52, each with its exact words, every place it stood, and the lane's first reading. Kept as first written.
- `round-01/HANDOFF.md`, `HANDBACK.md`, `RECONCILE.md`, and Codex's main receipts under `round-01/notes/`.
- `round-02/HANDOFF.draft.md`: round two, drafted and not sent.
- `designs/a-brake-that-binds.md`: the one experiment designed, as a draft handoff.
- `tools/`: five read-only scripts (`stops-fired.mjs`, `comparison-facts.mjs`, `validator-probes.sh`, `prompt-arm-context.mjs`, `adopt-probe.sh`).
- `experiments/audits/README.md`: the audit's row.

**The claims page** (new): `docs/claims.md`, with its entry in `scripts/site/pages.json`.

**The corrections**, one commit each, named by number so that a declined one comes out alone:

| Correction | Commit | Files |
|---|---|---|
| 1 | `0c1d841` | `README.md` (status line) |
| 2 | `dc6b949` | `apps/web/src/ui/landing/Landing.tsx` (the three claims) |
| 3 | `515515b`, `2129f9a` | `Landing.tsx` ("what is shown", its link, an import it no longer uses); `apps/web/e2e/landing.spec.ts` (the test quoted the old sentence) |
| 4 | `debc066` | `README.md`, `Landing.tsx` (the lede) |
| 5, 6, 7 | `8740023`, `e210041`, `3d81989` | `docs/report/grooph-technical-report.md` |
| 8 | `a65f459`, `f1d6fae` | the report (proving runs; the ledger line brought to today's `main`) |
| 9 and 10 | `dec2002` | the report (study one) |
| 11, one line only | `f0e6ffb` | the report no longer says study two "has not run"; it states none of its results |
| 12 | `66dd234` | `scripts/field-guide.mjs`, and `docs/field-guide.md` regenerated |
| 13, the documents | `03d627a` | `README.md`, `docs/subagents.md`, `docs/GLOSSARY.md`, `docs/HANDBACK-operator.md` |
| 14, 15 | `eb5ccde`, `61d946d` | the report (the hook and the sender; reports and the plan) |
| 18, 19 | `eb20acc`, `4966424` | `README.md` (two smaller lines; the link to the claims page) |
| 20, 21 | `5a7c9ef`, `09ba294` | `docs/graph-ir.md`, `docs/runs.md` |
| 22, the community page | `f552fd9` | `scripts/community-index.mjs`, and `docs/community.md` regenerated |
| 23, 24 | `7638798`, `b3fcdb6` | `docs/subagents.md`, `docs/quickstart.md` |

**A proposed decision** (new): `docs/decisions/0029-what-is-shown-as-of-the-first-audit.md`, status proposed, with its row in `docs/decisions/README.md`.

**The owner's page for round one** (new): `handoffs/briefs/audit-0001-round-01.html`, with its row in `handoffs/briefs/README.md`.

`main` was merged in at `1bf703e` before the corrections; one conflict, in `scripts/site/pages.json`, resolved by keeping both pages.

## Verified, and how

| Criterion | Command | Observed |
|---|---|---|
| 1. An inventory | `grep -c "^| C[0-9]" experiments/audits/0001-claims-as-of-0-3-0/inventory.md` | 52 claims in eight groups |
| 2. Own reading first | `inventory.md`, written 2026-10-04 before Codex's handback (20:26 that evening); the handoff Codex read is byte for byte the committed one (`cmp`) | 20 carried, 24 other words, 6 not carried, 2 not checked |
| 3. Round one goes out | the snapshot at `dbc7a28`, `round-01/HANDOFF.md`, the template copy, the prompt given to the owner in the lane's reply | done 2026-10-04 |
| 4. Each handback reconciled | `round-01/RECONCILE.md`; the page published from `handoffs/briefs/`; the round copied into the record; the desk items sent to the driver | done 2026-10-05 |
| 5. Corrections the owner accepts, in a pull request that waits | this pull request, one commit for each correction | built before he answered, on the driver's word; **not merged** |
| 6. `docs/claims.md`, and the README links to it | `node scripts/site-pages.mjs --check` | "site-pages: ok. 23 pages and an index, links and anchors resolve" |
| 7. It ends as decision 0024 says | | **unmet**: round two is drafted, not sent |
| The proving table re-derives | `node scripts/lib/prove-summary.mjs` | "20 records, $41.09 in all." (two templates were run again on `main` since 0.3.0) |
| The comparison table re-derives | `node scripts/lib/compare-summary.mjs --index` | study one $60.62 across 40 invocations; study two $22.03 across 27 |
| The field guide | `node scripts/field-guide.mjs --check` | "20 templates, 18 checks passed, 2 failed" |
| Spelling | `node scripts/american-english.mjs --check` | "nothing British in 632 public-facing files" |
| Generated pages | `community-index.mjs --check`, `rule-reference.mjs --check`, `cli-reference.mjs --check` | all current |
| Tests | `pnpm -r test` | no failure; the CLI's 130 pass |
| The front page in a browser | `GROOPH_E2E_PORT=4375 pnpm --filter @grooph/web exec playwright test landing.spec.ts` | 21 passed, 5 skipped (the screenshot tests) |
| The size budget, after the front page's new words | `node scripts/perf-budget.mjs --check` | "ok 160.59 of 164 the app's first load"; "ok 138.91 of 162 of which scripts"; "ok 257.80 of 262" canvas; "ok 278.83 of 280" a template's address; "ok 127.90 of 132" an embed |

## The inventory's count, and the rounds

**52 claims.** After round one both sides read each the same way: **12 carried, 33 carried with other words, 7 not carried** (C1 "bound", C5 "proven", C6, C39, C40, C43, C49).

**Round one: 21 findings.** By Codex's own severity:

| Severity | Findings | How each was settled |
|---|---|---|
| Blocks the claim (3) | F1, F3, F6 | Agreed. The words change: "bound" is withdrawn; study one's cut-off run is told as it was; "contract" is kept for what the session is told and no longer for what is shown to hold |
| Weakens the claim (10) | F2, F4, F5, F7, F8, F9, F13, F14, F17, F18 | Agreed, F17 partly. Each has a correction, or a line on the claims page |
| Wording (7) | F10, F11, F15, F16, F19, F20, F21 | Agreed, F21 partly. Corrections 8, 14, 18, 20, 21, 23, 24 |
| Note (1) | F12 | Agreed; borne out by study two since |

Codex corrected the lane's own reading three times (F1, F2, F5); the lane checked each in the primary records before agreeing. The lane added one observation to F6: `grooph adopt --write` accepts a working copy with its round cap raised from 4 to 40 and its budget from 10 to 400.

**The claims whose words changed, before and after:** every one is in `round-01/RECONCILE.md`, "Corrections proposed", with the words on `main` and the words proposed, and in the commit of that number. The one that matters most:

- Before (`README.md`): "Twenty templates have each been proven in a recorded run, and one paired comparison has been made. On that evidence, grooph is shown to bound and record autonomous work and to hold a design as a runtime contract. It is not shown to raise quality over the same instructions given as a prompt, on small tasks".
- After: "Each of the twenty templates has a recorded run: eighteen pass the project's checks and two are published red. In those runs a session stopped where its graph said, at a passed bar or at a human gate, and left a record of what it did. No round cap or budget is on record as firing, so it is not shown that one holds a run that would otherwise go on. In a paired comparison on four small tasks the package showed no quality advantage over a prompt derived from it."

**Still disputed:** nothing. Two differences of emphasis are written down in the reconciliation (how much the gates carry; whether a count on a plan is worth a sentence).

**Experiments designed:** one. `experiments/audits/0001-claims-as-of-0-3-0/designs/a-brake-that-binds.md`, Codex's design with two additions, written as a draft handoff for the driver to number and place. Not run.

**How many times the owner carried a prompt:** once, out (round one's prompt to Codex). Codex's prompt back was not carried: the lane found the handback on disk on 2026-10-05.

## Decisions made

- **The commit audited was `main` at `dbc7a28`, not the tag `v0.3.0`.** It was what the site served, eleven commits after the tag, and they changed spelling only.
- **Claims published in several places in nearly the same words are one claim**, with every place listed. Without that the inventory would have been 150 rows and no round readable.
- **The performance claims went in round one**, as a small group.
- **Two subagents (model set to Opus) read in parallel** for the site's other pages and the hook claims; the lane checked their main points in the source and said in the handoff where a row stood on their word alone.
- **Codex's notes are copied in part.** Its main receipts are in the record (212 KB); the rest, among them a 600 KB fingerprint of the snapshot, stay in the exchange folder.
- **Round two's draft is kept out of the exchange folder**, so that a Codex session opened there cannot take a draft for the newest handoff.

## Deviations

- **Corrections were built before the owner accepted them.** The handoff says "only as the owner accepted". The driver asked for the pull request to be built while he reads, one commit for each correction, so that his yes costs no waiting and a no comes out alone. It is not merged.
- **Outside the handoff's allowed changes, each on the driver's word of 2026-10-05:** `docs/GLOSSARY.md` and `docs/HANDBACK-operator.md` (correction 13); `docs/decisions/0029-…` and the decisions index (the proposed decision); `apps/web/e2e/landing.spec.ts` (the test quoted the sentence correction 3 replaces); `scripts/community-index.mjs` with its regenerated page.
- **Correction 13 is half done.** The two hook scripts' header comments and the `grooph hooks` help text (with `docs/cli.md`, generated from it) still say "ids, names and times". Nothing under `packages/` is touched: the hook's files are in the game experiment's frozen starting contents, and a change under `packages/` changes the commit its first commit names.
- **Not done because they are not this lane's:** correction 17 (the validator's sentence, code with fixtures); four of correction 22's sentences, which live in `patterns/*.grooph.json`; `docs/community.md:13`, a sender's own description of their graph; correction 25 (the blog draft); correction 26 (a dated note beside the old write-ups, the evidence lane's). Correction 16 edits no file: decision 0021 is a record, and its qualification is on the claims page.
- **The lane published the owner's page itself**, before the driver's message that briefs are published from its session. It is on the same account; the driver said to leave it.
- **A second slice was worked from this session**, at the driver's request while the audit waited on Codex: the review and hardening of the game experiment's profile (pull request #89, merged). It is not part of this pull request.

## Risks and leftovers

- **The corrected words have been read by nobody but their author.** They are part A of round two.
- **Study two is on `main` and unaudited.** This pull request states none of its results. The report now says it ran; the claims page says it exists. The README and the front page say "a paired comparison", meaning the first. If that reads as hiding the second, the fix is one clause, after round two.
- **The status skill still reports in decision 0013's terms.** `.claude/skills/grooph-status/SKILL.md:29` tells a session to "say what is shown (the contract, the brakes, the record …)" from decisions 0011 to 0013. It follows decision 0029 once that is accepted, and is the driver's. The design skill (`plugins/grooph/`) does not repeat the sentence. A search of public files found the old words left only in the hook scripts' comments.
- **`docs/claims.md` describes the state after this merges** ("the corrections came with this page"). If a correction is declined, its row and that paragraph need a line.
- **Round one's readings of group H's smaller points** (C52) rest on a subagent's sweep and Codex's agreement, not on the lane's own check of each.
- **Three measurements both sides named** are passed to the driver and not made: the event hook's latency; what a first front-page visit fetches with the service worker on; a fresh session resuming a halted run by its id.

## Prompt to paste into the driver session

```text
Handback for slice 0075 is at handoffs/0075-audit-claims-as-of-0-3-0/HANDBACK.md on branch slice/0075-audit-claims-as-of-0-3-0 (head: the commit "handoffs: handback 0075"). Status: needs fix pass: round one is reconciled and its corrections are built, one commit each, in a pull request that waits for the owner; the audit has not ended, and round two is drafted and not sent. Please reconcile with the grooph-reconcile skill.
```
