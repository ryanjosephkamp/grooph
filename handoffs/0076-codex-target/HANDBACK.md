# Handback 0076 · The Codex compile target

**Implementer:** GPT-6.1 Sol, with three GPT-6 Luna workers · **Branch:** `slice/0076-codex-target` · **Head commit:** `03018a515ac7c5d5cb9f226c2627850a851dcba4` (verified implementation; this handback follows in a documentation-only commit) · **Date:** 2026-10-04

## Status

`blocked` — The compiler, CLI, app, golden packages and local checks are complete, but success criterion 5 is unmet because permission for the authenticated Codex proving invocation and its runtime transcript receipt was requested and has not been received.

## What changed

- **Core:** new `packages/core/targets/codex.profile.json` and `packages/core/src/compile/codex/`; target registration and compile dispatch; new Codex contract tests, plus an unknown-harness test that still verifies `E_NO_TARGET`.
- **Package fixtures / CI:** new byte-checked Codex golden packages for `review-loop` and `fix-until-green`; the existing golden step checks both harnesses. Claude Code compiler source and golden bytes are unchanged.
- **CLI:** target-aware export guidance, the export help example, generated export text in `docs/cli.md`, and Codex export tests.
- **App:** profile-driven harness choice, Codex export selection and guidance in the three allowed app files, with unit and browser coverage. No landing page, app entry point, styles or Vite configuration changed.
- **Mapping / proving:** new `docs/targets/codex.md`, `scripts/prove-codex.mjs`, six focused runner tests, and `experiments/patterns-codex/review-gate/README.md`. The experiment page explicitly records preparation without a model invocation; it is not a successful or failed native proving result.

## Verified, and how

| Handoff criterion | Command / inspection and observed result |
|---|---|
| 1. Native mapping | Read current official OpenAI sources and local `codex --version`, `--help`, `exec --help`, and `exec resume --help`. CLI version is `0.160.0`. Every mapping unit is marked `[doc]`, `[seen]` or `[unknown]` with its source; native runtime claims remain unknown. The Luna mapping worker also independently read the compiler and found the lead startup's web setting omission, which was fixed and covered. |
| 2. Profile / compiler / validator | `pnpm -r build && pnpm -r test` passed: core 358, CLI 120, app 60. Tests cover registration, Codex graph export, unknown-target failure, pure/deterministic output, pins and independent effort, skills, scope settings, safely escaped TOML, lead identity, gates, stops, isolation and adaptation. `python3` with `tomllib` parsed all three golden agent files and checked their required fields; this proves TOML grammar, not native configuration acceptance. |
| 3. Golden packages | CLI export plus `diff -r` for both fixtures and both targets passed. The same comparisons run in CI. New Codex golden files match the final compiler; `git diff` over the Claude Code compiler and goldens is empty. |
| 4. CLI / app | CLI/app unit tests passed. `GROOPH_E2E_PORT=4363 pnpm --filter @grooph/web test:e2e`: 193 passed, 107 configured skips. `GROOPH_BROWSERS=1 GROOPH_E2E_PORT=4363 pnpm --filter @grooph/web test:e2e --project=safari --project=firefox`: 37 passed, one configured skip. Missing pinned WebKit/Firefox binaries initially prevented launch; installing those browser binaries resolved it. These are desktop browser checks, not physical-phone evidence. |
| 5. Native proving run | **Unmet.** `node --check scripts/prove-codex.mjs`, `node --test scripts/prove-codex.test.mjs` (6/6), and `node scripts/prove-codex.mjs --dry-run` passed. The dry run instantiated, validated and exported the existing task; no model was called. No actual session id, usage, USD report, grooph run id, gate result or runtime transcript receipt exists. |
| 6. Still green | `pnpm install --frozen-lockfile`, full build/unit tests, the browser commands above, and every executable repository check in `ci.yml` passed locally. Details below. Local runtime: Node `v26.10.0`, pnpm `11.7.0`; CI's Node 22/24 and Linux browser jobs must also pass on the PR. |

