/**
 * `.codex/agents/<graph-id>--<node-id>.toml` — one subagent per agent node,
 * except the lead, which is the main session. TOML fields come from
 * `docs/targets/codex.md` § "Unit mapping".
 */

import { edgeWhen, loopsOfNode } from "../../semantics.js";
import type { Edge } from "../../types.js";
import { bullet, code, doc, fence, firstSentence, lines } from "../markdown.js";
import type { PackageContext, ResolvedAgent } from "./context.js";

/** JSON basic strings use the same escapes as TOML basic strings; newlines never create a setting. */
export const tomlString = (value: string): string => JSON.stringify(value);

export function agentFile(ctx: PackageContext, agent: ResolvedAgent): string {
  const instructions = doc(...body(ctx, agent));
  return lines(
    `name = ${tomlString(agent.agentName)}`,
    `description = ${tomlString(`${agent.role} for graph ${ctx.graphId}. ${firstSentence(agent.node.brief)}`)}`,
    ...(agent.model ? [`model = ${tomlString(agent.model)}`] : []),
    ...(agent.effort ? [`model_reasoning_effort = ${tomlString(agent.effort)}`] : []),
    `sandbox_mode = ${tomlString(agent.sandbox)}`,
    'approval_policy = "never"',
    `web_search = ${tomlString(agent.web)}`,
    `developer_instructions = ${tomlString(instructions)}`,
    "",
  );
}

function body(ctx: PackageContext, agent: ResolvedAgent): string[] {
  const node = agent.node;
  const inbound = ctx.index.incoming.get(node.id) ?? [];
  const outbound = ctx.index.outgoing.get(node.id) ?? [];
  const evidence = [...new Set(inbound.flatMap((edge) => edge.evidence ?? []))];

  return [
    lines(
      `# ${node.name}`,
      "",
      `Node ${code(node.id)} in the grooph graph ${code(ctx.graphId)} (${ctx.doc.name}). The lead dispatches you and you report back to the lead — you do not dispatch graph nodes yourself, and you do not update the run's progress log.`,
    ),
    lines("## Brief", "", node.brief),
    ...(node.description ? [lines("## Context", "", node.description)] : []),
    lines(
      "## Inputs",
      "",
      ...(node.inputs && node.inputs.length > 0
        ? node.inputs.map(bullet)
        : [bullet("None declared: work from the prompt the lead gives you.")]),
    ),
    lines(
      "## Outputs",
      "",
      "Leave all of these behind before you report:",
      "",
      ...node.outputs.map(bullet),
      ...(writesOnlyOutputs(ctx, agent)
        ? [
            "",
            `Write them yourself. With ${code("write-outputs")} you may create or overwrite only the files you declare in these outputs, and no other file.`,
          ]
        : []),
    ),
    ownership(agent),
    evidenceRules(ctx, agent, evidence),
    capabilities(ctx, agent),
    reportFormat(agent, outbound),
  ];
}

/** graph-ir §1: `write-outputs` without `edit-files` — the node may write its declared outputs and nothing else. */
function writesOnlyOutputs(ctx: PackageContext, agent: ResolvedAgent): boolean {
  const allow = agent.node.allow ?? ctx.profile.defaultCapabilities;
  return allow.includes("write-outputs") && !allow.includes("edit-files");
}

function ownership(agent: ResolvedAgent): string {
  const owns = agent.node.owns ?? [];
  return lines(
    "## Ownership",
    "",
    ...(owns.length > 0
      ? [
          `You are the only node in this run that writes ${owns.map(code).join(", ")}. Nothing else touches them while you work; if you need a change elsewhere, say so in your report instead of making it.`,
        ]
      : [
          "You own no artifact in this graph. Do not write over another node's files: report what should change and let the lead route it.",
        ]),
  );
}

/**
 * graph-ir §2 "Evidence": what the lead hands the node plus its declared
 * inputs, which for a writer includes the project it is changing. A critic
 * reports `invalid-evidence` on evidence it cannot read; the round counts
 * toward an `evidence-invalid` stop only where a loop around the node has one.
 */
