# Fix pass 1 · Slice 0013 · Admit the judge's re-proof and run it

**Stage:** 6 (closing) · **Implementer:** Opus 5 · **Effort:** `high` (floor `high`: one paid run and a ledger rule) · **Branch:** `slice/0013-reproof-red-records` (continue on it) · **Drafted:** 2026-09-21 · **Confirmed by owner:** 2026-09-21, under the spend already approved for slice 0013 (no new spend: about $3 of the $12.33 left) · **Review:** `REVIEW.md` in this folder

## Objective

Finish slice 0013. The bank is re-proved and green; the judge's re-proof never reached a model because the ledger's retry rule counted a $0.00 authentication failure as the template's one retry. Fix that rule so it counts only a retry that reached a lead, then run the judge's re-proof exactly as the handoff describes.

## Success criteria

1. **The retry rule.** In `scripts/lib/prove-ledger.mjs` `gate()`, an earlier retried kickoff blocks a new `--retry` only when it reached a lead: `status === "ok"` or a `run_id`. The refusal message stays for that case. `scripts/prove-pattern.sh fresh-grind-rare-judge --dry-run --retry "0013 re-proof after the auth failure"` prints "the ledger would allow a kickoff" (it refused before the change; say both in the handback). The bank, whose retry did reach a lead, is still refused a further `--retry`: show that with a dry run too.
2. **The header.** `scripts/prove-pattern.sh`'s header gains two lines: what an expired OAuth session looks like (`claude auth status` can say `loggedIn: true` minutes before; the failure is a $0.00 `error` invocation with `terminal_reason: api_error` and the refresh message in `claude-output.json`), and that such an invocation does not use up the template's retry.
3. **The judge's re-proof**, as handoff criteria 1, 2, 4, 5 and 6 say: `git mv run/ run-1/` immediately before the run; `scripts/prove-pattern.sh fresh-grind-rare-judge --retry "0013 re-proof after the auth failure"`; `--check` on the new `run/` (PASS expected; a FAIL is reported, not retried) and on `run-1/` (the same two problems as today); the write-up's "Re-proved after slice 0012" section; the index's re-proof section gains the judge's row and the "did not run" row goes; the sixteen-row summary regenerated. `run-failed-auth/` stays as it is.
4. **Report** whether the package's own judge ran every phase review, touched the held-out suite and wrote `PHASE-REVIEW.md` itself; whether any amendment was made (none is expected now that the judge has `run-tests`); whether the phase-2 `fail` the design bet expects happened; dispatch accuracy; per-round copies if a re-dispatch occurred.
5. **Still green** and the ledger to the cent; no other template runs.

## Read first

1. `handoffs/0013-reproof-red-records/FIXPASS-1.md` (this file), then `REVIEW.md`, `HANDBACK.md` and `HANDOFF.md` in the same folder
2. `scripts/lib/prove-ledger.mjs` (`gate()`), `scripts/prove-pattern.sh` header
3. `experiments/patterns/fresh-grind-rare-judge/README.md` and `experiments/patterns/specialist-critic-bank/README.md` § "Re-proved after slice 0012" (the shape to match)

## Allowed changes

Everything the handoff allowed, plus `scripts/lib/prove-ledger.mjs` (the rule only) and the header comment of `scripts/prove-pattern.sh`.

## Forbidden changes

As the handoff, minus the two files above. Still forbidden: any other runner change, a third model run in this slice, a scripted gate answer, editing evidence, hand edits to the ledger.

## Spec constraints that apply here

Decision 0009; A-008; §13 and §15, as the handoff.

## Design already decided

The rule's new condition; the judge's run exactly as the handoff specified; the failed-auth folder stays.

## Implementer's choices

Wording of the header lines and the write-up section.

## How to verify

```bash
scripts/prove-pattern.sh fresh-grind-rare-judge --dry-run --retry "0013 re-proof after the auth failure"
scripts/prove-pattern.sh specialist-critic-bank --dry-run --retry "should be refused"
scripts/prove-pattern.sh --status
scripts/prove-pattern.sh fresh-grind-rare-judge --check experiments/patterns/fresh-grind-rare-judge/run
node scripts/lib/prove-summary.mjs
pnpm -r build && pnpm -r test
```

## Handback must contain

Replace `HANDBACK.md` with the whole slice's account: the template sections, the two dry-run outputs before and after the rule change, both re-proof runs in the handoff's terms, the ledger total, and the answers criterion 4 asks for.

## Prompt to paste

```text
You are the implementer for grooph slice 0013, fix pass 1 (admit the judge's re-proof and run it). The repo is /Users/noir/Documents/grooph, published at github.com/ryanjosephkamp/grooph.

1. Run `git fetch origin` and check out the existing branch slice/0013-reproof-red-records (no other session is running; work in the main checkout). Do not rebase it.
2. Read handoffs/0013-reproof-red-records/FIXPASS-1.md first, then REVIEW.md, HANDBACK.md and HANDOFF.md in that folder.
3. Work only inside the fix pass's "Allowed changes". Fix the ledger rule and show it with the two dry runs before spending anything. Commit often with `<area>: <what changed>` messages and push the branch.
4. Spend: exactly one headless run, the judge's, through scripts/prove-pattern.sh under the ledger (cap $55.00, ceiling $9.00). Move run/ to run-1/ with git mv immediately before it. No other run, no scripted gate answer, never edit evidence or the ledger by hand.
5. Append one line per criterion met to the "In flight" section of docs/PROGRESS.md under the existing "Slice 0013" heading.
6. When done, or if blocked, finish with the grooph-handback skill: rewrite HANDBACK.md for the whole slice, push the branch, and print the return prompt as the last block of your final reply.
```
