# Handback 0076 · The Codex compile target — review fix pass

**Implementer:** GPT-6.1 Sol with three GPT-6 Luna workers · **Branch:** `slice/0076-codex-target` · **Head commit:** `be9f55b41312fb03504761e64aabe713a53e11c0` (pushed implementation; this handback follows in a documentation-only commit) · **Date:** 2026-10-04

## Status

`blocked` — The five review fixes are complete; original handoff criterion 5 remains intentionally deferred because the owner explicitly required no model session in this pass, with fresh driver review before proving.

Draft PR [#70](https://github.com/ryanjosephkamp/grooph/pull/70) remains draft and unmerged. No external Codex model session or native transcript access occurred. The exact next invocation and its external footprint are in [PROVING-COMMAND.md](PROVING-COMMAND.md).

## What changed

- **Core / profile:** `compile/index.ts` checks the graph schema before semantic validation for either target. The Codex TOML writer escapes DEL and replaces unpaired UTF-16 surrogates with U+FFFD while preserving valid pairs. It emits no approval key. The profile maps `frontier` to Sol and `strong`/`fast` to Luna; the suggested startup command uses the lead's resolved model, quotes its kickoff path, and sets the worker default for that invocation. `MAPPING.md` computes collapse wording and states that CLI help was read, with no package run claimed.
- **Tests:** new `codex-mapping.test.ts`, `codex-toml.test.ts`, `compile-schema.test.ts` and CLI `codex-tiers.test.ts`. Existing approval assertions now require absence. Existing Claude writer tests retain their internal defensive quoting coverage while expecting public `compile()` to reject invalid documents. ID coverage includes graph, nodes, edges, loops, policies and groups for both targets.
- **Generated packages:** regenerated only the two Codex packages through the built CLI. Changed files are their three agent TOMLs and two `MAPPING.md` files. Codex `LEAD.md`, `KICKOFF.md` and canonical graph files retain their reviewed bytes. Changes concern approvals, model mapping/startup and help-inspection provenance; kickoff-path quoting is in the startup command already changed for those requirements.
- **CLI / main sync:** reused main's slice 0084 tier-note helper for Codex, including target defaults, overrides and exclusions for unused or pinned tiers. No separate Codex note algorithm remains. Main's default-tier, irreversible-path and group/schema changes were imported through merge commits, not reimplemented by this lane.
- **Mapping / proving preparation:** updated `docs/targets/codex.md`, the proving preparation page and runner. The runner inherits approvals, exports the committed profile defaults without `GROOPH_MODELS`, and passes its temporary `GROOPH_HOME` to the child process. New `PROVING-COMMAND.md` records the proposed one-run command and native-home/transcript boundary.

## Verified, and how

### The five numbered review items

The baseline was the reviewed `1f6fdbb` implementation merged with main at `e8e1971` (merge `eae6813`). The new tests were exercised against the old behavior before fixes. The subsequent main sync was pinned to `5e97cc0` (merge `ff23613`); it includes the driver's later default-tier and document/schema changes.

| Review item | Observed old behavior / regression | Fixed evidence |
|---|---|---|
| 1. Inherit approvals | Existing Codex settings assertions changed to require no key failed twice; the runner command test failed on its approval override. The new mapping approval/refusal test failed too. | Agent files and suggested/actual lead argv contain no approval override. Mapping/docs explain owner policy, unattended refusal and instruction-based gates. Codex contract/mapping tests and all six runner tests pass. |
| 2. Sol leads, Luna works | The five mapping tests failed on the old profile/wording/startup behavior. The new CLI default-collapse test failed because no note was printed without an override. | Mapping tests cover defaults, changed tier pairs, distinct overrides, lead resolution and omitted node models. CLI tests cover stock Luna collapse, overrides and unused/pinned tiers. All pass. |
| 3. Valid TOML | Three schema- and validator-accepted probes failed Python `tomllib`: DEL was an illegal literal character; lone high/low surrogate escapes were not Unicode scalars. | Real Python `tomllib` parses every emitted agent file over eight fields × eight control/Unicode cases, with literal decoded-value expectations, plus overrides. Restricted skills/pins have explicit schema-rejection and accepted-name coverage. All pass. |
| 4. IDs and quoted path | Both target schema regression tests failed with “Missing expected exception.” Mapping path quoting also failed. | Public `compile()` and `tryCompile()` reject malformed/missing/non-string IDs with `E_SCHEMA` for both targets. Valid output goldens still pass, and the Codex startup path is shell-quoted. |
| 5. What was done | The new help-inspection wording test failed against “profile verified against CLI.” | Generated mapping says CLI `0.160.0` help was read and the package has not been run in Codex; the regression passes. |

The combined baseline schema/mapping run had nine tests: two passed, seven failed (both schema rejection tests and all five mapping tests). The independent Luna integration review of the final fixes found no actionable missed requirement; it is code review, not the driver's fresh acceptance review or native proving evidence.

### Original handoff criteria

| Criterion | Evidence |
|---|---|
| 1. Mapping | `docs/targets/codex.md` marks every unit documented, seen or unknown with primary sources. “Seen” covers the original CLI help/version inspection and cited prior repository observations; runtime loading, dispatch, isolation, skills, live reload and gate/resume remain unknown. |
| 2. Core/compiler | `pnpm -r build` and `pnpm --workspace-concurrency=1 -r test` pass on the synced tree: core 397, CLI 123, web 66. Package-level execution was serialized to reduce local timing contention. |
| 3. Goldens | Core golden tests pass for both fixtures and both targets. Claude compiler source and goldens match synced main `5e97cc0` byte for byte. Neither fix commit edits them. Main's 0084 golden/model changes arrived only in its separate sync merge. Codex changes are limited to the five files described above. |
| 4. CLI/app | CLI and web unit tests pass. `GROOPH_E2E_PORT=4363 pnpm --filter @grooph/web test:e2e --workers=2`: 210 passed, 125 configured skips. `GROOPH_BROWSERS=1 GROOPH_E2E_PORT=4363 pnpm --filter @grooph/web test:e2e --project=safari --project=firefox --workers=1`: 44 passed. Both Linux browser CI jobs pass. These are desktop browser tests, not physical-device evidence. |
| 5. Proving | **Unmet by direction.** Runner tests 6/6 and `--dry-run` pass. The fixed defaults export two Luna agent files; preview argv names Sol/high and no approval override. No native session id, usage, USD result, run id, gate ending or transcript receipt exists. No `run/` proving record was created. |
| 6. Checks | Generated pattern, field-guide, rule, CLI, community, site, version and picture checks, brake-value check and American-English check pass after sync (593 public-facing files). All 76 script/runner tests, outside-address check, first-run quickstart and local-install harness pass. All CLI CI recipes pass after sync: four export/diff comparisons, new/apply, validator fixtures, built-in template export, shape/share/pick. All eight push/PR CI jobs pass on implementation `be9f55b`: Node 22/24 build/tests/checks, Chromium and Safari/Firefox. |

Final performance check passed: first load 179.14/180 KB gzip, scripts 157.72/162, styles 19.91/20, front-page fonts 40.69/42, total front-page visit 221.15/224, canvas 277.04/280, embed 127.05/132, CLI startup 109.97/400 ms. The compiler is loaded later at 29.16 KB gzip. Local runtime is Node 26.10.0 and pnpm 11.7.0; Linux Node 22/24 are covered by PR CI.

Before the final rerun, a concurrent local batch exceeded the CLI cold-start budget, one existing hook-race timing assertion (19.7 seconds against 15), and Firefox cache/smoke timeouts with invalid-content-encoding/framebuffer errors. No unrelated test, hook, browser configuration or budget was weakened. Serial unit execution, an idle performance check and lower-concurrency browser reruns subsequently passed. CI's configured concurrency also passes.

## Decisions made

1. **Model defaults:** chose the requested profile map: frontier Sol, strong and fast Luna. No-model worker TOML still omits `model`, preserving the graph's inheritance contract; the suggested kickoff supplies invocation-scoped `agents.default_subagent_model` from `defaultTier`. An explicit lead with no model keeps the native session default. A graph without a lead node starts with the profile's frontier model. Pins and explicit node tiers still win.
2. **Approvals and stops:** removed approval settings entirely rather than selecting another policy. Owner settings apply. A refused command is a failure returned to the model; the brief instructs it to report and stop when necessary. Graph gates and stops remain lead duties, without a native-halt claim.
3. **String handling:** used an ES2022-compatible surrogate walk instead of requiring a newer runtime string API. TOML requires scalar Unicode and an escaped DEL; tests check actual parsing and literal decoded output, not an implementation-shaped serializer mirror.
4. **Schema boundary:** centralized full schema validation in public `compile()`, before path construction for either exporter. Existing private writer defenses remain unchanged and tested; valid package bytes remain the golden contract.
5. **Custody / sync:** edited, built, committed and pushed only from `/Users/noir/Documents/grooph-codex`. The app worktree and driver checkout were untouched. Initial merge `eae6813` brought in main `e8e1971`; separate merge `ff23613` synchronized main `5e97cc0`. Its export conflict was resolved to the driver's shared helper. No history was rewritten.
6. **Proving permission:** the proposed command uses ordinary installed Codex authentication/configuration and normal native session state. It changes no saved approval, trust or hook setting. Its runner never opens native transcripts; only the later, separately authorized invocation-specific path/checksum receipt would do that. External reads/writes are listed in the command artifact.

## Deviations

- Original criterion 5 remains deferred exactly as the owner directed for this pass. The fix pass is not native proving and does not turn unknown runtime behavior into seen evidence.
- The sync merge imports the driver's changed Claude profile/goldens from 0084. The lane's fixes preserve those synced bytes, and the final PR has no Claude compiler/golden difference from that main baseline.
- No spec amendment, dependency change, direct edit of `docs/PROGRESS.md` or `docs/PLAN.md`, model proving invocation, native transcript read, or merge of PR #70 occurred.

## Risks and leftovers

A fresh driver reviewer must re-run review items 1–5 on the pushed head. Then the owner may approve or decline the one proving invocation and its native transcript receipt described in [PROVING-COMMAND.md](PROVING-COMMAND.md). Keep PR #70 draft until the actual proving outcome is recorded; failure is a result to retain. Publishing the target/app choice remains the owner's merge decision.

Custom-agent loading/dispatch, fresh-history exclusion in CLI, skill loading, effective native settings, live agent edits and reliable gate halt/resume remain unobserved. A normal model request spends usage; USD is unknown, not zero. The checker verifies retained evidence consistency and cannot prove every scope, ownership, context or adaptive-brake property.

Compared with Claude Code output, Codex has no emitted native tool allowlist/disallowed-tools list or skill preload, and no documented CLI dollar-cap flag. It does document per-custom-agent sandbox configuration and independent reasoning effort, and a JSONL exec stream with session id/usage. These are mechanism descriptions, not quality, cost, speed or safety claims.

The review's lower-priority overwrite and cross-graph name-collision cases remain outside this fix pass. A second template, `fix-until-green`, is compiled and golden-checked; native proof would need its own task mode, fresh destination and owner authorization, with check-node/back-edge/final-stop evidence. The first review-gate run would not prove gate resume without a later explicit human answer.

## Prompt to paste into the driver session

```text
The 0076 fix-pass handback is at handoffs/0076-codex-target/HANDBACK.md on slice/0076-codex-target (implementation be9f55b41312fb03504761e64aabe713a53e11c0, followed by its handback commit), draft PR #70. Main is synced through 5e97cc0. All five numbered review fixes have regression tests. Please use grooph-reconcile, then have a fresh reviewer re-run items 1–5 on the pushed head. Native proving was explicitly not invoked in this pass. Keep the PR draft and do not merge. The proposed exact review-gate command, external state access and separate transcript receipt are in handoffs/0076-codex-target/PROVING-COMMAND.md; the owner must decide before that run starts.
```
