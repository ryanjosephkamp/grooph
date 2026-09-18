/**
 * `.claude/agents/<graph-id>--<node-id>.md` — one subagent per agent node,
 * except the lead, which is the main session. Frontmatter fields come from
 * `docs/targets/claude-code.md` § "Unit mapping".
 */

import { edgeWhen } from "../../semantics.js";
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
    ),
    ownership(agent),
    evidenceRules(ctx, agent, evidence),
    capabilities(ctx, agent),
    reportFormat(ctx, agent, outbound),
  ];
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

function evidenceRules(ctx: PackageContext, agent: ResolvedAgent, evidence: string[]): string {
  return lines(
    "## Evidence rules",
    "",
    ...(evidence.length > 0
      ? [
          "You may inspect exactly what the lead hands you, which is this and nothing more:",
          "",
          ...evidence.map(bullet),
          "",
          agent.isCritic
            ? `If any of it is missing or unreadable, do not guess and do not substitute your own reading of the repository: report ${code(
                "invalid-evidence",
              )} and say which item you could not read. That round counts toward the loop's evidence stop.`
            : `If any of it is missing or unreadable, say so in your report rather than guessing.`,
        ]
      : [
          `No inbound edge lists evidence for you. Work from your declared inputs and the lead's prompt; say so in your report if something you need is missing.`,
        ]),
    ...(agent.isCritic
      ? [
          "",
          `You judge; you do not fix. ${
            agent.disallowedTools.length > 0
              ? `Editing tools are withheld from you on purpose (${agent.disallowedTools.join(", ")}).`
              : "Report findings instead of editing."
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
function reportFormat(ctx: PackageContext, agent: ResolvedAgent, outbound: readonly Edge[]): string {
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
