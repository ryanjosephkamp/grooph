# Handoff 0006 · The executive path

**Stage:** 5 · **Implementer:** Opus 5 · **Effort:** `high` (floor `high`) · **Branch:** `slice/0006-executive-path` · **Drafted:** 2026-09-18 · **Confirmed by owner:** pending

## Objective

Make the owner's main scenario work end to end: in a Claude Code session they describe a project, the `grooph-design` skill builds one to three validated candidate graphs, `grooph share` turns the proposal set into a link, the link opens a comparison on the phone, the owner picks, and the package is placed with nothing started. This slice builds the proposal-set document, share links, the compare view, three CLI commands, the plugin packaging and a local install script. The skill text itself is already written by the driver and is not yours to change.

## Success criteria

1. **Green from a fresh clone.** `pnpm install --frozen-lockfile && pnpm -r build && pnpm -r test` and `pnpm --filter @grooph/web test:e2e` exit 0; CI green.
2. **Proposal sets in core** per `docs/executive.md` §1: types, schema and JSON Schema (`packages/core/schema/grooph-proposals-0.schema.json`), `validateProposalSet` with `E_CANDIDATE_INVALID` and the other rules listed there, `estimateShape(graph)` with tests for a flat loop, nested loops (multiplied rounds) and a loop with no max-iterations (`worstCaseRounds: null`).
3. **Share envelope and codec** per §2: `buildShareEnvelope` / `parseShareEnvelope` in core (pure, validated, clear errors, run notes dropped, layout kept); raw-DEFLATE base64url in the CLI (`node:zlib`) and the web app (its existing zip library). A test proves each side decodes the other's output, and that a corrupted or oversized payload fails with a message a person can act on.
4. **CLI** per §4: `grooph share` (validates, inlines `{ file }` candidates, computes `shape`, prints link and length, warns above 32,000 characters, `--base`, `--open`, `--out`), `grooph pick` (by candidate id or label, case-insensitive, refuses ambiguity), `grooph shape`.
5. **Opening a link in the app** per §2–3: `#/open?d=…` renders a graph read-only, or the compare view for a proposal set; nothing is stored until **Save to this device**; no export straight from a link; a bad payload shows what is wrong and a way back to the library. Browser tests at 400×800 cover: open a graph link, open a three-candidate link, swipe between cards, Choose copies the exact line from §3, Save stores the chosen graph and it opens editable, a corrupted link is handled. One browser test at desktop width checks the side-by-side layout.
6. **Compare view quality.** At phone width a candidate's label, recommended badge, profile, shape line and first sentence of rationale are visible without scrolling the card; the mini canvas is legible (auto-laid-out, fit to the card); pros and cons read as lists. Screenshots (phone light and dark, desktop) saved in the slice folder.
7. **Packaging.** The repo works as a Claude Code plugin source for the existing `plugins/grooph/skills/grooph-design/SKILL.md`: add whatever manifest files the current plugin and marketplace documentation require (verify against the docs for the installed Claude Code version and cite them in the handback), without editing the skill. `scripts/install-local.sh` links the built CLI onto `PATH` and installs the skill for the current user, is idempotent, prints exactly what it will touch before doing it, and has `--uninstall`. You do not run it against the owner's real home directory: test it with `HOME` pointed at a scratch folder.
8. **Carried from review 0005.** `W_HOMOGENEOUS_CRITICS` per critic and the `W_NO_TERMINAL` fragment exemption, as graph-ir §3 now reads, each with a fixture; pattern sidecars updated where the sharper rule now fires (that is the rule working; do not change tiers to hide it).
9. **Rehearsal without a model.** A transcript in the handback that plays the skill's steps 2–7 by hand with the CLI for a made-up project ("add CSV export to a small Express app"): three candidates from `grind-loop`, `review-gate` and `spec-then-loop`, a proposal set, `grooph share --base` against the locally served app, the link opened in the browser test harness or the desktop browser pane at phone size with a screenshot, `grooph pick`, `grooph export --into` a scratch folder. No headless model run in this slice; the driver runs the real skill at reconcile.

## Read first

