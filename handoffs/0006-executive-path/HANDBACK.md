# Handback 0006 · The executive path

**Implementer:** Opus 5 (`claude-opus-5`) · **Branch:** `slice/0006-executive-path` · **Head commit:** `4b537cf` (this handback is the commit on top of it) · **Date:** 2026-09-18

## Status

`done`: all nine criteria are met. No headless model run was made, and nothing was written to the real `~/.claude` or to any shell profile. The install script and `claude plugin validate` ran only with `HOME` pointed at scratch folders.

## What changed

**`packages/core`**
- `src/types.ts`: new types `ProposalSet`, `Candidate`, `CandidateFile`, `Shape` and `ShapeTier` (docs/executive.md §1).
- `src/schema/proposals.ts` (new) and `schema/grooph-proposals-0.schema.json` (new, generated): the proposal set schema. Inline graphs are checked by the graph schema and published as a `$ref` to it. A `{ file }` candidate is told apart from a graph by its keys, so a broken inline graph is reported at its own path. `src/schema/dsl.ts` gained `maxItems`, `nul()`, `external()` (a `$ref` to another schema) and `either()` (a predicate switch). `src/schema/graph.ts` exports `profileSchema`, and the graph JSON Schema is byte-identical. `src/schema/path.ts` and `src/schema/write.ts` now write both schemas. `package.json` exports the new schema.
- `src/proposals.ts` (new) provides `parseProposalSet`, `validateProposalSet`, `estimateShape`, `shapeLine`, `tierLine`, `findCandidates`, `labelKey` and `canonicalizeProposals`.
- `src/share.ts` (new) provides `buildShareEnvelope`, `parseShareEnvelope`, `encodeSharePayload`, `decodeSharePayload`, `shareLink`, `sharePayloadFrom` and base64url. The raw DEFLATE codec is injected by each shell, and every refusal message lives here.
- `src/issues.ts`: `hasErrors` and `formatIssue` accept any issue-shaped value (`IssueLike`), so graph and proposal issues print alike.
- `src/validate.ts`: `W_HOMOGENEOUS_CRITICS` is now judged per critic, and `W_NO_TERMINAL` spares fragment templates (criterion 8).
- Tests: `test/proposals.test.ts` and `test/share.test.ts` are new, and `test/rules.test.ts` has two new tests. The count went from 174 to 208.
- `README.md` has a section on proposal sets and share links.

**`packages/cli`**
- `src/share-io.ts` (new) holds the `node:zlib` raw DEFLATE codec, loads graphs and proposal sets (inlining `{ file }`), and opens links with the platform opener.
- `src/commands/share.ts`, `pick.ts` and `shape.ts` (new). `src/index.ts` wires them in and adds `--help` to every command.
- Tests: `test/share.test.ts` is new. In `test/cli.test.ts`, one expectation encoded the old masking behaviour and now asserts the per-critic warning. The count went from 35 to 44.

**`apps/web`**
- `src/App.tsx` adds the `#/open?d=…[&c=<candidate>]` route.
- `src/doc/share.ts` (new) is the fflate codec, capped by an `out` buffer one byte past the limit.
- `src/ui/open/` is new: `OpenScreen`, `Compare` (the compare view), `GraphViewer` (read-only graph with a Save bar), `Details` (read-only node, loop, graph and issue sheets) and `save.ts`.
- `src/ui/canvas/ViewCanvas.tsx` (new) is a read-only React Flow canvas with a compact `mini` variant for cards. `GraphEdge.tsx` now works without an editor. `src/doc/layout.ts` accepts a node box, with `MINI_BOX` added.
- `src/store/library.ts` adds `saveFromLink`, which does not save the same graph twice. `src/ui/Library.tsx` imports a self-contained proposal set into the compare view.
- `src/styles.css` adds the viewer, link-problem and compare view styles (phone scroll-snap row, desktop subgrid).
- Tests: `test/share.test.ts` is the cross-codec test. `e2e/open.spec.ts` has 9 browser tests. `e2e/screenshots.spec.ts` only runs when `GROOPH_SHOTS=1`. `e2e/support.ts` has link helpers. Unit tests went from 22 to 29, and browser tests from 10 to 19.

