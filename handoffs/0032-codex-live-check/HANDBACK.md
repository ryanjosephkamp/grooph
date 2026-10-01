# Handback 0032 · The live view, checked from inside Codex

**Implementer:** Codex, owner's default (exact model/effort unverified) · **Branch:** `slice/0032-codex-live-check` · **Head commit:** `54bee687ddcb9eb66ca9648c35a1787a995dc631` (documentation and record; this handback follows), from baseline `1f9a8f2b112eb5db7c588ffc9c68a774f3370dfc` · **Date:** 2026-10-01 (America/New_York)

## Status

`blocked` — The desktop checks and documentation review are recorded, but trusted project loading in the intended folder, transcript custody and native MCP use remain unverified.

## What changed

- `docs/subagents.md`: Codex tool interface, context/inheritance, asynchronous results, nesting support, trust, invocation-only versus project loading, desktop observation, MCP limits and source dates.
- `docs/HANDBACK-operator.md`: only the Codex setup and known-limit statements.
- `docs/PROGRESS.md`: appended only to slice 0032's In flight entry.
- `experiments/hooks/2026-10-01/**` (**new**): two check folders, actual command output, empty event artifacts, explicit incomplete ledger, statement audit and old/new passages.
- `handoffs/0032-codex-live-check/HANDBACK.md` (**new**): this handback, following TEMPLATE-HANDBACK.md.

No code changed. The pre-existing untracked `.codex/` in the requested worktree was left out of the commit; no config, trust entry, schema, compiler or hook script was edited.

## Verified, and how

1. **Project hook loading: answered no for the intended project's live record; trusted same-folder loading remains unknown.** Session `01a0f5e4-e4bc-7120-8657-ad009213b886`. `node packages/cli/bin/grooph.js hooks status` showed the hook script and seven Codex hook entries, with zero session files. `node packages/cli/bin/grooph.js sessions --json` returned an empty sessions array before and after delegation. Ryan reported he could not find grooph's hooks; the implementer did not operate `/hooks`. The actual desktop chat cwd is `/Users/noir/.codex/worktrees/7a29/grooph-codex`, detached at baseline, while the requested hook installation is in `/Users/noir/Documents/grooph-codex`. A shell cwd change does not relocate the chat.
2. **Subagent recording: answered no; execution answered yes.** Same parent session. `collaboration.spawn_agent` started `/root/readme_word` and `/root/hello_check`, with `fork_turns: none` and no model/effort override. Their final answers were `grooph` and `hello`; `collaboration.list_agents` confirmed both completed. Grooph still listed no sessions or agents. No interactive hook input existed to compare with CLI 0.159.2, so none of the historical payload-key observations was upgraded to current interactive evidence. Subagent thread UUIDs were not available from these tool results; task names are not represented as UUIDs.
3. **Native MCP from Codex: not tried.** No extra session ID. Owner permission was requested for one `codex exec` invocation using temporary `-c mcp_servers.grooph.command="node"` and `mcp_servers.grooph.args` pointing to this worktree's CLI and an experiment-local project. No saved config edit was proposed; Codex's normal state/log writes under `~/.codex` were disclosed. No owner answer had arrived at handback preparation. `grooph_plan`, `grooph_note` and `grooph_running` therefore remain unverified as native Codex tools. This is pending permission, not a refusal.
4. **Codex document review: answered yes, with bounded evidence.** Every Codex claim group is reviewed in `experiments/hooks/2026-10-01/codex-statement-review.md`, using current official hooks/subagents/config/MCP pages, the exposed desktop tool instructions and historical recordings. Dated observations remain dated; unavailable runtime tests remain unknown. All changed passages are reproduced below.
5. **Run record: partial; transcript/model criterion not met.** Same parent session in both folders, one unique chat with two agents, not two new sessions. Command outputs were saved directly. No hook file existed, so each empty events artifact says why. The ledger omits unreported cost and has a null model, no obtained transcripts, and `evidence_complete: false`. Owner permission to read/copy this chat's and its two agents' rollout files under `~/.codex/sessions/2026/10/01/` into ignored `local/` was requested and remains pending. No transcript checksum or exact model slug is invented. The ledger checker verifies record presence only; 0/0 transcript matches is not transcript verification. The first checker attempt rejected a null cost field; it was corrected to the existing ledger convention of omitting unreported cost, without changing the checker. Its formatted dollar total is not an observed Codex cost.
6. **Code build/tests: not tried, not required.** No code changed. `git diff --check` passed. The record/link/privacy/scope checks are listed in the experiment README. No old-rollout all-days check was run without owner permission.