1. `handoffs/0006-executive-path/HANDOFF.md` (this file)
2. `AGENTS.md`
3. `docs/executive.md` — normative for this slice
4. `plugins/grooph/skills/grooph-design/SKILL.md` — what the CLI and the link must serve; read-only for you
5. `docs/templates.md` §1 (Profile), `docs/graph-ir.md` §3 (the two reworded warnings)
6. `docs/decisions/0001`, `0005`, `0006`, `0007`
7. `apps/web/src/` — routes (`App.tsx`), the canvas, `doc/layout.ts`, `doc/exportPackage.ts`, the e2e specs
8. `packages/cli/src/` — how commands, registries and tests are organised
9. `handoffs/0005-templates/REVIEW.md`
10. `handoffs/README.md`, `handoffs/TEMPLATE-HANDBACK.md`

## Allowed changes

- `packages/core/**`, `packages/cli/**`, `apps/web/**`
- `fixtures/**`, `patterns/*.expect.json`, `patterns/index.json` and `patterns/README.md` only if regeneration changes them
- `plugins/grooph/**` **except** `skills/grooph-design/SKILL.md`; `.claude-plugin/**` at the repo root if the marketplace format needs it
- `scripts/install-local.sh` — new; other `scripts/**` only if a check needs it
- `.github/workflows/ci.yml`
- root `package.json`, `pnpm-lock.yaml` — only if a dependency genuinely changes
- `docs/PROGRESS.md` — the **In flight** section only
- `handoffs/0006-executive-path/**` — the handback and screenshots

## Forbidden changes

- `plugins/grooph/skills/grooph-design/SKILL.md`, `docs/**` other than PROGRESS In flight, `spec/**`, `AGENTS.md`, `.claude/skills/**` — driver-owned; report what is wrong with the reading you chose
- Template browsing/saving in the app, undo and other editing polish (slice 0007); an MCP server; run-note import; a monitor
- Any backend, upload, analytics or URL shortener. The link is the whole transport.
- Any headless model run; any write to the real `~/.claude` or the owner's shell profile

## Spec constraints that apply here

- §8: two or three candidates with tradeoffs; the executive reads and writes the same graph document; blank canvas stays possible.
- §4.4 and decision 0002: the human picks; grooph makes no model calls; nothing starts a run.
- §4.7: a three-candidate set of ordinary graphs must fit a link; if it does not, the graphs are too big, which `grooph share` says.
- Decision 0001: no backend. Decision 0005: core keeps zero runtime dependencies.
- Links are untrusted input (docs/executive.md §2): schema-checked, read-only, never auto-stored.

## Design already decided

`docs/executive.md` in full, and the skill text.

## Implementer's choices

Card and swipe mechanics; how the mini canvas is rendered; plugin manifest details within what the docs require; `--open` mechanics per platform; error copy.

## How to verify

```bash
pnpm install --frozen-lockfile && pnpm -r build && pnpm -r test
pnpm --filter @grooph/web test:e2e
pnpm exec grooph shape fixtures/valid/review-loop.grooph.json
pnpm exec grooph share fixtures/valid/review-loop.grooph.json --base http://localhost:4173/grooph/
```

Put the final working form of every command in the handback.

## Handback must contain

The `TEMPLATE-HANDBACK.md` sections, plus: the rehearsal transcript and its screenshot; the link length for the three-candidate rehearsal set; the plugin and marketplace documentation you verified against, with URLs; the exact list of paths `scripts/install-local.sh` touches; anything in the skill text that the CLI made awkward to follow (the driver will revise the skill, not you).

## Prompt to paste

```text
You are the implementer for grooph slice 0006 (the executive path). The repo is /Users/noir/Documents/grooph, published at github.com/ryanjosephkamp/grooph.

1. Run `git fetch origin` and create branch slice/0006-executive-path from origin/main.
2. Read handoffs/0006-executive-path/HANDOFF.md first, then the files in its "Read first" order. docs/executive.md is normative for this slice; plugins/grooph/skills/grooph-design/SKILL.md is the driver's and is read-only for you.
3. Work only inside the handoff's "Allowed changes". Commit often with `<area>: <what changed>` messages and push the branch.
4. Each time a success criterion is met, append one line to the "In flight" section of docs/PROGRESS.md under a "Slice 0006" heading (create it).
5. This slice makes no headless model runs and never writes to the real ~/.claude or shell profile; test the install script with HOME pointed at a scratch folder.
6. When done, or if blocked, finish with the grooph-handback skill: the branch must be pushed and HANDBACK.md committed before you print the return prompt, which is the last block of your final reply.
```
