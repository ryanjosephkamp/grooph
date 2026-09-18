---
name: grooph-handoff
description: Driver-side. Draft the handoff artifact for the next grooph slice (handoffs/NNNN-<slug>/HANDOFF.md), update the plan ledger, and present the paste prompt. Use when the driver is about to hand a slice to an implementer session, or when a fix pass needs its own prompt.
---

# grooph-handoff

You are the driver. A handoff is the only thing the implementer will have besides the repo, so it must stand alone.

## Steps

1. **Fix the slice.** Take the number and title from the slice ledger in `docs/PLAN.md`; if the slice is not in the ledger yet, add it. Fix passes reuse the slice folder and write `FIXPASS-<n>.md` with the same sections as a handoff.
2. **Write `handoffs/NNNN-<slug>/HANDOFF.md`** from `handoffs/TEMPLATE-HANDOFF.md`. Every section filled; a section that does not apply says `None`. The boundary sections (allowed / forbidden changes) list paths. Success criteria each name the command or observation that proves them.
3. **Write the paste prompt** as the last section. It names the slice folder, the branch, the reading order (`HANDOFF.md` first, then `AGENTS.md`), the status-line habit in `docs/PROGRESS.md`, and that the session finishes with the `grooph-handback` skill. Nothing in the prompt restates what the handoff file already says.
4. **Recommend effort.** If the `pick-effort` skill is available, run it for the implementer session and put its recommendation in the handoff header; otherwise state a recommendation with a one-line reason.
5. **Record state.** Ledger row in `docs/PLAN.md` says `handoff drafted, awaiting owner confirmation`; `docs/PROGRESS.md` **Waiting on the owner** gets the confirmation line.
6. **Commit and push** on `main`: `handoffs: draft NNNN-<slug>`.
7. **Present and stop.** If the `handoff-brief` skill is available, use it so the owner gets the prompt with a copy button; otherwise print the prompt block. Then end the turn: no implementer session starts until the owner confirms.

Done when the handoff is on `main`, the ledger and progress rows are updated, and the owner has the prompt in front of them.