**Fixtures and patterns**
- `fixtures/invalid/W_HOMOGENEOUS_CRITICS/one-critic-of-two`, `fixtures/valid/audit-then-fix` and `fixtures/valid/approval-fragment` (new).
- `fixtures/proposals/` (new): `valid/csv-export/` (the rehearsal set with its three graphs), `valid/one-inline/`, and one invalid set per proposal code.
- `fixtures/golden/claude-code/review-loop/.grooph/review-loop/LEAD.md` carries the reworded warning message.
- `patterns/specialist-critic-bank.expect.json` (new): the sharper rule fires there.
- `fixtures/README.md` documents the `proposals/` tree.

**Packaging, scripts, CI**
- `.claude-plugin/marketplace.json` (new) and `plugins/grooph/.claude-plugin/plugin.json` (new). `plugins/grooph/README.md` (new) explains both install routes. `SKILL.md` is untouched.
- `scripts/install-local.sh` (new) and `scripts/test-install-local.sh` (new, a check run in CI).
- `.github/workflows/ci.yml` has two new steps: shape, share, pick and export from the command line, and the install-script test.

**Slice folder:** this handback, `rehearsal-transcript.txt`, and nine screenshots.

## Verified, and how

All commands were run from a fresh clone of the pushed branch at `4b537cf`, unless noted.

| # | Criterion | Command | Observed |
|---|---|---|---|
| 1 | Green from a fresh clone; CI green | `pnpm install --frozen-lockfile && pnpm -r build && pnpm -r test`, then `pnpm --filter @grooph/web test:e2e` | core 208/208, cli 44/44, web 29/29; browser 19 passed, 5 skipped (the screenshot specs, which run on request). CI green at `decdb3c`, `8346c88` and `4b537cf`. See Risks for the one earlier red run. |
| 2 | Proposal sets in core | `packages/core/test/proposals.test.ts` | The committed schema equals the generated one. ajv (with the graph schema added) agrees with `parseProposalSet` on every proposal fixture and on a set with a broken inline graph. Each of the 6 codes has a fixture that reports exactly that code. `estimateShape` is tested on a flat loop (`1 agent · 1 check · 1 loop · up to 5 rounds · 30 minutes`), on nested loops (3 + 3×4 + 3×4×2 = 39) and on an uncapped loop (`worstCaseRounds: null`, "no round cap"). |
| 3 | Envelope and codec, each side reads the other's output | `apps/web/test/share.test.ts`, `packages/core/test/share.test.ts` | A graph and the three-candidate set, made by the CLI codec and opened by the app codec, and the reverse, round-trip exactly. A truncated link fails on both sides with "The link is damaged … Ask for the link again, or for the file (grooph share --out)". A 5 MB DEFLATE bomb (about 7 KB of payload) is stopped at the 4 MB cap on both sides with "unpacks to more than 4 MB … It was not opened". Run notes are dropped and layout is kept. |
| 4 | CLI | `pnpm exec grooph shape fixtures/valid/review-loop.grooph.json`, `pnpm exec grooph share fixtures/valid/review-loop.grooph.json --base http://localhost:4173/grooph/`, and `packages/cli/test/share.test.ts` | `review-loop: 2 agents · 1 gate · 1 loop · up to 4 rounds · 40 turns` / `tiers: 2 strong`. The share prints the shape and warnings, then `link (1,926 characters):` and the link. Tests cover inlining, `--out`, the 32,000 warning, `--open` (with a stub opener, including one that fails), `--base` normalisation and refusal, pick by id or label in any case, ambiguity refused, errors refused, overwrite refused without `--force`, `shape --json`, and `--help` on every command. |
| 5 | Opening a link | `apps/web/e2e/open.spec.ts` at 400×800 with touch | A graph link opens read-only: no Export, no toolbar, read-only details, and the library stays empty. Save stores it and it opens in the editor. A three-candidate link opens the compare view. A CDP touch swipe moves card to card and the pager follows. Choose puts exactly `I pick "Reviewed" (reviewed) from csv-export.` on the clipboard. Save, then the library, then the editor: an edit sticks, and saving again does not duplicate. Open full graph goes there and back. A truncated link, a link with foreign characters and an empty `d=` each give the message and a way back to the library. The `--out` file imports into the compare view. A desktop test (1280×900) checks three cards in one row with profile, shape, rationale, status, canvas and actions rows each at the same height across cards. |
| 6 | Compare view quality | same spec; `GROOPH_SHOTS=1 pnpm --filter @grooph/web exec playwright test e2e/screenshots.spec.ts` | On a phone, the Lean card's label, badge, recommendation reason, profile, shape line and the first three lines of rationale all start above the sticky action bar (asserted). The mini canvas uses compact nodes (name, and role with tier), is auto-laid-out in two columns, and is sized to the graph. Pros and cons are `<ul>`s. Screenshots: `compare-phone-light.png`, `compare-phone-dark.png`, `compare-desktop.png`, plus `compare-phone-light-lower.png`, `compare-phone-light-second.png`, `full-graph-phone.png` and `damaged-link-phone.png`. |
| 7 | Packaging | `HOME=<scratch> claude plugin validate --strict .` and `… plugins/grooph` (Claude Code 2.1.276); `scripts/test-install-local.sh` | Both manifests report "✔ Validation passed" under `--strict`. The install test, with `HOME` set to a mktemp folder, checks: the dry run changes nothing; install makes exactly the two links and their folders; the linked CLI runs and finds its bundled templates; a second run reports "Nothing to do."; without the bin folder on PATH it prints the `export PATH=…` line and writes no profile; uninstall removes only its links; a foreign file or folder in the way is refused with "Nothing was changed." and survives uninstall. The same test runs in CI. |
| 8 | Carried from review 0005 | `packages/core/test/rules.test.ts` and the fixture walk | Per critic: one differing critic no longer masks another; a writer downstream of the critic, or reaching it only through a back edge, does not count. `W_NO_TERMINAL` does not fire on a fragment template but still fires on a whole-graph template. The new fixtures behave as their folders say. `specialist-critic-bank` now raises the warning (sidecar added; no tiers changed). |
| 9 | Rehearsal without a model | below; `rehearsal-transcript.txt` | Done end to end. Link length for the three-candidate set: **4,902 characters** with `--base http://localhost:4173/grooph/`, or 4,913 with the default published base. |

