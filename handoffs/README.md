# Handoff protocol

Sessions have no shared memory. Everything a worker needs to start, and everything the driver needs to reconcile, travels as files in this folder plus one pasted prompt.

## Layout

```
handoffs/
  README.md                      this protocol
  DRIVER.md                      the driver's own state, for the session that takes the driver's seat next
  TEMPLATE-HANDOFF.md            driver → implementer
  TEMPLATE-HANDBACK.md           implementer → driver
  TEMPLATE-AUDIT-HANDOFF.md      audit lane → Codex
  TEMPLATE-AUDIT-HANDBACK.md     Codex → audit lane
  TEMPLATE-AUDIT-RECONCILE.md    audit lane → owner
  briefs/                        sources of the published pages: the review desk, the gate pages
  NNNN-<slug>/
    HANDOFF.md                   written by the driver before the session starts
    HANDBACK.md                  written by the implementer at the end
    REVIEW.md                    written by the driver after reconciling
```

`NNNN` is the slice number from `docs/PLAN.md`. A fix pass on the same slice appends to the same folder as `HANDBACK-2.md`, `REVIEW-2.md`.

## Lifecycle

1. **Driver drafts** `HANDOFF.md` from the template, on `main`, and commits it. The owner confirms the slice. No worker session starts before both.
2. **Owner pastes** the prompt block from `HANDOFF.md` into a fresh implementer session opened in this repo.
3. **Implementer** reads `HANDOFF.md`, then the listed files, works on branch `slice/NNNN-<slug>`, commits often, and finishes with `HANDBACK.md` (the `grooph-handback` skill writes it) and a pull request it does not merge.
4. **Owner pastes** the handback's return prompt into the driver session.
5. **Driver reconciles**: reads the handback and the diff, writes `REVIEW.md` with a verdict (`proceed` · `fix pass` · `split`), merges or requests the fix pass, updates `PLAN.md`, `PROGRESS.md` and any decision records, commits and pushes.

## Rules for both sides

- The handoff's **allowed / forbidden changes** are a boundary, not a suggestion. Anything outside it goes in the handback's **Deviations** or **Leftovers**, not into the tree.
- Verification claims name the command and the observed result. "Tests pass" without the command is not a verification.
- Decisions the implementer made inside the boundary are recorded in the handback, with reasons; the driver promotes durable ones to `docs/decisions/`.
- A blocked slice ends early with an honest handback rather than a workaround outside the boundary.
- **A pushed branch is never rewritten**: no rebase, amend or force-push once a commit is on the remote, even a branch a minute old that nobody else has fetched. To bring a slice up to date, merge. **Files are added by name**, never with `git add -A`: other sessions' working copies live under this clone (`.claude/worktrees/`).

## Lanes

A lane is a session the owner starts in the Claude app, in this repository, in a worktree of its own (decision 0024). The driver cannot start one. Once it exists the driver runs it.

1. **The driver drafts** the slice's `HANDOFF.md` on `main` and puts the lane on the review desk with a starter line.
2. **The owner starts** a session in the app (model and effort as the desk says), pastes the starter line, and tells the driver the lane is up. Starting the lane is his yes to the slice.
3. **The lane** reads its handoff and works on `slice/NNNN-<slug>` in its own worktree. It commits often and pushes its branch. It asks the driver when it is stuck, by saying so in its reply: the driver reads lanes' transcripts.
4. **The driver** watches: it reads each lane's recent turns, answers by message, and keeps the lane's row on the desk current.
5. **The lane ends** with `HANDBACK.md`, a pushed branch and a pull request. It does not merge and does not edit `docs/PROGRESS.md` or `docs/PLAN.md`: with several lanes at once those two files are the driver's, or every pull request conflicts.
6. **The driver reconciles**: reads the diff and the handback, has CI green on every job, and merges under decision 0023 or puts the pull request on the desk for the owner.

Rules that keep lanes out of each other's way:

- **One slice, one branch, one worktree.** A lane never checks out another branch in the main clone.
- **A lane's handoff names the paths it owns.** Two lanes at once never own the same file. Shared files (`apps/web/src/styles.css`, `apps/web/src/App.tsx`, `apps/web/vite.config.ts`, `scripts/perf-budget.json`, `AGENTS.md`) belong to one lane at a time or to the driver.
- **Browser tests run on a port of the lane's own**: `GROOPH_E2E_PORT=<port>`, given in the handoff. Port 4173 is never used: another project on this Mac holds it.
- **At most four lanes at once**, Opus 5.5 by default, Sonnet 5.5 for checklists, never Fable.

