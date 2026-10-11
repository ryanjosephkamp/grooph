# Inventory for slice 0103 (the lab)

Made on 2026-10-11 by a read-only researcher for the driver, before the handoff was written. It is the researcher's report as given, with this session's folder taken out of its paths. Where it and `HANDOFF.md` differ, the handoff wins.

Read at `main` 47ace71f, inside the worktree only. Nothing was changed, built or run. **Convention:** a statement carrying `file:line` was read in the code; anything else is tagged *(inferred)*. Line counts are `wc -l`. Paths are relative to ``.

## 0. The shape to design for, and the owner's hard requirement

**One private workspace package at `lab/`** (`@grooph/lab`, `"private": true`, bin `grooph-lab`), added to `pnpm-workspace.yaml` (today only `packages/*`, `apps/*`). `pnpm -r build` and `pnpm -r test` (ci.yml:33-34) then build and test it with no new CI job. `grooph-lab` is a **superset by pass-through**: it handles `export`, `adopt`, `runs`, `watch <run>`, brake-held `sub update --allow`, and an MCP server that adds `grooph_export`; every other command goes to `@grooph/cli`'s `run()` (packages/cli/src/index.ts:50). It cannot reach npm: the published package is bundled from `packages/cli/dist/src/main.js` alone (packages/cli/scripts/bundle.mjs:26-28) under a manifest written by hand (npm-package.mjs:157-179).

After the move, from the repository *(inferred design)*:

```
pnpm install && pnpm -r build
node lab/bin/grooph-lab.js export g.grooph.json --target claude-code --into <project> [--models ...]
node lab/bin/grooph-lab.js export g.grooph.json --target codex --into <project>     # after setTarget codex, as today (compile/index.ts:106-119)
node lab/bin/grooph-lab.js adopt <project>/.grooph/<id>/runs/<run> [--allow ...] [--write]
scripts/prove-pattern.sh <template> --dry-run | --model ... --effort ...
node scripts/prove-codex.mjs [--run]        scripts/compare.sh ...        experiments/game/setup/make-repo.sh
```

Two seams the lab needs from what stays: core must export `contentsOf` (groups.ts:27) and `GROUP_FROM_PATTERN` (schema/graph.ts:260), which `compile/units.ts:6-7` imports and `index.ts` does not export; `packages/cli/package.json:11-13` exports only `"."`, so the lab needs subpaths for `io`, `place`, `print`, `reply`, `share-io`, `run-io`, `mcp`, `mcp-author` (harmless: that manifest is never published). The MCP tool list is a module constant (mcp.ts:86-237), so `handle`/`serve` need a way to be given one more tool.

**What the runners call today:**

| Runner | Calls the `grooph` CLI | Imports core |
|---|---|---|
| `scripts/lib/prove-pattern.mjs` (680; entry `prove-pattern.sh` 64) | `CLI` = `packages/cli/bin/grooph.js` :17; `template use` :290,305; `template insert` :293; `apply` :300; `validate --for-export` :310,588; `export --target claude-code` :311; checks `packages/cli/dist/patterns` :337; puts a `grooph` shim on the session's PATH :578 | `packages/core/dist/src/index.js` :18,540, handed to `prove-check.mjs` |
| `scripts/lib/prove-check.mjs` (687) | none | `canonicalize, effectiveAdaptation, isCriticFamily, parseGraph, parseGraphText, validate, applyOps, OP_NAMES` :144; `validate(..., {forExport:true})` :180,440 |
| `scripts/prove-codex.mjs` (497) | `CLI` :18; `template use` :235; `apply` (setTarget codex) :239; `validate --for-export` :241; `export --target codex` :242 | :72-73; `parseRunNotes`, `summarizeRun` :170-172 |
| `scripts/lib/compare-run.mjs` (1,400; entry `compare.sh` 86) | `CLI` :72; `buildScratch` etc. from prove-pattern :66 (so every call above); expects "Named by GROOPH_MODELS" in export's output :389; PATH shim :1313 | :1249 |
| `scripts/lib/study-three-paid.mjs` (733) | none directly; reaches the compiler through `compare-arms-ef.mjs:25,83` (`buildScratch`) and `brake-run.mjs` | none; runs `experiments/game/setup/loaded.mjs` :555 |
| `scripts/lib/brake-run.mjs` (132) | `packages/cli/bin/grooph.js` :24; `apply --for-export` :45; `validate --for-export` :48; `export --models` :50 | none |
| `scripts/lib/compare-profile.mjs` (262) | asserts `grooph` is **not** on a session's path :202-203 | none |
| `scripts/e2e-claude-code.sh` (630) | :70, shim :234-235, `validate --for-export` :240 | :71,372-373,430 |
| `experiments/game/setup/make-repo.sh` (135) | builds `@grooph/core` and `@grooph/cli` :70; `node packages/cli/bin/grooph.js` :71; `export ... --target claude-code --models` :76; `hooks install` :77; names the compiler by `git log -1 -- packages` :64 and refuses on uncommitted changes under `packages` only :62; compares what it built with a frozen manifest :89-99 | none |

