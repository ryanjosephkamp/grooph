import { code, doc, fence, lines, table } from "../markdown.js";
import type { PackageContext } from "./context.js";
import { tomlString } from "./agents.js";
import type { Tier } from "../../types.js";

const shellString = (value: string): string => "'" + value.replaceAll("'", "'\"'\"'") + "'";

export function mappingNotes(ctx: PackageContext): string {
  const leadWeb = (ctx.leadNode?.allow ?? ctx.profile.defaultCapabilities).includes("web") && !(ctx.leadNode?.deny ?? []).includes("web") ? "live" : "disabled";
  const leadModel = ctx.leadNode
    ? ctx.leadNode.model?.pin?.codex ?? (ctx.leadNode.model ? ctx.profile.models[ctx.leadNode.model.tier] : undefined)
    : ctx.profile.models.frontier;
  const leadModelOption = leadModel ? ` -m ${shellString(leadModel)}` : "";
  const subagentDefaultModel = ctx.profile.models[ctx.profile.defaultTier];
  const modelTiers = new Map<string, Tier[]>();
  for (const [tier, model] of Object.entries(ctx.profile.models) as [Tier, string][]) {
    modelTiers.set(model, [...(modelTiers.get(model) ?? []), tier]);
  }
  const tierCollapses = [...modelTiers]
    .filter(([, tiers]) => tiers.length > 1)
    .map(([model, tiers]) => `${tiers.join(" and ")} resolve to ${model}`);
  const tierCollapseNote = tierCollapses.length > 0
    ? `Model collapse: ${tierCollapses.join("; ")}; tier names do not guarantee distinct underlying models.`
    : "No two tiers resolve to the same model.";
  return doc(
    lines(`# Mapping notes · ${ctx.doc.name}`, "", `CLI ${code(ctx.profile.verifiedAgainst)} help was read on ${ctx.profile.verifiedOn}; the package has not been run in Codex. The graph is the source of truth; re-exporting overwrites these generated files.`),
    lines("## Graph piece → file", "", table(["piece", "file", "meaning"], [
      ["source", code(ctx.paths.graph), "canonical graph; never written by a run"],
      ["lead", code(ctx.paths.lead), "main session's brief, routing, loops, gates, adaptation and notes"],
      ["kickoff", code(ctx.paths.kickoff), "paste this prompt into a fresh Codex session"],
      ["mapping", code(ctx.paths.mapping), "this file"],
      ["working copy", code(ctx.paths.workingCopy), `created at kickoff; adaptation: ${ctx.adaptation}`],
      ["progress", code(ctx.paths.progress), "rewritten after every node and halt"],
      ["notes", code(ctx.paths.notes), "append-only JSONL, unchanged run contract for grooph watch"],
      ...ctx.agents.map((a) => [code(a.node.id), code(a.file), `${a.role}; model ${a.model ?? "session default"}; effort ${a.effort ?? "session default"}; sandbox ${a.sandbox}`]),
    ])),
    lines("## Start or resume", "", "Place the package in the project before starting Codex. Custom agent names are the agent_type values given to spawn_agent; use fork_turns: none on fresh edges. This kickoff explicitly requests subagents. It sets the lead model when the graph supplies one (or when the graph has no lead node) and the default spawned-agent model for this invocation only. It names no approval option and writes nothing to the owner's configuration, hooks or skills.", "", fence(`codex exec --sandbox workspace-write -c agents.default_subagent_model=${shellString(tomlString(subagentDefaultModel))} -c web_search=${shellString(tomlString(leadWeb))}${leadModelOption} -c model_reasoning_effort=${shellString(tomlString(ctx.leadNode?.effort ? ctx.profile.effort[ctx.leadNode.effort] : "high"))} - < ${shellString(ctx.paths.kickoff)}`, "sh"), "", "The owner chooses project trust and hook approvals. The package sets no approval policy: no agent file has an approval_policy key and this command has no approval option. Which approval policy then applies, to the lead under codex exec and to the agents it spawns, is unknown to this package: grooph has no run on record that shows it. Do not read the absence of a setting as the owner's configured policy applying. An unattended operation requiring owner approval may be refused when nobody can respond; that refusal is not a native graph halt. Graph gates and stops remain instructions the lead must follow. In an interactive session, paste KICKOFF.md. At a human gate the lead records outcome: halt before asking, then ends its turn. A headless run ends there. Resume with codex exec resume <session-id> and an explicit prompt naming the same grooph run id and the human's actual answer, or start a fresh session with that run id and answer. A session id is separate from the grooph run id. Silence never approves a gate."),
    lines("## Hand-adjusting the package", "", `# ${ctx.tiersNamed.length > 0 ? "this export" : "profile"}: frontier → ${ctx.profile.models.frontier}, strong → ${ctx.profile.models.strong}, fast → ${ctx.profile.models.fast}`, "", tierCollapseNote, "", `A node's TOML model and model_reasoning_effort are its tier or harness-specific pin and effort. A pin wins over export model overrides. Nodes with no model inherit the invocation's spawned-agent default, ${ctx.profile.models[ctx.profile.defaultTier]} (${ctx.profile.defaultTier}); explicit node models take precedence. The lead's settings belong to the main session at startup. Model and effort availability depends on the account and client; halt on an unavailable selection.`, "", "sandbox_mode is read-only unless edit-files or write-outputs is allowed and not denied. Then it is workspace-write. The package does not set approval_policy; which approval policy applies is unknown to this package (Start or resume, above). An unattended operation requiring owner approval may be refused when nobody can respond; that refusal is not a native graph halt. Graph gates and stops remain instructions the lead must follow. web_search is disabled unless web is explicitly allowed and not denied. Parent live sandbox and approval settings can supersede custom settings. There is no per-node native tool allowlist in this package: declared output paths, ownership, test-only commands, evidence limits and delegation limits are instructions, not filesystem or tool guarantees. read-files includes non-mutating shell reads where there is no native file-read tool; this does not grant general command execution. write-outputs can write its own named outputs while edit-files stays denied.", "", "Node skills are explicitly requested in developer_instructions; Codex has no Claude-style skills preload field. The session must load applicable installed skills; a missing required skill halts the node. Custom capabilities are stated in the brief and require an available meaning and implementation.", "", "Loops, edges, checks, gates, merge and stop nodes live in LEAD.md. Change stop numbers in the graph and re-export. During adaptive runs change only the run-local working copy with an amendment note. A changed or added custom-agent definition is used only after the harness confirms it is available; hot reload is unknown, so otherwise halt for a fresh session or record a proposal. Never loosen a brake or replace a critic with the lead."),
    lines("## Limits and optional observation", "", "dispatches and minutes are counted by the lead. usd, turns and tokens are advisory; Codex has no documented dollar-cap flag. A max-iterations backstop is never the acceptance bar. Concurrency and retry caps, stops and gates are lead instructions; grooph is a compiler, not a runtime or a hard budget controller.", "", "grooph hooks install can separately add observation-only hooks; they need owner trust and review and this package neither installs nor depends on them. The lead still writes started and completed node notes and every loop pass, so grooph watch reads a Codex run without changes. Filesystem sandboxing does not provide evidence secrecy: fresh context means no inherited conversation, and the worker reads only its declared inputs and dispatched edge evidence."),
  );
}