`codex --version` reported **codex-cli 0.159.3**, plus a warning that PATH aliases could not be created because of sandbox permissions. This is the installed CLI version, not verified desktop build provenance. The owner-default model was inherited by the test agents; its exact slug and reasoning effort remain unverified without the requested rollout metadata.

## Decisions made

- Worked in the exact named worktree on its existing slice branch, preserving the detached app worktree and the same baseline. The only initial dirty path in the named worktree was the expected untracked `.codex/`.
- Started exactly the two trivial agents requested by the handoff. No nested agents, resumed agents, new chats, or command-started model sessions were added.
- Treated installation and hook loading as separate evidence. The cwd mismatch and absence of a trust observation prevent a claim that correctly trusted same-folder hooks failed.
- Made documentation corrections, not a hook/installer repair: this check exposed no proved code defect.
- Requested a one-invocation MCP route in preference to editing `~/.codex/config.toml`; no dependent action was taken without an answer.
- Kept unknown cost, token usage, model and transcript provenance distinct from zero or verified evidence.

## Deviations

- The actual desktop session started in an app-managed detached worktree, unlike the handoff's intended same-folder interactive session. Repository changes and branch delivery still use `/Users/noir/Documents/grooph-codex`.
- The record has no raw transcripts or transcript checksums because the expressly required owner permission remains pending. No command-started model session was launched, so no streamed `codex exec` output was generated.
- The all-days ledger check was narrowed to this date to avoid reading historical owner-owned Codex transcripts without permission.
- The current Codex interface supports history forks and direct agent messages, which qualifies the shared §4 description. Nested execution was left untested to keep the check small.

## Risks and leftovers

- Owner: open a fresh local chat in the actual named slice worktree, inspect/trust the project's hook definitions in the CLI `/hooks` as applicable, then check for real events. The present result is not a trusted same-folder test.
- Pending owner decisions: transcript read/copy/checksum access and the single invocation-only native MCP test. Neither silence nor elapsed time was treated as approval or refusal.
- Owner/driver: decide whether Codex entries should be carried into another worktree; this slice neither installs nor commits `.codex/hooks.json`.
- Transcript and exact model evidence remain missing. This continuing parent chat would require a clearly identified immutable local snapshot if read before it ends; its live rollout changes as the chat continues.
- No claim of desktop app build/version, billing, cloud execution, context isolation, nested hook behavior, or physical phone acceptance is made.
- **Asked not to do and wanted to:** access only the current and two child rollouts for provenance, and attach grooph MCP temporarily; both were requested and left pending. No trust bypass, config repair, compile-target work, merge, tag or main push was attempted.

## Prompt to paste into the driver session

```text
Handback for slice 0032 is at handoffs/0032-codex-live-check/HANDBACK.md on branch slice/0032-codex-live-check (documentation and record head 54bee687ddcb9eb66ca9648c35a1787a995dc631; the handback commit follows). Status: blocked. Please reconcile with the grooph-reconcile skill. Ryan could not find hooks; the desktop chat opened a different detached worktree, and the intended project recorded no session even though two trivial agents completed. Documentation is corrected; transcript access and a one-invocation native MCP test still await owner permission. Do not treat this as evidence that trusted hooks fail in the intended folder, and do not merge without Ryan's word.
```

## Changed passages: exact old and new