No runner calls `adopt`, `runs` or `watch`. A lead's brief tells a lead to run `grooph apply --ops` and `grooph validate --for-export <working copy>` (compile/claude-code/lead.ts:562,711,718; codex/lead.ts:565,714,721), so **`--for-export` must stay on the product's `validate` and `apply` in this slice**, and the compilers' bytes must not change (golden packages; the game's frozen starting contents, experiments/game/FROZEN.md).

## 1. What moves, by path

MOVE = goes under `lab/`. SPLIT = part of a file. STAY-LAB = stays at its path, declared lab, never shipped anyway (my recommendation for records, runner scripts, fixtures and documents: 126 files under `experiments/comparisons` and 20 pattern documents cite those paths).

### (a) Compile and export

| Path | Lines | |
|---|---|---|
| `packages/core/src/compile/index.ts`, `markdown.ts`, `units.ts` | 133, 45, 43 | MOVE |
| `packages/core/src/compile/claude-code/` (agents 222, context 151, index 37, kickoff 68, lead 802, mapping 149, skill 47) | 1,476 | MOVE |
| `packages/core/src/compile/codex/` (agents 200, context 134, index 25, kickoff 66, lead 795, mapping 41) | 1,261 | MOVE |
| `packages/core/src/targets/index.ts` (`getProfile`), `packages/core/targets/*.profile.json` (tier maps) | 52; 31+21 | MOVE. `targets/names.ts` (26) stays: `validate.ts:26` and the app's harness list use it |
| `packages/core/src/dev/write-golden.ts` | 171 | SPLIT: golden packages :60-92 to lab; pictures and pages stay |
| `packages/core/src/validate.ts` `exportOnlyRules` | :331-388 | stays in the file (plan, `template use` and the app read it; see 2) |
| `packages/cli/src/commands/export.ts` | 603 | MOVE (less `shellWord` :388) |
| `packages/cli/src/commands/help.ts` | :6-14, 33-35, 133-207 | SPLIT: `EXPORT_HELP`, the tier text, the "Compile" group |
| `packages/cli/src/index.ts` | :19, 165-202 | SPLIT: the `export` case |
| `packages/cli/src/mcp-author.ts` | :78, 169, 473-503, 971-1234 | SPLIT: `grooph_export`, `notAsGroophWroteThem`, `PLAN_NEXT` |
| `apps/web/src/ui/ExportPanel.tsx` `ThePackage` | :128-296 of 301 | SPLIT; `ThePlan` stays |
| `apps/web/src/doc/exportPackage.ts` | :13-53, 66 of 97 | SPLIT: `loadCompiler`, `attemptExport`, `packageFileName` |
| `apps/web/src/ui/PackageNeeds.tsx`; `doc/findings.ts:27-35`; `doc/issues.ts:16-33` | 33 | wording that points at a package |
| `apps/web/src/ui/Editor.tsx` | :6, 43, 311-333 | `loadCompiler`, `markExported` |
| `plugins/grooph/skills/grooph-design/SKILL.md` | 60; lines 9, 11, 33, steps 7-8, 46, 58 | the last step; keep the whole old skill as a copy in `lab/` |
| `plugins/grooph/README.md`, `.claude-plugin/plugin.json`, `/.claude-plugin/marketplace.json`, `plugins/grooph-chat/SKILL.md:10,38,41` | | descriptions that promise a placed package |
| `fixtures/golden/` | 33 files | STAY-LAB |
| `docs/targets/claude-code.md`, `codex.md`; decision 0030 | 118, 94 | STAY-LAB |
| Tests: core `compile` 713, `compile-schema` 89, `compile-target` 242, `codex` 123, `codex-mapping` 74, `codex-toml` 131, `targets` 99, `prototype-words` 88; cli `export-brakes` 731, `third-pass` 1,173, `codex-tiers` 47; web `test/export.test.ts` 135; e2e `roundtrip` 59, `codex-target` 22, `export-kept-ids` 21 | | MOVE |

### (b) Brakes as something a run obeys

