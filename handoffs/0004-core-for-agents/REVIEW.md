# Review 0004 · Core for agents

**Reviewer:** driver (Fable 5.1) · **Handback:** `HANDBACK.md` at `71e6b7c` · **Date:** 2026-09-18

## Verdict

`proceed` — merged into `main` as `e23406e`.

## Verified independently

| Check | Command | Observed |
|---|---|---|
| Branch on GitHub and in sync | `git fetch`; `git rev-parse HEAD origin/slice/0004-core-for-agents` | identical (`71e6b7c`) |
| Boundary | `git diff --name-only main...HEAD` against the allowed list | nothing outside it |
| Cold build and tests | `rm -rf node_modules …; pnpm install --frozen-lockfile && pnpm -r build && pnpm -r test` | core 119, cli 20, web 22, 0 failures |
| Browser suite | `pnpm --filter @grooph/web test:e2e` | 10/10 at 400×800 |
| Every rule has a fixture | `grooph validate --for-export --json` over `fixtures/invalid/*/` | all 22 codes reported by their fixtures; extras are true warnings listed in sidecars |
| Goldens | export both valid graphs, `diff -r` against `fixtures/golden/claude-code/` | `review-loop` and `fix-until-green` identical |
| CI | `gh run list --branch slice/0004-core-for-agents` | green |
| Acceptance run `20260918-1737-k7qm` | read the kept scratch directory | cost $2.12, 29 turns, success. Working copy differs from the source in exactly three places (`builder.owns`, `critic.inputs`, `e-build-review.evidence`); notes n-0002 and n-0003 are amendments matching them, n-0007 is a proposal; `REVIEW.md` sits in the run folder. Source document untouched. |
| Lead brief §9 | read in the golden | brakes stated once, plainly; "when the graph fits, follow it"; smallest-change language present |

## Findings

1. **Adaptation behaved as designed on first contact.** Two small amendments with reasons, validated with `grooph`, one larger idea held back as a proposal, no brake touched. One data point.
2. **`E_IRREVERSIBLE_NO_GATE` had a hole** (one approved inbound edge satisfied it while another was open). graph-ir now says every way in must pass a human, and a node with no inbound edge is ungated. Code change carried into slice 0005.
3. **`W_UNREACHABLE_NODE` never fires alone.** Accepted and documented: it names stranded nodes for highlighting.
4. **Amendment `patch` format.** graph-ir §6 now prefers a grooph op list (ids survive reordering, `grooph apply` can replay it). Lead-brief text change carried into 0005.
5. **Kickoff amendments.** Allowed when reading the task shows a gap; reshaping the whole graph before any node runs is a proposal. graph-ir §2 updated; lead-brief text carried into 0005.
6. **Tightening only at `adaptive`.** Implementer's reading accepted and written into graph-ir.
7. **Stale history in graph-ir** (★ markers, slice-0001 key-order note) removed. `deploy.yml` action versions bumped by the driver to match `ci.yml`.
8. **The acceptance script reads Claude Code's transcript files** to establish who wrote `REVIEW.md`. Read-only, undocumented layout, isolated behind `--check`. Accepted for a developer script.

## Decisions promoted

None need a new record: the op format and `applyOps` contract are documented in `packages/core/README.md`, the sidecar format in `fixtures/README.md`. Decision 0008 stands as written, now with evidence.

## Deviations

All accepted: clean environment for the child process, transcript read, `grooph` shim on the run's PATH, stricter fixture walk, one web call-site change.

## Carried into slice 0005

`E_IRREVERSIBLE_NO_GATE` per the new wording (with a second failing fixture for the mixed-inbound case); lead-brief §9 gains the op-list patch preference and the kickoff-versus-redesign sentence; goldens regenerated.