## Small changes

A change the driver may merge without asking (decision 0023, point 1) that fits in one sitting needs no handoff folder. It is a branch and a pull request, and the pull request's description is the record: what changed, why, and what was run.

## The audit loop with Codex

A claim is audited by a second harness before it is published (decision 0024). One lane, the audit lane, holds the loop. Codex reads, takes notes and writes a handback; it changes nothing.

**Where things are.**

```
/Users/noir/Documents/grooph-exchange/          not a git repository; the working copy of every audit
  README.md                                      this protocol, in short, for a session that starts there
  snapshots/<audit>/                             the repository at the audited commit, installed and built: read, never write
  codex/<audit>/                                 the folder Codex is opened on
    round-01/HANDOFF.md                          from the audit lane
    round-01/HANDBACK.md                         from Codex
    round-01/notes/                              Codex's working notes, if it keeps any
    round-01/RECONCILE.md                        from the audit lane, for the owner
    round-02/…

experiments/audits/<audit>/round-NN/             the record: the same three documents, committed
```

`<audit>` is a number and a slug: `0001-claims-as-of-0-3-0`.

**A round.**

1. **The audit lane prepares.** It fixes the commit under audit, makes the snapshot (`git worktree add --detach /Users/noir/Documents/grooph-exchange/snapshots/<audit> <commit>`, then `pnpm install` and `pnpm -r build` there), and writes `HANDOFF.md` from `TEMPLATE-AUDIT-HANDOFF.md`: each claim in the words it is published in and where, the evidence for it by path, what the lane believes and how sure it is, and what it most wants attacked.
2. **The lane gives the owner the prompt for Codex.** He opens a fresh Codex session on `codex/<audit>/` with GPT-6.1 Sol at its highest effort and pastes it.
3. **Codex audits.** It reads the handoff and the snapshot. It may run commands that only read: the summary scripts, the proving checks. It starts no model session and runs no new experiment. It writes `HANDBACK.md` from `TEMPLATE-AUDIT-HANDBACK.md` and gives the owner the prompt to carry back.
4. **The lane reconciles.** For each finding: agree, partly, or disagree, and why; the correction it proposes, in the words that would be published; whether a new experiment is needed. Then how close the two sides are, and whether another round is worth its cost. It writes `RECONCILE.md`, publishes it as a page, puts the decisions on the desk, and copies the round into `experiments/audits/`.
5. **The owner decides.** The lane makes the corrections he accepts in a pull request that waits for him.
6. **Another round**, when the owner wants one: the next handoff says what changed and what is still disputed.

**It ends** when neither side holds a finding that blocks a claim and every remaining disagreement is written down with both positions, or when the owner calls it. The last `RECONCILE.md` says which.

**A new experiment is designed inside the loop and run outside it.** If both sides agree the evidence does not carry a claim, the lane writes the design as a slice handoff and passes it to the driver. Its result comes back through the loop.

## Codex as an implementer

Codex works a slice the same way, with three differences (decision 0015).

- **Its own folder.** Codex works in a git worktree beside this clone, `/Users/noir/Documents/grooph-codex`, so its checkout never moves under a Claude Code session working here. The driver creates it on the slice's branch and builds it: `git worktree add ../grooph-codex slice/NNNN-<slug>`. One worktree, reused: the driver switches it to the next slice's branch.
- **The Codex app does not work in that folder.** Opened on it, the desktop app makes a worktree of its own under `~/.codex/worktrees/` and runs the chat there (slice 0032). That copy holds only what git tracks, at the commit the folder was on. So everything Codex needs is committed on the slice's branch before the owner opens it: never an untracked file. Codex commits from the named folder, as it did in 0032; the `codex` command in a terminal does work in the folder it is started in.
- **The repository is the exchange.** `HANDOFF.md` goes in on the slice's branch; `HANDBACK.md` comes back on the same branch, pushed. Nothing else passes between the harnesses, and the owner carries one prompt each way. Codex reads `AGENTS.md` by itself; it has no `grooph-handback` skill, so its handback follows `TEMPLATE-HANDBACK.md` by hand.
- **`~/.codex` is the owner's.** Hook trust, project trust and MCP servers are his to grant. A handoff says which steps are his, in order, before the prompt.

The driver may also run `codex exec` itself for a small check (`experiments/hooks/README.md` says how such a run is recorded). A slice goes to an interactive Codex session when it needs the owner present, Codex's own judgment, or more than a few minutes.