## How to verify: the final working form

```bash
pnpm install --frozen-lockfile && pnpm -r build && pnpm -r test
pnpm --filter @grooph/web test:e2e
pnpm exec grooph shape fixtures/valid/review-loop.grooph.json
pnpm exec grooph share fixtures/valid/review-loop.grooph.json --base http://localhost:4173/grooph/
pnpm exec grooph share fixtures/proposals/valid/csv-export/csv-export.grooph-proposals.json --base http://localhost:4173/grooph/ --out /tmp/csv-export.grooph-proposals.json
pnpm exec grooph pick fixtures/proposals/valid/csv-export/csv-export.grooph-proposals.json reviewed --out /tmp/reviewed.grooph.json
scripts/test-install-local.sh
GROOPH_SHOTS=1 pnpm --filter @grooph/web exec playwright test e2e/screenshots.spec.ts
```

To look at a link yourself, run `pnpm --filter @grooph/web build && pnpm --filter @grooph/web preview`, then open the link printed with `--base http://localhost:4173/grooph/`. A default-base link needs this branch merged and deployed first; until then the live app does not know `#/open`.

For the owner's machine, when you choose to (I did not run it against your home):

```bash
scripts/install-local.sh --dry-run
```

```bash
scripts/install-local.sh
```

## Rehearsal transcript (criterion 9)

The full transcript is in `handoffs/0006-executive-path/rehearsal-transcript.txt`, where every command's output is verbatim. The setup was a made-up `orders-app`: Express, `GET /orders` with a status filter, Jest through `npm test`, and `docs/REVIEW-CHECKLIST.md`. The ask was "add CSV export to the orders list". The CLI was this branch built; `GROOPH_HOME` pointed at a scratch folder and `GROOPH_REGISTRY` was offline. Abridged:

```text
## Step 2 — read the library
$ grooph template list --json          → 16 templates; read grind-loop, review-gate, spec-then-loop
$ grooph template show review-gate     → when to use / not for / slots task, test-command, checklist

## Step 3 — three candidates that differ in shape
$ grooph template use grind-loop --name "CSV export lean" --set task="$TASK" --set test-command="npm test" --out .grooph/proposals/csv-export/lean.grooph.json
$ grooph template use review-gate --name "CSV export reviewed" --set task="$TASK" --set test-command="npm test" --set checklist=docs/REVIEW-CHECKLIST.md --out .grooph/proposals/csv-export/reviewed.grooph.json
warning  W_HOMOGENEOUS_CRITICS  critic "critic" judges "builder" on the same model (tier strong); …
$ grooph template use spec-then-loop --name "CSV export rigorous" --set task="$TASK" --set test-command="npm test" --out .grooph/proposals/csv-export/rigorous.grooph.json

## Step 4 — validate --for-export: lean no issues · reviewed 0 errors, 1 warning · rigorous no issues

## Step 5 — write .grooph/proposals/csv-export/csv-export.grooph-proposals.json (the warning goes into Reviewed's cons)

## Step 6 — share
$ grooph share .grooph/proposals/csv-export/csv-export.grooph-proposals.json --base http://localhost:4173/grooph/ --out .grooph/proposals/csv-export/csv-export.shared.grooph-proposals.json
csv-export · CSV export for the orders list · 3 candidates
  Lean      lean      1 agent · 1 check · 1 loop · up to 5 rounds · 30 minutes  (recommended)
  Reviewed  reviewed  2 agents · 1 gate · 1 loop · up to 4 rounds · 40 turns  (1 warning: W_HOMOGENEOUS_CRITICS)
  Rigorous  rigorous  3 agents · 1 gate · 1 loop · up to 4 rounds · 40 turns
recommended: Lean. The behaviour is fully testable and nothing is irreversible, …
link (4,902 characters):
http://localhost:4173/grooph/#/open?d=7Vppb-TGEf0r…
   → opened at 400×800 in the Playwright harness: rehearsal-phone.png; swiped to Reviewed, tapped Choose:
     clipboard = I pick "Reviewed" (reviewed) from csv-export.   (rehearsal-phone-choose.png)

## Step 7 — "the second one, but put the critic on a different tier"
$ echo '[{"op":"updateNode","id":"critic","set":{"model":{"tier":"frontier"}}}]' | grooph apply .grooph/proposals/csv-export/reviewed.grooph.json --ops - --write
.grooph/proposals/csv-export/reviewed.grooph.json: no issues
$ grooph validate --for-export .grooph/proposals/csv-export/reviewed.grooph.json      → no issues
$ grooph pick .grooph/proposals/csv-export/csv-export.grooph-proposals.json reviewed --out .grooph/graphs/csv-export-reviewed.grooph.json
picked "Reviewed" (reviewed) from csv-export → .grooph/graphs/csv-export-reviewed.grooph.json
next: grooph export .grooph/graphs/csv-export-reviewed.grooph.json --target claude-code --into .
$ grooph export .grooph/graphs/csv-export-reviewed.grooph.json --target claude-code --into .
wrote 7 files into .   (.claude/agents ×2, .claude/skills/csv-export-reviewed/SKILL.md, .grooph/csv-export-reviewed/{KICKOFF,LEAD,MAPPING}.md, graph.grooph.json)
Kickoff — paste this into a Claude Code session opened in .: …   ← printed; nothing started
```

## Plugin and marketplace documentation verified against

Claude Code **2.1.276** is installed here. I checked each point against the docs on 2026-09-18:

- https://code.claude.com/docs/en/plugin-marketplaces
  - The manifest lives at `.claude-plugin/marketplace.json` in the repo root.
  - Required: `name` (kebab-case, not a reserved name), `owner.name`, and `plugins[]` with `name` and `source`.
  - A relative source starts with `./` and resolves from the marketplace root.
  - Users install with `/plugin marketplace add owner/repo`, then `/plugin install <plugin>@<marketplace>`.
- https://code.claude.com/docs/en/plugins-reference
  - `.claude-plugin/plugin.json` is optional, and only `name` is required when it exists.
  - `skills/<name>/SKILL.md` is auto-discovered, and plugin skills are namespaced `/<plugin>:<skill>`.
  - A plugin's `bin/` is added to the Bash tool's `PATH` while the plugin is enabled.
- https://code.claude.com/docs/en/skills
  - Personal skills live at `~/.claude/skills/<name>/SKILL.md`, and a symlinked skill folder is followed.
  - Changes are picked up within a running session.
  - A personal skill and a plugin skill with the same name both load, the plugin one namespaced.
- `claude plugin validate --strict` passes for both manifests. I ran it only with `HOME` set to a scratch folder, because it writes `.claude/` and `.claude.json` into `HOME`.

The result is: `/plugin marketplace add ryanjosephkamp/grooph`, then `/plugin install grooph@grooph`, gives `/grooph:grooph-design`. The install script gives `/grooph-design`.

## Paths `scripts/install-local.sh` touches

