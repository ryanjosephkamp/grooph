# Review 0006 · The executive path

**Reviewer:** driver (Fable 5.1) · **Handback:** `HANDBACK.md` at `d982dc9` · **Date:** 2026-09-18

## Verdict

`proceed` — merged into `main` as `c9193f7`.

## Verified independently

| Check | Command | Observed |
|---|---|---|
| Branch on GitHub, in sync, inside the boundary; skill untouched | fetch; rev-parse; name filter; `git diff --stat -- plugins/grooph/skills/grooph-design/SKILL.md` | identical heads; nothing outside; no diff on the skill |
| Cold build and tests | `pnpm install --frozen-lockfile && pnpm -r build && pnpm -r test` | core 208, cli 44, web 29, 0 failures |
| Browser suite | `pnpm --filter @grooph/web test:e2e` | 19 passed |
| CLI | `grooph shape fixtures/valid/review-loop.grooph.json`; `grooph share` of the same | `2 agents · 1 gate · 1 loop · up to 4 rounds · 40 turns`; a 1,937-character link |
| Install script | read every mutating line | only `mkdir -p` and `rm` of its own links, behind a printed plan; not run against the real home |
| Compare view | read `compare-phone-light.png` | label, badge, recommendation, profile, shape and rationale above the fold; sticky Choose bar |
| **The real skill, end to end** | the driver followed `grooph-design` for a real project (the workflow for slice 0007): `template show` ×3, `template use` ×3, `apply` ×3, `validate --for-export` ×3, wrote `.grooph/proposals/slice-0007/`, `grooph share` | three clean candidates (Lean, Sandwich, Gated); link of 5,009 characters; opened on the **live** site at 375×812: compare view renders, no console errors |

## Findings

1. **The compare view opens on the first card, not the recommended one.** With the recommendation second, the owner sees "Lean" first and the badge only after a swipe. Open on the recommended card, or order it first. Carried into 0007.
2. **`W_HOMOGENEOUS_CRITICS` wording admitted a far-upstream writer as an excuse.** graph-ir now says *nearest writers* (no other writer on the path). Carried into 0007.
3. **`worstCaseRounds` is nullable**: `docs/executive.md` fixed.
4. **Skill revisions from the implementer's five notes**, made by the driver: `{ file }` is relative to the set's folder; say in chat what changed after a "but with X" pick and re-share when the shape changed; the file under `.grooph/graphs/` is the one to edit; comparison lines start from `grooph share`'s output.
5. `grooph validate <proposal set>` should say "this is a proposal set; use grooph share". Carried into 0007 as a small CLI item.
6. Distribution (npm publish so the plugin can carry a `bin/` shim) remains an owner decision; not needed for the owner's own machine.

## Deviations

Both accepted (one CLI test expectation updated for the sharper rule; nullable `worstCaseRounds`).

## Carried into slice 0007

Open the compare view on the recommended candidate; nearest-writer `W_HOMOGENEOUS_CRITICS`; `grooph validate` on a proposal set points to `grooph share`.
