# Handoff protocol

Sessions have no shared memory. Everything a worker needs to start, and everything the driver needs to reconcile, travels as files in this folder plus one pasted prompt.

## Layout

```
handoffs/
  README.md                      this protocol
  TEMPLATE-HANDOFF.md            driver → implementer
  TEMPLATE-HANDBACK.md           implementer → driver
  NNNN-<slug>/
    HANDOFF.md                   written by the driver before the session starts
    HANDBACK.md                  written by the implementer at the end
    REVIEW.md                    written by the driver after reconciling
```

`NNNN` is the slice number from `docs/PLAN.md`. A fix pass on the same slice appends to the same folder as `HANDBACK-2.md`, `REVIEW-2.md`.

## Lifecycle

1. **Driver drafts** `HANDOFF.md` from the template, on `main`, and commits it. The owner confirms the slice. No worker session starts before both.
2. **Owner pastes** the prompt block from `HANDOFF.md` into a fresh implementer session opened in this repo.
3. **Implementer** reads `HANDOFF.md`, then the listed files, works on branch `slice/NNNN-<slug>`, appends short status lines to the **In flight** entry in `docs/PROGRESS.md`, commits often, and finishes with `HANDBACK.md` (the `grooph-handback` skill writes it).
4. **Owner pastes** the handback's return prompt into the driver session.
5. **Driver reconciles**: reads the handback and the diff, writes `REVIEW.md` with a verdict (`proceed` · `fix pass` · `split`), merges or requests the fix pass, updates `PLAN.md`, `PROGRESS.md` and any decision records, commits and pushes.

## Rules for both sides

- The handoff's **allowed / forbidden changes** are a boundary, not a suggestion. Anything outside it goes in the handback's **Deviations** or **Leftovers**, not into the tree.
- Verification claims name the command and the observed result. "Tests pass" without the command is not a verification.
- Decisions the implementer made inside the boundary are recorded in the handback, with reasons; the driver promotes durable ones to `docs/decisions/`.
- A blocked slice ends early with an honest handback rather than a workaround outside the boundary.

## Codex as an implementer

Codex works a slice the same way, with three differences (decision 0015).

- **Its own folder.** Codex works in a git worktree beside this clone, `/Users/noir/Documents/grooph-codex`, so its checkout never moves under a Claude Code session working here. The driver creates it on the slice's branch and builds it: `git worktree add ../grooph-codex slice/NNNN-<slug>`. One worktree, reused: the driver switches it to the next slice's branch.
- **The Codex app does not work in that folder.** Opened on it, the desktop app makes a worktree of its own under `~/.codex/worktrees/` and runs the chat there (slice 0032). That copy holds only what git tracks, at the commit the folder was on. So everything Codex needs is committed on the slice's branch before the owner opens it: never an untracked file. Codex commits from the named folder, as it did in 0032; the `codex` command in a terminal does work in the folder it is started in.
- **The repository is the exchange.** `HANDOFF.md` goes in on the slice's branch; `HANDBACK.md` comes back on the same branch, pushed. Nothing else passes between the harnesses, and the owner carries one prompt each way. Codex reads `AGENTS.md` by itself; it has no `grooph-handback` skill, so its handback follows `TEMPLATE-HANDBACK.md` by hand.
- **`~/.codex` is the owner's.** Hook trust, project trust and MCP servers are his to grant. A handoff says which steps are his, in order, before the prompt.

The driver may also run `codex exec` itself for a small check (`experiments/hooks/README.md` says how such a run is recorded). A slice goes to an interactive Codex session when it needs the owner present, Codex's own judgment, or more than a few minutes.