- **Creates the symlink** `$BIN_DIR/grooph` → `<clone>/packages/cli/bin/grooph.js`. `$BIN_DIR` defaults to `$HOME/.local/bin` (already on the owner's PATH); `--bin-dir <dir>` overrides it.
- **Creates the symlink** `$HOME/.claude/skills/grooph-design` → `<clone>/plugins/grooph/skills/grooph-design`.
- **Creates folders** only when missing: `$BIN_DIR` and `$HOME/.claude/skills`, with `mkdir -p`. This can also create `$HOME/.local` and `$HOME/.claude`. Each is listed in the plan before it happens.
- **`--uninstall`** removes those two symlinks, and only when they still point into this clone. Folders stay.
- **Reads, never writes:** `node --version`, `packages/cli/dist/src/index.js`, `packages/cli/dist/patterns/`, `plugins/grooph/skills/grooph-design/SKILL.md`. It runs `$BIN_DIR/grooph --version` as the check.
- **Never:** a shell profile, a file or link it did not make (it refuses with "BLOCKED … Nothing was changed."), anything under `~/.claude` other than that one skill link, or the network.

## Decisions made

- **Proposal set codes live beside graph codes, not in `IssueCode`.** `ProposalIssueCode` is `E_SCHEMA`, `E_DUPLICATE_ID`, `E_DUPLICATE_LABEL`, `E_DANGLING_REF`, `E_CANDIDATE_INVALID` and `W_UNKNOWN_KEY`, with the same `{ code, severity, message, at }` shape. Graph codes keep their meaning. `E_DUPLICATE_LABEL` is new and compares labels without case, because `grooph pick` matches without case. The one-to-four rule is in the schema (`minItems`/`maxItems`), so it surfaces as `E_SCHEMA` at `/candidates`. A fixture walk under `fixtures/proposals/` gives each code a fixture, following the project convention.
- **Core owns every message; shells own only the codec.** `decodeSharePayload(payload, inflate)` takes the shell's raw INFLATE, which must throw `RangeError` past the cap. This keeps the CLI and the app from diverging in how they explain a bad link.
- **A link is stricter than an import.** A link document must pass the schema; import tolerates editable schema-invalid graphs. A link candidate with rule errors still opens and shows its errors on the card. A `{ file }` candidate or a duplicate id refuses the link. Shapes in a link are recomputed, never trusted.
- **`grooph share` refuses a single graph with export errors**, the same bar candidates meet, because the link exists to pick something to run.
- **`{ file }` is resolved against the set's folder first, then the working directory.** The skill does not say which, and an agent in the repo root may write repo-relative paths. The share help, the schema description and the error message all say "relative to the proposal set's folder".
- **The `--out` file is the self-contained proposal set** (canonical, graphs inlined, shapes computed), or the notes-free graph. The library import recognises a proposal set and opens the compare view by encoding it locally, storing nothing.
- **Save from a link does not duplicate:** the same graph id with the same canonical content returns the existing record.
- **Phone compare view.** Cards sit in a horizontal scroll-snap row with the next card peeking in, and `scroll-snap-stop: always` so a fling moves one card. A sticky bar holds the pager dots (usable without swiping), Save and "Choose <label>" for the card in view. Cards have per-card actions only at desktop width, where they sit side by side on a CSS subgrid so every row aligns. The brief clamps to three lines on a phone only.
- **The mini canvas** uses a compact node (136×46: name, and role · tier) in a two-column auto layout, sized to the graph (140–400 px). It is inert (`pointer-events: none`) so swipes pass through; "Open full graph" is the way in.
- **`Shape` details.** `gates` counts human-gate nodes plus `approval` edges. A loop's cap is its smallest `max-iterations`. Nesting means a strict subset of members, and every enclosing loop multiplies. Budgets read `40 turns` or `$5`, prefixed with the loop name when more than one loop has a budget.
- **`--help` on every command** prints its page (share, pick, shape) or the overview, and exits 0. The skill tells agents to use `grooph <command> --help`, which previously exited 1 for most commands.
- **`grooph pick --force`**, as `new` and `template use` have. Writing the same content again is allowed without it.
- **`--open`** uses `open` on macOS, `xdg-open` on Linux, and `cmd /c start` on Windows. A failure to open is reported, but share still exits 0.
- **The plugin ships no `bin/`.** A plugin install copies `plugins/grooph` without a built CLI or `node_modules`, so a `bin/grooph` there would not run. It becomes easy once the CLI is on npm (`exec npx @grooph/cli "$@"`); see Leftovers.
- **Manifest author is `ryanjosephkamp`** with the GitHub URL and no email.

## Deviations

- **One existing CLI test changed its expectation** (`validate accepts a run's working copy`). It asserted "no issues" because a new downstream writer used to mask `W_HOMOGENEOUS_CRITICS`. Under the per-critic rule the warning correctly stays.
- **`docs/executive.md` §1 types `worstCaseRounds: number`,** but its comment and the handoff say null when a loop has no max-iterations. I implemented `number | null`. The doc's type needs the fix (driver-owned).
- Otherwise none. `SKILL.md`, `docs/**` outside In flight, `spec/**`, `AGENTS.md` and `.claude/skills/**` are untouched.

## Readings the driver should check

- **`W_HOMOGENEOUS_CRITICS` on `spec-then-loop` still does not fire.** graph-ir says "every writer-family node whose work can reach it along non-back edges". There, the frontier planner's `ACCEPTANCE.md` does reach the critic, so the critic (strong) differs from one of its reaching writers. Review 0005 expected this pattern to be caught. If that is the intent, the rule should compare against the *nearest* writers upstream: those with a path to the critic that passes through no other writer. For `spec-then-loop` that is just the builder. I implemented the text as written.
- **A critic that no writer's work reaches is not flagged** ("every" of an empty set read as no). `fixtures/valid/audit-then-fix` pins this.
- **`W_NO_TERMINAL` still fires on a whole-graph template with no stop node.** Only fragments are exempt.

## Where the skill text was awkward to follow with the CLI

For the driver to revise; I did not edit `SKILL.md`.

1. **Step 5, `graph: { "file": … }`, does not say what the path is relative to.** The CLI accepts the set's folder, then the working directory. Suggest "a path relative to the proposal set's folder, e.g. `lean.grooph.json`".
2. **Step 7 ends with two copies of the chosen graph.** `grooph pick … --out .grooph/graphs/<id>.grooph.json` writes one, and `grooph export --into .` writes `.grooph/<id>/graph.grooph.json`, the source document the run reads. They can drift if one is edited. Options: pick straight to the package path, or say which copy is the one to edit.
3. **Step 7, "the second one but with X", changes a candidate after the link was shared,** so the phone still shows the old candidate. The rehearsal did exactly this. The skill could say to re-share when the change is material, or to say in chat what changed.
4. **Step 6's phone comparison lines.** `grooph share` prints label, id, shape line, warning codes and "recommended". The one reason to pick and the one reason not to must still come from the proposal set. That is fine, but the skill could say "take the lines from `grooph share`'s output and add the reasons".
5. **"`grooph <command> --help` is the reference for flags"** was false before this slice for most commands (exit 1 plus the overview). It is true now. Step 5's pointer to `grooph share --help` for the proposal set shape now works: it prints the format with a JSON example.

## Risks and leftovers

- **One CI run went red** (`6866022`, the web-e2e swipe test). The test dispatched its touch moves back to back, a fling fast enough to land on the third card now and then; the snapshot showed `scrollLeft` 690. The fix: one move per frame in the test, and `scroll-snap-stop: always` in the app. It then passed 100 of 100 local repeats under parallel load, and CI has been green since. Real-finger swiping on Android is untested, as the rest of the phone UI is.
- **The desktop alignment uses CSS subgrid** (Chrome 117+, Safari 16+, Firefox 71+). Without it the cards still stand side by side, only unaligned.
- **`apps/web/test/share.test.ts` imports the CLI's codec from source,** so the web typecheck (`tsc` in `pnpm build`) now covers `packages/cli/src/share-io.ts`. This is intentional, for the cross test.
- **Default-base links need this branch merged and the site deployed.** Until then the live app shows the library for `#/open`.
- **CI cannot run `claude plugin validate`** (no Claude Code on the runner), so the manifests are checked only locally.
- **Distribution:** the plugin route still needs a cloned, built CLI on PATH. With an npm publish of `@grooph/cli`, the plugin could carry a `bin/grooph` shim and be self-sufficient. That is the owner decision that decision 0007 already flags.
- **`grooph validate <proposal set>` reports graph-schema errors** rather than "this is a proposal set; grooph share checks it". It is a small follow-up.
- **`--open` on Windows is untested,** and `cmd /c start` limits the command line to about 8K characters.
- **Clean-up done:** no TODOs in the tree. The scratch clones, rehearsal app and fake HOMEs are all under the session scratchpad, not the repo.

## Prompt to paste into the driver session

```text
Handback for slice 0006 is at handoffs/0006-executive-path/HANDBACK.md on branch slice/0006-executive-path (work head 4b537cf; the handback commit is on top). Status: done. Please reconcile with the grooph-reconcile skill.
```
