# Progress

The one file that says where grooph is right now. The driver rewrites it after every handback; implementers append to the **In flight** entry for their slice.

## Now

- **Stage:** 2 (vertical slice), slice 0001 in progress.
- **Next action:** the Opus 5 implementer session works `handoffs/0001-core-compiler-cli/HANDOFF.md` on branch `slice/0001-core-compiler-cli`; when its handback prompt is pasted into the driver session, the driver reconciles with `grooph-reconcile`.
- **Last coherent commit:** see `git log -1`.

## In flight

### Slice 0001 · Core, validator, Claude Code compiler, CLI

Implementer appends one line per success criterion met, newest last.

- 2026-09-17 · started (owner confirmed the slice; acceptance-run spend approved, capped at two headless runs)

## Waiting on the owner

_(nothing until the 0001 handback)_

## Scheduled after 0001

- Astra (Codex) read-only review of `docs/graph-ir.md` for harness-neutrality, before the schema widens in stage 3. Driver drafts that handoff at reconcile time.

## Done

| Date | What |
|---|---|
| 2026-09-17 | Owner confirmed slice 0001; MIT license added. |
| 2026-09-17 | Phase A alignment: platform, executive location, phone-to-run path and slice order decided (see `PLAN.md`). |
| 2026-09-17 | Stage 0: repo scaffolding, spec + amendments, living docs, handoff protocol, project skills. |
| 2026-09-17 | Stage 1: graph document v0 designed (`graph-ir.md`), Claude Code target mapping (`targets/claude-code.md`), example fixtures. |

## Known risks

- The compiled package may under-drive a Claude Code session (lead ignores loop policy, skips the progress contract). Slice 0001's acceptance test exists to catch this early.
- Touch editing of edges on a phone canvas is fiddly. The outline view (stage 3) is the mitigation; the canvas stays for layout.
- Claude Code native units (subagent frontmatter, skills, headless flags) change between releases. `targets/claude-code.md` pins what was verified and when.
