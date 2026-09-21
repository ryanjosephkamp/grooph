/**
 * `.claude/agents/<graph-id>--<node-id>.md` — one subagent per agent node,
 * except the lead, which is the main session. Frontmatter fields come from
 * `docs/targets/claude-code.md` § "Unit mapping".
 */

import { edgeWhen, loopsOfNode } from "../../semantics.js";
import type { Edge } from "../../types.js";
import { bullet, code, doc, fence, firstSentence, lines, quoteYaml } from "../markdown.js";
import type { PackageContext, ResolvedAgent } from "./context.js";

export function agentFile(ctx: PackageContext, agent: ResolvedAgent): string {
  return doc(frontmatter(ctx, agent), ...body(ctx, agent));
}

function frontmatter(ctx: PackageContext, agent: ResolvedAgent): string {
  const description = `${agent.role} for graph ${ctx.graphId}. ${firstSentence(agent.node.brief)}`;
  return lines(
    "---",
    `name: ${agent.agentName}`,
    `description: ${quoteYaml(description)}`,
    ...(agent.model ? [`model: ${agent.model}`] : []),
    ...(agent.effort ? [`effort: ${agent.effort}`] : []),
    ...(agent.tools.length > 0 ? [`tools: ${agent.tools.join(", ")}`] : []),
    ...(agent.disallowedTools.length > 0 ? [`disallowedTools: ${agent.disallowedTools.join(", ")}`] : []),
    // graph-ir §1 `skills`: preloaded at dispatch; an unknown name is the harness's to refuse, so none is checked here.
    ...((agent.node.skills ?? []).length > 0 ? [`skills: ${agent.node.skills!.join(", ")}`] : []),
    "---",
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
      `Node ${code(node.id)} in the grooph graph ${code(ctx.graphId)} (${ctx.doc.name}). The lead dispatches you and you report back to the lead — you do not dispatch anyone else, and you do not update the run's progress log.`,
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
          `You judge; you do not fix. ${
            agent.disallowedTools.length > 0
              ? `Editing tools are withheld from you on purpose (${agent.disallowedTools.join(", ")}).`
              : "Report findings instead of editing."
          }${
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
    "## Capabilities",
    "",
    bullet(`Allowed: ${allow.map(code).join(", ")} → tools ${agent.tools.join(", ") || "(none)"}`),
    ...(deny.length > 0
      ? [bullet(`Denied: ${deny.map(code).join(", ")} → withheld tools ${agent.disallowedTools.join(", ") || "(none)"}`)]
      : []),
    ...(agent.unmappedAllow.length > 0 || agent.unmappedDeny.length > 0
      ? [
          "",
          `Capabilities with no tool in this harness, stated here so a human can wire them by hand: ${[
            ...agent.unmappedAllow.map((c) => `allow ${c}`),
            ...agent.unmappedDeny.map((c) => `deny ${c}`),
          ].join(", ")}.`,
        ]
      : []),
    ...(agent.modelSource === "unset"
      ? [
          "",
          `The graph pins no model or effort for this node, so you run at the session's defaults. Set ${code(
            "model",
          )} in the graph document if that matters.`,
        ]
      : []),
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