| Path | Lines | |
|---|---|---|
| `packages/core/src/brakes.ts` | 1,164 | MOVE |
| `packages/core/src/adoption.ts` | 170 | MOVE |
| `packages/core/src/runs.ts` `adoptWorkingCopy` | :640-680 | SPLIT |
| `packages/core/src/subgrooph.ts` (572) | :15, 511-535, 552 | SPLIT by a seam: what a refresh holds |
| `packages/core/src/reach.ts` | 165 | stays: `placeSubgrooph` uses it :160 for a notice; brakes.ts imports it |
| `packages/cli/src/commands/adopt.ts`; `index.ts:357-365` | 185 | MOVE |
| `packages/cli/src/commands/export.ts` `brakesAtExport` | :214-340 | with (a) |
| `packages/cli/src/commands/sub.ts` | :33, 50-62, 176-246 | SPLIT: `--allow` and the held lists |
| `apps/web/src/ui/run/brakes.tsx` | 136 | MOVE |
| `apps/web/src/ui/run/RunChanges.tsx:73-82,138-181`; `RunProposals.tsx:39-50`; `doc/run.ts:51,129-154`; `store/runs.ts:35-37` | | Adopt, "Apply to a copy" |
| Tests: core `adoption` 1,188, `stops-as-fired` 797, `subgrooph` 1,193 (refresh part); cli `sub` 261 (update part), `runs` 865 (adopt part); e2e `adopt-brakes` 422 | | MOVE or split |
| decisions 0008, 0025 (refusal part); `docs/runs.md` §5 | | STAY-LAB |

### (c) Run folders and notes

| Path | Lines | |
|---|---|---|
| `packages/cli/src/run-io.ts` | 161 | MOVE (reads run folders) |
| `packages/cli/src/commands/runs.ts`; `index.ts:28,337-355` | 184 | MOVE |
| `packages/cli/src/commands/watch.ts` (311) | :12, 25-27, 57-69, 123-130, 155-158 | SPLIT: the run half; sessions and map stay |
| `packages/cli/src/commands/share.ts:34,98-103`; `embed.ts:18,140-143` | | the run-*folder* branch |
| `packages/core/src/runs.ts` (rest), `replay.ts`, `schema/run.ts`, `schema/grooph-run-0.schema.json` | 739, 158, 44, 62 | stays under my recommendation (reading a record) |
| `packages/core/src/events.ts` `nodesLive`, `overlayRun` | :402-440 | used only by the run screens (RunScreens.tsx:34, RunView.tsx:1) |
| `apps/web/src/ui/run/RunScreens.tsx` `LiveRun` | :41-99 of 120 | the screen "as it reads them" |
| `apps/web/src/ui/run/` rest (RunView 330, RunTimeline 167, RunChanges 191, RunProposals 133, StateIcon 23, run.css 128), `doc/run.ts` 170, `store/runs.ts` 74, `ui/embed/Replay.tsx` 114, `ui/landing/RunDemo.tsx` 80, `public/demo/run.txt` | | the viewer of a recorded run: see 3 |
| `fixtures/runs/` (23 files); `.grooph/slice-0007-sandwich/` at the repository root | | STAY-LAB |
| `docs/runs.md` | 117 | STAY-LAB |
| Tests: core `runs` 499, `replay` 94; cli `runs` 865; web `test/run.test.ts` 97; e2e `runs` 402, `screenshots-runs` 82 | | split by the line chosen in 3 |

### (d) Runners, ledgers, records, claims

| Path | Lines | |
|---|---|---|
| `scripts/prove-pattern.sh`, `prove-codex.mjs` (+test 184), `compare.sh`, `e2e-claude-code.sh` | 64, 497, 86, 630 | STAY-LAB, repointed |
| `scripts/lib/prove-*.mjs` (check 687, evidence 238, ledger 191, pattern 680, summary 53) | 1,849 | STAY-LAB |
| `scripts/lib/compare-*.mjs` (9 files) + 7 tests | 3,759 + 1,261 | STAY-LAB |
| `scripts/lib/brake-*.mjs` + 2 tests | 910 + 574 | STAY-LAB |
| `scripts/lib/study-three-paid.mjs` (+test 1,268), `profile-first-call-paid` 185, `resume-step-paid` 171, `roles-or-information-paid` 314, `fixtures/stand-in-harness.mjs` 102 | 733 | STAY-LAB |
| `experiments/patterns` (766 files), `comparisons` (821), `brakes` (11), `game` (34), `patterns-codex` (1), `audits` (352) | | STAY-LAB; `hooks` (64) and `watching` (354) are the watching side's |
| `docs/comparisons.md` 82, `docs/claims.md` 128, `docs/field-guide.md` 864 (generated), `docs/report/` 158, `docs/blog/` 215, `docs/plain-english/05,06,07,13,14`; decisions 0009, 0011, 0012, 0029 | | STAY-LAB; wording is step 7 |

`packages/cli/hooks/` (103 + 954) has nothing of the directing side (read: no reference to runs, notes or a package).

## 2. Every edge that crosses the line

### From what stays into what moves