The CI checks exercised locally were:

- All four target/fixture export comparisons; new/apply reconstruction with byte comparison; valid and expected-invalid CLI validation; built-in template listing, instantiation, validation and export; shape/share/pick/export.
- `patterns-index.mjs --check`, `field-guide.mjs --check`, `rule-reference.mjs --check`, `cli-reference.mjs --check`, `community-index.mjs --check`. The field guide is current; its 18 passed / two failed proving records are historical input, not new model runs.
- Site renderer tests (32) and `site-pages.mjs --check`; outside-address tests (16) and `check-outside-addresses.mjs --check`.
- Version and picture tests (13 combined), both generated checks, `check-brake-values.mjs`, `first-run.sh`, and `test-install-local.sh`.
- `perf-budget.mjs --check`: first load 172.6/180 KB gzip, scripts 154.2/162, styles 17.4/20, canvas 270.2/276, embed 125.3/132; final CLI cold-start measurement 96/400 ms. The compiler is loaded later, 28.7 KB gzip. These are local measurements against the existing budgets.
- `american-english.mjs --check`: no British spellings in 531 public-facing files. `git diff --cached --check` passed before the implementation commit.

The browser checks preceded the final clarification that an unavailable fresh-context control must halt before dispatch. Final build, unit/golden checks, TOML grammar and runner dry run covered that output change; PR CI exercises the final browser bundle.

## Decisions made

1. **Custody:** performed edits and commits in `/Users/noir/Documents/grooph-codex`, as `handoffs/README.md` requires. Its existing slice branch was clean at `d50ab78`; it was fast-forwarded to the app's `7003d9a` baseline before edits. The detached app worktree and the driver's checkout were left untouched. No history was reset or rewritten.
2. **Workers:** GPT-6 Luna handled native mapping research and independent compiler review, the CLI/app target controls and tests, and the proving runner/tests. Sol kept compiler semantics, integration, verification and delivery. Workers changed only their assigned paths and made no model proving invocation.
3. **Native files:** non-lead agents become `.codex/agents/<graph-id>--<node-id>.toml`; the lead remains the main session. The package names `LEAD.md` from its kickoff and does not overwrite root `AGENTS.md`, shared Codex config, hooks, trust or installed skills. Compilation remains pure; only the external proving script invokes a harness.
4. **Models / effort:** profile `frontier` and `strong` resolve to GPT-6.1 Sol; `fast` resolves to GPT-6 Luna. The mapping reports the collapsed tier pair. Harness-specific pins override export tier overrides. Effort is emitted independently and unchanged, including `max`; compatibility is account/client dependent, and an unavailable selection must halt rather than silently substitute.
5. **Scopes:** workers without an allowed write capability request `read-only`; `edit-files` or `write-outputs`, when allowed and not denied, requests `workspace-write`. `approval_policy = "never"` makes blocked actions halt rather than escalate; explicit `web` requests live search, otherwise disabled. Parent live overrides can supersede custom settings. Exact outputs, ownership, evidence, command scope and delegation are prompt duties; there is no claimed native per-file allowlist. Non-mutating shell reads can implement `read-files`; this does not grant general command execution.
6. **Run control:** the lead brief retains the existing eleven-section contract, round/stop evaluation, run-local adaptation and append-only notes. Gates write a halt note first and return control. A real human answer resumes the same grooph run id; a session id is separate. Missing custom roles, required skills, fresh-context control, or confirmed adaptive agent loading halt without the lead doing the worker's job or grading its own work.
7. **Proving receipt:** the runner defaults to a no-model dry run. Explicit `--run` opens a ledger before launching, streams output, retains failed evidence, records version/source commit/task base separately, and refuses an existing evidence destination. It requests Sol/high plus two Luna worker slots, workspace-write, no approval escalation and no web. Exact reported tokens are retained; USD stays unknown. It never opens Codex home transcripts; their receipt is a separate owner-authorized step.

