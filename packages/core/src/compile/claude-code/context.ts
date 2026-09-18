/**
 * The resolved view of a graph for the Claude Code target: names, models,
 * tools and paths, computed once so every emitted file agrees with the others.
 * Mapping source: `docs/targets/claude-code.md`.
 */

import { indexGraph, type GraphIndex } from "../../graph-index.js";
import { effectiveAdaptation, isCriticFamily, isWriterFamily, roleName } from "../../semantics.js";
import { getProfile, type TargetProfile } from "../../targets/index.js";
import type { Adaptation, AgentNode, Capability, Edge, Graph, Id, Node } from "../../types.js";

export type ResolvedAgent = {
  node: AgentNode;
  /** `<graph-id>--<node-id>`; subagent names forbid colons */
  agentName: string;
  file: string;
  role: string;
  isCritic: boolean;
  isWriter: boolean;
  /** absent when the document pins no model: the subagent inherits the session's */
  model?: string;
  modelSource: "pin" | "tier" | "unset";
  effort?: string;
  tools: string[];
  disallowedTools: string[];
  /** capability strings with no tool mapping; recorded in the body, never as tools */
  unmappedAllow: Capability[];
  unmappedDeny: Capability[];
};

export type PackageContext = {
  doc: Graph;
  index: GraphIndex;
  profile: TargetProfile;
  graphId: Id;
  /** `.grooph/<graph-id>` */
  root: string;
  paths: {
    graph: string;
    lead: string;
    mapping: string;
    kickoff: string;
    skill: string;
    runs: string;
    progress: string;
    notes: string;
    /** the run's working copy of the graph (graph-ir §2) */
    workingCopy: string;
  };
  /** the level this run follows: the document's, the default, or a stricter policy (graph-ir §2) */
  adaptation: Adaptation;
  agents: ResolvedAgent[];
  agentByNode: Map<Id, ResolvedAgent>;
  /** the `lead`-role node, when the document has one */
  leadNode?: AgentNode;
};

export function buildContext(doc: Graph): PackageContext {
  const index = indexGraph(doc);
  const profile = getProfile(doc.target?.harness ?? "claude-code");
  const graphId = doc.id;
  const root = `.grooph/${graphId}`;

  const leadNode = (doc.nodes ?? []).find(
    (node): node is AgentNode => node.kind === "agent" && node.role === "lead",
  );

  const agents = (doc.nodes ?? [])
    .filter((node): node is AgentNode => node.kind === "agent")
    .filter((node) => node.id !== leadNode?.id)
    .map((node) => resolveAgent(node, profile, graphId));

  return {
    doc,
    index,
    profile,
    graphId,
    root,
    paths: {
      graph: `${root}/graph.grooph.json`,
      lead: `${root}/LEAD.md`,
      mapping: `${root}/MAPPING.md`,
      kickoff: `${root}/KICKOFF.md`,
      skill: `.claude/skills/${graphId}/SKILL.md`,
      runs: `${root}/runs`,
      progress: `${root}/runs/<run-id>/PROGRESS.md`,
      notes: `${root}/runs/<run-id>/notes.jsonl`,
      workingCopy: `${root}/runs/<run-id>/graph.grooph.json`,
    },
    adaptation: effectiveAdaptation(doc),
    agents,
    agentByNode: new Map(agents.map((agent) => [agent.node.id, agent])),
    ...(leadNode ? { leadNode } : {}),
  };
}

function resolveAgent(node: AgentNode, profile: TargetProfile, graphId: Id): ResolvedAgent {
  const agentName = `${graphId}--${node.id}`;

  const pin = node.model?.pin?.[profile.harness];
  const model = pin ?? (node.model ? profile.models[node.model.tier] : undefined);
  const modelSource: ResolvedAgent["modelSource"] = pin ? "pin" : node.model ? "tier" : "unset";

  const allow = node.allow ?? profile.defaultCapabilities;
  const allowed = toolsFor(allow, profile);
  const denied = toolsFor(node.deny ?? [], profile).filter((tool) => !allowed.includes(tool));

  return {
    node,
    agentName,
    file: `.claude/agents/${agentName}.md`,
    role: roleName(node),
    isCritic: isCriticFamily(node),
    isWriter: isWriterFamily(node),
    ...(model ? { model } : {}),
    modelSource,
    ...(node.effort ? { effort: profile.effort[node.effort] } : {}),
    tools: allowed,
    disallowedTools: denied,
    unmappedAllow: unmapped(allow, profile),
    unmappedDeny: unmapped(node.deny ?? [], profile),
  };
}

/** Capabilities → tools, deduplicated and in the profile's stable order. */
function toolsFor(capabilities: readonly Capability[], profile: TargetProfile): string[] {
  const tools = new Set<string>();
  for (const capability of capabilities) {
    for (const tool of profile.capabilityTools[capability] ?? []) tools.add(tool);
  }
  return profile.toolOrder.filter((tool) => tools.has(tool));
}

const unmapped = (capabilities: readonly Capability[], profile: TargetProfile): Capability[] =>
  capabilities.filter((capability) => profile.capabilityTools[capability] === undefined);

/** Node ids an edge can route to, used when describing routing. */
export const nodeLabel = (node: Node | undefined, id: Id): string =>
  node ? `${node.name} (${node.kind})` : `unknown node ${id}`;

export const edgeDescription = (edge: Edge): string => `${edge.from} → ${edge.to}`;
