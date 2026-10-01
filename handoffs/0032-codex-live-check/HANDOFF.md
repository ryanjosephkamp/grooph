# Handoff 0032 · The live view, checked from inside Codex

**Stage:** 20 · **Implementer:** Codex (the owner's default model) · **Branch:** `slice/0032-codex-live-check` · **Drafted:** 2026-09-30 · **Confirmed by owner:** pending

## Objective

grooph's live view records Codex sessions through a hook (`docs/subagents.md`, amendment A-012). It was verified on 2026-09-30 only through `codex exec`, with the hook passed for one invocation and hook trust bypassed. Three things were left unknown, and only a real Codex session with the owner present can settle them. When this slice is done each is answered from a recorded session, and the documents say what was seen in place of "unknown".

It is a check, not a build. If something is broken, fix it only where a fix is small and inside the allowed changes; otherwise report it.

## Success criteria

1. **Does a project's `.codex/hooks.json` load?** After the owner has trusted the folder and the hook in `/hooks`, this session's own events are in `.grooph/events/<session id>.jsonl`. Proof: `grooph sessions` lists this session as `working`. If the file is empty or missing, say so and say what `/hooks` shows; that is an answer too.
2. **Subagents are recorded.** Start two subagents on trivial tasks (for example: one reports the first word of `README.md`, one runs `echo hello`). Proof: `grooph sessions --json` shows both, each with a start and a stop, and `docs/subagents.md` §4's table of what a Codex hook receives still matches. Note any key that differs in an interactive session from the `codex exec` record in `handoffs/0027-live-subagents/experiments/codex-0.159.2.md`.
3. **The MCP server from Codex.** Find out whether Codex can use `grooph mcp` and whether `grooph_plan`, `grooph_note` and `grooph_running` work from it. Adding a server changes Codex's configuration, so **ask the owner before you add it**, say exactly what would be written and where, and prefer a project-level or one-session way over `~/.codex/config.toml` if Codex has one. If he says no, record that this was not tried.
4. **A review of the Codex half of `docs/subagents.md`** by the harness it describes: every sentence about Codex marked [doc] or [seen] is right for the version you are, or is corrected, with the source. You know Codex better than the session that wrote it.
5. **The record.** A folder `experiments/hooks/<today>/codex-<n>-<what>/` per check, in the shape of `experiments/hooks/2026-09-30/`, with the events the hook wrote, and a row in that day's `ledger.json` (session id, model, what it was for, transcript path and SHA-256). Follow `experiments/hooks/README.md`: transcripts and anything holding the owner's instructions stay out of git.
6. `pnpm -r build && pnpm -r test` pass if you changed any code.

## Read first

1. `handoffs/0032-codex-live-check/HANDOFF.md` (this file)
2. `docs/subagents.md`: all of it; §3 and §4 are the Codex half
3. `handoffs/0027-live-subagents/experiments/codex-0.159.2.md`: what `codex exec` handed a hook
4. `experiments/hooks/README.md`: how a run is recorded
5. `packages/cli/hooks/grooph-event.mjs` and `packages/cli/src/commands/hooks.ts`: the hook and its installer, both short
6. `docs/HANDBACK-operator.md` §4 and §7: what the Operator was told about Codex

## Allowed changes

- `docs/subagents.md`, `docs/HANDBACK-operator.md` (the Codex statements only)
- `experiments/hooks/<today>/**`
- `handoffs/0032-codex-live-check/HANDBACK.md`
- `packages/cli/hooks/grooph-event.mjs`, `packages/cli/src/commands/hooks.ts` and their tests, only for a defect this check exposes, and only with a test that shows it
- `fixtures/events/**`, only to add a recording
- the **In flight** entry for this slice in `docs/PROGRESS.md`

## Forbidden changes

- `spec/**` and the schemas: the contract does not move in a check.
- Anything under `~/.codex` without the owner's yes in this session, each time. Hook trust and project trust are his to grant in `/hooks`; never pass `--dangerously-bypass-hook-trust` for a session he has not seen.
- `.codex/hooks.json` is installed in this worktree already and is not committed in this slice. (The hook script itself, `.grooph/hooks/grooph-event.mjs`, and the Claude Code entries in `.claude/settings.json` are in the repository since 2026-10-01, by the owner's decision. Whether the repository also carries Codex's entries is his to decide after this check.)
- Starting more than a handful of short sessions. This is a check on trivial tasks. Anything larger waits for the owner's word (decision 0014).
- The Codex compile target (stage 9). It is its own slice and waits for the owner's go.
- Merging, tagging, or pushing to `main`. Push only this branch.

## Spec constraints that apply here

- A-012: the hook "prints nothing and always exits 0, so it observes and cannot steer"; it records "ids, names and times, never a prompt, a tool's input or result, or a reply". A fix that breaks either is not a fix.
- "No LLM calls inside grooph" (AGENTS.md). The sessions here are the harness's, started by the owner or by you as the check.

## Design already decided

- The event shape (`docs/subagents.md` §5) and the hook's entries (`hookEntries` in `hooks.ts`).
- Labels in `docs/subagents.md`: **[doc]** with a link, **[seen]** with the run that showed it, **[unknown]** otherwise. Keep them honest: a thing you believe and did not see or read is [unknown].

## Implementer's choices

- The trivial tasks, and how many sessions you need (two or three should do).
- Whether an interactive recording becomes a fixture.

## How to verify

```bash
grooph hooks status                 # the Codex hook is installed in this folder
grooph sessions                     # this session, working, with its subagents
node experiments/hooks/check.mjs    # every ledger row matches its transcript
pnpm -r build && pnpm -r test       # only if code changed
```

## Handback must contain

The `handoffs/TEMPLATE-HANDBACK.md` sections, plus:

- one line per success criterion: answered yes, answered no, or not tried, with the session id that shows it;
- the Codex version (`codex --version`) and the model you ran on;
- every sentence of `docs/subagents.md` you changed, old and new;
- anything you were asked not to do and wanted to.

## Before the prompt: three steps for the owner

1. Open Codex on the Mac in the folder `/Users/noir/Documents/grooph-codex`. If it asks whether you trust the folder, say yes.
2. Type `/hooks`. You should see grooph's entries (they run `node …/.grooph/hooks/grooph-event.mjs codex`). Trust them. If `/hooks` shows nothing, tell Codex so after you paste the prompt: that is the first finding.
3. Start a **new** session in the same folder (hooks load when a session starts), and paste the prompt.

## Prompt to paste

```text
You are the implementer for grooph slice 0032, working in Codex on Ryan's Mac.

Folder: /Users/noir/Documents/grooph-codex, a git worktree of github.com/ryanjosephkamp/grooph on branch slice/0032-codex-live-check. The grooph command is on the path (if not: node packages/cli/bin/grooph.js).

Read AGENTS.md, then handoffs/0032-codex-live-check/HANDOFF.md, and do what it says. It is a check of grooph's live view from inside Codex, on trivial tasks: a few short sessions at most. Stay inside its allowed changes, and ask Ryan before anything that touches ~/.codex.

Ryan has just opened /hooks in this folder and trusted grooph's hook (or will tell you that /hooks showed nothing).

Finish by writing handoffs/0032-codex-live-check/HANDBACK.md from handoffs/TEMPLATE-HANDBACK.md, committing with a message like "docs: handback 0032", and pushing the branch. Then tell Ryan what you found in three plain sentences; he reads on his phone and will carry your answer to the grooph session in Claude Code.
```
