# Handoff 0075 · The first audit: every claim grooph publishes as of 0.3.0

**Stage:** 24 · **Lane:** Opus 5.5 · **Effort:** extra high · **Browser tests on port:** none needed · **Branch:** `slice/0075-audit-claims-as-of-0-3-0` · **Drafted:** 2026-10-04 · **Confirmed by owner:** when he starts the lane

## Objective

Nothing grooph says about itself has been read by a second harness. This lane is the audit lane of decision 0024. It takes everything grooph publishes as of `v0.3.0` that is a claim, checks each against its evidence itself, then runs the loop with Codex until the two sides converge or the owner calls it. It ends with the claims corrected where they need it, and a **claims register** on the site: each claim, its evidence, and whether it has been audited.

## Success criteria

1. **An inventory.** Every claim in the README, the front page (`apps/web/src/ui/landing/`), the pages the site renders (`scripts/site/pages.json` lists them), the technical report and the blog draft, each with an id (C1, C2, …), its exact words and where it stands. A claim is a sentence about what grooph does to the quality, cost, speed or safety of work, or about what an experiment or a measurement showed. Performance numbers count.
2. **Your own reading first.** For each claim: the evidence by path, the command that re-derives it where there is one (run it), and your judgment before Codex sees anything: carried, carried with other words, or not carried.
3. **Round one goes out.** The snapshot at the audited commit, `round-01/HANDOFF.md` in the exchange folder from `handoffs/TEMPLATE-AUDIT-HANDOFF.md`, a copy of `TEMPLATE-AUDIT-HANDBACK.md` beside it, and the prompt for Codex given to the owner in your reply.
4. **Each handback is reconciled** as `handoffs/README.md` says: `RECONCILE.md`, a page for the owner published from `handoffs/briefs/`, and the round copied into `experiments/audits/0001-claims-as-of-0-3-0/`. Tell the driver what to put on the desk; the driver writes the desk.
5. **Corrections the owner accepts are made** in a pull request that waits for him.
6. **`docs/claims.md`**, a page on the site: every claim, where it is made, its evidence, and its audit state (not audited · round N, converged · disputed, with both positions). `README.md` links to it.
7. **It ends as decision 0024 says**, and the last `RECONCILE.md` says which way.

## Read first

1. `handoffs/0075-audit-claims-as-of-0-3-0/HANDOFF.md` (this file)
2. `AGENTS.md`, then `handoffs/README.md`: "Lanes" and "The audit loop with Codex"
3. `docs/decisions/0024-lanes-the-desk-and-the-audit-loop.md`, `0013-value-as-of-study-one.md`, `0012-first-comparison.md`, `0009-proving-records-are-evidence.md`, `0021-what-an-address-loads.md`
4. `docs/comparisons.md`, `experiments/comparisons/README.md` and the four write-ups; `experiments/patterns/README.md`
5. `README.md`, `apps/web/src/ui/landing/Landing.tsx`, `docs/report/grooph-technical-report.md`, `docs/blog/2026-10-loop-graphs.md`, `docs/field-guide.md`
6. `/Users/noir/Documents/grooph-exchange/README.md`

## Allowed changes

`experiments/audits/**`; `handoffs/0075-audit-claims-as-of-0-3-0/**`; `handoffs/briefs/` (your report pages and their rows in its README); `docs/claims.md` and one entry for it in `scripts/site/pages.json`; and, only in the corrections pull request and only as the owner accepted: the wording of claims in `README.md`, `apps/web/src/ui/landing/Landing.tsx`, `docs/report/**`, `docs/field-guide.md`'s source (`scripts/field-guide.mjs`), and other site documents. Outside the repository: `/Users/noir/Documents/grooph-exchange/**`.

## Forbidden changes

Any evidence: everything under `experiments/` except `experiments/audits/`. Any model session started by command, any proving or comparison run: a new experiment is designed here and run elsewhere. Code, other than the wording of a claim. `docs/PROGRESS.md` and `docs/PLAN.md` (the driver's). `docs/blog/2026-10-loop-graphs.md`: the owner is rewriting it by hand; audit its claims at the commit you snapshot and report them, and leave the file alone.

## Spec constraints that apply here

Decision 0013's wording is the ceiling for any claim of value until evidence changes it: "grooph is shown to bound and record autonomous work and to hold a design as a runtime contract; it is not shown to raise quality over the same instructions given as a prompt, on small tasks." Decision 0009: a record published red stays red.

## Design already decided

The loop, the folders, the three documents and how it ends: decision 0024 and `handoffs/README.md`. The auditor is Codex with GPT-6.1 Sol at its highest effort, opened by the owner on `/Users/noir/Documents/grooph-exchange/codex/0001-claims-as-of-0-3-0/`. The owner carries the prompts.

## Implementer's choices

How to group claims so a round is readable. What to tell Codex is already known to be weak. Whether the performance claims go in the first round or a round of their own.

## How to verify

```bash
node scripts/lib/prove-summary.mjs            # the proving table re-derives
node scripts/lib/compare-summary.mjs --index  # the comparison table re-derives
node scripts/field-guide.mjs --check           # 18 checks pass, 2 are red, as published
node scripts/site-pages.mjs --check            # the claims page renders and its links resolve
node scripts/american-english.mjs --check
```

## Handback must contain

The `TEMPLATE-HANDBACK.md` sections, plus: the inventory's count; per round, the findings by severity and how each was settled; the claims whose words changed, before and after; what is still disputed; every experiment designed and where its handoff is; how many times the owner carried a prompt.

## Prompt to paste

```text
You are a lane of grooph: the audit lane. Read handoffs/0075-audit-claims-as-of-0-3-0/HANDOFF.md, then AGENTS.md and the files it lists, and do the slice on branch slice/0075-audit-claims-as-of-0-3-0. You run the audit loop with Codex: when a handoff for Codex is ready, give me the prompt to carry to it, and I will bring its prompt back to you. Do not edit docs/PROGRESS.md or docs/PLAN.md. The driver session ("grooph opus operator") assigns and reviews your work and will message you; ask it, not me, unless the handoff says a question is mine. Finish with the grooph-handback skill and a pull request you do not merge.
```
