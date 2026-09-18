# Progress

The one file that says where grooph is right now. The driver rewrites it after every handback; implementers append to the **In flight** entry for their slice.

## Now

- **Stage:** 2 (vertical slice), about to start.
- **Next action:** owner confirms slice 0001; then the owner pastes the 0001 prompt into an Opus 5 session.
- **Last coherent commit:** see `git log -1`.

## In flight

_(none — 0001 not yet started)_

## Waiting on the owner

| Item | Recommended answer |
|---|---|
| Confirm slice 0001 as written in `handoffs/0001-core-compiler-cli/HANDOFF.md` | Yes |
| Repository license (repo is public) | MIT, unless you want to keep options open; then leave unlicensed for now |

## Done

| Date | What |
|---|---|
| 2026-09-17 | Phase A alignment: platform, executive location, phone-to-run path and slice order decided (see `PLAN.md`). |
| 2026-09-17 | Stage 0: repo scaffolding, spec + amendments, living docs, handoff protocol, project skills. |
| 2026-09-17 | Stage 1: graph document v0 designed (`graph-ir.md`), Claude Code target mapping (`targets/claude-code.md`), example fixtures. |

## Known risks

- The compiled package may under-drive a Claude Code session (lead ignores loop policy, skips the progress contract). Slice 0001's acceptance test exists to catch this early.
- Touch editing of edges on a phone canvas is fiddly. The outline view (stage 3) is the mitigation; the canvas stays for layout.
- Claude Code native units (subagent frontmatter, skills, headless flags) change between releases. `targets/claude-code.md` pins what was verified and when.
