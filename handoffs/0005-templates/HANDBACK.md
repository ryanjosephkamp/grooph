# Handback 0005 · Templates and the pattern library

**Implementer:** Opus 5 (`claude-opus-5`) · **Branch:** `slice/0005-templates` · **Head commit:** `dc8def9` (this handback is the commit on top of it) · **Date:** 2026-09-18

## Status

`done` — all eight criteria met. No headless model run was made; the only tokens spent were this session's.

## What changed

**`packages/core`**
- `src/types.ts`, `src/schema/graph.ts`, `schema/grooph-0.schema.json` (regenerated) — `Template`, `TemplateKind`, `Profile`, `TemplateSlot`; the `template` block sits after `lineage` in canonical order.
- `src/template.ts` `new` — `instantiate`, `insertFragment`, `extractTemplate`, `templateIndexEntry`, `templateIndex`, `findSlots`, `fillSlots`, `slotKeys`, `estimateProfile`, `TemplateError`. Pure, no I/O.
- `src/issues.ts`, `src/validate.ts` — `E_IS_TEMPLATE` and `E_UNFILLED_SLOT` as export-only rules, in table order after `E_NO_GOAL`; `E_IRREVERSIBLE_NO_GATE` reworded to graph-ir §3 (every way in must pass a human; no inbound edge is ungated) and its `at` now names the open edges.
- `src/compile/claude-code/lead.ts` — LEAD.md §9: the kickoff-amendment-versus-redesign paragraph, and the op-list `patch` preference (adaptive: in item 2 and in the example note, which now carries an op patch; propose: one paragraph).
- `src/index.ts` — exports the template module, and `closest` / `didYouMean` for the CLI.
- `README.md` — a Templates section.
- `test/template.test.ts` `new` (16), `test/patterns.test.ts` `new` (35); `test/rules.test.ts` (mixed inbound, the two new codes), `test/compile.test.ts` (§9 wording). 174 tests (was 119).

**`packages/cli`**
- `src/registry.ts` `new` — project, user, built-in and remote registries; fetch with a 10 s timeout; `saveToRegistry` refreshes the folder's `index.json`.
- `src/commands/template.ts`, `src/commands/template-args.ts` `new` — the six subcommands and their usage.
- `src/index.ts` — `template` wired in, usage updated, `run()` takes an optional registry environment (tests), `RegistryError`/`TemplateError` exit 1 with a message.
- `scripts/bundle-patterns.mjs` `new`, `package.json` — `build` copies the patterns into `dist/patterns/`.
- `test/template.test.ts` `new` (15). 35 tests (was 20).

**`patterns`** — sixteen `<id>.grooph.json` `new`, `review-gate.expect.json` `new`, `index.json` `new` (generated), `README.md` (generated; replaces the stage-0 placeholder).

**`fixtures`** — `invalid/E_IS_TEMPLATE/template-exported`, `invalid/E_UNFILLED_SLOT/slot-left-unfilled`, `invalid/E_IRREVERSIBLE_NO_GATE/mixed-inbound` `new`; `golden/claude-code/review-loop/.grooph/review-loop/LEAD.md` regenerated (the `fix-until-green` golden is `fixed`, whose §9 has no patch text, and did not change).

**Elsewhere** — `scripts/patterns-index.mjs` `new`; `.github/workflows/ci.yml` (index check; a built-in template instantiated, validated and exported with the network pointed at a dead address); `.github/workflows/deploy.yml` (index check, then `cp -R patterns apps/web/dist/patterns`); `docs/PROGRESS.md` In flight only. `apps/web`, root `package.json` and `pnpm-lock.yaml` unchanged.

## Verified, and how

Re-run now in the working tree at `dc8def9`, and earlier from a fresh clone of `origin/slice/0005-templates` at `f7f21db` (the only later commits touch `docs/PROGRESS.md`).