The following includes every changed passage of docs/subagents.md, plus the two Codex-only operator changes. Unchanged historical claims are covered by the statement-review table above.

### 1. docs/subagents.md

Old:

```text
- **[seen]** grooph observed it, in one small session on 2026-09-30, with Claude Code 2.1.280 or Codex CLI 0.159.2. The records are in [`handoffs/0027-live-subagents/experiments/`](../handoffs/0027-live-subagents/experiments/). One session is one data point: true that day, on that version.
```

New:

```text
- **[seen]** grooph observed it in the named run or tool interface. The original records use Claude Code 2.1.280 or Codex CLI 0.159.2 on 2026-09-30 and are in [`handoffs/0027-live-subagents/experiments/`](../handoffs/0027-live-subagents/experiments/). The Codex desktop check of 2026-10-01, with installed CLI 0.159.3, is in [`experiments/hooks/2026-10-01/`](../experiments/hooks/2026-10-01/). An observation applies to that client and run; the installed CLI version does not identify the desktop app build.
```

### 2. docs/subagents.md

Old:

```text
The tools are `spawn_agent`, `send_input`, `resume_agent`, `wait_agent` and `close_agent`. [doc] A hook sees them as `collaborationspawn_agent` and `collaborationwait_agent`. [seen]
```

New:

```text
The CLI 0.159.2 recording names `collaborationspawn_agent` and `collaborationwait_agent` in hook inputs. [seen] This desktop session instead exposes `spawn_agent`, `send_message`, `followup_task`, `interrupt_agent`, `list_agents` and `wait_agent`; it used `spawn_agent` twice and received both final answers. [seen: desktop tool interface and slice 0032] No interactive hook input was captured, so its hook tool names remain [unknown].
```

### 3. docs/subagents.md

Old:

```text
**What it starts with.** A subagent inherits the parent's model, effort and sandbox unless told otherwise. [doc] Whether it sees the parent's conversation is not in the documentation; the spawn call in the session observed carried `fork_turns: "none"`, which reads as "none of it". [seen]
```

New:

```text
**What it starts with.** Model and effort come from explicit settings or configured agent defaults, otherwise from the parent; the parent turn's sandbox and approval overrides carry over. [doc] ([subagents](https://learn.chatgpt.com/docs/agent-configuration/subagents)) This desktop tool interface defines `fork_turns: "none"` as no surrounding history and `"all"` as the default, with selected recent turns also available. [seen: desktop tool interface] Both slice-0032 test agents used `"none"`; this was not a separate test of context isolation.
```

### 4. docs/subagents.md

Old:

```text
**What comes back.** Summaries: "Codex waits until all requested results are available, then returns a consolidated response." [doc]
```

New:

```text
**What comes back.** The main thread collects the subagent results into its final response. [doc] ([subagents](https://learn.chatgpt.com/docs/agent-configuration/subagents)) In slice 0032, each final answer arrived separately while the lead continued working: `grooph` and `hello`. [seen] The lead need not block all its other work while it waits.
```

### 5. docs/subagents.md

Old:

```text
**Subagents starting subagents.** Not in the documentation. [unknown]
```

New:

```text
**Subagents starting subagents.** The desktop tool instructions in slice 0032 allow subagents to spawn their own subagents and to message other agents. [seen: tool interface] Nested execution and its hook events were not tried in this check. [unknown] This also qualifies §4's description: Codex can pass parent history and messages, so its lead is not necessarily the only agent with the whole conversation, and it does have agent-to-agent messaging.
```

### 6. docs/subagents.md

Old:

```text
`install` says what it wrote, changes nothing else in those settings files, and is undone by `grooph hooks remove`. Without `--tools` only starts, stops and the spawn tool are recorded; with it, each finished tool call adds a line with the tool's name, so a subagent shows its last tool. In Codex, open `/hooks` once and trust the hook: Codex will not run it before you have. Both need `node` on the path.
```

New:

```text
`install` says what it wrote, changes nothing else in those settings files, and is undone by `grooph hooks remove`. Without `--tools` only starts, stops and the spawn tool are recorded; with it, each finished tool call adds a line with the tool's name, so a subagent shows its last tool. In the Codex CLI, `/hooks` reviews discovered hooks; project hooks also need the project layer trusted, and a changed definition needs renewed review. [doc] ([hooks](https://learn.chatgpt.com/docs/hooks)) Both need `node` on the path.
```

### 7. docs/subagents.md

Old:

```text
## 7. The MCP server: a plan beside what happened
```

New:

```text
**Codex desktop check, 2026-10-01.** Ryan reported that he could not find grooph's hooks in `/hooks`. The requested worktree `/Users/noir/Documents/grooph-codex` had seven Codex entries installed, but `grooph sessions --json` returned no sessions before or after two trivial subagents finished. [seen] This chat actually started in the separate detached worktree `/Users/noir/.codex/worktrees/7a29/grooph-codex`; its tracked tree has no Codex hook entries. Changing a shell command's working directory does not move the chat. This is a missing interactive recording with a folder mismatch, not a test of a trusted project hook failing in the intended folder. The hook payload table above remains the earlier CLI observation; there were no new inputs to compare. See [the check record](../experiments/hooks/2026-10-01/codex-1-interactive-project-hooks/check.json).

## 7. The MCP server: a plan beside what happened
```

### 8. docs/HANDBACK-operator.md

Old:

```text
- **Codex**: the same, plus one human step. Codex runs a hook only after someone has reviewed it: open `/hooks` in Codex in that project and trust it. Ryan does this once per project.
```

New:

```text
- **Codex**: project hooks need a trusted project layer and approval of each hook definition. In the CLI, Ryan reviews them in `/hooks`; a changed definition needs review again ([Codex hooks](https://learn.chatgpt.com/docs/hooks)). Verify the chat's actual working folder: slice 0032 found the entries installed in the intended worktree, while the desktop chat ran in a different worktree and recorded no events.
```

### 9. docs/HANDBACK-operator.md

Old:

```text
- **Codex in the cloud is unknown.** Its documentation does not say whether hooks run in cloud tasks. Locally it needs the one-time trust in `/hooks`. A project-level `.codex/hooks.json` was not seen loading after trust (the same hook was run by passing it for one invocation).
```

New:

```text
- **Codex in the cloud is unknown.** This check does not establish hooks in Codex cloud tasks. Locally, both project-layer trust and hook-definition trust are required. The earlier CLI check ran the hook by passing it for one invocation; slice 0032's desktop chat and two trivial subagents produced no events in the intended project, with a different session working folder and Ryan reporting no hooks found. Loading after trust in the intended folder remains unverified ([record](../experiments/hooks/2026-10-01/codex-1-interactive-project-hooks/check.json)).
```

### 10. docs/subagents.md

Old:

```text
| Does a project's hook run in a headless session? | yes [doc] [seen] | yes [seen] |
```

New:

```text
| Does a project's hook run in a headless session? | yes [doc] [seen] | the hook passed for one invocation ran [seen]; automatic project-file loading was not established |
```

### 11. docs/subagents.md

Old:

```text
With Codex the server was run as a process and not from a Codex session.
```

New:

```text
The earlier Codex check ran the server as a process, without attaching it to a Codex session. Slice 0032 requested owner permission for a single CLI invocation with temporary MCP settings; that test remains untried pending permission. [unknown] Project-scoped MCP configuration is also documented, but adding it was not authorized in this slice ([MCP](https://learn.chatgpt.com/docs/extend/mcp?surface=cli), [one-off overrides](https://learn.chatgpt.com/docs/config-file/config-advanced)).
```

### 12. docs/subagents.md

Old:

```text
Codex, read 2026-09-30 against CLI 0.159.2:
```

New:

```text
Codex, originally read 2026-09-30 against CLI 0.159.2; hooks, subagents, configuration and MCP documentation rechecked 2026-10-01 for slice 0032 (installed CLI 0.159.3; desktop build not established):
```
