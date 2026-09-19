# Fix pass 1 · slice 0007

**Implementer:** Opus 5, plain session (no grooph run: two small, fully specified fixes) · **Effort:** `medium` (floor `medium`) · **Branch:** `slice/0007-web-templates` (continue on it) · **Drafted:** 2026-09-19 · **Confirmed by owner:** pending

## Objective

Close the two gaps the 0007 handback reported, so the branch can merge.

## Success criteria

1. **Save as template refuses what the CLI refuses.** `SaveTemplatePanel` validates the extracted template the way `grooph template save` does and, on errors, saves nothing and shows the issues with the same hint the CLI gives (for example "loop … stayed behind: add merge-gate"). Importing a `.grooph.json` template that carries errors into "Yours" is refused the same way. Templates already stored are left alone. A unit or browser test pins each refusal, and the existing e2e fragment either brings its loop along or asserts the refusal.
2. **44 px chips.** `.chip` buttons that are tap targets are at least 44 px tall (the Save form's node chips, the loop inspector's member and back-edge chips, list chips in `fields.tsx`); a browser test measures one of each at 400×800. Non-interactive chips (profile chips) may stay compact.
3. **Still green.** `pnpm install --frozen-lockfile && pnpm -r build && pnpm -r test` and `pnpm --filter @grooph/web test:e2e` exit 0; CI green; the affected screenshots in the slice folder are refreshed.

## Read first

`handoffs/0007-web-templates/REVIEW.md`, then `HANDBACK.md` § "Risks and leftovers", then `HANDOFF.md` for the boundary, which is unchanged.

## Allowed and forbidden changes

As in `HANDOFF.md`, narrowed to `apps/web/**`, the slice folder, and `docs/PROGRESS.md` In flight. If validation needs a helper that belongs in core, a small pure export in `packages/core` with a test is allowed; say so in the handback. Do not touch the run record under `.grooph/slice-0007-sandwich/runs/`.

## Out of scope

The three undo observations the critic left (id-map undo guard, number-field steps, list-field lag): carried to a later slice.

## How to verify

```bash
pnpm install --frozen-lockfile && pnpm -r build && pnpm -r test
pnpm --filter @grooph/web test:e2e
```

## Handback

Write `handoffs/0007-web-templates/HANDBACK-2.md` with the usual sections, short.

## Prompt to paste

```text
You are the implementer for fix pass 1 of grooph slice 0007. The repo is /Users/noir/Documents/grooph.

1. Run `git fetch origin`, check out branch slice/0007-web-templates, and merge origin/main into it (main gained REVIEW.md and FIXPASS-1.md in the slice folder; there should be no conflicts).
2. Read handoffs/0007-web-templates/FIXPASS-1.md first, then the files it names. This is a plain session: do not start the grooph package run again.
3. Make the two fixes with their tests, inside the allowed paths. Commit with `<area>: <what changed>` messages and push.
4. Append one line per criterion met to the "Slice 0007" entry under "In flight" in docs/PROGRESS.md.
5. Finish by writing handoffs/0007-web-templates/HANDBACK-2.md (same sections as the handback template, short), commit as `handoffs: handback 0007 fix pass 1`, push, confirm the push, and end your reply with:

Handback for slice 0007 fix pass 1 is at handoffs/0007-web-templates/HANDBACK-2.md on branch slice/0007-web-templates (head <sha>). Status: <done|blocked>. Please reconcile.
```