| # | Criterion | Command | Observed |
|---|---|---|---|
| 1 | Green from a fresh clone | `git clone --branch slice/0005-templates …` then `pnpm install --frozen-lockfile && pnpm -r build && pnpm -r test` · `pnpm --filter @grooph/web test:e2e` · `gh run list --branch slice/0005-templates` | exit 0: core 174/174, cli 35/35, web 22/22; browser 10/10. Same numbers re-run at `dc8def9`. CI green on every push of the slice (build on Node 22 and 24, web-e2e). |
| 2 | The template block | `test/template.test.ts` ("round-trips through the schema and sits after lineage"), `test/schema.test.ts` (committed schema matches), `test/fixtures.test.ts`, `test/rules.test.ts` | pass. `invalid/E_IS_TEMPLATE/template-exported` reports exactly `E_IS_TEMPLATE` (a template's slots do not also raise `E_UNFILLED_SLOT`); `invalid/E_UNFILLED_SLOT/slot-left-unfilled` reports exactly `E_UNFILLED_SLOT`; both are legal while authoring. |
| 3 | Core operations | `node --test dist/test/template.test.js` in `packages/core` | 16 pass: instantiate then extract round-trips (both the slotted and the filled route); `insertFragment` re-derives `builder` → `builder-2`, `done` → `done-2`, derived edge ids follow their nodes, `--prefix` prefixes everything, the id map is returned; a fragment keeps a loop and a scoped policy only when fully inside; nothing mutates its input. |
| 4 | Registries and CLI | `node --test dist/test/template.test.js` in `packages/cli` | 15 pass, against a static server on 127.0.0.1 and a closed port, never the live site: project shadows user shadows built-in (and `list` says so); a local hit makes no request (request log empty); a miss fetches `index.json` then the file; `--registry` takes an index or folder URL; `add` by name and by URL, after which the name resolves locally; offline gives `…could not be reached (ECONNREFUSED). If you are offline, local templates still work: grooph template list`; 404 and non-index answers are named. |
| 5 | The pattern library | `node --test dist/test/patterns.test.js` in `packages/core` · `node scripts/patterns-index.mjs --check` | 35 pass: exactly the sixteen ids; each instantiated with its slot examples (the fragment inserted into a host) and validated for export: no errors, warnings exactly as the sidecar lists (only `review-gate`: `W_HOMOGENEOUS_CRITICS`). The §5 rules are checked mechanically per pattern: kind and profile match the table; every loop has a turns/minutes budget and max-iterations ≤ 5; critics fresh, with evidence, `write-outputs`, `edit-files` denied; `adaptation` unset except `retrospective-rewrite`; briefs ≤ 4 sentences and no step lists; slots declared = used; under 12,000 characters (largest: `specialist-critic-bank`, 10,288). The index check passes and is a CI step. |
| 6 | Published | `pnpm --filter @grooph/web build`, `cp -R patterns apps/web/dist/patterns` (the deploy step), `vite preview --port 4173`, `curl` | `/grooph/patterns/index.json` 200 `application/json`; all sixteen files 200; `grind-loop` byte-identical; `grooph template list --registry http://localhost:4173/grooph/patterns/` lists them; `grooph template add taste-polish --registry http://localhost:4173/grooph/patterns/index.json` writes it into a project folder. The live URL exists only after merge. |
| 7 | Carried from review 0004 | `test/rules.test.ts`, `test/fixtures.test.ts`, `test/compile.test.ts`, `pnpm --filter @grooph/core run golden:write` + `git diff` | `invalid/E_IRREVERSIBLE_NO_GATE/mixed-inbound` (one approved edge, one open) reports the code; validated with `main`'s core it reported nothing, so the fixture pins the hole. The golden diff is two paragraphs and one changed example line in `review-loop` LEAD.md §9, read as a document. |
| 8 | Dogfood by CLI only | the script below, run in a scratch folder with `GROOPH_REGISTRY` pointed at a dead address | 13 steps, every one exit 0, no network needed. |

## How to verify: the final working form

```bash
pnpm install --frozen-lockfile && pnpm -r build && pnpm -r test
pnpm --filter @grooph/web test:e2e
node scripts/patterns-index.mjs --check
pnpm exec grooph template list
pnpm exec grooph template use review-gate --name "Try it" --set task="Add a slugify function" --set test-command="pnpm test" --set checklist=docs/REVIEW-CHECKLIST.md --out "$TMPDIR/try.grooph.json"
pnpm exec grooph validate --for-export "$TMPDIR/try.grooph.json"
rm "$TMPDIR/try.grooph.json"
```

The handoff's `use` with only `--set task=…` also works (exit 0) and prints the questions for the two other slots on stderr; the `validate --for-export` after it then exits 1 with `E_UNFILLED_SLOT` for `{{checklist}}` and `{{test-command}}`, which is the rule doing its job. The working form above sets all three and validates with `0 errors, 1 warning` (`W_HOMOGENEOUS_CRITICS`, true of the review gate). `use` refuses to overwrite an existing `--out` without `--force` (like `grooph new`), hence the `rm`; I deleted my own `$TMPDIR/try.grooph.json` so your first run is clean.

## Dogfood transcript (criterion 8)

Run in a scratch folder holding `.git/` (so `.grooph/templates/` lands there), with `grooph` = `node $REPO/packages/cli/bin/grooph.js`, `GROOPH_HOME` in the folder and `GROOPH_REGISTRY=http://127.0.0.1:9/offline/index.json`. Nothing reached the network. The kickoff and the long list are elided where marked.

```text
$ grooph template use review-gate --name Slugify --set 'task=Add a slugify(text) function to src/strings.ts that lowercases, strips accents and joins words with single hyphens.' --set 'test-command=pnpm test' --out slugify.grooph.json
1 slot still unfilled; the document holds it as {{key}}:
  {{checklist}}  Which file holds the checklist the critic judges against?  (e.g. docs/REVIEW-CHECKLIST.md)
Fill it with --set key=value, by editing the file, or with grooph apply; export refuses unfilled slots (E_UNFILLED_SLOT).
warning  W_HOMOGENEOUS_CRITICS  every critic ("critic") runs on the same model as every writer ("builder"): tier strong; a critic on a different tier or pin tends to catch different mistakes  [at: builder, critic]
slugify.grooph.json: 0 errors, 1 warning
wrote slugify.grooph.json (graph "slugify" from review-gate@1, built-in)
next: grooph validate --for-export slugify.grooph.json
[exit 0]

$ grooph template use review-gate --name Slugify --force --set 'task=Add a slugify(text) function to src/strings.ts that lowercases, strips accents and joins words with single hyphens.' --set 'test-command=pnpm test' --set checklist=docs/REVIEW-CHECKLIST.md --out slugify.grooph.json
warning  W_HOMOGENEOUS_CRITICS  every critic ("critic") runs on the same model as every writer ("builder"): tier strong; a critic on a different tier or pin tends to catch different mistakes  [at: builder, critic]
slugify.grooph.json: 0 errors, 1 warning
wrote slugify.grooph.json (graph "slugify" from review-gate@1, built-in)
next: grooph validate --for-export slugify.grooph.json
[exit 0]

$ cat critic-frontier.ops.json
[{"op": "updateNode", "id": "critic", "set": {"model": {"tier": "frontier"}}}]
[exit 0]

$ grooph apply slugify.grooph.json --ops critic-frontier.ops.json --write
slugify.grooph.json: no issues
applied 1 op; wrote slugify.grooph.json
[exit 0]

$ grooph validate --for-export slugify.grooph.json
slugify.grooph.json: no issues
[exit 0]

$ grooph export slugify.grooph.json --target claude-code --into pkg
wrote 7 files into pkg
  .claude/agents/slugify--builder.md
  .claude/agents/slugify--critic.md
  .claude/skills/slugify/SKILL.md
  .grooph/slugify/KICKOFF.md
  .grooph/slugify/LEAD.md
  .grooph/slugify/MAPPING.md
  .grooph/slugify/graph.grooph.json

Kickoff — paste this into a Claude Code session opened in pkg:

  … the kickoff prompt (25 lines, identical to pkg/.grooph/slugify/KICKOFF.md) …
[exit 0]

$ grooph template save slugify.grooph.json --id build-and-review --title 'Build and review' --summary 'A builder and a frontier critic loop against a checklist, then a human approves.' --when 'A change that needs review against an existing checklist before a human merges it.' --fragment --nodes builder,critic,merge-gate
warning  W_NO_TERMINAL  the graph has no stop node, so the run ends only when no edge is left to take; add one where the work is done  [at: build-and-review]
build-and-review: 0 errors, 1 warning
saved build-and-review@1 (fragment: 3 nodes, 4 edges, 1 loop) to $DOGFOOD/.grooph/templates/build-and-review.grooph.json
profile (estimated from the graph; edit the template block if it reads wrong): high · medium · standard
insert it: grooph template insert build-and-review --into <graph.grooph.json> --write
[exit 0]

$ grooph template list
project ($DOGFOOD/.grooph/templates/)
  build-and-review          fragment  high · medium · standard
      A change that needs review against an existing checklist before a human merges it.

built-in ($REPO/packages/cli/dist/patterns/)
  contradiction-seeker      graph     low · fast · standard
      A claim can be broken by one concrete counterexample …
  … fifteen more built-in rows, as in grooph template list …

17 templates. Read one: grooph template show <name>. Start from one: grooph template use <name> --name "<graph name>".
[exit 0]

$ grooph template use grind-loop --name 'Release notes' --set 'task=Write release notes for 1.4.0 in CHANGELOG.md from the merged pull requests.' --set 'test-command=pnpm run check-changelog' --out release.grooph.json
release.grooph.json: no issues
wrote release.grooph.json (graph "release-notes" from grind-loop@1, built-in)
next: grooph validate --for-export release.grooph.json
[exit 0]

$ grooph template insert human-gated-irreversible --into release.grooph.json --set 'action=Publish the 1.4.0 release notes to the project site.' --set irreversible=publish --write
inserted human-gated-irreversible@1 (built-in): 3 nodes, 2 edges, 0 loops
ids (template → graph):
  gate → gate
  act → act
  done → done-2   (renamed)
  e-gate-act → e-gate-act
  e-act-done → e-act-done-2   (renamed)
nothing leads into "gate" yet; connect it with grooph apply, e.g. [{"op": "connect", "from": "<node>", "to": "gate"}]
release.grooph.json: no issues
wrote release.grooph.json
[exit 0]

$ cat wire-gate.ops.json
[{"op": "updateEdge", "id": "e-tests-pass", "set": {"to": "gate"}}, {"op": "removeNode", "id": "done"}]
[exit 0]

$ grooph apply release.grooph.json --ops wire-gate.ops.json --write
release.grooph.json: no issues
applied 2 ops; wrote release.grooph.json
[exit 0]

$ grooph validate --for-export release.grooph.json
release.grooph.json: no issues
[exit 0]
```

## Patterns: the smallest-graph choice in each

| Pattern | Nodes | Choice |
|---|---|---|
| `grind-loop` | builder, tests, done | No critic: the check is the bar. Builder on `fast` because the profile is low · fast; 5 rounds, 30 minutes. |
| `review-gate` | builder, critic, merge gate, done | The review-loop fixture's shape and brakes (bar-passed, 4 rounds, 40 turns), briefs rewritten to purpose, limits and outputs, ids derived. Builder and critic share a tier on purpose, so `W_HOMOGENEOUS_CRITICS` is its one listed warning. |
| `heterogeneous-critic` | as review-gate | The critic on `frontier`, builder `strong`; the stage-11 note is in the description and on the critic node, and says that tiers within one harness are one model family. |
| `taste-polish` | owner, capture check, critic, done | The check is `kind: "evidence"` and runs the capture command, so a bad capture never reaches the frontier critic. Stops in the table's order: bar-passed, diminishing-returns 2, human every 2, max 5, budget 60 turns. |
| `spec-then-loop` | planner, spec gate, builder, critic, done | Rejecting the spec ends the run rather than adding a spec-revision loop; an adaptive lead can add one when needed. Planner on `frontier`. |
| `metric-sandwich` | builder, checks, critic, done | One loop, two back edges; the critic (frontier) is told not to rerun or restate the checks. |
| `dual-bar` | builder, critic, done | Ship line and aspiration are slots, handed to both nodes as inputs because the bar lives in LEAD.md, not in the node files. |
| `specialist-critic-bank` | builder, 4 critics, triage judge, gate, done | Concurrency cap 4 at graph scope; the triage's description says it runs once per round after all four reviews are in. Critics `strong`, triage `frontier`. |
| `ownership-not-swarm` | planner, owner A, owner B, worker, integrator, tests, done | Two owners, the fewest that show "in sequence", owning the `subsystem-a` / `subsystem-b` slots; one worker node reached through an edge with `concurrency: 3` stands for the fan-out; the integrator may not write owned folders; one grind loop at the end. |
| `tournament-then-judge` | 3 candidates, filter, judge, finisher, done | Each candidate owns `candidates/<x>`; no loop; a filter with no finalist has no edge, so the run ends there. |
| `contradiction-seeker` | builder, hunter, done | Builder `fast`, hunter `strong`; the claim is a slot and a node input, not edge evidence; the per-hunt effort ("about ten attempts") lives in the brief because graph-ir has no per-node budget. |
| `red-team-loop` | builder, red team, done | The red team (frontier) owns `traces`; the builder's only evidence on the way back is `traces/`; a clean attack round exits by the pass edge, and diminishing-returns 2 on "new failing traces" halts a round that only repeats old ones. |
| `debate-then-build` | planner A, planner B, judge, plan gate, builder, tests, done | Planners are writers and cannot emit pass or fail, so the judge moderates: verdict `rebut` is the back edge, and `max-iterations 2` continues at the judge (`then`), which must then decide. The budget stop halts, as a brake should. |
| `human-gated-irreversible` | gate, act, done | Slots `action` and `irreversible` (the marker itself is slotted, e.g. `merge`). |
| `retrospective-rewrite` | builder, tests, retrospective, done | `adaptation: "propose"`; both loop stops continue at the retrospective (`then`), so it runs after a failed run too, which is when it matters most. |
| `fresh-grind-rare-judge` | builder, tests, judge, done | The judge's verdicts: `fail` (fix this phase) and `next-phase` are both back edges to the builder, `pass` ends the run. |

## Rules I wished the validator had

1. **`W_HOMOGENEOUS_CRITICS` is graph-wide**, so one differing node masks a same-tier builder and critic: in `spec-then-loop` the frontier planner hides that builder and critic are both `strong`; in `specialist-critic-bank` the frontier triage hides four `strong` critics over a `strong` builder. A check per critic, against the writers whose work reaches it, would see both.
2. **No join.** Fan-in (four reviews into triage, three candidates into the filter, the workers into the integrator) is said in a node description. A merge node is about artifacts, not about waiting for every inbound edge.
3. **Fan-out multiplicity** is expressed only as `concurrency` on one edge into one node; node `count` is deferred (graph-ir §9).
4. **Per-node budgets** are deferred, so a "fixed budget" hunt is a sentence in a brief.
5. **Mode inference** makes a writers-only debate loop a judgment loop that needs a bar; `debate-then-build` carries one that is informational.
6. **`W_NO_TERMINAL` on fragments.** A fragment saved from the middle of a graph usually has no stop node (the dogfood's `build-and-review` raises it). Fragments could be exempt.
7. **Latitude** (at most four sentences, no step lists) is checked by `patterns.test.ts` only, not by the validator.

## Decisions made

- **Built-ins bundled by copy.** `packages/cli/scripts/bundle-patterns.mjs` runs after `tsc` and copies `patterns/*.grooph.json` and `index.json` into `packages/cli/dist/patterns/`; the CLI resolves built-ins from there, so it does not depend on the repo layout once built. Core has no file or network access.
- **Index generator** is `scripts/patterns-index.mjs` (Node, reading core's `dist`), with `--check`; rows come from `templateIndexEntry`, sorted by id; the README table is generated from the same rows. `patterns.test.ts` also runs `--check`, so a stale index fails `pnpm -r test`, not only CI.
- **`generated` is omitted** from `index.json` so the committed file is deterministic.
- **User folder** is `$GROOPH_HOME/templates`, else `os.homedir()/.grooph/templates` on every platform (on Windows, `%USERPROFILE%\.grooph\templates`).
- **Project folder** is `.grooph/templates/` at the working-tree root (the nearest ancestor holding `.git`), else the current folder, so it is found from subfolders.
- **Remote.** `--registry` is repeatable, takes an index URL or its folder, and replaces the default rather than adding to it; `GROOPH_REGISTRY` overrides the default URL (CI uses it to prove built-ins need no network); a 10 s timeout. `list` touches the network only with `--registry`.
- **Slots.** `{{key}}` tolerates inner spaces; run notes and the template block never hold slots. `instantiate` and `insertFragment` refuse a value for a slot the template does not have, with did-you-mean. `E_UNFILLED_SLOT` is one issue per key, `at` in document order. A template reports `E_IS_TEMPLATE` only, not also `E_UNFILLED_SLOT`.
- **Slot names** beyond the common ones: `reference`, `capture-command`, `ship-line`, `aspiration`, `subsystem-a`, `subsystem-b`, `criteria`, `claim`, `attack-surface`, `phase-checklist`, `action`, `irreversible`.
- **Every graph pattern carries `target: claude-code`** so an instantiated graph exports as is; it is the only profile today and one field to change.
- **Tiers.** Critics are `frontier` where the table says expensive or frontier, or where a same-tier critic would only earn a warning; `review-gate` keeps the fixture's same tier.
- **Default `--to` is `project`** for `save` and `add`: visible in the working tree and reviewable in git.
- **`save` estimates the profile** (`estimateProfile`: cost from tiers, speed from judged loops and size, rigor from critics and gates) and says so, since §4 gives it no profile flag; a leftover `{{key}}` gets a slot whose ask and example should be edited.
- **`insertFragment` also takes whole-graph templates** and inserts them as a subgraph; a graph-scoped policy comes along unless the host already has the identical one.
- **Pattern sidecars** sit beside the patterns as `<id>.expect.json`, as fixtures do; the whole folder is published, sidecar included.

## Deviations

- **Flags beyond `docs/templates.md` §4:** `--force` on `use`, `save` and `add` (they refuse to overwrite otherwise, the same convention as `grooph new`), and `--registry` on `show`, `use`, `insert` and `add` as well as `list` (§3 says remote is "any registry URL passed with `--registry`" without limiting it to `list`). `save --force` bumps the replaced template's version by one.
- **`extractTemplate` strips a little more than §2 lists:** for fragments also `constraints`, `adaptation` and `description` (graph-level fields insertion ignores); for whole graphs, run notes (one run's history). A whole-graph template keeps its goal, target and layout. The extracted document's `name` is its title, `version` 1, and `lineage.from` names the source graph and version.
- No driver-owned file was touched.

## Ambiguities in `docs/templates.md`, with my reading

1. §2 "Strips notes, layout, goal and target for fragments" — read as a list of examples of whole-graph data; see Deviations.
2. §2 `insertFragment` does not say whether a `kind: "graph"` template may be inserted — read as yes (spec §10 lists "a subgraph" among reusable things).
3. §3 remote "any registry URL passed with `--registry`, and by default the published library" — read as: `--registry` replaces the default.
4. §3 `generated?` — left out, for a deterministic committed index.
5. §3 "bundled with the CLI and the web app" — the CLI only; the web app has no template UI in this slice (Leftovers).
6. §4 `--to project|user` has no stated default — `project`.
7. §4 `save` has no profile flag while the block requires one — estimated, and printed for correction.
8. §5 "a `max-iterations` stop of 5 or fewer, besides its real stop" — for `debate-then-build` the debate's real stop *is* `max-iterations 2`; it has no other.
9. §5 "Common slots: `task`, `test-command`, and the pattern's own bar reference" — read as the usual set, not a requirement: `taste-polish` has no test command, and the fragment has neither.
10. §1 the `version` of a template document is the template's version (what `lineage.from` records), not a graph version.

## Risks and leftovers

- **The live URL** exists only after merge, since `deploy.yml` runs on `main`: `curl -sI https://ryanjosephkamp.github.io/grooph/patterns/index.json` should answer 200, and `grooph template add grind-loop` from outside the repo should work with no `--registry`.
- **Web app:** built-in templates are not bundled into it yet (for the templates-in-the-app slice). It already lays out nodes that have no `layout` entry, which `insert` produces (`apps/web/src/doc/layout.ts`).
- **`docs/PROGRESS.md` Known risks** still says not to copy the review fixture into `patterns/` before `write-outputs` lands; that has been true since stage 3 and the line is now stale (the section is the driver's).
- **Round counting** of an inner loop inside an outer one (`fresh-grind-rare-judge`: does the inner max-iterations reset each phase?) is not defined by graph-ir §2; the lead decides.
- `vite preview` answers an unknown path with the app's `index.html`; GitHub Pages answers 404. grooph names either clearly.
- `estimateProfile` is coarse by design and will read wrong sometimes; `save` says so.
- Nothing left in the tree: no TODOs, no stray files; my `$TMPDIR/try.grooph.json` is deleted.

## Prompt to paste into the driver session

```text
Handback for slice 0005 is at handoffs/0005-templates/HANDBACK.md on branch slice/0005-templates (work head dc8def9; the handback commit is on top). Status: done. Please reconcile with the grooph-reconcile skill.
```
