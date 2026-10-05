# Review 0076 · The Codex compile target

**Reviewer:** driver (the session "grooph opus operator", Opus 5.5), with a fresh Opus 5.5 subagent that read the code before the handback · **Date:** 2026-10-04 · **Reviewed:** draft pull request #70, `slice/0076-codex-target` at `1f6fdbb` · **Verdict:** **fix pass**, then the proving run, then the owner's merge

Codex built the target in one sitting and was honest about what it had not done: the pull request is a draft because no model has run a Codex package, and nothing in it presents a run that did not happen. The work is close. What follows is what a second harness's read found.

## What held

Run by the reviewer on a build of `1f6fdbb`:

- **No injection.** 38 fields of a document against 26 hostile values, through `validate` then `export` and through the writer with the schema skipped, and 14 hostile tier-map values: no key was added, changed or duplicated in any agent file. Sandbox, approvals, web and model never moved; no table or MCP entry appeared.
- **Paths.** An export writes `.grooph/<id>/` (the graph, `LEAD.md`, `MAPPING.md`, `KICKOFF.md`) and `.codex/agents/<id>--<node>.toml`, and nothing else. An existing `.codex/config.toml`, `AGENTS.md` and another agent's file were untouched. No hooks.
- **Nothing else moved.** The Claude Code compiler and both of its golden packages are byte for byte `main`'s. Core 358, CLI 120, web 60 pass. The Export panel costs 0.08 KB on the app's first load; the compiler piece fetched on export doubles, 14.9 to 28.7 KB.
- **It merges.** No conflict with `main` at `89fc884`; the merged tree passes its tests, the golden comparisons and the budget (178.22 of 180; 276.10 of 280).
- **The brakes' words** match the Claude Code package's, and the package says where Codex is natively weaker: no per-node tool list, no skill preload, no control over spawning, no dollar cap.

## What must change before it merges

1. **The package turns approvals off and calls it a halt.** `packages/core/src/compile/codex/agents.ts` writes `approval_policy = "never"` into every agent file, and `mapping.ts` suggests it for the lead and says "a blocked action halts rather than escalating". In Codex, `never` means nobody is asked: a blocked command fails back to the model, which goes on. No halt is native, and none was observed. grooph's rule is that a package never loosens a brake, and the Claude Code package writes no permission setting at all. **Do not write the key.** The owner's own policy then applies. Say in `MAPPING.md` and `docs/targets/codex.md` what that means for an unattended run, and that a graph's gates are instructions the lead follows, as the page already says of stops.
2. **Workers are Sol by default.** The profile gives `frontier` and `strong` both `gpt-6.1-sol` and `fast` `gpt-6-luna`, so both golden workers are Sol. The owner's rule for Codex is Sol leads and Luna works. Make the profile `frontier` Sol, `strong` Luna, `fast` Luna, or give the lead its own default: your choice, said in the handback. Then:
   - the sentence in `MAPPING.md` that says which tiers are which model is computed, not written by hand (with `--models strong=gpt-6-luna` it was wrong);
   - the suggested lead command names the lead's model, not `strong`'s, when there is no lead node;
   - the export prints the same note the Claude Code target now prints when two tiers a graph uses are one model (see `packages/cli/src/commands/export.ts` on `main` after slice 0084 merges; until then, on its branch).
3. **A valid document can write an agent file that is not TOML.** A node name with U+007F, or a lone surrogate, in a name, a brief, a description, a custom role, inputs, outputs, `owns` or evidence: `validate` passes, `export` exits 0, and Python's `tomllib` refuses the file ("Illegal character"). No setting changes; the agent would not load. In the TOML string writer: make the value well formed and escape U+007F with the other control characters. A test over the same fields.
4. **Ids are guarded by the schema alone.** `compile()` does not run the schema, and with it skipped a node id `x/../../config` resolves to `.codex/config.toml`, a graph id `../../../escape` leaves the project, and a graph id with a quote lands unquoted in `MAPPING.md`'s shell line. No caller in this repository skips the schema, and the Claude Code target has the same path fault on `main`. Fix it once, in core, for both targets: `compile()` refuses a document whose ids are not ids (run the schema, or check ids and the graph's id where paths are built), and the kickoff's path is quoted. A test for each target.
5. **"Verified" without a run.** `mapping.ts` writes "Codex profile verified against CLI `0.160.0`" into every package. Only `--help` was read. Say what was done: "read from the CLI's help at `0.160.0`; not yet run".

Lower, and the same in the Claude Code target, so not this slice's: a second export replaces hand-edited agent files and `LEAD.md` without asking (the agents lane's export tool now refuses that; the CLI does not); graph `a--b` with node `c` and graph `a` with node `b--c` share one file name.

## Then the proving run

The handoff's fifth criterion is one template run from a Codex package, recorded. That needs the owner's word to Codex, because it starts a model session and reads its transcript under Codex's own folder. It comes after the fix pass, on the fixed package, with `review-gate`.