function evidenceRules(ctx: PackageContext, agent: ResolvedAgent, evidence: string[]): string {
  const inputs = agent.node.inputs && agent.node.inputs.length > 0 ? "your declared inputs (Inputs above)" : "your declared inputs";
  const project = agent.isWriter ? ", which for you includes the project you are changing" : "";
  const evidenceStop = loopsOfNode(ctx.index, agent.node.id).some((loop) =>
    (loop.stops ?? []).some((stop) => stop.kind === "evidence-invalid"),
  );
  return lines(
    "## Evidence rules",
    "",
    ...(evidence.length > 0
      ? [
          `You may inspect what the lead hands you — the evidence below — plus ${inputs}${project}, and nothing else:`,
          "",
          ...evidence.map(bullet),
          "",
          agent.isCritic
            ? `If any of it is missing or unreadable, do not guess and do not substitute your own reading of the repository: report ${code(
                "invalid-evidence",
              )} and say which item you could not read.${evidenceStop ? " That round counts toward the loop's evidence stop." : ""}`
            : `If any of it is missing or unreadable, say so in your report rather than guessing.`,
        ]
      : [
          `No inbound edge lists evidence for you. Work from ${inputs}${
            agent.isWriter ? ", the project you are changing" : ""
          } and the lead's prompt, and nothing else; say so in your report if something you need is missing.`,
        ]),
    ...(agent.isCritic
      ? [
          "",
          `You judge; you do not fix. Report findings instead of editing.${
            writesOnlyOutputs(ctx, agent) ? " Your own outputs are the only files you write." : ""
          } Cite a file and a line for every claim you make: an adjective is not a finding.`,
        ]
      : []),
  );
}

function capabilities(ctx: PackageContext, agent: ResolvedAgent): string {
  const allow = agent.node.allow ?? ctx.profile.defaultCapabilities;
  const deny = agent.node.deny ?? [];
  return lines(
    "## Capabilities and sandbox",
    "",
    bullet(`Allowed: ${allow.map(code).join(", ") || "none"}. Use only these capabilities; the presence of a tool does not grant permission to use it.`),
    bullet(`Denied: ${deny.map(code).join(", ") || "none"}. A denied capability stays denied; write-outputs, when explicitly allowed, permits only your declared output files even when edit-files is denied.`),
    bullet(`Requested sandbox: ${code(agent.sandbox)}; approval policy: ${code("never")}; web search: ${code(agent.web)}. Parent sandbox and approval overrides may supersede this agent's settings. These coarse controls do not enforce file-by-file ownership, declared-output scope, shell command scope, or no delegation: those remain instructions.`),
    bullet("Do not use commands to bypass a capability limit. read-files permits non-mutating read, list and search commands when Codex exposes file reading through a shell; use them only for declared inputs and evidence. write-outputs permits writing only the declared output files. run-tests permits only the declared test command. All other command execution requires run-commands. Do not execute commands outside those allowed purposes. Do not spawn other agents unless spawn-agents is expressly allowed and the lead has delegated that decomposition; report every child dispatch to the lead so it can count it."),
    ...((agent.node.skills ?? []).length > 0 ? ["", `Skills required by the graph: ${agent.node.skills!.map(code).join(", ")}. Explicitly invoke each applicable installed skill and read it before using it. There is no emitted skills preload field. If a required skill is unavailable, report the missing skill and stop; never pretend it was loaded.`] : []),
    ...(agent.unmappedAllow.length > 0 || agent.unmappedDeny.length > 0 ? ["", `Custom capabilities have no native mapping: ${[...agent.unmappedAllow.map((c) => `allow ${c}`), ...agent.unmappedDeny.map((c) => `deny ${c}`)].join(", ")}. If the task depends on one whose meaning or enforcement is unavailable, report that limit and stop.`] : []),
    ...(agent.modelSource === "unset" ? ["", "No model is set for this node; use the session's subagent defaults. An explicit effort, when present, still applies."] : []),
  );
}

/** The report the node must return, derived from the conditions on its outgoing edges. */
function reportFormat(agent: ResolvedAgent, outbound: readonly Edge[]): string {
  const verdicts: string[] = [];
  for (const edge of outbound) {
    const when = edgeWhen(edge);
    const value = typeof when === "string" ? (when === "always" ? "done" : when) : when.verdict;
    if (!verdicts.includes(value)) verdicts.push(value);
  }
  if (verdicts.length === 0) verdicts.push("done");
  if (agent.isCritic && !verdicts.includes("invalid-evidence")) verdicts.push("invalid-evidence");

  const template = lines(
    `verdict: ${verdicts.join(" | ")}`,
    "outputs:",
    ...agent.node.outputs.map((output) => `  - ${output} — <where you left it>`),
    ...(agent.isCritic
      ? ["findings:", "  - <file>:<line> — <what is wrong, or the item it satisfies>"]
      : ["changes:", "  - <what you changed this round, and why>"]),
    "summary: <at most five lines>",
  );

  return lines(
    "## Report format",
    "",
    "End your reply with exactly this block, and keep it short — the lead routes on the verdict line:",
    "",
    fence(template, "text"),
    "",
    ...(verdicts.includes("pass") || verdicts.includes("fail")
      ? [
          `The lead takes the edge that matches your verdict, so do not hedge: ${code("pass")} means every acceptance condition is met, ${code(
            "fail",
          )} means at least one is not.`,
        ]
      : [`The lead continues on ${code(verdicts[0]!)} whatever the content of your report.`]),
  );
}
