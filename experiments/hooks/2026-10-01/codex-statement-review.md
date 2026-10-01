# Slice 0032: Codex statement review, 2026-10-01

The installed CLI reports `codex-cli 0.159.3`. This is a Codex desktop chat; that command does not establish the desktop build or its bundled runtime version. The chat's ID is `01a0f5e4-e4bc-7120-8657-ad009213b886`. The model slug and reasoning effort are not verified: access to this chat's rollout metadata was requested and remains pending. Neither billing nor token usage is exposed in the tools used here.

The check was opened by Ryan, not launched by an implementer command. It used exactly two trivial subagents, without model or effort overrides. No additional model session was launched. Every result below is either a current official documentation check, the current tool interface, this chat's observation, or explicitly retained historical evidence. Historical payload observations were not re-created.

| Codex statements in docs/subagents.md | Review and evidence |
|---|---|
| §3: enabled by default; agents.enabled; concurrency and model/effort defaults | Confirmed by current [subagents](https://learn.chatgpt.com/docs/agent-configuration/subagents) and [configuration reference](https://learn.chatgpt.com/docs/config-file/config-reference). The concurrency setting excludes the primary; no numeric default is claimed. |
| §3: delegation needs direct or applicable instruction | Confirmed by the subagents page and this chat's standing instructions. The handoff expressly requested two agents, and both ran. |
| §3: three of four earlier sessions delegated; firm prompt worked | Retained as 2026-09-30 observations, not a new measurement. The handoff-0027 record remains the evidence. |
| §3: tool names | Corrected: the desktop interface exposes spawn_agent, send_message, followup_task, interrupt_agent, list_agents, wait_agent. Old hook names remain dated CLI observations. No desktop hook names were measured. |
| §3: inheritance and fork_turns | Corrected to distinguish configured defaults and parent runtime overrides. fork_turns none/all/recent-turn options are from the present tool interface; both test agents used none. No context-isolation experiment was run. |
| §3: built-in and custom agent types | Current subagents documentation confirms default/worker/explorer and the TOML locations/required keys. Earlier default-type dispatch is retained as historical evidence. The desktop spawn interface here has no agent_type field. |
| §3: results | Corrected: the lead collects results for its response; each agent's final answer arrived separately while the lead continued. The answers were grooph and hello. |
| §3: nesting | Corrected from blanket unknown to interface support. This check did not run a nested agent. |
| §3: rollout layout and format | Earlier recording retained; format instability confirmed by [hooks](https://learn.chatgpt.com/docs/hooks). Current rollout access was requested, not assumed. |
| §3: background memory session fired hooks | Retained as the 2026-09-30 observation. No current background memory run was inspected. |
| §4: only the lead sees the whole run; no agent messaging | Added a Codex qualification in §3: this interface can fork history and message other agents. No nested or messaging experiment was added. |
| §5: hook locations and trust | Confirmed by hooks/configuration docs. /hooks is documented for the CLI; project layer trust and per-definition hash trust are separate. Ryan's inability to find hooks is a user report, not an agent-operated UI observation. |
| §5: common fields and start/stop fields | Current hooks page confirms session_id/transcript_path/cwd/hook_event_name/model and event-specific turn/agent/stop fields. The existing [seen] values remain the old recording. |
| §5: agent_id/type on tool events | Retained as historical source/record evidence, not newly observed. The page's common-field list still does not establish these for every subagent tool input. |
| §5: parent session_id; differing start/stop transcript paths; absent parent-agent field | Parent session ID is documented. Exact transcript choices and lack of hook parentage remain the 0.159.2 recording. No interactive inputs exist to compare. |
| §5: app-server children; model on hooks | Existing app-server citation and hooks common model field retained. No app-server child query was run here. |
| §5: repeated stops and internal helper events | Preserve unknown/source-only labels. This check neither resumes an agent nor inspects internal helpers. |
| §5: noninteractive hooks | Old invocation-only observation retained. §8 now distinguishes a passed hook running from a project hook file loading automatically. |
| §5/§8: cloud | Remains unknown for Codex cloud tasks; none was tried. The hooks page separately says local command hooks are unsupported with Work cloud orchestration, even with local execution; this is not presented as a measured Codex Cloud result. |
| §5: silent exit 0; output/context; exit 2/decisions; async | Supported by current hooks docs. Historical source-only failure/timeout claim is not upgraded to a current runtime observation. No control-producing hook was executed. |
| §6: installation/trust and live view | Corrected one-time-trust wording. Installation is a file check, not evidence the harness loaded it. Both snapshots had seven project Codex entries and zero recorded sessions. |
| §7: MCP from Codex | Native attachment is untried while owner permission is pending. Current docs support project config and invocation-only -c overrides. No configuration or trust state was changed. |
| §8: summary | Historical positive payload claims retained with dates; automatic project loading corrected. Interactive subagents ran but their events were not recorded in the intended project. |

Exact changed passages (old/new) are in `document-changes.json` and the handback. No hook script, compiler, schema, fixture, or installer was changed. This is insufficient evidence of a hook-code defect.