| # | Stays | Reaches | Where | Smallest repair |
|---|---|---|---|---|
| 1 | CLI dispatcher | `export`, `adopt`, `runs` commands and help | index.ts:16,19,21,28; 165-202; 337-365; 558-584 | remove the cases; lab handles them first |
| 2 | `help.ts` | `getProfile`; "author, check and compile"; "Compile" group; `runs` listed under "Watch" | :6-14, 16, 33-35, 47, 60-63 | trim |
| 3 | `plan` | `shellWord` from `export.ts` | plan.ts:19, 250, 252; export.ts:388 | move `shellWord` to `reply.ts` |
| 4 | `plan` words | "`grooph export` writes its package" | cli plan.ts:43, 196; core plan.ts:141 | drop the sentence (changes PLAN.md's text) |
| 5 | `pick` | `next: grooph export` | pick.ts:82; also "grooph validate --for-export lists them" :62 | drop |
| 6 | `validate` | `next: grooph export` | validate.ts:70 | drop; :71 (`next: grooph validate --for-export`) is then the end of the chain that `apply.ts:89`, `explain.ts:128`, `template.ts:296` start |
| 7 | `template use` | "export refuses unfilled slots" | template.ts:80 | reword |
| 8 | `share` | run folder through `run-io`; "grooph runs bundle" | share.ts:34, 98-103, 155 | see 3 |
| 9 | `embed` | run folder through `run-io` | embed.ts:18, 140-143 | see 3 |
| 10 | `watch` | `run-io`, the run endpoint, opening on the newest run by default | watch.ts:12, 27, 69, 123-130, 155-158 | product `watch` serves sessions and map only |
| 11 | `sub update` | `brakesLost`, `roundsLeftToAPerson`, `saidOf` | core subgrooph.ts:15, 515, 524, 532, 552; sub.ts:213-231 | seam, see 3 |
| 12 | MCP authoring module | 14 names from `export.ts`; `keptFolder`, `tryCompile` | mcp-author.ts:78; :52, 64 | leaves with the tool |
| 13 | MCP `grooph_validate` | checks for export by default; "E_... blocks export" | mcp.ts:179-187, 201 | default false, reword |
| 14 | Authoring tools' closers | `grooph_export for the package`; "which adds the rules a package must pass"; "edit it and export the package"; `grooph_export` after a plan; `grooph_validate with forExport: true` | mcp-author.ts:164-165; 836; 962-963; 758; 438; 658 | reword |
| 15 | MCP server's opening | "before starting subagents, call grooph_plan" | mcp.ts:287; also :277 "no package is made of it"; `grooph_plan`'s own description "before you start them" :92 | an offer |
| 16 | `grooph mcp --help` | lists `grooph_export` and its brakes paragraph | index.ts:517, 531-538 | trim |
| 17 | Product write path | the kept-graph guard: "Only grooph export writes it" | io.ts:19-53; mcp-author.ts:346-347; help.ts:108-110; apply.ts:72 | keep the guard (it protects a lab baseline), reword |
| 18 | core barrel | compile, `getProfile`, adoption | core index.ts:20, 22, 26; base.ts:17, 23 (types) | drop |
| 19 | core `events.ts` (watching) | `RunSummary` type; a package's agent naming `<graph-id>--<node-id>` | :14; :402-423 | `nodesLive`/`overlayRun` go with the run screens |
| 20 | core `share.ts` | run bundle kind | :28, 32, 53, 89-98, 250-258 | stays (see 3) |
| 21 | App routes | `live-run`, `run` | App.tsx:76, 78, 106-109, 213, 215; screens.ts:14; test/doors.test.ts:38-39 | see 3 |
| 22 | App: open, import, library, db | `RunView`, `saveRun`, `runHref`, `listRuns`, `RunRecord` | OpenScreen.tsx:5, 21; Import.tsx:12-26, 70-82; Library.tsx:6, 13, 24, 52-63; store/db.ts:30-48 | stay with the viewer |
| 23 | Live screen and run screen import each other | `POLL_MS`; `parseLiveView`, `sessionsEndpoint` | live/LiveSessions.tsx:5; run/RunScreens.tsx:6 | move `POLL_MS` to the live side |
| 24 | App helpers | `download`, `copyText`, `zipPackage` live in `doc/exportPackage.ts` | Keep.tsx:4; Landing.tsx:3; LiveSessions.tsx:4; MapView.tsx:22; Compare.tsx:15; SaveTemplatePanel.tsx:4; TemplateView.tsx:4; ExportPanel.tsx:108 | split the file; keep the helpers |
| 25 | Editor, issues panel, viewer | `loadCompiler`, `PackageNeeds`, "grooph has no compiler for" | Editor.tsx:6, 43; IssuesPanel.tsx:6, 17; GraphViewer.tsx:11, 98; GraphInspector.tsx:68; doc/templates.ts:55 | remove or reword |
| 26 | App build | aliases and required chunks for the compiler and brakes | vite.config.ts:14, 25, 98, 105, 107-109, 131, 219, 223; tsconfig.json:18, 24 | the build throws without them: change both |
| 27 | Canvas and embed | run notes and states: `replaySteps`, `stateLabel`, `NodeRunState` | graph-views.tsx:32, 168; stage/model.ts:19, 159; ViewCanvas.tsx:5, 38-41; GraphNode.tsx:21; embed/Embed.tsx:1, 32-41, 107, 202; embed/decorate.ts:50 | stay with the viewer |
| 28 | Front page | plays a recorded run; says it compiles and exports | landing/RunDemo.tsx:63; Landing.tsx:98-99, 139, 161, 167, 261-263; index.html:9, 13, 21; public/llms.txt:3 | see 3 and 6 |
| 29 | Field guide generator (a site page with `--check`) | the proving checker and ledger | scripts/field-guide.mjs:44, 78 | leave; say so |
| 30 | Watching check's runner | the lab's runners | scripts/lib/watching-check-paid.mjs:49-54 | leave; say so |
| 31 | Pattern index and 20 pattern documents | `template.demo` points at `experiments/patterns/<id>/README.md` | scripts/patterns-index.mjs:52-53, 84 | leave (decision point 7 keeps the record) |
| 32 | Shipped documents | `packages/cli/README.md:19, 21` is the npm README (npm-package.mjs:67); `docs/agents.md:61, 75, 81` ships in the chat skill (chat-kit.mjs:67); `docs/quickstart.md:39, 41` | | must change in the PR that removes the command |

### From what moves into what stays

| Moves | Uses | Where |
|---|---|---|
| compilers | `validate(..., {forExport:true})`, `parseGraph`, issues, semantics, `indexGraph`, `canonicalize`, `OP_ARGS`, `contentsOf`, `listGroups`, `GROUP_FROM_PATTERN`, `KNOWN_TARGETS`, `hasProfile` | compile/index.ts:8-12, 79; units.ts:6-7; lead.ts:6-21; context.ts:7-10 |
| brakes, adoption | `reach.ts`, `semantics.ts` | brakes.ts:47-48; adoption.ts:18-19 |
| `adoptWorkingCopy` | `validate` for export | runs.ts:671 |
| `export.ts` | `io`, `place`, `print`, `reply`; `NOT_JUDGED` from `adopt.ts` | export.ts:6-10 |
| `adopt.ts` | `io`, `print`, `run-io`, `share-io`, `printChanges` from `runs.ts` | adopt.ts:6-10 |
| `export` words | "A plan can still be: grooph plan" | export.ts:412; mcp-author.ts:169 |
| run screen | `parseLiveView`, `sessionsEndpoint`, `ViewCanvas`, `LookMenu` | RunScreens.tsx:6; RunView.tsx:5, 7 |
| lead briefs | `grooph apply`, `grooph validate --for-export` | compile/*/lead.ts (above) |
| web tests | CLI sources | apps/web/test/run.test.ts:7; share.test.ts:19; e2e/embed.spec.ts:9; `io.ts:15-18` says it is compiled with the web tests |

### The loop rules in the validator

All rules are one flat list in `validate()` (validate.ts:38-67), one function and one code each; `forExport` is the only switch (:30-33, 50).

- **Loops and stops:** `cyclesWithoutStop` :277-291 (`E_CYCLE_NO_STOP`), `judgmentLoopsWithoutBar` :293-310, `stopsNotInspectable` :312-329, `longLoopsWithoutBudget` :642, `aspirationAsAcceptance` :666, `onlyMaxIterations` :695.
- **Other spec §12 hygiene, the same family:** `criticsNotIsolated` :399, `ownershipConflicts` :433, `irreversibleWithoutGate` :466, `homogeneousCritics` :536, `fanoutOnCoupled` :589.
- **Well-formedness:** `duplicateIds` :70, `danglingRefs` :89, `loopBackEdges` :166, `groupCycles` :220, `secondLead` :255, `personLead` :271, `unreachableNodes` :708, `noTerminal` :725, `outputsNotWritable` :748, `personFieldsNotRead` :765, `groupOverlaps` :781, `unknownKeys` :814, `docTooLarge` :828.

Inside the file they are **not entangled**: partitioning the list is mechanical. The entanglement is around it: codes "never change meaning" and `E_` means error (issues.ts:5-40, 51-89); `fixtures.test.ts:30` holds every invalid fixture to "its code, as an error for `E_`"; `FIXES` is keyed by every code (cli fixes.ts:15); `W_UNREACHABLE_NODE` cannot fire without `E_CYCLE_NO_STOP` or a dangling edge (fixtures/README.md); and callers turn any error into a refusal: `buildShareEnvelope` (share.ts:114-117), `pick` :61, `sub` (sub.ts:93-101; subgrooph.ts:536-549), the MCP share tool (mcp-author.ts:429-438), the community check (scripts/community-index.mjs:325, 348), patterns' sidecars (patterns.test.ts:93). The lab's compiler and `prove-check.mjs:180,440` need today's strict behavior. So "advice asked for by name" is an option on `validate` that the lab turns on, and it is **a slice of its own, not part of the move** *(inferred recommendation)*.

## 3. The open lines: options, smallest first

| Line | Options | Recommendation |
|---|---|---|
| `share` and `embed` carry a recorded run | (1) A recorded run stays a kind the product can show: the envelope kind, a `*.grooph-run.json` file, `#/open`, `#/embed` with its replay, `#/run/<key>`, import. Only the run-*folder* branch (share.ts:98-103, embed.ts:140-143) goes to the lab; `grooph-lab runs bundle` makes the file. (2) Leave the folder branch too. (3) Drop the kind: old links stop opening. | **(1).** Six lines of product code change. A record is viewable; a run folder is the lab's |
| The run screen | (1) Keep the viewer read-only: remove Adopt, "Apply to a copy" and the adopt command line (they need `brakes.ts`); keep `LiveRun` as a dormant reader that only `grooph-lab watch` feeds. (2) Also remove `#/run?live`; the lab then has no live view unless the app is built a second time in a lab mode and served through `GROOPH_WEB_DIST` (watch.ts:76-81). | **(1)**, said plainly as a narrow reading of the decision's list (c): the owner's line to draw |
| The front page plays one | (1) Leave `RunDemo` and `public/demo/run.txt`: a recording played by the embed, offering nothing. (2) Take it off now. | **(1)**; whether it stays is step 7 and his review of the site |
| `sub` stays, what its refresh refuses moves | (0) Leave: `brakes.ts` stays in the product, against the decision's list. (1) A seam: `refreshSubgrooph(..., { allow, holds })`, the pattern core already uses for kits (index.ts:41-55). The product passes none: every change is listed and applied, and a result with a new error is still not written (subgrooph.ts:536-549; sub.ts:93-101: that is the checker, not a brake). The lab passes `brakesLost`. `reach.ts` stays: `sub add` says when a placement leads around a person (subgrooph.ts:160-164) and never refuses. (2) Move `sub update` whole. | **(1)** |
| `plan` borrows from `export` | Move `shellWord` (one line) to `reply.ts`. Separately drop the `grooph export` sentence from PLAN.md (edge 4). Keep "To fix before a harness can run this" (core plan.ts:26, 184): it is A-020's plan, and its wording is step 7's. | as stated |
| The app's Export panel for a harness | (1) Park `ThePackage` and the compile half under `lab/web/`, type-checked, unit tests kept; its browser specs (`roundtrip`, `codex-target`, `export-kept-ids`, `adopt-brakes`, about 520 lines) kept as files and **not run**. (2) A lab build mode of the app that mounts them, with a second Playwright project. | **(1)**, saying outright that this is the one place "keeps its tests" is not fully met; (2) only if he wants it |

Also needed, though not in the bullet: keep `--for-export` on `validate` and `apply` in this slice (section 0).

## 4. What guards the moving parts, and what must change

| Guard | Where | In the lab slice |
|---|---|---|
| Build and tests | ci.yml:33-34 | unchanged; picks up `lab/` through the workspace. `pnpm-lock.yaml` gains an importer (CI installs with `--frozen-lockfile`) |
| Golden packages | ci.yml:37-51; core `compile.test.ts`, `codex.test.ts`, `composed.test.ts`; `apps/web/test/helpers.ts`; `scripts/lib/compare-prompt.test.mjs` | `pnpm exec grooph export` becomes `grooph-lab export`; files stay; bytes must not change |
| Validator from the command line | ci.yml:59-62 | unchanged |
| Patterns index `--check` | ci.yml:65-66; also deploy.yml:48 | unchanged |
| Field guide `--check` | ci.yml:69-70 | unchanged if `scripts/lib/prove-check.mjs` and `experiments/patterns` stay put |
| Rule reference `--check` | ci.yml:73-74 | unchanged (changes with the loop-rule slice) |
| CLI reference `--check` | ci.yml:77-78; scripts/cli-reference.mjs:38-70 | regenerate `docs/cli.md` in the PR that removes the commands; its intro says "compiles" (:58) |
| Site pages `--check` | ci.yml:92-95; scripts/site/pages.json | a page dropped from the list becomes a GitHub link (site-pages.mjs:130-139), but the front page's links must exist (:335-345): `claims`, `field-guide`, `quickstart`, `exports`, `subagents`, `operation-map` cannot be dropped. `runs`, `targets/claude-code`, `comparisons` can; `apps/web/e2e/site-pages.spec.ts:52` expects `runs` |
| Size budget | ci.yml:107-110; scripts/perf-budget.json | no line names the compiler or brakes chunk (they are "loaded later"); figures can only fall. `vite.config.ts:107-109` is the real guard: it throws |
| Runner tests | ci.yml:118-123, 127-128 | unchanged if scripts stay put |
| Quickstart's first run | ci.yml:131-132; scripts/first-run.sh:22, 27 | change with `docs/quickstart.md:39-41`, same PR |
| pack-check | ci.yml:136-137; scripts/pack-check.sh:72, 77-78, 93 (14 tools), 100 (11) | remove the export lines; 13 and 10; add a check that the bundle holds no lead brief |
| kit-check | ci.yml:141-146; scripts/kit-check.sh:41, 47-50, 85 (11) | drop `export` from the command list and from `plugins/grooph-chat/SKILL.md`; 10 |
| `packages/cli/package.json` | `files` :14-18, `bin` :8-10, `exports` :11-13 | add internal subpaths; description :5 says "export" |
| Version check | ci.yml:158-161; scripts/version.mjs:24-37 | unchanged if `lab/package.json` is not made a ninth place |
| American English | ci.yml:165-166; scripts/american-english.mjs:31-51 | `lab/` is not in `PUBLIC`: the compiler's words leave the check unless it is added |
| "A built-in template instantiates and exports"; "shape, share and pick" | ci.yml:180-189; 192-199 | last line of each becomes `grooph-lab export` |
| Web unit tests | deploy.yml:38; `test/plan.test.ts:131-144`, `doors.test.ts`, `piece.test.ts:9, 57-66`, `export.test.ts`, `run.test.ts` | change with the app PR |
| Browser tests | ci.yml:211-250 | `smoke` (20 mentions of export), `release` (25), `plan` (32), `validation` (14), `open`, `editing`, `authoring`, `offline`, `landing:514-522` all touch export or runs |
| Deploy | deploy.yml:51-56 | publishes `experiments/patterns` and `experiments/comparisons` to the site: remove for "not on the site" |
| Not guarded at all | | `make-repo.sh` (no CI); `compare-run.test.mjs`, `compare-prompt.test.mjs`, `compare-lead.test.mjs`, `compare-score.test.mjs`, `compare-projects.test.mjs` are **not run in CI** (ci.yml:120 lists six others); `prove-pattern.mjs` has no test |

## 5. Pull requests, in a safe order

Each ends green on `pnpm -r build && pnpm -r test` plus the named checks. Order is forced by imports: the CLI and the app must stop importing before core's files move.

| # | What | Touches | Check | What could go wrong |
|---|---|---|---|---|
| 1 | **The lab's command as a pass-through; runners repointed.** Additive: nothing is removed | new `lab/` (package, bin, README); `pnpm-workspace.yaml`; root `package.json`; lockfile; one constant each in prove-pattern.mjs:17, prove-codex.mjs:18, compare-run.mjs:72, brake-run.mjs:24, e2e-claude-code.sh:70; **`experiments/game/setup/make-repo.sh:62-71`** and the game README's code block; the lab's `test` script runs every `scripts/lib/*.test.mjs` | ci.yml:118-128 steps; `prove-pattern.sh <id> --dry-run`; `prove-codex.mjs` dry; `brake-run.mjs --check`; `compare-arms-ef.mjs --check`; `make-repo.sh --out <tmp>` gives the same tree before and after | **touches the game's setup** (once, while both commands give the same bytes). The five untested-in-CI runner tests may already be red *(inferred)*. A workspace change may count as "packages" under decision 0023 |
| 2 | **CLI: `export`, `adopt`, `runs`, `watch <run>` leave the product** | edges 1-10, 17, 32; cli tests split (mixed files copied whole to the lab, trimmed in the product); ci.yml:37-51, 180-199; first-run.sh; pack-check.sh:72-78; `docs/cli.md`, `docs/quickstart.md`, `packages/cli/README.md` | golden step through `grooph-lab`; cli-reference, pack-check, first-run | his installed `grooph` is a link into the clone (install-local.sh:43): `grooph export` vanishes from his shell on the next build. Quickstart is a site page: his word |
| 3 | **MCP: `grooph_export` leaves; validate's default, the closers, the opening instruction** | edges 12-16; pack-check.sh:93, 100; kit-check.sh:47-50, 85; `plugins/grooph-chat/SKILL.md`; `docs/agents.md` (held by `agents-page.test.ts`); mcp tests | pack-check, kit-check, cli tests | changes what a model reads: exactly the contract's subject, read it word by word. Tool counts are hard-coded in three scripts |
| 4 | **App: the package half, Adopt and "Apply to a copy" leave** | edges 21-27; vite.config.ts; tsconfig.json; web tests; browser specs; perf-budget.json may be lowered | `pnpm --filter @grooph/web test`, `test:e2e`, perf-budget, check-outside-addresses | the largest and riskiest; the build throws if a chunk it expects is gone; the service worker specs (`release.spec.ts`) use export; a stored run on a person's device must still open |
| 5 | **Core: files move to `lab/`; the refresh seam** | (a) and (b) core rows; core index.ts:20-26; write-golden.ts; core tests; `packages/core/package.json` exports of the profiles; `make-repo.sh` already reads `packages lab` since PR 1 | golden packages byte for byte; `subgrooph.test.ts` in both places; `make-repo.sh` again | **touches what the game compiles with.** An accidental change to a brief's bytes breaks the goldens and the frozen manifest. `sub update` changes behavior in the product |
| 6 | **Site, skill, labels** | pages.json; deploy.yml:51-56; `plugins/grooph` skill and manifests; a line at the head of each lab document; `fixtures/README.md`, `experiments/README.md`; AGENTS.md (it says it is rewritten "when the lab is made", :5) | site-pages `--check`; `e2e/site-pages.spec.ts` | visible on the site: his word. Front-page sentences that promise export (Landing.tsx:98-99, 139, 161, 167) are false from PR 4 on unless they change here or there |

PRs 2 and 3 could be one; PR 4 could split into "package half" and "adoption". **Game exposure:** PR 1 (script), PR 2 (only if PR 1 did not repoint it), PR 5 (compiler location). `start-claude.sh`, `record.sh`, `score.mjs`, `loaded.mjs` call nothing that moves (read: no CLI call in them). Before PR 1, run `make-repo.sh` once on `main` for a baseline: PROGRESS says its readiness "must be checked again first", and `packages/` changed after the freeze (last 2026-10-07), so it may already differ from the manifest *(inferred)*.

## 6. Surprises

1. **The site publishes the records.** deploy.yml:51-56 copies `experiments/patterns` and `experiments/comparisons` to `/grooph/experiments/`. Not in the decision's lists.
2. **The repository itself holds a placed package**: `.grooph/slice-0007-sandwich/` (LEAD.md, KICKOFF.md, MAPPING.md, a run), `.claude/agents/slice-0007-sandwich--builder.md` and `--critic.md`, `.claude/skills/slice-0007-sandwich/SKILL.md`. Every Claude Code session opened here, lanes included, is offered those agents and that skill.
3. **The watching check stands on the lab.** `watching-check-paid.mjs:49-54` imports six comparison and study-three modules; the new product's one tested claim rests on code the decision sends away.
4. **The field guide's generator runs the proving checker** (field-guide.mjs:44) and reads the proving ledger (:78). A site page's CI check depends on lab code and records.
5. **Five comparison-runner tests are not run in CI**, and `prove-pattern.mjs` has none. The runners he wants to use later are the least guarded code here.
6. **The plan carries the package's vocabulary**: `plan`, `template use` (template.ts:295) and the app's findings (findings.ts:18, 34) all call `validate` for export; the app shows a "For a package" block in the issues panel and the link viewer. The decision lists `plan` as staying whole.
7. **The product's write path knows the package**: the kept-graph guard (io.ts:19-53) refuses a file path for a reason that is the lab's.
8. **`doc/exportPackage.ts` is also the app's download and clipboard helper** for seven staying screens.
9. **`make-repo.sh` defines "the compiler" as the folder `packages/`** (:62-64), and the lead's briefs name product commands, so a rename of either the folder or the flag reaches the frozen game.
10. **`grooph watch` with no argument opens on the newest run** (watch.ts:27, 123-130); the product's default changes.
11. **`runs` is under "Watch" in the help** (help.ts:47), not "Compile": the decision's "the two commands the CLI lists under Compile" undercounts.
12. **Front-page and machine-read words promise compiling**: Landing.tsx, index.html:9-21, `public/llms.txt:3`, the npm README, the chat skill. The decision defers the site to step 7, but its step 4 says "the package and the site stop offering them": the two meet in PRs 2 to 4.
13. **Community submissions are held to the package rules** (community-index.mjs:325, 348).

### Critical Files for Implementation
- packages/cli/src/index.ts
- packages/cli/src/mcp-author.ts
- packages/core/src/index.ts
- apps/web/vite.config.ts
- experiments/game/setup/make-repo.sh