## Deviations

- The handoff's native proving criterion has not been completed. Its explicit boundary says, “Nothing under `~/.codex` without the owner's yes.” A normal authenticated `codex exec` writes runtime/session state there, and decision 0015 requires the actual transcript's path and checksum. I requested permission for this one run and only its transcript while continuing all independent implementation and checks. No answer was received, so there was no model invocation or fabricated run record. No alternate authentication, relocated Codex home or trust bypass was substituted.
- Interpreted “`export.ts` and its help and tests” to include only the export stanza in `packages/cli/src/commands/help.ts` and its generated export/overview text in `docs/cli.md`. The CLI reference generator's CI check requires those updates. No other help command changed.
- No contract amendment was needed or made. No protected source, pattern, prior proving record, `docs/PROGRESS.md` or `docs/PLAN.md` changed.

## Risks and leftovers

**Blocking next step:** obtain the owner's yes for the one authenticated `codex exec` proving invocation and only that invocation's runtime transcript path/checksum; run `node scripts/prove-codex.mjs --run`, retain the actual outcome even if it fails, collect the authorized receipt, and replace the preparation page with the actual record. Session id, reported usage/cost and ending are currently unavailable. A dry run and synthetic checker tests are not native agent evidence.

The mapping table covers custom definitions, model/effort, sandbox/approval, capabilities, skills, parallelism, fresh/shared dispatch, loops/stops, gates/resume, checks, evidence, progress, kickoff, hooks and adaptive changes. `[seen]` is limited to CLI help and the specifically cited earlier repository observations. Custom-type dispatch, CLI context exclusion, live TOML reload, installed skills, gate halt/resume and effective child settings need live evidence. The package halts if it cannot honor them. The bounded runner checker establishes consistency of retained evidence; it does not prove every adaptive brake, per-file ownership or evidence secrecy.

Compared with the Claude Code package, Codex lacks an emitted native tool allowlist / `disallowedTools` list and a Claude-style skill preload field; exact scope and skill selection remain explicit instructions. There is no documented Codex CLI dollar-cap flag. The Codex profile's frontier/strong tiers also collapse onto one model. Conversely, Codex documents per-custom-agent sandbox configuration and independent reasoning effort, and exposes a JSONL exec stream with session id and token usage suitable for the runner's live receipt. Those are documented mechanisms, not a quality, safety, cost or speed comparison. Claude Code's native approval modes, dollar cap and tool settings are not silently translated into nonexistent Codex fields. Both packages still depend on the lead obeying graph routing, gates, ownership and stops.

**Second template:** `fix-until-green` is compiled and byte-checked, not natively proven. Wire its existing task/acceptance data into a separate Codex runner mode and fresh destination, authorize its invocation/receipt, and verify check-node execution, fail/back-edge behavior, stop order and the final stop. Neither that future run nor the first `review-gate` run would prove gate resume without an explicit later human decision.

The new lead generator deliberately mirrors Claude Code semantics in a separate target directory to preserve the forbidden Claude output. Future semantic changes must keep the two lead contracts aligned. CI must be green before any reconciliation decision. This lane does not merge.

## Prompt to paste into the driver session

```text
Handback for slice 0076 is at handoffs/0076-codex-target/HANDBACK.md on branch slice/0076-codex-target (implementation 03018a515ac7c5d5cb9f226c2627850a851dcba4; the branch also contains its handback commit). Status: blocked on success criterion 5. Please reconcile with the grooph-reconcile skill. Compiler, target controls, both Codex goldens and local checks pass; Claude Code output and protected files are unchanged. Native proving was not invoked because the handoff requires the owner's yes for ~/.codex runtime state and the actual run's transcript receipt, and that permission was not received. Keep the PR draft until the authorized run and its real outcome/receipt are recorded. Do not treat the preparation page or synthetic checker tests as native evidence.
```