## What the driver will do

Merge `main` into the branch is the author's. When the fix pass is pushed, a fresh reviewer re-runs items 1 to 5 on the new head. When the proving run is recorded, the pull request leaves draft and goes to the owner: it adds a target, a command option and a choice in the app, so it is his to merge.

## Prompt to paste into Codex

```text
You are the lane that built grooph's Codex compile target (slice 0076, draft pull request #70, branch slice/0076-codex-target). The driver's review is at handoffs/0076-codex-target/REVIEW.md on main: fetch, merge main into your branch, and read it. Verdict: a fix pass, then the proving run. Lead with GPT-6.1 Sol and use GPT-6 Luna for workers.

Do the five numbered items under "What must change before it merges", each with a test that fails without it: (1) do not write approval_policy into agent files or suggest it for the lead, and say plainly what that means; (2) Sol leads and Luna works by default, with the mapping's sentence computed, the lead command naming the lead's model, and the note when two tiers a graph uses are one model; (3) every agent file parses as TOML for every document the validator accepts, U+007F and lone surrogates included; (4) compile() refuses ids that are not ids, for both targets, and the kickoff's path is quoted; (5) "verified" becomes what was done. The Claude Code golden packages must not change by a byte; the Codex ones change only as items 1, 2 and 5 require. Regenerate what is generated, keep every CI check passing, do not edit docs/PROGRESS.md or docs/PLAN.md, and do not merge.

Do not start a model session in this pass. When it is pushed, update handoffs/0076-codex-target/HANDBACK.md, and end your reply with two things: the prompt I should carry back to the driver session in Claude Code, and the exact command you would run for the review-gate proving run, with what it reads and writes outside the repository, so I can say yes or no to it.
```

## Second read, 2026-10-04: the fix pass at `68c1dfe`

**Reader:** a fresh Opus 5.5 subagent of the driver's, which re-ran items 1 to 5 above on Codex's fix pass and read the command proposed for the proving run. Written here on 2026-10-05 from the review desk's card (`q39-codex-target-round2`), where it was first put to the owner; no model session was started.

**All five items are fixed.** No approval setting is written or suggested. GPT-6.1 Sol leads and GPT-6 Luna works by default. 7,128 agent files made from hostile graphs all parse, and none gained a setting. The compiler itself now refuses names that are not names, for both targets. Nothing claims a run that did not happen. The Claude Code golden packages are byte for byte unchanged.

**Three things to change before it merges:**

1. **A brake loosened by this pull request.** `packages/core/src/compile/claude-code/context.ts` takes the profile from the document's own harness, and Codex now has a profile. So `fixtures/valid/review-loop.grooph.json` with `"harness": "codex"`, exported with `--target claude-code`, exits 0 with no warning and writes agent files with the model `gpt-6-luna` and no `tools` or `disallowedTools` lines, which in Claude Code means every tool. On `main` that document is refused (`E_NO_TARGET`). The Claude Code compiler must use the Claude Code profile whatever harness the document names; whether a document that names one harness and is exported for another is refused or warned is the author's to decide and say, the same way for both targets, with a test.
2. **`main` has moved.** Merged with it, `packages/core/test/graph-units.test.ts` calls `compile()` on an unparsed document and the new guard throws: the test should call the compiler as `compile.test.ts` does, without weakening the guard. The Claude Code lead brief gained a "Units" table for subgroophs (`packages/core/src/compile/claude-code/lead.ts`); the Codex lead brief is a copy and lacks it, and should get it from the same function. Both Codex golden packages regenerated; the Claude Code ones unchanged by a byte.
3. **A sentence nobody has checked.** "Inherits the owner's approval policy" (`packages/core/src/compile/codex/mapping.ts`, `agents.ts`, and `docs/targets/codex.md`, where it is marked seen) stands beside a `codex exec` command that nobody has run. It is unknown until a run shows it.

Also asked for: CI's budget lines after the merge, in the handback (the first load is at 179.72 of 180 KB on `main` and this pull request adds about 0.10); and that `scripts/prove-codex.mjs` write `codex-output.jsonl` and the stderr file where git ignores them, because they are the whole transcript and the repository is public.

**The proving run**, as put to the owner: one Codex session started by a script in his `grooph-codex` folder; a Sol lead at high effort and two Luna workers run `review-gate` on a small scratch project for fifteen minutes at most, with web search off. It uses his Codex sign-in and configuration as they are, so his connected servers and hooks are live in it. It turns no approval off and uses the ordinary workspace sandbox. There is no dollar cap; the tokens used are recorded. The reader saw no reason to refuse it, on three conditions the driver agrees with: after the three fixes, not before; the two transcript files out of git until a person has read them; run from the final head, built. The owner says yes or no after Codex shows him the command again at its new head.

The prompt for this second pass is on the desk card, and the owner carries it to Codex.
